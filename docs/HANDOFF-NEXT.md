# GUGUOVA 下一轮交接文档

> 交接版本：**1.12.0**
> 交接时间：2026-10-21
> 上一轮：1.11.0（内置引擎）
> 上上轮：1.9.0（三套主题重做）
> 本轮主题：**启动体验**（Steam 提权、游戏窗口置前、全屏缩放）

---

## 0. 1.10.0 / 1.10.1 本轮：启动体验与外观取景

这轮只解决一件事：**玩家按下「开始游戏」之后，不要弹 UAC、不要把游戏挡在启动器后面**。
两个投诉其实是同一条链路上的两个症状，根因在本机查清了：

```
HKCU\Software\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers
  D:\Program Files (x86)\Steam\Steam.exe = "~ RUNASADMIN"
```

Steam.exe 被打了「以管理员身份运行」兼容性标记。启动器每次唤起 `steam://` 都会先起一个
steam.exe 助手，Windows 按标记要求提权 → **每打开一次游戏弹一次 UAC**。
当前运行的 Steam 也确实在管理员权限下（TokenElevation=1），于是游戏进程也继承管理员权限；
NOVA 以普通权限运行，读不到它们的 `MainModule`，进程找不到 → 会话不登记、启动遮罩不关、
启动器又是 Topmost 全屏 → **游戏窗口一直出不来**。

### 0.1 Steam 提权：诊断、修复、重启

- 新文件 `Services/SteamPrivilege.cs`：
  - 读 Layers 里 steam.exe 的 `RUNASADMIN`；
  - 用 `OpenProcessToken` / `TokenElevation` 判断 Steam 与启动器自己的完整性级别；
  - `RemoveAdminLayer()` 只删 `RUNASADMIN`，保留 `HIGHDPIAWARE` 等其它标记；
    改之前把原值写进 `%LOCALAPPDATA%\NOVA Game Space\backups\steam-privilege-*.json`；
  - 只剩 `~` 时直接删掉整个值，不留下空壳；
  - `RestartClient()` 先 `steam.exe -shutdown`，等进程退出，再用普通权限启动。
- `SteamService.RunGame` 不再走 `steam://`，改为直接启动
  `steam.exe -applaunch <appid>`（`UseShellExecute=false`）。
  这样绕开 shell 协议处理器（UAC 就是在这里触发的），而且标记还在时
  CreateProcess 会返回 740，NOVA 能给出「请先修复提权」而不是弹窗。
- UI：
  - 点 Steam 游戏启动时先诊断；需要修复就弹应用内对话框：
    **修复并重启 Steam / 先这样启动 / 取消**。每个会话只问一次「先这样」。
  - 设置 → 系统与兼容性新增 **Steam 权限** 状态与「修复提权弹窗」按钮。
  - 修复并重启会提示「可能需要重新登录」——本机实测重启后 Steam 停在登录界面。
- 兜底：即便还没修复，`FindSteamGameProcess` 在 `MainModule` 被拒绝时改用
  **进程名 + 最近启动时间** 匹配，管理员权限下的游戏也能登记会话。

### 0.2 游戏窗口置前与启动器退场

- 新文件 `Services/GameDisplay.cs`：
  - 轮询该进程最大的可见顶层窗口（最多 15 s），`SetForegroundWindow` + `BringWindowToTop`；
  - 失败时依次尝试 `AttachThreadInput` 附加前台线程、`SwitchToThisWindow`；
  - 判定「前台」看窗口所属进程，而不是必须同一个 HWND（游戏常有 owned 弹窗）。
- 时序是关键：**先保持启动器在前台，等游戏窗口真的出现并置前，再最小化启动器**。
  之前的写法先最小化会导致 `AllowSetForegroundWindow` 授权失效，游戏窗口还是出不来。
- `MainWindow` 新增 `BeginGameSession()` / `MinimizeForGame()` / `EndGameSession()`：
  会话开始时取消 Topmost；窗口出现后最小化；最后一个游戏退出后恢复窗口与全屏几何。
  用户手动恢复过窗口就不动。
- 前端：`session-presented` 到达后关闭沉浸式启动遮罩（不再等按键）；
  `session-started` 只负责「运行中」文案，不再直接关遮罩。
