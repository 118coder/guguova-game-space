# NOVA 设计理念与主题维护手册

> 适用版本：**1.5.2**
> 最后整理：2026-10-20
> 配套文档：`docs/HANDOFF.md`（项目全貌）、`docs/HANDOFF-THEMES.md`（本轮细节）、
> `docs/THEME-INTERFACES.md`（接口契约）、`docs/themes/*.md`（单主题卡）、
> `docs/SFX-MAP.md`（音效触发表）。

这份文档回答三个问题：

1. NOVA 的主题到底在追求什么？
2. 一套主题由哪些层组成、哪些可以变、哪些绝不能变？
3. 后续新增/修改主题时，按什么顺序做、怎么验收、怎么发版？

---

## 1. 产品定位

NOVA Game Space 是**离线单机游戏启动器**，不是在线社区，也不是游戏平台客户端。

- 不登录、不联网、不上传；
- 游戏库、封面、游玩记录、头像、设置都保存在本机；
- 迁移靠 `.nova-pack` 数据包，不依赖服务器；
- 主题是“界面语言”，不是换色皮肤：每套主题拥有自己的版式、控件、字体角色、
  开屏、进游戏动画和切换动画。

设计目标只有一句话：**像一台真正属于玩家的游戏主机，而不是一个网页套壳。**

---

## 2. 六条不可违反的规则

1. **图形不得盖过文字。** 任何装饰、线稿、照片、网点、胶带、印章都不能压住主体文字；
   文字必须有足够的对比度和干净的落点。
2. **不得出现文字截断。** 标题用 `.is-long-title` / `--logo-fit` 自适应；主题写死
   `font-size` 时必须乘 `var(--logo-fit,1)`；禁止 `nowrap + ellipsis` 处理主标题。
3. **必须用 30 个汉字 + 冗余的游戏名测试。** 1440×1124 与 960×600 两档都要看。
4. **主题顺序固定前四。** `NOVA → 终末地 → 零点街区 → 秘典`；其余按使用次数，
   只在启动时排序一次，会话内不重排。
5. **缓存不落 C 盘。** 开发用 `NOVA_CACHE_ROOT`（E: `.cache/webview2`）；
   正式默认优先选非 C 的固定磁盘，只有单盘机器才回退到 C。
6. **每轮改动必须更新交接/设计文档。** 设计理念、接口、版本表、单主题卡至少改一处，
   不能只改代码。

---

## 3. 统一设计系统

### 3.1 颜色层级

每套主题可以有自己的色板，但层级语义一致：

| 层级 | 用途 | 例子 |
| --- | --- | --- |
| 纸/底 | 页面最大面积 | 白纸、羊皮纸、深褐铜版、黑街 |
| 墨/主文字 | 正文与标题 | 近黑、米白 |
| 强调色 | 当前位置、主操作、可点击 | 酸黄、青柠、朱红、鎏金 |
| 次强调 | 数据、辅助线、次操作 | 青蓝、梅红、琥珀 |
| 危险色 | 只给删除/失败 | 红 |

规则：

- 强调色只做**填充**，不要大面积铺成背景；
- 浅色主题里强调色不能当正文颜色；正文用墨色；
- 红色只给删除/失败，不拿来做普通提醒；
- ZERO HOUR 的主色是**青柠 `#c6ff2e`**，青色 `#59e3ff` 做次强调；
  黄色 `#ffe600` 只给“注意/警示”，切换动画里不出现黄色字。

### 3.2 字体

全主题使用本机 **思源黑体 CN Medium / 思源宋体**，不内置西文字体。

| 令牌 | 用途 | 推荐栈 |
| --- | --- | --- |
| `--font-ui` | 正文、控件 | 思源黑体 Medium |
| `--font-display` | 标题、字标 | 按主题配黑体 Medium 或宋体 Medium |
| `--font-serif` | 衬线正文/书页 | 思源宋体 |
| `--font-condensed` | 大号标签 | 按主题配黑体/宋体 |

标准栈（直接复制）：

