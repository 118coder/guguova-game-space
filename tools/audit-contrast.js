#!/usr/bin/env node
// GUGUOVA · headless text-contrast audit.
//
// Walks every installed theme and every launcher surface, measures each
// visible text run against its composited background, and reports anything
// below WCAG AA (4.5:1 normal, 3:1 large). Text over an image or gradient is
// flagged as `layered` so it can be checked by eye instead of trusted blindly.
//
//   node tools/audit-contrast.js
//   node tools/audit-contrast.js --themes=endfield,dusk --views=home,settings,engine
//   node tools/audit-contrast.js --json
//   node tools/audit-contrast.js --out=../_shots/contrast
//
// The launcher must be running with NOVA_CDP_PORT (default 9223).

const fs = require('fs');
const path = require('path');
const { connect, wait } = require('./lib/cdp');

function parseArgs(argv) {
  const flags = {};
  argv.forEach((arg) => {
    if (!arg.startsWith('--')) return;
    const [key, value] = arg.slice(2).split('=');
    flags[key] = value === undefined ? true : value;
  });
  return flags;
}

const flags = parseArgs(process.argv.slice(2));
const OUT = path.resolve(flags.out || '../_shots/contrast');
const JSON_ONLY = !!flags.json;
const THEME_FILTER = flags.themes && flags.themes !== 'all'
  ? String(flags.themes).split(',').map((s) => s.trim()).filter(Boolean)
  : null;

const ALL_VIEWS = [
  'home', 'library', 'library-select', 'appearance', 'appearance-framing', 'settings', 'detail',
  'engine', 'dialog', 'import', 'scanner', 'editor', 'context', 'notif', 'profile',
  'launching', 'sleep'
];
const VIEWS = flags.views && flags.views !== 'all'
  ? String(flags.views).split(',').map((s) => s.trim()).filter(Boolean)
  : ALL_VIEWS;

/* ------------------------------------------------------- page-side helper */

