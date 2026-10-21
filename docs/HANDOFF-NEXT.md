# GUGUOVA 下一轮交接文档

> 交接版本：**1.15.0**
> 交接时间：2026-10-21
> 分支：`main`，工作区**有未提交改动**（本轮全部改动）
> 上一版：1.14.4（流水线式发布，`6652f09` / `bb296d2`）
> 发行：本轮**未打包发布**，只做代码、验证与文档
> 仓库：`https://github.com/118coder/guguova-game-space`

---

## 0. 一句话状态

应用 **1.15.0**，14 套主题。**入库不再是 Steam 专属**：Steam / Epic / GOG /
Ubisoft / EA / Xbox（PC Game Pass）/ 战网 七家统一扫描、分组勾选、一次写入；
首次启动会问一次要不要自动入库；点「添加游戏」先选「自动扫描」还是「手动添加」。
入库窗口长在 `.engine-shell` 的 `--sheet-*` 材质上，14 套主题各自成立。

静态对比度（14 主题 × 18 界面，含新增 `import`）与悬停/聚焦对比度（14 × 4）
都是 **0 失败**。**没有真机验证的部分**：Epic / Ubisoft / EA / Xbox / 战网的
真实安装在**本机不存在**，只验证了 GOG（本机有 1 款）与 Steam（24 个清单）。

### 先读什么

1. 本文 §2–§6 —— 本轮改了什么、平台怎么识别、现在什么状态；
2. `docs/THEME-DESIGN-SPEC.md` §5.5 —— **入库窗口 `.import-shell` 的控件契约**；
3. `docs/STEAM-LAUNCH.md` §3.1 —— 四种启动方式（`auto` / `steam` / `platform` / `direct`）；
4. `tools/headless-shots.js` —— 改完样式后一条命令导出 280 张截图（§2.5）；
4. `docs/LAUNCHER-FEATURES.md` §2.1 —— 多平台入库能力表；
5. `.agents/skills/guguova-theme-design/SKILL.md` —— 改主题时照着执行。

---

## 1. 版本与工作区

| 项 | 值 |
| --- | --- |
| 应用版本 | **1.15.0**（`version.json` 是唯一版本源，`tools/bump-version.js` 同步 csproj / index.html） |
| 资源版本 | `src/index.html` 全部 `?v=1.15.0` |
| 主题数 | 14（`nova` 内置 + 13 个文件夹） |
| 主题版本变动 | 只有 `endfield` 1.0.14 → **1.0.15**（修 keycap 1:1） |
| 打包产物 | 未重新打包；`dist/` 里仍是 1.14.4 的 exe/zip |
| QA 数据根 | `D:/tmp/guguova-import`（`NOVA_DATA_ROOT`，空库 + 已置 `firstRunDone`） |

---

## 2. 本轮做的四件事

### 2.1 多平台入库（Steam 之外 6 家）

新增 `Services/PlatformScanner.cs`，只读地读取每家启动器的已安装记录：

| 平台 | 识别方式 | 启动方式 |
| --- | --- | --- |
| Steam | `appmanifest_*.acf` + `libraryfolders.vdf`（沿用 `GameScanner`） | `steam.exe -applaunch` |
| Epic Games | `%ProgramData%\Epic\EpicGamesLauncher\Data\Manifests\*.item` | `com.epicgames.launcher://apps/<ns>%3A<item>%3A<app>?action=launch&silent=true` |
| GOG | `HKLM/HKCU\SOFTWARE\GOG.com\Games\<id>`（`gameName`/`path`/`exe`） | 直接跑 exe（DRM-free） |
| Ubisoft Connect | `SOFTWARE\Ubisoft\Launcher\Installs\<id>` → `InstallDir` | `uplay://launch/<id>/0` |
| EA app | `SOFTWARE\Electronic Arts\EA Games\<title>` → `Install Dir` | 直接跑 exe（EA app 由游戏自己拉起） |
| Xbox / PC Game Pass | `<盘>:\XboxGames\<Title>\Content\AppxManifest.xml` | `explorer.exe shell:AppsFolder\<PFN>!<App>` |
| 战网 | `SOFTWARE\Blizzard Entertainment\<Title>` → `InstallLocation` | `battlenet://<code>`（已知标题），否则直接跑 exe |

要点：

- **注册表按 64/32 位双视图读**：路径写 `SOFTWARE\...`，不写 `WOW6432Node`，
  让 `RegistryView` 自己选，HKCU/HKLM 都试一遍。
- **Xbox 的 AUMID 要 PackageFamilyName**，而 publisher hash 不在清单里：
  去 `AppModel\Repository\Packages` 按 `PackageID` 反查 `PackageFamilyName`，
  查不到才退回 `<Identity>!<App>`（有些标题能生效）。
