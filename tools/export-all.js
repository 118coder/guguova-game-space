#!/usr/bin/env node
// NOVA · headless capture interface.
//
// Boots nothing by itself: it attaches to a running launcher (started with
// NOVA_CDP_PORT) and exports every launcher surface for every theme in one
// pass — screens, modals, menus, overlays — plus a machine-readable manifest
// with layout warnings (text clipping, horizontal overflow, logo fit).
//
//   node tools/export-all.js                       # all themes, core views, 1439x1124
//   node tools/export-all.js --themes=riot,riso    # a subset
//   node tools/export-all.js --views=all           # every surface incl. dialogs
//   node tools/export-all.js --sizes=1439x1124,960x600
//   node tools/export-all.js --stress              # also capture a 30+ char game name
//   node tools/export-all.js --json                # manifest on stdout
//
// Output: <out>/<theme>/<view>@<WxH>.<ext> and <out>/manifest.json
//
// The launcher must be reachable on 127.0.0.1:$NOVA_CDP_PORT (default 9223).

const fs = require('fs');
const path = require('path');
const { connect, wait } = require('./lib/cdp');

/* ------------------------------------------------------------------ args */

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
const OUT = path.resolve(flags.out || '../_shots/export');
const FORMAT = (flags.format || 'jpg').toLowerCase();
const QUALITY = Number(flags.quality || 88);
const SCALE = Number(flags.scale || 1);
const SETTLE = Number(flags.settle || 0);
const STRESS_NAME = '沉默的法则：第七夜的回声与未尽之诗·终章特别加长版 Remastered Deluxe Edition';
const STRESS = !!flags.stress;
const TIER = flags.tier ? String(flags.tier) : '';
const JSON_ONLY = !!flags.json;
const THEME_FILTER = flags.themes && flags.themes !== 'all'
  ? String(flags.themes).split(',').map((s) => s.trim()).filter(Boolean)
  : null;
const SIZE_ARG = flags.sizes || '1439x1124';
const SIZES = String(SIZE_ARG).split(',').map((s) => {
  const [w, h] = s.trim().split(/[x×]/).map(Number);
  return { width: w, height: h, label: `${w}x${h}` };
});

const CORE_VIEWS = ['home', 'library', 'appearance', 'detail'];
const ALL_VIEWS = [
  'home', 'home-row', 'home-stress', 'library', 'library-search', 'library-select', 'appearance', 'appearance-framing', 'settings',
  'detail', 'context', 'import', 'scanner', 'editor', 'dialog', 'engine', 'notif', 'profile', 'launching', 'sleep'
];

const VIEWS = flags.views && flags.views !== 'all'
  ? String(flags.views).split(',').map((s) => s.trim()).filter(Boolean)
  : (flags.views === 'all' ? ALL_VIEWS : CORE_VIEWS);

// --parts: additionally crop each individual widget (nav button, dock tile,
// primary/secondary CTA, theme card, progress fill, toggle) out of the live
// page. The views below are the ones that actually lay those widgets out.
const PARTS = !!flags.parts;
const PART_VIEWS = String(flags['part-views'] || 'home,appearance,library')
  .split(',').map((s) => s.trim()).filter(Boolean);
const PART_SCALE = Number(flags['part-scale'] || 2);

/* ------------------------------------------------------- page-side helper */

// Injected once. Keeps all DOM knowledge in one place so the Node side only
// says "show me the library" instead of clicking its way around.
const { HELPERS } = require('./lib/ui-views');

/* ------------------------------------------------------------ main script */

function fileFor(theme, view, size) {
  const safe = size.label.replace('x', 'x');
  return path.join(OUT, theme, `${view}@${safe}.${FORMAT}`);
}

