# NOVA 主题开发规范

> 版本 1.0 · 对应 NOVA Game Space 1.1
> 一个主题可以整套换掉界面的颜色、描边、按钮、图标与纹理，**不会**影响布局逻辑、启动流程或数据。

---

## 1. 主题是什么

主题就是一个文件夹：

```
my-theme/
├─ theme.json       必填，描述这个主题
├─ theme.css        必填（或由 theme.json 的 css 字段指定）
├─ preview.jpg      可选，主题卡片上的预览图，建议 960×540
└─ assets/          可选，你自己的纹理、图标
```

把文件夹放进：

```
%LOCALAPPDATA%\NOVA Game Space\themes\
```

然后在「外观 → 界面主题」点「刷新」，就能看到并选择它。

也可以打包成 `.zip` 分发，解压后只要 `theme.json` 在压缩包的第一层或第二层目录里即可。

> 程序自带的主题（`abyss`）也会出现在这个目录里，可以复制一份改成自己的。

---

## 2. theme.json

```json
{
  "schema": 1,
  "id": "my-theme",
  "name": "我的主题",
  "author": "你的名字",
  "version": "1.0.0",
  "description": "一句话说明这个主题长什么样。",
  "css": "theme.css",
  "preview": "preview.jpg",
  "base": "adaptive",
  "tokens": {
    "--accent": "#d6b270",
    "--accent-2": "#64d8ff"
  },
  "icons": {
    "play": "<path d=\"M8 5l11 7-11 7Z\" fill=\"currentColor\" stroke=\"none\"/>"
  }
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `schema` | 是 | 固定 `1`。 |
| `id` | 建议 | 小写字母、数字、连字符，≤40 字符。留空时用文件夹名。不能用 `nova`。 |
| `name` | 是 | 显示在主题卡片上的名字。 |
| `author` | 否 | 作者。 |
| `version` | 否 | 版本号，建议语义化。程序升级自带主题时会比较它。 |
| `description` | 否 | 卡片提示文字。 |
| `css` | 否 | 主样式表，默认 `theme.css`。 |
| `preview` | 否 | 预览图，默认依次找 `preview.jpg`、`preview.png`。 |
| `base` | 否 | `adaptive` / `system`，选择默认走「跟随封面」还是「NOVA 默认」。 |
| `tokens` | 否 | 直接覆盖 CSS 变量，适合只换配色的轻量主题。 |
| `icons` | 否 | 覆盖内置图标，见第 5 节。 |

### 校验规则

程序会拒绝以下主题，并在卡片上显示原因：

- `schema` 不是 `1`
- 缺少 `name`
- `id` 含非法字符，或与内置 `nova` 重名
- `id` 与已安装主题重复（先装的生效）
- `theme.json` 不是合法 JSON

CSS 文件缺失不会导致失败，只是没有样式覆盖。

---

## 3. 样式怎么写

主题 CSS 最后加载，因此可以直接覆盖基础样式。**不要改布局**，只改外观。

### 3.1 最省事的做法：只给变量

```json
"tokens": {
  "--accent": "#7ee0c0",
  "--accent-2": "#2f8f74",
  "--glow": "rgba(126, 224, 192, .28)"
}
```

这样按钮高光、进度条、开关、焦点环会一起变。适合做「换色包」。

### 3.2 完整主题：写一份 CSS

参考 `themes/abyss/theme.css`，它覆盖了：

- 页面底色、氛围层、噪点与斜纹
- 顶栏、导航、窗口按钮
- 主按钮、次按钮、危险按钮
- 进度条（含分段刻度）
- 活动条、游戏条、封面卡片
- 弹层、菜单、通知、对话框
- 输入框、开关、文件浏览器
- 启动画面、睡眠画面、Toast、手柄提示

### 3.3 必须遵守的几条

1. **不要改尺寸和位置**。可以改 `border-radius`、`border`、`background`、`color`、`box-shadow`、`clip-path`、`font-family`，不要改 `display`、`position`、`width/height`（除非是装饰元素）、`padding` 的大幅变化。
2. **保证对比度**。正文文字与背景至少 4.5:1，按钮文字至少 4.5:1。
3. **深色或浅色都要能读**。如果做浅色主题，记得同时改 `--ink`、`--muted`、`--faint`。
4. **不要用 `!important` 去改按钮的文字颜色以外的东西**。主按钮的渐变由 `--cta-bg` 控制，见 3.4。
5. **不要引用外部网络资源**。所有图片放到主题目录的 `assets/` 里，用相对路径引用。

### 3.4 主按钮

主按钮的颜色由一组变量控制，主题里重新声明即可：

```css
body .btn.primary.cta-adaptive,
body .btn.primary.cta-system {
  --cta-bg: linear-gradient(180deg, #d9b878, #8a6130);
  --cta-bg-hover: linear-gradient(180deg, #ecd093, #9a6d36);
  --cta-fg: #16110a;
  --cta-border: rgba(255, 238, 200, .62);
  background: linear-gradient(180deg, #d9b878, #8a6130);
  color: #16110a;
}
```

> 为什么要写在 `body` 下：基础样式在 `.btn.primary` 上声明了同名变量，
> 用 `body` 前缀可以稳定覆盖，避免和「跟随封面」的内联变量打架。

---

## 4. 可用的 CSS 变量

基础样式已经定义了这些，主题可以直接改：

| 变量 | 用途 |
|---|---|
| `--ink` | 主文字色 |
| `--muted` | 次级文字 |
| `--faint` | 三级文字 |
| `--hair` | 分隔线 |
| `--accent` | 主强调色（进度、开关、选中） |
| `--accent-2` | 次强调色（渐变终点） |
| `--glow` | 光晕 |
| `--ease` | 缓动曲线 |
| `--font-ui` | 正文字体 |
| `--font-display` | 数字与展示字体 |
| `--font-serif` | 衬线字体 |

按钮相关的：`--cta-bg`、`--cta-bg-hover`、`--cta-fg`、`--cta-border`、`--cta-shadow`、`--cta-h`。

标题相关的：`--logo-accent`、`--logo-accent-2`、`--logo-light`、`--logo-dark`。

---

## 5. 换图标

`icons` 里写 SVG 片段，会替换内置图标。键名对应图标 id（去掉 `i-` 前缀）：

```
play, info, search, bell, heart, sliders, fullscreen, moon,
sound-on, sound-off, plus, folder, disc, clock, gamepad,
download, check, close, arrow-right, arrow-left, spark
```

例如把一个播放三角换成圆形播放键：

```json
"icons": {
  "play": "<circle cx=\"12\" cy=\"12\" r=\"8.5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\"/><path d=\"M10 8.6v6.8l5.4-3.4Z\" fill=\"currentColor\" stroke=\"none\"/>"
}
```

写的是 `24×24` 视口内的 SVG 内容，`currentColor` 会跟随文字颜色。

> 图标会覆盖所有使用该图标的地方（主按钮、卡片、菜单等），所以保持风格统一。

---

## 6. 纹理与图片

放在主题目录里，CSS 用相对路径：

```css
body::before {
  background-image: url("assets/metal.png");
  background-size: 256px 256px;
}
```

路径相对于 `theme.css` 所在位置。不能引用主题目录之外的文件。

---

## 7. 调试

1. 改完 CSS 后不需要重启，在「界面主题」里点其他主题再点回来，或者点「刷新」。
2. 程序读取主题时会绕过文件缓存，保存即生效。
3. 主题报错会显示在卡片上。常见原因：JSON 逗号写多了、`id` 用了大写、`css` 路径写错。
4. 想要详细的加载日志，看 `%LOCALAPPDATA%\NOVA Game Space\nova.log`。

---

## 8. 安全边界

主题只能改样式和图标，**不能**：

- 执行脚本
- 读取游戏库、文件路径或任何用户数据
- 调用系统接口
- 访问主题目录以外的文件
- 改动启动逻辑、计时或数据存储

所以可以放心安装别人做的主题，也可以放心把自己做的发给别人。

---

## 9. 打包分发

```bash
# 目录结构
my-theme/
  theme.json
  theme.css
  preview.jpg
  assets/...

# 打包
zip -r my-theme.zip my-theme/
```

用户把 zip 解压到 `themes` 目录，或者在「打开主题文件夹」后放进去，点「刷新」即可。

建议在 `theme.json` 里写清楚 `author` 和 `version`，方便别人辨认和更新。

---

## 10. 参考主题：ABYSS

`themes/abyss/` 是一套完整示例，学它最快：

- 深色锻造金属底 + 斜纹
- 青铜描边与切角（`clip-path`）
- 青色能量进度条（`repeating-linear-gradient` 做刻度）
- 铆钉装饰（`radial-gradient` 画圆点）
- 卡片四角括号（伪元素 + 边框）

它证明了：**只用 CSS，就能把一个薄膜感界面变成完全不同的气质**，而且不需要改任何一行结构代码。