- **exe 解析**：清单给相对路径就拼装并校验；失效则退回
  `GameScanner.FindMainExecutable`（按名字相似度 + 目录深度打分）。
- **封面**：只有 Steam 有本地封面缓存；其余平台不下载、不缓存，交给
  `CoverAnalyzer` 从 exe 图标生成。这是刻意的离线约束。

### 2.2 首次启动问一次

- `PlayerSettings.FirstRunDone` 之前**定义了但从未使用**，本轮启用；
  `boot` payload 新增 `firstRun`。
- 开场仪式结束（或 reduce-motion / safe tier 跳过仪式）后 620ms 打开入库窗口，
  标题是「要把已有的游戏收进来吗？」，副标题给出平台数与条目数，
  三个出口：**开始扫描 / 手动添加 / 稍后再说**。
- 任一出路都会写 `dismissFirstRun`，之后不再打扰；
  点遮罩、按 Esc 也算「稍后」。
- 副标题用「约 N 款」：检测条数按 manifest/注册表计数（便宜），
  真正扫描会丢掉没有 exe 的条目，两者可能差 1–2。

### 2.3 添加游戏先选路

顶栏 `+`、游戏库「添加游戏」、空库主按钮、`rail` 空卡，全部先开入库窗口：

```
+  → 入库窗口 →(自动) 扫描窗口 →(勾选) 导入
              →(手动) 编辑器
```

窗口本身就是选择器：两张卡（`role=radio`）+ 主按钮文案随选择变化
（「开始扫描」/「填写信息」），默认选中有平台的自动扫描，没有平台时选中手动。

### 2.4 扫描窗口按平台分组

- 列表顶部有一条**总开关**：`全选`（勾选框），点一下选中所有可导入行
  （所有平台 + 清单 + 快捷方式），再点一下全部取消；旁边是「已选 X / Y」。
  文案不随状态变化，勾选框本身就是开关；
- `scanLibrary` 返回 `groups: [{ id, label, shortLabel, count, items }]`，
  item 的统一形状是 `{ key: "<platform>:<platformId>", name, detail, exePath, coverUrl, imported }`。
- 分组标题带「全选 N」，列表上方还有一条总开关：**标签永远叫「全选」，勾选框就是
  开关**——点一下全选，再点一下全部取消，右侧「已选 X / Y」实时显示；
  组内标题同样只叫「全选 N」，状态由勾选行与 `aria-pressed` 表达，不出现「取消全选」。
- 已入库的行虚线置灰不可点；来源徽标是纯文字（`STEAM` / `EPIC` / `GOG` /
  `UBISOFT` / `EA` / `XBOX` / `BATTLE.NET`），不使用任何第三方 logo。
- `importCandidates` 改成 `{ keys: [...] }`（`<platform>:<id>`），一次扫描解析整批。

### 2.5 修复：扫描行的封面缩略图（1.15.0 补丁）

用户截图暴露的坏图有两类，根因不同：

1. **`file:///` 被拒**。页面跑在 `https://nova.site` 上，`NativeBridge.FileUrl`
   却把 Steam 缓存封面写成 `file:///D:/…` —— 跨源，WebView2 直接不画，
   于是出现浏览器自带的破图图标。修法：`FileUrl` 现在把文件所在文件夹映射成
   `nova.cacheN` 虚拟主机（`SetVirtualHostNameToFolderMapping`）再拼 URL；
   Steam 的缓存都在 `appcache\librarycache` 下，所以 attach 时先把每个库的
   `librarycache` 根映射好（`GameScanner.CacheRoots()`），`FileUrl` 用最长前缀
   匹配 —— 一个库一个主机，不再按 app 文件夹爆炸式映射。
2. **缓存里本来就没有封面**。这类行现在统一渲染「黑胶唱片」兜底图标：
   `scanRow` 永远先画 `#i-disc`，封面 `<img>` 绝对定位盖在上面，
   `error` 时把自己移除 —— 缓存被清理、库搬家、路径失效都只会退到兜底图标，
   不会再出现破图。

另外：已入库的行优先显示启动器自己存的封面（`nova.media`，必定可加载），
而不是 Steam 缓存里那份可能已失效的图（`CoverUrlFor`）。

实测：63 行扫描，8 张 Steam 缓存封面全部加载（0 broken / 0 pending），
日志只有一条 `file host nova.cache1 -> …\appcache\librarycache`。

### 2.6 无头拟真：一条命令导出全部截图（1.15.0 新增）

以前每轮验证都要起 WPF + WebView2，再用 `export-all.js` 一屏一屏点；WebView2 在
某些会话里还会 `GpuProcessExited`。现在可以完全不启动宿主：

```bash
node tools/headless-shots.js                        # 14 主题 × 7 个核心界面
node tools/headless-shots.js --views=all --workers=4 # 14 × 20 = 280 张，约 3.5 分钟
```