async function main() {
  const cdp = await connect();
  const started = Date.now();
  const manifest = { generatedAt: new Date().toISOString(), sizes: SIZES, views: VIEWS, entries: [] };

  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');

  const booted = await cdp.ev(HELPERS, { hard: true });
  if (booted !== 'ready') throw new Error('page helpers did not install');
  await cdp.ev(`window.__novaStressText = ${JSON.stringify(STRESS_NAME)}; 'ok'`);

  // Theme list comes from the live engine, so newly added themes are picked
  // up without touching this script.
  const allThemes = await cdp.ev(
    `(() => { try { return window.NovaTheme.themes.map((t) => t.id); } catch (e) { return ['nova']; } })()`,
    { hard: true }
  );
  const themes = THEME_FILTER ? THEME_FILTER.filter((id) => allThemes.includes(id)) : allThemes;
  const missing = THEME_FILTER ? THEME_FILTER.filter((id) => !allThemes.includes(id)) : [];
  if (missing.length) console.warn(`! unknown theme(s): ${missing.join(', ')}`);

  if (STRESS && !VIEWS.includes('home-stress')) VIEWS.push('home-stress');

  for (const size of SIZES) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: size.width,
      height: size.height,
      deviceScaleFactor: SCALE,
      mobile: false
    });
    await wait(320);

    for (const theme of themes) {
      await cdp.ev(`(async () => {
        await window.NovaTheme.activate(${JSON.stringify(theme)}, { silent: true, persist: false });
        ${TIER ? `document.documentElement.dataset.tier = ${JSON.stringify(TIER)};` : ''}
        if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) {} }
        await new Promise((r) => setTimeout(r, 420));
        return document.documentElement.dataset.theme;
      })()`);
      await wait(420);

      for (const view of VIEWS) {
        const ok = await cdp.ev(`window.__novaExport.setup(${JSON.stringify(view)})`);
        if (!ok) { console.warn(`! view failed: ${theme}/${view}`); continue; }
        await wait(520 + SETTLE);

        const audit = await cdp.ev('JSON.stringify(window.__novaExport.audit())');
        const shot = await cdp.send('Page.captureScreenshot', {
          format: FORMAT === 'png' ? 'png' : 'jpeg',
          quality: FORMAT === 'png' ? undefined : QUALITY,
          captureBeyondViewport: false
        });
        const file = fileFor(theme, view, size);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, Buffer.from(shot.result.data, 'base64'));

        let parsed = null;
        try { parsed = JSON.parse(audit); } catch (error) { /* audit is best effort */ }
        const entry = { theme, view, size: size.label, file: path.relative(OUT, file).replace(/\\/g, '/'), audit: parsed };
        manifest.entries.push(entry);

        const warn = [];
        const notes = [];
        if (parsed) {
          if (parsed.overflowX > 1) warn.push(`overflow-x=${parsed.overflowX}px`);
          if (parsed.issueCount) warn.push(`clipped=${parsed.issueCount}`);
          if (parsed.logo && parsed.logo.textOver > 1) warn.push(`logo-text-over=${parsed.logo.textOver}px`);
          if (parsed.logo && parsed.logo.decoOver > 1) notes.push(`deco-bleed=${parsed.logo.decoOver}px`);
        }
        if (!JSON_ONLY) {
          const tail = notes.length ? `  (${notes.join(' ')})` : '';
          console.log(`  ${theme.padEnd(10)} ${view.padEnd(16)} ${size.label}  ${warn.length ? '⚠ ' + warn.join(' ') : 'ok'}${tail}`);
        }
      }

      // Individual widget crops: same audit, but a tight viewport clip per part.
      if (PARTS) {
        for (const view of PART_VIEWS) {
          const ok = await cdp.ev(`window.__novaExport.setup(${JSON.stringify(view)})`);
          if (!ok) continue;
          await wait(520 + SETTLE);
          const list = JSON.parse(await cdp.ev('JSON.stringify(window.__novaExport.parts(8))') || '[]');
          const audit = await cdp.ev('JSON.stringify(window.__novaExport.audit())');
          for (const part of list) {
            const clip = { ...part.rect, scale: PART_SCALE };
            let shot;
            try {
              shot = await cdp.send('Page.captureScreenshot', {
                format: FORMAT === 'png' ? 'png' : 'jpeg',
                quality: FORMAT === 'png' ? undefined : QUALITY,
                captureBeyondViewport: false,
                clip
              });
            } catch (error) {
              console.warn(`! part shot failed: ${theme}/${part.name} (${error.message})`);
              continue;
            }
            const rel = `parts/${part.name}@${size.label}.${FORMAT === 'png' ? 'png' : 'jpg'}`;
            const file = path.join(OUT, theme, rel);
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
            let parsed = null;
            try { parsed = JSON.parse(audit); } catch (error) { /* best effort */ }
            manifest.entries.push({
              theme, view: `part:${part.name}`, part: part.name, selector: part.selector,
              label: part.label, clip, size: size.label, file: `${theme}/${rel}`, audit: parsed
            });
            if (!JSON_ONLY) console.log(`  ${theme.padEnd(10)} ${('part:' + part.name).padEnd(16)} ${size.label}  ok (${part.rect.width}x${part.rect.height} @${PART_SCALE}x)`);
          }
        }
      }
    }
  }

  await cdp.send('Emulation.clearDeviceMetricsOverride');
  await cdp.ev('window.__novaExport.reset()');
  await cdp.close();

  fs.mkdirSync(OUT, { recursive: true });
  const manifestPath = path.join(OUT, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  const problems = manifest.entries.flatMap((e) => {
    const a = e.audit;
    if (!a) return [];
    const rows = [];
    if (a.overflowX > 1) rows.push({ ...e, kind: 'overflow-x', detail: a.overflowX });
    (a.issues || []).forEach((i) => rows.push({ ...e, kind: 'clip', detail: i }));
    return rows;
  });

  if (JSON_ONLY) {
    process.stdout.write(JSON.stringify(manifest, null, 2) + '\n');
  } else {
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`\n${manifest.entries.length} captures · ${themes.length} themes · ${SIZES.length} size(s) · ${seconds}s`);
    console.log(`manifest → ${manifestPath}`);
    if (problems.length) {
      console.log(`\n⚠ ${problems.length} layout warning(s):`);
      problems.slice(0, 24).forEach((p) => {
        const detail = typeof p.detail === 'string' ? p.detail : (p.detail.selector ? `${p.detail.selector} "${p.detail.text}"` : JSON.stringify(p.detail));
        console.log(`  ${p.theme}/${p.view}@${p.size} ${p.kind}: ${detail}`);
      });
      if (problems.length > 24) console.log(`  … ${problems.length - 24} more (see manifest.json)`);
    } else {
      console.log('\n✓ no clipping or overflow detected');
    }
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
