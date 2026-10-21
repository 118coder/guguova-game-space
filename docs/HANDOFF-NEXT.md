# GUGUOVA 下一轮交接文档

> 交接版本：**1.13.0**
> 交接时间：2026-10-21
> 分支：`main`（1.13.0 已通过 PR **#23** 合并，squash commit `96afdf1`）
> 工作区状态：**干净**；1.12.0（PR #22）与 1.13.0（PR #23）均已合并
> 基线：`main` @ `96afdf1`
> 仓库：`https://github.com/118coder/guguova-game-space`

---

## 0. 一句话状态

应用 **1.13.0**，14 套主题。启动链路（Steam 提权修复 → 进程发现 → 窗口置前 →
启动器退场 → 全屏缩放）在 1.12.0 已完整；本轮把**所有界面**收紧成“每套主题都像自己”，
把 **Steam 已经记录的游玩时间**接进库，并建立了可复跑的**文字对比度审计**。

当前 **0 个 solid-background 对比度失败**；引擎弹窗、下拉、算法行、全屏缩放行、
外观取景浮层都已逐主题截图。代码已合并到 `main`；下一轮从**打包 + 真机验证**开始。

### 先读什么

1. 本文 §2–§5 —— 本轮做了什么、现在什么状态；
2. `docs/THEME-DESIGN-SPEC.md` —— 完整界面规范（token、每主题配方、验收）；
3. `.agents/skills/guguova-theme-design/SKILL.md` —— 改主题时照着执行的 skill；
4. `docs/GAME-DISPLAY.md`、`docs/STEAM-LAUNCH.md` §3.2 —— 置前时序 / `-applaunch` / 提权；
5. `docs/THEME-INTERFACES.md`、`docs/DESIGN-PHILOSOPHY.md` —— 主题接口与硬规则；
6. `docs/HANDOFF.md`、`docs/THEMES.md` —— 旧版详细叙事（1.8.0 之前）。

---

## 1. 版本与工作区

| 项 | 值 |
| --- | --- |
| 应用版本 | **1.13.0**（`version.json` 是唯一版本源） |
| 资源版本 | `src/index.html` 全部 `?v=1.13.0` |
| 主题数 | 14（`nova` + 13） |
| 发行包 | `dist/` 仍是 **1.12.0**，1.13.0 需重新打包 |
| PR 状态 | **#22**（1.12.0）已合并为 `3a27ae3`；**#23**（1.13.0）已 squash 合并为 `96afdf1` |
| 1.13.0 改动 | 53 文件已提交，含新增 `Services/SteamPlaytime.cs`、`tools/audit-contrast.js`、`docs/THEME-DESIGN-SPEC.md` |
| QA 工具切主题 | 已全部使用 `persist:false`，不再覆盖玩家保存的主题 |

---

## 2. 1.13.0 本轮完成

| # | 任务 | 结果 |
| --- | --- | --- |
| 0 | Steam 游玩时间同步 | 读 `localconfig.vdf`，按 `max` 合并；启动 / 退出后 / 导入后 / 手动按钮四处触发 |
| 1 | 黄昏文案 | `theme.json.lexicon`；DUSK 的“上次游玩”变为“上次委托” |
| 2 | 引擎弹窗 + 下拉 + 算法行 | 14 套 `--sheet-*` / `--menu-*` / `--mode-*`；算法行是每主题独立选择卡 |
| 3 | 全主题文字 | 新增 `--accent-text`；修白字白底、禁用态、启动/睡眠、通知/玩家菜单；审计到 0 solid fail |
| 4 | 夜航切换动画 | 重做为“登机口关闭 + 中央登机牌带 + 荧光扫描 + 翻牌主题名” |
| 5 | Steam 首页全屏缩放行 | 新增 `--hs-*`；炭黑 + 蓝色渐变起点 + 蓝色左轨 |
| 6 | 外观取景浮层 | 新增 `--af-*`；14 套独立材质 / 按键 / 完成按钮 |
| 7 | 启动界面退出 | 只允许 Esc（手柄 B）；点击 / A / 任意键不再关闭 |
| 8 | 夜航游戏库列数 | 宽屏 4 列，短窗（≤700px 高）2 列 |
| 9 | 设计规范 + skill | `docs/THEME-DESIGN-SPEC.md` + 工作区 `.agents/skills/guguova-theme-design/` |
| 10 | QA 工具 | 新增 `tools/audit-contrast.js`；`export-all` 增加 engine / library-select / appearance-framing |
| 11 | 首页主视觉取景 | 主题用 `--nova-hero` 的主视觉也消费 `--nova-hero-position/size`；取景编辑器改为按主题比例显示真实裁剪窗 |
| 12 | 首页重复活动条 | `#questCard` 默认 `hidden`，保留结构与 JS，后续做活动通知时再启用 |

