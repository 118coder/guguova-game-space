# NOVA 下一轮交接文档

> 交接版本：**1.6.7**
> 交接时间：2026-10-20
> 当前 `main`：`1246b08`（Steam 启动接管在 1.6.0 工作区，未提交）
> 工作区：干净；最近保存状态为主题 **CODEX**、外观语言 **NOVA 默认**
> 产物：`dist/NOVA-1.5.3-legacy-single.zip`（2.34 MB）、
> `dist/NOVA-1.5.3-legacy-full.zip`（3.81 MB）——1.6.0 尚未重新打包

---

## 0. 1.6.0 新增：Steam 启动接管（本轮）

Steam 库导入的游戏原先直接 `Process.Start` 主程序，本机抽样 16 款里有一半打不开：
4 款卡在 `SteamAPI_Init`、1 款带 SteamStub 壳直接闪退。原因是认证在客户端而不在 exe。

现在 `auto` 模式下有条目 `SteamAppId` 的游戏改走 `steam://rungameid/<appid>`，
由 Steam 客户端负责认证、覆盖层与云存档。设计与实测见 **`docs/STEAM-LAUNCH.md`**。

要点（都不要回退）：

1. **`steam://` 唤起必须在后台线程**。在 UI 线程上 `ShellExecute` 会等 COM，
   实测把整个 bridge 卡到 60s 前端超时；修复后 IPC 856ms 返回、UI 5ms 响应。
2. **不能假设游戏进程立刻存在**。客户端要登录/更新，返回 `pending:true`，
   会话推迟到 watcher 找到真实进程时登记，否则会把「等待」记成 0 秒游玩。
3. **`Detect()` 只读注册表不枚举进程**（`ActiveProcess\pid`），否则 boot payload 变慢。
4. **不要做模拟器路线**。替换 `steam_api.dll`（Goldberg 一类）绕过正版校验，不纳入本项目。

NOVA 不替玩家登录、不读 `loginusers.vdf` 令牌；只读安装路径与运行状态。

---

## 0.1 1.6.4 新增：每主题全套音效

- 11 套主题（含内置 NOVA）各有 **16 个 cue**，由 genny 合成生成，
  覆盖按钮、页面、关闭、确认、错误、悬停、就绪、睡眠、开关主题、启动/结束游戏、开屏。
- 每套主题音色不同（终末地电磁闩/工业、零点街区 CRT/街机、冒险者档案纸页/颂钵…）。
- **开屏音效对齐关键帧**：`boot` 是按 `src/intro.css` 的关键帧排好的序列，与动画同时触发。
- 设置页新增 **使用默认统一音效** 开关（`unifiedSfx`），关闭时每套主题用自己的声音。
- 外观页右键主题卡片可 **播放该主题的启动动画**（不切换主题）。
- 生成规格在 `tools/sfx-specs/`（`build-themes.py` 产出 `themes-all.json`），可复现。

注意：`ThemeService.ResolveSounds` **不要**再把 cue 键名转小写，
`launchRise`/`launchFall` 会因此匹配不上；NOVA 的 cue 声明在前端
`src/theme-engine.js` 的 `BUILT_IN.sounds`，不在 C# 里。

---

## 0.2 1.6.5：音效按主题设计理念重做

- 每套主题的 16 个 cue 按 `docs/themes/<id>.md` 的材料语言重新设计（不是统一音效换音高）：
  终末地继电器/打字机、零点街区 CRT/街机、冒险者档案纸页/蜡封、深夜广播雪花噪/电钢、
  舞台残响木质敲击/弦乐、神秘管理局档案夹/颤音琴、夏日纸页/钟琴、NOVA 柔光钢片琴。
- 零点街区开屏**重做**：`.intro-zh2` = CRT 通电 + 彩条噪点 → 漫画分镜斜切 → 酸柠字幕带，
  与终末地的工业终端日志明确区分；命中点改为 100 / 380 / 620ms。
- 主题右键改为**追加**菜单项：在「在资源管理器中显示」下面插入
  「播放「主题」启动动画」「使用这套主题」，原有项全部保留。
