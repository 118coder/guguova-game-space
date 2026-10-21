# Steam 启动与认证：NOVA 的做法与边界

> 版本：1.6.0
> 适用：Steam 库导入的游戏在 NOVA 里点「开始游戏」之后的启动链路
> 相关代码：`Services/SteamService.cs`、`Services/LauncherService.cs`、
> `NativeBridge.cs`（`steamStatus` / `launchMode`）、`src/app.js`（管理面板）

---

## 1. 问题是什么

NOVA 扫描 Steam 库时记录的是游戏主程序路径，早期直接 `Process.Start` 它。
这在本机 16 款 Steam 游戏里有一半会失败，原因是 **Steam 的认证不在 exe 里，而在客户端里**：

| 形态 | 数量（本机抽样） | 直接启动的结果 |
| --- | --- | --- |
| 导入 `steam_api64.dll` / `steam_api.dll` | 4 | 卡在 `SteamAPI_Init`，或弹「Steam 未运行」后退出 |
| 带 SteamStub 外壳（`.bind` 段） | 1 | 解密失败，直接闪退 |
| 运行期动态加载 `steam_api.dll`（RPG Maker 等） | 2 | 视版本而定，常见「未运行」提示 |
| 无 Steam 依赖 | 9 | 正常 |

关键点：**SteamStub 的 exe 是加壳的**，壳在入口点先向 `steam.exe` 要解密密钥，
拿不到就退出。这不是 NOVA 能绕过的判断，也不应该绕过——它是正版校验的一部分。

---

## 2. Steam++ / Watt Toolkit 实际在做什么

核对本机 `%LOCALAPPDATA%\Steam++\Plugins` 后可以确认，它的插件是：

- `Accelerator`：hosts/代理加速（`ProxyMode: "Hosts"`），解决商店与社区连不上；
- `SteamIdleCard`：挂着「正在游戏」刷卡片时长；
- `GameList`：读取 Steam 库并展示，**启动时仍是交给 Steam 客户端**；
- `ArchiSteamFarmPlus` / `Authenticator`：账号与令牌管理。

也就是说，**Steam++ 没有实现「脱离 Steam 打开游戏」**。它做的是「让 Steam 连得上、让游戏按 Steam 的方式启动」。
本机 `%APPDATA%\Goldberg SteamEmu Saves` 是另一类工具（Goldberg 模拟器）留下的，
那才是脱离客户端的路线，代价是替换 `steam_api.dll`、放弃成就与云存档、且属于破解手段。

NOVA 走的是前一条路线：**不再直接启动 exe，而是让 Steam 客户端去启动它**。

---

## 3. 现在的实现

### 3.1 四种启动方式

`GameEntry.LaunchMode` 取值 `auto` / `steam` / `platform` / `direct`，默认 `auto`。
解析统一走 `Services/LaunchModes.cs` 的 `GameLaunch.ModeFor()`（1.15.0 起），
`SteamService.ModeFor()` 只是它的转发。

| 取值 | 行为 |
| --- | --- |
| `auto` | 有 `SteamAppId` 走 Steam；有 `LaunchUri` 走该平台协议；否则直接启动进程 |
| `steam` | 一律 `steam://rungameid/<appid>`，由客户端负责认证、覆盖层、云存档 |
| `platform` | 一律走平台协议：`com.epicgames.launcher://…` / `uplay://launch/<id>/0` / `shell:AppsFolder\<PFN>!App` / `battlenet://<code>` |
| `direct` | 一律直接启动 exe，用于确认不需要客户端的游戏 |

管理面板可随时切换，写入 `library.json` 的 `launchMode`。GOG 与 EA app 的条目
`LaunchUri` 为空，`auto` 直接解析为 `direct`：这两家的游戏不需要客户端代启。

平台启动与 Steam 启动共用同一套「等到进程出现才记账」的观察器
（`LauncherService.WatchClientLaunch`），因此 Epic / Ubisoft / Xbox 的
首次登录、更新中都不会被误记成一次失败启动。

### 3.2 启动链路

```
UI 点开始
  → LaunchGame → LauncherService.Launch
  → ModeFor(game) == "steam"
  → 后台线程 Process.Start(steam.exe, "-applaunch <appid>")   ← 不占 UI 线程
  → 立即返回 { ok, pending: true }
  → 后台 watcher 每 1.5s 找游戏进程（先按 exe 全路径；读不到 MainModule 时按进程名 + 启动时间）
  → 找到 → AttachProcess → 触发 session-started → 开始计时
  → GameDisplay 找游戏窗口 → 置前 → 可选全屏缩放 → session-presented → 遮罩关闭
  → 启动器最小化（设置开启时），最后一个会话退出后恢复
  → 超时 → 触发 session-failed → 遮罩显示原因
```

#### 为什么不用 `steam://`

`steam://` 会经过 shell 协议处理器。如果 `steam.exe` 上有
`HKCU\Software\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers` 的
`RUNASADMIN` 标记（「以管理员身份运行」），协议处理器就会起一个提权的
`steam.exe` 助手，于是**每打开一次游戏弹一次 UAC**。直接 `CreateProcess`
绕开这条路径；标记还在时返回 `ERROR_ELEVATION_REQUIRED (740)`，NOVA 把
「请先修复 Steam 提权设置」交给 UI，而不是弹系统窗口。

