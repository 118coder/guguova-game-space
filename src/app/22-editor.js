/* ============================================================
   APP PART 22 · editor —— 编辑器 —— 表单/保存/封面预览 + 格式化资料 DOSSIER（14 标签导出导入）
   这是 src/app/ 分片之一：由 tools/build-app.js 按文件名序拼回 src/app.js。
   所有分片共享同一个 IIFE 闭包（跨分片直接引用函数与 state）。
   改代码请改分片，改完运行 node tools/build-app.js；直接编辑 app.js 会被覆盖。
   ============================================================ */

  /* ============================================================
     EDITOR
     ============================================================ */

  function editorLogoText() {
    const name = els.fLogo.value.trim() || els.fName.value.trim() || 'GUGUOVA';
    return name.toUpperCase();
  }

  function clampNumber(value, min, max) {
    const number = Number(value);
    return Math.max(min, Math.min(max, Number.isFinite(number) ? number : min));
  }

  function parseHeroPosition(value) {
    const match = String(value || '').match(/([\d.]+)%\s+([\d.]+)%/);
    return {
      x: match ? clampNumber(parseFloat(match[1]), 0, 100) : 50,
      y: match ? clampNumber(parseFloat(match[2]), 0, 100) : 45
    };
  }

  function framingFor(game) {
    const position = parseHeroPosition(game && game.heroPosition);
    return {
      x: position.x,
      y: position.y,
      zoom: clampNumber(game && game.heroZoom, 1, 2.4)
    };
  }

  /**
   * object-position chooses the crop; the translate makes the crop
   * pannable once the player zooms in. translate percentages are of the
   * image's own box, so at zoom z the maximum travel is (z-1)/2.
   */
  function applyHeroFraming(image, framing, stopDrift = false) {
    if (!image) return;
    const x = clampNumber(framing && framing.x, 0, 100);
    const y = clampNumber(framing && framing.y, 0, 100);
    const zoom = clampNumber(framing && framing.zoom, 1, 2.4);
    image.style.objectPosition = `${x}% ${y}%`;
    if (zoom > 1.0001) {
      image.style.transformOrigin = '50% 50%';
      image.style.transform = `translate(${(50 - x) * (zoom - 1)}%, ${(50 - y) * (zoom - 1)}%) scale(${zoom})`;
      if (stopDrift) image.style.animation = 'none';
    } else {
      image.style.transform = '';
      image.style.transformOrigin = '';
      if (stopDrift) image.style.animation = '';
    }
  }

  function syncEditorFraming() {
    const framing = state.editorFraming;
    applyHeroFraming(els.editorPreviewImg, framing);
    if (els.framingZoom) els.framingZoom.textContent = `${Math.round(framing.zoom * 100)}%`;
  }

  function bindEditorFraming() {
    if (!els.editorPreview || !els.editorFraming) return;

    els.editorFraming.addEventListener('click', (event) => {
      const button = event.target.closest('[data-frame]');
      if (!button) return;
      const framing = state.editorFraming;
      const action = button.dataset.frame;
      if (action === 'left') framing.x -= 2;
      else if (action === 'right') framing.x += 2;
      else if (action === 'up') framing.y -= 2;
      else if (action === 'down') framing.y += 2;
      else if (action === 'zoom-in') framing.zoom += 0.1;
      else if (action === 'zoom-out') framing.zoom -= 0.1;
      else if (action === 'reset') { framing.x = 50; framing.y = 45; framing.zoom = 1; }
      framing.x = clampNumber(framing.x, 0, 100);
      framing.y = clampNumber(framing.y, 0, 100);
      framing.zoom = clampNumber(framing.zoom, 1, 2.4);
      syncEditorFraming();
      audio.toggle();
      event.stopPropagation();
    });

    let drag = null;
    els.editorPreview.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || event.target.closest('button')) return;
      const rect = els.editorPreview.getBoundingClientRect();
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
        framing: { x: state.editorFraming.x, y: state.editorFraming.y, zoom: state.editorFraming.zoom }
      };
      try { els.editorPreview.setPointerCapture(event.pointerId); } catch (error) {}
      els.editorPreview.classList.add('is-framing');
      event.preventDefault();
    });

    els.editorPreview.addEventListener('pointermove', (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      state.editorFraming.x = clampNumber(drag.framing.x - (dx / drag.width) * 120, 0, 100);
      state.editorFraming.y = clampNumber(drag.framing.y - (dy / drag.height) * 120, 0, 100);
      syncEditorFraming();
    });

    const endDrag = (event) => {
      if (!drag || (event.pointerId != null && event.pointerId !== drag.pointerId)) return;
      drag = null;
      els.editorPreview.classList.remove('is-framing');
      try { els.editorPreview.releasePointerCapture(event.pointerId); } catch (error) {}
    };
    els.editorPreview.addEventListener('pointerup', endDrag);
    els.editorPreview.addEventListener('pointercancel', endDrag);

    els.editorPreview.addEventListener('wheel', (event) => {
      if (state.overlay !== 'editor') return;
      event.preventDefault();
      const step = event.deltaY < 0 ? 0.08 : -0.08;
      state.editorFraming.zoom = clampNumber(state.editorFraming.zoom + step, 1, 2.4);
      syncEditorFraming();
    }, { passive: false });
  }

  function syncEditorPreview() {
    const name = els.fLogo.value.trim() || els.fName.value.trim() || 'GUGUOVA';
    setLogo(els.editorLogo, currentGame(), 'editor-logo', {
      text: name.toUpperCase(),
      recipe: els.fTypeRecipe ? els.fTypeRecipe.value : ''
    });
    els.editorPreviewHint.textContent = els.editorPreviewImg.getAttribute('src')
      ? '拖动画面 / 滚轮缩放 · 保存后应用'
      : (els.fExe.value ? '保存后从真实封面或程序图标生成' : '从可执行文件或图片生成封面');
  }

  /* ============================================================
     FORMAT DOSSIER · import / export
     One block of labelled text that carries every editor field:
       名称：DNF-Season1-Act4
       类型：动作 / RPG
       详细描述：…（可多行）
     Import fills only the fields the text actually names — a missing line
     leaves the form untouched. Lines that do not start with a known label
     continue the previous field, so a long description can span paragraphs.
     ============================================================ */

  const DOSSIER_FIELDS = [
    { keys: ['游戏程序', '程序', 'exe'], id: 'fExe', path: true },
    { keys: ['游戏启动器', '启动器', '登录器'], id: 'fLauncher', path: true },
    { keys: ['名称', '名字', '游戏名'], id: 'fName' },
    { keys: ['中文名', '中文名称', '中文'], id: 'fZh' },
    { keys: ['类型', '类别'], id: 'fGenre' },
    { keys: ['字标文字', '字标', '标题文字'], id: 'fLogo' },
    { keys: ['字标方案', '标题字体'], id: 'fTypeRecipe', select: true },
    { keys: ['年龄分级', '分级', '年龄'], id: 'fAge' },
    { keys: ['游玩模式', '模式'], id: 'fMode' },
    { keys: ['一句话介绍', '简介', '介绍'], id: 'fTagline' },
    { keys: ['详细描述', '描述'], id: 'fDesc' },
    { keys: ['启动参数', '参数'], id: 'fArgs' },
    { keys: ['工作目录', '目录'], id: 'fWorkDir', path: true },
    { keys: ['封面', '封面图片', '图片', '主视觉'], id: 'fImage', path: true }
  ];

  function parseDossier(text) {
    const out = {};
    let current = null;
    String(text || '').split(/\r?\n/).forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line) {
        if (current && out[current]) out[current] += '\n';
        return;
      }
      // Label = up to the first colon (full or half width). Only a RECOGNISED
      // label starts a field: an unrecognized line belongs to the previous
      // field's text, which is what keeps multi-line descriptions intact.
      const split = line.match(/^([^：:]{1,10})[：:]\s*(.*)$/);
      const field = split && DOSSIER_FIELDS.find((entry) => entry.keys.includes(split[1].trim()));
      if (field) {
        current = field.id;
        out[current] = (out[current] ? `${out[current]}\n` : '') + split[2].trim();
      } else if (current) {
        out[current] += `\n${line}`;
      }
    });
    DOSSIER_FIELDS.forEach((field) => {
      if (field.path && out[field.id]) out[field.id] = cleanPath(out[field.id]);
      // A select field travels as its human-readable option label; map it
      // back to the option value. An unknown label is dropped, never clobbered.
      if (field.select && out[field.id]) {
        const select = els[field.id];
        const match = select ? Array.from(select.options).find((option) =>
          option.textContent.trim() === out[field.id] || option.value === out[field.id]) : null;
        if (match) out[field.id] = match.value;
        else delete out[field.id];
      }
    });
    return out;
  }

  /** Applies dossier text to the form. onlyEmpty fills just the blanks —
      that is the save-time merge, where a value the player typed wins and
      the pasted material must never clobber it. */
  function applyDossierToForm({ onlyEmpty = false } = {}) {
    const parsed = parseDossier(els.dossierText.value);
    const applied = [];
    DOSSIER_FIELDS.forEach((field) => {
      const value = parsed[field.id];
      // A line the text does not name leaves that field exactly as it was.
      if (value === undefined || !String(value).trim()) return;
      const input = els[field.id];
      if (!input) return;
      if (onlyEmpty && String(input.value || '').trim()) return;
      input.value = value;
      applied.push(field.keys[0]);
    });
    return { applied, parsed };
  }

  function importDossier() {
    const { applied, parsed } = applyDossierToForm();
    if (!applied.length) {
      toast('没有识别到可导入的资料', 'info');
      return;
    }
    syncEditorPreview();
    if (parsed.fImage) previewImageFromPath(parsed.fImage);
    toast(`已导入 ${applied.length} 项：${applied.slice(0, 4).join('、')}${applied.length > 4 ? '…' : ''}`, 'check');
  }

  function exportDossier() {
    const lines = [];
    DOSSIER_FIELDS.forEach((field) => {
      const input = els[field.id];
      if (!input) return;
      let value = String(input.value || '').trim();
      if (field.select && value) {
        const match = Array.from(input.options).find((option) => option.value === value);
        if (match) value = match.textContent.trim();
      }
      // Every label is written, empty or not: the export doubles as a
      // fill-in template, and import skips labels whose value is blank —
      // so a complete text can never clobber a target form either.
      lines.push(`${field.keys[0]}：${value}`);
    });
    if (!lines.length) {
      toast('当前表单还没有内容', 'info');
      return;
    }
    els.dossierText.value = lines.join('\n');
    els.dossierText.select();
    try { navigator.clipboard.writeText(els.dossierText.value); } catch (e) { /* selection is the fallback */ }
    toast('资料已导出到文本框并复制', 'copy');
  }

  function setEditorError(message) {
    if (!message) {
      els.editorError.hidden = true;
      els.editorError.textContent = '';
      return;
    }
    els.editorError.hidden = false;
    els.editorError.textContent = message;
  }

  function resetEditorFields() {
    els.fExe.value = '';
    els.fLauncher.value = '';
    els.fName.value = '';
    els.fZh.value = '';
    els.fGenre.value = '';
    els.fLogo.value = '';
    els.fTagline.value = '';
    els.fImage.value = '';
    els.fArgs.value = '';
    els.fWorkDir.value = '';
    els.fDesc.value = '';
    els.fAge.value = '';
    els.fMode.value = '';
    // Stale dossier text from a previous session would get merged into the
    // next game on save — the paste belongs to the game it was written for.
    els.dossierText.value = '';
    if (els.fTypeRecipe) els.fTypeRecipe.value = '';
    els.editorPreviewImg.classList.remove('is-loaded');
    els.editorPreviewImg.removeAttribute('src');
    els.editorSwatches.innerHTML = '';
    state.editorFraming = { x: 50, y: 45, zoom: 1 };
    syncEditorFraming();
    setEditorError('');
  }

  function openEditor(game = null) {
    const allowed = !state.overlay || state.overlay === 'scanner' || state.overlay === 'details';
    if (!allowed) return;
    if (state.overlay === 'scanner') closeScanner({ focus: false, sound: false });
    if (state.overlay === 'details') closeDetails({ focus: false, sound: false });

    state.lastFocus = document.activeElement;
    state.editorMode = game ? 'edit' : 'create';
    state.editorId = game ? game.id : null;
    state.editorManifest = null;
    resetEditorFields();

    if (game) {
      els.editorTitle.textContent = '编辑游戏';
      els.editorMode.textContent = '编辑';
      els.editorSaveLabel.textContent = '保存修改';
      els.editorDelete.hidden = false;
      els.fExe.value = game.exePath || '';
      els.fLauncher.value = game.launcherPath || '';
      els.fName.value = game.name || '';
      els.fZh.value = game.zh || '';
      els.fGenre.value = game.genre || '';
      els.fLogo.value = game.logo || '';
      els.fTagline.value = game.tagline || '';
      els.fArgs.value = game.args || '';
      els.fWorkDir.value = game.workDir || '';
      els.fDesc.value = game.description || '';
      els.fAge.value = game.ageRating || '';
      els.fMode.value = game.mode || '';
      if (els.fTypeRecipe) els.fTypeRecipe.value = game.typeRecipe || '';
      state.editorFraming = framingFor(game);
      if (game.heroUrl) {
        els.editorPreviewImg.src = game.heroUrl;
        els.editorPreviewImg.onload = () => {
          els.editorPreviewImg.classList.add('is-loaded');
          syncEditorFraming();
        };
        (game.colors || []).forEach((color) => {
          const swatch = document.createElement('i');
          swatch.style.background = color;
          els.editorSwatches.appendChild(swatch);
        });
      }
    } else {
      els.editorTitle.textContent = '添加游戏';
      els.editorMode.textContent = '添加';
      els.editorSaveLabel.textContent = '添加到游戏库';
      els.editorDelete.hidden = true;
    }

    syncEditorPreview();
    syncEditorFraming();
    state.overlay = 'editor';
    openSurface('editor');
    audio.select();
    setTimeout(() => {
      const target = game ? els.fName : els.fExe;
      try { target.focus({ preventScroll: true }); } catch (error) {}
    }, 120);
  }

  function closeEditor(options = {}) {
    if (state.overlay !== 'editor') return;
    const { focus = true, sound = true } = options;
    closeSurface('editor');
    state.overlay = null;
    if (sound) audio.back();
    if (focus) restoreFocus();
  }

  async function saveEditor() {
    // Material pasted into the dossier but never imported must not die
    // silently: a save with "封面：…" still sitting in the textarea used to
    // add the game with a generated icon cover and no error anywhere. Fill
    // the blanks from the paste first — typed values always win.
    const merged = applyDossierToForm({ onlyEmpty: true });
    if (merged.applied.length) {
      if (merged.parsed.fImage && !String(els.fImage.value || '').trim()) {
        previewImageFromPath(merged.parsed.fImage);
      }
      syncEditorPreview();
      toast(`已从格式化资料补全 ${merged.applied.length} 项`, 'check');
    }

    const exePath = cleanPath(els.fExe.value);
    const imagePath = cleanPath(els.fImage.value);
    if (!exePath) {
      setEditorError('请先选择游戏的可执行文件（.exe）。');
      return;
    }
    if (!els.fName.value.trim()) {
      const suggested = exePath.split(/[\\/]/).pop().replace(/\.exe$/i, '').replace(/[_-]/g, ' ');
      els.fName.value = suggested;
    }

    const payload = {
      id: state.editorId || undefined,
      exePath,
      launcherPath: cleanPath(els.fLauncher.value),
      name: els.fName.value.trim(),
      zh: els.fZh.value.trim(),
      genre: els.fGenre.value.trim(),
      logoText: els.fLogo.value.trim(),
      tagline: els.fTagline.value.trim(),
      imagePath: imagePath || undefined,
      args: els.fArgs.value.trim(),
      workDir: cleanPath(els.fWorkDir.value),
      description: els.fDesc.value.trim(),
      ageRating: els.fAge.value.trim() || '全年龄',
      mode: els.fMode.value.trim() || '单人',
      typeRecipe: els.fTypeRecipe ? els.fTypeRecipe.value : '',
      heroPosition: `${Math.round(state.editorFraming.x)}% ${Math.round(state.editorFraming.y)}%`,
      heroZoom: Number(state.editorFraming.zoom.toFixed(2)),
      manifestPath: state.editorManifest || undefined
    };

    els.editorSave.disabled = true;
    const label = els.editorSaveLabel.textContent;
    els.editorSaveLabel.textContent = state.editorMode === 'edit' ? '正在保存…' : '正在生成封面…';

    const result = state.editorMode === 'edit'
      ? await call('updateGame', payload)
      : await call('createGame', payload);

    els.editorSave.disabled = false;
    els.editorSaveLabel.textContent = label;

    if (!result || !result.ok) {
      setEditorError(result?.error || '保存失败，请检查文件路径。');
      audio.error();
      return;
    }

    if (state.editorMode === 'edit') {
      const game = findGame(state.editorId);
      if (game) Object.assign(game, result.game);
      toast(`《${shortName(result.game)}》已更新`, 'check');
      closeEditor({ focus: false, sound: false });
      rebuildAfterLibraryChange(false);
      audio.select();
    } else {
      state.games.push(result.game);
      const index = state.games.length - 1;
      closeEditor({ focus: false, sound: false });
      rebuildAfterLibraryChange(false);
      selectGame(index, { sound: false, initial: true });
      setBackdrop(result.game);
      applyAccent(result.game);
      renderHero(result.game, true);
      audio.select();
      toast(`已添加《${shortName(result.game)}》`, 'check');
    }
  }
