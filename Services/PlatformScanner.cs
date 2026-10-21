using System.IO;
using System.Text.Json;
using System.Xml.Linq;
using Microsoft.Win32;
using NovaGameSpace.Models;

namespace NovaGameSpace.Services;

/// <summary>
/// A launcher family GUGUOVA can import from. Data only: the UI prints
/// <see cref="Label"/>, the library stores <see cref="Id"/> in GameEntry.Source,
/// and the scanner keys on it. No third-party logo or brand colour travels with
/// it — a platform badge is a text pill in the theme's own ink.
/// </summary>
public sealed record GamePlatform(string Id, string Label, string Short)
{
    public static readonly GamePlatform Steam = new("steam", "Steam", "STEAM");
    public static readonly GamePlatform Epic = new("epic", "Epic Games", "EPIC");
    public static readonly GamePlatform Gog = new("gog", "GOG", "GOG");
    public static readonly GamePlatform Ubisoft = new("ubisoft", "Ubisoft Connect", "UBISOFT");
    public static readonly GamePlatform Ea = new("ea", "EA app", "EA");
    public static readonly GamePlatform Xbox = new("xbox", "Xbox", "XBOX");
    public static readonly GamePlatform BattleNet = new("battlenet", "战网", "BATTLE.NET");

    /// <summary>Import order. Steam first because it is the one platform where
    /// the client owns the launch, then the rest by installed-user base.</summary>
    public static readonly GamePlatform[] All =
    {
        Steam, Epic, Gog, Ubisoft, Xbox, Ea, BattleNet
    };

    public static GamePlatform? Find(string? id)
    {
        if (string.IsNullOrWhiteSpace(id)) return null;
        var clean = id.Trim().ToLowerInvariant();
        foreach (var platform in All)
            if (platform.Id == clean) return platform;
        return null;
    }

    /// <summary>True for a library entry imported from a launcher.</summary>
    public static bool IsLauncher(string? source) => Find(source) != null;

    /// <summary>Human label for a GameEntry.Source value. Unknown and manual
    /// entries both read as "手动添加" because that is how they got here.</summary>
    public static string LabelFor(string? source) => Find(source)?.Label ?? "手动添加";

    public static string ShortFor(string? source) => Find(source)?.Short ?? "";
}

/// <summary>One installed game found outside Steam.</summary>
public sealed record PlatformCandidate(
    string Platform,
    string PlatformId,
    string Name,
    string InstallDir,
    string ExePath,
    string? LaunchUri,
    string? Args,
    string? HeroPath,
    string? CoverPath);

/// <summary>A platform the machine actually has, with a cheap item count for
/// the "what will be imported" line in the import sheet.</summary>
public sealed record PlatformPresence(string Platform, int Count);

