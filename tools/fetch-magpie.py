#!/usr/bin/env python3
"""Fetch the pinned Magpie release that ships inside the launcher.

Magpie is GPLv3 and is distributed as a separate executable (see
third_party/magpie/NOTICE.md). The binaries are intentionally kept out of git;
run this once on a build machine before `tools/pipeline.sh`.

    python tools/fetch-magpie.py

If github.com is blocked on your network, download the same asset manually
(Magpie-v0.12.1-x64.zip) and extract the files listed in KEEP into
third_party/magpie/.
"""
from __future__ import annotations

import argparse
import sys
import tempfile
import urllib.request
import zipfile
from pathlib import Path

VERSION = "v0.12.1"
ASSET = f"Magpie-{VERSION[1:]}-x64.zip"
URL = f"https://github.com/Blinue/Magpie/releases/download/{VERSION}/{ASSET}"

ROOT = Path(__file__).resolve().parent.parent
TARGET = ROOT / "third_party" / "magpie"

KEEP = {
    "Magpie.exe",
    "Microsoft.UI.Xaml.dll",
    "resources.pri",
    "TouchHelper.exe",
    "Updater.exe",
}

# The lite bundle keeps the everyday algorithms and drops the neural/CRT
# families (~12 MB of HLSL). The engine sheet greys out modes whose effects
# are missing, so a curated config stays usable.
LITE_EFFECTS = {
    "Lanczos", "Nearest", "Bilinear", "Bicubic", "Jinc",
    "Deband", "ImageAdjustment", "FSR", "FSRCNNX", "CAS", "Sharpen",
}


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch the bundled Magpie engine.")
    parser.add_argument("--lite", action="store_true", help="drop the heavy neural/CRT effects")
    args = parser.parse_args()

    TARGET.mkdir(parents=True, exist_ok=True)
    if (TARGET / "Magpie.exe").exists():
        print(f"already present: {TARGET / 'Magpie.exe'}")
        return 0

    print(f"downloading {URL}")
    with tempfile.TemporaryDirectory() as temp:
        archive = Path(temp) / ASSET
        try:
            urllib.request.urlretrieve(URL, archive)
        except Exception as error:  # noqa: BLE001 - report the manual fallback
            print(f"download failed: {error}", file=sys.stderr)
            print("download Magpie-v0.12.1-x64.zip manually and extract Magpie.exe, "
                  "Microsoft.UI.Xaml.dll, resources.pri, TouchHelper.exe, Updater.exe "
                  "and effects/ into third_party/magpie/", file=sys.stderr)
            return 1

        with zipfile.ZipFile(archive) as bundle:
            for item in bundle.infolist():
                name = item.filename.replace("\\", "/")
                if item.is_dir():
                    continue
                base = name.rsplit("/", 1)[-1]
                if base not in KEEP and not name.startswith(("effects/", f"Magpie-{VERSION[1:]}-x64/effects/")):
                    continue
                # The official zip may wrap everything in one folder.
                relative = name.split("effects/", 1)[1] if "effects/" in name else base
                if "effects/" in name:
                    if args.lite:
                        first = relative.split("/", 1)[0]
                        key = first if "/" in relative else Path(relative).stem
                        if key not in LITE_EFFECTS:
                            continue
                    destination = TARGET / "effects" / relative
                else:
                    destination = TARGET / base
                destination.parent.mkdir(parents=True, exist_ok=True)
                with bundle.open(item) as source, destination.open("wb") as target:
                    target.write(source.read())

    missing = [name for name in ("Magpie.exe", "Microsoft.UI.Xaml.dll", "resources.pri") if not (TARGET / name).exists()]
    if missing:
        print(f"incomplete bundle, missing: {', '.join(missing)}", file=sys.stderr)
        return 1
    print(f"ready: {TARGET}{' (lite effects)' if args.lite else ''}")
    print("GPLv3: keep NOTICE.md, SOURCE-OFFER.txt and LICENSE-GPL-3.0.txt with the binaries.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
