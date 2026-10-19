# NOVA 主题精修 · 交接简报（2026-10-19 / v1.3.11）

> 给接手精修的 AI。**先读这一页**，再按需读 `docs/HANDOFF.md`（项目全貌）、
> `docs/THEMES.md` 第 15 节（特征框架与量化方法）、`docs/THEME-COVERAGE.md`（界面清单）。
>
> 本文只讲一件事：**这轮主题精修已经做到哪、还差什么、怎么接着做。**
>
> **交接状态（一句话）**：九套可改主题里 SUMMER / BROADCAST / RISO / RIOT / GRIMOIRE / CODEX
> 已完成本轮重设计（各有专属构图与开场/进游戏动画），**MNEMO 是下一个**；
> AURUM 已按用户要求还原（1.0.6），默认 / 终末地 / 零点街区不动。
> 先读 §0.00（本轮总览 + 铁律 + 坑 + 下一轮任务清单），§0.1~0.6 的框架坑与量化方法仍然必读。

---

## 0.00c 2026-10-19 · v1.5.1 切换编舞 / 思源字体 / 设置控制台 / 音效（**最新，先读这一段**）

> 本节覆盖 0.00b 及更早记录。旧文中的 Cormorant / Saira / Manrope 等字体名只代表
> 当时的西文字形；v1.5.1 起全主题统一使用思源黑体 / 思源宋体。

### 一句话状态

11 套主题各自拥有**完全不同的主题切换动画**；全主题字体换成思源黑体 / 思源宋体
（标题与正文按主题配对）；设置页改为全宽双栏控制台，用户卡按 11 套主题分别设计；
RIOT 主题正式更名为「舞台残响 · RIOT」；界面音效换成 Kenney Interface Sounds（CC0）。

### 1. 主题切换编舞（`data-variant`，不再共用同一套幕布）

`app.js` 的 `playThemeCurtain()` 把目标主题 id 写到 `#themeCurtain.dataset.variant`，
`motion.css` 按变体定义覆盖/揭开两段动画。每个变体只动 `transform / clip-path / opacity`，
不碰 `filter`，避免切换时重栅格化全屏。

| 主题 | 切换动作 | 时长（覆盖） | 视觉记忆点 |
|---|---|---|---|
| NOVA | 上下双幕布合拢 + 中央光缝 | 360ms | 电影遮幅 |
| AURUM | 左右青铜门合拢 + 竖金缝 + 门环 | 400ms | 鎏金圣所大门 |
| ENDFIELD | 蓝图面板从左横扫，右侧信号条 + 切角 + 三色条 | 380ms | 工程图纸推进（endfield-ui 规则） |
| ZERO HOUR | 斜切硬边面板从上砸下 | 340ms | 夜间施工挡板 |
| CODEX | 整页绕顶边 3D 翻下 / 翻开 | 430ms | 书页翻动 |
| BROADCAST | CRT 开机闪白 → 关机收成横线 | 360ms | 老电视 |
| SUMMER | 白纸印版从左侧扫入，黑条/黄条压版 | 470ms | 白纸 + 制图线 + 黑/黄块排版 |
| RISO | 蓝、纸两片印版反向错位通过 | 380ms | 套印错版 |
| RIOT | 朱红褶皱舞台幕布 + 撕胶带缝 | 380ms | 演出开场 |
| GRIMOIRE | 羊皮纸页上升 + 蜡封落下 | 650ms | 档案页翻开 |
| MNEMO | 纵向记忆条带 + 紫色重影扫描 | 360ms | 磁带/内存扫描 |

实现要点：
- `CURTAIN_HOLD` 控制“覆盖完成 → 换样式表”的等待时间，必须 ≥ 该变体最长覆盖动画；
- `revealThemeCurtain()` 仍负责 520ms 后清理 `is-on / is-cover / is-reveal`；
- `prefers-reduced-motion` 或 `safe` 档直接切换，不播放幕布；
- 变体样式全部在 `src/motion.css` 的 “PER-THEME SWITCH CHOREOGRAPHY” 段；
- 全屏面板必须用 `clip-path` 的 240% 半径或 101% 位移保证四角覆盖，不要用 150% 圆。

### 2. 字体：思源黑体 / 思源宋体

系统已安装：`思源黑体 CN`（Source Han Sans CN）与 `思源宋体`（Source Han Serif SC）。
WebView2 中 **Regular 家族名未稳定命中，Medium 家族名稳定命中**，因此统一把
`思源黑体 CN Medium` 放在字体栈首位；`font-weight: 700` 由 Chromium 合成加粗。
衬线标题使用 `思源宋体 Medium`，正文衬线使用 `思源宋体`。

| 主题 | UI / 正文 | 标题 / 字标 |
|---|---|---|
| NOVA | 思源黑体 Medium | 思源黑体 Medium；衬线字标用思源宋体 |
| AURUM | 思源黑体 Medium | 思源宋体 Medium（宽字距） |
| ENDFIELD | 思源黑体 Medium | 思源黑体 Medium |
| ZERO HOUR | 思源黑体 Medium | 思源黑体 Medium |
| CODEX | 思源黑体 Medium | 思源宋体 Medium |
| BROADCAST | 思源黑体 Medium | 思源宋体（报头） |
| SUMMER | 思源黑体 Medium | 思源宋体 Medium |
| RISO | 思源黑体 Medium | 思源宋体 Medium |
| RIOT | 思源黑体 Medium | 思源黑体 Medium；旁注思源宋体 |
| GRIMOIRE | 思源宋体 | 思源宋体 Medium / SemiBold |
| MNEMO | 思源黑体 Medium | 思源黑体 Medium |

- 已删除 `src/fonts.css`、`src/fonts/`（452KB）与两套 `Saira.ttf`（各 476KB）；
- 主题字体令牌仍为 `--font-ui / --font-display / --font-serif / --font-condensed`，
  外部主题只需覆盖这四个变量；
- 不要重新引入 `@font-face` 指向主题内字体文件；如需扩展，使用本机 `local()` 或 OFL 字体。

### 3. 设置页：全宽双栏 + 主题用户卡

- `.view-settings .appearance-shell` 宽度改为 `min(1640px, 100%)`，占满内容区；
- 顶部 hero：左侧标题，右侧 `.settings-id` 本机档案卡；
- 卡片按两列排布：左列玩家 / 数据与备份 / 游玩统计，右列启动与关闭 / 系统与兼容性 / 关于；
- `≤1080px` 单列，`.settings-col { display: contents }` 并用 `order` 恢复优先级；
- `.settings-id` 在 `src/settings-themes.css` 末尾有 11 套材质：玻璃、铜牌、工业标签、
  危险贴纸、书铭牌、剪报、明信片、套印卡、演出通行证、蜡封书牌、记忆模块；
- 用户卡姓名/账户/档位/版本由 `renderSettings()` 同步，头像取显示名首字。

### 4. RIOT 更名

`少女乐队的呐喊 · RIOT` → **`舞台残响 · RIOT`**（主题 id 仍为 `riot`，避免破坏存档）。
`theme.json` 版本升到 **1.5.3**；README、THEMES、HANDOFF、单主题卡片已同步。

### 4.1 主题顺序与字体抖动

- 主题网格**固定前四**：`nova` → `endfield` → `zerohour` → `codex`；
  其余主题仍按 `localStorage` 使用次数排序，会话内不重排。实现在 `THEME_PREFIX` +
  `computeThemeOrder()`，不要再改回“用得多就往前挤”。
- 字体“抽搐”的三个根因与修法：
  1. `.logo` 曾对 `letter-spacing` 做 0.4s 过渡，`fitLogo` 在过渡中反复测宽/改字号；
     现已删除该过渡，只保留 `opacity`。
  2. `ResizeObserver` 每个回调都直接 `fitLogo`；现改为 120ms 合并（`scheduleFit`），
     一次主题切换最多落一个最终字号。
  3. 主题切换时 `nav-glide` 会从旧主题宽度滑到新主题宽度；现在 `setNav(view,{instant:true})`
     加 `.is-instant`，直接吸附，不再拉伸。
  4. 幕布中央的主题名原来继承 `--font-display`，样式表一换字体就跟着换，字宽会在
     幕布中央跳一下；现在 `.tc-label b` 固定思源宋体，`.tc-kicker/.tc-sub` 固定思源黑体。
  5. 第一次切换动画“显示不全”：`playThemeCurtain()` 现在先在 `is-on` 状态等两帧，
     让目标 variant 的初始 transform 完成绘制，再加 `is-cover`；第二次切换不再依赖缓存。
  6. 深夜广播标题“抽搐”：`fit-content` 标题的 `available` 原来取自身宽度，缩字号会同时
     缩小可用宽度，形成来回振荡；现在改为测量稳定的父级文字列宽，并且 ResizeObserver
     只收缩、不再自动回涨。
  - 另外删除了 `fonts.ready` 时的第二次 refit/setNav；本机思源字体是同步可用的。

### 5. 音效

- `src/assets/sfx/` 的界面音效换成 Gavilya 参考集中的 Kenney Interface Sounds（CC0，无需署名）；
- `theme.ogg` 专门用于主题切换，`applyTheme()` 在幕布合拢时播放；
- `theme.ogg` 用 `switch_001`，`launch-rise.ogg` 用 `maximize_001`；保留 `chime / deep / launch-fall`；
- 许可与来源表：`src/assets/sfx/LICENSE-SFX.md`（全部 CC0）。

### 6. 验证

- `node tools/export-all.js --views=home,settings --sizes=1439x1124,960x600 --stress`
  → 66 captures / 11 themes / 0 clipping / 0 overflow；
- 30 汉字标题：1920×1080 与 1366×768 均为单行 `--logo-fit: .443`，无截断；
- 真实切换采样：AURUM 覆盖 62–513ms、换主题 513ms、揭开 708ms、清理 1.05s+；
- 所有 `.ogg` 在 WebView `decodeAudioData` 通过；页面无 `window.onerror` / unhandledrejection；
- 单文件 Legacy 包（1.5.1）实机验证：`version=1.5.1`、`NovaTheme.themes.length=11`、
  RIOT 名称「舞台残响 · RIOT」、正文命中思源黑体、16 条 SFX 请求全部成功；
- 出包：`NOVA-1.5.1-legacy-single.zip` **2.34 MB** / `NOVA-1.5.1-legacy-full.zip` **3.81 MB**；
- SUMMER 开屏同步重做：整张白纸 + 青色制图线 + 黑块 `SUMMER` + 黄块 `夏日轻程`
  + 真实日期/时间/游戏数；退出改为整页淡出（默认的中心圆形裁切会留下 "ER" 残块）；
  切换动画的底部黑条从 34% 降到 14%，只做页脚压条。
- GRIMOIRE 切换改为“羊皮纸页上升 + 蜡封落下”，覆盖 500ms、停留至 650ms，不再像墨点
  一样瞬间铺满又消失。
- SUMMER 缩略图重绘为白纸 + 青色线稿 + 黑/黄字块；右侧不再放蓝印插画。主题版本 1.8.3。
- 版本 `1.5.1`，缓存仍写到 `NOVA_CACHE_ROOT`（E:），收尾时清理 `.cache/webview2`。

### 6.1 这一轮改过的文件

```
src/app.js                  CURTAIN_HOLD / data-variant / audio.theme / 设置身份卡同步 / 字体配方
src/motion.css              11 套切换编舞 + AURUM 门环 + 覆盖半径修正
src/views.css               设置页全宽双栏 / 卡片 / 页脚
src/settings-themes.css     11 套用户卡材质
src/index.html              设置 hero + 双栏结构 + 用户卡 DOM + 版本
src/base.css / theme.css    思源字体栈
src/type.css                --serif → var(--font-serif)
themes/*/theme.css          字体变量 / 删除 Saira @font-face
themes/riot/theme.json      舞台残响 · RIOT / 1.5.3
src/assets/sfx/*            Kenney Interface Sounds + LICENSE-SFX.md
tools/bump-version.js       同步 legacy csproj 版本
```

### 7. 下一轮

1. Win7 SP1 + WebView2 109 真机验收（唯一未完成的兼容项）；
2. 若比赛机器未安装思源字体，需要随包附带子集化字体（需先确认授权与体积）；
3. 主题切换动画的真机手感（尤其是 SUMMER 排版压版与 GRIMOIRE 墨渍）可在 60Hz 屏幕上再确认一次。

---

## 0.00b 2026-10-19 · v1.4.0 性能 / 主题切换 / 六套重做（**主题层最新，先读这一段**）

