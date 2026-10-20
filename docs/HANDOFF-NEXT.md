# GUGUOVA 下一轮交接文档

> 交接版本：**1.8.0**
> 交接时间：2026-10-20
> 本轮内容：新增第 12 套「黄昏之炼」与第 13 套「Steam 经典」、重做全部缩略图与仓库截图、README 重写为玩家向
> 产物：`GUGUOVA-1.8.0-legacy-single.zip` / `-full.zip`，发布为 GitHub Release **v1.8.0**

---

## 1. 一句话状态

1.7.0 做完了四件事：**新增黄昏之炼主题**（CSS / 开屏 / 进游戏 / 幕布 / 16 个音效 / 设计规范）、
**12 套主题缩略图统一重画并去 NOVA 残留**、**仓库截图全部换成排版式虚构封面**、
**README 改成玩家能直接看懂的人话**。

剩下的是验收与真机测试：Win7、物理手柄、Steam 全流程、音频听感。

---

## 2. 先读什么

1. **`docs/DESIGN-PHILOSOPHY.md`** —— 六条硬规则、12 套主题卡、音效与动画约定。
2. 本文 —— 版本、本轮改动、待办与验收命令。
3. `themes/dusk/DESIGN.md` —— 黄昏之炼的完整设计规范（含参考来源、色板、三套动画、音效配方、禁忌）。
4. `docs/THEME-INTERFACES.md` —— 主题清单、变量、选择器、切换编舞、字体契约。
5. `docs/STEAM-LAUNCH.md`、`docs/SFX-MAP.md`、`docs/SFX-BRIEF.md`。
6. `docs/themes/<id>.md` —— 单主题接口卡（本轮新增 `dusk.md`）。

---

## 3. 版本基线

应用：**1.7.0**（`version.json` 是唯一版本源）；品牌：**GUGUOVA**。

| 主题 | 版本 | 开屏 | 音效 | 切换 |
| --- | --- | --- | --- | --- |
| nova（内置，id 不变） | 2.0.1 | `gilded` | 16 | 双幕布 |
| aurum | 1.0.14 | `aurum` | 16 | 青铜门 |
| endfield | 1.0.10 | `endfield` | 16 | 蓝图切角 |
| zerohour | 1.0.13 | `zerohour` | 16 | 换台滚动 |
| codex | 1.7.6 | `codex` | 16 | 翻页 |
| broadcast | 1.4.7 | `broadcast` | 16 | CRT |
| summer | 1.8.8 | `draft` | 16 | 白纸排版 |
| riso | 1.4.6 | `riso` | 16 | 双印版 |
| riot | 1.5.8 | `vinyl` | 16 | 舞台幕布 |
| grimoire | 1.5.7 | `seal` | 16 | 羊皮纸 + 蜡封 |
| mnemo | 1.1.8 | `mnemo` | 16 | 记忆条带 |
| dusk | 1.0.2 | `dusk` | 16 | 暮色合拢 |
| **steam（新增）** | **1.0.2** | `steam` | 16 | 窗口推开 |

主题 id、程序集名、AppData 目录仍是 `nova` / `NovaGameSpace` —— 兼容标识，只有用户可见文案是 GUGUOVA。

---

## 4. 本轮完成（1.7.0）

### 4.1 黄昏之炼（新主题）

- **设计**：Gust《黄昏》系列的水彩黄昏 + 调和界面。上半幅暮色天空（靛蓝 → 玫瑰 → 琥珀 + 低垂太阳），
  下半幅羊皮配方纸（ledger 横线、装订孔、竖排书脊），左列账目、右栏封面取样 + 四元素刻度。
  完整规范与来源见 `themes/dusk/DESIGN.md`，接口卡见 `docs/themes/dusk.md`。
- **构图与既往 11 套都不同**：不用 theme-kit 的 plate；纸页是横向的，封面只是右栏一张贴纸。
- **开屏 `dusk`（2600ms）**：天空压下 → 太阳升起 → 地平线画出 → 炼金环描线 →
  「黄昏 / 之炼」两行升起 → 台账打印真实日期/时刻/藏本数；舞台 `.intro-dk` 已加入 `STAGE_SELECTOR`。
