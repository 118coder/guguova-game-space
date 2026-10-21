// Page-side view drivers shared by the screenshot tools.
//
// One copy of "click through to this screen and audit the layout" so the live
// capture (tools/export-all.js) and the headless capture (tools/headless-shots.js)
// can never drift apart. Injected with Runtime.evaluate before any capture.
//
// NOTE: the body is a String.raw template that runs in the page. Do not add
// backticks or ${} interpolation inside it.

const HELPERS = String.raw`
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (sel) => { const el = typeof sel === 'string' ? $(sel) : sel; if (el) el.click(); return !!el; };

  const OVERLAY_SELECTORS = [
    '#detailsOverlay', '#editorOverlay', '#scannerOverlay', '#dialogOverlay',
    '#pickerOverlay', '#launchOverlay', '#sleepOverlay', '#contextMenu',
    '#notifPanel', '#profileMenu', '#introOverlay'
  ];

  function closeOverlays() {
    OVERLAY_SELECTORS.forEach((sel) => {
      const el = $(sel);
      if (!el) return;
      el.classList.remove('is-open', 'is-ready', 'is-leaving', 'is-igniting', 'is-error');
      el.setAttribute('aria-hidden', 'true');
    });
    $$('.is-open').forEach((el) => { if (!el.classList.contains('view')) el.classList.remove('is-open'); });
    const cm = $('#contextMenu');
    if (cm) { cm.classList.remove('is-open'); cm.innerHTML = ''; }
  }

  async function reset() {
    closeOverlays();
    // The DOM-only close above cannot clear the app's own overlay state, and the
    // nav buttons ignore clicks while state.overlay is set — so after a view
    // like 'sleep' every later view switch silently no-ops and the capture shows
    // the wrong screen (this is what made the appearance-only widgets come out
    // empty). The app exposes a real reset for exactly this.
    // (String.raw template: no backticks in this file's page-side code.)
    if (window.NovaDev && window.NovaDev.resetSurfaces) {
      try { window.NovaDev.resetSurfaces(); } catch (error) { /* older build */ }
    }
    const intro = $('#introOverlay');
    if (intro) intro.dataset.done = '1';
    document.body.classList.remove('is-intro', 'is-busy');
    click('.nav-btn[data-nav="home"]');
    await sleep(300);
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await sleep(120);
  }

  function firstRailCard() {
    return $('.rail .tile, .rail .game-tile, .rail > *');
  }

  async function setup(view) {
    // Every view starts from the game's real name; only home-stress swaps in the
    // hostile one, and it is restored the moment any other view is set up, so a
    // capture can never silently show the QA title.
    if (view !== 'home-stress' && window.__novaStress) await window.__novaStress(false);
    await reset();
    switch (view) {
      case 'home':
        break;
      case 'home-row':
        { const btn = $('#layoutBtn'); if (btn && btn.getAttribute('aria-pressed') !== 'false') btn.click(); await sleep(700); }
        break;
      case 'home-stress':
        if (window.__novaStress) await window.__novaStress(true);
        click('.nav-btn[data-nav="home"]');
        await sleep(900);
        break;
      case 'library':
      case 'library-search':
      case 'library-select':
        click('.nav-btn[data-nav="library"]');
        await sleep(700);
        if (view === 'library-select') {
          const wrap = $('.lib-sort .nova-select');
          const hit = wrap && wrap.querySelector('.nova-select-hit');
          const menu = wrap && wrap.querySelector('.nova-select-menu');
          if (hit && menu && menu.hidden) hit.click();
          await sleep(320);
        }
        if (view === 'library-search') {
          const input = $('#libSearch');
          if (input) { input.focus(); input.value = 'a'; input.dispatchEvent(new Event('input', { bubbles: true })); }
          await sleep(500);
        }
        break;
      case 'appearance':
        click('.nav-btn[data-nav="appearance"]');
        await sleep(800);
        break;
      case 'appearance-framing':
        click('.nav-btn[data-nav="appearance"]');
        await sleep(800);
        click('#appearanceEditBtn');
        await sleep(500);
        break;
      case 'settings':
        click('.nav-btn[data-nav="settings"]');
        await sleep(800);
        break;
      case 'detail':
        click('#detailBtn');
        await sleep(800);
        break;
      case 'context': {
        const card = firstRailCard();
        if (card) {
          const rect = card.getBoundingClientRect();
          card.dispatchEvent(new MouseEvent('contextmenu', {
            bubbles: true, cancelable: true, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2
          }));
        }
        await sleep(420);
        break;
      }
      case 'import':
        click('#addBtn');
        await sleep(1000);
        break;
      case 'scanner':
        // + opens the import sheet; the scan itself is the "auto" branch.
        click('#addBtn');
        await sleep(700);
        click('#importGo');
        await sleep(2800);
        break;
      case 'engine':
        click('#homeEngineBtn');
        await sleep(900);
        break;
      case 'editor':
        click('.nav-btn[data-nav="library"]');
        await sleep(500);
        click('#libAdd');
        await sleep(800);
        break;
      case 'dialog':
        if (window.NovaOverlays && window.NovaOverlays.dialog) {
          window.NovaOverlays.dialog({
            title: '移除这款游戏？',
            text: '只会从启动器列表中移除，不会删除磁盘上的游戏文件。',
            confirmLabel: '移除',
            cancelLabel: '取消'
          });
        }
        await sleep(420);
        break;
      case 'notif':
        click('#notifBtn');
        await sleep(500);
        break;
      case 'profile':
        click('#profileBtn');
        await sleep(500);
        break;
      case 'launching': {
        const el = $('#launchOverlay');
        if (el) { el.classList.add('is-open'); el.setAttribute('aria-hidden', 'false'); }
        await sleep(600);
        break;
      }
      case 'sleep':
        if (window.NovaApp && window.NovaApp.sleep) window.NovaApp.sleep();
        else {
          const el = $('#sleepOverlay');
          if (el) { el.classList.add('is-open'); el.setAttribute('aria-hidden', 'false'); }
        }
        await sleep(700);
        break;
      case 'intro': {
        const el = $('#introOverlay');
        if (el) { el.classList.add('is-open'); el.setAttribute('aria-hidden', 'false'); el.dataset.intro = el.dataset.intro || 'gilded'; }
        if (window.NovaIntro && window.NovaIntro.play) { try { window.NovaIntro.play(); } catch (e) {} }
        await sleep(1200);
        break;
      }
      default:
        break;
    }
    await sleep(240);
    return view;
  }

  // Layout audit for the project's hard rules: no clipped text, no
  // horizontal overflow, no decoration covering the title.
  function audit() {
    const issues = [];
    const text = (el) => (el.textContent || '').trim();
    const isVisible = (el) => {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };

    // 文字宿主 = 叶子文本节点，或 class 含 'logo' 的元素（setLogo 会把主标题/
    // 副标题拆成 span，但它是主体文字，必须照样检查）。其余「有元素子节点」的
    // 容器不算：它们的溢出是装饰出血（RIOT 右缘裁切的黑胶、RISO 越界的 AA）
    // 或隐藏 overlay 的盒子，报出来只会变成假警报。
    // 注意：这段代码在 String.raw 模板里，注入到页面执行——**不要用反引号**。
    const isTextHost = (el) => !el.children.length || el.classList.contains('logo');

    Array.from(document.querySelectorAll('body *')).forEach((el) => {
      if (!isVisible(el)) return;
      const content = text(el);
      if (!content || !isTextHost(el)) return;
      const s = getComputedStyle(el);
      const sel = el.id ? '#' + el.id : (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : el.tagName.toLowerCase());
      const clippedX = el.scrollWidth > el.clientWidth + 1
        && (s.overflowX === 'hidden' || s.overflowX === 'clip' || s.textOverflow === 'ellipsis');
      const clippedY = el.scrollHeight > el.clientHeight + 1
        && (s.overflowY === 'hidden' || s.overflowY === 'clip');
      // 两个轴分开报：以前只报 x，纵向被切的 4px 墨迹会被横向溢出「顶掉」，
      // 于是 nova/appearance 那一条真截断差点没被发现。
      if (clippedX) {
        issues.push({ kind: 'clip', selector: sel, text: content.slice(0, 40), axis: 'x', overflow: el.scrollWidth - el.clientWidth });
      }
      if (clippedY) {
        issues.push({ kind: 'clip', selector: sel, text: content.slice(0, 40), axis: 'y', overflow: el.scrollHeight - el.clientHeight });
      }
    });

    const doc = document.documentElement;
    const overflowX = doc.scrollWidth - window.innerWidth;
    const logo = $('#gameLogo') || $('.detail-logo') || $('.appearance-logo');
    let logoInfo = null;
    if (logo) {
      const s = getComputedStyle(logo);
      const r = logo.getBoundingClientRect();
      // Iron rules #3/#4 are about *text*, so measure the text run itself
      // against the content box. scrollWidth additionally counts a theme's
      // decorative pseudo elements (ghost words, side tags) which are meant to
      // bleed past the box — that is a design choice, reported separately as
      // decoOver so it never masks a real truncation.
      const padX = (parseFloat(s.paddingLeft) || 0) + (parseFloat(s.paddingRight) || 0);
      const range = document.createRange();
      range.selectNodeContents(logo);
      const textW = range.getBoundingClientRect().width;
      const available = logo.clientWidth - padX;
      logoInfo = {
        fit: s.getPropertyValue('--logo-fit').trim(),
        font: s.fontFamily,
        size: Math.round(parseFloat(s.fontSize) * 10) / 10,
        width: Math.round(r.width),
        text: text(logo),
        textOver: Math.max(0, Math.round(textW - available)),
        available: Math.round(available),
        decoOver: Math.max(0, logo.scrollWidth - logo.clientWidth)
      };
    }
    return {
      overflowX,
      scrollWidth: doc.scrollWidth,
      innerWidth: window.innerWidth,
      scrollHeight: doc.scrollHeight,
      innerHeight: window.innerHeight,
      logo: logoInfo,
      issues: issues.slice(0, 40),
      issueCount: issues.length
    };
  }

  // Iron rule #4: the hero title must survive 30 characters plus redundancy.
  // Drives app.js's own render path (window.NovaDev) instead of the DOM, so the
  // badge gutter and the fit loop are exercised for real. The exact string is
  // supplied by the Node side (window.__novaStressText) so this file owns it.
  // Passing a falsy value puts the game's real name back, so a later view is
  // never captured with the hostile title still in place.
  window.__novaStress = async function (on) {
    if (!on) {
      if (window.NovaDev && window.NovaDev.stressTitle) return window.NovaDev.stressTitle(null);
      return 'off';
    }
    const long = window.__novaStressText || '沉睡的法则 THINGS AS THEY ARE 终章';
    if (window.NovaDev && window.NovaDev.stressTitle) return window.NovaDev.stressTitle(long);
    const logo = $('#gameLogo');
    if (logo) logo.textContent = long;
    return 'fallback';
  };

  // Individual widgets, cropped out of the live page. The four iron rules are
  // about "every interface", not just whole views, and a button that clips its
  // own label is invisible in a full-window screenshot. Each part is reported as
  // a viewport-relative rect so the Node side can ask the browser to clip to it.
  // NOTE: this whole block is a String.raw template — no backticks allowed here.
  const PART_SELECTORS = [
    ['nav-active', '.nav-btn.is-active'],
    ['nav-idle', '.nav-btn:not(.is-active)'],
    ['tile-active', '.dock .tile.is-active'],
    ['tile-idle', '.dock .tile:not(.is-active)'],
    ['cta-primary', '.btn.primary'],
    ['cta-secondary', '.btn:not(.primary):not(.ghost)'],
    ['theme-card-active', '.theme-card.is-active'],
    ['theme-card-idle', '.theme-card:not(.is-active)'],
    ['progress-fill', '#appearanceProgressFill'],
    ['toggle', '.switch, .appearance-switch']
  ];

  const parts = function (pad) {
    const padPx = Number(pad) || 8;
    const visible = (el) => {
      if (!el) return false;
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width > 2 && r.height > 2;
    };
    const found = [];
    PART_SELECTORS.forEach(([name, sel]) => {
      const el = Array.from(document.querySelectorAll(sel)).find(visible);
      if (!el) return;
      const r = el.getBoundingClientRect();
      found.push({
        name,
        selector: sel,
        rect: {
          x: Math.max(0, Math.round(r.left - padPx)),
          y: Math.max(0, Math.round(r.top - padPx)),
          width: Math.round(r.width + padPx * 2),
          height: Math.round(r.height + padPx * 2)
        },
        label: (el.textContent || '').trim().slice(0, 30)
      });
    });
    return found;
  };

  window.__novaExport = { reset, setup, audit, closeOverlays, parts };
  return 'ready';
})()
`;

module.exports = { HELPERS };
