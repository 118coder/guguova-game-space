# GUGUOVA 下一轮交接文档

> 交接版本：**1.12.0**
> 交接时间：2026-10-21
> 上一轮：1.11.2（去重缩放方式 / 开机全屏 / 徽章可读）
> 分支：`feat/launch-display-and-scaling`（PR **#22**，未合并）
> 基线：`main` @ `1780b48`

---

## 0. 这一轮做了什么（1.10.0 → 1.12.0）

一句话：**玩家按下「开始游戏」之后的一切**。

| 版本 | 内容 |
| --- | --- |
| 1.10.0 | Steam 提权修复、游戏窗口置前、启动器退场、全屏缩放（Magpie / 无边框） |
| 1.10.1 | 外观预览的取景编辑（方向条 / 拖动 / 缩放 / 复位，按游戏记忆） |
| 1.11.0 | 内置轻量 Magpie、快捷键录制、简化引擎弹窗、`.nova-select` 主题化下拉 |
| 1.11.1 | 改名 GUGUOVA、开机自启、引擎弹窗按主题换肤 |
| 1.11.2 | 删掉重复的「全屏缩放方式」、开机后无边框全屏、徽章文字可读性 |
| 1.12.0 | Steam 封面改取原图（扫描按分辨率挑选 + 只降不升） |

### 0.1 Steam 提权（根因）

本机 `HKCU\...\AppCompatFlags\Layers` 里 `steam.exe` 被打了 `RUNASADMIN`：

```
D:\Program Files (x86)\Steam\Steam.exe = "~ RUNASADMIN"
```

- 走 `steam://` 时 shell 协议处理器会起提权的 steam.exe 助手 → **每开一次游戏弹一次 UAC**。
- 当时的 Steam 也在管理员权限下（TokenElevation=1），游戏进程继承管理员权限，
  NOVA 读不到 `MainModule` → 进程找不到 → 会话不登记、遮罩不关、启动器 Topmost → 窗口出不来。

处理：

- `Services/SteamPrivilege.cs`：诊断 + 只删 `RUNASADMIN`（保留 `HIGHDPIAWARE` 等），
  原值备份到 `backups\steam-privilege-*.json`；`RestartClient()` 用 `-shutdown` 后以普通权限重启。
- `SteamService.RunGame` 改走 `steam.exe -applaunch <appid>`（`UseShellExecute=false`），
  绕开协议处理器；标记仍在时 CreateProcess 返回 740，UI 明确提示而不是弹窗。
- 启动前弹应用内对话框：**修复并重启 Steam / 先这样启动 / 取消**；设置页也有入口。
- 进程发现补「进程名 + 启动时间」兜底，管理员权限下的游戏也能登记。

### 0.2 游戏窗口置前与启动器退场

- `Services/GameDisplay.cs`：轮询进程最大的可见顶层窗口（15 s），
  `SetForegroundWindow` + `BringWindowToTop`，失败依次用 `AttachThreadInput`、`SwitchToThisWindow`；
  「前台」按窗口所属进程判定（游戏常用 owned 弹窗）。
- **顺序不可换**：先保持启动器在前台 → 等窗口出现并置前 → 再最小化。
  先最小化会丢 `AllowSetForegroundWindow` 授权，窗口又回到启动器后面（这是 1.9.0 的投诉）。
- `MainWindow`：`BeginGameSession()` / `MinimizeForGame()` / `EndGameSession()`；
  最后一个会话退出后恢复窗口与全屏几何，用户手动恢复过就不动。
- 前端：`session-presented` 到达后关闭沉浸式启动遮罩。

### 0.3 全屏缩放与内置引擎

- 分发：`engine/magpie/` = 未修改的 Magpie 0.12.1 **轻量版**（Lanczos / FSR / FSRCNNX / CAS /
  Sharpen 等，去掉 Anime4K / CuNNy / RAVU / NNEDI3 / CRT / xBRZ）。
  独立进程、GPLv3，附 `NOTICE.md` / `SOURCE-OFFER.txt` / `LICENSE-GPL-3.0.txt`。
  二进制不进 git；构建前跑 `python tools/fetch-magpie.py`（`--lite` 为轻量）。
- 生命周期：**只在「全屏缩放」开关打开时拉起**；由 NOVA 拉起的引擎在最后一个游戏退出后
  自动关闭（`ReleaseIfAutoStarted`），玩家自己开的 Magpie 不动。
