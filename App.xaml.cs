using System.Diagnostics;
using System.IO;
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

        // Only one process may own the WebView2 user-data folder. When the
        // player launches THIS exe while an older instance is still running,
        // the older one retires: it is terminated and this launch takes over
        // the profile. That is the whole point of opening the new exe — being
        // told "already running" and bounced to a stale build is the bug.
        // If the old instance cannot be retired, fall back to forwarding the
        // activate signal so behaviour never regresses to two WebViews on one
        // user-data folder.
        if (!AcquireSingleInstance())
        {
            Shutdown();
            return;
        }

        WriteInstancePid();
        _activateEvent = new EventWaitHandle(false, EventResetMode.AutoReset, ActivateEventId);
        StartActivationListener();

        Log.Write("app start");
        var window = new MainWindow();
        MainWindow = window;
        window.Show();
    }

    /// <summary>
    /// Takes the profile lock, retiring a running instance first.
    ///
    /// Returns true when this process owns the profile. A dead owner's mutex
    /// comes back as abandoned — the kernel hands ownership over as part of
    /// that wait, so it counts as acquired. When the lock cannot be taken
    /// (an old build refuses to die), the caller falls back to forwarding the
    /// activate signal.
    /// </summary>
    private bool AcquireSingleInstance()
    {
        if (TryAcquireMutex()) return true;

        Log.Write("another instance holds the profile — taking over");
        TerminatePreviousInstance();

        for (var attempt = 0; attempt < 20; attempt++)
        {
            if (TryAcquireMutex()) return true;
            Thread.Sleep(150);
        }

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
        return false;
    }

    private bool TryAcquireMutex()
    {
        // Open-then-wait instead of the all-in-one constructor: on a mutex
        // abandoned by a killed owner, the constructor reports "not first"
        // without ever granting ownership, which dead-locked the takeover.
        // WaitOne on an abandoned mutex DOES grant ownership to the waiter.
        Mutex mutex;
        try
        {
            mutex = Mutex.OpenExisting(InstanceMutexId);
        }
        catch (WaitHandleCannotBeOpenedException)
        {
            // Nobody owns it (yet): create it already owned by us.
            _instanceMutex = new Mutex(true, InstanceMutexId, out _);
            return true;
        }
        catch (Exception ex)
        {
            Log.Error("single instance mutex open", ex);
            return false;
        }

        try
        {
            if (mutex.WaitOne(0))
            {
                _instanceMutex = mutex;
                return true;
            }
            // Held by a live owner.
            mutex.Dispose();
            return false;
        }
        catch (AbandonedMutexException)
        {
            // The owner died holding it: the kernel granted us ownership as
            // part of the abandoned wait.
            _instanceMutex = mutex;
            return true;
        }
        catch (Exception ex)
        {
            Log.Error("single instance mutex wait", ex);
            try { mutex.Dispose(); } catch { /* closing */ }
            return false;
        }
    }

    /// <summary>
    /// Ends the instance standing between the player and this launch.
    ///
    /// Preferred target: the PID file the running instance writes (it follows
    /// the profile, so sandboxed data roots never cross). Older builds never
    /// wrote one, so a sweep by image name covers exactly the case this
    /// feature exists for — replacing an old exe with a new one while the old
    /// one is still running.
    /// </summary>
    private static void TerminatePreviousInstance()
    {
        var killed = 0;
        try
        {
            var self = Process.GetCurrentProcess().Id;

            var stampedPid = 0;
            var pidFile = Path.Combine(AppPaths.Root, "guguova.pid");
            if (File.Exists(pidFile))
                int.TryParse(File.ReadAllText(pidFile).Trim(), out stampedPid);
            if (stampedPid != 0 && stampedPid != self && KillGuguova(stampedPid))
            {
                killed++;
            }

            var name = Process.GetCurrentProcess().ProcessName;
            foreach (var proc in Process.GetProcessesByName(name))
            {
                try
                {
                    if (proc.Id == self || (killed > 0 && proc.Id == stampedPid)) continue;
                    if (!proc.ProcessName.Equals(name, StringComparison.OrdinalIgnoreCase)) continue;
                    KillProcess(proc);
                    killed++;
                }
                catch (Exception ex)
                {
                    Log.Error("terminate previous instance", ex);
                }
                finally
                {
                    proc.Dispose();
                }
            }
        }
        catch (Exception ex)
        {
            Log.Error("terminate previous instance", ex);
        }
        if (killed > 0) Log.Write($"previous instance terminated ({killed})");
    }

    /// <summary>Kills our own image by PID. A recycled PID must never take an
    /// unrelated process down, so the image name is verified first.</summary>
    private static bool KillGuguova(int pid)
    {
        try
        {
            var proc = Process.GetProcessById(pid);
            if (!proc.ProcessName.Equals(Process.GetCurrentProcess().ProcessName, StringComparison.OrdinalIgnoreCase))
                return false;
            KillProcess(proc);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static void KillProcess(Process proc)
    {
#if NETFRAMEWORK
        // net48 has no tree kill. The WebView2 browser process watches its
        // host and shuts down with it, so the launcher alone is enough.
        proc.Kill();
#else
        proc.Kill(true);
#endif
        proc.WaitForExit(5000);
    }

    /// <summary>The PID stamp a later launch reads to find this instance.
    /// Lives under the profile root, so NOVA_DATA_ROOT sandboxes never cross.
    /// </summary>
    private static void WriteInstancePid()
    {
        try
        {
            File.WriteAllText(Path.Combine(AppPaths.Root, "guguova.pid"),
                Process.GetCurrentProcess().Id.ToString());
        }
        catch (Exception ex)
        {
            Log.Error("write instance pid", ex);
        }
    }

    private static void ClearInstancePid()
    {
        try
        {
            var file = Path.Combine(AppPaths.Root, "guguova.pid");
            // Only remove our own stamp: a successor that took over has
            // already written its own.
            if (File.Exists(file)
                && File.ReadAllText(file).Trim() == Process.GetCurrentProcess().Id.ToString())
            {
                File.Delete(file);
            }
        }
        catch (Exception ex)
        {
            Log.Error("clear instance pid", ex);
        }
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
        ClearInstancePid();
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
