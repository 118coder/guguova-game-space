# NOVA · 主题接口总表（统一文件）

> 适用版本：**1.8.0**
>
> 每套主题的分文件在 [`docs/themes/`](themes/README.md)。本文是**跨主题的统一契约**：
> 清单、变量、选择器、按钮配方、开屏/进游戏接口与版本记录。
> 改任何主题前先读本文的「硬约束」，再读对应分文件。

---

## 1. 分层结构

```
src/index.html            静态 DOM：shell / 四个视图 / 浮层 / intro / launch / curtain
src/app.js                状态机：视图、选中、主题切换、标题适配、hero 变量
src/theme-engine.js       扫描 theme.json → 载入 theme.css → 写 data-fx-* 与 tokens
src/theme-kit.css         可选框架（hero=plate / header=rule / cards=rule / plates=off）
src/theme-fx.css          可选纹理/字体/面板/遮罩通道
src/fx-layers.css         Photoshop 式文本图层
src/fx-record.js          真实数据 → --nova-* 自定义属性
src/intro.js / intro.css  开屏 preset 注册表与舞台
src/motion.css            通用 launch、主题切换幕布、reduce-motion
src/compat.css            能力档位：full / balanced / safe 的降级覆盖
src/settings-themes.css   设置页控件与用户卡的每主题签名
themes/<id>/theme.json    主题清单（id / version / features / intro / tokens）
themes/<id>/theme.css     主题样式（基础层 → 修正层 → 签名层，后写覆盖先写）
themes/<id>/assets/       预览图 + 专属 SVG（不再内置字体）
docs/themes/<id>.md       单主题接口卡
```

**注入顺序（重要）**：`theme.css` 在框架样式之后注入。主题里用
`html[data-theme="<id>"]` 前缀 + 末尾追加 + `!important` 才能稳定覆盖。
`.scene.is-active > img` 的特异性是 `(0,2,1)`，主题必须写
`html[data-theme="<id>"] .scene > img` 才能压过它（RISO 曾因此整轮失效）。

---

## 1.1 能力档位（1.5.0）

`SystemProfile` 在 boot 写入 `html[data-tier]`，`compat.css` 在主题 CSS 之后注入：
`full` 全效果；`balanced` 关全屏模糊/颗粒/粒子；`safe` 再关开屏、背景装饰与重动画。
Win7 需要 Legacy `net48` 宿主 + WebView2 109，详见 [`COMPATIBILITY.md`](COMPATIBILITY.md)。

---

## 2. theme.json 清单接口

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 目录名一致；`nova` 为内置保留 |
| `name` | string | 主题选择器显示名 |
| `version` | string | 主题副本刷新依据；改 CSS 必须 bump |
| `description` | string | 卡片 title |
| `css` | string | 默认 `theme.css` |
| `preview` | string | 预览图相对路径（16:9） |
| `base` | `adaptive` / `system` | 字标配方基线 |
| `dark` | boolean | 是否深色主题 |
| `intro` | string | 开屏 preset id（见 §6） |
| `tokens` | object | 写到 `<html>` 的自定义属性（`--accent` 等） |
| `features` | object | 可选框架通道，见 §3 |

`features` 可用键（全部可选，不写 = 无副作用）：

| key | 值 | 作用 |
|---|---|---|
| `texture` | `photo` / `film` / `paper` / `riso` / `parchment` / `starfield` / `scanline` / `map` | 背景纹理 |
| `type` | `none` / `emboss` / `ink` | 字体图层 |
| `panel` | `none` / `folder` / `bracket` | 面板装饰 |
| `hero` | `plate` | 插画列 + 统一主视觉板（窄窗自动收起） |
| `header` | `rule` | 顶栏规则线 |
| `cards` | `rule` | 卡片规则线 |
| `plates` | `off` | 关闭旧签名层的伪元素（防压字） |
| `scrim` | `none` | 关闭框架压在 `.atmosphere` 之上的照片白纱 |

---

## 3. 变量契约

### 3.1 框架级
| 变量 | 来源 | 用途 |
|---|---|---|
| `--accent` / `--accent-2` / `--glow` | 主题 tokens / 封面分析 | 全局强调色 |
| `--scrim-rgb` | 主题 | 框架照片纱的颜色 |
| `--ease` | 主题/框架 | 统一缓动 |
| `--nova-hero` | **app.js 运行时** | 当前游戏主视觉 `url("...")`；用于肖像卡/印版照片 |
| `--nova-no` / `--nova-count` / `--nova-record` | fx-record.js | 真实档号 |
| `--nova-hours` / `--nova-minutes` / `--nova-launches` / `--nova-days` | fx-record.js | 真实时长/次数/天数 |
| `--nova-state` | fx-record.js | `new` / `played` / `missing` / `none` |
| `--logo-fit` | app.js fitLogo | 标题自适应缩放因子；主题写死 `font-size` 时必须乘它 |

