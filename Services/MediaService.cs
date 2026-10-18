using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using Color = System.Drawing.Color;
using Size = System.Drawing.Size;
using GraphicsPath = System.Drawing.Drawing2D.GraphicsPath;
using PathGradientBrush = System.Drawing.Drawing2D.PathGradientBrush;
using ImageAttributes = System.Drawing.Imaging.ImageAttributes;
using ColorMatrix = System.Drawing.Imaging.ColorMatrix;
using Pen = System.Drawing.Pen;
using LinearGradientBrush = System.Drawing.Drawing2D.LinearGradientBrush;
using NovaGameSpace.Models;

namespace NovaGameSpace.Services;

/// <summary>
/// Turns real game files into NOVA artwork: keys a cover image out of a chosen
/// picture (or the executable icon), samples a palette from it, and stores 16:9
/// hero + cover crops inside the app data folder.
/// </summary>
public sealed class MediaService
{
    public const int HeroWidth = 1920;
    public const int HeroHeight = 1080;
    public const int CoverWidth = 800;
    public const int CoverHeight = 450;

    public string MediaDir => AppPaths.Media;

    public string GameMediaDir(string gameId)
    {
        var dir = Path.Combine(MediaDir, gameId);
        Directory.CreateDirectory(dir);
        return dir;
    }

    /// <summary>
    /// Builds hero + cover from a source image. Returns the palette derived
    /// from the crop, or null when the image cannot be read.
    /// </summary>
    public CoverAnalysis? ImportImage(string gameId, string sourcePath)
    {
        try
        {
            using var source = LoadBitmap(sourcePath, out var disposeSource);
            using var framed = FrameToRatio(source, 16d / 9d, 50, 45);
            var dir = GameMediaDir(gameId);

            var heroPath = Path.Combine(dir, "hero.jpg");
            var coverPath = Path.Combine(dir, "cover.jpg");
            using (var hero = Resize(framed, HeroWidth, HeroHeight))
            {
                SaveJpeg(hero, heroPath, 88);
            }
            using (var cover = Resize(framed, CoverWidth, CoverHeight))
            {
                SaveJpeg(cover, coverPath, 86);
            }
            using var thumbnail = Resize(framed, 220, 124);
            var palette = CoverAnalyzer.Analyze(thumbnail);
            if (disposeSource) source.Dispose();
            return palette;
        }
        catch (Exception ex)
        {
            Log.Error("import image", ex);
            return null;
        }
    }

    /// <summary>Extracts the best executable icon and wraps it into palette-branded art.</summary>
    public CoverAnalysis? ImportExecutableIcon(string gameId, string exePath)
    {
        try
        {
            var icon = ExtractIcon(exePath);
            if (icon == null) return null;

            using var iconBitmap = ToBitmap(icon);
            using var art = ComposeIconArt(iconBitmap);
            var dir = GameMediaDir(gameId);

            var heroPath = Path.Combine(dir, "hero.jpg");
            var coverPath = Path.Combine(dir, "cover.jpg");
            using (var hero = Resize(art, HeroWidth, HeroHeight)) SaveJpeg(hero, heroPath, 88);
            using (var cover = Resize(art, CoverWidth, CoverHeight)) SaveJpeg(cover, coverPath, 86);
            using var thumb = Resize(art, 220, 124);
            return CoverAnalyzer.Analyze(thumb);
        }
        catch (Exception ex)
        {
            Log.Error("import icon", ex);
            return null;
        }
    }

    public void DeleteGameMedia(string gameId)
    {
        try
        {
            var dir = Path.Combine(MediaDir, gameId);
            if (Directory.Exists(dir)) Directory.Delete(dir, true);
        }
        catch (Exception ex)
        {
            Log.Error("delete media", ex);
        }
    }

    public string? CopyCustomLogo(string gameId, string imagePath)
    {
        try
        {
            var dir = GameMediaDir(gameId);
            var ext = Path.GetExtension(imagePath).ToLowerInvariant();
            if (ext is not (".png" or ".webp" or ".jpg" or ".jpeg" or ".bmp")) ext = ".png";
            var target = Path.Combine(dir, "logo" + ext);
            File.Copy(imagePath, target, true);
            return target;
        }
        catch (Exception ex)
        {
            Log.Error("copy logo", ex);
            return null;
        }
    }

