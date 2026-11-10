/* ============================================================
   APP PART 10 · accent —— 强调色解算（可读对比度、CTA 底字配对）+ 背景层 BACKDROP
   这是 src/app/ 分片之一：由 tools/build-app.js 按文件名序拼回 src/app.js。
   所有分片共享同一个 IIFE 闭包（跨分片直接引用函数与 state）。
   改代码请改分片，改完运行 node tools/build-app.js；直接编辑 app.js 会被覆盖。
   ============================================================ */

  /* ============================================================
     ACCENT / CTA
     ============================================================ */

  function applyAccent(game) {
    const root = document.documentElement;
    const system = state.settings.styleMode === 'system';
    const themed = root.classList.contains('theme-custom');

    // A theme owns its palette. Cover colours may still tint the backdrop
    // scrim, but they must not repaint labels, badges or progress text.
    // Tokens declared by a theme are restored instead of being wiped.
    if (themed) {
      const theme = window.NovaTheme ? window.NovaTheme.find(state.theme) : null;
      const tokens = (theme && theme.tokens) || {};
      ['--accent', '--accent-2', '--glow', '--accent-text', '--accent-on'].forEach((name) => {
        if (tokens[name]) root.style.setProperty(name, tokens[name]);
        else root.style.removeProperty(name);
      });
      CTA_VARS.forEach((name) => root.style.removeProperty(name));
      root.style.removeProperty('--accent-solid');
      root.style.removeProperty('--accent-on-solid');
      root.style.setProperty('--scrim-rgb', game?.scrim || '10, 10, 8');
      return;
    }

    if (!game) {
      root.style.setProperty('--accent', system ? '#e7dcc9' : '#ffb45e');
      root.style.setProperty('--accent-2', system ? '#c7b79d' : '#ff6b79');
      root.style.setProperty('--glow', system ? 'rgba(231, 220, 201, .16)' : 'rgba(255, 172, 96, .32)');
      root.style.setProperty('--accent-text', system ? '#e7dcc9' : readableAccentText('#ffb45e'));
      root.style.setProperty('--accent-on', readableOn(system ? '#e7dcc9' : '#ffb45e'));
      root.style.setProperty('--scrim-rgb', '16, 12, 10');
      CTA_VARS.forEach((name) => root.style.removeProperty(name));
      root.style.removeProperty('--accent-solid');
      root.style.removeProperty('--accent-on-solid');
      return;
    }
    root.style.setProperty('--accent', system ? '#e7dcc9' : game.accent);
    root.style.setProperty('--accent-2', system ? '#c7b79d' : game.accent2);
    root.style.setProperty('--glow', system ? 'rgba(231, 220, 201, .16)' : game.glow);
    root.style.setProperty('--accent-text',
      system ? '#e7dcc9' : readableAccentText(game.accent || '#ffb45e'));
    root.style.setProperty('--accent-on',
      readableOn(system ? '#e7dcc9' : (game.accent || '#ffb45e')));
    root.style.setProperty('--scrim-rgb', game.scrim || '16, 12, 10');
    if (!system) {
      // Solid accent plates (sheet buttons) get a guaranteed-AA pair: the
      // cover accent as the plate, ink/white solved against it, the plate
      // nudged only when the accent sits in the mid-tone dead band.
      const solid = solveSolidPair(game.accent || '#ffb45e');
      root.style.setProperty('--accent-solid', solid.plate);
      root.style.setProperty('--accent-on-solid', solid.fg);
    } else {
      root.style.removeProperty('--accent-solid');
      root.style.removeProperty('--accent-on-solid');
    }
  }

  function ctaClassFor(game) {
    return state.settings.styleMode === 'adaptive' && game ? 'cta-adaptive' : 'cta-system';
  }

  const CTA_VARS = [
    '--cta-a', '--cta-b', '--cta-a-hover', '--cta-b-hover',
    '--cta-fg', '--cta-border', '--cta-glow'
  ];

  /* The original cover-directed palettes. These are the prototype's
     hand-tuned button colours; games we don't recognise fall back to the
     live cover sampler below. */
  const CTA_PALETTES = [
    { className: 'cta-emberwaltz', match: /(emberwaltz|星火圆舞曲)/i },
    { className: 'cta-cobalt-hour', match: /(cobalt\s*hour|钴蓝时刻)/i },
    { className: 'cta-sanctum', match: /(sanctum|圣所)/i },
    { className: 'cta-shatterline', match: /(shatterline|碎裂战线)/i },
    { className: 'cta-sunroom', match: /(sunroom|晴日小屋)/i },
    { className: 'cta-moonbound', match: /(moonbound|月誓)/i },
    { className: 'cta-neon-hearts', match: /(neon\s*hearts|霓虹心跳)/i }
  ];

  const CTA_CLASSES = ['cta-adaptive', 'cta-system'].concat(CTA_PALETTES.map((p) => p.className));

  function ctaPaletteFor(game) {
    if (!game) return null;
    const haystack = `${game.id || ''} ${game.name || ''} ${game.zh || ''}`;
    return CTA_PALETTES.find((palette) => palette.match.test(haystack)) || null;
  }

  function clearCtaVars(element) {
    CTA_VARS.forEach((name) => element.style.removeProperty(name));
  }

  function setElementCta(element, className, game, forceAdaptive = false) {
    if (!element) return;
    const themed = document.documentElement.classList.contains('theme-custom');
    const effective = forceAdaptive ? 'cta-adaptive' : className;
    CTA_CLASSES.forEach((name) => element.classList.remove(name));
    element.classList.add(effective);

    const palette = !themed && effective === 'cta-adaptive' ? ctaPaletteFor(game) : null;
    if (palette) {
      element.classList.add(palette.className);
      clearCtaVars(element);
    } else if (effective === 'cta-adaptive') {
      applyCtaVars(element, game);
    } else {
      clearCtaVars(element);
    }
  }

  /**
   * Buttons stay the same capsule; only their colour is derived from the
   * cover palette. Text contrast is computed, never guessed.
   */
  /**
   * The cover-directed CTA pair, solved once and reused everywhere a button
   * carries the game's colour: the plate is the lightened accent, the text is
   * picked by computed luma. "Text contrast is computed, never guessed."
   */
  function ctaVarsFor(game) {
    const a = game && (game.accent || '#ffd88a');
    const b = game && (game.accent2 || a);
    if (!a) return null;
    const plateA = lighten(a, .36);
    const plateB = lighten(b, .16);
    /* The label is solved against the plate it will actually sit on — the
       midpoint of the two-stop gradient — by measured contrast. A luma
       threshold guesses: a rose plate at .55 luma kept white type at 3.0:1
       while the dark ink would have cleared 7:1. */
    const plate = mixHex(plateA, plateB, .5);
    const darkInk = '#161008';
    const lightInk = '#fff8ee';
    const wantDark = contrastRatio(darkInk, plate) >= contrastRatio(lightInk, plate);
    const fg = wantDark ? darkInk : lightInk;
    const border = wantDark ? 'rgba(20, 14, 10, .22)' : 'rgba(255, 250, 240, .45)';
    const { r, g, b: blue } = parseHex(plate);
    return {
      '--cta-a': plateA,
      '--cta-b': plateB,
      '--cta-a-hover': lighten(a, .48),
      '--cta-b-hover': lighten(b, .28),
      '--cta-fg': fg,
      '--cta-border': border,
      '--cta-glow': `rgba(${r}, ${g}, ${blue}, .55)`
    };
  }

  function applyCtaVars(element, game) {
    if (!element) return;
    // A theme owns its button language; the cover palette must not repaint it.
    if (document.documentElement.classList.contains('theme-custom')) {
      ['--cta-a', '--cta-b', '--cta-a-hover', '--cta-b-hover', '--cta-fg', '--cta-border', '--cta-glow']
        .forEach((name) => element.style.removeProperty(name));
      return;
    }
    const vars = ctaVarsFor(game);
    if (!vars) {
      element.style.removeProperty('--cta-a');
      element.style.removeProperty('--cta-b');
      return;
    }
    Object.entries(vars).forEach(([name, value]) => element.style.setProperty(name, value));
  }

  function updatePrimaryButton(button, labelElement, game) {
    if (!button) return;
    const info = actionInfo(game);
    const use = button.querySelector('use');
    if (use) use.setAttribute('href', `#i-${info.icon}`);
    button.disabled = info.disabled;
    button.title = canForceKill(game) ? '长按 3 秒强制结束游戏进程' : '';
    if (labelElement) labelElement.textContent = info.label;
    const className = game && state.settings.styleMode === 'adaptive' ? 'cta-adaptive' : 'cta-system';
    setElementCta(button, className, game);
  }

  function actionInfo(game) {
    if (!game) return { icon: 'plus', label: '添加游戏', disabled: false };
    if (state.running.has(game.id)) return { icon: 'stop', label: '游戏运行中', disabled: false };
    if (!game.exists) return { icon: 'alert', label: '程序缺失', disabled: false };
    return { icon: 'play', label: game.playtimeSeconds > 0 || game.launchCount > 0 ? '继续游戏' : '开始游戏', disabled: false };
  }

  /* ============================================================
     BACKDROP
     ============================================================ */

  const backdropLayers = [];
  let activeLayer = 0;
  let backdropToken = 0;

  /**
   * Themes are pure CSS and cannot see the selected game. Publishing the
   * current hero as a custom property lets a theme use the real game art
   * inside its own composition (a framed portrait, a stamped print, …)
   * without duplicating the image or touching the DOM.
   */
  function publishHeroVar(game) {
    const root = document.documentElement;
    const url = game && game.heroUrl;
    if (!url) {
      root.style.removeProperty('--nova-hero');
      root.style.removeProperty('--nova-hero-position');
      root.style.removeProperty('--nova-hero-size');
      return;
    }
    root.style.setProperty('--nova-hero', `url("${String(url).replace(/"/g, '%22')}")`);
    // DUSK / GRIMOIRE / NIGHTFLIGHT / STEAM paint the hero as a themed
    // background instead of the shared .scene <img>. Publishing the same
    // framing lets those compositions obey the appearance editor too.
    const framing = framingFor(game);
    const zoom = clampNumber(framing.zoom, 1, 2.4);
    root.style.setProperty('--nova-hero-position', `${Math.round(framing.x)}% ${Math.round(framing.y)}%`);
    root.style.setProperty('--nova-hero-size', zoom > 1.001 ? `auto ${(zoom * 100).toFixed(1)}%` : 'cover');
  }

  function buildBackdrop() {
    els.sceneStack.innerHTML = '';
    backdropLayers.length = 0;
    for (let i = 0; i < 2; i += 1) {
      const layer = document.createElement('div');
      layer.className = 'scene';
      const image = document.createElement('img');
      image.alt = '';
      image.decoding = 'async';
      image.draggable = false;
      layer.appendChild(image);
      els.sceneStack.appendChild(layer);
      backdropLayers.push(layer);
    }
    if (backdropLayers[0]) backdropLayers[0].classList.add('is-active');
    const game = currentGame();
    publishHeroVar(game);
    const image = $('img', backdropLayers[0]);
    if (image) {
      image.src = game ? game.heroUrl : 'assets/backdrop.jpg';
      applyHeroFraming(image, framingFor(game), true);
    }
  }

  function setBackdrop(game, instant = false) {
    if (!backdropLayers.length || !game) return;
    publishHeroVar(game);
    const token = ++backdropToken;
    const nextIndex = 1 - activeLayer;
    const next = backdropLayers[nextIndex];
    const image = $('img', next);
    const same = image.getAttribute('src') === game.heroUrl;

    const activate = () => {
      if (token !== backdropToken) return;
      applyHeroFraming(image, framingFor(game), true);
      next.classList.add('is-active');
      backdropLayers[activeLayer].classList.remove('is-active');
      activeLayer = nextIndex;
    };

    if (!same) image.src = game.heroUrl;
    applyHeroFraming(image, framingFor(game), true);

    if (same && image.complete && image.naturalWidth) {
      if (instant) {
        backdropLayers.forEach((layer, index) => layer.classList.toggle('is-active', index === nextIndex));
        activeLayer = nextIndex;
        return;
      }
      requestAnimationFrame(activate);
      return;
    }
    if (image.complete && image.naturalWidth) {
      requestAnimationFrame(activate);
      return;
    }
    image.onload = activate;
    image.onerror = activate;
  }