```css
--font-ui: "思源黑体 CN Medium", "Source Han Sans CN Medium", "Noto Sans SC Medium", "Microsoft YaHei UI", "Microsoft YaHei", sans-serif;
--font-serif: "思源宋体", "Source Han Serif SC", "Noto Serif SC", "Songti SC", "SimSun", serif;
```

- Regular 家族名在 WebView2 中不稳定，**统一用 Medium 家族名**，粗体由 Chromium 合成；
- 衬线标题用 `思源宋体 Medium`，正文衬线用 `思源宋体`；
- 不再新增指向主题目录字体的 `@font-face`；需要特殊字体时用 `local()` 或随包附带 OFL 字体并登记许可。

### 3.3 版式

- `.view` 绝对铺满内容区，带 `contain: layout style`，过渡只动 `opacity/transform`；
- 首页是主视觉 + 底部游戏条；游戏库/外观/设置是独立全屏视图；
- 设置页是**全宽双栏控制台**：`width: min(1640px, 100%)`，左列玩家/数据/统计，
  右列启动/兼容性/关于；`≤1080px` 自动单列；
- 所有标题、统计值、长路径都要允许换行或等比缩放，不允许省略号吃掉半个词；
- 设置页顶部用户卡是“玩家身份”的第一落点，必须按主题设计，不能套统一玻璃卡。

### 3.4 动效

动效原则：**短、硬、机械、每次操作只对应一次运动。**

| 曲线 | 值 | 用途 |
| --- | --- | --- |
| snap | `cubic-bezier(.16,1,.3,1)` | 入场、落位 |
| mech | `cubic-bezier(.7,0,.2,1)` | 退出、硬切、快门 |
| soft | `cubic-bezier(.4,0,.2,1)` | 轻微淡入 |

- 单次 UI 响应 100–400ms；整套开屏不超过约 2.4s；
- 全屏层禁止 `filter` / `backdrop-filter`；只允许 `transform / clip-path / opacity`；
- 不做持续循环的装饰动画；`prefers-reduced-motion` 或 `safe` 档全部静止；
- 主题切换的幕布必须能完整看到“覆盖 → 换样式 → 揭开”，第一次切换也一样。

---

## 4. 每套主题的三个动画

每套主题必须有**不同**的：

1. **开屏 intro**：开机仪式，展示品牌/日期/时间/游戏数等真实数据；
2. **进游戏 launch**：从点击开始到启动画面的过渡；
3. **主题切换 curtain**：换样式表时遮住重算的幕布。

### 4.1 切换编舞表（`#themeCurtain[data-variant]`）

| 主题 | 动作 | 覆盖 | 记忆点 |
| --- | --- | --- | --- |
| NOVA | 上下双幕布 + 中央光缝 | 360ms | 电影遮幅 |
| AURUM | 左右青铜门 + 竖金缝 + 门环 | 400ms | 鎏金圣所大门 |
| ENDFIELD | 蓝图面板横扫 + 38px 切角 + 三色条 | 380ms | 工程图纸推进 |
| ZERO HOUR | 斜切漫画面板 + 危险条 + 网点 | 420ms | 青柠/青蓝，无黄色字 |
| CODEX | 整页绕顶边 3D 翻下/翻开 | 430ms | 书页翻动 |
| BROADCAST | CRT 开机闪白 → 收成横线 | 360ms | 老电视 |
| SUMMER | 白纸印版扫入 + 黑/黄块压版 | 470ms | 印刷排版 |
| RISO | 蓝/纸双印版反向错位 | 380ms | 套印错版 |
| RIOT | 朱红褶皱舞台幕布 + 撕胶带缝 | 380ms | 演出开场 |
| GRIMOIRE | 羊皮纸页上升 + 蜡封落下 | 650ms | 档案页翻开 |
| MNEMO | 纵向记忆条带 + 紫色重影 | 360ms | 内存扫描 |

实现要点：

- `playThemeCurtain()` 写 `dataset.variant`，先在 `is-on` 状态等两帧，再 `is-cover`；
  这样第一次切换也能看到完整动画；
