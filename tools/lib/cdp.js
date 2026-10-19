// Minimal Chrome DevTools Protocol client shared by the dev tools.
//
// The launcher is a WPF + WebView2 shell. When NOVA_CDP_PORT is set the
// WebView2 exposes a normal CDP endpoint, so any tool here can drive the
// live UI exactly like a browser: evaluate script, emulate a viewport and
// capture screenshots.
//
// Usage:
//   const { connect } = require('./lib/cdp');
//   const cdp = await connect();               // uses NOVA_CDP_PORT || 9223
//   await cdp.ev('document.title');
//   await cdp.close();

const http = require('http');
const WebSocket = require('ws');

const DEFAULT_PORT = 9223;

function listTargets(port) {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: '127.0.0.1', port, path: '/json/list' }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
      });
    });
    request.on('error', reject);
    request.setTimeout(5000, () => request.destroy(new Error('CDP list timed out')));
  });
}

/**
 * Connects to the first page target. Throws a readable error when the
 * launcher is not running with NOVA_CDP_PORT.
 */
async function connect(options = {}) {
  const port = Number(options.port || process.env.NOVA_CDP_PORT || DEFAULT_PORT);
  let targets;
  try {
    targets = await listTargets(port);
  } catch (error) {
    throw new Error(
      `no CDP endpoint on 127.0.0.1:${port} — start the launcher with ` +
      `NOVA_CDP_PORT=${port} ./bin/Debug/net10.0-windows/win-x64/NovaGameSpace.exe`
    );
  }
  const page = targets.find((t) => t.type === 'page');
  if (!page) throw new Error('CDP endpoint has no page target');

  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
  let nextId = 0;
  const pending = new Map();
  const failures = [];

  ws.on('message', (raw) => {
    let message;
    try { message = JSON.parse(raw); } catch (error) { return; }
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  });

  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });

  const send = (method, params = {}) => new Promise((resolve) => {
    const id = ++nextId;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });

  /**
   * Evaluates an expression in the page. Returns the value, or throws when
   * the expression did. A `hard` flag turns CDP-level errors into throws so
   * unsupported domains (Emulation on old WebView2 builds) are visible.
   */
  const ev = async (expression, { hard = false } = {}) => {
    const response = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true
    });
    const result = response.result;
    if (!result) {
      if (hard) throw new Error(`evaluate failed: ${JSON.stringify(response.error)}`);
      failures.push(response.error);
      return null;
    }
    if (result.exceptionDetails) {
      const detail = result.exceptionDetails.exception;
      const text = (detail && (detail.description || detail.value)) || JSON.stringify(result.exceptionDetails);
      if (hard) throw new Error(text);
      failures.push(text);
      return null;
    }
    return result.result ? result.result.value : null;
  };

  const close = () => new Promise((resolve) => {
    ws.once('close', resolve);
    ws.close();
  });

  return { send, ev, close, port, failures, target: page };
}

/** Sleeps for `ms` milliseconds. */
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = { connect, listTargets, wait, DEFAULT_PORT };
