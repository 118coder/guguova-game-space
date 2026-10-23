#!/usr/bin/env node
// Palette kernel conformance test.
//
//   node tools/test-palette.js          # exit 1 on any mismatch
//   node tools/test-palette.js --verbose
//
// Three implementations compute the same thing:
//
//   src/capability/palette.js     plain JS, the always-available path
//   src/assets/nova_palette.wasm  the fast path (built from wasm/palette)
//   Services/CoverAnalyzer.cs     C#, import-time only, not covered here
//
// If the WASM and JS answers drift, a machine with WebGPU/WASM and one
// without would show different accent colours for the same game. This test
// feeds both the same synthetic images and requires identical output.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const VERBOSE = process.argv.includes('--verbose');

/* ------------------------------------------------ load the JS reference */

const sandbox = { window: {}, document: { createElement: () => ({ getContext: () => null }) } };
sandbox.window.document = sandbox.document;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/capability/palette.js'), 'utf8'), sandbox);
const reference = sandbox.window.NovaPalette;
if (!reference) {
  console.error('✗ src/capability/palette.js did not expose window.NovaPalette');
  process.exit(1);
}

/* ------------------------------------------------------------ load WASM */

const wasmPath = path.join(ROOT, 'src/assets/nova_palette.wasm');
if (!fs.existsSync(wasmPath)) {
  console.error('✗ src/assets/nova_palette.wasm is missing — run: node tools/build-wasm.js');
  process.exit(1);
}
const wasmBytes = fs.readFileSync(wasmPath);

/* ------------------------------------------------- synthetic test images */

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function solid(width, height, r, g, b) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = 255;
  }
  return { data, width, height };
}

function gradient(width, height, from, to) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const t = (x + y) / (width + height - 2);
      const i = (y * width + x) * 4;
      data[i] = from[0] + (to[0] - from[0]) * t;
      data[i + 1] = from[1] + (to[1] - from[1]) * t;
      data[i + 2] = from[2] + (to[2] - from[2]) * t;
      data[i + 3] = 255;
    }
  }
  return { data, width, height };
}

function noise(width, height, seed) {
  const rnd = mulberry32(seed);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data[i * 4] = rnd() * 255;
    data[i * 4 + 1] = rnd() * 255;
    data[i * 4 + 2] = rnd() * 255;
    data[i * 4 + 3] = 255;
  }
  return { data, width, height };
}

function checker(width, height, cell) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const v = ((x / cell | 0) + (y / cell | 0)) % 2 ? 240 : 20;
      const i = (y * width + x) * 4;
      data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
    }
  }
  return { data, width, height };
}

const CASES = [
  ['solid red', solid(32, 32, 255, 0, 0)],
  ['solid teal', solid(24, 24, 12, 140, 130)],
  ['solid near-white', solid(16, 16, 250, 248, 244)],
  ['solid black', solid(16, 16, 0, 0, 0)],
  ['warm gradient', gradient(40, 24, [255, 180, 90], [40, 20, 10])],
  ['cool gradient', gradient(40, 24, [30, 60, 160], [200, 240, 255])],
  ['noise a', noise(32, 32, 1)],
  ['noise b', noise(48, 20, 99)],
  ['checker 4', checker(32, 32, 4)],
  ['checker 8', checker(40, 40, 8)]
];

/* --------------------------------------------------------------- compare */

/** Relative tolerance: float32 accumulation order differs slightly between
 *  the JS and WASM builds, and demanding bit equality would be brittle. */
const TOLERANCE = 1.5e-3;

function compare(label, jsOut, wasmOut) {
  const problems = [];
  for (let i = 0; i < 16; i += 1) {
    const a = jsOut[i];
    const b = wasmOut[i];
    const scale = Math.max(1, Math.abs(a), Math.abs(b));
    if (Math.abs(a - b) / scale > TOLERANCE) {
      problems.push(`index ${i}: js=${a.toFixed(4)} wasm=${b.toFixed(4)}`);
    }
  }
  if (problems.length) {
    console.log(`  ✗ ${label}`);
    problems.forEach((p) => console.log(`      ${p}`));
    return false;
  }
  if (VERBOSE) {
    console.log(`  ✓ ${label}  accent=rgb(${Math.round(jsOut[0])},${Math.round(jsOut[1])},${Math.round(jsOut[2])}) luma=${jsOut[12].toFixed(3)} edge=${jsOut[15].toFixed(3)}`);
  }
  return true;
}

(async () => {
  const { instance } = await WebAssembly.instantiate(wasmBytes, {});
  const api = instance.exports;

  // The module exports no allocator, so park pixel data above __heap_base and
  // make sure the memory can hold it.
  const heapBase = api.__heap_base ? api.__heap_base.value : 65536;
  let ptr = (heapBase + 15) & ~15;

  console.log(`palette kernel conformance  (${CASES.length} cases, tolerance ${TOLERANCE})\n`);
  let failures = 0;

  for (const [label, image] of CASES) {
    const bytes = image.width * image.height * 4;
    const needed = ptr + bytes;
    if (needed > api.memory.buffer.byteLength) {
      const pages = Math.ceil((needed - api.memory.buffer.byteLength) / 65536) + 4;
      api.memory.grow(pages);
    }
    new Uint8Array(api.memory.buffer).set(image.data, ptr);

    const outPtr = api.analyse(ptr, image.width, image.height, 1);
    const wasmOut = new Float32Array(api.memory.buffer, outPtr, 16).slice();

    const jsOut = reference.analyse(image.data, image.width, image.height, 1);
    if (!compare(label, jsOut, wasmOut)) failures += 1;
  }

  /* subsampling must not change the palette much: that is the whole premise
     of the fast path on a large cover */
  const big = gradient(200, 120, [220, 120, 60], [20, 40, 90]);
  const full = reference.analyse(big.data, big.width, big.height, 1);
  const skip = reference.analyse(big.data, big.width, big.height, 3);
  const drift = Math.abs(full[12] - skip[12]);
  if (drift > 0.02) {
    console.log(`  ✗ subsample drift: luma ${full[12].toFixed(4)} vs ${skip[12].toFixed(4)}`);
    failures += 1;
  } else if (VERBOSE) {
    console.log(`  ✓ subsample step=3 luma drift ${drift.toFixed(5)} (<=0.02)`);
  }

  console.log('');
  if (failures) {
    console.log(`✗ ${failures} case(s) disagree — the JS and WASM kernels drifted`);
    process.exit(1);
  }
  console.log('✓ JS and WASM kernels agree on every case');
  process.exit(0);
})().catch((error) => {
  console.error('ERR', error.message);
  process.exit(1);
});
