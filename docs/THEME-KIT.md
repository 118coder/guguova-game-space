# NOVA 主题统一视觉框架（THEME KIT）

> 目标：把「每套主题各自写一套版式」收敛成
> **一套版式契约 + 每套主题只提供调色板 / 字体 / 插画**。
> 框架是可选的：主题在 `theme.json` 的 `features` 里逐项声明，不写就不生效。

- 实现：`src/theme-kit.css`（由 `src/index.html` 静态加载，位于 `theme-fx.css` 之后）
- 开关：`theme.json` → `features` → `theme-engine.js` 写成 `<html data-fx-*="…">`
- 内置 `nova` 与 `endfield` 不声明任何模块，行为完全不变。

---

## 1. 模块开关

| features 键 | 值 | 作用 | 关闭方式 |
|---|---|---|---|
| `hero` | `plate` | 主视觉变成「文字列 + 右侧插画位」；插画由 `--kit-art-url` 提供，**结构上不可能压到文字** | 不写 / `none` |
| `header` | `rule` | 顶栏实色 + 1px 分界线；导航强制单行（隐藏 `// HOME` 这类微标签） | 不写 / `none` |
| `cards` | `rule` | 游戏卡 / 库卡 / 活动条 / 主题卡统一 1px 描边，去掉暗化渐变 | 不写 / `none` |
| `plates` | `off` | 撤掉旧签名层加在标题 / 说明 / 眉标上的半透明底板与硬影 | 不写 |
| `scrim` | `none` | 关掉框架压在 `.atmosphere` 之上的照片白纱（SUMMER 在用） | 不写 |

> `controls=hard` 已弃用：按钮由每套主题在 `theme.css` 里自行定义。
> 新增主题不要再用统一按钮；在 `docs/themes/<id>.md` 登记配方即可。

`hero` 在 ≤1024px 自动收起插画列，文字恢复整幅（`hero` 模块内置，无需主题处理）。

---

## 2. 主题必须提供的变量

在 `theme.css` 的 `html[data-theme="<id>"]` 里写（值来自该主题的调色板）：

```css
html[data-theme="summer"] {
  --kit-paper: #fdfbf6;      /* 主视觉板 / 顶栏 */
  --kit-panel: #ffffff;      /* 卡片 / 弹层 */
  --kit-ink: #101820;        /* 主文字、描边 */
  --kit-ink-2: #3d4d58;      /* 次级文字 */
  --kit-line: rgba(16,24,32,.28);
  --kit-accent: #e2f53c;     /* 主操作 / 当前项 */
  --kit-accent-2: #eefb72;   /* 悬停 / 高亮条 */
  --kit-on-accent: #101820;
  --kit-r: 2px;              /* 0 / 2 / 6，最大 10 */
  --kit-art: 360px;          /* 插画列宽；写 0 等于不要插画 */
  --kit-art-url: url("assets/hero-summer.svg?v=1");
  --kit-art-rule: 2px solid #101820;
  --kit-shadow: #101820;
}
```

约定：

- `--kit-art` 建议 `clamp(220px, 27vw, 360px)`；低于 1024px 由框架收起。
- 插画必须是**硬边 SVG**，不要位图、不要 `filter: blur()`、不要发光。
- 插画 URL 必须带 `?v=<theme version>`，否则 WebView 会缓存旧图。
- 颜色职责不变：`--accent` 只做小面积信号，正文永远用 `--kit-ink`。

### 2.1 运行时可用的数据变量

`src/app.js` 与 `src/fx-record.js` 会把真实数据写到 `<html>`，主题可直接消费：

| 变量 | 示例 | 用途 |
|---|---|---|
| `--nova-hero` | `url("https://nova.media/.../hero.jpg")` | 把当前游戏主视觉放进肖像卡 / 印版照片 |
| `--nova-record` | `"No.03 / 06"` | 档号 |
| `--nova-hours` | `"12.4"` | 累计小时 |
| `--nova-state` | `"new" / "played" / "missing"` | 状态 |

示例（GRIMOIRE 的肖像卡）：

```css
html[data-theme="grimoire"] .hero-inner::after {
  content: var(--nova-record, "");
  background-image:
    linear-gradient(rgba(20,13,7,0) 52%, rgba(20,13,7,.78) 100%),
    var(--nova-hero, none);
  background-size: auto, cover;
  background-position: center, 50% 26%;
}
```

> 完整接口、公共选择器、按钮配方、开屏/进游戏清单见
> [`docs/THEME-INTERFACES.md`](THEME-INTERFACES.md)，单主题卡片在
> [`docs/themes/`](themes/README.md)。

---

## 3. 插画位（hero art）设计规范

插画占主视觉右侧一列，实际尺寸约 **300–360 × 500 px**，`background-size: cover`。
画布建议 `viewBox="0 0 300 520"`，四周留 6px 安全边。

必须做到：

1. **只画装饰，不画文字**。插画里不要出现任何需要阅读的字（编号、字母图案除外，且不得像正文）。
2. 主体集中在中下 2/3；顶部 15% 留空，避免与眉标行在同一水平线抢注意力。
3. 硬边、有限色（3–5 色）、可平涂。需要层次时用**同色系明度台阶**，不用模糊。
4. 与文字列之间由 `--kit-art-rule` 画一条 1–2px 分隔线；不要用羽化 / 阴影过渡。
5. 视觉重心不要贴着左边缘（会被分隔线切掉），也不要贴着右边缘（会被圆角裁切）。

---

## 4. 每套主题的交付物

```
themes/<id>/theme.css        末尾追加签名段（变量 + 规则）
themes/<id>/theme.json       features / intro / version
themes/<id>/assets/hero-*.svg  1 张插画（若使用 hero=plate）
themes/<id>/assets/preview.jpg 16:9 概念板预览（render-concepts.js）
docs/themes/<id>.md          单主题接口卡（设计语言 / 控件 / 版本 / 验收）
```

不要修改：

- `src/theme-kit.css`、`src/theme-engine.js`、`src/index.html`（框架层由主线维护）
- 其他主题目录

---

## 5. 验收

```bash
node tools/export-all.js --themes=<id> --views=home,detail,library,appearance \
     --sizes=1439x1124,960x600 --stress
node tools/probe-graphics.js
```

- 0 `overflow-x` / `clipped` / `logo-text-over`
- `probe-graphics` 全 clear（装饰不压字）
- 960×600 下插画列已收起，标题完整
- 30 字以上游戏名（`--stress`）不截断、不换行溢出

---

## 6. 为什么这样做

之前的主题各自实现「主视觉板 + 装饰 + 文字底板」，结果是：

- 同一件事有 9 种写法，改一处要改 9 遍；
- 装饰常常压在标题上（BROADCAST 的幽灵字、GRIMOIRE 的菱形）；
- 为了凑配色占比，把地貌画成巨大的径向渐变，模糊且不可控（SUMMER v1.3–1.4）。

统一框架后，**版式只有一份**，主题之间的差异来自调色板、字体与插画——
既不会互相打架，也允许后续继续加模块（例如 `ornament=corner`、`motion=still`）。
