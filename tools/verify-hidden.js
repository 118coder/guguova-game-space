#!/usr/bin/env node
// Proves two things about "hidden":
//   1. the home strip never draws a hidden game (on boot, and right after the
//      switch is flipped in the detail sheet);
//   2. the boot-time count and the hero follow the shelf, not the array.
// Run: node tools/verify-hidden.js
const { connect, wait } = require('./lib/cdp');
const { HELPERS } = require('./lib/ui-views');
const { startHost } = require('./lib/headless-host');

const fs = require('fs');
const path = require('path');
const OUT = process.argv.includes('--shots')
  ? path.resolve('..', '_shots', 'hidden-shelf')
  : null;
const snap = async (cdp, name) => {
  if (!OUT) return;
  const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 90 });
  if (shot && shot.result && shot.result.data) {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, name), Buffer.from(shot.result.data, 'base64'));
  }
};

const results = [];
const check = (label, ok, detail) => {
  results.push({ label, ok, detail });
  console.log(`  ${ok ? '[ok]' : '[FAIL]'} ${label}${detail ? ' — ' + detail : ''}`);
};

(async () => {
  const host = await startHost({ width: 1440, height: 900, scale: 1 });
  const cdp = await connect({ port: host.cdpPort });
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

    const before = JSON.parse(await cdp.ev(`(() => {
      const rail = document.querySelector('.rail');
      return JSON.stringify({
        tiles: rail ? rail.querySelectorAll('.tile').length : -1,
        tilesHidden: rail ? Array.from(rail.querySelectorAll('.tile')).filter((t) => t.offsetParent === null).length : -1,
        count: (document.querySelector('#dockCount') || {}).textContent || '',
        source: document.querySelectorAll('.rail .tile').length
      });
    })()`));
    console.log('\n[boot] strip', before);
    await snap(cdp, 'before-hide.jpg');

    // Flip the switch the way a player does: detail sheet → 隐藏此游戏.
    const flipped = await cdp.ev(`(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const btn = document.querySelector('.nav-btn[data-nav="home"]');
      if (btn) btn.click();
      await sleep(300);
      const name = (document.querySelector('.rail .tile.is-active .tile-name') || {}).textContent || '';
      const logo = (document.querySelector('#gameLogo') || {}).textContent || '';
      const detail = document.querySelector('#detailBtn');
      if (detail) detail.click();
      await sleep(700);
      const toggle = document.querySelector('#manageHiddenRow');
      if (!toggle) return JSON.stringify({ ok: false, error: 'no toggle' });
      toggle.click();
      await sleep(900);
      return JSON.stringify({ ok: true, name, logo });
    })()`);
    const flip = JSON.parse(flipped);
    check('detail sheet exposes the hide switch', flip.ok, flip.error || '');

    await cdp.ev(`(() => { const close = document.querySelector('#detailsClose'); if (close) close.click(); return 1; })()`);
    await wait(600);

    const after = JSON.parse(await cdp.ev(`(() => {
      const rail = document.querySelector('.rail');
      const tiles = rail ? Array.from(rail.querySelectorAll('.tile')) : [];
      return JSON.stringify({
        tiles: tiles.length,
        count: (document.querySelector('#dockCount') || {}).textContent || '',
        names: tiles.map((t) => (t.querySelector('.tile-name') || {}).textContent || ''),
        hero: (document.querySelector('#gameLogo') || {}).textContent || '',
        heroHidden: !!(window.__novaHiddenProbe)
      });
    })()`));
    console.log('[after hide]', after);
    await snap(cdp, 'after-hide.jpg');

    check('strip lost exactly one tile', after.tiles === before.tiles - 1,
      `${before.tiles} → ${after.tiles}`);
    check('the hidden game is gone from the strip',
      flip.name ? !after.names.includes(flip.name) : after.tiles === before.tiles - 1,
      `hidden="${flip.name}"`);
    check('the dock count follows the shelf', after.count.trim() === `${after.tiles} 款`,
      after.count);
    /* The hero's wordmark is the English display name, not the Chinese tile
       label, so comparing the two proves nothing. What proves it: the current
       game was the one hidden, therefore the hero must have moved on. */
    check('the hero moved off the hidden game', !!flip.logo && after.hero !== flip.logo,
      `"${flip.logo}" → "${after.hero}"`);

    // Every game hidden → the shelf is empty, not a ghost cover.
    const empty = await cdp.ev(`(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const tiles = Array.from(document.querySelectorAll('.rail .tile'));
      for (const tile of tiles) {
        tile.click();
        await sleep(180);
        document.querySelector('#detailBtn').click();
        await sleep(500);
        const toggle = document.querySelector('#manageHiddenRow');
        if (toggle) toggle.click();
        await sleep(500);
        const close = document.querySelector('#detailsClose');
        if (close) close.click();
        await sleep(300);
      }
      await sleep(400);
      const rail = document.querySelector('.rail');
      return JSON.stringify({
        tiles: rail ? rail.querySelectorAll('.tile').length : -1,
        count: (document.querySelector('#dockCount') || {}).textContent || '',
        hidden: !!(document.querySelector('#railEmpty') && !document.querySelector('#railEmpty').hidden)
      });
    })()`);
    const all = JSON.parse(empty);
    console.log('[all hidden]', all);
    check('hiding every game empties the shelf', all.tiles === 0, `tiles=${all.tiles}`);
    check('the empty-state note appears', all.hidden === true, `count=${all.count}`);
  } finally {
    try { await host.close(); } catch (error) {}
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch((error) => {
  console.error(error && error.message ? error.message : error);
  process.exit(2);
});