- 新设置 `minimizeOnLaunch`（默认开）：设置 → 启动与关闭 →「启动游戏后最小化」。

### 0.3 全屏缩放（Magpie / 无边框）

- 数据：`GameEntry.FullscreenScale`（`bool?`）。
  `null` = 跟随启动器：沉浸式（全屏）默认勾选，窗口模式默认不勾；
  玩家点过复选框后写入 true/false，只对这款游戏生效。
- 详情页在「开始游戏」上方新增 **全屏缩放** 开关，提示文案随状态变化：
  `沉浸模式下默认开启` / `全屏显示时默认开启` / `仅对这款游戏生效`。
- 设置 → 全屏缩放方式：
  - `auto`（默认）：Magpie 正在运行就用 Magpie，否则用无边框；
  - `native`：只做无边框拉伸；
  - `off`：关闭，详情页开关置灰。
- 原生全屏：去掉 `WS_CAPTION / WS_THICKFRAME / ...`，`SetWindowPos` 到当前显示器，
  450 ms 后复查一次（有些引擎启动时会重建窗口）；已经是无边框全屏的窗口直接算成功。
- Magpie：
  - 自动检测：运行中的进程、卸载表 `DisplayIcon / InstallLocation`、
    `%LOCALAPPDATA%\Magpie`、Program Files；设置里可手动指定 `Magpie.exe`。
  - 读取 `%LOCALAPPDATA%\Magpie\config\v*\config.json` 的 `shortcuts.scale`，
    按 Magpie 的编码解码：`key | win<<8 | ctrl<<9 | alt<<10 | shift<<11`。
    **3137 = Alt+Shift+A（Magpie 默认），不是 Win+Shift+A**——这是本轮踩到的坑。
  - 用 `keybd_event` 发送快捷键，随后等 6 s 检查
    `Window_Magpie_967EB565-6F73-4E94-AE53-00CC42592A22` 的 `Magpie.SrcHWND`
    是否等于游戏窗口；失败就回退无边框。
  - 1.11.0 起把未修改的 Magpie 官方发行版放进 `engine/magpie/`，需要缩放时自动拉起并
    把主窗口收进托盘；它仍是 GPLv3 独立进程，启动器不链接它。许可与源码说明见
    `third_party/magpie/NOTICE.md`、`SOURCE-OFFER.txt`。
- 启动后通过 `session-presented` 通知前端 `{requested, windowFound, scaled, foreground, engine, error}`；
  缩放失败会在通知里留一条记录，不打断游戏。

### 0.4 外观预览：取景编辑（1.10.1）

外观页的大预览会把 16:9 主视觉裁进竖向面板（多数主题用 `object-fit: cover`），
左右两侧会被切掉，玩家在预览里没法调。1.10.1 加了一个不离开预览的取景编辑：

- 预览标题区下方新增 **编辑取景** 按钮；首页 CTA 也加了「编辑」，点击直接跳到外观并打开取景面板；
  打开后取景面板出现在预览右上（顶栏下方），
  不压标题框和底部游戏切换条。
- 方向键 `↑ ← ◎ → ↓` 每次移动 2%，`− / +` 每次缩放 10%，`◎` 复位到 `50 / 45 / 100%`。
- 也可以直接在预览上拖动：水平拖满面板宽约等于 120% 行程，pointer capture，鼠标/触屏都可用。
- 编辑时 `←/→/↑/↓`、`+/-`、`0`、`Esc` 归取景面板所有，不会切换游戏。
- 读数显示 `X · Y · 缩放%`；数据写回现有的 `heroPosition` / `heroZoom`，
  首页背景、详情页、启动画面同步，并且**按游戏记忆**。
- 保存 450 ms 防抖；切换预览游戏、点「完成」、离开外观页都会先把上一款游戏的变化落盘。
- 面板深色 94% + blur，纸面主题与深色主题都能读；编辑按钮沿用主题 accent。
- 没有新增字段，也没有改主视觉的显示逻辑（仍是 cover）；编辑只决定「露出哪一块」。

### 0.5 本轮改动的文件

