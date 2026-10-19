# 兼容性与长期维护方案

> 目标：**Win10/11 跑完整效果，老系统自动降级仍可启动游戏**；同一套 Web 资源与主题，
> 长期只维护一份前端代码。

---

## 1. 当前交付形态（2026-10-19）

| 构建 | 目标框架 | 系统 | WebView2 | 档位 | 状态 |
|---|---|---|---|---|---|
| **Modern**（当前发布） | `net10.0-windows` | Win10 1809+ / Win11 | Evergreen（当前 156） | `full` | ✅ 已构建/验收 |
| **Legacy**（已落地） | `.NET Framework 4.8` | Win7 SP1 / Win8.1 | 固定 109.0.1518.78 | `safe` | ✅ 已构建；Win10/11 已跑通，Win7 VM 待验收 |

> **交付形态**：Modern 版仍是 `NovaGameSpace.exe`（.NET 10，Win10 1809+）；
> Win7/8.1 使用 `legacy/NovaGameSpace.Legacy.csproj` 产出的
> `NovaGameSpace-Legacy.exe`（net48 + WebView2 109），与 Modern 共用
> `src/`、`themes/` 与数据格式。直接用 SDK 10 多目标 net48 会报
> `System.Private.CoreLib`，因此 Legacy 工程用 `legacy/global.json` 固定 SDK 7，
> 通过 `bash tools/build-legacy.sh` 构建。

---

## 2. 自动判定（已实现）

`Services/SystemProfile.cs` 在 boot 时输出：

```json
{
  "osLabel": "Windows 11", "major": 10, "minor": 0, "build": 26200,
  "isWindows7": false, "isWindows8": false, "isWindows10": false, "isWindows11": true,
  "webView2Version": "156.0.4314.23", "webView2Major": 156,
  "supportColorMix": true, "supportBackdropFilter": true,
  "legacyHost": false, "tier": "full", "tierLabel": "完整效果",
  "notes": "完整效果：现代 WebView2，全部主题动画与纹理可用。"
}
```

判定规则：

| 条件 | 档位 |
|---|---|
| Win7 / Win8.1，或 Legacy 宿主 | `safe` |
| WebView2 < 111（`color-mix()` 从 Chromium 111 才有） | `balanced` |
| Win10/11 + WebView2 ≥ 111 | `full` |

- 设置页「系统与兼容性」显示系统、WebView2、档位，并可手动覆盖为
  `auto / full / balanced / safe`（写入 `settings.compatibilityTier`）。
- 覆盖后立即 `getSystem` 重新计算并写 `html[data-tier]`，不需要重启。
- 安全夹取：旧系统选 `full` 会被夹到 `safe`；没有 `color-mix` 的运行时选 `full` 会被夹到 `balanced`。

---

## 3. 档位行为

| 档位 | 保留 | 关闭 |
|---|---|---|
| `full` | 全部主题、动画、颗粒、视差、开屏、主题切换幕布 | — |
| `balanced` | 布局、主题、文字、主要过渡 | `backdrop-filter`、全屏颗粒、开屏粒子/光斑、场景漂移；`color-mix` 关键描边用 `--accent` 兜底 |
| `safe` | 布局、主题、文字、按钮、数据/设置/启动功能 | 开屏、颗粒、场景装饰、全部重动画与过渡、`backdrop-filter`；按钮/选中态用纯色兜底 |

实现：

- `src/compat.css`：按 `html[data-tier]` 覆盖；`theme-engine.js` 在主题 CSS 之后
  重新 append 该样式表，保证压过主题签名。
- `src/app.js`：`applySystemTier()` 写 `data-tier`；`safe` 跳过开屏、关闭视差与主题幕布动画。
- JS 读取 `state.system.tier`；主题作者不需要写兼容代码，除非自定义效果。

---

## 4. Legacy 宿主（Win7 / Win8.1）

### 4.0 构建

```bash
bash tools/build-legacy.sh          # Release
bash tools/build-legacy.sh Debug    # Debug
```

产物：`legacy/bin/<Config>/net48/NovaGameSpace-Legacy.exe`。
`legacy/global.json` 固定 .NET SDK 7.0.401；构建机需要 .NET Framework 4.8
Developer Pack。**不要**从仓库根目录直接 `dotnet build legacy/...`。

### 4.1 目标

- `net48` WPF 宿主，复用 **同一套** `src/`、`themes/`、`Services/`（排除现代 API）。
- 固定 WebView2 Runtime **109.0.1518.78**（最后一个支持 Win7/8.1 的版本）。
- 输出 `NovaGameSpace-Legacy.exe`，与 Modern 版同版本号、同数据目录格式。
- 默认 `safe` 档；如果运行时是 110+（Win10 上的 Legacy 构建）可升 `balanced`。

### 4.2 工程方式

不要在 Modern 工程里直接 `<TargetFrameworks>net10.0-windows;net48</TargetFrameworks>`。
用独立工程（例如 `legacy/NovaGameSpace.Legacy.csproj`）：

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net48</TargetFramework>
    <UseWPF>true</UseWPF>
    <UseWindowsForms>true</UseWindowsForms>
    <LangVersion>latest</LangVersion>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.Web.WebView2" Version="1.0.1774.30" />
    <PackageReference Include="System.Text.Json" Version="8.0.5" />
    <PackageReference Include="Microsoft.NETFramework.ReferenceAssemblies" Version="1.0.3" PrivateAssets="all" />
  </ItemGroup>
  <ItemGroup>
    <Compile Include="..\Services\**\*.cs" Exclude="..\Services\*.ModernOnly.cs" />
    <Compile Include="..\NativeBridge.cs" />
    <Compile Include="..\MainWindow.xaml.cs" />
    <Page Include="..\MainWindow.xaml" />
    <Content Include="..\src\**\*" />
    <Content Include="..\themes\**\*" />
  </ItemGroup>