- **进游戏 `dlDusk`**：画面中心偏下的圆形光斑扩散 + 从暗部回到正常亮度，无缩放弹跳、无模糊。
- **切换幕布**：天空与纸页沿斜缝合拢（`clip-path` 斜边）+ 虚线炼金环；`CURTAIN_HOLD.dusk = 460`。
- **音效 16 个**：陶铃、木、纸、玻璃瓶、低音弦，脚本合成（`tools/sfx-specs/make-dusk-sfx.py`），
  只有 `switch` 用一层低通到 2.6kHz 的风声；实测 >5kHz 能量比满量程低 15–23dB。
- **设置页身份卡**：配方台账卡，左侧 4px 陶土书脊条、双层白线内框、圆形陶土印章头像。

### 4.1b Steam 经典（第二套新主题）

- 参考 2010 年代 Steam 桌面客户端的视觉体系（不是 Big Picture / Steam Deck），不使用 Valve 素材。
- **构图**：客户端窗口。36px 标题栏写「库 · 本机游戏 · 离线模式」，通栏 16:9 头图，
  下面是名称 / 一句话 / 属性 / 绿色主按钮 / 下载条式进度，右栏是「库快捷入口」。
- **开屏 `steam`（2500ms）**：窗口升起 → 进度条 → 三个真实步骤点亮 → 状态变「库已就绪」。
- **进游戏 `stMax`**：窗口最大化（94% → 100% + 亮度恢复）。
- **切换幕布**：非对称双面板（26.5% 侧栏 + 74% 主面板）横向合拢，竖蓝缝 + 绿色标签条。
- **音效 16 个**：塑料键、滚轮格、低频嗡鸣、短数字提示；`switch` 用低通风声。
- 完整规范：`themes/steam/DESIGN.md`；接口卡：`docs/themes/steam.md`。

### 4.2 缩略图与品牌收口

- `tools/theme-concepts.html` 新增 `dusk` 概念板，并把所有 `NOVA THEME` 眉标改为 `GUGUOVA THEME`；
  内置主题板的主字标从 `NOVA` 改为 `GUGUOVA`（字号 84px，保证不压右侧字体样张）。
- 12 张 `preview.jpg` 全部用 `render-concepts.js` 重出，缩到 960×540；每个 `theme.json` 已 bump 版本。
- 内置主题预览的查询版本改为 `?v=1.7.0`（`Services/ThemeService.cs`）。

### 4.3 仓库图形改成排版式虚构封面

- 缓存/截图里的真实游戏素材全部移除。示例库的 6 款游戏都是虚构条目，封面由
  `tools/demo-covers.py` 用纯排版 + 几何绘制（陶土、靛蓝、钴蓝、紫、暖黄、砖红六套）。
- 每款游戏输出两张：`cover.jpg`（带字，用于游戏条/库卡片）与 `hero.jpg`（无字，用于全屏主视觉）。
  无字版避免「封面上的大字被放大成背景墙」的问题。
- README 的 15 张截图全部重拍；旧的 NOVA 截图已删除。

### 4.4 README 重写

- 面向玩家：下载→解压→加游戏→主题→按键→数据位置→常见问题，全部用短句和具体行为。
- 删掉「不是模拟，是真实启动」这类自我标榜的句式；不写没做过的能力；示例明确标注为虚构。
- 主题表列出 12 套，每套一句话；黄昏之炼单独一段说明构图与三套动画。

---

## 5. 关键实现位置

| 功能 | 文件 |
| --- | --- |
| 黄昏之炼样式（全界面） | `themes/dusk/theme.css`（17 段，末尾是修正层） |
| 黄昏之炼开屏 | `src/intro.js` `ensureDuskStage` + `register('dusk')`；`src/intro.css` 末尾 |
| 黄昏之炼幕布 | `src/motion.css` `[data-variant="dusk"]`；`src/app.js` `CURTAIN_HOLD` |
| 黄昏之炼音效 | `themes/dusk/sounds/*.ogg`；生成脚本 `tools/sfx-specs/make-dusk-sfx.py` |
| 设置页身份卡 | `src/settings-themes.css` 末尾 `DUSK` 段 |
| 主题缩略图 | `tools/theme-concepts.html` + `tools/render-concepts.js` |
| 示例封面 | `tools/demo-covers.py`（cover + 无字 hero 两版） |
| 截图 | `tools/export-all.js`、`tools/shot-intro.js` |