### 3.2 主题级（约定，不是强制）
| 前缀 | 主题 | 例子 |
|---|---|---|
| `--t-*` | broadcast / riot / riso / codex / grimoire / mnemo / zerohour | `--t-paper`、`--t-ink` |
| `--cx-*` | codex | `--cx-gold`、`--cx-maroon` |
| `--gs-*` | grimoire | `--gs-gold`、`--gs-maroon` |
| `--su-*` | summer | `--su-ink`、`--su-lime` |
| `--dk-*` | dusk | `--dk-paper`、`--dk-ink`、`--dk-gold` |
| `--st-*` | steam | `--st-void`、`--st-blue`、`--st-green` |
| `--nf-*` | nightflight | `--nf-lime`、`--nf-cream`、`--nf-ink` |
| `--kit-*` | 使用 theme-kit 的主题 | `--kit-paper`、`--kit-art`、`--kit-art-url` |

---

## 4. 公共选择器注册表

### 4.1 Shell / 导航
| 选择器 | 说明 | 主题常见改法 |
|---|---|---|
| `.app` | 根网格 | 背景、网格行 |
| `.topbar` | 顶栏 | 背景/底边、时钟、窗口键 |
| `.brand` / `.brand-word` / `.brand-mark` | 品牌 | 隐藏 mark、换文字颜色 |
| `.nav` / `.nav-btn` / `.nav-btn.is-active` / `.nav-glide` | 主导航/滑动块 | 选中态色块、下划线 |
| `.icon-btn` / `.win-btn` / `.avatar-btn` / `.clock` | 工具/窗口控制 | 浅底主题必须回到深色 |
| `.content` | 三视图容器 | 不改 |
| `.view` / `.is-current` / `.is-leaving` | 视图过渡 | 主题不应重写 transition（性能） |

### 4.2 首页主视觉
| 选择器 | 说明 |
|---|---|
| `.stage` / `.hero` / `.hero-inner` | 主视觉舞台/板 |
| `.hero-inner::before` | 板底/边框/装饰（必须不压文字） |
| `.hero-inner::after` | 插画窗/肖像卡/蜡封；可用 `--nova-hero` |
| `.kicker` / `#kickerLabel` / `.kicker-dim` | 眉标 |
| `.hero-logo` / `.is-long-title` | 游戏名；长名 >14 字切两行规则 |
| `.tagline` | 一句话说明 |
| `.meta-row` / `.meta-dot` / `.age-badge` | 属性行 |
| `.cta-row` / `.btn.primary` / `.btn.ghost` | 主/次按钮 |
| `.progress-block` / `.progress-head` / `.progress-pct` / `.progress-track` | 进度/属性表 |
| `.activity-strip` | 辅助入口（多套已隐藏） |

### 4.3 Dock / 游戏库
| 选择器 | 说明 |
|---|---|
| `.dock` / `.dock-head` / `.all-btn` | 底部游戏带 |
| `.tile` / `.tile.is-active` / `.tile-art` / `.tile-name` / `.tile-sub` | 卡片 |
| `.lib-shell` / `.lib-head` / `.lib-search` / `.lib-meta` / `.lib-filters` / `.filter` | 游戏库 |
| `.lib-grid` / `.lib-card` / `.lib-art` / `.lib-name` / `.lib-en` / `.lib-sub` | 库卡片 |

### 4.4 外观 / 浮层
| 选择器 | 说明 |
|---|---|
| `.appearance-shell` / `.appearance-preview` / `.appearance-options` | 外观工作室 |
| `.appearance-bg` / `.appearance-image` / `.appearance-preview-copy` | 预览区 |
| `.theme-grid` / `.theme-card` / `.theme-preview` / `.theme-name` / `.theme-sub` | 主题选择器 |
| `.style-choice` / `.choice-logo` / `.pref-row` / `.switch` | 偏好控件 |
| `.overlay` / `.detail-modal` / `.dialog` / `.context-menu` / `.toast` | 浮层 |
| `.editor-shell` / `.scanner-shell` / `.sleep` | 编辑器/扫描器/睡眠 |
| `.launch` / `.launch-art` / `.launch-copy` | 进游戏 |
| `.intro` / `[data-intro="<id>"]` | 开屏 |
| `.theme-curtain` | 主题切换幕布（框架级） |

---

## 5. 按钮配方（每套主题独立）

| 主题 | 主按钮 | 次按钮 | 关键实现 |
|---|---|---|---|
| nova | 封面渐变 + 柔光 | 细描边 | `cta-palettes.css` + `cta-adaptive` |
| aurum | 暗金渐变 | 金线描边 | 双层金线、无大圆角 |
| endfield | 酸黄底黑字 | 纸底细线 | 切角 |
| zerohour | 青柠底黑字 | 青柠描边 | 硬边、扫描线 |
| codex | 浅金底深褐字 | 金线描边 | 衬线 600 |
| broadcast | 黑平块白字 | 透明细线 | 零圆角 |
| summer | 黑块白字 | 黄块黑字 | 零圆角、无柔光 |
| riso | 酸黄底黑字 + 蓝硬影 | 白底墨框 | 硬偏移 |
| riot | 黑块白字 + 红硬影 | 白底黑框 | 硬偏移 |
| grimoire | 酒红底米白字 + 金内线 | 羊皮纸金线 | 硬偏移 |
| mnemo | 梅红/靛紫 | 档案标签 | 切角/小圆角 |
| dusk | 陶土红压印 | 纸白墨线 | 2px 圆角 + 金边内线 |
| steam | 绿色渐变 | 白/蓝细描边 | 3px 圆角 + 内高光；牌外用蓝边 |
| nightflight | 荧光黄绿平涂 + 墨硬影 | 墨线（牌面）/ 荧光边（牌外） | 零圆角 + 4px 偏移 |

