# 舞台残响 · RIOT

> 版本 **1.5.3** · 开屏 `vinyl（黑胶升速）` · 进游戏 `rtDrop（唱片落盘）`

## 1. 设计理念
唱片封套：左纸右图，黑胶直接浮在纸面上（透明底、无白窗），右侧角色立绘与灰墨泼溅；红只留在标题硬偏移、按钮硬影、唱片红环与导航选中。

## 2. 视觉令牌
- 配色：纸白 #f4f1ea / #fbf7ee；墨黑 #111111；朱红 #e2001a。
- 字体：思源黑体 Medium（标题/正文）+ 思源宋体（手写旁注的替身）；标题用字距与硬阴影制造乐队海报感。
- 签名元素：黑胶 + 连续红环、红色硬偏移标题、泼溅、角色右缘显影。

## 3. 按钮与控件
黑块 + 红硬影（主）/ 白底黑框（次）。

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
- 开屏：`vinyl（黑胶升速）`，舞台类与关键帧在 `src/intro.css`。
- 进游戏：`rtDrop（唱片落盘）`，规则在 `themes/riot/theme.css` 末尾（或 `src/motion.css`）。
- 两者必须互不相同；新增时同步 `src/intro.js` 的 `STAGE_SELECTOR`。

## 6. 本轮记录
本轮 v3：镜像回原图（字左、唱片右、角色右缘）；恢复白纸；红环改成一整笔；长名两行。
v3.1：删除白色唱片窗（白底/黑条/网点）与压在角色上的大红螺旋；SVG 改透明底，唱片浮在纸面。

## 7. 验收
- `export-all.js`：无 `overflow-x` / `clipped` / `logo-text-over`
- 30 字长名（`--stress`）不溢出；960×600 与 1439×1124 两档都过
- `probe-graphics.js` 装饰不压字
