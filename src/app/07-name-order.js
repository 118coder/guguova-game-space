/* ============================================================
   APP PART 07 · name-order —— 名称自然序 —— 中文数字解析与比较器；含「第零章=0.5」「半章=+0.5」两条库里实证特例（不可删）
   这是 src/app/ 分片之一：由 tools/build-app.js 按文件名序拼回 src/app.js。
   所有分片共享同一个 IIFE 闭包（跨分片直接引用函数与 state）。
   改代码请改分片，改完运行 node tools/build-app.js；直接编辑 app.js 会被覆盖。
   ============================================================ */

  /* ============================================================
     NAME ORDER — natural, and literate in Chinese numerals
     ============================================================ */

  // Sorting by plain localeCompare puts 第八季 after 第九季 and 第十章 before
  // 第四章: a Chinese numeral is a character, so the collator orders it by
  // glyph, not by value. Versioned titles (DNF 第N季 第M章) are exactly where
  // that is unusable, so a name is split into numbers and words, numbers are
  // compared by value and words by the usual collator.
  const CN_DIGIT = {
    零: 0, 〇: 0, 一: 1, 壹: 1, 二: 2, 两: 2, 贰: 2, 三: 3, 叁: 3, 四: 4, 肆: 4,
    五: 5, 伍: 5, 六: 6, 陆: 6, 七: 7, 柒: 7, 八: 8, 捌: 8, 九: 9, 玖: 9
  };
  const CN_UNIT = {
    十: 10, 拾: 10, 百: 100, 佰: 100, 千: 1000, 仟: 1000,
    万: 10000, 億: 100000000, 亿: 100000000
  };

  /** 十八 → 18, 二十三 → 23, 一百零五 → 105, 十 → 10, 一万 → 10000. */
  function chineseNumber(text) {
    // 零五 is how this library writes "Act 0.5" (第一季 第零五章 = Act0.5):
    // a leading 零 followed by digits only is a fraction, not the 零
    // placeholder inside 一百零五.
    if (text.length > 1 && (text[0] === '零' || text[0] === '〇')
        && !/[十拾百佰千仟万亿億]/.test(text)) {
      const fraction = [...text.slice(1)].map((char) => CN_DIGIT[char]).join('');
      return Number(`0.${fraction}`);
    }

    let total = 0;
    let section = 0;
    let digit = 0;
    for (const char of text) {
      if (char in CN_DIGIT) {
        digit = CN_DIGIT[char];
        continue;
      }
      const unit = CN_UNIT[char];
      if (unit == null) continue;
      if (unit >= 10000) {
        // 万/亿 close a section: 十二万 = (12) * 10000.
        section = (section + digit) * unit;
        total += section;
        section = 0;
      } else {
        // A bare 十/百/千 means one of them: 十八 is 18, not 08.
        section += (digit || 1) * unit;
      }
      digit = 0;
    }
    return total + section + digit;
  }

  // Arabic digits and Chinese numerals are the only runs that become numbers;
  // everything else stays text so word order is untouched.
  const NAME_TOKEN = /(\d+)|([零〇一壹二两贰三叁四肆五伍六陆七柒八捌九玖十拾百佰千仟万亿億]+)/g;

  /** "DNF第八季 第十八章：…" → [[1,'DNF第'],[0,8],[1,'季 第'],[0,18],[1,'章：…']] */
  function nameParts(value) {
    const text = String(value == null ? '' : value);
    const parts = [];
    let last = 0;
    for (const match of text.matchAll(NAME_TOKEN)) {
      if (match.index > last) parts.push([1, text.slice(last, match.index)]);
      let number = match[1] != null ? Number(match[1]) : chineseNumber(match[2]);
      let end = match.index + match[0].length;
      // 半 is half of the unit just named: 第四半章 is Act 4.5, so it has to
      // land between 第四章 and 第五章 instead of tying with 第四章.
      if (text[end] === '半') {
        number += 0.5;
        end += 1;
      }
      parts.push([0, number]);
      last = end;
    }
    if (last < text.length) parts.push([1, text.slice(last)]);
    return parts;
  }

  const nameCollator = new Intl.Collator('zh-Hans-CN');

  /**
   * Total order over names: compare part by part, numbers by value and words
   * by the collator. Kind is compared first so the result stays transitive
   * (numbers before text at the same position) — a comparator that mixes the
   * two orders can leave Array#sort with an unstable layout.
   */
  function compareNames(a, b) {
    const left = nameParts(a);
    const right = nameParts(b);
    const limit = Math.min(left.length, right.length);
    for (let i = 0; i < limit; i += 1) {
      const [kindA, valueA] = left[i];
      const [kindB, valueB] = right[i];
      if (kindA !== kindB) return kindA - kindB;
      const order = kindA === 0 ? valueA - valueB : nameCollator.compare(valueA, valueB);
      if (order) return order;
    }
    if (left.length !== right.length) return left.length - right.length;
    return nameCollator.compare(String(a), String(b));
  }

  /**
   * The direction a mode reads in when nobody has flipped it: names go A→Z
   * (一→二→三), everything else is a time or a count, where "most recent /
   * most played first" is what the option name promises.
   */
  const SORT_DEFAULT_DIR = {
    recent: 'desc', name: 'asc', playtime: 'desc', added: 'desc', launches: 'desc'
  };

  /** Effective direction for a mode: the player's choice, else the default. */
  function sortDir(mode) {
    const value = state.settings.librarySortDir;
    if (value === 'asc' || value === 'desc') return value;
    return SORT_DEFAULT_DIR[mode] || 'asc';
  }

  /**
   * One button, two states. It reflects the direction currently applied to the
   * list — including the mode's default — so the arrow never disagrees with
   * the order on screen.
   */
  function syncSortDirection(dir) {
    if (!els.libSortDir) return;
    const desc = dir === 'desc';
    els.libSortDir.dataset.dir = desc ? 'desc' : 'asc';
    els.libSortDir.setAttribute('aria-label', desc ? '当前降序，点击切换为升序' : '当前升序，点击切换为降序');
    els.libSortDir.title = desc ? '降序 · 点击切换为升序' : '升序 · 点击切换为降序';
  }

