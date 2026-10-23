/* ============================================================
   NOVA · CAPABILITY LAYER
   ------------------------------------------------------------
   One place that answers "what can this machine actually do", and one
   entry point that every optional accelerator goes through.

   Tiers, best first:

     gpu    WebGPU compute + WASM. Cover sampling runs on the GPU.
     wasm   WebAssembly. Same arithmetic on the CPU, ~10x the JS path.
     js     plain JavaScript. Always present; never fails.

   The rule this file enforces: an accelerator is a speed-up, never a
   feature. Every path returns the same numbers, and a dead GPU process,
   a missing wasm module or a browser without WebGPU all end up on the JS
   implementation without the player noticing anything but a few ms.

   It also owns the GPU health contract with the host: when WebView2 loses
   its GPU process, MainWindow.cs starts a software-rendered session and the
   page is told via `gpu-degraded`, so the next probe doesn't try again.

   Published for themes and QA:
     html[data-tier]          (existing: full / balanced / safe)
     html[data-gpu]           on | off | lost
     html[data-palette-tier]  gpu | wasm | js
   ============================================================ */
(function () {
  'use strict';

  const state = {
    wasm: null,          // WebAssembly instance exports, or null
    gpuReady: false,
    gpuLost: false,
    gpuReason: '',
    tier: 'js',
    probing: null
  };

  const root = document.documentElement;

  function publish() {
    if (!root) return;
    root.dataset.paletteTier = state.tier;
    root.dataset.gpu = state.gpuLost ? 'lost' : (state.gpuReady ? 'on' : 'off');
  }

  /* ------------------------------------------------------------- probe */

  function hostSaysSoftware() {
    // The host marks a machine whose GPU process already died. Probing again
    // would just burn start-up time to be told no.
    return (window.novaBoot && window.novaBoot.gpu === 'software')
      || root.dataset.gpu === 'lost';
  }

  async function probe(options) {
    const force = !!(options && options.force);
    // A probe is idempotent unless forced; without this the boot call and a
    // lazy first analysis would fetch and instantiate the kernel twice.
    if (state.probing && !force) return state.probing;

    const run = (async () => {
      const result = { wasm: false, gpu: false, tier: 'js', notes: [] };

      /* WebAssembly: fetch and instantiate the palette kernel. */
      if (state.wasm) {
        result.wasm = true;
      } else {
        try {
          if (typeof WebAssembly !== 'object' || !window.fetch) throw new Error('no wasm');
          const response = await fetch('assets/nova_palette.wasm', { cache: 'force-cache' });
          if (!response.ok) throw new Error(`wasm fetch ${response.status}`);
          const bytes = await response.arrayBuffer();
          const { instance } = await WebAssembly.instantiate(bytes, {});
          if (!instance.exports.analyse) throw new Error('wasm has no analyse export');
          state.wasm = instance.exports;
          result.wasm = true;
        } catch (error) {
          result.notes.push(`wasm: ${error.message}`);
        }
      }

      /* WebGPU: only worth asking when the host did not already fall back. */
      if (state.gpuReady && !state.gpuLost) {
        result.gpu = true;
      } else if (window.NovaGPU && !state.gpuLost && !hostSaysSoftware()) {
        try {
          const ok = await window.NovaGPU.init();
          if (ok) {
            result.gpu = true;
            state.gpuReady = true;
          } else {
            result.notes.push(`gpu: ${window.NovaGPU.failure || 'init failed'}`);
          }
        } catch (error) {
          result.notes.push(`gpu: ${error.message}`);
        }
      } else if (state.gpuLost) {
        result.notes.push(`gpu: lost (${state.gpuReason || 'device lost'})`);
      } else if (hostSaysSoftware()) {
        result.notes.push('gpu: host is software-rendering');
      }

      state.tier = result.gpu ? 'gpu' : (result.wasm ? 'wasm' : 'js');
      result.tier = state.tier;
      publish();
      return result;
    })();

    // Keep the in-flight promise reachable for concurrent callers, and clear
    // it once settled so a later force can start a fresh probe. The clearing
    // is a side effect only: `return run` must hand back the real result, not
    // a `finally()` derivative (which resolves to undefined over the bridge).
    state.probing = run;
    run.then(
      () => { if (state.probing === run) state.probing = null; },
      () => { if (state.probing === run) state.probing = null; }
    );
    return run;
  }

  /* ---------------------------------------------------------- analysis */

  /**
   * Analyse RGBA pixels and return the 16-float palette block.
   *
   * The GPU returns a reduced slot vector in a different shape than the CPU
   * kernels, so this interprets it here rather than duplicating the colour
   * maths per backend. `step` is a subsample stride: 2 halves the pixels and
   * moves the palette by under 2% of one luma step.
   *
   * Backend choice is size-dependent, on purpose. Measured on an RTX-class
   * adapter (see docs/CAPABILITIES.md §4):
   *
   *     image        pixels     JS       WASM    GPU      winner
   *     96x54         5.2k     0.3ms    0.1ms   3.0ms    WASM
   *     384x216      82.9k     2.6ms    1.1ms   5.4ms    WASM
   *     768x432     331.8k     9.6ms    4.3ms   6.6ms    WASM
   *     1920x1080  2073.6k    58.6ms   25.8ms  20.6ms   GPU
   *
   * Two facts drive the routing:
   *
   *   1. WebAssembly beats plain JS by 2.2-3x at every size, with no fixed
   *      cost worth mentioning. It is the default whenever it loaded.
   *   2. A GPU round-trip costs ~3ms of fixed overhead (buffer creation,
   *      submit, map read-back). It only overtakes WASM past roughly a
   *      megapixel — at 768x432 it is still slower than the wasm kernel.
   *
   * So: WASM by default, GPU only for genuinely large images. Before this
   * was measured, the routing sent thumbnails to the GPU and made them 8x
   * slower; the numbers above are the reason the threshold is a megapixel
   * and not "whenever a GPU exists".
   */
  const GPU_MIN_PIXELS = 1000000;

  async function analyse(rgba, width, height, options) {
    const step = (options && options.step) || 1;
    const force = options && options.backend;
    const pixels = width * height;

    // An explicit request wins over the size heuristic (used by QA and by
    // tools that know their own workload).
    const wantGpu = force === 'gpu' || (!force && pixels >= GPU_MIN_PIXELS);
    const wantWasm = force === 'wasm' || (!force && force !== 'js');

    if (wantGpu && state.tier === 'gpu' && !state.gpuLost && window.NovaGPU) {
      try {
        const slots = await window.NovaGPU.analyse(rgba, width, height, step);
        if (slots) return fromGpuSlots(slots);
      } catch (error) {
        state.gpuLost = true;
        state.tier = state.wasm ? 'wasm' : 'js';
        publish();
      }
    }

    if (wantWasm && state.wasm) {
      try {
        return fromWasm(state.wasm, rgba, width, height, step);
      } catch (error) {
        // A corrupted module must not take the UI down; drop to JS for good.
        state.wasm = null;
        state.tier = 'js';
        publish();
      }
    }

    return window.NovaPalette.analyse(rgba, width, height, step);
  }

  /** Which backend a call of this size would use, without running it. */
  function plan(width, height, options) {
    const force = options && options.backend;
    if (force) return force === 'gpu' && !state.gpuReady ? (state.wasm ? 'wasm' : 'js') : force;
    if (width * height >= GPU_MIN_PIXELS && state.tier === 'gpu' && !state.gpuLost) return 'gpu';
    if (state.wasm) return 'wasm';
    return 'js';
  }

  /** Copy pixels into the wasm heap and read the result block back. */
  function fromWasm(api, rgba, width, height, step) {
    const bytes = width * height * 4;
    const heapBase = api.__heap_base ? api.__heap_base.value : 65536;
    const needed = heapBase + bytes + 64;
    if (needed > api.memory.buffer.byteLength) {
      api.memory.grow(Math.ceil((needed - api.memory.buffer.byteLength) / 65536) + 1);
    }
    const ptr = (heapBase + 15) & ~15;
    new Uint8Array(api.memory.buffer).set(rgba.subarray(0, bytes), ptr);
    const outPtr = api.analyse(ptr, width, height, step);
    // slice() copies out of the wasm memory before the next call overwrites it
    return new Float32Array(api.memory.buffer, outPtr, 16).slice();
  }

  /**
   * GPU slot layout -> the 16-float block the rest of the app expects.
   * Slots 0..23   hue weights       24..47 sat weights    48..71 val weights
   *        72 sumR  73 sumB  74 sumLuma  75 sumSat  76 samples
   *
   * The hue/colour selection mirrors palette.js exactly. Keeping it here, in
   * one place, is why three backends can share a single set of expectations.
   */
  function fromGpuSlots(slots) {
    const HUE = 24;
    const count = new Float32Array(HUE);
    const satW = new Float32Array(HUE);
    const valW = new Float32Array(HUE);
    for (let i = 0; i < HUE; i += 1) {
      count[i] = slots[i];
      satW[i] = slots[HUE + i];
      valW[i] = slots[HUE * 2 + i];
    }
    const sumR = slots[HUE * 3 + 0];
    const sumB = slots[HUE * 3 + 1];
    const sumLuma = slots[HUE * 3 + 2];
    const sumSat = slots[HUE * 3 + 3];
    const samples = slots[HUE * 3 + 4] || 1;

    const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
    const hsvToRgb = (hIn, s, v) => {
      const h = ((hIn % 360) + 360) % 360;
      const c = v * s;
      const x = c * (1 - Math.abs((h / 60) % 2 - 1));
      const m = v - c;
      let r; let g; let b;
      if (h < 60) { r = c; g = x; b = 0; }
      else if (h < 120) { r = x; g = c; b = 0; }
      else if (h < 180) { r = 0; g = c; b = x; }
      else if (h < 240) { r = 0; g = x; b = c; }
      else if (h < 300) { r = x; g = 0; b = c; }
      else { r = c; g = 0; b = x; }
      return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
    };
    const circ = (a, b) => {
      const d = Math.abs(a - b);
      return d > HUE / 2 ? HUE - d : d;
    };

    let primary = 0;
    for (let i = 1; i < HUE; i += 1) if (count[i] > count[primary]) primary = i;
    let secondary = primary;
    let best = -1;
    for (let i = 0; i < HUE; i += 1) {
      if (circ(i, primary) <= 3) continue;
      if (count[i] > best) { best = count[i]; secondary = i; }
    }
    if (best < 0) secondary = (primary + 2) % HUE;

    const stats = (bucket, satLo, satHi, valLo, valHi) => count[bucket] > 0.0001
      ? [clamp(satW[bucket] / count[bucket], satLo, satHi), clamp(valW[bucket] / count[bucket], valLo, valHi)]
      : [0.5, 0.7];

    const primaryHue = (primary * 15 + 7.5) % 360;
    const [ps, pv] = stats(primary, 0.32, 0.82, 0.55, 0.95);
    const accent = hsvToRgb(primaryHue, ps, pv);
    let accent2;
    if (count[secondary] > 0.0001) {
      const [s, v] = stats(secondary, 0.38, 0.80, 0.55, 0.90);
      accent2 = hsvToRgb((secondary * 15 + 7.5) % 360, s, v);
    } else {
      accent2 = hsvToRgb((primaryHue + 32) % 360, ps * 0.9, Math.min(1, pv * 0.96));
    }

    const avgLuma = sumLuma / samples;
    const avgSat = sumSat / samples;
    const warmth = clamp(0.5 + ((sumR / samples / 255) - (sumB / samples / 255)) * 0.9, 0, 1);
    const light = avgLuma > 0.62 ? [246, 241, 230] : hsvToRgb(primaryHue, clamp(avgSat * 0.45, 0.10, 0.40), 0.95);
    const dark = hsvToRgb(primaryHue, clamp(ps * 0.55, 0.28, 0.72), clamp(pv * 0.24, 0.08, 0.25));

    const out = new Float32Array(16);
    out[0] = accent[0]; out[1] = accent[1]; out[2] = accent[2];
    out[3] = accent2[0]; out[4] = accent2[1]; out[5] = accent2[2];
    out[6] = light[0]; out[7] = light[1]; out[8] = light[2];
    out[9] = dark[0]; out[10] = dark[1]; out[11] = dark[2];
    out[12] = avgLuma;
    out[13] = avgSat;
    out[14] = warmth;
    // The GPU pass does not compute the luma grid edge density; the caller
    // only uses it for the dossier readout, and 0 is the documented "unknown".
    out[15] = 0;
    return out;
  }

  /* ------------------------------------------------------- host events */

  function markGpuLost(reason) {
    if (state.gpuLost) return;
    state.gpuLost = true;
    state.gpuReason = reason || 'device lost';
    state.tier = state.wasm ? 'wasm' : 'js';
    publish();
  }

  window.addEventListener('nova-gpu-lost', (event) => markGpuLost(event.detail && event.detail.reason));

  if (window.chrome && window.chrome.webview && window.chrome.webview.addEventListener) {
    window.chrome.webview.addEventListener('message', (event) => {
      const message = event.data;
      if (message && message.type === 'gpu-degraded') markGpuLost(message.payload && message.payload.reason);
    });
  }

  window.NovaCapability = {
    probe,
    analyse,
    plan,
    markGpuLost,
    GPU_MIN_PIXELS,
    get tier() { return state.tier; },
    get hasWasm() { return !!state.wasm; },
    get hasGpu() { return state.gpuReady && !state.gpuLost; },
    get gpuReason() { return state.gpuReason; }
  };
})();
