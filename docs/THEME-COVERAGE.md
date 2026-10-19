# 主题覆盖清单（THEME COVERAGE）

> 最后更新：2026-10-19 · 对应 NOVA 1.2.2
> 用途：每新增或修改一套主题，按这张表逐项过一遍，**不允许遗漏**。
> 主题预览的版式见 `docs/THEMES.md` 第 13 节；开场预设见第 10 节。

图例：

- **✔ 显式**：主题 CSS 明确写了这一项。
- **△ 继承**：刻意使用基础主题（NOVA 原生）的样式；只允许在深色底、深色组件时这样做，且必须实际检查对比度。
- **— 不适用**：该主题没有这个状态，或由应用层保证（例如主题卡片图片本身的圆角由预览图决定）。
- **NOVA 原生** 是基础样式（`src/base.css` / `src/theme.css` / `src/app.css`），本表所有行对它是默认成立的；
  新增主题不能默认“基础样式会兜底”，必须显式覆盖或明确标记继承。

---

## 1. 全局与页面骨架

| 界面 | 选择器 / 位置 | 主题必须处理 | AURUM | ENDFIELD | CODEX | ZERO HOUR | MNEMO |
|---|---|---|---|---|---|---|---|
| 页面底色 | `body`, `.app` | 底色、文字色、字体 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 背景氛围 | `.atmosphere`, `.atmosphere::before/after` | 遮罩/渐变是否与主题一致 | ✔ | ✔（移除） | ✔ | ✔ | ✔ |
| 噪点/底纹 | `.grain`, `body::before`, `body::after` | 纹理、角框、顶部条 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 文字层级 | `--ink`, `--muted`, `--faint`, `--hair` | 三级文字与分隔线 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 焦点环 | `:focus-visible` | 主题色、可见性 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 选区 | `::selection` | 底色/文字对比 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 滚动条 | `*::-webkit-scrollbar` 等 | 轨道/滑块 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 减少动效 | `html.reduce-motion` | 关闭 transform/transition | ✔ | ✔ | ✔ | ✔ | ✔ |
| 低性能 | `html.perf-low` | 关闭模糊/噪点/重装饰 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 沉稳模式 | `html.calm` | 不破坏主题的 launch/视差 | ✔ | ✔ | ✔ | ✔ | ✔ |

## 2. 顶栏

| 界面 | 选择器 | 主题必须处理 | AURUM | ENDFIELD | CODEX | ZERO HOUR | MNEMO |
|---|---|---|---|---|---|---|---|
| 顶栏底 | `.topbar`, `.topbar::after` | 背景、下边框、双线 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 品牌标记 | `.brand-mark`, `.brand::before` | 标记/色块 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 品牌字 | `.brand-word` | 字体、字距、颜色 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 导航容器 | `.nav` | 边框/底板 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 导航项 | `.nav-btn`, `.nav-btn::before` | 中英标签、当前态 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 导航滑块 | `.nav-glide` | 当前块颜色/形状/阴影 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 时钟 | `.clock-time`, `.clock-date` | 数字字体、日期 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 图标按钮 | `.icon-btn`, `.bell-dot` | 悬停/角标 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 头像 | `.avatar`, `.avatar-btn`, `.online-dot` | 形状/颜色/在线点 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 窗口按钮 | `.win-btn`, `.window-controls` | 悬停/关闭色 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 退出全屏胶囊 | `.fullscreen-pill` | 边框/背景/悬停 | ✔ | ✔ | ✔ | ✔ | ✔ |

## 3. 首页主视觉