---

## 6. 验证记录

- `dotnet build -c Debug`：0 错误。
- `export-all.js --themes=dusk --views=all --sizes=1439x1124,960x600 --stress`：32 张全部 ok，
  无 `overflow-x` / `clipped` / `logo-text-over`；`--themes=steam` 同样 32 张全部 ok。
- `export-all.js --themes=<12 套> --views=home,library,appearance,settings,detail`：60 张全部 ok。
- 开屏：`shot-intro.js` 三个时间点确认天空、太阳、炼金环、真实台账都到位，2.6s 后正常退场。
- 音效：16 个 OGG 全部可解码；高频占比检查通过。

**尚未做：**

- **Win7 SP1 + .NET 4.8 + WebView2 109 真机验收**（1.5.3 起一直欠着）。
- **物理 Xbox / DualSense 验收**（此前只用 `NovaPad.press()` 模拟）。
- **Steam 全流程**：进程出现后的计时/退出、未登录冷启动超时文案、SteamStub 游戏直接启动。
- **音频实机听感**：黄昏之炼的陶铃与低弦只做了客观指标，没有在扬声器上逐条试听。

---

## 7. 下一轮待办（按优先级）

### P0 · Win7 真机

1. Win7 SP1 x64 虚拟机 + .NET Framework 4.8（Release ≥ 528040）；
2. 使用 WebView2 109 固定运行时（`WebView2Runtime/`）；
3. 解压 legacy-single，运行 `launch.cmd`；
4. 验证：启动、扫描、启动游戏/计时、设置、导入导出、主题切换（含黄昏之炼）、托盘、安全档；
5. 记录到 `docs/COMPATIBILITY.md` §4.3。

### P0 · 物理手柄

Xbox 与 DualSense 各接一次；验证焦点环、方向键/摇杆重复、A/B、LB/RB、RS/LS、
`select` 档位循环，以及设置/外观/库/详情/管理/对话框/文件选择器全部可达。
黄昏之炼新增的纸页布局与右侧取样不参与焦点顺序，确认方向键不会跳进装饰。

### P1 · Steam 全流程

用一款 SteamStub 游戏与一款普通游戏各跑一遍：未登录冷启动、登录后启动、进程出现计时、
退出结算、`launchMode` 三种模式。

### P1 · 音频听感

逐主题试听 `click/nav/soft/select/confirm/error/tick`。黄昏之炼重点听：

- `click` 与 `nav` 在耳机下是否偏尖（木鱼 1.3k / 980Hz）；
- `boot` 的风声与钟声是否与开屏关键帧同步；
- `switch` 的风声在夜间音量下是否可接受。

### P2 · 可选

- 其余主题的切换动画可参考零点街区与黄昏之炼的做法（与各自开屏区分，但同语言）；
- 若决定把 AppData 目录也改成 GUGUOVA，需要写迁移（旧库 → 新目录）；
- `docs/HANDOFF.md`、`THEMES.md` 等旧文档仍在用 NOVA 叙述，可择机收口；
- 示例封面可以再做两套（横向构图 / 纯几何），方便 README 换季。

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
15. 音效 URL 必须带 `?v=<主题版本>`，改音效后 bump `theme.json` 的 version；
16. **雪花噪/白噪声只用于切换/失败/开屏底噪**，点击与悬停一律用实体材料；
17. 不出现系统原生控件：主题卡片说明用 `.theme-tip`，不用 `title`；
18. 自定义开屏舞台必须显式隐藏共享 `.intro-stage` / `.intro-corners` / `.intro-grain`；
19. 终末地开屏遵循 `endfield-ui`：纸白底、单一酸黄填充、直角、细线、真实数字、无投影/渐变；
20. **DUSK 纸面正文一律墨色**，金色/琥珀只能做线与数值；封面取样与纸胶带不得进入文字列；
21. **DUSK 不用发光魔法阵、粒子、霓虹**；炼金环只能是一条细线；
22. **STEAM 不使用 Valve 素材**（Logo、商店图、成就图标）；绿色只给主按钮与「就绪」，
    红色只给缺失/删除；不要伪造在线人数、下载速度、成就数；
