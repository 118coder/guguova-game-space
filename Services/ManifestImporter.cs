using System.IO;
using System.Text.Json;
using NovaGameSpace.Models;

namespace NovaGameSpace.Services;

/// <summary>
/// Implements docs/INTEGRATION.md: reads a nova-game.json manifest so a game
/// can ship its own launcher metadata instead of the user typing it in.
/// </summary>
public static class ManifestImporter
{
    public const string FileName = "nova-game.json";

    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true
    };

    public sealed class Manifest
    {
        public int Schema { get; set; }
        public string? Name { get; set; }
        public string? Zh { get; set; }
        public string? Logo { get; set; }
        public string? Exe { get; set; }
        public string? Args { get; set; }
        public string? Workdir { get; set; }
        public string? Genre { get; set; }
        public string? AgeRating { get; set; }
        public string? Mode { get; set; }
        public string? Tagline { get; set; }
        public string? Description { get; set; }
        public string? Hero { get; set; }
        public string? Cover { get; set; }
        public string? Accent { get; set; }
        public string? Accent2 { get; set; }
        public string? SteamAppId { get; set; }
        public bool RequiresLauncher { get; set; }
        public string? LauncherHint { get; set; }
    }

    public sealed record Result(bool Ok, string? Error, string? ManifestPath, Manifest? Data);

    /// <summary>Finds a manifest next to the exe, then one directory above.</summary>
    public static string? Locate(string exePath)
    {
        try
        {
            var dir = Path.GetDirectoryName(exePath);
            for (var depth = 0; depth < 2 && !string.IsNullOrEmpty(dir); depth += 1)
            {
                var candidate = Path.Combine(dir, FileName);
                if (File.Exists(candidate)) return candidate;
                var parent = Path.GetDirectoryName(dir);
                if (string.IsNullOrEmpty(parent) || parent == dir) break;
                dir = parent;
            }
        }
        catch
        {
            // fall through
        }
        return null;
    }

    public static Result Load(string exePath)
    {
        var located = Locate(exePath);
        if (located == null) return new Result(false, "没有找到 " + FileName, null, null);

        foreach (var candidate in new[] { located })
        {
            try
            {
                var json = File.ReadAllText(candidate);
                var manifest = JsonSerializer.Deserialize<Manifest>(json, Options);
                if (manifest == null) return new Result(false, "清单文件为空", candidate, null);
                if (manifest.Schema != 1)
                    return new Result(false, $"不支持的清单版本 schema={manifest.Schema}（需要 1）", candidate, null);
                if (string.IsNullOrWhiteSpace(manifest.Name))
                    return new Result(false, "清单缺少 name 字段", candidate, null);
                if (string.IsNullOrWhiteSpace(manifest.Exe))
                    return new Result(false, "清单缺少 exe 字段", candidate, null);

                var root = Path.GetDirectoryName(candidate)!;
                var resolvedExe = Path.GetFullPath(Path.Combine(root, manifest.Exe));
                if (!File.Exists(resolvedExe))
                    return new Result(false, $"清单里的 exe 不存在：{resolvedExe}", candidate, null);

                return new Result(true, null, candidate, manifest);
            }
            catch (JsonException ex)
            {
                return new Result(false, $"清单不是合法 JSON：{ex.Message}", candidate, null);
            }
            catch (Exception ex)
            {
                Log.Error("manifest", ex);
                return new Result(false, ex.Message, candidate, null);
            }
        }

        return new Result(false, "没有找到 " + FileName, null, null);
    }

    /// <summary>Resolves a manifest path relative to the manifest folder.</summary>
    public static string? ResolveRelative(string? relative, string manifestPath)
    {
        if (string.IsNullOrWhiteSpace(relative)) return null;
        try
        {
            var root = Path.GetDirectoryName(manifestPath)!;
            var full = Path.GetFullPath(Path.Combine(root, relative));
            return File.Exists(full) ? full : null;
        }
        catch
        {
            return null;
        }
    }

    /// <summary>Fills a new GameEntry from a validated manifest.</summary>
    public static GameEntry ToGame(Manifest manifest, string manifestPath)
    {
        var root = Path.GetDirectoryName(manifestPath)!;
        var exe = Path.GetFullPath(Path.Combine(root, manifest.Exe!));
        var workdir = string.IsNullOrWhiteSpace(manifest.Workdir)
            ? Path.GetDirectoryName(exe)!
            : Path.GetFullPath(Path.Combine(root, manifest.Workdir));

        var entry = new GameEntry
        {
            Name = manifest.Name!.Trim(),
            Zh = (manifest.Zh ?? "").Trim(),
            CustomLogo = string.IsNullOrWhiteSpace(manifest.Logo) ? null : manifest.Logo!.Trim(),
            ExePath = exe,
            Args = manifest.Args ?? "",
            WorkDir = workdir,
            Genre = manifest.Genre ?? "",
            AgeRating = string.IsNullOrWhiteSpace(manifest.AgeRating) ? "全年龄" : manifest.AgeRating!,
            Mode = string.IsNullOrWhiteSpace(manifest.Mode) ? "单人" : manifest.Mode!,
            Tagline = manifest.Tagline ?? "",
            Description = manifest.Description ?? "",
            SteamAppId = string.IsNullOrWhiteSpace(manifest.SteamAppId) ? null : manifest.SteamAppId,
            Source = "manifest"
        };

        if (!string.IsNullOrWhiteSpace(manifest.Accent) && IsHex(manifest.Accent))
            entry.Accent = manifest.Accent!;
        if (!string.IsNullOrWhiteSpace(manifest.Accent2) && IsHex(manifest.Accent2))
            entry.Accent2 = manifest.Accent2!;

        if (manifest.RequiresLauncher && !string.IsNullOrWhiteSpace(manifest.LauncherHint))
        {
            entry.Description = string.IsNullOrWhiteSpace(entry.Description)
                ? manifest.LauncherHint!
                : $"{entry.Description}\n\n{manifest.LauncherHint}";
        }

        return entry;
    }

    private static bool IsHex(string value) =>
        System.Text.RegularExpressions.Regex.IsMatch(value, "^#?[0-9a-fA-F]{6}$");
}
