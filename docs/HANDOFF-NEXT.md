# GUGUOVA 下一轮交接文档

> 交接版本：**1.14.4**
> 交接时间：2026-10-21
> 分支：`main`，工作区**干净**
> 本轮 PR：**#26** `1c6f095`（流水线工具链）→ 文档 `6652f09`
> 前一版：#25 `0d2cfe5`（单文件 exe）、#24 `ea7adef`（对齐 Magpie + 悬停态修复）
> 发行：**v1.14.4**（single.exe 9.29 MB / legacy-single 13.58 MB / legacy-full 16.90 MB）
> 仓库：`https://github.com/118coder/guguova-game-space`

---

## 0. 一句话状态

应用 **1.14.4**，14 套主题。启动链路（Steam 提权修复 → 进程发现 → 窗口置前 →
启动器退场 → 全屏缩放）自 1.12.0 起完整；1.13.0 把所有界面收紧成“每套主题都像自己”；
1.14.0 把缩放引擎选项对齐 Magpie 并修掉悬停态的白底字；1.14.1 做成单文件 exe；
**1.14.4 把发版变成一条带闸门的流水线**。

当前静态对比度、悬停/聚焦对比度两条审计都是 **0 失败**，单 exe 冒烟通过。
**剩下没有验证的全是“真机 / 真实账号”类事项**——代码侧没有已知阻塞。

### 先读什么

1. 本文 §2–§6 —— 本轮做了什么、现在什么状态；
2. `docs/RELEASE.md` —— 流水线手册（发版只看这一份就够）；
3. `docs/THEME-DESIGN-SPEC.md` —— 界面规范（token、每主题配方、验收）；
4. `.agents/skills/guguova-theme-design/SKILL.md` —— 改主题时照着执行的 skill；
5. `docs/GAME-DISPLAY.md`、`docs/STEAM-LAUNCH.md` §3.2 —— 置前时序 / `-applaunch` / 提权；
6. `docs/HANDOFF.md`、`docs/THEMES.md` —— 1.8.0 之前的旧叙事，仅作对照。

---

## 1. 版本与工作区

| 项 | 值 |
| --- | --- |
| 应用版本 | **1.14.4**（`version.json` 是唯一版本源） |
| 资源版本 | `src/index.html` 全部 `?v=1.14.4` |
| 主题数 | 14（`nova` 内置 + 13 个文件夹） |
| 单文件 exe | `dist/GUGUOVA-1.14.4-single.exe`，9.29 MB |
| 文件夹包 | `dist/GUGUOVA-1.14.4-legacy-single.zip` / `-legacy-full.zip` |
| 发行 | GitHub Release `v1.14.4`，三个资源均已上传 |
| QA 工具切主题 | 全部 `persist:false`，不会覆盖玩家保存的主题 |

---

## 2. 1.14.4 —— 流水线式发布

发版从一串手工命令变成一条带闸门的流水线：

```bash
bash tools/release.sh --version 1.15.0 --publish
# version → engine → build → package → verify → smoke → publish
```

| 工具 | 作用 |
| --- | --- |
| `tools/release.sh` | 主流水线；`--audit` / `--publish` / `--tag-only` / `--skip-smoke` |
| `tools/verify-release.py` | 发布闸门（见 §2.1） |
| `tools/smoke-single.py` | 空目录跑单 exe，验内嵌主题与引擎 |
| `tools/publish-release.py` | 读 manifest 建 Release 并上传，可安全重跑 |
| `docs/RELEASE.md` | 流水线手册 |

日志：`_shots/release/<version>/pipeline.log`（每阶段完整输出）。

### 2.1 五个闸门

1. **版本一致**：`version.json` / `NovaGameSpace.csproj` / legacy csproj /
   `index.html` 的 `?v=` 必须相同。
2. **资源存在**：`index.html` 引用的本地文件必须真实存在。
3. **主题清单**：每套主题有 `theme.json` + `theme.css`，`id` 与目录名一致，版本是 `x.y.z`。
4. **包内容**：单 exe 是 `MZ`；两个 zip 含 exe / 引擎 / `version.json`；
   full 包还要有 `src/` 与 `themes/`；manifest 的 SHA-256 对得上。