> 应用层已升级到 **v1.5.0**（本机用户 / 设置中心 / 数据包 / 统计），见 `docs/HANDOFF.md` §0.0a
> 与 `docs/LAUNCHER-FEATURES.md`。本文件继续负责主题层。

> 本节覆盖下面所有旧记录。旧表保留作历史，不要再按旧表判断现状。

### 一句话状态

六套待改主题（CODEX / BROADCAST / SUMMER / RISO / RIOT / GRIMOIRE）已完成本轮精修或重做；
四套保留区（NOVA / AURUM / ENDFIELD / ZERO HOUR）**主视觉未动**，只补了各自不同的
开屏/进游戏动画。框架层修掉了页面切换卡顿、主题切换乱序与无动画三个问题。
文档拆成 `docs/themes/*.md`（单主题）+ `docs/THEME-INTERFACES.md`（统一接口）。
预览图已用实机截图重新生成。

### 状态表

| 主题 | 版本 | 本轮动作 | intro | launch |
|---|---|---|---|---|
| nova | 2.0.0（内置） | 仅新增开屏/进游戏 | `gilded`（星核） | `nvLaunch` |
| aurum | 1.0.8 | 仅新增开屏/进游戏 | `aurum`（金门） | `auLaunch` |
| endfield | 1.0.4 | 仅新增进游戏 | `endfield` | `efLaunch` |
| zerohour | 1.0.7 | 仅新增进游戏 | `zerohour` | `zhLaunch` |
| codex | **1.7.1** | 小修：深褐铜版背景 + 罗盘 + 红菱形 + 长名 | `codex`（星轨展开） | `cxIris` |
| broadcast | **1.4.1** | 恢复背景图 + 胶片颗粒 + 文字对比 + 幽灵字 | `broadcast` | `bcSweep` |
| summer | **1.8.3** | 白纸排版 + 黑黄字块 + 青色线稿；切换/开屏重做 | `draft` | `suShutter` |
| riso | **1.4.1** | 蓝白双色印版 + 网点/斜线/巨字；修复滤镜失效 | `riso`（三色套印） | `rsRoll` |
| riot | **1.5.2** | 镜像回原图：字左、唱片右、角色右缘；红环连笔 | `vinyl` | `rtDrop` |
| grimoire | **1.5.1** | 重做：左肖像卡 + 右档案正文 + 金框/蜡封/藤蔓 | `seal` | `grStamp` |
| mnemo | 1.1.2 | 仅更新预览（视觉未改） | `mnemo` | `mnUnfold` |

### 框架层改动（别回退）

1. **页面切换卡顿**：`src/views.css`
   - 删掉 `.view-library/.view-appearance` 的全屏 `backdrop-filter: blur(9px)`；
     这是切页时每帧重新模糊 1439×1124 的根因。改成更密的渐变遮罩。
   - `.view` 加 `contain: layout style`，过渡改成 `translate3d`；
   - 删掉 `.view.is-current .hero-inner` 的 0.5s 重播动画（每次回首页都重栅格化整块主视觉）。
   - 实测 view 切换无 >50ms 长任务（PerformanceObserver longtask 为空）。
2. **主题切换动画**：`#themeCurtain`（`src/index.html` + `src/motion.css` + `src/app.js`）
   - 两片幕布按目标主题强调色合拢，覆盖期间换样式表，再从中间向上下揭开；
   - 中央显示目标主题名（`舞台残响` 等），`prefers-reduced-motion` 时直接切换；
   - `applyTheme` 用 `themeSwitching` 防连点，覆盖 360ms，换完两帧后揭开。
3. **主题排序稳定**：`src/app.js`
   - `themeOrder` 在启动时按使用次数快照一次；会话内**不再重排**。
   - 折叠时活动主题不在前 6 → **追加**到末尾，不替换最后一张卡（不再“变位置”）。
4. **样式表缓存 + 预取**：`src/theme-engine.js`
   - 主题 CSS 按 URL 缓存在内存；hover/focus 卡片预取；启动后 idle 预取全部；
   - `refresh()` 清缓存。**改 CSS 后仍要 bump version + sync + 重启/刷新**。
5. **`--nova-hero`**：`src/app.js` 的 `publishHeroVar()` 把当前游戏主视觉写到 `<html>`，
   主题可在肖像卡/印版照片里消费（GRIMOIRE 肖像卡、SUMMER 蓝印都可用）。
6. **导航滑块（nav-glide）**：主题切换会改变导航的 padding/字体宽度，旧实现只在
   `setNav()` 时量一次，导致换主题后白色滑块停在错误位置，直到切页才恢复。
   现在 `applyTheme()` 在应用样式后立即 `setNav()`，并在 350ms 后与 `fonts.ready`
   再量一次。
6. **静态资源版本**：`src/index.html` `?v=1.5.1`；`theme.json` 版本见上表。

### 六套主题的改动要点

- **CODEX**：封面压成低饱和深褐铜版（`brightness .3 + sepia`），右侧加巨大暗淡罗盘
  （`hero-compass.svg`），四周暗角；meta 分隔改成酒红菱形；长名两行。
- **BROADCAST**：恢复 `.scene > img`，右侧灰阶显影 + 蒙版；颗粒搬到
  `.scene-stack::after`（在 `.scene` 之上、内容之下）并平铺；正文取消白色重影、
  加深字色；幽灵字缩进封套内并线性擦除；面板颗粒改回 `repeat`（旧规则留下
  `no-repeat`，窄窗只显示一块 180px 灰方块）。
- **SUMMER**：恢复游戏主视觉，用 `grayscale + sepia + hue-rotate` 压成单色青蓝
  “盖印”照片；左侧白纸渐隐保证面板纯白；右侧加套准框、黄色胶带、白色编号条；
  网点叠在照片上；线稿仍在最上层。
- **RISO**：根因是 `.scene > img` 的蓝版滤镜**没有主题前缀**，被框架
  `.scene.is-active > img` 压掉。v3 用 `html[data-theme="riso"] .scene > img`
  + `screen` 混合做蓝白印版；加蓝色网点、酸黄斜线、星徽、巨型空心 RISO 字。
- **RIOT**：把 v2 的镜像构图改回原图：文字左、黑胶插画窗右、角色只显影在右缘；
  页面回白纸；`hero-vinyl.svg` 的红环改成一条连续笔触（viewBox 加宽，唱片不再被裁）；
  长名两行。**v3.1**：用户指出白色唱片窗与压在角色上的大红圈不合适——现在 SVG 改为
  透明底，唱片直接浮在纸面上，插画窗无白底/黑条/网点，页面红螺旋删除，只留灰墨泼溅。
- **GRIMOIRE**：重做构图。肖像卡回到左侧，使用 `--nova-hero` 真实游戏主视觉，
  金框 + 小蜡封 + 真实档号；文字列在右：酒红眉标带、金线、红菱形、属性表式进度；
  背景压暗 + `filigree.svg` 金色藤蔓；删除巨大蜡封与活动条；长名两行。
  还修了旧规则 `.progress-head span`（0,3,2）把红带上的读数染成深褐的问题，
  以及 `font-size !important` 绕过 `--logo-fit` 的问题。

### 开屏（全部 11 套互不重复）

- **新增四个结构级舞台**（不是换色）：
  - `gilded` → NOVA 星核（轴线 + 三层菱形描边 + 粒子汇聚 + 真实时间/游戏数）
  - `aurum` → 金门（左右门板滑开 + 放射光环 + 菱形点 + 真实日期）
  - `codex` → 星轨展开（卷轴 `scaleX` + 星座描线 + 罗盘针 + 真实档号）
  - `riso` → 三色套印（蓝/黄/品红版落位 + 错位字 + 真实游戏数）
- 其余 7 套沿用并保留：endfield / zerohour / mnemo / seal / draft / vinyl / broadcast。
- `src/intro.js` 的 `STAGE_SELECTOR` 已加入 `.intro-nv/.intro-au/.intro-cx/.intro-rs`；
  `play()` 现在会清理旧 stage、重置 `state.finished`、取消上一次的删除定时器——
  **这三个 bug 会让重放叠图或提前消失**。

### 进游戏（全部 11 套互不重复）

| 主题 | 关键帧 | 语言 |
|---|---|---|
| nova | `nvLaunch` | 变形宽银幕细缝 |
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

### 文档与预览

- `docs/THEME-INTERFACES.md`：统一契约（manifest / 变量 / 选择器 / 按钮配方 /
  intro / launch / 切换 / 覆盖清单 / 新增流程 / 版本表 / 硬约束）。
- `docs/themes/<id>.md` + `docs/themes/README.md`：11 套单主题接口卡。
- `docs/THEME-KIT.md`：补了 `scrim`、`--nova-hero`、取消 `controls=hard`。
- 预览图：**源是 `tools/theme-concepts.html` 的概念板**（默认 NOVA 那张就是版式基准），
  用 `tools/render-concepts.js` 以 960×540 @2x 渲染，再缩到 960×540 写入各主题
  `assets/preview.jpg`；内置 nova 写入 `src/assets/theme-nova-preview.jpg`。
  **不是应用截图**；预览 URL 带主题版本号，改图后必须 bump version。
  CODEX 概念板已去掉无意义的菱形等级，GRIMOIRE 改成“肖像卡 + 蜡封 + 真实档号”。

### 验收

- 全量 `export-all.js --views=all --sizes=1439x1124,960x600 --stress`：**330 张，0 告警**
  （`_shots/audit-final`）；`probe-graphics.js` **11 套全 clear**。
- 30 字长名在两档尺寸均通过（RIOT / GRIMOIRE 曾因主题写死 `font-size`
  绕过 `--logo-fit` 而溢出，已修）。
- `backdrop-filter` 只在非全屏小面积使用。
- 主题切换：`#themeCurtain` 覆盖/揭开已验证（目标主题名 + 主题色缝线）；
  实测单次 `NovaTheme.activate` 约 100–210ms，全部发生在幕布之后。
- 页面切换：`PerformanceObserver` 的 longtask 为空（library → home 实测）。
- 主题排序：切换 `summer` 前后卡片顺序完全一致（启动快照，不重排）。
- 开屏：`gilded / aurum / codex / riso` 四套新舞台已逐套截图验证；
  RISO 的小字已加纸面标签，避免压在色块上。
- 已知取舍：`aurum / endfield / zerohour` 的主视觉按用户要求未改，只新增
  进游戏动画；`nova` 只新增开屏/进游戏。
- 缓存：开发缓存根 `NOVA_CACHE_ROOT=E:/网页小工具/游戏启动器/nova-game-space-desktop/.cache/webview2`
  （不在 C 盘）；本轮已删掉旧的 `wv2..wv5` profile，并跑过
  `node tools/clear-cache.js` 清浏览器缓存 + 强制重载。

### 交付 / PR

- PR **#2** `feat: 1.4.0 主题精修、极致流畅与主题切换动画` 已合并到 `main`
  （merge commit `64eaa7c`）。
- PR **#3** `fix: 概念板渲染脚本自包含并恢复界面` 已合并到 `main`
  （merge commit `27730f3`）；`tools/render-concepts.js` 现在会自动 stage/clean
  概念板并渲染后回到 `index.html`。
- 主题卡预览的最终来源是 `tools/theme-concepts.html` 的 11 张概念板；
  不要再改成应用截图。

### 仍需注意

1. **改主题 CSS 后必须**：bump `theme.json` version → sync 到用户目录 → 重启/刷新。
   内存缓存会让「只 sync 不重启」看不到新样式（本轮踩过）。
2. **不要在全屏视图上写 `backdrop-filter`**（性能铁律）。
3. **主题切换卡片顺序**只在启动时排序；不要恢复成每次 render 重排。
4. **`.scene > img` 覆盖必须带 `html[data-theme]`**；
   `.scene.is-active > img` 的特异性是 (0,2,1)。
5. **`font-size` 写死时必须乘 `var(--logo-fit,1)`**，否则长名溢出。
6. **新增 intro 舞台必须加入 `STAGE_SELECTOR`**，并在 `play()` 的清理列表里移除对应类。

---

## 0.00 2026-10-19 · 视觉重构交接总览（接手先读这一段）

