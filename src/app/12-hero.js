/* ============================================================
   APP PART 12 · hero —— 首页主视觉 HERO + 选中 SELECTION + 图标带 RAIL（货架语义：隐藏游戏不参与）
   这是 src/app/ 分片之一：由 tools/build-app.js 按文件名序拼回 src/app.js。
   所有分片共享同一个 IIFE 闭包（跨分片直接引用函数与 state）。
   改代码请改分片，改完运行 node tools/build-app.js；直接编辑 app.js 会被覆盖。
   ============================================================ */

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
    const pct = playtimePct(total);
    return {
      pct,
      pctText: formatHoursShort(total),
      title: game.lastPlayedUtc ? `${themeWord('lastPlayed', '上次游玩')} ${relativeTime(game.lastPlayedUtc)}` : '还没玩过',
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
      return { label: '继续', dim: `${themeWord('lastPlayed', '上次游玩')} ${relativeTime(game.lastPlayedUtc)}` };
    }
    return { label: '就绪', dim: isPlatformGame(game) ? `${sourceLabel(game)}` : '本机' };
  }

  function metaHTML(game) {
    if (!game) return '<span>动作</span><i class="meta-dot"></i><span>冒险</span><i class="meta-dot"></i><span class="age-badge">全年龄</span>';
    const bits = [];
    // A platform import has no genre of its own; printing the fallback "游戏"
    // next to a platform badge is noise, so the badge carries the row instead.
    const genres = (game.genres && game.genres.length ? game.genres : [game.genre || ''])
      .filter((genre) => genre && PLATFORM_LABELS[genre.toLowerCase()] === undefined)
      .filter((genre) => !(isPlatformGame(game) && genre.toLowerCase() === game.source));
    if (!genres.length && !isPlatformGame(game)) genres.push('游戏');
    genres.forEach((genre) => bits.push(`<span>${esc(genre)}</span>`));
    bits.push(`<span class="age-badge">${esc(game.ageRating || '全年龄')}</span>`);
    if (game.mode) bits.push(`<span>${esc(game.mode)}</span>`);
    if (isPlatformGame(game)) bits.push(`<span class="update-badge">${esc(platformShort(game))}</span>`);
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
    if (els.homeEngineBtn) els.homeEngineBtn.hidden = !game;
    syncHeroScaleRow();
    const status = heroStatus(game);
    const logoText = game ? (game.logo || game.name || '') : 'GUGUOVA';
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
    applyTier(els.progressFill.parentElement, game);
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
    applyTier(els.questFill.parentElement, game);
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
    els.questKicker.textContent = isPlatformGame(game) ? `${sourceLabel(game)} 游戏库` : '游戏';
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
    els.questFill.style.width = `${playtimePct(game.playtimeSeconds)}%`;
  }

  /* ============================================================
     SELECTION
     ============================================================ */

  function selectGame(index, options = {}) {
    if (!state.games.length) {
      renderHero(null, false);
      return;
    }
    const total = state.games.length;
    const target = ((index % total) + total) % total;
    /* Stepping past a hidden title must land on the next one the shelf
       shows, not on the empty slot it used to occupy. */
    const dir = target === state.index ? 1 : (index > state.index ? 1 : -1);
    const wrapped = resolveShelfIndex(target, dir);
    if (wrapped < 0) {
      renderHero(null, false);
      return;
    }
    const previous = state.index;

    if (wrapped === previous) {
      if (options.scroll) centerTile(wrapped);
      if (options.sound) audio.move(1);
      if (state.view === 'appearance') renderAppearance();
      return;
    }

    state.index = wrapped;
    const game = state.games[wrapped];

    applyAccent(game);
    if (!options.initial) setBackdrop(game);
    renderHero(game, options.animate !== false);
    updateRail();
    document.title = `${game.zh || game.name} · GUGUOVA 游戏空间`;

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
    els.rail.innerHTML = state.games.map((game, index) => game.hidden ? '' : `
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

    const count = shelfCount();
    const empty = count === 0;
    els.rail.style.display = empty ? 'none' : '';
    els.railEmpty.hidden = !empty;
    els.dockCount.textContent = `${count} 款`;
  }

  function updateRail() {
    /* Iterate the tiles, not the array: hidden games have no tile, so the
       child position no longer equals the game index. */
    Array.from(els.rail.children).forEach((tile) => {
      const index = Number(tile.dataset.index);
      const game = state.games[index];
      if (!game) return;
      const active = index === state.index;
      tile.classList.toggle('is-active', active);
      tile.setAttribute('aria-current', active ? 'true' : 'false');

      let badge = '';
      if (state.running.has(game.id)) badge = '<span class="tile-badge live">运行中</span>';
      else if (!game.exists) badge = '<span class="tile-badge offline">程序缺失</span>';
      else if (isPlatformGame(game)) badge = `<span class="tile-badge">${esc(platformShort(game))}</span>`;
      const badges = $('.tile-badges', tile);
      if (badges) badges.innerHTML = badge;

      const progress = $('.tile-progress', tile);
      if (progress) {
        const pct = state.running.has(game.id) ? 100 : playtimePct(game.playtimeSeconds);
        progress.style.display = game.exists ? '' : 'none';
        applyTier(progress, game);
        const fill = $('i', progress);
        if (fill) fill.style.width = `${pct}%`;
      }

      const sub = $('.tile-sub', tile);
      if (sub) sub.textContent = state.running.has(game.id) ? '运行中' : formatHoursShort(game.playtimeSeconds);
    });
  }

  function centerTile(index) {
    const tile = tileForIndex(index);
    if (!tile) return;
    const railRect = els.rail.getBoundingClientRect();
    const tileRect = tile.getBoundingClientRect();
    const behavior = state.settings.reduceMotion ? 'auto' : 'smooth';
    // The vertical layout scrolls the same rail on Y; scrolling `left` there
    // did nothing, so the wheel changed the selection without ever revealing
    // the newly selected tile (user report).
    if (document.body.classList.contains('layout-rail')) {
      const delta = (tileRect.top + tileRect.height / 2) - (railRect.top + railRect.height / 2);
      els.rail.scrollBy({ top: delta, behavior });
      return;
    }
    const delta = (tileRect.left + tileRect.width / 2) - (railRect.left + railRect.width / 2);
    els.rail.scrollBy({ left: delta, behavior });
  }

  function ensureActiveTileVisible() {
    const tile = tileForIndex(state.index);
    if (!tile) return;
    const railRect = els.rail.getBoundingClientRect();
    const tileRect = tile.getBoundingClientRect();
    const margin = 8;
    if (document.body.classList.contains('layout-rail')) {
      if (tileRect.top < railRect.top + margin) {
        els.rail.scrollBy({ top: tileRect.top - railRect.top - margin, behavior: 'auto' });
      } else if (tileRect.bottom > railRect.bottom - margin) {
        els.rail.scrollBy({ top: tileRect.bottom - railRect.bottom + margin, behavior: 'auto' });
      }
      return;
    }
    if (tileRect.left < railRect.left + margin) {
      els.rail.scrollBy({ left: tileRect.left - railRect.left - margin, behavior: 'auto' });
    } else if (tileRect.right > railRect.right - margin) {
      els.rail.scrollBy({ left: tileRect.right - railRect.right + margin, behavior: 'auto' });
    }
  }
