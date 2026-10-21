#!/usr/bin/env node
// One command, every screenshot, no WPF host.
//
//   node tools/headless-shots.js                          # all themes × all views
//   node tools/headless-shots.js --themes=nova,endfield   # a subset
//   node tools/headless-shots.js --views=home,import       # a subset of screens
//   node tools/headless-shots.js --sizes=1439x1124,960x600
//   node tools/headless-shots.js --workers=4 --open        # then open the folder
//
// Rendering happens in headless Chromium (Edge or Chrome) against a local
// static server, with the native bridge answered in-page by
// tools/lib/headless-host.js. Nothing touches the player's data directory and
// no WebView2 window is created.
//
// Output: <out>/<theme>/<view>@<WxH>.<ext> + manifest.json (same shape as
// tools/export-all.js so the layout audit keeps working).

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { connect, wait } = require('./lib/cdp');
const { HELPERS } = require('./lib/ui-views');
const { startHost, findBrowser, readThemes } = require('./lib/headless-host');

/* -------------------------------------------------------------------- args */

const flags = {};
for (const arg of process.argv.slice(2)) {
  const match = arg.match(/^--([^=]+)(?:=(.*))?$/);
  if (match) flags[match[1]] = match[2] === undefined ? true : match[2];
}

const ALL_VIEWS = [
  'home', 'home-row', 'home-stress', 'library', 'library-search', 'library-select',
  'appearance', 'appearance-framing', 'settings', 'detail', 'context', 'import',
  'scanner', 'editor', 'dialog', 'engine', 'notif', 'profile', 'launching', 'sleep'
];
const CORE_VIEWS = ['home', 'library', 'appearance', 'settings', 'detail', 'import', 'scanner'];

const VIEWS = flags.views && flags.views !== 'all'
  ? String(flags.views).split(',').map((value) => value.trim()).filter(Boolean)
  : (flags.views === 'all' || flags.all ? ALL_VIEWS : CORE_VIEWS);

const SIZES = String(flags.sizes || '1439x1124').split(',').map((entry) => {
  const [width, height] = entry.trim().split(/[x×]/).map(Number);
  return { width, height, label: `${width}x${height}` };
});

const OUT = path.resolve(flags.out || '../_shots/headless');
const FORMAT = String(flags.format || 'jpg').toLowerCase();
const QUALITY = Number(flags.quality || 88);
const SCALE = Number(flags.scale || 1);
const WORKERS = Math.max(1, Math.min(6, Number(flags.workers || 3)));
const THEME_FILTER = flags.themes && flags.themes !== 'all'
  ? String(flags.themes).split(',').map((value) => value.trim()).filter(Boolean)
  : null;
const OPEN = !!flags.open;
const JSON_ONLY = !!flags.json;
// The overlay backdrop is a 26px backdrop-filter. In software rendering that
// one property costs 6–15s per shot; the sheet itself is unaffected, so the
// blur is off unless asked for.
const BACKDROP_BLUR = !!flags.blur;

/* ----------------------------------------------------------------- helpers */

function fileFor(theme, view, size) {
  return path.join(OUT, theme, `${view}@${size.label}.${FORMAT === 'png' ? 'png' : 'jpg'}`);
}

/** A wedged renderer (blocked animation, dead compositor) must cost one shot,
 *  not the whole pass: every CDP step gets a deadline. */
function withTimeout(promise, ms, label) {
  let timer;
  const deadline = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

async function waitForApp(cdp, timeout = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const ready = await cdp.ev(
      `!!(window.NovaDev && window.NovaTheme && window.NovaTheme.themes && document.body.classList.contains('is-booted') || document.body.classList.contains('is-empty'))`,
      { hard: false }
    );
    if (ready) return true;
    await wait(200);
  }
  return false;
}