> **用户铁律（本轮补充，全部来自原话，优先级最高）**
> 1. 机制可以统一，**外观绝不允许统一**：每套主题的构图、按钮、开场动画、进游戏动画必须不同。
> 2. 铁律 1/3：任何文字不许被图形压住、不许被截断（30 字长名也要完整展示）。
> 3. 封面不许整体去色（黑白「死气沉沉」）；最多 `saturate(1.02)`。
> 4. 菱形 = 等级语义，禁止当通用装饰（CODEX 已清干净）。
> 5. 保留区（**不许再改**）：默认 NOVA、终末地 ENDFIELD、鎏金圣所 AURUM（已还原 1.0.6）、零点街区 ZERO HOUR。
> 6. 节奏：先实现再完善，不要在架构上空转；有截图工具，别反复重启程序。

### 本轮结束时的状态（11 套）

| 主题 | 版本 | 构图 | intro | launch | 备注 |
|---|---|---|---|---|---|
| nova | 保留区 | gilded 开场 | — | — | 不动 |
| aurum | **1.0.6 已还原** | — | — | — | 用户要求还原，别再动 |
| endfield | 保留区 | endfield 开场 | — | — | 不动 |
| zerohour | 保留区 | zerohour 开场 | — | — | 不动 |
| mnemo | 1.1.0 | **原版未重设计** | mnemo | mnUnfold 卷宗 | **下一轮首选** |
| riot | 1.4.1 | **左图右字**（黑胶在左） | vinyl 黑胶升速 | rtDrop 落盘 | 红刷圈目前断成两段 |
| grimoire | 1.4.1 | 厚框羊皮纸 + 蜡封页 | seal 盖章 | grStamp 盖章 | 活动卡还在（见任务 3） |
| riso | 1.3.1 | 出血海报（蓝压出面板） | ink 墨与纸 | rsRoll 油墨滚过 | 蓝底蓝字已修 |
| summer | 1.7.0 | 白纸线稿 + 黑黄字块 | draft 线稿自绘 | suShutter 快门 | 照片卡已删、线稿进背景 |
| broadcast | 1.3.5 | 满幅噪点 + 线性擦除幽灵字 | broadcast 调频 | bcSweep 扫描 | 封面隐藏，页面即纸 |
| codex | 1.6.0 | 单栏「安静铜版」，无插画 | codex 星轨 | cxIris 虹膜 | Noto Serif SC 600；活动卡删除 |

### 框架层（可选机制，主题在 theme.json 的 features 里声明）

- `src/theme-kit.css`：`hero=plate` / `header=rule` / `cards=rule` / `plates=off`；**`controls=hard` 已弃用**，按钮全部由主题自理。
- `docs/THEME-KIT.md`：变量与插画规范。
- `src/app.js` 约 706 行：`.is-long-title` 钩子（标题 >14 字时切换主题里的小字号两行规则）。
- `src/intro.js`：15 个预设；**`STAGE_SELECTOR` 必须包含所有自定义舞台类**
  （`.intro-gs/.intro-mn/.intro-zh/.intro-ef/.intro-su/.intro-vn/.intro-bc/.intro-dr`），否则换预设会叠图。
- `src/intro.css`：自定义舞台必须隐藏基础星盘/字标：`.intro.intro-xxx :is(.intro-emblem,.intro-word,.intro-meter,.intro-cap)`。

### 必须记住的坑（每一条都踩过）

1. **主题 CSS 在 theme-kit 之后注入**：覆盖旧规则要么写在主题 `theme.css` **末尾** + `!important`，
   要么用同等特异性——旧规则常用 `html[data-theme="codex"][data-fx-hero="plate"]` 双属性（特异性 0,3,1），
   普通单属性规则压不过（CODEX 菱形底纹事件）。
2. `hero=plate` 会把 `.hero-inner` 上下左 padding 归零、`::before` 几何固定 `-24/-28/-22/-28`；
   别给 `::before` 写死 `top/height`，否则「板比内容短」，底部卡片被裁。
3. 截图流程：`export-all.js` 连**已运行**的启动器即可，换主题不用重启；只有 `theme.json`（features/intro）变更才重启。
   切换主题后立刻截图会拍到过渡半透明帧——等 1.5s 以上。
4. 底图遮罩/幽灵字画在 `scene-stack::after` 会被**封面**挡住：要么主题隐藏封面（summer/broadcast），要么画在 `.hero` 层。
5. SVG 文本超出 viewBox 会被裁：用 `textLength + lengthAdjust`。颗粒用 feTurbulence 瓦片（broadcast `grain.svg`）。
6. 清理旧装饰的规则**必须放在主题 theme.css 末尾**（注入顺序最末），别指望框架层。

### 下一轮任务清单（按优先级）

1. **MNEMO 重设计**：唯一没动的主力主题；档案/紫罗兰语言，方法见 §0.2（参考图量化）。
2. **五视图审计**：目前主要验了 home；`export-all --views=home,library,detail,appearance` 全量跑一遍，清 clipped/overflow。
3. **活动卡去留**：用户在 SUMMER/CODEX/BROADCAST 都点了「卡片重复」，GRIMOIRE/RIOT/RISO 还有；倾向统一删除、进度行金线收尾。
4. RIOT 红刷圈（`hero-vinyl.svg` 的弧线断成两段）改成一整条笔触。
5. CODEX 等级菱形：detail 页有等级数据时恢复菱形徽标（语义级使用）。
6. 文档：本表已同步；`THEMES.md` §15 的量化方法与 `THEME-COVERAGE.md` 的界面清单仍然有效。

### 工作流速查

```bash
bash tools/dev-run.sh                                    # kill→build→sync→run（CDP 9223）
node tools/export-all.js --themes=a,b --views=home,library --sizes=1439x1124 --out=../_shots/live
node tools/_shot1.tmp.js out.jpg                          # 稳定态单帧
node tools/_eval.tmp.js "(()=>{...})()"                   # CDP 探针
cp -r themes/X/. "$LOCALAPPDATA/NOVA Game Space/themes/X/" # 主题 CSS 热更（activate 生效）
```

静态资源（`src/**`）改动必须 `dotnet build`（dev-run 会做）；主题目录改动热更即可。

---

## 0.00 2026-10-19 v2 视觉重构（接手先读这一段）

> 用户明确要求：**每套主题的构图必须不一样**。统一的是「机制」（无压字、无截断、
> 封面保色、可选项开关），**不是外观**。不要再把九套主题塞进同一个版式。

本轮已完成：

| 主题 | 版本 | 构图 | 要点 |
|---|---|---|---|
| SUMMER | **1.7.0 / v4** | 纯白纸；文字整幅，线稿在**页面背景**右侧 | 照片卡已删除；`draft.svg`（太阳射线/地平线/帆船/伞骨）落在面板右侧空白，不在任何卡片里；正文黑块白字、副文黄块黑字；开场 `draft` |
| BROADCAST | **1.3.5 / v3.5** | 左字 + 右侧黑胶；**无封面纸** | 满幅胶片噪点（feTurbulence 瓦片）；幽灵字 BROADCAST **线性擦除**横贯页首；正文带**白色 ghost 投影**；那条线改成**音频波形**（竖刻度）；重复活动条删除；黑胶直接压在纸上，不再有网格卡 |
| RISO | 1.3.0 | 左字 + 右侧「出血海报」 | 蓝色海报压出面板外；进度改纸面墨字，修掉蓝底蓝字 |
| RIOT | 1.4.0 | **左图右字**（镜像） | 黑胶在左、红色硬影；删除被裁的 SIDE A 竖排与歌词块 |
| GRIMOIRE | 1.4.0 | 左字 + 右侧蜡封页 | 深褐厚框 + 金线；末尾强制清掉旧伪元素（否则压字） |
| CODEX | **1.6.0 / v6** | 单栏文字、无插画，面板 560px | 深褐铜版：极淡竖纹 + 细双线；**四角小 L 与眉标金块已删除**；全篇 **Noto Serif SC 600**（标题金、正文米白），按钮同族；时钟居中两行；重复活动条已删除，进度行金线收尾；长名 `.is-long-title` 30px 两行 |
| AURUM | **1.0.6（已还原）** | — | 用户要求还原，`git checkout` 回滚，**不要再改** |

框架层（可选，不影响未声明的主题）：

- `src/theme-kit.css`：`hero=plate` / `header=rule` / `controls=hard` / `cards=rule` / `plates=off`
- `docs/THEME-KIT.md`：变量与插画规范
- 主题只在 `theme.json` 的 `features` 里声明；`nova` / `endfield` / AURUM 不声明。

必须记住的教训：

1. 主题 CSS 在 `theme-kit.css` **之后**注入，旧主题里的 `!important` 会反压框架；
   清理旧装饰的规则要写在**该主题 theme.css 的末尾**。
2. `html[data-fx-hero="plate"]` 会把 `.hero-inner` 的上下左 padding 归零，
   面板 `::before` 的几何固定为 `-24/-28/-22/-28`；否则旧主题的
   `top/height` 会让「板比内容短」，底部卡片被裁。
3. 封面**不许整张去色**（用户明确反馈黑白「死气沉沉」）；只用 `saturate(1.02)` 级别。
4. 每套主题保留自己的开场：`gilded / aurum / endfield / codex / zerohour / mnemo /
   seal / sun / ink / vinyl / broadcast`，本轮新增 `vinyl`（RIOT）与 `broadcast`（调频）。
5. **按钮不再统一**：`features.controls` 已从 6 套主题移除。每套主题自己的按钮：
   SUMMER 黑块/黄块、BROADCAST 黑平块、RISO 酸黄 + 蓝硬影、RIOT 黑块 + 红硬影、
   GRIMOIRE 酒红 + 金内线、CODEX 羊皮纸 + 金线。以后新增主题也不要用统一按钮。
6. **启动动画（launch）也按主题区分**：SUMMER 快门下落、BROADCAST 扫描线、
   RISO 油墨滚过、RIOT 唱片落盘、GRIMOIRE 盖章、CODEX 菱形虹膜、MNEMO 卷宗展开。
   `intro` 是开机动画，`launch` 是进游戏动画，两者都要各自不同。

---

## 0. 本次会话增量（v1.3.10 → v1.3.11：SUMMER 深挖 —— 三个"整轮白跑"级发现）

> **【重要 / 交接必读】SUMMER 已由第二个会话接手，走的是另一套方案。**
> - 我这一轮把 SUMMER 从 v1.2.9 推到 v1.3.1，并定位了三个框架级坑（§0.1–§0.4）。
> - **随后另一个 AI 会话并发接手了同一个文件**：新建 `themes/summer/assets/beach.svg`
>   （手绘扁平矢量海滩插画），把 `theme.json` 升到 **1.5.0**，并在 `theme.css` 末尾追加
>   一整段 **v2「夏日特辑 杂志跨页」**（纸白页 + 青网格 + 右侧插画窗 + 墨色衬线标题 + 酸柠高亮），
>   同时用 `!important` 把 `.atmosphere` 整体关掉。
> - 它**采纳了我加的 `scrim` 通道**（1.5.0 的 `features` 仍保留 `"scrim": "none"`），
>   所以框架那层白纱的修复是有效资产，别撤。
> - 我的渐变地貌（v1.4.0 段）**已按它的意图整段删除**，只留一行指针注释；
>   删除原因是它只把 3 块文字底板的 `background` 归零，漏了 `.hero-logo`，
>   而我的 v1.4.0 给那一块留了 62% 白纱 —— 会变成它调不出来的幽灵底板。
> - **两套方案的分工（结论）**：v2 的「手绘 SVG 插画」比我那套「径向渐变地貌」
>   **更贴合任务书**（§3 明说 SVG 与背景图层优先、要精确复刻原图；参考图本身就是扁平插画）。
>   所以 **v2 是主线**；我的 §0.5 只作为**备选记录**保留（它带完整的量化数据，
>   若 v2 的占比迟迟收不拢，可以拿它当对照）。
>
> 三个坑（§0.1）**与方案无关，仍然有效**，动任何主题的背景层之前请先读完。

### 0.1 三个发现（都能解释"改了 CSS 却没变化"）

**发现 A：SUMMER 的 `.scene` 是关掉的（`opacity: 0`）。**
所以页边那条"薄荷底色"**不是** `.scene` 画的，而是 **`body` 自己的
`background-color: #e6f3ef` + `background-image`**（`body::before` 还叠了一层
`seams.svg` 细线）。实测：给 `.scene` 加 `!important` 的纯蓝背景 → **0 像素变化**。
→ **要改 SUMMER 的页底色，改 `body`，不是 `.scene`。**

