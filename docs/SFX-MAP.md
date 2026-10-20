# 音效使用对照表（v1.6.3）

> 文件名就是替换接口：把新音效按同名覆盖到 `src/assets/sfx/` 即可。
> 建议：OGG Vorbis / 单声道 / 44.1kHz / 峰值 ≤ -1dB / 时长见下表；
> 所有文件都必须能在 WebView2 里 `decodeAudioData` 通过。

## 1. 音效清单

全部由 [genny](https://github.com/ogomez92/genny) 本地合成生成，需求见 `docs/SFX-BRIEF.md`，
生成规格见 `tools/sfx-specs/`。

| 文件 | 时长 | 生成方式 | 角色 |
| --- | --- | --- | --- |
| `bong.ogg` | 130ms | marimba C4 + handpan C3 | 方向性切换 |
| `click.ogg` | 16ms | click 2100Hz + pop 620Hz，低通 3k | 普通按钮 |
| `nav.ogg` | 18ms | click 2700Hz + pop 780Hz | 打开页面 |
| `soft.ogg` | 18ms | click 1800Hz + pop 420Hz | 关闭 / 返回 / 开关 |
| `select.ogg` | 300ms | celesta A4→C5 + glass A5 | 较重选择 |
| `confirm.ogg` | 550ms | celesta A4→C5→E5 + glass E6 | 最终确认 |
| `error.ogg` | 170ms | felt_piano C4→Bb3 + sub C2，低通 2.2k | 失败 |
| `tick.ogg` | 42ms | blip 3100Hz，带通 | 鼠标悬停 |
| `chime.ogg` | 280ms | bell C6 + glass G6 | 游戏就绪 |
| `deep.ogg` | 200ms | sweep_down 240→105Hz | 进入睡眠 |
| `launch-rise.ogg` | 260ms | warm_pad A3 + sweep_up + sub A1 | 开始游戏（无主题音时） |
| `launch-fall.ogg` | 260ms | warm_pad A3 + sweep_down + sub A1 | 结束游戏（无主题音时） |
| `theme.ogg` | 618ms | Kenney `switch_001`（保留） | 主题切换（无主题音时） |

## 2. 按钮 / 选项 → 音效

### 导航与列表
| 操作 | 音效 | 代码入口 |
| --- | --- | --- |
| 键盘 ←/→、手柄十字键切换游戏 | `bong` | `audio.move()` |
| 游戏库列表项切换 | `bong` | `moveLibraryPadFocus()` |
| 打开「游戏库 / 外观 / 设置」 | `nav` | `audio.page()` |
| 点击「首页」 | `soft` | `audio.back()` |
| 关闭游戏库 / 外观 / 设置 | `soft` | `audio.back()` |
| 游戏库筛选块 | `soft` | `audio.toggle()` |
| 游戏库排序下拉 | `click` | `audio.select()` |

### 普通按钮（`click`）
详情、管理、编辑、保存、收藏、移除、重新指定程序、重置封面、
排序、导出数据包 / CSV、导入、打开数据文件夹 / 备份文件夹、
扫描器条目勾选、通知已读、个人菜单项、构图方向按钮。

### 关闭 / 返回 / 开关（`soft`）
关闭游戏详情、取消文件选择器、关闭管理 / 编辑器 / 扫描器、
外观语言切换、减少动效、沉稳模式、关闭到托盘、自动备份、
构图锁定 / 拖拽模式、打开通用对话框 / 文件选择器 / 主题文件夹。

### 启动
| 操作 | 音效 |
| --- | --- |
| 点击「开始游戏」 | `launch-rise` + 合成和弦 |
| 游戏进程就绪（启动画面 ready） | `chime` |
| 关闭启动画面 / 退出游戏 | `launch-fall` |
| 启动失败、保存失败、导入失败、切换启动方式失败 | `error` |
| 进入睡眠模式 | `deep` |
| 退出睡眠 | `click` |

### 外观 / 主题
| 操作 | 音效 |
| --- | --- |
| 选择任意主题卡片 | `theme`（幕布合拢），随后 `click` |
| 展开 / 收起主题列表、刷新主题列表 | `click` |
| 打开主题文件夹 | `soft` |
| 外观语言（跟随封面 / NOVA 默认） | `soft` |
| 字标换一个（shuffle） | `click` |

> 开启「减少动效」或低配 safe 档时跳过幕布，因此只响 `click` 不响 `theme`。

### 浮层、对话框、文件选择器
| 操作 | 音效 |
| --- | --- |
| 打开通用对话框 | `soft` |
| 对话框按钮（确认 / 取消 / 危险操作） | `click` |
| 打开文件选择器 | `soft` |
| 文件选择器选中一行 | `click` |
| 文件选择器最终确认 | `confirm` |
| 取消 / 关闭文件选择器 | `soft` |
| 对话框内上下移动、文件选择器进入文件夹 | `bong` |

## 3. 实现约定

1. **一个场景一个 cue**：`select()` 播 `click.ogg`，`toggle()` 播 `soft.ogg`，
   都只是语义别名，换音色只改 `SFX` 表，不用动调用点。
2. **音效与 toast 解耦**：`setCalm(on, announce)` / `setReduceMotion(on, announce)`
   的 `announce` 只管 toast；外观页无 toast 也要响。
3. **副作用不叠加**：开沉稳会顺手关掉减少动效，那次内部调用带 `{silent:true}`，
   避免同一次点击响两声。
4. **短路早退也要有声**：`selectGame()` 里 `wrapped === previous`（原地切换）
   早退分支补了 `audio.move()`，否则按方向键到边界时完全没反馈。
5. **主题幕布只在真有动画时响**：`applyTheme` 的 `animate` 为 false 时不播 `theme`。

### 每套主题的材料（按 docs/themes 的设计理念）

| 主题 | 设计理念 | 点击材料 | 选择 / 确认 | 开屏底噪 + 命中 |
| --- | --- | --- | --- | --- |
| nova | 电影感封面 | 低频 click + 柔 pop | 钢片琴 / 玻璃 | 暖垫 + 60/620/1200ms |
| aurum | 暗色圣所、金线青玉 | 金属钢珠 + 短 blip | 竖琴 / 钟 | 颂钵 + 350/450/900ms |
| codex | 安静铜版、罗盘 | 打字机 + blip | 羽管键琴 / 钢片琴 | 玻璃垫 + 100/500/950ms |
| riso | 三色套印 | 字模 + 纸噪 | 卡林巴 / 玻璃 | 卡林巴 + 500/650ms |
| endfield | 工业纸面终端 | 电磁闩 + 打字机 | 马林巴 / 低音 | 引擎 + 100/420/550ms |
| zerohour | 街区命令台、CRT | 低通粉噪 + 低音 blip | 拨弦 / 玻璃 | 黑胶 + 低频鼓点 100/380/620ms |
| mnemo | 雾紫档案、印章 | 档案夹门 + blip | 颤音琴 / 玻璃 | 玻璃垫 + 100/380/580ms |
| broadcast | 胶片电台 | 雪花噪 + click | 电钢 / 玻璃 | 56Hz 底噪 + 120/620/900ms |
| grimoire | 羊皮档案、蜡封 | 纸页 + 粉噪 | 竖琴 / 玻璃 | 颂钵 + 120/280/1500ms |
| riot | 唱片封套 | 木质钢珠 + pop | 马林巴 / 弦乐 | 黑胶 + 80/600/1200ms |
| summer | 白纸杂志 | 纸页 + blip | 钟琴 / 玻璃 | 暖垫 + 0/180/760ms |

> 同一套主题里的点击、页面、关闭共用一种材料的不同力度，因此听起来是"同一个世界"，
> 而不是三个无关的音效。

### 统一音效开关

设置 → 启动与关闭 → **使用默认统一音效**（`unifiedSfx`）。

- 关闭（默认）：每套主题用自己的 16 个 cue；
- 打开：全部回落到 `src/assets/sfx/` 的统一音效；
- 切换立即生效，不需要重启或重选主题。

### 右键预览启动动画

外观页右键任意主题卡片：

- **播放「主题名」启动动画** —— 播放该主题的开屏动画与其 `boot` 序列，
  不切换当前主题，预览结束后原样返回；
- **使用这套主题**；
- **打开外观面板**。

### 实测

- 10 套主题各加载 16 个 cue，NOVA 的 16 个走 `assets/sfx/nova/`；
- 终末地预览：开屏预设 `endfield`、`boot` 时长 2.40s、当前主题保持不变；
- 统一音效开关：`bufferFor('click')` 在主题池与统一池之间正确切换（0.017s / 0.016s）；
- 全部 176 个生成文件 `sharp ≤ 1.91`、`above5k ≤ 14.7%`（噪声类自然偏高，已低通）。
