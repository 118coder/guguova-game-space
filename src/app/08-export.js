/* ============================================================
   APP PART 08 · export —— 整页长截图导出 —— releaseForExport / settleForExport / finishExport（裁剪框取 .app、clip.scale=1）
   这是 src/app/ 分片之一：由 tools/build-app.js 按文件名序拼回 src/app.js。
   所有分片共享同一个 IIFE 闭包（跨分片直接引用函数与 state）。
   改代码请改分片，改完运行 node tools/build-app.js；直接编辑 app.js 会被覆盖。
   ============================================================ */

  /* ============================================================
     PAGE EXPORT — one image, the whole page
     ============================================================ */

  // The interface is a fixed-viewport shell: every view scrolls inside its own
  // box and the document itself never grows, so "the whole page" is not
  // something the host can ask for. For the length of one capture the height
  // chain is released instead — the active view leaves absolute positioning and
  // every box between <html> and the scroll container drops its fixed height,
  // max-height and overflow clip. The host then screenshots the resulting size
  // through the DevTools protocol, which is the only WebView2 surface that can
  // paint past the viewport. Everything is restored afterwards, down to the
  // inline priority, so the interface comes back exactly as it was.
  let exportJob = null;

  /** The element that actually scrolls the current view. */
  function exportScroller(root) {
    let best = root;
    let bestOverflow = 0;
    root.querySelectorAll('*').forEach((node) => {
      const overflow = node.scrollHeight - node.clientHeight;
      if (overflow <= bestOverflow + 4) return;
      const style = getComputedStyle(node);
      if (style.overflowY !== 'auto' && style.overflowY !== 'scroll') return;
      best = node;
      bestOverflow = overflow;
    });
    return best;
  }

  function releaseForExport(view) {
    const saved = [];
    const scroller = exportScroller(view);
    const chain = [];
    for (let node = scroller; node; node = node.parentElement) chain.unshift(node);

    const set = (node, prop, value) => {
      saved.push([node, prop, node.style.getPropertyValue(prop), node.style.getPropertyPriority(prop)]);
      node.style.setProperty(prop, value, 'important');
    };

    chain.forEach((node) => {
      set(node, 'height', 'auto');
      set(node, 'max-height', 'none');
      set(node, 'overflow', 'visible');
    });
    // In flow the view is what gives the document its height; absolute and
    // inset:0 it would report zero.
    set(view, 'position', 'static');

    const scrollTops = chain.map((node) => node.scrollTop);
    // The document really is that tall while the capture runs, so the root
    // scrollbar would be painted down the right edge of the image.
    document.documentElement.dataset.exporting = '1';

    const restore = () => {
      for (let i = saved.length - 1; i >= 0; i -= 1) {
        const [node, prop, value, priority] = saved[i];
        if (value) node.style.setProperty(prop, value, priority);
        else node.style.removeProperty(prop);
      }
      chain.forEach((node, index) => { node.scrollTop = scrollTops[index] || 0; });
      delete document.documentElement.dataset.exporting;
    };
    return { restore, scroller };
  }

  /**
   * Waits until the released layout has stopped growing. Covers are <img>
   * elements: the grid is shorter until each decode lands, and a height
   * measured too early leaves the last row cut in half — exactly one frame of
   * difference, in the one place nobody looks until the file is open.
   */
  async function settleForExport(root) {
    const fonts = document.fonts && document.fonts.ready ? document.fonts.ready.catch(() => {}) : Promise.resolve();
    const images = Array.from(root.querySelectorAll('img'))
      .filter((img) => !img.complete)
      .map((img) => new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      }));
    await Promise.race([
      Promise.all([fonts, ...images]),
      new Promise((resolve) => setTimeout(resolve, 1500))
    ]);
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }

  function finishExport(payload) {
    if (!exportJob) return;
    clearTimeout(exportJob.timer);
    try { exportJob.restore(); } catch (error) { console.warn('export restore', error); }
    exportJob = null;

    if (!payload || payload.ok === false) {
      const reason = payload && payload.error ? ` · ${payload.error}` : '';
      toast(`导出失败${reason}`, 'alert');
      return;
    }
    toast(`已导出 ${payload.width}×${payload.height} · ${payload.folder}`, 'camera');
  }

  async function exportScreenshot() {
    if (!hasBridge || exportJob) return;
    if (state.overlay) {
      toast('先关闭当前窗口再导出', 'info');
      return;
    }
    const view = document.querySelector('.view.is-current');
    if (!view) return;
    audio.select();

    const { restore, scroller } = releaseForExport(view);
    // One frame for the layout pass, then wait for the covers to finish
    // decoding — the grid gets taller as they land.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await settleForExport(view);

    // The capture frame is the app surface itself, not the document. The
    // document is bigger than what the player sees: the backdrop layers hang
    // outside the shell on purpose (`.scene-stack` is inset -3%), so asking for
    // the document hands back a ring of background art around the interface.
    const app = document.querySelector('.app');
    const appBox = app ? app.getBoundingClientRect() : null;
    const viewBox = view.getBoundingClientRect();
    const scrollerBox = scroller.getBoundingClientRect();
    const scrollTop = window.scrollY || 0;
    const width = Math.ceil(Math.max(appBox ? appBox.width : 0, document.documentElement.clientWidth));
    // Four candidates, because every one of them can be the shortest on some
    // view: the flex child bottom, the shell box, the scrolled content, and the
    // scroll container's own content height.
    const height = Math.ceil(Math.max(
      viewBox.bottom + scrollTop,
      appBox ? appBox.height : 0,
      view.scrollHeight,
      scrollerBox.top + scroller.scrollHeight + scrollTop
    ));
    if (width < 2 || height < 2) {
      restore();
      toast('没有可导出的内容', 'info');
      return;
    }

    // 1 = one image pixel per CSS pixel, times the display scale factor, which
    // Chromium applies on its own. Passing devicePixelRatio here as well
    // multiplies it twice: a 125% display came back at 1.5625x, 56% more pixels
    // than the screen has.
    const scale = 1;
    const background = getComputedStyle(document.body).backgroundColor;
    exportJob = {
      restore,
      timer: setTimeout(() => finishExport({ ok: false, error: '导出超时' }), 25000)
    };
    try {
      const result = await call('capturePage', { view: view.id || 'page', width, height, scale, background });
      if (result && result.ok === false) finishExport(result);
    } catch (error) {
      finishExport({ ok: false, error: '无法连接宿主' });
    }
  }
