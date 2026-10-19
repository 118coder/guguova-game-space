#!/usr/bin/env bash
# Dev loop helper: stop the launcher, rebuild, sync repo themes into the user
# theme folder, and start it again with the CDP port open.
#
#   ./tools/relaunch.sh            # rebuild + restart
#   ./tools/relaunch.sh --no-sync  # skip the theme sync
#
# Theme CSS is fetched with cache:no-store, but theme.json (features, tokens,
# version) is read at scan time, so a theme.json edit needs this restart —
# and the user folder copy needs the sync, which is why it is here.
set -u
cd "$(dirname "$0")/.."

PORT="${NOVA_CDP_PORT:-9223}"
EXE="bin/Debug/net10.0-windows/win-x64/NovaGameSpace.exe"
USER_THEMES="$LOCALAPPDATA/NOVA Game Space/themes"

taskkill //IM NovaGameSpace.exe //F >/dev/null 2>&1
sleep 1

if ! dotnet build -c Debug 2>&1 | tail -4; then
  echo "build failed"; exit 1
fi

if [ "${1:-}" != "--no-sync" ] && [ -d "$USER_THEMES" ]; then
  for dir in themes/*/; do
    name="$(basename "$dir")"
    mkdir -p "$USER_THEMES/$name"
    cp -r "$dir." "$USER_THEMES/$name/"
  done
  echo "themes synced → $USER_THEMES"
fi

# Renderer cache is throw-away data; keep it on the repo drive during
# development so the system disk stays clean (see MainWindow.CacheRoot).
export NOVA_CACHE_ROOT="${NOVA_CACHE_ROOT:-$(pwd)/.cache/webview2}"
mkdir -p "$NOVA_CACHE_ROOT"

NOVA_CDP_PORT="$PORT" "$EXE" >/dev/null 2>&1 &
for _ in $(seq 1 40); do
  sleep 0.5
  if curl -s "http://127.0.0.1:$PORT/json/list" >/dev/null 2>&1; then
    echo "launcher up on CDP :$PORT"
    exit 0
  fi
done
echo "launcher did not expose CDP on :$PORT"
exit 1
