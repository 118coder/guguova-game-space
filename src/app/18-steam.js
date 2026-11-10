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
    if (els.engineMode) {
      els.engineMode.innerHTML = modes.map((mode) => `
        <option value="${mode.index}" ${mode.available ? '' : 'disabled'}>${esc(mode.name)}${mode.available ? '' : ' · 缺少效果'}</option>
      `).join('');
      els.engineMode.value = String(options.scalingMode ?? 0);
    }
    if (els.engineEngine) els.engineEngine.value = state.settings.scalingEngine || 'auto';
    if (els.engineCapture) els.engineCapture.value = String(options.captureMethod ?? 0);
    if (els.engineCursor) els.engineCursor.value = String(options.cursorScaling ?? 6);
    if (els.engineFrameRate) {
      const limited = options.frameRateLimiterEnabled === true;
      els.engineFrameRate.value = limited ? String(Math.round(options.maxFrameRate || 120)) : '';
      els.engineFrameRate.placeholder = limited ? '' : '无上限';
    }
    setPrefSwitch(els.engine3dRow, els.engine3dSwitch, !!options.gameMode3d);

    renderEngineModeList(modes, Number(els.engineMode?.value || 0));
    if (els.engineAutoRow) setPrefSwitch(els.engineAutoRow, els.engineAutoSwitch, options.autoStart === true);

    const current = modes.find((mode) => mode.index === options.scalingMode);
    if (current && !current.available) {
      // Lite bundles omit some effect files; never leave an unusable mode
      // selected just because the old config pointed at it.
      const first = modes.find((mode) => mode.available);
      if (first && els.engineMode) els.engineMode.value = String(first.index);
    }
    if (els.engineSubtitle) {
      els.engineSubtitle.textContent = `${options.bundled ? '内置 Magpie' : '系统 Magpie'} · ${options.configPath || '配置尚未生成'}`;
    }
    if (els.engineNote) {
      els.engineNote.textContent = current && !current.available
        ? `「${current.name}」需要的效果文件不在当前引擎里；换一个算法，或在设置里指定完整的 Magpie.exe。`
        : '保存后会重启引擎；正在缩放的游戏会先退回窗口。';
    }
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
    const first = (options.modes || []).find((mode) => mode.available) || { index: 0 };
    if (els.engineMode) els.engineMode.value = String(first.index);
    if (els.engineCapture) els.engineCapture.value = '0';
    if (els.engineCursor) els.engineCursor.value = '6';
    if (els.engineFrameRate) {
      els.engineFrameRate.value = '';
      els.engineFrameRate.placeholder = '无上限';
    }
    setPrefSwitch(els.engine3dRow, els.engine3dSwitch, false);
    if (els.engineAutoRow) setPrefSwitch(els.engineAutoRow, els.engineAutoSwitch, false);
    audio.toggle();
    toast('已恢复默认值 · 点保存生效', 'spark');
  }

  async function saveEngineDialog() {
    const rawFrameRate = els.engineFrameRate?.value.trim() ?? '';
    const frameRateLimited = rawFrameRate !== '';
    const frameRate = frameRateLimited
      ? clampNumber(rawFrameRate, 10, 1000)
      : (Number(state.engineOptions?.maxFrameRate) || 120);
    const engineMode = els.engineEngine?.value || state.settings.scalingEngine || 'auto';
    if (engineMode !== state.settings.scalingEngine) await applyScalingEngineMode(engineMode);
    const result = await call('saveEngineOptions', {
      scalingMode: Number(els.engineMode?.value || 0),
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
    // Keep the settings page in sync with the engine sheet: the native side
    // stores the same name, so the next launch will not undo this choice.
    const chosenMode = (state.engineOptions?.modes || []).find(
      (mode) => String(mode.index) === String(els.engineMode?.value));
    state.settings.scaleAlgorithm = chosenMode ? chosenMode.name : '';
    audio.confirm();
    toast(result.message || '缩放引擎设置已保存', 'check');
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
  async function fillScaleAlgorithms() {
    const select = els.settingsScaleAlgorithm;
    if (!select) return;
    if (!state.engineOptions) {
      const result = await call('engineOptions');
      if (result && result.ok) state.engineOptions = result;
    }
    const options = state.engineOptions || {};
    const modes = Array.isArray(options.modes) ? options.modes : [];
    const current = modes.find((mode) => mode.index === (options.scalingMode ?? 0));
    const followLabel = current ? `跟随引擎当前设置（${current.name}）` : '跟随引擎当前设置';
    const wanted = state.settings.scaleAlgorithm || '';
    select.innerHTML = [
      `<option value="">${esc(followLabel)}</option>`,
      ...modes.filter((mode) => mode.available !== false).map((mode) =>
        `<option value="${esc(mode.name)}">${esc(mode.name)}</option>`)
    ].join('');
    select.value = wanted;
    if (select.value !== wanted) select.value = '';
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
    if (els.settingsScaleMode) {
      els.settingsScaleMode.value = state.settings.scaleMode === 'factor' ? 'factor' : 'fullscreen';
    }
    if (els.settingsScaleFactor) {
      const storedFactor = Math.min(10, Math.max(1.1, Number(state.settings.scaleFactor) || 2));
      const factorSteps = [1.25, 1.5, 1.75, 2, 2.5, 3];
      els.settingsScaleFactor.value = String(factorSteps.reduce((best, step) =>
        Math.abs(step - storedFactor) < Math.abs(best - storedFactor) ? step : best, 2));
    }
    if (els.settingsScaleFactorRow) {
      els.settingsScaleFactorRow.hidden = state.settings.scaleMode !== 'factor';
    }
    fillScaleAlgorithms();
    if (els.settingsScaleDelay) {
      // Snap to the offered options so a hand-edited value can't blank the select.
      const stored = Math.max(0, Number(state.settings.scaleDelaySeconds) || 0);
      const options = [0, 3, 5, 10, 15];
      els.settingsScaleDelay.value = String(options.reduce((best, step) =>
        Math.abs(step - stored) < Math.abs(best - stored) ? step : best, 0));
    }
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

