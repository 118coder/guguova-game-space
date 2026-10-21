# 发布与打包流水线

> 一条命令从版本号走到可下载的发行物，中间有闸门：
> **version → engine → build → package → verify → smoke → publish**
>
> 任何一步失败都会在发布前停下，不会把坏包传上去。

---

## 1. 一条命令

```bash
cd nova-game-space-desktop

bash tools/release.sh                      # 构建 + 打包 + 校验 + 单 exe 冒烟
bash tools/release.sh --version 1.15.0     # 先 bump 版本，再跑全流程
bash tools/release.sh --audit              # 额外跑 UI 审计（慢，约 8–15 分钟）
bash tools/release.sh --publish            # 校验全过后直接发 GitHub Release
bash tools/release.sh --publish --tag-only # 复用已有 tag，只补传资源
bash tools/release.sh --skip-smoke         # 只打包（CI 快速路径）
```

环境变量：

| 变量 | 作用 |
| --- | --- |
| `MAGPIE_FULL=1` | 打包完整 Magpie 效果集（默认 `--lite`） |
| `NOVA_CDP_PORT` | UI 审计用的 CDP 端口（默认 9223） |

产物与日志：

```
dist/
├─ GUGUOVA-<ver>-single.exe            单文件版（主推）
├─ GUGUOVA-<ver>-legacy-single.zip     文件夹版（轻量引擎）
├─ GUGUOVA-<ver>-legacy-full.zip       文件夹版（含 src/ + themes/）
└─ release-manifest.json               大小 + SHA-256

../_shots/release/<ver>/pipeline.log   每个阶段的完整输出
../_shots/release/<ver>/layout/        --audit 时的截图
```

---

## 2. 七个阶段

| # | 阶段 | 做什么 | 失败会怎样 |
| --- | --- | --- | --- |
| 1 | version | `bump-version.js` 同步 `version.json`、两个 csproj、`index.html` 的 `?v=` | 停 |
| 2 | engine | 缺 `third_party/magpie/Magpie.exe` 时 `fetch-magpie.py --lite` | 警告后继续（无内置引擎） |
| 3 | audit | 可选：静态对比度、hover 对比度、全视图截图 | 停 |
| 4 | build | `build-legacy.sh`：重建 `assets.zip` + `engine.zip`，编译 net48 exe | 停 |
| 5 | package | `package-release.py`：单 exe + 两个 zip + manifest | 停 |
| 6 | verify | `verify-release.py`：版本 / 资源 / 主题 / 包内容一致性 | 停 |
| 7 | smoke | `smoke-single.py`：空文件夹里跑单 exe，验内嵌主题与引擎 | 停 |
| 8 | publish | 可选：`publish-release.py` 建 Release 并上传 | 停 |

`--audit` 没开时，第 3 阶段只打印一行跳过说明。日常改代码打包用默认即可；
**发版前建议至少跑一次 `--audit`。**

---

## 3. 三个校验器

### 3.1 `verify-release.py` — 发布闸门

```bash
python tools/verify-release.py            # 源码树 + dist/
python tools/verify-release.py --dist-only
```

检查项（都是真实踩过的坑）：

- `version.json` / `NovaGameSpace.csproj` / legacy csproj / `index.html` 的 `?v=` 四处一致；
- `index.html` 引用的本地资源都真实存在（改名后漏更新会在这里断）；
- 每套主题都有 `theme.json` + `theme.css`，`id` 与目录名一致，版本号是 `x.y.z`；
- 内置引擎与三份 GPLv3 文件（`NOTICE.md` / `SOURCE-OFFER.txt` / `LICENSE-GPL-3.0.txt`）齐全；
- `assets.zip` 含 `src/index.html` 与主题；`engine.zip` 存在；
- `dist/` 三个产物都在、大小合理、单 exe 是 `MZ` 头；
- 两个 zip 里都有 `GUGUOVA.exe`、`engine/magpie/Magpie.exe`、`version.json`，
  且版本号与当前一致；full 包还要有 `src/` 与 `themes/`；
- `release-manifest.json` 的 SHA-256 与实际文件一致。

### 3.2 `smoke-single.py` — 单 exe 实测

```bash
python tools/smoke-single.py
python tools/smoke-single.py --keep      # 保留临时目录
```

把**只有 exe** 的目录复制到临时目录，用独立的 `NOVA_DATA_ROOT` 启动，然后断言：

- CDP 能起来（窗口真的开了）；
- 14 套主题可用（13 个文件夹 + 内置 nova）；
- 没有坏图、没有加载失败的样式表；
- `magpieStatus` 的 `bundled` 为 true，路径指向数据目录里解压出来的 Magpie；
- 引擎与主题确实被解压到数据目录。

这一步是**打包本身的回归测试**，不测 UI。

