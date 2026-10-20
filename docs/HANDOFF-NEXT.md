# GUGUOVA 下一轮交接文档

> 交接版本：**1.6.9**
> 交接时间：2026-10-20
> 当前 `main`：`439afb7`（PR #17 / #18 / #19 已合并）
> 工作区：干净
> 产物：`dist/` **仍是 1.5.3 的 NOVA-\* 包**，1.6.9 尚未重新打包

---

## 1. 一句话状态

1.6.0–1.6.9 把三件事做完了：**Steam 游戏改为客户端启动**、**每套主题一整套音效**、
**品牌改名 GUGUOVA**，并重做了终末地与零点街区的开屏、零点街区的切换动画。

剩下的是**验收与打包**：Win7 真机、物理手柄、1.6.9 全界面回归与重新打包。

---

## 2. 先读什么

1. **`docs/DESIGN-PHILOSOPHY.md`** —— 六条硬规则、11 套主题、音效与动画约定。改主题前必读。
2. 本文 —— 当前版本、已完成、待办与验收命令。
3. `docs/THEME-INTERFACES.md` —— 主题清单、变量、选择器、切换编舞、字体契约。
4. `docs/STEAM-LAUNCH.md` —— Steam 启动接管、认证边界、Steam++ 对照结论。
5. `docs/SFX-MAP.md` + `docs/SFX-BRIEF.md` —— 音效触发映射与生成需求。
6. `docs/HANDOFF-THEMES.md` §0.00d —— 主题层最近一轮细节。
7. `docs/themes/<id>.md` —— 单主题接口卡（含本轮新增的字体、等高线、导航选中态、音效材料）。

---

## 3. 版本基线

应用：**1.6.9**（`version.json` 是唯一版本源）；品牌：**GUGUOVA**。

| 主题 | 版本 | 开屏 | 音效 | 切换 |
| --- | --- | --- | --- | --- |
| nova（内置，id 不变） | 2.0.0 | `gilded` | 16 | 双幕布 |
| aurum | 1.0.13 | `aurum` | 16 | 青铜门 |
| endfield | 1.0.9 | `endfield`（纸面启动台 v2） | 16 | 蓝图切角 |
| zerohour | 1.0.12 | `zerohour`（CRT→漫画） | 16 | **换台滚动 v2** |
| codex | 1.7.5 | `codex` | 16 | 翻页 |
| broadcast | 1.4.6 | `broadcast` | 16 | CRT |
| summer | 1.8.7 | `draft` | 16 | 白纸排版 |
| riso | 1.4.5 | `riso` | 16 | 双印版 |
| riot | 1.5.7 | `vinyl` | 16 | 舞台幕布 |
| grimoire | 1.5.6 | `seal` | 16 | 羊皮纸 + 蜡封 |
| mnemo | 1.1.7 | `mnemo` | 16 | 记忆条带 |

主题 id、程序集名、AppData 目录仍是 `nova` / `NovaGameSpace` —— 这是**故意保留**的兼容标识，
只有用户可见文案改成了 GUGUOVA。

---

## 4. 本轮完成（1.6.0 → 1.6.9）

### 4.1 Steam 启动接管（1.6.0）

- Steam 库游戏走 `steam://rungameid/<appid>`，由客户端负责认证/覆盖层/云存档；
- 唤起在**后台线程**，返回 `pending`，会话等真实进程出现后登记（登录、更新不再冻结 UI）；
- PE 级诊断（`steam_api` 导入、`.bind` SteamStub）在管理面板解释「为什么打不开」；
- `launchMode`：`auto` / `steam` / `direct`，写入 `library.json`。

### 4.2 每套主题的全套音效（1.6.1–1.6.6）

- 11 套主题各 **16 个 cue**（`bong/click/nav/soft/select/confirm/error/tick/chime/deep/
  launchRise/launchFall/switch/launch/exit/boot`），材料按主题卡设计，genny 合成；
