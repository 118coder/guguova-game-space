using System;
using System.IO;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace NovaGameSpace.Services;

/// <summary>An asset attached to the latest GitHub release worth offering.</summary>
internal sealed record UpdateCandidate(string Name, long Size, string Url);

/// <summary>Result of asking GitHub for the newest release.</summary>
internal sealed record UpdateCheckResult(
    bool Ok,
    string Error,
    string Current,
    string Latest,
    bool Available,
    string? AssetName,
    long AssetSize,
    string? AssetUrl,
    string? Notes);

/// <summary>
/// Update check + package download against the project's GitHub releases.
/// The launcher stays offline everywhere else: this code only runs when the
/// player asks for a check (or turns on the daily auto-check).
/// </summary>
internal static class UpdateService
{
    private const string ReleasesLatest = "https://api.github.com/repos/118coder/guguova-game-space/releases/latest";

    private static readonly HttpClient Http = NewClient();
    private static CancellationTokenSource? _downloadCts;

    private static HttpClient NewClient()
    {
        var client = new HttpClient(new HttpClientHandler { AllowAutoRedirect = true });
        // A check and a download have very different natural lengths; the
        // per-request cancellation token is what actually cuts a download off.
        client.Timeout = TimeSpan.FromMinutes(6);
        // GitHub's API answers 403 to requests without a user agent.
        client.DefaultRequestHeaders.UserAgent.ParseAdd("GUGUOVA-Launcher");
        client.DefaultRequestHeaders.Accept.ParseAdd("application/vnd.github+json");
        return client;
    }

    public static string CurrentVersion =>
        (typeof(UpdateService).Assembly.GetName().Version?.ToString(3) ?? "0.0.0");

    public static string UpdatesDir => Path.Combine(AppPaths.Root, "updates");

    public static async Task<UpdateCheckResult> CheckAsync(CancellationToken cancellation)
    {
        try
        {
            using var response = await Http.GetAsync(ReleasesLatest, cancellation);
            var body = await response.Content.ReadAsStringAsync();
            if (!response.IsSuccessStatusCode)
            {
                return new UpdateCheckResult(false, $"GitHub 返回 HTTP {(int)response.StatusCode}",
                    CurrentVersion, "", false, null, 0, null, null);
            }

            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;
            var tag = root.TryGetProperty("tag_name", out var tagElement) ? tagElement.GetString() ?? "" : "";
            var notes = root.TryGetProperty("body", out var bodyElement) && bodyElement.ValueKind == JsonValueKind.String
                ? bodyElement.GetString()
                : null;
            var latest = tag.StartsWith("v", StringComparison.OrdinalIgnoreCase) ? tag.Substring(1) : tag;

            UpdateCandidate? pick = null;
            if (root.TryGetProperty("assets", out var assets) && assets.ValueKind == JsonValueKind.Array)
            {
                foreach (var asset in assets.EnumerateArray())
                {
                    var name = asset.TryGetProperty("name", out var nameElement) ? nameElement.GetString() ?? "" : "";
                    var url = asset.TryGetProperty("browser_download_url", out var urlElement) ? urlElement.GetString() ?? "" : "";
                    var size = asset.TryGetProperty("size", out var sizeElement) && sizeElement.TryGetInt64(out var parsed) ? parsed : 0;
                    if (string.IsNullOrEmpty(name) || string.IsNullOrEmpty(url)) continue;
                    var candidate = new UpdateCandidate(name, size, url);
                    if (Rank(candidate) < Rank(pick)) pick = candidate;
                }
            }

            var available = pick != null && IsNewer(latest, CurrentVersion);
            return new UpdateCheckResult(true, "", CurrentVersion, latest, available,
                pick?.Name, pick?.Size ?? 0, pick?.Url, notes);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            return new UpdateCheckResult(false, Friendly(ex), CurrentVersion, "", false, null, 0, null, null);
        }
    }

    /// <summary>Stream the asset into the updates folder; reports (received, total).</summary>
    public static async Task<string> DownloadAsync(UpdateCandidate asset, Action<long, long> progress, CancellationToken cancellation)
    {
        Directory.CreateDirectory(UpdatesDir);
        var target = Path.Combine(UpdatesDir, asset.Name);
        var temp = target + ".part";

        using (var response = await Http.GetAsync(asset.Url, HttpCompletionOption.ResponseHeadersRead, cancellation))
        {
            response.EnsureSuccessStatusCode();
            var total = response.Content.Headers.ContentLength ?? asset.Size;
            using var remote = await response.Content.ReadAsStreamAsync();
            using var file = new FileStream(temp, FileMode.Create, FileAccess.Write, FileShare.None, 81920, true);
            var buffer = new byte[81920];
            long received = 0;
            int read;
            while ((read = await remote.ReadAsync(buffer, 0, buffer.Length, cancellation)) > 0)
            {
                await file.WriteAsync(buffer, 0, read, cancellation);
                received += read;
                progress?.Invoke(received, total);
            }
        }

        if (File.Exists(target)) File.Delete(target);
        File.Move(temp, target);
        return target;
    }

    public static void CancelDownload()
    {
        _downloadCts?.Cancel();
    }

    public static CancellationToken BeginDownloadScope()
    {
        _downloadCts?.Cancel();
        _downloadCts = new CancellationTokenSource();
        return _downloadCts.Token;
    }

    /// <summary>exe first, then the legacy single-folder zip, then anything else.</summary>
    private static int Rank(UpdateCandidate? candidate)
    {
        if (candidate == null) return 99;
        var name = candidate.Name;
        if (name.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)) return 0;
        if (name.IndexOf("legacy-single", StringComparison.OrdinalIgnoreCase) >= 0
            && name.EndsWith(".zip", StringComparison.OrdinalIgnoreCase)) return 1;
        if (name.EndsWith(".zip", StringComparison.OrdinalIgnoreCase)) return 2;
        return 3;
    }

    /// <summary>Three-part numeric compare; pre-release suffixes after the third part are ignored.</summary>
    private static bool IsNewer(string latest, string current)
    {
        var left = Parts(latest);
        var right = Parts(current);
        for (var i = 0; i < 3; i++)
        {
            if (left[i] != right[i]) return left[i] > right[i];
        }
        return false;
    }

    private static int[] Parts(string version)
    {
        var parts = new[] { 0, 0, 0 };
        if (string.IsNullOrWhiteSpace(version)) return parts;
        var split = version.Split('.');
        for (var i = 0; i < 3 && i < split.Length; i++)
        {
            var digits = "";
            foreach (var ch in split[i])
            {
                if (ch < '0' || ch > '9') break;
                digits += ch;
            }
            if (digits.Length > 0) parts[i] = int.Parse(digits);
        }
        return parts;
    }

    private static string Friendly(Exception ex)
    {
        if (ex is HttpRequestException) return "连不上 GitHub（检查网络或代理）";
        if (ex is JsonException) return "返回内容无法解析";
        return ex.Message;
    }
}
