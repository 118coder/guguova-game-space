// Simulate an Xbox pad by injecting navigator.getGamepads over CDP.
const fs = require('fs');
const http = require('http');
const PORT = process.env.NOVA_CDP_PORT || 9223;

function get(path) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: PORT, path }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

(async () => {
  const targets = await get('/json/list');
  const page = targets.find((t) => t.type === 'page');
  const WebSocket = require('ws');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const cbs = new Map();
  ws.on('message', (raw) => {
    const m = JSON.parse(raw);
    if (m.id && cbs.has(m.id)) { cbs.get(m.id)(m); cbs.delete(m.id); }
  });
  const send = (method, params = {}) => new Promise((r) => {
    const i = ++id; cbs.set(i, r); ws.send(JSON.stringify({ id: i, method, params }));
  });
  await new Promise((r) => ws.on('open', r));
  await send('Runtime.enable');

  const setup = `
    window.__fakePad = {
      id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)',
      index: 0, connected: true, mapping: 'standard', timestamp: performance.now(),
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }))
    };
    navigator.getGamepads = () => [window.__fakePad, null, null, null];
    window.__pressPad = function(index, ms) {
      const b = window.__fakePad.buttons[index];
      b.pressed = true; b.value = 1;
      window.__fakePad.timestamp = performance.now();
      setTimeout(() => { b.pressed = false; b.value = 0; }, ms || 120);
    };
    'ok'`;
  const res = await send('Runtime.evaluate', { expression: setup, returnByValue: true });
  console.log('setup:', res.result.result.value);

  await new Promise((r) => setTimeout(r, 900));
  const probe = await send('Runtime.evaluate', {
    expression: `JSON.stringify({
      hintsVisible: !document.querySelector('.pad-hints').hidden,
      hints: document.querySelector('.pad-hints').textContent.replace(/\s+/g,' ').trim(),
      status: document.querySelector('#inputStatus span')?.textContent
    })`,
    returnByValue: true
  });
  console.log('after connect:', probe.result.result.value);

  // Press d-pad right twice to move selection
  const before = await send('Runtime.evaluate', { expression: `document.getElementById('gameLogo').textContent`, returnByValue: true });
  await send('Runtime.evaluate', { expression: `window.__pressPad(15, 140); 'pressed'`, returnByValue: true });
  await new Promise((r) => setTimeout(r, 700));
  await send('Runtime.evaluate', { expression: `window.__pressPad(15, 140); 'pressed'`, returnByValue: true });
  await new Promise((r) => setTimeout(r, 700));
  const after = await send('Runtime.evaluate', { expression: `document.getElementById('gameLogo').textContent`, returnByValue: true });
  console.log('selection:', before.result.result.value, '->', after.result.result.value);

  // Press A (start) then screenshot the launch overlay
  await send('Runtime.evaluate', { expression: `window.__pressPad(0, 150); 'a'`, returnByValue: true });
  await new Promise((r) => setTimeout(r, 2600));
  const state = await send('Runtime.evaluate', {
    expression: `JSON.stringify({
      launch: document.getElementById('launchOverlay').classList.contains('is-open'),
      ready: document.getElementById('launchOverlay').classList.contains('is-ready'),
      status: document.getElementById('launchStatus').textContent
    })`,
    returnByValue: true
  });
  console.log('after A:', state.result.result.value);

  // Press B to close
  await send('Runtime.evaluate', { expression: `window.__pressPad(1, 150); 'b'`, returnByValue: true });
  await new Promise((r) => setTimeout(r, 1600));
  const closed = await send('Runtime.evaluate', {
    expression: `JSON.stringify({ open: document.getElementById('launchOverlay').classList.contains('is-open') })`,
    returnByValue: true
  });
  console.log('after B:', closed.result.result.value);

  // Cleanup fake pad
  await send('Runtime.evaluate', { expression: `navigator.getGamepads = () => [null,null,null,null]; delete window.__fakePad; 'done'`, returnByValue: true });
  ws.close();
})().catch((e) => { console.error(e); process.exit(1); });
