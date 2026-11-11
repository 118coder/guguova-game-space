/* ============================================================
   APP PART 24 · context —— 右键菜单（定位被右键的游戏）+ 清单采纳 MANIFEST ADOPTION
   这是 src/app/ 分片之一：由 tools/build-app.js 按文件名序拼回 src/app.js。
   所有分片共享同一个 IIFE 闭包（跨分片直接引用函数与 state）。
   改代码请改分片，改完运行 node tools/build-app.js；直接编辑 app.js 会被覆盖。
   ============================================================ */

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

    // Right-clicking a theme card adds its preview to the normal menu instead
    // of replacing it: the page-level actions still apply there.
    const themeCard = target.closest('.theme-card[data-theme]');
    const themeId = themeCard ? themeCard.dataset.theme : null;

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

    // Right-clicking a library card or a rail tile scopes the game entries to
    // THAT game: without this the menu answered with the current game, so
    // every "游戏详情" opened the same title no matter which card was clicked.
    const libCard = target.closest('.lib-card[data-game]');
    const railTile = target.closest('.tile[data-index]');
    const scopedGame = libCard
      ? findGame(libCard.dataset.game)
      : railTile
        ? state.games[Number(railTile.dataset.index)] || null
        : null;
    /* Inside the library the menu answers for the card under the cursor and
       nothing else. Falling back to the home selection opened a different
       game from the one you were pointing at — or a hidden one — whenever the
       grid's empty space was right-clicked (§1.41.5). */
    const inLibrary = state.view === 'library';
    /* The detail sheet is already that game's page: an entry that reopens the
       same sheet can only be a dead no-op, so it is left out there. */
    const inDetails = state.overlay === 'details';
    const gameForMenu = scopedGame || (inLibrary ? null : currentGame());

    const theme = window.NovaTheme && window.NovaTheme.find(state.theme);
    items.push({ label: theme ? `界面主题 · ${theme.name}` : '界面主题', icon: 'spark', action: openAppearance });
    if (!inDetails) {
      items.push({
        label: '游戏详情',
        icon: 'info',
        action: () => {
          if (scopedGame && scopedGame.id !== currentGame()?.id) chooseGameById(scopedGame.id, { sound: false });
          openDetails();
        },
        disabled: !gameForMenu
      });
    }
    items.push({ label: '在资源管理器中显示', icon: 'folder', action: () => gameForMenu && call('revealGame', { id: gameForMenu.id }), disabled: !gameForMenu?.exists });
    if (themeId && window.NovaTheme) {
      const card = window.NovaTheme.find(themeId);
      const active = window.NovaTheme.activeId === themeId;
      items.push({
        label: `播放「${card.name}」启动动画`,
        icon: 'play',
        action: () => previewThemeIntro(themeId)
      });
      items.push({
        label: active ? '正在使用这套主题' : '使用这套主题',
        icon: 'check',
        disabled: active,
        action: () => applyTheme(themeId)
      });
    }
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

  /** A file dropped on the window (the host resolves paths — the page cannot)
   * lands here: open the editor with everything prefilled. */
  function onDropImport(payload) {
    if (!payload || payload.ok === false) {
      toast(payload?.error || '没有找到可执行文件', 'alert');
      audio.error();
      return;
    }
    if (state.overlay && state.overlay !== 'scanner' && state.overlay !== 'details' && state.overlay !== 'import') {
      toast('请先关闭当前窗口，再添加游戏', 'info');
      return;
    }
    if (state.overlay === 'scanner') closeScanner({ focus: false, sound: false });
    if (state.overlay === 'details') closeDetails({ focus: false, sound: false });

    openEditor();
    adoptExecutable(payload.exePath, { quiet: true });
    if (payload.workDir) els.fWorkDir.value = payload.workDir;
    syncEditorPreview();
    toast('已从拖入的文件预填 · 确认后入库', 'spark');
  }

