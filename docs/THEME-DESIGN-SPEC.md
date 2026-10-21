# GUGUOVA 主题设计规范（1.14.0）

> 适用版本：**1.15.0**
> 最后整理：2026-10-21
> 覆盖范围：14 套界面主题、全部窗口/浮层/控件/文字、缩放引擎弹窗、全主题下拉、首页启动区块、夜航切换动画
> 配套：`docs/THEME-INTERFACES.md`（选择器与清单契约）、`docs/DESIGN-PHILOSOPHY.md`（设计理念）、
> `docs/themes/*.md`（单主题卡）、`.agents/skills/guguova-theme-design/`（可执行 skill）

这份文档是**改主题时唯一需要照做的检查表**。它回答四个问题：

1. 一套主题由哪些 token 和层组成？
2. 每个共享控件（下拉、引擎弹窗、全屏缩放行）在各主题里应该长什么样？
3. 文字什么时候算“不清晰”，怎么量、怎么修？
4. 改完怎么同步、怎么验收、怎么发版？

---

## 0. 一句话原则

**主题是界面语言，不是换色皮肤。** 换一套主题时，底色、字体角色、圆角/切角、按钮配方、
强调色的用法、弹窗材质、下拉菜单、全屏缩放行、切换动画都必须一起换；
但**信息层级、启动区块顺序、文字可读性**在 14 套主题里必须一致。

---

## 1. 不可违反的铁律

1. **文字必须可读。** 正文/小字 ≥ 4.5:1，大字号（≥24px，或 ≥18.66px 且 ≥700）≥ 3:1；
   以实际渲染背景为准，不以“设计意图”为准。
2. **强调色只做标记，不做小字。** 浅色强调（终末地酸黄、夏日酸柠、RISO 酸黄）压在白纸上
   只有 1.0–1.3:1。文字一律用 `--accent-text` 或墨色；强调色只做左轨、下划线、色块、描边。
3. **禁止系统原生控件。** 下拉用 `.nova-select`；弹窗用统一 `.engine-shell` / `.dialog` /
   `.overlay` 表面；消息框、文件框、`title` 浮窗都不允许。
4. **每个新控件一次适配 14 套主题。** 至少在一套深色（STEAM/STEEL/NIGHTFLIGHT）和一套
   纸面（ENDFIELD/SUMMER/DUSK）主题上量对比度，再交付。
5. **全屏层禁用 `filter` / `backdrop-filter`。** 只动 `transform / clip-path / opacity`。
6. **主题 CSS 改动必须 bump `theme.json` 的 version**，然后同步到用户主题目录并重启/刷新。
7. **首页启动区块顺序固定**：标题 → 类型 → 主按钮排 → 全屏缩放 → 进度；
   任何主题重排 `hero-inner` 都必须显式写 `.hero-scale` 的 order/宽度。
8. **游戏启动界面只能按 Esc 退出**（手柄 B 等价于返回）；点击、A、其它按键都不得关闭。
9. **用户数据目录不可直接拿来截图/测试**；截图走隔离演示库或只读审计。
10. **每轮改动必须更新本文档或对应单主题卡。**
11. **平台徽标只用文字**（`STEAM` / `EPIC` / `GOG` / `UBISOFT` / `EA` / `XBOX` /
    `BATTLE.NET`），不引入第三方 logo、品牌色或商店图标；徽标底色永远来自主题的
    `--sheet-well` / `--accent-text`，不跟平台品牌走。
12. **来源文案只有一个出口**：`app.js` 的 `platformOf()` / `sourceLabel()` /
    `platformShort()`。任何界面都不得再写 `game.source === 'steam' ? … : …`，
    新增平台时只改这三张表。
13. **入库窗口必须长在 `.engine-shell` 上**：复用 `--sheet-*` 材质与按钮配方，
    不允许另起一套深色玻璃卡；选择卡片的强调色只做左轨与描边，文字永远用
    `--sheet-ink` / `--sheet-ink-2` / `--sheet-muted`。

---

## 2. 主题分层模型

```
src/index.html            静态 DOM：shell / 四视图 / 浮层 / intro / launch / curtain
src/app.js                状态机、主题切换、文案（lexicon）、Steam 同步、启动界面退出
src/theme-engine.js       扫描 theme.json → 注入 theme.css → 写 tokens/icons/features/lexicon
src/base.css              结构与非主题样式；--ink/--muted/--faint 基线
src/type.css              字号阶梯、--text-* 令牌（文字对比度的全局杠杆）
src/app.css               共享控件契约：.nova-select / .engine-* / .hero-scale / --accent-text
src/motion.css            进游戏、主题切换幕布、reduce-motion
src/views.css             库/外观/设置/详情版式
src/dialogs.css           应用内对话框、文件浏览器、右键菜单
src/themes.css            主题选择器、右键菜单外观
src/settings-themes.css   设置页控件与用户卡的每主题签名
src/intro.css             开屏舞台
themes/<id>/theme.json    id / version / intro / tokens / sounds / lexicon / features
themes/<id>/theme.css     主题样式（基础 → 修正 → 签名；后写覆盖先写）
themes/<id>/assets/       预览图与专属 SVG
```

注入顺序：`base → theme → cta-palettes → type → app → motion → views → dialogs → themes →
theme-fx → fx-layers → theme-kit → polish → intro → compat → settings-themes`，
最后再注入 `<style id="theme-inline">`（主题 CSS）。因此：

- 主题 CSS 里的 `.foo` 会赢过前面同特异性的 `.foo`；
- 但 `src/type.css` 里写成 `.launch-copy .launch-kicker` 这类**更高特异性**的规则会赢过主题的
  `.launch-kicker`——本轮已把这类“抢色”规则删掉；
- 新增共享控件时，把 token 定义放在 `app.css`，把每主题差异写成
  `html[data-theme="<id>"] .控件 { --token: ... }`。

---

## 3. 颜色与文字层级

### 3.1 语义层