### 2.1 Steam 游玩时间同步

**数据源**

```
<SteamRoot>/userdata/<steamid>/config/localconfig.vdf
UserLocalConfigStore → Software → Valve → Steam → apps → <appid>
  Playtime   = 分钟
  LastPlayed = Unix 秒
```

**合并规则**（`Services/StoreService.SyncSteamPlaytime`）

- 只处理 `Source == "steam"` 且 `SteamAppId` 非空的条目；
- `PlaytimeSeconds = max(本地, Steam)`，**不相加**（同一局 Steam 与启动器各记一次）；
- `LastPlayedUtc` 取较晚者；
- 非 Steam 条目完全不动；
- 读取失败静默，只写日志。

**触发**

1. `MainWindow.OnLoaded` 里 `Store.Load()` 之后（boot payload 已带新数字）；
2. 游戏退出后 2.5s（等 Steam 落盘）→ `playtime-synced` 推送前端；
3. 导入 Steam 候选之后；
4. 设置 → 数据与备份 →「同步 Steam 游玩时间」。

**本机验证**

- Steam root：`d:\program files (x86)\steam`，userdata：`1037799478`；
- Aseprite `779940s`、Blender `552600s`、OBS `3599820s` 与 Steam 记录完全一致；
- Live2DViewerEX 本地 `330360s` > Steam `6240s`，按 max 保留本地；
- 启动日志：`steam playtime synced at boot: 22`。

### 2.2 主题文案词典

```json
"lexicon": { "lastPlayed": "上次委托" }
```

- 渲染侧：`src/app.js` 的 `themeWord(key, fallback)` 读取当前激活主题 manifest；
- 切换主题时重绘首页 hero / 打开的详情面板；
- 缺键 / 空值回退共享文案；
- 当前只有 DUSK 使用。

### 2.3 缩放引擎弹窗 / 下拉 / 算法行

- 引擎弹窗改为 `--sheet-*` 令牌：标题字体、眉标、字段标签、控件圆角、按钮配方、
  顶部色带 / 切角 / 硬影全部按主题；
- 底部操作区改为固定页脚，960×600 下始终可见「保存并重启引擎」；
- `.nova-select` 改为 `--menu-*` 主题表面；选中项文字用墨色，强调色只做左轨 / 标记；
- 算法行改为 `--mode-*` 选择卡：ENDFIELD 酸黄块、SUMMER 黑块、RISO 酸黄 + 蓝影、
  RIOT 黑块 + 红影、GRIMOIRE 酒红块、STEAM 蓝色渐变、NIGHTFLIGHT 荧光轨等；
- 关闭按钮：GRIMOIRE 的浅金 X 压羊皮纸（约 1.2:1）已用更高特异性覆盖，
  其余 13 套测量可见，未改动。

### 2.4 文字可读性

新增 `--accent-text`（可读版强调色），并抬高中性文字基线：

| 令牌 | 1.12.0 | 1.13.0 |
| --- | --- | --- |
| `--muted` | .60 | **.74** |
| `--faint` | .34 | **.55** |
| `--text-muted` | .54 | **.72** |
| `--text-faint` | .38 | **.58** |

修复的典型问题：

- ENDFIELD 引擎当前算法“酸黄字压白纸” → 墨字 + 酸黄左轨 / 色块；
- ENDFIELD / MNEMO / RIOT 通知空态“白字白底” → `color: inherit`；
- 启动遮罩步骤 / 脚注、睡眠提示过暗；
- 禁用按钮整体 `.45` 透明度 → 提高到 `.72`（扫描中按钮 `.88`）；
- 全主题下拉选中项、设置小标签、玩家菜单脚注、快捷键提示。

审计工具：

```bash
node tools/audit-contrast.js
node tools/audit-contrast.js --themes=endfield,dusk --views=engine,appearance-framing
```

结果：**14 主题 × 16 界面，0 个 solid-background 失败**。
`hero-inner / detail-art / appearance-preview / editor-preview` 这类伪元素纸面标为
`layered`，需人眼复核；`appearance-framing` 已按不透明表面单独测量。

