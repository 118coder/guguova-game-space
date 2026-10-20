# NOVA 音效生成需求（AI 生成用）

> 用途：交给音效生成 AI，产出可直接放进 `src/assets/sfx/` 的 OGG 文件。
> 生成后按「文件名」保存，覆盖同名文件即可，不需要改代码。

---

## 0. 统一风格约定（务必先读）

**一句话风格定位**：一台安静的软件控制台，不是游戏、不是电影。
所有音效都是「界面反馈」，不是「事件演出」。

### 质感

- **合成器为主，不要在录音素材里找**：正弦 / 三角 / 方波经轻度滤波，偶尔加一点玻璃质感的高频泛音。
- **短促、干净、无混响尾巴**（最大混响不超过 120ms）。界面音效叠在一起不能糊。
- **不要 drums、不要 loop、不要人声、不要 8-bit 味道**。

### 频段

- 主音集中在 **300Hz – 4kHz**，这是笔记本小喇叭也能听清的区间。
- 低频（< 150Hz）只允许出现在「启动/睡眠」这类重量级事件里，且要短。
- 高频不要拉满，峰值止于 **8kHz** 左右，避免刺耳。

### 响度

- 峰值统一压在 **−1 dBFS**，不削波。
- 平均响度参考 **−18 dBFS**。
- 同一个文件里不要有突然的爆音头，用 1–3ms 的淡入。

### 技术参数

| 项 | 要求 |
| --- | --- |
| 格式 | OGG Vorbis，质量 q5 |
| 采样率 | 44100 Hz |
| 声道 | 单声道（`theme` / `boot` 可用立体声） |
| 调性 | 统一在 **A 小调** 或相关的五声音阶上，保证任意两个音效同时响起不打架 |
| 淡出 | 结尾必须有 5–15ms 淡出，禁止硬切 |

### 情绪

- 冷静、克制、略带暖意。
- 不欢快、不悲伤、不戏剧化。目标是「用久了不会烦」。

---

## 1. 通用界面音效（替换现有文件）

| 文件名 | 角色 | 时长 | 需求描述 |
| --- | --- | --- | --- |
| `bong.ogg` | 方向性切换 | **120ms ±10ms** | 一个干净的中频"咚"，像手指轻敲木鱼边缘。音高随方向微变：向右/下略高，向左/上略低。带极短的木质打击感（2–4ms 起音）。这是最高频的音效，必须耐听。 |
| `click.ogg` | 普通按钮 | **10–14ms** | 极短的一次"嗒"。像鼠标微动开关，但更柔和。只有起音，几乎没有衰减尾巴。频段集中在 1.5–3kHz。 |
| `nav.ogg` | 打开页面 | **12–18ms** | 和 `click` 同一音色家族，但音高略高、稍长一点点，暗示"进入"。听感上应该能分辨出它比 `click` 更"向上"。 |
| `soft.ogg` | 关闭/返回/开关 | **12–18ms** | 同家族，音高比 `click` 略低，暗示"退后/收起"。和 `nav` 形成一高一低的对称。 |
| `select.ogg` | 较重选择 | **280–300ms** | 两音上行小三度（如 A4→C5），先响的一声稍短，后一声带轻微延音。像确认了一件事。 |
| `confirm.ogg` | 最终确认 | **530–550ms** | `select` 的加强版：三音上行（A4→C5→E5），最后一音延音 200ms 并缓慢淡出。要有"完成"的落定感。 |
| `error.ogg` | 失败 | **160–180ms** | 两音**下行**小二度或大二度，音色略钝（低通滤波），不要刺耳的蜂鸣。表达"没成"，不是"出错了"。 |
| `tick.ogg` | 鼠标悬停 | **35–45ms** | 比 `click` 更轻更薄的高频气声（4–6kHz），几乎像呼吸。音量极低，悬停时若有若无。 |
| `chime.ogg` | 游戏就绪 | **270–290ms** | 一个清亮的高音铃（C6 附近），带轻微颤音和自然衰减。要有"亮起来"的感觉，但不要教堂钟声那种庄严。 |
| `deep.ogg` | 进入睡眠 | **190–210ms** | 一个向下的低频滑音（从约 220Hz 滑到 110Hz），带轻微低通，像灯慢慢暗下来。不要有打击头。 |
| `launch-rise.ogg` | 开始游戏 | **250–270ms** | 向上的能量感：低频微涨 + 中频滑音上行五度。这是整个界面最"有力量"的音效，但仍要克制，不能像开机音效那样张扬。 |
| `launch-fall.ogg` | 关闭启动画面 | **250–270ms** | 与 `launch-rise` 镜像：向下的滑音，收束、平静。两者必须是同一音色家族，听起来像"同一个动作的正反". |

---

## 2. 启动器启动音（新增）

