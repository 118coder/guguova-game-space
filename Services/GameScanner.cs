using System.IO;
using System.Text.RegularExpressions;
using Microsoft.Win32;
using NovaGameSpace.Models;

namespace NovaGameSpace.Services;

/// <summary>
/// Finds games the user already owns: Steam libraries (appmanifest + acf),
/// Xbox/Epic launcher common folders, and Start Menu shortcuts. Read-only.
/// </summary>
public static class GameScanner
{
    public sealed record ScanResult(List<SteamCandidate> Steam, List<string> LocalExes, string? SteamRoot);

    public static ScanResult Scan(Action<string>? progress = null)
    {
        var steamRoot = FindSteamRoot();
        progress?.Invoke("正在读取 Steam 游戏库…");
        var steam = string.IsNullOrEmpty(steamRoot) ? new List<SteamCandidate>() : ScanSteam(steamRoot);
        progress?.Invoke($"找到 {steam.Count} 款 Steam 游戏，正在检索本机快捷方式…");
        var local = ScanStartMenu();
        return new ScanResult(steam, local, steamRoot);
    }

    /// <summary>Returns the best cached hero for one app id, for refreshing
    /// existing library entries without a full scan.</summary>
    public static string? FindSteamHero(string appId)
    {
        if (string.IsNullOrWhiteSpace(appId)) return null;
        var steamRoot = FindSteamRoot();
        if (string.IsNullOrEmpty(steamRoot)) return null;
        var folders = LibraryFolders(steamRoot);
        return FindSteamCachedImage(appId, "hero", folders);
    }

    /// <summary>One appcache/librarycache folder per Steam library root —
    /// the only place outside the media root that scan artwork comes from.
    /// The bridge maps each existing one onto a virtual host so cover URLs
    /// stay loadable without copying files.</summary>
    public static List<string> CacheRoots()
    {
        var roots = new List<string>();
        var steamRoot = FindSteamRoot();
        if (string.IsNullOrEmpty(steamRoot)) return roots;

        var folders = new List<string>();
        try
        {
            var vdf = Path.Combine(steamRoot, "steamapps", "libraryfolders.vdf");
            if (File.Exists(vdf))
            {
                foreach (Match match in Regex.Matches(File.ReadAllText(vdf), "\"path\"\\s+\"([^\"]+)\""))
                {
                    var path = match.Groups[1].Value.Replace(@"\", @"");
                    if (Directory.Exists(path) && !folders.Contains(path, StringComparer.OrdinalIgnoreCase))
                        folders.Add(path);
                }
            }
        }
        catch (Exception ex)
        {
            Log.Error("cache roots vdf", ex);
        }

        if (!folders.Contains(steamRoot, StringComparer.OrdinalIgnoreCase)) folders.Add(steamRoot);
        foreach (var folder in folders)
        {
            var cache = Path.Combine(folder, "appcache", "librarycache");
            if (Directory.Exists(cache) && !roots.Contains(cache, StringComparer.OrdinalIgnoreCase))
                roots.Add(cache);
        }
        return roots;
    }

    /// <summary>True for launcher clients themselves — a dropped shortcut to
    /// Steam is not a game.</summary>
    public static bool IsClientExecutable(string path) =>
        ClientExeNames.Contains(Path.GetFileName(path?.Trim() ?? ""));

    public static string? FindSteamRoot()
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(@"Software\Valve\Steam");
            var path = key?.GetValue("SteamPath") as string;
            if (!string.IsNullOrEmpty(path) && Directory.Exists(path)) return Path.GetFullPath(path);
        }
        catch { }

