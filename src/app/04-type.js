/* ============================================================
   APP PART 04 · type —— 字标导演 TYPE DIRECTOR —— 按封面/主题解算标题字标方案
   这是 src/app/ 分片之一：由 tools/build-app.js 按文件名序拼回 src/app.js。
   所有分片共享同一个 IIFE 闭包（跨分片直接引用函数与 state）。
   改代码请改分片，改完运行 node tools/build-app.js；直接编辑 app.js 会被覆盖。
   ============================================================ */

  /* ============================================================
     TYPE DIRECTOR
     Same constrained recipe system as the concept, but DNA now comes
     from the real cover analysis (accent luminance/sat proxy).
     ============================================================ */

  const RECIPE_ZH = {
    gilded: '描金衬线',
    poster: '海报窄体',
    grotesk: '现代无衬线',
    inscription: '石刻宽体',
    boutique: '精品衬线',
    monolith: '极简无衬线',
    kinetic: '动感斜体',
    outline: '描边窄体'
  };

  const TYPE_RECIPES = [
    { id: 'gilded', label: 'GILDED SERIF', family: '思源宋体', detail: 'Italic · 600 · Optical gradient', profile: { luma: .31, sat: .62, warmth: .66, edge: .09 } },
    { id: 'poster', label: 'POSTER CONDENSED', family: '思源黑体', detail: 'Condensed · Offset impression', displayCase: 'upper', profile: { luma: .28, sat: .42, warmth: .53, edge: .15 } },
    { id: 'grotesk', label: 'NEO GROTESK', family: '思源黑体', detail: 'Bold · Cool gradient', profile: { luma: .62, sat: .36, warmth: .44, edge: .12 } },
    { id: 'inscription', label: 'INSCRIPTION', family: '思源宋体', detail: 'Wide caps · Metallic gradient', profile: { luma: .21, sat: .47, warmth: .48, edge: .07 } },
    { id: 'boutique', label: 'BOUTIQUE SERIF', family: '思源宋体', detail: 'Italic · Title case · Soft light', displayCase: 'title', profile: { luma: .48, sat: .62, warmth: .72, edge: .11 } },
    { id: 'monolith', label: 'MONOLITH', family: '思源黑体', detail: 'Light · Wide tracking · No fill effects', profile: { luma: .09, sat: .16, warmth: .50, edge: .03 } },
    { id: 'kinetic', label: 'KINETIC DISPLAY', family: '思源黑体', detail: 'Bold italic · Chromatic gradient', profile: { luma: .49, sat: .48, warmth: .45, edge: .17 } },
    { id: 'outline', label: 'OUTLINE', family: '思源黑体', detail: 'Condensed · Stroke + offset', displayCase: 'upper', profile: { luma: .35, sat: .40, warmth: .55, edge: .12 } }
  ];

  const LOGO_VARS = [
    '--logo-light', '--logo-accent', '--logo-accent-2', '--logo-dark',
    '--logo-angle', '--logo-offset-dir', '--logo-track', '--logo-fit'
  ];

  const TYPE_TRACKS = { gilded: -.018, poster: .032, grotesk: .005, inscription: .16, boutique: -.015, monolith: .155, kinetic: -.025, outline: .038 };

  function seededUnit(key) {
    let hash = 2166136261 >>> 0;
    for (let i = 0; i < key.length; i += 1) {
      hash ^= key.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    hash ^= hash >>> 13;
    hash = Math.imul(hash, 0x5bd1e995);
    hash ^= hash >>> 15;
    return (hash >>> 0) / 4294967296;
  }

  function parseHex(hex) {
    const value = String(hex || '').replace('#', '');
    if (value.length !== 6) return { r: 255, g: 255, b: 255 };
    return { r: parseInt(value.slice(0, 2), 16), g: parseInt(value.slice(2, 4), 16), b: parseInt(value.slice(4, 6), 16) };
  }

  function luminanceOf(hex) {
    const { r, g, b } = parseHex(hex);
    return (.2126 * r + .7152 * g + .0722 * b) / 255;
  }

  function toHex(rgb) {
    const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
    return `#${[rgb.r, rgb.g, rgb.b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('')}`;
  }

  function mixHex(a, b, amount) {
    const first = parseHex(a);
    const second = parseHex(b);
    return toHex({
      r: first.r + (second.r - first.r) * amount,
      g: first.g + (second.g - first.g) * amount,
      b: first.b + (second.b - first.b) * amount
    });
  }

  function lighten(hex, amount) { return mixHex(hex, '#ffffff', amount); }
  function darken(hex, amount) { return mixHex(hex, '#050609', amount); }

  /* WCAG relative luminance. `luminanceOf` above is a cheap 0–1 average used to
     match title recipes; contrast math needs the gamma-corrected version. */
  function wcagLuminance(rgb) {
    const channel = (value) => {
      const c = Math.max(0, Math.min(255, value)) / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
  }

  function contrastRatio(a, b) {
    const first = wcagLuminance(typeof a === 'string' ? parseHex(a) : a);
    const second = wcagLuminance(typeof b === 'string' ? parseHex(b) : b);
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  }

  /**
   * The readable version of a cover-sampled accent on nova's carbon page.
   * Small labels (kickers, framing values, platform chips) paint with
   * --accent-text, and the accent comes from the cover: a dark cover put them
   * at 2:1. Lift toward white, hue intact, until 12px text clears AA.
   */
  function readableAccentText(hex, backdrop, target = 4.6) {
    let current = hex;
    for (let step = 0; step < 24 && contrastRatio(current, backdrop || '#0a0c11') < target; step += 1) {
      current = lighten(current, 0.12);
    }
    return current;
  }

  /**
   * Text colour to place *on* a filled accent surface.
   * --accent is a fill colour sampled from the cover, so it can be any
   * luminance; a fixed ink (#0b0d11) was 2.08:1 on a dark blue cover. Pick
   * whichever of ink/white wins against the actual fill instead.
   */
  function readableOn(hex) {
    const dark = '#0b0d11';
    const light = '#ffffff';
    const a = contrastRatio(dark, hex);
    const b = contrastRatio(light, hex);
    return a >= b ? dark : light;
  }

  /**
   * A solid plate + text pair that is guaranteed to clear AA.
   *
   * Covers pass through a narrow mid-tone band (luma ≈ 0.18–0.21) where
   * neither ink nor white reaches 4.5:1 — CrossCode's #8c7142 measured
   * 4.22 with ink and 4.4 with white. The plate is therefore nudged toward
   * whichever side already reads better, one step at a time, until the
   * winning text clears the threshold. For every accent outside the band
   * the plate comes back untouched.
   */
  function solveSolidPair(plateHex) {
    let plate = plateHex;
    for (let step = 0; step < 24; step += 1) {
      const fg = readableOn(plate);
      if (contrastRatio(fg, plate) >= 4.5) return { plate, fg };
      const whiteWins = contrastRatio('#ffffff', plate) >= contrastRatio('#0b0d11', plate);
      plate = whiteWins ? lighten(plate, .08) : darken(plate, .08);
    }
    return { plate, fg: readableOn(plate) };
  }

  function dnaFor(game) {
    const dna = game && game.dna ? game.dna : null;
    return {
      luma: clamp01(dna ? dna.luma : luminanceOf(game ? game.accent : '#ffb45e')),
      sat: clamp01(dna ? dna.sat : .5),
      warmth: clamp01(dna ? dna.warmth : .5),
      edge: clamp01(dna ? dna.edge : .1)
    };
  }

  const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));

  function recipeDistance(game, recipe) {
    const dna = dnaFor(game);
    const p = recipe.profile;
    return Math.abs(dna.luma - p.luma) + Math.abs(dna.sat - p.sat) + Math.abs(dna.warmth - p.warmth) * 1.1 + Math.abs(dna.edge - p.edge) * 2.2;
  }

  let typeMapCache = { seed: null, size: -1, map: null };

  function buildTypeMap(seed) {
    const pairs = [];
    state.games.forEach((game) => {
      TYPE_RECIPES.forEach((recipe) => {
        const jitter = seededUnit(`${game.id}|${recipe.id}|${seed}`) * .09;
        pairs.push({ gameId: game.id, recipeId: recipe.id, score: recipeDistance(game, recipe) + jitter });
      });
    });
    pairs.sort((a, b) => a.score - b.score);

    const assignment = {};
    const used = new Set();
    pairs.forEach((pair) => {
      if (assignment[pair.gameId] || used.has(pair.recipeId)) return;
      assignment[pair.gameId] = pair.recipeId;
      used.add(pair.recipeId);
    });

    if (seed > 0 && state.games.length > 1) {
      const ids = state.games.map((game) => game.id);
      const candidates = [];
      for (let i = 0; i < ids.length; i += 1) {
        for (let j = i + 1; j < ids.length; j += 1) {
          const first = ids[i];
          const second = ids[j];
          const firstRecipe = assignment[first];
          const secondRecipe = assignment[second];
          if (!firstRecipe || !secondRecipe || firstRecipe === secondRecipe) continue;
          const firstGame = findGame(first);
          const secondGame = findGame(second);
          if (!firstGame || !secondGame) continue;
          const r1 = TYPE_RECIPES.find((r) => r.id === firstRecipe);
          const r2 = TYPE_RECIPES.find((r) => r.id === secondRecipe);
          if (!r1 || !r2) continue;
          const now = recipeDistance(firstGame, r1) + recipeDistance(secondGame, r2);
          const swapped = recipeDistance(firstGame, r2) + recipeDistance(secondGame, r1);
          const delta = swapped - now;
          if (delta > .5) continue;
          candidates.push({ first, second, score: delta + seededUnit(`remix|${seed}|${first}|${second}`) * .05 });
        }
      }
      candidates.sort((a, b) => a.score - b.score);
      if (candidates.length) {
        const pool = candidates.slice(0, Math.min(10, candidates.length));
        const pick = pool[Math.floor(seededUnit(`remix-pick|${seed}`) * pool.length)];
        const firstRecipe = assignment[pick.first];
        assignment[pick.first] = assignment[pick.second];
        assignment[pick.second] = firstRecipe;
      }
    }
    return assignment;
  }

  function getTypeMap() {
    if (typeMapCache.seed !== state.settings.typeSeed || typeMapCache.size !== state.games.length || !typeMapCache.map) {
      typeMapCache = { seed: state.settings.typeSeed, size: state.games.length, map: buildTypeMap(state.settings.typeSeed) };
    }
    return typeMapCache.map;
  }

  function recipeFor(game) {
    // A per-game override lets the player choose the title face directly
    // from the editor; empty means the cover director decides.
    if (game && game.typeRecipe) {
      const chosen = TYPE_RECIPES.find((recipe) => recipe.id === game.typeRecipe);
      if (chosen) return chosen;
    }
    const map = getTypeMap();
    return TYPE_RECIPES.find((recipe) => recipe.id === map[game.id]) || TYPE_RECIPES[0];
  }

  function logoPaletteFor(game) {
    const colors = (game.colors || []).slice().sort((a, b) => luminanceOf(b) - luminanceOf(a));
    return {
      light: colors[0] || '#f5f2ea',
      dark: colors[colors.length - 1] || '#08090c',
      accent: game.accent || '#ffb45e',
      accent2: game.accent2 || '#ff6b79'
    };
  }

  function toTitleCase(value) {
    return String(value).toLowerCase().replace(/(^|[\s-])([a-z])/g, (match, prefix, letter) => prefix + letter.toUpperCase());
  }

  function applyTypeVariables(element, game, recipe) {
    const palette = logoPaletteFor(game);
    const seed = state.settings.typeSeed;
    const baseTrack = TYPE_TRACKS[recipe.id] || 0;
    const jitter = (seededUnit(`${game.id}|${recipe.id}|${seed}|track`) - .5) * .012;
    const angle = [96, 112, 136, 154, 172][Math.floor(seededUnit(`${game.id}|${recipe.id}|${seed}|angle`) * 5)];
    const direction = seededUnit(`${game.id}|${recipe.id}|${seed}|offset`) > .5 ? 1 : -1;
    element.style.setProperty('--logo-light', palette.light);
    element.style.setProperty('--logo-dark', palette.dark);
    element.style.setProperty('--logo-accent', palette.accent);
    element.style.setProperty('--logo-accent-2', palette.accent2);
    element.style.setProperty('--logo-angle', `${angle}deg`);
    element.style.setProperty('--logo-offset-dir', String(direction));
    element.style.setProperty('--logo-track', `${(baseTrack + jitter).toFixed(4)}em`);
  }

  // Width the title actually has to fit into, and the width it actually wants.
  // Both are measured on the *content* box: a theme may reserve a gutter for a
  // badge with padding, and that gutter must not be handed back to the text.
  function logoMetrics(element) {
    const style = getComputedStyle(element);
    const padX = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
    const marginX = (parseFloat(style.marginLeft) || 0) + (parseFloat(style.marginRight) || 0);
    const range = document.createRange();
    range.selectNodeContents(element);
    const rect = range.getBoundingClientRect();
    // The logo is often width:fit-content, so its own clientWidth shrinks with
    // the font size. Measure the stable text column (the parent) instead;
    // otherwise every shrink changes "available" too and the fit oscillates.
    const parent = element.parentElement;
    let available;
    if (parent) {
      const parentStyle = getComputedStyle(parent);
      available = parent.clientWidth
        - (parseFloat(parentStyle.paddingLeft) || 0)
        - (parseFloat(parentStyle.paddingRight) || 0)
        - marginX;
    } else {
      available = element.clientWidth - padX;
    }
    // A rect is empty for an empty element, so keep the box as a floor.
    const required = Math.max(rect.width, 1);
    return { available: Math.max(0, available), required };
  }

  // Converge synchronously first: the ratio drives font-size, so leaving the
  // first pass to requestAnimationFrame paints an oversized title for a frame
  // or two on every theme switch and view change. Then keep re-measuring across
  // a few frames, because web fonts, theme CSS and the intro swap all land
  // after the first paint and would invalidate a one-shot measurement.
  function fitLogo(element, options = {}) {
    if (!element || !element.isConnected) return;
    if (!options.keep) element.style.removeProperty('--logo-fit');

    // Returns true once the title fits the content box. Side bearings and the
    // .985 safety factor make the correction slightly sub-linear, hence two
    // synchronous passes rather than an assumed exact ratio.
    const settle = () => {
      const { available, required } = logoMetrics(element);
      if (available <= 0 || required <= 1) return true;
      if (required <= available * .998) return true;
      const current = parseFloat(element.style.getPropertyValue('--logo-fit')) || 1;
      const ratio = Math.max(.22, Math.min(1, current * (available / required) * .985));
      element.style.setProperty('--logo-fit', ratio.toFixed(3));
      return false;
    };

    for (let i = 0; i < 2 && !settle(); i += 1) { /* re-measure, then correct */ }

    let passes = 0;
    const step = () => {
      if (!element.isConnected) return;
      const fits = settle();
      if (fits && passes >= 2) return;
      if (passes++ < 3) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // Ink width of an element's text, measured with a Range so trailing spaces and
  // the line box do not enter the number.
  function textWidth(element) {
    const range = document.createRange();
    range.selectNodeContents(element);
    return Math.max(range.getBoundingClientRect().width, 1);
  }

  /* 铁律 3（任何文字都不许被截断）——统计格里的数值也要自适应。
     .stat-value 在框架里是 nowrap + ellipsis，窄窗（960x600）下 detail 页的
     「不到 1 分钟」需要 74px 而格子只有 66px，于是 11 个主题全被省略号吃掉
     半个词（audit 的 clipped 报的就是这个）。这里按可用宽度等比缩字号——
     注意是**同一行取同一个系数**：只缩溢出那一格会让一行里出现三种字号，
     比截断更难看。缩得动就永远不落到 ellipsis 那一支，ellipsis 只作为字号
     见底（8px）之后的最后防线。盒子由 grid 定宽，改字号不会反过来改盒子，
     所以这里没有 fitLogo 那种自反馈震荡。 */
  function refitStats() {
    const groups = new Map();
    $$('.stat-value').forEach((element) => {
      const group = element.closest('.detail-stats') || element.parentElement;
      if (!group) return;
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(element);
    });
    groups.forEach((items) => {
      items.forEach((element) => element.style.removeProperty('font-size'));
      let scale = 1;
      const bases = items.map((element) => {
        const available = element.clientWidth;
        const required = textWidth(element);
        const base = parseFloat(getComputedStyle(element).fontSize) || 12;
        if (available > 0 && required > available) {
          scale = Math.min(scale, (available / required) * .985);
        }
        return base;
      });
      if (scale >= 1) return;
      items.forEach((element, index) => {
        element.style.fontSize = `${Math.max(8, bases[index] * scale).toFixed(2)}px`;
      });
    });
  }

  function refitLogos() {
    $$('.logo').forEach((element) => {
      element.style.removeProperty('--logo-fit');
      fitLogo(element);
    });
    refitStats();
    watchLogos();
  }

  // fitLogo only runs at fixed moments (boot, theme switch, view switch, resize,
  // fonts.ready). The appearance preview and the view overlays animate, so the box
  // measured at +140ms is often not the final one, and nothing refits afterwards:
  // grimoire's preview title stayed at 472px of required width inside a 450px box
  // (22px of horizontal truncation) until the next unrelated refit. Rather than
  // guess more delays, watch the logos' own boxes and settle whenever one changes.
  let logoObserver = null;
  // Theme CSS and layout transitions can resize a logo's box several times in
  // a row. Fitting on every callback made the headline step through a handful
  // of sizes after each switch; coalesce the burst into one settle.
  const pendingFits = new WeakMap();
  function scheduleFit(element) {
    const previous = pendingFits.get(element);
    if (previous) clearTimeout(previous);
    pendingFits.set(element, setTimeout(() => {
      pendingFits.delete(element);
      if (element.isConnected) fitLogo(element, { keep: true });
    }, 120));
  }
  function watchLogos() {
    if (!('ResizeObserver' in window)) return;
    if (!logoObserver) {
      logoObserver = new ResizeObserver((entries) => {
        let statsDirty = false;
        entries.forEach((entry) => {
          const element = entry.target;
          // renderDetail() replaces .detail-stats wholesale on every game switch,
          // so drop the old nodes instead of letting the observer hold them.
          if (!element.isConnected) { logoObserver.unobserve(element); return; }
          // Stat cells are grid-sized, so a font-size change cannot re-enter here;
          // one refit pass per resize is enough (and it covers .detail-stats being
          // re-laid out when the window or the detail sheet changes width).
          if (element.classList.contains('stat-value')) { statsDirty = true; return; }
          const { available, required } = logoMetrics(element);
          if (available <= 0 || required <= 1) return;
          // Only correct overflow. Growing on every observer callback made
          // fit-content logos oscillate between 1 and the shrunken size.
          if (required > available * .998) scheduleFit(element);
        });
        if (statsDirty) refitStats();
      });
    }
    $$('.logo').forEach((element) => logoObserver.observe(element));
    $$('.stat-value').forEach((element) => logoObserver.observe(element));
  }

  function setLogo(element, game, baseClass, options = {}) {
    if (!element) return;
    const mode = options.forceMode || state.settings.styleMode;
    LOGO_VARS.forEach((name) => element.style.removeProperty(name));
    element.classList.remove('is-retyping');
    element.style.removeProperty('--logo-fit');

    const text = options.text ?? (game ? game.logo : 'GUGUOVA');
    const forced = options.recipe
      ? TYPE_RECIPES.find((recipe) => recipe.id === options.recipe)
      : null;
    const recipe = forced || (game ? recipeFor(game) : null);

    if (mode === 'system') {
      element.className = `logo ${baseClass} type-system`;
      element.textContent = text;
      element.dataset.recipe = 'system';
    } else if (recipe) {
      element.className = `logo ${baseClass} type-${recipe.id}`;
      element.textContent = recipe.displayCase === 'title' ? toTitleCase(text) : text;
      element.dataset.recipe = recipe.id;
      if (game) applyTypeVariables(element, game, recipe);
    } else {
      element.className = `logo ${baseClass} type-gilded`;
      element.textContent = text;
      element.dataset.recipe = 'gilded';
    }

    // 长标题走另一套字号规则：短名保持 fitLogo 的大字，长名由主题
    // 决定是否换行 + 用更小的字号（.is-long-title）。
    element.classList.toggle('is-long-title', [...(element.textContent || '')].length > 14);

    fitLogo(element);
    if (options.animate) {
      void element.offsetWidth;
      element.classList.add('is-retyping');
    }
  }

  function typeReadoutHTML(game) {
    const dna = dnaFor(game);
    return [['亮度', dna.luma], ['饱和', dna.sat], ['细节', dna.edge]]
      .map(([label, value]) => `<span>${label} ${Math.round(value * 100)}%</span>`).join('');
  }

  function updateTypeReadout() {
    if (!els.typeRecipeName) return;
    const game = currentGame();
    const system = state.settings.styleMode === 'system';
    $$('.type-readout').forEach((el) => el.classList.toggle('is-system', system));

    if (system) {
      els.typeRecipeName.textContent = 'GUGUOVA 统一字体';
      els.typeRecipeSpec.textContent = '思源宋体 · 统一字标';
      els.typeSeedLabel.textContent = '统一字标';
      els.typeShuffleLabel.textContent = '系统固定';
      els.typeShuffleBtn.disabled = true;
      els.typeDna.innerHTML = '<span>统一字体</span><span>暖白</span><span>中性光</span>';
      return;
    }

    if (!game) {
      els.typeRecipeName.textContent = 'GILDED SERIF';
      els.typeRecipeSpec.textContent = '等待添加游戏';
      els.typeSeedLabel.textContent = '—';
      els.typeShuffleLabel.textContent = '换一套';
      els.typeShuffleBtn.disabled = true;
      els.typeDna.innerHTML = '<span>还没有封面</span><span>添加游戏后生成</span>';
      return;
    }

    const recipe = recipeFor(game);
    const index = TYPE_RECIPES.findIndex((item) => item.id === recipe.id) + 1;
    els.typeRecipeName.textContent = RECIPE_ZH[recipe.id] ? `${RECIPE_ZH[recipe.id]} · ${recipe.label}` : recipe.label;
    els.typeRecipeSpec.textContent = `${recipe.family} · ${recipe.detail}`;
    els.typeSeedLabel.textContent = `方案 ${String(index).padStart(2, '0')} · 第 ${String(state.settings.typeSeed + 1).padStart(2, '0')} 版`;
    els.typeShuffleLabel.textContent = '换一套';
    els.typeShuffleBtn.disabled = false;
    els.typeDna.innerHTML = typeReadoutHTML(game);
  }

  function shuffleTypeDirection() {
    if (state.settings.styleMode === 'system' || !state.games.length) return;
    state.settings.typeSeed = (state.settings.typeSeed + 1) % 99;
    saveSettings();
    const game = currentGame();
    setLogo(els.gameLogo, game, 'hero-logo', { animate: true });
    setLogo(els.detailLogo, game, 'detail-logo', { animate: true });
    setLogo(els.appearanceLogo, game, 'appearance-logo', { animate: true });
    setLogo(els.launchLogo, game, 'launch-logo', { animate: true });
    setLogo(els.adaptiveChoiceLogo, game, 'choice-logo', {
      forceMode: 'adaptive',
      text: game ? shortName(game) : 'GUGUOVA',
      animate: true
    });
    setLogo(els.editorLogo, null, 'editor-logo', { text: editorLogoText() });
    updateTypeReadout();
    audio.select();
    toast('已换一套字标', 'spark');
  }