5. **单 exe 冒烟**：空目录启动 → 14 主题 → 0 坏图 → 引擎解压且 `bundled:true`。

### 2.2 顺带修掉的真问题

- **`NOVA_DATA_ROOT`**：数据根可迁移，**单实例锁按 profile 分离**。
  做冒烟测试时发现，测试进程会被玩家正在运行的实例接管，只能测到 1 个主题；
  根因就是单实例锁没有区分数据根。
- 冒烟脚本会自动结束临时目录里的残留启动器（只匹配 `guguova-single-*`，不碰玩家实例）。

---

## 3. 1.14.1 —— 单文件 exe

发行物是**一个可执行文件**，双击即可运行，没有文件夹、没有 zip、没有 `launch.cmd`。

| 步骤 | 实现 |
| --- | --- |
| 引擎打包 | `tools/pack-engine.py` 把 `third_party/magpie` 压成 `engine.zip`（4.69 MB） |
| 内嵌 | legacy csproj 内嵌 `NOVA.Assets.zip` + `NOVA.Engine.zip` |
| 首次解压 | `Services/EngineBootstrapper.cs` → `%LOCALAPPDATA%\NOVA Game Space\runtime\<ver>\engine\magpie` |
| 引擎解析 | `ScalingEngine.BundledDirOverride`；`IsBundledPath` 自动跟随 |
| 产物 | `tools/package-release.py` 的 `package_exe()` |

约定：

- Magpie **永远独立进程**，启动器只 `Process.Start`，不链接；
  解压目录里带 `NOTICE.md` / `SOURCE-OFFER.txt` / `LICENSE-GPL-3.0.txt`。
- 解压目录带 `.complete` 标记，版本号变化才重新解压。
- 单 exe **不带** `GUGUOVA.exe.config`，net48 用自身默认运行时启动（实测正常）。
- 仍需要 **.NET Framework 4.8 + WebView2 Runtime**，这两项无法塞进 exe。
- 文件夹包存在 `engine\magpie\` 时优先于内嵌引擎。

---

## 4. 1.14.0 —— 引擎对齐与悬停态修复

### 4.1 Magpie 选项契约

```
frameRateLimiterEnabled : bool     // 留空 → false（无上限）
maxFrameRate            : double   // 留空时保留旧值（默认 120），不生效
cursorScaling           : int      // 6=跟随画面（默认） 2=不缩放 3/4/5=1.25/1.5/2×
captureMethod           : int      // 0 自动 / 1 Desktop Duplication / 2 DWM
3DGameMode              : bool
```

- 算法列表每行显示真实效果链（`Anime4K_Upscale_VL > Anime4K_Restore_VL`）；
- 「像素缩放」= 适应屏幕 · 1×1 倍率 · Nearest 不插值；
- `autoStartEngine` 默认 **关**（`library.json` 的 `PlayerSettings`，与 Magpie 配置分开存）；
- `ScalingEngine.EngineOptions` 带 `FrameRateLimiterEnabled`，
  `ReadOptions` / `SaveOptions` 同步读写两项。

### 4.2 文案清理

删除了 7 处说明性文字：玩家卡片的「· 离线运行，不上传」、关于页「完全离线……」、
启动项旁的三条提示、音效行的说明、快捷键常驻「点击录制」。
「每天自动备份数据 · 保留最近 5 份」保留，因为它是可验证的规则。

### 4.3 悬停态白块（本轮最重要的教训）

ZEROHOUR / CODEX / ENDFIELD / MNEMO 的 `.btn::before` 是 hover 扫光层：

```css
.btn::before { position:absolute; inset:0; z-index:0; background: <纸色>; }
.btn > * { position: relative; z-index: 1; }
```

只有**被元素包裹**的子节点会抬到扫光层之上。`<button>使用 Windows 用户名</button>`
这种纯文本按钮，hover 时文字被纸色盖住 → 整块白；如果文字此时是荧光青柠，
就是“白底荧光字”。

修法：扫光层改 `z-index: -1`。`.btn` 自带 `isolation: isolate`，负层级仍在按钮自己的
栈内，会画在按钮背景之上、文字之下。

同时补齐：

- `.icon-btn.square` 的 rest/hover 前景（base.css 的半透明白在浅色弹窗里是 1:1）；
- `.icon-btn:hover` 与 `.icon-btn.square:hover` 的优先级冲突（主题强调色底被灰底覆盖）；
- 弹窗内 `.icon-btn`（GRIMOIRE 顶栏金色规则会带进羊皮纸弹窗）。

### 4.4 悬停审计工具

```bash
node tools/audit-hover.js
node tools/audit-hover.js --themes=zerohour,summer --views=home,settings,detail
```

用 CDP `CSS.forcePseudoState` 强制 `:hover` / `:focus`，把扫光层纳入背景合成，
阈值与静态审计一致；有失败时退出码 1。

---

## 5. 沿用基线（1.13 及更早）

### 5.1 Steam 游玩时间

```
<SteamRoot>/userdata/<steamid>/config/localconfig.vdf
UserLocalConfigStore → Software → Valve → Steam → apps → <appid>
  Playtime = 分钟   LastPlayed = Unix 秒
