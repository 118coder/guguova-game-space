// 应用更新：检查更新、下载更新包、取消下载与打开下载目录。
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
    /* ---------- update check + package download (GitHub releases) ---------- */

    private object BeginUpdateCheck()
    {
        _store.Library.Settings.LastUpdateCheckUtc = DateTime.UtcNow.ToString("o");
        _store.Save();
        Task.Run(async () =>
        {
            try
            {
                Notify("update-status", new { phase = "checking" });
                var result = await UpdateService.CheckAsync(CancellationToken.None);
                Notify("update-status", new
                {
                    phase = "result",
                    ok = result.Ok,
                    error = result.Error,
                    current = result.Current,
                    latest = result.Latest,
                    available = result.Available,
                    assetName = result.AssetName,
                    assetSize = result.AssetSize,
                    assetUrl = result.AssetUrl,
                    notes = TruncateNotes(result.Notes)
                });
            }
            catch (Exception ex)
            {
                Log.Error("update check", ex);
                Notify("update-status", new { phase = "error", error = ex.Message });
            }
        });
        return new { ok = true, checking = true };
    }

    /// <summary>Runs once after boot when the player opted into daily checks;
    /// otherwise it is a no-op so the launcher stays fully offline.</summary>
    private object MaybeAutoUpdateCheck()
    {
        var settings = _store.Library.Settings;
        if (!settings.AutoCheckUpdates) return new { ok = true, skipped = "disabled" };
        if (DateTime.TryParse(settings.LastUpdateCheckUtc, out var last)
            && (DateTime.UtcNow - last).TotalHours < 24)
        {
            return new { ok = true, skipped = "recent" };
        }
        return BeginUpdateCheck();
    }

    private object BeginUpdateDownload(JsonElement args)
    {
        var url = GetString(args, "url");
        var name = GetString(args, "name");
        if (string.IsNullOrWhiteSpace(url) || string.IsNullOrWhiteSpace(name))
            return new { ok = false, error = "缺少下载信息，请先检查更新" };
        var token = UpdateService.BeginDownloadScope();
        Task.Run(async () =>
        {
            try
            {
                Notify("update-status", new { phase = "downloading", name });
                var path = await UpdateService.DownloadAsync(new UpdateCandidate(name, 0, url!),
                    (received, total) => Notify("update-progress", new
                    {
                        percent = total > 0 ? (int)(received * 100 / total) : 0,
                        receivedBytes = received,
                        totalBytes = total
                    }), token);
                Notify("update-status", new { phase = "done", path, name });
            }
            catch (OperationCanceledException)
            {
                Notify("update-status", new { phase = "cancelled" });
            }
            catch (Exception ex)
            {
                Log.Error("update download", ex);
                Notify("update-status", new { phase = "error", error = ex.Message });
            }
        });
        return new { ok = true };
    }

    private object CancelUpdateDownload()
    {
        UpdateService.CancelDownload();
        return new { ok = true };
    }

    private object OpenUpdateFolder()
    {
        try
        {
            System.IO.Directory.CreateDirectory(UpdateService.UpdatesDir);
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
            {
                FileName = UpdateService.UpdatesDir,
                UseShellExecute = true
            });
            return new { ok = true };
        }
        catch (Exception ex)
        {
            Log.Error("open update folder", ex);
            return new { ok = false, error = "打不开下载文件夹" };
        }
    }

    private static string? TruncateNotes(string? notes)
    {
        if (string.IsNullOrEmpty(notes)) return null;
        var line = notes.Replace("\r\n", "\n");
        var cut = line.IndexOf('\n');
        if (cut >= 0) line = line.Substring(0, cut);
        return line.Length > 160 ? line.Substring(0, 160) + "…" : line;
    }
}