| 文件 | 改动 |
| --- | --- |
| `Services/GameDisplay.cs` | 新增：窗口查找 / 置前 / 无边框 / Magpie / 原生热键切换 |
| `Services/ScalingEngine.cs` | 新增：内置引擎检测/启动/隐藏、快捷键与简化选项 |
| `third_party/magpie/` | Magpie 0.12.1 发行版 + GPLv3 许可/源码说明（二进制不进 git） |
| `tools/fetch-magpie.py` | 拉取完整/`--lite` 引擎 |
| `tools/package-release.py` | 增加 `-lite` 发行包 |
| `Services/SteamPrivilege.cs` | 新增：提权诊断、修复、重启 |
| `Services/SteamService.cs` | `RunGame` 改为直接 `steam.exe -applaunch` |
| `Services/LauncherService.cs` | 启动选项、进程名兜底、`AllowForeground`、选项生命周期 |
| `Services/LibraryModels.cs` | `FullscreenScale`、`MinimizeOnLaunch`、`ScalingEngine`、`MagpiePath` |
| `MainWindow.xaml.cs` | 游戏会话最小化 / 恢复 / Topmost 让位 |
| `NativeBridge.cs` | 新方法 `steamPrivilege` / `fixSteamPrivilege` / `magpieStatus` / `startMagpie`，展示线程 |
| `src/index.html` / `app.js` / `app.css` | 详情页开关、设置卡片、修复对话框、`session-presented`、外观取景编辑 |

### 0.6 本机验证记录（2026-10-21，2560×1440）

| 项 | 结果 |
| --- | --- |
| 提权诊断 | `adminLayer="~ RUNASADMIN"`、`steamElevated=true`、`needsFix=true` |
| 修复（restart=true） | 备份 `steam-privilege-20261021-030052.json`；Steam 重启后 `elevated=false`、`needsFix=false` |
| 重启副作用 | Steam 停在登录界面（ActiveUser=0）；对话框已注明「可能需要重新登录」 |
| 无边框缩放 | charmap / mstsc：窗口 `0,0 2560×1440`、`caption=false`、`foreground=true` |
| 启动器退场 | 游戏窗口置前后 `IsIconic=true`；退出游戏后 `IsIconic=false` |
| Magpie | `engine=magpie scaled=true`，Magpie 窗口 `Magpie.SrcHWND` 与游戏 HWND 一致 |
| 沉浸式默认 | 全屏时详情页开关自动变为勾选，提示「沉浸模式下默认开启」 |
| UI 自动收场 | 启动遮罩在 `session-presented` 后自动关闭，恢复窗口时不会再看到它 |
| 外观取景 · 按钮 | 右移 3 次 + 放大 2 次 → `56 · 45 · 120%`，`library.json` 同期写入；复位回 `50 · 45 · 100%` |
| 外观取景 · 记忆 | 切到另一款游戏再切回，读数恢复 `56 · 45 · 120%`（测试后已复位） |
| 外观取景 · 拖动 | 指针拖动 80×20 px → `36 · 42 · 100%`，落盘 `36% 42%` |
| 外观取景 · 主题 | dusk / summer 抽查：面板与按钮可见、无遮挡；其余 12 套待回归 |
| 内置引擎检测 | `magpieStatus` 返回 `bundled=true`、`exePath=…\engine\magpie\Magpie.exe`、`hotkey=3137` |
| 引擎自动启动 | `startMagpie` 后 `running=true`，Magpie 主窗口不可见（WM_CLOSE 到托盘） |
| 快捷键编辑 | 录制 Ctrl+Alt+S → `settings=1619`、引擎配置 `shortcuts.scale=1619`，引擎重启后仍为 1619；已恢复 3137 |
| 简化 UI 保存 | 模式 FSR / 61 fps / 3D on 写入 `profiles[0]`，引擎重启；恢复 Lanczos / 60 / off |
| 原生快捷键 | 关掉 Magpie 后 `RegisterHotKey=true`；charmap 572×536 → 2560×1440 无边框 → 再按恢复 572×536 |
| 主题下拉 | 深色 codex 菜单 `rgb(18,18,18)` 白字；纸面 summer 菜单白底黑字；无系统白框 |
| 浅色对比 | summer 快捷键数值 `rgb(23,52,90)`，引擎弹窗标签/输入为浅字深底；首页开关提示继承行墨色 |
| 引擎按需 | 开关关闭时启动游戏：引擎保持 `running=false`；打开时自动拉起，游戏退出后自动关闭 |
| 算法备注 | 7 个模式各有一句备注，缺失效果的模式显示缺哪个文件并置灰 |
| 主题位置 | Steam 首页顺序 logo→meta→CTA→全屏缩放→进度；CTA 与开关同宽 630px 左对齐 |
| 改名 | 进程名 `GUGUOVA`、标题 `GUGUOVA · 游戏空间`、`startupState.exePath` 指向 `GUGUOVA.exe` |
| 开机自启 | 开启后 `HKCU\...\Run\GUGUOVA` 写入带引号的 exe 路径；关闭后值被删除 |
| 弹窗换肤 | codex 棕金 / steam 炭黑 3px / summer 纸白 8px / dusk 羊皮纸 / endfield 直角硬阴影 |
| 缩放方式去重 | 设置页不再有 `settingsScaling`；弹窗内可选 auto/native/off |
| 开机全屏 | `--startup` + `StartupFullscreen` 时才全屏；手开仍按上次窗口几何 |
| 徽章可读 | `row-value` 继承行墨色 + 同色底；summer 为深蓝字浅胶囊 |
| Steam 封面 | 3469850 扫描结果指向 `library_hero_schinese.jpg`；导入后 hero 为 1920×620，非 1920×1080 拉伸 |
| 批量刷新 | `refreshArtwork` 更新 22 条、跳过 4 条非 Steam 条目 |
| endfield 管理面板 | 卡片纸白底 + 墨字（`rgb(22,22,22)` / `rgb(92,92,92)`） |

