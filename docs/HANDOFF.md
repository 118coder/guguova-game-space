# NOVA 交接文档

> 写给接手这个项目的人（或下一个 AI 会话）。
> 最后更新：2026-10-19 · 对应版本 1.2.2

先读这一页，再按需跳到具体章节。文中所有路径都相对于仓库根目录。

---

## 0.00 30 秒交接

- 当前版本 **1.2.2**；共 **6 套主题**：`nova` / `aurum` / `endfield` / `codex` / `zerohour` / `mnemo`。
- 每套主题都有自己的开场 id（`gilded` / `aurum` / `endfield` / `codex` / `zerohour` / `mnemo`）；
  新增主题必须：注册开场 + 做一张统一概念板预览 + 过一遍 **`docs/THEME-COVERAGE.md`**。
- 主题卡预览**不是截图**：源在 `tools/theme-concepts.html`，用 `tools/render-concepts.js` 渲染，
  缩到 960×540 后放进主题的 `assets/preview.jpg`；内置 NOVA 用 `src/assets/theme-nova-preview.jpg`。
- 新主题最容易漏：**右键菜单**（`.context-menu` / `.context-item`）、**编辑器 `select`**、
  **构图控件**（`.editor-framing`）、启动/睡眠、详情/外观预览。清单见覆盖文档第 7/8 节。
- 改主题 CSS 后 **bump `theme.json` 的 version**（坑 #8）；发版同时改 csproj 版本和
  `index.html` 的 `?v=`（坑 #2 / #13）。
- ZERO HOUR 的主视觉是**黑色 command 面板 + 白字**，活动条是实色深面板；不要改回白纸卡片，
  否则灰底黑字会再次出现。MNEMO 的红色错误牌只用于开场/错误态。
- AURUM 的外观预览仍用基础卡片（覆盖表里标 `△`），下次可统一成铭牌 + 编号条。
- 交接文件：本文件 + `docs/THEME-COVERAGE.md` + `docs/THEMES.md` + `README.md`。

---

## 0.0 1.2.2 变更记录（最新）

这一轮加入「终末地 ENDFIELD」主题与启动序列，并按用户反馈做了一次**反玻璃化 / 反渐变**收敛。

### 1. 新主题 themes/endfield/

- 变体卡：酸黄 `#FFFA00` / 中性纸 `#F4F4F2` / 标准切角 / 细线网格 / 标准密度 / 完整动效。
  主界面是纸面控制台，启动与睡眠是深色命令面，属于同一主题的两种页面类型，不是反色。
- 主界面：纸面 dossier 覆盖封面左侧，右侧满幅 `cover`；顶栏与 dock 改为实色；
  不再使用 `atmosphere` 的上下/左右渐变。
- 组件：切角按钮（悬停黄色擦入）、纸面导航段、编号 tile（`No.01`）、
  记录行 hover 右移 + 黄色左条、分段进度、纸面编号切换条、墨色铭牌（详情 / 外观预览）。
- 字体：自带 Saira 可变字体（`assets/Saira.ttf`，SIL OFL 1.1，许可同目录），
  `font-stretch` 112% / 125%；中文回退系统黑体。
- `theme.json` version 1.0.1，`intro: "endfield"`，预览图 960×540。

### 2. 新开场预设 endfield

- `intro.js` 注册，`setup()` 注入独立 `.intro-ef` 结构，不改共同编排。
- 真实数据：日期、时间、年份、游戏数（从 `#clockDate` / `#clockTime` / `#dockCount` 读取），
  数字乱码后落定；分段进度 0→100；快门退场（`clip-path: inset(0 0 100% 0)`）。
- 2400ms；任意键 / 鼠标 / 手柄跳过；`reduce-motion` 直接显示最终状态。
- 三色条、实心 `NOVA` + 空心 `GAME SPACE`、黄色马克笔、`GAMES / THEME / YEAR` 字段。

### 3. 反玻璃化 / 反渐变（用户反馈）

- 移除 `.atmosphere` 的全部渐变；顶栏改实色 `--ef-paper`。
- 详情页与外观预览：去掉模糊铺底（`filter: blur`）、暗角渐变与 `object-fit: contain` 留白；
  图片改满幅 `cover`，信息改为 compact 墨色铭牌。
- 外观预览移除假 CTA 与第二条进度条；底部游戏切换改成纸面编号记录条（`No.01`…）。
- 游戏卡 / 库卡片去掉底部暗化渐变；启动页改为平面墨色 scrim + 黑白封面；编辑器预览改平底 caption 条。
- 只保留硬边纹理：网格、45° 斜线、三色条、分段进度；没有柔和渐变、玻璃模糊、发光或软投影。
- `html.calm` 会用 `!important` 隐藏 launch ring、强制亮色封面；主题用更高优先级恢复单色封面与读数，
  因为进度是数据，不应该被 calm 模式吞掉。

### 4. 主题引擎：相对 URL 重写

- 主题 CSS 内联前，把所有相对 `url(...)` 重写为 `https://nova.themes/<folder>/...`。
  `data:` / `http(s):` / `//` / `#` 跳过；按括号配对消费，data URI 里的 `url(#id)` 不会被误伤。
- 这修好了 AURUM 的纹理引用，也让 ENDFIELD 的 Saira 与预览图能正常加载。

### 5. 表单与细节

- `.field select` 补纸面样式（此前白字白底不可见）；`#editorDelete` 使用危险红（红色只给删除）。
- 详情弹层关闭按钮不再被切角裁掉：切角只给可点击元素，弹层 / 画框 / 铭牌保持直角。
- 版本号 1.2.2，`index.html` 所有 `?v=` 同步。

### 6. 主题预览统一概念板

- 主题卡片不再使用应用截图。NOVA / AURUM / ENDFIELD / CODEX / ZERO HOUR 五张预览改为统一构图的概念板：
  顶部 `// NOVA THEME · NAME` + 真实字段；左栏大字标 / 中文名标记 / 字段；
  右栏主题语言的样张框（`No.01`、圆盘、字标样张）；底部全宽 command strip。
- 五张预览分别表现：NOVA 的 8 套字标 + 封面采样色板；AURUM 的墨绿/鎏金/羊皮纸/青玉；
  ENDFIELD 的纸面/酸黄/切角/空心字；CODEX 的深褐金线/红玉菱形/星盘；ZERO HOUR 的黑白/警示黄/CRT。
- 生成源：`tools/theme-concepts.html` + `tools/render-concepts.js`（2× 渲染，再缩到 960×540）。
- 内置 NOVA 预览：`src/assets/theme-nova-preview.jpg`，由 `theme-engine.js` 的 `BUILT_IN.previewUrl` 提供。
- AURUM bump 到 1.0.6，ENDFIELD bump 到 1.0.2；规范写在 `docs/THEMES.md` 第 13 节。
- **这是以后新主题的硬约定**：预览必须是概念板，不是截图。

