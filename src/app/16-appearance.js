/* ============================================================
   APP PART 16 · appearance —— 外观工作室 —— 取景浮层、封面定位/缩放（只写 HeroPosition/HeroZoom）
   这是 src/app/ 分片之一：由 tools/build-app.js 按文件名序拼回 src/app.js。
   所有分片共享同一个 IIFE 闭包（跨分片直接引用函数与 state）。
   改代码请改分片，改完运行 node tools/build-app.js；直接编辑 app.js 会被覆盖。
   ============================================================ */

  /* ============================================================
     APPEARANCE STUDIO
     ============================================================ */

  function buildAppearanceSwitcher() {
    els.appearanceSwitcher.innerHTML = state.games.map((game, index) => `
      <button class="game-chip" data-index="${index}" aria-label="预览 ${esc(game.zh || game.name)}">
        <img src="${esc(game.coverUrl)}" alt="" loading="lazy" draggable="false" style="object-position:${esc(game.coverPosition)}">
      </button>
    `).join('');
    els.appearanceSwitcher.hidden = state.games.length === 0;
  }

  function syncAppearanceChips() {
    $$('.game-chip', els.appearanceSwitcher).forEach((chip) => {
      const active = Number(chip.dataset.index) === state.index;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-current', active ? 'true' : 'false');
    });
    if (state.view !== 'appearance') return;
    const chip = $('.game-chip.is-active', els.appearanceSwitcher);
    if (!chip) return;
    const switcherRect = els.appearanceSwitcher.getBoundingClientRect();
    const chipRect = chip.getBoundingClientRect();
    const delta = (chipRect.left + chipRect.width / 2) - (switcherRect.left + switcherRect.width / 2);
    els.appearanceSwitcher.scrollBy({ left: delta, behavior: state.settings.reduceMotion ? 'auto' : 'smooth' });
  }

  function applyStyleModeUI() {
    const game = currentGame();
    const adaptive = state.settings.styleMode === 'adaptive';
    document.documentElement.classList.toggle('is-nova-system', !adaptive);
    applyAccent(game);

    setElementCta(els.playBtn, adaptive ? 'cta-adaptive' : 'cta-system', game);
    setElementCta(els.detailPlay, adaptive ? 'cta-adaptive' : 'cta-system', game);
    setElementCta(els.appearanceCta, adaptive ? 'cta-adaptive' : 'cta-system', game);
    setElementCta(els.adaptivePreviewCta, 'cta-adaptive', game, true);
    setElementCta(els.systemPreviewCta, 'cta-system', game);
    setElementCta(els.editorSave, adaptive ? 'cta-adaptive' : 'cta-system', game);
    setElementCta(els.scannerImport, adaptive ? 'cta-adaptive' : 'cta-system', game);

    setLogo(els.gameLogo, game, 'hero-logo');
    setLogo(els.detailLogo, game, 'detail-logo');
    setLogo(els.appearanceLogo, game, 'appearance-logo');
    setLogo(els.launchLogo, game, 'launch-logo');
    const choiceText = game ? shortName(game) : 'GUGUOVA';
    setLogo(els.adaptiveChoiceLogo, game, 'choice-logo', { forceMode: 'adaptive', text: choiceText });
    setLogo(els.systemChoiceLogo, game, 'choice-logo', { forceMode: 'system', text: choiceText });

    const action = actionInfo(game);
    if (els.appearanceCtaLabel) els.appearanceCtaLabel.textContent = action.label;
    const use = els.appearanceCta ? $('use', els.appearanceCta) : null;
    if (use) use.setAttribute('href', `#i-${action.icon}`);

    if (els.appearanceCtaNote) els.appearanceCtaNote.textContent = adaptive ? '跟随封面' : 'GUGUOVA 默认';
    if (els.appearanceModeLabel) els.appearanceModeLabel.textContent = adaptive ? '跟随封面' : 'GUGUOVA 默认';
    if (els.styleModeTag) els.styleModeTag.textContent = adaptive ? '跟随封面' : 'GUGUOVA 默认';

    $$('.style-choice', els.styleChoices).forEach((button) => {
      const active = button.dataset.style === state.settings.styleMode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    updateTypeReadout();
    if (state.view === 'appearance') requestAnimationFrame(updateAppearanceScrollState);
  }

  function setStyleMode(mode, options = {}) {
    if (mode !== 'adaptive' && mode !== 'system') return;
    if (state.settings.styleMode === mode && !options.force) return;
    state.settings.styleMode = mode;
    saveSettings();
    applyStyleModeUI();
    if (options.sound !== false) audio.toggle();
    if (!options.silent) toast(mode === 'adaptive' ? '外观语言 · 跟随封面' : '外观语言 · GUGUOVA 编辑系统', 'spark');
  }

  function renderAppearance() {
    const game = currentGame();
    const gameId = game ? game.id : null;
    // The switcher may have moved to another game while the framing panel was
    // open; save the previous game before adopting the new one.
    if (state.appearanceFramingGame && state.appearanceFramingGame !== gameId)
      flushAppearanceFramingSave(state.appearanceFramingGame);
    const heroSrc = game ? game.heroUrl : 'assets/backdrop.jpg';
    els.appearanceBg.src = heroSrc;
    els.appearanceImage.src = heroSrc;
    if (els.appearanceCropImg) els.appearanceCropImg.src = heroSrc;
    // While editing, keep the live framing; on a fresh render (or another
    // game) take the persisted values again.
    if (!state.appearanceEditing || state.appearanceFramingGame !== gameId) {
      state.appearanceFraming = framingFor(game);
      state.appearanceFramingGame = gameId;
    }
    syncAppearanceFraming();
    if (state.appearanceEditing) requestAnimationFrame(layoutAppearanceCrop);
    els.appearanceImage.alt = game ? `${game.zh || game.name} 主视觉` : 'GUGUOVA';
    if (els.appearanceEditBtn) els.appearanceEditBtn.hidden = !game;
    if (!game && state.appearanceEditing) setAppearanceEditing(false);

    setLogo(els.appearanceLogo, game, 'appearance-logo');
    els.appearanceTagline.textContent = game ? (game.tagline || '') : '选择游戏开始。';
    els.appearanceIndex.textContent = game ? `${String(state.index + 1).padStart(2, '0')} / ${String(state.games.length).padStart(2, '0')}` : '00 / 00';
    els.appearanceGameName.textContent = game ? shortName(game) : 'GUGUOVA';

    els.appearanceProgressFill.style.width = `${game ? playtimePct(game.playtimeSeconds) : 0}%`;
    applyTier(els.appearanceProgressFill.parentElement, game);
    els.appearanceProgressPct.textContent = game ? formatHoursShort(game.playtimeSeconds) : '0 小时';

    const colors = game && game.colors && game.colors.length ? game.colors : ['#ffb45e', '#ff6b79', '#f3e3c3', '#251318'];
    els.appearancePalette.innerHTML = colors.map((color) => `
      <span class="swatch"><i style="background:${esc(color)}"></i><em>${esc(String(color).toUpperCase())}</em></span>
    `).join('');

    els.appearanceDataPath.textContent = state.dataFolder || '';
    els.appearanceDataPath.title = state.dataFolder || '';
    syncAppearanceChips();
    syncSoundUI();
    syncMotionUI();
    renderThemes();
    applyStyleModeUI();
  }

  /* ---------- appearance hero framing ---------- */

  function layoutAppearanceCrop() {
    const overlay = els.appearanceCrop;
    const windowEl = els.appearanceCropWindow;
    if (!overlay || !windowEl || !state.appearanceEditing) return;
    const rect = overlay.getBoundingClientRect();
    const style = getComputedStyle(overlay);
    const padX = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
    const padY = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
    const availableW = Math.max(120, rect.width - padX);
    const availableH = Math.max(80, rect.height - padY);
    const ratio = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hero-frame-ratio')) || 16 / 9;
    let width = availableW;
    let height = width / ratio;
    if (height > availableH) {
      height = availableH;
      width = height * ratio;
    }
    windowEl.style.width = `${Math.round(width)}px`;
    windowEl.style.height = `${Math.round(height)}px`;
  }

  function syncAppearanceFraming() {
    const framing = state.appearanceFraming || framingFor(currentGame());
    applyHeroFraming(els.appearanceBg, framing, true);
    applyHeroFraming(els.appearanceImage, framing, true);
    applyHeroFraming(els.appearanceCropImg, framing, true);
    const x = Math.round(clampNumber(framing.x, 0, 100));
    const y = Math.round(clampNumber(framing.y, 0, 100));
    const zoom = Math.round(clampNumber(framing.zoom, 1, 2.4) * 100);
    if (els.appearanceFramingValue) els.appearanceFramingValue.textContent = `${x} · ${y} · ${zoom}%`;
    if (els.appearanceZoomLabel) els.appearanceZoomLabel.textContent = `${zoom}%`;
  }

  function setAppearanceEditing(on) {
    const game = currentGame();
    const next = !!on && !!game;
    if (!next && state.appearanceFramingGame) flushAppearanceFramingSave(state.appearanceFramingGame);
    state.appearanceEditing = next;
    if (els.appearanceEditBtn) els.appearanceEditBtn.setAttribute('aria-pressed', String(next));
    if (els.appearanceFraming) els.appearanceFraming.hidden = !next;
    if (els.appearancePreview) els.appearancePreview.classList.toggle('is-editing', next);
    if (next) {
      state.appearanceFraming = framingFor(game);
      state.appearanceFramingGame = game.id;
      if (els.appearanceCropImg) els.appearanceCropImg.src = game.heroUrl || 'assets/backdrop.jpg';
      syncAppearanceFraming();
      requestAnimationFrame(layoutAppearanceCrop);
      audio.select();
    } else {
      audio.close();
    }
  }

  function stepAppearanceFraming(action) {
    const framing = state.appearanceFraming;
    if (!framing) return;
    if (action === 'left') framing.x -= 2;
    else if (action === 'right') framing.x += 2;
    else if (action === 'up') framing.y -= 2;
    else if (action === 'down') framing.y += 2;
    else if (action === 'zoom-in') framing.zoom += 0.1;
    else if (action === 'zoom-out') framing.zoom -= 0.1;
    else if (action === 'reset') { framing.x = 50; framing.y = 45; framing.zoom = 1; }
    framing.x = clampNumber(framing.x, 0, 100);
    framing.y = clampNumber(framing.y, 0, 100);
    framing.zoom = clampNumber(framing.zoom, 1, 2.4);
    syncAppearanceFraming();
    scheduleAppearanceFramingSave();
    audio.toggle();
  }

  function scheduleAppearanceFramingSave() {
    const game = currentGame();
    if (!game || !state.appearanceFraming) return;
    const framing = state.appearanceFraming;
    const payload = {
      heroPosition: `${Math.round(framing.x)}% ${Math.round(framing.y)}%`,
      heroZoom: Number(framing.zoom.toFixed(2))
    };
    const existing = state.appearanceSaveTimers.get(game.id);
    if (existing) clearTimeout(existing.timer);
    const gameId = game.id;
    const timer = setTimeout(() => {
      state.appearanceSaveTimers.delete(gameId);
      commitAppearanceFraming(gameId, payload);
    }, 450);
    state.appearanceSaveTimers.set(gameId, { timer, payload });
  }

  function flushAppearanceFramingSave(gameId) {
    const pending = state.appearanceSaveTimers.get(gameId);
    if (!pending) return;
    clearTimeout(pending.timer);
    state.appearanceSaveTimers.delete(gameId);
    commitAppearanceFraming(gameId, pending.payload);
  }

  async function commitAppearanceFraming(gameId, payload) {
    const game = state.games.find((entry) => entry.id === gameId);
    if (!game) return;
    // Optimistic: the home backdrop and detail sheet read the same fields.
    game.heroPosition = payload.heroPosition;
    game.heroZoom = payload.heroZoom;
    const result = await call('updateGame', { id: gameId, ...payload });
    if (!result || !result.ok) {
      audio.error();
      toast(result?.error || '取景保存失败', 'alert');
      return;
    }
    if (result.game) Object.assign(game, result.game);
    if (currentGame() && currentGame().id === gameId) setBackdrop(game, true);
  }

  function bindAppearanceFraming() {
    if (!els.appearanceEditBtn) return;
    els.appearanceEditBtn.addEventListener('click', () => setAppearanceEditing(!state.appearanceEditing));
    if (els.appearanceFramingDone) els.appearanceFramingDone.addEventListener('click', () => setAppearanceEditing(false));
    if (els.appearanceFraming) {
      els.appearanceFraming.addEventListener('click', (event) => {
        const button = event.target.closest('[data-frame]');
        if (!button) return;
        event.stopPropagation();
        stepAppearanceFraming(button.dataset.frame);
      });
    }

    const preview = els.appearancePreview;
    if (!preview) return;
    let drag = null;
    preview.addEventListener('pointerdown', (event) => {
      if (!state.appearanceEditing || event.button !== 0 || !state.appearanceFraming) return;
      if (event.target.closest('button')) return;
      const rect = preview.getBoundingClientRect();
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
        framing: { x: state.appearanceFraming.x, y: state.appearanceFraming.y }
      };
      try { preview.setPointerCapture(event.pointerId); } catch (error) {}
      event.preventDefault();
    });
    preview.addEventListener('pointermove', (event) => {
      if (!drag || event.pointerId !== drag.pointerId || !state.appearanceFraming) return;
      // A pointerup outside the preview must not leave a drag armed: without
      // the button held, hovering would keep panning the artwork.
      if (event.pointerType === 'mouse' && (event.buttons & 1) === 0) {
        drag = null;
        return;
      }
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      state.appearanceFraming.x = clampNumber(drag.framing.x - (dx / drag.width) * 120, 0, 100);
      state.appearanceFraming.y = clampNumber(drag.framing.y - (dy / drag.height) * 120, 0, 100);
      syncAppearanceFraming();
    });
    const endDrag = (event) => {
      if (!drag) return;
      if (event && event.pointerId != null && event.pointerId !== drag.pointerId) return;
      drag = null;
      if (event) {
        try { preview.releasePointerCapture(event.pointerId); } catch (error) {}
      }
      scheduleAppearanceFramingSave();
    };
    preview.addEventListener('pointerup', endDrag);
    preview.addEventListener('pointercancel', endDrag);
    preview.addEventListener('lostpointercapture', endDrag);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
  }

  function updateAppearanceScrollState() {
    if (!els.appearanceOptions) return;
    const el = els.appearanceOptions;
    const scrollable = el.scrollHeight > el.clientHeight + 4;
    el.classList.toggle('is-scrollable', scrollable);
    el.classList.toggle('is-at-end', !scrollable || el.scrollTop + el.clientHeight >= el.scrollHeight - 10);
  }

