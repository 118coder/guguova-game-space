# 星轨秘典 · CODEX

> 版本 **1.7.2** · 开屏 `codex（星轨展开）` · 进游戏 `cxIris（菱形虹膜）`

> 完整设计理念与维护要点：`docs/DESIGN-PHILOSOPHY.md` §5.5

## 1. 设计理念
单栏“安静铜版”：深褐纸面、极淡竖纹、细双线；背景是一枚巨大的暗淡罗盘，正文像档案正文。

## 2. 视觉令牌
- 配色：深褐 #160f0a / #1c130d；铜金 #e2c78e；酒红 #8a2f28；米白 #f0e4cc。
- 字体：思源宋体 Medium（标题）+ 思源黑体 Medium（正文）；标题金色，正文无衬线保证小字号可读。
- 签名元素：铜金细双线、罗盘/星图、酒红菱形分隔；无插画窗。

## 3. 按钮与控件
羊皮纸/金线；主按钮为浅金底、深褐字；ghost 为金线描边。

## 4. 可复用接口
| 接口 | 作用 | 备注 |
|---|---|---|
| `.hero-inner` | 主视觉板；主题用 `::before` 画底、`::after` 画插画/肖像 | 文字必须留在板内 |
| `.hero-logo` | 当前游戏名；长名由 `.is-long-title` 切换两行规则 | `font-size` 必须乘 `var(--logo-fit,1)` |
| `.kicker / .tagline / .meta-row` | 眉标 / 正文 / 属性行 | 主题必须保证对比度 |
| `.progress-block` | 时长/进度；可改造成属性表 | 文字不得被伪元素覆盖 |
| `.cta-row .btn` | 主/次按钮 | 主题各自定义，不继承统一按钮 |
| `.activity-strip` | 辅助入口；多套主题已隐藏 | 与 dock 重复时优先删除 |
| `.scene / .scene > img` | 游戏主视觉层 | 只有 `html[data-theme="<id>"] .scene > img` 能压过框架的 `.scene.is-active > img` |
| `--nova-hero` | 当前游戏主视觉 URL（运行时写入） | 可用于肖像卡/印版照片 |
| `--nova-record / --nova-no / --nova-hours` | 真实档号/时长 | 由 `src/fx-record.js` 发布 |
| `--nova-*`、`--kit-*`、`--t-*` | 主题令牌 | 见统一文件 |

## 5. 开屏与进游戏
- 开屏：`codex（星轨展开）`，舞台类与关键帧在 `src/intro.css`。
- 进游戏：`cxIris（菱形虹膜）`，规则在 `themes/codex/theme.css` 末尾（或 `src/motion.css`）。
- 两者必须互不相同；新增时同步 `src/intro.js` 的 `STAGE_SELECTOR`。

## 6. 本轮记录
本轮小修：封面压成低饱和深褐、加罗盘与暗角；红菱形 metadata；长名两行。

## 7. 验收
- `export-all.js`：无 `overflow-x` / `clipped` / `logo-text-over`
- 30 字长名（`--stress`）不溢出；960×600 与 1439×1124 两档都过
- `probe-graphics.js` 装饰不压字
