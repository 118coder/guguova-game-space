#!/usr/bin/env node
// Builds the WebAssembly palette kernel and copies it into the renderer.
//
//   node tools/build-wasm.js            # build if cargo is present
//   node tools/build-wasm.js --check    # verify the committed .wasm matches
//
// The .wasm is committed so a normal build never needs a Rust toolchain: the
// launcher ships working binaries for machines that just run `dotnet build`.
// `--check` rebuilds into a temp dir and compares, which is what CI and the
// release pipeline use to catch a stale kernel.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CRATE = path.join(ROOT, 'wasm', 'palette');
const TARGET = 'wasm32-unknown-unknown';
const OUT_NAME = 'nova_palette.wasm';
const SHIPPED = path.join(ROOT, 'src', 'assets', OUT_NAME);
const CHECK = process.argv.includes('--check');

function has(command) {
  const probe = spawnSync(command, ['--version'], { encoding: 'utf8' });
  return probe.status === 0;
}

function build(targetDir) {
  const result = spawnSync('cargo', ['build', '--release', '--target', TARGET], {
    cwd: CRATE,
    encoding: 'utf8',
    env: Object.assign({}, process.env, targetDir ? { CARGO_TARGET_DIR: targetDir } : {})
  });
  if (result.status !== 0) {
    console.error(result.stdout || '');
    console.error(result.stderr || '');
    throw new Error('cargo build failed');
  }
  const built = path.join(targetDir || path.join(CRATE, 'target'), TARGET, 'release', 'nova_palette.wasm');
  if (!fs.existsSync(built)) throw new Error(`cargo produced no ${OUT_NAME}`);
  return built;
}

if (!has('cargo')) {
  if (CHECK) {
    console.error('✗ cargo is unavailable, so the committed kernel cannot be verified');
    process.exit(1);
  }
  console.log('cargo not found — keeping the committed kernel at src/assets/' + OUT_NAME);
  if (!fs.existsSync(SHIPPED)) {
    console.error('✗ no committed kernel either; the WASM path will stay off');
    process.exit(1);
  }
  process.exit(0);
}

// A missing target is the one thing worth installing automatically: without it
// the build fails with a confusing "can't find crate for core".
const targets = spawnSync('rustup', ['target', 'list', '--installed'], { encoding: 'utf8' });
if (targets.status === 0 && !String(targets.stdout).includes(TARGET)) {
  console.log(`installing ${TARGET}…`);
  const add = spawnSync('rustup', ['target', 'add', TARGET], { encoding: 'utf8', stdio: 'inherit' });
  if (add.status !== 0) throw new Error(`could not install ${TARGET}`);
}

if (CHECK) {
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'nova-wasm-'));
  try {
    const fresh = build(tmp);
    const a = fs.readFileSync(fresh);
    const b = fs.existsSync(SHIPPED) ? fs.readFileSync(SHIPPED) : Buffer.alloc(0);
    if (!b.length) {
      console.error(`✗ ${path.relative(ROOT, SHIPPED)} is missing`);
      process.exit(1);
    }
    if (!a.equals(b)) {
      console.error(`✗ ${OUT_NAME} is stale — rerun node tools/build-wasm.js`);
      console.error(`  built ${a.length} bytes, shipped ${b.length} bytes`);
      process.exit(1);
    }
    console.log(`✓ ${OUT_NAME} matches the source (${a.length} bytes)`);
    process.exit(0);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

const built = build(null);
fs.copyFileSync(built, SHIPPED);
const size = fs.statSync(SHIPPED).size;
console.log(`✓ built ${path.relative(ROOT, SHIPPED)} (${size} bytes)`);
