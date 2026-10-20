# NOVA 游戏空间 · 桌面版

把一台 PC 变成一个电影感的游戏空间：一张主视觉、一排游戏、一次按键就进入游戏。
这是 `nova-game-space` 网页原型落成的真正可运行 Windows 程序——不是模拟，是真实启动。

![首页（鎏金圣所 AURUM 主题）](docs/screenshot-home.jpg)

![首页（终末地 ENDFIELD 主题）](docs/screenshot-endfield-home.jpg)

---

## 快速开始

1. 解压 `NOVA-Game-Space-1.2.2.zip` 到任意目录（例如 `D:\NOVA`）。
2. 双击 `NOVA游戏空间.exe`。
3. 第一次打开时按 `A`（或点右上角 `+`），选择「浏览本机游戏」导入 Steam 库，
   或「手动添加」指定任意游戏的 `.exe`。

无需安装 .NET 运行时（已自包含）。唯一前提是系统里有 Microsoft Edge WebView2 Runtime——
Windows 11 与近两年的 Windows 10 通常已预装；若提示缺失，从微软官网安装即可。

---

## 它能做什么

| 能力 | 说明 |
|---|---|
| 真实启动 | 调用系统启动游戏进程，不是模拟进度条 |
| 真实计时 | 从进程创建到退出，把本次时长写进本地库 |
| Steam 库扫描 | 读取 `appmanifest_*.acf`、跨多个库目录、自动挑主 exe、取 Steam 缓存封面 |
| Steam 启动接管 | 通过 `steam://rungameid` 交给客户端启动，绕开“未运行 / 未登录”的认证失败 |
| 任意游戏接入 | 手动添加 exe，或使用 `nova-game.json` 清单（见下） |
| 封面生成 | 你提供图片就裁成 16:9；不给就抓 exe 图标，合成带光晕的主视觉 |
| 配色采样 | 从封面提取主色、副色、亮度与边缘密度，驱动按钮渐变与标题字标 |
| 手柄操控 | Xbox / PlayStation 全套导航，含屏幕上的按键提示条 |
| 沉稳模式 | 削减动画、去掉视差与弹跳，整体更安静、更稳定 |
| 睡眠模式 | 大时钟待机，任意键唤醒 |
| 托盘常驻 | 关窗时可选最小化到托盘，继续记录游戏时长 |
| 真全屏 | 无边框全屏铺满显示器并隐藏任务栏，`Esc` 退出 |
| 竖排模式 | 封面小图在左、游戏主视觉在右；一键切换并记住选择 |
| 原地切换 | 游戏库与外观在同一页内淡入，不弹窗、不重建界面 |
| 统一界面 | 所有确认、文件选择、右键菜单都是应用内界面，不出现系统弹窗 |
| 主题扩展 | 一套 CSS + 图标即可整套换皮；主题不能执行代码，可安全分享 |
| 主题特征框架 | `theme.json` 可选 `features`：纹理 / 字体图层 / 面板模块（theme-fx.css），主题按需启用 |
| 自带主题 | 十套附赠主题：AURUM / ENDFIELD / CODEX / ZERO HOUR / MNEMO / RIOT / GRIMOIRE / RISO / SUMMER / BROADCAST |
| 主题开场 | 每套主题可选自己的启动动画；终末地自带「启动序列」开场（真实日期、游戏数、进度与快门退场） |
| 游戏资料编辑 | 在游戏详情 → 管理 → 编辑里直接改介绍、类型、年龄分级、模式与标题字体 |
| 主视觉构图 | 编辑游戏时拖动画面、滚轮缩放或用方向按钮调整封面取景，每款游戏单独保存 |
| 主题预览 | 十一套主题的卡片预览都是设计概念板，不是应用截图；共用统一构图模板 |
| 主题面板 | 可折叠为「常用 6 套」；默认主题固定在第一位，经常切换的主题按使用次数排在前面 |
| 本机用户 | 默认读取 Windows 账户名作为玩家显示名，可在设置里修改 |
| 设置中心 | 玩家、启动与关闭、数据与备份、游玩统计、关于/离线 |
| 数据包迁移 | 导出 `.nova-pack`（游戏库 + 设置 + 游玩记录 + 封面），在另一台电脑导入；支持合并/替换 |
| 自动备份 | 每天首次启动后台备份，保留最近 5 份 |
| 游玩记录 | 每次启动记录开始/结束/时长/异常退出；设置页显示今日、最近 7 天、总时长与最近会话 |
| 记录导出 | 全部游玩会话导出 CSV |
| 游戏库排序 | 最近游玩 / 名称 / 游玩时长 / 添加时间 / 启动次数；支持“程序缺失”筛选 |
| 离线原则 | 不登录、不联网、不上传；Steam 只读本机清单与缓存（启动时也只调用本机客户端） |
| 测试条目隐藏 | 系统目录里的假游戏默认不可见；开发者用 `NOVA_DEV=1` 或 `Ctrl+Shift+D` 查看 |
| 发布流水线 | `bash tools/pipeline.sh` 一次完成审计、Legacy/Modern 构建、打包与 SHA-256 |
| 低性能降级 | 自动检测弱 GPU 并关闭模糊、噪点与漂移；尊重系统减少动效设置 |

