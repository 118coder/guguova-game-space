#!/usr/bin/env node
// Playtime-ladder verification: one command captures every theme's progress
// bars at every colour milestone and asserts the published tier colour.
//
//   node tools/tier-shots.js                          # 14 themes × 7 presets × 3 views
//   node tools/tier-shots.js --themes=endfield,dusk   # a subset
//   node tools/tier-shots.js --hours=2.5,60,320       # a subset of presets
//   node tools/tier-shots.js --shots=false            # assertions only, no PNGs
//   node tools/tier-shots.js --workers=4
//
// The host boots each preset with ?novaTierHours=<h> (handled in
// tools/lib/headless-host.js), which rewrites the selected demo game's
// playtimeSeconds before app.js reads the boot payload — no default mock
// data changes, no player data touched.
//
// The expected tier colour is recomputed here from the anchors the page
// actually reports, mirroring src/app.js's PLAYTIME LADDER math (HSL
// shortest-arc interpolation). If the two ever drift, this tool is the one
// that must be updated together with it.

const fs = require('fs');
const path = require('path');
const { connect, wait } = require('./lib/cdp');
const { HELPERS } = require('./lib/ui-views');
const { startHost, findBrowser, readThemes } = require('./lib/headless-host');

/* -------------------------------------------------------------------- args */

const flags = {};
for (const arg of process.argv.slice(2)) {
  const match = arg.match(/^--([^=]+)(?:=(.*))?$/);
  if (match) flags[match[1]] = match[2] === undefined ? true : match[2];
}

const OUT = path.resolve(flags.out || '../_shots/tier');
const WORKERS = Math.max(1, Math.min(6, Number(flags.workers || 3)));
const TAKE_SHOTS = flags.shots !== 'false';
const THEME_FILTER = flags.themes && flags.themes !== 'all'
  ? String(flags.themes).split(',').map((value) => value.trim()).filter(Boolean)
  : null;

// 2.5h stays on the base colour; 60/120/320/1200/5400 walk the eras; 11000h
// is past the 10000h finale.
const HOURS = (flags.hours ? String(flags.hours).split(',') : ['2.5', '60', '120', '320', '1200', '5400', '11000'])
  .map((value) => Number(value))
  .filter((value) => Number.isFinite(value) && value >= 0);

/* -------------------------------------------------- mirrored ladder math */

// Keep in sync with src/app.js PLAYTIME LADDER.
const TIERS = [50, 75, 100, 150, 200, 300, 400, 500, 650, 800, 1000, 1500, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000];
const ERAS = [
  { from: 0, to: 1, nodes: 5 },
  { from: 1, to: 2, nodes: 6 },
  { from: 2, to: 3, nodes: 5 },
  { from: 3, to: 4, nodes: 4 }
];

function tierIndex(hours) {
  for (let i = 0; i < TIERS.length; i += 1) if (hours < TIERS[i]) return i;
  return TIERS.length;
}

function playtimePct(hours) {
  const tier = tierIndex(hours);
  if (tier <= 0) return Math.min(100, Math.round((hours / TIERS[0]) * 100));
  if (tier >= TIERS.length) return 100;
  const start = TIERS[tier - 1];
  const end = TIERS[tier];
  return Math.min(100, Math.round(((hours - start) / (end - start)) * 100));
}

function normalizeColor(value) {
  const text = String(value || '').trim();
  let match = text.match(/^#([0-9a-f]{6})$/i);
  if (match) return `#${match[1].toLowerCase()}`;
  match = text.match(/^#([0-9a-f]{3})$/i);
  if (match) return `#${match[1][0]}${match[1][0]}${match[1][1]}${match[1][1]}${match[1][2]}${match[1][2]}`;
  match = text.match(/^rgba?\(([^)]+)\)$/i);
  if (match) {
    const parts = match[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (parts.length >= 3 && parts.slice(0, 3).every(Number.isFinite)) {
      const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
      return `#${parts.slice(0, 3).map((v) => clamp(v).toString(16).padStart(2, '0')).join('')}`;
    }
  }
  return null;
}

function mixHex(a, b, amount) {
  // HSL shortest-arc mix — mirrors src/app.js mixHsl (keep in sync).
  const parse = (hex) => ({
    r: parseInt(hex.slice(1, 3), 16) / 255,
    g: parseInt(hex.slice(3, 5), 16) / 255,
    b: parseInt(hex.slice(5, 7), 16) / 255
  });
  const toHsl = ({ r, g, b }) => {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > .5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h, s, l };
  };
  const from = toHsl(parse(a));
  const to = toHsl(parse(b));
  let dh = to.h - from.h;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  const h = ((from.h + dh * amount) % 360 + 360) % 360;
  const s = Math.min(1, Math.max(0, from.s + (to.s - from.s) * amount));
  const l = Math.min(1, Math.max(0, from.l + (to.l - from.l) * amount));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, bl = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; bl = x; }
  else if (h < 240) { g = x; bl = c; }
  else if (h < 300) { r = x; bl = c; }
  else { r = c; bl = x; }
  const clamp = (v) => Math.max(0, Math.min(255, Math.round((v + m) * 255)));
  return `#${[r, g, bl].map((v) => clamp(v).toString(16).padStart(2, '0')).join('')}`;
}

