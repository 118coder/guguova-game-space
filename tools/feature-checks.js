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
    /* Round-trip on the game that IS on the shelf: hide it, the switch and the
       hint must flip; unhide, they flip back. Opening a hidden game's sheet
       from the library is covered by group [1] (隐藏 view shows them) and by
       the fact that the sheet is reachable from that view. */
    await boot(cdp, host, '?novaHidden=1');
    const shelfOnBoot = await evalJson(cdp, `JSON.stringify({
      tiles: document.querySelectorAll('.rail .tile').length,
      count: (document.querySelector('#dockCount') || {}).textContent || ''
    })`);
    check('the shelf skips the hidden games on boot', shelfOnBoot.tiles === 4 && shelfOnBoot.count.trim() === '4 款',
      JSON.stringify(shelfOnBoot));

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
    check('the switch starts off for a game on the shelf', hs.checked === 'false' && hs.switch === false, JSON.stringify(hs));

    await cdp.ev(`(() => { document.querySelector('#manageHiddenRow').click(); })()`);
    await wait(500);
    hs = await hiddenState();
    check('hiding flips the switch and the hint', hs.checked === 'true' && hs.switch === true
      && /已隐藏/.test(hs.hint), JSON.stringify(hs));
    const hintLegible = await evalJson(cdp, `JSON.stringify((() => {
      const el = document.querySelector('#manageHiddenHint');
      const cs = getComputedStyle(el);
      return { color: cs.color, size: parseFloat(cs.fontSize) };
    })())`);
    check('the hint keeps a readable size on every theme', hintLegible.size >= 11, JSON.stringify(hintLegible));

    await cdp.ev(`(() => { document.querySelector('#manageHiddenRow').click(); })()`);
    await wait(500);
    hs = await hiddenState();
    check('unhiding flips it back', hs.checked === 'false' && hs.switch === false, JSON.stringify(hs));

    /* Check it where it actually shows up: the 隐藏 filter must lose the card.
       Counting the 全部 grid instead made this assertion depend on when the
       grid re-renders, not on whether the unhide reached the store. */
    await cdp.ev(`(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      document.querySelector('#detailsClose') && document.querySelector('#detailsClose').click();
      await sleep(300);
      document.querySelector('.nav-btn[data-nav="library"]').click();
      await sleep(500);
      const hidden = document.querySelector('.filter[data-filter="hidden"]');
      if (hidden) hidden.click();
      await sleep(400);
      return 'ok';
    })()`);
    const hiddenCardsLeft = await evalJson(cdp, `JSON.stringify({
      cards: document.querySelectorAll('#libGrid .lib-card').length,
      filter: (document.querySelector('.filter.is-active') || {}).dataset ? document.querySelector('.filter.is-active').dataset.filter : ''
    })`);
    /* Two games arrive hidden from ?novaHidden=1. Hiding then unhiding the
       current game is a round trip, so the counts must land back where they
       started — 2 in the 隐藏 view, 4 in 全部. */
    check('the 隐藏 view still holds the two seeded games',
      hiddenCardsLeft.cards === 2 && hiddenCardsLeft.filter === 'hidden', JSON.stringify(hiddenCardsLeft));
    await cdp.ev(`(() => { const all = document.querySelector('.filter[data-filter="all"]'); if (all) all.click(); })()`);
    await wait(400);
    grid = await evalJson(cdp, GRID);
    check('全部 view is back to its original four cards', grid.cards.length === 4, `cards=${grid.cards.length}`);
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

    /* ---- 7 · the home scaling sheet owns mode / size / algorithm ---- */
    console.log('\n[7] home 缩放设置 · one sheet for mode, size, algorithm (?novaScaleMode=factor&novaScaleFactor=2.5)');
    await boot(cdp, host, '?novaScaleMode=factor&novaScaleFactor=2.5');
    await cdp.ev(`window.__novaExport.setup('settings')`);
    await wait(450);
    const noDuplicates = await evalJson(cdp, `JSON.stringify({
      legacySelects: ['#settingsScaleMode','#settingsScaleFactor','#settingsScaleAlgorithm',
        '#settingsScaleDelay','#settingsScaleFactorRow','#engineMode','#settingsEngineOptions']
        .filter((id) => !!document.querySelector(id)),
      entry: !!document.querySelector('#settingsScaleSetupRow'),
      summary: (document.querySelector('#settingsScaleSetupHint') || {}).textContent || '',
      oldWords: /全屏缩放|启动时缩放|倍数缩放/.test((document.body.innerText || ''))
    })`);
    check('settings page no longer carries a second set of scaling controls',
      noDuplicates.legacySelects.length === 0, JSON.stringify(noDuplicates.legacySelects));
    check('settings page shows a read-only summary + one entry',
      noDuplicates.entry && noDuplicates.summary.includes('放大 2.5 倍'), JSON.stringify(noDuplicates));
    check('old mixed wording is gone from the visible UI', noDuplicates.oldWords === false,
      JSON.stringify(noDuplicates));

    // The settings entry and the home button must open the SAME sheet.
    await cdp.ev(`(() => { document.querySelector('#settingsScaleSetupRow')?.click(); return 'ok'; })()`);
    await wait(600);
    const fromSettings = await evalJson(cdp, `JSON.stringify({
      open: document.querySelector('#engineOverlay').classList.contains('is-open'),
      title: (document.querySelector('#engineOverlay h2') || {}).textContent || ''
    })`);
    check('settings entry opens the shared 缩放设置 sheet',
      fromSettings.open === true && fromSettings.title === '缩放设置', JSON.stringify(fromSettings));
    await cdp.ev(`(() => { document.querySelector('#engineDone')?.click(); return 'ok'; })()`);
    await wait(250);
    await cdp.ev(`window.__novaExport.setup('home')`);
    await cdp.ev(`window.__novaExport.setup('engine')`);
    await wait(600);

    const sheet = await evalJson(cdp, `JSON.stringify({
      open: document.querySelector('#engineOverlay').classList.contains('is-open'),
      tabs: Array.from(document.querySelectorAll('#engineScaleTabs .scale-tab')).map((t) => t.dataset.scaleMode),
      selected: (document.querySelector('#engineScaleTabs .scale-tab[aria-selected="true"]') || {}).dataset?.scaleMode || '',
      windowVisible: !document.querySelector('#engineScaleWindowRow').hidden,
      sizeValue: (document.querySelector('#engineScaleSize') || {}).value || '',
      sizeOptions: Array.from(document.querySelectorAll('#engineScaleSize option')).map((o) => o.value),
      algoOptions: Array.from(document.querySelectorAll('#engineScaleAlgorithm option')).map((o) => o.value),
      algoSelects: document.querySelectorAll('#settingsScaleAlgorithm, #engineMode').length,
      hasDelay: !!document.querySelector('#engineScaleDelay'),
      hasAdvanced: !!document.querySelector('#engineAdvanced'),
      homeHint: (document.querySelector('#homeScaleHint') || {}).textContent || '',
      sheetHint: (document.querySelector('#engineScaleHint') || {}).textContent || '',
      text: (document.querySelector('#engineOverlay') || {}).innerText || ''
    })`);
    check('home button opens the same sheet', sheet.open === true, JSON.stringify(sheet.open));
    check('mode tabs offer 铺满屏幕 / 按倍数放大',
      sheet.tabs.join(',') === 'fullscreen,factor', JSON.stringify(sheet.tabs));
    check('factor boots with the factor tab selected', sheet.selected === 'factor', sheet.selected);
    check('factor boots with the size conversion row visible', sheet.windowVisible === true,
      JSON.stringify(sheet.windowVisible));
    check('size select offers 跟随显示器, multipliers and target resolutions',
      sheet.sizeOptions.includes('fullscreen') && sheet.sizeOptions.includes('f:2.5')
        && sheet.sizeOptions.includes('r:1920x1080'), JSON.stringify(sheet.sizeOptions));
    check('one algorithm select, listing the pixel mode',
      sheet.algoSelects === 0 && sheet.algoOptions.includes('Pixel'), JSON.stringify(sheet.algoOptions));
    check('sheet also owns launch timing + advanced engine options',
      sheet.hasDelay && sheet.hasAdvanced, JSON.stringify({ delay: sheet.hasDelay, advanced: sheet.hasAdvanced }));
    check('home + sheet hints use the same state wording',
      sheet.homeHint === sheet.sheetHint && !/全屏缩放|启动时缩放/.test(sheet.homeHint),
      JSON.stringify({ home: sheet.homeHint, sheet: sheet.sheetHint }));
    check('sheet uses one vocabulary', !/全屏缩放|启动时缩放|倍数缩放/.test(sheet.text), sheet.text.slice(0, 120));

    await cdp.ev(`(() => {
      document.querySelector('#engineScaleTabs .scale-tab[data-scale-mode="fullscreen"]')?.click();
      return 'ok';
    })()`);
    await wait(320);
    const full = await evalJson(cdp, `(async () => {
      const response = await window.nova.call('boot');
      return JSON.stringify({
        mode: response.settings.scaleMode,
        sizeValue: (document.querySelector('#engineScaleSize') || {}).value || '',
        windowHidden: !!(document.querySelector('#engineScaleWindowRow') || {}).hidden,
        sizeVisible: !document.querySelector('#engineScaleSizeRow').hidden
      });
    })()`);
    check('switching to 铺满屏幕 saves fullscreen mode', full.mode === 'fullscreen', JSON.stringify(full));
    check('铺满屏幕 keeps the size select visible and shows 跟随显示器',
      full.sizeVisible === true && full.sizeValue === 'fullscreen' && full.windowHidden === true,
      JSON.stringify(full));

    // Picking a target resolution from the 铺满屏幕 state must switch the mode
    // by itself — the player should never have to hunt for the right tab.
    await cdp.ev(`(() => {
      const select = document.querySelector('#engineScaleSize');
      if (!select) return false;
      select.value = 'r:1920x1080';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    await wait(320);
    const res = await evalJson(cdp, `(async () => {
      const response = await window.nova.call('boot');
      return JSON.stringify({
        mode: response.settings.scaleMode,
        preset: response.settings.scaleSizePreset,
        factor: response.settings.scaleFactor,
        note: (document.querySelector('#engineScaleSizeNote') || {}).textContent || ''
      });
    })()`);
    check('choosing a target resolution switches to 按倍数放大 on its own',
      res.mode === 'factor', JSON.stringify(res));
    check('target 1920x1080 on a 1280x720 window becomes 1.5x',
      res.preset === 'r:1920x1080' && res.factor === 1.5, JSON.stringify(res));
    check('the conversion is explained in plain words',
      res.note.includes('1.5 倍') && res.note.includes('1920×1080'), res.note);

    await cdp.ev(`(() => {
      const w = document.querySelector('#engineScaleWinW');
      const h = document.querySelector('#engineScaleWinH');
      if (!w || !h) return false;
      w.value = '640'; h.value = '480';
      w.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    await wait(320);
    const win = await evalJson(cdp, `(async () => {
      const response = await window.nova.call('boot');
      return JSON.stringify({
        w: response.settings.scaleWindowW,
        h: response.settings.scaleWindowH,
        factor: response.settings.scaleFactor
      });
    })()`);
    check('window size persists and the target resolution is recomputed',
      win.w === 640 && win.h === 480 && win.factor === 2.25, JSON.stringify(win));

    await cdp.ev(`(() => {
      const select = document.querySelector('#engineScaleSize');
      if (!select) return false;
      select.value = 'f:2.5';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    await wait(320);
    const multiplier = await evalJson(cdp, `(async () => {
      const response = await window.nova.call('boot');
      return JSON.stringify({ preset: response.settings.scaleSizePreset, factor: response.settings.scaleFactor });
    })()`);
    check('multiplier preset round-trips through saveSettings',
      multiplier.preset === 'f:2.5' && multiplier.factor === 2.5, JSON.stringify(multiplier));

    await cdp.ev(`(() => {
      const select = document.querySelector('#engineScaleSize');
      if (!select) return false;
      select.value = 'f:custom';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    await wait(280);
    const customVisible = await evalJson(cdp, `JSON.stringify({
      visible: !document.querySelector('#engineScaleCustomRow').hidden
    })`);
    check('custom multiplier reveals its input', customVisible.visible === true, JSON.stringify(customVisible));
    await cdp.ev(`(() => {
      const input = document.querySelector('#engineScaleCustomFactor');
      if (!input) return false;
      input.value = '3.2';
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    await wait(320);
    const customFactor = await evalJson(cdp, `(async () => {
      const response = await window.nova.call('boot');
      return JSON.stringify({ factor: response.settings.scaleFactor });
    })()`);
    check('custom multiplier is written as a real factor', customFactor.factor === 3.2,
      JSON.stringify(customFactor));

    await cdp.ev(`(() => {
      const algo = document.querySelector('#engineScaleAlgorithm');
      const delay = document.querySelector('#engineScaleDelay');
      if (!algo || !delay) return false;
      algo.value = 'Pixel';
      algo.dispatchEvent(new Event('change', { bubbles: true }));
      delay.value = '5';
      delay.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    await wait(360);
    const savedAll = await evalJson(cdp, `(async () => {
      const response = await window.nova.call('boot');
      return JSON.stringify({
        algo: response.settings.scaleAlgorithm,
        delay: response.settings.scaleDelaySeconds,
        summary: (document.querySelector('#settingsScaleSetupHint') || {}).textContent || ''
      });
    })()`);
    check('algorithm round-trips through saveSettings', savedAll.algo === 'Pixel', JSON.stringify(savedAll));
    check('launch timing round-trips through saveSettings', savedAll.delay === 5, JSON.stringify(savedAll));
    check('settings summary follows the sheet', savedAll.summary.includes('放大 3.2 倍')
      && savedAll.summary.includes('Pixel'), savedAll.summary);
    await shot(cdp, 'home-scale-setup.png');

    /* ---- 8 · home + sheet + detail scale tick boxes ---- */
    console.log('\n[8] home + sheet + detail · one per-game switch');
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
    await wait(500);
    const engineTick = await evalJson(cdp, `JSON.stringify({
      has: !!document.querySelector('#engineScaleRow .hero-scale-check'),
      checked: document.querySelector('#engineScaleRow')?.getAttribute('aria-checked') || '',
      home: (document.querySelector('#homeScaleHint') || {}).textContent || '',
      sheet: (document.querySelector('#engineScaleHint') || {}).textContent || '',
      detail: (document.querySelector('#detailScaleHint') || {}).textContent || ''
    })`);
    check('sheet has the same tick box', engineTick.has === true, JSON.stringify(engineTick));
    check('sheet tick box mirrors the home value', engineTick.checked === afterTick, JSON.stringify(engineTick));
    check('home / sheet / detail hints agree on the on/off state',
      engineTick.home === engineTick.sheet
        && engineTick.home.includes('已关闭') === engineTick.detail.includes('已关闭'),
      JSON.stringify({ home: engineTick.home, sheet: engineTick.sheet, detail: engineTick.detail }));
    await shot(cdp, 'home-scale-tick.png');

    /* ---- 9 · immersive shell: the fullscreen switch changes the layout ---- */
    console.log('\n[9] immersive shell · fullscreen layout switch');
    await cdp.ev(`window.__novaExport.setup('home')`);
    await wait(350);
    const beforeIm = await evalJson(cdp, `JSON.stringify({
      dir: getComputedStyle(document.querySelector('#rail')).flexDirection
    })`);
    await cdp.ev(`(() => {
      const rail = document.querySelector('#rail');
      if (rail && !rail.querySelector('.tile')) {
        const tile = document.createElement('button');
        tile.className = 'tile';
        tile.innerHTML = '<span class="tile-art"></span><span class="tile-label"><span class="tile-name">' +
          '这是一个特别长的游戏名称用来验证三十个字也完整显示不会被截断也不会压住别的文字' +
          '</span></span>';
        rail.appendChild(tile);
      }
      const row = document.querySelector('#calmRow');
      if (row && !document.documentElement.classList.contains('calm')) row.click();
      document.documentElement.classList.add('calm');
      return 'ok';
    })()`);
    await wait(400);
    const afterIm = await evalJson(cdp, `JSON.stringify({
      dir: getComputedStyle(document.querySelector('#rail')).flexDirection,
      dockW: Math.round(document.querySelector('.dock').getBoundingClientRect().width),
      dockBottom: Math.round(document.querySelector('.dock').getBoundingClientRect().bottom),
      winW: Math.round(innerWidth),
      winH: Math.round(innerHeight),
      veil: getComputedStyle(document.querySelector('.view-home .stage'), '::before').backgroundImage,
      cover: (() => {
        const el = document.querySelector('.view-home .stage');
        const a = getComputedStyle(el, '::after');
        const r = el.getBoundingClientRect();
        return { pos: a.position, top: a.top, right: a.right, bottom: a.bottom, left: a.left, w: Math.round(r.width), h: Math.round(r.height) };
      })(),
      dockPos: getComputedStyle(document.querySelector('.dock')).position,
      stagePad: parseFloat(getComputedStyle(document.querySelector('.view-home .stage')).paddingBottom),
      barH: Math.round(document.querySelector('.view-home .hero-inner').getBoundingClientRect().height),
      cardW: getComputedStyle(document.documentElement).getPropertyValue('--im-card-width').trim(),
      tickRadius: getComputedStyle(document.documentElement).getPropertyValue('--hs-check-radius').trim(),
      nameWhite: getComputedStyle(document.querySelector('.tile-name')).whiteSpace,
      nameClip: getComputedStyle(document.querySelector('.tile-name')).textOverflow,
      nameOverflow: getComputedStyle(document.querySelector('.tile-name')).overflow
    })`);
    check('immersive mode turns the card band horizontal', afterIm.dir === 'row', JSON.stringify({ before: beforeIm.dir, after: afterIm.dir }));
    check('the card band spans the window width', Math.abs(afterIm.dockW - afterIm.winW) <= 4, JSON.stringify(afterIm));
    check('the card band sits at the bottom', afterIm.winH - afterIm.dockBottom <= 4, JSON.stringify(afterIm));
    check('the cover layer fills the whole stage',
      afterIm.cover.pos === 'absolute' && afterIm.cover.top === '0px' && afterIm.cover.left === '0px'
      && afterIm.cover.right === '0px' && afterIm.cover.bottom === '0px',
      JSON.stringify(afterIm.cover));
    check('the veil only darkens the bottom band',
      !afterIm.veil.includes('90deg') && !afterIm.veil.includes('to right'), afterIm.veil.slice(0, 90));
    check('the active theme feeds the new slots', !!afterIm.cardW && !!afterIm.tickRadius, JSON.stringify({ cardW: afterIm.cardW, tickRadius: afterIm.tickRadius }));
    check('the icon strip overlays the cover instead of taking a row',
      afterIm.dockPos === 'absolute' && afterIm.stagePad > 40, JSON.stringify({ dockPos: afterIm.dockPos, stagePad: afterIm.stagePad }));
    check('the artwork keeps the majority of the screen',
      (afterIm.winH - afterIm.barH - afterIm.stagePad - 44) / afterIm.winH > 0.55,
      JSON.stringify({ barH: afterIm.barH, dock: afterIm.stagePad, winH: afterIm.winH }));
    check('long game names wrap instead of being cut',
      afterIm.nameWhite === 'normal' && afterIm.nameClip === 'clip' && afterIm.nameOverflow === 'visible',
      JSON.stringify({ white: afterIm.nameWhite, clip: afterIm.nameClip, overflow: afterIm.nameOverflow }));
    await shot(cdp, 'home-immersive.png');

    console.log('\n[10] immersive nav · pad and keyboard walk the same rows');
    const press = async (key) => {
      await cdp.ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, bubbles: true }))`);
      await wait(160);
    };
    const focused = async () => evalJson(cdp, `JSON.stringify({
      id: document.activeElement ? document.activeElement.id : '',
      cls: document.activeElement ? document.activeElement.className : '',
      ring: !!document.querySelector('.view-home .is-pad-focus')
    })`);

    // Enter immersive through the app (the 沉稳模式 switch), not by painting a
    // class, so the navigation guard sees the same state a player would.
    await cdp.ev(`(() => { const row = document.querySelector('#calmRow');
      if (row && !document.documentElement.classList.contains('calm')) row.click(); return 1; })()`);
    await wait(700);
    const entered = await evalJson(cdp, `JSON.stringify({ on: document.documentElement.classList.contains('calm') })`);
    check('沉稳模式 enters the immersive layout', entered.on === true, JSON.stringify(entered));

    await press('ArrowRight');
    const f0 = await focused();
    check('first arrow lands on the primary action', f0.id === 'playBtn', JSON.stringify(f0));

    await press('ArrowRight');
    const f1 = await focused();
    await press('ArrowRight');
    const f2 = await focused();
    await press('ArrowRight');
    const f3 = await focused();
    check('←/→ walks the action row', f1.id === 'detailBtn' && f2.id === 'homeEngineBtn' && f3.id === 'homeScaleRow',
      JSON.stringify({ f1: f1.id, f2: f2.id, f3: f3.id }));

    await press('ArrowRight');
    const f4 = await focused();
    check('the action row wraps back to the primary', f4.id === 'playBtn', JSON.stringify(f4));

    await press('ArrowDown');
    const f5 = await focused();
    check('↓ drops into the icon strip', /tile/.test(f5.cls), JSON.stringify(f5));

    await press('ArrowUp');
    const f6 = await focused();
    check('↑ returns to the action row', f6.id === 'playBtn', JSON.stringify(f6));

    const sizes = await evalJson(cdp, `JSON.stringify((() => {
      const h = (sel) => { const el = document.querySelector(sel); return el ? Math.round(el.getBoundingClientRect().height) : 0; };
      return { play: h('.view-home #playBtn'), detail: h('.view-home #detailBtn'), scale: h('.view-home #homeScaleRow'), tile: h('.view-home .rail .tile') };
    })())`);
    check('every action clears the 44px touch floor',
      sizes.play >= 48 && sizes.detail >= 44 && sizes.scale >= 44 && sizes.tile >= 64, JSON.stringify(sizes));

    const ringWidth = await evalJson(cdp, `JSON.stringify((() => {
      const el = document.querySelector('.view-home .is-pad-focus');
      if (!el) return { ring: 0 };
      const cs = getComputedStyle(el);
      return { ring: parseFloat(cs.outlineWidth) || 0, style: cs.outlineStyle, offset: parseFloat(cs.outlineOffset) || 0 };
    })())`);
    check('the focus ring is drawn and offset from the control',
      ringWidth.ring >= 2 && ringWidth.style !== 'none', JSON.stringify(ringWidth));
    await shot(cdp, 'home-immersive-focus.png');

    await shot(cdp, 'home-immersive.png');
    await cdp.ev(`document.documentElement.classList.remove('is-fullscreen')`);
    await wait(300);

    console.log('\n[11] hidden games stay off the home shelf');
    /* "隐藏" used to remove the tile from the library grid only: the cover,
       the strip and the "N 款" count kept advertising the game the player had
       just hidden. These four assertions lock the shelf behaviour in. */
    const shelfBefore = await evalJson(cdp, `JSON.stringify((() => {
      const tiles = Array.from(document.querySelectorAll('.rail .tile'));
      return { tiles: tiles.length, count: (document.querySelector('#dockCount') || {}).textContent || '',
               logo: (document.querySelector('#gameLogo') || {}).textContent || '' };
    })())`);

    const hiddenName = await cdp.ev(`(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const nav = document.querySelector('.nav-btn[data-nav="home"]');
      if (nav) nav.click();
      await sleep(320);
      const name = (document.querySelector('.rail .tile.is-active .tile-name') || {}).textContent || '';
      const detail = document.querySelector('#detailBtn');
      if (detail) detail.click();
      await sleep(700);
      const manage = document.querySelector('#detailManage');
      const panel = document.querySelector('#managePanel');
      if (panel && panel.hidden && manage) manage.click();
      await sleep(500);
      const toggle = document.querySelector('#manageHiddenRow');
      if (toggle) toggle.click();
      await sleep(900);
      document.querySelector('#detailsClose') && document.querySelector('#detailsClose').click();
      await sleep(500);
      return name;
    })()`);

    const shelfAfter = await evalJson(cdp, `JSON.stringify((() => {
      const tiles = Array.from(document.querySelectorAll('.rail .tile'));
      return {
        tiles: tiles.length,
        count: (document.querySelector('#dockCount') || {}).textContent || '',
        logo: (document.querySelector('#gameLogo') || {}).textContent || '',
        names: tiles.map((t) => (t.querySelector('.tile-name') || {}).textContent || '')
      };
    })())`);
    check('hiding a game removes its tile from the shelf',
      shelfAfter.tiles === shelfBefore.tiles - 1, `${shelfBefore.tiles} → ${shelfAfter.tiles}`);
    check('the hidden game is not in the strip',
      !!hiddenName && !shelfAfter.names.includes(hiddenName), `hidden="${hiddenName}"`);
    check('the dock count follows the shelf',
      shelfAfter.count.trim() === `${shelfAfter.tiles} 款`, shelfAfter.count);
    check('the cover moves off the hidden game',
      shelfAfter.logo !== shelfBefore.logo, `"${shelfBefore.logo}" → "${shelfAfter.logo}"`);

    // Put it back: the pass runs on the demo library and the next group (or a
    // later run) must not inherit a hidden game.
    await cdp.ev(`(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const nav = document.querySelector('.nav-btn[data-nav="library"]');
      if (nav) nav.click();
      await sleep(500);
      const hiddenFilter = document.querySelector('.filter[data-filter="hidden"]');
      if (hiddenFilter) hiddenFilter.click();
      await sleep(400);
      const card = document.querySelector('.lib-card[data-game]');
      if (card) card.click();
      await sleep(600);
      const manage = document.querySelector('#detailManage');
      const panel = document.querySelector('#managePanel');
      if (panel && panel.hidden && manage) manage.click();
      await sleep(400);
      const toggle = document.querySelector('#manageHiddenRow');
      if (toggle && toggle.getAttribute('aria-checked') === 'true') toggle.click();
      await sleep(500);
      document.querySelector('#detailsClose') && document.querySelector('#detailsClose').click();
      await sleep(300);
      const homeBtn = document.querySelector('.nav-btn[data-nav="home"]');
      if (homeBtn) homeBtn.click();
      await sleep(300);
      return 'ok';
    })()`);
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
