/* ============================================================
   APP PART 13 · views —— 视图切换 VIEWS + 布局模式 LAYOUT MODE（横排/竖排）
   这是 src/app/ 分片之一：由 tools/build-app.js 按文件名序拼回 src/app.js。
   所有分片共享同一个 IIFE 闭包（跨分片直接引用函数与 state）。
   改代码请改分片，改完运行 node tools/build-app.js；直接编辑 app.js 会被覆盖。
   ============================================================ */

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
    if (state.view === 'appearance' && name !== 'appearance') setAppearanceEditing(false);
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
      refreshSteamPrivilege();
      refreshMagpieStatus();
      refreshStartupState();
      setTimeout(refitLogos, 120);
    }

    if (previous !== name) {
      if (name === 'home') audio.back();
      else audio.page();
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
