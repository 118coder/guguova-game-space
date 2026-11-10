#!/usr/bin/env node
// Immersive-mode legibility audit + screenshot pass, no WPF host.
//
//   node tools/immersive-audit.js                       # every theme, report only
//   node tools/immersive-audit.js --themes=nova,aurum   # a subset
//   node tools/immersive-audit.js --shots --out=../_shots/immersive-v3
//   node tools/immersive-audit.js --focus               # also capture a pad-focus frame
//
// Why pixels instead of computed styles: a control's text can be perfectly
// valid CSS and still invisible, because the fill is a gradient, an image or a
// translucent plate and the colour was inherited from somewhere else. The only
// honest reading is the rendered one, so each control is clipped out of the
// frame and measured: the plate colour is the dominant pixel, the ink colour is
// the pixel furthest from it, and WCAG contrast is computed from the two.
//
// A control passes when its label reaches 4.5:1 (3.0:1 for display type).
// The report fails the process on any hard failure so it can gate a release.

const fs = require('fs');
const path = require('path');
const { connect, wait } = require('./lib/cdp');
const { HELPERS } = require('./lib/ui-views');
const { startHost, readThemes } = require('./lib/headless-host');

const flags = {};
for (const arg of process.argv.slice(2)) {
  const match = arg.match(/^--([^=]+)(?:=(.*))?$/);
  if (match) flags[match[1]] = match[2] === undefined ? true : match[2];
}

const SIZE = String(flags.size || '1440x900').split('x').map(Number);
const WIDTH = SIZE[0] || 1440;
const HEIGHT = SIZE[1] || 900;
const OUT = flags.out ? path.resolve(String(flags.out)) : null;
const SHOTS = !!flags.shots || !!OUT;
const FOCUS = !!flags.focus;
const JSON_OUT = flags.json ? path.resolve(String(flags.json)) : null;
// 4.5 for body-size labels, 3.0 for anything that reads as display type.
const MIN_UI = Number(flags.min || 4.5);
const MIN_BIG = 3.0;

// The built-in nova theme is not a folder under themes/, so it is named here.
const THEMES = flags.themes && flags.themes !== 'all'
  ? String(flags.themes).split(',').map((v) => v.trim()).filter(Boolean)
  : ['nova', ...readThemes().map((entry) => entry.id)];

/** Controls the immersive page actually shows, with the label each one must
 *  keep legible. Selectors are structural, not per-theme. */
const TARGETS = [
  { key: 'play', sel: '.hero-inner #playBtn', label: '主按钮 · 继续游戏', min: MIN_UI },
  { key: 'detail', sel: '.hero-inner #detailBtn', label: '次按钮 · 游戏详情', min: MIN_UI },
  { key: 'engine', sel: '.hero-inner #homeEngineBtn', label: '次按钮 · 缩放设置', min: MIN_UI },
  { key: 'scale', sel: '.hero-inner #homeScaleRow', label: '缩放勾选行', min: MIN_UI },
  { key: 'scale-hint', sel: '.hero-inner #homeScaleHint', label: '缩放状态提示', min: MIN_UI },
  { key: 'kicker', sel: '.hero-inner .kicker', label: '眉标', min: MIN_BIG },
  { key: 'title', sel: '.hero-inner .hero-logo', label: '标题', min: MIN_BIG },
  { key: 'tagline', sel: '.hero-inner .tagline', label: '副标题', min: MIN_UI },
  { key: 'meta', sel: '.hero-inner .meta-row', label: '元信息行', min: MIN_UI },
  { key: 'card-head', sel: '.status-card .progress-head', label: '卡片表头', min: MIN_UI },
  { key: 'card-pct', sel: '.status-card .progress-pct', label: '时长数字', min: MIN_BIG },
  { key: 'card-sub', sel: '.status-card .progress-sub', label: '卡片副行', min: MIN_UI },
  { key: 'tile-name', sel: '.rail .tile.is-active .tile-name', label: '图标带名称', min: MIN_UI },
  { key: 'dock-head', sel: '.dock-head .dock-title', label: '图标带标题', min: MIN_UI }
];

/* ------------------------------------------------------------------ page side */

/** Runs in the page: boot helpers, enter fullscreen, then measure clips. */
const { PAGE_PROBE: AUDIT_FN } = require('./lib/legibility');

const ENTER_IMMERSIVE = String.raw`
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const html = document.documentElement;
  /* 沉稳模式 is the switch that owns this layout; fullscreen is only a window
     state now. Clicking the row drives the real code path (settings, motion,
     focus navigation) instead of painting a class on the document. */
  if (!html.classList.contains('calm')) {
    const row = document.querySelector('#calmRow');
    if (row) row.click();
    await sleep(700);
    if (!html.classList.contains('calm')) html.classList.add('calm');
  }
  await sleep(400);
  // A leftover :focus-visible from the previous theme's pad pass would paint a
  // ring into a screenshot that is supposed to show the resting state.
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  await sleep(120);
  return html.classList.contains('calm') ? 'ok' : 'no-calm';
})()
`;

const RING_PRIMARY = String.raw`
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const el = document.querySelector('.hero-inner #playBtn');
  if (!el) return 'no-button';
  document.documentElement.dataset.input = 'gamepad';
  const down = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
  document.dispatchEvent(down);
  await sleep(120);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
  await sleep(260);
  el.classList.add('is-pad-focus');
  el.focus({ preventScroll: true });
  await sleep(160);
  return 'ok';
})()
`;

/* -------------------------------------------------------------------- driver */

const clampClip = (target) => {
  const x = Math.max(0, Math.min(target.x, WIDTH - 2));
  const y = Math.max(0, Math.min(target.y, HEIGHT - 2));
  const w = Math.max(4, Math.min(target.w, WIDTH - x));
  const h = Math.max(4, Math.min(target.h, HEIGHT - y));
  return { x, y, width: w, height: h, scale: 1 };
};

