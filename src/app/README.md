# src/app/ — 渲染端分片（app.js 的真实源码）

`src/app.js` 是渲染端的**单一 IIFE 闭包**：一个 `<script>` 标签、一份共享作用域，
全站的状态、函数互相直接引用。它原本近 9800 行，无法维护，于是按职责切成
本目录的分片。**分片共享同一个闭包**，所以不能改成多个 `<script>` 标签或
ES module——`tools/build-app.js` 按文件名序把它们拼回 `src/app.js`，运行时
行为与拆分前逐字节一致（拆分当轮用字节比对验证过）。

## 规则

1. **改代码只改分片**。改完运行 `node tools/build-app.js` 重新拼装；
   直接改 `src/app.js` 会在下次拼装时被覆盖。
2. **分片文件名带两位数字前缀**（`01-runtime.js` … `29-boot.js`），前缀就是
   拼装顺序。新增分片按依赖关系插号，不要重排现有顺序——拼装顺序即原文件
   的区块顺序，函数声明提升（hoisting）依赖它。
3. **每个分片头部有职责说明**；跨分片引用是常态（例如 `14-library` 用
   `11-playtime` 的 `progTierAttrs`），这是闭包架构的既定事实，不要为
   「解耦」而引入 `window.NovaXxx` 全局——那是给 `intro.js` / `overlays.js`
   这类**独立脚本**的模式，不是分片的模式。
4. 每个分片文件以一个换行结尾；`build-app.js` 会自动补齐。

## 拼装链路

| 入口 | 时机 |
| --- | --- |
| `node tools/build-app.js` | 手动 / 改完分片后 |
| `tools/lib/headless-host.js` | 所有无头 QA 启动前自动拼装 |
| `tools/relaunch.sh` | 开发重启前自动拼装 |
| `tools/release.sh --check` | 发行审计时校验 `src/app.js` 未过期 |
| `tools/pack-assets.py` | 打包时**跳过本目录**，只装拼装产物 `src/app.js` |

## 分片地图（拼装顺序）

| 分片 | 行数 | 职责 |
| --- | --- | --- |
| `01-runtime.js` | 150 | 运行时地基：IIFE 开启、use strict、原生桥消息通道（`call` / 事件分发）、`window.nova` 引导 |
| `02-state.js` | 106 | 全局状态 `state`：库、设置、视图、选中、live 签名等单一事实源 |
| `03-dom.js` | 390 | DOM 引用缓存 `els`：一次性集中 querySelector，全站复用 |
| `04-type.js` | 524 | 字标导演 TYPE DIRECTOR：按封面/主题解算标题字标方案 |
| `05-audio.js` | 293 | 音效 AUDIO：合成、播放、cue 集与静音偏好 |
| `06-utils.js` | 44 | 通用工具函数（格式化、防抖、颜色基础等） |
| `07-name-order.js` | 131 | 名称自然序：中文数字解析与比较器；含「第零章=0.5」「半章=+0.5」两条库里实证特例（不可删，铁律 50） |
| `08-export.js` | 161 | 整页长截图导出：`releaseForExport` / `settleForExport` / `finishExport`（裁剪框取 `.app`、`clip.scale=1`，铁律 52/53） |
| `09-share-cards.js` | 544 | 分享卡片：相机键三规格画布（poster/dossier/score）、导出与弹窗 |
| `10-accent.js` | 278 | 强调色解算（可读对比度、CTA 底字配对）+ 背景层 BACKDROP |
| `11-playtime.js` | 236 | 游玩时长里程碑阶梯：21 节点区间语义、HSL 最短弧插值、`--prog-*` 变量发布（1.16.3） |
| `12-hero.js` | 303 | 首页主视觉 HERO + 选中 SELECTION + 图标带 RAIL（货架语义：隐藏游戏不参与） |
| `13-views.js` | 87 | 视图切换 VIEWS + 布局模式 LAYOUT MODE（横排/竖排） |
| `14-library.js` | 237 | 游戏库列表：筛选/排序/类型/隐藏、卡片渲染与 live 原地修补 |
| `15-details.js` | 581 | 游戏详情页 + 管理面板 MANAGE（统计、Steam 启动、隐藏开关） |
| `16-appearance.js` | 309 | 外观工作室：取景浮层、封面定位/缩放（只写 `HeroPosition`/`HeroZoom`，铁律 37） |
| `17-settings.js` | 53 | 设置页：本地身份、离线数据、游玩历史 |
| `18-steam.js` | 891 | Steam 提权 / Magpie 缩放引擎桥接（快捷键位域、窗口化倍数、算法写入） |
| `19-update.js` | 226 | 检查更新：GitHub Releases，全应用唯一联网功能（默认关） |
| `20-prefs.js` | 292 | 偏好开关（声音/动效/全屏/休眠）+ 通知 NOTIFICATIONS |
| `21-launch.js` | 426 | 启动管线：分离启动器、进程附着、会话与覆盖层文案 |
| `22-editor.js` | 446 | 编辑器：表单/保存/封面预览 + 格式化资料 DOSSIER（14 标签导出导入） |
| `23-themes.js` | 576 | 主题管理：清单读取、切换、播种与主题弹窗 |
| `24-context.js` | 246 | 右键菜单（定位被右键的游戏）+ 清单采纳 MANIFEST ADOPTION |
| `25-import.js` | 583 | 入库窗口 IMPORT SHEET + 扫描器 SCANNER + 库变更重建 |
| `26-input.js` | 504 | 键盘 KEYBOARD + 手柄适配 GAMEPAD ADAPTER |
| `27-immersive.js` | 287 | 沉稳模式双焦点行导航（键盘与手柄共用）+ 长按强杀 FORCE KILL |
| `28-events.js` | 573 | 主按钮 PRIMARY ACTION + 全部事件委托 EVENTS |
| `29-boot.js` | 326 | 启动序列 BOOT + `window.nova` 完整出口 + IIFE 收口 |

行数为拆分当轮（1.16.5 工作区）的快照，仅供体量参考；以文件为准。