### 2.5 夜航切换动画

- 上下 46% 深夜蓝面板合拢；
- 中央 `clamp(88px,12vh,112px)` 奶油登机牌带，2px 荧光上下轨、两端圆缺口；
- 荧光扫描条扫过一次；主题名以 `rotateX(-78deg→0)` 翻牌落下；
- `CURTAIN_HOLD = 560`；无模糊，只动 transform / opacity。

### 2.6 首页「全屏缩放」行

- 新增 `--hs-*`；STEAM 为炭黑面板 + 蓝色渐变起点 + 3px 蓝色左轨 + 3px 圆角；
- 纸面主题各自有纸色 / 墨框 / 硬影 / 强调左轨；ENDFIELD 白底墨框 + 酸黄左轨，
  DUSK 纸色半透 + 陶土左轨。

### 2.7 外观取景浮层

- 新增 `--af-*`；浮层不透明，纸面主题用纸 + 墨，深色主题用各自面板；
- 方向键 / 缩放键 / 完成键按主题按钮配方；
- 渐变面板补 `--af-solid`，渐变完成键补 `--af-done-solid`，保证合成背景与审计准确。

### 2.8 启动界面退出

- 键盘：**只有 Esc**；点击遮罩、A、Enter、空格、任意键都不关闭；
- 手柄：B / ○ 等价 Esc；A / ✕ 不关闭；
- 提示：`按 Esc 退出`（连接手柄时显示 `按 B 退出`）。

### 2.9 夜航游戏库列数

- `themes/nightflight/theme.css` 从固定 3 列改为 **4 列**；
- 窗口高度 ≤700px 时保持 **2 列**，与 STEAM / DUSK 的短窗行为一致；
- 主题版本 **1.0.11**。

### 2.10 设计规范与 skill

- `docs/THEME-DESIGN-SPEC.md`：token 表、每主题配方、文字门槛、验收、发版检查；
- `.agents/skills/guguova-theme-design/SKILL.md`：工作流、配方、常见坑、DoD；
- skill 位于工作区根目录 `.agents`（不在 `nova-game-space-desktop` 仓库内）。

### 2.11 QA 工具修正

- `theme-engine.activate(id, { persist: false })`：审计 / 截图切主题不再改写玩家保存的主题；
- `NovaDev.resetSurfaces()` 现在会关闭引擎弹窗、取景编辑状态和下拉菜单；
- `export-all.js` 增加 `engine`、`library-select`、`appearance-framing`；
- `audit-contrast.js` 增加 `appearance-framing`，并在结束时移除 `reduce-motion`。

### 2.12 首页主视觉取景贯通所有主题

原先只有共享的 `.scene > img` 响应 `heroPosition / heroZoom`；DUSK、GRIMOIRE、
NIGHTFLIGHT、STEAM 用 `--nova-hero` 自己画主视觉，位置写死 `center / cover`，
所以在外观页移动/缩放后首页纹丝不动。

- `publishHeroVar()` 现在同时发布 `--nova-hero-position`（x% y%）和
  `--nova-hero-size`（zoom=1 时 `cover`，放大时 `auto N%`）；
- DUSK / GRIMOIRE / NIGHTFLIGHT / STEAM 的 `--nova-hero` 层全部改用这两个变量；
- 启动遮罩的主视觉也走 `applyHeroFraming`，与首页一致；
- 取景编辑器新增“首页取景”裁剪窗：按主题实际主视觉比例显示，拖拽/缩放即时可见；
  `--hero-frame-ratio` 默认 16:9，DUSK 16:10，NIGHTFLIGHT 1:1，GRIMOIRE 3:4；
- 实测：STEAM / DUSK 在 `100% 45%` 下角色完整；取景窗在 5 主题 × 2 尺寸下无裁剪。

### 2.13 首页重复活动条

`#questCard`（“Steam 游戏库 / 游戏时长”那张卡）与首页 hero、进度、最近游戏重复。
按产品决定先隐藏：

- `src/index.html` 上保留完整结构与 `hidden`；
- `src/base.css` 用 `.activity-strip[hidden] { display:none !important; }` 压过主题的
  `display:grid`；
- `renderActivity()` 仍然运行，后续接活动通知时去掉 `hidden` 即可。

---

## 3. 1.12.0 基线（下一轮仍会用到的三件事）

### 3.1 Steam 提权（根因）

本机 `HKCU\...\AppCompatFlags\Layers` 里 `steam.exe` 被打了 `RUNASADMIN`：

