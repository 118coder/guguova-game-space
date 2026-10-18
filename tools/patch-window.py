import io
import sys

p = 'MainWindow.xaml.cs'
s = io.open(p, encoding='utf-8').read()

def must(old, new, label):
    global s
    if old not in s:
        print('MISS:', label)
        sys.exit(1)
    s = s.replace(old, new, 1)
    print('ok:', label)

# ---------- maximize == borderless fullscreen ----------
must(
'''    public void ToggleMaximize()
    {
        WindowState = WindowState == WindowState.Maximized ? WindowState.Normal : WindowState.Maximized;
    }''',
'''    /// <summary>
    /// The maximize button and the fullscreen command share one behaviour:
    /// borderless coverage of the current monitor. Keeping a single code path
    /// avoids two subtly different "fill the screen" modes.
    /// </summary>
    public void ToggleMaximize() => SetFullscreen(!_isFullscreen);''',
    'maximize == fullscreen')

# ---------- remember the restore rect ----------
must(
'''    private bool _isFullscreen;
    private WindowState _stateBeforeFullscreen = WindowState.Normal;''',
'''    private bool _isFullscreen;
    private WindowState _stateBeforeFullscreen = WindowState.Normal;
    private Rect _restoreBounds;
    private bool _hasRestoreBounds;''',
    'restore fields')

must(
'''        if (on)
        {
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
            WindowState = _stateBeforeFullscreen == WindowState.Maximized
                ? WindowState.Maximized
                : WindowState.Normal;
            RootBorder.BorderThickness = WindowState == WindowState.Maximized ? new Thickness(0) : new Thickness(1);
        }''',
'''        if (on)
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
        }''',
    'restore geometry')

# ---------- state reports use fullscreen ----------
must(
'''    private void Window_StateChanged(object? sender, EventArgs e)
    {
        if (_isFullscreen) return;
        RootBorder.BorderThickness = WindowState == WindowState.Maximized ? new Thickness(0) : new Thickness(1);
        if (Launcher == null) return;
        var payload = new { maximized = WindowState == WindowState.Maximized };
        Bridge?.Notify("window-state", payload);
    }''',
'''    private void Window_StateChanged(object? sender, EventArgs e)
    {
        if (_isFullscreen) return;
        RootBorder.BorderThickness = WindowState == WindowState.Maximized ? new Thickness(0) : new Thickness(1);
        if (Launcher == null) return;
        var payload = new { maximized = WindowState == WindowState.Maximized || _isFullscreen };
        Bridge?.Notify("window-state", payload);
    }''',
    'state report')

# ---------- dragging a maximized window should restore first ----------
must(
'''    public void BeginNativeDrag()
    {
        var handle = new WindowInteropHelper(this).Handle;
        if (handle == IntPtr.Zero) return;
        ReleaseCapture();
        SendMessage(handle, WmNclButtonDown, HtCaption, IntPtr.Zero);
    }''',
'''    public void BeginNativeDrag()
    {
        var handle = new WindowInteropHelper(this).Handle;
        if (handle == IntPtr.Zero) return;

        // Dragging a fullscreen window would leave it stuck to the monitor edge,
        // so exit fullscreen first and continue the drag from the restored size.
        if (_isFullscreen) SetFullscreen(false);

        ReleaseCapture();
        SendMessage(handle, WmNclButtonDown, HtCaption, IntPtr.Zero);
    }''',
    'drag restores')

io.open(p, 'w', encoding='utf-8').write(s)
