using System.Diagnostics;
using System.IO;
using NovaGameSpace.Models;

namespace NovaGameSpace.Services;

/// <summary>
/// Launches real executables, keeps a live session per game, detects crashes vs.
/// normal exits, and adds elapsed wall-clock time to the game's playtime.
/// </summary>
public sealed class LauncherService
{
    private readonly StoreService _store;
    private readonly Dictionary<string, Process> _processes = new();
    private readonly Dictionary<string, RunningSessionInfo> _sessions = new();
    private readonly Dictionary<string, DateTime> _sessionStarts = new();
    private readonly object _gate = new();

    public event Action<RunningSessionInfo>? GameStarted;
    public event Action<RunningSessionInfo, bool, long>? GameExited; // info, crashed, seconds

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

    public LaunchResult Launch(GameEntry game)
    {
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
                return new LaunchResult(false, "系统没有返回进程信息，启动失败", null, game.Id);

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
            Log.Error($"launch {game.Name}", ex);
            return new LaunchResult(false, ex.Message, null, game.Id);
        }
    }

    public bool Stop(string gameId)
    {
        Process? process;
        lock (_gate)
        {
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
                process.Kill(true);
                return true;
            }
        }
        catch (Exception ex)
        {
            Log.Error($"stop {gameId}", ex);
        }
        return false;
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

        var seconds = (long)Math.Max(0, (DateTime.UtcNow - started).TotalSeconds);
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