async function shoot(cdp, clip) {
  const shot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    clip,
    captureBeyondViewport: false,
    optimizeForSpeed: true
  });
  if (!shot || !shot.result || !shot.result.data) return null;
  return shot.result.data;
}

async function run() {
  const host = await startHost({ width: WIDTH, height: HEIGHT, scale: 1 });
  const cdp = await connect({ port: host.cdpPort });
  const report = { size: `${WIDTH}x${HEIGHT}`, themes: [] };
  let hard = 0;

  try {
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: host.mockScript });
    await cdp.send('Page.navigate', { url: `${host.origin}/src/index.html` });

    const started = Date.now();
    while (Date.now() - started < 20000) {
      const ready = await cdp.ev(
        `!!(document.body.classList.contains('is-booted') || document.body.classList.contains('is-empty'))`);
      if (ready) break;
      await wait(200);
    }
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false
    });
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
    });
    await cdp.ev(HELPERS, { hard: true });
    await cdp.ev(AUDIT_FN, { hard: true });
    await cdp.ev(`(() => { try { window.NovaIntro && window.NovaIntro.skip && window.NovaIntro.skip(); } catch (e) {} return 'ok'; })()`);
    await wait(400);

    for (const theme of THEMES) {
      const active = await cdp.ev(`(async () => {
        try { await window.NovaTheme.activate(${JSON.stringify(theme)}, { silent: true, persist: false }); }
        catch (error) { return 'error'; }
        if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (error) {} }
        await new Promise((r) => setTimeout(r, 320));
        return document.documentElement.dataset.theme;
      })()`);
      await cdp.ev(`window.__novaExport.setup('home')`);
      await wait(420);
      const entered = await cdp.ev(ENTER_IMMERSIVE);
      await wait(320);

      const raw = JSON.parse(await cdp.ev(`window.__imAudit(${JSON.stringify(TARGETS)})`));
      const rows = [];
      for (const target of TARGETS) {
        const meta = raw.find((r) => r.key === target.key);
        if (!meta || meta.missing) { rows.push({ ...target, missing: true }); continue; }
        const clip = clampClip(meta);
        const shown = await shoot(cdp, clip);
        // Hide the ink, keep every other pixel identical, shoot again.
        await cdp.ev(`window.__imInk(${JSON.stringify(target.sel)}, true)`);
        await wait(70);
        const hidden = await shoot(cdp, clip);
        await cdp.ev(`window.__imInk(${JSON.stringify(target.sel)}, false)`);
        const measuredRaw = shown && hidden
          ? await cdp.ev(`(async () => JSON.stringify(await window.__imPixels(${JSON.stringify(shown)}, ${JSON.stringify(hidden)})))()`)
          : null;
        let measured = measuredRaw && measuredRaw !== 'null' ? JSON.parse(measuredRaw) : null;
        // Gradient-filled display type has no ink to hide; fall back to the
        // frame's own luminance range before calling it unmeasurable.
        if ((!measured || measured.contrast === null) && shown) {
          const rangeRaw = await cdp.ev(`(async () => JSON.stringify(await window.__imRange(${JSON.stringify(shown)})))()`);
          if (rangeRaw && rangeRaw !== 'null') measured = JSON.parse(rangeRaw);
        }
        const contrast = measured && measured.contrast !== null ? measured.contrast : null;
        // An unmeasurable control is a failure, not a pass: it means the frame
        // came back empty, which is the same thing the player sees.
        const pass = contrast === null ? false : contrast >= target.min;
        if (pass === false) hard++;
        rows.push({
          key: target.key, label: target.label, min: target.min,
          contrast, pass,
          ink: meta.ink, fill: meta.fill, fillImage: meta.fillImage,
          font: meta.font, size: meta.size, weight: meta.weight,
          tracking: meta.tracking, transform: meta.transform, radius: meta.radius,
          plate: measured && measured.plate, inkRgb: measured && measured.ink
        });
      }

      report.themes.push({ theme, active, entered, rows });

      const bad = rows.filter((r) => r.pass === false);
      const flag = bad.length ? `✗ ${bad.length}` : '✓';
      console.log(`${flag} ${theme.padEnd(12)} ${bad.map((r) => `${r.key}:${r.contrast}`).join(' ') || 'all legible'}`);

      if (SHOTS && OUT) {
        fs.mkdirSync(OUT, { recursive: true });
        const full = await shoot(cdp, { x: 0, y: 0, width: WIDTH, height: HEIGHT, scale: 1 });
        if (full) fs.writeFileSync(path.join(OUT, `${theme}-immersive.jpg`), Buffer.from(full, 'base64'));
        if (FOCUS) {
          await cdp.ev(RING_PRIMARY);
          await wait(240);
          const focused = await shoot(cdp, { x: 0, y: 0, width: WIDTH, height: HEIGHT, scale: 1 });
          if (focused) fs.writeFileSync(path.join(OUT, `${theme}-focus.jpg`), Buffer.from(focused, 'base64'));
        }
      }
    }
  } finally {
    try { await host.close(); } catch (error) {}
  }

  if (JSON_OUT) {
    fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true });
    fs.writeFileSync(JSON_OUT, JSON.stringify(report, null, 2));
    console.log(`\nreport → ${JSON_OUT}`);
  }

  const total = report.themes.length * TARGETS.length;
  console.log(`\n${total - hard}/${total} readable at ${WIDTH}x${HEIGHT}, ${report.themes.length} themes`);
  process.exit(hard ? 1 : 0);
}

run().catch((error) => {
  console.error(error && error.message ? error.message : error);
  process.exit(2);
});
