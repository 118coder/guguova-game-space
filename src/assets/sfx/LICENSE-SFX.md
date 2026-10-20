# 音效来源：用 genny 生成

本项目 1.6.3 起的所有界面音效**都是本地合成生成的**，不含任何第三方采样。

## 工具

[genny](https://github.com/ogomez92/genny) —— 离线程序化音效生成 CLI（numpy + scipy），
接受 JSON 规格并渲染成 WAV，无需联网、无需模型。

```bash
git clone https://github.com/ogomez92/genny
cd genny && python install.py --tool    # 安装 genny 命令
genny --version
```

## 规格文件

生成规格保存在 `tools/sfx-specs/`，可直接复现：

| 文件 | 内容 |
| --- | --- |
| `ui.json` | 13 个通用界面音效（其中 4 个后来在 `ui-fix.json` 里修正了亮度） |
| `ui-fix.json` | `click` / `nav` / `soft` / `tick` 的最终版本 |
| `themes.json` | 6 套主题 × 4 个事件音 |

```bash
genny render tools/sfx-specs/ui.json --out-dir _sfxgen
genny render tools/sfx-specs/ui-fix.json --out-dir _sfxgen
genny render tools/sfx-specs/themes.json --out-dir _sfxgen
```

## 转成 OGG

生成的是 44.1kHz WAV；项目用 OGG Vorbis q5 单声道：

```bash
ffmpeg -i ui/bong.wav -c:a libvorbis -q:a 5 -ac 1 \
  src/assets/sfx/bong.ogg -y
```

## 质量门槛

genny 自带 `sharp` / `above5k` 指标，用来判断"会不会刺耳"。
本项目采用的标准（与 genny 手册一致）：

| 指标 | 合格 | 说明 |
| --- | --- | --- |
| `sharp` | ≤ 2.0 | 超过 2.0 是"咬耳朵" |
| `above5k` | ≤ 3 % | 超过 3 % 是"尖" |
| `peak` | −1.0 dB | 统一峰值，避免削波 |

生成时的实际结果：

- `click` 初版 sharp=1.99 → 降 cutoff 后 1.25
- `nav` 初版 sharp=2.12 → 1.34
- `tick` 初版 sharp=2.72、above5k=100% → 1.93、0%
- `summer/switch` 初版 sharp=2.02、above5k=20.8% → 1.33、0%
- 其余全部一次通过

## 授权

genny 是 MIT 许可的生成工具；生成结果由合成器直接产生，不含受版权保护的录音素材。
因此本项目的音效**无第三方授权负担**，可随应用自由分发。

早前版本使用的 Kenney CC0 采样已被完全替换；
`LICENSE-Kenney.txt` 保留仅作历史记录，当前不再引用任何 Kenney 文件。
