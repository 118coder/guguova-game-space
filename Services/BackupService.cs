using System.IO;
using System.IO.Compression;
using System.Text.Json;
using NovaGameSpace.Models;

namespace NovaGameSpace.Services;

/// <summary>
/// Portable, offline data packs. A pack is a zip with the library, settings,
/// play sessions and generated artwork. Importing on another PC remaps the
/// artwork paths and leaves missing executables marked for re-linking.
/// </summary>
public static class BackupService
{
    public sealed record ExportResult(
        bool Ok, string? Error, string? Path, long Size, int Games, int MediaFiles);

    public sealed record ImportResult(
        bool Ok, string? Error, string? BackupPath, int Games, int Added,
        int Replaced, int MediaFiles, int Missing);

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    public static string DefaultExportDirectory =>
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "GUGUOVA Backups");

    public static ExportResult Export(StoreService store, string? directory = null, string prefix = "GUGUOVA")
    {
        var temp = Path.Combine(Path.GetTempPath(), "nova-pack-" + Guid.NewGuid().ToString("N"));
        try
        {
            store.Save();
            var targetDir = directory ?? DefaultExportDirectory;
            Directory.CreateDirectory(targetDir);
            var target = Path.Combine(targetDir, $"{prefix}-{DateTime.Now:yyyyMMdd-HHmmss}.nova-pack");

            Directory.CreateDirectory(temp);
            var mediaRoot = Path.Combine(temp, "media");
            Directory.CreateDirectory(mediaRoot);

            var mediaCount = 0;
            if (Directory.Exists(AppPaths.Media))
            {
                foreach (var file in Directory.EnumerateFiles(AppPaths.Media, "*", SearchOption.AllDirectories))
                {
                    var relative = CompatUtil.RelativePath(AppPaths.Media, file);
                    var destination = Path.Combine(mediaRoot, relative);
                    Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
                    File.Copy(file, destination, true);
                    mediaCount += 1;
                }
            }

            if (File.Exists(AppPaths.LibraryFile))
                File.Copy(AppPaths.LibraryFile, Path.Combine(temp, "library.json"), true);
            else
                File.WriteAllText(Path.Combine(temp, "library.json"),
                    JsonSerializer.Serialize(store.Library, JsonOptions));

            var manifest = new
            {
                schema = 1,
                app = "GUGUOVA",
                version = typeof(BackupService).Assembly.GetName().Version?.ToString(3) ?? "1.5.0",
                exportedUtc = DateTime.UtcNow.ToString("o"),
                gameCount = store.Library.Games.Count,
                mediaCount
            };
            File.WriteAllText(Path.Combine(temp, "manifest.json"),
                JsonSerializer.Serialize(manifest, JsonOptions));

            if (File.Exists(target)) File.Delete(target);
            ZipFile.CreateFromDirectory(temp, target, CompressionLevel.Optimal, false);

            var size = new FileInfo(target).Length;
            store.Library.Settings.LastBackupUtc = DateTime.UtcNow.ToString("o");
            store.Save();
            Log.Write($"exported pack {target} games={store.Library.Games.Count} media={mediaCount}");
            return new ExportResult(true, null, target, size, store.Library.Games.Count, mediaCount);
        }
        catch (Exception ex)
        {
            Log.Error("export pack", ex);
            return new ExportResult(false, ex.Message, null, 0, 0, 0);
        }
        finally
        {
            TryDeleteDirectory(temp);
        }
    }

    /// <summary>One automatic backup per day, at most five kept.</summary>
    public static void EnsureDailyBackup(StoreService store)
    {
        try
        {
            var settings = store.Library.Settings;
            if (!settings.AutoBackup || store.Library.Games.Count == 0) return;

            if (DateTimeOffset.TryParse(settings.LastBackupUtc, out var last) &&
                DateTimeOffset.UtcNow - last.ToUniversalTime() < TimeSpan.FromHours(24))
                return;

            var result = Export(store, AppPaths.Backups, "GUGUOVA-auto");
            if (!result.Ok) return;

            var files = Directory.EnumerateFiles(AppPaths.Backups, "GUGUOVA-auto-*.nova-pack")
                .OrderByDescending(path => path, StringComparer.OrdinalIgnoreCase)
                .ToList();
            foreach (var old in files.Skip(5)) TryDeleteFile(old);
        }
        catch (Exception ex)
        {
            Log.Error("daily backup", ex);
        }
    }

    public static ImportResult Import(StoreService store, string packPath, string mode)
    {
        var temp = Path.Combine(Path.GetTempPath(), "nova-import-" + Guid.NewGuid().ToString("N"));
        try
        {
            if (string.IsNullOrWhiteSpace(packPath) || !File.Exists(packPath))
                return new ImportResult(false, "找不到数据包", null, 0, 0, 0, 0, 0);

            Directory.CreateDirectory(temp);
            var root = Path.GetFullPath(temp) + Path.DirectorySeparatorChar;

            // Reject zip-slip entries before extracting anything.
            using (var archive = ZipFile.OpenRead(packPath))
            {
                foreach (var entry in archive.Entries)
                {
                    var destination = Path.GetFullPath(Path.Combine(temp, entry.FullName));
                    if (!destination.StartsWith(root, StringComparison.OrdinalIgnoreCase))
                        return new ImportResult(false, "数据包包含非法路径", null, 0, 0, 0, 0, 0);
                }
            }
            CompatUtil.ExtractZip(packPath, temp);

            var manifestPath = Path.Combine(temp, "manifest.json");
            var libraryPath = Path.Combine(temp, "library.json");
            if (!File.Exists(manifestPath) || !File.Exists(libraryPath))
                return new ImportResult(false, "数据包缺少 manifest.json 或 library.json", null, 0, 0, 0, 0, 0);

            using (var manifest = JsonDocument.Parse(File.ReadAllText(manifestPath)))
            {
                if (!manifest.RootElement.TryGetProperty("schema", out var schema) || schema.GetInt32() != 1)
                    return new ImportResult(false, "不支持的数据包版本", null, 0, 0, 0, 0, 0);
            }

            var imported = JsonSerializer.Deserialize<LibraryFile>(File.ReadAllText(libraryPath), JsonOptions);
            if (imported == null || imported.Games == null)
                return new ImportResult(false, "数据包里的游戏库无法读取", null, 0, 0, 0, 0, 0);

            store.Save();
            var before = AppPaths.LibraryFile + $".before-import-{DateTime.Now:yyyyMMdd-HHmmss}.json";
            if (File.Exists(AppPaths.LibraryFile)) File.Copy(AppPaths.LibraryFile, before, true);

            var mediaFiles = CopyMedia(temp);
            foreach (var game in imported.Games) RemapMedia(game);
            imported.Settings ??= new PlayerSettings();

            var replaced = 0;
            var added = 0;
            if (string.Equals(mode, "replace", StringComparison.OrdinalIgnoreCase))
            {
                replaced = store.Library.Games.Count;
                store.Library.Games = imported.Games;
                store.Library.CurrentGameId = imported.CurrentGameId;
                store.Library.Settings = imported.Settings;
            }
            else
            {
                foreach (var game in imported.Games)
                {
                    var existing = FindExisting(store.Library.Games, game);
                    if (existing == null)
                    {
                        store.Library.Games.Add(game);
                        added += 1;
                    }
                    else
                    {
                        MergeInto(existing, game);
                        replaced += 1;
                    }
                }
            }

            store.Save();
            var missing = store.Library.Games.Count(g =>
                string.IsNullOrWhiteSpace(g.ExePath) || !File.Exists(g.ExePath));
            Log.Write($"imported pack {packPath} mode={mode} games={store.Library.Games.Count} added={added} merged={replaced}");
            return new ImportResult(true, null, before, store.Library.Games.Count, added, replaced, mediaFiles, missing);
        }
        catch (Exception ex)
        {
            Log.Error("import pack", ex);
            return new ImportResult(false, ex.Message, null, 0, 0, 0, 0, 0);
        }
        finally
        {
            TryDeleteDirectory(temp);
        }
    }

    public static string ExportRecordsCsv(StoreService store)
    {
        var directory = DefaultExportDirectory;
        Directory.CreateDirectory(directory);
        var path = Path.Combine(directory, $"GUGUOVA-playtime-{DateTime.Now:yyyyMMdd-HHmmss}.csv");

        var lines = new List<string> { "game,startedUtc,endedUtc,seconds,minutes,crashed" };
        foreach (var game in store.Library.Games)
        {
            foreach (var session in game.Sessions ?? Enumerable.Empty<PlaySession>())
            {
                var name = (string.IsNullOrWhiteSpace(game.Zh) ? game.Name : game.Zh)
                    .Replace("\"", "\"\"");
                lines.Add($"\"{name}\",{session.StartedUtc},{session.EndedUtc},{session.Seconds},{session.Seconds / 60.0:0.0},{(session.Crashed ? "yes" : "no")}");
            }
        }
        File.WriteAllLines(path, lines);
        return path;
    }

    /// <summary>
    /// One plain-text report a player can attach to a bug report. Everything
    /// here answers "what was running when it broke" — version, host flavour,
    /// OS, WebView2, tier, theme, library size and the tail of nova.log.
    /// Playtime, covers and account names are deliberately left out: the file
    /// leaves the machine, and none of that helps diagnose a crash.
    /// </summary>
    public static string ExportDiagnostics(StoreService store, string? directory = null)
    {
        var dir = directory ?? DefaultExportDirectory;
        Directory.CreateDirectory(dir);
        var path = Path.Combine(dir, $"GUGUOVA-log-{DateTime.Now:yyyyMMdd-HHmmss}.txt");

        var info = SystemProfile.Detect(store.Library.Settings.CompatibilityTier);
        var games = store.Library.Games;
        var sessions = games.Sum(game => game.Sessions?.Count ?? 0);
        var hidden = games.Count(game => game.Hidden);
        var missing = games.Count(game => !game.DeveloperOnly && !string.IsNullOrWhiteSpace(game.ExePath) && !File.Exists(game.ExePath));

        var lines = new List<string>
        {
            "GUGUOVA 启动器诊断报告",
            "把这个 txt 直接发给作者即可，里面没有存档、封面和账号信息。",
            new string('-', 56),
            $"生成时间     {DateTime.Now:yyyy-MM-dd HH:mm:ss}",
            $"版本         {UpdateService.CurrentVersion}",
            $"程序         {ExecutablePath()}",
            $"运行宿主     {(info.LegacyHost ? "legacy (net48)" : "modern (net10)")}{(info.LegacyBuild ? " · 单文件版" : "")}",
            $"系统         {info.OsLabel}（{info.Major}.{info.Minor}.{info.Build} · {(Environment.Is64BitProcess ? "x64" : "x86")}）",
            $"WebView2     {(string.IsNullOrWhiteSpace(info.WebView2Version) ? "未检测到" : info.WebView2Version)}",
            $"效果档位     {info.TierLabel}（{info.Tier}）",
            $"主题         {store.Library.Settings.Theme}",
            $"数据目录     {AppPaths.Root}",
            $"游戏库       {games.Count} 款 · 会话记录 {sessions} 条 · 已隐藏 {hidden} · 程序缺失 {missing}",
            $"缩放引擎     {store.Library.Settings.ScalingEngine} / {store.Library.Settings.ScaleMode}",
            new string('-', 56),
            ""
        };

        string log = "";
        try
        {
            if (File.Exists(AppPaths.LogFile))
            {
                var all = File.ReadAllLines(AppPaths.LogFile);
                const int tail = 400;
                log = all.Length <= tail
                    ? string.Join(Environment.NewLine, all)
                    : string.Join(Environment.NewLine, all.Skip(all.Length - tail));
            }
        }
        catch (Exception ex)
        {
            log = $"(读取日志失败：{ex.Message})";
        }

        var errors = log.Split('\n')
            .Where(line => line.Contains("ERROR", StringComparison.Ordinal))
            .ToList();
        // net48 has no Enumerable.TakeLast, so trim by index.
        if (errors.Count > 20) errors.RemoveRange(0, errors.Count - 20);

        lines.Add($"最近报错（{errors.Count} 条）");
        lines.Add(errors.Count == 0 ? "  无" : string.Join(Environment.NewLine, errors.Select(line => "  " + line.TrimEnd())));
        lines.Add("");
        lines.Add(new string('-', 56));
        lines.Add("运行日志（末尾 400 行）");
        lines.Add("");
        lines.Add(log);

        File.WriteAllLines(path, lines, new System.Text.UTF8Encoding(true));
        return path;
    }

    /// <summary>Both hosts compile this file; the net48 build has no
    /// Environment.ProcessPath, so ask the process itself.</summary>
    private static string ExecutablePath()
    {
        try
        {
            return System.Diagnostics.Process.GetCurrentProcess().MainModule?.FileName ?? "(未知)";
        }
        catch
        {
            return "(未知)";
        }
    }

    private static int CopyMedia(string temp)
    {
        var source = Path.Combine(temp, "media");
        if (!Directory.Exists(source)) return 0;
        var count = 0;
        foreach (var file in Directory.EnumerateFiles(source, "*", SearchOption.AllDirectories))
        {
            var relative = CompatUtil.RelativePath(source, file);
            var destination = Path.Combine(AppPaths.Media, relative);
            Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
            File.Copy(file, destination, true);
            count += 1;
        }
        return count;
    }

    private static void RemapMedia(GameEntry game)
    {
        game.Sessions ??= new List<PlaySession>();
        game.HeroPath = RemapPath(game.Id, game.HeroPath, "hero.jpg");
        game.CoverPath = RemapPath(game.Id, game.CoverPath, "cover.jpg");
        if (!string.IsNullOrWhiteSpace(game.CustomLogo))
        {
            var logo = ReMapLogo(game.Id, game.CustomLogo);
            if (logo != null) game.CustomLogo = logo;
        }
    }

    private static string RemapPath(string gameId, string? current, string fallbackName)
    {
        var dir = Path.Combine(AppPaths.Media, gameId);
        var name = string.IsNullOrWhiteSpace(current) ? fallbackName : Path.GetFileName(current);
        var candidate = Path.Combine(dir, name);
        if (File.Exists(candidate)) return candidate;
        var fallback = Path.Combine(dir, fallbackName);
        return File.Exists(fallback) ? fallback : "";
    }

    private static string? ReMapLogo(string gameId, string current)
    {
        var dir = Path.Combine(AppPaths.Media, gameId);
        var name = Path.GetFileName(current);
        var candidate = Path.Combine(dir, name);
        return File.Exists(candidate) ? candidate : current;
    }

    private static GameEntry? FindExisting(List<GameEntry> games, GameEntry incoming)
    {
        if (!string.IsNullOrWhiteSpace(incoming.SteamAppId))
        {
            var bySteam = games.FirstOrDefault(g => g.SteamAppId == incoming.SteamAppId);
            if (bySteam != null) return bySteam;
        }
        if (!string.IsNullOrWhiteSpace(incoming.ExePath))
        {
            var byExe = games.FirstOrDefault(g =>
                string.Equals(g.ExePath, incoming.ExePath, StringComparison.OrdinalIgnoreCase));
            if (byExe != null) return byExe;
        }
        return games.FirstOrDefault(g =>
            string.Equals(g.Name, incoming.Name, StringComparison.OrdinalIgnoreCase));
    }

    private static void MergeInto(GameEntry target, GameEntry incoming)
    {
        target.PlaytimeSeconds = Math.Max(target.PlaytimeSeconds, incoming.PlaytimeSeconds);
        target.LaunchCount = Math.Max(target.LaunchCount, incoming.LaunchCount);
        if (string.IsNullOrWhiteSpace(target.Zh)) target.Zh = incoming.Zh;
        if (string.IsNullOrWhiteSpace(target.Tagline)) target.Tagline = incoming.Tagline;
        if (string.IsNullOrWhiteSpace(target.Description)) target.Description = incoming.Description;
        if (string.IsNullOrWhiteSpace(target.Genre)) target.Genre = incoming.Genre;
        if (string.IsNullOrWhiteSpace(target.HeroPath)) target.HeroPath = incoming.HeroPath;
        if (string.IsNullOrWhiteSpace(target.CoverPath)) target.CoverPath = incoming.CoverPath;
        if (string.IsNullOrWhiteSpace(target.ExePath)) target.ExePath = incoming.ExePath;
        if (string.IsNullOrWhiteSpace(target.WorkDir)) target.WorkDir = incoming.WorkDir;
        if (string.IsNullOrWhiteSpace(target.LauncherPath)) target.LauncherPath = incoming.LauncherPath;
        // Hidden travels with the pack: a merged-in entry that was hidden on
        // the other machine stays hidden here too.
        if (incoming.Hidden) target.Hidden = true;

        target.Sessions ??= new List<PlaySession>();
        var known = new HashSet<string>(target.Sessions.Select(s => s.StartedUtc + "|" + s.EndedUtc));
        foreach (var session in incoming.Sessions ?? Enumerable.Empty<PlaySession>())
        {
            if (known.Add(session.StartedUtc + "|" + session.EndedUtc))
                target.Sessions.Add(session);
        }
        target.Sessions = target.Sessions.OrderBy(s => s.EndedUtc, StringComparer.Ordinal).ToList();
        if (target.Sessions.Count > 200)
            target.Sessions.RemoveRange(0, target.Sessions.Count - 200);
    }

    private static void TryDeleteDirectory(string path)
    {
        try { if (Directory.Exists(path)) Directory.Delete(path, true); } catch { }
    }

    private static void TryDeleteFile(string path)
    {
        try { if (File.Exists(path)) File.Delete(path); } catch { }
    }
}
