#!/usr/bin/env node
// Edge cases around hiding a game — the ten risks written down in
// docs/HANDOFF-NEXT.md §1.41.5. Everything here runs against the headless host
// with a fictional library, so no player data is touched.
//
//   node tools/verify-hidden-edges.js
//
// Covers:
//   A. every game hidden      → hero shows the empty state, dock says 0 款
//   B. stat strip / dock      → both count the shelf, hidden reported apart
//   C. 程序缺失                → also lists hidden entries, badged 已隐藏
//   D. search for a hidden game → names the 隐藏 tab instead of "没有找到"
//   E. library blank right-click → no 游戏详情 (it used to open the home pick)
//   F. detail sheet right-click  → no duplicate 游戏详情 entry
//   G. card right-click in 程序缺失 → opens THAT hidden game

const { startHost } = require('./lib/headless-host');
const { connect } = require('./lib/cdp');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function openSession(query) {
  const host = await startHost({ width: 1439, height: 1124 });
  const cdp = await connect({ port: host.cdpPort });
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: host.mockScript });
  await cdp.send('Page.navigate', { url: `${host.origin}/src/index.html${query}` });
  for (let i = 0; i < 80; i++) {
    if (await cdp.ev(`!!document.body.classList.contains('is-booted')`)) break;
    await wait(200);
  }
  await cdp.ev(`(()=>{try{NovaIntro&&NovaIntro.skip&&NovaIntro.skip()}catch(e){}return 1})()`);
  await wait(420);
  return { host, cdp };
}

async function allHiddenCase() {
  const { host, cdp } = await openSession('?novaHidden=all');
  const raw = await cdp.ev(`(() => {
    const text = (sel) => { const el = document.querySelector(sel); return el ? el.textContent.trim() : null; };
    return JSON.stringify({
      dock: text('#dockCount'),
      railEmpty: !document.querySelector('#railEmpty').hidden,
      kicker: text('#kickerDim'),
      tagline: text('#gameTagline'),
      logo: text('#gameLogo'),
      empty: document.body.classList.contains('is-empty'),
      playLabel: text('#playLabel')
    });
  })()`);
  await cdp.close();
  await host.close();
  return JSON.parse(raw || '{}');
}

async function libraryCase() {
  const { host, cdp } = await openSession('?novaHidden=missing');
  const raw = await cdp.ev(`(async () => {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const out = {};
    const text = (sel) => { const el = document.querySelector(sel); return el ? el.textContent.trim() : null; };

    document.querySelector('[data-nav="library"]').click();
    await sleep(400);

    // B. the strip and the dock must print the same game count
    const stats = [...document.querySelectorAll('#libStats > span')]
      .map((el) => el.textContent.replace(/\\s+/g, ' ').trim());
    out.statsGames = (stats[0] || '').replace(/[^0-9]/g, '');
    out.dock = text('#dockCount');
    out.hiddenStat = stats.find((line) => line.includes('已隐藏')) || '';

    // C. 程序缺失 has to include the hidden entry, and say that it is hidden
    document.querySelector('[data-filter="missing"]').click();
    await sleep(420);
    const missingCards = [...document.querySelectorAll('#libGrid .lib-card')];
    out.missingCount = missingCards.length;
    const hiddenCards = missingCards.filter((card) => card.textContent.includes('已隐藏'));
    out.missingHidden = hiddenCards.length;
    out.missingHiddenName = hiddenCards[0] ? hiddenCards[0].getAttribute('aria-label') : '';

    // D. searching 全部 for a hidden game names the 隐藏 tab
    document.querySelector('[data-filter="all"]').click();
    await sleep(320);
    const hiddenGame = hiddenCards[0] ? hiddenCards[0].dataset.game : '';
    const form = document.querySelector('.lib-search') || document.querySelector('#libSearch');
    const search = document.querySelector('#libSearch');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(search, String(out.missingHiddenName || '').slice(0, 2));
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(520);
    out.searchEmptyTitle = text('#libEmptyTitle');
    out.searchEmptyText = text('#libEmptyText');
    out.searchButton = text('#clearFilters');
    document.querySelector('#clearFilters').click();
    await sleep(460);
    out.afterJumpFilter = document.querySelector('.filter.is-active').dataset.filter;

    // E. right-clicking empty space in the library must not offer a game
    document.querySelector('#libSearch').value = '';
    document.querySelector('#libSearch').dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(320);
    const search2 = document.querySelector('#libSearch');
    setter.call(search2, 'zzzz-not-a-game');
    search2.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(460);
    const emptyBox = document.querySelector('#libEmpty');
    const rect = emptyBox.getBoundingClientRect();
    emptyBox.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true, cancelable: true,
      clientX: Math.round(rect.left + rect.width / 2),
      clientY: Math.round(rect.top + rect.height / 2)
    }));
    await sleep(320);
    out.blankMenu = [...document.querySelectorAll('#contextMenu .context-item')].map((b) => b.textContent.trim());
    document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    await sleep(160);

    // F/G. 程序缺失 → right-click the hidden card → 游戏详情 opens THAT game
    setter.call(search2, '');
    search2.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(300);
    document.querySelector('[data-filter="missing"]').click();
    await sleep(420);
    const card = [...document.querySelectorAll('#libGrid .lib-card')]
      .find((el) => el.textContent.includes('已隐藏'));
    out.cardName = card ? card.getAttribute('aria-label') : null;
    out.cardId = card ? card.dataset.game : null;
    const cardRect = card.getBoundingClientRect();
    card.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true, cancelable: true,
      clientX: Math.round(cardRect.left + 20),
      clientY: Math.round(cardRect.top + 20)
    }));
    await sleep(300);
    const items = [...document.querySelectorAll('#contextMenu .context-item')];
    const detail = items.find((b) => b.textContent.includes('游戏详情'));
    out.cardMenuHasDetail = !!detail;
    if (detail) {
      detail.click();
      await sleep(560);
    }
    out.detailTitle = text('#detailTitle');
    out.detailHidden = document.querySelector('#manageHiddenRow').getAttribute('aria-checked');

    // F. inside the sheet the menu must not repeat 游戏详情
    const titleBox = document.querySelector('#detailTitle').getBoundingClientRect();
    document.querySelector('#detailTitle').dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true, cancelable: true,
      clientX: Math.round(titleBox.left + 12),
      clientY: Math.round(titleBox.top + 12)
    }));
    await sleep(300);
    out.detailMenu = [...document.querySelectorAll('#contextMenu .context-item')].map((b) => b.textContent.trim());

    return JSON.stringify(out);
  })()`);
  await cdp.close();
  await host.close();
  return JSON.parse(raw || '{}');
}