| 界面 | 选择器 | 主题必须处理 | AURUM | ENDFIELD | CODEX | ZERO HOUR | MNEMO |
|---|---|---|---|---|---|---|---|
| 主视觉底板 | `.hero-inner::before/after` | 铭牌/纸面/画框、角标 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 眉标 | `.kicker`, `.kicker-dot`, `.kicker-sep`, `.kicker-dim` | 前缀、分隔、弱化文字 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 标题 | `.logo`, `.hero-logo`, `.type-*` | 8 套字标配方都要可读 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 副标题 | `.tagline` | 对比度、换行 | ✔ | ✔ | ✔ | ✔ | ✔ |
| meta 行 | `.meta-row`, `.meta-dot` | 分隔符形状 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 年龄标签 | `.age-badge` | 边框/底色 | ✔ | ✔ | ✔ | ✔ | ✔ |
| Steam/更新标签 | `.update-badge` | 标签/刻印 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 主按钮 | `.btn.primary` + `--cta-*` | 渐变/擦入/文字色 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 次按钮 | `.btn.ghost`, `.btn.ghost.danger` | 边框/悬停/危险 | ✔ | ✔ | ✔ | ✔ | ✔ |
| **按钮状态** | `.btn`, `.filter`, `.context-item`, `.dialog-action` | 普通 / 焦点 / 悬停 / 按下 / 禁用 / 加载 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 进度块 | `.progress-block`, `.progress-head`, `.progress-pct` | 分隔线、数字 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 进度条 | `.progress-track`, `.progress-track i` | 槽/填充/刻度 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 进度说明 | `.progress-sub` | 文案色/图标 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 活动条 | `.activity-strip`, `::before/::after` | 边框、左信号、悬停 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 活动条内部 | `.activity-icon/kicker/title/desc/pct/meta/arrow/track` | 全部文字/数字 | ✔ | ✔ | ✔ | ✔ | ✔ |

## 4. 底部游戏条

| 界面 | 选择器 | 主题必须处理 | AURUM | ENDFIELD | CODEX | ZERO HOUR | MNEMO |
|---|---|---|---|---|---|---|---|
| dock | `.dock`, `.dock-title`, `.dock-count`, `.all-btn` | 顶线、标题、计数、全部按钮 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 游戏卡 | `.tile`, `.tile-art`, `.tile-art::before/after` | 边框、编号、选中态 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 游戏卡文字 | `.tile-label`, `.tile-name`, `.tile-sub` | 当前/非当前、换行 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 徽章/进度 | `.tile-badge`, `.tile-progress` | 在线/缺失/Steam、进度 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 快捷键提示 | `.hints`, `kbd.key`, `.runtime-item` | 键帽、说明文字 | ✔ | ✔ | ✔ | ✔ | ✔ |

## 5. 游戏库视图

| 界面 | 选择器 | 主题必须处理 | AURUM | ENDFIELD | CODEX | ZERO HOUR | MNEMO |
|---|---|---|---|---|---|---|---|
| 页面底 | `.view-library` | 纸面/深色底、模糊关闭 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 头部 | `.lib-head`, `.lib-back`, `.lib-eyebrow`, `.lib-title h2` | 双线、眉标、标题 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 搜索 | `.lib-search`, `.keycap`, `input::placeholder` | 边框/聚焦/键帽 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 统计 | `.lib-stats`, `.lib-stats b`, `.lib-sep` | 数字/分隔 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 筛选 | `.filter`, `.filter:hover`, `.filter.is-active` | 当前/非当前 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 卡片 | `.lib-card`, `.lib-art`, `::after` | 边框、悬停、暗化 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 卡片信息 | `.lib-name`, `.lib-en`, `.lib-sub`, `.lib-fav` | 名称/副标题/收藏 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 当前/徽章 | `.lib-current`, `.lib-badge`, `.lib-open`, `.lib-progress` | 当前标签、打开、进度 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 空态 | `.lib-empty`, `.empty-icon` | 文案/图标 | ✔ | ✔ | ✔ | ✔ | ✔ |

## 6. 外观工作室