**发现 B：`src/theme.css` 里有一套"照片暗角纱"，它会盖在 `.atmosphere` 之上。**
```css
/* src/theme.css —— 框架层，为照片背景准备的可读性暗角 */
.atmosphere        { background: radial-gradient(150% 100% at 78% 42%, …) ,
                                 linear-gradient(180deg, rgba(3,4,7,.98) … rgba(3,4,7,.985)); }
.atmosphere::before{ background: linear-gradient(90deg,
                       rgba(var(--scrim-rgb), .97) 0%, … rgba(var(--scrim-rgb), 0) 78%); }
.atmosphere::after { background: radial-gradient(… var(--glow) …) ×2; opacity: .5; }
```
- `.atmosphere::before` 是**从左侧横铺的 97% → 0 白纱**（`--scrim-rgb` 在 summer 是暖白）。
- 后果：**主题写在 `.atmosphere` 上的任何渐变都会被这层纱洗淡 55%–97%**。
  本轮 v1.3.0 / v1.3.1 把天空/海/地面全铺在 `.atmosphere` 上，实测中心点被洗成
  `#eeebc9` 这种淡黄（淡黄亮度 >.72、色度 <.20、色相 <70° → 被 `bucket()` 算成
  **paper**），**所以那一整轮基本白做**。
- 顺带一个"幽灵元素"：主视觉左下角那块**柠檬绿 `#d6f252`** 也是这条纱的尾巴
  （不是主题元素，`--t-accent-2` 经由 `--scrim-rgb` 漏出来的）。
- **验证手法（比 `elementFromPoint` 可靠，见发现 C）**：往主题 CSS 末尾**临时**追加
  ```css
  html[data-theme="summer"] .atmosphere { background-image: linear-gradient(#ff0000,#ff0000) !important; }
  html[data-theme="summer"] .scene      { background-image: linear-gradient(#0000ff,#0000ff) !important; }
  ```
  然后 `export → 取样像素`：红只在测量区中心露出约 30%、左缘只剩 5%（= 白纱的不透明度
  曲线），蓝**完全看不到**（= `.scene` 已关）。
  **调试块测完必须删**：本轮已删（`themes/summer/theme.css` 现为 2009 行、末尾是 v1.3.1 段，
  文件里搜不到 `DEBUG-PROBE`），`%LOCALAPPDATA%\NOVA Game Space\themes\summer\` 也已重新同步。
- **正确修法（计划中，本轮未落地）**：走 features 通道，别在主题里跟框架对轰。
  在 `src/theme-fx.css` 增加一条可选项：
  ```css
  html[data-fx-scrim="none"] .atmosphere,
  html[data-fx-scrim="none"] .atmosphere::before { background: none; }
  ```
  主题 `theme.json` 写 `"features": { "texture": "photo", "type": "none", "panel": "none", "scrim": "none" }`。
  （`src/theme-engine.js` 的 `applyFeatures()` 会把任意 `key: value`
  写成 `data-fx-<key>="<value>"`，已确认；改完记得 bump `index.html` 的 `?v=`。）
  **建议保留 `.atmosphere::after`（两道 `--glow`）**——它是世界的"光"，不是纱。

**发现 C：`elementFromPoint` / `elementsFromPoint` 在背景层上是**假线索**。**
`.scene-stack` / `.scene` / `.atmosphere` 全是 `pointer-events: none`，
`elementsFromPoint` 会**跳过**它们（在 vp9L 拿到的链是
`view-home → content → app → body → html`，根本没有背景层），`elementFromPoint`
只会返回 `body`。**别照它去隐藏元素**（RISO 那轮已经吃过一次，本轮又验证一遍）。
可靠顺序永远是：**① 读 CSS 里那几层全视口规则 → ② 加彩色 `!important` 调试层 →
③ 重截 + 取样像素**。

### 0.2 参考图 `新主题4.png` 的真实结构（已量化，可直接用）

测量区口径 = 参考图**左侧 66% × 垂直 9–72%**（与 `tools/measure-ratio.py` 一致）。
用本轮新写的 `_review/bandmap.py`（逐行 bucket + 左右中取样 + 可切列）读出来的：

| 垂直位置 | 参考图内容（panel 坐标 x 为「测量区宽度」的百分比） |
|---|---|
| vp 9–20% | 纯蓝天空（blue 85–89%）；**最左 0–5% 是一条纯白竖柱**（`#ffffff`，每行都是） |
| vp 20–33% | 天空继续变浅 `#73afe1 → #a2d3f1 → #caeefd` |
| vp 33–40% | 地平线白雾（white 28–37%，`#d2f4ff/#ddf7ff`） |
| vp 40–52% | 海水：淡青 `#92e4f8/#acecfa`（cyan 43–58%）；x≈20% 有一条**饱和青竖带** `#4ad2fc` |
| vp 47–59% | **大黄块**：x **70–100%**，`#ede812 / #a09a00 / #eddf37`（yellow 约 25%/行） |
| vp 30–46% | **纯黑块**：x **78–96%**（`#000000`）——black 5.2% 的全部来源 |
| vp 58–68% | **橙/沙块** x 45–70%（`#f8d5af/#e0c09d`）+ **中灰岩石** x 70–95%（`#78746e/#3f3e36`） |
| vp 9–66% | **饱和蓝竖带** x 10–22%（`#019cdc`，l=.43）——像一根立杆/立柱 |
| vp 66–72% | 暖纸底 + 亮灰（paper 72%、light-grey 13%） |

按行统计的 bucket 目标：**blue 28.4 / paper 26.8 / cyan 12.8 / yellow 7.1 / white 5.8 /
black 5.2 / orange 3.9 / mid-grey 3.8 / dark-grey 3.2 / green 1.6**。

### 0.3 SUMMER 实机几何（已探明，换算面积用；用 `tools/probe-one.js` 复核）

| 层 | 盒子（1439×1124） | 占测量区面积 |
|---|---|---|
| 测量区（panel） | x 0–950、y vp 9–72% | 100% |
| `.topbar` | y vp 0–8.5% | 0（测量区之上） |
| `body` 底色 + `body::before` | 全屏 | 页边与白柱都是它 |
| `.atmosphere`（z1，在 `.scene-stack` 内，**低于 `.stage`**） | 全屏 | 只有主视觉**之外**的部分可见 |
| `.stage`（z4） | y vp 9–78% | 100% |
| **`.hero-inner`（主视觉板）** | **x 75–925、y vp 20–66%** | **65.6%（89.5% 宽 × 73% 高）** |
| `.hero-logo` / `.tagline` / `.meta-row` / `.progress-block` | 均从 x75 起 | 6.6% / 1.6% / 0.4% / 5.5% |
| `.activity-strip` | x75–623、y vp 57–66% | 8.3%（**不透明白** → 算 paper） |
| `.dock` | y vp 78–100% | 0（测量区之下） |

**推论（决定了怎么做）**：主视觉板之外只剩三条带——板上方 vp 9–20%（17.5% 面积）、
左侧白柱 x 0–7.9%（约 6.5%）、板下方 vp 66–72%（9.5%）；**其余 65.6% 全靠
`.hero-inner::before`**，而它内部又有约 22.4% 被文字底板/活动条盖住。
`elementFromPoint` 式的探测对 `.atmosphere` 无效（发现 C），**但 `.hero-inner::before`
在 `.stage`(z4) 里，不吃那层白纱** —— 所以**地貌要画在 `.hero-inner::before`**，
`.atmosphere` 只负责：板上方那条天空、左侧白柱、板下那条暖纸。

### 0.4 SUMMER 现状（v1.3.1）与实测差距

- `themes/summer/theme.css` 末尾已追加 **v1.3.0 + v1.3.1** 两段（天空/海/地面渐层 +
  把文字底板从冷白改成暖纸 `rgba(252,248,236,.94)`）；`theme.json` = **1.3.1**，
  `intro: sun`，`features: {texture: photo, type: none, panel: none}`。
- **但这两段主要写在 `.atmosphere` 上 → 被白纱洗淡（发现 B）**。实测结果：

```
== summer v1.3.1（参考 = 新主题4.png）
   bucket          ref   ours     gap
   blue          28.4%  37.7%   +9.3   ← 超（.atmosphere 里的天空其实没显出来，蓝来自主视觉板）
   paper         26.8%  27.0%   +0.2   ✓
   cyan          12.8%  15.1%   +2.3
   yellow         7.1%   3.1%   -4.0   ← 缺（淡黄被算成 paper）
   white          5.8%   6.6%   +0.8   ✓
   black          5.2%   0.2%   -5.0   ← 深色块一个都没出来
   orange         3.9%   2.1%   -1.9
   mid-grey       3.8%   1.9%   -1.9
   dark-grey      3.2%   1.1%   -2.0
   green          1.6%   3.9%   +2.3
```
- 两条已确认的硬事实（**别再算错**）：
  - `#ffffff` 经 `bucket()` → **paper**（不是 white）。参考图那条白柱是纯白，但按规则
    算 paper；想要 white 得靠 `#f0fafd` / `#ddf7ff` 这类**淡蓝白**（l>0.94、chroma<0.06）。
  - `--t-accent-2: #d8f24a` 的色相 = **69.3° → yellow**（本文档旧版把它写成 green 是错的）。
- 遗留暗雷：`themes/summer/theme.css` 里 `.hero-inner .kicker { background: var(--su-lime) }`
  引用了**未定义的变量**（`--su-lime`），效果等于 `background: none`（碰巧是想要的），
  但请改成显式 `background: none; border: 0;`。

### 0.5 下一手怎么做 SUMMER（**已被 §0 开头的 v2 方案取代，此处仅作备选记录**）

> ⚠️ **先读 §0 开头的接管说明**：SUMMER 现在的主线是 v2「杂志跨页 + `beach.svg`」。
> 下面这套「渐变地貌」是我这一轮写完并测量过的方案（拿到过 black 0.2→3.9、
> yellow 3.1→6.7、cyan 15.1→12.2 的实测改善），**作为备选与量化依据保留**：
> 若 v2 收敛时在占比上卡住，可以拿这些坐标/预算当对照。
> 代码已从 `themes/summer/theme.css` 删除（见那里的指针注释）。


**第一步（框架，5 行）**：加 `scrim` 可选通道（§0.1 发现 B 的修法）+ `theme.json`
写 `"scrim": "none"` + bump `?v=` 与 `summer` 的 `version`。这一步不做，
后面画什么都会被白纱洗一遍。

**第二步（面积预算，先算再画）**：按 §0.3 的几何与 §0.2 的目标，把目标色摊到各表面。
本轮推导出的可行分配（**仅作起点**，画完必须 `measure` 复核再修）：

| 表面 | 面积 | 目标色 | 依据 |
|---|---|---|---|
| 板上方 `.atmosphere` 天空带（x 5%→100%，vp 9–20%） | 17.5% | blue ~86% + 左侧白柱 | §0.2 第 1 行 |
| 左侧白柱（x 0–5% 全高） | ~5% | **white**（淡蓝白 `#f0fafd`，纯白会被算 paper） | §0.2 第 1 行 |
| 板下 `.atmosphere` 暖纸带（vp 66–72%） | 9.5% | paper ~72% + light-grey ~13% | §0.2 最后一行 |
| 文字底板 ×4（logo/tagline/meta/progress） | 14.1% | **深墨蓝**（≈参考图 x10–22% 那条 `#019cdc` 竖带 / 深墨 `#16324f`） | 主视觉左中区在参考图里就是蓝带 |
| `.activity-strip` | 8.3% | 保持白（→ paper） | 参考图该处 vp57–66% 正是 paper |
| `.hero-inner::before` 可见部分 | ~43% | 见下 | —— |

`::before` 内部按**参考图 x/y 实测值**摆（panel x → plate x 换算：`plate_x = (panel_x − 7.9) / 89.5`）：

| 地貌 | panel 坐标 | plate 坐标 |
|---|---|---|
| 天空（蓝 → 淡） | vp 20–33% | t 0–0.30 |
| 地平线白雾 | vp 33–40% | t 0.28–0.44（`#f0fafd`，**不要纯白**） |
| 海（淡青） | x 16–69%、vp 36–52% | x 9–68%、t 0.35–0.70（`#acecfa`/`#8fdcf2`） |
| 大黄块 | x 70–100%、vp 47–59% | x 69–100%、t 0.59–0.85（`#f6e81d` + 阴影 `#a89a00`） |
| 纯黑块 | x 78–96%、vp 30–46% | x 78–98%、t 0.22–0.57（`#14181b` 核心 + `#262d33`） |
| 橙沙 | x 45–70%、vp 58–68% | x 41–69%、t 0.83–1.0（`#f7cca9`） |
| 中灰岩石 | x 70–95%、vp 58–68% | x 69–97%、t 0.83–1.0（`#78746e`/`#a5a29c`/`#c0bab0`） |
| 右下角深色 | x 60–100%、vp 63–68% | 同左（`#101418`） |

