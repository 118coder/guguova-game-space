using System.Diagnostics;
using System.IO;
using NovaGameSpace.Models;

namespace NovaGameSpace.Services;

/// <summary>Per-launch display preferences resolved by the host: the game's
/// explicit checkbox, or the immersive (fullscreen) default when unset.</summary>
public sealed record LaunchOptions(bool FullscreenScale);

/// <summary>
/// Launches real executables, keeps a live session per game, detects crashes vs.
/// normal exits, and adds elapsed wall-clock time to the game's playtime.
/// </summary>
public sealed class LauncherService
{
    private readonly StoreService _store;

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern bool GetLastInputInfo(ref LASTINPUTINFO info);

    [System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential)]
    private struct LASTINPUTINFO
    {
        public uint cbSize;
        public uint dwTime;
    }

    /// <summary>Milliseconds since the last keyboard/mouse input, system-wide.
    /// Unsigned subtraction survives the 49-day TickCount wraparound.</summary>
    private static double IdleMilliseconds()
    {
        var info = new LASTINPUTINFO { cbSize = (uint)System.Runtime.InteropServices.Marshal.SizeOf<LASTINPUTINFO>() };
        if (!GetLastInputInfo(ref info)) return 0;
        var idle = (uint)Environment.TickCount - info.dwTime;
        return idle;
    }
    private readonly Dictionary<string, Process> _processes = new();
    private readonly Dictionary<string, RunningSessionInfo> _sessions = new();
    private readonly Dictionary<string, DateTime> _sessionStarts = new();
    private readonly Dictionary<string, LaunchOptions> _launchOptions = new();
    private readonly HashSet<string> _pendingSteam = new();
    /// <summary>Entries whose client has been asked to start the game but
    /// whose process has not appeared yet (Epic, Ubisoft, Xbox, Battle.net).</summary>
    private readonly HashSet<string> _pendingClient = new();

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

    public LaunchResult Launch(GameEntry game, LaunchOptions? options = null)
    {
        EnsureIdleTimer();
        var mode = GameLaunch.ModeFor(game);
        var resolved = options ?? new LaunchOptions(false);

        if (mode == GameLaunch.Steam)
        {
            lock (_gate) _launchOptions[game.Id] = resolved;
            return LaunchThroughSteam(game);
        }

        if (mode == GameLaunch.Platform)
        {
            lock (_gate) _launchOptions[game.Id] = resolved;
            return LaunchThroughClient(game);
        }

        if (string.IsNullOrWhiteSpace(game.ExePath))
            return new LaunchResult(false, "没有设置可执行文件路径", null, game.Id);

        if (!File.Exists(game.ExePath))
        {
            var moved = TryFindExecutable(game);
            if (moved == null)
                return new LaunchResult(false, $"找不到游戏程序：{game.ExePath}", null, game.Id);
            game.ExePath = moved;
            _store.Save();
        }

        lock (_gate)
        {
            if (_sessions.ContainsKey(game.Id))
                return new LaunchResult(false, "游戏已经在运行", _sessions[game.Id].SessionId, game.Id);
            _launchOptions[game.Id] = resolved;
        }

        try
        {
            var workDir = !string.IsNullOrWhiteSpace(game.WorkDir) && Directory.Exists(game.WorkDir)
                ? game.WorkDir
                : Path.GetDirectoryName(game.ExePath) ?? "";

            var startInfo = new ProcessStartInfo
            {
                FileName = game.ExePath,
                Arguments = game.Args ?? "",
                WorkingDirectory = workDir,
                UseShellExecute = true
            };

            var process = Process.Start(startInfo);
            if (process == null)
            {
                lock (_gate) _launchOptions.Remove(game.Id);
                return new LaunchResult(false, "系统没有返回进程信息，启动失败", null, game.Id);
            }

            var info = new RunningSessionInfo(
                Guid.NewGuid().ToString("N"),
                game.Id,
                game.Name,
                game.ExePath,
                process.Id,
                DateTime.UtcNow.ToString("o"));

            lock (_gate)
            {
                _processes[game.Id] = process;
                _sessions[game.Id] = info;
                _sessionStarts[game.Id] = DateTime.UtcNow;
            }

            // We still own the foreground; hand it to the game so its window
            // comes up in front instead of behind the launcher.
            GameDisplay.AllowForeground(process.Id);

            process.EnableRaisingEvents = true;
            process.Exited += (_, _) => HandleExit(game.Id, process);
            if (process.HasExited) HandleExit(game.Id, process);

            game.LastPlayedUtc = DateTime.UtcNow.ToString("o");
            game.LaunchCount += 1;
            _store.Save();
            GameStarted?.Invoke(info);

            Log.Write($"launched {game.Name} pid={process.Id} exe={game.ExePath}");
            return new LaunchResult(true, null, info.SessionId, game.Id);
        }
        catch (Exception ex)
        {
            lock (_gate) _launchOptions.Remove(game.Id);
            Log.Error($"launch {game.Name}", ex);
            return new LaunchResult(false, ex.Message, null, game.Id);
        }
    }

    /// <summary>
    /// Starts a Steam-owned game the way the client itself does. The browser
    /// protocol call only hands the app id over, so the game process appears a
    /// moment later — possibly after the user finishes logging in. The session
    /// is therefore recorded when the process is found, not when we asked.
    /// </summary>
    private LaunchResult LaunchThroughSteam(GameEntry game)
    {
        if (string.IsNullOrWhiteSpace(game.SteamAppId))
            return new LaunchResult(false, "Steam 启动方式需要 AppID，请改用直接启动", null, game.Id);

        lock (_gate)
        {
            if (_sessions.ContainsKey(game.Id))
                return new LaunchResult(false, "游戏已经在运行", _sessions[game.Id].SessionId, game.Id);
            if (_pendingSteam.Contains(game.Id))
                return new LaunchResult(false, "正在等待 Steam 启动这款游戏", null, game.Id);
        }

        // Refresh instead of using the boot-time cache: the client may have
        // been restarted by the privilege repair moments ago.
        var client = SteamService.Detect(true);
        if (!client.Installed)
        {
            lock (_gate) _launchOptions.Remove(game.Id);
            return new LaunchResult(false, "本机没有安装 Steam 客户端", null, game.Id, false,
                "不带 Steam 客户端时，只有本身不依赖 Steam 运行时的游戏才能直接启动。");
        }

        game.LastPlayedUtc = DateTime.UtcNow.ToString("o");
        game.LaunchCount += 1;
        _store.Save();

        lock (_gate) _pendingSteam.Add(game.Id);
        WatchSteamLaunch(game, client.Running);

        // Activating the protocol handler waits on COM and can take seconds
        // while the client cold-starts, so it must never run on the caller's
        // (UI) thread — that would freeze the launcher until Steam responds.
        var appId = game.SteamAppId!;
        var gameName = game.Name;
        var thread = new System.Threading.Thread(() =>
        {
            var request = SteamService.RunGame(appId);
            if (!request.Ok)
            {
                lock (_gate)
                {
                    _pendingSteam.Remove(game.Id);
                    _launchOptions.Remove(game.Id);
                }
                Log.Write($"steam request failed {gameName}: {request.Error}");
                GameFailed?.Invoke(game.Id, request.Error ?? "无法唤起 Steam");
            }
        })
        {
            IsBackground = true,
            Name = "NOVA steam protocol"
        };
        thread.Start();

        Log.Write($"steam launch {game.Name} appid={game.SteamAppId} clientRunning={client.Running}");
        return new LaunchResult(true, null, null, game.Id, true, client.Running
            ? "已通知 Steam 启动，等待游戏进程…"
            : "Steam 未运行，正在唤起客户端；登录完成后游戏会自动开始。");
    }

    /// <summary>
    /// Starts a game through the launcher that owns it: Epic, Ubisoft, Xbox
    /// and Battle.net all expose a protocol/package URL, and the client has to
    /// be the one that starts the exe (licence check, overlay, cloud saves).
    /// Like the Steam path, the session begins when the process appears.
    /// </summary>
    private LaunchResult LaunchThroughClient(GameEntry game)
    {
        var uri = game.LaunchUri;
        if (string.IsNullOrWhiteSpace(uri))
            return new LaunchResult(false, "这款游戏没有记录平台启动地址，请改用直接启动", null, game.Id);

        lock (_gate)
        {
            if (_sessions.ContainsKey(game.Id))
                return new LaunchResult(false, "游戏已经在运行", _sessions[game.Id].SessionId, game.Id);
            if (_pendingClient.Contains(game.Id) || _pendingSteam.Contains(game.Id))
                return new LaunchResult(false, "正在等待平台启动这款游戏", null, game.Id);
            _pendingClient.Add(game.Id);
        }

        game.LastPlayedUtc = DateTime.UtcNow.ToString("o");
        game.LaunchCount += 1;
        _store.Save();

        var label = GamePlatform.LabelFor(game.Source);
        WatchClientLaunch(game, label);

        // The protocol handler blocks on COM while the client cold-starts, so
        // it can never run on the UI thread.
        var gameId = game.Id;
        var gameName = game.Name;
        var thread = new System.Threading.Thread(() =>
        {
            var started = StartUri(uri);
            if (started.Ok) return;
            lock (_gate)
            {
                _pendingClient.Remove(gameId);
                _launchOptions.Remove(gameId);
            }
            Log.Write($"client launch failed {gameName} source={game.Source}: {started.Error}");
            GameFailed?.Invoke(gameId, started.Error ?? ("无法唤起" + label));
        })
        {
            IsBackground = true,
            Name = "NOVA client protocol"
        };
        thread.Start();

        Log.Write($"client launch {game.Name} source={game.Source} uri={uri}");
        return new LaunchResult(true, null, null, game.Id, true,
            $"已通知{label}启动，等待游戏进程…");
    }

    /// <summary>Sends a protocol URL to the shell. A packaged (Xbox) game is
    /// addressed through shell:AppsFolder, which only explorer understands.</summary>
    private static (bool Ok, string? Error) StartUri(string uri)
    {
        try
        {
            if (uri.StartsWith("shell:", StringComparison.OrdinalIgnoreCase))
            {
                var arguments = uri.IndexOf(' ') >= 0 ? "\"" + uri + "\"" : uri;
                Process.Start(new ProcessStartInfo("explorer.exe", arguments) { UseShellExecute = true });
                return (true, null);
            }

            Process.Start(new ProcessStartInfo(uri) { UseShellExecute = true });
            return (true, null);
        }
        catch (Exception ex)
        {
            Log.Error("start protocol " + uri, ex);
            return (false, "无法唤起启动地址：" + ex.Message);
        }
    }

    /// <summary>Polls for the real game process, then attaches the normal exit
    /// tracking to it. A client that needs to start and log in can take minutes,
    /// so the window is generous and the wait never blocks the UI thread.</summary>
    private void WatchClientLaunch(GameEntry game, string label)
    {
        var gameId = game.Id;
        var known = new HashSet<int>(CurrentSteamGamePids());
        var budget = TimeSpan.FromMinutes(4);

        var thread = new System.Threading.Thread(() =>
        {
            var started = DateTime.UtcNow;
            try
            {
                while (DateTime.UtcNow - started < budget)
                {
                    System.Threading.Thread.Sleep(1500);

                    lock (_gate)
                    {
                        if (!_pendingClient.Contains(gameId)) return; // stopped or superseded
                    }

                    var process = FindGameProcess(gameId, known, started);
                    if (process == null) continue;

                    lock (_gate) _pendingClient.Remove(gameId);
                    AttachProcess(game, process);
                    return;
                }

                lock (_gate)
                {
                    _pendingClient.Remove(gameId);
                    _launchOptions.Remove(gameId);
                }
                Log.Write($"client launch timeout {game.Name} source={game.Source}");
                GameFailed?.Invoke(gameId,
                    $"{label} 已经开始运行，但没有等到游戏进程。可能仍在登录或更新，请稍后重试。");
            }
            catch (Exception ex)
            {
                lock (_gate)
                {
                    _pendingClient.Remove(gameId);
                    _launchOptions.Remove(gameId);
                }
                Log.Error("watch client launch", ex);
            }
        })
        {
            IsBackground = true,
            Name = "NOVA client launch watcher"
        };
        thread.Start();
    }

    /// <summary>Polls for the real game process, then attaches the normal exit
    /// tracking to it. A client that needs to start and log in can take minutes,
    /// so the window is generous and the wait never blocks the UI thread.</summary>
    private void WatchSteamLaunch(GameEntry game, bool clientWasRunning)
    {
        var gameId = game.Id;
        var appId = game.SteamAppId!;
        var known = new HashSet<int>(CurrentSteamGamePids());
        var budget = clientWasRunning ? TimeSpan.FromMinutes(2) : TimeSpan.FromMinutes(6);

        var thread = new System.Threading.Thread(() =>
        {
            var started = DateTime.UtcNow;
            try
            {
                while (DateTime.UtcNow - started < budget)
                {
                    System.Threading.Thread.Sleep(1500);

                    lock (_gate)
                    {
                        if (!_pendingSteam.Contains(gameId)) return; // stopped or superseded
                    }

                    var process = FindGameProcess(gameId, known, started);
                    if (process == null) continue;

                    lock (_gate) _pendingSteam.Remove(gameId);
                    AttachProcess(game, process);
                    return;
                }

                lock (_gate)
                {
                    _pendingSteam.Remove(gameId);
                    _launchOptions.Remove(gameId);
                }
                var state = SteamService.Detect(true);
                Log.Write($"steam launch timeout {game.Name} appid={appId} running={state.Running} signedIn={state.SignedIn}");
                GameFailed?.Invoke(gameId, state.Running
                    ? "Steam 已经运行，但没有等到游戏进程。可能仍在登录或更新，请稍后重试。"
                    : "Steam 没有启动。如果客户端未安装或已损坏，这款游戏无法脱离 Steam 运行。");
            }
            catch (Exception ex)
            {
                lock (_gate)
                {
                    _pendingSteam.Remove(gameId);
                    _launchOptions.Remove(gameId);
                }
                Log.Error("watch steam launch", ex);
            }
        })
        {
            IsBackground = true,
            Name = "NOVA steam launch watcher"
        };
        thread.Start();
    }

    /// <summary>The best identity we have for "the process this launch
    /// produced": the recorded exe path, its file name, or — for a packaged
    /// game whose path is protected — a recently started process of that name.</summary>
    private Process? FindGameProcess(string gameId, HashSet<int> known, DateTime launchedAt)
    {
        // The exe path recorded by the scanner is the best identity we have:
        // it survives renaming and does not depend on the client's window title.
        var game = _store.Find(gameId);
        var expected = game != null && !string.IsNullOrWhiteSpace(game.ExePath)
            ? SafeFullPath(game.ExePath)
            : null;
        var expectedName = game != null && !string.IsNullOrWhiteSpace(game.ExePath)
            ? Path.GetFileName(game.ExePath)
            : null;

        foreach (var process in Process.GetProcesses())
        {
            var keep = false;
            try
            {
                if (!known.Contains(process.Id))
                {
                    string? path = null;
                    var denied = false;
                    try
                    {
                        path = process.MainModule?.FileName;
                    }
                    catch
                    {
                        // A game started by an elevated Steam client rejects
                        // MainModule from our lower integrity level.
                        denied = true;
                    }

                    if (!string.IsNullOrEmpty(path))
                    {
                        if (!Path.GetFileName(path).Contains("steam", StringComparison.OrdinalIgnoreCase))
                        {
                            var match = expected != null &&
                                string.Equals(SafeFullPath(path), expected, StringComparison.OrdinalIgnoreCase);
                            if (!match && expected == null)
                            {
                                // No recorded path (eg. the folder moved): fall back to the
                                // file name of any library entry, which is still specific.
                                match = _store.Library.Games.Any(g =>
                                    !string.IsNullOrWhiteSpace(g.ExePath) &&
                                    string.Equals(Path.GetFileName(g.ExePath), Path.GetFileName(path),
                                        StringComparison.OrdinalIgnoreCase));
                            }

                            if (match) keep = true;
                        }
                    }
                    else if (denied && expectedName != null)
                    {
                        // Name + a recent start time is still a safe identity for an
                        // elevated process; processes that already existed are in
                        // `known` or started before this launch.
                        var name = process.ProcessName + ".exe";
                        if (string.Equals(name, expectedName, StringComparison.OrdinalIgnoreCase) &&
                            StartedAfter(process, launchedAt.AddSeconds(-10)))
                        {
                            keep = true;
                        }
                    }
                }
            }
            catch
            {
                // Protected processes reject MainModule; skip them.
            }

            if (keep) return process;
            process.Dispose();
        }
        return null;
    }

    private static bool StartedAfter(Process process, DateTime threshold)
    {
        try
        {
            return process.StartTime >= threshold;
        }
        catch
        {
            return false;
        }
    }

    private static string? SafeFullPath(string path)
    {
        try
        {
            return Path.GetFullPath(path);
        }
        catch
        {
            return null;
        }
    }

    private static IEnumerable<int> CurrentSteamGamePids()
    {
        var result = new List<int>();
        try
        {
            foreach (var process in Process.GetProcesses())
            {
                try
                {
                    var path = process.MainModule?.FileName;
                    if (!string.IsNullOrEmpty(path) &&
                        Path.GetFileName(path).Contains("steam", StringComparison.OrdinalIgnoreCase))
                        result.Add(process.Id);
                }
                catch
                {
                    // ignore
                }
            }
        }
        catch
        {
            // ignore
        }
        return result;
    }

    private void AttachProcess(GameEntry game, Process process)
    {
        string path;
        try
        {
            path = process.MainModule?.FileName ?? game.ExePath;
        }
        catch
        {
            // An elevated game hides its module path; the recorded path is
            // still the right identity for the session.
            path = game.ExePath;
        }

        var info = new RunningSessionInfo(
            Guid.NewGuid().ToString("N"),
            game.Id,
            game.Name,
            path,
            process.Id,
            DateTime.UtcNow.ToString("o"));

        lock (_gate)
        {
            _processes[game.Id] = process;
            _sessions[game.Id] = info;
            _sessionStarts[game.Id] = DateTime.UtcNow;
        }

        try
        {
            process.EnableRaisingEvents = true;
            process.Exited += (_, _) => HandleExit(game.Id, process);
            if (process.HasExited) HandleExit(game.Id, process);
            else
            {
                GameDisplay.AllowForeground(process.Id);
                GameStarted?.Invoke(info);
            }
        }
        catch (Exception ex)
        {
            Log.Error("attach steam game", ex);
        }

        Log.Write($"steam game attached {game.Name} pid={process.Id}");
    }

    /// <summary>The host takes the options once, when the session starts. A
    /// later launch overwrites them, so a stale entry can never leak into the
    /// next session.</summary>
    public LaunchOptions TakeLaunchOptions(string gameId)
    {
        lock (_gate)
        {
            if (_launchOptions.TryGetValue(gameId, out var options))
            {
                _launchOptions.Remove(gameId);
                return options;
            }
            return new LaunchOptions(false);
        }
    }

    public bool Stop(string gameId)
    {
        Process? process;
        lock (_gate)
        {
            _launchOptions.Remove(gameId);
            // A pending client request has no process yet: cancelling it is
            // just dropping the watch, otherwise the button would do nothing.
            if (_pendingSteam.Remove(gameId)) return true;
            if (_pendingClient.Remove(gameId)) return true;
            if (!_processes.TryGetValue(gameId, out process)) return false;
        }
        try
        {
            if (!process.HasExited)
            {
                // Ask softly first: closing the main window lets the game save.
                if (process.CloseMainWindow())
                {
                    if (process.WaitForExit(6000)) return true;
                }
#if NETFRAMEWORK
                try
                {
                    var killer = Process.Start(new ProcessStartInfo("taskkill", $"/PID {process.Id} /T /F")
                    {
                        CreateNoWindow = true,
                        UseShellExecute = false
                    });
                    killer?.WaitForExit(4000);
                }
                catch
                {
                    try { process.Kill(); } catch { }
                }
#else
                process.Kill(true);
#endif
                return true;
            }
        }
        catch (Exception ex)
        {
            Log.Error($"stop {gameId}", ex);
        }
        return false;
    }

    /// <summary>Samples the system idle time once per running session. When
    /// the keyboard and mouse have been quiet past the threshold the session
    /// is marked idle; the stretch is subtracted when it settles. One timer
    /// covers every session because the input state is machine-wide.</summary>
    private void EnsureIdleTimer()
    {
        lock (_gate)
        {
            if (_idleTimer != null) return;
            _idleTimer = new System.Threading.Timer(_ => SampleIdle(), null, TimeSpan.FromSeconds(15), TimeSpan.FromSeconds(15));
        }
    }

    private void SampleIdle()
    {
        List<string> sessionIds;
        lock (_gate) sessionIds = _sessions.Keys.ToList();
        if (sessionIds.Count == 0) return;

        var threshold = Math.Max(0, _store.Library.Settings.IdlePauseMinutes) * 60000d;
        var idle = IdleMilliseconds();
        var now = DateTime.UtcNow;

        foreach (var gameId in sessionIds)
        {
            lock (_gate)
            {
                if (threshold <= 0)
                {
                    // The pause was switched off mid-session: credit what was
                    // parked and stop tracking.
                    // net48 has no Dictionary.Remove(key, out value) overload,
                    // so TryGetValue + Remove it is.
                    if (_idleSince.TryGetValue(gameId, out var open))
                    {
                        _idleSince.Remove(gameId);
                        _pausedSeconds[gameId] = PausedTotal(gameId) + (long)(now - open).TotalSeconds;
                    }
                    continue;
                }

                if (idle >= threshold)
                {
                    if (!_idleSince.ContainsKey(gameId))
                    {
                        _idleSince[gameId] = now;
                        Log.Write($"idle pause started {gameId} after {threshold / 60000}min");
                    }
                }
                else if (_idleSince.TryGetValue(gameId, out var since))
                {
                    _idleSince.Remove(gameId);
                    _pausedSeconds[gameId] = PausedTotal(gameId) + (long)(now - since).TotalSeconds;
                    Log.Write($"idle pause ended {gameId} (+{(long)(now - since).TotalSeconds}s paused)");
                }
            }
        }
    }

    private long PausedTotal(string gameId) =>
        _pausedSeconds.TryGetValue(gameId, out var total) ? total : 0;

    /// <summary>Wall-clock minus the stretches the player was away.</summary>
    private long EffectiveSeconds(string gameId, DateTime started)
    {
        var wall = (long)Math.Max(0, (DateTime.UtcNow - started).TotalSeconds);
        long paused = 0;
        lock (_gate)
        {
            paused = PausedTotal(gameId);
            if (_idleSince.TryGetValue(gameId, out var open))
                paused += (long)(DateTime.UtcNow - open).TotalSeconds;
            _pausedSeconds.Remove(gameId);
            _idleSince.Remove(gameId);
        }
        return Math.Max(0, wall - paused);
    }

    private void HandleExit(string gameId, Process process)
    {
        RunningSessionInfo info;
        DateTime started;
        lock (_gate)
        {
            if (!_sessions.TryGetValue(gameId, out info!)) return;
            if (!_processes.TryGetValue(gameId, out var tracked) || tracked.Id != process.Id) return;
            _sessions.Remove(gameId);
            _processes.Remove(gameId);
            if (!_sessionStarts.TryGetValue(gameId, out started)) started = DateTime.UtcNow;
            _sessionStarts.Remove(gameId);
        }

        var seconds = EffectiveSeconds(gameId, started);
        var crashed = false;
        try
        {
            // Many launchers exit non-zero on a normal shutdown, so only a
            // non-zero code combined with a very short run counts as a crash.
            crashed = process.ExitCode != 0 && seconds < 20;
        }
        catch
        {
            // exit code unavailable
        }

        var game = _store.Find(gameId);
        if (game != null && seconds > 0)
        {
            game.PlaytimeSeconds += seconds;
            game.LastPlayedUtc = DateTime.UtcNow.ToString("o");
            game.Sessions ??= new List<PlaySession>();
            game.Sessions.Add(new PlaySession
            {
                StartedUtc = started.ToUniversalTime().ToString("o"),
                EndedUtc = DateTime.UtcNow.ToString("o"),
                Seconds = seconds,
                Crashed = crashed
            });
            if (game.Sessions.Count > 200)
                game.Sessions.RemoveRange(0, game.Sessions.Count - 200);
            _store.Save();
        }

        Log.Write($"exited {game?.Name ?? gameId} after {seconds}s crashed={crashed}");
        try { GameExited?.Invoke(info, crashed, seconds); } catch { }
    }

    /// <summary>When a moved exe is detected, look for the same file name in the old folder's siblings.</summary>
    private static string? TryFindExecutable(GameEntry game)
    {
        try
        {
            var dir = Path.GetDirectoryName(game.ExePath);
            if (string.IsNullOrEmpty(dir) || !Directory.Exists(dir)) return null;
            var name = Path.GetFileName(game.ExePath);
            var found = Directory.EnumerateFiles(dir, name, SearchOption.TopDirectoryOnly).FirstOrDefault();
            return found;
        }
        catch
        {
            return null;
        }
    }
}
