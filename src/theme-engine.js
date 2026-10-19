(() => {
  'use strict';

  /* ============================================================
     NOVA · THEME ENGINE
     Loads an interface theme: one stylesheet plus optional token and
     icon overrides. Themes cannot run code, so a broken theme can
     never break the launcher — a failed stylesheet simply leaves the
     built-in look in place.
     ============================================================ */

  const BUILT_IN = {
    id: 'nova',
    name: 'NOVA 原生',
    author: 'NOVA',
    version: '2.0.0',
    description: '电影感外观：按钮与标题颜色跟随封面，适合每款游戏的独立气质。',
    intro: 'gilded',
    cssUrl: null,
    previewUrl: 'assets/theme-nova-preview.jpg?v=1.4.1',
    baseStyle: '',
    builtIn: true,
    ok: true,
    error: null,
    tokens: {},
    icons: {},
    features: {}
  };

  const state = {
    themes: [BUILT_IN],
    activeId: 'nova',
    folder: '',
    link: null,
    styleMode: 'adaptive',
    call: null,
    onApplied: null
  };

  const $ = (selector, root = document) => root.querySelector(selector);

  /* ---------- stylesheet ---------- */

  function themeLink() {
    if (state.link) return state.link;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.id = 'theme-stylesheet';
    // Insert after the base sheets but before the theme picker styles,
    // so a theme always wins over the built-in look.
    document.head.appendChild(link);
    state.link = link;
    return link;
  }

  const inlineSheet = document.createElement('style');
  inlineSheet.id = 'theme-inline';

  /**
   * Theme CSS is inlined into <head>, so a relative url("assets/...")
   * would resolve against the page instead of the theme folder. Rewrite
   * every relative reference to the theme's virtual-host URL before the
   * sheet is inlined. Data, absolute and fragment URLs are left alone.
   */
  function rewriteCssUrls(css, baseUrl) {
    if (!css || !baseUrl) return css;
    const absolute = /^(data:|https?:|\/\/|#|blob:)/i;
    let out = '';
    let cursor = 0;

    while (cursor < css.length) {
      const at = css.indexOf('url(', cursor);
      if (at < 0) {
        out += css.slice(cursor);
        break;
      }
      out += css.slice(cursor, at);

      // Consume the balanced parentheses so URL data with nested
      // "url(#id)" SVG references is treated as one value.
      let index = at + 4;
      let depth = 1;
      let quote = '';
      while (index < css.length && depth > 0) {
        const char = css[index];
        if (quote) {
          if (char === '\\') { index += 2; continue; }
          if (char === quote) quote = '';
        } else if (char === '"' || char === "'") {
          quote = char;
        } else if (char === '(') {
          depth += 1;
        } else if (char === ')') {
          depth -= 1;
        }
        index += 1;
      }

      if (depth !== 0) {
        out += css.slice(at);
        break;
      }

      const raw = css.slice(at + 4, index - 1).trim();
      const value = raw.replace(/^(['"])([\s\S]*)\1$/, '$2');
      if (absolute.test(value)) {
        out += css.slice(at, index);
      } else {
        try {
          out += `url("${new URL(value, baseUrl).href}")`;
        } catch (error) {
          out += css.slice(at, index);
        }
      }
      cursor = index;
    }
    return out;
  }

  /**
   * WebView2 serves virtual-host files from a cache that ignores query
   * strings, so a theme edited on disk would keep loading its old CSS.
   * Fetching with no-store and inlining it makes edits take effect at once.
   *
   * The result is kept in memory per session: switching back to a theme
   * is then a synchronous style swap instead of a filesystem round-trip.
   * `refresh()` clears the cache so an edited theme is re-read.
   */
  const cssCache = new Map();

  async function loadThemeCss(url, options = {}) {
    if (!url) return null;
    if (!options.fresh && cssCache.has(url)) return cssCache.get(url);
    try {
      const bust = `${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const response = await fetch(bust, { cache: 'no-store' });
      if (!response.ok) return null;
      const css = await response.text();
      const rewritten = rewriteCssUrls(css, url);
      cssCache.set(url, rewritten);
      return rewritten;
    } catch (error) {
      return null;
    }
  }

  /** Warm the stylesheet cache ahead of a click (hover / focus / idle). */
  function preload(id) {
    const theme = find(id);
    if (!theme || !theme.cssUrl || theme.ok === false) return Promise.resolve(null);
    return loadThemeCss(theme.cssUrl);
  }

  let preloadCursor = 0;
  let preloading = false;
  let preloadGeneration = 0;

  /**
   * Fetch every installed theme during idle time, one at a time. The files
   * live on the local disk, so this is cheap, and it removes the fetch from
   * the critical path of the first switch to each theme.
   */
  function preloadAll(options = {}) {
    if (preloading) return;
    const limit = Number(options.limit) || state.themes.length;
    const list = state.themes.filter((theme) => theme.cssUrl && theme.ok !== false).slice(0, limit);
    if (!list.length) return;
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 120));
    const generation = ++preloadGeneration;
    preloading = true;

    const step = () => {
      if (generation !== preloadGeneration) { preloading = false; return; }
      const theme = list[preloadCursor];
      if (!theme) { preloading = false; return; }
      preloadCursor += 1;
      preload(theme.id).finally(() => {
        if (generation === preloadGeneration) idle(step, { timeout: 1200 });
      });
    };

    idle(step, { timeout: 900 });
  }


  /**
   * The feature framework paints its surface textures on dedicated plates
   * instead of on body::before, because most themes already use those
   * pseudo-elements for their own background. The plates are the first
   * children of .app, so they sit above the shell background and below
   * every piece of chrome — decoration can never cover content.
   */
  function ensureSurfaces() {
    const app = document.getElementById('app') || document.body;
    ['a', 'b', 'c'].forEach((key) => {
      let plate = app.querySelector(`:scope > .fx-surface-${key}`);
      if (plate) return;
      plate = document.createElement('div');
      plate.className = `fx-surface fx-surface-${key}`;
      plate.setAttribute('aria-hidden', 'true');
      app.insertBefore(plate, app.firstChild);
    });
  }

  /**
   * Optional visual modules declared in theme.json. Each entry becomes a
   * root data attribute (data-fx-texture / data-fx-layer / data-fx-panel),
   * so a theme can opt into the shared framework pieces it wants and omit
   * the rest. Unknown keys are allowed but sanitised.
   */
  function applyFeatures(features) {
    ensureSurfaces();
    const root = document.documentElement;
    Object.keys(root.dataset || {}).slice().forEach((key) => {
      if (key.startsWith('fx') && key !== 'fx') root.removeAttribute(`data-${key.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}`);
    });
    Object.entries(features || {}).forEach(([key, value]) => {
      const name = String(key || '').toLowerCase();
      const module = String(value || '').toLowerCase();
      if (!/^[a-z0-9-]{1,24}$/.test(name)) return;
      if (!/^[a-z0-9-]{1,32}$/.test(module)) return;
      root.setAttribute(`data-fx-${name}`, module);
    });
  }

  /** Applies a theme by loading its stylesheet and merging token overrides. */
  async function apply(theme, options = {}) {
    const normalized = theme || BUILT_IN;
    const link = themeLink();

    if (normalized.cssUrl) {
      const css = await loadThemeCss(normalized.cssUrl);
      if (css != null) {
        inlineSheet.textContent = css;
        // Always last in <head> so a theme outranks every base sheet.
        document.head.appendChild(inlineSheet);
        link.removeAttribute('href');
      } else {
        // Fall back to a plain link if the fetch is blocked.
        link.href = normalized.cssUrl;
      }
      document.documentElement.dataset.theme = normalized.id;
    } else {
      link.removeAttribute('href');
      inlineSheet.textContent = '';
      document.documentElement.dataset.theme = 'nova';
    }

    // Token overrides are applied on the root element so any theme can
    // recolour without shipping its own stylesheet.
    applyTokens(normalized.tokens);
    applyIcons(normalized.icons || {});
    applyFeatures(normalized.features || {});
    state.activeId = normalized.id;
    document.documentElement.classList.toggle('theme-custom', !!normalized.cssUrl);

    if (normalized.cssUrl) {
      // Inline custom properties outrank stylesheets, so a themed button must
      // have the cover-derived ones removed — now and after each repaint.
      clearCtaVars();
      scheduleCtaWatch();
    } else {
      stopCtaWatch();
    }

    if (state.onApplied) state.onApplied(normalized, options);
    return normalized;
  }

  /** Clearing tokens must not clear the ones a theme set; track what we wrote. */
  const writtenTokens = new Set();

  function clearTokens() {
    writtenTokens.forEach((name) => document.documentElement.style.removeProperty(name));
    writtenTokens.clear();
  }

  function applyTokens(tokens) {
    clearTokens();
    Object.entries(tokens || {}).forEach(([name, value]) => {
      if (!name.startsWith('--')) return;
      document.documentElement.style.setProperty(name, value);
      writtenTokens.add(name);
    });
  }

  const CTA_VARS = ['--cta-a', '--cta-b', '--cta-a-hover', '--cta-b-hover', '--cta-fg', '--cta-border', '--cta-glow'];

  function clearCtaVars() {
    document.querySelectorAll('.btn.primary').forEach((button) => {
      CTA_VARS.forEach((name) => button.style.removeProperty(name));
    });
  }

  let ctaObserver = null;

  /** Watches style writes so a themed button never inherits cover colours. */
  function scheduleCtaWatch() {
    if (ctaObserver) return;
    ctaObserver = new MutationObserver(() => {
      if (!document.documentElement.classList.contains('theme-custom')) return;
      clearCtaVars();
    });
    ctaObserver.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['style']
    });
    clearCtaVars();
  }

  function stopCtaWatch() {
    if (!ctaObserver) return;
    ctaObserver.disconnect();
    ctaObserver = null;
  }

  /* ---------- icon overrides ---------- */

  const ICON_KEYS = [
    'play', 'info', 'search', 'bell', 'heart', 'sliders', 'fullscreen', 'moon',
    'sound-on', 'sound-off', 'plus', 'folder', 'disc', 'clock', 'gamepad',
    'download', 'check', 'close', 'arrow-right', 'arrow-left', 'spark'
  ];

  const originalIcons = new Map();
  let activeIconTheme = 'nova';

  function snapshotIcons() {
    ICON_KEYS.forEach((key) => {
      const symbol = document.getElementById(`i-${key}`);
      if (symbol && !originalIcons.has(key)) {
        originalIcons.set(key, symbol.innerHTML);
      }
    });
  }

  function applyIcons(icons) {
    snapshotIcons();
    const entries = Object.entries(icons || {});
    if (!entries.length) return;

    entries.forEach(([key, markup]) => {
      const symbol = document.getElementById(`i-${key}`);
      if (!symbol || typeof markup !== 'string') return;
      // Icons are inline SVG fragments declared by the theme author.
      symbol.innerHTML = markup;
    });
  }

  function restoreIcons() {
    originalIcons.forEach((markup, key) => {
      const symbol = document.getElementById(`i-${key}`);
      if (symbol) symbol.innerHTML = markup;
    });
  }

  /* ---------- listing ---------- */

  async function refresh() {
    if (!state.call) return state.themes;
    // A manual refresh must re-read CSS from disk, so the warmed cache is
    // dropped before the list is scanned again.
    cssCache.clear();
    preloadCursor = 0;
    preloadGeneration += 1;
    preloading = false;
    const result = await state.call('listThemes');
    if (!result || !result.ok) {
      state.themes = [BUILT_IN];
      return state.themes;
    }

    state.folder = result.folder || '';
    const list = [BUILT_IN];
    (result.themes || []).forEach((theme) => {
      if (theme.id === 'nova') return;
      list.push(Object.assign({}, theme, { builtIn: false }));
    });
    state.themes = list;
    return list;
  }

  function find(id) {
    return state.themes.find((theme) => theme.id === id) || BUILT_IN;
  }

  async function activate(id, options = {}) {
    const theme = find(id);
    if (theme && theme.ok === false) return { ok: false, error: theme.error };

    // Restore base icons before a new theme's overrides are applied.
    if (activeIconTheme !== 'nova') restoreIcons();
    clearTokens();

    const result = state.call ? await state.call('setTheme', { id: id || 'nova' }) : null;
    if (result && result.ok === false) return { ok: false, error: result.error };

    const applied = await apply(theme, options);
    activeIconTheme = applied.id;
    return { ok: true, theme: applied };
  }

  function start(host) {
    state.call = host.call;
    state.onApplied = host.onApplied || null;
    state.styleMode = host.styleMode || 'adaptive';
    return refresh();
  }

  window.NovaTheme = {
    BUILT_IN,
    start,
    refresh,
    find,
    activate,
    apply,
    preload,
    preloadAll,
    get themes() { return state.themes; },
    get activeId() { return state.activeId; },
    get folder() { return state.folder; }
  };
})();
