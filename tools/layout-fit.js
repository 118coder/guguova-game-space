// Does the immersive page still hold together at any window size?
//
// The action row sits above a strip that floats over the cover, so "does the
// strip cover the buttons" is the question that keeps coming back. Rather than
// eyeballing one screenshot per release, this walks a list of viewports, puts a
// long game name and a two-line tagline on the page (the shape that broke it on
// the owner's real library), and asserts the boxes do not intersect.
//
//   node tools/layout-fit.js                      # default viewport sweep
//   node tools/layout-fit.js --size=1920x1080 --shots
//   node tools/layout-fit.js --themes=nova,grimoire

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

const SIZES = flags.size
  ? [String(flags.size)]
  : ['1920x1080', '1600x900', '1440x900', '1366x768', '1280x720', '1080x600'];

const THEMES = flags.themes
  ? String(flags.themes).split(',').map((v) => v.trim()).filter(Boolean)
  : ['nova'];

const OUT = flags.out ? path.resolve(String(flags.out)) : path.resolve('..', '_shots', 'layout-fit');
const SHOTS = !!flags.shots;

/* Long but real: a season/episode title with a parenthesised edition, plus the
   kind of two-line description the owner's DNF entries carry. */
const PRESSURE = String.raw`
(() => {
  const logo = document.querySelector('#gameLogo');
  const tagline = document.querySelector('#gameTagline');
  const kicker = document.querySelector('#kickerLabel');
  const dim = document.querySelector('#kickerDim');
  if (logo) logo.textContent = 'DNF-SEASON1-ACT0.3';
  if (tagline) tagline.textContent = 'DNF单机版 · 第一季 · 第0.3章：日服内测版（40/45级硬核街机考古篇）';
  if (kicker) kicker.textContent = '继续';
  if (dim) dim.textContent = '上次游玩 10 月 21 日 · 总计 128 小时';
  return 'ok';
})()`;

const MEASURE = String.raw`
(() => {
  const box = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return { sel, top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) };
  };
  const overlap = (a, b) => (a && b ? Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) : 0);

  const stage = box('.view-home .stage');
  const hero = box('.view-home .hero');
  const cta = box('.view-home .hero-inner > .cta-row');
  const logo = box('.view-home .hero-inner > .hero-logo');
  const tagline = box('.view-home .hero-inner > .tagline');
  const card = box('.view-home .hero-inner > .status-card');
  const dock = box('.view-home .dock');
  const rail = box('.view-home .rail');
  const name = box('.view-home .rail .tile.is-active .tile-name');

  const vh = innerHeight;
  return JSON.stringify({
    viewport: [innerWidth, vh],
    dockTop: dock ? dock.top : null,
    ctaBottom: cta ? cta.bottom : null,
    overlaps: {
      ctaDock: overlap(cta, dock),
      cardDock: overlap(card, dock),
      logoDock: overlap(logo, dock),
      nameClipped: name ? Math.max(0, Math.round(name.bottom - vh)) : 0,
      heroOverflow: hero && stage ? Math.max(0, Math.round(stage.top - hero.top)) : 0
    },
    boxes: { stage, hero, cta, logo, tagline, card, dock, rail }
  });
})()`;

(async () => {
  const rows = [];
  const themes = readThemes ? readThemes().filter((t) => THEMES.includes(t)) : THEMES;
  const list = themes.length ? themes : THEMES;

  for (const size of SIZES) {
    const [w, h] = size.split('x').map(Number);
    const host = await startHost({ width: w, height: h, scale: 1 });
    const cdp = await connect({ port: host.cdpPort });
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: host.mockScript });
    await cdp.send('Page.navigate', { url: `${host.origin}/src/index.html` });
    for (let i = 0; i < 80; i++) {
      if (await cdp.ev(`!!document.body.classList.contains('is-booted')`)) break;
      await wait(200);
    }
    await cdp.ev(HELPERS, { hard: true });
    await cdp.ev(`(() => { try { NovaIntro && NovaIntro.skip && NovaIntro.skip(); } catch (e) {} return 1; })()`);
    await wait(500);

    for (const theme of list) {
      await cdp.ev(`(async () => { await NovaTheme.activate('${theme}', { silent: true, persist: false }); await new Promise(r => setTimeout(r, 400)); })()`);
      await cdp.ev(`window.__novaExport.setup('home')`);
      await wait(320);
      await cdp.ev(`(async () => {
        const row = document.querySelector('#calmRow');
        if (row && !document.documentElement.classList.contains('calm')) row.click();
        await new Promise(r => setTimeout(r, 700));
      })()`);
      await cdp.ev(PRESSURE);
      await wait(420);
      await cdp.ev(PRESSURE);
      await wait(220);
      await cdp.ev(`(() => { window.dispatchEvent(new Event('resize')); return 1; })()`);
      await wait(260);

      const raw = await cdp.ev(MEASURE);
      const data = JSON.parse(raw);
      const bad = Object.entries(data.overlaps).filter(([, v]) => v > 1);
      rows.push({ size, theme, ...data, bad: bad.map(([k, v]) => `${k}:${v}`) });

      if (SHOTS) {
        fs.mkdirSync(OUT, { recursive: true });
        const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 88 });
        fs.writeFileSync(path.join(OUT, `${theme}-${size}.jpg`), Buffer.from(shot.result.data, 'base64'));
      }
    }
    await host.close();
  }

  let fail = 0;
  for (const row of rows) {
    const ok = row.bad.length === 0;
    if (!ok) fail++;
    const tag = ok ? '✓' : '✗';
    const detail = ok
      ? `cta→dock ${row.dockTop - row.ctaBottom}px clear`
      : row.bad.join(' ');
    console.log(`${tag} ${row.size.padEnd(10)} ${row.theme.padEnd(12)} ${detail}`);
  }
  console.log(`\n${rows.length - fail}/${rows.length} layouts hold at ${SIZES.length} viewport${SIZES.length > 1 ? 's' : ''}`);
  if (SHOTS) console.log(`shots → ${OUT}`);
  process.exit(fail ? 1 : 0);
})();
