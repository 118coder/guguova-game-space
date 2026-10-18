using System.IO;
using System.Text.Json;
using NovaGameSpace.Models;

namespace NovaGameSpace.Services;

public static class AppPaths
{
    public static string Root { get; } = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "NOVA Game Space");

    public static string Media { get; } = Path.Combine(Root, "media");
    public static string Themes { get; } = Path.Combine(Root, "themes");
    public static string LibraryFile { get; } = Path.Combine(Root, "library.json");
    public static string LogFile { get; } = Path.Combine(Root, "nova.log");
    public static string WebRoot { get; } = Path.Combine(AppContext.BaseDirectory, "src");
    public static string BundledThemes { get; } = Path.Combine(AppContext.BaseDirectory, "themes");

    public static void Ensure()
    {
        Directory.CreateDirectory(Root);
        Directory.CreateDirectory(Media);
        Directory.CreateDirectory(Themes);
    }
}

public static class Log
{
    private static readonly object Gate = new();

    public static void Write(string message)
    {
        try
        {
            lock (Gate)
            {
                File.AppendAllText(AppPaths.LogFile,
                    $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {message}{Environment.NewLine}");
            }
        }
        catch
        {
            // Logging must never take the app down.
        }
    }

    public static void Error(string context, Exception ex) => Write($"ERROR {context}: {ex}");
}

public sealed class StoreService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    private readonly object _gate = new();
    private LibraryFile _library = new();

    public LibraryFile Library => _library;

    public void Load()
    {
        lock (_gate)
        {
            try
            {
                if (File.Exists(AppPaths.LibraryFile))
                {
                    var json = File.ReadAllText(AppPaths.LibraryFile);
                    var loaded = JsonSerializer.Deserialize<LibraryFile>(json, JsonOptions);
                    if (loaded != null)
                    {
                        _library = loaded;
                        _library.Games ??= new List<GameEntry>();
                        _library.Settings ??= new PlayerSettings();
                        Normalize(_library);
                    }
                }
            }
            catch (Exception ex)
            {
                Log.Error("load library", ex);
                TryBackupBrokenFile();
                _library = new LibraryFile();
            }
        }
    }

    /// <summary>Repairs duplicate display names left by older imports.</summary>
    private static void Normalize(LibraryFile library)
    {
        foreach (var game in library.Games)
        {
            if (!string.IsNullOrWhiteSpace(game.Zh) &&
                string.Equals(game.Zh.Trim(), (game.Name ?? "").Trim(), StringComparison.OrdinalIgnoreCase))
            {
                game.Zh = "";
            }
            game.Colors ??= new List<string>();
            game.Dna ??= new Models.CoverDna();

            // Early Steam imports wrote the install folder into the blurb,
            // which read poorly on the hero. Drop that generated sentence.
            if (game.Source == "steam" &&
                !string.IsNullOrEmpty(game.Description) &&
                game.Description.StartsWith("从本机 Steam 库导入：", StringComparison.Ordinal))
            {
                game.Description = "";
                if (game.Tagline == "来自 Steam 游戏库") game.Tagline = "";
            }
        }
    }

    public void Save()
    {
        lock (_gate)
        {
            try
            {
                var json = JsonSerializer.Serialize(_library, JsonOptions);
                var temp = AppPaths.LibraryFile + ".tmp";
                File.WriteAllText(temp, json);
                if (File.Exists(AppPaths.LibraryFile)) File.Replace(temp, AppPaths.LibraryFile, null);
                else File.Move(temp, AppPaths.LibraryFile);
            }
            catch (Exception ex)
            {
                Log.Error("save library", ex);
            }
        }
    }

    public GameEntry? Find(string id) => _library.Games.FirstOrDefault(g => g.Id == id);

    public GameEntry? FindBySteam(string appId) => _library.Games.FirstOrDefault(g => g.SteamAppId == appId);

    public void Add(GameEntry game)
    {
        _library.Games.Add(game);
        Save();
    }

    public void Remove(string id)
    {
        var game = Find(id);
        if (game == null) return;
        _library.Games.Remove(game);
        if (_library.CurrentGameId == id) _library.CurrentGameId = _library.Games.FirstOrDefault()?.Id;
        Save();
    }

    private static void TryBackupBrokenFile()
    {
        try
        {
            if (!File.Exists(AppPaths.LibraryFile)) return;
            var backup = AppPaths.LibraryFile + $".broken-{DateTime.Now:yyyyMMdd-HHmmss}.json";
            File.Copy(AppPaths.LibraryFile, backup, true);
        }
        catch
        {
            // ignore
        }
    }
}
