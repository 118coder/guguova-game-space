// Headless renderer host: the launcher UI with no WPF, no WebView2, no window.
//
// The renderer talks to the native host through window.chrome.webview
// (postMessage + a "response" message). This module supplies the other side of
// that contract in the page itself, so a plain headless Chromium can boot the
// real app.js with a fictional library and be driven by CDP.
//
// Why this exists: WebView2 needs an interactive desktop and a working GPU
// process; a screenshot pass that only needs pixels should not depend on
// either. Headless Chromium starts in about a second, several can run in
// parallel, and nothing here touches the player's data directory.
//
//   const host = await startHost({ width: 1439, height: 1124 });
//   const cdp = await connect({ port: host.cdpPort });
//   … drive the page …
//   await host.close();

const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const COVERS = path.resolve(ROOT, '..', '_shots', 'covers', 'jpg');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.ico': 'image/x-icon'
};

/* ------------------------------------------------------------------ server */

function startServer() {
  const server = http.createServer((request, response) => {
    let target = decodeURIComponent((request.url || '/').split('?')[0]);
    if (target === '/' || target === '') target = '/src/index.html';

    // Demo covers live outside the repo; expose them read-only for the shots.
    let file;
    if (target.startsWith('/demo/')) {
      const name = path.basename(target.slice('/demo/'.length));
      file = path.join(COVERS, name);
    } else {
      file = path.join(ROOT, target);
    }

    const relative = path.relative(ROOT, file);
    if (relative.startsWith('..') && !target.startsWith('/demo/')) {
      response.writeHead(403).end('forbidden');
      return;
    }

    fs.readFile(file, (error, data) => {
      if (error) {
        response.writeHead(404).end('not found');
        return;
      }
      response.writeHead(200, {
        'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      response.end(data);
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        port,
        origin: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(done))
      });
    });
  });
}

/* ----------------------------------------------------------------- browser */

function findBrowser() {
  const candidates = [
    process.env.NOVA_BROWSER,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForEndpoint(port, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const targets = await new Promise((resolve, reject) => {
        const request = http.get({ host: '127.0.0.1', port, path: '/json/list' }, (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => resolve(JSON.parse(body)));
        });
        request.on('error', reject);
        request.setTimeout(1200, () => request.destroy(new Error('timeout')));
      });
      if (targets.some((target) => target.type === 'page')) return;
    } catch (error) {
      // browser still starting
    }
    await wait(160);
  }
  throw new Error(`headless Chromium did not open a CDP page on :${port}`);
}

async function launchBrowser({ width, height, scale = 1, deviceScaleFactor = 1 }) {
  const browser = findBrowser();
  if (!browser) throw new Error('no Chromium found — set NOVA_BROWSER to msedge.exe or chrome.exe');

  const cdpPort = await freePort();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-headless-'));
  const args = [
    '--headless=new',
    `--remote-debugging-port=${cdpPort}`,
    '--remote-allow-origins=*',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    // Plain 2D software raster: SwiftShader is several times slower per frame
    // and this pass only needs stills. Backdrop blur is dropped separately.
    '--disable-gpu',
    '--disable-extensions',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--hide-scrollbars',
    '--force-device-scale-factor=' + deviceScaleFactor,
    `--window-size=${Math.round(width * scale)},${Math.round(height * scale)}`,
    'about:blank'
  ];

  const proc = spawn(browser, args, { stdio: 'ignore', windowsHide: true });
  proc.on('error', () => {});
  await waitForEndpoint(cdpPort);

  return {
    cdpPort,
    proc,
    async close() {
      try { proc.kill(); } catch (error) { /* already gone */ }
      await wait(220);
      try { fs.rmSync(profile, { recursive: true, force: true }); } catch (error) { /* windows lock */ }
    }
  };
}

/* ------------------------------------------------------- demo library data */

/* Six fictional entries — the same set tools/demo-covers.py draws. No real game
   artwork ever appears in a screenshot (spec rule 15). */
