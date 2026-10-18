using System.Drawing;
using System.Drawing.Imaging;

namespace NovaGameSpace.Services;

public sealed class CoverAnalysis
{
    public string Accent { get; init; } = "#ffb45e";
    public string Accent2 { get; init; } = "#ff6b79";
    public string Light { get; init; } = "#f3e3c3";
    public string Dark { get; init; } = "#251318";
    public double Luma { get; init; } = .3;
    public double Saturation { get; init; } = .5;
    public double Warmth { get; init; } = .5;
    public double Edge { get; init; } = .1;
    public string Glow { get; init; } = "rgba(255, 172, 96, .32)";
    public string Scrim { get; init; } = "20, 11, 9";
    public string[] Colors { get; init; } = Array.Empty<string>();
}

/// <summary>
/// The NOVA title director depends on a small "cover DNA" fingerprint.
/// This samples luminance, saturation, warmth, edge density and extracts a
/// palette so real user artwork drives the interface.
/// </summary>
public static class CoverAnalyzer
{
    public static CoverAnalysis Analyze(Bitmap bitmap)
    {
        var width = bitmap.Width;
        var height = bitmap.Height;
        var pixels = new double[width * height];
        var hueBucketCounts = new double[24];
        var hueBucketSat = new double[24];
        var hueBucketVal = new double[24];
        var sumR = 0d;
        var sumG = 0d;
        var sumB = 0d;
        var sumLuma = 0d;
        var sumSat = 0d;
        var count = width * height;

        var rect = new Rectangle(0, 0, width, height);
        var data = bitmap.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        try
        {
            var buffer = new byte[Math.Abs(data.Stride) * height];
            System.Runtime.InteropServices.Marshal.Copy(data.Scan0, buffer, 0, buffer.Length);
            var stride = Math.Abs(data.Stride);
            for (var y = 0; y < height; y++)
            {
                for (var x = 0; x < width; x++)
                {
                    var index = y * stride + x * 4;
                    var b = buffer[index];
                    var g = buffer[index + 1];
                    var r = buffer[index + 2];
                    sumR += r; sumG += g; sumB += b;

                    var max = Math.Max(r, Math.Max(g, b));
                    var min = Math.Min(r, Math.Min(g, b));
                    var delta = max - min;
                    var value = max / 255d;
                    var sat = max == 0 ? 0 : delta / (double)max;
                    var luma = (.2126 * r + .7152 * g + .0722 * b) / 255d;
                    sumLuma += luma;
                    sumSat += sat;
                    pixels[y * width + x] = luma;

                    if (sat > .18 && value > .16)
                    {
                        double hue;
                        if (delta == 0) hue = 0;
                        else if (max == r) hue = 60 * (((g - b) / (double)delta) % 6);
                        else if (max == g) hue = 60 * ((b - r) / (double)delta + 2);
                        else hue = 60 * ((r - g) / (double)delta + 4);
                        if (hue < 0) hue += 360;
                        var bucket = (int)(hue / 15) % 24;
                        var weight = sat * value;
                        hueBucketCounts[bucket] += weight;
                        hueBucketSat[bucket] += sat * weight;
                        hueBucketVal[bucket] += value * weight;
                    }
                }
            }
        }
        finally
        {
            bitmap.UnlockBits(data);
        }

        var edge = EdgeDensity(pixels, width, height);
        var avgR = sumR / count / 255d;
        var avgG = sumG / count / 255d;
        var avgB = sumB / count / 255d;
        var warmth = Math.Clamp(0.5 + (avgR - avgB) * 0.9, 0, 1);

        // Dominant hues: pick strongest coloured bucket, then a complementary
        // or adjacent bucket with enough presence.
        var bucketOrder = Enumerable.Range(0, 24)
            .OrderByDescending(i => hueBucketCounts[i])
            .ToList();
        var primary = bucketOrder[0];
        var secondary = bucketOrder.FirstOrDefault(i => Math.Abs(CircularDistance(i, primary)) > 3, bucketOrder[1 % 24]);

        var primaryHue = (primary * 15 + 7.5) % 360;
        var primarySat = hueBucketCounts[primary] > 0.0001
            ? Math.Clamp(hueBucketSat[primary] / hueBucketCounts[primary], .32, .82)
            : .5;
        var primaryVal = hueBucketCounts[primary] > 0.0001
            ? Math.Clamp(hueBucketVal[primary] / hueBucketCounts[primary], .55, .95)
            : .7;

        var accent = HsvToHex(primaryHue, primarySat, primaryVal);
        string accent2;
        if (hueBucketCounts[secondary] > 0.0001)
        {
            var secondaryHue = (secondary * 15 + 7.5) % 360;
            var secondarySat = Math.Clamp(hueBucketSat[secondary] / hueBucketCounts[secondary], .38, .8);
            var secondaryVal = Math.Clamp(hueBucketVal[secondary] / hueBucketCounts[secondary], .55, .9);
            accent2 = HsvToHex(secondaryHue, secondarySat, secondaryVal);
        }
        else
        {
            accent2 = HsvToHex((primaryHue + 32) % 360, primarySat * .9, Math.Min(1, primaryVal * .96));
        }

        var avgLuma = sumLuma / count;
        var avgSat = sumSat / count;
        var lightSource = HsvToHex(primaryHue, Math.Clamp(avgSat * .45, .1, .4), .95);
        if (avgLuma > .62) lightSource = "#f6f1e6";
        var darkSource = HsvToHex(primaryHue, Math.Clamp(primarySat * .55, .28, .72), Math.Clamp(primaryVal * .24, .08, .25));

        var accentRgb = ParseRgb(accent);
        var scrim = $"{Math.Clamp(accentRgb.r / 9, 4, 30)}, {Math.Clamp(accentRgb.g / 9, 3, 26)}, {Math.Clamp(accentRgb.b / 9, 3, 30)}";

        return new CoverAnalysis
        {
            Accent = accent,
            Accent2 = accent2,
            Light = lightSource,
            Dark = darkSource,
            Luma = Math.Round(avgLuma, 3),
            Saturation = Math.Round(avgSat, 3),
            Warmth = Math.Round(warmth, 3),
            Edge = Math.Round(edge, 3),
            Glow = $"rgba({accentRgb.r}, {accentRgb.g}, {accentRgb.b}, .32)",
            Scrim = scrim,
            Colors = new[] { accent, accent2, lightSource, darkSource }
        };
    }