(async () => {
  const all = await allHiddenCase();
  const lib = await libraryCase();
  console.log(JSON.stringify({ allHidden: all, library: lib }, null, 2));

  const problems = [];
  if (all.dock !== '0 款') problems.push(`全部隐藏时 dock 不是 0 款：${all.dock}`);
  if (!all.railEmpty) problems.push('全部隐藏时没有显示空货架提示');
  if (!all.empty) problems.push('全部隐藏时 body 没有 is-empty');
  if (all.kicker !== '还没有游戏') problems.push(`全部隐藏时 hero 仍显示游戏：${all.kicker}`);
  if (all.tagline !== '选择游戏开始。') problems.push(`全部隐藏时 hero 标语未清空：${all.tagline}`);
  if (all.playLabel !== '添加游戏') problems.push(`全部隐藏时主按钮不是「添加游戏」：${all.playLabel}`);

  if (!lib.statsGames || !lib.dock) problems.push('拿不到统计/停靠计数');
  else if (!lib.dock.startsWith(lib.statsGames)) {
    problems.push(`统计与 dock 口径不一致：统计 ${lib.statsGames} 款，dock ${lib.dock}`);
  }
  if (!lib.hiddenStat) problems.push('统计条没有报出「已隐藏」数量');
  if (lib.missingHidden < 1) problems.push('程序缺失筛选里看不到隐藏的缺失项');
  if (!lib.missingCount) problems.push('程序缺失筛选是空的');
  if (!/已隐藏/.test(lib.searchEmptyTitle || '')) {
    problems.push(`搜隐藏游戏没有提示：${lib.searchEmptyTitle} / ${lib.searchEmptyText}`);
  }
  if (lib.searchButton !== '查看隐藏的游戏') problems.push(`空状态按钮文案不对：${lib.searchButton}`);
  if (lib.afterJumpFilter !== 'hidden') problems.push(`空状态按钮没有跳到隐藏：${lib.afterJumpFilter}`);
  if ((lib.blankMenu || []).some((label) => label.includes('游戏详情'))) {
    problems.push('库空白处右键仍出现「游戏详情」');
  }
  if (!lib.cardMenuHasDetail) problems.push('缺失筛选里右键隐藏卡片没有「游戏详情」');
  if (lib.detailTitle && lib.cardName && !lib.cardName.includes(lib.detailTitle)) {
    problems.push(`右键打开的详情不是这张卡：卡片=${lib.cardName} 详情=${lib.detailTitle}`);
  }
  if (lib.detailHidden !== 'true') problems.push('详情里的隐藏开关不是「已隐藏」');
  if ((lib.detailMenu || []).some((label) => label.includes('游戏详情'))) {
    problems.push('详情浮层里右键仍有重复的「游戏详情」');
  }

  if (problems.length) {
    console.log('\n✗ ' + problems.join('\n✗ '));
    process.exit(1);
  }
  console.log('\n✓ 隐藏边界全部通过（空舞台 / 统计口径 / 缺失筛选 / 搜索提示 / 右键作用域）');
})();
