// Ad-hoc probe: apply a viewport, activate a theme, open a view, evaluate a snippet.
// Usage: node tools/probe-one.js <theme> <view> <WxH> <exprfile>
const fs = require('fs');
const http = require('http');
const PORT = process.env.NOVA_CDP_PORT || 9223;

const get = (p) => new Promise((res, rej) => {
  http.get({ host: '127.0.0.1', port: PORT, path: p }, (r) => {
    let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res(JSON.parse(d)));
  }).on('error', rej);
});

(async () => {
  const [theme, view, size, exprFile] = process.argv.slice(2);
  const [width, height] = size.split('x').map(Number);
  const expr = fs.readFileSync(exprFile, 'utf8');
  const targets = await get('/json/list');
  const page = targets.find((t) => t.type === 'page');
  const WebSocket = require('ws');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const cbs = new Map();
  ws.on('message', (raw) => { const m = JSON.parse(raw); if (m.id && cbs.has(m.id)) { cbs.get(m.id)(m); cbs.delete(m.id); } });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; cbs.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await new Promise((r) => ws.on('open', r));
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  const ev = async (e, hard) => {
    const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true });
    if (hard && r.result && r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
    return r.result && r.result.result ? r.result.result.value : null;
  };
  await ev(`window.NovaDev && window.NovaDev.resetSurfaces && window.NovaDev.resetSurfaces()`);
  await ev(`window.__novaExport.setup(${JSON.stringify('home')})`);
  await ev(`(async()=>{ await window.NovaTheme.activate(${JSON.stringify(theme)},{silent:true}); await new Promise(r=>setTimeout(r,600)); return 1 })()`);
  await ev(`window.__novaExport.setup(${JSON.stringify(view)})`);
  await new Promise((r) => setTimeout(r, 900));
  const out = await ev(expr);
  console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 1));
  await send('Emulation.clearDeviceMetricsOverride');
  await ws.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