| 层级 | 用途 | 令牌 | 规则 |
| --- | --- | --- | --- |
| 底/纸 | 页面最大面积 | 主题自有 | 深色主题用深底，纸面主题用纸色 |
| 墨/主文字 | 标题、正文、控件文字 | `--ink` / `--sheet-ink` | 纸面一律墨色 |
| 次文字 | 说明、字段、路径 | `--muted` / `--text-muted` | 深底约 72% 米白；纸面用 ink-2 全不透明 |
| 弱文字 | 眉标、时间、脚注 | `--faint` / `--text-faint` | 深底 ≥ 58%；纸面用 ink-2/ink-3并保证 4.5:1 |
| 强调 | 当前位置、主操作、可点击 | `--accent` | **只做填充/轨道/描边** |
| 强调文字 | 小字号强调文字 | `--accent-text` | 每主题一个“可读版强调色” |
| 危险 | 删除/失败 | 主题 danger | 红色不做普通提醒 |

### 3.2 `--accent-text` 对照表（1.13.0 新增）

| 主题 | `--accent` | `--accent-text` | 说明 |
| --- | --- | --- | --- |
| nova | 封面取色 | 运行时提亮（`readableAccentText`） | 深封面会把 accent 小字压到 2:1；1.15.0 起按 WCAG 逐级提亮到 4.6:1，色相不变 |
| aurum | `#b08a4e` | `#e8c98a` | 暗底上提亮 |
| endfield | `#fffa00` | `#161616` | 酸黄是面，文字用墨 |
| zerohour | `#c9f73a` | `#c9f73a` | 青柠在近黑底可靠 |
| codex | `#e2c78e` | `#e2c78e` | 暗褐底可靠 |
| broadcast | `#141414` | `#141414` | 黑白灰主题 |
| summer | `#1a9bd7` | `#0f5f80` | 蓝压纸会掉到 3:1，压深 |
| riso | `#2f3fd4` | `#2b2fa8` | 蓝压纸压深 |
| riot | `#cf0017` | `#b00014` | 朱红压纸压深（原 `#e2001a` 为 4.4:1） |
| grimoire | `#7a1f2b` | `#7a1f2b` | 酒红在羊皮纸上可靠 |
| mnemo | `#5b4a8c` | `#5b4a8c` | 靛紫在白纸上 7:1 |
| dusk | `#c87a52` | `#a9503a` | 陶土压纸压深 |
| steam | `#1a9fff` | `#1a9fff` | 蓝在炭黑上 5.5:1 |
| nightflight | `#d9ff45` | `#d9ff45` | 荧光在深夜蓝上 17:1 |

使用规则：

```css
html[data-theme] :is(.lib-eyebrow, .appearance-kicker, .appearance-eyebrow,
  .scanner-kicker, .detail-kicker, .popover-kicker, .lib-stats b,
  .detail-progress .dp-head b) { color: var(--accent-text, var(--accent)); }

html[data-theme] .text-btn { color: var(--accent-text, currentColor); }
html[data-theme] .field-label em { color: var(--accent-text, currentColor); opacity: .9; }
```

### 3.3 全局文字基线（深色/中性）

| 令牌 | 1.12.0 | 1.13.0 | 用途 |
| --- | --- | --- | --- |
| `--muted`（base） | `.60` | **`.74`** | 次级说明 |
| `--faint`（base） | `.34` | **`.55`** | 眉标/时间/脚注 |
| `--text-muted`（type） | `.54` | **`.72`** | 控件说明 |
| `--text-faint`（type） | `.38` | **`.58`** | 微标签 |
| `--text-soft`（type） | `.74` | **`.84`** | 柔正文 |

纸面主题不要照抄这些半透明白：它们各自把 `--ink/--muted/--faint` 映射到自己的墨色，
例如 ENDFIELD `--faint: rgba(22,22,22,.64)`、RIOT `--t-faint: rgba(17,17,17,.64)`。

### 3.4 透明度纪律

- 祖先 `opacity` 会与你写的 `color` 相乘；不要在低对比色上再叠 `opacity`。
- 禁用控件仍要可读：`.btn:disabled` 1.13.0 提到 **`.72`**，`.text-btn:disabled` **`.9`**，
  `.type-shuffle:disabled` **`.72`**；扫描中按钮 `.scanner-actions .btn.primary:disabled` **`.88`**。
- 弹窗/通知/玩家菜单里的正文改用 `color: inherit`（跟随主题墨色），不要再写死白色；
  这是 1.12.0 里 ENDFIELD / MNEMO / RIOT 出现“白字白底”的根因。

---

## 4. 字体与字号

| 角色 | 令牌 | 说明 |
| --- | --- | --- |
| UI/正文 | `--font-ui` | 思源黑体 CN Medium |
| 标题 | `--font-display` | 黑体或宋体，按主题 |
| 衬线 | `--font-serif` | 思源宋体 |
| 标签 | `--font-condensed` | 大号标签 |
| 等宽 | `--font-mono` | STEAM / NIGHTFLIGHT 等数字与编号 |

- 中文 UI 不小于 13px；微标签可到 8–10px，但必须提亮到 AA。
- 主题写死 `font-size` 时乘 `var(--logo-fit,1)`。
- 引擎弹窗标题、眉标、字段标签、按钮、控件各有独立 token（见 §5.2），不要直接全局改字号。

---

## 5. 共享控件契约

### 5.1 全主题下拉 `.nova-select`

**结构**：`.nova-select > select + .nova-select-hit + .nova-select-menu > .nova-select-option`。
`select` 只做值源；`hit` 是透明按钮；`menu` 是主题化列表。

**令牌**（`src/app.css`，每主题一块 `html[data-theme]`）：

| 令牌 | 作用 |
| --- | --- |
| `--menu-bg` | 菜单表面（允许渐变） |
| `--menu-ink` | 主文字 |
| `--menu-muted` | 禁用项 |
| `--menu-line` | 描边 |
| `--menu-border` | 完整 border 简写（默认 `1px solid var(--menu-line)`） |
| `--menu-radius` / `--menu-option-radius` | 菜单/选项圆角 |
| `--menu-hover` / `--menu-selected-bg` | 悬停/选中底色 |
| `--menu-selected-ink` | 选中项文字（默认 `--menu-ink`） |
| `--menu-mark` / `--menu-mark-w` | 选中左轨颜色/宽度 |
| `--menu-check` | 选中标记字符（默认 ✓） |
| `--menu-font` / `--menu-size` / `--menu-letter` | 字体 |
| `--menu-shadow` | 阴影/硬影 |
| `--menu-scheme` | `color-scheme`，防止原生弹层闪白 |

