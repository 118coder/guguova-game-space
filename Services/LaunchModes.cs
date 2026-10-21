using NovaGameSpace.Models;

namespace NovaGameSpace.Services;

/// <summary>
/// Resolves how a library entry starts. Kept apart from SteamService because
/// the decision is no longer Steam-specific: an Epic, Ubisoft, Xbox or
/// Battle.net entry may also need its owning client for cloud saves, an
/// ownership check or a licence, while a GOG or EA entry is just an exe.
///
/// Stored values in <see cref="GameEntry.LaunchMode"/>:
///   auto     — the client when the entry has one, otherwise the exe
///   steam    — hand the app id to Steam (legacy value, still written)
///   platform — hand the protocol URL to the owning launcher
///   direct   — always start the exe, even when a client exists
/// </summary>
public static class GameLaunch
{
    public const string Auto = "auto";
    public const string Steam = "steam";
    public const string Platform = "platform";
    public const string Direct = "direct";

    public static bool HasSteamClient(GameEntry game) =>
        game.Source == GamePlatform.Steam.Id && !string.IsNullOrWhiteSpace(game.SteamAppId);

    public static bool HasPlatformClient(GameEntry game) =>
        !string.IsNullOrWhiteSpace(game.LaunchUri);

    /// <summary>The mode a game actually uses right now.</summary>
    public static string ModeFor(GameEntry game)
    {
        var mode = (game.LaunchMode ?? "").Trim().ToLowerInvariant();
        if (mode == Direct) return Direct;
        if (mode == Steam) return HasSteamClient(game) ? Steam : Direct;
        if (mode == Platform) return HasPlatformClient(game) ? Platform : Direct;

        // auto: an entry imported from a launcher keeps using that launcher.
        if (HasSteamClient(game)) return Steam;
        if (HasPlatformClient(game)) return Platform;
        return Direct;
    }

    /// <summary>"Steam", "Ubisoft Connect", … — empty for a plain exe.</summary>
    public static string ClientLabel(GameEntry game)
    {
        var mode = ModeFor(game);
        if (mode == Steam) return GamePlatform.Steam.Label;
        if (mode == Platform) return GamePlatform.LabelFor(game.Source);
        return "";
    }

    /// <summary>True when the stored mode names a specific path, so the UI can
    /// show "自动" as unset instead of guessing.</summary>
    public static bool IsExplicit(string? mode)
    {
        var clean = (mode ?? "").Trim().ToLowerInvariant();
        return clean == Steam || clean == Platform || clean == Direct;
    }

    /// <summary>Normalises a mode coming from the UI.</summary>
    public static string Normalize(string? mode)
    {
        var clean = (mode ?? "").Trim().ToLowerInvariant();
        if (clean == Steam || clean == Platform || clean == Direct) return clean;
        return Auto;
    }
}
