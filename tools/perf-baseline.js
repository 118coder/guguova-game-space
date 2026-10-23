#!/usr/bin/env node
// Launcher performance baseline.
//
//   NOVA_CDP_PORT=9333 node tools/perf-baseline.js
//   NOVA_CDP_PORT=9333 node tools/perf-baseline.js --json
//
// The launcher must be running with NOVA_CDP_PORT and a warm page (the intro
// dismissed). This measures what a user actually feels, not synthetic loops:
//
//   1. style+layout cost of a full document invalidation  (every repaint)
//   2. theme switch, cold and warm                        (every click)
//   3. the type-direction reroll                          (the heaviest UI action)
//   4. live animation and compositing load                (idle cost)
//   5. a page reload trace, bucketed by phase             (startup cost)
//
// It prints numbers and thresholds; it does not fail. The point is to make
// "feels slow" measurable so an optimisation can be proven or rejected.
const http = require('http');
const WebSocket = require('ws');

const PORT = Number(process.env.NOVA_CDP_PORT || 9223);
const JSON_ONLY = process.argv.includes('--json');

const get = (path) => new Promise((resolve, reject) => {
  http.get({ host: '127.0.0.1', port: PORT, path }, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => resolve(JSON.parse(data)));
  }).on('error', reject);
});

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const events = [];
  const send = (method, params = {}) => new Promise((resolve) => {
    const msgId = ++id;
    pending.set(msgId, resolve);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
    if (msg.method === 'Tracing.dataCollected') events.push(...msg.params.value);
    if (msg.method === 'Tracing.tracingComplete') ws.emit('traceDone');
  });
  return new Promise((resolve) => ws.on('open', () => resolve({ ws, send, events })));
}

const evaluate = async (send, expression) => {
  const response = await send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true, userGesture: true
  });
  const result = response.result;
  if (!result || result.exceptionDetails) {
    const detail = result && result.exceptionDetails && result.exceptionDetails.exception;
    throw new Error((detail && detail.description) || 'evaluate failed');
  }
  return result.result.value;
};

