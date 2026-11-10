// 启动与会话呈现：发起启动、呈现游戏窗口、结束进程、Steam 状态与权限修复。
// NativeBridge 的 partial 领域分片之一，见 NativeBridge.cs 主文件。

using System.Globalization;
using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Windows;
using Gdi = System.Drawing;
using WindowState = System.Windows.WindowState;
using Application = System.Windows.Application;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;
using NovaGameSpace.Models;
using NovaGameSpace.Services;

namespace NovaGameSpace;

public sealed partial class NativeBridge
{
    private object LaunchGame(JsonElement args)
    {
        var game = ResolveGame(args);
        if (game == null) return new LaunchResult(false, "找不到这款游戏", null, null);

        // The details view can pass the live checkbox state before it is
        // persisted; otherwise the per-game choice wins, and an unset choice
        // follows the immersive (fullscreen) shell.
        bool? requested = null;
        if (args.ValueKind == JsonValueKind.Object && args.TryGetProperty("fullscreenScale", out var scale) &&
            scale.ValueKind is JsonValueKind.True or JsonValueKind.False)
        {
            requested = scale.GetBoolean();
        }

        var immersive = System.Windows.Application.Current?.MainWindow is MainWindow window && window.IsFullscreen;
        var fullscreen = requested ?? game.FullscreenScale ?? immersive;
        if (string.Equals(_store.Library.Settings.ScalingEngine, "off", StringComparison.OrdinalIgnoreCase))
            fullscreen = false;

        // An explicit request (the detail checkbox or a per-game value) is
        // also the player's permission to start the scaling engine; the
        // immersive shell default is not.
        var scaleExplicit = fullscreen && (requested == true || game.FullscreenScale == true);

        return _launcher.Launch(game, new LaunchOptions(fullscreen, scaleExplicit));
    }

    /// <summary>Runs off the UI thread: the game may take many seconds to create
    /// its window, and the launcher must never wait for it.</summary>
    private void PresentGameWindow(RunningSessionInfo info, LaunchOptions options, PlayerSettings settings)
    {
        var minimize = settings.MinimizeOnLaunch;
        try
        {
            Application.Current?.Dispatcher.Invoke(() =>
            {
                if (Application.Current.MainWindow is MainWindow window) window.BeginGameSession();
            });
        }
        catch (Exception ex)
        {
            Log.Error("begin game session", ex);
        }

        var engine = settings.ScalingEngine;
        var scale = options.FullscreenScale && !string.Equals(engine, "off", StringComparison.OrdinalIgnoreCase);

        // The launcher still owns the foreground here, so the game window can
        // be brought forward as soon as it exists.
        GameDisplay.AllowForeground(info.ProcessId);

        // A window that exists is not a game that is ready: titles with a
        // loading phase either ignore the scale request or lose it the moment
        // they rebuild their swap chain. The player picks how long to wait
        // after the process is up before scaling is attempted; the delay only
        // ever applies to the scaling attempt itself, never to the other
        // launch steps.
        var scaleDelay = scale ? Math.Max(0, Math.Min(120, settings.ScaleDelaySeconds)) : 0;

        Task.Run(async () =>
        {
            try
            {
                if (scaleDelay > 0) await Task.Delay(TimeSpan.FromSeconds(scaleDelay));
                var result = GameDisplay.Present(info.ProcessId, scale, engine, settings, 15000, options.ScaleExplicit);

                // Only step aside once the hand-off had its chance. Minimizing
                // first would drop the foreground permission before the window
                // exists, which is exactly what left the game behind us.
                if (minimize)
                {
                    try
                    {
                        Application.Current?.Dispatcher.Invoke(() =>
                        {
                            if (Application.Current.MainWindow is MainWindow window) window.MinimizeForGame();
                        });
                    }
                    catch (Exception ex)
                    {
                        Log.Error("minimize for game", ex);
                    }
                }

                Notify("session-presented", new
                {
                    gameId = info.GameId,
                    gameName = info.GameName,
                    sessionId = info.SessionId,
                    requested = scale,
                    windowFound = result.WindowFound,
                    scaled = result.Scaled,
                    foreground = result.Foreground,
                    engine = result.Engine,
                    error = result.Error
                });
            }
            catch (Exception ex)
            {
                Log.Error("present game window", ex);
                Notify("session-presented", new
                {
                    gameId = info.GameId,
                    gameName = info.GameName,
                    sessionId = info.SessionId,
                    requested = scale,
                    windowFound = false,
                    scaled = false,
                    foreground = false,
                    engine = "none",
                    error = ex.Message
                });
            }
        });
    }

    /// <summary>Removes the elevation flag first (fast, synchronous), then asks
    /// the client to restart on a background thread and reports back through
    /// <c>steam-privilege</c>.</summary>
    private object FixSteamPrivilege(JsonElement args)
    {
        var restart = args.ValueKind == JsonValueKind.Object &&
                      args.TryGetProperty("restart", out var flag) && flag.ValueKind == JsonValueKind.True;

        var repair = SteamPrivilege.RemoveAdminLayer();
        if (!repair.Ok)
            return new { ok = false, error = repair.Error, removed = false };

        if (!restart)
            return new { ok = true, removed = repair.Removed, backup = repair.Backup, restarting = false };

        Task.Run(() =>
        {
            var result = SteamPrivilege.RestartClient();
            Notify("steam-privilege", new
            {
                restarted = result.Ok,
                stopped = result.Stopped,
                started = result.Started,
                message = result.Message
            });
        });

        return new { ok = true, removed = repair.Removed, backup = repair.Backup, restarting = true };
    }

    private object SteamStatus(JsonElement args)
    {
        try
        {
            var state = SteamService.Detect(true);
            var game = ResolveGame(args);
            if (game == null)
                return new { ok = true, installed = state.Installed, running = state.Running,
                    signedIn = state.SignedIn, root = state.Root };

            var dependency = SteamService.Inspect(game);
            var privilege = SteamPrivilege.Diagnose();
            return new
            {
                ok = true,
                installed = state.Installed,
                running = state.Running,
                signedIn = state.SignedIn,
                root = state.Root,
                appId = game.SteamAppId,
                launchMode = game.LaunchMode,
                launchModeResolved = GameLaunch.ModeFor(game),
                usesSteamApi = dependency.UsesSteamApi,
                steamStub = dependency.SteamStub,
                hasAppIdFile = dependency.HasAppIdFile,
                note = dependency.Note,
                adminLayer = privilege.AdminLayer,
                steamElevated = privilege.SteamElevated,
                launcherElevated = privilege.LauncherElevated,
                needsPrivilegeFix = privilege.NeedsFix,
                privilegeNote = privilege.Note,
                // A SteamStub exe cannot start without the client, and an
                // app that imports steam_api stalls at initialisation.
                requiresClient = dependency.SteamStub || dependency.UsesSteamApi
            };
        }
        catch (Exception ex)
        {
            Log.Error("steam status", ex);
            return new { ok = false, error = ex.Message };
        }
    }

    private object StopGame(JsonElement args)
    {
        var game = ResolveGame(args);
        if (game == null) return new { ok = false, error = "找不到这款游戏" };
        var ok = _launcher.Stop(game.Id);
        return ok
            ? new { ok = true }
            : new { ok = false, error = "无法结束该游戏进程（游戏以管理员权限运行时，请以管理员身份运行启动器后再试）" };
    }
}