| 文件名 | 角色 | 时长 | 需求描述 |
| --- | --- | --- | --- |
| `boot.ogg` | NOVA 启动 | **1200–1500ms** | 开屏动画对应的音效。结构建议：<br>0–150ms 极轻的低频嗡鸣淡入<br>150–600ms 三音上行琶音（A3→C4→E4），每音 120ms 间隔<br>600–1000ms 主音 E4 延音，叠加一个高八度的微弱泛音<br>1000–1400ms 整体缓慢淡出<br>不应有打击乐，不要"叮"的一声结束。要像一台机器安静地醒来。 |

---

## 3. 主题专属音效（新增 · 每主题 4 个）

每套主题一套 4 个音效，**共享同一个调性骨架（A 小调五声）**，只换音色和演奏法。
这样切换主题时不会突兀，但每套主题的"性格"能听出来。

命名规则：`theme-<主题id>-<事件>.ogg`
事件固定为：`switch`（切换主题）、`launch`（启动游戏）、`exit`（结束游戏）、`boot`（启动器启动）

### 3.1 终末地 · ENDFIELD（`endfield`）

**设定**：工业、纸面、一个酸性黄的信号。冷、硬、精确。

| 文件 | 时长 | 描述 |
| --- | --- | --- |
| `theme-endfield-switch.ogg` | 400ms | 机械卡扣声：两段短促的方形波脉冲（间隔 90ms），像继电器吸合。不要有音高感，要"咔—咔"。 |
| `theme-endfield-launch.ogg` | 600ms | 低频马达启动：60Hz 嗡鸣 200ms 内从无到有，然后叠一个上行的窄带噪声扫频，像气闸打开。 |
| `theme-endfield-exit.ogg` | 450ms | 反向的卡扣：气压泄放的白噪声扫频下行，加一声闷响收尾。 |
| `theme-endfield-boot.ogg` | 1200ms | 系统自检：三声等间隔的短脉冲（模拟读数），然后一段稳定的低频驻留 400ms 后切断。 |

### 3.2 舞台残响 · RIOT（`riot`）

**设定**：剧场、红色、聚光灯。有一点点回声和戏剧感，但仍是工具。

| 文件 | 时长 | 描述 |
| --- | --- | --- |
| `theme-riot-switch.ogg` | 500ms | 幕布滑动的摩擦感：带通滤波的噪声，200ms 内扫过中频，尾部有一点点房间混响（不超过 150ms）。 |
| `theme-riot-launch.ogg` | 700ms | 定音鼓的极轻一击 + 弦乐泛音上扬。鼓要虚，是"提示"不是"敲击"。 |
| `theme-riot-exit.ogg` | 600ms | 幕布落下：同上摩擦感但方向向下，末尾一声轻的木质"嗒"。 |
| `theme-riot-boot.ogg` | 1400ms | 剧场开场：极轻的观众席底噪（低声、模糊）淡入 300ms，然后一声干净的三和弦（A 小三）被点亮，缓缓淡出。 |

### 3.3 冒险者档案 · GRIMOIRE（`grimoire`）

**设定**：羊皮纸、酒红、烫金。古典、手抄本、有年头的物件。

| 文件 | 时长 | 描述 |
| --- | --- | --- |
| `theme-grimoire-switch.ogg` | 450ms | 翻页声：一小段干燥的纸摩擦（高频噪声，带随机起伏），结尾一个很轻的纸落下的钝响。 |
| `theme-grimoire-launch.ogg` | 750ms | 蜡封压下的沉稳一击（低频为主），随后一个竖琴式的上行三音。 |
| `theme-grimoire-exit.ogg` | 550ms | 合上书：两声纸摩擦，第二声更闷，末尾安静收束。 |
| `theme-grimoire-boot.ogg` | 1500ms | 印章与羽毛笔：羽毛划纸的细微声 300ms，然后一声低沉的钟（但不要教堂钟，要小的、近的），余音 600ms。 |

### 3.4 深夜广播 · BROADCAST（`broadcast`）

**设定**：CRT、扫描线、凌晨的电台。轻微失真、有电流感。

| 文件 | 时长 | 描述 |
| --- | --- | --- |
| `theme-broadcast-switch.ogg` | 350ms | 调频旋钮：一段带轻微失真的中频扫频（像搜台），结尾"咔"一声锁定。 |
| `theme-broadcast-launch.ogg` | 650ms | 信号接通：50Hz 交流嗡 150ms，然后一个干净的正弦音浮现出来，带轻微颤音。 |
| `theme-broadcast-exit.ogg` | 400ms | 关掉收音机：嗡鸣骤停，剩一个高频"嘶"的余韵 150ms。 |
| `theme-broadcast-boot.ogg` | 1300ms | 开机：CRT 高压启动的"嗡"由低到高 200ms，然后雪花噪声 300ms 淡出，最后落在一个稳定的低频。 |

