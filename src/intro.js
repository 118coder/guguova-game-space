(() => {
  'use strict';

  /* ============================================================
     NOVA · INTRO REGISTRY
     The opening sequence is a named preset, not a theme-specific
     script. A theme manifest only names a preset ("intro": "ink");
     a theme author can ship a new preset by registering one here
     or by adding a CSS block under [data-intro="<id>"].

     Each preset: { label, duration, classNames?, setup?(stage) }
     ============================================================ */

  const presets = new Map();
  const DEFAULT = 'gilded';

  function register(id, preset) {
    if (!id || typeof id !== 'string') throw new Error('intro preset needs an id');
    presets.set(id, Object.assign({ id, label: id, duration: 2200 }, preset || {}));
    return presets.get(id);
  }

  register('gilded', {
    label: '鎏金仪式',
    duration: 2150,
    hint: '点击或按任意键跳过'
  });

  register('aurum', {
    label: '鎏金圣所',
    duration: 2200,
    hint: '点击或按任意键跳过',
    // A structurally distinct variation: the diamond turns a half circle
    // and an extra gold ring pulses outward. CSS lives in intro.css.
    setup(overlay) {
      overlay.classList.add('intro-aurum');
    }
  });

  /* ---------- ENDFIELD boot sequence ----------
     The shared astrolabe is replaced by a console readout built from
     real values (clock, year, game count). No invented telemetry. */
  register('endfield', {
    label: '终末地 · 启动序列',
    duration: 2400,
    hint: '点击或按任意键跳过',
    setup(overlay) {
      overlay.classList.add('intro-endfield');
      const stage = ensureEndfieldStage(overlay);
      const reduce = !!(window.NovaMotion && window.NovaMotion.reduce);
      const now = new Date();
      const pad2 = (value) => String(value).padStart(2, '0');
      const date = `${now.getFullYear()}.${pad2(now.getMonth() + 1)}.${pad2(now.getDate())}`;
      const time = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;

      const dockCount = document.getElementById('dockCount');
      const countMatch = (dockCount && dockCount.textContent || '').match(/\d+/);
      const games = pad2(countMatch ? Math.min(99, Number(countMatch[0])) : 0);

      const write = (key, value) => {
        const node = stage.querySelector(`[data-ef="${key}"]`);
        if (!node) return;
        if (reduce) node.textContent = value;
        else scramble(node, value, 520);
      };

      write('date', date);
      write('time', time);
      write('games', games);
      write('gamesBig', games);
      write('year', String(now.getFullYear()));
      runMeter(stage.querySelector('[data-ef="pct"]'), reduce);
    }
  });

  /* ---------- DUSK ATELIER ----------
     An atelier opening at the end of the day: the sky settles into dusk,
     a low sun blooms, the synthesis ring draws itself, then the ledger
     line prints the real date, clock and library count. */
  register('dusk', {
    label: '黄昏之炼 · 暮色开工',
    duration: 2600,
    hint: '点击或按任意键跳过',
    setup(overlay) {
      overlay.classList.add('intro-dusk');
      const stage = ensureDuskStage(overlay);
      const reduce = !!(window.NovaMotion && window.NovaMotion.reduce);
      const now = new Date();
      const pad2 = (value) => String(value).padStart(2, '0');
      const date = `${now.getFullYear()}.${pad2(now.getMonth() + 1)}.${pad2(now.getDate())}`;
      const time = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;

      const dockCount = document.getElementById('dockCount');
      const countMatch = (dockCount && dockCount.textContent || '').match(/\d+/);
      const games = pad2(countMatch ? Math.min(99, Number(countMatch[0])) : 0);

      const write = (key, value) => {
        const node = stage.querySelector(`[data-dk="${key}"]`);
        if (!node) return;
        if (reduce) node.textContent = value;
        else scramble(node, value, 520);
      };

      write('date', date);
      write('time', time);
      write('games', games);
      write('year', String(now.getFullYear()));
      runMeter(stage.querySelector('[data-dk="pct"]'), reduce);
    }
  });

  register('mnemo', {
    label: '神秘管理局',
    duration: 2600,
    hint: '点击或按任意键跳过',
    setup(overlay) {
      overlay.classList.add('intro-mnemo');
      const stage = ensureMnemoStage(overlay);
      const reduce = !!(window.NovaMotion && window.NovaMotion.reduce);
      const now = new Date();
      const pad2 = (value) => String(value).padStart(2, '0');
      const date = `${now.getFullYear()}.${pad2(now.getMonth() + 1)}.${pad2(now.getDate())}`;
      const time = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
      const dockCount = document.getElementById('dockCount');
      const countMatch = (dockCount && dockCount.textContent || '').match(/\d+/);
      const games = pad2(countMatch ? Math.min(99, Number(countMatch[0])) : 0);

      const write = (key, value) => {
        const node = stage.querySelector(`[data-mn="${key}"]`);
        if (!node) return;
        if (reduce) node.textContent = value;
        else scramble(node, value, 520);
      };

      write('date', date);
      write('time', time);
      write('games', games);
      const entry = stage.querySelector('[data-mn="entry"]');
      if (entry) entry.textContent = games;
      write('year', String(now.getFullYear()));
      runMeter(stage.querySelector('[data-mn="pct"]'), reduce);

      const plate = stage.querySelector('.intro-mn-error');
      const settle = () => {
        if (!plate) return;
        plate.classList.add('is-ok');
        const title = plate.querySelector('b');
        const sub = plate.querySelector('i');
        if (title) title.textContent = '档案已解密';
        if (sub) sub.textContent = 'ARCHIVE DECRYPTED';
      };
      if (reduce) settle();
      else setTimeout(settle, 1300);
    }
  });

  register('zerohour', {
    label: '零点街区 · 信号接入',
    duration: 2200,
    hint: '点击或按任意键跳过',
    setup(overlay) {
      overlay.classList.add('intro-zerohour');
      const stage = ensureZeroHourStage(overlay);
      const reduce = !!(window.NovaMotion && window.NovaMotion.reduce);
      const now = new Date();
      const pad2 = (value) => String(value).padStart(2, '0');
      const date = `${now.getFullYear()}.${pad2(now.getMonth() + 1)}.${pad2(now.getDate())}`;
      const time = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
      const dockCount = document.getElementById('dockCount');
      const countMatch = (dockCount && dockCount.textContent || '').match(/\d+/);
      const games = pad2(countMatch ? Math.min(99, Number(countMatch[0])) : 0);

      const write = (key, value) => {
        const node = stage.querySelector(`[data-zh="${key}"]`);
        if (!node) return;
        if (reduce) node.textContent = value;
        else scramble(node, value, 460);
      };

      write('date', date);
      write('time', time);
      write('games', games);
      const titles = stage.querySelector('[data-zh="titles"]');
      if (titles) titles.textContent = `${games} TITLES`;
      runMeter(stage.querySelector('[data-zh="pct"]'), reduce);
    }
  });

  /* ---------- GRIMOIRE 归档仪式 ----------
     与其它预设的区别是**结构**而不只是配色：这里没有星盘、没有时钟、
     也没有百分比表（那三样正是「每套主题的开屏都像时钟加载」的来源）。
     GRIMOIRE 的语言是「档案 + 火漆印」，所以开场就是一次**盖章归档**：
     火漆菱形从上方落下、压出冲击环与四角金点，页面上印出真实档号，
     底部的进度是一条**归档环**，落章后由「归档中」变为「已归档」。 */
  register('seal', {
    label: '档案归档',
    duration: 2500,
    hint: '点击或按任意键跳过',
    setup(overlay) {
      overlay.classList.add('intro-seal');
      const stage = ensureSealStage(overlay);
      const reduce = !!(window.NovaMotion && window.NovaMotion.reduce);
      const now = new Date();
      const pad2 = (value) => String(value).padStart(2, '0');
      const date = `${now.getFullYear()}.${pad2(now.getMonth() + 1)}.${pad2(now.getDate())}`;
      const time = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;

      // 真实数据：dock 里的条目数就是「档案册里有几份档案」。
      const dockCount = document.getElementById('dockCount');
      const countMatch = (dockCount && dockCount.textContent || '').match(/\d+/);
      const games = Math.max(0, Math.min(99, countMatch ? Number(countMatch[0]) : 0));
      const no = `No.${pad2(games)}`;

      const write = (key, value) => {
        const node = stage.querySelector(`[data-gs="${key}"]`);
        if (!node) return;
        if (reduce) node.textContent = value;
        else scramble(node, value, 520);
      };

      write('date', date);
      write('time', time);
      write('games', pad2(games));
      write('no', no);
      const sealNo = stage.querySelector('.intro-gs-seal b');
      if (sealNo) sealNo.textContent = pad2(games);

      const stamp = stage.querySelector('[data-gs="stamp"]');
      const settle = () => {
        stage.classList.add('is-stamped');
        if (stamp) stamp.textContent = '已归档';
      };
      if (reduce) settle();
      else setTimeout(settle, 1450);
    }
  });

  /* ---------- SUMMER 开窗 ----------
     RISO 与 SUMMER 原先共用 ink，开屏长得一样。这里给 SUMMER 一个有
     独立结构的开窗：青绿顶带 → 地平线光带横向拉开 → 三行字各自落在
     自己的白色底板上（正是参考图的语言），没有星盘也没有百分比表。 */
  register('sun', {
    label: '开窗',
    duration: 2200,
    hint: '点击或按任意键跳过',
    setup(overlay) {
      overlay.classList.add('intro-sun');
      const stage = ensureSunStage(overlay);
      const reduce = !!(window.NovaMotion && window.NovaMotion.reduce);
      const now = new Date();
      const pad2 = (value) => String(value).padStart(2, '0');
      const date = `${now.getFullYear()}.${pad2(now.getMonth() + 1)}.${pad2(now.getDate())}`;
      const time = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
      const dockCount = document.getElementById('dockCount');
      const countMatch = (dockCount && dockCount.textContent || '').match(/\d+/);
      const games = pad2(countMatch ? Math.min(99, Number(countMatch[0])) : 0);

      const write = (key, value) => {
        const node = stage.querySelector(`[data-su="${key}"]`);
        if (!node) return;
        if (reduce) node.textContent = value;
        else scramble(node, value, 480);
      };
      write('date', date);
      write('time', time);
      write('games', games);
    }
  });

  register('codex', {
    label: '星轨秘典',
    duration: 2600,
    hint: '点击或按任意键跳过',
    // A clock-hand astrolabe and a diamond iris; distinct from the seal.
    setup(overlay) {
      overlay.classList.add('intro-codex');
    }
  });

  register('ember', {
    label: '余烬',
    duration: 2000,
    hint: '点击或按任意键跳过'
  });

  register('ink', {
    label: '墨与纸',
    duration: 2300,
    hint: '点击或按任意键跳过'
  });

  /* RIOT：黑胶升速，红圈落定。 */
  register('vinyl', {
    label: '黑胶',
    duration: 2100,
    hint: '点击或按任意键跳过',
    setup(overlay) {
      overlay.classList.add('intro-vinyl');
      if (overlay.querySelector('.intro-vn')) return;
      const stage = document.createElement('div');
      stage.className = 'intro-vn';
      stage.setAttribute('aria-hidden', 'true');
      stage.innerHTML = `
        <div class="intro-vn-disc"><i></i></div>
        <div class="intro-vn-ring"></div>
        <div class="intro-vn-copy">
          <b>RIOT</b>
          <span>SIDE A · 33⅓</span>
        </div>`;
      overlay.appendChild(stage);
    }
  });

  /* SUMMER：整张白纸 + 制图线 + 黑块白字 / 黄块黑字的排版开机。 */
  register('draft', {
    label: '排版',
    duration: 1900,
    hint: '点击或按任意键跳过',
    setup(overlay) {
      overlay.classList.add('intro-draft');
      const stage = ensureIntroStage(overlay, 'intro-dr', `
        <div class="intro-dr-paper" aria-hidden="true">
          <span class="intro-dr-grid"></span>
          <span class="intro-dr-edge"></span>
          <svg class="intro-dr-lines" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
            <g fill="none" stroke="#1f93c8" stroke-width="2">
              <circle cx="1180" cy="120" r="340"/>
              <path d="M-80 780 660 40"/>
              <path d="M400 920 1180 130"/>
              <path d="M980 920 1660 240"/>
              <path d="M120 210h46M143 187v46"/>
              <path d="M1320 700h36M1338 682v36"/>
              <path d="M250 560h330" stroke-dasharray="4 10"/>
              <path d="M250 592h210" stroke-dasharray="4 10"/>
            </g>
          </svg>
          <span class="intro-dr-check"></span>
          <span class="intro-dr-bar"></span>
        </div>
        <div class="intro-dr-compose">
          <span class="intro-dr-kicker">// GUGUOVA · SUMMER ISSUE</span>
          <div class="intro-dr-title">
            <i class="intro-dr-ghost" aria-hidden="true">SUMMER</i>
            <b class="intro-dr-black">SUMMER</b>
            <b class="intro-dr-yellow">夏日轻程</b>
          </div>
          <div class="intro-dr-field">
            <span data-dr="date">----.--.--</span><i>│</i>
            <span data-dr="time">--:--</span><i>│</i>
            <span><b data-dr="games">--</b> 款游戏</span>
          </div>
        </div>`);
      const data = introData();
      const reduce = !!(window.NovaMotion && window.NovaMotion.reduce);
      const write = (key, value) => {
        const node = stage.querySelector(`[data-dr="${key}"]`);
        if (!node) return;
        if (reduce) node.textContent = value;
        else scramble(node, value, 460);
      };
      write('date', data.date);
      write('time', data.time);
      write('games', data.games);
    }
  });

  /* BROADCAST：调频刻度扫过，指针锁定后亮 ON AIR。 */
  register('broadcast', {
    label: '调频',
    duration: 2200,
    hint: '点击或按任意键跳过',
    setup(overlay) {
      overlay.classList.add('intro-broadcast');
      if (overlay.querySelector('.intro-bc')) return;
      const stage = document.createElement('div');
      stage.className = 'intro-bc';
      stage.setAttribute('aria-hidden', 'true');
      stage.innerHTML = `
        <div class="intro-bc-scan"></div>
        <div class="intro-bc-main">
          <span class="intro-bc-kicker">// NIGHT FREQUENCY</span>
          <b class="intro-bc-word">ON AIR</b>
          <span class="intro-bc-sub">BROADCAST</span>
        </div>
        <div class="intro-bc-dial"><i></i></div>`;
      overlay.appendChild(stage);
    }
  });

  register('veil', {
    label: '薄幕',
    duration: 1100,
    hint: '点击或按任意键跳过'
  });

  /* ============================================================
     FOUR STRUCTURALLY DISTINCT STAGES
     ------------------------------------------------------------
     gilded / aurum / codex / ink used to share the astrolabe. The
     user's rule is "every theme gets its own opening", so these four
     now have their own stage markup and choreography:

       gilded → NOVA star-core (diamond draws itself, particles converge)
       aurum  → gilded doors part, sunburst halo
       codex  → a scroll unrolls, constellation + compass needle
       riso   → three ink plates fall into register, word snaps
     ============================================================ */

  function introData() {
    const now = new Date();
    const pad2 = (value) => String(value).padStart(2, '0');
    const dockCount = document.getElementById('dockCount');
    const countMatch = (dockCount && dockCount.textContent || '').match(/\d+/);
    const games = Math.max(0, Math.min(99, countMatch ? Number(countMatch[0]) : 0));
    return {
      date: `${now.getFullYear()}.${pad2(now.getMonth() + 1)}.${pad2(now.getDate())}`,
      time: `${pad2(now.getHours())}:${pad2(now.getMinutes())}`,
      games: pad2(games)
    };
  }

  function ensureIntroStage(overlay, className, markup) {
    let stage = overlay.querySelector('.' + className);
    if (stage) return stage;
    stage = document.createElement('div');
    stage.className = className;
    stage.setAttribute('aria-hidden', 'true');
    stage.innerHTML = markup;
    overlay.appendChild(stage);
    return stage;
  }

  register('gilded', {
    label: '星核',
    duration: 2350,
    hint: '点击或按任意键跳过',
    setup(overlay) {
      overlay.classList.add('intro-nova');
      const stage = ensureIntroStage(overlay, 'intro-nv', `
        <span class="intro-nv-axis"></span>
        <span class="intro-nv-halo"></span>
        <svg class="intro-nv-diamond" viewBox="0 0 260 260" aria-hidden="true">
          <path class="d1" d="M130 18 242 130 130 242 18 130Z"/>
          <path class="d2" d="M130 58 202 130 130 202 58 130Z"/>
          <path class="d3" d="M130 98 162 130 130 162 98 130Z"/>
        </svg>
        <span class="intro-nv-bit b1"></span><span class="intro-nv-bit b2"></span>
        <span class="intro-nv-bit b3"></span><span class="intro-nv-bit b4"></span>
        <span class="intro-nv-bit b5"></span><span class="intro-nv-bit b6"></span>
        <span class="intro-nv-bit b7"></span><span class="intro-nv-bit b8"></span>
        <div class="intro-nv-main">
          <span class="intro-nv-kicker">GUGUOVA · CORE ONLINE</span>
          <b class="intro-nv-word">GUGUOVA</b>
          <span class="intro-nv-sub">GAME SPACE<i></i><b data-nv="time">--:--</b></span>
        </div>
        <div class="intro-nv-foot">
          <span>CORE</span>
          <span class="intro-nv-bar"><i></i></span>
          <span data-nv="games">--</span>
        </div>`);
      const data = introData();
      const put = (key, value) => {
        const node = stage.querySelector(`[data-nv="${key}"]`);
        if (node) node.textContent = value;
      };
      put('time', data.time);
      put('games', data.games);
    }
  });

  register('aurum', {
    label: '鎏金之门',
    duration: 2450,
    hint: '点击或按任意键跳过',
    setup(overlay) {
      overlay.classList.add('intro-aurum-v2');
      const stage = ensureIntroStage(overlay, 'intro-au', `
        <span class="intro-au-halo"></span>
        <span class="intro-au-ray"></span>
        <span class="intro-au-door left"><i></i></span>
        <span class="intro-au-door right"><i></i></span>
        <div class="intro-au-main">
          <span class="intro-au-kicker">GILDED SANCTUM · <b data-au="date">----.--.--</b></span>
          <b class="intro-au-word">AURUM</b>
          <span class="intro-au-sub">鎏金圣所</span>
          <span class="intro-au-gems"><i></i><i></i><i></i><i></i><i></i></span>
        </div>`);
      const data = introData();
      const date = stage.querySelector('[data-au="date"]');
      if (date) date.textContent = data.date;
    }
  });

  register('codex', {
    label: '星轨展开',
    duration: 2600,
    hint: '点击或按任意键跳过',
    setup(overlay) {
      overlay.classList.add('intro-codex-v2');
      const stage = ensureIntroStage(overlay, 'intro-cx', `
        <div class="intro-cx-sheet">
          <span class="intro-cx-rule r1"></span>
          <span class="intro-cx-rule r2"></span>
          <svg class="intro-cx-chart" viewBox="0 0 520 280" aria-hidden="true">
            <path class="c1" d="M38 214 112 118 188 168 282 72 360 142 478 58"/>
            <path class="c2" d="M112 118 172 226 282 72M188 168 330 206 360 142M282 72 412 96 478 58"/>
            <g class="stars">
              <circle cx="38" cy="214" r="3"/><circle cx="112" cy="118" r="4"/>
              <circle cx="188" cy="168" r="3"/><circle cx="282" cy="72" r="5"/>
              <circle cx="360" cy="142" r="3"/><circle cx="478" cy="58" r="4"/>
            </g>
            <circle class="chart-ring" cx="282" cy="150" r="86"/>
            <path class="chart-needle" d="M282 150 330 96"/>
          </svg>
          <div class="intro-cx-main">
            <span class="intro-cx-kicker">ARCHIVE · No.<b data-cx="no">--</b></span>
            <b class="intro-cx-word">CODEX</b>
            <i class="intro-cx-sub">星轨秘典</i>
          </div>
          <span class="intro-cx-foot"><b data-cx="date">----.--.--</b><i></i><b data-cx="time">--:--</b></span>
        </div>`);
      const data = introData();
      const put = (key, value) => {
        const node = stage.querySelector(`[data-cx="${key}"]`);
        if (node) node.textContent = value;
      };
      put('no', data.games);
      put('date', data.date);
      put('time', data.time);
    }
  });

  register('riso', {
    label: '三色套印',
    duration: 2400,
    hint: '点击或按任意键跳过',
    setup(overlay) {
      overlay.classList.add('intro-riso');
      const stage = ensureIntroStage(overlay, 'intro-rs', `
        <span class="intro-rs-plate blue"></span>
        <span class="intro-rs-plate yellow"></span>
        <span class="intro-rs-plate pink"></span>
        <span class="intro-rs-dots"></span>
        <div class="intro-rs-main">
          <span class="intro-rs-kicker">RISOGRAPH · PRINT 01</span>
          <b class="intro-rs-word" data-text="RISO">RISO</b>
          <span class="intro-rs-sub">电波海报<i></i><b data-rs="games">--</b> TITLES</span>
        </div>
        <span class="intro-rs-bar"><i></i></span>`);
      const data = introData();
      const games = stage.querySelector('[data-rs="games"]');
      if (games) games.textContent = data.games;
    }
  });


  function ensureSealStage(overlay) {
    let stage = overlay.querySelector('.intro-gs');
    if (stage) return stage;
    stage = document.createElement('div');
    stage.className = 'intro-gs';
    stage.setAttribute('aria-hidden', 'true');
    stage.innerHTML = `
      <span class="intro-gs-page" aria-hidden="true"></span>
      <span class="intro-gs-shock" aria-hidden="true"></span>
      <i class="intro-gs-corner tl" aria-hidden="true"></i>
      <i class="intro-gs-corner tr" aria-hidden="true"></i>
      <i class="intro-gs-corner bl" aria-hidden="true"></i>
      <i class="intro-gs-corner br" aria-hidden="true"></i>
      <div class="intro-gs-seal" aria-hidden="true"><b>--</b></div>
      <div class="intro-gs-main">
        <div class="intro-gs-kicker">// ADVENTURER RECORD · <b data-gs="no">No.--</b></div>
        <div class="intro-gs-word">
          <span class="intro-gs-solid">GRIMOIRE</span>
          <span class="intro-gs-hollow">ADVENTURER RECORD</span>
        </div>
        <div class="intro-gs-mark">冒险者档案</div>
        <div class="intro-gs-fields">
          <span>DATE <b data-gs="date">----.--.--</b></span>
          <span>TIME <b data-gs="time">--:--</b></span>
          <span>RECORDS <b data-gs="games">--</b></span>
        </div>
      </div>
      <div class="intro-gs-foot">
        <span class="intro-gs-status"><i></i><b data-gs="stamp">归档中</b></span>
        <span class="intro-gs-bar"><i></i></span>
        <span class="intro-gs-count" data-gs="foot">No.--</span>
      </div>`;
    overlay.appendChild(stage);
    return stage;
  }


  function ensureSunStage(overlay) {
    let stage = overlay.querySelector('.intro-su');
    if (stage) return stage;
    stage = document.createElement('div');
    stage.className = 'intro-su';
    stage.setAttribute('aria-hidden', 'true');
    stage.innerHTML = `
      <span class="intro-su-top" aria-hidden="true"></span>
      <span class="intro-su-horizon" aria-hidden="true"></span>
      <span class="intro-su-disc" aria-hidden="true"></span>
      <div class="intro-su-main">
        <span class="intro-su-plate"><b class="intro-su-lead">SUMMER</b></span>
        <span class="intro-su-plate"><b class="intro-su-sub">SEASON SALE</b></span>
        <span class="intro-su-plate"><b class="intro-su-mark">夏日特辑</b></span>
      </div>
      <div class="intro-su-foot">
        <span class="intro-su-chip" data-su="date">----.--.--</span>
        <i></i>
        <span class="intro-su-chip" data-su="time">--:--</span>
        <i></i>
        <span class="intro-su-chip"><b data-su="games">--</b> TITLES</span>
      </div>`;
    overlay.appendChild(stage);
    return stage;
  }

  function ensureDuskStage(overlay) {
    let stage = overlay.querySelector('.intro-dk');
    if (stage) return stage;
    stage = document.createElement('div');
    stage.className = 'intro-dk';
    stage.setAttribute('aria-hidden', 'true');
    // The atelier at dusk: a horizon line, a low sun, one synthesis ring,
    // and a ledger row of real values. No invented telemetry.
    stage.innerHTML = `
      <span class="intro-dk-sky" aria-hidden="true"></span>
      <span class="intro-dk-sun" aria-hidden="true"></span>
      <span class="intro-dk-horizon" aria-hidden="true"></span>
      <svg class="intro-dk-ring" viewBox="0 0 520 520" aria-hidden="true">
        <circle class="dk-ring-track" cx="260" cy="260" r="236"></circle>
        <circle class="dk-ring-draw" cx="260" cy="260" r="236"></circle>
        <circle class="dk-ring-inner" cx="260" cy="260" r="176"></circle>
        <g class="dk-ring-ticks">
          <path d="M260 12v26M260 482v26M12 260h26M482 260h26"></path>
          <path d="M436 84l-18 18M84 436l18-18M436 436l-18-18M84 84l18 18"></path>
        </g>
        <circle class="dk-ring-bead" cx="260" cy="24" r="5"></circle>
      </svg>
      <div class="intro-dk-main">
        <span class="intro-dk-kicker">DUSK ATELIER · 第 <b data-dk="year">----</b> 年</span>
        <div class="intro-dk-word">
          <span class="intro-dk-line"><b>黄昏</b></span>
          <span class="intro-dk-line"><b>之炼</b></span>
        </div>
        <span class="intro-dk-latin">ATELIER OF THE DUSK</span>
        <div class="intro-dk-ledger">
          <span>日期 <b data-dk="date">----.--.--</b></span>
          <span>时刻 <b data-dk="time">--:--</b></span>
          <span>藏本 <b data-dk="games">--</b> 册</span>
        </div>
      </div>
      <div class="intro-dk-foot">
        <span class="intro-dk-state"><i></i>点火 · 开炉</span>
        <span class="intro-dk-pct" data-dk="pct">000%</span>
      </div>`;
    overlay.appendChild(stage);
    return stage;
  }

  function ensureMnemoStage(overlay) {
    let stage = overlay.querySelector('.intro-mn');
    if (stage) return stage;
    stage = document.createElement('div');
    stage.className = 'intro-mn';
    stage.setAttribute('aria-hidden', 'true');
    stage.innerHTML = `
      <div class="intro-mn-map" aria-hidden="true">
        <i class="mn-node a"></i><i class="mn-node b"></i><i class="mn-node c"></i>
        <i class="mn-node d"></i><i class="mn-node e"></i><span class="mn-route"></span>
      </div>
      <div class="intro-mn-head">
        <span>// MYSTERY BUREAU</span>
        <span class="intro-mn-clock"><b data-mn="date">----.--.--</b><i>│</i><b data-mn="time">--:--</b></span>
      </div>
      <div class="intro-mn-main">
        <div class="intro-mn-kicker">// ARCHIVE ACCESS · <b data-mn="games">--</b> ENTRIES</div>
        <div class="intro-mn-word">
          <span class="intro-mn-solid">MNEMO</span>
          <span class="intro-mn-hollow">MYSTERY BUREAU</span>
        </div>
        <div class="intro-mn-mark">神秘管理局</div>
        <div class="intro-mn-fields">
          <span>YEAR <b data-mn="year">----</b></span>
          <span>ENTRY <b data-mn="entry">--</b></span>
          <span>STATUS <b>SYNC</b></span>
        </div>
      </div>
      <div class="intro-mn-error"><b>档案无法读取</b><i>UNABLE TO READ ARCHIVE</i></div>
      <div class="intro-mn-foot">
        <span class="intro-mn-status"><i></i>SCAN</span>
        <span class="intro-mn-bar"><i></i></span>
        <span class="intro-mn-pct" data-mn="pct">000%</span>
      </div>`;
    overlay.appendChild(stage);
    return stage;
  }

  function ensureZeroHourStage(overlay) {
    let stage = overlay.querySelector('.intro-zh2');
    if (stage) return stage;
    stage = document.createElement('div');
    stage.className = 'intro-zh2';
    stage.setAttribute('aria-hidden', 'true');
    // ZERO HOUR's language is a CRT signal resolving into a comic page, not a
    // terminal log: the screen powers on, "NO SIGNAL" holds a beat, then a
    // panel cuts in diagonally with the title and a lime subtitle band.
    stage.innerHTML = `
      <div class="intro-zh2-screen" aria-hidden="true">
        <span class="intro-zh2-glass"></span>
        <span class="intro-zh2-scan"></span>
        <span class="intro-zh2-noise"></span>
        <div class="intro-zh2-signal">
          <span class="intro-zh2-bars"><i></i><i></i><i></i><i></i><i></i><i></i></span>
          <b>NO SIGNAL</b>
          <em>CH.<span data-zh="games">--</span></em>
        </div>
        <div class="intro-zh2-panel">
          <span class="intro-zh2-kicker">// GUGUOVA BROADCAST · <b data-zh="date">----.--.--</b></span>
          <div class="intro-zh2-word"><span>ZERO</span><span>HOUR</span></div>
          <span class="intro-zh2-band">零点街区</span>
          <span class="intro-zh2-titles" data-zh="titles">-- TITLES</span>
        </div>
        <span class="intro-zh2-speed"></span>
        <span class="intro-zh2-lime left"></span>
        <span class="intro-zh2-lime right"></span>
      </div>
      <div class="intro-zh2-foot">
        <span class="intro-zh2-onair"><i></i>ON AIR</span>
        <span data-zh="time">--:--</span>
      </div>`;
    overlay.appendChild(stage);
    return stage;
  }

  function ensureEndfieldStage(overlay) {
    let stage = overlay.querySelector('.intro-ef2');
    if (stage) return stage;
    stage = document.createElement('div');
    stage.className = 'intro-ef2';
    stage.setAttribute('aria-hidden', 'true');
    // Built to the endfield-ui rules: paper ground, one acid-yellow fill used
    // only for the current state, square blocks, hairlines instead of shadows,
    // real numbers only (date / time / game count), motion under a second.
    stage.innerHTML = `
      <span class="intro-ef2-band" aria-hidden="true"></span>
      <div class="intro-ef2-shell">
        <div class="intro-ef2-head">
          <span class="intro-ef2-kicker">// STARTUP SEQUENCE</span>
          <span class="intro-ef2-stamp">
            <b data-ef="date">----.--.--</b><i>│</i><b data-ef="time">--:--</b>
          </span>
        </div>
        <div class="intro-ef2-main">
          <div class="intro-ef2-word">
            <span class="intro-ef2-solid"><i>N</i><i>O</i><i>V</i><i>A</i></span>
            <span class="intro-ef2-hollow">SPACE</span>
          </div>
          <div class="intro-ef2-cn">游戏空间</div>
          <div class="intro-ef2-state">
            <span class="intro-ef2-chip">READY</span>
            <span class="intro-ef2-state-label">// LOCAL LIBRARY</span>
          </div>
          <div class="intro-ef2-count" aria-hidden="true">
            <b data-ef="gamesBig">--</b>
            <i>// TITLES</i>
          </div>
        </div>
        <span class="intro-ef2-spine">// GUGUOVA GAME SPACE</span>
        <div class="intro-ef2-foot">
          <span><i>GAMES</i><b data-ef="games">--</b></span>
          <span><i>THEME</i><b>ENDFIELD</b></span>
          <span><i>YEAR</i><b data-ef="year">----</b></span>
        </div>
      </div>`;
    overlay.appendChild(stage);
    return stage;
  }

  /* Digits lock left-to-right; separators are kept so the value stays legible. */
  function scramble(node, finalValue, duration) {
    const glyph = /[0-9A-Za-z]/;
    const pool = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    const started = performance.now();
    const length = finalValue.length;
    const tick = (now) => {
      const t = Math.min(1, (now - started) / duration);
      let out = '';
      for (let i = 0; i < length; i += 1) {
        const char = finalValue[i];
        if (!glyph.test(char) || t >= (i + 1) / length) out += char;
        else out += pool[(Math.random() * pool.length) | 0];
      }
      node.textContent = out;
      if (t < 1) requestAnimationFrame(tick);
      else node.textContent = finalValue;
    };
    requestAnimationFrame(tick);
  }

  function runMeter(node, reduce) {
    if (!node) return;
    if (reduce) {
      node.textContent = '100%';
      return;
    }
    const started = performance.now();
    const tick = (now) => {
      const t = Math.min(1, Math.max(0, (now - started - 160) / 1900));
      node.textContent = `${String(Math.round(t * 100)).padStart(3, '0')}%`;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ============================================================
     REPLAY SUPPORT
     finish() removes the overlay, so a second play() would find nothing.
     Keep a pristine copy and rebuild from it on replay, stripping the
     previous preset's classes and any stage it built. This is what makes
     headless intro capture (tools/shot-intro.js) possible after boot.
     ============================================================ */

  let overlayStash = null;

  function stashOverlay(overlay) {
    if (!overlay) return;
    try { overlayStash = overlay.cloneNode(true); } catch (error) { overlayStash = null; }
  }

  function restoreOverlay() {
    if (!overlayStash) return null;
    const node = overlayStash.cloneNode(true);
    node.className = 'intro';
    node.removeAttribute('style');
    node.setAttribute('aria-hidden', 'true');
    node.querySelectorAll(STAGE_SELECTOR).forEach((el) => el.remove());
    document.body.appendChild(node);
    return node;
  }

  const STAGE_SELECTOR = '.intro-gs, .intro-mn, .intro-dk, .intro-zh, .intro-zh2, .intro-ef, .intro-ef2, .intro-su, .intro-vn, .intro-bc, .intro-dr, .intro-nv, .intro-au, .intro-cx, .intro-rs';

  function isPlaying() { return state.playing; }

  const state = {
    playing: false,
    finished: false,
    overlay: null,
    preset: DEFAULT,
    timer: 0,
    removeTimer: 0,
    resolve: null,
    startedAt: 0
  };

  const reduceMotion = () => !!(window.NovaMotion && window.NovaMotion.reduce);

  function setPreset(id) {
    const wanted = typeof id === 'string' && presets.has(id) ? id : DEFAULT;
    state.preset = wanted;
    if (state.overlay) state.overlay.dataset.intro = wanted;
    return presets.get(wanted);
  }

  function bindSkip() {
    window.addEventListener('keydown', onSkipKey, true);
    window.addEventListener('pointerdown', onSkipPointer, true);
  }

  function unbindSkip() {
    window.removeEventListener('keydown', onSkipKey, true);
    window.removeEventListener('pointerdown', onSkipPointer, true);
  }

  function onSkipKey(event) {
    // The first frame or two should not be skipped by a held key.
    if (performance.now() - state.startedAt < 180) return;
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') event.preventDefault();
    skip();
  }

  function onSkipPointer() {
    if (performance.now() - state.startedAt < 180) return;
    skip();
  }

  function finish(skipped) {
    if (!state.playing || state.finished) return;
    state.finished = true;
    clearTimeout(state.timer);
    unbindSkip();

    const overlay = state.overlay;
    document.body.classList.remove('is-intro');
    document.body.classList.add('is-booted');
    if (overlay) {
      overlay.classList.add('is-done');
      overlay.setAttribute('aria-hidden', 'true');
      // Keep one clean copy so the sequence can be replayed headlessly.
      // The overlay is removed from the DOM after boot, and a screenshot run
      // that starts after boot would otherwise have nothing to capture.
      stashOverlay(overlay);
      clearTimeout(state.removeTimer);
      state.removeTimer = setTimeout(() => {
        state.removeTimer = 0;
        if (overlay && overlay.parentNode) overlay.remove();
      }, reduceMotion() ? 240 : 900);
    }
    state.playing = false;
    if (state.resolve) state.resolve({ skipped: skipped === true, preset: state.preset });
    state.resolve = null;
  }

  function skip() {
    finish(true);
  }

  /**
   * Starts the opening sequence.
   * options: { intro: string, themeId?: string, force?: boolean }
   * Resolves when the interface is revealed.
   */
  function play(options = {}) {
    if (state.playing) return Promise.resolve({ skipped: false, preset: state.preset, already: true });

    const overlay = document.getElementById('introOverlay') || restoreOverlay();
    state.overlay = overlay;
    state.startedAt = performance.now();
    state.finished = false;
    // A pending removal from the previous sequence must not delete the
    // overlay while a replay is using it.
    clearTimeout(state.removeTimer);
    state.removeTimer = 0;

    // A replay must start from a clean stage. Without this, the previous
    // preset's custom stage (e.g. NOVA's diamond) stays in the DOM and
    // shows through the next preset (e.g. AURUM's doors).
    if (overlay) {
      overlay.querySelectorAll(STAGE_SELECTOR).forEach((el) => el.remove());
      overlay.classList.remove(
        'is-done', 'intro-nova', 'intro-aurum-v2', 'intro-codex-v2', 'intro-riso',
        'intro-aurum', 'intro-mnemo', 'intro-endfield', 'intro-zerohour',
        'intro-seal', 'intro-sun', 'intro-codex', 'intro-vinyl', 'intro-draft',
        'intro-broadcast'
      );
    }

    const preset = setPreset(options.intro);
    document.body.classList.add('is-intro');

    if (!overlay) {
      document.body.classList.remove('is-intro');
      document.body.classList.add('is-booted');
      return Promise.resolve({ skipped: false, preset: preset.id, missing: true });
    }

    const hint = overlay.querySelector('.intro-hint');
    if (hint && preset.hint) hint.textContent = preset.hint;

    // Restart shared choreography for this activation.
    void overlay.offsetWidth;
    overlay.classList.add('is-playing');
    state.playing = true;

    if (preset.setup) {
      try { preset.setup(overlay); } catch (error) { console.warn('intro preset setup', error); }
    }

    const duration = reduceMotion() ? 320 : (Number(preset.duration) || 2200);
    bindSkip();

    return new Promise((resolve) => {
      state.resolve = resolve;
      state.timer = setTimeout(() => finish(false), duration);
      // Safety: a missed timer must never leave the shell hidden.
      setTimeout(() => {
        if (!document.body.classList.contains('is-booted')) {
          document.body.classList.add('is-booted');
          document.body.classList.remove('is-intro');
        }
      }, duration + 1800);
    });
  }

  // Exposed for the controller adapter: any pad button skips the intro.
  function padSkip() {
    if (!state.playing) return false;
    skip();
    return true;
  }

  window.NovaIntro = {
    register,
    play,
    skip,
    padSkip,
    presets: () => Array.from(presets.values()),
    get active() { return state.playing; },
    get preset() { return state.preset; }
  };
})();
