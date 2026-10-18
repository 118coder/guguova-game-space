"""Draw the NOVA mark and export build/icon.ico + build/icon.png.

The mark is original geometry: a brass astrolabe ring with a diamond
seal and a jade core, on an umber plate. Everything is drawn at 4x and
downsampled so the 16 px frame stays legible.
"""

from PIL import Image, ImageDraw, ImageFilter
import math
import os

S = 512
SS = 4
W = S * SS
INK = (18, 15, 10)
INK_2 = (34, 28, 19)
BRASS = (201, 168, 106)
BRASS_HI = (241, 217, 166)
BRASS_DEEP = (122, 90, 44)
PARCHMENT = (233, 220, 191)
JADE = (94, 217, 198)

img = Image.new("RGBA", (W, W), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# plate
d.rounded_rectangle([0, 0, W - 1, W - 1], radius=int(W * 0.22), fill=INK)
# inner gradient-ish plate (stacked rounded rects)
for i in range(18):
    t = i / 17
    r = int(W * 0.22) - int(4 * SS * t)
    c = (
        int(INK[0] + (INK_2[0] - INK[0]) * t),
        int(INK[1] + (INK_2[1] - INK[1]) * t),
        int(INK[2] + (INK_2[2] - INK[2]) * t),
    )
    d.rounded_rectangle(
        [int(10 * SS * t), int(10 * SS * t), W - 1 - int(10 * SS * t), W - 1 - int(10 * SS * t)],
        radius=r,
        outline=c,
        width=int(2 * SS),
    )

# outer plate hairline
d.rounded_rectangle(
    [int(18 * SS), int(18 * SS), W - 1 - int(18 * SS), W - 1 - int(18 * SS)],
    radius=int(W * 0.19),
    outline=BRASS_DEEP + (200,),
    width=int(2 * SS),
)

cx = cy = W // 2
ring = int(W * 0.315)
d.ellipse([cx - ring, cy - ring, cx + ring, cy + ring], outline=BRASS + (255,), width=int(5 * SS))
d.ellipse(
    [cx - int(ring * 0.86), cy - int(ring * 0.86), cx + int(ring * 0.86), cy + int(ring * 0.86)],
    outline=BRASS_DEEP + (220,),
    width=int(2 * SS),
)

# 24 engraved ticks between the two rings
for k in range(24):
    a = math.radians(k * 15 - 90)
    r1 = ring * 0.89
    r2 = ring * 0.99
    w = int(4 * SS) if k % 6 == 0 else int(2 * SS)
    d.line(
        [cx + math.cos(a) * r1, cy + math.sin(a) * r1, cx + math.cos(a) * r2, cy + math.sin(a) * r2],
        fill=PARCHMENT + (190 if k % 6 == 0 else 110,),
        width=w,
    )

# diamond seal
half = int(W * 0.155)
pts = [(cx, cy - half), (cx + half, cy), (cx, cy + half), (cx - half, cy)]
d.polygon(pts, fill=BRASS + (255,))
d.line(pts + [pts[0]], fill=BRASS_HI + (255,), width=int(4 * SS), joint="curve")

# inner diamond inset
half2 = int(half * 0.66)
pts2 = [(cx, cy - half2), (cx + half2, cy), (cx, cy + half2), (cx - half2, cy)]
d.line(pts2 + [pts2[0]], fill=INK + (235,), width=int(4 * SS), joint="curve")

# jade core with a soft halo
halo = Image.new("RGBA", (W, W), (0, 0, 0, 0))
hd = ImageDraw.Draw(halo)
hr = int(W * 0.105)
hd.ellipse([cx - hr, cy - hr, cx + hr, cy + hr], fill=JADE + (110,))
halo = halo.filter(ImageFilter.GaussianBlur(int(12 * SS)))
img.alpha_composite(halo)
d = ImageDraw.Draw(img)
core = int(W * 0.048)
d.ellipse([cx - core, cy - core, cx + core, cy + core], fill=JADE + (255,))
d.ellipse(
    [cx - int(core * 0.52), cy - int(core * 0.62), cx + int(core * 0.12), cy + int(core * 0.02)],
    fill=(220, 252, 245, 210),
)

# north spark
sx, sy = cx + int(ring * 0.74), cy - int(ring * 0.74)
d.ellipse([sx - 9 * SS, sy - 9 * SS, sx + 9 * SS, sy + 9 * SS], fill=BRASS_HI + (255,))

img = img.resize((S, S), Image.LANCZOS)

out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "build")
os.makedirs(out_dir, exist_ok=True)
png_path = os.path.join(out_dir, "icon.png")
ico_path = os.path.join(out_dir, "icon.ico")
img.save(png_path)
img.save(
    ico_path,
    format="ICO",
    sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
)
print("wrote", png_path, "and", ico_path)
