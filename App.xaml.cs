using System.Threading;
using System.Windows;
using NovaGameSpace.Services;

[assembly: ThemeInfo(ResourceDictionaryLocation.None, ResourceDictionaryLocation.SourceAssembly)]

namespace NovaGameSpace;

public sealed partial class App : System.Windows.Application
{
    private const string InstanceMutexId = @"Local\NOVA.GameSpace.SingleInstance";
    private const string ActivateEventId = @"Local\NOVA.GameSpace.Activate";

    private Mutex? _instanceMutex;
    private EventWaitHandle? _activateEvent;

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        AppPaths.Ensure();

        // Only one process may own the WebView2 user-data folder. A second
        // launch would fail to create the browser and show an empty window,
        // so it forwards an "activate" signal to the first instance instead.
        _instanceMutex = new Mutex(true, InstanceMutexId, out var isFirstInstance);
        if (!isFirstInstance)
        {
            try
            {
                if (EventWaitHandle.TryOpenExisting(ActivateEventId, out var existing))
                {
                    existing.Set();
                    existing.Dispose();
                }
            }
            catch (Exception ex)
            {
                Log.Error("single instance activate", ex);
            }
            Shutdown();
            return;
        }

        _activateEvent = new EventWaitHandle(false, EventResetMode.AutoReset, ActivateEventId);
        StartActivationListener();

        Log.Write("app start");
        var window = new MainWindow();
        MainWindow = window;
        window.Show();
    }

    private void StartActivationListener()
    {
        var thread = new Thread(() =>
        {
            try
            {
                while (_activateEvent != null && _activateEvent.WaitOne())
                {
                    Dispatcher.Invoke(() =>
                    {
                        if (MainWindow is not MainWindow window) return;
                        if (window.IsHiddenToTray) window.RestoreFromTray();
                        if (window.WindowState == WindowState.Minimized) window.WindowState = WindowState.Normal;
                        window.Activate();
                    });
                }
            }
            catch
            {
                // The handle is closed during shutdown; nothing to do.
            }
        })
        {
            IsBackground = true,
            Name = "NOVA single-instance listener"
        };
        thread.Start();
    }

    protected override void OnExit(ExitEventArgs e)
    {
        try
        {
            _activateEvent?.Set();
            _activateEvent?.Dispose();
            _instanceMutex?.ReleaseMutex();
            _instanceMutex?.Dispose();
        }
        catch
        {
            // best effort
        }
        base.OnExit(e);
    }
}
