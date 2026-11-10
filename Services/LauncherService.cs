using System.Diagnostics;
using System.IO;
using NovaGameSpace.Models;

namespace NovaGameSpace.Services;

// 其余成员按领域拆分为同目录的 LauncherService.*.cs partial 分片文件（Launch / Process / Session）。

/// <summary>Per-launch display preferences resolved by the host: the game's
/// explicit checkbox, or the immersive (fullscreen) default when unset.
/// <c>ScaleExplicit</c> says the PLAYER asked for scaling (the checkbox or a
/// per-game value), not just the shell default — an explicit request is also
/// permission to start the scaling engine.</summary>
public sealed record LaunchOptions(bool FullscreenScale, bool ScaleExplicit = false);

/// <summary>
/// Launches real executables, keeps a live session per game, detects crashes vs.
/// normal exits, and adds elapsed wall-clock time to the game's playtime.
/// </summary>
public sealed partial class LauncherService
{
    private readonly StoreService _store;

    private readonly Dictionary<string, Process> _processes = new();
    private readonly Dictionary<string, RunningSessionInfo> _sessions = new();
    private readonly Dictionary<string, DateTime> _sessionStarts = new();
    private readonly Dictionary<string, LaunchOptions> _launchOptions = new();
    private readonly HashSet<string> _pendingSteam = new();
    /// <summary>Entries whose client has been asked to start the game but
    /// whose process has not appeared yet (Epic, Ubisoft, Xbox, Battle.net).</summary>
    private readonly HashSet<string> _pendingClient = new();
    /// <summary>Entries whose own launcher exe was started but whose game body
    /// process has not appeared yet (separated launcher, see LauncherPath).</summary>
    private readonly HashSet<string> _pendingLauncher = new();
    /// <summary>The launcher process behind a separated-launcher session. When
    /// the game body exits, its tree goes too — a one-click .bat that starts a
    /// bundled game server would otherwise keep the server running (holding
    /// its ports) and break every later launch.</summary>
    private readonly Dictionary<string, int> _launcherTreePids = new();
    /// <summary>The launcher's folder plus the PIDs that already lived there
    /// before this session. `taskkill /T` needs a live parent chain: a .bat
    /// that used `start` leaves its server orphaned as soon as cmd exits, so
    /// the exit path also sweeps only the NEW processes under that folder.</summary>
    private readonly Dictionary<string, LauncherTreeScope> _launcherTreeScopes = new();

    private sealed class LauncherTreeScope
    {
        public string Root = "";
        public HashSet<int> Preexisting = new();
    }

    // --- idle pause: wall-clock time with the game parked over lunch used to
    // count in full. While a session runs, a watchdog samples the last input
    // time; the paused stretch is subtracted when the session settles.
    private readonly Dictionary<string, DateTime> _idleSince = new();
    private readonly Dictionary<string, long> _pausedSeconds = new();
    private System.Threading.Timer? _idleTimer;
    private readonly object _gate = new();

    public event Action<RunningSessionInfo>? GameStarted;
    public event Action<RunningSessionInfo, bool, long>? GameExited; // info, crashed, seconds

    /// <summary>The client took the request but no game process showed up.
    /// Distinct from a launch error because the reason is usually "still
    /// logging in" rather than a wrong path.</summary>
    public event Action<string, string>? GameFailed;

    public LauncherService(StoreService store) => _store = store;

    public IReadOnlyList<RunningSessionInfo> Running
    {
        get
        {
            lock (_gate) return _sessions.Values.ToList();
        }
    }

    public bool IsRunning(string gameId)
    {
        lock (_gate) return _sessions.ContainsKey(gameId);
    }
}
