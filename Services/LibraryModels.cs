using System.Text.Json.Serialization;

namespace NovaGameSpace.Models;

/// <summary>A single game entry, persisted in library.json.</summary>
public sealed class GameEntry
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Name { get; set; } = "";
    public string Zh { get; set; } = "";
    public string Tagline { get; set; } = "";
    public string Description { get; set; } = "";
    public string Genre { get; set; } = "";
    public string AgeRating { get; set; } = "全年龄";
    public string Mode { get; set; } = "单人";
    public string ExePath { get; set; } = "";
    public string Args { get; set; } = "";
    public string WorkDir { get; set; } = "";
    public string HeroPath { get; set; } = "";
    public string CoverPath { get; set; } = "";
    public string HeroPosition { get; set; } = "50% 45%";
    public double HeroZoom { get; set; } = 1;
    public string CoverPosition { get; set; } = "50% 45%";
    public string Accent { get; set; } = "#ffb45e";
    public string Accent2 { get; set; } = "#ff6b79";
    public string Glow { get; set; } = "rgba(255, 172, 96, .32)";
    public string Scrim { get; set; } = "20, 11, 9";
    public List<string> Colors { get; set; } = new() { "#ffb45e", "#ff6b79", "#f3e3c3", "#251318" };
    public bool Favorite { get; set; }
    public bool AutoUpdate { get; set; } = true;

    /// <summary>Test/demo entries (notepad, calc, powershell …). Hidden unless
    /// NOVA_DEV=1 or the developer-mode setting is on.</summary>
    public bool DeveloperOnly { get; set; }
    public long PlaytimeSeconds { get; set; }
    public string? LastPlayedUtc { get; set; }
    public string AddedUtc { get; set; } = DateTime.UtcNow.ToString("o");
    public string Source { get; set; } = "manual"; // manual | steam | demo
    public string? SteamAppId { get; set; }

    /// <summary>"auto" (default), "steam" or "direct". A Steam-owned entry goes
    /// through the client so the ownership check and overlay still apply;
    /// "direct" is the escape hatch for games that start fine on their own.</summary>
    public string LaunchMode { get; set; } = "auto";

    /// <summary>Per-game borderless fullscreen / upscale preference.
    /// Null follows the launcher: on in immersive (fullscreen) mode, off in a
    /// windowed session. A real value is the player's explicit choice.</summary>
    public bool? FullscreenScale { get; set; }

    public int LaunchCount { get; set; }
    public string? CustomLogo { get; set; }

    /// <summary>Optional title recipe override ("gilded", "poster", …).
    /// Empty means the cover director chooses automatically.</summary>
    public string TypeRecipe { get; set; } = "";

    /// <summary>Recent play sessions, newest last. Capped at 200 per game.</summary>
    public List<PlaySession> Sessions { get; set; } = new();

    public CoverDna Dna { get; set; } = new();
}

/// <summary>One real launch-to-exit interval. Persisted so play history
/// survives restarts and can travel inside an exported data pack.</summary>
public sealed class PlaySession
{
    public string StartedUtc { get; set; } = "";
    public string EndedUtc { get; set; } = "";
    public long Seconds { get; set; }
    public bool Crashed { get; set; }
}

/// <summary>Fingerprint sampled from the cover, used by the title director.</summary>
public sealed class CoverDna
{
    public double Luma { get; set; } = .3;
    public double Sat { get; set; } = .5;
    public double Warmth { get; set; } = .5;
    public double Edge { get; set; } = .1;
}

public sealed class LibraryFile
{
    public int Schema { get; set; } = 1;
    public List<GameEntry> Games { get; set; } = new();
    public string? CurrentGameId { get; set; }
    public PlayerSettings Settings { get; set; } = new();
}

public sealed class PlayerSettings
{
    public string Playername { get; set; } = "Yuki";
    /// <summary>False means the display name follows the Windows account.</summary>
    public bool PlayerNameCustom { get; set; }
    /// <summary>Relative path under the media folder, e.g. avatar/avatar.png.</summary>
    public string? AvatarFile { get; set; }
    public bool Sound { get; set; } = true;

    /// <summary>True keeps the single shared cue set for every theme; false lets
    /// each theme play its own sounds. Off by default: the themed sets are the
    /// point of the feature, and the switch is the way back to consistency.</summary>
    public bool UnifiedSfx { get; set; }