- 音效 URL 带版本参数（主题 version / 应用 version），否则 WebView 会一直用缓存的旧音频。

---

## 0.3 1.6.6：圣所导航选中态 / 零点街区音效重置

- AURUM 导航选中态从「羊皮纸实块 + 切角」改为**直角双层金线框 + 青玉菱形点**，
  解决纸块压字与形状不协调；规则在 `themes/aurum/theme.css` 末尾。
- ZERO HOUR 整组音效**重置**：去掉方波 chirp 与雪花噪（初版 sharp 1.94–2.1、5kHz 最高 8%），
  改为低通粉噪 + 低音 blip + 拨弦 + 低频鼓点，`sharp ≤ 1.61`、`above5k ≤ 0.2%`。
- 音效 URL 现在带 `?v=<主题版本>`，改音效后必须 bump `theme.json` 的 version，否则 WebView 用缓存。

---

## 0.4 1.6.7：终末地开屏按 skill 重做 / 噪声收敛

- 终末地开屏改为**纸面启动台**：纸白底 + 网格、三色顶带、白色直角面板、实心 NOVA +
  空心 SPACE、酸黄只做 READY 块、右侧空心真实计数；入场 700ms 内完成。
  规则依据 `.agents/skills/endfield-ui/SKILL.md`（不要黑底黄大字、不造假进度条、不用投影/渐变）。
- 零点街区此前已改成 CRT/漫画；两者现在的开屏语言完全不同。
- **雪花噪收敛**：带 static/noise 的 cue 从十几处降到 7 处，且只保留在
  切换主题 / 失败 / 开屏底噪；点击、悬停、确认改用实体材料。
  全部 176 个 cue `sharp ≤ 1.87`、`above5k ≤ 1.8%`。

---

## 0.5 1.6.9：品牌改名 GUGUOVA / 零点街区换台切换

- 产品名统一为 **GUGUOVA**（全大写字标）：窗口标题、顶栏字标、开屏、启动/睡眠、
  设置与关于、主题名「GUGUOVA 原生」、退出确认，以及各主题开屏里的 `// GUGUOVA …` 眉标。
  程序集名、AppData 目录、`NOVA_DEV` / `NOVA_CACHE_ROOT` 等**技术标识保持不变**，避免破坏升级与数据。
- 七字母字标做了字距/字号收敛（顶栏 `.brand-word`、星核开屏 `.intro-word`、`.intro-nv-word`），
  实测无横向溢出。
- 零点街区切换动画改为**换台**：扫描线黑板自下卷起 + 酸柠跟踪带，落定时 RGB 错位，再上卷退场；
  与开屏的 CRT 通电＋漫画分镜明确区分。

---

## 1. 一句话状态

11 套主题的视觉、字体、切换/开屏/进游戏动画、设置页和手柄焦点导航都已落地；
1.5.3 的默认模式可读性、零点街区切换、深夜广播标题抖动已修复；
1.6.0 补上 Steam 启动接管与 PE 级依赖诊断。
当前只剩 **Win7 真机 + 物理手柄** 两类外设验收，以及一轮全界面截图回归。

---

## 2. 先读什么

1. **`docs/DESIGN-PHILOSOPHY.md`** —— 设计理念、六条硬规则、11 套主题详细卡、
   动效/设置/音效/兼容/维护流程、常见坑。**改任何主题前先读它。**
2. 本文 —— 当前版本、已完成、待办与验收命令。
3. `docs/THEME-INTERFACES.md` —— 主题清单、变量、选择器、切换编舞、字体契约。
4. `docs/HANDOFF-THEMES.md` §0.00d —— 主题层最近一轮细节。
5. `docs/themes/<id>.md` —— 单主题接口卡（顶部有详细设计章节索引）。
6. `docs/SFX-MAP.md` —— 按钮/选项 → 音效对照。
7. `docs/STEAM-LAUNCH.md` —— Steam 启动接管、认证边界、Steam++ 对照结论。

---

## 3. 版本基线

应用：**1.5.3**（`version.json` 是唯一版本源）。

