#!/usr/bin/env bash
# GUGUOVA release pipeline.
#
# One command, stage by stage, with a gate before anything is published:
#
#   version → engine → build → package → verify → smoke → publish
#
#   bash tools/release.sh                       # build + verify + smoke (no publish)
#   bash tools/release.sh --version 1.15.0      # bump, then run every stage
#   bash tools/release.sh --audit               # also run the UI audits (slow)
#   bash tools/release.sh --publish             # also push a GitHub Release
#   bash tools/release.sh --publish --tag-only  # reuse an existing tag
#   bash tools/release.sh --skip-smoke          # packaging-only run (CI fast path)
#
# Environment:
#   MAGPIE_FULL=1   bundle the full Magpie effect set instead of --lite
#   NOVA_CDP_PORT   port for the optional UI audits (default 9223)
#
# Every stage appends to _shots/release/<version>/pipeline.log and stops the
# run on the first failure, so a broken build can never reach a release.
set -uo pipefail
cd "$(dirname "$0")/.."

CONFIG="Release"
VERSION=""
DO_AUDIT=0
DO_PUBLISH=0
DO_SMOKE=1
TAG_ONLY=0

while [ $# -gt 0 ]; do
  case "$1" in
    --version) shift; VERSION="${1:-}" ;;
    --audit) DO_AUDIT=1 ;;
    --publish) DO_PUBLISH=1 ;;
    --tag-only) TAG_ONLY=1 ;;
    --skip-smoke) DO_SMOKE=0 ;;
    --config) shift; CONFIG="${1:-Release}" ;;
    -h|--help) sed -n '2,22p' "$0"; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

STAGE=""
fail() {
  echo ""
  echo "✗ FAILED at stage: ${STAGE}" >&2
  echo "  log: ${LOG}" >&2
  exit 1
}

run() {
  # run <label> <command...>
  local label="$1"; shift
  STAGE="$label"
  echo ""
  echo "== ${label} =="
  echo "-- ${label}: $*" >>"$LOG"
  "$@" >>"$LOG" 2>&1
  local code=$?
  if [ $code -ne 0 ]; then
    echo "  (see log for output)"
    tail -n 25 "$LOG" | sed 's/^/  | /'
    fail
  fi
  echo "  ok"
}

# ---------------------------------------------------------------- 0. version
STAGE="version"
if [ -n "$VERSION" ]; then
  node tools/bump-version.js "$VERSION" >/dev/null || fail
fi
VERSION="$(python -c "import json;print(json.load(open('version.json',encoding='utf-8'))['version'])")"
LOG_DIR="../_shots/release/$VERSION"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/pipeline.log"
: >"$LOG"
echo "== GUGUOVA release $VERSION ($CONFIG) =="
echo "== stage 1/7 version: $VERSION =="

# ---------------------------------------------------------------- 1. engine
if [ ! -f third_party/magpie/Magpie.exe ]; then
  STAGE="engine fetch"
  echo ""
  echo "== 2/7 engine: bundled copy missing, fetching (GPLv3) =="
  MAGPIE_ARGS="--lite"
  if [ "${MAGPIE_FULL:-0}" = "1" ]; then MAGPIE_ARGS=""; fi
  python tools/fetch-magpie.py $MAGPIE_ARGS >>"$LOG" 2>&1 || echo "  warning: continuing without a bundled engine"
  echo "  done"
else
  echo ""
  echo "== 2/7 engine: third_party/magpie present =="
fi

# ---------------------------------------------------------------- 2. audit (optional)
if [ "$DO_AUDIT" -eq 1 ]; then
  run "audit: static contrast" node tools/audit-contrast.js
  run "audit: hover/focus contrast" node tools/audit-hover.js
  run "audit: layout screenshots" node tools/export-all.js \
      --views=all --sizes=1439x1124,960x600 --stress \
      --out="../_shots/release/$VERSION/layout"
else
  echo ""
  echo "== 3/7 audit: skipped (pass --audit to run UI audits) =="
fi

# ---------------------------------------------------------------- 3. build
run "build: legacy net48 (assets + engine + exe)" bash tools/build-legacy.sh "$CONFIG"

# ---------------------------------------------------------------- 4. package
STAGE="package"
echo ""
echo "== 4/7 package =="
python tools/package-release.py --config "$CONFIG" >>"$LOG" 2>&1 || fail
python - <<'PY' || fail
import json, pathlib
m = json.loads(pathlib.Path('dist/release-manifest.json').read_text(encoding='utf-8'))
for p in m['packages']:
    print(f"  {p['name']:44s} {p['size']/1048576:6.2f} MB  {p['sha256'][:12]}")
PY

# ---------------------------------------------------------------- 5. verify
run "verify: release gate" python tools/verify-release.py

# ---------------------------------------------------------------- 6. smoke
if [ "$DO_SMOKE" -eq 1 ]; then
  run "smoke: single exe in an empty folder" python tools/smoke-single.py
else
  echo ""
  echo "== 6/7 smoke: skipped =="
fi

# ---------------------------------------------------------------- 7. publish
if [ "$DO_PUBLISH" -eq 1 ]; then
  STAGE="publish"
  echo ""
  echo "== 7/7 publish =="
  PUB_ARGS=(--version "$VERSION")
  if [ "$TAG_ONLY" -eq 1 ]; then PUB_ARGS+=(--tag-only); fi
  python tools/publish-release.py "${PUB_ARGS[@]}" | sed 's/^/  /' || fail
else
  echo ""
  echo "== 7/7 publish: skipped (pass --publish to upload a GitHub Release) =="
fi

echo ""
echo "✓ release $VERSION ready"
echo "  artifacts: dist/"
echo "  log:       $LOG"