实现：

| 文件 | 作用 |
| --- | --- |
| `tools/lib/headless-host.js` | 本地静态服务器 + `msedge --headless=new` + **页面内应答原生桥**（boot / listThemes / platformSummary / scanLibrary / engineOptions …） |
| `tools/lib/ui-views.js` | 唯一的「点进某个界面」脚本，`export-all.js` 与 `headless-shots.js` 共用 |
| `tools/headless-shots.js` | 并行调度、截图、逐张布局审计、`manifest.json` |

要点：

- **虚构库**：6 款示例游戏（与 `tools/demo-covers.py` 同一套），封面取自
  `../_shots/covers/jpg/`，不含任何真实游戏素材；
- **不碰玩家数据**：没有 `NOVA_DATA_ROOT`，没有 `library.json` 读写；
- **默认关掉 `backdrop-filter`**：软件光栅下那一个属性会让每张图慢 6–15 秒，
  弹窗本身不变，只把遮罩换成更深的纯色（要原样加 `--blur`）；
- 每个 CDP 步骤有 20 秒上限，连续三次超时就放弃该渲染进程，不会整轮卡死；
- 输出结构、`manifest.json` 字段与 `export-all.js` 一致，布局告警同一套判据。

实测：14 主题 × 20 界面 = **280 张 / 212 秒 / 4 个渲染进程**，0 截断 0 横向溢出。

### 2.7 体验补齐包（1.15.0 同轮）

| # | 改动 | 说明 |
| --- | --- | --- |
| 1 | **启动器不再被当游戏** | `GameScanner.ClientExeNames` 黑名单：steam/epic/gog/battle.net/origin/ea/upc/ubisoftconnect/itch 本体 exe 不再出现在快捷方式扫描里 |
| 2 | **扫描窗口搜索框** | `#scannerSearch` 实时过滤所有行（名称+路径）；组内没有可见行就整组隐藏；全选语义不变（作用于全部可导入行） |
| 3 | **客户端未装提示** | `PlatformScanner.ClientInstalled()`（会话内缓存）；组标题出现「客户端未安装」虚线徽标，管理面板状态改为「未检测到 X 客户端」 |
| 4 | **入库回执** | 导入完成弹出主题化 dialog：「已入库 N 款游戏」+ 名称（>8 款截断） |
| 5 | **挂机暂停计时** | `GetLastInputInfo` 看门狗（15s 采样）：输入空闲超过 `IdlePauseMinutes`（默认 10，0=关）即暂停计秒，恢复后从墙钟里扣除；设置页新增开关；退出结算用 `EffectiveSeconds` |
| 6 | **拖拽入库** | 拖 exe/.lnk/文件夹到窗口 → 编辑器预填；WPF `AllowDrop` 拿路径（页面拿不到），`resolveDrop` 规范化（目录挑主程序、拒绝启动器本体），`drop-import` 消息进前端；**真实拖拽手感需实机确认** |
| 7 | **托盘快速启动** | 托盘右键列出最近游玩 5 款（可启动的），点击直接启动，失败弹回主窗并 toast |
| 8 | **详情最近记录** | payload 带最近 5 条 `PlaySession`；详情页新增「最近记录」列表（时间 · 时长 · 异常退出标记） |
| 9 | **Xbox 直连置灰** | 打包应用受 WindowsApps ACL 保护，管理面板对 Xbox 条目禁用「直接启动」 |

明确不做（本轮决策）：EA 的 `origin://launchgame` 需要稳定 contentId，注册表里拿不到，EA 条目维持直接启动；itch.io 不是主流平台且无法真机验证；游戏内浮层（Shift+Tab 迷你浮层）是远景。

实测：搜索过滤（63→1→63）、入库回执（「已入库 1 款游戏 · CrossCode」）、拖拽解析（notepad.exe 预填 / steam.exe 被拒）、挂机开关（aria + library.json 落盘 10）、详情记录渲染（2 条含异常退出标记）、scanner+settings+detail 对比度 14 主题 0 失败。

---

## 3. 数据模型变化

`GameEntry` 新增两个字段（都为可空兼容，旧 `library.json` 直接读）：

| 字段 | 含义 |
| --- | --- |
| `PlatformId` | 平台自己的 id：Epic AppName / GOG gameID / Ubisoft install id / Xbox AUMID / 战网 code |
| `LaunchUri` | 必须由客户端启动的协议地址；空 = exe 足够（GOG、EA、手动） |

`GamePayload` 新增 `PlatformId` / `PlatformLabel` / `HasLaunchUri`，前端不再靠
`source === 'steam'` 猜。

`launchMode` 新增 `platform`；`GameLaunch.ModeFor()` 是唯一解析器，
`SteamService.ModeFor()` 转发它。

