# GUGUOVA 架构总览

> 面向下一轮接手的 AI 与 Owner。本文件只讲**结构与契约**，不记录具体轮次工作——
> 轮次状态看 `docs/HANDOFF-NEXT.md`，主题视觉看 `docs/THEME-INTERFACES.md` 等。
> 仓库根的 `README.md` 是面向玩家的发布说明，不是架构文档。

## 1. 仓库结构总览

```
根目录            WPF 宿主（C#）+ 渲染端静态资源 + 工具链
├─ NativeBridge.cs        宿主↔渲染端唯一的桥（详见 1.1）
├─ MainWindow.xaml(.cs)   窗口外壳：无边框窗、标题栏、WebView2 宿主事件
├─ App.xaml(.cs)          WPF 应用入口
├─ Services/              宿主侧服务层（28 个文件，逐个职责见 1.1）
├─ src/                   渲染端（WebView2 里跑的全部东西，见 1.2）
├─ themes/                13 套目录主题（+ 内置 nova = 14 套，见 1.3）
├─ tools/                 QA 与发布工具链（见 1.4）
├─ docs/                  交接与规格文档（HANDOFF-*、THEME-*、RELEASE…）
├─ legacy/                net48 legacy 宿主工程与单 exe 内嵌载荷
├─ third_party/magpie/    GPLv3 缩放引擎（独立分发，运行时解压）
└─ wasm/                  渲染端 WASM 加速层产物
```

### 1.1 宿主 C#

- **根 `NativeBridge.cs`**：WPF 宿主与 WebView2 渲染端之间**唯一的桥**——WebView2
  生命周期、C#↔JS 消息分发（`nova.call` / 事件）、窗口/全屏/缩放/启动等宿主能力
  都从这里进出渲染端。它是 `public sealed partial class`，成员按领域分片在根目录
  的 `NativeBridge.<Domain>.cs`（Capture / Engine / Games / Launch / Library /
  Media / Settings / System / Themes / Update）；主文件保留消息路由与参数解析。
  **注意：legacy csproj 对根目录的桥文件是显式引用，新增 `NativeBridge.*.cs`
  必须同步补 `<Compile Include>` 条目**（Services 目录是通配，无此问题）。

**Services/ 各文件一句职责**（按依赖阅读时的速查表；`LauncherService` 与
`ScalingEngine` 也是 partial 类，领域分片（`*.Launch.cs` / `*.Config.cs` 等）
与主文件同目录，职责在分片头部注释里）：

| 文件 | 一句职责 |
| --- | --- |
| `AssetBootstrapper.cs` | 单 exe 支持：首启把内嵌 `assets.zip`（src/ + themes/）解压到运行时目录 |
| `BackupService.cs` | 便携离线数据包：库 + 设置打 zip 导出/导入 |
| `CompatUtil.cs` | modern 与 .NET Framework 两个宿主共用的小工具函数 |
| `CoverAnalyzer.cs` | 封面 DNA 指纹：给标题字标导演（TYPE DIRECTOR）供封面特征 |
| `EngineBootstrapper.cs` | 单 exe 支持：内嵌 Magpie 引擎的解压落地 |
| `FileBrowser.cs` | 应用内文件浏览器的目录列举（不落回 Windows 原生对话框） |
| `GameDisplay.cs` | 把游戏真实窗口拉到启动器前面，可选铺满 |
| `GameScanner.cs` | 扫描用户已有的游戏：Steam 库（appmanifest + acf）等 |
| `IsExternalInit.cs` | record 的 `init` 访问器支持样板（无逻辑） |
| `LaunchModes.cs` | 解析一个库条目「怎么启动」；不再 Steam 专属（Epic/Ubisoft/Xbox/Battle.net 也可能需要宿主客户端） |
| `LauncherService.cs` | 启动管线：进程拉起/附着、会话与时长记账、退出跟踪、空闲暂停、启动器进程树清理（`LaunchOptions`/`ScaleExplicit` 是它顶部的数据 record） |
| `LibraryModels.cs` | `library.json` 的数据模型（GameEntry 等） |
| `ManifestImporter.cs` | 读 `nova-game.json` 集成清单（规格见 `docs/INTEGRATION.md`） |
| `MediaService.cs` | 真实游戏文件 → NOVA 素材：从指定帧抠封面、抽图标 |
| `PlatformScanner.cs` | 可导入的启动器家族清单（纯数据，UI 负责呈现） |
| `ScalingEngine.cs` | 内置 Magpie 缩放引擎（GPLv3，独立分发于 `third_party/magpie`） |
| `ShellInterop.cs` | 从 Windows shell 图像列表抽 256px 图标 |
| `ShortcutResolver.cs` | `.lnk` 快捷方式 → 目标 exe |
| `StartupService.cs` | 开机自启：每用户 Run 注册表键（不是计划任务） |
| `SteamPlaytime.cs` | 读 Steam 自己记录的游玩时长 |
| `SteamPrivilege.cs` | 侦测/修复导致 Steam 弹 UAC 的两种配置 |
| `SteamService.cs` | 读本机 Steam 客户端，决定一个 Steam 条目如何启动 |
| `StoreService.cs` | 数据根（`NOVA_DATA_ROOT`）：打包与截图管线用一次性档案，绝不碰玩家真实库 |
| `SystemProfile.cs` | 一次性 OS/WebView2 探测，结果决定能力分级（`data-tier`） |
| `ThemeService.cs` | 从 `%LOCALAPPDATA%\NOVA Game Space\themes` 装载/播种主题（含版本与文件时间戳双口径的更新判定） |
| `UpdateService.cs` | 更新候选解析与包体下载（GitHub Releases，HttpClient 直连；全应用唯一联网功能，默认关） |
| `WebView2Bootstrapper.cs` | 单 exe 支持：legacy 宿主 `WebView2Loader.dll` 的落地 |

