# NOVA · 主题接口总表（统一文件）

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
| `zerohour` | 斜切漫画面板 + 危险条 + 网点 | 420ms |
| `codex` | 整页 3D 翻下/翻开 | 430ms |
| `broadcast` | CRT 开关机（闪白 → 横线） | 360ms |
| `summer` | 白纸印版扫入 + 黑/黄块压版 | 470ms |
| `riso` | 蓝/纸双印版反向错位 | 380ms |
| `riot` | 朱红舞台幕布 + 撕胶带缝 | 380ms |
| `grimoire` | 羊皮纸页上升 + 蜡封落下 | 650ms |
| `mnemo` | 纵向记忆条带 + 紫色重影 | 360ms |

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

## 11. 版本表（2026-10-19）

| 主题 | 版本 | features | intro | launch |
|---|---|---|---|---|
| nova（内置） | 2.0.0 | — | gilded | nvLaunch |
| aurum | 1.0.8 | — | aurum | auLaunch |
| endfield | 1.0.4 | — | endfield | efLaunch |
| zerohour | 1.0.7 | scanline / bracket | zerohour | zhLaunch |
| codex | 1.7.1 | starfield / plate / rule / plates-off | codex | cxIris |
| broadcast | 1.4.1 | film / plate / rule / plates-off | broadcast | bcSweep |
| summer | 1.8.3 | photo / plate / rule / plates-off / scrim=none | draft | suShutter |
| riso | 1.4.1 | riso / plate / rule / plates-off | riso | rsRoll |
| riot | 1.5.3 | paper / ink / plate / rule / plates-off | vinyl | rtDrop |
| grimoire | 1.5.1 | parchment / plate / rule / plates-off | seal | grStamp |
| mnemo | 1.1.2 | map / emboss / folder | mnemo | mnUnfold |

静态资源版本：`src/index.html` 的 `?v=1.5.1`。

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
10. **预览图**：16:9，必须来自 `tools/theme-concepts.html` 的**设计概念板**（默认 NOVA 为版式基准），不能直接截应用图；用 `render-concepts.js` 渲染后缩到 960×540。
