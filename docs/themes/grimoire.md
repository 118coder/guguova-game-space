# 冒险者档案 · GRIMOIRE

> 版本 **1.5.1** · 开屏 `seal（归档盖章）` · 进游戏 `grStamp（火漆盖章）`

## 1. 设计理念
冒险者档案：深色装帧 + 羊皮纸角色卡；左侧真实游戏主视觉装进金框，右下压小蜡封，右侧是属性与档案正文。

## 2. 视觉令牌
- 配色：深褐 #120b06 / #1d140e；羊皮纸 #f1e4c6；酒红 #7a1f2b；金 #b08a3e。
- 字体：Cormorant Garamond + Songti/SimSun；标题衬线 600。
- 签名元素：金框肖像、双线金框、酒红缎带、红菱形、档号蜡封、金色藤蔓。

## 3. 按钮与控件
酒红 + 金内线 + 硬偏移（主）/ 羊皮纸金线（次）。

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
- 开屏：`seal（归档盖章）`，舞台类与关键帧在 `src/intro.css`。
- 进游戏：`grStamp（火漆盖章）`，规则在 `themes/grimoire/theme.css` 末尾（或 `src/motion.css`）。
- 两者必须互不相同；新增时同步 `src/intro.js` 的 `STAGE_SELECTOR`。

## 6. 本轮记录
本轮 v6 重做：肖像回到左侧、文字右侧；删除巨大蜡封；活动条删除；背景压暗 + 藤蔓；长名两行。

## 7. 验收
- `export-all.js`：无 `overflow-x` / `clipped` / `logo-text-over`
- 30 字长名（`--stress`）不溢出；960×600 与 1439×1124 两档都过
- `probe-graphics.js` 装饰不压字