### 1.2 渲染端 `src/`

`index.html` 是静态资源清单（含 `?v=` 版本号），按它把 JS 入口与 CSS 表列全。

**JS 入口**（defer 加载，`app.js` 最后）：

| 文件 | 一句职责 |
| --- | --- |
| `motion.js` | 动效系统（编排与曲线） |
| `focus.js` | 焦点管理器 |
| `surfaces.js` | 表面 / 模式注册表 |
| `gamepad.js` | 手柄轮询与映射 |
| `overlays.js` | 浮层管理 |
| `capability/palette.js` | 封面色板参考实现（CPU 基线） |
| `capability/gpu-palette.js` | WebGPU 封面色板内核（加速路径） |
| `capability/capability.js` | 能力仲裁：选实现、定分级 |
| `capability/diag.js` | 能力诊断输出 |
| `theme-engine.js` | 主题引擎：装载 theme.css / interfaces.css / tokens / icons / features，**是 CSS 层叠契约的执行者**（见 §2） |
| `intro.js` | 开屏注册表：preset 注册 + 自建舞台 + 可重放 |
| `fx-record.js` | RECORD BRIDGE：把启动器真实数据（选中游戏等）发布为 CSS 自定义属性——CSS-only 主题靠它才拿得到 JS 状态 |
| `app.js` | 渲染端主程序（**由分片拼装，见下**） |

**CSS 表**（每个文件单一职责，文件头横幅即声明）：

| 文件 | 一句职责 |
| --- | --- |
| `base.css` | 控制台基底设计系统 |
| `theme.css` | 主题框架底板（内置 nova 主题自身的样式表） |
| `cta-palettes.css` | 封面导向的纯配色 CTA 按钮语言 |
| `type.css` | 字体系统：控制台字阶 + 生成式标题字标 |
| `app.css` | 桌面应用层：窗口铬件等应用外壳加层 |
| `motion.css` | 沉浸动效：启动/退场编排、沉稳模式、手柄图例 |
| `views.css` | 原地视图：home / library / appearance 共用一个内容区 |
| `dialogs.css` | 应用内对话框与文件浏览器（替换所有原生弹窗） |
| `themes.css` | 主题选择器 + 右键菜单（仅布局，颜色来自活动主题） |
| `theme-fx.css` | 主题特性框架 v2：所有主题共用的视觉骨架 |
| `fx-layers.css` | 图层样式：显示字标的「Photoshop 混合选项」 |
| `theme-kit.css` | 主题统一视觉框架（THEME KIT） |
| `polish.css` | 小交互打磨（不改视觉语言的行为） |
| `intro.css` | 开屏系统（主题无关的开场仪式） |
| `compat.css` | 能力分级（capability tier）覆盖；必须保持在所有主题层之后（见 §2） |
| `theme-slots.css` | 接口插槽的**共享半边**：容器规则与引擎弹窗内部令牌重绑定 |
| `share-cards.css` | 分享卡片样式 |
| `settings-themes.css` | 设置页主题卡的共享默认 |
| `theme-nova.css` | 内置 nova 主题的接口槽映射（nova 无主题目录，与 `interfaces.css` 同层） |

