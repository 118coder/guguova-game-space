/* ============================================================
   APP PART 25 · import —— 入库窗口 IMPORT SHEET + 扫描器 SCANNER + 库变更重建
   这是 src/app/ 分片之一：由 tools/build-app.js 按文件名序拼回 src/app.js。
   所有分片共享同一个 IIFE 闭包（跨分片直接引用函数与 state）。
   改代码请改分片，改完运行 node tools/build-app.js；直接编辑 app.js 会被覆盖。
   ============================================================ */

  /* ============================================================
     IMPORT SHEET
     Every "add a game" entry point lands here first: the top-bar +,
     the library header button, the empty library and the first-run
     prompt. Two ways in — scan what the machine already has, or pick
     an exe by hand — and the choice is remembered for the session so
     the sheet never re-opens on the wrong card.
     ============================================================ */

  const PLATFORM_LABELS = {
    steam: 'Steam',
    epic: 'Epic Games',
    gog: 'GOG',
    ubisoft: 'Ubisoft Connect',
    ea: 'EA app',
    xbox: 'Xbox',
    battlenet: '战网'
  };

  const PLATFORM_SHORT = {
    steam: 'STEAM',
    epic: 'EPIC',
    gog: 'GOG',
    ubisoft: 'UBISOFT',
    ea: 'EA',
    xbox: 'XBOX',
    battlenet: 'BATTLE.NET'
  };

  /** Which launcher owns this entry; 'manual' when nothing does. */
  function platformOf(game) {
    if (!game) return 'manual';
    return PLATFORM_LABELS[game.source] ? game.source : 'manual';
  }

  function isPlatformGame(game) {
    return platformOf(game) !== 'manual';
  }

  /** "Steam" / "Epic Games" / … / "手动添加" — the one place the UI asks. */
  function sourceLabel(game) {
    const platform = platformOf(game);
    return platform === 'manual' ? '手动添加' : PLATFORM_LABELS[platform];
  }

  function platformShort(game) {
    return PLATFORM_SHORT[platformOf(game)] || '';
  }

  function openImport(options = {}) {
    if (state.overlay) return;
    state.importFirstRun = options.firstRun === true;
    state.importSummary = null;
    state.importMode = 'auto';

    els.importKicker.textContent = state.importFirstRun ? 'FIRST RUN · LIBRARY' : 'LIBRARY · IMPORT';
    els.importTitle.textContent = state.importFirstRun ? '要把已有的游戏收进来吗？' : '添加游戏';
    els.importSub.textContent = '正在检查本机已安装的平台…';
    els.importDetected.hidden = true;
    els.importDetected.innerHTML = '';
    els.importLater.hidden = !state.importFirstRun;
    els.importAutoTag.hidden = false;

    chooseImportMode('auto', { silent: true });

    state.lastFocus = document.activeElement;
    state.overlay = 'import';
    openSurface('import');
    audio.open();
    setTimeout(() => {
      try { els.importAuto.focus({ preventScroll: true }); } catch (error) {}
    }, 120);

    loadImportSummary();
  }

  function closeImport(options = {}) {
    if (state.overlay !== 'import') return;
    const { focus = true, sound = true } = options;
    closeSurface('import');
    state.overlay = null;
    if (sound) audio.back();
    if (focus) restoreFocus();
  }

  async function loadImportSummary() {
    const summary = await call('platformSummary');
    if (state.overlay !== 'import') return;
    if (!summary || !summary.ok) {
      els.importSub.textContent = '没能读取本机平台，可以直接手动添加游戏。';
      chooseImportMode('manual', { silent: true });
      return;
    }

    state.importSummary = summary;
    const platforms = (summary.platforms || []).filter((platform) => platform.count > 0);
    const total = platforms.reduce((sum, platform) => sum + platform.count, 0);

    if (!platforms.length) {
      els.importSub.textContent = '没有检测到已安装的平台，先手动添加这款游戏吧。';
      els.importDetected.hidden = true;
      els.importAutoTag.hidden = true;
      chooseImportMode('manual', { silent: true });
      return;
    }

    // "约" is honest: the cheap probe counts manifest entries, and the full
    // scan drops the ones whose install folder or exe is gone.
    els.importSub.textContent = `检测到 ${platforms.length} 个平台，约 ${total} 款已安装游戏。`;
    els.importDetected.innerHTML = platforms.map((platform) => `
      <span class="import-platform"><span>${esc(platform.shortLabel || platform.label)}</span><b>${platform.count}</b></span>
    `).join('');
    els.importDetected.hidden = false;
    chooseImportMode('auto', { silent: true });
  }

  function chooseImportMode(mode, options = {}) {
    const next = mode === 'manual' ? 'manual' : 'auto';
    if (state.importMode === next && !options.silent) {
      audio.select();
      return;
    }
    state.importMode = next;
    const auto = next === 'auto';
    els.importAuto.classList.toggle('is-active', auto);
    els.importManual.classList.toggle('is-active', !auto);
    els.importAuto.setAttribute('aria-checked', String(auto));
    els.importManual.setAttribute('aria-checked', String(!auto));
    els.importAutoTag.hidden = !auto;
    els.importGo.textContent = auto ? '开始扫描' : '填写信息';
    els.importNote.textContent = auto
      ? '只读取已安装信息，勾选后才写入游戏库；不会移动或删除任何游戏文件。'
      : '选择 EXE 后会读取同名 nova-game.json；没有清单时用程序图标生成封面。';
    if (!options.silent) audio.select();
  }

  function advanceImport() {
    const mode = state.importMode;
    const firstRun = state.importFirstRun;
    dismissFirstRun();
    closeImport({ focus: false, sound: false });
    if (firstRun) toast('以后随时可以从右上角的 + 添加游戏', 'info');
    if (mode === 'auto') openScanner();
    else openEditor();
  }

  /** The first-run prompt is asked once. The host owns the flag so a library
   * export/import keeps the answer, and a failed call must not block the UI. */
  function dismissFirstRun() {
    if (!state.firstRun) return;
    state.firstRun = false;
    call('dismissFirstRun').catch(() => {});
  }

  /** Opens the sheet once, after the opening ritual — a modal painted over the
   * intro would fight it, and the intro is the one place that owns the screen. */
  function maybeAskFirstRun() {
    if (!state.firstRun || state.overlay) return;
    openImport({ firstRun: true });
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
    if (els.scannerSub) els.scannerSub.textContent = '正在读取各个平台的已安装游戏…';
    els.scannerList.innerHTML = '';
    if (els.scanBulk) els.scanBulk.hidden = true;
    if (els.scannerSearchRow) els.scannerSearchRow.hidden = false;
    if (els.scannerSearch) els.scannerSearch.value = '';
    state.scanQuery = '';

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

  function scanRowMatches(item, query) {
    if (!query) return true;
    return `${item.name || ''} ${item.detail || ''}`.toLowerCase().includes(query);
  }

  function renderScanResults(result, manifestScan) {
    const query = state.scanQuery.trim().toLowerCase();
    const groups = (result.groups || [])
      .map((group) => ({ ...group, items: (group.items || []).filter((item) => scanRowMatches(item, query)) }))
      .filter((group) => group.items.length);
    const shortcuts = (result.shortcuts || []).filter((item) => scanRowMatches(item, query));
    const manifests = ((manifestScan && manifestScan.items) || []).filter((item) => scanRowMatches(item, query));
    if (els.scanBulk) els.scanBulk.hidden = groups.length + shortcuts.length + manifests.length === 0;
    const totalShown = groups.reduce((sum, group) => sum + group.items.length, 0);
    els.scannerSpinner.hidden = true;
    els.scannerStatus.hidden = !(groups.length || shortcuts.length || manifests.length);

    const summary = groups.map((group) => `${group.label} ${group.items.length}`);
    if (shortcuts.length) summary.push(`快捷方式 ${shortcuts.length}`);
    if (manifests.length) summary.push(`清单 ${manifests.length}`);
    els.scannerStatusText.textContent = summary.length ? summary.join(' · ') : '没有找到可导入的游戏';

    if (!groups.length && !shortcuts.length && !manifests.length) {
      els.scannerList.innerHTML = `
        <div class="scanner-empty">
          <svg class="ic" aria-hidden="true"><use href="#i-folder"/></svg>
          <strong>没有找到可导入的游戏</strong>
          <span>${result.steamRoot ? '已读取 Steam、Epic、GOG、Ubisoft、EA、Xbox 与战网，没有识别到已安装的游戏。' : '没有检测到平台客户端，也可以手动添加任意程序。'}</span>
        </div>`;
      els.scannerImport.disabled = true;
      els.scannerImportLabel.textContent = '导入所选';
      return;
    }

    if (els.scannerSub) {
      els.scannerSub.textContent = totalShown || shortcuts.length
        ? '按平台分组；点一下勾选，再一次性入库。'
        : '扫描已安装的游戏。';
    }

    const rows = [];
    if (manifests.length) {
      rows.push(scanGroupTitle('带清单的游戏', `${manifests.length} 款`, { group: 'manifest', selectable: manifests.length }));
      manifests.forEach((item, index) => rows.push(scanManifestRow(item, index)));
    }

    groups.forEach((group) => {
      const pending = group.items.filter((item) => !item.imported);
      const imported = group.items.filter((item) => item.imported);
      // The count, not the install root: a 40-character Steam path next to the
      // platform name turned the header into a second status line.
      rows.push(scanGroupTitle(group.label, `${group.items.length} 款`, {
        group: group.id,
        selectable: pending.length,
        clientMissing: group.clientInstalled === false
      }));
      pending.forEach((item) => rows.push(scanRow(item)));
      imported.forEach((item) => rows.push(scanRow(item, true)));
    });

    if (shortcuts.length) {
      rows.push(scanGroupTitle('本机快捷方式', 'START MENU', { group: 'exe', selectable: shortcuts.length }));
      shortcuts.forEach((item, index) => rows.push(scanShortcutRow(item, index)));
    }

    els.scannerList.innerHTML = rows.join('');
    // A cover the shell cannot load must never show the browser's broken-image
    // icon; drop the <img> and the disc glyph underneath becomes the thumb.
    $$('.scan-thumb img', els.scannerList).forEach((img) => {
      img.addEventListener('error', () => img.remove(), { once: true });
    });
    updateScanSelection();
  }

  /** Group header doubles as the "select everything in this platform" control.
   * It is a real button so the pad can reach it; the label is a fixed
   * 全选 + count and the checked rows carry the state. */
  function scanGroupTitle(label, note, options = {}) {
    const group = options.group;
    const selectable = options.selectable || 0;
    let action = '';
    if (group && selectable > 0) {
      action = `<button class="scan-pick" data-pick-group="${esc(group)}" type="button" aria-pressed="false">全选 ${selectable}</button>`;
    }
    const missing = options.clientMissing ? '<i class="scan-client-missing">客户端未安装</i>' : '';
    return `<div class="scan-group-title"><span>${esc(label)}<em>${esc(note || '')}</em></span>${missing}${action}</div>`;
  }

  function scanGroupKeys(group) {
    if (group === 'exe') return (state.scan?.shortcuts || []).map((item, index) => `exe:${index}`);
    if (group === 'manifest') return (state.manifestScan?.items || []).map((item, index) => `manifest:${index}`);
    const found = (state.scan?.groups || []).find((entry) => entry.id === group);
    if (!found) return [];
    return found.items.filter((item) => !item.imported).map((item) => item.key);
  }

  function scanManifestRow(item, index) {
    const key = `manifest:${index}`;
    const checked = scanSelection.has(key);
    return `
      <button class="scan-row ${checked ? 'is-checked' : ''}" data-scan="${key}" type="button">
        <span class="scan-thumb"><svg class="ic" aria-hidden="true"><use href="#i-disc"/></svg></span>
        <span class="scan-copy">
          <span class="scan-name">${esc(item.name || '未命名')}</span>
          <span class="scan-sub">${esc(item.tagline || item.manifestPath || '')}</span>
        </span>
        <span class="scan-source">清单</span>
        <span class="scan-check"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg></span>
      </button>`;
  }

  function scanRow(item, done = false) {
    const checked = scanSelection.has(item.key);
    // The disc glyph always sits underneath: a cover that 404s (cache cleaned,
    // moved library) removes itself on error and the fallback shows instead of
    // a broken-image glyph.
    return `
      <button class="scan-row ${checked ? 'is-checked' : ''} ${done ? 'is-imported' : ''}" data-scan="${esc(item.key)}" ${done ? 'disabled' : ''} type="button">
        <span class="scan-thumb">
          <svg class="ic" aria-hidden="true"><use href="#i-disc"/></svg>
          ${item.coverUrl ? `<img src="${esc(item.coverUrl)}" alt="" loading="lazy">` : ''}
        </span>
        <span class="scan-copy">
          <span class="scan-name">${esc(item.name)}</span>
          <span class="scan-sub">${esc(item.detail || '')}</span>
        </span>
        <span class="scan-source">${esc(PLATFORM_SHORT[item.platform] || '')}</span>
        <span class="scan-check"><svg class="ic" aria-hidden="true"><use href="${done ? '#i-check' : '#i-check'}"/></svg></span>
      </button>`;
  }

  function scanShortcutRow(item, index) {
    const key = `exe:${index}`;
    const checked = scanSelection.has(key);
    return `
      <button class="scan-row ${checked ? 'is-checked' : ''}" data-scan="${key}" type="button">
        <span class="scan-thumb"><svg class="ic" aria-hidden="true"><use href="#i-gamepad"/></svg></span>
        <span class="scan-copy">
          <span class="scan-name">${esc(item.name)}</span>
          <span class="scan-sub">${esc(item.folder || '')}</span>
        </span>
        <span class="scan-source">EXE</span>
        <span class="scan-check"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg></span>
      </button>`;
  }

  /** Every row the player could add right now: pending platform entries,
   *  manifests and Start-Menu shortcuts. Imported rows never take part. */
  function scanAllKeys() {
    const keys = [];
    (state.scan?.groups || []).forEach((group) => {
      (group.items || []).forEach((item) => { if (!item.imported) keys.push(item.key); });
    });
    (state.manifestScan?.items || []).forEach((item, index) => keys.push(`manifest:${index}`));
    (state.scan?.shortcuts || []).forEach((item, index) => keys.push(`exe:${index}`));
    return keys;
  }

  /** One click covers everything importable; the next click clears it. */
  function toggleScanAll() {
    const keys = scanAllKeys();
    if (!keys.length) return;
    const all = keys.every((key) => scanSelection.has(key));
    if (all) {
      keys.forEach((key) => scanSelection.delete(key));
    } else {
      keys.forEach((key) => scanSelection.add(key));
    }
    $$('.scan-row', els.scannerList).forEach((row) => {
      if (keys.includes(row.dataset.scan)) row.classList.toggle('is-checked', !all);
    });
    updateScanSelection();
    audio.select();
  }

  function updateScanSelection() {
    els.scannerImport.disabled = scanSelection.size === 0;
    els.scannerImportLabel.textContent = scanSelection.size ? `导入所选 (${scanSelection.size})` : '导入所选';
    // Group headers keep one fixed label; the checked rows themselves are the
    // state. aria-pressed carries it for the pad and screen readers.
    $$('.scan-pick', els.scannerList).forEach((button) => {
      const group = button.dataset.pickGroup;
      const keys = scanGroupKeys(group);
      if (!keys.length) return;
      const all = keys.every((key) => scanSelection.has(key));
      button.textContent = `全选 ${keys.length}`;
      button.setAttribute('aria-pressed', String(all));
    });

    // Bulk row: same three-state contract as the group headers, but across
    // every group — and the counter shows the player what a click would do.
    if (els.scanBulk && els.scanSelectAll) {
      const total = scanAllKeys().length;
      els.scanBulk.hidden = total === 0;
      if (total) {
        // The label never changes — the checkbox is the switch. "已选 X / Y"
        // next to it tells the player what the next click will do.
        const all = scanSelection.size > 0 && scanSelection.size === total;
        els.scanSelectAll.setAttribute('aria-checked', String(all));
        els.scanSelectAllLabel.textContent = '全选';
        els.scanBulkCount.textContent = `已选 ${scanSelection.size} / ${total}`;
      } else {
        els.scanSelectAll.setAttribute('aria-checked', 'false');
        els.scanBulkCount.textContent = '已选 0 项';
      }
    }
  }

  function toggleScanRow(key) {
    if (scanSelection.has(key)) scanSelection.delete(key);
    else scanSelection.add(key);
    $$('.scan-row', els.scannerList).forEach((row) => {
      if (row.dataset.scan === key) row.classList.toggle('is-checked', scanSelection.has(key));
    });
    updateScanSelection();
  }

  function toggleScanGroup(group) {
    const keys = scanGroupKeys(group);
    if (!keys.length) return;
    const all = keys.every((key) => scanSelection.has(key));
    keys.forEach((key) => {
      if (all) scanSelection.delete(key);
      else scanSelection.add(key);
    });
    $$('.scan-row', els.scannerList).forEach((row) => {
      if (keys.includes(row.dataset.scan)) row.classList.toggle('is-checked', !all);
    });
    updateScanSelection();
    audio.select();
  }

  async function importSelected() {
    const knownIds = new Set(state.games.map((game) => game.id));
    const keys = [];
    const exePaths = [];
    const manifestItems = [];
    scanSelection.forEach((key) => {
      if (key.startsWith('exe:')) {
        const item = state.scan?.shortcuts?.[Number(key.slice(4))];
        if (item) exePaths.push(item);
      } else if (key.startsWith('manifest:')) {
        const item = state.manifestScan?.items?.[Number(key.slice(9))];
        if (item) manifestItems.push(item);
      } else if (key.includes(':')) {
        keys.push(key);
      }
    });
    if (!keys.length && !exePaths.length && !manifestItems.length) return;

    els.scannerImport.disabled = true;
    els.scannerImportLabel.textContent = '正在导入…';

    let added = 0;
    if (keys.length) {
      const result = await call('importCandidates', { keys });
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

    // A batch worth naming deserves a receipt: what landed, and how many
    // rows were skipped because they were already in the library.
    if (added > 0) {
      const names = state.games
        .filter((game) => !knownIds.has(game.id))
        .map((game) => game.zh || game.name)
        .filter(Boolean);
      if (names.length && window.NovaOverlays) {
        const head = names.slice(0, 8).join('、');
        const rest = names.length > 8 ? ` 等 ${names.length} 款` : '';
        window.NovaOverlays.dialog({
          title: `已入库 ${added} 款游戏`,
          text: `${head}${rest}`,
          icon: 'check',
          actions: [{ label: '完成', value: true, style: 'primary' }]
        });
      }
    }
  }

  /* ============================================================
     LIBRARY-CHANGED REBUILD
     ============================================================ */

  function rebuildAfterLibraryChange(resetIndex = true) {
    if (resetIndex) {
      if (!state.games.length) state.index = 0;
      else state.index = Math.max(0, Math.min(state.index, state.games.length - 1));
    }
    /* Rebuilds follow hide/unhide too, so the pointer must never rest on a
       game the shelf no longer shows — except while the detail sheet is open
       on that very game. Moving it there made the sheet's own hide switch jump
       back to "off" the moment you flipped it, because the switch reads the
       current game. The move happens on close instead (closeDetails). */
    if (!state.overlay && state.games[state.index] && state.games[state.index].hidden) {
      const nextShelf = resolveShelfIndex(state.index, 1);
      if (nextShelf >= 0) state.index = nextShelf;
    }
    buildRail();
    buildAppearanceSwitcher();
    updateRail();
    const game = currentGame();
    /* The hero follows the shelf even while the detail sheet is open. Skipping
       it there left the page showing the game the player had just hidden as
       soon as the sheet closed (user report). Only the backdrop waits, because
       repainting it under an open sheet is wasted work. */
    renderHero(game, false);
    if (game && !state.overlay) {
      // Editing can change hero framing without changing the image URL,
      // so re-apply the crop on the background layer too.
      setBackdrop(game);
    }
    document.body.classList.toggle('is-empty', shelfCount() === 0);
    if (state.view === 'library') renderLibrary();
    if (state.view === 'appearance') renderAppearance();
    if (!game) {
      els.gameLogo.textContent = 'GUGUOVA';
      els.gameTagline.textContent = '选择游戏开始。';
    }
  }