> 按钮不再走统一 `controls=hard`。新增主题请直接在自己的 `theme.css` 写
> `.btn.primary` / `.btn.ghost`，并在分文件登记。

---

## 6. 开屏（intro）接口

- 注册：`src/intro.js` 的 `register(id, { label, duration, hint, setup })`。
- 舞台：`setup(overlay)` 里 `overlay.classList.add('intro-<name>')` 并插入自定义 stage。
- 清理：所有自定义 stage 类必须加入 `STAGE_SELECTOR`（否则重放会叠图）。
- 隐藏基础件：`.intro.intro-<name> :is(.intro-stage, .intro-emblem, .intro-word, .intro-sub, .intro-meter, .intro-cap) { display:none }`。
- 真实数据：`introData()` 提供日期/时间/游戏数；不要在舞台上编造数值。
- 可重放：`window.NovaIntro.play({ intro: 'codex' })`；`play` 会清理旧 stage 与待删除定时器。

当前 11 套 preset：

| 主题 | preset | 结构 |
|---|---|---|
| nova | `gilded` | 星核：轴线 + 三层菱形描边 + 粒子汇聚 + NOVA 字标 |
| aurum | `aurum` | 金门：左右门板滑开 + 放射光环 + 鎏金菱形点 |
| endfield | `endfield` | 启动序列：制图网格 + 实心/空心字 + 真实时钟 + 字段 |
| zerohour | `zerohour` | CRT：扫描线 + 信号字段 + 分段轨 |
| codex | `codex` | 星轨展开：卷轴 scaleX + 星座描线 + 罗盘针 |
| broadcast | `broadcast` | 调频：刻度扫过 + ON AIR |
| summer | `draft` | 制图：线稿自绘 + 黑/黄字块 |
| riso | `riso` | 三色套印：蓝/黄/品红版落位 + 错位字 |
| riot | `vinyl` | 黑胶升速 + 红圈落定 |
| grimoire | `seal` | 归档：火漆盖章 + 真实档号 |
| mnemo | `mnemo` | 解密：档案字段 scramble + CLASSIFIED |
| dusk | `dusk` | 暮色开工：天幕压下 + 太阳升起 + 远山 + 炼金环描线 + 羊皮纸展开 + 火漆印 |
| steam | `steam` | 大屏启动：字标升起 + 蓝色进度 + 封面滑入 + 焦点环落定 |
| nightflight | `nightflight` | 离港：星图 + 跑道中线 + `NIGHT FLIGHT` 分瓣字 + 航班行 |

---

## 7. 进游戏（launch）接口

规则统一写在 `.launch.is-open .launch-art` 的 `animation` 上；每套主题一个独立关键帧。

| 主题 | 关键帧 | 语言 |
|---|---|---|
| nova | `nvLaunch` | 变形宽银幕细缝张开 |
| aurum | `auLaunch` | 菱形光圈 |
| endfield | `efLaunch` | 工业闸门 |
| zerohour | `zhLaunch` | CRT 同步抖动 |
| codex | `cxIris` | 菱形虹膜 |
| broadcast | `bcSweep` | 扫描揭示 |
| summer | `suShutter` | 相机快门 |
| riso | `rsRoll` | 油墨滚过 |
| riot | `rtDrop` | 唱片落盘 |
| grimoire | `grStamp` | 火漆盖章 |
| mnemo | `mnUnfold` | 卷宗展开 |
| dusk | `dlDusk` | 炼金环从画面中心张开 |
| steam | `stMax` | 窗口撑满全屏 |
| nightflight | `nfLaunch` | 跑道灯加速 / 方形缝隙张开 |

---

## 8. 主题切换接口（框架级）

- DOM：`#themeCurtain`（两片幕布 + 主题色缝线 + 目标主题名）。
- JS：`src/app.js` 的 `playThemeCurtain()` / `revealThemeCurtain()`；在换样式表前覆盖，换完后两帧再揭开。
- 变体：`playThemeCurtain()` 写入 `#themeCurtain.dataset.variant = <themeId>`；
  `src/motion.css` 的 “PER-THEME SWITCH CHOREOGRAPHY” 段按变体定义覆盖/揭开。
- 时长：`CURTAIN_HOLD` 按变体给出 340–430ms；必须 ≥ 覆盖动画最长时长。
- 约定：只动 `transform / clip-path / opacity`，禁止给全屏层加 `filter`/`backdrop-filter`；
  全屏圆扩散半径用 ≥240%，全屏位移用 101%，确保四角完全遮住。
- 新增主题必须提供自己的 `data-variant` 视觉；不允许直接复用另一主题的幕布。
- 降级：`prefers-reduced-motion` 或 `data-tier="safe"` 时直接切换，不播幕布。
- 缓存：`theme-engine.js` 会按 URL 缓存 CSS；`refresh()` 清空缓存。主题 CSS 改动后必须：
  1. `theme.json` bump `version`；
  2. 同步到 `%LOCALAPPDATA%\NOVA Game Space\themes\<id>`；
  3. 重启（或点「刷新」清缓存）。
- 排序：固定前四 `nova → endfield → zerohour → codex`；其余按使用次数，只在启动时排序一次，
  会话内不再重排；活动主题不在可见范围时**追加**而不是替换最后一张卡。