    /// <summary>Reads dimensions and provides a best guess for the new game name.</summary>
    public static string SuggestName(string exePath)
    {
        try
        {
            var info = FileVersionInfoSafe(exePath);
            if (!string.IsNullOrWhiteSpace(info)) return info!;
            var name = Path.GetFileNameWithoutExtension(exePath);
            return name.Replace('_', ' ').Replace('-', ' ').Trim();
        }
        catch
        {
            return Path.GetFileNameWithoutExtension(exePath);
        }
    }

    private static string? FileVersionInfoSafe(string exePath)
    {
        try
        {
            var version = System.Diagnostics.FileVersionInfo.GetVersionInfo(exePath);
            var product = version.ProductName?.Trim();
            if (!string.IsNullOrWhiteSpace(product) && product.Length < 60 && !product.Contains("Microsoft", StringComparison.OrdinalIgnoreCase))
                return product;
            var desc = version.FileDescription?.Trim();
            if (!string.IsNullOrWhiteSpace(desc) && desc.Length < 60) return desc;
            return null;
        }
        catch
        {
            return null;
        }
    }

    private static Bitmap LoadBitmap(string path, out bool dispose)
    {
        dispose = false;
        try
        {
            // Use a WPF decoder for webp support, then copy into GDI+.
            if (Path.GetExtension(path).Equals(".webp", StringComparison.OrdinalIgnoreCase))
            {
                var decoder = BitmapDecoder.Create(new Uri(path), BitmapCreateOptions.None, BitmapCacheOption.OnLoad);
                var frame = decoder.Frames[0];
                var converted = new FormatConvertedBitmap(frame, PixelFormats.Bgra32, null, 0);
                var w = converted.PixelWidth;
                var h = converted.PixelHeight;
                var bitmap = new Bitmap(w, h, System.Drawing.Imaging.PixelFormat.Format32bppArgb);
                var data = bitmap.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, bitmap.PixelFormat);
                var pixels = new byte[w * h * 4];
                converted.CopyPixels(pixels, w * 4, 0);
                System.Runtime.InteropServices.Marshal.Copy(pixels, 0, data.Scan0, pixels.Length);
                bitmap.UnlockBits(data);
                dispose = true;
                return bitmap;
            }

            using var stream = File.OpenRead(path);
            using var temp = Image.FromStream(stream, true, true);
            return new Bitmap(temp);
        }
        catch
        {
            var bitmap = new Bitmap(path);
            dispose = true;
            return bitmap;
        }
    }

    public static Bitmap FrameToRatio(Image source, double ratio, double focusX, double focusY)
    {
        var targetW = source.Width;
        var targetH = (int)Math.Round(source.Width / ratio);
        if (targetH > source.Height)
        {
            targetH = source.Height;
            targetW = (int)Math.Round(source.Height * ratio);
        }

        var sourceRatio = (double)source.Width / source.Height;
        var cropW = source.Width;
        var cropH = source.Height;
        if (sourceRatio > ratio)
        {
            cropW = (int)Math.Round(source.Height * ratio);
            cropH = source.Height;
        }
        else
        {
            cropW = source.Width;
            cropH = (int)Math.Round(source.Width / ratio);
        }

        var offsetX = (int)Math.Round(Math.Clamp((focusX / 100d), 0, 1) * (source.Width - cropW));
        var offsetY = (int)Math.Round(Math.Clamp((focusY / 100d), 0, 1) * (source.Height - cropH));
        var rect = new Rectangle(offsetX, offsetY, Math.Max(1, cropW), Math.Max(1, cropH));

        var output = new Bitmap(targetW, targetH);
        using var graphics = Graphics.FromImage(output);
        graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
        graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
        graphics.SmoothingMode = SmoothingMode.HighQuality;
        graphics.DrawImage(source, new Rectangle(0, 0, targetW, targetH), rect, GraphicsUnit.Pixel);
        return output;
    }

    public static Bitmap Resize(Image source, int width, int height)
    {
        var output = new Bitmap(width, height);
        using var graphics = Graphics.FromImage(output);
        graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
        graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
        graphics.CompositingQuality = CompositingQuality.HighQuality;
        graphics.DrawImage(source, 0, 0, width, height);
        return output;
    }

    public static void SaveJpeg(Bitmap bitmap, string path, long quality)
    {
        var encoder = ImageCodecInfo.GetImageEncoders().First(e => e.FormatID == ImageFormat.Jpeg.Guid);
        using var parameters = new EncoderParameters(1);
        parameters.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, quality);
        bitmap.Save(path, encoder, parameters);
    }

    private static BitmapSource? ExtractIcon(string exePath)
    {
        using var icon = System.Drawing.Icon.ExtractAssociatedIcon(exePath);
        if (icon == null) return null;
        var source = Imaging.CreateBitmapSourceFromHIcon(icon.Handle, Int32Rect.Empty, BitmapSizeOptions.FromEmptyOptions());
        source.Freeze();
        // Try a large icon from the system image list for higher fidelity.
        try
        {
            var large = ShellInterop.GetLargeIcon(exePath);
            if (large != null) return large;
        }
        catch { }
        return source;
    }

    private static Bitmap ToBitmap(BitmapSource source)
    {
        var width = source.PixelWidth;
        var height = source.PixelHeight;
        var stride = width * 4;
        var pixels = new byte[stride * height];
        var converted = new FormatConvertedBitmap(source, PixelFormats.Bgra32, null, 0);
        converted.CopyPixels(pixels, stride, 0);
        var bitmap = new Bitmap(width, height, System.Drawing.Imaging.PixelFormat.Format32bppArgb);
        var data = bitmap.LockBits(new Rectangle(0, 0, width, height), ImageLockMode.WriteOnly, bitmap.PixelFormat);
        System.Runtime.InteropServices.Marshal.Copy(pixels, 0, data.Scan0, pixels.Length);
        bitmap.UnlockBits(data);
        return bitmap;
    }

    /// <summary>
    /// Composes a branded 16:9 key art from an executable icon: a softened,
    /// enlarged copy of the icon becomes an atmospheric backdrop, the crisp
    /// icon sits in the visual centre, and the cover palette tints the frame.
    /// </summary>
    private static Bitmap ComposeIconArt(Bitmap icon)
    {
        const int width = 1920;
        const int height = 1080;
        var canvas = new Bitmap(width, height);
        using var graphics = Graphics.FromImage(canvas);
        graphics.SmoothingMode = SmoothingMode.HighQuality;
        graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
        graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
        graphics.CompositingQuality = CompositingQuality.HighQuality;
        graphics.CompositingMode = CompositingMode.SourceOver;

        using var thumb = Resize(icon, 96, 96);
        var palette = CoverAnalyzer.Analyze(thumb);
        var baseColor = ColorFromHex(palette.Accent);
        var second = ColorFromHex(palette.Accent2);
        var deep = Mix(baseColor, Color.FromArgb(4, 5, 9), .88);

        // Base vertical wash
        using (var back = new LinearGradientBrush(new Rectangle(0, 0, width, height), deep, Color.FromArgb(4, 5, 10), 90f))
        {
            graphics.FillRectangle(back, 0, 0, width, height);
        }

        // Atmospheric blurred icon on the right, honouring the rule that
        // the subject's focal point should not sit under UI chrome.
        using (var ghost = Resize(icon, 900, 900))
        {
            using var attributes = new ImageAttributes();
            attributes.SetColorMatrix(new ColorMatrix { Matrix33 = 0.30f });
            graphics.DrawImage(ghost, new Rectangle(980, 90, 900, 900), 0, 0, ghost.Width, ghost.Height, GraphicsUnit.Pixel, attributes);
        }
        Blur(canvas, new Rectangle(880, 0, 1040, height), 26);

        // Corner colour bleeds
        using (var warm = new GraphicsPath())
        {
            warm.AddEllipse(-420, -320, 1500, 1300);
            using var brush = new PathGradientBrush(warm)
            {
                CenterColor = Color.FromArgb(110, baseColor),
                SurroundColors = new[] { Color.FromArgb(0, baseColor) }
            };
            graphics.FillPath(brush, warm);
        }
        using (var cool = new GraphicsPath())
        {
            cool.AddEllipse(900, 380, 1400, 1200);
            using var brush = new PathGradientBrush(cool)
            {
                CenterColor = Color.FromArgb(72, second),
                SurroundColors = new[] { Color.FromArgb(0, second) }
            };
            graphics.FillPath(brush, cool);
        }

        // Crisp icon with a soft halo, sitting right of the copy column.
        const int iconSize = 300;
        var rect = new Rectangle(width / 2 + 210, (height - iconSize) / 2 + 10, iconSize, iconSize);
        using (var halo = new GraphicsPath())
        {
            halo.AddEllipse(rect.X - 90, rect.Y - 90, iconSize + 180, iconSize + 180);
            using var haloBrush = new PathGradientBrush(halo)
            {
                CenterColor = Color.FromArgb(64, baseColor),
                SurroundColors = new[] { Color.FromArgb(0, baseColor) }
            };
            graphics.FillPath(haloBrush, halo);
        }
        using (var rounded = RoundedIcon(icon, iconSize, 54))
        {
            using var shadowBrush = new SolidBrush(Color.FromArgb(150, 0, 0, 0));
            graphics.FillPath(shadowBrush, RoundedRect(new Rectangle(rect.X + 12, rect.Y + 24, iconSize, iconSize), 54));
            graphics.DrawImage(rounded, rect);

            // Rim light keeps the tile readable on any backdrop.
            var rim = RoundedRect(rect, 54);
            using var rimPen = new Pen(Color.FromArgb(92, 255, 255, 255), 2f);
            graphics.DrawPath(rimPen, rim);
        }

        // Hairline signature under the icon
        using (var pen = new Pen(Color.FromArgb(96, baseColor), 2f))
        {
            graphics.DrawLine(pen, rect.X, rect.Bottom + 30, rect.X + 66, rect.Bottom + 30);
        }

        // Vignette to protect the copy column.
        using (var vignette = new GraphicsPath())
        {
            vignette.AddRectangle(new Rectangle(0, 0, width, height));
            using var brush = new PathGradientBrush(vignette)
            {
                CenterColor = Color.FromArgb(0, 0, 0, 0),
                SurroundColors = new[] { Color.FromArgb(200, 3, 4, 7) }
            };
            graphics.FillPath(brush, vignette);
        }
        return canvas;
    }

    private static GraphicsPath RoundedRect(Rectangle bounds, int radius)
    {
        var path = new GraphicsPath();
        var diameter = Math.Min(radius * 2, Math.Min(bounds.Width, bounds.Height));
        var arc = new Rectangle(bounds.Location, new Size(diameter, diameter));
        path.AddArc(arc, 180, 90);
        arc.X = bounds.Right - diameter;
        path.AddArc(arc, 270, 90);
        arc.Y = bounds.Bottom - diameter;
        path.AddArc(arc, 0, 90);
        arc.X = bounds.Left;
        path.AddArc(arc, 90, 90);
        path.CloseFigure();
        return path;
    }

    /// <summary>Scales the icon into a square and clips it to rounded corners.</summary>
    private static Bitmap RoundedIcon(Bitmap icon, int size, int radius)
    {
        var square = new Bitmap(size, size);
        using (var g = Graphics.FromImage(square))
        {
            g.Clear(Color.Transparent);
            g.SmoothingMode = SmoothingMode.HighQuality;
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            using var path = RoundedRect(new Rectangle(0, 0, size, size), radius);
            g.SetClip(path);
            // Preserve aspect inside the square plate.
            var scale = Math.Min((float)size / icon.Width, (float)size / icon.Height);
            var w = (int)(icon.Width * scale);
            var h = (int)(icon.Height * scale);
            g.DrawImage(icon, (size - w) / 2, (size - h) / 2, w, h);
        }
        return square;
    }

    /// <summary>Fast box blur used for the atmospheric icon backdrop.</summary>
    private static void Blur(Bitmap bitmap, Rectangle area, int radius)
    {
        var bounds = Rectangle.Intersect(area, new Rectangle(0, 0, bitmap.Width, bitmap.Height));
        if (bounds.Width <= 2 || bounds.Height <= 2 || radius <= 0) return;
        using var cropped = bitmap.Clone(bounds, bitmap.PixelFormat);
        using var small = new Bitmap(Math.Max(1, bounds.Width / radius), Math.Max(1, bounds.Height / radius));
        using (var g = Graphics.FromImage(small))
        {
            g.InterpolationMode = InterpolationMode.HighQualityBilinear;
            g.DrawImage(cropped, 0, 0, small.Width, small.Height);
        }
        using (var g = Graphics.FromImage(bitmap))
        {
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.DrawImage(small, bounds);
        }
    }

    private static Color ColorFromHex(string hex)
    {
        try
        {
            var value = hex.TrimStart('#');
            if (value.Length == 8) value = value[2..];
            if (value.Length != 6) return Color.FromArgb(255, 180, 94);
            return Color.FromArgb(
                Convert.ToInt32(value[..2], 16),
                Convert.ToInt32(value.Substring(2, 2), 16),
                Convert.ToInt32(value.Substring(4, 2), 16));
        }
        catch
        {
            return Color.FromArgb(255, 180, 94);
        }
    }

    public static Color Mix(Color a, Color b, double amount)
    {
        amount = Math.Clamp(amount, 0, 1);
        return Color.FromArgb(
            (int)(a.R * (1 - amount) + b.R * amount),
            (int)(a.G * (1 - amount) + b.G * amount),
            (int)(a.B * (1 - amount) + b.B * amount));
    }
}
