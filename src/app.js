(() => {
  'use strict';

  /* ============================================================
     NOVA DESKTOP · renderer
     Real game library: native bridge to the C# host, real launching,
     real playtime. No simulated installs.
     ============================================================ */

  const bridge = window.chrome && window.chrome.webview ? window.chrome.webview : null;
  const hasBridge = !!bridge;

  /* ---------- native bridge ---------- */

  let requestSeq = 0;
  const pending = new Map();

  function call(method, args = {}) {
    if (!hasBridge) return Promise.resolve(null);
    const id = `r${++requestSeq}`;
    return new Promise((resolve) => {
      pending.set(id, resolve);
      try {
        bridge.postMessage(JSON.stringify({ id, method, args }));
      } catch (error) {
        pending.delete(id);
        resolve({ ok: false, error: String(error) });
      }
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          resolve({ ok: false, error: 'native timeout' });
        }
      }, 60000);
    });
  }

  window.nova = { call };

  if (hasBridge) {
    bridge.addEventListener('message', (event) => {
      const message = event.data;
      if (!message || typeof message !== 'object') return;
      if (message.type === 'response') {
        const resolve = pending.get(message.id);
        if (resolve) {
          pending.delete(message.id);
          resolve(message.result);
        }
        return;
      }
      if (message.type === 'session-started') {
        onSessionStarted(message.payload);
        return;
      }
      if (message.type === 'session-ended') {
        onSessionEnded(message.payload);
        return;
      }
      if (message.type === 'window-state') {
        syncMaxButton(!!message.payload?.maximized);
        return;
      }
      if (message.type === 'fullscreen-state') {
        applyFullscreenState(!!message.payload?.fullscreen);
        return;
      }
      if (message.type === 'ask-close') {
        askClose();
        return;
      }
    });
  }

  /* ============================================================
     STATE
     ============================================================ */

  const state = {
    games: [],
    running: new Map(),
    settings: {
      playername: '玩家',
      avatarFile: null,
      sound: true,
      reduceMotion: false,
      styleMode: 'adaptive',
      typeSeed: 0,
      calm: false,
      closeToTray: false,
      autoBackup: true,
      librarySort: 'recent'
    },
    userName: '',
    avatarStamp: 0,
    stats: null,
    storage: null,
    system: null,
    developerMode: false,
    developerModeEnv: false,
    index: 0,
    overlay: null,
    libFilter: 'all',
    libQuery: '',
    lastFocus: null,
    toastTimer: null,
    launchTimers: [],
    manageOpen: false,
    manageConfirming: false,
    manageConfirmTimer: null,
    removeArmed: false,
    removeTimer: null,
    wheelLock: 0,
    hoverTimer: null,
    padIndex: null,
    padWelcome: false,
    libPadIndex: 0,
    scanning: false,
    scan: null,
    theme: 'nova',
    menuOpen: false,
    view: 'home',
    layout: 'row',
    editorMode: 'create',
    editorId: null,
    editorManifest: null,
    editorFraming: { x: 50, y: 45, zoom: 1 },
    dataFolder: '',
    backupsFolder: '',
    version: '1.5.3'
  };

  const notices = [];
  let noticeSeq = 0;

  /* ============================================================
     DOM
     ============================================================ */

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const els = {
    app: $('#app'),
    sceneStack: $('#sceneStack'),
    clockTime: $('#clockTime'),
    clockDate: $('#clockDate'),
    brandBtn: $('#brandBtn'),
    addBtn: $('#addBtn'),
    searchBtn: $('#searchBtn'),
    notifBtn: $('#notifBtn'),
    bellDot: $('#bellDot'),
    profileBtn: $('#profileBtn'),
    avatarLetter: $('#avatarLetter'),
    avatarLarge: $('#avatarLarge'),
    profileName: $('#profileName'),
    profileStatus: $('#profileStatus'),
    notifPanel: $('#notifPanel'),
    profileMenu: $('#profileMenu'),
    notifList: $('#notifList'),
    notifFootText: $('#notifFootText'),
    markReadBtn: $('#markReadBtn'),
    appearanceRow: $('#appearanceRow'),
    appearanceModeLabel: $('#appearanceModeLabel'),
    soundRow: $('#soundRow'),
    soundSwitch: $('#soundSwitch'),
    fullscreenRow: $('#fullscreenRow'),
    fullscreenLabel: $('#fullscreenLabel'),
    sleepRow: $('#sleepRow'),
    quitRow: $('#quitRow'),
    inputStatus: $('#inputStatus'),
    dataFolderBtn: $('#dataFolderBtn'),
    minBtn: $('#minBtn'),
    maxBtn: $('#maxBtn'),
    closeBtn: $('#closeBtn'),
    heroInner: $('#heroInner'),
    kickerLabel: $('#kickerLabel'),
    kickerDim: $('#kickerDim'),
    gameLogo: $('#gameLogo'),
    gameTagline: $('#gameTagline'),
    metaRow: $('#metaRow'),
    playBtn: $('#playBtn'),
    playLabel: $('#playLabel'),
    detailBtn: $('#detailBtn'),
    progressLabel: $('#progressLabel'),
    progressPct: $('#progressPct'),
    progressFill: $('#progressFill'),
    progressSub: $('#progressSub'),
    progressSubIcon: $('#progressSubIcon'),
    questCard: $('#questCard'),
    questKicker: $('#questKicker'),
    questTitle: $('#questTitle'),
    questDesc: $('#questDesc'),
    questPct: $('#questPct'),
    questMeta: $('#questMeta'),
    questFill: $('#questFill'),
    dockCount: $('#dockCount'),
    allBtn: $('#allBtn'),
    rail: $('#rail'),
    railEmpty: $('#railEmpty'),
    railAddCard: $('#railAddCard'),
    detailsOverlay: $('#detailsOverlay'),
    detailsClose: $('#detailsClose'),
    detailArt: $('#detailArt'),
    detailStatus: $('#detailStatus'),
    detailStatusText: $('#detailStatusText'),
    detailLogo: $('#detailLogo'),
    detailZh: $('#detailZh'),
    detailTitle: $('#detailTitle'),
    detailTagline: $('#detailTagline'),
    detailMeta: $('#detailMeta'),
    detailDesc: $('#detailDesc'),
    dProgressLabel: $('#dProgressLabel'),
    dProgressPct: $('#dProgressPct'),
    dProgressFill: $('#dProgressFill'),
    dProgressSub: $('#dProgressSub'),
    detailStats: $('#detailStats'),
    detailPath: $('#detailPath'),
    revealBtn: $('#revealBtn'),
    detailPlay: $('#detailPlay'),
    detailPlayLabel: $('#detailPlayLabel'),
    detailFav: $('#detailFav'),
    detailManage: $('#detailManage'),
    detailManageLabel: $('#detailManageLabel'),
    managePanel: $('#managePanel'),
    manageClose: $('#manageClose'),
    manageStats: $('#manageStats'),
    editRow: $('#editRow'),
    resetArtRow: $('#resetArtRow'),
    removeGameBtn: $('#removeGameBtn'),
    manageDoneBtn: $('#manageDoneBtn'),
    libraryOverlay: $('#libraryOverlay'),
    libBack: $('#libBack'),
    libSearch: $('#libSearch'),
    libStats: $('#libStats'),
    libFilters: $('#libFilters'),
    libGrid: $('#libGrid'),
    libEmpty: $('#libEmpty'),
    libEmptyTitle: $('#libEmptyTitle'),
    libEmptyText: $('#libEmptyText'),
    clearFilters: $('#clearFilters'),
    libAdd: $('#libAdd'),
    appearanceOverlay: $('#appearanceOverlay'),
    appearanceClose: $('#appearanceClose'),
    appearanceOptions: $('#appearanceOptions'),
    appearanceBg: $('#appearanceBg'),
    appearanceImage: $('#appearanceImage'),
    appearanceLogo: $('#appearanceLogo'),
    appearanceTagline: $('#appearanceTagline'),
    appearanceIndex: $('#appearanceIndex'),
    appearanceCta: $('#appearanceCta'),
    appearanceCtaLabel: $('#appearanceCtaLabel'),
    appearanceCtaNote: $('#appearanceCtaNote'),
    appearanceProgressFill: $('#appearanceProgressFill'),
    appearanceProgressPct: $('#appearanceProgressPct'),
    appearanceSwitcher: $('#appearanceSwitcher'),
    styleChoices: $('#styleChoices'),
    styleModeTag: $('#styleModeTag'),
    appearanceGameName: $('#appearanceGameName'),
    appearancePalette: $('#appearancePalette'),
    appearanceDataPath: $('#appearanceDataPath'),
    adaptivePreviewCta: $('#adaptivePreviewCta'),
    systemPreviewCta: $('#systemPreviewCta'),
    adaptiveChoiceLogo: $('#adaptiveChoiceLogo'),
    systemChoiceLogo: $('#systemChoiceLogo'),
    typeRecipeName: $('#typeRecipeName'),
    typeRecipeSpec: $('#typeRecipeSpec'),
    typeSeedLabel: $('#typeSeedLabel'),
    typeShuffleBtn: $('#typeShuffleBtn'),
    typeShuffleLabel: $('#typeShuffleLabel'),
    typeDna: $('#typeDna'),
    appearanceSoundRow: $('#appearanceSoundRow'),
    appearanceSoundSwitch: $('#appearanceSoundSwitch'),
    appearanceMotionRow: $('#appearanceMotionRow'),
    appearanceMotionSwitch: $('#appearanceMotionSwitch'),
    appearanceCalmRow: $('#appearanceCalmRow'),
    appearanceCalmSwitch: $('#appearanceCalmSwitch'),
    calmRow: $('#calmRow'),
    calmSwitch: $('#calmSwitch'),
    launchRing: $('#launchRing'),
    launchRingLabel: $('#launchRingLabel'),
    launchSteps: $('#launchSteps'),
    launchSystem: $('#launchSystem'),
    appearanceFullscreenRow: $('#appearanceFullscreenRow'),
    openDataRow: $('#openDataRow'),
    editorOverlay: $('#editorOverlay'),
    editorTitle: $('#editorTitle'),
    editorMode: $('#editorMode'),
    editorClose: $('#editorClose'),
    editorPreview: $('#editorPreview'),
    editorPreviewImg: $('#editorPreviewImg'),
    editorFraming: $('#editorFraming'),
    framingZoom: $('#framingZoom'),
    editorLogo: $('#editorLogo'),
    editorPreviewHint: $('#editorPreviewHint'),
    editorSwatches: $('#editorSwatches'),
    editorError: $('#editorError'),
    editorCancel: $('#editorCancel'),
    editorSave: $('#editorSave'),
    editorSaveLabel: $('#editorSaveLabel'),
    editorDelete: $('#editorDelete'),
    fExe: $('#fExe'),
    fPickExe: $('#fPickExe'),
    fName: $('#fName'),
    fZh: $('#fZh'),
    fGenre: $('#fGenre'),
    fLogo: $('#fLogo'),
    fTagline: $('#fTagline'),
    fImage: $('#fImage'),
    fPickImage: $('#fPickImage'),
    fArgs: $('#fArgs'),
    fWorkDir: $('#fWorkDir'),
    fDesc: $('#fDesc'),
    fAge: $('#fAge'),
    fMode: $('#fMode'),
    fTypeRecipe: $('#fTypeRecipe'),
    scannerOverlay: $('#scannerOverlay'),
    scannerClose: $('#scannerClose'),
    scannerSub: $('#scannerSub'),
    scannerStatus: $('#scannerStatus'),
    scannerStatusText: $('#scannerStatusText'),
    scannerSpinner: $('#scannerSpinner'),
    scannerList: $('#scannerList'),
    scannerRescan: $('#scannerRescan'),
    scannerManual: $('#scannerManual'),
    scannerImport: $('#scannerImport'),
    scannerImportLabel: $('#scannerImportLabel'),
    launchOverlay: $('#launchOverlay'),
    launchArt: $('#launchArt'),
    launchLogo: $('#launchLogo'),
    launchKicker: $('#launchKicker'),
    launchZh: $('#launchZh'),
    launchStatus: $('#launchStatus'),
    launchFootMeta: $('#launchFootMeta'),
    sleepOverlay: $('#sleepOverlay'),
    sleepTime: $('#sleepTime'),
    sleepDate: $('#sleepDate'),
    toast: $('#toast'),
    toastText: $('#toastText'),
    fullscreenPill: $('#fullscreenPill'),
    themeGrid: $('#themeGrid'),
    themeCountTag: $('#themeCountTag'),
    themeToggle: $('#themeToggle'),
    themeToggleLabel: $('#themeToggleLabel'),
    themeRefresh: $('#themeRefresh'),
    themeFolder: $('#themeFolder'),
    themeCurtain: $('#themeCurtain'),
    themeCurtainName: $('#themeCurtainName'),
    profileVersion: $('#profileVersion'),
    settingsRow: $('#settingsRow'),
    libSort: $('#libSort'),
    settingsPlayerName: $('#settingsPlayerName'),
    settingsSaveName: $('#settingsSaveName'),
    settingsUseSystemName: $('#settingsUseSystemName'),
    settingsOsUser: $('#settingsOsUser'),
    settingsUserTag: $('#settingsUserTag'),
    settingsTrayRow: $('#settingsTrayRow'),
    settingsTraySwitch: $('#settingsTraySwitch'),
    settingsAutoBackupRow: $('#settingsAutoBackupRow'),
    settingsAutoBackupSwitch: $('#settingsAutoBackupSwitch'),
    settingsFullscreenRow: $('#settingsFullscreenRow'),
    settingsExport: $('#settingsExport'),
    settingsImport: $('#settingsImport'),
    settingsCsv: $('#settingsCsv'),
    settingsOpenData: $('#settingsOpenData'),
    settingsOpenBackups: $('#settingsOpenBackups'),
    settingsTier: $('#settingsTier'),
    settingsTierTag: $('#settingsTierTag'),
    settingsSystemStats: $('#settingsSystemStats'),
    settingsSystemNote: $('#settingsSystemNote'),
    settingsDevNote: $('#settingsDevNote'),
    settingsStorageStats: $('#settingsStorageStats'),
    settingsPlayStats: $('#settingsPlayStats'),
    settingsSessions: $('#settingsSessions'),
    settingsSessionTag: $('#settingsSessionTag'),
    settingsVersion: $('#settingsVersion'),
    settingsAvatar: $('#settingsAvatar'),
    settingsAvatarButton: $('#settingsAvatarButton'),
    settingsAvatarImg: $('#settingsAvatarImg'),
    settingsChangeAvatar: $('#settingsChangeAvatar'),
    settingsClearAvatar: $('#settingsClearAvatar'),
    settingsHeroName: $('#settingsHeroName'),
    settingsHeroAccount: $('#settingsHeroAccount'),
    settingsHeroTier: $('#settingsHeroTier'),
    settingsHeroVersion: $('#settingsHeroVersion'),
    settingsFootPath: $('#settingsFootPath'),
    settingsBackupNote: $('#settingsBackupNote'),
    contextMenu: $('#contextMenu'),
    homeView: $('#homeView'),
    layoutBtn: $('#layoutBtn')
  };

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

    const text = options.text ?? (game ? game.logo : 'NOVA');
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
      els.typeRecipeName.textContent = 'NOVA 统一字体';
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
      text: game ? shortName(game) : 'NOVA',
      animate: true
    });
    setLogo(els.editorLogo, null, 'editor-logo', { text: editorLogoText() });
    updateTypeReadout();
    audio.select();
    toast('已换一套字标', 'spark');
  }

  /* ============================================================
     AUDIO
     Two layers: CC0 interface samples (Kenney, bundled locally) and
     a tiny synth fallback so nothing goes silent if a file is missing.
     ============================================================ */

  const SFX = {
    move: 'assets/sfx/move.ogg',
    select: 'assets/sfx/select.ogg',
    click: 'assets/sfx/click.ogg',
    back: 'assets/sfx/back.ogg',
    open: 'assets/sfx/open.ogg',
    close: 'assets/sfx/close.ogg',
    toggle: 'assets/sfx/toggle.ogg',
    switch: 'assets/sfx/switch.ogg',
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

    /** Plays a bundled sample; `gain` trims it to sit under the interface. */
    play(name, options = {}) {
      const ctx = this.ensure();
      if (!ctx) return false;
      const buffer = this.pools.get(name);
      if (!buffer) return false;
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      const offset = options.offset || 0;
      const trim = options.gain ?? 1;
      source.buffer = buffer;
      gain.gain.value = this.volume * trim;
      source.connect(gain).connect(ctx.destination);
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

    move(dir = 1) {
      if (!this.play('move', { gain: .32 })) {
        this.tone(dir > 0 ? 700 : 540, { dur: .065, gain: .0075 });
      }
    },
    hover() {
      if (!this.play('tick', { gain: .18 })) this.tone(880, { dur: .04, gain: .004 });
    },
    select() {
      if (!this.play('select', { gain: .5 })) {
        this.tone(520, { dur: .12, gain: .009, type: 'triangle' });
        this.tone(780, { dur: .18, gain: .0055, delay: .05 });
      }
    },
    back() {
      if (!this.play('back', { gain: .42 })) this.tone(400, { dur: .1, gain: .006 });
    },
    open() {
      if (!this.play('open', { gain: .38 })) this.select();
    },
    close() {
      if (!this.play('close', { gain: .36 })) this.back();
    },
    toggle() {
      if (!this.play('toggle', { gain: .38 })) this.tone(640, { dur: .07, gain: .006 });
    },
    confirm() {
      if (!this.play('confirm', { gain: .5 })) this.select();
    },
    theme() {
      if (!this.play('theme', { gain: .42 })) {
        this.tone(520, { dur: .22, gain: .008, type: 'sine' });
        this.tone(780, { dur: .3, gain: .006, delay: .05 });
      }
    },
    error() {
      if (!this.play('error', { gain: .45 })) {
        this.tone(220, { dur: .16, gain: .01, type: 'triangle' });
      }
    },
    launch() {
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
      if (!this.play('launchFall', { gain: .45 })) this.back();
    },
    sleep() {
      if (!this.play('deep', { gain: .34, offset: .05 })) this.tone(196, { dur: .75, gain: .0045 });
    }
  };

  /* ============================================================
     UTILITIES
     ============================================================ */

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  const findGame = (id) => state.games.find((game) => game.id === id) || null;
  const fullName = (game) => {
    if (!game) return '';
    const zh = (game.zh || '').trim();
    const en = (game.name || '').trim();
    if (!en || zh.toLowerCase() === en.toLowerCase()) return zh || en;
    return [zh, en].filter(Boolean).join(' · ');
  };

  /**
   * Steam imports sometimes store "中文名 English Name" in `zh`.
   * Cards and the dock only want the Chinese head; the English stays
   * available as the secondary line or the hero title.
   */
  const shortName = (game) => {
    if (!game) return '';
    const source = (game.zh || game.name || '').trim();
    if (!source) return '';
    // "沉睡的法则 Things as They Are" → "沉睡的法则"; pure Latin names
    // (Emberwaltz) and pure Chinese names are returned unchanged.
    const head = (source.match(/^[^A-Za-z\u00C0-\u024F]+/) || [''])[0].trim();
    return head || source;
  };
  const currentGame = () => state.games[state.index] || null;
  const clamp01Value = (value) => Math.max(0, Math.min(1, value));

  /**
   * Cover plates are the loading state: the skeleton shimmer stays until
   * the image has decoded, then it cross-fades in. Broken art is marked
   * once so the CSS fallback can take over.
   */
  function markMedia(root = document) {
    $$('img', root).forEach((img) => {
      if (img.dataset.mediaBound) return;
      img.dataset.mediaBound = '1';
      const done = () => img.classList.add('is-loaded');
      if (img.complete && img.naturalWidth) done();
      else img.addEventListener('load', done, { once: true });
      img.addEventListener('error', () => {
        img.classList.add('is-missing');
        img.classList.remove('is-loaded');
      }, { once: true });
    });
  }

  const motionMs = (name, fallback) => (window.NovaMotion ? window.NovaMotion.duration(name) : fallback);

  function toast(message, icon = 'check') {
    if (state.overlay === 'launch' || state.overlay === 'sleep') return;
    const use = els.toast.querySelector('use');
    if (use) use.setAttribute('href', `#i-${icon}`);
    els.toastText.textContent = message;
    els.toast.classList.add('show');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => els.toast.classList.remove('show'), 3000);
  }

  function updateClock() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const weekdayShort = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()];
    const weekdayLong = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][now.getDay()];
    const month = now.getMonth() + 1;
    const day = now.getDate();
    els.clockTime.textContent = `${hh}:${mm}`;
    els.clockDate.textContent = `${month}月${day}日 · ${weekdayShort}`;
    els.sleepTime.textContent = `${hh}:${mm}`;
    els.sleepDate.textContent = `${now.getFullYear()} · ${String(month).padStart(2, '0')} · ${String(day).padStart(2, '0')} · ${weekdayLong}`;
  }

  function formatHours(seconds) {
    if (!seconds) return '0 分钟';
    if (seconds < 60) return '不到 1 分钟';
    const hours = seconds / 3600;
    if (hours < 1) return `${Math.max(1, Math.round(seconds / 60))} 分钟`;
    if (hours < 100) return `${hours.toFixed(1)} 小时`;
    return `${Math.round(hours)} 小时`;
  }

  function formatHoursShort(seconds) {
    if (!seconds || seconds < 60) return '0 小时';
    const hours = seconds / 3600;
    return hours < 1 ? '<1 小时' : `${hours < 100 ? hours.toFixed(1) : Math.round(hours)} 小时`;
  }

  function relativeTime(iso) {
    if (!iso) return '尚未游玩';
    const then = new Date(iso);
    if (Number.isNaN(then.getTime())) return '尚未游玩';
    const diff = Date.now() - then.getTime();
    const minute = 60000;
    const hour = 3600000;
    const day = 86400000;
    if (diff < minute) return '刚刚';
    if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
    if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
    if (diff < day * 7) return `${Math.floor(diff / day)} 天前`;
    return `${then.getMonth() + 1} 月 ${then.getDate()} 日`;
  }

  function restoreFocus() {
    const target = state.lastFocus;
    if (!target || !document.contains(target)) return;
    setTimeout(() => {
      try { target.focus({ preventScroll: true }); } catch (error) {}
    }, 70);
  }

  /** The surface registry owns the shared open/close DOM contract.
      Business state, rendering and audio stay in this file. */
  function openSurface(id, options = {}) {
    if (window.NovaSurfaces) window.NovaSurfaces.open(id, Object.assign({ focus: false }, options));
  }

  function closeSurface(id, options = {}) {
    if (window.NovaSurfaces) window.NovaSurfaces.close(id, Object.assign({ focus: false }, options));
  }

  function setNav(view, options = {}) {
    const buttons = $$('.nav-btn');
    buttons.forEach((button) => {
      const active = button.dataset.nav === view;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-current', active ? 'page' : 'false');
    });
    document.documentElement.dataset.view = view;

    const glide = $('.nav-glide');
    const active = buttons.find((button) => button.dataset.nav === view);
    if (glide && active) {
      const instant = options.instant === true;
      if (instant) {
        glide.classList.add('is-instant');
        requestAnimationFrame(() => requestAnimationFrame(() => glide.classList.remove('is-instant')));
      }
      const nav = active.parentElement;
      glide.style.width = `${active.offsetWidth}px`;
      glide.style.transform = `translateX(${active.offsetLeft - nav.clientLeft}px)`;
    }
  }

  function closePopovers() {
    [els.notifPanel, els.profileMenu].forEach((panel) => {
      panel.classList.remove('is-open');
      panel.setAttribute('aria-hidden', 'true');
    });
    els.notifBtn.setAttribute('aria-expanded', 'false');
    els.profileBtn.setAttribute('aria-expanded', 'false');
  }

  let saveTimer = null;
  function saveSettings() {
    if (!hasBridge) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      call('saveSettings', {
        currentGameId: currentGame()?.id || null,
        sound: state.settings.sound,
        reduceMotion: state.settings.reduceMotion,
        styleMode: state.settings.styleMode,
        typeSeed: state.settings.typeSeed,
        calm: state.settings.calm,
        layout: state.layout,
        closeToTray: state.settings.closeToTray,
        autoBackup: state.settings.autoBackup,
        librarySort: state.settings.librarySort
      });
    }, 180);
  }

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
      ['--accent', '--accent-2', '--glow'].forEach((name) => {
        if (tokens[name]) root.style.setProperty(name, tokens[name]);
        else root.style.removeProperty(name);
      });
      root.style.setProperty('--scrim-rgb', game?.scrim || '10, 10, 8');
      return;
    }

    if (!game) {
      root.style.setProperty('--accent', system ? '#e7dcc9' : '#ffb45e');
      root.style.setProperty('--accent-2', system ? '#c7b79d' : '#ff6b79');
      root.style.setProperty('--glow', system ? 'rgba(231, 220, 201, .16)' : 'rgba(255, 172, 96, .32)');
      root.style.setProperty('--scrim-rgb', '16, 12, 10');
      return;
    }
    root.style.setProperty('--accent', system ? '#e7dcc9' : game.accent);
    root.style.setProperty('--accent-2', system ? '#c7b79d' : game.accent2);
    root.style.setProperty('--glow', system ? 'rgba(231, 220, 201, .16)' : game.glow);
    root.style.setProperty('--scrim-rgb', game.scrim || '16, 12, 10');
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
  function applyCtaVars(element, game) {
    if (!element) return;
    // A theme owns its button language; the cover palette must not repaint it.
    if (document.documentElement.classList.contains('theme-custom')) {
      ['--cta-a', '--cta-b', '--cta-a-hover', '--cta-b-hover', '--cta-fg', '--cta-border', '--cta-glow']
        .forEach((name) => element.style.removeProperty(name));
      return;
    }
    if (!game) {
      element.style.removeProperty('--cta-a');
      element.style.removeProperty('--cta-b');
      return;
    }
    const a = game.accent || '#ffd88a';
    const b = game.accent2 || a;
    const lightA = lighten(a, .28);
    const lightB = lighten(b, .22);
    const { r, g, b: blue } = parseHex(mixHex(a, b, .35));
    const luma = (.2126 * r + .7152 * g + .0722 * blue) / 255;
    const fg = luma > .62 ? '#161008' : '#fff8ee';
    const border = luma > .62 ? `rgba(20, 14, 10, .18)` : `rgba(255, 250, 240, .42)`;
    element.style.setProperty('--cta-a', lighten(a, .36));
    element.style.setProperty('--cta-b', lighten(b, .16));
    element.style.setProperty('--cta-a-hover', lighten(a, .48));
    element.style.setProperty('--cta-b-hover', lighten(b, .28));
    element.style.setProperty('--cta-fg', fg);
    element.style.setProperty('--cta-border', border);
    element.style.setProperty('--cta-glow', `rgba(${r}, ${g}, ${blue}, .55)`);
  }

  function updatePrimaryButton(button, labelElement, game) {
    if (!button) return;
    const info = actionInfo(game);
    const use = button.querySelector('use');
    if (use) use.setAttribute('href', `#i-${info.icon}`);
    button.disabled = info.disabled;
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
    if (url) root.style.setProperty('--nova-hero', `url("${String(url).replace(/"/g, '%22')}")`);
    else root.style.removeProperty('--nova-hero');
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

  /* ============================================================
     HERO
     ============================================================ */

  function progressInfo(game) {
    if (!game) {
      return { pct: 0, pctText: '—', title: '没有游戏', sub: '按 A 导入或添加', icon: 'clock' };
    }
    if (state.running.has(game.id)) {
      const session = state.running.get(game.id);
      const started = new Date(session.startedUtc).getTime();
      const minutes = Math.max(0, Math.floor((Date.now() - started) / 60000));
      return {
        pct: 100,
        pctText: '运行中',
        title: '正在运行',
        sub: minutes < 1 ? '刚刚启动' : `已运行 ${minutes} 分钟`,
        icon: 'stop'
      };
    }
    if (!game.exists) {
      return { pct: 0, pctText: '缺失', title: '找不到游戏程序', sub: '在管理面板中重新指定路径', icon: 'alert' };
    }
    const total = game.playtimeSeconds || 0;
    const pct = Math.min(100, Math.round((total / (60 * 60 * 40)) * 100));
    return {
      pct,
      pctText: formatHoursShort(total),
      title: game.lastPlayedUtc ? `上次游玩 ${relativeTime(game.lastPlayedUtc)}` : '还没玩过',
      sub: game.playtimeSeconds ? `累计 ${formatHours(game.playtimeSeconds)}` : '启动后开始计时',
      icon: 'clock'
    };
  }

  function heroStatus(game) {
    if (!game) {
      return { label: '开始', dim: '还没有游戏' };
    }
    if (state.running.has(game.id)) {
      return { label: '运行中', dim: '游戏已启动' };
    }
    if (!game.exists) {
      return { label: '找不到程序', dim: '文件被移动或删除' };
    }
    if (game.lastPlayedUtc) {
      return { label: '继续', dim: `上次游玩 ${relativeTime(game.lastPlayedUtc)}` };
    }
    return { label: '就绪', dim: game.source === 'steam' ? 'Steam 库' : '本机' };
  }

  function metaHTML(game) {
    if (!game) return '<span>动作</span><i class="meta-dot"></i><span>冒险</span><i class="meta-dot"></i><span class="age-badge">全年龄</span>';
    const bits = [];
    const genres = (game.genres && game.genres.length ? game.genres : [game.genre || '游戏'])
      .filter((genre) => genre && !(game.source === 'steam' && genre.toLowerCase() === 'steam'));
    genres.forEach((genre) => bits.push(`<span>${esc(genre)}</span>`));
    bits.push(`<span class="age-badge">${esc(game.ageRating || '全年龄')}</span>`);
    if (game.mode) bits.push(`<span>${esc(game.mode)}</span>`);
    if (game.source === 'steam') bits.push('<span class="update-badge">STEAM</span>');
    return bits.join('<i class="meta-dot"></i>');
  }

  // Position of the selected entry in the library — themes that print a
  // record number need it, and only this module knows the ordering.
  function recordIndexFor(game) {
    if (!game || !state.games.length) return 0;
    const at = state.games.findIndex((entry) => entry.id === game.id);
    return at < 0 ? 0 : at + 1;
  }

  function renderHero(game, animate = true) {
    const status = heroStatus(game);
    const logoText = game ? (game.logo || game.name || '') : 'NOVA';
    document.body.classList.toggle('is-long-logo', logoText.length > 18);
    setLogo(els.gameLogo, game, 'hero-logo');
    if (window.NovaRecord) {
      window.NovaRecord.publish(game, { index: recordIndexFor(game), total: state.games.length });
    }
    els.kickerLabel.textContent = status.label;
    els.kickerDim.textContent = status.dim;
    els.gameTagline.textContent = game ? (game.tagline || '') : '选择游戏开始。';
    els.metaRow.innerHTML = metaHTML(game);

    updatePrimaryButton(els.playBtn, els.playLabel, game);
    if (els.detailPlay) updatePrimaryButton(els.detailPlay, els.detailPlayLabel, game);

    const info = progressInfo(game);
    els.progressLabel.textContent = info.title;
    els.progressPct.textContent = info.pctText;
    els.progressFill.style.width = `${info.pct}%`;
    const subUse = els.progressSubIcon.querySelector('use');
    if (subUse) subUse.setAttribute('href', `#i-${info.icon}`);
    els.progressSub.textContent = info.sub;

    renderActivity(game, info);

    if (animate) {
      els.heroInner.classList.remove('swap');
      void els.heroInner.offsetWidth;
      els.heroInner.classList.add('swap');
    }
  }

  function renderActivity(game, info) {
    const strip = els.questCard;
    strip.classList.remove('is-cloud');
    if (!game) {
      els.questKicker.textContent = '导入';
      els.questTitle.textContent = '导入本机游戏';
      els.questDesc.textContent = 'Steam 库与开始菜单';
      els.questPct.textContent = '0';
      els.questMeta.textContent = '已发现候选';
      els.questFill.style.width = '0%';
      return;
    }
    if (state.running.has(game.id)) {
      const session = state.running.get(game.id);
      const started = new Date(session.startedUtc).getTime();
      const minutes = Math.max(0, Math.floor((Date.now() - started) / 60000));
      els.questKicker.textContent = '运行中';
      els.questTitle.textContent = `正在游玩 ${shortName(game)}`;
      els.questDesc.textContent = '打开游戏管理可以结束进程';
      els.questPct.textContent = minutes < 1 ? '刚刚' : `${minutes} 分钟`;
      els.questMeta.textContent = '计时中';
      els.questFill.style.width = '100%';
      return;
    }
    els.questKicker.textContent = game.source === 'steam' ? 'Steam 游戏库' : '游戏';
    const genres = (game.genres && game.genres.length ? game.genres.join(' · ') : game.genre) || '游戏';
    els.questTitle.textContent = game.name || game.zh || '游戏';
    if (!game.exists) {
      els.questDesc.textContent = '找不到程序 · 请在管理里重新指定';
    } else {
      els.questDesc.textContent = `${genres} · ${game.mode || '单人'}`;
    }
    els.questDesc.title = game.exePath || '';
    els.questPct.textContent = formatHoursShort(game.playtimeSeconds);
    els.questMeta.textContent = game.exists ? (game.lastPlayedUtc ? relativeTime(game.lastPlayedUtc) : '尚未游玩') : '程序缺失';
    els.questFill.style.width = `${Math.min(100, Math.round(((game.playtimeSeconds || 0) / 3600 / 40) * 100))}%`;
  }

  /* ============================================================
     SELECTION
     ============================================================ */

  function selectGame(index, options = {}) {
    if (!state.games.length) {
      renderHero(null, false);
      return;
    }
    const wrapped = ((index % state.games.length) + state.games.length) % state.games.length;
    const previous = state.index;

    if (wrapped === previous) {
      if (options.scroll) centerTile(wrapped);
      if (options.sound) audio.select();
      if (state.view === 'appearance') renderAppearance();
      return;
    }

    state.index = wrapped;
    const game = state.games[wrapped];

    applyAccent(game);
    if (!options.initial) setBackdrop(game);
    renderHero(game, options.animate !== false);
    updateRail();
    document.title = `${game.zh || game.name} · NOVA 游戏空间`;

    if (options.scroll) centerTile(wrapped);
    if (options.sound) audio.move(wrapped > previous ? 1 : -1);

    if (state.overlay === 'details') populateDetails(game);
    if (state.view === 'appearance') renderAppearance();
    if (!state.overlay) setNav(state.view);
    // Persistent CTAs (editor / scanner / pickers) must follow the new
    // game's palette too, not only the hero button.
    applyStyleModeUI();
    saveSettings();
  }

  function chooseGameById(id, options = {}) {
    const index = state.games.findIndex((game) => game.id === id);
    if (index < 0) return;
    selectGame(index, { sound: true, scroll: true, ...options });
  }

  /* ============================================================
     RAIL
     ============================================================ */

  function buildRail() {
    els.rail.innerHTML = state.games.map((game, index) => `
      <button class="tile" data-index="${index}" aria-label="${esc(fullName(game))}" aria-current="false">
        <div class="tile-art">
          <img src="${esc(game.coverUrl)}" alt="" loading="eager" draggable="false" style="object-position:${esc(game.coverPosition)}">
          <div class="tile-badges"></div>
          <div class="tile-progress"><i></i></div>
        </div>
        <div class="tile-label">
          <span class="tile-name">${esc(shortName(game))}</span>
          <span class="tile-sub"></span>
        </div>
      </button>
    `).join('');

    markMedia(els.rail);

    const empty = state.games.length === 0;
    els.rail.style.display = empty ? 'none' : '';
    els.railEmpty.hidden = !empty;
    els.dockCount.textContent = `${state.games.length} 款`;
  }

  function updateRail() {
    const tiles = els.rail.children;
    state.games.forEach((game, index) => {
      const tile = tiles[index];
      if (!tile) return;
      const active = index === state.index;
      tile.classList.toggle('is-active', active);
      tile.setAttribute('aria-current', active ? 'true' : 'false');

      let badge = '';
      if (state.running.has(game.id)) badge = '<span class="tile-badge live">运行中</span>';
      else if (!game.exists) badge = '<span class="tile-badge offline">程序缺失</span>';
      else if (game.source === 'steam') badge = '<span class="tile-badge">STEAM</span>';
      const badges = $('.tile-badges', tile);
      if (badges) badges.innerHTML = badge;

      const progress = $('.tile-progress', tile);
      if (progress) {
        const pct = state.running.has(game.id) ? 100 : Math.min(100, Math.round(((game.playtimeSeconds || 0) / 3600 / 40) * 100));
        progress.style.display = game.exists ? '' : 'none';
        const fill = $('i', progress);
        if (fill) fill.style.width = `${pct}%`;
      }

      const sub = $('.tile-sub', tile);
      if (sub) sub.textContent = state.running.has(game.id) ? '运行中' : formatHoursShort(game.playtimeSeconds);
    });
  }

  function centerTile(index) {
    const tile = els.rail.children[index];
    if (!tile) return;
    const railRect = els.rail.getBoundingClientRect();
    const tileRect = tile.getBoundingClientRect();
    const delta = (tileRect.left + tileRect.width / 2) - (railRect.left + railRect.width / 2);
    els.rail.scrollBy({ left: delta, behavior: state.settings.reduceMotion ? 'auto' : 'smooth' });
  }

  function ensureActiveTileVisible() {
    const tile = els.rail.children[state.index];
    if (!tile) return;
    const railRect = els.rail.getBoundingClientRect();
    const tileRect = tile.getBoundingClientRect();
    const margin = 8;
    if (tileRect.left < railRect.left + margin) {
      els.rail.scrollBy({ left: tileRect.left - railRect.left - margin, behavior: 'auto' });
    } else if (tileRect.right > railRect.right - margin) {
      els.rail.scrollBy({ left: tileRect.right - railRect.right + margin, behavior: 'auto' });
    }
  }

  /* ============================================================
     VIEWS
     Home, library and appearance share the content area. Switching
     only cross-fades that area, so the shell never feels rebuilt.
     ============================================================ */

  const VIEW_IDS = { home: 'homeView', library: 'libraryOverlay', appearance: 'appearanceOverlay', settings: 'settingsView' };

  function viewElement(name) {
    return document.getElementById(VIEW_IDS[name]);
  }

  function setView(name, options = {}) {
    if (name === state.view && !options.force) return;
    const previous = state.view;
    state.view = name;

    Object.keys(VIEW_IDS).forEach((key) => {
      const el = viewElement(key);
      if (!el) return;
      const current = key === name;
      el.classList.toggle('is-current', current);
      el.classList.toggle('is-leaving', false);
      el.setAttribute('aria-hidden', current ? 'false' : 'true');
    });

    setNav(name);
    document.documentElement.dataset.view = name;
    scrollViewToTop(name);

    if (name === 'library') renderLibrary();
    if (name === 'appearance') {
      renderAppearance();
      syncAppearanceChips();
      requestAnimationFrame(updateAppearanceScrollState);
      setTimeout(refitLogos, 120);
    }
    if (name === 'settings') {
      renderSettings();
      refreshSettingsData();
      setTimeout(refitLogos, 120);
    }

    if (previous !== name) {
      if (name === 'home') audio.back();
      else audio.open();
    }
  }

  function scrollViewToTop(name) {
    const el = viewElement(name);
    if (!el) return;
    const scroller = $('.lib-shell', el) || $('.appearance-options', el);
    if (scroller) scroller.scrollTop = 0;
  }

  /* ============================================================
     LAYOUT MODE
     row  : the classic bottom rail
     rail : vertical cover column on the left, game on the right
     ============================================================ */

  function applyLayout(mode, options = {}) {
    const next = mode === 'rail' ? 'rail' : 'row';
    state.layout = next;
    document.body.classList.toggle('layout-rail', next === 'rail');
    document.documentElement.dataset.layout = next;
    if (els.layoutBtn) {
      els.layoutBtn.setAttribute('aria-pressed', String(next === 'rail'));
      els.layoutBtn.title = next === 'rail' ? '切换为横排' : '切换为竖排';
      const use = els.layoutBtn.querySelector('use');
      if (use) use.setAttribute('href', next === 'rail' ? '#i-layout-row' : '#i-layout-rail');
    }
    if (!options.silent) {
      saveSettings();
      toast(next === 'rail' ? '已切换为竖排' : '已切换为横排', 'check');
    }
  }

  function toggleLayout() {
    applyLayout(state.layout === 'rail' ? 'row' : 'rail');
  }

  /* ============================================================
     LIBRARY
     ============================================================ */

  function filterGames() {
    const query = state.libQuery.trim().toLowerCase();
    return state.games.filter((game) => {
      if (state.libFilter === 'recent' && !game.lastPlayedUtc) return false;
      if (state.libFilter === 'favorite' && !game.favorite) return false;
      if (state.libFilter === 'steam' && game.source !== 'steam') return false;
      if (state.libFilter === 'missing' && game.exists) return false;
      if (query) {
        const haystack = `${game.zh} ${game.name} ${(game.genres || []).join(' ')} ${game.genre || ''}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }

  function renderLibrary() {
    const totalSeconds = state.games.reduce((sum, game) => sum + (game.playtimeSeconds || 0), 0);
    const favorites = state.games.filter((game) => game.favorite).length;
    const steamCount = state.games.filter((game) => game.source === 'steam').length;
    const missingCount = state.games.filter((game) => !game.exists).length;

    els.libStats.innerHTML = `
      <span><b>${state.games.length}</b> 款游戏</span>
      <span class="lib-sep"></span>
      <span>累计 <b>${formatHoursShort(totalSeconds)}</b></span>
      <span class="lib-sep"></span>
      <span><b>${steamCount}</b> 款来自 Steam</span>
      <span class="lib-sep"></span>
      <span><b>${favorites}</b> 款收藏</span>
      ${missingCount ? `<span class="lib-sep"></span><span><b>${missingCount}</b> 款程序缺失</span>` : ''}
    `;

    $$('.filter', els.libFilters).forEach((button) => {
      button.classList.toggle('is-active', button.dataset.filter === state.libFilter);
    });
    if (els.libSort) els.libSort.value = state.settings.librarySort || 'recent';

    const list = filterGames();
    const sort = state.settings.librarySort || 'recent';
    const byRecent = (a, b) => {
      const at = a.lastPlayedUtc ? new Date(a.lastPlayedUtc).getTime() : 0;
      const bt = b.lastPlayedUtc ? new Date(b.lastPlayedUtc).getTime() : 0;
      return bt - at;
    };
    if (sort === 'name') {
      list.sort((a, b) => String(a.zh || a.name || '').localeCompare(String(b.zh || b.name || ''), 'zh-Hans-CN'));
    } else if (sort === 'playtime') {
      list.sort((a, b) => (b.playtimeSeconds || 0) - (a.playtimeSeconds || 0));
    } else if (sort === 'added') {
      list.sort((a, b) => String(b.addedUtc || '').localeCompare(String(a.addedUtc || '')));
    } else if (sort === 'launches') {
      list.sort((a, b) => (b.launchCount || 0) - (a.launchCount || 0));
    } else {
      list.sort(byRecent);
    }
    if (state.games.length === 0) {
      els.libGrid.style.display = 'none';
      els.libEmpty.hidden = false;
      els.libEmptyTitle.textContent = '游戏库还是空的';
      els.libEmptyText.textContent = '添加一个游戏程序，或先从 Steam 库导入。';
      els.clearFilters.textContent = '添加游戏';
      return;
    }

    const current = currentGame();
    const featuredId = current && list.some((game) => game.id === current.id) ? current.id : null;

    els.libEmpty.hidden = list.length !== 0;
    els.libGrid.style.display = list.length ? '' : 'none';
    els.clearFilters.textContent = '清除筛选';

    els.libGrid.innerHTML = list.map((game, index) => {
      const featured = game.id === featuredId;
      const badges = [];
      if (featured) badges.push('<span class="lib-current">CURRENT</span>');
      if (state.running.has(game.id)) badges.push('<span class="lib-badge live">运行中</span>');
      else if (!game.exists) badges.push('<span class="tile-badge offline">程序缺失</span>');
      else if (game.source === 'steam') badges.push('<span class="tile-badge">STEAM</span>');
      const pct = Math.min(100, Math.round(((game.playtimeSeconds || 0) / 3600 / 40) * 100));
      const displayName = shortName(game);
      const showLatin = !!game.name
        && displayName.trim().toLowerCase() !== game.name.trim().toLowerCase()
        && displayName.trim().length <= 10;
      // A very long Latin subtitle would be clipped by the card width.
      // Hide the redundant subtitle instead of truncating it.
      const longName = (displayName.length + (game.name || '').length) > 22
        || (game.name || '').length > 16;

      return `
        <button class="lib-card${featured ? ' is-featured' : ''}${longName ? ' is-long-name' : ''}" data-game="${game.id}" style="animation-delay:${Math.min(index * 34, 240)}ms" aria-label="${esc(game.zh || game.name)}">
          <div class="lib-art">
            <img src="${esc(game.coverUrl)}" alt="" loading="lazy" draggable="false" style="object-position:${esc(game.coverPosition)}">
            <div class="lib-badges">${badges.join('')}</div>
            <span class="lib-open" aria-hidden="true"><svg class="ic"><use href="#i-arrow-up-right"/></svg></span>
            ${game.exists ? `<div class="lib-progress"><i style="width:${pct}%"></i></div>` : ''}
          </div>
          <div class="lib-info">
            <div class="lib-name-row">
              <span class="lib-name${showLatin ? '' : ' is-solo'}">${esc(displayName)}</span>
              ${showLatin ? `<span class="lib-en">${esc(game.name)}</span>` : ''}
              ${game.favorite ? '<svg class="lib-fav" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-heart"/></svg>' : ''}
            </div>
            <div class="lib-sub">${esc((game.genres && game.genres[0]) || game.genre || '游戏')} · ${state.running.has(game.id) ? '运行中' : formatHoursShort(game.playtimeSeconds)}</div>
          </div>
        </button>
      `;
    }).join('');

    markMedia(els.libGrid);
  }

  function openLibrary(options = {}) {
    if (state.overlay) return;
    closePopovers();
    state.libPadIndex = 0;

    if (options.search) {
      state.libFilter = 'all';
      state.libQuery = '';
      els.libSearch.value = '';
    } else {
      els.libSearch.value = state.libQuery;
    }

    setView('library');

    if (options.search) {
      setTimeout(() => {
        try { els.libSearch.focus({ preventScroll: true }); } catch (error) {}
      }, 120);
    }
  }

  function closeLibrary(options = {}) {
    if (state.view !== 'library') return;
    setView('home');
  }

  /* ============================================================
     DETAILS
     ============================================================ */

  function updateDetailStatus(game) {
    els.detailStatus.classList.remove('is-update', 'is-offline');
    if (!game) {
      els.detailStatusText.textContent = '没有游戏';
      els.detailStatus.classList.add('is-offline');
      return;
    }
    if (state.running.has(game.id)) {
      els.detailStatusText.textContent = '运行中';
      els.detailStatus.classList.add('is-update');
    } else if (!game.exists) {
      els.detailStatusText.textContent = '程序缺失';
      els.detailStatus.classList.add('is-offline');
    } else {
      els.detailStatusText.textContent = '已就绪';
    }
  }

  function updateDetailProgress(game) {
    const info = progressInfo(game);
    els.dProgressLabel.textContent = info.title;
    els.dProgressPct.textContent = info.pctText;
    els.dProgressFill.style.width = `${info.pct}%`;
    // The stat grid below already reports totals; keep this line operational.
    els.dProgressSub.textContent = state.running.has(game.id)
      ? '游戏运行中'
      : game.exists ? '可随时启动' : '需要在管理里重新指定程序';
  }

  function populateDetails(game) {
    const oldImage = $('img.detail-art-img', els.detailArt);
    if (oldImage) oldImage.remove();

    if (!game) {
      els.detailArt.style.setProperty('--detail-bg', 'url("assets/backdrop.jpg")');
      setLogo(els.detailLogo, null, 'detail-logo');
      els.detailZh.textContent = 'NOVA';
      els.detailTitle.textContent = '还没有游戏';
      els.detailTagline.textContent = '添加一个游戏程序开始使用。';
      els.detailMeta.innerHTML = metaHTML(null);
      els.detailDesc.textContent = '';
      els.detailStats.innerHTML = '';
      els.detailPath.textContent = '—';
      updateDetailStatus(null);
      return;
    }

    els.detailArt.style.setProperty('--detail-bg', `url("${game.heroUrl}")`);
    const image = document.createElement('img');
    image.className = 'detail-art-img';
    image.alt = `${game.zh || game.name} 主视觉`;
    image.src = game.heroUrl;
    applyHeroFraming(image, framingFor(game));
    image.draggable = false;
    els.detailArt.insertBefore(image, els.detailArt.firstChild);

    setLogo(els.detailLogo, game, 'detail-logo');
    els.detailZh.textContent = fullName(game) || game.name;
    els.detailTitle.textContent = game.zh || game.name;
    els.detailTagline.textContent = game.tagline || '';
    els.detailMeta.innerHTML = metaHTML(game);
    els.detailDesc.textContent = game.description || '';

    els.detailStats.innerHTML = [
      ['累计游玩', game.playtimeSeconds ? formatHours(game.playtimeSeconds) : '还没玩过'],
      ['最近游玩', game.lastPlayedUtc ? relativeTime(game.lastPlayedUtc) : '尚未游玩'],
      ['启动次数', `${game.launchCount || 0} 次`],
      ['来源', game.source === 'steam' ? 'Steam 库' : '手动添加']
    ].map(([label, value]) => `
      <div class="stat">
        <div class="stat-label">${esc(label)}</div>
        <div class="stat-value">${esc(value)}</div>
      </div>
    `).join('');

    els.detailPath.textContent = game.exePath || '（未设置）';
    els.detailPath.title = game.exePath || '';
    els.revealBtn.hidden = !game.exists;

    els.detailFav.classList.toggle('active', !!game.favorite);
    els.detailFav.setAttribute('aria-pressed', String(!!game.favorite));

    updatePrimaryButton(els.detailPlay, els.detailPlayLabel, game);
    updateDetailStatus(game);
    updateDetailProgress(game);

    closeManage({ silent: true });
    els.detailManageLabel.textContent = '管理';
    els.detailManage.setAttribute('aria-expanded', 'false');

    const dialog = $('.detail-modal', els.detailsOverlay);
    if (dialog) dialog.setAttribute('aria-label', `${game.zh || game.name} · 游戏详情`);
  }

  function openDetails() {
    if (state.overlay) return;
    if (!state.games.length) {
      openEditor();
      return;
    }
    state.lastFocus = document.activeElement;
    closePopovers();
    populateDetails(currentGame());
    state.overlay = 'details';
    openSurface('details');
    setNav(state.view);
    audio.select();
    setTimeout(() => {
      try { els.detailsClose.focus({ preventScroll: true }); } catch (error) {}
    }, 90);
    setTimeout(refitLogos, 140);
  }

  function closeDetails(options = {}) {
    if (state.overlay !== 'details') return;
    const { focus = true, sound = true } = options;
    closeManage({ silent: true });
    closeSurface('details');
    state.overlay = null;
    if (sound) audio.close();
    if (focus) restoreFocus();
  }

  async function toggleFavorite(game) {
    if (!game) return;
    const result = await call('setFavorite', { id: game.id });
    if (result && result.ok) {
      game.favorite = result.favorite;
    } else {
      game.favorite = !game.favorite;
    }
    els.detailFav.classList.toggle('active', game.favorite);
    els.detailFav.setAttribute('aria-pressed', String(game.favorite));
    audio.select();
    toast(game.favorite ? `已收藏《${shortName(game)}》` : `已取消收藏《${shortName(game)}》`, 'heart');
    if (state.view === 'library') renderLibrary();
    updateRail();
  }

  /* ============================================================
     MANAGE
     ============================================================ */

  function fillManage() {
    const game = currentGame();
    if (!game) return;
    els.manageStats.innerHTML = [
      ['运行时程序', game.exePath ? (game.exePath.length > 34 ? `…${game.exePath.slice(-33)}` : game.exePath) : '未设置'],
      ['启动参数', game.args || '无'],
      ['工作目录', game.workDir || '与程序相同'],
      ['版本 / 来源', game.source === 'steam' ? `Steam · App ${game.steamAppId || '—'}` : '手动添加']
    ].map(([label, value]) => `<div class="manage-stat"><span>${esc(label)}</span><b title="${esc(value)}">${esc(value)}</b></div>`).join('');

    els.resetArtRow.hidden = !game.exists;
    resetRemoveConfirm();
  }

  function openManage() {
    if (state.overlay !== 'details' || state.manageOpen) return;
    state.manageOpen = true;
    els.detailsOverlay.classList.add('is-managing');
    els.managePanel.hidden = false;
    els.detailManageLabel.textContent = '收起';
    els.detailManage.setAttribute('aria-expanded', 'true');
    fillManage();
    audio.select();
    setTimeout(() => {
      try { els.managePanel.scrollIntoView({ behavior: state.settings.reduceMotion ? 'auto' : 'smooth', block: 'nearest' }); } catch (error) {}
    }, 40);
  }

  function closeManage(options = {}) {
    if (!state.manageOpen) {
      if (!options.silent) return;
      els.detailsOverlay.classList.remove('is-managing');
      els.managePanel.hidden = true;
      els.detailManageLabel.textContent = '管理';
      els.detailManage.setAttribute('aria-expanded', 'false');
      return;
    }
    state.manageOpen = false;
    resetRemoveConfirm();
    els.detailsOverlay.classList.remove('is-managing');
    els.managePanel.hidden = true;
    els.detailManageLabel.textContent = '管理';
    els.detailManage.setAttribute('aria-expanded', 'false');
    if (!options.silent) audio.back();
  }

  function resetRemoveConfirm() {
    state.removeArmed = false;
    clearTimeout(state.removeTimer);
    els.removeGameBtn.classList.remove('is-confirming');
    els.removeGameBtn.textContent = '从游戏库移除';
  }

  async function handleRemoveGame() {
    const game = currentGame();
    if (!game) return;
    if (!state.removeArmed) {
      state.removeArmed = true;
      els.removeGameBtn.textContent = '再次点击确认移除';
      els.removeGameBtn.classList.add('is-confirming');
      clearTimeout(state.removeTimer);
      state.removeTimer = setTimeout(resetRemoveConfirm, 3200);
      return;
    }
    const result = await call('deleteGame', { id: game.id });
    if (!result || !result.ok) {
      toast(result?.error || '移除失败', 'alert');
      return;
    }
    const index = state.games.findIndex((entry) => entry.id === game.id);
    if (index >= 0) state.games.splice(index, 1);
    state.running.delete(game.id);
    if (state.index >= state.games.length) state.index = Math.max(0, state.games.length - 1);
    closeDetails({ focus: false, sound: false });
    rebuildAfterLibraryChange();
    audio.select();
    toast(`已从游戏库移除《${shortName(game)}》`, 'check');
  }

  async function resetArtwork() {
    const game = currentGame();
    if (!game) return;
    toast('正在从程序图标重新生成封面…', 'image');
    const result = await call('updateGame', { id: game.id, resetArt: true });
    if (!result || !result.ok) {
      toast(result?.error || '重新生成失败', 'alert');
      return;
    }
    Object.assign(game, result.game);
    populateDetails(game);
    rebuildAfterLibraryChange(false);
    applyAccent(game);
    renderHero(game, false);
    audio.select();
    toast('封面已重新生成', 'image');
  }

  /* ============================================================
     APPEARANCE STUDIO
     ============================================================ */

  function buildAppearanceSwitcher() {
    els.appearanceSwitcher.innerHTML = state.games.map((game, index) => `
      <button class="game-chip" data-index="${index}" aria-label="预览 ${esc(game.zh || game.name)}">
        <img src="${esc(game.coverUrl)}" alt="" loading="lazy" draggable="false" style="object-position:${esc(game.coverPosition)}">
      </button>
    `).join('');
    els.appearanceSwitcher.hidden = state.games.length === 0;
  }

  function syncAppearanceChips() {
    $$('.game-chip', els.appearanceSwitcher).forEach((chip) => {
      const active = Number(chip.dataset.index) === state.index;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-current', active ? 'true' : 'false');
    });
    if (state.view !== 'appearance') return;
    const chip = $('.game-chip.is-active', els.appearanceSwitcher);
    if (!chip) return;
    const switcherRect = els.appearanceSwitcher.getBoundingClientRect();
    const chipRect = chip.getBoundingClientRect();
    const delta = (chipRect.left + chipRect.width / 2) - (switcherRect.left + switcherRect.width / 2);
    els.appearanceSwitcher.scrollBy({ left: delta, behavior: state.settings.reduceMotion ? 'auto' : 'smooth' });
  }

  function applyStyleModeUI() {
    const game = currentGame();
    const adaptive = state.settings.styleMode === 'adaptive';
    document.documentElement.classList.toggle('is-nova-system', !adaptive);
    applyAccent(game);

    setElementCta(els.playBtn, adaptive ? 'cta-adaptive' : 'cta-system', game);
    setElementCta(els.detailPlay, adaptive ? 'cta-adaptive' : 'cta-system', game);
    setElementCta(els.appearanceCta, adaptive ? 'cta-adaptive' : 'cta-system', game);
    setElementCta(els.adaptivePreviewCta, 'cta-adaptive', game, true);
    setElementCta(els.systemPreviewCta, 'cta-system', game);
    setElementCta(els.editorSave, adaptive ? 'cta-adaptive' : 'cta-system', game);
    setElementCta(els.scannerImport, adaptive ? 'cta-adaptive' : 'cta-system', game);

    setLogo(els.gameLogo, game, 'hero-logo');
    setLogo(els.detailLogo, game, 'detail-logo');
    setLogo(els.appearanceLogo, game, 'appearance-logo');
    setLogo(els.launchLogo, game, 'launch-logo');
    const choiceText = game ? shortName(game) : 'NOVA';
    setLogo(els.adaptiveChoiceLogo, game, 'choice-logo', { forceMode: 'adaptive', text: choiceText });
    setLogo(els.systemChoiceLogo, game, 'choice-logo', { forceMode: 'system', text: choiceText });

    const action = actionInfo(game);
    if (els.appearanceCtaLabel) els.appearanceCtaLabel.textContent = action.label;
    const use = els.appearanceCta ? $('use', els.appearanceCta) : null;
    if (use) use.setAttribute('href', `#i-${action.icon}`);

    if (els.appearanceCtaNote) els.appearanceCtaNote.textContent = adaptive ? '跟随封面' : 'NOVA 默认';
    if (els.appearanceModeLabel) els.appearanceModeLabel.textContent = adaptive ? '跟随封面' : 'NOVA 默认';
    if (els.styleModeTag) els.styleModeTag.textContent = adaptive ? '跟随封面' : 'NOVA 默认';

    $$('.style-choice', els.styleChoices).forEach((button) => {
      const active = button.dataset.style === state.settings.styleMode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    updateTypeReadout();
    if (state.view === 'appearance') requestAnimationFrame(updateAppearanceScrollState);
  }

  function setStyleMode(mode, options = {}) {
    if (mode !== 'adaptive' && mode !== 'system') return;
    if (state.settings.styleMode === mode && !options.force) return;
    state.settings.styleMode = mode;
    saveSettings();
    applyStyleModeUI();
    audio.select();
    if (!options.silent) toast(mode === 'adaptive' ? '外观语言 · 跟随封面' : '外观语言 · NOVA 编辑系统', 'spark');
  }

  function renderAppearance() {
    const game = currentGame();
    const heroSrc = game ? game.heroUrl : 'assets/backdrop.jpg';
    els.appearanceBg.src = heroSrc;
    els.appearanceImage.src = heroSrc;
    const framing = framingFor(game);
    applyHeroFraming(els.appearanceBg, framing);
    applyHeroFraming(els.appearanceImage, framing);
    els.appearanceImage.alt = game ? `${game.zh || game.name} 主视觉` : 'NOVA';

    setLogo(els.appearanceLogo, game, 'appearance-logo');
    els.appearanceTagline.textContent = game ? (game.tagline || '') : '选择游戏开始。';
    els.appearanceIndex.textContent = game ? `${String(state.index + 1).padStart(2, '0')} / ${String(state.games.length).padStart(2, '0')}` : '00 / 00';
    els.appearanceGameName.textContent = game ? shortName(game) : 'NOVA';

    els.appearanceProgressFill.style.width = `${game ? Math.min(100, Math.round(((game.playtimeSeconds || 0) / 3600 / 40) * 100)) : 0}%`;
    els.appearanceProgressPct.textContent = game ? formatHoursShort(game.playtimeSeconds) : '0 小时';

    const colors = game && game.colors && game.colors.length ? game.colors : ['#ffb45e', '#ff6b79', '#f3e3c3', '#251318'];
    els.appearancePalette.innerHTML = colors.map((color) => `
      <span class="swatch"><i style="background:${esc(color)}"></i><em>${esc(String(color).toUpperCase())}</em></span>
    `).join('');

    els.appearanceDataPath.textContent = state.dataFolder || '';
    els.appearanceDataPath.title = state.dataFolder || '';
    syncAppearanceChips();
    syncSoundUI();
    syncMotionUI();
    renderThemes();
    applyStyleModeUI();
  }

  function updateAppearanceScrollState() {
    if (!els.appearanceOptions) return;
    const el = els.appearanceOptions;
    const scrollable = el.scrollHeight > el.clientHeight + 4;
    el.classList.toggle('is-scrollable', scrollable);
    el.classList.toggle('is-at-end', !scrollable || el.scrollTop + el.clientHeight >= el.scrollHeight - 10);
  }

  /* ============================================================
     SETTINGS · local identity, offline data, play history
     ============================================================ */

  function formatBytes(bytes) {
    const value = Number(bytes) || 0;
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
    return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  function formatSessionTime(iso) {
    if (!iso) return '—';
    const date = new Date(iso);
    if (!Number.isFinite(date.getTime())) return '—';
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function setPrefSwitch(row, control, value) {
    if (row) row.setAttribute('aria-checked', String(!!value));
    if (control) control.classList.toggle('on', !!value);
  }

  function statCard(label, value, sub) {
    return `<div class="settings-stat"><span>${esc(label)}</span><b>${esc(value)}</b><em>${esc(sub || '')}</em></div>`;
  }

  function applySystemTier(system) {
    const root = document.documentElement;
    root.dataset.tier = (system && system.tier) || 'full';
    root.dataset.os = (system && system.osLabel) || '';
    root.dataset.wv = String((system && system.webView2Major) || 0);
    if (system && system.supportColorMix === false) root.dataset.colorMix = 'off';
    else delete root.dataset.colorMix;
  }

  async function changeCompatibilityTier() {
    if (!els.settingsTier) return;
    const value = els.settingsTier.value;
    state.settings.compatibilityTier = value;
    saveSettings();
    const result = await call('getSystem', { tier: value });
    if (result && result.ok && result.system) {
      state.system = result.system;
      applySystemTier(result.system);
      renderSettings();
      audio.select();
      toast(`效果档位 · ${result.system.tierLabel}`, 'check');
    }
  }

  function renderSettings() {
    if (!els.settingsPlayerName) return;
    const stats = state.stats || {};
    const storage = state.storage || {};
    const games = state.games || [];

    els.settingsPlayerName.value = state.settings.playername || '';
    if (els.settingsOsUser) els.settingsOsUser.textContent = state.userName || '—';
    if (els.settingsVersion) els.settingsVersion.textContent = state.version;
    if (els.profileVersion) els.profileVersion.textContent = `${state.version} · 桌面版`;
    const system = state.system || {};
    const displayName = state.settings.playername || state.userName || '玩家';
    if (els.settingsHeroName) els.settingsHeroName.textContent = displayName;
    if (els.settingsHeroAccount) els.settingsHeroAccount.textContent = state.userName ? `本机账户 · ${state.userName}` : '本机离线账户';
    if (els.settingsAvatar) els.settingsAvatar.textContent = (displayName.trim().slice(0, 1) || 'N').toUpperCase();
    if (els.settingsHeroTier) els.settingsHeroTier.textContent = system.tierLabel || '完整效果';
    if (els.settingsHeroVersion) els.settingsHeroVersion.textContent = `v${state.version}`;
    if (els.settingsFootPath) els.settingsFootPath.textContent = storage.root ? `数据目录 · ${storage.root}` : '数据目录 · —';
    if (els.settingsTier) els.settingsTier.value = state.settings.compatibilityTier || 'auto';
    if (els.settingsTierTag) els.settingsTierTag.textContent = system.tierLabel || '完整效果';
    if (els.settingsSystemStats) {
      els.settingsSystemStats.innerHTML = [
        statCard('系统', system.osLabel || '—', `build ${system.build || '—'}`),
        statCard('WebView2', system.webView2Version || '未检测到', `Chromium ${system.webView2Major || '—'}`),
        statCard('效果档位', system.tierLabel || '—', system.supportColorMix === false ? '无 color-mix' : 'color-mix 可用'),
        statCard('宿主', system.legacyBuild ? 'Legacy .NET 4.8' : 'Modern .NET 10', system.legacyBuild ? '兼容构建' : '完整效果')
      ].join('');
    }
    if (els.settingsSystemNote) els.settingsSystemNote.textContent = system.notes || '检测结果会在启动时应用到界面；切换档位可立即预览。';
    if (els.settingsDevNote) {
      els.settingsDevNote.hidden = !state.developerMode;
      els.settingsDevNote.textContent = state.developerMode
        ? (state.developerModeEnv
          ? '开发者模式已由 NOVA_DEV=1 强制开启 · 测试条目可见'
          : '开发者模式已开启 · 测试条目可见（Ctrl+Shift+D 关闭并重新载入）')
        : '';
    }
    setPrefSwitch(els.settingsTrayRow, els.settingsTraySwitch, state.settings.closeToTray);
    setPrefSwitch(els.settingsAutoBackupRow, els.settingsAutoBackupSwitch, state.settings.autoBackup !== false);

    if (els.settingsStorageStats) {
      els.settingsStorageStats.innerHTML = [
        statCard('游戏库', `${games.length} 款`, formatBytes(storage.libraryBytes)),
        statCard('封面文件', `${storage.mediaFiles || 0} 个`, formatBytes(storage.mediaBytes)),
        statCard('游玩记录', `${stats.sessionCount || 0} 次`, storage.lastBackupUtc ? `上次备份 ${formatSessionTime(storage.lastBackupUtc)}` : '尚未备份'),
        statCard('缺失程序', `${stats.missingCount || 0} 款`, state.settings.autoBackup !== false ? '自动备份已开' : '自动备份已关')
      ].join('');
    }

    if (els.settingsPlayStats) {
      els.settingsPlayStats.innerHTML = [
        statCard('总游玩', formatHoursShort(stats.totalSeconds || 0), `${stats.totalLaunches || 0} 次启动`),
        statCard('今日', formatHoursShort(stats.todaySeconds || 0), '本机真实计时'),
        statCard('最近 7 天', formatHoursShort(stats.weekSeconds || 0), '含今天'),
        statCard('最常玩', stats.topGameName || '—', formatHoursShort(stats.topGameSeconds || 0))
      ].join('');
    }
    if (els.settingsSessionTag) els.settingsSessionTag.textContent = `${stats.sessionCount || 0} 次`;

    if (els.settingsSessions) {
      const recent = Array.isArray(stats.recent) ? stats.recent.slice(0, 10) : [];
      els.settingsSessions.innerHTML = recent.length
        ? recent.map((session) => `
            <div class="session-row">
              <b>${esc(session.gameName || '游戏')}</b>
              <span>${esc(formatSessionTime(session.endedUtc))}${session.crashed ? ' · 异常退出' : ''}</span>
              <em>${esc(formatHoursShort(session.seconds || 0))}</em>
            </div>`).join('')
        : '<div class="session-empty">还没有游玩记录。启动游戏后，时长会记录在这里。</div>';
    }

    if (els.settingsBackupNote) {
      els.settingsBackupNote.textContent = storage.lastBackupUtc
        ? `数据包包含游戏库、设置、游玩记录与封面；不包含游戏本体与主题。上次备份：${formatSessionTime(storage.lastBackupUtc)}。`
        : '数据包包含游戏库、设置、游玩记录与封面；不包含游戏本体与主题文件。';
    }
    if (els.settingsOpenBackups) els.settingsOpenBackups.hidden = !state.backupsFolder;
    if (els.settingsUserTag) els.settingsUserTag.textContent = state.settings.playername ? '本机用户' : 'Windows 用户';
    syncAvatarImages();
  }

  async function refreshSettingsData() {
    if (!hasBridge) return;
    const result = await call('getStats');
    if (!result || !result.ok) return;
    state.stats = result.stats || state.stats;
    state.storage = result.storage || state.storage;
    renderSettings();
  }

  async function useSystemPlayerName() {
    const name = state.userName || '';
    if (!name) {
      toast('没有读取到 Windows 用户名', 'alert');
      return;
    }
    state.settings.playername = name;
    els.settingsPlayerName.value = name;
    els.profileName.textContent = name;
    const letter = name.slice(0, 1).toUpperCase();
    els.avatarLetter.textContent = letter;
    els.avatarLarge.textContent = letter;
    const result = await call('saveSettings', { useSystemPlayerName: true });
    if (result && result.ok === false) toast(result.error || '保存失败', 'alert');
    else toast(`显示名已跟随 Windows 用户 · ${name}`, 'check');
    renderSettings();
  }

  async function savePlayerName() {
    const name = (els.settingsPlayerName.value || '').trim();
    if (!name) {
      toast('请输入显示名称', 'alert');
      els.settingsPlayerName.focus();
      return;
    }
    state.settings.playername = name;
    els.profileName.textContent = name;
    const letter = name.slice(0, 1).toUpperCase();
    els.avatarLetter.textContent = letter;
    els.avatarLarge.textContent = letter;
    const result = await call('saveSettings', { playerName: name });
    if (result && result.ok === false) toast(result.error || '保存失败', 'alert');
    else toast('玩家名称已保存', 'check');
    renderSettings();
  }

  function toggleTraySetting() {
    state.settings.closeToTray = !state.settings.closeToTray;
    setPrefSwitch(els.settingsTrayRow, els.settingsTraySwitch, state.settings.closeToTray);
    saveSettings();
    toast(state.settings.closeToTray ? '关闭窗口时最小化到托盘' : '关闭窗口时每次询问', 'moon');
  }

  function avatarFileUrl() {
    const file = state.settings && state.settings.avatarFile;
    if (!file) return '';
    const normalized = String(file).replace(/\\/g, '/').replace(/^\/+/, '');
    const stamp = state.avatarStamp || state.version || '1';
    return `https://nova.media/${normalized}?v=${stamp}`;
  }

  function avatarLetter() {
    const name = (state.settings && state.settings.playername) || state.userName || 'N';
    return (String(name).trim().slice(0, 1) || 'N').toUpperCase();
  }

  function syncAvatarImages() {
    const url = avatarFileUrl();
    const letter = avatarLetter();
    if (els.settingsAvatarImg) {
      els.settingsAvatarImg.hidden = !url;
      if (url) els.settingsAvatarImg.src = url;
      else els.settingsAvatarImg.removeAttribute('src');
    }
    if (els.settingsAvatar) {
      els.settingsAvatar.textContent = letter;
      els.settingsAvatar.hidden = !!url;
    }
    if (els.settingsClearAvatar) els.settingsClearAvatar.hidden = !url;
    [els.avatarLetter, els.avatarLarge].forEach((element) => {
      if (!element) return;
      if (url) {
        element.style.backgroundImage = `url("${url}")`;
        element.style.backgroundSize = 'cover';
        element.style.backgroundPosition = 'center';
        element.textContent = '';
      } else {
        element.style.backgroundImage = '';
        element.textContent = letter;
      }
    });
  }

  async function chooseAvatar() {
    if (!window.NovaOverlays || !window.NovaOverlays.pickerOpen) return;
    const path = await window.NovaOverlays.pickerOpen({
      filter: 'image',
      title: '选择头像',
      note: '建议正方形，至少 256×256；会自动裁切'
    });
    if (!path) return;
    const result = await call('setAvatar', { path });
    if (!result || !result.ok) {
      audio.error();
      toast((result && result.error) || '头像保存失败', 'alert');
      return;
    }
    state.settings.avatarFile = result.avatarFile;
    state.avatarStamp = Date.now();
    syncAvatarImages();
    audio.confirm();
    toast('头像已更新', 'check');
  }

  async function clearAvatar() {
    const result = await call('clearAvatar');
    if (!result || result.ok === false) {
      audio.error();
      toast('头像移除失败', 'alert');
      return;
    }
    state.settings.avatarFile = null;
    state.avatarStamp = Date.now();
    syncAvatarImages();
    audio.toggle();
    toast('已恢复字母头像', 'check');
  }

  function toggleAutoBackup() {
    state.settings.autoBackup = state.settings.autoBackup === false;
    setPrefSwitch(els.settingsAutoBackupRow, els.settingsAutoBackupSwitch, state.settings.autoBackup);
    saveSettings();
    toast(state.settings.autoBackup ? '每天自动备份已开启' : '每天自动备份已关闭', 'check');
  }

  function showExportResult(title, path, detail) {
    return window.NovaOverlays.dialog({
      title,
      text: `${detail || ''}\n${path}`,
      icon: 'check',
      actions: [
        { label: '在资源管理器中显示', value: 'reveal', icon: 'folder' },
        { label: '知道了', value: 'ok', style: 'primary' }
      ]
    }).then((choice) => {
      if (choice === 'reveal') call('revealPath', { path });
    });
  }

  async function exportPack() {
    if (!els.settingsExport || els.settingsExport.disabled) return;
    els.settingsExport.disabled = true;
    const label = els.settingsExport.querySelector('span');
    if (label) label.textContent = '正在导出…';
    const result = await call('exportPack');
    els.settingsExport.disabled = false;
    if (label) label.textContent = '导出数据包';
    if (!result || !result.ok) {
      toast(result?.error || '导出失败', 'alert');
      return;
    }
    if (state.storage) state.storage.lastBackupUtc = new Date().toISOString();
    renderSettings();
    await showExportResult('数据包已导出', result.path,
      `${result.games} 款游戏 · ${result.mediaFiles} 个封面 · ${formatBytes(result.size)}`);
  }

  async function exportRecords() {
    const result = await call('exportRecords');
    if (!result || !result.ok) {
      toast(result?.error || '导出失败', 'alert');
      return;
    }
    await showExportResult('游玩记录已导出', result.path, 'CSV 可用 Excel 或文本编辑器打开。');
  }

  async function importPack() {
    if (!window.NovaOverlays || !window.NovaOverlays.pickerOpen) return;
    const path = await window.NovaOverlays.pickerOpen({
      filter: 'pack',
      title: '选择数据包',
      note: '选择 .nova-pack 或 .zip；导入前会自动备份本机库',
      startPath: (state.storage && (state.storage.exports || state.storage.root)) || state.dataFolder || ''
    });
    if (!path) return;
    const mode = await window.NovaOverlays.dialog({
      title: '导入数据包',
      text: '「合并」保留本机游戏并按 Steam ID / 路径 / 名称去重；「替换」用数据包覆盖本机游戏库与设置。导入前会自动备份当前 library.json。',
      icon: 'up',
      actions: [
        { label: '合并到本机', value: 'merge', style: 'primary', icon: 'shuffle' },
        { label: '替换本机库', value: 'replace', icon: 'alert' },
        { label: '取消', value: null }
      ]
    });
    if (!mode) return;
    const result = await call('importPack', { path, mode });
    if (!result || !result.ok) {
      toast(result?.error || '导入失败', 'alert');
      return;
    }
    const missing = result.missing ? `其中 ${result.missing} 款需要重新指定程序路径。` : '所有游戏程序路径都可用。';
    await window.NovaOverlays.dialog({
      title: '导入完成',
      text: `共 ${result.games} 款游戏：新增 ${result.added}，合并 ${result.replaced}，封面 ${result.mediaFiles} 个。${missing}`,
      icon: 'check',
      actions: [{ label: '重新载入界面', value: 'reload', style: 'primary' }]
    });
    location.reload();
  }


  function openAppearance() {
    if (state.overlay) return;
    closePopovers();
    setView('appearance');
  }

  function closeAppearance(options = {}) {
    if (state.view !== 'appearance') return;
    setView('home');
  }

  function openSettings() {
    if (state.overlay) return;
    closePopovers();
    setView('settings');
  }

  function closeSettings() {
    if (state.view !== 'settings') return;
    setView('home');
  }

  /* ============================================================
     SOUND / MOTION / FULLSCREEN / SLEEP
     ============================================================ */

  function syncSoundUI() {
    const on = state.settings.sound;
    if (els.soundSwitch) els.soundSwitch.classList.toggle('on', on);
    if (els.soundRow) els.soundRow.setAttribute('aria-checked', String(on));
    const profileUse = els.soundRow ? $('use', els.soundRow) : null;
    if (profileUse) profileUse.setAttribute('href', on ? '#i-sound-on' : '#i-sound-off');
    if (els.appearanceSoundSwitch) els.appearanceSoundSwitch.classList.toggle('on', on);
    if (els.appearanceSoundRow) els.appearanceSoundRow.setAttribute('aria-checked', String(on));
    const appearanceUse = els.appearanceSoundRow ? $('use', els.appearanceSoundRow) : null;
    if (appearanceUse) appearanceUse.setAttribute('href', on ? '#i-sound-on' : '#i-sound-off');
  }

  function setSound(on, announce = true) {
    state.settings.sound = on;
    saveSettings();
    syncSoundUI();
    if (announce) {
      if (on) audio.select();
      toast(on ? '界面音效已开启' : '界面音效已关闭', on ? 'sound-on' : 'sound-off');
    }
  }

  function syncMotionUI() {
    if (window.NovaMotion) {
      window.NovaMotion.configure({
        calm: state.settings.calm,
        reduceMotion: state.settings.reduceMotion
      });
    } else {
      document.documentElement.classList.toggle('reduce-motion', state.settings.reduceMotion);
      document.documentElement.classList.toggle('calm', state.settings.calm);
    }
    if (els.appearanceMotionSwitch) els.appearanceMotionSwitch.classList.toggle('on', state.settings.reduceMotion);
    if (els.appearanceMotionRow) els.appearanceMotionRow.setAttribute('aria-checked', String(state.settings.reduceMotion));
    if (els.appearanceCalmSwitch) els.appearanceCalmSwitch.classList.toggle('on', state.settings.calm);
    if (els.appearanceCalmRow) els.appearanceCalmRow.setAttribute('aria-checked', String(state.settings.calm));
    if (els.calmSwitch) els.calmSwitch.classList.toggle('on', state.settings.calm);
    if (els.calmRow) els.calmRow.setAttribute('aria-checked', String(state.settings.calm));
  }

  function setCalm(on, announce = true) {
    state.settings.calm = on;
    saveSettings();
    syncMotionUI();
    if (on && state.settings.reduceMotion) setReduceMotion(false, false);
    syncSoundUI();
    if (announce) {
      audio.toggle();
      toast(on ? '沉稳模式已开启 · 更少动画，更多留白' : '沉稳模式已关闭', 'moon');
    }
  }

  function setReduceMotion(on, announce = true) {
    state.settings.reduceMotion = on;
    saveSettings();
    syncMotionUI();
    if (announce) { audio.toggle(); toast(on ? '已开启减少动效' : '已关闭减少动效', 'spark'); }
  }

  function syncFullscreenLabels() {
    const active = !!state.fullscreen || !!document.fullscreenElement;
    if (els.fullscreenLabel) els.fullscreenLabel.textContent = active ? '退出全屏' : '全屏显示';
    const appearanceLabel = els.appearanceFullscreenRow ? $('.pref-label span', els.appearanceFullscreenRow) : null;
    if (appearanceLabel) appearanceLabel.textContent = active ? '退出全屏' : '全屏显示';
  }

  async function toggleFullscreen(closeMenu = false, silent = false) {
    const next = !state.fullscreen;
    await applyFullscreen(next, silent);
    if (closeMenu) closePopovers();
  }

  function applyFullscreenState(on) {
    state.fullscreen = on;
    document.documentElement.classList.toggle('is-fullscreen', on);
    syncFullscreenLabels();
    // Maximize and fullscreen are the same window mode, so one icon serves both.
    syncMaxButton(on);
    if (on) {
      document.documentElement.classList.remove('idle');
      scheduleFullscreenIdle();
    }
  }

  let fullscreenIdleTimer = null;

  function scheduleFullscreenIdle() {
    clearTimeout(fullscreenIdleTimer);
    if (!state.fullscreen) return;
    fullscreenIdleTimer = setTimeout(() => {
      if (state.fullscreen) document.documentElement.classList.add('idle');
    }, 3200);
  }

  /** The window's close button and Alt+F4 both land here. */
  async function askClose() {
    if (state.settings.closeToTray) {
      call('hideToTray');
      toast('已最小化到托盘 · 游戏仍在计时', 'moon');
      return;
    }
    const choice = await window.NovaOverlays.dialog({
      title: '关闭 NOVA',
      text: '可以最小化到托盘，让游戏继续计时。',
      icon: 'power',
      actions: [
        { label: '最小化到托盘', value: 'tray', icon: 'moon' },
        { label: '退出程序', value: 'quit', style: 'danger', icon: 'close' },
        { label: '取消', value: 'cancel', style: 'primary' }
      ]
    });
    if (choice === 'quit') call('quitNow');
    else if (choice === 'tray') call('hideToTray');
  }

  async function applyFullscreen(on, silent = false) {
    state.fullscreen = on;
    document.documentElement.classList.toggle('is-fullscreen', on);
    document.documentElement.classList.remove('idle');
    syncFullscreenLabels();

    if (on) {
      document.body.classList.add('fullscreen-entering');
      setTimeout(() => document.body.classList.remove('fullscreen-entering'), 520);
    }

    if (hasBridge) {
      const result = await call('setFullscreen', { on });
      if (result && result.ok === false && !silent) {
        toast('无法切换全屏');
      }
    } else if (on) {
      try { await document.documentElement.requestFullscreen(); } catch (error) {}
    } else if (document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch (error) {}
    }

    if (!silent) toast(on ? '全屏已开启' : '全屏已关闭', 'fullscreen');
  }

  function enterSleep() {
    if (state.overlay) return;
    state.lastFocus = els.profileBtn;
    closePopovers();
    updateClock();
    state.overlay = 'sleep';
    els.sleepOverlay.classList.add('is-open');
    els.sleepOverlay.setAttribute('aria-hidden', 'false');
    els.app.inert = true;
    audio.sleep();
    try { els.sleepOverlay.focus({ preventScroll: true }); } catch (error) {}
  }

  function exitSleep() {
    if (state.overlay !== 'sleep') return;
    els.sleepOverlay.classList.remove('is-open');
    els.sleepOverlay.setAttribute('aria-hidden', 'true');
    state.overlay = null;
    els.app.inert = false;
    audio.select();
    restoreFocus();
  }

  function syncMaxButton(maximized) {
    const use = els.maxBtn.querySelector('use');
    if (use) use.setAttribute('href', maximized ? '#i-restore' : '#i-square');
    els.maxBtn.setAttribute('aria-label', maximized ? '还原' : '最大化');
  }

  /* ============================================================
     NOTIFICATIONS
     ============================================================ */

  function pushNotice(notice) {
    notices.unshift({ id: ++noticeSeq, unread: true, time: Date.now(), ...notice });
    if (notices.length > 12) notices.length = 12;
    renderNotifications();
    els.bellDot.classList.remove('is-hidden');
  }

  function noticeTime(notice) {
    const diff = Date.now() - notice.time;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    return `${Math.floor(diff / 3600000)} 小时前`;
  }

  function renderNotifications() {
    const hasUnread = notices.some((notice) => notice.unread);
    els.bellDot.classList.toggle('is-hidden', !hasUnread);
    els.markReadBtn.disabled = !hasUnread;
    els.notifFootText.textContent = notices.length ? `${notices.length} 条通知 · 本地生成` : '游戏库已就绪';

    if (!notices.length) {
      els.notifList.innerHTML = `
        <div class="notif-empty">
          <svg class="ic" aria-hidden="true"><use href="#i-bell"/></svg>
          <span>还没有通知</span>
          <em>启动游戏、结束会话时会在这里留下记录。</em>
        </div>`;
      return;
    }

    els.notifList.innerHTML = notices.map((notice, index) => `
      <button class="notif-item ${notice.unread ? '' : 'is-read'}" data-notice="${index}">
        <span class="notif-icon" style="--n-color:${notice.color || '#ffb45e'}">
          <svg class="ic" aria-hidden="true"><use href="#i-${notice.icon || 'spark'}"/></svg>
        </span>
        <div class="notif-copy">
          <div class="notif-title">${esc(notice.title)}</div>
          <div class="notif-sub">${esc(notice.sub || '')}</div>
          <div class="notif-time">${esc(noticeTime(notice))}</div>
        </div>
        <span class="notif-unread" aria-hidden="true"></span>
      </button>
    `).join('');
  }

  function openPopover(which) {
    const panel = which === 'notif' ? els.notifPanel : els.profileMenu;
    const button = which === 'notif' ? els.notifBtn : els.profileBtn;
    const wasOpen = panel.classList.contains('is-open');
    closePopovers();
    if (wasOpen) return;
    if (which === 'notif') renderNotifications();
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    button.setAttribute('aria-expanded', 'true');
    audio.select();
  }

  /* ============================================================
     LAUNCH
     ============================================================ */

  function clearLaunchTimers() {
    state.launchTimers.forEach((timer) => clearTimeout(timer));
    state.launchTimers = [];
  }

  const launchSteps = () => Array.from(els.launchSteps.children);

  function setLaunchProgress(percent) {
    const value = Math.max(0, Math.min(100, percent));
    const circumference = 540.35;
    if (els.launchRing) els.launchRing.style.strokeDashoffset = String(circumference * (1 - value / 100));
    if (els.launchRingLabel) els.launchRingLabel.textContent = `${Math.round(value)}%`;
  }

  function setLaunchStep(index) {
    launchSteps().forEach((step, i) => {
      step.classList.toggle('is-active', i === index);
      step.classList.toggle('is-done', i < index);
    });
  }

  async function launchGame(game) {
    if (state.overlay === 'launch' || !game) return;
    if (state.running.has(game.id)) {
      toast(`《${shortName(game)}》正在运行中`, 'gamepad');
      return;
    }
    if (!game.exists) {
      toast('找不到游戏程序，请在管理面板中重新指定', 'alert');
      openDetails();
      setTimeout(openManage, 180);
      return;
    }

    closePopovers();
    clearLaunchTimers();

    els.launchArt.src = game.heroUrl;
    els.launchArt.style.objectPosition = game.heroPosition;
    els.launchArt.alt = `${game.zh || game.name} 启动画面`;
    setLogo(els.launchLogo, game, 'launch-logo');
    els.launchZh.textContent = fullName(game);
    els.launchKicker.textContent = game.launchCount > 0 ? '继续' : '开始';
    els.launchStatus.textContent = '正在启动…';
    els.launchSystem.textContent = '启动中';
    els.launchFootMeta.textContent = game.playtimeSeconds > 0
      ? `累计 ${formatHours(game.playtimeSeconds)} · 本次会计入`
      : '本次时长会计入统计';
    setLaunchProgress(12);
    setLaunchStep(0);

    els.launchOverlay.classList.remove('is-open', 'is-ready', 'is-leaving', 'is-error', 'is-igniting');
    void els.launchOverlay.offsetWidth;

    state.lastFocus = els.playBtn;
    state.overlay = 'launch';
    document.body.dataset.overlay = 'launch';
    els.launchOverlay.classList.add('is-open', 'is-igniting');
    els.launchOverlay.setAttribute('aria-hidden', 'false');
    els.app.inert = true;
    audio.launch();
    try { els.launchOverlay.focus({ preventScroll: true }); } catch (error) {}
    refreshPadHints();
    state.launchTimers.push(setTimeout(() => {
      els.launchOverlay.classList.remove('is-igniting');
    }, motionMs('cinematic', 900)));

    // Step 1 — load info. The visual sequence runs on wall-clock timers so
    // it feels the same whether the process starts in 80 ms or 4 s.
    state.launchTimers.push(setTimeout(() => {
      setLaunchProgress(42);
      els.launchStatus.textContent = '启动进程…';
      setLaunchStep(1);
    }, state.settings.calm ? 160 : 420));

    const startedAt = performance.now();
    const result = await call('launch', { id: game.id });
    const ok = result && result.ok;

    // Step 2 — the process exists; give the surface a beat to hand over.
    const minimum = state.settings.calm ? 1000 : 1600;
    const elapsed = performance.now() - startedAt;
    const wait = Math.max(0, minimum - elapsed);
    await new Promise((resolve) => setTimeout(resolve, wait));

    if (ok) {
      game.launchCount = (game.launchCount || 0) + 1;
      game.lastPlayedUtc = new Date().toISOString();
      setLaunchProgress(82);
      els.launchStatus.textContent = '进程已创建';
      setLaunchStep(2);
      if (!state.running.has(game.id)) {
        state.running.set(game.id, {
          sessionId: result.sessionId,
          gameId: game.id,
          gameName: game.name,
          startedUtc: new Date().toISOString()
        });
      }
      state.launchTimers.push(setTimeout(() => {
        setLaunchProgress(100);
        setLaunchStep(3);
        els.launchSystem.textContent = '运行中';
        els.launchStatus.textContent = '运行中';
        els.launchOverlay.classList.add('is-ready');
        audio.launchReady();
      }, state.settings.calm ? 220 : 520));
      if (state.overlay === 'details') populateDetails(game);
      updateRail();
      refreshLive();
    } else {
      setLaunchProgress(100);
      els.launchStatus.textContent = result?.error || '启动失败';
      els.launchSystem.textContent = '启动失败';
      els.launchFootMeta.textContent = '请检查可执行文件路径与权限';
      els.launchOverlay.classList.add('is-ready', 'is-error');
      setLaunchStep(-1);
      audio.error();
      toast(result?.error || '启动失败', 'alert');
    }
  }

  function closeLaunch(options = {}) {
    if (state.overlay !== 'launch') return;
    clearLaunchTimers();
    if (options.quiet !== true) audio.exitGame();
    const reduce = state.settings.reduceMotion || state.settings.calm;
    const duration = reduce ? 240 : 900;
    els.launchOverlay.classList.add('is-leaving');
    els.launchOverlay.classList.remove('is-ready', 'is-igniting', 'is-error');

    state.launchTimers.push(setTimeout(() => {
      els.launchOverlay.classList.remove('is-open', 'is-leaving');
      els.launchOverlay.setAttribute('aria-hidden', 'true');
      state.overlay = null;
      els.app.inert = false;
      if (document.body.dataset.overlay === 'launch') delete document.body.dataset.overlay;
      restoreFocus();
      refreshPadHints();
    }, duration));
  }

  function onSessionStarted(payload) {
    if (!payload) return;
    state.running.set(payload.gameId, payload);
    const game = findGame(payload.gameId);
    if (game) {
      game.launchCount = Math.max(game.launchCount || 0, 1);
      game.lastPlayedUtc = new Date().toISOString();
    }
    pushNotice({
      icon: 'play',
      color: game?.accent || '#ffb45e',
      title: `${payload.gameName} 已启动`,
      sub: '本次会话正在计时',
      gameId: payload.gameId
    });
    refreshLive();
    if (state.overlay === 'details') populateDetails(currentGame());
    updateRail();
  }

  function onSessionEnded(payload) {
    if (!payload) return;
    state.running.delete(payload.gameId);
    const game = findGame(payload.gameId);
    if (game) {
      game.playtimeSeconds = payload.playtimeSeconds ?? (game.playtimeSeconds + payload.seconds);
      game.lastPlayedUtc = new Date().toISOString();
    }
    const spent = formatHours(payload.seconds);
    pushNotice({
      icon: payload.crashed ? 'alert' : 'check',
      color: payload.crashed ? '#ff9d7a' : (game?.accent || '#7fe3c0'),
      title: `${payload.gameName} 已结束`,
      sub: payload.crashed ? `进程非正常退出 · 本次 ${spent}` : `本次游玩 ${spent}`,
      gameId: payload.gameId
    });
    if (game && state.overlay !== 'launch') {
      toast(payload.crashed
        ? `《${shortName(game)}》非正常退出 · 已记录 ${spent}`
        : `《${shortName(game)}》已结束 · 本次 ${spent}`, payload.crashed ? 'alert' : 'check');
    }
    refreshLive();
    if (state.overlay === 'details') populateDetails(currentGame());
    updateRail();
  }

  /* keep "运行中" counters fresh every 30 s */
  function refreshLive() {
    if (state.overlay === 'details' && currentGame()) updateDetailProgress(currentGame());
    if (state.view === 'library') renderLibrary();
    if (!state.overlay && state.view === 'home' && currentGame()) renderHero(currentGame(), false);
    updateRail();
  }

  /* ============================================================
     EDITOR
     ============================================================ */

  function editorLogoText() {
    const name = els.fLogo.value.trim() || els.fName.value.trim() || 'NOVA';
    return name.toUpperCase();
  }

  function clampNumber(value, min, max) {
    const number = Number(value);
    return Math.max(min, Math.min(max, Number.isFinite(number) ? number : min));
  }

  function parseHeroPosition(value) {
    const match = String(value || '').match(/([\d.]+)%\s+([\d.]+)%/);
    return {
      x: match ? clampNumber(parseFloat(match[1]), 0, 100) : 50,
      y: match ? clampNumber(parseFloat(match[2]), 0, 100) : 45
    };
  }

  function framingFor(game) {
    const position = parseHeroPosition(game && game.heroPosition);
    return {
      x: position.x,
      y: position.y,
      zoom: clampNumber(game && game.heroZoom, 1, 2.4)
    };
  }

  /**
   * object-position chooses the crop; the translate makes the crop
   * pannable once the player zooms in. translate percentages are of the
   * image's own box, so at zoom z the maximum travel is (z-1)/2.
   */
  function applyHeroFraming(image, framing, stopDrift = false) {
    if (!image) return;
    const x = clampNumber(framing && framing.x, 0, 100);
    const y = clampNumber(framing && framing.y, 0, 100);
    const zoom = clampNumber(framing && framing.zoom, 1, 2.4);
    image.style.objectPosition = `${x}% ${y}%`;
    if (zoom > 1.0001) {
      image.style.transformOrigin = '50% 50%';
      image.style.transform = `translate(${(50 - x) * (zoom - 1)}%, ${(50 - y) * (zoom - 1)}%) scale(${zoom})`;
      if (stopDrift) image.style.animation = 'none';
    } else {
      image.style.transform = '';
      image.style.transformOrigin = '';
      if (stopDrift) image.style.animation = '';
    }
  }

  function syncEditorFraming() {
    const framing = state.editorFraming;
    applyHeroFraming(els.editorPreviewImg, framing);
    if (els.framingZoom) els.framingZoom.textContent = `${Math.round(framing.zoom * 100)}%`;
  }

  function bindEditorFraming() {
    if (!els.editorPreview || !els.editorFraming) return;

    els.editorFraming.addEventListener('click', (event) => {
      const button = event.target.closest('[data-frame]');
      if (!button) return;
      const framing = state.editorFraming;
      const action = button.dataset.frame;
      if (action === 'left') framing.x -= 2;
      else if (action === 'right') framing.x += 2;
      else if (action === 'up') framing.y -= 2;
      else if (action === 'down') framing.y += 2;
      else if (action === 'zoom-in') framing.zoom += 0.1;
      else if (action === 'zoom-out') framing.zoom -= 0.1;
      else if (action === 'reset') { framing.x = 50; framing.y = 45; framing.zoom = 1; }
      framing.x = clampNumber(framing.x, 0, 100);
      framing.y = clampNumber(framing.y, 0, 100);
      framing.zoom = clampNumber(framing.zoom, 1, 2.4);
      syncEditorFraming();
      event.stopPropagation();
    });

    let drag = null;
    els.editorPreview.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || event.target.closest('button')) return;
      const rect = els.editorPreview.getBoundingClientRect();
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
        framing: { x: state.editorFraming.x, y: state.editorFraming.y, zoom: state.editorFraming.zoom }
      };
      try { els.editorPreview.setPointerCapture(event.pointerId); } catch (error) {}
      els.editorPreview.classList.add('is-framing');
      event.preventDefault();
    });

    els.editorPreview.addEventListener('pointermove', (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      state.editorFraming.x = clampNumber(drag.framing.x - (dx / drag.width) * 120, 0, 100);
      state.editorFraming.y = clampNumber(drag.framing.y - (dy / drag.height) * 120, 0, 100);
      syncEditorFraming();
    });

    const endDrag = (event) => {
      if (!drag || (event.pointerId != null && event.pointerId !== drag.pointerId)) return;
      drag = null;
      els.editorPreview.classList.remove('is-framing');
      try { els.editorPreview.releasePointerCapture(event.pointerId); } catch (error) {}
    };
    els.editorPreview.addEventListener('pointerup', endDrag);
    els.editorPreview.addEventListener('pointercancel', endDrag);

    els.editorPreview.addEventListener('wheel', (event) => {
      if (state.overlay !== 'editor') return;
      event.preventDefault();
      const step = event.deltaY < 0 ? 0.08 : -0.08;
      state.editorFraming.zoom = clampNumber(state.editorFraming.zoom + step, 1, 2.4);
      syncEditorFraming();
    }, { passive: false });
  }

  function syncEditorPreview() {
    const name = els.fLogo.value.trim() || els.fName.value.trim() || 'NOVA';
    setLogo(els.editorLogo, currentGame(), 'editor-logo', {
      text: name.toUpperCase(),
      recipe: els.fTypeRecipe ? els.fTypeRecipe.value : ''
    });
    els.editorPreviewHint.textContent = els.editorPreviewImg.getAttribute('src')
      ? '拖动画面 / 滚轮缩放 · 保存后应用'
      : (els.fExe.value ? '保存后从真实封面或程序图标生成' : '从可执行文件或图片生成封面');
  }

  function setEditorError(message) {
    if (!message) {
      els.editorError.hidden = true;
      els.editorError.textContent = '';
      return;
    }
    els.editorError.hidden = false;
    els.editorError.textContent = message;
  }

  function resetEditorFields() {
    els.fExe.value = '';
    els.fName.value = '';
    els.fZh.value = '';
    els.fGenre.value = '';
    els.fLogo.value = '';
    els.fTagline.value = '';
    els.fImage.value = '';
    els.fArgs.value = '';
    els.fWorkDir.value = '';
    els.fDesc.value = '';
    els.fAge.value = '';
    els.fMode.value = '';
    if (els.fTypeRecipe) els.fTypeRecipe.value = '';
    els.editorPreviewImg.classList.remove('is-loaded');
    els.editorPreviewImg.removeAttribute('src');
    els.editorSwatches.innerHTML = '';
    state.editorFraming = { x: 50, y: 45, zoom: 1 };
    syncEditorFraming();
    setEditorError('');
  }

  function openEditor(game = null) {
    const allowed = !state.overlay || state.overlay === 'scanner' || state.overlay === 'details';
    if (!allowed) return;
    if (state.overlay === 'scanner') closeScanner({ focus: false, sound: false });
    if (state.overlay === 'details') closeDetails({ focus: false, sound: false });

    state.lastFocus = document.activeElement;
    state.editorMode = game ? 'edit' : 'create';
    state.editorId = game ? game.id : null;
    state.editorManifest = null;
    resetEditorFields();

    if (game) {
      els.editorTitle.textContent = '编辑游戏';
      els.editorMode.textContent = '编辑';
      els.editorSaveLabel.textContent = '保存修改';
      els.editorDelete.hidden = false;
      els.fExe.value = game.exePath || '';
      els.fName.value = game.name || '';
      els.fZh.value = game.zh || '';
      els.fGenre.value = game.genre || '';
      els.fLogo.value = game.logo || '';
      els.fTagline.value = game.tagline || '';
      els.fArgs.value = game.args || '';
      els.fWorkDir.value = game.workDir || '';
      els.fDesc.value = game.description || '';
      els.fAge.value = game.ageRating || '';
      els.fMode.value = game.mode || '';
      if (els.fTypeRecipe) els.fTypeRecipe.value = game.typeRecipe || '';
      state.editorFraming = framingFor(game);
      if (game.heroUrl) {
        els.editorPreviewImg.src = game.heroUrl;
        els.editorPreviewImg.onload = () => {
          els.editorPreviewImg.classList.add('is-loaded');
          syncEditorFraming();
        };
        (game.colors || []).forEach((color) => {
          const swatch = document.createElement('i');
          swatch.style.background = color;
          els.editorSwatches.appendChild(swatch);
        });
      }
    } else {
      els.editorTitle.textContent = '添加游戏';
      els.editorMode.textContent = '添加';
      els.editorSaveLabel.textContent = '添加到游戏库';
      els.editorDelete.hidden = true;
    }

    syncEditorPreview();
    syncEditorFraming();
    state.overlay = 'editor';
    openSurface('editor');
    audio.select();
    setTimeout(() => {
      const target = game ? els.fName : els.fExe;
      try { target.focus({ preventScroll: true }); } catch (error) {}
    }, 120);
  }

  function closeEditor(options = {}) {
    if (state.overlay !== 'editor') return;
    const { focus = true, sound = true } = options;
    closeSurface('editor');
    state.overlay = null;
    if (sound) audio.back();
    if (focus) restoreFocus();
  }

  async function saveEditor() {
    const exePath = els.fExe.value.trim();
    const imagePath = els.fImage.value.trim();
    if (!exePath) {
      setEditorError('请先选择游戏的可执行文件（.exe）。');
      return;
    }
    if (!els.fName.value.trim()) {
      const suggested = exePath.split(/[\\/]/).pop().replace(/\.exe$/i, '').replace(/[_-]/g, ' ');
      els.fName.value = suggested;
    }

    const payload = {
      id: state.editorId || undefined,
      exePath,
      name: els.fName.value.trim(),
      zh: els.fZh.value.trim(),
      genre: els.fGenre.value.trim(),
      logoText: els.fLogo.value.trim(),
      tagline: els.fTagline.value.trim(),
      imagePath: imagePath || undefined,
      args: els.fArgs.value.trim(),
      workDir: els.fWorkDir.value.trim(),
      description: els.fDesc.value.trim(),
      ageRating: els.fAge.value.trim() || '全年龄',
      mode: els.fMode.value.trim() || '单人',
      typeRecipe: els.fTypeRecipe ? els.fTypeRecipe.value : '',
      heroPosition: `${Math.round(state.editorFraming.x)}% ${Math.round(state.editorFraming.y)}%`,
      heroZoom: Number(state.editorFraming.zoom.toFixed(2)),
      manifestPath: state.editorManifest || undefined
    };

    els.editorSave.disabled = true;
    const label = els.editorSaveLabel.textContent;
    els.editorSaveLabel.textContent = state.editorMode === 'edit' ? '正在保存…' : '正在生成封面…';

    const result = state.editorMode === 'edit'
      ? await call('updateGame', payload)
      : await call('createGame', payload);

    els.editorSave.disabled = false;
    els.editorSaveLabel.textContent = label;

    if (!result || !result.ok) {
      setEditorError(result?.error || '保存失败，请检查文件路径。');
      audio.error();
      return;
    }

    if (state.editorMode === 'edit') {
      const game = findGame(state.editorId);
      if (game) Object.assign(game, result.game);
      toast(`《${shortName(result.game)}》已更新`, 'check');
      closeEditor({ focus: false, sound: false });
      rebuildAfterLibraryChange(false);
      audio.select();
    } else {
      state.games.push(result.game);
      const index = state.games.length - 1;
      closeEditor({ focus: false, sound: false });
      rebuildAfterLibraryChange(false);
      selectGame(index, { sound: false, initial: true });
      setBackdrop(result.game);
      applyAccent(result.game);
      renderHero(result.game, true);
      audio.select();
      toast(`已添加《${shortName(result.game)}》`, 'check');
    }
  }

  /* ============================================================
     THEMES
     A theme swaps the whole shell: colours, borders, buttons and
     icons. Themes live in the user theme folder and never execute code.
     ============================================================ */

  const THEME_USAGE_KEY = 'nova.themeUsage';
  const THEME_COLLAPSE_KEY = 'nova.themeCollapsed';
  const THEME_PINNED_LIMIT = 6;

  function readThemeUsage() {
    try {
      const parsed = JSON.parse(localStorage.getItem(THEME_USAGE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function recordThemeUse(id) {
    if (!id) return;
    try {
      const usage = readThemeUsage();
      usage[id] = (Number(usage[id]) || 0) + 1;
      localStorage.setItem(THEME_USAGE_KEY, JSON.stringify(usage));
    } catch (error) {}
  }

  function themeCollapsed() {
    try {
      const saved = localStorage.getItem(THEME_COLLAPSE_KEY);
      return saved === null ? true : saved === '1';
    } catch (error) {
      return true;
    }
  }

  function setThemeCollapsed(value) {
    try { localStorage.setItem(THEME_COLLAPSE_KEY, value ? '1' : '0'); } catch (error) {}
  }

  /* ------------------------------------------------------------
     Theme order is a session snapshot.
     ------------------------------------------------------------
     Usage used to be re-sorted on every render, so clicking a theme
     moved every card under the pointer — the next click landed on a
     different theme. Now the "frequently used first" order is frozen
     when the theme list is first read (and on an explicit refresh);
     usage keeps counting for the next launch, but the grid never
     reshuffles mid-session. New themes are appended, never inserted.
     ------------------------------------------------------------ */

  let themeOrder = null;

  // Fixed shelf: the first four cards never move, regardless of usage counts.
  const THEME_PREFIX = ['nova', 'endfield', 'zerohour', 'codex'];

  function computeThemeOrder(themes) {
    const usage = readThemeUsage();
    const byId = new Map(themes.map((theme) => [theme.id, theme]));
    const head = THEME_PREFIX.map((id) => byId.get(id)).filter(Boolean);
    const tail = themes
      .filter((theme) => !THEME_PREFIX.includes(theme.id))
      .sort((a, b) => {
        const delta = (Number(usage[b.id]) || 0) - (Number(usage[a.id]) || 0);
        if (delta) return delta;
        return String(a.name || a.id).localeCompare(String(b.name || b.id), 'zh-Hans-CN');
      });
    return [...head, ...tail].map((theme) => theme.id);
  }

  function orderedThemes() {
    if (!window.NovaTheme) return [];
    const all = window.NovaTheme.themes;
    if (!themeOrder) themeOrder = computeThemeOrder(all);
    const byId = new Map(all.map((theme) => [theme.id, theme]));
    const out = [];
    themeOrder.forEach((id) => {
      const theme = byId.get(id);
      if (theme) { out.push(theme); byId.delete(id); }
    });
    // Themes added since the snapshot go to the end, in manifest order.
    all.forEach((theme) => { if (byId.has(theme.id)) out.push(theme); });
    return out;
  }

  function freezeThemeOrder() {
    if (!window.NovaTheme) return;
    themeOrder = computeThemeOrder(window.NovaTheme.themes);
  }

  function renderThemes() {
    if (!els.themeGrid || !window.NovaTheme) return;
    const allThemes = window.NovaTheme.themes;
    const themes = orderedThemes();
    const activeId = window.NovaTheme.activeId;
    const collapsed = themeCollapsed();
    let visible = collapsed ? themes.slice(0, THEME_PINNED_LIMIT) : themes;

    // The active theme must always stay reachable. Append it instead of
    // replacing the last card: replacing moved a card the user may be
    // aiming at and made the grid feel unstable.
    if (collapsed && activeId && !visible.some((theme) => theme.id === activeId)) {
      const activeTheme = themes.find((theme) => theme.id === activeId);
      if (activeTheme) visible = [...visible, activeTheme];
    }

    els.themeCountTag.textContent = `${allThemes.length} 套`;
    if (els.themeToggle) {
      const canFold = allThemes.length > THEME_PINNED_LIMIT;
      els.themeToggle.hidden = !canFold;
      els.themeToggle.setAttribute('aria-expanded', String(!collapsed));
      if (els.themeToggleLabel) {
        els.themeToggleLabel.textContent = collapsed
          ? `展开全部 ${allThemes.length} 套`
          : '收起，只看常用';
      }
    }

    els.themeGrid.innerHTML = visible.map((theme) => {
      const active = theme.id === activeId;
      const broken = theme.ok === false;
      const preview = theme.previewUrl
        ? `<img src="${esc(theme.previewUrl)}" alt="" draggable="false">`
        : '<span class="theme-placeholder"><svg class="ic" aria-hidden="true"><use href="#i-spark"/></svg></span>';
      return `
        <button class="theme-card${active ? ' is-active' : ''}${broken ? ' is-broken' : ''}"
                data-theme="${esc(theme.id)}" type="button"
                aria-pressed="${active ? 'true' : 'false'}"
                ${broken ? 'disabled' : ''}
                title="${esc(broken ? theme.error : theme.description || theme.name)}">
          <span class="theme-preview">${preview}</span>
          <span class="theme-meta">
            <span class="theme-name">${esc(theme.name)}</span>
            <span class="theme-sub">${esc(broken ? theme.error : `${theme.author} · v${theme.version}`)}</span>
          </span>
          ${active ? '<span class="theme-active-tag">使用中</span>' : ''}
        </button>`;
    }).join('');
  }

  /* ------------------------------------------------------------
     Theme switch curtain
     ------------------------------------------------------------
     The shutter is painted with the incoming theme's accent, covers the
     window while the stylesheet is swapped, then opens. That hides the
     one expensive frame (a full style recalculation across ~2k theme
     selectors) behind deliberate motion instead of a visible freeze.
     ------------------------------------------------------------ */

  let curtainTimer = 0;
  let themeSwitching = false;

  // Each theme owns a different shutter: doors, page turn, CRT, ink blot…
  // The hold time matches the longest cover phase so the style swap stays hidden.
  const CURTAIN_HOLD = {
    nova: 360, aurum: 400, endfield: 380, zerohour: 420, codex: 430,
    broadcast: 360, summer: 470, riso: 380, riot: 380, grimoire: 650, mnemo: 360
  };

  function curtainThemeName(theme) {
    return String(theme.name || theme.id || 'NOVA').split('·')[0].trim() || 'NOVA';
  }

  function playThemeCurtain(theme) {
    return new Promise((resolve) => {
      if (!els.themeCurtain || state.settings.reduceMotion ||
          (state.system && state.system.tier === 'safe')) { resolve(); return; }
      const tokens = theme.tokens || {};
      els.themeCurtain.dataset.variant = theme.id || 'nova';
      els.themeCurtain.style.setProperty('--tc-accent', tokens['--accent'] || '#ffa477');
      els.themeCurtain.style.setProperty('--tc-accent-2', tokens['--accent-2'] || '#ff6f6f');
      if (els.themeCurtainName) els.themeCurtainName.textContent = curtainThemeName(theme);
      els.themeCurtain.classList.remove('is-reveal', 'is-cover');
      els.themeCurtain.classList.add('is-on');
      // Paint the new variant's closed state before starting the transition.
      // On the first switch the browser has not computed these transforms yet,
      // so starting in the same frame made the cover look truncated.
      void els.themeCurtain.offsetWidth;
      clearTimeout(curtainTimer);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (!els.themeCurtain || !els.themeCurtain.classList.contains('is-on')) { resolve(); return; }
        els.themeCurtain.classList.add('is-cover');
        curtainTimer = setTimeout(resolve, CURTAIN_HOLD[theme.id] || 380);
      }));
    });
  }

  function revealThemeCurtain() {
    if (!els.themeCurtain || !els.themeCurtain.classList.contains('is-cover')) return;
    els.themeCurtain.classList.remove('is-cover');
    els.themeCurtain.classList.add('is-reveal');
    clearTimeout(curtainTimer);
    curtainTimer = setTimeout(() => {
      els.themeCurtain.classList.remove('is-on', 'is-reveal', 'is-cover');
    }, 520);
  }

  async function applyTheme(id, options = {}) {
    if (!window.NovaTheme || themeSwitching) return;
    const theme = window.NovaTheme.find(id);
    if (!theme || theme.ok === false) {
      if (!options.silent) toast(theme?.error || '这个主题不可用', 'alert');
      return;
    }
    const before = window.NovaTheme.activeId;
    const animate = !options.silent && before !== id && !state.settings.reduceMotion &&
      !(state.system && state.system.tier === 'safe');
    if (animate) {
      themeSwitching = true;
      audio.theme();
      await playThemeCurtain(theme);
    }

    let result = null;
    try {
      result = await window.NovaTheme.activate(id, options);
    } finally {
      if (!result || !result.ok) {
        if (animate) { revealThemeCurtain(); themeSwitching = false; }
      }
    }
    if (!result || !result.ok) {
      if (!options.silent) toast(result?.error || '主题加载失败', 'alert');
      return;
    }

    state.theme = result.theme.id;
    if (!options.silent && before !== state.theme) recordThemeUse(state.theme);
    renderThemes();
    if (before !== state.theme) {
      applyStyleModeUI();
      applyAccent(currentGame());
      refitLogos();
      // The theme changes nav paddings and font metrics. Without this the
      // sliding highlight keeps the previous width/offset until the next
      // view switch, which reads as a white pill stuck over another tab.
      setNav(state.view || document.documentElement.dataset.view || 'home', { instant: true });
      setTimeout(() => { refitLogos(); setNav(document.documentElement.dataset.view || 'home', { instant: true }); }, 350);
      audio.select();
      if (!options.silent) toast(`界面主题 · ${result.theme.name}`, 'spark');
    }

    if (animate) {
      // Hold the curtain for two frames so the new styles are painted
      // underneath before the shutter opens.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      revealThemeCurtain();
      themeSwitching = false;
    }
  }

  async function startThemes() {
    if (!window.NovaTheme || !hasBridge) return;
    await window.NovaTheme.start({ call, styleMode: state.settings.styleMode });

    // Freeze the "frequently used first" order for this session before the
    // first render, so cards never move while the user is clicking.
    freezeThemeOrder();

    // The host remembers the active theme; apply it before first paint settles.
    const preferred = state.settings.theme && window.NovaTheme.find(state.settings.theme)
      ? state.settings.theme
      : 'nova';
    await window.NovaTheme.activate(preferred, { silent: true });
    state.theme = window.NovaTheme.activeId;
    renderThemes();
    applyStyleModeUI();
    applyAccent(currentGame());
    renderHero(currentGame(), false);
    updateRail();

    // Warm the stylesheet cache after the first frame: the first switch to
    // any theme then only costs a style swap, not a disk read.
    const warm = () => { if (window.NovaTheme) window.NovaTheme.preloadAll(); };
    if (window.requestIdleCallback) requestIdleCallback(warm, { timeout: 2500 });
    else setTimeout(warm, 900);
  }

  function bindSettings() {
    if (els.settingsSaveName) els.settingsSaveName.addEventListener('click', savePlayerName);
    if (els.settingsUseSystemName) els.settingsUseSystemName.addEventListener('click', useSystemPlayerName);
    if (els.settingsPlayerName) {
      els.settingsPlayerName.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          savePlayerName();
        }
      });
    }
    if (els.settingsTrayRow) els.settingsTrayRow.addEventListener('click', toggleTraySetting);
    if (els.settingsChangeAvatar) els.settingsChangeAvatar.addEventListener('click', chooseAvatar);
    if (els.settingsAvatarButton) els.settingsAvatarButton.addEventListener('click', chooseAvatar);
    if (els.settingsClearAvatar) els.settingsClearAvatar.addEventListener('click', clearAvatar);
    if (els.settingsAutoBackupRow) els.settingsAutoBackupRow.addEventListener('click', toggleAutoBackup);
    if (els.settingsFullscreenRow) els.settingsFullscreenRow.addEventListener('click', () => applyFullscreen(!state.fullscreen));
    if (els.settingsTier) els.settingsTier.addEventListener('change', changeCompatibilityTier);
    if (els.settingsExport) els.settingsExport.addEventListener('click', exportPack);
    if (els.settingsImport) els.settingsImport.addEventListener('click', importPack);
    if (els.settingsCsv) els.settingsCsv.addEventListener('click', exportRecords);
    if (els.settingsOpenData) els.settingsOpenData.addEventListener('click', () => call('openDataFolder'));
    if (els.settingsOpenBackups) els.settingsOpenBackups.addEventListener('click', () => call('openBackupsFolder'));
    if (els.libSort) {
      els.libSort.addEventListener('change', () => {
        state.settings.librarySort = els.libSort.value;
        saveSettings();
        renderLibrary();
        audio.select();
      });
    }
    if (els.settingsRow) {
      els.settingsRow.addEventListener('click', () => {
        closePopovers();
        openSettings();
      });
    }
  }

  function bindThemePanel() {
    if (els.themeToggle) {
      els.themeToggle.addEventListener('click', () => {
        setThemeCollapsed(!themeCollapsed());
        renderThemes();
        audio.select();
      });
    }

    els.themeGrid.addEventListener('click', (event) => {
      const card = event.target.closest('[data-theme]');
      if (!card || card.disabled) return;
      applyTheme(card.dataset.theme);
    });

    // Warm the stylesheet as soon as the pointer or focus lands on a card.
    const warmCard = (event) => {
      const card = event.target.closest('[data-theme]');
      if (card && window.NovaTheme) window.NovaTheme.preload(card.dataset.theme);
    };
    els.themeGrid.addEventListener('pointerover', warmCard, { passive: true });
    els.themeGrid.addEventListener('focusin', warmCard);

    els.themeRefresh.addEventListener('click', async () => {
      if (!window.NovaTheme) return;
      await window.NovaTheme.refresh();
      // A newly installed theme joins the end of the frozen order; existing
      // cards keep their positions.
      if (!themeOrder) freezeThemeOrder();
      const stillThere = window.NovaTheme.find(state.theme);
      if (!stillThere || stillThere.ok === false) await applyTheme('nova', { silent: true });
      renderThemes();
      audio.select();
      toast(`已刷新 · ${window.NovaTheme.themes.length} 套主题`, 'shuffle');
    });

    els.themeFolder.addEventListener('click', async () => {
      const result = await call('openThemesFolder');
      audio.open();
      if (result && result.folder) toast('已打开主题文件夹', 'folder');
    });
  }

  /* ============================================================
     CONTEXT MENU
     The browser menu is disabled by the host; this is the themed
     replacement. It only offers actions that make sense here.
     ============================================================ */

  const menuState = { items: [], index: -1 };

  function closeContextMenu() {
    if (!state.menuOpen) return;
    state.menuOpen = false;
    menuState.index = -1;
    els.contextMenu.classList.remove('is-open');
    els.contextMenu.setAttribute('aria-hidden', 'true');
  }

  function contextItemsFor(target) {
    const scope = padScope();
    const items = [];

    if (scope === 'editor') {
      const field = target.closest('input, textarea');
      if (field && !field.readOnly) {
        const hasSelection = field.selectionStart !== field.selectionEnd;
        items.push({ label: '剪切', key: 'Ctrl+X', action: () => document.execCommand('cut') });
        items.push({ label: '复制', key: 'Ctrl+C', action: () => document.execCommand('copy'), disabled: !hasSelection });
        items.push({ label: '粘贴', key: 'Ctrl+V', action: () => document.execCommand('paste') });
        items.push({ separator: true });
        items.push({ label: '全选', key: 'Ctrl+A', action: () => field.select() });
      }
      return items;
    }

    const theme = window.NovaTheme && window.NovaTheme.find(state.theme);
    items.push({ label: theme ? `界面主题 · ${theme.name}` : '界面主题', icon: 'spark', action: openAppearance });
    items.push({ label: '游戏详情', icon: 'info', action: openDetails, disabled: !currentGame() });
    items.push({ label: '在资源管理器中显示', icon: 'folder', action: () => currentGame() && call('revealGame', { id: currentGame().id }), disabled: !currentGame()?.exists });
    items.push({ separator: true });
    items.push({ label: state.fullscreen ? '退出全屏' : '全屏', key: 'F', icon: 'fullscreen', action: () => toggleFullscreen() });
    items.push({ label: '睡眠模式', icon: 'moon', action: enterSleep });
    items.push({ separator: true });
    items.push({ label: '打开数据文件夹', icon: 'folder', action: () => call('openDataFolder') });
    return items;
  }

  function openContextMenu(x, y) {
    const target = document.elementFromPoint(x, y) || document.body;
    const items = contextItemsFor(target).filter((item) => !item.disabled || item.separator);
    if (!items.length) return;

    menuState.items = items;
    menuState.index = -1;
    els.contextMenu.innerHTML = items.map((item, index) => {
      if (item.separator) return '<span class="menu-separator" role="separator"></span>';
      const icon = item.icon ? `<svg class="ic" aria-hidden="true"><use href="#i-${item.icon}"/></svg>` : '<span class="menu-icon-gap"></span>';
      const key = item.key ? `<span class="menu-key">${esc(item.key)}</span>` : '';
      return `<button class="context-item${item.disabled ? ' is-disabled' : ''}" role="menuitem" data-menu="${index}" type="button"${item.disabled ? ' disabled' : ''}>${icon}<span class="menu-label">${esc(item.label)}</span>${key}</button>`;
    }).join('');

    els.contextMenu.classList.add('is-open');
    els.contextMenu.setAttribute('aria-hidden', 'false');
    state.menuOpen = true;

    // Keep the menu inside the viewport.
    const rect = els.contextMenu.getBoundingClientRect();
    const left = Math.min(x, window.innerWidth - rect.width - 10);
    const top = Math.min(y, window.innerHeight - rect.height - 10);
    els.contextMenu.style.left = `${Math.max(8, left)}px`;
    els.contextMenu.style.top = `${Math.max(8, top)}px`;

    setTimeout(() => {
      const first = $('.context-item:not(.is-disabled)', els.contextMenu);
      if (first) first.focus({ preventScroll: true });
    }, 60);
  }

  function runMenuItem(index) {
    const item = menuState.items[index];
    if (!item || item.disabled) return;
    closeContextMenu();
    audio.select();
    item.action();
  }

  function bindNativeGuards() {
    document.addEventListener('dragstart', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target || !target.closest('input, textarea')) event.preventDefault();
    }, true);
    document.addEventListener('dragover', (event) => event.preventDefault(), true);
    document.addEventListener('drop', (event) => event.preventDefault(), true);
  }

  function bindContextMenu() {
    document.addEventListener('contextmenu', (event) => {
      // Text fields keep their edit actions; everywhere else uses the themed menu.
      event.preventDefault();
      if (state.overlay === 'launch' || state.overlay === 'sleep') return;
      openContextMenu(event.clientX, event.clientY);
    });

    els.contextMenu.addEventListener('click', (event) => {
      const button = event.target.closest('[data-menu]');
      if (!button) return;
      runMenuItem(Number(button.dataset.menu));
    });

    document.addEventListener('pointerdown', (event) => {
      if (state.menuOpen && !event.target.closest('#contextMenu')) closeContextMenu();
    }, true);

    document.addEventListener('keydown', (event) => {
      if (!state.menuOpen) return;
      const usable = menuState.items
        .map((item, index) => (item.separator || item.disabled ? -1 : index))
        .filter((index) => index >= 0);
      if (!usable.length) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        closeContextMenu();
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const current = usable.indexOf(menuState.index);
        const next = event.key === 'ArrowDown'
          ? usable[(current + 1 + usable.length) % usable.length]
          : usable[(current - 1 + usable.length) % usable.length];
        menuState.index = next;
        const button = els.contextMenu.querySelector(`[data-menu="${next}"]`);
        if (button) button.focus({ preventScroll: true });
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (menuState.index < 0) runMenuItem(usable[0]);
        else runMenuItem(menuState.index);
      }
    }, true);

    window.addEventListener('blur', closeContextMenu);
  }

  /* ============================================================
     MANIFEST ADOPTION
     docs/INTEGRATION.md: when an exe ships a nova-game.json we can fill
     the whole form from it instead of asking the user to retype metadata.
     ============================================================ */

  async function adoptExecutable(path, options = {}) {
    els.fExe.value = path;
    if (!els.fWorkDir.value.trim()) els.fWorkDir.value = path.replace(/[\\/][^\\/]+$/, '');

    const manifest = await call('readManifest', { exePath: path });
    if (manifest && manifest.ok && manifest.data) {
      const data = manifest.data;
      els.fName.value = data.name || els.fName.value;
      els.fZh.value = data.zh || '';
      els.fLogo.value = data.logo || '';
      els.fGenre.value = data.genre || '';
      els.fTagline.value = data.tagline || '';
      els.fDesc.value = data.description || '';
      els.fArgs.value = data.args || '';
      els.fWorkDir.value = data.workdir || els.fWorkDir.value;
      if (data.hero) els.fImage.value = data.hero;
      state.editorManifest = manifest.manifestPath;
      els.editorPreviewHint.textContent = '已读取 nova-game.json · 封面与信息来自清单';
      if (!options.quiet) toast('已读取游戏清单 · 信息自动填入', 'disc');
    } else {
      state.editorManifest = null;
      if (!els.fName.value.trim()) {
        const name = path.split(/[\\/]/).pop().replace(/\.exe$/i, '').replace(/[_-]/g, ' ');
        els.fName.value = name;
      }
      if (!options.quiet && manifest && manifest.error === '没有找到 nova-game.json') {
        els.editorPreviewHint.textContent = '未找到清单 · 将根据程序图标生成封面';
      } else if (!options.quiet && manifest && manifest.error) {
        setEditorError(manifest.error);
      }
    }
    syncEditorPreview();
  }

  /* ============================================================
     SCANNER
     ============================================================ */

  const scanSelection = new Set();

  function openScanner() {
    if (state.overlay) return;
    state.lastFocus = document.activeElement;
    scanSelection.clear();
    state.scan = null;
    els.scannerList.innerHTML = '';
    state.overlay = 'scanner';
    openSurface('scanner');
    audio.select();
    startScan();
  }

  function closeScanner(options = {}) {
    if (state.overlay !== 'scanner') return;
    const { focus = true, sound = true } = options;
    closeSurface('scanner');
    state.overlay = null;
    if (sound) audio.back();
    if (focus) restoreFocus();
  }

  async function startScan() {
    state.scanning = true;
    els.scannerStatus.hidden = false;
    els.scannerSpinner.hidden = false;
    els.scannerStatusText.textContent = '正在扫描…';
    els.scannerImport.disabled = true;
    els.scannerImportLabel.textContent = '扫描中…';
    els.scannerList.innerHTML = '';

    const [result, manifests] = await Promise.all([call('scanLibrary'), call('scanManifests')]);
    state.scanning = false;
    state.manifestScan = manifests && manifests.ok ? manifests : null;

    if (!result || !result.ok) {
      els.scannerStatusText.textContent = result?.error || '扫描失败';
      els.scannerSpinner.hidden = true;
      els.scannerImportLabel.textContent = '导入所选';
      return;
    }

    state.scan = result;
    renderScanResults(result, state.manifestScan);
  }

  function renderScanResults(result, manifestScan) {
    const steam = result.steam || [];
    const shortcuts = result.shortcuts || [];
    const manifests = (manifestScan && manifestScan.items) || [];
    const pending = steam.filter((item) => !item.imported);
    const imported = steam.filter((item) => item.imported);
    els.scannerSpinner.hidden = true;
    els.scannerStatus.hidden = !(steam.length || shortcuts.length);
    els.scannerStatusText.textContent = `${pending.length} 款 Steam 游戏、${shortcuts.length} 个快捷方式`;

    if (!steam.length && !shortcuts.length) {
      els.scannerStatus.hidden = true;
      els.scannerList.innerHTML = `
        <div class="scanner-empty">
          <svg class="ic" aria-hidden="true"><use href="#i-folder"/></svg>
          <strong>没有找到可导入的游戏</strong>
          <span>${result.steamRoot ? 'Steam 库中没有识别到已安装的游戏。' : '未检测到 Steam 安装，可以手动添加游戏。'}</span>
        </div>`;
      els.scannerImport.disabled = true;
      els.scannerImportLabel.textContent = '导入所选';
      return;
    }

    const rows = [];
    if (manifests.length) {
      rows.push(`<div class="scan-group-title"><span>带清单的游戏 <em>nova-game.json</em></span></div>`);
      manifests.forEach((item, index) => rows.push(scanManifestRow(item, index)));
    }
    if (pending.length) {
      rows.push(`<div class="scan-group-title"><span>STEAM 游戏库 <em>${result.steamRoot || ''}</em></span></div>`);
      pending.forEach((item) => rows.push(scanRow(item, 'steam')));
    }
    if (imported.length) {
      rows.push(`<div class="scan-group-title"><span>已导入 <em>${imported.length} 款</em></span></div>`);
      imported.forEach((item) => rows.push(scanRow(item, 'steam', true)));
    }
    if (shortcuts.length) {
      rows.push('<div class="scan-group-title"><span>本机快捷方式 <em>START MENU</em></span></div>');
      shortcuts.forEach((item, index) => rows.push(scanShortcutRow(item, index)));
    }

    els.scannerList.innerHTML = rows.join('');
    updateScanSelection();
  }

  function scanManifestRow(item, index) {
    const key = `manifest:${index}`;
    const checked = scanSelection.has(key);
    return `
      <button class="scan-row ${checked ? 'is-checked' : ''}" data-scan="${key}">
        <span class="scan-thumb"><svg class="ic" aria-hidden="true"><use href="#i-disc"/></svg></span>
        <span class="scan-copy">
          <span class="scan-name">${esc(item.name || '未命名')}</span>
          <span class="scan-sub">${esc(item.tagline || item.manifestPath || '')}</span>
        </span>
        <span class="scan-source">MANIFEST</span>
        <span class="scan-check"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg></span>
      </button>`;
  }

  function scanRow(item, kind, done = false) {
    const checked = scanSelection.has(`steam:${item.appId}`);
    return `
      <button class="scan-row ${checked ? 'is-checked' : ''} ${done ? 'is-imported' : ''}" data-scan="steam:${esc(item.appId)}" ${done ? 'disabled' : ''}>
        <span class="scan-thumb">
          ${item.coverUrl ? `<img src="${esc(item.coverUrl)}" alt="" loading="lazy">` : '<svg class="ic" aria-hidden="true"><use href="#i-disc"/></svg>'}
        </span>
        <span class="scan-copy">
          <span class="scan-name">${esc(item.name)}</span>
          <span class="scan-sub">${esc(item.installDir)}</span>
        </span>
        <span class="scan-source">APP ${esc(item.appId)}</span>
        <span class="scan-check"><svg class="ic" aria-hidden="true"><use href="${done ? '#i-check' : '#i-check'}"/></svg></span>
      </button>`;
  }

  function scanShortcutRow(item, index) {
    const key = `exe:${index}`;
    const checked = scanSelection.has(key);
    return `
      <button class="scan-row ${checked ? 'is-checked' : ''}" data-scan="${key}">
        <span class="scan-thumb"><svg class="ic" aria-hidden="true"><use href="#i-gamepad"/></svg></span>
        <span class="scan-copy">
          <span class="scan-name">${esc(item.name)}</span>
          <span class="scan-sub">${esc(item.folder || '')}</span>
        </span>
        <span class="scan-source">EXE</span>
        <span class="scan-check"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg></span>
      </button>`;
  }

  function updateScanSelection() {
    els.scannerImport.disabled = scanSelection.size === 0;
    els.scannerImportLabel.textContent = scanSelection.size ? `导入所选 (${scanSelection.size})` : '导入所选';
  }

  function toggleScanRow(key) {
    if (scanSelection.has(key)) scanSelection.delete(key);
    else scanSelection.add(key);
    $$('.scan-row', els.scannerList).forEach((row) => {
      if (row.dataset.scan === key) row.classList.toggle('is-checked', scanSelection.has(key));
    });
    updateScanSelection();
  }

  async function importSelected() {
    const appIds = [];
    const exePaths = [];
    const manifestItems = [];
    scanSelection.forEach((key) => {
      if (key.startsWith('steam:')) appIds.push(key.slice(6));
      else if (key.startsWith('exe:')) {
        const item = state.scan?.shortcuts?.[Number(key.slice(4))];
        if (item) exePaths.push(item);
      } else if (key.startsWith('manifest:')) {
        const item = state.manifestScan?.items?.[Number(key.slice(9))];
        if (item) manifestItems.push(item);
      }
    });
    if (!appIds.length && !exePaths.length && !manifestItems.length) return;

    els.scannerImport.disabled = true;
    els.scannerImportLabel.textContent = '正在导入…';

    let added = 0;
    if (appIds.length) {
      const result = await call('importCandidates', { steamAppIds: appIds });
      if (result && result.ok) added += result.added || 0;
    }
    for (const item of manifestItems) {
      const result = await call('createGame', {
        exePath: item.exePath,
        manifestPath: item.manifestPath
      });
      if (result && result.ok) {
        state.games.push(result.game);
        added += 1;
      }
    }
    for (const item of exePaths) {
      const result = await call('createGame', {
        exePath: item.exePath,
        name: item.name,
        zh: '',
        genre: '本机游戏'
      });
      if (result && result.ok) {
        state.games.push(result.game);
        added += 1;
      }
    }

    scanSelection.clear();
    const boot = await call('boot');
    if (boot && boot.games) {
      state.games = boot.games;
      rebuildAfterLibraryChange(false);
      if (state.games.length) {
        const latest = state.games[state.games.length - 1];
        const index = state.games.findIndex((game) => game.id === latest.id);
        if (index >= 0) {
          state.index = index;
          applyAccent(latest);
          setBackdrop(latest);
          renderHero(latest, true);
          updateRail();
          centerTile(index);
        }
      }
    }

    audio.select();
    toast(added ? `已导入 ${added} 款游戏` : '没有新增游戏', added ? 'check' : 'info');
    closeScanner({ focus: false, sound: false });
    if (!state.overlay) renderHero(currentGame(), false);
  }

  /* ============================================================
     LIBRARY-CHANGED REBUILD
     ============================================================ */

  function rebuildAfterLibraryChange(resetIndex = true) {
    if (resetIndex) {
      if (!state.games.length) state.index = 0;
      else state.index = Math.max(0, Math.min(state.index, state.games.length - 1));
    }
    buildRail();
    buildAppearanceSwitcher();
    updateRail();
    const game = currentGame();
    if (!state.overlay) {
      renderHero(game, false);
      // Editing can change hero framing without changing the image URL,
      // so re-apply the crop on the background layer too.
      if (game) setBackdrop(game);
    }
    document.body.classList.toggle('is-empty', !state.games.length);
    if (state.view === 'library') renderLibrary();
    if (state.view === 'appearance') renderAppearance();
    if (!game) {
      els.gameLogo.textContent = 'NOVA';
      els.gameTagline.textContent = '选择游戏开始。';
    }
  }

  /* ============================================================
     KEYBOARD
     ============================================================ */

  function isTypingTarget(target) {
    return target instanceof Element && !!target.closest('input, textarea, select, [contenteditable="true"]');
  }

  function isButtonTarget(target) {
    return target instanceof Element && !!target.closest('button, a, input, [tabindex]');
  }

  function bindKeyboard() {
    document.addEventListener('keydown', (event) => {
      // The intro owns the first input only to skip itself.
      if (window.NovaIntro && window.NovaIntro.active) {
        event.preventDefault();
        window.NovaIntro.skip();
        return;
      }
      // In-app dialog and file browser own the keyboard while open.
      if (window.NovaOverlays && window.NovaOverlays.dialogOpen()) return;
      if (window.NovaOverlays && window.NovaOverlays.pickerOpenState()) {
        if (window.NovaOverlays.pickerKey(event.key)) event.preventDefault();
        return;
      }

      if (state.overlay === 'sleep') {
        event.preventDefault();
        exitSleep();
        return;
      }

      if (state.overlay === 'editor' || state.overlay === 'scanner') {
        if (event.key === 'Escape') {
          event.preventDefault();
          if (state.overlay === 'editor') closeEditor();
          else closeScanner();
        }
        return;
      }

      if (state.overlay === 'launch') {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeLaunch();
          return;
        }
        if (els.launchOverlay.classList.contains('is-ready') && !event.repeat && !event.metaKey && !event.ctrlKey && !event.altKey) {
          event.preventDefault();
          closeLaunch();
        }
        return;
      }

      if (event.key === 'Escape') {
        if (state.view === 'appearance') {
          event.preventDefault();
          closeAppearance();
          return;
        }
        if (state.overlay === 'details') {
          event.preventDefault();
          if (state.manageOpen) closeManage();
          else closeDetails();
          return;
        }
        if (state.view === 'library') {
          event.preventDefault();
          closeLibrary();
          return;
        }
        if (state.menuOpen) {
          event.preventDefault();
          closeContextMenu();
          return;
        }
        if (state.fullscreen) {
          event.preventDefault();
          applyFullscreen(false);
          return;
        }
        closePopovers();
        return;
      }

      if (state.view === 'appearance') {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          selectGame(state.index - 1, { sound: true, animate: true });
          return;
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          selectGame(state.index + 1, { sound: true, animate: true });
          return;
        }
        if (event.key === 't' || event.key === 'T') {
          event.preventDefault();
          closeAppearance();
          return;
        }
        if (event.key === 'r' || event.key === 'R') {
          event.preventDefault();
          shuffleTypeDirection();
          return;
        }
        return;
      }

      if (state.overlay === 'details') {
        if (isTypingTarget(event.target)) return;
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          selectGame(state.index - 1, { sound: true, scroll: true });
          return;
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          selectGame(state.index + 1, { sound: true, scroll: true });
          return;
        }
        if (event.key === 'm' || event.key === 'M') {
          event.preventDefault();
          if (state.manageOpen) closeManage();
          else openManage();
          return;
        }
        if (event.key === 'Enter' && !isButtonTarget(event.target)) {
          event.preventDefault();
          handlePrimary();
          return;
        }
        return;
      }

      if (state.view === 'library') {
        if (event.key === '/' && event.target !== els.libSearch) {
          event.preventDefault();
          els.libSearch.focus();
          return;
        }
        if (event.key === 'Enter' && event.target === els.libSearch) {
          event.preventDefault();
          openFirstLibraryResult();
          return;
        }
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      switch (event.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          if (event.key === 'a' || event.key === 'A') {
            event.preventDefault();
            openScanner();
            break;
          }
          event.preventDefault();
          selectGame(state.index - 1, { sound: true, scroll: true });
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          event.preventDefault();
          selectGame(state.index + 1, { sound: true, scroll: true });
          break;
        case 'Enter':
        case ' ':
          if (isButtonTarget(event.target)) return;
          event.preventDefault();
          handlePrimary();
          break;
        case 'i':
        case 'I':
          event.preventDefault();
          openDetails();
          break;
        case 'l':
        case 'L':
          event.preventDefault();
          if (state.view === 'library') setView('home');
          else openLibrary();
          break;
        case 't':
        case 'T':
          event.preventDefault();
          if (state.view === 'appearance') setView('home');
          else openAppearance();
          break;
        case 's':
        case 'S':
          if (event.ctrlKey || event.metaKey) return;
          event.preventDefault();
          if (state.view === 'settings') setView('home');
          else openSettings();
          break;
        case '/':
          event.preventDefault();
          openLibrary({ search: true });
          break;
        case 'n':
        case 'N':
          event.preventDefault();
          openPopover('notif');
          break;
        case 'm':
        case 'M':
          event.preventDefault();
          setSound(!state.settings.sound);
          break;
        case 'f':
        case 'F':
          event.preventDefault();
          toggleFullscreen();
          break;
        default:
          break;
      }
    });
  }

  function openFirstLibraryResult() {
    const first = els.libGrid.querySelector('.lib-card');
    if (first) first.click();
    else toast('没有匹配的游戏');
  }

  /* ============================================================
     GAMEPAD ADAPTER
     The pad module owns polling and layout; this adapter maps its
     abstract actions to whatever surface is currently in front.
     ============================================================ */

  function padScope() {
    if (state.overlay === 'sleep') return 'sleep';
    if (state.overlay === 'launch') return 'launch';
    if (state.overlay === 'editor') return 'editor';
    if (state.overlay === 'scanner') return 'scanner';
    if (state.view === 'appearance') return 'appearance';
    if (state.view === 'settings') return 'settings';
    if (state.view === 'library') return 'library';
    if (state.overlay === 'details') return 'details';
    if (els.notifPanel.classList.contains('is-open')) return 'notifications';
    if (els.profileMenu.classList.contains('is-open')) return 'profile';
    return 'home';
  }

  function padDialogOpen() { return !!document.querySelector('.dialog-overlay.is-open'); }
  function padPickerOpen() { return !!document.querySelector('.picker-overlay.is-open'); }

  /** The focus surface under the pad: dialog > picker > overlay > current view. */
  function padSurface() {
    const dialog = document.querySelector('.dialog-overlay.is-open');
    if (dialog) return dialog;
    const picker = document.querySelector('.picker-overlay.is-open');
    if (picker) return picker;
    if (state.overlay === 'details') return $('.detail-modal', els.detailsOverlay) || els.detailsOverlay;
    if (state.overlay === 'editor') return $('.editor-shell', els.editorOverlay) || els.editorOverlay;
    if (state.overlay === 'scanner') return $('.scanner-shell', els.scannerOverlay) || els.scannerOverlay;
    if (els.notifPanel.classList.contains('is-open')) return els.notifPanel;
    if (els.profileMenu.classList.contains('is-open')) return els.profileMenu;
    if (state.view === 'settings') return $('#settingsView .settings-options') || $('#settingsView');
    if (state.view === 'appearance') return els.appearanceOptions || els.appearanceOverlay;
    if (state.view === 'library') return $('.lib-shell', els.libraryOverlay) || els.libraryOverlay;
    return els.homeView;
  }

  function padFocusableList() {
    const surface = padSurface();
    if (!surface) return [];
    const selector = 'button:not([disabled]), a[href], select:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.from(surface.querySelectorAll(selector)).filter((element) => {
      if (element.hasAttribute('data-pad-skip')) return false;
      if (element.closest('[hidden], [aria-hidden="true"]')) return false;
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      const style = getComputedStyle(element);
      return style.visibility !== 'hidden' && style.display !== 'none';
    });
  }

  let padFocused = null;

  function padSetFocus(element) {
    if (!element) return;
    if (padFocused && padFocused !== element) padFocused.classList.remove('is-pad-focus');
    padFocused = element;
    element.classList.add('is-pad-focus');
    if (window.NovaFocus && window.NovaFocus.setModality) window.NovaFocus.setModality('gamepad');
    try { element.focus({ preventScroll: true }); } catch (error) {}
    try { element.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (error) {}
  }

  function padEnsureFocus() {
    const list = padFocusableList();
    if (!list.length) { padFocused = null; return null; }
    const active = document.activeElement;
    if (active && list.includes(active)) padFocused = active;
    if (!padFocused || !list.includes(padFocused)) padSetFocus(list[0]);
    return padFocused;
  }

  function padMoveFocus(dx, dy) {
    const list = padFocusableList();
    if (!list.length) return;
    const active = padEnsureFocus();
    if (!active) return;
    // Linear DOM order: the settings board is two columns, so geometric
    // navigation skipped whole groups. Reading order guarantees every option
    // is reachable and matches what the player sees in the tab order.
    const index = Math.max(0, list.indexOf(active));
    const dir = (dx + dy) >= 0 ? 1 : -1;
    const next = list[(index + dir + list.length) % list.length];
    padSetFocus(next);
    audio.move(dir);
  }

  function padActivate() {
    const element = padEnsureFocus();
    if (!element) return;
    if (element.tagName === 'SELECT') {
      if (element.options.length) {
        element.selectedIndex = (element.selectedIndex + 1) % element.options.length;
        element.dispatchEvent(new Event('change', { bubbles: true }));
        audio.select();
      }
      return;
    }
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      try { element.focus(); element.select(); } catch (error) {}
      toast('手柄模式下请用键盘输入', 'keyboard');
      return;
    }
    element.click();
  }

  function padHintsFor(scope) {
    if (padDialogOpen()) return [['a', '确认'], ['b', '取消'], ['←→', '选择']];
    if (padPickerOpen()) return [['a', '选择'], ['b', '取消'], ['↑↓', '移动']];
    const hints = {
      home: [['a', '启动'], ['y', '详情'], ['x', '收藏'], ['lb/rb', '换游戏'], ['menu', '游戏库'], ['view', '通知'], ['ls', '外观'], ['rs', '设置']],
      details: [['a', '选择'], ['b', '返回'], ['x', '收藏'], ['y', '管理'], ['←→↑↓', '移动']],
      library: [['a', '打开'], ['b', '返回'], ['←→↑↓', '移动']],
      appearance: [['a', '选择'], ['b', '返回'], ['←→↑↓', '移动'], ['lb/rb', '换游戏'], ['y', '重排字标']],
      settings: [['a', '选择'], ['b', '返回'], ['←→↑↓', '移动'], ['lb/rb', '翻页']],
      launch: [['b', '返回'], ['a', '完成']],
      editor: [['a', '选择'], ['b', '关闭'], ['←→↑↓', '移动']],
      scanner: [['a', '选择'], ['b', '关闭'], ['←→↑↓', '移动']],
      sleep: [['a', '唤醒']],
      notifications: [['a', '选择'], ['b', '关闭'], ['↑↓', '移动']],
      profile: [['a', '选择'], ['b', '关闭'], ['↑↓', '移动']]
    };
    return hints[scope] || hints.home;
  }

  function refreshPadHints() {
    try {
      if (!window.NovaPad || !window.NovaPad.connected) return;
      window.NovaPad.hints(padHintsFor(padScope()));
      padEnsureFocus();
    } catch (error) {
      // Controller UI must never interrupt launch or navigation.
    }
  }

  function moveLibraryPadFocus(delta) {
    const cards = $$('.lib-card', els.libGrid);
    if (!cards.length) return;
    state.libPadIndex = (state.libPadIndex + delta + cards.length) % cards.length;
    const card = cards[state.libPadIndex];
    try {
      card.focus({ preventScroll: false });
      card.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    } catch (error) {}
  }

  function openLibraryCardByIndex(delta) {
    const cards = $$('.lib-card', els.libGrid);
    if (!cards.length) return;
    const focused = document.activeElement instanceof Element ? document.activeElement.closest('.lib-card') : null;
    const current = focused ? cards.indexOf(focused) : state.libPadIndex;
    state.libPadIndex = (current + delta + cards.length) % cards.length;
    const card = cards[state.libPadIndex];
    if (card) {
      try { card.focus({ preventScroll: false }); card.scrollIntoView({ block: 'nearest' }); } catch (error) {}
    }
  }

  const PAD_FOCUS_SCOPES = new Set(['settings', 'appearance', 'library', 'details', 'editor', 'scanner', 'notifications', 'profile']);

  function padVertical(delta) {
    const scope = padScope();
    if (padDialogOpen() || padPickerOpen() || PAD_FOCUS_SCOPES.has(scope)) {
      padMoveFocus(0, delta);
    }
  }

  function padPage(dir) {
    const scope = padScope();
    if (scope === 'home') { selectGame(state.index + dir, { sound: true, scroll: true }); return; }
    if (scope === 'appearance') {
      selectGame(state.index + dir, { sound: true, animate: true });
      return;
    }
    const scroller = document.querySelector('.picker-overlay.is-open .picker-list')
      || document.querySelector('.dialog-overlay.is-open .dialog-card')
      || padSurface();
    if (scroller && scroller.scrollBy) {
      scroller.scrollBy({ top: dir * 240, behavior: state.settings.reduceMotion ? 'auto' : 'smooth' });
    }
  }

  const padApp = {
    nav(delta) {
      const scope = padScope();
      if (padDialogOpen() || padPickerOpen() || PAD_FOCUS_SCOPES.has(scope)) { padMoveFocus(delta, 0); return; }
      if (scope === 'home') selectGame(state.index + delta, { sound: true, scroll: true });
    },
    navVertical(delta) {
      padVertical(delta);
    },
    confirm() {
      const scope = padScope();
      if (padDialogOpen() || padPickerOpen() || PAD_FOCUS_SCOPES.has(scope)) { padActivate(); return; }
      if (scope === 'sleep') { exitSleep(); return; }
      if (scope === 'launch') { if (els.launchOverlay.classList.contains('is-ready')) closeLaunch(); return; }
      handlePrimary();
    },
    back() {
      if (padDialogOpen()) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        return;
      }
      if (padPickerOpen()) {
        const close = document.getElementById('pickerClose');
        if (close) close.click();
        return;
      }
      const scope = padScope();
      if (scope === 'sleep') { exitSleep(); return; }
      if (scope === 'launch') { closeLaunch(); return; }
      if (scope === 'editor') { closeEditor(); return; }
      if (scope === 'scanner') { closeScanner(); return; }
      if (scope === 'appearance') { closeAppearance(); return; }
      if (scope === 'settings') { closeSettings(); return; }
      if (scope === 'details') {
        if (state.manageOpen) closeManage();
        else closeDetails();
        return;
      }
      if (scope === 'library') { closeLibrary(); return; }
      closePopovers();
    },
    favorite() {
      const scope = padScope();
      if (scope === 'home' || scope === 'details' || scope === 'library') toggleFavorite(currentGame());
    },
    manage() {
      const scope = padScope();
      if (scope === 'appearance') { shuffleTypeDirection(); return; }
      if (scope === 'details') {
        if (state.manageOpen) closeManage();
        else openManage();
      }
    },
    library() {
      const scope = padScope();
      if (scope === 'home') openLibrary();
      else if (scope === 'library') closeLibrary();
    },
    appearance() {
      const scope = padScope();
      if (scope === 'home') openAppearance();
      else if (scope === 'appearance') closeAppearance();
    },
    notifications() {
      const scope = padScope();
      if (scope === 'home') openPopover('notif');
      else if (scope === 'notifications') closePopovers();
    },
    settings() {
      if (state.overlay) return;
      if (state.view === 'settings') closeSettings();
      else openSettings();
    },
    pageUp() { padPage(-1); },
    pageDown() { padPage(1); },
    padConnected(layout, id) {
      audio.select();
      toast(`${layout === 'playstation' ? 'PlayStation' : 'Xbox'} 手柄已连接 · 方向键移动 / ${layout === 'playstation' ? '✕' : 'A'} 选择`, 'gamepad');
      if (window.NovaFocus && window.NovaFocus.refresh) window.NovaFocus.refresh();
      padEnsureFocus();
      refreshPadHints();
    },
    padDisconnected() {
      toast('手柄已断开 · 可使用键盘', 'gamepad');
    }
  };

  function syncInputStatus(label) {
    if (els.profileStatus) els.profileStatus.textContent = label ? `${label} 已连接` : '本地游戏库';
  }

  function startGamepad() {
    if (!window.NovaPad) return;
    window.NovaPad.start(padApp, els.inputStatus);
  }

  /* ============================================================
     PRIMARY ACTION
     ============================================================ */

  async function handlePrimary() {
    const game = currentGame();
    if (!game) {
      openScanner();
      return;
    }
    if (state.running.has(game.id)) {
      openDetails();
      setTimeout(openManage, 200);
      toast('游戏正在运行 · 可在管理面板中结束进程', 'gamepad');
      return;
    }
    if (!game.exists) {
      toast('找不到游戏程序，请在管理面板中重新指定', 'alert');
      openDetails();
      setTimeout(openManage, 180);
      return;
    }
    if (state.overlay === 'details') closeDetails({ focus: false, sound: false });
    launchGame(game);
  }

  /* ============================================================
     EVENTS
     ============================================================ */

  function bindEvents() {
    bindEditorFraming();

    /* window chrome */
    const dragZone = () => {
      document.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        if (event.clientY > 34) return;
        if (event.target.closest('button, a, input, textarea, select, [tabindex]')) return;
        call('beginDrag');
      });
      document.addEventListener('dblclick', async (event) => {
        if (event.clientY > 34) return;
        if (event.target.closest('button, a, input, textarea, select, [tabindex]')) return;
        await call('toggleMaximizeWindow');
        const result = await call('fullscreenState');
        if (result) applyFullscreenState(!!result.fullscreen);
      });
    };
    dragZone();

    // Hidden developer switch: test entries stay in the library file but are
    // filtered out of the normal UI. Ctrl+Shift+D shows them again.
    document.addEventListener('keydown', (event) => {
      if (!event.ctrlKey || !event.shiftKey || String(event.key).toLowerCase() !== 'd') return;
      event.preventDefault();
      const next = !state.developerMode;
      call('saveSettings', { developerMode: next }).then(() => {
        if (state.developerModeEnv && !next) {
          toast('NOVA_DEV=1 已强制开启开发者模式', 'spark');
        } else {
          toast(next ? '开发者模式已开启 · 正在重新载入' : '开发者模式已关闭 · 正在重新载入', 'check');
        }
        setTimeout(() => location.reload(), 650);
      });
    }, true);

    els.minBtn.addEventListener('click', () => call('minimizeWindow'));
    els.maxBtn.addEventListener('click', async () => {
      await call('toggleMaximizeWindow');
      const result = await call('fullscreenState');
      if (result) applyFullscreenState(!!result.fullscreen);
    });
    els.closeBtn.addEventListener('click', () => call('closeWindow'));
    call('windowState').then((result) => { if (result) syncMaxButton(!!result.maximized); });

    els.playBtn.addEventListener('click', handlePrimary);
    els.detailPlay.addEventListener('click', handlePrimary);
    els.detailBtn.addEventListener('click', openDetails);
    els.questCard.addEventListener('click', openDetails);
    els.detailsClose.addEventListener('click', () => closeDetails());
    els.detailsOverlay.addEventListener('pointerdown', (event) => {
      if (event.target === els.detailsOverlay) closeDetails();
    });

    els.detailFav.addEventListener('click', () => toggleFavorite(currentGame()));
    els.detailManage.addEventListener('click', () => {
      if (state.manageOpen) closeManage();
      else openManage();
    });
    els.manageClose.addEventListener('click', () => closeManage());
    els.manageDoneBtn.addEventListener('click', () => closeManage());
    els.removeGameBtn.addEventListener('click', handleRemoveGame);
    els.editRow.addEventListener('click', () => {
      const game = currentGame();
      if (!game) return;
      closeDetails({ focus: false, sound: false });
      openEditor(game);
    });
    els.resetArtRow.addEventListener('click', resetArtwork);
    els.revealBtn.addEventListener('click', () => {
      const game = currentGame();
      if (game) call('revealGame', { id: game.id });
    });

    // Once the game is running, any deliberate click returns to NOVA.
    // Before that, the launch sequence owns the screen so a stray click
    // (for example the one that opened the overlay) cannot interrupt it.
    els.launchOverlay.addEventListener('click', () => {
      if (els.launchOverlay.classList.contains('is-ready')) closeLaunch();
    });
    els.sleepOverlay.addEventListener('pointerdown', exitSleep);

    els.libBack.addEventListener('click', () => closeLibrary());
    els.libSearch.addEventListener('input', () => {
      state.libQuery = els.libSearch.value;
      renderLibrary();
    });
    els.libFilters.addEventListener('click', (event) => {
      const button = event.target.closest('.filter');
      if (!button) return;
      state.libFilter = button.dataset.filter;
      state.libPadIndex = 0;
      renderLibrary();
      audio.toggle();
    });
    els.libGrid.addEventListener('click', (event) => {
      const card = event.target.closest('.lib-card');
      if (!card) return;
      closeLibrary({ focus: false, sound: false });
      chooseGameById(card.dataset.game);
      setTimeout(() => {
        try { els.playBtn.focus({ preventScroll: true }); } catch (error) {}
      }, 120);
    });
    els.clearFilters.addEventListener('click', () => {
      if (!state.games.length) {
        openScanner();
        return;
      }
      state.libFilter = 'all';
      state.libQuery = '';
      els.libSearch.value = '';
      state.libPadIndex = 0;
      renderLibrary();
      audio.select();
    });
    els.libAdd.addEventListener('click', () => openEditor());

    $$('.nav-btn').forEach((button) => {
      button.addEventListener('click', () => {
        if (state.overlay) return;
        const view = button.dataset.nav;
        if (view === 'library') openLibrary();
        else if (view === 'appearance') openAppearance();
        else if (view === 'settings') openSettings();
        else setView('home');
      });
    });

    if (els.layoutBtn) {
      els.layoutBtn.addEventListener('click', () => {
        audio.select();
        toggleLayout();
      });
    }

    els.allBtn.addEventListener('click', () => openLibrary());
    els.searchBtn.addEventListener('click', () => openLibrary({ search: true }));
    els.addBtn.addEventListener('click', () => openScanner());
    els.railAddCard.addEventListener('click', () => openScanner());
    els.brandBtn.addEventListener('click', () => {
      if (state.overlay) return;
      selectGame(0, { sound: true, scroll: true });
      setView('home');
    });

    els.notifBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      openPopover('notif');
    });
    els.profileBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      openPopover('profile');
    });
    els.markReadBtn.addEventListener('click', () => {
      notices.forEach((notice) => { notice.unread = false; });
      renderNotifications();
      audio.select();
      toast('所有通知已标记为已读');
    });
    els.notifList.addEventListener('click', (event) => {
      const item = event.target.closest('.notif-item');
      if (!item) return;
      const notice = notices[Number(item.dataset.notice)];
      if (!notice) return;
      notice.unread = false;
      renderNotifications();
      closePopovers();
      audio.select();
      if (notice.gameId && findGame(notice.gameId)) {
        chooseGameById(notice.gameId);
        setView('home');
        toast(`已切换至《${findGame(notice.gameId).zh || findGame(notice.gameId).name}》`);
      }
    });

    els.appearanceRow.addEventListener('click', openAppearance);
    els.soundRow.addEventListener('click', () => setSound(!state.settings.sound));
    els.fullscreenRow.addEventListener('click', () => toggleFullscreen(true));
    els.sleepRow.addEventListener('click', enterSleep);
    els.quitRow.addEventListener('click', async () => {
      const quit = await window.NovaOverlays.dialog({
        title: '退出 NOVA？',
        text: '游戏进程不会被关闭。',
        icon: 'power',
        tone: 'warning',
        actions: [
          { label: '退出', value: true, style: 'danger', icon: 'close' },
          { label: '取消', value: false }
        ]
      });
      if (quit) call('quitNow');
    });
    els.dataFolderBtn.addEventListener('click', () => call('openDataFolder'));
    els.dataFolderBtn.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        call('openDataFolder');
      }
    });

    if (els.appearanceClose) {
      els.appearanceClose.addEventListener('click', () => closeAppearance());
    }
    els.appearanceOverlay.addEventListener('pointerdown', (event) => {
      if (event.target === els.appearanceOverlay) closeAppearance();
    });
    els.styleChoices.addEventListener('click', (event) => {
      const button = event.target.closest('.style-choice');
      if (!button) return;
      setStyleMode(button.dataset.style, { silent: true });
      audio.toggle();
    });
    els.typeShuffleBtn.addEventListener('click', shuffleTypeDirection);
    els.appearanceOptions.addEventListener('scroll', updateAppearanceScrollState, { passive: true });
    els.appearanceSwitcher.addEventListener('click', (event) => {
      const chip = event.target.closest('.game-chip');
      if (!chip) return;
      selectGame(Number(chip.dataset.index), { sound: true, animate: true });
    });
    els.appearanceSoundRow.addEventListener('click', () => setSound(!state.settings.sound, false));
    els.appearanceMotionRow.addEventListener('click', () => setReduceMotion(!state.settings.reduceMotion, false));
    els.appearanceCalmRow.addEventListener('click', () => setCalm(!state.settings.calm, false));
    els.calmRow.addEventListener('click', () => setCalm(!state.settings.calm));
    els.appearanceFullscreenRow.addEventListener('click', () => toggleFullscreen(false, true));
    els.fullscreenPill.addEventListener('click', () => toggleFullscreen());

    // Auto-hide the fullscreen exit pill while the pointer is still.
    document.addEventListener('pointermove', () => {
      if (!state.fullscreen) return;
      document.documentElement.classList.remove('idle');
      scheduleFullscreenIdle();
    }, { passive: true });
    els.openDataRow.addEventListener('click', () => call('openDataFolder'));

    /* editor */
    els.editorClose.addEventListener('click', () => closeEditor());
    els.editorCancel.addEventListener('click', () => closeEditor());
    els.editorOverlay.addEventListener('pointerdown', (event) => {
      if (event.target === els.editorOverlay) closeEditor();
    });
    els.editorSave.addEventListener('click', saveEditor);
    els.editorDelete.addEventListener('click', async () => {
      const game = currentGame();
      if (!game) return;
      closeEditor({ focus: false, sound: false });
      await call('deleteGame', { id: game.id });
      const index = state.games.findIndex((entry) => entry.id === game.id);
      if (index >= 0) state.games.splice(index, 1);
      if (state.index >= state.games.length) state.index = Math.max(0, state.games.length - 1);
      rebuildAfterLibraryChange(false);
      toast(`已从游戏库移除《${shortName(game)}》`, 'check');
    });
    els.fPickExe.addEventListener('click', async () => {
      const path = await window.NovaOverlays.pickerOpen({ filter: 'exe' });
      if (path) await adoptExecutable(path);
    });
    els.fExe.addEventListener('change', () => {
      const value = els.fExe.value.trim();
      if (value) adoptExecutable(value, { quiet: true });
    });
    els.fPickImage.addEventListener('click', async () => {
      const path = await window.NovaOverlays.pickerOpen({ filter: 'image' });
      if (!path) return;
      els.fImage.value = path;
      const preview = await call('readImagePreview', { path });
      if (preview && preview.ok) {
        els.editorPreviewImg.onload = () => els.editorPreviewImg.classList.add('is-loaded');
        els.editorPreviewImg.src = preview.url;
      }
      els.editorPreviewHint.textContent = '保存后会生成主视觉与封面';
    });
    [els.fName, els.fLogo].forEach((input) => input.addEventListener('input', syncEditorPreview));
    if (els.fTypeRecipe) els.fTypeRecipe.addEventListener('change', syncEditorPreview);

    /* scanner */
    els.scannerClose.addEventListener('click', () => closeScanner());
    els.scannerOverlay.addEventListener('pointerdown', (event) => {
      if (event.target === els.scannerOverlay) closeScanner();
    });
    els.scannerRescan.addEventListener('click', () => { scanSelection.clear(); startScan(); });
    els.scannerManual.addEventListener('click', () => {
      closeScanner({ focus: false, sound: false });
      openEditor();
    });
    els.scannerImport.addEventListener('click', importSelected);
    els.scannerList.addEventListener('click', (event) => {
      const row = event.target.closest('.scan-row');
      if (!row || row.disabled) return;
      toggleScanRow(row.dataset.scan);
      audio.select();
    });

    document.addEventListener('pointerdown', (event) => {
      if (event.target.closest('#notifPanel, #notifBtn, #profileMenu, #profileBtn')) return;
      closePopovers();
    }, true);

    els.rail.addEventListener('pointerover', (event) => {
      if (event.pointerType !== 'mouse' || state.overlay) return;
      const tile = event.target.closest('.tile');
      if (!tile) return;
      const index = Number(tile.dataset.index);
      if (index === state.index) return;
      clearTimeout(state.hoverTimer);
      state.hoverTimer = setTimeout(() => selectGame(index, { sound: false }), 140);
    });
    els.rail.addEventListener('pointerleave', () => clearTimeout(state.hoverTimer));
    els.rail.addEventListener('focusin', (event) => {
      const tile = event.target.closest('.tile');
      if (!tile) return;
      const index = Number(tile.dataset.index);
      if (index !== state.index) selectGame(index, { sound: false, scroll: true });
    });
    els.rail.addEventListener('click', (event) => {
      const tile = event.target.closest('.tile');
      if (!tile) return;
      clearTimeout(state.hoverTimer);
      selectGame(Number(tile.dataset.index), { sound: true, scroll: true });
    });
    els.rail.addEventListener('keydown', (event) => {
      if ((event.key === 'Enter' || event.key === ' ') && event.target.closest('.tile')) {
        event.preventDefault();
        event.stopPropagation();
        handlePrimary();
      }
    });
    els.rail.addEventListener('wheel', (event) => {
      if (state.overlay) return;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (Math.abs(delta) < 3) return;
      event.preventDefault();
      const now = performance.now();
      if (now < state.wheelLock) return;
      state.wheelLock = now + 260;
      selectGame(state.index + (delta > 0 ? 1 : -1), { sound: true, scroll: true });
    }, { passive: false });

    document.addEventListener('fullscreenchange', syncFullscreenLabels);
  }

  function initParallax() {
    if (state.settings.reduceMotion) return;
    if (state.system && state.system.tier !== 'full') return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    let frame = null;
    let targetX = 0;
    let targetY = 0;
    window.addEventListener('pointermove', (event) => {
      if (state.overlay || state.settings.reduceMotion) return;
      targetX = (event.clientX / window.innerWidth - .5) * -14;
      targetY = (event.clientY / window.innerHeight - .5) * -8;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        els.sceneStack.style.transform = `translate3d(${targetX}px, ${targetY}px, 0) scale(1.02)`;
        frame = null;
      });
    });
  }

  /* ============================================================
     BOOT
     ============================================================ */

  function applyBoot(boot) {
    state.games = Array.isArray(boot.games) ? boot.games : [];
    state.settings = {
      playername: boot.settings?.playername || boot.userName || '玩家',
      avatarFile: boot.settings?.avatarFile || null,
      sound: boot.settings?.sound !== false,
      reduceMotion: boot.settings?.reduceMotion === true,
      styleMode: boot.settings?.styleMode === 'system' ? 'system' : 'adaptive',
      typeSeed: Number.isFinite(boot.settings?.typeSeed) ? boot.settings.typeSeed : 0,
      calm: boot.settings?.calm === true,
      theme: boot.settings?.theme || 'nova',
      layout: boot.settings?.layout === 'rail' ? 'rail' : 'row',
      closeToTray: boot.settings?.closeToTray === true,
      autoBackup: boot.settings?.autoBackup !== false,
      librarySort: boot.settings?.librarySort || 'recent',
      compatibilityTier: boot.settings?.compatibilityTier || 'auto',
      developerMode: boot.settings?.developerMode === true
    };
    state.developerMode = boot.developerMode === true;
    state.developerModeEnv = boot.developerModeEnv === true;
    state.system = boot.system || null;
    applySystemTier(state.system);
    state.userName = boot.userName || '';
    state.stats = boot.stats || null;
    state.storage = boot.storage || null;
    state.dataFolder = boot.dataFolder || '';
    state.backupsFolder = boot.backupsFolder || '';
    state.version = boot.version || '1.5.3';
    if (els.libSort) els.libSort.value = state.settings.librarySort;
    if (els.profileVersion) els.profileVersion.textContent = `${state.version} · 桌面版`;
    state.running = new Map();
    (boot.running || []).forEach((session) => state.running.set(session.gameId, session));

    const currentId = boot.currentGameId;
    const index = state.games.findIndex((game) => game.id === currentId);
    state.index = index >= 0 ? index : 0;

    els.profileName.textContent = state.settings.playername;
    syncAvatarImages();
    els.appearanceDataPath.textContent = state.dataFolder;
    els.appearanceDataPath.title = state.dataFolder;
  }

  async function init() {
    syncMotionUI();
    updateClock();
    setInterval(updateClock, 1000);
    setInterval(refreshLive, 30000);
    setInterval(() => {
      if (state.overlay === 'launch') {
        const game = currentGame();
        if (game && state.running.has(game.id) && els.launchOverlay.classList.contains('is-ready')) {
          els.launchStatus.textContent = '游戏正在运行';
        }
      }
    }, 4000);

    let boot = null;
    if (hasBridge) {
      boot = await call('boot');
    }

    if (boot && boot.ok !== false) {
      applyBoot(boot);
    } else {
      state.games = [];
    }

    buildBackdrop();
    buildRail();
    buildAppearanceSwitcher();
    bindEvents();
    bindKeyboard();

    if (window.NovaOverlays) {
      window.NovaOverlays.bind({ app: els.app, sound: audio, call });
    }

    // Themes load asynchronously. The opening waits for the theme list and
    // its stylesheet so the saved theme owns the first frame; the fallback
    // only exists so a broken theme can never hold the shell hostage.
    const themesReady = startThemes().catch((error) => console.warn('theme boot failed', error));
    bindNativeGuards();
    bindContextMenu();
    bindThemePanel();
    bindSettings();

    document.body.classList.toggle('is-empty', !state.games.length);
    applyAccent(currentGame());
    renderHero(currentGame(), false);
    applyStyleModeUI();
    syncSoundUI();
    syncFullscreenLabels();
    renderNotifications();
    syncInputStatus(null);
    setNav('home');
    document.title = currentGame() ? `${currentGame().zh || currentGame().name} · NOVA 游戏空间` : 'NOVA · 游戏空间';

    if (hasBridge) {
      call('fullscreenState').then((result) => {
        if (result) applyFullscreenState(!!result.fullscreen);
      });
    }

    if (currentGame()) setBackdrop(currentGame(), true);

    setTimeout(() => { audio.warm(); }, 1500);
    setTimeout(ensureActiveTileVisible, 140);
    initParallax();
    startGamepad();
    setTimeout(refitLogos, 500);
    setTimeout(() => setNav(document.documentElement.dataset.view || 'home'), 240);

    /* Opening ritual: the theme may name a preset ("intro": "ink").
       If themes are slow, the default preset starts and the shell is
       never held hostage by a stylesheet. */
    const introPreset = Promise.race([
      themesReady.then(() => {
        const theme = window.NovaTheme ? window.NovaTheme.find(state.theme) : null;
        return (theme && theme.intro) || 'gilded';
      }),
      new Promise((resolve) => setTimeout(() => resolve('gilded'), 2500))
    ]);

    introPreset.then((preset) => {
      if (!window.NovaIntro) {
        document.body.classList.add('is-booted');
        return;
      }
      if (state.system && state.system.tier === 'safe') {
        document.body.classList.add('is-booted');
        return;
      }
      return window.NovaIntro.play({ intro: preset }).then(() => {
        ensureActiveTileVisible();
        refitLogos();
        if (!hasBridge) {
          toast('未检测到桌面宿主，正在以预览模式运行', 'info');
        } else if (!state.games.length) {
          setTimeout(() => toast('游戏库是空的 · 按 A 或点击 + 添加游戏', 'spark'), 500);
        }
      });
    });

    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        refitLogos();
        updateAppearanceScrollState();
        ensureActiveTileVisible();
        setNav(document.documentElement.dataset.view || 'home');
      }, 160);
    }, { passive: true });

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        refitLogos();
        setNav(document.documentElement.dataset.view || 'home');
      }).catch(() => {});
    }
  }

  // Dev-only hook for the headless capture tool (tools/export-all.js).
  // Layout bugs hide at the edges of real data, so the tool needs to push
  // hostile input (a 30-character title, a badge gutter, an empty library)
  // through the *real* render path instead of editing the DOM behind it.
  // 34 characters: 30 as the rule requires, plus redundancy for the badge gutter.
  const LONG_TITLE_STRESS = '沉睡的法则 THINGS AS THEY ARE 终章';
  // stressTitle() overwrites the selected game's real name, so the restore path
  // has to remember it: a QA run must be able to leave the app exactly as it
  // found it, or a later capture silently shows the hostile title.
  const stressBackup = new Map();
  function devStressTitle(text) {
    const game = state.games[state.index];
    const restore = text == null || text === false;
    const value = restore ? '' : String(text || LONG_TITLE_STRESS);
    if (game) {
      if (restore) {
        const prev = stressBackup.get(game.id);
        if (prev) {
          game.logo = prev.logo;
          game.name = prev.name;
          stressBackup.delete(game.id);
        }
      } else {
        if (!stressBackup.has(game.id)) stressBackup.set(game.id, { logo: game.logo, name: game.name });
        game.logo = value;
        game.name = value;
      }
      renderHero(game, false);
    } else if (!restore) {
      setLogo(els.gameLogo, null, 'hero-logo', { text: value });
    }
    if (els.detailLogo) setLogo(els.detailLogo, game, 'detail-logo', restore ? {} : { text: value });
    refitLogos();
    return {
      text: game ? game.logo : value,
      length: (game ? game.logo : value).length,
      fit: els.gameLogo ? els.gameLogo.style.getPropertyValue('--logo-fit') : ''
    };
  }

  function devClearSelection() {
    state.games.splice(0, state.games.length);
    state.index = 0;
    renderHero(null, false);
    renderLibrary();
    return state.games.length;
  }

  window.NovaDev = {
    stressTitle: devStressTitle,
    clearSelection: devClearSelection,
    refit: refitLogos,
    // Headless capture support. The nav buttons deliberately refuse to switch
    // views while any surface is open (`if (state.overlay) return`), and a
    // screenshot tool drives the DOM directly, so it can walk away leaving
    // state.overlay set — after which every later view switch is silently
    // ignored and the tool captures the wrong screen (the appearance-only
    // widgets came out empty for exactly this reason). One call puts the app
    // back to "home view, nothing open" without touching anything visual.
    resetSurfaces() {
      if (window.NovaSurfaces) {
        window.NovaSurfaces.ids.forEach((id) => {
          try { window.NovaSurfaces.close(id, { focus: false }); } catch (error) { /* already closed */ }
        });
      }
      state.overlay = null;
      state.view = null;
      setView('home', { force: true });
      setNav('home');
      updateAppearanceScrollState?.();
      return 'ok';
    },
    state
  };

  init();
})();
