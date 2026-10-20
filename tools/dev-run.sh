#!/usr/bin/env bash
# Dev loop helper: rebuild, sync themes, then run the launcher in the FOREGROUND
# with the CDP port open. Foreground is deliberate: a backgrounded child of a
# short-lived shell gets reclaimed, which makes the app vanish mid-session.
#
#   ./tools/dev-run.sh
#
# Renderer cache is redirected off the system disk (NOVA_CACHE_ROOT).
set -u
cd "$(dirname "$0")/.."

PORT="${NOVA_CDP_PORT:-9223}"
EXE="bin/Debug/net10.0-windows/win-x64/GUGUOVA.exe"
USER_THEMES="$LOCALAPPDATA/NOVA Game Space/themes"

taskkill //IM GUGUOVA.exe //F >/dev/null 2>&1
sleep 1

dotnet build -c Debug 2>&1 | tail -4

if [ "${1:-}" != "--no-sync" ] && [ -d "$USER_THEMES" ]; then
  for dir in themes/*/; do
    name="$(basename "$dir")"
    mkdir -p "$USER_THEMES/$name"
    cp -r "$dir." "$USER_THEMES/$name/"
  done
  echo "themes synced -> $USER_THEMES"
fi

export NOVA_CACHE_ROOT="${NOVA_CACHE_ROOT:-$(pwd)/.cache/webview2}"
mkdir -p "$NOVA_CACHE_ROOT"
export NOVA_CDP_PORT="$PORT"
# See MainWindow.CacheRoot / NOVA_WEBVIEW_ARGS: software rendering keeps a
# wedged GPU process from taking the whole WebView down during dev.
export NOVA_WEBVIEW_ARGS="${NOVA_WEBVIEW_ARGS:---disable-gpu --no-sandbox --disable-dev-shm-usage}"

echo "launcher starting on CDP :$PORT (cache: $NOVA_CACHE_ROOT)"
exec "$EXE"
