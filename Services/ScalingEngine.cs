using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading;
using Microsoft.Win32;
using NovaGameSpace.Models;

namespace NovaGameSpace.Services;

/// <summary>
/// The bundled fullscreen upscaler. Magpie is distributed as a separate GPLv3
/// executable under `engine/magpie/`; this class only starts it, hides its main
/// window, keeps its scale hotkey in sync with the launcher setting, and reports
/// its state. The launcher never links to it.
/// </summary>
public static class ScalingEngine
{
    public sealed record Status(
        bool Available,
        string? ExePath,
        bool Running,
        bool Bundled,
        int Hotkey,
        bool Supported,
        string Note);

    public const int DefaultHotkey = 3137; // Alt+Shift+A, also Magpie's default.

    private const string MagpieWindowClass = "Window_Magpie_967EB565-6F73-4E94-AE53-00CC42592A22";
    private const int SwMinimize = 6;
    private const int WmClose = 0x0010;
    private static readonly IntPtr HwndBroadcast = new(0xFFFF);

    private static readonly object Gate = new();
    private static (DateTime At, string? Exe) _lookup = (DateTime.MinValue, null);

    /// <summary>True when this run started the engine itself, so it can be
    /// closed again once no game needs it.</summary>
    private static bool _startedByUs;

    public static string BundledDir => Path.Combine(AppContext.BaseDirectory, "engine", "magpie");
    public static string BundledExe => Path.Combine(BundledDir, "Magpie.exe");
    public static bool BundledAvailable => File.Exists(BundledExe);

    /* ------------------------------------------------------------------
       Detection
       ------------------------------------------------------------------ */

    public static bool Supported => Environment.OSVersion.Platform == PlatformID.Win32NT &&
                                    Environment.OSVersion.Version.Major >= 10;

    public static bool IsRunning()
    {
        var processes = Process.GetProcessesByName("Magpie");
        foreach (var process in processes) process.Dispose();
        return processes.Length > 0;
    }

    public static string? RunningExe()
    {
        try
        {
            foreach (var process in Process.GetProcessesByName("Magpie"))
            {
                using (process)
                {
                    try
                    {
                        var path = process.MainModule?.FileName;
                        if (!string.IsNullOrWhiteSpace(path)) return path;
                    }
                    catch { }
                }
            }
        }
        catch { }
        return null;
    }

    public static Status Inspect(PlayerSettings settings)
    {
        var exe = FindExe(settings);
        var running = IsRunning();
        var bundled = exe != null && IsBundledPath(exe);
        var hotkey = ReadHotkey();

        if (!Supported)
            return new Status(false, exe, running, bundled, hotkey, false,
                "Magpie 需要 Windows 10 1903 或更新版本；这台机器会用无边框全屏");
        if (string.IsNullOrWhiteSpace(exe))
            return new Status(false, null, running, false, hotkey, true,
                "没有找到缩放引擎；会用好内置的无边框全屏");

        var note = running
            ? (bundled ? "内置引擎正在运行" : "系统 Magpie 正在运行")
            : (bundled ? "内置引擎已就绪，启动游戏时会自动打开" : "已找到系统 Magpie；启动游戏时会自动打开");
        return new Status(true, exe, running, bundled, hotkey, true, note);
    }

    public static string? FindExe(PlayerSettings settings)
    {
        if (!string.IsNullOrWhiteSpace(settings.MagpiePath) && File.Exists(settings.MagpiePath))
            return settings.MagpiePath;

        var running = RunningExe();
        if (!string.IsNullOrWhiteSpace(running)) return running;

        if (BundledAvailable) return BundledExe;

        lock (Gate)
        {
            if ((DateTime.UtcNow - _lookup.At).TotalSeconds < 30) return _lookup.Exe;
        }

        var found = FindInRegistry();
        if (string.IsNullOrWhiteSpace(found)) found = FindInCommonFolders();
        lock (Gate) _lookup = (DateTime.UtcNow, found);
        return found;
    }

