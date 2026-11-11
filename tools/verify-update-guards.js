#!/usr/bin/env node
// Guards around the in-place updater that the happy-path test cannot see
// (docs/HANDOFF-NEXT.md §1.41.5 items 7 and 8):
//
//   1. a package built for another CPU is refused from its PE header, and the
//      running launcher stays alive instead of swapping in a dead file;
//   2. a package an interrupted swap left behind is reported at boot, so the
//      panel offers the upgrade again instead of dropping it silently.
//
//   node tools/verify-update-guards.js
//
// Runs on a throwaway copy of the Debug build with its own data root; the
// installed launcher and the player's data are never touched.

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, execSync } = require('child_process');
const { connect } = require('./lib/cdp');

const ROOT = path.resolve(__dirname, '..');
const BASE = path.join(ROOT, '..', '_shots', 'updguard');
const APP = path.join(BASE, 'app');
const EXE = path.join(APP, 'GUGUOVA.exe');
const DATA = path.join(BASE, 'data');
const UPDATES = path.join(DATA, 'updates');
const BUILD = path.join(ROOT, 'bin', 'Debug', 'net10.0-windows', 'win-x64');
const BUILD_EXE = path.join(BUILD, 'GUGUOVA.exe');
const PORT = 9234;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function probe() {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port: PORT, path: '/json/version' }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1200, () => { req.destroy(); resolve(false); });
  });
}

function killCopies() {
  try {
    execSync(
      'powershell -NoProfile -Command "Get-Process GUGUOVA -ErrorAction SilentlyContinue | ' +
      'Where-Object { $_.Path -like \'*updguard*\' } | Stop-Process -Force"',
      { stdio: 'ignore' }
    );
  } catch (error) { /* nothing to kill */ }
}

/** "GUGUOVA.exe" + 1 MB of padding, with the PE machine field overwritten.
 *  The trailing bytes do not stop Windows loading it; the header is what the
 *  launcher reads before it promises a restart. */
function makePackage(name, machine) {
  const data = Buffer.from(fs.readFileSync(BUILD_EXE));
  const peOffset = data.readInt32LE(0x3c);
  if (data.readUInt32LE(peOffset) !== 0x00004550) throw new Error('构建产物不是 PE 文件');
  if (machine) data.writeUInt16LE(machine, peOffset + 4);
  const pkg = Buffer.concat([data, Buffer.alloc(1024 * 1024)]);
  fs.mkdirSync(UPDATES, { recursive: true });
  const target = path.join(UPDATES, name);
  fs.writeFileSync(target, pkg);
  return { path: target, size: pkg.length };
}

async function launch() {
  killCopies();
  const child = spawn(EXE, [], {
    cwd: APP,
    env: { ...process.env, NOVA_DATA_ROOT: DATA, NOVA_CDP_PORT: String(PORT) },
    stdio: 'ignore'
  });
  for (let i = 0; i < 60; i++) {
    if (await probe()) return child;
    await wait(400);
  }
  throw new Error('CDP 没有起来，实例可能启动失败');
}

/** The endpoint answers a beat before WebView2 has a page target to attach to. */
async function openCdp() {
  let last = null;
  for (let i = 0; i < 40; i++) {
    try { return await connect({ port: PORT }); } catch (error) { last = error; }
    await wait(400);
  }
  throw last || new Error('连不上 CDP');
}

(async () => {
  fs.rmSync(BASE, { recursive: true, force: true });
  fs.mkdirSync(BASE, { recursive: true });
  execSync(`cp -r "${BUILD}" "${APP}"`, {
    stdio: 'ignore',
    shell: 'C:/Program Files/Git/bin/bash.exe'
  });

  // ---- 1. wrong architecture is refused, app survives -------------------
  const arm = makePackage('GUGUOVA-9.9.9-arm64.exe', 0xAA64);
  await launch();
  let cdp = await openCdp();
  await cdp.send('Runtime.enable');
  await wait(1200);
  const refused = await cdp.ev(
    `window.nova.call('applyUpdate', { path: ${JSON.stringify(arm.path)} })`,
    { hard: true }
  );
  await wait(2600);
  const survived = await probe();
  await cdp.close();
  fs.rmSync(arm.path, { force: true });
  killCopies();
  console.log('arch guard ->', JSON.stringify(refused), 'alive:', survived);

  // ---- 2. a leftover package is offered again at boot -------------------
  const good = makePackage('GUGUOVA-9.9.9-single.exe', 0);
  await launch();
  cdp = await openCdp();
  await cdp.send('Runtime.enable');
  await wait(1600);
  const boot = await cdp.ev(`window.nova.call('boot')`, { hard: true });
  const panel = await cdp.ev(`(() => JSON.stringify({
    applyHidden: document.querySelector('#updateApplyBtn').hidden,
    state: document.querySelector('#updateState').textContent.trim()
  }))()`);
  console.log('pending ->', JSON.stringify(boot && boot.pendingUpdate), panel);
  await cdp.close();
  killCopies();
  fs.rmSync(BASE, { recursive: true, force: true });

  let shown = {};
  try { shown = JSON.parse(panel || '{}'); } catch (error) { shown = {}; }

  const problems = [];
  if (!refused || refused.ok !== false) problems.push('架构不符的更新包没有被拒绝');
  else if (!/架构/.test(refused.error || '')) problems.push(`拒绝理由不对：${refused.error}`);
  if (!survived) problems.push('拒绝之后启动器退出了（应该继续运行）');
  if (!boot || !boot.pendingUpdate) problems.push('boot 没有报告残留的更新包');
  else if (boot.pendingUpdate.name !== 'GUGUOVA-9.9.9-single.exe') {
    problems.push(`残留包名不对：${boot.pendingUpdate.name}`);
  }
  if (shown.applyHidden !== false) problems.push('残留包没有让「重启并升级」按钮出现');
  if (!/已下载/.test(shown.state || '')) problems.push(`更新区没有显示已下载：${shown.state}`);

  if (problems.length) {
    console.log('\n✗ ' + problems.join('\n✗ '));
    process.exit(1);
  }
  console.log('\n✓ 架构不符被拦下、残留包启动时会重新提示');
})();
