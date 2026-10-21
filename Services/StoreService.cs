using System.Globalization;
using System.IO;
using System.Text.Json;
using NovaGameSpace.Models;

namespace NovaGameSpace.Services;

public static class AppPaths
{
    /// <summary>Data root. NOVA_DATA_ROOT lets the packaging pipeline and the
    /// screenshot tools run against a throwaway profile, so a test run can
    /// never touch the player's real library (see docs/HANDOFF-NEXT.md §7b).</summary>
    public static string Root { get; } = ResolveRoot();

    private static string ResolveRoot()
    {
        var over = Environment.GetEnvironmentVariable("NOVA_DATA_ROOT");
        if (!string.IsNullOrWhiteSpace(over))
        {
            try
            {
                return Path.GetFullPath(over.Trim().Trim('"'));
            }
            catch
            {
                // A malformed override must never stop the app from starting.
            }
        }
        return Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "NOVA Game Space");
    }

    public static string Media { get; } = Path.Combine(Root, "media");
    public static string Themes { get; } = Path.Combine(Root, "themes");
    public static string Backups { get; } = Path.Combine(Root, "backups");
    public static string LibraryFile { get; } = Path.Combine(Root, "library.json");
    public static string LogFile { get; } = Path.Combine(Root, "nova.log");
    public static string WebRoot { get; set; } = Path.Combine(AppContext.BaseDirectory, "src");
    public static string BundledThemes { get; set; } = Path.Combine(AppContext.BaseDirectory, "themes");

    public static void Ensure()
    {
        Directory.CreateDirectory(Root);
        Directory.CreateDirectory(Media);
        Directory.CreateDirectory(Themes);
        Directory.CreateDirectory(Backups);
    }
}

public static class Log
{
    private static readonly object Gate = new();

    public static void Write(string message)
    {
        try
        {
            lock (Gate)
            {
                File.AppendAllText(AppPaths.LogFile,
                    $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {message}{Environment.NewLine}");
            }
        }
        catch
        {
            // Logging must never take the app down.
        }
    }

    public static void Error(string context, Exception ex) => Write($"ERROR {context}: {ex}");
}

public sealed class StoreService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    private readonly object _gate = new();
    private LibraryFile _library = new();

    public LibraryFile Library => _library;

    /// <summary>NOVA_DEV=1 (or true) forces developer mode; otherwise the
    /// persisted setting decides. Test entries stay on disk either way.</summary>
    public bool DeveloperMode
    {
        get
        {
            var env = Environment.GetEnvironmentVariable("NOVA_DEV");
            if (env == "1" || string.Equals(env, "true", StringComparison.OrdinalIgnoreCase)) return true;
            return _library.Settings.DeveloperMode;
        }
    }

    public void Load()
    {
        lock (_gate)
        {
            try
            {
                if (File.Exists(AppPaths.LibraryFile))
                {
                    var json = File.ReadAllText(AppPaths.LibraryFile);
                    var loaded = JsonSerializer.Deserialize<LibraryFile>(json, JsonOptions);
                    if (loaded != null)
                    {
                        _library = loaded;
                        _library.Games ??= new List<GameEntry>();
                        _library.Settings ??= new PlayerSettings();
                        Normalize(_library);
                    }
                }
            }
            catch (Exception ex)
            {
                Log.Error("load library", ex);
                TryBackupBrokenFile();
                _library = new LibraryFile();
            }
        }
    }

    /// <summary>Repairs duplicate display names left by older imports.</summary>
    private static void Normalize(LibraryFile library)
    {
        foreach (var game in library.Games)
        {
            if (!string.IsNullOrWhiteSpace(game.Zh) &&
                string.Equals(game.Zh.Trim(), (game.Name ?? "").Trim(), StringComparison.OrdinalIgnoreCase))
            {
                game.Zh = "";
            }
            game.Colors ??= new List<string>();
            game.Dna ??= new Models.CoverDna();
            game.Sessions ??= new List<PlaySession>();
            if (game.Sessions.Count > 200)
                game.Sessions.RemoveRange(0, game.Sessions.Count - 200);

            if (!game.DeveloperOnly && IsDeveloperTestEntry(game))
                game.DeveloperOnly = true;

            // Early Steam imports wrote the install folder into the blurb,
            // which read poorly on the hero. Drop that generated sentence.
            if (game.Source == "steam" &&
                !string.IsNullOrEmpty(game.Description) &&
                game.Description.StartsWith("从本机 Steam 库导入：", StringComparison.Ordinal))
            {
                game.Description = "";
                if (game.Tagline == "来自 Steam 游戏库") game.Tagline = "";
            }
        }
    }

