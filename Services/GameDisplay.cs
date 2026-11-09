using System.Diagnostics;
using System.IO;
using System.Threading;
using NovaGameSpace.Models;

namespace NovaGameSpace.Services;

/// <summary>
/// Puts the game's real window in front of the launcher and, when asked, fills
/// the monitor with it. Two paths are supported:
///
/// * native: remove the window frame and resize it to the monitor, which every
///   windowed game understands;
/// * Magpie: if the upscaler is already running, send its configured hotkey to
///   the focused game window. Magpie's documented interface is one-way (state
///   notifications and window properties), so the hotkey/profile it already
///   owns stays the trigger. If Magpie is absent or refuses, native is used.
///
/// The service never waits on the UI thread and never touches windows that the
/// game process does not own.
/// </summary>
public static class GameDisplay
{
    public sealed record Result(
        bool WindowFound,
        bool Scaled,
        bool Foreground,
        string Engine,
        string? Error,
        long Handle);

    private const string MagpieWindowClass = "Window_Magpie_967EB565-6F73-4E94-AE53-00CC42592A22";
    private const string MagpieSrcProperty = "Magpie.SrcHWND";
    private const uint MonitorDefaultToNearest = 2;

    private const uint Th32csSnapprocess = 0x00000002;
    private const int MaxFamilyDepth = 3;
    private const int MaxFamilySize = 64;

    private const int GwlStyle = -16;
    private const int GwlExStyle = -20;

    private const long WsCaption = 0x00C00000L;
    private const long WsPopup = unchecked((long)0x80000000L);
    private const long WsThickFrame = 0x00040000L;
    private const long WsMinimizeBox = 0x00020000L;
    private const long WsMaximizeBox = 0x00010000L;
    private const long WsSysMenu = 0x00080000L;
    private const long WsExToolWindow = 0x00000080L;
    private const long WsExNoActivate = 0x08000000L;

    private const uint SwpNoActivate = 0x0010;
    private const uint SwpFrameChanged = 0x0020;
    private const uint SwpShowWindow = 0x0040;
    private const uint SwpNoOwnerZOrder = 0x0200;

    private const int SwRestore = 9;
    private const int SwShow = 5;

    private const uint KeyEventUp = 0x0002;

    /* ------------------------------------------------------------------
       Foreground hand-off
       ------------------------------------------------------------------ */

    /// <summary>Windows we filled on behalf of the native hotkey, with enough
    /// state to put the frame and geometry back.</summary>
    private sealed record SavedWindow(int Pid, long Style, Rect Rect);

    private static readonly Dictionary<long, SavedWindow> SavedWindows = new();
    private static readonly object WindowGate = new();

    /// <summary>Must be called while the launcher still owns the foreground:
    /// it grants the game process permission to take it over. Windows would
    /// otherwise keep the game behind the launcher even after it shows a
    /// window.</summary>
    public static void AllowForeground(int pid)
    {
        if (pid <= 0) return;
        try { AllowSetForegroundWindow(pid); } catch { }
    }

    /// <summary>Native-mode hotkey: fills the foreground running game (or the
    /// newest session), or restores it if it was already filled.</summary>
    public static (bool On, int Pid)? ToggleBorderlessForSessions(IEnumerable<int> pids)
    {
        var list = pids.Distinct().ToList();
        if (list.Count == 0) return null;

        var foreground = GetForegroundWindow();
        uint foregroundPid = 0;
        if (foreground != IntPtr.Zero) GetWindowThreadProcessId(foreground, out foregroundPid);
        var pid = list.Contains((int)foregroundPid) ? (int)foregroundPid : list[list.Count - 1];
        var on = ToggleBorderless(pid);
        return on.HasValue ? (on.Value, pid) : null;
    }