#### 提权修复（1.10.0）

`Services/SteamPrivilege.cs` 读 Layers 里 steam.exe 的值，只删 `RUNASADMIN`，
保留 `HIGHDPIAWARE` 等其它标记，原值备份到
`%LOCALAPPDATA%\NOVA Game Space\backups\steam-privilege-*.json`。
删除后必须重启一次 Steam 才生效（进程不能自己降低完整性级别）：
`steam.exe -shutdown` → 等进程退出 → 用普通权限重新启动。
本机实测重启后 Steam 可能停在登录界面，UI 会提示「可能需要重新登录」。

前端在 Steam 游戏启动前调用 `steamPrivilege`；`needsFix` 时弹应用内对话框
（修复并重启 / 先这样启动 / 取消），同一个会话里「先这样」不会再问。
设置 → 系统与兼容性也有同样入口。

三个设计点都是实测踩出来的：

1. **协议唤起必须离开 UI 线程**。`steam://` 冷启动客户端时 `ShellExecute` 会等 COM 返回，
   在 UI 线程上调用会让整个 bridge 无响应（实测卡到 60s 前端超时）。现在唤起在后台线程，
   IPC 往返 856ms 就返回，随后 `steamStatus` 5ms 内响应。
2. **不能假设进程已存在**。客户端要登录、要更新，游戏可能几分钟后才出现。
   所以返回 `pending`，会话推迟到进程真的出现时登记，否则会把「等待」记成一次 0 秒游玩。
3. **超时窗口按客户端状态给**。已在运行给 2 分钟，需要冷启动并登录给 6 分钟。

### 3.3 诊断（PE 级，不靠猜）

`SteamService.InspectExe` 直接解析 PE：读导入表看是否链接 `steam_api*`，
看节名是否有 `.bind`（SteamStub），再看目录里是否带 `steam_appid.txt` 与 `steam_api*.dll`。
结果在管理面板显示为一句结论，例如：

- 「带 SteamStub 外壳：必须由 Steam 客户端启动，直接运行会报错或闪退。」
- 「依赖 Steam 运行时：需要已登录的 Steam 客户端，否则会卡在初始化或提示未运行。」
- 「自带 steam_appid.txt：客户端未运行时多数情况仍可进入，但成就与云存档不可用。」
- 「未检测到 Steam 运行时依赖：可以直接启动。」

`steam_appid.txt` + `steam_api` 的组合要单独判：这类游戏通常能脱离客户端进单人模式，
所以比纯 `steam_api` 的判断宽松一档。

### 3.4 客户端状态

`SteamService.Detect` 读注册表，不枚举进程：

- `HKCU\Software\Valve\Steam` → `SteamPath`（安装位置）
- `HKCU\Software\Valve\Steam\ActiveProcess` → `pid`、`ActiveUser`（运行中 / 已登录）

客户端退出时会把 `pid` 归零，所以这个键本身就回答了「在不在运行」，
比 `Process.GetProcesses` 快且不会在 UI 线程上拖住。结果缓存 4 秒。

---

## 4. 能做什么，不能做什么

**能：** 让依赖 Steam 运行时的游戏在 NOVA 里正常启动；客户端没开时顺手唤起并在登录后继续；
把「为什么打不开」说清楚；让玩家自己决定哪些游戏走客户端、哪些直连；
检测并修复玩家（或某篇教程）给 `steam.exe` 设的 `RUNASADMIN` 兼容性标记，
让「每次启动都弹 UAC」变成一次修复、以后不再弹。

**不能：** 在没有 Steam 客户端的情况下运行 SteamStub 或依赖 `steam_api` 的游戏。
那需要替换 `steam_api.dll` 的模拟器（Goldberg 一类），属于绕过正版校验，
NOVA 不提供；这类 exe 就算硬启动，壳也会拒绝解密。

**也不做：** 替玩家登录、保存账号密码、读取 `loginusers.vdf` 的令牌。
NOVA 只读公开的安装路径与运行状态，与「不登录、不联网」的约定一致。

---

## 5. 验证记录

在 1439×1124、Steam 客户端已登录的实机上：

| 步骤 | 结果 |
| --- | --- |
| `steamStatus`（无游戏） | `installed=true, running=true, signedIn=true` |
| `steamStatus`（噩梦摇篮） | `usesSteamApi=true, requiresClient=true`，文案准确 |
| 沉睡的法则 | `hasAppIdFile=true`，提示「自带 steam_appid.txt」 |
| 点「开始游戏」 | 遮罩显示「等待 Steam…」/「交给 Steam」，`pending=true` |
| 唤起时 IPC 耗时 | 856ms（修复前会阻塞到 60s 超时） |
| 唤起后 UI 响应 | `steamStatus` 5ms 返回 |
| 切换 `direct` → `auto` | 面板即时更新，`library.json` 落盘正确 |
| 取消等待 | `stop` 返回 `ok`，待启动状态清除 |
| 管理面板布局 | 宽度 512，文案无溢出，页面无横向滚动 |
