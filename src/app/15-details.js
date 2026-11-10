/* ============================================================
   APP PART 15 · details —— 游戏详情页 + 管理面板 MANAGE（统计、Steam 启动、隐藏开关）
   这是 src/app/ 分片之一：由 tools/build-app.js 按文件名序拼回 src/app.js。
   所有分片共享同一个 IIFE 闭包（跨分片直接引用函数与 state）。
   改代码请改分片，改完运行 node tools/build-app.js；直接编辑 app.js 会被覆盖。
   ============================================================ */

  /* ============================================================
     DETAILS
     ============================================================ */

  /** The last five real sessions, newest first. Stored by the host on every
   * clean or crashed exit; this is the "what did I actually play" view. */
  function renderDetailSessions(game) {
    if (!els.detailSessions) return;
    const sessions = Array.isArray(game.recentSessions) ? game.recentSessions : [];
    if (!sessions.length) {
      els.detailSessions.hidden = true;
      els.detailSessions.innerHTML = '';
      return;
    }

    const rows = sessions
      .slice()
      .sort((a, b) => String(b.startedUtc || '').localeCompare(String(a.startedUtc || '')))
      .map((session) => {
        const when = session.startedUtc ? new Date(session.startedUtc) : null;
        const label = when && !Number.isNaN(when.getTime())
          ? `${when.getMonth() + 1}月${when.getDate()}日 ${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`
          : '未知时间';
        return `
          <div class="session-row${session.crashed ? ' is-crashed' : ''}">
            <span class="session-when">${esc(label)}</span>
            <span class="session-len">${esc(formatHoursShort(session.seconds || 0))}</span>
            <span class="session-flag">${session.crashed ? '异常退出' : ''}</span>
          </div>`;
      })
      .join('');

    els.detailSessions.innerHTML = `
      <div class="session-head"><span>最近记录</span><span>时长</span><span></span></div>
      ${rows}`;
    els.detailSessions.hidden = false;
  }

  function updateDetailStatus(game) {
    els.detailStatus.classList.remove('is-update', 'is-offline');
    if (!game) {
      els.detailStatusText.textContent = '没有游戏';
      els.detailStatus.classList.add('is-offline');
      return;
    }
    if (state.running.has(game.id)) {
      els.detailStatusText.textContent = '运行中';
      els.detailStatus.classList.add('is-update');
    } else if (!game.exists) {
      els.detailStatusText.textContent = '程序缺失';
      els.detailStatus.classList.add('is-offline');
    } else {
      els.detailStatusText.textContent = '已就绪';
    }
  }

  function updateDetailProgress(game) {
    const info = progressInfo(game);
    els.dProgressLabel.textContent = info.title;
    els.dProgressPct.textContent = info.pctText;
    els.dProgressFill.style.width = `${info.pct}%`;
    applyTier(els.dProgressFill.parentElement, game);
    // The stat grid below already reports totals; keep this line operational,
    // with the next colour node pre-announced (user decision: detail only).
    els.dProgressSub.textContent = state.running.has(game.id)
      ? '游戏运行中'
      : game.exists
        ? ((game.playtimeSeconds || 0) > 0 ? `可随时启动 · ${nextTierText(game.playtimeSeconds)}` : '可随时启动')
        : '需要在管理里重新指定程序';
  }

  function populateDetails(game) {
    const oldImage = $('img.detail-art-img', els.detailArt);
    if (oldImage) oldImage.remove();

    if (!game) {
      els.detailArt.style.setProperty('--detail-bg', 'url("assets/backdrop.jpg")');
      setLogo(els.detailLogo, null, 'detail-logo');
      els.detailZh.textContent = 'GUGUOVA';
      els.detailTitle.textContent = '还没有游戏';
      els.detailTagline.textContent = '添加一个游戏程序开始使用。';
      els.detailMeta.innerHTML = metaHTML(null);
      els.detailDesc.textContent = '';
      els.detailStats.innerHTML = '';
      els.detailPath.textContent = '—';
      updateDetailStatus(null);
      syncDetailScaleRow();
      return;
    }

    els.detailArt.style.setProperty('--detail-bg', `url("${game.heroUrl}")`);
    const image = document.createElement('img');
    image.className = 'detail-art-img';
    image.alt = `${game.zh || game.name} 主视觉`;
    image.src = game.heroUrl;
    applyHeroFraming(image, framingFor(game));
    image.draggable = false;
    els.detailArt.insertBefore(image, els.detailArt.firstChild);

    setLogo(els.detailLogo, game, 'detail-logo');
    els.detailZh.textContent = fullName(game) || game.name;
    els.detailTitle.textContent = game.zh || game.name;
    els.detailTagline.textContent = game.tagline || '';
    els.detailMeta.innerHTML = metaHTML(game);
    els.detailDesc.textContent = game.description || '';

    renderDetailSessions(game);
    els.detailStats.innerHTML = [
      ['累计游玩', game.playtimeSeconds ? formatHours(game.playtimeSeconds) : '还没玩过'],
      ['最近游玩', game.lastPlayedUtc ? relativeTime(game.lastPlayedUtc) : '尚未游玩'],
      ['启动次数', `${game.launchCount || 0} 次`],
      ['来源', sourceLabel(game)]
    ].map(([label, value]) => `
      <div class="stat">
        <div class="stat-label">${esc(label)}</div>
        <div class="stat-value">${esc(value)}</div>
      </div>
    `).join('');

    els.detailPath.textContent = game.exePath || '（未设置）';
    els.detailPath.title = game.exePath || '';
    els.revealBtn.hidden = !game.exists;

    els.detailFav.classList.toggle('active', !!game.favorite);
    els.detailFav.setAttribute('aria-pressed', String(!!game.favorite));

    updatePrimaryButton(els.detailPlay, els.detailPlayLabel, game);
    updateDetailStatus(game);
    updateDetailProgress(game);
    syncDetailScaleRow();
    syncManageHiddenRow();

    closeManage({ silent: true });
    els.detailManageLabel.textContent = '管理';
    els.detailManage.setAttribute('aria-expanded', 'false');

    const dialog = $('.detail-modal', els.detailsOverlay);
    if (dialog) dialog.setAttribute('aria-label', `${game.zh || game.name} · 游戏详情`);
  }

  /* ---------- launch display options ---------- */

  /** A per-game choice wins; without one the switch follows the shell mode,
      which is what "沉浸式默认勾选" means. */
  function fullscreenScaleFor(game) {
    if (!game) return false;
    if (typeof game.fullscreenScale === 'boolean') return game.fullscreenScale;
    return !!state.fullscreen;
  }

  /** Name the active scaling mode in plain words. The per-game tick box only
      says *whether* to scale; the row still has to show that fullscreen
      scaling is alive (and which mode is in force) without a settings trip. */
  function scaleModeLabel() {
    const settings = state.settings || {};
    if (settings.scaleMode === 'factor') {
      const factor = Number(settings.scaleFactor) || 2;
      const text = Number.isInteger(factor) ? String(factor) : String(Number(factor.toFixed(2)));
      return `倍数缩放 ${text} 倍`;
    }
    return '全屏缩放';
  }

  /** The engine sheet (opened from the home "缩放设置" button) carries the
      same per-game tick box, so deciding whether this game should be scaled
      never requires a trip into the detail page. */
  function syncEngineScaleRow() {
    if (!els.engineScaleRow) return;
    const game = currentGame();
    const disabled = state.settings.scalingEngine === 'off';
    const explicit = !!(game && typeof game.fullscreenScale === 'boolean');
    els.engineScaleRow.disabled = disabled;
    els.engineScaleRow.setAttribute('aria-disabled', String(disabled));
    setPrefSwitch(els.engineScaleRow, els.engineScaleCheck, !disabled && fullscreenScaleFor(game));
    if (els.engineScaleHint) {
      els.engineScaleHint.textContent = disabled
        ? '已在设置中关闭'
        : `${scaleModeLabel()} · ${explicit ? '仅此游戏' : '默认开启'}`;
    }
  }

  function syncHeroScaleRow() {
    if (!els.homeScaleRow) return;
    const game = currentGame();
    const disabled = state.settings.scalingEngine === 'off';
    const explicit = !!(game && typeof game.fullscreenScale === 'boolean');
    els.homeScaleRow.hidden = !game;
    els.homeScaleRow.disabled = disabled;
    els.homeScaleRow.setAttribute('aria-disabled', String(disabled));
    setPrefSwitch(els.homeScaleRow, els.homeScaleSwitch, !disabled && fullscreenScaleFor(game));
    if (els.homeScaleHint) {
      els.homeScaleHint.textContent = disabled
        ? '已在设置中关闭'
        : `${scaleModeLabel()} · ${explicit ? '仅此游戏' : '默认开启'}`;
    }
    syncEngineScaleRow();
  }

  async function toggleHeroScale() {
    const game = currentGame();
    if (!game || state.settings.scalingEngine === 'off') return;
    const next = !fullscreenScaleFor(game);
    game.fullscreenScale = next;
    syncHeroScaleRow();
    syncDetailScaleRow();
    audio.toggle();
    const result = await call('updateGame', { id: game.id, fullscreenScale: next });
    if (!result || !result.ok) {
      game.fullscreenScale = null;
      syncHeroScaleRow();
      syncDetailScaleRow();
      audio.error();
      toast(result?.error || '无法保存缩放设置', 'alert');
      return;
    }
    if (result.game) Object.assign(game, result.game);
    syncHeroScaleRow();
    syncDetailScaleRow();
  }

  function syncDetailScaleRow() {
    if (!els.detailScaleRow) return;
    const game = currentGame();
    const explicit = !!(game && typeof game.fullscreenScale === 'boolean');
    const disabled = state.settings.scalingEngine === 'off';
    els.detailScaleRow.disabled = disabled;
    els.detailScaleRow.setAttribute('aria-disabled', String(disabled));
    setPrefSwitch(els.detailScaleRow, els.detailScaleSwitch, !disabled && fullscreenScaleFor(game));
    if (els.detailScaleHint) {
      els.detailScaleHint.textContent = disabled
        ? '已在设置中关闭'
        : explicit
          ? '仅对这款游戏生效'
          : (state.fullscreen ? '沉浸模式下默认开启' : '全屏显示时默认开启');
    }
    syncEngineScaleRow();
  }

  async function toggleDetailScale() {
    const game = currentGame();
    if (!game) return;
    const next = !fullscreenScaleFor(game);
    game.fullscreenScale = next;
    syncDetailScaleRow();
    audio.toggle();
    const result = await call('updateGame', { id: game.id, fullscreenScale: next });
    if (!result || !result.ok) {
      game.fullscreenScale = null;
      syncDetailScaleRow();
      audio.error();
      toast(result?.error || '无法保存缩放设置', 'alert');
      return;
    }
    if (result.game) Object.assign(game, result.game);
    syncDetailScaleRow();
    toast(next ? '启动时按设置缩放' : '启动时保持窗口大小', 'fullscreen');
  }

  /* ---------- hidden game ---------- */

  function syncManageHiddenRow() {
    if (!els.manageHiddenRow) return;
    const game = currentGame();
    const hidden = !!(game && game.hidden);
    setPrefSwitch(els.manageHiddenRow, els.manageHiddenSwitch, hidden);
    if (els.manageHiddenHint) {
      els.manageHiddenHint.textContent = hidden
        ? '已隐藏 · 在游戏库的「隐藏」筛选中可见'
        : '隐藏后不在游戏库列表中显示';
    }
  }

  async function toggleManageHidden() {
    const game = currentGame();
    if (!game) return;
    const next = !game.hidden;
    game.hidden = next;
    syncManageHiddenRow();
    audio.toggle();
    const result = await call('updateGame', { id: game.id, hidden: next });
    if (!result || !result.ok) {
      game.hidden = !next;
      syncManageHiddenRow();
      audio.error();
      toast(result?.error || '无法保存隐藏设置', 'alert');
      return;
    }
    if (result.game) Object.assign(game, result.game);
    syncManageHiddenRow();
    // Take the tile off the shelf right away; waiting for the next library
    // rebuild left a hidden game sitting in the home strip.
    rebuildAfterLibraryChange(false);
    toast(next
      ? `《${shortName(game)}》已隐藏 · 游戏库右上角「隐藏」可查看`
      : `《${shortName(game)}》已恢复显示`, 'check');
  }

  function openDetails() {
    if (state.overlay) return;
    if (!state.games.length) {
      openEditor();
      return;
    }
    state.lastFocus = document.activeElement;
    closePopovers();
    populateDetails(currentGame());
    state.overlay = 'details';
    openSurface('details');
    setNav(state.view);
    audio.select();
    setTimeout(() => {
      try { els.detailsClose.focus({ preventScroll: true }); } catch (error) {}
    }, 90);
    setTimeout(refitLogos, 140);
  }

  function closeDetails(options = {}) {
    if (state.overlay !== 'details') return;
    const { focus = true, sound = true } = options;
    const wasHidden = !!(currentGame() && currentGame().hidden);
    closeManage({ silent: true });
    closeSurface('details');
    state.overlay = null;
    if (sound) audio.close();
    if (focus) restoreFocus();
    // Leaving the sheet is when a just-hidden game actually leaves the stage.
    if (wasHidden) rebuildAfterLibraryChange(false);
  }

  async function toggleFavorite(game) {
    if (!game) return;
    const result = await call('setFavorite', { id: game.id });
    if (result && result.ok) {
      game.favorite = result.favorite;
    } else {
      game.favorite = !game.favorite;
    }
    els.detailFav.classList.toggle('active', game.favorite);
    els.detailFav.setAttribute('aria-pressed', String(game.favorite));
    audio.select();
    toast(game.favorite ? `已收藏《${shortName(game)}》` : `已取消收藏《${shortName(game)}》`, 'heart');
    if (state.view === 'library') renderLibrary();
    updateRail();
  }

  /* ============================================================
     MANAGE
     ============================================================ */

  function fillManage() {
    const game = currentGame();
    if (!game) return;
    const clientLabel = game.launchModeResolved === 'platform' ? sourceLabel(game) : 'Steam';
    const modeLabel = game.launchMode === 'steam' ? '走 Steam 客户端'
      : game.launchMode === 'platform' ? `走 ${clientLabel}`
      : game.launchMode === 'direct' ? '直接启动'
      : '自动';
    const launchDetail = game.launchModeResolved === 'steam' ? ' steam://'
      : game.launchModeResolved === 'platform' ? ' 平台协议'
      : ' 进程';
    const sourceDetail = isPlatformGame(game)
      ? `${sourceLabel(game)}${game.platformId ? ` · ${game.platformId}` : ''}`
      : '手动添加';
    els.manageStats.innerHTML = [
      ['运行时程序', game.exePath ? (game.exePath.length > 34 ? `…${game.exePath.slice(-33)}` : game.exePath) : '未设置'],
      ['启动方式', `${modeLabel} ·${launchDetail}`],
      ['启动参数', game.args || '无'],
      ['工作目录', game.workDir || '与程序相同'],
      ['版本 / 来源', sourceDetail]
    ].map(([label, value]) => `<div class="manage-stat"><span>${esc(label)}</span><b title="${esc(value)}">${esc(value)}</b></div>`).join('');

    fillSteamPanel(game);
    els.resetArtRow.hidden = !game.exists;
    if (els.refreshArtRow) els.refreshArtRow.hidden = !game.steamAppId;
    resetRemoveConfirm();
  }

  /**
   * Whether an entry can start without the client is a property of the exe,
   * not of how it was imported, so the panel reports the probed dependency
   * instead of assuming every Steam entry needs Steam.
   */
  function fillSteamPanel(game) {
    const panel = els.manageSteam;
    if (!panel) return;
    const owned = isPlatformGame(game);
    const show = owned || !!game.steamAppId || game.launchMode !== 'auto';
    panel.hidden = !show;
    if (!show) return;

    // The same panel serves every client: Steam reports presence and login,
    // the other launchers only have "the game has a protocol target".
    const usesSteam = game.source === 'steam' || (!owned && !!game.steamAppId);
    const clientName = usesSteam ? 'Steam' : sourceLabel(game);

    let stateText;
    let tone = 'warn';
    if (usesSteam) {
      stateText = game.steamRunning
        ? (game.steamSignedIn ? 'Steam 运行中 · 已登录' : 'Steam 运行中 · 未登录')
        : 'Steam 未运行';
      if (game.steamRunning && game.steamSignedIn) tone = 'ok';
    } else if (game.hasLaunchUri && game.clientInstalled === false) {
      stateText = `未检测到 ${clientName} 客户端`;
      tone = 'warn';
    } else if (game.hasLaunchUri) {
      stateText = `通过 ${clientName} 启动`;
      tone = 'ok';
    } else {
      stateText = '直接启动 · 无需客户端';
    }

    if (els.manageSteamTitle) els.manageSteamTitle.textContent = `${clientName} 启动`;
    els.manageSteamState.textContent = stateText;
    els.manageSteamState.dataset.on = tone;
    els.manageSteamNote.textContent = usesSteam
      ? (game.steamNote || '')
      : (game.hasLaunchUri
        ? `交给 ${clientName} 启动，云端存档与平台功能照常可用。`
        : '这款游戏没有记录平台启动地址，只能从程序本身启动。');

    // "走客户端" is only meaningful when there is an id or URL to hand over.
    const clientMode = usesSteam ? 'steam' : 'platform';
    if (els.manageModeClient) {
      els.manageModeClient.dataset.mode = clientMode;
      els.manageModeClient.textContent = usesSteam ? '走 Steam' : `走 ${clientName}`;
    }

    const active = game.launchMode || 'auto';
    for (const button of els.manageSteamModes.querySelectorAll('.steam-mode')) {
      const on = button.dataset.mode === active;
      button.classList.toggle('is-active', on);
      button.setAttribute('aria-pressed', String(on));
      // A packaged (Xbox) exe lives behind WindowsApps ACLs — "直接启动" is
      // not an option, the shell hand-off is the only path.
      button.disabled = (button.dataset.mode === 'steam' && !game.steamAppId) ||
        (button.dataset.mode === 'direct' && game.source === 'xbox');
    }
    if (els.manageModeClient) els.manageModeClient.disabled = !game.hasLaunchUri && !game.steamAppId;
  }

  async function setLaunchMode(mode) {
    const game = currentGame();
    if (!game || !mode || mode === game.launchMode) return;
    const result = await call('updateGame', { id: game.id, launchMode: mode });
    if (!result || !result.ok) {
      toast(result?.error || '无法切换启动方式', 'alert');
      audio.error();
      return;
    }
    Object.assign(game, result.game);
    fillManage();
    audio.select();
  }

  function openManage() {
    if (state.overlay !== 'details' || state.manageOpen) return;
    state.manageOpen = true;
    els.detailsOverlay.classList.add('is-managing');
    els.managePanel.hidden = false;
    setManageBodyCollapsed(false);
    els.detailManageLabel.textContent = '收起';
    els.detailManage.setAttribute('aria-expanded', 'true');
    fillManage();
    audio.select();
    setTimeout(() => {
      try { els.managePanel.scrollIntoView({ behavior: state.settings.reduceMotion ? 'auto' : 'smooth', block: 'nearest' }); } catch (error) {}
    }, 40);
  }

  /** The manage panel folds under its own title bar: the body hides, the
      header stays as the toggle. Opening via 管理 always expands. */
  function setManageBodyCollapsed(collapsed) {
    state.manageCollapsed = !!collapsed;
    if (els.manageBody) els.manageBody.hidden = state.manageCollapsed;
    if (els.manageToggle) els.manageToggle.setAttribute('aria-expanded', String(!state.manageCollapsed));
  }

  function closeManage(options = {}) {
    if (!state.manageOpen) {
      if (!options.silent) return;
      els.detailsOverlay.classList.remove('is-managing');
      els.managePanel.hidden = true;
      els.detailManageLabel.textContent = '管理';
      els.detailManage.setAttribute('aria-expanded', 'false');
      return;
    }
    state.manageOpen = false;
    resetRemoveConfirm();
    els.detailsOverlay.classList.remove('is-managing');
    els.managePanel.hidden = true;
    els.detailManageLabel.textContent = '管理';
    els.detailManage.setAttribute('aria-expanded', 'false');
    if (!options.silent) audio.back();
  }

  function resetRemoveConfirm() {
    state.removeArmed = false;
    clearTimeout(state.removeTimer);
    els.removeGameBtn.classList.remove('is-confirming');
    els.removeGameBtn.textContent = '从游戏库移除';
  }

  async function handleRemoveGame() {
    const game = currentGame();
    if (!game) return;
    if (!state.removeArmed) {
      state.removeArmed = true;
      els.removeGameBtn.textContent = '再次点击确认移除';
      els.removeGameBtn.classList.add('is-confirming');
      clearTimeout(state.removeTimer);
      state.removeTimer = setTimeout(resetRemoveConfirm, 3200);
      return;
    }
    const result = await call('deleteGame', { id: game.id });
    if (!result || !result.ok) {
      toast(result?.error || '移除失败', 'alert');
      return;
    }
    const index = state.games.findIndex((entry) => entry.id === game.id);
    if (index >= 0) state.games.splice(index, 1);
    state.running.delete(game.id);
    if (state.index >= state.games.length) state.index = Math.max(0, state.games.length - 1);
    closeDetails({ focus: false, sound: false });
    rebuildAfterLibraryChange();
    audio.select();
    toast(`已从游戏库移除《${shortName(game)}》`, 'check');
  }

  async function refreshSteamArtwork() {
    const game = currentGame();
    if (!game) return;
    if (!game.steamAppId) {
      audio.error();
      toast('这款游戏没有 Steam AppID，无法从 Steam 取封面', 'alert');
      return;
    }
    audio.select();
    toast('正在从 Steam 重新导入封面…', 'spark');
    const result = await call('refreshArtwork', { id: game.id });
    if (!result || !result.ok) {
      audio.error();
      toast(result?.error || '重新导入失败', 'alert');
      return;
    }
    if (!result.updated) {
      audio.error();
      toast('Steam 缓存里没有找到这款游戏的封面；先在 Steam 里打开一次游戏库', 'alert');
      return;
    }
    const boot = await call('boot');
    if (boot && boot.games) {
      const fresh = boot.games.find((entry) => entry.id === game.id);
      if (fresh) Object.assign(game, fresh);
      state.games = boot.games;
    }
    audio.confirm();
    toast('已用 Steam 的最新封面替换', 'check');
    rebuildAfterLibraryChange(false);
    if (state.overlay === 'details') populateDetails(currentGame());
    if (currentGame()) setBackdrop(currentGame(), true);
  }

  async function resetArtwork() {
    const game = currentGame();
    if (!game) return;
    toast('正在从程序图标重新生成封面…', 'image');
    const result = await call('updateGame', { id: game.id, resetArt: true });
    if (!result || !result.ok) {
      toast(result?.error || '重新生成失败', 'alert');
      return;
    }
    Object.assign(game, result.game);
    populateDetails(game);
    rebuildAfterLibraryChange(false);
    applyAccent(game);
    renderHero(game, false);
    audio.select();
    toast('封面已重新生成', 'image');
  }