    private static double CircularDistance(int a, int b)
    {
        var diff = Math.Abs(a - b);
        return Math.Min(diff, 24 - diff);
    }

    private static double EdgeDensity(double[] pixels, int width, int height)
    {
        if (width < 3 || height < 3) return 0;
        var total = 0d;
        var samples = 0;
        for (var y = 1; y < height - 1; y += 2)
        {
            for (var x = 1; x < width - 1; x += 2)
            {
                var center = pixels[y * width + x];
                var dx = Math.Abs(center - pixels[y * width + x + 1]);
                var dy = Math.Abs(center - pixels[(y + 1) * width + x]);
                if (dx + dy > .12) total += 1;
                samples++;
            }
        }
        return samples == 0 ? 0 : total / samples;
    }

    private static string HsvToHex(double hue, double sat, double val)
    {
        hue = ((hue % 360) + 360) % 360;
        var c = val * sat;
        var x = c * (1 - Math.Abs((hue / 60) % 2 - 1));
        var m = val - c;
        double r, g, b;
        if (hue < 60) (r, g, b) = (c, x, 0);
        else if (hue < 120) (r, g, b) = (x, c, 0);
        else if (hue < 180) (r, g, b) = (0, c, x);
        else if (hue < 240) (r, g, b) = (0, x, c);
        else if (hue < 300) (r, g, b) = (x, 0, c);
        else (r, g, b) = (c, 0, x);
        return $"#{ToByte(r + m):x2}{ToByte(g + m):x2}{ToByte(b + m):x2}";
    }

    private static int ToByte(double v) => Math.Clamp((int)Math.Round(v * 255), 0, 255);

    private static (int r, int g, int b) ParseRgb(string hex)
    {
        try
        {
            var value = hex.TrimStart('#');
            return (Convert.ToInt32(value[..2], 16), Convert.ToInt32(value.Substring(2, 2), 16), Convert.ToInt32(value.Substring(4, 2), 16));
        }
        catch
        {
            return (255, 172, 96);
        }
    }
}