| 界面 | 选择器 | 主题必须处理 | AURUM | ENDFIELD | CODEX | ZERO HOUR | MNEMO |
|---|---|---|---|---|---|---|---|
| 页面底 | `.view-appearance` | 纸面/深色底 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 预览画框 | `.appearance-preview`, `.appearance-image`, `.appearance-bg` | 边框、满幅/模糊、裁切 | △（保留模糊） | ✔ | ✔ | ✔ | ✔ |
| 预览顶栏 | `.appearance-preview-top`, `.live-pill`, `.appearance-index` | 实时标签、编号 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 预览文案 | `.appearance-preview-copy`, `.appearance-eyebrow`, `.appearance-tagline` | 铭牌、标题、说明 | △（基础卡片） | ✔ | ✔ | ✔ | ✔ |
| 预览 CTA | `.preview-cta-row`, `.preview-cta` | 是否展示、颜色 | △ | ✔（隐藏） | ✔（隐藏） | ✔（隐藏） | ✔ |
| 预览进度 | `.appearance-progress` | 是否展示、配色 | △ | ✔（隐藏） | ✔（隐藏） | ✔（隐藏） | ✔ |
| 切换条 | `.appearance-switcher`, `.game-chip`, `::after` | 纸面条、编号、当前 | △ | ✔ | ✔ | ✔ | ✔ |
| 选项面板 | `.appearance-options`, `.appearance-head`, `.section-head` | 边框、标题 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 风格卡 | `.style-choice`, `.choice-radio`, `.style-choice-desc` | 当前/悬停 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 字标读数 | `.type-readout`, `.type-recipe-*`, `.type-seed`, `.type-dna` | 字体样张/字段 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 调色板 | `.palette-strip-label`, `.swatch` | 色块/文字 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 偏好行 | `.pref-row`, `.switch` | 边框/开关态 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 主题卡 | `.theme-card`, `.theme-preview`, `.theme-active-tag` | 当前/悬停/占位 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 主题面板折叠 | `#themeToggle`, `.theme-more` | 展开/收起、常用排序、默认主题置顶 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 特征模块 | `data-fx-texture/type/panel`, `theme-fx.css` | 模块启用与关闭、变量、无模块时无副作用 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 页脚 | `.appearance-footer`, `.autosave`, `.appearance-data` | 分隔/弱文字 | ✔ | ✔ | ✔ | ✔ | ✔ |

## 7. 浮层、菜单与通知

| 界面 | 选择器 | 主题必须处理 | AURUM | ENDFIELD | CODEX | ZERO HOUR | MNEMO |
|---|---|---|---|---|---|---|---|
| 通用浮层 | `.popover` | 背景/边框/阴影/模糊 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 菜单行 | `.menu-row`, `.row-key` | 悬停/快捷键 | ✔ | ✔ | ✔ | ✔ | ✔ |
| **右键菜单** | `.context-menu` | 背景/边框/阴影/模糊关闭 | ✔ | ✔ | ✔ | ✔ | ✔ |
| **右键选项** | `.context-item`, `.menu-label`, `.menu-key`, `.menu-separator` | 悬停/文字/分隔符 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 玩家菜单 | `.profile-head`, `.profile-id`, `.profile-foot` | 头部/底部 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 通知 | `.notif-item`, `.notif-title/sub/icon`, `.notif-unread`, `.bell-dot`, `.status-pip` | 未读/图标/状态点 | ✔ | ✔ | ✔ | ✔ | ✔ |

## 8. 模态、详情、编辑器、扫描器、选择器、对话框

| 界面 | 选择器 | 主题必须处理 | AURUM | ENDFIELD | CODEX | ZERO HOUR | MNEMO |
|---|---|---|---|---|---|---|---|
| 遮罩 | `.overlay` | 底色/模糊 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 模态外框 | `.detail-modal`, `.lib-shell`, `.appearance-shell`, `.editor-shell`, `.scanner-shell`, `.picker-shell`, `.dialog` | 背景/描边/圆角 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 详情左侧 | `.detail-art`, `::before/after`, `.detail-art-img` | 满幅/模糊/裁切 | △（保留模糊） | ✔ | ✔ | ✔ | ✔ |
| 详情铭牌 | `.detail-art-copy`, `.detail-logo`, `.detail-status`, `.detail-zh` | 铭牌/标题/状态 | △（基础） | ✔ | ✔ | ✔ | ✔ |
| 详情右侧 | `.detail-kicker`, `.detail-body h2`, `.detail-tagline/desc`, `.detail-progress`, `.stat`, `.detail-path`, `.detail-actions`, `.modal-close` | 全部文字/面板/按钮 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 管理面板 | `.manage-panel`, `.manage-row`, `.manage-note` | 分隔/悬停 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 编辑器 | `.editor-head`, `.editor-kicker`, `.editor-head h2` | 头部 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 表单 | `.field`, `.field-label`, `.field input/textarea/select`, `.field-btn` | **select 必须显式检查** | △（深底可用） | ✔ | ✔ | ✔ | ✔ |
| 预览 | `.editor-preview`, `.editor-preview-shade`, `.editor-preview-copy`, `.editor-logo`, swatches | 图片/铭牌/色板 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 构图控制 | `.editor-framing`, buttons, `.editor-framing-sep` | 新组件，必须覆盖 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 编辑器页脚 | `.editor-foot`, `.editor-error`, `#editorDelete` | 保存/删除/错误 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 扫描器 | `.scanner-head/status/group/row/thumb/check/source/foot/empty` | 列表/勾选 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 文件选择器 | `.crumb-btn/path`, `.drive-chip`, `.picker-row`, `.picker-meta`, `.picker-foot/note/empty` | 路径/盘符/行 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 对话框 | `.dialog-mark`, `.dialog-title/text`, `.dialog-action`（primary/danger） | 确认/危险 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 空库卡 | `.rail-empty-card`, `.rail-empty-icon/title/sub` | 空态 | ✔ | ✔ | ✔ | ✔ | ✔ |

