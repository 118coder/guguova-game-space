# 零点街区 · ZERO HOUR

> 版本 **1.0.9** · 开屏 `zerohour（CRT 信号接入）` · 进游戏 `zhLaunch（CRT 同步）`

> 完整设计理念与维护要点：`docs/DESIGN-PHILOSOPHY.md` §5.4

## 1. 设计理念
街区命令台：黑底、CRT 扫描线、L 形青柠角标、分段信号轨。

## 2. 视觉令牌
- 配色：近黑 #05060a；荧光青柠 #c9f73a；警示黄 #ffd60a；品红。
- 字体：思源黑体 Medium（全篇）；数据使用 tabular-nums，大写字段保留硬边。
- 切换编舞：漫画分页——黑板从左侧压入，白框分镜从右下斜切落下，中央贯穿青柠字幕带 + 速度线；
  主文字青柠、眉标青蓝，不使用黄色字。
- 签名元素：扫描线、分段轨、斜纹面板、L 形角标。

## 3. 按钮与控件
黑底 + 青柠描边；选中态为青柠实块。

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
- 开屏：`zerohour（CRT 信号接入）`，舞台类与关键帧在 `src/intro.css`。
- 进游戏：`zhLaunch（CRT 同步）`，规则在 `themes/zerohour/theme.css` 末尾（或 `src/motion.css`）。
- 两者必须互不相同；新增时同步 `src/intro.js` 的 `STAGE_SELECTOR`。

## 6. 本轮记录
保留区。本轮只新增 launch 动画；视觉未改。

## 7. 验收
- `export-all.js`：无 `overflow-x` / `clipped` / `logo-text-over`
- 30 字长名（`--stress`）不溢出；960×600 与 1439×1124 两档都过
- `probe-graphics.js` 装饰不压字
