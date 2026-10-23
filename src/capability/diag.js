/* ============================================================
   NOVA · CAPABILITY DIAGNOSTICS
   ------------------------------------------------------------
   A small, self-contained readout of what the renderer can do and how
   fast each backend is. Deliberately not part of the normal UI: it exists
   so QA and support can answer "is this machine on the GPU path, and did it
   get slower?" without reading source.

   Open with  window.NovaDiag.report()  in the devtools console, or add
   ?diag=1 to the URL to mount a corner badge with the tier.

   It never changes behaviour. It reads html[data-palette-tier] and the
   timings published by capability.js, then measures each available backend
   once on a fixed image so the numbers are comparable across machines.
   ============================================================ */
(function () {
  'use strict';

  const TIER_LABEL = {
    gpu: 'GPU · WebGPU',
    wasm: 'WASM',
    js: 'JS'
  };

  function makeImage(width, height) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4;
        data[i] = 40 + (x / width) * 190;
        data[i + 1] = 90 + (y / height) * 140;
        data[i + 2] = 210 - (x / width) * 160;
        data[i + 3] = 255;
      }
    }
    return { data, width, height };
  }

  async function timeOnce(fn, runs) {
    const times = [];
    for (let i = 0; i < runs; i += 1) {
      const started = performance.now();
      await fn();
      times.push(performance.now() - started);
    }
    times.sort((a, b) => a - b);
    return times[Math.floor(times.length / 2)];
  }

  async function report() {
    const cap = window.NovaCapability;
    const out = {
      tier: cap ? cap.tier : 'js',
      hasWasm: !!(cap && cap.hasWasm),
      hasGpu: !!(cap && cap.hasGpu),
      gpuReason: cap ? cap.gpuReason : '',
      html: {
        paletteTier: document.documentElement.dataset.paletteTier || '',
        gpu: document.documentElement.dataset.gpu || '',
        tier: document.documentElement.dataset.tier || ''
      },
      timings: {}
    };

    // Two sizes, because the router picks a different backend for each and a
    // single number would hide that: a thumbnail must stay on the CPU.
    const runs = 5;
    const thumb = makeImage(192, 108);
    const hero = makeImage(1600, 900);

    out.plan = cap ? {
      thumbnail: cap.plan(thumb.width, thumb.height),
      hero: cap.plan(hero.width, hero.height),
      gpuThresholdPixels: cap.GPU_MIN_PIXELS
    } : null;

    if (window.NovaPalette) {
      out.timings.js = +(await timeOnce(
        () => window.NovaPalette.analyse(thumb.data, thumb.width, thumb.height, 1), runs
      )).toFixed(2);
    }
    if (cap && cap.hasWasm) {
      try {
        out.timings.wasm = +(await timeOnce(
          () => cap.analyse(thumb.data, thumb.width, thumb.height, { step: 1, backend: 'wasm' }), runs
        )).toFixed(2);
      } catch (error) {
        out.timings.wasm = `error: ${error.message}`;
      }
    }
    if (cap && cap.hasGpu && window.NovaGPU) {
      try {
        out.timings.gpuHero = +(await timeOnce(
          () => window.NovaGPU.analyse(hero.data, hero.width, hero.height, 1), runs
        )).toFixed(2);
      } catch (error) {
        out.timings.gpuHero = `error: ${error.message}`;
      }
      try {
        out.timings.jsHero = +(await timeOnce(
          () => window.NovaPalette.analyse(hero.data, hero.width, hero.height, 1), runs
        )).toFixed(2);
      } catch (error) {
        out.timings.jsHero = `error: ${error.message}`;
      }
    }
    // What the app actually pays for a thumbnail through the router.
    if (cap) {
      out.timings.pipeline = +(await timeOnce(
        () => cap.analyse(thumb.data, thumb.width, thumb.height, { step: 1 }), runs
      )).toFixed(2);
    }

    if (typeof out.timings.jsHero === 'number' && typeof out.timings.gpuHero === 'number' && out.timings.gpuHero > 0) {
      out.heroSpeedup = `${(out.timings.jsHero / out.timings.gpuHero).toFixed(1)}x`;
    }
    return out;
  }

  /* ------------------------------------------------- optional corner badge */

  function mountBadge() {
    if (document.getElementById('novaDiagBadge')) return;
    const badge = document.createElement('div');
    badge.id = 'novaDiagBadge';
    badge.setAttribute('aria-hidden', 'true');
    badge.style.cssText = [
      'position:fixed', 'right:10px', 'bottom:10px', 'z-index:9999',
      'padding:3px 8px', 'border-radius:999px',
      'font:600 9px/1.4 ui-monospace,Consolas,monospace',
      'letter-spacing:.08em', 'text-transform:uppercase',
      'background:rgba(8,10,14,.82)', 'color:#f5f2ea',
      'border:1px solid rgba(255,255,255,.18)', 'pointer-events:none'
    ].join(';');
    document.body.appendChild(badge);

    const paint = () => {
      const tier = document.documentElement.dataset.paletteTier || 'js';
      const gpu = document.documentElement.dataset.gpu || 'off';
      badge.textContent = `${TIER_LABEL[tier] || tier}${gpu === 'lost' ? ' · lost' : ''}`;
    };
    paint();

    // Re-paint when the capability layer changes its mind (probe finishes,
    // GPU dies). Polling is deliberate: it keeps this module decoupled from
    // an internal event that may not exist in older builds.
    let last = '';
    setInterval(() => {
      const next = `${document.documentElement.dataset.paletteTier}|${document.documentElement.dataset.gpu}`;
      if (next === last) return;
      last = next;
      paint();
    }, 1000);
  }

  if (new URLSearchParams(location.search).get('diag') === '1') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountBadge);
    else mountBadge();
  }

  window.NovaDiag = { report, mountBadge };
})();
