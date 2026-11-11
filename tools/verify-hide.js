#!/usr/bin/env node
// End-to-end check for the hidden-game regression: a hidden title has to stay
// reachable — by clicking its card in the 隐藏 filter and by right-clicking it
// and choosing 「游戏详情」 — otherwise the player can never unhide it.
//
//   node tools/verify-hide.js
//
// Runs against the headless host (fictional library, never the player's data).

const { startHost } = require('./lib/headless-host');
const { connect } = require('./lib/cdp');

(async () => {
  const host = await startHost({ width: 1439, height: 1124 });
  const cdp = await connect({ port: host.cdpPort });
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  // The host hands back the bridge mock; it has to be installed before the
  // document runs, otherwise window.chrome.webview is missing and boot fails.
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: host.mockScript });
  await cdp.send('Page.navigate', { url: `${host.origin}/src/index.html?novaHidden=1` });
  for (let i = 0; i < 80; i++) {
    if (await cdp.ev(`!!document.body.classList.contains('is-booted')`)) break;
    await wait(200);
  }
  await cdp.ev(`(()=>{try{NovaIntro&&NovaIntro.skip&&NovaIntro.skip()}catch(e){}return 1})()`);
  await wait(420);

  const raw = await cdp.ev(`(async () => {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    document.querySelector('[data-nav="library"]').click();
    await sleep(360);
    document.querySelector('[data-filter="hidden"]').click();
    await sleep(500);
    const cards = [...document.querySelectorAll('#libGrid .lib-card')];
    if (!cards.length) return JSON.stringify({ ok: false, reason: '隐藏筛选里没有卡片' });
    const gameId = cards[0].dataset.game;
    const ariaName = cards[0].getAttribute('aria-label');

    // 1. 左键：库里点卡片是「选中并回首页」，隐藏项也必须真的被选中
    cards[0].click();
    await sleep(640);
    const clickTitle = document.title;
    // 从首页进详情（玩家的常规路径）
    document.querySelector('#detailBtn').click();
    await sleep(540);
    const clickDetail = document.querySelector('#detailTitle').textContent.trim();
    const clickHidden = document.querySelector('#manageHiddenRow').getAttribute('aria-checked');
    document.querySelector('#detailsClose').click();
    await sleep(460);

    // 2. 回到库的「隐藏」筛选，右键 → 游戏详情
    document.querySelector('[data-nav="library"]').click();
    await sleep(420);
    const card = document.querySelector('#libGrid .lib-card');
    const rect = card.getBoundingClientRect();
    card.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true, cancelable: true,
      clientX: rect.left + 24, clientY: rect.top + 24
    }));
    await sleep(320);
    const items = [...document.querySelectorAll('#contextMenu .context-item')];
    const labels = items.map((b) => b.textContent.trim());
    const detailItem = items.find((b) => b.textContent.includes('游戏详情'));
    if (!detailItem) return JSON.stringify({ ok: false, reason: '菜单里没有游戏详情', labels });
    detailItem.click();
    await sleep(620);
    const menuTitle = document.querySelector('#detailTitle').textContent.trim();
    const menuHidden = document.querySelector('#manageHiddenRow').getAttribute('aria-checked');

    // 3. 取消隐藏
    document.querySelector('#manageHiddenRow').click();
    await sleep(640);
    const afterUnhide = document.querySelector('#manageHiddenRow').getAttribute('aria-checked');

    // 4. 回库确认它离开了隐藏列表
    document.querySelector('#detailsClose').click();
    await sleep(520);
    document.querySelector('[data-filter="hidden"]').click();
    await sleep(420);
    const left = [...document.querySelectorAll('#libGrid .lib-card')]
      .map((el) => el.dataset.game).filter((id) => id === gameId).length;

    return JSON.stringify({
      ok: true, gameId, ariaName,
      clickTitle, clickDetail, clickHidden,
      labels, menuTitle, menuHidden,
      afterUnhide, stillInHidden: left
    });
  })()`);

  let data = {};
  try { data = JSON.parse(raw || '{}'); } catch (error) { data = { raw }; }
  console.log(JSON.stringify(data, null, 2));

  const problems = [];
  if (!data.ok) problems.push(data.reason || '流程中断');
  if (data.clickTitle && data.ariaName && !data.clickTitle.includes(data.ariaName)) {
    problems.push(`左键点击没有选中这张卡：卡片=${data.ariaName} 标题=${data.clickTitle}`);
  }
  if (data.clickDetail && data.ariaName && !data.ariaName.includes(data.clickDetail)) {
    problems.push(`从首页进详情打开的不是这张卡：卡片=${data.ariaName} 详情=${data.clickDetail}`);
  }
  if (data.clickHidden !== 'true') problems.push('详情里的隐藏开关不是「已隐藏」');
  if (data.menuTitle && data.ariaName && !data.ariaName.includes(data.menuTitle)) {
    problems.push(`右键详情打开的不是这张卡：卡片=${data.ariaName} 详情=${data.menuTitle}`);
  }
  if (data.menuHidden !== 'true') problems.push('右键详情后隐藏开关不是「已隐藏」');
  if (data.afterUnhide !== 'false') problems.push('取消隐藏没有生效');
  if (data.stillInHidden) problems.push('取消隐藏后仍留在隐藏列表');

  await cdp.close();
  await host.close();
  if (problems.length) {
    console.log('\n✗ ' + problems.join('\n✗ '));
    process.exit(1);
  }
  console.log('\n✓ 隐藏游戏仍可打开、可取消隐藏');
})();
