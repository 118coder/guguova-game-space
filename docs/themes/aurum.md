# 鎏金圣所 · AURUM

> 版本 **1.0.12** · 开屏 `aurum（金门展开）` · 进游戏 `auLaunch（菱形光圈）`

> 完整设计理念与维护要点：`docs/DESIGN-PHILOSOPHY.md` §5.2

## 1. 设计理念
暗色圣所：羊皮纸铭牌、双层金线、青玉能量点；强调“仪式感”而不是科技感。

## 2. 视觉令牌
- 配色：墨绿铁底 #070b0a / #131a15；鎏金 #e0bd7e；青玉 #5fd6c6。
- 字体：思源宋体（标题，宽字距）+ 思源黑体 Medium（正文）；金色标题、墨绿纸面。
- 签名元素：金色双线框、菱形、青玉小点；高对比金/墨绿。

## 3. 按钮与控件
金线描边 + 深底；主按钮为暗金渐变；禁止圆角过大。

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
- 开屏：`aurum（金门展开）`，舞台类与关键帧在 `src/intro.css`。
- 进游戏：`auLaunch（菱形光圈）`，规则在 `themes/aurum/theme.css` 末尾（或 `src/motion.css`）。
- 两者必须互不相同；新增时同步 `src/intro.js` 的 `STAGE_SELECTOR`。

## 6. 本轮记录
保留区。本轮只新增 launch 动画与 aurum 开场结构；主视觉未改。

## 7. 验收
- `export-all.js`：无 `overflow-x` / `clipped` / `logo-text-over`
- 30 字长名（`--stress`）不溢出；960×600 与 1439×1124 两档都过
- `probe-graphics.js` 装饰不压字

## 8. 导航选中态
选中标签不再使用羊皮纸实块：改为**直角双层金线框**（外 1px / 内 4px 两道），
底部居中一枚青玉菱形点。与「金线 + 青玉」的语言一致，也不再出现圆角纸块压字。
实现见 `themes/aurum/theme.css` 末尾的 `html[data-theme="aurum"] .nav-glide` 段。