### 7. 主视觉构图（玩家可调）

- `GameEntry.HeroZoom`（1–2.4）新增；`HeroPosition` 继续保存 `X% Y%`。
- 编辑器的预览左上角新增「构图」控制条：方向键、缩小/放大、重置；预览支持拖动平移与滚轮缩放。
- 保存时写入 `heroPosition` / `heroZoom`；应用在：
  - 首页背景层（`.scene` 图片，缩放时暂停 drift 动画）；
  - 外观预览的主视觉；
  - 详情的封面图；
  - 编辑器自身预览。
- `rebuildAfterLibraryChange` 在编辑保存后会重新应用 `setBackdrop`，否则同一 URL 的背景层不会更新构图。
- 数据结构与桥接：`GamePayload.HeroZoom`、`updateGame/createGame` 接收并 clamp；旧游戏默认 1。
- `applyHeroFraming()` 用 `object-position` + `translate/scale`，缩放上限 2.4。

### 8. 浏览器操作与启动预设

- 屏蔽原生图片拖拽：全局 `img { -webkit-user-drag:none }`、所有预览/启动图 `draggable="false"`，
  并捕获 `dragstart` / `dragover` / `drop` 的默认行为。
- 启动开场改为等待主题列表与样式加载（最多 2.5s），不再 500ms 就退回 `gilded`，
  避免“旧主题动画 → 新主题界面”。CSS 安全兜底从 3.4s 延到 6s，给主题等待留出空间。

### 9. 新增三套主题：CODEX / ZERO HOUR / MNEMO

- `themes/codex/`「星轨秘典 CODEX」：深褐纸面、双层金线、虚线内框、红玉菱形刻度、
  星盘时钟与 Cormorant 衬线标题；主视觉是暗色秘典铭牌；`"intro": "codex"`。
- `themes/zerohour/`「零点街区 ZERO HOUR」：黑白漫画、警示黄 + lime 选中、半调网点、粗黑边、
  圆角药丸按钮、硬偏移阴影、胶带贴纸与 CRT；黑色漫画面板 + 白色粗描边 + Bebas 标题；
  `"intro": "zerohour"`。按 `绝区0参考/` 与 `精选参考/` 补上 lime 选中态、圆角面板/按钮、
  斜线扫描纹理和背景巨字水印；活动条改为实色深面板 + 白字，修复灰底黑字对比度。
- `themes/mnemo/`「记忆管理局 MNEMO」：冰蓝记忆地图、冷白 HUD、青色数据线、红色节点、
  黄色路径、块状字标与红色「记忆无法读取」错误牌；`"intro": "mnemo"`。
- 三套都有独立的启动动画与演出：codex 是星盘/指针/菱形收束；zerohour 是 CRT 通电/
  危险条/频道读数/折叠退场；mnemo 是冰蓝记忆地图 + 红色错误牌复位 + 横向折叠。
  `test-intro-theme.js codex|zerohour|mnemo` 已验证 `dataset.intro` 与主题一致。
- 右键菜单补齐：`.context-menu` / `.context-item` 与 `.popover` / `.menu-row` 是两套类；
  AURUM / ENDFIELD / CODEX / ZERO HOUR / MNEMO 现在都显式覆盖右键菜单。
- 主题卡预览新增 CODEX（No.03）、ZERO HOUR（No.04）、MNEMO（No.05）三张统一概念板；
  六套预览共用同一构图。
- **新增 `docs/THEME-COVERAGE.md`**：逐一列出全部界面/状态/选择器，带五套主题的覆盖状态、
  常见漏项与 DoD。以后每套新主题必须过完这张表；右键菜单、`select`、构图控件、启动/睡眠、
  详情/外观预览都在表内。

### 验证

- `dotnet build -c Debug`：0 错误。
- 960 / 1280 / 1920 三档：首页、库、外观、详情、编辑器无截断或重叠。
- 主题切换 NOVA → AURUM → ENDFIELD 回归；Saira 实际加载；切回 NOVA 后内联主题 CSS 清空。
- 启动页：62% 读数、编号步骤、单色封面、平 scrim。
- 开场：真实 `2026.10.19` / `04:28` / `06` 局 / `ENDFIELD` / `2026`，进度 0→100。
- 主题卡：六套概念板全部显示（NOVA/AURUM/CODEX/ENDFIELD/MNEMO/ZERO HOUR）；AURUM 1.0.6、ENDFIELD 1.0.2；没有截图。
- 构图：编辑器内缩放 140% + 左移后保存，`library.json` 写入 `heroPosition` / `heroZoom`；
  首页背景层的 `transform` 同步，重置后恢复 100%。
- 拖拽：`appearanceImage.draggable === false`；`dragstart` 与 `drop` 均被 `preventDefault()`。
- ZERO HOUR：主视觉为黑色 command 面板 + 白字；活动条计算样式 `rgb(17,18,20)` / 标题 `rgb(241,239,231)`，
  不再灰底黑字；发布版截图已核对。
- MNEMO：`ENTRY` 读取真实游戏数（`06`）；开场红色错误牌在约 1.3s 后复位为「记忆已恢复」。
- 发布版：6 套主题、6 张概念板预览，主题切换与右键菜单回归通过。

---

## 0.1 1.2.1 变更记录

这一轮只做四件事，全部围绕「界面更像一个整体」。

### 1. 游戏库 / 外观改成原地切换

之前它们是全屏弹层：带遮罩、卡片边框、`inert` 和焦点陷阱，
每次点击导航都像打开一个新窗口。现在改成同一内容区里的视图。

- 新增 `<div class="content">`，里面并排三个 `.view`：
  `#homeView`（主视觉 + 底部游戏条）、`#libraryOverlay`、`#appearanceOverlay`。
- `.view` 绝对定位叠放，切换时只做 0.32s 的交叉淡入 + 10px 位移；
  顶栏、背景、导航完全不动。
- 新增 `state.view`（`home|library|appearance`）与 `setView()`；
  `state.overlay` 现在只表示真正的模态层（详情 / 编辑器 / 扫描器 / 选择器 / 启动 / 睡眠）。
- 库和外观不再设置 `app.inert`，也不再抢焦点；`NovaSurfaces` 里这两个 id 的注册保留，
  但打开/关闭改由 `setView` 走。
- 库与外观视图自带一层轻遮罩 + 9px 模糊，保证在明亮封面上文字依然可读，
  但仍能看见背景，不会像换了个页面。
- `content` 的 `z-index` 必须是 4：低于它会被 `.atmosphere` / `.grain` 压暗。
  这是本轮踩到的第一个坑。

### 2. 竖排模式

