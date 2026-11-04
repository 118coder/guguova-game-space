// Hover / focus contrast audit.
//
// The static audit (audit-contrast.js) measures the resting UI. The failures
// users actually see are often one state away: a theme paints a paper-white
// sweep plate under a lime label, or keeps ink text when the hover plate has
// already gone light. This tool drives the real pseudo-classes through CDP
// (CSS.forcePseudoState), reads the settled colours, and applies the same
// WCAG thresholds as the static audit.
//
//   node tools/audit-hover.js
//   node tools/audit-hover.js --themes=zerohour,codex --views=home,settings
//   node tools/audit-hover.js --json
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
// One measurement contract for both audits: the real host (this file) and the
// headless run (headless-hover.js) must agree, or one of them is lying.
const { TARGETS, buildHelpers } = require('./lib/hover-measure');

const PORT = process.env.NOVA_CDP_PORT || 9223;
const flags = {};
for (const arg of process.argv.slice(2)) {
  const m = arg.match(/^--([^=]+)(?:=(.*))?$/);
  if (m) flags[m[1]] = m[2] === undefined ? true : m[2];
}
const THEME_FILTER = flags.themes && flags.themes !== 'all'
  ? String(flags.themes).split(',').map((s) => s.trim()).filter(Boolean)
  : null;
const VIEWS = flags.views && flags.views !== 'all'
  ? String(flags.views).split(',').map((s) => s.trim()).filter(Boolean)
  : ['home', 'settings', 'detail'];
const JSON_ONLY = !!flags.json;
const OUT = flags.out || path.resolve(__dirname, '..', '..', '_shots', 'contrast-hover');

const HELPERS = buildHelpers();

function getTargets() {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: PORT, path: '/json/list' }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect() {
  const targets = await getTargets();
  const page = targets.find((t) => t.type === 'page');
  if (!page) throw new Error('no page target; start the launcher with NOVA_CDP_PORT first');
  const WebSocket = require('ws');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  const callbacks = new Map();
  let id = 0;
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw);
    if (msg.id && callbacks.has(msg.id)) { callbacks.get(msg.id)(msg); callbacks.delete(msg.id); }
  });
  await new Promise((resolve, reject) => { ws.on('open', resolve); ws.on('error', reject); });
  const send = (method, params = {}) => new Promise((resolve) => {
    const msgId = ++id;
    callbacks.set(msgId, resolve);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
  const ev = async (expression) => {
    const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (res.result && res.result.exceptionDetails) throw new Error(res.result.exceptionDetails.text);
    return res.result && res.result.result ? res.result.result.value : null;
  };
  return { ws, send, ev };
}

async function main() {
  const cdp = await connect();
  await cdp.send('Runtime.enable');
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  if (await cdp.ev(HELPERS) !== 'ready') throw new Error('helper did not install');

  const allThemes = await cdp.ev('window.NovaTheme.themes.map((t) => t.id)');
  const themes = THEME_FILTER ? THEME_FILTER.filter((id) => allThemes.includes(id)) : allThemes;
  const report = { generatedAt: new Date().toISOString(), views: VIEWS, themes: [] };

  for (const theme of themes) {
    await cdp.ev(`(async () => {
      await window.NovaTheme.activate(${JSON.stringify(theme)}, { silent: true, persist: false });
      if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) {} }
      await new Promise((r) => setTimeout(r, 380));
      return document.documentElement.dataset.theme;
    })()`);
    await wait(300);

    const themeRow = { theme, views: [] };
    for (const view of VIEWS) {
      await cdp.ev(`window.__novaHover.setup(${JSON.stringify(view)})`);
      await wait(420);
      const selectors = JSON.parse(await cdp.ev(
        `JSON.stringify(window.__novaHover.targets(${JSON.stringify(view)}, ${JSON.stringify(TARGETS[view] || ['.btn'])}))`));

      const rows = [];
      for (const selector of selectors) {
        for (const state of ['hover', 'focus']) {
          const doc = await cdp.send('DOM.getDocument', { depth: -1 });
          const q = await cdp.send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector });
          if (!q.result || !q.result.nodeId) continue;
          await cdp.send('CSS.forcePseudoState', { nodeId: q.result.nodeId, forcedPseudoClasses: [state] });
          await wait(90);
          const row = await cdp.ev(`window.__novaHover.measure(${JSON.stringify(selector)})`);
          await cdp.send('CSS.forcePseudoState', { nodeId: q.result.nodeId, forcedPseudoClasses: [] });
          if (row) rows.push({ state, ...row });
        }
      }

      themeRow.views.push({
        view,
        count: rows.length,
        fails: rows.filter((r) => r.fail).length,
        rows
      });

      if (!JSON_ONLY) {
        const hard = rows.filter((r) => r.fail && !r.layered);
        const worst = hard.slice().sort((a, b) => a.ratio - b.ratio)[0];
        const tail = worst ? `  worst ${worst.ratio}:1 ${worst.state} ${worst.selector} "${worst.text}"` : '';
        console.log(`  ${theme.padEnd(11)} ${view.padEnd(12)} ${String(rows.length).padStart(3)} states  ${hard.length ? 'FAIL ' + hard.length : 'ok'}${tail}`);
      }
    }
    report.themes.push(themeRow);
  }

  await cdp.ev('window.__novaHover.finish()');
  cdp.ws.close();

  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, 'hover.json');
  fs.writeFileSync(file, JSON.stringify(report, null, 2));

  const failures = [];
  report.themes.forEach((theme) => theme.views.forEach((view) => view.rows.forEach((row) => {
    if (row.fail && !row.layered) failures.push({ theme: theme.theme, view: view.view, ...row });
  })));

  if (failures.length) {
    console.log(`\n✗ ${failures.length} hover/focus contrast failure(s):`);
    failures.slice(0, 40).forEach((f) => {
      console.log(`  ${f.theme}/${f.view} ${f.state}  ${f.ratio}:1 needs ${f.need}  ${f.selector} "${f.text}"  ${f.color} on ${f.background}`);
    });
    process.exitCode = 1;
  } else {
    console.log('\n✓ every measured hover/focus run meets AA on a solid background');
  }
  if (!JSON_ONLY) console.log('report → ' + file);
}

main().catch((error) => { console.error(error); process.exit(1); });