/** Boots one headless renderer and prepares it for capture. */
async function openRenderer(size) {
  const host = await startHost({ width: size.width, height: size.height, scale: SCALE });
  const cdp = await connect({ port: host.cdpPort });

  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: host.mockScript });
  await cdp.send('Page.navigate', { url: `${host.origin}/src/index.html` });

  const ready = await waitForApp(cdp);
  if (!ready) throw new Error('renderer never booted');

  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: size.width,
    height: size.height,
    deviceScaleFactor: SCALE,
    mobile: false
  });
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
  });

  if (!BACKDROP_BLUR) {
    // Replace the live blur with a slightly deeper dim: same contrast behind
    // the sheet, a fraction of the rasterisation cost.
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `(() => {
        const apply = () => {
          if (!document.head) return;
          const style = document.createElement('style');
          style.id = 'nova-headless-backdrop';
          style.textContent = '.overlay{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;background:rgba(4,5,9,.72)}';
          document.head.appendChild(style);
        };
        if (document.head) apply();
        else document.addEventListener('DOMContentLoaded', apply);
      })();`
    });
    // Also paint it into the document that is already running: a reload here
    // left the renderer without a fresh frame and every capture timed out.
    await cdp.ev(`(() => {
      if (document.getElementById('nova-headless-backdrop')) return 'ok';
      const style = document.createElement('style');
      style.id = 'nova-headless-backdrop';
      style.textContent = '.overlay{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;background:rgba(4,5,9,.72)}';
      document.head.appendChild(style);
      return 'ok';
    })()`);
    await wait(120);
  }

  const installed = await cdp.ev(HELPERS, { hard: true });
  if (installed !== 'ready') throw new Error('page helpers did not install');

  // The opening ritual owns the first input and the first frame; the shots are
  // all of the shell after it, so skip it once and never wait on it again.
  await cdp.ev(
    `(() => { try { window.NovaIntro && window.NovaIntro.skip && window.NovaIntro.skip(); } catch (error) {} return 'ok'; })()`
  );
  await wait(500);

  return { host, cdp };
}

async function runWorker(workerId, themes, size, totals) {
  const { host, cdp } = await openRenderer(size);
  const results = [];

  let failures = 0;

  try {
    for (const theme of themes) {
      const active = await cdp.ev(`(async () => {
        try { await window.NovaTheme.activate(${JSON.stringify(theme)}, { silent: true, persist: false }); }
        catch (error) { return 'error'; }
        if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (error) {} }
        await new Promise((resolve) => setTimeout(resolve, 320));
        return document.documentElement.dataset.theme;
      })()`);
      if (active !== theme) console.warn(`  ! ${theme}: theme did not activate (${active})`);

      for (const view of VIEWS) {
        const started = Date.now();
        try {
          const ok = await withTimeout(
            cdp.ev(`window.__novaExport.setup(${JSON.stringify(view)})`), 20000, `${theme}/${view} setup`);
          if (!ok) {
            console.warn(`  ! ${theme}/${view}: view setup failed`);
            continue;
          }
          await wait(360);

          const audit = await withTimeout(
            cdp.ev('JSON.stringify(window.__novaExport.audit())'), 15000, `${theme}/${view} audit`);
          const shot = await withTimeout(cdp.send('Page.captureScreenshot', {
            format: FORMAT === 'png' ? 'png' : 'jpeg',
            quality: FORMAT === 'png' ? undefined : QUALITY,
            captureBeyondViewport: false
          }), 20000, `${theme}/${view} capture`);
        if (!shot || !shot.result || !shot.result.data) {
          console.warn(`  ! ${theme}/${view}: capture failed`);
          continue;
        }

        const file = fileFor(theme, view, size);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, Buffer.from(shot.result.data, 'base64'));

        let parsed = null;
        try { parsed = JSON.parse(audit); } catch (error) { /* audit is best effort */ }
        results.push({
          theme, view, size: size.label,
          file: path.relative(OUT, file).replace(/\\/g, '/'),
          audit: parsed
        });

        totals.done += 1;
        const warn = [];
        if (parsed) {
          if (parsed.overflowX > 1) warn.push(`overflow ${parsed.overflowX}px`);
          if (parsed.issueCount) warn.push(`clipped ${parsed.issueCount}`);
        }
          if (!JSON_ONLY) {
            const ms = Date.now() - started;
            const line = `  [w${workerId}] ${theme.padEnd(11)} ${view.padEnd(18)} ${size.label}  ${warn.length ? '⚠ ' + warn.join(' · ') : 'ok'}  ${ms}ms`;
            process.stdout.write(`${line}\n`);
          }
          failures = 0;
        } catch (error) {
          failures += 1;
          console.warn(`  ! ${theme}/${view}: ${error.message}`);
          // Three dead steps in a row means the renderer is gone, not slow.
          // Bail out of this worker so the other shards can finish.
          if (failures >= 3) throw new Error(`renderer stopped responding (${error.message})`);
        }
      }
    }
  } finally {
    try { await cdp.ev('window.__novaExport.reset()'); } catch (error) { /* closing */ }
    await cdp.close();
    await host.close();
  }

  return results;
}

