using System.Globalization;
using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Windows;
using WindowState = System.Windows.WindowState;
using Application = System.Windows.Application;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;
using NovaGameSpace.Models;
using NovaGameSpace.Services;

namespace NovaGameSpace;

/// <summary>Exposes the native library to the web UI through chrome.webview.postMessage.</summary>
public sealed class NativeBridge
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    private readonly StoreService _store;
    private readonly MediaService _media;
    private readonly LauncherService _launcher;
    private readonly ThemeService _themes = new();
    private WebView2? _web;

    public NativeBridge(StoreService store, MediaService media, LauncherService launcher)
    {
        _store = store;
        _media = media;
        _launcher = launcher;
    }

    public void Attach(WebView2 web)
    {
        _web = web;
        web.CoreWebView2.WebMessageReceived += OnMessageReceived;
        web.CoreWebView2.Settings.AreDevToolsEnabled = true;
        web.CoreWebView2.ProcessFailed += (_, args) => Log.Write($"webview process failed: {args.ProcessFailedKind}");
        web.CoreWebView2.Settings.IsStatusBarEnabled = false;
        web.CoreWebView2.Settings.AreBrowserAcceleratorKeysEnabled = false;
        // The launcher supplies its own themed context menu.
        web.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
        web.CoreWebView2.Settings.IsZoomControlEnabled = false;
        web.CoreWebView2.Settings.IsPasswordAutosaveEnabled = false;
        web.CoreWebView2.Settings.IsGeneralAutofillEnabled = false;

        try
        {
            AppPaths.Ensure();
            web.CoreWebView2.SetVirtualHostNameToFolderMapping(
                "nova.site", AppPaths.WebRoot, CoreWebView2HostResourceAccessKind.Allow);
            web.CoreWebView2.SetVirtualHostNameToFolderMapping(
                "nova.media", AppPaths.Media, CoreWebView2HostResourceAccessKind.Allow);
            if (!string.IsNullOrWhiteSpace(AppPaths.Themes))
            {
                web.CoreWebView2.SetVirtualHostNameToFolderMapping(
                    "nova.themes", AppPaths.Themes, CoreWebView2HostResourceAccessKind.Allow);
            }
        }
        catch (Exception ex)
        {
            Log.Error("host mapping", ex);
        }

        _launcher.GameStarted += info =>
        {
            Notify("session-started", info);
            PresentGameWindow(info, _launcher.TakeLaunchOptions(info.GameId), _store.Library.Settings);
        };
        _launcher.GameExited += (info, crashed, seconds) =>
        {
            Notify("session-ended", new
            {
                sessionId = info.SessionId,
                gameId = info.GameId,
                gameName = info.GameName,
                crashed,
                seconds,
                playtimeSeconds = _store.Find(info.GameId)?.PlaytimeSeconds ?? 0
            });
            if (_launcher.Running.Count == 0)
            {
                DoWindow(window => window.EndGameSession());
                // The engine is opt-in per launch, so it should not linger.
                Task.Run(() => ScalingEngine.ReleaseIfAutoStarted());
            }
            GameDisplay.ForgetProcess(info.ProcessId);

            // Steam writes its own playtime when the game exits, but not
            // instantly. Wait a beat, merge, and push the corrected numbers
            // to the UI so the hero does not keep showing the old total.
            Task.Run(async () =>
            {
                try
                {
                    await Task.Delay(2500);
                    var changed = _store.SyncSteamPlaytime();
                    if (changed.Count == 0) return;
                    Notify("playtime-synced", new
                    {
                        source = "steam",
                        games = changed.Select(game => new
                        {
                            id = game.Id,
                            playtimeSeconds = game.PlaytimeSeconds,
                            lastPlayedUtc = game.LastPlayedUtc
                        }).ToList()
                    });
                }
                catch (Exception ex)
                {
                    Log.Error("steam playtime after exit", ex);
                }
            });
        };
        // The client accepted the request but never spawned the game: usually
        // a login screen or an update, so the message says that instead of
        // blaming the executable path.
        _launcher.GameFailed += (gameId, message) => Notify("session-failed", new
        {
            gameId,
            gameName = _store.Find(gameId)?.Name ?? "",
            error = message
        });
    }

    public void Notify(string type, object payload)
    {
        try
        {
            var message = JsonSerializer.Serialize(new { type, payload }, JsonOptions);
            System.Windows.Application.Current?.Dispatcher.Invoke(() => _web?.CoreWebView2?.PostWebMessageAsJson(message));
        }
        catch (Exception ex)
        {
            Log.Error("notify", ex);
        }
    }

    private void OnMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        try
        {
            using var doc = JsonDocument.Parse(e.WebMessageAsJson);
            var root = doc.RootElement;
            // A postMessage(JSON.stringify(...)) arrives as a JSON string; unwrap it.
            if (root.ValueKind == JsonValueKind.String)
            {
                var inner = root.GetString();
                if (!string.IsNullOrEmpty(inner))
                {
                    using var innerDoc = JsonDocument.Parse(inner);
                    HandleRequest(innerDoc.RootElement, innerDoc);
                    return;
                }
            }
            HandleRequest(root, doc);
        }
        catch (Exception ex)
        {
            Log.Error("bridge message", ex);
        }
    }

    private void HandleRequest(JsonElement root, JsonDocument _)
    {
        try
        {
            var id = root.TryGetProperty("id", out var idElement) ? idElement.GetString() : null;
            var method = root.TryGetProperty("method", out var methodElement) ? methodElement.GetString() : null;
            var args = root.TryGetProperty("args", out var argsElement) && argsElement.ValueKind == JsonValueKind.Object
                ? argsElement
                : default;

            object? result = method switch
            {
                "boot" => BuildBootPayload(),
                "saveSettings" => SaveSettings(args),
                "setAvatar" => SetAvatar(args),
                "clearAvatar" => ClearAvatar(),
                "launch" => LaunchGame(args),
                "steamStatus" => SteamStatus(args),
                "startupState" => StartupState(),
                "setStartup" => SetStartup(args),
                "steamPrivilege" => SteamPrivilege.Diagnose(),
                "fixSteamPrivilege" => FixSteamPrivilege(args),
                "magpieStatus" => MagpieStatus(args),
                "startMagpie" => StartMagpie(),
                "applyScalingHotkey" => ApplyScalingHotkey(args),
                "restartScalingEngine" => RestartScalingEngine(),
                "stopScalingEngine" => StopScalingEngine(),
                "engineOptions" => EngineOptions(),
                "saveEngineOptions" => SaveEngineOptions(args),
                "openMagpie" => OpenMagpie(),
                "stop" => StopGame(args),
                "getRunning" => _launcher.Running,
                "syncSteamPlaytime" => SyncSteamPlaytime(),
                "scanLibrary" => ScanLibrary(),
                "refreshArtwork" => RefreshArtwork(args),
                "importCandidates" => ImportCandidates(args),
                "readManifest" => ReadManifest(args),
                "scanManifests" => ScanManifests(),
                "createGame" => CreateGame(args),
                "updateGame" => UpdateGame(args),
                "deleteGame" => DeleteGame(args),
                "setFavorite" => SetFavorite(args),
                "revealGame" => RevealGame(args),
                "revealPath" => RevealPath(args),
                "browseFile" => BrowseFile(args),
                "openDataFolder" => OpenDataFolder(),
                "openBackupsFolder" => OpenBackupsFolder(),
                "exportPack" => ExportPack(),
                "importPack" => ImportPack(args),
                "exportRecords" => ExportRecords(),
                "getStats" => new { ok = true, stats = _store.BuildStats(_store.DeveloperMode), storage = _store.BuildStorage() },
                "getSystem" => new { ok = true, system = SystemProfile.Detect(GetString(args, "tier") ?? _store.Library.Settings.CompatibilityTier) },
                "minimizeWindow" => DoWindow(w => w.WindowState = System.Windows.WindowState.Minimized),
                "beginDrag" => DoWindow(w => w.BeginNativeDrag()),
                "toggleMaximizeWindow" => DoWindow(w => w.ToggleMaximize()),
                "closeWindow" => DoWindow(w => w.RequestClose()),
                "exitApp" => DoWindow(w => w.QuitNow()),
                "hideToTray" => DoWindow(w => w.HideToTray()),
                "quitNow" => DoWindow(w => w.QuitNow()),
                "toggleFullscreen" => DoWindow(w => w.ToggleFullscreen()),
                "setFullscreen" => SetFullscreen(args),
                "fullscreenState" => GetFullscreenState(),
                "listThemes" => ListThemes(),
                "removeTheme" => RemoveTheme(args),
                "openThemesFolder" => OpenThemesFolder(),
                "setTheme" => SetTheme(args),
                "browse" => FileBrowser.List(GetString(args, "path"), GetString(args, "filter"),
                    args.ValueKind == JsonValueKind.Object && args.TryGetProperty("hidden", out var hidden) && hidden.ValueKind == JsonValueKind.True),
                "listDrives" => new { ok = true, drives = FileBrowser.Drives() },
                "readImagePreview" => ReadImagePreview(args),
                "windowState" => WindowStatePayload(),
                _ => new { error = $"unknown method {method}" }
            };

            if (id != null)
            {
                var message = JsonSerializer.Serialize(new { type = "response", id, result }, JsonOptions);
                _web?.CoreWebView2?.PostWebMessageAsJson(message);
            }
        }
        catch (Exception ex)
        {
            Log.Error("bridge message", ex);
        }
    }

    private object? DoWindow(Action<MainWindow> action)
    {
        System.Windows.Application.Current.Dispatcher.Invoke(() =>
        {
            if (System.Windows.Application.Current.MainWindow is MainWindow window) action(window);
        });
        return new { ok = true };
    }

    private object ListThemes()
    {
        try
        {
            _themes.Refresh();
            return new
            {
                ok = true,
                active = _store.Library.Settings.Theme,
                folder = AppPaths.Themes,
                themes = _themes.Themes.Select(t => new
                {
                    id = t.Id,
                    name = t.Name,
                    author = t.Author,
                    version = t.Version,
                    description = t.Description,
                    intro = t.Intro,
                    cssUrl = t.CssUrl,
                    previewUrl = t.PreviewUrl,
                    baseStyle = t.Base,
                    builtIn = t.BuiltIn,
                    ok = t.Ok,
                    error = t.Error,
                    tokens = t.Tokens,
                    icons = t.Icons,
                    features = t.Features,
                    sounds = t.Sounds,
                    lexicon = t.Lexicon
                }).ToList()
            };
        }
        catch (Exception ex)
        {
            Log.Error("list themes", ex);
            return new { ok = false, error = ex.Message };
        }
    }

    private object RemoveTheme(JsonElement args)
    {
        var id = GetString(args, "id");
        if (string.IsNullOrWhiteSpace(id)) return new { ok = false, error = "缺少主题 id" };
        var result = _themes.Remove(id);
        if (result.Ok && _store.Library.Settings.Theme == id)
        {
            _store.Library.Settings.Theme = ThemeService.BuiltInId;
            _store.Save();
        }
        return new { ok = result.Ok, error = result.Error };
    }

    private object OpenThemesFolder()
    {
        ThemeService.OpenFolder();
        return new { ok = true, folder = AppPaths.Themes };
    }

    private object SetTheme(JsonElement args)
    {
        var id = GetString(args, "id");
        if (string.IsNullOrWhiteSpace(id)) return new { ok = false, error = "缺少主题 id" };
        var theme = _themes.Find(id);
        if (theme == null) return new { ok = false, error = "找不到这个主题" };
        if (!theme.Ok) return new { ok = false, error = theme.Error ?? "主题不可用" };

        _store.Library.Settings.Theme = theme.Id;
        _store.Save();
        return new
        {
            ok = true,
            theme = new
            {
                id = theme.Id,
                name = theme.Name,
                description = theme.Description,
                intro = theme.Intro,
                cssUrl = theme.CssUrl,
                previewUrl = theme.PreviewUrl,
                baseStyle = theme.Base,
                tokens = theme.Tokens,
                icons = theme.Icons
            }
        };
    }

    private object SetFullscreen(JsonElement args)
    {
        var on = args.ValueKind == JsonValueKind.Object
                 && args.TryGetProperty("on", out var flag)
                 && flag.ValueKind == JsonValueKind.True;
        DoWindow(w => w.SetFullscreen(on));
        return new { ok = true, fullscreen = on };
    }

    private object GetFullscreenState()
    {
        var result = false;
        System.Windows.Application.Current.Dispatcher.Invoke(() =>
        {
            if (System.Windows.Application.Current.MainWindow is MainWindow window) result = window.IsFullscreen;
        });
        return new { ok = true, fullscreen = result };
    }

    /// <summary>
    /// Returns a thumbnail as a data URL so the in-app browser can preview an
    /// image before it is imported (no OS preview window involved).
    /// </summary>
    private object ReadImagePreview(JsonElement args)
    {
        var path = GetString(args, "path");
        if (string.IsNullOrWhiteSpace(path) || !File.Exists(path))
            return new { ok = false, error = "图片不存在" };
        try
        {
            using var image = System.Drawing.Image.FromFile(path);
            var width = 320;
            var height = Math.Max(1, (int)Math.Round(image.Height * (width / (double)image.Width)));
            using var thumb = new System.Drawing.Bitmap(image, width, height);
            using var stream = new MemoryStream();
            thumb.Save(stream, System.Drawing.Imaging.ImageFormat.Jpeg);
            var data = Convert.ToBase64String(stream.ToArray());
            return new { ok = true, url = $"data:image/jpeg;base64,{data}", width = image.Width, height = image.Height };
        }
        catch (Exception ex)
        {
            Log.Error("image preview", ex);
            return new { ok = false, error = "无法读取这张图片" };
        }
    }

    private object WindowStatePayload() => new
    {
        maximized = System.Windows.Application.Current.MainWindow is MainWindow window
            && (window.IsFullscreen || window.WindowState == System.Windows.WindowState.Maximized)
    };

    private object BuildBootPayload()
    {
        _store.EnsurePlayerIdentity();
        var library = _store.Library;
        var developerMode = _store.DeveloperMode;
        var visible = library.Games
            .Where(game => developerMode || !game.DeveloperOnly)
            .ToList();
        var current = visible.FirstOrDefault(game => game.Id == library.CurrentGameId)
            ?? visible.FirstOrDefault();
        var envDev = Environment.GetEnvironmentVariable("NOVA_DEV");
        return new
        {
            ok = true,
            version = typeof(NativeBridge).Assembly.GetName().Version?.ToString(3) ?? "1.5.0",
            platform = "win32",
            userName = Environment.UserName,
            dataFolder = AppPaths.Root,
            backupsFolder = AppPaths.Backups,
            developerMode,
            developerModeEnv = envDev == "1" || string.Equals(envDev, "true", StringComparison.OrdinalIgnoreCase),
            currentGameId = current?.Id,
            settings = library.Settings,
            games = visible.Select(ToPayload).ToList(),
            running = _launcher.Running,
            stats = _store.BuildStats(developerMode),
            storage = _store.BuildStorage(),
            system = SystemProfile.Detect(library.Settings.CompatibilityTier),
            steamRoot = GameScanner.FindSteamRoot(),
            startedByWindows = Environment.GetCommandLineArgs()
                .Any(arg => arg.StartsWith("--startup", StringComparison.OrdinalIgnoreCase))
        };
    }

    private GamePayload ToPayload(GameEntry game)
    {
        var mode = SteamService.ModeFor(game);
        // Only a Steam-launched entry depends on the client, so the client
        // probe is skipped for everything else and costs nothing at boot.
        SteamService.State? steam = mode == "steam" ? SteamService.Detect() : null;
        var exists = !string.IsNullOrWhiteSpace(game.ExePath) && File.Exists(game.ExePath);
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
            game.FullscreenScale);
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

    private static string MediaUrl(string path, string gameId, string fallbackName)
    {
        try
        {
            if (!string.IsNullOrWhiteSpace(path) && File.Exists(path))
            {
                var full = Path.GetFullPath(path);
                var mediaRoot = Path.GetFullPath(AppPaths.Media);
                if (full.StartsWith(mediaRoot, StringComparison.OrdinalIgnoreCase))
                {
                    var relative = CompatUtil.RelativePath(AppPaths.Media, full).Replace('\\', '/');
                    return $"https://nova.media/{relative}";
                }
            }
        }
        catch { }
        return $"https://nova.media/{gameId}/{fallbackName}.jpg";
    }

    private object SaveSettings(JsonElement args)
    {
        var settings = _store.Library.Settings;
        if (args.ValueKind == JsonValueKind.Object)
        {
            if (args.TryGetProperty("currentGameId", out var current) && current.ValueKind == JsonValueKind.String)
                _store.Library.CurrentGameId = current.GetString();
            if (args.TryGetProperty("sound", out var sound) && sound.ValueKind is JsonValueKind.True or JsonValueKind.False)
                settings.Sound = sound.GetBoolean();
            if (args.TryGetProperty("reduceMotion", out var motion) && motion.ValueKind is JsonValueKind.True or JsonValueKind.False)
                settings.ReduceMotion = motion.GetBoolean();
            if (args.TryGetProperty("calm", out var calm) && calm.ValueKind is JsonValueKind.True or JsonValueKind.False)
                settings.Calm = calm.GetBoolean();
            if (args.TryGetProperty("layout", out var layout) && layout.ValueKind == JsonValueKind.String)
                settings.Layout = layout.GetString() == "rail" ? "rail" : "row";
            if (args.TryGetProperty("theme", out var theme) && theme.ValueKind == JsonValueKind.String
                && _themes.Find(theme.GetString()) is { Ok: true } selected)
                settings.Theme = selected.Id;
            if (args.TryGetProperty("styleMode", out var mode) && mode.ValueKind == JsonValueKind.String)
                settings.StyleMode = mode.GetString() == "system" ? "system" : "adaptive";
            if (args.TryGetProperty("typeSeed", out var seed) && seed.TryGetInt32(out var seedValue))
                settings.TypeSeed = seedValue;
            if (args.TryGetProperty("playerName", out var player) && player.ValueKind == JsonValueKind.String)
            {
                var name = (player.GetString() ?? "").Trim();
                if (!string.IsNullOrWhiteSpace(name))
                {
                    settings.Playername = name;
                    settings.PlayerNameCustom = true;
                }
            }
            if (args.TryGetProperty("useSystemPlayerName", out var systemName) && systemName.ValueKind == JsonValueKind.True)
            {
                settings.Playername = Environment.UserName;
                settings.PlayerNameCustom = false;
            }
            if (args.TryGetProperty("closeToTray", out var tray) && tray.ValueKind is JsonValueKind.True or JsonValueKind.False)
                settings.CloseToTray = tray.GetBoolean();
            if (args.TryGetProperty("autoBackup", out var backup) && backup.ValueKind is JsonValueKind.True or JsonValueKind.False)
                settings.AutoBackup = backup.GetBoolean();
            if (args.TryGetProperty("startupFullscreen", out var startupFullscreen) && startupFullscreen.ValueKind is JsonValueKind.True or JsonValueKind.False)
                settings.StartupFullscreen = startupFullscreen.GetBoolean();
            if (args.TryGetProperty("minimizeOnLaunch", out var minimize) && minimize.ValueKind is JsonValueKind.True or JsonValueKind.False)
                settings.MinimizeOnLaunch = minimize.GetBoolean();
            if (args.TryGetProperty("scalingEngine", out var scaling) && scaling.ValueKind == JsonValueKind.String)
            {
                var value = scaling.GetString() ?? "auto";
                settings.ScalingEngine = value is "auto" or "native" or "off" ? value : "auto";
                DoWindow(window => window.ApplyScalingHotkey(settings.ScalingHotkey));
            }
            if (args.TryGetProperty("autoStartEngine", out var autoStart) && autoStart.ValueKind is JsonValueKind.True or JsonValueKind.False)
                settings.AutoStartEngine = autoStart.GetBoolean();
            if (args.TryGetProperty("scalingHotkey", out var hotkey) && hotkey.TryGetInt32(out var hotkeyCode) && hotkeyCode > 0)
            {
                settings.ScalingHotkey = hotkeyCode;
                DoWindow(window => window.ApplyScalingHotkey(hotkeyCode));
            }
            if (TryGetString(args, "magpiePath", out var magpie))
                settings.MagpiePath = string.IsNullOrWhiteSpace(magpie) ? null : magpie!.Trim();
            if (args.TryGetProperty("unifiedSfx", out var unified) && unified.ValueKind is JsonValueKind.True or JsonValueKind.False)
                settings.UnifiedSfx = unified.GetBoolean();
            if (args.TryGetProperty("librarySort", out var sort) && sort.ValueKind == JsonValueKind.String)
            {
                var value = sort.GetString() ?? "recent";
                settings.LibrarySort = value is "recent" or "name" or "playtime" or "added" or "launches"
                    ? value : "recent";
            }
            if (args.TryGetProperty("compatibilityTier", out var tier) && tier.ValueKind == JsonValueKind.String)
            {
                var value = tier.GetString() ?? "auto";
                settings.CompatibilityTier = value is "auto" or "full" or "balanced" or "safe"
                    ? value : "auto";
            }
            if (args.TryGetProperty("developerMode", out var developer) && developer.ValueKind is JsonValueKind.True or JsonValueKind.False)
                settings.DeveloperMode = developer.GetBoolean();
        }
        _store.Save();
        return new { ok = true };
    }

    private object SetAvatar(JsonElement args)
    {
        var path = GetString(args, "path");
        if (string.IsNullOrWhiteSpace(path) || !File.Exists(path))
            return new { ok = false, error = "找不到头像图片" };
        var relative = _media.ImportAvatar(path);
        if (string.IsNullOrWhiteSpace(relative))
            return new { ok = false, error = "无法读取这张图片" };
        _store.Library.Settings.AvatarFile = relative;
        _store.Save();
        return new { ok = true, avatarFile = relative };
    }

    private object ClearAvatar()
    {
        _store.Library.Settings.AvatarFile = null;
        _media.ClearAvatar();
        _store.Save();
        return new { ok = true };
    }

    private object LaunchGame(JsonElement args)
    {
        var game = ResolveGame(args);
        if (game == null) return new LaunchResult(false, "找不到这款游戏", null, null);

        // The details view can pass the live checkbox state before it is
        // persisted; otherwise the per-game choice wins, and an unset choice
        // follows the immersive (fullscreen) shell.
        bool? requested = null;
        if (args.ValueKind == JsonValueKind.Object && args.TryGetProperty("fullscreenScale", out var scale) &&
            scale.ValueKind is JsonValueKind.True or JsonValueKind.False)
        {
            requested = scale.GetBoolean();
        }

        var immersive = System.Windows.Application.Current?.MainWindow is MainWindow window && window.IsFullscreen;
        var fullscreen = requested ?? game.FullscreenScale ?? immersive;
        if (string.Equals(_store.Library.Settings.ScalingEngine, "off", StringComparison.OrdinalIgnoreCase))
            fullscreen = false;

        return _launcher.Launch(game, new LaunchOptions(fullscreen));
    }

    /// <summary>Runs off the UI thread: the game may take many seconds to create
    /// its window, and the launcher must never wait for it.</summary>
    private void PresentGameWindow(RunningSessionInfo info, LaunchOptions options, PlayerSettings settings)
    {
        var minimize = settings.MinimizeOnLaunch;
        try
        {
            Application.Current?.Dispatcher.Invoke(() =>
            {
                if (Application.Current.MainWindow is MainWindow window) window.BeginGameSession();
            });
        }
        catch (Exception ex)
        {
            Log.Error("begin game session", ex);
        }

        var engine = settings.ScalingEngine;
        var scale = options.FullscreenScale && !string.Equals(engine, "off", StringComparison.OrdinalIgnoreCase);

        // The launcher still owns the foreground here, so the game window can
        // be brought forward as soon as it exists.
        GameDisplay.AllowForeground(info.ProcessId);

        Task.Run(() =>
        {
            try
            {
                var result = GameDisplay.Present(info.ProcessId, scale, engine, settings, 15000);

                // Only step aside once the hand-off had its chance. Minimizing
                // first would drop the foreground permission before the window
                // exists, which is exactly what left the game behind us.
                if (minimize)
                {
                    try
                    {
                        Application.Current?.Dispatcher.Invoke(() =>
                        {
                            if (Application.Current.MainWindow is MainWindow window) window.MinimizeForGame();
                        });
                    }
                    catch (Exception ex)
                    {
                        Log.Error("minimize for game", ex);
                    }
                }

                Notify("session-presented", new
                {
                    gameId = info.GameId,
                    gameName = info.GameName,
                    sessionId = info.SessionId,
                    requested = scale,
                    windowFound = result.WindowFound,
                    scaled = result.Scaled,
                    foreground = result.Foreground,
                    engine = result.Engine,
                    error = result.Error
                });
            }
            catch (Exception ex)
            {
                Log.Error("present game window", ex);
                Notify("session-presented", new
                {
                    gameId = info.GameId,
                    gameName = info.GameName,
                    sessionId = info.SessionId,
                    requested = scale,
                    windowFound = false,
                    scaled = false,
                    foreground = false,
                    engine = "none",
                    error = ex.Message
                });
            }
        });
    }

    /// <summary>Removes the elevation flag first (fast, synchronous), then asks
    /// the client to restart on a background thread and reports back through
    /// <c>steam-privilege</c>.</summary>
    private object FixSteamPrivilege(JsonElement args)
    {
        var restart = args.ValueKind == JsonValueKind.Object &&
                      args.TryGetProperty("restart", out var flag) && flag.ValueKind == JsonValueKind.True;

        var repair = SteamPrivilege.RemoveAdminLayer();
        if (!repair.Ok)
            return new { ok = false, error = repair.Error, removed = false };

        if (!restart)
            return new { ok = true, removed = repair.Removed, backup = repair.Backup, restarting = false };

        Task.Run(() =>
        {
            var result = SteamPrivilege.RestartClient();
            Notify("steam-privilege", new
            {
                restarted = result.Ok,
                stopped = result.Stopped,
                started = result.Started,
                message = result.Message
            });
        });

        return new { ok = true, removed = repair.Removed, backup = repair.Backup, restarting = true };
    }

    private object MagpieStatus(JsonElement args)
    {
        try
        {
            var status = ScalingEngine.Inspect(_store.Library.Settings);
            return new
            {
                ok = true,
                available = status.Available,
                exePath = status.ExePath,
                running = status.Running,
                bundled = status.Bundled,
                hotkey = status.Hotkey,
                hotkeyLabel = ScalingEngine.Label(status.Hotkey),
                supported = status.Supported,
                autoStart = _store.Library.Settings.AutoStartEngine,
                note = status.Note
            };
        }
        catch (Exception ex)
        {
            Log.Error("magpie status", ex);
            return new { ok = false, error = ex.Message };
        }
    }

    private object StartMagpie()
    {
        var settings = _store.Library.Settings;
        Task.Run(() =>
        {
            var ok = ScalingEngine.EnsureRunning(settings, true, out var status);
            Notify("magpie-status", new
            {
                ok,
                error = ok ? null : status.Note,
                running = status.Running,
                bundled = status.Bundled,
                hotkey = status.Hotkey
            });
        });
        return new { ok = true, starting = true };
    }

    /// <summary>Writes the hotkey to the engine config and, when needed,
    /// restarts the engine so it registers the new key immediately.</summary>
    private object ApplyScalingHotkey(JsonElement args)
    {
        var settings = _store.Library.Settings;
        var code = settings.ScalingHotkey;
        if (args.ValueKind == JsonValueKind.Object && args.TryGetProperty("code", out var value) &&
            value.TryGetInt32(out var requested) && requested > 0)
        {
            code = requested;
            settings.ScalingHotkey = requested;
            _store.Save();
        }

        // Native mode: the launcher itself owns the key, nothing to write to
        // an external engine.
        if (string.Equals(settings.ScalingEngine, "native", StringComparison.OrdinalIgnoreCase))
        {
            DoWindow(window => window.ApplyScalingHotkey(code));
            return new { ok = true, message = "快捷键已保存 · 由启动器处理", running = false, restarted = false };
        }

        var wasRunning = ScalingEngine.IsRunning();
        if (!ScalingEngine.WriteHotkey(code, out var message))
        {
            // The engine may never have run, so it has no config yet. The
            // setting is still saved; EnsureRunning applies it on first start.
            return new
            {
                ok = true,
                message = "快捷键已保存；第一次启动缩放引擎时生效",
                warning = message,
                running = wasRunning,
                restarted = false
            };
        }

        if (!wasRunning)
            return new { ok = true, message = "快捷键已保存；下次启动引擎时生效", running = false, restarted = false };

        var restart = args.ValueKind == JsonValueKind.Object &&
                      args.TryGetProperty("restart", out var flag) && flag.ValueKind == JsonValueKind.True;
        if (!restart)
            return new { ok = true, message = "快捷键已写入；重启引擎后生效", running = true, restarted = false };

        Task.Run(() =>
        {
            var ok = ScalingEngine.Restart(settings, out var restartMessage);
            Notify("scaling-engine", new { ok, message = restartMessage });
        });
        return new { ok = true, message = "正在重启缩放引擎以应用快捷键…", running = true, restarted = true };
    }

    private object RestartScalingEngine()
    {
        var settings = _store.Library.Settings;
        Task.Run(() =>
        {
            var ok = ScalingEngine.Restart(settings, out var message);
            Notify("scaling-engine", new { ok, message });
        });
        return new { ok = true, starting = true };
    }

    private object StopScalingEngine()
    {
        Task.Run(() =>
        {
            var ok = ScalingEngine.Quit();
            Notify("scaling-engine", new { ok, message = ok ? "缩放引擎已关闭" : "缩放引擎没有退出" });
        });
        return new { ok = true, stopping = true };
    }

    private object EngineOptions()
    {
        try
        {
            var options = ScalingEngine.ReadOptions(_store.Library.Settings);
            return new
            {
                ok = options.Ok,
                error = options.Error,
                configPath = options.ConfigPath,
                bundled = options.Bundled,
                running = options.Running,
                modes = options.Modes.Select(mode => new
                {
                    mode.Index,
                    mode.Name,
                    mode.Effects,
                    mode.Available,
                    mode.Missing,
                    mode.Note
                }),
                scalingMode = options.ScalingMode,
                captureMethod = options.CaptureMethod,
                cursorScaling = options.CursorScaling,
                frameRateLimiterEnabled = options.FrameRateLimiterEnabled,
                maxFrameRate = options.MaxFrameRate,
                gameMode3d = options.GameMode3d,
                autoStart = _store.Library.Settings.AutoStartEngine
            };
        }
        catch (Exception ex)
        {
            Log.Error("engine options", ex);
            return new { ok = false, error = ex.Message };
        }
    }

    private object SaveEngineOptions(JsonElement args)
    {
        var settings = _store.Library.Settings;
        var scalingMode = IntArg(args, "scalingMode", 0);
        var captureMethod = IntArg(args, "captureMethod", 0);
        var cursorScaling = IntArg(args, "cursorScaling", 6);
        var frameRateLimiterEnabled = BoolArg(args, "frameRateLimiterEnabled", false);
        var maxFrameRate = NumberArg(args, "maxFrameRate", 120);
        var gameMode3d = BoolArg(args, "gameMode3d", false);
        if (args.ValueKind == JsonValueKind.Object && args.TryGetProperty("autoStartEngine", out var autoStart) &&
            autoStart.ValueKind is JsonValueKind.True or JsonValueKind.False)
        {
            settings.AutoStartEngine = autoStart.GetBoolean();
            _store.Save();
        }

        if (!ScalingEngine.SaveOptions(scalingMode, captureMethod, cursorScaling,
                frameRateLimiterEnabled, maxFrameRate, gameMode3d, out var message))
            return new { ok = false, error = message };

        Task.Run(() =>
        {
            var ok = ScalingEngine.Restart(settings, out var restartMessage);
            Notify("scaling-engine", new { ok, message = restartMessage });
        });
        return new { ok = true, message = "设置已保存，正在重启缩放引擎…" };
    }

    private object OpenMagpie()
    {
        var ok = ScalingEngine.Show(_store.Library.Settings, out var message);
        return new { ok, message };
    }

    private static int IntArg(JsonElement args, string name, int fallback) =>
        args.ValueKind == JsonValueKind.Object && args.TryGetProperty(name, out var value) &&
        value.TryGetInt32(out var number) ? number : fallback;

    private static double NumberArg(JsonElement args, string name, double fallback) =>
        args.ValueKind == JsonValueKind.Object && args.TryGetProperty(name, out var value) &&
        value.TryGetDouble(out var number) ? number : fallback;

    private static bool BoolArg(JsonElement args, string name, bool fallback) =>
        args.ValueKind == JsonValueKind.Object && args.TryGetProperty(name, out var value) &&
        value.ValueKind is JsonValueKind.True or JsonValueKind.False ? value.GetBoolean() : fallback;

    /// <summary>Client state plus what this executable actually needs. Used by
    /// the manage panel so a "打不开" entry can be explained instead of guessed.</summary>
    private object StartupState()
    {
        var state = StartupService.Inspect();
        return new
        {
            ok = true,
            enabled = state.Enabled,
            pointsHere = state.PointsHere,
            command = state.Command,
            exePath = state.ExePath
        };
    }

    private object SetStartup(JsonElement args)
    {
        var enable = args.ValueKind == JsonValueKind.Object &&
                     args.TryGetProperty("enabled", out var flag) && flag.ValueKind == JsonValueKind.True;
        var ok = enable ? StartupService.Enable(out var startupError) : StartupService.Disable(out startupError);
        if (!ok) return new { ok = false, error = startupError };

        var state = StartupService.Inspect();
        return new
        {
            ok = true,
            state = new
            {
                enabled = state.Enabled,
                pointsHere = state.PointsHere,
                command = state.Command,
                exePath = state.ExePath
            }
        };
    }

    private object SteamStatus(JsonElement args)
    {
        try
        {
            var state = SteamService.Detect(true);
            var game = ResolveGame(args);
            if (game == null)
                return new { ok = true, installed = state.Installed, running = state.Running,
                    signedIn = state.SignedIn, root = state.Root };

            var dependency = SteamService.Inspect(game);
            var privilege = SteamPrivilege.Diagnose();
            return new
            {
                ok = true,
                installed = state.Installed,
                running = state.Running,
                signedIn = state.SignedIn,
                root = state.Root,
                appId = game.SteamAppId,
                launchMode = game.LaunchMode,
                launchModeResolved = SteamService.ModeFor(game),
                usesSteamApi = dependency.UsesSteamApi,
                steamStub = dependency.SteamStub,
                hasAppIdFile = dependency.HasAppIdFile,
                note = dependency.Note,
                adminLayer = privilege.AdminLayer,
                steamElevated = privilege.SteamElevated,
                launcherElevated = privilege.LauncherElevated,
                needsPrivilegeFix = privilege.NeedsFix,
                privilegeNote = privilege.Note,
                // A SteamStub exe cannot start without the client, and an
                // app that imports steam_api stalls at initialisation.
                requiresClient = dependency.SteamStub || dependency.UsesSteamApi
            };
        }
        catch (Exception ex)
        {
            Log.Error("steam status", ex);
            return new { ok = false, error = ex.Message };
        }
    }

    private object StopGame(JsonElement args)
    {
        var game = ResolveGame(args);
        if (game == null) return new { ok = false, error = "找不到这款游戏" };
        var ok = _launcher.Stop(game.Id);
        return new { ok };
    }

    private GameEntry? ResolveGame(JsonElement args)
    {
        if (args.ValueKind != JsonValueKind.Object) return null;
        var id = args.TryGetProperty("id", out var idElement) ? idElement.GetString() : null;
        if (!string.IsNullOrEmpty(id)) return _store.Find(id);
        if (args.TryGetProperty("steamAppId", out var steam) && steam.ValueKind == JsonValueKind.String)
            return _store.FindBySteam(steam.GetString() ?? "");
        return null;
    }

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

    private object ScanLibrary()
    {
        try
        {
            var scan = GameScanner.Scan();
            var steam = scan.Steam.Select(candidate =>
            {
                var existing = _store.FindBySteam(candidate.AppId);
                return new
                {
                    appId = candidate.AppId,
                    name = candidate.Name,
                    installDir = candidate.InstallDir,
                    exePath = candidate.ExePath,
                    heroUrl = candidate.HeroPath != null ? FileUrl(candidate.HeroPath) : null,
                    coverUrl = candidate.CoverPath != null ? FileUrl(candidate.CoverPath) : null,
                    imported = existing != null,
                    gameId = existing?.Id
                };
            }).ToList();

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

            return new { ok = true, steamRoot = scan.SteamRoot, steam, shortcuts };
        }
        catch (Exception ex)
        {
            Log.Error("scan library", ex);
            return new { ok = false, error = ex.Message };
        }
    }

    private object ImportCandidates(JsonElement args)
    {
        var added = 0;
        try
        {
            if (!args.TryGetProperty("steamAppIds", out var steamIds) || steamIds.ValueKind != JsonValueKind.Array)
                return new { ok = true, added };

            var scan = GameScanner.Scan();
            foreach (var idElement in steamIds.EnumerateArray())
            {
                var appId = idElement.GetString();
                if (string.IsNullOrEmpty(appId)) continue;
                var candidate = scan.Steam.FirstOrDefault(s => s.AppId == appId);
                if (candidate == null || _store.FindBySteam(appId) != null) continue;

                var game = new GameEntry
                {
                    Name = candidate.Name,
                    Zh = "",
                    Source = "steam",
                    SteamAppId = appId,
                    ExePath = candidate.ExePath,
                    WorkDir = candidate.InstallDir,
                    Tagline = "",
                    Description = "",
                    Genre = "Steam"
                };
                ApplyMedia(game, candidate.HeroPath, candidate.CoverPath);
                _store.Add(game);
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

    private void ApplyMedia(GameEntry game, string? sourceImage, string? coverImage = null)
    {
        var imported = false;
        CoverAnalysis? analysis = null;
        var image = !string.IsNullOrWhiteSpace(sourceImage) && File.Exists(sourceImage) ? sourceImage : null;

        if (image != null)
        {
            analysis = _media.ImportImage(game.Id, image);
            if (analysis != null)
            {
                game.HeroPath = Path.Combine(_media.GameMediaDir(game.Id), "hero.jpg");
                game.CoverPath = Path.Combine(_media.GameMediaDir(game.Id), "cover.jpg");
                imported = true;
            }
        }

        if (!imported && !string.IsNullOrWhiteSpace(coverImage) && File.Exists(coverImage))
        {
            analysis = _media.ImportImage(game.Id, coverImage);
            if (analysis != null)
            {
                game.HeroPath = Path.Combine(_media.GameMediaDir(game.Id), "hero.jpg");
                game.CoverPath = Path.Combine(_media.GameMediaDir(game.Id), "cover.jpg");
                imported = true;
            }
        }

        if (!imported && !string.IsNullOrWhiteSpace(game.ExePath))
        {
            analysis = _media.ImportExecutableIcon(game.Id, game.ExePath);
            if (analysis != null)
            {
                game.HeroPath = Path.Combine(_media.GameMediaDir(game.Id), "hero.jpg");
                game.CoverPath = Path.Combine(_media.GameMediaDir(game.Id), "cover.jpg");
                imported = true;
            }
        }

        ApplyAnalysis(game, analysis);
    }

    private static void ApplyAnalysis(GameEntry game, CoverAnalysis? analysis)
    {
        if (analysis == null) return;
        game.Accent = analysis.Accent;
        game.Accent2 = analysis.Accent2;
        game.Glow = analysis.Glow;
        game.Scrim = analysis.Scrim;
        game.Colors = analysis.Colors.ToList();
        game.Dna = new CoverDna
        {
            Luma = analysis.Luma,
            Sat = analysis.Saturation,
            Warmth = analysis.Warmth,
            Edge = analysis.Edge
        };
    }

    /// <summary>
    /// docs/INTEGRATION.md: read a nova-game.json for the chosen exe so the
    /// editor can be prefilled instead of asking the user to retype metadata.
    /// </summary>
    private object ReadManifest(JsonElement args)
    {
        var exe = GetString(args, "exePath");
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
            var exe = GetString(args, "exePath") ?? "";
            if (string.IsNullOrWhiteSpace(exe) || !File.Exists(exe))
                return new { ok = false, error = "请选择一个存在的可执行文件" };

            var manifestPath = GetString(args, "manifestPath");
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
                    WorkDir = GetString(args, "workDir") ?? Path.GetDirectoryName(exe) ?? "",
                    Source = "manual"
                };
            }

            game.TypeRecipe = NormalizeTypeRecipe(GetString(args, "typeRecipe"));
            var heroPosition = GetString(args, "heroPosition");
            if (!string.IsNullOrWhiteSpace(heroPosition)) game.HeroPosition = NormalizeHeroPosition(heroPosition);
            if (TryGetNumber(args, "heroZoom", out var heroZoom)) game.HeroZoom = NormalizeHeroZoom(heroZoom);

            var explicitImage = GetString(args, "imagePath");
            if (string.IsNullOrWhiteSpace(explicitImage) && manifest != null)
            {
                explicitImage = ManifestImporter.ResolveRelative(manifest.Hero, manifestPath)
                    ?? ManifestImporter.ResolveRelative(manifest.Cover, manifestPath);
            }
            ApplyMedia(game, explicitImage);
            var logo = GetString(args, "logoPath");
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
                var normalized = (launchMode ?? "").Trim().ToLowerInvariant();
                if (normalized == "steam" && string.IsNullOrWhiteSpace(game.SteamAppId))
                    return new { ok = false, error = "没有 AppID，无法使用 Steam 启动方式" };
                game.LaunchMode = normalized == "steam" || normalized == "direct" ? normalized : "auto";
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

            if (TryGetString(args, "exePath", out var exe) && !string.IsNullOrWhiteSpace(exe))
            {
                if (!File.Exists(exe)) return new { ok = false, error = "该可执行文件不存在" };
                game.ExePath = exe;
            }

            var image = GetString(args, "imagePath");
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

    private object RevealGame(JsonElement args)
    {
        var game = ResolveGame(args);
        var path = game?.ExePath;
        if (string.IsNullOrWhiteSpace(path) || !File.Exists(path)) return new { ok = false };
        try
        {
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
            {
                FileName = "explorer.exe",
                Arguments = $"/select,\"{path}\"",
                UseShellExecute = true
            });
            return new { ok = true };
        }
        catch (Exception ex)
        {
            return new { ok = false, error = ex.Message };
        }
    }

    private object RevealPath(JsonElement args)
    {
        var path = GetString(args, "path");
        if (string.IsNullOrWhiteSpace(path) || !File.Exists(path)) return new { ok = false };
        try
        {
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
            {
                FileName = "explorer.exe",
                Arguments = $"/select,\"{path}\"",
                UseShellExecute = true
            });
            return new { ok = true };
        }
        catch (Exception ex)
        {
            return new { ok = false, error = ex.Message };
        }
    }

    private object BrowseFile(JsonElement args)
    {
        var uri = GetString(args, "uri") ?? "";
        if (!uri.StartsWith("file:", StringComparison.OrdinalIgnoreCase) &&
            !uri.StartsWith("https://nova.", StringComparison.OrdinalIgnoreCase))
            return new { ok = false };
        try
        {
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo { FileName = uri, UseShellExecute = true });
            return new { ok = true };
        }
        catch
        {
            return new { ok = false };
        }
    }

    private object OpenDataFolder()
    {
        try
        {
            AppPaths.Ensure();
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
            {
                FileName = AppPaths.Root,
                UseShellExecute = true
            });
            return new { ok = true };
        }
        catch
        {
            return new { ok = false };
        }
    }

    private object OpenBackupsFolder()
    {
        try
        {
            AppPaths.Ensure();
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
            {
                FileName = AppPaths.Backups,
                UseShellExecute = true
            });
            return new { ok = true, path = AppPaths.Backups };
        }
        catch (Exception ex)
        {
            return new { ok = false, error = ex.Message };
        }
    }

    private object ExportPack()
    {
        var result = BackupService.Export(_store);
        return new
        {
            ok = result.Ok,
            error = result.Error,
            path = result.Path,
            size = result.Size,
            games = result.Games,
            mediaFiles = result.MediaFiles
        };
    }

    private object ImportPack(JsonElement args)
    {
        var path = GetString(args, "path");
        var mode = GetString(args, "mode") == "replace" ? "replace" : "merge";
        var result = BackupService.Import(_store, path ?? "", mode);
        return new
        {
            ok = result.Ok,
            error = result.Error,
            backupPath = result.BackupPath,
            games = result.Games,
            added = result.Added,
            replaced = result.Replaced,
            mediaFiles = result.MediaFiles,
            missing = result.Missing
        };
    }

    private object ExportRecords()
    {
        try
        {
            var path = BackupService.ExportRecordsCsv(_store);
            return new { ok = true, path };
        }
        catch (Exception ex)
        {
            Log.Error("export records", ex);
            return new { ok = false, error = ex.Message };
        }
    }

    private static string? GetString(JsonElement args, string name) =>
        args.ValueKind == JsonValueKind.Object && args.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;

    private static bool TryGetNumber(JsonElement args, string name, out double value)
    {
        value = 0;
        if (args.ValueKind != JsonValueKind.Object || !args.TryGetProperty(name, out var element)) return false;
        if (element.ValueKind != JsonValueKind.Number) return false;
        return element.TryGetDouble(out value);
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

    private static double ParseDouble(string text, double fallback) =>
        double.TryParse(text, NumberStyles.Float, CultureInfo.InvariantCulture, out var value) ? value : fallback;

    private static bool TryGetString(JsonElement args, string name, out string? value)
    {
        value = null;
        if (args.ValueKind != JsonValueKind.Object || !args.TryGetProperty(name, out var element)) return false;
        if (element.ValueKind == JsonValueKind.Null) { value = null; return true; }
        if (element.ValueKind != JsonValueKind.String) return false;
        value = element.GetString();
        return true;
    }

    private static string FileUrl(string path) => "file:///" + path.Replace('\\', '/');
}