- 顶栏新增布局按钮（`#layoutBtn`），在「底部横排」与「左侧竖排」之间切换。
- 竖排时：封面缩成 92px 的横向小卡排在左侧，右侧仍是完整主视觉；
  游戏条变成可纵向滚动的侧栏，`all-btn` 与底部提示隐藏。
- 偏好写入 `PlayerSettings.Layout`（`row|rail`），下次启动保持。
- 窗口宽度低于 1080px 自动退回横排，避免把主视觉压扁。

### 3. 全屏

- 最大化与全屏共用一个实现（`MainWindow.SetFullscreen`）：
  按当前显示器的物理边界铺满，隐藏任务栏。
- 「退出全屏」从悬浮胶囊移进顶栏，位置在窗口按钮左侧；
  全屏时窗口按钮隐藏，它正好补位，不会再压住头像。
- Esc 的层级：关模态 → 回首页视图 → 退出全屏。
- 拖动全屏窗口会先退出全屏再开始拖动，避免卡在屏幕边缘。

### 4. 单实例

- 双击第二次不再启动第二个进程：`App.xaml.cs` 用命名互斥量拦住，
  并通过命名事件把已运行的窗口唤到前台。
- 原因：两个进程同时占用 WebView2 的用户数据目录会抛
  `COMException 0x8007139F`，界面会空白。这是本轮实测到的崩溃。

### 5. 缓存与构建

- 本地 CSS/JS 全部加了 `?v=1.2.1`。**发版时必须同步改版本号**，
  否则 WebView2 磁盘缓存会继续用旧文件。
- 另一个更容易踩的坑：程序运行的是 `bin/Debug/net10.0-windows/win-x64/src` 里的副本。
  改完 `src/` 不 `dotnet build` 就重启，看到的仍然是旧界面。
  本轮排查「CSS 不生效」花了很久，实际就是这两件事叠加。

### 验证

- 导航三视图来回切换：`data-view` 正确，库 6 张卡渲染，顶栏不重建。
- 竖排：`html[data-layout=rail]`，游戏条 `flex-direction: column`，
  重启后 `settings.layout` 仍为 `rail`。
- 全屏：窗口 2560×1440 @0,0；按钮在顶栏内，与头像包围盒不重叠；
  Esc 退出后 `is-fullscreen` 与原生状态都回到 false。
- `dotnet build -c Debug` 0 错误。

---

## 0. 1.2.0 变更记录（先看这里）

这一轮的目标是「重做主题气质 + 把交互、开场、架构补齐」。方向经过一次纠偏：
第一版尝试了浅色羊皮纸，实测在明亮封面上不成立，已整体回滚；最终保留原来的
暗色电影感基座，把新主题做成暗色鎏金，并把封面颜色从主题 UI 中隔离出去。

### 完成内容

**视觉 / 主题**

- 保留内置 `nova`（NOVA 原生，暗色电影感外观）作为默认主题，不做破坏性覆盖。
- 新增内置附赠主题 `themes/aurum/`（鎏金圣所 · AURUM），替换原来的 `abyss` 附赠位：
  - 墨绿铁底、双层鎏金描边、四角金属括号；
  - 羊皮纸铭牌（导航 / 主按钮 / 筛选 / CURRENT / 主题标签）；
  - 青玉能量条、细噪点、斜纹、铆钉；
  - 标题统一为家族金色，封面配色只影响背景；
  - Steam 徽章改为 meta 行内的小型刻印标签（细金线 + 菱形点），不再使用按钮式描边盒；
  - 自带 `aurum` 开场预设。
- 默认主题仍是 `nova`（NOVA 原生），AURUM 只是附赠主题；`PlayerSettings.Theme` 默认值保持 `nova`。
- 长文本/截断专项：
  - 主标题走 `fitLogo` 缩放，1110px / 960px 窄窗口不溢出；
  - dock 与库卡片使用 `shortName()` 取中文头名，避免「中文 + 英文」被卡片切断；
  - 外观的调色板标签允许换行，风格选择标题使用短名；
  - 库卡片过长的拉丁副标题直接隐藏（`is-long-name`），而不是 ellipsis 硬切；
  - 详情路径、外观数据路径、扫描路径允许换行；按钮文案与 meta 行不重叠。
- 参考目录 `D:\EX\sprite_Interface` 只用于提炼语言，不复制任何素材：
  - 深绿/近黑底 + 双层金线 + 奶油/羊皮纸内嵌铭牌；
  - 暗绿格槽、金色角括号、青玉小信号；
  - 暗底上的青色文字只出现在深色铭牌内，不再直接浮在亮封面上。
- 重新绘制 `.ico`：黄铜罗盘环 + 菱形印章 + 青玉核心，
  多尺寸 16–256，生成脚本 `tools/make-icon.py`；WPF 启动画面同步换成同款标记。
- 移除旧的 `themes/abyss/` 源目录（用户数据目录里的旧副本不会被程序主动删除）。

**交互 / 动效**

- 新增 `src/motion.js`：统一「减少动效 / 沉稳 / 低性能」三种策略；
  低性能自动移除背景模糊、噪点与漂移，并支持窗口不可见时暂停装饰动画。
- 新增 `src/focus.js`：弹层焦点陷阱、打开时移入、关闭后恢复、输入模态标记。
- 新增 `src/intro.js` + `src/intro.css`：开场动画注册表；
  `gilded` / `aurum` / `ink` / `ember` / `veil` 五个预设；
  罗盘描线、金色粒子、轨道环、光带扫过；AURUM 预设额外有 180° 印章旋转
  与金色扩散环（`setup()` 挂 class，不改共同编排）；
  主题清单用 `"intro": "aurum"` 选择；任意键、鼠标、手柄按键可跳过；
  `prefers-reduced-motion` / 「减少动效」自动降为淡入。
- 新增 `src/polish.css`：导航选中项滑动、封面解码后淡入、焦点偏移统一。
- 开场逻辑接入 `app.js`：主题加载最多等 500 ms，失败也不会卡住界面；
  默认 2.2 s，可跳过，结束用圆形 iris 揭示主界面。
- 启动界面（launch）：
  - 点火脉冲（`is-igniting`）、错误态（`is-error`）、就绪呼吸（`is-ready`）；
  - 环形进度重新配色，步骤改为金色/青玉信号；
  - 退出时折叠成一条金色封印线。
- 模式切换：保留原有的 overlay / shell 过渡，新增 `setNav` 滑动指示器；
  打开外观面板时 shell 有独立的入场动画（主题层）。
- 加载/空/错误态：封面图先显示底板，解码后淡入；损坏封面保留 branded fallback；
  空库、空筛选、扫描中、启动失败都有明确文案与视觉。
- 主题 / 封面解耦：主题激活时 `applyAccent` 不再把封面的 `--accent` / `--accent-2`
  写进主题 UI；只保留 `--scrim-rgb` 给背景遮罩。主题 token 会被恢复。