    public void Save()
    {
        lock (_gate)
        {
            try
            {
                var json = JsonSerializer.Serialize(_library, JsonOptions);
                var temp = AppPaths.LibraryFile + ".tmp";
                File.WriteAllText(temp, json);
                if (File.Exists(AppPaths.LibraryFile)) File.Replace(temp, AppPaths.LibraryFile, null);
                else File.Move(temp, AppPaths.LibraryFile);
            }
            catch (Exception ex)
            {
                Log.Error("save library", ex);
            }
        }
    }

    public GameEntry? Find(string id) => _library.Games.FirstOrDefault(g => g.Id == id);

    /// <summary>
    /// Merges Steam's own recorded playtime into Steam-owned entries.
    ///
    /// Steam and the launcher count the same session independently, so the
    /// larger value wins instead of adding them (adding would double every
    /// Steam launch). Non-Steam entries are never touched: Steam has no
    /// numbers for them and a stale zero must not erase local playtime.
    /// Returns the entries that actually changed.
    /// </summary>
    public List<GameEntry> SyncSteamPlaytime()
    {
        var snapshots = SteamPlaytime.Read();
        var changed = new List<GameEntry>();
        if (snapshots.Count == 0) return changed;

        lock (_gate)
        {
            foreach (var game in _library.Games)
            {
                if (!string.Equals(game.Source, "steam", StringComparison.OrdinalIgnoreCase)) continue;
                if (string.IsNullOrWhiteSpace(game.SteamAppId)) continue;
                if (!snapshots.TryGetValue(game.SteamAppId!, out var snapshot)) continue;

                var dirty = false;
                if (snapshot.Seconds > game.PlaytimeSeconds)
                {
                    // Steam only knows the total; keep the launcher's session
                    // history and simply raise the accumulated number.
                    game.PlaytimeSeconds = snapshot.Seconds;
                    dirty = true;
                }
                if (snapshot.LastPlayedUtc is DateTime steamLast)
                {
                    var localLast = DateTime.TryParse(game.LastPlayedUtc, CultureInfo.InvariantCulture,
                        DateTimeStyles.RoundtripKind, out var parsed)
                        ? parsed.ToUniversalTime()
                        : (DateTime?)null;
                    if (localLast == null || localLast.Value < steamLast)
                    {
                        game.LastPlayedUtc = steamLast.ToString("o");
                        dirty = true;
                    }
                }
                if (!dirty) continue;
                changed.Add(game);
            }
            if (changed.Count > 0) Save();
        }
        return changed;
    }

    /// <summary>
    /// The display name follows the Windows account until the player types
    /// their own. Older builds shipped "Yuki" / "玩家" as the default; those
    /// are treated as untouched defaults and replaced once with the OS user.
    /// </summary>
    public bool EnsurePlayerIdentity()
    {
        var settings = _library.Settings;
        if (settings.PlayerNameCustom) return false;
        var user = Environment.UserName?.Trim();
        if (string.IsNullOrWhiteSpace(user)) return false;
        if (!string.IsNullOrWhiteSpace(settings.Playername) &&
            settings.Playername != "Yuki" && settings.Playername != "玩家") return false;
        settings.Playername = user;
        Save();
        return true;
    }

