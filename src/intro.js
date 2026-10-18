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

  /* ---------- ENDFIELD boot sequence ----------
     The shared astrolabe is replaced by a console readout built from
     real values (clock, year, game count). No invented telemetry. */
  register('endfield', {
    label: '终末地 · 启动序列',
    duration: 2400,
    hint: '点击或按任意键跳过',
    setup(overlay) {
      overlay.classList.add('intro-endfield');
      const stage = ensureEndfieldStage(overlay);
      const reduce = !!(window.NovaMotion && window.NovaMotion.reduce);
      const now = new Date();
      const pad2 = (value) => String(value).padStart(2, '0');
      const date = `${now.getFullYear()}.${pad2(now.getMonth() + 1)}.${pad2(now.getDate())}`;
      const time = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;

      const dockCount = document.getElementById('dockCount');
      const countMatch = (dockCount && dockCount.textContent || '').match(/\d+/);
      const games = pad2(countMatch ? Math.min(99, Number(countMatch[0])) : 0);

      const write = (key, value) => {
        const node = stage.querySelector(`[data-ef="${key}"]`);
        if (!node) return;
        if (reduce) node.textContent = value;
        else scramble(node, value, 520);
      };

      write('date', date);
      write('time', time);
      write('games', games);
      write('year', String(now.getFullYear()));
      runMeter(stage.querySelector('[data-ef="pct"]'), reduce);
    }
  });

  register('mnemo', {
    label: '记忆管理局',
    duration: 2600,
    hint: '点击或按任意键跳过',
    setup(overlay) {
      overlay.classList.add('intro-mnemo');
      const stage = ensureMnemoStage(overlay);
      const reduce = !!(window.NovaMotion && window.NovaMotion.reduce);
      const now = new Date();
      const pad2 = (value) => String(value).padStart(2, '0');
      const date = `${now.getFullYear()}.${pad2(now.getMonth() + 1)}.${pad2(now.getDate())}`;
      const time = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
      const dockCount = document.getElementById('dockCount');
      const countMatch = (dockCount && dockCount.textContent || '').match(/\d+/);
      const games = pad2(countMatch ? Math.min(99, Number(countMatch[0])) : 0);

      const write = (key, value) => {
        const node = stage.querySelector(`[data-mn="${key}"]`);
        if (!node) return;
        if (reduce) node.textContent = value;
        else scramble(node, value, 520);
      };

      write('date', date);
      write('time', time);
      write('games', games);
      const entry = stage.querySelector('[data-mn="entry"]');
      if (entry) entry.textContent = games;
      write('year', String(now.getFullYear()));
      runMeter(stage.querySelector('[data-mn="pct"]'), reduce);

      const plate = stage.querySelector('.intro-mn-error');
      const settle = () => {
        if (!plate) return;
        plate.classList.add('is-ok');
        const title = plate.querySelector('b');
        const sub = plate.querySelector('i');
        if (title) title.textContent = '记忆已恢复';
        if (sub) sub.textContent = 'ARCHIVE RESTORED';
      };
      if (reduce) settle();
      else setTimeout(settle, 1300);
    }
  });

  register('zerohour', {
    label: '零点街区 · 信号接入',
    duration: 2200,
    hint: '点击或按任意键跳过',
    setup(overlay) {
      overlay.classList.add('intro-zerohour');
      const stage = ensureZeroHourStage(overlay);
      const reduce = !!(window.NovaMotion && window.NovaMotion.reduce);
      const now = new Date();
      const pad2 = (value) => String(value).padStart(2, '0');
      const date = `${now.getFullYear()}.${pad2(now.getMonth() + 1)}.${pad2(now.getDate())}`;
      const time = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
      const dockCount = document.getElementById('dockCount');
      const countMatch = (dockCount && dockCount.textContent || '').match(/\d+/);
      const games = pad2(countMatch ? Math.min(99, Number(countMatch[0])) : 0);

      const write = (key, value) => {
        const node = stage.querySelector(`[data-zh="${key}"]`);
        if (!node) return;
        if (reduce) node.textContent = value;
        else scramble(node, value, 460);
      };

      write('date', date);
      write('time', time);
      write('games', games);
      const titles = stage.querySelector('[data-zh="titles"]');
      if (titles) titles.textContent = `${games} TITLES`;
      runMeter(stage.querySelector('[data-zh="pct"]'), reduce);
    }
  });

  register('codex', {
    label: '星轨秘典',
    duration: 2600,
    hint: '点击或按任意键跳过',
    // A clock-hand astrolabe and a diamond iris; distinct from the seal.
    setup(overlay) {
      overlay.classList.add('intro-codex');
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

  function ensureMnemoStage(overlay) {
    let stage = overlay.querySelector('.intro-mn');
    if (stage) return stage;
    stage = document.createElement('div');
    stage.className = 'intro-mn';
    stage.setAttribute('aria-hidden', 'true');
    stage.innerHTML = `
      <div class="intro-mn-map" aria-hidden="true">
        <i class="mn-node a"></i><i class="mn-node b"></i><i class="mn-node c"></i>
        <i class="mn-node d"></i><i class="mn-node e"></i><span class="mn-route"></span>
      </div>
      <div class="intro-mn-head">
        <span>// MEMORY BUREAU</span>
        <span class="intro-mn-clock"><b data-mn="date">----.--.--</b><i>│</i><b data-mn="time">--:--</b></span>
      </div>
      <div class="intro-mn-main">
        <div class="intro-mn-kicker">// ARCHIVE ACCESS · <b data-mn="games">--</b> ENTRIES</div>
        <div class="intro-mn-word">
          <span class="intro-mn-solid">MNEMO</span>
          <span class="intro-mn-hollow">MEMORY BUREAU</span>
        </div>
        <div class="intro-mn-mark">记忆管理局</div>
        <div class="intro-mn-fields">
          <span>YEAR <b data-mn="year">----</b></span>
          <span>ENTRY <b data-mn="entry">--</b></span>
          <span>STATUS <b>SYNC</b></span>
        </div>
      </div>
      <div class="intro-mn-error"><b>记忆无法读取</b><i>UNABLE TO ACCESS MEMORY</i></div>
      <div class="intro-mn-foot">
        <span class="intro-mn-status"><i></i>SCAN</span>
        <span class="intro-mn-bar"><i></i></span>
        <span class="intro-mn-pct" data-mn="pct">000%</span>
      </div>`;
    overlay.appendChild(stage);
    return stage;
  }

  function ensureZeroHourStage(overlay) {
    let stage = overlay.querySelector('.intro-zh');
    if (stage) return stage;
    stage = document.createElement('div');
    stage.className = 'intro-zh';
    stage.setAttribute('aria-hidden', 'true');
    stage.innerHTML = `
      <span class="intro-zh-hazard top" aria-hidden="true"></span>
      <span class="intro-zh-hazard bottom" aria-hidden="true"></span>
      <div class="intro-zh-head">
        <span>// NOVA BROADCAST</span>
        <span class="intro-zh-clock"><b data-zh="date">----.--.--</b><i>│</i><b data-zh="time">--:--</b></span>
      </div>
      <div class="intro-zh-main">
        <div class="intro-zh-ch">CH. <b data-zh="games">--</b> <span>NO SIGNAL</span></div>
        <div class="intro-zh-word">
          <span class="intro-zh-solid">ZERO</span>
          <span class="intro-zh-hollow">HOUR</span>
        </div>
        <div class="intro-zh-mark"><span>零点街区</span><i data-zh="titles">-- TITLES</i></div>
      </div>
      <div class="intro-zh-foot">
        <span class="intro-zh-status"><i></i>ON AIR</span>
        <span class="intro-zh-bar"><i></i></span>
        <span class="intro-zh-pct" data-zh="pct">000%</span>
      </div>`;
    overlay.appendChild(stage);
    return stage;
  }

  function ensureEndfieldStage(overlay) {
    let stage = overlay.querySelector('.intro-ef');
    if (stage) return stage;
    stage = document.createElement('div');
    stage.className = 'intro-ef';
    stage.setAttribute('aria-hidden', 'true');
    stage.innerHTML = `
      <span class="intro-ef-tri" aria-hidden="true"></span>
      <div class="intro-ef-head">
        <span class="intro-ef-brand">// NOVA GAME SPACE</span>
        <span class="intro-ef-clock">
          <b data-ef="date">----.--.--</b><i>│</i><b data-ef="time">--:--</b>
        </span>
      </div>
      <div class="intro-ef-frame" aria-hidden="true"></div>
      <div class="intro-ef-main">
        <div class="intro-ef-word">
          <span class="intro-ef-solid">NOVA</span>
          <span class="intro-ef-hollow">GAME SPACE</span>
        </div>
        <div class="intro-ef-mark"><span>游戏空间</span></div>
        <div class="intro-ef-fields">
          <span><i>GAMES</i><b data-ef="games">--</b></span>
          <span><i>THEME</i><b>ENDFIELD</b></span>
          <span><i>YEAR</i><b data-ef="year">----</b></span>
        </div>
      </div>
      <div class="intro-ef-foot">
        <span class="intro-ef-status"><i></i>启动序列</span>
        <span class="intro-ef-bar"><i></i></span>
        <span class="intro-ef-pct" data-ef="pct">000%</span>
      </div>`;
    overlay.appendChild(stage);
    return stage;
  }

  /* Digits lock left-to-right; separators are kept so the value stays legible. */
  function scramble(node, finalValue, duration) {
    const glyph = /[0-9A-Za-z]/;
    const pool = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    const started = performance.now();
    const length = finalValue.length;
    const tick = (now) => {
      const t = Math.min(1, (now - started) / duration);
      let out = '';
      for (let i = 0; i < length; i += 1) {
        const char = finalValue[i];
        if (!glyph.test(char) || t >= (i + 1) / length) out += char;
        else out += pool[(Math.random() * pool.length) | 0];
      }
      node.textContent = out;
      if (t < 1) requestAnimationFrame(tick);
      else node.textContent = finalValue;
    };
    requestAnimationFrame(tick);
  }

  function runMeter(node, reduce) {
    if (!node) return;
    if (reduce) {
      node.textContent = '100%';
      return;
    }
    const started = performance.now();
    const tick = (now) => {
      const t = Math.min(1, Math.max(0, (now - started - 160) / 1900));
      node.textContent = `${String(Math.round(t * 100)).padStart(3, '0')}%`;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

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
