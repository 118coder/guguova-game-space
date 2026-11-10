// Page-side legibility probe, shared by the immersive sweep and the whole-page
// text audit. Keep one copy: a second implementation of "which pixel is the
// glyph" drifted from the first within a single afternoon.
//
// Inject with Runtime.evaluate after the page is ready. Provides:
//   __imPixels(a64, b64)  two frames of the same clip → contrast, plate, ink
//   __imRange(b64)        luminance-range fallback for gradient-filled type
//   __imInk(sel, hide)    toggle the "no ink" state for a selector
//   __imAudit(targets)    bounding boxes + computed type for a target list

const PAGE_PROBE = String.raw`
(() => {
  const $ = (s, r = document) => r.querySelector(s);

  window.__imAudit = async function (targets) {
    const out = [];
    for (const t of targets) {
      const el = $(t.sel);
      if (!el) { out.push({ key: t.key, missing: true }); continue; }
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) { out.push({ key: t.key, missing: true }); continue; }
      const cs = getComputedStyle(el);
      out.push({
        key: t.key,
        x: Math.round(rect.left), y: Math.round(rect.top),
        w: Math.round(rect.width), h: Math.round(rect.height),
        font: cs.fontFamily.split(',')[0].replace(/"/g, ''),
        size: parseFloat(cs.fontSize),
        weight: cs.fontWeight,
        tracking: cs.letterSpacing,
        transform: cs.textTransform,
        radius: cs.borderRadius,
        ink: cs.color,
        fill: cs.backgroundColor,
        fillImage: (cs.backgroundImage || 'none').slice(0, 60)
      });
    }
    return JSON.stringify(out);
  };

  /* Two-frame reading of one control.
     Frame A is the control as shipped, frame B is the same control with its
     ink made transparent. Whatever changed between the two frames IS the
     text and the icons — so a highlight, an inner border or a gradient cannot
     be mistaken for a glyph. The plate is the dominant colour of the
     unchanged pixels, the ink is the median of the strongest quarter of the
     changed ones, and WCAG contrast follows from those two. */
  window.__imPixels = function (a64, b64) {
    const load = (src) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = 'data:image/png;base64,' + src;
    });
    return Promise.all([load(a64), load(b64)]).then(([a, b]) => {
      if (!a || !b) return null;
      const read = (img) => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, img.width, img.height).data;
      };
      const A = read(a); const B = read(b);

      const buckets = new Map();
      const glyph = [];
      let total = 0;
      for (let i = 0; i < A.length; i += 4) {
        const dr = Math.abs(A[i] - B[i]);
        const dg = Math.abs(A[i + 1] - B[i + 1]);
        const db = Math.abs(A[i + 2] - B[i + 2]);
        if (dr + dg + db > 30) { glyph.push([A[i], A[i + 1], A[i + 2]]); continue; }
        if (A[i + 3] < 200) continue;
        const key = (A[i] >> 3) + ',' + (A[i + 1] >> 3) + ',' + (A[i + 2] >> 3);
        const entry = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
        entry.n++; entry.r += A[i]; entry.g += A[i + 1]; entry.b += A[i + 2];
        buckets.set(key, entry);
        total++;
      }
      if (!total || glyph.length < 12) return { contrast: null, glyph: glyph.length };
      let plate = null;
      for (const entry of buckets.values()) if (!plate || entry.n > plate.n) plate = entry;
      const plateRgb = [plate.r / plate.n, plate.g / plate.n, plate.b / plate.n];

      const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
      const plateL = lum(plateRgb);

      /* A glyph and the drop shadow under it sit on opposite sides of the
         plate, and the shadow can out-cover the letters (34px / 400 weight
         with a 2px hard shadow). Pick the side with the larger population —
         that is the ink — and read the stroke core inside it only. */
      const above = glyph.filter((c) => lum(c) > plateL);
      const below = glyph.filter((c) => lum(c) <= plateL);
      const median = (list, index) => {
        const values = list.map((c) => c[index]).sort((x, y) => x - y);
        return values[Math.floor(values.length / 2)];
      };
      /* Read both sides of the plate: the glyphs sit on one of them, the drop
         shadow on the other, and the label is by definition the side with the
         stronger contrast. Taking the larger population instead picked the
         shadow on a 34px headline and reported 1.26:1 for white type. */
      const readSide = (list) => {
        if (list.length < 8) return null;
        list.sort((p, q) => Math.abs(lum(q) - plateL) - Math.abs(lum(p) - plateL));
        /* 10%, not 30%: at 13px a glyph is 40–60 core pixels and hundreds of
           anti-aliased ones, so a third of the set reads as grey edge and
           reported 2.1:1 for white-on-charcoal type. */
        const core = list.slice(0, Math.max(4, Math.round(list.length * 0.1)));
        const rgb = [median(core, 0), median(core, 1), median(core, 2)];
        const value = lum(rgb);
        return { rgb, ratio: (Math.max(value, plateL) + 0.05) / (Math.min(value, plateL) + 0.05) };
      };
      const sides = [readSide(above.slice()), readSide(below.slice())].filter(Boolean);
      if (!sides.length) return { contrast: null, glyph: glyph.length };
      const win = sides.reduce((best, next) => (next.ratio > best.ratio ? next : best));
      const inkRgb = win.rgb;
      const ratio = win.ratio;
      return {
        contrast: Math.round(ratio * 100) / 100,
        plate: plateRgb.map(Math.round),
        ink: inkRgb,
        glyph: glyph.length
      };
    });
  };

  window.__imInk = function (sel, hide) {
    const el = document.querySelector(sel);
    if (!el) return 'missing';
    el.classList.toggle('is-im-inkless', !!hide);
    return hide ? 'hidden' : 'shown';
  };

  /* Display type can be painted with background-clip: text, so hiding the ink
     changes nothing between frames and the diff pass has nothing to bite on.
     For those, read the frame's own luminance range: a 30px headline covers
     enough of its box that the 92nd percentile is a stroke and the 8th is the
     plate behind it. */
  window.__imRange = function (b64) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const { data } = ctx.getImageData(0, 0, img.width, img.height);
        const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
        const list = [];
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 200) continue;
          list.push([lum([data[i], data[i + 1], data[i + 2]]), data[i], data[i + 1], data[i + 2]]);
        }
        if (list.length < 40) return resolve({ contrast: null });
        list.sort((p, q) => p[0] - q[0]);
        const pick = (q) => list[Math.min(list.length - 1, Math.round((list.length - 1) * q))];
        const hi = pick(0.975); const lo = pick(0.025);
        const ratio = (hi[0] + 0.05) / (lo[0] + 0.05);
        resolve({
          contrast: Math.round(ratio * 100) / 100,
          plate: [lo[1], lo[2], lo[3]],
          ink: [hi[1], hi[2], hi[3]],
          mode: 'range'
        });
      };
      img.onerror = () => resolve(null);
      img.src = 'data:image/png;base64,' + b64;
    });
  };

  // The diff pass needs the ink gone but the plate untouched, including
  // theme text-shadows and gradient text fills.
  const inkless = document.createElement('style');
  inkless.id = 'im-inkless';
  // The scope has to outrank the shell's own .hero-logo rule, which pins
  // -webkit-text-fill-color to currentColor with !important; a bare
  // .is-im-inkless * selector loses and the diff pass reads an empty frame.
  /* Two scopes on purpose: the bare one covers every sheet and dialog, the
     immersive one is the only selector that outranks the shell's own
     .hero-logo rule (which pins -webkit-text-fill-color to currentColor with
     !important). Without the bare scope, hiding text inside the detail sheet
     did nothing, the diff was empty and the fallback measured a button's
     edge instead of its label. */
  inkless.textContent =
    '.is-im-inkless,.is-im-inkless *{color:transparent!important;' +
    '-webkit-text-fill-color:transparent!important;text-shadow:none!important}' +
    '.is-im-inkless .ic,.is-im-inkless svg{opacity:0!important}' +
    'html.is-fullscreen .view-home .is-im-inkless,' +
    'html.is-fullscreen .view-home .is-im-inkless *{color:transparent!important;' +
    '-webkit-text-fill-color:transparent!important;text-shadow:none!important}' +
    'html.is-fullscreen .view-home .is-im-inkless .ic,' +
    'html.is-fullscreen .view-home .is-im-inkless svg{opacity:0!important}';
  if (document.head) document.head.appendChild(inkless);

  return 'ready';
})()
`;

module.exports = { PAGE_PROBE };
