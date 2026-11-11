// 设置保存：接收 saveSettings 请求并把前端设置写入商店。
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
    private object SaveSettings(JsonElement args)
    {
        var settings = _store.Library.Settings;
        if (args.ValueKind == JsonValueKind.Object)
        {
            if (args.TryGetProperty("currentGameId", out var current) && current.ValueKind == JsonValueKind.String)
                _store.Library.CurrentGameId = current.GetString();
            if (args.TryGetProperty("sound", out var sound) && sound.ValueKind is JsonValueKind.True or JsonValueKind.False)
                settings.Sound = sound.GetBoolean();
            if (args.TryGetProperty("reduceMotion", out var motion) && motion.ValueKind is JsonValueKind.True or JsonValueKind.False)
                settings.ReduceMotion = motion.GetBoolean();
            if (args.TryGetProperty("calm", out var calm) && calm.ValueKind is JsonValueKind.True or JsonValueKind.False)
                settings.Calm = calm.GetBoolean();
            if (args.TryGetProperty("layout", out var layout) && layout.ValueKind == JsonValueKind.String)
                settings.Layout = layout.GetString() == "rail" ? "rail" : "row";
            if (args.TryGetProperty("theme", out var theme) && theme.ValueKind == JsonValueKind.String
                && _themes.Find(theme.GetString()) is { Ok: true } selected)
                settings.Theme = selected.Id;
            if (args.TryGetProperty("styleMode", out var mode) && mode.ValueKind == JsonValueKind.String)
                settings.StyleMode = mode.GetString() == "system" ? "system" : "adaptive";
            if (args.TryGetProperty("typeSeed", out var seed) && seed.TryGetInt32(out var seedValue))
                settings.TypeSeed = seedValue;
            if (args.TryGetProperty("playerName", out var player) && player.ValueKind == JsonValueKind.String)
            {
                var name = (player.GetString() ?? "").Trim();
                if (!string.IsNullOrWhiteSpace(name))
                {
                    settings.Playername = name;
                    settings.PlayerNameCustom = true;
                }
            }
            if (args.TryGetProperty("useSystemPlayerName", out var systemName) && systemName.ValueKind == JsonValueKind.True)
            {
                settings.Playername = Environment.UserName;
                settings.PlayerNameCustom = false;
            }
            if (args.TryGetProperty("closeToTray", out var tray) && tray.ValueKind is JsonValueKind.True or JsonValueKind.False)
                settings.CloseToTray = tray.GetBoolean();
            if (args.TryGetProperty("autoBackup", out var backup) && backup.ValueKind is JsonValueKind.True or JsonValueKind.False)
                settings.AutoBackup = backup.GetBoolean();
            if (args.TryGetProperty("startupFullscreen", out var startupFullscreen) && startupFullscreen.ValueKind is JsonValueKind.True or JsonValueKind.False)
                settings.StartupFullscreen = startupFullscreen.GetBoolean();
            if (args.TryGetProperty("minimizeOnLaunch", out var minimize) && minimize.ValueKind is JsonValueKind.True or JsonValueKind.False)
                settings.MinimizeOnLaunch = minimize.GetBoolean();
            if (args.TryGetProperty("idlePauseMinutes", out var idlePause) && idlePause.TryGetInt32(out var idleMinutes))
                settings.IdlePauseMinutes = Math.Max(0, Math.Min(120, idleMinutes));
            if (args.TryGetProperty("libraryTagCount", out var tagCount) && tagCount.TryGetInt32(out var tagCountValue))
                settings.LibraryTagCount = Math.Max(1, Math.Min(3, tagCountValue));
            if (args.TryGetProperty("scaleDelaySeconds", out var scaleDelay) && scaleDelay.TryGetInt32(out var scaleDelayValue))
                settings.ScaleDelaySeconds = Math.Max(0, Math.Min(120, scaleDelayValue));
            if (args.TryGetProperty("scaleMode", out var scaleMode) && scaleMode.ValueKind == JsonValueKind.String)
            {
                var requestedMode = scaleMode.GetString() ?? "fullscreen";
                settings.ScaleMode = requestedMode is "fullscreen" or "factor" ? requestedMode : "fullscreen";
            }
            if (args.TryGetProperty("scaleFactor", out var scaleFactor) && scaleFactor.TryGetDouble(out var scaleFactorValue))
                settings.ScaleFactor = Math.Max(1.1, Math.Min(10, scaleFactorValue));
            if (args.TryGetProperty("scaleAlgorithm", out var scaleAlgorithm) && scaleAlgorithm.ValueKind == JsonValueKind.String)
            {
                var nextAlgorithm = scaleAlgorithm.GetString() ?? "";
                if (!string.Equals(nextAlgorithm, settings.ScaleAlgorithm, StringComparison.Ordinal))
                {
                    settings.ScaleAlgorithm = nextAlgorithm;
                    // Picking an algorithm must take effect immediately, not
                    // only on the next launch: write the config and reload a
                    // running engine in the background.
                    System.Threading.Tasks.Task.Run(() =>
                    {
                        ScalingEngine.ApplyAlgorithm(nextAlgorithm, out var note, out var changed);
                        if (changed && ScalingEngine.IsRunning()) ScalingEngine.Restart(settings, out _);
                        if (!changed && !note.Contains("已是") && !note.Contains("跟随"))
                            Log.Write($"scale algorithm note: {note}");
                    });
                }
            }
            if (args.TryGetProperty("scalingEngine", out var scaling) && scaling.ValueKind == JsonValueKind.String)
            {
                var value = scaling.GetString() ?? "auto";
                settings.ScalingEngine = value is "auto" or "native" or "off" ? value : "auto";
                DoWindow(window => window.ApplyScalingHotkey(settings.ScalingHotkey));
            }
            if (args.TryGetProperty("autoStartEngine", out var autoStart) && autoStart.ValueKind is JsonValueKind.True or JsonValueKind.False)
                settings.AutoStartEngine = autoStart.GetBoolean();
            if (args.TryGetProperty("scalingHotkey", out var hotkey) && hotkey.TryGetInt32(out var hotkeyCode) && hotkeyCode > 0)
            {
                settings.ScalingHotkey = hotkeyCode;
                DoWindow(window => window.ApplyScalingHotkey(hotkeyCode));
            }
            if (TryGetString(args, "magpiePath", out var magpie))
                settings.MagpiePath = string.IsNullOrWhiteSpace(magpie) ? null : magpie!.Trim();
            if (args.TryGetProperty("unifiedSfx", out var unified) && unified.ValueKind is JsonValueKind.True or JsonValueKind.False)
                settings.UnifiedSfx = unified.GetBoolean();
            if (args.TryGetProperty("librarySort", out var sort) && sort.ValueKind == JsonValueKind.String)
            {
                var value = sort.GetString() ?? "recent";
                settings.LibrarySort = value is "recent" or "name" or "playtime" or "added" or "launches"
                    ? value : "recent";
            }
            // asc / desc; anything else (including "") clears the override and
            // lets the renderer fall back to that field's natural order.
            if (args.TryGetProperty("librarySortDir", out var sortDir) && sortDir.ValueKind is JsonValueKind.String or JsonValueKind.Null)
            {
                var value = sortDir.ValueKind == JsonValueKind.String ? sortDir.GetString() : null;
                settings.LibrarySortDir = value is "asc" or "desc" ? value : null;
            }
            if (args.TryGetProperty("compatibilityTier", out var tier) && tier.ValueKind == JsonValueKind.String)
            {
                var value = tier.GetString() ?? "auto";
                settings.CompatibilityTier = value is "auto" or "full" or "balanced" or "safe"
                    ? value : "auto";
            }
            if (args.TryGetProperty("developerMode", out var developer) && developer.ValueKind is JsonValueKind.True or JsonValueKind.False)
                settings.DeveloperMode = developer.GetBoolean();
            if (args.TryGetProperty("autoCheckUpdates", out var autoCheck) && autoCheck.ValueKind is JsonValueKind.True or JsonValueKind.False)
                settings.AutoCheckUpdates = autoCheck.GetBoolean();
            if (args.TryGetProperty("shareTint", out var shareTint) && shareTint.ValueKind is JsonValueKind.True or JsonValueKind.False)
                settings.ShareTint = shareTint.GetBoolean();
        }
        _store.Save();
        return new { ok = true };
    }
}
