# 游戏画面接管：置前、最小化与全屏缩放

> 版本：1.10.0
> 相关代码：`Services/GameDisplay.cs`、`NativeBridge.cs`（`PresentGameWindow`）、
> `MainWindow.xaml.cs`（`BeginGameSession` / `MinimizeForGame` / `EndGameSession`）、
> `src/app.js`（`session-presented`、详情页开关）

---

## 1. 一次启动的时间线

```
LauncherService.Launch
  ├─ 直接启动：Process.Start(exe) → AllowSetForegroundWindow(pid)
  └─ Steam：steam.exe -applaunch <id> → watcher 找到进程 → AllowSetForegroundWindow(pid)

GameStarted
  ├─ NativeBridge.Notify("session-started")        前端显示「运行中」
  ├─ MainWindow.BeginGameSession()                 Topmost=false，但仍在前台
  └─ Task.Run(PresentGameWindow)
        ├─ GameDisplay.Present(pid, scale, engine, magpiePath, 15s)
        │    ├─ 轮询 FindMainWindow(pid)
        │    ├─ BringToFront(hwnd)
        │    ├─ 可选：Magpie 或原生无边框
        │    └─ 返回 Result
        ├─ MainWindow.MinimizeForGame()            窗口出现之后才最小化
        └─ Notify("session-presented")

前端收到 session-presented
  ├─ 关闭沉浸式启动遮罩
  └─ 缩放失败时留一条通知

GameExited（最后一个会话）
  └─ MainWindow.EndGameSession()                   恢复窗口、全屏几何与 Topmost
```

**顺序不能换。** 先最小化会让 `AllowSetForegroundWindow` 的授权失效，
游戏窗口出现时只能待在启动器后面——这正是 1.9.0 的用户投诉。

---

## 2. 找哪一个窗口

`FindMainWindow(pid)` 遍历该进程的顶层窗口，排除：

- 不可见窗口；
- `WS_EX_TOOLWINDOW` / `WS_EX_NOACTIVATE`；
- 小于 240×160 的窗口。

在剩下的窗口里取面积最大的；如果没有可见窗口，退而取最大的最小化窗口。
之后用 `GetWindowThreadProcessId` 再确认一次窗口确实属于游戏进程。

前台判定用 `ForegroundBelongsTo(window)`：前台窗口属于同一进程就算成功，
因为很多游戏把画面放在一个 owned 弹窗里，而不是我们挑中的那个 HWND。

---

## 3. 置前的三级手段

1. `SetForegroundWindow` + `BringWindowToTop`，重试 6 次（每次 120 ms）；
2. 仍失败：`AttachThreadInput` 附加到当前前台窗口的输入队列，再置前 + `SetFocus`，
   完成后立即分离（不长期共享输入）；
3. 仍失败：`SwitchToThisWindow(hwnd, true)`。

启动器在整个等待期间保持前台，这就是 Windows 允许我们转交前台的前提。

---

## 4. 原生无边框全屏

`ApplyBorderless(pid, hwnd)`：

- 取窗口所在显示器（`MonitorFromWindow(..., MONITOR_DEFAULTTONEAREST)`）；
- 如果窗口没有标题栏且已经覆盖显示器：视为已经是全屏，直接返回成功，
  **不改样式**（避免让独占全屏游戏重建 D3D 设备）；
- 否则去掉 `WS_CAPTION | WS_THICKFRAME | WS_MINIMIZEBOX | WS_MAXIMIZEBOX | WS_SYSMENU`，
  加上 `WS_POPUP`，`SetWindowPos` 到显示器物理像素矩形；
- 450 ms 后复查一次；有些引擎启动时会重建窗口并恢复边框，此时再应用一遍；
- 仍然失败则返回 false，前端记一条「缩放没有生效」。

NOVA 的清单是 Per-Monitor V2，所以这里拿到的坐标和 `SetWindowPos` 使用的都是物理像素。
副作用：窗口会被拉到显示器的宽高比，4:3 游戏在 16:9 上会被拉伸；
想要保比例/超分质量时用 Magpie。

---

## 5. Magpie 协作

1.11.0 起把**未修改的 Magpie 0.12.1 官方发行版**放在 `engine/magpie/` 随包分发，
仍然是独立进程：NOVA 只启动它、隐藏它的窗口、写它的配置、发它的快捷键，不链接它的代码。
许可见 `third_party/magpie/NOTICE.md`；源码提供说明见 `SOURCE-OFFER.txt`。

### 5.1 检测

顺序：

1. 设置里的 `magpiePath`；
2. 运行中的 `Magpie` 进程的 `MainModule`；
3. 卸载表（HKCU/HKLM + WOW6432Node）里 `DisplayName` 含 Magpie 的
   `DisplayIcon` / `InstallLocation`；
4. `%LOCALAPPDATA%\Magpie\Magpie.exe`、`%LOCALAPPDATA%\Programs\Magpie\Magpie.exe`、
   `Program Files` / `Program Files (x86)`。