### 8.1 切换编舞表

| variant | 动作 | 覆盖 |
|---|---|---|
| `nova` | 上下双幕布 + 中央光缝 | 360ms |
| `aurum` | 左右青铜门 + 竖金缝 + 门环 | 400ms |
| `endfield` | 蓝图面板横向推进 + 信号条 | 380ms |
| `zerohour` | 漫画分页：黑板 + 白框分镜 + 青柠字幕带 | 420ms |
| `codex` | 整页 3D 翻下/翻开 | 430ms |
| `broadcast` | CRT 开关机（闪白 → 横线） | 360ms |
| `summer` | 白纸印版扫入 + 黑/黄块压版 | 470ms |
| `riso` | 蓝/纸双印版反向错位 | 380ms |
| `riot` | 朱红舞台幕布 + 撕胶带缝 | 380ms |
| `grimoire` | 羊皮纸页上升 + 蜡封落下 | 650ms |
| `mnemo` | 纵向记忆条带 + 紫色重影 | 360ms |
| `dusk` | 信封拆开：信纸升起 + 三角封盖折回 + 红绳收紧 | 460ms |
| `steam` | 游戏 tile 从中心放大到全屏 + 焦点环 + 蓝线 | 440ms |
| `nightflight` | 登机口关闭：上下深夜蓝面板 + 中央奶油登机牌带 + 荧光扫描线 + 翻牌主题名 | 560ms |

### 8.2 字体契约

- 全主题统一使用本机 **思源黑体 CN Medium / 思源宋体**；不内置西文字体。
- 主题必须覆盖以下变量（可在 `:root` 或 `html[data-theme]` 中声明）：
  - `--font-ui`：正文/控件，思源黑体 Medium；
  - `--font-display`：标题，按主题配思源黑体 Medium 或思源宋体 Medium；
  - `--font-serif`：衬线正文，思源宋体；
  - `--font-condensed`：大号标签，按主题配黑体或宋体。
- 推荐栈（直接复制，避免 Regular 家族名在 WebView2 中不命中的问题）：
  `"思源黑体 CN Medium", "Source Han Sans CN Medium", "Noto Sans SC Medium", "Microsoft YaHei UI", "Microsoft YaHei", sans-serif`
- 衬线栈：
  `"思源宋体", "Source Han Serif SC", "Noto Serif SC", "Songti SC", "SimSun", serif`
- 不再新增 `@font-face` 指向主题目录字体；需要特殊字体时用 `local()` 或随包附带 OFL 字体并登记许可。

---

## 9. 界面覆盖清单

| 界面 | DOM | 必查 |
|---|---|---|
| 首页 | `#homeView` | 标题 30 字、进度、活动条、dock |
| 游戏库 | `#libraryOverlay` | 搜索/筛选/卡片/空态 |
| 外观 | `#appearanceOverlay` | 预览、主题网格、偏好、字标 |
| 设置 | `#settingsView` | 全宽双栏控制台；玩家名、关闭到托盘、自动备份、数据包/CSV、统计；控件与用户卡样式在 `settings-themes.css` 按主题覆盖 |
| 详情 | `.overlay` + `.detail-modal` | 统计格数值、路径、按钮 |
| 启动 | `.launch` | 背景、标题、状态、退出 |
| 开屏 | `.intro` | 舞台、跳过提示、reduce-motion |
| 编辑器 / 扫描器 | `.editor-shell` / `.scanner-shell` | 表单、按钮、路径 |
| 右键 / 通知 / Toast | `.context-menu` / `.toast` | 跟随主题、不压字 |
| 睡眠 | `.sleep` | 时间、日期、提示 |
| 主题切换 | `.theme-curtain` | 覆盖/揭开、无闪烁 |

---

## 10. 新增主题流程

1. 复制一个主题目录，改 `id` / `name` / `version` / `preview`。
2. 在 `theme.json` 里只声明需要的 `features`，不要全开。
3. 在 `theme.css` 末尾写签名层；清理旧装饰的规则必须放在**文件末尾**。
4. 在 `src/intro.js` 注册新 preset，并把舞台类加入 `STAGE_SELECTOR`。
5. 在 `theme.css` 写 launch 关键帧。
6. 生成 16:9 预览图，更新 `assets/preview.jpg`。
7. 跑 `export-all.js`（含 `--stress`）与 `probe-graphics.js`。
8. 在 `docs/themes/<id>.md` 登记接口与设计理念；更新本文件版本表。

---

## 11. 版本表（2026-10-21 / 1.9.0）

| 主题 | 版本 | features | intro | launch |
|---|---|---|---|---|
| nova（内置） | 2.0.1 | — | gilded | nvLaunch |
| aurum | 1.0.15 | — | aurum | auLaunch |
| endfield | 1.0.11 | — | endfield | efLaunch |
| zerohour | 1.0.14 | scanline / bracket | zerohour | zhLaunch |
| codex | 1.7.7 | starfield / plate / rule / plates-off | codex | cxIris |
| broadcast | 1.4.8 | film / plate / rule / plates-off | broadcast | bcSweep |
| summer | 1.8.9 | photo / plate / rule / plates-off / scrim=none | draft | suShutter |
| riso | 1.4.7 | riso / plate / rule / plates-off | riso | rsRoll |
| riot | 1.5.9 | paper / ink / plate / rule / plates-off | vinyl | rtDrop |
| grimoire | 1.5.9 | parchment / plate / rule / plates-off | seal | grStamp |
| mnemo | 1.1.9 | map / emboss / folder | mnemo | mnUnfold |
| dusk | 2.0.10 | —（自带版式，不用 theme-kit） | dusk | dlDusk |
| steam | 2.0.10 | —（自带版式，不用 theme-kit） | steam | stMax |
| nightflight | 1.0.11 | —（自带版式，不用 theme-kit） | nightflight | nfLaunch |

