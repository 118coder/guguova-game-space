// Dev-only: verify that the opening uses the saved theme's preset.
const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');

const PORT = Number(process.env.NOVA_CDP_PORT || 9223);
const targetTheme = process.argv[2] || 'endfield';
const out = process.argv[3] || '../_shots/ef-intro-verify.jpg';
const get = (p) => new Promise((resolve, reject) => {
  http.get({ host: '127.0.0.1', port: PORT, path: p }, (res) => {
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
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return r.result && r.result.result ? r.result.result.value : null;
  };

  await send('Page.navigate', { url: 'https://nova.site/index.html' });
  for (let i = 0; i < 100; i += 1) {
    if (await evaluate("document.body.classList.contains('is-booted')")) break;
    await new Promise((r) => setTimeout(r, 150));
  }
  console.log('booted; setting', targetTheme);
  await evaluate("document.querySelector('[data-nav=\"appearance\"]').click()");
  await new Promise((r) => setTimeout(r, 600));
  await evaluate(`document.querySelector('[data-theme="${targetTheme}"]').click()`);
  await new Promise((r) => setTimeout(r, 1400));
  console.log('saved theme:', await evaluate("window.NovaTheme && NovaTheme.activeId"));

  await send('Page.reload');
  let preset = null;
  for (let i = 0; i < 80; i += 1) {
    const state = await evaluate("({ playing: document.body.classList.contains('is-intro'), preset: document.getElementById('introOverlay') && document.getElementById('introOverlay').dataset.intro })");
    if (state && state.playing) { preset = state.preset; break; }
    await new Promise((r) => setTimeout(r, 80));
  }
  console.log('intro preset:', preset);
  await new Promise((r) => setTimeout(r, 700));
  const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 88 });
  if (shot.result && shot.result.data) fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
  console.log('intro active after 700ms:', await evaluate("document.body.classList.contains('is-intro')"));
  ws.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