**每主题表面**：

| 主题 | 表面 | 墨 | 描边/圆角 | 选中 |
| --- | --- | --- | --- | --- |
| nova | `#12151c` | `#f5f2ea` | 1px 白 14% / 10px | 白 7% 底 + accent 左轨 |
| aurum | 深绿渐变 | `#f2e2bd` | 青铜 34% / 2px | 青铜 12% 底 + 青铜左轨 |
| endfield | `#ffffff` | `#161616` | 墨 1px / 0 | 酸黄底 + 墨字 + 墨左轨 |
| zerohour | `#111214` | `#f1efe7` | 青柠 1px / 0 | 青柠 16% 底 + 4px 左轨 |
| codex | 深褐渐变 | `#f0e4cc` | 金 34% / 2px | 金 10% 底 + 金左轨 |
| broadcast | `#f7f7f4` | `#141414` | 墨 1px / 0 | 黑底米白字 + 灰左轨 |
| summer | `#ffffff` | `#101820` | 墨 1px / 0 | 酸柠底 + 墨字 + 墨左轨 |
| riso | `#faf8ef` | `#101014` | 蓝 2px / 0 | 酸黄底 + 墨字 + 蓝左轨 |
| riot | `#faf6ed` | `#111111` | 墨 2px / 0 | 黑底米白字 + 红左轨 |
| grimoire | `#f1e4c6` | `#2a1b12` | 金 1px / 2px | 深羊皮纸底 + 酒红左轨 |
| mnemo | `#fbf9fd` | `#241f33` | 靛紫 1px / 2px | 淡紫底 + 梅红左轨 |
| dusk | `#f7edd8` | `#30251a` | 金 1px / 2px | 纸-2 底 + 陶土左轨 |
| steam | 炭黑渐变 | `#f3f4f6` | `#30333b` / 3px | 面板-3 底 + 蓝左轨 |
| nightflight | `#0b1724` | `#e9edf2` | `#2f5474` / 4px | 荧光 12% 底 + 荧光左轨 |

**禁止**：`background: Canvas/CanvasText`、系统原生弹层、用 accent 直接给选中文字上色。
选中项的文字永远是 `--menu-selected-ink`（默认菜单墨色），强调色只出现在左轨/标记。

### 5.2 缩放引擎弹窗 `.engine-shell`

**结构**：`.engine-overlay > .engine-shell > .engine-head + .engine-body`。
`.engine-shell` 通过 `--sheet-*` 令牌换材质；每主题一块
`html[data-theme="<id>"] .engine-shell { ... }`。

**核心令牌**：

| 组 | 令牌 |
| --- | --- |
| 材质 | `--sheet-bg` `--sheet-ink` `--sheet-ink-2` `--sheet-muted` `--sheet-line` `--sheet-hair` `--sheet-well` `--sheet-radius` `--sheet-shadow` `--sheet-scheme` `--sheet-clip` |
| 标题 | `--sheet-title-font` `--sheet-title-size` `--sheet-title-weight` `--sheet-title-spacing` `--sheet-title-transform` |
| 眉标 | `--sheet-kicker-font` `--sheet-kicker-size` `--sheet-kicker-spacing` `--sheet-kicker-color` |
| 字段标签 | `--sheet-label-font` `--sheet-label-size` `--sheet-label-spacing` `--sheet-label-transform` `--sheet-label-color` |
| 控件 | `--sheet-control-radius` `--sheet-control-height` `--sheet-control-font` `--sheet-control-size` `--sheet-control-pad` `--sheet-control-bg` `--sheet-control-border` `--sheet-control-ink` |
| 按钮 | `--sheet-btn-radius` `--sheet-btn-height` `--sheet-btn-font` `--sheet-btn-spacing` `--sheet-btn-transform` `--sheet-ghost-bg/ink/border/shadow` `--sheet-primary-bg/ink/border/shadow/weight` |
| 签名 | `--sheet-top-width` `--sheet-top-color` `--sheet-strip-h` `--sheet-strip` `--sheet-active-bg` `--sheet-mark` `--sheet-mark-w` |

**每主题配方**：

| 主题 | 表面 | 标题字体 | 圆角 | 主按钮 | 签名 |
| --- | --- | --- | --- | --- | --- |
| nova | 深色渐变 | display 黑体 | 20px | accent 填充 | 无 |
| aurum | 墨绿渐变 | 宋体 600，字距 .1em | 4px | 暗金渐变 → 深墨字 | 2px 青铜顶线 |
| endfield | 纯白 | 黑体 800 | 0 | 酸黄 + 墨边 + 4px 硬影 | 3px 品红/酸黄/薄荷顶带 + 16px 切角 |
| zerohour | `#111214` | 黑体 800 | 0 | 青柠 + 墨字 + 硬影 | 2px 青柠顶线 |
| codex | 深褐渐变 | 宋体 600，字距 .08em | 2px | 浅金 → 深褐字 | 1px 金线 |
| broadcast | `#f7f7f4` | 宋体 700 | 0 | 黑底米白字 | 3px 黑顶线 |
| summer | `#ffffff` | 宋体 700 | 0 | 黑底白字；次按钮酸柠黑字 | 4px 黑/酸柠/青蓝顶带 |
| riso | `#faf8ef` | 宋体 700 | 0 | 酸黄 + 墨边 + 蓝硬影 | 3px 蓝顶线 + 2px 蓝框 |
| riot | `#faf6ed` | 黑体 800 | 0 | 黑底米白字 + 红硬影 | 3px 红顶线 + 2px 黑框 |
| grimoire | 羊皮纸 | 宋体 600 | 2px | 酒红 + 羊皮纸字 + 金内线 | 2px 金顶线 |
| mnemo | `#fbf9fd` | 黑体 700 | 2px | 梅红 + 白字 | 3px 靛紫顶线 |
| dusk | 羊皮纸 | 宋体 600 | 2px | 陶土渐变 + 纸色字 + 金内线 | 2px 金顶线 |
| steam | 炭黑渐变 | 黑体 700 | 3px | 大屏蓝渐变 + 深字 + 内高光 | 2px 蓝顶线 |
| nightflight | 深夜蓝渐变 | 黑体 700 + Mono 标签 | 0 | 荧光 + 墨字 + 4px 硬影 | 2px 荧光顶线 |

