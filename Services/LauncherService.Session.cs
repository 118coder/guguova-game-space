// 会话跟踪：进程接管与退出处理、强制结束、空闲暂停计时。
// LauncherService 的 partial 领域分片之一，见 Services/LauncherService.cs 主文件。

using System.Diagnostics;
using System.IO;
using NovaGameSpace.Models;

namespace NovaGameSpace.Services;

public sealed partial class LauncherService
{
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

        process = ReopenFullRights(process);

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
            // A process protected by an anti-cheat driver refuses the handle that
            // EnableRaisingEvents needs, so Exited never fires and the session
            // would stay open forever — the clock runs, but nothing is ever
            // written. Poll the PID instead so the session still closes.
            PollForExit(game.Id, process.Id);
        }

        Log.Write($"game body attached {game.Name} pid={process.Id}");
    }

    /// <summary>Last-resort exit watch for processes we cannot get a handle on:
    /// a PID that no longer exists is the only signal such a game gives.</summary>
    private void PollForExit(string gameId, int pid)
    {
        var thread = new System.Threading.Thread(() =>
        {
            try
            {
                while (true)
                {
                    System.Threading.Thread.Sleep(2000);
                    lock (_gate)
                    {
                        if (!_sessions.ContainsKey(gameId)) return; // already closed
                    }

                    Process? probe = null;
                    try
                    {
                        probe = Process.GetProcessById(pid);
                        if (!probe.HasExited)
                        {
                            probe.Dispose();
                            continue;
                        }
                    }
                    catch
                    {
                        // GetProcessById throws once the pid is gone: that is the exit.
                    }
                    finally
                    {
                        probe?.Dispose();
                    }

                    Log.Write($"attached process gone {pid} — closing session");
                    HandleExit(gameId, null);
                    return;
                }
            }
            catch (Exception ex)
            {
                Log.Error("poll exit", ex);
            }
        })
        {
            IsBackground = true,
            Name = $"NOVA exit watch {pid}"
        };
        thread.Start();
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
            if (_pendingSteam.Remove(gameId)) { KillLauncherTree(gameId); return true; }
            if (_pendingClient.Remove(gameId)) return true;
            if (_pendingLauncher.Remove(gameId)) { KillLauncherTree(gameId); return true; }
            if (!_processes.TryGetValue(gameId, out process)) { KillLauncherTree(gameId); return false; }
        }

        // Soft close is best-effort: an elevated child's restricted handle
        // throws on HasExited/CloseMainWindow even from an elevated launcher.
        try
        {
            if (!process.HasExited && process.CloseMainWindow())
            {
                if (process.WaitForExit(6000)) return true;
            }
        }
        catch (Exception ex)
        {
            Log.Write($"stop {gameId}: soft close unavailable ({ex.Message})");
        }

        // Hard kill by PID: taskkill reaches across the elevation boundary
        // whenever this launcher is elevated, and /T takes the child tree.
        try
        {
            var pid = process.Id;
            using (var killer = Process.Start(new ProcessStartInfo("taskkill", $"/PID {pid} /T /F")
            {
                CreateNoWindow = true,
                UseShellExecute = false
            }))
            {
                killer?.WaitForExit(4000);
            }
            try
            {
                if (process.WaitForExit(2000)) return true;
            }
            catch
            {
                // The restricted handle cannot answer exit queries; taskkill
                // with /F is terminal, so treat the job as done.
                return true;
            }
            return true;
        }
        catch (Exception ex)
        {
            Log.Error($"stop {gameId}: taskkill failed", ex);
        }

        try
        {
#if NETFRAMEWORK
            process.Kill();
#else
            process.Kill(true);
#endif
            return true;
        }
        catch (Exception ex)
        {
            Log.Error($"stop {gameId}: kill failed", ex);
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

    private void HandleExit(string gameId, Process? process)
    {
        RunningSessionInfo info;
        DateTime started;
        lock (_gate)
        {
            if (!_sessions.TryGetValue(gameId, out info!)) return;
            // A null process comes from the PID poll (protected games); the
            // session id already identifies the run, so the pid check is only
            // meaningful when we actually have the process.
            if (!_processes.TryGetValue(gameId, out var tracked)) return;
            if (process != null && tracked.Id != process.Id) return;
            _sessions.Remove(gameId);
            _processes.Remove(gameId);
            if (!_sessionStarts.TryGetValue(gameId, out started)) started = DateTime.UtcNow;
            _sessionStarts.Remove(gameId);
        }

        // The separated launcher's tree (cmd, bundled server, patcher) goes
        // down with the game body.
        KillLauncherTree(gameId);

        var seconds = EffectiveSeconds(gameId, started);
        var crashed = false;
        if (process != null)
        {
            try
            {
                // Many launchers exit non-zero on a normal shutdown, so only a
                // non-zero code combined with a very short run counts as a crash.
                crashed = process.ExitCode != 0 && seconds < 20;
            }
            catch
            {
                // exit code unavailable (protected process, or pid already gone)
            }
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
}
