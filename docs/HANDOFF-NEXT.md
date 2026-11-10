# GUGUOVA 下一轮交接文档

> 交接版本：**1.16.5 已发布；§1.18–§1.25 已全部合并进 `main`（PR #37/#38/#39），未发版**
> ✅ **终末地导出卡片已按 endfield-ui 技能重做**（§1.25，2026-11-11）：黄线全部改黄块、
> 分隔符 `·`→`/`、Saira 宽体上卡、档案卡重构（原构图有 700px 死白）、并修掉
> **导出卡顶部烧进弹窗三色条**的导出 Bug（该 Bug 只影响 endfield）。13 套其他主题零改动。
> ✅ **文件解耦与代码整合完成**（§1.26，2026-11-11）：app.js（9802 行）拆 29 个职责分片、
> C# 三大文件 partial 化、tools 精简，**行为零变化**（切片字节级验证 + 11 项全量回归）。
> 交接时间：2026-11-10（同日第四至十一轮）
> 分支：`main` = `fcbcfe1`（PR [#37](https://github.com/118coder/guguova-game-space/pull/37) squash 合并，
> 42 文件 +5094/−81，基于 `b40f19e`）；**版本号仍是 1.16.5，没有 bump、没有发行**
> ✅ **沉浸模式＝沉稳模式**（§1.23.1，2026-11-10 语义修正）：全屏只放大窗口，版式不变；
> 打开沉稳模式才进沉浸版式。此前四轮把它挂在全屏上，按 F 就换掉了玩家熟悉的页面。
> ✅ **图标带不再压住按钮**（§1.23.2）：高度改为运行时实测（ResizeObserver → `--im-dock-h`），
> 舞台据此预留空间；`tools/layout-fit.js` 六档分辨率 × 多主题 **24/24**。
> ✅ **沉浸模式已按 Owner 理念重构**（§1.19）：封面就是页面，UI 当配角。全幅封面 +
> 底部信息横条 + 图标条叠在封面上（不再占用版面），实测封面占屏幕 72%–82%；14 套主题
> 共用一套骨架，横条内部的网格、材质、墨色各写各的。上一版「左文右图」已作废。
> ✅ **控件材质与墨色配对**（§1.21）：Owner 指出的「按钮颜色盖过文字」是共享层
> 单方面改字色造成的（grimoire / riot / riso / summer 次按钮曾低到 1.01:1）。现由每套主题
> 成对声明底与字，`tools/immersive-audit.js` 双帧差分实测 **196/196 全部可读**。
> ✅ **隐藏语义修正**（§1.22）：隐藏的游戏不再出现在首页封面与图标带，「N 款」跟随；
> 详情页隐藏开关的说明文字在 8 个纸面主题上曾低到 1.0:1（浅字压浅纸），已改 `--muted` 并抬到 11px。
> 新增 `tools/text-audit.js` 全页文字对比审计（双帧差分，14 主题 × 4 视图）。
> ⏸ 静态构图稿**不作为设计依据**，只在本地留档、不入库（Owner 判定不符合主题理念）。
> 上一版：1.16.3（游玩时长里程碑变色，**已发布** `v1.16.3`，PR #35）
> ✅ **发行完成**：[`v1.16.5`](https://github.com/118coder/guguova-game-space/releases/tag/v1.16.5)
> 三个资产：`single.exe` 9.51 MB (`e282ee84…`)、`legacy-single.zip` 13.71 MB (`ffaeda6c…`)、
> `legacy-full.zip` 17.11 MB (`0fac45be…`)；verify 与单文件冒烟都过，签名按惯例跳过（无证书）。
> ✅ **实机验收已跑通**（§1.17）：真实 DNF 分别以全屏 / 2.5 倍 / 像素算法三种
> 配置启动，`scaled=True` 全部成立并有窗口像素尺寸为证；孤儿服务端清理也验过三次。
> ✅ 环境干净：7001 空闲，隔离数据根已删，Magpie 配置已还原成 Owner 原值。
> ⚠ Owner 的提权旧实例 PID 29332 仍在跑；两个 `.old` 文件已移出 `bin/Debug` 到
> `03-归档备份\old-build-1.16.4\`，等它退出后直接删除即可。
> 仓库：`https://github.com/118coder/guguova-game-space`

---

## 0. 一句话状态

应用 **1.16.5**（已发布 `v1.16.5`），14 套主题，接口式映射架构不变。第四轮在已发布版本之上做了沉浸模式（§1.19 为当前形态：全幅封面 + 底部横条 + 图标条叠放）、缩放勾选框主题适配与「全屏缩放」文案回归，全部在工作区未提交。1.16.4 那一轮按 Owner 清单做六件事：

1. **格式化资料导出补全**（需求中途澄清：不是导出 txt，而是编辑器原有的
   「导出现有」文本不全）——14 个字段全量导出（含空的，可当填空模板），
   新增「游戏启动器」「字标方案」两项，字标方案按人话导出/导回；
2. **游戏本体 / 启动器路径分离**——编辑器新增「游戏启动器（可选）」，填了它
   就先启动启动器 exe、轮询等本体进程出现，**缩放（Magpie）与计时全部作用
   于本体**（Steam/平台游戏不受影响）；
3. **隐藏游戏**——详情页管理面板开关；游戏库筛选栏新增「隐藏」按钮看全部
   隐藏游戏；隐藏游戏在其它视图与搜索里完全不可见；数据包导出/导入自动携带
   （整对象序列化），合并模式白名单已补；
4. **排序下拉 + 方向按钮的主题化收口**（图一绿框）——此前 13 套主题里只有
   3 套覆写了它们，其余 10 套保持 nova 默认观感（图一截图的 endfield 是硬边
   工业风所以一眼假）；本轮 13 套全部按各自材料语言覆写，新加的类型筛选下拉
   同规则覆盖；
5. **类型筛选**——搜索框右侧下拉，选项取自库内真实类型；编辑器「类型」字段
   改可输可选 combo（自由输入保留 + 下拉选已有类型）；
6. **磁贴封面标签**——平台徽章后跟「类型 / 模式」标签芯片，数量 1–3 可配
   （设置页新卡「游戏库显示」，默认 3；手动游戏没有平台标记自动少一个）。

**后半轮（Owner 实测反馈 Magpie 无效 → 排查，§1.15）**：真实 DNF 基准
实测定位「缩放从未被请求」（游戏没开全屏缩放 + 引擎自动启动关着），随之
落地三修：明确缩放请求强制拉起引擎、引擎未运行时明确报错（不再静默降级）、
游戏退出连带关闭启动器进程树（孤儿服务端占端口的根因）。真实 DNF 窗口的
Magpie 缩放最后一步被环境卡住（提权僵尸服务端），Owner 叫停调试，全部线索
在 §1.15，下一步清单在 §7 P0-0。

**同日追加第二轮（「继续修复问题」）**：§1.15.5 的三个怀疑点已全部落成
`GameDisplay.cs` 的代码加固（进程树里挑真实渲染窗口 / 窗口重建后安全重试 /
前台精确判定），并补了诊断日志和「引擎起不来明确报错」。双目标完整构建
0 错误，主题契约、六项功能、时长阶梯三组回归全过，Toolhelp32 布局自检通过。
真实 DNF 缩放仍待实机验收，`bin/Debug` 仍被运行实例锁住，详见 §1.16。

**同日第三轮（Owner 授权全自动测试，随后追加「倍数缩放」与「算法生效」）**：
真实 DNF 首次跑通 `scale=True engine=magpie scaled=True`；随后把 Magpie 原生的
窗口化倍数缩放接进启动器（1.25–3× 可配），并让「缩放算法」成为设置项、保存即
生效、每次启动游戏前再校验一次。实机量到源窗口 640×480 → 缩放窗口 1618×1209
（2.5×），算法从索引 6 切到「像素缩放」(7) 且引擎重启加载。另修掉
`taskkill /T` 在 cmd 退出后带不走孤儿服务端的真 bug。全部证据与剩余项见 §1.17。

### 先读什么

0. 本文 §1.17 —— **最新一轮**（实机验收、倍数缩放、算法生效、环境状态与剩余项）；
1. 本文 §1.14 —— 1.16.4 六件事的实现与验证；
2. 本文 §1.13 —— 上一轮时长阶梯（未动，tier-shots 断言仍在守）；
3. 本文 §7 P0 —— 实机验收清单（本轮六项 + 1.16.3 颜色回访）；
4. `.agents/skills/guguova-theme-design/SKILL.md` —— 改主题时照着执行。

---

## 1. 版本与工作区

| 项 | 值 |
| --- | --- |
| 应用版本 | **1.16.4**（`version.json` 是唯一版本源，`tools/bump-version.js` 同步 csproj / index.html） |
| 资源版本 | `src/index.html` 全部 `?v=1.16.4` |
| 主题数 | 14（`nova` 内置 + 13 个文件夹） |
| 主题版本变动 | **13 套全部 patch +1**（本轮都写了库工具栏控件覆写）：endfield 1.0.23、dusk 2.0.14、nightflight 1.0.14、steam 2.0.13、summer 1.0.18、riot 1.5.13、riso 1.4.12、codex 1.7.11、mnemo 1.1.17、grimoire 1.5.14、broadcast 1.4.12、aurum 1.0.17、zerohour 1.0.18 |
| 打包产物 | 未打包（待实机验收后 `bash tools/release.sh --version 1.16.4 --publish`） |
| 构建状态 | 双目标 0 错误；`bin/Debug` 是**含延迟缩放但不含 §1.15.2 三修**的版本（被 Owner 运行中的实例锁住，清障后重新 build 即可）；未提交改动约 40 文件（`git status` 可见，含新 `tools/feature-checks.js`） |
| QA 产物 | `node tools/feature-checks.js`（本轮新增的六项功能断言脚本，29 项检查） |

---

## 1.5 本轮唯一主题：接口式映射架构（1.16.0）

### 问题

1.15.0 之前，主题知识散在共享样式表里：`app.css` 111 处、
`settings-themes.css` 214 处、`type.css` 30 处 `html[data-theme="…"]`，
外加 `app.js` 里的 `CURTAIN_HOLD` 与 `THEME_PREFIX` 两张硬编码表。
**每加一套主题都要动主代码**，而且一次重构就可能悄悄改变某个主题的层叠胜负。

### 做法

| 文件 | 职责 |
| --- | --- |
| `src/theme-slots.css` | 新增。共享插槽容器规则 + 引擎弹窗内部令牌重绑 |
| `themes/<id>/interfaces.css` | 新增 13 份。每套主题的插槽映射（共 313 条规则） |
| `src/theme-nova.css` | 新增。内置 nova 无主题目录，映射随包分发 |
| `src/app.css` / `type.css` / `settings-themes.css` | 主题块全部移出，只剩共享规则 |

清单新增三个字段，`app.js` 不再有主题常量表：

| 字段 | 作用 |
| --- | --- |
| `interfaces` | 映射文件路径，缺省 `interfaces.css`，缺失则用共享默认 |
| `curtainMs` | 幕布合拢时长（原 `CURTAIN_HOLD` 表），200–1200，越界取 420 |
| `pinned` | 外观网格固定位次（原 `THEME_PREFIX`），不写则按使用次数排序 |

### 层叠顺序（**最关键，改动前必读**）

```
共享表 → theme-slots.css → interfaces.css → 主题自己的 theme.css → compat.css
```

`interfaces.css` 必须排在主题 `theme.css` **之前**。这不是随意选的：
历史上这些规则就活在共享表里，本来就排 `theme.css` 之前；
本轮曾把它放在之后，实测 DUSK 设置卡从 55.5% 像素差异、STEAM 设置页 46.7%
整体变样。调回之前的位置后差异降到 0.009%（仅备份时间戳文字）。

### 验证

| 项 | 结果 |
| --- | --- |
| 像素比对 | 重构前/后各 84 张（14 主题 × 6 界面，PNG）；**58 张逐字节相同**，其余最大 0.078%，全部集中在实时备份时间戳与抗锯齿 |
| 静态对比度 | 14 主题 × 17 界面，**0 失败**（比 1.15.0 更好：顺带修掉 nova 取景浮层 2 处既有失败） |
| 悬停对比度 | 14 主题 × 4 界面，**0 失败** |
| 契约守门 | `node tools/theme-slot-check.js --strict` → 0 finding |
| 新主题验证 | 临时建 `themes/probe`（只写自己的文件夹）→ 入库/设置/引擎弹窗全部正常，验完删除 |
| 构建 | `dotnet build -c Debug` 0 错误（4 个既有警告） |

### 顺带修掉的真问题

| 问题 | 位置 | 修法 |
| --- | --- | --- |
| nova 取景浮层取色值 **1.95:1**（深封面时） | `src/theme-nova.css` | `--af-value-color` 改用 `var(--accent-text)`（已按对比度提亮） |
| nova「完成」按钮墨字压深蓝底的 **2.08:1** | `app.js` + `theme-nova.css` | 新增 `readableOn()`，按实际底色在深/白之间选字色，写 `--accent-on` |

> 这两处在 1.15.0 就存在（用重构前代码复跑同一审计复现了相同数值），本轮顺手修好。

---

## 1.6 性能与可选加速层（1.16.0 同轮）

### 先测，再改

本轮第一件事是建立 `tools/perf-baseline.js`，但测量结果**推翻了我的初始假设**：

| 指标 | 实测 | 结论 |
| --- | --- | --- |
| 页面首屏（热启动） | 128ms | 健康 |
| 开屏动画 | 164 FPS，0 掉帧，p95 6.2ms | 健康 |
| 主题切换（热） | 41–46ms | 在 100ms 预算内 |
| 换字标 | 5.9ms | 无需优化 |
| 全文档重算（稳定态） | 8.8–14.8ms | 在一帧内 |
| **冷启动到 CDP 就绪** | **1620ms** | 真瓶颈 |
| **启动主线程 `UpdateLayoutTree`** | **334ms** | 一次性样式解析成本 |

曾误判的两处，记录在此避免下轮重走：

1. `intro.css` 有 711 条规则但**首帧 0 条命中**。禁用后重算反而从 20.6ms
   变 23ms —— 这只是噪声。Chrome 按 selector hash 索引，未命中的规则几乎零成本。
2. 第一次测到「首屏 1052ms」是 **WebView2 进程冷启动的一次性成本**。
   热启动下 `domContentComplete` 73ms、首屏 128ms。不要把冷启动算到页面头上。

### 真正改掉的

| 改动 | 位置 | 效果 |
| --- | --- | --- |
| `SyncSteamPlaytime()` 移出 WebView 创建前的同步路径，改为首屏后后台执行并推 `playtime-synced` | `MainWindow.xaml.cs` | 冷启动不再等 `localconfig.vdf` 解析 |
| GPU 进程崩溃自愈（`GpuProcessExited` → 标记 + 通知 + 软件渲染重建） | 同上 | 白窗口变成可用窗口；下次启动直接软件渲染 |

> 之前只处理了 `RenderProcessExited`，GPU 退出无人接管。

### 可选加速层（WebGPU + WebAssembly）

见 [`CAPABILITIES.md`](CAPABILITIES.md)。三档 `gpu / wasm / js`，一条铁律：
**加速只买速度，不买功能**。

关键实测（三种后端，同一张图）：

| 图像 | JS | WASM | GPU |
| --- | --- | --- | --- |
| 192×108 | 1.1ms | **0.3ms** | 3.0ms |
| 768×432 | 9.6ms | **4.3ms** | 6.6ms |
| 1920×1080 | 58.6ms | 25.8ms | **20.6ms** |

- **WASM 全尺寸快 2.2–3 倍** → 默认后端；
- **GPU 有约 3ms 固定往返成本** → 只在 ≥ 1M 像素时接管；
- 最初的「有 GPU 就用 GPU」让缩略图慢了 8 倍。这类回归不报错、不白屏，
  所以 `GPU_MIN_PIXELS` 是测出来的常量，不是猜的。

验证：`test-palette.js` 10 组合成图逐案一致（容差 1.5e-3，来自 float32
累加顺序）；`build-wasm.js --check` 保证 4.3KB 产物与源码同步；三档降级
（GPU → WASM → JS）逐档实测返回正确结果。

---

## 1.7 无头悬停审计 + 交互态图片（1.16.0 同轮）

### 问题

悬停审计（`audit-hover.js`）必须起实机（`NOVA_CDP_PORT`），且逐元素
强制伪类、逐个截图；给某个交互态截图要人工在实机上一个一个点。
`picker` 视图此前完全不在审计里——终末地文件名白字压白底 1.0:1 上屏
就是从这里漏掉的。

### 做法

| 文件 | 职责 |
| --- | --- |
| `tools/lib/hover-measure.js` | 新增。测量契约单一来源：VIEW_ROOTS / TARGETS / 页面助手，实机与无头共用同一份 |
| `tools/headless-hover.js` | 新增。无头悬停审计 + 交互态图片导出，无需实机 |
| `tools/audit-hover.js` | 改为引用共享契约（行为不变） |
| `tools/lib/headless-host.js` | mock 补 `browse`（真实目录清单，只读），picker 在 QA 里终于有行 |

**提速靠批量化**：实机审计每元素一次 CDP 往返链（force→wait→measure→clear）；
无头版把视图内所有目标一次全部强制，**一次求值测完整个视图**——视图成本
与元素数无关，固定两次往返。

产物（每主题 × 视图）：

```
<theme>/<view>@rest.png     无强制——参考帧
<theme>/<view>@hover.png    所有目标同时 :hover
<theme>/<view>@focus.png    所有目标同时 :focus
<theme>/<view>/<element>@<state>.png   失败元素裁剪（--shots=all 导出全部）
hover.json                  与实机审计同 schema，可直接进发布门禁
```

实测：14 主题 × 5 视图 = 70 视图遍历 + 210 张图，**约 110 秒**（4 worker）。
实机同一套视图跑到一半就要 400 秒。

### 审计视图扩到 10 个

`home / library / appearance / settings / detail / import / scanner / editor / engine / picker`
—— picker、scanner、editor 是本轮新增，正是抓出三处真缺陷的覆盖。

### 顺手抓出并修掉的真缺陷（无头审计第一轮就命中）

| 缺陷 | 根因 | 修法 |
| --- | --- | --- |
| 夏季盘符芯片 3.13:1（白字压天空蓝/天空蓝字压白） | `.drive-chip.is-active` 用 `--t-on-accent`(#fff)，hover 用天空蓝作文字 | 天空蓝是中间调：激活板改墨字（5.55:1），hover 文字用印蓝 #0f5f80（7.1:1）——沿用 1.14 启动副标的既有教训 |
| 夏季弹窗图标按钮 hover 1:1 | `.icon-btn { color:#101820 !important }` 全局压制了墨板+荧光绿的 hover 对（铁律 26 场景） | 表单面（editor/scanner/picker/engine/dialog）内 icon-btn hover 用同强度 !important 对：墨板+荧光绿 |
| nova 入库按钮 4.08–4.22:1 | `.engine-btn.primary` 板=原始 accent、字=固定墨。中调 accent（CrossCode #8c7142：墨 4.22 / 白 4.4）无解——死区 | `solveSolidPair()`：板保持原始 accent，字按板色选墨/白，落入死区时把板向更好的一侧微调直至 ≥4.5。板色在死区外完全不变 |

> nova 的修复遵循它自己的既有系统：首页 CTA 的注释写着 "Text contrast is
> computed, never guessed"，sheet 按钮违反了这条。修复把同一解算发布到根级
> （`--accent-solid` / `--accent-on-solid`），主题化分支照常交还令牌。

### 顺带修的审计盲区

- 禁用控件不再被审计（WCAG 1.4.3 豁免）：终末地 picker 确认按钮在未选中时
  是 disabled，扫板 `display:none` + opacity .52，强制 hover 测出 1.05:1——
  测的是玩家看不见的衣服。
- setup 先复位浮层再开视图：import 浮层此前跨视图残留，picker 在它底下打开，
  行列表为空。

### 验证

| 项 | 结果 |
| --- | --- |
| 无头 vs 实机一致性 | 同一视图集合逐项对照，发现集完全一致（nova 4.08/4.22 与 summer 3.13/1:1 双侧同报） |
| 无头全量 | 70 视图遍历、全部 AA、0 失败 |
| 实机抽查 | nova/summer × import/picker/home 全过 |
| 静态审计 | nova/summer/endfield × import/home/settings 0 失败 |
| 图片 | 210 张（14×5×3 状态帧），终末地 picker 白纸墨字可见 |

---

## 1.8 打开即最新 + 实例接管（1.16.1，PR #29）

### 打开即最新

渲染链唯一无版本键控的环节是 index.html 本身——资源都带 `?v=<版本>`，
HTML 是裸 URL，WebView2 缓存条目可能压过磁盘新文件。修复：Navigate 的
shell URL 加 `?v=<程序集版本>`，版本变化后旧缓存按构造不可达。其余环节
（runtime/<版本>/ 资源与引擎、主题按 manifest 版本播种、版本变化清盘）
已是键控的。

### 实例接管（新杀旧）

原行为：第二实例转发"激活"信号后退出——换新包再打开被弹回旧版本。
现行为：新实例终止旧实例并接管 profile。

- PID 文件（`<profile根>/guguova.pid`）优先，进程名清扫兜底（覆盖旧版本
  无 PID 文件的换包场景）；回收前校验映像名，PID 复用不误杀
- 只在本 profile 锁被占时清扫；跨数据根实例（QA 沙箱）不受影响，实测共存
- **互斥量获取用 OpenExisting + WaitOne(0)**：在被杀进程遗弃的互斥量上，
  一次性构造函数 `new Mutex(true, id, out first)` 返回 first=false 且不抛
  AbandonedMutexException，接管死锁——被遗弃等待才授予所有权。实测抓出
- 接管失败退回转发激活；Store.Save 是 temp+Replace 原子写，强杀不损数据
- net48 同文件编译通过（无 Process.Kill(bool)，WebView2 随宿主退出）

实测：A 启动 → B 启动（同数据根）→ A 进程消失、B 上屏且 URL 带
`?v=1.16.1`；跨数据根双实例共存。

#### 1.16.2 起：同一个包不再自杀

「新杀旧」的代价是每次点击图标都付一遍 WebView2 冷启动（~1.5 s），
而托盘里明明有一个热实例。日志里 14 次 `another instance holds the profile
— taking over` 就是这 14 次白等的证据。

现在 PID 文件写成 `pid|版本|exe路径|文件长度|写入时间Ticks`（单行，旧版本
读它 int.TryParse 失败 → 落到进程名清扫，行为不变）。新启动先比对：
**版本、路径、长度、mtime 全同** → 只发激活信号（`AllowSetForegroundWindow`
+ 事件）然后退出，冷启成本归零；任一项不同（换了新包，或同版本号重发）→
仍然杀旧接管，因为「打开新 exe 必须看到新界面」的约束没有变。

副作用：转发激活的进程不写 PID 文件、不碰互斥量，`OnExit` 的清 PID 逻辑
按首字段比对，不会误删正在运行实例的戳。

### 首启解压挪到窗口之后（1.16.2）

`AssetBootstrapper/WebView2Bootstrapper/EngineBootstrapper` 原本在
`App.OnStartup`、窗口创建之前跑：首启或换版本要写 ~20 MB（assets 370 文件
6.1 MB + engine 25 文件 13.9 MB），这段时间屏幕上是**什么都没有**。现在改在
`MainWindow.OnLoaded` 里用 `Task.Run` 跑，闪屏已经可见，解压不占 UI 线程。

`pack-assets.py` 同时改成可复现打包（固定 1980-01-01 时间戳 + 排序）。原实现
用文件 mtime 当 zip 时间戳，**每次重新打包字节都不同** → ContentStamp 变 →
重新解压 370 个文件 + 清 HTTP/Code Cache。日志里连续三次
`renderer cache reset for 1.16.1.0` 就是同版本反复清盘。现在内容不变则字节不变。

`Log.Stage()` 带 `[+Nms]` 前缀，宿主侧时间线（app start / window shown /
library loaded / payload ready / webview environment ready / webview core ready /
shell navigate）都进 nova.log，日志时间戳也补到毫秒。

---

## 1.9 编辑器补齐：路径即输即预览、格式化资料、路径栏可输入、收藏角标（PR #30/#31/#32）

### 一、封面路径输入 + 回车，预览即刻更新

`fImage` 此前只有 picker 一条路（选择后走 readImagePreview），手动输入
路径按回车完全没有处理——用户实测报的问题。抽出 `previewImageFromPath()`
共享：picker、fImage 的 change 与 Enter、资料导入四条入口同一函数；原生桥
`ReadImagePreview` 返回 320px 缩略图 data URL，保存前就能看到真图。
`ReadImagePreview` 同步改用 `GetPath`（带引号路径在这一环也会失败）。

### 二、格式化资料块（编辑器预览下方）

- 「标签：内容」逐行解析，全/半角冒号均可；**只有被识别的标签才开启新
  字段，未识别的行归入上一字段**——多行详细描述因此完整保留
- 缺失项不填；路径过 cleanPath；导出把非空字段序列化进文本框并复制
- 字段别名表：名称/名字/游戏名、中文名/中文名称、类型/类别、字标文字/
  标题文字、年龄分级/分级、游玩模式/模式、一句话介绍/简介、详细描述/
  描述、启动参数/参数、工作目录/目录、封面/图片/主视觉
- 控件用 `.field` 结构，14 套主题输入框样式自动生效

### 三、文件浏览器路径栏可输入

`#pickerPath` 从只读 div 改为输入框（`direction: rtl` 保留，长路径显示
尾部）：目录回车跳转；文件路径回车先导航到所在文件夹，列表命中则选中并
**直接确认**——整条链一次回车完成。被过滤器排除的文件仍接受为合成条目
（过滤是浏览建议，不是闸门，导入时宿主再验证存在性）。

### 四、收藏角标（游戏库封面左下角，悬停显示）

- 卡片是 `<button>` 内部不能再套 `<button>`：角标为卡片内的
  `span[role=button]`，锚 `.lib-art` 左下（left/bottom 9px）
- **悬停卡片显示**（与跳转箭头 `.lib-open` 同一套板式：暗板 + 毛玻璃 +
  圆盘），描边=未收藏、填充=已收藏，心形颜色走各主题既有覆盖
- 心形 14px（与 12px 实心箭头视觉等重）；板径 26px 与箭头一致
- **激活陷阱（实测抓出）**：span 在卡片 button 内部，浏览器对 button
  后代的点击同样触发 button 的激活行为——在 button 上派发合成点击，
  绕过委托的 .lib-fav 分支直接走卡片分支打开详情。委托里对收藏点击
  `preventDefault` 阻断激活；键盘 Enter/Space 在 libGrid keydown 激活
- 主题色修正（旧覆盖是给名称行小心形写的，暗板上不可见）：endfield
  墨→信号黄、broadcast 墨→白、mnemo 深梅→薄雾、grimoire 酒红→金、
  summer 墨→白；改动主题已 bump version
- `.lib-fav` 已加入悬停审计目标（audit-hover TARGETS.library）

### 五、本轮引入并当场修掉的布局回归

`.editor-preview` 的 sticky 移到 `.editor-side` 时带丢了定位上下文——
盒内 `position:absolute` 的主视觉图（455×464）不再被 static 祖先的
`overflow:hidden` 裁剪，压住资料块 200px。补 `position: relative`。
教训：**sticky/relative 一并承担着 absolute 子元素的定位锚**，挪动前
先查盒内有没有 absolute 孩子。

### 验证

| 项 | 结果 |
| --- | --- |
| 带引号粘贴 S1A4.jpg + 回车 | 字段去引号、预览变 data URL |
| 资料 13 行导入 | 10 字段就位、描述 3 段保留；导出 14 行含多行描述 |
| 路径栏输入文件路径 + 回车 | picker 关闭、字段带路径、预览即现 |
| 收藏 | 双向切换、详情不再被打开、点卡片仍开详情、键盘 Enter 可切换 |
| 对比度 | nova/endfield/dusk/summer × library/editor 0 失败 |

### 用户回访 · 手动添加时图标合成覆盖玩家封面（真根因，1.16.4 同轮）

用户要求：手动添加游戏并填入封面路径时，**封面路径必须优先于图标**。
逐层实测后找到真根因——之前「HeroPath=null、路径没送到」的判断是错的：

**CreateGame 的带图分支先导入玩家封面，随后补了一刀
`ApplyMedia(game, null)`——它的兜底分支无条件走
`ImportExecutableIcon`，用 exe 图标重新生成 hero/cover，
把刚写入的玩家封面整个覆盖掉**（配色分析也换成了图标的）。
所以无论玩家填什么封面，手动添加的入库结果都是图标合成图。

修法：带图分支与 UpdateGame 对齐——`ImportImage` 返回的 analysis
直接 `ApplyAnalysis`，不再调用 ApplyMedia。nova.log 增加
`create game typed image: <路径>` 一行便于以后排查。
其余 ApplyMedia 调用点（扫描导入候选封面、重置封面回图标）语义正确，保留。

验证（像素级，这次不只看 URL）：

| 项 | 结果 |
| --- | --- |
| 直调桥 createGame + 封面 | media/hero.jpg = 玩家封面（134KB，非图标合成） |
| 完整 UI 添加流 → 库卡片像素 | avg 571 = 封面参考值（图标合成为 ~133） |

**教训**：(1) 验证图片类修复必须看最终像素/文件内容，payload URL 正确
不代表内容正确；(2) 无头 QA 里新旧 QA 根、残留实例、同名 media 目录会让
"看图" 读到旧文件——每次验证前先打 ID/时间戳；(3) 构建链里的中文 grep
在编码抖动下会静默断掉 `&&` 链，后面的步骤根本没执行，还以为跑过了。

### 用户回访三补刀 · 换封面要重启才生效（1.16.4 同轮）

用户更新封面后卡片不刷新，必须重启。根因是缓存键：封面文件被替换后
URL（`nova.media/<id>/cover.jpg`）不变，WebView2 一直吃 HTTP 缓存里的
旧图。头像早有同款先例（前端 `avatarFileUrl` 的 `?v=stamp`），这次把
同样的键给到全部媒体：

- `NativeBridge.MediaUrl`：存在文件的媒体 URL 追加 `?v=<mtime ticks>`；
  图标合成兜底图（`media/<id>/{hero,cover}.jpg`）同样参与（它也会被
  「重新生成封面」原地重写）。URL 每次载荷现算，不落库。
- 生效面：库卡片、首页主视觉/背景、详情主视觉、外观取景——一次修死
  「换封面 / 重新生成 / Steam 重导」三类原地重写。
- 验证（真机 CDP + 完整编辑器 UI 流）：加图 A → 编辑换图 B → 同一会话
  卡片 URL 戳变化且像素变化（avg 133 → 571），无需重启；截图在
  `_shots/swap/card-{A,B}.png`。

### 用户回访 · 挂机时界面"时不时刷新"（1.16.4 同轮）

用户发现挂机时启动器似乎在周期性刷新。根因：`refreshLive`（30s 定时）
无条件 `renderLibrary()` + `renderHero()`——**整个库网格 innerHTML 重建**，
每张卡片的入场动画全部重播，首页则重发封面录制层、重设字标。挂机时数据
没有任何变化，这些全是白做且可见的重绘。

修法（`app.js`）：

- `liveSignature()`：每款游戏的 running/playtime/exists/favorite/
  lastPlayed/launchCount + coverUrl（mtime 戳会随换图变化）+ 当前选中。
- `refreshLive` 先算签名，**没变化就一行 DOM 都不碰**（详情进度条除外，
  它只在详情打开时走且代价为零）。
- `refreshLibraryLive()`：数据变化时的**原地修补**——徽标 / 收藏态 /
  进度条 / 副标题 / CURRENT 环 / 图片 src（配合 mtime 缓存键）逐卡就地
  更新，不再 innerHTML 重建。徽标与副标题的模板抽成
  `libraryBadgesHTML / librarySubHTML / libraryProgressPct` 与全量渲染
  共用，两条路径不会漂移。
- 签名在 boot 时初始化。

验证：无头宿主挂库视图 36s（跨 ≥1 个 tick），挂钩 libGrid/libStats/rail
的 innerHTML setter 计数——**0 次写入**（修复前每 30s 各一次）。截图字节
对比不适用：主题顶部色带等循环动画属设计内的持续变化。

### 发布记录 · GUGUOVA 1.16.1（收编发布）

GitHub 发布页原有 v1.16.1 与 v1.16.2 两个 Release 同日（11-04）发布，间距
难看。按用户决定**收编两版**：两个 Release 与 tag 删除（API 204），本次
全部修复以 **v1.16.1** 重新发布（3 个资产：single.exe 9.45MB /
legacy-single 13.67MB / legacy-full 17.05MB），提交 c2deabc 已推送 main。

同版本号重装的暗雷一并修掉：

| 键 | 原状 | 现状 |
| --- | --- | --- |
| `runtime/<version>/assets` | 只看 `.complete` 存在 | 目录键 = `<version>-<assets zip SHA-256 前 10 位>`（`AssetBootstrapper.ContentStamp`），同版本不同内容必然重解压；旧同版本兄弟目录自动清理 |
| `runtime/<version>/engine/magpie` | 同上 | 目录键随 assets 戳；`.complete` 内容 = engine zip 自己的哈希，引擎单独变更也会重解压 |
| 渲染缓存 `.renderer-version` | 程序集版本 | `<版本>:<ContentStamp>`，同版本重装也会重置渲染缓存（shell URL 的 `?v=` 才不会端旧 HTML） |

发布工具链备注：`publish-release.py` 走裸 urllib，本机 Python 缺 GitHub
CA 链（curl 走 schannel 不受影响）——用
`SSL_CERT_FILE="C:\Program Files\Git\mingw64\etc\ssl\certs\ca-bundle.crt"`
前置即可。

### 用户回访 · 竖排滚动 / 运行中卡死 / 磁贴文字重叠（1.16.1 同轮）

三连报，三种根因：

1. **竖排（layout-rail）滚轮无效**：滚轮本来就走「改选中 → centerTile」
   的路径，但 `centerTile` / `ensureActiveTileVisible` 只会 `scrollBy(left)`
   ——竖排要的是 top。两个函数都加了纵向分支。验证：把窗口压到 340px 令
   6 张卡真溢出（max 234px），5 次滚轮 activeIndex 0→5、scrollTop 顶满。
2. **游戏退出后仍显示"运行中"**：session-started/ended 靠 Web推送，
   事件丢失（窗口最小化被节流等）后前端永远停在旧状态。加
   `syncRunningFromHost()`：refreshLive 每 30s + 窗口 focus/visibility
   时调 `getRunning` 对账，多删少补；对账产生的结束不弹"本次游玩"
   toast（时长已不可知），改从 boot 拉回真实 playtime。宿主是唯一事实源。
3. **磁贴名与时长/运行中重叠**：`.tile-name` 是 flex 子项，默认
   `min-width:auto` 拒绝收缩；更深一层是 polish.css 与 endfield 把
   `.tile-name` 设成 `white-space:normal; overflow:visible`（故意换行，
   "fx-cards=rule" 变体反而从未接线）。统一回单行省略（min-width:0 +
   nowrap + hidden + ellipsis），换行变体保留在 `data-fx-cards="rule"`
   里可显式开启。endfield bump 1.0.19。

验证：无头注入 30 字长名 → clipped ✓ / ellipsis ✓ / 名与时长间距 +8px；
短窗强制溢出后滚轮纵向滚动 ✓；slot 守门 + endfield 悬停审计 0 失败。

### 用户回访 · 长按强制结束游戏（开发者模式，1.16.1 同轮）

开发者模式（Ctrl+Shift+D）下，游戏运行中**长按主按钮 3 秒**强制结束进程：
按钮底缘出现主题化进度条（rAF 驱动，3 秒线性填满），松手/滑出即取消；
填满后调 `stop`（宿主先软关窗 6 秒，超时 `taskkill /T /F`），并吞掉随后
的 click（不再误开管理面板）。按钮 title 提示"长按 3 秒强制结束"。

样式要点：填充条颜色 = `var(--hold-fill, var(--cta-fg, var(--accent)))`——
**自适应 CTA 的底色就来自封面 accent 家族，accent 条在 nova 上同色隐身**；
按钮自己的文字色是唯一保证与底色对比的值，主题可经 `--hold-fill` 重铺
（endfield 覆盖为信号黄，bump 1.0.20）。选择器用
`.btn.primary .btn-hold-fill` 压过 `.btn.primary > *` 的 in-flow 化。

### 用户回访 · 管理员模式长按强杀 + 倒退式动画（1.16.1 同轮）

需求修正两处：门禁不是开发者模式，而是**本程序以系统管理员身份运行**
（任务管理器式强杀，可结束任何游戏进程）；动画不是进度条，而是**主题
滑动效果的倒放**。

- 门禁：`NativeBridge.IsElevated()`（WindowsPrincipal/Administrator 角色）
  进 boot payload 的 `elevated`；`canForceKill = 运行中 && elevated`。
- 动画：`.btn-hold-cover` 全覆盖层，JS 每帧只写一个变量 `--hold-p`
  （0→1），CSS 同步驱动层位置 `translateX(calc(-103% * var(--hold-p)))`
  （扫入的倒放：endfield 黄色从满盖退回左缘）与标签墨色
  `color-mix(--hold-ink, --cta-fg, 按剩余覆盖度)`（覆盖时读扫入色的墨，
  退回后读按钮前景；`@supports` 回退为静态 `--hold-ink`，legacy 109 的
  color-mix 缺失只影响标签过渡平滑度）。
- 主题令牌：`--hold-fill`（倒退层颜色）+ `--hold-ink`（覆盖期标签墨）。
  万能默认 `fill=--cta-fg / ink=--cta-bg`（前景/背景对天然对比，nova 的
  墨纱退玫瑰底即此）；四个扫入式主题覆盖为自己的扫入色：
  endfield 信号黄/墨（1.0.21）、codex 羊皮/墨（1.7.9）、
  mnemo 梅紫/纸（1.1.15）、zerohour 墨/纸（1.0.16）。
- 交互：pointerdown 起 3s rAF，pointerup/leave/cancel 取消；填满调
  `stop`（软关窗 6s → taskkill /T /F）并吞掉随后的 click；按钮 title
  提示"长按 3 秒强制结束游戏进程"。
- 验证：endfield/nova/zerohour 在 p=0/0.3/0.6/0.95 四帧截图
  （`_shots/hold-retreat/`）——倒退方向、标签可读性、切角/药丸形状随
  按钮裁切全部正确；slot 守门 + 三主题悬停审计 0 失败。

### 用户回访 · 外观页隐形文字 / “真实启动”文案 / 夏季悬停墨底墨字（1.16.1 同轮）

三连报：

1. **外观页主题操作行右侧一整块空白**：那是 `.theme-hint`（“把主题文件夹或
   .zip 放进去…”），共享样式写着暗色 tint `rgba(255,255,255,.28)`，endfield
   纸面板上隐形。改 `var(--muted, …)`（`src/themes.css`）。
2. **启动页“GUGUOVA 桌面版 · 真实启动”**（用户：AI 味太重）：整个
   `.launch-demo` 元素与样式删除（index.html / motion.css / base.css 响应式引用）。
3. **夏季主题顶栏图标悬停墨底墨字**：`html[data-theme="summer"] .icon-btn
   { color: #101820 !important }`（1.14 的顶栏白底修复）把悬停态的字色也
   钉死了——2359 行的 `color: var(--su-lime)` 被它压掉，悬停 = 墨盘墨字。
   补一条 !important 悬停对（墨盘 + 酸柠字，排除 modal-close/square 以免
   覆盖它们各自的配方），置于毯式规则与方形规则之间保证层叠顺序。

**审计盲区修补**：顶栏在所有视图根之外，悬停审计从没测过它。hover-measure
新增 `!` 前缀 = 文档级选择器，home/settings/appearance 三个视图加入
`!.topbar .icon-btn`，appearance 加入 `.theme-hint`。全量 14 主题重跑：
所有顶栏图标悬停 5.69–17.84:1 全 AA（summer 修复后 lime on ink 14.62:1），
报告在 `_shots/hover-headless/`。

### 用户回访 · 管理员游戏杀不掉 + 退出监视失效（同一根因，1.16.1 同轮）

用户报告：游戏本身需要管理员权限时，即使启动器也以管理员运行，强杀依然
无效——且这与之前"游戏退出后仍显示运行中"是**同一个根因**：

**ShellExecute 对它提权的子进程返回的是受限句柄**——`HasExited` /
`EnableRaisingEvents` / `Kill` 在该句柄上全部抛"拒绝访问"，**即使启动器
自身已提权**（限制来自 ShellExecuteEx 返回的句柄，不是我们的完整性级别）。
后果链：注册时 `EnableRaisingEvents` 抛异常 → 退出监视从未挂上 → 会话
结束事件丢失（"运行中"卡死）；`Stop` 的整个杀灭体被 `process.HasExited`
的异常跳过 → 强杀无效。

修法（`Services/LauncherService.cs`）：

- `ReopenFullRights(process)`：启动后按 PID 重开满权限句柄（提权启动器
  拿得到；低完整性调用方维持受限句柄），两处注册点（直启 / Steam 附着）
  都换成重开后的句柄——退出监视与强杀都活在强句柄上；
- `Stop` 三段式容错：软关窗（try/catch，拒绝访问时跳过）→
  **taskkill /PID /T /F（现代与 legacy 统一走 taskkill，原 #if 分叉删除）**
  → `Kill` 兜底；受限句柄无法应答退出查询时按 taskkill /F 已终结处理；
- 桥接错误信息可行动："无法结束该游戏进程（游戏以管理员权限运行时，请以
  管理员身份运行启动器后再试）"——启动器未提权 + 游戏提权是 Windows 层面
  的死局，只能提示用户。
- net48 注意：`Kill(bool)` 重载不存在（铁律 48 的老坑），条件编译回退
  `Kill()`。

实机验证路径：以管理员运行启动器 → 启动一个 requireAdministrator 的
游戏 → 长按强杀（应立即结束）；关闭游戏（观察"运行中"是否即时消失）。

### 发布 · GUGUOVA 1.16.1（最终）

1.16.1 发布后的一轮用户回访全部并入本版（管理面板对比度、长按强杀、
检查更新、运行状态对账、竖排滚动、磁贴省略、悬停盲区、封面缓存键、
提权句柄等）。发布命令：

```bash
SSL_CERT_FILE="C:/Program Files/Git/mingw64/etc/ssl/certs/ca-bundle.crt"   bash tools/release.sh --version 1.16.1 --publish
```

### 下一轮 P0（用户已点名的方向）

1. **收藏角标主题化深度**：目前心形颜色跟随主题，板式仍是共享暗板；
   若要每套主题自设计（如 endfield 切角、riso 硬影），照
   `.lib-open` 的每主题覆盖模式在各自 theme.css 加 `.lib-fav` 规则
2. **格式化资料的格式升级**：用户可能希望支持任意顺序/英文标签/JSON；
   解析器在 `parseDossier()`，别名表 `DOSSIER_FIELDS` 就是一张表
3. **五平台真机**（延续 1.15.0 P0-1）、README 截图更新（延续）
4. 发行：v1.16.2 已构建（dist/），**尚未发布**——
   `python tools/publish-release.py --version 1.16.2`

---

## 1.10 用户回访四修 + 检查更新（1.16.1）

用户实机回访（endfield 主题）报了四张截图 + 两条新需求，全部处理：

### 图二 · 任何游戏详情页都显示同一款（真 bug，已修）

**根因**：右键菜单的「游戏详情」固定调用 `openDetails()` → `currentGame()`。
在游戏库里右键任何卡片 → 详情永远是**当前选中**的游戏（用户的当前游戏是
DNF，于是"打开任何游戏详情页面都是图二"）。用用户库的隔离副本 + 真机 CDP
实测复现：右键第 2 张卡 → 详情打开的是当前游戏（Blender）。

**修法**（`app.js contextItemsFor`）：识别指针下的 `.lib-card[data-game]`
/ `.tile[data-index]`，详情动作先 `chooseGameById` 再 `openDetails`；
「在资源管理器中显示」同样定位到被右键的游戏。已实测：右键第 2 张卡 →
详情正确打开第 2 款。

### 图一 · 收藏心形不符合主题（endfield 重绘）

`.lib-fav` 的共享底是 nova 的暗色玻璃圆盘，在纸面主题上像一块污渍。
endfield 改为切角方块：静置=纸白墨心描边，悬停/聚焦=信号黄，已收藏=信号黄
+墨色实心（与 `.lib-open`/`.lib-current` 同一语言）。clip-path 会裁掉
focus outline，endfield 的焦点态改用信号黄填充表达。详情页底部的心形
`.icon-btn.square.heart` 同步从圆形改为切角方块，激活态墨心（避免
黄上黄隐形）。endfield bump 1.0.18。

### 图三 · 管理面板按钮主题化 + 可折叠

1. **`.steam-mode` 令牌化**：启动方式芯片此前只有共享样式（8px 圆角 +
   半透明 accent 洗底），从未进主题契约。现在共享侧消费 `--sm-*`
   （默认从 `--hair`/`--accent` 派生，14 套主题不开映射也可读），
   endfield 在 `interfaces.css` 给出「选中=实心信号黄+墨字」的签名。
   插槽清单 §16.4 已登记（未加进 `theme-slot-check` 的必填表：默认值可读）。
2. **标题栏折叠**：管理面板头部改为 h3 内嵌 `button.manage-toggle`
   （游戏管理 + 游戏设置 + caret），点击折叠 `#manageBody`（stats/Steam
   启动/操作行/移除按钮），`aria-expanded` 同步，「管理」按钮打开时总是
   展开，X 与「完成」行为不变。

### 图四 · 格式化资料占位改架空游戏 + 30% 透明度

占位示例从真实游戏名（DNF-Season1-Act4）换成虚构示例库的「流明谷」，
`.editor-dossier textarea::placeholder { opacity: .3 }`。

### 用户回访补刀 · 管理面板 Steam 区块对比度（14 主题全查）

用户指出管理面板 Steam 区块的「未检测到…」一行几乎看不见，并要求查所有主题。
根因是双层盲区：管理面板在标准视图审计里从不展开，Steam 区块还只对平台游戏
显示——所以三条审计都没测过它。

| 修复 | 位置 | 说明 |
| --- | --- | --- |
| `.manage-steam-title/state/note` | `src/type.css` | 固定亮色 tint 与薄荷绿状态色 → `--ink` / `--muted`（状态 ok/warn 都用墨色，语义在文字里；`--accent-text` 在 DUSK 纸面板上实测 3.78:1，弃用） |
| `.manage-stat span/b` | `src/type.css`（加载序在 theme.css 后，是真正的胜者） | 固定亮 tint → `--muted` / `--ink`。此前 grimoire / mnemo / riot / riso / summer 的统计卡文字在纸底上 1:1 隐形 |
| `.manage-kicker` / `.manage-head .icon-btn` | `src/theme.css` | 固定 `.26` 白 → `--muted`（nightflight/steam 此前 2.3:1） |
| summer kicker | `themes/summer/theme.css` | 天蓝小字 3.13:1 → `--t-ink-2`（铁律 1：accent 不做小字），bump 1.0.16 |
| dusk 管理卡 | `themes/dusk/theme.css` | 统计卡留着共享暗底 `#0c0e14` 而面板文字已改墨 → 卡改 `--dk-paper-edge`；面板底 `.62 → .94`（半透明纸压暮色场景，混色不可控），bump 2.0.11 |

自建一次性审计（14 主题 + nova × 管理面板 14 条文字，canvas 归一化解析
`color(srgb …)`）逐主题校验条数后全 AA。**教训**：v1 审计的正则没吃到
`color-mix()` 的计算值格式，静默 0 条还报了「全过」——对比度自建脚本必须
校验「实际测到的条数」，否则假阴性比没有审计更糟。管理面板（展开态 +
Steam 区块）应进 `audit-contrast` 的默认视图集（下轮）。

### 检查更新（新功能，唯一的联网功能）

- `Services/UpdateService.cs`：GitHub Releases `latest` 检查 + 包体下载。
  资产优先级 `.exe` > `legacy-single.zip` > 其余；版本按三段数字比较。
- 桥接：`checkUpdate` / `maybeAutoUpdateCheck` / `downloadUpdate` /
  `cancelUpdateDownload` / `openUpdateFolder`，进度经 `update-progress`、
  状态经 `update-status` 推送；下载落在数据目录的 `updates` 文件夹。
- 设置 → 关于：版本行 + 检查更新 / 下载最新版 / 打开下载文件夹 +
  「每天自动检查一次更新」开关（**默认关**，遵守离线承诺；开启后开机
  8 秒后台查一次，24h 节流）。
- net48 兼容：无 range/index，`legacy` csproj 补 `System.Net.Http` 引用。

### 旧版本打不开的真相（解释 + 提示）

「运行旧版本，无论如何打开的都是 1.16.1」：1.16.1+ 是新杀旧接管
（§1.8），但**旧 exe（≤1.16.0）没有接管代码**——它检测到实例在跑就走
老路径：转发激活信号后自己退出，正在运行的 1.16.1 被唤到前台。托盘常驻
时尤甚（关窗不等于退出）。要跑旧版：先托盘退出。本轮加了提示：运行实例收到
激活信号时弹 toast「GUGUOVA vX 已在运行 · 要运行旧版请先从托盘退出」
（`activated-running` 事件）。

### 验证

| 项 | 结果 |
| --- | --- |
| 图二复现 + 修复 | 真机 CDP：修复前详情=当前游戏；修复后=被右键的游戏 |
| 契约守门 | `theme-slot-check --strict` 0 finding |
| 无头全量截图 | 294 张（14 主题 × 21 视图）0 截断 0 横向溢出 |
| 无头悬停审计 | 70 视图遍历，全部 AA（含新 .lib-fav / manage-toggle / steam-mode） |
| 静态对比度 | 本轮未跑（用户要求实机自测）；新文本均走既有可读令牌（`--muted`/继承墨色） |
| 构建 | modern net10 + legacy net48 双 0 错误 |

### 用户回访再补刀 · 添加游戏时封面没生效（1.16.1）

用户添加 DNF 第五章时填了封面，入库后卡片却是图标合成图（HeroPath=null、
无任何报错）。逐条验证后确认：**typed / 带全角括号路径 / 选择器 / 资料
导入** 四条入口端到端全部正常（真机 CDP 逐一实测）——唯一能无声复现的
路径是：**资料粘贴进「格式化资料」后没有按回车/没点「导入到表单」，
直接保存**。textarea 里的「封面：…」被静默忽略，游戏按图标生成封面入库。

修法（`app.js`）：

- `applyDossierToForm({ onlyEmpty })`：资料解析并入表单的唯一实现；
  `importDossier`（覆盖语义）与保存前的合并共用。
- `saveEditor` 开头先做 `onlyEmpty` 合并——表单里已填的值永远赢，
  粘贴资料只补空位；封面经 `previewImageFromPath` 立即可见；有合并时
  toast「已从格式化资料补全 N 项」。
- `resetEditorFields` 清空 `dossierText`：上一个游戏的粘贴残留不能再
  被并进下一个游戏。

验证：真机 CDP，粘贴资料（不导入）→ 保存 → 游戏正确携带名称/类型/封面
（coverUrl 指向导入的媒体，非图标合成）。

**教训**：用 CDP 驱动 UI 复现时，新数据根会叠「开场仪式 + 首启入库窗」
两层时序，字段设置会被它们的回调重置——探测前必须等 `is-booted` 并先
关掉首启窗；探测脚本里的换行一律 `String.fromCharCode(10)`，模板字面量
的 `
` 会在 node/CDP/页面三层转义里丢掉。

### 下一轮 P0（1.16.1 当时的清单，已被 §7 取代，保留作历史）

1. **用户实机回归**：图二右键路径、endfield 收藏角标/详情心形、管理面板
   折叠、资料占位、检查更新（设置 → 关于，真实 GitHub）、**添加游戏
   粘贴资料直接保存**。
2. 静态对比度全量（`audit-contrast.js` 需实机，本轮跳过）。
3. 发行：v1.16.1 收编发布——`bash tools/release.sh --version 1.16.1`。
4. 延续的 P0：五平台真机、Steam 全流程、README 截图。

---

## 1.11 本轮（1.16.2，PR #34）：排序补全 + 整页长截图

> **版本号有个撞车，先说清楚**：上一轮文档 §1.9 的标题写着「1.16.2，PR
> #30/#31/#32」，那批编辑器补齐当时并未发布，实际发出去的是 1.16.1。
> **真正的 1.16.2 = 本轮 PR #33（启动）+ #34（排序与截图）**。以后引用请以
> `version.json` 与 git tag 为准，不要以文档小节标题为准。

### 1.11.1 名称排序：自然序 + 非数字交给中文排序

改前「名称」是 `localeCompare(…, 'zh-Hans-CN')`。中文数字是**字符**，
比较器按字形排，于是 21 个 DNF 版本排成「第八季、第二季、第九季、第六季、
第三季」这种谁也看不懂的顺序。

改后把名字切成「数字段 / 文字段」，数字按值比、文字仍按中文排序：

| 位置 | 职责 |
| --- | --- |
| `src/app.js` `chineseNumber()` | 中文数字转数值：`十`=10、`十八`=18、`二十三`=23、`一百零五`=105、`一万`=10000 |
| `src/app.js` `NAME_TOKEN` | 词法：阿拉伯数字串，或 `零〇一壹二两贰三叁四肆五伍六陆七柒八捌九玖十拾百佰千仟万亿億` 的连续串 |
| `src/app.js` `nameParts()` | 产出 `[[1,'DNF第'],[0,8],[1,'季 第'],[0,18],[1,'章：…']]` |
| `src/app.js` `compareNames()` | 逐段比较：**先比类型**（数字 0 / 文字 1），再比值；尾部用整串兜底 |

两条为这个库专门加的规则，删了会立刻退化：

1. **`第零五章` = 0.5**：以 `零/〇` 开头且不含单位的数字串按小数处理。
   库里第一季确实有 Act0.5（`DNF-Season1-Act0.5`），按常规中文数字会算成 5，
   和 `第五章` 并列。
2. **`第四半章` = 4.5**：数字段后面紧跟 `半` 时 +0.5。库里第一季有 Act4.5。

排序结果（本机 21 条 DNF）：第一季 0.5 → 1 → 4 → 4.5 → 5 → 12 → 13，
然后第二季 → 第三季 → 第四季 → 第五季 → 第六季 → **第八季** → 第九季 →
**第十二季**。

### 1.11.2 方向切换（正序 / 倒序）

| 项 | 实现 |
| --- | --- |
| 控件 | `src/index.html` `#libSortDir`，`.lib-sort` 内、下拉右侧，32×32 |
| 图标 | 复用 `#i-up`，`[data-dir="desc"]` 时 CSS 旋转 180°，不新增第二个图标 |
| 状态 | `state.settings.librarySortDir`：`asc` / `desc` / `''`（空 = 该字段默认） |
| 字段默认 | `SORT_DEFAULT_DIR`：名称 `asc`，最近游玩 / 时长 / 添加时间 / 启动次数均 `desc` |
| 持久化 | 桥 `saveSettings` 新增 `librarySortDir`；宿主 `PlayerSettings.LibrarySortDir`，`NativeBridge.SaveSettings` 只接受 `asc`/`desc`，其余落 `null` |
| 换字段 | 回到该字段默认方向（避免一选「名称」就撞上倒序） |

**稳定性论证**（这是本轮唯一需要"证明"的地方）：

- 所有比较器按**升序**书写，方向用 `sign = dir === 'desc' ? -1 : 1` 相乘；
- 并列项返回 0，`Array#sort` 稳定，所以翻转方向**不会重排并列项**；
- 名称比较是**全序**（先类型后值），不会出现 A<B、B<C 但 A>C 的抖动。
  用「混合比值 / 混字符串」的写法就会有这个问题，别改回去。

### 1.11.3 整页长截图

顶栏放大镜右边新增相机按钮（`#shotBtn`，任意界面可用）。导出的是**当前视图
连滚动部分**，不是视口截图。

流程（前端 `exportScreenshot()`）：

1. `releaseForExport(view)`：从当前视图真正在滚动的元素一路向上到 `<html>`，
   逐层把 `height` / `max-height` / `overflow` 设为行内 `!important`；
   视图本身从 `position:absolute` 改回 `static`（否则它不贡献高度）。
   每条改动都记了原值与原 `!important` 优先级，用于逆序还原；
2. 等一帧布局 + `settleForExport()`（字体 `ready`、视图内未完成的 `<img>`
   decode，上限 1.5s）；
3. 量宽度与高度（见下），`call('capturePage', {view,width,height,scale,background})`；
4. 宿主回包后异步截图，完成后发 `screenshot-done` 通知，前端收到后还原 DOM
   并 toast；25 秒没回音也走还原（不会把界面卡在展开状态）。

宿主 `NativeBridge.CapturePageAsync`：`Page.getLayoutMetrics` 取参考值 →
按 4000 CSS px 切片 `Page.captureScreenshot`（`captureBeyondViewport:true`）→
后台线程解码拼接 → 存 PNG。

**三个坑，踩过就要记住：**

1. **裁剪框取 `.app` 的矩形，绝对不要取文档。** `.scene-stack` 是
   `inset:-3%`，文档比窗口大，按 `documentElement.scrollWidth` 截会多出一圈
   背景画（第一版就是这个症状：界面只占画面 85%，右边一圈大图）。
2. **`clip.scale` 传 1。** Chromium 自己会乘设备缩放；再传
   `devicePixelRatio` 等于乘两次——125% 屏幕上 1671 CSS 的裁剪出了 2611 像素
   （1.5625 倍），多出来的全是插值。
3. **高度要在图片 decode 之后量。** 封面没加载完时网格是矮的，早一帧就切掉
   最后一行卡片。高度取四者最大值：视图底边 / `.app` 盒子 / 视图
   `scrollHeight` / 滚动容器内容底边。

保存位置：`%USERPROFILE%\Pictures\GUGUOVA\GUGUOVA-<view>-<yyyyMMdd-HHmmss>.png`；
没有「图片」文件夹时回退 `<数据根>\screenshots`。**时间戳只到秒，同一秒内
连续导出两次会覆盖前一张**（`Bitmap.Save` 直接写，没有查重）——若要并行导出
或做自动化批量，先给文件名加毫秒或序号。

限制：页面 > 20000 CSS px 直接报错（不给你半张图）；有弹窗/浮层打开时拒绝
导出并提示先关闭。

### 1.11.4 主题适配

`.lib-dir` 的基础样式在 `src/views.css`，与 `.lib-sort select` 同一套
`--hair` / `--ink` 令牌。dusk（1px 圆角）、nightflight（0）、steam（3px）
原本单独定义过排序下拉的圆角与配色，本轮把 `.lib-dir` 并入它们原有那条
选择器（`html[data-theme="X"] .lib-sort select, … .lib-dir`），三套
`theme.json` patch +1。其余 11 套走基础样式。

新增的 `#i-camera` 是一个 `<symbol>`，插在 sprite 里 `#i-download` 之后。

### 1.11.5 本轮的验证边界

- 双目标编译 0 错误（net10 + net48）；
- 截图功能**实机验证过**（Owner 授权）：1439×899 / 125% 缩放 → 导出
  1800×4015；右边缘与窗口截图逐像素对齐；关闭按钮在、最后一行卡片完整；
  导出后文档高度 3783 → 899，窗口截图前后差异仅时钟与颗粒噪点；
- 排序**只做了静态推理 + 真实数据核对**（21 条 DNF 逐条推演），没有做
  逐条点击回归——下一轮 P1 里补一次人工确认即可。

---

## 1.12 启动性能（PR #33）与"秒开"的真实路线

### 1.12.1 已合并的改动

| 改动 | 说明 |
| --- | --- |
| 同包启动不再杀热实例 | PID 文件改为 `pid\|版本\|exe路径\|长度\|mtimeTicks`；四项全同只发激活信号（`AllowSetForegroundWindow` + 事件）后退出；换包或同版本号重发仍杀旧接管 |
| 首启解压后置 | 三个 Bootstrapper 从 `App.OnStartup` 移到 `MainWindow.OnLoaded` 的 `Task.Run`，闪屏先出，20 MB 解压不再挡在窗口前面 |
| 打包可复现 | `pack-assets.py` 固定 1980-01-01 时间戳 + 排序，内容不变则 zip 字节不变；此前每次重新打包都会重新解压 370 个文件并清 HTTP/Code Cache |
| 宿主侧计时 | `Log.Stage()` 输出 `[+Nms]`，日志时间戳补毫秒 |

证据：`nova.log` 里 14 次 `another instance holds the profile — taking over`
就是 14 次"点图标先把热实例杀了再冷启"；同版本连续三次
`renderer cache reset for 1.16.1.0` 是不可复现打包导致的重复清盘。

### 1.12.2 剩余成本构成（实测/估算）

| 段 | 量级 | 能否优化 |
| --- | --- | --- |
| 进程 → 窗口可见（net48 CLR + WPF） | 250–400ms | 能，但只值这么多 |
| WebView2 浏览器进程冷启 | **~1050ms** | 不能（Chromium 自身） |
| 导航 → 首帧（550KB CSS + `UpdateLayoutTree`） | **334ms** | 能，靠裁 CSS |
| 主题 CSS 二次注入 | 100–200ms | 能，靠预编译 |
| 开场动画 | **2150–2600ms** | 产品决定，不是性能 |

冷启到 CDP 就绪 1620ms；用户能点 ≈ 3.8–4.0s。

### 1.12.3 结论（已与 Owner 对齐，别再重新论证）

**换语言（Rust / C++）重写宿主只值 15%–25%，解决不了"秒开"。**
Chromium 那 1 秒换谁写都省不掉；自绘 UI（D2D/DComp）能到 300ms，但要重写
550KB CSS 与 14 套主题的层叠契约，等于毁掉产品身份。

真正的路线只有一条：**让进程在你要点的时候已经在了。**

1. **关窗口 = 收托盘（默认）+ 开机自启（首次启动问一次）** ← 收益最大、
   不动任何视觉。点击 → 0.1 秒窗口回来，动画照播；
2. **冷启那 1.6 秒用"主题首帧"填满**：把现在通用的 NOVA 闪屏换成当前主题的
   开场画面（14 张静止图，用现有截图工具批量出），到点交叉淡入接上 CSS 动画；
3. **CSS 预算**：critical 首屏 ~120–150KB + 其余延迟；`intro.css`（157KB）
   按需加载；主题 CSS 预编译成单文件（interfaces → theme → compat 顺序固定）。
   334ms → ~130ms。**这一项必须与第 4 项同批做**；
4. **开场动画快速模式**：首次或换主题播完整版、其余 500–700ms。
   注意：现在那 2.2 秒正好盖着"主题 CSS 注入后的第二次全量重算"，先砍动画
   会先看到卡顿。

原生预热器（1–2MB 小进程，登录时起、同一 UDF 预建 environment）能把冷启压到
600–800ms，但那是在前面四项做完之后才值得评估的选项，且必须先用
`Log.Stage` 采到几轮真数据。

---

## 1.13 本轮（1.16.3）：游玩时长进度条 · 里程碑变色

### 1.13.1 需求与两个已确认的产品决策

Owner 给了 21 个变色节点（小时）：`50 75 100 150 200 300 400 500 650 800
1000 1500 2000 3000 4000 5000 6000 7000 8000 9000 10000`，四个阶段的心理学
依据（固定间隔强化 → 分块里程碑 → 沉没成本 → 目标梯度）。动手前问过两个
问题，Owner 的回答：

1. **填充宽度语义**：从「累计 ÷ 40h 封顶」改为**「指向下一变色节点的区间
   进度」**——`[0,50)` 向 50h 渐满；之后每跨一个节点归零重填（如 120h 在
   100→150 之间显示 40%）；10000h 后恒满；**运行中仍强制 100%**（上游
   `progressInfo` 不变）。
2. **节点预告**：**只在详情页**显示——`dp-sub` 变成
   「可随时启动 · 下一阶段 · 6000 小时」（仅 `playtimeSeconds > 0` 时追加；
   10000h 后是「已达最终阶段」；运行中/缺失的文案不变）。首页保持干净。

### 1.13.2 机制：6 锚点阶梯，JS 解算、CSS 消费

22 个状态（基色 + 21 节点）不由主题逐个手写。每套主题在**自己 `theme.css`
的根选择器**声明 6 个锚点，21 个节点按区间均分插值：

| 小时区间 | 阶梯位置 |
| --- | --- |
| `[0, 50)` | tier 0 —— **不发布任何变量**，各表面保持自己的基色 |
| 50 / 75 / 100 / 150 / 200 | l0→l1 均分 5 档（200h 恰达 l1） |
| 300 / 400 / 500 / 650 / 800 / 1000 | l1→l2 均分 6 档（1000h 达 l2） |
| 1500 / 2000 / 3000 / 4000 / 5000 | l2→l3 均分 5 档（5000h 达 l3） |
| 6000 / 7000 / 8000 / 9000 | l3→l4 均分 4 档（9000h 达 l4） |
| **10000** | l5（终局锚点 + `is-tier-max` 类，主题可加签名态） |

关键实现事实（改这里之前先读）：

- **单一实现**：`src/app.js` 的 `PLAYTIME LADDER` 区块（HERO 区块之前）——
  `PLAYTIME_TIERS` / `PLAYTIME_ERAS` / `playtimeTierIndex()` /
  `playtimePct()` / `tierVarsFor()` / `applyTier(track, game)` /
  `progTierAttrs(game)`（模板用）/ `nextTierText()`。
- **发布方式**：JS 在每条轨道**容器**上内联写 `--prog-fill`（主色）、
  `--prog-fill-soft`（向白混 34%）、`--prog-fill-deep`（向黑混 34%）、
  `--prog-glow`（rgba .35）+ `data-prog-tier="0..21"` + `is-tier-max`。
  tier 0 **移除**全部变量（这是「[0,50) 保持原色」的保证——endfield 的
  大轨道基色是墨、库卡片基色是信号黄，同一主题不同表面基色不同，tier 0
  统一回落才不会互相污染）。
- **颜色数学全在 JS**（sRGB 手工混合，复用既有 `parseHex`/`mixHex`/
  `toHex`），**不用 color-mix**——legacy WebView2 109 不需要 @supports
  回退；主题锚点用 `getComputedStyle` 读取（var() 链会解析），按主题 id
  缓存在 `progLadderCache`。
- **阶梯来源**：主题声明了 `--prog-l0..l5` 就用主题的；没声明（以及
  nova）走 `deriveLadder(accent对)` 通用弧线（accent → accent-2 → 暖金 →
  亮金 → 白热）。nova 保持「封面取色」身份：每款游戏用自己的
  `game.accent/accent2` 现场派生；system 模式用米白对派生。
- **消费面**：`src/base.css` 的 `.progress-track i` / `.tile-progress i` /
  `.dp-track i` / `.lib-progress i` 与 `src/theme.css` 的 `.activity-track i`
  全部改为 `var(--prog-fill, 原表达式)` 系列——**变量不在时代码路径与
  1.16.2 逐像素一致**。13 套主题 + nova 的既有轨道覆盖同步把主色位换成
  消费写法（纹理不动，只换颜色位）。
- **五处渲染点接线**（旧的 40h 公式已全部删除）：`progressInfo`（hero +
  详情共用）、`renderHero`、`renderActivity`、`updateRail`、
  `renderLibrary` 模板（`progTierAttrs` 内联）+ `refreshLibraryLive`
  原地补丁（配合 `liveSignature` 已含 playtimeSeconds，签名不用改）、
  `updateDetailProgress`（+ 下一阶段文案）、`renderAppearance`。
- `.manage-progress-track` / `.launch-track` 是孤儿选择器（无 JS 驱动），
  本轮未动。

### 1.13.3 14 套主题的锚点

**现行锚点表见 §1.13.4a**（历经两轮 Owner 回访修订：先纯色化、再 HSL
宽弧重排，以 §1.13.4a 的表为准，本节初版表已删除避免双表漂移）。
终局签名态仍只有三套：endfield 三色条带、dusk 日出渐变、riot 白+红硬
阴影（`[data-prog-tier="21"]` 规则）。

锚点写法契约（`docs/THEME-INTERFACES.md` §14/§16.4 已登记为**可选插槽**，
照 `--hold-fill` 模式，未进 `REQUIRED_SLOTS`）：值必须能被
`getComputedStyle` 解析成纯色（hex / rgb() / 引用自家令牌均可）；六个一起
声明（少一个就整组回落到派生阶梯）。

### 1.13.4 验证

| 项 | 结果 |
| --- | --- |
| `tools/tier-shots.js`（本轮新工具） | **14 主题 × 7 档（2.5/60/120/320/1200/5400/11000h）× 3 视图 = 98 组检查 / 294 张截图，0 失败**；断言内容：发布的 `--prog-fill` 与工具内镜像的阶梯数学逐 hex 一致、`data-prog-tier` 正确、宽度符合区间语义、详情页含下一阶段文案、11000h 带 `is-tier-max` |
| 视觉抽查 | endfield 60h（橄榄黄分段）/ 5400h（薄荷）/ 11000h（三色条带）；dusk 11000h 日出渐变；broadcast 1200h REC 砖红；zerohour 320h 青柠；summer 1200h 海绿——全部符合各自语言 |
| `theme-slot-check --strict` | 0 finding（未新增必填插槽） |
| 构建 | modern net10 + legacy net48 双 0 错误（警告为既有数量） |
| `headless-shots --views=all` 全量回归 | 280 张；**唯一警告是 aurum 磁贴名 5px 裁切，已用 `git stash` 基线对照确认是 1.16.2 既有问题**（`.tile-name` "噩梦摇篮：献花于你"，与阶梯无关） |
| 静态/悬停对比度 | 未跑（本轮不改任何文字颜色；新令牌只做条色，铁律 21 不受影响）——下轮如要跑，照 §11 命令 |

### 1.13.4a 纯色 + 鲜明修订（Owner 两轮回访）

**回访一：双色渐变丑，改纯色。** 共享 `.progress-track i` / `.dp-track i`
/ `.activity-track i`、nova system 变体、以及 dusk / steam / nightflight /
summer / grimoire / aurum / codex 的全部渐变消费点，统一改成
`var(--prog-fill, 原渐变表达式)`——**点亮即纯色平涂，未点亮（tier 0）
回落原始渐变**。`--prog-fill-soft` / `-deep` 保留发布，但只给 `is-active`
等状态变体用。

**回访二：每阶段颜色不够鲜明。** 两个结构修改：

1. **插值算法从 RGB 混合换成 HSL 最短弧**（`mixHsl`，app.js 内
   `hexToHsl`/`hslToHex`/`mixHsl`）：RGB 混合会把两个锚点抵消成浊色，
   HSL 让每一步都是真正不同的色相；`tools/tier-shots.js` 的镜像数学已
   同步（断言逐 hex 一致）；
2. **14 套锚点全部重排为宽弧设计**：相邻锚点拉开 90°+ 色相弧（或大
   S/L 摆幅），节点间 15°–30° 一跳，阶段边界大跳。依据 ui-ux-pro-max
   的 color-dark-mode（暗底用更亮的色调变体）与游戏类深底高饱和惯例：

| 主题 | 阶梯走向（l0 → l5） |
| --- | --- |
| nova | 封面对派生，逐级提亮（accent → 提亮 secondary → 暖琥珀 → 金 → 亮金 → 白热） |
| endfield | 信号黄 →(绿弧) 薄荷 →(蓝紫弧) 品红 →(粉红弧) 金 →(橙红弧) 亮粉 → 终局三色条带 |
| dusk | 陶土 → 暮紫 → 金 → 靛 → 兰粉 → 日光（一整个黄昏的天色） |
| nightflight | 荧光黄绿 → 蓝 → 珊瑚 → 奶油 → 回充荧光 → 白（满月） |
| steam | 蓝 →(逐级提亮) 浅蓝 → 冰蓝 →(低饱和沙弧，避开绿红语义) 琥珀 → 亮琥珀 → 白 |
| summer | 天空蓝 → 青柠 → 珊瑚 → 日落紫 → 夜海墨 → 破晓金（海边一整天） |
| riot | 红 → 黄 → 墨（断墨）→ 亮红（血色回归）→ 白（漂白）→ 终局白+红硬阴影 |
| riso | 蓝 → 酸黄 → 深蓝（回印）→ 玫红（套印新色）→ 纸白 → 酸黄 |
| codex | 金 → 红宝石 → 鎏金 → 深红宝石 → 淡金 → 鎏金（明度大摆幅，双色族） |
| mnemo | 紫 → 琥珀 → 淡紫 → 梅 → 琥珀 → 烫金 |
| grimoire | 酒红 → 金 → 亮金 → 亮酒红 → 羊皮金 → 饱和金（明度锻打） |
| broadcast | 灰噪点 → 墨 → 砖红 → REC 渐强 ×2 → 最亮 REC（明度/饱和大摆幅） |
| aurum | 深青蓝 → 青 →(翡翠弧) 青铜 → 亮铜 → 淡金 → 白金 |
| zerohour | 黄 →(过主色青柠) 青 →(半个色轮) 橙 → 青柠主色 → 白 → 黄 |

锚点选取规则已写进 `docs/THEME-INTERFACES.md` §14/§16.4：相邻锚点 90°+
弧（双色族靠明度摆幅），不允许"五档几乎同一个色"。

### 1.13.5 已知限制

- **分段纹理主题的变色只换主色位**：endfield 的墨色缝、codex 的栗红缝、
  mnemo 的琥珀/梅缝、zerohour 的青色缝保持固定——这是刻意的（缝隙是纹理
  身份），但意味着这些主题的「颜色跳变」幅度比纯色主题小。
- **`data-prog-tier` 目前只有 endfield / dusk / riot 做了终局签名态**，其余
  11 套的 10000h 与 9000h 只差锚点颜色。要给某套加终局态，照 endfield
  `theme.css` 的 `[data-prog-tier="21"]` 规则抄。
- **`--prog-glow` 固定 rgba .35**；主题如果嫌光晕强，可以在自己的轨道覆盖
  里写 `box-shadow: none`（endfield 本来就是 none）。
- **工具镜像**：`tools/tier-shots.js` 里复制了一份阶梯数学（文件头注明
  keep-in-sync）——改 `app.js` 的区间表/插值时必须同步改工具，否则断言
  会假红。
- **aurum 磁贴名 5px 裁切**是既有问题（本轮基线对照确认），修法见 1.16.1
  的 `.tile-name` 省略号条目，疑似 aurum 字体度量边缘，留给下轮。

---

## 1.14 本轮（1.16.4，工作区待提交）：六项功能更新

### 1.14.1 格式化资料导出补全（需求①，中途澄清过）

Owner 原话澄清：**不是导出 txt 文件**，是编辑器里原有的「格式化资料 ·
导出现在有」导出的文本不全。改动全在 `src/app.js` FORMAT DOSSIER 区块：

- `DOSSIER_FIELDS` 新增两行：`游戏启动器`（fLauncher，新字段）与
  `字标方案`（fTypeRecipe，此前select 字段从不参与导入导出）；
- `exportDossier` 改为**每个标签都写**（空的也写 `标签：`）——导出文本同时
  是一份填空模板；导入侧对空值本来就跳过（`applyDossierToForm` 的
  `!String(value).trim()`），不会反向清空表单；
- `字标方案` 导出为**选项的人话标签**（如「描金衬线 · GILDED」），导入时按
  标签或值反查 option，查不到就丢弃该行（绝不写坏 select）；
- 现有 14 标签顺序：游戏程序 → 游戏启动器 → 名称 → 中文名 → 类型 →
  字标文字 → 字标方案 → 年龄分级 → 游玩模式 → 一句话介绍 → 详细描述 →
  启动参数 → 工作目录 → 封面。

### 1.14.2 游戏本体 / 启动器路径分离（需求②）

**数据层**：`GameEntry.LauncherPath`（空 = 不分离）。`ExePath` 永远指**本体**；
`LauncherPath` 指「必须先用它拉起游戏的启动器/登录器」。桥接全链路接通：
`GamePayload` 尾部 +2 参数（LauncherPath/Hidden，位置 record 只有 `ToPayload`
一处构造）→ `CreateGame`/`UpdateGame` 接收（UpdateGame 空串=清除，非空校验
File.Exists）→ `exists` 判定改为「本体存在 && (无启动器 || 启动器存在)」
（`NativeBridge.cs` ToPayload 内）。

**启动链路**（`Services/LauncherService.cs`，照 Steam/平台游戏的 pending
模式写）：

1. 直启分支遇到 `LauncherPath` 有效时：本体进程若已在跑（按 exe 全路径匹配）
   → **直接接管**（AttachProcess，不重复拉启动器，提示「已接管计时与缩放」）；
2. 否则启动**启动器 exe**（工作目录=启动器所在目录，`_pendingLauncher` 挂起，
   启动次数照计），`LaunchResult` 以 `pending=true + Hint` 返回；
3. `WatchLauncherBody` 后台轮询（1.5s 间隔，预算 5 分钟）等本体进程出现：
   全路径匹配优先，提权进程（MainModule 拒访）退化为「进程名 + 全新启动时间」；
   轮询前先快照已有本体 PID（`BodyProcessPids`）避免抓错旧实例；
4. 本体出现 → `AttachProcess`（会话、退出跟踪、前台、`GameStarted`）——
   **PID 从这一步起就是本体的**，所以 `PresentGameWindow → GameDisplay.Present`
   的找窗、前台、Magpie 热键、游玩计时全部天然作用于本体，下游零改动；
5. 超时 → `GameFailed` 提示（可能要在启动器里手动点开始，或「游戏程序」填的
   不是本体 exe）；`Stop()` 会连 `_pendingLauncher` 一起取消；
6. 仅直启（manual）游戏生效；Steam/平台游戏的 launchMode 分支完全不看该字段。

**UI**：编辑器 fExe 行下新增「游戏启动器（可选）」（fLauncher + 浏览
`pickerOpen({filter:'exe'})`）；`openEditor`/`saveEditor`/`resetEditorFields`
同步；启动覆盖层的 pending 文案按 Hint 区分「等待游戏本体… / 交给启动器」。

### 1.14.3 隐藏游戏（需求③）

- `GameEntry.Hidden`（bool）透传到 payload 的 `game.hidden`；
- **管理面板开关**：`#manageHiddenRow`（pref-row + switch，`#i-eye` 图标），
  `toggleManageHidden` 走 `updateGame {id, hidden}`，失败回滚；开关文案随
  状态切换；`populateDetails` 统一同步；
- **游戏库入口**：`#libFilters` 里「程序缺失」后新增 `<button class="filter"
  data-filter="hidden">隐藏</button>`（图一红框位），事件委托零改动；
- **过滤语义**（`filterGames`）：hidden 视图只显示隐藏游戏；**其余一切视图
  （全部/最近游玩/已收藏/平台/程序缺失 + 搜索 + 类型筛选）隐藏游戏完全不
  参与**。首页 hero/横排磁贴不受影响（显式假设：隐藏只管游戏库列表）；
- **数据包**：导出/替换导入是整对象序列化（`BackupService` 直接搬
  library.json），Hidden/LauncherPath 自动携带——Owner 的要求天然满足；
  合并模式 `MergeInto` 白名单已补两字段（LauncherPath 空则补、Hidden 只置
  true 不取消）。

### 1.14.4 排序控件主题化收口（需求④，图一绿框）

根因：`views.css:788` 的 `.lib-sort select` + `.lib-dir` 只有 nova 基础样式
（8px 圆角 ink 半透明底），13 套主题里只有 dusk/nightflight/steam 覆写过
（views.css:801 注释约定：覆写 select 必须同规则带上 `.lib-dir`）。图一
截图是 endfield——硬边工业风配默认圆角浅底，一眼假。

本轮收口：

- **10 套新增覆写**（追加在各 theme.css 文件尾、统一 `html[data-theme]`
  前缀、注释标 1.16.4）：endfield（方角 + `--ef-rule` 边 + `--ef-panel`
  底）、riot（2px #111 硬边 + `#faf8f3` 底 + hover 反白）、riso（2px 蓝边
  + hover 酸黄）、zerohour（纸白边 + 黑底 + hover 信号黄）、broadcast（方
  角灰边纸底）、summer（白底青边胶囊 + condensed）、grimoire（金边羊皮纸胶
  囊 + serif）、codex（金 hairline + cream 字）、mnemo（紫边方角 mono）、
  aurum（青铜 hairline + hover 亮铜）；
- **3 套既有覆写**（dusk/nightflight/steam）选择器扩出
  `.lib-genre select`；
- **新控件同规则**：`.lib-genre select`（类型筛选，见 1.14.5）基础样式与
  `.lib-sort select` 完全同族（views.css），约定注释已更新为「select +
  `.lib-dir` + `.lib-genre select` 三件套」；
- 每套 `theme.json` patch +1（铁律 41）。

### 1.14.5 类型筛选 + 类型下拉输入（需求⑤）

- **工具栏**：`.lib-search` 右侧新增 `<label class="lib-genre">` 包
  `<select id="libGenre">`（首个选项「全部类型」）。`initThemedSelects`
  自动把它升级成 nova-select——关闭态就是原生 select、弹层走 `--menu-*`
  主题槽位，14 套主题零额外适配；
- `syncLibraryGenreFilter`（app.js）：选项集 = 库内全部真实类型
  （`gameTypes` 过滤掉平台伪类型如 "Steam"），**只在集合变化时重建**
  （signature 比对，不搅乱打开中的弹层）；选中的类型消失时自动重置为
  「全部类型」；`state.libGenre` 不持久化（重启回到全部，与 libFilter 一致）；
- `filterGames` 管线：hidden → tab → **类型** → 搜索 → 排序，类型筛选叠加
  在当前 tab 上（隐藏视图里也能按类型筛）；
- **编辑器 combo**：fGenre input 保留自由输入（原版行为）+ `#fGenrePick`
  小箭头按钮 → `.genre-menu` 弹层（复用 `.nova-select-menu` 类 =
  `--menu-*` 主题化；锚点 `#genreCombo` relative）。列表按当前输入过滤，
  点击回填；不用原生 datalist（弹层无法主题化）。

### 1.14.6 磁贴封面标签（需求⑥，图二红框）

- `libraryBadgesHTML`：状态徽章（CURRENT/运行中/程序缺失）之后，按
  `settings.libraryTagCount`（1–3，默认 3）追加标签芯片：**平台 → 类型 →
  模式**。平台徽章本身就是第 1 个标签（手动游戏没有 → 自动少一个）；类型取
  `gameTypes(game)[0]`（过滤平台伪类型）；模式 = `game.mode`；
- 芯片复用 `.tile-badge` + `.tag` 修饰——13 套主题的 `.tile-badge` 覆写
  自动生效，`.tag` 只加宽度封顶（92px 省略号，类型名可能很长）；
- **设置**：设置页主列新卡「游戏库显示」（`settings-card--library`），
  `#settingsTagCount` select → `settings.libraryTagCount` → saveSettings
  （180ms 防抖）→ C# `PlayerSettings.LibraryTagCount`（1–3 夹紧）→
  library.json；boot 回填同链路；改完即时 `renderLibrary()`；
- 只做库卡片（图二即库卡片）；首页横排磁贴不加（避免首页拥挤，可后补）。

### 1.14.7 验证记录

| 检查 | 结果 |
| --- | --- |
| `dotnet build -c Debug` 双目标 | **0 错误**（5 个警告全部为既有） |
| `node tools/theme-slot-check.js --strict` | 0 finding |
| `node tools/feature-checks.js`（本轮新增） | **29/29 过**：隐藏视图互斥/搜索排除/跨视图类型筛选/标签数量档位/nova 8px 与 endfield 0px、dusk 1px 指纹/隐藏开关桥接往返/启动器路径保存回读/类型 combo 弹层/格式化资料 14 标签全导出 |
| `node tools/headless-shots.js --views=all` | 294 张，仅 dusk(2px)/aurum(5px) 的 `.tile-name` 既有裁切（stash 基线对照确认 1.16.3 就有），0 新增 |
| `node tools/tier-shots.js --shots=false` | 98 组检查全过（时长阶梯零回归） |

`tools/feature-checks.js` 与 `?novaHidden=1` / `?novaTags=<1-3>` QA 旋钮
（`tools/lib/headless-host.js`）为本轮新增，不动任何默认 mock 数据。

### 1.14.8 启动后延迟缩放（Owner 实机回访补上的）

Owner 实测发现：有的游戏要先加载，本体窗口一出现就发缩放会**无效**。新增
全局设置「启动后延迟缩放」（设置 → 启动与关闭，`#settingsScaleDelay`：
立即 / 3 / 5 / 10 / 15 秒，默认立即）：

- `PlayerSettings.ScaleDelaySeconds`（0–120 夹紧，boot 序列化自动带回
  `scaleDelaySeconds`）→ `saveSettings` / `applyBoot` / `renderSettings`
  标准链路（回显时吸附到 0/3/5/10/15 选项，手改值不会把下拉弄空白）；
- 生效点在 `NativeBridge.PresentGameWindow`：`Task.Run` 内
  `Task.Delay(delay)` 后再 `GameDisplay.Present`。**延迟只作用于缩放请求**
  ——`scale=false`（没开缩放/引擎关）时零延迟，最小化等其它步骤不受影响；
- `GameDisplay.AllowForeground` 仍在启动瞬间调用：加载期间游戏窗口照常
  自己浮到前台，只是 Magpie 热键等满 N 秒才发；
- 延迟与 Present 内部的「等窗口出现（15s）」预算是叠加关系：先等 N 秒、
  再等窗口（通常已就绪）、再 BringToFront + 热键 + 6s 生效校验，失败仍回退
  原生无边框。

### 1.14.9 已知限制

- 隐藏当前游戏时 hero 照常显示（隐藏只管游戏库列表）——若 Owner 觉得首页
  也该藏，加一行过滤即可；
- 类型 combo 的弹层在编辑器滚动容器内打开向下，贴底时可能被裁（实测未见，
  弹层 max-height 280px 自滚动）；
- `merge` 模式导入对 Hidden 只置 true——不能靠合并导入「取消隐藏」（replace
  模式可以）。

---

## 1.15 实测排查记录：DNF 基准测出「Magpie 没有正确启动」（本轮后半，Owner 指令停止调试）

Owner 用真实游戏 **DNF-Season1-Act4**（`E:\Game\DNF-ACT4\ACT4\`，本体
`DNF.exe` + 启动器 `1一键启动（…）.bat`）实机测试后反馈：缩放无效、Magpie
没有正确启动。用 Owner 日志 + 隔离实例（`NOVA_DATA_ROOT` + `NOVA_CDP_PORT`
+ CDP 驱动）做了完整排查。**Owner 已叫停调试，本节是全部证据与下一步。**

### 1.15.1 结论：缩放链路断在「缩放从未被请求」，不是分离链路断了

Owner 实例日志（`%LOCALAPPDATA%\NOVA Game Space\nova.log`）04:06–04:20 的
四次 `launched via launcher` 全部以
`present pid=… scale=False engine=none scaled=False` 收尾——**scale=False，
Magpie 压根没被要求**。两个叠加原因（都已处理）：

1. 该游戏 `fullscreenScale=None`（详情页「全屏缩放」没开）+ 窗口模式启动
   （非沉浸）→ `fullscreen=false` → 不缩放。**Owner 需要给游戏打开全屏
   缩放开关**（既定设计：per-game 显式开关）。
2. 设置里 `autoStartEngine=False` → 旧逻辑 `EnsureRunning(force:false)`
   不会拉起引擎 → 即使 scale=True，Magpie 也起不来 → 静默降级原生无边框。
   **已修**（见 1.15.2-①）：明确缩放请求 = 授权拉起引擎。

### 1.15.2 本轮随之落地的三个修复（已构建通过，未提交）

| # | 修复 | 位置 |
| --- | --- | --- |
| ① | **明确缩放请求强制拉起引擎**：`LaunchOptions` 加 `ScaleExplicit`（=详情页勾选传入的 `requested==true` 或 `game.FullscreenScale==true`），`GameDisplay.Present` 用它作 `EnsureRunning` 的 `force`；沉浸默认不算显式、维持 force=false 旧语义 | `Services/LibraryModels.cs`（LaunchOptions）、`NativeBridge.cs`（LaunchGame/PresentGameWindow）、`Services/GameDisplay.cs`（Present） |
| ② | **引擎没在跑时明确报错**：scale=True 且引擎未运行时，present 结果带「缩放引擎没有在运行（可在设置开启「自动启动内置缩放引擎」），已改用无边框全屏」——不再无声降级 | `Services/GameDisplay.cs`（Present 的 scale 分支） |
| ③ | **游戏退出连带关闭启动器进程树**：分离启动时记录启动器 PID（`_launcherTreePids`），本体退出/手动停止/等待超时三条路径都 `taskkill /PID <pid> /T /F`。动机见 1.15.3 的孤儿服务端 | `Services/LauncherService.cs` |

### 1.15.3 游戏环境侧的真凶：孤儿服务端占端口（应用已修，环境残留还在）

DNF 的 `.bat` 链路：`start` 分离启动服务端 `DNF60ACT4ServerV1.0.0\DF60ACT4.exe`
（进程名 **DfoServer**）→ 2 秒后 `run.bat` 带参启动客户端 `DNF.exe`。
游戏退出后**服务端不死**（分离启动），占住 7001/17001：

- 服务端日志（`E:\Game\DNF-ACT4\ACT4\DNF60ACT4ServerV1.0.0\logs\server.log`）
  实录：11-03、11-07、11-10 04:06 三次 `[READY]` 正常；**04:07/04:17/04:18/
  04:19/04:20 五次全部 `10048 端口占用`异常退出**（上一次的孤儿服务端占着）。
- 排查时仍有一个 **DfoServer（PID 38896）提权运行中、独占 7001**，普通权限
  `Stop-Process` 拒绝访问杀不掉。**需要 Owner 手动处理**（管理员
  PowerShell：`Stop-Process -Id 38896 -Force`，或直接重启机器）。
- 修复 ③ 就是为这个：本体退出时把 `.bat` 整棵树带走（cmd 还在等 run.bat
  返回的窗口期大多能连树杀掉；提权幸存者无解，如实记录）。
- 我的隔离测试运行：新服务端 `10013`（绑定被提权僵尸独占）、客户端 18 秒
  非零退出 → TryMagpie 没等到活窗口。**「真实 DNF 窗口被 Magpie 成功缩放」
  这最后一步仍未验证**——被环境卡住，不是代码证据。

### 1.15.4 已验证的部分（不用重测）

| 环节 | 证据 |
| --- | --- |
| `.bat` 启动器链路 | Owner 日志 5 次 `launched via launcher`（含中文全角括号路径）✓ |
| 本体进程按 exe 全路径解析 | Owner 日志 `game body attached pid=`（3–4 秒）✓ |
| 延迟缩放设置 | 隔离实例 scaleDelaySeconds=3，present 在延迟后触发 ✓ |
| **引擎强制拉起（修复①）** | 隔离实例 autoStartEngine=False + 明确缩放请求 → 日志 `scaling engine released (auto-started)`（Magpie 被拉起）✓ |
| TryMagpie 热键 + 6 秒校验执行 | 隔离实例 present 日志 `engine=none scaled=False 缩放引擎没有接管这个窗口`（客户端先死了，机制本身跑到了）✓ |

### 1.15.5 给下一轮（更强的 AI）：待办与怀疑点排序

**第一步（环境清障，Owner 配合）**：
1. 管理员杀掉 DfoServer 38896（或重启机器），确认 `netstat -ano | findstr :7001` 为空；
2. 给 DNF-Season1-Act4 打开详情页「全屏缩放」；设置开「自动启动内置缩放引擎」；「启动后延迟缩放」选 5–10 秒；
3. 重跑：设置 → 启动与关闭确认；点启动；看 nova.log 的 `present` 行——
   目标是 `scale=True engine=magpie scaled=True`。

**若 TryMagpie 仍失败，按此顺序怀疑**：
1. **本体 exe 选错**：`DNF.exe` 的主窗口未必是实际渲染窗口（目录里另有
   `DF60ACT4.exe`——那是服务端的）。用 Spy++/窗口枚举确认 DNF.exe 的
   FindMainWindow 结果是否玩家看到的窗口；若游戏真窗口属于别的子进程，
   需要把「本体进程解析」升级为「本体进程**树**里挑有主窗口的那个」；
2. **窗口句柄重建**：加载完成后游戏重建窗口 → Magpie 缩放被丢弃。对策：
   延迟加大，或 TryMagpie 失败后隔几秒重试一次（Present 里加一次 retry）；
3. **前台判定**：TryMagpie 要求前台属于目标窗口（GameDisplay.cs:410），
   可能被启动器/服务端窗口抢占——检查 `BringToFront` 返回值与时序；
4. 热键 `registered=false` 是常态（Magpie 自己注册了同一个键），不是问题。

**测试基建经验（省下一个 AI 半小时）**：
- 隔离实例：`NOVA_DATA_ROOT=<空目录>` + `NOVA_CDP_PORT=9233` 起 exe，
  库 JSON 先种好（camelCase，`currentGameId` 指向条目），CDP 用
  `tools/lib/cdp.js` 连接，**驱动启动用页面 `window.nova.call('launch',
  {id, fullscreenScale:true})`**——UI 点击会被自动弹出的扫描器等遮挡；
- **本体 exe 千万别选 System32/Windows 下的程序**（notepad 也算）：
  `StoreService.IsDeveloperTestEntry`（:370）会把它们标记 DeveloperOnly
  并从 boot 载荷过滤 → 页面 is-empty、扫描器自动弹，看起来像「库没加载」；
- 从 Git Bash 启动测试实例会把 Git 的 PATH 传给子进程：.bat 里的
  `timeout /t 3` 会解析到 GNU timeout 直接报错。测试 .bat 里写
  `%SystemRoot%\System32\timeout.exe` 绝对路径，且内容用纯 ASCII
  （中文 UTF-8 的 .bat 会被 cmd 按系统代码页解码错乱）；
- 本轮测试产物已清理（`_nova-e2e*` 目录已删），按上面配方两分钟可重建。

**顺带未完成的验收**：§7 P0-0 的 UI 观感清单 + 提交/PR/发版流程都还没走
（1.16.4 全部改动在工作区待提交）。

---


## 1.16 追加一轮：把 §1.15.5 的怀疑点落成代码（2026-11-10，未提交）

Owner 说「查看交接文档，继续修复问题」。本轮只动 `Services/GameDisplay.cs`
一个文件（+289 / −72 行），不碰 UI、不碰用户数据、没有重启程序、没有再拉起
隔离 DNF 实例（上一轮 Owner 已叫停调试）。§1.15.5 列的三个怀疑点全部落地：

| # | 修的是什么 | 位置 |
| --- | --- | --- |
| ① | **本体进程树里挑真实渲染窗口**：新增 `ProcessFamily(pid)`，用 Toolhelp32 一次快照收集本体及其三代子进程（上限 64 个）；`FindMainWindow(HashSet<int>)` 按可见窗口面积挑最大的，`ApplyBorderless` 同样接受整组 PID，原生无边框回退也能作用于子进程窗口。快照失败就退化成 `{pid}`，等于旧行为 | `ProcessFamily` / `FindMainWindow` / `ApplyBorderless` |
| ② | **窗口重建后安全重试**：`TryMagpie` 最多两次，第一次失败等 2 秒重新找窗（句柄变了就换新的）再发一次热键。Magpie 热键是「切换」，所以第二次只在「Magpie 没有在缩放任何窗口」时才发，否则直接停手，绝不会把已生效的缩放按掉 | `TryMagpie` / `MagpieSource` |
| ③ | **前台判定不再骗自己**：`ForegroundBelongsTo` 原本把同进程的登录/浮层窗口也算「在前台」；现在先对选中的精确句柄 `SetForegroundWindow` + `BringWindowToTop`，仍不精确才走 `BringToFront` 全套兜底。`BringToFront` 末尾补了合成 Alt 键解锁前台锁（真实日志里有两次 `foreground=False`） | `TryMagpie` / `BringToFront` |
| ④ | **误判修复**：`IsMagpieScaling` 原来要求 `Magpie.SrcHWND` 严格等于我们挑的句柄，游戏一旦重建窗口就永远判失败。现在改成「src 窗口仍存在且属于游戏进程树」即算成功，并返回实际被缩放的句柄 | `ScaledWindowIn` |
| ⑤ | **引擎起不来也要说清楚**：`Supported=false` 或 `EnsureRunning` 失败时，以前会静默降级成无边框；现在统一带 `engineReason`，把 `Status.Note` 也带出来 | `Present` |
| ⑥ | **日志能定位**：`present` 行新增 `owner=` `family=` `cls=`，缩放失败再带 `try=N hwnd= fg=/exact= src= rebuilt=`。Owner 下次实机跑一次就能看出窗口挑错没挑错、前台有没有拿到、Magpie 到底缩了哪个窗口 | `Present` / `TryMagpie` |

### 验证（本轮全部可复跑）

| 检查 | 结果 |
| --- | --- |
| `dotnet build NovaGameSpace.csproj -c Debug`（完整构建，输出到临时目录） | **0 错误**，5 个既有警告 |
| `dotnet build legacy/NovaGameSpace.Legacy.csproj -c Debug` | **0 错误**，47 个既有可空性警告（新代码 net48 兼容） |
| `node tools/theme-slot-check.js --strict` | 0 finding |
| `node tools/feature-checks.js` | 29/29 全过（六项功能零回归） |
| `node tools/tier-shots.js --shots=false` | 98 组检查全过 |
| Toolhelp32 结构体布局自检（一次性临时项目，跑完即删） | `sizeof(PROCESSENTRY32W)=568`、枚举 360 个进程、找到自己拉起的子进程 `cmd.exe` 且 ParentProcessId 正确 → 64 位布局与 Unicode 名都对 |
| 末尾补上 `usedWindow = rebuilt`（回退也用新窗口）后复跑 | modern `-t:Compile` 0 错误、legacy 完整 build 0 错误；modern 完整 build 唯一的失败仍是复制被锁的 apphost（MSB3027），与代码无关 |

> 构建坑记一笔：`dotnet build -t:Compile` 单独跑会跳过 XAML 生成，报
> `MainWindow.xaml.cs: RootBorder 不存在` 一类 18 个**假错误**；验证编译必须跑
> 完整 build。运行实例锁 exe 时用 `-p:BaseOutputPath=<临时目录>/` 绕开，别去杀
> 用户的程序。本轮临时输出目录（182 MB）已直接删除，没进回收站。

### 仍然没验证、也没动的部分

- **真实 DNF 窗口被 Magpie 成功缩放仍未验证**。代码加固只是把可疑路径堵死，
  最后一步必须实机看日志；本轮遵守上一轮「叫停调试」，没有动
  `%LOCALAPPDATA%\NOVA Game Space` 的真实库。
- **`bin/Debug` 还是旧的**：`GUGUOVA.exe` 被运行中的实例 PID 29332 锁住，
  完整 build 复制 apphost 时重试 10 次失败（MSB3027）。本轮改用临时输出目录
  验证编译，没有擅自关用户的程序、也没有覆盖运行中的 exe。
- 1.16.4 全部改动仍在工作区未提交；提交 / PR / 发行按 §7 P0-0 第 5 条等验收。

### 下一步（Owner 三步，日志就能给结论）

1. 关掉当前 GUGUOVA 实例 → `dotnet build -c Debug`（这次不会被锁）→ 重新打开；
2. 给 DNF-Season1-Act4 打开详情页「全屏缩放」；设置里开「自动启动内置缩放引擎」，
   「启动后延迟缩放」选 5–10 秒。7001 端口本轮复查**已空闲**，提权僵尸
   DfoServer 38896 已不在，不必再清障；
3. 启动游戏，看 `nova.log` 的 `present` 行：目标是
   `scale=True engine=magpie scaled=True`，且 `family>1` / `cls=` 能看出挑中的
   是渲染窗口；若仍失败，`try=1/2`、`fg=/exact=`、`src=`、`rebuilt=` 会直接
   指出卡在前台、窗口重建，还是 Magpie 压根没接管。

---

## 1.17 第三轮：全自动实机验收 + 倍数缩放 + 算法生效（1.16.5，未提交）

Owner 先授权「全自动测试，默认全部权限」，随后连续追加两条需求：**除了全屏缩放，
倍数缩放也要实现**；**缩放设定里的算法（尤其像素算法）也要生效**。本轮全部实机
闭环，版本从 1.16.4 bump 到 **1.16.5**（`tools/bump-version.js`，同步两个 csproj
与 `src/index.html` 的 `?v=` 缓存戳）。

### 1.17.1 安全边界与环境处置

| 项 | 处置 |
| --- | --- |
| 用户真实库 | **没有改动**。整体备份在 `03-归档备份\NOVA-data-20261110-0531`（3355 文件 / 372 MB，含 library + media + backups）；测试库只写在 `E:\nova-e2e-app`，已删除 |
| Magpie 全局配置 | `%LOCALAPPDATA%\Magpie\config\v5\config.json` 先备份为该归档下的 `magpie-config-before-factor.json`；测试完**已还原**成 Owner 原值（scalingMode=6 / initialWindowedScaleFactor=0 / custom=1.25） |
| 提权旧实例 PID 29332 | `Stop-Process` 与 `taskkill` 都拒绝访问。改用**重命名** `GUGUOVA.exe→GUGUOVA.old.exe`、`GUGUOVA.dll→GUGUOVA.old.dll`，让 `dotnet build -c Debug` 绕开文件锁刷新 `bin/Debug`；旧实例继续正常运行，不影响 Owner |
| 隔离实例启动配方 | `NOVA_DATA_ROOT=E:\nova-e2e-app` + `NOVA_CDP_PORT=9233`，**PATH 覆盖成纯 Windows 系统路径**——否则 Git Bash 的 GNU `timeout` 会让 DNF 的 `.bat` 里 `timeout /t 2` 解析错；CDP 用 `tools/lib/cdp.js`，驱动 `window.nova.call('launch',{id,fullscreenScale:true})` |
| 收尾 | 隔离数据根直接删除（没进回收站）；7001 端口空闲；`bin/Debug` 里两个 `.old` 文件因旧实例仍映射而删不掉，等它退出后 `del GUGUOVA.old.*` 即可 |

### 1.17.2 实机证据（真实 DNF-Season1-Act4，不是 mock）

| 场景 | 日志关键行 | 窗口实测 |
| --- | --- | --- |
| 全屏缩放 | `present … mode=fullscreen factor=- engine=magpie scaled=True try=1 fg=True/exact=True` | 源 640×480 → Magpie 窗口 **2560×1600**（整块屏幕） |
| 倍数缩放 2.5× | `present … mode=factor factor=2.5 engine=magpie-factor scaled=True` | 源 640×480 → **1618×1209**，比例 **2.528 / 2.519**，明显没铺满屏幕 |
| 像素算法 + 2.5× | `magpie algorithm written 像素缩放 index=7` → `magpie restarted for scale profile …` → `present … algo=像素缩放 factor=2.5 engine=magpie-factor scaled=True` | 仍是 1618×1209；配置 `scalingMode=7`（像素缩放）+ Custom=6 / 2.5 同时成立 |

证据文件：`_shots/nova-e2e-magpie-20261110.log`、`_shots/nova-e2e-pixel-algo-20261110.log`。
窗口尺寸由一次性 Win32 探针（枚举顶层窗口 + GetWindowRect + 类名）量出，探针随
隔离目录一起删了；**没有把任何真实游戏画面截图存进仓库或 `_shots/`**。

### 1.17.3 倍数缩放：方案与实现

调研结论：Magpie 官方 README 明确「Supports both fullscreen and windowed scaling」，
本机配置里就有 `shortcuts.windowedModeScale=3153`（Alt+Shift+Q）、
`profiles[0].initialWindowedScaleFactor`（枚举，**Custom=6**）与
`customInitialWindowedScaleFactor`（1.1–10×）。两个候选做法：

- **A · 用 Magpie 原生窗口化缩放**：画质走 Magpie 算法、倍率精确、与全屏共用引擎；
  代价是要写引擎配置并重启一次。
- **B · 启动器自己 SetWindowPos 把窗口乘倍数**：零依赖，但只是系统拉伸，画质糊，
  等于没用引擎。

选 **A**。实现落在：`PlayerSettings.ScaleMode`（fullscreen / factor）与
`ScaleFactor`（1.1–10，默认 2）；`ScalingEngine.ReadWindowedHotkey()` /
`WriteWindowedFactor()`（Custom 枚举与自定义值必须**两个字段联动**，写前备份、
返回 changed）；`GameDisplay.Present` 按模式发不同热键、成功时 `engine=magpie-factor`；
设置页「启动与关闭」新增「缩放方式」「放大倍数」两个 `nova-select`（自动继承 14
套主题槽位，没改任何主题 CSS）。倍数行在全屏模式下隐藏。

### 1.17.4 缩放算法：从"能选"到"一定生效"

现状排查：引擎设置弹窗早就有「缩放算法」下拉，`SaveEngineOptions` 保存后也**已经**
重启引擎——所以问题不是"配置写了没加载"，而是：算法只在弹窗里能选、启动器自己的
缩放设定里没有它，而且引擎弹窗与启动器设置可能不一致，下次启动游戏会把旧算法改回去。

实现：`PlayerSettings.ScaleAlgorithm` 存**算法名称**（不存索引，Magpie 增模式或数据
包换机器都不会串）；`ScalingEngine.ApplyAlgorithm()` 按名称在 `scalingModes` 里找
索引、写 `profiles[0].scalingMode`、备份并返回 changed；`ReadAlgorithmName()` 回显。
三条生效路径：① 设置页改算法 → `SaveSettings` 立即写配置并重启运行中的引擎；
② 每次启动游戏 → `Present` 在引擎起来后把算法与倍率**合并写入、只重启一次**；
③ 引擎设置弹窗保存 → 原生侧把名称同步回 `PlayerSettings`，避免两处打架。
设置页新增「缩放算法」下拉，选项来自 `engineOptions.modes`，带「跟随引擎当前设置」。
本机像素算法清单：索引 6 `Integer Scale 2x`(Nearest 2x)、7 `像素缩放`(Nearest)、
8 `像素超清`(Anime4K 组合)。

文案按人话收口：per-game 开关由「全屏缩放」改叫**「启动时缩放」**（方式由设置页决定），
引擎弹窗的「全屏缩放方式」改叫**「缩放引擎」**，toast / 失败提示同步。

### 1.17.5 顺带修掉的真 bug：孤儿服务端带不走

上一轮的修复③ 写的是 `taskkill /PID <cmd> /T /F`，日志写了 `launcher tree killed`
但服务端仍占 7001。根因实测：`.bat` 用 `start` 拉起服务端，cmd 在本体退出前就
结束了，服务端 `ParentProcessId` 指向已死的 PID，**/T 的父链断了，谁也带不走**。

修法（`LauncherService.cs`）：新增 `LauncherTreeScope`，启动分离启动器前记下
「启动器目录 + 该目录下已存在的 PID」；退出时除原 `taskkill /T` 外，再扫一次该
目录，只结束**本次新出现**的进程，排除自身、启动器 PID 和其它正在进行的会话；
提权幸存者记 `launcher orphan kept` 如实留证。三次实机退出都得到
`launcher orphan killed …`，7001 每次都释放。

### 1.17.6 验证清单

| 检查 | 结果 |
| --- | --- |
| `dotnet build -c Debug` 双目标 | 0 错误（现代 5 个、legacy 47 个既有警告） |
| `node tools/theme-slot-check.js --strict` | 0 finding（14 套主题槽位没被新控件破坏） |
| `node tools/feature-checks.js` | **41/41 全过**；[7] 组 8 项（倍数模式回填/显隐/保存往返、算法下拉、像素算法往返）+ [8] 组 4 项（主页勾选框、点击切换、引擎弹窗同一状态） |
| `node tools/tier-shots.js --shots=false` | 98 组检查全过（294 张截图 / 304s） |
| `node tools/headless-shots.js --views=all` | 294 张；26 条警告全是既有 aurum(5px) / dusk(2px) 磁贴名裁切，**0 新增**，新控件没把文字挤断或撑破布局 |
| 隔离实机 | 全屏 / 2.5 倍 / 像素算法三种配置全部 `scaled=True`，窗口像素尺寸为证（§1.17.2） |
| 退出清理 | 三次 `launcher orphan killed`，7001 均释放 |

### 1.17.6a 主页「缩放设置」里的开启缩放勾选框

Owner 第三次追加：「在游戏主页的缩放设置里面，加入新的勾选框，要不要开启缩放，
免得到游戏详情里面缩放」。查证后发现主页 `#homeEngineBtn` 打开的是**引擎设置弹窗**，
里面只有引擎 / 算法 / 捕获等项，确实没有「这局开不开缩放」的入口；主页 hero 里
虽有一个 switch，但不是勾选框。两处一起补：

- 主页 `.hero-scale` 行 `role="switch"` → `role="checkbox"`，右侧换成
  `.hero-scale-check` 方形勾选框（沿用 `homeScaleSwitch` id，`setPrefSwitch` 照常
  加/删 `.on`）；文案改「开启缩放」，hint 说清「方式在设置页选」。
- 引擎弹窗 `.engine-body` 顶部新增 `engineScaleRow` 勾选行，与主页、详情页共用
  `fullscreenScaleFor(game)` / `toggleHeroScale()`；新增 `syncEngineScaleRow()`，
  由两个 sync 函数和 `fillEngineDialog()` 统一调用，三处永远是同一个值。
- 勾选框只认 `.on` 出勾，边框与勾用 `var(--accent)`、圆角用
  `var(--hero-scale-radius, 9px)`，各主题自己决定硬边还是圆角；**没有改任何主题
  CSS，也没有做一套统一的"绿勾选框"**。
- 断言：[8] 组 4 项（主页有勾选框 / 点击能切换 / 弹窗有同一勾选框 / 状态镜像）。

### 1.17.7 发行结果 / 下一步

1. ✅ **提交 / PR / 发行已完成**：`b20e14f` → PR [#36](https://github.com/118coder/guguova-game-space/pull/36)
   → 合并 `bbdd2d0`；`bash tools/release.sh --publish` 发布 `v1.16.5`（三资产与哈希见头部）。
   推送通道实测是 Clash Verge 的 **7898**（文档里旧的 7897 已失效）；本机没有 gh CLI，
   PR 用 GitHub API 创建与合并，`publish-release.py` 同样走 API 上传资产。
2. **`.old` 文件**：已从 `bin/Debug` 移到 `03-归档备份\old-build-1.16.4\`，不会进发行包；
   Owner 的提权旧实例退出后直接删除，不要进回收站。
3. **真实库设置**：没有替 Owner 改 `library.json`。新版本里默认是
   「全屏缩放 / 2 倍 / 跟随引擎当前算法」；要用倍数或指定像素算法，在
   **设置 → 启动与关闭 → 缩放方式 / 放大倍数 / 缩放算法** 里选一次即可，
   选完立即写进引擎，启动游戏时还会校验。单款游戏开不开缩放，直接在
   **主页勾选框**或主页「缩放设置」弹窗顶部勾选，不必再进详情页。
4. §7 的 1.16.3 颜色回访、五平台真机、Steam 全流程、UI 观感清单沿用，未受影响。

---

## 1.18 第四轮：沉浸模式机制 + 缩放控件彻查（工作区待提交，外观深化暂停）

> Owner 原话：「先暂停，你的设计稿不符合主题的设计理念。你先实现，后面再改吧。」
> 因此本轮**只交付机制**，14 套主题的沉浸外观是占位实现，等 Owner 给定稿方向再逐套深化。
> 静态构图稿保留作过程产物，**不作为 CSS 实现依据**。

### 1.18.1 参考图里值得借鉴的（回答 Owner 的提问）

PS 主机式大屏的排版结论，只有「结构」被采纳，「外观」一律不照搬：

1. **全幅背景 + 单侧渐变压暗**：文字锁在左侧安全区，主体画面留给右侧。天然满足
   「文字不许被图形压住」这条铁律，所以共享骨架做了 `--im-veil`，且每套主题按
   自己的明暗给值（浅色主题是白色 veil，不是统一黑罩）。
2. **顶部极简**：只有几个文字标签和右上角图标，没有实心标题栏——正好避开
   「加标题栏」式仿制。沉浸骨架只压低顶栏高度，不隐藏任何导航功能。
3. **左侧纵向信息层级**：字标 → 描述 → 状态 → 次要卡片，阅读动线清楚、留白大。
4. **卡片横排是游戏切换器**：选中放大加描边，下面带名称。Owner 要求放**下方**，
   而现有 `dock > rail` 本来就在下方，结构对得上。
5. **明确不照搬**：紫粉配色 / 棕榈叶属真实游戏素材（铁律禁止），白色描边胶囊
   也不能变成 14 套共用的统一控件。

### 1.18.2 构图稿暂停

构图稿（14 套静态构图，本地留档未入库）
已产出，`_shots/immersive/immersive-contact-sheet.png` 是缩略总览。Owner 判定
**不符合各主题设计理念**，本轮起这些稿子**不进实现、不作为设计契约**；文件保留
仅供后续比对，若 Owner 要求可直接删除。CSS 里也写了同样的免责注释，避免下一轮
接手的人误把稿子当规范。

### 1.18.3 本轮实际实现（机制三块）

**A · 沉浸模式骨架**（`src/theme-slots.css` 末尾，共享层；JS 零改动）

> ⚠ **本节描述的「左文右图」版本已被 §1.19 取代**，只作为演进记录保留。
> 当前实现全幅封面 + 底部横条，请看 §1.19。

`html.is-fullscreen` 下只重排现有主页 DOM，不新建视图、不复制渲染器：

- `.stage` 收成左侧安全区（`--im-safe-x` / `--im-text-width`），`stage::before` 画单侧
  `--im-veil`；`.hero` 提到 `z-index:1`，文字永远在压暗层之上。
- `.dock` 强制变成**底部横排卡片带**，并用
  `html.is-fullscreen body.layout-rail .view-home .dock` 这条更高特异性覆盖掉
  layout-rail 模式下「左侧竖排 rail」的既有规则；`rail` 改横向滚动、卡片按
  `--im-card-width / ratio / radius / border` 成排，选中态用 `--im-card-active-*`。
- 长游戏名在沉浸模式下 `white-space:normal / overflow:visible / text-overflow:clip`，
  换行完整显示，不再被磁贴宽度裁掉（铁律 #2）。
- 顶栏压到 `clamp(50px, 6.4vh, 68px)` 并由主题给底色与分隔线；窗口模式零影响。
- **字号决定权还给主题**：第一版曾在共享层放大 `.hero-logo`，把 endfield 的
  `THINGS AS THEY ARE` 挤出固定白色铭牌、右半截落在黑底上看不见。已改成只保留
  `max-width:100%`，`--im-title-size / --im-title-max` 由此成为**预留但未消费**的插槽。

**B · 14 套主题映射**（13 份 `interfaces.css` + `src/theme-nova.css`）

每套一个 `html[data-theme="…"]` 块，值全部取自该主题现有材质语言，不引入构图稿的
新造几何：暗金双线直角、胶片扁平宽卡、铜金凹框窄卡、拱形画框比例、酸黄切角、
深褐厚框蜡封、雾紫方块、登机牌虚线长卡、黑胶硬偏移、蓝黄实色海报、炭黑大卡、
青线白纸、荧光青柠斜纹等。`--im-veil` 在 endfield / riot / riso / summer / broadcast
等纸面主题上是**浅色**，不是统一黑罩。
`tools/theme-slot-check.js` 新增 `--im-` 与 `--hs-check-` 两个守门项；内置 nova 单独
只查这两项（它历史上没有 `.engine-shell` 块，不要放宽成全量 REQUIRED_SLOTS）。

**C · 缩放控件彻查 + 「全屏缩放」文案回归**

- 根因：上一轮加的 `engineScaleRow` 借用了通用 `.pref-row`，勾选框是共享层一个
  14 套同形的 14px 方框 + 斜勾，只随 `--accent` 变色——就是 Owner 截图里那个
  「不属于本主题」的黄框。
- 修法：勾选框全部参数化为 `--hs-check-*`（尺寸 / 线型 / 圆角 / 底 / 阴影 / 标记
  位置 / 宽高 / 边宽 / 圆点 / 底色 / 旋转），14 套各给一套，形态互不相同：斜勾、
  双线细勾、白圆点、金短横、火漆圆点、酸黄黑方块、蜡封、梅红横线、荧光虚线勾、
  红方块硬偏移、蓝横、青绿勾、青块、荧光斜条。`engineScaleRow` 脱掉 `.pref-row`，
  改用该主题主页缩放行的 `--hs-bg / --hs-border / --hs-ink` 材质。
- **「全屏缩放」没被吃掉**：设置页第一项就是它且是默认值，后端 `factorMode=false`
  走 `scale` 热键 3137，实机日志 `mode=fullscreen … scaled=True` 配 2560×1600 整屏窗口。
  丢的只是字面。现在主页与引擎弹窗的 hint 直接显示当前方式：
  `全屏缩放 · 默认开启` / `倍数缩放 2.5 倍 · 仅此游戏` / `已在设置中关闭`，
  由 `app.js scaleModeLabel()` 统一生成；`.hero-scale-hint` 允许换行，不会被压断。

### 1.18.4 验收

| 检查 | 结果 |
| --- | --- |
| `dotnet build` 现代 + legacy net48 | 0 错误（既有警告） |
| `node tools/theme-slot-check.js --strict` | exit 0，14 套全部覆盖新插槽 |
| `node tools/feature-checks.js` | **47/47**（新增第 [9] 组 6 项：沉浸横排 / 带宽 / 贴底 / veil / 主题插槽注入 / 长名换行） |
| `node tools/tier-shots.js --shots=false` | 98 组 · 294 captures 全过 |
| `node tools/headless-shots.js --views=all` | exit 0，警告仍是既有 aurum 5px / dusk 2px 磁贴名裁切，**0 新增** |
| 真实沉浸截图 | 14 张在 `_shots/immersive-real/`，总览 `contact-sheet.jpg`；逐套 `overflowX=0` |
| 人工抽查 | steam / endfield / zerohour 大图：文字可读、卡片带横排贴底、勾选框是各主题形态；endfield 标题修正后完整落在铭牌内 |

### 1.18.5 没做 / 下一步

1. **14 套沉浸外观深化**：已由 §1.19 接手并落地（全幅封面 + 底部横条，14 套网格
   与材质各异）。后续若要更强的主题差异，在 §1.19.6 第 2 条里继续。
2. `--im-title-size / --im-title-max` 是预留插槽，当前不消费（见 1.18.3 A 的教训）。
3. 本轮改动**全部在工作区未提交**；版本号仍是 1.16.5，没有 bump、没有提交 / PR / 发行（见 §1.19.6）。
4. 沿用：Owner 提权旧实例退出后删 `03-归档备份\old-build-1.16.4\` 里两个 `.old` 文件；
   §7 的 1.16.3 颜色回访与平台真机。

---

## 1.19 第五轮：沉浸模式重构——封面就是页面（工作区待提交）

> Owner 原话：「沉浸式模式，是主游戏封面，然后图标是次要的，所以游戏封面必须要占
> 很大一部分，不能让 UI 喧宾夺主。」随后又补了 PS 商店的拆解作为参考，并明确
> 「底部横条不要作废，这是为了做成区别」，最后定为「不要左文右图，全部采取全幅
> 加底部横条」。
> 因此 §1.18 的「左侧信息栏 + 右侧封面」方案**作废**，本轮改成单一构图家族：
> **全幅封面 + 底部信息横条 + 图标条叠放**。

### 1.19.1 结构怎么变的（和 §1.18 的差别）

| 部位 | §1.18（已作废） | 本轮 |
| --- | --- | --- |
| 封面 | 右侧 58% 面板，文字在左 | `stage::after` 铺满整个舞台，含底部预留区 |
| 压暗 | 90° 单侧渐变（横向） | 180° 底部渐变，只压暗下缘信息带 |
| 信息 | 左侧一列 7 块，纵向堆叠 | 底部一条横条，3 行 × 3 列网格（每套顺序不同） |
| 图标条 | 参与 flex 布局，占一条版面 | `position:absolute` 叠在封面上，舞台用 `padding-bottom` 预留同一高度 |
| 文字色 | 由横条自带底色决定 | 新增 `--im-dock-ink`，图标条的文字与底衬按主题明暗给 |

关键一点：图标条改成叠放后，`.view-home` 不再被它撑高，必须自己声明
`flex:1 1 auto; height:100%`，否则舞台会塌成内容高度（本轮踩过，已修）。

### 1.19.2 共享层新增/改动的规则（`src/theme-slots.css`）

- `.stage`：`align-items:flex-end`、`padding:0`、`padding-bottom: var(--im-dock-h,128px)`
- `.stage::after`：封面层，`inset:0`，`--nova-hero` 兜底 `assets/backdrop.jpg`
- `.stage::before`：底部 veil，默认 180° 三段渐变（浅色主题换成白色系）
- `.hero-inner`：主题各自给 `grid-template-areas`，共享层只保证「横条是配角」：
  - 标题字号封顶 `clamp(19px, 1.95vw, 29px) !important`（主题原本会给到 44–48px，
    那是纵向大标题的尺寸，横条里会把带子撑到 240px 高）
  - `.cta-row .btn` 统一 26px 高 / 11px 字，避免 3 个按钮竖排撑高
  - `.progress-block` 收紧为 3–4 行小字，进度条 3px
  - `.hero-logo` 上下 padding 归零（保留主题的分隔线）
  - `.hero-scale` 文字强制 `color:inherit`——夜航那类纸面主题原本是白字，落在浅色横条上直接看不见
- `.dock`：`position:absolute; bottom:0; z-index:60; height:var(--im-dock-h)`，
  背景/边框/阴影全部清空（原来主题给的是"木架/货架"底板），
  文字用 `--im-dock-ink` + `--im-dock-ink-shadow`
- `.tile-art`：`max-height:56px !important`，图标是切换器不是第二主角
- `.tile-label`：`background: var(--im-card-label-bg)`，因为文字直接压在封面图上

### 1.19.3 14 套主题各给的值（`theme.css` 末尾，一次性生成后入库）

每套一条 `html[data-theme="…"].is-fullscreen` 块，含 `--im-veil / --im-dock-ink /
--im-dock-ink-shadow / --im-dock-h / --im-card-label-bg` 与横条的网格、材质：

- 网格顺序 14 套互不相同（标题在第一行/第二行、进度在左/右、CTA 在中间/末尾），
  例如 aurum 与 broadcast 是标题打头，nova 与 steam 是标签打头，grimoire 与 riso 是
  三列等宽、zerohour 是单列堆叠。
- `--im-veil` 按主题明暗分两种：暗底主题用黑色系底部渐变，纸面主题（nightflight /
  dusk / mnemo / riot / broadcast / endfield / grimoire / riso / summer）用白色系。
- `--im-dock-h` 不是拍脑袋：先量每套图标条的自然高度再写死（119–173px），
  否则图标条会与横条重叠或把封面顶掉一块。
- 横条材质沿用各主题现有语言：暗金双线、胶片宽条、切角酸黄、火漆厚框、雾紫方块、
  登机牌撕齿、黑胶硬偏移、蓝黄海报、青线白纸、荧光斜纹等。

### 1.19.4 验收（量出来的，不是"看起来差不多"）

| 检查 | 结果 |
| --- | --- |
| 封面净空高度 | **446–536px**（900px 视口，占舞台 52%–63%；封面本身全幅铺满，横条与图标条浮在其上） |
| 横条高度 | 132–221px，最矮 aurum 132 / 最高 grimoire 221 |
| 横条内容溢出 | 14 套全部 `overflow=0`（内容一行都没跑出边框） |
| 图标条 | 14 套全部完整可见、与横条间距 11–16px、文字有底衬可读 |
| `dotnet build` 现代 + legacy net48 | 0 错误 |
| `theme-slot-check --strict` | exit 0 |
| `feature-checks.js` | **47/47**（第 [9] 组改写为 9 项：横排 / 满宽 / 贴底 / **封面层铺满舞台** / **veil 只压底部** / 主题插槽 / **图标条叠放** / **封面占比 >55%** / 长名换行） |
| `tier-shots.js --shots=false` | 98 组 · 294 captures 全过 |
| `headless-shots.js --views=all` | exit 0，52 条警告仍是既有 aurum 5px / dusk 2px 磁贴名裁切（两个尺寸各 26 条），**0 新增** |
| 人工看图 | `_shots/immersive-layout/` 14 张单图 + `compare-1/2.jpg`（普通 vs 沉浸并排）+ `immersive-sheet.jpg` 总览，逐套抽查 nova / aurum / dusk / nightflight / endfield |

### 1.19.5 过程中踩到并修掉的问题（留给下一轮避坑）

1. **图标条被封面盖住**：`dock` 原本 `z-index:3`，低于舞台封面层，DOM 在、截图全黑。
   现在 `z-index:60`，并且用 `elementFromPoint` 验证过命中的是 `.tile-badge`。
2. **图标条消失导致舞台塌陷**：绝对定位后 `.view-home` 失去高度，必须显式
   `height:100%`，否则 stage 只有 286px。
3. **横条吃封面**：主题的纵向大标题 + 3 个竖排按钮把横条顶到 344–374px。
   共享层封顶字号、压扁按钮与进度块后降到 136–228px。
4. **浅色横条上白字消失**：`.hero-scale` 在夜航/黄昏这类纸面主题下整块看不见，
   已改为 `color:inherit`。
5. **纸面主题横条雾化**：早期白色 veil 压到 0.8，整片发白像雾；降到 0.58 并上移起点。
6. **steam 的横条跑到屏幕顶部**：它的 `.hero` 在窗口模式是 `height:100%`（为了纵向居中），
   横条被顶到最上面。共享层已强制 `.hero { height:auto !important }` +
   `.stage { justify-content:flex-end !important }`，现在 14 套都贴底。
7. **横条被挤扁导致最后一行压到边框上**：`hero-inner` 作为 flex 子项会被压缩，
   内容比可用高度多 20px 时最后一行落到边框外。已加 `flex:0 0 auto; height:auto !important`。
8. **横条内出现"别的页面"色块**：若干主题给 `.progress-block / .meta-row / .cta-row`
   自带底色（纸卡、暗井），叠在横条上像贴了补丁。现在这三块统一 `background:none`，
   只保留 kicker 与缩放行的标签底色。riso 的 `cta-row::after` 斜纹装饰原本悬在框外
   120px，也已隐藏。
9. **进度百分比是 26px 展示字**：grimoire 这类主题把 % 数字当大标题，单这一个字符
   就把横条顶高 40px；横条内封顶 12px，字体与颜色仍归主题。

### 1.19.6 没做 / 下一步

1. **图标条目前是"小图标 + 名称"**，没有 PS 商店那种"选中放大 + 外发光"的联动效果；
   要不要加，等 Owner 看现在的形态再定。
2. 横条内部的**装饰细节**（登机牌条码、书脊、蜡封边）仍复用各主题原有元素，
   没有为沉浸模式新画图案；若要更强的主题差异，下一步在各自 `theme.css` 里加。
3. 版本仍是 1.16.5，本轮改动**未提交、未 bump、未发行**。
4. 沿用：Owner 提权旧实例退出后删 `03-归档备份\old-build-1.16.4\` 里两个 `.old` 文件；
   §7 的 1.16.3 颜色回访与平台真机。

---

## 1.20 第六轮：沉浸模式重新设计（面试级重做，工作区待提交）

> Owner 反馈：「当前界面仍然不好看，边框过长，且没有考虑手柄玩家的交互体验。」
> 要求以资深前端 UI 设计师视角整体重做。完整方案见 `docs/IMMERSIVE-DESIGN.md`，
> 本节只记实现与验收。

### 1.20.1 诊断

1. 1280px 通栏横板：眼睛要横扫 1200px 才读完 7 个信息块，读起来像工具栏而不是主机界面。
2. 进度块、缩放开关各自带底色，叠在同一块板上像补丁。
3. 按钮 26px 高、图标 56px，低于 44px 命中下限，摇杆选起来费劲。
4. 手柄只有快捷键（A 启动 / Y 详情），**不能把焦点走到按钮上再按 A**；方向键在主页只会换游戏。
5. 键盘 Tab 的焦点环在深色封面上几乎看不见。

### 1.20.2 新结构：两个簇 + 一条带（最长边框 1280px → 320px）

- **左簇 identity**：kicker（带 26×3 accent 短横）→ 标题 → 简介 → 标签 → 主按钮。
  无底色无边框，直接压在底部压暗层上。
- **右簇 status**：`<div class="status-card">` 包住 `progress-block` 与 `hero-scale`，
  合成**全屏唯一一张卡片**（240–320px，中间一条发丝线）。窗口模式下
  `.status-card { display: contents }`，布局与原来完全一致。
- **底部图标带**：图标 64–72px、名称一行、整块可点；选中只给图标短底边。
- 压暗统一改成 180° 深色渐变（8% 起、62% 到 0.6、底部 0.92）；纸面主题不再用白色 veil，
  改为**浅色文字 + 深色压暗**，主题身份留在卡片材质上（羊皮纸 / 暗金双线 / 登机牌 / 硬偏移）。

### 1.20.3 交互：两条聚焦行，键盘与手柄共用

| 操作 | 行为 |
| --- | --- |
| ↑ / ↓ | 在 `actions`（继续游戏 → 详情 → 缩放设置 → 开启缩放）与 `strip`（游戏图标）之间切换 |
| ← / → | 在 actions 内移动并回绕；在 strip 内保持"换游戏" |
| Enter / A | 激活当前焦点（`immersiveActivate()` 直接 click，不依赖 pad 的列表） |
| Esc / B | 退出沉浸模式（原有行为不变） |

实现：`app.js` 新增 `immersiveHome() / immersiveActionEls() / immersiveStep() /
immersiveRing() / immersiveActivate()`；键盘在全局 switch 之前拦方向键；`padApp.nav /
navVertical / confirm` 先走同一套函数。焦点环用 `.is-pad-focus`，键盘与手柄都画，
`data-input="pointer"` 时隐藏；环是**双色**（accent 描边 + 3px 深色领圈 + 12px 光晕），
在明亮封面上也能看清。

### 1.20.4 尺寸与对比（实测）

| 项 | 值 |
| --- | --- |
| 信息簇宽 | 1180px（`min(1180px, 92vw)`），内容列 560px |
| 状态卡 | 320×104–150px（唯一带边框的元素） |
| 主按钮 | 48–56 × 168px（最低 48×168） |
| 次按钮 | 44px 高 / ≥96px 宽 |
| 缩放开关 | 44px 高，整卡宽 |
| 图标 | 72×77–100px（夜航是 186×54 的横条） |
| 内容溢出 | 14 套全部 `overflow=0` |

### 1.20.5 踩坑（重要，下一轮别踩）

1. **通栏横板改成两簇后必须改 DOM**：`progress-block` + `hero-scale` 需要同一个包裹层才能
   共用一张卡；否则两半永远隔着网格行距。包裹层在窗口模式用 `display:contents` 归零。
2. **`grid-row: 1 / -1` 在隐式网格里无效**（`-1` 指第 1 条线），会变成 `1/1` 空区；
   改成 `1 / span 6`。
3. **codex 把 `.hero` 用 auto margin 居中**，卡片会被推到视口外（x=1619）；
   沉浸层必须 `width/max-width/margin/padding` 全 `!important`。
4. **codex 用 `:not(.is-long-title)` + `!important` 把短标题放大到 40–72px**，
   共享层的字号封顶要多带一个 `[data-theme]` 属性才压得住。
5. **纸面主题的白色 veil 会把封面洗成雾**（0.58–0.9 时整片发白），已统一改深色压暗。
6. **截图脚本直接加 `.is-fullscreen` 类不等于进入沉浸模式**：`state.fullscreen` 仍为 false，
   方向键会走全局换游戏分支；测试与截图都必须用 `F` 真实切换。

### 1.20.6 验收

| 检查 | 结果 |
| --- | --- |
| `dotnet build` 现代 + legacy net48 | 0 错误 0 警告 |
| `theme-slot-check --strict` | exit 0 |
| `feature-checks.js` | **55/55**，新增第 [10] 组 8 项：F 进沉浸 / 首个方向键落在主按钮 / 行动作行回绕 / ↓ 进入图标带 / ↑ 回到操作行 / 命中尺寸 ≥44 / 焦点环已绘制 |
| `tier-shots.js --shots=false` | 98 组全过 |
| `headless-shots.js --views=all` | exit 0，26 条警告仍是既有 aurum 5px / dusk 2px 磁贴名裁切，**0 新增** |
| 截图 | `_shots/immersive-v2/`：14 套 + `sheet.jpg` 总览 + `nova-focus.jpg` / `dusk-focus.jpg` 焦点特写 |

### 1.20.7 没做 / 下一步

1. 图标带的"选中放大 + 外发光"联动还没做（当前只有短底边 + accent 描边）。
2. 左簇在极长游戏名（>30 字）时的两行标题未逐一压测，`headless-shots` 的 stress 视图只覆盖窗口模式。
3. 版本仍 1.16.5，本轮改动**未提交、未 bump、未发行**。

---

## 1.21 第七轮：控件材质与墨色配对（Owner 反馈"按钮颜色盖过文字"）

Owner 原话：**「就是按钮和字体不符合主题的设计风格，同时也违反按钮颜色盖过文字导致文字不清晰的铁律」**。
这不是审美问题，是共享层把主题的配色拆散了。

### 1.21.1 根因

`src/theme-slots.css` 沉浸段里有一条：

```css
html.is-fullscreen .view-home .hero-inner > .cta-row .btn.ghost {
  color: var(--im-dock-ink, #f4f2ec) !important;
}
```

它只改**文字色**，不动**底色**。纸面主题（grimoire / riot / riso / summer / mnemo）的次按钮是
`background: 羊皮纸/白纸/荧光黄` + `color: 深墨`，被这条一改就成了白底白字：

| 主题 | 次按钮实测对比（修复前） |
| --- | --- |
| grimoire | **1.01:1** |
| riot | 1.10:1 |
| riso | 1.11:1 |
| summer | 1.16:1 |
| mnemo | 1.13:1 |
| broadcast / endfield / nightflight | 删除该条后回落成透明底深墨 → 1.05–1.12:1 |

主按钮另有一批：nova 3.02 / steam 3.22 / dusk 4.27 / aurum 2.24，原因是 app.js 用
`luma > .62` 猜深浅字，阈值偏保守，浅粉、浅金底上仍然给白字。

### 1.21.2 改法

1. **共享层不再单方面改字色**。`.btn.ghost` 只加深度（`--im-btn-shadow`）与圆角，颜色全交主题；
   `.btn.primary` / `.btn.ghost` 的字体、字距、字重、圆角、尺寸全部走 `--im-cta-*` / `--im-btn-*`。
2. **每套主题在 `interfaces.css` 末尾写一段「IMMERSIVE CONTROLS」**，把底与字成对声明：
   - 纸面主题保留纸牌（grimoire 羊皮纸 + 深墨、riot 白块 + 黑字 + 红硬偏移、riso 酸黄 + 深蓝、
     summer 荧光黄 + 深蓝、endfield 白纸 + 墨 + 4px 硬投影）；
   - 深色主题保留发光/金属（aurum 羊皮纸 + 近黑、codex 铜金渐变 + 深墨、nightflight 荧光黄 + 深蓝、
     zerohour 青柠 + 黑、steam 深绿 + 近白、mnemo 深紫 + 雾白）。
3. **字体跟主题走**：宋体主题（aurum / codex / grimoire / dusk / broadcast / riso）的按钮与眉标用
   `--font-display`；黑体主题用黑体。字距 .05–.18em 按主题。**小字（meta、卡片副行、图标带名）一律
   UI 字体**——10px 宋体在米白纸上渲染成灰糊，不是墨。
4. **墨色分三层令牌**：`--im-ink`（封面主文字）/ `--im-ink-dim`（次级）/ `--im-kicker-ink`、
   `--im-kicker-dim`（眉标自带浅底时用）/ `--im-card-ink`、`--im-card-muted`（右卡自成一套）。
   所有"用 opacity 做次级"的地方改成颜色，opacity 会与主题自己的 alpha 相乘。
5. **veil 双层**：主题 `--im-veil` 在上，共享底线渐变在下（`.74` 收尾）。原来单层时浅色主题
   底部只有 .5–.6，1px 浅字达不到 4.5:1；现在任何封面都有可读地板。
6. **修掉三处结构性 bug**：
   - `.hero` 在沉浸模式仍有主题的实色背景 → 一条硬边横带把封面切成两半（grimoire 最明显）；
   - dusk 的 `html[data-theme="dusk"] .stage::after { display:none }` 把封面本身关掉了，
     沉浸模式只剩渐变底；
   - 各主题遗留的 `order:` 把标题排到眉标前面（nightflight 标题在上、眉标在下），
     共享层统一 `kicker → 标题 → tagline → 事实行 → 行动行`。
7. **焦点环改双色**：`outline: 3px #fff` + `outline-offset: 3px` + `box-shadow: 0 0 0 3px rgba(0,0,0,.88)`。
   单色 accent 环在 accent 主按钮上等于没有（nova 粉环压粉按钮），单色白环在纸按钮上等于没有。

### 1.21.3 新增验收工具 `tools/immersive-audit.js`

不靠眼睛，也不靠 computed color（渐变色/半透明/图片底都算不准）。做法是**双帧差分**：
对每个控件拍两张图，第二张把文字色与 `-webkit-text-fill-color` 打透明、`text-shadow: none`，
两帧差异区就是笔画；底色取未变像素众数，墨色取差异像素里对比更强那一侧的笔画核心中位色，
再算 WCAG。命令：

```bash
node tools/immersive-audit.js                                  # 只出报告，失败退出码 1
node tools/immersive-audit.js --shots --focus --out=../_shots/x # 顺带出 14 套截图 + 焦点图
node tools/immersive-audit.js --themes=nova,summer             # 子集
```

覆盖 14 个控件 × 14 套主题 = **196 个读数**：主按钮、两个次按钮、缩放勾选行及其 hint、眉标、
标题、副标题、元信息、卡片表头/时长/副行、图标带名、图标带标题。

### 1.21.4 结果

| 检查 | 结果 |
| --- | --- |
| `immersive-audit.js` | **196/196** 全部 ≥4.5:1（标题等大字 ≥3.0），14 套一次过 |
| `theme-slot-check --strict` | exit 0（14 套 rules 17–47 条不等） |
| `feature-checks.js` | **55/55** 全过（第 [9][10] 组沉浸断言未回退） |
| `headless-shots.js` 窗口模式 | nova / grimoire / summer 首页 0 裁切 0 溢出，布局未变 |
| 截图 | `_shots/immersive-v3/`：14 套 + `sheet.jpg` + `*-focus.jpg`；`pass1..pass11.json` 留了逐轮读数 |

测量口径注意：像素法对 9–10px 小字会低估（抗锯齿边缘占多数），卡片副行因此把字号抬到 11px、
字重 500，而不是继续调颜色。

### 1.21.5 没做

1. ~~各主题的 `--im-card-bg` 多数还是共享兜底~~ → 第八轮补上了 aurum / codex / steam / zerohour
   的卡面材质（§1.22.4）。
2. 标题字号上限仍统一 34px（`clamp(24px,2.5vw,34px)`），主题的字标个性被压平；
   放开到 `--im-title-max` 需要先补长名压测，本轮未做。
3. 仍未提交、未 bump、未发行。

---

## 1.22 第八轮：隐藏游戏的两处语义修正 + 全页文字审计

Owner 报了两个问题，都成立，而且都属于"我上一轮只测了自己盯的那一页"：

1. 详情页「隐藏此游戏」右边的说明文字看不见；
2. 隐藏之后，游戏还在首页的封面和图标带里。

### 1.22.1 隐藏行说明文字：8 个主题低到 1.0:1

`src/type.css` 的 `.manage-body > .pref-row .pref-hint` 用 `var(--text-faint)`
（`rgba(244,240,231,.58)`，为深色底调的浅米白）。八个纸面主题把管理面板画成羊皮纸/白纸，
浅字压浅底：

| 主题 | 修复前 | 现在 |
| --- | --- | --- |
| broadcast | 1.10:1 | 6.7:1 |
| riot | 1.02:1 | 6.6:1 |
| riso | 1.04:1 | 7.2:1 |
| grimoire | 1.14:1 | 6.6:1 |
| summer | 1.08:1 | 6.4:1 |
| dusk / endfield / mnemo | 1.05–1.08:1 | 6.2–7.0:1 |

改法：`--faint` → `--muted`（每个主题都定义了这一层，纸面主题给深墨），字号 10 → 11px、
字重 500。`src/app.css` 里详情页同族的 `.detail-launch-options .pref-hint` 一并改掉——
它讲的是"开着缩放会怎样"，同样不能是装饰。

### 1.22.2 隐藏之后还留在首页：索引体系的问题

`buildRail()` 直接 `state.games.map(...)`，隐藏标记只影响游戏库网格。于是封面、图标带、
「6 款」计数全都继续展示刚被隐藏的游戏（Owner 的红框截图）。

`state.games` 不能删（库里要能筛出隐藏项，详情页、索引、计时都要它），所以改成
**"货架"概念**：

- `shelfCount()` / `resolveShelfIndex(from, dir)`：只在未隐藏的游戏之间走位；
- `buildRail()` 跳过隐藏项，但 `data-index` 仍是 `state.games` 的下标；
- `updateRail()` / `centerTile()` / `ensureActiveTileVisible()` 改成按 `data-index` 找 tile，
  不再用 `children[i]`（跳过后位置与下标不再相等）；
- 启动时若上次停在隐藏游戏上，自动落到最近的可见项；
- 隐藏当前游戏后立即 `rebuildAfterLibraryChange(false)`，并且**即使在详情页开着也重绘 hero**
  （原来 `if (!state.overlay)` 把这一步跳过了，关掉详情页就会看到刚隐藏的游戏）；
- 全部隐藏 = 空货架，走 `is-empty` 与 `railEmpty`，不显示半个封面。

新增 `tools/verify-hidden.js`（7 项断言：tile 少一个 / 名字不在带里 / 计数跟随 / hero 换人 /
全部隐藏时货架为空 + 空态提示），并把这套断言并入 `feature-checks` 第 [11] 组。

### 1.22.3 新增 `tools/text-audit.js`：一次扫完所有页面的所有小字

上一轮的 `immersive-audit.js` 只覆盖沉浸首页，所以详情页里的说明文字两轮都没被发现。
新工具遍历"拥有文本节点的可见元素"，逐个做同样的双帧差分，输出选择器路径：

```bash
node tools/text-audit.js                                     # 4 个视图 × 14 主题
node tools/text-audit.js --views=detail --min=4.5
node tools/text-audit.js --selectors="#manageHiddenHint"      # 定位单个问题时用
node tools/text-audit.js --shots --out=../_shots/text-audit   # 顺带整页截图
```

判定：正文 ≥ 4.5:1，大字（≥18.66px，或 ≥14px 且 700）≥ 3.0:1；测不出来的单独计数，不算通过。

**这个工具自己踩了四个坑，都写进注释了**：

1. 被弹层压住的元素整体变暗，对比塌到 1:1 → 用 `elementFromPoint` 命中测试排除；
2. `scrollIntoView` 要等两帧才生效，否则读到滚动前的坐标；
3. `Page.captureScreenshot` 的 `clip` 是**页面坐标**，滚动页必须加 `scrollX/scrollY`；
4. "把文字变透明"的样式原来只写在 `html.is-fullscreen .view-home` 作用域下，详情页完全不生效，
   diff 恒为空 → 回退到亮度分位法，把按钮边缘当成了文字，读出一堆 1.7–3.8 的假失败。
   加上不限作用域的一份后才测准。

同时把像素测量抽成 `tools/lib/legibility.js`，两个审计脚本共用一份实现。

### 1.22.4 顺带补上的卡面材质

aurum（墨绿金属 + 铜线）、codex（旧皮革 + 金线）、steam（控制台炭黑）、zerohour（命令台黑 + 青柠描边）
各给了 `--im-card-bg / --im-card-border / --im-card-radius`，原来它们用的是共享兜底的半透明黑。

### 1.22.5 试过但回退的方案（重要，别重复）

窗口模式的小字（图标带时长、底部按键提示、"6 款"计数、详情页统计标签）也存在同类问题，
`text-audit` 在 `home` + `detail` 两个视图里扫出 **118 处**低于 4.5:1。

我先试了"在共享层统一改用 `--muted`"，结果**一半主题变好、一半变坏**：

| 主题 | 统一前 | 统一后 |
| --- | --- | --- |
| grimoire | 15 处失败 | 21 处（游戏名从 1.93 → 1.35） |
| dusk | ? | 21 处 |

原因：这幅画里"标签的底"不是同一个东西。grimoire 的 `.tile-label` 是蜡红条，`--muted`（深褐）
压上去 1.35:1；dusk 的标签在夜空上，`--muted` 也是褐；而 summer 的标签是白纸，`--muted`
（深蓝）就正好。**一个全局令牌无法同时服务三种底。**

试过的第二个方案（逐主题配 `#f6e7c4` / `#17345a` 这类硬编码）能让 grimoire 21 → 10、
summer 14 → 9，但 active 卡片的标签底又和普通卡片不同（riot 红块 / riso 蓝块），
28 种组合逐一验证的收益不抵风险，已回退。

正确做法（留给下一轮）：**给每套主题的 `.tile-label` 明确声明"标签底 + 标签墨"一对**，
和沉浸模式的 `--im-card-bg/-ink` 同一套做法；工具已经能直接测出每种的读数
（`node tools/text-audit.js --views=home --themes=grimoire`）。

### 1.22.6 验收

| 检查 | 结果 |
| --- | --- |
| `tools/immersive-audit.js` | **196/196**（改了共享测量库后回归，无回退） |
| `tools/text-audit.js --views=detail --selectors=#manageHiddenHint,#detailScaleHint,#manageDoneBtn` | **0 失败 / 14 主题** |
| `tools/verify-hidden.js` | 7/7（含隐藏前后截图 `_shots/hidden-shelf/`） |
| `feature-checks.js` | **60/60**（第 [11] 组 5 项新增，第 [5] 组按新语义重写） |
| `theme-slot-check --strict` | exit 0（新增 4 套卡面令牌后仍通过） |
| 窗口模式 | nova / grimoire / summer 首页 0 裁切 0 溢出 |

实测隐藏流程（`_shots/hidden-shelf/before-hide.jpg` → `after-hide.jpg`）：
6 款 → 5 款，图标带里"沉睡的法则"消失，封面从 THINGS AS THEY ARE 切到 LULLABY FOR YOU，
右下角出现"已隐藏 · 游戏库右上角「隐藏」可查看"。

### 1.22.7 没做

1. **窗口模式的次要文字（118 处）**：见 §1.22.5，需要在每个主题里成对声明标签底与标签墨。
   这是下一轮的第一项，工具与清单都已就绪。
2. 标题字号上限仍统一 34px（需要长名压测后才能放开 `--im-title-max`）。

---

## 1.23 第九至十一轮：沉浸模式＝沉稳模式、图标带自适应（已合并 PR #37）

> 合并：`fcbcfe1`（squash），PR [#37](https://github.com/118coder/guguova-game-space/pull/37)，
> 42 文件 +5094/−81。**版本仍 1.16.5，未发版**。

### 1.23.1 语义修正：全屏不等于沉浸

§1.18–§1.22 四轮实现全部挂在 `html.is-fullscreen` 上，后果是**按 F 就把玩家每天看的
页面换成了另一套版式**，而真正想「沉浸」的人去打开沉稳模式却只减少了动画。
Owner 的原话：「由用户决定是单纯的放大全屏，还是启动沉稳模式，你把原本的无边框全屏主题吃掉了。」

| 操作 | 现在的结果 |
| --- | --- |
| 按 `F` / 菜单「全屏显示」 | 只放大窗口，版式不变（原来的无边框全屏页） |
| 打开「沉稳模式」 | 沉浸版式：全幅封面 + 左簇 + 右簇状态卡 + 底部游戏带 |
| 两者叠加 | 无边框 + 沉浸版式 |

- **288 处** `is-fullscreen` → `calm`：`src/theme-slots.css`(110)、`src/theme-nova.css`(10)、
  13 套 `theme.css`(6–9)、13 套 `interfaces.css`(5–11)。
- `src/dialogs.css`(9)、`src/views.css`(1) 的原生全屏规则**不动**。
- 焦点导航 `immersiveHome()` 判据从 `state.fullscreen` 换成 `state.settings.calm`。
- 菜单文案曾经被改成「沉浸模式」又改回「全屏显示」：那是窗口模式的菜单，不该跟着改名。

### 1.23.2 图标带压住按钮：不再猜高度

**根因**：`.dock` 绝对定位浮在封面上，舞台**从没为它预留空间**，高度写死 `var(--im-dock-h,128px)`，
而 `.hero-inner` 的底部外边距只有 12–22px。128px 对演示库（6 款、短名字）恰好够高，
Owner 的真实库（45+ 款、DNF 长标题、两行描述）图标带实际 150px 以上，多出来的正好盖住行动行。

**改法（自适应，不猜数字）**：

```
.dock 高度 auto（内容决定）
  → app.js syncDockHeight() 用 ResizeObserver 实测盒子
  → 写回 --im-dock-h
  → .stage 的 padding-bottom = --im-dock-h + clamp(4px,.8vh,12px)
```

- `setCalm()` 里同步调一次：切模式那一帧就要生效，不能等 resize。
- **图标带自己不读 `--im-dock-h`**，否则「测量 → 写回 → 改变高度 → 再测量」会循环。
- 换主题、改窗口大小、名字一行变三行、卡片 6 张变 45 张，都在同一帧内重新分配。

### 1.23.3 新增 `tools/layout-fit.js`

把「有没有被压住」变成可执行的断言。它先把标题换成 `DNF-SEASON1-ACT0.3`、描述换成两行长句
（即 Owner 截图里的形状），再量 `.cta-row` / `.status-card` / `.hero-logo` / `.dock` 的交叠面积。

```bash
node tools/layout-fit.js                       # 六档分辨率 × nova
node tools/layout-fit.js --themes=grimoire,broadcast,steam --shots
node tools/layout-fit.js --size=1920x1080
```

六档：1920×1080 / 1600×900 / 1440×900 / 1366×768 / 1280×720 / 1080×600。有重叠退出码 1。
实测 **24/24**，行动行与图标带间隙 12–18px。

顺带确认：矮窗口（高度 ≤ 630px）描述消失是 `base.css` 原生媒体查询，不是缺陷。

### 1.23.4 主题副本刷新：不能只看 theme.json

`ThemeService.IsBundledNewer` 原本只比较 `theme.json` 的 version 和 mtime。可 `theme.css` /
`interfaces.css` 才是承载全部视觉决策的文件，改它们而版本号不变时，程序永远读首次复制的那一份 ——
现象和「我改了没生效」完全一样。这也解释了为什么前几轮主题级改动在实机上像没发生。

改为比较**两个目录内最新的文件时间**。`File.Copy` 保留源时间戳，所以没动过的主题仍然相等；
用户自己改过的主题文件比包内新，不会被覆盖。版本号不同的分支保持原样（只比版本）。

**这条修完之后踩到的坑**：我曾为了「让改动生效」临时加了跨版本覆盖，结果把 Owner 装着的
SUMMER `1.8.15` 覆盖成仓库的 `1.0.18`。已从 `backups/themes-before-reseed-20261110-2020/` 还原，
并把版本分支改回去。**动用户主题目录前必须先备份**（两个备份都在 `../backups/`）。

### 1.23.5 验收

| 检查 | 结果 |
| --- | --- |
| `tools/layout-fit.js`（六档 × 4 主题，长标题） | **24/24**，间隙 12–18px |
| `tools/immersive-audit.js` | 196/196 |
| `tools/verify-hidden.js` | 7/7 |
| `feature-checks.js` | 60/60 |
| `theme-slot-check --strict` | exit 0 |
| 全屏（不沉稳） | 回到原来的无边框全屏页：大标题 + 正常卡片带 + STEAM 徽标 + 按键提示 |
| 窗口模式 | 像素级对比差异 0.11%（JPEG 压缩噪声） |

### 1.23.6 没做 / 下一步

1. **窗口模式 118 处次要文字**（承接 §1.22.5）：需要逐主题成对声明「标签底 + 标签墨」。
2. 图标带在沉稳模式下的**观感**：封面被压成 72×45 的缩略图、名字换两行，Owner 多次提到
   「框太丑」。已去掉休息态描边与平台徽标，但卡片形状与名字排布还没定稿。
3. 标题字号上限仍统一 34px（需长名压测后放开 `--im-title-max`）。
4. **14 套主题的 `theme.json` version 未 bump**，发版时统一处理。
5. 本轮不发行：版本仍 1.16.5，无 Release。

---

## 1.24 第十二轮（2026-11-11）：分享卡片 × 14 套主题版式 + 沉稳模式身份板

> Owner 需求：「相机（截图）键位 → 三种规格/设计风格的卡片，含封面、时长、类型等
> 可炫耀信息；不能和游戏库截取冲突；每个主题都要有自己的卡片设计」。
> 第二轮反馈：「全部卡片都是同一种样式，我不满意」→ 本轮把卡片从「同一骨架换配色」
> 改成 **每套主题自己的版式语言**。
> 工作区未提交、未 bump、未发行。

### 1.24.1 相机键改成「导出卡片」

- `#shotBtn` 不再直接整页长图，而是打开 `#shareOverlay`（挂 `.engine-shell`，
  自动继承 14 套主题的 `--sheet-*`）。
- 三种规格（固定尺寸，导出像素 = 设计尺寸 × 屏幕缩放）：

| 版式 | 尺寸 | 构图 |
| --- | --- | --- |
| 封面海报 `poster` | 1600×900 | 全幅/分栏封面 + 巨型时长 |
| 档案卡 `dossier` | 1200×1500 | 画框封面 + 资料页（4:5） |
| 战绩卡 `score` | 1600×840 | 封面 + 里程碑与数据 |

- 卡片内容：封面、标题/中文名、类型、分级、模式、平台、累计时长、
  21 格里程碑阶梯、启动次数、上次游玩、收藏、收录月份、库内编号、玩家名与日期。
- 「整页长图」保留在弹窗里（ghost 按钮），先关弹窗再走原来的 `exportScreenshot()`，
  与游戏库截取不冲突。
- 导出走宿主 `capturePage` 的新参数 **`exact: true`**：卡片比窗口窄时不再被
  `Math.Max(widthHint, viewW)` 撑到窗口宽（`NativeBridge.CapturePageAsync`）。
  导出期间 `html[data-share-export]` 下 `.app` / 所有 overlay **`display:none`**，
  文档塌成卡片本身，裁剪框 (0,0→w×h) 就是卡片。
- 真机实测：poster 2000×1125 / dossier 1500×1875 / score 2000×1050（125% 屏），
  导出后 `data-share-export` 与 export stage 都会清空，不残留。

### 1.24.2 每套主题自己的卡片版式（本轮重点）

共享层 `src/share-cards.css` 只提供 DOM、三种画布与通用排版；**构图在主题里**：

| 主题 | 卡片语言 |
| --- | --- |
| nova | 电影海报：全幅封面 + 右下玻璃时长牌 |
| endfield | 技术规格纸：左纸栏 + 右封面窗 + 酸黄接缝 + 裁角，资料在页首 |
| dusk | 炼金档案：拱形羊皮纸窗、弧形封面、火漆印 |
| nightflight | 登机牌：米色票面 + 虚线撕口 + 条码 + 分栏数据 |
| steam | 商店页：宽胶囊封面 + 右侧数据栏（含 2×2 事实格） |
| summer | 明信片：斜贴宝丽来 + 荧光胶带 + 圆形时长徽章 |
| riot | 拼贴：倾斜黑贴纸标题 + 红块数据 + 胶带 |
| riso | 双色印刷：网点、裁切标、蓝块标题、荧光块 + 错位印 |
| codex | 泥金抄本：金框画板 + 首字下沉 + 金线账目 |
| mnemo | 档案夹：页签、斜贴照片、索引卡、FILE 01 幽灵字 |
| grimoire | 角色卡：框内肖像、双金线、火漆印、幽灵编号 |
| broadcast | 播出画面：4:3 画面 + REC/时码 + 下方字幕带 |
| aurum | 铭牌：圆形奖章 + 居中铭文 + 青铜数据轨 |
| zerohour | 指挥台：左侧数据轨、青柠边、扫描线、任务读数 |

每套三种规格各有独立构图（不是同一张换色）；侧栏有 `CARD CHARACTER` 注释块，
文件：`themes/<id>/interfaces.css` 末尾（nova 在 `src/theme-nova.css`）。

新增共享钩子：

- `.sc-deco` 装饰层（胶带/条码/网点/扫描线/裁角）；
- `.share-card::before` 顶缘色带（`--sc-strip-h` / `--sc-strip`）；
- `.sc-frame::after` 内线（`--sc-frame-inner`）；
- `.share-card[data-no]` + `.sc-sheet[data-no]`：库内编号，供幽灵大字水印；
- `.sc-sheet { isolation: isolate }`，让水印在纸面之上、文字之下。

### 1.24.3 沉稳模式：身份板（回应「不符合主题」）

上一版把底板全删了，14 套在封面底部看起来一模一样。本轮：

- 新增 `.hero-inner::before` **身份板**（共享几何 + `--im-plate-*` 材质），
  左侧信息簇落在一张 600px 级的紧凑板上，右侧状态卡不变；
- 纸面板（endfield/dusk/summer/riot/riso/mnemo/grimoire/broadcast）配深墨 +
  `--im-plate-text-shadow: none`；深色板保留浅字；
- 修复三处「窗口模式材质漏进沉稳模式」：zerohour 荧光眉标变成 1200px 长条、
  summer 的深色 tagline 条、`#kickerLabel` 的深色块；
- 「12+」分级改成 `--im-chip-*`（每主题自己的芯片），「N 款」去掉窗口模式的
  灰边框芯片，改主题字体的说明文字；
- 顶栏 `--im-topbar-bg` 提高不透明度（≥.8）+ 新增 `--im-topbar-ink`：
  纸面顶栏配深字，深色顶栏配浅字；
- 图标带封面 46→58px、宽度 72→92px，卡片更像切换器而不是邮票；
- 修掉 **键盘方向键在沉稳模式下失效**：守卫仍写着 `state.fullscreen`，
  改成 `state.view === 'home'`（`immersiveStep` 自己判 calm），手柄与键盘一致。

### 1.24.4 验证

| 检查 | 结果 |
| --- | --- |
| `tools/share-shots.js`（14 主题 × 3 版式） | **42 张，全部按设计尺寸导出**（1600×900 / 1200×1500 / 1600×840） |
| 真机导出（隔离数据根） | 2000×1125 / 1500×1875 / 2000×1050（125%），状态清理干净 |
| `tools/immersive-audit.js` | **196/196** 全部 ≥4.5:1 |
| `tools/layout-fit.js`（4 主题 × 6 档，长标题） | **24/24** |
| `tools/feature-checks.js` | **全过**（[9][10] 已改成沉稳模式语义，修掉 11 项历史假红） |
| `tools/theme-slot-check.js --strict` | 0 finding |
| `dotnet build` 现代 + legacy net48 | 0 错误 |
| `tools/headless-shots.js --views=all` | 仅既有 aurum 5px / dusk 2px 磁贴名裁切，0 新增 |

### 1.24.5 已知限制 / 下一步

1. 卡片的**幽灵编号水印**只加在侧栏构图的套装（endfield/grimoire/mnemo/codex/
   steam/summer/riot/riso），其余套装没有空档不需要；
2. 长游戏名在 40% 宽列里会换行到 2–3 行（已按换行处理，不裁切）；
3. 分享卡片暂只导 PNG；复制到剪贴板 / JPG 仍按 §8 P1 的约定放在后续；
4. 14 套主题的 `theme.json` 已 bump（summer 从 1.0.18 → **1.8.16** 以追上
   Owner 机器上的 1.8.15，否则新版卡片不会下发）；
5. 版本仍 1.16.5，本轮未提交、未 bump、未发行；
6. 共用 QA 脚本 `tools/share-shots.js` / `_share-e2e.tmp.js` 留在仓库外
   使用（下轮可转正成 `tools/share-shots.js`）。

---

## 1.25 第十三轮（2026-11-11）：终末地导出卡片按 endfield-ui 技能重做

> Owner 需求：终末地主题的导出卡片「改改设计」，并加载 `endfield-ui` 技能作为设计
> 依据。本轮把 endfield 的三张卡（poster/dossier/score）按技能规则逐条对齐，
> 顺带修掉一个**只影响 endfield 的导出 Bug**。已合并（**PR #39**，squash `437f91a`）。未发版（等 Owner 批准）。
> 前后对比图：`../_shots/share-endfield-before/` vs `../_shots/share-endfield-final/`。

### 1.25.1 先修掉的导出 Bug（像素实证）

**每张导出卡的顶部都烧进了 3px 弹窗三色条。** 根因：`themes/endfield/theme.css:87`
的 `body::after` 是页面级三色条（fixed，z 300），导出态 `.app`/浮层都隐藏了但 body
本身还在，条带就画在文档 (0,0)，正压在卡片顶缘；`body::before` 的 72px 绘图网格同理。
像素证据：导出图 y=1 处品红/黄/薄荷三段**只铺到视口宽 1440**，x>1440 露出卡片自条——
弹窗条带与卡片条带叠画的铁证。修法（endfield interfaces.css）：

```css
html[data-theme="endfield"][data-share-export] body::before,
html[data-theme="endfield"][data-share-export] body::after { display: none; }
```

其他 13 套主题没有 body 级装饰，不受此 Bug 影响。

### 1.25.2 按技能逐条对齐的改法

| 技能规则 | 改前 | 改后 |
| --- | --- | --- |
| 黄色只做填充，浅色主题不当线 | 封面接缝 10px 黄线、score 封面下缘 8px 黄线、时数板左缘 8px 黄条 | 全删；黄色只出现在：品牌短划、眉标方块、阶梯当前格（=当前位置） |
| 页面开始用三色条 3px | 卡顶 6px 纯黄条 | 3px 品红/黄/薄荷三等分（与 body::after、弹窗 `--sheet-strip` 同源） |
| 字段用 `/` 不用 `·` | kicker/meta/foot 全是 `·` | 全改 `/`（机制见 1.25.3） |
| 圆角一律 0 | 眉标圆点、脚注圆点 | 方块眉标、斜杠脚注 |
| 编号标签（墨底白字右下切角） | `No.01/06` 灰字直接压封面（深封面不可读） | 墨底白字 8px 切角标签，任何封面可读 |
| 45° 斜线纹（画框影子） | 32px 图表纸网格（不在词汇表） | 素纸+细线；海报接缝处斜线纹脊、档案卡照片斜线纹影子（沿用主题既有的 `-45deg 5px/1px 11%` 参数） |
| 宽体几何英文 + 黑体中文 | 全站思源黑体，卡片未用 | **复用已打包的 Saira**（`src/assets/fonts/Saira.ttf`，intro 在用，零新增资产）：令牌 `--sc-title/label/num-font` 指向 `"Saira EF"`，标签 125%、标题 118%、数字 `tabular-nums`。CJK 自动回落黑体，`font-stretch` 对中文无效果——正是「宽体英文+粗体中文」配对 |
| 看板（白板+顶边粗墨页签+朝中心切角） | 时数板=白板+8px 黄左线+灰硬影 | 白板+1px 墨框+顶边 52×6 墨页签+朝页面中心的切角（poster 切右上、score 切左上） |
| 资料行去重 | 海报顶部资料行与底部页脚重复（启动次数/上次游玩 ×2） | 页脚只留 ★收藏 + 玩家签署；资料行进看板做规格表头 |
| 阶梯=状态语义 | is-on 用 tier 变色 | 已达成=墨实心，当前=黄块（唯一强调位），未达成=发丝框 |

### 1.25.3 两处最小共享层改动（其余主题零影响）

1. `src/app.js shareCardHTML`：kicker 与 sc-sign 的 `·` 从文本节点包成 `<em>·</em>`
   （endfield 用 CSS 把 em 内容换成 `/`；其他主题渲染不变）；
   `src/share-cards.css` 加一行 `.sc-kicker em, .sc-sign em { font-style: normal }`
   兜底防 em 默认斜体。nova 卡片渲染对照确认零变化。
2. 分隔符替换机制（endfield interfaces.css）：`em { font-size: 0 }` + `em::before
   { content: "/" }`——不改 DOM 文本、不动其他主题。sc-sign 是行内文本，斜杠另加
   `margin: 0 6px`。

**字体踩坑记录**：先在 `.share-card` 上设 `font-family` 继承——被 `.sc-title` 等
部件自己的 `font-family: var(--sc-title-font)` 声明盖掉（实测 computed 仍是思源）。
**必须覆写令牌本身**（`--sc-title-font/--sc-label-font/--sc-num-font` 指向 Saira）。

### 1.25.4 三种规格的新构图

| 规格 | 构图 |
| --- | --- |
| poster 1600×900 | 技术规格纸：左纸栏（品牌行+编号标签 / 资料簇沉底）+ 右封面窗，接缝 1px 墨线+斜线纹脊；底部一块看板装下全部数字（规格表头 4 栏 + 时数 + 阶梯 + 里程碑文案） |
| dossier 1200×1500 | 规格账目：右上档案照 470×520（1px 墨框+斜线纹影子），左侧标题簇；时数块在左栏，下方**全宽细线账目行**（标签左/数值右）填满原 700px 死白；空心幽灵编号（-webkit-text-stroke） |
| score 1600×840 | 封面横带下缘 1px 墨线（原 8px 黄线）；品牌行+编号标签移到纸上；左标题簇 / 右看板（规格表头 2×2 + 时数 + 阶梯），看板切角朝页面中心 |

### 1.25.5 验证

| 检查 | 结果 |
| --- | --- |
| `tools/share-shots.js --themes=endfield` | 三种规格按设计尺寸导出，overflow 0 |
| 导出泄漏 | 像素验证：y=1 三段铺满 1600（x=1500 为薄荷绿），body 条带不再叠画 |
| Saira 加载 | `document.fonts.check('800 84px "Saira EF"')` true，faces `50% 125% loaded` |
| 其他主题 | nova poster 前后对照：分隔符仍 `·`、构图零变化 |
| `theme-slot-check --strict` | exit 0 |
| `tools/feature-checks.js` | 全过（app.js 改动后回归） |
| 编译（本轮无 C# 改动） | modern net10 Debug **0 错误 / 5 警告（全部既有）**；legacy net48 Debug（`tools/build-legacy.sh Debug`，顺带重打 assets zip）**0 错误 / 47 警告（既有 nullability 提示）** |
| 对比度 | 卡面全部成对：墨/纸 15:1、墨2/纸 5.5:1、白字/墨标签 15:1、墨/白板 15.6:1（AA 余量充足） |
| 技能交付清单 | 黄=填充 only、切角不压字、无红、无圆角/投影/渐变、数字全真实、无假技术文字、术语未外泄 |

### 1.25.6 已知限制 / 下一步

1. **等高线纹理未上卡**：`src/assets/contours/*.svg` 单个 ~70KB，不适合内联进主题
   CSS（主题目录会被整体拷贝到运行时，相对路径不可靠）；斜线纹足够表达，如要等高线
   需要宿主侧资产映射；
2. dossier 的空状态呼吸区（账目行与幽灵编号之间 ~140px）刻意保留，规格纸需要留白；
3. 签名分隔符在 sc-sign 文本节点内嵌 `<em>`，若未来其他主题要换分隔符，同一机制可复用；
4. endfield `theme.json` 1.0.24 → **1.0.25**（铁律 41）；已随 PR #39 合并进 `main`；版本仍 1.16.5，**未发行（等 Owner 批准）**；
5. Owner 实机回访：真机导出一次 poster/dossier/score，确认 WebView2 下 Saira 与
   无头渲染一致（`font-display: block`，字体在 runtime assets 内已存在）。
## 1.26 第十四轮（2026-11-11）：文件解耦与代码整合（重构轮，行为零变化；已合并 [PR #40](https://github.com/118coder/guguova-game-space/pull/40)，未发版）

> Owner 指令：①在保证全功能正常的前提下，把大文件解成小文件与文件夹，各司其职、
> 做好文档备注；②整合精简代码、保持高复用；③全自动执行。
> 本轮**不新增功能、不改任何行为**：JS 拆分以字节级比对证明等价，C# 拆分是
> partial 逐字搬运（构建 0 错误、警告逐条一致）。版本仍 1.16.5，未 bump、未发行。

### 1.26.1 渲染端：app.js（9802 行）→ src/app/ 29 个分片

**为什么用「拼装」而不是改造成多文件加载**：`src/app.js` 是单一 IIFE 闭包，
42 个区块注释标记的区块共享同一作用域、互相直接引用。拆成多个 `<script>` 标签或 ES module
都要重写全部跨区块引用（数千处），风险不可控；而**文本拼装能逐字节还原原文**，
是行为零变化的唯一路径。这也是本产品 JS 侧的既定模式延续：`index.html` 本来
就是「多文件 defer 按序加载」。

- 切分依据原文件自己的 42 个区块注释 → 29 个分片（`01-runtime.js` …
  `29-boot.js`），每个分片头部带中文职责说明；
- **验证链**：①切片拼装 == 原文件逐字节一致（拆分脚本内置断言）；②加注释头
  重建后 `git diff` 仅 **203 行纯插入、0 删除**（29 分片 × 7 行注释头）；
  `node --check` 通过；③`feature-checks` 全过（无头 QA 用拆分后的分片真实
  启动了渲染端）；
- **拼装器** `tools/build-app.js`：按文件名序拼接（`--check` 校验 `src/app.js`
  未过期）。接线五处：
  | 入口 | 行为 |
  | --- | --- |
  | `tools/lib/headless-host.js` | 所有无头 QA 启动前自动拼装 |
  | `tools/relaunch.sh` | 开发重启前自动拼装 |
  | `tools/release.sh` | 审计阶段 `build-app --check`（发行闸门） |
  | `tools/pack-assets.py` | 打包跳过 `src/app/`，只装拼装产物 |
  | `legacy/NovaGameSpace.Legacy.csproj` | `<Content Remove="..\src\app\**">` |
- 分片地图、规则、跨分片引用惯例：**`src/app/README.md`**（唯一权威）。
- 修 CSS 层叠序、主题 `theme.json` 均未触碰；`index.html` 未动（`app.js` 仍是
  唯一被加载的主程序文件，`?v=` 戳不需要变）。

### 1.26.2 宿主 C#：三个大文件 partial 拆分（子代理执行）

| 原文件 | 拆后 | 分片 |
| --- | --- | --- |
| `NativeBridge.cs` 2653 行 | 主文件 408 行（消息路由 + 参数解析）+ 10 个领域分片 | Capture / Engine / Games / Launch / Library / Media / Settings / System / Themes / Update |
| `Services/LauncherService.cs` 1223 行 | 主文件 82 行（字段/事件/构造）+ 3 分片 | Launch 347 / Process 528 / Session 302 |
| `Services/ScalingEngine.cs` 1030 行 | 主文件 58 行（常量/字段）+ 3 分片 | Detect 182 / Process 340 / Config 500 |

- **零逻辑变更**：子代理用多重集校验证明原文件全部非空代码行（2445 + 1105 +
  912 行）在新文件集合中出现且仅出现一次；`partial` 声明 + 中文职责头注释；
  using 按分片实际需要补齐。
- **csproj**：legacy 显式引用根目录桥文件，已补 10 条 `<Compile Include>`；
  Services 分片两个 csproj 都是通配，零改动；modern csproj 是 SDK 通配，零改动。
- **构建验证**：modern 0 错误 5 警告、legacy 0 错误 47 警告——与拆分前完全一致，
  且 47 条 legacy 警告按「警告代码+消息」逐条比对一致（仅行号落到分片文件）。
- **遗留提醒**：以后新增 `NativeBridge.*.cs` 要同步补 legacy csproj 的
  `<Compile>` 条目（已在 `docs/ARCHITECTURE.md` §1.1 标注）。

### 1.26.3 tools 精简（子代理执行）

- **已删**（grep 全仓库零引用后直接删除，不进回收站）：`tools/_intro1.tmp.js`、
  `_intros.tmp.js`、`_probe2.tmp.js`、`_reload.tmp.js`、`tools/__pycache__/`。
- **保留**：`_eval/_hit/_layers/_probe` 四个 tmp 探针被 `docs/HANDOFF-THEMES.md`
  引用（历史文档引用而非活代码依赖），等文档修订时一并处理。
- **`pipeline.sh` 不删**：release.sh 未覆盖它的三处——`--modern` 自包含打包
  （`PublishSingleFile` + `package-release.py --modern-dir`）、`--no-zip`、
  真实宿主审计路线（probe-graphics.js 铁律 1 压字检测）；且有 3 处活引用
  （verify-release.py / fetch-magpie.py / HANDOFF.md）。收编是 P2 原项，本轮
  只记录差异不强行合并。
- 疑似一次性调试脚本盘点（probe-logo / padtest / shot-theme / shot-view /
  clear-cache / test-intro-theme 等约 8 个）：只盘点未删，清单见本轮 QA 报告；
  `launch-legacy.cmd`（发行产物组成部分）、`measure-ratio.py`、
  `probe-graphics.js`、`stress-dataset.py`、`dev-run.sh`、`immersive-audit.js`
  确认仍在用，**不可删**。

### 1.26.4 文档

- **新建 `docs/ARCHITECTURE.md`**：仓库结构总览、宿主/渲染端文件职责速查表、
  `src/app/` 分片机制（引用 `src/app/README.md`）、CSS 层叠序契约与「为什么
  CSS 不拆文件」、构建链（双目标 / assets.zip 可复现 / release.sh 流水线图）、
  铁律指路。**本轮最重要的新文档**，下一轮接手先读它再读交接。
- **新建 `src/app/README.md`**：分片规则 + 29 分片地图。

### 1.26.5 决策记录：CSS 为什么不拆

`intro.css` 5063 行、`base.css` 2904 行等大 CSS 保持原样。理由：层叠序是本产品
最脆弱的契约（交接铁律与 §1.5 反复强调），每多一张表就多一层叠边界与加载时序
变量；且 19 张 CSS 每张已各自单一职责（base/app/type/views/…），「拆」已无收益
只剩风险。JS 能拆是因为文本拼装可逐字节验证等价，CSS 拼装做不到等价性验证。
完整论述在 `docs/ARCHITECTURE.md` §2。

### 1.26.6 验证（全量回归，11 项）

| 项 | 结果 | 基线 |
| --- | --- | --- |
| `build-app --check` | ✅ up to date（413377 B，29 分片） | — |
| modern 构建（Rebuild 全量） | ✅ 0 错误 / 5 警告（全部既有，非本轮文件） | 5 |
| legacy 构建（Rebuild 全量） | ✅ 0 错误 / 47 警告（既有可空类） | 47 |
| `theme-slot-check --strict` | ✅ exit 0 | 一致 |
| `feature-checks.js` | ✅ 63 项 [ok] / 0 失败 | 全过 |
| `tier-shots --shots=false` | ✅ 98 组 / 294 captures 全过（288s） | 98 |
| `headless-shots --views=all` | ✅ 294 张；26 条警告全是既有 aurum(5px)/dusk(2px) 磁贴名裁切，0 新增 | 26 条既有 |
| `immersive-audit.js` | ✅ 196/196 | 196 |
| `layout-fit.js` | ✅ 6/6（默认）+ 24/24（历史 4 主题跑法 `--themes=nova,broadcast,grimoire,steam`） | 24 |
| `verify-hidden.js` | ✅ 7/7 | 7 |
| `share-shots.js` | ✅ 42 卡 × 3 版式全按设计尺寸，`overflow:0` ×42 | 42 |
| `text-audit --views=detail`（全视图） | ⚠️ 22 标签 < 4.5:1——**既有问题非本轮回归**：本轮零 CSS/主题改动、app.js 与 HEAD 仅差注释行；用 §1.22.6 的**原始基线命令**（`--selectors=#manageHiddenHint,#detailScaleHint,#manageDoneBtn`）复跑 = **0 失败 / 14 主题**，与基线一致。全视图的 22 处属于 §1.22.5 记录的 118 处窗口模式小字已知问题（dusk/grimoire/riot/broadcast 纸面主题的 stat-label 等） | 基线命令 0 失败 |

> 构建坑（QA 代理实测）：用临时输出路径做增量 build 会因「已是最新」跳过编译报**假 0 警告**——验证警告数量必须 `-t:Rebuild` 强制全量。

### 1.26.7 没做 / 下一步

1. `pipeline.sh --modern` 收编进 release.sh 后删除（P2 原项，本轮记录了差异）；
2. `HANDOFF-THEMES.md` 修订时清理 4 个仍被引用的 tmp 探针与过期提及
   （文档里还提到一个不存在的 `_shot1.tmp.js`）；
3. 盘点表中「疑似一次性」脚本的去留等 Owner 拍板（probe-logo、padtest、
   shot-theme、shot-view、clear-cache、test-intro-theme）；
4. 本轮为重构轮：**未 bump 版本、未发行**；14 套主题 `theme.json` 仍未 bump
   （沿袭 §1.23.6 第 4 条，发版时统一处理）。

---

## 2. 1.15.0 做的四件事（背景）

### 2.1 多平台入库（Steam 之外 6 家）

新增 `Services/PlatformScanner.cs`，只读地读取每家启动器的已安装记录：

| 平台 | 识别方式 | 启动方式 |
| --- | --- | --- |
| Steam | `appmanifest_*.acf` + `libraryfolders.vdf`（沿用 `GameScanner`） | `steam.exe -applaunch` |
| Epic Games | `%ProgramData%\Epic\EpicGamesLauncher\Data\Manifests\*.item` | `com.epicgames.launcher://apps/<ns>%3A<item>%3A<app>?action=launch&silent=true` |
| GOG | `HKLM/HKCU\SOFTWARE\GOG.com\Games\<id>`（`gameName`/`path`/`exe`） | 直接跑 exe（DRM-free） |
| Ubisoft Connect | `SOFTWARE\Ubisoft\Launcher\Installs\<id>` → `InstallDir` | `uplay://launch/<id>/0` |
| EA app | `SOFTWARE\Electronic Arts\EA Games\<title>` → `Install Dir` | 直接跑 exe（EA app 由游戏自己拉起） |
| Xbox / PC Game Pass | `<盘>:\XboxGames\<Title>\Content\AppxManifest.xml` | `explorer.exe shell:AppsFolder\<PFN>!<App>` |
| 战网 | `SOFTWARE\Blizzard Entertainment\<Title>` → `InstallLocation` | `battlenet://<code>`（已知标题），否则直接跑 exe |

要点：

- **注册表按 64/32 位双视图读**：路径写 `SOFTWARE\...`，不写 `WOW6432Node`，
  让 `RegistryView` 自己选，HKCU/HKLM 都试一遍。
- **Xbox 的 AUMID 要 PackageFamilyName**，而 publisher hash 不在清单里：
  去 `AppModel\Repository\Packages` 按 `PackageID` 反查 `PackageFamilyName`，
  查不到才退回 `<Identity>!<App>`（有些标题能生效）。
- **exe 解析**：清单给相对路径就拼装并校验；失效则退回
  `GameScanner.FindMainExecutable`（按名字相似度 + 目录深度打分）。
- **封面**：只有 Steam 有本地封面缓存；其余平台不下载、不缓存，交给
  `CoverAnalyzer` 从 exe 图标生成。这是刻意的离线约束。

### 2.2 首次启动问一次

- `PlayerSettings.FirstRunDone` 之前**定义了但从未使用**，本轮启用；
  `boot` payload 新增 `firstRun`。
- 开场仪式结束（或 reduce-motion / safe tier 跳过仪式）后 620ms 打开入库窗口，
  标题是「要把已有的游戏收进来吗？」，副标题给出平台数与条目数，
  三个出口：**开始扫描 / 手动添加 / 稍后再说**。
- 任一出路都会写 `dismissFirstRun`，之后不再打扰；
  点遮罩、按 Esc 也算「稍后」。
- 副标题用「约 N 款」：检测条数按 manifest/注册表计数（便宜），
  真正扫描会丢掉没有 exe 的条目，两者可能差 1–2。

### 2.3 添加游戏先选路

顶栏 `+`、游戏库「添加游戏」、空库主按钮、`rail` 空卡，全部先开入库窗口：

```
+  → 入库窗口 →(自动) 扫描窗口 →(勾选) 导入
              →(手动) 编辑器
```

窗口本身就是选择器：两张卡（`role=radio`）+ 主按钮文案随选择变化
（「开始扫描」/「填写信息」），默认选中有平台的自动扫描，没有平台时选中手动。

### 2.4 扫描窗口按平台分组

- 列表顶部有一条**总开关**：`全选`（勾选框），点一下选中所有可导入行
  （所有平台 + 清单 + 快捷方式），再点一下全部取消；旁边是「已选 X / Y」。
  文案不随状态变化，勾选框本身就是开关；
- `scanLibrary` 返回 `groups: [{ id, label, shortLabel, count, items }]`，
  item 的统一形状是 `{ key: "<platform>:<platformId>", name, detail, exePath, coverUrl, imported }`。
- 分组标题带「全选 N」，列表上方还有一条总开关：**标签永远叫「全选」，勾选框就是
  开关**——点一下全选，再点一下全部取消，右侧「已选 X / Y」实时显示；
  组内标题同样只叫「全选 N」，状态由勾选行与 `aria-pressed` 表达，不出现「取消全选」。
- 已入库的行虚线置灰不可点；来源徽标是纯文字（`STEAM` / `EPIC` / `GOG` /
  `UBISOFT` / `EA` / `XBOX` / `BATTLE.NET`），不使用任何第三方 logo。
- `importCandidates` 改成 `{ keys: [...] }`（`<platform>:<id>`），一次扫描解析整批。

### 2.5 修复：扫描行的封面缩略图（1.15.0 补丁）

用户截图暴露的坏图有两类，根因不同：

1. **`file:///` 被拒**。页面跑在 `https://nova.site` 上，`NativeBridge.FileUrl`
   却把 Steam 缓存封面写成 `file:///D:/…` —— 跨源，WebView2 直接不画，
   于是出现浏览器自带的破图图标。修法：`FileUrl` 现在把文件所在文件夹映射成
   `nova.cacheN` 虚拟主机（`SetVirtualHostNameToFolderMapping`）再拼 URL；
   Steam 的缓存都在 `appcache\librarycache` 下，所以 attach 时先把每个库的
   `librarycache` 根映射好（`GameScanner.CacheRoots()`），`FileUrl` 用最长前缀
   匹配 —— 一个库一个主机，不再按 app 文件夹爆炸式映射。
2. **缓存里本来就没有封面**。这类行现在统一渲染「黑胶唱片」兜底图标：
   `scanRow` 永远先画 `#i-disc`，封面 `<img>` 绝对定位盖在上面，
   `error` 时把自己移除 —— 缓存被清理、库搬家、路径失效都只会退到兜底图标，
   不会再出现破图。

另外：已入库的行优先显示启动器自己存的封面（`nova.media`，必定可加载），
而不是 Steam 缓存里那份可能已失效的图（`CoverUrlFor`）。

实测：63 行扫描，8 张 Steam 缓存封面全部加载（0 broken / 0 pending），
日志只有一条 `file host nova.cache1 -> …\appcache\librarycache`。

### 2.6 无头拟真：一条命令导出全部截图（1.15.0 新增）

以前每轮验证都要起 WPF + WebView2，再用 `export-all.js` 一屏一屏点；WebView2 在
某些会话里还会 `GpuProcessExited`。现在可以完全不启动宿主：

```bash
node tools/headless-shots.js                        # 14 主题 × 7 个核心界面
node tools/headless-shots.js --views=all --workers=4 # 14 × 20 = 280 张，约 3.5 分钟
```

实现：

| 文件 | 作用 |
| --- | --- |
| `tools/lib/headless-host.js` | 本地静态服务器 + `msedge --headless=new` + **页面内应答原生桥**（boot / listThemes / platformSummary / scanLibrary / engineOptions …） |
| `tools/lib/ui-views.js` | 唯一的「点进某个界面」脚本，`export-all.js` 与 `headless-shots.js` 共用 |
| `tools/headless-shots.js` | 并行调度、截图、逐张布局审计、`manifest.json` |

要点：

- **虚构库**：6 款示例游戏（与 `tools/demo-covers.py` 同一套），封面取自
  `../_shots/covers/jpg/`，不含任何真实游戏素材；
- **不碰玩家数据**：没有 `NOVA_DATA_ROOT`，没有 `library.json` 读写；
- **默认关掉 `backdrop-filter`**：软件光栅下那一个属性会让每张图慢 6–15 秒，
  弹窗本身不变，只把遮罩换成更深的纯色（要原样加 `--blur`）；
- 每个 CDP 步骤有 20 秒上限，连续三次超时就放弃该渲染进程，不会整轮卡死；
- 输出结构、`manifest.json` 字段与 `export-all.js` 一致，布局告警同一套判据。

实测：14 主题 × 20 界面 = **280 张 / 212 秒 / 4 个渲染进程**，0 截断 0 横向溢出。

### 2.7 体验补齐包（1.15.0 同轮）

| # | 改动 | 说明 |
| --- | --- | --- |
| 1 | **启动器不再被当游戏** | `GameScanner.ClientExeNames` 黑名单：steam/epic/gog/battle.net/origin/ea/upc/ubisoftconnect/itch 本体 exe 不再出现在快捷方式扫描里 |
| 2 | **扫描窗口搜索框** | `#scannerSearch` 实时过滤所有行（名称+路径）；组内没有可见行就整组隐藏；全选语义不变（作用于全部可导入行） |
| 3 | **客户端未装提示** | `PlatformScanner.ClientInstalled()`（会话内缓存）；组标题出现「客户端未安装」虚线徽标，管理面板状态改为「未检测到 X 客户端」 |
| 4 | **入库回执** | 导入完成弹出主题化 dialog：「已入库 N 款游戏」+ 名称（>8 款截断） |
| 5 | **挂机暂停计时** | `GetLastInputInfo` 看门狗（15s 采样）：输入空闲超过 `IdlePauseMinutes`（默认 10，0=关）即暂停计秒，恢复后从墙钟里扣除；设置页新增开关；退出结算用 `EffectiveSeconds` |
| 6 | **拖拽入库** | 拖 exe/.lnk/文件夹到窗口 → 编辑器预填；WPF `AllowDrop` 拿路径（页面拿不到），`resolveDrop` 规范化（目录挑主程序、拒绝启动器本体），`drop-import` 消息进前端；**真实拖拽手感需实机确认** |
| 7 | **托盘快速启动** | 托盘右键列出最近游玩 5 款（可启动的），点击直接启动，失败弹回主窗并 toast |
| 8 | **详情最近记录** | payload 带最近 5 条 `PlaySession`；详情页新增「最近记录」列表（时间 · 时长 · 异常退出标记） |
| 9 | **Xbox 直连置灰** | 打包应用受 WindowsApps ACL 保护，管理面板对 Xbox 条目禁用「直接启动」 |

发版时踩到并修掉的：**net48 没有 `Dictionary.Remove(key, out value)` 重载**
（.NET Core 2.0+ 才有）——挂机看门狗的 `_idleSince.Remove(id, out var t)` 在 legacy
构建直接 CS1501。改回 `TryGetValue` + `Remove` 两步，并删掉未使用的
`_idleThresholdMinutes` 字段。**写共享服务代码时先过一遍 legacy (net48) 语法面。**

明确不做（本轮决策）：EA 的 `origin://launchgame` 需要稳定 contentId，注册表里拿不到，EA 条目维持直接启动；itch.io 不是主流平台且无法真机验证；游戏内浮层（Shift+Tab 迷你浮层）是远景。

实测：搜索过滤（63→1→63）、入库回执（「已入库 1 款游戏 · CrossCode」）、拖拽解析（notepad.exe 预填 / steam.exe 被拒）、挂机开关（aria + library.json 落盘 10）、详情记录渲染（2 条含异常退出标记）、scanner+settings+detail 对比度 14 主题 0 失败。

---

## 3. 数据模型变化

`GameEntry` 新增两个字段（都为可空兼容，旧 `library.json` 直接读）：

| 字段 | 含义 |
| --- | --- |
| `PlatformId` | 平台自己的 id：Epic AppName / GOG gameID / Ubisoft install id / Xbox AUMID / 战网 code |
| `LaunchUri` | 必须由客户端启动的协议地址；空 = exe 足够（GOG、EA、手动） |

`GamePayload` 新增 `PlatformId` / `PlatformLabel` / `HasLaunchUri`，前端不再靠
`source === 'steam'` 猜。

`launchMode` 新增 `platform`；`GameLaunch.ModeFor()` 是唯一解析器，
`SteamService.ModeFor()` 转发它。

另有：`PlayerSettings.IdlePauseMinutes`（默认 10，0=关）、`GamePayload.ClientInstalled` /
`RecentSessions`（最近 5 条会话）、`DropResolution`（拖拽解析结果，注册进 StoreJsonContext）。

---

## 4. 入库窗口的设计契约

见 `docs/THEME-DESIGN-SPEC.md` §5.5。三句话版本：

1. 它**就是**一个 `.engine-shell`，材质/切角/标题字体/按钮配方全部来自
   `--sheet-*`，所以 14 套主题不需要额外写样式就各自成立；
2. 选择卡的选中态只用 `--sheet-mark`（左轨）+ `--sheet-active-bg`（底），
   文字永远 `--sheet-ink`；
3. 「推荐」标签用 `--sheet-ink-2` + 一个 `--sheet-mark` 圆点，
   **不要**用 `--accent-text`（nova 的 accent 取自封面，深封面会掉到 2:1）。

---

## 5. 顺带修掉的真问题

本轮为了「新控件一次适配 14 套主题」，审计把旧问题一起照出来了：

| 问题 | 位置 | 修法 |
| --- | --- | --- |
| 弹窗里的焦点环是白色，纸面主题等于没有 | `src/app.css` | `html .engine-shell :focus-visible { outline: var(--sheet-ink) }`（顺带修好缩放引擎弹窗） |
| DUSK 主按钮纸张字压浅陶土只有 **2.95:1** | `--sheet-primary-bg` | 渐变加深为 `#a9503a → #8a3d2a`，最浅端 4.8:1 |
| 扫描行徽标在 RIOT 纸面 **4.04:1** | 各主题 `.scan-source` 用了 `--t-accent` | `html[data-theme] .scan-source { color: var(--accent-text) }` |
| 分组计数 `em` 用 `opacity: .82` 压色 | `.scan-group-title span em` | 去掉 opacity（铁律 26） |
| 轨道选中项副标题用 `--accent`，深封面时 **2.2:1** | `base.css` `.tile.is-active .tile-sub` | 改 `--muted` |
| ENDFIELD 搜索框 `/` 键帽墨字压墨底 **1:1** | `themes/endfield/theme.css` | 加 `html[data-theme="endfield"]` 提权，恢复纸色字 |
| 快捷键值 `opacity: .82` → ENDFIELD **4.33:1** | `src/app.css` `.hotkey-value` | 去掉 opacity |
| nova 的 `--accent-text` 直接等于封面取色，深封面全站小字掉到 2:1 | `app.js applyAccent` | 新增 `readableAccentText()`：按 WCAG 逐级提亮到 4.6:1，保留色相 |
| 主题切换后行内 `--accent-text` 反过来盖住主题自己的值 | `theme-engine.js apply()` | 换主题时清掉行内 `--accent-text`（除非主题 tokens 里自带） |
| 弹窗关闭按钮 hover 时被主题染成浅色，压在浅底上 **1.2:1**（DUSK / RIOT） | `html[data-theme] .engine-shell :is(.icon-btn:hover…)` | 用 `:is()` 多拿一级特异性，赢过 `html[data-theme="dusk"] .icon-btn:hover` |
| 空库主按钮被压到 `opacity: .55`，CODEX 深字压金底 **3.9:1** | `body.is-empty` | 空库时主按钮是全亮度（它现在是「添加游戏」入口），只淡出进度条 |
| 选中卡的左轨用 `::before` 画，悬停审计把伪元素当整块底色 → 假 1:1 | `.import-choice` | 改成 `border-left: var(--sheet-mark-w) solid`，不再用伪元素 |

---

## 6. 验证记录（全部无头 CDP）

启动方式（本机 WebView2 需要关沙箱 + 软件渲染，否则 GPU 进程立刻退出）：

```bash
NOVA_DATA_ROOT="D:/tmp/guguova-import" \
NOVA_CACHE_ROOT="$(pwd)/.cache/webview2-import" \
NOVA_CDP_PORT=9333 \
NOVA_WEBVIEW_ARGS="--no-sandbox --disable-gpu" \
./bin/Debug/net10.0-windows/win-x64/GUGUOVA.exe
```

| 项 | 结果 |
| --- | --- |
| 静态对比度 | 14 主题 × 18 界面（**含 `import`**），`✓ every measured text run meets AA on a solid background` |
| 悬停/聚焦对比度 | 14 主题 × 4 视图（home / settings / detail / **import**），`✓ every measured hover/focus run meets AA on a solid background` |
| 首启动提示 | 空数据根首启 → 弹窗出现、检测到 STEAM 24 + GOG 1、`开始扫描` 可点；关闭后 `firstRunDone=true`，二次启动不再出现 |
| 无头全量截图 | `headless-shots --views=all --workers=4` → **280 张 / 212 秒**，0 截断 0 横向溢出，14 主题 20 界面齐全 |
| 体验补齐包 | 搜索过滤 63→1→63；入库回执弹窗；拖拽解析（notepad 预填 / steam.exe 拒绝）；挂机开关 aria+落盘；详情记录 2 条渲染；scanner+settings+detail 对比度 14 主题 0 失败 |
| 入库全流程 | GOG `CrossCode` 导入成功：`source=gog`、`platformId=1252295864`、`hasLaunchUri=false`、`launchModeResolved=direct`；库统计「1 款来自平台」、卡片徽标 `GOG`、筛选「平台」命中 |
| 平台扫描 | `Steam 22 · GOG 1 · 快捷方式 40`，分组标题「全选 22 / 全选 1 / 全选 40」，勾选后按钮变「导入所选 (1)」 |
| 文案一致性 | 详情「来源」、管理面板「启动方式 / 版本来源」、首页副状态都跟随 `sourceLabel` |
| 构建 | `dotnet build -c Debug` 0 错误（3 个既有警告） |

QA 产物（仓库外）：

- `../_shots/contrast/contrast.json`
- `../_shots/contrast-hover/hover.json`
- `../_shots/import-check/`（入库窗口与库卡截图）
- `../_shots/headless/`（14 主题 × 20 界面，无头渲染与布局审计）

---

## 7. 下一轮 P0

### P0-0 · 收官 1.16.5（实机验收已完成，全部证据在 §1.17）

1. ✅ **真实 DNF 缩放实机验收已完成**：全屏 / 2.5 倍 / 像素算法三种配置都是
   `scaled=True`，并有窗口像素尺寸为证（§1.17.2）。7001 空闲，隔离环境已删干净。
2. ✅ `bin/Debug` 已刷新到 1.16.5：Owner 的提权旧实例 PID 29332 杀不掉，改用
   重命名 `.old.exe/.old.dll` 绕过文件锁，旧实例照常运行。**等它退出后把这两个
   `.old` 文件直接删掉**（不要进回收站）。
3. ✅ 回归全过：双目标编译 0 错误、`theme-slot-check` 0 finding、
   `feature-checks` 41/41、`tier-shots` 98 组、`headless-shots --views=all`
   26 条警告全是既有 aurum/dusk 磁贴名裁切（0 新增）。
4. ✅ **对外动作已完成**：PR [#36](https://github.com/118coder/guguova-game-space/pull/36)
   合并 `bbdd2d0`；`v1.16.5` 已发布，三个资产与哈希见文档头部。
5. UI 观感清单沿用：库工具栏 14 主题扫一眼、类型筛选 + combo、隐藏开关 +
   数据包往返、封面标签 1/2/3 档位、格式化资料 14 行导出。

### P0-0b · 1.16.3 实机回访（已发行，与上面一并做）

1.1.16.3 已按 Owner 指示直接发行（PR #35 → v1.16.3）。回访要点不变：

1. 实机看 3–4 套常用主题下进度条变色的观感（重点：endfield 三色条带终局、
   dusk 日出终局、broadcast 的 REC 红是否可接受——单色系是唯一没有标准
   答案的一套，备选纯灰阶；HSL 宽弧后各主题的弧线走向见 §1.13.4a 表，
   单调某条弧只需改该主题 `--prog-l*` 两行）；
2. 玩一款游戏跨过 50h 节点（或用 dev 手段改 playtime）确认变色瞬间 +
   详情页「下一阶段」文案；
3. 确认 40h 内的老游戏观感不变（tier 0 不发布变量，理应逐像素一致）；
4. 若有颜色回访：改锚点 → bump theme.json → `node tools/tier-shots.js
   --themes=<id> --shots=false` 断言 → 视需要补丁版本发行。

### P0-1 · 1.16.2 功能的实机回归（排序 + 截图，沿用）

**排序**（只做过静态推理，没逐条点过）：

1. 14 套主题下看方向按钮的观感——1.16.2 只并进了 dusk / nightflight /
   steam 三条已有规则；**1.16.4 已把其余 10 套全部按各自材料语言覆写**
   （§1.14.4），头less 截图按圆角指纹抽验过 endfield/dusk/nova 三档，
   全量观感仍在 §7 P0-0 第 7 条实机确认；
2. 五个字段各切一次正序/倒序，确认方向按钮显示的方向与列表实际顺序一致；
3. 换字段时方向是否回到该字段默认（名称升序、其余降序）；
4. 重启后方向是否保持（`library.json` 的 `librarySortDir`）；
5. 并列项在正序/倒序下是否保持库内相对顺序（第六季第七章的两款是天然样本）。

**截图**：

1. 首页 / 外观 / 设置三个视图各导一次——本轮的实机验证只覆盖了游戏库，
   另外三个视图的滚动容器不是同一个元素，靠 `exportScroller()` 自动判定，
   如果哪个视图导出为空或只截到一屏，问题在这里；
2. 窗口最大化、拉到半屏、切竖排布局后再导，确认宽度跟随；
3. 长页面（>4000 CSS px，会走多切片）拼接处是否有 1px 缝。

### P0-2 · 五个平台的真机验证（沿用，本轮未动）

代码路径都对，但**本机没有 Epic / Ubisoft / EA / Xbox / 战网的安装**：

1. 装 Epic 客户端 + 1 款免费游戏 → 确认 `.item` 解析、协议启动、进程附着；
2. Ubisoft Connect + 1 款 → 确认 `Installs` 键与 `uplay://launch/<id>/0`；
3. EA app + 1 款 → 确认 `Install Dir` 与直接 exe 启动；
4. Xbox / PC Game Pass + 1 款 → 确认 `AppxManifest` 能读到 AUMID、
   `explorer.exe shell:AppsFolder\…` 能拉起，且「程序缺失」不会误报；
5. 战网 + 1 款 → 确认 `battlenet://` 代码表覆盖到了。

判定标准：条目能导入、能启动、退出后时长进库、管理面板能切「直接启动」。

### P0-3 · 首次启动提示的边界

- 老玩家升级（库里已有游戏、`firstRunDone=false`）→ 只弹一次；
- 弹窗打开时按 Esc / 点遮罩 / 关窗口 → 下次启动不再弹；
- 空库且没装任何平台 → 默认落在「手动添加」，副标题为「没有检测到已安装的平台」；
- `NOVA_DATA_ROOT` 演示实例每次新数据根都会问一次（预期行为）。

### P0-4 · Steam 全流程（沿用上一轮的阻塞项）

登录态、SteamStub 与普通游戏各一次、`launchMode` 三种、退出后 2.5s 的
`playtime-synced`、无 UAC。详见 1.14.4 交接文档 §8 P0-1。

### P0-5 · 缩放引擎真机（另一台没有 Magpie 的机器）

单 exe 首启解压、自动拉起、快捷键、退出后自动关闭；光标「跟随画面」、
帧率留空=无上限。

### P0-6 · 全主题回归 + 布局

```bash
bash tools/release.sh --audit
node tools/export-all.js --themes=all --views=all --sizes=1439x1124,960x600,1280x800 --stress
```

重点看入库窗口在 `960x600` 下两张卡是否挤（≤620px 已降为单列），
30 字标题 + 平台徽标那一行是否溢出，以及 `.lib-sort` 加了一个 32px 按钮后
在 `960x600` / `620px` 断点下是否挤到换行。

> **启动"秒开"不在本轮 P0**：Owner 在 2026-11-06 决定推到最终版再做。
> 方案已完整存档在 §1.12.3，届时按"常驻/自启 → 主题首帧 → CSS 预算 +
> 动画快速模式"的顺序执行即可，不需要重新论证。

---

## 8. 下一轮 P1 / P2

### P1

- **启动"秒开"（最终版再做）**：方案见 §1.12.3，顺序是常驻/开机自启 →
  冷启填主题首帧 → CSS 预算 + 动画快速模式。**不要单独先砍开场动画**。
- **截图的可发现性**：现在只有一条 3 秒的 toast 带路径，导出完就消失。
  建议在 toast 里给一个"打开文件夹"动作，或复用已有的 `revealPath` 桥，
  否则玩家得自己去「图片」里翻。
- **截图的第二个出口**：目前只存 PNG。如果要做"复制到剪贴板"或 JPG
  （分享用），入口应继续放在 `#shotBtn` 的长按或右键菜单，不要再占顶栏位置。
- **封面**：Epic / Ubisoft / Xbox 目前只有图标生成的封面；如果要截图级的观感，
  得让玩家手动选图，或读取各客户端自己的本地缓存（离线、不下载）。
- **战网代码表**：`Call of Duty` 系列没有稳定 code，目前走直接 exe。
- **Xbox 直接启动**：`LaunchMode=direct` 时 WindowsApps 的 ACL 会拒绝，
  应该在 UI 上把「直接启动」对 Xbox 条目置灰，而不是让玩家点了报错。
- **入库窗口的键盘路径**：目前 Tab 到卡片按 Enter 只切换选中，还要再 Tab 到
  「继续」；可以让 Enter 直接在主按钮上生效（手柄 A 已经是这个行为）。
- **挂机暂停的可见反馈**：暂停只写日志，运行中卡片没有"已暂停"角标；要做得低调。
- **`audit-hover` 视图扩展**：把 library / engine / appearance / scanner 纳入默认集。
- **无头截图提速**：现在 280 张 212 秒；可把 `setup()` 里的固定 sleep 改成
  「等目标元素出现」的轮询，预计能再快一半。
- **README**：截图仍是 1.9.0 的，功能列表也没有平台入库与截图导出。
- **Magpie profile `autoScale`**：把「全屏缩放」映射成按 exe 自动缩放。
- **排序的记忆粒度**：现在只有一个全局 `librarySortDir`，换字段会丢上一次的
  方向。若玩家反馈，可以改成按字段记（`{name:'asc', recent:'desc', …}`），
  注意 `PlayerSettings` 要加字典字段并保持旧值兼容。

### P2

- 可选效果包（Anime4K / CuNNy / RAVU / NNEDI3 / CRT / xBRZ）。
- 归档 `docs/HANDOFF.md`、`docs/THEMES.md`（仍是 1.8.0 的叙事）。
- 清理 `tools/_*.tmp.js` 调试残留。
- `pipeline.sh` 收编到 `release.sh` 后删除。

---

## 9. 关键文件地图

| 需求 | 位置 |
| --- | --- |
| 平台清单 / 标签 | `Services/PlatformScanner.cs` `GamePlatform` |
| 平台扫描 | `Services/PlatformScanner.cs` `Scan()` / `Detect()` |
| 平台协议启动 | `Services/LaunchModes.cs`、`LauncherService.LaunchThroughClient` |
| 扫描/导入桥 | `NativeBridge.cs` `ScanLibrary` / `PlatformSummary` / `ImportCandidates` / `DismissFirstRun` |
| 首次启动 | `NativeBridge.BuildBootPayload`（`firstRun`）→ `app.js` `maybeAskFirstRun` |
| 入库窗口 | `src/index.html#importOverlay`、`src/app.js` IMPORT SHEET、`src/app.css` `.import-shell` |
| 扫描窗口 | `src/app.js` SCANNER（`renderScanResults` / `scanGroupTitle` / `toggleScanGroup`） |
| 来源文案 | `src/app.js` `platformOf` / `sourceLabel` / `platformShort` |
| 可读强调色 | `src/app.js` `readableAccentText` / `applyAccent` |
| 主题令牌清理 | `src/theme-engine.js` `apply()`（`--accent-text` 归还给主题） |
| 共享控件令牌 | `src/app.css`：`.nova-select` / `.engine-shell` / `.hero-scale` / `.appearance-framing` / `--accent-text` |
| 主题清单 / 样式 | `themes/<id>/theme.json` / `theme.css` |
| 数据根 / 隔离 | `Services/StoreService.cs` `AppPaths`（`NOVA_DATA_ROOT`） |
| Steam 时长 | `Services/SteamPlaytime.cs`、`StoreService.SyncSteamPlaytime` |
| 单 exe 引擎解压 | `Services/EngineBootstrapper.cs`、`ScalingEngine.BundledDirOverride` |
| **缩放窗口定位 / Magpie** | `Services/GameDisplay.cs` `ProcessFamily` / `FindMainWindow` / `TryMagpie` / `ScaledWindowIn`（§1.16）；延迟在 `NativeBridge.PresentGameWindow` |
| 发版流水线 | `tools/release.sh` + `verify-release.py` + `smoke-single.py` + `publish-release.py` |
| 无头截图 | `tools/headless-shots.js` + `tools/lib/headless-host.js` + `tools/lib/ui-views.js` |
| 扫描封面 URL | `NativeBridge.FileUrl` / `MapFileHost` / `CoverUrlFor`、`GameScanner.CacheRoots` |
| 挂机暂停 | `LauncherService.EnsureIdleTimer` / `SampleIdle` / `EffectiveSeconds` |
| 拖拽入库 | `MainWindow.OnWebDrop` → `NativeBridge.HandleFileDrop` → 前端 `onDropImport` |
| 托盘快速启动 | `MainWindow.ShowTrayIcon` / `RecentGamesForTray` / `LaunchFromTray` |
| 客户端安装探测 | `PlatformScanner.ClientInstalled`（会话缓存） |
| 静态对比度审计 | `tools/audit-contrast.js`（视图含 `import`） |
| 悬停对比度审计 | `tools/audit-hover.js`（视图含 `import`） |
| 截图 / 布局审计 | `tools/export-all.js`（视图含 `import`） |
| 完整设计规范 | `docs/THEME-DESIGN-SPEC.md` |
| **主题插槽契约** | `docs/THEME-INTERFACES.md` §16 |
| **共享插槽默认** | `src/theme-slots.css` |
| **每套主题的插槽映射** | `themes/<id>/interfaces.css`（内置 nova 在 `src/theme-nova.css`） |
| **契约守门** | `tools/theme-slot-check.js`（进 `release.sh`） |
| **像素比对** | `tools/pixel-diff.js` |
| **加速能力契约** | `docs/CAPABILITIES.md` |
| **能力路由 / 降级** | `src/capability/capability.js` |
| **GPU 取色 kernel** | `src/capability/gpu-palette.js`（WGSL） |
| **WASM 取色 kernel** | `wasm/palette/src/lib.rs` → `src/assets/nova_palette.wasm` |
| **性能基准** | `tools/perf-baseline.js` |
| **三后端一致性** | `tools/test-palette.js` |
| **GPU 崩溃自愈** | `MainWindow.xaml.cs` `DegradeToSoftwareRendering` |
| **名称自然序** | `src/app.js` `chineseNumber` / `nameParts` / `compareNames`（`NAME_TOKEN` 是词法） |
| **排序方向** | `src/index.html#libSortDir` → `app.js` `sortDir` / `syncSortDirection` / `SORT_DEFAULT_DIR`；落盘 `PlayerSettings.LibrarySortDir` |
| **排序控件样式** | `src/views.css` `.lib-dir`（三套主题在同名 `.lib-sort select` 规则里） |
| **整页截图（前端）** | `app.js` `exportScreenshot` / `releaseForExport` / `settleForExport` / `finishExport` |
| **整页截图（宿主）** | `NativeBridge.QueuePageCapture` / `CapturePageAsync` / `ScreenshotFolder` |
| **启动阶段计时** | `Log.Stage()`（`[+Nms]`），锚点 `Process.StartTime` |
| **单实例接管** | `App.xaml.cs` `StartAsOwner` / `ReadInstanceStamp` / `IsSameBuildOnDisk` |
| **游玩时长阶梯（1.16.3）** | `src/app.js` PLAYTIME LADDER 区块（`PLAYTIME_TIERS` / `playtimePct` / `applyTier` / `progTierAttrs`）；主题锚点 `themes/<id>/theme.css` 的 `--prog-l0..l5`；插槽契约 `docs/THEME-INTERFACES.md` §14/§16.4 |
| **阶梯验证工具** | `tools/tier-shots.js`（`?novaTierHours` 注入在 `tools/lib/headless-host.js`）；报告 `../_shots/tier/report.json` |
| **分享卡片（前端）** | `src/share-cards.css`（共享画布/装饰钩子）+ `src/app.js` SHARE CARDS 区块；弹窗 `src/index.html#shareOverlay` |
| **分享卡片（主题版式）** | `themes/<id>/interfaces.css` 的 `CARD CHARACTER` 块（nova：`src/theme-nova.css`）；契约 `docs/THEME-INTERFACES.md` §16.9 |
| **分享卡片导出（宿主）** | `NativeBridge.CapturePageAsync` 的 `exact` 参数；导出态 `html[data-share-export]` |
| **卡片截图工具** | `node tools/share-shots.js`（14 主题 × 3 版式 + 弹窗图） |
| **沉稳模式身份板** | `src/theme-slots.css` `.hero-inner::before`/`.sc-*`；每主题 `--im-plate-*` / `--im-chip-*` / `--im-topbar-ink` |
| **渲染端分片源码** | `src/app/*.js`（规则与分片地图：`src/app/README.md`；改代码改分片，直接改 app.js 会被拼装覆盖） |
| **分片拼装器** | `tools/build-app.js`（`--check` 进 release.sh 审计；headless-host 启动前自动拼装；relaunch.sh 自动拼装） |
| **架构总览** | `docs/ARCHITECTURE.md`（文件职责速查、CSS 层叠契约、构建链；下一轮先读它） |

---

## 10. 绝对不要回退的约定

### 结构与视觉

1. `html.is-nova-system` 的外观 / 面板规则必须限定在 `html[data-theme="nova"]`；
2. ZERO HOUR 主色青柠 `#c6ff2e`、次色青蓝 `#59e3ff`，黄色只给注意 / 警示；
3. SUMMER 不往角色脸上压黑色帆船 / 伞骨线稿；
4. `fit-content` 标题的可用宽度取父级文字列，不要取自身；
5. 不给 `.logo` 的 `letter-spacing` 做过渡；
6. 幕布第一次切换先画初始态再启动；
7. 主题顺序前四固定：GUGUOVA → 终末地 → 零点街区 → 秘典；
8. 全屏层禁用 `filter` / `backdrop-filter`；只动 transform / clip-path / opacity；
9. 缓存及时清理且不落 C 盘；
10. 自定义开屏舞台必须显式隐藏共享 `.intro-stage` / `.intro-corners` / `.intro-grain`；
11. DUSK 纸面正文一律墨色；封面取样与纸胶带不得进入文字列；
12. DUSK 不用发光魔法阵、粒子、霓虹；
13. **STEAM 不使用 Valve 素材**；绿色只给主按钮与「就绪」，红色只给缺失 / 删除；
14. **每套新主题先交静态构图稿，用户确认后再写 CSS**；
15. 示例库与截图里不允许出现真实游戏素材；
16. 技术标识（程序集命名空间、`NOVA Game Space`、`NOVA_*`、主题 id `nova`）不跟随品牌改名；
17. **平台徽标只用文字**，不引入第三方 logo / 品牌色；
18. **来源文案只有一个出口**：`platformOf` / `sourceLabel` / `platformShort`，
    任何界面不得再写 `source === 'steam' ? … : …`；
19. **入库窗口必须挂 `.engine-shell`**，复用 `--sheet-*`，不另起材质。

### 文字与控件

20. **正文 / 小字 ≥ 4.5:1，大字 ≥ 3:1**；静态与 hover/focus 两条审计都要 0 失败；
21. **accent 只做标记，不做小字**；文字用 `--accent-text` 或墨色；
22. **共享控件令牌必须齐全**：`--menu-*` / `--sheet-*` / `--mode-*` / `--af-*` /
    `--hs-*` / `--accent-text`；
23. **新增控件必须一次适配 14 套主题**；禁止系统原生 select / 消息框 / 文件框；
24. **算法行**是每主题独立选择卡；缺效果用虚线框 + 删除线，不用整体半透明；
25. **取景浮层必须不透明**；渐变面板补 `--af-solid`；
26. **主题用 `!important` 给 `.icon-btn` 上色时**，浅色弹窗必须用更高特异性覆盖；
27. **`.btn::before` 扫光层必须 `z-index: -1`**，否则纯文本按钮 hover 会变白块；
    改动后必须跑 `tools/audit-hover.js`；
28. **方形图标按钮**（`.icon-btn.square`）在浅色弹窗里必须显式给 rest/hover 前景；
29. **不要用 `opacity` 压字色**；父级与子级会相乘（`.hotkey-value`、分组计数都踩过）；
30. **弹窗内的焦点环用 `--sheet-ink`**，白色焦点环在纸面主题上等于没有。

### 启动 / 数据

31. **启动器等游戏窗口出现并置前后才最小化**；
32. **用户可见的名字一律 GUGUOVA**；
33. **Steam 启动走 `steam.exe -applaunch`**；提权修复只删 `RUNASADMIN`；
34. **平台启动走协议**，统一由 `GameLaunch.ModeFor` 解析；
    需要客户端的条目在进程出现后才记账，不要提前写 session；
35. **Magpie 快捷键按位域解码**（默认 3137），可随包分发但必须独立进程 + GPLv3；
36. **全屏缩放先看游戏自己的选择**；`scalingEngine=off` 时不得偷偷缩放；
    **自动启动引擎默认关**；
37. 外观取景编辑**只写 `HeroPosition` / `HeroZoom`**；
38. **启动界面只能 Esc 退出**（手柄 B 等价）；
39. **Steam 时长只取 max，不相加**；
40. **QA 工具切主题必须 `persist:false`**；
41. **改主题 CSS 必须 bump `theme.json` 的 version**；
42. **夜航游戏库宽屏 4 列、短窗 2 列**；
43. **主题自绘主视觉必须消费 `--nova-hero-position` / `--nova-hero-size`**；
44. **`#questCard` 默认隐藏是产品决定**；恢复活动通知时去掉 `hidden`；
45. **封面取色只用于内置 nova**；换主题时行内 `--accent` / `--accent-text`
    必须交还给主题（`theme-engine` 已处理）；
46. **首次启动提示只问一次**：任何出口都要写 `firstRunDone`；
47. **平台扫描只读**：不写注册表、不下载封面、不发网络请求；
48. **启动器本体不是游戏**：快捷方式扫描与拖拽都走 `ClientExeNames` 黑名单；

### 排序与截图（1.16.2）

49. **排序比较器一律按升序书写，方向用 `±1` 相乘**；不要写成"正序一个
    函数、倒序另一个函数"，也不要混用"数字比值 / 字符串比较"——那会破坏
    传递性，导致 `Array#sort` 结果抖动；
50. **名称排序的两条特殊规则不能删**：`第零五章`=0.5（以 `零` 开头且无单位
    的数字串按小数）、`第四半章`=4.5（数字段后紧跟 `半` 时 +0.5）。库里
    确实存在 Act0.5 与 Act4.5；
51. **换排序字段必须回到该字段的默认方向**，不要继承上一个字段的箭头；
52. **截图裁剪框取 `.app` 的矩形，永不取 `documentElement`**：背景层
    `.scene-stack` 故意 `inset:-3%`，按文档截会带上一圈背景画；
53. **`clip.scale` 传 1**：Chromium 自己乘设备缩放，传 `devicePixelRatio`
    是二次放大；
54. **导出用的临时样式必须是行内 `!important`，并逐条记录原值与优先级逆序
    还原**；不要用"加一个 class 再删"的做法，主题里 `html[data-theme] …
    !important` 会压过它；
55. **测量高度前必须等字体与图片 decode**（`settleForExport`），否则最后
    一行卡片会被切半。
49. **挂机暂停是默认行为**（`IdlePauseMinutes` 默认 10）：结算用 `EffectiveSeconds`，
    不要回退成裸墙钟；0 = 关；
50. **扫描/托盘/拖拽里拒绝启动器客户端**；Xbox 条目不提供「直接启动」。

### 构建 / 发布

48. **legacy (net48) 不支持 C# 8 的 range / index 语法**（`x[..n]`、`x[^1]`）；
49. **Magpie 永远独立进程**：内嵌只打包成 zip，解压后再 `Process.Start`；
50. **单 exe 的解压目录必须带 `.complete` 标记**；
51. **文件夹包优先于内嵌**：`engine\magpie\` 在 exe 旁边时必须直接用它；
52. **发版必须走 `tools/release.sh`**；改过数据层代码要跑 `smoke-single.py`；
53. **`NOVA_DATA_ROOT` 会切换单实例锁**；测试脚本不要假设只有一个进程。

---

## 11. 快速命令

```bash
cd nova-game-space-desktop

./tools/relaunch.sh                        # 构建 + 同步主题 + 启动（CDP 9223）

# 无头 QA（本机 WebView2 需要关沙箱 + 软件渲染）
NOVA_DATA_ROOT="D:/tmp/guguova-import" NOVA_CACHE_ROOT="$(pwd)/.cache/webview2" \
NOVA_CDP_PORT=9333 NOVA_WEBVIEW_ARGS="--no-sandbox --disable-gpu" \
./bin/Debug/net10.0-windows/win-x64/GUGUOVA.exe &

# 无头截图（不需要宿主、不需要数据目录）
node tools/headless-shots.js                        # 核心界面
node tools/headless-shots.js --views=all --workers=4
node tools/headless-shots.js --themes=endfield,dusk --views=import,settings --sizes=960x600
node tools/headless-shots.js --format=png --open

# 游玩时长阶梯验证（1.16.3）：14 主题 × 7 档 × 3 视图 + 色值断言
node tools/tier-shots.js                            # 全量
node tools/tier-shots.js --themes=endfield --hours=60,11000 --shots=false

# 对比度审计（仍走真实宿主，因为要读实际渲染色）
NOVA_CDP_PORT=9333 node tools/audit-contrast.js
NOVA_CDP_PORT=9333 node tools/audit-hover.js --views=home,settings,detail,import
NOVA_CDP_PORT=9333 node tools/export-all.js --views=all --sizes=1439x1124,960x600 --stress

NOVA_CDP_PORT=9333 node tools/drive.js "return await window.nova.call('platformSummary');"
NOVA_CDP_PORT=9333 node tools/drive.js "return await window.nova.call('scanLibrary');"

# 整页截图功能的实机验证（legacy 单文件包的 WebView2 SDK 不接受 CDP 端口，
# 必须用现代构建；GUI 子进程会被 shell 结束时回收，所以 spawn + 驱动要在
# 同一个进程里做）
NOVA_CDP_PORT=9223 NOVA_CACHE_ROOT="$(pwd)/.cache/webview2" \
  ./bin/Release/net10.0-windows/win-x64/GUGUOVA.exe &
# 然后 CDP：点击 #shotBtn → 看 nova.log 的 capture 行 → 看 图片\GUGUOVA\*.png

bash tools/release.sh --version 1.16.2 --publish --skip-smoke
```

Git / PR：`gh` 未安装；用 credential manager 的 token 走 GitHub API 建 PR / 合并 / 发 Release。

---

## 12. 已知限制与风险

- **Epic / Ubisoft / EA / Xbox / 战网在本机都没有安装**，代码只做了静态验证；
  首次真机会暴露字段名或路径差异，优先看 `nova.log` 的 `platform scan` 行。
- **Xbox 的 AUMID** 依赖 `AppModel\Repository\Packages` 里能查到
  `PackageFamilyName`；查不到时启动会失败并弹「无法唤起启动地址」。
- **Epic `.item` 的 `LaunchExecutable` 可能是相对根目录的路径**；
  解析失败会退回目录扫描，个别 DLC 会被当成主游戏。
- **Ubisoft 注册表没有显示名**，条目名来自安装目录名（如 `Far Cry 5`）。
- **平台条目没有本地封面**，只有图标生成的封面，标题排版可能偏素。
- **战网 / EA 的部分标题**走直接 exe，客户端可能仍会弹登录。
- **DUSK 的主按钮**本轮改了渐变；如果后续主题卡要求「陶土浅端」，
  必须同时给出 ≥4.5:1 的字色，否则回退。
- **`--accent-text` 现在由 JS 在 nova 上按对比度提亮**；纯 CSS 静态检查
  （不跑 JS）看到的是 `var(--accent)`，别误判。
- **WebView2 在本机会 `GpuProcessExited`**：必须 `--no-sandbox --disable-gpu`，
  否则 CDP 端口活不过 3 秒。
- **`audit-contrast` 的 `layered` 项**仍需人眼复核（弹窗渐变面、主视觉上的字）。
- **Steam 时长是分钟粒度**；刚启动/刚退出的几分钟可能滞后。
- **全屏缩放只对窗口化游戏有效**；Magpie 需要 Win10 1903+。
- 本轮未在 Win7、真实 Steam 登录态、另一台无 Magpie 机器上验证。
- **整页截图只在游戏库视图做过实机验证**（1439×899 / 125%）。首页 / 外观 /
  设置走的是同一套 `exportScroller()` 自动判定，但滚动容器不同，未逐一验证。
- **截图上限 20000 CSS px**，超过直接报错；`scale` 固定 1，125% 屏幕输出
  1.25 倍像素，200% 屏幕就是 2 倍——像素总量随屏幕缩放增长，超长页面在
  4K + 200% 下可能接近内存上限（60 MP 阈值会把它降到 1 倍，但那时是
  1 CSS px : 1 px，会偏软）。
- **`capturePage` 是"立即回包 + 异步通知"**：桥的返回只表示"已排队"，
  真正的结果在 `screenshot-done` 里。别在 `call()` 之后直接读结果。
- **legacy 单文件包（WebView2 SDK 1.0.1774）不接受 `--remote-debugging-port`**，
  调试截图功能要用 `bin/Release/net10.0-windows/win-x64/GUGUOVA.exe`。
- **两个不同文件名的包无法互相接管**（`KillGuguova` 会校验映像名），
  做 A/B 测试时先 `taskkill` 再启动，否则会卡在"another instance holds the
  profile"然后自己退出。

---

## 13. 历史与 PR

| 版本 | 内容 |
| --- | --- |
| 1.9.0 | DUSK / STEAM / NIGHTFLIGHT 三套主题重做；16 个音效重合成 |
| 1.10.0 | Steam 提权修复、窗口置前、启动器退场、全屏缩放 |
| 1.11.0 | 内置轻量 Magpie、快捷键录制、简化引擎弹窗、`.nova-select` |
| 1.12.0 | Steam 封面取原图（按分辨率挑选 + 只降不升） |
| 1.13.0 | Steam 时长同步、主题文案词典、全主题控件/文字精修、设计规范 + skill |
| 1.14.0 | 缩放引擎选项对齐 Magpie、文案清理、hover/focus 白块与图标修复、`audit-hover` |
| 1.14.1 | 单文件 exe：内嵌主题、前端资源与 Magpie 引擎 |
| 1.14.4 | 流水线式打包：`release.sh` + verify + smoke + publish；`NOVA_DATA_ROOT` |
| 1.15.0 | 多平台入库（Epic/GOG/Ubisoft/EA/Xbox/战网）、首次启动提示、添加游戏先选路、入库窗口 14 主题适配、`import` 视图进入三条审计 |
| **1.16.0** | **接口式映射架构（主题零主代码改动）；可选加速层 WebGPU+WASM 三档降级；GPU 崩溃自愈；Steam 时长同步移出冷启动；新增 `perf-baseline` / `test-palette` / `theme-slot-check` / `build-wasm` 四个守门工具；修 nova 取色两处对比度** |
| 1.16.1 | 编辑器补齐（路径即输即预览、资料格式化、路径栏可输入、收藏角标，PR #30/#31/#32）；用户回访四修 + 检查更新（PR #29）；实例接管策略 |
| **1.16.2** | **名称自然序 + 升降序切换（PR #34）；整页长截图导出（PR #34）；同包启动不再杀热实例、首启解压移到闪屏之后、`pack-assets` 可复现、`Log.Stage` 宿主计时（PR #33）** |
| **1.16.3** | **游玩时长进度条里程碑变色：21 节点（50→10000h）× 每主题 6 锚点（`--prog-l0..l5`）HSL 最短弧插值；填充宽度改「指向下一节点」；纯色平涂 + 宽弧重排（Owner 两轮回访）；详情页下一阶段预告；`tools/tier-shots.js` 验证工具（98 组检查 0 失败）；13 套主题 + nova 全部 bump；PR #35，已发布 v1.16.3** |

---

## 14. 交接清单

本轮（1.16.3）：

- [x] `src/app.js` PLAYTIME LADDER 区块（里程碑表 / 区间填充 / 阶梯解析 / 发布），五处渲染点接线，40h 旧公式清零；
- [x] `src/base.css` + `src/theme.css` 五条轨道消费 `--prog-*`（fallback 原值）；`theme-nova.css` 消费 + `BUILT_IN` 2.0.1；
- [x] 13 套主题锚点声明 + 轨道颜色位替换 + `theme.json` 全部 patch +1；
- [x] docs 登记（`THEME-INTERFACES.md` §14/§16.4、`THEME-DESIGN-SPEC.md` §3.1）；
- [x] `tools/tier-shots.js` 新工具 + headless-host `?novaTierHours` 注入；
- [x] tier-shots 98 组检查 0 失败（294 张截图在 `../_shots/tier/`）；
- [x] `theme-slot-check --strict` 0 finding；双目标构建 0 错误；
- [x] `headless-shots --views=all` 回归：唯一警告（aurum 磁贴名 5px）经基线对照确认为既有问题；
- [x] 版本 1.16.3 全链同步（version.json / 两个 csproj / index.html 30 处）；
- [x] PR [#35](https://github.com/118coder/guguova-game-space/pull/35) 合并（`5dd0421`，含滞留的 1.16.2 交接文档）；
- [x] 发行 `v1.16.3`：single.exe 9.48 MB / legacy-single 13.69 MB / legacy-full 17.09 MB；verify 通过，smoke 按约定跳过（未改数据层）。

本轮（1.16.5，工作区待提交，详见 §1.17）：

- [x] 真实 DNF 实机验收：全屏 / 2.5 倍 / 像素算法三场景全部 `scaled=True`，窗口像素尺寸为证；
- [x] 倍数缩放（Magpie 窗口化缩放 1.25–3×）、缩放算法按名称生效、主页与引擎弹窗勾选框；
- [x] 孤儿服务端清理（`launcher orphan killed` 连验三次，7001 每次释放）；
- [x] 双目标编译 0 错误、theme-slot-check 0 finding、feature-checks 41/41、tier-shots 98 组、headless-shots 0 新增警告；
- [x] 版本 1.16.5 全链同步；用户数据整体备份登记；Magpie 配置测试后还原；隔离数据根直接删除；
- [x] 提交 / PR / 发行：`b20e14f` → PR [#36](https://github.com/118coder/guguova-game-space/pull/36) → 合并 `bbdd2d0` → 发布 `v1.16.5`；
- [x] 发行资产：`single.exe` 9.51 MB `e282ee84ac5c…`、`legacy-single.zip` 13.71 MB `ffaeda6ce491…`、`legacy-full.zip` 17.11 MB `0fac45be8d1e…`；verify 与单文件冒烟通过；
- [ ] Owner 提权旧实例退出后删除归档 `03-归档备份\old-build-1.16.4\` 里的 `GUGUOVA.old.exe` / `GUGUOVA.old.dll`。

本轮（第四轮 · 沉浸模式机制，**工作区未提交**，详见 §1.18）：

- [x] 参考图分析：单侧压暗、极简顶栏、左侧信息层级、卡片横排放下方；不照搬真实游戏素材；
- [x] `src/theme-slots.css` 沉浸骨架（左侧安全区 / 单侧 veil / 底部横排卡片带 / 顶栏压低），JS 零改动、窗口模式零影响；
- [x] 13 份 `interfaces.css` + `src/theme-nova.css` 各写一套 `--im-*` 材质值（浅色主题用浅色 veil）；
- [x] 缩放勾选框参数化 `--hs-check-*` 并 14 套各给形态；`engineScaleRow` 脱离通用 `.pref-row`；
- [x] 主页 / 引擎弹窗 hint 显示「全屏缩放」或「倍数缩放 X 倍」，`.hero-scale-hint` 允许换行；
- [x] 修掉共享层放大字标导致 endfield 标题挤出铭牌的回归；
- [x] `theme-slot-check` 新增 `--im-` / `--hs-check-` 守门；`feature-checks` 新增第 [9] 组 6 项；
- [x] 双目标编译 0 错误、守门 exit 0、feature-checks 47/47、tier-shots 98 组、headless-shots 0 新增警告；
- [x] 14 张真实沉浸截图 `_shots/immersive-real/`（含 `contact-sheet.jpg`），逐套 `overflowX=0`；
- [ ] **14 套沉浸外观深化（Owner 叫停，等定稿方向）**；构图稿保留但不采纳；
- [ ] 沉浸模式形态回访（§1.19.6：图标条是否要"选中放大 + 外发光"联动、横条是否要新装饰）；
- [ ] 本轮改动提交 / bump 版本 / PR / 发行（等 Owner 确认）。

本轮（第九至十一轮 · 沉浸＝沉稳模式 + 图标带自适应，**已合并 PR #37**，详见 §1.23）：

- [x] 语义修正：288 处 `is-fullscreen` → `calm`；`immersiveHome()` 判据换成 `state.settings.calm`；
- [x] 全屏恢复成原来的无边框全屏页（大标题 + 正常卡片带 + 按键提示），不再被换成沉浸版式；
- [x] 图标带高度改为运行时实测（`syncDockHeight()` + ResizeObserver → `--im-dock-h`），舞台预留空间；
- [x] `tools/layout-fit.js` 六档分辨率 × 4 主题 × 长标题 **24/24**，间隙 12–18px；
- [x] `tools/immersive-audit.js` 196/196、`verify-hidden` 7/7、`feature-checks` 60/60、`theme-slot-check` exit 0；
- [x] `ThemeService.IsBundledNewer` 改为比较目录内最新文件时间（此前改主题 CSS 在实机上不生效）；
- [x] 用户主题目录两次整体备份（`../backups/themes-before-reseed-20261110-2020/`、`themes-before-calm-2036/`），SUMMER 1.8.15 已还原；
- [x] 提交 → PR [#37](https://github.com/118coder/guguova-game-space/pull/37) → squash 合并 `fcbcfe1`；
- [ ] **不发行**（Owner 要求）：版本仍 1.16.5，无 tag、无 Release；
- [ ] 14 套主题 `theme.json` version 未 bump，发版时统一处理；
- [ ] 图标带卡片形状/名字排布未定稿（Owner 认为「框太丑」）。

本轮（第十四轮 · 文件解耦与代码整合，重构轮，**已合并 PR #40**，详见 §1.26）：

- [x] `src/app.js`（9802 行）→ `src/app/` 29 分片：切片拼装字节级一致验证 + git diff 仅 203 行注释插入 + feature-checks 全过；
- [x] `tools/build-app.js` 拼装器 + 五处接线（headless-host / relaunch.sh / release.sh 审计 / pack-assets 排除 / legacy csproj 排除）；
- [x] `src/app/README.md` 分片地图；`docs/ARCHITECTURE.md` 架构总览（新建）；
- [x] C# 三大文件 partial 拆分（NativeBridge ×10 / LauncherService ×3 / ScalingEngine ×3），多重集校验零逻辑变更，双构建 0 错误、警告逐条一致，legacy csproj 补 10 条编译引用；
- [x] tools 清理：4 个零引用 tmp 探针 + `__pycache__` 删除；pipeline.sh 保守保留（3 处未收编差异已记录）；一次性脚本盘点表；
- [ ] `pipeline.sh --modern` 收编进 release.sh（P2 原项延续）；
- [ ] 盘点表中「疑似一次性」脚本去留等 Owner 拍板。

未完成（下一轮）：

- [ ] **1.16.3 实机回访**（§7 P0-0，已发行；broadcast 的 REC 红要 Owner 拍板）；
- [ ] 1.16.2 的排序 / 截图实机回归（§7 P0-1，沿用）；
- [ ] 14 套主题下的排序方向按钮观感（1.16.2 沿用）；
- [ ] Epic / Ubisoft / EA / Xbox / 战网真机；
- [ ] Steam 登录态全流程；
- [ ] 另一台无 Magpie 机器的引擎真机；
- [ ] Win7 + WebView2 109；
- [ ] aurum 磁贴名 5px 裁切（既有，基线已确认）。

上一轮（1.16.2，已发布）留存：

- [x] 双目标编译通过；版本号 1.16.2 全链同步；dusk / nightflight / steam bump；
- [x] PR #34（排序 + 截图）与 PR #33（启动）合并，发布 `v1.16.2`（smoke 按约定跳过）；
- [x] 整页截图实机验证（游戏库视图）；名称排序按真实库 21 条 DNF 逐条推演；
- [ ] 未了项已并入上面「未完成（下一轮）」清单。

下一轮从 **§1.19** 开始：沉浸模式已按「封面就是页面」重构并跑完三类回归，等 Owner 看过
14 张截图（`_shots/immersive-layout/`）后决定是否再加强图标条联动与横条装饰；
改动仍在工作区待提交，未 bump、未发行。
其余沿用：Owner 旧实例退出后删归档里的两个 `.old` 文件、§7 的实机回访；
平台真机（P0-2）仍是最大空白。
