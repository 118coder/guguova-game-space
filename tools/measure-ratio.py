#!/usr/bin/env python3
"""
NOVA · theme colour-ratio meter (dev-only, not shipped)

Compare a reference image against a running app screenshot so a theme can be
matched by *area*, not by eyeballing hex values.

Usage
-----
    python tools/measure-ratio.py 新主题参考/新主题3.png _shots/riso-home.jpg
    python tools/measure-ratio.py --all

The app screenshot is cropped to the themed panel (left 66%, vertical 9%-72%)
before measuring, because the right side is the game's cover art.

Classification
--------------
1. Neutral check first: chroma = (max-min)/255.
   chroma < 0.06, or a very light pixel with chroma < 0.10, is neutral.
2. Neutrals are split by lightness: white / paper / light-grey / mid-grey /
   dark-grey / black.
3. Everything else is bucketed by hue into red / orange / yellow / green /
   cyan / blue / violet / magenta.

Why chroma first: a warm parchment (#e4d8b0) looks like "yellow" to a pure
hue histogram, which inflates the yellow share and hides a real paper gap.
That mistake cost a full round of tuning; keep the order.
"""

import colorsys
import sys
from collections import Counter
from pathlib import Path

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    sys.exit("需要 Pillow：pip install pillow")

ROOT = Path(__file__).resolve().parent.parent
# 参考图放在仓库的上一级目录（E:/网页小工具/游戏启动器/新主题参考/），不随仓库提交。
SHOT_ROOT = ROOT.parent if (ROOT.parent / "_shots").exists() else ROOT
REF_ROOT = ROOT.parent if (ROOT.parent / "新主题参考").exists() else ROOT
PANEL = (0.00, 0.09, 0.66, 0.72)  # left, top, right, bottom (fractions)

# Reference images live one level above the repo (not committed). Screenshots
# come from tools/export-all.js (the headless capture entry point), which
# overwrites <out>/<theme>/home@<WxH>.jpg on every run. Do NOT point these at
# hand-named shots from an earlier round: measuring a stale PNG is how a whole
# tuning round gets spent on numbers that never move.
SHOT = "_shots/export/{theme}/home@1439x1124.jpg"
PAIRS = {
    "riot": ("新主题参考/新主题1.png", SHOT.format(theme="riot")),
    "grimoire": ("新主题参考/新主题2.png", SHOT.format(theme="grimoire")),
    "riso": ("新主题参考/新主题3.png", SHOT.format(theme="riso")),
    "summer": ("新主题参考/新主题4.png", SHOT.format(theme="summer")),
    "broadcast": ("新主题参考/新主题5.png", SHOT.format(theme="broadcast")),
}


def bucket(rgb):
    r, g, b = rgb[:3]
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    chroma = (max(rgb[:3]) - min(rgb[:3])) / 255
    # Warm paper / parchment: high lightness, low chroma, hue in the warm band.
    # Without this, #e6dcc0 counts as "yellow" and hides a real paper gap
    # (this exact mistake happened in 1.2.8 and skewed a whole tuning round).
    if l > 0.72 and chroma < 0.20 and (h * 360) < 70:
        return "paper"
    if chroma < 0.06 or (l > 0.86 and chroma < 0.10):
        if l > 0.94:
            return "white"
        if l > 0.80:
            return "paper"
        if l > 0.60:
            return "light-grey"
        if l > 0.35:
            return "mid-grey"
        if l > 0.12:
            return "dark-grey"
        return "black"
    hd = h * 360
    if hd < 18 or hd >= 342:
        return "red"
    if hd < 42:
        return "orange"
    if hd < 70:
        return "yellow"
    if hd < 155:
        return "green"
    if hd < 195:
        return "cyan"
    if hd < 250:
        return "blue"
    if hd < 305:
        return "violet"
    return "magenta"


def shares(image, panel=None, size=420):
    if panel:
        w, h = image.size
        left, top, right, bottom = panel
        image = image.crop((int(w * left), int(h * top), int(w * right), int(h * bottom)))
    image = image.convert("RGB")
    image.thumbnail((size, size))
    pixels = list(image.getdata())
    counts = Counter(bucket(p) for p in pixels)
    total = len(pixels)
    return {k: v / total * 100 for k, v in counts.items()}


def report(name, ref_path, shot_path):
    ref = REF_ROOT / ref_path
    if not ref.exists():
        alt = ROOT / ref_path
        if alt.exists():
            ref = alt
    shot = SHOT_ROOT / shot_path
    if not ref.exists() or not shot.exists():
        print(f"{name}: missing file ({ref if not ref.exists() else shot})")
        return
    ref_shares = shares(Image.open(ref))
    shot_shares = shares(Image.open(shot), panel=PANEL)
    print(f"== {name}")
    print(f"   {'bucket':12s} {'ref':>6s} {'ours':>6s} {'gap':>7s}")
    for key in sorted(set(ref_shares) | set(shot_shares), key=lambda k: -ref_shares.get(k, 0)):
        r = ref_shares.get(key, 0)
        m = shot_shares.get(key, 0)
        if r > 2 or m > 2:
            print(f"   {key:12s} {r:5.1f}% {m:5.1f}% {m - r:+6.1f}")
    print()


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if "--all" in sys.argv or not args:
        for name, (ref, shot) in PAIRS.items():
            report(name, ref, shot)
    elif len(args) == 2:
        report("custom", args[0], args[1])
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