静态资源版本：`src/index.html` 的 `?v=1.14.0`。应用版本：**1.14.0**。主题版本：dusk / steam **2.0.10**，nightflight **1.0.11**，zerohour **1.0.15**，summer **1.8.12**。

---

## 12. 硬约束与坑（每轮验收）

1. **文字不被图形压住**：伪元素、装饰层、插画窗都不得进入文字盒；装饰出血用 `probe-graphics.js` 验证。
2. **文字不截断**：标题用 `.is-long-title` 两行；主题写死 `font-size` 时必须乘 `var(--logo-fit,1)`；禁止 `nowrap + ellipsis`。
3. **30 字长名**：`export-all.js --stress` 必须在 1439×1124 与 960×600 都通过。
4. **`.scene > img` 覆盖**：主题选择器必须带 `html[data-theme]`，否则被 `.scene.is-active > img` 压掉（RISO 教训）。
5. **底图被 `.scene` 盖住**：`body::before` 的纹理在不透明 `.scene` 下不可见；纹理要放到 `.scene-stack::after` / `.atmosphere`。
6. **主题 CSS 缓存**：改完 bump `version` + sync + 重启/刷新；否则实机还是旧样式。
7. **调试彩色层**：交接前搜 `DEBUG-PROBE`，必须删干净。
8. **不要用柔光/玻璃模糊/大发光**（项目铁律）；`backdrop-filter` 只允许小面积，禁止全屏视图。
9. **主题切换排序**：只允许启动时按使用次数排序；会话内必须稳定。
10. **禁止模糊（DUSK / STEAM / NIGHTFLIGHT）**：外观预览、详情头图、launch 底、
    所有 overlay / 弹层一律不得出现 `filter: blur()` 或 `backdrop-filter`；
    预览底图改为主题实色/渐变，overlay 用实色遮罩。
11. **预览图**：16:9。常规流程来自 `tools/theme-concepts.html` 的**设计概念板**，
    用 `render-concepts.js` 渲染后缩到 960×540；本轮 dusk / steam / nightflight 三套
    因整体重做，预览图暂由实机首页裁成 16:9（960×540），下一轮再补概念板版本。


---

## 13. 主题文案词典（1.13.0）

`theme.json` 可声明固定短语的替换，不接管布局：

```json
"lexicon": { "lastPlayed": "上次委托" }
```

| 键 | 用在哪 | 回退 |
| --- | --- | --- |
| `lastPlayed` | 首页眉标 / 进度标题的“上次游玩 …” | `上次游玩` |

- 渲染侧：`src/app.js` 的 `themeWord(key, fallback)`，读取 `window.NovaTheme.activeId` 对应 manifest；
- 缺失/空白键回退共享文案，不允许把 UI 文案变空；
- 当前使用：DUSK → `上次委托`；
- 新增键必须同步本表与 `docs/THEME-DESIGN-SPEC.md` §8。

## 14. 共享控件令牌（1.13.0）

| 控件 | 令牌前缀 | 定义位置 | 规范 |
| --- | --- | --- | --- |
| 全局下拉 `.nova-select` | `--menu-*` | `themes/<id>/interfaces.css` | `docs/THEME-DESIGN-SPEC.md` §5.1 |
| 缩放引擎 `.engine-shell` | `--sheet-*` | `themes/<id>/interfaces.css` | §5.2 |
| 首页全屏缩放行 `.hero-scale` | `--hs-*` | `themes/<id>/interfaces.css` | §5.3 |
| 取景浮层 `.appearance-framing` | `--af-*` | `themes/<id>/interfaces.css` | §5.4 |
| 算法选择行 `.engine-mode-row` | `--mode-*` | `themes/<id>/interfaces.css` | §5.5 |
| 可读强调文字 | `--accent-text` | `themes/<id>/interfaces.css` | §3.2 |
| 游玩时长阶梯（1.16.3） | `--prog-*` | `themes/<id>/theme.css`（主题根选择器声明锚点） | §16.4 末段 |

> 1.16.0 起这些令牌不再写在共享表里，改由各主题的 `interfaces.css` 提供，
> 详见 §16。共享表只保留消费方（`.engine-shell` 等结构规则）与默认值。

> 新增主题必须同时提供 `--menu-*`、`--sheet-*`、`--hs-*`、`--af-*`、
> `--mode-*`、`--accent-text`；只写 `theme.css` 会让这些控件退回共享默认外观。
> `node tools/theme-slot-check.js` 会逐个主题列出缺失项。

