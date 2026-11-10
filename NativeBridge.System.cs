// 系统与窗口操作：开机自启、资源管理器定位、备份导入导出与窗口全屏状态。
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
    private object SetFullscreen(JsonElement args)
    {
        var on = args.ValueKind == JsonValueKind.Object
                 && args.TryGetProperty("on", out var flag)
                 && flag.ValueKind == JsonValueKind.True;
        DoWindow(w => w.SetFullscreen(on));
        return new { ok = true, fullscreen = on };
    }

    private object GetFullscreenState()
    {
        var result = false;
        System.Windows.Application.Current.Dispatcher.Invoke(() =>
        {
            if (System.Windows.Application.Current.MainWindow is MainWindow window) result = window.IsFullscreen;
        });
        return new { ok = true, fullscreen = result };
    }

    private object WindowStatePayload() => new
    {
        maximized = System.Windows.Application.Current.MainWindow is MainWindow window
            && (window.IsFullscreen || window.WindowState == System.Windows.WindowState.Maximized)
    };

    /// <summary>Client state plus what this executable actually needs. Used by
    /// the manage panel so a "打不开" entry can be explained instead of guessed.</summary>
    private object StartupState()
    {
        var state = StartupService.Inspect();
        return new
        {
            ok = true,
            enabled = state.Enabled,
            pointsHere = state.PointsHere,
            command = state.Command,
            exePath = state.ExePath
        };
    }

    private object SetStartup(JsonElement args)
    {
        var enable = args.ValueKind == JsonValueKind.Object &&
                     args.TryGetProperty("enabled", out var flag) && flag.ValueKind == JsonValueKind.True;
        var ok = enable ? StartupService.Enable(out var startupError) : StartupService.Disable(out startupError);
        if (!ok) return new { ok = false, error = startupError };

        var state = StartupService.Inspect();
        return new
        {
            ok = true,
            state = new
            {
                enabled = state.Enabled,
                pointsHere = state.PointsHere,
                command = state.Command,
                exePath = state.ExePath
            }
        };
    }

    private object RevealGame(JsonElement args)
    {
        var game = ResolveGame(args);
        var path = game?.ExePath;
        if (string.IsNullOrWhiteSpace(path) || !File.Exists(path)) return new { ok = false };
        try
        {
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
            {
                FileName = "explorer.exe",
                Arguments = $"/select,\"{path}\"",
                UseShellExecute = true
            });
            return new { ok = true };
        }
        catch (Exception ex)
        {
            return new { ok = false, error = ex.Message };
        }
    }

    private object RevealPath(JsonElement args)
    {
        var path = GetString(args, "path");
        if (string.IsNullOrWhiteSpace(path) || !File.Exists(path)) return new { ok = false };
        try
        {
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
            {
                FileName = "explorer.exe",
                Arguments = $"/select,\"{path}\"",
                UseShellExecute = true
            });
            return new { ok = true };
        }
        catch (Exception ex)
        {
            return new { ok = false, error = ex.Message };
        }
    }

    private object BrowseFile(JsonElement args)
    {
        var uri = GetString(args, "uri") ?? "";
        if (!uri.StartsWith("file:", StringComparison.OrdinalIgnoreCase) &&
            !uri.StartsWith("https://nova.", StringComparison.OrdinalIgnoreCase))
            return new { ok = false };
        try
        {
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo { FileName = uri, UseShellExecute = true });
            return new { ok = true };
        }
        catch
        {
            return new { ok = false };
        }
    }

    private object OpenDataFolder()
    {
        try
        {
            AppPaths.Ensure();
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
            {
                FileName = AppPaths.Root,
                UseShellExecute = true
            });
            return new { ok = true };
        }
        catch
        {
            return new { ok = false };
        }
    }

    private object OpenBackupsFolder()
    {
        try
        {
            AppPaths.Ensure();
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
            {
                FileName = AppPaths.Backups,
                UseShellExecute = true
            });
            return new { ok = true, path = AppPaths.Backups };
        }
        catch (Exception ex)
        {
            return new { ok = false, error = ex.Message };
        }
    }

    private object ExportPack()
    {
        var result = BackupService.Export(_store);
        return new
        {
            ok = result.Ok,
            error = result.Error,
            path = result.Path,
            size = result.Size,
            games = result.Games,
            mediaFiles = result.MediaFiles
        };
    }

    private object ImportPack(JsonElement args)
    {
        var path = GetString(args, "path");
        var mode = GetString(args, "mode") == "replace" ? "replace" : "merge";
        var result = BackupService.Import(_store, path ?? "", mode);
        return new
        {
            ok = result.Ok,
            error = result.Error,
            backupPath = result.BackupPath,
            games = result.Games,
            added = result.Added,
            replaced = result.Replaced,
            mediaFiles = result.MediaFiles,
            missing = result.Missing
        };
    }

    private object ExportRecords()
    {
        try
        {
            var path = BackupService.ExportRecordsCsv(_store);
            return new { ok = true, path };
        }
        catch (Exception ex)
        {
            Log.Error("export records", ex);
            return new { ok = false, error = ex.Message };
        }
    }
}
