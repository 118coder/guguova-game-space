(() => {
  'use strict';

  /* ============================================================
     NOVA · MOTION SYSTEM
     One place that decides how much motion the machine can afford
     and how the user wants to experience it. The UI reads classes
     and CSS variables; nothing else needs to know the policy.

       naive  : full choreography
       calm   : shorter travel, longer settles, no parallax
       reduce : system/user reduced motion, every tween collapsed
       low    : expensive layers (blur, grain, drift) removed
     ============================================================ */

  const root = document.documentElement;
  const media = {
    reduce: window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null,
    hover: window.matchMedia ? window.matchMedia('(hover: hover) and (pointer: fine)') : null
  };

  const state = {
    calm: false,
    userReduce: false,
    systemReduce: !!(media.reduce && media.reduce.matches),
    low: false,
    sampled: false
  };

  const listeners = new Set();

  function effectiveReduce() {
    return state.userReduce || state.systemReduce;
  }

  function applyClasses() {
    root.classList.toggle('calm', state.calm);
    root.classList.toggle('reduce-motion', effectiveReduce());
    root.classList.toggle('perf-low', state.low);
    root.dataset.motion = effectiveReduce() ? 'reduce' : state.calm ? 'calm' : 'full';
    listeners.forEach((fn) => {
      try { fn(snapshot()); } catch (error) { console.warn('motion listener', error); }
    });
    window.dispatchEvent(new CustomEvent('nova:motionchange', { detail: snapshot() }));
  }

  function snapshot() {
    return {
      calm: state.calm,
      reduce: effectiveReduce(),
      low: state.low,
      drift: media.hover ? media.hover.matches : true
    };
  }

  /** Bounded frame sampling: only downgrade, never upgrade after boot.
      A steady 22 ms average is roughly 45 fps or worse on this machine. */
  function samplePerformance() {
    if (state.sampled || !window.requestAnimationFrame) return;
    state.sampled = true;
    const frames = [];
    let last = 0;
    let count = 0;
    const tick = (now) => {
      if (last) frames.push(now - last);
      last = now;
      count += 1;
      if (count < 95) {
        requestAnimationFrame(tick);
        return;
      }
      frames.sort((a, b) => a - b);
      const median = frames[Math.floor(frames.length / 2)] || 0;
      if (median > 22) {
        state.low = true;
        applyClasses();
      }
    };
    requestAnimationFrame(tick);
  }

  function probeDevice() {
    const cores = navigator.hardwareConcurrency || 8;
    const memory = navigator.deviceMemory || 8;
    if (cores <= 4 || memory <= 4) {
      state.low = true;
      applyClasses();
    }
  }

  function configure(options = {}) {
    if (typeof options.calm === 'boolean') state.calm = options.calm;
    if (typeof options.reduceMotion === 'boolean') state.userReduce = options.reduceMotion;
    applyClasses();
  }

  function setCalm(on) {
    state.calm = !!on;
    if (state.calm) state.userReduce = false;
    applyClasses();
  }

  function setReduce(on) {
    state.userReduce = !!on;
    if (state.userReduce) state.calm = false;
    applyClasses();
  }

  function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function duration(name) {
    const values = {
      instant: 90,
      fast: 160,
      base: 260,
      slow: 460,
      cinematic: 900
    };
    const raw = values[name] || values.base;
    if (effectiveReduce()) return 1;
    if (state.calm) return Math.round(raw * 1.35);
    return raw;
  }

  if (media.reduce) {
    const onMedia = () => {
      state.systemReduce = media.reduce.matches;
      applyClasses();
    };
    if (media.reduce.addEventListener) media.reduce.addEventListener('change', onMedia);
    else if (media.reduce.addListener) media.reduce.addListener(onMedia);
  }

  // Decorative motion stops when the window is not visible; game
  // animations and layout work are unaffected.
  document.addEventListener('visibilitychange', () => {
    root.classList.toggle('motion-paused', document.hidden);
    if (!document.hidden && !state.sampled) samplePerformance();
  }, { passive: true });

  applyClasses();
  probeDevice();
  if (!effectiveReduce()) requestAnimationFrame(() => samplePerformance());

  window.NovaMotion = {
    configure,
    setCalm,
    setReduce,
    onChange,
    duration,
    get calm() { return state.calm; },
    get reduce() { return effectiveReduce(); },
    get low() { return state.low; },
    get state() { return snapshot(); }
  };
})();