> **`--prog-*`（1.16.3）是可选插槽**（照 `--hold-fill` 模式）：JS
> （`src/app.js` PLAYTIME LADDER 区块）按 21 个游玩时长里程碑在每条进度
> 轨道容器上内联发布 `--prog-fill`（主色，**纯色**——Owner 定版：双色
> 渐变在 2px 条上显脏，点亮后一律平涂）/ `--prog-fill-soft`（向白混
> 34%，只给 `is-active` 等状态变体提亮用）/ `--prog-fill-deep`（向黑混
> 34%）/ `--prog-glow`（rgba 光晕）与 `data-prog-tier="0..21"`；**tier 0
> 不发布变量**，各表面回落到自己的基色（[0, 50h) 视觉与历史版本逐像素
> 一致，原始渐变照旧）。主题在自己 `theme.css` 的根选择器声明
> `--prog-l0..l5` 六个锚点（21 个节点按区间均分插值：50–200 → l0→l1，
> 300–1000 → l1→l2，1500–5000 → l2→l3，6000–9000 → l3→l4，10000 → l5），
> 并在既有轨道覆盖里把填充写成 `var(--prog-fill, 原表达式)`——fallback
> 放原渐变或原色，点亮即纯色。
>
> **插值在 HSL 最短弧上进行**（色相走短弧、饱和度/明度线性），相邻锚点
> 必须拉开 **90°+ 色相弧**（或大饱和度/明度摆幅）——Owner 定版：节点间
> 颜色必须一眼可辨，不允许"五档几乎同一个色"。双色族主题（金/红宝石、
> 酒红/金）靠明度大摆幅代替色相。未声明锚点的主题由 JS 从 `--accent` /
> `--accent-2`（nova 则从封面色对，逐级提亮）派生整条阶梯。锚点值必须是
> 能被 `getComputedStyle` 解析为纯色的写法（hex / rgb()，可引用自家令牌）。

> 1.16.0 起这些令牌不再写在共享表里，改由各主题的 `interfaces.css` 提供，
> 详见 §16。共享表只保留消费方（`.engine-shell` 等结构规则）与默认值。

> 新增主题必须同时提供 `--menu-*`、`--sheet-*`、`--hs-*`、`--af-*`、
> `--mode-*`、`--accent-text`；只写 `theme.css` 会让这些控件退回共享默认外观。
> `node tools/theme-slot-check.js` 会逐个主题列出缺失项。

## 15. 启动界面交互（1.13.0）

- 键盘只有 **Esc** 退出；点击遮罩、A、Enter、空格、任意键都不关闭；
- 手柄 B / ○ 等价 Esc；A / ✕ 不关闭；
- 提示：`按 Esc 退出`；
- 实现在 `src/app.js` 的 `bindKeyboard`、`closeLaunch`、pad `back()`，不要在遮罩上重新挂 click。

---

## 16. 接口式映射架构（1.16.0）

> 这一节是「换主题只映射接口」的实现契约。改主题前先读它；
> 改共享样式前先看 §16.5 的红线。

### 16.1 为什么改了

1.15.0 之前，主题知识散在三份共享样式表里（`app.css` 111 处、
`settings-themes.css` 214 处、`type.css` 30 处 `html[data-theme="…"]`），
另有三处 JS 常量（幕布时长、固定主题排序）。

后果：**每新增一套主题，都要改主代码**。共享表越来越难维护，
而且一次 `refactor` 就可能悄悄改变某个主题的层叠胜负。

现在：**共享样式表不再出现任何具体主题 id**，
每套主题把自己的材质映射写在 `themes/<id>/interfaces.css`。

### 16.2 三份文件，三种职责

| 文件 | 归属 | 内容 |
| --- | --- | --- |
| `src/theme-slots.css` | 共享 | 插槽的容器规则（如 `.settings-id { position: relative }`）与引擎弹窗内部令牌的重新绑定 |
| `themes/<id>/interfaces.css` | 主题 | 该主题在每个插槽上的材质、墨色、圆角、字体、强调色 |
| `src/theme-nova.css` | 内置主题 | nova 没有主题目录，它的映射作为渲染层文件随包分发 |

> 三者都不含布局与行为。布局在 `base/views/dialogs/motion`，
> 行为在 `app.js`。**主题只能决定「长什么样」，不能决定「怎么动」。**

### 16.3 加载顺序（改动前务必确认）

```
base.css → theme.css → … → app.css → views.css → … → theme-slots.css
      → interfaces.css → theme.css(主题自己的) → compat.css
```

要点：

- `interfaces.css` 在**主题自己的 `theme.css` 之前**。这不是随意选的：
  历史上这些规则就活在共享表里，本来排 `theme.css` 之前；
  调换顺序会改变胜负（1.16.0 实测：DUSK 设置卡底色、STEAM 设置卡整体变样）。
- `compat.css` 永远最后，能力降级（`data-tier`）压过一切主题材质。
- `theme-nova.css` 与 `interfaces.css` 同层，由 `theme-engine.js` 内联注入。

### 16.4 插槽清单

