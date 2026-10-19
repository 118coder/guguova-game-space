using System.IO;
using System.IO.Compression;

#if NETFRAMEWORK
namespace System.Runtime.CompilerServices
{
    // C# records / init setters need this marker on .NET Framework.
    internal static class IsExternalInit { }
}
#endif

namespace NovaGameSpace.Services;

/// <summary>Small helpers shared by the modern and the .NET Framework hosts.</summary>
public static class CompatUtil
{
    public static string RelativePath(string root, string path)
    {
        var rootFull = Path.GetFullPath(root)
            .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar;
        var full = Path.GetFullPath(path);
        if (full.StartsWith(rootFull, StringComparison.OrdinalIgnoreCase))
            return full.Substring(rootFull.Length);
        return Path.GetFileName(path);
    }

    /// <summary>Zip extraction with a zip-slip guard; works on net48.</summary>
    public static void ExtractZip(string zipPath, string destination)
    {
        var root = Path.GetFullPath(destination) + Path.DirectorySeparatorChar;
        Directory.CreateDirectory(destination);
        using var archive = ZipFile.OpenRead(zipPath);
        foreach (var entry in archive.Entries)
        {
            var target = Path.GetFullPath(Path.Combine(destination, entry.FullName));
            if (!target.StartsWith(root, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("压缩包包含非法路径");
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
