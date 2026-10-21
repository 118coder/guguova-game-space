using System.IO;
using System.IO.Compression;

namespace NovaGameSpace.Services;

/// <summary>
/// Single-exe support for the bundled Magpie engine.
///
/// Magpie is GPLv3 and must keep running as its own process: the launcher only
/// starts it and never links to it. The single-exe package embeds the engine
/// folder as a zip and extracts it once into the user data folder, so a player
/// can download one file and still get the full effect set.
///
/// A folder package that already ships engine/magpie/ takes precedence, which
/// keeps the portable folder build (and the GPL "replace it yourself" path)
/// working exactly as before.
/// </summary>
public static class EngineBootstrapper
{
    private const string ResourceName = "NOVA.Engine.zip";

    /// <summary>Resolved engine directory, or null when this host has no
    /// bundled engine (dev build without third_party/magpie).</summary>
    public static string? Ensure()
    {
        var external = Path.Combine(AppContext.BaseDirectory, "engine", "magpie");
        if (File.Exists(Path.Combine(external, "Magpie.exe")))
        {
            ScalingEngine.BundledDirOverride = external;
            return external;
        }

        var assembly = typeof(EngineBootstrapper).Assembly;
        if (assembly.GetManifestResourceInfo(ResourceName) == null)
            return null;

        var version = assembly.GetName().Version?.ToString(3) ?? "1.0.0";
        var root = Path.Combine(AppPaths.Root, "runtime", version, "engine", "magpie");
        var marker = Path.Combine(root, ".complete");
        if (!File.Exists(marker))
        {
            Directory.CreateDirectory(root);
            Extract(root);
            File.WriteAllText(marker, DateTime.UtcNow.ToString("o"));
        }

        ScalingEngine.BundledDirOverride = root;
        return root;
    }

    private static void Extract(string destination)
    {
        using var stream = typeof(EngineBootstrapper).Assembly.GetManifestResourceStream(ResourceName);
        if (stream == null) throw new FileNotFoundException("missing embedded " + ResourceName);
        var root = Path.GetFullPath(destination) + Path.DirectorySeparatorChar;
        using var archive = new ZipArchive(stream, ZipArchiveMode.Read);
        foreach (var entry in archive.Entries)
        {
            var target = Path.GetFullPath(Path.Combine(destination, entry.FullName));
            if (!target.StartsWith(root, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("embedded engine contains an invalid path");
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
