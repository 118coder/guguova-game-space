#!/usr/bin/env python3
"""Zip the bundled Magpie engine for embedding into the single-exe host.

Magpie is GPLv3 and must stay a separate program: the launcher never links to
it. Embedding it as a zip keeps the release to one file; the host extracts it
under the user data folder on first run, so the engine still lives on disk as
its own process.

Writes legacy/embedded/engine.zip (embedded as NOVA.Engine.zip).
"""
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "third_party" / "magpie"
OUT = ROOT / "legacy" / "embedded" / "engine.zip"


def main():
    exe = SOURCE / "Magpie.exe"
    if not exe.exists():
        raise SystemExit(
            "third_party/magpie/Magpie.exe is missing; run "
            "python tools/fetch-magpie.py --lite first")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    temp = OUT.with_suffix(".tmp")
    with zipfile.ZipFile(temp, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for item in SOURCE.rglob("*"):
            if item.is_file():
                archive.write(item, item.relative_to(SOURCE))
    shutil.move(str(temp), str(OUT))
    print(f"packed engine: {OUT} ({OUT.stat().st_size / 1024 / 1024:.2f} MB)")


if __name__ == "__main__":
    main()