另有：`PlayerSettings.IdlePauseMinutes`（默认 10，0=关）、`GamePayload.ClientInstalled` /
`RecentSessions`（最近 5 条会话）、`DropResolution`（拖拽解析结果，注册进 StoreJsonContext）。

---

## 4. 入库窗口的设计契约

见 `docs/THEME-DESIGN-SPEC.md` §5.5。三句话版本：

1. 它**就是**一个 `.engine-shell`，材质/切角/标题字体/按钮配方全部来自
   `--sheet-*`，所以 14 套主题不需要额外写样式就各自成立；
2. 选择卡的选中态只用 `--sheet-mark`（左轨）+ `--sheet-active-bg`（底），
   文字永远 `--sheet-ink`；
3. 「推荐」标签用 `--sheet-ink-2` + 一个 `--sheet-mark` 圆点，
   **不要**用 `--accent-text`（nova 的 accent 取自封面，深封面会掉到 2:1）。

---

## 5. 顺带修掉的真问题

本轮为了「新控件一次适配 14 套主题」，审计把旧问题一起照出来了：

| 问题 | 位置 | 修法 |
| --- | --- | --- |
| 弹窗里的焦点环是白色，纸面主题等于没有 | `src/app.css` | `html .engine-shell :focus-visible { outline: var(--sheet-ink) }`（顺带修好缩放引擎弹窗） |
| DUSK 主按钮纸张字压浅陶土只有 **2.95:1** | `--sheet-primary-bg` | 渐变加深为 `#a9503a → #8a3d2a`，最浅端 4.8:1 |
| 扫描行徽标在 RIOT 纸面 **4.04:1** | 各主题 `.scan-source` 用了 `--t-accent` | `html[data-theme] .scan-source { color: var(--accent-text) }` |
| 分组计数 `em` 用 `opacity: .82` 压色 | `.scan-group-title span em` | 去掉 opacity（铁律 26） |
| 轨道选中项副标题用 `--accent`，深封面时 **2.2:1** | `base.css` `.tile.is-active .tile-sub` | 改 `--muted` |
| ENDFIELD 搜索框 `/` 键帽墨字压墨底 **1:1** | `themes/endfield/theme.css` | 加 `html[data-theme="endfield"]` 提权，恢复纸色字 |
| 快捷键值 `opacity: .82` → ENDFIELD **4.33:1** | `src/app.css` `.hotkey-value` | 去掉 opacity |
| nova 的 `--accent-text` 直接等于封面取色，深封面全站小字掉到 2:1 | `app.js applyAccent` | 新增 `readableAccentText()`：按 WCAG 逐级提亮到 4.6:1，保留色相 |
| 主题切换后行内 `--accent-text` 反过来盖住主题自己的值 | `theme-engine.js apply()` | 换主题时清掉行内 `--accent-text`（除非主题 tokens 里自带） |
| 弹窗关闭按钮 hover 时被主题染成浅色，压在浅底上 **1.2:1**（DUSK / RIOT） | `html[data-theme] .engine-shell :is(.icon-btn:hover…)` | 用 `:is()` 多拿一级特异性，赢过 `html[data-theme="dusk"] .icon-btn:hover` |
| 空库主按钮被压到 `opacity: .55`，CODEX 深字压金底 **3.9:1** | `body.is-empty` | 空库时主按钮是全亮度（它现在是「添加游戏」入口），只淡出进度条 |
| 选中卡的左轨用 `::before` 画，悬停审计把伪元素当整块底色 → 假 1:1 | `.import-choice` | 改成 `border-left: var(--sheet-mark-w) solid`，不再用伪元素 |

---

## 6. 验证记录（全部无头 CDP）

启动方式（本机 WebView2 需要关沙箱 + 软件渲染，否则 GPU 进程立刻退出）：

```bash
NOVA_DATA_ROOT="D:/tmp/guguova-import" \
NOVA_CACHE_ROOT="$(pwd)/.cache/webview2-import" \
NOVA_CDP_PORT=9333 \
NOVA_WEBVIEW_ARGS="--no-sandbox --disable-gpu" \
./bin/Debug/net10.0-windows/win-x64/GUGUOVA.exe
```

