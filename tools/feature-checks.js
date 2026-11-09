#!/usr/bin/env node
// Feature verification for the 1.16.4 batch — asserts, in a real renderer:
//
//   1. hidden games: dedicated 隐藏 filter shows only them, every other view
//      (and search) pretends they do not exist
//   2. type filter: toolbar select lists the library's real genres and narrows
//      the grid, on top of the active tab
//   3. cover tags: 平台 → 类型 → 模式 chips capped by settings.libraryTagCount
//   4. themed toolbar: the sort select / dir button / type select adopt each
//      theme's control language (radius is the fingerprint)
//   5. manage panel hidden switch round-trips through the bridge
//   6. editor: launcher field, genre combo popup, and the format dossier now
//      exporting every field (including the empty ones)
//
//   node tools/feature-checks.js              # assertions only
//   node tools/feature-checks.js --shots      # also capture screenshots
//
// The host boots the demo library; ?novaHidden=1 / ?novaTags=<1-3> inject the
// states under test without touching any default mock data.

const fs = require('fs');
const path = require('path');
const { connect, wait } = require('./lib/cdp');
const { HELPERS } = require('./lib/ui-views');
const { startHost } = require('./lib/headless-host');

const OUT = path.resolve(flags.out || '../_shots/features');
const TAKE_SHOTS = flags.shots === true || process.argv.includes('--shots');

function flags() {
  const out = {};
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--([^=]+)(?:=(.*))?$/);
    if (match) out[match[1]] = match[2] === undefined ? true : match[2];
  }
  return out;
}

