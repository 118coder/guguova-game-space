// Diagnostic: does --logo-fit actually scale this theme's hero title?
const { connect } = require('./lib/cdp.js');
const theme = process.argv[2] || 'broadcast';
(async () => {
  const cdp = await connect();
  console.log(await cdp.ev(`(async () => {
    await window.NovaTheme.activate('${theme}', { silent: true });
    document.querySelector('.nav-btn[data-nav="home"]').click();
    await new Promise((r) => setTimeout(r, 800));
    const l = document.querySelector('#gameLogo');
    const rule = getComputedStyle(l).fontSize;
    l.style.setProperty('--logo-fit', '0.5');
    await new Promise((r) => requestAnimationFrame(r));
    const half = getComputedStyle(l).fontSize;
    l.style.removeProperty('--logo-fit');
    if (window.NovaDev) window.NovaDev.stressTitle('沉睡的法则 THINGS AS THEY ARE 终章');
    await new Promise((r) => setTimeout(r, 700));
    const s = getComputedStyle(l);
    const r = document.createRange(); r.selectNodeContents(l);
    return JSON.stringify({
      theme: document.documentElement.dataset.theme,
      fontAtFit1: rule, fontAtFitHalf: half, fitResponsive: rule !== half,
      afterStress: {
        fit: l.style.getPropertyValue('--logo-fit'), fontSize: s.fontSize,
        available: l.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight),
        textW: Math.round(r.getBoundingClientRect().width),
        scrollOver: l.scrollWidth - l.clientWidth
      }
    }, null, 1);
  })()`));
  cdp.close();
})().catch((e) => { console.error(String(e).slice(0, 400)); process.exit(1); });
