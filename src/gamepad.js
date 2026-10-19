(() => {
  'use strict';

  /* ============================================================
     NOVA · GAMEPAD
     Full controller navigation for Xbox and PlayStation layouts.
     Polls gamepads at frame rate, converts presses to the same actions
     the keyboard uses, and publishes an on-screen button legend in the
     detected layout.
     ============================================================ */

  const DEADZONE = 0.6;
  const REPEAT_DELAY = 380;
  const REPEAT_INTERVAL = 130;

  const LAYOUTS = {
    xbox: {
      name: 'Xbox 手柄',
      glyphs: { a: 'A', b: 'B', x: 'X', y: 'Y', menu: '≡', view: '⊞', lb: 'LB', rb: 'RB', ls: 'LS', rs: 'RS' },
      face: { a: '#6bd39a', b: '#ff7a7a', x: '#6fa8ff', y: '#ffd166' }
    },
    playstation: {
      name: 'PlayStation 手柄',
      glyphs: { a: '✕', b: '○', x: '□', y: '△', menu: 'OPT', view: 'SHARE', lb: 'L1', rb: 'R1', ls: 'L3', rs: 'R3' },
      face: { a: '#7fb2ff', b: '#ff8a8a', x: '#e59bd8', y: '#8ee6c8' }
    }
  };

  const state = {
    pad: null,
    layout: null,
    connected: false,
    prev: new Map(),
    stickLock: 0,
    hintEl: null,
    statusEl: null,
    handlers: {}
  };

  /* Layout detection: Xbox controllers often report "Wireless Controller"
     too, so vendor ids and explicit Xbox markers are checked first. */
  function layoutFor(id) {
    const value = String(id || '');
    if (/dualsense|dualshock|playstation|054c|054c-/i.test(value)) return 'playstation';
    if (/xbox|045e|microsoft|elite/i.test(value)) return 'xbox';
    if (/wireless controller|pro controller|nintendo|switch/i.test(value)) return 'xbox';
    return 'xbox';
  }

  function setStatus(text) {
    if (!state.statusEl) return;
    const span = state.statusEl.querySelector('span');
    if (span) span.textContent = text || '键盘 / 鼠标';
  }

  function buildHintBar() {
    if (state.hintEl) return;
    const bar = document.createElement('div');
    bar.className = 'pad-hints';
    bar.hidden = true;
    document.body.appendChild(bar);
    state.hintEl = bar;
  }

  function renderHints(entries) {
    buildHintBar();
    if (!entries || !entries.length) {
      state.hintEl.hidden = true;
      return;
    }
    const layout = LAYOUTS[state.layout] || LAYOUTS.xbox;
    state.hintEl.innerHTML = entries.map(([key, label]) => {
      const glyph = layout.glyphs[key] || key.toUpperCase();
      const face = layout.face[key];
      const style = face ? ` style="--glyph:${face}"` : '';
      return `<span class="pad-hint"><kbd class="pad-glyph${face ? ' face' : ''}"${style}>${glyph}</kbd><em>${label}</em></span>`;
    }).join('');
    state.hintEl.hidden = false;
  }

  function fire(action) {
    const handler = state.handlers[action];
    if (handler) handler();
  }

  function snapshot(pad) {
    const b = pad.buttons || [];
    const p = (i) => !!(b[i] && b[i].pressed);
    return {
      a: p(0), b: p(1), x: p(2), y: p(3),
      lb: p(4), rb: p(5),
      view: p(8), menu: p(9),
      ls: p(10),
      rs: p(11),
      up: p(12), down: p(13), left: p(14), right: p(15)
    };
  }

  function poll(app) {
    requestAnimationFrame(() => poll(app));
    if (!navigator.getGamepads) return;

    const pads = navigator.getGamepads();
    let pad = null;
    for (let i = 0; i < pads.length; i += 1) {
      if (pads[i] && pads[i].connected) { pad = pads[i]; break; }
    }

    if (!pad) {
      if (state.connected) {
        state.connected = false;
        state.pad = null;
        state.prev.clear();
        setStatus(null);
        renderHints([]);
        app.padDisconnected();
      }
      return;
    }

    if (!state.connected || !state.pad || state.pad.index !== pad.index || state.pad.id !== pad.id) {
      state.connected = true;
      state.pad = pad;
      state.layout = layoutFor(pad.id);
      state.prev.clear();
      state.stickLock = 0;
      setStatus(LAYOUTS[state.layout].name);
      app.padConnected(state.layout, pad.id);
    }

    const now = performance.now();
    const next = snapshot(pad);

    // The opening sequence swallows pad input. Any face/d-pad press
    // only skips the intro; it must not also launch a game behind it.
    if (window.NovaIntro && window.NovaIntro.active) {
      const anyPressed = Object.keys(next).some((key) => next[key] && !state.prev.get(key));
      Object.keys(next).forEach((key) => state.prev.set(key, next[key]));
      if (anyPressed) window.NovaIntro.padSkip();
      return;
    }

    const pressedEdge = (key) => {
      const was = !!state.prev.get(key);
      state.prev.set(key, next[key]);
      return next[key] && !was;
    };

    // Stick navigation: first tilt moves once, then repeats after a delay.
    const axisX = pad.axes[0] || 0;
    const axisY = pad.axes[1] || 0;
    const dirX = Math.abs(axisX) > DEADZONE ? (axisX > 0 ? 1 : -1) : 0;
    const dirY = Math.abs(axisY) > DEADZONE ? (axisY > 0 ? 1 : -1) : 0;

    if (dirX !== 0) {
      if (now > state.stickLock) {
        fire(dirX > 0 ? 'navRight' : 'navLeft');
        state.stickLock = now + (state.stickLock === 0 ? 0 : REPEAT_INTERVAL) + REPEAT_DELAY * (state.stickLock === 0 ? 1 : 0);
        if (state.stickLock < now) state.stickLock = now + REPEAT_DELAY;
      }
    } else if (dirY !== 0) {
      if (now > state.stickLock) {
        fire(dirY > 0 ? 'navDown' : 'navUp');
        state.stickLock = now + REPEAT_DELAY;
      }
    } else {
      state.stickLock = 0;
    }

    if (pressedEdge('left')) fire('navLeft');
    if (pressedEdge('right')) fire('navRight');
    if (pressedEdge('up')) fire('navUp');
    if (pressedEdge('down')) fire('navDown');

    if (pressedEdge('a')) fire('confirm');
    if (pressedEdge('b')) fire('back');
    if (pressedEdge('x')) fire('favorite');
    if (pressedEdge('y')) fire('manage');
    if (pressedEdge('lb')) fire('pageUp');
    if (pressedEdge('rb')) fire('pageDown');
    if (pressedEdge('menu')) fire('library');
    if (pressedEdge('view')) fire('notifications');
    if (pressedEdge('ls')) fire('appearance');
    if (pressedEdge('rs')) fire('settings');
  }

  window.NovaPad = {
    start(app, statusEl) {
      state.statusEl = statusEl;
      state.handlers = {
        navLeft: () => app.nav(-1),
        navRight: () => app.nav(1),
        navUp: () => app.navVertical(-1),
        navDown: () => app.navVertical(1),
        confirm: () => app.confirm(),
        back: () => app.back(),
        favorite: () => app.favorite(),
        manage: () => app.manage(),
        library: () => app.library(),
        appearance: () => app.appearance(),
        notifications: () => app.notifications(),
        settings: () => app.settings(),
        pageUp: () => app.pageUp(),
        pageDown: () => app.pageDown()
      };
      buildHintBar();
      poll(app);
    },
    get connected() { return state.connected; },
    get layout() { return state.layout; },
    press(action) { fire(action); },
    hints: renderHints
  };
})();
