using System.Runtime.InteropServices;
using Microsoft.Web.WebView2.Core;

namespace NovaGameSpace.Services;

/// <summary>
/// One OS/WebView2 probe shared by every build target. The result decides
/// which effect tier the renderer runs: full (Win10/11 + modern Chromium),
/// balanced (older Chromium without color-mix) or safe (Win7/8.1 + 109).
/// </summary>
public static class SystemProfile
{
    public sealed record Info(
        string OsLabel,
        int Major,
        int Minor,
        int Build,
        bool IsWindows7,
        bool IsWindows8,
        bool IsWindows10,
        bool IsWindows11,
        string WebView2Version,
        int WebView2Major,
        bool SupportColorMix,
        bool SupportBackdropFilter,
        bool LegacyHost,
        bool LegacyBuild,
        string Tier,
        string TierLabel,
        string Notes);

    private static Info? _cached;
    private static readonly object Gate = new();

    public static Info Detect(string? overrideTier = null)
    {
        lock (Gate)
        {
            _cached ??= BuildInfo();
            var info = _cached;
            var tier = NormalizeTier(overrideTier);
            if (tier == "auto") return info;

            // Never let a manual "full" bypass a missing color-mix, and never
            // let an old OS run without the safe floor.
            if (tier == "full" && !info.SupportColorMix) tier = "balanced";
            if ((info.IsWindows7 || info.IsWindows8) && tier != "safe") tier = "safe";
            return info with
            {
                Tier = tier,
                TierLabel = Label(tier, info.IsWindows7 || info.IsWindows8, info.WebView2Major),
                Notes = tier switch
                {
                    "safe" => "已手动切换到安全档：关闭重特效、背景纹理与现代 CSS，优先稳定。",
                    "balanced" => "已手动切换到平衡档：保留布局与主题，关闭最重的合成效果。",
                    _ => "已手动切换到完整档：全部动画、纹理与主题效果可用。"
                }
            };
        }
    }

    private static Info BuildInfo()
    {
        var (major, minor, build) = OsVersion();
        var is7 = major == 6 && minor == 1;
        var is8 = major == 6 && minor >= 2;
        var is10 = major == 10 && build < 22000;
        var is11 = major == 10 && build >= 22000;

        var webView = "";
        var webViewMajor = 0;
        try
        {
            webView = CoreWebView2Environment.GetAvailableBrowserVersionString() ?? "";
            var first = webView.Split('.')[0];
            int.TryParse(first, out webViewMajor);
        }
        catch
        {
            // Runtime missing: the host shows a WebView2 install message.
        }

        // color-mix() shipped in Chromium 111; WebView2 109 (the last
        // Windows 7 runtime) does not have it.
        var colorMix = webViewMajor == 0 || webViewMajor >= 111;
        var backdrop = webViewMajor == 0 || webViewMajor >= 76;
        var legacy = is7 || is8;
#if NETFRAMEWORK
        var legacyBuild = true;
#else
        var legacyBuild = false;
#endif
        var tier = legacy || (webViewMajor > 0 && webViewMajor < 111)
            ? (legacy ? "safe" : "balanced")
            : "full";

        var osLabel = is11 ? "Windows 11"
            : is10 ? "Windows 10"
            : is8 ? (minor == 2 ? "Windows 8" : "Windows 8.1")
            : is7 ? "Windows 7"
            : $"Windows {major}.{minor}";

        var notes = legacy
            ? "旧系统：Legacy 宿主 + WebView2 109；启用安全档，关闭重特效与部分现代 CSS。"
            : tier == "balanced"
                ? "WebView2 低于 111：缺少 color-mix()，启用平衡档。"
                : "完整效果：现代 WebView2，全部主题动画与纹理可用。";

        return new Info(
            osLabel, major, minor, build,
            is7, is8, is10, is11,
            webView, webViewMajor,
            colorMix, backdrop,
            legacy, legacyBuild, tier, Label(tier, legacy, webViewMajor), notes);
    }

    private static string Label(string tier, bool legacy, int webViewMajor) => tier switch
    {
        "safe" => "安全档 · 低特效" + (legacy ? "（旧系统）" : ""),
        "balanced" => "平衡档 · 无 color-mix" + (webViewMajor > 0 && webViewMajor < 111 ? $"（WebView2 {webViewMajor}）" : ""),
        _ => "完整效果"
    };

    private static string NormalizeTier(string? value) => value switch
    {
        "full" => "full",
        "balanced" => "balanced",
        "safe" => "safe",
        _ => "auto"
    };

    private static (int Major, int Minor, int Build) OsVersion()
    {
        try
        {
            var info = new OsVersionInfo
            {
                Size = Marshal.SizeOf<OsVersionInfo>()
            };
            if (RtlGetVersion(ref info) == 0)
                return (info.Major, info.Minor, info.Build);
        }
        catch
        {
            // fall through to Environment.OSVersion
        }
        var version = Environment.OSVersion.Version;
        return (version.Major, version.Minor, version.Build);
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct OsVersionInfo
    {
        public int Size;
        public int Major;
        public int Minor;
        public int Build;
        public int PlatformId;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)]
        public string ServicePack;
    }

    [DllImport("ntdll.dll", SetLastError = true)]
    private static extern int RtlGetVersion(ref OsVersionInfo versionInfo);
}
