// 启动器进程树追踪：用 Windows Job 对象把“启动器本体 + 它派生出来的子进程”
// 当成一个会话。便携登录器常常把真正显示登录窗口的 exe 释放到别处再退出，
// 只看我们启动的那个 pid 会误判为“已经关掉”。

using System.Runtime.InteropServices;

namespace NovaGameSpace.Services;

/// <summary>Tracks everything a separated game launcher starts. A portable
/// wrapper (DNF90's PurpleMagic is one) extracts a second exe and exits, so
/// the pid we started says nothing about whether the login window is still
/// open; the job keeps the whole tree in one place, and an empty job means the
/// player really closed the launcher. Disposing the job never kills its
/// processes — it only drops the accounting handle.</summary>
internal sealed class LauncherJob : IDisposable
{
    private const int JobObjectBasicAccountingInformation = 1;
    private const uint ProcessSetQuota = 0x0100;
    private const uint ProcessTerminate = 0x0001;

    [StructLayout(LayoutKind.Sequential)]
    private struct BasicAccountingInformation
    {
        public long TotalUserTime;
        public long TotalKernelTime;
        public long ThisPeriodTotalUserTime;
        public long ThisPeriodTotalKernelTime;
        public uint TotalPageFaultCount;
        public uint TotalProcesses;
        public uint ActiveProcesses;
        public uint TotalTerminatedProcesses;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr CreateJobObject(IntPtr attributes, string? name);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool QueryInformationJobObject(
        IntPtr job, int infoClass, ref BasicAccountingInformation info, uint length, IntPtr returnedLength);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr OpenProcess(uint access, [MarshalAs(UnmanagedType.Bool)] bool inherit, int processId);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CloseHandle(IntPtr handle);

    private readonly object _gate = new();
    private IntPtr _job;

    private LauncherJob(IntPtr job)
    {
        _job = job;
    }

    /// <summary>Puts an already started process into a fresh job. Returns null
    /// when the OS refuses — an elevated launcher rejects the handle from a
    /// lower integrity level — and callers then keep the plain wait.</summary>
    public static LauncherJob? Attach(int processId)
    {
        if (processId <= 0) return null;
        IntPtr job = IntPtr.Zero;
        IntPtr process = IntPtr.Zero;
        try
        {
            job = CreateJobObject(IntPtr.Zero, null);
            if (job == IntPtr.Zero) return null;
            process = OpenProcess(ProcessSetQuota | ProcessTerminate, false, processId);
            if (process == IntPtr.Zero || !AssignProcessToJobObject(job, process))
            {
                if (process != IntPtr.Zero) CloseHandle(process);
                CloseHandle(job);
                return null;
            }
            CloseHandle(process);
            return new LauncherJob(job);
        }
        catch
        {
            if (process != IntPtr.Zero) CloseHandle(process);
            if (job != IntPtr.Zero) CloseHandle(job);
            return null;
        }
    }

    /// <summary>Processes of the launcher tree that are still alive; null when
    /// the job cannot be queried, so callers stay conservative.</summary>
    public int? ActiveProcesses()
    {
        lock (_gate)
        {
            if (_job == IntPtr.Zero) return null;
            var info = default(BasicAccountingInformation);
            var ok = QueryInformationJobObject(
                _job,
                JobObjectBasicAccountingInformation,
                ref info,
                (uint)Marshal.SizeOf<BasicAccountingInformation>(),
                IntPtr.Zero);
            return ok ? (int)info.ActiveProcesses : null;
        }
    }

    public void Dispose()
    {
        lock (_gate)
        {
            if (_job == IntPtr.Zero) return;
            CloseHandle(_job);
            _job = IntPtr.Zero;
        }
    }
}