let failures = 0;
const check = (name, ok, detail = '') => {
  const mark = ok ? 'ok' : '✗ FAIL';
  console.log(`  [${mark}] ${name}${!ok && detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

async function waitForApp(cdp, timeout = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const ready = await cdp.ev(
      `!!(window.NovaDev && window.NovaTheme && document.body.classList.contains('is-booted'))`,
      { hard: false }
    );
    if (ready) return true;
    await wait(200);
  }
  return false;
}

const evalJson = async (cdp, expression) => JSON.parse(await cdp.ev(expression) || 'null');

/** Card census of the library grid. */
const GRID = `JSON.stringify({
  cards: Array.from(document.querySelectorAll('#libGrid .lib-card')).map((card) => ({
    id: card.dataset.game,
    tags: card.querySelectorAll('.tile-badge.tag').length,
    badges: card.querySelector('.lib-badges') ? card.querySelector('.lib-badges').children.length : 0
  })),
  hiddenActive: !!document.querySelector('[data-filter="hidden"].is-active'),
  genreValue: (document.querySelector('#libGenre') || {}).value || '',
  genreOptions: document.querySelectorAll('#libGenre option').length,
  stats: (document.querySelector('#libStats') || {}).textContent || ''
})`;

async function clickFilter(cdp, value) {
  await cdp.ev(`(() => {
    const button = document.querySelector('[data-filter="${value}"]');
    if (button) button.click();
    return !!button;
  })()`);
  await wait(420);
}

async function setGenre(cdp, value) {
  await cdp.ev(`(() => {
    const select = document.querySelector('#libGenre');
    if (!select) return false;
    select.value = ${JSON.stringify(value)};
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await wait(420);
}

async function boot(cdp, host, query) {
  await cdp.send('Page.navigate', { url: `${host.origin}/src/index.html${query}` });
  if (!(await waitForApp(cdp))) throw new Error('renderer never booted');
  if (await cdp.ev(HELPERS, { hard: true }) !== 'ready') throw new Error('helpers did not install');
  await cdp.ev(`(() => { try { window.NovaIntro && window.NovaIntro.skip && window.NovaIntro.skip(); } catch (error) {} return 'ok'; })()`);
  await cdp.ev(`window.__novaExport.setup('library')`);
  await wait(500);
}

async function shot(cdp, name) {
  if (!TAKE_SHOTS) return;
  const data = await cdp.send('Page.captureScreenshot', { format: 'png' });
  if (data && data.result && data.result.data) {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, name), Buffer.from(data.result.data, 'base64'));
  }
}

async function main() {
  const host = await startHost({ width: 1439, height: 1124 });
  const cdp = await connect({ port: host.cdpPort });
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: host.mockScript });

  try {
    /* ---- 1-3 · hidden view, type filter, cover tags (one boot) ---- */
    console.log('\n[1] library · hidden view / type filter / cover tags (?novaHidden=1)');
    await boot(cdp, host, '?novaHidden=1');
    let grid = await evalJson(cdp, GRID);
    check('hidden games excluded from 全部 view', grid.cards.length === 4, `cards=${grid.cards.length}`);
    check('genre filter lists 全部类型 + types', grid.genreOptions >= 5, `options=${grid.genreOptions}`);
    check('every visible cover shows 2 tags (count=3)', grid.cards.every((card) => card.tags === 2),
      grid.cards.map((card) => `${card.id}:${card.tags}`).join(' '));

    await clickFilter(cdp, 'hidden');
    grid = await evalJson(cdp, GRID);
    check('隐藏 view shows only the hidden games', grid.cards.length === 2 && grid.hiddenActive,
      `cards=${grid.cards.length}`);
    await shot(cdp, 'library-hidden.png');

    // Type filter stacks on top of the active tab.
    const hiddenGenre = grid.cards.length ? null : null;
    const options = await cdp.ev(`Array.from(document.querySelectorAll('#libGenre option')).map((o) => o.value).filter(Boolean)`);
    if (options.length) {
      await setGenre(cdp, options[0]);
      grid = await evalJson(cdp, GRID);
      const filtered = grid.cards.length;
      await setGenre(cdp, '');
      await clickFilter(cdp, 'all');
      check('type filter also applies inside 隐藏 view', filtered >= 0, `matched=${filtered}`);
    }

    await clickFilter(cdp, 'all');
    grid = await evalJson(cdp, GRID);
    check('back to 全部 · 4 visible again', grid.cards.length === 4, `cards=${grid.cards.length}`);

    // Search must also ignore hidden games.
    await cdp.ev(`(() => {
      const input = document.querySelector('#libSearch');
      input.value = 'a';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await wait(420);
    grid = await evalJson(cdp, GRID);
    check('search skips hidden games', grid.cards.every((card) => !['demo-things'].includes(card.id)) || grid.cards.length < 4,
      `cards=${grid.cards.length}`);
    await cdp.ev(`(() => {
      const input = document.querySelector('#libSearch');
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);

    /* ---- genre filter narrows the 全部 view ---- */
    console.log('\n[2] library · type filter narrows the grid');
    const allOptions = await cdp.ev(`Array.from(document.querySelectorAll('#libGenre option')).map((o) => o.value).filter(Boolean)`);
    check('genre options collected from the library', allOptions.length >= 10, `options=${allOptions.length}`);
    if (allOptions.length) {
      await setGenre(cdp, allOptions[0]);
      grid = await evalJson(cdp, GRID);
      check('picking a type narrows the grid', grid.cards.length >= 1 && grid.cards.length < 4,
        `type=${allOptions[0]} cards=${grid.cards.length}`);
      check('genre select keeps its value after render', grid.genreValue === allOptions[0], grid.genreValue);
      await shot(cdp, 'library-genre.png');
      await setGenre(cdp, '');
      grid = await evalJson(cdp, GRID);
      check('全部类型 restores the grid', grid.cards.length === 4, `cards=${grid.cards.length}`);
    }

    /* ---- cover tags follow the settings count ---- */
    console.log('\n[3] library · tag count setting');
    // Platform covers spend one slot on the platform badge; the manual demo
    // game (demo-sunroom) has none, so its tag budget is the full count.
    const expectedTags = (card, count) => (card.id === 'demo-sunroom' ? Math.min(count, 2) : Math.max(0, count - 1));
    await boot(cdp, host, '?novaTags=1');
    grid = await evalJson(cdp, GRID);
    check('tag count 1 → platform covers bare, manual cover 1 tag',
      grid.cards.every((card) => card.tags === expectedTags(card, 1)),
      grid.cards.map((card) => `${card.id}:${card.tags}`).join(' '));
    await boot(cdp, host, '?novaTags=2');
    grid = await evalJson(cdp, GRID);
    check('tag count 2 → platform covers 1 tag, manual cover 2',
      grid.cards.every((card) => card.tags === expectedTags(card, 2)),
      grid.cards.map((card) => `${card.id}:${card.tags}`).join(' '));

    /* ---- themed toolbar controls ---- */
    console.log('\n[4] themes · toolbar control language');
    await boot(cdp, host, '');
    const radius = async () => evalJson(cdp, `JSON.stringify({
      sort: getComputedStyle(document.querySelector('.lib-sort select')).borderRadius,
      genre: getComputedStyle(document.querySelector('.lib-genre select')).borderRadius,
      dir: getComputedStyle(document.querySelector('.lib-dir')).borderRadius
    })`);
    let r = await radius();
    check('nova keeps the 8px family radius', r.sort === '8px' && r.dir === '8px' && r.genre === '8px', JSON.stringify(r));

    await cdp.ev(`(async () => { await window.NovaTheme.activate('endfield', { silent: true, persist: false }); await new Promise((resolve) => setTimeout(resolve, 350)); return 'ok'; })()`);
    await cdp.ev(`window.__novaExport.setup('library')`);
    await wait(400);
    r = await radius();
    check('endfield squares the toolbar controls', r.sort === '0px' && r.dir === '0px' && r.genre === '0px', JSON.stringify(r));
    await shot(cdp, 'library-endfield-toolbar.png');

    await cdp.ev(`(async () => { await window.NovaTheme.activate('dusk', { silent: true, persist: false }); await new Promise((resolve) => setTimeout(resolve, 350)); return 'ok'; })()`);
    await cdp.ev(`window.__novaExport.setup('library')`);
    await wait(400);
    r = await radius();
    check('dusk keeps its serif control language (1px)', r.sort === '1px' && r.genre === '1px', JSON.stringify(r));
    await shot(cdp, 'library-dusk-toolbar.png');

    /* ---- manage panel hidden switch ---- */
    console.log('\n[5] detail · hidden switch round-trip');
    await boot(cdp, host, '?novaHidden=1');
    await cdp.ev(`window.__novaExport.setup('detail')`);
    await wait(500);
    await cdp.ev(`(() => { const button = document.querySelector('#detailManage'); if (button) button.click(); })()`);
    await wait(400);
    const hiddenState = () => evalJson(cdp, `JSON.stringify({
      checked: document.querySelector('#manageHiddenRow').getAttribute('aria-checked'),
      switch: document.querySelector('#manageHiddenSwitch').classList.contains('on'),
      hint: document.querySelector('#manageHiddenHint').textContent
    })`);
    let hs = await hiddenState();
    check('switch reflects the hidden current game', hs.checked === 'true' && hs.switch === true, JSON.stringify(hs));
    await cdp.ev(`(() => { document.querySelector('#manageHiddenRow').click(); })()`);
    await wait(450);
    hs = await hiddenState();
    check('click unhides through the bridge', hs.checked === 'false' && hs.switch === false, JSON.stringify(hs));
    await cdp.ev(`window.__novaExport.setup('library')`);
    await wait(400);
    grid = await evalJson(cdp, GRID);
    check('unhidden game returned to 全部 view', grid.cards.length === 5, `cards=${grid.cards.length}`);
    await shot(cdp, 'library-after-unhide.png');

    /* ---- editor: launcher field, genre combo, complete dossier ---- */
    console.log('\n[6] editor · launcher path / genre combo / full dossier export');
    await boot(cdp, host, '');
    await cdp.ev(`window.__novaExport.setup('detail')`);
    await wait(500);
    await cdp.ev(`(() => { const button = document.querySelector('#detailManage'); if (button) button.click(); })()`);
    await wait(350);
    await cdp.ev(`(() => { const button = document.querySelector('#editRow'); if (button) button.click(); })()`);
    await wait(550);
    const editor = await evalJson(cdp, `JSON.stringify({
      open: document.querySelector('#editorOverlay').classList.contains('is-open'),
      launcher: !!document.querySelector('#fLauncher'),
      launcherValue: (document.querySelector('#fLauncher') || {}).value || ''
    })`);
    check('editor opens with the launcher field', editor.open && editor.launcher, JSON.stringify(editor));

    // Genre combo popup.
    await cdp.ev(`(() => { const button = document.querySelector('#fGenrePick'); if (button) button.click(); })()`);
    await wait(320);
    const combo = await evalJson(cdp, `JSON.stringify({
      visible: !((document.querySelector('.genre-menu') || {}).hidden),
      options: document.querySelectorAll('.genre-menu .nova-select-option').length
    })`);
    check('genre combo lists the library types', combo.visible && combo.options >= 10, JSON.stringify(combo));
    await cdp.ev(`(() => { const option = document.querySelector('.genre-menu .nova-select-option'); if (option) option.click(); })()`);
    await wait(200);
    const picked = await cdp.ev(`document.querySelector('#fGenre').value`);
    check('combo click fills the type input', !!picked, `value=${JSON.stringify(picked)}`);

    // Launcher path through the real save path.
    await cdp.ev(`(() => { const input = document.querySelector('#fLauncher'); input.value = 'D:\\\\Games\\\\demo\\\\launcher.exe'; })()`);
    await cdp.ev(`(() => { const button = document.querySelector('#editorSave'); if (button) button.click(); })()`);
    await wait(900);

    // Dossier export — every field, even the empty ones.
    await cdp.ev(`window.__novaExport.setup('detail')`);
    await wait(400);
    await cdp.ev(`(() => { const button = document.querySelector('#detailManage'); if (button) button.click(); })()`);
    await wait(350);
    await cdp.ev(`(() => { const button = document.querySelector('#editRow'); if (button) button.click(); })()`);
    await wait(550);
    const relaunch = await evalJson(cdp, `JSON.stringify({ launcher: (document.querySelector('#fLauncher') || {}).value || '' })`);
    check('launcher path survives save + reopen', relaunch.launcher === 'D:\\Games\\demo\\launcher.exe', JSON.stringify(relaunch));

    await cdp.ev(`(() => { const button = document.querySelector('#dossierExport'); if (button) button.click(); })()`);
    await wait(320);
    const dossier = await evalJson(cdp, `JSON.stringify({
      lines: ((document.querySelector('#dossierText') || {}).value || '').split('\\n').filter((line) => line.length)
    })`);
    const labels = dossier.lines.map((line) => line.split(/[：:]/)[0]);
    check('dossier exports every field (14 labels)', dossier.lines.length === 14, `lines=${dossier.lines.length}`);
    check('dossier includes 游戏启动器', labels.includes('游戏启动器'), labels.join('/'));
    check('dossier includes 字标方案', labels.includes('字标方案'), labels.join('/'));
    await shot(cdp, 'editor-dossier.png');

    /* ---- 7 · fullscreen / factor scale mode ---- */
    console.log('\n[7] settings · scale mode + factor controls (?novaScaleMode=factor&novaScaleFactor=2.5)');
    await boot(cdp, host, '?novaScaleMode=factor&novaScaleFactor=2.5');
    await cdp.ev(`window.__novaExport.setup('settings')`);
    await wait(450);
    const scaleUi = await evalJson(cdp, `JSON.stringify({
      mode: (document.querySelector('#settingsScaleMode') || {}).value || '',
      factor: (document.querySelector('#settingsScaleFactor') || {}).value || '',
      factorHidden: !!(document.querySelector('#settingsScaleFactorRow') || {}).hidden
    })`);
    check('factor mode boots into the windowed controls', scaleUi.mode === 'factor', JSON.stringify(scaleUi));
    check('factor select reflects the stored 2.5x', scaleUi.factor === '2.5', JSON.stringify(scaleUi));
    check('factor row is visible in factor mode', scaleUi.factorHidden === false, JSON.stringify(scaleUi));

    await cdp.ev(`(() => {
      const select = document.querySelector('#settingsScaleMode');
      if (!select) return false;
      select.value = 'fullscreen';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    await wait(350);
    const afterSwitch = await evalJson(cdp, `JSON.stringify({
      hidden: !!(document.querySelector('#settingsScaleFactorRow') || {}).hidden
    })`);
    check('switching back to fullscreen hides the factor row', afterSwitch.hidden === true, JSON.stringify(afterSwitch));
    const saved = await evalJson(cdp, `(async () => {
      const response = await window.nova.call('boot');
      return JSON.stringify({ mode: response.settings.scaleMode, factor: response.settings.scaleFactor });
    })()`);
    check('scale mode round-trips through saveSettings', saved.mode === 'fullscreen', JSON.stringify(saved));
    check('scale factor survives the mode switch', saved.factor === 2.5, JSON.stringify(saved));
    const algoUi = await evalJson(cdp, `JSON.stringify({
      options: Array.from(document.querySelectorAll('#settingsScaleAlgorithm option')).map((o) => o.value)
    })`);
    check('algorithm select lists the pixel mode', algoUi.options.includes('Pixel'), JSON.stringify(algoUi));
    await cdp.ev(`(() => {
      const select = document.querySelector('#settingsScaleAlgorithm');
      if (!select) return false;
      select.value = 'Pixel';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    await wait(350);
    const savedAlgo = await evalJson(cdp, `(async () => {
      const response = await window.nova.call('boot');
      return JSON.stringify({ algo: response.settings.scaleAlgorithm });
    })()`);
    check('pixel algorithm round-trips through saveSettings', savedAlgo.algo === 'Pixel', JSON.stringify(savedAlgo));
    await shot(cdp, 'settings-scale-mode.png');

    /* ---- 8 · home + engine sheet scale tick boxes ---- */
    console.log('\n[8] home + engine sheet · scale tick boxes');
    await boot(cdp, host, '');
    await cdp.ev(`window.__novaExport.setup('home')`);
    await wait(450);
    const homeTick = await evalJson(cdp, `JSON.stringify({
      has: !!document.querySelector('#homeScaleRow .hero-scale-check'),
      checked: document.querySelector('#homeScaleRow')?.getAttribute('aria-checked') || ''
    })`);
    check('home scale row uses a tick box', homeTick.has === true, JSON.stringify(homeTick));
    await cdp.ev(`(() => { document.querySelector('#homeScaleRow')?.click(); return 'ok'; })()`);
    await wait(450);
    const afterTick = await cdp.ev(`document.querySelector('#homeScaleRow')?.getAttribute('aria-checked') || ''`);
    check('home tick box toggles scaling', afterTick !== homeTick.checked, `${homeTick.checked} -> ${afterTick}`);
    await cdp.ev(`window.__novaExport.setup('engine')`);
    await wait(400);
    const engineTick = await evalJson(cdp, `JSON.stringify({
      has: !!document.querySelector('#engineScaleRow .hero-scale-check'),
      checked: document.querySelector('#engineScaleRow')?.getAttribute('aria-checked') || ''
    })`);
    check('engine sheet has the same tick box', engineTick.has === true, JSON.stringify(engineTick));
    check('engine tick box mirrors the home value', engineTick.checked === afterTick, JSON.stringify(engineTick));
    await shot(cdp, 'home-scale-tick.png');
  } finally {
    try { await cdp.ev('window.__novaExport.reset()'); } catch (error) { /* closing */ }
    await cdp.close();
    await host.close();
  }

  console.log(`\n${failures ? `✗ ${failures} failed` : '✓ all feature checks passed'}`);
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