| 项 | 结果 |
| --- | --- |
| 静态对比度 | 14 主题 × 18 界面（**含 `import`**），`✓ every measured text run meets AA on a solid background` |
| 悬停/聚焦对比度 | 14 主题 × 4 视图（home / settings / detail / **import**），`✓ every measured hover/focus run meets AA on a solid background` |
| 首启动提示 | 空数据根首启 → 弹窗出现、检测到 STEAM 24 + GOG 1、`开始扫描` 可点；关闭后 `firstRunDone=true`，二次启动不再出现 |
| 无头全量截图 | `headless-shots --views=all --workers=4` → **280 张 / 212 秒**，0 截断 0 横向溢出，14 主题 20 界面齐全 |
| 体验补齐包 | 搜索过滤 63→1→63；入库回执弹窗；拖拽解析（notepad 预填 / steam.exe 拒绝）；挂机开关 aria+落盘；详情记录 2 条渲染；scanner+settings+detail 对比度 14 主题 0 失败 |
| 入库全流程 | GOG `CrossCode` 导入成功：`source=gog`、`platformId=1252295864`、`hasLaunchUri=false`、`launchModeResolved=direct`；库统计「1 款来自平台」、卡片徽标 `GOG`、筛选「平台」命中 |
| 平台扫描 | `Steam 22 · GOG 1 · 快捷方式 40`，分组标题「全选 22 / 全选 1 / 全选 40」，勾选后按钮变「导入所选 (1)」 |
| 文案一致性 | 详情「来源」、管理面板「启动方式 / 版本来源」、首页副状态都跟随 `sourceLabel` |
| 构建 | `dotnet build -c Debug` 0 错误（3 个既有警告） |

QA 产物（仓库外）：

- `../_shots/contrast/contrast.json`
- `../_shots/contrast-hover/hover.json`
- `../_shots/import-check/`（入库窗口与库卡截图）
- `../_shots/headless/`（14 主题 × 20 界面，无头渲染与布局审计）

---

## 7. 下一轮 P0

### P0-1 · 五个平台的真机验证（本轮最大的空白）

代码路径都对，但**本机没有 Epic / Ubisoft / EA / Xbox / 战网的安装**：

1. 装 Epic 客户端 + 1 款免费游戏 → 确认 `.item` 解析、协议启动、进程附着；
2. Ubisoft Connect + 1 款 → 确认 `Installs` 键与 `uplay://launch/<id>/0`；
3. EA app + 1 款 → 确认 `Install Dir` 与直接 exe 启动；
4. Xbox / PC Game Pass + 1 款 → 确认 `AppxManifest` 能读到 AUMID、
   `explorer.exe shell:AppsFolder\…` 能拉起，且「程序缺失」不会误报；
5. 战网 + 1 款 → 确认 `battlenet://` 代码表覆盖到了。

判定标准：条目能导入、能启动、退出后时长进库、管理面板能切「直接启动」。

### P0-2 · 首次启动提示的边界

- 老玩家升级（库里已有游戏、`firstRunDone=false`）→ 只弹一次；
- 弹窗打开时按 Esc / 点遮罩 / 关窗口 → 下次启动不再弹；
- 空库且没装任何平台 → 默认落在「手动添加」，副标题为「没有检测到已安装的平台」；
- `NOVA_DATA_ROOT` 演示实例每次新数据根都会问一次（预期行为）。

### P0-3 · Steam 全流程（沿用上一轮的阻塞项）

登录态、SteamStub 与普通游戏各一次、`launchMode` 三种、退出后 2.5s 的
`playtime-synced`、无 UAC。详见 1.14.4 交接文档 §8 P0-1。

### P0-4 · 缩放引擎真机（另一台没有 Magpie 的机器）

单 exe 首启解压、自动拉起、快捷键、退出后自动关闭；光标「跟随画面」、
帧率留空=无上限。

### P0-5 · 全主题回归 + 布局

```bash
bash tools/release.sh --audit
node tools/export-all.js --themes=all --views=all --sizes=1439x1124,960x600,1280x800 --stress
```

重点看新入库窗口在 `960x600` 下两张卡是否挤（≤620px 已降为单列），
以及 30 字标题 + 平台徽标那一行是否溢出。

---

## 8. 下一轮 P1 / P2

### P1

- **封面**：Epic / Ubisoft / Xbox 目前只有图标生成的封面；如果要截图级的观感，
  得让玩家手动选图，或读取各客户端自己的本地缓存（离线、不下载）。
- **战网代码表**：`Call of Duty` 系列没有稳定 code，目前走直接 exe。
- **Xbox 直接启动**：`LaunchMode=direct` 时 WindowsApps 的 ACL 会拒绝，
  应该在 UI 上把「直接启动」对 Xbox 条目置灰，而不是让玩家点了报错。
- **入库窗口的键盘路径**：目前 Tab 到卡片按 Enter 只切换选中，还要再 Tab 到
  「继续」；可以让 Enter 直接在主按钮上生效（手柄 A 已经是这个行为）。
- **挂机暂停的可见反馈**：暂停只写日志，运行中卡片没有"已暂停"角标；要做得低调。
- **`audit-hover` 视图扩展**：把 library / engine / appearance / scanner 纳入默认集。
- **无头截图提速**：现在 280 张 212 秒；可把 `setup()` 里的固定 sleep 改成
  「等目标元素出现」的轮询，预计能再快一半。
