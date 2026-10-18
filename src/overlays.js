(() => {
  'use strict';

  /* ============================================================
     NOVA · OVERLAYS
     In-app dialog + file browser. The host never shows a stock
     Windows message box or file picker over the interface.
     ============================================================ */

  const DIALOG_ICONS = {
    info: 'info',
    question: 'question',
    warning: 'warning',
    alert: 'alert',
    check: 'check',
    power: 'close',
    folder: 'folder',
    image: 'image',
    trash: 'trash'
  };

  const PICKER_COPY = {
    exe: {
      kicker: 'SELECT · EXECUTABLE',
      title: '选择游戏程序',
      note: '选中后会读取同名清单，或从程序图标生成封面'
    },
    image: {
      kicker: 'SELECT · ARTWORK',
      title: '选择封面或主视觉',
      note: '建议 16:9，至少 1920×1080'
    },
    manifest: {
      kicker: 'SELECT · MANIFEST',
      title: '选择 nova-game.json',
      note: '清单会填好名称、介绍与配色'
    },
    any: {
      kicker: 'SELECT · FILE',
      title: '选择文件',
      note: ''
    }
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));

  const state = {
    dialogResolve: null,
    picker: null
  };

  let els = null;
  let app = null;
  let sound = null;
  let call = null;

  /* ---------- dialog ---------- */

  function closeDialog(value) {
    const resolve = state.dialogResolve;
    state.dialogResolve = null;
    els.dialogOverlay.classList.add('is-leaving');
    setTimeout(() => {
      els.dialogOverlay.classList.remove('is-open', 'is-leaving');
      els.dialogOverlay.setAttribute('aria-hidden', 'true');
      if (resolve) resolve(value);
    }, 180);
  }

  /**
   * Shows an in-app dialog.
   * options: { title, text, icon, tone, actions: [{ label, value, style, icon }] }
   * Resolves with the chosen action value.
   */
  function dialog(options = {}) {
    if (state.dialogResolve) closeDialog(null);
    const actions = options.actions && options.actions.length
      ? options.actions
      : [{ label: '好', value: true, style: 'primary' }];

    els.dialogTitle.textContent = options.title || '提示';
    els.dialogText.textContent = options.text || '';
    const use = els.dialogMark.querySelector('use');
    if (use) use.setAttribute('href', `#i-${DIALOG_ICONS[options.icon] || 'info'}`);
    els.dialogMark.classList.toggle('is-warning', options.tone === 'warning');

    els.dialogActions.innerHTML = actions.map((action, index) => {
      const style = action.style === 'primary' ? ' is-primary' : action.style === 'danger' ? ' is-danger' : '';
      const icon = action.icon ? `<svg class="ic" aria-hidden="true"><use href="#i-${action.icon}"/></svg>` : '';
      return `<button class="dialog-action${style}" data-dialog-index="${index}" type="button">${icon}<span>${esc(action.label)}</span></button>`;
    }).join('');

    els.dialogOverlay.classList.remove('is-leaving');
    els.dialogOverlay.classList.add('is-open');
    els.dialogOverlay.setAttribute('aria-hidden', 'false');
    if (sound) sound.open();

    const primary = els.dialogActions.querySelector('.is-primary') || els.dialogActions.querySelector('button');
    setTimeout(() => { try { primary.focus({ preventScroll: true }); } catch (error) {} }, 130);

    return new Promise((resolve) => {
      state.dialogResolve = resolve;
      els.dialogActions.onclick = (event) => {
        const button = event.target.closest('[data-dialog-index]');
        if (!button) return;
        const action = actions[Number(button.dataset.dialogIndex)];
        if (sound) sound.select();
        closeDialog(action ? action.value : null);
      };
    });
  }

  function dialogOpen() {
    return !!state.dialogResolve;
  }

  /* ---------- file browser ---------- */

  function formatBytes(bytes) {
    if (!bytes) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
    return `${value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
  }

  function pickerOpen(options = {}) {
    if (state.picker) return Promise.resolve(null);
    const filter = options.filter || 'any';
    const copy = PICKER_COPY[filter] || PICKER_COPY.any;

    els.pickerKicker.textContent = copy.kicker;
    els.pickerTitle.textContent = options.title || copy.title;
    els.pickerNote.textContent = options.note || copy.note;
    els.pickerHidden.checked = false;
    els.pickerConfirm.disabled = true;
    els.pickerPath.textContent = '—';

    state.picker = { filter, path: options.startPath || null, selected: null, entries: [], resolve: null };

    els.pickerOverlay.classList.remove('is-leaving');
    els.pickerOverlay.classList.add('is-open');
    els.pickerOverlay.setAttribute('aria-hidden', 'false');
    if (app) app.inert = true;
    if (sound) sound.open();

    const promise = new Promise((resolve) => { if (state.picker) state.picker.resolve = resolve; });
    navigate(options.startPath || '');
    setTimeout(() => { try { els.pickerClose.focus({ preventScroll: true }); } catch (error) {} }, 120);
    return promise;
  }

  function pickerClose(value) {
    const picker = state.picker;
    if (!picker) return;
    state.picker = null;
    els.pickerOverlay.classList.remove('is-open');
    els.pickerOverlay.setAttribute('aria-hidden', 'true');
    if (app) app.inert = false;
    if (sound && (value === null || value === undefined)) sound.close();
    if (picker.resolve) picker.resolve(value ?? null);
  }

  function pickerConfirmSelection() {
    const picker = state.picker;
    if (!picker || !picker.selected) return;
    const value = picker.selected.path;
    state.picker = null;
    els.pickerOverlay.classList.remove('is-open');
    els.pickerOverlay.setAttribute('aria-hidden', 'true');
    if (app) app.inert = false;
    if (sound) sound.confirm();
    if (picker.resolve) picker.resolve(value);
  }

  async function navigate(path) {
    const picker = state.picker;
    if (!picker) return;
    const result = await call('browse', {
      path,
      filter: picker.filter,
      hidden: els.pickerHidden.checked
    });
    if (!state.picker) return;

    if (!result || !result.ok) {
      els.pickerList.innerHTML = `<div class="picker-empty">${esc((result && result.error) || '无法打开这个文件夹')}</div>`;
      return;
    }

    picker.path = result.path;
    picker.selected = null;
    els.pickerConfirm.disabled = true;
    els.pickerPath.textContent = result.path;
    els.pickerPath.title = result.path;
    els.pickerUp.disabled = !result.parent;
    els.pickerUp.dataset.parent = result.parent || '';

    const drives = result.drives || [];
    els.pickerDrives.innerHTML = drives.map((drive, index) => {
      const active = String(result.path).toLowerCase().startsWith(String(drive.path).toLowerCase());
      return `<button class="drive-chip${active ? ' is-active' : ''}" data-drive-index="${index}" type="button">
        <svg class="ic" aria-hidden="true"><use href="#i-drive"/></svg>
        <span>${esc(drive.name)}</span>
      </button>`;
    }).join('');
    els.pickerDrives.dataset.paths = JSON.stringify(drives.map((drive) => drive.path));

    const folders = result.dirs || [];
    const files = result.files || [];
    picker.entries = folders.concat(files);

    if (!picker.entries.length) {
      els.pickerList.innerHTML = '<div class="picker-empty">这个文件夹里没有可选项</div>';
      return;
    }

    els.pickerList.innerHTML = picker.entries.map((entry, index) => {
      const isDir = entry.kind === 'dir';
      return `<button class="picker-row ${isDir ? 'is-dir' : 'is-file'}" data-pick="${index}" type="button" title="${esc(entry.path)}">
        <svg class="ic" aria-hidden="true"><use href="#${isDir ? 'i-folder-fill' : 'i-file'}"/></svg>
        <span class="picker-name">${esc(entry.name)}</span>
        <span class="picker-meta">${isDir ? '' : formatBytes(entry.size)}</span>
      </button>`;
    }).join('');
    els.pickerList.scrollTop = 0;
  }

  function choose(index) {
    const picker = state.picker;
    if (!picker) return;
    const entry = picker.entries[index];
    if (!entry) return;

    if (entry.kind === 'dir') {
      if (sound) sound.move(1);
      navigate(entry.path);
      return;
    }

    picker.selected = entry;
    $$('.picker-row', els.pickerList).forEach((row) => {
      row.classList.toggle('is-selected', row.dataset.pick === String(index));
    });
    els.pickerConfirm.disabled = false;
    els.pickerNote.textContent = entry.path;
    if (sound) sound.select();
  }

  /* ---------- wiring ---------- */

  function bind(options) {
    app = options.app;
    sound = options.sound;
    call = options.call;

    els = {
      dialogOverlay: $('#dialogOverlay'),
      dialogMark: $('#dialogMark'),
      dialogTitle: $('#dialogTitle'),
      dialogText: $('#dialogText'),
      dialogActions: $('#dialogActions'),
      pickerOverlay: $('#pickerOverlay'),
      pickerKicker: $('#pickerKicker'),
      pickerTitle: $('#pickerTitle'),
      pickerClose: $('#pickerClose'),
      pickerUp: $('#pickerUp'),
      pickerPath: $('#pickerPath'),
      pickerHidden: $('#pickerHidden'),
      pickerDrives: $('#pickerDrives'),
      pickerList: $('#pickerList'),
      pickerNote: $('#pickerNote'),
      pickerCancel: $('#pickerCancel'),
      pickerConfirm: $('#pickerConfirm')
    };

    els.dialogOverlay.addEventListener('pointerdown', (event) => {
      if (event.target === els.dialogOverlay) {
        if (sound) sound.back();
        closeDialog(null);
      }
    });

    els.pickerClose.addEventListener('click', () => pickerClose(null));
    els.pickerCancel.addEventListener('click', () => pickerClose(null));
    els.pickerOverlay.addEventListener('pointerdown', (event) => {
      if (event.target === els.pickerOverlay) pickerClose(null);
    });
    els.pickerConfirm.addEventListener('click', pickerConfirmSelection);
    els.pickerUp.addEventListener('click', () => {
      const parent = els.pickerUp.dataset.parent;
      if (parent) navigate(parent);
    });
    els.pickerHidden.addEventListener('change', () => {
      if (state.picker) navigate(state.picker.path);
    });
    els.pickerDrives.addEventListener('click', (event) => {
      const chip = event.target.closest('[data-drive-index]');
      if (!chip) return;
      const paths = JSON.parse(els.pickerDrives.dataset.paths || '[]');
      const path = paths[Number(chip.dataset.driveIndex)];
      if (path) navigate(path);
    });
    els.pickerList.addEventListener('click', (event) => {
      const row = event.target.closest('[data-pick]');
      if (!row) return;
      choose(Number(row.dataset.pick));
    });
    els.pickerList.addEventListener('dblclick', (event) => {
      const row = event.target.closest('[data-pick]');
      if (!row) return;
      const entry = state.picker && state.picker.entries[Number(row.dataset.pick)];
      if (entry && entry.kind === 'file') pickerConfirmSelection();
    });

    document.addEventListener('keydown', (event) => {
      if (!state.dialogResolve) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (sound) sound.back();
        closeDialog(null);
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        const primary = els.dialogActions.querySelector('.is-primary') || els.dialogActions.querySelector('button');
        if (primary) primary.click();
      }
    }, true);
  }

  window.NovaOverlays = {
    bind,
    dialog,
    dialogOpen,
    pickerOpen,
    pickerOpenState: () => !!state.picker,
    pickerClose,
    pickerKey: (key) => {
      if (!state.picker) return false;
      if (key === 'Escape') { pickerClose(null); return true; }
      if (key === 'Enter') { pickerConfirmSelection(); return true; }
      return false;
    }
  };
})();
