# 发布与打包

> 目标：一条命令产出**最小依赖、最小体积、Win7/10/11 都能打开**的离线包。
> 默认发布 **Legacy 包（约 3.1 MB zip / 6.9 MB 解压）**；Modern 自包含包作为可选大包。

---

## 1. 一条命令

```bash
bash tools/pipeline.sh                 # 审计 + Legacy 包
bash tools/pipeline.sh --skip-audit    # 快速打包（跳过截图审计）
bash tools/pipeline.sh --modern        # 额外产出 Modern 自包含大包
bash tools/pipeline.sh --version 1.5.1 # 先 bump 版本再打包
```

产物：

```
dist/
├─ NOVA-<version>-legacy/            # 解压即用
├─ NOVA-<version>-legacy.zip         # 约 3.1 MB
├─ NOVA-<version>-modern/            # 可选，大包
├─ NOVA-<version>-modern.zip
└─ release-manifest.json             # 大小 + SHA-256
```

流水线步骤：

1. `tools/bump-version.js`（可选）：同步 csproj / index.html / version.json。
2. `relaunch.sh` + `export-all.js --views=all` + `probe-graphics.js`（审计）。
3. `tools/build-legacy.sh Release`（net48，SDK 7）。
4. 可选 `dotnet publish` Modern（self-contained single-file）。
5. `tools/package-release.py`：复制运行时、`src/`、`themes/`、启动脚本、README，打 zip 并写 manifest。

---

## 2. 包内容

### Legacy（推荐）

```
NovaGameSpace-Legacy.exe      net48 宿主
*.dll / runtimes/             WebView2 + System.Text.Json
src/                          同一套前端资源
themes/                       11 套主题与预览
launch.cmd                    依赖检查 + 启动
README.txt                    使用说明
WebView2Runtime/              可选：放入 109 固定运行时
version.json
```

- 体积：解压 **6.9 MB**，zip **3.1 MB**。
- 依赖：**.NET Framework 4.8** + **WebView2 Runtime**。
  - Win10 1903+ / Win11：通常都已内置。
  - Win7 SP1 / 8.1：需要安装 .NET 4.8 与 WebView2 **109**；也可把 109 固定运行时解压到 `WebView2Runtime/`（须包含 `msedgewebview2.exe`）。
- `launch.cmd` 会检查 .NET 4.8 Release ≥ 528040 和 WebView2 注册表；缺失时给出说明，不静默失败。
- Win7/8.1 自动进入 `safe` 档；Win10/11 在 WebView2 ≥111 时仍是 `full` 效果。

### Modern（可选）

- 自包含 .NET 10（无需安装 .NET），但体积大（约 60–100 MB zip）。
- 仍需 WebView2 Runtime；Win7 不支持（.NET 10 限制）。
- 适用：没有 .NET Framework 4.8 的 Win10/11 机器，或想避免依赖系统 .NET 的用户。

---

## 3. 开发者测试条目

测试用的“假游戏”（notepad/calc/powershell 等系统目录手动条目）默认**不会出现在正常界面**：

- `GameEntry.DeveloperOnly` 标记；`StoreService.Normalize` 会把系统目录下的 manual 条目自动标记。
- boot 只返回非测试条目；统计也排除它们。
- 开发者打开：
  - 设 `NOVA_DEV=1` 环境变量；或
  - 在应用内按 **Ctrl+Shift+D**（写入 `settings.developerMode` 并重新载入）。
- 测试条目仍保留在 `library.json`，不会删除；导出的 `.nova-pack` 也保留标记，在别的电脑上默认隐藏。

---

## 4. 版本与共同更新

- `version.json` 是唯一版本源；`tools/bump-version.js <x.y.z>` 更新 csproj 与所有静态 `?v=`。
- Modern / Legacy 必须同版本号；都读取同一个 `library.json` 与 `.nova-pack`。
- 发布前检查：
  - `dotnet build -c Debug` 0 错误
  - `bash tools/build-legacy.sh Release` 0 错误
  - `export-all` 0 告警、`probe-graphics` 全 clear
  - Win7 SP1 虚拟机 + WebView2 109 跑一遍 §4.3（见 `docs/COMPATIBILITY.md`）
- 不包含自动更新器；用户自行替换程序目录，数据目录不动。

---

## 5. 数据位置

```
%LOCALAPPDATA%\NOVA Game Space
├─ library.json
├─ media/
├─ backups/        # 每日自动备份，保留 5 份
├─ webview2/       # 缓存；可用 NOVA_CACHE_ROOT 指向其他盘
└─ nova.log
```

迁移使用设置 → 数据与备份 → 导出 `.nova-pack`；不包含游戏本体与主题。