```
D:\Program Files (x86)\Steam\Steam.exe = "~ RUNASADMIN"
```

- 走 `steam://` 时 shell 协议处理器会起提权的 steam.exe 助手 → **每开一次游戏弹一次 UAC**；
- 提权后的 Steam 让游戏进程继承管理员权限，启动器读不到 `MainModule`，导致会话不登记、
  遮罩不关、启动器 Topmost，游戏窗口出不来。

处理：`Services/SteamPrivilege.cs` 只删 `RUNASADMIN`（保留 `HIGHDPIAWARE` 等），
原值备份到 `backups\steam-privilege-*.json`；`SteamService.RunGame` 走
`steam.exe -applaunch <appid>`（`UseShellExecute=false`）；启动前弹应用内对话框，
不会静默改注册表。

### 3.2 窗口置前与启动器退场

- `Services/GameDisplay.cs` 轮询进程最大的可见顶层窗口（15s），
  `SetForegroundWindow` + `BringWindowToTop`，失败依次用 `AttachThreadInput`、`SwitchToThisWindow`；
- **顺序不可换**：先保持启动器在前台 → 等窗口出现并置前 → 再最小化。
  先最小化会丢 `AllowSetForegroundWindow` 授权；
- 最后一个会话退出后恢复窗口与全屏几何；用户手动恢复过就不动。

### 3.3 Magpie 生命周期

- 随包分发未修改的 Magpie 0.12.1 **轻量版**（独立进程、GPLv3、附 NOTICE / 源码说明）；
- **只在「全屏缩放」开关打开时拉起**；由启动器拉起的引擎在最后一个游戏退出后自动关闭；
  玩家自己开的 Magpie 不动；
- 快捷键编码 `key | win<<8 | ctrl<<9 | alt<<10 | shift<<11`，默认 **3137 = Alt+Shift+A**；
  `auto` 由 Magpie 持有，`native` 由启动器 `RegisterHotKey`（切换时先关 Magpie）；
- 失败必须回退无边框全屏。

### 3.4 Steam 封面

`FindSteamCachedImage` 按分辨率挑选（递归 hash 目录、排除 `blur` / `logo`、<64×64 视为缺失）；
`MediaService.FitHero` 保留原始宽高比、只降不升。本机 22 条已刷新为 1920×620 原图。

---

## 4. 当前主题表

| 主题 | 版本 | 状态 | 切换 |
| --- | --- | --- | --- |
| nova（内置） | 2.0.1 | 保留区 | 双幕布 |
| aurum | 1.0.15 | 保留区 | 青铜门 |
| endfield | 1.0.11 | 保留区 | 蓝图切角 |
| zerohour | 1.0.14 | 保留区 | 换台滚动 |
| codex | 1.7.7 | 稳定 | 翻页 |
| broadcast | 1.4.8 | 稳定 | CRT |
| summer | 1.8.9 | 稳定 | 白纸排版 |
| riso | 1.4.7 | 稳定 | 双印版 |
| riot | 1.5.9 | 稳定 | 舞台幕布 |
| grimoire | 1.5.9 | 稳定 | 羊皮纸 + 蜡封 |
| mnemo | 1.1.9 | 稳定 | 记忆条带 |
| dusk | 2.0.10 | 重做完成 | 信封拆开 |
| steam | 2.0.10 | 重做完成 | tile 放大 |
| nightflight | 1.0.11 | 新主题 | 登机口关闭（重做） |

> 本轮 13 套外置主题 CSS 都改过，`nova` 走共享规则；`theme.json` 已统一 +1 patch。
> 若继续改某个主题的 CSS，**必须再 bump 该主题的 version**。

---

## 5. 验证记录（1.13.0）

| 项 | 结果 |
| --- | --- |
| 全量对比度 | 14 主题 × 16 界面，**0 solid-background 失败** |
| 布局审计 | 3 主题 × 18 界面 × 2 尺寸 = 108 张，**0 截断 / 0 横向溢出** |
| 取景浮层 | 14 套截图；浮层内文字最低约 **4.64:1** |
| 引擎弹窗 | 14 套逐一看过；当前算法行每主题独立选择卡 |
| 关闭图标 | 14 套测量；仅 GRIMOIRE 修复，其余未改 |
| 夜航库 | 1439×1124 → 4 列；960×600 → 2 列 |
| 夜航幕布 | 覆盖 / 揭开实机截图，无模糊、无闪烁 |
| 启动遮罩 | 点击 / A / Enter / 空格不关闭；Esc 关闭 |
| 首页取景 | STEAM / DUSK 在 `100% 45%` 下角色完整；5 主题 × 2 尺寸取景窗截图，0 裁剪 |
| 活动条 | `#questCard` 计算样式 `display:none`，首页不再重复游戏摘要 |
| Steam 时长 | Aseprite / Blender / OBS 与 Steam 完全一致 |
| 当前 UI 状态 | 保存主题 `broadcast`；无 overlay；无 reduce-motion |