    private static bool IsBundledPath(string path)
    {
        try
        {
            var full = Path.GetFullPath(path);
            var root = Path.GetFullPath(BundledDir)
                .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar;
            return full.StartsWith(root, StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            return false;
        }
    }

    private static string? FindInRegistry()
    {
        foreach (var root in new[]
        {
            @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
            @"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
        })
        {
            var found = FindInUninstall(Registry.CurrentUser, root) ?? FindInUninstall(Registry.LocalMachine, root);
            if (!string.IsNullOrWhiteSpace(found)) return found;
        }
        return null;
    }

    private static string? FindInUninstall(RegistryKey root, string path)
    {
        try
        {
            using var uninstall = root.OpenSubKey(path);
            if (uninstall == null) return null;
            foreach (var name in uninstall.GetSubKeyNames())
            {
                using var entry = uninstall.OpenSubKey(name);
                if (entry == null) continue;
                var display = entry.GetValue("DisplayName") as string;
                if (string.IsNullOrWhiteSpace(display) || display.IndexOf("Magpie", StringComparison.OrdinalIgnoreCase) < 0) continue;

                var icon = CleanExecutablePath(entry.GetValue("DisplayIcon") as string);
                if (icon != null && File.Exists(icon)) return icon;

                var folder = entry.GetValue("InstallLocation") as string;
                if (!string.IsNullOrWhiteSpace(folder))
                {
                    var exe = Path.Combine(folder.Trim('"'), "Magpie.exe");
                    if (File.Exists(exe)) return exe;
                }
            }
        }
        catch { }
        return null;
    }

    private static string? FindInCommonFolders()
    {
        var local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        var programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        var programFilesX86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
        foreach (var candidate in new[]
        {
            Path.Combine(local, "Magpie", "Magpie.exe"),
            Path.Combine(local, "Programs", "Magpie", "Magpie.exe"),
            Path.Combine(programFiles, "Magpie", "Magpie.exe"),
            Path.Combine(programFilesX86, "Magpie", "Magpie.exe")
        })
        {
            if (File.Exists(candidate)) return candidate;
        }
        return null;
    }

    private static string? CleanExecutablePath(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var text = value.Trim().Trim('"');
        var comma = text.LastIndexOf(',');
        if (comma > 0) text = text.Substring(0, comma).Trim().Trim('"');
        return text;
    }

    /* ------------------------------------------------------------------
       Start / stop / hide
       ------------------------------------------------------------------ */

    /// <summary>Starts the engine when a launch asks for scaling. Returns false
    /// when there is no engine or the player turned auto-start off.</summary>
    public static bool EnsureRunning(PlayerSettings settings, bool force, out Status status)
    {
        var exe = FindExe(settings);
        if (IsRunning())
        {
            status = Inspect(settings);
            return true;
        }

        if (!Supported || string.IsNullOrWhiteSpace(exe) || (!force && !settings.AutoStartEngine))
        {
            status = Inspect(settings);
            return false;
        }

        var configBefore = ActiveConfigFile();
        if (configBefore != null && settings.ScalingHotkey > 0 &&
            ReadHotkey() != settings.ScalingHotkey)
        {
            // Not running yet: write the shortcut so the new process registers
            // the same key the player picked in the launcher.
            WriteHotkey(settings.ScalingHotkey, out _);
        }

        if (!StartProcess(exe, out var error))
        {
            status = Inspect(settings) with { Note = "启动缩放引擎失败：" + error };
            return false;
        }

        // A first run creates the config with Magpie's defaults. If the player
        // chose something else, write it and restart once.
        if (configBefore == null)
        {
            var deadline = DateTime.UtcNow.AddSeconds(6);
            while (DateTime.UtcNow < deadline && ActiveConfigFile() == null) Thread.Sleep(250);
            if (ActiveConfigFile() != null && settings.ScalingHotkey > 0 &&
                ReadHotkey() != settings.ScalingHotkey)
            {
                WriteHotkey(settings.ScalingHotkey, out _);
                Restart(settings, out _);
            }
        }

        status = Inspect(settings);
        return status.Running;
    }

    private static bool StartProcess(string exe, out string? error)
    {
        error = null;
        try
        {
            var process = Process.Start(new ProcessStartInfo
            {
                FileName = exe,
                WorkingDirectory = Path.GetDirectoryName(exe),
                UseShellExecute = false
            });
            if (process == null)
            {
                error = "系统没有返回进程信息";
                return false;
            }

            _startedByUs = true;
            var pid = process.Id;
            var deadline = DateTime.UtcNow.AddSeconds(15);
            while (DateTime.UtcNow < deadline && !IsRunning()) Thread.Sleep(200);
            Thread.Sleep(900);
            HideMainWindow(pid);
            return true;
        }
        catch (Exception ex)
        {
            Log.Error("start scaling engine", ex);
            error = ex.Message;
            return false;
        }
    }

    /// <summary>Closes Magpie's settings window. With the tray icon enabled the
    /// process stays alive and keeps its hotkeys; otherwise it is minimized.</summary>
    private static void HideMainWindow(int pid)
    {
        try
        {
            IntPtr window = IntPtr.Zero;
            var deadline = DateTime.UtcNow.AddSeconds(8);
            while (DateTime.UtcNow < deadline && window == IntPtr.Zero)
            {
                window = FindMainWindow(pid);
                if (window == IntPtr.Zero) Thread.Sleep(250);
            }
            if (window == IntPtr.Zero) return;

            if (ShowNotifyIcon())
            {
                PostMessage(window, WmClose, IntPtr.Zero, IntPtr.Zero);
                Thread.Sleep(700);
                if (IsWindowVisible(window)) ShowWindow(window, SwMinimize);
                return;
            }

            ShowWindow(window, SwMinimize);
            Thread.Sleep(400);
            if (IsWindowVisible(window) && IsIconic(window))
            {
                // Minimized but still on screen? Nothing else to do.
                return;
            }
        }
        catch (Exception ex)
        {
            Log.Error("hide magpie window", ex);
        }
    }

    private static IntPtr FindMainWindow(int pid)
    {
        var best = IntPtr.Zero;
        long bestArea = 0;
        EnumWindows((window, _) =>
        {
            uint owner;
            GetWindowThreadProcessId(window, out owner);
            if (owner != (uint)pid) return true;
            if (!IsWindowVisible(window)) return true;
            if (GetWindowTextLength(window) == 0) return true;
            var className = GetClassNameText(window);
            if (className == MagpieWindowClass) return true;
            if (!GetWindowRectA(window, out var rect)) return true;
            var area = (long)(rect.Right - rect.Left) * (rect.Bottom - rect.Top);
            if (area > bestArea) { bestArea = area; best = window; }
            return true;
        }, IntPtr.Zero);
        return best;
    }

    /// <summary>Shuts the engine down only when NOVA started it for a game.
    /// A player-run Magpie (or one started from the settings button) stays.</summary>
    public static void ReleaseIfAutoStarted()
    {
        lock (Gate)
        {
            if (!_startedByUs) return;
            _startedByUs = false;
        }
        if (IsRunning())
        {
            Log.Write("scaling engine released (auto-started, no game running)");
            Quit();
        }
    }

    public static bool Quit()
    {
        if (!IsRunning()) return true;
        try
        {
            var message = RegisterWindowMessage("WM_MAGPIE_QUIT");
            if (message != 0) PostMessage(HwndBroadcast, unchecked((int)message), IntPtr.Zero, IntPtr.Zero);
        }
        catch (Exception ex)
        {
            Log.Error("quit magpie", ex);
        }

        var deadline = DateTime.UtcNow.AddSeconds(10);
        while (DateTime.UtcNow < deadline && IsRunning()) Thread.Sleep(300);
        return !IsRunning();
    }

    public static bool Restart(PlayerSettings settings, out string message)
    {
        if (!Quit())
        {
            message = "缩放引擎没有响应退出请求；请从托盘退出 Magpie 后重试";
            return false;
        }

        Thread.Sleep(700);
        var exe = FindExe(settings);
        if (string.IsNullOrWhiteSpace(exe) || !File.Exists(exe))
        {
            message = "没有找到缩放引擎";
            return false;
        }

        if (!StartProcess(exe, out var error))
        {
            message = "无法重新启动缩放引擎：" + error;
            return false;
        }

        message = "缩放引擎已重新启动";
        return true;
    }

    /* ------------------------------------------------------------------
       Hotkey config
       ------------------------------------------------------------------ */

    public static string? ActiveConfigFile()
    {
        try
        {
            var root = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Magpie", "config");
            if (!Directory.Exists(root)) return null;
            return Directory.GetDirectories(root)
                .Select(path => (Path: path, Version: VersionOfConfigFolder(path)))
                .Where(entry => entry.Version >= 0)
                .OrderByDescending(entry => entry.Version)
                .Select(entry => Path.Combine(entry.Path, "config.json"))
                .FirstOrDefault(File.Exists);
        }
        catch
        {
            return null;
        }
    }

    private static int VersionOfConfigFolder(string path)
    {
        var name = Path.GetFileName(path);
        if (string.IsNullOrEmpty(name) || name[0] != 'v') return -1;
        return int.TryParse(name.Substring(1), out var value) ? value : -1;
    }

    /// <summary>The running engine's scale hotkey, as stored by Magpie itself.</summary>
    public static int ReadHotkey()
    {
        var file = ActiveConfigFile();
        if (file == null) return DefaultHotkey;
        try
        {
            using var document = JsonDocument.Parse(File.ReadAllText(file));
            if (document.RootElement.TryGetProperty("shortcuts", out var shortcuts) &&
                shortcuts.TryGetProperty("scale", out var scale) &&
                scale.TryGetInt32(out var code) && code > 0)
            {
                return code;
            }
        }
        catch (Exception ex)
        {
            Log.Error("read magpie hotkey", ex);
        }
        return DefaultHotkey;
    }

    public static bool WriteHotkey(int code, out string message)
    {
        message = "";
        if (code <= 0) { message = "快捷键无效"; return false; }
        var file = ActiveConfigFile();
        if (file == null)
        {
            message = "引擎还没有生成配置；先启动一次引擎再设置快捷键";
            return false;
        }

        try
        {
            var text = File.ReadAllText(file);
            var root = JsonNode.Parse(text) as JsonObject;
            if (root == null) { message = "引擎配置格式无法识别"; return false; }

            if (root["shortcuts"] is not JsonObject shortcuts)
            {
                shortcuts = new JsonObject();
                root["shortcuts"] = shortcuts;
            }
            shortcuts["scale"] = code;

            AppPaths.Ensure();
            var backup = Path.Combine(AppPaths.Backups, $"magpie-config-{DateTime.Now:yyyyMMdd-HHmmss}.json");
            File.WriteAllText(backup, text);
            File.WriteAllText(file, root.ToJsonString(new JsonSerializerOptions { WriteIndented = true }));

            lock (Gate) _lookup = (DateTime.UtcNow, _lookup.Exe);
            Log.Write($"magpie hotkey written {code} backup={backup}");
            message = "快捷键已写入缩放引擎";
            return true;
        }
        catch (Exception ex)
        {
            Log.Error("write magpie hotkey", ex);
            message = "写入快捷键失败：" + ex.Message;
            return false;
        }
    }

    private static bool ShowNotifyIcon()
    {
        var file = ActiveConfigFile();
        if (file == null) return true;
        try
        {
            using var document = JsonDocument.Parse(File.ReadAllText(file));
            return !document.RootElement.TryGetProperty("showNotifyIcon", out var value) ||
                   value.ValueKind != JsonValueKind.False;
        }
        catch
        {
            return true;
        }
    }

    /* ------------------------------------------------------------------
       Simplified options (NOVA's engine sheet)
       ------------------------------------------------------------------ */

    public sealed record ModeOption(int Index, string Name, bool Available, string? Missing, string Note);

    /// <summary>One plain-language line per stock scaling mode, so the sheet
    /// tells the player which one to pick instead of only naming effects.</summary>
    private static string NoteFor(string name)
    {
        var key = name.Trim().ToLowerInvariant();
        if (key.StartsWith("lanczos")) return "通用清晰缩放，速度快，适合大多数游戏";
        if (key.StartsWith("fsr") && !key.StartsWith("fsrcnnx")) return "功能全面，画面干净、开销低，适合大部分游戏";
        if (key.StartsWith("fsrcnnx")) return "神经网络放大，细节更锐，显卡要求较高";
        if (key.StartsWith("cunny")) return "二次元线条强化，需要较强的显卡";
        if (key.StartsWith("anime4k")) return "动画/卡通画面专用，近似手绘线稿";
        if (key.StartsWith("crt")) return "模拟 CRT 显像管，适合复古与街机";
        if (key.StartsWith("integer")) return "整数倍放大，像素游戏首选，边缘不糊";
        if (key.StartsWith("nearest")) return "不插值放大，像素边缘最硬，适合像素游戏";
        if (key.StartsWith("bilinear")) return "最省显卡的平滑放大，适合低配机器";
        if (key.StartsWith("bicubic")) return "比双线性更顺滑，开销仍然很低";
        if (key.StartsWith("jinc")) return "高质量平滑缩放，适合照片与实拍";
        if (key.StartsWith("fsr") || key.Contains("eas")) return "功能全面，适合大部分游戏";
        return "自定义缩放模式";
    }

    public sealed record EngineOptions(
        bool Ok,
        string? Error,
        string? ConfigPath,
        bool Bundled,
        bool Running,
        ModeOption[] Modes,
        int ScalingMode,
        int CaptureMethod,
        int CursorScaling,
        double MaxFrameRate,
        bool GameMode3d);

    public static EngineOptions ReadOptions(PlayerSettings settings)
    {
        var file = ActiveConfigFile();
        if (file == null)
            return new EngineOptions(false, "缩放引擎还没有生成配置；先启动一次引擎", null,
                BundledAvailable, IsRunning(), Array.Empty<ModeOption>(), 0, 0, 2, 60, false);

        var status = Inspect(settings);
        var effectsRoot = EffectsRootFor(settings);
        try
        {
            using var document = JsonDocument.Parse(File.ReadAllText(file));
            var root = document.RootElement;
            var modes = new List<ModeOption>();
            if (root.TryGetProperty("scalingModes", out var modesElement) && modesElement.ValueKind == JsonValueKind.Array)
            {
                var index = 0;
                foreach (var mode in modesElement.EnumerateArray())
                {
                    var name = mode.TryGetProperty("name", out var nameElement)
                        ? nameElement.GetString() ?? $"模式 {index + 1}"
                        : $"模式 {index + 1}";
                    string? missing = null;
                    var available = true;
                    if (effectsRoot != null && mode.TryGetProperty("effects", out var effects) &&
                        effects.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var effect in effects.EnumerateArray())
                        {
                            var effectName = effect.TryGetProperty("name", out var effectNameElement)
                                ? effectNameElement.GetString()
                                : null;
                            if (string.IsNullOrWhiteSpace(effectName)) continue;
                            var relative = effectName!.Replace('\\', '/') + ".hlsl";
                            var path = Path.Combine(effectsRoot, relative.Replace('/', Path.DirectorySeparatorChar));
                            if (!File.Exists(path))
                            {
                                available = false;
                                missing = effectName;
                                break;
                            }
                        }
                    }
                    modes.Add(new ModeOption(index, name, available, missing, NoteFor(name)));
                    index++;
                }
            }

            var profile = default(JsonElement);
            if (root.TryGetProperty("profiles", out var profiles) &&
                profiles.ValueKind == JsonValueKind.Array && profiles.GetArrayLength() > 0)
            {
                profile = profiles[0];
            }

            int Int(string name, int fallback) => profile.ValueKind == JsonValueKind.Object &&
                profile.TryGetProperty(name, out var value) && value.TryGetInt32(out var number) ? number : fallback;
            double Double(string name, double fallback) => profile.ValueKind == JsonValueKind.Object &&
                profile.TryGetProperty(name, out var value) && value.TryGetDouble(out var number) ? number : fallback;
            bool Bool(string name, bool fallback) => profile.ValueKind == JsonValueKind.Object &&
                profile.TryGetProperty(name, out var value) && value.ValueKind is JsonValueKind.True or JsonValueKind.False
                    ? value.GetBoolean()
                    : fallback;

            var selected = Int("scalingMode", 0);
            if (selected < 0 || selected >= modes.Count) selected = 0;
            return new EngineOptions(true, null, file, status.Bundled, status.Running,
                modes.ToArray(), selected, Int("captureMethod", 0), Int("cursorScaling", 2),
                Double("maxFrameRate", 60), Bool("3DGameMode", false));
        }
        catch (Exception ex)
        {
            Log.Error("read engine options", ex);
            return new EngineOptions(false, ex.Message, file, status.Bundled, status.Running,
                Array.Empty<ModeOption>(), 0, 0, 2, 60, false);
        }
    }

