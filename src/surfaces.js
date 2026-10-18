(() => {
  'use strict';

  /* ============================================================
     NOVA · SURFACE / MODE REGISTRY
     A mode is a named overlay with a small descriptor: selector,
     body attribute, whether the shell becomes inert, and an
     optional initial focus target. app.js owns the business state;
     this module owns the shared DOM contract, so adding a surface
     does not mean copying another open/close block.

       NovaSurfaces.register('collection', {
         selector: '#collectionOverlay',
         bodyKey: 'surface',
         inertApp: true,
         focus: '#collectionClose'
       });

       NovaSurfaces.open('collection');
       NovaSurfaces.close('collection');
     ============================================================ */

  const SURFACES = new Map([
    ['library', { selector: '#libraryOverlay', inertApp: true }],
    ['appearance', { selector: '#appearanceOverlay', inertApp: true }],
    ['details', { selector: '#detailsOverlay', inertApp: true }],
    ['editor', { selector: '#editorOverlay', inertApp: true }],
    ['scanner', { selector: '#scannerOverlay', inertApp: true }],
    ['picker', { selector: '#pickerOverlay', inertApp: true }],
    ['launch', { selector: '#launchOverlay', inertApp: true, bodyKey: 'overlay' }],
    ['sleep', { selector: '#sleepOverlay', inertApp: true, bodyKey: 'overlay' }]
  ]);

  const state = { open: new Set(), lastFocus: new Map() };

  function register(id, descriptor) {
    if (!id || !descriptor || !descriptor.selector) throw new Error('surface needs an id and selector');
    SURFACES.set(id, Object.assign({ inertApp: true, bodyKey: 'surface' }, descriptor));
    return SURFACES.get(id);
  }

  function shell() {
    return document.getElementById('app');
  }

  function open(id, options = {}) {
    const surface = SURFACES.get(id);
    if (!surface) return null;
    const el = document.querySelector(surface.selector);
    if (!el) return null;

    state.open.add(id);
    state.lastFocus.set(id, options.remember || document.activeElement);

    el.classList.remove('is-leaving');
    el.classList.add(surface.openClass || 'is-open');
    el.setAttribute('aria-hidden', 'false');
    document.body.dataset[surface.bodyKey || 'surface'] = id;

    if (surface.inertApp && shell()) shell().inert = true;

    const focusSelector = options.focus || surface.focus;
    if (focusSelector) {
      setTimeout(() => {
        try { document.querySelector(focusSelector)?.focus({ preventScroll: true }); } catch (error) {}
      }, options.focusDelay ?? 90);
    }
    return el;
  }

  function close(id, options = {}) {
    const surface = SURFACES.get(id);
    if (!surface) return null;
    const el = document.querySelector(surface.selector);
    if (!el) return null;

    state.open.delete(id);
    if (options.leaving) el.classList.add('is-leaving');
    el.classList.remove(surface.openClass || 'is-open');
    if (!options.leaving) el.classList.remove('is-leaving');
    el.setAttribute('aria-hidden', 'true');

    if (document.body.dataset[surface.bodyKey || 'surface'] === id) {
      delete document.body.dataset[surface.bodyKey || 'surface'];
    }
    if (surface.inertApp && !state.open.size && shell()) shell().inert = false;

    const focusTarget = options.focus === false ? null : (options.focus || surface.restoreFocus || state.lastFocus.get(id));
    state.lastFocus.delete(id);
    if (focusTarget && document.contains(focusTarget)) {
      setTimeout(() => {
        try { focusTarget.focus({ preventScroll: true }); } catch (error) {}
      }, options.focusDelay ?? 70);
    }
    return el;
  }

  function isOpen(id) { return state.open.has(id); }

  window.NovaSurfaces = {
    register,
    open,
    close,
    isOpen,
    get ids() { return Array.from(SURFACES.keys()); }
  };
})();
