using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Text;
using Microsoft.Win32;
using NovaGameSpace.Models;

namespace NovaGameSpace.Services;

/// <summary>
/// Reads the installed Steam client and decides how one library entry has to be
/// started. Steam games authenticate through the running client's IPC, so
/// starting their exe on its own can end in "Steam 未运行" even when the game is
/// owned — the client, not the folder, is what proves the licence.
/// </summary>
public static class SteamService
{
    public sealed record State(bool Installed, bool Running, bool SignedIn, string? Root, int ActiveUser);

    /// <summary>What an executable needs at runtime. Read from the PE headers, not
    /// guessed from the folder name, because shipped cracks and prototypes differ.</summary>
    public sealed record Dependency(bool UsesSteamApi, bool SteamStub, bool HasAppIdFile, string[] Dlls, string Note);

    private static readonly Dependency Empty = new(false, false, false, Array.Empty<string>(), "");

    private static readonly object Gate = new();
    private static State? _state;
    private static DateTime _stateAt;
    private static readonly Dictionary<string, (DateTime Stamp, Dependency Value)> ExeCache = new();

    /// <summary>Client location and session state. Cached for a few seconds so a
    /// payload build does not hit the registry once per game.</summary>
    public static State Detect(bool refresh = false)
    {
        lock (Gate)
        {
            if (!refresh && _state != null && (DateTime.UtcNow - _stateAt).TotalSeconds < 4) return _state;

            string? root = null;
            var activeUser = 0;
            var pid = 0;
            try
            {
                using var key = Registry.CurrentUser.OpenSubKey(@"Software\Valve\Steam");
                if (key != null)
                {
                    root = NormalizePath(key.GetValue("SteamPath") as string);
                    if (string.IsNullOrEmpty(root))
                    {
                        var steamExe = key.GetValue("SteamExe") as string;
                        if (!string.IsNullOrEmpty(steamExe)) root = NormalizePath(Path.GetDirectoryName(steamExe));
                    }
                }
            }
            catch
            {
                // A locked registry hive must not break the library.
            }

            if (string.IsNullOrEmpty(root) || !Directory.Exists(root)) root = GameScanner.FindSteamRoot();

            var running = false;
            try
            {
                using var active = Registry.CurrentUser.OpenSubKey(@"Software\Valve\Steam\ActiveProcess");
                if (active != null)
                {
                    var user = active.GetValue("ActiveUser");
                    activeUser = user is int u ? u : 0;
                    var alive = active.GetValue("pid");
                    pid = alive is int p ? p : 0;
                    // The client keeps this key current and zeroes the pid on
                    // exit, so it answers "is it running" without enumerating
                    // processes — which is what made the UI stall on cold start.
                    running = pid > 0;
                }
            }
            catch
            {
                // ActiveProcess only exists while the client is up.
            }

            _state = new State(!string.IsNullOrEmpty(root) && Directory.Exists(root), running, activeUser != 0,
                root, activeUser);
            _stateAt = DateTime.UtcNow;
            return _state;
        }
    }

    /// <summary>Kept for callers that only care about the Steam path; the
    /// authoritative resolver is GameLaunch.ModeFor, which also knows the
    /// other launchers. "auto" means: an entry that owns a client goes
    /// through it, everything else runs its own exe.</summary>
    public static string ModeFor(GameEntry game) => GameLaunch.ModeFor(game);