- 键盘/手柄：开场期间输入只用于跳过；弹层 Tab 焦点循环；手柄任意键跳过开场。
- **原生按钮配色回归备份**：新增 `src/cta-palettes.css`，恢复原型的 8 套手调 CTA
  （Emberwaltz / Cobalt Hour / Sanctum / Shatterline / Sunroom / Moonbound / Neon Hearts / system）。
  已知游戏套对应 palette class；未知游戏继续用封面采样，保持形状不变。
- **模式注册表**：`src/surfaces.js` 统一模态层（details / editor / scanner / picker /
  launch / sleep）的 open/close、`inert` 与焦点恢复。
  游戏库与外观在 1.2.1 之后是视图，不再走注册表（见 0.1）。
- **玩家可编辑游戏资料与字体**：编辑器新增年龄分级、游玩模式、标题字体（8 套字标方案 +
  自动跟随封面）；`GameEntry.TypeRecipe` 持久化，`recipeFor` 优先使用玩家选择。

**架构**

- 主题清单新增 `intro` 字段，C# `ThemeService` / `NativeBridge` 透传到渲染层。
- 开场预设与主题系统解耦：主题只声明 id，动画注册表在 `intro.js`。
- 动效策略与业务解耦：`motion.js` 只输出 CSS class 与 CSS 变量。
- 焦点策略与业务解耦：`focus.js` 只观察可见弹层，不关心具体页面。
- 新增渲染层文件都逐个写进 `NovaGameSpace.csproj`（坑 #1）。

### 关键决策

1. **暗色基座不推翻**。参考图的「气质」是暗底 + 鎏金 + 羊皮纸铭牌，
   不是整页浅色。浅色版在明亮封面上对比度不可控，已回滚。
   **默认主题仍是 NOVA 原生**（保留原来的封面配色算法）；AURUM 取代 abyss 作为附赠主题。
2. **主题拥有自己的调色板**。主题激活后，封面颜色不再改写徽章、进度文字、按钮；
   封面只影响背景遮罩和主视觉。这样 AURUM 不会因为《沉睡的法则》的蓝绿色封面
   出现蓝色 STEAM 徽章和蓝色时长。
3. **标题颜色由主题收口**。保留字标配方的字体与形制，但把填充色统一为家族金色，
   避免封面渐变在亮图上消失。
4. **开场是注册表，不是主题脚本**。主题不能执行代码的安全边界不变；
   新开场只需要注册预设 + 一段 CSS 变量。
5. **性能分级在运行时决定**。先看硬件核数/内存，再采样前 95 帧的中位帧时间；
   只降级、不升级，避免在低端机上反复抖。
6. **焦点陷阱由独立模块负责**。页面只负责开关弹层，焦点行为统一。
7. **图标可复现**。`tools/make-icon.py` 生成，不依赖设计软件；
   素材全部为几何绘制，无第三方图。

### 验证记录（1.2.0）

- `dotnet build -c Debug`：0 错误；发布版 `publish/NovaGameSpace.exe` 已实际启动验证。
- 默认主题 Cobalt Hour CTA：`cta-cobalt-hour` → `#eaf8ff → #bfe2ff`，与备份一致；
  Emberwaltz → 橙金 `#ffd88a → #ff7e6d`；Sunroom → 鼠尾草；未知游戏走封面采样。
- AURUM 主题：CTA 由主题接管，Steam 标签为小型刻印标签；无蓝色封面串色。
- 开场：`NovaIntro.presets()` 返回 5 个预设；AURUM 的 `setup` 增加 180° 印章旋转与金环脉冲。
- 模式：`NovaSurfaces.ids` 返回 8 个 surface；library/editor 的 inert、body surface、焦点恢复均验证。
- 编辑器：年龄/模式/字标方案字段可见；保存 `poster` 后 `#gameLogo` 变为 `type-poster`，
  `library.json` 持久化 `typeRecipe`，再改回自动成功。
- 布局：960 / 1110 / 1400 三档检查，长标题、Steam 标签、调色板标签、库卡片名称无截断/重叠。
- 外观风格卡（计算冒险 / Monolith）：`choice-logo.scrollHeight === clientHeight`，底部字形完整；
  双卡标题与 CTA、描述之间无重叠。
- 960px dock 的「噩梦摇篮：献花于你」自动换行到两行，
  `tile-name.scrollHeight === clientHeight`，不再出现 ellipsis 硬切。

### 遗留问题

- 入口 WebView2 冷启动约 3–5 s，WPF splash 会在此期间显示；开场动画在页面加载后开始。
  后续可以把 splash 的进度与 WebView2 初始化事件打通，减少「splash → intro」的割裂。
- 旧用户数据目录里可能残留 `themes/abyss`；程序不会自动删除用户主题。
  如果要彻底清理，需要加「退役主题迁移」而非常规删除。
- 主题预览图仍可能被 WebView2 缓存；改预览图后需要重启或换主题名/版本。
  CSS 已经用 no-store 绕过。
- 亮色封面下的截图对比度已经通过暗色进度牌与金色标题解决；
  极亮的纯白封面仍建议用户在添加时提供更暗的 hero。
- 手柄跳过开场只能通过轮询；没有专门的 `gamepadconnected` 事件处理。

### 下一步建议

1. 把 WPF splash 与 WebView2 初始化进度打通（最影响第一印象）。
2. 给主题卡片加「开场预设预览」小按钮，方便主题作者试听/试看。
3. 主题安装 UI（zip 导入）仍未接到界面；后端 `ThemeService.Install` 已具备。
4. 200+ 游戏库的虚拟滚动。
5. 主题预览图 cache-bust（在预览 URL 后加 `?v=版本`）。
6. 多显示器 / 每游戏记忆显示器。

---

## 1. 一句话说明

NOVA 是一个 Windows 桌面游戏启动器。界面是 Web 技术（HTML/CSS/JS），
外壳是 .NET 10 + WPF + WebView2。它管理本机游戏、真实启动进程、统计游玩时长，
并支持整套换皮肤的主题扩展。

不是模拟，点「开始游戏」是真的启动 exe。

---

## 2. 五分钟跑起来

```bash
# 环境：Windows 10/11 + .NET 10 SDK + WebView2 Runtime（Win11 自带）
dotnet restore
dotnet run

# 发布单目录自包含版（约 163 MB）
dotnet publish -c Release -r win-x64 --self-contained true \
  -p:PublishReadyToRun=true -o publish
```

