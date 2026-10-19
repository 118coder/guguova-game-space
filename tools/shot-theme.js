// Dev-only: set a theme and capture home / library / detail screens.
// Usage: node shot-theme.js <themeId> <outPrefix> [--views home,library,detail,appearance]
const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');

const PORT = Number(process.env.NOVA_CDP_PORT || 9223);
const theme = process.argv[2] || 'riot';
const prefix = process.argv[3] || `../_shots/${theme}`;
const viewsArg = process.argv.find((a) => a.startsWith('--views='));
const views = (viewsArg ? viewsArg.split('=')[1] : 'home').split(',').filter(Boolean);

const get = (p) => new Promise((res, rej) => http.get({ host: '127.0.0.1', port: PORT, path: p }, (r) => {
  let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res(JSON.parse(d)));
}).on('error', rej));

(async () => {
  const list = await get('/json/list');
  const page = list.find((t) => t.type === 'page');
  if (!page) throw new Error('no page target');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  ws.on('message', (raw) => { const m = JSON.parse(raw); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await new Promise((r) => ws.on('open', r));
  await send('Runtime.enable');
  await send('Page.enable');
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) console.error('EVAL', JSON.stringify(r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description || r.result.exceptionDetails).slice(0, 400));
    return r.result && r.result.result ? r.result.result.value : null;
  };
  const capture = async (name) => {
    const s = await send('Page.captureScreenshot', { format: 'jpeg', quality: 86 });
    const file = `${prefix}-${name}.jpg`;
    fs.writeFileSync(file, Buffer.from(s.result.data, 'base64'));
    console.log('shot', file);
  };

  // Activate the theme directly (same code path as the theme card).
  await ev(`(async () => {
    document.getElementById('contextMenu').classList.remove('is-open');
    await window.NovaTheme.activate('${theme}', { silent: true });
    document.querySelector('.nav-btn[data-nav="home"]').click();
    await new Promise((r) => setTimeout(r, 1400));
    return document.documentElement.dataset.theme;
  })()`);

  for (const view of views) {
    if (view === 'home') {
      await ev(`(async () => { document.querySelector('.nav-btn[data-nav="home"]').click(); document.body.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); await new Promise(r=>setTimeout(r,3400)); })()`);
      await capture('home');
    } else if (view === 'library') {
      await ev(`(async () => { document.querySelector('.nav-btn[data-nav="library"]').click(); await new Promise(r=>setTimeout(r,900)); })()`);
      await capture('library');
    } else if (view === 'appearance') {
      await ev(`(async () => { document.querySelector('.nav-btn[data-nav="appearance"]').click(); await new Promise(r=>setTimeout(r,900)); })()`);
      await capture('appearance');
    } else if (view === 'detail') {
      await ev(`(async () => { document.querySelector('.nav-btn[data-nav="home"]').click(); await new Promise(r=>setTimeout(r,600)); document.getElementById('detailBtn').click(); await new Promise(r=>setTimeout(r,900)); })()`);
      await capture('detail');
      await ev(`(async () => { document.getElementById('detailsClose').click(); await new Promise(r=>setTimeout(r,400)); })()`);
    }
  }
  console.log(await ev(`(() => { const l = document.querySelector('#gameLogo'); return JSON.stringify({ theme: document.documentElement.dataset.theme, fit: getComputedStyle(l).getPropertyValue('--logo-fit'), ff: getComputedStyle(l).fontFamily, overflow: document.documentElement.scrollWidth > innerWidth }); })()`));
  ws.close();
})().catch((e) => { console.error(e); process.exit(1); });
