#!/usr/bin/env node
/* ------------------------------------------------------------------
   build-app.js — 把 src/app/*.js 分片按文件名序拼装成 src/app.js。

   背景：src/app.js 是渲染端的单一 IIFE 闭包（一个 script 标签、一份
   共享作用域），它太大（~9800 行），已按职责切成 src/app/ 下的分片。
   分片之间共享同一个闭包，因此不能改成多个 <script> 标签——拼装是
   保持运行时行为不变前提下唯一的拆分方式。

   规则（详见 src/app/README.md）：
   - 改代码只改 src/app/ 分片；直接改 src/app.js 会在下次拼装时被覆盖。
   - 每个分片文件以一个换行结尾（build 时会自动补齐，防止手编辑破坏）。
   - 分片文件名带两位数字前缀，决定拼装顺序；新分片请按依赖关系插号。

   用法：
     node tools/build-app.js            # 拼装并写入 src/app.js
     node tools/build-app.js --check    # 校验 src/app.js 是否为最新拼装
     node tools/build-app.js --quiet    # 不列出分片
   ------------------------------------------------------------------ */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PARTS_DIR = path.join(ROOT, 'src', 'app');
const OUT = path.join(ROOT, 'src', 'app.js');

function partFiles() {
  const files = fs.readdirSync(PARTS_DIR)
    .filter((f) => f.endsWith('.js') && /^\d{2}-/.test(f))
    .sort();
  if (!files.length) throw new Error(`no numbered parts found in ${PARTS_DIR}`);
  return files;
}

function assemble() {
  // Every part must end with exactly one newline: the '\n' between parts is
  // the same separator the original single file had between its blocks.
  return partFiles()
    .map((f) => fs.readFileSync(path.join(PARTS_DIR, f), 'utf8'))
    .map((c) => (c.endsWith('\n') ? c : `${c}\n`))
    .join('');
}

function build(options = {}) {
  const files = partFiles();
  const text = assemble();
  fs.writeFileSync(OUT, text, 'utf8');
  if (!options.quiet) {
    console.log(`assembled src/app.js (${text.length} B) from ${files.length} parts:`);
    console.log('  ' + files.join('\n  '));
  }
  return text;
}

function check() {
  const text = assemble();
  const current = fs.readFileSync(OUT, 'utf8');
  if (current !== text) {
    console.error('src/app.js is stale — run `node tools/build-app.js` after editing src/app/* parts.');
    process.exit(1);
  }
  console.log(`src/app.js is up to date (${text.length} B, ${partFiles().length} parts).`);
}

module.exports = { build, check, partFiles };

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--check')) check();
  else build({ quiet: args.includes('--quiet') });
}
