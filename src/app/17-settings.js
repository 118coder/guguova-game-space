/* ============================================================
   APP PART 17 · settings —— 设置页 —— 本地身份、离线数据、游玩历史
   这是 src/app/ 分片之一：由 tools/build-app.js 按文件名序拼回 src/app.js。
   所有分片共享同一个 IIFE 闭包（跨分片直接引用函数与 state）。
   改代码请改分片，改完运行 node tools/build-app.js；直接编辑 app.js 会被覆盖。
   ============================================================ */

  /* ============================================================
     SETTINGS · local identity, offline data, play history
     ============================================================ */

  function formatBytes(bytes) {
    const value = Number(bytes) || 0;
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
    return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  function formatSessionTime(iso) {
    if (!iso) return '—';
    const date = new Date(iso);
    if (!Number.isFinite(date.getTime())) return '—';
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function setPrefSwitch(row, control, value) {
    if (row) row.setAttribute('aria-checked', String(!!value));
    if (control) control.classList.toggle('on', !!value);
  }

  function statCard(label, value, sub) {
    return `<div class="settings-stat"><span>${esc(label)}</span><b>${esc(value)}</b><em>${esc(sub || '')}</em></div>`;
  }

  function applySystemTier(system) {
    const root = document.documentElement;
    root.dataset.tier = (system && system.tier) || 'full';
    root.dataset.os = (system && system.osLabel) || '';
    root.dataset.wv = String((system && system.webView2Major) || 0);
    if (system && system.supportColorMix === false) root.dataset.colorMix = 'off';
    else delete root.dataset.colorMix;
  }

  async function changeCompatibilityTier() {
    if (!els.settingsTier) return;
    const value = els.settingsTier.value;
    state.settings.compatibilityTier = value;
    saveSettings();
    const result = await call('getSystem', { tier: value });
    if (result && result.ok && result.system) {
      state.system = result.system;
      applySystemTier(result.system);
      renderSettings();
      audio.select();
      toast(`效果档位 · ${result.system.tierLabel}`, 'check');
    }
  }

