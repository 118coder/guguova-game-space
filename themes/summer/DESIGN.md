# SUMMER · 夏日轻程 · 设计规范与设计理念

> 一句话：**把主视觉做成一张印在杂志里的海边照片**——上半页是天空渐变，
> 下半页是白底题注，三行文字各自躺在自己的小白板上，用青色细线和酸柠胶带钉住。
>
> 参考：`新主题4/夏日轻程.png`（另见 `游戏启动器-夏日轻程.png`）。
> 参考目录只用于提炼语言，`assets/{seams,dots,arrow}.svg` 均为本项目几何绘制。

---

## 1. 设计理念（为什么长这样）

这套主题的原型不是"蓝白配色 UI"，而是**印刷品的版面**：照片占大半页，
文字是被压在照片下缘的**题注（caption）**。因此两个判断标准：

1. **天空必须是"渐变"而不是"色块"**——它是一块照片，不是一块按钮。
   所以 `.hero-inner::before` 用 8 段 `linear-gradient` 从 `#34a6dc` 走到
   `#ffffff`，再叠 `assets/dots.svg` 做网点，模拟印刷颗粒。
2. **文字必须有自己的"纸"**——参考图里每行字底下都压着一块白。
   于是 `.hero-logo` / `.tagline` / `.meta-row` 各自 `background: rgba(255,255,255,.9)`
   + `box-shadow: 4px 4px 0 rgba(34,181,166,.2)`（青色硬投影，不是发光——项目禁止柔光）。
   白板只当"题注井"，**不能铺满下半页**：铺满就不是照片了。

配色面积是这套主题的主要矛盾：参考图 white ≈ 27%，我们一度量到 **55%**——
白板把天空吃掉了。修法是**延伸天空 + 收窄白板**，不是删白板。

---

## 2. 视觉语言 → 实现映射

| 参考图里的语言 | 落地位置 | 关键值 |
|---|---|---|
| 页眉整条青绿带 | `/* top strip */` 段（整条 header 铺青） | `#22b5a6` |
| 照片天空 | `.hero-inner::before` 的 8 段渐变 + `assets/dots.svg` | `#34a6dc → #ffffff`（白从 100% 处才开始） |
| 青色细线接缝 | `.hero-inner::before { border: 3px solid #22b5a6 }`、`assets/seams.svg` | 3px |
| 酸柠胶带 | `.hero-inner::after`（190×26 胶带） | `--su-lime` `#d8f24a` |
| 题注白板（三块） | `.hero-logo` / `.tagline` / `.meta-row` | 白 .9 + 青硬投影 4px |
| 活动条 / 进度条 | `.activity-strip`、`.progress-block` 左边框 | `border-left: 4px solid #22b5a6` |
| 开屏：开窗 | `theme.json: "intro": "sun"`（`src/intro.js` 的 `sun` preset） | 青带落下 → 接缝拉开 → 同心环太阳升起 → 三块白板弹入 |

`features.texture = photo`（框架层的"照片"纹理通道），
`type` / `panel` 不启用——这套主题的字体效果是手写的，不需要框架代打。

开屏的 `sun` 与 GRIMOIRE 的 `seal` **结构级不同**：没有时钟、没有星盘、没有百分比条；
页脚三枚 chip 印的是**真实日期 / 时间 / 游戏数**（取自 dock），符合"符号必须有数据"的通则。

---

## 3. 量化验收

`python tools/measure-ratio.py --all`（实机取左 66% × 垂直 9%–72%）：

| 桶 | 参考 | 我们 | 差 |
|---|---|---|---|
| blue(天空) | 28% | 50% | **偏多**（待收：渐变下移） |
| white | 6% | 21% | **偏多**（题注井仍太宽） |
| cyan | 13% | 5% | 偏少（细线不够） |
| black | 5% | 0% | 缺（参考图的黑色是照片里的剪影） |

> 数值是线索不是 KPI。上一轮把 white 从 55% 压到 21% 靠的就是"天空延伸 +
> 白板收窄"，**方向确认有效**；继续压 white 时不要动正文底，只动白板外边距。

---

## 4. 不可回退的四个坑（都踩过）

1. **绝不能用大 `margin-top` 把 kicker/标题往下推来腾天空。**
   曾写 `kicker { margin-top: clamp(120px, 22vh, 190px) }`，结果是
   **活动条被挤出裁切框**（真截断，违反铁律 3）。现在这条被
   `margin-top: 0 !important` 钉死，天空比例改用**压缩纵向节奏**换：
   tagline 12 / meta 10 / cta 16 / progress 14 / activity 12。
2. **题注白板用 `inline-block` 会横向排成一行**（参考图是三行）。
   必须补 `display: block; width: fit-content` 才能"每行一块、各自贴合文字宽度"。
   这是本主题（和 BROADCAST）唯一被允许的布局改动，已验证两档尺寸无溢出。
3. **kicker 自己的白板会和标题白板重叠** → kicker 不给白板，只留酸柠底色；
   旧布局遗留的 `.kicker::before` 胶带已 `content: none` 关掉。
4. **硬投影不是发光**：一律 `N px N px 0 <solid>`，不许 `blur`/`box-shadow` 柔光
   （项目铁律，`docs/THEMES.md` 3.3）。

---

## 5. 下一步（本主题）

- white 21% → 目标 ≈ 10%：把三块题注板的左右 padding 再收一档。
- cyan 5% → 目标 ≈ 12%：`.activity-strip` / `.progress-block` 的青色左边框加粗，
  或在主视觉右缘加一条青色接缝（不得压字）。
- black 0% → 参考图的 5% 是照片剪影；这里没有照片剪影，**不打算硬造**，
  宁可留白，也不放无数据的深色块（同 GRIMOIRE【15】的教训）。