---

## 界面与操作

### 鼠标

- 悬停底部游戏条切换主视觉；滚轮左右切换。
- 首页主按钮：启动游戏。游戏运行中时变成打开管理面板。
- 右上角：`+` 添加游戏、搜索、通知、玩家菜单、窗口按钮。

### 键盘

| 键 | 动作 |
|---|---|
| `←` `→` / `A` `D` | 切换游戏 |
| `Enter` | 启动当前游戏 |
| `I` | 游戏详情 |
| `L` | 游戏库 |
| `T` | 外观工作室 |
| `A` | 导入本机游戏 |
| `N` | 通知 |
| `M` | 界面音效开关 |
| `F` | 全屏（无边框，铺满显示器） |
| `Esc` | 关闭当前层；再按退出全屏 |
| 右键 | 打开 NOVA 菜单 |
| `/` | 搜索 |
| `R` | 外观工作室里重新编排字标 |

### 手柄

程序自动识别手柄并在底部显示对应图标的操作提示条。

| Xbox | PlayStation | 动作 |
|---|---|---|
| **A** | **✕** | 启动 / 确认 / 关闭就绪的启动画面 |
| **B** | **○** | 返回 / 关闭当前层 |
| **X** | **□** | 收藏当前游戏 |
| **Y** | **△** | 详情 / 管理（外观工作室里为重排字标） |
| **LB / RB** | **L1 / R1** | 快速翻页 |
| **Menu** | **Options** | 打开游戏库 |
| **View** | **Share** | 打开通知 |
| **L3** | **L3** | 外观工作室 |
| 方向键 / 左摇杆 | 同上 | 切换与移动 |

---

## 界面主题

「外观 → 界面主题」里有十一套（NOVA + 十套附赠主题）：

- **NOVA 原生**（默认）：电影感外观，按钮与标题颜色跟随封面。适合想让每款游戏拥有独立气质的场景。
- **鎏金圣所 AURUM**（附赠主题）：墨绿铁底、双层鎏金描边、羊皮纸铭牌、青玉能量条。
  标题统一为家族金色，封面配色只影响背景，不会再把蓝色/粉色漏进文字。自带「鎏金圣所」开场。
- **终末地 ENDFIELD**（附赠主题）：纸白底、唯一酸黄信号、切角按钮、细线网格、宽体拉丁字与真实编号。
  主界面是纸面控制台，启动与睡眠是深色命令面；封面满幅呈现，信息放在墨色铭牌里，不使用渐变、玻璃或柔和阴影。
  自带「启动序列」开场：三色条、实心 + 空心字标、真实日期 / 游戏数 / 年份、乱码落定、分段进度与快门退场。
