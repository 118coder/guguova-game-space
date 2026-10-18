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

                    var header = FindSteamCachedImage(appId, "header.jpg", allFolders);
                    var hero = FindSteamCachedImage(appId, "library_hero.jpg", allFolders) ?? header;
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

    private static string CleanName(string name) => Regex.Replace(name, @"\s*(™|®|\(R\)|\(TM\))\s*", " ").Trim();

    /// <summary>The artwork cache lives next to the client that owns the app;
    /// with several libraries we must look in every Steam root, not just the
    /// default one, otherwise some steam:// artwork renders as a broken image.</summary>
    private static string? FindSteamCachedImage(string appId, string fileName, List<string> steamRoots)
    {
        foreach (var root in steamRoots)
        {
            try
            {
                var candidates = new[]
                {
                    Path.Combine(root, "appcache", "librarycache", appId, fileName),
                    Path.Combine(root, "appcache", "librarycache", appId, fileName.Replace("_hero", "")),
                    Path.Combine(root, "appcache", "librarycache", $"{appId}_{fileName}")
                };
                foreach (var path in candidates)
                {
                    if (File.Exists(path)) return path;
                }

                var dir = Path.Combine(root, "appcache", "librarycache", appId);
                if (Directory.Exists(dir))
                {
                    var any = Directory.EnumerateFiles(dir, "*.jpg").FirstOrDefault();
                    if (any != null) return any;
                }
            }
            catch
            {
                // try the next root
            }
        }
        return null;
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