**行状态**：

- 关闭按钮：`--sheet-ink-2`，`opacity: 1`。若主题对 `.icon-btn` 使用了 `!important`
  （GRIMOIRE / CODEX / SUMMER），必须在 `html[data-theme="<id>"] .engine-shell .icon-btn`
  上用更高特异性 + `!important` 覆盖；GRIMOIRE 的浅金 X 压羊皮纸就是 1.2:1 的实例。
- 弹窗内 `<select>` 的列表仍使用 `.nova-select` 表面（主题化），不再回到系统白底。

#### 5.2.1 算法行（当前算法 / 缺少效果）

算法行不是普通列表项，而是**每套主题的一块“选择卡”**。它使用独立的 `--mode-*` 令牌，
直接声明在 `.engine-mode-row` 上（不要声明在 `.engine-shell`，否则会被行自身的默认值遮蔽）：

| 组 | 令牌 |
| --- | --- |
| 常态 | `--mode-bg` `--mode-ink` `--mode-name-ink` `--mode-border` `--mode-radius` `--mode-mark` `--mode-mark-w` `--mode-shadow` `--mode-pad` `--mode-name-font/weight/size/spacing` `--mode-hover-bg` |
| 当前项 | `--mode-active-bg/ink/name/border/radius/mark/mark-w/shadow/font/weight/spacing` |
| 缺少效果 | `--mode-missing-bg/ink/name/border/mark/mark-w/radius` |

| 主题 | 当前算法行 | 缺少效果行 |
| --- | --- | --- |
| nova | 白色 10%→3% 渐变、1px 白 12%、accent 左轨 3px、6px 圆角 | 无框、muted 字 |
| aurum | 青铜 18%→4% 渐变、1px 青铜 38%、青铜左轨 2px、宋体名 | 1px 虚线青铜 20% |
| endfield | **酸黄实块**、墨边 1px、墨左轨 6px、3px 墨硬影、名 800 | 1px 虚线 `--ef-rule` |
| zerohour | `#17191d` 底、青柠 1px 框、青柠左轨 4px、青柠硬影 3px | 1px 虚线 `#34373e` |
| codex | 金 18%→4% 渐变、1px 金 40%、金左轨 2px、宋体名 | 1px 虚线金 20% |
| broadcast | **黑块米白字**、米白左轨 4px、3px 黑硬影、宋体名 | 1px 虚线 `#c9c9c3` |
| summer | **黑块白字**、酸柠左轨 6px、3px 酸柠硬影 | 1px 虚线墨 |
| riso | **酸黄实块墨字**、墨 2px 框、蓝左轨 6px、4px 蓝硬影 | 1px 虚线蓝 |
| riot | **黑块米白字**、黑 2px 框、朱红左轨 6px、4px 红硬影 | 1px 虚线黑 |
| grimoire | **酒红实块羊皮纸字**、金 1px 框 + 金内线、金左轨 4px、宋体名 | 1px 虚线金 |
| mnemo | 淡紫底墨字、靛紫 1px 框、梅红左轨 4px | 1px 虚线靛紫 |
| dusk | 纸-2 底墨字、陶土左轨 4px、金内线、宋体名 | 1px 虚线纸边 |
| steam | 蓝 20%→炭黑渐变、蓝 1px 框、大屏蓝左轨 4px、3px 圆角 | 1px 虚线 `#30333b` |
| nightflight | 荧光 10% 底、`#2f5474` 框、荧光左轨 5px、4px 深影、Mono 名 | 1px 虚线 `#1c3348` |

规则：

- 当前算法文字用 `--mode-active-name/ink`，**绝不**用 accent 当小字；
- 缺少效果不加整体透明度，用虚线框 + 删除线 + muted 色；
- 实色块主题（ENDFIELD/SUMMER/RISO/RIOT/GRIMOIRE/BROADCAST）的当前行文字必须是
  块面的对比色（酸黄/黑/酒红），并跑一次对比度审计。

### 5.3 首页「全屏缩放」行 `.hero-scale`

**结构**：图标 + 标签 + 提示 + `.switch`。它属于启动区块，顺序固定。

**令牌**：`--hs-bg` `--hs-hover-bg` `--hs-border` `--hs-hover-line` `--hs-radius` `--hs-ink`
`--hs-hint-alpha` `--hs-min-h` `--hs-pad` `--hs-label-size/spacing/weight` `--hs-hint-size`
`--hs-mark` `--hs-mark-w` `--hs-shadow` `--hs-font`。

| 主题 | 材质 | 圆角 | 强调标记 |
| --- | --- | --- | --- |
| nova | 白色 3% 半透 | 9px | 无 |
| aurum | 近黑 66% | 2px | 青铜左轨 2px |
| endfield | 白底墨框 | 0 | 酸黄左轨 4px + 硬影 |
| zerohour | `#111214` | 0 | 青柠左轨 4px |
| codex | 深褐 72% | 2px | 金左轨 2px |
| broadcast | 纸白 | 0 | 黑左轨 4px |
| summer | 纯白墨框 | 0 | 黑左轨 4px + 酸柠硬影 |
| riso | 纸底蓝框 | 0 | 酸黄左轨 5px + 蓝硬影 |
| riot | 纸底黑框 | 0 | 朱红左轨 5px + 红硬影 |
| grimoire | 羊皮纸金线 | 2px | 酒红左轨 3px |
| mnemo | 白底紫线 | 0 | 梅红左轨 3px |
| dusk | 纸色半透金线 | 2px | 陶土左轨 3px |
| steam | 炭黑 + 蓝色渐变起点 | 3px | 大屏蓝左轨 3px |
| nightflight | 深夜蓝 78% | 0 | 荧光左轨 3px + 硬影 |

### 5.4 外观取景浮层 `.appearance-framing`

浮在任意游戏主视觉上的取景面板。**必须是不透明的主题表面**，不能再用统一的深色玻璃卡；
否则纸面主题会像一块网页浮窗压在白纸上。

