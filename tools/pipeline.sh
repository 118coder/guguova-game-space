#!/usr/bin/env bash
# Release pipeline: version -> audits -> modern/legacy builds -> package.
#
#   bash tools/pipeline.sh                 # audits + legacy package
#   bash tools/pipeline.sh --modern        # also build the large self-contained modern package
#   bash tools/pipeline.sh --skip-audit    # fast packaging (no screenshot run)
#   bash tools/pipeline.sh --version 1.5.1 # bump + build + package
#   bash tools/pipeline.sh --no-zip        # leave unpacked staging folders in dist/
set -euo pipefail
cd "$(dirname "$0")/.."

CONFIG="Release"
MODERN=0
SKIP_AUDIT=0
NO_ZIP=0
VERSION=""

while [ $# -gt 0 ]; do
  case "$1" in
    --modern) MODERN=1 ;;
    --skip-audit) SKIP_AUDIT=1 ;;
    --no-zip) NO_ZIP=1 ;;
    --config) shift; CONFIG="${1:-Release}" ;;
    --version) shift; VERSION="${1:-}" ;;
    *) echo "unknown option: $1"; exit 1 ;;
  esac
  shift
done

if [ -n "$VERSION" ]; then
  node tools/bump-version.js "$VERSION"
fi
VERSION="$(python -c "import json; print(json.load(open('version.json', encoding='utf-8'))['version'])")"
echo "== NOVA release $VERSION ($CONFIG) =="

if [ "$SKIP_AUDIT" -eq 0 ]; then
  echo "-- audit: build + launch + screenshots"
  bash tools/relaunch.sh >/dev/null
  node tools/export-all.js --views=all --sizes=1439x1124,960x600 --stress --out=../_shots/release-audit
  node tools/probe-graphics.js
else
  echo "-- audit skipped"
fi

if [ ! -f third_party/magpie/Magpie.exe ]; then
  echo "-- bundled engine missing; fetching Magpie (GPLv3)"
  # The default bundled engine is the lite effect set. Set MAGPIE_FULL=1 when
  # you intentionally want the 26 MB full-effects engine in the package.
  MAGPIE_ARGS="--lite"
  if [ "${MAGPIE_FULL:-0}" = "1" ]; then MAGPIE_ARGS=""; fi
  python tools/fetch-magpie.py $MAGPIE_ARGS || echo "warning: building without the bundled engine"
fi

echo "-- build legacy (net48)"
bash tools/build-legacy.sh "$CONFIG"

MODERN_DIR=""
if [ "$MODERN" -eq 1 ]; then
  echo "-- publish modern (self-contained)"
  rm -rf dist/.modern-publish
  dotnet publish -c Release -r win-x64 --self-contained true \
    -p:PublishSingleFile=true -p:EnableCompressionInSingleFile=true \
    -p:IncludeNativeLibrariesForSelfExtract=true \
    -o dist/.modern-publish
  MODERN_DIR="dist/.modern-publish"
fi

echo "-- package"
ARGS=(--config "$CONFIG")
if [ -n "$MODERN_DIR" ]; then ARGS+=(--modern-dir "$MODERN_DIR"); fi
if [ "$NO_ZIP" -eq 1 ]; then ARGS+=(--no-zip); fi
python tools/package-release.py "${ARGS[@]}"

echo "-- done: dist/"
ls -lh dist | sed -n '1,12p'