| 插槽 | DOM 锚点 | 令牌族 | 默认来自 |
| --- | --- | --- | --- |
| 主题菜单 | `.nova-select-menu` | `--menu-*` | `app.css` `.nova-select-*` |
| 引擎弹窗 | `.engine-shell` | `--sheet-*` | `app.css` `.engine-shell` |
| 全屏缩放行 | `.hero-scale` | `--hs-*` | `app.css` `.hero-scale` |
| 取景浮层 | `.appearance-framing` | `--af-*` | `app.css` `.appearance-framing` |
| 算法选择行 | `.engine-mode-row` | `--mode-*` | `app.css` `.engine-mode-row` |
| 启动方式芯片 | `.steam-mode` | `--sm-*` | `app.css` `.steam-mode`（默认吃 `--hair` / `--accent`，纸面主题不开映射也可读） |
| 设置控件 | `.settings-field` / `.settings-stat` / `.session-row` | 可读色 | `views.css` 的 `--ink` / `--muted` |
| 用户卡 | `.settings-id` | 可读色 | `views.css` |
| 强调文字 | 全局 | `--accent-text` | `app.css` §「accent as a marker」 |
| 强调底色上的字 | 全局 | `--accent-on` | `app.js` `readableOn()` |
| 启动动画 | `.launch.is-open .launch-art` | `animation` | `motion.css`（关键帧全局） |

`--sm-*`（1.16.3 新增）成员：`--sm-radius / --sm-border / --sm-ink / --sm-bg /`
`--sm-hover-border / --sm-hover-bg / --sm-hover-ink / --sm-active-border /`
`--sm-active-bg / --sm-active-ink / --sm-focus`。默认值从 `--hair` / `--accent`
派生，所以不映射也能用；endfield 在自己的 `interfaces.css` 里给了
「选中 = 实心信号黄 + 墨字」的签名配方。激活底色上的字必须用
`--sm-active-ink`，不得借用 accent 当文字。

**两种合法的映射写法**，插槽检查器都接受：

```css
/* A. 直接改材质（主题完全接管这个面） */
html[data-theme="endfield"] .engine-shell { --sheet-bg: #fff; --sheet-ink: #161616; }

/* B. 只喂令牌（主题沿用共享结构，只换值） */
html[data-theme="endfield"] { --hs-bg: var(--ef-panel); --hs-mark: var(--ef-signal); }
```

### 16.5 红线

1. **共享表里禁止出现 `html[data-theme="<具体 id>"]`**。
   要按主题区分 → 写进该主题的 `interfaces.css`。
   `html[data-theme]`（无值）是合法的「所有主题通用」选择器。
2. **`interfaces.css` 只能引用自己的 id**，不能替别的主题写规则。
3. **`@keyframes` 留在共享表**：它是行为名，不是主题名。
4. **一个插槽没映射 = 回到共享默认**，这是设计好的降级，不是错误。
   但颜色类插槽（`--sheet-*` / `--hs-*` / `--af-*` / `--mode-*` /
   `--accent-text` / `--menu-*`）漏掉会让该控件退回为另一个主题调好的默认值，
   所以检查器把它们视为必须项。
5. **不要为了「纯」而把布局搬进主题**：主题换主题时布局必须稳定。

### 16.6 清单新字段

| 字段 | 类型 | 作用 |
| --- | --- | --- |
| `interfaces` | string | 映射文件相对路径，缺省 `interfaces.css`，文件不存在则用共享默认 |
| `curtainMs` | number | 幕布合拢时长（200–1200，越界取 420）。**必须 ≥ 该主题覆盖动画最长时长** |
| `pinned` | number | 外观网格固定位次（1 = 最前）；不写则按使用次数排序 |

`app.js` 不再有 `CURTAIN_HOLD` 表与 `THEME_PREFIX` 常量——都从清单读。

### 16.7 验证

```bash
node tools/theme-slot-check.js --strict   # 契约守门：共享表无主题 id、每套主题有映射
node tools/headless-shots.js --themes=all --views=all   # 视觉
NOVA_CDP_PORT=9333 node tools/audit-contrast.js          # 静态对比度
NOVA_CDP_PORT=9333 node tools/audit-hover.js             # 悬停对比度
```

`theme-slot-check.js` 应保持 0 finding。它是防止「主题知识回流到共享表」的唯一自动闸门。

### 16.8 新增主题的最小步骤（1.16.0 起）

1. 复制 `themes/<existing>/` 为 `themes/<new>/`；
2. 改 `theme.json` 的 `id` / `name` / `version` / `preview` / `curtainMs` / `pinned`；
3. 重写 `theme.css`（美术方向）与 `interfaces.css`（插槽映射）；
4. `node tools/theme-slot-check.js` 必须 0 finding；
5. 跑无头截图与两条对比度审计。

**不需要改 `src/` 下任何文件。** 这是本轮改造的唯一目的。

### 16.9 分享卡片插槽（2026-11-10 新增）

相机按钮不再只导整页长图，而是先开「导出卡片」弹窗，三种固定尺寸：

| 版式 | 尺寸 | 构图 |
| --- | --- | --- |
| `poster` 封面海报 | 1600 × 900 | 全幅封面 + 左下信息 + 右下时长牌 |
| `dossier` 档案卡 | 1200 × 1500 | 56% 画框封面 + 下方资料页 |
| `score` 战绩卡 | 1600 × 840 | 左 40% 封面 + 右侧巨型时长与 21 格里程碑 |

DOM 锚点是 `.share-card`，画布与通用排版在 `src/share-cards.css`
（**共享表，不认主题 id**）。**构图与材质都在主题里**：每套主题在自己的
`interfaces.css` 末尾写一个 `CARD CHARACTER` 块，用自己的方式摆放封面、资料页、
时长与装饰（endfield 是规格纸、nightflight 是登机牌、grimoire 是角色卡……）。
只写 `--sc-*` 而不写构图，会得到「同一张卡换配色」——Owner 已明确不接受。

