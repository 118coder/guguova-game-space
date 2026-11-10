/* ============================================================
   APP PART 23 · themes —— 主题管理 —— 清单读取、切换、播种与主题弹窗
   这是 src/app/ 分片之一：由 tools/build-app.js 按文件名序拼回 src/app.js。
   所有分片共享同一个 IIFE 闭包（跨分片直接引用函数与 state）。
   改代码请改分片，改完运行 node tools/build-app.js；直接编辑 app.js 会被覆盖。
   ============================================================ */

  /* ============================================================
     THEMES
     A theme swaps the whole shell: colours, borders, buttons and
     icons. Themes live in the user theme folder and never execute code.
     ============================================================ */

  const THEME_USAGE_KEY = 'nova.themeUsage';
  const THEME_COLLAPSE_KEY = 'nova.themeCollapsed';
  const THEME_PINNED_LIMIT = 6;

  function readThemeUsage() {
    try {
      const parsed = JSON.parse(localStorage.getItem(THEME_USAGE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function recordThemeUse(id) {
    if (!id) return;
    try {
      const usage = readThemeUsage();
      usage[id] = (Number(usage[id]) || 0) + 1;
      localStorage.setItem(THEME_USAGE_KEY, JSON.stringify(usage));
    } catch (error) {}
  }

  function themeCollapsed() {
    try {
      const saved = localStorage.getItem(THEME_COLLAPSE_KEY);
      return saved === null ? true : saved === '1';
    } catch (error) {
      return true;
    }
  }

  function setThemeCollapsed(value) {
    try { localStorage.setItem(THEME_COLLAPSE_KEY, value ? '1' : '0'); } catch (error) {}
  }

  /* ------------------------------------------------------------
     Theme order is a session snapshot.
     ------------------------------------------------------------
     Usage used to be re-sorted on every render, so clicking a theme
     moved every card under the pointer — the next click landed on a
     different theme. Now the "frequently used first" order is frozen
     when the theme list is first read (and on an explicit refresh);
     usage keeps counting for the next launch, but the grid never
     reshuffles mid-session. New themes are appended, never inserted.
     ------------------------------------------------------------ */

  let themeOrder = null;

  /**
   * Fixed shelf: the first cards never move regardless of usage counts.
   * A theme opts in with `"pinned": <n>` in theme.json; ties keep the
   * built-in order, so a new theme ships its position as data instead of
   * needing a line here. Themes without the field sort by usage below.
   */
  function themePins(themes) {
    return themes
      .map((theme, index) => ({ id: theme.id, pin: Number(theme.pinned), index }))
      .filter((entry) => Number.isFinite(entry.pin) && entry.pin > 0)
      .sort((a, b) => a.pin - b.pin || a.index - b.index)
      .map((entry) => entry.id);
  }

  function computeThemeOrder(themes) {
    const usage = readThemeUsage();
    const byId = new Map(themes.map((theme) => [theme.id, theme]));
    const pins = themePins(themes);
    const head = pins.map((id) => byId.get(id)).filter(Boolean);
    const tail = themes
      .filter((theme) => !pins.includes(theme.id))
      .sort((a, b) => {
        const delta = (Number(usage[b.id]) || 0) - (Number(usage[a.id]) || 0);
        if (delta) return delta;
        return String(a.name || a.id).localeCompare(String(b.name || b.id), 'zh-Hans-CN');
      });
    return [...head, ...tail].map((theme) => theme.id);
  }

  function orderedThemes() {
    if (!window.NovaTheme) return [];
    const all = window.NovaTheme.themes;
    if (!themeOrder) themeOrder = computeThemeOrder(all);
    const byId = new Map(all.map((theme) => [theme.id, theme]));
    const out = [];
    themeOrder.forEach((id) => {
      const theme = byId.get(id);
      if (theme) { out.push(theme); byId.delete(id); }
    });
    // Themes added since the snapshot go to the end, in manifest order.
    all.forEach((theme) => { if (byId.has(theme.id)) out.push(theme); });
    return out;
  }

  function freezeThemeOrder() {
    if (!window.NovaTheme) return;
    themeOrder = computeThemeOrder(window.NovaTheme.themes);
  }

  function renderThemes() {
    if (!els.themeGrid || !window.NovaTheme) return;
    const allThemes = window.NovaTheme.themes;
    const themes = orderedThemes();
    const activeId = window.NovaTheme.activeId;
    const collapsed = themeCollapsed();
    let visible = collapsed ? themes.slice(0, THEME_PINNED_LIMIT) : themes;

    // The active theme must always stay reachable. Append it instead of
    // replacing the last card: replacing moved a card the user may be
    // aiming at and made the grid feel unstable.
    if (collapsed && activeId && !visible.some((theme) => theme.id === activeId)) {
      const activeTheme = themes.find((theme) => theme.id === activeId);
      if (activeTheme) visible = [...visible, activeTheme];
    }

    els.themeCountTag.textContent = `${allThemes.length} 套`;
    if (els.themeToggle) {
      const canFold = allThemes.length > THEME_PINNED_LIMIT;
      els.themeToggle.hidden = !canFold;
      els.themeToggle.setAttribute('aria-expanded', String(!collapsed));
      if (els.themeToggleLabel) {
        els.themeToggleLabel.textContent = collapsed
          ? `展开全部 ${allThemes.length} 套`
          : '收起，只看常用';
      }
    }

    els.themeGrid.innerHTML = visible.map((theme) => {
      const active = theme.id === activeId;
      const broken = theme.ok === false;
      const preview = theme.previewUrl
        ? `<img src="${esc(theme.previewUrl)}" alt="" draggable="false">`
        : '<span class="theme-placeholder"><svg class="ic" aria-hidden="true"><use href="#i-spark"/></svg></span>';
      return `
        <button class="theme-card${active ? ' is-active' : ''}${broken ? ' is-broken' : ''}"
                data-theme="${esc(theme.id)}" type="button"
                aria-pressed="${active ? 'true' : 'false'}"
                ${broken ? 'disabled' : ''}
                data-tip="${esc(broken ? theme.error : theme.description || theme.name)}">
          <span class="theme-preview">${preview}</span>
          <span class="theme-meta">
            <span class="theme-name">${esc(theme.name)}</span>
            <span class="theme-sub">${esc(broken ? theme.error : `${theme.author} · v${theme.version}`)}</span>
          </span>
          ${active ? '<span class="theme-active-tag">使用中</span>' : ''}
        </button>`;
    }).join('');
  }

  /* ------------------------------------------------------------
     Theme switch curtain
     ------------------------------------------------------------
     The shutter is painted with the incoming theme's accent, covers the
     window while the stylesheet is swapped, then opens. That hides the
     one expensive frame (a full style recalculation across ~2k theme
     selectors) behind deliberate motion instead of a visible freeze.
     ------------------------------------------------------------ */

  let curtainTimer = 0;
  let themeSwitching = false;

  // Each theme owns a different shutter: doors, page turn, CRT, ink blot…
  // The hold time must match the longest cover phase, otherwise the style
  // swap becomes visible. A theme declares it in theme.json as `curtainMs`;
  // the default below covers a theme that has not mapped the slot yet.
  const CURTAIN_HOLD_DEFAULT = 420;

  function curtainHold(theme) {
    const value = Number(theme && theme.curtainMs);
    return Number.isFinite(value) && value >= 200 && value <= 1200
      ? value
      : CURTAIN_HOLD_DEFAULT;
  }

  function curtainThemeName(theme) {
    return String(theme.name || theme.id || 'GUGUOVA').split('·')[0].trim() || 'GUGUOVA';
  }

  function playThemeCurtain(theme) {
    return new Promise((resolve) => {
      if (!els.themeCurtain || state.settings.reduceMotion ||
          (state.system && state.system.tier === 'safe')) { resolve(); return; }
      const tokens = theme.tokens || {};
      els.themeCurtain.dataset.variant = theme.id || 'nova';
      els.themeCurtain.style.setProperty('--tc-accent', tokens['--accent'] || '#ffa477');
      els.themeCurtain.style.setProperty('--tc-accent-2', tokens['--accent-2'] || '#ff6f6f');
      if (els.themeCurtainName) els.themeCurtainName.textContent = curtainThemeName(theme);
      els.themeCurtain.classList.remove('is-reveal', 'is-cover');
      els.themeCurtain.classList.add('is-on');
      // Paint the new variant's closed state before starting the transition.
      // On the first switch the browser has not computed these transforms yet,
      // so starting in the same frame made the cover look truncated.
      void els.themeCurtain.offsetWidth;
      clearTimeout(curtainTimer);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (!els.themeCurtain || !els.themeCurtain.classList.contains('is-on')) { resolve(); return; }
        els.themeCurtain.classList.add('is-cover');
        curtainTimer = setTimeout(resolve, curtainHold(theme));
      }));
    });
  }

  function revealThemeCurtain() {
    if (!els.themeCurtain || !els.themeCurtain.classList.contains('is-cover')) return;
    els.themeCurtain.classList.remove('is-cover');
    els.themeCurtain.classList.add('is-reveal');
    clearTimeout(curtainTimer);
    curtainTimer = setTimeout(() => {
      els.themeCurtain.classList.remove('is-on', 'is-reveal', 'is-cover');
    }, 520);
  }

  async function applyTheme(id, options = {}) {
    if (!window.NovaTheme || themeSwitching) return;
    const theme = window.NovaTheme.find(id);
    if (!theme || theme.ok === false) {
      if (!options.silent) toast(theme?.error || '这个主题不可用', 'alert');
      return;
    }
    const before = window.NovaTheme.activeId;
    const animate = !options.silent && before !== id && !state.settings.reduceMotion &&
      !(state.system && state.system.tier === 'safe');
    if (animate) {
      themeSwitching = true;
      // Load the incoming theme's sounds before the curtain closes: the switch
      // cue belongs to the theme being entered, not the one being left.
      await audio.warmTheme(id, theme.sounds);
      audio.theme();
      await playThemeCurtain(theme);
    }

    let result = null;
    try {
      result = await window.NovaTheme.activate(id, options);
    } finally {
      if (!result || !result.ok) {
        if (animate) { revealThemeCurtain(); themeSwitching = false; }
      }
    }
    if (!result || !result.ok) {
      if (!options.silent) toast(result?.error || '主题加载失败', 'alert');
      return;
    }

    state.theme = result.theme.id;
    // Silent switches (restoring the saved theme at boot, or a fallback after
    // a broken theme) still need that theme's launch cues from now on.
    if (!animate) await audio.warmTheme(state.theme, result.theme.sounds);
    if (!options.silent && before !== state.theme) recordThemeUse(state.theme);
    renderThemes();
    if (before !== state.theme) {
      applyStyleModeUI();
      applyAccent(currentGame());
      refitLogos();
      // A theme may rename fixed phrases (DUSK: 上次游玩 → 上次委托), so the
      // hero and an open detail sheet must be repainted with the new lexicon.
      if (currentGame()) renderHero(currentGame(), false);
      if (state.overlay === 'details') populateDetails(currentGame());
      if (state.appearanceEditing) requestAnimationFrame(layoutAppearanceCrop);
      // The theme changes nav paddings and font metrics. Without this the
      // sliding highlight keeps the previous width/offset until the next
      // view switch, which reads as a white pill stuck over another tab.
      setNav(state.view || document.documentElement.dataset.view || 'home', { instant: true });
      setTimeout(() => { refitLogos(); setNav(document.documentElement.dataset.view || 'home', { instant: true }); }, 350);
      audio.select();
      if (!options.silent) toast(`界面主题 · ${result.theme.name}`, 'spark');
    }

    if (animate) {
      // Hold the curtain for two frames so the new styles are painted
      // underneath before the shutter opens.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      revealThemeCurtain();
      themeSwitching = false;
    }
  }

  /** Replay a theme's opening animation (and its beat-matched sequence)
      without switching to that theme. */
  async function previewThemeIntro(id) {
    if (!window.NovaIntro || !window.NovaTheme) return;
    if (state.overlay === 'launch' || state.overlay === 'sleep') return;
    if (window.NovaIntro.active) return;
    const theme = window.NovaTheme.find(id);
    if (!theme || theme.ok === false) return;

    audio.select();
    closeContextMenu();
    closePopovers();
    // Decode first so the first hit lands with the first frame, not 80ms late.
    await audio.playPreviewBoot(theme.sounds);
    const played = window.NovaIntro.play({ intro: theme.intro || 'gilded' });
    played.then(() => audio.stopLong('boot', 0.3));
  }

  async function startThemes() {
    if (!window.NovaTheme || !hasBridge) return;
    await window.NovaTheme.start({ call, styleMode: state.settings.styleMode });

    // Freeze the "frequently used first" order for this session before the
    // first render, so cards never move while the user is clicking.
    freezeThemeOrder();

    // The host remembers the active theme; apply it before first paint settles.
    const preferred = state.settings.theme && window.NovaTheme.find(state.settings.theme)
      ? state.settings.theme
      : 'nova';
    await window.NovaTheme.activate(preferred, { silent: true });
    state.theme = window.NovaTheme.activeId;
    // This path bypasses applyTheme, so the restored theme's cues have to be
    // loaded here too — otherwise boot and the first game launch are silent
    // for however long the user waits before opening 外观.
    const restored = window.NovaTheme.find(state.theme);
    await audio.warmTheme(state.theme, restored && restored.sounds);
    renderThemes();
    applyStyleModeUI();
    applyAccent(currentGame());
    renderHero(currentGame(), false);
    updateRail();

    // Warm the stylesheet cache after the first frame: the first switch to
    // any theme then only costs a style swap, not a disk read.
    const warm = () => { if (window.NovaTheme) window.NovaTheme.preloadAll(); };
    if (window.requestIdleCallback) requestIdleCallback(warm, { timeout: 2500 });
    else setTimeout(warm, 900);
  }

  /** "挂机 10 分钟后暂停计时" — 0 in the host means off. */
  function bindIdleSwitch() {
    if (!els.settingsIdleRow) return;
    const sync = () => {
      const on = (state.settings.idlePauseMinutes || 0) > 0;
      setPrefSwitch(els.settingsIdleRow, els.settingsIdleSwitch, on);
    };
    sync();
    els.settingsIdleRow.addEventListener('click', () => {
      state.settings.idlePauseMinutes = (state.settings.idlePauseMinutes || 0) > 0 ? 0 : 10;
      sync();
      saveSettings();
      audio.select();
      toast(state.settings.idlePauseMinutes > 0 ? '挂机 10 分钟后暂停计时' : '挂机不再暂停计时（按墙钟记录）', 'info');
    });
  }

  function bindSettings() {
    if (els.settingsSaveName) els.settingsSaveName.addEventListener('click', savePlayerName);
    if (els.settingsUseSystemName) els.settingsUseSystemName.addEventListener('click', useSystemPlayerName);
    if (els.settingsPlayerName) {
      els.settingsPlayerName.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          savePlayerName();
        }
      });
    }
    if (els.settingsTrayRow) els.settingsTrayRow.addEventListener('click', toggleTraySetting);
    if (els.settingsChangeAvatar) els.settingsChangeAvatar.addEventListener('click', chooseAvatar);
    if (els.settingsAvatarButton) els.settingsAvatarButton.addEventListener('click', chooseAvatar);
    if (els.settingsClearAvatar) els.settingsClearAvatar.addEventListener('click', clearAvatar);
    if (els.settingsAutoBackupRow) els.settingsAutoBackupRow.addEventListener('click', toggleAutoBackup);
    if (els.updateCheckBtn) els.updateCheckBtn.addEventListener('click', checkForUpdates);
    if (els.updateDownloadBtn) {
      els.updateDownloadBtn.addEventListener('click', () => {
        const info = state.update || {};
        if (!info.assetUrl || !info.assetName) return;
        call('downloadUpdate', { url: info.assetUrl, name: info.assetName });
      });
    }
    if (els.updateFolderBtn) els.updateFolderBtn.addEventListener('click', () => call('openUpdateFolder'));
    if (els.updateAutoRow) els.updateAutoRow.addEventListener('click', toggleUpdateAuto);
    if (els.settingsStartupRow) els.settingsStartupRow.addEventListener('click', toggleStartup);
    if (els.settingsStartupFullscreenRow) els.settingsStartupFullscreenRow.addEventListener('click', toggleStartupFullscreen);
    if (els.settingsMinimizeRow) els.settingsMinimizeRow.addEventListener('click', toggleMinimizeSetting);
    if (els.settingsHotkeyRow) els.settingsHotkeyRow.addEventListener('click', () => {
      if (state.hotkeyRecording) cancelHotkeyRecording();
      else beginHotkeyRecording();
    });
    if (els.settingsAutoEngineRow) els.settingsAutoEngineRow.addEventListener('click', toggleAutoEngine);
    if (els.settingsMagpieRestart) els.settingsMagpieRestart.addEventListener('click', async () => {
      audio.select();
      await call('restartScalingEngine');
      toast('正在重启缩放引擎…', 'spark');
    });
    if (els.settingsEngineOptions) els.settingsEngineOptions.addEventListener('click', openEngineDialog);
    if (els.engineClose) els.engineClose.addEventListener('click', closeEngineDialog);
    if (els.engineSave) els.engineSave.addEventListener('click', saveEngineDialog);
    if (els.engineReset) els.engineReset.addEventListener('click', resetEngineDialog);
    if (els.engineOpenFull) els.engineOpenFull.addEventListener('click', openFullMagpie);
    if (els.engine3dRow) els.engine3dRow.addEventListener('click', toggleEngine3d);
    if (els.engineMode) els.engineMode.addEventListener('change', () => {
      const modes = (state.engineOptions && state.engineOptions.modes) || [];
      renderEngineModeList(modes, Number(els.engineMode.value || 0));
    });
    if (els.engineAutoRow) els.engineAutoRow.addEventListener('click', () => {
      const next = els.engineAutoRow.getAttribute('aria-checked') !== 'true';
      setPrefSwitch(els.engineAutoRow, els.engineAutoSwitch, next);
      audio.toggle();
    });
    if (els.engineOverlay) {
      els.engineOverlay.addEventListener('pointerdown', (event) => {
        if (event.target === els.engineOverlay) closeEngineDialog();
      });
    }
    if (els.settingsMagpieStart) els.settingsMagpieStart.addEventListener('click', async () => {
      audio.select();
      await call('startMagpie');
      toast('正在启动缩放引擎…', 'spark');
    });
    if (els.settingsMagpiePick) els.settingsMagpiePick.addEventListener('click', pickMagpieExe);
    if (els.settingsSteamFix) els.settingsSteamFix.addEventListener('click', fixSteamFromSettings);
    if (els.settingsSyncPlaytime) els.settingsSyncPlaytime.addEventListener('click', syncSteamPlaytime);
    if (els.settingsUnifiedSfxRow) els.settingsUnifiedSfxRow.addEventListener('click', () => setUnifiedSfx(!state.settings.unifiedSfx));
    if (els.settingsFullscreenRow) els.settingsFullscreenRow.addEventListener('click', () => applyFullscreen(!state.fullscreen));
    if (els.settingsTier) els.settingsTier.addEventListener('change', changeCompatibilityTier);
    if (els.settingsTagCount) els.settingsTagCount.addEventListener('change', () => {
      state.settings.libraryTagCount = Math.min(3, Math.max(1, Number(els.settingsTagCount.value) || 3));
      saveSettings();
      audio.toggle();
      renderLibrary();
      toast(`封面标签：${state.settings.libraryTagCount} 个`, 'check');
    });
    if (els.settingsScaleDelay) els.settingsScaleDelay.addEventListener('change', () => {
      state.settings.scaleDelaySeconds = Math.min(120, Math.max(0, Number(els.settingsScaleDelay.value) || 0));
      saveSettings();
      audio.toggle();
      toast(state.settings.scaleDelaySeconds > 0
        ? `启动后 ${state.settings.scaleDelaySeconds} 秒再缩放`
        : '缩放时机：立即', 'check');
    });
    if (els.settingsScaleMode) els.settingsScaleMode.addEventListener('change', () => {
      state.settings.scaleMode = els.settingsScaleMode.value === 'factor' ? 'factor' : 'fullscreen';
      if (els.settingsScaleFactorRow) els.settingsScaleFactorRow.hidden = state.settings.scaleMode !== 'factor';
      saveSettings();
      audio.toggle();
      toast(state.settings.scaleMode === 'factor'
        ? '缩放方式：倍数缩放，可在下面选倍数'
        : '缩放方式：全屏缩放', 'check');
    });
    if (els.settingsScaleFactor) els.settingsScaleFactor.addEventListener('change', () => {
      state.settings.scaleFactor = Math.min(10, Math.max(1.1, Number(els.settingsScaleFactor.value) || 2));
      saveSettings();
      audio.toggle();
      toast(`放大倍数：${state.settings.scaleFactor} 倍`, 'check');
    });
    if (els.settingsScaleAlgorithm) els.settingsScaleAlgorithm.addEventListener('change', () => {
      state.settings.scaleAlgorithm = els.settingsScaleAlgorithm.value || '';
      saveSettings();
      audio.toggle();
      toast(state.settings.scaleAlgorithm
        ? `缩放算法：${state.settings.scaleAlgorithm}`
        : '缩放算法：跟随引擎当前设置', 'check');
    });
    if (els.settingsExport) els.settingsExport.addEventListener('click', exportPack);
    if (els.settingsImport) els.settingsImport.addEventListener('click', importPack);
    if (els.settingsCsv) els.settingsCsv.addEventListener('click', exportRecords);
    if (els.settingsOpenData) els.settingsOpenData.addEventListener('click', () => { audio.select(); call('openDataFolder'); });
    if (els.settingsOpenBackups) els.settingsOpenBackups.addEventListener('click', () => { audio.select(); call('openBackupsFolder'); });
    if (els.libSort) {
      els.libSort.addEventListener('change', () => {
        state.settings.librarySort = els.libSort.value;
        // A newly chosen field starts at its own reading order instead of
        // inheriting the previous field's arrow: "名称 倒序" by itself would
        // look like a bug the first time a player picks 名称.
        state.settings.librarySortDir = SORT_DEFAULT_DIR[els.libSort.value] || 'asc';
        saveSettings();
        renderLibrary();
        audio.select();
      });
    }
    if (els.libSortDir) {
      els.libSortDir.addEventListener('click', () => {
        const mode = state.settings.librarySort || 'recent';
        state.settings.librarySortDir = sortDir(mode) === 'desc' ? 'asc' : 'desc';
        saveSettings();
        renderLibrary();
        audio.select();
      });
    }
    if (els.settingsRow) {
      els.settingsRow.addEventListener('click', () => {
        closePopovers();
        openSettings();
      });
    }
  }

  /**
   * Theme cards used to carry a `title`, which the host renders as a stock
   * dark tooltip — the one surface that ignored the active theme entirely.
   * This is the themed replacement; it reuses the context menu's material.
   */
  function showThemeTip(card) {
    const tip = els.themeTip;
    const text = card && card.dataset.tip;
    if (!tip || !text) return;
    tip.textContent = text;
    tip.classList.add('is-open');
    tip.setAttribute('aria-hidden', 'false');
    const r = card.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    const gap = 10;
    let x = r.x + r.width / 2 - t.width / 2;
    x = Math.max(8, Math.min(x, window.innerWidth - t.width - 8));
    let y = r.y - t.height - gap;
    if (y < 8) y = Math.min(r.bottom + gap, window.innerHeight - t.height - 8);
    tip.style.left = `${Math.round(x)}px`;
    tip.style.top = `${Math.round(y)}px`;
  }

  function hideThemeTip() {
    if (!els.themeTip) return;
    els.themeTip.classList.remove('is-open');
    els.themeTip.setAttribute('aria-hidden', 'true');
  }

  function bindThemePanel() {
    if (els.themeToggle) {
      els.themeToggle.addEventListener('click', () => {
        setThemeCollapsed(!themeCollapsed());
        renderThemes();
        audio.select();
      });
    }

    els.themeGrid.addEventListener('click', (event) => {
      const card = event.target.closest('[data-theme]');
      if (!card || card.disabled) return;
      applyTheme(card.dataset.theme);
    });

    // Warm the stylesheet as soon as the pointer or focus lands on a card.
    const warmCard = (event) => {
      const card = event.target.closest('[data-theme]');
      if (card && window.NovaTheme) window.NovaTheme.preload(card.dataset.theme);
    };
    els.themeGrid.addEventListener('pointerover', warmCard, { passive: true });
    els.themeGrid.addEventListener('focusin', warmCard);

    els.themeGrid.addEventListener('pointerover', (event) => {
      const card = event.target.closest('.theme-card[data-tip]');
      if (card) showThemeTip(card);
    });
    els.themeGrid.addEventListener('pointerout', (event) => {
      const to = event.relatedTarget instanceof Element ? event.relatedTarget : null;
      if (!to || !to.closest('.theme-card')) hideThemeTip();
    });
    els.themeGrid.addEventListener('focusin', (event) => {
      const card = event.target.closest('.theme-card[data-tip]');
      if (card) showThemeTip(card);
    });
    els.themeGrid.addEventListener('focusout', () => hideThemeTip());
    window.addEventListener('scroll', () => hideThemeTip(), true);

    els.themeRefresh.addEventListener('click', async () => {
      if (!window.NovaTheme) return;
      await window.NovaTheme.refresh();
      // A newly installed theme joins the end of the frozen order; existing
      // cards keep their positions.
      if (!themeOrder) freezeThemeOrder();
      const stillThere = window.NovaTheme.find(state.theme);
      if (!stillThere || stillThere.ok === false) await applyTheme('nova', { silent: true });
      renderThemes();
      audio.select();
      toast(`已刷新 · ${window.NovaTheme.themes.length} 套主题`, 'shuffle');
    });

    els.themeFolder.addEventListener('click', async () => {
      const result = await call('openThemesFolder');
      audio.open();
      if (result && result.folder) toast('已打开主题文件夹', 'folder');
    });  }