- `boot` 是按该主题开屏关键帧排好的序列，与动画同时启动；
- 设置 →「使用默认统一音效」（`unifiedSfx`）可整体回落到 `src/assets/sfx/`；
- 主题右键（追加在原菜单后）可**预览该主题启动动画**，不切换主题；
- 雪花噪收敛：仅保留在切换/失败/开屏底噪；全部 176 个 cue `sharp ≤ 1.87`、`above5k ≤ 1.8%`。

### 4.3 开屏与切换（1.6.5–1.6.9）

- **终末地**按 `endfield-ui` skill 重做：纸白 + 网格、三色顶带、白色直角面板、
  Saira 宽体拉丁（`src/assets/fonts/Saira.ttf`，OFL 1.1）、双角等高线、45° 斜线柱、
  空心真实计数、无投影/渐变；跳过提示移到页脚下方纸面留白。
- **零点街区**开屏：CRT 通电 → 彩条噪点 → 漫画分镜 → 酸柠字幕带。
- **零点街区切换**：换台/垂直滚动——扫描线黑板自下卷起 + 酸柠跟踪带，落定 RGB 错位，上卷退场。
- 零点街区整组音效重置为模拟向（去掉方波 chirp 与雪花噪）。

### 4.4 品牌与界面（1.6.7–1.6.9）

- 用户可见文案统一 **GUGUOVA**；七字母字标收敛字距/字号，无横向溢出；
- 浅色主题菜单行 `row-value` 与图标对比度修复，`.row-chevron` 跟随行颜色；
- 圣所导航选中态改为直角双层金线框 + 青玉菱形；
- 主题卡片说明改用应用内 `.theme-tip`（复用右键菜单材质），不再用系统 `title`；
- 终末地预设下隐藏共享星盘舞台（`.intro-stage` 等），只改颜色会漏出默认时钟。

---

## 5. 关键实现位置

| 功能 | 文件 |
| --- | --- |
| Steam 启动 / 诊断 | `Services/SteamService.cs`、`Services/LauncherService.cs` `LaunchThroughSteam` |
| Steam 状态接口 | `NativeBridge.cs` `steamStatus`；UI `src/app.js` `fillSteamPanel`/`setLaunchMode` |
| 主题音效加载 | `src/app.js` `audio.warmTheme/playPreviewBoot/hasThemeCue` |
| 主题音效清单 | `themes/<id>/theme.json` `sounds`；`Services/ThemeService.cs` `ResolveSounds` |
| 音效生成 | `tools/sfx-specs/build-themes.py` → `genny render` → ffmpeg 转 OGG |
| 开屏 | `src/intro.js`（`ensureEndfieldStage`/`ensureZeroHourStage`）+ `src/intro.css` |
| 切换幕布 | `src/motion.css` `[data-variant="zerohour"]` 段；`src/app.js` `playThemeCurtain` |
| 主题卡片浮窗 | `src/app.js` `showThemeTip` + `.theme-tip`（`src/app.css`） |
| 截图/审计 | `tools/export-all.js`、`tools/render-concepts.js` |

---

## 6. 验证记录

- `dotnet build`（modern）与 `legacy` 的 net48 构建：**0 错误**（每轮均复验）。
- 176 个主题音效全部通过 WebView2 `decodeAudioData`。
- 开屏：终末地无星盘残留、跳过提示在页脚下方；零点街区 CRT 分镜独立于终末地。
- 切换：零点街区换台动画截图确认（扫描线场 + 酸柠顶边 + RGB 错位标题）。
- 11 套主题菜单悬停对比度实测；圣所选中态、主题卡片浮窗材质截图确认。
- 品牌：标题/顶栏/启动/睡眠均为 GUGUOVA，页面无横向滚动。

**尚未做：**

