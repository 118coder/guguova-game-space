#!/usr/bin/env node
// Export every card variant with the stylised cover on, so a theme's duotone
// can be judged per layout; also prints the filter's table values.
//
//   node tools/tint-shot.js broadcast
const fs = require('fs');
const path = require('path');
const { connect, wait } = require('./lib/cdp');
const { HELPERS } = require('./lib/ui-views');
const { startHost } = require('./lib/headless-host');

const THEME = process.argv[2] || 'broadcast';
const OUT = path.resolve('..', '_shots', 'tint');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const host = await startHost({ width: 1440, height: 900, scale: 1 });
  const cdp = await connect({ port: host.cdpPort });
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: host.mockScript });

  const boot = async () => {
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
    await wait(500);
  };

  try {
    for (const variant of ['poster', 'dossier', 'score']) {
      await boot();
      await cdp.ev(`document.querySelector('.share-choice[data-variant="${variant}"]').click()`);
      await wait(700);
      const dialog = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92 });
      fs.writeFileSync(path.join(OUT, `${THEME}-dialog-${variant}.jpg`), Buffer.from(dialog.result.data, 'base64'));

      const info = JSON.parse(await cdp.ev(`(() => {
        const card = document.querySelector('#shareMount .share-card');
        const a = card && card.querySelector('.sc-art');
        return JSON.stringify({ variant: card && card.dataset.variant,
          tint: card && card.dataset.tint,
          stops: ['scDuoR','scDuoG','scDuoB'].map((id) => document.getElementById(id).getAttribute('tableValues')).join(' | ') });
      })()`));
      console.log(`${variant}: rendered=${info.variant} tint=${info.tint}`);
      console.log(`   ${info.stops}`);

      await cdp.ev(`document.querySelector('#shareExport').click()`);
      await wait(1200);
      const box = JSON.parse(await cdp.ev(`(() => {
        const card = document.querySelector('#shareExportStage .share-card');
        if (!card) return JSON.stringify({ error: 'no card' });
        const r = card.getBoundingClientRect();
        return JSON.stringify({ x: r.left, y: r.top, w: r.width, h: r.height,
          variant: card.dataset.variant, tint: card.dataset.tint });
      })()`));
      if (box.error) { console.log('   export:', box.error); continue; }
      const shot = await cdp.send('Page.captureScreenshot', {
        format: 'jpeg', quality: 94, captureBeyondViewport: true,
        clip: { x: box.x, y: box.y, width: box.w, height: box.h, scale: 1 }
      });
      fs.writeFileSync(path.join(OUT, `${THEME}-card-${variant}.jpg`), Buffer.from(shot.result.data, 'base64'));
      console.log(`   exported ${Math.round(box.w)}x${Math.round(box.h)} variant=${box.variant} tint=${box.tint}`);
    }
  } finally {
    await host.close().catch(() => {});
  }
})();
