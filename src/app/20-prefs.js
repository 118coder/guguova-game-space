/* ============================================================
   APP PART 20 · prefs —— 偏好开关（声音/动效/全屏/休眠）+ 通知 NOTIFICATIONS
   这是 src/app/ 分片之一：由 tools/build-app.js 按文件名序拼回 src/app.js。
   所有分片共享同一个 IIFE 闭包（跨分片直接引用函数与 state）。
   改代码请改分片，改完运行 node tools/build-app.js；直接编辑 app.js 会被覆盖。
   ============================================================ */

  /* ============================================================
     SOUND / MOTION / FULLSCREEN / SLEEP
     ============================================================ */

  function syncSoundUI() {
    const on = state.settings.sound;
    if (els.soundSwitch) els.soundSwitch.classList.toggle('on', on);
    if (els.soundRow) els.soundRow.setAttribute('aria-checked', String(on));
    const profileUse = els.soundRow ? $('use', els.soundRow) : null;
    if (profileUse) profileUse.setAttribute('href', on ? '#i-sound-on' : '#i-sound-off');
    if (els.appearanceSoundSwitch) els.appearanceSoundSwitch.classList.toggle('on', on);
    if (els.appearanceSoundRow) els.appearanceSoundRow.setAttribute('aria-checked', String(on));
    const appearanceUse = els.appearanceSoundRow ? $('use', els.appearanceSoundRow) : null;
    if (appearanceUse) appearanceUse.setAttribute('href', on ? '#i-sound-on' : '#i-sound-off');
    const unified = !!state.settings.unifiedSfx;
    setPrefSwitch(els.settingsUnifiedSfxRow, els.settingsUnifiedSfxSwitch, unified);
  }

  /** Re-apply which sound set is audible without waiting for a theme switch. */
  async function setUnifiedSfx(on) {
    state.settings.unifiedSfx = on;
    saveSettings();
    syncSoundUI();
    if (on) {
      audio.themePools.clear();
    } else {
      const theme = window.NovaTheme ? window.NovaTheme.find(state.theme) : null;
      await audio.warmTheme(state.theme, theme && theme.sounds);
    }
    audio.toggle();
    toast(on ? '音效 · 使用默认统一音效' : '音效 · 跟随当前主题', 'sound-on');
  }

  function setSound(on, announce = true) {
    state.settings.sound = on;
    saveSettings();
    syncSoundUI();
    if (announce) {
      if (on) audio.select();
      toast(on ? '界面音效已开启' : '界面音效已关闭', on ? 'sound-on' : 'sound-off');
    }
  }

  function syncMotionUI() {
    if (window.NovaMotion) {
      window.NovaMotion.configure({
        calm: state.settings.calm,
        reduceMotion: state.settings.reduceMotion
      });
    } else {
      document.documentElement.classList.toggle('reduce-motion', state.settings.reduceMotion);
      document.documentElement.classList.toggle('calm', state.settings.calm);
    }
    if (els.appearanceMotionSwitch) els.appearanceMotionSwitch.classList.toggle('on', state.settings.reduceMotion);
    if (els.appearanceMotionRow) els.appearanceMotionRow.setAttribute('aria-checked', String(state.settings.reduceMotion));
    if (els.appearanceCalmSwitch) els.appearanceCalmSwitch.classList.toggle('on', state.settings.calm);
    if (els.appearanceCalmRow) els.appearanceCalmRow.setAttribute('aria-checked', String(state.settings.calm));
    if (els.calmSwitch) els.calmSwitch.classList.toggle('on', state.settings.calm);
    if (els.calmRow) els.calmRow.setAttribute('aria-checked', String(state.settings.calm));
  }

  /* ---- the switcher strip measures itself --------------------------------
     The strip floats over the cover, so the stage reserves its height. That
     height is not a constant: a two-line game name adds ~16px, a narrow
     window adds a third line, and the tile count decides whether the strip
     scrolls. A hard-coded 128px matched the demo library and buried the
     action row on a real one. Measure it, write it back as --im-dock-h, and
     re-measure whenever the strip's own box changes. */
  let dockObserver = null;

  function syncDockHeight() {
    const dock = document.querySelector('.view-home .dock');
    if (!dock) return;
    const height = Math.round(dock.getBoundingClientRect().height);
    if (!height) return;
    const next = `${height}px`;
    if (document.documentElement.style.getPropertyValue('--im-dock-h') !== next) {
      document.documentElement.style.setProperty('--im-dock-h', next);
    }
  }

  function watchDockHeight() {
    const dock = document.querySelector('.view-home .dock');
    if (!dock) return;
    if (!dockObserver && 'ResizeObserver' in window) {
      dockObserver = new ResizeObserver(() => syncDockHeight());
      dockObserver.observe(dock);
    }
    syncDockHeight();
  }

  function setCalm(on, announce = true) {
    state.settings.calm = on;
    saveSettings();
    syncMotionUI();
    // Turning calm on clears reduce-motion as a side effect; that must not
    // add a second cue on top of the one for this click.
    if (on && state.settings.reduceMotion) setReduceMotion(false, false, { silent: true });
    syncSoundUI();
    // The cue follows the click, not the toast: the appearance page toggles
    // the same switch without a toast and still needs to sound.
    audio.toggle();
    // Entering or leaving the immersive layout changes the strip's box; the
    // stage padding has to follow in the same frame, not after a resize.
    syncDockHeight();
    if (announce) {
      toast(on ? '沉稳模式已开启 · 更少动画，更多留白' : '沉稳模式已关闭', 'moon');
    }
  }

  function setReduceMotion(on, announce = true, options = {}) {
    state.settings.reduceMotion = on;
    saveSettings();
    syncMotionUI();
    if (options.silent !== true) audio.toggle();
    if (announce) toast(on ? '已开启减少动效' : '已关闭减少动效', 'spark');
  }

  function syncFullscreenLabels() {
    const active = !!state.fullscreen || !!document.fullscreenElement;
    if (els.fullscreenLabel) els.fullscreenLabel.textContent = active ? '退出全屏' : '全屏显示';
    const appearanceLabel = els.appearanceFullscreenRow ? $('.pref-label span', els.appearanceFullscreenRow) : null;
    if (appearanceLabel) appearanceLabel.textContent = active ? '退出全屏' : '全屏显示';
  }

  async function toggleFullscreen(closeMenu = false, silent = false) {
    const next = !state.fullscreen;
    await applyFullscreen(next, silent);
    if (closeMenu) closePopovers();
  }

  function applyFullscreenState(on) {
    state.fullscreen = on;
    document.documentElement.classList.toggle('is-fullscreen', on);
    syncFullscreenLabels();
    // Maximize and fullscreen are the same window mode, so one icon serves both.
    syncMaxButton(on);
    syncDetailScaleRow();
    syncHeroScaleRow();
    if (on) {
      document.documentElement.classList.remove('idle');
      scheduleFullscreenIdle();
    }
  }

  let fullscreenIdleTimer = null;

  function scheduleFullscreenIdle() {
    clearTimeout(fullscreenIdleTimer);
    if (!state.fullscreen) return;
    fullscreenIdleTimer = setTimeout(() => {
      if (state.fullscreen) document.documentElement.classList.add('idle');
    }, 3200);
  }

  /** The window's close button and Alt+F4 both land here. */
  async function askClose() {
    if (state.settings.closeToTray) {
      call('hideToTray');
      toast('已最小化到托盘 · 游戏仍在计时', 'moon');
      return;
    }
    const choice = await window.NovaOverlays.dialog({
      title: '关闭 GUGUOVA',
      text: '可以最小化到托盘，让游戏继续计时。',
      icon: 'power',
      actions: [
        { label: '最小化到托盘', value: 'tray', icon: 'moon' },
        { label: '退出程序', value: 'quit', style: 'danger', icon: 'close' },
        { label: '取消', value: 'cancel', style: 'primary' }
      ]
    });
    if (choice === 'quit') call('quitNow');
    else if (choice === 'tray') call('hideToTray');
  }

  async function applyFullscreen(on, silent = false) {
    state.fullscreen = on;
    document.documentElement.classList.toggle('is-fullscreen', on);
    document.documentElement.classList.remove('idle');
    syncFullscreenLabels();

    if (on) {
      document.body.classList.add('fullscreen-entering');
      setTimeout(() => document.body.classList.remove('fullscreen-entering'), 520);
    }

    if (hasBridge) {
      const result = await call('setFullscreen', { on });
      if (result && result.ok === false && !silent) {
        toast('无法切换全屏');
      }
    } else if (on) {
      try { await document.documentElement.requestFullscreen(); } catch (error) {}
    } else if (document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch (error) {}
    }

    if (!silent) toast(on ? '全屏已开启' : '全屏已关闭', 'fullscreen');
  }

  function enterSleep() {
    if (state.overlay) return;
    state.lastFocus = els.profileBtn;
    closePopovers();
    updateClock();
    state.overlay = 'sleep';
    els.sleepOverlay.classList.add('is-open');
    els.sleepOverlay.setAttribute('aria-hidden', 'false');
    els.app.inert = true;
    audio.sleep();
    try { els.sleepOverlay.focus({ preventScroll: true }); } catch (error) {}
  }

  function exitSleep() {
    if (state.overlay !== 'sleep') return;
    els.sleepOverlay.classList.remove('is-open');
    els.sleepOverlay.setAttribute('aria-hidden', 'true');
    state.overlay = null;
    els.app.inert = false;
    audio.select();
    restoreFocus();
  }

  function syncMaxButton(maximized) {
    const use = els.maxBtn.querySelector('use');
    if (use) use.setAttribute('href', maximized ? '#i-restore' : '#i-square');
    els.maxBtn.setAttribute('aria-label', maximized ? '还原' : '最大化');
  }

  /* ============================================================
     NOTIFICATIONS
     ============================================================ */

  function pushNotice(notice) {
    notices.unshift({ id: ++noticeSeq, unread: true, time: Date.now(), ...notice });
    if (notices.length > 12) notices.length = 12;
    renderNotifications();
    els.bellDot.classList.remove('is-hidden');
  }

  function noticeTime(notice) {
    const diff = Date.now() - notice.time;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    return `${Math.floor(diff / 3600000)} 小时前`;
  }

  function renderNotifications() {
    const hasUnread = notices.some((notice) => notice.unread);
    els.bellDot.classList.toggle('is-hidden', !hasUnread);
    els.markReadBtn.disabled = !hasUnread;
    els.notifFootText.textContent = notices.length ? `${notices.length} 条通知 · 本地生成` : '游戏库已就绪';

    if (!notices.length) {
      els.notifList.innerHTML = `
        <div class="notif-empty">
          <svg class="ic" aria-hidden="true"><use href="#i-bell"/></svg>
          <span>还没有通知</span>
          <em>启动游戏、结束会话时会在这里留下记录。</em>
        </div>`;
      return;
    }

    els.notifList.innerHTML = notices.map((notice, index) => `
      <button class="notif-item ${notice.unread ? '' : 'is-read'}" data-notice="${index}">
        <span class="notif-icon" style="--n-color:${notice.color || '#ffb45e'}">
          <svg class="ic" aria-hidden="true"><use href="#i-${notice.icon || 'spark'}"/></svg>
        </span>
        <div class="notif-copy">
          <div class="notif-title">${esc(notice.title)}</div>
          <div class="notif-sub">${esc(notice.sub || '')}</div>
          <div class="notif-time">${esc(noticeTime(notice))}</div>
        </div>
        <span class="notif-unread" aria-hidden="true"></span>
      </button>
    `).join('');
  }

  function openPopover(which) {
    const panel = which === 'notif' ? els.notifPanel : els.profileMenu;
    const button = which === 'notif' ? els.notifBtn : els.profileBtn;
    const wasOpen = panel.classList.contains('is-open');
    closePopovers();
    if (wasOpen) return;
    if (which === 'notif') renderNotifications();
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    button.setAttribute('aria-expanded', 'true');
    audio.select();
  }
