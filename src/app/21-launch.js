/* ============================================================
   APP PART 21 · launch —— 启动管线 —— 分离启动器、进程附着、会话与覆盖层文案
   这是 src/app/ 分片之一：由 tools/build-app.js 按文件名序拼回 src/app.js。
   所有分片共享同一个 IIFE 闭包（跨分片直接引用函数与 state）。
   改代码请改分片，改完运行 node tools/build-app.js；直接编辑 app.js 会被覆盖。
   ============================================================ */

  /* ============================================================
     LAUNCH
     ============================================================ */

  function clearLaunchTimers() {
    state.launchTimers.forEach((timer) => clearTimeout(timer));
    state.launchTimers = [];
  }

  const launchSteps = () => Array.from(els.launchSteps.children);

  function setLaunchProgress(percent) {
    const value = Math.max(0, Math.min(100, percent));
    const circumference = 540.35;
    if (els.launchRing) els.launchRing.style.strokeDashoffset = String(circumference * (1 - value / 100));
    if (els.launchRingLabel) els.launchRingLabel.textContent = `${Math.round(value)}%`;
  }

  function setLaunchStep(index) {
    launchSteps().forEach((step, i) => {
      step.classList.toggle('is-active', i === index);
      step.classList.toggle('is-done', i < index);
    });
  }

  async function launchGame(game) {
    if (state.overlay === 'launch' || !game) return;
    if (state.running.has(game.id)) {
      toast(`《${shortName(game)}》正在运行中`, 'gamepad');
      return;
    }
    if (!game.exists) {
      toast('找不到游戏程序，请在管理面板中重新指定', 'alert');
      openDetails();
      setTimeout(openManage, 180);
      return;
    }

    // Steam games are where a leftover RUNASADMIN flag shows up as an UAC
    // prompt on every launch. Offer the one-time repair before the overlay.
    if (game.launchModeResolved === 'steam') {
      await refreshSteamPrivilege();
      if (state.steamPrivilege?.needsFix && !state.steamPrivilegeMuted) {
        const proceed = await ensureSteamPrivilege();
        if (!proceed) return;
      }
    }

    closePopovers();
    clearLaunchTimers();
    state.launchHandoffScheduled = false;

    els.launchArt.src = game.heroUrl;
    applyHeroFraming(els.launchArt, framingFor(game), true);
    els.launchArt.alt = `${game.zh || game.name} 启动画面`;
    setLogo(els.launchLogo, game, 'launch-logo');
    els.launchZh.textContent = fullName(game);
    els.launchKicker.textContent = game.launchCount > 0 ? '继续' : '开始';
    els.launchStatus.textContent = '正在启动…';
    els.launchSystem.textContent = '启动中';
    els.launchFootMeta.textContent = game.playtimeSeconds > 0
      ? `累计 ${formatHours(game.playtimeSeconds)} · 本次会计入`
      : '本次时长会计入统计';
    // Esc is the keyboard exit; a connected pad gets its own Back hint.
    if (els.launchHint) {
      els.launchHint.textContent = (window.NovaPad && window.NovaPad.connected) ? '按 B 退出' : '按 Esc 退出';
    }
    setLaunchProgress(12);
    setLaunchStep(0);

    els.launchOverlay.classList.remove('is-open', 'is-ready', 'is-leaving', 'is-error', 'is-igniting');
    void els.launchOverlay.offsetWidth;

    state.lastFocus = els.playBtn;
    state.overlay = 'launch';
    document.body.dataset.overlay = 'launch';
    els.launchOverlay.classList.add('is-open', 'is-igniting');
    els.launchOverlay.setAttribute('aria-hidden', 'false');
    els.app.inert = true;
    audio.launch();
    try { els.launchOverlay.focus({ preventScroll: true }); } catch (error) {}
    refreshPadHints();
    state.launchTimers.push(setTimeout(() => {
      els.launchOverlay.classList.remove('is-igniting');
    }, motionMs('cinematic', 900)));

    // Step 1 — load info. The visual sequence runs on wall-clock timers so
    // it feels the same whether the process starts in 80 ms or 4 s.
    state.launchTimers.push(setTimeout(() => {
      setLaunchProgress(42);
      els.launchStatus.textContent = '启动进程…';
      setLaunchStep(1);
    }, state.settings.calm ? 160 : 420));

    const startedAt = performance.now();
    const result = await call('launch', { id: game.id, fullscreenScale: fullscreenScaleFor(game) });
    const ok = result && result.ok;
    const pending = ok && result.pending;

    // Step 2 — the process exists; give the surface a beat to hand over.
    const minimum = state.settings.calm ? 1000 : 1600;
    const elapsed = performance.now() - startedAt;
    const wait = Math.max(0, minimum - elapsed);
    await new Promise((resolve) => setTimeout(resolve, wait));

    if (ok && pending) {
      // Steam owns the launch now. The session appears when the game process
      // shows up, which can be minutes away when the client must log in, so
      // the overlay waits on that event instead of claiming it is running.
      // The separated-launcher flow returns the same shape; the hint tells
      // the two apart.
      const viaLauncher = /启动器|本体/.test(result.hint || '');
      game.launchCount = (game.launchCount || 0) + 1;
      game.lastPlayedUtc = new Date().toISOString();
      setLaunchProgress(70);
      els.launchStatus.textContent = viaLauncher ? '等待游戏本体…' : '等待 Steam…';
      els.launchSystem.textContent = viaLauncher ? '交给启动器' : '交给 Steam';
      els.launchFootMeta.textContent = result.hint
        || (viaLauncher ? '游戏启动器正在启动这款游戏' : 'Steam 正在启动这款游戏');
      setLaunchStep(2);
      state.launchPendingId = game.id;
      state.launchTimers.push(setTimeout(() => {
        setLaunchProgress(100);
        setLaunchStep(3);
        els.launchOverlay.classList.add('is-ready');
        audio.launchReady();
      }, state.settings.calm ? 220 : 520));
      if (state.overlay === 'details') populateDetails(game);
      updateRail();
      refreshLive();
      return;
    }

    if (ok) {
      game.launchCount = (game.launchCount || 0) + 1;
      game.lastPlayedUtc = new Date().toISOString();
      setLaunchProgress(82);
      els.launchStatus.textContent = '进程已创建';
      setLaunchStep(2);
      if (!state.running.has(game.id)) {
        state.running.set(game.id, {
          sessionId: result.sessionId,
          gameId: game.id,
          gameName: game.name,
          startedUtc: new Date().toISOString()
        });
      }
      state.launchTimers.push(setTimeout(() => {
        setLaunchProgress(100);
        setLaunchStep(3);
        els.launchSystem.textContent = '运行中';
        els.launchStatus.textContent = '运行中';
        els.launchOverlay.classList.add('is-ready');
        audio.launchReady();
      }, state.settings.calm ? 220 : 520));
      if (state.overlay === 'details') populateDetails(game);
      updateRail();
      refreshLive();
    } else {
      setLaunchProgress(100);
      els.launchStatus.textContent = result?.error || '启动失败';
      els.launchSystem.textContent = '启动失败';
      els.launchFootMeta.textContent = '请检查可执行文件路径与权限';
      els.launchOverlay.classList.add('is-ready', 'is-error');
      setLaunchStep(-1);
      audio.error();
      toast(result?.error || '启动失败', 'alert');
    }
  }

  /** The host has handed the screen to the game (or gave up waiting). Close
      the in-app launch surface so a later restore does not show it again. */
  function scheduleLaunchHandoff() {
    if (state.overlay !== 'launch' || state.launchHandoffScheduled) return;
    state.launchHandoffScheduled = true;
    const delay = state.settings.calm ? 450 : 950;
    state.launchTimers.push(setTimeout(() => {
      if (state.overlay === 'launch') closeLaunch({ quiet: true });
    }, delay));
  }

  function closeLaunch(options = {}) {
    if (state.overlay !== 'launch') return;
    state.launchHandoffScheduled = false;
    clearLaunchTimers();
    if (options.quiet !== true) audio.exitGame();
    const reduce = state.settings.reduceMotion || state.settings.calm;
    const duration = reduce ? 240 : 900;
    els.launchOverlay.classList.add('is-leaving');
    els.launchOverlay.classList.remove('is-ready', 'is-igniting', 'is-error');

    state.launchTimers.push(setTimeout(() => {
      els.launchOverlay.classList.remove('is-open', 'is-leaving');
      els.launchOverlay.setAttribute('aria-hidden', 'true');
      state.overlay = null;
      els.app.inert = false;
      if (document.body.dataset.overlay === 'launch') delete document.body.dataset.overlay;
      restoreFocus();
      refreshPadHints();
    }, duration));
  }

  function onSessionStarted(payload) {
    if (!payload) return;
    state.running.set(payload.gameId, payload);
    const game = findGame(payload.gameId);
    if (game) {
      game.launchCount = Math.max(game.launchCount || 0, 1);
      game.lastPlayedUtc = new Date().toISOString();
    }
    // A Steam launch waits here: the overlay was already "ready" and now the
    // real process exists, so it can close the way a direct launch would.
    if (state.overlay === 'launch') {
      els.launchProgress && setLaunchProgress(100);
      els.launchStatus.textContent = '运行中';
      els.launchSystem.textContent = '运行中';
      els.launchOverlay.classList.add('is-ready');
    }
    pushNotice({
      icon: 'play',
      color: game?.accent || '#ffb45e',
      title: `${payload.gameName} 已启动`,
      sub: '本次会话正在计时',
      gameId: payload.gameId
    });
    refreshLive();
    if (state.overlay === 'details') populateDetails(currentGame());
    updateRail();
  }

  function onSessionPresented(payload) {
    if (!payload) return;
    if (payload.requested && !payload.scaled && payload.error) {
      const game = findGame(payload.gameId);
      pushNotice({
        icon: 'alert',
        color: game?.accent || '#ffb45e',
        title: `${payload.gameName || (game ? shortName(game) : '游戏')} 的缩放没有生效`,
        sub: payload.error,
        gameId: payload.gameId
      });
    }
    if (state.launchPendingId === payload.gameId) state.launchPendingId = null;
    scheduleLaunchHandoff();
  }

  /** The client accepted the request but the game never appeared — normally a
      login screen or a pending update. Say so instead of blaming the path. */
  function onSessionFailed(payload) {
    if (!payload) return;
    const game = findGame(payload.gameId);
    if (state.launchPendingId === payload.gameId) {
      state.launchPendingId = null;
      if (state.overlay === 'launch') {
        setLaunchProgress(100);
        els.launchStatus.textContent = payload.error || 'Steam 没有启动游戏';
        els.launchSystem.textContent = '未启动';
        els.launchFootMeta.textContent = '可以在「管理」里改用直接启动';
        els.launchOverlay.classList.add('is-ready', 'is-error');
        setLaunchStep(-1);
      }
    }
    pushNotice({
      icon: 'alert',
      color: game?.accent || '#ff9d7a',
      title: `${payload.gameName || '游戏'} 没有启动`,
      sub: payload.error || 'Steam 没有返回游戏进程',
      gameId: payload.gameId
    });
    toast(payload.error || 'Steam 没有启动游戏', 'alert');
  }

  /** Reconciles the running set with the host: the session-started/ended
      pushes can be lost (WebView throttled while minimized, a missed
      dispatcher turn), and a lost end left the launcher claiming a game was
      still running forever. The host is the source of truth; onSessionEnded
      with `reconciled` skips the celebration toast for a session whose
      length we no longer know. */
  let runningSyncBusy = false;
  async function syncRunningFromHost() {
    if (!hasBridge || runningSyncBusy || state.overlay === 'launch') return;
    runningSyncBusy = true;
    try {
      const rows = await call('getRunning');
      const hostIds = new Set();
      for (const row of (Array.isArray(rows) ? rows : [])) {
        const id = row && row.gameId;
        if (!id) continue;
        hostIds.add(id);
        if (!state.running.has(id)) onSessionStarted(row);
      }
      let healed = false;
      for (const [id, session] of Array.from(state.running.entries())) {
        if (hostIds.has(id)) continue;
        onSessionEnded({
          gameId: id,
          gameName: session.gameName || (findGame(id) || {}).name || '',
          seconds: 0,
          crashed: false,
          reconciled: true
        });
        healed = true;
      }
      // The lost end also lost its playtime push: pull the host's numbers.
      if (healed) {
        const boot = await call('boot');
        if (boot && boot.games) applyPlaytimeUpdates(boot.games);
      }
    } catch (error) {
      // Bridge busy or shutting down; the next tick retries.
    } finally {
      runningSyncBusy = false;
    }
  }

  function onSessionEnded(payload) {
    if (!payload) return;
    state.running.delete(payload.gameId);
    const game = findGame(payload.gameId);
    if (game) {
      game.playtimeSeconds = payload.playtimeSeconds ?? (game.playtimeSeconds + payload.seconds);
      game.lastPlayedUtc = new Date().toISOString();
    }
    const spent = formatHours(payload.seconds);
    if (!payload.reconciled) {
      pushNotice({
        icon: payload.crashed ? 'alert' : 'check',
        color: payload.crashed ? '#ff9d7a' : (game?.accent || '#7fe3c0'),
        title: `${payload.gameName} 已结束`,
        sub: payload.crashed ? `进程非正常退出 · 本次 ${spent}` : `本次游玩 ${spent}`,
        gameId: payload.gameId
      });
      if (game && state.overlay !== 'launch') {
        toast(payload.crashed
          ? `《${shortName(game)}》非正常退出 · 已记录 ${spent}`
          : `《${shortName(game)}》已结束 · 本次 ${spent}`, payload.crashed ? 'alert' : 'check');
      }
    }
    refreshLive();
    if (state.overlay === 'details') populateDetails(currentGame());
    updateRail();
  }

  /* keep "运行中" counters fresh every 30 s */
  /** Everything the 30s live refresh can change. When the launcher is idle
      this string does not move, and the refresh must not touch the DOM at
      all — a full renderLibrary() here replayed every card's entry
      animation, which read as "the launcher refreshes itself" while parked
      in the library (user report). */
  function liveSignature() {
    const parts = [state.index, state.games.length];
    for (const game of state.games) {
      parts.push(
        game.id,
        state.running.has(game.id) ? 1 : 0,
        game.playtimeSeconds || 0,
        game.exists ? 1 : 0,
        game.favorite ? 1 : 0,
        game.lastPlayedUtc || '',
        game.launchCount || 0,
        // The mtime-stamped media URL changes whenever the artwork is
        // rewritten — the live patch must follow it or the card keeps the
        // old image until the next full render.
        game.coverUrl || ''
      );
    }
    return parts.join('|');
  }

  /** In-place patch of the library cards' live bits (badges / favourite /
      progress / sub line / CURRENT ring). Same content as renderLibrary's
      template — shared helpers above — but no innerHTML on the grid, so no
      image repaints and no entry-animation replay. */
  function refreshLibraryLive() {
    const featuredId = currentGame()?.id || null;
    els.libGrid.querySelectorAll('.lib-card[data-game]').forEach((card) => {
      const game = findGame(card.dataset.game);
      if (!game) return;
      const featured = game.id === featuredId;
      card.classList.toggle('is-featured', featured);
      const art = $('.lib-art img', card);
      if (art && art.getAttribute('src') !== game.coverUrl) art.src = game.coverUrl || '';
      const badges = $('.lib-badges', card);
      if (badges) badges.innerHTML = libraryBadgesHTML(game, featured);
      const fav = $('.lib-fav', card);
      if (fav) {
        fav.classList.toggle('is-on', !!game.favorite);
        fav.setAttribute('aria-pressed', String(!!game.favorite));
      }
      const progress = $('.lib-progress', card);
      if (progress) {
        progress.style.display = game.exists ? '' : 'none';
        applyTier(progress, game);
        const fill = $('i', progress);
        if (fill) fill.style.width = `${libraryProgressPct(game)}%`;
      }
      const sub = $('.lib-sub', card);
      if (sub) sub.innerHTML = librarySubHTML(game);
    });
    const totalSeconds = state.games.reduce((sum, game) => sum + (game.playtimeSeconds || 0), 0);
    const favorites = state.games.filter((game) => game.favorite).length;
    const platformCount = state.games.filter(isPlatformGame).length;
    const missingCount = state.games.filter((game) => !game.exists).length;
    els.libStats.innerHTML = `
      <span><b>${state.games.length}</b> 款游戏</span>
      <span class="lib-sep"></span>
      <span>累计 <b>${formatHoursShort(totalSeconds)}</b></span>
      <span class="lib-sep"></span>
      <span><b>${platformCount}</b> 款来自平台</span>
      <span class="lib-sep"></span>
      <span><b>${favorites}</b> 款收藏</span>
      ${missingCount ? `<span class="lib-sep"></span><span><b>${missingCount}</b> 款程序缺失</span>` : ''}
    `;
  }

  function refreshLive() {
    syncRunningFromHost();
    if (state.overlay === 'details' && currentGame()) updateDetailProgress(currentGame());
    const signature = liveSignature();
    if (signature === state.liveSignature) return;
    state.liveSignature = signature;
    updateRail();
    if (state.view === 'library') refreshLibraryLive();
    if (!state.overlay && state.view === 'home' && currentGame()) renderHero(currentGame(), false);
  }