QA 产物（仓库外）：

- `../_shots/contrast/contrast.json`
- `../_shots/export-final/manifest.json`
- `../_shots/framing2/`、`../_shots/framing3/`
- `../_shots/nf-lib4/`

---

## 6. 下一轮 P0（按顺序）

### P0-1 · 提交 1.13.0 / 开 PR（已完成）

- PR **#23** 已 squash 合并到 `main`，commit `96afdf1`；
- 工作区干净，`feat/launch-display-and-scaling` 已合入；
- 下一项从 **P0-2 打包** 开始。

### P0-2 · 打包

```bash
bash tools/pipeline.sh --skip-audit --version 1.13.0
```

- 确认 `dist/GUGUOVA-1.13.0-legacy-single.zip` / `legacy-full.zip`；
- 确认包内 `engine/magpie/`、主题版本、`?v=1.13.0`；
- 当前 `dist/` 仍是 1.12.0，不要混用。

### P0-3 · Steam 全流程（唯一真正的阻塞项）

1. 登录 Steam，确认 设置 → 系统与兼容性 → Steam 权限 显示 **普通权限**；
2. SteamStub 游戏与普通 Steam 游戏各跑一遍：
   未登录冷启动、登录后启动、进程出现计时、退出结算；
3. `launchMode` 三种模式各验一次；
4. 确认启动时**没有任何 UAC 弹窗**；
5. 确认退出后 2.5s 的 `playtime-synced` 把 Steam 新时长带回 UI。

### P0-4 · 缩放引擎真机

- 用轻量包在**另一台**没有 Magpie 的机器上跑：自动拉起、隐藏主窗、快捷键触发、
  游戏退出后自动关闭；
- 验证 `--lite` 缺效果时置灰，并在真实游戏上跑一次 FSR；
- 验证 `native` 模式热键在 4:3 / 带黑边窗口上的表现。

### P0-5 · Win7 / WebView2 109

- Win7 SP1 x64 + .NET 4.8 + WebView2 109：解压 legacy-single，验证启动 / 扫描 / 计时 /
  设置 / 导入导出 / 托盘 / 安全档；
- Magpie 需要 Win10 1903+，Win7 上必须确认自动回退无边框且不报错。

### P0-6 · 全主题回归（14 套）

```bash
node tools/export-all.js --themes=all --views=all --sizes=1439x1124,960x600 --stress
node tools/audit-contrast.js
```

- 本轮只对 3 个主题跑了完整 18 视图布局审计；其余主题只过了对比度 + 重点界面截图；
- 需要全量确认：引擎弹窗、下拉、算法行、取景浮层、夜航 4 列库在 960×600 的表现；
- 手柄回归：Xbox 与 DualSense 各接一次（焦点环、摇杆重复、A/B、LB/RB、RS/LS、select 档位）。

### P0-7 · 演示数据隔离（仍未做）

按旧约定落地以下任一项，再碰任何截图：

- `NOVA_DATA_ROOT` 环境变量，让开发 / 截图使用独立数据目录；或
- `tools/demo-library.py seed|restore`。

**永远不要把用户真实库当截图素材**（1.8.0 事故记录见 `docs/HANDOFF.md`）。

---

## 7. 下一轮 P1 / P2

### P1

- **音频听感**：逐主题试听 16 个 cue，重点是 DUSK 木扣 + 纸噪、STEAM solenoid、
  NIGHTFLIGHT 翻牌与 PA。
- **README 截图**：仍是 1.9.0 的，没有全屏缩放开关、缩放设置、Steam 权限、引擎弹窗、
  取景浮层；必须走隔离演示库。
- **主题预览图**：DUSK / STEAM / NIGHTFLIGHT 的 preview 仍是实机裁图，可补概念板版本。
- **Steam 时长边界**：离线模式、家庭共享多账号、Steam 正在运行时同步的滞后行为。
- **Magpie profile `autoScale`**：把「全屏缩放」映射成按 exe 自动缩放，避免模拟快捷键。
- **全屏缩放宽高比**：4:3 游戏加「保持比例（黑边）」选项。