- **星轨秘典 CODEX**（附赠主题）：深褐纸面、双层金线、虚线内框、红玉菱形刻度、星盘时钟与 Cormorant 衬线标题。
  主视觉是暗色秘典铭牌，右键菜单、编辑器、启动页都是同一套金色秘典语言；自带「星轨秘典」开场。
- **零点街区 ZERO HOUR**（附赠主题）：黑底白字的街区命令台。主面板是细描边的深色 command 卡，
  白色 Bebas 标题；荧光青柠负责当前/选中，警示黄负责提醒，品红只做稀有度条；导航、筛选、搜索、
  主/次按钮都是圆角药丸，面板带斜线纹理与硬边高光。启动页是 CRT 信号接入。
- **神秘管理局 MNEMO**（附赠主题）：月紫神秘档案、雾紫 HUD、靛紫数据线、梅红节点、琥珀路径与块状字标。
  主视觉是近不透明的浅紫档案铭牌；启动页是一段「档案无法读取 → 档案已解密」的扫描演出，最后横向折叠退场。
- **舞台残响 RIOT**（附赠主题）：纸面朋克拼贴、黑白与朱红、黑胶唱片、撕裂胶带与硬偏移墨影。
  主视觉是白纸拼贴板，封面降饱和成黑白；红色只做当前/信号，适合喜欢高对比现场感的玩家。
- **冒险者档案 GRIMOIRE**（附赠主题）：羊皮纸角色卡、酒红横幅、双线金框、菱形刻度与衬线标题。
  主视觉是羊皮纸档案，封面做旧；适合奇幻、跑团、CRPG 与叙事游戏。
- **电波海报 RISO**（附赠主题）：蓝黄双色印刷、网点、几何碎片、硬阴影与超大衬线标题。
  封面做蓝色双色调，主操作是酸黄块；适合独立游戏、音乐与实验性作品。
- **夏日轻程 SUMMER**（附赠主题）：夏日照片拼贴、天蓝与酸柠、细线框、胶带标签与杂志排版。
  主视觉是白色照片框，圆角药丸按钮；适合治愈、日常与轻量游戏。
- **深夜广播 BROADCAST**（附赠主题）：灰阶极简、颗粒、黑胶、虚线路由、巨大幽灵字与细线排版。
  封面去色，只保留一处暗红危险色；适合文字冒险、悬疑、恐怖与深夜氛围。

![终末地 · 外观工作室](docs/screenshot-endfield-appearance.jpg)
![终末地 · 启动序列](docs/screenshot-endfield-intro.jpg)
![星轨秘典 · 首页](docs/screenshot-codex-home.jpg)
![零点街区 · 首页](docs/screenshot-zerohour-home.jpg)
![神秘管理局 · 首页](docs/screenshot-mnemo-home.jpg)
![星轨秘典 · 右键菜单](docs/screenshot-codex-context.jpg)
![零点街区 · 右键菜单](docs/screenshot-zerohour-context.jpg)
![舞台残响 · 首页](docs/screenshot-riot-home.jpg)
![冒险者档案 · 详情](docs/screenshot-grimoire-detail.jpg)
![十一套主题 · 主题面板](docs/screenshot-theme-cards.jpg)

十一套主题的卡片预览使用同一套概念板骨架（眉标 / 左侧大字标 / 右侧样张框 / 底部 command strip），
只换各自的颜色、字体和材质；以后新增主题也按这个模板做，规范见 `docs/THEMES.md` 第 13 节。
每套主题交付前还必须过一遍 **`docs/THEME-COVERAGE.md`**：右键菜单、`select`、构图控件、
启动/睡眠、详情/外观预览等全部界面状态都列在里面。

主题可以自己写。把一个文件夹放进主题目录即可：

```
%LOCALAPPDATA%\NOVA Game Space\themes\my-theme
├─ theme.json
├─ theme.css
├─ preview.jpg
└─ assets/
```