### 3.3 `publish-release.py` — 上传

```bash
python tools/publish-release.py --dry-run
python tools/publish-release.py
python tools/publish-release.py --version 1.14.3 --tag-only
```

- token 取自 `git credential fill`，不需要额外配置；
- Release 已存在则复用，已上传的同名资源自动跳过（可安全重跑）；
- Release 说明由 manifest 自动生成，含下载列表、系统要求与 SHA-256。

---

## 4. 隔离数据目录（重要）

`NOVA_DATA_ROOT` 让整个数据根改到别处：

```bash
NOVA_DATA_ROOT="D:/tmp/guguova-test" NOVA_CDP_PORT=9333 ./GUGUOVA.exe
```

- 影响 `library.json`、`media/`、`themes/`、`backups/`、`runtime/`、日志；
- 单实例锁也会跟着数据根分开，所以测试实例能和正在用的启动器同时存在；
- **截图、冒烟测试、演示素材一律用它**，不要碰玩家真实数据目录。

---

## 5. 产物说明

### 5.1 单文件版（主推）

```
GUGUOVA-<ver>-single.exe     9.29 MB
```

内嵌：14 套主题 + 前端资源 + WebView2 native loader + Magpie 轻量引擎。

首次运行解压到：

```
%LOCALAPPDATA%\NOVA Game Space\runtime\<ver>\
├─ assets\           src + themes（3.3 MB）
├─ bin\              WebView2Loader.dll
└─ engine\magpie\    Magpie 轻量引擎（4.7 MB，独立进程）
```

- 解压目录带 `.complete` 标记，版本号变化才重解压；
- Magpie 仍是独立进程，GPLv3 边界不变；
- **不含** .NET Framework 4.8 与 WebView2 Runtime（系统依赖）。

### 5.2 文件夹版

| 包 | 内容 | 用途 |
| --- | --- | --- |
| `legacy-single.zip` | exe + `engine/magpie/` + `launch.cmd` | 需要替换引擎时 |
| `legacy-full.zip` | 上面 + `src/` + `themes/` | 需要直接改主题源文件时 |

两者都带 `launch.cmd`，会检查 .NET 4.8（Release ≥ 528040）与 WebView2 注册表，
缺失时给出说明而不是静默失败。`engine\magpie\` 存在时优先于内嵌引擎。

### 5.3 依赖

- **.NET Framework 4.8**：Win10 1903+ / 11 通常已内置；Win7 SP1 / 8.1 需安装。
- **WebView2 Runtime**：Win10 / 11 通常随 Edge 安装；Win7 / 8.1 用 109。
- 完全离线：把 109 固定运行时解压到包内 `WebView2Runtime/`（含 `msedgewebview2.exe`），
  exe 会直接使用该目录。

---

## 6. 手工分步（排障用）

流水线失败时，按顺序单独跑：

```bash
node tools/bump-version.js 1.14.4
bash tools/build-legacy.sh Release          # 含 pack-assets + pack-engine
python tools/package-release.py
python tools/verify-release.py
python tools/smoke-single.py
python tools/publish-release.py --dry-run
```

单独重打某个内嵌包：

```bash
python tools/pack-assets.py     # src/ + themes/ → legacy/embedded/assets.zip
python tools/pack-engine.py     # third_party/magpie → legacy/embedded/engine.zip
```

---

## 7. 版本与发布检查

- `version.json` 是唯一版本源；`bump-version.js` 会同步两处 csproj 与 `index.html`。
- 改过某套主题的 CSS **必须** bump 该主题 `theme.json` 的版本，否则用户端不会刷新。
- 字体：全主题使用思源黑体 CN / 思源宋体，缺失时回退到 Noto / 微软雅黑 / 宋体，不会缺字。
- 音效为 Kenney Interface Sounds（CC0），`src/assets/sfx/LICENSE-SFX.md` 必须留在包里。
- 发版前人工确认：
  - `bash tools/release.sh --audit` 通过；
  - `dist/release-manifest.json` 的 SHA-256 与上传后一致；
  - Win7 SP1 虚拟机 + .NET 4.8 + WebView2 109 跑一遍（见 `docs/COMPATIBILITY.md` §4.3）。

---

## 8. 数据位置

```
%LOCALAPPDATA%\NOVA Game Space
├─ library.json
├─ media/
├─ backups/        # 每日自动备份，保留 5 份
├─ themes/         # 13 套文件夹主题（nova 内置，不落盘）
├─ runtime/        # 单文件版解压的前端 / loader / 引擎
├─ webview2/       # 缓存；可用 NOVA_CACHE_ROOT 指向其他盘
└─ nova.log
```

迁移：设置 → 数据与备份 → 导出 `.nova-pack`；不含游戏本体与主题。