    public static bool? ToggleBorderless(int pid)
    {
        var window = FindMainWindow(pid);
        if (window == IntPtr.Zero) return null;
        var key = window.ToInt64();

        lock (WindowGate)
        {
            if (SavedWindows.TryGetValue(key, out var saved))
            {
                SavedWindows.Remove(key);
                try
                {
                    SetWindowLongPtr(window, GwlStyle, new IntPtr(saved.Style));
                    var width = saved.Rect.Right - saved.Rect.Left;
                    var height = saved.Rect.Bottom - saved.Rect.Top;
                    SetWindowPos(window, IntPtr.Zero, saved.Rect.Left, saved.Rect.Top, width, height,
                        SwpFrameChanged | SwpShowWindow | SwpNoOwnerZOrder | SwpNoActivate);
                    Log.Write($"native scale off pid={pid}");
                    return false;
                }
                catch (Exception ex)
                {
                    Log.Error("restore game window", ex);
                    return false;
                }
            }

            try
            {
                GetWindowRect(window, out var rect);
                var style = GetWindowLongPtr(window, GwlStyle).ToInt64();
                if (SavedWindows.Count > 24) SavedWindows.Clear();
                SavedWindows[key] = new SavedWindow(pid, style,
                    new Rect { Left = rect.Left, Top = rect.Top, Right = rect.Right, Bottom = rect.Bottom });
            }
            catch (Exception ex)
            {
                Log.Error("remember game window", ex);
                return null;
            }
        }

        var applied = ApplyBorderless(new HashSet<int> { pid }, window);
        if (!applied)
        {
            lock (WindowGate) SavedWindows.Remove(key);
            return null;
        }

        Log.Write($"native scale on pid={pid}");
        return true;
    }

    /// <summary>Drops state for a process that has exited.</summary>
    public static void ForgetProcess(int pid)
    {
        lock (WindowGate)
        {
            foreach (var key in SavedWindows.Where(pair => pair.Value.Pid == pid).Select(pair => pair.Key).ToList())
                SavedWindows.Remove(key);
        }
    }

