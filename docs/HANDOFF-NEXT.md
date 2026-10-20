# GUGUOVA 下一轮交接文档

> 交接版本：**1.9.0**
> 交接时间：2026-10-21
> 上一轮：1.8.0（Steam 经典未通过）
> 产物：源码与主题已更新，版本号已 bump 至 1.9.0

---

## 0. 本轮重做（2026-10-21）

三套被判「太丑」的主题已整体重做，不是换色：

| 主题 | 版本 | 新构图 | 开屏 | 切换 | 进游戏 |
|---|---|---|---|---|---|
| 黄昏之炼 `dusk` | 2.0.8 | 暮色天幕 + **委托信**：撕边、图钉、麻绳、贴照、已受理章、火漆印、炼金环 | `.intro-dk2` 天空/太阳/远山/炼金环/纸页/火漆 | **拆信封**：封盖折回 + 红绳 | `dlDusk` |
| Steam 经典 `steam` | 2.0.8 | Steam Big Picture：全幅封面 + 炭黑控制台 + 底部「最近游戏」陈列架 + 手柄键位条 | `.intro-st2` 字标/蓝色进度/封面滑入/焦点环 | 游戏 tile 放大 + 焦点环 | `stMax` |
| 夜航 `nightflight` | 1.0.8 | 登机牌主视觉 + 舷窗 + 撕口 + 条码 + DEPARTURES 航班表 + 登机牌卡片网格 | `.intro-nf` 分瓣字离港 | 登机牌对撕 + 扫描线 | `nfLaunch` |

要点：

- 三套主题的**结构**彼此不同：Dusk 是工房板上的委托信，Steam 是客厅大屏，Night 是登机牌 / 机场信息屏；
  遮住文字只看轮廓也能区分。
- 开屏、幕布、进游戏、按钮、导航、dock、库、外观、设置、详情、对话框全部重写。
- 三套主题的 **16 个音效全部重做**：使用 genny（`tools/sfx-specs/make-themes-2.2.py`），
  Dusk 陶土/木/纸/玻璃/低弦，Steam 电磁阀/控制台/低频合成，Night 翻牌/机场铃/风/PA 人声；
  全部 mono / 44.1k / OGG，峰值 -1dB，`sharp ≤ 1.6`、`above5k ≤ 3%`。
- 三套主题**禁止任何模糊**：`appearance-bg`、`detail-art::before`、`launch-bg` 禁用，
  所有 `backdrop-filter` 置 none；外观预览改为**全幅封面 + 主题标题框 + 底部游戏切换条**，
  与 CODEX / SUMMER / ENDFIELD 的结构一致。
- 外观预览与其它主题统一：全幅封面、底部渐变标题框、底部游戏切换条；
  隐藏「继续游戏」按钮、`GUGUOVA 默认` 说明与时长。
