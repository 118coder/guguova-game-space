// 游戏库扫描与导入：平台扫描、候选导入、Steam 时长同步、文件拖放解析与虚拟主机映射。
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
    /// <summary>Re-imports Steam artwork for existing entries. Older builds
    /// picked whatever JPEG the cache folder happened to contain (sometimes a
    /// 32×32 icon), so a rescan is the only way those entries get the real
    /// 1920-wide hero. Only entries imported from Steam are touched.</summary>
    private object RefreshArtwork(JsonElement args)
    {
        var onlyId = ResolveGame(args)?.Id;
        var updated = 0;
        var skipped = 0;
        try
        {
            foreach (var game in _store.Library.Games.ToList())
            {
                if (onlyId != null && game.Id != onlyId) continue;
                if (string.IsNullOrWhiteSpace(game.SteamAppId))
                {
                    skipped++;
                    continue;
                }

                var hero = GameScanner.FindSteamHero(game.SteamAppId!);
                if (string.IsNullOrWhiteSpace(hero) || !File.Exists(hero))
                {
                    skipped++;
                    continue;
                }

                var analysis = _media.ImportImage(game.Id, hero!);
                if (analysis == null)
                {
                    skipped++;
                    continue;
                }

                game.HeroPath = Path.Combine(_media.GameMediaDir(game.Id), "hero.jpg");
                game.CoverPath = Path.Combine(_media.GameMediaDir(game.Id), "cover.jpg");
                ApplyAnalysis(game, analysis);
                updated++;
            }

            if (updated > 0) _store.Save();
            Log.Write($"refresh artwork updated={updated} skipped={skipped}");
            return new { ok = true, updated, skipped };
        }
        catch (Exception ex)
        {
            Log.Error("refresh artwork", ex);
            return new { ok = false, error = ex.Message, updated, skipped };
        }
    }

    private object SyncSteamPlaytime()
    {
        try
        {
            var changed = _store.SyncSteamPlaytime();
            return new
            {
                ok = true,
                updated = changed.Count,
                steamRoot = GameScanner.FindSteamRoot(),
                games = changed.Select(game => new
                {
                    id = game.Id,
                    playtimeSeconds = game.PlaytimeSeconds,
                    lastPlayedUtc = game.LastPlayedUtc
                }).ToList()
            };
        }
        catch (Exception ex)
        {
            Log.Error("sync steam playtime", ex);
            return new { ok = false, error = ex.Message };
        }
    }

    /// <summary>
    /// Every installed game the machine will admit to, grouped by the launcher
    /// that owns it. Steam keeps its own scanner (it has an artwork cache the
    /// others do not); everything else comes from PlatformScanner.
    /// </summary>
    private object ScanLibrary()
    {
        try
        {
            var scan = GameScanner.Scan();
            var others = PlatformScanner.Scan();

            var groups = new List<object>();
            groups.Add(new
            {
                id = GamePlatform.Steam.Id,
                label = GamePlatform.Steam.Label,
                shortLabel = GamePlatform.Steam.Short,
                note = scan.SteamRoot ?? "",
                clientInstalled = true,
                items = scan.Steam.Select(candidate =>
                {
                    var existing = _store.FindBySteam(candidate.AppId);
                    return new
                    {
                        key = PlatformKey(GamePlatform.Steam.Id, candidate.AppId),
                        platform = GamePlatform.Steam.Id,
                        name = candidate.Name,
                        detail = candidate.InstallDir,
                        exePath = candidate.ExePath,
                        coverUrl = CoverUrlFor(existing, candidate.CoverPath),
                        heroUrl = candidate.HeroPath != null ? FileUrl(candidate.HeroPath) : null,
                        imported = existing != null,
                        gameId = existing?.Id
                    };
                }).ToList()
            });

            foreach (var platform in GamePlatform.All)
            {
                if (platform.Id == GamePlatform.Steam.Id) continue;
                var items = others
                    .Where(candidate => candidate.Platform == platform.Id)
                    .Select(candidate =>
                    {
                        var existing = FindPlatformEntry(candidate);
                        return new
                        {
                            key = PlatformKey(platform.Id, candidate.PlatformId),
                            platform = platform.Id,
                            name = candidate.Name,
                            detail = candidate.InstallDir,
                            exePath = candidate.ExePath,
                            coverUrl = CoverUrlFor(existing, candidate.CoverPath),
                            heroUrl = candidate.HeroPath != null ? FileUrl(candidate.HeroPath) : null,
                            imported = existing != null,
                            gameId = existing?.Id
                        };
                    })
                    .ToList();
                if (items.Count == 0) continue;
                groups.Add(new
                {
                    id = platform.Id,
                    label = platform.Label,
                    shortLabel = platform.Short,
                    note = "",
                    clientInstalled = PlatformScanner.ClientInstalled(platform.Id),
                    items
                });
            }

            var shortcuts = scan.LocalExes
                .Where(path => !_store.Library.Games.Any(g => string.Equals(g.ExePath, path, StringComparison.OrdinalIgnoreCase)))
                .Take(40)
                .Select(path => new
                {
                    name = MediaService.SuggestName(path),
                    exePath = path,
                    folder = Path.GetDirectoryName(path)
                })
                .ToList();

            return new { ok = true, steamRoot = scan.SteamRoot, groups, shortcuts };
        }
        catch (Exception ex)
        {
            Log.Error("scan library", ex);
            return new { ok = false, error = ex.Message };
        }
    }

    private static string PlatformKey(string platform, string platformId) => platform + ":" + platformId;

    /// <summary>Cover URL for a scan row. An already-imported entry shows the
    /// cover the launcher actually stores (media root, always loadable); only
    /// fresh candidates fall back to the scanner's cached artwork.</summary>
    private string CoverUrlFor(GameEntry? existing, string? candidateCover) =>
        existing != null && !string.IsNullOrWhiteSpace(existing.CoverPath)
            ? MediaUrl(existing.CoverPath, existing.Id, "cover")
            : (string.IsNullOrWhiteSpace(candidateCover) ? null : FileUrl(candidateCover));

    private GameEntry? FindPlatformEntry(PlatformCandidate candidate)
    {
        return _store.Library.Games.FirstOrDefault(game =>
            game.Source == candidate.Platform &&
            (!string.IsNullOrEmpty(game.PlatformId)
                ? string.Equals(game.PlatformId, candidate.PlatformId, StringComparison.OrdinalIgnoreCase)
                : !string.IsNullOrWhiteSpace(game.ExePath) &&
                  string.Equals(game.ExePath, candidate.ExePath, StringComparison.OrdinalIgnoreCase)));
    }

    /// <summary>
    /// Cheap "which launchers does this machine have" probe for the import
    /// sheet. Counts what is there without resolving executables, so the sheet
    /// can open instantly and the full scan runs only after the player picks
    /// automatic import.
    /// </summary>
    private object PlatformSummary()
    {
        try
        {
            var presence = PlatformScanner.Detect();
            var known = _store.Library.Games.Count;
            return new
            {
                ok = true,
                libraryCount = known,
                platforms = GamePlatform.All.Select(platform =>
                {
                    var hit = presence.FirstOrDefault(item => item.Platform == platform.Id);
                    return new
                    {
                        id = platform.Id,
                        label = platform.Label,
                        shortLabel = platform.Short,
                        count = hit?.Count ?? 0
                    };
                }).ToList()
            };
        }
        catch (Exception ex)
        {
            Log.Error("platform summary", ex);
            return new { ok = false, error = ex.Message };
        }
    }

    private object ImportCandidates(JsonElement args)
    {
        var added = 0;
        try
        {
            if (!args.TryGetProperty("keys", out var keys) || keys.ValueKind != JsonValueKind.Array)
                return new { ok = true, added };

            var wanted = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var element in keys.EnumerateArray())
            {
                var key = element.GetString();
                if (!string.IsNullOrWhiteSpace(key)) wanted.Add(key!);
            }
            if (wanted.Count == 0) return new { ok = true, added };

            // One scan for the whole batch: the UI may have been open for a
            // while, so the selection is re-resolved instead of trusted.
            var steam = GameScanner.Scan().Steam;
            var others = PlatformScanner.Scan();

            foreach (var key in wanted)
            {
                var split = key.IndexOf(':');
                if (split <= 0) continue;
                var platformId = key.Substring(0, split);
                var ownerId = key.Substring(split + 1);
                if (string.IsNullOrWhiteSpace(ownerId)) continue;

                if (platformId == GamePlatform.Steam.Id)
                {
                    if (_store.FindBySteam(ownerId) != null) continue;
                    var candidate = steam.FirstOrDefault(item => item.AppId == ownerId);
                    if (candidate == null) continue;

                    var game = new GameEntry
                    {
                        Name = candidate.Name,
                        Zh = "",
                        Source = GamePlatform.Steam.Id,
                        SteamAppId = candidate.AppId,
                        PlatformId = candidate.AppId,
                        ExePath = candidate.ExePath,
                        WorkDir = candidate.InstallDir,
                        Tagline = "",
                        Description = "",
                        Genre = "Steam"
                    };
                    ApplyMedia(game, candidate.HeroPath, candidate.CoverPath);
                    _store.Add(game);
                    added++;
                    continue;
                }

                var platformCandidate = others.FirstOrDefault(item =>
                    item.Platform == platformId &&
                    string.Equals(item.PlatformId, ownerId, StringComparison.OrdinalIgnoreCase));
                if (platformCandidate == null || FindPlatformEntry(platformCandidate) != null) continue;

                var entry = new GameEntry
                {
                    Name = platformCandidate.Name,
                    Zh = "",
                    Source = platformCandidate.Platform,
                    PlatformId = platformCandidate.PlatformId,
                    LaunchUri = platformCandidate.LaunchUri ?? "",
                    ExePath = platformCandidate.ExePath,
                    Args = platformCandidate.Args ?? "",
                    WorkDir = platformCandidate.InstallDir,
                    Tagline = "",
                    Description = "",
                    Genre = ""
                };
                ApplyMedia(entry, platformCandidate.HeroPath, platformCandidate.CoverPath);
                _store.Add(entry);
                added++;
            }

            // New Steam entries start with the hours the player already has,
            // instead of "不到 1 分钟" until the first launch here.
            if (added > 0) _store.SyncSteamPlaytime();
        }
        catch (Exception ex)
        {
            Log.Error("import candidates", ex);
            return new { ok = false, error = ex.Message, added };
        }
        return new { ok = true, added };
    }

    /// <summary>The first-run prompt is a one-time decision. Recording it here
    /// (not in saveSettings) keeps the "seen it" flag independent from the
    /// player changing their name on the same page.</summary>
    private object DismissFirstRun()
    {
        try
        {
            _store.Library.Settings.FirstRunDone = true;
            _store.Save();
            return new { ok = true };
        }
        catch (Exception ex)
        {
            Log.Error("dismiss first run", ex);
            return new { ok = false, error = ex.Message };
        }
    }

    /// <summary>
    /// Maps a file outside the media root onto a virtual host the renderer can
    /// actually load. The page runs on https://nova.site, so a file:/// URL is
    /// cross-origin and WebView2 refuses to paint it — that is why scan rows
    /// used to show broken-image glyphs for every Steam cache cover. Each
    /// folder that shows up gets its own nova.cacheN host, mapped lazily; the
    /// set is tiny (one per Steam library root) and lives as long as the view.
    /// </summary>
    private static readonly object FileUrlGate = new();
    private static readonly Dictionary<string, string> FileUrlHosts = new(StringComparer.OrdinalIgnoreCase);
    private static int _fileUrlHostSeq;

    /// <summary>
    /// A file (or folder) dropped on the window resolves to one launchable exe
    /// and lands in the editor prefilled. Shortcuts resolve through their
    /// target, folders through the same main-executable scan the platforms use,
    /// and launcher clients are refused — dropping Steam is not importing a game.
    /// </summary>
    public void HandleFileDrop(IReadOnlyList<string> paths)
    {
        try
        {
            var resolved = ResolveDropPaths(paths);
            Notify("drop-import", resolved);
        }
        catch (Exception ex)
        {
            Log.Error("file drop", ex);
        }
    }

    private object ResolveDrop(JsonElement args)
    {
        var paths = new List<string>();
        if (args.ValueKind == JsonValueKind.Object && args.TryGetProperty("paths", out var list) &&
            list.ValueKind == JsonValueKind.Array)
        {
            foreach (var element in list.EnumerateArray())
            {
                var value = element.GetString();
                if (!string.IsNullOrWhiteSpace(value)) paths.Add(value!);
            }
        }

        var resolved = ResolveDropPaths(paths);
        if (!resolved.Ok) return resolved;
        Notify("drop-import", resolved);
        return resolved;
    }

    private DropResolution ResolveDropPaths(IReadOnlyList<string> paths)
    {
        foreach (var raw in paths)
        {
            var path = raw.Trim().Trim('"');
            if (string.IsNullOrEmpty(path) || !File.Exists(path)) continue;

            var target = path;
            if (target.EndsWith(".lnk", StringComparison.OrdinalIgnoreCase))
            {
                target = ShortcutResolver.Resolve(target) ?? "";
                if (string.IsNullOrEmpty(target) || !File.Exists(target)) continue;
            }

            var name = "";
            if (Directory.Exists(target))
            {
                var folderName = Path.GetFileName(target.TrimEnd('\\', '/'));
                target = GameScanner.FindMainExecutable(target, folderName) ?? "";
                if (string.IsNullOrEmpty(target)) continue;
                name = GameScanner.CleanName(folderName);
            }

            if (!target.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) || !File.Exists(target)) continue;
            if (GameScanner.IsClientExecutable(target)) continue;

            return new DropResolution(
                true,
                null,
                target,
                string.IsNullOrEmpty(name) ? MediaService.SuggestName(target) : name,
                Path.GetDirectoryName(target));
        }

        return new DropResolution(false, "没有找到可执行文件；文件夹会自动挑选主程序。", null, null, null);
    }

    /// <summary>Registers (or returns) the virtual host that serves a folder.
    /// Returns null when there is no WebView to map onto yet.</summary>
    private string? MapFileHost(string folder)
    {
        var full = Path.GetFullPath(folder);
        lock (FileUrlGate)
        {
            if (FileUrlHosts.TryGetValue(full, out var existing)) return existing;
            if (_web?.CoreWebView2 == null) return null;

            var host = "nova.cache" + (++_fileUrlHostSeq);
            _web.CoreWebView2.SetVirtualHostNameToFolderMapping(
                host, full, CoreWebView2HostResourceAccessKind.Allow);
            FileUrlHosts[full] = host;
            Log.Write($"file host {host} -> {full}");
            return host;
        }
    }

    private string FileUrl(string path)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(path) || !File.Exists(path)) return "";
            var full = Path.GetFullPath(path);

            var mediaRoot = Path.GetFullPath(AppPaths.Media);
            if (full.StartsWith(mediaRoot, StringComparison.OrdinalIgnoreCase))
                return "https://nova.media/" + CompatUtil.RelativePath(AppPaths.Media, full).Replace('\\', '/');

            lock (FileUrlGate)
            {
                // Longest mapped ancestor first: one host per Steam library's
                // librarycache root covers every per-app subfolder.
                string? bestFolder = null;
                foreach (var candidate in FileUrlHosts.Keys)
                {
                    if (!full.StartsWith(candidate + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) &&
                        !full.StartsWith(candidate + Path.AltDirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) continue;
                    if (bestFolder == null || candidate.Length > bestFolder.Length) bestFolder = candidate;
                }

                var folder = bestFolder ?? Path.GetDirectoryName(full);
                if (string.IsNullOrEmpty(folder)) return "";

                var host = MapFileHost(folder);
                if (host == null) return "";

                var relative = full.Length > folder.Length
                    ? full.Substring(folder.Length).TrimStart('\\', '/').Replace('\\', '/')
                    : Path.GetFileName(full);
                return $"https://{host}/{relative}";
            }
        }
        catch (Exception ex)
        {
            Log.Error("file url", ex);
            return "";
        }
    }
}
