using System.IO;
using Microsoft.Web.WebView2.Core;

namespace NovaGameSpace.Services;

/// <summary>
/// Single-exe support for the legacy host: the native WebView2Loader.dll is
/// embedded and extracted to a stable folder, then the SDK is told where to
/// find it. Managed WebView2 assemblies are handled by Costura.
/// </summary>
public static class WebView2Bootstrapper
{
    private static bool _ready;

    public static void Ensure()
    {
        if (_ready) return;

        var version = typeof(WebView2Bootstrapper).Assembly.GetName().Version?.ToString(3) ?? "1.0.0";
        var bin = Path.Combine(AppPaths.Root, "runtime", version, "bin");
        Directory.CreateDirectory(bin);
        var loader = Path.Combine(bin, "WebView2Loader.dll");
        Extract("NOVA.WebView2Loader.dll", loader);

        try
        {
            CoreWebView2Environment.SetLoaderDllFolderPath(bin);
        }
        catch (Exception ex)
        {
            Log.Error("set WebView2 loader folder", ex);
        }
        _ready = true;
    }

    private static void Extract(string resourceName, string target)
    {
        if (File.Exists(target) && new FileInfo(target).Length > 0) return;
        using var stream = typeof(WebView2Bootstrapper).Assembly.GetManifestResourceStream(resourceName);
        if (stream == null) throw new FileNotFoundException("missing embedded " + resourceName);
        using var output = File.Create(target);
        stream.CopyTo(output);
    }
}
