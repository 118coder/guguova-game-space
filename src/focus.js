(() => {
  'use strict';

  /* ============================================================
     NOVA · FOCUS MANAGER
     Keeps keyboard/controller focus inside the topmost surface,
     remembers where focus came from, and publishes the active
     input modality so the skin can draw the right focus ring.
     ============================================================ */

  const FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'textarea:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  const state = {
    lastOutside: null,
    current: null,
    modality: 'pointer'
  };

  const isVisible = (el) => {
    if (!el || !el.isConnected) return false;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') return false;
    return el.getBoundingClientRect().width > 0 || el.getBoundingClientRect().height > 0;
  };

  function topSurface() {
    const candidates = Array.from(document.querySelectorAll(
      '.overlay.is-open [role="dialog"], .overlay.is-open [role="alertdialog"], .dialog-overlay.is-open [role="alertdialog"]'
    )).filter(isVisible);
    if (!candidates.length) return null;
    return candidates[candidates.length - 1];
  }

  function focusables(container) {
    if (!container) return [];
    return Array.from(container.querySelectorAll(FOCUSABLE)).filter((el) => {
      if (el.closest('[aria-hidden="true"]')) return false;
      if (el.tabIndex < 0) return false;
      return isVisible(el);
    });
  }

  function focusFirst(container) {
    const list = focusables(container);
    if (!list.length) return false;
    try { list[0].focus({ preventScroll: true }); } catch (error) {}
    return true;
  }

  function current() {
    const surface = topSurface();
    if (!surface) return null;
    return state.current === surface ? surface : (state.current = surface);
  }

  function trap(event) {
    const container = current();
    if (!container) return;
    const list = focusables(container);
    if (!list.length) {
      event.preventDefault();
      return;
    }
    const first = list[0];
    const last = list[list.length - 1];
    const active = document.activeElement;

    if (!container.contains(active)) {
      event.preventDefault();
      first.focus({ preventScroll: true });
      return;
    }
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  }

  function setModality(value) {
    if (state.modality === value) return;
    state.modality = value;
    document.documentElement.dataset.input = value;
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
      trap(event);
      return;
    }
    setModality('keyboard');
  }, true);

  document.addEventListener('pointerdown', () => setModality('pointer'), true);

  document.addEventListener('focusin', (event) => {
    const container = current();
    if (!container) return;
    if (!container.contains(event.target)) {
      // A surface is open but focus escaped (native menus, programmatic
      // focus, controller helpers). Pull it back without stealing typing.
      const target = event.target;
      if (target && target.closest && target.closest('input, textarea')) return;
      focusFirst(container);
    }
  }, true);

  // When a surface opens, remember where we were and move focus in.
  let observerScheduled = false;

  function reconcile() {
    observerScheduled = false;
    const container = current();
    if (container) {
      if (!state.lastOutside || !document.contains(state.lastOutside)) {
        state.lastOutside = document.activeElement;
      }
      if (!container.contains(document.activeElement)) {
        setTimeout(() => {
          if (!container.contains(document.activeElement)) focusFirst(container);
        }, 60);
      }
    } else if (state.current && state.lastOutside && document.contains(state.lastOutside)) {
      const target = state.lastOutside;
      state.lastOutside = null;
      setTimeout(() => { try { target.focus({ preventScroll: true }); } catch (error) {} }, 60);
    }
  }

  // Class churn (selection, hover, animation) is frequent; reconcile at
  // most once per frame so focus management never becomes a hot path.
  const observer = new MutationObserver(() => {
    if (observerScheduled) return;
    observerScheduled = true;
    requestAnimationFrame(reconcile);
  });

  observer.observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'aria-hidden']
  });

  document.documentElement.dataset.input = 'pointer';

  window.NovaFocus = {
    current,
    focusables,
    focusFirst,
    refresh() { state.current = null; return current(); },
    setModality(value) { setModality(value); },
    get modality() { return state.modality; }
  };
})();
