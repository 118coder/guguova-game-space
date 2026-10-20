# Steam 经典 · STEAM CLASSIC

> 版本 **1.0.2** · 开屏 `steam（客户端启动）` · 进游戏 `stMax（窗口最大化）` · 切换 `客户端窗口推开`

> 完整设计规范：`themes/steam/DESIGN.md`（色板、构图、控件、动画、音效、禁忌）
> 设计理念摘要：`docs/DESIGN-PHILOSOPHY.md` §5.13

## 1. 设计理念

把启动器做成桌面上开着的经典客户端窗口：深蓝外壳、标题栏、通栏头图、绿色主按钮、
蓝色链接、1px 分隔线和一条库列表。参考的是 2010 年代 Steam 桌面客户端的视觉体系
（不是 Big Picture，也不是 Steam Deck UI），只提炼语言，不使用 Valve 的任何素材。

## 2. 视觉令牌

- 配色：外壳 `#171a21`、深底 `#0e141b`、面板 `#1b2838`、面板暗 `#16202d`；
  描边 `#2a475e`；正文 `#c6d4df`、次级 `#8f98a0`、弱化 `#66727d`；
  链接蓝 `#66c0f4`、动作绿 `#a4d007` / `#5c7e10`；危险红 `#d94126`。
- 字体：全篇思源黑体 Medium，标题 700；微标签 9–10px 全大写字距 `.18em`–`.28em`；
  数字 `tabular-nums`。
- 签名元素：窗口标题栏（库 · 本机游戏 · 离线模式）、通栏 16:9 头图、绿色主按钮、
  方角 2px、1px 分隔线、选中项蓝条。

## 3. 按钮与控件

- 主按钮：`#8ed629 → #5c7e10` 纵向渐变 + 1px `#4c6b22` + 内高光，白字，2px 圆角；
- 次按钮：半透明蓝底 + 1px 蓝边 + 蓝字；
- 开关：方角，开=深蓝底 + 蓝色滑块；
- 选中态：蓝色 1px 边 + 内嵌 1px 线；列表项用底部/左侧蓝条。

## 4. 可复用接口

| 接口 | 作用 | 备注 |
|---|---|---|
| `.hero-inner` | 客户端窗口；`::before` 标题栏，`::after` 通栏头图 | 头图 `margin` 负值贴齐窗口边缘 |
| `.hero-inner > .activity-strip` | 右栏「库快捷入口」 | ≤1180px 隐藏 |
| `--nova-hero` | 头图（运行时写入） | 高度 `clamp(150px, 21vh, 226px)` |
| `.hero-logo.is-long-title` | 长名两行规则 | 字号乘 `var(--logo-fit,1)` |
| `.progress-track` / `.dp-track` | 下载条式进度 | 蓝色渐变 + 1px 描边 |
| `.detail-stats .stat` | 详情统计格 | 深色卡片，白字 |
| `.scene > img` | 主视觉底层 | 压到 0.34–0.40 亮度 |

## 5. 开屏与进游戏

- 开屏：`steam`（客户端启动），舞台 `.intro-st`，代码 `ensureSteamStage`，
  样式在 `src/intro.css` 末尾；已加入 `STAGE_SELECTOR`。
  窗口升起 → 进度条 → 三个真实步骤 → 状态切「库已就绪」。
- 进游戏：`stMax`（窗口最大化），规则在 `themes/steam/theme.css` §13。
- 切换：`[data-variant="steam"]`，非对称双面板（26.5% 侧栏 + 74% 主面板）横向合拢；
  `CURTAIN_HOLD.steam = 440`。

## 6. 本轮记录

新增主题（v1.0.0 → 1.0.2：矮窗收紧、头图内描边、缩略图重出）。

## 7. 验收

- `export-all.js --themes=steam --views=all --sizes=1439x1124,960x600 --stress`：
  32 张全部 ok，无溢出/截断；
- 960×600 下右栏隐藏、进度块收起，窗口不与 dock 重叠；
- 30 字长名两行显示，不压头图；
- `reduce-motion` / `safe`：开屏、幕布、进游戏动画全部静止。
