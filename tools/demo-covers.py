#!/usr/bin/env python3
"""Generate the six typographic demo covers used by the README screenshots.

No game art is used: every plate is built from type, rules and geometry, so the
repository can show the launcher without borrowing a real game's key art.

    python tools/demo-covers.py <outDir>

Writes <outDir>/src/<slug>.html. Render each with a headless browser at
1920x1080, then convert to JPG (see docs/DEMO-ART.md).
"""

import sys
import os
import html
from string import Template

# id, plate no, zh title lines, latin, kicker, meta line, palette
GAMES = [
    {
        "slug": "things-as-they-are",
        "no": "01",
        "lines": ["沉睡的", "法则"],
        "latin": "THINGS AS THEY ARE",
        "kicker": "A NOVEL IN SEVEN NIGHTS",
        "meta": "叙事 · 解谜　/　单人　/　12+",
        "foot": ["I　夜行", "II　回声", "III　终章"],
        "bg": "#e9ded7",
        "bg2": "#cdb8b3",
        "ink": "#2f2a2e",
        "accent": "#a4605c",
        "ghost": "rgba(47, 42, 46, .07)",
    },
    {
        "slug": "lullaby-for-you",
        "no": "02",
        "lines": ["噩梦", "摇篮"],
        "latin": "A LULLABY FOR YOU",
        "kicker": "献花于你",
        "meta": "悬疑 · 文字冒险　/　单人　/　16+",
        "foot": ["第一章　入梦", "第二章　献花", "第三章　醒来"],
        "bg": "#171226",
        "bg2": "#2c2145",
        "ink": "#efe7f7",
        "accent": "#b3a6f0",
        "ghost": "rgba(239, 231, 247, .06)",
    },
    {
        "slug": "emberwaltz",
        "no": "03",
        "lines": ["星火", "圆舞曲"],
        "latin": "EMBERWALTZ",
        "kicker": "THREE-QUARTER TIME",
        "meta": "节奏 · 冒险　/　单人　/　12+",
        "foot": ["I　点火", "II　旋转", "III　余烬"],
        "bg": "#1b120e",
        "bg2": "#3a2118",
        "ink": "#f6e2c8",
        "accent": "#e08a4e",
        "ghost": "rgba(246, 226, 200, .07)",
    },
    {
        "slug": "cobalt-hour",
        "no": "04",
        "lines": ["钴蓝", "时刻"],
        "latin": "COBALT HOUR",
        "kicker": "THE LAST MINUTE BEFORE DAWN",
        "meta": "解谜 · 推理　/　单人　/　12+",
        "foot": ["23:00　关灯", "23:40　听见", "24:00　离开"],
        "bg": "#0d1726",
        "bg2": "#1d3350",
        "ink": "#e8f0fa",
        "accent": "#7fb0e8",
        "ghost": "rgba(232, 240, 250, .07)",
    },
    {
        "slug": "sunroom",
        "no": "05",
        "lines": ["晴日", "小屋"],
        "latin": "SUNROOM",
        "kicker": "A SLOW MORNING, EVERY DAY",
        "meta": "生活模拟 · 治愈　/　单人　/　全年龄",
        "foot": ["浇水", "晒被子", "煮一壶茶"],
        "bg": "#f7eed8",
        "bg2": "#e6d3a8",
        "ink": "#3b2f1c",
        "accent": "#c08a34",
        "ghost": "rgba(59, 47, 28, .08)",
    },
    {
        "slug": "calc-quest",
        "no": "06",
        "lines": ["计算", "冒险"],
        "latin": "CALC QUEST",
        "kicker": "SOLVE THE ROOM, THEN THE TOWER",
        "meta": "解谜 · 数学　/　单人　/　全年龄",
        "foot": ["＋　加法之间", "×　乘法回廊", "÷　分数塔"],
        "bg": "#f2e8dd",
        "bg2": "#dcc7b5",
        "ink": "#31201c",
        "accent": "#a0524a",
        "ghost": "rgba(49, 32, 28, .08)",
    },
]

