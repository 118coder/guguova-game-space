using System.Drawing;
using Color = System.Windows.Media.Color;
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
    private StoreService Store { get; } = new();
    private MediaService Media { get; } = new();
    private LauncherService? Launcher { get; set; }
    private NativeBridge? Bridge { get; set; }

    private async void OnLoaded(object sender, RoutedEventArgs e)
    {
        try
        {
            Store.Load();
            Launcher = new LauncherService(Store);
            Bridge = new NativeBridge(Store, Media, Launcher);

            var cdpPort = Environment.GetEnvironmentVariable("NOVA_CDP_PORT");
            var options = new CoreWebView2EnvironmentOptions();
            if (!string.IsNullOrEmpty(cdpPort))
                options.AdditionalBrowserArguments = $"--remote-debugging-port={cdpPort} --remote-allow-origins=*";
            var env = await CoreWebView2Environment.CreateAsync(null, Path.Combine(AppPaths.Root, "webview2"), options);
            await Web.EnsureCoreWebView2Async(env);
            Bridge.Attach(Web);
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
    private WindowState _stateBeforeFullscreen = WindowState.Normal;
    private Rect _restoreBounds;
    private bool _hasRestoreBounds;

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
            Topmost = true;
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
        menu.Items.Add("显示 NOVA", null, (_, _) => RestoreFromTray());
        menu.Items.Add(new WinForms.ToolStripSeparator());
        menu.Items.Add("退出", null, (_, _) => ExitApplication());
        _tray = new WinForms.NotifyIcon
        {
            Icon = System.Drawing.Icon.ExtractAssociatedIcon(Environment.ProcessPath ?? "") ?? System.Drawing.SystemIcons.Application,
            Text = "NOVA · 游戏空间",
            Visible = true,
            ContextMenuStrip = menu
        };
        _tray.DoubleClick += (_, _) => RestoreFromTray();
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

    public void ExitApplication()
    {
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
