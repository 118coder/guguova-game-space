# NOVA 游戏空间 · 桌面版

把一台 PC 变成一个电影感的游戏空间：一张主视觉、一排游戏、一次按键就进入游戏。
这是 `nova-game-space` 网页原型落成的真正可运行 Windows 程序——不是模拟，是真实启动。

![首页](docs/screenshot-home.jpg)

---

## 快速开始

1. 解压 `NOVA-Game-Space-1.1.0.zip` 到任意目录（例如 `D:\NOVA`）。
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
| 任意游戏接入 | 手动添加 exe，或使用 `nova-game.json` 清单（见下） |
| 封面生成 | 你提供图片就裁成 16:9；不给就抓 exe 图标，合成带光晕的主视觉 |
| 配色采样 | 从封面提取主色、副色、亮度与边缘密度，驱动按钮渐变与标题字标 |
| 手柄操控 | Xbox / PlayStation 全套导航，含屏幕上的按键提示条 |
| 沉稳模式 | 削减动画、去掉视差与弹跳，整体更安静、更稳定 |
| 睡眠模式 | 大时钟待机，任意键唤醒 |
| 托盘常驻 | 关窗时可选最小化到托盘，继续记录游戏时长 |
| 真全屏 | 无边框全屏铺满显示器并隐藏任务栏，右上角可随时退出 |
| 统一界面 | 所有确认、文件选择、右键菜单都是应用内界面，不出现系统弹窗 |
| 主题扩展 | 一套 CSS + 图标即可整套换皮；主题不能执行代码，可安全分享 |
| 自带主题 | 内置「深渊 ABYSS」：锻造金属、青铜切角、青色能量条 |

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
| 右键 | 打开 NOVA 菜单 |
| `/` | 搜索 |
| `R` | 外观工作室里重新编排字标 |
| `Esc` | 返回 / 关闭当前层 |

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

「外观 → 界面主题」里有两套：

- **NOVA 原生**：默认的电影感外观，按钮颜色跟随封面。
- **深渊 ABYSS**：锻造金属底、青铜描边、切角按钮、青色能量条。

主题可以自己写。把一个文件夹放进主题目录即可：

```
%LOCALAPPDATA%\NOVA Game Space\themes\my-theme
├─ theme.json
├─ theme.css
├─ preview.jpg
└─ assets/
```

点「打开主题文件夹」可以直接跳过去，放好后点「刷新」。
完整规范见 **[docs/THEMES.md](docs/THEMES.md)**，示例见 `themes/abyss/`。

主题只能改样式和图标，不能执行脚本、读取数据或调用系统接口，所以可以放心安装别人做的主题。

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
├─ library.json      游戏库、设置、游玩时长
├─ media\            为每款游戏生成的 hero.jpg / cover.jpg
├─ webview2\         界面缓存
└─ nova.log          运行日志（排查问题用）
```

玩家菜单 →「打开数据文件夹」可以直接打开。
备份或迁移：复制 `library.json` 与 `media\` 两个即可。

### 移除游戏会删除什么

只删除库记录与 NOVA 缓存里的封面。**不会**动游戏目录、存档或 Steam 文件。

---

## 设计说明

界面沿用原型的 NOVA 设计语言，并在真实数据上做了必要调整：

- **一枚胶囊按钮**：所有游戏、所有模式共用同一个按钮形状、字号与图标；只有颜色随封面变。
  按钮文字黑/白由封面亮度算出，不靠猜。
- **封面驱动**：主色、副色、光晕、遮罩、标题字标全部来自封面采样。
  采样值（亮度、饱和度、暖度、边缘密度）决定从 8 套预设字标配方里选哪一套。
- **两套外观语言**：「跟随封面」让每款游戏有独立气质；「NOVA 默认」切换成统一的编辑式衬线排版。
- **沉稳模式**：更短的位移、更长的时长、无弹跳、无视差、无闪烁。适合长时间使用或投到大屏幕上。
- **启动编排**：黑边收拢 → 标题升起 → 环形进度与三步流程 → 就绪提示；退出时反向收束。
- **图片永不拉伸**：全屏主视觉用 `cover`；封面统一 16:9；详情页用完整图加模糊铺底。

素材来源：封面图来自用户提供的参考图；界面音效来自
[Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds)（CC0，可商用），
授权文本见 `src/assets/sfx/LICENSE-Kenney.txt`。

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
│  ├─ base.css  theme.css  type.css  app.css  motion.css
│  ├─ dialogs.css  themes.css
│  ├─ fonts.css  自托管字体
│  └─ assets/    sfx/（CC0 音效）、backdrop.jpg、demo/
├─ themes/abyss/             自带主题：深渊 ABYSS
├─ docs/INTEGRATION.md       非 Steam 游戏接入规范
├─ docs/THEMES.md            主题开发规范
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

---

## 已知限制

- 只支持 Windows。
- 计时跟随被启动的那个进程；若游戏先启动自身启动器再拉起本体，统计的是启动器存活时长。
- 不绕过 DRM、不改游戏文件、不注入进程。
- Steam 封面取的是本地缓存；缓存里没有的游戏会用 exe 图标生成封面。
- 通知只保存在当前会话，退出程序后清空。

---

## 许可

界面与程序代码为本项目所有。第三方素材：

- 字体：Manrope、Space Grotesk（SIL OFL），Cormorant Garamond、Bebas Neue（SIL OFL）。
- 音效：Kenney Interface Sounds，CC0 1.0。
