# NOVA 原生

> 版本 **2.0.0** · 开屏 `gilded` · 进游戏 `nvLaunch（变形宽银幕细缝）`

## 1. 设计理念
电影感主视觉：整屏封面、暖色辉光、金属字标；主题本身不覆盖布局，只负责默认外观。

## 2. 视觉令牌
- 配色：封面自适应；默认暖橙 #ffa477 / 珊瑚 #ff6f6f；深色电影底。
- 字体：思源黑体 Medium（UI/标题）+ 思源宋体（衬线字标）；8 套字标配方靠字重/字距/描边区分。
- 签名元素：全屏封面 + 左下暗角 + 金色字标；没有额外几何装饰。

## 3. 按钮与控件
默认 CTA：封面取色渐变 + 柔和高光；ghost 为细描边。

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
- 开屏：`gilded`，舞台类与关键帧在 `src/intro.css`。
- 进游戏：`nvLaunch（变形宽银幕细缝）`，规则在 `themes/nova/theme.css` 末尾（或 `src/motion.css`）。
- 两者必须互不相同；新增时同步 `src/intro.js` 的 `STAGE_SELECTOR`。

## 6. 本轮记录
内置主题，无 theme.css；本轮只新增 launch 动画与新的 gilded 开场，视觉基线保持。

## 7. 验收
- `export-all.js`：无 `overflow-x` / `clipped` / `logo-text-over`
- 30 字长名（`--stress`）不溢出；960×600 与 1439×1124 两档都过
- `probe-graphics.js` 装饰不压字