    public bool ReduceMotion { get; set; }
    public bool Calm { get; set; }
    public string Layout { get; set; } = "row";
    public string Theme { get; set; } = "nova";
    public string StyleMode { get; set; } = "adaptive";
    public int TypeSeed { get; set; }
    public bool FirstRunDone { get; set; }
    public bool CloseToTray { get; set; }
    public bool AutoBackup { get; set; } = true;
    public bool DeveloperMode { get; set; }
    public string? LastBackupUtc { get; set; }
    public string LibrarySort { get; set; } = "recent";
    /// <summary>auto | full | balanced | safe. Auto is the recommended default.</summary>
    public string CompatibilityTier { get; set; } = "auto";

    /// <summary>Hide the launcher when a game process is attached, then bring
    /// it back on exit. On by default: the game window, not the overlay, should
    /// be what the player sees after a launch.</summary>
    public bool MinimizeOnLaunch { get; set; } = true;

    /// <summary>"auto" (Magpie when it is already running, otherwise native
    /// borderless), "native" (borderless stretch only) or "off".</summary>
    public string ScalingEngine { get; set; } = "auto";

    /// <summary>Optional Magpie.exe override for portable copies that live
    /// outside the usual install locations.</summary>
    public string? MagpiePath { get; set; }

    /// <summary>Global scaling hotkey in Magpie's packed form:
    /// key | win&lt;&lt;8 | ctrl&lt;&lt;9 | alt&lt;&lt;10 | shift&lt;&lt;11.
    /// Default 3137 = Alt+Shift+A, which is also Magpie's own default.</summary>
    public int ScalingHotkey { get; set; } = 3137;

    /// <summary>When the app is started by Windows, open straight into the
    /// borderless immersive shell instead of the windowed one.</summary>
    public bool StartupFullscreen { get; set; }

    /// <summary>Start the bundled scaling engine when a launch asks for
    /// fullscreen scaling. Off by default: the player opts in from the scaling
    /// sheet, and a game's switch alone never starts an engine in the background.</summary>
    public bool AutoStartEngine { get; set; }
}

/// <summary>Payload returned to the UI after a launch is started. <c>Pending</c>
/// means the Steam client was asked to start the game and the session will
/// appear later, so the UI waits for session-started instead of assuming the
/// process exists already.</summary>
public sealed record LaunchResult(
    bool Ok,
    string? Error,
    string? SessionId,
    string? GameId,
    bool Pending = false,
    string? Hint = null);

public sealed record RunningSessionInfo(
    string SessionId,
    string GameId,
    string GameName,
    string ExePath,
    int ProcessId,
    string StartedUtc);

public sealed record GamePayload(
    string Id,
    string Name,
    string Zh,
    string Logo,
    string Tagline,
    string Description,
    string[] Genres,
    string AgeRating,
    string Mode,
    string HeroUrl,
    string CoverUrl,
    string HeroPosition,
    double HeroZoom,
    string CoverPosition,
    string Accent,
    string Accent2,
    string Glow,
    string Scrim,
    string[] Colors,
    bool Favorite,
    bool AutoUpdate,
    long PlaytimeSeconds,
    string? LastPlayedUtc,
    string AddedUtc,
    string Source,
    string? SteamAppId,
    int LaunchCount,
    bool Exists,
    bool Running,
    string ExePath,
    string Args,
    string WorkDir,
    bool CustomLogo,
    string TypeRecipe,
    CoverDna Dna,
    string LaunchMode,
    string LaunchModeResolved,
    bool SteamRunning,
    bool SteamSignedIn,
    string SteamNote,
    bool? FullscreenScale);

public sealed record SteamCandidate(
    string AppId,
    string Name,
    string InstallDir,
    string ExePath,
    string? HeroPath,
    string? CoverPath);

public sealed record SessionInfo(
    string GameId,
    string GameName,
    string StartedUtc,
    string EndedUtc,
    long Seconds,
    bool Crashed);

public sealed record LauncherStats(
    long TotalSeconds,
    int TotalLaunches,
    int SessionCount,
    long TodaySeconds,
    long WeekSeconds,
    int MissingCount,
    string? TopGameName,
    long TopGameSeconds,
    SessionInfo[] Recent);

public sealed record StorageInfo(
    string Root,
    string Backups,
    string Exports,
    long LibraryBytes,
    long MediaBytes,
    int MediaFiles,
    string? LastBackupUtc);

[JsonSerializable(typeof(LibraryFile))]
[JsonSerializable(typeof(GameEntry))]
[JsonSerializable(typeof(PlaySession))]
[JsonSerializable(typeof(PlayerSettings))]
[JsonSerializable(typeof(LaunchResult))]
[JsonSerializable(typeof(GamePayload))]
[JsonSerializable(typeof(SteamCandidate))]
[JsonSerializable(typeof(RunningSessionInfo))]
[JsonSerializable(typeof(List<SteamCandidate>))]
internal partial class StoreJsonContext : JsonSerializerContext { }