## 9. 启动、睡眠、Toast、手柄

| 界面 | 选择器 | 主题必须处理 | AURUM | ENDFIELD | CODEX | ZERO HOUR | MNEMO |
|---|---|---|---|---|---|---|---|
| 启动页 | `.launch`, `.launch-art`, `.launch-veil`, `.launch-bars` | 底色/封面/遮罩/黑边 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 启动顶栏 | `.launch-brand`, `.launch-system` | 品牌/状态 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 启动圆盘 | `.launch-ring`, `.ring-track`, `.ring-progress`, `.launch-ring-label` | 读数/分段 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 启动文案 | `.launch-kicker`, `.launch-logo`, `.launch-zh` | 眉标/标题/副标 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 启动步骤 | `.launch-steps`, `.launch-step`, `.launch-status`, `.launch-hint` | 步骤/状态/按键 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 启动页脚 | `.launch-foot` | 弱文字 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 睡眠 | `.sleep`, `.sleep-brand/time/date/moon/hint/dot` | 时钟/等待 | ✔ | ✔ | ✔ | ✔ | ✔ |
| Toast | `.toast`, `.toast .ic`, `::before` | 提示条/图标/信号条 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 手柄提示 | `.pad-hints`, `.pad-hint`, `.pad-glyph` | 键位图/文字 | ✔ | ✔ | ✔ | ✔ | ✔ |

## 10. 开场动画、预览与资产

| 项目 | 要求 | AURUM | ENDFIELD | CODEX | ZERO HOUR | MNEMO |
|---|---|---|---|---|---|---|
| 开场预设 | `theme.json` 的 `intro` 指向一个已注册 id | `aurum` ✔ | `endfield` ✔ | `codex` ✔ | `zerohour` ✔ | ✔ |
| 独立编排 | 不能与其他主题共用同一个视觉结果 | 印章/金环 ✔ | 启动控制台/快门 ✔ | 星盘时钟/菱形收束 ✔ | CRT/信号条/折叠 ✔ | ✔ |
| 真实数据 | 开场里的日期/时间/数量必须真实 | 无数字 ✔ | 日期/时间/游戏数 ✔ | 无数字 ✔ | 日期/时间/游戏数 ✔ | ✔ |
| 跳过 | 任意键/鼠标/手柄 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 减少动效 | 直接最终状态 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 安全兜底 | 不会被开场卡住 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 主题预览 | 统一概念板 960×540，不是截图 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 资产 | 相对 URL / 许可 / 无官方素材 | ✔ | 系统思源字体 ✔ | ✔ | ✔ | ✔ |

---

## 11. 常见漏项（优先检查）

1. **右键菜单**：`.context-menu` / `.context-item` 与 `.popover` / `.menu-row` 是两套类。只改后者，右键菜单仍是基础深色。
2. **`select`**：`.field select` 与它的 `option`、箭头背景。浅色主题里最容易出现白字白底。
3. **详情/外观的模糊铺底**：`.detail-art::before/after` 与 `.appearance-bg` / `.appearance-preview-shade` 是独立的装饰层，主题改满幅 `cover` 时必须一起关闭。
4. **`html.calm` 的 `!important`**：启动页的 ring 与封面滤镜会被 calm 规则覆盖；主题要显式恢复（否则进度读数消失或封面变亮）。
5. **新的构图控件**：`.editor-framing` 是 1.2.2 新增，必须在每个主题里检查。
6. **主题卡预览**：不能直接截应用图；必须走 `tools/theme-concepts.html` 的统一概念板。
7. **按钮六态**：普通 / 焦点 / 悬停 / 按下 / 禁用 / 加载。加载态用禁用 + 文案，不用转圈或闪烁；
   不要用旋转、艺术字或纯图标来表达主要操作（机核对《绝区零》UI 的批评里最值得吸收的一条）。