运行时数据在 `%LOCALAPPDATA%\NOVA Game Space\`：

| 文件/目录 | 内容 | 能否删 |
|---|---|---|
| `library.json` | 游戏库、设置、游玩时长 | 删了等于重置 |
| `media\<id>\` | 每款游戏生成的 hero/cover | 可删，会重新生成 |
| `themes\` | 用户主题 | 可删，自带主题会重新播种 |
| `webview2\` | 浏览器缓存 | 可删，会重建 |
| `nova.log` | 运行日志 | 可删 |

---

## 3. 代码地图

```
nova-game-space-desktop/
├─ NovaGameSpace.csproj      项目文件。渲染层文件必须逐个列出（见坑 #1）
├─ App.xaml(.cs)             入口
├─ MainWindow.xaml(.cs)      无边框窗口、原生拖动、全屏、托盘、关闭确认
├─ NativeBridge.cs           ★ 前后端唯一通道
│
├─ Services/
│  ├─ LibraryModels.cs       数据模型（GameEntry / PlayerSettings / CoverDna）
│  ├─ StoreService.cs        AppPaths + library.json 读写 + 数据迁移
│  ├─ LauncherService.cs     启动、会话、计时、崩溃判定
│  ├─ MediaService.cs        裁图、图标合成、生成 hero/cover
│  ├─ CoverAnalyzer.cs       封面采样 → 调色板 + DNA
│  ├─ GameScanner.cs         Steam 库 / 开始菜单扫描
│  ├─ ManifestImporter.cs    nova-game.json 解析
│  ├─ ThemeService.cs        ★ 主题发现、校验、播种、安装
│  ├─ FileBrowser.cs         应用内文件浏览（列表盘符与目录）
│  ├─ ShellInterop.cs        取 exe 大图标
│  └─ ShortcutResolver.cs    .lnk 解析
│
├─ src/                      ★ 渲染层
│  ├─ index.html             全部界面结构 + SVG 图标库 + 开场层
│  ├─ app.js                 主逻辑（最大的一份，约 3.9k 行）
│  ├─ gamepad.js             手柄轮询与按键映射（开场可跳过）
│  ├─ overlays.js            应用内对话框 + 文件浏览器
│  ├─ theme-engine.js        主题加载、token/图标替换
│  ├─ motion.js              ★ 动效策略 / 性能分级 / 系统减少动效
│  ├─ focus.js               ★ 焦点陷阱、恢复、输入模态
│  ├─ surfaces.js            ★ 模式/弹层注册表（open/close/inert/焦点）
│  ├─ intro.js               ★ 开场动画注册表
│  ├─ base.css / type.css    原型的控制台设计系统
│  ├─ cta-palettes.css       原生默认主题的手调 CTA 配色
│  ├─ theme.css              按钮、管理面板、外观工作室
│  ├─ app.css                桌面版补充（编辑器、扫描器、空状态）
│  ├─ motion.css             启动动画、沉稳模式、手柄提示条
│  ├─ views.css              ★ 原地视图、竖排模式、全屏退出按钮
│  ├─ dialogs.css            对话框、文件浏览器
│  ├─ themes.css             主题卡片 + 右键菜单
│  ├─ polish.css             导航滑动、封面淡入等交互层
│  ├─ intro.css              ★ 开场动画预设与可访问性降级
│  ├─ fonts.css              自托管字体（离线可用）
│  └─ assets/                音效（CC0）、背景图、示例图
│
├─ themes/aurum/             自带主题：鎏金圣所 AURUM
├─ themes/endfield/          自带主题：终末地 ENDFIELD（Saira 字体 + OFL）
├─ themes/codex/             自带主题：星轨秘典 CODEX
├─ themes/zerohour/          自带主题：零点街区 ZERO HOUR
├─ themes/mnemo/             自带主题：记忆管理局 MNEMO
├─ build/icon.ico            主图标；tools/make-icon.py 可复现
├─ docs/
│  ├─ INTEGRATION.md         非 Steam 游戏接入规范
│  ├─ THEMES.md              ★ 主题开发规范（含开场预设）
│  ├─ THEME-COVERAGE.md      ★ 全部界面/状态覆盖清单（新主题必过）
│  └─ HANDOFF.md             本文件
└─ tools/                    开发期验证脚本；theme-concepts.html 是主题预览概念板源（不参与发布）
```

---

## 4. 架构：三层与一条通道

```
┌──────────────────────────────────────────────┐
│  WebView2（https://nova.site 虚拟主机）      │
│  index.html + app.js + 各模块 + 主题 CSS     │
└───────────────────┬──────────────────────────┘
                    │  postMessage(JSON)
                    │  { id, method, args }  →
                    │  ← { type:'response', id, result }
                    │  ← { type:'session-started' | 'session-ended'
                    │       | 'ask-close' | 'fullscreen-state'
                    │       | 'window-state' }
┌───────────────────┴──────────────────────────┐
│  NativeBridge.cs  —— 唯一的桥               │
│  按 method 分发到各 Service                 │
└───────────────────┬──────────────────────────┘
                    │
┌───────────────────┴──────────────────────────┐
│  Services/  +  MainWindow（WPF 宿主窗口）    │
└──────────────────────────────────────────────┘
```

### 虚拟主机映射（NativeBridge.Attach）

| 主机名 | 指向 | 用途 |
|---|---|---|
| `nova.site` | 程序目录 `src/` | 界面本体 |
| `nova.media` | `%LOCALAPPDATA%\...\media` | 生成的封面 |
| `nova.themes` | `%LOCALAPPDATA%\...\themes` | 主题样式与素材 |

界面里因此用 `https://nova.media/<id>/hero.jpg` 这样的绝对地址。

### 桥接方法清单

`boot` · `saveSettings` · `launch` · `stop` · `getRunning` · `scanLibrary` ·
`importCandidates` · `readManifest` · `scanManifests` · `createGame` · `updateGame` ·
`deleteGame` · `setFavorite` · `revealGame` · `openStorePage` · `openDataFolder` ·
`minimizeWindow` · `toggleMaximizeWindow` · `closeWindow` · `quitNow` · `hideToTray` ·
`beginDrag` · `toggleFullscreen` · `setFullscreen` · `fullscreenState` ·
`windowState` · `browse` · `listDrives` · `readImagePreview` ·
`listThemes` · `removeTheme` · `openThemesFolder` · `setTheme`

加新方法只需三步：在 switch 里加路由、写处理函数、前端 `call('名字', args)`。

---

## 5. 关键设计决策（以及为什么）

**选择 .NET + WebView2 而不是 Electron**
本机已装 WebView2 Runtime 和 .NET 10，不用额外下载几百 MB 的 Chromium。
发布体积 163 MB（含运行时），免安装。

**按钮形状固定，只换颜色**
所有游戏共用一枚胶囊按钮，颜色由封面亮度算出。这是原型的核心视觉主张，
也避免了「每个游戏一套 UI」的失控。

