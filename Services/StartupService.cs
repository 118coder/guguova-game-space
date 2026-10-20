using System.Diagnostics;
using System.IO;
using Microsoft.Win32;

namespace NovaGameSpace.Services;

/// <summary>
/// "Start with Windows" is a per-user Run key, not a scheduled task or a
/// service: no elevation, no extra process, and it is trivially reversible.
/// The recorded command points at the current executable, so a moved folder
/// simply re-registers on the next toggle or launch.
/// </summary>
public static class StartupService
{
    private const string RunKey = @"Software\Microsoft\Windows\CurrentVersion\Run";
    private const string ValueName = "GUGUOVA";

    public sealed record State(bool Enabled, bool PointsHere, string? Command, string? ExePath);

    public static string? CurrentExe()
    {
        try
        {
            var path = Process.GetCurrentProcess().MainModule?.FileName;
            return string.IsNullOrWhiteSpace(path) ? null : Path.GetFullPath(path);
        }
        catch
        {
            return null;
        }
    }

    public static State Inspect()
    {
        var exe = CurrentExe();
        string? command = null;
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(RunKey);
            command = key?.GetValue(ValueName) as string;
        }
        catch (Exception ex)
        {
            Log.Error("read startup entry", ex);
        }

        var pointsHere = !string.IsNullOrWhiteSpace(command) && !string.IsNullOrWhiteSpace(exe) &&
                         command!.IndexOf(exe!, StringComparison.OrdinalIgnoreCase) >= 0;
        return new State(!string.IsNullOrWhiteSpace(command), pointsHere, command, exe);
    }

    public static bool Enable(out string? error)
    {
        error = null;
        var exe = CurrentExe();
        if (string.IsNullOrWhiteSpace(exe))
        {
            error = "无法定位当前程序路径";
            return false;
        }

        try
        {
            using var key = Registry.CurrentUser.CreateSubKey(RunKey, true);
            if (key == null)
            {
                error = "无法写入启动项注册表";
                return false;
            }
            key.SetValue(ValueName, $"\"{exe}\" --startup", RegistryValueKind.String);
            Log.Write($"startup enabled: {exe}");
            return true;
        }
        catch (Exception ex)
        {
            Log.Error("enable startup", ex);
            error = ex.Message;
            return false;
        }
    }

    public static bool Disable(out string? error)
    {
        error = null;
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(RunKey, true);
            if (key != null && key.GetValue(ValueName) != null)
                key.DeleteValue(ValueName, false);
            Log.Write("startup disabled");
            return true;
        }
        catch (Exception ex)
        {
            Log.Error("disable startup", ex);
            error = ex.Message;
            return false;
        }
    }

    /// <summary>Re-points an existing entry after the app moves. Silent: if the
    /// player never enabled it, nothing happens.</summary>
    public static void RefreshIfEnabled()
    {
        var state = Inspect();
        if (state.Enabled && !state.PointsHere) Enable(out _);
    }
}
