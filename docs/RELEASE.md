# 发布与打包

> 默认发布 **Legacy 单文件版（1.7.0 约 3.71 MB zip）**：一个 `NovaGameSpace-Legacy.exe`，
> 前端资源与 12 套主题全部内嵌；同时产出 **全主题文件夹版（1.7.0 约 6.55 MB zip）**，
> 方便编辑/替换主题。Modern 自包含包为可选大包。

---

## 1. 一条命令

```bash
bash tools/pipeline.sh                 # 审计 + 两个 Legacy 包
bash tools/pipeline.sh --skip-audit    # 快速打包
bash tools/pipeline.sh --modern        # 额外产出 Modern 自包含大包
bash tools/pipeline.sh --version 1.5.3 # bump + 构建 + 打包
```

产物：

```
dist/
├─ GUGUOVA-<version>-legacy-single.zip   # 单文件 EXE（1.7.0 约 3.71 MB）
├─ GUGUOVA-<version>-legacy-full.zip     # EXE + src/ + themes/（1.7.0 约 6.55 MB）
├─ GUGUOVA-<version>-modern.zip          # 可选大包
└─ release-manifest.json              # SHA-256 + 大小
```

流水线步骤：

1. `bump-version.js`（可选）同步 Modern/Legacy csproj、index.html、version.json。
2. 截图审计 + `probe-graphics`。
3. `tools/build-legacy.sh Release`：打包 `src/`+`themes/` 为内嵌 zip，构建 net48 单文件 exe。
4. 可选 Modern `dotnet publish`。
5. `tools/package-release.py`：生成单文件版/全主题版，zip，写 manifest。

---

## 2. 两个 Legacy 包

### 2.1 单文件版（推荐）

```
NovaGameSpace-Legacy.exe     约 2.6 MB，内含
                              · 全部托管依赖（Costura）
                              · WebView2 原生 loader
                              · src/ + themes/ 的压缩资源
launch.cmd                   依赖检查 + 启动
README.txt
WebView2Runtime/             可选 109 固定运行时
```

- **只有一个 exe**（外加启动脚本/说明）；无 DLL 散落。
- 首次运行把内嵌 `src/` 与 `themes/` 解压到
  `%LOCALAPPDATA%\NOVA Game Space\runtime\<version>\assets`。
- 主题仍会同步到用户主题目录，可在「设置 → 打开主题文件夹」编辑。
- zip：1.7.0 为 **3.71 MB**（12 套主题与音效都封在里面）。

### 2.2 全主题文件夹版

```
NovaGameSpace-Legacy.exe
src/                         前端资源
themes/                      11 套附赠主题文件夹（内置 GUGUOVA 无需文件夹）
launch.cmd / README.txt
```

- 程序目录直接包含全部主题源文件，适合编辑/替换/分享主题。
- 启动时优先使用外部 `src/`/`themes/`，不会重复解压。
- zip：1.7.0 为 **6.55 MB**。

### 2.3 依赖

- **.NET Framework 4.8**：Win10 1903+ / 11 通常已内置；Win7 SP1 / 8.1 需安装。
- **WebView2 Runtime**：Win10 / 11 通常随 Edge 安装；Win7 / 8.1 用 109。
- `launch.cmd` 检查 .NET 4.8 Release ≥ 528040 与 WebView2 注册表；缺失时说明，不静默失败。
- 完全离线：把 109 固定运行时解压到 `WebView2Runtime/`（含 `msedgewebview2.exe`），
  exe 会直接使用该目录。
- Win7/8.1 自动 `safe` 档；Win10/11 + WebView2 ≥111 仍为 `full`。

### 2.4 Modern（可选）

- 自包含 .NET 10，无需安装 .NET；但体积约 60–100 MB zip。
- 仍需 WebView2；Win7 不支持（.NET 10 限制）。

---

## 3. 测试条目隐藏

- 系统目录里的 manual 假游戏自动标记 `DeveloperOnly`，boot/统计默认过滤；
- 开发者用 `NOVA_DEV=1` 或 **Ctrl+Shift+D** 查看；
- 条目仍在 `library.json` / `.nova-pack` 中，不删除。

---

## 4. 版本与发布检查

- `version.json` 是唯一版本源。
- 字体与音效前提：
  - 全主题使用 **思源黑体 CN / 思源宋体**。目标机器未安装时回退到
    Noto Sans SC / Noto Serif SC / 微软雅黑 / 宋体，不会缺字；
  - 若比赛机器必须使用思源字形，先安装字体或另做子集化随包方案；
  - 界面音效为 Kenney Interface Sounds（CC0），来源表在
    `src/assets/sfx/LICENSE-SFX.md`，发布包必须保留该文件。
- 发布前：
  ```bash
  dotnet build -c Debug                    # Modern 0 错误
  bash tools/build-legacy.sh Release      # Legacy 0 错误
  node tools/export-all.js --views=all --sizes=1439x1124,960x600 --stress
  node tools/probe-graphics.js
  ```
- Win7 SP1 虚拟机 + .NET 4.8 + WebView2 109 跑一遍验收（`docs/COMPATIBILITY.md` §4.3）。
- 两个 Legacy 包与 Modern 包版本号一致，共用 `library.json` / `.nova-pack`。

---

## 5. 数据位置

```
%LOCALAPPDATA%\NOVA Game Space
├─ library.json
├─ media/
├─ backups/        # 每日自动备份，保留 5 份
├─ runtime/        # 单文件版解压的前端/主题/loader
├─ webview2/       # 缓存；可用 NOVA_CACHE_ROOT 指向其他盘
└─ nova.log
```

迁移使用设置 → 数据与备份 → 导出 `.nova-pack`；不包含游戏本体与主题。