| 组 | 令牌 |
| --- | --- |
| 材质 | `--af-bg` `--af-solid`（渐变面的实底，供审计/合成使用） `--af-ink` `--af-muted` `--af-line` `--af-border` `--af-radius` `--af-shadow` `--af-strip-h` `--af-strip` `--af-clip` |
| 标题 | `--af-kicker-font/size/spacing/color` `--af-value-font/size/color` |
| 按键 | `--af-key-bg/ink/border/radius/font/size` `--af-key-hover-bg/ink/border` `--af-reset-radius` `--af-zoom-ink` `--af-hint-color` |
| 完成 | `--af-done-bg`（可为渐变） `--af-done-solid`（渐变实底） `--af-done-ink/border/radius/shadow/font/size/weight/spacing` |

| 主题 | 浮层材质 | 按键 | 完成 |
| --- | --- | --- | --- |
| nova | 深色渐变 | 半透明圆角 | accent 填充 |
| aurum | 墨绿渐变 + 2px 青铜顶线 | 深底青铜细框、2px | 鎏金渐变 |
| endfield | 白纸 + 墨边 + 14px 切角 + 三色顶带 | 白底墨框、方角 | 酸黄 + 墨边 + 硬影 |
| zerohour | 近黑 + 青柠框 + 硬影 | 黑底青柠细框、方角 | 青柠 + 硬影 |
| codex | 深褐渐变 + 金线 | 深井金线、2px | 浅金 |
| broadcast | 纸白 + 黑框 + 黑顶线 | 白底黑框、方角 | 黑底米白字 |
| summer | 白纸 + 黑框 + 酸柠硬影 + 三色顶带 | 白底黑框、方角 | 黑块白字 |
| riso | 纸底蓝框 + 蓝硬影 | 纸底墨框、方角 | 酸黄 + 蓝硬影 |
| riot | 纸底黑框 + 红硬影 | 纸底黑框、方角 | 黑块米白字 + 红硬影 |
| grimoire | 羊皮纸金框 + 金内线 | 羊皮纸金框、2px | 酒红 + 羊皮纸字 |
| mnemo | 雾紫纸 + 靛紫框 | 白底靛紫框、方角 | 梅红 + 白字 |
| dusk | 羊皮纸金框 | 纸边墨框、2px | 陶土渐变 + 纸色字 |
| steam | 炭黑渐变 + 2px 蓝顶线 | 炭黑底蓝框、3px | 大屏蓝渐变 |
| nightflight | 深夜蓝 + 蓝灰框 + 硬影 | 深蓝底蓝灰框、方角 Mono | 荧光 + 墨硬影 |

规则：

- 浮层必须不透明；渐变主题要同时给 `--af-solid`，否则审计无法合成背景、也会在亮图上透出底图。
- 键帽/完成按钮的文字必须过 AA；渐变按钮要提供 `--af-done-solid`。
- 浮层位置仍是右上 16px；`≤820px` 时自动铺到左右 12px。

### 5.4.1 首页主视觉取景（1.13.0 补）

首页主视觉有两种实现，取景编辑器必须同时作用到：

1. 共享 `.scene > img`：直接由 `applyHeroFraming` 设置 `object-position` / transform；
2. 主题自绘背景：DUSK / GRIMOIRE / NIGHTFLIGHT / STEAM 用 `--nova-hero` 画主视觉，
   必须消费两个新变量：

```css
background:
  ...,
  var(--nova-hero) var(--nova-hero-position, center) / var(--nova-hero-size, cover) no-repeat;
```

- `--nova-hero-position`：`x% y%`，由 `heroPosition` 写入；
- `--nova-hero-size`：缩放 1 时为 `cover`，放大时为 `auto N%`；
- 取景编辑器的裁剪窗用 `--hero-frame-ratio` 表示主题真实主视觉框比例：
  默认 `1.7778`（16:9），DUSK `1.6`（16:10），NIGHTFLIGHT `1`（圆形舷窗），
  GRIMOIRE `.75`（竖版档案卡）；
- 缩放到 100% 时移动会改变裁剪，不能在 `object-fit: contain` 的图上调 `object-position`
  （那样看起来“没反应”）；
- 启动遮罩也用 `applyHeroFraming`，与首页保持一致。

### 5.5 入库窗口 `.import-shell`（1.15.0 新增）

**为什么不是新的一套材质**：入库窗口是「添加游戏」的唯一入口（顶栏 `+`、游戏库
「添加游戏」、空库主按钮、首次启动提示）。它直接挂 `.engine-shell` 类，材质、
切角、标题字体、按钮配方、强调标记全部继承 `--sheet-*`，所以 14 套主题里它天生
就是那套主题的弹窗，而不是一块压在纸上的深色卡片。

**结构**：

```html
.overlay.import-overlay
  .engine-shell.import-shell[role=dialog]
    .engine-head     → .engine-kicker + h2 + p + .icon-btn(关闭)
    .engine-body.import-body
      .import-detected  → .import-platform × N   （平台名 + 数量）
      .import-choices   → .import-choice × 2     （role=radio，aria-checked）
    .engine-actions.import-actions → 次要按钮 + .engine-btn.primary
```

**使用的令牌**（全部来自 `.engine-shell`，不新增令牌族）：

| 用途 | 令牌 |
| --- | --- |
| 表面 / 文字 | `--sheet-bg` `--sheet-ink` `--sheet-ink-2` `--sheet-muted` |
| 分隔 | `--sheet-line` `--sheet-hair` |
| 圆角 / 切角 | `--sheet-control-radius` `--sheet-clip` |
| 选择卡选中态 | `--sheet-active-bg` `--sheet-mark` `--sheet-mark-w` |
| 主按钮 | `--sheet-primary-bg/ink/border/shadow` |
| 眉标 / 标题字 | `--sheet-kicker-*` `--sheet-title-*` |

固定规则：

- 选择卡默认 `background: transparent` + `1px var(--sheet-line)`；选中才铺
  `--sheet-active-bg`，左侧竖条用 **`border-left: var(--sheet-mark-w) solid`**
  实现——不要用 `::before` 画条：审计会把伪元素背景当成整块底色，
  选中卡会被误判成 1:1；
- 「推荐」标签用 `--sheet-ink-2` + 一个 `--sheet-mark` 圆点。**不要**用
  `--accent-text`：nova 的 accent 取自封面，深色封面会把 8.5px 小字压到 2:1；
- 平台检测条（`.import-platform`）是「平台名 + 数量」，已安装的用实线框，
  未检测到的直接不渲染；