- `CURTAIN_HOLD` 必须 ≥ 该变体最长覆盖动画；
- 全屏面板用 101% 位移或足够大的 clip-path，保证四角完全覆盖；
- 幕布中央文字固定字体（思源宋体/黑体），不继承会随主题变化的 `--font-display`；
- 幕布中央主题名只显示“·”前的部分（如“舞台残响”）。

### 4.2 开屏与进游戏

| 主题 | intro | launch |
| --- | --- | --- |
| NOVA | `gilded` 星核 | `nvLaunch` |
| AURUM | `aurum` 金门 | `auLaunch` |
| ENDFIELD | `endfield` 启动序列 | `efLaunch` |
| ZERO HOUR | `zerohour` CRT 接入 | `zhLaunch` |
| CODEX | `codex` 星轨展开 | `cxIris` |
| BROADCAST | `broadcast` 调频 | `bcSweep` |
| SUMMER | `draft` 白纸排版 | `suShutter` |
| RISO | `riso` 三色套印 | `rsRoll` |
| RIOT | `vinyl` 黑胶升速 | `rtDrop` |
| GRIMOIRE | `seal` 归档盖章 | `grStamp` |
| MNEMO | `mnemo` 档案解密 | `mnUnfold` |

开屏数据必须来自 `introData()`（日期/时间/游戏数），不得编造。

---

## 5. 11 套主题设计卡

| 主题 | 一句话 | 主色 | 字体角色 | 设置用户卡材质 |
| --- | --- | --- | --- | --- |
| NOVA | 电影感黑底主机界面 | 暖橙 | 黑体 + 宋体字标 | 暗色玻璃 |
| AURUM | 鎏金圣所，青铜门 | 金 + 墨绿 | 宋体标题 | 铜牌 |
| ENDFIELD | 工业纸面现场终端 | 酸黄 `#fffa00` | 全黑体 | 工业标签 |
| ZERO HOUR | 黑街漫画 + CRT | 青柠 `#c6ff2e` + 青蓝 | 全黑体 | 危险贴纸 |
| CODEX | 星轨秘典，书页与铜版 | 金 + 酒红 | 宋体标题 | 书铭牌 |
| BROADCAST | 深夜电台，报纸/黑胶 | 黑白灰 | 宋体报头 | 剪报 |
| SUMMER | 白纸线稿 + 黑黄字块 | 青蓝 + 酸柠 | 宋体标题 + 黑体正文 | 印刷卡 |
| RISO | 双色套印海报 | 蓝 + 酸黄 | 宋体标题 | 套印卡 |
| RIOT | 舞台残响，纸面朋克 | 朱红 + 黑 | 黑体标题 + 宋体旁注 | 演出通行证 |
| GRIMOIRE | 羊皮纸冒险档案 | 酒红 + 金 | 全宋体 | 蜡封书牌 |
| MNEMO | 神秘管理局档案终端 | 雾紫 + 梅红 | 全黑体 | 记忆模块 |

### 5.1 NOVA
电影遮幅、暖橙光、黑底米白字；标题允许衬线字标。切换是上下双幕布。保留区，不要改成纸面主题。

### 5.2 AURUM
墨绿/青铜/金色，宋体标题，宽字距；主视觉是鎏金铭牌。切换是青铜门。设置卡是铜牌 + 双层金边。

### 5.3 ENDFIELD
纸白 `#f4f4f2`、墨黑 `#161616`、酸黄 `#fffa00`；**切角 = 可点击**，正文/图片直角；
三色条只出现在页面开头和详情标题下；宽体大写拉丁 + 粗体中文；真实编号/日期/计数。
切换是蓝图面板 + 切角 + 三色条。不要把黄色铺满整屏，不要用圆角。

### 5.4 ZERO HOUR
黑街漫画：厚墨边、硬偏移影、网点、胶带、CRT。**青柠是当前/选中，青蓝是次强调，
黄色只给注意/警示。** 切换是斜切漫画面板 + 危险条 + 网点，文字只用青柠/青蓝。

### 5.5 CODEX
深褐铜版、双层金线、红玉菱形、星盘时钟；宋体标题。切换是书页翻动。不要用蓝紫霓虹。