### P2

- 可选效果包（Anime4K / CuNNy / RAVU / NNEDI3 / CRT / xBRZ）。
- 文档合并：`docs/HANDOFF.md`、`docs/THEMES.md` 仍用 NOVA 叙述，可归档。
- 更多主题的字标配方 / 开屏试验。

---

## 8. 关键文件地图

| 需求 | 位置 |
| --- | --- |
| 主题清单 | `themes/<id>/theme.json` |
| 主题样式 | `themes/<id>/theme.css` |
| 共享控件令牌 | `src/app.css`：`.nova-select` / `.engine-shell` / `.engine-mode-row` / `.hero-scale` / `.appearance-framing` / `--accent-text` |
| 文字基线 | `src/base.css`、`src/type.css` |
| 主题切换幕布 | `src/motion.css` + `src/app.js` `CURTAIN_HOLD` |
| 启动退出 | `src/app.js` `bindKeyboard` / `closeLaunch` / pad `back()` |
| 主题文案 | `theme.json.lexicon` + `src/app.js` `themeWord` |
| 首页主视觉取景 | `src/app.js` `publishHeroVar` / `applyHeroFraming` / `layoutAppearanceCrop`；`--nova-hero-position/size`；`--hero-frame-ratio` |
| 首页活动条 | `src/index.html` `#questCard` + `src/base.css` `.activity-strip[hidden]` |
| Steam 时长 | `Services/SteamPlaytime.cs`、`Services/StoreService.SyncSteamPlaytime`、`NativeBridge.cs`、`MainWindow.xaml.cs` |
| 对比度审计 | `tools/audit-contrast.js` |
| 截图 / 布局审计 | `tools/export-all.js` |
| 重载开发 | `tools/relaunch.sh` |
| 完整设计规范 | `docs/THEME-DESIGN-SPEC.md` |
| 可复用 skill | `.agents/skills/guguova-theme-design/SKILL.md`（工作区根目录） |

---

## 9. 绝对不要回退的约定

### 结构与视觉

1. `html.is-nova-system` 的外观 / 面板规则必须限定在 `html[data-theme="nova"]`；
2. ZERO HOUR 主色青柠 `#c6ff2e`、次色青蓝 `#59e3ff`，黄色只给注意 / 警示；
3. SUMMER 不往角色脸上压黑色帆船 / 伞骨线稿；
4. `fit-content` 标题的可用宽度取父级文字列，不要取自身；
5. 不给 `.logo` 的 `letter-spacing` 做过渡；
6. 幕布第一次切换先画初始态再启动；
7. 主题顺序前四固定：GUGUOVA → 终末地 → 零点街区 → 秘典；
8. 全屏层禁用 `filter` / `backdrop-filter`；只动 transform / clip-path / opacity；
9. 缓存及时清理且不落 C 盘；
10. 自定义开屏舞台必须显式隐藏共享 `.intro-stage` / `.intro-corners` / `.intro-grain`；
11. DUSK 纸面正文一律墨色；封面取样与纸胶带不得进入文字列；
12. DUSK 不用发光魔法阵、粒子、霓虹；
13. **STEAM 不使用 Valve 素材**；绿色只给主按钮与「就绪」，红色只给缺失 / 删除；
    不伪造在线人数、下载速度、成就数；
14. **每套新主题先交静态构图稿，用户确认后再写 CSS**；
15. 示例库与截图里不允许出现真实游戏素材；
16. 技术标识（程序集命名空间、AppData `NOVA Game Space`、`NOVA_*` 环境变量、
    主题 id `nova`、项目文件名）**不跟随品牌改名**。

### 文字与控件（1.13.0 新增）

17. **正文 / 小字 ≥ 4.5:1，大字 ≥ 3:1**；以实际渲染背景为准；
    `node tools/audit-contrast.js` 必须 0 solid fail。
18. **accent 只做标记，不做小字**；文字用 `--accent-text` 或墨色。
19. **共享控件令牌必须齐全**：`--menu-*`（下拉）、`--sheet-*`（引擎）、
    `--mode-*`（算法行）、`--af-*`（取景浮层）、`--hs-*`（全屏缩放行）、`--accent-text`。
20. **新增按钮 / 卡片 / 弹窗 / 下拉必须一次适配 14 套主题**；禁止系统原生 select /
    消息框 / 文件框。