const DEMO_GAMES = [
  {
    id: 'demo-things', name: 'Things as They Are', zh: '沉睡的法则', slug: 'things-as-they-are',
    tagline: '一座在雾里醒来的城', genre: '叙事 · 冒险', source: 'steam', appId: '901001',
    accent: '#a4605c', accent2: '#7d4a48', glow: 'rgba(164, 96, 92, .34)', scrim: '22, 14, 14',
    playtime: 14 * 3600 + 1820, launches: 22, lastPlayed: -3
  },
  {
    id: 'demo-lullaby', name: 'Lullaby for You', zh: '噩梦摇篮：献花于你', slug: 'lullaby-for-you',
    tagline: '把花放在梦的门口', genre: '悬疑 · 视觉小说', source: 'steam', appId: '901002',
    accent: '#b3a6f0', accent2: '#7f6fd0', glow: 'rgba(179, 166, 240, .32)', scrim: '18, 16, 30',
    playtime: 6 * 3600 + 540, launches: 9, lastPlayed: -11
  },
  {
    id: 'demo-emberwaltz', name: 'Emberwaltz', zh: '星火圆舞曲', slug: 'emberwaltz',
    tagline: '三拍之后，世界重新点亮', genre: '动作 · 节奏', source: 'epic', platformId: 'Emberwaltz',
    accent: '#e08a4e', accent2: '#c25f3a', glow: 'rgba(224, 138, 78, .34)', scrim: '28, 16, 10',
    playtime: 2 * 3600 + 60, launches: 4, lastPlayed: -1
  },
  {
    id: 'demo-cobalt', name: 'Cobalt Hour', zh: '钴蓝时刻', slug: 'cobalt-hour',
    tagline: '一天里多出来的那一小时', genre: '解谜 · 平台', source: 'gog', platformId: '1252295864',
    accent: '#7fb0e8', accent2: '#4d7fbe', glow: 'rgba(127, 176, 232, .32)', scrim: '12, 18, 28',
    playtime: 9 * 3600 + 2410, launches: 15, lastPlayed: -6
  },
  {
    id: 'demo-sunroom', name: 'Sunroom', zh: '晴日小屋', slug: 'sunroom',
    tagline: '把下午留给一扇窗', genre: '模拟 · 休闲', source: 'manual',
    accent: '#c08a34', accent2: '#9a6a20', glow: 'rgba(192, 138, 52, .32)', scrim: '26, 22, 12',
    playtime: 31 * 3600 + 120, launches: 48, lastPlayed: -2,
    sessions: [
      { startedUtc: isoDaysAgo(-2), endedUtc: isoDaysAgo(-2), seconds: 5400, crashed: false },
      { startedUtc: isoDaysAgo(-3), endedUtc: isoDaysAgo(-3), seconds: 1800, crashed: true },
      { startedUtc: isoDaysAgo(-9), endedUtc: isoDaysAgo(-9), seconds: 12600, crashed: false }
    ]
  },
  {
    id: 'demo-calc', name: 'Calc Quest', zh: '计算冒险', slug: 'calc-quest',
    tagline: '每一个数字都是一扇门', genre: '益智 · 独立', source: 'battlenet', platformId: 'WTCG',
    accent: '#a0524a', accent2: '#7c3a34', glow: 'rgba(160, 82, 74, .32)', scrim: '24, 14, 12',
    playtime: 45 * 60, launches: 2, lastPlayed: null
  }
];

function isoDaysAgo(days) {
  if (days === null || days === undefined) return null;
  return new Date(Date.now() + days * 86400000).toISOString();
}

function hasCover(file) {
  try { return fs.existsSync(path.join(COVERS, file)); } catch (error) { return false; }
}

function gamePayload(game) {
  const sessions = Array.isArray(game.sessions) ? game.sessions : [];
  const hero = hasCover(`${game.slug}-hero.jpg`) ? `/demo/${game.slug}-hero.jpg` : null;
  const cover = hasCover(`${game.slug}.jpg`) ? `/demo/${game.slug}.jpg` : null;
  const platformLabel = {
    steam: 'Steam', epic: 'Epic Games', gog: 'GOG', ubisoft: 'Ubisoft Connect',
    ea: 'EA app', xbox: 'Xbox', battlenet: '战网'
  }[game.source] || '手动添加';

  return {
    id: game.id,
    name: game.name,
    zh: game.zh,
    logo: game.name.toUpperCase(),
    tagline: game.tagline,
    description: '',
    genres: game.genre.split(' · '),
    ageRating: '全年龄',
    mode: '单人',
    heroUrl: hero || '',
    coverUrl: cover || '',
    heroPosition: '50% 45%',
    heroZoom: 1,
    coverPosition: '50% 45%',
    accent: game.accent,
    accent2: game.accent2,
    glow: game.glow,
    scrim: game.scrim,
    colors: [game.accent, game.accent2, '#f3e3c3', '#251318'],
    favorite: game.id === 'demo-emberwaltz' || game.id === 'demo-sunroom',
    autoUpdate: true,
    playtimeSeconds: game.playtime,
    lastPlayedUtc: isoDaysAgo(game.lastPlayed),
    addedUtc: isoDaysAgo(-30),
    source: game.source,
    steamAppId: game.appId || null,
    launchCount: game.launches || 0,
    exists: true,
    running: false,
    exePath: `D:\\Games\\${game.slug}\\${game.name.replace(/\s+/g, '')}.exe`,
    args: '',
    workDir: `D:\\Games\\${game.slug}`,
    customLogo: false,
    typeRecipe: '',
    dna: { luma: 0.32, sat: 0.48, warmth: 0.52, edge: 0.12 },
    launchMode: 'auto',
    launchModeResolved: game.source === 'steam' ? 'steam' : (game.platformId ? 'platform' : 'direct'),
    steamRunning: true,
    steamSignedIn: true,
    steamNote: '',
    fullscreenScale: null,
    platformId: game.platformId || '',
    platformLabel,
    hasLaunchUri: !!game.platformId,
    clientInstalled: true,
    recentSessions: sessions
  };
}

