// 游戏条目维护：创建/更新/删除/收藏、启动载荷序列化与清单读取。
// NativeBridge 的 partial 领域分片之一，见 NativeBridge.cs 主文件。

using System.Globalization;
using System.IO;
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
    private GamePayload ToPayload(GameEntry game)
    {
        var mode = GameLaunch.ModeFor(game);
        // Only a Steam-launched entry depends on the client, so the client
        // probe is skipped for everything else and costs nothing at boot.
        SteamService.State? steam = mode == GameLaunch.Steam ? SteamService.Detect() : null;
        // A packaged game's exe lives behind WindowsApps ACLs, so File.Exists
        // lies about it; an entry with a shell: launch target is installed by
        // definition (the package folder came with the manifest).
        var exists = (!string.IsNullOrWhiteSpace(game.ExePath) && File.Exists(game.ExePath))
            || game.LaunchUri.StartsWith("shell:", StringComparison.OrdinalIgnoreCase);
        // A separated launcher is part of the launch chain: if the player
        // registered one, both halves must exist for the entry to be playable.
        if (exists && !string.IsNullOrWhiteSpace(game.LauncherPath) && !File.Exists(game.LauncherPath))
        {
            exists = false;
        }
        return new GamePayload(
            game.Id,
            game.Name,
            game.Zh,
            DisplayName(game),
            game.Tagline,
            game.Description,
            SplitGenres(game.Genre),
            string.IsNullOrWhiteSpace(game.AgeRating) ? "全年龄" : game.AgeRating,
            string.IsNullOrWhiteSpace(game.Mode) ? "单人" : game.Mode,
            MediaUrl(game.HeroPath, game.Id, "hero"),
            MediaUrl(game.CoverPath, game.Id, "cover"),
            game.HeroPosition,
            game.HeroZoom,
            game.CoverPosition,
            game.Accent,
            game.Accent2,
            game.Glow,
            game.Scrim,
            game.Colors.ToArray(),
            game.Favorite,
            game.AutoUpdate,
            game.PlaytimeSeconds,
            game.LastPlayedUtc,
            game.AddedUtc,
            game.Source,
            game.SteamAppId,
            game.LaunchCount,
            exists,
            _launcher.IsRunning(game.Id),
            game.ExePath,
            game.Args,
            game.WorkDir,
            !string.IsNullOrWhiteSpace(game.CustomLogo),
            game.TypeRecipe,
            game.Dna,
            game.LaunchMode,
            mode,
            steam?.Running ?? false,
            steam?.SignedIn ?? false,
            SteamService.Inspect(game).Note,
            game.FullscreenScale,
            game.PlatformId ?? "",
            GamePlatform.LabelFor(game.Source),
            !string.IsNullOrWhiteSpace(game.LaunchUri),
            game.Source == GamePlatform.Steam.Id || PlatformScanner.ClientInstalled(game.Source),
            RecentSessions(game),
            game.LauncherPath ?? "",
            game.Hidden,
            game.CardPosition ?? "",
            game.CardZoom);
    }

    /// <summary>The last five real sessions, oldest first — the detail sheet
    /// prints them newest first. Kept out of the stats rollup on purpose.</summary>
    private static PlaySession[] RecentSessions(GameEntry game)
    {
        if (game.Sessions == null || game.Sessions.Count == 0) return Array.Empty<PlaySession>();
        var take = Math.Min(5, game.Sessions.Count);
        var slice = new PlaySession[take];
        game.Sessions.CopyTo(game.Sessions.Count - take, slice, 0, take);
        return slice;
    }

    private static string DisplayName(GameEntry game)
    {
        if (!string.IsNullOrWhiteSpace(game.CustomLogo)) return game.CustomLogo!;
        var name = string.IsNullOrWhiteSpace(game.Name) ? game.Zh : game.Name;
        return name.ToUpperInvariant();
    }

    private static string[] SplitGenres(string genre)
    {
        if (string.IsNullOrWhiteSpace(genre)) return Array.Empty<string>();
        return genre.Split(new[] { '·', '/', ',', '，', '、' }, StringSplitOptions.RemoveEmptyEntries).Select(part => part.Trim()).Where(part => part.Length > 0).ToArray();
    }

    /// <summary>
    /// docs/INTEGRATION.md: read a nova-game.json for the chosen exe so the
    /// editor can be prefilled instead of asking the user to retype metadata.
    /// </summary>
    private object ReadManifest(JsonElement args)
    {
        var exe = GetPath(args, "exePath");
        if (string.IsNullOrWhiteSpace(exe) || !File.Exists(exe))
            return new { ok = false, error = "请先选择一个有效的可执行文件" };

        var result = ManifestImporter.Load(exe);
        if (!result.Ok || result.Data == null)
            return new { ok = false, error = result.Error };

        var manifest = result.Data;
        var root = Path.GetDirectoryName(result.ManifestPath!)!;
        return new
        {
            ok = true,
            manifestPath = result.ManifestPath,
            data = new
            {
                name = manifest.Name,
                zh = manifest.Zh ?? "",
                logo = manifest.Logo ?? "",
                exe = Path.GetFullPath(Path.Combine(root, manifest.Exe!)),
                args = manifest.Args ?? "",
                workdir = string.IsNullOrWhiteSpace(manifest.Workdir)
                    ? Path.GetDirectoryName(Path.GetFullPath(Path.Combine(root, manifest.Exe!))) ?? ""
                    : Path.GetFullPath(Path.Combine(root, manifest.Workdir)),
                genre = manifest.Genre ?? "",
                ageRating = manifest.AgeRating ?? "全年龄",
                mode = manifest.Mode ?? "单人",
                tagline = manifest.Tagline ?? "",
                description = manifest.Description ?? "",
                hero = ManifestImporter.ResolveRelative(manifest.Hero, result.ManifestPath!) ?? "",
                cover = ManifestImporter.ResolveRelative(manifest.Cover, result.ManifestPath!) ?? "",
                accent = manifest.Accent ?? "",
                accent2 = manifest.Accent2 ?? "",
                steamAppId = manifest.SteamAppId ?? "",
                launcherHint = manifest.LauncherHint ?? ""
            }
        };
    }

    /// <summary>Scans every Steam install and Start Menu shortcut for manifests.</summary>
    private object ScanManifests()
    {
        var found = new List<object>();
        try
        {
            var scan = GameScanner.Scan();
            var exes = scan.Steam.Select(s => s.ExePath)
                .Concat(scan.LocalExes)
                .Distinct(StringComparer.OrdinalIgnoreCase);

            foreach (var exe in exes)
            {
                var manifestPath = ManifestImporter.Locate(exe);
                if (manifestPath == null) continue;
                var load = ManifestImporter.Load(exe);
                if (!load.Ok || load.Data == null) continue;
                if (_store.Library.Games.Any(g => string.Equals(g.ExePath, exe, StringComparison.OrdinalIgnoreCase)))
                    continue;

                found.Add(new
                {
                    name = load.Data.Name,
                    zh = load.Data.Zh ?? "",
                    exePath = exe,
                    manifestPath,
                    tagline = load.Data.Tagline ?? "",
                    genre = load.Data.Genre ?? ""
                });
            }
        }
        catch (Exception ex)
        {
            Log.Error("scan manifests", ex);
            return new { ok = false, error = ex.Message, count = 0 };
        }
        return new { ok = true, count = found.Count, items = found };
    }

    private static readonly HashSet<string> TitleRecipes = new(StringComparer.OrdinalIgnoreCase)
    {
        "gilded", "poster", "grotesk", "inscription",
        "boutique", "monolith", "kinetic", "outline"
    };

    private static string NormalizeTypeRecipe(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return "";
        var clean = value.Trim().ToLowerInvariant();
        return TitleRecipes.Contains(clean) ? clean : "";
    }

    private object CreateGame(JsonElement args)
    {
        if (args.ValueKind != JsonValueKind.Object) return new { ok = false, error = "参数错误" };
        try
        {
            var exe = GetPath(args, "exePath") ?? "";
            if (string.IsNullOrWhiteSpace(exe) || !File.Exists(exe))
                return new { ok = false, error = "请选择一个存在的可执行文件" };

            var manifestPath = GetPath(args, "manifestPath");
            var suppliedName = GetString(args, "name");

            // A manifest is the authoritative source when no field was typed.
            ManifestImporter.Manifest? manifest = null;
            if (!string.IsNullOrWhiteSpace(manifestPath) && File.Exists(manifestPath))
            {
                var load = ManifestImporter.Load(exe);
                if (load.Ok && load.ManifestPath == manifestPath) manifest = load.Data;
            }

            GameEntry game;
            if (manifest != null)
            {
                game = ManifestImporter.ToGame(manifest, manifestPath!);
                if (!string.IsNullOrWhiteSpace(suppliedName)) game.Name = suppliedName!.Trim();
                var zh = GetString(args, "zh");
                if (!string.IsNullOrWhiteSpace(zh)) game.Zh = zh!.Trim();
                var tagline = GetString(args, "tagline");
                if (!string.IsNullOrWhiteSpace(tagline)) game.Tagline = tagline!;
                var description = GetString(args, "description");
                if (!string.IsNullOrWhiteSpace(description)) game.Description = description!;
                var genre = GetString(args, "genre");
                if (!string.IsNullOrWhiteSpace(genre)) game.Genre = genre!;
                var launchArgs = GetString(args, "args");
                if (!string.IsNullOrWhiteSpace(launchArgs)) game.Args = launchArgs!;
                var age = GetString(args, "ageRating");
                if (!string.IsNullOrWhiteSpace(age)) game.AgeRating = age!;
                var mode = GetString(args, "mode");
                if (!string.IsNullOrWhiteSpace(mode)) game.Mode = mode!;
                var launcher = GetPath(args, "launcherPath");
                if (!string.IsNullOrWhiteSpace(launcher)) game.LauncherPath = launcher!;
            }
            else
            {
                game = new GameEntry
                {
                    Name = string.IsNullOrWhiteSpace(suppliedName) ? MediaService.SuggestName(exe) : suppliedName!.Trim(),
                    Zh = GetString(args, "zh") ?? "",
                    Tagline = GetString(args, "tagline") ?? "",
                    Description = GetString(args, "description") ?? "",
                    Genre = GetString(args, "genre") ?? "",
                    AgeRating = GetString(args, "ageRating") ?? "全年龄",
                    Mode = GetString(args, "mode") ?? "单人",
                    ExePath = exe,
                    Args = GetString(args, "args") ?? "",
                    WorkDir = GetPath(args, "workDir") ?? Path.GetDirectoryName(exe) ?? "",
                    LauncherPath = GetPath(args, "launcherPath") ?? "",
                    Source = "manual"
                };
            }

            game.TypeRecipe = NormalizeTypeRecipe(GetString(args, "typeRecipe"));
            var heroPosition = GetString(args, "heroPosition");
            if (!string.IsNullOrWhiteSpace(heroPosition)) game.HeroPosition = NormalizeHeroPosition(heroPosition);
            if (TryGetNumber(args, "heroZoom", out var heroZoom)) game.HeroZoom = NormalizeHeroZoom(heroZoom);

            var explicitImage = GetPath(args, "imagePath");
            // A path the player typed is a promise, not a hint: if it cannot be
            // read we say so instead of quietly replacing their artwork with the
            // executable icon. A manifest-derived image is different — that one
            // is a best-effort suggestion, so it may fall through.
            var typedImage = !string.IsNullOrWhiteSpace(explicitImage);
            if (!typedImage && manifest != null)
            {
                explicitImage = ManifestImporter.ResolveRelative(manifest.Hero, manifestPath)
                    ?? ManifestImporter.ResolveRelative(manifest.Cover, manifestPath);
            }
            if (typedImage)
            {
                if (!File.Exists(explicitImage))
                    return new { ok = false, error = $"找不到这张图片：{explicitImage}" };
                // The analysis must come from THIS import: the old code followed
                // up with ApplyMedia(game, null), whose fallback branch regenerates
                // the executable-icon composite and clobbers the player's cover —
                // the typed artwork won the write and lost the file.
                Log.Write($"create game typed image: {explicitImage}");
                var typedAnalysis = _media.ImportImage(game.Id, explicitImage!);
                if (typedAnalysis == null)
                    return new { ok = false, error = "无法读取这张图片（格式不支持或文件已损坏）" };
                game.HeroPath = Path.Combine(_media.GameMediaDir(game.Id), "hero.jpg");
                game.CoverPath = Path.Combine(_media.GameMediaDir(game.Id), "cover.jpg");
                ApplyAnalysis(game, typedAnalysis);
            }
            else
            {
                ApplyMedia(game, explicitImage);
            }
            var logo = GetPath(args, "logoPath");
            if (!string.IsNullOrWhiteSpace(logo) && File.Exists(logo))
            {
                var copy = _media.CopyCustomLogo(game.Id, logo);
                // For the wordmark, store the raw display text only when the
                // user typed one; logo images are handled as a custom image.
                game.CustomLogo = null;
            }

            _store.Add(game);
            _store.Library.CurrentGameId = game.Id;
            _store.Save();
            return new { ok = true, game = ToPayload(game) };
        }
        catch (Exception ex)
        {
            Log.Error("create game", ex);
            return new { ok = false, error = ex.Message };
        }
    }

    private object UpdateGame(JsonElement args)
    {
        if (args.ValueKind != JsonValueKind.Object) return new { ok = false, error = "参数错误" };
        var game = ResolveGame(args);
        if (game == null) return new { ok = false, error = "找不到这款游戏" };
        try
        {
            if (TryGetString(args, "name", out var name) && !string.IsNullOrWhiteSpace(name)) game.Name = name!.Trim();
            if (TryGetString(args, "zh", out var zh)) game.Zh = string.IsNullOrWhiteSpace(zh) ? game.Name : zh!.Trim();
            if (TryGetString(args, "tagline", out var tagline)) game.Tagline = tagline ?? "";
            if (TryGetString(args, "description", out var description)) game.Description = description ?? "";
            if (TryGetString(args, "genre", out var genre)) game.Genre = genre ?? "";
            if (TryGetString(args, "ageRating", out var age)) game.AgeRating = age ?? "全年龄";
            if (TryGetString(args, "mode", out var mode)) game.Mode = mode ?? "单人";
            if (TryGetString(args, "args", out var launchArgs)) game.Args = launchArgs ?? "";
            if (TryGetString(args, "workDir", out var workDir)) game.WorkDir = workDir ?? game.WorkDir;
            if (TryGetString(args, "launchMode", out var launchMode))
            {
                var normalized = GameLaunch.Normalize(launchMode);
                if (normalized == GameLaunch.Steam && string.IsNullOrWhiteSpace(game.SteamAppId))
                    return new { ok = false, error = "没有 AppID，无法使用 Steam 启动方式" };
                if (normalized == GameLaunch.Platform && string.IsNullOrWhiteSpace(game.LaunchUri))
                    return new { ok = false, error = "这款游戏没有记录平台启动地址，只能直接启动" };
                game.LaunchMode = normalized;
            }
            if (args.TryGetProperty("fullscreenScale", out var fullscreenScale))
            {
                // null returns the game to the immersive default; a real value
                // is the player's explicit per-game choice.
                if (fullscreenScale.ValueKind == JsonValueKind.Null) game.FullscreenScale = null;
                else if (fullscreenScale.ValueKind is JsonValueKind.True or JsonValueKind.False)
                    game.FullscreenScale = fullscreenScale.GetBoolean();
            }
            if (TryGetString(args, "logoText", out var logoText))
                game.CustomLogo = string.IsNullOrWhiteSpace(logoText) ? null : logoText.Trim();
            if (TryGetString(args, "typeRecipe", out var typeRecipe))
                game.TypeRecipe = NormalizeTypeRecipe(typeRecipe);
            if (TryGetString(args, "heroPosition", out var heroPosition))
                game.HeroPosition = NormalizeHeroPosition(heroPosition);
            if (TryGetNumber(args, "heroZoom", out var heroZoom))
                game.HeroZoom = NormalizeHeroZoom(heroZoom);
            // Share-card framing is independent of the hero crop: an empty
            // position clears the override so the card follows the hero again.
            if (TryGetString(args, "cardPosition", out var cardPosition))
                game.CardPosition = string.IsNullOrWhiteSpace(cardPosition)
                    ? "" : NormalizeHeroPosition(cardPosition);
            if (TryGetNumber(args, "cardZoom", out var cardZoom))
                game.CardZoom = NormalizeCardZoom(cardZoom);

            if (TryGetString(args, "exePath", out var exe) && !string.IsNullOrWhiteSpace(exe))
            {
                if (!File.Exists(exe)) return new { ok = false, error = "该可执行文件不存在" };
                game.ExePath = exe;
            }

            // Empty string clears the separated launcher; a real path must
            // exist, otherwise the entry would silently become unplayable.
            if (TryGetString(args, "launcherPath", out var launcherPath))
            {
                if (!string.IsNullOrWhiteSpace(launcherPath) && !File.Exists(launcherPath))
                    return new { ok = false, error = "启动器程序不存在" };
                game.LauncherPath = launcherPath?.Trim() ?? "";
            }
            if (args.TryGetProperty("hidden", out var hiddenProp)
                && hiddenProp.ValueKind is JsonValueKind.True or JsonValueKind.False)
            {
                game.Hidden = hiddenProp.GetBoolean();
            }

            var image = GetPath(args, "imagePath");
            if (!string.IsNullOrWhiteSpace(image))
            {
                if (!File.Exists(image)) return new { ok = false, error = "图片不存在" };
                var analysis = _media.ImportImage(game.Id, image);
                if (analysis == null) return new { ok = false, error = "无法读取这张图片" };
                game.HeroPath = Path.Combine(_media.GameMediaDir(game.Id), "hero.jpg");
                game.CoverPath = Path.Combine(_media.GameMediaDir(game.Id), "cover.jpg");
                ApplyAnalysis(game, analysis);
            }

            if (args.TryGetProperty("resetArt", out var reset) && reset.ValueKind == JsonValueKind.True)
            {
                _media.DeleteGameMedia(game.Id);
                game.HeroPath = "";
                game.CoverPath = "";
                ApplyMedia(game, null);
            }

            _store.Save();
            return new { ok = true, game = ToPayload(game) };
        }
        catch (Exception ex)
        {
            Log.Error("update game", ex);
            return new { ok = false, error = ex.Message };
        }
    }

    private object DeleteGame(JsonElement args)
    {
        var game = ResolveGame(args);
        if (game == null) return new { ok = false, error = "找不到这款游戏" };
        if (_launcher.IsRunning(game.Id)) _launcher.Stop(game.Id);
        _store.Remove(game.Id);
        if (game.Source != "steam") _media.DeleteGameMedia(game.Id);
        return new { ok = true };
    }

    private object SetFavorite(JsonElement args)
    {
        var game = ResolveGame(args);
        if (game == null) return new { ok = false };
        game.Favorite = !game.Favorite;
        _store.Save();
        return new { ok = true, favorite = game.Favorite };
    }

    private static string NormalizeHeroPosition(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return "50% 45%";
        var match = System.Text.RegularExpressions.Regex.Match(
            value, @"^\s*([0-9.]+)\s*%\s+([0-9.]+)\s*%\s*$");
        if (!match.Success) return "50% 45%";
        var x = CompatUtil.Clamp(ParseDouble(match.Groups[1].Value, 50), 0, 100);
        var y = CompatUtil.Clamp(ParseDouble(match.Groups[2].Value, 45), 0, 100);
        return $"{x:0.#}% {y:0.#}%";
    }

    private static double NormalizeHeroZoom(double value) =>
        CompatUtil.Clamp(!double.IsNaN(value) && !double.IsInfinity(value) ? value : 1, 1, 2.4);

    /// <summary>Card zoom keeps 0 as "not set" so the card can fall back to
    /// the hero crop; any real value lives in the same 1–2.4 range.</summary>
    private static double NormalizeCardZoom(double value)
    {
        if (double.IsNaN(value) || double.IsInfinity(value) || value <= 0) return 0;
        return CompatUtil.Clamp(value, 1, 2.4);
    }

    private static double ParseDouble(string text, double fallback) =>
        double.TryParse(text, NumberStyles.Float, CultureInfo.InvariantCulture, out var value) ? value : fallback;
}