**图层顺序（`background-image` 列表第一条在最上）**：
黑块 → 右下深色 → 黄块 → 灰岩 → 海 → 白雾 → 天空竖纹（`repeating-linear-gradient(90deg,…)`）
→ 底部沙 → 天空基础渐变 → `url(assets/dots.svg)`。
（**别用** `assets/seams.svg` 当岩石——它是 `#22a7d8` 细线，不是剪影。）

**第三步（收敛）**：每改一次 `sync → 重启（无需重建）→ export → measure`，
循环到 black/yellow/orange 三项进 1pp 以内。**别为了最后 1–2pp 过拟合**
（测量区里含 dock 卡面插画与抗锯齿边缘，参考图是插画、我们是启动器）。

**第四步（收尾）**：`export-all.js --stress`（0 告警）+ `probe-graphics.js`（全 clear）
+ 更新 `themes/summer/DESIGN.md`（把上面的地貌表写进去：这就是"设计规范与设计理念"）
+ 更新本文件。

> 参考图只用于**提炼语言**，不要临摹具体插画：我们要的是同一套配色比例与构图节奏
> （天空压蓝、海用青、右上一块黑、右中一块黄、底部暖纸），不是那根立杆本身。

### 0.6 新坑（本轮实际发生）：**并发编辑同一个主题文件，两套设计会叠在一起**

本轮末尾，**另一个 AI 会话与我同时改 `themes/summer/theme.css`**：我写的是
「渐变地貌」（v1.4.0），它在几分钟后追加了「杂志跨页 + beach.svg」（v1.5.0）——
两套设计先后叠进同一个文件，后写的赢。表现是：我测到的数字突然对不上自己的改动。

**接手前先做一次并发检查（30 秒）**：

```bash
cd nova-game-space-desktop
find . -newermt "-30 minutes" -type f -not -path "./bin/*" -not -path "./obj/*" \
     -not -path "./.cache/*" -printf "%TH:%TM %p\n" | sort
```

- 若 `theme.css` / `theme.json` 的修改时间比本文件还新 → **有人正在改，先停手**：
  读它新增的段落，判断方案走向，**在它的方案上接力**，不要另起炉灶。
- 发现两套方案叠在一起时：**留后写的**（它带着更晚的判断），把先写的整段删掉、
  只留一行指针注释（本文件与 `themes/summer/theme.css` 里的 v1.4.0 指针就是这么处理的）。
- 并发时**不要**抢着跑 `relaunch` / `export`（会杀掉对方正在用的实例、
  拿到对方一半的同步状态）。等文件稳定 2 分钟以上再动手。

---

## 0 · 上一轮增量（v1.3.8 → v1.3.9：铁律 3 收口 + RISO 配色收敛）

### 0.1 铁律 3：`.stat-value` 数值自适应（框架级，11 套主题一次受益）

- **症状**：960×600 的 detail 视图里，统计格「不到 1 分钟」需要 74px 而格子只有
  66px，被框架的 `nowrap + ellipsis` 吃掉半个词。**这不是某套主题的问题**——
  实测 11 套主题 × 2 尺寸共 **15 条 `clipped` 告警**（grimoire 同样 65 vs 74）。
  所以修在框架层，不在主题 CSS 里。
- **修法**（`src/app.js`）：
  1. 新增 `refitStats()`：按 `.detail-stats` **分组**，行内取**同一个缩放系数**再写
     `font-size`。只缩溢出那一格会让一行里出现三种字号，比截断更难看。
  2. 字号见底（8px）之后才允许落到 ellipsis，ellipsis 只作为最后防线。
  3. `refitLogos()` 里调用它；已经在跑的 `logoObserver` 顺便 observe `.stat-value`
     （用 `statsDirty` 攒成一次重算，避免每个格子各触发一遍）。
- **为什么不会震荡**：盒子由 grid 定宽，改字号不会反过来改盒子，所以没有 `fitLogo`
  那种「缩了又量、量了又缩」的自反馈。`renderDetail()` 每次换游戏会整体重建
  `.detail-stats`，观察者里对 `!isConnected` 的旧节点先 `unobserve` 再返回。
- **验证**：110 张跨主题复测 + riso 30 张复测，均 `✓ no clipping or overflow detected`。
- 版本：`?v=` → **`1.3.9`**。

### 0.2 RISO 配色收敛（`themes/riso/theme.css` v1.2.7 → **v1.2.12**）

**根因（重要，别再踩）**：把整页洗成纸色的**不是**主视觉，而是 **riso 自己的
`.atmosphere`** —— `position: absolute; inset: 0` 的全视口白纱：
`linear-gradient(180deg, rgba(255,255,255,.9) 0%, …, rgba(255,255,255,.96) 100%)`，
`::before` 再从左侧横铺一层 `rgba(255,255,255,.96) → transparent`。
所以 v1.2.7 已经把页面底色改成蓝色之后，肉眼看**还是纸色**——蓝色被自己的纱盖住了。

> 定位手法：**逐层隐藏 + 重截比对**。`elementFromPoint` 那轮给出的是**假线索**
> （它返回 `body`，而 `elementsFromPoint` 又列出并不可见的 `#libraryOverlay` /
> `.lib-shell`），照它去隐藏 `#libraryOverlay` **改了 0 像素**。最后是「隐藏一层 →
> 重截一张 → 比像素」+ 直接读 `themes/riso/theme.css` 的 `.atmosphere` 规则才定案。

**参考图的真实结构**（`新主题参考/新主题3.png`）：**纸色页面 → 大块蓝色海报面板 →
酸黄斜切楔形 → 冷白标题牌 → 紫色叠印**。
（上一轮凭印象当成「整页蓝」，因此走反了一整轮：**先裁切再看图**。）

**收敛过程**：

| 版本 | 动作 | 结果 |
|---|---|---|
| v1.2.7 | 页面底色改蓝、活动条改白 | **反向**：把 riso 最大的一块蓝面换成白板（blue 37.6→30.3，paper 46.1→52.8） |
| v1.2.8 | `.atmosphere` 换成蓝色暗角 + 酸黄辉光；活动条回 `--rs-blue-deep` + 酸黄字 + 酸黄描边；主视觉加酸黄斜带 | 蓝色回来 |
| v1.2.9 | 字井改冷白 `#f2f5fd`；新增 `::after` 两道紫带叠印；导航/筛选/库当前项加紫影 | violet 出现 |
| v1.2.10 | 顶部加**半透明**暖纸边；酸带加宽 | **报废**：混出浑浊中间调（纸只 +4.9，蓝 −8.4，差额落进 light-grey/cyan/red） |
| v1.2.11 | 纸边改**不透明** `#f2ece0`（0→17% 实体，25% 淡出）；字井收窄 | 浑浊消失 |
| v1.2.12 | 纸边淡出更利（17.5%→20.4%）；紫带加宽 | 定稿 |

**结果**（`python tools/measure-ratio.py --all`，参考图 vs 实机）：

```
== riso
   bucket          ref   ours     gap
   blue          49.1%  44.0%   -5.1
   paper         15.9%  11.0%   -4.9
   yellow        14.8%  14.9%   +0.1   ✓
   white         12.5%  12.4%   -0.1   ✓
   violet         4.9%   3.2%   -1.7
   light-grey     0.1%   5.4%   +5.3
   cyan           0.4%   2.7%   +2.3
   green          0.7%   2.4%   +1.7
```

即 blue 30.3 → **44.0**、paper 52.8 → **11.0**，两个签名色（酸黄、冷白）已经对到 0.1pp。
剩下的 light-grey / cyan / green 主要来自**测量区内的启动器 dock 卡面插画与色带边缘
抗锯齿**，属于「海报 vs 启动器」的结构差异，**不建议为最后几个百分点过拟合**。
审计：riso 30 张（15 视图 × 2 尺寸 + `--stress`）`✓ no clipping or overflow detected`。

---

## 0 · 再上一轮增量（v1.3.9 → v1.3.10：RIOT 灰阶收敛）

### 本轮 RIOT：paper 77.3% → **51.0%**，参考 49.8%（`themes/riot` v1.2.0 → **v1.3.7**）

**根因（连踩四轮的坑，务必读完再动任何主题的"灰"）**：
计量表判 `paper` 的规则是 **`L > .72` 且 `chroma < .20` 且 `hue < 70°`**。
前几轮选的"灰"全部压在这条线**上面**，肉眼是灰、表里全是纸：

| 表面 | 旧值 | L | 表里的判定 |
|---|---|---|---|
| 外围场 / `.scene` | `#cfcdc6` | .794 | paper |
| dock 带 | `#c4c2bb` | .751 | paper |
| `.tile-art` / `.lib-art` | `#d6d4ce` | .824 | paper |
| 进度轨 | `#cfcdc7` | .796 | paper |
| 主题卡 | `#dedcd6` | .855 | paper |
| **主视觉板（标题底）** | `#eeece6` | **.918** | paper（比外围场还亮） |

第二个叠加错误：`.atmosphere` —— **唯一真正可见的整屏层**
（`.scene` z0 < `.atmosphere` z1 < `.stage` z4）—— 当时铺的是一层**白色纱**
（`rgba(255,255,255,.9 → .96)` + `::before` 再从左侧横铺 96% 白），
把整张纸又洗白一遍。**和 RISO 是同一个病**（见 §0.2）。

**修法**（都是"压到阈值下面"，不是压暗观感）：
1. 外围场 `#cfcdc6` → `#aeaca7`（L .678 → light-grey），并**降到近中性**
   （chroma .024）：暖灰经 JPEG 色度噪声会越过 `.06` 中性线，像素会漏成 "yellow"。
2. 主视觉板保持纸色（**标题压在它上面，铁律 1**）：`#eeece6` → `#e1ded6`（L .859）。
3. 卡片面全部下行一档：dock `#9f9c96`、tile/lib `#b0ada6`、进度轨 `#a5a29c`、
   主题卡 `#b8b5ae`；**袖套内的两块板**（进度块 5.6%、活动条 8.4% 的测量面积）
   原来是 `#e9e7e1` / `#dcdad4`，也一起下行。
4. 网点 + 泼溅从 `body::before` **搬到 `.atmosphere`**（前者被不透明的 `.scene` 盖住，
   写了也看不见）；网点 `rgba(17,17,17,.36) 1.1px / 6px`。
5. `.scene > img`：`grayscale(.85)` → **`grayscale(1)`**。残留的 15% 饱和度正是
   "orange 2.3 / green 2.4" 的来源；顺带 `contrast(.72) brightness(1.56)`
   把插画暗部提成参考图那种"冲洗过的网点灰"。

**收敛过程**（每步都 `relaunch → export → measure`）：

| 版本 | 动作 | paper | light | mid | dark | black |
|---|---|---|---|---|---|---|
| 起点 | — | 77.3 | 2.0 | 1.6 | 3.1 | 5.2 |
| v1.3.0 | 阈值下的灰 + `.atmosphere` 换成灰墨水洗 | 59.4 | 9.5 | 4.4 | 3.2 | 5.3 |
| v1.3.1 | 袖套内两块板下行、灰降温 | 45.7 | 14.9 | 12.6 | 3.6 | 5.3 |
| v1.3.2 | `grayscale(1)`、边缘加墨 | 49.0 | 13.2 | 5.8 | 15.5 | 8.5 |
| v1.3.3–4 | 边缘回浅、螺旋加宽到 52% | 48.4 | 14.1 | 4.7 | 14.8 | 8.6 |
| v1.3.5–7 | 插画分两步提到 `contrast(.72) brightness(1.56)` | **51.0** | **13.5** | **7.6** | 10.2 | **8.3** |
| 参考 | — | 49.8 | 13.2 | 8.5 | 7.7 | 9.0 |

验证：`export-all.js` 全视图 × 2 尺寸 + `--stress` **0 告警**；
`probe-graphics.js` riot `bleed=0x16 clear`。剩下 dark-grey +2.4 是插画自身暗部，
**不再追**（属于"海报 vs 启动器"的结构差异）。
`themes/riot/DESIGN.md` 第 3、4 节已同步（含"挑灰必须低于 L .72"这条硬规矩）。

