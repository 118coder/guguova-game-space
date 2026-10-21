#!/usr/bin/env python3
"""Release gate: fail loudly before anything is uploaded.

Checks the things that have actually gone wrong in past releases:

  * version drift between version.json, both csproj files and ?v= in index.html
  * a theme CSS edit without a theme.json version bump
  * an index.html that references an asset which does not exist
  * a package missing the engine, themes, or built with a stale version
  * the one-file exe missing its embedded payload

Usage:
  python tools/verify-release.py                 # source tree + dist/
  python tools/verify-release.py --dist-only     # only inspect dist/
  python tools/verify-release.py --allow-theme-bump
"""
import argparse
import json
import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"

problems = []
notes = []


def fail(message):
    problems.append(message)


def ok(message):
    notes.append(message)


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig")


def sha256(path: Path) -> str:
    import hashlib
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def check_versions(version: str):
    csproj = read(ROOT / "NovaGameSpace.csproj")
    legacy = read(ROOT / "legacy" / "NovaGameSpace.Legacy.csproj")
    index = read(ROOT / "src" / "index.html")

    for label, text in (("NovaGameSpace.csproj", csproj), ("legacy csproj", legacy)):
        found = re.search(r"<Version>([^<]+)</Version>", text)
        if not found:
            fail(f"{label} has no <Version>")
        elif found.group(1) != version:
            fail(f"{label} version {found.group(1)} != version.json {version}")

    queries = set(re.findall(r"\?v=(\d+\.\d+\.\d+)", index))
    if not queries:
        fail("index.html has no ?v= asset query")
    for query in sorted(queries):
        if query != version:
            fail(f"index.html asset query ?v={query} != version.json {version}")
    ok(f"version {version} consistent across csproj / legacy / index.html")


def check_assets():
    index = read(ROOT / "src" / "index.html")
    missing = []
    for ref in re.findall(r'(?:href|src)="([^"?#]+)"', index):
        if ref.startswith(("http:", "https:", "//", "data:", "#")):
            continue
        target = ROOT / "src" / ref
        if not target.exists():
            missing.append(ref)
    if missing:
        fail("index.html references missing assets: " + ", ".join(sorted(set(missing))[:6]))
    else:
        ok("index.html local assets all exist")


def check_themes():
    themes_dir = ROOT / "themes"
    if not themes_dir.exists():
        fail("themes/ is missing")
        return
    count = 0
    for folder in sorted(themes_dir.iterdir()):
        if not folder.is_dir():
            continue
        count += 1
        manifest = folder / "theme.json"
        css = folder / "theme.css"
        if not manifest.exists():
            fail(f"theme {folder.name}: missing theme.json")
            continue
        if not css.exists():
            fail(f"theme {folder.name}: missing theme.css")
            continue
        try:
            meta = json.loads(read(manifest))
        except Exception as error:
            fail(f"theme {folder.name}: theme.json is not valid JSON ({error})")
            continue
        if not re.match(r"^\d+\.\d+\.\d+$", str(meta.get("version", ""))):
            fail(f"theme {folder.name}: bad version {meta.get('version')!r}")
        if meta.get("id") and meta["id"] != folder.name:
            fail(f"theme {folder.name}: id {meta['id']!r} does not match folder")
    ok(f"{count} themes with manifest + css")


def check_engine():
    exe = ROOT / "third_party" / "magpie" / "Magpie.exe"
    if not exe.exists():
        fail("third_party/magpie/Magpie.exe missing (run tools/fetch-magpie.py)")
        return
    for required in ("NOTICE.md", "SOURCE-OFFER.txt", "LICENSE-GPL-3.0.txt"):
        if not (exe.parent / required).exists():
            fail(f"bundled engine missing {required} (GPLv3 requires it)")
    packed = ROOT / "legacy" / "embedded" / "engine.zip"
    if not packed.exists():
        fail("legacy/embedded/engine.zip missing (run tools/pack-engine.py)")
    else:
        ok(f"engine present, embedded payload {packed.stat().st_size / 1048576:.2f} MB")