- **1.6.9 打包**：`dist/` 仍是 1.5.3 的 `NOVA-*`，脚本已改前缀但未运行。
- **Win7 SP1 + .NET 4.8 + WebView2 109 真机验收**（1.5.3 起一直欠着）。
- **物理 Xbox / DualSense 验收**（此前只用 `NovaPad.press()` 模拟）。
- **Steam 全流程**：进程出现后的计时/退出、未登录冷启动超时文案、SteamStub 游戏直接启动。
- **主题预览缩略图**：11 张 `assets/preview.jpg` 里仍印着 NOVA，未重生成。
- **音频实机听感**：未在扬声器/耳机上逐主题试听，只做了客观指标与解码验证。

---

## 7. 下一轮待办（按优先级）

### P0 · 打包 1.6.9

```bash
bash tools/pipeline.sh --version 1.6.9
```

确认：产物名为 `GUGUOVA-1.6.9-*`、`release-manifest.json` 更新、
单文件包在**没有 `src/themes` 的干净目录**能启动、头像/备份/CSV 正常。

### P0 · Win7 真机

1. Win7 SP1 x64 虚拟机 + .NET Framework 4.8（Release ≥ 528040）；
2. 使用 WebView2 109 固定运行时（`WebView2Runtime/`）；
3. 解压 legacy-single，运行 `launch.cmd`；
4. 验证：启动、扫描、启动游戏/计时、设置、导入导出、主题切换、托盘、安全档；
5. 记录到 `docs/COMPATIBILITY.md` §4.3。

### P0 · 物理手柄

Xbox 与 DualSense 各接一次；验证焦点环、方向键/摇杆重复、A/B、LB/RB、RS/LS、
`select` 档位循环，以及设置/外观/库/详情/管理/对话框/文件选择器全部可达。

### P1 · 预览图重生成（品牌收口）

主题卡片缩略图仍写着 NOVA。用 `tools/render-concepts.js` 重出 11 张，
缩到 960×540 JPG，然后 bump 对应 `theme.json` 的 version（预览 URL 带版本）。

### P1 · 全界面回归

```bash
node tools/export-all.js --views=all --sizes=1439x1124,960x600 --stress
node tools/probe-graphics.js
```

重点：设置、外观、详情、启动、对话框、选择器、系统模式、30 字长名，
以及 GUGUOVA 七字母字标在各主题下的宽度。

### P1 · 音频实机听感

逐主题试听 `click/nav/soft/select/confirm/error/tick`，重点确认：

- 零点街区是否仍有偏亮的 cue；
- 夜间广播的 `switch`（雪花噪）在耳机下是否可接受；
- 各主题 `boot` 与动画的观感是否同步（关键帧已对齐，听感需人耳确认）。

### P2 · 可选

- 其余主题的切换动画可参考零点街区的做法（与各自开屏区分，但同语言）；
- 若决定把 AppData 目录也改成 GUGUOVA，需要写迁移（旧库 → 新目录）；
- `docs/HANDOFF.md`、`THEMES.md` 等旧文档仍用 NOVA 叙述，可择机收口。

---

## 8. 绝对不要回退的约定

