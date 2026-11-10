/* ============================================================
   APP PART 26 · input —— 键盘 KEYBOARD + 手柄适配 GAMEPAD ADAPTER
   这是 src/app/ 分片之一：由 tools/build-app.js 按文件名序拼回 src/app.js。
   所有分片共享同一个 IIFE 闭包（跨分片直接引用函数与 state）。
   改代码请改分片，改完运行 node tools/build-app.js；直接编辑 app.js 会被覆盖。
   ============================================================ */

  /* ============================================================
     KEYBOARD
     ============================================================ */

  function isTypingTarget(target) {
    return target instanceof Element && !!target.closest('input, textarea, select, [contenteditable="true"]');
  }

  function isButtonTarget(target) {
    return target instanceof Element && !!target.closest('button, a, input, [tabindex]');
  }

  function bindKeyboard() {
    document.addEventListener('keydown', (event) => {
      // The intro owns the first input only to skip itself.
      if (window.NovaIntro && window.NovaIntro.active) {
        event.preventDefault();
        window.NovaIntro.skip();
        return;
      }
      // The hotkey recorder owns every key while it is armed.
      if (state.hotkeyRecording) {
        if (event.key === 'Escape') {
          event.preventDefault();
          cancelHotkeyRecording();
          return;
        }
        const vk = vkForHotkey(event.key);
        if (!vk) return;
        const modifiers = (event.altKey ? 0x400 : 0) | (event.ctrlKey ? 0x200 : 0) |
          (event.shiftKey ? 0x800 : 0) | (event.metaKey ? 0x100 : 0);
        if (!modifiers) {
          if (els.settingsHotkeyHint) els.settingsHotkeyHint.textContent = '至少加一个修饰键';
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        commitHotkey(modifiers | vk);
        return;
      }

      // In-app dialog and file browser own the keyboard while open.
      if (window.NovaOverlays && window.NovaOverlays.dialogOpen()) return;
      if (window.NovaOverlays && window.NovaOverlays.pickerOpenState()) {
        if (window.NovaOverlays.pickerKey(event.key)) event.preventDefault();
        return;
      }

      // The appearance preview's framing editor owns the arrow keys and
      // +/- while it is open; otherwise they would switch games.
      if (state.appearanceEditing) {
        if (event.key === 'Escape') {
          event.preventDefault();
          setAppearanceEditing(false);
          return;
        }
        const frameAction = {
          ArrowLeft: 'left',
          ArrowRight: 'right',
          ArrowUp: 'up',
          ArrowDown: 'down',
          '+': 'zoom-in',
          '=': 'zoom-in',
          '-': 'zoom-out',
          '0': 'reset'
        }[event.key];
        if (frameAction) {
          event.preventDefault();
          stepAppearanceFraming(frameAction);
          return;
        }
      }

      if (state.overlay === 'sleep') {
        event.preventDefault();
        exitSleep();
        return;
      }

      if (state.overlay === 'editor' || state.overlay === 'scanner') {
        if (event.key === 'Escape') {
          event.preventDefault();
          if (state.overlay === 'editor') closeEditor();
          else closeScanner();
        }
        return;
      }

      if (state.overlay === 'launch') {
        // Only Esc leaves the launch surface. Every other key used to close
        // it once the overlay reached "ready", which meant a stray keystroke
        // (or a click on the overlay) dropped the player out of the launch
        // sequence by accident. Gamepad B still maps to a deliberate Back.
        if (event.key === 'Escape') {
          event.preventDefault();
          closeLaunch();
        }
        return;
      }

      if (state.overlay === 'share') {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeShareDialog();
        }
        return;
      }

      if (state.overlay === 'engine') {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeEngineDialog();
        }
        return;
      }

      if (state.overlay === 'import') {
        if (event.key === 'Escape') {
          event.preventDefault();
          dismissFirstRun();
          closeImport();
        }
        return;
      }

      if (event.key === 'Escape') {
        if (state.view === 'appearance') {
          event.preventDefault();
          closeAppearance();
          return;
        }
        if (state.overlay === 'details') {
          event.preventDefault();
          if (state.manageOpen) closeManage();
          else closeDetails();
          return;
        }
        if (state.view === 'library') {
          event.preventDefault();
          closeLibrary();
          return;
        }
        if (state.menuOpen) {
          event.preventDefault();
          closeContextMenu();
          return;
        }
        if (state.fullscreen) {
          event.preventDefault();
          applyFullscreen(false);
          return;
        }
        closePopovers();
        return;
      }

      if (state.view === 'appearance') {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          selectGame(state.index - 1, { sound: true, animate: true });
          return;
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          selectGame(state.index + 1, { sound: true, animate: true });
          return;
        }
        if (event.key === 't' || event.key === 'T') {
          event.preventDefault();
          closeAppearance();
          return;
        }
        if (event.key === 'r' || event.key === 'R') {
          event.preventDefault();
          shuffleTypeDirection();
          return;
        }
        return;
      }

      if (state.overlay === 'details') {
        if (isTypingTarget(event.target)) return;
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          selectGame(state.index - 1, { sound: true, scroll: true });
          return;
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          selectGame(state.index + 1, { sound: true, scroll: true });
          return;
        }
        if (event.key === 'm' || event.key === 'M') {
          event.preventDefault();
          if (state.manageOpen) closeManage();
          else openManage();
          return;
        }
        if (event.key === 'Enter' && !isButtonTarget(event.target)) {
          event.preventDefault();
          handlePrimary();
          return;
        }
        return;
      }

      if (state.view === 'library') {
        if (event.key === '/' && event.target !== els.libSearch) {
          event.preventDefault();
          els.libSearch.focus();
          return;
        }
        if (event.key === 'Enter' && event.target === els.libSearch) {
          event.preventDefault();
          openFirstLibraryResult();
          return;
        }
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      // Calm home: arrows belong to the two focus rows first, so the player
      // can walk onto a button and press Enter instead of having to remember
      // a shortcut. The guard used to be `state.fullscreen`; since 沉稳模式
      // owns the immersive layout, fullscreen alone no longer has those rows
      // and the guard silently disabled keyboard navigation. immersiveStep
      // returns false outside calm, so the switch below still sees the key.
      if (state.view === 'home') {
        const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
        if (step && immersiveStep(step[0], step[1])) {
          event.preventDefault();
          return;
        }
      }

      switch (event.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          if (event.key === 'a' || event.key === 'A') {
            event.preventDefault();
            openScanner();
            break;
          }
          event.preventDefault();
          selectGame(state.index - 1, { sound: true, scroll: true });
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          event.preventDefault();
          selectGame(state.index + 1, { sound: true, scroll: true });
          break;
        case 'Enter':
        case ' ':
          if (isButtonTarget(event.target)) return;
          event.preventDefault();
          handlePrimary();
          break;
        case 'i':
        case 'I':
          event.preventDefault();
          openDetails();
          break;
        case 'l':
        case 'L':
          event.preventDefault();
          if (state.view === 'library') setView('home');
          else openLibrary();
          break;
        case 't':
        case 'T':
          event.preventDefault();
          if (state.view === 'appearance') setView('home');
          else openAppearance();
          break;
        case 's':
        case 'S':
          if (event.ctrlKey || event.metaKey) return;
          event.preventDefault();
          if (state.view === 'settings') setView('home');
          else openSettings();
          break;
        case '/':
          event.preventDefault();
          openLibrary({ search: true });
          break;
        case 'n':
        case 'N':
          event.preventDefault();
          openPopover('notif');
          break;
        case 'm':
        case 'M':
          event.preventDefault();
          setSound(!state.settings.sound);
          break;
        case 'f':
        case 'F':
          event.preventDefault();
          toggleFullscreen();
          break;
        default:
          break;
      }
    });
  }

  function openFirstLibraryResult() {
    const first = els.libGrid.querySelector('.lib-card');
    if (first) first.click();
    else toast('没有匹配的游戏');
  }

  /* ============================================================
     GAMEPAD ADAPTER
     The pad module owns polling and layout; this adapter maps its
     abstract actions to whatever surface is currently in front.
     ============================================================ */

  function padScope() {
    if (state.overlay === 'sleep') return 'sleep';
    if (state.overlay === 'launch') return 'launch';
    if (state.overlay === 'editor') return 'editor';
    if (state.overlay === 'import') return 'import';
    if (state.overlay === 'scanner') return 'scanner';
    if (state.view === 'appearance') return 'appearance';
    if (state.view === 'settings') return 'settings';
    if (state.view === 'library') return 'library';
    if (state.overlay === 'details') return 'details';
    if (els.notifPanel.classList.contains('is-open')) return 'notifications';
    if (els.profileMenu.classList.contains('is-open')) return 'profile';
    return 'home';
  }

  function padDialogOpen() { return !!document.querySelector('.dialog-overlay.is-open'); }
  function padPickerOpen() { return !!document.querySelector('.picker-overlay.is-open'); }

  /** The focus surface under the pad: dialog > picker > overlay > current view. */
  function padSurface() {
    const dialog = document.querySelector('.dialog-overlay.is-open');
    if (dialog) return dialog;
    const picker = document.querySelector('.picker-overlay.is-open');
    if (picker) return picker;
    if (state.overlay === 'details') return $('.detail-modal', els.detailsOverlay) || els.detailsOverlay;
    if (state.overlay === 'editor') return $('.editor-shell', els.editorOverlay) || els.editorOverlay;
    if (state.overlay === 'import') return $('.import-shell', els.importOverlay) || els.importOverlay;
    if (state.overlay === 'scanner') return $('.scanner-shell', els.scannerOverlay) || els.scannerOverlay;
    if (els.notifPanel.classList.contains('is-open')) return els.notifPanel;
    if (els.profileMenu.classList.contains('is-open')) return els.profileMenu;
    if (state.view === 'settings') return $('#settingsView .settings-options') || $('#settingsView');
    if (state.view === 'appearance') return els.appearanceOptions || els.appearanceOverlay;
    if (state.view === 'library') return $('.lib-shell', els.libraryOverlay) || els.libraryOverlay;
    return els.homeView;
  }

  function padFocusableList() {
    const surface = padSurface();
    if (!surface) return [];
    const selector = 'button:not([disabled]), a[href], select:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.from(surface.querySelectorAll(selector)).filter((element) => {
      if (element.hasAttribute('data-pad-skip')) return false;
      if (element.closest('[hidden], [aria-hidden="true"]')) return false;
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      const style = getComputedStyle(element);
      return style.visibility !== 'hidden' && style.display !== 'none';
    });
  }

  let padFocused = null;

  function padSetFocus(element) {
    if (!element) return;
    if (padFocused && padFocused !== element) padFocused.classList.remove('is-pad-focus');
    padFocused = element;
    element.classList.add('is-pad-focus');
    if (window.NovaFocus && window.NovaFocus.setModality) window.NovaFocus.setModality('gamepad');
    try { element.focus({ preventScroll: true }); } catch (error) {}
    try { element.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (error) {}
  }

  function padEnsureFocus() {
    const list = padFocusableList();
    if (!list.length) { padFocused = null; return null; }
    const active = document.activeElement;
    if (active && list.includes(active)) padFocused = active;
    if (!padFocused || !list.includes(padFocused)) padSetFocus(list[0]);
    return padFocused;
  }

  function padMoveFocus(dx, dy) {
    const list = padFocusableList();
    if (!list.length) return;
    const active = padEnsureFocus();
    if (!active) return;
    // Linear DOM order: the settings board is two columns, so geometric
    // navigation skipped whole groups. Reading order guarantees every option
    // is reachable and matches what the player sees in the tab order.
    const index = Math.max(0, list.indexOf(active));
    const dir = (dx + dy) >= 0 ? 1 : -1;
    const next = list[(index + dir + list.length) % list.length];
    padSetFocus(next);
    audio.move(dir);
  }

  function padActivate() {
    const element = padEnsureFocus();
    if (!element) return;
    if (element.tagName === 'SELECT') {
      if (element.options.length) {
        element.selectedIndex = (element.selectedIndex + 1) % element.options.length;
        element.dispatchEvent(new Event('change', { bubbles: true }));
        audio.select();
      }
      return;
    }
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      try { element.focus(); element.select(); } catch (error) {}
      toast('手柄模式下请用键盘输入', 'keyboard');
      return;
    }
    element.click();
  }

  function padHintsFor(scope) {
    if (padDialogOpen()) return [['a', '确认'], ['b', '取消'], ['←→', '选择']];
    if (padPickerOpen()) return [['a', '选择'], ['b', '取消'], ['↑↓', '移动']];
    const hints = {
      home: [['a', '启动'], ['y', '详情'], ['x', '收藏'], ['lb/rb', '换游戏'], ['menu', '游戏库'], ['view', '通知'], ['ls', '外观'], ['rs', '设置']],
      details: [['a', '选择'], ['b', '返回'], ['x', '收藏'], ['y', '管理'], ['←→↑↓', '移动']],
      library: [['a', '打开'], ['b', '返回'], ['←→↑↓', '移动']],
      appearance: [['a', '选择'], ['b', '返回'], ['←→↑↓', '移动'], ['lb/rb', '换游戏'], ['y', '重排字标']],
      settings: [['a', '选择'], ['b', '返回'], ['←→↑↓', '移动'], ['lb/rb', '翻页']],
      launch: [['b', '返回'], ['a', '完成']],
      editor: [['a', '选择'], ['b', '关闭'], ['←→↑↓', '移动']],
      scanner: [['a', '选择'], ['b', '关闭'], ['←→↑↓', '移动']],
      sleep: [['a', '唤醒']],
      notifications: [['a', '选择'], ['b', '关闭'], ['↑↓', '移动']],
      profile: [['a', '选择'], ['b', '关闭'], ['↑↓', '移动']]
    };
    return hints[scope] || hints.home;
  }

  function refreshPadHints() {
    try {
      if (!window.NovaPad || !window.NovaPad.connected) return;
      window.NovaPad.hints(padHintsFor(padScope()));
      padEnsureFocus();
    } catch (error) {
      // Controller UI must never interrupt launch or navigation.
    }
  }

  function moveLibraryPadFocus(delta) {
    const cards = $$('.lib-card', els.libGrid);
    if (!cards.length) return;
    state.libPadIndex = (state.libPadIndex + delta + cards.length) % cards.length;
    const card = cards[state.libPadIndex];
    audio.move(delta);
    try {
      card.focus({ preventScroll: false });
      card.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    } catch (error) {}
  }

  function openLibraryCardByIndex(delta) {
    const cards = $$('.lib-card', els.libGrid);
    if (!cards.length) return;
    const focused = document.activeElement instanceof Element ? document.activeElement.closest('.lib-card') : null;
    const current = focused ? cards.indexOf(focused) : state.libPadIndex;
    state.libPadIndex = (current + delta + cards.length) % cards.length;
    const card = cards[state.libPadIndex];
    if (card) {
      try { card.focus({ preventScroll: false }); card.scrollIntoView({ block: 'nearest' }); } catch (error) {}
    }
  }

  const PAD_FOCUS_SCOPES = new Set(['settings', 'appearance', 'library', 'details', 'editor', 'scanner', 'notifications', 'profile']);

  function padVertical(delta) {
    const scope = padScope();
    if (padDialogOpen() || padPickerOpen() || PAD_FOCUS_SCOPES.has(scope)) {
      padMoveFocus(0, delta);
    }
  }

  function padPage(dir) {
    const scope = padScope();
    if (scope === 'home') { selectGame(state.index + dir, { sound: true, scroll: true }); return; }
    if (scope === 'appearance') {
      selectGame(state.index + dir, { sound: true, animate: true });
      return;
    }
    const scroller = document.querySelector('.picker-overlay.is-open .picker-list')
      || document.querySelector('.dialog-overlay.is-open .dialog-card')
      || padSurface();
    if (scroller && scroller.scrollBy) {
      scroller.scrollBy({ top: dir * 240, behavior: state.settings.reduceMotion ? 'auto' : 'smooth' });
    }
  }
