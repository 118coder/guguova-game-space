/* ============================================================
   APP PART 29 · boot —— 启动序列 BOOT + window.nova 完整出口 + IIFE 收口
   这是 src/app/ 分片之一：由 tools/build-app.js 按文件名序拼回 src/app.js。
   所有分片共享同一个 IIFE 闭包（跨分片直接引用函数与 state）。
   改代码请改分片，改完运行 node tools/build-app.js；直接编辑 app.js 会被覆盖。
   ============================================================ */

  /* ============================================================
     BOOT
     ============================================================ */

  function applyBoot(boot) {
    state.games = Array.isArray(boot.games) ? boot.games : [];
    state.settings = {
      playername: boot.settings?.playername || boot.userName || '玩家',
      avatarFile: boot.settings?.avatarFile || null,
      sound: boot.settings?.sound !== false,
      reduceMotion: boot.settings?.reduceMotion === true,
      styleMode: boot.settings?.styleMode === 'system' ? 'system' : 'adaptive',
      typeSeed: Number.isFinite(boot.settings?.typeSeed) ? boot.settings.typeSeed : 0,
      calm: boot.settings?.calm === true,
      theme: boot.settings?.theme || 'nova',
      layout: boot.settings?.layout === 'rail' ? 'rail' : 'row',
      closeToTray: boot.settings?.closeToTray === true,
      autoBackup: boot.settings?.autoBackup !== false,
      unifiedSfx: boot.settings?.unifiedSfx === true,
      librarySort: boot.settings?.librarySort || 'recent',
      librarySortDir: boot.settings?.librarySortDir === 'asc' || boot.settings?.librarySortDir === 'desc'
        ? boot.settings.librarySortDir : '',
      libraryTagCount: Math.min(3, Math.max(1, Number(boot.settings?.libraryTagCount) || 3)),
      scaleDelaySeconds: Math.min(120, Math.max(0, Number(boot.settings?.scaleDelaySeconds) || 0)),
      scaleMode: boot.settings?.scaleMode === 'factor' ? 'factor' : 'fullscreen',
      scaleFactor: Math.min(10, Math.max(1.1, Number(boot.settings?.scaleFactor) || 2)),
      scaleAlgorithm: typeof boot.settings?.scaleAlgorithm === 'string' ? boot.settings.scaleAlgorithm : '',
      minimizeOnLaunch: boot.settings?.minimizeOnLaunch !== false,
      scalingEngine: ['auto', 'native', 'off'].includes(boot.settings?.scalingEngine)
        ? boot.settings.scalingEngine : 'auto',
      magpiePath: boot.settings?.magpiePath || null,
      scalingHotkey: Number.isFinite(boot.settings?.scalingHotkey) && boot.settings.scalingHotkey > 0
        ? boot.settings.scalingHotkey : 3137,
      autoStartEngine: boot.settings?.autoStartEngine === true,
      idlePauseMinutes: Number.isFinite(boot.settings?.idlePauseMinutes)
        ? Math.max(0, boot.settings.idlePauseMinutes) : 10,
      startupFullscreen: boot.settings?.startupFullscreen === true,
      compatibilityTier: boot.settings?.compatibilityTier || 'auto',
      developerMode: boot.settings?.developerMode === true,
      elevated: boot.elevated === true,
      autoCheckUpdates: boot.settings?.autoCheckUpdates === true
    };
    state.developerMode = boot.developerMode === true;
    state.elevated = boot.elevated === true;
    state.developerModeEnv = boot.developerModeEnv === true;
    // The host owns the flag; the prompt itself is a product decision and
    // shows at most once per install.
    state.firstRun = boot.firstRun === true;
    state.system = boot.system || null;
    applySystemTier(state.system);
    state.userName = boot.userName || '';
    state.stats = boot.stats || null;
    state.storage = boot.storage || null;
    state.dataFolder = boot.dataFolder || '';
    state.backupsFolder = boot.backupsFolder || '';
    state.liveSignature = liveSignature();
    state.version = boot.version || '1.5.3';
    // Daily auto-check is opt-in and fires long after boot; the host no-ops
    // unless the player turned it on. Failures are silent here — a toast on
    // every startup hiccup would be worse than a missed check.
    if (hasBridge) setTimeout(() => { call('maybeAutoUpdateCheck'); }, 8000);
    if (els.libSort) els.libSort.value = state.settings.librarySort;
    if (els.profileVersion) els.profileVersion.textContent = `${state.version} · 桌面版`;
    state.running = new Map();
    (boot.running || []).forEach((session) => state.running.set(session.gameId, session));

    const currentId = boot.currentGameId;
    const index = state.games.findIndex((game) => game.id === currentId);
    state.index = index >= 0 ? index : 0;
    // The last session may have ended on a title that has since been hidden.
    if (state.games[state.index] && state.games[state.index].hidden) {
      const firstShelf = resolveShelfIndex(state.index, 1);
      if (firstShelf >= 0) state.index = firstShelf;
    }

    els.profileName.textContent = state.settings.playername;
    syncAvatarImages();
    els.appearanceDataPath.textContent = state.dataFolder;
    els.appearanceDataPath.title = state.dataFolder;
  }

  async function init() {
    syncMotionUI();
    updateClock();
    setInterval(updateClock, 1000);
    setInterval(refreshLive, 30000);
    // The push events can be lost while the window is hidden; waking up is
    // the moment a stale "运行中" would be noticed, so reconcile right away.
    window.addEventListener('focus', syncRunningFromHost);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) syncRunningFromHost();
    });
    setInterval(() => {
      if (state.overlay === 'launch') {
        const game = currentGame();
        if (game && state.running.has(game.id) && els.launchOverlay.classList.contains('is-ready')) {
          els.launchStatus.textContent = '游戏正在运行';
        }
      }
    }, 4000);

    let boot = null;
    if (hasBridge) {
      boot = await call('boot');
    }

    if (boot && boot.ok !== false) {
      applyBoot(boot);
    } else {
      state.games = [];
    }

    buildBackdrop();
    buildRail();
    buildAppearanceSwitcher();
    bindEvents();
    bindKeyboard();

    if (window.NovaOverlays) {
      window.NovaOverlays.bind({ app: els.app, sound: audio, call });
    }

    // Themes load asynchronously. The opening waits for the theme list and
    // its stylesheet so the saved theme owns the first frame; the fallback
    // only exists so a broken theme can never hold the shell hostage.
    const themesReady = startThemes().catch((error) => console.warn('theme boot failed', error));
    // Optional accelerators (WebGPU / WebAssembly) probe after the shell is
    // scheduled, never before: a missing wasm file or a dead GPU process must
    // cost the player nothing at start-up. See src/capability/capability.js.
    if (window.NovaCapability) {
      const whenIdle = window.requestIdleCallback || ((fn) => setTimeout(fn, 400));
      whenIdle(() => window.NovaCapability.probe().catch(() => {}), { timeout: 2000 });
    }
    bindNativeGuards();
    bindContextMenu();
    bindThemePanel();
    bindSettings();
    bindIdleSwitch();
    initThemedSelects();
    document.body.classList.toggle('is-empty', shelfCount() === 0);
    applyAccent(currentGame());
    // Every game hidden is the same empty shelf as no game at all.
    renderHero(shelfCount() ? currentGame() : null, false);
    applyStyleModeUI();
    syncSoundUI();
    syncFullscreenLabels();
    renderNotifications();
    syncInputStatus(null);
    setNav('home');
    document.title = currentGame() ? `${currentGame().zh || currentGame().name} · GUGUOVA 游戏空间` : 'GUGUOVA · 游戏空间';

    if (hasBridge) {
      call('fullscreenState').then((result) => {
        if (result) applyFullscreenState(!!result.fullscreen);
      });
    }

    if (currentGame()) setBackdrop(currentGame(), true);

    // Diagnostics are not on the first-frame path: let the shell settle, then
    // fill in the Steam/Magpie rows so the settings page is ready when opened.
    setTimeout(() => { refreshSteamPrivilege(); refreshMagpieStatus(); }, 1400);

    setTimeout(() => { audio.warm(); }, 1500);
    setTimeout(ensureActiveTileVisible, 140);
    initParallax();
    startGamepad();
    watchDockHeight();
    setTimeout(refitLogos, 500);
    setTimeout(() => setNav(document.documentElement.dataset.view || 'home'), 240);

    /* Opening ritual: the theme may name a preset ("intro": "ink").
       If themes are slow, the default preset starts and the shell is
       never held hostage by a stylesheet. */
    const introPreset = Promise.race([
      themesReady.then(() => {
        const theme = window.NovaTheme ? window.NovaTheme.find(state.theme) : null;
        return (theme && theme.intro) || 'gilded';
      }),
      new Promise((resolve) => setTimeout(() => resolve('gilded'), 2500))
    ]);

    introPreset.then((preset) => {
      if (!window.NovaIntro || (state.system && state.system.tier === 'safe')) {
        document.body.classList.add('is-booted');
        setTimeout(maybeAskFirstRun, 620);
        return;
      }
      // The theme's boot file is a sequence authored on its intro keyframes:
      // firing it as the animation starts is what lands the hits on the beats.
      themesReady.then(() => audio.boot()).catch(() => {});
      const played = window.NovaIntro.play({ intro: preset });
      played.then(() => {
        // Skip or natural end: fade whatever is left of the sequence.
        audio.stopLong('boot', 0.3);
        ensureActiveTileVisible();
        refitLogos();
        // First run asks before anything else: an empty library with a full
        // Steam/Epic/GOG install behind it should not be filled in by hand.
        setTimeout(maybeAskFirstRun, 620);
        if (!hasBridge) {
          toast('未检测到桌面宿主，正在以预览模式运行', 'info');
        } else if (!state.games.length && !state.firstRun) {
          setTimeout(() => toast('游戏库是空的 · 按 A 或点击 + 添加游戏', 'spark'), 500);
        }
      });
      return played;
    });

    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        refitLogos();
        updateAppearanceScrollState();
        ensureActiveTileVisible();
        layoutAppearanceCrop();
        setNav(document.documentElement.dataset.view || 'home');
      }, 160);
    }, { passive: true });

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        refitLogos();
        setNav(document.documentElement.dataset.view || 'home');
      }).catch(() => {});
    }
  }

  // Dev-only hook for the headless capture tool (tools/export-all.js).
  // Layout bugs hide at the edges of real data, so the tool needs to push
  // hostile input (a 30-character title, a badge gutter, an empty library)
  // through the *real* render path instead of editing the DOM behind it.
  // 34 characters: 30 as the rule requires, plus redundancy for the badge gutter.
  const LONG_TITLE_STRESS = '沉睡的法则 THINGS AS THEY ARE 终章';
  // stressTitle() overwrites the selected game's real name, so the restore path
  // has to remember it: a QA run must be able to leave the app exactly as it
  // found it, or a later capture silently shows the hostile title.
  const stressBackup = new Map();
  function devStressTitle(text) {
    const game = state.games[state.index];
    const restore = text == null || text === false;
    const value = restore ? '' : String(text || LONG_TITLE_STRESS);
    if (game) {
      if (restore) {
        const prev = stressBackup.get(game.id);
        if (prev) {
          game.logo = prev.logo;
          game.name = prev.name;
          stressBackup.delete(game.id);
        }
      } else {
        if (!stressBackup.has(game.id)) stressBackup.set(game.id, { logo: game.logo, name: game.name });
        game.logo = value;
        game.name = value;
      }
      renderHero(game, false);
    } else if (!restore) {
      setLogo(els.gameLogo, null, 'hero-logo', { text: value });
    }
    if (els.detailLogo) setLogo(els.detailLogo, game, 'detail-logo', restore ? {} : { text: value });
    refitLogos();
    return {
      text: game ? game.logo : value,
      length: (game ? game.logo : value).length,
      fit: els.gameLogo ? els.gameLogo.style.getPropertyValue('--logo-fit') : ''
    };
  }

  function devClearSelection() {
    state.games.splice(0, state.games.length);
    state.index = 0;
    renderHero(null, false);
    renderLibrary();
    return state.games.length;
  }

  window.NovaDev = {
    stressTitle: devStressTitle,
    // QA/dev: simulate a file drop without an OS drag (the page cannot fake
    // one). Resolves through the same host path a real drop takes.
    dropImport: (paths) => call('resolveDrop', { paths: Array.isArray(paths) ? paths : [paths] }),
    clearSelection: devClearSelection,
    refit: refitLogos,
    // Headless capture support. The nav buttons deliberately refuse to switch
    // views while any surface is open (`if (state.overlay) return`), and a
    // screenshot tool drives the DOM directly, so it can walk away leaving
    // state.overlay set — after which every later view switch is silently
    // ignored and the tool captures the wrong screen (the appearance-only
    // widgets came out empty for exactly this reason). One call puts the app
    // back to "home view, nothing open" without touching anything visual.
    resetSurfaces() {
      if (window.NovaSurfaces) {
        window.NovaSurfaces.ids.forEach((id) => {
          try { window.NovaSurfaces.close(id, { focus: false }); } catch (error) { /* already closed */ }
        });
      }
      // The scaling sheet predates the surface registry, so it has its own
      // close path. Without this the QA harness leaves it painted above every
      // later view (state.overlay says null but the element stays open).
      if (state.overlay === 'engine') {
        try { closeEngineDialog(); } catch (error) { /* already closed */ }
      }
      // The framing editor is view-local state, not a surface; leaving it on
      // makes the next appearance capture open with the panel already toggled.
      if (state.appearanceEditing) {
        try { setAppearanceEditing(false); } catch (error) { /* not available yet */ }
      }
      state.overlay = null;
      document.querySelectorAll('.overlay.is-open').forEach((el) => el.classList.remove('is-open'));
      document.querySelectorAll('.nova-select-menu').forEach((menu) => { menu.hidden = true; });
      state.view = null;
      setView('home', { force: true });
      setNav('home');
      updateAppearanceScrollState?.();
      return 'ok';
    },
    // Audio internals are exposed for the capture/QA harness: verifying which
    // cue set is live otherwise means guessing from decoded durations.
    audio,
    state
  };

  init();
})();
