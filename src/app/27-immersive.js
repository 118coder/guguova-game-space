/* ============================================================
   APP PART 27 · immersive —— 沉稳模式双焦点行导航（键盘与手柄共用）+ 长按强杀 FORCE KILL
   这是 src/app/ 分片之一：由 tools/build-app.js 按文件名序拼回 src/app.js。
   所有分片共享同一个 IIFE 闭包（跨分片直接引用函数与 state）。
   改代码请改分片，改完运行 node tools/build-app.js；直接编辑 app.js 会被覆盖。
   ============================================================ */

  /* ============================================================
     IMMERSIVE NAV · two focus rows, pad and keyboard share them
     ------------------------------------------------------------
     The fullscreen home is a console surface: the action cluster
     and the icon strip are the only two places focus can be, and
     ↑/↓ moves between them while ←/→ walks inside one. In the strip
     ←/→ keeps its old meaning (switch game), because that is what a
     player already expects from the windowed page.
     ============================================================ */

  const IMMERSIVE_ACTIONS = ['.hero-inner #playBtn', '.hero-inner #detailBtn',
    '.hero-inner #homeEngineBtn', '.hero-inner #homeScaleRow'];

  /* The immersive page belongs to 沉稳模式, not to fullscreen. Fullscreen is a
     window state the player may want on its own (just a bigger view of the
     normal page); binding the layout to it replaced that page with a second
     design nobody asked for. */
  function immersiveHome() {
    return state.view === 'home' && state.settings.calm &&
      !state.overlay && !state.manageOpen && !state.menuOpen &&
      !document.querySelector('.dialog-overlay.is-open') &&
      !document.querySelector('.picker-overlay.is-open');
  }

  function immersiveActionEls() {
    const root = els.homeView || document;
    return IMMERSIVE_ACTIONS
      .map((sel) => root.querySelector(sel))
      .filter((el) => el && el.offsetParent !== null && !el.disabled);
  }

  function immersiveTileEls() {
    const root = els.homeView || document;
    return Array.from(root.querySelectorAll('.rail .tile')).filter((el) => el.offsetParent !== null);
  }

  let immersiveRingEl = null;

  /** Draw the pad ring on whatever we just moved to, without pretending
      the input device changed. */
  function immersiveRing(el) {
    if (!el) return;
    if (immersiveRingEl && immersiveRingEl !== el) immersiveRingEl.classList.remove('is-pad-focus');
    immersiveRingEl = el;
    el.classList.add('is-pad-focus');
    try { el.focus({ preventScroll: true }); } catch (error) {}
    try { el.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (error) {}
  }

  function immersiveStep(dx, dy) {
    if (!immersiveHome()) return false;
    const actions = immersiveActionEls();
    const tiles = immersiveTileEls();
    const active = document.activeElement;
    const inActions = !!(active && active.closest && active.closest('.hero-inner'));
    const inStrip = !!(active && active.closest && active.closest('.rail'));

    // ↓ from the actions (or from nowhere) lands on the strip.
    if (dy > 0) {
      if (inActions || !inStrip) {
        const target = tiles.find((t) => t.classList.contains('is-active')) || tiles[0];
        if (target) { immersiveRing(target); audio.move(1); return true; }
        return false;
      }
      return false;
    }
    // ↑ from the strip goes back to the actions, to the primary button.
    if (dy < 0) {
      if (inStrip) {
        const target = actions[0] || actions[actions.length - 1];
        if (target) { immersiveRing(target); audio.move(-1); return true; }
        return false;
      }
      return false;
    }
    // ←/→ inside the actions wraps; inside the strip it switches games.
    if (inActions) {
      const index = actions.indexOf(active);
      if (index === -1) { immersiveRing(actions[0]); return true; }
      const next = actions[(index + dx + actions.length) % actions.length];
      immersiveRing(next);
      audio.move(dx);
      return true;
    }
    if (inStrip) {
      selectGame(state.index + dx, { sound: true, scroll: true });
      const tile = immersiveTileEls().find((t) => t.classList.contains('is-active'));
      if (tile) immersiveRing(tile);
      return true;
    }
    // Nothing focused yet: first arrow press puts the ring on the primary
    // action instead of silently switching games.
    if (actions.length) { immersiveRing(actions[0]); return true; }
    return false;
  }

  function immersiveActivate() {
    if (!immersiveHome()) return false;
    const active = document.activeElement;
    if (!active || !active.closest || !active.closest('.hero-inner, .rail')) return false;
    if (active.tagName === 'BUTTON' || active.getAttribute('role') === 'checkbox') {
      active.click();
      return true;
    }
    return false;
  }

  const padApp = {
    nav(delta) {
      const scope = padScope();
      if (padDialogOpen() || padPickerOpen() || PAD_FOCUS_SCOPES.has(scope)) { padMoveFocus(delta, 0); return; }
      if (scope === 'home' && immersiveStep(delta, 0)) return;
      if (scope === 'home') selectGame(state.index + delta, { sound: true, scroll: true });
    },
    navVertical(delta) {
      if (padScope() === 'home' && immersiveStep(0, delta)) return;
      padVertical(delta);
    },
    confirm() {
      const scope = padScope();
      if (padDialogOpen() || padPickerOpen() || PAD_FOCUS_SCOPES.has(scope)) { padActivate(); return; }
      if (scope === 'home' && immersiveActivate()) { audio.select(); return; }
      if (scope === 'sleep') { exitSleep(); return; }
      if (scope === 'launch') { return; }
      handlePrimary();
    },
    back() {
      if (padDialogOpen()) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        return;
      }
      if (padPickerOpen()) {
        const close = document.getElementById('pickerClose');
        if (close) close.click();
        return;
      }
      const scope = padScope();
      if (scope === 'sleep') { exitSleep(); return; }
      if (scope === 'launch') { closeLaunch(); return; }
      if (scope === 'editor') { closeEditor(); return; }
      if (scope === 'scanner') { closeScanner(); return; }
      if (scope === 'appearance') { closeAppearance(); return; }
      if (scope === 'settings') { closeSettings(); return; }
      if (scope === 'details') {
        if (state.manageOpen) closeManage();
        else closeDetails();
        return;
      }
      if (scope === 'library') { closeLibrary(); return; }
      closePopovers();
    },
    favorite() {
      const scope = padScope();
      if (scope === 'home' || scope === 'details' || scope === 'library') toggleFavorite(currentGame());
    },
    manage() {
      const scope = padScope();
      if (scope === 'appearance') { shuffleTypeDirection(); return; }
      if (scope === 'details') {
        if (state.manageOpen) closeManage();
        else openManage();
      }
    },
    library() {
      const scope = padScope();
      if (scope === 'home') openLibrary();
      else if (scope === 'library') closeLibrary();
    },
    appearance() {
      const scope = padScope();
      if (scope === 'home') openAppearance();
      else if (scope === 'appearance') closeAppearance();
    },
    notifications() {
      const scope = padScope();
      if (scope === 'home') openPopover('notif');
      else if (scope === 'notifications') closePopovers();
    },
    settings() {
      if (state.overlay) return;
      if (state.view === 'settings') closeSettings();
      else openSettings();
    },
    pageUp() { padPage(-1); },
    pageDown() { padPage(1); },
    padConnected(layout, id) {
      audio.select();
      toast(`${layout === 'playstation' ? 'PlayStation' : 'Xbox'} 手柄已连接 · 方向键移动 / ${layout === 'playstation' ? '✕' : 'A'} 选择`, 'gamepad');
      if (window.NovaFocus && window.NovaFocus.refresh) window.NovaFocus.refresh();
      padEnsureFocus();
      refreshPadHints();
    },
    padDisconnected() {
      toast('手柄已断开 · 可使用键盘', 'gamepad');
    }
  };

  function syncInputStatus(label) {
    if (els.profileStatus) els.profileStatus.textContent = label ? `${label} 已连接` : '本地游戏库';
  }

  function startGamepad() {
    if (!window.NovaPad) return;
    window.NovaPad.start(padApp, els.inputStatus);
  }

  /* ============================================================
     FORCE KILL · long-press the running button (developer mode)
     ============================================================ */

  const FORCE_KILL_MS = 3000;

  function canForceKill(game) {
    // Administrator mode: the launcher runs elevated, so the kill can reach
    // any game process — Task Manager style. No developer flag involved.
    return !!game && state.running.has(game.id) && state.elevated;
  }

  function ensureHoldCover(button) {
    let cover = button.querySelector('.btn-hold-cover');
    if (!cover) {
      cover = document.createElement('span');
      cover.className = 'btn-hold-cover';
      button.appendChild(cover);
    }
    return cover;
  }

  function cancelForceHold(button) {
    if (!state.forceKill.active) return;
    state.forceKill.active = false;
    cancelAnimationFrame(state.forceKill.raf);
    button.classList.remove('is-holding');
    button.style.removeProperty('--hold-p');
  }

  function beginForceHold(button, game) {
    ensureHoldCover(button);
    const start = performance.now();
    state.forceKill.active = true;
    button.classList.add('is-holding');
    button.style.setProperty('--hold-p', '0');
    const step = (now) => {
      if (!state.forceKill.active) return;
      const pct = Math.min(1, (now - start) / FORCE_KILL_MS);
      // The theme's sweep layer starts fully in and retreats backwards;
      // the CSS drives both the layer position and the label ink off this
      // one variable.
      button.style.setProperty('--hold-p', pct.toFixed(4));
      if (pct >= 1) {
        state.forceKill.active = false;
        button.classList.remove('is-holding');
        button.style.removeProperty('--hold-p');
        // Swallow the click this release will produce: the hold already ran
        // its action, the manage panel should not open on top of it.
        state.forceKill.suppressClick = true;
        forceStopGame(game);
        return;
      }
      state.forceKill.raf = requestAnimationFrame(step);
    };
    state.forceKill.raf = requestAnimationFrame(step);
  }

  async function forceStopGame(game) {
    toast(`正在强制结束《${shortName(game)}》…`, 'stop');
    const result = await call('stop', { id: game.id });
    if (!result || !result.ok) {
      toast(result?.error || '强制结束失败', 'alert');
    }
  }

  function bindForceKill() {
    const button = els.playBtn;
    if (!button || button.dataset.forceKillBound) return;
    button.dataset.forceKillBound = '1';
    button.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      const game = currentGame();
      if (!canForceKill(game)) return;
      beginForceHold(button, game);
    });
    for (const type of ['pointerup', 'pointerleave', 'pointercancel']) {
      button.addEventListener(type, () => cancelForceHold(button));
    }
  }
