// 主题管理：列出、切换、移除主题与打开主题目录。
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
                    curtainMs = t.CurtainMs,
                    pinned = t.Pinned,
                    cssUrl = t.CssUrl,
                    interfacesUrl = t.InterfacesUrl,
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
}
