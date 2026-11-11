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

  /* ------------------------------------------------------------
     PAINTING THE PLATE
     ------------------------------------------------------------
     object-position alone can only pan across the picture's own
     overflow, so the moment the player zooms in, the extra plate could
     no longer be nudged — and zoom-then-nudge is the first thing anyone
     tries. The transform now carries both: scale for the zoom,
     translate for the focus, measured against the real overflow so a
     drag moves the picture exactly as far as the pointer went.

     At zoom 1 the maths collapses to the old object-position result, so
     framings saved before this change look identical.
     ------------------------------------------------------------ */

  /** The plate's laid-out box and the cover-fitted image inside it. */
  function shareArtMetrics(root) {
    const scope = root || els.shareMount;
    const img = scope && scope.querySelector('.sc-art img');
    if (!img) return null;
    const cw = img.offsetWidth;
    const ch = img.offsetHeight;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    if (!cw || !ch || !nw || !nh) return null;
    const fit = Math.max(cw / nw, ch / nh);
    return { cw, ch, dw: nw * fit, dh: nh * fit };
  }

  /** How far the plate can travel at the current zoom, in card pixels. */
  function shareArtOverflow(root, zoom) {
    const metrics = shareArtMetrics(root);
    if (!metrics) return null;
    return {
      x: Math.max(0, metrics.dw * zoom - metrics.cw),
      y: Math.max(0, metrics.dh * zoom - metrics.ch)
    };
  }

  function paintShareArt(root) {
    const scope = root || els.shareMount;
    const img = scope && scope.querySelector('.sc-art img');
    if (!img || !shareFraming) return;
    const zoom = shareFraming.zoom;
    img.style.setProperty('--sc-art-zoom', String(zoom));
    const overflow = shareArtOverflow(scope, zoom);
    if (!overflow) {
      // The picture has not decoded yet: fall back to plain object-position
      // and repaint as soon as it does, so nothing jumps on screen.
      img.style.objectPosition = `${shareFraming.x}% ${shareFraming.y}%`;
      img.style.transform = `scale(${zoom})`;
      if (!img.dataset.paintBound) {
        img.dataset.paintBound = '1';
        img.addEventListener('load', () => {
          delete img.dataset.paintBound;
          paintShareArt(scope);
        }, { once: true });
      }
      return;
    }
    const tx = (50 - shareFraming.x) / 100 * overflow.x;
    const ty = (50 - shareFraming.y) / 100 * overflow.y;
    img.style.objectPosition = '50% 50%';
    img.style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${zoom})`;
  }

  /** Move the picture without rebuilding the card, so dragging feels live. */
  function paintShareFraming() {
    if (els.shareZoomValue && shareFraming) {
      els.shareZoomValue.textContent = `${Math.round(shareFraming.zoom * 100)}%`;
    }
    if (!shareFraming) return;
    paintShareArt();
    syncShareFrameControls();
  }

  /** Reset only lights up once the card owns a framing of its own. */
  function syncShareFrameControls() {
    const game = currentGame();
    const own = !!game && (!!String(game.cardPosition || '').trim()
      || Number(game.cardZoom) >= SHARE_FRAME.minZoom);
    if (els.shareFrameReset) els.shareFrameReset.disabled = !own;
  }

  /* ------------------------------------------------------------
     SAVING
     ------------------------------------------------------------
     Every nudge used to be silent: the card moved and that was that.
     A small state word next to the zoom value says whether the number
     on screen is already in the library file.
     ------------------------------------------------------------ */

  let shareFrameTimer = null;

  function setShareSaveState(mode) {
    if (!els.shareSaveState) return;
    els.shareSaveState.dataset.state = mode;
    els.shareSaveState.textContent = mode === 'dirty' ? '未保存'
      : (mode === 'saving' ? '保存中' : '已保存');
  }

  function markShareFramingDirty() {
    setShareSaveState('dirty');
  }

  function scheduleShareFramingSave() {
    const game = currentGame();
    if (!game || !shareFraming) return;
    setShareSaveState('saving');
    clearTimeout(shareFrameTimer);
    shareFrameTimer = setTimeout(async () => {
      shareFrameTimer = null;
      if (!shareFraming) return;
      const position = `${Math.round(shareFraming.x)}% ${Math.round(shareFraming.y)}%`;
      const zoom = Number(shareFraming.zoom.toFixed(2));
      game.cardPosition = position;
      game.cardZoom = zoom;
      if (!hasBridge) {
        setShareSaveState('saved');
        return;
      }
      const result = await call('updateGame', { id: game.id, cardPosition: position, cardZoom: zoom });
      if (!result || !result.ok) {
        setShareSaveState('dirty');
        toast(result?.error || '封面取景保存失败', 'alert');
        return;
      }
      if (result.game) Object.assign(game, result.game);
      setShareSaveState('saved');
      syncShareFrameControls();
    }, 420);
  }

  /** Leaving the dialog or releasing a hold writes through immediately. */
  function flushShareFramingSave() {
    const game = currentGame();
    if (!game || !shareFraming) return;
    clearTimeout(shareFrameTimer);
    shareFrameTimer = null;
    const position = `${Math.round(shareFraming.x)}% ${Math.round(shareFraming.y)}%`;
    const zoom = Number(shareFraming.zoom.toFixed(2));
    if (game.cardPosition === position && Number(game.cardZoom) === zoom) {
      setShareSaveState('saved');
      return;
    }
    game.cardPosition = position;
    game.cardZoom = zoom;
    setShareSaveState('saving');
    if (!hasBridge) { setShareSaveState('saved'); return; }
    call('updateGame', { id: game.id, cardPosition: position, cardZoom: zoom }).then((result) => {
      if (result && result.ok) {
        if (result.game) Object.assign(game, result.game);
        setShareSaveState('saved');
        syncShareFrameControls();
      } else {
        setShareSaveState('dirty');
      }
    }).catch(() => setShareSaveState('dirty'));
  }

  function stepShareFraming(action, options = {}) {
    if (!shareFraming) return;
    const silent = options.silent === true;
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
      setShareSaveState('saved');
      if (!silent) audio.toggle();
      return;
    }
    const step = options.step || SHARE_FRAME.step;
    // Arrows move the picture, not the window onto it — the same direction a
    // drag goes — so the labels ("封面右移") finally match what happens.
    if (action === 'left') shareFraming.x += step;
    else if (action === 'right') shareFraming.x -= step;
    else if (action === 'up') shareFraming.y += step;
    else if (action === 'down') shareFraming.y -= step;
    else if (action === 'zoom-in') shareFraming.zoom += SHARE_FRAME.zoomStep;
    else if (action === 'zoom-out') shareFraming.zoom -= SHARE_FRAME.zoomStep;
    else return;
    shareFraming.x = shareClamp(shareFraming.x, 0, 100);
    shareFraming.y = shareClamp(shareFraming.y, 0, 100);
    shareFraming.zoom = shareClamp(shareFraming.zoom, SHARE_FRAME.minZoom, SHARE_FRAME.maxZoom);
    paintShareFraming();
    scheduleShareFramingSave();
    if (!silent) audio.toggle();
  }

  /* ------------------------------------------------------------
     HOLD TO NUDGE
     ------------------------------------------------------------
     One tap is one step, but nobody nudges a picture two percent at a
     time: holding an arrow now repeats, and the repeat speeds up as the
     hold goes on (260ms before the first repeat, easing down to 45ms),
     which is how every arrow key in every editor feels.
     ------------------------------------------------------------ */

  let shareFrameHold = null;

  function stopShareFrameHold(options = {}) {
    if (!shareFrameHold) return;
    clearTimeout(shareFrameHold.timer);
    if (shareFrameHold.button) shareFrameHold.button.classList.remove('is-holding');
    const repeated = shareFrameHold.repeated === true;
    shareFrameHold = null;
    flushShareFramingSave();
    // One tap already clicked; only a hold needs a closing note.
    if (repeated && options.silent !== true) audio.toggle();
  }

  function beginShareFrameHold(button, action) {
    stopShareFrameHold({ silent: true });
    stepShareFraming(action);
    if (action === 'reset') return;
    const hold = { button, action, timer: null, repeated: false };
    shareFrameHold = hold;
    button.classList.add('is-holding');
    let delay = 260;
    const repeat = () => {
      if (shareFrameHold !== hold) return;
      hold.repeated = true;
      stepShareFraming(action, { silent: true });
      delay = Math.max(45, Math.round(delay * .78));
      hold.timer = setTimeout(repeat, delay);
    };
    hold.timer = setTimeout(repeat, delay);
  }

  /* ------------------------------------------------------------
     DRAG THE COVER
     ------------------------------------------------------------
     Arrows are precise, dragging is fast. The plate follows the
     pointer one-to-one (card pixels, not preview pixels), so pulling
     the picture right shows what is to its left — the picture moves
     with the hand, not against it.
     ------------------------------------------------------------ */

  let shareDrag = null;
  let shareDragEndedAt = 0;

  function beginShareDrag(event) {
    if (!shareFraming || !els.shareMount || event.button !== 0) return;
    const card = els.shareMount.querySelector('.share-card');
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const overflow = shareArtOverflow(null, shareFraming.zoom);
    if (!overflow || rect.width < 2) return;
    shareDrag = {
      id: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
      acc: 0,
      overflow,
      // The preview is the real card scaled down; one preview pixel is
      // this many card pixels.
      ratio: card.offsetWidth / rect.width,
      moved: false
    };
    try { els.shareMount.setPointerCapture(event.pointerId); } catch (error) {}
  }

  function moveShareDrag(event) {
    if (!shareDrag || event.pointerId !== shareDrag.id || !shareFraming) return;
    // Incremental, not "distance from where the press started": once the
    // plate hits an edge the hand and the picture would drift apart, and
    // pulling back would feel stuck.
    const dx = (event.clientX - shareDrag.lastX) * shareDrag.ratio;
    const dy = (event.clientY - shareDrag.lastY) * shareDrag.ratio;
    shareDrag.lastX = event.clientX;
    shareDrag.lastY = event.clientY;
    shareDrag.acc += Math.abs(dx) + Math.abs(dy);
    if (!shareDrag.moved) {
      if (shareDrag.acc < 2) return;
      shareDrag.moved = true;
      els.shareMount.classList.add('is-dragging');
    }
    const overX = Math.max(1, shareDrag.overflow.x);
    const overY = Math.max(1, shareDrag.overflow.y);
    // Only the axes that actually have slack respond; the other stays put.
    if (shareDrag.overflow.x > 1) {
      shareFraming.x = shareClamp(shareFraming.x - (dx / overX) * 100, 0, 100);
    }
    if (shareDrag.overflow.y > 1) {
      shareFraming.y = shareClamp(shareFraming.y - (dy / overY) * 100, 0, 100);
    }
    paintShareFraming();
    markShareFramingDirty();
  }

  function endShareDrag(event) {
    if (!shareDrag || (event && event.pointerId !== shareDrag.id)) return;
    const moved = shareDrag.moved;
    const pointerId = shareDrag.id;
    shareDrag = null;
    if (els.shareMount) els.shareMount.classList.remove('is-dragging');
    try { els.shareMount.releasePointerCapture(pointerId); } catch (error) {}
    if (!moved) return;
    shareDragEndedAt = performance.now();
    flushShareFramingSave();
    audio.select();
  }

  /** Wheel zooms the cover; the dialog never scrolls under the pointer. */
  function zoomShareFraming(delta) {
    if (!shareFraming) return;
    const next = shareClamp(shareFraming.zoom + delta, SHARE_FRAME.minZoom, SHARE_FRAME.maxZoom);
    if (next === shareFraming.zoom) return;
    shareFraming.zoom = next;
    paintShareFraming();
    scheduleShareFramingSave();
  }

  /* ------------------------------------------------------------
     KEYBOARD
     ------------------------------------------------------------
     The dialog is a small editor, so it behaves like one: arrows nudge
     (Shift = 4×), +/- zoom, 0 or R resets, 1/2/3 switch format.
     ------------------------------------------------------------ */

  const SHARE_KEY_STEPS = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down'
  };

  function handleShareKeydown(event) {
    if (state.overlay !== 'share' || event.altKey || event.ctrlKey || event.metaKey) return false;
    const key = event.key;
    const direction = SHARE_KEY_STEPS[key];
    if (direction) {
      event.preventDefault();
      const times = event.shiftKey ? 4 : 1;
      for (let i = 0; i < times; i += 1) stepShareFraming(direction, { silent: i > 0 });
      return true;
    }
    if (key === '+' || key === '=') {
      event.preventDefault();
      stepShareFraming('zoom-in');
      return true;
    }
    if (key === '-' || key === '_') {
      event.preventDefault();
      stepShareFraming('zoom-out');
      return true;
    }
    if (key === '0' || key === 'r' || key === 'R') {
      event.preventDefault();
      stepShareFraming('reset');
      return true;
    }
    if (key === '1' || key === '2' || key === '3') {
      const target = SHARE_VARIANTS[Number(key) - 1];
      if (!target) return false;
      event.preventDefault();
      chooseShareVariant(target.id);
      return true;
    }
    if (key === 'Enter' && !(event.target && event.target.closest && event.target.closest('button'))) {
      event.preventDefault();
      exportShareCard();
      return true;
    }
    return false;
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
    if (card) {
      card.dataset.tint = state.settings.shareTint ? '1' : '0';
      const img = card.querySelector('.sc-art img');
      if (img) {
        // The filter swap cannot tween, so the plate blinks once.
        img.classList.remove('is-tinting');
        void img.offsetWidth;
        img.classList.add('is-tinting');
        setTimeout(() => img.classList.remove('is-tinting'), 360);
      }
    }
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
    // The plate is painted right away so the framing is already in place
    // when the preview appears, instead of snapping a frame later.
    paintShareArt();
    syncShareFrameControls();
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
    setShareSaveState('saved');
    updateShareExportLabel();
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
    // A hold or a drag in flight must not keep ticking behind a closed
    // dialog; the pending framing is written through before we leave.
    stopShareFrameHold({ silent: true });
    endShareDrag();
    flushShareFramingSave();
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
    updateShareExportLabel();
    audio.select();
  }

  /** The button says exactly what it will make, at what size. */
  function updateShareExportLabel() {
    if (!els.shareExportLabel) return;
    const size = SHARE_SIZES[shareVariant] || SHARE_SIZES.poster;
    els.shareExportLabel.textContent = shareExportJob
      ? '正在生成…'
      : `导出这张卡 · ${size[0]}×${size[1]}`;
  }

  function setShareExportBusy(busy) {
    if (els.shareExport) {
      els.shareExport.disabled = busy;
      els.shareExport.classList.toggle('is-busy', busy);
      els.shareExport.setAttribute('aria-busy', String(busy));
    }
    updateShareExportLabel();
  }

  /** A card can be exported before its cover has decoded; wait for it so the
   *  framing maths has real pixels to work with. */
  function shareArtReady(root) {
    const img = root && root.querySelector('.sc-art img');
    if (!img || (img.complete && img.naturalWidth)) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => resolve();
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
      setTimeout(done, 1500);
    });
  }

  function finishShareExport(payload) {
    if (!shareExportJob) return;
    clearTimeout(shareExportJob.timer);
    shareExportJob = null;
    delete document.documentElement.dataset.shareExport;
    if (els.shareExportStage) els.shareExportStage.innerHTML = '';
    setShareExportBusy(false);
    if (!payload || payload.ok === false) {
      const reason = payload && payload.error ? ` · ${payload.error}` : '';
      toast(`卡片导出失败${reason}`, 'alert');
      return;
    }
    // The file is already on disk; the toast carries the way to it, because
    // "已导出到图片文件夹" always sends people hunting through Explorer.
    toast(`已导出 ${payload.width}×${payload.height} · ${payload.folder}`, 'camera',
      payload.path ? {
        label: '打开文件夹',
        run: () => { call('revealPath', { path: payload.path }); }
      } : null);
  }

  async function exportShareCard() {
    if (!hasBridge || shareExportJob || !els.shareExportStage) return;
    const game = currentGame();
    if (!game) return;
    const variant = shareVariant;
    audio.confirm();
    setShareExportBusy(true);

    // Build the card at full size in normal flow. While the capture runs the
    // app is hidden and the document collapses to exactly the card, so the
    // host's clip (0,0 → w×h) IS the card — no viewport-width widening.
    els.shareExportStage.innerHTML = shareCardHTML(game);
    closeShareDialog();
    document.documentElement.dataset.shareExport = variant;

    await new Promise((resolve) => requestAnimationFrame(resolve));
    // The cover may still be decoding; the framing needs its pixel size.
    await shareArtReady(els.shareExportStage);
    paintShareArt(els.shareExportStage);
    await settleForExport(els.shareExportStage);

    const card = els.shareExportStage.querySelector('.share-card');
    if (!card) {
      delete document.documentElement.dataset.shareExport;
      els.shareExportStage.innerHTML = '';
      setShareExportBusy(false);
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

  /* Toasts can carry one follow-up action. A finished export is the reason:
     "已导出到图片文件夹" without a way there is just homework for the player. */
  let toastAction = null;

  function hideToast() {
    clearTimeout(state.toastTimer);
    state.toastTimer = null;
    els.toast.classList.remove('show');
  }

  function toast(message, icon = 'check', action = null) {
    if (state.overlay === 'launch' || state.overlay === 'sleep') return;
    const use = els.toast.querySelector('use');
    if (use) use.setAttribute('href', `#i-${icon}`);
    els.toastText.textContent = message;
    if (els.toastAction) {
      const usable = !!(action && action.label);
      els.toastAction.hidden = !usable;
      els.toastAction.textContent = usable ? action.label : '';
      toastAction = usable ? action : null;
    }
    els.toast.classList.add('show');
    clearTimeout(state.toastTimer);
    // An action needs long enough to be read and clicked.
    state.toastTimer = setTimeout(hideToast, action ? 7000 : 3000);
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