| 主题 | 版本 | 开屏 | 进游戏 | 切换 |
| --- | --- | --- | --- | --- |
| nova（内置） | 2.0.1 | `gilded` | `nvLaunch` | 双幕布 |
| aurum | 1.0.10 | `aurum` | `auLaunch` | 青铜门 |
| endfield | 1.0.6 | `endfield` | `efLaunch` | 蓝图切角 |
| zerohour | 1.0.9 | `zerohour` | `zhLaunch` | 漫画分页 + 字幕带 |
| codex | 1.7.3 | `codex` | `cxIris` | 翻页 |
| broadcast | 1.4.3 | `broadcast` | `bcSweep` | CRT |
| summer | 1.8.4 | `draft` | `suShutter` | 白纸排版 |
| riso | 1.4.3 | `riso` | `rsRoll` | 双印版 |
| riot | 1.5.4 | `vinyl` | `rtDrop` | 舞台幕布 |
| grimoire | 1.5.3 | `seal` | `grStamp` | 羊皮纸 + 蜡封 |
| mnemo | 1.1.4 | `mnemo` | `mnUnfold` | 记忆条带 |

字体：全主题思源黑体 Medium / 思源宋体；不内置字体。
音效：Kenney Interface Sounds（CC0）+ Kenney 环境音；来源见 `src/assets/sfx/LICENSE-SFX.md`。

---

## 4. 本轮已完成（不要重复做）

### 4.1 可读性 / 默认模式

- **`html.is-nova-system` 泄漏修复**：NOVA 编辑器的外观规则已限定为
  `html[data-theme="nova"].is-nova-system`。选择「NOVA 默认」不再把其他主题的
  `.appearance-options` / `.appearance-shell` 刷成黑底。
- **字标方案小字提亮**：NOVA / AURUM / CODEX / SUMMER / RIOT / ZERO HOUR 的
  `.type-recipe-spec`、`.type-seed`、`.type-dna span`、说明文字均做过对比度修正；
  关键小字 ≥ 4.5:1。
- **导航英文补齐**：`// SETTINGS`（秘典 `IV · 设置`、MNEMO `// 04`）。

### 4.2 动画

- **ZERO HOUR 切换**：漫画分页——黑板从左侧压入，白框分镜从右下斜切落下，
  中央全宽黑色字幕带 + 青柠上下细线 + 超宽字距主题名 + 速度线；无黄色字。
- **SUMMER**：切换为白纸印版 + 黑/黄块排版，底部黑条 14%；开屏为白纸排版并整页淡出；
  删除了角色脸上的黑色帆船/伞骨线稿；缩略图改为白纸线稿版式。
- **GRIMOIRE**：羊皮纸页上升 + 蜡封落下，覆盖停留 650ms。
- **BROADCAST**：标题 `fit-content` 改为按父级文字列测量，ResizeObserver 只收缩不回涨。
- **首次切换**：幕布先绘制目标 variant 的初始状态（两帧），再启动覆盖。

### 4.3 设置 / 头像

- 设置页全宽双栏控制台；11 套主题各自的身份卡材质。
- 点击头像直接打开图片选择；支持更换/移除，头像裁成 256×256 PNG，
  存 `media/avatar/avatar.png`，同步顶栏与个人菜单。
- “关于”说明在 SUMMER 下改为深墨色，不再用蓝色小字。

### 4.4 手柄

- `src/gamepad.js` 轮询 + `src/app.js` 的 `padSurface / padFocusableList /
  padMoveFocus / padActivate` 实现真实 DOM 焦点导航。
- 设置/外观/游戏库/详情/编辑器/扫描器/对话框/文件选择器全部可操作。
- A 选择（select 循环选项）、B 返回（对话框 Esc / 选择器关闭）、方向键/摇杆移动、
  LB/RB 翻页或换游戏、RS/R3 设置、LS/L3 外观、Menu 游戏库、View 通知。
- 焦点环 `html[data-input="gamepad"] .is-pad-focus` 使用主题强调色。
- 已实测：设置焦点遍历、开关、效果档位循环、对话框确认/取消、头像选择器打开/关闭。

### 4.5 字体 / 音效 / 兼容

