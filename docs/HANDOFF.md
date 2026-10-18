# NOVA 交接文档

> 写给接手这个项目的人（或下一个 AI 会话）。
> 最后更新：2026-10-19 · 对应版本 1.1.0

先读这一页，再按需跳到具体章节。文中所有路径都相对于仓库根目录。

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
│  ├─ index.html             全部界面结构 + SVG 图标库
│  ├─ app.js                 主逻辑（最大的一份，约 3.8k 行）
│  ├─ gamepad.js             手柄轮询与按键映射
│  ├─ overlays.js            应用内对话框 + 文件浏览器
│  ├─ theme-engine.js        主题加载与图标替换
│  ├─ base.css / type.css    原型的控制台设计系统
│  ├─ theme.css              按钮、管理面板、外观工作室
│  ├─ app.css                桌面版补充（编辑器、扫描器、空状态）
│  ├─ motion.css             启动动画、沉稳模式、手柄提示条
│  ├─ dialogs.css            对话框、文件浏览器、全屏小按钮
│  ├─ themes.css             主题卡片 + 右键菜单
│  ├─ fonts.css              自托管字体（离线可用）
│  └─ assets/                音效（CC0）、背景图、示例图
│
├─ themes/abyss/             自带主题：深渊 ABYSS
├─ docs/
│  ├─ INTEGRATION.md         非 Steam 游戏接入规范
│  ├─ THEMES.md              ★ 主题开发规范
│  └─ HANDOFF.md             本文件
└─ tools/                    开发期验证脚本（不参与发布）
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

---

## 6. 踩过的坑（别重复踩）

**#1 csproj 里 `src\**\*` 通配会在增量构建时漏掉新文件**
新建的 JS/CSS 不会自动打进输出目录。解决方式：渲染层文件逐个 `<Content Include>`。
新增文件时**必须**在 csproj 里加一行，否则运行时报 404。

**#2 WebView2 虚拟主机会缓存文件，`?v=` 查询串无效**
改完主题 CSS 刷新看不到变化就是这个原因。现在的做法是在 `theme-engine.js` 里
用 `fetch(url, {cache:'no-store'})` 取文本再内联成 `<style>`。
如果以后加别的运行时资源，注意同样的问题。

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
- 主题系统 + 自带 ABYSS 主题 + 主题开发文档
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
可以做一套 ABYSS 风格的图标，验证整条链路；
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

- [ ] 启动 → 首页显示当前游戏
- [ ] 点开始游戏 → 启动画面走到 100% → 游戏真的打开
- [ ] 关闭游戏 → 通知出现，时长增加
- [ ] 最大化 → 铺满屏幕，无任务栏
- [ ] 右键 → NOVA 菜单（不是浏览器菜单）
- [ ] 外观 → 切主题 → 按钮/描边立刻变化
- [ ] 添加游戏 → 文件浏览器选 exe → 封面生成
- [ ] 手柄连上 → 底部出现按键提示 → A 启动

---

## 10. 改代码时的约定

1. **渲染层新增文件必须写进 csproj**（坑 #1）。
2. **不要在主题 CSS 里改布局**，只改外观。
3. **桥接方法保持幂等**，前端可能重试。
4. **中文文案短**。这个界面在大屏上看，句子不超过一行半。
5. **所有确认走 `NovaOverlays.dialog`**，不要引入系统弹窗。
6. **改完跑一遍手工验收清单**，尤其是启动与计时。
7. 提交前 `dotnet build -c Debug` 必须零错误；警告可以留。

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
| 主题 / theme | 一套 CSS + 图标，整套替换外观 |
