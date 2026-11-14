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
    /* A finished download is a ready-to-install build: the only useful action
       left is the one that swaps the exe and relaunches on it. */
    if (els.updateApplyBtn) {
      const ready = (info.phase === 'done' || info.phase === 'restarting') && !!info.path;
      els.updateApplyBtn.hidden = !ready;
      els.updateApplyBtn.disabled = info.phase === 'restarting';
    }
    if (els.updateFolderBtn) els.updateFolderBtn.hidden = info.phase !== 'done';
    if (els.updateProgress) els.updateProgress.hidden = info.phase !== 'downloading';
    if (els.updateState) {
      els.updateState.textContent =
        info.phase === 'checking' ? '正在检查更新…'
          : info.phase === 'downloading' ? `正在下载 ${info.name || '更新包'}…`
            : info.phase === 'restarting' ? '正在替换程序并重启…'
              : info.phase === 'result' && info.available ? `发现新版本 v${info.latest} · 当前 v${info.current}`
                : info.phase === 'result' ? `已是最新 · v${info.current}`
                  : info.phase === 'done' ? `新版本${info.latest ? ` v${info.latest} ` : ''}已下载 · 重启后自动完成升级`
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
    /* One visible button in a two-column grid sits alone on its row at half
       width, which reads like a broken layout. Let it take the whole row. */
    if (els.updateButtons) {
      const shown = [els.updateCheckBtn, els.updateDownloadBtn, els.updateApplyBtn, els.updateFolderBtn]
        .filter((button) => button && !button.hidden).length;
      els.updateButtons.classList.toggle('is-solo', shown === 1);
    }
  }

  /** Host status messages carry the run they belong to. Anything older than the
   *  run already on screen is dropped: a slow check, or a cancelled download
   *  reporting late, used to repaint the panel with a result the player had
   *  already replaced (§1.41.5). */
  function acceptUpdateSeq(payload) {
    const seq = Number(payload && payload.seq);
    if (!Number.isFinite(seq) || seq <= 0) return true;  // host without seq
    if (seq < state.updateSeq) return false;
    state.updateSeq = seq;
    return true;
  }

  /** "GUGUOVA-1.18.0-single.exe" → [1,18,0]; null when no version is readable. */
  function versionFromAssetName(name) {
    const match = String(name || '').match(/(\d+)\.(\d+)(?:\.(\d+))?/);
    if (!match) return null;
    return [Number(match[1]), Number(match[2]), Number(match[3] || 0)];
  }

  function versionParts(value) {
    const match = String(value || '').match(/(\d+)\.(\d+)(?:\.(\d+))?/);
    if (!match) return [0, 0, 0];
    return [Number(match[1]), Number(match[2]), Number(match[3] || 0)];
  }

  function versionIsNewer(left, right) {
    const a = Array.isArray(left) ? left : versionParts(left);
    const b = Array.isArray(right) ? right : versionParts(right);
    for (let i = 0; i < 3; i += 1) {
      if (a[i] !== b[i]) return a[i] > b[i];
    }
    return false;
  }

  /**
   * A package sitting in updates/ that nobody installed means the swap never
   * completed (blocked script, killed waiter, reboot mid-upgrade). The panel
   * opens on "已下载 · 重启后自动完成升级" instead of pretending nothing
   * happened, so the player is one click from finishing it (§1.41.5).
   */
  function adoptPendingUpdate(pending) {
    if (!pending || !pending.path) return false;
    const version = versionFromAssetName(pending.name);
    if (!version || !versionIsNewer(version, state.version)) return false;
    state.update = {
      phase: 'done',
      path: pending.path,
      name: pending.name,
      latest: version.join('.')
    };
    updateRender();
    // A package that never got installed is worth a badge on the bell: the
    // player closed the app mid-upgrade and nothing else would remind them.
    noticeUpdate(version.join('.'), state.version, 'done');
    return true;
  }

  function onUpdateStatus(payload) {
    if (!acceptUpdateSeq(payload)) return;
    const { seq, ...rest } = payload;
    state.update = { ...(state.update || {}), ...rest };
    updateRender();
    if (payload.phase === 'result' && payload.available) {
      toast(`发现新版本 v${payload.latest} · 设置里可下载`, 'cloud');
      noticeUpdate(payload.latest, payload.current, 'result');
    } else if (payload.phase === 'done') {
      toast('更新包已下载', 'check');
      noticeUpdate(payload.latest || (state.update || {}).latest, state.version, 'done');
    } else if (payload.phase === 'error') {
      toast(payload.error || '更新检查失败', 'alert');
    }
  }

  /**
   * The check runs on its own (or silently after boot), so a toast that fades
   * in six seconds was the only trace a new version existed. A notice keeps it
   * in the bell until the player acts, and clicking it lands on the update
   * block instead of asking them to go find it.
   * One notice per version per run: the daily check re-fires on every focus.
   */
  function noticeUpdate(latest, current, phase) {
    const version = String(latest || '').trim();
    if (!version) return;
    const key = `${version}:${phase}`;
    if (state.updateNotice === key) return;
    state.updateNotice = key;
    if (phase === 'done') {
      pushNotice({
        title: `更新包已就绪 · v${version}`,
        sub: '到「设置 → 关于」点「重启并升级」就能换上',
        icon: 'check',
        color: 'var(--accent-text, var(--accent))',
        action: 'update'
      });
      return;
    }
    pushNotice({
      title: `检测到新版本 v${version}`,
      sub: `当前 v${current || state.version} · 点这里去「设置 → 关于」下载`,
      icon: 'cloud',
      color: 'var(--accent-text, var(--accent))',
      action: 'update'
    });
  }

  /** Jump to the version block from a notification. */
  function revealUpdateBlock() {
    const block = els.settingsUpdateBlock;
    if (!block) return;
    try {
      block.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } catch (error) {
      block.scrollIntoView();
    }
    block.classList.add('is-flash');
    setTimeout(() => block.classList.remove('is-flash'), 1400);
    if (els.updateCheckBtn && !els.updateCheckBtn.hidden) {
      try { els.updateCheckBtn.focus({ preventScroll: true }); } catch (error) {}
    }
  }

  function onUpdateProgress(payload) {
    if (!acceptUpdateSeq(payload)) return;
    const percent = Math.max(0, Math.min(100, payload.percent || 0));
    if (els.updateProgressFill) els.updateProgressFill.style.width = `${percent}%`;
    if (els.updateProgressPct) els.updateProgressPct.textContent = `${percent}%`;
  }

  async function checkForUpdates() {
    const phase = (state.update || {}).phase;
    // Clicking twice queues two checks whose answers race each other.
    if (phase === 'checking' || phase === 'downloading') return;
    const result = await call('checkUpdate');
    if (result && result.ok === false) toast(result.error || '无法启动检查', 'alert');
  }

  /**
   * Replace the running exe with the downloaded build and come back up on it.
   * Windows will not let a process overwrite its own image, so the native side
   * leaves a detached waiter behind: it waits for this process to exit, swaps
   * the file, wipes the download cache and starts the new build. The page only
   * has to ask — the app closes itself a moment later.
   */
  async function applyUpdateAndRestart() {
    const info = state.update || {};
    if (!info.path) {
      audio.error();
      toast('没有已下载的更新包', 'alert');
      return;
    }
    const label = info.latest ? `v${info.latest}` : '新版本';
    /* A running game is allowed to keep running — the launcher is not the game —
       but this process owns the play clock and the scaling engine, so both stop
       the moment the window closes. Naming the games beats a generic "请先退出
       游戏" the player has no way to act on (§1.41.5). */
    const running = [...state.running.keys()].map((id) => findGame(id)).filter(Boolean);
    const runningNote = running.length
      ? `\n注意：${running.map((game) => `《${shortName(game) || game.name}》`).join('、')}正在运行。启动器退出后这次游玩将不再计时（游戏本身不受影响）。`
      : '';
    const choice = await window.NovaOverlays.dialog({
      title: `重启并升级到 ${label}`,
      text: '启动器会关闭，用下载好的版本替换当前程序，然后自动重新打开。游戏库、主题与设置都不会改动，下载的安装包会在替换后清理。' + runningNote,
      icon: 'up',
      actions: [
        { label: running.length ? '结束计时并升级' : '重启并升级', value: 'go', style: 'primary' },
        { label: '稍后再说', value: null }
      ]
    });
    if (choice !== 'go') return;
    audio.select();
    state.update = { ...info, phase: 'restarting' };
    updateRender();
    const result = await call('applyUpdate', { path: info.path });
    if (!result || !result.ok) {
      state.update = { ...info, phase: 'done' };
      updateRender();
      audio.error();
      toast(result?.error || '无法自动升级，请手动运行下载的安装包', 'alert');
    }
    // On success the host exits within a second; nothing else to do here.
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
   * 反馈用：一份描述「当时在跑什么」的 txt——版本、宿主、系统、WebView2、
   * 档位、主题、库规模，加上 nova.log 末尾 400 行与最近报错。玩家把这个
   * 文件发过来，绝大部分「打不开 / 卡住 / 闪退」就能直接定位。
   */
  async function exportDiagnostics() {
    if (els.settingsExportLog && els.settingsExportLog.disabled) return;
    audio.select();
    const button = els.settingsExportLog;
    const label = button ? button.querySelector('span') : null;
    if (button) button.disabled = true;
    if (label) label.textContent = '正在整理…';
    const result = await call('exportLog');
    if (button) button.disabled = false;
    if (label) label.textContent = '导出启动器日志';
    if (!result || !result.ok) {
      audio.error();
      toast(result?.error || '导出日志失败', 'alert');
      return;
    }
    await showExportResult('启动器日志已导出', result.path,
      `${formatBytes(result.size)} · 把这个 txt 直接发给作者，里面没有存档、封面和账号信息。`);
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

