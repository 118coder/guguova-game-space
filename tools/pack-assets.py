#!/usr/bin/env python3
"""Zip src/ + themes/ for embedding into the single-file legacy exe.

The archive has to be byte-reproducible. The host keys both the extraction
folder (runtime/<version>-<stamp>) and the renderer-cache reset on a SHA-256
of this zip, so an archive that changes when nothing changed costs the player
a full re-extract (370 files) plus a wiped HTTP/Code cache on the next start.
`archive.write()` stamps each entry with the file's mtime, which made every
rebuild look like new content; entries are written by hand with a fixed
timestamp instead, in sorted order, so identical input gives an identical zip.
"""
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "legacy" / "embedded" / "assets.zip"

# 1980-01-01 00:00 is the earliest timestamp a zip entry can carry; a constant
# is what makes the bytes stable across machines and rebuilds.
FIXED_DATE = (1980, 1, 1, 0, 0, 0)


def entries():
    for folder in ("src", "themes"):
        base = ROOT / folder
        for item in sorted(base.rglob("*")):
            if item.is_file() and item.suffix.lower() not in {".pdb", ".tmp"}:
                # src/app/ holds the un-assembled parts of app.js; only the
                # assembled src/app.js ships (built by tools/build-app.js).
                if folder == "src" and item.relative_to(base).parts[0] == "app":
                    continue
                yield f"{folder}/{item.relative_to(base).as_posix()}", item


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    temp = OUT.with_suffix(".tmp")
    with zipfile.ZipFile(temp, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, item in entries():
            info = zipfile.ZipInfo(name, date_time=FIXED_DATE)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, item.read_bytes(), compresslevel=9)
    temp.replace(OUT)
    print(f"packed assets: {OUT} ({OUT.stat().st_size / 1024 / 1024:.2f} MB)")


if __name__ == "__main__":
    main()
