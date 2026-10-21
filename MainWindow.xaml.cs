using System.Drawing;
using Color = System.Windows.Media.Color;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows;
using WinForms = System.Windows.Forms;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using Microsoft.Web.WebView2.Core;
using NovaGameSpace.Services;

namespace NovaGameSpace;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        Loaded += OnLoaded;
        StateChanged += Window_StateChanged;
        Closing += OnClosing;
    }

    /// <summary>
    /// The close button is answered by the in-app dialog, so the window never
    /// shows a stock Windows message box. The UI calls back with the choice.
    /// </summary>
    public void RequestClose() => Bridge?.Notify("ask-close", new { });

    public void QuitNow() => ExitApplication();

    public void HideToTray() => MinimizeToTray();

    private void OnClosing(object? sender, System.ComponentModel.CancelEventArgs e)
    {
        // Only the tray menu and the in-app dialog are allowed to close the
        // process; Alt+F4 is routed through the same in-app confirmation.
        if (_reallyClosing) return;
        e.Cancel = true;
        Bridge?.Notify("ask-close", new { });
    }

    private WinForms.NotifyIcon? _tray;
    private bool _reallyClosing;
    private HwndSource? _hwndSource;
    private bool _hotkeyRegistered;
    private const int ScalingHotkeyId = 0x4E56;
    private StoreService Store { get; } = new();
    private MediaService Media { get; } = new();
    private LauncherService? Launcher { get; set; }
    private NativeBridge? Bridge { get; set; }

    private async void OnLoaded(object sender, RoutedEventArgs e)
    {
        try
        {
            Store.Load();
            // Pull Steam's own playtime once at boot so the hero shows the
            // real number even for games the launcher has never counted.
            try
            {
                var synced = Store.SyncSteamPlaytime();
                if (synced.Count > 0) Log.Write($"steam playtime synced at boot: {synced.Count}");
            }
            catch (Exception ex)
            {
                Log.Error("steam playtime boot", ex);
            }
            Launcher = new LauncherService(Store);
            Bridge = new NativeBridge(Store, Media, Launcher);

            // Native-mode shortcut: the bundled Magpie owns its own hotkey,
            // but the built-in borderless path needs one registered here.
            var handle = new WindowInteropHelper(this).Handle;
            _hwndSource = HwndSource.FromHwnd(handle);
            _hwndSource?.AddHook(WndProc);
            ApplyScalingHotkey(Store.Library.Settings.ScalingHotkey);

            // A moved install would otherwise keep pointing the Run key at the
            // old path; only an already enabled entry is touched.
            _ = Task.Run(() => StartupService.RefreshIfEnabled());

            // Offline daily backup: one pack per day, keep five. Runs after the
            // library is loaded and never blocks the window.
            _ = Task.Run(async () => { await Task.Delay(5000); BackupService.EnsureDailyBackup(Store); });

            // WebView2 caches the virtual-host renderer files. After an app
            // update the old app.js/CSS would otherwise win; drop only the
            // disk caches when the assembly version changes.
            ClearRendererCacheIfVersionChanged();

            var cdpPort = Environment.GetEnvironmentVariable("NOVA_CDP_PORT");
            var options = new CoreWebView2EnvironmentOptions();
            var browserArgs = new List<string>();
            if (!string.IsNullOrEmpty(cdpPort))
                browserArgs.Add($"--remote-debugging-port={cdpPort} --remote-allow-origins=*");

            // Development escape hatch: a wedged GPU process (driver reset,
            // stale shader cache) otherwise takes the whole WebView down with
            // "GPU process isn't usable. Goodbye." Software rendering is
            // perfectly fine for headless capture.
            var extraArgs = Environment.GetEnvironmentVariable("NOVA_WEBVIEW_ARGS");
            if (!string.IsNullOrWhiteSpace(extraArgs))
                browserArgs.Add(extraArgs);

            if (browserArgs.Count > 0)
                options.AdditionalBrowserArguments = string.Join(" ", browserArgs);
            // A fixed WebView2 runtime can be dropped next to the exe for a
            // fully offline legacy package (Windows 7 uses 109).
            var fixedRuntime = Path.Combine(AppContext.BaseDirectory, "WebView2Runtime");
            var browserFolder = Directory.Exists(fixedRuntime) && File.Exists(Path.Combine(fixedRuntime, "msedgewebview2.exe")) ? fixedRuntime : null;
            var env = await CoreWebView2Environment.CreateAsync(browserFolder, CacheRoot(), options);
            await Web.EnsureCoreWebView2Async(env);
            Bridge.Attach(Web);
            ApplyStartupFullscreen();
            Web.CoreWebView2.ProcessFailed += (_, args) =>
            {
                Log.Write($"webview failed: {args.ProcessFailedKind}");
                if (args.ProcessFailedKind == CoreWebView2ProcessFailedKind.RenderProcessExited)
                {
                    Dispatcher.Invoke(() => Web.Reload());
                }
            };

            Web.CoreWebView2.Navigate("https://nova.site/index.html");
            Splash.Visibility = Visibility.Collapsed;
        }
        catch (Exception ex)
        {
            Log.Error("startup", ex);
            Splash.Child = new System.Windows.Controls.TextBlock
            {
                Text = "无法启动界面。请确认已安装 Microsoft Edge WebView2 Runtime。\n\n" + ex.Message,
                Foreground = new SolidColorBrush(Color.FromRgb(200, 120, 120)),
                FontSize = 13,
                TextWrapping = TextWrapping.Wrap,
                Margin = new Thickness(40),
                HorizontalAlignment = System.Windows.HorizontalAlignment.Center,
                VerticalAlignment = System.Windows.VerticalAlignment.Center,
                TextAlignment = System.Windows.TextAlignment.Center
            };
        }
    }

    /// <summary>A Windows-launched session opens straight into the immersive
    /// shell when the player asked for it. Manual launches are untouched, so
    /// the saved window geometry still wins for normal use.</summary>
    private void ApplyStartupFullscreen()
    {
        try
        {
            var startedByWindows = Environment.GetCommandLineArgs()
                .Any(arg => arg.StartsWith("--startup", StringComparison.OrdinalIgnoreCase));
            if (!startedByWindows || !Store.Library.Settings.StartupFullscreen) return;
            SetFullscreen(true);
            Log.Write("startup fullscreen applied");
        }
        catch (Exception ex)
        {
            Log.Error("startup fullscreen", ex);
        }
    }

    /// <summary>
    /// Renderer cache is disposable and should never sit on the system disk when
    /// another fixed drive is available. NOVA_CACHE_ROOT still wins for dev
    /// sessions; otherwise use the app-data folder when it is already off C:,
    /// then the first writable fixed drive, and only fall back to C: as a last
    /// resort (a single-drive machine).
    /// </summary>
    private static string CacheRoot()
    {
        var over = Environment.GetEnvironmentVariable("NOVA_CACHE_ROOT");
        if (!string.IsNullOrWhiteSpace(over))
        {
            Directory.CreateDirectory(over);
            return over;
        }

        var defaultRoot = Path.Combine(AppPaths.Root, "webview2");
        try
        {
            var systemRoot = Path.GetPathRoot(Environment.SystemDirectory) ?? "C:\\";
            if (!string.Equals(Path.GetPathRoot(defaultRoot), systemRoot, StringComparison.OrdinalIgnoreCase))
            {
                Directory.CreateDirectory(defaultRoot);
                return defaultRoot;
            }

            var drives = DriveInfo.GetDrives();
            for (var i = 0; i < drives.Length; i++)
            {
                var drive = drives[i];
                if (drive.DriveType != DriveType.Fixed || !drive.IsReady) continue;
                if (string.Equals(drive.RootDirectory.FullName, systemRoot, StringComparison.OrdinalIgnoreCase)) continue;
                if (drive.AvailableFreeSpace < 512L * 1024 * 1024) continue;
                var candidate = Path.Combine(drive.RootDirectory.FullName, "NOVA Game Space", "cache", "webview2");
                try
                {
                    Directory.CreateDirectory(candidate);
                    return candidate;
                }
                catch { }
            }
        }
        catch { }

        Directory.CreateDirectory(defaultRoot);
        return defaultRoot;
    }

    /// <summary>
    /// WebView2's virtual host caches renderer files aggressively. Wiping the
    /// disk cache on a version bump guarantees that an updated app.js / CSS
    /// actually reaches the screen, without clearing cookies or settings.
    /// </summary>
    private static void ClearRendererCacheIfVersionChanged()
    {
        try
        {
            var version = typeof(MainWindow).Assembly.GetName().Version?.ToString() ?? "0";
            var root = CacheRoot();
            var marker = Path.Combine(root, ".renderer-version");
            if (Directory.Exists(root) && File.Exists(marker) && File.ReadAllText(marker) == version)
                return;

            var caches = new[]
            {
                Path.Combine(root, "EBWebView", "Default", "Cache"),
                Path.Combine(root, "EBWebView", "Default", "Code Cache"),
                Path.Combine(root, "EBWebView", "Default", "GPUCache"),
                Path.Combine(root, "EBWebView", "GrShaderCache"),
                Path.Combine(root, "EBWebView", "ShaderCache")
            };

            foreach (var dir in caches)
            {
                if (Directory.Exists(dir)) Directory.Delete(dir, true);
            }

            Directory.CreateDirectory(root);
            File.WriteAllText(marker, version);
            Log.Write($"renderer cache reset for {version}");
        }
        catch (Exception ex)
        {
            // A locked cache is not fatal; the next launch will retry.
            Log.Error("clear renderer cache", ex);
        }
    }

    [DllImport("user32.dll")]
    private static extern bool ReleaseCapture();

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr SendMessage(IntPtr hWnd, int msg, IntPtr wParam, IntPtr lParam);

    private const int WmNclButtonDown = 0x00A1;
    private static readonly IntPtr HtCaption = new(2);

    public void BeginNativeDrag()
    {
        var handle = new WindowInteropHelper(this).Handle;
        if (handle == IntPtr.Zero) return;

        // Dragging a fullscreen window would leave it stuck to the monitor edge,
        // so exit fullscreen first and continue the drag from the restored size.
        if (_isFullscreen) SetFullscreen(false);

        ReleaseCapture();
        SendMessage(handle, WmNclButtonDown, HtCaption, IntPtr.Zero);
    }

    /// <summary>
    /// The maximize button and the fullscreen command share one behaviour:
    /// borderless coverage of the current monitor. Keeping a single code path
    /// avoids two subtly different "fill the screen" modes.
    /// </summary>
    public void ToggleMaximize() => SetFullscreen(!_isFullscreen);

    private bool _isFullscreen;
    private bool _autoMinimizedForGame;
    private bool _gameSessionActive;
    private WindowState _stateBeforeFullscreen = WindowState.Normal;
    private Rect _restoreBounds;
    private bool _hasRestoreBounds;

    /// <summary>Called when a real game process appears. The launcher stops
    /// being topmost immediately, but it stays visible (and foreground) until
    /// the game window is actually found — that is what lets Windows accept
    /// the hand-off instead of keeping the game behind us.</summary>
    public void BeginGameSession()
    {
        _gameSessionActive = true;
        Topmost = false;
    }

    /// <summary>Steps out of the way once the game window is in front.</summary>
    public void MinimizeForGame()
    {
        // A very short session may already be over by the time the window
        // hand-off finishes; never leave the launcher minimized with no game.
        if (!_gameSessionActive || !IsVisible) return;
        _autoMinimizedForGame = true;
        WindowState = WindowState.Minimized;
    }

    /// <summary>Brings the launcher back once the last session ends, but only
    /// if it was this code that minimized it and the player has not already
    /// restored it.</summary>
    public void EndGameSession()
    {
        _gameSessionActive = false;
        var wasAutoMinimized = _autoMinimizedForGame;
        _autoMinimizedForGame = false;

        if (wasAutoMinimized && WindowState == WindowState.Minimized)
        {
            Show();
            WindowState = WindowState.Normal;
            if (_isFullscreen) ApplyMonitorBounds();
            Activate();
        }

        Topmost = _isFullscreen;
    }

    public bool IsGameSessionActive => _gameSessionActive;

    /// <summary>
    /// Borderless fullscreen on the current monitor: no chrome, no taskbar and
    /// no WebView fullscreen API involved, so the whole surface stays under
    /// one visual language.
    /// </summary>
    public void SetFullscreen(bool on)
    {
        if (on == _isFullscreen) return;

        if (on)
        {
            // Capture the windowed geometry so leaving fullscreen returns to it.
            if (WindowState == WindowState.Normal && ActualWidth > 0 && ActualHeight > 0)
            {
                _restoreBounds = new Rect(Left, Top, ActualWidth, ActualHeight);
                _hasRestoreBounds = true;
            }

            _stateBeforeFullscreen = WindowState;
            _isFullscreen = true;
            WindowState = WindowState.Normal;   // leave maximized first
            RootBorder.BorderThickness = new Thickness(0);
            ApplyMonitorBounds();
            // While a game owns the screen the launcher must not sit on top of
            // it, even in immersive mode.
            Topmost = !_gameSessionActive;
        }
        else
        {
            _isFullscreen = false;
            Topmost = false;
            WindowState = WindowState.Normal;

            if (_stateBeforeFullscreen == WindowState.Maximized)
            {
                WindowState = WindowState.Maximized;
                RootBorder.BorderThickness = new Thickness(0);
            }
            else if (_hasRestoreBounds && _restoreBounds.Width > 0 && _restoreBounds.Height > 0)
            {
                Left = _restoreBounds.Left;
                Top = _restoreBounds.Top;
                Width = _restoreBounds.Width;
                Height = _restoreBounds.Height;
                RootBorder.BorderThickness = new Thickness(1);
            }
            else
            {
                Width = 1440;
                Height = 900;
                RootBorder.BorderThickness = new Thickness(1);
                WindowStartupLocation = WindowStartupLocation.CenterScreen;
                Left = (SystemParameters.PrimaryScreenWidth - Width) / 2;
                Top = (SystemParameters.PrimaryScreenHeight - Height) / 2;
            }
        }

        Bridge?.Notify("fullscreen-state", new { fullscreen = _isFullscreen });
    }

    public void ToggleFullscreen() => SetFullscreen(!_isFullscreen);

    public bool IsFullscreen => _isFullscreen;

    private void ApplyMonitorBounds()
    {
        var handle = new WindowInteropHelper(this).Handle;
        var monitor = MonitorFromWindow(handle, MonitorDefaultToNearest);
        var info = new MonitorInfo { Size = Marshal.SizeOf<MonitorInfo>() };
        if (monitor == IntPtr.Zero || !GetMonitorInfo(monitor, ref info))
        {
            // Fall back to the whole virtual desktop when monitor lookup fails.
            WindowState = WindowState.Maximized;
            return;
        }

        var area = info.Monitor;
        WindowState = WindowState.Normal;
        Left = area.Left / DpiScaleX;
        Top = area.Top / DpiScaleY;
        Width = (area.Right - area.Left) / DpiScaleX;
        Height = (area.Bottom - area.Top) / DpiScaleY;
    }

    private double DpiScaleX
    {
        get
        {
            var source = PresentationSource.FromVisual(this);
            return source?.CompositionTarget?.TransformToDevice.M11 ?? 1d;
        }
    }

    private double DpiScaleY
    {
        get
        {
            var source = PresentationSource.FromVisual(this);
            return source?.CompositionTarget?.TransformToDevice.M22 ?? 1d;
        }
    }

    private const uint MonitorDefaultToNearest = 2;

    [StructLayout(LayoutKind.Sequential)]
    private struct MonitorRect
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MonitorInfo
    {
        public int Size;
        public MonitorRect Monitor;
        public MonitorRect Work;
        public uint Flags;
    }

    [DllImport("user32.dll")]
    private static extern IntPtr MonitorFromWindow(IntPtr hwnd, uint flags);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern bool GetMonitorInfo(IntPtr monitor, ref MonitorInfo info);

    public void MinimizeToTray()
    {
        Hide();
        ShowTrayIcon();
    }

    public bool IsHiddenToTray => _tray != null && !IsVisible;

    private void ShowTrayIcon()
    {
        if (_tray != null) return;
        var menu = new WinForms.ContextMenuStrip();
        menu.Items.Add("显示 GUGUOVA", null, (_, _) => RestoreFromTray());

        // Quick launch: the last five games that can still start. The tray menu
        // is the OS's own surface, so a native menu here is the convention.
        foreach (var game in RecentGamesForTray(5))
        {
            var entry = game;
            var item = new WinForms.ToolStripMenuItem(entry.Name)
            {
                Enabled = !string.IsNullOrWhiteSpace(entry.ExePath) || entry.Source == GamePlatform.Steam.Id
            };
            item.Click += (_, _) => LaunchFromTray(entry);
            menu.Items.Add(item);
        }

        menu.Items.Add(new WinForms.ToolStripSeparator());
        menu.Items.Add("退出", null, (_, _) => ExitApplication());
        _tray = new WinForms.NotifyIcon
        {
            Icon = System.Drawing.Icon.ExtractAssociatedIcon(Process.GetCurrentProcess().MainModule?.FileName ?? "") ?? System.Drawing.SystemIcons.Application,
            Text = "GUGUOVA · 游戏空间",
            Visible = true,
            ContextMenuStrip = menu
        };
        _tray.DoubleClick += (_, _) => RestoreFromTray();
    }

    /// <summary>Recently played, existing only, honoring the developer filter.</summary>
    private List<NovaGameSpace.Models.GameEntry> RecentGamesForTray(int take)
    {
        if (Launcher == null) return new List<NovaGameSpace.Models.GameEntry>();
        try
        {
            return Store.Library.Games
                .Where(game => Store.DeveloperMode || !game.DeveloperOnly)
                .OrderByDescending(game => game.LastPlayedUtc ?? "")
                .ThenByDescending(game => game.AddedUtc)
                .Take(take)
                .ToList();
        }
        catch
        {
            return new List<NovaGameSpace.Models.GameEntry>();
        }
    }

    private void LaunchFromTray(NovaGameSpace.Models.GameEntry game)
    {
        if (Launcher == null) return;
        var immersive = IsFullscreen;
        var fullscreen = game.FullscreenScale ?? immersive;
        if (string.Equals(Store.Library.Settings.ScalingEngine, "off", StringComparison.OrdinalIgnoreCase))
            fullscreen = false;

        var result = Launcher.Launch(game, new LaunchOptions(fullscreen));
        if (result.Ok)
        {
            // The game window takes the foreground on its own; the launcher
            // stays in the tray unless the player brings it back.
            return;
        }

        RestoreFromTray();
        Bridge?.Notify("session-failed", new { gameId = game.Id, message = result.Error ?? "启动失败" });
    }

    /// <summary>Files dropped on the window resolve to one launchable exe and
    /// open the editor prefilled (the page cannot read dropped paths itself).</summary>
    private void OnWebDrop(object sender, System.Windows.DragEventArgs e)
    {
        if (!e.Data.GetDataPresent(System.Windows.DataFormats.FileDrop)) return;
        if (e.Data.GetData(System.Windows.DataFormats.FileDrop) is not string[] paths || paths.Length == 0) return;
        e.Handled = true;
        Bridge?.HandleFileDrop(paths);
    }

    public void RestoreFromTray()
    {
        Show();
        WindowState = WindowState.Normal;
        Activate();
        if (_tray != null)
        {
            _tray.Visible = false;
            _tray.Dispose();
            _tray = null;
        }
    }

    /// <summary>Registers the launcher's own scale shortcut only for the
    /// native path. In `auto` mode the bundled engine owns the key, so two
    /// RegisterHotKey calls would fight over it.</summary>
    public void ApplyScalingHotkey(int code)
    {
        var handle = new WindowInteropHelper(this).Handle;
        if (handle == IntPtr.Zero) return;

        if (_hotkeyRegistered)
        {
            UnregisterHotKey(handle, ScalingHotkeyId);
            _hotkeyRegistered = false;
        }

        var engine = Store.Library.Settings.ScalingEngine;
        var useNative = string.Equals(engine, "native", StringComparison.OrdinalIgnoreCase) ||
                        (string.Equals(engine, "auto", StringComparison.OrdinalIgnoreCase) && !ScalingEngine.Supported);
        if (!useNative || code <= 0)
        {
            Log.Write($"native scale hotkey: engine={engine} code={code} registered=false");
            return;
        }

        uint modifiers = 0x4000; // MOD_NOREPEAT
        if ((code & 0x400) != 0) modifiers |= 0x0001; // ALT
        if ((code & 0x200) != 0) modifiers |= 0x0002; // CONTROL
        if ((code & 0x800) != 0) modifiers |= 0x0004; // SHIFT
        if ((code & 0x100) != 0) modifiers |= 0x0008; // WIN

        _hotkeyRegistered = RegisterHotKey(handle, ScalingHotkeyId, modifiers, (uint)(code & 0xFF));
        Log.Write($"native scale hotkey registered={_hotkeyRegistered} code={code} label={ScalingEngine.Label(code)}");
        if (!_hotkeyRegistered)
        {
            Bridge?.Notify("scaling-hotkey", new
            {
                ok = false,
                label = ScalingEngine.Label(code),
                reason = "快捷键注册失败，可能被 Magpie 或其他程序占用"
            });
        }
    }

    private IntPtr WndProc(IntPtr hwnd, int message, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        if (message == 0x0312 && wParam.ToInt32() == ScalingHotkeyId)
        {
            handled = true;
            ToggleNativeScaling();
        }
        return IntPtr.Zero;
    }

    private void ToggleNativeScaling()
    {
        var sessions = Launcher?.Running;
        if (sessions == null || sessions.Count == 0)
        {
            Bridge?.Notify("scaling-toggled", new { ok = false, reason = "没有正在运行的游戏" });
            return;
        }

        var result = GameDisplay.ToggleBorderlessForSessions(sessions.Select(session => session.ProcessId));
        if (result == null)
        {
            Bridge?.Notify("scaling-toggled", new { ok = false, reason = "没有找到游戏窗口" });
            return;
        }

        var session = sessions.FirstOrDefault(entry => entry.ProcessId == result.Value.Pid);
        Bridge?.Notify("scaling-toggled", new
        {
            ok = true,
            on = result.Value.On,
            gameId = session?.GameId,
            gameName = session?.GameName
        });
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool RegisterHotKey(IntPtr window, int id, uint modifiers, uint virtualKey);

    [DllImport("user32.dll")]
    private static extern bool UnregisterHotKey(IntPtr window, int id);

    public void ExitApplication()
    {
        if (_hotkeyRegistered)
        {
            UnregisterHotKey(new WindowInteropHelper(this).Handle, ScalingHotkeyId);
            _hotkeyRegistered = false;
        }
        _hwndSource?.RemoveHook(WndProc);
        _reallyClosing = true;
        if (_tray != null)
        {
            _tray.Visible = false;
            _tray.Dispose();
            _tray = null;
        }
        Close();
        System.Windows.Application.Current.Shutdown();
    }

    private void Window_StateChanged(object? sender, EventArgs e)
    {
        if (_isFullscreen) return;
        RootBorder.BorderThickness = WindowState == WindowState.Maximized ? new Thickness(0) : new Thickness(1);
        if (Launcher == null) return;
        var payload = new { maximized = WindowState == WindowState.Maximized || _isFullscreen };
        Bridge?.Notify("window-state", payload);
    }
}
