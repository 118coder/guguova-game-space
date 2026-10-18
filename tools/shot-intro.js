// Capture the boot intro at fixed offsets. Dev-only helper.
// Usage: node shot-intro.js <out-prefix> [waitMs...]
const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');

const PORT = Number(process.env.NOVA_CDP_PORT || 9223);
const prefix = process.argv[2] || '_shots/intro';
const offsets = process.argv.slice(3).map(Number).filter((n) => n >= 0);
const waits = offsets.length ? offsets : [500, 1200, 2000];

const get = (path) => new Promise((resolve, reject) => {
  http.get({ host: '127.0.0.1', port: PORT, path }, (res) => {
    let data = '';
    res.on('data', (chunk) => (data += chunk));
    res.on('end', () => resolve(JSON.parse(data)));
  }).on('error', reject);
});

async function target() {
  for (let i = 0; i < 120; i += 1) {
    try {
      const list = await get('/json/list');
      const page = list.find((t) => t.type === 'page');
      if (page) return page;
    } catch (error) {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('no page target');
}

async function main() {
  const page = await target();
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  });
  const send = (method, params = {}) => new Promise((resolve) => {
    const msgId = ++id;
    pending.set(msgId, resolve);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
  await new Promise((resolve) => ws.on('open', resolve));
  await send('Runtime.enable');
  await send('Page.enable');

  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return result.result && result.result.result ? result.result.result.value : null;
  };

  // Wait until the intro layer is actually playing.
  let started = false;
  for (let i = 0; i < 160; i += 1) {
    const state = await evaluate(`({ playing: document.body.classList.contains('is-intro'), preset: document.getElementById('introOverlay') && document.getElementById('introOverlay').dataset.intro })`);
    if (state && state.playing) { started = true; console.log('intro started', state.preset); break; }
    await new Promise((r) => setTimeout(r, 120));
  }
  if (!started) console.log('intro not detected (continuing)');

  let elapsed = 0;
  for (const wait of waits) {
    await new Promise((r) => setTimeout(r, Math.max(0, wait - elapsed)));
    elapsed = wait;
    const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 88 });
    if (shot.result && shot.result.data) {
      const file = `${prefix}-${wait}.jpg`;
      fs.writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
      console.log('shot', file);
    }
  }

  console.log(await evaluate(`({ playing: document.body.classList.contains('is-intro'), booted: document.body.classList.contains('is-booted') })`));
  ws.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
