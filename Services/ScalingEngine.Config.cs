// 缩放引擎配置读写：快捷键、算法、窗口倍数与引擎选项表。
// ScalingEngine 的 partial 领域分片之一，见 Services/ScalingEngine.cs 主文件。

using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading;
using Microsoft.Win32;
using NovaGameSpace.Models;

namespace NovaGameSpace.Services;

public static partial class ScalingEngine
{
    /* ------------------------------------------------------------------
       Hotkey config
       ------------------------------------------------------------------ */

    /// <summary>玩家可选的像素类预设（名称与效果定义）。全新机器的引擎配置
    /// 里只有官方模式，这两项不存在，选了就会「找不到算法」——所以首启播种，
    /// 保证玩家选择的模式一定生效。</summary>
    private static readonly (string Name, double Scale)[] PixelPresets =
    {
        ("像素缩放", 1.0),
        ("Integer Scale 2x", 2.0)
    };

    /// <summary>内置引擎首次生成配置后，补齐启动器依赖的项（写前备份）：
    /// ① windowedModeScale 快捷键——Magpie 全新配置里可能缺失或为 0，倍数
    /// 模式靠它触发；② 像素类预设模式（见 PixelPresets）。这是倍数 + 像素
    /// 放大在任何机器上开箱即用的关键。</summary>
    public static void SeedFirstRunConfig()
    {
        try
        {
            var file = ActiveConfigFile();
            if (file == null) return;
            var text = File.ReadAllText(file);
            if (JsonNode.Parse(text) is not JsonObject root) return;
            var changed = false;

            if (root["shortcuts"] is not JsonObject shortcuts)
                root["shortcuts"] = shortcuts = new JsonObject();
            int windowed = -1;
            try { windowed = shortcuts["windowedModeScale"]?.GetValue<int>() ?? -1; } catch { }
            if (windowed <= 0)
            {
                shortcuts["windowedModeScale"] = DefaultWindowedHotkey;
                changed = true;
            }

            if (root["scalingModes"] is JsonArray modes)
            {
                var existing = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var mode in modes)
                {
                    try
                    {
                        var name = (mode as JsonObject)?["name"]?.GetValue<string>();
                        if (!string.IsNullOrWhiteSpace(name)) existing.Add(name);
                    }
                    catch { }
                }
                foreach (var (name, scale) in PixelPresets)
                {
                    if (existing.Contains(name)) continue;
                    modes.Add(new JsonObject
                    {
                        ["name"] = name,
                        ["effects"] = new JsonArray(new JsonObject
                        {
                            ["name"] = "Nearest",
                            ["scalingType"] = 1,
                            ["scale"] = new JsonObject { ["x"] = scale, ["y"] = scale }
                        })
                    });
                    changed = true;
                }
            }

            if (changed)
            {
                AppPaths.Ensure();
                var backup = Path.Combine(AppPaths.Backups, $"magpie-seed-{DateTime.Now:yyyyMMdd-HHmmss}.json");
                File.WriteAllText(backup, text);
                File.WriteAllText(file, root.ToJsonString(new JsonSerializerOptions { WriteIndented = true }));
                Log.Write($"magpie first-run config seeded backup={backup}");
            }
        }
        catch (Exception ex)
        {
            Log.Error("seed magpie config", ex);
        }
    }

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

    /// <summary>Magpie's own shortcut for windowed (factor) scaling. It is a
    /// different key from the fullscreen one, so the two modes never fight.</summary>
    public static int ReadWindowedHotkey()
    {
        var file = ActiveConfigFile();
        if (file == null) return DefaultWindowedHotkey;
        try
        {
            using var document = JsonDocument.Parse(File.ReadAllText(file));
            if (document.RootElement.TryGetProperty("shortcuts", out var shortcuts) &&
                shortcuts.TryGetProperty("windowedModeScale", out var windowed) &&
                windowed.TryGetInt32(out var code) && code > 0)
                return code;
        }
        catch (Exception ex)
        {
            Log.Error("read magpie windowed hotkey", ex);
        }
        return DefaultWindowedHotkey;
    }

    /// <summary>Magpie reads initialWindowedScaleFactor and
    /// customInitialWindowedScaleFactor from the default profile when it
    /// starts. Custom (6) is the only enum value that uses our exact number,
    /// so both fields are written together and a running engine is restarted.
    /// Returns changed=true when the on-disk config actually differed.</summary>
    public static bool WriteWindowedFactor(double factor, out string message, out bool changed)
    {
        message = "";
        changed = false;
        factor = Math.Max(1.1, Math.Min(10, factor));
        var file = ActiveConfigFile();
        if (file == null)
        {
            message = "引擎还没有生成配置；启动一次缩放引擎后才能设置倍数";
            return false;
        }

        try
        {
            var text = File.ReadAllText(file);
            var root = JsonNode.Parse(text) as JsonObject;
            if (root == null) { message = "引擎配置格式无法识别"; return false; }
            if (root["profiles"] is not JsonArray profiles || profiles.Count == 0 || profiles[0] is not JsonObject profile)
            {
                message = "引擎配置里没有可用的缩放配置";
                return false;
            }

            var oldMode = -1;
            double oldFactor = 0;
            try { oldMode = profile["initialWindowedScaleFactor"]?.GetValue<int>() ?? -1; } catch { }
            try { oldFactor = profile["customInitialWindowedScaleFactor"]?.GetValue<double>() ?? 0; } catch { }
            if (oldMode == CustomWindowedScaleFactor && Math.Abs(oldFactor - factor) < 0.001)
            {
                message = "放大倍数已是当前值";
                return true;
            }

            profile["initialWindowedScaleFactor"] = CustomWindowedScaleFactor;
            profile["customInitialWindowedScaleFactor"] = factor;

            AppPaths.Ensure();
            var backup = Path.Combine(AppPaths.Backups, $"magpie-windowed-factor-{DateTime.Now:yyyyMMdd-HHmmss}.json");
            File.WriteAllText(backup, text);
            File.WriteAllText(file, root.ToJsonString(new JsonSerializerOptions { WriteIndented = true }));

            changed = true;
            Log.Write($"magpie windowed factor written {factor:0.##} backup={backup}");
            message = "放大倍数已写入缩放引擎";
            return true;
        }
        catch (Exception ex)
        {
            Log.Error("write magpie windowed factor", ex);
            message = "写入放大倍数失败：" + ex.Message;
            return false;
        }
    }

    /// <summary>The algorithm currently selected in Magpie's default profile,
    /// by name. Used to show the player what the engine is actually using.</summary>
    public static string ReadAlgorithmName()
    {
        var file = ActiveConfigFile();
        if (file == null) return "";
        try
        {
            using var document = JsonDocument.Parse(File.ReadAllText(file));
            var root = document.RootElement;
            if (!root.TryGetProperty("profiles", out var profiles) || profiles.GetArrayLength() == 0) return "";
            var index = profiles[0].TryGetProperty("scalingMode", out var mode) && mode.TryGetInt32(out var value)
                ? value : -1;
            if (index < 0 || !root.TryGetProperty("scalingModes", out var modes) || index >= modes.GetArrayLength()) return "";
            return modes[index].TryGetProperty("name", out var name) ? name.GetString() ?? "" : "";
        }
        catch (Exception ex)
        {
            Log.Error("read magpie algorithm", ex);
            return "";
        }
    }

    /// <summary>Forces Magpie's default profile onto the algorithm the player
    /// picked in the launcher. Saving the name (not the index) keeps pixel
    /// presets such as "Integer Scale 2x" and "像素缩放" stable across config
    /// changes. Empty names leave the engine's own choice alone.</summary>
    public static bool ApplyAlgorithm(string? name, out string message, out bool changed)
    {
        message = "";
        changed = false;
        if (string.IsNullOrWhiteSpace(name)) { message = "跟随引擎当前算法"; return true; }

        var file = ActiveConfigFile();
        if (file == null) { message = "引擎还没有生成配置"; return false; }
        try
        {
            var text = File.ReadAllText(file);
            var root = JsonNode.Parse(text) as JsonObject;
            if (root == null) { message = "引擎配置格式无法识别"; return false; }
            if (root["scalingModes"] is not JsonArray modes || root["profiles"] is not JsonArray profiles ||
                profiles.Count == 0 || profiles[0] is not JsonObject profile)
            {
                message = "引擎配置里没有可用的算法或配置档";
                return false;
            }

            var index = -1;
            for (var i = 0; i < modes.Count; i++)
            {
                var candidate = (modes[i] as JsonObject)?["name"]?.GetValue<string>();
                if (string.Equals(candidate, name, StringComparison.OrdinalIgnoreCase)) { index = i; break; }
            }
            if (index < 0) { message = $"引擎里找不到算法「{name}」"; return false; }

            var current = -1;
            try { current = profile["scalingMode"]?.GetValue<int>() ?? -1; } catch { }
            if (current == index) { message = $"算法已是 {name}"; return true; }

            profile["scalingMode"] = index;
            AppPaths.Ensure();
            var backup = Path.Combine(AppPaths.Backups, $"magpie-algorithm-{DateTime.Now:yyyyMMdd-HHmmss}.json");
            File.WriteAllText(backup, text);
            File.WriteAllText(file, root.ToJsonString(new JsonSerializerOptions { WriteIndented = true }));

            changed = true;
            Log.Write($"magpie algorithm written {name} index={index} backup={backup}");
            message = $"缩放算法已设为 {name}";
            return true;
        }
        catch (Exception ex)
        {
            Log.Error("write magpie algorithm", ex);
            message = "写入缩放算法失败：" + ex.Message;
            return false;
        }
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

    /* ------------------------------------------------------------------
       Simplified options (NOVA's engine sheet)
       ------------------------------------------------------------------ */

    public sealed record ModeOption(int Index, string Name, string Effects, bool Available, string? Missing, string Note);

    /// <summary>One plain-language line per stock scaling mode, so the sheet
    /// tells the player which one to pick instead of only naming effects.</summary>
    private static string NoteFor(string name)
    {
        var key = name.Trim().ToLowerInvariant();
        if (key.Contains("像素超清")) return "Anime4K 放大 + 线条修复，适合像素与二次元画面";
        if (key.Contains("像素缩放")) return "适应屏幕 · 1×1 倍率 · Nearest 不插值，自定义像素模式";
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
        bool FrameRateLimiterEnabled,
        double MaxFrameRate,
        bool GameMode3d);

    public static EngineOptions ReadOptions(PlayerSettings settings)
    {
        var file = ActiveConfigFile();
        if (file == null)
            return new EngineOptions(false, "缩放引擎还没有生成配置；先启动一次引擎", null,
                BundledAvailable, IsRunning(), Array.Empty<ModeOption>(), 0, 0, 6, false, 120, false);

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
                    var effectNames = new List<string>();
                    var effectPaths = new List<(string Name, string Relative)>();
                    if (mode.TryGetProperty("effects", out var effects) &&
                        effects.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var effect in effects.EnumerateArray())
                        {
                            var effectName = effect.TryGetProperty("name", out var effectNameElement)
                                ? effectNameElement.GetString()
                                : null;
                            if (string.IsNullOrWhiteSpace(effectName)) continue;
                            var leaf = effectName!.Replace('\\', '/');
                            var slash = leaf.LastIndexOf('/');
                            effectNames.Add(slash >= 0 ? leaf.Substring(slash + 1) : leaf);
                            effectPaths.Add((effectName, effectName.Replace('\\', '/') + ".hlsl"));
                        }
                    }
                    if (effectsRoot != null)
                    {
                        foreach (var (effectName, relative) in effectPaths)
                        {
                            var path = Path.Combine(effectsRoot, relative.Replace('/', Path.DirectorySeparatorChar));
                            if (!File.Exists(path))
                            {
                                available = false;
                                missing = effectName;
                                break;
                            }
                        }
                    }
                    modes.Add(new ModeOption(index, name, string.Join(" > ", effectNames),
                        available, missing, NoteFor(name)));
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
                modes.ToArray(), selected, Int("captureMethod", 0), Int("cursorScaling", 6),
                Bool("frameRateLimiterEnabled", false), Double("maxFrameRate", 120),
                Bool("3DGameMode", false));
        }
        catch (Exception ex)
        {
            Log.Error("read engine options", ex);
            return new EngineOptions(false, ex.Message, file, status.Bundled, status.Running,
                Array.Empty<ModeOption>(), 0, 0, 6, false, 120, false);
        }
    }

    public static bool SaveOptions(int scalingMode, int captureMethod, int cursorScaling,
        bool frameRateLimiterEnabled, double maxFrameRate, bool gameMode3d, out string message)
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
            var fps = Math.Max(10, Math.Min(1000, maxFrameRate));
            profile["frameRateLimiterEnabled"] = frameRateLimiterEnabled;
            profile["maxFrameRate"] = fps;
            profile["3DGameMode"] = gameMode3d;

            AppPaths.Ensure();
            var backup = Path.Combine(AppPaths.Backups, $"magpie-config-{DateTime.Now:yyyyMMdd-HHmmss}.json");
            File.WriteAllText(backup, text);
            File.WriteAllText(file, root.ToJsonString(new JsonSerializerOptions { WriteIndented = true }));
            Log.Write($"engine options saved mode={mode} capture={captureMethod} cursor={cursorScaling} fpsLimit={frameRateLimiterEnabled}/{fps} 3d={gameMode3d} backup={backup}");
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
}
