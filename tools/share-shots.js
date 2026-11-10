#!/usr/bin/env node
// Share-card screenshots: renders the export dialog and every full-size card.
//
//   node tools/share-shots.js                          # 14 themes × 3 variants
//   node tools/share-shots.js --themes=nova,endfield   # subset
//   node tools/share-shots.js --variant=poster         # one spec
//   node tools/share-shots.js --out=../_shots/share    # output folder
//
// Each card is written at its design size (1600×900 / 1200×1500 / 1600×840)
// by putting the page in its export state and clipping the card box — the same
// path the host uses, minus WebView2. The dialog is captured alongside so the
// picker itself can be reviewed per theme.
const fs = require('fs');
const path = require('path');
const { connect, wait } = require('./lib/cdp');
const { HELPERS } = require('./lib/ui-views');
const { startHost, readThemes } = require('./lib/headless-host');

const flags = {};
for (const arg of process.argv.slice(2)) {
  const m = arg.match(/^--([^=]+)(?:=(.*))?$/);
  if (m) flags[m[1]] = m[2] === undefined ? true : m[2];
}
const OUT = path.resolve(flags.out || path.join('..', '_shots', 'share'));
const THEMES = flags.themes && flags.themes !== 'all'
  ? String(flags.themes).split(',').map((v) => v.trim()).filter(Boolean)
  : ['nova', ...readThemes().map((e) => e.id)];
const VARIANT = flags.variant ? String(flags.variant).split(',') : ['poster', 'dossier', 'score'];
const W = Number(flags.w || 1440);
const H = Number(flags.h || 900);

fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const host = await startHost({ width: W, height: H, scale: 1 });
  const cdp = await connect({ port: host.cdpPort });
  let current = null;
  try {
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: host.mockScript });
    await cdp.send('Page.navigate', { url: `${host.origin}/src/index.html` });
    for (let i = 0; i < 80; i++) {
      if (await cdp.ev(`!!document.body.classList.contains('is-booted')`)) break;
      await wait(200);
    }
    await cdp.ev(HELPERS, { hard: true });
    await cdp.ev(`(()=>{try{NovaIntro&&NovaIntro.skip&&NovaIntro.skip()}catch(e){}return 1})()`);
    await wait(400);

    for (const theme of THEMES) {
      current = theme;
      console.log(`\n== ${theme}`);
      await cdp.ev(`(async () => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        if (window.NovaTheme && NovaTheme.activate) await NovaTheme.activate(${JSON.stringify(theme)}, { persist: false });
        await sleep(700);
        return 1;
      })()`);
      await wait(500);
      await cdp.ev(`document.querySelector('#shotBtn').click()`);
      await wait(900);
      for (const variant of VARIANT) {
        await cdp.ev(`(() => {
          const b = document.querySelector('.share-choice[data-variant="${variant}"]');
          if (b) b.click();
          return 1;
        })()`);
        await wait(500);
        const dialog = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92 });
        fs.writeFileSync(path.join(OUT, `${theme}-dialog-${variant}.jpg`), Buffer.from(dialog.result.data, 'base64'));

        const info = JSON.parse(await cdp.ev(`(() => {
          const card = document.querySelector('#shareMount .share-card');
          const r = card ? card.getBoundingClientRect() : null;
          const mount = document.querySelector('#shareMount');
          const stage = document.querySelector('#shareStage');
          return JSON.stringify({
            card: r ? [Math.round(r.width), Math.round(r.height)] : null,
            mount: mount ? [mount.style.width, mount.style.height] : null,
            stage: stage ? [stage.clientWidth, stage.clientHeight] : null,
            overflow: stage ? stage.scrollWidth - stage.clientWidth : null,
            parts: card ? (() => {
              const pick = (sel) => { const el = card.querySelector(sel); if (!el) return null;
                const b = el.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom)]; };
              return { sheet: pick('.sc-sheet'), main: pick('.sc-main'), score: pick('.sc-score'), foot: pick('.sc-foot'), facts: pick('.sc-facts') };
            })() : null
          });
        })()`));
        console.log(`  ${variant}:`, JSON.stringify(info));

        await cdp.ev(`document.querySelector('#shareExport').click()`);
        await wait(1200);
        const box = JSON.parse(await cdp.ev(`(() => {
          const card = document.querySelector('#shareExportStage .share-card');
          if (!card) return JSON.stringify({ error: 'no export card' });
          const r = card.getBoundingClientRect();
          return JSON.stringify({ x: r.left, y: r.top, w: r.width, h: r.height,
            mode: document.documentElement.dataset.shareExport || '' });
        })()`));
        if (box.error) {
          console.log('   export:', box.error);
        } else {
          const shot = await cdp.send('Page.captureScreenshot', {
            format: 'jpeg', quality: 94, captureBeyondViewport: true,
            clip: { x: box.x, y: box.y, width: box.w, height: box.h, scale: 1 }
          });
          fs.writeFileSync(path.join(OUT, `${theme}-card-${variant}.jpg`), Buffer.from(shot.result.data, 'base64'));
          console.log(`   exported ${Math.round(box.w)}x${Math.round(box.h)} mode=${box.mode}`);
        }
        await cdp.ev(`location.reload()`);
        for (let i = 0; i < 60; i++) {
          if (await cdp.ev(`!!document.body.classList.contains('is-booted')`)) break;
          await wait(200);
        }
        await cdp.ev(HELPERS, { hard: true });
        await cdp.ev(`(()=>{try{NovaIntro&&NovaIntro.skip&&NovaIntro.skip()}catch(e){}return 1})()`);
        await wait(400);
        await cdp.ev(`(async () => {
          const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
          if (window.NovaTheme && NovaTheme.activate) await NovaTheme.activate(${JSON.stringify(theme)}, { persist: false });
          await sleep(600);
          return 1;
        })()`);
        await cdp.ev(`document.querySelector('#shotBtn').click()`);
        await wait(800);
      }
      await cdp.ev(`document.querySelector('#shareClose').click()`);
      await wait(300);
    }
    console.log('\ndone', OUT);
  } catch (error) {
    console.error('failed on', current, error);
    process.exitCode = 1;
  } finally {
    await host.close();
  }
})();