- 弹窗内的焦点环用 `--sheet-ink`（`html .engine-shell :focus-visible`），
  白色焦点环在纸面主题上等于没有。

**每主题落点**（由上表令牌推导，改令牌即改这里）：

| 主题 | 表面 | 选择卡边框 | 选中标记 | 主按钮 |
| --- | --- | --- | --- | --- |
| nova | 深色渐变 | 1px 白 12% / 10px 圆角 | accent 2px 左轨 | accent 填充 + 深字 |
| aurum | 墨绿渐变 | 1px 青铜 34% / 2px | 青铜 2px 左轨 | 鎏金渐变 + 深墨字 |
| endfield | 白纸 + 三色顶带 + 16px 切角 | 方角墨框 | 墨 4px 左轨 | 酸黄 + 墨边 + 4px 硬影 |
| zerohour | `#111214` + 青柠顶线 | 方角青柠细框 | 青柠 4px 左轨 | 青柠 + 墨字 + 硬影 |
| codex | 深褐渐变 + 金线 | 金 2px | 金 2px 左轨 | 浅金 + 深褐字 |
| broadcast | 纸白 + 3px 黑顶线 | 方角黑框 | 黑 3px 左轨 | 黑底米白字 |
| summer | 白纸 + 三色顶带 | 方角墨框 | 墨 4px 左轨 | 黑底白字 |
| riso | 纸底蓝框 + 蓝硬影 | 方角蓝框 | 蓝 4px 左轨 | 酸黄 + 墨边 + 蓝硬影 |
| riot | 纸底黑框 + 红硬影 | 方角黑框 | 朱红 4px 左轨 | 黑底米白字 + 红硬影 |
| grimoire | 羊皮纸 + 金线 | 金 2px | 酒红 3px 左轨 | 酒红 + 羊皮纸字 + 金内线 |
| mnemo | 白底紫线 | 靛紫细框 | 梅红 3px 左轨 | 梅红 + 白字 |
| dusk | 纸色 + 金线 | 墨 2px | 陶土 3px 左轨 | 深陶土渐变 + 纸色字 |
| steam | 炭黑 + 蓝顶线 | 蓝 3px | 蓝 3px 左轨 | 蓝渐变 + 深字 |
| nightflight | 深夜蓝 + 荧光顶线 | 方角蓝灰框 | 荧光 4px 左轨 | 荧光 + 墨字 + 硬影 |

> DUSK 的主按钮 1.15.0 从 `#c87a52→#a9503a` 改成 `#a9503a→#8a3d2a`：原来的浅端
> 与纸色文字只有 2.95:1，11px 按钮字读不出来。这条同时修好了缩放引擎弹窗的
> 保存按钮。

### 5.6 启动界面（进游戏）

- 键盘：**只有 Esc** 可以退出；点击遮罩、A、Enter、空格、任意键都不再关闭。
- 手柄：B / ○（返回）等价于 Esc；A / ✕ 不再关闭。
- 启动中与“已就绪”状态都遵守同一条规则。
- 提示文案：`按 Esc 退出`。
- 退出走 `closeLaunch()`（900ms，reduce-motion 240ms），保留下次启动的状态清理。

---

## 6. 文字可读性验收

### 6.1 自动审计

```bash
node tools/audit-contrast.js
# 或只查指定主题/界面
node tools/audit-contrast.js --themes=endfield,dusk --views=home,settings,import,engine,launching
```

工具会：

1. 逐主题、逐界面激活主题；
2. 取当前界面 + 顶栏的每一个可见文字宿主；
3. 合成祖先 `background-color`，乘以祖先 `opacity`，算 WCAG 对比度；
4. 把 `hero-inner / detail-art / appearance-preview / editor-preview` 等
   “伪元素画纸”的表面标成 `layered`，交给人眼复核；
5. 输出 `_shots/contrast/contrast.json` 与按主题/界面的失败列表。

**门槛：`✓ every measured text run meets AA on a solid background`。**
`layered` 项要截图目检，不能因为工具标了 layered 就跳过。

### 6.1.1 悬停 / 聚焦审计（1.14.0 新增）

静态审计只看静止态，而真实事故几乎都发生在 hover：

```bash
node tools/audit-hover.js
node tools/audit-hover.js --themes=zerohour,summer --views=home,settings,import,detail
```

- 用 CDP `CSS.forcePseudoState` 强制 `:hover` / `:focus`，读稳定后的颜色；
- 把 `.btn::before` 扫光层纳入背景合成（扫完时才作为底色）；
- 门槛同上：正文 4.5:1、大字 3:1；
- 输出 `_shots/contrast-hover/hover.json`，有失败时退出码 1。

**改了 `.btn::before`、`.icon-btn`、`.pref-row:hover`、`.btn.ghost:hover`
或任何 `:hover` 配色，都必须跑这一条。**

### 6.2 手工抽查

- 每个主题至少看：首页（含全屏缩放行）、设置、引擎弹窗、下拉打开、启动遮罩、通知。
- 纸面主题必须在白纸上量一次强调色小字。
- 深色主题必须看一眼“缺少效果/禁用/空态”三类灰字。
- 引擎弹窗的模式列表（含 disabled 行）必须读得清。
- 下拉菜单的选中项必须“有强调色标记，但文字是墨色”。

### 6.3 常见“不清晰”根因

