#!/usr/bin/env node
// Whole-page text legibility sweep — every visible label, every theme.
//
//   node tools/text-audit.js                            # detail sheet, all themes
//   node tools/text-audit.js --views=detail,settings,library,home
//   node tools/text-audit.js --themes=nova,summer --min=3.5
//   node tools/text-audit.js --shots --out=../_shots/text-audit
//
// Why this exists: the immersive audit only covers the home page, so a label
// that turns invisible inside a sheet (the "隐藏此游戏" hint) went unnoticed
// for two rounds. This walks every element that owns text, measures the
// rendered contrast by two-frame diff, and reports what falls under AA —
// with the selector path, so the fix lands in the right stylesheet.
//
// Thresholds follow WCAG: 4.5:1 for body text, 3.0:1 for type ≥ 18.66px
// (bold ≥ 14px). Anything unmeasurable is reported separately, never as a pass.

const fs = require('fs');
const path = require('path');
const { connect, wait } = require('./lib/cdp');
const { HELPERS } = require('./lib/ui-views');
const { startHost, readThemes } = require('./lib/headless-host');
const { PAGE_PROBE } = require('./lib/legibility');

const flags = {};
for (const arg of process.argv.slice(2)) {
  const match = arg.match(/^--([^=]+)(?:=(.*))?$/);
  if (match) flags[match[1]] = match[2] === undefined ? true : match[2];
}

const SIZE = String(flags.size || '1440x900').split('x').map(Number);
const WIDTH = SIZE[0] || 1440;
const HEIGHT = SIZE[1] || 900;
const MIN = Number(flags.min || 4.5);
const BIG_MIN = Number(flags.big || 3.0);
const OUT = flags.out ? path.resolve(String(flags.out)) : null;
const SHOTS = !!flags.shots || !!OUT;
const JSON_OUT = flags.json ? path.resolve(String(flags.json)) : null;
const LIMIT = Number(flags.limit || 0);       // cap targets per view (debug)
const QUIET = !!flags.quiet;

const VIEWS = flags.views && flags.views !== 'all'
  ? String(flags.views).split(',').map((v) => v.trim()).filter(Boolean)
  : ['detail', 'settings', 'library', 'home'];

// Narrow sweep: measure only these selectors (fast loop while fixing one bug).
const SELECTORS = flags.selectors
  ? String(flags.selectors).split(',').map((v) => v.trim()).filter(Boolean)
  : null;
const THEMES = flags.themes && flags.themes !== 'all'
  ? String(flags.themes).split(',').map((v) => v.trim()).filter(Boolean)
  : ['nova', ...readThemes().map((entry) => entry.id)];

/* Views that need a click or two before their text exists. */
const PREPARE = {
  detail: String.raw`
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      /* 管理 opens the panel; 收起 closes it. The switch that hides a game
         only exists once it is open, which is why two rounds of review never
         saw its label. */
      const open = document.querySelector('#detailManage');
      const panel = document.querySelector('#managePanel');
      if (panel && panel.hidden && open) open.click();
      await sleep(600);
      const body = document.querySelector('#manageBody');
      if (body && body.hidden) {
        const toggle = document.querySelector('#manageToggle');
        if (toggle) toggle.click();
      }
      await sleep(400);
      return 'ok';
    })()`,
  library: String.raw`
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const btn = document.querySelector('.nav-btn[data-nav="library"]');
      if (btn) btn.click();
      await sleep(700);
      return 'ok';
    })()`,
  settings: String.raw`
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const btn = document.querySelector('.nav-btn[data-nav="settings"]');
      if (btn) btn.click();
      await sleep(700);
      return 'ok';
    })()`,
  home: String.raw`'ok'`
};

/* ------------------------------------------------------------------ page side */

/** Collects every element that owns visible text; caches the list so the
 *  caller can toggle one element's ink by index without re-querying. */
