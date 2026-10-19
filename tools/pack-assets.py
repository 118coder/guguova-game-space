#!/usr/bin/env python3
"""Zip src/ + themes/ for embedding into the single-file legacy exe."""
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "legacy" / "embedded" / "assets.zip"


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    temp = OUT.with_suffix(".tmp")
    with zipfile.ZipFile(temp, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for folder in ("src", "themes"):
            base = ROOT / folder
            for item in base.rglob("*"):
                if item.is_file() and item.suffix.lower() not in {".pdb", ".tmp"}:
                    archive.write(item, Path(folder) / item.relative_to(base))
    shutil.move(str(temp), str(OUT))
    print(f"packed assets: {OUT} ({OUT.stat().st_size / 1024 / 1024:.2f} MB)")


if __name__ == "__main__":
    main()