### 5.6 BROADCAST
报纸/胶片/黑胶：灰纸、黑色报头、宋体、路线虚线、颗粒。幽灵字是线性擦除，不是整块灰字。
标题的 `fit-content` 宽度必须按父级文字列测量；不要让字号和可用宽度互相追赶。

### 5.7 SUMMER
白纸 + 青色制图线（网格、斜线、圆弧、棋盘格、黄色立边）；
**正文 = 黑块白字，副文 = 黄块黑字**，标题是排序式大字 + 蓝色竖栏。
角色照片做蓝印/网点处理，但**不要在脸上压黑色线稿**。
切换是白纸印版 + 黑/黄块压版，底部黑条只做 14% 页脚；开屏是同一套白纸排版语言。

### 5.8 RISO
蓝 `#2f3fd4` + 酸黄 `#e8ff2a`，套印错位、网点、硬偏移；宋体标题。
切换是两片印版反向通过，不要模糊。

### 5.9 RIOT（舞台残响）
纸白 + 朱红 + 黑，黑胶、撕胶带、硬偏移标题；标题黑体，旁注宋体。
切换是朱红舞台幕布 + 撕胶带缝。不要恢复旧名“少女乐队的呐喊”。

### 5.10 GRIMOIRE
羊皮纸、酒红、金、蜡封、藤蔓、肖像卡；全宋体。切换是羊皮纸页上升 + 蜡封落下，
覆盖停留 650ms。不要用圆形墨点瞬间铺满。

### 5.11 MNEMO
雾紫/靛紫/梅红/琥珀，档案终端、卷宗、地图节点；全黑体。
切换是纵向记忆条带 + 紫色重影。梅红只给错误/开场。

---

## 6. 设置页设计规范

- 全宽双栏控制台，`min(1640px,100%)`；顶部 hero + 身份卡；`≤1080px` 单列；
- 控件样式在 `src/settings-themes.css` 按主题覆盖，禁止主题去改 `.settings-*` 的基础布局；
- 每套主题的身份卡材质见上表；头像、姓名、账户、档位、版本都必须清晰可读；
- **头像可点击**：点击头像直接打开图片选择；悬停显示“更换”；另有“更换头像/移除头像”按钮；
  图片裁成 256×256 PNG，存 `media/avatar/avatar.png`，同步顶栏与个人菜单；
- 标签（本机用户/离线/次数/档位/版本）按主题做块状或描边，但不能用低对比色；
- 开关、输入框、下拉、按钮必须与主题同一套语言；SUMMER 的开关是方角黑/黄块。

---

## 7. 音效设计

- 全部为**离线本地音效**，来源与许可见 `src/assets/sfx/LICENSE-SFX.md`；
- 当前使用 Kenney Interface Sounds（CC0）+ Kenney 环境音；
- 主题切换使用专属 `theme.ogg`；
- 触发映射见 `docs/SFX-MAP.md`：`move / select / open / back / close / toggle /
  confirm / error / theme / launch-rise / launch-fall / chime / deep`；
- 新音效按同名 OGG 覆盖即可；建议单声道 44.1kHz、峰值 ≤ -1dB、时长 < 1.5s；
- 不要把音效做成持续循环；不要联网加载。

---

## 8. 兼容与性能

| 档位 | 条件 | 行为 |
| --- | --- | --- |
| `full` | Win10/11 + WebView2 ≥111 | 全部纹理、字体图层、动画 |
| `balanced` | 较旧 WebView2 / 无 color-mix | 关闭部分混合与滤镜 |
| `safe` | Win7/8.1 或低性能 | 关闭开屏、装饰、动画 |

- Modern：.NET 10 + WebView2 evergreen；
- Legacy：.NET Framework 4.8 + WebView2 109，单文件 EXE；
- 全屏视图禁止 `backdrop-filter`；主题切换只动合成属性；
- 首屏后 idle 预取主题 CSS；第一次切换也必须完整（幕布先画初始态再启动）；
- 缓存默认避开 C 盘；开发缓存用 `NOVA_CACHE_ROOT`。