SHELL = """<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>{slug}</title>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  html, body {{ width: 1920px; height: 1080px; overflow: hidden; }}
  body {{ font-family: "思源黑体 CN Medium", "Source Han Sans CN Medium", "Microsoft YaHei", sans-serif; }}
  .plate {{
    position: relative; width: 1920px; height: 1080px; overflow: hidden;
    background:
      radial-gradient(120% 90% at 78% 12%, {bg2} 0%, transparent 62%),
      linear-gradient(168deg, {bg} 0%, {bg2} 100%);
    color: {ink};
  }}
  .plate::after {{
    content: ""; position: absolute; inset: 0; pointer-events: none;
    box-shadow: inset 0 0 0 1px rgba(0,0,0,.14), inset 0 0 0 26px rgba(255,255,255,.10);
  }}
  .grain {{
    position: absolute; inset: 0; opacity: .30; mix-blend-mode: multiply;
    background-image: repeating-linear-gradient(0deg, rgba(0,0,0,.045) 0 1px, transparent 1px 4px);
  }}
  .no {{
    position: absolute; top: 54px; right: 64px; font-size: 20px; letter-spacing: .38em;
    opacity: .58; font-weight: 700;
  }}
  .no::before {{ content: "PLATE "; }}
  .frame {{
    position: absolute; inset: 42px; border: 1px solid rgba(0,0,0,.22);
  }}
  .frame::before, .frame::after {{
    content: ""; position: absolute; background: {accent}; opacity: .8;
  }}
  .frame::before {{ left: -1px; top: -1px; width: 96px; height: 4px; }}
  .frame::after {{ right: -1px; bottom: -1px; width: 4px; height: 96px; }}
</style>
</head><body>
<div class="plate">
  <div class="grain"></div>
  <div class="frame"></div>
  <div class="no">{no}</div>
  {body}
</div>
</body></html>
"""