8. **长标题/长标签**：960px 下也要检查 `scrollHeight === clientHeight`；不要用 ellipsis 硬切。
8. **主题版本**：改主题 CSS 后 bump `theme.json` 的 `version`，否则用户目录里的旧副本不刷新。
9. **相对资源**：主题 CSS 用 `url("assets/...")`，渲染层会重写；不要写死 `https://nova.themes/<别人目录>`。

---

## 11.1 1.2.9 新增五套主题

RIOT / GRIMOIRE / RISO / SUMMER / BROADCAST 共用同一份完整组件骨架（约 1100 行 CSS/主题），
所以逐项覆盖状态相同；主题差异只在材质、边框、字体与信号色：

| 检查项 | RIOT | GRIMOIRE | RISO | SUMMER | BROADCAST |
|---|---|---|---|---|---|
| 顶栏 / 导航 / 时钟 / 头像 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 首页主视觉 / 眉标 / 标题 / meta / 双按钮 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 进度 / 活动条 / dock / 稀有度 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 库 / 外观 / 主题卡 / 开关 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 详情 / 编辑器 / 扫描器 / 选择器 / 对话框 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 右键菜单 / 通知 / Toast / 手柄 | ✔ | ✔ | ✔ | ✔ | ✔ |
| 启动 / 睡眠 / 减少动效 / 低性能 | ✔ | ✔ | ✔ | ✔ | ✔ |
| `select` / 构图控件 / 960px | ✔ | ✔ | ✔ | ✔ | ✔ |
| 概念板预览（960×540） | No.06 | No.07 | No.08 | No.09 | No.10 |

新增主题如果改动共享骨架，必须五套一起回归；不要在单个主题里改布局。

1.2.9 的 `theme-fx.css` 是**可选**模块：主题在 `theme.json` 的 `features` 里选择
`texture` / `type` / `panel`，不写或写 `"none"` 就不启用。逐套组合见
`docs/THEMES.md` 第 15 节；改模块后要八套主题一起回归。

---

## 12. 设计参考（做主题前读）

- 机核《[绝区零 UI 设计](https://www.gcores.com/articles/185949)》与
  《[UI 设计太次了](https://www.gcores.com/articles/185722)》：按钮层级、纯黑纯白、饱和度、装饰字体。
- 知乎《[锐评：UI 设计太次了](https://zhuanlan.zhihu.com/p/707011925)》与
  《[如何改进绝区零的 UI 设计](https://www.zhihu.com/question/661145347/answer/3578527168)》：信息层级、
  按钮要像按钮、主操作位置与状态。
- 落到主题上：**只借语言，不借过载**。主操作唯一、次操作退后、标签水平可读、
  按钮六态、深浅色用 off-black/off-white、饱和色只做小面积信号。
  具体示范见 `docs/THEMES.md` 第 14.2 节。

## 13. 定义完成（DoD）

- [ ] 第 1–10 节每一行都不是 `!`；`△` 行已实际看过对比度与状态。
- [ ] 右键菜单、编辑器 `select`、构图控件、启动页、详情/外观预览、四个弹层、Toast 都已实际打开检查。
- [ ] 960 / 1280 / 全屏三档截图，无截断、重叠、横向滚动。
- [ ] 开场：`introOverlay.dataset.intro` 等于 `theme.json` 的 `intro`；跳过与减少动效都试过。
- [ ] 主题卡：11 套都有统一概念板预览；没有截图和占位。
- [ ] `dotnet build -c Debug` 0 错误；主题切换 NOVA / 十套附赠主题回归；折叠/展开与常用排序都试过。
- [ ] 更新 `docs/HANDOFF.md` 的变更记录与 `README.md` 的主题列表。