const HELPERS = String.raw`
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (sel) => { const el = typeof sel === 'string' ? $(sel) : sel; if (el) el.click(); return !!el; };

  async function reset() {
    try { if (window.NovaDev && window.NovaDev.resetSurfaces) window.NovaDev.resetSurfaces(); } catch (e) {}
    ['#engineOverlay', '#detailsOverlay', '#editorOverlay', '#scannerOverlay',
     '#dialogOverlay', '#pickerOverlay', '#launchOverlay', '#sleepOverlay'].forEach((sel) => {
      const el = $(sel);
      if (!el) return;
      el.classList.remove('is-open', 'is-ready', 'is-leaving', 'is-error', 'is-igniting');
      el.setAttribute('aria-hidden', 'true');
    });
    $$('.nova-select-menu').forEach((m) => { m.hidden = true; });
    const app = $('#app'); if (app) app.inert = false;
    click('.nav-btn[data-nav="home"]');
    await sleep(260);
  }

  async function setup(view) {
    // Freeze transitions so a measured text run is the settled state, not a
    // mid-fade frame. This is why the first run reported launch text at 1:1.
    document.documentElement.classList.add('reduce-motion');
    await reset();
    switch (view) {
      case 'home': break;
      case 'library':
        click('.nav-btn[data-nav="library"]'); await sleep(650); break;
      case 'library-select': {
        click('.nav-btn[data-nav="library"]'); await sleep(650);
        const wrap = $('.lib-sort .nova-select');
        const hit = wrap && wrap.querySelector('.nova-select-hit');
        const menu = wrap && wrap.querySelector('.nova-select-menu');
        if (hit && menu && menu.hidden) hit.click();
        await sleep(320);
        break;
      }
      case 'appearance':
        click('.nav-btn[data-nav="appearance"]'); await sleep(750); break;
      case 'appearance-framing':
        click('.nav-btn[data-nav="appearance"]'); await sleep(750);
        click('#appearanceEditBtn'); await sleep(450);
        break;
      case 'settings':
        click('.nav-btn[data-nav="settings"]'); await sleep(750); break;
      case 'detail':
        click('#detailBtn'); await sleep(750); break;
      case 'engine':
        click('#homeEngineBtn'); await sleep(900); break;
      case 'dialog':
        if (window.NovaOverlays && window.NovaOverlays.dialog) {
          window.NovaOverlays.dialog({
            title: '移除这款游戏？',
            text: '只会从启动器列表中移除，不会删除磁盘上的游戏文件。',
            confirmLabel: '移除', cancelLabel: '取消'
          });
        }
        await sleep(420); break;
      case 'import':
        click('#addBtn'); await sleep(900); break;
      case 'scanner':
        // The + button opens the import sheet first; the scanner is one step in.
        click('#addBtn'); await sleep(700);
        click('#importGo'); await sleep(2600); break;
      case 'editor':
        click('.nav-btn[data-nav="library"]'); await sleep(500);
        click('#libAdd'); await sleep(750); break;
      case 'context': {
        const card = $('.rail .tile, .rail > *');
        if (card) {
          const r = card.getBoundingClientRect();
          card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
        }
        await sleep(380); break;
      }
      case 'notif': click('#notifBtn'); await sleep(420); break;
      case 'profile': click('#profileBtn'); await sleep(420); break;
      case 'launching': {
        const el = $('#launchOverlay');
        if (el) { el.classList.add('is-open', 'is-ready'); el.setAttribute('aria-hidden', 'false'); }
        await sleep(1200); break;
      }
      case 'sleep': {
        const el = $('#sleepOverlay');
        if (window.NovaApp && window.NovaApp.sleep) window.NovaApp.sleep();
        else if (el) { el.classList.add('is-open'); el.setAttribute('aria-hidden', 'false'); }
        await sleep(600); break;
      }
      default: break;
    }
    await sleep(200);
    return view;
  }

  const ROOTS = {
    home: '#homeView', library: '#libraryOverlay', 'library-select': '#libraryOverlay',
    appearance: '#appearanceOverlay', 'appearance-framing': '#appearanceOverlay', settings: '#settingsView', detail: '#detailsOverlay',
    engine: '#engineOverlay', dialog: '#dialogOverlay', scanner: '#scannerOverlay',
    editor: '#editorOverlay', context: '#contextMenu', notif: '#notifPanel',
    profile: '#profileMenu', launching: '#launchOverlay', sleep: '#sleepOverlay'
  };

  const LIGHT_THEMES = new Set(['endfield', 'broadcast', 'summer', 'riso', 'riot', 'grimoire', 'dusk', 'mnemo']);

  function parseColor(value) {
    const m = String(value || '').match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (p.length < 3 || p.some((n) => !Number.isFinite(n))) return null;
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }

  function over(top, bottom) {
    return {
      r: top.r * top.a + bottom.r * (1 - top.a),
      g: top.g * top.a + bottom.g * (1 - top.a),
      b: top.b * top.a + bottom.b * (1 - top.a),
      a: 1
    };
  }

  function luminance(c) {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }

  function contrast(a, b) {
    const la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  function visible(el) {
    let node = el;
    let opacity = 1;
    while (node && node !== document.documentElement) {
      const s = getComputedStyle(node);
      if (s.display === 'none' || s.visibility === 'hidden') return null;
      opacity *= Number(s.opacity) || 1;
      node = node.parentElement;
    }
    if (opacity <= 0.02) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    if (r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) return null;
    return { opacity, rect: r };
  }

  // Composite every translucent ancestor background from the page root down.
  // Two painted-surface exceptions keep the report honest:
  //  - the active nav button sits on the shared .nav-glide sibling, not on
  //    the topbar (otherwise every dark-on-light nav reads as 1:1);
  //  - hero/detail preview plates paint their paper with pseudo elements,
  //    so their children are marked layered and checked by eye.
  const PAINTED = '.hero-inner, .detail-art, .appearance-preview, .editor-preview';
  function backgroundFor(el) {
    const chain = [];
    let node = el;
    let layered = false;
    const nav = el.closest('.nav-btn');
    if (nav && nav.classList.contains('is-active')) {
      const glide = document.querySelector('.nav-glide');
      const glideStyle = glide ? getComputedStyle(glide) : null;
      const glideUsable = glideStyle && glideStyle.display !== 'none' && glideStyle.visibility !== 'hidden' && glide.getBoundingClientRect().width > 2;
      const glideColor = glideUsable ? parseColor(glideStyle.backgroundColor) : null;
      if (glideColor && glideColor.a > .5) return { color: glideColor, layered: false };
    }
    const inPanel = !!el.closest('.appearance-framing');
    while (node && node !== document.documentElement) {
      const s = getComputedStyle(node);
      if (!inPanel) {
        if (s.backgroundImage && s.backgroundImage !== 'none') layered = true;
        if (node.matches && node.matches(PAINTED)) layered = true;
      }
      const c = parseColor(s.backgroundColor);
      if (c && c.a > 0.01) chain.push(c);
      node = node.parentElement;
    }
    const theme = document.documentElement.dataset.theme || 'nova';
    let base = LIGHT_THEMES.has(theme) ? { r: 255, g: 255, b: 255, a: 1 } : { r: 10, g: 11, b: 13, a: 1 };
    for (let i = chain.length - 1; i >= 0; i -= 1) base = over(chain[i], base);
    return { color: base, layered };
  }

  function isTextHost(el) {
    if (el.children.length && !el.classList.contains('logo')) return false;
    const text = (el.textContent || '').trim();
    return text.length > 0;
  }

  function selectorFor(el) {
    if (el.id) return '#' + el.id;
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
    return (el.tagName.toLowerCase() + (cls ? '.' + cls : ''));
  }

  window.__novaContrast = {
    setup,
    reset,
    // Audits freeze transitions; put the live UI back the way it was found.
    finish() {
      document.documentElement.classList.remove('reduce-motion');
      return 'ok';
    }
  };

  window.__novaContrastAudit = function (view) {
    const root = $(ROOTS[view] || '#homeView');
    const topbar = $('.topbar');
    const scope = [root, topbar].filter(Boolean);
    const seen = new Set();
    const rows = [];

    scope.forEach((host) => {
      Array.from(host.querySelectorAll('*')).forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        if (!isTextHost(el)) return;
        const vis = visible(el);
        if (!vis) return;
        const s = getComputedStyle(el);
        let fg = parseColor(s.color);
        if (!fg) return;
        const bg = backgroundFor(el);
        // Ancestor opacity dims the glyph, not the background.
        if (vis.opacity < 1) fg = { ...fg, a: fg.a * vis.opacity };
        fg = over(fg, bg.color);
        const size = parseFloat(s.fontSize) || 12;
        const weight = Number(s.fontWeight) || 400;
        const large = size >= 24 || (size >= 18.66 && weight >= 700);
        const need = large ? 3 : 4.5;
        const ratio = contrast(fg, bg.color);
        const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 42);
        rows.push({
          selector: selectorFor(el),
          text,
          size: Math.round(size * 10) / 10,
          weight,
          color: s.color,
          background: 'rgb(' + Math.round(bg.color.r) + ',' + Math.round(bg.color.g) + ',' + Math.round(bg.color.b) + ')',
          ratio: Math.round(ratio * 100) / 100,
          need,
          layered: bg.layered,
          fail: ratio < need - 0.01,
          tiny: size < 10
        });
      });
    });

    rows.sort((a, b) => (a.ratio / a.need) - (b.ratio / b.need));
    return {
      theme: document.documentElement.dataset.theme,
      view,
      count: rows.length,
      fails: rows.filter((r) => r.fail).length,
      layered: rows.filter((r) => r.layered).length,
      rows: rows.slice(0, 60)
    };
  };
  return 'ready';
})()
`;