| 现象 | 根因 | 修法 |
| --- | --- | --- |
| 黄底黄字 / 蓝底蓝字 | accent 当文字 | 用 `--accent-text` 或墨色；accent 只做标记 |
| 白字白底 | 通知/玩家菜单写死 `rgba(255,255,255,…)` | 改 `color: inherit`，由主题 popover 墨色决定 |
| 纸面深底暗字 | 主题把纸色当页面底，文字仍用深墨 | 纸面文字只在纸容器内；或给 popover/panel 明确底色 |
| 禁用行像消失 | 整体 `opacity: .5` | 拆成虚线/删除线 + 正常 muted 色；禁用按钮 opacity ≥ .72 |
| 启动步骤看不清 | 各主题用 `--t-muted`（纸面墨色）压暗底 | 启动层文字统一用亮色；纸面主题单独写亮色值 |
| 下拉选中项看不清 | `.nova-select-option[aria-selected] { color: accent }` | 文字用 `--menu-selected-ink`，accent 做左轨 |
| hover 整块变白 | `.btn::before` 扫光层 `z-index:0` 盖住未包裹的纯文本 | 扫光层改 `z-index:-1`（`.btn` 已有 `isolation:isolate`） |
| hover 白底荧光字 | 扫光层是纸色，文字仍是 accent | hover 文字改墨色（`--zh-ink` / `--ef-ink`） |
| 弹窗内图标看不见 | 主题把顶栏 `.icon-btn` 染成浅金，弹窗是浅底 | `html[data-theme="<id>"] .detail-modal .icon-btn` 覆盖成墨色 |
| 爱心/管理按钮消失 | base.css `.icon-btn.square` 是半透明白 | 浅色主题必须显式给 rest/hover 前景与底 |
| 扫描行徽标读不清 | 主题把 `.scan-source` 写成 `--t-accent`（RIOT 纸面 4.04:1） | 统一用 `--accent-text`：`html[data-theme] .scan-source` |
| 轨道小字发暗 | `.tile.is-active .tile-sub` 用了 `--accent`（封面深色时 2.2:1） | 小字用 `--muted`，强调只保留在卡片边框/进度条 |

---

## 7. 动效

### 7.1 通用

- 曲线：snap `cubic-bezier(.16,1,.3,1)`、mech `cubic-bezier(.7,0,.2,1)`、
  soft `cubic-bezier(.4,0,.2,1)`。
- 单次响应 100–400ms；开屏 ≤ 2.4s；幕布覆盖 360–650ms。
- 全屏层只动 transform / clip-path / opacity；不使用 filter/backdrop-filter。
- `prefers-reduced-motion` / `data-tier="safe"` 直接切换，不播幕布。

### 7.2 主题切换幕布（14 套）

| 主题 | 动作 | CURTAIN_HOLD |
| --- | --- | --- |
| nova | 上下双幕布 + 中央光缝 | 360 |
| aurum | 左右青铜门 + 竖金缝 + 门环 | 400 |
| endfield | 蓝图面板横扫 + 38px 切角 + 三色条 | 380 |
| zerohour | 漫画分页：黑板 + 白框分镜 + 青柠字幕带 | 420 |
| codex | 整页绕顶边 3D 翻下/翻开 | 430 |
| broadcast | CRT 开机闪白 → 收成横线 | 360 |
| summer | 白纸印版扫入 + 黑/黄块压版 | 470 |
| riso | 蓝/纸双印版反向错位 | 380 |
| riot | 朱红褶皱舞台幕布 + 撕胶带缝 | 380 |
| grimoire | 羊皮纸页上升 + 蜡封落下 | 650 |
| mnemo | 纵向记忆条带 + 紫色重影 | 360 |
| dusk | 拆信封：信纸升起 + 三角封盖折回 + 红绳收紧 | 460 |
| steam | 游戏 tile 从中心放大到全屏 + 焦点环 | 440 |
| **nightflight** | **登机口关闭：上下深夜蓝面板合拢 + 中央奶油登机牌带展开 + 荧光扫描线 + 翻牌式主题名** | **560** |

### 7.3 夜航幕布（1.13.0 重做）

- 构图：上下各 46% 的深夜蓝天幕（网格 + 地平线冷光）合拢，中间留出
  `clamp(88px,12vh,112px)` 的奶油登机牌带；带子两端各有一个 9px 圆缺口。
- 带子：2px 荧光上下轨、从中心 `scaleX(0→1)` 展开；内部荧光扫描条
  `translateX(-140% → 700%)` 0.55s 扫过一次。
- 文字：`INTERFACE THEME` 墨色 Mono；主题名在荧光色块上（墨字 + 4px 硬影）；
  `正在切换外观` 墨色 62%。整组以 `rotateX(-78deg→0)` 翻牌式落下。
- 揭开：面板先撤，带子中部收拢，文字翻起；全程无模糊。
- `CURTAIN_HOLD = 560`（≥ 带子 400ms + 40ms 延迟与文字 300ms + 220ms 延迟）。

---

## 8. 主题 lexicon（主题文案词典）

`theme.json` 新增可选 `lexicon`：

```json
"lexicon": {
  "lastPlayed": "上次委托"
}
```

- `theme-engine.js` 把 manifest 原样传给 `window.NovaTheme.find(id)`；
- `app.js` 的 `themeWord(key, fallback)` 读取 **当前激活主题** 的词典；
- 目前只开放 `lastPlayed`（用于首页眉标与进度标题）；
- 键缺失/为空时回退到共享文案，主题不能把 UI 文案弄空；
- 当前使用：DUSK `上次游玩 → 上次委托`。

新增键时必须同步 `docs/THEME-INTERFACES.md` §13 与本文件。

---

## 9. Steam 游玩时间同步

### 9.1 数据源

- `SteamRoot/userdata/<steamid>/config/localconfig.vdf`
- 路径：`UserLocalConfigStore → Software → Valve → Steam → apps → <appid>`
- 字段：`Playtime`（分钟）、`LastPlayed`（Unix 秒）
- 多个用户目录：逐 app id 取 **最大** 时长与 **最新** 时间。

### 9.2 合并规则

- 只处理 `Source == "steam"` 且 `SteamAppId` 非空的条目；
- `PlaytimeSeconds = max(本地, Steam)`，**不相加**（同一局 Steam 与启动器各记一次）；
- `LastPlayedUtc` 取较晚者；
- 非 Steam 条目完全不动；
- 失败静默（Steam 未安装/文件损坏/权限不足），只写日志。

### 9.3 触发点

1. 应用启动、`Store.Load()` 之后（同步完成后再把 boot payload 发给前端）；
2. 游戏退出后 2.5s（Steam 写完 playtime 之后）→ `playtime-synced` 推送给前端；
3. 导入 Steam 候选之后；
4. 设置 → 数据与备份 →「同步 Steam 游玩时间」手动按钮。

### 9.4 前端

- `applyPlaytimeUpdates(entries)` 只升不降，重绘首页/详情/库/设置；
- 手动按钮在「有 Steam 条目」时显示；
- 提示：`已同步 N 款游戏的 Steam 游玩时间` / `Steam 没有新的游玩记录`。

---

## 10. 界面清单与主题责任

