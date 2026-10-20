# 终末地 · ENDFIELD

> 版本 **1.0.9** · 开屏 `endfield（纸面启动台）` · 进游戏 `efLaunch（工业闸门）`

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
- 开屏：`endfield（纸面启动台）`，按 `endfield-ui` 六条法则重做：
  纸白底 + 制图网格、顶部 3px 品红/酸黄/薄荷三色条、白色直角面板 + 1px 细线分区；
  实心 `NOVA` 与空心 `SPACE` 双层字标、粗体中文在下；酸黄只用于 `READY` 状态块；
  右侧空心真实计数（游戏数）；底部 GAMES / THEME / YEAR 三个真实字段。
  入场全部在 700ms 内（擦入 360ms、字标 260ms、字段 38ms 错开），无投影/发光/渐变。
  舞台类 `.intro-ef2` 与关键帧在 `src/intro.css`。
- 字体：拉丁用 **Saira**（可变字体，SIL OFL 1.1，`src/assets/fonts/Saira.ttf`），
  字标与小标签拉宽到 125%，字段 112%，数字 tabular；中文保持思源黑体粗体。
  字体只用于本开屏，不进入全局 UI。
- 质感：两角各一片**等高线**（墨色 9%，`src/assets/contours/`），右侧一条 45° 斜线柱 +
  竖排 `// NOVA GAME SPACE`；字标不加投影，靠对比与留白。入场有 1px 墨线随擦入推进。
- 进游戏：`efLaunch（工业闸门）`，规则在 `themes/endfield/theme.css` 末尾（或 `src/motion.css`）。
- 两者必须互不相同；新增时同步 `src/intro.js` 的 `STAGE_SELECTOR`。

## 6. 本轮记录
保留区。本轮只新增 launch 动画；视觉未改。

## 7. 验收
- `export-all.js`：无 `overflow-x` / `clipped` / `logo-text-over`
- 30 字长名（`--stress`）不溢出；960×600 与 1439×1124 两档都过
- `probe-graphics.js` 装饰不压字

## 8. 音效材料
继电器 + 打字机点击；马林巴双/三音确认；低音失败；开屏为引擎底噪 + 60/200/420ms 三段命中。
