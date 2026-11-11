#!/usr/bin/env node
// Temporary check: does the plate cover its box at every framing/zoom?
// A positive gap on any side means bare paper is showing next to the artwork.
const fs = require('fs');
const path = require('path');
const { connect, wait } = require('./lib/cdp');
const { HELPERS } = require('./lib/ui-views');
const { startHost, readThemes } = require('./lib/headless-host');

const ARG = process.argv[2] || 'all';
const THEMES = ARG === 'all'
  ? ['nova', ...readThemes().map((e) => e.id)]
  : ARG.split(',');
const VARIANTS = ['poster', 'dossier', 'score'];
const ALL_GAPS = { l: -9999, t: -9999, r: -9999, b: -9999 };

(async () => {
  const host = await startHost({ width: 1440, height: 900, scale: 1 });
  const cdp = await connect({ port: host.cdpPort });
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: host.mockScript });

  const boot = async (theme) => {
    await cdp.send('Page.navigate', { url: `${host.origin}/src/index.html` });
    for (let i = 0; i < 80; i++) {
      if (await cdp.ev(`!!document.body.classList.contains('is-booted')`)) break;
      await wait(200);
    }
    await cdp.ev(HELPERS, { hard: true });
    await cdp.ev(`(()=>{try{NovaIntro&&NovaIntro.skip&&NovaIntro.skip()}catch(e){}return 1})()`);
    await wait(350);
    await cdp.ev(`(async () => {
      if (window.NovaTheme && NovaTheme.activate) await NovaTheme.activate(${JSON.stringify(theme)}, { persist: false });
      await new Promise((r) => setTimeout(r, 650));
      return 1;
    })()`);
    await wait(350);
  };

  const gap = () => cdp.ev(`(() => {
    const artEl = document.querySelector('#shareMount .sc-art');
    const img = document.querySelector('#shareMount .sc-art img');
    if (!artEl || !img) return JSON.stringify({ error: 'missing' });
    const a = artEl.getBoundingClientRect();
    const cs = getComputedStyle(artEl);
    const L = a.left + parseFloat(cs.borderLeftWidth);
    const T = a.top + parseFloat(cs.borderTopWidth);
    const R = a.right - parseFloat(cs.borderRightWidth);
    const B = a.bottom - parseFloat(cs.borderBottomWidth);
    const i = img.getBoundingClientRect();
    const round = (v) => Math.round(v * 10) / 10;
    return JSON.stringify({
      l: round(i.left - L), t: round(i.top - T), r: round(R - i.right), b: round(B - i.bottom),
      box: [Math.round(i.width), Math.round(i.height)],
      zoom: (document.querySelector('#shareZoomValue') || {}).textContent || ''
    });
  })()`);

  const click = (frame, times) => cdp.ev(`(() => {
    const b = document.querySelector('#shareFraming button[data-frame="${frame}"]');
    if (!b) return 0;
    for (let i = 0; i < ${times}; i++) b.click();
    return 1;
  })()`);

  const swap = (portrait) => cdp.ev(`(() => {
    const img = document.querySelector('#shareMount .sc-art img');
    if (!img) return 0;
    const w = ${portrait ? 800 : 1600}, h = ${portrait ? 1200 : 900};
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '">'
      + '<rect width="' + w + '" height="' + h + '" fill="#2b3a4a"/>'
      + '<circle cx="' + (w / 2) + '" cy="' + (h / 2) + '" r="' + (Math.min(w, h) / 2.6) + '" fill="#c9a227"/></svg>';
    img.src = 'data:image/svg+xml;base64,' + btoa(svg);
    return 1;
  })()`);

  const report = [];
  const probe = async (theme, variant, name) => {
    const d = JSON.parse(await gap());
    const ok = d.error ? false : (d.l <= 0.6 && d.t <= 0.6 && d.r <= 0.6 && d.b <= 0.6);
    if (!d.error) {
      ALL_GAPS.l = Math.max(ALL_GAPS.l, d.l);
      ALL_GAPS.t = Math.max(ALL_GAPS.t, d.t);
      ALL_GAPS.r = Math.max(ALL_GAPS.r, d.r);
      ALL_GAPS.b = Math.max(ALL_GAPS.b, d.b);
    }
    report.push({ theme, variant, name, ok, ...d });
    if (!ok) console.log(`  GAP ${theme}/${variant} ${name}: ${JSON.stringify(d)}`);
    return ok;
  };

  const run = async (theme, variant) => {
    await boot(theme);
    await cdp.ev(`document.querySelector('#shotBtn').click()`);
    await wait(800);
    await cdp.ev(`document.querySelector('.share-choice[data-variant="${variant}"]').click()`);
    await wait(600);
    for (const portrait of [false, true]) {
      await swap(portrait);
      await wait(450);
      // One arrow press repaints the plate, which re-measures the new image.
      await click('right', 1); await wait(200);
      await probe(theme, variant, `nudge-${portrait ? 'portrait' : 'wide'}`);
      await click('left', 60); await wait(350);
      await probe(theme, variant, `pan-a-${portrait ? 'portrait' : 'wide'}`);
      await click('right', 120); await wait(350);
      await probe(theme, variant, `pan-b-${portrait ? 'portrait' : 'wide'}`);
      await click('zoom-in', 14); await wait(350);
      await probe(theme, variant, `zoom-${portrait ? 'portrait' : 'wide'}`);
      await click('left', 60); await click('down', 40); await wait(350);
      await probe(theme, variant, `zoom-corner-${portrait ? 'portrait' : 'wide'}`);
      await click('reset', 1); await wait(250);
    }
  };

  try {
    for (const theme of THEMES) {
      process.stdout.write(`== ${theme} `);
      for (const variant of VARIANTS) {
        await run(theme, variant);
        process.stdout.write('.');
      }
      process.stdout.write('\n');
    }
  } finally {
    const bad = report.filter((r) => !r.ok);
    console.log(`\nworst gap (<=0 is covered): l=${ALL_GAPS.l} t=${ALL_GAPS.t} r=${ALL_GAPS.r} b=${ALL_GAPS.b}`);
    console.log(`${bad.length ? `FAIL ${bad.length}` : 'ALL PASS'} (${report.length} probes)`);
    fs.writeFileSync(path.join(__dirname, '..', '..', '_shots', 'frame-check.json'), JSON.stringify(report, null, 2));
    await host.close().catch(() => {});
    process.exit(bad.length ? 1 : 0);
  }
})();
