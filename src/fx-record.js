/* ============================================================
   RECORD BRIDGE — real launcher data, as CSS custom properties.

   Themes are CSS-only: they cannot read the selected game. This module
   publishes the few numbers that a *dossier-style* theme needs to print
   on its own chrome (a record seal, a playtime stamp, an index tab) as
   custom properties on <html>, so any theme can consume them with
   `content: var(--nova-no)` without touching a line of JS.

   Only one thing is required of the caller:
     window.NovaRecord.publish(game, { index, total })
   Nothing here reaches back into the app — no DOM ids, no state object.

   Published (empty string / "0" when there is no selection):
     --nova-no            "07"     1-based position in the library
     --nova-count         "12"     size of the library
     --nova-record        "No.07 / 12"
     --nova-index         7         (plain number, unquoted)
     --nova-hours         12.4      accumulated playtime, hours, 1 decimal
     --nova-minutes       745       accumulated playtime, whole minutes
     --nova-launches      9
     --nova-days          3         days since last play ("" if never)
     --nova-state         "new" | "played" | "missing" | "none"
   Plus <html data-nova-record="on|off"> for non-`content` branches.
   ============================================================ */
(function () {
  'use strict';

  const root = document.documentElement;
  const NUMERIC = ['--nova-index', '--nova-hours', '--nova-minutes', '--nova-launches', '--nova-days'];

  const quoted = (value) => `"${String(value).replace(/["\\]/g, '')}"`;
  const pad2 = (value) => String(value).padStart(2, '0');
  const round1 = (value) => (Math.round(value * 10) / 10).toFixed(1);

  function daysSince(iso) {
    if (!iso) return null;
    const at = new Date(iso).getTime();
    if (!Number.isFinite(at)) return null;
    return Math.max(0, Math.floor((Date.now() - at) / 86400000));
  }

  function publish(game, meta) {
    if (!root) return;
    const options = meta || {};

    if (!game) {
      clear();
      return;
    }

    const index = Number(options.index) > 0 ? Math.round(options.index) : 0;
    const total = Number(options.total) > 0 ? Math.round(options.total) : 0;
    const seconds = Math.max(0, Number(game.playtimeSeconds) || 0);
    const launches = Math.max(0, Math.round(Number(game.launchCount) || 0));
    const days = daysSince(game.lastPlayedUtc);

    root.style.setProperty('--nova-no', index ? quoted(pad2(index)) : '');
    root.style.setProperty('--nova-count', total ? quoted(String(total)) : '');
    root.style.setProperty('--nova-record', index && total
      ? quoted(`No.${pad2(index)} / ${pad2(total)}`)
      : quoted(''));
    root.style.setProperty('--nova-index', index ? String(index) : '0');
    root.style.setProperty('--nova-hours', quoted(round1(seconds / 3600)));
    root.style.setProperty('--nova-minutes', String(Math.round(seconds / 60)));
    root.style.setProperty('--nova-launches', String(launches));
    root.style.setProperty('--nova-days', days === null ? '' : String(days));

    const state = !game.exists ? 'missing' : (seconds > 0 || launches > 0) ? 'played' : 'new';
    root.style.setProperty('--nova-state', quoted(state));
    root.dataset.novaRecord = 'on';
  }

  function clear() {
    if (!root) return;
    root.style.removeProperty('--nova-no');
    root.style.removeProperty('--nova-count');
    root.style.removeProperty('--nova-record');
    NUMERIC.forEach((name) => root.style.removeProperty(name));
    root.style.removeProperty('--nova-state');
    root.dataset.novaRecord = 'off';
  }

  // Nothing may be printed until the first render says there is something to print.
  clear();

  window.NovaRecord = { publish, clear };
})();