21. **引擎算法行**是每主题独立选择卡；缺少效果用虚线框 + 删除线，不用整体半透明。
22. **取景浮层必须不透明**；渐变面板补 `--af-solid`，渐变完成键补 `--af-done-solid`。
23. **主题用 `!important` 给 `.icon-btn` 上色时**，浅色弹窗必须用
    `html[data-theme="<id>"] .engine-shell .icon-btn` + `!important` 覆盖，确保 X 可见。

### 启动 / 数据

24. **启动器必须等游戏窗口出现并置前后才最小化**；先最小化会丢 `AllowSetForegroundWindow`；
25. **用户可见的名字一律 GUGUOVA**：exe、窗口标题、托盘、启动脚本、导出文件名；
26. **Steam 启动走 `steam.exe -applaunch`，不要回到 `steam://`**；提权修复只删
    `RUNASADMIN`，改之前必须备份原值；
27. **Magpie 快捷键按位域解码**（`key | win<<8 | ctrl<<9 | alt<<10 | shift<<11`，默认 3137）；
    可以随包分发未修改的 Magpie，但必须保持独立进程、附 GPLv3 与源码说明；
28. 全屏缩放**永远先看游戏自己的选择**，未选择时才跟随沉浸式全屏；
    `scalingEngine=off` 时不得偷偷缩放；引擎只在开关打开时启动，退出后关闭；
29. 外观取景编辑**只写 `HeroPosition` / `HeroZoom`**，按游戏记忆；
30. **首页启动区块顺序固定**：标题 → 类型 → 主按钮排 → 全屏缩放 → 进度；
31. **启动界面只能 Esc 退出**（手柄 B 等价）；点击 / A / 其它键不得关闭；
32. **Steam 时长只取 max，不相加**；只对 Steam 条目合并，非 Steam 条目不动；
33. **QA 工具切主题必须 `persist:false`**，不要改写玩家保存的主题；
34. **改主题 CSS 必须 bump `theme.json` 的 version**，再同步 / 重启；
35. **夜航游戏库宽屏 4 列、短窗 2 列**，不要回到固定 3 列；
36. **主题若用 `--nova-hero` 画主视觉**，必须写成
    `var(--nova-hero) var(--nova-hero-position, center) / var(--nova-hero-size, cover) no-repeat`，
    不要写死 `center / cover`，否则外观取景对首页无效；
37. **取景编辑器必须显示真实裁剪窗**：`--hero-frame-ratio` 与该主题实际主视觉框比例一致
    （默认 16:9、DUSK 16:10、NIGHTFLIGHT 1:1、GRIMOIRE 3:4）；
38. **`#questCard` 默认隐藏是产品决定**；恢复活动通知时去掉 `hidden`，不要删结构或 JS。

---

## 10. 快速命令

```bash
cd nova-game-space-desktop

# 开发运行（E: 缓存，CDP 9223）
./tools/relaunch.sh

# 全量对比度（14 主题 × 16 界面）
node tools/audit-contrast.js
node tools/audit-contrast.js --themes=endfield,dusk,steam --views=engine,appearance-framing

# 全主题截图 + 布局审计（含引擎 / 下拉 / 取景浮层）
node tools/export-all.js --views=all --sizes=1439x1124,960x600 --stress

# 单主题
node tools/export-all.js --themes=nightflight --views=library,appearance-framing --sizes=1439x1124,960x600

# 通过 CDP 调用桥方法
node tools/drive.js "return await window.nova.call('magpieStatus');"
node tools/drive.js "return await window.nova.call('syncSteamPlaytime');"

# 版本号（唯一源）
node tools/bump-version.js 1.13.1

# 打包（会先检查 / 拉取引擎）
bash tools/pipeline.sh --skip-audit --version 1.13.0
```

Git / PR：本机 git 能访问 `github.com`，凭证由 credential manager 提供；
`git push` 后可用 API（`POST /repos/118coder/guguova-game-space/pulls`）建 PR；`gh` 未安装。

---

## 11. 已知限制与风险

- **Steam 提权修复会重启客户端**：本机实测重启后停在登录界面（ActiveUser=0）。
  不要为了免登录而保留管理员权限运行。
- **Steam 时长是分钟粒度**：刚启动 / 刚退出的几分钟可能滞后；退出后 2.5s 同步与手动按钮兜底。
- **全屏缩放只对窗口化游戏有效**：独占全屏已经是全屏；原生无边框会拉伸到显示器比例，
  4:3 会变形。