- `Services/ScalingEngine.cs`：检测（运行中 → 自定义路径 → 内置 → 系统安装）、启动并隐藏主窗
  （`WM_CLOSE` 到托盘）、快捷键编解码与 `config.json` 写入、简化选项读写。
- 快捷键编码：`key | win<<8 | ctrl<<9 | alt<<10 | shift<<11`，默认 **3137 = Alt+Shift+A**。
  设置里可录制；`auto` 由 Magpie 持有，`native` 由启动器 `RegisterHotKey`（切换时会先关 Magpie）。
- 简化引擎弹窗：缩放方式 / 算法（带适用说明，缺效果置灰）/ 画面捕获 / 光标缩放 /
  最大帧率 / 3D 模式 / 自动启动引擎 / 打开完整 Magpie / 恢复默认。
- 弹窗按主题换肤：`--sheet-*` 令牌，14 套主题各有一组覆盖。

### 0.4 外观取景编辑

- 预览下方「编辑取景」：方向条每次 2%、`±` 每次 10%、`◎` 复位、可直接拖动；
  读数 `X · Y · 缩放%`。
- 写回既有 `HeroPosition` / `HeroZoom`，按游戏记忆；450 ms 防抖，切游戏 / 完成 / 离开外观页立即落盘。
- `Esc`、方向键、`+/-/0` 在编辑态归取景面板所有。

### 0.5 改名与设置

- 用户可见名称全部 GUGUOVA：exe（`GUGUOVA.exe`）、窗口标题、托盘、`launch.cmd`、
  单实例互斥名、导出文件名（`GUGUOVA-*.nova-pack`、`GUGUOVA-playtime-*.csv`）、
  `我的文档\GUGUOVA Backups`。
- **保持不变的兼容标识**：`%LOCALAPPDATA%\NOVA Game Space`、`NOVA_*` 环境变量、
  主题 id `nova`、命名空间 `NovaGameSpace`、项目文件名。
- 新增设置：
  - `Startup`（`HKCU\...\Run\GUGUOVA`，写成 `"<exe>" --startup`）
  - `StartupFullscreen`：仅带 `--startup` 时生效，开机直接无边框全屏
  - `FullscreenScale`（每款游戏，`bool?`：null = 跟随启动器）
  - `MinimizeOnLaunch`、`ScalingEngine`（auto/native/off）、`ScalingHotkey`、`MagpiePath`、`AutoStartEngine`

### 0.6 Steam 封面取原图（1.12.0）

两层原因：

