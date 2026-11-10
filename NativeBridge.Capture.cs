// 全页截图导出：经 DevTools 协议按视口分段截图、离屏拼接并保存到本地。
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
    /* ============================================================
       FULL-PAGE SCREENSHOT
       ============================================================ */

    /// <summary>
    /// The renderer releases its viewport-height chain first (see
    /// exportScreenshot in app.js) and hands over the resulting CSS size. The
    /// capture itself goes through the DevTools protocol because
    /// CapturePreviewAsync can only ever see the viewport — and because the
    /// layout must not be re-measured at a different size: this interface is
    /// built out of vh units, so a taller viewport would move everything.
    /// </summary>
    private object QueuePageCapture(JsonElement args)
    {
        if (_web?.CoreWebView2 == null) return new { ok = false, error = "界面尚未就绪" };

        var width = ReadNumber(args, "width");
        var height = ReadNumber(args, "height");
        var scale = ReadNumber(args, "scale");
        if (width < 2 || height < 2) return new { ok = false, error = "没有可导出的内容" };
        if (height > 20000) return new { ok = false, error = "页面过长（超过 20000 px）" };

        var view = args.TryGetProperty("view", out var viewNode) && viewNode.ValueKind == JsonValueKind.String
            ? viewNode.GetString() ?? "page"
            : "page";
        var background = args.TryGetProperty("background", out var bg) && bg.ValueKind == JsonValueKind.String
            ? bg.GetString()
            : null;
        // A share card is narrower than the window on purpose. Normal page
        // captures widen the clip to the viewport (a full page is at least
        // as wide as the window); an exact capture must not.
        var exact = args.TryGetProperty("exact", out var exactNode) && exactNode.ValueKind == JsonValueKind.True;

        // The reply is immediate. The image arrives later as a
        // `screenshot-done` notification, which is also the signal the page
        // uses to put its layout back.
        Application.Current?.Dispatcher.InvokeAsync(
            async () => await CapturePageAsync(view, width, height, scale, background, exact));
        return new { ok = true, queued = true };
    }

    private static double ReadNumber(JsonElement args, string name)
    {
        return args.TryGetProperty(name, out var node) && node.ValueKind == JsonValueKind.Number
            ? node.GetDouble()
            : 0;
    }

    private async Task CapturePageAsync(string view, double widthHint, double heightHint, double requestedScale, string? background, bool exact = false)
    {
        string? path = null;
        string? error = null;
        var pixelWidth = 0;
        var pixelHeight = 0;
        try
        {
            var core = _web!.CoreWebView2;
            // net48 has no Math.Clamp; the two lines are the same thing.
            var scale = requestedScale <= 0 ? 1 : requestedScale;
            if (scale < 1) scale = 1;
            if (scale > 2) scale = 2;

            // The clip frame is the app surface the renderer measured, not the
            // document. The document is bigger than the interface by design —
            // the backdrop layers hang outside the shell (`.scene-stack` is
            // inset -3%) — so asking for its size returns a ring of background
            // art around the UI. The DevTools metrics are logged as a
            // reference only; the viewport width is the one number they can
            // usefully contribute, because it *is* the window's CSS width.
            var metricsJson = await core.CallDevToolsProtocolMethodAsync("Page.getLayoutMetrics", "{}");
            using var metrics = JsonDocument.Parse(metricsJson);
            var contentW = 0d;
            var contentH = 0d;
            var viewW = 0d;
            if (metrics.RootElement.TryGetProperty("cssContentSize", out var content))
            {
                contentW = ReadNumber(content, "width");
                contentH = ReadNumber(content, "height");
            }
            if (metrics.RootElement.TryGetProperty("cssVisualViewport", out var visual))
            {
                viewW = ReadNumber(visual, "clientWidth");
            }
            if (metrics.RootElement.TryGetProperty("cssLayoutViewport", out var layout))
            {
                viewW = Math.Max(viewW, ReadNumber(layout, "clientWidth"));
            }

            var cssWidth = exact ? widthHint : Math.Max(widthHint, viewW);
            var cssHeight = heightHint;
            if (cssWidth < 2 || cssHeight < 2) throw new InvalidOperationException("没有可导出的内容");
            if (cssHeight > 20000) throw new InvalidOperationException("页面过长（超过 20000 px）");
            // A 2x capture of a long page is an easy way to allocate a
            // gigabyte; one step down to 1x is better than refusing to export.
            if (cssHeight * scale > 20000) scale = 1;

            // Each slice comes back as base64 on the UI thread; decoding and
            // stitching is the slow half and runs off it.
            var slices = new List<(double Top, byte[] Png)>();
            const int sliceHeight = 4000;
            for (var y = 0d; y < cssHeight; y += sliceHeight)
            {
                var slice = Math.Min(sliceHeight, cssHeight - y);
                var request = JsonSerializer.Serialize(new Dictionary<string, object?>
                {
                    ["format"] = "png",
                    ["fromSurface"] = true,
                    ["captureBeyondViewport"] = true,
                    ["clip"] = new Dictionary<string, object?>
                    {
                        ["x"] = 0,
                        ["y"] = y,
                        ["width"] = cssWidth,
                        ["height"] = slice,
                        ["scale"] = scale
                    }
                });
                var json = await core.CallDevToolsProtocolMethodAsync("Page.captureScreenshot", request);
                using var document = JsonDocument.Parse(json);
                if (!document.RootElement.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.String)
                    throw new InvalidOperationException("截图没有返回图像数据");
                slices.Add((y, Convert.FromBase64String(data.GetString()!)));
            }

            var folder = ScreenshotFolder();
            Directory.CreateDirectory(folder);
            var name = $"GUGUOVA-{SafeFilePart(view)}-{DateTime.Now:yyyyMMdd-HHmmss}.png";
            var target = Path.Combine(folder, name);
            var fill = ParseColor(background);
            Log.Stage($"capture: cdp={contentW:0}x{contentH:0} viewport={viewW:0} hint={widthHint:0}x{heightHint:0} "
                      + $"clip={cssWidth:0}x{cssHeight:0} scale={scale:0.##} slices={slices.Count}");

            await Task.Run(() =>
            {
                // The canvas follows what actually came back. Chromium trims a
                // clip to the content it has, so trusting the requested size
                // would paint a strip of background down the right edge when
                // the two disagree.
                var layers = new List<(double Top, Gdi.Bitmap Image)>();
                try
                {
                    foreach (var (top, png) in slices)
                    {
                        var stream = new MemoryStream(png);
                        layers.Add((top, new Gdi.Bitmap(stream)));
                    }
                    // The canvas follows what actually came back, and slices are
                    // stacked by their real pixel height: Chromium rounds each
                    // slice to the device grid, so multiplying the CSS offset by
                    // an assumed scale would leave a one-pixel seam every 4000px.
                    var canvasWidth = 1;
                    var canvasHeight = 0;
                    foreach (var (_, image) in layers)
                    {
                        canvasWidth = Math.Max(canvasWidth, image.Width);
                        canvasHeight += image.Height;
                    }

                    using var canvas = new Gdi.Bitmap(canvasWidth, canvasHeight, Gdi.Imaging.PixelFormat.Format32bppArgb);
                    using (var graphics = Gdi.Graphics.FromImage(canvas))
                    {
                        graphics.Clear(fill);
                        var offset = 0;
                        foreach (var (_, image) in layers)
                        {
                            graphics.DrawImage(image, new Gdi.Rectangle(0, offset, image.Width, image.Height));
                            offset += image.Height;
                        }
                    }
                    pixelWidth = canvas.Width;
                    pixelHeight = canvas.Height;
                    canvas.Save(target, Gdi.Imaging.ImageFormat.Png);
                    Log.Stage($"capture: output {pixelWidth}x{pixelHeight} for clip {cssWidth:0}x{cssHeight:0} "
                              + $"(device factor {pixelWidth / cssWidth:0.###})");
                }
                finally
                {
                    foreach (var (_, image) in layers) image.Dispose();
                }
            });
            path = target;
        }
        catch (Exception ex)
        {
            Log.Error("capture page", ex);
            error = ex.Message;
        }

        Notify("screenshot-done", new
        {
            ok = error == null && path != null,
            path,
            name = path == null ? null : Path.GetFileName(path),
            folder = ScreenshotFolderLabel(),
            width = pixelWidth,
            height = pixelHeight,
            bytes = path != null && File.Exists(path) ? new FileInfo(path).Length : 0,
            error
        });
    }

    /// <summary>Pictures is the convention for an image the player asked for;
    /// the data folder is only a fallback for a profile with no Pictures.</summary>
    private static string ScreenshotFolder()
    {
        var pictures = Environment.GetFolderPath(Environment.SpecialFolder.MyPictures);
        return string.IsNullOrWhiteSpace(pictures)
            ? Path.Combine(AppPaths.Root, "screenshots")
            : Path.Combine(pictures, "GUGUOVA");
    }

    private static string ScreenshotFolderLabel()
    {
        return string.IsNullOrWhiteSpace(Environment.GetFolderPath(Environment.SpecialFolder.MyPictures))
            ? @"数据目录\screenshots"
            : @"图片\GUGUOVA";
    }

    private static string SafeFilePart(string value)
    {
        var clean = new string((value ?? "").Where(ch => char.IsLetterOrDigit(ch) || ch is '-' or '_').ToArray());
        return string.IsNullOrWhiteSpace(clean) ? "page" : clean;
    }

    private static Gdi.Color ParseColor(string? value)
    {
        var fallback = Gdi.Color.FromArgb(255, 6, 7, 7);
        if (string.IsNullOrWhiteSpace(value)) return fallback;
        var text = value.Trim();
        if (text.StartsWith("rgb", StringComparison.OrdinalIgnoreCase) && text.IndexOf('(') is var open and > 0)
        {
            var body = text.Substring(open + 1).TrimEnd(')').Split(',');
            if (body.Length >= 3
                && int.TryParse(body[0].Trim(), out var red)
                && int.TryParse(body[1].Trim(), out var green)
                && int.TryParse(body[2].Trim(), out var blue))
            {
                return Gdi.Color.FromArgb(255, red, green, blue);
            }
        }
        try { return Gdi.ColorTranslator.FromHtml(text); }
        catch { return fallback; }
    }
}