23. **示例库与截图里不允许出现真实游戏素材**；封面只用 `tools/demo-covers.py` 生成；
24. 技术标识（程序集、AppData、`NOVA_DEV`/`NOVA_CACHE_ROOT`、主题 id `nova`）不要跟随品牌改名。

---

## 9. 快速启动 / 验证命令

```bash
cd nova-game-space-desktop

# 开发运行（E: 缓存，CDP 9223）
./tools/relaunch.sh

# 完整审计
node tools/export-all.js --views=all --sizes=1439x1124,960x600 --stress
node tools/probe-graphics.js

# 只拍黄昏之炼
node tools/export-all.js --themes=dusk --views=all --sizes=1439x1124,960x600 --stress

# 开屏连拍（需要应用正在运行）
node tools/shot-intro.js ../_shots/intro 900 1500 2100

# 重画 12 张主题缩略图（先启动应用）
node tools/render-concepts.js ../_shots/concepts
# 然后缩到 960×540 覆盖 themes/<id>/assets/preview.jpg，并 bump 版本

# 重画示例封面（不需要应用）
python tools/demo-covers.py ../_shots/covers
# 无头 Edge 渲染 src/*.html 与 *-hero.html，再转 JPG

# 重合成黄昏之炼音效
python tools/sfx-specs/make-dusk-sfx.py /tmp/dusk-wav
ffmpeg -i /tmp/dusk-wav/<cue>.wav -c:a libvorbis -q:a 5 -ac 1 themes/dusk/sounds/<cue>.ogg

# 打包
bash tools/pipeline.sh --version 1.8.0

# 版本号（唯一源）
node tools/bump-version.js 1.8.1
```

> 改主题 CSS：bump `theme.json` patch → `relaunch.sh`（同步）→ 重启。
> 改音效：重新合成 → 转 OGG → **bump `theme.json` version**（缓存）。
> 改预览图：`render-concepts.js` → 缩到 960×540 → bump 主题版本。

---

## 10. 已知限制与风险

- **品牌只改了可见文案**：可执行文件仍叫 `NovaGameSpace.exe`，数据仍在
  `%LOCALAPPDATA%\NOVA Game Space`。改这两处需要迁移，不要顺手改。
- **截图依赖本机示例库**：6 条虚构条目写在 `library.json` 里，封面在 `media\<id>\`。
  换机器重拍需要重新导入这 6 条（或写一个 seed 脚本，见 P2）。
- **示例条目指向 `_shots\demo-apps\*.exe`**（notepad 的副本），只为让「可用」状态成立；
  这些 exe 不在仓库里，重拍前要自己复制一份。
- **`DeveloperOnly` 会在启动时按路径重算**：把示例条目指向系统目录会被自动隐藏，
  所以 exe 必须放在非系统目录。
- **Steam 边界**：不带客户端时只能启动本身不依赖 Steam 运行时的游戏；
  SteamStub / `steam_api` 游戏必须由客户端启动，这是正版校验，不做绕过。
- **黄昏之炼只用思源宋体/黑体**，没有附带字体；字体缺失时会回落系统字体，字重会变。
- **`docs/HANDOFF.md` / `THEMES.md` 等旧文档仍是 NOVA 叙述**，与 1.7.0 不完全一致。

---

## 11. PR 历史（近两轮）

- **#20** `docs: 1.6.9 下一轮交接文档`
- **#19** `feat: 启动器改名 GUGUOVA / 零点街区换台切换动画`
- **#18** `fix: 主题卡片浮窗跟随主题 / 终末地开屏移除默认星盘`
- **#17** `feat: Steam 启动接管 / 每主题全套音效 / 开屏重做`

下一轮从 **Win7 / 物理手柄 / Steam 全流程** 开始即可。