点「打开主题文件夹」可以直接跳过去，放好后点「刷新」。
完整规范见 **[docs/THEMES.md](docs/THEMES.md)**，示例见 `themes/aurum/` 与 `themes/endfield/`。
继续精修主题时先读 **[docs/HANDOFF-THEMES.md](docs/HANDOFF-THEMES.md)**：
里面有逐主题进度、配色占比量表（`tools/measure-ratio.py`）与已知差距。

主题可以只换配色（`tokens`），也可以整套换样式（`theme.css`），还可以在 `theme.json`
里用 `"intro": "endfield"` 选一个开场动画。主题不能执行脚本、读取数据或调用系统接口，
所以可以放心安装别人做的主题。

## 全屏

按 `F` 或玩家菜单里的「全屏显示」进入无边框全屏：窗口铺满当前显示器、隐藏任务栏与窗口按钮。
右上角会出现「退出全屏」小按钮，鼠标静止几秒后会隐藏，移动鼠标重新出现。

## 添加游戏

### 方式一：扫描导入（最快）

按 `A` 打开「导入本机游戏」。程序会同时做三件事：

1. 读取 Steam 库（支持多个库盘、自动识别主程序、优先使用 Steam 缓存封面）；
2. 扫描开始菜单快捷方式；
3. 查找带 `nova-game.json` 清单的游戏。

勾选后点「导入所选」。每款游戏会自动生成主视觉与封面。

### 编辑已有游戏

游戏详情 →「管理」→「编辑游戏信息与封面」可以改：

- 显示名称、中文名、类型、一句话介绍、详细描述；
- 年龄分级、游玩模式；
- **标题字体 / 字标方案**：默认「自动（跟随封面）」，也可以直接指定 8 套字标配方之一；
- 封面图、启动参数、工作目录。

改动保存在 `library.json` 里，下次启动仍然有效。

### 方式二：手动添加

选择 exe，填名字。封面可留空（从图标生成）。高级选项（启动参数、工作目录、描述）都在同一个面板里。
选文件的窗口是程序自带的浏览器，可以直接切盘符、看文件夹，不需要系统对话框。

### 方式三：清单文件（推荐给发行方 / 批量适配）

在游戏根目录放一个 `nova-game.json`：

```json
{
  "schema": 1,
  "name": "Lumen Vale",
  "zh": "流明谷",
  "exe": "bin/game.exe",
  "genre": "叙事·解谜",
  "ageRating": "12+",
  "tagline": "在会发光的山谷里，找回一段被折叠的时间。",
  "hero": "art/hero.jpg",
  "accent": "#f2b46a",
  "accent2": "#7f8fe8"
}
```

选中这个 exe 时，程序会读出清单并自动填好全部字段。
完整的字段表、素材规范、校验清单见 **[docs/INTEGRATION.md](docs/INTEGRATION.md)**。

---

## 数据保存在哪里

所有数据都在本机，不上传：

```
%LOCALAPPDATA%\NOVA Game Space\
├─ library.json      游戏库、设置、游玩时长与每次会话记录
├─ media\            为每款游戏生成的 hero.jpg / cover.jpg
├─ backups\          每日自动备份（NOVA-auto-*.nova-pack，保留 5 份）
├─ webview2\         界面缓存
└─ nova.log          运行日志（排查问题用）
```

