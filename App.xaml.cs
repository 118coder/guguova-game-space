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

        // The legacy single-exe payload is no longer unpacked here. It used to
        // run before the window existed, so a first launch (or any launch after
        // an update) sat on an invisible process for seconds while ~20 MB of
        // assets and engine binaries were written. MainWindow unpacks it behind
        // the splash instead — a window in ~200 ms beats a faster unpack.

        // Only one process may own the WebView2 user-data folder. Two launches
        // of the SAME build are the common case (double-clicking the icon while
        // the app sits in the tray): that must cost an activation, not a kill
        // followed by a full cold start. A different build still retires the
        // running instance, which is the whole point of opening the new exe.
        if (StartAsOwner() != StartOutcome.Owner)
        {
            Shutdown();
            return;
        }

        WriteInstancePid();
        _activateEvent = new EventWaitHandle(false, EventResetMode.AutoReset, ActivateEventId);
        StartActivationListener();

        Log.Stage("app start");
        var window = new MainWindow();
        MainWindow = window;
        window.Show();
        Log.Stage("window shown");
    }

    /// <summary>What this launch ended up doing with the profile.</summary>
    private enum StartOutcome
    {
        /// <summary>This process now owns the profile and will show the window.</summary>
        Owner,

        /// <summary>The running instance was woken up; this process must exit.</summary>
        Forwarded
    }

    /// <summary>
    /// Takes the profile lock, waking a running instance of the same build and
    /// retiring one of a different build.
    ///
    /// The distinction matters for perceived start-up speed: activating a
    /// window that already exists takes a few milliseconds, while the old
    /// "always retire and take over" rule paid a full WebView2 cold start
    /// (~1.5 s) every time the player clicked the icon while the app was in
    /// the tray. Retiring is still what happens when the build differs —
    /// opening a freshly downloaded exe must never bounce the player back to
    /// the old UI.
    /// </summary>
    private StartOutcome StartAsOwner()
    {
        if (TryAcquireMutex()) return StartOutcome.Owner;

        var stamp = ReadInstanceStamp();
        if (stamp != null && IsSameBuildOnDisk(stamp) && ForwardActivation(stamp.Pid))
        {
            Log.Write("same build already running — activation forwarded");
            return StartOutcome.Forwarded;
        }

        Log.Write("another instance holds the profile — taking over");
        TerminatePreviousInstance();

        for (var attempt = 0; attempt < 20; attempt++)
        {
            if (TryAcquireMutex()) return StartOutcome.Owner;
            Thread.Sleep(150);
        }

        // The lock could not be taken (an old build refuses to die). Waking it
        // is better than ending up with two WebViews on one user-data folder.
        if (ReadInstanceStamp() is { } live && ForwardActivation(live.Pid))
            return StartOutcome.Forwarded;

        return StartOutcome.Forwarded;
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
    /// The identity a running instance writes for later launches: pid, build,
    /// image path, image size and write time. Size + timestamp are what catch
    /// a re-released exe that kept the version number — the file on disk is
    /// then not the file the running process started from, so it retires.
    /// </summary>
    private sealed record InstanceStamp(int Pid, string Version, string ExePath, long Length, long WriteTicks);

    private static string InstanceStampFile => Path.Combine(AppPaths.Root, "guguova.pid");

    /// <summary>True when the running instance is this very build on disk.</summary>
    private static bool IsSameBuildOnDisk(InstanceStamp stamp)
    {
        try
        {
            var self = CurrentExePath();
            if (string.IsNullOrWhiteSpace(self) || string.IsNullOrWhiteSpace(stamp.ExePath)) return false;
            if (!string.Equals(self, stamp.ExePath, StringComparison.OrdinalIgnoreCase)) return false;
            if (!string.Equals(BuildVersion, stamp.Version, StringComparison.OrdinalIgnoreCase)) return false;

            var info = new FileInfo(self);
            if (!info.Exists) return false;
            return info.Length == stamp.Length && info.LastWriteTimeUtc.Ticks == stamp.WriteTicks;
        }
        catch (Exception ex)
        {
            Log.Error("compare instance stamp", ex);
            return false;
        }
    }

    private static string BuildVersion =>
        typeof(App).Assembly.GetName().Version?.ToString() ?? "0.0.0.0";

    private static string? CurrentExePath()
    {
        try
        {
            return Process.GetCurrentProcess().MainModule?.FileName;
        }
        catch
        {
            return null;
        }
    }

    /// <summary>A malformed or legacy stamp simply means "unknown instance":
    /// the caller falls back to the retire-and-take-over path.</summary>
    private static InstanceStamp? ReadInstanceStamp()
    {
        try
        {
            if (!File.Exists(InstanceStampFile)) return null;
            var parts = File.ReadAllText(InstanceStampFile).Trim().Split('|');
            if (parts.Length < 3) return null;
            if (!int.TryParse(parts[0], out var pid) || pid <= 0) return null;

            long.TryParse(parts.Length > 3 ? parts[3] : "0", out var length);
            long.TryParse(parts.Length > 4 ? parts[4] : "0", out var ticks);
            return new InstanceStamp(pid, parts[1], parts[2], length, ticks);
        }
        catch (Exception ex)
        {
            Log.Error("read instance stamp", ex);
            return null;
        }
    }

    /// <summary>Wakes the running instance. AllowSetForegroundWindow is the
    /// part that actually works: the instance being woken up is not the
    /// foreground process, so Windows would only flash its taskbar button.</summary>
    private static bool ForwardActivation(int pid)
    {
        try
        {
            if (pid > 0) AllowSetForegroundWindow(pid);
            if (!EventWaitHandle.TryOpenExisting(ActivateEventId, out var existing)) return false;
            existing.Set();
            existing.Dispose();
            return true;
        }
        catch (Exception ex)
        {
            Log.Error("forward activation", ex);
            return false;
        }
    }

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern bool AllowSetForegroundWindow(int dwProcessId);

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

            var stampedPid = ReadInstanceStamp()?.Pid ?? 0;
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

    /// <summary>The identity a later launch reads to find this instance.
    /// Lives under the profile root, so NOVA_DATA_ROOT sandboxes never cross.
    /// Format: pid|version|exePath|length|writeTicks (see InstanceStamp).</summary>
    private static void WriteInstancePid()
    {
        try
        {
            var exe = CurrentExePath() ?? "";
            var info = string.IsNullOrWhiteSpace(exe) ? null : new FileInfo(exe);
            var line = string.Join("|",
                Process.GetCurrentProcess().Id.ToString(),
                BuildVersion,
                exe,
                (info != null && info.Exists ? info.Length : 0).ToString(),
                (info != null && info.Exists ? info.LastWriteTimeUtc.Ticks : 0).ToString());
            File.WriteAllText(InstanceStampFile, line);
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
            var file = InstanceStampFile;
            // Only remove our own stamp: a successor that took over has
            // already written its own.
            if (File.Exists(file)
                && File.ReadAllText(file).Trim().Split('|')[0] == Process.GetCurrentProcess().Id.ToString())
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
                        // The activation ping is the fallback path: a NEW build
                        // would have killed this process and taken over instead.
                        // In practice it means an old (pre-takeover) exe was
                        // launched while this one held the profile — say so, or
                        // the player just sees "the old version opens as 1.16.1".
                        window.Bridge?.Notify("activated-running", new
                        {
                            version = typeof(App).Assembly.GetName().Version?.ToString(3) ?? ""
                        });
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
