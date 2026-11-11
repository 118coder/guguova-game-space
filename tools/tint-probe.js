#!/usr/bin/env node
// Judge a theme's stylised cover on a picture that actually has tonal range.
// The bundled demo covers are nearly flat, so a filter chain reads as one
// solid colour and tells you nothing. This probe swaps in a synthetic
// greyscale study (bright core, deep edges, hard shapes) and exports the card.
//
//   node tools/tint-probe.js riso poster
const fs = require('fs');
const path = require('path');
const { connect, wait } = require('./lib/cdp');
const { HELPERS } = require('./lib/ui-views');
const { startHost } = require('./lib/headless-host');

const THEME = process.argv[2] || 'riso';
const VARIANT = process.argv[3] || 'poster';
const OUT = path.resolve('..', '_shots', 'probe');
fs.mkdirSync(OUT, { recursive: true });

// A tonal test chart: wide histogram, hard edges, a specular highlight.
const SRC = `(() => {
  if (window.__probeArt) return window.__probeArt;
  const c = document.createElement('canvas');
  c.width = 1200; c.height = 800;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(760, 250, 40, 760, 250, 900);
  g.addColorStop(0, '#fbfbfb');
  g.addColorStop(.28, '#c9c9c9');
  g.addColorStop(.62, '#6a6a6a');
  g.addColorStop(1, '#0c0c0c');
  x.fillStyle = g; x.fillRect(0, 0, 1200, 800);
  x.fillStyle = 'rgba(0,0,0,.82)';
  x.beginPath(); x.ellipse(330, 700, 420, 210, -.12, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#f4f4f4';
  x.beginPath(); x.ellipse(300, 300, 150, 190, .1, 0, Math.PI * 2); x.fill();
  x.fillStyle = 'rgba(255,255,255,.9)';
  for (let i = 0; i < 6; i += 1) x.fillRect(60 + i * 26, 60, 8, 680);
  window.__probeArt = c.toDataURL('image/jpeg', .92);
  return window.__probeArt;
})()`;

(async () => {
  const host = await startHost({ width: 1440, height: 900, scale: 1 });
  const cdp = await connect({ port: host.cdpPort });
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: host.mockScript });

  try {
    await cdp.send('Page.navigate', { url: `${host.origin}/src/index.html` });
    for (let i = 0; i < 80; i++) {
      if (await cdp.ev(`!!document.body.classList.contains('is-booted')`)) break;
      await wait(200);
    }
    await cdp.ev(HELPERS, { hard: true });
    await cdp.ev(`(()=>{try{NovaIntro&&NovaIntro.skip&&NovaIntro.skip()}catch(e){}return 1})()`);
    await wait(400);
    await cdp.ev(`(async () => {
      if (window.NovaTheme && NovaTheme.activate) await NovaTheme.activate(${JSON.stringify(THEME)}, { persist: false });
      await new Promise((r) => setTimeout(r, 650));
      return 1;
    })()`);
    await wait(400);
    await cdp.ev(`document.querySelector('#shotBtn').click()`);
    await wait(900);
    const on = await cdp.ev(`document.querySelector('#shareTint').getAttribute('aria-checked')`);
    if (on !== 'true') await cdp.ev(`document.querySelector('#shareTint').click()`);
    await wait(300);
    await cdp.ev(`document.querySelector('.share-choice[data-variant="${VARIANT}"]').click()`);
    await wait(600);
    await cdp.ev(`(async () => {
      const img = document.querySelector('#shareMount .sc-art img');
      img.src = ${SRC};
      await new Promise((r) => { if (img.complete) r(); else img.addEventListener('load', r, { once: true }); });
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return 1;
    })()`);
    await wait(500);

    const style = await cdp.ev(`(() => {
      const img = document.querySelector('#shareMount .sc-art img');
      const cs = getComputedStyle(img);
      return JSON.stringify({ filter: cs.filter, opacity: cs.opacity });
    })()`);
    console.log('computed', style);

    // Export rebuilds the card from the library entry, so it would throw the
    // probe picture away; capture the live plate instead.
    const box = JSON.parse(await cdp.ev(`(() => {
      const art = document.querySelector('#shareMount .sc-art');
      const r = art.getBoundingClientRect();
      return JSON.stringify({ x: r.left, y: r.top, w: r.width, h: r.height });
    })()`));
    const shot = await cdp.send('Page.captureScreenshot', {
      format: 'jpeg', quality: 94,
      clip: { x: box.x, y: box.y, width: box.w, height: box.h, scale: 1 }
    });
    const file = path.join(OUT, `${THEME}-${VARIANT}-tonal.jpg`);
    fs.writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
    console.log('wrote', file, `${Math.round(box.w)}x${Math.round(box.h)}`);
  } finally {
    await host.close().catch(() => {});
  }
})();
