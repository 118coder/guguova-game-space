# 示例封面（虚构条目）

仓库截图里的 6 款游戏都是虚构的，封面不是任何真实游戏的画面，也不用任何外部素材。
所有图都由 `tools/demo-covers.py` 生成：纯排版 + 几何，字体是本机的思源宋体和思源黑体。

## 为什么不用真实游戏

启动器是给玩家的工具，仓库里的截图应该说明「界面长什么样」，而不是「我们装了哪些游戏」。
用真实游戏的封面会把别人的美术作品卷进来，也会让截图看起来像广告。

## 两款图，各管一件事

每款游戏输出两张 1920×1080 的图：

| 文件 | 用途 | 特点 |
|---|---|---|
| `cover.jpg` | 游戏条、游戏库卡片、主题卡片 | 带字排版（标题、拉丁副标、章节） |
| `hero.jpg` | 全屏主视觉、详情页左栏 | 同一套几何，**不带字** |

主视觉必须无字：16:9 的封面放进 1439×1124 的窗口会被裁切，
封面上的大字一旦被放大成背景墙，就会和界面自己的标题打架。

## 复现

```bash
# 1. 生成 HTML（6 款 × 2 版）
python tools/demo-covers.py ../_shots/covers

# 2. 用无头浏览器渲染（Edge / Chrome 均可）
msedge --headless=new --disable-gpu --hide-scrollbars \
  --window-size=1920,1080 --screenshot=out.png file:///.../emberwaltz.html

# 3. 转 JPG
ffmpeg -i out.png -q:v 3 out.jpg

# 4. 放进数据目录
#    %LOCALAPPDATA%\NOVA Game Space\media\<gameId>\cover.jpg
#    %LOCALAPPDATA%\NOVA Game Space\media\<gameId>\hero.jpg
```

## 六款示例

| 条目 | 版式 | 主色 |
|---|---|---|
| 沉睡的法则 Things as They Are | 宋体两行大标题 + 同心弧 + 罗马章节 | 灰玫瑰 `#a4605c` |
| 噩梦摇篮：献花于你 | 实心/空心双行 + 十字记号 + 竖排题记 | 雾紫 `#b3a6f0` |
| 星火圆舞曲 Emberwaltz | 圆环 + 三拍节奏点 + 巨型 3/4 幽灵字 | 余烬橙 `#e08a4e` |
| 钴蓝时刻 Cobalt Hour | 表盘刻度 + 指针 + 24 幽灵字 | 钴蓝 `#7fb0e8` |
| 晴日小屋 Sunroom | 窗格 + 百叶 + 实心方形太阳 | 干草金 `#c08a34` |
| 计算冒险 Calc Quest | 方格纸 + 运算符竖列 + 错位标题 | 砖红 `#a0524a` |

改配色或文字：编辑 `tools/demo-covers.py` 顶部的 `GAMES` 列表，重跑即可。