**`src/app/` 分片机制**：`src/app.js` 是渲染端的单一 IIFE 闭包（近 9800 行），
已被按职责切成 `src/app/01-runtime.js … 29-boot.js` 共 29 个分片；
`tools/build-app.js` 按文件名序把分片拼回 `src/app.js`，运行时行为与拆分前
逐字节一致。**改代码只改分片**（直接改 `src/app.js` 会在下次拼装时被覆盖）。
拼装规则、分片地图、跨分片引用惯例详见 **`src/app/README.md`**——那里是唯一
权威，本文件不复述分片表。`tools/pack-assets.py` 打包时跳过 `src/app/`，只装
拼装产物。

### 1.3 `themes/`

13 套目录主题：aurum、broadcast、codex、dusk、endfield、grimoire、mnemo、
nightflight、riot、riso、steam、summer、zerohour；加上内置 **nova** 基底主题
（无目录，样式随 `src/` 分发）共 **14 套**。

每个主题目录固定结构：`theme.json`（清单：版本、tokens、icons、features）、
`theme.css`（主题样式表）、`interfaces.css`（接口槽映射）、`DESIGN.md`（设计
说明与量化口径）、`assets/`、`sounds/`。

**interfaces.css 映射架构**：共享样式表不再出现任何具体主题 id；每套主题把
自己在插槽（菜单、弹层、设置卡、缩放引擎弹窗、强调文字…）上的材质、墨色、
圆角、强调色写在 `themes/<id>/interfaces.css`。三份文件三种职责（`src/theme-slots.css`
共享容器规则 / `themes/<id>/interfaces.css` 主题材质 / `src/theme-nova.css` 内置），
槽位令牌全表与加载顺序见 **`docs/THEME-INTERFACES.md`**（§16 是权威）。映射是
可选的：没有映射的主题退回共享默认，能看，不破。

### 1.4 `tools/`

**QA 审计类**（一句一个）：

| 工具 | 职责 |
| --- | --- |
| `theme-slot-check.js` | 接口插槽门禁：校验各主题 interfaces.css 的槽位令牌（`--strict` 进发行闸门） |
| `feature-checks.js` | 特性断言：在真实渲染器内验证批次特性 |
| `tier-shots.js` | 时长里程碑阶梯验证：全主题 × 全里程碑截图并断言已发布档位色 |
| `headless-shots.js` | 无 WPF 宿主的一站式截图 |
| `headless-hover.js` | 无头悬停/焦点对比度审计 + 交互态图导出 |
| `immersive-audit.js` | 沉浸模式可读性审计 + 截图（无宿主） |
| `text-audit.js` | 全页文本可读性扫描：每个可见标签 × 每套主题 |
| `layout-fit.js` | 沉浸版式在任意窗口尺寸下的结构完整性检查 |
| `verify-hidden.js` | 「隐藏游戏」双验证：首页货架不画隐藏项、详情可恢复 |
| `share-shots.js` | 分享卡片截图：导出弹窗与全尺寸三规格卡 |
| `audit-contrast.js` | 无头文本对比度审计 |
| `export-all.js` | 无头截图总出口（`--stress` / `--parts` 等全家桶） |
| `perf-baseline.js` | 启动器性能基线 |
| `test-palette.js` | 调色板内核一致性测试 |

**构建与发布类**：`build-app.js`（分片拼装器，`--check` 校验未过期）、
`pack-assets.py`（可复现 assets.zip）、`build-legacy.sh`（net48 构建并重生成
载荷 zip）、`bump-version.js`、`package-release.py`（dist/ 打包 + manifest +
SHA-256）、`sign-release.py`（可选 Authenticode 签名）、`verify-release.py`
（发行闸门）、`smoke-single.py`（单 exe 冒烟）、`publish-release.py`（GitHub
Release）、`release.sh`（一条命令发行流水线，见 §3）。

**开发辅助**：`relaunch.sh`（kill→build→sync→run，CDP 9223；主题目录改动可热更）、
`tools/lib/`（无头宿主共享库；`headless-host.js` 在所有无头 QA 启动前自动拼装
app.js）、`sfx-specs/`（音效规格）。另有若干调试/概念预览脚本与临时探针
（`probe-*`、`render-*concepts`、`shot-*` 等），属设计阶段产物，去留见交接报告。

## 2. CSS 层叠顺序契约

**这是本产品最脆弱、最不能动的契约。** 主题胜负由同特异度下的源顺序决定，
任何加载顺序变化都可能悄悄改变某个主题的层叠结果。