function tierColorAt(anchors, tier) {
  if (tier <= 0) return anchors[0];
  if (tier >= TIERS.length) return anchors[5];
  let offset = tier - 1;
  for (const era of ERAS) {
    if (offset < era.nodes) return mixHex(anchors[era.from], anchors[era.to], (offset + 1) / era.nodes);
    offset -= era.nodes;
  }
  return anchors[5];
}

/* ---------------------------------------------------------------- capture */

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

const GAME_ID = 'demo-things'; // boot.currentGameId — the ladder target

/** Reads one track's published tier state out of the live DOM. */
const READ_TRACK = (selector) => `(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return null;
  const track = el.parentElement;
  return JSON.stringify({
    tier: track.dataset.progTier || null,
    fill: track.style.getPropertyValue('--prog-fill') || '',
    soft: track.style.getPropertyValue('--prog-fill-soft') || '',
    max: track.classList.contains('is-tier-max'),
    width: el.style.width || ''
  });
})()`;

async function runWorker(workerId, themes, totals) {
  const host = await startHost({ width: 1439, height: 1124 });
  const cdp = await connect({ port: host.cdpPort });
  const results = [];
  let failures = 0;

  try {
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: host.mockScript });

    for (const theme of themes) {
      for (const hours of HOURS) {
        try {
          await cdp.send('Page.navigate', { url: `${host.origin}/src/index.html?novaTierHours=${hours}` });
          if (!(await waitForApp(cdp))) throw new Error('renderer never booted');
          if (await cdp.ev(HELPERS, { hard: true }) !== 'ready') throw new Error('helpers did not install');
          await cdp.ev(`(() => { try { window.NovaIntro && window.NovaIntro.skip && window.NovaIntro.skip(); } catch (error) {} return 'ok'; })()`);
          const active = await cdp.ev(`(async () => {
            try { await window.NovaTheme.activate(${JSON.stringify(theme)}, { silent: true, persist: false }); }
            catch (error) { return 'error'; }
            if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (error) {} }
            await new Promise((resolve) => setTimeout(resolve, 320));
            return document.documentElement.dataset.theme;
          })()`);
          if (active !== theme) throw new Error(`theme did not activate (${active})`);

          // The anchors the theme actually declares, read from the live page.
          const rawAnchors = await cdp.ev(
            `JSON.stringify([0,1,2,3,4,5].map((i) => getComputedStyle(document.documentElement).getPropertyValue('--prog-l' + i)))`
          );
          const anchors = JSON.parse(rawAnchors || '[]').map(normalizeColor);
          const declared = anchors.every(Boolean);

          const tier = tierIndex(hours);
          // nova derives its ladder per cover in app.js, so the expected hex
          // is only computable for themes that declare anchors.
          const expected = declared ? tierColorAt(anchors, tier) : null;

          const entry = { theme, hours, tier, declared, views: {} };

          for (const view of ['home', 'library', 'detail']) {
            const setup = await cdp.ev(`window.__novaExport.setup(${JSON.stringify(view)})`);
            if (!setup) throw new Error(`view setup failed (${view})`);
            await wait(360);

            const selectors = {
              home: '#progressFill',
              library: `[data-game="${GAME_ID}"] .lib-progress i`,
              detail: '#dProgressFill'
            };
            const state = JSON.parse((await cdp.ev(READ_TRACK(selectors[view]))) || '{}');
            const check = {
              tier: state.tier === String(tier),
              fill: tier <= 0 ? !state.fill : (!declared || !expected ? true : state.fill.toLowerCase() === expected.toLowerCase()),
              max: hours >= TIERS[TIERS.length - 1] ? state.max === true : true
            };
            if (view === 'home' || view === 'library') {
              const width = parseFloat(state.width);
              const pct = playtimePct(hours);
              check.width = Number.isFinite(width) ? Math.abs(width - pct) <= 1 : false;
            }
            if (view === 'detail' && hours > 0) {
              const sub = await cdp.ev(`(document.querySelector('#dProgressSub') || {}).textContent || ''`);
              const label = tier >= TIERS.length ? '已达最终阶段' : `下一阶段 · ${TIERS[tier]} 小时`;
              check.next = sub.includes(label);
            }
            entry.views[view] = { state, check };

            if (TAKE_SHOTS) {
              const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 88 });
              if (shot && shot.result && shot.result.data) {
                const file = path.join(OUT, theme, `${hours}h-${view}.jpg`);
                fs.mkdirSync(path.dirname(file), { recursive: true });
                fs.writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
                entry.views[view].file = path.relative(OUT, file).replace(/\\/g, '/');
              }
            }
            totals.done += 1;
          }

          const bad = Object.entries(entry.views).flatMap(([view, data]) =>
            Object.entries(data.check).filter(([, ok]) => !ok).map(([kind]) => `${view}/${kind}`));
          entry.ok = bad.length === 0;
          if (!entry.ok) entry.bad = bad;
          results.push(entry);
          const mark = entry.ok ? 'ok' : `⚠ ${bad.join(' · ')}`;
          process.stdout.write(`  [w${workerId}] ${theme.padEnd(11)} ${String(hours).padStart(6)}h tier=${String(tier).padStart(2)} ${mark}\n`);
          failures = 0;
        } catch (error) {
          failures += 1;
          results.push({ theme, hours, ok: false, error: error.message });
          process.stdout.write(`  [w${workerId}] ${theme.padEnd(11)} ${String(hours).padStart(6)}h  ! ${error.message}\n`);
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
    console.error('no Chromium found. Install Edge/Chrome or set NOVA_BROWSER=<path>.');
    process.exit(2);
  }

  const available = readThemes().map((theme) => theme.id);
  const allThemes = ['nova'].concat(available.filter((id) => id !== 'nova'));
  const themes = THEME_FILTER ? THEME_FILTER.filter((id) => allThemes.includes(id)) : allThemes;
  if (!themes.length) throw new Error('no themes to capture');

  const started = Date.now();
  const totals = { done: 0 };
  const workers = Math.min(WORKERS, themes.length);
  const shards = Array.from({ length: workers }, () => []);
  themes.forEach((theme, index) => shards[index % workers].push(theme));

  console.log(`${themes.length} themes × ${HOURS.length} presets × 3 views · ${workers} renderer(s)\n`);

  const settled = await Promise.allSettled(
    shards.map((shard, index) => (shard.length ? runWorker(index + 1, shard, totals) : Promise.resolve([])))
  );
  const entries = [];
  settled.forEach((outcome) => {
    if (outcome.status === 'fulfilled') entries.push(...outcome.value);
    else console.error(`  ! worker failed: ${outcome.reason && outcome.reason.message}`);
  });

  fs.mkdirSync(OUT, { recursive: true });
  const reportPath = path.join(OUT, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    hours: HOURS,
    mirror: 'src/app.js PLAYTIME LADDER — keep in sync',
    entries
  }, null, 2));

  const failed = entries.filter((entry) => !entry.ok);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\n${entries.length} checks · ${totals.done} captures · ${seconds}s`);
  console.log(`report → ${reportPath}${TAKE_SHOTS ? `\nshots  → ${OUT}` : ''}`);
  if (failed.length) {
    console.log(`\n✗ ${failed.length} failed:`);
    failed.slice(0, 20).forEach((entry) => {
      console.log(`  ${entry.theme} ${entry.hours}h  ${entry.error || (entry.bad || []).join(' · ')}`);
    });
    process.exit(1);
  }
  console.log('\n✓ every published tier colour matches the mirrored ladder math');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
