// 启动入口：直接启动、Steam 启动、平台客户端启动与丢失可执行文件找回。
// LauncherService 的 partial 领域分片之一，见 Services/LauncherService.cs 主文件。

using System.Diagnostics;
using System.IO;
using NovaGameSpace.Models;

namespace NovaGameSpace.Services;

public sealed partial class LauncherService
{
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

        // --- separated launcher -------------------------------------------------
        // Some games only start through their own launcher (login, patcher,
        // anti-cheat). ExePath stays the game body; LauncherPath is the exe we
        // actually start. Once the body process shows up it becomes the tracked
        // session, so scaling (Magpie) and playtime act on the game, not on
        // the launcher window.
        if (!string.IsNullOrWhiteSpace(game.LauncherPath))
        {
            if (!File.Exists(game.LauncherPath))
            {
                lock (_gate) _launchOptions.Remove(game.Id);
                return new LaunchResult(false, $"找不到游戏启动器：{game.LauncherPath}", null, game.Id);
            }

            // The body may already be running from a session we do not track
            // (launcher or app restart): take it over instead of starting the
            // launcher a second time.
            var running = FindBodyProcess(game, new HashSet<int>(), DateTime.UtcNow - TimeSpan.FromHours(1));
            if (running != null)
            {
                AttachProcess(game, running);
                Log.Write($"launcher body takeover {game.Name} pid={running.Id}");
                return new LaunchResult(true, null, null, game.Id, true, "游戏本体已在运行，已接管计时与缩放。");
            }

            lock (_gate)
            {
                if (_pendingLauncher.Contains(game.Id))
                    return new LaunchResult(false, "正在等待游戏本体进程…", null, game.Id);
                _pendingLauncher.Add(game.Id);
            }

            game.LastPlayedUtc = DateTime.UtcNow.ToString("o");
            game.LaunchCount += 1;
            _store.Save();

            var launcherDir = Path.GetDirectoryName(game.LauncherPath) ?? "";
            var scope = new LauncherTreeScope
            {
                Root = launcherDir,
                Preexisting = new HashSet<int>(ProcessIdsUnder(launcherDir))
            };
            lock (_gate) _launcherTreeScopes[game.Id] = scope;

            try
            {
                var launcherStart = new ProcessStartInfo
                {
                    FileName = game.LauncherPath,
                    WorkingDirectory = launcherDir,
                    UseShellExecute = true
                };
                using var launcherProcess = Process.Start(launcherStart);
                if (launcherProcess != null)
                {
                    lock (_gate) _launcherTreePids[game.Id] = launcherProcess.Id;
                }
            }
            catch (Exception ex)
            {
                lock (_gate)
                {
                    _pendingLauncher.Remove(game.Id);
                    _launchOptions.Remove(game.Id);
                    _launcherTreeScopes.Remove(game.Id);
                }
                Log.Error($"launch via launcher {game.Name}", ex);
                return new LaunchResult(false, "无法启动游戏启动器：" + ex.Message, null, game.Id);
            }

            WatchLauncherBody(game);
            Log.Write($"launched via launcher {game.Name} launcher={game.LauncherPath}");
            return new LaunchResult(true, null, null, game.Id, true, "已启动游戏启动器，等待游戏本体进程…");
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

            process = ReopenFullRights(process);

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