    public static bool SaveOptions(int scalingMode, int captureMethod, int cursorScaling,
        double maxFrameRate, bool gameMode3d, out string message)
    {
        message = "";
        var file = ActiveConfigFile();
        if (file == null)
        {
            message = "缩放引擎还没有生成配置";
            return false;
        }

        try
        {
            var text = File.ReadAllText(file);
            var root = JsonNode.Parse(text) as JsonObject;
            if (root == null)
            {
                message = "引擎配置格式无法识别";
                return false;
            }
            if (root["profiles"] is not JsonArray profiles || profiles.Count == 0 ||
                profiles[0] is not JsonObject profile)
            {
                message = "引擎配置里没有默认配置档";
                return false;
            }

            var modeCount = root["scalingModes"] is JsonArray modes ? modes.Count : 0;
            var mode = modeCount == 0 ? 0 : Math.Max(0, Math.Min(scalingMode, modeCount - 1));
            profile["scalingMode"] = mode;
            profile["captureMethod"] = Math.Max(0, Math.Min(2, captureMethod));
            profile["cursorScaling"] = Math.Max(0, cursorScaling);
            profile["maxFrameRate"] = Math.Max(10, Math.Min(1000, maxFrameRate));
            profile["3DGameMode"] = gameMode3d;

            AppPaths.Ensure();
            var backup = Path.Combine(AppPaths.Backups, $"magpie-config-{DateTime.Now:yyyyMMdd-HHmmss}.json");
            File.WriteAllText(backup, text);
            File.WriteAllText(file, root.ToJsonString(new JsonSerializerOptions { WriteIndented = true }));
            Log.Write($"engine options saved mode={mode} capture={captureMethod} cursor={cursorScaling} fps={maxFrameRate} 3d={gameMode3d} backup={backup}");
            message = "缩放引擎设置已保存";
            return true;
        }
        catch (Exception ex)
        {
            Log.Error("save engine options", ex);
            message = "保存失败：" + ex.Message;
            return false;
        }
    }