---

### 上一轮（v1.3.8 → v1.3.9：铁律 3 收口 + RISO 配色收敛）的增量，仍然有效

1. **`export-all.js --parts`：把单独控件裁出来截**（回应"无头测试要能截
   单独按钮部件"）。不再只截整窗，而是对每个可见控件做 `Page.captureScreenshot`
   的 `clip`（默认 `@2x`），落到 `<out>/<theme>/parts/<name>@<size>.jpg`：
   `nav-active / nav-idle / tile-active / tile-idle / cta-primary /
   theme-card-active / theme-card-idle / toggle / progress-fill`。
   用法：
   ```bash
   node tools/export-all.js --themes=grimoire --views=home --parts \
        --part-views=home,appearance --sizes=1439x1124
   ```
   原因：铁律说的是"所有界面"，而**一个把自己的标签裁掉的按钮，在整窗截图里
   是看不出来的**。
2. **`NovaDev.resetSurfaces()`（新增，`src/app.js`）——这是部件出口能工作的前提。**
   导航按钮有一条刻意的守卫：`if (state.overlay) return`（有浮层时不许切视图）。
   而截图工具是直接驱动 DOM 的，跑完 `sleep`/`launching` 这类视图后
   **`state.overlay` 会留在"开"的状态**，于是之后所有 `setup('appearance')`
   的点击被静默忽略——表现就是"外观视图的部件一个都抓不到"（实测
   `.theme-card` 可见数 0/11）。现在 `reset()` 会先调
   `NovaDev.resetSurfaces()` 回到"HOME + 无浮层"的干净状态。
3. **audit 补强**（细节见 §0 的 v1.3.7 段）：`x` / `y` 两个轴分开报，
   `.logo` 即使被拆成 span 也照样检查。
4. 版本：`?v=` → **`1.3.8`**；主题版本不变（`grimoire 1.3.5`、`summer 1.2.9`）。
5. **验收基线**：330 张全量（11 主题 × 2 尺寸 × 15 视图 + `--stress`）**0 告警**；
   部件出口单独验证通过（grimoire：nav/tile/cta/theme-card/toggle 全部抓到）。

### 本轮（v1.3.5 → v1.3.7：铁律 3 的收尾修复）的增量，仍然有效

> 这一段是给「刚接手的人」的差异摘要，细节在下面各节。

1. **appearance 预览标题的横向截断（真 bug，本轮抓到并修掉）**：
   `fitLogo` 只在固定时刻跑（boot / 切主题 / 切视图 / resize / 字体就绪），而外观
   预览面板是**带过渡的**——+140ms 量到的盒子宽度常常不是最终宽度，之后没有
   任何东西再复测。实测 grimoire 停在 `req 472 > avail 450`（横向被裁 22px），
   直到下一次无关的 refit。修法（`src/app.js`）：**框架层加 ResizeObserver 盯住
   每个 `.logo` 的盒子**，盒子一变就重算（超宽就缩，余量 >10% 就放回 1），
   收敛后不再触发。11 套主题一次受益，涵盖「两个测试尺寸之间的任意窗口宽度」。
2. **纵向墨迹截断的正解**：上一轮用 `padding-block: .1em` 顶出墨迹余量，但
   实测各主题 logo 字体的 ascent+descent = **1.20–1.57em**（Space Grotesk 1.28、
   endfield/riot 的字体 1.57），而 `--logo-line` 只有 .86–.94——0.1em 只有需求量
   （最大 ~0.34em）的一半，nova 在 1439×1124 仍被切 4px。正解是**只裁横向**：
   `theme.css` 的 `.appearance-logo` 从 `overflow: hidden` 改成
   `overflow-x: clip; overflow-y: visible`（唯一能"一轴裁一轴放"的写法），
   纵向墨迹从此看得见；`padding-block` **已撤掉**（要盖住 1.57em 的字体得给所有
   logo 加 0.34em 高度，白白撑开版式），留注释防回退。
3. **audit 补强**（`tools/export-all.js`）：`.logo` 即使被拆成 span 也照样检查
   （以前 `el.children.length` 会跳过它）；x / y **分开报**——以前只报 x，
   纵向的 4px 墨迹会被横向溢出「顶掉」，差点漏掉。
4. 版本：`?v=` → **`1.3.7`**；主题版本不变（`grimoire 1.3.5`、`summer 1.2.9`）。
5. **验证基线更新**：11 套主题 × 外观视图，`dx=0 / warnX=false / warnY=false`
   全绿；fit 值 0.81–1.0 之间自动收敛。

### 本轮（v1.3.4 → v1.3.5）的增量，仍然有效

1. **开屏动画 · 新增两套完全不同的仪式**（直接回应「每套主题的开屏必须不一样」）：
   - **GRIMOIRE `seal`（归档仪式）**：羊皮纸页 + 震波 + 四角金点，**火漆印**
     从上方砸下（squash-and-stretch），落定后印**当前选中条目的真实档号**
     （`No.06` = dock 里真实 6 个游戏，取自 `#dockCount`），akai 印章 `已归档`。
     没有时钟、没有星盘、没有百分比条。
   - **SUMMER `sun`（开窗）**：青绿顶带 scaleY 落下 → 地平线接缝 scaleX 拉开 →
     **同心环太阳**（无模糊、无发光）升起，三块白色底板依次弹入
     （`SUMMER` / `SEASON SALE` / `夏日特辑`），页脚三枚 chip 印真实日期/时间/游戏数。
   - 至此 **11 套主题的开屏 preset 全部互不相同**：
     `gilded / aurum / ember / ink / veil / codex / endfield / mnemo / zerohour
     / seal / sun`（此前 `grimoire=codex`、`riso=summer=ink` 是重复的，已消除）。
2. **开屏「可重放」——在程序里加了支持**（回应「这个你得在程序里面加入支持」）：
   `finish()` 会先把 `#introOverlay` 深拷贝进 `overlayStash`，`play()` 找不到节点时
   用 `restoreOverlay()` 还原一份（清掉上次的舞台子节点与 `is-playing`）。
   好处：启动完成后仍可 `window.NovaIntro.play({intro:'seal'})` 重放，
   **无头截图因此能截到开屏**（此前 boot 后再截什么都截不到）。
3. **新增 API**：`window.NovaIntro.isPlaying()`；`src/intro.js` 里
   `STAGE_SELECTOR = '.intro-gs, .intro-mn, .intro-zh, .intro-ef'` 用于还原时清除舞台。
4. 版本：`?v=` → **`1.3.5`**；`grimoire 1.3.5`、`summer 1.2.9`（`intro` 字段变更）。

### 再上一轮（v1.3.1 → v1.3.4）的增量，仍然有效

1. **框架修复 · 铁律 3 的系统性截断**（`src/type.css`，**11 套主题一次受益**）：
   `.logo` 的 `line-height` 一直是 `var(--logo-line, .9)`，而主题普遍把它压到
   .8–.9；宿主只要带 `overflow:hidden`（`.appearance-logo` 就是），**字形墨迹
   会被实打实切掉**。实测 `#appearanceLogo` 盒高 25px、内容高 30px。
   现在框架层统一给 `.logo` 加 `padding-block: .1em`（与字号成正比，行高不动），
   `nova` 与 `grimoire` 的 `appearance clipped=1` 告警同时消失。
2. **GRIMOIRE 黑装帧 v4/v5**：参考图的构图真正落地（深色装帧 + 烫金框 + 羊皮纸卡），
   占比从 paper 61.6%/black 3.0% 收敛到 **paper 49.2%/black 12.9%**
   （参考 46.7% / 12.2%）。经过与教训见第 3 节。
3. **占比量表的两个测量教训**（重要，避免下一轮又白跑）：
   - 量的区域是「左侧 66% × 垂直 9%–72%」，而这一块**几乎就是羊皮纸卡本身**。
     所以想动 paper/black 占比，改卡**外面**的地面收效极小（把 `body`/`.scene`
     全压黑只挪了 3pp），**必须动卡的份量**：`padding` 厚度 + 框的层数。
   - `.hero { box-shadow: inset … }` 会**涂掉 hero 的 padding**，而那圈 padding
     就是「黑色装帧」本身。v4 第一版这么写过，黑占比反而 6.5% → 3.0%，已回退。
4. `?v=` 提到 **`1.3.2`**；主题版本：**`grimoire 1.3.4`**，其余见下表。

### 上一轮（v1.2.9 → v1.3.1）的增量，仍然有效

- **无头截图出口成型**：`tools/export-all.js` 一次跑完「全主题 × 多分辨率 × 多界面」，
  产出图片 + `manifest.json`（带布局告警）。这是铁律验收主入口。
- **`fitLogo` 两处修正**（`src/app.js`）：按**内容盒**测量（`clientWidth - padding`）；
  **先同步收敛再逐帧复测**（原来第一遍在 `requestAnimationFrame` 里，切主题/切视图时
  长标题会真实溢出几帧）。
- **`src/fx-record.js`（新增）**：真实数据 → `<html>` 自定义属性
  （`--nova-no` / `--nova-count` / `--nova-record` / `--nova-hours`…），
  主题纯 CSS 就能印真实编号、时长、启动次数。
- **GRIMOIRE 签名层 v3**：拆掉**无意义的等级菱形【15】**（启动器没有等级概念，还压字），
  改成**档案编号火漆印**——印当前选中条目的真实档号，与 dock 的 `No.01…No.10` 同源。
- **铁律验收工具**：`audit()` 分开报 `logo-text-over`（文字溢出，必修）与
  `deco-bleed`（装饰出血，提示）；`tools/probe-graphics.js` 证明装饰不压别人的文字；
  `--stress` 用真·40+ 字长名并且**用完还原**。
- **修掉一个真截断**：`.activity-title` / `.activity-desc` 原来 `nowrap + ellipsis`，
  34 字游戏名被切 32px，改成换行自适应。

---

## 1. 一分钟交接

- 项目：`E:\网页小工具\游戏启动器\nova-game-space-desktop`（.NET 10 + WPF + WebView2）。
- 共 11 套主题：内置 `nova` + 10 套附赠（`aurum` / `endfield` / `codex` / `zerohour` /
  `mnemo` / `riot` / `grimoire` / `riso` / `summer` / `broadcast`）。
- 本轮只做视觉精修，**没有改启动流程、没有改数据结构**。布局只有一处例外
  （SUMMER/BROADCAST 的标题块 `display` 修正，见第 2 节），另有若干通用修复。
- 构建状态：`dotnet build -c Debug` **0 错误**；所有 `theme.json` 合法。
- 静态资源版本 `?v=` **1.3.9**；主题版本（用户目录副本靠它刷新）：

  | 主题 | version | features | intro |
  |---|---|---|---|
  | nova（内置） | — | — | gilded |
  | aurum | 1.0.6 | （未启用框架） | aurum |
  | endfield | 1.0.2 | （未启用框架） | endfield（自建舞台：真实时钟/年份） |
  | codex | 1.0.6 | starfield / foil / double | codex |
  | zerohour | 1.0.5 | scanline / — / bracket | zerohour（自建舞台） |
  | mnemo | 1.0.10 | map / emboss / folder | mnemo（自建舞台） |
  | riot | **1.3.7** | paper / ink / — | ember |
  | grimoire | 1.3.5 | parchment / — / — | seal |
  | riso | **1.2.12** | riso / — / — | ink |
  | summer | **1.5.0**（v2 杂志跨页 + `beach.svg`，**另一个会话接手**） | photo / — / — / **scrim:none** | sun |
  | broadcast | 1.1.10 | film / — / — | veil |

  > `scrim` 是本轮新加的框架通道（`src/theme-fx.css` §7）：声明 `"scrim":"none"`
  > 就关掉 `src/theme.css` 压在 `.atmosphere` 之上的照片白纱。summer 1.5.0 保留了它。
  > 版本表以 `python -c "…glob('themes/*/theme.json')…"` 的实读为准，本轮已核对一遍。
  > **改动过的主题 CSS 必须 bump `theme.json` 的 `version` 并重启**（`theme.json` 只在扫描时读）。


### 立刻能跑起来

```bash
cd nova-game-space-desktop
./tools/relaunch.sh                      # 杀进程 + 重建 + 同步主题 + 起 CDP
node tools/export-all.js --views=home,detail,home-stress --stress \
     --sizes=1439x1124,960x600           # 全主题 × 3 界面 × 2 尺寸，带告警
node tools/probe-graphics.js             # 装饰出血是否压字（铁律 1）
python tools/measure-ratio.py --all      # 配色占比差距
```