```

- 只处理 `Source == "steam"` 且 `SteamAppId` 非空；
- `PlaytimeSeconds = max(本地, Steam)`，**不相加**；`LastPlayedUtc` 取较晚者；
- 触发：启动后、退出后 2.5s、导入后、设置页手动按钮。

### 5.2 主题文案词典

`theme.json` 的 `lexicon.lastPlayed`；DUSK 映射为「上次委托」，切换主题即时重绘。

### 5.3 共享控件令牌

`--menu-*`（下拉）、`--sheet-*`（引擎弹窗）、`--mode-*`（算法卡片）、
`--af-*`（取景浮层）、`--hs-*`（全屏缩放行）、`--accent-text`（可读强调色）。

### 5.4 启动界面

只允许 Esc（手柄 B）退出；点击 / A / Enter / 空格都不关闭。

### 5.5 首页主视觉取景

- 共享 `.scene > img` 由 `applyHeroFraming` 直接设置；
- 主题自绘 `--nova-hero` 必须消费 `--nova-hero-position` / `--nova-hero-size`；
- 编辑器用 `--hero-frame-ratio` 显示真实裁剪窗（默认 16:9、DUSK 16:10、
  NIGHTFLIGHT 1:1、GRIMOIRE 3:4）。

---

## 6. 当前主题表

| 主题 | 版本 | 状态 | 切换 |
| --- | --- | --- | --- |
| nova（内置） | 2.0.1 | 保留区 | 双幕布 |
| aurum | 1.0.15 | 保留区 | 青铜门 |
| endfield | 1.0.14 | 保留区 | 蓝图切角 |
| zerohour | 1.0.15 | 保留区 | 换台滚动 |
| codex | 1.7.8 | 稳定 | 翻页 |
| broadcast | 1.4.8 | 稳定 | CRT |
| summer | 1.8.12 | 稳定 | 白纸排版 |
| riso | 1.4.9 | 稳定 | 双印版 |
| riot | 1.5.10 | 稳定 | 舞台幕布 |
| grimoire | 1.5.10 | 稳定 | 羊皮纸 + 蜡封 |
| mnemo | 1.1.12 | 稳定 | 记忆条带 |
| dusk | 2.0.10 | 重做完成 | 信封拆开 |
| steam | 2.0.10 | 重做完成 | tile 放大 |
| nightflight | 1.0.11 | 新主题 | 登机口关闭（重做） |

> 改过 CSS 的主题都已 bump；`nova` 走共享规则。

---

## 7. 验证记录

| 项 | 结果 |
| --- | --- |
| 静态对比度 | 14 主题 × 16 界面，**0 solid-background 失败** |
| 悬停/聚焦对比度 | 14 主题 × 3 视图 × hover/focus，**0 失败** |
| 布局 | 7 主题 × 4 视图 × 2 尺寸 = 56 张，**0 裁剪 / 0 溢出** |
| 引擎弹窗 | 算法行显示效果链；光标默认跟随画面；帧率留空显示「无上限」 |
| 单 exe 首启 | 空目录启动；首次解压 assets + loader + 引擎；二次不重复 |
| 单 exe 引擎 | `magpieStatus` → `bundled:true`；能拉起、能关闭 |
| 单 exe 资源 | 14 主题、0 坏图、0 加载失败样式表 |
| legacy 构建 | net48 通过（已移除 C# 8 range 语法） |
| 流水线 | `release.sh --version 1.14.4 --publish` 一次跑通并发布 |

QA 产物（仓库外）：

- `../_shots/contrast/contrast.json`
- `../_shots/contrast-hover/hover.json`
- `../_shots/export/`
- `../_shots/release/1.14.4/pipeline.log`

---

## 8. 下一轮 P0（按顺序）

### P0-1 · Steam 全流程（唯一真正的阻塞项）

1. 登录 Steam，确认 设置 → 系统与兼容性 → Steam 权限 显示**普通权限**；
2. SteamStub 游戏与普通 Steam 游戏各跑一遍：未登录冷启动、登录后启动、
   进程出现计时、退出结算；
3. `launchMode` 三种模式各验一次；
4. 确认启动时**没有任何 UAC 弹窗**；
5. 确认退出后 2.5s 的 `playtime-synced` 把 Steam 新时长带回 UI。

### P0-2 · 缩放引擎真机（另一台没有 Magpie 的机器）

- 用 **1.14.4 单 exe** 跑：首次解压、自动拉起、隐藏主窗、快捷键触发、
  游戏退出后自动关闭；
- 重点验 1.14.0 的改动：光标「跟随画面」、帧率留空=无上限、
  「像素缩放」在像素游戏上的实际表现；
- 验证 `--lite` 缺效果时置灰，并跑一次 FSR。

### P0-3 · Win7 / WebView2 109

- Win7 SP1 x64 + .NET 4.8 + WebView2 109：解压 `legacy-single`，验证启动 / 扫描 /
  计时 / 设置 / 导入导出 / 托盘 / 安全档；
- Magpie 需要 Win10 1903+，Win7 上确认自动回退无边框且不报错。

### P0-4 · 全主题回归

```bash
bash tools/release.sh --audit          # 静态 + hover + 全视图截图
node tools/export-all.js --themes=all --views=all --sizes=1439x1124,960x600 --stress
```

- 手柄回归：Xbox 与 DualSense 各接一次。

### P0-5 · 演示素材隔离（基础设施已有，流程未落地）

`NOVA_DATA_ROOT` 已经可用，缺的是流程：

```bash
NOVA_DATA_ROOT="D:/tmp/guguova-demo" NOVA_CDP_PORT=9333 ./GUGUOVA-1.14.4-single.exe
```

- 用这个实例做截图 / README 配图 / 演示库；
- **永远不要把玩家真实库当素材**；
- 可以顺手补 `tools/demo-library.py seed|restore`。

---

## 9. 下一轮 P1 / P2

### P1

- **音频听感**：逐主题试听 16 个 cue。
- **README**：截图仍是 1.9.0 的，且发布说明还写着 `pipeline.sh`。
- **Steam 时长边界**：离线模式、家庭共享多账号、Steam 运行中同步的滞后。
- **Magpie profile `autoScale`**：把「全屏缩放」映射成按 exe 自动缩放。
- **全屏缩放宽高比**：4:3 游戏加「保持比例（黑边）」。
- **`audit-hover` 视图扩展**：把 library / engine / appearance 纳入默认集。
- **`pipeline.sh` 收编**：`release.sh` 已覆盖它，可标注为 legacy 或删除。

### P2

- 可选效果包（Anime4K / CuNNy / RAVU / NNEDI3 / CRT / xBRZ）。
- 归档 `docs/HANDOFF.md`、`docs/THEMES.md`（仍在用 1.8.0 的叙事）。
- 清理 `tools/_*.tmp.js` 调试残留。

---

## 10. 关键文件地图

| 需求 | 位置 |
| --- | --- |
| 主题清单 / 样式 | `themes/<id>/theme.json` / `theme.css` |
| 共享控件令牌 | `src/app.css`：`.nova-select` / `.engine-shell` / `.engine-mode-row` / `.hero-scale` / `.appearance-framing` / `--accent-text` |
| 文字基线 | `src/base.css`、`src/type.css` |
| 主题切换幕布 | `src/motion.css` + `src/app.js` `CURTAIN_HOLD` |
| 启动退出 | `src/app.js` `bindKeyboard` / `closeLaunch` / pad `back()` |
| 主题文案 | `theme.json.lexicon` + `src/app.js` `themeWord` |
| 首页取景 | `src/app.js` `publishHeroVar` / `applyHeroFraming` / `layoutAppearanceCrop` |
| 数据根 / 隔离 | `Services/StoreService.cs` `AppPaths`（`NOVA_DATA_ROOT`） |
| 单实例锁 | `App.xaml.cs`（按 profile 派生后缀） |
| Steam 时长 | `Services/SteamPlaytime.cs`、`StoreService.SyncSteamPlaytime` |
| 缩放引擎选项 | `Services/ScalingEngine.cs`（`EngineOptions` / `ReadOptions` / `SaveOptions`） |
| 单 exe 引擎解压 | `Services/EngineBootstrapper.cs`、`ScalingEngine.BundledDirOverride` |
| 引擎打包 | `tools/pack-engine.py`、legacy csproj 的 `NOVA.Engine.zip` |
| 发版流水线 | `tools/release.sh` |
| 发布闸门 | `tools/verify-release.py` |
| 单 exe 冒烟 | `tools/smoke-single.py` |
| GitHub 发布 | `tools/publish-release.py` |
| 静态对比度审计 | `tools/audit-contrast.js` |
| 悬停对比度审计 | `tools/audit-hover.js` |
| 截图 / 布局审计 | `tools/export-all.js` |
| 重载开发 | `tools/relaunch.sh` |
| 完整设计规范 | `docs/THEME-DESIGN-SPEC.md` |
| 可复用 skill | `.agents/skills/guguova-theme-design/SKILL.md` |

---

## 11. 绝对不要回退的约定

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
16. 技术标识（程序集命名空间、`NOVA Game Space`、`NOVA_*`、主题 id `nova`）不跟随品牌改名。

### 文字与控件

17. **正文 / 小字 ≥ 4.5:1，大字 ≥ 3:1**；静态与 hover/focus 两条审计都要 0 失败。
18. **accent 只做标记，不做小字**；文字用 `--accent-text` 或墨色。
19. **共享控件令牌必须齐全**：`--menu-*` / `--sheet-*` / `--mode-*` / `--af-*` /
    `--hs-*` / `--accent-text`。
20. **新增控件必须一次适配 14 套主题**；禁止系统原生 select / 消息框 / 文件框。
21. **算法行**是每主题独立选择卡；缺效果用虚线框 + 删除线，不用整体半透明。
22. **取景浮层必须不透明**；渐变面板补 `--af-solid`。
23. **主题用 `!important` 给 `.icon-btn` 上色时**，浅色弹窗必须用更高特异性覆盖。
24. **`.btn::before` 扫光层必须 `z-index: -1`**，否则纯文本按钮 hover 会变白块；
    改动后必须跑 `tools/audit-hover.js`。
25. **方形图标按钮**（`.icon-btn.square`）在浅色弹窗里必须显式给 rest/hover 前景。
26. **不要用 `opacity` 压字色**；父级与子级会相乘，小字直接掉到 4:1 以下。

### 启动 / 数据

27. **启动器等游戏窗口出现并置前后才最小化**；
28. **用户可见的名字一律 GUGUOVA**；
29. **Steam 启动走 `steam.exe -applaunch`**；提权修复只删 `RUNASADMIN`；
30. **Magpie 快捷键按位域解码**（默认 3137），可随包分发但必须独立进程 + GPLv3；
31. 全屏缩放**先看游戏自己的选择**；`scalingEngine=off` 时不得偷偷缩放；
    **自动启动引擎默认关**，只有玩家打开才拉起；
32. 外观取景编辑**只写 `HeroPosition` / `HeroZoom`**；
33. **启动界面只能 Esc 退出**（手柄 B 等价）；
34. **Steam 时长只取 max，不相加**；
35. **QA 工具切主题必须 `persist:false`**；
36. **改主题 CSS 必须 bump `theme.json` 的 version**；
37. **夜航游戏库宽屏 4 列、短窗 2 列**；
38. **主题自绘主视觉必须消费 `--nova-hero-position` / `--nova-hero-size`**；
39. **`#questCard` 默认隐藏是产品决定**；恢复活动通知时去掉 `hidden`。

