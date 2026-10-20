using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Threading;
using Microsoft.Win32;

namespace NovaGameSpace.Services;

/// <summary>
/// Detects and repairs the two configurations that make Steam show an UAC
/// prompt on every game launch:
///
/// * the "Run this program as an administrator" compatibility flag on
///   steam.exe (HKCU AppCompatFlags\Layers), which Windows honours whenever the
///   launcher activates steam:// — even while the client is already running;
/// * a client that was started elevated by hand.
///
/// Removing the flag is a per-user, reversible write. The original value is
/// saved under the app's backups folder before it is touched, and the running
/// client has to be restarted once because a process cannot lower its own
/// integrity level.
/// </summary>
public static class SteamPrivilege
{
    public sealed record State(
        bool Installed,
        string? SteamExe,
        string? AdminLayer,
        bool Running,
        bool SteamElevated,
        bool LauncherElevated,
        bool NeedsFix,
        string Note);

    public sealed record RepairResult(bool Ok, bool Removed, string? Original, string? Backup, string? Error);

    public sealed record RestartResult(bool Ok, bool Stopped, bool Started, string Message);

    private const string LayersPath = @"Software\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers";
    private const uint ProcessQueryLimitedInformation = 0x1000;
    private const uint TokenQuery = 0x0008;
    private const int TokenElevation = 20;

    public static State Diagnose()
    {
        var steam = SteamService.Detect(true);
        var exe = string.IsNullOrWhiteSpace(steam.Root) ? null : Path.Combine(steam.Root, "steam.exe");
        if (exe != null && !File.Exists(exe)) exe = null;

        var layer = ReadAdminLayer(exe);
        var steamElevated = IsAnySteamElevated();
        var launcherElevated = IsElevated(Process.GetCurrentProcess());
        var needsFix = layer != null || steamElevated;

        string note;
        if (layer != null && steamElevated)
            note = "Steam 被设置为「以管理员身份运行」，且当前客户端确实在管理员权限下运行：每次启动游戏都会弹 UAC，游戏窗口也可能被启动器挡住。";
        else if (layer != null)
            note = "Steam 被设置为「以管理员身份运行」：每次由启动器唤起都会弹 UAC。当前客户端已是普通权限，移除标记即可。";
        else if (steamElevated)
            note = "Steam 客户端当前以管理员权限运行：启动游戏可能触发 UAC，游戏窗口也可能无法被置前。";
        else
            note = "Steam 以普通权限运行，不会再触发提权弹窗。";

        if (launcherElevated)
            note += " GUGUOVA 自身也在管理员权限下运行，建议关闭后以普通权限重新打开。";

        return new State(steam.Installed, exe, layer, steam.Running, steamElevated, launcherElevated, needsFix, note);
    }

