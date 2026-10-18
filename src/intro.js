(() => {
  'use strict';

  /* ============================================================
     NOVA · INTRO REGISTRY
     The opening sequence is a named preset, not a theme-specific
     script. A theme manifest only names a preset ("intro": "ink");
     a theme author can ship a new preset by registering one here
     or by adding a CSS block under [data-intro="<id>"].

     Each preset: { label, duration, classNames?, setup?(stage) }
     ============================================================ */

  const presets = new Map();
  const DEFAULT = 'gilded';

  function register(id, preset) {
    if (!id || typeof id !== 'string') throw new Error('intro preset needs an id');
    presets.set(id, Object.assign({ id, label: id, duration: 2200 }, preset || {}));
    return presets.get(id);
  }

  register('gilded', {
    label: '鎏金仪式',
    duration: 2150,
    hint: '点击或按任意键跳过'
  });

  register('aurum', {
    label: '鎏金圣所',
    duration: 2200,
    hint: '点击或按任意键跳过',
    // A structurally distinct variation: the diamond turns a half circle
    // and an extra gold ring pulses outward. CSS lives in intro.css.
    setup(overlay) {
      overlay.classList.add('intro-aurum');
    }
  });

  register('ember', {
    label: '余烬',
    duration: 2000,
    hint: '点击或按任意键跳过'
  });

  register('ink', {
    label: '墨与纸',
    duration: 2300,
    hint: '点击或按任意键跳过'
  });

  register('veil', {
    label: '薄幕',
    duration: 1100,
    hint: '点击或按任意键跳过'
  });

  const state = {
    playing: false,
    finished: false,
    overlay: null,
    preset: DEFAULT,
    timer: 0,
    resolve: null,
    startedAt: 0
  };

  const reduceMotion = () => !!(window.NovaMotion && window.NovaMotion.reduce);

  function setPreset(id) {
    const wanted = typeof id === 'string' && presets.has(id) ? id : DEFAULT;
    state.preset = wanted;
    if (state.overlay) state.overlay.dataset.intro = wanted;
    return presets.get(wanted);
  }

  function bindSkip() {
    window.addEventListener('keydown', onSkipKey, true);
    window.addEventListener('pointerdown', onSkipPointer, true);
  }

  function unbindSkip() {
    window.removeEventListener('keydown', onSkipKey, true);
    window.removeEventListener('pointerdown', onSkipPointer, true);
  }

  function onSkipKey(event) {
    // The first frame or two should not be skipped by a held key.
    if (performance.now() - state.startedAt < 180) return;
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') event.preventDefault();
    skip();
  }

  function onSkipPointer() {
    if (performance.now() - state.startedAt < 180) return;
    skip();
  }

  function finish(skipped) {
    if (!state.playing || state.finished) return;
    state.finished = true;
    clearTimeout(state.timer);
    unbindSkip();

    const overlay = state.overlay;
    document.body.classList.remove('is-intro');
    document.body.classList.add('is-booted');
    if (overlay) {
      overlay.classList.add('is-done');
      overlay.setAttribute('aria-hidden', 'true');
      setTimeout(() => {
        if (overlay && overlay.parentNode) overlay.remove();
      }, reduceMotion() ? 240 : 900);
    }
    state.playing = false;
    if (state.resolve) state.resolve({ skipped: skipped === true, preset: state.preset });
    state.resolve = null;
  }

  function skip() {
    finish(true);
  }

  /**
   * Starts the opening sequence.
   * options: { intro: string, themeId?: string, force?: boolean }
   * Resolves when the interface is revealed.
   */
  function play(options = {}) {
    if (state.playing) return Promise.resolve({ skipped: false, preset: state.preset, already: true });

    const overlay = document.getElementById('introOverlay');
    state.overlay = overlay;
    state.startedAt = performance.now();

    const preset = setPreset(options.intro);
    document.body.classList.add('is-intro');

    if (!overlay) {
      document.body.classList.remove('is-intro');
      document.body.classList.add('is-booted');
      return Promise.resolve({ skipped: false, preset: preset.id, missing: true });
    }

    const hint = overlay.querySelector('.intro-hint');
    if (hint && preset.hint) hint.textContent = preset.hint;

    // Restart shared choreography for this activation.
    void overlay.offsetWidth;
    overlay.classList.add('is-playing');
    state.playing = true;

    if (preset.setup) {
      try { preset.setup(overlay); } catch (error) { console.warn('intro preset setup', error); }
    }

    const duration = reduceMotion() ? 320 : (Number(preset.duration) || 2200);
    bindSkip();

    return new Promise((resolve) => {
      state.resolve = resolve;
      state.timer = setTimeout(() => finish(false), duration);
      // Safety: a missed timer must never leave the shell hidden.
      setTimeout(() => {
        if (!document.body.classList.contains('is-booted')) {
          document.body.classList.add('is-booted');
          document.body.classList.remove('is-intro');
        }
      }, duration + 1800);
    });
  }

  // Exposed for the controller adapter: any pad button skips the intro.
  function padSkip() {
    if (!state.playing) return false;
    skip();
    return true;
  }

  window.NovaIntro = {
    register,
    play,
    skip,
    padSkip,
    presets: () => Array.from(presets.values()),
    get active() { return state.playing; },
    get preset() { return state.preset; }
  };
})();
