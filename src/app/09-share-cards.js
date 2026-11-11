/* ============================================================
   APP PART 09 · share-cards —— 分享卡片 —— 相机键三规格画布（poster/dossier/score）、导出与弹窗
   这是 src/app/ 分片之一：由 tools/build-app.js 按文件名序拼回 src/app.js。
   所有分片共享同一个 IIFE 闭包（跨分片直接引用函数与 state）。
   改代码请改分片，改完运行 node tools/build-app.js；直接编辑 app.js 会被覆盖。
   ============================================================ */

  /* ============================================================
     SHARE CARDS — the camera button's real job
     ------------------------------------------------------------
     The camera used to export the current page and nothing else,
     which is a debugging tool wearing a share button's icon. It now
     opens a picker with three fixed-size cards:

       poster   1600×900   full-bleed cover, giant hours
       dossier  1200×1500  framed cover above a record sheet
       score    1600×840   cover panel + milestone scoreboard

     One DOM tree, three layouts, and all materials come from the
     active theme (--sc-*), so an exported card looks like it came
     out of the app it was taken from. The page-long screenshot is
     still reachable from the same dialog, one level down.
     ============================================================ */

  const SHARE_VARIANTS = [
    { id: 'poster', name: '封面海报', size: '1600 × 900', note: '全幅封面压巨型时长，横屏与动态最抓眼' },
    { id: 'dossier', name: '档案卡', size: '1200 × 1500', note: '带画框的封面加资料栏，竖版长图' },
    { id: 'score', name: '战绩卡', size: '1600 × 840', note: '时长与里程碑当主角，专门晒进度' }
  ];
  const SHARE_SIZES = { poster: [1600, 900], dossier: [1200, 1500], score: [1600, 840] };

  let shareVariant = 'poster';
  let shareExportJob = null;
  /** Live framing of the card on screen: { x, y, zoom }. Null until a card is
   *  rendered; the dialog seeds it from the game's own card/hero numbers. */
  let shareFraming = null;

  /** 14.5 / 132 — the number only; the unit is set in type. */
  function shareHourText(seconds) {
    const hours = Math.max(0, seconds || 0) / 3600;
    if (hours < 0.1) return '0';
    if (hours < 100) return hours.toFixed(1);
    return String(Math.round(hours));
  }

  function shareAddedText(game) {
    const at = new Date(game.addedUtc || '');
    if (!at || Number.isNaN(at.getTime())) return '本机';
    return `${at.getFullYear()}.${String(at.getMonth() + 1).padStart(2, '0')}`;
  }

  function shareDateText() {
    const now = new Date();
    return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
  }

  /** The one line that makes the card worth posting: where the clock is. */
  function shareTierText(seconds) {
    const tier = playtimeTierIndex(seconds);
    if (tier >= PLAYTIME_TIERS.length) return `里程碑 ${tier} / ${PLAYTIME_TIERS.length} · 已达最终阶段`;
    return `里程碑 ${tier} / ${PLAYTIME_TIERS.length} · 下一阶段 ${PLAYTIME_TIERS[tier]} 小时`;
  }

  function shareGenres(game) {
    const list = (game.genres && game.genres.length ? game.genres : [game.genre || ''])
      .filter(Boolean)
      .filter((genre) => PLATFORM_LABELS[String(genre).toLowerCase()] === undefined)
      .filter((genre) => !(isPlatformGame(game) && String(genre).toLowerCase() === game.source));
    if (!list.length) return [];
    return list.slice(0, 2);
  }

  /**
   * The card itself. Same children for every variant; the stylesheet gives
   * each variant its own grid. Anything that needs a number is computed
   * here, so a theme only ever decides how it looks.
   */
  function shareCardHTML(game) {
    const variant = SHARE_VARIANTS.some((entry) => entry.id === shareVariant) ? shareVariant : 'poster';
    const art = game.heroUrl || game.coverUrl || 'assets/backdrop.jpg';
    const framing = shareFraming || shareFramingFor(game);
    const artStyle = `object-position:${framing.x}% ${framing.y}%;--sc-art-zoom:${framing.zoom}`;
    const genres = shareGenres(game);
    const tier = playtimeTierIndex(game.playtimeSeconds || 0);
    const vars = tierVarsFor(game, game.playtimeSeconds || 0);
    const tierStyle = vars.tier > 0
      ? `--prog-fill:${vars.fill};--prog-fill-soft:${vars.soft};--prog-glow:${vars.glow}`
      : '';
    const ticks = PLAYTIME_TIERS.map((_, index) => {
      const on = index < tier ? ' is-on' : (index === tier ? ' is-next' : '');
      return `<i class="${on.trim()}"></i>`;
    }).join('');
    const index = recordIndexFor(game);
    const total = state.games.length;
    const meta = [];
    genres.forEach((genre) => meta.push(`<span>${esc(genre)}</span>`));
    meta.push(`<span class="sc-age">${esc(game.ageRating || '全年龄')}</span>`);
    if (game.mode) meta.push(`<span>${esc(game.mode)}</span>`);
    const platform = isPlatformGame(game) ? platformShort(game) : '';
    const foot = [];
    foot.push(`<span>启动 ${Math.max(0, game.launchCount || 0)} 次</span>`);
    foot.push('<i></i>');
    foot.push(`<span>${game.lastPlayedUtc ? `${esc(themeWord('lastPlayed', '上次游玩'))} ${relativeTime(game.lastPlayedUtc)}` : '尚未游玩'}</span>`);
    if (game.favorite) { foot.push('<i></i>'); foot.push('<span>★ 收藏</span>'); }
    const player = (state.settings && state.settings.playername) ? state.settings.playername : '播放器';
    const zh = (game.zh || '').trim();
    const name = (game.name || '').trim();
    const showZh = zh && zh.toLowerCase() !== name.toLowerCase();

    return `
      <article class="share-card" data-variant="${variant}" data-prog-tier="${tier}" data-tint="${shareTintOn() ? '1' : '0'}"
               data-no="${String(index).padStart(2, '0')}" data-total="${String(total).padStart(2, '0')}">
        <div class="sc-art"><img src="${esc(art)}" alt="" draggable="false" style="${artStyle}"></div>
        <div class="sc-wash" aria-hidden="true"></div>
        <div class="sc-deco" aria-hidden="true"></div>
        <div class="sc-frame" aria-hidden="true"></div>

        <header class="sc-top">
          <span class="sc-brand">GUGUOVA</span>
          <span class="sc-no">No.${String(index).padStart(2, '0')} / ${String(total).padStart(2, '0')}</span>
        </header>

        <div class="sc-sheet" data-no="${String(index).padStart(2, '0')}" data-total="${String(total).padStart(2, '0')}">
          <div class="sc-main">
            <div class="sc-id">
              <div class="sc-kicker"><i></i>${esc(sourceLabel(game))}<em>·</em>${shareDateText()}</div>
              <h1 class="sc-title">${esc(name || zh || '未命名游戏')}</h1>
              ${showZh ? `<p class="sc-zh">${esc(zh)}</p>` : ''}
              ${game.tagline ? `<p class="sc-tagline">${esc(game.tagline)}</p>` : ''}
              <div class="sc-meta">${meta.join('<em>·</em>')}${platform ? `<em>·</em><span class="sc-plat">${esc(platform)}</span>` : ''}</div>
            </div>

            <div class="sc-score" style="${tierStyle}">
              <span class="sc-label">累计游玩</span>
              <div class="sc-hours"><b>${shareHourText(game.playtimeSeconds)}</b><em>小时</em></div>
              <div class="sc-ladder" aria-hidden="true">${ticks}</div>
              <span class="sc-tier">${shareTierText(game.playtimeSeconds || 0)}</span>
              <div class="sc-facts">
                <div class="sc-fact"><span>启动次数</span><b>${Math.max(0, game.launchCount || 0)}<em>次</em></b></div>
                <div class="sc-fact"><span>里程碑</span><b>${tier}<em>/ ${PLAYTIME_TIERS.length}</em></b></div>
                <div class="sc-fact"><span>${esc(themeWord('lastPlayed', '上次游玩'))}</span><b>${esc(game.lastPlayedUtc ? relativeTime(game.lastPlayedUtc) : '尚未游玩')}</b></div>
                <div class="sc-fact"><span>收录于</span><b>${esc(shareAddedText(game))}</b></div>
              </div>
            </div>
          </div>

          <footer class="sc-foot">
            ${foot.join('')}
            <span class="sc-sign">${esc(player)}<em>·</em>${shareDateText()}</span>
          </footer>
        </div>
      </article>
    `;
  }

  /* ------------------------------------------------------------
     COVER FRAMING + STYLISED COVER
     ------------------------------------------------------------
     A card crops its cover to a near-square plate while the home backdrop
     is ultrawide, so the hero crop regularly cuts the wrong thing out of
     the frame. The card therefore keeps its own numbers (cardPosition /
     cardZoom) and only falls back to the hero ones when the player has
     never touched it — old entries keep the picture they always had.

     The stylised cover is one duotone filter shared by every theme: the
     two ends of the ramp come from --sc-tint-shadow / --sc-tint-high, so
     each theme decides its own ink and the filter is written once.
     ------------------------------------------------------------ */

  const SHARE_FRAME = { x: 50, y: 45, step: 2, minZoom: 1, maxZoom: 2.4, zoomStep: .1 };

  function shareClamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function shareFramingFor(game) {
    const match = String(game.cardPosition || game.heroPosition || '')
      .match(/([\d.]+)\s*%\s+([\d.]+)\s*%/);
    const ownZoom = Number(game.cardZoom);
    const heroZoom = Number(game.heroZoom);
    const zoom = ownZoom >= SHARE_FRAME.minZoom ? ownZoom
      : (heroZoom >= SHARE_FRAME.minZoom ? heroZoom : 1);
    return {
      x: match ? shareClamp(Number(match[1]), 0, 100) : SHARE_FRAME.x,
      y: match ? shareClamp(Number(match[2]), 0, 100) : SHARE_FRAME.y,
      zoom: shareClamp(zoom, SHARE_FRAME.minZoom, SHARE_FRAME.maxZoom)
    };
  }

  /** Move the picture without rebuilding the card, so stepping feels live. */
  function paintShareFraming() {
    if (els.shareZoomValue && shareFraming) {
      els.shareZoomValue.textContent = `${Math.round(shareFraming.zoom * 100)}%`;
    }
    if (!shareFraming || !els.shareMount) return;
    const img = els.shareMount.querySelector('.sc-art img');
    if (!img) return;
    img.style.objectPosition = `${shareFraming.x}% ${shareFraming.y}%`;
    img.style.setProperty('--sc-art-zoom', String(shareFraming.zoom));
  }

  let shareFrameTimer = null;

  function scheduleShareFramingSave() {
    const game = currentGame();
    if (!game || !shareFraming) return;
    clearTimeout(shareFrameTimer);
    shareFrameTimer = setTimeout(async () => {
      shareFrameTimer = null;
      if (!shareFraming) return;
      const position = `${Math.round(shareFraming.x)}% ${Math.round(shareFraming.y)}%`;
      const zoom = Number(shareFraming.zoom.toFixed(2));
      game.cardPosition = position;
      game.cardZoom = zoom;
      if (!hasBridge) return;
      const result = await call('updateGame', { id: game.id, cardPosition: position, cardZoom: zoom });
      if (!result || !result.ok) {
        toast(result?.error || '封面取景保存失败', 'alert');
        return;
      }
      if (result.game) Object.assign(game, result.game);
    }, 420);
  }

  function stepShareFraming(action) {
    if (!shareFraming) return;
    const game = currentGame();
    if (action === 'reset') {
      if (game) {
        // Reset means "follow the hero crop again", not "jump to 50/45":
        // clearing the override is the least surprising way back.
        game.cardPosition = '';
        game.cardZoom = 0;
        if (hasBridge) call('updateGame', { id: game.id, cardPosition: '', cardZoom: 0 });
      }
      shareFraming = game ? shareFramingFor(game) : { x: SHARE_FRAME.x, y: SHARE_FRAME.y, zoom: 1 };
      paintShareFraming();
      audio.toggle();
      return;
    }
    if (action === 'left') shareFraming.x -= SHARE_FRAME.step;
    else if (action === 'right') shareFraming.x += SHARE_FRAME.step;
    else if (action === 'up') shareFraming.y -= SHARE_FRAME.step;
    else if (action === 'down') shareFraming.y += SHARE_FRAME.step;
    else if (action === 'zoom-in') shareFraming.zoom += SHARE_FRAME.zoomStep;
    else if (action === 'zoom-out') shareFraming.zoom -= SHARE_FRAME.zoomStep;
    else return;
    shareFraming.x = shareClamp(shareFraming.x, 0, 100);
    shareFraming.y = shareClamp(shareFraming.y, 0, 100);
    shareFraming.zoom = shareClamp(shareFraming.zoom, SHARE_FRAME.minZoom, SHARE_FRAME.maxZoom);
    paintShareFraming();
    scheduleShareFramingSave();
    audio.toggle();
  }

  function shareTintOn() {
    return !!(state.settings && state.settings.shareTint === true);
  }

  function syncShareTintState() {
    const on = shareTintOn();
    if (els.shareTint) els.shareTint.setAttribute('aria-checked', String(on));
    if (els.shareTintSwitch) els.shareTintSwitch.classList.toggle('on', on);
  }

  function toggleShareTint() {
    state.settings.shareTint = !shareTintOn();
    syncShareTintState();
    const card = els.shareMount && els.shareMount.querySelector('.share-card');
    if (card) card.dataset.tint = state.settings.shareTint ? '1' : '0';
    saveSettings();
    audio.select();
  }

  /** Resolve any CSS colour expression (var() included) to [r, g, b]. */
  function probeCssColor(expression, fallback) {
    const probe = document.createElement('span');
    probe.style.cssText = `position:absolute;left:-9999px;top:0;width:0;height:0;color:${expression}`;
    document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    const parts = (resolved.match(/[\d.]+/g) || []).map(Number);
    return parts.length >= 3 ? parts.slice(0, 3) : fallback;
  }

  /** Rewrite the shared duotone ramp from the active theme's two ends. */
  function applyShareTintFilter() {
    const channels = ['scDuoR', 'scDuoG', 'scDuoB'].map((id) => document.getElementById(id));
    if (channels.some((node) => !node)) return;
    const shadow = probeCssColor('var(--sc-tint-shadow, #0a0d13)', [10, 13, 19]);
    const high = probeCssColor('var(--sc-tint-high, #dfe6f2)', [223, 230, 242]);
    const mid = shadow.map((value, i) => Math.round(value + (high[i] - value) * .62));
    const stops = [shadow, mid, high];
    channels.forEach((node, channel) => {
      node.setAttribute('tableValues', stops
        .map((stop) => shareClamp(stop[channel] / 255, 0, 1).toFixed(3))
        .join(' '));
    });
  }

  function shareGameForCard() {
    const game = currentGame();
    if (!game) {
      toast('先选一款游戏再导出卡片', 'info');
      return null;
    }
    return game;
  }

  function renderShareChoices() {
    if (!els.shareChoices) return;
    els.shareChoices.innerHTML = SHARE_VARIANTS.map((variant) => `
      <button class="share-choice" type="button" role="radio"
              data-variant="${variant.id}"
              aria-selected="${variant.id === shareVariant}">
        <span class="share-choice-art" aria-hidden="true"></span>
        <span class="share-choice-copy">
          <span class="share-choice-name">${variant.name}</span>
          <span class="share-choice-note">${variant.note}</span>
          <span class="share-choice-size">${variant.size}</span>
        </span>
      </button>
    `).join('');
  }

  /** Scale the real card down into the preview box, centred both ways. */
  function fitSharePreview() {
    if (!els.shareMount || !els.shareStage) return;
    const card = els.shareMount.querySelector('.share-card');
    if (!card) return;
    const [w, h] = SHARE_SIZES[shareVariant] || SHARE_SIZES.poster;
    const style = getComputedStyle(els.shareStage);
    const availW = els.shareStage.clientWidth - parseFloat(style.paddingLeft || 0) - parseFloat(style.paddingRight || 0);
    const availH = els.shareStage.clientHeight - parseFloat(style.paddingTop || 0) - parseFloat(style.paddingBottom || 0);
    const scale = Math.max(.05, Math.min(availW / w, availH / h));
    card.style.transform = `scale(${scale})`;
    els.shareMount.style.width = `${Math.round(w * scale)}px`;
    els.shareMount.style.height = `${Math.round(h * scale)}px`;
  }

  function renderSharePreview() {
    if (!els.shareMount) return;
    const game = currentGame();
    if (!game) {
      els.shareMount.innerHTML = '';
      return;
    }
    els.shareMount.innerHTML = shareCardHTML(game);
    if (els.shareZoomValue && shareFraming) {
      els.shareZoomValue.textContent = `${Math.round(shareFraming.zoom * 100)}%`;
    }
    // The image decides the veil's job, so wait one frame for layout before
    // measuring; the card's own size is fixed, only the scale is computed.
    requestAnimationFrame(fitSharePreview);
  }

  function syncShareChoiceState() {
    if (!els.shareChoices) return;
    Array.from(els.shareChoices.querySelectorAll('.share-choice')).forEach((button) => {
      button.setAttribute('aria-selected', button.dataset.variant === shareVariant ? 'true' : 'false');
    });
  }

  function openShareDialog() {
    if (state.overlay) return;
    const game = shareGameForCard();
    if (!game) return;
    if (!hasBridge) {
      toast('导出需要桌面版', 'info');
      return;
    }
    state.lastFocus = document.activeElement;
    state.overlay = 'share';
    document.body.dataset.overlay = 'share';
    shareFraming = shareFramingFor(game);
    syncShareTintState();
    applyShareTintFilter();
    renderShareChoices();
    renderSharePreview();
    if (els.shareSubtitle) els.shareSubtitle.textContent = `《${shortName(game) || game.name}》· 选一种版式，导出为图片`;
    els.shareOverlay.classList.add('is-open');
    els.shareOverlay.setAttribute('aria-hidden', 'false');
    els.app.inert = true;
    audio.open();
    resizeInertSharePreview();
    setTimeout(() => {
      try {
        const active = els.shareChoices && els.shareChoices.querySelector('[aria-selected="true"]');
        (active || els.shareClose).focus({ preventScroll: true });
      } catch (error) {}
    }, 120);
  }

  /** Opening the dialog changes the stage size, so fit once more. */
  function resizeInertSharePreview() {
    requestAnimationFrame(() => {
      fitSharePreview();
      requestAnimationFrame(fitSharePreview);
    });
  }

  function closeShareDialog() {
    if (state.overlay !== 'share') return;
    state.overlay = null;
    els.shareOverlay.classList.remove('is-open');
    els.shareOverlay.setAttribute('aria-hidden', 'true');
    if (document.body.dataset.overlay === 'share') delete document.body.dataset.overlay;
    els.app.inert = false;
    restoreFocus();
    audio.close();
  }

  function chooseShareVariant(id) {
    if (!SHARE_VARIANTS.some((variant) => variant.id === id) || id === shareVariant) return;
    shareVariant = id;
    syncShareChoiceState();
    renderSharePreview();
    audio.select();
  }

  function finishShareExport(payload) {
    if (!shareExportJob) return;
    clearTimeout(shareExportJob.timer);
    shareExportJob = null;
    delete document.documentElement.dataset.shareExport;
    if (els.shareExportStage) els.shareExportStage.innerHTML = '';
    if (!payload || payload.ok === false) {
      const reason = payload && payload.error ? ` · ${payload.error}` : '';
      toast(`卡片导出失败${reason}`, 'alert');
      return;
    }
    toast(`已导出 ${payload.width}×${payload.height} · ${payload.folder}`, 'camera');
  }

  async function exportShareCard() {
    if (!hasBridge || shareExportJob || !els.shareExportStage) return;
    const game = currentGame();
    if (!game) return;
    const variant = shareVariant;
    audio.confirm();

    // Build the card at full size in normal flow. While the capture runs the
    // app is hidden and the document collapses to exactly the card, so the
    // host's clip (0,0 → w×h) IS the card — no viewport-width widening.
    els.shareExportStage.innerHTML = shareCardHTML(game);
    closeShareDialog();
    document.documentElement.dataset.shareExport = variant;

    await new Promise((resolve) => requestAnimationFrame(resolve));
    await settleForExport(els.shareExportStage);

    const card = els.shareExportStage.querySelector('.share-card');
    if (!card) {
      delete document.documentElement.dataset.shareExport;
      els.shareExportStage.innerHTML = '';
      return;
    }
    const width = Math.ceil(card.getBoundingClientRect().width);
    const height = Math.ceil(card.getBoundingClientRect().height);
    const background = getComputedStyle(card).backgroundColor;
    shareExportJob = {
      timer: setTimeout(() => finishShareExport({ ok: false, error: '导出超时' }), 25000)
    };
    try {
      const result = await call('capturePage', {
        view: `card-${variant}`, width, height, scale: 1, background, exact: true
      });
      if (result && result.ok === false) finishShareExport(result);
    } catch (error) {
      finishShareExport({ ok: false, error: '无法连接宿主' });
    }
  }

  const findGame = (id) => state.games.find((game) => game.id === id) || null;  const fullName = (game) => {
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

  /* ------------------------------------------------------------
     SHELF · a hidden game is off the shelf
     ------------------------------------------------------------
     Hiding a title removed it from the library grid but left it in the
     home strip, so the cover, the card band and the "46 款" count kept
     advertising a game the player had just hidden (user report). The
     array stays complete — the library filter, the detail sheet and
     every index lookup depend on it — but nothing on the home page is
     drawn from a hidden entry any more.
     ------------------------------------------------------------ */

  /** How many games the home shelf actually shows. */
  function shelfCount() {
    let count = 0;
    for (const game of state.games) if (!game.hidden) count += 1;
    return count;
  }

  /** Walk from `from` in `dir` and return the nearest index the shelf shows. */
  function resolveShelfIndex(from, dir) {
    const total = state.games.length;
    if (!total) return -1;
    const step = dir >= 0 ? 1 : -1;
    for (let offset = 0; offset < total; offset += 1) {
      const at = ((from + step * offset) % total + total) % total;
      if (!state.games[at].hidden) return at;
    }
    return -1;
  }

  /** The strip skips hidden entries, so a tile is found by its game index,
   *  never by its position among the children. */
  function tileForIndex(index) {
    return els.rail.querySelector(`.tile[data-index="${index}"]`);
  }

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

  /* Themes may rename a handful of fixed phrases through theme.json's
     "lexicon" block (DUSK turns "上次游玩" into "上次委托"). Unknown keys fall
     back to the shared wording, so a theme can never blank out the UI. */
  function themeWord(key, fallback) {
    try {
      const theme = window.NovaTheme ? window.NovaTheme.find(window.NovaTheme.activeId) : null;
      const value = theme && theme.lexicon ? theme.lexicon[key] : null;
      return typeof value === 'string' && value.trim() ? value.trim() : fallback;
    } catch (error) {
      return fallback;
    }
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
        unifiedSfx: !!state.settings.unifiedSfx,
        librarySort: state.settings.librarySort,
        librarySortDir: state.settings.librarySortDir || '',
        libraryTagCount: Math.min(3, Math.max(1, Number(state.settings.libraryTagCount) || 3)),
        scaleDelaySeconds: Math.min(120, Math.max(0, Number(state.settings.scaleDelaySeconds) || 0)),
        scaleMode: state.settings.scaleMode === 'factor' ? 'factor' : 'fullscreen',
        scaleFactor: Math.min(10, Math.max(1.1, Number(state.settings.scaleFactor) || 2)),
        scaleAlgorithm: state.settings.scaleAlgorithm || '',
        minimizeOnLaunch: state.settings.minimizeOnLaunch !== false,
        scalingEngine: state.settings.scalingEngine || 'auto',
        magpiePath: state.settings.magpiePath || null,
        scalingHotkey: state.settings.scalingHotkey || 3137,
        autoStartEngine: state.settings.autoStartEngine === true,
        startupFullscreen: state.settings.startupFullscreen === true,
        idlePauseMinutes: Number.isFinite(state.settings.idlePauseMinutes) ? state.settings.idlePauseMinutes : 10,
        autoCheckUpdates: state.settings.autoCheckUpdates === true,
        shareTint: state.settings.shareTint === true
      });
    }, 180);
  }

