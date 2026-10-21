using System.Globalization;
using System.IO;
using System.Text;

namespace NovaGameSpace.Services;

/// <summary>
/// Reads the playtime Steam itself has recorded for installed apps.
///
/// Steam keeps two numbers per app in
/// <c>userdata\&lt;id&gt;\config\localconfig.vdf</c>: <c>Playtime</c> (minutes)
/// and <c>LastPlayed</c> (unix seconds). The launcher used to count only the
/// time it saw itself, so a library imported from Steam showed "不到 1 分钟"
/// next to a game the player had finished twice. This reader is optional and
/// read-only: missing files, unknown formats and permission errors simply
/// leave the launcher's own count in place.
/// </summary>
public static class SteamPlaytime
{
    public sealed record Snapshot(long Seconds, DateTime? LastPlayedUtc);

    /// <summary>All accounts found under the Steam root, merged per app id.
    /// Family-sharing machines can hold several user folders; taking the
    /// largest value per app avoids the launcher flipping numbers depending
    /// on which folder happens to be enumerated first.</summary>
    public static Dictionary<string, Snapshot> Read()
    {
        var result = new Dictionary<string, Snapshot>(StringComparer.Ordinal);
        try
        {
            var root = GameScanner.FindSteamRoot();
            if (string.IsNullOrWhiteSpace(root)) return result;
            var userdata = Path.Combine(root, "userdata");
            if (!Directory.Exists(userdata)) return result;

            foreach (var folder in Directory.EnumerateDirectories(userdata))
            {
                var config = Path.Combine(folder, "config", "localconfig.vdf");
                if (!File.Exists(config)) continue;
                try
                {
                    var document = Kv.Parse(File.ReadAllText(config));
                    var apps = document?.Child("UserLocalConfigStore", "Software", "Valve", "Steam", "apps");
                    if (apps == null) continue;

                    foreach (var pair in apps.Children)
                    {
                        if (!long.TryParse(pair.Key, NumberStyles.Integer, CultureInfo.InvariantCulture, out _))
                            continue;
                        var minutes = pair.Value.Long("Playtime");
                        var lastUnix = pair.Value.Long("LastPlayed");
                        var seconds = Math.Max(0, minutes) * 60;
                        DateTime? last = lastUnix > 0
                            ? DateTimeOffset.FromUnixTimeSeconds(lastUnix).UtcDateTime
                            : null;

                        if (result.TryGetValue(pair.Key, out var existing))
                        {
                            seconds = Math.Max(seconds, existing.Seconds);
                            last = Latest(existing.LastPlayedUtc, last);
                        }
                        result[pair.Key] = new Snapshot(seconds, last);
                    }
                }
                catch (Exception ex)
                {
                    // One malformed user profile must not hide the others.
                    Log.Error($"steam playtime {config}", ex);
                }
            }
        }
        catch (Exception ex)
        {
            Log.Error("steam playtime scan", ex);
        }
        return result;
    }

    private static DateTime? Latest(DateTime? a, DateTime? b)
    {
        if (a == null) return b;
        if (b == null) return a;
        return a.Value >= b.Value ? a : b;
    }

    /// <summary>
    /// Minimal Valve KeyValues reader. localconfig.vdf is a nested set of
    /// quoted keys, quoted values and braces; comments with // are allowed.
    /// We only need lookups by path, so values are kept as strings.
    /// </summary>
    private sealed class Kv
    {
        public Dictionary<string, Kv> Children { get; } = new(StringComparer.OrdinalIgnoreCase);
        public string? Value { get; private set; }

        public static Kv Parse(string text)
        {
            var tokens = Tokenize(text);
            var index = 0;
            return ParseBlock(tokens, ref index);
        }

        private static Kv ParseBlock(List<Token> tokens, ref int index)
        {
            var node = new Kv();
            while (index < tokens.Count)
            {
                var token = tokens[index];
                if (token.Kind == TokenKind.Close)
                {
                    index++;
                    return node;
                }
                if (token.Kind != TokenKind.Text)
                {
                    index++;
                    continue;
                }

                var key = token.Value;
                index++;
                if (index >= tokens.Count) break;
                if (tokens[index].Kind == TokenKind.Open)
                {
                    index++;
                    node.Children[key] = ParseBlock(tokens, ref index);
                }
                else if (tokens[index].Kind == TokenKind.Text)
                {
                    node.Children[key] = new Kv { Value = tokens[index].Value };
                    index++;
                }
                else
                {
                    index++;
                }
            }
            return node;
        }

        public Kv? Child(params string[] path)
        {
            Kv? node = this;
            foreach (var key in path)
            {
                if (node == null || !node.Children.TryGetValue(key, out var next)) return null;
                node = next;
            }
            return node;
        }

        public long Long(string key) =>
            Children.TryGetValue(key, out var child) && child.Value != null &&
            long.TryParse(child.Value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var value)
                ? value
                : 0;

        private enum TokenKind { Text, Open, Close }

        private readonly record struct Token(TokenKind Kind, string Value);

        private static List<Token> Tokenize(string text)
        {
            var tokens = new List<Token>();
            var cursor = 0;
            while (cursor < text.Length)
            {
                var ch = text[cursor];
                if (char.IsWhiteSpace(ch)) { cursor++; continue; }
                if (ch == '/' && cursor + 1 < text.Length && text[cursor + 1] == '/')
                {
                    while (cursor < text.Length && text[cursor] != '\n') cursor++;
                    continue;
                }
                if (ch == '{') { tokens.Add(new Token(TokenKind.Open, "{")); cursor++; continue; }
                if (ch == '}') { tokens.Add(new Token(TokenKind.Close, "}")); cursor++; continue; }
                if (ch == '"')
                {
                    cursor++;
                    var builder = new StringBuilder();
                    while (cursor < text.Length)
                    {
                        var current = text[cursor];
                        if (current == '\\' && cursor + 1 < text.Length)
                        {
                            var next = text[cursor + 1];
                            builder.Append(next switch
                            {
                                'n' => '\n',
                                't' => '\t',
                                'r' => '\r',
                                _ => next
                            });
                            cursor += 2;
                            continue;
                        }
                        if (current == '"') { cursor++; break; }
                        builder.Append(current);
                        cursor++;
                    }
                    tokens.Add(new Token(TokenKind.Text, builder.ToString()));
                    continue;
                }

                var start = cursor;
                while (cursor < text.Length && !char.IsWhiteSpace(text[cursor]) &&
                       text[cursor] != '{' && text[cursor] != '}')
                    cursor++;
                tokens.Add(new Token(TokenKind.Text, text[start..cursor]));
            }
            return tokens;
        }
    }
}
