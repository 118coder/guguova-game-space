#!/usr/bin/env bash
# Build the .NET Framework 4.8 legacy host (Win7/8.1 + WebView2 109).
# The legacy folder pins .NET SDK 7 via global.json; building from the repo
# root with SDK 10 would use the wrong WPF markup compiler.
#
# Both payload zips are regenerated here so a single-exe build can never ship
# stale web assets or a stale engine.
set -euo pipefail
cd "$(dirname "$0")/.."
python tools/pack-assets.py
if [ -f third_party/magpie/Magpie.exe ]; then
  python tools/pack-engine.py
fi
cd legacy
CONFIG="${1:-Release}"
dotnet build -c "$CONFIG"
