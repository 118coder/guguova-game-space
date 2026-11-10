/* ============================================================
   APP PART 14 · library —— 游戏库列表 —— 筛选/排序/类型/隐藏、卡片渲染与 live 原地修补
   这是 src/app/ 分片之一：由 tools/build-app.js 按文件名序拼回 src/app.js。
   所有分片共享同一个 IIFE 闭包（跨分片直接引用函数与 state）。
   改代码请改分片，改完运行 node tools/build-app.js；直接编辑 app.js 会被覆盖。
   ============================================================ */

  /* ============================================================
     LIBRARY
     ============================================================ */

  function filterGames() {
    const query = state.libQuery.trim().toLowerCase();
    return state.games.filter((game) => {
      // Hidden entries live only in the dedicated 隐藏 view; every other
      // tab (and search) pretends they do not exist.
      if (state.libFilter === 'hidden') {
        if (!game.hidden) return false;
      } else if (game.hidden) {
        return false;
      }
      if (state.libFilter === 'recent' && !game.lastPlayedUtc) return false;
      if (state.libFilter === 'favorite' && !game.favorite) return false;
      if (state.libFilter === 'platform' && !isPlatformGame(game)) return false;
      if (state.libFilter === 'missing' && game.exists) return false;
      if (state.libGenre && !gameTypes(game).includes(state.libGenre)) return false;
      if (query) {
        const haystack = `${game.zh} ${game.name} ${(game.genres || []).join(' ')} ${game.genre || ''}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }

  /** Real genre tags: the platform-written pseudo genres ("Steam") are
      labels for the source, not types the player filters on. */
  function gameTypes(game) {
    const raw = (game.genres && game.genres.length ? game.genres : (game.genre ? [game.genre] : []));
    return raw.map((value) => String(value || '').trim())
      .filter((value) => value && PLATFORM_LABELS[value.toLowerCase()] === undefined);
  }

  function libraryTypeOptions() {
    const set = new Set();
    state.games.forEach((game) => gameTypes(game).forEach((type) => set.add(type)));
    return [...set].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  }

  /** Keeps the toolbar type filter's options in step with the library. The
      option list is only rewritten when the set actually changed, so an open
      nova-select menu is never clobbered mid-interaction. */
  function syncLibraryGenreFilter() {
    if (!els.libGenre) return;
    const options = libraryTypeOptions();
    const signature = options.join('\u0001');
    if (els.libGenre.dataset.options !== signature) {
      els.libGenre.dataset.options = signature;
      els.libGenre.innerHTML = '<option value="">全部类型</option>' +
        options.map((type) => `<option value="${esc(type)}">${esc(type)}</option>`).join('');
    }
    els.libGenre.value = state.libGenre;
    // A type that no longer exists in the library resets the filter instead
    // of silently matching nothing.
    if (els.libGenre.value !== state.libGenre) {
      state.libGenre = '';
      els.libGenre.value = '';
    }
  }

  /* The per-card live bits, shared by the full render and the 30s live
     patch so the two can never drift apart. */
  function libraryBadgesHTML(game, featured) {
    const badges = [];
    if (featured) badges.push('<span class="lib-current">CURRENT</span>');
    let platformShown = false;
    if (state.running.has(game.id)) badges.push('<span class="lib-badge live">运行中</span>');
    else if (!game.exists) badges.push('<span class="tile-badge offline">程序缺失</span>');
    else if (isPlatformGame(game)) {
      badges.push(`<span class="tile-badge">${esc(platformShort(game))}</span>`);
      platformShown = true;
    }

    // Info tags after the state row: 平台 → 类型 → 模式, as many as the
    // player allows in settings (default all three). The platform badge
    // above IS the platform tag; 手动添加的游戏没有平台标记，标签自然少一个。
    const count = Math.min(3, Math.max(1, Number(state.settings.libraryTagCount) || 3));
    let used = platformShown ? 1 : 0;
    if (used < count) {
      const type = gameTypes(game)[0] || '';
      if (type) {
        badges.push(`<span class="tile-badge tag">${esc(type)}</span>`);
        used += 1;
      }
    }
    if (used < count && game.mode) {
      badges.push(`<span class="tile-badge tag">${esc(game.mode)}</span>`);
    }
    return badges.join('');
  }

  function librarySubHTML(game) {
    return `${esc((game.genres && game.genres[0]) || game.genre || '游戏')} · ${state.running.has(game.id) ? '运行中' : formatHoursShort(game.playtimeSeconds)}`;
  }

  function libraryProgressPct(game) {
    return playtimePct(game.playtimeSeconds);
  }

  function renderLibrary() {
    const totalSeconds = state.games.reduce((sum, game) => sum + (game.playtimeSeconds || 0), 0);
    const favorites = state.games.filter((game) => game.favorite).length;
    const platformCount = state.games.filter(isPlatformGame).length;
    const missingCount = state.games.filter((game) => !game.exists).length;

    els.libStats.innerHTML = `
      <span><b>${state.games.length}</b> 款游戏</span>
      <span class="lib-sep"></span>
      <span>累计 <b>${formatHoursShort(totalSeconds)}</b></span>
      <span class="lib-sep"></span>
      <span><b>${platformCount}</b> 款来自平台</span>
      <span class="lib-sep"></span>
      <span><b>${favorites}</b> 款收藏</span>
      ${missingCount ? `<span class="lib-sep"></span><span><b>${missingCount}</b> 款程序缺失</span>` : ''}
    `;

    $$('.filter', els.libFilters).forEach((button) => {
      button.classList.toggle('is-active', button.dataset.filter === state.libFilter);
    });
    if (els.libSort) els.libSort.value = state.settings.librarySort || 'recent';
    syncLibraryGenreFilter();

    const list = filterGames();
    const sort = state.settings.librarySort || 'recent';
    const dir = sortDir(sort);
    const sign = dir === 'desc' ? -1 : 1;
    syncSortDirection(dir);

    // Every comparator below is written ascending; `sign` turns it around.
    // Ties return 0 in both directions and Array#sort is stable, so entries a
    // field cannot tell apart keep the library's own order — flipping the
    // arrow never reshuffles the ties.
    const timeOf = (value) => (value ? new Date(value).getTime() : 0);
    if (sort === 'name') {
      // Natural order: 第二季 → 第三季 → … → 第十季, 第四章 before 第十章.
      list.sort((a, b) => sign * compareNames(a.zh || a.name || '', b.zh || b.name || ''));
    } else if (sort === 'playtime') {
      list.sort((a, b) => sign * ((a.playtimeSeconds || 0) - (b.playtimeSeconds || 0)));
    } else if (sort === 'added') {
      list.sort((a, b) => sign * String(a.addedUtc || '').localeCompare(String(b.addedUtc || '')));
    } else if (sort === 'launches') {
      list.sort((a, b) => sign * ((a.launchCount || 0) - (b.launchCount || 0)));
    } else {
      list.sort((a, b) => sign * (timeOf(a.lastPlayedUtc) - timeOf(b.lastPlayedUtc)));
    }
    if (state.games.length === 0) {
      els.libGrid.style.display = 'none';
      els.libEmpty.hidden = false;
      els.libEmptyTitle.textContent = '游戏库还是空的';
      els.libEmptyText.textContent = '自动扫描已安装的平台，或手动添加一个游戏程序。';
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
      const pct = libraryProgressPct(game);
      const tier = progTierAttrs(game);
      const displayName = shortName(game);
      const showLatin = !!game.name
        && displayName.trim().toLowerCase() !== game.name.trim().toLowerCase()
        && displayName.trim().length <= 10;
      // A very long Latin subtitle would be clipped by the card width.
      // Hide the redundant subtitle instead of truncating it.
      const longName = (displayName.length + (game.name || '').length) > 22
        || (game.name || '').length > 16;

      // The favourite toggle lives INSIDE .lib-art (bottom-left of the
      // artwork, where the player asked for it) as a span[role=button] — a
      // <button> cannot nest another button, and the grid click delegation
      // routes .lib-fav to the toggle before the card branch can open
      // details.
      return `
        <div class="lib-cell">
          <button class="lib-card${featured ? ' is-featured' : ''}${longName ? ' is-long-name' : ''}" data-game="${game.id}" style="animation-delay:${Math.min(index * 34, 240)}ms" aria-label="${esc(game.zh || game.name)}">
            <div class="lib-art">
              <img src="${esc(game.coverUrl)}" alt="" loading="lazy" draggable="false" style="object-position:${esc(game.coverPosition)}">
              <div class="lib-badges">${libraryBadgesHTML(game, featured)}</div>
              <span class="lib-open" aria-hidden="true"><svg class="ic"><use href="#i-arrow-up-right"/></svg></span>
              ${game.exists ? `<div class="lib-progress${tier.max}"${tier.attrs}><i style="width:${pct}%"></i></div>` : ''}
              <span class="lib-fav${game.favorite ? ' is-on' : ''}" data-fav="${game.id}" role="button" tabindex="0"
                    aria-pressed="${!!game.favorite}" aria-label="${game.favorite ? '取消收藏' : '收藏'}"
                    title="${game.favorite ? '取消收藏' : '收藏'}">
                <svg class="ic" aria-hidden="true"><use href="#i-heart"/></svg>
              </span>
            </div>
            <div class="lib-info">
              <div class="lib-name-row">
                <span class="lib-name${showLatin ? '' : ' is-solo'}">${esc(displayName)}</span>
                ${showLatin ? `<span class="lib-en">${esc(game.name)}</span>` : ''}
              </div>
              <div class="lib-sub">${librarySubHTML(game)}</div>
            </div>
          </button>
        </div>
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