1. Steam 把美术放在 `librarycache\<appid>\<hash>\`，文件名带语言后缀
   （`library_hero_schinese.jpg`）。旧代码只找平铺路径，找不到就退回「目录里任意 `.jpg`」，
   拿到 32×32 图标再放大。
2. 即使取到 1920×620，`ImportImage` 也先裁成 16:9 再拉到 1920×1080，凭空放大 1.74 倍。

修法：

- `GameScanner.FindSteamCachedImage`：按分辨率挑选，递归 hash 目录，排除 `blur` / `logo`，
  小于 64×64 视为缺失，多库盘都扫。
- `MediaService.FitHero`：保留原始宽高比、只降不升，JPEG 质量 92。
- 新增 `refreshArtwork` + 详情页「用 Steam 最新封面重新导入」。

本机结果：22 个 Steam 条目 → 1920×620 原图（缓存仅 1024×550 的保留原样）。

### 0.7 本轮改动的文件

| 文件 | 改动 |
| --- | --- |
| `Services/GameDisplay.cs` | 新增：窗口查找 / 置前 / 无边框 / 原生热键切换 |
| `Services/ScalingEngine.cs` | 新增：引擎检测、启动、隐藏、快捷键、简化选项 |
| `Services/SteamPrivilege.cs` | 新增：提权诊断、修复、重启 |
| `Services/StartupService.cs` | 新增：开机自启（HKCU Run） |
| `Services/GameScanner.cs` | 封面按分辨率挑选；`FindSteamHero` |
| `Services/MediaService.cs` | hero 保留原比例、只降不升 |
| `Services/LauncherService.cs` | 启动选项、选项生命周期、进程名兜底、置前授权 |
| `Services/LibraryModels.cs` | `FullscreenScale`、`MinimizeOnLaunch`、`ScalingEngine`、`ScalingHotkey`、`MagpiePath`、`AutoStartEngine`、`StartupFullscreen` |
| `Services/SteamService.cs` | `RunGame` 改 `-applaunch`；740 处理 |
| `Services/BackupService.cs` | 导出文件名 GUGUOVA |
| `MainWindow.xaml(.cs)` | 会话最小化 / 恢复 / Topmost 让位 / 原生热键 / 开机全屏 |
| `NativeBridge.cs` | `steamPrivilege`、`magpieStatus`、`applyScalingHotkey`、`engineOptions`、`startupState`、`refreshArtwork` 等 |
| `src/index.html` `app.js` `app.css` | 首页/详情开关、引擎弹窗、取景编辑、主题下拉、徽章 |
| `themes/steam` `dusk` `endfield` | order / 宽度 / 管理面板对比度 |
| `third_party/magpie/` | GPLv3 许可、NOTICE、源码说明（二进制 gitignore） |
| `tools/fetch-magpie.py` | 拉取引擎（`--lite`） |
| `tools/pipeline.sh` `package-release.py` | 打包前取引擎；README 文案 |

### 0.8 本机验证记录（2560×1440）

| 项 | 结果 |
| --- | --- |
| 提权诊断 | `adminLayer="~ RUNASADMIN"`、`steamElevated=true`、`needsFix=true` |
| 提权修复 | 备份 `steam-privilege-*.json`；重启后 `elevated=false`、`needsFix=false`；**Steam 停在登录界面** |
| 无边框缩放 | charmap / mstsc：`0,0 2560×1440`、`caption=false`、`foreground=true` |
| 启动器退场 | 窗口置前后 `IsIconic=true`；退出后 `false` |
| Magpie | `engine=magpie scaled=true`，`Magpie.SrcHWND` 与游戏 HWND 一致 |
| 引擎按需 | 开关关闭：`before=false → after=false`；打开：自动拉起，退出后 `released` |
| 快捷键 | Ctrl+Alt+S → 1619，写入 Magpie 配置并重启生效；已恢复 3137 |
| 原生热键 | `RegisterHotKey=true`；572×536 → 2560×1440 → 恢复 572×536 |
| 开机自启 | `HKCU\...\Run\GUGUOVA` 写入 `"<exe>" --startup`；带参数启动 `fullscreenState=true` |
| 封面 | 22 条刷新为 1920×620；`naturalWidth=1920` |
| 主题 | codex 棕金 / steam 炭黑 3px / summer 纸白 8px / dusk 羊皮纸 / endfield 直角硬阴影 |

---

## 0b. 历史：1.9.0 三套主题重做

| 主题 | 版本 | 新构图 | 开屏 | 切换 |
|---|---|---|---|---|
| 黄昏之炼 `dusk` | 2.0.8 | 暮色天幕 + 委托信：撕边、图钉、麻绳、贴照、已受理章、火漆印、炼金环 | `.intro-dk2` | 拆信封 |
| Steam 经典 `steam` | 2.0.8 | Big Picture：全幅封面 + 炭黑控制台 + 最近游戏架 + 键位条 | `.intro-st2` | tile 放大 |
| 夜航 `nightflight` | 1.0.8 | 登机牌 + 舷窗 + 撕口 + 条码 + DEPARTURES 航班表 | `.intro-nf` | 票根对撕 |

16 个音效全部用 genny 重合成（`tools/sfx-specs/make-themes-2.2.py`）；
三套主题**禁止任何模糊**，`backdrop-filter` 全部置 none。
其它细节见 `docs/themes/*.md` 与 `docs/DESIGN-PHILOSOPHY.md` §5.12–5.14。

---

## 1. 一句话状态

应用 **1.12.0**，14 套主题（nova + 13）。启动链路已经完整：Steam 提权可修复、
游戏窗口直接置前、启动器自动退场、全屏缩放随包分发且按需启动、
快捷键与引擎选项都能在启动器里改、Steam 封面取原图。
本轮结束在「真实 Steam 游戏全流程尚未跑通」这一步（见 §3b P0）。

---

## 2. 先读什么

1. **`docs/GAME-DISPLAY.md`** —— 置前时序、窗口选择、Magpie 快捷键编码、原生热键。
2. **`docs/STEAM-LAUNCH.md`** §3.2 —— `steam.exe -applaunch` 链路与提权修复。
3. 本文 §0.3 —— 引擎分发与生命周期（GPLv3 边界）。
4. `docs/DESIGN-PHILOSOPHY.md` §2 —— 9 条硬规则（含本轮新增的主题适配与文字对比度）。
5. `docs/THEME-INTERFACES.md` —— 选择器、开屏、幕布、字体契约。
6. `docs/themes/dusk.md` / `steam.md` / `nightflight.md` —— 三套重做主题。
7. `docs/SFX-MAP.md` §4 —— genny 音效配方与门槛。
8. 本文 §4–§7 是 1.8.0 的历史判断，仅作对照。

---

## 3. 版本基线

应用：**1.12.0**（`version.json` 是唯一版本源）；品牌 **GUGUOVA**；
仓库 `https://github.com/118coder/guguova-game-space`。

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
| dusk | 2.0.8 | 重做完成 | `dusk` | 信封拆开 |
| steam | 2.0.8 | 重做完成 | `steam` | tile 放大 |
| nightflight | 1.0.8 | 新主题 | `nightflight` | 票根对撕 |

发行包（`dist/`）：`GUGUOVA-1.12.0-legacy-single.zip`（8.89 MB）、
`GUGUOVA-1.12.0-legacy-full.zip`（12.19 MB）。两者都带 `engine/magpie/` 轻量引擎。

---

## 3b. 下一轮清单

### P0 · Steam 全流程（唯一真正的阻塞项）

修复提权重启后 Steam 停在**登录界面**，本轮没跑通真实的
「登录 → 启动 → 计时 → 退出」：

1. 登录 Steam，确认 设置 → 系统与兼容性 → Steam 权限 显示 **普通权限**。
2. SteamStub 游戏（如「噩梦摇篮」）与普通 Steam 游戏各跑一遍：
   未登录冷启动、登录后启动、进程出现计时、退出结算。
3. `launchMode` 三种模式各验一次；直连模式确认不会误走客户端。
4. 确认启动时**没有任何 UAC 弹窗**（这是本轮的核心诉求）。

### P0 · 缩放引擎真机

- 用轻量包在**另一台**没有 Magpie 的机器上跑：自动拉起、隐藏主窗、快捷键触发、
  游戏退出后自动关闭。当前只在本机（已装 Magpie + 用户配置）验证过。
- 验证 `--lite` 缺效果时置灰并在真实游戏上跑一次 FSR（现在只在设置里看过置灰）。
- 验证 `native` 模式热键在 4:3 / 带黑边窗口上的表现。

### P0 · 真机与主题回归

- Win7 SP1 x64 + .NET 4.8 + WebView2 109：解压 legacy-single，验证启动 / 扫描 / 计时 /
  设置 / 导入导出 / 托盘 / 安全档。**注意**：Magpie 需要 Win10 1903+，
  Win7 上必须确认自动回退无边框且不报错。
- Xbox 与 DualSense 各接一次：焦点环、摇杆重复、A/B、LB/RB、RS/LS、`select` 档位循环。
- `export-all.js --themes=... --views=all --sizes=1439x1124,960x600 --stress`
  重跑 14 套（上一轮基线是 96 张 0 截断 / 0 溢出）。
- 本轮新增控件的主题检查（**还没全量过**）：首页「缩放设置 / 全屏缩放」在 14 套主题的位置与
  对比度、引擎弹窗表面色、`.nova-select` 菜单色。
  已验收 5 套：codex / steam / summer / dusk / endfield；其余 9 套待过。

### P1 · 音频听感

逐主题试听 16 个 cue；重点是 1.9.0 三套（dusk 木扣+纸噪、steam solenoid、nightflight 翻牌与 PA）。

### P2 · 文档与截图

- README 的详情页 / 设置 / 首页截图仍是 1.9.0 的，没有全屏缩放开关、缩放设置按钮、
  Steam 权限卡片、引擎弹窗。**必须先用隔离演示库（§7b）再拍**，不要拿真实库当素材。
- `docs/HANDOFF.md`、`docs/THEMES.md` 仍在用 NOVA 叙述，可择机合并或归档。

---

## 4–7. 历史：1.8.0 的判断与 Steam 经典返工方案

保留作对照，不是当前待办。要点：1.8.0 的 Steam 经典被判「只是给卡片加了标题栏」，
根因是缺客户端结构（左库栏 / 密集行 / 状态区）而不是配色；
返工流程要求「先出静态构图稿 → 用户点头 → 再写 CSS」。已于 1.9.0 完成重做。

---

## 7b. 事故记录：1.8.0 演示截图覆盖了用户媒体库（已还原）

1.8.0 截图期间把 6 条示例条目的 media 覆盖成排版封面，还改了 `library.json`。
已从 `backups/NOVA-auto-20261020-214114.nova-pack` 全部还原。定下的规矩：

1. **永远不把用户数据目录当作截图素材**。
2. 演示截图必须走隔离：`tools/demo-library.py seed|restore`，或给应用加
   `NOVA_DATA_ROOT` 让开发/截图用独立数据目录。**这一步至今没做，是下一轮 P0。**
3. 任何写用户数据目录的操作，动手前先 `robocopy /E` 备份到 `_shots/` 并登记。
4. 排版封面只存在于 `tools/demo-covers.py` 的输出与仓库 `docs/*.jpg`。

> 本轮所有测试都遵守了这条：测试前备份 `library.json` + `media\<id>\`，结束后还原；
> 唯一保留的变化是 22 条 Steam 封面被升级为原图（这是用户想要的修复）。

---

## 8. 其它待办（功能侧）

### P0 · 演示截图数据隔离

按 §7b 落地 `tools/demo-library.py seed|restore` 或 `NOVA_DATA_ROOT`。
**先有这个，再碰任何截图。**

### P1 · Magpie profile 集成

现在只按快捷键单次缩放。可以进一步：

- 写入 `profiles[0].autoScale`，让 Magpie 对匹配 exe 的窗口自动缩放（无需模拟快捷键）；
- 为每款游戏命名 profile，把 NOVA 的「全屏缩放」映射成 Magpie 的规则。
  需要先读 Magpie 的 `ScalingService` / `Profile` 实现，确认写入后是否需要重启。

### P2 · 缩放引擎的完整效果包

轻量包去掉了 Anime4K / CuNNy / RAVU / NNEDI3 / CRT / xBRZ。
需要这些时目前只能「指定 Magpie.exe」；可以考虑做「可选效果包」导入。

### P2 · 全屏缩放的宽高比

原生无边框是拉伸到显示器比例，4:3 游戏会变形。可加「保持比例（加黑边）」选项，
在 `ApplyBorderless` 里按内容比例居中并留边。

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
10. Steam 唤起留在后台线程；Steam 启动返回 `pending`，只在找到真实进程后登记；
11. 不引入 `steam_api.dll` 模拟器绕过客户端校验；
12. 主题音效**替代**统一音效；`boot` 与开屏同时启动，跳过时淡出；
13. 音效 URL 必须带 `?v=<主题版本>`；
14. 雪花噪/白噪声只用于切换/失败/开屏底噪；
15. 自定义开屏舞台必须显式隐藏共享 `.intro-stage` / `.intro-corners` / `.intro-grain`；
16. DUSK 纸面正文一律墨色；封面取样与纸胶带不得进入文字列；
17. DUSK 不用发光魔法阵、粒子、霓虹；
18. **STEAM 不使用 Valve 素材**；绿色只给主按钮与「就绪」，红色只给缺失/删除；
    不伪造在线人数、下载速度、成就数；
19. **每套新主题先交静态构图稿，用户确认后再写 CSS**；
19b. **用户数据目录神圣不可侵犯**：动手前备份并登记（1.8.0 事故）；
20. 示例库与截图里不允许出现真实游戏素材；
21. 技术标识（程序集命名空间、AppData `NOVA Game Space`、`NOVA_*` 环境变量、
    主题 id `nova`、项目文件名）**不跟随品牌改名**——改了会读不到旧数据、主题断链；
22. **启动器必须等游戏窗口出现并置前后才最小化**；先最小化会丢失 `AllowSetForegroundWindow` 授权；
22b. **用户可见的名字一律 GUGUOVA**：exe、窗口标题、托盘、启动脚本、导出文件名；
23. **Steam 启动走 `steam.exe -applaunch`，不要回到 `steam://`**；提权修复只删 `RUNASADMIN`，
    改之前必须备份原值，不能替玩家改回其它兼容性标记；
24. **Magpie 快捷键按位域解码**（`key | win<<8 | ctrl<<9 | alt<<10 | shift<<11`，默认 3137）。
    可以随包分发未修改的 Magpie 并自动启动，但必须保持独立进程、附 GPLv3 许可与源码说明；
    失败必须回退无边框全屏；
25. 全屏缩放**永远先看游戏自己的选择**，未选择时才跟随沉浸式全屏；
    `scalingEngine=off` 时不得偷偷缩放；**引擎只在开关打开时启动，退出后关闭**；
26. 外观取景编辑**只写 `HeroPosition` / `HeroZoom`**，按游戏记忆；不要另起字段，也不要把预览改成 contain；
27. **首页启动区块顺序固定**：标题 → 类型 → 主按钮排（开始游戏 / 详情 / 缩放设置）→
    全屏缩放开关 → 进度；任何主题重排 `hero-inner` 都必须把 `.hero-scale` 写进 order / 宽度规则；
28. **新增按钮 / 卡片 / 弹窗 / 下拉必须同步适配 14 套主题**：弹窗表面用 `--sheet-*` 令牌，
    纸面主题不得出现深色方块；禁止系统原生 `select` 弹层、消息框、文件框；下拉用 `.nova-select`；
29. **文字不得借用 accent**：徽章、状态值、提示一律继承所在行的墨色
    （可用同色低透明度底/描边），因为多套主题把 accent 当浅色面；
30. **Steam 封面按分辨率挑选，不要按文件名猜**；hero 保留原始宽高比、只降不升，
    不允许把小于 64×64 的图放大当主视觉。

---

## 10. 快速命令

```bash
cd nova-game-space-desktop

# 开发运行（E: 缓存，CDP 9223）
./tools/relaunch.sh

# 拉取内置引擎（干净克隆后必须先跑，否则包里没有 engine/magpie）
python tools/fetch-magpie.py            # 完整效果
python tools/fetch-magpie.py --lite     # 轻量（默认发行内容）

# 单主题审计
node tools/export-all.js --themes=steam --views=all --sizes=1439x1124,960x600 --stress

# 通过 CDP 调用桥方法
node tools/drive.js "return await window.nova.call('magpieStatus');"
node tools/drive.js "@.cache/script.js"

# 打包（会先检查/拉取引擎）
bash tools/pipeline.sh --skip-audit --version 1.12.1

# 版本号（唯一源）
node tools/bump-version.js 1.12.1
```

Git / PR：本机 git 能直接访问 `github.com`，凭证由 credential manager 提供；
`git push` 后可用 API（`POST /repos/118coder/guguova-game-space/pulls`）建 PR。`gh` 未安装。

---

## 11. 已知限制与风险

- **Steam 提权修复会重启客户端**：本机实测重启后停在登录界面（ActiveUser=0）。
  不要为了免登录而保留管理员权限运行。
- **全屏缩放只对窗口化游戏有效**：独占全屏已经是全屏，NOVA 不动它；
  原生无边框会拉伸到显示器比例，4:3 会变形。
- **Magpie 需要 Win10 1903+**：Win7/8 上 `ScalingEngine.Supported=false`，自动走无边框；
  打包后**必须在 Win7 上确认不报错**。
- **引擎只在开关打开时启动**：`autoStartEngine` 关掉后不会自动拉起，只能手动；
  `scalingEngine=native` 时由启动器自己注册全局热键，与 Magpie 互斥（切换时会先关 Magpie）。
- **Magpie profile `autoScale` 未接入**：仍是「按一次快捷键」。
- **Store 版应用的转发 exe**（Win11 的 `notepad.exe`、`calc.exe`）启动后会把窗口交给
  另一个进程并自己退出，NOVA 只能记录转发进程；这类条目不适合验证置前。
- **Steam 封面依赖客户端缓存**：从没在 Steam 里打开过的游戏，`librarycache` 里可能没有美术，
  `refreshArtwork` 会跳过。
- **`DeveloperOnly` 会在启动时按 exe 路径重算**，指到系统目录会被隐藏。
- **改 `library.json` 前必须先关应用**，否则退出时会用内存状态覆盖。
- **WebView2 偶发 GpuProcessExited**：先杀 `msedgewebview2.exe`，换新的 `NOVA_CACHE_ROOT`，
  并用 `NOVA_WEBVIEW_ARGS="--disable-gpu --use-angle=swiftshader --no-sandbox"`。
- **应用是单实例 + 后台子进程**：启动与截图必须在同一个 shell 调用里。
- Steam 边界：不带客户端只能启动本身不依赖 Steam 运行时的游戏；不做绕过。

---

## 12. PR 历史

- `5c4aca2` feat: 启动体验、内置缩放引擎与封面原图（1.12.0）— **PR #22，待合并**
- `1780b48` docs: 交接文档补充外观预览最终结构
- `77e1067` 重做黄昏与 Steam，新增夜航主题（2.0.8 / 1.0.8）(#21)
- `0b42f76` docs: 记录 1.8.0 截图覆盖用户媒体库事故与数据隔离规矩

下一轮从 **§3b P0 · Steam 全流程** 开始（登录 Steam 后跑真实启动链）。