(async () => {
  const target = (await get('/json/list')).find((entry) => entry.type === 'page');
  if (!target) throw new Error('no page target — is the launcher running with NOVA_CDP_PORT?');
  const { ws, send, events } = await connect(target.webSocketDebuggerUrl);
  await send('Runtime.enable');

  const report = { port: PORT };

  /* 1. full-document style + layout (the recurring repaint cost) */
  report.repaint = JSON.parse(await evaluate(send, `(() => {
    const samples = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      document.body.style.setProperty('--perf-probe', String(i));
      void document.body.offsetHeight;
      samples.push(performance.now() - t0);
      document.body.style.removeProperty('--perf-probe');
      void document.body.offsetHeight;
    }
    const s = samples.sort((a, b) => a - b);
    return JSON.stringify({ median: +s[2].toFixed(2), max: +s[4].toFixed(2), nodes: document.querySelectorAll('*').length });
  })()`));

  /* 2. theme switch */
  report.themeSwitch = JSON.parse(await evaluate(send, `(async () => {
    const ids = window.NovaTheme.themes.map((t) => t.id).slice(0, 8);
    const timeOnce = async (id) => {
      const t0 = performance.now();
      await window.NovaTheme.activate(id, { persist: false });
      void document.body.offsetHeight;
      return performance.now() - t0;
    };
    const cold = [];
    for (const id of ids) cold.push(await timeOnce(id));
    const warm = [];
    for (const id of ids) warm.push(await timeOnce(id));
    const stat = (a) => { const s = [...a].sort((x, y) => x - y); return { median: +s[Math.floor(s.length / 2)].toFixed(1), max: +s[s.length - 1].toFixed(1) }; };
    return JSON.stringify({ cold: stat(cold), warm: stat(warm), themes: ids.length });
  })()`));

  /* 3. the heaviest interactive action */
  report.typeReroll = JSON.parse(await evaluate(send, `(() => {
    const btn = document.getElementById('typeShuffleBtn');
    if (!btn || btn.disabled) return JSON.stringify({ skipped: 'style mode is system or library empty' });
    const samples = [];
    for (let i = 0; i < 6; i++) {
      const t0 = performance.now();
      btn.click();
      void document.body.offsetHeight;
      samples.push(performance.now() - t0);
    }
    const s = samples.sort((a, b) => a - b);
    return JSON.stringify({ median: +s[3].toFixed(2), max: +s[5].toFixed(2) });
  })()`));

  /* 4. idle compositing load */
  report.idle = JSON.parse(await evaluate(send, `(() => {
    let willChange = 0, filtered = 0, animated = 0;
    document.querySelectorAll('*').forEach((el) => {
      const cs = getComputedStyle(el);
      if (cs.willChange && cs.willChange !== 'auto') willChange++;
      if (cs.filter && cs.filter !== 'none') filtered++;
      if (cs.animationName && cs.animationName !== 'none') animated++;
    });
    return JSON.stringify({ liveAnimations: document.getAnimations().length, willChange, filtered, animatedEls: animated });
  })()`));

  /* 5. reload trace, bucketed */
  const traceDone = new Promise((resolve) => ws.once('traceDone', resolve));
  await send('Tracing.start', {
    categories: 'devtools.timeline,disabled-by-default-devtools.timeline,blink.user_timing,v8,blink',
    options: 'sampling-frequency=10000'
  });
  await send('Page.reload', { ignoreCache: true });
  await new Promise((resolve) => setTimeout(resolve, 4200));
  await send('Tracing.end');
  await Promise.race([traceDone, new Promise((_, reject) => setTimeout(() => reject(new Error('trace timeout')), 15000))]);

  const phases = {};
  for (const event of events) {
    if (event.ph !== 'X' || !event.dur) continue;
    if (!/^(ParseHTML|ParseAuthorStyleSheet|EvaluateScript|CompileScript|Layout|UpdateLayoutTree|PrePaint|Paint|Commit|FunctionCall|TimerFire|FireAnimationFrame)$/.test(event.name)) continue;
    phases[event.name] = (phases[event.name] || 0) + event.dur / 1000;
  }
  report.startupPhases = Object.fromEntries(
    Object.entries(phases).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, +v.toFixed(1)])
  );
  report.startupTotal = +Object.values(phases).reduce((s, v) => s + v, 0).toFixed(1);

  ws.close();
  if (JSON_ONLY) { console.log(JSON.stringify(report, null, 2)); process.exit(0); }

  console.log('GUGUOVA performance baseline\n');
  console.log(`  nodes in document      ${report.repaint.nodes}`);
  console.log(`  full repaint (median)  ${report.repaint.median} ms   (max ${report.repaint.max} ms)`);
  console.log(`  theme switch cold      ${report.themeSwitch.cold.median} ms   (max ${report.themeSwitch.cold.max} ms, ${report.themeSwitch.themes} themes)`);
  console.log(`  theme switch warm      ${report.themeSwitch.warm.median} ms   (max ${report.themeSwitch.warm.max} ms)`);
  console.log(`  type reroll            ${report.typeReroll.skipped || `${report.typeReroll.median} ms   (max ${report.typeReroll.max} ms)`}`);
  console.log(`  idle animated elements ${report.idle.animatedEls}   live animations ${report.idle.liveAnimations}   will-change ${report.idle.willChange}   filter ${report.idle.filtered}`);
  console.log(`\n  startup, main thread total ${report.startupTotal} ms`);
  Object.entries(report.startupPhases).slice(0, 8).forEach(([name, ms]) => {
    console.log(`    ${name.padEnd(24)} ${String(ms).padStart(7)} ms`);
  });

  // Thresholds are the user-felt budgets this project targets, not WCAG.
  const budgets = [
    ['full repaint', report.repaint.median, 16.7, 'one frame at 60Hz'],
    ['theme switch warm', report.themeSwitch.warm.median, 100, 'below the 100ms "instant" threshold'],
    ['type reroll', report.typeReroll.median, 50, 'must feel immediate']
  ];
  console.log('\n  budgets');
  budgets.forEach(([label, value, budget, why]) => {
    if (value === undefined) return;
    console.log(`    ${value <= budget ? '✓' : '✗'} ${label.padEnd(20)} ${value} ms  / ${budget} ms  (${why})`);
  });
  process.exit(0);
})().catch((error) => { console.error('ERR', error.message); process.exit(1); });