</Project>
```

要点：

1. **WebView2 SDK 用 109 对应包**（1.0.1774.x），不要用 2903 包；运行时固定 109。
2. `Services/CompatUtil.cs` 已提供：
   - `RelativePath()`（替代 `Path.GetRelativePath`）
   - `ExtractZip()`（替代 `ZipFile.ExtractToDirectory(..., true)`）
   - `IsExternalInit`（records / init 在 net48 的标记）
3. `MediaService` 已去掉 `value[2..]` 范围语法，改 `Substring(2)`。
4. `SystemProfile` 使用 `RtlGetVersion`，net48 可用；WebView2 版本读取失败时按 `safe`。
5. Legacy 工程只引用能编译的 `Services`；如个别服务用现代 API，拆到
   `*.ModernOnly.cs` 或加 `#if NETFRAMEWORK`。
6. 构建机要求：VS 2022 / .NET SDK 7、.NET Framework 4.8 Developer Pack。
7. Win7 运行前提：Win7 SP1 + KB4474419/SHA-2 更新 + .NET Framework 4.8 + WebView2 109。

### 4.3 验收

- Win7 SP1 虚拟机：启动、扫描游戏、启动进程、计时、设置、导出/导入、主题切换、关闭到托盘。
- Win10：Legacy 构建可运行，`getSystem` 应报 `balanced`（如果 110+）或 `safe`（109）。
- Modern 构建：`full`，现有 330+ 张截图与 `probe-graphics` 基线不变。
- 已在本机 Win11 上用 WebView2 156 跑通 Legacy 宿主：
  `legacyBuild=true`、6 款游戏、设置页、导出数据包、手动 safe 档均正常。
  强制 safe 后重启：`is-booted=true`、`is-intro=false`、`tier=safe`。
- 仍待 Win7 SP1 虚拟机 + WebView2 109 实机复测（见 §7）。

---

## 5. 共同更新方案

### 5.1 单一版本源

- `version.json`：`version` / `legacyVersion` / `webView2` 固定版本。
- `tools/bump-version.js <x.y.z>`：一次更新
  - `NovaGameSpace.csproj` 的 `<Version>`
  - `src/index.html` 全部 `?v=` 静态资源查询
  - `version.json`
- `NativeBridge.BuildBootPayload()` 的 `version` 读取
  `Assembly.GetName().Version`，不再手写。

### 5.2 一套前端，两个宿主

```
src/           ← 唯一前端源（Modern + Legacy 共用）
themes/        ← 唯一主题源
Services/      ← 纯逻辑；现代 API 用 CompatUtil 或条件编译隔离
Modern host    ← net10.0-windows（Win10/11，full）
Legacy host    ← net48（Win7/8.1，safe）
docs/          ← 同一份接口文档
```

**规则**：

1. 新功能先判断是否依赖现代 API；需要时用 `CompatUtil` 或 `#if NETFRAMEWORK`，
   不要把 Modern-only 代码直接塞进共享 `Services`。
2. 新 CSS 不用 `color-mix` 作为**唯一**颜色来源；关键文字/背景必须有纯色 fallback。
3. 新动画/特效写在 `full` 生效的选择器里；`balanced/safe` 通过 `compat.css` 关闭。
4. 每个版本同时产出 Modern 与 Legacy（Legacy 未通过 Win7 验收时只在内部通道）。
5. 发布包为离线 zip，不包含自动更新器；用户自行替换版本。
6. 数据格式（`library.json` / `.nova-pack`）保持向后兼容；新增字段只加不改。

### 5.3 发布检查表

```bash
node tools/bump-version.js 1.6.0
dotnet build -c Release
# Legacy: dotnet build legacy/NovaGameSpace.Legacy.csproj -c Release
node tools/export-all.js --views=all --sizes=1439x1124,960x600 --stress
node tools/probe-graphics.js
# Win7 VM: 启动 / 扫描 / 启动游戏 / 计时 / 导出导入 / 主题 / 托盘
```

- Modern：0 告警、`probe-graphics` 全 clear。
- Legacy：`getSystem.tier=safe`；`color-mix` 不可用时文字/按钮仍可读。
- 两个包版本号一致；`library.json` 可互相导入。

---

## 6. 当前已验证

- 本机：Windows 11 build 26200，WebView2 156.0.4314.23 → `tier=full`。
- 设置页手动切 `safe` → `data-tier=safe`、`.grain` 与 `.intro` 隐藏、
  设置页显示「安全档 · 低特效」；切回 `auto` → `full`。
- `compat.css` 在主题 CSS 之后注入，主题签名不会反向覆盖。
- Modern 构建保持 0 错误；设置/核心视图审计通过。

## 7. 下一步

1. ~~新建 `legacy/NovaGameSpace.Legacy.csproj`，先让它在 Win10 跑通。~~ **已完成**。
2. Win7 SP1 虚拟机安装 .NET 4.8 + WebView2 109，跑 §4.3 验收。
3. 把 `bump-version.js` 接入发布脚本，同时产出
   `NOVA-<version>-modern.zip` 与 `NOVA-<version>-legacy.zip`。
4. 为 `safe` 档补一轮 Win7 截图，确认纯色兜底不压字。
