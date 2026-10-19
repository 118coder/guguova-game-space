using System.IO;
using System.IO.Compression;
using System.Reflection;

namespace NovaGameSpace.Services;

/// <summary>
/// Single-exe support: src/ and themes/ are embedded as a zip. On first run
/// (or version change) they are extracted to the user data folder and served
/// from there. A full package that ships src/ and themes/ next to the exe
/// takes precedence, so themes remain directly editable.
/// </summary>
public static class AssetBootstrapper
{
    public static void Ensure()
    {
        var baseDir = AppContext.BaseDirectory;
        var externalSrc = Path.Combine(baseDir, "src");
        var externalThemes = Path.Combine(baseDir, "themes");
        if (File.Exists(Path.Combine(externalSrc, "index.html")) && Directory.Exists(externalThemes))
        {
            AppPaths.WebRoot = externalSrc;
            AppPaths.BundledThemes = externalThemes;
            return;
        }

        var version = typeof(AssetBootstrapper).Assembly.GetName().Version?.ToString(3) ?? "1.0.0";
        var root = Path.Combine(AppPaths.Root, "runtime", version, "assets");
        var marker = Path.Combine(root, ".complete");
        if (!File.Exists(marker))
        {
            Directory.CreateDirectory(root);
            Extract(root);
            File.WriteAllText(marker, DateTime.UtcNow.ToString("o"));
        }
        AppPaths.WebRoot = Path.Combine(root, "src");
        AppPaths.BundledThemes = Path.Combine(root, "themes");
    }

    private static void Extract(string destination)
    {
        using var stream = typeof(AssetBootstrapper).Assembly.GetManifestResourceStream("NOVA.Assets.zip");
        if (stream == null) throw new FileNotFoundException("missing embedded assets (NOVA.Assets.zip)");
        var root = Path.GetFullPath(destination) + Path.DirectorySeparatorChar;
        using var archive = new ZipArchive(stream, ZipArchiveMode.Read);
        foreach (var entry in archive.Entries)
        {
            var target = Path.GetFullPath(Path.Combine(destination, entry.FullName));
            if (!target.StartsWith(root, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("embedded assets contain an invalid path");
            if (string.IsNullOrEmpty(entry.Name))
            {
                Directory.CreateDirectory(target);
                continue;
            }
            Directory.CreateDirectory(Path.GetDirectoryName(target)!);
            entry.ExtractToFile(target, true);
        }
    }
}
