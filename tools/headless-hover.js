#!/usr/bin/env node
// Headless hover / focus audit + interaction-state image export.
//
//   node tools/headless-hover.js                        # 14 themes × 10 views
//   node tools/headless-hover.js --themes=endfield,dusk --views=picker,home
//   node tools/headless-hover.js --workers=4 --no-shots # audit only, fastest
//   node tools/headless-hover.js --shots=all            # every element clip
//
// Why this exists: the real-host audit (audit-hover.js) needs the launcher
// running, and eyeballing a hover state meant driving the real UI one element
// at a time. The headless host already answers the native bridge, so the same
// measurement contract (tools/lib/hover-measure.js) runs in a headless
// renderer against the mock — no WPF, no WebView2 session, no clicking.
//
// Speed comes from batching. The real audit forces one pseudo-class, waits,
// measures, clears, per element: selectors × 2 CDP round-trip chains per view.
// Here every target of a view is forced at once, and one page-side evaluate
// measures all of them, so a view costs a fixed two round trips regardless of
// how many interactive elements it has. Per-element semantics are preserved:
// forcing every match of a selector means the first-match query that measure()
// uses always lands on a forced node.
//
// Images, per theme × view:
//   <theme>/<view>@rest.png    nothing forced — the reference frame
//   <theme>/<view>@hover.png   every target forced :hover
//   <theme>/<view>@focus.png   every target forced :focus
//   <theme>/<view>/<element>@<state>.png   clips of failing elements
//                                          (or everything, with --shots=all)
//
// Output mirrors the real audit's hover.json so the verdict and the report
// schema stay interchangeable.

'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { connect, wait } = require('./lib/cdp');
const { startHost, findBrowser } = require('./lib/headless-host');
const { TARGETS, buildHelpers } = require('./lib/hover-measure');

const HELPERS = buildHelpers();

/* -------------------------------------------------------------------- args */

const flags = {};
for (const arg of process.argv.slice(2)) {
  const match = arg.match(/^--([^=]+)(?:=(.*))?$/);
  if (match) flags[match[1]] = match[2] === undefined ? true : match[2];
}

const ALL_VIEWS = ['home', 'library', 'appearance', 'settings', 'detail', 'import', 'scanner', 'editor', 'engine', 'picker'];
const CORE_VIEWS = ['home', 'settings', 'detail', 'import', 'picker'];

const VIEWS = flags.views && flags.views !== 'all'
  ? String(flags.views).split(',').map((v) => v.trim()).filter(Boolean)
  : (flags.views === 'all' ? ALL_VIEWS : CORE_VIEWS);

const SIZES = String(flags.sizes || '1439x1124').split(',').map((entry) => {
  const [width, height] = entry.trim().split(/[x×]/).map(Number);
  return { width, height, label: `${width}x${height}` };
});

const OUT = path.resolve(flags.out || '../_shots/hover-headless');
const WORKERS = Math.max(1, Math.min(6, Number(flags.workers || 3)));
const THEME_FILTER = flags.themes && flags.themes !== 'all'
  ? String(flags.themes).split(',').map((v) => v.trim()).filter(Boolean)
  : null;
const SHOTS = flags['no-shots'] ? 'none' : (flags.shots === 'all' ? 'all' : 'fails');
const JSON_ONLY = !!flags.json;
const OPEN = !!flags.open;

/* ----------------------------------------------------------------- helpers */

