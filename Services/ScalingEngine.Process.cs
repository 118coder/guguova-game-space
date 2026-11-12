// 缩放引擎进程管理：启动、隐藏主窗口、退出/重启与 Win32 互操作声明。
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
       Start / stop / hide
       ------------------------------------------------------------------ */

    /// <summary>Starts the engine when a launch asks for scaling. Returns false
    /// when there is no engine or the player turned auto-start off.</summary>
    public static bool EnsureRunning(PlayerSettings settings, bool force, out Status status)
    {
        var exe = FindExe(settings);
        if (IsRunning())
        {
            status = Inspect(settings);
            return true;
        }

        if (!Supported || string.IsNullOrWhiteSpace(exe) || (!force && !settings.AutoStartEngine))
        {
            status = Inspect(settings);
            return false;
        }

        var configBefore = ActiveConfigFile();
        if (configBefore != null && settings.ScalingHotkey > 0 &&
            ReadHotkey() != settings.ScalingHotkey)
        {
            // Not running yet: write the shortcut so the new process registers
            // the same key the player picked in the launcher.
            WriteHotkey(settings.ScalingHotkey, out _);
        }

        if (!StartProcess(exe, out var error))
        {
            status = Inspect(settings) with { Note = "启动缩放引擎失败：" + error };
            return false;
        }

        // A first run creates the config with Magpie's defaults. If the player
        // chose something else, write it and restart once.
        if (configBefore == null)
        {
            var deadline = DateTime.UtcNow.AddSeconds(6);
            while (DateTime.UtcNow < deadline && ActiveConfigFile() == null) Thread.Sleep(250);
            if (ActiveConfigFile() != null)
            {
                SeedFirstRunConfig();
                if (settings.ScalingHotkey > 0 && ReadHotkey() != settings.ScalingHotkey)
                {
                    WriteHotkey(settings.ScalingHotkey, out _);
                    Restart(settings, out _);
                }
            }
        }

        status = Inspect(settings);
        return status.Running;
    }

    private static bool StartProcess(string exe, out string? error)
    {
        error = null;
        try
        {
            var process = Process.Start(new ProcessStartInfo
            {
                FileName = exe,
                WorkingDirectory = Path.GetDirectoryName(exe),
                UseShellExecute = false
            });
            if (process == null)
            {
                error = "系统没有返回进程信息";
                return false;
            }

            _startedByUs = true;
            var pid = process.Id;
            var deadline = DateTime.UtcNow.AddSeconds(15);
            while (DateTime.UtcNow < deadline && !IsRunning()) Thread.Sleep(200);
            Thread.Sleep(900);
            HideMainWindow(pid);

            // 权限一致性：CreateProcess 语义下子进程直接继承本进程令牌，玩家
            // 以管理员运行启动器时 Magpie 必须也是管理员，否则抓不到提权游戏
            // 的窗口（UIPI）。这里实测并留证，不符就明确报错而不是静默失效。
            var engineElevated = SteamPrivilege.IsProcessElevated(pid);
            var launcherElevated = SteamPrivilege.LauncherIsElevated();
            Log.Write($"scaling engine started pid={pid} launcherElevated={launcherElevated} engineElevated={engineElevated}");
            if (launcherElevated && !engineElevated)
                Log.Error("scaling engine elevation", new InvalidOperationException("启动器是管理员但引擎没有继承提权，提权游戏将无法被缩放"));

            return true;
        }
        catch (Exception ex)
        {
            Log.Error("start scaling engine", ex);
            error = ex.Message;
            return false;
        }
    }

    /// <summary>Closes Magpie's settings window. With the tray icon enabled the
    /// process stays alive and keeps its hotkeys; otherwise it is minimized.</summary>
    private static void HideMainWindow(int pid)
    {
        try
        {
            IntPtr window = IntPtr.Zero;
            var deadline = DateTime.UtcNow.AddSeconds(8);
            while (DateTime.UtcNow < deadline && window == IntPtr.Zero)
            {
                window = FindMainWindow(pid);
                if (window == IntPtr.Zero) Thread.Sleep(250);
            }
            if (window == IntPtr.Zero) return;

            if (ShowNotifyIcon())
            {
                PostMessage(window, WmClose, IntPtr.Zero, IntPtr.Zero);
                Thread.Sleep(700);
                if (IsWindowVisible(window)) ShowWindow(window, SwMinimize);
                return;
            }

            ShowWindow(window, SwMinimize);
            Thread.Sleep(400);
            if (IsWindowVisible(window) && IsIconic(window))
            {
                // Minimized but still on screen? Nothing else to do.
                return;
            }
        }
        catch (Exception ex)
        {
            Log.Error("hide magpie window", ex);
        }
    }

    private static IntPtr FindMainWindow(int pid)
    {
        var best = IntPtr.Zero;
        long bestArea = 0;
        EnumWindows((window, _) =>
        {
            uint owner;
            GetWindowThreadProcessId(window, out owner);
            if (owner != (uint)pid) return true;
            if (!IsWindowVisible(window)) return true;
            if (GetWindowTextLength(window) == 0) return true;
            var className = GetClassNameText(window);
            if (className == MagpieWindowClass) return true;
            if (!GetWindowRectA(window, out var rect)) return true;
            var area = (long)(rect.Right - rect.Left) * (rect.Bottom - rect.Top);
            if (area > bestArea) { bestArea = area; best = window; }
            return true;
        }, IntPtr.Zero);
        return best;
    }

    /// <summary>Shuts the engine down only when NOVA started it for a game.
    /// A player-run Magpie (or one started from the settings button) stays.</summary>
    public static void ReleaseIfAutoStarted()
    {
        lock (Gate)
        {
            if (!_startedByUs) return;
            _startedByUs = false;
        }
        if (IsRunning())
        {
            Log.Write("scaling engine released (auto-started, no game running)");
            Quit();
        }
    }

    public static bool Quit()
    {
        if (!IsRunning()) return true;
        try
        {
            var message = RegisterWindowMessage("WM_MAGPIE_QUIT");
            if (message != 0) PostMessage(HwndBroadcast, unchecked((int)message), IntPtr.Zero, IntPtr.Zero);
        }
        catch (Exception ex)
        {
            Log.Error("quit magpie", ex);
        }

        var deadline = DateTime.UtcNow.AddSeconds(10);
        while (DateTime.UtcNow < deadline && IsRunning()) Thread.Sleep(300);
        return !IsRunning();
    }

    public static bool Restart(PlayerSettings settings, out string message)
    {
        if (!Quit())
        {
            message = "缩放引擎没有响应退出请求；请从托盘退出 Magpie 后重试";
            return false;
        }

        Thread.Sleep(700);
        var exe = FindExe(settings);
        if (string.IsNullOrWhiteSpace(exe) || !File.Exists(exe))
        {
            message = "没有找到缩放引擎";
            return false;
        }

        if (!StartProcess(exe, out var error))
        {
            message = "无法重新启动缩放引擎：" + error;
            return false;
        }

        message = "缩放引擎已重新启动";
        return true;
    }

    private static bool ShowNotifyIcon()
    {
        var file = ActiveConfigFile();
        if (file == null) return true;
        try
        {
            using var document = JsonDocument.Parse(File.ReadAllText(file));
            return !document.RootElement.TryGetProperty("showNotifyIcon", out var value) ||
                   value.ValueKind != JsonValueKind.False;
        }
        catch
        {
            return true;
        }
    }

    /// <summary>Brings Magpie's own window forward (or starts it visibly).</summary>
    public static bool Show(PlayerSettings settings, out string message)
    {
        if (IsRunning())
        {
            try
            {
                var id = RegisterWindowMessage("WM_MAGPIE_SHOWME");
                if (id != 0) PostMessage(HwndBroadcast, unchecked((int)id), IntPtr.Zero, IntPtr.Zero);
                message = "已打开完整 Magpie";
                return true;
            }
            catch (Exception ex)
            {
                Log.Error("show magpie", ex);
                message = ex.Message;
                return false;
            }
        }

        var exe = FindExe(settings);
        if (string.IsNullOrWhiteSpace(exe) || !File.Exists(exe))
        {
            message = "没有找到缩放引擎";
            return false;
        }

        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = exe,
                WorkingDirectory = Path.GetDirectoryName(exe),
                UseShellExecute = true
            });
            message = "正在打开完整 Magpie";
            return true;
        }
        catch (Exception ex)
        {
            Log.Error("open magpie", ex);
            message = ex.Message;
            return false;
        }
    }

    /* ------------------------------------------------------------------
       Win32
       ------------------------------------------------------------------ */

    private delegate bool EnumWindowsProc(IntPtr window, IntPtr state);

    [StructLayout(LayoutKind.Sequential)]
    private struct Rect
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr state);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr window, out uint pid);

    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr window);

    [DllImport("user32.dll")]
    private static extern bool IsIconic(IntPtr window);

    [DllImport("user32.dll")]
    private static extern bool ShowWindow(IntPtr window, int command);

    [DllImport("user32.dll")]
    private static extern bool GetWindowRect(IntPtr window, out Rect rect);

    [DllImport("user32.dll")]
    private static extern int GetWindowTextLength(IntPtr window);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr window, System.Text.StringBuilder text, int max);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetClassName(IntPtr window, System.Text.StringBuilder text, int max);

    [DllImport("user32.dll")]
    private static extern bool PostMessage(IntPtr window, int message, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern uint RegisterWindowMessage(string name);

    private static bool GetWindowRectA(IntPtr window, out Rect rect) => GetWindowRect(window, out rect);

    private static string GetClassNameText(IntPtr window)
    {
        var builder = new System.Text.StringBuilder(256);
        GetClassName(window, builder, builder.Capacity);
        return builder.ToString();
    }
}
