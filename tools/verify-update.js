#!/usr/bin/env node
// End-to-end check for the in-place updater.
//
// Copies the current Debug build into a throwaway folder with its own data
// root, drops a fake package into that root's `updates` folder, asks the app
// to swap itself and relaunch, then asserts:
//
//   * the running exe really was replaced (size matches the package)
//   * the download cache was wiped
//   * a new process came back up and its CDP endpoint answers again
//
// Nothing here touches the installed launcher or the player's data root.
//
//   node tools/verify-update.js            # keeps the folder for inspection
//   node tools/verify-update.js --clean    # deletes it when done

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, execSync } = require('child_process');
const { connect } = require('./lib/cdp');

const ROOT = path.resolve(__dirname, '..');
const BASE = path.join(ROOT, '..', '_shots', 'updtest');
const APP = path.join(BASE, 'app');
const EXE = path.join(APP, 'GUGUOVA.exe');
const DATA = path.join(BASE, 'data');
const UPDATES = path.join(DATA, 'updates');
const PKG = path.join(UPDATES, 'GUGUOVA-9.9.9-single.exe');
const PORT = 9233;
const CLEAN = process.argv.includes('--clean');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const BUILD = path.join(ROOT, 'bin', 'Debug', 'net10.0-windows', 'win-x64');

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
      'Where-Object { $_.Path -like \'*updtest*\' } | Stop-Process -Force"',
      { stdio: 'ignore' }
    );
  } catch (error) { /* nothing to kill */ }
}

function prepare() {
  if (!fs.existsSync(EXE)) {
    fs.rmSync(BASE, { recursive: true, force: true });
    fs.mkdirSync(BASE, { recursive: true });
    // fs.cpSync kills the node process outright on this machine (exit 127,
    // no output); a shell copy of the same tree works fine.
    execSync(`cp -r "${BUILD}" "${APP}"`, {
      stdio: 'ignore',
      shell: 'C:/Program Files/Git/bin/bash.exe'
    });
  }
  fs.mkdirSync(UPDATES, { recursive: true });
  /* A kept fixture is dirty: last run's swap left the package AS the exe and
     the waiter then deleted the package. Put the pristine build back so
     "size changed" still proves the copy, and rebuild the package. */
  const buildExe = path.join(BUILD, 'GUGUOVA.exe');
  const pristine = fs.existsSync(buildExe) ? fs.statSync(buildExe).size : -1;
  if (pristine > 0 && fs.statSync(EXE).size !== pristine) {
    fs.copyFileSync(buildExe, EXE);
  }
  if (!fs.existsSync(PKG)) {
    // A real package is bigger than the running exe, so "size changed" is proof
    // the copy happened. The trailing bytes do not stop the PE from loading.
    const data = fs.readFileSync(buildExe);
    fs.writeFileSync(PKG, Buffer.concat([data, Buffer.alloc(1024 * 1024)]));
  }
  return { sizeBefore: fs.statSync(EXE).size, sizePkg: fs.statSync(PKG).size };
}

(async () => {
  const { sizeBefore, sizePkg } = prepare();
  console.log(`before: exe=${sizeBefore} package=${sizePkg}`);

  killCopies();
  const child = spawn(EXE, [], {
    cwd: APP,
    env: { ...process.env, NOVA_DATA_ROOT: DATA, NOVA_CDP_PORT: String(PORT) },
    stdio: 'ignore'
  });
  console.log('launched pid', child.pid);

  let up = false;
  for (let i = 0; i < 60; i++) {
    if (await probe()) { up = true; break; }
    await wait(400);
  }
  if (!up) throw new Error('CDP 没有起来，实例可能启动失败');

  const cdp = await connect({ port: PORT });
  await cdp.send('Runtime.enable');
  await wait(1500);
  const answer = await cdp.ev(
    `window.nova.call('applyUpdate', { path: ${JSON.stringify(PKG)} })`,
    { hard: true }
  );
  console.log('applyUpdate ->', JSON.stringify(answer));

  let replaced = false;
  let cleaned = false;
  for (let i = 0; i < 75; i++) {
    await wait(400);
    try {
      if (fs.statSync(EXE).size === sizePkg) replaced = true;
    } catch (error) { /* 复制中 */ }
    const left = fs.existsSync(UPDATES)
      ? fs.readdirSync(UPDATES).filter((n) => /\.(exe|zip|part)$/i.test(n))
      : [];
    if (replaced && !left.length) { cleaned = true; break; }
  }

  // WebView2 要重新起来，端口不是立刻就有。
  let restarted = false;
  for (let i = 0; i < 40; i++) {
    if (await probe()) { restarted = true; break; }
    await wait(500);
  }

  const result = {
    answer,
    replaced,
    cleaned,
    restarted,
    exeSize: fs.existsSync(EXE) ? fs.statSync(EXE).size : -1,
    expectedSize: sizePkg,
    updatesLeft: fs.existsSync(UPDATES) ? fs.readdirSync(UPDATES) : []
  };
  console.log(JSON.stringify(result, null, 2));

  killCopies();
  try { await cdp.close(); } catch (error) { /* 已退出 */ }
  if (CLEAN) fs.rmSync(BASE, { recursive: true, force: true });

  const ok = answer && answer.ok && replaced && cleaned && restarted;
  if (!ok) {
    console.log('✗ 自动升级链路未通过');
    process.exit(1);
  }
  console.log('✓ 替换、清缓存、重启三步都成立');
})();