const COLLECT = String.raw`
(() => {
  const SKIP = 'svg,script,style,noscript,template,#introOverlay,#toastRoot,.toast,#launchOverlay';
  const CACHE = [];

  const pathOf = (el) => {
    const parts = [];
    let node = el;
    while (node && node !== document.body && parts.length < 5) {
      let part = node.tagName.toLowerCase();
      if (node.id) { part += '#' + node.id; parts.unshift(part); break; }
      const cls = (node.className || '').toString().split(/\s+/).filter(Boolean).slice(0, 2);
      if (cls.length) part += '.' + cls.join('.');
      const parent = node.parentElement;
      if (parent) {
        const same = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
        if (same.length > 1) part += ':nth-of-type(' + (same.indexOf(node) + 1) + ')';
      }
      parts.unshift(part);
      node = parent;
    }
    return parts.join(' > ');
  };

  const alphaOf = (color) => {
    if (!color) return 1;
    const m = color.match(/rgba?\(([^)]+)\)/);
    if (m) {
      const parts = m[1].split(/[\s,/]+/).filter(Boolean);
      return parts.length > 3 ? parseFloat(parts[3]) : 1;
    }
    const c = color.match(/color\(srgb\s+[\d.]+\s+[\d.]+\s+[\d.]+(?:\s*\/\s*([\d.]+))?\)/);
    if (c) return c[1] === undefined ? 1 : parseFloat(c[1]);
    return 1;
  };

  window.__textCollect = function () {
    CACHE.length = 0;
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest(SKIP)) continue;
      if (el.hidden || el.getAttribute('aria-hidden') === 'true') continue;
      let hasText = false;
      for (const node of el.childNodes) {
        if (node.nodeType === 3 && node.textContent.trim().length) { hasText = true; break; }
      }
      if (!hasText) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (parseFloat(cs.opacity) < 0.12) continue;
      if (alphaOf(cs.color) < 0.12) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 6 || rect.height < 6) continue;
      if (rect.bottom <= 0 || rect.top >= innerHeight || rect.right <= 0 || rect.left >= innerWidth) continue;
      /* Anything behind an open sheet is painted under a scrim: its contrast
         collapses to 1:1 because the whole area is dimmed together, which is
         not a defect and not something a player reads. A hit test on the
         element's own centre tells us whether it is actually on top. */
      const hitX = Math.min(innerWidth - 1, Math.max(0, rect.left + Math.min(rect.width / 2, 60)));
      const hitY = Math.min(innerHeight - 1, Math.max(0, rect.top + rect.height / 2));
      const hit = document.elementFromPoint(hitX, hitY);
      if (hit && !el.contains(hit) && !hit.contains(el)) continue;
      const size = parseFloat(cs.fontSize);
      const weight = parseInt(cs.fontWeight, 10) || 400;
      CACHE.push(el);
      out.push({
        i: CACHE.length - 1,
        text: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 22),
        sel: pathOf(el),
        x: Math.round(rect.left), y: Math.round(rect.top),
        w: Math.round(rect.width), h: Math.round(rect.height),
        size, weight,
        big: size >= 18.66 || (size >= 14 && weight >= 700),
        color: cs.color,
        bg: cs.backgroundColor
      });
    }
    return JSON.stringify(out);
  };

  /* Sheets scroll, and a clipped rect reads as "the plate is everything".
     Bring the label into view first, then hand back its fresh box. */
  window.__textRect = async function (index) {
    const el = CACHE[index];
    if (!el) return null;
    try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (error) {}
    /* The scroll lands on the next frame; reading the box in the same task
       returns the pre-scroll position and the clip then captures whatever
       happened to sit there — which is how a perfectly readable button
       measured 1.94:1. */
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const rect = el.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) return null;
    /* Last guard: if something covers the label's centre, the pixels belong
       to that something, not to the label. */
    const hit = document.elementFromPoint(
      Math.min(innerWidth - 1, Math.max(0, rect.left + Math.min(rect.width / 2, 60))),
      Math.min(innerHeight - 1, Math.max(0, rect.top + rect.height / 2))
    );
    const covered = hit ? !(el.contains(hit) || hit.contains(el)) : false;
    /* captureScreenshot clips in PAGE coordinates, not viewport ones. On the
       immersive page scrollY is 0 so the two agreed; a scrolled detail sheet
       shifted every clip upward and measured the wrong band of pixels — the
       "完成" button looked unreadable while it renders at 12:1. */
    return JSON.stringify({
      x: Math.round(rect.left + window.scrollX),
      y: Math.round(rect.top + window.scrollY),
      w: Math.round(rect.width), h: Math.round(rect.height),
      covered
    });
  };

  /* Explicit selectors bypass the walker: same measurement, no scrolling
     through every label on the page. */
  window.__textSelect = function (list) {
    CACHE.length = 0;
    const out = [];
    list.forEach((sel, order) => {
      let el = null;
      try { el = document.querySelector(sel); } catch (error) {}
      if (!el) { out.push({ i: -1, sel, text: '(missing)' }); return; }
      const cs = getComputedStyle(el);
      const size = parseFloat(cs.fontSize);
      const weight = parseInt(cs.fontWeight, 10) || 400;
      CACHE.push(el);
      out.push({
        i: CACHE.length - 1, sel, order,
        text: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 24),
        size, weight,
        big: size >= 18.66 || (size >= 14 && weight >= 700),
        color: cs.color, bg: cs.backgroundColor
      });
    });
    return JSON.stringify(out);
  };

  /* Inline !important, not a class: a lot of these labels are painted by
     html[data-theme=x] #someId { color: ... !important }, which outranks
     the .is-im-inkless class on both specificity and origin order. Inline important
     beats any stylesheet important, so the second frame is genuinely empty —
     without this, #progressPct measured 1.01:1 while rendering at 14:1. */
  window.__textInkAt = function (index, hide) {
    const el = CACHE[index];
    if (!el) return 'missing';
    const nodes = [el].concat(Array.from(el.querySelectorAll('*')));
    if (hide) {
      el.__inkSaved = nodes.map((node) => ({
        node,
        color: node.style.getPropertyValue('color'),
        colorPri: node.style.getPropertyPriority('color'),
        fill: node.style.getPropertyValue('-webkit-text-fill-color'),
        fillPri: node.style.getPropertyPriority('-webkit-text-fill-color'),
        shadow: node.style.getPropertyValue('text-shadow'),
        shadowPri: node.style.getPropertyPriority('text-shadow'),
        opacity: node.style.getPropertyValue('opacity'),
        opacityPri: node.style.getPropertyPriority('opacity')
      }));
      nodes.forEach((node) => {
        node.style.setProperty('color', 'transparent', 'important');
        node.style.setProperty('-webkit-text-fill-color', 'transparent', 'important');
        node.style.setProperty('text-shadow', 'none', 'important');
        if (node !== el && node.tagName.toLowerCase() === 'svg') node.style.setProperty('opacity', '0', 'important');
      });
    } else if (el.__inkSaved) {
      el.__inkSaved.forEach((saved) => {
        const set = (prop, value, pri) => {
          if (value) saved.node.style.setProperty(prop, value, pri);
          else saved.node.style.removeProperty(prop);
        };
        set('color', saved.color, saved.colorPri);
        set('-webkit-text-fill-color', saved.fill, saved.fillPri);
        set('text-shadow', saved.shadow, saved.shadowPri);
        set('opacity', saved.opacity, saved.opacityPri);
      });
      el.__inkSaved = null;
    }
    return 'ok';
  };

  return 'ready';
})()
`;