**标题字标受约束**
8 套预设配方，按封面 DNA（亮度/饱和/暖度/边缘密度）打分选择，只做兼容性交换。
不让随机函数发明字体，否则一定会出现不可读的标题。

**主题只能改样式**
主题是一个 CSS 文件加图标片段，不执行代码、不读数据、不能访问主题目录以外的文件。
这样用户之间可以放心交换主题。

**最大化 = 无边框全屏**
两者合并成同一套代码路径（`MainWindow.SetFullscreen`），避免出现两种
「填满屏幕」但表现略有差异的模式。

**沉稳模式而不是「减少动效」**
减少动效是关掉动画；沉稳模式是换一套更慢、更短位移、无弹跳的运动语言。
两者都存在：`reduceMotion`（系统级，直接关闭）与 `calm`（设计级，换风格）。

**默认主题的按钮算法不变（1.2.0）**
NOVA 原生仍是原来的算法：`applyCtaVars` 从封面采样主色/副色，按亮度算文字黑/白，
按钮形状固定。只有 `.theme-custom` 主题才走「主题 token 优先」的分支。
AURUM 的羊皮纸/鎏金按钮是附赠主题自己的语言，不会影响默认外观。

> 已对照用户备份 `E:\网页小工具\游戏启动器\nova-game-space.zip`：
> 其中的 `base.css` 与 `type.css` 与当前 `src/` 完全一致；原型的 CTA 是
> 每款游戏一组手调色（`cta-emberwaltz` 等），桌面版沿用同一「只改颜色、不改形状」
> 的契约，但用封面色采样动态生成。默认主题没有被 AURUM 覆盖。

**原生 CTA 颜色以备份为准（1.2.0）**
原型 `theme.css` 的 `cta-emberwaltz` / `cta-cobalt-hour` 等是手调色；桌面版 1.1.0
曾经完全依赖动态封面采样，导致 Cobalt 等游戏的颜色与备份不一致。
1.2.0 把 8 套手调 palette 恢复为 CSS class，已知游戏优先匹配；
未知游戏才走 `applyCtaVars` 采样。形状、字号、图标仍完全固定。

**模式是注册表，不是复制粘贴的 open/close（1.2.0）**
`src/surfaces.js` 用描述符管理 selector、body 属性、inert 与焦点；
`app.js` 只负责业务状态、渲染和音频。新增模式 = 注册描述符，不再复制 DOM 开关代码。

**玩家可以改游戏资料和字体（1.2.0）**
`GameEntry.TypeRecipe` 持久化；编辑器提供「自动 / 8 套字标方案」，以及年龄分级、
游玩模式、介绍、类型等字段。玩家不需要改 JSON。

**主题拥有调色板，封面只影响背景（1.2.0）**
主题激活（`.theme-custom`）后，`applyAccent` 不再把封面的 `--accent` / `--accent-2`
写进 UI，只保留 `--scrim-rgb` 给遮罩；主题 token 会被恢复。
不这样做，蓝色/粉色封面会把徽章、时长、标题渐变全部染成不属于主题的颜色。

**开场是预设注册表，不是主题脚本（1.2.0）**
主题只声明 `"intro": "aurum"`；动画本体在 `src/intro.js` / `src/intro.css`。
新增预设 = 注册一个 id + 一段 CSS 变量，不改启动流程，也不破坏主题安全边界。

**AURUM 的视觉语言（1.2.0）**
参考目录只提炼语言：墨绿/近黑底、双层金线、羊皮纸铭牌、暗绿格槽、
金色角括号、青玉小信号。所有纹理、图标、预览图都是本项目绘制，未复制素材。

**ENDFIELD 的视觉语言（1.2.2）**
纸面 + 唯一酸黄信号；切角只给可按元素，展示容器直角；宽体拉丁小字 + 粗体中文；
编号、日期、游戏数都是真实数据。封面满幅 `cover`，信息放进实色墨色铭牌，
不使用渐变、玻璃模糊与发光。启动 / 睡眠是深色命令面，不是反色，而是同主题的另一种页面类型。

**主题不使用柔和渐变或玻璃（1.2.2）**
用户明确要求终末地风味不要渐变/玻璃感。`atmosphere`、详情/外观的模糊铺底、
卡片暗角渐变、launch 渐变遮罩全部移除；需要质感时只用网格、斜线纹、1px 线和实色块。
`html.calm` 的 `!important` 规则会覆盖 launch 滤镜与 ring，主题需要更高优先级把数据恢复。

---

## 6. 踩过的坑（别重复踩）

**#1 csproj 里 `src\**\*` 通配会在增量构建时漏掉新文件**
新建的 JS/CSS 不会自动打进输出目录。解决方式：渲染层文件逐个 `<Content Include>`。
新增文件时**必须**在 csproj 里加一行，否则运行时报 404。

**#2 两层缓存：先看构建产物，再看 WebView 缓存**
程序运行的是 `bin/Debug/net10.0-windows/win-x64/src`，不是仓库里的 `src/`。
改了 `src/` 不 `dotnet build` 就重启，看到的永远是旧界面——本轮排查「CSS 不生效」
一半时间耗在这里。
另一半是 WebView2 的磁盘缓存：页面里的 CSS/JS 已经统一加 `?v=<版本>`，
**发版必须同步改版本号**；主题 CSS 因为会在运行时被用户编辑，改用
`fetch(url, {cache:'no-store'})` 取文本再内联成 `<style>`。

**#3 内联 CSS 变量优先级高于样式表**
「跟随封面」会给按钮写内联 `--cta-*`，主题样式压制不住。
现在主题激活时会清空这些变量，并用 MutationObserver 兜底；
`applyCtaVars` 里也有 `theme-custom` 短路。

**#4 程序启动时会用自带主题覆盖用户主题，但只在目录不存在时**
原来的播种逻辑导致更新主题后用户拿不到新版本。
现在改成比较 `theme.json` 的 version，内置版本更高就覆盖。

**#5 `postMessage` 传字符串会被解析成 JSON 字符串而不是对象**
`NativeBridge.OnMessageReceived` 需要先检查 `ValueKind == JsonValueKind.String` 再二次解析。

**#6 WinForms 的 tray 引入后与 WPF 有命名冲突**
`Application`、`Color`、`MessageBox`、`Icon` 都要显式限定。
托盘不能用 WebView 绘制，所以它是唯一保留的系统原生菜单。

**#7 生成图片时 `System.Drawing` 与 `System.Windows.Media` 类型重名**
`MediaService.cs` 顶部用了一组 `using` 别名解决。

**#8 自带主题只在「版本更高」时刷新用户副本**
`SeedBundledThemes` 比较 `theme.json` 的 version。改了 `themes/aurum/theme.css`
但没改 version，用户数据目录里的旧副本不会更新，看到的还是旧样式。
改主题 CSS 后必须 bump version（本轮从 1.0.0 → 1.0.3）。