/// <summary>
/// Reads the installed-game metadata of every launcher family except Steam
/// (Steam has its own scanner because of the artwork cache). Read-only:
/// nothing here writes a registry value or a file.
///
/// Each scanner is best-effort. A missing launcher, a locked key or a corrupt
/// manifest must never abort the whole import, so every probe is wrapped and
/// the ones that fail simply contribute no rows.
/// </summary>
public static class PlatformScanner
{
    public static List<PlatformCandidate> Scan(Action<string>? progress = null)
    {
        var results = new List<PlatformCandidate>();
        progress?.Invoke("正在读取 Epic 游戏库…");
        Collect(results, ScanEpic);
        progress?.Invoke("正在读取 GOG 与 Ubisoft 游戏库…");
        Collect(results, ScanGog);
        Collect(results, ScanUbisoft);
        progress?.Invoke("正在读取 EA 与 Xbox 游戏…");
        Collect(results, ScanEa);
        Collect(results, ScanXbox);
        Collect(results, ScanBattleNet);

        return results
            .GroupBy(item => item.Platform + "|" + item.ExePath, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .OrderBy(item => PlatformOrder(item.Platform))
            .ThenBy(item => item.Name, StringComparer.CurrentCultureIgnoreCase)
            .ToList();
    }

    private static int PlatformOrder(string platform)
    {
        for (var index = 0; index < GamePlatform.All.Length; index++)
            if (GamePlatform.All[index].Id == platform) return index;
        return GamePlatform.All.Length;
    }

    private static void Collect(List<PlatformCandidate> results, Action<List<PlatformCandidate>> scanner)
    {
        try
        {
            scanner(results);
        }
        catch (Exception ex)
        {
            Log.Error("platform scan", ex);
        }
    }

    /// <summary>Cheap "is it installed and how many" probe for the import
    /// sheet. Counts manifests and registry entries only — no exe search, no
    /// artwork decode — so the sheet opens immediately.</summary>
    public static List<PlatformPresence> Detect()
    {
        var found = new List<PlatformPresence>();

        var steamRoot = GameScanner.FindSteamRoot();
        var steamCount = 0;
        if (!string.IsNullOrEmpty(steamRoot))
        {
            try
            {
                foreach (var folder in SteamLibraryFolders(steamRoot))
                {
                    var apps = Path.Combine(folder, "steamapps");
                    if (!Directory.Exists(apps)) continue;
                    steamCount += Directory.GetFiles(apps, "appmanifest_*.acf").Length;
                }
            }
            catch { }
        }
        found.Add(new PlatformPresence(GamePlatform.Steam.Id, steamCount));

        found.Add(new PlatformPresence(GamePlatform.Epic.Id, CountFiles(EpicManifestFolders(), "*.item")));
        found.Add(new PlatformPresence(GamePlatform.Gog.Id, SubKeyCount(@"SOFTWARE\GOG.com\Games")));
        found.Add(new PlatformPresence(GamePlatform.Ubisoft.Id, SubKeyCount(@"SOFTWARE\Ubisoft\Launcher\Installs")));
        found.Add(new PlatformPresence(GamePlatform.Ea.Id, SubKeyCount(@"SOFTWARE\Electronic Arts\EA Games")));
        found.Add(new PlatformPresence(GamePlatform.Xbox.Id, CountXboxFolders()));
        found.Add(new PlatformPresence(GamePlatform.BattleNet.Id, BattleNetPresence()));
        return found;
    }

    private static int CountFiles(IEnumerable<string> folders, string pattern)
    {
        var total = 0;
        foreach (var folder in folders)
        {
            try
            {
                if (Directory.Exists(folder)) total += Directory.GetFiles(folder, pattern).Length;
            }
            catch { }
        }
        return total;
    }

    /* ---------------------------------------------------------------- Epic */

    private static IEnumerable<string> EpicManifestFolders()
    {
        var programData = Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData);
        var roaming = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        if (!string.IsNullOrEmpty(programData))
            yield return Path.Combine(programData, "Epic", "EpicGamesLauncher", "Data", "Manifests");
        if (!string.IsNullOrEmpty(roaming))
            yield return Path.Combine(roaming, "Epic", "EpicGamesLauncher", "Data", "Manifests");
    }