- 编辑器 / 扫描器 / 右键菜单：纸面主题改为纸底墨字，深色主题逐项检查，不再出现白字看不见。
- 夜航游戏库改回与其他主题一致的 **16:9 卡片网格**（卡片做成登机牌票根），不再用 FIDS 行列表。
- 夜航旧版 `kern-1mvba4m`（KERN 生成）已备份到 `_shots/backup-themes/kern-1mvba4m-20261021/`
  并从 `%LOCALAPPDATA%\NOVA Game Space\themes\` 移除，避免两个「夜航」。
- 预览图：三套已用 `tools/theme-concepts.html` 的默认概念板重画并缩到 960×540；
  黄昏的概念板也已改成委托信。
- 音效：三套均已在 `theme.json` 登记 16 个 cue；Night 的 PA 人声「boarding」在 `boot` / `launch`。

下一轮仍要做的事：Win7 真机、物理手柄、Steam 全流程、音频听感、无模糊回归、预览图微调、文档收口。
`docs/HANDOFF-NEXT.md` 下方 §4–§7 保留 1.8.0 的判断与 Steam 返工方案，作为历史记录；
**当前实现以三套主题的 `theme.css` / `docs/themes/*.md` 为准**。

---

## 1. 一句话状态

应用 **1.9.0**，共 **14 套主题**（nova + 13 套），三套重做主题（dusk / steam / nightflight）
已完成构图、开屏、切换、进游戏、音效与细节层；1.9.0 单文件版 / 完整版已重新打包。
本轮没有新增功能，重点是把「像网页卡片」的三套主题改成有结构、有材质、有专属动画的界面。

下一轮的重点是**真机与听感验收**：Win7、物理手柄、Steam 全流程、逐主题试听，
以及把「无模糊 / 字体可读 / 预览统一」三条加进回归清单。

---

## 2. 先读什么

1. `docs/themes/dusk.md` / `steam.md` / `nightflight.md` —— 三套重做主题的当前接口与构图。
2. **`docs/DESIGN-PHILOSOPHY.md`** —— 六条硬规则、14 套主题卡；§5.12 / §5.13 / §5.14 是本轮三套。
3. `docs/THEME-INTERFACES.md` —— 选择器、开屏、幕布、字体契约；§12 新增「禁止模糊」。
4. `docs/SFX-MAP.md` §4 —— genny 三套音效配方与检查门槛。
5. `docs/HANDOFF-THEMES.md` §0.00 —— 主题层的精修方法（配色占比、量测脚本）。
6. 本文 §4–§7 是 1.8.0 的历史判断，保留作对照，不是当前待办。

---

## 3. 版本基线

应用：**1.9.0**（`version.json` 是唯一版本源）；品牌：**GUGUOVA**；
仓库：`https://github.com/118coder/guguova-game-space`。

| 主题 | 版本 | 状态 | 开屏 | 切换 |
| --- | --- | --- | --- | --- |
| nova（内置） | 2.0.1 | 保留区 | `gilded` | 双幕布 |
| aurum | 1.0.14 | 保留区 | `aurum` | 青铜门 |
| endfield | 1.0.10 | 保留区 | `endfield` | 蓝图切角 |
| zerohour | 1.0.13 | 保留区 | `zerohour` | 换台滚动 |
| codex | 1.7.6 | 稳定 | `codex` | 翻页 |
| broadcast | 1.4.7 | 稳定 | `broadcast` | CRT |
| summer | 1.8.8 | 稳定 | `draft` | 白纸排版 |
| riso | 1.4.6 | 稳定 | `riso` | 双印版 |
| riot | 1.5.8 | 稳定 | `vinyl` | 舞台幕布 |
| grimoire | 1.5.7 | 稳定 | `seal` | 羊皮纸 + 蜡封 |
| mnemo | 1.1.8 | 稳定 | `mnemo` | 记忆条带 |
| **dusk** | **2.0.8** | **重做完成** | `dusk` | 信封拆开 |
| **steam** | **2.0.8** | **重做完成** | `steam` | tile 放大 |
| **nightflight** | **1.0.8** | **新主题** | `nightflight` | 票根对撕 |

主题总数：**14**（nova + 13 套主题）。旧 `kern-1mvba4m` 已备份并移除。

---

## 3b. 下一轮交接清单

### P0 · 真机

- Win7 SP1 x64 + .NET Framework 4.8 + WebView2 109：解压 1.9.0 legacy-single，验证启动 / 扫描 / 计时 / 设置 / 导入导出 / 三套新主题切换 / 托盘 / 安全档。
- Xbox 与 DualSense 各接一次：焦点环、摇杆重复、A/B、LB/RB、RS/LS、`select` 档位循环；三套新主题的 dock / 库 / 设置 / 详情 / 编辑器都要可达。

### P0 · 三套主题回归

- 用 `export-all.js --themes=dusk,steam,nightflight --views=all --sizes=1439x1124,960x600 --stress` 重跑；
  当前基线是 **96 张，0 截断 / 0 溢出**。
- 外观页三套必须保持：全幅封面、主题标题框、底部游戏切换条、无 CTA / 时长、无模糊。
- 编辑器 / 扫描器 / 右键 / 设置：纸面主题不得出现白字；深色主题检查输入框与占位符。
- 黄昏：委托信图钉/麻绳/贴照/印章/火漆不得压文字；拆信封切换在 960 下不露旧界面。
- Steam：全幅封面在 960 下不与 dock 重叠；tile 放大切换不出现白边框残留。
- 夜航：游戏库 16:9 卡片网格与其它主题一致；票根对撕切换不露旧界面。

### P1 · Steam 全流程

SteamStub 游戏与普通游戏各跑一遍：未登录冷启动、登录后启动、进程出现计时、退出结算、`launchMode` 三种模式。

### P1 · 音频听感

逐主题试听 16 个 cue；本轮新合成后重点听：

- dusk：木扣 + 纸噪是否过干，马林巴/玻璃是否偏亮；
- steam：solenoid 点击是否过尖，boot 的低频 A1 是否盖住钟；
- nightflight：翻牌三连是否过密，PA「boarding」是否清楚、是否像广播。

### P2 · 预览与文档

- 三张概念板缩略图已重画；如继续换季，只改 `tools/theme-concepts.html` 后重渲染，不再直接截应用图。
- `docs/HANDOFF.md` / `docs/THEMES.md` 仍在用 NOVA 叙述，可择机合并。
- 旧 `kern-1mvba4m` 已备份并移除；如果用户机器上还有旧副本，提醒在「外观」里删除。

---

## 4. 这一轮为什么被判丑

先承认结论：**问题不在配色，在构图和层次**。把 1.8.0 的首页拆开看：

- 一个圆角矩形里塞了一张亮色横图、下面一块深蓝、右边一张小卡；
- 除了「绿色按钮 + 蓝字」之外，没有任何东西让人相信这是一个**客户端**；
- 亮图（示例封面是浅色排版稿）和深蓝面板之间硬切，整块画面被拦腰截断；
- 右栏那张卡里写的是「Steam 游戏库 / 沉睡的法则 / 0 小时 / 3 小时前」，
  和左边已经写过的游戏名、时长重复，读起来像贴错了位置。

更根本的一点：**这套主题只是「给卡片加了标题栏」**，没有把客户端的结构做出来。
Steam 客户端之所以像客户端，是因为它有**左侧库栏、密集的行、状态区、次级链接**，
而不是因为它有深蓝色和绿色按钮。

反过来看黄昏之炼，虽然没被打回，但也有同样的毛病：
**纸页右下的留白没有内容支撑，取样尺寸太小，整页更像一张表单而不是工作台**（见 §5.2）。

---

## 5. 问题清单（可逐条勾）

截图位置：`_shots/steam/steam/*.jpg`、`_shots/dusk3/dusk/*.jpg`（都在本机，未进仓库）。

### 5.1 Steam 经典

1. **头图硬切**：亮色 16:9 横图直接压在深蓝面板上，交界只有 1px 线 → 改成带蓝色渐变与细边的
   **capsule 卡片**（460×215 比例），四周留出 24–32px 深蓝底，不再通栏。
2. **没有窗口结构**：标题栏只有一行小字，没有左侧库栏、没有状态区 → 加 **240px 左库栏**
   （本机库 / 最近游玩 / 收藏，带计数），主区右移；窗口标题栏保留但加高到 40px。
3. **右栏是废信息**：`activity-strip` 的文案与左列重复 → **删掉右栏**，把「最近游玩 3 条」
   放进左库栏底部，或直接不放。
4. **排版太平**：标题 700 + 一片全大写小字，缺少节奏 → 标题 34–38px / 行高 1.15，
   正文 13px / 1.55；全大写只保留标题栏与字段名，说明文字用正常大小写。
5. **只有一颗按钮**：主按钮之外没有次级动作 → 主按钮（绿色）+ 两个文字链接
   （详情 / 管理），蓝色、无边框、下划线只在 hover 出现。
6. **对比过硬**：亮封面 vs 深蓝面板 → capsule 外加 12% 蓝色叠加，
   面板用 `#1b2838 → #16202d` 纵向渐变，交界处加 1px `#2a475e` 与 8px 内阴影。
7. **小窗变形**：960×600 下头图降到 92px，像一条色带 → capsule 用 `aspect-ratio: 460/215`
   等比缩放，最小宽度 320px；矮窗时把 capsule 移到标题右侧（横向排），不要压扁。
8. **主题感太弱**：把这套主题的截图给别人看，第一反应是「深色皮肤」而不是「Steam」→
   补三个只有客户端才有的细节：左侧库栏的**分组标题 + 计数**、右下角的**离线状态行**、
   主区顶部的**面包屑**（库 / 当前游戏）。只补这三处，不要加 Logo。

### 5.2 黄昏之炼（待复审，优先级低于 Steam）

1. 纸页右下的空白没有内容支撑 → 把「配方 · 进度」下移贴住纸页底边，或补一条真实记录
   （最近一次游玩 / 本次会话），不要留一块空纸。
2. 封面取样 300px 偏小，像贴纸 → 加到 360px，纸胶带只压一角，别压到取样中心。
3. 纸面层次偏平（一层纸 + 一层线）→ 纸纹透明度再提一档，装订孔从 3 个加到 5 个、间距均匀。
4. 960×600 下取样与进度都被隐藏，只剩一块空纸 → 至少保留取样（横向 180×101）。

---

## 6. 返工方案（选一个再动手）

### 方案 A · 真客户端复刻

左侧 240px 库栏 + 主区 capsule + 密集列表，几乎照搬 2010 年代客户端的信息结构。
**像**，但和启动器「一张主视觉」的定位冲突，主视觉会被压成一张 460×215 的小图。
不推荐直接做，除非用户明确要「像到能骗人」。

### 方案 B · 客户端 + 主机混合（推荐）

保留窗口外壳与左库栏，但把 capsule 做成**浮在深蓝底上的卡片**，标题压在 capsule 下缘，
主按钮在标题下方；右栏删除，信息全部收进左栏与主区。

具体尺寸：

| 部件 | 值 |
|---|---|
| 窗口 | `min(1180px, 84vw)`，1px `#2a475e`，3px 圆角，投影 `0 30px 70px -34px #000` |
| 标题栏 | 40px，左「库 · 本机游戏」右「离线模式」，9.5px / `.22em` |
| 左库栏 | 240px，分组标题 9px 大写 + 计数；行高 34px；选中行 `#2a475e` + 左 2px 蓝条 |
| capsule | 460×215（`aspect-ratio`），外边距 28px，1px 描边，顶部 12% 蓝色渐变 |
| 标题 | 34–38px / 1.15，白色；长名两行，字号降到 26px |
| 正文 | 13px / 1.55，`#8f98a0` |
| 主按钮 | 44px 高，绿色渐变，2px 圆角 |
| 次级 | 两个蓝色文字链接，13px，hover 下划线 |
| 进度 | 6px 下载条，贴主区底部，宽 100% |

### 方案 C · 极简客户端

去掉窗口边框，只保留深蓝页 + 顶栏 + 左对齐内容，用蓝/绿/细线区分层级。
风险是又回到「深色皮肤」，不建议单独用，可作为 B 的降级形态（窄窗时使用）。

---

## 7. 返工流程（这次必须按这个来）

1. **先出静态构图稿**：`_shots/redesign/steam-a.html`、`steam-b.html`，各含首页 / 库 / 详情三态，
   1920×1080 与 960×600 两档；用无头 Edge 截图给用户看。
2. **用户点头后再写 `theme.css`**。不要先写 1200 行再被打回。
3. 落地后跑：
   ```bash
   node tools/export-all.js --themes=steam --views=all --sizes=1439x1124,960x600 --stress
   ```
4. 交付前做一次「**三问**」自检，答不上就不算完成：
   - 这套主题的**结构**（不是配色）和另外 12 套哪里不同？
   - 把界面文字全挡住，只看轮廓，还能认出是这套主题吗？
   - 截图缩到 25%，第一眼看到的是「一个界面」还是「一张卡片」？
5. 更新 `themes/steam/DESIGN.md` 的构图章节与 `docs/themes/steam.md`；
   bump `theme.json` → 重新出缩略图（概念板也要跟着改）。

**不要再做的事**：用「加一条标题栏 + 换深蓝 + 绿按钮」当作客户端主题；
把 `activity-strip` 直接塞进右栏当装饰；用通栏亮图切深色面板。

---

## 7b. 事故记录：1.8.0 演示截图覆盖了用户媒体库（已还原）

1.8.0 截图期间，我把 6 条示例条目的 `media/<id>/hero.jpg|cover.jpg` 直接覆盖成了生成的
排版封面，还改了 `library.json`（exe 路径、文案、accent）。用户发现后已全部还原：
数据取自 `backups/NOVA-auto-20261020-214114.nova-pack`（21:41 的每日备份，早于改动），
`library.json` 与全部 media 一并恢复，我改过的状态留档在 `_shots/demo-rollback-20261021/`。

**定下的规矩（写进流程，不是建议）：**

1. **永远不把用户数据目录（`%LOCALAPPDATA%\NOVA Game Space`）当作截图素材**。
2. 演示截图必须走隔离方案，二选一：
   - 做一个 `tools/demo-library.py seed|restore`：先把用户 `library.json` + `media/` 整体备份到
     `_shots/demo-state/`，再写入演示条目；截完一键还原。P0，下一轮先做这个再动任何截图。
   - 或者给应用加 `NOVA_DATA_ROOT` 环境变量（改 `AppPaths.Root`），让开发/截图用独立数据目录。
3. 任何要写用户数据目录的操作，动手前先 `robocopy /E` 备份到 `_shots/`，并在交接文档里登记。
4. 排版封面只存在于两处：`tools/demo-covers.py` 的输出与仓库 `docs/*.jpg`；不再进入用户数据目录。

---

## 8. 其它待办（功能侧，按优先级）

### P0 · 演示截图数据隔离（先做）

按 §7b 的规矩落地 `tools/demo-library.py seed|restore`（或 `NOVA_DATA_ROOT`），
之后所有 README 截图都用演示数据目录拍摄。**先有这个，再碰任何截图。**

### P0 · Win7 真机

Win7 SP1 x64 + .NET Framework 4.8（Release ≥ 528040）+ WebView2 109 固定运行时；
解压 legacy-single，运行 `launch.cmd`；验证启动、扫描、计时、设置、导入导出、主题切换（含新主题）、
托盘、安全档；记录到 `docs/COMPATIBILITY.md` §4.3。

### P0 · 物理手柄

Xbox 与 DualSense 各接一次；验证焦点环、摇杆重复、A/B、LB/RB、RS/LS、`select` 档位循环，
以及设置/外观/库/详情/管理/对话框/文件选择器全部可达。
Steam 经典重做后要确认：左库栏的行会进入焦点顺序，装饰不进入。

### P1 · Steam 全流程

SteamStub 游戏与普通游戏各跑一遍：未登录冷启动、登录后启动、进程出现计时、退出结算、
`launchMode` 三种模式。

### P1 · 音频听感

逐主题试听 `click/nav/soft/select/confirm/error/tick`。Steam 经典重点听：

- `click` 1.7kHz 与 `nav` 滚轮格在耳机下是否偏尖；
- `boot` 的低频嗡鸣是否盖住三音上行；
- `switch` 的风声是否比零点街区更轻。

### P2 · 示例封面换季

`tools/demo-covers.py` 可再加两套横向构图，方便 README 换季；封面仍然不能出现真实游戏素材。

### P2 · 文档收口

`docs/HANDOFF.md`、`docs/THEMES.md` 仍在用 NOVA 叙述，与 1.8.0 不一致，可择机合并。

---

## 9. 绝对不要回退的约定

1. `html.is-nova-system` 的外观/面板规则必须限定在 `html[data-theme="nova"]`；
2. ZERO HOUR 主色青柠 `#c6ff2e`、次色青蓝 `#59e3ff`，黄色只给注意/警示；
3. SUMMER 不往角色脸上压黑色帆船/伞骨线稿；
4. `fit-content` 标题的可用宽度取父级文字列，不要取自身；
5. 不给 `.logo` 的 `letter-spacing` 做过渡；
6. 幕布第一次切换先画初始态再启动；
7. 主题顺序前四固定：GUGUOVA → 终末地 → 零点街区 → 秘典；
8. 全屏层禁用 `filter` / `backdrop-filter`；只动 transform/clip-path/opacity；
9. 缓存及时清理且不落 C 盘；
10. `steam://` 唤起留在后台线程；Steam 启动返回 `pending`，只在找到真实进程后登记；
11. 不引入 `steam_api.dll` 模拟器绕过客户端校验；
12. 主题音效**替代**统一音效；`boot` 与开屏同时启动，跳过时淡出；
13. 音效 URL 必须带 `?v=<主题版本>`；
14. 雪花噪/白噪声只用于切换/失败/开屏底噪；
15. 自定义开屏舞台必须显式隐藏共享 `.intro-stage` / `.intro-corners` / `.intro-grain`；
16. DUSK 纸面正文一律墨色；封面取样与纸胶带不得进入文字列；
17. DUSK 不用发光魔法阵、粒子、霓虹；
18. **STEAM 不使用 Valve 素材**；绿色只给主按钮与「就绪」，红色只给缺失/删除；
    不伪造在线人数、下载速度、成就数；
19. **每套新主题先交静态构图稿，用户确认后再写 CSS**（本轮教训）；
19b. **用户数据目录神圣不可侵犯**：演示素材只进仓库与 `_shots/`，写入 `%LOCALAPPDATA%`
     之前必须整体备份并登记（1.8.0 事故教训）；
20. 示例库与截图里不允许出现真实游戏素材；
21. 技术标识（程序集、AppData、`NOVA_DEV`/`NOVA_CACHE_ROOT`、主题 id `nova`）不跟随品牌改名。

---

## 10. 快速命令

```bash
cd nova-game-space-desktop

# 静态构图稿（不启动应用，Edge 直接截）
msedge --headless=new --disable-gpu --hide-scrollbars \
  --window-size=1920,1080 --screenshot=out.png file:///.../steam-b.html

# 开发运行（E: 缓存，CDP 9223）
./tools/relaunch.sh

# 单主题审计
node tools/export-all.js --themes=steam --views=all \
  --sizes=1439x1124,960x600 --stress

# 开屏连拍
node tools/shot-intro.js ../_shots/steam-intro 900 1600 2100

# 缩略图（先启动应用）
node tools/render-concepts.js ../_shots/concepts --only=steam

# 打包
bash tools/pipeline.sh --skip-audit --version 1.8.1

# 版本号（唯一源）
node tools/bump-version.js 1.8.1
```

> 本机 `github.com` 不可达，但 `api.github.com`、`uploads.github.com`、`ssh.github.com:443` 可用。
> 推送用临时 deploy key：API 添加 → `GIT_SSH_COMMAND="ssh -i key -p 443 ..." git push ssh://git@ssh.github.com:443/118coder/guguova-game-space.git HEAD:main` → API 删除 key。
> 发布资产用 `POST uploads.github.com/repos/.../releases/{id}/assets?name=...`。

---

## 11. 已知限制与风险

- **Steam 经典是「未通过」状态但仍在发行版里**。重做时建议保留 id `steam`，只改视觉；
  如果决定整体替换，记得同步 `theme.json` 的 `intro` 与 `CURTAIN_HOLD`。
- **截图依赖本机示例库**：6 条虚构条目在 `library.json`，封面在 `media\<id>\`；
  exe 指向 `_shots\demo-apps\*.exe`（notepad 副本），重拍前要自己复制。
- **`DeveloperOnly` 会在启动时按 exe 路径重算**，指到系统目录会被隐藏。
- **改 `library.json` 前必须先关应用**，否则退出时会用内存状态覆盖。
- **WebView2 偶发 GpuProcessExited**：先杀 `msedgewebview2.exe`，换一个新的 `NOVA_CACHE_ROOT`
  并用 `NOVA_WEBVIEW_ARGS="--disable-gpu --use-angle=swiftshader --no-sandbox"`。
- **应用是单实例 + 后台子进程**：启动与截图必须在同一个 shell 调用里。
- Steam 边界：不带客户端只能启动本身不依赖 Steam 运行时的游戏；不做绕过。

---

## 12. PR 历史

- `ee4d843` feat: 新增 Steam 经典主题（窗口构图 / 客户端启动开场 / 16 音效）
- `ee915c0` docs: 发布文档改用 GUGUOVA 包名与 1.7.0 体积
- `6293179` feat: 新增黄昏之炼主题 / 重画全部缩略图与截图 / README 改为玩家向
- `c8c1eda` docs: 1.6.9 下一轮交接文档

下一轮从 **§6 方案 B 的静态构图稿**开始。