**#9 `background-clip: text` + 亮色 text-shadow 会把标题变灰**
标题的透明填充依赖背景裁切；在其后面加白色 text-shadow / 白色 drop-shadow，
亮色会从字形里透出来，看起来像灰字。用暗色投影，或干脆去掉 shadow。
参考 `themes/aurum/theme.css` 的标题段。

**#10 封面色会污染主题 UI**
主题激活后，`applyAccent` 如果继续写 `--accent` / `--accent-2`，
蓝色封面会让 STEAM 徽章、0 小时、进度文字全部变蓝。1.2.0 已改成
「主题 token 优先，封面只写 `--scrim-rgb`」。

**#11 开场动画在 play 之前可能已经跑了一半**
`intro.css` 在 `body:not(.is-playing)` 时暂停所有子元素动画；
`NovaIntro.play()` 选好主题预设后再加 `is-playing`，保证第一帧从 0 开始。
安全兜底：3.4 s 后强制隐藏，避免 JS 异常把用户困在开场层。

**#12 WebView2 冷启动 3–5 s**
WPF splash 显示期间页面还没加载，开场不会开始。不要以为开场「卡住」；
用 `document.visibilityState` 和 WPF 日志区分启动耗时与动画耗时。

**#16 外观风格卡的字标曾被 `overflow:hidden` 裁掉底部**
`.style-choice-preview .choice-logo` 原来用 `overflow:hidden + ellipsis` 控制宽度，
同时 `line-height` 小于字形墨迹高度，导致「计算冒险」底部被切平。
现在宽度交给 `fitLogo`，字号/行高/`padding-bottom` 给足空间，overflow 改为 visible。
以后任何小尺寸标题都要检查 `scrollHeight` 是否大于 `clientHeight`。

**#14 从详情管理点「编辑」曾被 openEditor 的 overlay guard 拦住**
`openEditor` 原来只允许 `library` / `scanner`；从详情 → 管理 → 编辑时
`state.overlay === 'details'`，函数直接 return，编辑器打不开。
现在允许 `details` 并先关详情；新增入口时记得同步 guard。

**#15 CTA palette class 与 inline 变量会互相打架**
`applyCtaVars` 写 `--cta-a/b`，`.cta-adaptive` 再从这些变量算渐变；
如果只加 `cta-cobalt-hour` 类却不清 inline 变量，颜色仍是被采样色覆盖。
`setElementCta` 在套 palette 时要 `clearCtaVars()`，并移除旧的 palette class。

**#17 `html.calm` 用 `!important` 隐藏 launch ring / 强制亮色封面**
`motion.css` 里 `html.calm .launch-ring { display:none }` 与
`html.calm .launch-art { filter: ... !important }` 会压过主题的普通规则。
ENDFIELD 用 `html[data-theme="endfield"] .launch-ring { display:block }` 与
更具体的 `!important` 滤镜恢复单色封面。以后给 launch 加主题样式时先检查 calm 规则。

**#18 详情页 / 外观预览的模糊铺底是两张图**
默认主题用 `object-fit: contain` + 模糊 `::before` 铺满画框；主题若想满幅 `cover`，
必须同时改 `img` 与 `::before/::after`，否则会留下一条模糊/渐变的空带。
ENDFIELD 的做法：隐藏 `::before/::after`，`img { inset:0; width:100%; height:100%; object-fit:cover }`。

**#13 WebView2 虚拟主机会缓存 app.js / CSS**
只改文件不升版本时，旧进程可能继续加载旧脚本，表现为「代码明明改了但界面没变」。
`MainWindow.ClearRendererCacheIfVersionChanged()` 在程序集版本变化时删除
`Cache` / `Code Cache` 等目录并写 `.renderer-version`。
开发期如果不想升版本，先退出程序，删掉 `%LOCALAPPDATA%\NOVA Game Space\webview2`
下的缓存目录与 `.renderer-version`，再启动。

---

## 7. 当前状态

### 已完成

- 真实启动、会话计时、崩溃判定（非 0 且不足 20 秒）
- Steam 多库扫描、Steam 缓存封面、开始菜单扫描、清单导入
- 封面生成（用户图片裁剪 / exe 图标合成）与调色板采样
- 完整键盘、鼠标、Xbox/PS 手柄导航
- 沉浸式启动与退出动画、沉稳模式、睡眠模式
- 应用内对话框、文件浏览器、右键菜单（无系统弹窗）
- 无边框全屏、托盘常驻、关闭确认
- 主题系统 + 自带 AURUM / ENDFIELD / CODEX / ZERO HOUR / MNEMO 主题 + 主题开发文档
- 主题开场注册表（9 个预设，含 `endfield` / `codex` / `zerohour` / `mnemo`）、主题按 id 选择开场
- `docs/THEME-COVERAGE.md` 覆盖清单：右键菜单、select、构图控件、启动/睡眠、预览等全量状态
- 主题 CSS 相对资源 URL 自动重写（字体、纹理、预览图）
- 焦点陷阱 / 恢复、键盘与手柄开场跳过
- 终末地主题的纸面 dossier、墨色铭牌、编号 tile / 切换条、无渐变启动面
- 模式/弹层注册表（`surfaces.js`）
- 原生 CTA 手调配色（8 套）+ 未知游戏封面采样兜底
- 玩家可编辑年龄分级、模式、介绍与标题字体（8 套字标方案）
- 动效分级（减少动效 / 沉稳 / 低性能自动降级）
- 导航滑动、封面解码淡入、错误态与空态完善、长文本不截断
- CC0 音效、自托管字体、离线性
- 50 款游戏压力测试通过

### 已知限制

- 只支持 Windows。
- 计时跟随被启动的那个进程；如果游戏是「启动器→本体」，统计的是启动器存活时长。
- 不绕过 DRM、不改游戏文件、不注入进程。
- Steam 封面取本地缓存，缓存缺失时用 exe 图标合成。
- 通知只存在内存里，重启清空。
- 手柄映射基于标准布局，非标准映射的手柄可能需要调整 `gamepad.js` 里的按钮索引。

### 没有做的事（有意为之）

- 不做账号系统、不做云端同步。
- 不做游戏内覆盖层（overlay）。
- 不做多语言，界面固定中文。

---

## 8. 下一轮可以做什么

按优先级从高到低，都是独立可交付的：

**A. 主题安装 UI**
现在装主题要手动把文件夹放进目录再点刷新。
可以在主题面板加「从 .zip 安装」按钮，走应用内文件浏览器选 zip，
后端 `ThemeService.Install(zipPath)` 已经写好，只差接一个桥接方法。

**B. 主题换图标**
`theme-engine.js` 已经支持 `icons` 字段，但没有内置主题真的用过。
可以做一套 AURUM 风格的图标，验证整条链路；
或者提供一个图标预览页，让主题作者看到自己换的效果。