    private static string? EffectsRootFor(PlayerSettings settings)
    {
        var exe = FindExe(settings);
        if (string.IsNullOrWhiteSpace(exe)) return null;
        var folder = Path.GetDirectoryName(exe);
        return string.IsNullOrWhiteSpace(folder) ? null : Path.Combine(folder, "effects");
    }

    /// <summary>Brings Magpie's own window forward (or starts it visibly).</summary>
    public static bool Show(PlayerSettings settings, out string message)
    {
        if (IsRunning())
        {
            try
            {
                var id = RegisterWindowMessage("WM_MAGPIE_SHOWME");
                if (id != 0) PostMessage(HwndBroadcast, unchecked((int)id), IntPtr.Zero, IntPtr.Zero);
                message = "已打开完整 Magpie";
                return true;
            }
            catch (Exception ex)
            {
                Log.Error("show magpie", ex);
                message = ex.Message;
                return false;
            }
        }

        var exe = FindExe(settings);
        if (string.IsNullOrWhiteSpace(exe) || !File.Exists(exe))
        {
            message = "没有找到缩放引擎";
            return false;
        }

        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = exe,
                WorkingDirectory = Path.GetDirectoryName(exe),
                UseShellExecute = true
            });
            message = "正在打开完整 Magpie";
            return true;
        }
        catch (Exception ex)
        {
            Log.Error("open magpie", ex);
            message = ex.Message;
            return false;
        }
    }

    /* ------------------------------------------------------------------
       Hotkey encoding
       ------------------------------------------------------------------ */

    public static int Encode(byte vk, bool win, bool ctrl, bool alt, bool shift) =>
        vk | (win ? 0x100 : 0) | (ctrl ? 0x200 : 0) | (alt ? 0x400 : 0) | (shift ? 0x800 : 0);

    public static string Label(int code)
    {
        var parts = new List<string>();
        if ((code & 0x400) != 0) parts.Add("Alt");
        if ((code & 0x200) != 0) parts.Add("Ctrl");
        if ((code & 0x800) != 0) parts.Add("Shift");
        if ((code & 0x100) != 0) parts.Add("Win");
        parts.Add(KeyName((byte)(code & 0xFF)));
        return string.Join(" + ", parts);
    }

    private static string KeyName(byte vk)
    {
        if (vk >= 0x30 && vk <= 0x39) return ((char)vk).ToString();
        if (vk >= 0x41 && vk <= 0x5A) return ((char)vk).ToString();
        if (vk >= 0x70 && vk <= 0x87) return "F" + (vk - 0x6F);
        return vk switch
        {
            0x20 => "Space",
            0x25 => "←",
            0x26 => "↑",
            0x27 => "→",
            0x28 => "↓",
            0x0D => "Enter",
            0x09 => "Tab",
            _ => "VK" + vk
        };
    }

    /* ------------------------------------------------------------------
       Win32
       ------------------------------------------------------------------ */

    private delegate bool EnumWindowsProc(IntPtr window, IntPtr state);

    [StructLayout(LayoutKind.Sequential)]
    private struct Rect
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr state);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr window, out uint pid);

    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr window);

    [DllImport("user32.dll")]
    private static extern bool IsIconic(IntPtr window);

    [DllImport("user32.dll")]
    private static extern bool ShowWindow(IntPtr window, int command);

    [DllImport("user32.dll")]
    private static extern bool GetWindowRect(IntPtr window, out Rect rect);

    [DllImport("user32.dll")]
    private static extern int GetWindowTextLength(IntPtr window);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr window, System.Text.StringBuilder text, int max);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetClassName(IntPtr window, System.Text.StringBuilder text, int max);

    [DllImport("user32.dll")]
    private static extern bool PostMessage(IntPtr window, int message, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern uint RegisterWindowMessage(string name);

    private static bool GetWindowRectA(IntPtr window, out Rect rect) => GetWindowRect(window, out rect);

    private static string GetClassNameText(IntPtr window)
    {
        var builder = new System.Text.StringBuilder(256);
        GetClassName(window, builder, builder.Capacity);
        return builder.ToString();
    }
}
