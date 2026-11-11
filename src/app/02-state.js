/* ============================================================
   APP PART 02 · state —— 全局状态 state —— 库、设置、视图、选中、live 签名等单一事实源
   这是 src/app/ 分片之一：由 tools/build-app.js 按文件名序拼回 src/app.js。
   所有分片共享同一个 IIFE 闭包（跨分片直接引用函数与 state）。
   改代码请改分片，改完运行 node tools/build-app.js；直接编辑 app.js 会被覆盖。
   ============================================================ */

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
      unifiedSfx: false,
      librarySort: 'recent',
      // '' means "this mode's own reading order", so a mode the player never
      // flipped still behaves the way its name implies. See SORT_DEFAULT_DIR.
      librarySortDir: '',
      // Cover info tags (平台 → 类型 → 模式); 1–3.
      libraryTagCount: 3,
      // Seconds between "game process is up" and the scaling attempt. Some
      // titles must finish loading first, or the scale request is dropped.
      scaleDelaySeconds: 0,
      // fullscreen fills the monitor; factor magnifies the window by a chosen
      // multiplier using Magpie's windowed mode.
      scaleMode: 'fullscreen',
      scaleFactor: 2,
      // '' = follow whatever algorithm Magpie is currently set to.
      scaleAlgorithm: '',
      minimizeOnLaunch: true,
      scalingEngine: 'auto',
      magpiePath: null,
      scalingHotkey: 3137,
      autoStartEngine: false
    },
    userName: '',
    avatarStamp: 0,
    stats: null,
    storage: null,
    system: null,
    startup: null,
    startupFullscreen: false,
    steamPrivilege: null,
    steamPrivilegeMuted: false,
    steamRestartWaiter: null,
    magpie: null,
    engineOptions: null,
    fullscreen: false,
    launchHandoffScheduled: false,
    developerMode: false,
    developerModeEnv: false,
    index: 0,
    overlay: null,
    libFilter: 'all',
    libQuery: '',
    libGenre: '',
    // What the empty state's single button does: 'add' | 'clear' | 'show-hidden'.
    libEmptyAction: 'clear',
    lastFocus: null,
    toastTimer: null,
    launchTimers: [],
    // Set while the Steam client owns a launch and no process has appeared yet.
    launchPendingId: null,
    manageOpen: false,
    manageCollapsed: false,
    liveSignature: '',
    forceKill: { active: false, raf: 0, suppressClick: false },
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
    scanQuery: '',
    firstRun: false,
    importFirstRun: false,
    importMode: 'auto',
    importSummary: null,
    theme: 'nova',
    menuOpen: false,
    view: 'home',
    layout: 'row',
    editorMode: 'create',
    editorId: null,
    editorManifest: null,
    editorFraming: { x: 50, y: 45, zoom: 1 },
    appearanceEditing: false,
    hotkeyRecording: false,
    appearanceFraming: null,
    appearanceFramingGame: null,
    appearanceSaveTimers: new Map(),
    dataFolder: '',
    backupsFolder: '',
    version: '1.5.3',
    /* Update flow. Every host status message carries the run it belongs to
       (`seq`), so a slow check can never overwrite the result of a newer one;
       `0` means "nothing seen yet". */
    update: { phase: 'idle' },
    updateSeq: 0,
    updateDownloadSeq: 0
  };

  const notices = [];
  let noticeSeq = 0;