    /// <summary>Removes RUNASADMIN from the steam.exe compatibility layer.
    /// Other flags (HIGHDPIAWARE, for example) are preserved.</summary>
    public static RepairResult RemoveAdminLayer()
    {
        var state = Diagnose();
        if (string.IsNullOrWhiteSpace(state.SteamExe))
            return new RepairResult(false, false, null, null, "没有找到 Steam 安装位置");
        if (state.AdminLayer == null)
            return new RepairResult(true, false, null, null, null);

        try
        {
            AppPaths.Ensure();
            var stamp = DateTime.Now.ToString("yyyyMMdd-HHmmss");
            var backup = Path.Combine(AppPaths.Backups, $"steam-privilege-{stamp}.json");
            File.WriteAllText(backup, JsonSerializer.Serialize(new
            {
                at = DateTime.UtcNow.ToString("o"),
                steamExe = state.SteamExe,
                valueName = FindLayerValueName(state.SteamExe) ?? state.SteamExe,
                original = state.AdminLayer,
                note = "删除 Steam.exe 的 RUNASADMIN 兼容性标记前备份；恢复时把 original 写回 Layers 的同名值即可。"
            }, new JsonSerializerOptions { WriteIndented = true }));

            using var layers = Registry.CurrentUser.OpenSubKey(LayersPath, true);
            if (layers == null)
                return new RepairResult(false, false, state.AdminLayer, backup, "无法打开兼容性标记注册表");

            var name = FindLayerValueName(state.SteamExe);
            if (name == null)
                return new RepairResult(true, false, state.AdminLayer, backup, null);

            var tokens = (state.AdminLayer ?? "")
                .Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries)
                .Where(token => !string.Equals(token, "RUNASADMIN", StringComparison.OrdinalIgnoreCase))
                .ToList();

            if (tokens.Count == 0 || (tokens.Count == 1 && tokens[0] == "~"))
                layers.DeleteValue(name, false);
            else
                layers.SetValue(name, string.Join(" ", tokens), RegistryValueKind.String);

            Log.Write($"steam admin layer removed ({name}) original=\"{state.AdminLayer}\" backup={backup}");
            return new RepairResult(true, true, state.AdminLayer, backup, null);
        }
        catch (Exception ex)
        {
            Log.Error("remove steam admin layer", ex);
            return new RepairResult(false, false, state.AdminLayer, null, ex.Message);
        }
    }

    /// <summary>Asks the client to exit, then starts it again with the current
    /// (non-elevated) token. Steam may refuse the shutdown request when it runs
    /// at a higher integrity level; the caller tells the player to close it by
    /// hand in that case.</summary>
    public static RestartResult RestartClient()
    {
        var state = Diagnose();
        if (string.IsNullOrWhiteSpace(state.SteamExe) || !File.Exists(state.SteamExe))
            return new RestartResult(false, false, false, "没有找到 Steam.exe");

        var stopped = !SteamService.IsClientRunning();
        if (!stopped)
        {
            try
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = state.SteamExe,
                    Arguments = "-shutdown",
                    UseShellExecute = false,
                    CreateNoWindow = true
                });
            }
            catch (Exception ex)
            {
                Log.Error("steam shutdown request", ex);
            }

            var deadline = DateTime.UtcNow.AddSeconds(18);
            while (DateTime.UtcNow < deadline)
            {
                if (!SteamService.IsClientRunning()) { stopped = true; break; }
                Thread.Sleep(500);
            }
        }

        if (!stopped)
        {
            return new RestartResult(false, false, false,
                "Steam 没有响应退出请求（管理员权限下可能拒绝）。请从托盘的 Steam 菜单选择「退出」，再重新打开它。");
        }

        // Give the client a moment to release its mutex and pipe.
        Thread.Sleep(1200);

        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = state.SteamExe,
                UseShellExecute = false,
                WorkingDirectory = state.SteamExe is null ? null : Path.GetDirectoryName(state.SteamExe)
            });

            var deadline = DateTime.UtcNow.AddSeconds(20);
            while (DateTime.UtcNow < deadline)
            {
                if (SteamService.IsClientRunning())
                {
                    var elevatedAfter = IsAnySteamElevated();
                    var signedIn = SteamService.Detect(true).SignedIn;
                    if (elevatedAfter)
                        return new RestartResult(true, true, true, "Steam 已重新启动，但仍以管理员权限运行，请检查兼容性设置。");
                    return new RestartResult(true, true, true, signedIn
                        ? "Steam 已用普通权限重新启动。"
                        : "Steam 已用普通权限重新启动；如果客户端要求登录，先登录即可，之后启动游戏不会再弹 UAC。");
                }
                Thread.Sleep(500);
            }

            return new RestartResult(false, true, false, "Steam 没有在 20 秒内重新启动，请手动打开它。");
        }
        catch (Exception ex)
        {
            Log.Error("restart steam", ex);
            return new RestartResult(false, true, false, "无法重新启动 Steam：" + ex.Message);
        }
    }

    public static bool LauncherIsElevated()
    {
        try { return IsElevated(Process.GetCurrentProcess()); } catch { return false; }
    }

    private static string? ReadAdminLayer(string? exe)
    {
        if (string.IsNullOrWhiteSpace(exe)) return null;
        try
        {
            using var layers = Registry.CurrentUser.OpenSubKey(LayersPath);
            if (layers == null) return null;

            var name = FindLayerValueName(exe, layers);
            if (name == null) return null;

            var value = layers.GetValue(name) as string;
            if (string.IsNullOrWhiteSpace(value)) return null;

            var hasRunAsAdmin = value.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries)
                .Any(token => string.Equals(token, "RUNASADMIN", StringComparison.OrdinalIgnoreCase));
            return hasRunAsAdmin ? value : null;
        }
        catch (Exception ex)
        {
            Log.Error("read steam compat layer", ex);
            return null;
        }
    }

    private static string? FindLayerValueName(string exe, RegistryKey? layers = null)
    {
        var own = false;
        try
        {
            if (layers == null)
            {
                layers = Registry.CurrentUser.OpenSubKey(LayersPath);
                if (layers == null) return null;
                own = true;
            }

            var target = Normalize(exe);
            foreach (var name in layers.GetValueNames())
            {
                if (string.Equals(Normalize(name), target, StringComparison.OrdinalIgnoreCase))
                    return name;
            }
            return null;
        }
        finally
        {
            if (own) layers?.Dispose();
        }
    }

    private static string Normalize(string path)
    {
        var text = path.Trim().Trim('"');
        try { text = Path.GetFullPath(text); } catch { }
        return text.TrimEnd('\\', '/');
    }

    private static bool IsAnySteamElevated()
    {
        try
        {
            foreach (var process in Process.GetProcessesByName("steam"))
            {
                using (process)
                {
                    if (IsElevated(process)) return true;
                }
            }
        }
        catch
        {
            // Process enumeration is best-effort; the registry still answers
            // whether the client is running.
        }
        return false;
    }

    private static bool IsElevated(Process process)
    {
        var handle = IntPtr.Zero;
        var token = IntPtr.Zero;
        try
        {
            handle = OpenProcess(ProcessQueryLimitedInformation, false, process.Id);
            if (handle == IntPtr.Zero) return false;
            if (!OpenProcessToken(handle, TokenQuery, out token)) return false;
            if (!GetTokenInformation(token, TokenElevation, out var elevated, sizeof(int), out _)) return false;
            return elevated != 0;
        }
        catch
        {
            return false;
        }
        finally
        {
            if (token != IntPtr.Zero) CloseHandle(token);
            if (handle != IntPtr.Zero) CloseHandle(handle);
        }
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr OpenProcess(uint access, [MarshalAs(UnmanagedType.Bool)] bool inherit, int pid);

    [DllImport("advapi32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool OpenProcessToken(IntPtr process, uint access, out IntPtr token);

    [DllImport("advapi32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetTokenInformation(IntPtr token, int kind, out int info, int length, out int returned);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CloseHandle(IntPtr handle);
}