1. `html.is-nova-system` 的外观/面板规则必须限定在 `html[data-theme="nova"]`；
2. ZERO HOUR 主色青柠 `#c6ff2e`、次色青蓝 `#59e3ff`，黄色只给注意/警示；
3. ZERO HOUR 切换不再出现黄色字；开屏与切换必须是两种不同的 CRT 行为；
4. SUMMER 不往角色脸上压黑色帆船/伞骨线稿；缩略图保持线稿版式；
5. `fit-content` 标题的可用宽度取父级文字列，不要取自身；
6. 不给 `.logo` 的 `letter-spacing` 做过渡；
7. 幕布第一次切换先画初始态再启动；
8. 主题顺序前四固定：GUGUOVA → 终末地 → 零点街区 → 秘典；
9. 全屏层禁用 `filter` / `backdrop-filter`；只动 transform/clip-path/opacity；
10. 缓存及时清理且不落 C 盘；
11. `steam://` 唤起必须留在后台线程；Steam 启动返回 `pending`，会话只在找到真实进程后登记；
12. `Detect()` 只读注册表，不在 boot payload 路径上枚举进程；
13. 不引入 `steam_api.dll` 模拟器（Goldberg 等）绕过客户端校验；
14. 主题音效**替代**统一音效，不叠加；`boot` 与开屏同时启动，跳过时淡出；
15. 音效 URL 必须带 `?v=<主题版本>`，改音效后 bump `theme.json` 的 version，否则 WebView 用缓存；
16. **雪花噪/白噪声只用于切换/失败/开屏底噪**，点击与悬停一律用实体材料；
17. 不出现系统原生控件：主题卡片说明用 `.theme-tip`，不用 `title`；不用系统消息框/文件选择器；
18. 自定义开屏舞台必须显式隐藏共享 `.intro-stage` / `.intro-corners` / `.intro-grain`；
19. 终末地开屏遵循 `endfield-ui`：纸白底、单一酸黄填充、直角、细线、真实数字、无投影/渐变；
20. 技术标识（程序集、AppData、`NOVA_DEV`/`NOVA_CACHE_ROOT`、主题 id `nova`）不要跟随品牌改名。

---

## 9. 快速启动 / 验证命令

```bash
cd nova-game-space-desktop

# 开发运行（E: 缓存，CDP 9223），会同步 themes/ 到用户目录
./tools/relaunch.sh

# 只重启，不同步主题
./tools/relaunch.sh --no-sync

# 完整审计
node tools/export-all.js --views=all --sizes=1439x1124,960x600 --stress
node tools/probe-graphics.js

# 打包（1.6.9）
bash tools/pipeline.sh --version 1.6.9

# 版本号（唯一源）
node tools/bump-version.js 1.6.10

# 重新生成某套主题的音效
cd tools/sfx-specs && python build-themes.py     # 产出 themes-all.json
genny render themes-all.json                     # 需要 genny（uv tool）
ffmpeg -i <cue>.wav -c:a libvorbis -q:a 5 -ac 1 <cue>.ogg
```

> 改主题 CSS：bump `theme.json` patch → `relaunch.sh`（同步）→ 重启。
> 改音效：重新渲染 → 转 OGG → **bump `theme.json` version**（缓存）。
> 改预览图：`render-concepts.js <out> --only=<id>` → 缩到 960×540 JPG → bump 主题版本。

---

## 10. 已知限制与风险

- **品牌只改了可见文案**：可执行文件仍叫 `NovaGameSpace.exe`，数据仍在
  `%LOCALAPPDATA%\NOVA Game Space`。改这两处需要迁移，不要顺手改。
- **预览缩略图仍印 NOVA**（图片，不是文字），需要重跑渲染脚本。
- **Steam 边界**：不带客户端时只能启动本身不依赖 Steam 运行时的游戏；
  SteamStub / `steam_api` 游戏必须由客户端启动，这是正版校验，不做绕过。
- **genny 依赖**：音效再生成需要 Python 3.10+、uv、numpy/scipy 与 ffmpeg；
  规格与命令已存档，环境缺失时直接复用现有 OGG。
- **Saira 只服务终末地开屏**，其他主题不得依赖；字体缺失必须回落思源黑体。
- **`docs/HANDOFF.md` / `THEMES.md` 等旧文档仍是 NOVA 叙述**，与 1.6.9 不完全一致。

---

## 11. PR 历史（本轮）

- **#17** `feat: Steam 启动接管 / 每主题全套音效 / 开屏重做`（squash `53b2e32`）
- **#18** `fix: 主题卡片浮窗跟随主题 / 终末地开屏移除默认星盘`（squash `fd7491b`）
- **#19** `feat: 启动器改名 GUGUOVA / 零点街区换台切换动画`（squash `439afb7`）

下一轮从 **P0 打包 + Win7 / 物理手柄** 开始即可。