| 界面 | 必查 |
| --- | --- |
| 首页 | 标题 30 字、类型、主按钮排、全屏缩放行、进度、dock |
| 游戏库 | 搜索、筛选、排序下拉、卡片、空态 |
| 外观 | 预览、主题网格、字标、取景编辑、下拉 |
| 设置 | 双栏、用户卡、开关、输入框、下拉、Steam 权限、同步按钮 |
| 详情 | 统计格、路径、进度、管理面板、启动选项 |
| 入库窗口 | 眉标/标题/平台检测条/两张选择卡（选中与未选中）/主次按钮/关闭 |
| 缩放引擎 | 标题/眉标/标签/控件/按钮/算法列表/禁用行/关闭 |
| 启动遮罩 | Esc 提示、步骤、进度、底部说明 |
| 通知/玩家菜单 | 表面墨色、空态、脚注、快捷键 |
| 右键菜单 | 表面、快捷键、悬停 |
| 睡眠 | 时间、日期、唤醒提示 |
| 开屏 | 舞台、跳过、reduce-motion |
| 切换幕布 | 覆盖/揭开、无闪烁 |

---

## 11. 验收流程

> 审计/截图工具调用 `NovaTheme.activate(id, { persist: false })`，不会改写玩家保存的主题；
> 只有真实 UI 切换才持久化。

### 11.0 一键全量截图（无头，1.15.0 新增）

改完 CSS 想一次看全 14 套主题时，不必启动 WPF / WebView2：

```bash
node tools/headless-shots.js                       # 14 主题 × 7 个核心界面
node tools/headless-shots.js --views=all --workers=4
node tools/headless-shots.js --themes=endfield,dusk --views=import,settings --sizes=960x600
node tools/headless-shots.js --format=png --out=../_shots/png --open
```

- 用本机 Edge/Chrome 的 `--headless=new` 渲染 `http://127.0.0.1:<port>/src/index.html`；
- 原生桥由 `tools/lib/headless-host.js` 在页面里应答（6 款虚构游戏、各平台计数、
  引擎选项、扫描结果），**不读玩家数据目录**；
- 每张图同时跑布局审计（截断 / 横向溢出 / logo 压字），输出
  `manifest.json`，退出码非 0 表示一张都没出来；
- 默认 4 个渲染进程并行；实测 14 主题 × 20 界面 = **280 张 / 212 秒**。

> 页面侧「点进某个界面」的脚本只有一份：`tools/lib/ui-views.js`，
> `export-all.js` 与 `headless-shots.js` 共用，避免两套点击逻辑漂移。

```bash
cd nova-game-space-desktop

# 1) 构建 + 同步主题 + 启动（CDP 9223）
bash tools/relaunch.sh

# 2) 全量对比度
node tools/audit-contrast.js

# 3) 全主题截图（含引擎弹窗/下拉）
node tools/export-all.js --views=all --sizes=1439x1124,960x600 --stress

# 4) 单主题快速看
node tools/export-all.js --themes=endfield,dusk,steam --views=all --sizes=1439x1124
```

通过标准：

- 对比度报告 0 个“solid background”失败；
- `export-all` 0 截断 / 0 横向溢出 / 0 logo 压字；
- 引擎弹窗与下拉在深色 + 纸面主题各看一遍；
- 全屏缩放行在每个主题都落在启动区块内；
- 夜航幕布覆盖/揭开无闪烁、无模糊；
- 启动界面点击/按键不关闭，Esc 关闭。

---

## 12. 发版检查

1. `node tools/bump-version.js <x.y.z>`（同步 csproj / index.html / version.json）；
2. **每套改过 CSS 的主题** 手动 bump `theme.json` 的 patch 版本；
3. `bash tools/release.sh --audit`（审计 + 构建 + 校验 + 冒烟 + 可选发布）；
4. 更新 `docs/HANDOFF-NEXT.md`、`docs/THEME-INTERFACES.md` 版本表、本文件日期；
5. 发布前确认：主题预览图、音效许可、30 字测试、首次切换动画、缓存位置。

---

## 13. 文件与命令索引

| 需求 | 位置 |
| --- | --- |
| 主题清单 | `themes/<id>/theme.json` |
| 主题样式 | `themes/<id>/theme.css` |
| 共享控件令牌 | `src/app.css`（`.nova-select` / `.engine-shell` / `.hero-scale` / `--accent-text`） |
| 文字基线 | `src/base.css`、`src/type.css` |
| 幕布 | `src/motion.css` + `src/app.js` `CURTAIN_HOLD` |
| 启动退出 | `src/app.js` `bindKeyboard` / `closeLaunch` / `padBack` |
| 主题文案 | `theme.json.lexicon` + `app.js` `themeWord` |
| Steam 同步 | `Services/SteamPlaytime.cs`、`Services/StoreService.SyncSteamPlaytime`、`NativeBridge` |
| 平台扫描 | `Services/PlatformScanner.cs`（Epic/GOG/Ubisoft/EA/Xbox/战网） |
| 平台启动 | `Services/LaunchModes.cs`（`GameLaunch.ModeFor`）、`LauncherService.LaunchThroughClient` |
| 入库窗口 | `src/index.html#importOverlay`、`src/app.js` IMPORT SHEET 段、`src/app.css` `.import-shell` |
| 对比度审计 | `tools/audit-contrast.js` |
| 截图审计 | `tools/export-all.js` |
| 重载 | `tools/relaunch.sh` |

---

## 14. 已知限制

- 对比度工具只能合成 `background-color`；由伪元素/背景图绘制纸面的区域标为 `layered`，需人眼复核。
- 悬停审计会把带背景的 `::before` 当成整块底色（`.btn` 扫光层就是这么处理的），
  所以**细条、角标一类装饰不要用伪元素画**，否则会得到假的 1:1。
- 多个主题的启动/睡眠层仍有“深底浅字”的视觉签名，工具只检查可见文字，不评价审美。
- Steam `Playtime` 是分钟粒度；刚启动/刚退出的几分钟内可能滞后，按 §9.3 的延迟与手动按钮兜底。
- 主题 CSS 改动必须同步到 `%LOCALAPPDATA%\NOVA Game Space\themes\<id>`，否则实机仍是旧样式。
- Win7 / WebView2 109 下仍需单独验证（Magpie 需 Win10 1903+）。
