/* ============================================================
   APP PART 19 · update —— 检查更新 —— GitHub Releases，全应用唯一联网功能（默认关）
   这是 src/app/ 分片之一：由 tools/build-app.js 按文件名序拼回 src/app.js。
   所有分片共享同一个 IIFE 闭包（跨分片直接引用函数与 state）。
   改代码请改分片，改完运行 node tools/build-app.js；直接编辑 app.js 会被覆盖。
   ============================================================ */

  /* ============================================================
     UPDATE CHECK (GitHub releases — the only feature that goes online)
     ============================================================ */

  function formatBytes(n) {
    if (!Number.isFinite(n) || n <= 0) return '';
    if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
    return `${Math.round(n / 1024)} KB`;
  }

  function updateRender() {
    const info = state.update || { phase: 'idle' };
    const busy = info.phase === 'checking' || info.phase === 'downloading';
    if (els.updateCheckBtn) {
      els.updateCheckBtn.hidden = info.phase === 'downloading';
      els.updateCheckBtn.disabled = busy;
    }
    if (els.updateDownloadBtn) els.updateDownloadBtn.hidden = !(info.phase === 'result' && info.available);
    if (els.updateFolderBtn) els.updateFolderBtn.hidden = info.phase !== 'done';
    if (els.updateProgress) els.updateProgress.hidden = info.phase !== 'downloading';
    if (els.updateState) {
      els.updateState.textContent =
        info.phase === 'checking' ? '正在检查更新…'
          : info.phase === 'downloading' ? `正在下载 ${info.name || '更新包'}…`
            : info.phase === 'result' && info.available ? `发现新版本 v${info.latest} · 当前 v${info.current}`
              : info.phase === 'result' ? `已是最新 · v${info.current}`
                : info.phase === 'done' ? `已下载 ${info.name} · 运行它即可升级（新版会接管旧版）`
                  : info.phase === 'cancelled' ? '下载已取消'
                    : info.phase === 'error' ? `检查失败：${info.error || '未知错误'}`
                      : `当前版本 ${state.version}`;
    }
    if (els.updateNote) {
      const text = info.phase === 'result' && info.available
        ? [info.notes, formatBytes(info.assetSize)].filter(Boolean).join(' · ')
        : '';
      els.updateNote.hidden = !text;
      els.updateNote.textContent = text;
    }
  }

  function onUpdateStatus(payload) {
    state.update = { ...(state.update || {}), ...payload };
    updateRender();
    if (payload.phase === 'result' && payload.available) {
      toast(`发现新版本 v${payload.latest} · 设置里可下载`, 'cloud');
    } else if (payload.phase === 'done') {
      toast('更新包已下载', 'check');
    } else if (payload.phase === 'error') {
      toast(payload.error || '更新检查失败', 'alert');
    }
  }

  function onUpdateProgress(payload) {
    const percent = Math.max(0, Math.min(100, payload.percent || 0));
    if (els.updateProgressFill) els.updateProgressFill.style.width = `${percent}%`;
    if (els.updateProgressPct) els.updateProgressPct.textContent = `${percent}%`;
  }

  async function checkForUpdates() {
    const result = await call('checkUpdate');
    if (result && result.ok === false) toast(result.error || '无法启动检查', 'alert');
  }

  function toggleUpdateAuto() {
    state.settings.autoCheckUpdates = !(state.settings.autoCheckUpdates === true);
    setPrefSwitch(els.updateAutoRow, els.updateAutoSwitch, state.settings.autoCheckUpdates);
    saveSettings();
    audio.toggle();
    toast(state.settings.autoCheckUpdates ? '每天自动检查更新已开启' : '每天自动检查更新已关闭', 'check');
  }

  function showExportResult(title, path, detail) {
    return window.NovaOverlays.dialog({
      title,
      text: `${detail || ''}\n${path}`,
      icon: 'check',
      actions: [
        { label: '在资源管理器中显示', value: 'reveal', icon: 'folder' },
        { label: '知道了', value: 'ok', style: 'primary' }
      ]
    }).then((choice) => {
      if (choice === 'reveal') call('revealPath', { path });
    });
  }

  async function exportPack() {
    if (!els.settingsExport || els.settingsExport.disabled) return;
    audio.select();
    els.settingsExport.disabled = true;
    const label = els.settingsExport.querySelector('span');
    if (label) label.textContent = '正在导出…';
    const result = await call('exportPack');
    els.settingsExport.disabled = false;
    if (label) label.textContent = '导出数据包';
    if (!result || !result.ok) {
      toast(result?.error || '导出失败', 'alert');
      return;
    }
    if (state.storage) state.storage.lastBackupUtc = new Date().toISOString();
    renderSettings();
    await showExportResult('数据包已导出', result.path,
      `${result.games} 款游戏 · ${result.mediaFiles} 个封面 · ${formatBytes(result.size)}`);
  }

  async function exportRecords() {
    audio.select();
    const result = await call('exportRecords');
    if (!result || !result.ok) {
      toast(result?.error || '导出失败', 'alert');
      return;
    }
    await showExportResult('游玩记录已导出', result.path, 'CSV 可用 Excel 或文本编辑器打开。');
  }

  /**
   * Merge Steam's own playtime into the library and repaint every surface
   * that prints hours. The native side does the same merge at boot and after
   * a session ends; this is the manual escape hatch for a running Steam
   * client that has not flushed its numbers yet.
   */
  function applyPlaytimeUpdates(entries) {
    if (!Array.isArray(entries) || !entries.length) return false;
    let touched = false;
    entries.forEach((entry) => {
      const game = findGame(entry.id);
      if (!game) return;
      if (typeof entry.playtimeSeconds === 'number' && entry.playtimeSeconds > (game.playtimeSeconds || 0)) {
        game.playtimeSeconds = entry.playtimeSeconds;
        touched = true;
      }
      if (entry.lastPlayedUtc) {
        const next = new Date(entry.lastPlayedUtc).getTime();
        const current = game.lastPlayedUtc ? new Date(game.lastPlayedUtc).getTime() : 0;
        if (Number.isFinite(next) && next > current) {
          game.lastPlayedUtc = entry.lastPlayedUtc;
          touched = true;
        }
      }
    });
    if (!touched) return false;
    refreshLive();
    if (state.overlay === 'details') populateDetails(currentGame());
    if (state.view === 'settings') renderSettings();
    return true;
  }

  async function syncSteamPlaytime() {
    audio.select();
    const result = await call('syncSteamPlaytime');
    if (!result || !result.ok) {
      audio.error();
      toast(result?.error || '无法读取 Steam 游玩时间', 'alert');
      return;
    }
    if (!result.steamRoot) {
      toast('没有找到 Steam 安装目录', 'alert');
      return;
    }
    const changed = applyPlaytimeUpdates(result.games || []);
    if (changed) {
      audio.confirm();
      toast(`已同步 ${result.updated} 款游戏的 Steam 游玩时间`, 'check');
    } else {
      audio.select();
      toast('Steam 没有新的游玩记录', 'check');
    }
  }

  async function importPack() {
    if (!window.NovaOverlays || !window.NovaOverlays.pickerOpen) return;
    const path = await window.NovaOverlays.pickerOpen({
      filter: 'pack',
      title: '选择数据包',
      note: '选择 .nova-pack 或 .zip；导入前会自动备份本机库',
      startPath: (state.storage && (state.storage.exports || state.storage.root)) || state.dataFolder || ''
    });
    if (!path) return;
    const mode = await window.NovaOverlays.dialog({
      title: '导入数据包',
      text: '「合并」保留本机游戏并按 Steam ID / 路径 / 名称去重；「替换」用数据包覆盖本机游戏库与设置。导入前会自动备份当前 library.json。',
      icon: 'up',
      actions: [
        { label: '合并到本机', value: 'merge', style: 'primary', icon: 'shuffle' },
        { label: '替换本机库', value: 'replace', icon: 'alert' },
        { label: '取消', value: null }
      ]
    });
    if (!mode) return;
    const result = await call('importPack', { path, mode });
    if (!result || !result.ok) {
      toast(result?.error || '导入失败', 'alert');
      return;
    }
    const missing = result.missing ? `其中 ${result.missing} 款需要重新指定程序路径。` : '所有游戏程序路径都可用。';
    await window.NovaOverlays.dialog({
      title: '导入完成',
      text: `共 ${result.games} 款游戏：新增 ${result.added}，合并 ${result.replaced}，封面 ${result.mediaFiles} 个。${missing}`,
      icon: 'check',
      actions: [{ label: '重新载入界面', value: 'reload', style: 'primary' }]
    });
    location.reload();
  }


  function openAppearance() {
    if (state.overlay) return;
    closePopovers();
    setView('appearance');
  }

  function closeAppearance(options = {}) {
    if (state.view !== 'appearance') return;
    setView('home');
  }

  function openSettings() {
    if (state.overlay) return;
    closePopovers();
    setView('settings');
  }

  function closeSettings() {
    if (state.view !== 'settings') return;
    setView('home');
  }