### 0.7 内置缩放引擎、快捷键与简化引擎 UI（1.11.0）

目标：**下载启动器就能用全功能**，不再要求玩家自己装/启动 Magpie，同时让快捷键和常用
引擎选项都能在启动器里改。

#### 引擎分发

- `engine\magpie\` 随包分发 **未修改的 Magpie 0.12.1 官方 x64 发行版**（核心 + 全部
  effects，约 26 MB；legacy 包会明显变大）。它是 GPLv3 独立进程，启动器只负责启动、
  隐藏窗口、写配置和发快捷键，不链接它的代码。
- 许可证、源码提供说明、版本与「不修改」声明在
  `third_party/magpie/{LICENSE-GPL-3.0.txt, NOTICE.md, SOURCE-OFFER.txt}`，
  打包时会一起进入 `engine\magpie\`。
- 二进制不进 git（`.gitignore`）；干净构建先跑 `python tools/fetch-magpie.py`，
  或给 `MAGPIE_LITE=1` 走轻量包：
  `python tools/fetch-magpie.py --lite` 只保留 Lanczos / Nearest / Bilinear / Bicubic /
  Jinc / Deband / ImageAdjustment / FSR / FSRCNNX / CAS / Sharpen（约 14 MB），
  去掉 Anime4K / CuNNy / RAVU / NNEDI3 / CRT / xBRZ 等大型效果。
  当前本机默认包保留完整 effects，因为现有配置用到 Anime4K / CRT / CuNNy。
- 发行包额外产出 `GUGUOVA-1.11.0-legacy-single-lite.zip`（8.88 MB）：由
  `package-release.py` 从完整 single 舞台复制后裁掉大型 effects；缺效果的模式在
  引擎设置里置灰，并自动改选第一个可用算法。完整 single 13.76 MB、full 17.06 MB。
- **引擎是显式开启的**：详情页 / 首页的「全屏缩放」开关是唯一入口。开关关闭时
  启动游戏不会启动引擎，也不会额外起进程；开关打开且 `autoStartEngine` 为真时才
  `EnsureRunning`。由 NOVA 拉起的引擎会在最后一个游戏退出后自动关闭
  （`ReleaseIfAutoStarted`），玩家自己开的 Magpie 不动。
- 启动顺序：`FindExe` 先看运行中的 Magpie，再看 `settings.magpiePath`，再看内置
  `engine\magpie\Magpie.exe`，最后才是系统安装路径。需要缩放时
  `ScalingEngine.EnsureRunning` 拉起引擎，等主窗口出现后发 `WM_CLOSE`（`showNotifyIcon`
  为 true 时收进托盘；false 时最小化），不让 Magpie 设置窗挡在游戏前面。

#### 快捷键

- 设置 → 启动与关闭 → **全屏缩放快捷键**：点击后录制组合键，默认 `Alt + Shift + A`。
  录完写进 `PlayerSettings.ScalingHotkey` 和 Magpie 的 `shortcuts.scale`（编码
  `key | win<<8 | ctrl<<9 | alt<<10 | shift<<11`）。
- `auto` 模式：Magpie 拥有这个全局键；启动器改完配置后重启引擎，新键立即生效。
- `native` 模式：启动器用 `RegisterHotKey` 自己注册，按一下把当前游戏窗口切成无边框
  全屏、再按恢复原样式与尺寸；切换模式时如果 Magpie 正在运行，会先关闭它释放按键，
  再重新注册。
- 注册失败（被别的程序占用）会弹通知，不会静默失败。

#### 简化引擎 UI

- 设置 → 全屏缩放方式下方「引擎设置…」打开一个符合主题的深色弹窗：
  - 缩放算法（从引擎配置的 `scalingModes` 读取，缺少效果文件的模式会置灰）；
    每个算法下面有一句人话备注：FSR「功能全面，适合大部分游戏」、
    Integer Scale 2x「整数倍放大，像素游戏首选」、FSRCNNX「神经网络，显卡要求较高」、
    CuNNy / Anime4K / CRT 各自说明；列表随选择高亮当前项。
  - 画面捕获（Graphics Capture / Desktop Duplication / DWM）；
  - 光标缩放（不缩放 / 跟随画面 / 1.25× / 1.5× / 2×）；
  - 「随游戏自动启动引擎」开关（`autoStartEngine`，引擎只在开关打开时才会被拉起）；
  - 最大帧率、3D 游戏模式；
  - 打开完整 Magpie / 恢复默认 / 保存并重启引擎。
- 保存写 `profiles[0]` 的 `scalingMode / captureMethod / cursorScaling / maxFrameRate /
  3DGameMode`，改前备份 `%LOCALAPPDATA%\NOVA Game Space\backups\magpie-config-*.json`，
  然后重启引擎。没有新增 Magpie 字段。
- **所有下拉换成 `.nova-select`**：保留主题已经画好的原生 select 闭合态，用透明命中层
  打开主题化列表，彻底去掉系统白色弹层。列表用 `Canvas / CanvasText` 跟随主题明暗，
  选中项用主题 accent。

#### 首页入口

- 首页 CTA 一排：`开始游戏` / `游戏详情` / `缩放设置`；下面紧接一条「全屏缩放」开关。
- 这一条在所有主题里位置一致：Steam 用 order 6（CTA 之后），
  落日/黄昏的宽度列表也把 `.hero-scale` 算进去；纸面主题的圆角由
  `--hero-scale-radius` 统一。
- 「缩放设置」直接打开引擎弹窗，不要求进设置页。

#### 新增铁律

- `DESIGN-PHILOSOPHY.md` §2 与本文 §9 第 27 条：**每新增按钮 / 卡片 / 弹窗 / 下拉，
  必须一次适配 14 套主题**；禁止系统原生 select 弹层、消息框、文件框；至少在一套深色
  和一套纸面主题上检查文字对比度。本轮顺带修了浅色主题上快捷键数值（黄色 on 浅灰）
  不可读的问题：数值改为继承行文字颜色。

### 0.4b 1.12.0：Steam 封面取原图

症状：Steam 里显示正常的封面，导入后糊成一团。

查到的两层原因（都在本机 game 3469850 上验证）：

1. **取错了文件。** Steam 把美术资源放在
   `appcache\librarycache\<appid>\<hash>\` 里，文件名带语言后缀
   （`library_hero_schinese.jpg`），旧的平铺路径
   `librarycache\<appid>\library_hero.jpg` 根本不存在。旧代码找不到就退回
   「目录里任意 `*.jpg`」，拿到的是 32×32 的图标，再放大到 1920×1080。
2. **导入时被裁+放大。** 即使取到原图（1920×620），`ImportImage` 也会先裁成
   16:9（1102×620）再拉到 1920×1080，等于凭空放大 1.74 倍。

修法：

- `GameScanner.FindSteamCachedImage` 改为**按分辨率挑**：在 appid 目录下递归找
  `library_hero*` / `library_header*`，排除 `blur` 与 `logo` 变体，取像素面积最大的，
  小于 64×64 的一律当作没找到。多个 Steam 库目录都会扫。
- `MediaService.ImportImage` 的 hero 改为**保留原始宽高比、只降不升**
  （`FitHero`）：长边超过 1920 才缩放，否则原样存；JPEG 质量 88 → 92。
  cover 仍然是 16:9 800×450（网格卡片需要）。
  所有显示 hero 的层都是 `object-fit: cover`，所以不裁也不会变形。
- 新增 `refreshArtwork` 桥方法 + 详情页「用 Steam 最新封面重新导入」按钮，
  给库里已有条目一次性升级；只处理有 `SteamAppId` 的条目。
- 本机实测：22 个 Steam 条目全部刷新为 1920×620（其中 70420 的缓存只有 1024×550，
  原样保留而非放大）；4 个非 Steam 条目跳过。

顺带修的对比度问题：endfield 的管理面板卡片是纸白底，`.manage-stat` 的文字却用
浅色主题的白字，几乎看不见。补了 `--ef-ink` / `--ef-ink-2` 覆盖。

### 0.5b 1.11.2：去重缩放方式、开机全屏、徽章可读性

#### 删掉设置里的「全屏缩放方式」

它和引擎弹窗里的设置重复。现在只有一处：**缩放引擎弹窗 → 全屏缩放方式**
（自动 / 仅无边框 / 关闭）。设置页只保留快捷键和引擎开关，不再有一个孤立的下拉。

- `settingsScaling` 元素与 `changeScalingEngine()` 移除；改为
  `applyScalingEngineMode(value)`，在弹窗保存时调用，仍会处理
  「切到 native 要先关掉持有热键的 Magpie」。

#### 开机后无边框全屏

- 新设置 `PlayerSettings.StartupFullscreen`。
- 设置 → 启动与关闭 → **开机后无边框全屏启动**（紧跟「开机时自动启动」）。
- 开机启动项写成 `"<exe>" --startup`；只有带 `--startup` 参数且开关打开时才在
  `ApplyStartupFullscreen()` 里 `SetFullscreen(true)`。手动打开仍回到上次的窗口几何，
  不会被强制全屏。
- 关掉「开机时自动启动」时，全屏开关的值会保留（下次再开就生效），但不会做任何事。

#### 铁律：徽章文字不能用 accent

右上角玩家菜单的「GUGUOVA 默认」在 summer / zerohour 上变成黄字压白/黑底，几乎看不见。
`row-value` 原本直接用 `var(--accent)` 当文字色——违反「文字必须有对比度」。

- 改成继承行文字颜色 + 8% 同色底 + 18% 同色描边的小胶囊，`opacity .78`
  （hover/focus 提到 1）。每个主题已有的「行文字 / 行底」对比因此自动生效。
- 实测 summer：`rgb(23,52,90)` on 8% 墨色胶囊，清晰。

### 0.6 1.11.1：改名、开机自启、引擎弹窗换肤

#### 改名

「程序名还是 NOVA」有漏网的地方，本轮把**用户看得见的名字**全部改成 GUGUOVA：

| 位置 | 改动 |
| --- | --- |
| 可执行文件 | `NovaGameSpace.exe` → `GUGUOVA.exe`；legacy 的 `NovaGameSpace-Legacy.exe` → `GUGUOVA.exe` |
| 窗口标题 / 托盘 | `NOVA · 游戏空间` → `GUGUOVA · 游戏空间`；托盘菜单「显示 NOVA」→「显示 GUGUOVA」 |
| 启动脚本 | `launch.cmd` 里的 exe 名、`.NET 4.8` 与 WebView2 提示文案 |
| 单实例互斥 / 激活事件 | `Local\NOVA.GameSpace.*` → `Local\GUGUOVA.GameSpace.*` |
| 数据包 / CSV / 自动备份 | `NOVA-*.nova-pack`、`NOVA-playtime-*.csv`、`NOVA-auto-*` → `GUGUOVA-*`；`我的文档\NOVA Backups` → `GUGUOVA Backups` |
| 界面文案 | 选数据包标题、「NOVA 只负责把游戏窗口交给它」、内置主题 author |

**不改的**：数据目录 `%LOCALAPPDATA%\NOVA Game Space`、环境变量 `NOVA_*`、
主题 id `nova`、程序集命名空间 `NovaGameSpace`、项目文件名。这些是兼容标识，
改了会读不到旧库、也会让主题 id 断链（§9 第 21 条）。旧备份文件名不再扫描，
但 `backups\` 里已有的文件不会被删除。

#### 开机自启

- 新文件 `Services/StartupService.cs`：写
  `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` 的 `GUGUOVA` 值，
  指向当前 exe（带引号，兼容带空格的路径）。不需要提权，也不是计划任务。
- 设置 → 启动与关闭 → **开机时自动启动**，状态来自注册表本身；
  路径变了会显示「路径已变化 · 点一次可重新登记」。
- 启动时 `RefreshIfEnabled()` 只在玩家已开启时把路径重新指到当前 exe，
  没开启就什么都不做。
- 关闭开关会删掉整个值，不留空壳。

#### 引擎弹窗换肤

- `.engine-shell` 改成读 `--sheet-*` 令牌（surface / ink / muted / line / well /
  radius / shadow / on-accent），默认是深色对话框外观。
- 14 套主题各有一组覆盖：纸面主题（summer / riso / riot / broadcast / grimoire /
  endfield / dusk / mnemo）用纸底墨字 + 各自的直角或圆角与硬阴影；
  深色主题（aurum / codex / steam / nightflight / zerohour）用各自的面板色与 accent。
- 实测：codex 棕金、steam 炭黑控制台 3px、summer 纸白深蓝 8px、dusk 羊皮纸墨字 3px、
  endfield 纯白直角 + 6px 硬阴影。
- 算法列表的底部渐隐只在真的可滚动时出现（`is-scrollable`），
  列表高度上限 `min(320px, 38vh)`，7 个模式不用滚也能看全。

### 0.8 下一轮仍要做

- **真实 Steam 游戏全流程**：本机验证时 Steam 重启后停在登录界面，没有完成一次真实的
  「登录 → 启动 → 计时 → 退出」；下一轮登录后跑一遍（普通游戏与 SteamStub 各一款）。
- Magpie 的 **profile autoScale** 没有接入：目前只按快捷键单次缩放；如果玩家改了快捷键
  （非 Alt+Shift+A），配置读取会跟着变，但 Magpie 未运行时仍走无边框。
- Win7 真机 / 物理手柄 / 14 套主题回归 / 音频听感 / 打包体积，沿用 1.9.0 的清单。
- README 的详情页 / 设置截图仍是 1.9.0 的，没有「全屏缩放」开关、Steam 权限卡片和外观取景按钮；
  下一轮用隔离演示库（§7b）重拍，不要拿本机真实库当素材。
- 如果玩家手动把 Steam 再设成管理员，启动器会在下次 Steam 启动时再次提示修复。

---

## 0b. 1.9.0 主题重做（历史）

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

应用 **1.10.1**，共 **14 套主题**（nova + 13 套）。1.9.0 的三套重做主题
（dusk / steam / nightflight）已完成构图、开屏、切换、进游戏、音效与细节层；
1.10.0 补上启动体验：Steam 提权弹窗可一键修复、游戏窗口先置前再收起启动器、
每款游戏可选全屏缩放（Magpie 优先，无边框兜底）；
1.10.1 在外观预览里加了主视觉取景编辑（方向条/拖动/缩放/复位，按游戏记忆）；
1.11.0 把缩放引擎随包内置、启动游戏时自动拉起并隐藏，快捷键可在启动器里录制，
并加了符合主题的简化引擎设置弹窗与 `.nova-select` 下拉。
本轮没有改主题视觉，但新增了「所有新控件必须适配 14 套主题」的铁律。

---

## 2. 先读什么

0. **本文 §0** —— 1.10.0 的启动体验（提权 / 置前 / 全屏缩放）与实测记录。
1. **`docs/GAME-DISPLAY.md`** —— 启动后的画面接管时序、窗口选择、Magpie 快捷键编码。
2. **`docs/STEAM-LAUNCH.md`** §3.2 —— 新的 `steam.exe -applaunch` 链路与提权修复。
3. `docs/themes/dusk.md` / `steam.md` / `nightflight.md` —— 三套重做主题的当前接口与构图。
4. **`docs/DESIGN-PHILOSOPHY.md`** —— 六条硬规则、14 套主题卡；§5.12 / §5.13 / §5.14 是 1.9.0 三套。
5. `docs/THEME-INTERFACES.md` —— 选择器、开屏、幕布、字体契约；§12 新增「禁止模糊」。
6. `docs/SFX-MAP.md` §4 —— genny 三套音效配方与检查门槛。
7. `docs/HANDOFF-THEMES.md` §0.00 —— 主题层的精修方法（配色占比、量测脚本）。
8. 本文 §4–§7 是 1.8.0 的历史判断，保留作对照，不是当前待办。

---

## 3. 版本基线

应用：**1.12.0**（`version.json` 是唯一版本源）；品牌：**GUGUOVA**；
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

1.10.0 的新前置：设置 → 系统与兼容性应显示 **普通权限**；如果显示「需要修复」，
先点「修复提权弹窗」。修复重启后 Steam 可能需要重新登录，登录后再跑启动链。

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
21. 技术标识（程序集、AppData、`NOVA_DEV`/`NOVA_CACHE_ROOT`、主题 id `nova`）不跟随品牌改名；
22. **启动器必须等游戏窗口出现并置前后才最小化**；先最小化会丢失 `AllowSetForegroundWindow` 授权；
22b. **用户可见的名字一律 GUGUOVA**：exe、窗口标题、托盘、启动脚本、导出文件名；
    兼容标识（`%LOCALAPPDATA%\NOVA Game Space`、`NOVA_*` 环境变量、主题 id `nova`、
    命名空间 `NovaGameSpace`）不得改，改了会读不到旧数据、主题断链；
23. **Steam 启动走 `steam.exe -applaunch`，不要回到 `steam://`**；提权修复只删 `RUNASADMIN`，
    改之前必须备份原值，且不能替玩家改回其它兼容性标记；
