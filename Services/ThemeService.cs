using System.IO;
using System.IO.Compression;
using System.Text.Json;
using NovaGameSpace.Models;

namespace NovaGameSpace.Services;

/// <summary>
/// Loads interface themes from %LOCALAPPDATA%\NOVA Game Space\themes.
///
/// A theme is a folder with theme.json plus optional CSS and assets. Themes
/// may only restyle the shell; they cannot execute code. See docs/THEMES.md.
/// </summary>
public sealed class ThemeService
{
    public const string ManifestName = "theme.json";
    public const string BuiltInId = "nova";

    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true
    };

    public sealed class ThemeManifest
    {
        public int Schema { get; set; } = 1;
        public string? Id { get; set; }
        public string? Name { get; set; }
        public string? Author { get; set; }
        public string? Version { get; set; }
        public string? Description { get; set; }
        public string? Css { get; set; }
        public string? Preview { get; set; }
        public string? Base { get; set; }

        /// <summary>Opening-sequence preset id (see src/intro.js).</summary>
        public string? Intro { get; set; }

        public Dictionary<string, string>? Tokens { get; set; }
        public Dictionary<string, string>? Icons { get; set; }

        /// <summary>Optional visual feature modules (texture / type / panel).
        /// The renderer applies them as root data attributes; see theme-fx.css.</summary>
        public Dictionary<string, string>? Features { get; set; }
        public bool Dark { get; set; } = true;
    }

    public sealed record ThemeInfo(
        string Id,
        string Name,
        string Author,
        string Version,
        string Description,
        string? Intro,
        Dictionary<string, string> Features,
        string Folder,
        string? CssUrl,
        string? PreviewUrl,
        string Base,
        bool BuiltIn,
        bool Ok,
        string? Error,
        Dictionary<string, string> Tokens,
        Dictionary<string, string> Icons);

    private readonly List<ThemeInfo> _themes = new();

    public ThemeService()
    {
        SeedBundledThemes();
        Refresh();
    }

    /// <summary>
    /// Themes that ship with the app are copied into the user theme folder on
    /// first run, so they can be edited or overridden like any other theme.
    /// </summary>
    private static void SeedBundledThemes()
    {
        try
        {
            AppPaths.Ensure();
            if (!Directory.Exists(AppPaths.BundledThemes)) return;

            foreach (var source in Directory.EnumerateDirectories(AppPaths.BundledThemes))
            {
                var name = Path.GetFileName(source);
                var target = Path.Combine(AppPaths.Themes, name);

                // Copy when missing, and refresh when the shipped theme is
                // newer than the installed copy, so app updates are picked up.
                if (Directory.Exists(target) && !IsBundledNewer(source, target)) continue;

                CopyDirectory(source, target);
                Log.Write($"seeded bundled theme {name}");
            }
        }
        catch (Exception ex)
        {
            Log.Error("seed themes", ex);
        }
    }

    public IReadOnlyList<ThemeInfo> Themes => _themes;

    public ThemeInfo? Find(string? id)
    {
        if (string.IsNullOrWhiteSpace(id)) return null;
        return _themes.FirstOrDefault(t => string.Equals(t.Id, id, StringComparison.OrdinalIgnoreCase));
    }

    public ThemeInfo GetActive(string? id) => Find(id) ?? Find(BuiltInId) ?? BuiltIn();

    public static ThemeInfo BuiltIn() => new(
        BuiltInId,
        "NOVA 原生",
        "NOVA",
        "2.0.0",
        "电影感外观：按钮与标题颜色跟随封面，适合每款游戏的独立气质。",
        "gilded",
        new Dictionary<string, string>(),
        "",
        null,
        "https://nova.site/assets/theme-nova-preview.jpg?v=1.2.9",
        "",
        true,
        true,
        null,
        new Dictionary<string, string>(),
        new Dictionary<string, string>());

    /// <summary>Rescans the themes folder. Invalid themes are kept in the list
    /// with an error so the UI can explain what is wrong instead of hiding them.</summary>
    public void Refresh()
    {
        _themes.Clear();
        _themes.Add(BuiltIn());

        try
        {
            AppPaths.Ensure();
            if (!Directory.Exists(AppPaths.Themes)) return;

            foreach (var dir in Directory.EnumerateDirectories(AppPaths.Themes))
            {
                var info = LoadFolder(dir);
                if (info != null) _themes.Add(info);
            }
        }
        catch (Exception ex)
        {
            Log.Error("scan themes", ex);
        }
    }

    private ThemeInfo? LoadFolder(string folder)
    {
        var manifestPath = Path.Combine(folder, ManifestName);
        if (!File.Exists(manifestPath))
        {
            // A folder without a manifest is not a theme; ignore silently so
            // stray files in the themes directory do not show up as errors.
            return null;
        }

        var folderId = Path.GetFileName(folder);
        try
        {
            var manifest = JsonSerializer.Deserialize<ThemeManifest>(File.ReadAllText(manifestPath), Options);
            if (manifest == null)
                return Invalid(folderId, folder, "清单文件为空", manifest);
            if (manifest.Schema != 1)
                return Invalid(folderId, folder, $"不支持的清单版本 schema={manifest.Schema}", manifest);
            if (string.IsNullOrWhiteSpace(manifest.Name))
                return Invalid(folderId, folder, "清单缺少 name", manifest);
            if (!string.IsNullOrWhiteSpace(manifest.Id) && !IsSafeId(manifest.Id!))
                return Invalid(folderId, folder, "id 只能包含小写字母、数字和连字符", manifest);

            var id = string.IsNullOrWhiteSpace(manifest.Id) ? folderId : manifest.Id!;
            if (string.Equals(id, BuiltInId, StringComparison.OrdinalIgnoreCase))
                return Invalid(folderId, folder, "id 不能使用保留名称 nova", manifest);

            // Duplicate id: first one wins, keep the later one visible as broken.
            if (_themes.Any(t => string.Equals(t.Id, id, StringComparison.OrdinalIgnoreCase)))
                return Invalid(folderId, folder, $"主题 id 重复：{id}", manifest);

            var cssUrl = ResolveAsset(folder, manifest.Css, "theme.css");
            var previewUrl = ResolveAsset(folder, manifest.Preview, "preview.jpg")
                          ?? ResolveAsset(folder, "preview.png", null)
                          ?? ResolveAsset(folder, "preview.jpg", null);

            // WebView2's virtual-host cache ignores query strings on CSS but
            // does honour them for images; versioning the preview means a
            // theme author sees their new card art after bumping version.
            if (!string.IsNullOrWhiteSpace(previewUrl))
                previewUrl += (previewUrl.Contains('?') ? "&" : "?") + "v=" + Uri.EscapeDataString(manifest.Version ?? "1.0.0");

            return new ThemeInfo(
                id,
                manifest.Name!,
                manifest.Author ?? "未署名",
                manifest.Version ?? "1.0.0",
                manifest.Description ?? "",
                NormalizeIntro(manifest.Intro),
                CleanDictionary(manifest.Features),
                folder,
                cssUrl,
                previewUrl,
                NormalizeBase(manifest.Base),
                false,
                true,
                null,
                CleanDictionary(manifest.Tokens),
                CleanDictionary(manifest.Icons));
        }
        catch (JsonException ex)
        {
            return Invalid(folderId, folder, $"清单不是合法 JSON：{ex.Message}", null);
        }
        catch (Exception ex)
        {
            Log.Error($"theme {folderId}", ex);
            return Invalid(folderId, folder, ex.Message, null);
        }
    }

    private static ThemeInfo Invalid(string id, string folder, string error, ThemeManifest? manifest) => new(
        manifest?.Id ?? id,
        manifest?.Name ?? id,
        manifest?.Author ?? "未署名",
        manifest?.Version ?? "—",
        manifest?.Description ?? "",
        NormalizeIntro(manifest?.Intro),
        CleanDictionary(manifest?.Features),
        folder,
        null,
        null,
        "",
        false,
        false,
        error,
        new Dictionary<string, string>(),
        new Dictionary<string, string>());

    /// <summary>Only relative paths inside the theme folder are accepted.</summary>
    private static string? ResolveAsset(string folder, string? relative, string? fallbackName)
    {
        foreach (var candidate in new[] { relative, fallbackName })
        {
            if (string.IsNullOrWhiteSpace(candidate)) continue;
            var clean = candidate!.Replace('\\', '/').TrimStart('/');
            if (clean.Contains("..")) continue;
            var full = Path.GetFullPath(Path.Combine(folder, clean));
            if (!full.StartsWith(Path.GetFullPath(folder), StringComparison.OrdinalIgnoreCase)) continue;
            if (!File.Exists(full)) continue;
            var folderName = Path.GetFileName(folder);
            return $"https://nova.themes/{Uri.EscapeDataString(folderName)}/{clean}";
        }
        return null;
    }

    private static string NormalizeBase(string? value) =>
        value is "adaptive" or "system" ? value : "";

    /// <summary>Intro presets are ids resolved by src/intro.js; an unknown id
    /// simply falls back to the default preset at runtime.</summary>
    private static string NormalizeIntro(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return "";
        var clean = value.Trim().ToLowerInvariant();
        return System.Text.RegularExpressions.Regex.IsMatch(clean, "^[a-z0-9][a-z0-9-]{0,31}$") ? clean : "";
    }

    private static Dictionary<string, string> CleanDictionary(Dictionary<string, string>? source)
    {
        var result = new Dictionary<string, string>(StringComparer.Ordinal);
        if (source == null) return result;
        foreach (var pair in source)
        {
            if (string.IsNullOrWhiteSpace(pair.Key) || pair.Value == null) continue;
            if (pair.Key.Length > 80 || pair.Value.Length > 400) continue;
            result[pair.Key] = pair.Value;
        }
        return result;
    }

    private static bool IsSafeId(string id) =>
        System.Text.RegularExpressions.Regex.IsMatch(id, "^[a-z0-9][a-z0-9-]{0,39}$");

    /* ---------- installation ---------- */

    public sealed record InstallResult(bool Ok, string? Error, string? ThemeId);

    /// <summary>
    /// Installs a theme from a .zip or a theme folder. The theme lands in the
    /// user themes directory and is rescanned immediately.
    /// </summary>
    public InstallResult Install(string sourcePath)
    {
        try
        {
            if (Directory.Exists(sourcePath))
            {
                var target = CopyFolderTheme(sourcePath);
                Refresh();
                return new InstallResult(true, null, target);
            }

            if (!File.Exists(sourcePath))
                return new InstallResult(false, "文件不存在", null);
            if (!sourcePath.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
                return new InstallResult(false, "请选择主题文件夹或 .zip 压缩包", null);

            return InstallZip(sourcePath);
        }
        catch (Exception ex)
        {
            Log.Error("install theme", ex);
            return new InstallResult(false, ex.Message, null);
        }
    }

    private string CopyFolderTheme(string sourceFolder)
    {
        var manifestPath = Path.Combine(sourceFolder, ManifestName);
        if (!File.Exists(manifestPath)) throw new InvalidOperationException("文件夹里没有 theme.json");

        var manifest = JsonSerializer.Deserialize<ThemeManifest>(File.ReadAllText(manifestPath), Options);
        var folderName = SafeFolderName(manifest?.Id ?? Path.GetFileName(sourceFolder));
        var target = Path.Combine(AppPaths.Themes, folderName);
        CopyDirectory(sourceFolder, target);
        return folderName;
    }

    private InstallResult InstallZip(string zipPath)
    {
        var temp = Path.Combine(Path.GetTempPath(), "nova-theme-" + Guid.NewGuid().ToString("N"));
        try
        {
            Directory.CreateDirectory(temp);
            CompatUtil.ExtractZip(zipPath, temp);

            // The archive may wrap everything in a single folder.
            var root = FindManifestRoot(temp);
            if (root == null) return new InstallResult(false, "压缩包里没有 theme.json", null);

            var manifest = JsonSerializer.Deserialize<ThemeManifest>(
                File.ReadAllText(Path.Combine(root, ManifestName)), Options);
            var folderName = SafeFolderName(manifest?.Id ?? Path.GetFileName(root));
            var target = Path.Combine(AppPaths.Themes, folderName);
            CopyDirectory(root, target);

            Refresh();
            return new InstallResult(true, null, folderName);
        }
        finally
        {
            try { Directory.Delete(temp, true); } catch { }
        }
    }

    private static string? FindManifestRoot(string root)
    {
        if (File.Exists(Path.Combine(root, ManifestName))) return root;
        foreach (var dir in Directory.GetDirectories(root))
        {
            if (File.Exists(Path.Combine(dir, ManifestName))) return dir;
        }
        return null;
    }

    /// <summary>True when the bundled copy is newer than the installed one.</summary>
    private static bool IsBundledNewer(string source, string target)
    {
        try
        {
            var sourceManifest = Path.Combine(source, ManifestName);
            var targetManifest = Path.Combine(target, ManifestName);
            if (!File.Exists(sourceManifest)) return false;
            if (!File.Exists(targetManifest)) return true;

            var sourceVersion = ReadVersion(sourceManifest);
            var targetVersion = ReadVersion(targetManifest);
            if (sourceVersion != null && targetVersion != null && sourceVersion != targetVersion)
                return sourceVersion > targetVersion;

            // Same or unknown version: compare modification times.
            return File.GetLastWriteTimeUtc(sourceManifest) > File.GetLastWriteTimeUtc(targetManifest);
        }
        catch
        {
            return false;
        }
    }

    private static Version? ReadVersion(string manifestPath)
    {
        try
        {
            var manifest = JsonSerializer.Deserialize<ThemeManifest>(File.ReadAllText(manifestPath), Options);
            return Version.TryParse(manifest?.Version, out var version) ? version : null;
        }
        catch
        {
            return null;
        }
    }

    private static void CopyDirectory(string source, string target)
    {
        Directory.CreateDirectory(target);
        foreach (var file in Directory.GetFiles(source))
        {
            File.Copy(file, Path.Combine(target, Path.GetFileName(file)), true);
        }
        foreach (var dir in Directory.GetDirectories(source))
        {
            CopyDirectory(dir, Path.Combine(target, Path.GetFileName(dir)));
        }
    }

    private static string SafeFolderName(string value)
    {
        var cleaned = System.Text.RegularExpressions.Regex.Replace(value ?? "", "[^A-Za-z0-9._-]", "-");
        if (string.IsNullOrWhiteSpace(cleaned)) cleaned = "theme-" + Guid.NewGuid().ToString("N").Substring(0, 8);
        return cleaned.Trim('-').ToLowerInvariant();
    }

    /// <summary>Pure removal of an installed theme folder (built-in cannot be removed).</summary>
    public InstallResult Remove(string id)
    {
        var theme = Find(id);
        if (theme == null) return new InstallResult(false, "找不到这个主题", null);
        if (theme.BuiltIn) return new InstallResult(false, "内置外观不能删除", null);

        try
        {
            Directory.Delete(theme.Folder, true);
            Refresh();
            return new InstallResult(true, null, id);
        }
        catch (Exception ex)
        {
            Log.Error("remove theme", ex);
            return new InstallResult(false, ex.Message, null);
        }
    }

    /// <summary>Opens the themes folder so users can drop a theme in by hand.</summary>
    public static void OpenFolder()
    {
        try
        {
            AppPaths.Ensure();
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
            {
                FileName = AppPaths.Themes,
                UseShellExecute = true
            });
        }
        catch (Exception ex)
        {
            Log.Error("open themes folder", ex);
        }
    }
}