`export-all.js` 是**铁律验收主入口**（本轮成型）：图片落到 `<out>/<theme>/<view>@<WxH>.jpg`，
同时写 `manifest.json`。告警含义：

| 告警 | 含义 | 是否必须修 |
|---|---|---|
| `overflow-x=` | 页面横向溢出 | 必修 |
| `clipped=N` | 元素被 `overflow:hidden` 截断 | 必修（铁律 3） |
| `logo-text-over=` | 标题文字超出内容盒 | 必修（铁律 3/4） |
| `deco-bleed=` | 主题有意让装饰出血 | 提示；用 `probe-graphics.js` 确认不压字即可 |

> `relaunch.sh` 是必需的：`theme.json`（version/features/tokens）只在扫描时读，
> 且主题要同步到 `%LOCALAPPDATA%\NOVA Game Space\themes` 才生效。


---

## 2. 这轮改了什么（按主题）

参考图在 `E:\网页小工具\游戏启动器\新主题参考\`（不在仓库内，不随包提交）。

| 主题 | 参考图 | 本轮定向 |
|---|---|---|
| RIOT | 新主题1.png | 白纸专辑封套、右缘裁切黑胶、灰墨泼溅 + 朱红毛笔螺旋、Saira 900 宽体重黑、手写旁注 |
| GRIMOIRE | 新主题2.png | 羊皮纸角色卡、四角金点、双线金框、黑色外框、酒红标题条/进度条/活动条、**档案编号火漆印**（v3，替换掉无意义的等级菱形【15】） |
| RISO | 新主题3.png | 蓝底海报 + 白色窄字区、蓝字酸黄错印、四芒星徽记、酸黄三角、越界 `AA` |
| SUMMER | 新主题4.png | 青绿顶带、天空渐变主视觉、青色细线接缝、酸柠胶带、三行文字各带独立白底板 |
| BROADCAST | 新主题5.png | 无顶线、胶片式中灰渐变、半融黑胶、带刻度虚线路由、星芒衬线大写、幽灵字 |

另外精修：**CODEX**（星点场、星盘刻度环、活动条蜡封、详情铭牌改暗色）、
**MNEMO**（档案夹切口、CLASSIFIED 印章、等高线地图、EXHIBIT 展签、衬线标题）、
**ZERO HOUR**（青柠 L 形角标、分段信号轨）。

### 新增 / 重构的文件

```
src/theme-fx.css                    可选特征框架（纹理 / 字体图层 / 面板），已加入 csproj
src/fx-layers.css                   Photoshop 式图层效果（描边 / 投影 / 渐变 / 内发光）
src/fx-record.js                    数据桥：真实档号/时长/次数 → <html> 自定义属性
themes/riot/assets/{splatter,spiral}.svg + Saira.ttf + OFL
themes/riso/assets/{streaks,star,halftone}.svg
themes/summer/assets/{seams,dots,arrow}.svg
themes/broadcast/assets/{sparkle,route}.svg
tools/export-all.js                 无头截图总出口（全主题 × 多尺寸 × 多界面 + manifest）
tools/probe-graphics.js             装饰出血是否压到别人文字（铁律 1 的检测器）
tools/probe-logo.js                 标题适配诊断（--logo-fit 是否真的生效）
tools/relaunch.sh                   杀进程 + 重建 + 同步主题 + 起 CDP（一次搞定）
tools/measure-ratio.py              配色占比量表（见第 3 节）
```

### 通用修复（与其他主题无关，但别回退）

1. **标题适配 `fitLogo`**（`src/app.js`）：
   - 按**内容盒**测量（`clientWidth - padding`）。主题用 `padding-right` 给徽记
     预留的空地，不会再被文字占用。
   - **先同步收敛**（两趟）**再逐帧复测**（最多 3 帧）。原来第一遍在
     `requestAnimationFrame` 里，切主题/切视图时会真实溢出几帧。
2. **`.type-recipe-name` 用 ellipsis 硬切**：违反「不允许截断」铁律，
   已在 `theme-fx.css` 顶部改为换行。
3. **`.activity-title` / `.activity-desc` 用 ellipsis 硬切**（`src/theme.css`）：
   34 字游戏名被切 32px（`export-all.js` 的 `--stress` 抓到的真 bug）。
   活动条没有固定高度，改成 `white-space: normal; overflow-wrap: anywhere` 自适应。
4. **SVG 图标被版本替换误伤**：批量替换 `1.2.x` 时把 `i-trash` 的路径坐标
   `1.2.6` 改成了 `1.2.7`，已修复。**下次改版本号只替换 `?v=` 后面的串。**
5. **`tools/export-all.js` 的 audit 是 `String.raw` 模板**，整段注入到页面里执行：
   里面**不能出现反引号**（写了反引号的注释会让模板提前结束，报
   `String.raw(...).logo is not a function`）。要引类名就写单引号。
6. **logo 的"合身"由 ResizeObserver 兜底**（`src/app.js` 的 `watchLogos()`）：
   改 logo 相关样式后不必再手动补 `setTimeout(refitLogos, …)`，
   但要保证 `.logo` 的盒子宽度**由容器决定**；如果哪天给 logo 加了
   `width: fit-content`，观察器会因为"改字号 → 盒子变宽 → 再改"自激，必须先去掉观察。


---

## 3. 配色占比量表（本轮的核心方法）

精修时不要只看色值，**要量面积**。参考图和我们实机截图的对比跑一条命令：

```bash
python tools/measure-ratio.py --all
```

输出（节选，2026-10-19 最后一轮）：

```
== riso
   bucket          ref   ours     gap
   blue          49.1%  44.0%   -5.1
   paper         15.9%  11.0%   -4.9
   yellow        14.8%  14.9%   +0.1
   white         12.5%  12.4%   -0.1
   violet         4.9%   3.2%   -1.7
```

> 这就是 riso **收敛后**的样子（v1.2.12）：蓝与纸各差约 5pp，两个签名色已经重合。
> 残差见 §0.2 —— 是测量区里的 dock 卡面插画，不是主视觉。

口径：
- 参考图整图统计；实机截图只取**左侧 66% × 垂直 9%–72%** 的主视觉区
  （右侧是游戏封面，会把统计带偏）。
- 先按**色度**（`max-min`）判断中性色，再按亮度分档；暖白纸（`l>0.72`、
  `chroma<0.20`、色相 <70°）归入 `paper`。
  **这一步的顺序很关键**：先按色相分类会把羊皮纸算成「黄」，上一轮因此错判了一整轮。

### GRIMOIRE 收敛过程（记录口径，别重复踩）

| 版本 | 动作 | paper | black | orange | 结论 |
|---|---|---|---|---|---|
| v3 | 黑框加厚到 ~22px 环 | 61.8% | 6.5% | 6.4% | 只动卡外，收效小 |
| v4(错) | 又给 `.hero` 加 `inset` 金影 | 61.6% | **3.0%** | 10.0% | **涂掉了装帧**，回退 |
| v4.1 | 压暗 `.scene`（插画）+ 暗角 | 59.0% | 6.6% | 6.5% | 方向对，量不够 |
| v5 | `padding` 26→`clamp(46px,4.2vw,74px)` + 15px 烫金外框 + 卡内第二道金线 | **49.2%** | **12.9%** | 11.2% | 与参考基本重合 |
| 参考 | — | 46.7% | 12.2% | 11.8% | yellow 仍差 1.8pp（3.5% vs 1.7%） |

> 这轮真正起作用的是**最后一件**：加厚 `.hero` 的 padding（缩卡 → 纸转黑）
> 并在**卡外**钉一条 15px 烫金外框（补 orange）。压暗插画只是辅助。
> 参考图的黄是 3.5%，我们 1.7%；如果还要追，加宽卡内那道浅金细线即可，
> **不要去动标题**（铁律 1）。

### 当前差距（需要继续收敛的项）

| 主题 | 现状 | 说明 |
|---|---|---|
| **SUMMER** | **已由 v2 方案接手（1.5.0）**，占比数字需重新测 | 主线 = 纸白杂志跨页 + `beach.svg` 手绘插画 + 墨色衬线标题 + 酸柠高亮。我这一轮测到的最后数字（v1.4.0 渐变地貌，已删）：blue 39.7 / paper 17.6 / cyan 12.2 ✓ / yellow 6.7 ✓ / white 15.3 / black 3.9 / orange 0.3 / mid-grey 0.5 / dark-grey 2.0。**v2 落地后必须重跑 `measure-ratio.py`**，参考目标见 §0.2 |
| BROADCAST | paper 44% vs 54%，light-grey 26% vs 16%，dark-grey 2% vs 8% | 灰度层次没拉开：该亮的地方不够亮，该暗的地方不够暗。**动手前先按 §0.1 发现 B 检查它有没有被框架白纱洗过** |

> SUMMER 那四个"缺"（black / yellow / orange / mid-grey）当时其实是同一件事：
> 深色块与黄块要么写在了被白纱洗淡的 `.atmosphere` 上，要么落在被白色活动条盖住的区域。
> **这套诊断对 v2 同样成立**：v2 把 `.atmosphere` 关掉后自己铺纸面，
> 所以「文字底板/活动条盖住了哪些面积」这条几何账（§0.3）仍然是算占比的依据。

> RIOT 已收敛（见 §0.3）：paper 51.0 vs 49.8、light-grey 13.5 vs 13.2、
> mid-grey 7.6 vs 8.5、black 8.3 vs 9.0，只剩 dark-grey +2.4。

> 判断标准：**数值只是线索，不是 KPI**。界面的可读性优先于百分比；
> 想继续压某一色时，先确认它压的是装饰面积，而不是正文底。

---

## 4. 已知问题 / 下一轮建议（按优先级）

### 4.1 优先做

1. ~~**每主题独立开屏动画**~~ **本轮已解决（v1.3.5）**：11 套 preset 全部不同，
   并加了「可重放」支持便于无头截取。见第 0 节第 1、2 条。
   仍需往下做的：把 `intro.css` 里 CSS-only 的几套（`ink` / `veil` / `ember` /
   `gilded` / `aurum`）也逐步换成**各自动用真实数据**的舞台（现在是共用 astrolabe
   + `%` 计量条的变体，虽然颜色/节奏不同，但骨架仍有共性）。
2. ~~**RIOT 的中灰面积**~~ **本轮已收敛（themes/riot v1.3.7）**：见 §0.3。
   结论是一句话——**挑灰必须低于 `L .72`**，否则计量表一律算 paper；
   要改整页色调，先看 `.atmosphere` 铺的是什么（它才是唯一可见的整屏层）。
3. ~~**RISO 的酸黄 + 纸量**~~ **本轮已收敛（v1.2.12）**：见 §0.2。
   教训比数字重要——**先裁切参考图再看**，别凭印象定结构；
   占比不对时先怀疑**主题自己的全视口遮罩层**（`.atmosphere`），
   它能把整页色调洗掉而不出现在任何 `elementFromPoint` 的线索里。
4. ~~**无头截图继续做全**~~ **v1.3.8 已做**：`export-all.js --parts` 把单独控件裁出来
   （`nav-active` / `tile-active` / `cta-primary` / `theme-card-active` / `toggle` /
   `progress-fill` 等 9 个选择器 @2x）；`context` / `dialog` / `notif` / `profile` /
   `launching` / `sleep` / `scanner` / `editor` 也已覆盖。
   开屏可用 `node tools/drive.js` + `window.NovaIntro.play({intro})` 截取。
   仍需补的：`cta-secondary` 与 `progress-fill` 在「当前数据下选不中 / 隐藏」
   （没有播放进度时 `.progress-fill` 不可见），要么给个造数据的开关，要么换选择器。


### 4.2 可以做

5. **SUMMER 的地貌**（本轮从"天空比例"升级为完整重构）：见 **§0.5**，四步走。
   本轮已把参考图结构与实机几何全部量化（§0.2 / §0.3），**不要重新量一遍**，
   直接照着画 + `measure` 复核。
6. **BROADCAST 的灰度层次**：参考图是亮灰为主，我们偏暗。把 `::before` 渐变整体提亮一档；
   **先按 §0.1 的发现 B 检查它有没有被框架白纱洗过**（broadcast 也用了 `.atmosphere`）。
7. **概念板与实机的一致性**：`tools/theme-concepts.html` 里的 `nt-*` 板块已经跟着改过
   顶部与主视觉色块，但 GRIMOIRE 的黑框、RIOT 的灰面还没同步。
8. **AURUM 的外观预览**仍是基础卡片（覆盖表标 `△`），可以统一成铭牌 + 编号条。
9. **每主题 `DESIGN.md`（设计规范与设计理念）**：**10 套已写**
   （grimoire / summer / riot / riso / broadcast / codex / mnemo / zerohour /
   aurum / endfield），**只剩 `themes/nova/DESIGN.md`**（内置默认主题）。
   每套要写清：参考图 → 提炼出的语言 → 落到哪些 `data-fx-*` 通道与签名层规则，
   以及「为什么这样设计」（GRIMOIRE 的【15】就是反面教材：符号无意义还压字）。

### 4.3 不要做

- **不要在主题 CSS 里跟框架的 `.atmosphere` 白纱对轰**（发现 B）：要关就走
  `theme-fx.css` 的 `data-fx-scrim` 通道（§0.1），别在主题里 `!important` 覆盖框架层。
- **不要靠 `elementFromPoint` 判断背景层**（发现 C）：它会返回 `body`，
  `elementsFromPoint` 会跳过 `pointer-events:none` 的 `.scene-stack/.scene/.atmosphere`。
  用「读 CSS → 加彩色临时层 → 重截取样」。
- **调试用的彩色 `!important` 层测完必须删干净**（本轮差点把 `DEBUG-PROBE` 留在
  `themes/summer/theme.css` 里交接出去）。交接前搜一遍关键词。
- 不要把 `theme-fx.css` 里的模块改成「默认开启」。它们是**可选**的，
  主题在 `theme.json` 的 `features` 里声明才生效，不写就是无副作用。
- 不要在主题 CSS 里改布局（`display`/`position`/大幅 `padding`）。
  本轮唯一的例外是 SUMMER/BROADCAST 的 `display: block; width: fit-content`，
  那是为了修标题块挤成一行，已经验证无溢出。
- 不要用柔和渐变/玻璃模糊/发光（项目铁律，`docs/THEMES.md` 3.3）。
- 不要复制官方素材。参考目录只用于提炼语言，所有纹理都是本项目几何绘制；
  Saira 是 OFL 字体，许可随附。
- **不要给标题加无意义的徽记**。任何压在标题上的图形都要先问：
  这个符号在「启动器」里有对应的真实数据吗？没有就别加（GRIMOIRE【15】的教训）。

---

## 5. 验收清单（每改一轮都要过）

```bash
./tools/relaunch.sh                      # 重建 + 同步主题 + 起 CDP（必须先做）
node tools/export-all.js --views=home,detail,home-stress --stress \
     --sizes=1439x1124,960x600           # 必须 0 告警