- 全主题字体切换为思源黑体/宋体，删除 `src/fonts/` 与两套 Saira。
- 音效换成 Kenney 套装，新增 `theme.ogg`；主题切换有专属声音。
- WebView 缓存默认优先非 C 固定磁盘；开发缓存 `NOVA_CACHE_ROOT`（E:）。
- Legacy 单文件包通过 Costura + 内嵌 assets/loader。

---

## 5. 关键实现位置

| 功能 | 文件 |
| --- | --- |
| 主题切换幕布 | `src/app.js` `playThemeCurtain` / `CURTAIN_HOLD`；`src/motion.css` 的 variant 段 |
| 开屏 | `src/intro.js` / `src/intro.css`（SUMMER 的 `intro-dr` 在 `intro.js` 内联） |
| 主题字体/令牌 | `src/base.css`、各 `themes/<id>/theme.css` 的 `:root` |
| 设置页布局 | `src/views.css` `.view-settings` / `.settings-*` |
| 设置页用户卡 | `src/settings-themes.css` 末尾的 11 套材质 |
| 头像 | `NativeBridge.SetAvatar/ClearAvatar`、`MediaService.ImportAvatar`、`src/app.js` `syncAvatarImages/chooseAvatar` |
| 手柄 | `src/gamepad.js`、`src/app.js` `pad*` 函数、`src/focus.js` |
| Steam 启动 / 诊断 | `Services/SteamService.cs`、`Services/LauncherService.cs` `LaunchThroughSteam`；UI 在 `src/app.js` `fillSteamPanel` / `setLaunchMode` |
| 标题适配 | `src/app.js` `fitLogo/logoMetrics/scheduleFit` |
| 预览图 | `tools/theme-concepts.html` + `tools/render-concepts.js` |
| 打包 | `tools/pipeline.sh`、`tools/build-legacy.sh`、`tools/package-release.py` |

---

## 6. 验证记录（本轮）

- `dotnet build -c Debug`：0 错误。
- `export-all.js --views=appearance,settings --sizes=1439x1124,960x600`：
  **44 captures，0 clipping / overflow**。
- 系统模式对比度脚本：11 套主题的标题/说明/字标方案/选中卡/标签全部检查；
  AURUM / CODEX 说明小字从 3.2–3.5:1 提升到 6.9–7.4:1。
- BROADCAST 默认模式外观页截图：纸面恢复，标题/说明/选中卡可读。
- 手柄：设置焦点遍历、开关、档位 select 循环、对话框确认/取消、头像选择器开关均通过。
- ZERO HOUR 新切换封面截图：黑板 + 白框分镜 + 青柠字幕带 + 速度线。
- **1.6.0 Steam**：`dotnet build` 与 `legacy` 的 net48 构建均 0 错误；
  `steamStatus` 正确识别已安装/运行/已登录；两种 DRM 形态的文案与实测相符；
  点开始游戏后遮罩显示「等待 Steam…」且 UI 不冻结；11 套主题下面板无裁切、无横向溢出。

**尚未做：**
- Win7 SP1 + .NET 4.8 + WebView2 109 真机验收。
- 物理 Xbox / PlayStation 手柄实机验收（本轮用 `NovaPad.press()` 模拟动作）。
- 1.5.3 Legacy 单文件包在干净目录的最终 smoke test（C# 未变，assets 已更新）。
- **Steam 真实启动到进程出现后的完整会话**：本轮验证到「交给 Steam / 等待 Steam…」，
  客户端当时已在运行并登录，未等流程走完即手动取消；需再跑一次走完计时与退出。
- **Steam 未登录 / 冷启动路径**：需清空 `ActiveUser` 场景复测 6 分钟超时文案。
- **SteamStub 游戏**（本机 RPG Maker VX Ace）单独复测「直接启动」是否如期闪退。

---

## 7. 下一轮待办（按优先级）

