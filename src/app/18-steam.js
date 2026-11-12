/* ============================================================
   APP PART 18 · steam —— Steam 提权 / Magpie 缩放引擎桥接（快捷键位域、窗口化倍数、算法写入）
   这是 src/app/ 分片之一：由 tools/build-app.js 按文件名序拼回 src/app.js。
   所有分片共享同一个 IIFE 闭包（跨分片直接引用函数与 state）。
   改代码请改分片，改完运行 node tools/build-app.js；直接编辑 app.js 会被覆盖。
   ============================================================ */

  /* ============================================================
     STEAM PRIVILEGE / MAGPIE
     ============================================================ */

  async function refreshStartupState() {
    if (!hasBridge) return null;
    const result = await call('startupState');
    if (result && result.ok) {
      state.startup = result;
      renderStartupRow();
    }
    return result;
  }

  function renderStartupRow() {
    if (!els.settingsStartupRow) return;
    const info = state.startup;
    const on = !!(info && info.enabled);
    setPrefSwitch(els.settingsStartupRow, els.settingsStartupSwitch, on);
    // Only warn when the registry entry points somewhere else; the normal
    // "enabled" case needs no explanatory line.
    const hint = els.settingsStartupHint;
    if (hint) hint.hidden = !(on && info.pointsHere === false);
  }

  function renderStartupFullscreenRow() {
    if (!els.settingsStartupFullscreenRow) return;
    const on = state.settings.startupFullscreen === true;
    setPrefSwitch(els.settingsStartupFullscreenRow, els.settingsStartupFullscreenSwitch, on);
  }

  function toggleStartupFullscreen() {
    const next = state.settings.startupFullscreen !== true;
    state.settings.startupFullscreen = next;
    saveSettings();
    renderStartupFullscreenRow();
    audio.toggle();
    toast(next ? '开机后将直接用无边框全屏打开' : '开机后按普通窗口打开', next ? 'fullscreen' : 'info');
  }

  async function toggleStartup() {
    if (!hasBridge) return;
    const info = state.startup || await refreshStartupState() || {};
    const next = !info.enabled;
    const result = await call('setStartup', { enabled: next });
    if (!result || !result.ok) {
      audio.error();
      toast(result?.error || '无法修改开机启动', 'alert');
      return;
    }
    state.startup = result.state || { enabled: next };
    renderStartupRow();
    audio.toggle();
    toast(next ? '已设为开机自动启动' : '已取消开机自动启动', next ? 'check' : 'info');
  }

  async function refreshSteamPrivilege() {
    if (!hasBridge) return null;
    const result = await call('steamPrivilege');
    if (result) {
      state.steamPrivilege = result;
      renderSteamPrivilege();
    }
    return result;
  }

  function renderSteamPrivilege() {
    if (!els.settingsSteamPrivilege) return;
    const info = state.steamPrivilege;
    if (!info || !info.installed) {
      els.settingsSteamPrivilege.hidden = true;
      return;
    }
    els.settingsSteamPrivilege.hidden = false;
    const needs = !!info.needsFix;
    if (els.settingsSteamPrivilegeTag) {
      els.settingsSteamPrivilegeTag.textContent = needs ? '需要修复' : '普通权限';
      els.settingsSteamPrivilegeTag.dataset.state = needs ? 'warn' : 'ok';
    }
    if (els.settingsSteamPrivilegeNote) els.settingsSteamPrivilegeNote.textContent = info.note || '';
    if (els.settingsSteamFix) els.settingsSteamFix.hidden = !needs;
  }

  function waitSteamRestart(timeoutMs = 60000) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (payload) => {
        if (settled) return;
        settled = true;
        if (state.steamRestartWaiter === finish) state.steamRestartWaiter = null;
        resolve(payload);
      };
      state.steamRestartWaiter = finish;
      setTimeout(() => finish(null), timeoutMs);
    });
  }

  async function runSteamRepair(restart) {
    const result = await call('fixSteamPrivilege', { restart });
    if (!result || !result.ok) {
      audio.error();
      toast(result?.error || '修复失败', 'alert');
      return null;
    }

    audio.select();
    if (!result.restarting) {
      await refreshSteamPrivilege();
      toast(result.removed ? '已移除 Steam 提权标记' : 'Steam 提权标记本来就不存在', 'check');
      return { restarted: true, removed: result.removed, message: '设置已检查' };
    }

    toast('正在重启 Steam…', 'spark');
    const done = await waitSteamRestart();
    await refreshSteamPrivilege();

    if (!done || !done.restarted) {
      await window.NovaOverlays.dialog({
        title: '请手动重启 Steam',
        text: (done && done.message) ||
          'Steam 没有完成重启。请从系统托盘的 Steam 菜单选择「退出」，再重新打开它；之后启动游戏就不会再弹 UAC 了。',
        icon: 'warning',
        tone: 'warning',
        actions: [{ label: '知道了', value: true, style: 'primary' }]
      });
      return done || { restarted: false, message: 'Steam 没有完成重启' };
    }

    toast(done.message || 'Steam 已用普通权限重启', 'check');
    return done;
  }

  /** Shown before a Steam launch when the client still demands elevation. */
  async function ensureSteamPrivilege() {
    const info = state.steamPrivilege || await refreshSteamPrivilege();
    if (!info || !info.needsFix) return true;

    const restart = !!info.steamElevated;
    const choice = await window.NovaOverlays.dialog({
      title: 'Steam 正在触发提权弹窗',
      text: `${info.note || ''} 修复会移除 Steam.exe 的「以管理员身份运行」标记${restart
        ? '，并重启一次 Steam（约 10–20 秒，可能需要重新登录）'
        : ''}。`,
      icon: 'warning',
      tone: 'warning',
      actions: [
        { label: restart ? '修复并重启 Steam' : '修复提权设置', value: 'fix', style: 'primary', icon: 'check' },
        { label: '先这样启动', value: 'skip', icon: 'play' },
        { label: '取消', value: 'cancel' }
      ]
    });

    if (choice === 'cancel') return false;
    if (choice !== 'fix') {
      // One "not now" per session; the next launch asks again because the
      // prompt is exactly what the player asked to get rid of.
      state.steamPrivilegeMuted = true;
      return true;
    }

    const done = await runSteamRepair(restart);
    if (!done) return false;
    if (restart && !done.restarted) return false;
    return true;
  }

  async function fixSteamFromSettings() {
    if (!state.steamPrivilege) await refreshSteamPrivilege();
    const info = state.steamPrivilege;
    if (!info || !info.needsFix) {
      toast('Steam 已经是普通权限', 'check');
      return;
    }

    const choice = await window.NovaOverlays.dialog({
      title: '修复 Steam 提权',
      text: info.steamElevated
        ? '将移除 Steam.exe 的「以管理员身份运行」标记，并关闭、重新打开 Steam。请先结束正在运行的游戏。'
        : '将移除 Steam.exe 的「以管理员身份运行」标记；当前 Steam 以普通权限运行，无需重启。',
      icon: 'warning',
      tone: 'warning',
      actions: [
        { label: '修复', value: true, style: 'primary', icon: 'check' },
        { label: '取消', value: false }
      ]
    });
    if (choice) await runSteamRepair(!!info.steamElevated);
  }

  async function openEngineDialog() {
    const result = await call('engineOptions');
    if (!result || !result.ok) {
      audio.error();
      toast(result?.error || '缩放引擎还没有生成配置', 'alert');
      return;
    }
    state.engineOptions = result;
    fillEngineDialog(result);
    state.lastFocus = document.activeElement;
    state.overlay = 'engine';
    document.body.dataset.overlay = 'engine';
    els.engineOverlay.classList.add('is-open');
    els.engineOverlay.setAttribute('aria-hidden', 'false');
    els.app.inert = true;
    audio.open();
    setTimeout(() => {
      try { els.engineClose.focus({ preventScroll: true }); } catch (error) {}
    }, 120);
  }

  function fillEngineDialog(options) {
    syncEngineScaleRow();
    const modes = Array.isArray(options.modes) ? options.modes : [];
    if (els.engineEngine) els.engineEngine.value = state.settings.scalingEngine || 'auto';
    if (els.engineCapture) els.engineCapture.value = String(options.captureMethod ?? 0);
    if (els.engineCursor) els.engineCursor.value = String(options.cursorScaling ?? 6);
    if (els.engineFrameRate) {
      const limited = options.frameRateLimiterEnabled === true;
      els.engineFrameRate.value = limited ? String(Math.round(options.maxFrameRate || 120)) : '';
      els.engineFrameRate.placeholder = limited ? '' : '无上限';
    }
    setPrefSwitch(els.engine3dRow, els.engine3dSwitch, !!options.gameMode3d);
    if (els.engineAutoRow) setPrefSwitch(els.engineAutoRow, els.engineAutoSwitch, options.autoStart === true);

    const current = modes.find((mode) => mode.index === options.scalingMode);
    if (els.engineSubtitle) {
      els.engineSubtitle.textContent = `${options.bundled ? '内置 Magpie' : '系统 Magpie'} · ${options.configPath || '配置尚未生成'}`;
    }
    if (els.engineNote) {
      els.engineNote.textContent = current && !current.available
        ? `「${current.name}」需要的效果文件不在当前引擎里；换一个算法，或在设置里指定完整的 Magpie.exe。`
        : '保存后引擎会重启；正在缩放的游戏会先退回窗口。';
    }
    fillScaleAlgorithms(options);
    syncScalePanel();
  }

  /* ---------- home scaling sheet: one mode, one size, one algorithm ----------
     There used to be two algorithm selects (settings page + engine sheet) and
     the mode/factor/algorithm controls lived on the settings page. Both facts
     produced "一会儿全屏、一会儿开始缩放" and let the two copies disagree.
     Everything editable is now in this sheet; the settings page shows a
     read-only summary and opens the same sheet.                              */

  const SCALE_DELAY_STEPS = [0, 3, 5, 10, 15];

  function clampScaleFactor(value) {
    const number = Number(value);
    return Math.min(10, Math.max(1.1, Number.isFinite(number) && number > 0 ? number : 2));
  }

  function scaleWindowSize() {
    const s = state.settings || {};
    const w = Number(s.scaleWindowW);
    const h = Number(s.scaleWindowH);
    return {
      w: Number.isFinite(w) && w > 0 ? clampNumber(w, 160, 7680) : 1280,
      h: Number.isFinite(h) && h > 0 ? clampNumber(h, 120, 4320) : 720
    };
  }

  /** Magpie takes a multiplier, not a target resolution. A resolution preset
      is converted into a multiplier against the window size the player gave;
      min(width, height) keeps the aspect ratio instead of stretching it. */
  function scaleSizeFactor(preset) {
    const kind = String(preset || state.settings.scaleSizePreset || 'f:2');
    const win = scaleWindowSize();
    if (kind === 'f:custom') return clampScaleFactor(els.engineScaleCustomFactor?.value);
    if (kind === 'r:custom') {
      const w = clampNumber(els.engineScaleCustomW?.value, 160, 7680);
      const h = clampNumber(els.engineScaleCustomH?.value, 120, 4320);
      return clampScaleFactor(Math.min(w / win.w, h / win.h));
    }
    if (kind.startsWith('f:')) return clampScaleFactor(kind.slice(2));
    if (kind.startsWith('r:')) {
      const [w, h] = kind.slice(2).split('x').map(Number);
      if (w > 0 && h > 0) return clampScaleFactor(Math.min(w / win.w, h / win.h));
    }
    return clampScaleFactor(state.settings.scaleFactor);
  }

  function scaleSizeNote() {
    const s = state.settings;
    if (s.scaleMode !== 'factor') {
      return '铺满屏幕时输出尺寸跟着显示器走；想指定放大到多大，在下面选倍数或目标分辨率，会自动切成「按倍数放大」。';
    }
    const factor = clampScaleFactor(s.scaleFactor);
    const text = Number.isInteger(factor) ? String(factor) : String(Number(factor.toFixed(2)));
    const win = scaleWindowSize();
    const tail = `按 ${win.w}×${win.h} 的窗口换算 → ${text} 倍，约放大到 ${Math.round(win.w * factor)}×${Math.round(win.h * factor)}`;
    return String(s.scaleSizePreset || '').startsWith('r:')
      ? `${tail}；保持比例，不会拉伸变形，最小按 1.1 倍处理。`
      : `${tail}。`;
  }

  function syncScaleSummary() {
    if (els.settingsScaleSetupHint) els.settingsScaleSetupHint.textContent = scaleSummaryLabel();
    syncHeroScaleRow();
    syncDetailScaleRow();
  }

  function syncScalePanel() {
    const s = state.settings;
    const mode = s.scaleMode === 'factor' ? 'factor' : 'fullscreen';
    const factorMode = mode === 'factor';
    if (els.engineScaleTabs) {
      els.engineScaleTabs.querySelectorAll('.scale-tab').forEach((tab) => {
        tab.setAttribute('aria-selected', String(tab.dataset.scaleMode === mode));
      });
    }
    if (els.engineScaleModeNote) {
      els.engineScaleModeNote.textContent = factorMode
        ? '按倍数放大：窗口按你选的尺寸放大，桌面仍露在外面；尺寸和算法都在下面选。'
        : '铺满屏幕：画面放大到整块屏幕，输出尺寸跟着显示器走，桌面会被盖住。';
    }

    const preset = String(s.scaleSizePreset || 'f:2');
    const custom = preset === 'f:custom' || preset === 'r:custom';
    // Keep the size select visible in both modes: 「铺满屏幕 · 跟随显示器」
    // is its first option, so the player can see and change the output size
    // without first guessing which tab hides it.
    if (els.engineScaleWindowRow) els.engineScaleWindowRow.hidden = !factorMode;
    if (els.engineScaleCustomRow) els.engineScaleCustomRow.hidden = !factorMode || !custom;
    if (els.engineScaleSize) {
      els.engineScaleSize.value = factorMode ? preset : 'fullscreen';
      if (factorMode && els.engineScaleSize.value !== preset) els.engineScaleSize.value = 'f:2';
    }

    const win = scaleWindowSize();
    if (els.engineScaleWinW) els.engineScaleWinW.value = String(win.w);
    if (els.engineScaleWinH) els.engineScaleWinH.value = String(win.h);
    const customResolution = preset === 'r:custom';
    if (els.engineScaleCustomLabel) els.engineScaleCustomLabel.textContent = customResolution ? '自定义分辨率' : '自定义倍数';
    if (els.engineScaleCustomFactor) {
      els.engineScaleCustomFactor.value = String(clampScaleFactor(s.scaleFactor));
      els.engineScaleCustomFactor.hidden = customResolution;
    }
    if (els.engineScaleCustomW) {
      els.engineScaleCustomW.value = String(Math.round(win.w * clampScaleFactor(s.scaleFactor)));
      els.engineScaleCustomW.hidden = !customResolution;
    }
    if (els.engineScaleCustomTimes) els.engineScaleCustomTimes.hidden = !customResolution;
    if (els.engineScaleCustomH) {
      els.engineScaleCustomH.value = String(Math.round(win.h * clampScaleFactor(s.scaleFactor)));
      els.engineScaleCustomH.hidden = !customResolution;
    }
    if (els.engineScaleCustomHint) {
      els.engineScaleCustomHint.textContent = customResolution ? '宽 × 高，按上面的窗口尺寸换算' : '1.1 – 10 倍';
    }
    if (els.engineScaleSizeNote) els.engineScaleSizeNote.textContent = scaleSizeNote();
    if (els.engineScaleDelay) {
      const stored = Math.max(0, Number(s.scaleDelaySeconds) || 0);
      els.engineScaleDelay.value = String(SCALE_DELAY_STEPS.reduce((best, step) =>
        Math.abs(step - stored) < Math.abs(best - stored) ? step : best, 0));
    }
    syncScaleSummary();
  }

  function applyScaleMode(mode) {
    const next = mode === 'factor' ? 'factor' : 'fullscreen';
    if (state.settings.scaleMode === next) return;
    state.settings.scaleMode = next;
    saveSettings();
    audio.toggle();
    syncScalePanel();
    // 倍数放大只有内置缩放引擎做得到；底层引擎还停在「仅无边框拉伸」时，
    // 提前把这件事说清楚，免得玩家以为倍数没生效。
    if (next === 'factor' && state.settings.scalingEngine === 'native') {
      toast('缩放模式：按倍数放大（将由内置缩放引擎完成）', 'check');
      return;
    }
    toast(next === 'factor' ? '缩放模式：按倍数放大' : '缩放模式：铺满屏幕', 'check');
  }

  function applyScaleSize() {
    const value = els.engineScaleSize?.value || 'f:2';
    if (value === 'fullscreen') {
      applyScaleMode('fullscreen');
      return;
    }
    state.settings.scaleSizePreset = value;
    state.settings.scaleFactor = scaleSizeFactor(value);
    // Picking a concrete size IS windowed scaling; switch automatically so
    // the player never has to guess which tab owns the resolution choice.
    state.settings.scaleMode = 'factor';
    saveSettings();
    audio.toggle();
    syncScalePanel();
    toast(`缩放尺寸：${scaleModeLabel()}`, 'check');
  }

  function applyScaleWindowSize() {
    state.settings.scaleWindowW = clampNumber(els.engineScaleWinW?.value, 160, 7680);
    state.settings.scaleWindowH = clampNumber(els.engineScaleWinH?.value, 120, 4320);
    if (String(state.settings.scaleSizePreset || '').startsWith('r:')) {
      state.settings.scaleFactor = scaleSizeFactor(state.settings.scaleSizePreset);
    }
    saveSettings();
    // Do not re-fill the inputs here: the player is still typing in them.
    if (els.engineScaleSizeNote) els.engineScaleSizeNote.textContent = scaleSizeNote();
    syncScaleSummary();
  }

  function applyScaleCustomSize() {
    const preset = String(state.settings.scaleSizePreset || '');
    if (preset !== 'f:custom' && preset !== 'r:custom') return;
    state.settings.scaleFactor = scaleSizeFactor(preset);
    saveSettings();
    audio.toggle();
    if (els.engineScaleSizeNote) els.engineScaleSizeNote.textContent = scaleSizeNote();
    syncScaleSummary();
    toast(`缩放尺寸：${scaleModeLabel()}`, 'check');
  }

  function applyScaleDelay() {
    state.settings.scaleDelaySeconds = Math.min(120, Math.max(0, Number(els.engineScaleDelay?.value) || 0));
    saveSettings();
    audio.toggle();
    toast(state.settings.scaleDelaySeconds > 0
      ? `缩放时机：等 ${state.settings.scaleDelaySeconds} 秒`
      : '缩放时机：窗口出现就缩放', 'check');
  }

  function updateScaleAlgorithmNote(data) {
    if (!els.engineScaleAlgorithmNote) return;
    const modes = Array.isArray(data?.modes) ? data.modes : [];
    const wanted = state.settings.scaleAlgorithm || '';
    const active = wanted ? modes.find((mode) => mode.name === wanted) : null;
    els.engineScaleAlgorithmNote.textContent = active
      ? `${active.name} · ${active.note || '按这个算法的默认效果渲染'}。选完立刻写进引擎，启动游戏时还会再校验一次。`
      : '像素类算法（Integer Scale、像素缩放）保留硬边，适合老游戏和 2D 画面；平滑类会把像素边缘糊掉。选完立刻写进引擎，启动游戏时还会再校验一次。';
  }

  function applyScaleAlgorithm() {
    const wanted = els.engineScaleAlgorithm?.value || '';
    state.settings.scaleAlgorithm = wanted;
    saveSettings();
    audio.toggle();
    updateScaleAlgorithmNote(state.engineOptions);
    const modes = Array.isArray(state.engineOptions?.modes) ? state.engineOptions.modes : [];
    const active = wanted ? modes.find((mode) => mode.name === wanted) : null;
    renderEngineModeList(modes, active ? active.index : (state.engineOptions?.scalingMode ?? 0));
    syncScaleSummary();
    toast(wanted ? `缩放算法：${wanted}` : '缩放算法：跟随引擎当前设置', 'check');
  }

  function renderEngineModeList(modes, activeIndex) {
    if (!els.engineModeList) return;
    els.engineModeList.innerHTML = modes.map((mode) => `
      <div class="engine-mode-row" data-index="${mode.index}" data-state="${mode.available ? 'ok' : 'missing'}" data-active="${mode.index === activeIndex}">
        <b>${esc(mode.name)}</b>
        <span class="engine-mode-copy">
          <span>${esc(mode.available ? (mode.note || '') : `缺少效果文件：${mode.missing || mode.name}`)}</span>
          ${mode.effects ? `<em class="engine-mode-chain">${esc(mode.effects)}</em>` : ''}
        </span>
      </div>
    `).join('');
    els.engineModeList.classList.toggle(
      'is-scrollable',
      els.engineModeList.scrollHeight > els.engineModeList.clientHeight + 2);
    if (els.engineModeNote) {
      const active = modes.find((mode) => mode.index === activeIndex);
      els.engineModeNote.textContent = active
        ? `${active.name} · ${active.note || ''}`
        : '选择一种算法；每种算法的适用场景见下方说明。';
    }
  }

  function closeEngineDialog() {
    if (state.overlay !== 'engine') return;
    state.engineOptions = null;
    state.overlay = null;
    els.engineOverlay.classList.remove('is-open');
    els.engineOverlay.setAttribute('aria-hidden', 'true');
    if (document.body.dataset.overlay === 'engine') delete document.body.dataset.overlay;
    els.app.inert = false;
    restoreFocus();
    audio.close();
  }

  function toggleEngine3d() {
    const next = els.engine3dRow.getAttribute('aria-checked') !== 'true';
    setPrefSwitch(els.engine3dRow, els.engine3dSwitch, next);
    audio.toggle();
  }

  function resetEngineDialog() {
    const options = state.engineOptions;
    if (!options) return;
    if (els.engineScaleAlgorithm) els.engineScaleAlgorithm.value = '';
    if (els.engineEngine) els.engineEngine.value = 'auto';
    if (els.engineCapture) els.engineCapture.value = '0';
    if (els.engineCursor) els.engineCursor.value = '6';
    if (els.engineFrameRate) {
      els.engineFrameRate.value = '';
      els.engineFrameRate.placeholder = '无上限';
    }
    setPrefSwitch(els.engine3dRow, els.engine3dSwitch, false);
    if (els.engineAutoRow) setPrefSwitch(els.engineAutoRow, els.engineAutoSwitch, false);
    audio.toggle();
    toast('高级设置已恢复默认 · 点「保存并重启引擎」生效', 'spark');
  }

  async function saveEngineDialog() {
    const rawFrameRate = els.engineFrameRate?.value.trim() ?? '';
    const frameRateLimited = rawFrameRate !== '';
    const frameRate = frameRateLimited
      ? clampNumber(rawFrameRate, 10, 1000)
      : (Number(state.engineOptions?.maxFrameRate) || 120);
    const engineMode = els.engineEngine?.value || state.settings.scalingEngine || 'auto';
    if (engineMode !== state.settings.scalingEngine) await applyScalingEngineMode(engineMode);

    // The advanced sheet and the player-facing algorithm select are ONE value.
    // Resolve the chosen name back to Magpie's index here instead of keeping a
    // second native <select> that could disagree with the player's choice.
    const modes = Array.isArray(state.engineOptions?.modes) ? state.engineOptions.modes : [];
    const currentIndex = Number(state.engineOptions?.scalingMode ?? 0);
    const chosenName = els.engineScaleAlgorithm?.value || '';
    const chosen = chosenName
      ? modes.find((mode) => mode.name === chosenName)
      : modes.find((mode) => mode.index === currentIndex);
    const scalingMode = chosen ? Number(chosen.index) : currentIndex;
    const result = await call('saveEngineOptions', {
      scalingMode,
      captureMethod: Number(els.engineCapture?.value || 0),
      cursorScaling: Number(els.engineCursor?.value || 6),
      frameRateLimiterEnabled: frameRateLimited,
      maxFrameRate: frameRate,
      gameMode3d: els.engine3dRow?.getAttribute('aria-checked') === 'true',
      autoStartEngine: els.engineAutoRow?.getAttribute('aria-checked') === 'true'
    });
    if (!result || !result.ok) {
      audio.error();
      toast(result?.error || '缩放引擎设置保存失败', 'alert');
      return;
    }
    // The native side writes the algorithm name back into PlayerSettings; keep
    // the front end on exactly that name so the next launch cannot undo it.
    state.settings.scaleAlgorithm = chosen ? chosen.name : '';
    saveSettings();
    syncScaleSummary();
    audio.confirm();
    toast(result.message || '高级引擎设置已保存', 'check');
    closeEngineDialog();
    setTimeout(refreshMagpieStatus, 4200);
  }

  async function openFullMagpie() {
    const result = await call('openMagpie');
    if (!result || !result.ok) {
      audio.error();
      toast(result?.message || '无法打开 Magpie', 'alert');
      return;
    }
    toast(result.message || '正在打开完整 Magpie', 'check');
    closeEngineDialog();
  }

  async function refreshMagpieStatus() {
    if (!hasBridge) return;
    const result = await call('magpieStatus');
    if (result && result.ok) {
      state.magpie = result;
      renderMagpieStatus();
    }
  }

  function hotkeyLabel(code) {
    const parts = [];
    if (code & 0x400) parts.push('Alt');
    if (code & 0x200) parts.push('Ctrl');
    if (code & 0x800) parts.push('Shift');
    if (code & 0x100) parts.push('Win');
    const vk = code & 0xFF;
    let key = '';
    if (vk >= 0x30 && vk <= 0x39) key = String.fromCharCode(vk);
    else if (vk >= 0x41 && vk <= 0x5A) key = String.fromCharCode(vk);
    else if (vk >= 0x70 && vk <= 0x87) key = `F${vk - 0x6F}`;
    else if (vk === 0x20) key = 'Space';
    else if (vk === 0x25) key = '←';
    else if (vk === 0x26) key = '↑';
    else if (vk === 0x27) key = '→';
    else if (vk === 0x28) key = '↓';
    else key = `VK${vk}`;
    parts.push(key);
    return parts.join(' + ');
  }

  function vkForHotkey(key) {
    if (!key) return 0;
    if (key.length === 1) {
      const upper = key.toUpperCase();
      if (upper >= 'A' && upper <= 'Z') return upper.charCodeAt(0);
      if (key >= '0' && key <= '9') return key.charCodeAt(0);
      if (key === ' ') return 0x20;
    }
    const match = /^F([1-9]|1[0-2])$/.exec(key);
    if (match) return 0x6F + Number(match[1]);
    if (key === 'ArrowLeft') return 0x25;
    if (key === 'ArrowUp') return 0x26;
    if (key === 'ArrowRight') return 0x27;
    if (key === 'ArrowDown') return 0x28;
    if (key === 'Enter') return 0x0D;
    if (key === 'Tab') return 0x09;
    return 0;
  }

  function syncHotkeyUI() {
    if (els.settingsHotkeyLabel) {
      els.settingsHotkeyLabel.textContent = hotkeyLabel(state.settings.scalingHotkey || 3137);
    }
    if (els.settingsHotkeyHint) {
      els.settingsHotkeyHint.hidden = !state.hotkeyRecording;
      els.settingsHotkeyHint.textContent = '按下组合键 · Esc 取消';
    }
    if (els.settingsHotkeyRow) {
      els.settingsHotkeyRow.classList.toggle('is-recording', !!state.hotkeyRecording);
    }
  }

  function beginHotkeyRecording() {
    if (!hasBridge) return;
    state.hotkeyRecording = true;
    syncHotkeyUI();
    audio.select();
  }

  function cancelHotkeyRecording() {
    state.hotkeyRecording = false;
    syncHotkeyUI();
    audio.close();
  }

  async function commitHotkey(code) {
    state.hotkeyRecording = false;
    state.settings.scalingHotkey = code;
    syncHotkeyUI();
    saveSettings();

    const restart = state.settings.scalingEngine === 'auto' && !!state.magpie?.running;
    const result = await call('applyScalingHotkey', { code, restart });
    if (!result || !result.ok) {
      audio.error();
      toast(result?.error || '快捷键保存失败', 'alert');
      return;
    }

    audio.confirm();
    toast(result.message || `快捷键 · ${hotkeyLabel(code)}`, 'check');
    setTimeout(refreshMagpieStatus, result.restarted ? 4200 : 500);
  }

  function renderMagpieStatus() {
    if (!els.settingsMagpieNote) return;
    const magpie = state.magpie;
    const engine = state.settings.scalingEngine || 'auto';
    if (!magpie) {
      els.settingsMagpieNote.textContent = '正在检测缩放引擎…';
      if (els.settingsMagpieActions) els.settingsMagpieActions.hidden = true;
      return;
    }
    const mode = engine === 'off' ? '缩放已关闭。'
      : engine === 'native' ? '缩放引擎：仅无边框拉伸。'
        : '缩放引擎：Magpie 优先。';
    els.settingsMagpieNote.textContent = `${mode} ${magpie.note || ''}`.trim();

    const canStart = engine === 'auto' && magpie.available && !magpie.running;
    if (els.settingsMagpieStart) els.settingsMagpieStart.hidden = !canStart;
    if (els.settingsMagpieRestart) els.settingsMagpieRestart.hidden = !magpie.running;
    if (els.settingsMagpiePick) els.settingsMagpiePick.hidden = !!magpie.exePath;
    if (els.settingsMagpieActions) els.settingsMagpieActions.hidden = !(canStart || magpie.running || !magpie.exePath);
    syncHotkeyUI();
  }

  async function pickMagpieExe() {
    if (!window.NovaOverlays || !window.NovaOverlays.pickerOpen) return;
    const path = await window.NovaOverlays.pickerOpen({
      filter: 'exe',
      title: '选择 Magpie.exe',
      note: 'Magpie 会以独立进程运行；GUGUOVA 只负责把游戏窗口交给它'
    });
    if (!path) return;
    state.settings.magpiePath = path;
    await call('saveSettings', { magpiePath: path });
    saveSettings();
    await refreshMagpieStatus();
    audio.select();
    toast('已指定 Magpie 路径', 'check');
  }

  function toggleMinimizeSetting() {
    const next = state.settings.minimizeOnLaunch === false;
    state.settings.minimizeOnLaunch = next;
    saveSettings();
    setPrefSwitch(els.settingsMinimizeRow, els.settingsMinimizeSwitch, next);
    audio.toggle();
    toast(next ? '启动游戏后会最小化启动器' : '启动游戏后保留启动器窗口', 'moon');
  }

  /** The scale mode lives in the engine sheet now; changing it there is the
      single place where auto/native/off is decided. */
  async function applyScalingEngineMode(value) {
    state.settings.scalingEngine = value;
    saveSettings();
    if (value === 'native' && state.magpie?.running) {
      // Magpie owns the global key while it runs; close it before the
      // launcher registers the same combination itself.
      await call('stopScalingEngine');
      await new Promise((resolve) => setTimeout(resolve, 2600));
      await call('applyScalingHotkey', { code: state.settings.scalingHotkey, restart: false });
    }
    renderMagpieStatus();
    syncHotkeyUI();
    syncDetailScaleRow();
    syncHeroScaleRow();
  }

  function toggleAutoEngine() {
    const next = state.settings.autoStartEngine === false;
    state.settings.autoStartEngine = next;
    saveSettings();
    setPrefSwitch(els.settingsAutoEngineRow, els.settingsAutoEngineSwitch, next);
    renderMagpieStatus();
    audio.toggle();
    toast(next ? '启动游戏时会自动打开内置缩放引擎' : '不会自动打开缩放引擎', 'spark');
  }

  /**
   * Chromium draws the <select> popup with the OS theme, not ours. Keep the
   * themed closed control and overlay a transparent hit area that opens a
   * themed list instead; the native select stays as the value source.
   */
  function initThemedSelect(select) {
    if (!select || select.dataset.novaSelect === '1') return;
    select.dataset.novaSelect = '1';
    const wrap = document.createElement('div');
    wrap.className = 'nova-select';
    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(select);
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');

    const hit = document.createElement('button');
    hit.type = 'button';
    hit.className = 'nova-select-hit';
    hit.setAttribute('aria-haspopup', 'listbox');
    hit.setAttribute('aria-expanded', 'false');
    hit.setAttribute('aria-label', select.getAttribute('aria-label') || '选择');

    const menu = document.createElement('div');
    menu.className = 'nova-select-menu';
    menu.setAttribute('role', 'listbox');
    menu.hidden = true;
    wrap.appendChild(hit);
    wrap.appendChild(menu);

    const sync = () => {
      const options = Array.from(select.options);
      menu.innerHTML = options.map((option, index) => `
        <button type="button" class="nova-select-option" role="option" data-index="${index}" aria-selected="${option.selected}" ${option.disabled ? 'disabled' : ''}>${esc(option.textContent)}</button>
      `).join('');
      hit.setAttribute('aria-expanded', String(!menu.hidden));
    };
    const close = (focusHit) => {
      menu.hidden = true;
      hit.setAttribute('aria-expanded', 'false');
      if (focusHit) { try { hit.focus({ preventScroll: true }); } catch (error) {} }
    };
    const open = () => {
      sync();
      menu.hidden = false;
      hit.setAttribute('aria-expanded', 'true');
      const selected = menu.querySelector('[aria-selected="true"]') || menu.firstElementChild;
      if (selected) { try { selected.focus({ preventScroll: true }); } catch (error) {} }
    };

    hit.addEventListener('click', (event) => {
      event.stopPropagation();
      if (menu.hidden) open(); else close(false);
    });
    hit.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
    menu.addEventListener('click', (event) => {
      const option = event.target.closest('.nova-select-option');
      if (!option || option.disabled) return;
      select.selectedIndex = Number(option.dataset.index);
      select.dispatchEvent(new Event('change', { bubbles: true }));
      sync();
      close(true);
    });
    menu.addEventListener('keydown', (event) => {
      const options = Array.from(menu.querySelectorAll('.nova-select-option'));
      const index = options.indexOf(document.activeElement);
      if (event.key === 'Escape') {
        event.preventDefault();
        close(true);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        options[Math.min(options.length - 1, index + 1)]?.focus();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        options[Math.max(0, index - 1)]?.focus();
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        document.activeElement?.click();
      }
    });
    select.addEventListener('change', sync);
    document.addEventListener('pointerdown', (event) => {
      if (!wrap.contains(event.target)) close(false);
    });
    sync();
  }

  function initThemedSelects(scope = document) {
    scope.querySelectorAll('select').forEach((select) => {
      if (select.closest('.nova-select')) return;
      initThemedSelect(select);
    });
  }

  /** Fills the scaling-algorithm select from Magpie's own mode list. Names,
      not indices, are stored: Magpie can insert a mode or the library can be
      moved to another PC without silently switching to a different effect. */
  async function fillScaleAlgorithms(options) {
    const select = els.engineScaleAlgorithm;
    if (!select) return;
    let data = options;
    if (!data) {
      if (!state.engineOptions) {
        const result = await call('engineOptions');
        if (result && result.ok) state.engineOptions = result;
      }
      data = state.engineOptions || {};
    }
    const modes = Array.isArray(data.modes) ? data.modes : [];
    const current = modes.find((mode) => mode.index === (data.scalingMode ?? 0));
    const followLabel = current ? `跟随引擎当前设置（${current.name}）` : '跟随引擎当前设置';
    const wanted = state.settings.scaleAlgorithm || '';
    select.innerHTML = [
      `<option value="">${esc(followLabel)}</option>`,
      ...modes.filter((mode) => mode.available !== false).map((mode) =>
        `<option value="${esc(mode.name)}">${esc(mode.name)}</option>`)
    ].join('');
    select.value = wanted;
    if (select.value !== wanted) select.value = '';
    updateScaleAlgorithmNote(data);
    const active = wanted ? modes.find((mode) => mode.name === wanted) : current;
    renderEngineModeList(modes, active ? active.index : Number(data.scalingMode ?? 0));
  }

  function renderSettings() {
    if (!els.settingsPlayerName) return;
    const stats = state.stats || {};
    const storage = state.storage || {};
    const games = state.games || [];

    els.settingsPlayerName.value = state.settings.playername || '';
    if (els.settingsOsUser) els.settingsOsUser.textContent = state.userName || '—';
    if (els.settingsVersion) els.settingsVersion.textContent = state.version;
    setPrefSwitch(els.updateAutoRow, els.updateAutoSwitch, state.settings.autoCheckUpdates === true);
    updateRender();
    if (els.profileVersion) els.profileVersion.textContent = `${state.version} · 桌面版`;
    const system = state.system || {};
    const displayName = state.settings.playername || state.userName || '玩家';
    if (els.settingsHeroName) els.settingsHeroName.textContent = displayName;
    if (els.settingsHeroAccount) els.settingsHeroAccount.textContent = state.userName ? `本机账户 · ${state.userName}` : '本机离线账户';
    if (els.settingsAvatar) els.settingsAvatar.textContent = (displayName.trim().slice(0, 1) || 'N').toUpperCase();
    if (els.settingsHeroTier) els.settingsHeroTier.textContent = system.tierLabel || '完整效果';
    if (els.settingsHeroVersion) els.settingsHeroVersion.textContent = `v${state.version}`;
    if (els.settingsFootPath) els.settingsFootPath.textContent = storage.root ? `数据目录 · ${storage.root}` : '数据目录 · —';
    if (els.settingsSyncPlaytime) els.settingsSyncPlaytime.hidden = !games.some((game) => game.steamAppId);
    if (els.settingsTier) els.settingsTier.value = state.settings.compatibilityTier || 'auto';
    if (els.settingsTagCount) {
      els.settingsTagCount.value = String(Math.min(3, Math.max(1, Number(state.settings.libraryTagCount) || 3)));
    }
    if (els.settingsScaleSetupHint) els.settingsScaleSetupHint.textContent = scaleSummaryLabel();
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
    setPrefSwitch(els.settingsMinimizeRow, els.settingsMinimizeSwitch, state.settings.minimizeOnLaunch !== false);
    setPrefSwitch(els.settingsAutoEngineRow, els.settingsAutoEngineSwitch, state.settings.autoStartEngine === true);
    renderStartupRow();
    renderStartupFullscreenRow();
    syncHotkeyUI();
    renderMagpieStatus();
    renderSteamPrivilege();

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
    audio.toggle();
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
    audio.select();
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
    audio.toggle();
    toast(state.settings.autoBackup ? '每天自动备份已开启' : '每天自动备份已关闭', 'check');
  }

