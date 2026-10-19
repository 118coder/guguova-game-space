# 深夜广播 · BROADCAST

> 版本 **1.4.2** · 开屏 `broadcast（调频）` · 进游戏 `bcSweep（扫描揭示）`

> 完整设计理念与维护要点：`docs/DESIGN-PHILOSOPHY.md` §5.6

## 1. 设计理念
胶片式深夜电台：满幅颗粒、右侧显影的人像、黑胶与音频波形、线性擦除的幽灵字。

## 2. 视觉令牌
- 配色：亮灰纸 #e7e5df / #f3f1eb；墨黑 #141414；中灰 #8c8c88。
- 字体：思源宋体（报头/标题）+ 思源黑体 Medium（正文/数据）；报头保留衬线编辑感。
- 签名元素：胶片颗粒、黑胶 + 刻度波形、虚线航迹、幽灵字 BROADCAST。

## 3. 按钮与控件
黑平块（主）/ 透明细线（次）；禁用圆角。

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
- 开屏：`broadcast（调频）`，舞台类与关键帧在 `src/intro.css`。
- 进游戏：`bcSweep（扫描揭示）`，规则在 `themes/broadcast/theme.css` 末尾（或 `src/motion.css`）。
- 两者必须互不相同；新增时同步 `src/intro.js` 的 `STAGE_SELECTOR`。

## 6. 本轮记录
本轮：恢复背景图（右侧灰阶显影）、颗粒搬到 scene-stack 之上、正文取消白色重影、幽灵字缩进视口。

## 7. 验收
- `export-all.js`：无 `overflow-x` / `clipped` / `logo-text-over`
- 30 字长名（`--stress`）不溢出；960×600 与 1439×1124 两档都过
- `probe-graphics.js` 装饰不压字
