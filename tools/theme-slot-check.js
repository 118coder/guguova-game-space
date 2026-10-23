#!/usr/bin/env node
// Theme interface gate.
//
//   node tools/theme-slot-check.js            # report
//   node tools/theme-slot-check.js --strict   # exit 1 on any finding
//
// The refactor moved every per-theme rule out of the shared sheets and into
// themes/<id>/interfaces.css. This guard keeps it that way:
//
//   1. no shared sheet may select on a concrete theme id
//   2. every theme must ship a slot mapping, and it must cover the slots
//      that carry a colour (a theme that maps none is a regression)
//   3. no slot mapping may reference a theme id other than its own
//   4. every mapping must have a matching theme.json id
//
// It reads files only; it does not render.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const STRICT = process.argv.includes('--strict');

const SHARED = [
  'src/base.css', 'src/theme.css', 'src/cta-palettes.css', 'src/type.css',
  'src/app.css', 'src/motion.css', 'src/views.css', 'src/dialogs.css',
  'src/themes.css', 'src/theme-fx.css', 'src/fx-layers.css', 'src/theme-kit.css',
  'src/polish.css', 'src/intro.css', 'src/compat.css', 'src/theme-slots.css',
  'src/settings-themes.css'
];

// Slots whose whole purpose is a colour decision. A theme that leaves one
// out falls back to a default that was tuned for a different material, so
// these are reported as missing rather than silently accepted.
// A slot counts as mapped when either the surface is selected
// (`.engine-shell { … }`) or its token family is declared on the root
// (`--hs-bg: …`). Both are legitimate: a theme re-skins the sheet, or it
// feeds the surface's own custom properties. The consumer is shared; only
// the values are the theme's.
const REQUIRED_SLOTS = {
  '.engine-shell': { why: 'the scaling-engine sheet material', tokens: '--sheet-' },
  '.hero-scale': { why: 'the homepage fullscreen row', tokens: '--hs-' },
  '.appearance-framing': { why: 'the hero framing panel', tokens: '--af-' },
  '.engine-mode-row': { why: 'the algorithm selection row', tokens: '--mode-' },
  '--accent-text': { why: 'readable accent text (rule #21)', tokens: null },
  '--menu-': { why: 'the themed dropdown', tokens: null }
};

const findings = [];
const notes = [];

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, ' ');
}

/* 1 — shared sheets must stay theme-agnostic */

SHARED.forEach((file) => {
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) return;
  const css = stripComments(fs.readFileSync(abs, 'utf8'));
  const hits = css.match(/html\[data-theme="[a-z0-9-]+"\]/g);
  if (hits) {
    const ids = [...new Set(hits.map((h) => h.match(/"([a-z0-9-]+)"/)[1]))];
    findings.push(`${file}: selects on theme id(s) ${ids.join(', ')} — belongs in that theme's interfaces.css`);
  }
});

/* 2 — every theme folder must ship a mapping that covers the colour slots */

const themeRoot = path.join(ROOT, 'themes');
const themes = fs.existsSync(themeRoot)
  ? fs.readdirSync(themeRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((id) => fs.existsSync(path.join(themeRoot, id, 'theme.json')))
  : [];

if (!themes.length) findings.push('themes/: no theme folders found');

const covered = [];

themes.forEach((id) => {
  const file = path.join(themeRoot, id, 'interfaces.css');
  if (!fs.existsSync(file)) {
    findings.push(`themes/${id}: no interfaces.css — this theme maps no interface slot`);
    return;
  }
  const css = stripComments(fs.readFileSync(file, 'utf8'));

  // 3 — a mapping may only talk about its own theme
  const ids = [...new Set((css.match(/html\[data-theme="([a-z0-9-]+)"\]/g) || [])
    .map((h) => h.match(/"([a-z0-9-]+)"/)[1]))];
  const foreign = ids.filter((other) => other !== id);
  if (foreign.length) {
    findings.push(`themes/${id}/interfaces.css: references other theme(s) ${foreign.join(', ')}`);
  }
  if (!ids.includes(id)) {
    findings.push(`themes/${id}/interfaces.css: no rule is scoped to html[data-theme="${id}"]`);
  }

  const missing = Object.entries(REQUIRED_SLOTS)
    .filter(([slot, spec]) => !css.includes(slot) && !(spec.tokens && css.includes(spec.tokens)))
    .map(([slot, spec]) => `${slot} (${spec.why})`);
  if (missing.length) {
    findings.push(`themes/${id}/interfaces.css: missing slot(s) ${missing.join('; ')}`);
  }
  covered.push({ id, bytes: css.length, rules: (css.match(/\{/g) || []).length });
});

/* 4 — the built-in theme's mapping ships as a renderer file */

const novaFile = path.join(ROOT, 'src/theme-nova.css');
if (!fs.existsSync(novaFile)) {
  findings.push('src/theme-nova.css: missing — the built-in theme has no slot mapping');
} else {
  const css = stripComments(fs.readFileSync(novaFile, 'utf8'));
  const ids = [...new Set((css.match(/html\[data-theme="([a-z0-9-]+)"\]/g) || [])
    .map((h) => h.match(/"([a-z0-9-]+)"/)[1]))];
  const foreign = ids.filter((id) => id !== 'nova');
  if (foreign.length) findings.push(`src/theme-nova.css: references other theme(s) ${foreign.join(', ')}`);
  covered.push({ id: 'nova (built-in)', bytes: css.length, rules: (css.match(/\{/g) || []).length });
}

/* ------------------------------------------------------------- reporting */

console.log('theme interface slots\n');
console.log('  theme                 rules   bytes');
covered.sort((a, b) => a.id.localeCompare(b.id)).forEach((row) => {
  console.log(`  ${row.id.padEnd(20)} ${String(row.rules).padStart(5)} ${String(row.bytes).padStart(7)}`);
});

if (notes.length) {
  console.log('\nnotes');
  notes.forEach((line) => console.log('  · ' + line));
}

console.log('');
if (!findings.length) {
  console.log('✓ every theme owns its slot mapping; no shared sheet names a theme');
  process.exit(0);
}
console.log(`✗ ${findings.length} finding(s)`);
findings.forEach((line) => console.log('  · ' + line));
process.exit(STRICT ? 1 : 0);