async function main() {
  const cdp = await connect();
  const report = { generatedAt: new Date().toISOString(), views: VIEWS, themes: [] };
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  const ready = await cdp.ev(HELPERS, { hard: true });
  if (ready !== 'ready') throw new Error('helper did not install');

  const allThemes = await cdp.ev(`window.NovaTheme.themes.map((t) => t.id)`, { hard: true });
  const themes = THEME_FILTER ? THEME_FILTER.filter((id) => allThemes.includes(id)) : allThemes;
  const missing = THEME_FILTER ? THEME_FILTER.filter((id) => !allThemes.includes(id)) : [];
  if (missing.length) console.warn('! unknown theme(s): ' + missing.join(', '));

  for (const theme of themes) {
    await cdp.ev(`(async () => {
      await window.NovaTheme.activate(${JSON.stringify(theme)}, { silent: true, persist: false });
      if (window.NovaDev && window.NovaDev.state) window.NovaDev.state.theme = ${JSON.stringify(theme)};
      if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) {} }
      await new Promise((r) => setTimeout(r, 380));
      return document.documentElement.dataset.theme;
    })()`);
    await wait(320);

    const themeRow = { theme, views: [] };
    for (const view of VIEWS) {
      const ok = await cdp.ev(`window.__novaContrast.setup(${JSON.stringify(view)})`);
      if (!ok) { console.warn('! view failed: ' + theme + '/' + view); continue; }
      await wait(480);
      let parsed = null;
      try {
        parsed = JSON.parse(await cdp.ev(`JSON.stringify(window.__novaContrastAudit(${JSON.stringify(view)}))`));
      } catch (error) {
        console.warn('! audit failed: ' + theme + '/' + view + ' ' + error.message);
        continue;
      }
      themeRow.views.push(parsed);
      const hardFails = parsed.rows.filter((r) => r.fail && !r.layered);
      const layeredFails = parsed.rows.filter((r) => r.fail && r.layered);
      if (!JSON_ONLY) {
        const bits = [];
        if (hardFails.length) bits.push('FAIL ' + hardFails.length);
        if (layeredFails.length) bits.push('layered? ' + layeredFails.length);
        const worst = hardFails[0] || parsed.rows[0];
        const tail = worst ? `  worst ${worst.ratio}:1 ${worst.selector} "${worst.text}"` : '';
        console.log(`  ${theme.padEnd(11)} ${view.padEnd(15)} ${parsed.count} text runs  ${bits.length ? bits.join('  ') : 'ok'}${bits.length ? tail : ''}`);
      }
    }
    report.themes.push(themeRow);
  }

  await cdp.ev('window.__novaContrast.finish()');
  await cdp.ev('window.__novaContrast.reset()');
  await cdp.close();

  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, 'contrast.json');
  fs.writeFileSync(file, JSON.stringify(report, null, 2));

  const failures = [];
  report.themes.forEach((theme) => theme.views.forEach((view) => view.rows.forEach((row) => {
    if (row.fail && !row.layered) failures.push({ theme: theme.theme, view: view.view, ...row });
  })));

  if (JSON_ONLY) {
    process.stdout.write(JSON.stringify({ file, failures, report }, null, 2) + '\n');
  } else {
    console.log(`\nreport → ${file}`);
    if (failures.length) {
      console.log(`\n✗ ${failures.length} contrast failure(s) on solid backgrounds:`);
      const groups = new Map();
      failures.forEach((f) => {
        const key = `${f.theme}/${f.view}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(f);
      });
      Array.from(groups.entries()).slice(0, 40).forEach(([key, list]) => {
        console.log(`  ${key}  (${list.length})`);
        list.slice(0, 6).forEach((f) => {
          console.log(`    ${f.ratio}:1 needs ${f.need}  ${f.selector} "${f.text}"  ${f.color} on ${f.background}`);
        });
      });
      if (groups.size > 40) console.log(`  … ${groups.size - 40} more theme/view groups`);
    } else {
      console.log('\n✓ every measured text run meets AA on a solid background');
    }
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