**静态共享表**（`index.html` 从上到下，不要重排）：
base → theme → cta-palettes → type → app → motion → views → dialogs → themes
→ theme-fx → fx-layers → theme-kit → polish → intro → compat → theme-slots
→ share-cards → settings-themes。

**运行时主题层注入**（`theme-engine.js` 的 `apply()` 执行，每次切主题重演）：

```
共享表（… → theme-slots.css）
  → interfaces.css   （#theme-interfaces）
  → theme.css        （主题自己的；inlineSheet，总是 appendChild 到 head 最后）
  → compat.css       （capability tier 覆盖；每次切主题后重新 appendChild，
                      必须保持在所有主题层之后）
```

三条硬规则（原文出处：`src/theme-engine.js` `apply()` 内注释、
`docs/THEME-INTERFACES.md` §16.3）：

1. **interfaces.css 必须排在主题自己的 theme.css 之前**。这不是随意选的：
   插槽映射历史上就住在共享表里、在主题样式表之前，theme.css 由此可以在主题
   与共享默认分歧时覆盖插槽。调换顺序会改变层叠胜负——1.16.0 实测 DUSK 设置
   卡底色、STEAM 设置卡整体变样。
2. **theme.css 总是 head 最后一张表**，保证主题压过所有基底表。
3. **compat.css 必须在所有主题层之后**（能力分级覆盖优先于任何主题层），
   切主题后由 theme-engine 重新追加。

**为什么 CSS 不拆文件**：层叠序就是契约本身，每多一张表就多一层叠边界与一个
加载时序变量；而 19 张 CSS 每张已经各自单一职责（见 1.2 表），「拆」已无收益、
只剩风险。真正的模块化拆分发生在 JS（`src/app/` 分片）而非 CSS，正因为 JS 拼装
是纯文本拼接、可逐字节验证，CSS 拼装做不到等价性验证。

## 3. 构建链

**dotnet 双目标**：

- **modern**：根 `NovaGameSpace.csproj` → `net10.0-windows`（开发与主目标）。
- **legacy**：`legacy/NovaGameSpace.Legacy.csproj` → `net48`（Win7/8.1 +
  WebView2 109 兼容）。`legacy/global.json` 钉 .NET SDK 7——从仓库根直接 build
  会用 SDK 10 的 WPF markup compiler 编错，**必须走 `tools/build-legacy.sh`**；
  该脚本同时重新生成 assets.zip 与引擎 zip，保证单 exe 永不带过期载荷。

**assets.zip**：`tools/pack-assets.py` 把 `src/` + `themes/` 打成**字节可复现**
的 zip（固定 1980-01-01 时间戳 + 排序写入）。宿主以 zip 的 SHA-256 键提取目录
与渲染器缓存重置——任何无意义的字节变化都会让玩家付出 370 个文件的重解压 +
下次启动清空缓存。**排除 `src/app/`**（那是未拼装分片），只装拼装产物
`src/app.js`。产物落在 `legacy/embedded/assets.zip`。

**release.sh 流水线**（`bash tools/release.sh`，逐阶段写
`_shots/release/<version>/pipeline.log`，首败即停）：

```
1 version   --version 时 bump（tools/bump-version.js）
2 engine    third_party/magpie 缺失则拉取（--lite 默认；MAGPIE_FULL=1 全量）
3 audit     必跑：theme-slot-check --strict、build-app --check（app.js 未过期）
            --audit 追加：静态对比度、无头悬停、布局截图
3.5 sign    可选 Authenticode 签名（GUGUOVA_CERT_SHA1 / GUGUOVA_PFX_* 环境变量）
4 package   tools/package-release.py → dist/ + manifest
5 verify    tools/verify-release.py 发行闸门
6 smoke     tools/smoke-single.py 单 exe 空目录冒烟（--skip-smoke 跳过）
7 publish   --publish 时推 GitHub Release（tools/publish-release.py）
```

> 备注：自包含单文件 modern 包（`dotnet publish` + `package-release.py --modern-dir`）
> 目前只有 `tools/pipeline.sh --modern` 这条路径，尚未收编进 release.sh；
> 收编后本备注应删除。

## 4. 已知铁律（只指路，不复制）

- **`docs/HANDOFF-NEXT.md` §10「绝对不要回退的约定」**：结构与视觉、行为、工艺
  的全部红线（含铁律编号），任何改动动手前必读。
- **`docs/THEME-INTERFACES.md`**：接口式映射架构权威文档——三份文件三种职责、
  加载顺序（§16.3）、槽位令牌全表。
- 两处内容随版本演进，以原文为准；本文件与它们冲突时，以它们为准。
