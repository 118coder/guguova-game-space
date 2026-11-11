// 应用更新：检查更新、下载更新包、取消下载与打开下载目录。
// NativeBridge 的 partial 领域分片之一，见 NativeBridge.cs 主文件。

using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Windows;
using Gdi = System.Drawing;
using WindowState = System.Windows.WindowState;
using Application = System.Windows.Application;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;
using NovaGameSpace.Models;
using NovaGameSpace.Services;

namespace NovaGameSpace;

public sealed partial class NativeBridge
{
    /* ---------- update check + package download (GitHub releases) ---------- */

    /* Every status message carries the run it belongs to. The page drops
       anything older than what it already shows, and the check itself is
       single-flight: 连点「检查更新」or the daily auto check landing on top of a
       manual one used to interleave two answers and leave the panel printing
       the loser's version (§1.41.5). */
    private int _updateSeq;
    private int _updateCheckRunning;

    private object BeginUpdateCheck()
    {
        if (Interlocked.Exchange(ref _updateCheckRunning, 1) == 1)
            return new { ok = true, checking = true, busy = true };

        var seq = Interlocked.Increment(ref _updateSeq);
        _store.Library.Settings.LastUpdateCheckUtc = DateTime.UtcNow.ToString("o");
        _store.Save();
        Task.Run(async () =>
        {
            try
            {
                Notify("update-status", new { phase = "checking", seq });
                var result = await UpdateService.CheckAsync(CancellationToken.None);
                Notify("update-status", new
                {
                    phase = "result",
                    seq,
                    ok = result.Ok,
                    error = result.Error,
                    current = result.Current,
                    latest = result.Latest,
                    available = result.Available,
                    assetName = result.AssetName,
                    assetSize = result.AssetSize,
                    assetUrl = result.AssetUrl,
                    notes = TruncateNotes(result.Notes)
                });
            }
            catch (Exception ex)
            {
                Log.Error("update check", ex);
                Notify("update-status", new { phase = "error", seq, error = ex.Message });
            }
            finally
            {
                Interlocked.Exchange(ref _updateCheckRunning, 0);
            }
        });
        return new { ok = true, checking = true, seq };
    }

    /// <summary>Runs once after boot when the player opted into daily checks;
    /// otherwise it is a no-op so the launcher stays fully offline.</summary>
    private object MaybeAutoUpdateCheck()
    {
        var settings = _store.Library.Settings;
        if (!settings.AutoCheckUpdates) return new { ok = true, skipped = "disabled" };
        if (DateTime.TryParse(settings.LastUpdateCheckUtc, out var last)
            && (DateTime.UtcNow - last).TotalHours < 24)
        {
            return new { ok = true, skipped = "recent" };
        }
        return BeginUpdateCheck();
    }

    private object BeginUpdateDownload(JsonElement args)
    {
        var url = GetString(args, "url");
        var name = GetString(args, "name");
        if (string.IsNullOrWhiteSpace(url) || string.IsNullOrWhiteSpace(name))
            return new { ok = false, error = "缺少下载信息，请先检查更新" };
        var token = UpdateService.BeginDownloadScope();
        var seq = Interlocked.Increment(ref _updateSeq);
        Task.Run(async () =>
        {
            try
            {
                Notify("update-status", new { phase = "downloading", seq, name });
                var path = await UpdateService.DownloadAsync(new UpdateCandidate(name, 0, url!),
                    (received, total) => Notify("update-progress", new
                    {
                        seq,
                        percent = total > 0 ? (int)(received * 100 / total) : 0,
                        receivedBytes = received,
                        totalBytes = total
                    }), token);
                Notify("update-status", new { phase = "done", seq, path, name });
            }
            catch (OperationCanceledException)
            {
                Notify("update-status", new { phase = "cancelled", seq });
            }
            catch (Exception ex)
            {
                Log.Error("update download", ex);
                Notify("update-status", new { phase = "error", seq, error = ex.Message });
            }
        });
        return new { ok = true, seq };
    }

    private object CancelUpdateDownload()
    {
        UpdateService.CancelDownload();
        return new { ok = true };
    }

