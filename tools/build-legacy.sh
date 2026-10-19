#!/usr/bin/env bash
# Build the .NET Framework 4.8 legacy host (Win7/8.1 + WebView2 109).
# The legacy folder pins .NET SDK 7 via global.json; building from the repo
# root with SDK 10 would use the wrong WPF markup compiler.
set -euo pipefail
cd "$(dirname "$0")/../legacy"
CONFIG="${1:-Release}"
dotnet build -c "$CONFIG"
