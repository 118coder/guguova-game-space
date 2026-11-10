// 头像与媒体资产：图片预览、导入分析落盘与带缓存戳的媒体 URL。
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
    /// <summary>
    /// Returns a thumbnail as a data URL so the in-app browser can preview an
    /// image before it is imported (no OS preview window involved).
    /// </summary>
    private object ReadImagePreview(JsonElement args)
    {
        var path = GetPath(args, "path");
        if (string.IsNullOrWhiteSpace(path) || !File.Exists(path))
            return new { ok = false, error = "图片不存在" };
        try
        {
            using var image = System.Drawing.Image.FromFile(path);
            var width = 320;
            var height = Math.Max(1, (int)Math.Round(image.Height * (width / (double)image.Width)));
            using var thumb = new System.Drawing.Bitmap(image, width, height);
            using var stream = new MemoryStream();
            thumb.Save(stream, System.Drawing.Imaging.ImageFormat.Jpeg);
            var data = Convert.ToBase64String(stream.ToArray());
            return new { ok = true, url = $"data:image/jpeg;base64,{data}", width = image.Width, height = image.Height };
        }
        catch (Exception ex)
        {
            Log.Error("image preview", ex);
            return new { ok = false, error = "无法读取这张图片" };
        }
    }

    /// <summary>
    /// Media URL with the file's mtime as the cache key. The bytes under
    /// nova.media/&lt;id&gt;/cover.jpg change when the player swaps artwork
    /// (cover refresh, icon regeneration, Steam re-import) while the URL
    /// stays identical — WebView2 then kept serving the cached image until
    /// a restart, which is exactly the report this stamp answers. Same
    /// treatment the avatar already gets on the frontend.
    /// </summary>
    private static string MediaUrl(string path, string gameId, string fallbackName)
    {
        string candidate = null;
        try
        {
            if (!string.IsNullOrWhiteSpace(path) && File.Exists(path))
            {
                var full = Path.GetFullPath(path);
                var mediaRoot = Path.GetFullPath(AppPaths.Media);
                if (full.StartsWith(mediaRoot, StringComparison.OrdinalIgnoreCase))
                {
                    candidate = full;
                }
            }
        }
        catch { }

        if (candidate == null)
        {
            // The generated-cover fallback lives at the same media slot; it is
            // regenerated in place, so it needs the stamp just as much.
            var fallback = Path.Combine(AppPaths.Media, gameId, fallbackName + ".jpg");
            if (File.Exists(fallback)) candidate = fallback;
        }

        if (candidate == null)
            return $"https://nova.media/{gameId}/{fallbackName}.jpg";

        try
        {
            var relative = CompatUtil.RelativePath(AppPaths.Media, candidate).Replace('\\', '/');
            var stamp = File.GetLastWriteTimeUtc(candidate).Ticks;
            return $"https://nova.media/{relative}?v={stamp}";
        }
        catch
        {
            return $"https://nova.media/{gameId}/{fallbackName}.jpg";
        }
    }

    private object SetAvatar(JsonElement args)
    {
        var path = GetString(args, "path");
        if (string.IsNullOrWhiteSpace(path) || !File.Exists(path))
            return new { ok = false, error = "找不到头像图片" };
        var relative = _media.ImportAvatar(path);
        if (string.IsNullOrWhiteSpace(relative))
            return new { ok = false, error = "无法读取这张图片" };
        _store.Library.Settings.AvatarFile = relative;
        _store.Save();
        return new { ok = true, avatarFile = relative };
    }

    private object ClearAvatar()
    {
        _store.Library.Settings.AvatarFile = null;
        _media.ClearAvatar();
        _store.Save();
        return new { ok = true };
    }

    private void ApplyMedia(GameEntry game, string? sourceImage, string? coverImage = null)
    {
        var imported = false;
        CoverAnalysis? analysis = null;
        var image = !string.IsNullOrWhiteSpace(sourceImage) && File.Exists(sourceImage) ? sourceImage : null;

        if (image != null)
        {
            analysis = _media.ImportImage(game.Id, image);
            if (analysis != null)
            {
                game.HeroPath = Path.Combine(_media.GameMediaDir(game.Id), "hero.jpg");
                game.CoverPath = Path.Combine(_media.GameMediaDir(game.Id), "cover.jpg");
                imported = true;
            }
        }

        if (!imported && !string.IsNullOrWhiteSpace(coverImage) && File.Exists(coverImage))
        {
            analysis = _media.ImportImage(game.Id, coverImage);
            if (analysis != null)
            {
                game.HeroPath = Path.Combine(_media.GameMediaDir(game.Id), "hero.jpg");
                game.CoverPath = Path.Combine(_media.GameMediaDir(game.Id), "cover.jpg");
                imported = true;
            }
        }

        if (!imported && !string.IsNullOrWhiteSpace(game.ExePath))
        {
            analysis = _media.ImportExecutableIcon(game.Id, game.ExePath);
            if (analysis != null)
            {
                game.HeroPath = Path.Combine(_media.GameMediaDir(game.Id), "hero.jpg");
                game.CoverPath = Path.Combine(_media.GameMediaDir(game.Id), "cover.jpg");
                imported = true;
            }
        }

        ApplyAnalysis(game, analysis);
    }

    private static void ApplyAnalysis(GameEntry game, CoverAnalysis? analysis)
    {
        if (analysis == null) return;
        game.Accent = analysis.Accent;
        game.Accent2 = analysis.Accent2;
        game.Glow = analysis.Glow;
        game.Scrim = analysis.Scrim;
        game.Colors = analysis.Colors.ToList();
        game.Dna = new CoverDna
        {
            Luma = analysis.Luma,
            Sat = analysis.Saturation,
            Warmth = analysis.Warmth,
            Edge = analysis.Edge
        };
    }
}