### 3.5 神秘管理局 · MNEMO（`mnemo`）

**设定**：梅红、记忆条带、档案室。冷静、略有疏离感、像在读取什么。

| 文件 | 时长 | 描述 |
| --- | --- | --- |
| `theme-mnemo-switch.ogg` | 400ms | 档案卡滑过：一段柔和的滤波噪声，带一个很短的高音"滴"。 |
| `theme-mnemo-launch.ogg` | 650ms | 记忆展开：一个音被分成两个略微失谐的副本（chorus 感），同时缓慢上扬。 |
| `theme-mnemo-exit.ogg` | 450ms | 记忆收束：失谐的两音重新合为一个，音量收小。 |
| `theme-mnemo-boot.ogg` | 1400ms | 档案室开机：四个等间隔的柔和脉冲（像检索），间隔 200ms，然后一段短暂的空气感静默。 |

### 3.6 夏日轻程 · SUMMER（`summer`）

**设定**：白纸、天蓝、柠檬黄。轻、明亮、有呼吸感。

| 文件 | 时长 | 描述 |
| --- | --- | --- |
| `theme-summer-switch.ogg` | 400ms | 白纸翻动：非常轻的高频噪声，短促、干净、无混响。 |
| `theme-summer-launch.ogg` | 600ms | 明亮的两音上行（高八度区域），带一点玻璃音色，像阳光照进来。 |
| `theme-summer-exit.ogg` | 450ms | 阴影掠过：一个柔和的滤波器逐渐关小，音高微降。 |
| `theme-summer-boot.ogg` | 1200ms | 清晨：三个稀疏的高音（间隔 300ms），每个带很长的淡出，之间留白。 |

---

## 4. 交付清单

```
boot.ogg
bong.ogg  click.ogg  nav.ogg  soft.ogg
select.ogg  confirm.ogg  error.ogg  tick.ogg
chime.ogg  deep.ogg  launch-rise.ogg  launch-fall.ogg

theme-endfield-switch.ogg   theme-endfield-launch.ogg   theme-endfield-exit.ogg   theme-endfield-boot.ogg
theme-riot-switch.ogg       theme-riot-launch.ogg       theme-riot-exit.ogg       theme-riot-boot.ogg
theme-grimoire-switch.ogg   theme-grimoire-launch.ogg   theme-grimoire-exit.ogg   theme-grimoire-boot.ogg
theme-broadcast-switch.ogg  theme-broadcast-launch.ogg  theme-broadcast-exit.ogg  theme-broadcast-boot.ogg
theme-mnemo-switch.ogg      theme-mnemo-launch.ogg      theme-mnemo-exit.ogg      theme-mnemo-boot.ogg
theme-summer-switch.ogg     theme-summer-launch.ogg     theme-summer-exit.ogg     theme-summer-boot.ogg
```

共 **33 个文件**。其中 13 个是替换，20 个是新增。

### 生成时的注意事项

1. **同一主题的 4 个音效要一起生成**，用同一套音色参数，否则听起来不像一家人。
2. **`launch` 和 `exit` 要互为镜像**（一个上行一个下行），玩家会连续听到它们。
3. **`switch` 是最高频的**，每次换主题都响，必须最克制。
4. **`boot` 允许最长**，因为开屏时有动画覆盖，不会被误认为卡顿。
5. 如果 AI 支持，附上「不要有音乐性，不要有节奏循环」这句话可以明显改善结果。

---

## 5. 放进主题里的方法（生成完之后）

音效不是必须放在 `src/assets/sfx/`。每套主题可以自带 4 个事件音，
放在主题自己的目录里，随主题一起分发：

```
themes/<主题id>/sounds/
├─ switch.ogg     切换到这个主题时
├─ launch.ogg     在这个主题下启动游戏
├─ exit.ogg       在这个主题下结束游戏
└─ boot.ogg       以这个主题启动 NOVA
```

然后在 `themes/<主题id>/theme.json` 里声明：

```json
"intro": "vinyl",
"sounds": {
  "switch": "sounds/switch.ogg",
  "launch": "sounds/launch.ogg",
  "exit":   "sounds/exit.ogg",
  "boot":   "sounds/boot.ogg"
}
```

规则：

- **只写你有的**。没声明的 cue 自动回落到通用音效，不会变成静音。
- 路径必须是主题文件夹内的相对路径，含 `..` 或指向文件夹外的会被忽略。
- 文件缺失或解码失败时，同样回落到通用音效。
- 主题音效**完全替代**通用音效，不会叠加（否则一次操作会响两下）。

> 现在还没有任何主题带音效，所以行为和之前完全一样。
> 把上面 4 个文件放进主题目录、在 theme.json 声明一下，就生效了。
