# NOVA Legacy 宿主（Win7 / 8.1）

这是与 Modern 版共用同一套 `src/` 与 `themes/` 的 `.NET Framework 4.8` 宿主。
它固定使用 WebView2 SDK 1.0.1774.30（运行时 109 系列），用于 Windows 7 SP1 /
Windows 8.1；系统判定会自动切到 `safe` 档。

## 构建

```bash
# 需要 .NET SDK 7 + .NET Framework 4.8 Developer Pack
bash tools/build-legacy.sh             # Release
bash tools/build-legacy.sh Debug       # Debug
```

`legacy/global.json` 把 SDK 固定为 7.0.401。**不要**从仓库根目录直接
`dotnet build legacy/NovaGameSpace.Legacy.csproj`（会用 SDK 10 的 WPF 编译器）。
构建产物：`legacy/bin/<Config>/net48/NovaGameSpace-Legacy.exe`。

## 运行

```bash
NOVA_CDP_PORT=9224 \
NOVA_CACHE_ROOT="$(pwd)/.cache/webview2-legacy" \
./legacy/bin/Debug/net48/NovaGameSpace-Legacy.exe
```

## Win7 运行前提

- Windows 7 SP1 + SHA-2 更新（KB4474419）
- .NET Framework 4.8
- WebView2 Runtime **109.0.1518.78**（最后一个支持 Win7/8.1 的版本）

## 数据

与 Modern 版共用 `%LOCALAPPDATA%\NOVA Game Space` 的 `library.json`、`media/`、
`backups/`；`.nova-pack` 可在两者之间互相导入。单实例互斥锁两者共用，不能同时运行。

完整方案与验收矩阵见 [`../docs/COMPATIBILITY.md`](../docs/COMPATIBILITY.md)。