### 构建 / 发布

40. **legacy (net48) 不支持 C# 8 的 range / index 语法**（`x[..n]`、`x[^1]`）；
    共享代码用 `Substring` / 显式下标，否则打包会失败。
41. **Magpie 永远独立进程**：内嵌只打包成 zip，解压后再 `Process.Start`；
    不得改成 in-process 引用，也不要删随包的 `NOTICE.md` / `SOURCE-OFFER.txt`。
42. **单 exe 的解压目录必须带 `.complete` 标记**，否则每次启动都重解压 4.7 MB。
43. **文件夹包优先于内嵌**：`engine\magpie\` 在 exe 旁边时必须直接用它。
44. **发版必须走 `tools/release.sh`**，不要手工 build + zip + curl。
45. **改过数据层代码要跑 `smoke-single.py`**：它用独立 `NOVA_DATA_ROOT` 从零首启。
46. **`NOVA_DATA_ROOT` 会切换单实例锁**；测试脚本不要假设只有一个进程。

---

## 12. 快速命令

```bash
cd nova-game-space-desktop

./tools/relaunch.sh                        # 构建 + 同步主题 + 启动（CDP 9223）

node tools/audit-contrast.js               # 静态对比度（14 × 16）
node tools/audit-hover.js                  # 悬停/聚焦对比度（14 × 3）
node tools/export-all.js --views=all --sizes=1439x1124,960x600 --stress

