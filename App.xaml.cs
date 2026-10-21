using System.Threading;
using System.Windows;
using NovaGameSpace.Services;

[assembly: ThemeInfo(ResourceDictionaryLocation.None, ResourceDictionaryLocation.SourceAssembly)]

namespace NovaGameSpace;

public sealed partial class App : System.Windows.Application
{
    // A throwaway data root (NOVA_DATA_ROOT) is a separate profile, so it also
    // needs its own single-instance lock: otherwise a smoke test forwarded its
    // activation to the player's running launcher and never showed a window.
    private static readonly string InstanceMutexId = @"Local\GUGUOVA.GameSpace.SingleInstance" + ProfileSuffix();
    private static readonly string ActivateEventId = @"Local\GUGUOVA.GameSpace.Activate" + ProfileSuffix();

    private static string ProfileSuffix()
    {
        var over = Environment.GetEnvironmentVariable("NOVA_DATA_ROOT");
        if (string.IsNullOrWhiteSpace(over)) return "";
        // Names must stay short and free of backslashes for the kernel objects.
        var hash = 17;
        foreach (var ch in over.Trim().ToLowerInvariant())
            unchecked { hash = hash * 31 + ch; }
        return "." + Math.Abs(hash).ToString("x8");
    }

    private Mutex? _instanceMutex;
    private EventWaitHandle? _activateEvent;

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        AppPaths.Ensure();
#if NETFRAMEWORK
        try
        {
            AssetBootstrapper.Ensure();
            WebView2Bootstrapper.Ensure();
            EngineBootstrapper.Ensure();
        }
        catch (Exception ex)
        {
            Log.Error("legacy bootstrap", ex);
        }
#endif

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
