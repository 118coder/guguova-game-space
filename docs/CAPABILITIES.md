# NOVA · 可选加速能力层（WebGPU / WebAssembly）

> 适用版本：**1.16.0**
>
> 这份文档回答三个问题：加速层能做什么、什么时候用哪一档、以及为什么
> 门槛是测出来的而不是拍脑袋定的。

---

## 1. 设计原则

一条规则压过其余所有考虑：

> **加速只买速度，不买功能。**

任一档缺失时，结果必须完全一致，只是慢一点。因此：

- 页面永不因为 WebGPU 不可用而缺界面；
- WASM 文件丢了退回纯 JS，数值不变；
- GPU 进程崩了，宿主转软件渲染并把状态告诉页面，页面下一次就走去掉 GPU 的路。

这条规则的代价是：三套实现必须逐位对得上。`tools/test-palette.js` 就是为了
让「对得上」这件事可验证而不是靠人盯着。

---

## 2. 三档能力

| 档 | 触发条件 | 用于 | 实测（192×108 缩略图） |
| --- | --- | --- | --- |
| `gpu` | WebGPU 适配器可用 + GPU 进程健康 | ≥ 1M 像素的整幅主视觉 | 21.3ms（1600×900） |
| `wasm` | `nova_palette.wasm` 加载成功 | 其余全部 | 0.3ms |
| `js` | 以上都不行 | 兜底 | 1.1ms |

页面通过 `<html>` 上的三个属性暴露状态，主题和 QA 可以直接读：

| 属性 | 取值 | 含义 |
| --- | --- | --- |
| `data-palette-tier` | `gpu` / `wasm` / `js` | 当前生效的取色后端 |
| `data-gpu` | `on` / `off` / `lost` | WebGPU 状态（`lost` = 设备丢失或宿主已降级） |
| `data-tier` | `full` / `balanced` / `safe` | 既有能力档位，与本文无关 |

---

## 3. 文件

| 文件 | 作用 |
| --- | --- |
| `src/capability/palette.js` | 纯 JS 参考实现，永远可用。**所有其他实现的基准** |
| `src/capability/gpu-palette.js` | WGSL compute shader + 设备生命周期 |
| `src/capability/capability.js` | 探测、路由、降级。唯一对外入口 `window.NovaCapability` |
| `src/capability/diag.js` | 诊断：`window.NovaDiag.report()`，或 URL 加 `?diag=1` 显示角标 |
| `wasm/palette/` | Rust crate（`no_std`，无分配器） |
| `src/assets/nova_palette.wasm` | 编译产物，**入库**，4.3 KB |
| `tools/build-wasm.js` | 构建 / `--check` 校验产物与源码一致 |
| `tools/test-palette.js` | 三后端一致性测试 |

`.wasm` 入库意味着普通构建不需要 Rust 工具链。只有改了 `lib.rs` 才需要
`cargo`，并且 `--check` 会在发布流水线里拦住「忘了重新编译」。

---

## 4. 后端选择是测出来的

这是本轮最重要的一张表。同一张图，三种后端，取中位数（本机 RTX 级适配器）：

| 图像 | 像素 | JS | WASM | GPU | 胜者 |
| --- | --- | --- | --- | --- | --- |
| 96×54 | 5.2k | 0.3ms | 0.1ms | 3.0ms | WASM |
| 192×108 | 20.7k | 1.1ms | 0.3ms | 3.0ms | WASM |
| 384×216 | 82.9k | 2.6ms | 1.1ms | 5.4ms | WASM |
| 768×432 | 331.8k | 9.6ms | 4.3ms | 6.6ms | WASM |
| 1920×1080 | 2073.6k | 58.6ms | 25.8ms | 20.6ms | GPU |

两个结论直接决定路由：

1. **WASM 在所有尺寸都快 2.2–3 倍**，且没有值得提的固定开销 → 默认走它；
2. **GPU 一次往返有约 3ms 固定成本**（建 buffer、提交、map 回读），
   到 768×432 都还比 WASM 慢，要到百万像素级才赢。

因此 `GPU_MIN_PIXELS = 1_000_000`。

> **这里踩过坑**：最初的实现是「有 GPU 就用 GPU」，结果缩略图从 0.4ms
> 变成 3.0ms，慢了 8 倍。这类回归不会报错、不会白屏，只会让启动慢一点，
> 所以必须有基准工具盯着。

---

