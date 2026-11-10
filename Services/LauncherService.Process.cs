// 进程发现与清理：等待游戏本体进程、进程身份匹配、启动器进程树清理。
// LauncherService 的 partial 领域分片之一，见 Services/LauncherService.cs 主文件。

using System.Diagnostics;
using System.IO;
using NovaGameSpace.Models;

namespace NovaGameSpace.Services;

public sealed partial class LauncherService
{
    /// <summary>Polls for the game body process after its own launcher was
    /// started. Launchers may sit on a login screen for a while, so the window
    /// is generous and the wait never blocks the UI thread. When the body
    /// shows up it is attached like any client-launched game.</summary>
    private void WatchLauncherBody(GameEntry game)
    {
        var gameId = game.Id;
        // Processes of the body exe that already exist are skipped: the watch
        // is waiting for the one THIS launcher start produces.
        var known = new HashSet<int>(BodyProcessPids(game));
        var budget = TimeSpan.FromMinutes(5);

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
                        if (!_pendingLauncher.Contains(gameId)) return; // stopped or superseded
                    }

                    var process = FindBodyProcess(game, known, started);
                    if (process == null) continue;

                    lock (_gate) _pendingLauncher.Remove(gameId);
                    AttachProcess(game, process);
                    return;
                }

                lock (_gate)
                {
                    _pendingLauncher.Remove(gameId);
                    _launchOptions.Remove(gameId);
                }
                KillLauncherTree(gameId);
                Log.Write($"launcher body timeout {game.Name} launcher={game.LauncherPath}");
                GameFailed?.Invoke(gameId,
                    "游戏启动器已运行，但没有等到游戏本体进程。可能需要在启动器中手动开始游戏，或确认“游戏程序”填的是本体 exe。");
            }
            catch (Exception ex)
            {
                lock (_gate)
                {
                    _pendingLauncher.Remove(gameId);
                    _launchOptions.Remove(gameId);
                }
                Log.Error("watch launcher body", ex);
            }
        })
        {
            IsBackground = true,
            Name = "NOVA launcher body watcher"
        };
        thread.Start();
    }

    /// <summary>PIDs of currently running processes whose exe path equals the
    /// game body path — the pre-existing set the body watch must ignore.</summary>
    private static IEnumerable<int> BodyProcessPids(GameEntry game)
    {
        var result = new List<int>();
        var expected = SafeFullPath(game.ExePath);
        if (string.IsNullOrEmpty(expected)) return result;
        foreach (var process in Process.GetProcesses())
        {
            try
            {
                var path = process.MainModule?.FileName;
                if (!string.IsNullOrEmpty(path) &&
                    string.Equals(SafeFullPath(path), expected, StringComparison.OrdinalIgnoreCase))
                    result.Add(process.Id);
            }
            catch
            {
                // Protected processes reject MainModule; skip them.
            }
            process.Dispose();
        }
        return result;
    }

    /// <summary>Finds the game body process: exact exe-path match first, and
    /// for an elevated body that hides its module path, the file name plus a
    /// fresh start time (processes that existed before the launch are in
    /// `known`).</summary>
    private Process? FindBodyProcess(GameEntry game, HashSet<int> known, DateTime launchedAt)
    {
        var expected = SafeFullPath(game.ExePath);
        var expectedName = string.IsNullOrWhiteSpace(game.ExePath) ? null : Path.GetFileName(game.ExePath);

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
                        // An elevated game rejects MainModule from a lower
                        // integrity level.
                        denied = true;
                    }

                    if (!string.IsNullOrEmpty(path) && expected != null)
                    {
                        keep = string.Equals(SafeFullPath(path), expected, StringComparison.OrdinalIgnoreCase);
                    }
                    else if (denied && expectedName != null)
                    {
                        keep = string.Equals(process.ProcessName + ".exe", expectedName, StringComparison.OrdinalIgnoreCase) &&
                            StartedAfter(process, launchedAt.AddSeconds(-10));
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

    /// <summary>Kills whatever the separated launcher left running once the
    /// game body is gone. A one-click .bat that starts a bundled game server
    /// would otherwise keep the server alive (holding its ports, answering
    /// nothing) and break every later launch — the failure that shipped this.
    /// Best-effort: a launcher that already exited on its own has nothing to
    /// kill, and an elevated survivor simply wins.</summary>
    private void KillLauncherTree(string gameId)
    {
        var pid = 0;
        LauncherTreeScope? scope = null;
        var active = new HashSet<int>();
        lock (_gate)
        {
            if (_launcherTreePids.TryGetValue(gameId, out var launcherPid))
            {
                pid = launcherPid;
                _launcherTreePids.Remove(gameId);
            }
            if (_launcherTreeScopes.TryGetValue(gameId, out var saved))
            {
                scope = saved;
                _launcherTreeScopes.Remove(gameId);
            }
            // Another session playing from the same folder must survive.
            foreach (var session in _sessions.Values) active.Add(session.ProcessId);
        }

        if (pid > 0)
        {
            try
            {
                using (var killer = Process.Start(new ProcessStartInfo("taskkill", $"/PID {pid} /T /F")
                {
                    CreateNoWindow = true,
                    UseShellExecute = false
                }))
                {
                    killer?.WaitForExit(4000);
                }
                Log.Write($"launcher tree killed {gameId} pid={pid}");
            }
            catch (Exception ex)
            {
                Log.Write($"launcher tree kill skipped {gameId} pid={pid}: {ex.Message}");
            }
        }

        // The real DNF case proved why /T alone is not enough: the .bat does
        // `start` on the server, cmd exits while the body is still loading,
        // and the server becomes an orphan whose parent PID no longer exists.
        // Sweep the launcher folder for processes that appeared during THIS
        // session only; anything that was already there is left untouched.
        if (scope == null || string.IsNullOrWhiteSpace(scope.Root)) return;
        int self;
        using (var current = Process.GetCurrentProcess()) { self = current.Id; }
        foreach (var orphan in ProcessIdsUnder(scope.Root))
        {
            if (scope.Preexisting.Contains(orphan) || orphan == pid || orphan == self ||
                active.Contains(orphan)) continue;
            try
            {
                using var process = Process.GetProcessById(orphan);
                process.Kill();
                Log.Write($"launcher orphan killed {gameId} pid={orphan}");
            }
            catch (Exception ex)
            {
                // Elevated survivors are expected to win; say so plainly.
                Log.Write($"launcher orphan kept {gameId} pid={orphan}: {ex.Message}");
            }
        }
    }

    /// <summary>PIDs whose executable lives under this folder. Protected
    /// processes hide their module path, so they are skipped on purpose.</summary>
    private static IEnumerable<int> ProcessIdsUnder(string root)
    {
        var result = new List<int>();
        if (string.IsNullOrWhiteSpace(root)) return result;

        string prefix;
        try
        {
            prefix = Path.GetFullPath(root)
                .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)
                + Path.DirectorySeparatorChar;
        }
        catch { return result; }

        foreach (var process in Process.GetProcesses())
        {
            try
            {
                var path = process.MainModule?.FileName;
                if (!string.IsNullOrEmpty(path) &&
                    Path.GetFullPath(path).StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                    result.Add(process.Id);
            }
            catch
            {
                // Protected or already-exited process: nothing we can identify.
            }
            process.Dispose();
        }
        return result;
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

    /// <summary>
    /// ShellExecute hands back a RESTRICTED handle for a child it elevated
    /// (requireAdministrator manifests): HasExited / EnableRaisingEvents /
    /// Kill all throw access-denied on that handle even when this launcher is
    /// elevated itself — the handle is the limit, not our integrity. That
    /// stalled the exit watch and made the force kill impossible. Re-opening
    /// by PID with full rights fixes both when we are elevated; a lower
    /// integrity caller keeps the limited handle and Stop reports honestly.
    /// </summary>
    private static Process ReopenFullRights(Process process)
    {
        try
        {
            var pid = process.Id;
            var reopened = Process.GetProcessById(pid);
            if (string.Equals(reopened.ProcessName, process.ProcessName, StringComparison.OrdinalIgnoreCase))
                return reopened;
        }
        catch
        {
            // The PID may already be gone (fast exit) or unreadable; the
            // original handle still covers the normal path.
        }
        return process;
    }
}