BODIES = {
    "things-as-they-are": """
  <div class="disc"></div>
  <div class="arcs"><i></i><i></i><i></i><i></i></div>
  <div class="copy">
    <div class="kicker">$kicker</div>
    <h1>$line1<em>$line2</em></h1>
    <div class="rule"></div>
    <div class="latin">$latin</div>
    <div class="meta">$meta</div>
  </div>
  <div class="foot"><span>$f0</span><span>$f1</span><span>$f2</span></div>
  <style>
    .disc { position: absolute; right: -260px; top: -320px; width: 980px; height: 980px;
      border-radius: 50%; background: $accent; opacity: .16; }
    .arcs { position: absolute; right: 110px; top: 300px; width: 480px; height: 480px; }
    .arcs i { position: absolute; inset: 0; border: 1px solid rgba(47,42,46,.28); border-radius: 50%; }
    .arcs i:nth-child(2) { inset: 52px; border-color: rgba(47,42,46,.2); }
    .arcs i:nth-child(3) { inset: 104px; border-color: rgba(164,96,92,.5); }
    .arcs i:nth-child(4) { inset: 156px; background: $accent; opacity: .12; border: 0; }
    .copy { position: absolute; left: 132px; top: 218px; width: 1080px; }
    .kicker { font-size: 24px; letter-spacing: .42em; color: $accent; font-weight: 700; }
    h1 { margin-top: 34px; font-family: "思源宋体", "Source Han Serif SC", serif;
      font-size: 208px; line-height: .96; letter-spacing: .02em; font-weight: 700; }
    h1 em { display: block; font-style: normal; margin-left: 168px; }
    .rule { width: 420px; height: 3px; margin: 44px 0 26px; background: $accent; }
    .latin { font-size: 30px; letter-spacing: .52em; font-weight: 700; }
    .meta { margin-top: 22px; font-size: 21px; letter-spacing: .16em; opacity: .62; }
    .foot { position: absolute; left: 132px; bottom: 92px; display: flex; gap: 54px;
      font-family: "思源宋体", serif; font-size: 22px; letter-spacing: .2em; opacity: .66; }
    .big { position: absolute; right: 92px; bottom: -120px; font-family: "思源宋体", serif;
      font-size: 520px; line-height: 1; color: $ghost; }
  </style>
""",
    "lullaby-for-you": """
  <div class="grid"></div>
  <div class="halo"></div>
  <div class="copy">
    <div class="kicker">$kicker</div>
    <h1><span>$line1</span><span>$line2</span></h1>
    <div class="latin">$latin</div>
    <div class="meta">$meta</div>
  </div>
  <div class="marks"><i></i><i></i><i></i><i></i><i></i><i></i></div>
  <div class="stem"><b>献给</b><b>不肯醒来的人</b></div>
  <div class="foot"><span>$f0</span><span>$f1</span><span>$f2</span></div>
  <style>
    .grid { position: absolute; inset: 0;
      background-image:
        repeating-linear-gradient(90deg, rgba(239,231,247,.06) 0 1px, transparent 1px 96px),
        repeating-linear-gradient(0deg, rgba(239,231,247,.05) 0 1px, transparent 1px 96px); }
    .halo { position: absolute; left: -180px; bottom: -240px; width: 900px; height: 900px;
      border-radius: 50%; background: radial-gradient(circle, rgba(179,166,240,.34), transparent 66%); }
    .copy { position: absolute; left: 140px; top: 240px; }
    .kicker { font-size: 26px; letter-spacing: .5em; color: $accent; font-weight: 700; }
    h1 { margin-top: 30px; font-family: "思源宋体", "Source Han Serif SC", serif; font-size: 234px;
      line-height: .92; letter-spacing: .1em; font-weight: 700; }
    h1 span { display: block; }
    h1 span:nth-child(2) { margin-left: 210px; color: transparent;
      -webkit-text-stroke: 2px rgba(239,231,247,.72); }
    .latin { margin-top: 46px; margin-left: 214px; font-size: 26px; letter-spacing: .46em; color: $accent; }
    .meta { margin-top: 26px; margin-left: 214px; font-size: 20px; letter-spacing: .18em; opacity: .56; }
    .marks i { position: absolute; width: 22px; height: 22px; }
    .marks i::before, .marks i::after { content: ""; position: absolute; background: rgba(239,231,247,.34); }
    .marks i::before { left: 10px; top: 0; width: 1px; height: 22px; }
    .marks i::after { top: 10px; left: 0; height: 1px; width: 22px; }
    .marks i:nth-child(1) { right: 180px; top: 170px; }
    .marks i:nth-child(2) { right: 420px; top: 420px; }
    .marks i:nth-child(3) { right: 240px; top: 660px; }
    .marks i:nth-child(4) { right: 620px; top: 210px; }
    .marks i:nth-child(5) { right: 760px; top: 720px; }
    .marks i:nth-child(6) { right: 96px; top: 470px; }
    .stem { position: absolute; right: 118px; top: 210px; display: flex; gap: 22px;
      writing-mode: vertical-rl; font-family: "思源宋体", serif; font-size: 26px; letter-spacing: .32em; color: $accent; }
    .stem b { font-weight: 400; }
    .stem b:last-child { opacity: .55; }
    .foot { position: absolute; left: 142px; bottom: 96px; display: flex; gap: 46px;
      font-size: 19px; letter-spacing: .22em; opacity: .5; }
  </style>
""",
    "emberwaltz": """
  <div class="ring"></div>
  <div class="ring inner"></div>
  <div class="beat"><i></i><i></i><i></i></div>
  <div class="copy">
    <div class="kicker">$kicker</div>
    <h1><span>$line1</span><span>$line2</span></h1>
    <div class="latin">$latin</div>
    <div class="meta">$meta</div>
  </div>
  <div class="big">3/4</div>
  <div class="foot"><span>$f0</span><span>$f1</span><span>$f2</span></div>
  <style>
    .ring { position: absolute; right: 140px; top: 148px; width: 720px; height: 720px;
      border: 2px solid rgba(224,138,78,.42); border-radius: 50%; }
    .ring.inner { right: 250px; top: 258px; width: 500px; height: 500px;
      border: 1px dashed rgba(246,226,200,.22); }
    .ring::before { content: ""; position: absolute; left: 50%; top: -2px; width: 2px; height: 26px;
      background: $accent; transform: translateX(-50%); }
    .beat { position: absolute; right: 388px; top: 394px; display: flex; gap: 0; }
    .beat i { width: 42px; height: 42px; border-radius: 50%; background: $accent; }
    .beat i:nth-child(2), .beat i:nth-child(3) { background: transparent; border: 2px solid rgba(246,226,200,.4); }
    .copy { position: absolute; left: 138px; top: 250px; }
    .kicker { font-size: 24px; letter-spacing: .46em; color: $accent; font-weight: 700; }
    h1 { margin-top: 44px; font-family: "思源宋体", "Source Han Serif SC", serif; font-size: 200px;
      line-height: 1; letter-spacing: .06em; font-weight: 700; }
    h1 span { display: block; }
    .latin { margin-top: 40px; font-size: 34px; letter-spacing: .62em; color: $accent; font-weight: 700; }
    .meta { margin-top: 24px; font-size: 20px; letter-spacing: .18em; opacity: .58; }
    .big { position: absolute; right: 66px; bottom: -96px; font-family: "思源宋体", serif;
      font-size: 330px; letter-spacing: .04em; color: $ghost; }
    .foot { position: absolute; left: 142px; bottom: 92px; display: flex; gap: 50px;
      font-size: 20px; letter-spacing: .24em; opacity: .56; }
  </style>
""",
    "cobalt-hour": """
  <div class="dial"></div>
  <div class="hand"></div>
  <div class="copy">
    <div class="kicker">$kicker</div>
    <h1><span>$line1</span><b>$line2</b></h1>
    <div class="latin">$latin</div>
    <div class="meta">$meta</div>
  </div>
  <div class="num">24</div>
  <div class="foot"><span>$f0</span><span>$f1</span><span>$f2</span></div>
  <style>
    .dial { position: absolute; right: 96px; top: 96px; width: 820px; height: 820px; border-radius: 50%;
      background:
        repeating-conic-gradient(from 0deg, rgba(232,240,250,.30) 0deg .35deg, transparent .35deg 7.5deg);
      -webkit-mask: radial-gradient(circle, transparent 0 348px, #000 348px 352px, transparent 352px 400px, #000 400px 404px, transparent 404px);
              mask: radial-gradient(circle, transparent 0 348px, #000 348px 352px, transparent 352px 400px, #000 400px 404px, transparent 404px);
    }
    .hand { position: absolute; right: 496px; top: 176px; width: 3px; height: 300px;
      background: linear-gradient(180deg, $accent, rgba(127,176,232,0)); transform-origin: bottom center;
      transform: rotate(28deg); }
    .copy { position: absolute; left: 140px; top: 236px; }
    .kicker { font-size: 24px; letter-spacing: .4em; color: $accent; font-weight: 700; }
    h1 { margin-top: 40px; font-family: "思源宋体", "Source Han Serif SC", serif; font-size: 196px;
      line-height: 1; font-weight: 700; letter-spacing: .04em; }
    h1 span { display: block; }
    h1 b { display: block; margin-left: 196px; font-weight: 700; color: transparent;
      -webkit-text-stroke: 2px rgba(232,240,250,.7); }
    .latin { margin-top: 44px; font-size: 30px; letter-spacing: .56em; color: $accent; font-weight: 700; }
    .meta { margin-top: 22px; font-size: 20px; letter-spacing: .18em; opacity: .56; }
    .num { position: absolute; right: 118px; bottom: 128px; font-family: "思源宋体", serif;
      font-size: 260px; line-height: 1; color: $ghost; }
    .foot { position: absolute; left: 142px; bottom: 92px; display: flex; gap: 54px;
      font-size: 20px; letter-spacing: .18em; opacity: .54; font-variant-numeric: tabular-nums; }
  </style>
""",
    "sunroom": """
  <div class="window"><i></i><i></i><i></i><i></i></div>
  <div class="sun"></div>
  <div class="copy">
    <div class="kicker">$kicker</div>
    <h1><span>$line1</span><span>$line2</span></h1>
    <div class="rule"></div>
    <div class="latin">$latin</div>
    <div class="meta">$meta</div>
  </div>
  <div class="foot"><span>$f0</span><span>$f1</span><span>$f2</span></div>
  <style>
    .window { position: absolute; right: 96px; top: 96px; width: 760px; height: 880px;
      border: 2px solid rgba(59,47,28,.5); background: rgba(255,255,255,.22); }
    .window i { position: absolute; background: rgba(59,47,28,.36); }
    .window i:nth-child(1) { left: 50%; top: 0; bottom: 0; width: 2px; }
    .window i:nth-child(2) { top: 46%; left: 0; right: 0; height: 2px; }
    .window i:nth-child(3) { left: 25%; top: 0; bottom: 0; width: 1px; opacity: .5; }
    .window i:nth-child(4) { left: 75%; top: 0; bottom: 0; width: 1px; opacity: .5; }
    .window::after { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 210px;
      background: repeating-linear-gradient(180deg, rgba(59,47,28,.22) 0 5px, transparent 5px 22px); }
    .sun { position: absolute; right: 168px; top: 168px; width: 250px; height: 250px;
      background: $accent; opacity: .9; }
    .copy { position: absolute; left: 138px; top: 250px; width: 980px; }
    .kicker { font-size: 23px; letter-spacing: .42em; color: $accent; font-weight: 700; }
    h1 { margin-top: 40px; font-family: "思源宋体", "Source Han Serif SC", serif; font-size: 214px;
      line-height: .98; font-weight: 700; letter-spacing: .04em; }
    h1 span { display: inline-block; }
    h1 span:last-child { color: transparent; -webkit-text-stroke: 2px rgba(59,47,28,.66); margin-left: 26px; }
    .rule { width: 360px; height: 6px; margin: 40px 0 26px; background: $accent; }
    .latin { font-size: 30px; letter-spacing: .6em; font-weight: 700; }
    .meta { margin-top: 22px; font-size: 20px; letter-spacing: .18em; opacity: .6; }
    .foot { position: absolute; left: 140px; bottom: 92px; display: flex; gap: 54px;
      font-family: "思源宋体", serif; font-size: 22px; letter-spacing: .22em; opacity: .62; }
  </style>
""",
    "calc-quest": """
  <div class="paper"></div>
  <div class="copy">
    <div class="kicker">$kicker</div>
    <h1><span>$line1</span><span>$line2</span></h1>
    <div class="latin">$latin</div>
    <div class="meta">$meta</div>
  </div>
  <div class="glyphs"><i>＋</i><i>－</i><i>×</i><i>÷</i><i>=</i></div>
  <div class="foot"><span>$f0</span><span>$f1</span><span>$f2</span></div>
  <style>
    .paper { position: absolute; inset: 0;
      background-image:
        repeating-linear-gradient(0deg, rgba(49,32,28,.10) 0 1px, transparent 1px 60px),
        repeating-linear-gradient(90deg, rgba(49,32,28,.10) 0 1px, transparent 1px 60px); }
    .copy { position: absolute; left: 140px; top: 244px; }
    .kicker { font-size: 23px; letter-spacing: .36em; color: $accent; font-weight: 700; }
    h1 { margin-top: 38px; font-family: "思源宋体", "Source Han Serif SC", serif; font-size: 206px;
      line-height: 1; font-weight: 700; letter-spacing: .06em; }
    h1 span { display: block; }
    h1 span:last-child { margin-left: 180px; }
    .latin { margin-top: 40px; font-size: 32px; letter-spacing: .58em; color: $accent; font-weight: 700; }
    .meta { margin-top: 22px; font-size: 20px; letter-spacing: .18em; opacity: .6; }
    .glyphs { position: absolute; right: 120px; bottom: 250px; display: flex; flex-direction: column; gap: 18px;
      font-family: "思源宋体", serif; font-size: 92px; line-height: 1; color: $accent; opacity: .5; }
    .glyphs i { font-style: normal; }
    .big { position: absolute; right: 150px; top: 40px; font-family: "思源宋体", serif;
      font-size: 300px; line-height: 1; color: $ghost; }
    .foot { position: absolute; left: 142px; bottom: 92px; display: flex; gap: 54px;
      font-size: 20px; letter-spacing: .2em; opacity: .58; }
  </style>
""",
}


