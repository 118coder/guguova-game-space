using System.IO;
using Microsoft.Web.WebView2.Wpf;
using NovaGameSpace.Models;

namespace NovaGameSpace.Services;

/// <summary>Lists drives and folders for the in-app file browser so the
/// launcher never has to fall back to the stock Windows file dialog.</summary>
public static class FileBrowser
{
    public sealed record Entry(string Name, string Path, string Kind, long Size, string Modified);

    public static object Drives()
    {
        var list = new List<object>();
        try
        {
            foreach (var drive in DriveInfo.GetDrives())
            {
                try
                {
                    if (!drive.IsReady) continue;
                    var label = string.IsNullOrWhiteSpace(drive.VolumeLabel) ? "本地磁盘" : drive.VolumeLabel;
                    list.Add(new
                    {
                        name = $"{label} ({drive.Name.TrimEnd('\\')})",
                        path = drive.RootDirectory.FullName,
                        free = drive.AvailableFreeSpace,
                        total = drive.TotalSize
                    });
                }
                catch
                {
                    // Some drives (optical, disconnected network) reject queries.
                }
            }
        }
        catch (Exception ex)
        {
            Log.Error("drives", ex);
        }

        if (list.Count == 0)
        {
            list.Add(new { name = "C:", path = @"C:\", free = 0L, total = 0L });
        }
        return list;
    }

    public static object List(string? path, string? filter, bool showHidden)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(path)) path = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            var full = Path.GetFullPath(path);
            if (!Directory.Exists(full)) return new { ok = false, error = "文件夹不存在", path = full };

            var dirs = new List<Entry>();
            var files = new List<Entry>();
            var allowed = ExtensionsFor(filter);

            foreach (var dir in Directory.EnumerateDirectories(full))
            {
                try
                {
                    var info = new DirectoryInfo(dir);
                    if (!showHidden && (info.Attributes & (FileAttributes.Hidden | FileAttributes.System)) != 0) continue;
                    dirs.Add(new Entry(info.Name, info.FullName, "dir", 0, info.LastWriteTime.ToString("yyyy-MM-dd")));
                }
                catch
                {
                    // skip unreadable folder
                }
            }

            foreach (var file in Directory.EnumerateFiles(full))
            {
                try
                {
                    var info = new FileInfo(file);
                    if (!showHidden && (info.Attributes & (FileAttributes.Hidden | FileAttributes.System)) != 0) continue;
                    var ext = info.Extension.ToLowerInvariant();
                    if (allowed != null && !allowed.Contains(ext)) continue;
                    files.Add(new Entry(info.Name, info.FullName, "file", info.Length, info.LastWriteTime.ToString("yyyy-MM-dd")));
                }
                catch
                {
                    // skip unreadable file
                }
            }

            dirs.Sort((a, b) => string.Compare(a.Name, b.Name, StringComparison.CurrentCultureIgnoreCase));
            files.Sort((a, b) => string.Compare(a.Name, b.Name, StringComparison.CurrentCultureIgnoreCase));

            var parent = Directory.GetParent(full)?.FullName;
            return new
            {
                ok = true,
                path = full,
                parent,
                drives = Drives(),
                dirs,
                files,
                error = (string?)null
            };
        }
        catch (Exception ex)
        {
            Log.Error("browse", ex);
            return new { ok = false, error = ex.Message, path, dirs = Array.Empty<Entry>(), files = Array.Empty<Entry>() };
        }
    }

    private static HashSet<string>? ExtensionsFor(string? filter) => filter switch
    {
        "exe" => new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".exe", ".bat", ".cmd", ".lnk", ".url" },
        "image" => new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif" },
        "manifest" => new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".json" },
        _ => null
    };
}