玩家菜单 →「打开数据文件夹」可以直接打开。
备份或迁移：在「设置 → 数据与备份」导出 `.nova-pack`，复制到另一台电脑后导入；也可以直接复制 `library.json`、`media\` 与 `backups\`。

### 移除游戏会删除什么

只删除库记录与 NOVA 缓存里的封面。**不会**动游戏目录、存档或 Steam 文件。

---

## 设计说明

界面沿用原型的 NOVA 设计语言，并在真实数据上做了必要调整：

- **一枚胶囊按钮**：所有游戏、所有模式共用同一个按钮形状、字号与图标；只有颜色随封面变。
  按钮文字黑/白由封面亮度算出，不靠猜。
- **封面驱动**：主色、副色、光晕、遮罩、标题字标全部来自封面采样。
  采样值（亮度、饱和度、暖度、边缘密度）决定从 8 套预设字标配方里选哪一套。
- **默认主题的按钮算法保持原样**：NOVA 原生仍从封面采样主色/副色与亮度，
  由 `applyCtaVars` 计算按钮渐变和文字黑/白；AURUM 作为附赠主题才使用固定的羊皮纸与鎏金配色。
- **两套外观语言**：「跟随封面」让每款游戏有独立气质；「NOVA 默认」切换成统一的编辑式衬线排版。
- **沉稳模式**：更短的位移、更长的时长、无弹跳、无视差、无闪烁。适合长时间使用或投到大屏幕上。
- **启动编排**：黑边收拢 → 标题升起 → 环形进度与三步流程 → 就绪提示；退出时反向收束。
- **主题开场**：开场是独立注册表里的命名预设（`gilded` / `aurum` / `endfield` / `ink` / `veil` …），
  主题清单只写预设 id。新增预设不需要改启动流程，也不会影响其他主题。
- **终末地主题的排版**：一个强调色只表示当前位置与可操作内容；切角只给可按的东西，
  展示容器保持直角；英文眉标宽体大写，中文粗体；编号、日期、游戏数都是真实数据。
  封面不再用模糊铺底或渐变遮罩，而是满幅 `cover` + 墨色铭牌 + 纸面编号条。
- **主题拥有自己的调色板**：选中带 CSS 的主题后，封面配色只参与背景遮罩，
  不再改写按钮、徽章、进度文字的颜色，避免蓝色或粉色从封面漏进主题 UI。
- **动效分级**：系统「减少动效」、应用内「沉稳模式」、低性能设备各有独立策略；
  低性能时自动关闭背景模糊、噪点与漂移，而不是让界面掉帧。
- **焦点管理**：所有弹层都有焦点陷阱与关闭后的焦点恢复；手柄与键盘共享一套导航。
- **图片永不拉伸**：全屏主视觉用 `cover`；封面统一 16:9。详情页与外观预览在默认 / AURUM 主题里用完整图加模糊铺底；
  终末地主题改为满幅 `cover` + 墨色铭牌 + 纸面编号条，避免玻璃感。

素材来源：封面图来自用户提供的参考图；界面音效来自
[Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds)（CC0，可商用），
授权文本见 `src/assets/sfx/LICENSE-SFX.md`（Kenney Interface Sounds，CC0）。

---

## 项目结构

```
nova-game-space-desktop/
├─ NovaGameSpace.csproj      .NET 10 + WPF + WebView2
├─ App.xaml(.cs)             应用入口
├─ MainWindow.xaml(.cs)      无边框窗口、托盘、关闭确认
├─ NativeBridge.cs           原生能力 ↔ 网页界面的消息桥
├─ Services/
│  ├─ LibraryModels.cs       数据模型
│  ├─ StoreService.cs        本地库读写、数据迁移
│  ├─ MediaService.cs        裁图、图标合成、封面生成
│  ├─ CoverAnalyzer.cs       封面采样（DNA）
│  ├─ LauncherService.cs     启动、会话、计时、崩溃判定
│  ├─ GameScanner.cs         Steam 库 / 开始菜单 / 清单扫描
│  ├─ ManifestImporter.cs    nova-game.json 解析
│  ├─ FileBrowser.cs         应用内文件浏览
│  ├─ ThemeService.cs        主题发现、校验、安装
│  └─ ShortcutResolver.cs    .lnk 解析
├─ src/                      界面
│  ├─ index.html  app.js  gamepad.js  overlays.js  theme-engine.js
│  ├─ motion.js              动效策略 / 性能分级 / 系统减少动效
│  ├─ focus.js               焦点陷阱、焦点恢复、输入模态
│  ├─ surfaces.js            模式/弹层注册表（打开、关闭、inert、焦点）
│  ├─ intro.js               开场动画注册表（按主题选预设）
│  ├─ base.css  theme.css  type.css  app.css  motion.css
│  ├─ cta-palettes.css       原生默认主题的手调按钮配色
│  ├─ dialogs.css  themes.css  polish.css  intro.css
│  ├─ fonts.css  自托管字体
│  └─ assets/    sfx/（CC0 音效）、backdrop.jpg、demo/
├─ themes/aurum/             自带主题：鎏金圣所 AURUM
├─ themes/endfield/          自带主题：终末地 ENDFIELD
├─ build/icon.ico            主图标（tools/make-icon.py 可复现）
├─ docs/INTEGRATION.md       非 Steam 游戏接入规范
├─ docs/THEMES.md            主题开发规范
├─ docs/DESIGN-PHILOSOPHY.md 设计理念 / 11 套主题卡 / 维护手册
├─ docs/HANDOFF-THEMES.md    主题精修交接（进度 / 量化方法 / 历史细节）
├─ docs/HANDOFF-NEXT.md      下一轮交接（1.5.3 状态 / 待办 / 验收 / 不要回退的约定）
└─ tools/                    开发期使用的验证脚本
```

---

## 开发与打包

```bash
# 运行
dotnet run