    private object OpenUpdateFolder()
    {
        try
        {
            System.IO.Directory.CreateDirectory(UpdateService.UpdatesDir);
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
            {
                FileName = UpdateService.UpdatesDir,
                UseShellExecute = true
            });
            return new { ok = true };
        }
        catch (Exception ex)
        {
            Log.Error("open update folder", ex);
            return new { ok = false, error = "打不开下载文件夹" };
        }
    }

    /* ---------- in-place upgrade: swap the running exe, then relaunch ---------- */

    /// <summary>Hands the downloaded build to a detached waiter and quits.
    /// Windows refuses to overwrite a running image, so the copy happens after
    /// this process is gone; the same script then clears the download cache and
    /// starts the new build (see docs/HANDOFF-NEXT.md §1.41).</summary>
    private object ApplyUpdate(JsonElement args)
    {
        var requested = GetString(args, "path");
        var package = string.IsNullOrWhiteSpace(requested)
            ? LatestDownloadedPackage()
            : requested.Trim().Trim('"');
        if (string.IsNullOrWhiteSpace(package) || !File.Exists(package))
            return new { ok = false, error = "找不到已下载的更新包，请重新下载" };

        var source = Path.GetFullPath(package);
        var updatesRoot = Path.GetFullPath(UpdateService.UpdatesDir) + Path.DirectorySeparatorChar;
        if (!source.StartsWith(updatesRoot, StringComparison.OrdinalIgnoreCase))
            return new { ok = false, error = "更新包不在下载目录中，已阻止自动替换" };
        if (!source.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
            return new { ok = false, error = "这个更新包不是单文件程序，请手动安装" };

        var target = CurrentExecutablePath();
        if (string.IsNullOrWhiteSpace(target) || !File.Exists(target)
            || !target.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
            return new { ok = false, error = "无法定位当前程序，请手动运行更新包" };
        target = Path.GetFullPath(target);
        if (string.Equals(Path.GetFileName(target), "dotnet.exe", StringComparison.OrdinalIgnoreCase))
            return new { ok = false, error = "当前是从 dotnet 运行时启动的，请手动运行更新包" };

        /* The folder (net48) host shares the exe name GUGUOVA, so the file
           name cannot tell the two apart. Replacing a folder install with the
           single-file build would leave two runtimes fighting over src/ — refuse
           and point at the right package instead. */
        if (Environment.Version.Major < 5)
        {
            return new
            {
                ok = false,
                error = "当前是文件夹版，请下载文件夹版的更新包手动替换（自动替换只支持单文件版）"
            };
        }

        var folder = Path.GetDirectoryName(target);
        if (string.IsNullOrWhiteSpace(folder) || !CanWriteFolder(folder))
            return new { ok = false, error = "程序所在文件夹不可写，请用管理员身份运行后再升级" };
        if (string.Equals(source, target, StringComparison.OrdinalIgnoreCase))
            return new { ok = false, error = "更新包就是当前程序，无需替换" };
        /* An arm64 image cannot start on x64 ("不是有效的 Win32 应用程序"), so the
           swap would replace a working launcher with a dead file. The package's
           own PE header is the only trustworthy source for this. */
        if (!PackageMatchesThisMachine(source))
            return new { ok = false, error = "这个更新包不是当前处理器架构的版本，已阻止替换" };

        /* The swap needs something outside this process, but the player's
           machine has no SDK of any kind: PowerShell ships with Windows, and
           WSH/VBScript is the fallback for machines where PowerShell is locked
           down. Both write a marker file the moment they really started, so a
           blocked script can never leave the player with an exited app and no
           replacement. */
        var marker = Path.Combine(Path.GetTempPath(), "nova-swap-" + Guid.NewGuid().ToString("N") + ".flag");
        var launched = LaunchSwapWaiter(marker, CurrentProcessId(), target, source, UpdateService.UpdatesDir)
            || LaunchVbsWaiter(marker, target, source, UpdateService.UpdatesDir);
        if (!launched)
        {
            return new
            {
                ok = false,
                error = "系统阻止了自动升级（PowerShell 与脚本宿主都被禁用），请手动运行下载的安装包"
            };
        }

        // Answer the page first; the window goes away a beat later so the
        // "正在重启并升级…" state is actually visible.
        _ = Task.Run(async () =>
        {
            await Task.Delay(900);
            try { DoWindow(w => w.QuitNow()); } catch { }
        });

        return new { ok = true, restarting = true, target, package = source };
    }

    private static string? LatestDownloadedPackage()
    {
        try
        {
            var dir = UpdateService.UpdatesDir;
            if (!Directory.Exists(dir)) return null;
            return new DirectoryInfo(dir).GetFiles("*.exe")
                .OrderByDescending(file => file.LastWriteTimeUtc)
                .Select(file => file.FullName)
                .FirstOrDefault();
        }
        catch
        {
            return null;
        }
    }

    /// <summary>A downloaded build that was never installed. The swap waiter can
    /// die — a blocked script, a killed process, a reboot mid-swap — and then the
    /// only trace left is the package sitting in updates/. Read once at boot so
    /// the settings page can offer the upgrade again instead of pretending the
    /// download never happened (§1.41.5).</summary>
    internal object? PendingUpdate()
    {
        var path = LatestDownloadedPackage();
        if (string.IsNullOrWhiteSpace(path)) return null;
        try
        {
            var info = new FileInfo(path);
            return new
            {
                path,
                name = info.Name,
                size = info.Length,
                modifiedUtc = info.LastWriteTimeUtc.ToString("o")
            };
        }
        catch (Exception ex)
        {
            Log.Error("pending update", ex);
            return null;
        }
    }

    /// <summary>Reads the CPU the package was built for out of its PE header.
    /// The file name is not evidence — a "GUGUOVA-1.18.0-arm64.exe" and its x64
    /// twin are told apart only here (§1.41.5).</summary>
    private static bool PackageMatchesThisMachine(string path)
    {
        var expected = RuntimeInformation.ProcessArchitecture switch
        {
            Architecture.X64 => 0x8664,
            Architecture.Arm64 => 0xAA64,
            Architecture.X86 => 0x014C,
            _ => 0
        };
        if (expected == 0) return true;
        try
        {
            using var stream = File.OpenRead(path);
            using var reader = new BinaryReader(stream);
            if (stream.Length < 0x40) return false;
            stream.Position = 0x3C;
            var peOffset = reader.ReadInt32();
            if (peOffset <= 0 || peOffset + 6 > stream.Length) return false;
            stream.Position = peOffset;
            if (reader.ReadUInt32() != 0x00004550) return false;  // "PE\0\0"
            return reader.ReadUInt16() == expected;
        }
        catch (Exception ex)
        {
            Log.Error("update package header", ex);
            return false;
        }
    }

    /// <summary>A read-only install folder (Program Files) would fail the copy
    /// silently inside the waiter, so check before promising a restart.</summary>
    private static bool CanWriteFolder(string folder)
    {
        try
        {
            var probe = Path.Combine(folder, ".nova-write-probe");
            using (new FileStream(probe, FileMode.Create, FileAccess.Write, FileShare.None, 1, FileOptions.DeleteOnClose))
            {
            }
            return true;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>Waiter #1: a hidden PowerShell process (base64 UTF-16, so
    /// Chinese install paths survive the command line). It announces itself by
    /// writing <paramref name="marker"/>, waits for the launcher to exit, copies
    /// the new build over the old exe with retries — the image stays locked for
    /// a beat after the process is gone — then wipes the download cache and
    /// relaunches.</summary>
    private static bool LaunchSwapWaiter(string marker, int pid, string target, string package, string updatesDir)
    {
        static string Quote(string value) => value.Replace("'", "''");
        var script = string.Join("\n", new[]
        {
            "$ErrorActionPreference = 'SilentlyContinue'",
            "Set-Content -LiteralPath '" + Quote(marker) + "' -Value 'go' -Encoding ASCII -ErrorAction Stop",
            "$target = '" + Quote(target) + "'",
            "$package = '" + Quote(package) + "'",
            "$updates = '" + Quote(updatesDir) + "'",
            "$deadline = (Get-Date).AddSeconds(60)",
            "while ((Get-Date) -lt $deadline) {",
            "  if (-not (Get-Process -Id " + pid + " -ErrorAction SilentlyContinue)) { break }",
            "  Start-Sleep -Milliseconds 200",
            "}",
            "$swapped = $false",
            "for ($i = 0; $i -lt 60 -and -not $swapped; $i++) {",
            "  try {",
            "    Copy-Item -LiteralPath $package -Destination $target -Force -ErrorAction Stop",
            "    $swapped = $true",
            "  } catch { Start-Sleep -Milliseconds 250 }",
            "}",
            "if ($swapped) {",
            "  $expected = (Get-Item -LiteralPath $package).Length",
            "  $actual = (Get-Item -LiteralPath $target).Length",
            "  if ($expected -ne $actual) { $swapped = $false }",
            "}",
            "if (-not $swapped) { exit 1 }",
            "foreach ($pattern in @('*.part', '*.exe', '*.zip')) {",
            "  Get-ChildItem -LiteralPath $updates -Filter $pattern -Force | Remove-Item -Force -ErrorAction SilentlyContinue",
            "}",
            "Start-Process -FilePath $target",
        });
        var encoded = Convert.ToBase64String(System.Text.Encoding.Unicode.GetBytes(script));
        var info = new System.Diagnostics.ProcessStartInfo("powershell.exe")
        {
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = System.Diagnostics.ProcessWindowStyle.Hidden,
            Arguments = "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -EncodedCommand " + encoded
        };
        try
        {
            System.Diagnostics.Process.Start(info);
        }
        catch (Exception ex)
        {
            Log.Error("update waiter (powershell)", ex);
            return false;
        }
        return WaitForMarker(marker, 1600);
    }

    /// <summary>Waiter #2: WSH/VBScript, for machines where AppLocker or a
    /// policy blocks PowerShell. The file is UTF-16 with a BOM, which is what
    /// WSH reads reliably — that keeps Chinese install paths intact.
    /// \u0022 keeps VBScript's own double quotes out of C# string-literal hell.</summary>
    private static bool LaunchVbsWaiter(string marker, string target, string package, string updatesDir)
    {
        static string Q(string value) => "\u0022" + value.Replace("\u0022", "\u0022\u0022") + "\u0022";
        var script = string.Join("\r\n", new[]
        {
            "Dim fso, sh, target, package, updates, marker, ok, i, f, ext",
            "Set fso = CreateObject(" + Q("Scripting.FileSystemObject") + ")",
            "Set sh = CreateObject(" + Q("WScript.Shell") + ")",
            "target = " + Q(target),
            "package = " + Q(package),
            "updates = " + Q(updatesDir),
            "marker = " + Q(marker),
            "On Error Resume Next",
            "fso.CreateTextFile marker, True",
            "On Error GoTo 0",
            "ok = False",
            "For i = 1 To 120",
            "  On Error Resume Next",
            "  fso.CopyFile package, target, True",
            "  If Err.Number = 0 Then ok = True",
            "  Err.Clear",
            "  On Error GoTo 0",
            "  If ok Then Exit For",
            "  WScript.Sleep 250",
            "Next",
            "If Not ok Then WScript.Quit 1",
            "For Each f In fso.GetFolder(updates).Files",
            "  ext = LCase(fso.GetExtensionName(f.Name))",
            "  If ext = " + Q("exe") + " Or ext = " + Q("zip") + " Or ext = " + Q("part") + " Then",
            "    On Error Resume Next",
            "    f.Delete True",
            "    On Error GoTo 0",
            "  End If",
            "Next",
            "sh.Run Chr(34) & target & Chr(34), 1, False",
        });
        var path = Path.Combine(Path.GetTempPath(), "nova-swap-" + Guid.NewGuid().ToString("N") + ".vbs");
        try
        {
            File.WriteAllText(path, script, System.Text.Encoding.Unicode);
            var info = new System.Diagnostics.ProcessStartInfo("wscript.exe")
            {
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = System.Diagnostics.ProcessWindowStyle.Hidden,
                Arguments = "\u0022" + path + "\u0022"
            };
            System.Diagnostics.Process.Start(info);
        }
        catch (Exception ex)
        {
            Log.Error("update waiter (wscript)", ex);
            return false;
        }
        return WaitForMarker(marker, 1600);
    }

    private static bool WaitForMarker(string marker, int timeoutMs)
    {
        var deadline = NowMs() + timeoutMs;
        while (NowMs() < deadline)
        {
            if (File.Exists(marker))
            {
                try { File.Delete(marker); } catch { }
                return true;
            }
            Thread.Sleep(120);
        }
        return false;
    }

    /* Both hosts compile this file, and the folder (net48) build has none of
       Environment.ProcessPath / ProcessId / TickCount64. These three wrappers
       are the only difference the two runtimes need. */
    private static string? CurrentExecutablePath()
    {
        try
        {
            return System.Diagnostics.Process.GetCurrentProcess().MainModule?.FileName;
        }
        catch (Exception ex)
        {
            Log.Error("current exe path", ex);
            return null;
        }
    }

    private static int CurrentProcessId() => System.Diagnostics.Process.GetCurrentProcess().Id;

    /// <summary>Monotonic-enough milliseconds for a 1.6 s handshake; the wall
    /// clock is only consulted inside one call.</summary>
    private static long NowMs() => DateTime.UtcNow.Ticks / TimeSpan.TicksPerMillisecond;

    private static string? TruncateNotes(string? notes)
    {
        if (string.IsNullOrEmpty(notes)) return null;
        var line = notes.Replace("\r\n", "\n");
        var cut = line.IndexOf('\n');
        if (cut >= 0) line = line.Substring(0, cut);
        return line.Length > 160 ? line.Substring(0, 160) + "…" : line;
    }
}
