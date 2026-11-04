#!/usr/bin/env node
// Shared hover/focus measurement contract.
//
// The real-host audit (audit-hover.js) and the headless audit
// (headless-hover.js) must measure the same things the same way, or one of
// them is lying. This module is the single source of:
//
//   VIEW_ROOTS   which overlay hosts each audited view
//   TARGETS      which interactive elements carry a label per view
//   buildHelpers the page-side __novaHover helper installed over CDP
//
// The helper string is a verbatim move out of audit-hover.js; the only edits
// are the picker / scanner / editor view cases and their targets, added after
// ENDFIELD shipped a picker whose file names rendered white-on-white because
// no audit ever looked at that view.

'use strict';

const VIEW_ROOTS = {
  home: '#homeView', settings: '#settingsView', detail: '#detailsOverlay',
  library: '#libraryOverlay', engine: '#engineOverlay', appearance: '#appearanceOverlay',
  import: '#importOverlay', picker: '#pickerOverlay', scanner: '#scannerOverlay',
  editor: '#editorOverlay'
};

// Interactive text hosts per view. Keep this close to what actually carries a
// label; a bare decorative node would add noise without covering a real state.
const TARGETS = {
  // '!' = document scope: the top bar sits outside every view root, and its
  // icon buttons are exactly where SUMMER's ink-on-ink hover hid from the
  // audit until now.
  home: ['!.topbar .icon-btn', '.cta-row .btn', '#homeScaleRow', '.lib-current'],
  settings: ['.pref-row', '.btn', '.settings-avatar-btn', '.section-tag', '!.topbar .icon-btn'],
  detail: ['.detail-actions .btn', '.detail-actions .icon-btn', '.modal-close', '.detail-sync', '.manage-row'],
  library: ['.lib-card', '.filter', '.lib-back', '.lib-sort .nova-select-hit', '.lib-fav'],
  import: ['.import-choice', '.engine-btn', '.engine-shell .icon-btn'],
  engine: ['.engine-mode-row', '.engine-btn', '.icon-btn', '.pref-row'],
  appearance: ['.theme-card', '.style-choice', '.appearance-edit', '.btn', '.theme-hint', '!.topbar .icon-btn'],
  // The in-app file browser: rows, drive chips, crumbs, footer actions.
  picker: ['.picker-row', '.drive-chip', '.crumb-btn', '.picker-confirm', '.picker-shell .icon-btn', '.picker-toggle'],
  // The import scan sheet and the manual-entry editor.
  scanner: ['.scan-row', '.engine-btn', '.scanner-shell .icon-btn'],
  editor: ['.editor-shell .btn', '.field-btn', '.editor-shell .icon-btn', '.pref-row']
};

/** Builds the page-side helper. One string, installed once per page. */
function buildHelpers() {
  return String.raw`
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

  // Close whatever a previous view left open, or the next view opens *under*
  // it: the import sheet stays open across a nav click, and a picker opened
  // underneath then reports zero rows because its listing never becomes the
  // interactive surface. Escape reaches launch / engine / import / details /
  // appearance through the app's key handler; the editor, scanner and picker
  // have their own close buttons.
  async function resetShell() {
    for (let i = 0; i < 4; i += 1) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await sleep(70);
    }
    ['#editorClose', '#scannerClose', '#pickerClose'].forEach((sel) => {
      const btn = $(sel);
      const overlay = btn && btn.closest('.overlay');
      if (btn && overlay && overlay.classList.contains('is-open')) btn.click();
    });
    await sleep(260);
  }

  window.__novaHover = {
    async setup(view) {
      document.documentElement.classList.add('reduce-motion');
      try { if (window.NovaDev && window.NovaDev.resetSurfaces) window.NovaDev.resetSurfaces(); } catch (e) {}
      $$('.nova-select-menu').forEach((m) => { m.hidden = true; });
      await resetShell();
      await sleep(180);
      switch (view) {
        case 'settings': click('.nav-btn[data-nav="settings"]'); await sleep(700); break;
        case 'library': click('.nav-btn[data-nav="library"]'); await sleep(650); break;
        case 'appearance': click('.nav-btn[data-nav="appearance"]'); await sleep(700); break;
        case 'detail': click('#detailBtn'); await sleep(750); break;
        case 'engine': click('#homeEngineBtn'); await sleep(850); break;
        case 'import': click('#addBtn'); await sleep(900); break;
        case 'picker':
          click('.nav-btn[data-nav="library"]'); await sleep(520);
          click('#libAdd'); await sleep(820);
          click('#fPickExe'); await sleep(1400);
          break;
        case 'scanner':
          click('#addBtn'); await sleep(720);
          click('#importGo'); await sleep(2800);
          break;
        case 'editor':
          click('.nav-btn[data-nav="library"]'); await sleep(520);
          click('#libAdd'); await sleep(820);
          break;
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
        // A leading '!' queries the whole document: the top bar lives outside
        // every view root, and its icon buttons were exactly where SUMMER's
        // ink-on-ink hover hid from every audit.
        const scope = sel.startsWith('!') ? document : root;
        $$(sel.replace(/^!/, ''), scope).forEach((el) => {
          if (seen.has(el) || !visible(el)) return;
          // Disabled controls are exempt from contrast requirements (WCAG
          // 1.4.3, inactive components) and several themes hide their hover
          // plate entirely when disabled — forcing a state on them measures
          // a dress nobody can see, not a failure. ENDFIELD's picker confirm
          // read 1.05:1 this way: plate display:none + opacity .52.
          if (el.disabled || el.getAttribute('aria-disabled') === 'true') return;
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
    rect(selector) {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    },
    finish() {
      document.documentElement.classList.remove('reduce-motion');
      return 'ok';
    }
  };
  return 'ready';
})()
`;
}

module.exports = { VIEW_ROOTS, TARGETS, buildHelpers };
