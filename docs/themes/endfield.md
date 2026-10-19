# 终末地 · ENDFIELD

> 版本 **1.0.5** · 开屏 `endfield（启动序列）` · 进游戏 `efLaunch（工业闸门）`

> 完整设计理念与维护要点：`docs/DESIGN-PHILOSOPHY.md` §5.3

## 1. 设计理念
工业纸面：纸白底、酸黄信号、切角按钮、细线与真实编号；像现场终端而不是游戏启动器。

## 2. 视觉令牌
- 配色：纸白 #f4f4f2；酸黄 #fffa00；墨黑 #161616。
- 字体：思源黑体 Medium（全篇）；大写字段、编号与工业标签。
- 签名元素：三色顶带、制图网格、实心/空心双字标、编号字段。
- 切换编舞（按 `endfield-ui` 规则）：纸面板从左横扫，前缘 38px 切角，酸黄立边，
  顶部品红/酸黄/薄荷三色条；入场 snap、出场 mech，保持短促机械感。
  开屏同样保留宽体大写眉标 + 粗体中文、真实日期/时间/游戏数。

## 3. 按钮与控件
切角矩形；主按钮酸黄底黑字；ghost 细线。

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
- 开屏：`endfield（启动序列）`，舞台类与关键帧在 `src/intro.css`。
- 进游戏：`efLaunch（工业闸门）`，规则在 `themes/endfield/theme.css` 末尾（或 `src/motion.css`）。
- 两者必须互不相同；新增时同步 `src/intro.js` 的 `STAGE_SELECTOR`。

## 6. 本轮记录
保留区。本轮只新增 launch 动画；视觉未改。

## 7. 验收
- `export-all.js`：无 `overflow-x` / `clipped` / `logo-text-over`
- 30 字长名（`--stress`）不溢出；960×600 与 1439×1124 两档都过
- `probe-graphics.js` 装饰不压字
