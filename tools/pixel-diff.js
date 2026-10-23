#!/usr/bin/env node
// Byte-level PNG comparison for the refactor gate.
//   node tools/pixel-diff.js <baselineDir> <candidateDir>
// Reports, per file: identical / different / missing, plus a max channel delta.
// Decoding is minimal (8-bit RGB/RGBA, non-interlaced) which is what the
// headless renderer emits; anything else is reported as "unsupported" rather
// than silently passing.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function decodePng(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not png');
  let pos = 8, width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (bitDepth !== 8 || interlace !== 0 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`unsupported png (depth=${bitDepth} color=${colorType} interlace=${interlace})`);
  }
  const channels = colorType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);
  let rp = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[rp++];
    const row = raw.subarray(rp, rp + stride); rp += stride;
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x += 1) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev ? prev[x] : 0;
      const c = (prev && x >= channels) ? prev[x - channels] : 0;
      let v = row[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[x] = v & 0xff;
    }
  }
  return { width, height, channels, data: out };
}

const [baseline, candidate] = process.argv.slice(2);
if (!baseline || !candidate) {
  console.error('usage: node tools/pixel-diff.js <baselineDir> <candidateDir>');
  process.exit(2);
}

let identical = 0, different = 0, missing = 0, unsupported = 0;
const rows = [];
for (const theme of fs.readdirSync(baseline)) {
  const dir = path.join(baseline, theme);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.png')) continue;
    const a = path.join(dir, name);
    const b = path.join(candidate, theme, name);
    if (!fs.existsSync(b)) { missing += 1; rows.push(`MISSING ${theme}/${name}`); continue; }
    let ia, ib;
    try { ia = decodePng(a); ib = decodePng(b); }
    catch (error) { unsupported += 1; rows.push(`UNSUPPORTED ${theme}/${name}: ${error.message}`); continue; }
    if (ia.width !== ib.width || ia.height !== ib.height) {
      different += 1; rows.push(`SIZE ${theme}/${name} ${ia.width}x${ia.height} -> ${ib.width}x${ib.height}`);
      continue;
    }
    let worst = 0, changed = 0;
    const total = ia.width * ia.height;
    for (let i = 0; i < ia.data.length; i += 1) {
      const d = Math.abs(ia.data[i] - ib.data[i]);
      if (d) { changed += 1; if (d > worst) worst = d; }
    }
    if (worst === 0) identical += 1;
    else {
      different += 1;
      rows.push(`DIFF ${theme}/${name} pixels=${(changed / (total * ia.channels) * 100).toFixed(3)}% maxΔ=${worst}`);
    }
  }
}
console.log(rows.join('\n') || '(no differences)');
console.log(`\nidentical=${identical} different=${different} missing=${missing} unsupported=${unsupported}`);
process.exit(different + missing + unsupported ? 1 : 0);