24. **Magpie 快捷键按位域解码**（`key | win<<8 | ctrl<<9 | alt<<10 | shift<<11`，默认 3137 = Alt+Shift+A）；
    NOVA 可以随包分发未修改的 Magpie 并自动启动，但必须保持独立进程、附 GPLv3 许可与
    源码说明；失败必须回退无边框全屏；
25. 全屏缩放**永远先看游戏自己的选择**，未选择时才跟随沉浸式全屏；`scalingEngine=off` 时不得偷偷缩放；
26. 外观取景编辑**只写 `heroPosition` / `heroZoom`**，按游戏记忆；不要另起一套字段，也不要把预览改成 contain；
27. **首页启动区块顺序固定**：标题 → 类型 → 主按钮排（开始游戏 / 详情 / 缩放设置）→
    全屏缩放开关 → 进度；任何主题重排 `hero-inner` 都必须把 `.hero-scale` 一起写进
    order / 宽度规则，不得拆散；
28. **新增按钮 / 卡片 / 弹窗 / 下拉必须同步适配 14 套主题**；
    弹窗表面用 `--sheet-*` 令牌，纸面主题不得出现深色方块；禁止系统原生 `select` 弹层、
    消息框、文件框（白底列表直接违规）；深色主题用浅字、纸面主题用墨字，新控件必须在
    一套深色和一套纸面主题上检查可读性。下拉统一用 `.nova-select`，引擎/设置类弹窗用
    统一深色对话框表面 + 主题 accent。

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
- **修复 Steam 提权会重启一次客户端**：本机实测重启后停在登录界面（ActiveUser=0），
  对话框已写明「可能需要重新登录」。不要为了免登录而保留管理员权限运行。
- **全屏缩放只对窗口化游戏有效**：独占全屏的窗口已经是全屏，NOVA 不会动它；
  无边框拉伸会改变宽高比，保比例/超分要靠 Magpie。
- **Magpie 必须已经在运行**才会走 `auto` 的 Magpie 分支；没有接入 profile `autoScale`，
  Magpie 没运行时一律用无边框兜底。
- **Store 版应用的转发 exe**（例如 Windows 11 的 `notepad.exe`、`calc.exe`）会在启动后
  把窗口交给另一个进程并自己退出，NOVA 只能记录那个转发进程；这类条目不适合用来验证置前。
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