### P0 · Win7 真机
1. 准备 Win7 SP1 x64 虚拟机；
2. 安装 .NET Framework 4.8（Release ≥ 528040）；
3. 使用 WebView2 109 固定运行时（`WebView2Runtime/`）；
4. 解压 `dist/NOVA-1.5.3-legacy-single.zip`，运行 `launch.cmd`；
5. 验证：启动、扫描、启动游戏/计时、设置、导出/导入、主题切换、托盘、安全档。
6. 记录到 `docs/COMPATIBILITY.md` §4.3 与本文。

### P0 · 物理手柄
1. Xbox 与 DualSense 各接一次；
2. 验证：焦点环、方向键/摇杆重复、A/B、LB/RB、RS/LS、select 循环；
3. 验证设置页所有按钮、外观主题卡、库卡片、对话框、文件选择器；
4. 如果某主题焦点环被裁切，调 `.is-pad-focus` 的 outline/box-shadow 或容器 overflow。

### P1 · 全界面回归
```bash
node tools/export-all.js --views=all --sizes=1439x1124,960x600 --stress
node tools/probe-graphics.js
```
重点看：设置、外观、详情、启动、对话框、选择器、系统模式、30 字长名。
然后重建包并核对 `dist/release-manifest.json`。

### P1 · 包验收
- 单文件版在**没有 src/themes 的干净目录**启动；
- 全主题版确认 10 个主题文件夹 + 内置 NOVA；
- 头像文件、`.nova-pack`、CSV、备份在 Legacy 下仍可用；
- 确认 `NOVA_CACHE_ROOT` / 默认缓存不在 C。

### P2 · 可选优化
- 主题切换逐套真机手感（60Hz 屏幕）复核；
- 思源字体缺失机器的回退验收；
- 若比赛机器无思源字体，评估子集化随包方案（先确认授权/体积）；
- 继续收集 ZERO HOUR 切换的用户反馈，必要时微调字幕带高度/速度线密度。

---

## 8. 绝对不要回退的约定

1. `html.is-nova-system` 的外观/面板规则必须限定在 `html[data-theme="nova"]`；
2. ZERO HOUR 主色青柠 `#c6ff2e`、次色青蓝 `#59e3ff`，黄色只给注意/警示；
3. ZERO HOUR 切换不再出现黄色字；
4. SUMMER 不再往角色脸上压黑色帆船/伞骨线稿；缩略图保持线稿版式；
5. `fit-content` 标题的可用宽度取父级文字列，不要取自身；
6. 不要给 `.logo` 的 `letter-spacing` 做过渡；
7. 幕布第一次切换先画初始态再启动；
8. 主题顺序前四固定：NOVA → 终末地 → 零点街区 → 秘典；
9. 全屏层禁用 `filter` / `backdrop-filter`；只动 transform/clip-path/opacity；
10. 缓存及时清理且不落 C 盘。
11. `steam://` 唤起必须留在后台线程，不能回到 UI 线程；
12. Steam 启动返回 `pending`，会话只在找到真实进程后登记；
13. 客户端状态只读注册表，不在 boot payload 路径上枚举进程；
14. 不引入 `steam_api.dll` 模拟器（Goldberg 等）来绕过客户端校验。

---

## 9. 快速启动 / 验证命令

```bash
cd nova-game-space-desktop

# 开发运行（E: 缓存，CDP 9223）
./tools/relaunch.sh

# 构建 Legacy 单文件/全主题包
bash tools/pipeline.sh --skip-audit

# 完整审计
node tools/export-all.js --views=all --sizes=1439x1124,960x600 --stress

# 版本号（唯一源）
node tools/bump-version.js 1.5.4
```

> 改主题 CSS 后：bump `theme.json` patch → `relaunch.sh` 同步到用户主题目录 → 重启。
> 改预览图后：`render-concepts.js <out> --only=<id>` → 缩到 960×540 JPG → bump 主题版本。

---

## 10. PR 历史（本轮）

- **#14** `fix: 1.5.3 gamepad and visibility`：默认模式作用域、字标对比度、导航英文、
  零点街区漫画分页、手柄全选项焦点、1.5.3 打包。
- **#15** `fix: Aurum/Codex contrast`：AURUM / CODEX 外观说明小字对比度。

下一轮从 **P0 Win7 / 物理手柄** 开始即可。
