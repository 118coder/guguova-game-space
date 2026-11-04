using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Security.Cryptography;

namespace NovaGameSpace.Services;

/// <summary>
/// Single-exe support: src/ and themes/ are embedded as a zip. On first run
/// (or version change) they are extracted to the user data folder and served
/// from there. A full package that ships src/ and themes/ next to the exe
/// takes precedence, so themes remain directly editable.
///
/// The extraction directory is keyed by version AND a content stamp of the
/// embedded zip: re-releasing the same version number with different content
/// (the collapse of two same-day releases did exactly that) must not keep
/// serving the previous extraction.
/// </summary>
public static class AssetBootstrapper
{
    /// <summary>Short hash of the embedded assets zip, or "" when the assets
    /// are served from a folder next to the exe. The renderer cache reset in
    /// MainWindow folds this into its marker for the same reason.</summary>
    public static string ContentStamp { get; private set; } = "";

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
        var stamp = StampEmbeddedZip("NOVA.Assets.zip");
        ContentStamp = stamp;
        var key = $"{version}-{stamp}";
        var root = Path.Combine(AppPaths.Root, "runtime", key, "assets");
        var marker = Path.Combine(root, ".complete");
        if (!File.Exists(marker))
        {
            Directory.CreateDirectory(root);
            Extract(root);
            File.WriteAllText(marker, DateTime.UtcNow.ToString("o"));
            CleanupSiblings(version, key);
        }
        AppPaths.WebRoot = Path.Combine(root, "src");
        AppPaths.BundledThemes = Path.Combine(root, "themes");
    }

    /// <summary>First 10 hex chars of the embedded zip's SHA-256, or "" when
    /// the resource is missing (the caller throws in that case).</summary>
    public static string StampEmbeddedZip(string resourceName)
    {
        using var stream = typeof(AssetBootstrapper).Assembly.GetManifestResourceStream(resourceName);
        if (stream == null) return "";
        using var sha = SHA256.Create();
        var hash = sha.ComputeHash(stream);
        // net48 has no Convert.ToHexString; the builder is the shared form.
        var builder = new System.Text.StringBuilder(hash.Length * 2);
        foreach (var b in hash) builder.Append(b.ToString("x2"));
        return builder.ToString(0, 10);
    }

    /// <summary>Removes sibling extractions of the SAME version that were
    /// stamped by other content — the reuse-the-number case. Other versions'
    /// directories stay (they belong to other installs).</summary>
    private static void CleanupSiblings(string version, string keepKey)
    {
        try
        {
            var runtimeRoot = Path.Combine(AppPaths.Root, "runtime");
            if (!Directory.Exists(runtimeRoot)) return;
            var prefix = version + "-";
            foreach (var dir in Directory.GetDirectories(runtimeRoot, prefix + "*"))
            {
                if (Path.GetFileName(dir) == keepKey) continue;
                Directory.Delete(dir, true);
            }
        }
        catch
        {
            // A locked directory is not fatal; the next launch retries.
        }
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