**C. 多显示器支持**
现在全屏只覆盖当前显示器。可以加「在哪个显示器启动」的设置，
以及记住每款游戏上次用的显示器。

**D. 游戏分组与排序**
游戏库现在只有筛选和搜索，没有自定义分组、拖拽排序、最近游玩排序。

**E. 自动更新**
没有实现。可以加一个检查 GitHub Release 的逻辑，或者只提示新版本。

**F. 性能**
50 款游戏时主视觉切换仍然流畅，但游戏库一次性渲染 50 张卡片。
如果目标支持 200+，需要虚拟滚动。

---

## 9. 测试方法

项目里有一套开发期验证脚本，依赖 CDP。启动时设环境变量：

```bash
NOVA_CDP_PORT=9223 ./NovaGameSpace.exe
```

然后 `node tools/drive.js "<JS 表达式>" --shot out.jpg` 就能在界面里执行代码并截图。

> `tools/drive.js` 依赖 `ws` 包。需要时 `npm install ws --no-save`，
> 这个包不进发布产物。

`tools/padtest.js` 会伪造一个 Xbox 手柄，验证导航与按键映射。
`tools/stress-dataset.py` 可以生成 50 款测试游戏（会备份原库）。

### 手工验收清单

- [ ] 启动 → splash → 主题开场 → 首页显示当前游戏
- [ ] 开场播放中按任意键/点鼠标/按手柄 → 立即进入首页
- [ ] 首页 `0 小时` 为金色、`STEAM` 徽章为金色（AURUM），不出现封面带来的蓝/粉
- [ ] 切到明亮封面（如《沉睡的法则》）→ 标题仍可读，不灰不透明
- [ ] 点开始游戏 → 启动画面走到 100% → 游戏真的打开
- [ ] 关闭游戏 → 通知出现，时长增加
- [ ] 最大化 → 铺满屏幕，无任务栏
- [ ] 右键 → NOVA 菜单（不是浏览器菜单）
- [ ] 外观 → 切主题 → 按钮/描边/标题/开场立刻变化
- [ ] 外观 → NOVA 原生 → 封面配色恢复驱动按钮与标题
- [ ] 外观 → 终末地 → 首页纸面 dossier、右侧封面满幅无渐变；详情/外观预览是墨色铭牌，底部切换是 `No.01` 编号条
- [ ] 终末地开场 → 日期/时间/游戏数/年份真实；任意键跳过；减少动效时直接显示最终状态
- [ ] 终末地主题下 960 / 1280 / 1920 三档：标题、meta、按钮、编号条、库卡片都不截断
- [ ] 六套主题预览都是概念板（不是截图），卡片在 264×148 下仍能读出主题气质
- [ ] AURUM / ENDFIELD / CODEX / ZERO HOUR 的右键菜单都跟随主题；`.context-item` 不是基础深色
- [ ] CODEX / ZERO HOUR 的编辑器 `select`、构图控件、启动页、详情/外观预览都已打开检查
- [ ] 编辑器「构图」：方向键 / 滚轮 / 拖动都能调整，保存后首页、外观预览、详情同步
- [ ] 外观预览的封面图不能被拖出浏览器原生拖影；文件不能被拖进窗口
- [ ] 添加游戏 → 文件浏览器选 exe → 封面生成
- [ ] 手柄连上 → 底部出现按键提示 → A 启动
- [ ] 打开弹层后按 Tab → 焦点在弹层内循环；Esc 关闭后焦点回到触发按钮
- [ ] 系统开启「减少动效」→ 开场淡入、界面无位移
- [ ] 设置 `NOVA_CDP_PORT` 后 `document.documentElement.className` 不含 `reduce-motion`（默认）

---

## 10. 改代码时的约定

1. **渲染层新增文件必须写进 csproj**（坑 #1）。
2. **不要在主题 CSS 里改布局**，只改外观。
3. **桥接方法保持幂等**，前端可能重试。
4. **中文文案短**。这个界面在大屏上看，句子不超过一行半。
5. **所有确认走 `NovaOverlays.dialog`**，不要引入系统弹窗。
6. **改完跑一遍手工验收清单**，尤其是启动与计时。
7. 提交前 `dotnet build -c Debug` 必须零错误；警告可以留。
8. **主题 CSS 改动后 bump `theme.json` 的 version**，否则用户目录里的旧副本不会刷新（坑 #8）。
9. **新增开场预设**：在 `intro.js` 注册 + `intro.css` 加 `[data-intro]` 变量，
   不要把动画逻辑写进主题 CSS。需要独立结构时用 `setup(overlay)` 注入，再在 `intro.css` 里限定预设。
10. **切角只给可按的东西**；展示容器、弹层、画框保持直角。不要用柔和渐变、玻璃模糊或发光；
    需要阴影时用硬边偏移或 45° 斜线纹。
11. **主题里不要再读取封面 `--accent` 作为 UI 文字色**；主题自己的 token 才是权威。
12. **主题预览图必须是统一模板的概念板**，不是应用截图；参考在 `docs/THEMES.md` 第 13 节。
13. **每套新主题必须过 `docs/THEME-COVERAGE.md`**：右键菜单、`select`、构图控件、启动/睡眠、
    详情/外观预览、主题卡全部检查；不能只改首页。
14. **铁律：不允许文字/按钮被截断或重叠**。长标题必须走 `fitLogo` 缩放；
    长标签允许换行，或用 `is-long-name` 隐藏冗余的拉丁副标题，**不要靠 ellipsis 硬切**；
    徽章与 meta 行必须 flex-wrap，按钮文案必须在窄屏下完整可见。
    验收时必须检查 960px / 1280px / 全屏三档。

---

## 11. 名词表

| 词 | 含义 |
|---|---|
| hero | 16:9 主视觉，首页大图 |
| cover | 16:9 封面，卡片缩略图 |
| DNA | 从封面采样的四个数：亮度、饱和、暖度、边缘密度 |
| 配方 / recipe | 8 套预设字标样式之一 |
| 跟随封面 / adaptive | 按钮与字标颜色随封面走 |
| NOVA 默认 / system | 统一衬线排版、中性配色 |
| 沉稳模式 / calm | 更慢更稳的运动语言 |
| 会话 / session | 从进程创建到退出的时间片 |
| 清单 / manifest | `nova-game.json`，游戏自带元数据 |
| 主题 / theme | 一套 CSS + 图标 + token，整套替换外观 |
| 开场预设 / intro preset | `intro.js` 注册表里的命名动画，主题只引用 id |
| 主题拥有调色板 | 主题激活后封面颜色不写进 UI，只影响背景遮罩 |
| perf-low | 运行时自动加上的低性能 class，关闭模糊/噪点/漂移 |
