using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading;
using Microsoft.Win32;
using NovaGameSpace.Models;

namespace NovaGameSpace.Services;

// 其余成员按领域拆分为同目录的 ScalingEngine.*.cs partial 分片文件（Detect / Process / Config）。

/// <summary>
/// The bundled fullscreen upscaler. Magpie is distributed as a separate GPLv3
/// executable under `engine/magpie/`; this class only starts it, hides its main
/// window, keeps its scale hotkey in sync with the launcher setting, and reports
/// its state. The launcher never links to it.
/// </summary>
public static partial class ScalingEngine
{
    public sealed record Status(
        bool Available,
        string? ExePath,
        bool Running,
        bool Bundled,
        int Hotkey,
        bool Supported,
        string Note);

    public const int DefaultHotkey = 3137;        // Alt+Shift+A, Magpie's fullscreen scale key.
    public const int DefaultWindowedHotkey = 3153; // Alt+Shift+Q, Magpie's windowed (factor) scale key.
    /// <summary>Magpie honours customInitialWindowedScaleFactor only when the
    /// InitialWindowedScaleFactor enum is Custom.</summary>
    private const int CustomWindowedScaleFactor = 6;

    private const string MagpieWindowClass = "Window_Magpie_967EB565-6F73-4E94-AE53-00CC42592A22";
    private const int SwMinimize = 6;
    private const int WmClose = 0x0010;
    private static readonly IntPtr HwndBroadcast = new(0xFFFF);

    private static readonly object Gate = new();
    private static (DateTime At, string? Exe) _lookup = (DateTime.MinValue, null);

    /// <summary>True when this run started the engine itself, so it can be
    /// closed again once no game needs it.</summary>
    private static bool _startedByUs;

    /// <summary>Set by EngineBootstrapper when the engine comes from the
    /// single-exe bundle (extracted under the user data folder) instead of a
    /// folder next to the launcher.</summary>
    public static string? BundledDirOverride { get; set; }

    public static string BundledDir =>
        BundledDirOverride ?? Path.Combine(AppContext.BaseDirectory, "engine", "magpie");
    public static string BundledExe => Path.Combine(BundledDir, "Magpie.exe");
    public static bool BundledAvailable => File.Exists(BundledExe);
}