function bootPayload(themes) {
  const games = DEMO_GAMES.map(gamePayload);
  return {
    ok: true,
    version: require(path.join(ROOT, 'version.json')).version,
    platform: 'win32',
    userName: 'Yuki',
    dataFolder: 'D:\\NOVA Game Space',
    backupsFolder: 'D:\\NOVA Game Space\\backups',
    developerMode: false,
    developerModeEnv: false,
    firstRun: false,
    currentGameId: games[0].id,
    settings: {
      playername: 'Yuki',
      playerNameCustom: true,
      avatarFile: null,
      sound: false,
      unifiedSfx: false,
      reduceMotion: true,
      reduceMotionSource: 'headless',
      calm: false,
      layout: 'row',
      theme: 'nova',
      styleMode: 'adaptive',
      typeSeed: 0,
      firstRunDone: true,
      closeToTray: false,
      autoBackup: true,
      developerMode: false,
      librarySort: 'recent',
      compatibilityTier: 'auto',
      minimizeOnLaunch: true,
      scalingEngine: 'auto',
      magpiePath: null,
      scalingHotkey: 3137,
      startupFullscreen: false,
      autoStartEngine: false
    },
    games,
    running: [],
    stats: {
      totalSeconds: games.reduce((sum, game) => sum + game.playtimeSeconds, 0),
      totalLaunches: games.reduce((sum, game) => sum + game.launchCount, 0),
      sessionCount: 0,
      todaySeconds: 0,
      weekSeconds: 0,
      missingCount: 0,
      topGameName: '晴日小屋',
      topGameSeconds: 31 * 3600 + 120,
      recent: []
    },
    storage: {
      root: 'D:\\NOVA Game Space',
      backups: 'D:\\NOVA Game Space\\backups',
      exports: 'D:\\NOVA Game Space\\exports',
      libraryBytes: 4096,
      mediaBytes: 12 * 1024 * 1024,
      mediaFiles: 12,
      lastBackupUtc: isoDaysAgo(-1)
    },
    // Shape of Services/SystemProfile.Info — the settings page reads these
    // labels directly, so an empty object would render "— / 未检测到".
    system: {
      tier: 'full',
      tierLabel: '完整效果',
      osLabel: 'Windows 11 23H2',
      major: 10,
      minor: 0,
      build: '22631',
      isWindows7: false,
      isWindows8: false,
      isWindows10: true,
      isWindows11: true,
      webView2Version: '131.0.2903.40',
      webView2Major: 131,
      supportColorMix: true,
      supportBackdrop: true,
      legacy: false,
      legacyBuild: false,
      notes: []
    },
    steamRoot: 'D:\\Program Files (x86)\\Steam',
    startedByWindows: false,
    themeCount: themes.length
  };
}

/* Theme manifests, read straight off disk: the renderer only needs the list the
   native host would have produced. */