node tools/export-all.js --parts --part-views=home,appearance   # 单独控件裁切
node tools/probe-graphics.js             # 必须全 clear
python tools/measure-ratio.py --all      # 看差距是否缩小
```

逐项检查：

- [ ] `export-all.js` 无 `overflow-x` / `clipped` / `logo-text-over` 告警
- [ ] `probe-graphics.js` 全 clear（装饰出血不压别人的文字，铁律 1）
- [ ] 标题 `--logo-fit` 生效，且 40+ 字长名（`--stress`）不溢出（铁律 4）
- [ ] 无任何 ellipsis 截断（铁律 3）；新加 `nowrap` 前先想清楚宽度上限
- [ ] 右键菜单、编辑器 `select`、构图控件跟随主题
- [ ] 960×600 与 1439×1124 两档都看
- [ ] 切回 NOVA 后 `data-fx-*` 全部清空
- [ ] **本次用的彩色调试层已删干净**（搜 `DEBUG-PROBE` / `!important` 新增项）
- [ ] 改过主题 CSS 就 bump `theme.json` 的 `version`（坑 #8）
- [ ] 改过 `src/*.js|css` 就 bump `index.html` 里的 `?v=`（整串替换，别动 SVG 坐标）


---

## 6. 文件地图（本轮相关）

```
themes/<id>/theme.css        主题样式；签名层追加在文件末尾，按段落注释分隔
themes/<id>/theme.json       id / version / features / intro / tokens
themes/<id>/assets/          预览图 + 本主题专属 SVG/字体
src/theme-fx.css             可选特征框架（texture / type / panel 六条通道）
src/fx-layers.css            图层效果（描边/投影/渐变/内发光），纯 CSS 文本图层
src/fx-record.js             数据桥：真实档号/时长/次数 → <html> 自定义属性
src/theme-engine.js          读取 features → 根元素 data-fx-*；写入 tokens
src/app.js                   applyTheme / fitLogo / NovaDev 开发钩子（长标题压测）
src/intro.js                 开屏 preset 注册表 + 自建舞台 + **可重放**（`play`/`isPlaying`）
src/intro.css                开屏样式；每个 preset 一段，`[data-intro="<id>"]` 作用域
src/index.html               静态资源清单，`?v=` 版本号在这里
tools/export-all.js          无头截图总出口（含 audit 与 --stress 与 --parts 部件裁切）
tools/probe-one.js           单主题单视图跑一段 DOM 探针（`<theme> <view> <WxH> <exprfile>`）
                             比 drive.js 多一步：会先 setDeviceMetrics + resetSurfaces + 切主题/视图，
                             用来量「那个格子到底多宽」这类几何问题
tools/_probe.tmp.js          可复用的**几何探针**（一次报出 topbar/scene/atmosphere/stage/hero/
                             hero-logo/tagline/meta/cta/progress/activity/dock 的盒子 + 视口 Y% +
                             占测量区百分比 + 计算样式）。`node tools/probe-one.js summer home 1439x1124 tools/_probe.tmp.js`
tools/_hit.tmp.js            命中测试（`elementsFromPoint` 逐点打印元素链）——**注意它是假线索**，
                             见 §0.1 发现 C；只用来确认"文字底板是谁"
tools/_layers.tmp.js         层属性探针（opacity / mask / filter / mix-blend-mode / ::before/::after
                             的 content+bg+img+opacity）。**发现 A（`.scene` opacity 0）与发现 B
                             （`.atmosphere::before` 白纱）就是它读出来的**，值得留着复用
_review/bandmap.py           逐行 / 逐列 bucket 网格图（参考图 vs 实机），比 measure-ratio.py 更细：
                             `python _review/bandmap.py 新主题参考/新主题4.png _shots/export/summer/home@1439x1124.jpg 28`
                             （第 3 个参数 = 行数；输出每行的 top-4 bucket + 左/中/右取样色）
_review/                     临时裁剪图与脚本的落点（**不在仓库提交范围内**）。注意 Git Bash 下
                             `/tmp` 被映射到别处，裁剪/截图统一写到 `E:/网页小工具/游戏启动器/_review/`
tools/probe-graphics.js      装饰出血压字检测（铁律 1）
tools/probe-logo.js          标题适配诊断
tools/relaunch.sh            重建 + 同步主题 + 起 CDP
tools/measure-ratio.py       配色占比量表（口径见第 3 节）
tools/theme-concepts.html    十一张主题概念板源文件
tools/render-concepts.js     渲染概念板 → 缩到 960×540
docs/THEMES.md               第 15 节：特征框架 + 量化方法 + 签名素材
docs/THEME-COVERAGE.md       界面覆盖清单（每套主题都要过一遍）
docs/HANDOFF.md              项目全貌与历次变更
```

### 主题 CSS 的阅读顺序

每个 `theme.css` 都是「基础层 → 参考修正层 → 签名层」三段叠加，
后写的覆盖先写的。改样式时**优先在文件末尾追加**，并写清注释，
不要回头改前面的基础层，否则很难判断哪条规则在生效。
被新签名层取代的旧规则**要删掉**（只留一行指针注释指到新位置），
否则两套几何会叠在一起——GRIMOIRE 的徽记就踩过这个坑。

---

## 7. 一句话总结现状

**十套**附赠主题已经从「共用一套模板」变成各有独立的视觉签名（专辑封面 / 羊皮纸角色卡 /
双色海报 / 夏日照片 / 灰阶广播 / 星盘秘典 / 雾紫档案 / 黑底命令台…），顶部装饰也已按
参考图逐套改正；**无头验收现在能证明铁律 1/3/4**（`export-all.js` 0 告警 +
`probe-graphics.js` 全 clear，含 40+ 字长名压测），并且已经连着两轮把「文字被切」
这类**跨主题的系统性铁律 3 问题**在框架层一次修掉（v1.3.7 的纵向墨迹 + 横向喂回，
v1.3.9 的 `.stat-value` 数值自适应）。开屏可重放、可截取；单独控件也能 `--parts` 裁出来。

配色占比上，**GRIMOIRE / RISO / RIOT 三套已经收敛**：
- GRIMOIRE：paper 49.1 vs 46.7、red 20.8 vs 21.0、black 12.3 vs 12.2、orange 10.6 vs 11.8，
  只剩 yellow 2.5 vs 3.5。
- RISO：blue 44.0 vs 49.1、paper 11.0 vs 15.9、**yellow 14.9 vs 14.8 ✓**、
  **white 12.4 vs 12.5 ✓**、violet 3.2 vs 4.9。
- RIOT：paper 51.0 vs 49.8、**light-grey 13.5 vs 13.2 ✓**、**black 8.3 vs 9.0 ✓**、
  mid-grey 7.6 vs 8.5、red 9.2 vs 9.8，只剩 dark-grey +2.4。

> 三套的根因是同一个：**主题自己的 `.atmosphere` 全视口纱**把整页洗成纸色/白色
> （RISO 白纱 96%、RIOT 白纱 90→96%）。加上 RIOT 的第二个坑——**挑的"灰"
> 全部卡在计量表的 paper 阈值（`L > .72`）上方**。改占比之前先做这两件事：
> ①读 `.atmosphere` 现在铺什么；②把候选色值代进 `bucket()` 算一遍。
>
> **本轮把这个教训推进了一步**：SUMMER 遇到的是同一层的**框架版**白纱
> （`src/theme.css` 的 `.atmosphere::before`，`--scrim-rgb` 97%→0 横铺），
> 而且 `.scene` 还被主题关掉了（`opacity: 0`）。所以 SUMMER 的两段修改
> 大部分没显出来。**下一手的第一件事是加 `scrim` 通道把它关掉**（§0.1 / §0.5）。

剩下的工作：**SUMMER 的 v2 方案收敛**（主线在另一个会话手里，见 §0 开头；
参考目标值在 §0.2、面积账在 §0.3）、BROADCAST 的亮灰层次、GRIMOIRE 的黄；
把 CSS-only 的几套开屏（`ink`/`veil`/`ember`/`gilded`/`aurum`）逐步数据化
（RIOT 的 `ember` 也还欠一个"唱片出套"舞台）；
补 `themes/nova/DESIGN.md`；以及 `--parts` 里 `cta-secondary` / `progress-fill`
两个选不中或隐藏的选择器。

**本轮新增的框架资产（别撤）**：`src/theme-fx.css` §7 的 `scrim` 通道
（`data-fx-scrim="none"` 关掉压在 `.atmosphere` 之上的照片白纱）+
`?v=` 1.3.10。SUMMER 1.5.0 已经在用。

---

## 8. 本次未能完成 / 需要用户确认的事

1. **20 分钟提醒的定时任务无法在本会话创建**：本会话本身就是一个定时任务会话，
   不能再创建自动化。定时提醒由用户侧维护（`/cron` 或 Automations 页面）。
   每次提醒触发时，按第 5 节跑一遍并更新本文件。
2. **【深渊】/`abyss` 主题在这份构建里不存在**：`themes/` 下只有
   `aurum / broadcast / codex / endfield / grimoire / mnemo / riot / riso /
   summer / zerohour` 十套 + 内置 `nova`。用户点名「终末地、默认、【深渊】不用改」
   中的前两个已按要求不动；`abyss` 无从修改，需要在别的分支/版本里确认。
3. **黑装帧后的整体观感需要一次人工确认**：GRIMOIRE 现在把游戏插画压到了
   `brightness(.45) + sepia(.42)`（参考图的语言是「深色装帧 + 镶嵌的卡」）。
   数值对上了、暗环与烫金框也对了，但「插画被压这么暗是否可接受」是审美决定，
   交接方如果有异议，把 `themes/grimoire/theme.css` 末尾 v4.1 段的
   `brightness(.45)` 抬到 .6–.7 即可，代价是 paper 会回升约 3–4pp。
