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
    public string CoverPosition { get; set; } = "50% 45%";
    public string Accent { get; set; } = "#ffb45e";
    public string Accent2 { get; set; } = "#ff6b79";
    public string Glow { get; set; } = "rgba(255, 172, 96, .32)";
    public string Scrim { get; set; } = "20, 11, 9";
    public List<string> Colors { get; set; } = new() { "#ffb45e", "#ff6b79", "#f3e3c3", "#251318" };
    public bool Favorite { get; set; }
    public bool AutoUpdate { get; set; } = true;
    public long PlaytimeSeconds { get; set; }
    public string? LastPlayedUtc { get; set; }
    public string AddedUtc { get; set; } = DateTime.UtcNow.ToString("o");
    public string Source { get; set; } = "manual"; // manual | steam | demo
    public string? SteamAppId { get; set; }
    public int LaunchCount { get; set; }
    public string? CustomLogo { get; set; }

    /// <summary>Optional title recipe override ("gilded", "poster", …).
    /// Empty means the cover director chooses automatically.</summary>
    public string TypeRecipe { get; set; } = "";

    public CoverDna Dna { get; set; } = new();
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
    public bool Sound { get; set; } = true;
    public bool ReduceMotion { get; set; }
    public bool Calm { get; set; }
    public string Theme { get; set; } = "nova";
    public string StyleMode { get; set; } = "adaptive";
    public int TypeSeed { get; set; }
    public bool FirstRunDone { get; set; }
    public bool CloseToTray { get; set; }
}

/// <summary>Payload returned to the UI after a launch is started.</summary>
public sealed record LaunchResult(bool Ok, string? Error, string? SessionId, string? GameId);

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
    CoverDna Dna);

public sealed record SteamCandidate(
    string AppId,
    string Name,
    string InstallDir,
    string ExePath,
    string? HeroPath,
    string? CoverPath);

[JsonSerializable(typeof(LibraryFile))]
[JsonSerializable(typeof(GameEntry))]
[JsonSerializable(typeof(PlayerSettings))]
[JsonSerializable(typeof(LaunchResult))]
[JsonSerializable(typeof(GamePayload))]
[JsonSerializable(typeof(SteamCandidate))]
[JsonSerializable(typeof(RunningSessionInfo))]
[JsonSerializable(typeof(List<SteamCandidate>))]
internal partial class StoreJsonContext : JsonSerializerContext { }
