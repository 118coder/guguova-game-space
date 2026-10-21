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

const VIEW_ROOTS = {
  home: '#homeView', settings: '#settingsView', detail: '#detailsOverlay',
  library: '#libraryOverlay', engine: '#engineOverlay', appearance: '#appearanceOverlay'
};

// Interactive text hosts per view. Keep this close to what actually carries a
// label; a bare decorative node would add noise without covering a real state.
const TARGETS = {
  home: ['.cta-row .btn', '#homeScaleRow', '.lib-current'],
  settings: ['.pref-row', '.btn', '.settings-avatar-btn', '.section-tag'],
  detail: ['.detail-actions .btn', '.detail-actions .icon-btn', '.modal-close', '.detail-sync', '.manage-row'],
  library: ['.lib-card', '.filter', '.lib-back', '.lib-sort .nova-select-hit'],
  engine: ['.engine-mode-row', '.engine-btn', '.icon-btn', '.pref-row'],
  appearance: ['.theme-card', '.style-choice', '.appearance-edit', '.btn']
};

const HELPERS = String.raw`
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (sel) => { const el = $(sel); if (el) el.click(); return !!el; };

  const parse = (c) => {
    const m = String(c || '').match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (p.length < 3 || p.some((n) => !Number.isFinite(n))) return null;
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const over = (t, b) => ({ r: t.r * t.a + b.r * (1 - t.a), g: t.g * t.a + b.g * (1 - t.a), b: t.b * t.a + b.b * (1 - t.a), a: 1 });
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

  const visible = (el) => {
    let n = el, o = 1;
    while (n && n !== document.documentElement) {
      const s = getComputedStyle(n);
      if (s.display === 'none' || s.visibility === 'hidden') return false;
      o *= Number(s.opacity) || 1;
      n = n.parentElement;
    }
    if (o <= 0.02) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 2 && r.height >= 2 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  };

  const PAINTED = '.hero-inner, .detail-art, .appearance-preview, .editor-preview';

  // Several themes paint the hover plate as a sweeping ::before (ZEROHOUR,
  // CODEX, ENDFIELD, MNEMO). It sits above the button's own background and
  // below its text, so the text's real backdrop is that plate. When the plate
  // has finished sweeping, report it as the background instead of the dark
  // rest colour underneath.
  const sweepPlate = (el) => {
    const s = getComputedStyle(el, '::before');
    if (!s || s.content === 'none' || s.display === 'none') return null;
    if (s.position !== 'absolute') return null;
    const c = parse(s.backgroundColor);
    if (!c || c.a < 0.9) return null;
    const t = s.transform;
    if (t && t !== 'none') {
      const nums = t.match(/matrix\(([^)]+)\)/);
      if (nums) {
        const parts = nums[1].split(',').map(Number);
        if (Math.abs(parts[4] || 0) > 2) return null;
      }
    }
    return c;
  };

  const bgOf = (el) => {
    const stack = [];
    let layered = false;
    let n = el;
    while (n && n.nodeType === 1) {
      const s = getComputedStyle(n);
      if (s.backgroundImage && s.backgroundImage !== 'none') layered = true;
      if (n.matches && n.matches(PAINTED)) layered = true;
      const c = parse(s.backgroundColor);
      if (c && c.a > 0) {
        const o = Number(s.opacity);
        stack.push({ ...c, a: c.a * (Number.isFinite(o) ? o : 1) });
        if (c.a >= 1) break;
      }
      n = n.parentElement;
    }
    const plate = sweepPlate(el);
    if (plate) return { color: over(plate, stack.length ? stack[stack.length - 1] : { r: 8, g: 9, b: 10, a: 1 }), layered: false };
    let out = { r: 8, g: 9, b: 10, a: 1 };
    for (let i = stack.length - 1; i >= 0; i -= 1) out = over(stack[i], out);
    return { color: out, layered };
  };

  const selectorFor = (el) => {
    if (el.id) return '#' + el.id;
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '');
  };
  const textOf = (el) => {
    const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join('');
    return (own || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  };

  window.__novaHover = {
    async setup(view) {
      document.documentElement.classList.add('reduce-motion');
      try { if (window.NovaDev && window.NovaDev.resetSurfaces) window.NovaDev.resetSurfaces(); } catch (e) {}
      $$('.nova-select-menu').forEach((m) => { m.hidden = true; });
      await sleep(220);
      switch (view) {
        case 'settings': click('.nav-btn[data-nav="settings"]'); await sleep(700); break;
        case 'library': click('.nav-btn[data-nav="library"]'); await sleep(650); break;
        case 'appearance': click('.nav-btn[data-nav="appearance"]'); await sleep(700); break;
        case 'detail': click('#detailBtn'); await sleep(750); break;
        case 'engine': click('#homeEngineBtn'); await sleep(850); break;
        default: click('.nav-btn[data-nav="home"]'); await sleep(420); break;
      }
      return view;
    },
    targets(view, selectors) {
      const roots = ${JSON.stringify(VIEW_ROOTS)};
      const root = $(roots[view] || '#homeView') || document.body;
      const seen = new Set();
      const out = [];
      selectors.forEach((sel) => {
        $$(sel, root).forEach((el) => {
          if (seen.has(el) || !visible(el)) return;
          // Buttons without text (icon-only) carry their state on the glyph.
          if (!textOf(el) && !el.querySelector('svg')) return;
          seen.add(el);
          out.push(selectorFor(el));
        });
      });
      return out;
    },
    measure(selector) {
      const el = document.querySelector(selector);
      if (!el) return null;
      const s = getComputedStyle(el);
      let fg = parse(s.color);
      if (!fg) return null;
      const bg = bgOf(el);
      fg = over(fg, bg.color);
      const size = parseFloat(s.fontSize) || 12;
      const weight = Number(s.fontWeight) || 400;
      const large = size >= 24 || (size >= 18.66 && weight >= 700);
      const need = large ? 3 : 4.5;
      const r = ratio(fg, bg.color);
      return {
        selector, text: textOf(el), size: Math.round(size * 10) / 10, weight,
        color: s.color,
        background: 'rgb(' + Math.round(bg.color.r) + ',' + Math.round(bg.color.g) + ',' + Math.round(bg.color.b) + ')',
        ratio: Math.round(r * 100) / 100,
        need,
        layered: bg.layered,
        fail: r < need - 0.01
      };
    },
    finish() {
      document.documentElement.classList.remove('reduce-motion');
      return 'ok';
    }
  };
  return 'ready';
})()
`;

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