    /// <summary>Waits for the game's first usable top-level window, brings it
    /// forward and optionally fills the monitor with it.</summary>
    public static Result Present(int pid, bool scale, string engine, PlayerSettings settings, int timeoutMs = 30000, bool scaleExplicit = false)
    {
        if (pid <= 0)
            return new Result(false, false, false, "none", "进程信息不可用", 0);

        AllowForeground(pid);

        // Games that start behind a launcher often render in a child of the
        // exe we attached to (DNF-style clients are the example that proved
        // it). The family is best effort: if the snapshot API is unavailable
        // it collapses to { pid }, which is exactly the old behaviour.
        var family = ProcessFamily(pid);
        var factorMode = string.Equals(settings.ScaleMode, "factor", StringComparison.OrdinalIgnoreCase);

        // The bundled engine starts before the hand-off so its own window can
        // be hidden while the game still owns the foreground. An explicit
        // scale request (the player's switch) is permission to start the
        // engine; the immersive shell default only ever uses one that runs.
        ScalingEngine.Status? engineStatus = null;
        string? engineReason = null;
        if (scale && engine == "auto")
        {
            if (!ScalingEngine.Supported)
            {
                engineReason = "当前系统不支持内置缩放引擎";
            }
            else
            {
                ScalingEngine.EnsureRunning(settings, scaleExplicit, out var status);
                engineStatus = status;

                // The algorithm and the windowed multiplier both live in the
                // engine config and are read when Magpie starts. Write them
                // together, then restart once if anything actually changed —
                // otherwise a pixel algorithm picked in the launcher would
                // stay on disk while the running engine kept its old effect.
                var configChanged = false;
                var configNotes = new List<string>();
                if (status.Running)
                {
                    ScalingEngine.ApplyAlgorithm(settings.ScaleAlgorithm, out var algoNote, out var algoChanged);
                    configChanged |= algoChanged;
                    configNotes.Add($"algo={algoNote}");
                    if (factorMode)
                    {
                        ScalingEngine.WriteWindowedFactor(settings.ScaleFactor, out var factorNote, out var factorChanged);
                        configChanged |= factorChanged;
                        configNotes.Add($"factor={factorNote}");
                    }
                    if (configChanged && ScalingEngine.IsRunning())
                    {
                        ScalingEngine.Restart(settings, out _);
                        Log.Write($"magpie restarted for scale profile {string.Join(" ", configNotes)}");
                    }
                }

                if (!status.Running)
                    engineReason = string.IsNullOrWhiteSpace(status.Note)
                        ? "缩放引擎没有在运行（可在设置开启「自动启动内置缩放引擎」）"
                        : $"缩放引擎没有在运行：{status.Note}";
            }
        }

        IntPtr window = IntPtr.Zero;
        var deadline = DateTime.UtcNow.AddMilliseconds(Math.Max(2000, timeoutMs));
        while (DateTime.UtcNow < deadline)
        {
            window = FindMainWindow(family);
            if (window != IntPtr.Zero) break;
            Thread.Sleep(350);
        }

        if (window == IntPtr.Zero)
            return new Result(false, false, false, "none", "没有等到游戏窗口", 0);

        if (!ProcessAlive(pid))
            return new Result(false, false, false, "none", "游戏进程已经退出", window.ToInt64());

        var foreground = BringToFront(window);
        var scaled = false;
        var engineUsed = "none";
        string? error = null;
        var magpieDiag = "";

        if (scale)
        {
            if (IsMagpieScaling(family))
            {
                scaled = true;
                engineUsed = "magpie";
            }
            else if (engine == "auto" && engineStatus is { Running: true })
            {
                // Fullscreen and windowed scaling are two different Magpie
                // shortcuts; the factor mode's multiplier was written above.
                var hotkey = factorMode ? ScalingEngine.ReadWindowedHotkey() : engineStatus.Hotkey;
                scaled = TryMagpie(window, hotkey, family, out window, out magpieDiag);
                engineUsed = scaled ? (factorMode ? "magpie-factor" : "magpie") : "none";
                if (!scaled) error = factorMode
                    ? "倍数缩放没有接管这个窗口，已改用无边框全屏"
                    : "缩放引擎没有接管这个窗口，已改用无边框全屏";
            }
            else if (engine == "auto" && engineReason != null)
            {
                // Never silently degrade: say why Magpie is not part of this
                // launch, including the case where the engine cannot start.
                error = engineReason + "，已改用无边框全屏";
            }

            if (!scaled)
            {
                scaled = ApplyBorderless(family, window);
                engineUsed = scaled ? "native" : "none";
                if (!scaled && error == null) error = "窗口没有响应尺寸调整";
            }
        }

        GetWindowThreadProcessId(window, out var owner);
        Log.Write($"present pid={pid} hwnd=0x{window.ToInt64():X} owner={owner} family={family.Count} cls={WindowClass(window)} foreground={foreground} scale={scale} mode={(factorMode ? "factor" : "fullscreen")} algo={(string.IsNullOrWhiteSpace(settings.ScaleAlgorithm) ? "-" : settings.ScaleAlgorithm)} factor={(factorMode ? settings.ScaleFactor.ToString("0.##", System.Globalization.CultureInfo.InvariantCulture) : "-")} engine={engineUsed} scaled={scaled} {magpieDiag} {error}");
        return new Result(true, scaled, foreground, engineUsed, error, window.ToInt64());
    }

    private static bool ProcessAlive(int pid)
    {
        try
        {
            using var process = Process.GetProcessById(pid);
            return !process.HasExited;
        }
        catch
        {
            return false;
        }
    }

    private static bool BringToFront(IntPtr window)
    {
        try
        {
            if (IsIconic(window)) ShowWindow(window, SwRestore);
            ShowWindow(window, SwShow);

            for (var attempt = 0; attempt < 6; attempt++)
            {
                SetForegroundWindow(window);
                BringWindowToTop(window);
                if (ForegroundBelongsTo(window)) return true;
                Thread.Sleep(120);
            }

            // The foreground lock can survive a programmatic launch (for
            // example when the click happened in another thread). Attaching to
            // the current foreground thread's input queue is the standard way
            // to finish the hand-off without stealing input permanently.
            var foreground = GetForegroundWindow();
            if (foreground != IntPtr.Zero)
            {
                var foregroundThread = GetWindowThreadProcessId(foreground, out _);
                var currentThread = GetCurrentThreadId();
                if (foregroundThread != 0 && foregroundThread != currentThread &&
                    AttachThreadInput(currentThread, foregroundThread, true))
                {
                    try
                    {
                        SetForegroundWindow(window);
                        BringWindowToTop(window);
                        SetFocus(window);
                    }
                    finally
                    {
                        AttachThreadInput(currentThread, foregroundThread, false);
                    }
                }
            }

            if (!ForegroundBelongsTo(window)) SwitchToThisWindow(window, true);

            if (!ForegroundBelongsTo(window))
            {
                // A synthetic Alt tap clears the foreground lock that can
                // survive a programmatic launch; without it the hotkey goes
                // to the launcher instead of the game. Real logs showed
                // foreground=False on several DNF launches.
                keybd_event(0x12, 0, 0, UIntPtr.Zero);       // VK_MENU
                keybd_event(0x12, 0, KeyEventUp, UIntPtr.Zero);
                SetForegroundWindow(window);
                BringWindowToTop(window);
                Thread.Sleep(180);
            }
            return ForegroundBelongsTo(window);
        }
        catch (Exception ex)
        {
            Log.Error("bring game window to front", ex);
            return false;
        }
    }

    /// <summary>A dialog or owned window of the same process is just as good as
    /// the exact handle we picked: the player can type into the game.</summary>
    private static bool ForegroundBelongsTo(IntPtr window)
    {
        var foreground = GetForegroundWindow();
        if (foreground == window) return true;
        if (foreground == IntPtr.Zero || window == IntPtr.Zero) return false;
        GetWindowThreadProcessId(foreground, out var foregroundPid);
        GetWindowThreadProcessId(window, out var windowPid);
        return foregroundPid != 0 && foregroundPid == windowPid;
    }

    private static IntPtr FindMainWindow(int pid) => FindMainWindow(new HashSet<int> { pid });

    /// <summary>Largest usable visible window owned by any process in the
    /// family. A bootstrap or login window is smaller than the renderer, so
    /// area decides instead of "the first window of the tracked exe".</summary>
    private static IntPtr FindMainWindow(HashSet<int> pids)
    {
        var best = IntPtr.Zero;
        long bestArea = 0;
        IntPtr bestIconic = IntPtr.Zero;
        long bestIconicArea = 0;

        EnumWindows((window, _) =>
        {
            uint owner;
            GetWindowThreadProcessId(window, out owner);
            if (!pids.Contains((int)owner)) return true;
            if (!IsWindowVisible(window)) return true;

            var exStyle = GetWindowLongPtr(window, GwlExStyle).ToInt64();
            if ((exStyle & WsExToolWindow) != 0 || (exStyle & WsExNoActivate) != 0) return true;

            if (!GetWindowRect(window, out var rect)) return true;
            var width = rect.Right - rect.Left;
            var height = rect.Bottom - rect.Top;
            if (width < 240 || height < 160) return true;

            var area = (long)width * height;
            if (IsIconic(window))
            {
                if (area > bestIconicArea) { bestIconicArea = area; bestIconic = window; }
                return true;
            }

            if (area > bestArea) { bestArea = area; best = window; }
            return true;
        }, IntPtr.Zero);

        return best != IntPtr.Zero ? best : bestIconic;
    }

    /// <summary>The attached pid plus the processes it spawned (bounded to
    /// three generations). Toolhelp32 keeps this a single cheap snapshot and
    /// needs no WMI package in the net48 legacy build.</summary>
    private static HashSet<int> ProcessFamily(int rootPid)
    {
        var family = new HashSet<int> { rootPid };
        var snapshot = CreateToolhelp32Snapshot(Th32csSnapprocess, 0);
        if (snapshot == IntPtr.Zero || snapshot == new IntPtr(-1)) return family;

        try
        {
            var children = new Dictionary<int, List<int>>();
            var entry = new ProcessEntry32W
            {
                Size = (uint)System.Runtime.InteropServices.Marshal.SizeOf<ProcessEntry32W>()
            };
            if (Process32FirstW(snapshot, ref entry))
            {
                do
                {
                    var parent = (int)entry.ParentProcessId;
                    if (!children.TryGetValue(parent, out var list))
                        children[parent] = list = new List<int>();
                    list.Add((int)entry.ProcessId);
                }
                while (Process32NextW(snapshot, ref entry));
            }

            var frontier = new List<int> { rootPid };
            for (var depth = 0; depth < MaxFamilyDepth && frontier.Count > 0 && family.Count < MaxFamilySize; depth++)
            {
                var next = new List<int>();
                foreach (var pid in frontier)
                {
                    if (!children.TryGetValue(pid, out var spawned)) continue;
                    foreach (var child in spawned)
                    {
                        if (family.Add(child)) next.Add(child);
                        if (family.Count >= MaxFamilySize) break;
                    }
                    if (family.Count >= MaxFamilySize) break;
                }
                frontier = next;
            }
        }
        catch (Exception ex)
        {
            Log.Error("process family", ex);
        }
        finally
        {
            CloseHandle(snapshot);
        }
        return family;
    }

    private static string WindowClass(IntPtr window)
    {
        try
        {
            var name = new System.Text.StringBuilder(128);
            return GetClassName(window, name, name.Capacity) > 0 ? name.ToString() : "-";
        }
        catch { return "-"; }
    }

    /* ------------------------------------------------------------------
       Native borderless fill
       ------------------------------------------------------------------ */

    private static bool ApplyBorderless(HashSet<int> pids, IntPtr window)
    {
        try
        {
            GetWindowThreadProcessId(window, out var owner);
            if (!pids.Contains((int)owner)) return false;

            var monitor = MonitorFromWindow(window, MonitorDefaultToNearest);
            var info = new MonitorInfo { Size = System.Runtime.InteropServices.Marshal.SizeOf<MonitorInfo>() };
            if (monitor == IntPtr.Zero || !GetMonitorInfo(monitor, ref info)) return false;

            var targetWidth = info.Monitor.Right - info.Monitor.Left;
            var targetHeight = info.Monitor.Bottom - info.Monitor.Top;
            if (targetWidth <= 0 || targetHeight <= 0) return false;

            var style = GetWindowLongPtr(window, GwlStyle).ToInt64();
            GetWindowRect(window, out var rect);
            var coversMonitor = rect.Left <= info.Monitor.Left + 2 && rect.Top <= info.Monitor.Top + 2
                && rect.Right >= info.Monitor.Right - 2 && rect.Bottom >= info.Monitor.Bottom - 2;
            var hasFrame = (style & WsCaption) != 0;

            // An exclusive or already borderless fullscreen window needs no
            // change; touching its style can make the game recreate devices.
            if (!hasFrame && coversMonitor) return true;

            var nextStyle = style & ~(WsCaption | WsThickFrame | WsMinimizeBox | WsMaximizeBox | WsSysMenu);
            nextStyle |= WsPopup;
            SetWindowLongPtr(window, GwlStyle, new IntPtr(nextStyle));

            SetWindowPos(window, IntPtr.Zero, info.Monitor.Left, info.Monitor.Top, targetWidth, targetHeight,
                SwpFrameChanged | SwpShowWindow | SwpNoOwnerZOrder | SwpNoActivate);

            Thread.Sleep(450);

            // Some engines rebuild their window during start-up and restore the
            // frame. One second pass is enough and avoids fighting the game.
            var after = GetWindowLongPtr(window, GwlStyle).ToInt64();
            GetWindowRect(window, out var now);
            var filled = (after & WsCaption) == 0
                && now.Left <= info.Monitor.Left + 4 && now.Top <= info.Monitor.Top + 4
                && now.Right >= info.Monitor.Right - 4 && now.Bottom >= info.Monitor.Bottom - 4;
            if (!filled)
            {
                SetWindowLongPtr(window, GwlStyle, new IntPtr(nextStyle));
                SetWindowPos(window, IntPtr.Zero, info.Monitor.Left, info.Monitor.Top, targetWidth, targetHeight,
                    SwpFrameChanged | SwpShowWindow | SwpNoOwnerZOrder | SwpNoActivate);
                Thread.Sleep(300);
                GetWindowRect(window, out now);
                filled = now.Left <= info.Monitor.Left + 8 && now.Top <= info.Monitor.Top + 8
                    && now.Right >= info.Monitor.Right - 8 && now.Bottom >= info.Monitor.Bottom - 8;
            }

            return filled;
        }
        catch (Exception ex)
        {
            Log.Error("borderless fullscreen", ex);
            return false;
        }
    }

    /* ------------------------------------------------------------------
       Magpie
       ------------------------------------------------------------------ */

    /// <summary>Magpie's hotkey is a toggle, so a second press is only safe
    /// when the first one did not scale ANY window. Games that rebuild their
    /// window while loading are the reason for the retry; the handle that
    /// actually ended up scaled is returned so the caller reports the truth.</summary>
    private static bool TryMagpie(IntPtr window, int hotkey, HashSet<int> family,
        out IntPtr usedWindow, out string diagnosis)
    {
        usedWindow = window;
        if (hotkey <= 0) hotkey = ScalingEngine.ReadHotkey();
        if (hotkey <= 0)
        {
            diagnosis = "hotkey unavailable";
            return false;
        }

        var notes = new List<string>();
        for (var attempt = 1; attempt <= 2; attempt++)
        {
            var busy = MagpieSource();
            if (busy != IntPtr.Zero && IsWindow(busy))
            {
                // Pressing the toggle again would turn THAT scaling off, so
                // stop here and let the caller fall back to native.
                notes.Add($"try={attempt} busy src=0x{busy.ToInt64():X}");
                break;
            }

            // ForegroundBelongsTo accepts any window of the same process, but
            // a login/overlay window can own it while the renderer does not.
            // Ask for this exact handle first, then use the full hand-off as
            // the fallback.
            SetForegroundWindow(window);
            BringWindowToTop(window);
            var exactForeground = GetForegroundWindow() == window;
            if (!exactForeground) BringToFront(window);
            var foreground = ForegroundBelongsTo(window);
            Thread.Sleep(180);
            SendHotkey(hotkey);

            var scaledWindow = IntPtr.Zero;
            var deadline = DateTime.UtcNow.AddSeconds(6);
            while (DateTime.UtcNow < deadline)
            {
                scaledWindow = ScaledWindowIn(family);
                if (scaledWindow != IntPtr.Zero) break;
                Thread.Sleep(250);
            }

            if (scaledWindow != IntPtr.Zero)
            {
                usedWindow = scaledWindow;
                notes.Add($"try={attempt} hwnd=0x{window.ToInt64():X} fg={foreground}/exact={exactForeground} scaled=0x{scaledWindow.ToInt64():X}");
                diagnosis = string.Join(" ", notes);
                return true;
            }

            notes.Add($"try={attempt} hwnd=0x{window.ToInt64():X} fg={foreground}/exact={exactForeground} src=0x{MagpieSource().ToInt64():X}");
            if (attempt == 2) break;

            // Loading rebuilt the window: pick the family's current largest
            // one and give the hotkey one more chance on the new handle.
            Thread.Sleep(2000);
            var rebuilt = FindMainWindow(family);
            if (rebuilt != IntPtr.Zero && rebuilt != window)
            {
                notes.Add($"rebuilt 0x{window.ToInt64():X}->0x{rebuilt.ToInt64():X}");
                window = rebuilt;
                // Even when both hotkey attempts fail, the native fallback
                // must act on the window that survived the rebuild.
                usedWindow = rebuilt;
            }
        }

        diagnosis = string.Join(" ", notes);
        return false;
    }

    private static bool IsMagpieScaling(HashSet<int> family) => ScaledWindowIn(family) != IntPtr.Zero;

    /// <summary>The window Magpie is currently scaling, but only when it still
    /// exists and belongs to the game family. The old exact-handle comparison
    /// reported failure whenever a game rebuilt its window after the hotkey.</summary>
    private static IntPtr ScaledWindowIn(HashSet<int> family)
    {
        var src = MagpieSource();
        if (src == IntPtr.Zero || !IsWindow(src)) return IntPtr.Zero;
        GetWindowThreadProcessId(src, out var owner);
        return family.Contains((int)owner) ? src : IntPtr.Zero;
    }

    private static IntPtr MagpieSource()
    {
        try
        {
            var scaling = FindWindow(MagpieWindowClass, null);
            return scaling == IntPtr.Zero ? IntPtr.Zero : GetProp(scaling, MagpieSrcProperty);
        }
        catch
        {
            return IntPtr.Zero;
        }
    }

    private static void SendHotkey(int packed)
    {
        // Magpie encodes a Shortcut as: key | win<<8 | ctrl<<9 | alt<<10 | shift<<11.
        var vk = (byte)(packed & 0xFF);
        var win = (packed & 0x100) != 0;
        var ctrl = (packed & 0x200) != 0;
        var alt = (packed & 0x400) != 0;
        var shift = (packed & 0x800) != 0;

        var pressed = new List<byte>();
        if (alt) pressed.Add(0x12);   // VK_MENU
        if (ctrl) pressed.Add(0x11);  // VK_CONTROL
        if (shift) pressed.Add(0x10); // VK_SHIFT
        if (win) pressed.Add(0x5B);   // VK_LWIN

        foreach (var key in pressed) keybd_event(key, 0, 0, UIntPtr.Zero);
        keybd_event(vk, 0, 0, UIntPtr.Zero);
        keybd_event(vk, 0, KeyEventUp, UIntPtr.Zero);
        for (var i = pressed.Count - 1; i >= 0; i--) keybd_event(pressed[i], 0, KeyEventUp, UIntPtr.Zero);
    }

    /* ------------------------------------------------------------------
       Win32
       ------------------------------------------------------------------ */

    [System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential,
        CharSet = System.Runtime.InteropServices.CharSet.Unicode)]
    private struct ProcessEntry32W
    {
        public uint Size;
        public uint Usage;
        public uint ProcessId;
        public IntPtr DefaultHeapId;
        public uint ModuleId;
        public uint Threads;
        public uint ParentProcessId;
        public int PriClassBase;
        public uint Flags;
        [System.Runtime.InteropServices.MarshalAs(System.Runtime.InteropServices.UnmanagedType.ByValTStr, SizeConst = 260)]
        public string ExeFile;
    }