        foreach (var candidate in new[]
                 {
                     @"C:\Program Files (x86)\Steam",
                     @"C:\Program Files\Steam",
                     @"D:\Steam",
                     @"D:\Program Files (x86)\Steam",
                     @"E:\Steam"
                 })
        {
            if (Directory.Exists(candidate)) return candidate;
        }
        return null;
    }

    private static List<string> LibraryFolders(string steamRoot)
    {
        var folders = new List<string> { steamRoot };
        var vdf = Path.Combine(steamRoot, "steamapps", "libraryfolders.vdf");
        try
        {
            if (File.Exists(vdf))
            {
                var text = File.ReadAllText(vdf);
                foreach (Match match in Regex.Matches(text, "\"path\"\\s+\"([^\"]+)\""))
                {
                    var path = match.Groups[1].Value.Replace(@"\\", @"\");
                    if (Directory.Exists(path) && !folders.Contains(path, StringComparer.OrdinalIgnoreCase))
                        folders.Add(path);
                }
            }
        }
        catch (Exception ex)
        {
            Log.Error("steam libraryfolders", ex);
        }
        return folders;
    }

    private static List<SteamCandidate> ScanSteam(string steamRoot)
    {
        var results = new List<SteamCandidate>();
        var allFolders = LibraryFolders(steamRoot);
        foreach (var folder in allFolders)
        {
            var steamApps = Path.Combine(folder, "steamapps");
            if (!Directory.Exists(steamApps)) continue;
            IEnumerable<string> manifests;
            try
            {
                manifests = Directory.EnumerateFiles(steamApps, "appmanifest_*.acf", SearchOption.TopDirectoryOnly);
            }
            catch
            {
                continue;
            }

            foreach (var manifest in manifests)
            {
                try
                {
                    var text = File.ReadAllText(manifest);
                    var appId = MatchValue(text, "appid");
                    var name = MatchValue(text, "name");
                    var installDir = MatchValue(text, "installdir");
                    if (string.IsNullOrWhiteSpace(appId) || string.IsNullOrWhiteSpace(name)) continue;
                    var gameDir = Path.Combine(steamApps, "common", installDir ?? name);
                    if (!Directory.Exists(gameDir)) continue;

                    var exe = FindMainExecutable(gameDir, name);
                    if (exe == null) continue;

                    // Pick by resolution, not by file name. Steam keeps art in
                    // per-hash subfolders next to the legacy flat files, and a
                    // folder may also hold a 32×32 icon; the old "any *.jpg"
                    // fallback grabbed that icon and the launcher upscaled it.
                    var header = FindSteamCachedImage(appId, "header", allFolders);
                    var hero = FindSteamCachedImage(appId, "hero", allFolders) ?? header;
                    results.Add(new SteamCandidate(
                        appId,
                        CleanName(name),
                        gameDir,
                        exe,
                        hero,
                        header));
                }
                catch (Exception ex)
                {
                    Log.Error($"steam manifest {manifest}", ex);
                }
            }
        }

        return results
            .GroupBy(r => r.AppId)
            .Select(g => g.First())
            .OrderBy(r => r.Name, StringComparer.CurrentCultureIgnoreCase)
            .ToList();
    }

    /// <summary>Drops the trademark noise every store appends to a title.
    /// Shared with PlatformScanner so an Epic or GOG row reads exactly like a
    /// Steam one.</summary>
    public static string CleanName(string name) => Regex.Replace(name, @"\s*(™|®|\(R\)|\(TM\))\s*", " ").Trim();

    /// <summary>The artwork cache lives next to the client that owns the app;
    /// with several libraries we must look in every Steam root, not just the
    /// default one, otherwise some steam:// artwork renders as a broken image.
    ///
    /// <paramref name="kind"/> is "hero" or "header". Files are matched by name
    /// anywhere under the app's cache folder (Steam stores them in per-hash
    /// subfolders, with localized variants such as
    /// <c>library_hero_schinese.jpg</c>), then the largest candidate wins, so a
    /// 32×32 icon or a 192×62 blur placeholder can never be picked over the
    /// 1920-wide original.</summary>
    private static string? FindSteamCachedImage(string appId, string kind, List<string> steamRoots)
    {
        // hero → library_hero.jpg / library_hero_<lang>.jpg, never the blur strip.
        // header → library_header*.jpg / header.jpg.
        var heroPattern = kind == "hero" ? "library_hero" : "library_header";
        var best = (Path: (string?)null, Pixels: 0L);

        foreach (var root in steamRoots)
        {
            try
            {
                var baseDir = Path.Combine(root, "appcache", "librarycache", appId);
                if (!Directory.Exists(baseDir)) continue;

                var files = Directory.EnumerateFiles(baseDir, "*.jpg", SearchOption.AllDirectories)
                    .Concat(Directory.EnumerateFiles(baseDir, "*.png", SearchOption.AllDirectories))
                    .Where(path => MatchesArtKind(path, heroPattern));

                foreach (var path in files)
                {
                    var pixels = SafePixelCount(path);
                    if (pixels > best.Pixels) best = (path, pixels);
                }

                // Legacy flat layout: <appid>_hero.jpg etc.
                foreach (var suffix in kind == "hero" ? new[] { "hero", "library_hero" } : new[] { "header", "library_header" })
                {
                    var flat = Path.Combine(root, "appcache", "librarycache", $"{appId}_{suffix}.jpg");
                    var pixels = SafePixelCount(flat);
                    if (pixels > best.Pixels) best = (flat, pixels);
                }
            }
            catch
            {
                // try the next root
            }
        }

        // A 192×62 blur strip is not a usable hero; treat that as "not found".
        return best.Pixels >= 64 * 64 ? best.Path : null;
    }

    private static bool MatchesArtKind(string path, string prefix)
    {
        var name = Path.GetFileNameWithoutExtension(path).ToLowerInvariant();
        if (!name.StartsWith(prefix)) return false;
        // Steam ships a deliberately blurred variant for the library backdrop.
        return !name.Contains("blur") && !name.Contains("logo");
    }

    private static long SafePixelCount(string path)
    {
        try
        {
            if (!File.Exists(path)) return 0;
            // Header-only read: no decode of the full image.
            using var stream = File.OpenRead(path);
            using var image = System.Drawing.Image.FromStream(stream, false, false);
            return (long)image.Width * image.Height;
        }
        catch
        {
            return 0;
        }
    }

    private static string MatchValue(string text, string key)
    {
        var match = Regex.Match(text, $"\"{key}\"\\s+\"([^\"]*)\"");
        return match.Success ? match.Groups[1].Value : "";
    }

    private static readonly string[] SkipExeHints =
    {
        "unins", "unitycrashhandler", "crashhandler", "launcherhelper", "redist", "dxsetup",
        "vc_redist", "install", "setup", "helper", "eac_launcher", "start_protected_game",
        "easyanticheat", "bootstrap"
    };

    /// <summary>Launcher clients themselves. A Start Menu full of stores used to
    /// mean "全选" imported Steam, Epic and friends as if they were games.</summary>
    private static readonly HashSet<string> ClientExeNames = new(StringComparer.OrdinalIgnoreCase)
    {
        "steam.exe", "steamerrorhandler.exe",
        "epicgameslauncher.exe", "egs.exe",
        "gog galaxy.exe", "goggalaxy.exe",
        "battle.net.exe", "battle.net.exe.exe",
        "origin.exe", "eadesktop.exe", "eadownload.exe",
        "upc.exe", "ubisoftconnect.exe",
        "itch.exe",
        "guguova.exe"
    };

    /// <summary>Picks the most plausible game executable in a folder.</summary>
    public static string? FindMainExecutable(string gameDir, string gameName)
    {
        try
        {
            var exes = Directory.EnumerateFiles(gameDir, "*.exe", SearchOption.AllDirectories)
                .Where(path => !path.Contains(@"\_CommonRedist", StringComparison.OrdinalIgnoreCase))
                .Where(path => !path.Contains(@"\redist", StringComparison.OrdinalIgnoreCase))
                .Where(path => !SkipExeHints.Any(h => Path.GetFileName(path).Contains(h, StringComparison.OrdinalIgnoreCase)))
                .ToList();
            if (exes.Count == 0) return null;

            var normalized = Normalize(gameName);
            return exes
                .OrderByDescending(path =>
                {
                    var file = Normalize(Path.GetFileNameWithoutExtension(path));
                    var score = 0;
                    if (file == normalized) score += 100;
                    else if (file.Contains(normalized) || normalized.Contains(file)) score += 60;
                    var depth = path.Count(c => c == '\\');
                    score -= depth;
                    // Prefer executables directly in the game folder.
                    return score;
                })
                .FirstOrDefault();
        }
        catch
        {
            return null;
        }
    }

    private static string Normalize(string value) =>
        Regex.Replace(value.ToLowerInvariant(), @"[^a-z0-9\u4e00-\u9fff]", "");

    private static List<string> ScanStartMenu()
    {
        var results = new List<string>();
        var folders = new[]
        {
            Environment.GetFolderPath(Environment.SpecialFolder.CommonStartMenu),
            Environment.GetFolderPath(Environment.SpecialFolder.StartMenu)
        };
        foreach (var folder in folders)
        {
            if (string.IsNullOrEmpty(folder) || !Directory.Exists(folder)) continue;
            foreach (var shortcut in SafeEnumerateShortcuts(folder))
            {
                try
                {
                    var target = ShortcutResolver.Resolve(shortcut);
                    if (string.IsNullOrEmpty(target) || !target.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)) continue;
                    if (!File.Exists(target)) continue;
                    if (SkipExeHints.Any(h => Path.GetFileName(target).Contains(h, StringComparison.OrdinalIgnoreCase))) continue;
                    if (ClientExeNames.Contains(Path.GetFileName(target))) continue;
                    var name = Path.GetFileName(target).ToLowerInvariant();
                    if (name.Contains("uninstall") || name.Contains("update") || name.Contains("readme")) continue;
                    results.Add(target);
                }
                catch
                {
                    // A single unreadable shortcut must not abort the scan.
                }
            }
        }
        return results.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
    }

    /// <summary>Walks the Start Menu tree, silently skipping folders the user
    /// cannot read (Windows 11 protects the generated "程序" junction).</summary>
    private static IEnumerable<string> SafeEnumerateShortcuts(string root)
    {
        var stack = new Stack<string>();
        stack.Push(root);
        while (stack.Count > 0)
        {
            var dir = stack.Pop();
            string[] files;
            string[] dirs;
            try
            {
                files = Directory.GetFiles(dir, "*.lnk");
                dirs = Directory.GetDirectories(dir);
            }
            catch
            {
                continue;
            }
            foreach (var file in files) yield return file;
            foreach (var child in dirs) stack.Push(child);
        }
    }
}