结果缓存 60 秒。`magpieStatus` 返回 `available / exePath / running / hotkey / note`。

### 5.2 快捷键编码

Magpie 把快捷键存在 `%LOCALAPPDATA%\Magpie\config\v*\config.json` 的 `shortcuts.scale`，
编码是：

```
value = key | (win ? 0x100 : 0) | (ctrl ? 0x200 : 0) | (alt ? 0x400 : 0) | (shift ? 0x800 : 0)
```

**3137 = 0x0C41 = Alt+Shift+A**（Magpie 默认），不是 Win+Shift+A。
1.10.0 第一版按 Win+Shift 解码，Magpie 完全不响应；改为按上面的位域解码后通过。

### 5.3 触发与验证

```
确保游戏窗口在前台
  → keybd_event 按下修饰键 → 按 A → 松开 → 松开修饰键
  → 最多等 6 秒
  → FindWindow("Window_Magpie_967EB565-6F73-4E94-AE53-00CC42592A22")
  → GetProp(scalingWindow, "Magpie.SrcHWND") == 游戏 HWND ?
       是：engine=magpie, scaled=true
       否：回退原生无边框，并在 session-presented 里带 error
```

Magpie 默认有 3 秒倒计时，所以 6 秒窗口足够。

### 5.4 边界

- **自动启动内置引擎**：设置里 `autoStartEngine` 默认关；玩家在引擎设置里打开后，
  需要缩放时 `ScalingEngine.EnsureRunning` 才启动 `engine/magpie/Magpie.exe`，
  主窗口出现后发 `WM_CLOSE` 收进托盘（`showNotifyIcon=false` 时最小化）。
  默认关闭是为了不在后台偷偷拉起引擎；设置里的「启动引擎 / 重启引擎」始终是手动入口。
- **轻量包**：`python tools/fetch-magpie.py --lite` 只保留 Lanczos / Nearest / FSR /
  FSRCNNX / CAS / Sharpen 等常用效果（约 14 MB）；引擎设置弹窗会把缺少效果的模式置灰。
  默认包保留全部 effects（26 MB），因为现有配置用到 Anime4K / CRT / CuNNy。
- **快捷键与简化 UI**：见 §6。
- 玩家改了快捷键：读取配置，跟随。
- Magpie 未运行 / 启动失败 / 版本不兼容：静默回退无边框。
- 没有接入 profile 的 `autoScale`（需要写 Magpie 的配置文件并重启它），
  目前是「每次启动按一次快捷键」。

---

## 6. 设置与数据

| 字段 | 位置 | 默认 | 说明 |
| --- | --- | --- | --- |
| `fullscreenScale` | `GameEntry`（可空 bool） | null | null 跟随启动器；true/false 为玩家显式选择 |
| `minimizeOnLaunch` | `PlayerSettings` | true | 游戏窗口出现后最小化启动器 |
| `scalingEngine` | `PlayerSettings` | `auto` | `auto` / `native` / `off` |
| `magpiePath` | `PlayerSettings`（可空） | null | 便携版 Magpie 的手动路径 |

解析规则（前后端一致）：

```
全屏缩放 = 游戏显式值
        ?? 启动器当前处于沉浸式全屏
```

启动器里禁用 `scalingEngine=off` 时，详情页开关置灰，native 侧也强制关闭。

---

## 7. 日志与排查

`nova.log` 里的关键行：

```
present pid=1234 hwnd=0xABC foreground=True scale=True engine=magpie scaled=True
present pid=1234 hwnd=0xABC foreground=False scale=True engine=native scaled=True
present pid=1234 ... engine=none ... 没有等到游戏窗口
```

- `foreground=False` 但 `scaled=True`：窗口铺满了，但没有拿到前台，检查是不是有别的
  程序（输入法、录屏、启动器更新）抢了焦点。
- `没有等到游戏窗口`：15 秒内没有可见顶层窗口。Store 版应用的转发 exe
  （例如 Windows 11 的 notepad.exe）会启动另一个进程后自己退出，不属于游戏窗口流程能接管的范围。
- `engine=magpie` 但画面没变化：Magpie 可能弹了自己的错误窗/倒计时；
  看 Magpie 目录下的 `logs/magpie.log`。

---

## 8. 验证记录（2026-10-21，2560×1440）

| 场景 | 结果 |
| --- | --- |
| 原生无边框（charmap / mstsc） | `0,0 2560×1440`，`caption=false`，`foreground=true` |
| 启动器退场 | 游戏窗口置前后 `IsIconic=true`；退出后 `false` |
| Magpie（charmap） | `engine=magpie`，`Magpie.SrcHWND` 与游戏 HWND 相同 |
| 沉浸式默认 | 全屏时详情页开关自动勾选，提示「沉浸模式下默认开启」 |
| 窗口模式默认 | 不勾选，提示「全屏显示时默认开启」 |
| 启动遮罩 | `session-presented` 后自动关闭，恢复窗口时不再出现 |