# 发布自包含单目录版本
dotnet publish -c Release -r win-x64 --self-contained true \
  -p:PublishReadyToRun=true -o publish
```

发布产物在 `publish/`，约 163 MB（含 .NET 运行时与本地字体）。

正式发布建议使用流水线，默认产出两个 Legacy 包：

```bash
bash tools/pipeline.sh                 # 审计 + 单文件版 + 全主题文件夹版
bash tools/pipeline.sh --skip-audit    # 快速打包
bash tools/pipeline.sh --modern        # 额外产出 Modern 自包含大包
```

- **单文件版**：约 **2.34 MB** zip，只有一个 `NovaGameSpace-Legacy.exe`，
  前端与 11 套主题内嵌；首次运行解压到数据目录。
- **全主题文件夹版**：约 **3.81 MB** zip，EXE + `src/` + `themes/`，
  主题可直接编辑。

Legacy 包依赖 .NET Framework 4.8 + WebView2（Win10/11 通常已内置；Win7 用 109），
解压后双击 `launch.cmd`。详见 [docs/RELEASE.md](docs/RELEASE.md) 与
[legacy/README.md](legacy/README.md)。

---

## 系统兼容性

- **Modern 构建（当前发布）**：Windows 10 1809+ / Windows 11，.NET 10，WebView2 Evergreen，完整效果。
- **Legacy 构建（已落地）**：Windows 7 SP1 / 8.1，.NET Framework 4.8 + WebView2 109，安全档；`bash tools/build-legacy.sh`，详见 [legacy/README.md](legacy/README.md)。
- 启动时会自动读取 Windows 版本与 WebView2 版本，写入 `html[data-tier]`：
  `full`（完整）/ `balanced`（无 color-mix）/ `safe`（低特效，旧系统）。
- 设置 → 系统与兼容性可查看检测结果并手动切换档位。
- `NovaGameSpace.exe`（Modern）需要 Win10 1809+；Win7/8.1 请使用
  `NovaGameSpace-Legacy.exe`（Legacy 宿主）。两者共用数据目录与 `.nova-pack`，
  方案见 [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md)。

---

## 已知限制

- 只支持 Windows；当前发布版需要 Windows 10 1809+（Win7/8.1 用 Legacy 构建）。
- 计时跟随被启动的那个进程；若游戏先启动自身启动器再拉起本体，统计的是启动器存活时长。
- 不绕过 DRM、不改游戏文件、不注入进程。
- Steam 封面取的是本地缓存；缓存里没有的游戏会用 exe 图标生成封面。
- 通知只保存在当前会话，退出程序后清空。

---

## 许可

界面与程序代码为本项目所有。第三方素材：

- 字体：思源黑体 / 思源宋体（Source Han Sans / Serif，SIL OFL）。程序不再内置西文字体；
  未安装时会回退到 Noto Sans SC / Noto Serif SC / 微软雅黑 / 宋体。
- 音效：Kenney Interface Sounds，CC0 1.0。
