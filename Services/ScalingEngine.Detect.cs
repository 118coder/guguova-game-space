// 缩放引擎探测：定位 Magpie 安装位置、识别内置引擎并生成状态报告。
// ScalingEngine 的 partial 领域分片之一，见 Services/ScalingEngine.cs 主文件。

using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading;
using Microsoft.Win32;
using NovaGameSpace.Models;

namespace NovaGameSpace.Services;

public static partial class ScalingEngine
{
    /* ------------------------------------------------------------------
       Detection
       ------------------------------------------------------------------ */

    public static bool Supported => Environment.OSVersion.Platform == PlatformID.Win32NT &&
                                    Environment.OSVersion.Version.Major >= 10;

    public static bool IsRunning()
    {
        var processes = Process.GetProcessesByName("Magpie");
        foreach (var process in processes) process.Dispose();
        return processes.Length > 0;
    }

    public static string? RunningExe()
    {
        try
        {
            foreach (var process in Process.GetProcessesByName("Magpie"))
            {
                using (process)
                {
                    try
                    {
                        var path = process.MainModule?.FileName;
                        if (!string.IsNullOrWhiteSpace(path)) return path;
                    }
                    catch { }
                }
            }
        }
        catch { }
        return null;
    }

    public static Status Inspect(PlayerSettings settings)
    {
        var exe = FindExe(settings);
        var running = IsRunning();
        var bundled = exe != null && IsBundledPath(exe);
        var hotkey = ReadHotkey();

        if (!Supported)
            return new Status(false, exe, running, bundled, hotkey, false,
                "Magpie 需要 Windows 10 1903 或更新版本；这台机器会用无边框全屏");
        if (string.IsNullOrWhiteSpace(exe))
            return new Status(false, null, running, false, hotkey, true,
                "没有找到缩放引擎；会用好内置的无边框全屏");

        var note = running
            ? (bundled ? "内置引擎正在运行" : "系统 Magpie 正在运行")
            : (bundled
                ? (settings.AutoStartEngine
                    ? "内置引擎已就绪，启动游戏时会自动打开"
                    : "内置引擎已就绪；随游戏自动启动已关闭")
                : (settings.AutoStartEngine
                    ? "已找到系统 Magpie；启动游戏时会自动打开"
                    : "已找到系统 Magpie；随游戏自动启动已关闭"));
        return new Status(true, exe, running, bundled, hotkey, true, note);
    }

    public static string? FindExe(PlayerSettings settings)
    {
        if (!string.IsNullOrWhiteSpace(settings.MagpiePath) && File.Exists(settings.MagpiePath))
            return settings.MagpiePath;

        var running = RunningExe();
        if (!string.IsNullOrWhiteSpace(running)) return running;

        if (BundledAvailable) return BundledExe;

        lock (Gate)
        {
            if ((DateTime.UtcNow - _lookup.At).TotalSeconds < 30) return _lookup.Exe;
        }

        var found = FindInRegistry();
        if (string.IsNullOrWhiteSpace(found)) found = FindInCommonFolders();
        lock (Gate) _lookup = (DateTime.UtcNow, found);
        return found;
    }

    private static bool IsBundledPath(string path)
    {
        try
        {
            var full = Path.GetFullPath(path);
            var root = Path.GetFullPath(BundledDir)
                .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar;
            return full.StartsWith(root, StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            return false;
        }
    }

    private static string? FindInRegistry()
    {
        foreach (var root in new[]
        {
            @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
            @"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
        })
        {
            var found = FindInUninstall(Registry.CurrentUser, root) ?? FindInUninstall(Registry.LocalMachine, root);
            if (!string.IsNullOrWhiteSpace(found)) return found;
        }
        return null;
    }

    private static string? FindInUninstall(RegistryKey root, string path)
    {
        try
        {
            using var uninstall = root.OpenSubKey(path);
            if (uninstall == null) return null;
            foreach (var name in uninstall.GetSubKeyNames())
            {
                using var entry = uninstall.OpenSubKey(name);
                if (entry == null) continue;
                var display = entry.GetValue("DisplayName") as string;
                if (string.IsNullOrWhiteSpace(display) || display.IndexOf("Magpie", StringComparison.OrdinalIgnoreCase) < 0) continue;

                var icon = CleanExecutablePath(entry.GetValue("DisplayIcon") as string);
                if (icon != null && File.Exists(icon)) return icon;

                var folder = entry.GetValue("InstallLocation") as string;
                if (!string.IsNullOrWhiteSpace(folder))
                {
                    var exe = Path.Combine(folder.Trim('"'), "Magpie.exe");
                    if (File.Exists(exe)) return exe;
                }
            }
        }
        catch { }
        return null;
    }

    private static string? FindInCommonFolders()
    {
        var local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        var programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        var programFilesX86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
        foreach (var candidate in new[]
        {
            Path.Combine(local, "Magpie", "Magpie.exe"),
            Path.Combine(local, "Programs", "Magpie", "Magpie.exe"),
            Path.Combine(programFiles, "Magpie", "Magpie.exe"),
            Path.Combine(programFilesX86, "Magpie", "Magpie.exe")
        })
        {
            if (File.Exists(candidate)) return candidate;
        }
        return null;
    }

    private static string? CleanExecutablePath(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var text = value.Trim().Trim('"');
        var comma = text.LastIndexOf(',');
        if (comma > 0) text = text.Substring(0, comma).Trim().Trim('"');
        return text;
    }
}