---

## 9. 版本与维护流程

### 9.1 新增/修改主题

1. 改 `themes/<id>/theme.css` 与 `theme.json`；
2. **bump `theme.json` 的 patch 版本**（缓存失效）；
3. 视觉有变化就重画 `assets/preview.jpg`：
   - 概念板源：`tools/theme-concepts.html`
   - 渲染：`node tools/render-concepts.js <out> --only=<id>`
   - 缩到 960×540 JPG；
4. 同步到 `%LOCALAPPDATA%\NOVA Game Space\themes\<id>` 并重启；
5. 跑审计：`export-all.js --views=home,library,appearance,settings,detail --sizes=1439x1124,960x600 --stress`；
6. 更新 `docs/themes/<id>.md` 与 `docs/THEME-INTERFACES.md` 版本表。

### 9.2 新增主题

1. 复制主题目录，改 `id/name/version/preview`；
2. 在 `theme.json` 里只声明需要的 `features`；
3. 写 `theme.css`（基础层 → 修正层 → 签名层，后写覆盖先写）；
4. 在 `src/intro.js` 注册开屏 preset，加入 `STAGE_SELECTOR` 和清理类列表；
5. 在 `src/motion.css` 写新的 `data-variant` 切换编舞；
6. 在 `src/settings-themes.css` 写设置控件与身份卡；
7. 生成 16:9 预览，更新文档与版本表；
8. 跑审计 + 30 字长名测试 + 单文件 Legacy 验证。

### 9.3 发版

```bash
node tools/bump-version.js 1.5.x   # 同步 Modern/Legacy csproj、index.html、version.json
bash tools/pipeline.sh             # 审计 + Legacy 构建 + 单文件/全主题包
```

- `version.json` 是唯一版本源；
- 两个 Legacy 包与 Modern 包共用 `library.json` / `.nova-pack`；
- 发布前确认：版本、主题表、预览图、音效许可、30 字测试、首次切换动画、缓存位置；
- 变更提交 PR 并合并。

---

## 10. 当前版本表（2026-10-20）

| 主题 | 版本 | 开屏 | 进游戏 | 切换 |
| --- | --- | --- | --- | --- |
| nova（内置） | 2.0.0 | gilded | nvLaunch | 双幕布 |
| aurum | 1.0.9 | aurum | auLaunch | 青铜门 |
| endfield | 1.0.5 | endfield | efLaunch | 蓝图切角 |
| zerohour | 1.0.8 | zerohour | zhLaunch | 漫画危险条 |
| codex | 1.7.2 | codex | cxIris | 翻页 |
| broadcast | 1.4.2 | broadcast | bcSweep | CRT |
| summer | 1.8.3 | draft | suShutter | 白纸排版 |
| riso | 1.4.2 | riso | rsRoll | 双印版 |
| riot | 1.5.3 | vinyl | rtDrop | 舞台幕布 |
| grimoire | 1.5.2 | seal | grStamp | 羊皮纸 + 蜡封 |
| mnemo | 1.1.3 | mnemo | mnUnfold | 记忆条带 |

应用版本：**1.5.2**。

---

## 11. 常见坑（不要再踩）

1. `fit-content` 标题的可用宽度不要取自身宽度，取父级文字列；否则字号和宽度互相追赶。
2. 不要给 `.logo` 的 `letter-spacing` 做过渡；它会让 fitLogo 每帧重测。
3. 主题切换的幕布先画初始态再启动；第一次切换和第二次必须一致。
4. 导航滑块在主题切换时直接吸附（`.is-instant`），不要从旧宽度滑到新宽度。
5. 全屏层禁止 `filter/backdrop-filter`；用 transform/clip-path/opacity。
6. 幕布中央文字用固定字体，不继承主题变量。
7. ZERO HOUR 不要用黄色字；黄色只给注意/警示。
8. SUMMER 不要在角色脸上压黑色线稿；线稿只用青色。
9. 主题预览要反映当前真实语言，不要放已删除的插画/线稿。
10. 缓存及时清理，且不要放 C 盘；提交前清 `.cache`。