    public LauncherStats BuildStats(bool includeDeveloper = false)
    {
        var now = DateTimeOffset.Now;
        var today = new DateTimeOffset(now.Year, now.Month, now.Day, 0, 0, 0, now.Offset);
        var weekStart = today.AddDays(-6);

        var sessions = new List<(DateTimeOffset Ended, SessionInfo Info)>();
        long todaySeconds = 0;
        long weekSeconds = 0;

        var visibleGames = _library.Games
            .Where(game => includeDeveloper || !game.DeveloperOnly)
            .ToList();

        foreach (var game in visibleGames)
        {
            foreach (var session in game.Sessions ?? Enumerable.Empty<PlaySession>())
            {
                var ended = ParseSessionTime(session.EndedUtc);
                if (ended == null) continue;
                var local = ended.Value.ToLocalTime();
                if (local >= today) todaySeconds += Math.Max(0, session.Seconds);
                if (local >= weekStart) weekSeconds += Math.Max(0, session.Seconds);
                sessions.Add((ended.Value, new SessionInfo(
                    game.Id,
                    string.IsNullOrWhiteSpace(game.Zh) ? game.Name : game.Zh,
                    session.StartedUtc,
                    session.EndedUtc,
                    Math.Max(0, session.Seconds),
                    session.Crashed)));
            }
        }

        var top = visibleGames.OrderByDescending(g => g.PlaytimeSeconds).FirstOrDefault();
        var missing = visibleGames.Count(g =>
            string.IsNullOrWhiteSpace(g.ExePath) || !File.Exists(g.ExePath));

        return new LauncherStats(
            visibleGames.Sum(g => Math.Max(0, g.PlaytimeSeconds)),
            visibleGames.Sum(g => Math.Max(0, g.LaunchCount)),
            sessions.Count,
            todaySeconds,
            weekSeconds,
            missing,
            top != null && top.PlaytimeSeconds > 0 ? (string.IsNullOrWhiteSpace(top.Zh) ? top.Name : top.Zh) : null,
            top?.PlaytimeSeconds ?? 0,
            sessions.OrderByDescending(s => s.Ended).Take(20).Select(s => s.Info).ToArray());
    }

    public StorageInfo BuildStorage()
    {
        long mediaBytes = 0;
        var mediaFiles = 0;
        try
        {
            foreach (var file in Directory.EnumerateFiles(AppPaths.Media, "*", SearchOption.AllDirectories))
            {
                try
                {
                    mediaBytes += new FileInfo(file).Length;
                    mediaFiles += 1;
                }
                catch { }
            }
        }
        catch (Exception ex)
        {
            Log.Error("storage media", ex);
        }

        long libraryBytes = 0;
        try
        {
            if (File.Exists(AppPaths.LibraryFile)) libraryBytes = new FileInfo(AppPaths.LibraryFile).Length;
        }
        catch { }

        return new StorageInfo(
            AppPaths.Root,
            AppPaths.Backups,
            BackupService.DefaultExportDirectory,
            libraryBytes,
            mediaBytes,
            mediaFiles,
            _library.Settings.LastBackupUtc);
    }

    private static bool IsDeveloperTestEntry(GameEntry game)
    {
        if (string.Equals(game.Source, "demo", StringComparison.OrdinalIgnoreCase)) return true;
        if (string.Equals(game.Source, "steam", StringComparison.OrdinalIgnoreCase)) return false;
        if (string.IsNullOrWhiteSpace(game.ExePath)) return false;
        try
        {
            var full = Path.GetFullPath(game.ExePath);
            var system = Path.GetFullPath(Environment.SystemDirectory) + Path.DirectorySeparatorChar;
            var windows = Path.GetFullPath(Environment.GetFolderPath(Environment.SpecialFolder.Windows)) + Path.DirectorySeparatorChar;
            if (full.StartsWith(system, StringComparison.OrdinalIgnoreCase)) return true;
            var system32 = Path.Combine(windows, "System32") + Path.DirectorySeparatorChar;
            return full.StartsWith(system32, StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            return false;
        }
    }

    private static DateTimeOffset? ParseSessionTime(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        return DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture,
            DateTimeStyles.RoundtripKind, out var parsed) ? parsed : null;
    }

    public GameEntry? FindBySteam(string appId) => _library.Games.FirstOrDefault(g => g.SteamAppId == appId);

    public void Add(GameEntry game)
    {
        _library.Games.Add(game);
        Save();
    }

    public void Remove(string id)
    {
        var game = Find(id);
        if (game == null) return;
        _library.Games.Remove(game);
        if (_library.CurrentGameId == id) _library.CurrentGameId = _library.Games.FirstOrDefault()?.Id;
        Save();
    }

    private static void TryBackupBrokenFile()
    {
        try
        {
            if (!File.Exists(AppPaths.LibraryFile)) return;
            var backup = AppPaths.LibraryFile + $".broken-{DateTime.Now:yyyyMMdd-HHmmss}.json";
            File.Copy(AppPaths.LibraryFile, backup, true);
        }
        catch
        {
            // ignore
        }
    }
}