def main() -> int:
    out = sys.argv[1] if len(sys.argv) > 1 else "_shots/covers"
    src = os.path.join(out, "src")
    os.makedirs(src, exist_ok=True)

    for game in GAMES:
        body = Template(BODIES[game["slug"]]).substitute(
            kicker=html.escape(game["kicker"]),
            line1=html.escape(game["lines"][0]),
            line2=html.escape(game["lines"][1]),
            latin=html.escape(game["latin"]),
            meta=html.escape(game["meta"]),
            f0=html.escape(game["foot"][0]),
            f1=html.escape(game["foot"][1]),
            f2=html.escape(game["foot"][2]),
            bg=game["bg"], bg2=game["bg2"], ink=game["ink"],
            accent=game["accent"], ghost=game["ghost"],
        )
        doc = SHELL.format(slug=game["slug"], no=game["no"], body=body,
                           bg=game["bg"], bg2=game["bg2"], ink=game["ink"],
                           accent=game["accent"])
        path = os.path.join(src, game["slug"] + ".html")
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(doc)
        print(path)

        # A hero plate for the full-bleed stage: the same geometry without
        # any type, so a 16:9 crop never turns the cover into a wall of
        # giant letters behind the launcher's own title.
        hero = doc.replace("<body>", '<body class="hero">').replace(
            "</style>",
            "body.hero .copy, body.hero .foot, body.hero .stem, body.hero .glyphs { display: none !important; }\n</style>",
        )
        hero_path = os.path.join(src, game["slug"] + "-hero.html")
        with open(hero_path, "w", encoding="utf-8") as handle:
            handle.write(hero)
        print(hero_path)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