    [System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential)]
    private struct Rect
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential)]
    private struct MonitorInfo
    {
        public int Size;
        public Rect Monitor;
        public Rect Work;
        public uint Flags;
    }

    private delegate bool EnumWindowsProc(IntPtr window, IntPtr state);

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr state);

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr window, out uint pid);

    [System.Runtime.InteropServices.DllImport("kernel32.dll")]
    private static extern uint GetCurrentThreadId();

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern bool AttachThreadInput(uint attach, uint attachTo, bool state);

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern IntPtr SetFocus(IntPtr window);

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern void SwitchToThisWindow(IntPtr window, bool altTab);

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr window);

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern bool IsIconic(IntPtr window);

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern bool ShowWindow(IntPtr window, int command);

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern bool GetWindowRect(IntPtr window, out Rect rect);

    [System.Runtime.InteropServices.DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")]
    private static extern IntPtr GetWindowLongPtr(IntPtr window, int index);

    [System.Runtime.InteropServices.DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW")]
    private static extern IntPtr SetWindowLongPtr(IntPtr window, int index, IntPtr value);

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern bool SetWindowPos(IntPtr window, IntPtr insertAfter, int x, int y, int width, int height, uint flags);

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr window);

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern bool BringWindowToTop(IntPtr window);

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern bool AllowSetForegroundWindow(int pid);

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern IntPtr MonitorFromWindow(IntPtr window, uint flags);

    [System.Runtime.InteropServices.DllImport("user32.dll", CharSet = System.Runtime.InteropServices.CharSet.Unicode)]
    private static extern bool GetMonitorInfo(IntPtr monitor, ref MonitorInfo info);

    [System.Runtime.InteropServices.DllImport("user32.dll", CharSet = System.Runtime.InteropServices.CharSet.Unicode)]
    private static extern IntPtr FindWindow(string className, string? windowName);

    [System.Runtime.InteropServices.DllImport("user32.dll", CharSet = System.Runtime.InteropServices.CharSet.Unicode)]
    private static extern IntPtr GetProp(IntPtr window, string name);

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern void keybd_event(byte virtualKey, byte scanCode, uint flags, UIntPtr extra);

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern bool IsWindow(IntPtr window);

    [System.Runtime.InteropServices.DllImport("user32.dll", CharSet = System.Runtime.InteropServices.CharSet.Unicode)]
    private static extern int GetClassName(IntPtr window, System.Text.StringBuilder name, int maxCount);

    [System.Runtime.InteropServices.DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr CreateToolhelp32Snapshot(uint flags, uint processId);

    [System.Runtime.InteropServices.DllImport("kernel32.dll", EntryPoint = "Process32FirstW",
        CharSet = System.Runtime.InteropServices.CharSet.Unicode, SetLastError = true)]
    private static extern bool Process32FirstW(IntPtr snapshot, ref ProcessEntry32W entry);

    [System.Runtime.InteropServices.DllImport("kernel32.dll", EntryPoint = "Process32NextW",
        CharSet = System.Runtime.InteropServices.CharSet.Unicode, SetLastError = true)]
    private static extern bool Process32NextW(IntPtr snapshot, ref ProcessEntry32W entry);

    [System.Runtime.InteropServices.DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CloseHandle(IntPtr handle);
}