    /// <summary>Epic writes one .item JSON per installed app. The launcher
    /// folder is the only index it keeps, so this is the documented way to
    /// enumerate an Epic library without touching the client's sqlite cache.</summary>
    private static void ScanEpic(List<PlatformCandidate> results)
    {
        foreach (var folder in EpicManifestFolders())
        {
            if (!Directory.Exists(folder)) continue;
            foreach (var file in Directory.EnumerateFiles(folder, "*.item"))
            {
                try
                {
                    using var stream = File.OpenRead(file);
                    using var document = JsonDocument.Parse(stream);
                    var root = document.RootElement;

                    var name = Text(root, "DisplayName");
                    var installDir = Text(root, "InstallLocation");
                    var appName = Text(root, "AppName");
                    var catalogId = Text(root, "CatalogItemId");
                    var catalogNamespace = Text(root, "CatalogNamespace");
                    if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(installDir)) continue;
                    if (!Directory.Exists(installDir)) continue;

                    var exePath = ResolveExecutable(installDir, Text(root, "LaunchExecutable"), name);
                    if (exePath == null) continue;

                    string? uri = null;
                    if (!string.IsNullOrEmpty(appName) && !string.IsNullOrEmpty(catalogId) &&
                        !string.IsNullOrEmpty(catalogNamespace))
                    {
                        var target = Uri.EscapeDataString($"{catalogNamespace}:{catalogId}:{appName}");
                        uri = "com.epicgames.launcher://apps/" + target + "?action=launch&silent=true";
                    }

                    results.Add(new PlatformCandidate(
                        GamePlatform.Epic.Id,
                        string.IsNullOrEmpty(appName) ? catalogId : appName,
                        GameScanner.CleanName(name),
                        installDir,
                        exePath,
                        uri,
                        null,
                        null,
                        null));
                }
                catch (Exception ex)
                {
                    Log.Error($"epic manifest {file}", ex);
                }
            }
        }
    }

    private static string Text(JsonElement element, string name)
    {
        if (element.ValueKind != JsonValueKind.Object) return "";
        if (!element.TryGetProperty(name, out var value)) return "";
        return value.ValueKind == JsonValueKind.String ? value.GetString() ?? "" : "";
    }

    /* ----------------------------------------------------------------- GOG */

    /// <summary>GOG Galaxy / offline installers both write a full record
    /// (name, path, exe) under this key, so no manifest parsing is needed.
    /// GOG games are DRM-free: the exe is the launch, no client handoff.</summary>
    private static void ScanGog(List<PlatformCandidate> results)
    {
        foreach (var hive in new[] { RegistryHive.LocalMachine, RegistryHive.CurrentUser })
        {
            foreach (var view in new[] { RegistryView.Registry64, RegistryView.Registry32 })
            {
                using var games = OpenSubKey(hive, view, @"SOFTWARE\GOG.com\Games");
                if (games == null) continue;
                foreach (var id in games.GetSubKeyNames())
                {
                    try
                    {
                        using var entry = games.OpenSubKey(id);
                        if (entry == null) continue;

                        var name = Convert.ToString(entry.GetValue("gameName")) ?? "";
                        var dir = Convert.ToString(entry.GetValue("path")) ?? "";
                        var exe = Convert.ToString(entry.GetValue("exe")) ?? "";
                        if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(exe)) continue;

                        var exePath = ResolveExecutable(string.IsNullOrEmpty(dir) ? Path.GetDirectoryName(exe) : dir, exe, name);
                        if (exePath == null) continue;

                        var gameId = Convert.ToString(entry.GetValue("gameID"));
                        results.Add(new PlatformCandidate(
                            GamePlatform.Gog.Id,
                            string.IsNullOrEmpty(gameId) ? id : gameId,
                            GameScanner.CleanName(name),
                            string.IsNullOrEmpty(dir) ? Path.GetDirectoryName(exePath) ?? "" : dir,
                            exePath,
                            null,
                            Convert.ToString(entry.GetValue("launchParam")),
                            null,
                            null));
                    }
                    catch (Exception ex)
                    {
                        Log.Error($"gog registry {id}", ex);
                    }
                }
            }
        }
    }

    /* ------------------------------------------------------------- Ubisoft */

    /// <summary>Ubisoft Connect only records the install folder; the display
    /// name is not in the registry, so the folder name is the best identity.
    /// The client must start the game, hence the uplay:// hand-off.</summary>
    private static void ScanUbisoft(List<PlatformCandidate> results)
    {
        foreach (var hive in new[] { RegistryHive.LocalMachine, RegistryHive.CurrentUser })
        {
            foreach (var view in new[] { RegistryView.Registry64, RegistryView.Registry32 })
            {
                using var installs = OpenSubKey(hive, view, @"SOFTWARE\Ubisoft\Launcher\Installs");
                if (installs == null) continue;
                foreach (var id in installs.GetSubKeyNames())
                {
                    try
                    {
                        using var entry = installs.OpenSubKey(id);
                        var dir = Convert.ToString(entry?.GetValue("InstallDir")) ?? "";
                        if (string.IsNullOrWhiteSpace(dir) || !Directory.Exists(dir)) continue;

                        var name = GameScanner.CleanName(Path.GetFileName(dir.TrimEnd('\\', '/')));
                        if (string.IsNullOrWhiteSpace(name)) continue;
                        var exePath = GameScanner.FindMainExecutable(dir, name);
                        if (exePath == null) continue;

                        results.Add(new PlatformCandidate(
                            GamePlatform.Ubisoft.Id,
                            id,
                            name,
                            dir,
                            exePath,
                            "uplay://launch/" + id + "/0",
                            null,
                            null,
                            null));
                    }
                    catch (Exception ex)
                    {
                        Log.Error($"ubisoft registry {id}", ex);
                    }
                }
            }
        }
    }

    /* ------------------------------------------------------------------ EA */

    /// <summary>EA app keeps "Install Dir" per title key. There is no stable
    /// content id in this key, so the game starts from its own exe; the app
    /// itself is brought up by the game when it needs a licence check.</summary>
    private static void ScanEa(List<PlatformCandidate> results)
    {
        foreach (var hive in new[] { RegistryHive.LocalMachine, RegistryHive.CurrentUser })
        {
            foreach (var view in new[] { RegistryView.Registry64, RegistryView.Registry32 })
            {
                using var games = OpenSubKey(hive, view, @"SOFTWARE\Electronic Arts\EA Games");
                if (games == null) continue;
                foreach (var key in games.GetSubKeyNames())
                {
                    try
                    {
                        using var entry = games.OpenSubKey(key);
                        if (entry == null) continue;
                        var dir = Convert.ToString(entry.GetValue("Install Dir")) ?? "";
                        if (string.IsNullOrWhiteSpace(dir) || !Directory.Exists(dir)) continue;

                        var display = Convert.ToString(entry.GetValue("DisplayName"));
                        var name = GameScanner.CleanName(string.IsNullOrWhiteSpace(display) ? key : display);
                        var exePath = GameScanner.FindMainExecutable(dir, name);
                        if (exePath == null) continue;

                        results.Add(new PlatformCandidate(
                            GamePlatform.Ea.Id,
                            key,
                            name,
                            dir,
                            exePath,
                            null,
                            null,
                            null,
                            null));
                    }
                    catch (Exception ex)
                    {
                        Log.Error($"ea registry {key}", ex);
                    }
                }
            }
        }
    }

    /* ---------------------------------------------------------------- Xbox */

    private static IEnumerable<string> XboxRoots()
    {
        DriveInfo[] drives;
        try
        {
            drives = DriveInfo.GetDrives();
        }
        catch
        {
            yield break;
        }

        foreach (var drive in drives)
        {
            string? root = null;
            try
            {
                if (!drive.IsReady) continue;
                if (drive.DriveType != DriveType.Fixed && drive.DriveType != DriveType.Removable) continue;
                root = Path.Combine(drive.RootDirectory.FullName, "XboxGames");
            }
            catch
            {
                continue;
            }
            if (root != null && Directory.Exists(root)) yield return root;
        }
    }

    private static int CountXboxFolders()
    {
        var total = 0;
        foreach (var root in XboxRoots())
        {
            try
            {
                total += Directory.GetDirectories(root).Length;
            }
            catch { }
        }
        return total;
    }

    /// <summary>PC Game Pass installs land in &lt;drive&gt;:\XboxGames\&lt;Title&gt;\Content.
    /// Windows protects WindowsApps, so the package identity and launch target
    /// come from the AppxManifest inside the game folder, and the game is
    /// started through shell:AppsFolder — running its exe directly is refused.</summary>
    private static void ScanXbox(List<PlatformCandidate> results)
    {
        foreach (var root in XboxRoots())
        {
            IEnumerable<string> folders;
            try
            {
                folders = Directory.GetDirectories(root);
            }
            catch
            {
                continue;
            }

            foreach (var folder in folders)
            {
                try
                {
                    var content = Path.Combine(folder, "Content");
                    if (!Directory.Exists(content)) content = folder;
                    var manifestPath = Path.Combine(content, "AppxManifest.xml");
                    if (!File.Exists(manifestPath)) manifestPath = Path.Combine(folder, "AppxManifest.xml");
                    if (!File.Exists(manifestPath)) continue;

                    var document = XDocument.Load(manifestPath);
                    var ns = document.Root?.Name.Namespace ?? XNamespace.None;
                    var identity = document.Root?.Element(ns + "Identity");
                    var identityName = identity?.Attribute("Name")?.Value;
                    var application = document.Root?
                        .Element(ns + "Applications")?
                        .Elements(ns + "Application")
                        .FirstOrDefault();
                    var applicationId = application?.Attribute("Id")?.Value ?? "App";
                    var executable = application?.Attribute("Executable")?.Value;
                    if (string.IsNullOrWhiteSpace(identityName)) continue;

                    var name = GameScanner.CleanName(Path.GetFileName(folder.TrimEnd('\\', '/')));
                    var exePath = !string.IsNullOrEmpty(executable)
                        ? Path.Combine(content, executable.Replace('/', '\\'))
                        : GameScanner.FindMainExecutable(content, name) ?? "";
                    if (string.IsNullOrEmpty(exePath)) continue;

                    // shell:AppsFolder needs the *package family name*
                    // ("Name_publisherHash!App"), and the publisher hash is
                    // computed at install time, not written into the manifest.
                    // The installed-package repository has the answer; without
                    // it the plain identity still resolves for some titles, so
                    // that stays as the fallback instead of dropping the row.
                    var family = XboxPackageFamilyName(identityName!);
                    var aumid = (family ?? identityName) + "!" + applicationId;
                    results.Add(new PlatformCandidate(
                        GamePlatform.Xbox.Id,
                        aumid,
                        name,
                        content,
                        exePath,
                        "shell:AppsFolder\\" + aumid,
                        null,
                        null,
                        null));
                }
                catch (Exception ex)
                {
                    Log.Error($"xbox manifest {folder}", ex);
                }
            }
        }
    }

    /// <summary>Maps a package identity to its installed family name by
    /// walking the AppModel repository, which stores one key per installed
    /// package with both values. Returns null when the package is not
    /// registered for this user (never launched, or installed for another
    /// account).</summary>
    private static string? XboxPackageFamilyName(string identityName)
    {
        foreach (var hive in new[] { RegistryHive.CurrentUser, RegistryHive.LocalMachine })
        {
            foreach (var view in new[] { RegistryView.Registry64, RegistryView.Registry32 })
            {
                using var repo = OpenSubKey(hive, view,
                    @"Software\Classes\Local Settings\Software\Microsoft\Windows\CurrentVersion\AppModel\Repository\Packages");
                if (repo == null) continue;
                try
                {
                    foreach (var fullName in repo.GetSubKeyNames())
                    {
                        using var entry = repo.OpenSubKey(fullName);
                        if (entry == null) continue;
                        var packageId = Convert.ToString(entry.GetValue("PackageID"));
                        if (!string.Equals(packageId, identityName, StringComparison.OrdinalIgnoreCase)) continue;
                        var family = Convert.ToString(entry.GetValue("PackageFamilyName"));
                        if (!string.IsNullOrWhiteSpace(family)) return family;
                        // Fall back to the name/version/arch/id/publisher layout.
                        var parts = fullName.Split('_');
                        if (parts.Length >= 2) return parts[0] + "_" + parts[parts.Length - 1];
                    }
                }
                catch { }
            }
        }
        return null;
    }

    /* ---------------------------------------------------------- Battle.net */

    private static readonly Dictionary<string, string> BattleNetCodes = new(StringComparer.OrdinalIgnoreCase)
    {
        ["World of Warcraft"] = "WoW",
        ["Diablo III"] = "D3",
        ["Diablo IV"] = "Fen",
        ["Hearthstone"] = "WTCG",
        ["StarCraft II"] = "S2",
        ["Overwatch"] = "Pro",
        ["Overwatch 2"] = "Pro",
        ["Warcraft III"] = "ATR",
        ["Heroes of the Storm"] = "Hero"
    };

    private static readonly HashSet<string> BattleNetSkip = new(StringComparer.OrdinalIgnoreCase)
    {
        "Battle.net", "Blizzard Browser", "Blizzard Entertainment"
    };

    private static int BattleNetPresence()
    {
        var count = 0;
        foreach (var game in BattleNetInstalls()) count++;
        return count;
    }

    private static List<(string Name, string Dir)> BattleNetInstalls()
    {
        var found = new List<(string, string)>();
        foreach (var hive in new[] { RegistryHive.LocalMachine, RegistryHive.CurrentUser })
        {
            foreach (var view in new[] { RegistryView.Registry64, RegistryView.Registry32 })
            {
                using var games = OpenSubKey(hive, view, @"SOFTWARE\Blizzard Entertainment");
                if (games == null) continue;
                foreach (var key in games.GetSubKeyNames())
                {
                    if (BattleNetSkip.Contains(key)) continue;
                    try
                    {
                        using var entry = games.OpenSubKey(key);
                        var dir = Convert.ToString(entry?.GetValue("InstallLocation")) ?? "";
                        if (string.IsNullOrWhiteSpace(dir) || !Directory.Exists(dir)) continue;
                        found.Add((key, dir));
                    }
                    catch { }
                }
            }
        }
        return found;
    }

    /// <summary>Battle.net titles register under the client's own key; the
    /// known ones also accept a battlenet:// hand-off, which keeps the client
    /// overlay and the patch check working.</summary>
    private static void ScanBattleNet(List<PlatformCandidate> results)
    {
        foreach (var (key, dir) in BattleNetInstalls())
        {
            try
            {
                var name = GameScanner.CleanName(key);
                var exePath = GameScanner.FindMainExecutable(dir, name);
                if (exePath == null) continue;

                BattleNetCodes.TryGetValue(key, out var code);
                results.Add(new PlatformCandidate(
                    GamePlatform.BattleNet.Id,
                    string.IsNullOrEmpty(code) ? key : code,
                    name,
                    dir,
                    exePath,
                    string.IsNullOrEmpty(code) ? null : "battlenet://" + code,
                    null,
                    null,
                    null));
            }
            catch (Exception ex)
            {
                Log.Error($"battlenet {key}", ex);
            }
        }
    }

    /* ------------------------------------------------------- client presence */

    private static readonly HashSet<string> ClientPresenceCache = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>Whether the launcher that owns <paramref name="platformId"/>
    /// is installed on this machine. Imported rows keep their value either way,
    /// but the UI uses it to warn before a launch that cannot succeed. The
    /// answer is cached per session: a player does not install Battle.net in
    /// the middle of a run.</summary>
    public static bool ClientInstalled(string platformId)
    {
        var id = (platformId ?? "").Trim().ToLowerInvariant();
        lock (ClientPresenceCache)
        {
            switch (id)
            {
                case "steam":
                    return Cached("steam", () => !string.IsNullOrEmpty(GameScanner.FindSteamRoot()));
                case "epic":
                    return Cached("epic", () => EpicManifestFolders().Any(Directory.Exists));
                case "gog":
                    return Cached("gog", () => SubKeyCount(@"SOFTWARE\GOG.com") > 0 || SubKeyCount(@"SOFTWARE\GOG.com\Games") > 0);
                case "ubisoft":
                    return Cached("ubisoft", () => SubKeyCount(@"SOFTWARE\Ubisoft\Launcher") > 0);
                case "ea":
                    return Cached("ea", () => SubKeyCount(@"SOFTWARE\Electronic Arts") > 0);
                case "xbox":
                    return Cached("xbox", () => CountXboxFolders() > 0);
                case "battlenet":
                    return Cached("battlenet", BattleNetClientPresent);
                default:
                    return true;
            }
        }
    }

    private static bool Cached(string key, Func<bool> probe)
    {
        if (ClientPresenceCache.Contains(key)) return true;
        var result = false;
        try { result = probe(); } catch { result = false; }
        if (result) ClientPresenceCache.Add(key);
        return result;
    }

    private static bool BattleNetClientPresent()
    {
        foreach (var hive in new[] { RegistryHive.LocalMachine, RegistryHive.CurrentUser })
        {
            foreach (var view in new[] { RegistryView.Registry64, RegistryView.Registry32 })
            {
                using var key = OpenSubKey(hive, view, @"SOFTWARE\Blizzard Entertainment\Battle.net");
                var install = Convert.ToString(key?.GetValue("InstallLocation"));
                if (!string.IsNullOrWhiteSpace(install) && File.Exists(Path.Combine(install, "Battle.net.exe"))) return true;
            }
        }

        var programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
        if (!string.IsNullOrEmpty(programFiles) && File.Exists(Path.Combine(programFiles, "Battle.net", "Battle.net.exe"))) return true;
        return false;
    }

    /* ---------------------------------------------------------------- misc */

    /// <summary>Validates a launcher-provided executable. Manifests sometimes
    /// point at a relative path with forward slashes, and an uninstalled DLC
    /// can leave a stale entry behind; both cases fall back to the folder scan.</summary>
    private static string? ResolveExecutable(string dir, string? exe, string name)
    {
        if (!string.IsNullOrWhiteSpace(exe))
        {
            try
            {
                var candidate = Path.IsPathRooted(exe) ? exe : Path.Combine(dir, exe.Replace('/', '\\'));
                if (File.Exists(candidate)) return Path.GetFullPath(candidate);
            }
            catch { }
        }
        return GameScanner.FindMainExecutable(dir, name);
    }

    private static IEnumerable<string> SteamLibraryFolders(string steamRoot)
    {
        var folders = new List<string> { steamRoot };
        try
        {
            var vdf = Path.Combine(steamRoot, "steamapps", "libraryfolders.vdf");
            if (File.Exists(vdf))
            {
                foreach (System.Text.RegularExpressions.Match match in
                         System.Text.RegularExpressions.Regex.Matches(File.ReadAllText(vdf), "\"path\"\\s+\"([^\"]+)\""))
                {
                    var path = match.Groups[1].Value.Replace(@"\\", @"\");
                    if (Directory.Exists(path) && !folders.Contains(path, StringComparer.OrdinalIgnoreCase))
                        folders.Add(path);
                }
            }
        }
        catch { }
        return folders;
    }

    private static int SubKeyCount(string path)
    {
        var total = 0;
        foreach (var hive in new[] { RegistryHive.LocalMachine, RegistryHive.CurrentUser })
        {
            foreach (var view in new[] { RegistryView.Registry64, RegistryView.Registry32 })
            {
                using var key = OpenSubKey(hive, view, path);
                if (key == null) continue;
                try
                {
                    total += key.GetSubKeyNames().Length;
                }
                catch { }
            }
        }
        return total;
    }

    private static RegistryKey? OpenSubKey(RegistryHive hive, RegistryView view, string path)
    {
        try
        {
            using var baseKey = RegistryKey.OpenBaseKey(hive, view);
            return baseKey.OpenSubKey(path);
        }
        catch
        {
            return null;
        }
    }
}
