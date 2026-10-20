// Dev-only: render the theme concept boards in the app WebView.
// Usage: node render-concepts.js <outDir> [--only=summer]
const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const PORT = Number(process.env.NOVA_CDP_PORT || 9223);
const outDir = process.argv[2] || '_shots';
const onlyArg = process.argv.find((arg) => arg.startsWith('--only='));
const only = onlyArg ? onlyArg.split('=')[1] : '';
const boards = ["nova", "aurum", "endfield", "codex", "zerohour", "mnemo", "riot", "grimoire", "riso", "summer", "broadcast", "dusk", "steam", "nightflight"]
  .filter((id) => !only || id === only);

// The boards are served from the app's virtual host (nova.site → WebRoot),
// not from the repo tools/ folder. Stage the source there for the render and
// remove it on exit, so `node tools/render-concepts.js out` works without a
// manual copy.
const roots = ['Debug', 'Release'].map((cfg) => path.join(__dirname, '..', 'bin', cfg, 'net10.0-windows', 'win-x64', 'src'));
const webRoot = roots.find((root) => fs.existsSync(path.join(root, 'index.html')));
if (!webRoot) throw new Error('web root not found — build the launcher first (dotnet build)');
const stagedBoard = path.join(webRoot, 'theme-concepts.html');
fs.copyFileSync(path.join(__dirname, 'theme-concepts.html'), stagedBoard);
process.on('exit', () => { try { fs.rmSync(stagedBoard, { force: true }); } catch (error) {} });

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
  if (!page) throw new Error('no page target');
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
    width: 960, height: 540, deviceScaleFactor: 2, mobile: false
  });

  for (const board of boards) {
    await send('Page.navigate', { url: `https://nova.site/theme-concepts.html?board=${board}` });
    await new Promise((r) => setTimeout(r, 1100));
    const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    if (shot.result && shot.result.data) {
      const file = path.join(outDir, `concept-${board}.png`);
      fs.writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
      console.log('shot', file);
    } else {
      console.error('shot failed', board, JSON.stringify(shot));
    }
  }

  // Return the shell to the launcher after rendering the dev boards.
  await send('Page.navigate', { url: 'https://nova.site/index.html' });
  await new Promise((r) => setTimeout(r, 600));
  await send('Emulation.clearDeviceMetricsOverride');
  ws.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
