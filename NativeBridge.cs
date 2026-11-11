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

// 其余成员按领域拆分为同目录的 NativeBridge.*.cs partial 分片文件（Capture / Engine / Games / Launch / Library / Media / Settings / System / Themes / Update）。

/// <summary>Exposes the native library to the web UI through chrome.webview.postMessage.</summary>
public sealed partial class NativeBridge
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

            // Steam artwork lives in appcache/librarycache outside the media
            // root; mapping each library's cache folder once, up front, keeps
            // scan cover URLs loadable without copying a single file.
            foreach (var cacheRoot in GameScanner.CacheRoots())
            {
                MapFileHost(cacheRoot);
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
                "platformSummary" => PlatformSummary(),
                "resolveDrop" => ResolveDrop(args),
                "dismissFirstRun" => DismissFirstRun(),
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
                "capturePage" => QueuePageCapture(args),
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
                "browse" => FileBrowser.List(GetPath(args, "path"), GetString(args, "filter"),
                    args.ValueKind == JsonValueKind.Object && args.TryGetProperty("hidden", out var hidden) && hidden.ValueKind == JsonValueKind.True),
                "listDrives" => new { ok = true, drives = FileBrowser.Drives() },
                "readImagePreview" => ReadImagePreview(args),
                "checkUpdate" => BeginUpdateCheck(),
                "maybeAutoUpdateCheck" => MaybeAutoUpdateCheck(),
                "downloadUpdate" => BeginUpdateDownload(args),
                "cancelUpdateDownload" => CancelUpdateDownload(),
                "openUpdateFolder" => OpenUpdateFolder(),
                "applyUpdate" => ApplyUpdate(args),
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
            // Administrator mode: the launcher itself runs elevated, so the
            // long-press force kill can end any game process (Task Manager style).
            elevated = IsElevated(),
            currentGameId = current?.Id,
            settings = library.Settings,
            // The first-run import prompt is a product decision, not a setting:
            // it shows once, then the flag lives next to the rest of the store.
            firstRun = !library.Settings.FirstRunDone,
            games = visible.Select(ToPayload).ToList(),
            running = _launcher.Running,
            stats = _store.BuildStats(developerMode),
            storage = _store.BuildStorage(),
            system = SystemProfile.Detect(library.Settings.CompatibilityTier),
            steamRoot = GameScanner.FindSteamRoot(),
            // A package left behind by an interrupted swap is the only memory
            // of that upgrade: hand it to the page so the update panel can
            // offer it again (§1.41.5).
            pendingUpdate = PendingUpdate(),
            startedByWindows = Environment.GetCommandLineArgs()
                .Any(arg => arg.StartsWith("--startup", StringComparison.OrdinalIgnoreCase))
        };
    }

    private static bool IsElevated()
    {
        try
        {
            using var identity = System.Security.Principal.WindowsIdentity.GetCurrent();
            var principal = new System.Security.Principal.WindowsPrincipal(identity);
            return principal.IsInRole(System.Security.Principal.WindowsBuiltInRole.Administrator);
        }
        catch
        {
            return false;
        }
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

    private static string? GetString(JsonElement args, string name) =>
        args.ValueKind == JsonValueKind.Object && args.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;

    /// <summary>
    /// A path argument, with one layer of surrounding quotes removed.
    ///
    /// Explorer's "Copy as path" produces `"E:\Game\DFO 110 登录器.exe"`, and
    /// players paste that verbatim. Without this the first character is a
    /// quote, File.Exists says no, and the launcher answers "请选择一个存在的
    /// 可执行文件" for a file that is plainly there — or, for a cover image,
    /// silently falls back to the executable icon.
    ///
    /// The page strips quotes too (app.js cleanPath). This is the second gate:
    /// drag-and-drop, manifests and scripted callers never pass through it.
    /// Interior spaces are preserved; a quoted path is still a legal filename
    /// on NTFS, so only a *balanced* pair is stripped.
    /// </summary>
    private static string? GetPath(JsonElement args, string name) => CleanPath(GetString(args, name));

    /// <summary>Quote characters Explorer and chat apps wrap a copied path in:
    /// straight quotes plus the curly ones Word/WeChat substitute.</summary>
    private static readonly char[] Quotes = { '"', '\'', '\u201c', '\u201d', '\u2018', '\u2019' };

    internal static string? CleanPath(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return value;
        var path = value.Trim();
        for (var pass = 0; pass < 2; pass++)
        {
            var before = path;
            path = path.Trim().Trim(Quotes).Trim();
            if (path == before) break;
        }
        if (path.StartsWith("file://", StringComparison.OrdinalIgnoreCase))
        {
            var stripped = path.Substring("file://".Length).TrimStart('/');
            try { path = Uri.UnescapeDataString(stripped); } catch { path = stripped; }
        }
        return path;
    }

    private static bool TryGetNumber(JsonElement args, string name, out double value)
    {
        value = 0;
        if (args.ValueKind != JsonValueKind.Object || !args.TryGetProperty(name, out var element)) return false;
        if (element.ValueKind != JsonValueKind.Number) return false;
        return element.TryGetDouble(out value);
    }

    private static bool TryGetString(JsonElement args, string name, out string? value)
    {
        value = null;
        if (args.ValueKind != JsonValueKind.Object || !args.TryGetProperty(name, out var element)) return false;
        if (element.ValueKind == JsonValueKind.Null) { value = null; return true; }
        if (element.ValueKind != JsonValueKind.String) return false;
        value = element.GetString();
        return true;
    }
}