## 5. 一致性约束

三套实现共用同一套算法参数，改动任何一处都必须同步：

| 参数 | 值 | 出现在 |
| --- | --- | --- |
| 色相桶数 | 24，每桶 15° | `palette.js` / `lib.rs` / WGSL |
| 有效色相门槛 | `sat > 0.18 && value > 0.16` | 同上 |
| 主色 clamp | sat ∈ [0.32, 0.82]，val ∈ [0.55, 0.95] | 同上 |
| 次色 clamp | sat ∈ [0.38, 0.80]，val ∈ [0.55, 0.90] | 同上 |
| 边缘阈值 | `dx + dy > 0.12` | 同上 |
| 亮度权重 | Rec.709：`.2126 / .7152 / .0722` | 同上 |
| 结果布局 | 16 个 float，见下 | `palette.js` / `lib.rs` / `capability.js` |

结果布局：

```
0..2   accent rgb     3..5   accent2 rgb
6..8   light rgb      9..11  dark rgb
12     luma           13     saturation
14     warmth         15     edge density
```

**GPU 返回的形状不同**：它返回 77 个槽位（24 色相权重 + 24 饱和权重 +
24 明度权重 + sumR/sumB/sumLuma/sumSat/样本数）。颜色选择逻辑统一在
`capability.js` 的 `fromGpuSlots()` 里做，这样三后端共享同一份解读代码，
不会各写一份逐渐漂移。GPU 路径不算边缘密度，按约定填 `0`（= 未知）。

`tools/test-palette.js` 用 10 组合成图（纯色、渐变、噪声、棋盘格）比对
JS 与 WASM，容差 `1.5e-3`。容差存在是因为 float32 累加顺序不同，不是
允许算法不同。

---

## 6. GPU 崩溃自愈

WebView2 的 GPU 进程会因驱动重置、着色器缓存损坏、远程会话而退出，
现象是 `GPU process isn't usable. Goodbye.` 与一个白窗口。

`MainWindow.xaml.cs` 现在处理 `GpuProcessExited`：

1. 写标记文件 `%LOCALAPPDATA%\NOVA Game Space\gpu-fallback.txt`；
2. 通知页面 `gpu-degraded`，页面把 `data-gpu` 置 `lost`，路由改用 WASM；
3. 用 `--disable-gpu --disable-gpu-compositing` 重建 WebView2 环境并重载；
4. **下次启动**读到标记就直接走软件渲染，不会每次崩一遍。

驱动更新后想重新试 GPU：删掉标记文件，或设 `NOVA_IGNORE_GPU_FALLBACK=1`。

> 之前只有 `RenderProcessExited` 被处理，GPU 退出无人接管。这是本轮补的
> 缺口，也是「默认开启 GPU」能成立的前提。

---

## 7. API

```js
// 探测（幂等；force 强制重测）
await window.NovaCapability.probe({ force: false });
// -> { wasm, gpu, tier, notes: [...] }

// 取色：自动按尺寸选后端
const palette = await window.NovaCapability.analyse(imageData.data, w, h, { step: 1 });
// 强制某后端（QA 用）
await window.NovaCapability.analyse(data, w, h, { backend: 'wasm' });

// 只看会选谁，不执行
window.NovaCapability.plan(w, h);   // 'gpu' | 'wasm' | 'js'

// 诊断
await window.NovaDiag.report();
```

`step` 是抽样步长。实测把整幅图的步长设 3，luma 只漂移 0.0018
（阈值 0.02），而像素量降到九分之一。大图取色优先用这个。

---

## 8. 验证

```bash
node tools/build-wasm.js --check     # 产物与源码一致
node tools/test-palette.js           # JS 与 WASM 逐案一致
NOVA_CDP_PORT=9333 node tools/perf-baseline.js   # 页面性能预算
```

`theme-slot-check.js` 与 `test-palette.js` 已接入 `tools/release.sh`；
`build-wasm.js --check` 建议在改过 `wasm/` 后手动跑一次。

---

## 9. 明确不做的

- **不用 WebGPU 画界面**。主题是 CSS，换成 shader 会让 14 套主题全部重写，
  收益不成立。
- **不用 WASM 重写业务逻辑**。没有测得的热点，重写只会增加维护面。
- **不做 GPU 端边缘检测**。它需要整幅图的 luma 网格驻留显存，而边缘密度
  只用于详情页一行读数，CPU 侧已经够快。
