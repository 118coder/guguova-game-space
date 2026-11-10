/* ============================================================
   APP PART 05 · audio —— 音效 AUDIO —— 合成、播放、cue 集与静音偏好
   这是 src/app/ 分片之一：由 tools/build-app.js 按文件名序拼回 src/app.js。
   所有分片共享同一个 IIFE 闭包（跨分片直接引用函数与 state）。
   改代码请改分片，改完运行 node tools/build-app.js；直接编辑 app.js 会被覆盖。
   ============================================================ */

  /* ============================================================
     AUDIO
     Two layers: CC0 interface samples (Kenney, bundled locally) and
     a tiny synth fallback so nothing goes silent if a file is missing.
     ============================================================ */

  const SFX = {
    // One file per distinct sound; call sites pick a semantic method below.
    bong: 'assets/sfx/bong.ogg',      // directional selection (rail, lists)
    click: 'assets/sfx/click.ogg',    // ordinary button
    nav: 'assets/sfx/nav.ogg',        // opening a full page
    soft: 'assets/sfx/soft.ogg',      // close / back / mode switch
    select: 'assets/sfx/select.ogg',
    theme: 'assets/sfx/theme.ogg',
    confirm: 'assets/sfx/confirm.ogg',
    error: 'assets/sfx/error.ogg',
    tick: 'assets/sfx/tick.ogg',
    chime: 'assets/sfx/chime.ogg',
    deep: 'assets/sfx/deep.ogg',
    launchRise: 'assets/sfx/launch-rise.ogg',
    launchFall: 'assets/sfx/launch-fall.ogg'
  };

  const audio = {
    ctx: null,
    pools: new Map(),
    volume: 0.5,
    // Cue name → decoded buffer for the theme currently installed. Filled by
    // warmTheme(); an absent entry simply falls through to the shared cue, so
    // a theme that ships no sounds behaves exactly like before.
    themePools: new Map(),
    themeId: null,
    // Long, tracked cues (the theme's intro sequence) that must be cut short
    // when the player skips the animation.
    longSources: new Map(),

    /** Whether a themed cue is both loaded and allowed right now. */
    hasThemeCue(name) {
      return !state.settings.unifiedSfx && this.themePools.has(name);
    },

    /** Resolve what a cue should actually play: the active theme's version
        when it has one and the player has not asked for the unified set,
        otherwise the shared interface sound. */
    bufferFor(name) {
      if (state.settings.unifiedSfx) return this.pools.get(name) || null;
      return this.themePools.get(name) || this.pools.get(name) || null;
    },

    /** Load a theme's declared cues. A no-op when the player chose the
        unified set, which is also what makes the setting take effect at once. */
    async warmTheme(themeId, sounds) {
      this.themePools.clear();
      this.themeId = themeId;
      if (state.settings.unifiedSfx) return;
      if (!state.settings.sound || !sounds) return;
      const ctx = this.ensure();
      if (!ctx) return;
      await Promise.all(Object.entries(sounds).map(async ([cue, url]) => {
        try {
          // Theme folder cues already carry ?v=<theme version>; the built-in
          // NOVA set is a plain asset path, so stamp it with the app version.
          const stamped = url.includes('?')
            ? url
            : `${url}?v=${encodeURIComponent(state.version || '1')}`;
          const response = await fetch(stamped);
          if (!response.ok) return;
          const data = await response.arrayBuffer();
          this.themePools.set(cue, await ctx.decodeAudioData(data));
        } catch (error) {
          // A missing or unreadable theme sound is not an error: the shared
          // cue already covers the same moment.
        }
      }));
    },

    /** Preload one decoded buffer per cue; misses fall back to the synth. */
    async warm() {
      if (!state.settings.sound) return;
      const ctx = this.ensure();
      if (!ctx) return;
      await Promise.all(Object.entries(SFX).map(async ([name, url]) => {
        if (this.pools.has(name)) return;
        try {
          const response = await fetch(url);
          if (!response.ok) throw new Error(String(response.status));
          const data = await response.arrayBuffer();
          const buffer = await ctx.decodeAudioData(data);
          this.pools.set(name, buffer);
        } catch (error) {
          this.pools.set(name, null);
        }
      }));
    },

    ensure() {
      if (!state.settings.sound) return null;
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try { this.ctx = new AC(); } catch (error) { return null; }
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return this.ctx;
    },

    /** Plays a bundled sample; `gain` trims it to sit under the interface.
        With `track`, the source is remembered so a long cue (the intro
        sequence) can be faded out when the animation is skipped. */
    play(name, options = {}) {
      const ctx = this.ensure();
      if (!ctx) return false;
      const buffer = options.buffer || this.bufferFor(name);
      if (!buffer) return false;
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      const offset = options.offset || 0;
      const trim = options.gain ?? 1;
      source.buffer = buffer;
      gain.gain.value = this.volume * trim;
      source.connect(gain).connect(ctx.destination);
      if (options.track) {
        this.longSources.set(name, { source, gain });
        source.onended = () => {
          const entry = this.longSources.get(name);
          if (entry && entry.source === source) this.longSources.delete(name);
        };
      }
      source.start(ctx.currentTime + (options.delay || 0), offset);
      return true;
    },

    tone(freq, options = {}) {
      const ctx = this.ensure();
      if (!ctx) return;
      const { dur = .09, type = 'sine', gain = .012, delay = 0 } = options;
      const t = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      amp.gain.setValueAtTime(.0001, t);
      amp.gain.exponentialRampToValueAtTime(Math.max(gain, .0002), t + .012);
      amp.gain.exponentialRampToValueAtTime(.0001, t + dur);
      osc.connect(amp).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + .035);
    },

    /** Fade out a tracked cue in <fade> seconds, then stop it. */
    stopLong(name, fade = 0.16) {
      const entry = this.longSources.get(name);
      if (!entry) return;
      this.longSources.delete(name);
      const ctx = this.ctx;
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        entry.gain.gain.cancelScheduledValues(now);
        entry.gain.gain.setValueAtTime(entry.gain.gain.value, now);
        entry.gain.gain.linearRampToValueAtTime(0.0001, now + fade);
        entry.source.stop(now + fade + 0.02);
      } catch (error) {
        try { entry.source.stop(); } catch (stopError) { /* already ended */ }
      }
    },

    /** Directional step: keyboard ←/→ and gamepad d-pad between games. */
    move(dir = 1) {
      if (!this.play('bong', { gain: .34 })) {
        this.tone(dir > 0 ? 700 : 540, { dur: .065, gain: .0075 });
      }
    },
    hover() {
      if (!this.play('tick', { gain: .18 })) this.tone(880, { dur: .04, gain: .004 });
    },
    /** Ordinary buttons: details, manage, edit, save, sort, export, folders. */
    select() {
      if (!this.play('click', { gain: .5 })) {
        this.tone(520, { dur: .12, gain: .009, type: 'triangle' });
        this.tone(780, { dur: .18, gain: .0055, delay: .05 });
      }
    },
    /** Opening 游戏库 / 外观 / 设置. */
    page() {
      this.play('nav', { gain: .46 });
    },
    /** Close / back / return to 首页 — one sound for every retreat. */
    back() {
      this.play('soft', { gain: .44 });
    },
    /** Generic dialog, file picker and theme-folder opening. */
    open() {
      this.play('soft', { gain: .44 });
    },
    close() {
      this.play('soft', { gain: .42 });
    },
    /** Filter chips, appearance language, reduce-motion, calm, framing. */
    toggle() {
      this.play('soft', { gain: .4 });
    },
    confirm() {
      if (!this.play('confirm', { gain: .5 })) this.select();
    },
    /**
     * A theme owns four moments: switching to it, starting a game, ending a
     * game, and the launcher opening with it active. Each looks for a themed
     * cue first (themePools) and falls back to the shared one, so themes ship
     * sound only when they want to.
     */
    themeEvent(cue, fallback, gain = .5) {
      if (this.hasThemeCue(cue)) {
        this.play(cue, { gain });
        return;
      }
      if (fallback) fallback.call(this);
    },
    theme() {
      // A theme that owns the switch moment replaces the shared sweep
      // outright; playing both reads as two separate transitions.
      if (this.hasThemeCue('switch')) {
        this.play('switch', { gain: .48 });
        return;
      }
      if (!this.play('theme', { gain: .42 })) {
        this.tone(520, { dur: .22, gain: .008, type: 'sine' });
        this.tone(780, { dur: .3, gain: .006, delay: .05 });
      }
    },
    error() {
      if (!this.play('error', { gain: .5 })) {
        this.tone(220, { dur: .16, gain: .01, type: 'triangle' });
      }
    },
    launch() {
      // A themed launch cue replaces the shared rise entirely: playing both
      // would read as two separate events.
      if (this.hasThemeCue('launch')) {
        this.play('launch', { gain: .55 });
        return;
      }
      const played = this.play('launchRise', { gain: .55 });
      if (!played) {
        [392, 523.25, 659.25].forEach((freq, i) => this.tone(freq, { dur: .5, gain: .012, delay: i * .055 }));
        return;
      }
      [261.63, 329.63, 392, 523.25].forEach((freq, i) => {
        this.tone(freq, { dur: 1.4, gain: .006, delay: .18 + i * .09, type: 'sine' });
      });
    },
    launchReady() {
      this.play('chime', { gain: .4 });
    },
    exitGame() {
      if (this.hasThemeCue('exit')) {
        this.play('exit', { gain: .48 });
        return;
      }
      if (!this.play('launchFall', { gain: .45 })) this.back();
    },
    sleep() {
      if (!this.play('deep', { gain: .34, offset: .05 })) this.tone(196, { dur: .75, gain: .0045 });
    },
    /** Play a theme's intro sequence without adopting that theme. Used by the
        theme card's context menu, where a preview must not disturb the cue
        set that the rest of the interface is already using. */
    async playPreviewBoot(sounds) {
      const url = sounds && sounds.boot;
      if (!url) return false;
      const ctx = this.ensure();
      if (!ctx) return false;
      try {
        const stamped = url.includes('?') ? url : `${url}?v=${encodeURIComponent(state.version || '1')}`;
        const response = await fetch(stamped);
        if (!response.ok) return false;
        const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
        return this.play('boot', { gain: .5, track: true, buffer });
      } catch (error) {
        return false;
      }
    },

    /** The launcher opening. The theme's boot file is authored as a sequence
        whose hits sit on that theme's intro keyframes, so starting it together
        with the animation is what puts the sound on the beat. */
    boot() {
      if (!this.hasThemeCue('boot')) return false;
      this.bootCount = (this.bootCount || 0) + 1;
      return this.play('boot', { gain: .5, track: true });
    }
  };

