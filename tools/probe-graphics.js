// Iron rule #1 check: a theme's hero title carries decorative pseudo elements
// that deliberately bleed outside the logo box. Bleed is fine — overlapping a
// neighbour's *text* is not. This measures the bleed band and tests it against
// every visible text run on screen.
//
//   node tools/probe-graphics.js                 # all themes, stressed title
//   node tools/probe-graphics.js broadcast summer
const { connect } = require('./lib/cdp.js');
const FILTER = process.argv.slice(2);

(async () => {
  const cdp = await connect();
  const themes = await cdp.ev(
    `(() => window.NovaTheme.themes.map((t) => t.id))()`,
    { hard: true }
  );
  const list = FILTER.length ? themes.filter((t) => FILTER.includes(t)) : themes;

  for (const theme of list) {
    const report = await cdp.ev(`(async () => {
      await window.NovaTheme.activate(${JSON.stringify(theme)}, { silent: true });
      document.querySelector('.nav-btn[data-nav="home"]').click();
      await new Promise((r) => setTimeout(r, 650));
      if (window.NovaDev) window.NovaDev.stressTitle('沉睡的法则 THINGS AS THEY ARE 终章');
      await new Promise((r) => setTimeout(r, 700));

      const logo = document.querySelector('#gameLogo');
      if (!logo) return { theme: ${JSON.stringify(theme)}, skip: 'no logo' };
      const r = logo.getBoundingClientRect();
      const overX = Math.max(0, logo.scrollWidth - logo.clientWidth);
      const overY = Math.max(0, logo.scrollHeight - logo.clientHeight);
      if (overX <= 1 && overY <= 1) return { theme: ${JSON.stringify(theme)}, bleed: 0, hits: [] };

      // The bleed band: everything the logo paints beyond its own border box.
      const band = { x: r.right - 1, y: r.top - overY, w: overX + 1, h: r.height + overY };
      const hits = [];
      document.querySelectorAll('*').forEach((el) => {
        if (logo.contains(el)) return;
        const hasText = [...el.childNodes].some((n) =>
          n.nodeType === 3 && n.textContent.trim() && getComputedStyle(n.parentElement).visibility !== 'hidden');
        if (!hasText) return;
        const t = el.getBoundingClientRect();
        if (!t.width || !t.height) return;
        const ix = Math.max(0, Math.min(band.x + band.w, t.right) - Math.max(band.x, t.left));
        const iy = Math.max(0, Math.min(band.y + band.h, t.bottom) - Math.max(band.y, t.top));
        if (ix * iy > 12) hits.push({
          sel: el.id ? '#' + el.id : el.className || el.tagName,
          text: el.textContent.trim().slice(0, 24),
          overlap: Math.round(ix) + 'x' + Math.round(iy)
        });
      });
      return { theme: ${JSON.stringify(theme)}, bleed: Math.round(overX) + 'x' + Math.round(overY),
               band: Math.round(band.x) + ',' + Math.round(band.y), hits: hits.slice(0, 6) };
    })()`);
    const hits = report.hits || [];
    console.log(
      `${String(report.theme).padEnd(10)} bleed=${String(report.bleed).padEnd(8)}` +
      (hits.length ? `⚠ ${hits.length} text overlap: ${hits.map((h) => `${h.sel}(${h.overlap})`).join(' ')}` : 'clear')
    );
  }
  cdp.close();
})().catch((e) => { console.error(String(e).slice(0, 400)); process.exit(1); });