    /// <summary>Hands the app id to the client. Works whether Steam is already
    /// running or needs to start and log in first; the client owns the launch
    /// arguments, the overlay, cloud saves and the ownership check.
    ///
    /// The client executable is started directly instead of through the
    /// steam:// protocol. That skips the shell/protocol handler — which is
    /// where Windows applies the "run as administrator" compatibility flag and
    /// shows an UAC prompt — and a flag that is still set now fails with
    /// ERROR_ELEVATION_REQUIRED (740) instead of silently prompting.</summary>
    public static (bool Ok, string? Error) RunGame(string appId)
    {
        var state = Detect(true);
        if (!state.Installed) return (false, "本机没有安装 Steam 客户端");
        if (string.IsNullOrWhiteSpace(appId)) return (false, "缺少 Steam AppID");

        var id = appId.Trim();
        try
        {
            var exe = !string.IsNullOrWhiteSpace(state.Root) ? Path.Combine(state.Root, "steam.exe") : null;
            if (!string.IsNullOrEmpty(exe) && File.Exists(exe))
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = exe,
                    Arguments = "-applaunch " + id,
                    WorkingDirectory = state.Root,
                    UseShellExecute = false,
                    CreateNoWindow = true
                });
                return (true, null);
            }

            Process.Start(new ProcessStartInfo
            {
                FileName = "steam://rungameid/" + id,
                UseShellExecute = true
            });
            return (true, null);
        }
        catch (Win32Exception ex) when (ex.NativeErrorCode == 740)
        {
            Log.Write($"steam launch refused: elevation required (appid={id})");
            return (false, "Steam 被设置为「以管理员身份运行」，系统拒绝了普通权限的启动请求。请先修复 Steam 提权设置。");
        }
        catch (Exception ex)
        {
            Log.Error("steam rungameid", ex);
            return (false, "无法唤起 Steam：" + ex.Message);
        }
    }

    public static Dependency InspectExe(string? exePath)
    {
        if (string.IsNullOrWhiteSpace(exePath) || !File.Exists(exePath)) return Empty;

        DateTime stamp;
        try
        {
            stamp = File.GetLastWriteTimeUtc(exePath);
        }
        catch
        {
            stamp = DateTime.MinValue;
        }

        lock (Gate)
        {
            if (ExeCache.TryGetValue(exePath, out var hit) && hit.Stamp == stamp) return hit.Value;
        }

        var parsed = Parse(exePath);
        lock (Gate)
        {
            if (ExeCache.Count > 256) ExeCache.Clear();
            ExeCache[exePath] = (stamp, parsed);
        }
        return parsed;
    }

    public static Dependency Inspect(GameEntry game) => InspectExe(game.ExePath);

    private static Dependency Parse(string exePath)
    {
        var dlls = new List<string>();
        var stub = false;
        var usesApi = false;

        try
        {
            using var fs = new FileStream(exePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
            using var br = new BinaryReader(fs);
            if (fs.Length < 0x40) return WithNote(exePath, false, false, dlls);

            fs.Seek(0x3C, SeekOrigin.Begin);
            var peOffset = br.ReadInt32();
            if (peOffset <= 0 || peOffset + 24 > fs.Length) return WithNote(exePath, false, false, dlls);

            fs.Seek(peOffset, SeekOrigin.Begin);
            if (br.ReadUInt32() != 0x00004550) return WithNote(exePath, false, false, dlls);

            br.ReadUInt16(); // Machine
            var sectionCount = br.ReadUInt16();
            br.ReadUInt32(); // TimeDateStamp
            br.ReadUInt32(); // PointerToSymbolTable
            br.ReadUInt32(); // NumberOfSymbols
            var optionalSize = br.ReadUInt16();
            br.ReadUInt16(); // Characteristics

            var optionalStart = fs.Position;
            var magic = br.ReadUInt16();
            var pe32Plus = magic == 0x20B;
            var dataDirOffset = optionalStart + (pe32Plus ? 112 : 96);

            fs.Seek(dataDirOffset + 8, SeekOrigin.Begin); // import table is directory entry 1
            var importRva = br.ReadUInt32();

            var sectionStart = optionalStart + optionalSize;
            var sections = new List<(uint Virtual, uint Size, uint Raw)>();
            for (var i = 0; i < sectionCount; i++)
            {
                fs.Seek(sectionStart + i * 40, SeekOrigin.Begin);
                var name = Encoding.ASCII.GetString(br.ReadBytes(8)).TrimEnd('\0');
                if (name == ".bind" || name == ".vlizer" || name == ".vmp0") stub = true;

                var virtualSize = br.ReadUInt32();
                var virtualAddress = br.ReadUInt32();
                var rawSize = br.ReadUInt32();
                var rawPointer = br.ReadUInt32();
                sections.Add((virtualAddress, Math.Max(virtualSize, rawSize), rawPointer));
            }

            long MapRva(uint rva)
            {
                foreach (var section in sections)
                {
                    if (rva >= section.Virtual && rva < section.Virtual + section.Size)
                        return section.Raw + (rva - section.Virtual);
                }
                return -1;
            }

            if (importRva != 0)
            {
                var cursor = MapRva(importRva);
                for (var i = 0; i < 512 && cursor >= 0; i++, cursor += 20)
                {
                    fs.Seek(cursor + 12, SeekOrigin.Begin);
                    var nameRva = br.ReadUInt32();
                    if (nameRva == 0) break;

                    var nameOffset = MapRva(nameRva);
                    if (nameOffset < 0) break;

                    fs.Seek(nameOffset, SeekOrigin.Begin);
                    var name = ReadAscii(fs, 128);
                    if (string.IsNullOrEmpty(name)) break;

                    dlls.Add(name);
                    var lower = name.ToLowerInvariant();
                    if (lower.StartsWith("steam_api") || lower.StartsWith("steamclient")) usesApi = true;
                }
            }
        }
        catch (Exception ex)
        {
            Log.Error("inspect exe " + exePath, ex);
            return WithNote(exePath, false, false, dlls);
        }

        return WithNote(exePath, usesApi, stub, dlls);
    }

    private static Dependency WithNote(string exePath, bool usesApi, bool stub, List<string> dlls)
    {
        var hasAppId = false;
        var folderDlls = new List<string>();
        try
        {
            var folder = Path.GetDirectoryName(exePath);
            if (!string.IsNullOrEmpty(folder))
            {
                hasAppId = File.Exists(Path.Combine(folder, "steam_appid.txt"));
                foreach (var name in new[] { "steam_api64.dll", "steam_api.dll", "steamclient64.dll", "steamclient.dll" })
                {
                    var path = Path.Combine(folder, name);
                    if (File.Exists(path)) folderDlls.Add(name);
                }
            }
        }
        catch
        {
            // Unreadable folder: keep the executable evidence only.
        }

        // RPG Maker and some Unity builds load steam_api at runtime, so the
        // import table stays clean while the folder still needs the client.
        var dynamicApi = folderDlls.Count > 0;
        if (dynamicApi) usesApi = true;

        string note;
        if (stub)
            note = "带 SteamStub 外壳：只能由 Steam 客户端启动，直接运行会报错或闪退。";
        else if (usesApi && hasAppId)
            note = "自带 steam_appid.txt：客户端关闭时多数情况仍可进入，但成就与云存档不可用。";
        else if (usesApi)
            note = "依赖 Steam 运行时：必须由已登录的客户端启动，否则会卡在初始化或提示未运行。";
        else if (hasAppId)
            note = "目录内带 steam_appid.txt：可脱离客户端启动，但没有成就与云存档。";
        else
            note = "未检测到 Steam 运行时依赖：可以直接启动。";

        var all = dlls.Concat(folderDlls).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        return new Dependency(usesApi, stub, hasAppId, all, note);
    }

    private static string ReadAscii(FileStream stream, int max)
    {
        var buffer = new StringBuilder();
        for (var i = 0; i < max; i++)
        {
            var value = stream.ReadByte();
            if (value <= 0) break;
            buffer.Append((char)value);
        }
        return buffer.ToString();
    }

    private static bool HasSteamProcess()
    {
        try
        {
            foreach (var process in Process.GetProcessesByName("steam"))
            {
                process.Dispose();
                return true;
            }
        }
        catch
        {
            // Enumerating processes can be denied; the registry check still counts.
        }
        return false;
    }

    /// <summary>Process enumeration, for callers that can afford a few
    /// milliseconds off the UI thread. Kept out of <see cref="Detect"/> so the
    /// boot payload never pays for it.</summary>
    public static bool IsClientRunning()
    {
        var state = Detect();
        return state.Running || HasSteamProcess();
    }

    private static string? NormalizePath(string? path)
    {
        if (string.IsNullOrWhiteSpace(path)) return null;
        try
        {
            return Path.GetFullPath(path.Replace('/', '\\').TrimEnd('\\'));
        }
        catch
        {
            return null;
        }
    }
}
