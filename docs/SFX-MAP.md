# 音效使用对照表（v1.5.1）

> 文件名就是替换接口：把新音效按同名覆盖到 `src/assets/sfx/` 即可。
> 建议：OGG Vorbis / 单声道 / 44.1kHz / 峰值 ≤ -1dB / 时长见下表；
> 所有文件都必须能在 WebView2 里 `decodeAudioData` 通过。

## 1. 当前音效清单

| Cue | 当前文件 | 当前来源 | 时长 | 音色角色 |
| --- | --- | --- | --- | --- |
| `tick` | `tick.ogg` | Kenney `select_001` | 40ms | 极轻的悬停/对焦提示（当前预留，未接线） |
| `move` | `move.ogg` | Kenney `click_001` | 100ms | 键盘/手柄切换选择时的短点击 |
| `select` | `select.ogg` | Kenney `confirmation_001` | 290ms | 最常用的普通点击/选择 |
| `confirm` | `confirm.ogg` | Kenney `confirmation_002` | 540ms | 文件选择器“确认”、需要更重的确认 |
| `back` | `back.ogg` | Kenney `back_001` | 64ms | 返回/收起 |
| `open` | `open.ogg` | Kenney `open_001` | 148ms | 打开页面/浮层/文件选择器 |
| `close` | `close.ogg` | Kenney `close_001` | 148ms | 关闭详情/取消文件选择器 |
| `toggle` | `toggle.ogg` | Kenney `toggle_001` | 136ms | 开关/筛选项/模式切换 |
| `error` | `error.ogg` | Kenney `error_001` | 162ms | 失败、缺失程序、保存失败 |
| `theme` | `theme.ogg` | Kenney `switch_001` | 618ms | 主题切换（幕布合拢时） |
| `launchRise` | `launch-rise.ogg` | Kenney `maximize_001` | 258ms | 启动游戏的“启动”重音（后面叠合成和弦） |
| `launchFall` | `launch-fall.ogg` | Kenney UI Audio | 约 0.4s | 退出游戏/关闭启动画面 |
| `chime` | `chime.ogg` | Kenney UI Audio | 276ms | 游戏进程就绪（启动画面进入 ready） |
| `deep` | `deep.ogg` | Kenney UI Audio | 约 0.5s | 进入睡眠模式 |

`click.ogg` / `switch.ogg` 目前只是同源别名，未单独触发；如果不需要可以删除。

## 2. 按钮/选项 → 音效

### 导航与列表
| 操作 | 音效 |
| --- | --- |
| 点击「首页」标签 | `back` |
| 点击「游戏库 / 外观 / 设置」标签 | `open` |
| 键盘 ←/→、手柄十字键切换游戏 | `move` |
| 点击游戏卡片 / 选择游戏 | `select` |
| 游戏库筛选块（全部/最近/收藏/Steam） | `toggle` |
| 游戏库搜索清空（×） | `select` |
| 游戏库排序下拉（最近/名称/时长） | `select` |
| 打开游戏库/外观/设置页面 | `open` |
| 关闭游戏库/外观/设置 | `back` |

### 首页与详情
| 操作 | 音效 |
| --- | --- |
| 打开游戏详情 | `select` |
| 关闭游戏详情 | `close` |
| 收藏 / 取消收藏 | `select` |
| 打开「管理」面板 | `select` |
| 关闭「管理」面板 | `back` |
| 重新指定程序 / 移除游戏 | `select` |
| 重置封面构图 | `select` |
| 编辑游戏（管理 → 编辑） | `select` |

### 启动
| 操作 | 音效 |
| --- | --- |
| 点击「开始游戏」 | `launchRise` + 合成和弦 |
| 启动画面进入 ready（进程已起来） | `chime` |
| 点击启动画面关闭 / 退出游戏 | `launchFall` |
| 启动失败 | `error` |

### 外观 / 主题
| 操作 | 音效 |
| --- | --- |
| 选择任意主题卡片 | `theme`（幕布），随后 `select` |
| 展开/收起主题列表 | `select` |
| 刷新主题列表 | `select` |
| 打开主题文件夹 | `open` |
| 外观语言「跟随封面 / NOVA 默认」 | `toggle` + `select` |
| 字标换一个（shuffle） | `select` |

### 设置
| 操作 | 音效 |
| --- | --- |
| 保存显示名称 | `select` |
| 使用 Windows 用户名 | `select` |
| 关闭到托盘 / 自动备份 开关 | `toggle` |
| 效果档位下拉 | `select` |
| 导出数据包 / 导入数据包 / CSV / 打开文件夹 | `select` |
| 导入确定 / 选择文件确认 | `confirm` |
| 导入失败 / 保存失败 | `error` |

### 浮层、对话框、文件选择器
| 操作 | 音效 |
| --- | --- |
| 打开通知 / 个人菜单 | `select` |
| 打开通用对话框 | `open` |
| 对话框按钮（确认/取消/危险操作） | `select` |
| 关闭文件选择器（取消） | `close` |
| 文件选择器选中一行 | `select` |
| 文件选择器确认 | `confirm` |
| 手柄在对话框中上下移动 | `move` |
| 按 B / Esc 返回 | `back` |

### 睡眠 / 编辑器 / 扫描器 / 构图
| 操作 | 音效 |
| --- | --- |
| 进入睡眠 | `deep` |
| 退出睡眠 | `select` |
| 打开编辑器 / 扫描器 / 导入选择 | `select` |
| 关闭编辑器 / 扫描器 | `back` |
| 保存编辑器成功 | `select` |
| 保存编辑器失败 | `error` |
| 封面构图锁定 / 拖拽模式切换 | `toggle` |
| 构图缩放/平移按钮 | `select` |

## 3. 预留但未接线的 cue

| Cue | 建议用途 | 现状 |
| --- | --- | --- |
| `tick` | 鼠标悬停在按钮/卡片上的极轻提示 | `audio.hover()` 已实现但未调用 |
| `confirm` | 危险操作二次确认（删除游戏/退出） | 目前只在文件选择器确认时使用 |
| `click` / `switch` | 可作为轻点击/开关的备用层 | 与 `select` / `theme` 同源占位 |

如果希望我先把 `tick` 接到鼠标悬停、把 `confirm` 接到删除/退出确认，告诉我即可；
否则按上表提供同名文件就能直接替换。