- **Magpie 需要 Win10 1903+**：Win7/8 上 `ScalingEngine.Supported=false`，自动走无边框；
  打包后必须在 Win7 上确认不报错。
- **Magpie profile `autoScale` 未接入**：仍是“按一次快捷键”。
- **Store 版应用的转发 exe**（Win11 的 `notepad.exe`、`calc.exe`）启动后会把窗口交给
  另一个进程并自己退出，只能记录转发进程。
- **Steam 封面依赖客户端缓存**：从没在 Steam 里打开过的游戏，`librarycache` 可能没有美术。
- **`DeveloperOnly` 会在启动时按 exe 路径重算**，指到系统目录会被隐藏。
- **改 `library.json` 前必须先关应用**，否则退出时用内存状态覆盖。
- **WebView2 偶发 GpuProcessExited**：先杀 `msedgewebview2.exe`，换新的 `NOVA_CACHE_ROOT`，
  并用 `NOVA_WEBVIEW_ARGS="--disable-gpu --use-angle=swiftshader --no-sandbox"`。
- **应用是单实例 + 后台子进程**：启动与截图必须在同一个 shell 调用里。
- **对比度工具只合成 `background-color`**：伪元素纸面 / 背景图标 `layered`，需人眼复核；
  这是当前审计的主要盲区。
- **1.13.0 已合并但尚未打包**：`dist/` 仍是 1.12.0；代码已在 `main` 的 `96afdf1`。
- 本轮没有在 Win7、真实 Steam 登录态、另一台无 Magpie 机器上验证。

---

## 12. 历史与 PR

| 版本 | 内容 |
| --- | --- |
| 1.9.0 | DUSK / STEAM / NIGHTFLIGHT 三套主题重做；16 个音效重合成 |
| 1.10.0 | Steam 提权修复、窗口置前、启动器退场、全屏缩放（Magpie / 无边框） |
| 1.10.1 | 外观预览取景编辑 |
| 1.11.0 | 内置轻量 Magpie、快捷键录制、简化引擎弹窗、`.nova-select` |
| 1.11.1 | 改名 GUGUOVA、开机自启、引擎弹窗按主题换肤 |
| 1.11.2 | 去重缩放方式、开机无边框全屏、徽章可读 |
| 1.12.0 | Steam 封面取原图（按分辨率挑选 + 只降不升） |
| 1.13.0 | Steam 时长同步、主题文案、全主题控件 / 文字精修、夜航幕布、Esc-only 启动退出、设计规范 + skill |

PR 历史：

- `96afdf1` feat: 界面精修、Steam 游玩时间与全量对比度审计（1.13.0）— **PR #23，已合并**
- `3a27ae3` Merge pull request #22（1.12.0）
- `1a825f2` feat: 1.13.0 功能提交
- `b434c69` docs: 1.12.0 下一轮交接文档重写
- `5c4aca2` feat: 启动体验、内置缩放引擎与封面原图（1.12.0）
- `77e1067` 重做黄昏与 Steam，新增夜航主题（2.0.8 / 1.0.8）(#21)

旧版详细叙事见 `docs/HANDOFF.md`、`docs/HANDOFF-THEMES.md`、`docs/THEMES.md`。

---

## 13. 交接清单

- [x] 应用 1.13.0 构建通过（`dotnet build -c Debug`，0 错误）；
- [x] 14 套主题已同步到 `%LOCALAPPDATA%\NOVA Game Space\themes`；
- [x] 对比度审计 0 solid fail；
- [x] 关键主题 108 张布局截图 0 截断 / 溢出；
- [x] 取景浮层 14 张、引擎弹窗 14 套、夜航库 2 档尺寸已截图；
- [x] 启动遮罩 Esc-only 已实测；
- [x] Steam 时长与 `localconfig.vdf` 数值核对；
- [x] 当前保存主题 `broadcast`，无 overlay，无 reduce-motion；
- [x] 5 主题 × 首页 / 取景 × 2 尺寸最终截图 0 裁剪 / 0 溢出；
- [x] **1.13.0 提交 / PR / 合并**（PR #23 → `main` `96afdf1`）；
- [ ] **1.13.0 打包 / dist**；
- [ ] Steam 登录态全流程、另一台 Magpie 机器、Win7 验证。

下一轮从 **§6 P0-2（打包 / dist）** 开始，然后 **P0-3（Steam 全流程）**。
