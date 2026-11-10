/* ============================================================
   APP PART 06 · utils —— 通用工具函数（格式化、防抖、颜色基础等）
   这是 src/app/ 分片之一：由 tools/build-app.js 按文件名序拼回 src/app.js。
   所有分片共享同一个 IIFE 闭包（跨分片直接引用函数与 state）。
   改代码请改分片，改完运行 node tools/build-app.js；直接编辑 app.js 会被覆盖。
   ============================================================ */

  /* ============================================================
     UTILITIES
     ============================================================ */

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  /**
   * Normalises a path a player typed or pasted.
   *
   * Explorer's "Copy as path" (and most chat apps) hand you a quoted string:
   *   "E:\Game\DFO 110 登录器.exe"
   * Pasting that straight into a field produced a path whose first character
   * is a quote, so File.Exists() said no and the launcher reported "请选择
   * 一个存在的可执行文件" — the file was right there. The same thing made a
   * cover image silently fall back to the executable icon.
   *
   * Strips one layer of surrounding quotes (straight or typographic), plus the
   * trailing space Windows adds, and drops a leading file:// scheme. Interior
   * spaces are never touched: "DFO 110 登录器.exe" is a legal name.
   */
  function cleanPath(value) {
    let path = String(value ?? '').trim();
    if (!path) return '';
    // Repeated because a doubly-quoted paste happens when copying from JSON.
    for (let i = 0; i < 2; i += 1) {
      const before = path;
      path = path
        .replace(/^["'\u201c\u201d\u2018\u2019]+/, '')
        .replace(/["'\u201c\u201d\u2018\u2019]+$/, '')
        .trim();
      if (path === before) break;
    }
    if (/^file:\/\/\/?/i.test(path)) {
      path = decodeURIComponent(path.replace(/^file:\/\/\/?/i, ''));
    }
    return path;
  }

  // Path normalisation for the other renderer modules (overlays.js picker
  // path bar): one quote/file-scheme stripper, shared instead of copied.
  window.NovaPaths = { clean: cleanPath };