- **README**：截图仍是 1.9.0 的，功能列表也没有平台入库。
- **Magpie profile `autoScale`**：把「全屏缩放」映射成按 exe 自动缩放。

### P2

- 可选效果包（Anime4K / CuNNy / RAVU / NNEDI3 / CRT / xBRZ）。
- 归档 `docs/HANDOFF.md`、`docs/THEMES.md`（仍是 1.8.0 的叙事）。
- 清理 `tools/_*.tmp.js` 调试残留。
- `pipeline.sh` 收编到 `release.sh` 后删除。

---

## 9. 关键文件地图

| 需求 | 位置 |
| --- | --- |
| 平台清单 / 标签 | `Services/PlatformScanner.cs` `GamePlatform` |
| 平台扫描 | `Services/PlatformScanner.cs` `Scan()` / `Detect()` |
| 平台协议启动 | `Services/LaunchModes.cs`、`LauncherService.LaunchThroughClient` |
| 扫描/导入桥 | `NativeBridge.cs` `ScanLibrary` / `PlatformSummary` / `ImportCandidates` / `DismissFirstRun` |
| 首次启动 | `NativeBridge.BuildBootPayload`（`firstRun`）→ `app.js` `maybeAskFirstRun` |
| 入库窗口 | `src/index.html#importOverlay`、`src/app.js` IMPORT SHEET、`src/app.css` `.import-shell` |
| 扫描窗口 | `src/app.js` SCANNER（`renderScanResults` / `scanGroupTitle` / `toggleScanGroup`） |
| 来源文案 | `src/app.js` `platformOf` / `sourceLabel` / `platformShort` |
| 可读强调色 | `src/app.js` `readableAccentText` / `applyAccent` |
| 主题令牌清理 | `src/theme-engine.js` `apply()`（`--accent-text` 归还给主题） |
| 共享控件令牌 | `src/app.css`：`.nova-select` / `.engine-shell` / `.hero-scale` / `.appearance-framing` / `--accent-text` |
| 主题清单 / 样式 | `themes/<id>/theme.json` / `theme.css` |
| 数据根 / 隔离 | `Services/StoreService.cs` `AppPaths`（`NOVA_DATA_ROOT`） |
| Steam 时长 | `Services/SteamPlaytime.cs`、`StoreService.SyncSteamPlaytime` |
| 单 exe 引擎解压 | `Services/EngineBootstrapper.cs`、`ScalingEngine.BundledDirOverride` |
| 发版流水线 | `tools/release.sh` + `verify-release.py` + `smoke-single.py` + `publish-release.py` |
| 无头截图 | `tools/headless-shots.js` + `tools/lib/headless-host.js` + `tools/lib/ui-views.js` |
| 扫描封面 URL | `NativeBridge.FileUrl` / `MapFileHost` / `CoverUrlFor`、`GameScanner.CacheRoots` |
| 挂机暂停 | `LauncherService.EnsureIdleTimer` / `SampleIdle` / `EffectiveSeconds` |
| 拖拽入库 | `MainWindow.OnWebDrop` → `NativeBridge.HandleFileDrop` → 前端 `onDropImport` |
| 托盘快速启动 | `MainWindow.ShowTrayIcon` / `RecentGamesForTray` / `LaunchFromTray` |
| 客户端安装探测 | `PlatformScanner.ClientInstalled`（会话缓存） |
| 静态对比度审计 | `tools/audit-contrast.js`（视图含 `import`） |
| 悬停对比度审计 | `tools/audit-hover.js`（视图含 `import`） |
| 截图 / 布局审计 | `tools/export-all.js`（视图含 `import`） |
| 完整设计规范 | `docs/THEME-DESIGN-SPEC.md` |

---

## 10. 绝对不要回退的约定

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
14. **每套新主题先交静态构图稿，用户确认后再写 CSS**；
15. 示例库与截图里不允许出现真实游戏素材；
16. 技术标识（程序集命名空间、`NOVA Game Space`、`NOVA_*`、主题 id `nova`）不跟随品牌改名；
17. **平台徽标只用文字**，不引入第三方 logo / 品牌色；
18. **来源文案只有一个出口**：`platformOf` / `sourceLabel` / `platformShort`，
    任何界面不得再写 `source === 'steam' ? … : …`；
19. **入库窗口必须挂 `.engine-shell`**，复用 `--sheet-*`，不另起材质。

### 文字与控件

20. **正文 / 小字 ≥ 4.5:1，大字 ≥ 3:1**；静态与 hover/focus 两条审计都要 0 失败；
21. **accent 只做标记，不做小字**；文字用 `--accent-text` 或墨色；
22. **共享控件令牌必须齐全**：`--menu-*` / `--sheet-*` / `--mode-*` / `--af-*` /
    `--hs-*` / `--accent-text`；
