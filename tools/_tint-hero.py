# -*- coding: utf-8 -*-
"""Give riso / broadcast card tint the same CSS filter chain their home hero uses."""

import io

CRLF = b"\r\n"


def rb(p):
    return open(p, "rb").read()


def wb(p, b):
    open(p, "wb").write(b)


def lines(*rows):
    return CRLF.join(r.encode("utf-8") for r in rows)


# ---------- 1. shared layer: filter comes from a theme variable ----------
p = "src/share-cards.css"
s = rb(p)
old = lines(
    "/* Stylised cover: one document-wide duotone filter whose table values are",
    "   rewritten from the active theme's --sc-tint-* pair, so every theme gets its",
    "   own ink without shipping fourteen filters. Off unless the player opts in. */",
    '.share-card[data-tint="1"] .sc-art img { filter: url(#scDuotone); }',
)
new = lines(
    "/* Stylised cover. Default is one document-wide duotone filter whose table",
    "   values are rewritten from the active theme's --sc-tint-* pair, so every",
    "   theme gets its own ink without shipping fourteen filters. A theme whose",
    "   home hero already has a signature treatment names it in --sc-tint-filter",
    "   instead (a CSS filter chain), and the card reuses that exact recipe;",
    "   --sc-tint-opacity lets it lay the picture on the paper the way the hero",
    "   does. Off unless the player opts in. */",
    '.share-card[data-tint="1"] .sc-art img {',
    "  filter: var(--sc-tint-filter, url(#scDuotone));",
    "  opacity: var(--sc-tint-opacity, 1);",
    "}",
)
assert s.count(old) == 1, ("share-cards", s.count(old))
wb(p, s.replace(old, new))

# ---------- 2. riso: same chain as its hero ----------
p = "themes/riso/interfaces.css"
s = rb(p)
old = lines(
    "html[data-theme=\"riso\"] {",
    "  --sc-tint-shadow: #0b2f63;",
    "  --sc-tint-high: #c2ddff;",
    "}",
)
new = lines(
    "html[data-theme=\"riso\"] {",
    "  --sc-tint-shadow: #0b2f63;",
    "  --sc-tint-high: #c2ddff;",
    "  /* 与首页 hero 同一条链：灰阶 → 棕褐 → 色相转 188° → 提饱和 = 孔版蓝墨。",
    "     端点只留作 duotone 兜底；纸上的网点层仍是 multiply 的蓝点，一起读作套印。 */",
    "  --sc-tint-filter: grayscale(1) sepia(1) hue-rotate(188deg) saturate(2.2) contrast(1.04) brightness(.96);",
    "}",
)
assert s.count(old) == 1, ("riso", s.count(old))
wb(p, s.replace(old, new))

# ---------- 3. broadcast: high-key greyscale lying on paper, like its hero ----------
p = "themes/broadcast/interfaces.css"
s = rb(p)
old = lines(
    "html[data-theme=\"broadcast\"] {",
    "  --sc-tint-shadow: #141414;",
    "  --sc-tint-high: #e9e9e6;",
    "}",
)
new = lines(
    "html[data-theme=\"broadcast\"] {",
    "  --sc-tint-shadow: #141414;",
    "  --sc-tint-high: #e9e9e6;",
    "  /* 与首页 hero 同款：压成高亮灰阶（grayscale + 低对比 + 提亮），再用 62%",
    "     不透明压在纸面上——hero 里那层纸色雾在这儿由卡片自己的纸替代，",
    "     所以画面读作「播出中的一帧」，不是一张染色的照片。 */",
    "  --sc-tint-filter: grayscale(1) contrast(.92) brightness(1.5);",
    "  --sc-tint-opacity: .62;",
    "}",
)
assert s.count(old) == 1, ("broadcast", s.count(old))
wb(p, s.replace(old, new))

# ---------- 4. versions ----------
for path, frm, to in [
    ("themes/riso/theme.json", "1.4.16", "1.4.17"),
    ("themes/broadcast/theme.json", "1.4.18", "1.4.19"),
]:
    s = rb(path)
    a = ('"version": "%s"' % frm).encode()
    b = ('"version": "%s"' % to).encode()
    assert s.count(a) == 1, (path, s.count(a))
    wb(path, s.replace(a, b))
    print(path, frm, "->", to)

print("ok")
