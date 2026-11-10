/* ============================================================
   APP PART 01 · runtime —— 运行时地基 —— IIFE 开启、use strict、原生桥消息通道（call / 事件分发）、window.nova 引导
   这是 src/app/ 分片之一：由 tools/build-app.js 按文件名序拼回 src/app.js。
   所有分片共享同一个 IIFE 闭包（跨分片直接引用函数与 state）。
   改代码请改分片，改完运行 node tools/build-app.js；直接编辑 app.js 会被覆盖。
   ============================================================ */

(() => {
  'use strict';

  /* ============================================================
     NOVA DESKTOP · renderer
     Real game library: native bridge to the C# host, real launching,
     real playtime. No simulated installs.
     ============================================================ */

  const bridge = window.chrome && window.chrome.webview ? window.chrome.webview : null;
  const hasBridge = !!bridge;

  /* ---------- native bridge ---------- */

  let requestSeq = 0;
  const pending = new Map();

  function call(method, args = {}) {
    if (!hasBridge) return Promise.resolve(null);
    const id = `r${++requestSeq}`;
    return new Promise((resolve) => {
      pending.set(id, resolve);
      try {
        bridge.postMessage(JSON.stringify({ id, method, args }));
      } catch (error) {
        pending.delete(id);
        resolve({ ok: false, error: String(error) });
      }
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          resolve({ ok: false, error: 'native timeout' });
        }
      }, 60000);
    });
  }

  window.nova = { call };

  if (hasBridge) {
    bridge.addEventListener('message', (event) => {
      const message = event.data;
      if (!message || typeof message !== 'object') return;
      if (message.type === 'response') {
        const resolve = pending.get(message.id);
        if (resolve) {
          pending.delete(message.id);
          resolve(message.result);
        }
        return;
      }
      if (message.type === 'session-started') {
        onSessionStarted(message.payload);
        return;
      }
      if (message.type === 'session-ended') {
        onSessionEnded(message.payload);
        return;
      }
      if (message.type === 'playtime-synced') {
        applyPlaytimeUpdates(message.payload && message.payload.games);
        return;
      }
      if (message.type === 'drop-import') {
        onDropImport(message.payload);
        return;
      }
      if (message.type === 'session-failed') {
        onSessionFailed(message.payload);
        return;
      }
      if (message.type === 'session-presented') {
        onSessionPresented(message.payload);
        return;
      }
      if (message.type === 'steam-privilege') {
        if (state.steamRestartWaiter) {
          const resolve = state.steamRestartWaiter;
          state.steamRestartWaiter = null;
          resolve(message.payload);
        }
        refreshSteamPrivilege();
        return;
      }
      if (message.type === 'magpie-status') {
        if (message.payload) {
          toast(message.payload.ok ? '缩放引擎已启动' : (message.payload.error || '缩放引擎启动失败'),
            message.payload.ok ? 'check' : 'alert');
        }
        refreshMagpieStatus();
        return;
      }
      if (message.type === 'scaling-hotkey') {
        if (message.payload && !message.payload.ok) {
          toast(`${message.payload.label || '快捷键'} 注册失败：${message.payload.reason || '可能被占用'}`, 'alert');
        }
        return;
      }
      if (message.type === 'scaling-engine') {
        if (message.payload) {
          toast(message.payload.message || (message.payload.ok ? '缩放引擎已重启' : '缩放引擎重启失败'),
            message.payload.ok ? 'check' : 'alert');
        }
        setTimeout(refreshMagpieStatus, 600);
        return;
      }
      if (message.type === 'scaling-toggled') {
        const payload = message.payload || {};
        toast(payload.ok
          ? (payload.on ? '启动时缩放已开启' : '启动时缩放已关闭')
          : (payload.reason || '没有可以缩放的游戏'), payload.ok ? 'fullscreen' : 'alert');
        return;
      }
      if (message.type === 'activated-running') {
        // An old (pre-takeover) exe forwarded activation to this instance:
        // explain why "running the old version" shows the current one.
        const version = message.payload && message.payload.version;
        toast(`GUGUOVA v${version || '?'} 已在运行 · 要运行旧版请先从托盘退出`, 'info');
        return;
      }
      if (message.type === 'update-status') {
        onUpdateStatus(message.payload || {});
        return;
      }
      if (message.type === 'update-progress') {
        onUpdateProgress(message.payload || {});
        return;
      }
      if (message.type === 'window-state') {
        syncMaxButton(!!message.payload?.maximized);
        return;
      }
      if (message.type === 'fullscreen-state') {
        applyFullscreenState(!!message.payload?.fullscreen);
        return;
      }
      if (message.type === 'ask-close') {
        askClose();
        return;
      }
      if (message.type === 'screenshot-done') {
        // One notification channel, two possible jobs: the page-long export
        // and a share card. Only one of them can be in flight at a time.
        if (shareExportJob) finishShareExport(message.payload || {});
        else finishExport(message.payload || {});
        return;
      }
    });
  }