23. **新增控件必须一次适配 14 套主题**；禁止系统原生 select / 消息框 / 文件框；
24. **算法行**是每主题独立选择卡；缺效果用虚线框 + 删除线，不用整体半透明；
25. **取景浮层必须不透明**；渐变面板补 `--af-solid`；
26. **主题用 `!important` 给 `.icon-btn` 上色时**，浅色弹窗必须用更高特异性覆盖；
27. **`.btn::before` 扫光层必须 `z-index: -1`**，否则纯文本按钮 hover 会变白块；
    改动后必须跑 `tools/audit-hover.js`；
28. **方形图标按钮**（`.icon-btn.square`）在浅色弹窗里必须显式给 rest/hover 前景；
29. **不要用 `opacity` 压字色**；父级与子级会相乘（`.hotkey-value`、分组计数都踩过）；
30. **弹窗内的焦点环用 `--sheet-ink`**，白色焦点环在纸面主题上等于没有。

### 启动 / 数据

31. **启动器等游戏窗口出现并置前后才最小化**；
32. **用户可见的名字一律 GUGUOVA**；
33. **Steam 启动走 `steam.exe -applaunch`**；提权修复只删 `RUNASADMIN`；
34. **平台启动走协议**，统一由 `GameLaunch.ModeFor` 解析；
    需要客户端的条目在进程出现后才记账，不要提前写 session；
35. **Magpie 快捷键按位域解码**（默认 3137），可随包分发但必须独立进程 + GPLv3；
36. **全屏缩放先看游戏自己的选择**；`scalingEngine=off` 时不得偷偷缩放；
    **自动启动引擎默认关**；
37. 外观取景编辑**只写 `HeroPosition` / `HeroZoom`**；
38. **启动界面只能 Esc 退出**（手柄 B 等价）；
39. **Steam 时长只取 max，不相加**；
40. **QA 工具切主题必须 `persist:false`**；
41. **改主题 CSS 必须 bump `theme.json` 的 version**；
42. **夜航游戏库宽屏 4 列、短窗 2 列**；
43. **主题自绘主视觉必须消费 `--nova-hero-position` / `--nova-hero-size`**；
44. **`#questCard` 默认隐藏是产品决定**；恢复活动通知时去掉 `hidden`；
45. **封面取色只用于内置 nova**；换主题时行内 `--accent` / `--accent-text`
    必须交还给主题（`theme-engine` 已处理）；
46. **首次启动提示只问一次**：任何出口都要写 `firstRunDone`；
47. **平台扫描只读**：不写注册表、不下载封面、不发网络请求；
48. **启动器本体不是游戏**：快捷方式扫描与拖拽都走 `ClientExeNames` 黑名单；
49. **挂机暂停是默认行为**（`IdlePauseMinutes` 默认 10）：结算用 `EffectiveSeconds`，
    不要回退成裸墙钟；0 = 关；
50. **扫描/托盘/拖拽里拒绝启动器客户端**；Xbox 条目不提供「直接启动」。

### 构建 / 发布

48. **legacy (net48) 不支持 C# 8 的 range / index 语法**（`x[..n]`、`x[^1]`）；
49. **Magpie 永远独立进程**：内嵌只打包成 zip，解压后再 `Process.Start`；
50. **单 exe 的解压目录必须带 `.complete` 标记**；
51. **文件夹包优先于内嵌**：`engine\magpie\` 在 exe 旁边时必须直接用它；
52. **发版必须走 `tools/release.sh`**；改过数据层代码要跑 `smoke-single.py`；
53. **`NOVA_DATA_ROOT` 会切换单实例锁**；测试脚本不要假设只有一个进程。

---

## 11. 快速命令

```bash
cd nova-game-space-desktop

./tools/relaunch.sh                        # 构建 + 同步主题 + 启动（CDP 9223）

# 无头 QA（本机 WebView2 需要关沙箱 + 软件渲染）
NOVA_DATA_ROOT="D:/tmp/guguova-import" NOVA_CACHE_ROOT="$(pwd)/.cache/webview2" \
NOVA_CDP_PORT=9333 NOVA_WEBVIEW_ARGS="--no-sandbox --disable-gpu" \
./bin/Debug/net10.0-windows/win-x64/GUGUOVA.exe &

# 无头截图（不需要宿主、不需要数据目录）
node tools/headless-shots.js                        # 核心界面
node tools/headless-shots.js --views=all --workers=4
node tools/headless-shots.js --themes=endfield,dusk --views=import,settings --sizes=960x600
node tools/headless-shots.js --format=png --open

# 对比度审计（仍走真实宿主，因为要读实际渲染色）
NOVA_CDP_PORT=9333 node tools/audit-contrast.js
NOVA_CDP_PORT=9333 node tools/audit-hover.js --views=home,settings,detail,import
NOVA_CDP_PORT=9333 node tools/export-all.js --views=all --sizes=1439x1124,960x600 --stress

