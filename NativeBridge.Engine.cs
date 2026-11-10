// 缩放引擎（Magpie）桥接：状态查询、启动/重启/关闭、快捷键与引擎选项。
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
    private object MagpieStatus(JsonElement args)
    {
        try
        {
            var status = ScalingEngine.Inspect(_store.Library.Settings);
            return new
            {
                ok = true,
                available = status.Available,
                exePath = status.ExePath,
                running = status.Running,
                bundled = status.Bundled,
                hotkey = status.Hotkey,
                hotkeyLabel = ScalingEngine.Label(status.Hotkey),
                supported = status.Supported,
                autoStart = _store.Library.Settings.AutoStartEngine,
                note = status.Note
            };
        }
        catch (Exception ex)
        {
            Log.Error("magpie status", ex);
            return new { ok = false, error = ex.Message };
        }
    }

    private object StartMagpie()
    {
        var settings = _store.Library.Settings;
        Task.Run(() =>
        {
            var ok = ScalingEngine.EnsureRunning(settings, true, out var status);
            Notify("magpie-status", new
            {
                ok,
                error = ok ? null : status.Note,
                running = status.Running,
                bundled = status.Bundled,
                hotkey = status.Hotkey
            });
        });
        return new { ok = true, starting = true };
    }

    /// <summary>Writes the hotkey to the engine config and, when needed,
    /// restarts the engine so it registers the new key immediately.</summary>
    private object ApplyScalingHotkey(JsonElement args)
    {
        var settings = _store.Library.Settings;
        var code = settings.ScalingHotkey;
        if (args.ValueKind == JsonValueKind.Object && args.TryGetProperty("code", out var value) &&
            value.TryGetInt32(out var requested) && requested > 0)
        {
            code = requested;
            settings.ScalingHotkey = requested;
            _store.Save();
        }

        // Native mode: the launcher itself owns the key, nothing to write to
        // an external engine.
        if (string.Equals(settings.ScalingEngine, "native", StringComparison.OrdinalIgnoreCase))
        {
            DoWindow(window => window.ApplyScalingHotkey(code));
            return new { ok = true, message = "快捷键已保存 · 由启动器处理", running = false, restarted = false };
        }

        var wasRunning = ScalingEngine.IsRunning();
        if (!ScalingEngine.WriteHotkey(code, out var message))
        {
            // The engine may never have run, so it has no config yet. The
            // setting is still saved; EnsureRunning applies it on first start.
            return new
            {
                ok = true,
                message = "快捷键已保存；第一次启动缩放引擎时生效",
                warning = message,
                running = wasRunning,
                restarted = false
            };
        }

        if (!wasRunning)
            return new { ok = true, message = "快捷键已保存；下次启动引擎时生效", running = false, restarted = false };

        var restart = args.ValueKind == JsonValueKind.Object &&
                      args.TryGetProperty("restart", out var flag) && flag.ValueKind == JsonValueKind.True;
        if (!restart)
            return new { ok = true, message = "快捷键已写入；重启引擎后生效", running = true, restarted = false };

        Task.Run(() =>
        {
            var ok = ScalingEngine.Restart(settings, out var restartMessage);
            Notify("scaling-engine", new { ok, message = restartMessage });
        });
        return new { ok = true, message = "正在重启缩放引擎以应用快捷键…", running = true, restarted = true };
    }

    private object RestartScalingEngine()
    {
        var settings = _store.Library.Settings;
        Task.Run(() =>
        {
            var ok = ScalingEngine.Restart(settings, out var message);
            Notify("scaling-engine", new { ok, message });
        });
        return new { ok = true, starting = true };
    }

    private object StopScalingEngine()
    {
        Task.Run(() =>
        {
            var ok = ScalingEngine.Quit();
            Notify("scaling-engine", new { ok, message = ok ? "缩放引擎已关闭" : "缩放引擎没有退出" });
        });
        return new { ok = true, stopping = true };
    }

    private object EngineOptions()
    {
        try
        {
            var options = ScalingEngine.ReadOptions(_store.Library.Settings);
            return new
            {
                ok = options.Ok,
                error = options.Error,
                configPath = options.ConfigPath,
                bundled = options.Bundled,
                running = options.Running,
                modes = options.Modes.Select(mode => new
                {
                    mode.Index,
                    mode.Name,
                    mode.Effects,
                    mode.Available,
                    mode.Missing,
                    mode.Note
                }),
                scalingMode = options.ScalingMode,
                captureMethod = options.CaptureMethod,
                cursorScaling = options.CursorScaling,
                frameRateLimiterEnabled = options.FrameRateLimiterEnabled,
                maxFrameRate = options.MaxFrameRate,
                gameMode3d = options.GameMode3d,
                autoStart = _store.Library.Settings.AutoStartEngine
            };
        }
        catch (Exception ex)
        {
            Log.Error("engine options", ex);
            return new { ok = false, error = ex.Message };
        }
    }

    private object SaveEngineOptions(JsonElement args)
    {
        var settings = _store.Library.Settings;
        var scalingMode = IntArg(args, "scalingMode", 0);
        var captureMethod = IntArg(args, "captureMethod", 0);
        var cursorScaling = IntArg(args, "cursorScaling", 6);
        var frameRateLimiterEnabled = BoolArg(args, "frameRateLimiterEnabled", false);
        var maxFrameRate = NumberArg(args, "maxFrameRate", 120);
        var gameMode3d = BoolArg(args, "gameMode3d", false);
        if (args.ValueKind == JsonValueKind.Object && args.TryGetProperty("autoStartEngine", out var autoStart) &&
            autoStart.ValueKind is JsonValueKind.True or JsonValueKind.False)
        {
            settings.AutoStartEngine = autoStart.GetBoolean();
            _store.Save();
        }

        if (!ScalingEngine.SaveOptions(scalingMode, captureMethod, cursorScaling,
                frameRateLimiterEnabled, maxFrameRate, gameMode3d, out var message))
            return new { ok = false, error = message };

        // The engine sheet and the launcher's own scaling settings must point
        // at the same algorithm, or the next launch would force the old one
        // back onto the engine.
        settings.ScaleAlgorithm = ScalingEngine.ReadAlgorithmName();
        _store.Save();

        Task.Run(() =>
        {
            var ok = ScalingEngine.Restart(settings, out var restartMessage);
            Notify("scaling-engine", new { ok, message = restartMessage });
        });
        return new { ok = true, message = "设置已保存，正在重启缩放引擎…" };
    }

    private object OpenMagpie()
    {
        var ok = ScalingEngine.Show(_store.Library.Settings, out var message);
        return new { ok, message };
    }

    private static int IntArg(JsonElement args, string name, int fallback) =>
        args.ValueKind == JsonValueKind.Object && args.TryGetProperty(name, out var value) &&
        value.TryGetInt32(out var number) ? number : fallback;

    private static double NumberArg(JsonElement args, string name, double fallback) =>
        args.ValueKind == JsonValueKind.Object && args.TryGetProperty(name, out var value) &&
        value.TryGetDouble(out var number) ? number : fallback;

    private static bool BoolArg(JsonElement args, string name, bool fallback) =>
        args.ValueKind == JsonValueKind.Object && args.TryGetProperty(name, out var value) &&
        value.ValueKind is JsonValueKind.True or JsonValueKind.False ? value.GetBoolean() : fallback;
}