/* -------------------------------------------------------------------- main */

async function main() {
  if (!findBrowser()) {
    console.error('no Chromium found. Install Edge/Chrome or set NOVA_BROWSER=<path to msedge.exe>.');
    process.exit(2);
  }

  const available = readThemes().map((theme) => theme.id);
  const allThemes = ['nova'].concat(available.filter((id) => id !== 'nova'));
  const themes = THEME_FILTER ? THEME_FILTER.filter((id) => allThemes.includes(id)) : allThemes;
  const missing = THEME_FILTER ? THEME_FILTER.filter((id) => !allThemes.includes(id)) : [];
  if (missing.length) console.warn(`! unknown theme(s): ${missing.join(', ')}`);
  if (!themes.length) throw new Error('no themes to capture');

  const started = Date.now();
  const totals = { done: 0 };
  const entries = [];
  const batches = [];

  for (const size of SIZES) {
    const workers = Math.min(WORKERS, themes.length);
    const shards = Array.from({ length: workers }, () => []);
    themes.forEach((theme, index) => shards[index % workers].push(theme));

    if (!JSON_ONLY) {
      console.log(`\n${size.label} · ${themes.length} themes × ${VIEWS.length} views · ${workers} renderer(s)`);
    }

    const settled = await Promise.allSettled(
      shards.map((shard, index) => (shard.length ? runWorker(index + 1, shard, size, totals) : Promise.resolve([])))
    );
    settled.forEach((outcome) => {
      if (outcome.status === 'fulfilled') entries.push(...outcome.value);
      else console.error(`  ! worker failed: ${outcome.reason && outcome.reason.message}`);
    });
    batches.push({ size: size.label, workers });
  }

  fs.mkdirSync(OUT, { recursive: true });
  const manifest = {
    generatedAt: new Date().toISOString(),
    mode: 'headless',
    sizes: SIZES,
    views: VIEWS,
    batches,
    entries
  };
  const manifestPath = path.join(OUT, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  const problems = entries.flatMap((entry) => {
    const audit = entry.audit;
    if (!audit) return [];
    const rows = [];
    if (audit.overflowX > 1) rows.push({ ...entry, kind: 'overflow-x' });
    (audit.issues || []).forEach((issue) => rows.push({ ...entry, kind: 'clip', issue }));
    return rows;
  });

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (JSON_ONLY) {
    process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
  } else {
    console.log(`\n${entries.length} captures · ${themes.length} themes · ${VIEWS.length} views · ${SIZES.length} size(s) · ${seconds}s`);
    console.log(`output → ${OUT}`);
    console.log(`manifest → ${manifestPath}`);
    if (problems.length) {
      console.log(`\n⚠ ${problems.length} layout warning(s):`);
      problems.slice(0, 30).forEach((problem) => {
        if (problem.kind === 'overflow-x') {
          console.log(`  ${problem.theme}/${problem.view}@${problem.size}  horizontal overflow ${problem.audit.overflowX}px`);
        } else {
          const issue = problem.issue || {};
          console.log(`  ${problem.theme}/${problem.view}@${problem.size}  ${issue.selector} "${issue.text}" clipped ${issue.axis} by ${issue.overflow}px`);
        }
      });
      if (problems.length > 30) console.log(`  … ${problems.length - 30} more (see manifest.json)`);
    } else {
      console.log('\n✓ no clipping or overflow detected');
    }
    if (OPEN) {
      try {
        spawn('explorer.exe', [OUT], { detached: true, stdio: 'ignore' }).unref();
      } catch (error) { /* cosmetic */ }
    }
  }

  if (!entries.length) process.exit(1);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