function readThemes() {
  const folder = path.join(ROOT, 'themes');
  const list = [];
  let dirs = [];
  try {
    dirs = fs.readdirSync(folder, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  } catch (error) {
    return list;
  }
  dirs.forEach((entry) => {
    const manifest = path.join(folder, entry.name, 'theme.json');
    if (!fs.existsSync(manifest)) return;
    try {
      const data = JSON.parse(fs.readFileSync(manifest, 'utf8'));
      if (data.id && data.id !== entry.name) return;
      const preview = (data.preview || 'preview.png');
      // The slot mapping is what themes/<id>/interfaces.css exists for; the
      // QA harness has to serve it or every screenshot would show the shared
      // defaults instead of the theme's own surfaces.
      const interfaces = data.interfaces || 'interfaces.css';
      const hasInterfaces = fs.existsSync(path.join(folder, entry.name, interfaces));
      list.push(Object.assign({}, data, {
        id: entry.name,
        name: data.name || entry.name,
        author: data.author || '',
        version: data.version || '1.0.0',
        description: data.description || '',
        intro: data.intro || '',
        curtainMs: Number(data.curtainMs) || 420,
        pinned: Number(data.pinned) || 0,
        cssUrl: `/themes/${entry.name}/theme.css`,
        interfacesUrl: hasInterfaces ? `/themes/${entry.name}/${interfaces}` : null,
        previewUrl: fs.existsSync(path.join(folder, entry.name, preview)) ? `/themes/${entry.name}/${preview}` : '',
        base: data.base || '',
        builtIn: false,
        ok: true,
        error: '',
        tokens: data.tokens || {},
        icons: data.icons || {},
        features: data.features || {},
        sounds: data.sounds || {},
        lexicon: data.lexicon || {}
      }));
    } catch (error) {
      // A broken theme must not abort the pass; the app hides it anyway.
    }
  });
  return list;
}

/* --------------------------------------------------------------- mock bridge */

/**
 * The in-page native host. Returns a script that must be installed with
 * Page.addScriptToEvaluateOnNewDocument so it exists before app.js runs.
 */
function mockScript() {
  const themes = readThemes();
  const boot = bootPayload(themes);

  const scanGroups = [
    {
      id: 'steam', label: 'Steam', shortLabel: 'STEAM', note: '',
      items: [
        ['901001', 'Things as They Are', 'things-as-they-are', true, null],
        ['901002', 'Lullaby for You', 'lullaby-for-you', false, null],
        ['901003', 'Quiet Harbor', 'quiet-harbor', false, null],
        ['901004', 'Paper Atlas', 'paper-atlas', false, null]
      ]
    },
    {
      id: 'epic', label: 'Epic Games', shortLabel: 'EPIC', note: '',
      items: [
        ['Emberwaltz', 'Emberwaltz', 'emberwaltz', true, null],
        ['Night Signal', 'Night Signal', 'night-signal', false, null],
        ['Ledger of Rain', 'Ledger of Rain', 'ledger-of-rain', false, null]
      ]
    },
    {
      id: 'gog', label: 'GOG', shortLabel: 'GOG', note: '',
      clientInstalled: true,
      items: [
        ['1252295864', 'Cobalt Hour', 'cobalt-hour', true, null]
      ]
    },
    {
      id: 'battlenet', label: '战网', shortLabel: 'BATTLE.NET', note: '',
      clientInstalled: false,
      items: [
        ['WTCG', '炉石传说（示例）', 'hearthstone-demo', false, null]
      ]
    }
  ].map((group) => ({
    id: group.id,
    label: group.label,
    shortLabel: group.shortLabel,
    note: group.note,
    clientInstalled: group.clientInstalled !== false,
    items: group.items.map(([ownerId, name, slug, imported]) => ({
      key: `${group.id}:${ownerId}`,
      platform: group.id,
      name,
      detail: `D:\\Games\\${slug}`,
      exePath: `D:\\Games\\${slug}\\game.exe`,
      coverUrl: hasCover(`${slug}.jpg`) ? `/demo/${slug}.jpg` : null,
      heroUrl: null,
      imported,
      gameId: imported ? `demo-${slug}` : null
    }))
  }));

  const engineOptions = {
    ok: true,
    configPath: 'D:\\NOVA Game Space\\engine\\magpie\\config\\config.json',
    bundled: true,
    scalingMode: 2,
    captureMethod: 0,
    cursorScaling: 6,
    frameRateLimiterEnabled: false,
    maxFrameRate: 120,
    gameMode3d: false,
    autoStart: true,
    modes: [
      { index: 0, name: 'Lanczos', available: true, chain: 'Lanczos' },
      { index: 1, name: 'FSR', available: true, chain: 'FSR_EASU > FSR_RCAS' },
      { index: 2, name: 'Anime4K', available: true, chain: 'Anime4K_Upscale_VL > Anime4K_Restore_VL' },
      { index: 3, name: 'CuNNy', available: false, chain: 'CuNNy_2x' },
      { index: 4, name: 'Pixel', available: true, chain: 'Nearest · 1×1' }
    ]
  };

  const payload = JSON.stringify({ boot, themes, engineOptions, scanGroups });

  return `(() => {
  if (!window.chrome) window.chrome = {};

  // Freeze the wall clock before app.js reads it. Screenshots are compared
  // pixel by pixel between refactors, and a live clock would differ on every
  // run: the top bar time, the "last backup" line and the sleep screen all
  // render it. Only the QA harness gets this; the product is untouched.
  if (!window.__novaClockFrozen) {
    const FROZEN = new Date('2026-10-21T09:41:00+08:00').getTime();
    const RealDate = Date;
    class FrozenDate extends RealDate {
      constructor(...args) {
        if (args.length === 0) super(FROZEN);
        else super(...args);
      }
      static now() { return FROZEN; }
    }
    window.Date = FrozenDate;
    window.__novaClockFrozen = true;
  }

  if (window.chrome.webview) return;

  const DATA = ${payload};
  const listeners = [];

  // The renderer expects the host to answer on the same channel it posts on.
  window.chrome.webview = {
    addEventListener(type, handler) { if (type === 'message') listeners.push(handler); },
    removeEventListener(type, handler) {
      const at = listeners.indexOf(handler);
      if (at >= 0) listeners.splice(at, 1);
    },
    postMessage(raw) {
      let request;
      try { request = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (error) { return; }
      const answer = resolve(request.method, request.args || {});
      Promise.resolve(answer).then((result) => {
        const message = { data: { type: 'response', id: request.id, result } };
        listeners.forEach((handler) => { try { handler(message); } catch (error) {} });
      });
    }
  };

  function resolve(method, args) {
    switch (method) {
      case 'boot': return DATA.boot;
      case 'listThemes': return { ok: true, active: 'nova', folder: 'D:\\\\NOVA Game Space\\\\themes', themes: DATA.themes };
      case 'engineOptions': return DATA.engineOptions;
      case 'scanLibrary': return { ok: true, steamRoot: 'D:\\\\Program Files (x86)\\\\Steam', groups: DATA.scanGroups, shortcuts: [] };
      case 'platformSummary': return {
        ok: true,
        libraryCount: DATA.boot.games.length,
        platforms: [
          { id: 'steam', label: 'Steam', shortLabel: 'STEAM', count: 24 },
          { id: 'epic', label: 'Epic Games', shortLabel: 'EPIC', count: 7 },
          { id: 'gog', label: 'GOG', shortLabel: 'GOG', count: 3 },
          { id: 'ubisoft', label: 'Ubisoft Connect', shortLabel: 'UBISOFT', count: 2 },
          { id: 'ea', label: 'EA app', shortLabel: 'EA', count: 0 },
          { id: 'xbox', label: 'Xbox', shortLabel: 'XBOX', count: 1 },
          { id: 'battlenet', label: '战网', shortLabel: 'BATTLE.NET', count: 2 }
        ]
      };
      case 'scanManifests': return { ok: true, count: 0, items: [] };
      case 'steamPrivilege': return { ok: true, adminLayer: false, steamElevated: false, launcherElevated: false, needsFix: false, note: '普通权限' };
      case 'magpieStatus': return { ok: true, bundled: true, running: false, path: 'engine\\\\magpie\\\\Magpie.exe' };
      case 'startupState': return { ok: true, state: { enabled: false, pointsHere: true, command: '', exePath: '' } };
      case 'fullscreenState': return { ok: true, fullscreen: false };
      case 'windowState': return { ok: true, maximized: false };
      case 'getStats': return { ok: true, stats: DATA.boot.stats, storage: DATA.boot.storage };
      case 'getSystem': return { ok: true, system: DATA.boot.system };
      case 'syncSteamPlaytime': return { ok: true, games: [] };
      case 'getRunning': return [];
      case 'steamStatus': return { ok: true, installed: true, running: true, signedIn: true, root: DATA.boot.steamRoot };
      case 'readImagePreview': return { ok: false, error: 'headless' };
      case 'browse': return { ok: false, error: 'headless' };
      default: return { ok: true, headless: true };
    }
  }
})();`;
}

/* ------------------------------------------------------------------ facade */

async function startHost(options = {}) {
  const width = options.width || 1439;
  const height = options.height || 1124;
  const scale = options.scale || 1;
  const server = await startServer();
  const browser = await launchBrowser({
    width, height, scale,
    deviceScaleFactor: options.deviceScaleFactor || 1
  });
  return {
    origin: server.origin,
    cdpPort: browser.cdpPort,
    mockScript: mockScript(),
    async close() {
      await browser.close();
      await server.close();
    }
  };
}

module.exports = {
  startHost,
  findBrowser,
  DEMO_GAMES,
  gamePayload,
  readThemes,
  mockScript,
  ROOT
};