主题可用的共享钩子：

| 钩子 | 用途 |
| --- | --- |
| `.sc-deco` | 装饰层（胶带、条码、网点、扫描线、裁角） |
| `.share-card::before` | 顶缘色带，`--sc-strip-h` + `--sc-strip` |
| `.sc-frame::after` | 内线，`--sc-frame-inner` |
| `[data-no]` / `[data-total]` | 库内编号（卡片和 `.sc-sheet` 上都有），幽灵水印 |
| `.sc-sheet { isolation: isolate }` | 水印用 `z-index:-1` 会落在纸面上、文字下 |

必填（漏了会落到别的主题的默认值，属于缺陷）：

| 令牌 | 作用 |
| --- | --- |
| `--sc-bg` | 卡片底色（也是 veil 的收尾色） |
| `--sc-ink` / `--sc-ink-2` | 主文字 / 次级文字（**必须是颜色，不用 opacity**） |
| `--sc-rule` | 发丝线（页脚上边、分隔） |
| `--sc-accent` / `--sc-accent-ink` | 信号色 / 压在信号色上的字 |
| `--sc-plate` / `--sc-plate-line` | 时长牌与标签芯片的底 / 边 |
| `--sc-sheet-bg` / `--sc-sheet-line` | 资料页（dossier、score 右栏）的底 / 边 |
| `--sc-radius` | 卡片内所有圆角（0 = 硬边主题） |
| `--sc-scrim-rgb` | 压暗/提亮用的 RGB 三元组（`247, 237, 216`）。纸面主题填纸色，veil 会把封面**提亮**成纸 |
| `--sc-veil` / `--sc-veil-x` | 竖向 / 横向压暗层。纸面主题必须是浅色，否则深罩会把纸卡洗成脏灰 |

可选签名令牌：`--sc-title-font / -size / -weight / -tracking / -transform`、
`--sc-label-font / -tracking / -transform`、`--sc-num-font / -tracking`、
`--sc-frame-line / -w / -inset`、`--sc-frame-inner`（双线框内线）、
`--sc-strip-h` + `--sc-strip`（卡片顶缘色带）、`--sc-plate-shadow`、
`--sc-cut`（clip-path 裁角）、`--sc-title-size-dossier` / `-score`。

两条硬规则：

1. **底与字成对声明**。只改 `--sc-ink` 不改 `--sc-sheet-bg` 会产生白底白字；
   纸面主题必须同时把 `--sc-scrim-rgb` / `--sc-veil` 换成浅色。
2. **不要在卡片里用 `opacity` 做次级文字**，用 `--sc-ink-2` 的颜色。

验收：`node tools/_share-preview.tmp.js`（渲染 14 套 × 3 版式，出图到
`../_shots/share-all/`）与真机导出（`tools/_share-e2e.tmp.js`，走宿主
`capturePage` 的 `exact:true`，导出像素 = 设计尺寸 × 屏幕缩放）。

### 16.10 沉稳模式的「身份板」插槽（2026-11-10 新增）

沉稳模式（`html.calm`）把左侧信息簇画在一张**紧凑底板**上，
锚点是 `.hero-inner::before`（共享几何在 `src/theme-slots.css`）。
这是为了让主题材质回到沉浸页面——上一版把底板全删了，14 套看起来一模一样。

| 令牌 | 作用 |
| --- | --- |
| `--im-plate-bg` / `-border` / `-radius` / `-shadow` / `-clip` | 板子的材质与形状 |
| `--im-plate-pad` / `-pad-x` | 板子相对文字的留白（负 margin 实现） |
| `--im-plate-ink` / `-ink-dim` | **板上的**文字色；与 `--im-ink`（封面/图标带）分开 |
| `--im-plate-text-shadow` | 深色板保留封面投影，纸面板设 `none` |
| `--im-chip-bg` / `-border` / `-radius` / `-ink` / `-pad` | 年龄分级芯片（原「12+」红框） |
| `--im-count-ink` | 图标带上的「N 款」文字色（原红框之一；底板一律去掉） |
| `--im-topbar-ink` | 沉稳模式顶栏文字色（纸面顶栏配深字，深色顶栏配浅字） |
| `--im-title-ceiling` | 标题字号上限（默认 34px） |
| `--im-kicker-ink` / `-dim` / `-tracking` / `-transform` | 眉标（不再有底板） |

要点：

1. **板与字成对**：纸面板（endfield / dusk / summer / riot / riso / mnemo /
   grimoire / broadcast）必须同时给 `--im-plate-ink` 深墨与
   `--im-plate-text-shadow: none`，否则深墨加封面投影会糊。
2. **`--im-topbar-bg` 的 alpha 要够**（≥ .8）：顶栏压在封面上，半透明会让
   浅字掉到 2:1。浅色顶栏的主题给深字（`--im-topbar-ink`）。
3. **眉标、标签行、tagline 在沉稳模式一律无底色**：主题在窗口模式给它们画的
   色带/贴纸必须在 `calm` 下归零，否则会变成 1200px 的长条（zerohour 的荧光
   眉标、summer 的深色 tagline 条都踩过）。
4. **`--im-ink` 与 `--im-plate-ink` 不能混用**：图标带在封面底部，板上文字在
   纸面上，两者明暗可以相反。
