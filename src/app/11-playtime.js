/* ============================================================
   APP PART 11 · playtime —— 游玩时长里程碑阶梯 —— 21 节点区间语义、HSL 最短弧插值、--prog-* 变量发布
   这是 src/app/ 分片之一：由 tools/build-app.js 按文件名序拼回 src/app.js。
   所有分片共享同一个 IIFE 闭包（跨分片直接引用函数与 state）。
   改代码请改分片，改完运行 node tools/build-app.js；直接编辑 app.js 会被覆盖。
   ============================================================ */

  /* ============================================================
     PLAYTIME LADDER — 游玩时长里程碑变色
     Twenty-one colour milestones (hours). A bar's fill colour
     holds between nodes and steps at each one; the fill WIDTH
     always shows progress toward the NEXT node, so a late-game
     bar reads as "on its way" instead of pinned (user decision).
     Each theme declares six anchors --prog-l0..l5 in its own
     palette; the 21 nodes spread across them:
       l0 base · 50..200 → l0→l1 · 300..1000 → l1→l2
       1500..5000 → l2→l3 · 6000..9000 → l3→l4 · 10000 → l5
     Steps are interpolated in HSL (shortest hue arc, S/L lerp) so
     every hop stays vivid and clearly distinct — anchor pairs are
     chosen 90°+ apart (or with a large S/L swing) for that. Plain
     JS only (no color-mix) so the legacy WebView2 109 renderer
     paints the same ladder. Every track gets --prog-fill /
     --prog-fill-soft / --prog-fill-deep / --prog-glow +
     data-prog-tier="0..21" published on itself.
     ============================================================ */

  const PLAYTIME_TIERS = [50, 75, 100, 150, 200, 300, 400, 500, 650, 800, 1000, 1500, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000];
  const PLAYTIME_ERAS = [
    { from: 0, to: 1, nodes: 5 },
    { from: 1, to: 2, nodes: 6 },
    { from: 2, to: 3, nodes: 5 },
    { from: 3, to: 4, nodes: 4 }
  ];

  function playtimeHours(seconds) { return (seconds || 0) / 3600; }

  /** 0 = a theme's base colour; 1..20 = milestone index; 21 = the finale. */
  function playtimeTierIndex(seconds) {
    const hours = playtimeHours(seconds);
    for (let i = 0; i < PLAYTIME_TIERS.length; i += 1) {
      if (hours < PLAYTIME_TIERS[i]) return i;
    }
    return PLAYTIME_TIERS.length;
  }

  /** Fill width = distance to the next colour node. [0,50) climbs toward
      the first node; every later segment refills from zero; the finale
      holds at 100%. Running games keep their forced 100% upstream. */
  function playtimePct(seconds) {
    const tier = playtimeTierIndex(seconds);
    if (tier <= 0) return Math.min(100, Math.round((playtimeHours(seconds) / PLAYTIME_TIERS[0]) * 100));
    if (tier >= PLAYTIME_TIERS.length) return 100;
    const start = PLAYTIME_TIERS[tier - 1];
    const end = PLAYTIME_TIERS[tier];
    return Math.min(100, Math.round(((playtimeHours(seconds) - start) / (end - start)) * 100));
  }

  function normalizeColor(value) {
    const text = String(value || '').trim();
    let match = text.match(/^#([0-9a-f]{6})$/i);
    if (match) return `#${match[1].toLowerCase()}`;
    match = text.match(/^#([0-9a-f]{3})$/i);
    if (match) return `#${match[1][0]}${match[1][0]}${match[1][1]}${match[1][1]}${match[1][2]}${match[1][2]}`;
    match = text.match(/^rgba?\(([^)]+)\)$/i);
    if (match) {
      const parts = match[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      if (parts.length >= 3 && parts.slice(0, 3).every(Number.isFinite)) {
        return toHex({ r: parts[0], g: parts[1], b: parts[2] });
      }
    }
    return null;
  }

  function hexGlow(hex) {
    const { r, g, b } = parseHex(hex);
    return `rgba(${r}, ${g}, ${b}, .35)`;
  }

  let progLadderCache = { id: null, anchors: null };

  /** The active theme's declared anchors. Computed styles resolve var()
      chains, so themes may reference their own tokens; values must land
      as plain colours for the legacy renderer. */
  function themeProgLadder() {
    const id = (window.NovaTheme && window.NovaTheme.activeId) || 'nova';
    if (progLadderCache.id === id && progLadderCache.anchors) return progLadderCache.anchors;
    const styles = getComputedStyle(document.documentElement);
    const anchors = [];
    for (let i = 0; i < 6; i += 1) anchors.push(normalizeColor(styles.getPropertyValue(`--prog-l${i}`)));
    progLadderCache.id = id;
    progLadderCache.anchors = anchors;
    return anchors;
  }

  /** Prestige ramp for themes without a declared ladder — and nova's own
      ladder, which stays cover-directed like everything else on that page.
      Cover pairs skew dark/muted, and the bars sit on the dark hero, so the
      ramp LIFTS as it climbs (dark-mode rule: lighter tonal variants, not
      deeper ones): cover accent → lifted secondary → warm amber → gold →
      bright gold → white-hot finale. */
  function deriveLadder(baseHex, secondHex) {
    const base = normalizeColor(baseHex) || '#ffb45e';
    const second = normalizeColor(secondHex) || mixHex(base, '#ffffff', .35);
    return [
      base,
      lighten(second, .18),
      mixHex(lighten(second, .32), '#e8b04a', .45),
      mixHex('#e8b04a', '#ffe9b0', .35),
      lighten('#e8b04a', .45),
      lighten('#fff3d6', .3)
    ];
  }

  function progLadderFor(game) {
    if (state.settings.styleMode === 'system') return deriveLadder('#e7dcc9', '#c7b79d');
    const root = document.documentElement;
    if (root.classList.contains('theme-custom')) {
      const anchors = themeProgLadder();
      if (anchors.every((color) => color)) return anchors;
      // A theme without a ladder still owns its palette: derive from its
      // accent tokens, never from the cover.
      const styles = getComputedStyle(root);
      return deriveLadder(styles.getPropertyValue('--accent'), styles.getPropertyValue('--accent-2'));
    }
    return deriveLadder((game && game.accent) || '#ffb45e', (game && game.accent2) || '#ff6b79');
  }

  function hexToHsl(hex) {
    const r = parseHex(hex).r / 255;
    const g = parseHex(hex).g / 255;
    const b = parseHex(hex).b / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > .5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h, s, l };
  }

  function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    const to = (v) => Math.max(0, Math.min(255, Math.round((v + m) * 255)));
    return `#${[to(r), to(g), to(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  }

  /** Perceptual mix: hue walks its shortest arc (wrap-aware) while
      saturation/lightness lerp linearly. Unlike RGB mixing this never
      cancels two anchors into a desaturated mid-tone, so adjacent
      milestone colours stay vivid and clearly distinct. */
  function mixHsl(a, b, amount) {
    const first = hexToHsl(a);
    const second = hexToHsl(b);
    let dh = second.h - first.h;
    if (dh > 180) dh -= 360;
    if (dh < -180) dh += 360;
    return hslToHex(
      first.h + dh * amount,
      first.s + (second.s - first.s) * amount,
      first.l + (second.l - first.l) * amount
    );
  }

  /** Colour at a tier: each era spreads evenly across its anchor pair. */
  function tierColorAt(anchors, tier) {
    if (tier <= 0) return anchors[0];
    if (tier >= PLAYTIME_TIERS.length) return anchors[5];
    let offset = tier - 1;
    for (const era of PLAYTIME_ERAS) {
      if (offset < era.nodes) return mixHsl(anchors[era.from], anchors[era.to], (offset + 1) / era.nodes);
      offset -= era.nodes;
    }
    return anchors[5];
  }

  function tierVarsFor(game, seconds) {
    const tier = playtimeTierIndex(seconds);
    const fill = tierColorAt(progLadderFor(game), tier);
    return {
      tier,
      fill,
      soft: mixHex(fill, '#ffffff', .34),
      deep: mixHex(fill, '#050609', .34),
      glow: hexGlow(fill)
    };
  }

  /** Publish the tier state onto a track container. The fill inherits the
      variables; data-prog-tier lets themes branch per node (finale etc.).
      Tier 0 publishes NOTHING — surfaces keep their own base colours, so
      [0, 50h) is pixel-identical to today even for themes whose chrome
      tracks and on-art fills use different base colours. */
  function applyTier(track, game) {
    if (!track) return;
    const vars = tierVarsFor(game, game ? game.playtimeSeconds : 0);
    if (vars.tier <= 0) {
      ['--prog-fill', '--prog-fill-soft', '--prog-fill-deep', '--prog-glow'].forEach((name) => track.style.removeProperty(name));
      track.dataset.progTier = '0';
      track.classList.remove('is-tier-max');
      return;
    }
    track.style.setProperty('--prog-fill', vars.fill);
    track.style.setProperty('--prog-fill-soft', vars.soft);
    track.style.setProperty('--prog-fill-deep', vars.deep);
    track.style.setProperty('--prog-glow', vars.glow);
    track.dataset.progTier = String(vars.tier);
    track.classList.toggle('is-tier-max', vars.tier >= PLAYTIME_TIERS.length);
  }

  /** Inline attribute twin of applyTier() for template-built tracks. */
  function progTierAttrs(game) {
    const vars = tierVarsFor(game, game.playtimeSeconds || 0);
    const max = vars.tier >= PLAYTIME_TIERS.length ? ' is-tier-max' : '';
    if (vars.tier <= 0) return { max, attrs: ` data-prog-tier="0"` };
    return {
      max,
      attrs: ` style="--prog-fill:${vars.fill};--prog-fill-soft:${vars.soft};--prog-fill-deep:${vars.deep};--prog-glow:${vars.glow}" data-prog-tier="${vars.tier}"`
    };
  }

  function nextTierText(seconds) {
    const tier = playtimeTierIndex(seconds);
    if (tier >= PLAYTIME_TIERS.length) return '已达最终阶段';
    return `下一阶段 · ${PLAYTIME_TIERS[tier]} 小时`;
  }