NOVA_CDP_PORT=9333 node tools/drive.js "return await window.nova.call('platformSummary');"
NOVA_CDP_PORT=9333 node tools/drive.js "return await window.nova.call('scanLibrary');"

bash tools/release.sh --version 1.16.0 --publish
```

Git / PR：`gh` 未安装；用 credential manager 的 token 走 GitHub API 建 PR / 合并 / 发 Release。

---

## 12. 已知限制与风险

- **Epic / Ubisoft / EA / Xbox / 战网在本机都没有安装**，代码只做了静态验证；
  首次真机会暴露字段名或路径差异，优先看 `nova.log` 的 `platform scan` 行。
- **Xbox 的 AUMID** 依赖 `AppModel\Repository\Packages` 里能查到
  `PackageFamilyName`；查不到时启动会失败并弹「无法唤起启动地址」。
- **Epic `.item` 的 `LaunchExecutable` 可能是相对根目录的路径**；
  解析失败会退回目录扫描，个别 DLC 会被当成主游戏。
- **Ubisoft 注册表没有显示名**，条目名来自安装目录名（如 `Far Cry 5`）。
- **平台条目没有本地封面**，只有图标生成的封面，标题排版可能偏素。
- **战网 / EA 的部分标题**走直接 exe，客户端可能仍会弹登录。
- **DUSK 的主按钮**本轮改了渐变；如果后续主题卡要求「陶土浅端」，
  必须同时给出 ≥4.5:1 的字色，否则回退。
- **`--accent-text` 现在由 JS 在 nova 上按对比度提亮**；纯 CSS 静态检查
  （不跑 JS）看到的是 `var(--accent)`，别误判。
- **WebView2 在本机会 `GpuProcessExited`**：必须 `--no-sandbox --disable-gpu`，
  否则 CDP 端口活不过 3 秒。
- **`audit-contrast` 的 `layered` 项**仍需人眼复核（弹窗渐变面、主视觉上的字）。
- **Steam 时长是分钟粒度**；刚启动/刚退出的几分钟可能滞后。
- **全屏缩放只对窗口化游戏有效**；Magpie 需要 Win10 1903+。
- 本轮未在 Win7、真实 Steam 登录态、另一台无 Magpie 机器上验证。

---

## 13. 历史与 PR

| 版本 | 内容 |
| --- | --- |
| 1.9.0 | DUSK / STEAM / NIGHTFLIGHT 三套主题重做；16 个音效重合成 |
| 1.10.0 | Steam 提权修复、窗口置前、启动器退场、全屏缩放 |
| 1.11.0 | 内置轻量 Magpie、快捷键录制、简化引擎弹窗、`.nova-select` |
| 1.12.0 | Steam 封面取原图（按分辨率挑选 + 只降不升） |
| 1.13.0 | Steam 时长同步、主题文案词典、全主题控件/文字精修、设计规范 + skill |
| 1.14.0 | 缩放引擎选项对齐 Magpie、文案清理、hover/focus 白块与图标修复、`audit-hover` |
| 1.14.1 | 单文件 exe：内嵌主题、前端资源与 Magpie 引擎 |
| 1.14.4 | 流水线式打包：`release.sh` + verify + smoke + publish；`NOVA_DATA_ROOT` |
| **1.15.0** | **多平台入库（Epic/GOG/Ubisoft/EA/Xbox/战网）、首次启动提示、添加游戏先选路、入库窗口 14 主题适配、`import` 视图进入三条审计** |

---

## 14. 交接清单

- [x] 应用 1.15.0 构建通过（0 错误）；
- [x] 静态对比度 0 失败（14 × 18，含 `import`）；
- [x] 悬停/聚焦对比度 0 失败（14 × 4，含 `import`）；
- [x] 首次启动提示出现 / 只出现一次 / 三分支可走通；
- [x] GOG 条目端到端导入并正确显示来源与启动方式；
- [x] 入库窗口 14 套主题渲染正常（截图 + 审计）；
- [x] 设计规范 §5.5、`LAUNCHER-FEATURES` §2.1、`STEAM-LAUNCH` §3.1 已更新；
- [x] `tools/headless-shots.js` 可用：280 张 / 212 秒 / 0 布局告警；
- [x] 扫描行缩略图修复：缓存封面经 `nova.cacheN` 加载，无缓存走唱片兜底，0 破图；
- [ ] Epic / Ubisoft / EA / Xbox / 战网真机；
- [ ] Steam 登录态全流程；
- [ ] 另一台无 Magpie 机器的引擎真机；
- [ ] Win7 + WebView2 109；
- [ ] 重新打包 1.15.0 并发布（本轮未做）。

下一轮从 **§7 P0-1（五个平台的真机验证）** 开始。
