/* ============================================================
   APP PART 28 · events —— 主按钮 PRIMARY ACTION + 全部事件委托 EVENTS
   这是 src/app/ 分片之一：由 tools/build-app.js 按文件名序拼回 src/app.js。
   所有分片共享同一个 IIFE 闭包（跨分片直接引用函数与 state）。
   改代码请改分片，改完运行 node tools/build-app.js；直接编辑 app.js 会被覆盖。
   ============================================================ */

  /* ============================================================
     PRIMARY ACTION
     ============================================================ */

  async function handlePrimary() {
    if (state.forceKill.suppressClick) {
      // The click that follows a completed force-kill hold must not also
      // open the manage panel.
      state.forceKill.suppressClick = false;
      return;
    }
    const game = currentGame();
    if (!game) {
      openScanner();
      return;
    }
    if (state.running.has(game.id)) {
      openDetails();
      setTimeout(openManage, 200);
      toast('游戏正在运行 · 可在管理面板中结束进程', 'gamepad');
      return;
    }
    if (!game.exists) {
      toast('找不到游戏程序，请在管理面板中重新指定', 'alert');
      openDetails();
      setTimeout(openManage, 180);
      return;
    }
    if (state.overlay === 'details') closeDetails({ focus: false, sound: false });
    launchGame(game);
  }

  /* ============================================================
     EVENTS
     ============================================================ */

  function bindEvents() {
    bindEditorFraming();
    bindAppearanceFraming();

    /* window chrome */
    const dragZone = () => {
      document.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        if (event.clientY > 34) return;
        if (event.target.closest('button, a, input, textarea, select, [tabindex]')) return;
        call('beginDrag');
      });
      document.addEventListener('dblclick', async (event) => {
        if (event.clientY > 34) return;
        if (event.target.closest('button, a, input, textarea, select, [tabindex]')) return;
        await call('toggleMaximizeWindow');
        const result = await call('fullscreenState');
        if (result) applyFullscreenState(!!result.fullscreen);
      });
    };
    dragZone();

    // Hidden developer switch: test entries stay in the library file but are
    // filtered out of the normal UI. Ctrl+Shift+D shows them again.
    document.addEventListener('keydown', (event) => {
      if (!event.ctrlKey || !event.shiftKey || String(event.key).toLowerCase() !== 'd') return;
      event.preventDefault();
      const next = !state.developerMode;
      call('saveSettings', { developerMode: next }).then(() => {
        if (state.developerModeEnv && !next) {
          toast('NOVA_DEV=1 已强制开启开发者模式', 'spark');
        } else {
          toast(next ? '开发者模式已开启 · 正在重新载入' : '开发者模式已关闭 · 正在重新载入', 'check');
        }
        setTimeout(() => location.reload(), 650);
      });
    }, true);

    els.minBtn.addEventListener('click', () => call('minimizeWindow'));
    els.maxBtn.addEventListener('click', async () => {
      await call('toggleMaximizeWindow');
      const result = await call('fullscreenState');
      if (result) applyFullscreenState(!!result.fullscreen);
    });
    els.closeBtn.addEventListener('click', () => call('closeWindow'));
    call('windowState').then((result) => { if (result) syncMaxButton(!!result.maximized); });

    els.playBtn.addEventListener('click', handlePrimary);
    bindForceKill();
    els.detailPlay.addEventListener('click', handlePrimary);
    els.detailBtn.addEventListener('click', openDetails);
    if (els.homeEngineBtn) els.homeEngineBtn.addEventListener('click', openEngineDialog);
    if (els.engineScaleRow) els.engineScaleRow.addEventListener('click', toggleHeroScale);
    if (els.homeScaleRow) els.homeScaleRow.addEventListener('click', toggleHeroScale);
    els.questCard.addEventListener('click', openDetails);
    els.detailsClose.addEventListener('click', () => closeDetails());
    els.detailsOverlay.addEventListener('pointerdown', (event) => {
      if (event.target === els.detailsOverlay) closeDetails();
    });

    els.detailFav.addEventListener('click', () => toggleFavorite(currentGame()));
    if (els.detailScaleRow) els.detailScaleRow.addEventListener('click', toggleDetailScale);
    if (els.manageHiddenRow) els.manageHiddenRow.addEventListener('click', toggleManageHidden);
    els.detailManage.addEventListener('click', () => {
      if (state.manageOpen) closeManage();
      else openManage();
    });
    els.manageClose.addEventListener('click', () => closeManage());
    if (els.manageToggle) {
      els.manageToggle.addEventListener('click', () => {
        audio.toggle();
        setManageBodyCollapsed(!state.manageCollapsed);
      });
    }
    els.manageDoneBtn.addEventListener('click', () => closeManage());
    els.removeGameBtn.addEventListener('click', handleRemoveGame);
    els.editRow.addEventListener('click', () => {
      const game = currentGame();
      if (!game) return;
      closeDetails({ focus: false, sound: false });
      openEditor(game);
    });
    els.resetArtRow.addEventListener('click', resetArtwork);
    if (els.refreshArtRow) els.refreshArtRow.addEventListener('click', refreshSteamArtwork);
    if (els.manageSteamModes) {
      els.manageSteamModes.addEventListener('click', (event) => {
        const button = event.target.closest('.steam-mode');
        if (!button || button.disabled) return;
        setLaunchMode(button.dataset.mode);
      });
    }
    els.revealBtn.addEventListener('click', () => {
      const game = currentGame();
      if (game) call('revealGame', { id: game.id });
    });

    // The launch surface is deliberately click-proof: a stray click (including
    // the one that opened it) must not cancel a launch. Esc is the only exit.
    els.sleepOverlay.addEventListener('pointerdown', exitSleep);

    els.libBack.addEventListener('click', () => closeLibrary());
    els.libSearch.addEventListener('input', () => {
      state.libQuery = els.libSearch.value;
      renderLibrary();
    });
    els.libFilters.addEventListener('click', (event) => {
      const button = event.target.closest('.filter');
      if (!button) return;
      state.libFilter = button.dataset.filter;
      state.libPadIndex = 0;
      renderLibrary();
      audio.toggle();
    });
    if (els.libGenre) els.libGenre.addEventListener('change', () => {
      state.libGenre = els.libGenre.value || '';
      state.libPadIndex = 0;
      renderLibrary();
      audio.toggle();
    });
    const favouriteActivate = (event) => {
      const fav = event.target.closest('.lib-fav');
      if (!fav) return false;
      // The heart sits inside the card <button>: without this the browser
      // also runs the button's activation for the same click — a synthetic
      // click at the button — and the detail view opened on every toggle.
      event.preventDefault();
      toggleFavorite(findGame(fav.dataset.fav));
      return true;
    };
    els.libGrid.addEventListener('keydown', (event) => {
      // The heart is a span[role=button]: Enter / Space activate it the way
      // they would a real button.
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (favouriteActivate(event)) event.preventDefault();
    });
    els.libGrid.addEventListener('click', (event) => {
      if (favouriteActivate(event)) return;
      const card = event.target.closest('.lib-card');
      if (!card) return;
      closeLibrary({ focus: false, sound: false });
      chooseGameById(card.dataset.game);
      setTimeout(() => {
        try { els.playBtn.focus({ preventScroll: true }); } catch (error) {}
      }, 120);
    });
    els.clearFilters.addEventListener('click', () => {
      if (!state.games.length) {
        openScanner();
        return;
      }
      state.libFilter = 'all';
      state.libQuery = '';
      state.libGenre = '';
      els.libSearch.value = '';
      state.libPadIndex = 0;
      renderLibrary();
      audio.select();
    });
    els.libAdd.addEventListener('click', () => openImport());

    $$('.nav-btn').forEach((button) => {
      button.addEventListener('click', () => {
        if (state.overlay) return;
        const view = button.dataset.nav;
        if (view === 'library') openLibrary();
        else if (view === 'appearance') openAppearance();
        else if (view === 'settings') openSettings();
        else setView('home');
      });
    });

    if (els.layoutBtn) {
      els.layoutBtn.addEventListener('click', () => {
        audio.select();
        toggleLayout();
      });
    }

    els.allBtn.addEventListener('click', () => openLibrary());
    els.searchBtn.addEventListener('click', () => openLibrary({ search: true }));
    if (els.shotBtn) els.shotBtn.addEventListener('click', () => openShareDialog());
    if (els.shareClose) els.shareClose.addEventListener('click', () => closeShareDialog());
    if (els.shareChoices) {
      els.shareChoices.addEventListener('click', (event) => {
        const button = event.target.closest('.share-choice');
        if (button) chooseShareVariant(button.dataset.variant);
      });
    }
    if (els.shareExport) els.shareExport.addEventListener('click', () => exportShareCard());
    if (els.shareLongPage) {
      els.shareLongPage.addEventListener('click', () => {
        closeShareDialog();
        // The page export has its own overlay guard; it runs on the next
        // frame so the dialog is already gone when the layout is released.
        requestAnimationFrame(() => exportScreenshot());
      });
    }
    if (els.shareOverlay) {
      els.shareOverlay.addEventListener('pointerdown', (event) => {
        if (event.target === els.shareOverlay) closeShareDialog();
      });
    }
    window.addEventListener('resize', () => {
      if (state.overlay === 'share') fitSharePreview();
    });
    els.addBtn.addEventListener('click', () => openImport());
    els.railAddCard.addEventListener('click', () => openImport());
    els.brandBtn.addEventListener('click', () => {
      if (state.overlay) return;
      selectGame(0, { sound: true, scroll: true });
      setView('home');
    });

    els.notifBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      openPopover('notif');
    });
    els.profileBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      openPopover('profile');
    });
    els.markReadBtn.addEventListener('click', () => {
      notices.forEach((notice) => { notice.unread = false; });
      renderNotifications();
      audio.select();
      toast('所有通知已标记为已读');
    });
    els.notifList.addEventListener('click', (event) => {
      const item = event.target.closest('.notif-item');
      if (!item) return;
      const notice = notices[Number(item.dataset.notice)];
      if (!notice) return;
      notice.unread = false;
      renderNotifications();
      closePopovers();
      audio.select();
      if (notice.gameId && findGame(notice.gameId)) {
        chooseGameById(notice.gameId);
        setView('home');
        toast(`已切换至《${findGame(notice.gameId).zh || findGame(notice.gameId).name}》`);
      }
    });

    els.appearanceRow.addEventListener('click', openAppearance);
    els.soundRow.addEventListener('click', () => setSound(!state.settings.sound));
    els.fullscreenRow.addEventListener('click', () => toggleFullscreen(true));
    els.sleepRow.addEventListener('click', enterSleep);
    els.quitRow.addEventListener('click', async () => {
      const quit = await window.NovaOverlays.dialog({
        title: '退出 GUGUOVA？',
        text: '游戏进程不会被关闭。',
        icon: 'power',
        tone: 'warning',
        actions: [
          { label: '退出', value: true, style: 'danger', icon: 'close' },
          { label: '取消', value: false }
        ]
      });
      if (quit) call('quitNow');
    });
    els.dataFolderBtn.addEventListener('click', () => { audio.select(); call('openDataFolder'); });
    els.dataFolderBtn.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        audio.select();
        call('openDataFolder');
      }
    });

    if (els.appearanceClose) {
      els.appearanceClose.addEventListener('click', () => closeAppearance());
    }
    els.appearanceOverlay.addEventListener('pointerdown', (event) => {
      if (event.target === els.appearanceOverlay) closeAppearance();
    });
    els.styleChoices.addEventListener('click', (event) => {
      const button = event.target.closest('.style-choice');
      if (!button) return;
      setStyleMode(button.dataset.style, { silent: true });
    });
    els.typeShuffleBtn.addEventListener('click', shuffleTypeDirection);
    els.appearanceOptions.addEventListener('scroll', updateAppearanceScrollState, { passive: true });
    els.appearanceSwitcher.addEventListener('click', (event) => {
      const chip = event.target.closest('.game-chip');
      if (!chip) return;
      selectGame(Number(chip.dataset.index), { sound: true, animate: true });
    });
    els.appearanceSoundRow.addEventListener('click', () => setSound(!state.settings.sound, false));
    els.appearanceMotionRow.addEventListener('click', () => setReduceMotion(!state.settings.reduceMotion, false));
    els.appearanceCalmRow.addEventListener('click', () => setCalm(!state.settings.calm, false));
    els.calmRow.addEventListener('click', () => setCalm(!state.settings.calm));
    els.appearanceFullscreenRow.addEventListener('click', () => toggleFullscreen(false, true));
    els.fullscreenPill.addEventListener('click', () => toggleFullscreen());

    // Auto-hide the fullscreen exit pill while the pointer is still.
    document.addEventListener('pointermove', () => {
      if (!state.fullscreen) return;
      document.documentElement.classList.remove('idle');
      scheduleFullscreenIdle();
    }, { passive: true });
    els.openDataRow.addEventListener('click', () => { audio.select(); call('openDataFolder'); });

    /* editor */
    els.editorClose.addEventListener('click', () => closeEditor());
    els.editorCancel.addEventListener('click', () => closeEditor());
    els.editorOverlay.addEventListener('pointerdown', (event) => {
      if (event.target === els.editorOverlay) closeEditor();
    });
    els.editorSave.addEventListener('click', saveEditor);
    els.editorDelete.addEventListener('click', async () => {
      const game = currentGame();
      if (!game) return;
      closeEditor({ focus: false, sound: false });
      await call('deleteGame', { id: game.id });
      const index = state.games.findIndex((entry) => entry.id === game.id);
      if (index >= 0) state.games.splice(index, 1);
      if (state.index >= state.games.length) state.index = Math.max(0, state.games.length - 1);
      rebuildAfterLibraryChange(false);
      toast(`已从游戏库移除《${shortName(game)}》`, 'check');
    });
    els.fPickExe.addEventListener('click', async () => {
      const path = await window.NovaOverlays.pickerOpen({ filter: 'exe' });
      if (path) await adoptExecutable(path);
    });
    els.fPickLauncher.addEventListener('click', async () => {
      const path = await window.NovaOverlays.pickerOpen({ filter: 'exe' });
      if (path) els.fLauncher.value = path;
    });

    /* genre combo · 可输可选：input keeps free typing, the chevron lists the
       types already present in the library. The popup reuses the themed
       --menu-* tokens so it reads like every other dropdown. */
    const genreCombo = $('#genreCombo');
    const genreMenu = document.createElement('div');
    genreMenu.className = 'nova-select-menu genre-menu';
    genreMenu.setAttribute('role', 'listbox');
    genreMenu.hidden = true;
    genreCombo.appendChild(genreMenu);
    const closeGenreMenu = () => { genreMenu.hidden = true; };
    const openGenreMenu = () => {
      const typed = els.fGenre.value.trim().toLowerCase();
      const options = libraryTypeOptions().filter((type) => !typed || type.toLowerCase().includes(typed));
      genreMenu.innerHTML = options.length
        ? options.map((type) => `<button type="button" class="nova-select-option" role="option">${esc(type)}</button>`).join('')
        : '<div class="genre-menu-empty">还没有可选择的类型 · 直接输入新类型</div>';
      genreMenu.hidden = false;
    };
    els.fGenrePick.addEventListener('click', (event) => {
      event.stopPropagation();
      if (genreMenu.hidden) openGenreMenu(); else closeGenreMenu();
    });
    genreMenu.addEventListener('click', (event) => {
      const option = event.target.closest('.nova-select-option');
      if (!option) return;
      els.fGenre.value = option.textContent.trim();
      closeGenreMenu();
      try { els.fGenre.focus({ preventScroll: true }); } catch (error) {}
    });
    els.fGenre.addEventListener('input', () => {
      if (!genreMenu.hidden) openGenreMenu();
    });
    document.addEventListener('pointerdown', (event) => {
      if (genreMenu.hidden) return;
      if (!genreCombo.contains(event.target)) closeGenreMenu();
    });
    els.fExe.addEventListener('change', () => {
      const value = els.fExe.value.trim();
      if (value) adoptExecutable(value, { quiet: true });
    });
    // One entry for every way a cover path enters the field: the picker, a
    // typed path + Enter, or the format dossier. The host thumbnails the file
    // and returns a data URL, so the preview updates the moment a path is
    // usable — not after a save round-trip.
    function previewImageFromPath(rawPath) {
      const path = cleanPath(rawPath);
      if (!path) {
        els.editorPreviewImg.classList.remove('is-loaded');
        els.editorPreviewImg.removeAttribute('src');
        els.editorPreviewHint.textContent = els.fExe.value
          ? '保存后从真实封面或程序图标生成'
          : '从可执行文件或图片生成封面';
        return;
      }
      els.fImage.value = path;
      call('readImagePreview', { path }).then((preview) => {
        if (preview && preview.ok) {
          els.editorPreviewImg.onload = () => els.editorPreviewImg.classList.add('is-loaded');
          els.editorPreviewImg.src = preview.url;
          els.editorPreviewHint.textContent = '拖动画面 / 滚轮缩放 · 保存后应用';
        } else {
          els.editorPreviewHint.textContent = (preview && preview.error) || '无法读取这张图片';
        }
      });
    }

    els.fPickImage.addEventListener('click', async () => {
      const path = await window.NovaOverlays.pickerOpen({ filter: 'image' });
      if (!path) return;
      previewImageFromPath(path);
    });
    // Typing / pasting a path and pressing Enter must behave exactly like the
    // picker — before this, the field only came alive through the picker and
    // a hand-typed path silently did nothing until save.
    els.fImage.addEventListener('change', () => previewImageFromPath(els.fImage.value));
    els.fImage.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        previewImageFromPath(els.fImage.value);
      }
    });

    /* format dossier */
    els.dossierImport.addEventListener('click', importDossier);
    els.dossierExport.addEventListener('click', exportDossier);
    els.dossierText.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        importDossier();
      }
    });
    [els.fName, els.fLogo].forEach((input) => input.addEventListener('input', syncEditorPreview));
    if (els.fTypeRecipe) els.fTypeRecipe.addEventListener('change', syncEditorPreview);

    /* import sheet */
    els.importClose.addEventListener('click', () => closeImport());
    els.importLater.addEventListener('click', () => {
      dismissFirstRun();
      closeImport();
      toast('随时可以从右上角的 + 添加游戏', 'info');
    });
    els.importOverlay.addEventListener('pointerdown', (event) => {
      if (event.target !== els.importOverlay) return;
      dismissFirstRun();
      closeImport();
    });
    els.importChoices.addEventListener('click', (event) => {
      const choice = event.target.closest('.import-choice');
      if (!choice) return;
      chooseImportMode(choice.dataset.mode);
    });
    els.importGo.addEventListener('click', advanceImport);

    /* scanner */
    els.scannerClose.addEventListener('click', () => closeScanner());
    els.scannerOverlay.addEventListener('pointerdown', (event) => {
      if (event.target === els.scannerOverlay) closeScanner();
    });
    els.scannerRescan.addEventListener('click', () => { scanSelection.clear(); startScan(); });
    els.scannerManual.addEventListener('click', () => {
      closeScanner({ focus: false, sound: false });
      openEditor();
    });
    els.scannerImport.addEventListener('click', importSelected);
    els.scanSelectAll.addEventListener('click', toggleScanAll);
    els.scannerSearch.addEventListener('input', () => {
      state.scanQuery = els.scannerSearch.value || '';
      if (state.scan) renderScanResults(state.scan, state.manifestScan);
    });
    els.scannerList.addEventListener('click', (event) => {
      const pick = event.target.closest('.scan-pick');
      if (pick) {
        toggleScanGroup(pick.dataset.pickGroup);
        return;
      }
      const row = event.target.closest('.scan-row');
      if (!row || row.disabled) return;
      toggleScanRow(row.dataset.scan);
      audio.select();
    });

    document.addEventListener('pointerdown', (event) => {
      if (event.target.closest('#notifPanel, #notifBtn, #profileMenu, #profileBtn')) return;
      closePopovers();
    }, true);

    els.rail.addEventListener('pointerover', (event) => {
      if (event.pointerType !== 'mouse' || state.overlay) return;
      const tile = event.target.closest('.tile');
      if (!tile) return;
      const index = Number(tile.dataset.index);
      if (index === state.index) return;
      clearTimeout(state.hoverTimer);
      state.hoverTimer = setTimeout(() => selectGame(index, { sound: false }), 140);
    });
    els.rail.addEventListener('pointerleave', () => clearTimeout(state.hoverTimer));
    els.rail.addEventListener('focusin', (event) => {
      const tile = event.target.closest('.tile');
      if (!tile) return;
      const index = Number(tile.dataset.index);
      if (index !== state.index) selectGame(index, { sound: false, scroll: true });
    });
    els.rail.addEventListener('click', (event) => {
      const tile = event.target.closest('.tile');
      if (!tile) return;
      clearTimeout(state.hoverTimer);
      selectGame(Number(tile.dataset.index), { sound: true, scroll: true });
    });
    els.rail.addEventListener('keydown', (event) => {
      if ((event.key === 'Enter' || event.key === ' ') && event.target.closest('.tile')) {
        event.preventDefault();
        event.stopPropagation();
        handlePrimary();
      }
    });
    els.rail.addEventListener('wheel', (event) => {
      if (state.overlay) return;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (Math.abs(delta) < 3) return;
      event.preventDefault();
      const now = performance.now();
      if (now < state.wheelLock) return;
      state.wheelLock = now + 260;
      selectGame(state.index + (delta > 0 ? 1 : -1), { sound: true, scroll: true });
    }, { passive: false });

    document.addEventListener('fullscreenchange', syncFullscreenLabels);
  }

  function initParallax() {
    if (state.settings.reduceMotion) return;
    if (state.system && state.system.tier !== 'full') return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    let frame = null;
    let targetX = 0;
    let targetY = 0;
    window.addEventListener('pointermove', (event) => {
      if (state.overlay || state.settings.reduceMotion) return;
      targetX = (event.clientX / window.innerWidth - .5) * -14;
      targetY = (event.clientY / window.innerHeight - .5) * -8;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        els.sceneStack.style.transform = `translate3d(${targetX}px, ${targetY}px, 0) scale(1.02)`;
        frame = null;
      });
    });
  }