node tools/drive.js "return await window.nova.call('engineOptions');"
node tools/drive.js "return await window.nova.call('syncSteamPlaytime');"

bash tools/release.sh --version 1.15.0             # 构建 + 校验 + 冒烟
bash tools/release.sh --version 1.15.0 --publish   # 再加 GitHub Release
bash tools/release.sh --audit                      # 额外跑 UI 审计

# 排障时单独跑：
python tools/verify-release.py
python tools/smoke-single.py
python tools/publish-release.py --dry-run

# 隔离数据根（演示 / 截图 / 冒烟）
NOVA_DATA_ROOT="D:/tmp/guguova-test" NOVA_CDP_PORT=9333 ./GUGUOVA-1.14.4-single.exe
```

Git / PR：`gh` 未安装；用 credential manager 的 token 走 GitHub API 建 PR / 合并 / 发 Release。

---

## 13. 已知限制与风险

- **Steam 提权修复会重启客户端**：本机实测重启后停在登录界面（ActiveUser=0）。
- **Steam 时长是分钟粒度**：刚启动 / 刚退出的几分钟可能滞后。
- **全屏缩放只对窗口化游戏有效**；原生无边框会拉伸到显示器比例，4:3 会变形。
- **Magpie 需要 Win10 1903+**：Win7/8 上自动走无边框。
- **Magpie profile `autoScale` 未接入**：仍是“按一次快捷键”。
- **Store 版应用的转发 exe** 只能记录转发进程。
- **Steam 封面依赖客户端缓存**；**`DeveloperOnly` 会在启动时按 exe 路径重算**。
- **改 `library.json` 前必须先关应用**。
- **WebView2 偶发 GpuProcessExited**：换 `NOVA_CACHE_ROOT` 或加 `--disable-gpu`。
- **页面被最小化时 `document.timeline` 会冻结**：此时读到的 CSS 颜色可能是过渡起始帧
  （1.14.0 排查时因此误判过）。做颜色验证前确认
  `document.visibilityState === 'visible'` 且 `document.timeline.currentTime > 0`。
- **`audit-hover.js` 只覆盖 home / settings / detail**；其余视图需 `--views=` 显式指定。
- **对比度工具只合成 `background-color`**；伪元素纸面标为 `layered`，需人眼复核。
- **单 exe 首次启动要在数据目录解压约 12 MB**（assets 3.3 + 引擎 4.7 + loader）；
  杀毒软件首次扫描可能让启动慢几秒。
- **单 exe 无法内置 .NET Framework 4.8 与 WebView2 Runtime**。
- **`pipeline.sh` 与 `release.sh` 并存**：前者是旧入口，仍可用但没有 verify/smoke 闸门。
- 本轮未在 Win7、真实 Steam 登录态、另一台无 Magpie 机器上验证。

---

## 14. 历史与 PR

| 版本 | 内容 |
| --- | --- |
| 1.9.0 | DUSK / STEAM / NIGHTFLIGHT 三套主题重做；16 个音效重合成 |
| 1.10.0 | Steam 提权修复、窗口置前、启动器退场、全屏缩放 |
| 1.11.0 | 内置轻量 Magpie、快捷键录制、简化引擎弹窗、`.nova-select` |
| 1.12.0 | Steam 封面取原图（按分辨率挑选 + 只降不升） |
| 1.13.0 | Steam 时长同步、主题文案词典、全主题控件/文字精修、夜航幕布、Esc-only 启动退出、设计规范 + skill |
| 1.14.0 | 缩放引擎选项对齐 Magpie、文案清理、hover/focus 白块与图标修复、`audit-hover` |
| 1.14.1 | 单文件 exe：内嵌主题、前端资源与 Magpie 引擎 |
| **1.14.4** | 流水线式打包：`release.sh` + verify + smoke + publish；`NOVA_DATA_ROOT` |

PR / 提交：

- `6652f09` docs: 1.14.4 交接说明
- `1c6f095` feat: 流水线式打包与发布工具链 — **PR #26，已合并**
- `0d2cfe5` feat: 单文件 exe 发行版 — PR #25，已合并
- `de2125c` docs: 1.14.1 交接说明
- `15f2690` fix: legacy net48 移除 C# 8 range 语法
- `ea7adef` feat: 1.14.0 — PR #24，已合并
- `96afdf1` feat: 1.13.0 — PR #23，已合并
- `3a27ae3` Merge PR #22（1.12.0）

Release：**v1.14.4**（single.exe / legacy-single / legacy-full）。

---

## 15. 交接清单

- [x] 应用 1.14.4 构建通过；
- [x] 14 套主题已同步到 `%LOCALAPPDATA%\NOVA Game Space\themes`；
- [x] 静态对比度 0 失败；悬停/聚焦对比度 0 失败；
- [x] 56 张布局截图 0 裁剪 / 0 溢出；
- [x] 单文件 exe 空目录首启通过（主题 + 引擎解压、引擎可拉起/关闭）；
- [x] 流水线 `release.sh --version 1.14.4 --publish` 一次跑通；
- [x] v1.14.4 三个资源已上传 Release；
- [x] `NOVA_DATA_ROOT` 可用，单实例锁按 profile 分离；
- [ ] Steam 登录态全流程；
- [ ] 另一台无 Magpie 机器的引擎真机验证；
- [ ] Win7 + WebView2 109 验证；
- [ ] 演示素材改用隔离数据根（工具已有，流程未落地）。

下一轮从 **§8 P0-1（Steam 全流程）** 开始。