function withTimeout(promise, ms, label) {
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

const safeName = (selector) => String(selector)
  .replace(/^#/, 'id-')
  .replace(/[^a-zA-Z0-9_-]+/g, '-');

async function waitForApp(cdp, timeout = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const ready = await cdp.ev(
      `!!(window.NovaDev && window.NovaTheme && window.NovaTheme.themes && (document.body.classList.contains('is-booted') || document.body.classList.contains('is-empty')))`,
      { hard: false }
    );
    if (ready) return true;
    await wait(200);
  }
  return false;
}

/** Boots one headless renderer prepared for hover work. */
async function openRenderer(size) {
  const host = await startHost({ width: size.width, height: size.height, scale: 1 });
  const cdp = await connect({ port: host.cdpPort });

  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: host.mockScript });
  await cdp.send('Page.navigate', { url: `${host.origin}/src/index.html` });

  const ready = await waitForApp(cdp);
  if (!ready) throw new Error('renderer never booted');

  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: size.width, height: size.height, deviceScaleFactor: 1, mobile: false
  });
  // Software raster makes a full-viewport backdrop-filter cost seconds per
  // frame; the audit only needs the sheet, so swap the live blur for a flat
  // dim exactly like headless-shots does.
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(() => {
      const apply = () => {
        if (!document.head) return;
        const style = document.createElement('style');
        style.id = 'nova-hover-backdrop';
        style.textContent = '.overlay{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;background:rgba(4,5,9,.72)}';
        document.head.appendChild(style);
      };
      if (document.head) apply(); else document.addEventListener('DOMContentLoaded', apply);
    })();`
  });
  await cdp.ev(`(() => {
    if (document.getElementById('nova-hover-backdrop')) return 'ok';
    const style = document.createElement('style');
    style.id = 'nova-hover-backdrop';
    style.textContent = '.overlay{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;background:rgba(4,5,9,.72)}';
    document.head.appendChild(style);
    return 'ok';
  })()`, { hard: true });

  const installed = await cdp.ev(HELPERS, { hard: true });
  if (installed !== 'ready') throw new Error('hover helpers did not install');

  await cdp.ev(`(() => { try { window.NovaIntro && window.NovaIntro.skip && window.NovaIntro.skip(); } catch (e) {} return 'ok'; })()`);
  await wait(420);
  return { host, cdp };
}

/* ------------------------------------------------------------ measurement */

/**
 * Force a pseudo-class on every node matching the view's target selectors.
 * Forcing all matches (not just the first) is what lets the batched
 * measure() — a first-match query per selector — always land on a forced
 * node, and it is what makes the state screenshots show every interactive
 * element in its hover/focus dress at once.
 */
async function forceAll(cdp, selectors, state) {
  const doc = await cdp.send('DOM.getDocument', { depth: -1 });
  const rootId = doc.result.root.nodeId;
  const forced = [];
  for (const selector of selectors) {
    try {
      const q = await cdp.send('DOM.querySelectorAll', { nodeId: rootId, selector });
      for (const nodeId of (q.result.nodeIds || [])) {
        try {
          await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [state] });
          forced.push(nodeId);
        } catch (error) { /* detached mid-pass; the next resolve re-picks it */ }
      }
    } catch (error) { /* unknown selector for this view */ }
  }
  return forced;
}

async function clearAll(cdp, nodeIds) {
  for (const nodeId of nodeIds) {
    try { await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] }); } catch (error) {}
  }
}

async function capture(cdp, label) {
  const shot = await cdp.send('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: false
  });
  if (!shot || !shot.result || !shot.result.data) throw new Error(`${label}: capture failed`);
  return Buffer.from(shot.result.data, 'base64');
}

async function captureClip(cdp, rect, label) {
  const pad = 8;
  const x = Math.max(0, Math.floor(rect.x - pad));
  const y = Math.max(0, Math.floor(rect.y - pad));
  const width = Math.min(20000, Math.ceil(rect.width + pad * 2));
  const height = Math.min(20000, Math.ceil(rect.height + pad * 2));
  const shot = await cdp.send('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: false,
    clip: { x, y, width, height, scale: 1 }
  });
  if (!shot || !shot.result || !shot.result.data) throw new Error(`${label}: clip capture failed`);
  return Buffer.from(shot.result.data, 'base64');
}

async function runWorker(workerId, themes, size, totals) {
  const { host, cdp } = await openRenderer(size);
  const results = [];
  let failures = 0;

  const save = (rel, buffer) => {
    const file = path.join(OUT, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, buffer);
    return path.relative(OUT, file).replace(/\\/g, '/');
  };

  try {
    for (const theme of themes) {
      const active = await cdp.ev(`(async () => {
        try { await window.NovaTheme.activate(${JSON.stringify(theme)}, { silent: true, persist: false }); }
        catch (error) { return 'error'; }
        if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) {} }
        await new Promise((r) => setTimeout(r, 300));
        return document.documentElement.dataset.theme;
      })()`);
      if (active !== theme) console.warn(`  ! ${theme}: did not activate (${active})`);

      const themeRow = { theme, views: [] };

      for (const view of VIEWS) {
        const started = Date.now();
        try {
          const setup = await withTimeout(
            cdp.ev(`window.__novaHover.setup(${JSON.stringify(view)})`), 25000, `${theme}/${view} setup`);
          if (setup !== view) throw new Error('setup failed');
          await wait(320);

          const selectors = JSON.parse(await withTimeout(cdp.ev(
            `JSON.stringify(window.__novaHover.targets(${JSON.stringify(view)}, ${JSON.stringify(TARGETS[view] || ['.btn'])}))`
          ), 15000, `${theme}/${view} targets`));

          const rows = [];
          const shots = [];

          // Reference frame: nothing forced.
          if (SHOTS !== 'none') {
            shots.push({ state: 'rest', file: save(path.join(theme, `${view}@rest.png`), await capture(cdp, `${theme}/${view}/rest`)) });
          }

          for (const state of ['hover', 'focus']) {
            const forced = await forceAll(cdp, selectors, state);
            await wait(180); // let the (reduced) transitions settle into the frame
            if (SHOTS !== 'none') {
              shots.push({ state, file: save(path.join(theme, `${view}@${state}.png`), await capture(cdp, `${theme}/${view}/${state}`)) });
            }
            // One evaluate for the whole view: selectors × states of CDP
            // round-trips collapse into two.
            const measured = JSON.parse(await cdp.ev(
              `JSON.stringify(${JSON.stringify(selectors)}.map((s) => { const r = window.__novaHover.measure(s); return r && { state: ${JSON.stringify(state)}, ...r }; }).filter(Boolean))`
            ));
            rows.push(...measured);
            await clearAll(cdp, forced);
          }

          // Forensics: clip the elements that actually failed so the report
          // points at pixels, not just at a ratio.
          const hard = rows.filter((r) => r.fail && !r.layered);
          if (SHOTS !== 'none' && (SHOTS === 'all' ? rows : hard).length) {
            for (const row of (SHOTS === 'all' ? rows : hard)) {
              // Re-force just this element's state: the earlier clear reset it,
              // and a clip of the wrong dress would be worse than no clip.
              const forced = await forceAll(cdp, [row.selector], row.state);
              await wait(140);
              const rect = await cdp.ev(`JSON.stringify(window.__novaHover.rect(${JSON.stringify(row.selector)}))`);
              if (rect && rect !== 'null') {
                const name = `${safeName(row.selector)}@${row.state}`;
                shots.push({
                  state: row.state, element: row.selector,
                  file: save(path.join(theme, view, `${name}.png`), await captureClip(cdp, JSON.parse(rect), name))
                });
              }
              await clearAll(cdp, forced);
            }
          }

          themeRow.views.push({ view, count: rows.length, fails: rows.filter((r) => r.fail).length, rows });
          results.push({ theme, view, shots, rows });

          totals.done += 1;
          if (!JSON_ONLY) {
            const ms = Date.now() - started;
            const worst = hard.slice().sort((a, b) => a.ratio - b.ratio)[0];
            const tail = worst ? `  worst ${worst.ratio}:1 ${worst.state} ${worst.selector} "${worst.text}"` : '';
            process.stdout.write(`  [w${workerId}] ${theme.padEnd(11)} ${view.padEnd(11)} ${String(rows.length).padStart(3)} states  ${hard.length ? 'FAIL ' + hard.length : 'ok'}${tail}  ${ms}ms\n`);
          }
          failures = 0;
        } catch (error) {
          failures += 1;
          console.warn(`  ! ${theme}/${view}: ${error.message}`);
          if (failures >= 3) throw new Error(`renderer stopped responding (${error.message})`);
        }
      }
      totals.themes.push(themeRow);
    }
  } finally {
    try { await cdp.ev('window.__novaHover.finish()'); } catch (error) { /* closing */ }
    await cdp.close();
    await host.close();
  }

  return results;
}

/* -------------------------------------------------------------------- main */

async function main() {
  if (!findBrowser()) {
    console.error('✗ no Edge/Chrome found for headless rendering (set NOVA_BROWSER?)');
    process.exit(1);
  }

  // Shard themes across workers the way headless-shots does: contiguous
  // blocks, not round-robin, so each renderer pays each theme's switch cost
  // once and the report stays grouped.
  const themes = THEME_FILTER || ['nova', 'endfield', 'zerohour', 'codex', 'aurum', 'broadcast',
    'summer', 'riso', 'riot', 'grimoire', 'mnemo', 'dusk', 'steam', 'nightflight'];

  const started = Date.now();
  const totals = { done: 0, themes: [] };
  const shards = Array.from({ length: WORKERS }, () => []);
  themes.forEach((theme, index) => shards[index % WORKERS].push(theme));

  if (!JSON_ONLY) {
    console.log(`hover audit (headless) · ${themes.length} themes × ${VIEWS.length} views · ${SHOTS === 'none' ? 'no images' : SHOTS + ' shots'} · ${WORKERS} worker(s)`);
  }

  const settled = await Promise.allSettled(
    shards.filter((shard) => shard.length).map((shard, index) => runWorker(index + 1, shard, SIZES[0], totals))
  );

  const failedWorkers = settled.filter((s) => s.status === 'rejected');
  failedWorkers.forEach((s) => console.warn(`  ! worker failed: ${s.reason && s.reason.message}`));

  fs.mkdirSync(OUT, { recursive: true });

  // The audit report: same schema as the real-host tool, so release gates and
  // diffing keep working unchanged.
  const report = {
    generatedAt: new Date().toISOString(),
    headless: true,
    views: VIEWS,
    themes: totals.themes
  };
  fs.writeFileSync(path.join(OUT, 'hover.json'), JSON.stringify(report, null, 2));

  const manifest = {
    generatedAt: report.generatedAt,
    mode: SHOTS,
    views: VIEWS,
    captures: results_of(settled)
  };
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));

  const failures = [];
  totals.themes.forEach((theme) => theme.views.forEach((view) => view.rows.forEach((row) => {
    if (row.fail && !row.layered) failures.push({ theme: theme.theme, view: view.view, ...row });
  })));

  const elapsed = Math.round((Date.now() - started) / 100) / 10;
  if (!JSON_ONLY) {
    console.log(`\n${totals.done} view passes · ${elapsed}s · output → ${OUT}`);
  }

  if (failures.length) {
    console.log(`\n✗ ${failures.length} hover/focus contrast failure(s):`);
    failures.slice(0, 40).forEach((f) => {
      console.log(`  ${f.theme}/${f.view} ${f.state}  ${f.ratio}:1 needs ${f.need}  ${f.selector} "${f.text}"  ${f.color} on ${f.background}`);
    });
    process.exitCode = 1;
  } else {
    console.log('\n✓ every measured hover/focus run meets AA on a solid background');
  }
  if (!JSON_ONLY) console.log('report → ' + path.join(OUT, 'hover.json'));
  if (OPEN && process.platform === 'win32') spawn('explorer', [OUT], { detached: true }).unref();
}

/** Flatten the per-worker results into one manifest capture list. */
function results_of(settled) {
  const out = [];
  settled.forEach((s) => {
    if (s.status !== 'fulfilled') return;
    s.value.forEach((entry) => out.push({ theme: entry.theme, view: entry.view, shots: entry.shots }));
  });
  return out;
}

main().catch((error) => { console.error('ERR', error.message); process.exit(1); });
