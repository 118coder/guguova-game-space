// Drive the NOVA UI over Chrome DevTools Protocol for end-to-end checks.
// Usage: node drive.js <expression-file-or-inline> [--shot out.png]
const fs = require('fs');
const http = require('http');

const PORT = process.env.NOVA_CDP_PORT || 9223;

function get(path) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: PORT, path }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function main() {
  const [codeArg, ...rest] = process.argv.slice(2);
  const code = codeArg && no(fs) ? codeArg : codeArg;
  const expression = codeArg.startsWith('@') ? fs.readFileSync(codeArg.slice(1), 'utf8') : codeArg;
  const shotIndex = rest.indexOf('--shot');
  const shotPath = shotIndex >= 0 ? rest[shotIndex + 1] : null;
  const waitIndex = rest.indexOf('--wait');
  const waitMs = waitIndex >= 0 ? Number(rest[waitIndex + 1]) : 0;

  const targets = await get('/json/list');
  const page = targets.find((t) => t.type === 'page');
  if (!page) throw new Error('no page target');

  const WebSocket = require('ws');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const callbacks = new Map();

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw);
    if (msg.id && callbacks.has(msg.id)) {
      callbacks.get(msg.id)(msg);
      callbacks.delete(msg.id);
    }
  });

  const send = (method, params = {}) => new Promise((resolve) => {
    const msgId = ++id;
    callbacks.set(msgId, resolve);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });

  await new Promise((resolve) => ws.on('open', resolve));
  await send('Runtime.enable');

  if (waitMs) await new Promise((r) => setTimeout(r, waitMs));

  if (expression) {
    const result = await send('Runtime.evaluate', {
      expression: `(async () => { ${expression} })()`,
      awaitPromise: true,
      returnByValue: true
    });
    if (result.result && result.result.exceptionDetails) {
      console.error('EVAL ERROR:', JSON.stringify(result.result.exceptionDetails, null, 2));
    } else {
      console.log(JSON.stringify(result.result && result.result.result ? result.result.result.value : null, null, 2));
    }
  }

  if (shotPath) {
    await send('Page.enable');
    const isJpeg = shotPath.toLowerCase().endsWith('.jpg') || shotPath.toLowerCase().endsWith('.jpeg');
    const shot = await send('Page.captureScreenshot', {
      format: isJpeg ? 'jpeg' : 'png',
      quality: isJpeg ? 82 : undefined,
      captureBeyondViewport: false
    });
    if (shot.result && shot.result.data) {
      fs.writeFileSync(shotPath, Buffer.from(shot.result.data, 'base64'));
      console.log('shot saved', shotPath);
    } else {
      console.error('shot failed', JSON.stringify(shot));
    }
  }

  ws.close();
}

function no() { return false; }

main().catch((error) => { console.error(error); process.exit(1); });
