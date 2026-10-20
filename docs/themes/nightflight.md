# 夜航 · NIGHT FLIGHT

> 版本 **1.0.8** · 开屏 `nightflight（离港）` · 进游戏 `nfLaunch（跑道加速）` · 切换 `票根对撕`

> 完整设计规范：`themes/nightflight/DESIGN.md`
> 主题 id：`nightflight`

## 1. 设计理念

夜间航班的登机牌，放在离港大厅的航班表前。主视觉是一张米白登机牌：左缘荧光色带、
右侧舷窗、虚线撕口、上下票根缺口、右下条码；背景是深夜蓝的星图、经纬网和一条虚线航路。
底部是「DEPARTURES / 最近游戏」离港航班表；游戏库统一为与其他主题一致的 16:9 卡片网格，卡片做成登机牌票根（NF 编号角标 + 荧光顶条）。

参考机场离港屏与登机牌，而不是游戏 UI：等宽字、荧光黄绿、硬边、虚线、编号、条码。
不伪造航班动态；`NF 001 / GATE 01` 只作为主题自身的装饰编号，日期 / 时钟 / 游戏数来自真实数据。

这套主题取代了此前由 KERN 印版工作室生成并安装的 `kern-1mvba4m`（旧「夜航 · 色带」）。
旧主题已备份到 `_shots/backup-themes/kern-1mvba4m-20261021/` 并从用户主题目录移除，
避免出现两个「夜航」。

## 2. 视觉令牌

- 夜空：`#04070d` / `#07101c`；面板 `#0b1724` / `#101f30`；描边 `#1c3348`、亮线 `#2f5474`。
- 文字：主 `#e9edf2`、次 `#93a6b8`、弱 `#5d7184`。
- 强调：荧光黄绿 `#d9ff45`（航线、选中、主操作）；米白 `#f4f0e0`（登机牌）；墨 `#0a0f14`。
- 辅助：航道蓝 `#6fa8ff`（网格、星图）；珊瑚 `#ff6b4a`（只给失败 / 删除）。
- 字体：标题思源黑体 700，字距 `-.035em`；标签 / 时间 / 编号用等宽字体（Cascadia Mono / Consolas）。
- 签名：登机牌、舷窗、虚线撕口、上下缺口、条码、荧光左带、DEPARTURES 航班表、FIDS 行列表。

## 3. 按钮与控件

- 主按钮：荧光黄绿平涂 + 1px 墨边 + 4px 硬偏移墨影，墨色字；悬停再偏移 1px。
- 次按钮：透明 + 1px 墨边 + 墨色字（登机牌上）；纸外为奶白字 + 航道蓝细边。
- 导航：等宽编号 `01–04` + 中文；选中为荧光字 + 2px 荧光底线。
- 选中：荧光描边 + 荧光外晕；卡片编号 `NF 01` 用等宽字。
- 开关：方角，开=荧光黄绿，滑片为墨色方块。

## 4. 可复用接口

| 接口 | 作用 | 备注 |
|---|---|---|
| `.app::after` | 星图 / 经纬网 / 虚线航路 | `position:fixed`，`z-index:1` |
| `.hero::before` | 左缘荧光色带 + 竖排 `NIGHT FLIGHT` | 在登机牌外侧 |
| `.hero::after` | 右缘竖排 `BOARDING PASS` | 不进入文字列 |
| `.hero-inner` | 登机牌 | `display:flex` 垂直居中；右侧留 33% 给舷窗 |
| `.hero-inner::before` | 虚线撕口 + 上下缺口 | 67.4% 处，缺口用深色径向渐变 |
| `.hero-inner::after` | 舷窗 | 圆形，9px 米白窗框 + 墨色内圈 |
| `.hero-inner` 背景 | 条码 | 右下角重复线性渐变，132×34px |
| `.kicker` | 航班状态行 | 等宽大写，荧光方块 |
| `.progress-track` | 跑道条 | 墨色底 + 米白虚线中线 + 荧光填充 |
| `.dock-title` | DEPARTURES | 隐藏原「游戏」文本，`::before` 输出标题 |
| `.tile` | 登机牌票根 | 顶部 3px 荧光条，编号 `NF 01` |
| `.lib-card` | 登机牌卡片 | 16:9 缩略图 + `NF 01` 角标；与其它主题同一套网格布局 |
| `.lib-grid::after` | `END OF MANIFEST` | 列表末尾的机场信息屏细节 |

## 5. 开屏与进游戏

- 开屏：`nightflight` → 舞台 `.intro-nf`（`ensureNightStage`，样式在 `src/intro.css` 末尾）。
  时序：星图亮起 → 荧光地平线拉开 → 跑道中线加速 → 分瓣字 `NIGHT / FLIGHT` 逐字翻下 →
  航班行与真实日期 / 时钟 / 游戏数打印 → 状态 `BOARDING`。
- 进游戏：`nfLaunch`（跑道加速），规则在 `themes/nightflight/theme.css` §8：
  从画面中心的方形缝隙张开到全屏，同时从暗到亮。
- 切换：`src/motion.css` 的 `[data-variant="nightflight"]`：
  上下两张票根沿虚线撕开，荧光扫描线扫过，主题名落在登机牌式边框里；`CURTAIN_HOLD.nightflight = 440`。

## 6. 验收

- `export-all.js --themes=nightflight --views=all --sizes=1439x1124,960x600 --stress`：无溢出 / 截断；
- 960×600 下登机牌、舷窗、按钮、进度全部在一屏内，条码不压文字；
- 30 字长名在 1439 与 960 均为 3 行内，不压舷窗；
- 底部 DEPARTURES 标题与第一张票根之间保留间距，长游戏名不把时长挤出卡片；
- `reduce-motion` / `safe`：开屏、幕布、进游戏动画全部静止。


## 7. 音效（genny）

16 个 cue 由 genny 重新合成：翻牌/木鱼做点击与导航，机场双音铃做确认与就绪，
风与荧光扫描做启动/退出，`boot` 里加入 PA 人声「boarding」。
规格：`tools/sfx-specs/themes-2.2-genny.json`；生成：`python tools/sfx-specs/make-themes-2.2.py`。
所有 cue 为 mono / 44.1kHz / OGG，峰值 -1dB，`sharp ≤ 1.6`、`above5k ≤ 3%`。

> 外观预览：与其他主题一致的全幅封面 + 底部渐变标题，隐藏 CTA 与时长。
