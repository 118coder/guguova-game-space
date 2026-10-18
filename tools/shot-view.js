// Dev-only: emulate a viewport, wait for layout, capture a screenshot.
// Usage: node shot-view.js <width> <height> <out.jpg> [calm]
const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');

const [width, height, out, calm] = process.argv.slice(2);
const PORT = Number(process.env.NOVA_CDP_PORT || 9223);

const get = (path) => new Promise((resolve, reject) => {
  http.get({ host: '127.0.0.1', port: PORT, path }, (res) => {
    let data = '';
    res.on('data', (chunk) => (data += chunk));
    res.on('end', () => resolve(JSON.parse(data)));
  }).on('error', reject);
});

async function main() {
  const list = await get('/json/list');
  const page = list.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  });
  const send = (method, params = {}) => new Promise((resolve) => {
    const msgId = ++id;
    pending.set(msgId, resolve);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
  await new Promise((resolve) => ws.on('open', resolve));
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: Number(width), height: Number(height), deviceScaleFactor: 1, mobile: false
  });
  if (calm === 'calm-off') {
    await send('Runtime.evaluate', { expression: 'window.NovaMotion && NovaMotion.setCalm(false)' });
  }
  await new Promise((r) => setTimeout(r, 900));
  const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 88 });
  if (shot.result && shot.result.data) {
    fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
    console.log('shot', out);
  }
  await send('Emulation.clearDeviceMetricsOverride');
  ws.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