/* -------------------------------------------------------------------- driver */

async function shoot(cdp, clip) {
  const shot = await cdp.send('Page.captureScreenshot', {
    format: 'png', clip, captureBeyondViewport: false, optimizeForSpeed: true
  });
  if (!shot || !shot.result || !shot.result.data) return null;
  return shot.result.data;
}

/* Page coordinates: only guard against a zero-size box, never against the
   viewport, because a scrolled sheet legitimately sits below the fold. */
const clamp = (t) => ({
  x: Math.max(0, t.x), y: Math.max(0, t.y),
  width: Math.max(4, t.w), height: Math.max(4, t.h),
  scale: 1
});

async function run() {
  const host = await startHost({ width: WIDTH, height: HEIGHT, scale: 1 });
  const cdp = await connect({ port: host.cdpPort });
  const report = { size: `${WIDTH}x${HEIGHT}`, views: VIEWS, themes: [] };
  let failures = 0;
  let unmeasured = 0;

  try {
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: host.mockScript });
    await cdp.send('Page.navigate', { url: `${host.origin}/src/index.html` });
    for (let i = 0; i < 100; i++) {
      if (await cdp.ev(`!!document.body.classList.contains('is-booted')`)) break;
      await wait(200);
    }
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false
    });
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
    });
    await cdp.ev(HELPERS, { hard: true });
    await cdp.ev(PAGE_PROBE, { hard: true });
    await cdp.ev(COLLECT, { hard: true });
    await cdp.ev(`(() => { try { NovaIntro && NovaIntro.skip && NovaIntro.skip(); } catch (e) {} return 'ok'; })()`);
    await wait(400);

    for (const theme of THEMES) {
      const themeEntry = { theme, views: [] };
      report.themes.push(themeEntry);

      for (const view of VIEWS) {
        await cdp.ev(`(async () => {
          try { await window.NovaTheme.activate(${JSON.stringify(theme)}, { silent: true, persist: false }); }
          catch (error) {}
          if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (error) {} }
          await new Promise((r) => setTimeout(r, 260));
          return document.documentElement.dataset.theme;
        })()`);
        await cdp.ev(`window.__novaExport.setup(${JSON.stringify(view === 'detail' ? 'detail' : view === 'home' ? 'home' : view)})`);
        await wait(360);
        if (PREPARE[view]) {
          await cdp.ev(PREPARE[view], { hard: false });
          await wait(200);
        }

        let targets = SELECTORS
          ? JSON.parse(await cdp.ev(`window.__textSelect(${JSON.stringify(SELECTORS)})`))
          : JSON.parse(await cdp.ev(`window.__textCollect()`));
        if (LIMIT) targets = targets.slice(0, LIMIT);

        const rows = [];
        for (const target of targets) {
          const fresh = await cdp.ev(`window.__textRect(${target.i})`);
          if (!fresh || fresh === 'null') continue;
          const box = JSON.parse(fresh);
          if (box.covered) continue;
          const clip = clamp({ x: box.x, y: box.y, w: box.w, h: box.h });
          await wait(40);
          const shown = await shoot(cdp, clip);
          if (flags.debug && OUT && shown) {
            fs.mkdirSync(OUT, { recursive: true });
            fs.writeFileSync(path.join(OUT, `clip-${theme}-${target.i}.png`), Buffer.from(shown, 'base64'));
          }
          await cdp.ev(`window.__textInkAt(${target.i}, true)`);
          await wait(50);
          const hidden = await shoot(cdp, clip);
          await cdp.ev(`window.__textInkAt(${target.i}, false)`);
          let measured = null;
          if (shown && hidden) {
            const raw = await cdp.ev(
              `(async () => JSON.stringify(await window.__imPixels(${JSON.stringify(shown)}, ${JSON.stringify(hidden)})))()`);
            if (raw && raw !== 'null') measured = JSON.parse(raw);
          }
          /* The luminance-range fallback is only trustworthy for display type:
             a headline covers enough of its box to read as a range. On a 9px
             chip it just reports the chip's own edge, so those stay
             "unmeasured" and get eyeballed instead of scored. */
          if ((!measured || measured.contrast === null) && shown && target.big) {
            const raw = await cdp.ev(
              `(async () => JSON.stringify(await window.__imRange(${JSON.stringify(shown)})))()`);
            if (raw && raw !== 'null') measured = JSON.parse(raw);
          }
          const min = target.big ? BIG_MIN : MIN;
          const contrast = measured && measured.contrast !== null ? measured.contrast : null;
          const pass = contrast === null ? null : contrast >= min;
          if (pass === false) failures += 1;
          if (pass === null) unmeasured += 1;
          rows.push({ ...target, contrast, pass, min, plate: measured && measured.plate });
        }

        const bad = rows.filter((r) => r.pass === false);
        const weak = rows.filter((r) => r.pass === null);
        themeEntry.views.push({ view, total: rows.length, bad: bad.length, weak: weak.length, rows });

        if (!QUIET) {
          const flag = bad.length ? `✗ ${String(bad.length).padStart(2)}` : '✓   ';
          console.log(`${flag} ${theme.padEnd(12)} ${view.padEnd(9)} ${rows.length} labels`
            + (bad.length ? ` · worst ${Math.min(...bad.map((r) => r.contrast)).toFixed(2)}:1` : ''));
          for (const row of bad) {
            console.log(`      ${String(row.contrast).padStart(5)}:1  ${row.size}px/${row.weight}  "${row.text}"  ${row.sel}`);
          }
          for (const row of weak) {
            if (row.contrast === null) console.log(`      unmeasured  "${row.text}"  ${row.sel}`);
          }
        }

        if (SHOTS && OUT) {
          fs.mkdirSync(OUT, { recursive: true });
          const full = await shoot(cdp, { x: 0, y: 0, width: WIDTH, height: HEIGHT, scale: 1 });
          if (full) fs.writeFileSync(path.join(OUT, `${theme}-${view}.png`), Buffer.from(full, 'base64'));
        }
      }
    }
  } finally {
    try { await host.close(); } catch (error) {}
  }

  if (JSON_OUT) {
    fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true });
    fs.writeFileSync(JSON_OUT, JSON.stringify(report, null, 2));
    console.log(`\nreport → ${JSON_OUT}`);
  }

  console.log(`\n${failures} failing labels, ${unmeasured} unmeasurable, across ${THEMES.length} themes × ${VIEWS.length} views`);
  process.exit(failures ? 1 : 0);
}

run().catch((error) => {
  console.error(error && error.message ? error.message : error);
  process.exit(2);
});
