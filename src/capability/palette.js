/* ============================================================
   NOVA · COVER PALETTE (reference implementation)
   ------------------------------------------------------------
   The numbers that drive a theme's accent, glow and scrim. Three
   implementations exist and they must agree:

     src/capability/palette.js   this file — plain JS, always available
     wasm/palette/src/lib.rs     WebAssembly, ~10x faster on big images
     Services/CoverAnalyzer.cs   C#, runs once at import time

   Only the JS and WASM ones run in the page. They are kept byte-for-byte
   equivalent in behaviour: same bucket count, same clamps, same result
   layout. tools/test-palette.js compares them on random images and fails if
   they drift, which is the only way this stays true.

   Result layout (Float32Array of 16, indices 0-15):
     0..2   accent rgb          3..5   accent2 rgb
     6..8   light rgb           9..11  dark rgb
     12     luma (0-1)          13     saturation (0-1)
     14     warmth (0-1)        15     edge density (0-1)
   ============================================================ */
(function () {
  'use strict';

  const HUE_BUCKETS = 24;
  const BUCKET_WIDTH = 15;

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

  function hsvToRgb(hue, sat, val) {
    const h = ((hue % 360) + 360) % 360;
    const c = val * sat;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = val - c;
    let r;
    let g;
    let b;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
  }

  function circularDistance(a, b) {
    const d = Math.abs(a - b);
    return d > HUE_BUCKETS / 2 ? HUE_BUCKETS - d : d;
  }

  /**
   * Analyse an RGBA8 buffer.
   *
   * @param {Uint8ClampedArray|Uint8Array} rgba  pixels, 4 bytes each
   * @param {number} width
   * @param {number} height
   * @param {number} [step=1]  subsample stride; 2 skips every other pixel
   * @returns {Float32Array} the 16-value result block
   */
  function analyse(rgba, width, height, step) {
    const stride = Math.max(1, step | 0);
    const count = [new Float32Array(HUE_BUCKETS), new Float32Array(HUE_BUCKETS), new Float32Array(HUE_BUCKETS)];
    const luma = new Float32Array(width * height);

    let sumR = 0;
    let sumB = 0;
    let sumLuma = 0;
    let sumSat = 0;
    let samples = 0;

    for (let y = 0; y < height; y += stride) {
      for (let x = 0; x < width; x += stride) {
        const i = (y * width + x) * 4;
        const r = rgba[i];
        const g = rgba[i + 1];
        const b = rgba[i + 2];

        sumR += r;
        sumB += b;

        const max = r > g ? (r > b ? r : b) : (g > b ? g : b);
        const min = r < g ? (r < b ? r : b) : (g < b ? g : b);
        const delta = max - min;
        const value = max / 255;
        const sat = max === 0 ? 0 : delta / max;
        const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

        sumLuma += l;
        sumSat += sat;
        luma[y * width + x] = l;

        if (sat > 0.18 && value > 0.16) {
          let hue;
          if (delta === 0) hue = 0;
          else if (max === r) hue = 60 * (((g - b) / delta) % 6);
          else if (max === g) hue = 60 * ((b - r) / delta + 2);
          else hue = 60 * ((r - g) / delta + 4);
          if (hue < 0) hue += 360;
          const bucket = Math.floor(hue / BUCKET_WIDTH) % HUE_BUCKETS;
          const weight = sat * value;
          count[0][bucket] += weight;
          count[1][bucket] += sat * weight;
          count[2][bucket] += value * weight;
        }
        samples += 1;
      }
    }

    const edge = edgeDensity(luma, width, height, stride);
    const avgLuma = samples ? sumLuma / samples : 0;
    const avgSat = samples ? sumSat / samples : 0;
    const warmth = clamp(0.5 + ((sumR / samples / 255) - (sumB / samples / 255)) * 0.9, 0, 1);

    let primary = 0;
    for (let i = 1; i < HUE_BUCKETS; i += 1) if (count[0][i] > count[0][primary]) primary = i;

    let secondary = primary;
    let best = -1;
    for (let i = 0; i < HUE_BUCKETS; i += 1) {
      if (circularDistance(i, primary) <= 3) continue;
      if (count[0][i] > best) { best = count[0][i]; secondary = i; }
    }
    if (best < 0) secondary = (primary + 2) % HUE_BUCKETS;

    const primaryHue = (primary * BUCKET_WIDTH + 7.5) % 360;
    const [primarySat, primaryVal] = bucketStats(count, primary, 0.32, 0.82, 0.55, 0.95);
    const accent = hsvToRgb(primaryHue, primarySat, primaryVal);

    let accent2;
    if (count[0][secondary] > 0.0001) {
      const hue = (secondary * BUCKET_WIDTH + 7.5) % 360;
      const [s, v] = bucketStats(count, secondary, 0.38, 0.80, 0.55, 0.90);
      accent2 = hsvToRgb(hue, s, v);
    } else {
      accent2 = hsvToRgb((primaryHue + 32) % 360, primarySat * 0.9, Math.min(1, primaryVal * 0.96));
    }

    const light = avgLuma > 0.62 ? [246, 241, 230] : hsvToRgb(primaryHue, clamp(avgSat * 0.45, 0.10, 0.40), 0.95);
    const dark = hsvToRgb(primaryHue, clamp(primarySat * 0.55, 0.28, 0.72), clamp(primaryVal * 0.24, 0.08, 0.25));

    const out = new Float32Array(16);
    out[0] = accent[0]; out[1] = accent[1]; out[2] = accent[2];
    out[3] = accent2[0]; out[4] = accent2[1]; out[5] = accent2[2];
    out[6] = light[0]; out[7] = light[1]; out[8] = light[2];
    out[9] = dark[0]; out[10] = dark[1]; out[11] = dark[2];
    out[12] = avgLuma;
    out[13] = avgSat;
    out[14] = warmth;
    out[15] = edge;
    return out;
  }

  function bucketStats(count, bucket, satLo, satHi, valLo, valHi) {
    if (count[0][bucket] > 0.0001) {
      return [
        clamp(count[1][bucket] / count[0][bucket], satLo, satHi),
        clamp(count[2][bucket] / count[0][bucket], valLo, valHi)
      ];
    }
    return [0.5, 0.7];
  }

  function edgeDensity(luma, width, height, stride) {
    if (width < 3 || height < 3) return 0;
    let total = 0;
    let samples = 0;
    for (let y = 1; y < height - 1; y += stride) {
      for (let x = 1; x < width - 1; x += stride) {
        const at = y * width + x;
        const center = luma[at];
        const dx = Math.abs(center - luma[at + 1]);
        const dy = Math.abs(center - luma[at + width]);
        if (dx + dy > 0.12) total += 1;
        samples += 1;
      }
    }
    return samples === 0 ? 0 : total / samples;
  }

  /* ---------- convenience: an image element -> palette ---------- */

  /**
   * Downscales an image into a small canvas before analysis. Sampling the
   * full 1920x1080 buffer gives the same palette but costs milliseconds on
   * the main thread, and neither this path nor the WASM one is fast enough
   * to do that on every hover.
   */
  function paletteFromImage(image, options) {
    const max = (options && options.max) || 96;
    const width = Math.max(1, Math.min(max, image.naturalWidth || image.width || max));
    const height = Math.max(
      1,
      Math.round((image.naturalHeight || image.height || max) * (width / (image.naturalWidth || image.width || max)))
    );
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, width, height);
    const data = ctx.getImageData(0, 0, width, height).data;
    return { data, width, height };
  }

  window.NovaPalette = { analyse, paletteFromImage, OUT_LEN: 16 };
})();