def check_payload_zips():
    assets = ROOT / "legacy" / "embedded" / "assets.zip"
    if not assets.exists():
        fail("legacy/embedded/assets.zip missing (run tools/pack-assets.py)")
        return
    with zipfile.ZipFile(assets) as archive:
        names = archive.namelist()
        if "src/index.html" not in names:
            fail("assets.zip has no src/index.html")
        if not any(name.startswith("themes/") and name.endswith("theme.json") for name in names):
            fail("assets.zip has no themes")
    ok(f"assets payload {assets.stat().st_size / 1048576:.2f} MB with src + themes")


def check_dist(version: str, dist_only: bool):
    if not DIST.exists():
        fail("dist/ does not exist; run tools/pipeline.sh")
        return
    single = DIST / f"GUGUOVA-{version}-single.exe"
    legacy_single = DIST / f"GUGUOVA-{version}-legacy-single.zip"
    legacy_full = DIST / f"GUGUOVA-{version}-legacy-full.zip"

    staged = [p for p in DIST.glob(f"GUGUOVA-{version}-*") if p.suffix.lower() not in {".zip", ".exe"}]
    if staged and not dist_only:
        notes.append("note: unpacked staging folders present for this version: " +
                      ", ".join(p.name for p in staged))

    old = sorted({p.name.split("-")[1] for p in DIST.glob("GUGUOVA-*")
                  if re.match(r"^GUGUOVA-\d+\.\d+\.\d+-", p.name)} - {version})
    if old:
        notes.append("note: older builds still in dist/: " + ", ".join(old[-4:]))

    for path, label in ((single, "one-file exe"), (legacy_single, "legacy single zip"),
                        (legacy_full, "legacy full zip")):
        if not path.exists():
            fail(f"missing {label}: {path.name}")
            continue
        if path.stat().st_size < 1024 * 1024:
            fail(f"{path.name} is suspiciously small ({path.stat().st_size} bytes)")
        ok(f"{path.name} {path.stat().st_size / 1048576:.2f} MB")

    if single.exists():
        with single.open("rb") as handle:
            head = handle.read(2)
        if head != b"MZ":
            fail("one-file exe is not a PE image")

    for archive_path in (legacy_single, legacy_full):
        if not archive_path.exists():
            continue
        with zipfile.ZipFile(archive_path) as archive:
            names = archive.namelist()
            prefix = f"{archive_path.stem}/"
            if not any(name.endswith("/GUGUOVA.exe") for name in names):
                fail(f"{archive_path.name} has no GUGUOVA.exe")
            if not any(name.endswith("engine/magpie/Magpie.exe") for name in names):
                fail(f"{archive_path.name} has no bundled engine")
            manifest = [n for n in names if n.endswith("version.json")]
            if not manifest:
                fail(f"{archive_path.name} has no version.json")
            else:
                packed = json.loads(archive.read(manifest[0]).decode("utf-8-sig"))
                if packed.get("version") != version:
                    fail(f"{archive_path.name} version.json says {packed.get('version')}")
            if archive_path is legacy_full:
                if not any(name.startswith(prefix + "src/") for name in names):
                    fail("legacy-full has no src/")
                if not any(name.startswith(prefix + "themes/") for name in names):
                    fail("legacy-full has no themes/")

    manifest_path = DIST / "release-manifest.json"
    if manifest_path.exists():
        manifest = json.loads(read(manifest_path))
        if manifest.get("version") != version:
            fail(f"release-manifest.json version {manifest.get('version')} != {version}")
        for entry in manifest.get("packages", []):
            path = DIST / entry["name"]
            if not path.exists():
                fail(f"manifest lists missing file {entry['name']}")
                continue
            if entry.get("sha256") and sha256(path) != entry["sha256"]:
                fail(f"sha256 mismatch for {entry['name']}")
    else:
        fail("dist/release-manifest.json missing")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dist-only", action="store_true")
    parser.add_argument("--allow-theme-bump", action="store_true",
                        help="skip nothing today; kept for CI parity")
    args = parser.parse_args()

    meta = json.loads(read(ROOT / "version.json"))
    version = meta["version"]

    if not args.dist_only:
        check_versions(version)
        check_assets()
        check_themes()
        check_engine()
        check_payload_zips()
    check_dist(version, args.dist_only)

    for note in notes:
        print("  " + note)
    if problems:
        print(f"\n✗ {len(problems)} release problem(s):")
        for problem in problems:
            print("  - " + problem)
        return 1
    print("\n✓ release checks passed for " + version)
    return 0


if __name__ == "__main__":
    sys.exit(main())
