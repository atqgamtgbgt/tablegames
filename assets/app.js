// ── js/app.js ───────────────────────────────────────────────
const NS_APP = (async () => {
  const { store } = NS_STORE;
  const { sfx } = NS_AUDIO;
  const { settings, DETAILS, TEXT_SIZES } = NS_SETTINGS;
  const { LessonRunner, stepKeys, legacyStepKeys, stepIndexOf, goSolutions } = NS_LESSON;
  const { KIND_JA, lessonFor } = NS_COACH;
  const { chess } = NS_DCHESS;
  const { shogi } = NS_DSHOGI;
  const { mahjong } = NS_DMAHJONG;
  const { go } = NS_DGO;
  // app.js — 画面の組み立てとルーティング。
  // ルートは #/ , #/chess , #/chess/chess.rook の3階層だけ。








  const GAMES = { chess, shogi, go, mahjong };
  // 問題のIDは、どの問題も動かす前（起動直後）に一度だけ作っておく
  for (const g of Object.values(GAMES)) for (const c of g.chapters) for (const l of c.lessons) stepKeys(l);
  // 改行をまたぐ空白は、前後どちらかが日本語かタグなら消し、英数字どうしなら半角スペース1つにする
  const tidy = (str) => str.replace(/[ \t]*\n\s*/g, (m, at, all) => {
    const a = all[at - 1] || '', b = all[at + m.length] || '';
    return /[^\x00-\x7f]|[<>]/.test(a) || /[^\x00-\x7f]|[<>]/.test(b) ? '' : ' ';
  });
  const tidyDeep = (v) => {
    if (typeof v === 'string') return tidy(v);
    if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) v[i] = tidyDeep(v[i]); return v; }
    if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
      for (const k of Object.keys(v)) v[k] = tidyDeep(v[k]);
    }
    return v;
  };
  for (const g of Object.values(GAMES)) {
    for (const k of ['blurb', 'name']) if (typeof g[k] === 'string') g[k] = tidy(g[k]);
    for (const c of g.chapters) for (const l of c.lessons) { l.desc = l.desc && tidy(l.desc); l.steps.forEach(tidyDeep); }
  }
  // 検算スクリプト（tools/verify_puzzles.py）が問題とエンジンを読み出すための入口。URL に ?export を付けて開いたときだけ作る
  if (new URLSearchParams(location.search).has('export')) {
    window.__bangi = {
      games: GAMES, chess: NS_CHESS, shogi: NS_SHOGI, mahjong: NS_MAHJONG, coach: NS_COACH, tasks: THINK_TASKS_FACTORY(),
      tsume: { book: NS_LESSON.TSUME_BOOK, key: NS_LESSON.tsumeKey, moveKey: NS_LESSON.shogiMoveKey },
    };
  }
  const $ = (s) => document.querySelector(s);
  const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };
  const flat = (g) => g.chapters.flatMap((c) => c.lessons);

  function toast(msg, ms = 2600) {
    // 前のお知らせが残っていると同じ場所に重なるので、消してから出す
    for (const old of document.querySelectorAll('.toast')) old.remove();
    const t = el('div', 'toast', msg);
    t.setAttribute('role', 'status');
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }

  /** 保存した進捗を、ブラウザが空き容量の整理などで消す対象から外してもらう（対応するブラウザだけ・1回だけ） */
  let persistAsked = false;
  function askPersist() {
    if (persistAsked || !navigator.storage?.persist) return;
    persistAsked = true;
    navigator.storage.persisted().then((ok) => ok || navigator.storage.persist()).catch(() => { });
  }

  /**
   * 以前の版のID（解説の文章まで含めて計算していたもの・何問目かの番号）で付いている復習の記録を、
   * 新しいIDに付け替える。付け替えたあとは何もしないので、何度実行しても結果は同じ
   */
  function migrateReviewKeys() {
    const moves = [];
    for (const g of Object.values(GAMES)) for (const c of g.chapters) for (const l of c.lessons) {
      const now = stepKeys(l), old = legacyStepKeys(l);
      l.steps.forEach((_, i) => {
        for (const k of [old[i], String(i)]) if (k !== now[i]) moves.push([`${l.id}#${k}`, `${l.id}#${now[i]}`]);
      });
    }
    const live = moves.filter(([from]) => { const r = store.state.reviews[from]; return r && !r.cleared; });
    if (!live.length) return;
    store.update((s) => {
      for (const [from, to] of live) {
        const r = s.reviews[from], cur = s.reviews[to];
        if (!r || r.cleared) continue;
        if (!cur || (cur.at || 0) < (r.at || 0)) s.reviews[to] = { ...r };   // 新しい方の記録を残す
        s.reviews[from] = { cleared: true, at: Date.now() };   // 古いIDは「済」にして、ほかの端末から戻ってこないようにする
      }
    });
  }

  /** パネルをダイアログとして扱う：Escで閉じる・開いたらフォーカスを移す・閉じたら元へ戻す */
  function wireSheet(sheet, card) {
    const opener = document.activeElement;
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    const h = card.querySelector('h2');
    if (h) { h.id = h.id || `sheet-h-${Date.now()}`; card.setAttribute('aria-labelledby', h.id); }
    card.tabIndex = -1;
    card.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { sheet.remove(); return; }
      if (e.key !== 'Tab') return;
      // フォーカスをパネルの中にとどめる（背後の画面へ抜けないように）
      const items = [...card.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
        .filter((x) => !x.disabled && x.offsetParent !== null);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      const at = document.activeElement;
      if (e.shiftKey && (at === first || at === card || !card.contains(at))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (at === last || !card.contains(at))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    new MutationObserver((_, obs) => {
      if (!sheet.isConnected) { document.removeEventListener('keydown', onKey); obs.disconnect(); opener?.focus?.(); }
    }).observe(document.body, { childList: true });
  }

  // ── 盤の模様（カードの背景） ───────────────────────────────
  function pattern(game) {
    if (game === 'chess') {
      let r = '';
      for (let y = 0; y < 6; y++) for (let x = 0; x < 10; x++)
        if ((x + y) % 2 === 0) r += `<rect x="${x * 20}" y="${y * 20}" width="20" height="20"/>`;
      return `<svg viewBox="0 0 200 120" preserveAspectRatio="xMidYMid slice" fill="currentColor">${r}</svg>`;
    }
    if (game === 'shogi') {
      let r = '';
      for (let x = 0; x <= 10; x++) r += `<line x1="${x * 20}" y1="0" x2="${x * 20}" y2="120"/>`;
      for (let y = 0; y <= 6; y++) r += `<line x1="0" y1="${y * 20}" x2="200" y2="${y * 20}"/>`;
      return `<svg viewBox="0 0 200 120" preserveAspectRatio="xMidYMid slice" stroke="currentColor" stroke-width="1.5">${r}</svg>`;
    }
    if (game === 'go') {
      let r = '';
      for (let x = 0; x <= 10; x++) r += `<line x1="${x * 20}" y1="0" x2="${x * 20}" y2="120"/>`;
      for (let y = 0; y <= 6; y++) r += `<line x1="0" y1="${y * 20}" x2="200" y2="${y * 20}"/>`;
      for (const [x, y, f] of [[3, 2, 1], [4, 3, 0], [5, 2, 1], [6, 4, 0], [8, 3, 1], [7, 2, 0], [4, 4, 1]]) {
        r += `<circle cx="${x * 20}" cy="${y * 20}" r="8" ${f ? 'fill="currentColor"' : 'fill="none" stroke-width="2.4"'}/>`;
      }
      return `<svg viewBox="0 0 200 120" preserveAspectRatio="xMidYMid slice" stroke="currentColor" stroke-width="1.5" fill="none">${r}</svg>`;
    }
    let r = '';
    for (let y = 0; y < 4; y++) for (let x = 0; x < 7; x++)
      r += `<rect x="${x * 30 + 4}" y="${y * 32 + 4}" width="22" height="26" rx="3"/>`;
    return `<svg viewBox="0 0 200 128" preserveAspectRatio="xMidYMid slice" fill="currentColor">${r}</svg>`;
  }

  // ── 画面 ───────────────────────────────────────────────
  /**
   * 今日のコーチの提案を1つ選ぶ。いちばん最近に触ったゲームを優先して、
   * ① 今日の復習 ② 自分の悪手から ③ 最近の苦手の練習 ④ 次のレッスン ⑤ 全部終わっていれば対局 の順に見る
   */
  function coachPlan() {
    const now = Date.now();
    const games = Object.values(GAMES);
    const lastDay = (g) => {
      const tr = store.trend(g.id) || {};
      const days = Object.keys(tr.d || {}).sort();
      const d = days[days.length - 1] || '';
      const r = tr.r?.length ? new Date(tr.r[tr.r.length - 1][0]).toLocaleDateString('sv-SE') : '';
      const touched = flat(g).some((l) => store.isDone(l.id)) ? '0000-00-01' : '';
      // 持ち点に数えない盤（小さな盤やドリル）の対局も「最近触った」に入れる
      const at = store.record(g.id).at;
      const p = at ? new Date(at).toLocaleDateString('sv-SE') : '';
      return [d, r, p, touched].sort().pop();
    };
    const active = games.map((g) => ({ g, d: lastDay(g) })).filter((x) => x.d).sort((a, b) => (a.d < b.d ? 1 : -1)).map((x) => x.g);
    if (!active.length) {
      return { game: null, mood: 'happy', text: 'はじめまして！ 下から気になるゲームを1つ選んで、最初のレッスンから始めましょう。1レッスンは数分で終わります。', href: null };
    }
    const order = [...active, ...games.filter((g) => !active.includes(g))];
    // ① 今日の復習（期限が来た問題）
    for (const g of order) {
      const lessons = flat(g);
      const due = store.pendingReviews(`${g.id}.`).filter((r) => {
        if ((r.due || 0) > now) return false;
        const l = lessons.find((x) => x.id === r.lessonId);
        const n = l ? stepIndexOf(l, r.stepKey) : -1;
        return n >= 0 && l.steps[n].type !== 'teach';
      });
      if (due.length) {
        const cnt = {};
        for (const r of due) cnt[r.lessonId] = (cnt[r.lessonId] || 0) + 1;
        const lid = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0];
        return { game: g.id, mood: 'think', text: `${g.name}に、今日の復習が${due.length}問あります。忘れかけたころに解き直すのが、いちばん身につきます。`,
          label: `${g.name}の復習をする`, href: `#/${g.id}/${lid}/review` };
      }
    }
    // ② 自分の悪手から（対局で指摘された手）
    for (const g of order) {
      const m = store.pendingMistakes(g.id).length;
      if (m >= 2) {
        return { game: g.id, mood: 'hmm', text: `${g.name}の対局で指摘された手が、${m}問たまっています。解き直すと、同じミスが減っていきます。`,
          label: '自分の悪手から解く', href: `#/${g.id}/_mine` };
      }
    }
    const g0 = active[0];
    // ③ 最近の苦手（いちばん最近のゲームの、最近10局）
    const wk = store.weakness(g0.id, 10);
    const top = Object.entries(wk.total || {}).filter(([k]) => NS_COACH.KIND_JA[k]).sort((a, b) => b[1] - a[1])[0];
    const lid = top && wk.games >= 2 && top[1] >= 3 ? NS_COACH.lessonFor(g0.id, top[0]) : null;
    const tl = lid ? flat(g0).find((x) => x.id === lid) : null;
    if (tl) {
      return { game: g0.id, mood: 'think', text: `最近の${g0.name}で多いのは「${NS_COACH.KIND_JA[top[0]]}」です（${wk.games}局で${top[1]}回）。今日は「${tl.title}」で、ここを練習しましょう。`,
        label: `「${tl.title}」をやる`, href: `#/${g0.id}/${tl.id}` };
    }
    // ④ 次のレッスン
    const next = flat(g0).find((l) => !store.isDone(l.id));
    if (next) {
      return { game: g0.id, mood: 'happy', text: `${g0.name}の次のレッスンは「${next.title}」です。今日も1つ進めてみましょう。`,
        label: `「${next.title}」へ`, href: `#/${g0.id}/${next.id}` };
    }
    // ⑤ 全部終わった
    return { game: g0.id, mood: 'cheer', text: `${g0.name}のレッスンは全部終わりました。今日は対局で、覚えたことを試してみましょう。`,
      label: `${g0.name}を開く`, href: `#/${g0.id}` };
  }

  function viewHub() {
    const root = el('div', 'shell');
    const hero = el('div', 'hero', `
      <h1>盤戯のはじめかた</h1>
      <p>チェス・将棋・囲碁・麻雀を、ルールを読まずに覚えます。1レッスンごとに盤か牌を触って終わるので、読んだだけで終わることがありません。</p>`);
    root.appendChild(hero);

    const st = store.state;
    // 最後に学んだのが今日か昨日なら「つづいている」。それより前なら途切れているので出さない
    const dayStr = (t) => new Date(t).toLocaleDateString('sv-SE');
    const yd = new Date(); yd.setDate(yd.getDate() - 1);
    const alive = st.streak.last === dayStr(Date.now()) || st.streak.last === dayStr(yd.getTime());
    if (st.streak.count > 0 && alive) {
      root.appendChild(el('div', 'streak',
        `<b>${st.streak.count}</b><span>日つづけています（最長 ${st.streak.best} 日）</span>`));
    }

    // 今日のコーチの提案（1つだけ。迷わず始められるように）
    try {
      const plan = coachPlan();
      const box = el('div', 'today');
      box.style.setProperty('--tone', `var(--${plan.game || 'shu'})`);
      box.innerHTML = `<div class="cbub is-new" data-mood="${plan.mood}"><div class="cbub__face">${NS_PLAY.coachFace(plan.mood)}</div>`
        + `<p class="cbub__text"><span class="today__k">今日のコーチの提案</span><br>${plan.text}</p></div>`;
      if (plan.href) {
        const b = el('button', 'btn btn--tone today__go', plan.label);
        b.addEventListener('click', () => (location.hash = plan.href));
        box.appendChild(b);
      }
      root.appendChild(box);
    } catch { /* 提案が作れなくても、ホームは出す */ }

    const grid = el('div', 'games');
    for (const g of Object.values(GAMES)) {
      const lessons = flat(g);
      const doneCount = lessons.filter((l) => store.isDone(l.id)).length;
      const nowIdx = lessons.findIndex((l) => !store.isDone(l.id));
      const card = el('button', 'game');
      card.style.setProperty('--tone', `var(--${g.id})`);
      card.innerHTML = `
        <div class="game__pattern" style="color:var(--${g.id})">${pattern(g.id)}</div>
        <h2 class="game__name"><span>${g.latin}</span>${g.name}</h2>
        <p class="game__blurb">${g.blurb}</p>
        <div class="pboard" role="progressbar" aria-label="${g.name}のレッスン進捗" aria-valuemin="0" aria-valuenow="${doneCount}" aria-valuemax="${lessons.length}"><span class="pboard__fill" style="width:${Math.round(doneCount / Math.max(lessons.length, 1) * 100)}%"></span></div>
        <div class="game__foot">
          <span>${doneCount} / ${lessons.length} レッスン</span>
          <span>${doneCount === 0 ? 'はじめる' : doneCount === lessons.length ? '修了' : 'つづける'}</span>
        </div>
        ${nowIdx >= 0 ? `<p class="game__next">つぎ：${lessons[nowIdx].title}</p>` : ''}`;
      card.addEventListener('click', () => (location.hash = `#/${g.id}`));
      grid.appendChild(card);
    }
    root.appendChild(grid);
    // 上達の記録：記録のあるゲームだけを並べる（持ち点・持ち点の推移・最近7日の一発正解率）
    const sumRows = Object.values(GAMES).map((g) => {
      const tr = store.trend(g.id), rec = store.record(g.id);
      const ago = (k) => Math.round((new Date(new Date().toDateString()) - new Date(`${k}T00:00:00`)) / 86400000);
      const [o7, t7] = Object.entries(tr.d).filter(([k]) => ago(k) < 7).reduce((a, [, [ok, ng]]) => [a[0] + ok, a[1] + ok + ng], [0, 0]);
      const played = rec.w + rec.l + rec.d;
      // 麻雀は持ち点の代わりに、平均順位（半荘を打っていなければ和了率）
      const ms = g.id === 'mahjong' ? mjStatsOf(store.state.mj) : null;
      const mjText = ms ? (ms.han ? `平均順位 ${ms.avg.toFixed(2)}` : `和了率 ${ms.pct(ms.m.a)}％`) : null;
      if (!played && !t7 && !tr.r.length && !mjText) return null;
      const rt = NS_PLAY.recordText(g.id, rec);
      const vals = tr.r.map(([, v]) => v);
      let spark = '<span class="sum__spark"></span>';
      if (vals.length >= 2) {
        const lo = Math.min(...vals), hi = Math.max(...vals), sp = hi - lo || 1;
        const pts = vals.map((v, i) => `${((i * 96) / (vals.length - 1) + 2).toFixed(1)},${(22 - ((v - lo) / sp) * 18).toFixed(1)}`).join(' ');
        spark = `<svg class="sum__spark" viewBox="0 0 100 24" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="var(--tone)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
      }
      return `<a class="sum__row" href="#/${g.id}" style="--tone:var(--${g.id})"><span class="sum__g">${g.name}</span>`
        + `<span class="sum__v">${rt.rating || mjText || (played ? `${rec.w}勝${rec.l}敗` : '対局なし')}</span>${spark}`
        + `<span class="sum__v">${t7 ? `7日 ${Math.round((o7 / t7) * 100)}％（${t7}問）` : '7日 ―'}</span></a>`;
    }).filter(Boolean);
    if (sumRows.length) {
      root.appendChild(el('div', 'sum', `<h2 class="sum__h">上達の記録</h2>${sumRows.join('')}`
        + '<p class="sum__note">持ち点は本番の盤（チェスの本物の盤・本将棋・9路以上の碁）での対局の成績、麻雀は4人打ちの平均順位、％は最近7日に一発で正解した問題の割合です。ゲームを開くと、くわしいグラフが見られます。</p>'));
    }
    return root;
  }

  // ── 今日の1問・実力テスト：カリキュラムの問題から作る「仮のレッスン」
  //    対局や陣形づくりのような長いものは除く。どのレッスンの問題かは、解いたあとに表示する
  const DRILL_SKIP = new Set(['teach', 'play', 'play4', 'build', 'gfree']);
  /**
   * レッスンの外で1問だけ出すとき（今日の1問・実力テスト・復習テストなど）の問題。
   * 「もう1問。」「今度は」のような、前の問題を前提にした書き出しを外し、
   * 何をすればよいかが前の問題にしか書いていない1手詰めには、指示を足す
   */
  function standalone(step, title) {
    let p = typeof step.prompt === 'string'
      ? step.prompt.replace(/^もう1問[。、]\s*/, '').replace(/^同じ形で、今度は/, '').replace(/^今度は/, '')
      : step.prompt;
    if (step.type === 'move' && step.goal === 'mate' && typeof p === 'string' && !/詰|メイト/.test(p)) {
      p = `${step.state ? '1手で詰ませてください。' : '1手でチェックメイトにしてください。'}${p}`;
    }
    return { ...step, prompt: p, fromLesson: title };
  }
  function problemPool(g) {
    const out = [];
    for (const l of flat(g)) l.steps.forEach((s, i) => {
      if (!DRILL_SKIP.has(s.type)) out.push({ lesson: l, step: s, i });
    });
    return out;
  }
  const shuffled = (arr) => { const a = [...arr]; for (let k = a.length - 1; k > 0; k--) { const j = (Math.random() * (k + 1)) | 0; [a[k], a[j]] = [a[j], a[k]]; } return a; };
  const hashStr = (str) => { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  // 段位認定：20問の一発正解数で級・段を出す
  const EXAM_RANKS = [[20, '二段'], [18, '初段'], [17, '1級'], [16, '2級'], [15, '3級'], [14, '4級'], [12, '5級'],
    [10, '6級'], [8, '7級'], [6, '8級'], [4, '9級'], [0, '10級']];
  const examRank = (c, t) => { const s = Math.round((c / Math.max(1, t)) * 20); return EXAM_RANKS.find(([n]) => s >= n)[1]; };
  const examAdvice = (c, t) => (!t ? 'まずは一覧の上のレッスンから順に進めるのがおすすめです。' : c / t >= 0.9 ? '全範囲がしっかり身についています。対局で「つよい」相手に挑戦してみましょう。'
    : c / t >= 0.6 ? '間違えた問題の出題元レッスンを復習すると、1つ上を狙えます。'
      : 'まずは一覧の上のレッスンから順に進めるのがおすすめです。');
  const TAC_NAME = { fork: '両取り（フォーク）', pin: 'ピン', skewer: '串刺し（スキュア）', disc: 'ディスカバード' };
  /** 麻雀（4人打ち）の成績の数字。pct(n) は局数に対する％ */
  function mjStatsOf(m) {
    if (!m || !m.k) return null;
    const han = m.rk.reduce((a, b) => a + b, 0);
    return {
      m, han,
      avg: han ? m.rk.reduce((a, n, i) => a + n * (i + 1), 0) / han : 0,
      pct: (n) => Math.round((n / m.k) * 100),
      avgWin: m.a ? Math.round(m.ap / m.a / 100) * 100 : 0,
      avgLoss: m.h ? Math.round(m.hp / m.h / 100) * 100 : 0,
    };
  }
  /** 麻雀（4人打ち）の成績の表（ゲームのページ） */
  function mjStatsPanel(m) {
    const st = mjStatsOf(m);
    const box = el('div', 'weak');
    const yen = (v) => `${v.toLocaleString()}点`;
    box.appendChild(el('p', 'weak__lead', `数えた局 ${m.k}局${st.han ? `・半荘 ${st.han}回（平均順位 ${st.avg.toFixed(2)}）` : ''}`));
    // 棒の長さは50％で端まで（和了率・放銃率は20％前後なので、見やすいように）
    const rows = [['和了率', st.pct(m.a)], ['放銃率', st.pct(m.h)], ['立直率', st.pct(m.r)], ['副露率', st.pct(m.f)]];
    box.insertAdjacentHTML('beforeend', rows.map(([k, p]) => `<div class="weak__row"><span class="weak__k">${k}</span>`
      + `<span class="weak__bar"><i style="width:${Math.max(2, Math.min(100, p * 2))}%"></i></span><span class="weak__n">${p}％</span></div>`).join(''));
    const avg = [m.a ? `和了の平均 ${yen(st.avgWin)}（ツモ ${m.t}回）` : '', m.h ? `放銃の平均 ${yen(st.avgLoss)}` : ''].filter(Boolean).join('・');
    if (avg) box.appendChild(el('p', 'note', avg));
    if (st.han) {
      const max = Math.max(...m.rk, 1);
      box.insertAdjacentHTML('beforeend', '<p class="weak__lead" style="margin-top:.6rem">半荘の着順</p>'
        + m.rk.map((n, i) => `<div class="weak__row"><span class="weak__k">${i + 1}位</span>`
          + `<span class="weak__bar"><i style="width:${Math.max(4, (n / max) * 100)}%"></i></span><span class="weak__n">${n}回</span></div>`).join(''));
    }
    box.appendChild(el('p', 'note', (m.k < 40 ? '局数が少ないうちは、数字が大きくぶれます。' : '')
      + '和了率は高いほど、放銃率は低いほど良い数字です。ネット麻雀の平均的な打ち手は、和了率21％・放銃率12％くらいです（相手がちがうので目安です）。'
      + '同じ局を打ち直したときは、最初の1回だけを数えています。'));
    return box;
  }
  /** 小さな折れ線グラフ（上達の記録） */
  function trendChart(title, vals, fmt, labels = null) {
    const wrap = el('div', 'trend__chart');
    wrap.appendChild(el('p', 'weak__lead', title));
    const W = 300, H = 84, pad = 8;
    const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
    const x = (i) => (vals.length === 1 ? W / 2 : pad + (i * (W - pad * 2)) / (vals.length - 1));
    const y = (v) => H - pad - ((v - lo) / span) * (H - pad * 2);
    const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    wrap.insertAdjacentHTML('beforeend', `<svg class="trend__svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}：${fmt(vals[0])}から${fmt(vals[vals.length - 1])}">`
      + `<line x1="${pad}" y1="${H - pad}" x2="${W - pad}" y2="${H - pad}" stroke="currentColor" opacity=".25"/>`
      + `<polyline points="${pts}" fill="none" stroke="var(--tone)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`
      + vals.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="${vals.length > 20 ? 1.8 : 3}" fill="var(--tone)"/>`).join('')
      + '</svg>');
    wrap.appendChild(el('p', 'note', vals.length < 2
      ? `${labels ? `${labels[0]}　` : ''}${fmt(vals[0])}（記録が2つ以上たまると、ここに推移が出ます）`
      : `${labels ? `${labels[0]}〜${labels[labels.length - 1]}　` : ''}最初 ${fmt(vals[0])} → いま ${fmt(vals[vals.length - 1])}（最高 ${fmt(hi)}・最低 ${fmt(lo)}）`));
    return wrap;
  }
  function syntheticLesson(g, kind) {
    if (kind === '_tsumego') {
      // 詰碁ドリル：検算ずみの死活の問題（向きを変えたものを含む）から8問
      const bank = shuffled(g.tsumegoBank || []).slice(0, 8);
      if (!bank.length) return null;
      return { id: `${g.id}._tsumego`, game: g.id, title: '詰碁ドリル（8問）', steps: bank.map((st) => ({ ...st, fromLesson: '詰碁ドリル', retryAsMistake: true })) };
    }
    if (kind === '_review') {
      // 強くなるコース・道場の問題から10問。対局・解説は除く。間違えた問題は「自分の悪手から」で出し直す（関数で判定する問題は保存できないので除く）
      const SKIP = new Set(['teach', 'play', 'play4', 'gfree', 'kpkplay']);
      const pool = [];
      for (const c of g.chapters) {
        if (!/強くなる|道場/.test(c.title)) continue;
        for (const l of c.lessons) for (const st of l.steps) if (!SKIP.has(st.type)) pool.push({ ...standalone(st, l.title), retryAsMistake: !Object.values(st).some((v) => typeof v === 'function') });
      }
      if (!pool.length) return null;
      return { id: `${g.id}._review`, game: g.id, title: '強くなるコースの復習テスト（10問）', steps: shuffled(pool).slice(0, 10) };
    }
    if (kind === '_endgame') {
      const sets = g.id === 'chess'
        ? [['drill_rr', 'ルーク2枚で詰ます'], ['drill_q', 'クイーンで詰ます'], ['drill_r', 'ルーク1枚で詰ます']]
        : [['drill_kin', '金3枚で詰ます'], ['drill_hisha', '飛車2枚で詰ます'], ['drill_ryu', '竜と金で詰ます']];
      return {
        id: `${g.id}._endgame`, game: g.id, title: '終盤の型ドリル',
        steps: sets.map(([variant, title]) => ({ type: 'play', variant, fromLesson: title })),
      };
    }
    if (kind === '_score' && g.id === 'mahjong') {
      // 符と翻から点数を答える練習。数字は毎回ランダムに選ぶ
      const M = NS_MAHJONG;
      // [翻, 符, ロン専用]。七対子（25符）は2翻でもツモなら門前清自摸和がついて3翻になるので、2翻25符はロンだけ
      const combos = [[1, 30], [1, 40], [2, 30], [2, 40], [3, 30], [3, 40], [3, 50], [4, 30], [4, 40],
        [2, 25, true], [3, 25], [5, 30], [6, 30], [8, 30], [11, 30], [13, 30]];
      const pick = (n) => shuffled(combos).slice(0, n);
      const LIMIT = [[13, '役満', 8000], [11, '三倍満', 6000], [8, '倍満', 4000], [6, '跳満', 3000]];
      const limitName = (han, fu) => {
        const hit = LIMIT.find(([h]) => han >= h);
        if (hit) return hit[1];
        return M.basePoints(han, fu) >= 2000 ? '満貫' : null;
      };
      const labelOf = (h, f, o, ts) => {
        if (!ts) return `${M.ronPoints(h, f, o)}点`;
        const t = M.tsumoPoints(h, f, o);
        const sum = o ? t.fromKo * 3 : t.fromOya + t.fromKo * 2;
        return o ? `${t.fromKo}点オール（合計${sum}点）` : `${t.fromKo}点・${t.fromOya}点（合計${sum}点）`;
      };
      const steps = pick(8).map(([han, fu, ronOnly]) => {
        const oya = Math.random() < 0.35;
        const tsumo = !ronOnly && Math.random() < 0.5;
        const who = oya ? '親' : '子';
        const label = labelOf(han, fu, oya, tsumo);
        // 紛らわしい選択肢：親子の取り違え・翻や符のずれ・ロンとツモの取り違え。4つそろうまで候補を足す
        const cands = new Set([label]);
        const tries = [[han, fu, !oya, tsumo], [han + 1, fu, oya, tsumo], [Math.max(1, han - 1), fu, oya, tsumo],
          [han, fu + 10, oya, tsumo], [han, Math.max(20, fu - 10), oya, tsumo], [han + 2, fu, oya, tsumo],
          [Math.max(1, han - 2), fu, oya, tsumo], [han, fu, !oya, !tsumo && !ronOnly], [1, 30, oya, tsumo], [2, 30, !oya, tsumo]];
        for (const [h, f, o, ts] of tries) { if (cands.size >= 4) break; cands.add(labelOf(h, f, o, ts)); }
        const choices = shuffled([...cands].slice(0, 4));
        const lim = limitName(han, fu);
        const base = M.basePoints(han, fu);
        const pay = tsumo ? (oya ? '子3人がそれぞれ2倍を払います' : '子は基礎点、親は2倍を払います') : (oya ? '親のロンは6倍' : '子のロンは4倍');
        let why;
        if (lim && han >= 5) {
          why = `${han}翻は${lim}。${lim}からは符を使わず、基礎点${base}点で決まります（${pay}）。`;
        } else if (lim) {
          why = `${han}翻${fu}符は、基礎点（符×2の(翻+2)乗）が${fu * 2 ** (han + 2)}点で2000点を超えるので、満貫（基礎点2000点）として数えます（${pay}）。`;
        } else {
          why = `基礎点 ＝ ${fu}符 × 2の${han + 2}乗 ＝ ${base}点。${tsumo
            ? (oya ? 'これを2倍して、子3人がそれぞれ払います' : '子は基礎点、親は2倍を払います')
            : (oya ? 'これを6倍します' : 'これを4倍します')}（100点単位に切り上げ）。`;
        }
        return {
          type: 'quiz',
          prompt: `${who}の<strong>${han}翻${fu}符</strong>で${tsumo ? 'ツモ' : 'ロン'}。点数はいくつでしょう。`,
          choices: choices.map((t) => ({ t })),
          answer: choices.indexOf(label),
          why: `${who}の${han}翻${fu}符${tsumo ? 'ツモ' : 'ロン'}は${label}。${why}`,
          hint: han >= 5 ? '5翻以上は、翻数だけで点数が決まります（満貫・跳満・倍満…）。'
            : '基礎点を出してから、子は4倍・親は6倍します。基礎点が2000点を超えたら満貫です。',
        };
      });
      return { id: `${g.id}._score`, game: g.id, title: '点数計算ドリル', steps };
    }
    if (kind === '_mine') {
      // 種類がかたよらないように、期限の来たものから順番に、種類をまわしながら10問選ぶ
      const all = store.pendingMistakes(g.id);
      const byKind = new Map();
      for (const m of all) {
        if (!byKind.has(m.kind)) byKind.set(m.kind, []);
        byKind.get(m.kind).push(m);
      }
      const queues = [...byKind.values()];
      const list = [];
      while (list.length < 10 && queues.some((q) => q.length)) {
        for (const q of queues) { if (q.length && list.length < 10) list.push(q.shift()); }
      }
      if (!list.length) return null;
      return {
        id: `${g.id}._mine`, game: g.id, title: `自分の悪手から（${list.length}問）`,
        steps: list.map((m) => ({ ...m.step, mistakeId: m.id, fromLesson: m.from || '実戦' })),
      };
    }
    if (kind === '_tactics') {
      const a = [...(g.tacticsBank || [])];
      for (let k = a.length - 1; k > 0; k--) { const j = (Math.random() * (k + 1)) | 0; [a[k], a[j]] = [a[j], a[k]]; }
      return {
        id: `${g.id}._tactics`, game: g.id, title: 'タクティクス自動ドリル（10問）',
        steps: a.slice(0, 10).map(([type, board, ans]) => ({
          type: 'bestmove', side: 'w', board,
          answers: [{ from: ans.slice(0, 2), to: ans.slice(2) }],
          prompt: '駒得する手を見つけてください。型は伏せてあります。',
          hint: 'まず王手、次に守られていない駒、最後にキングと同じ線に並んだ駒を探します。',
          why: `型は<strong>${TAC_NAME[type] || type}</strong>でした。`,
        })),
      };
    }
    const pool = problemPool(g);
    let picks;
    if (kind === '_exam') {
      // 手順をなぞる問題は暗記なので除き、レッスンが偏らないように1レッスン1問まで
      const byLesson = new Map();
      for (const p of pool) {
        if (p.step.type === 'line' || p.step.type === 'sline') continue;
        if (!byLesson.has(p.lesson.id)) byLesson.set(p.lesson.id, []);
        byLesson.get(p.lesson.id).push(p);
      }
      const groups = [...byLesson.values()].map((a) => a[(Math.random() * a.length) | 0]);
      for (let k = groups.length - 1; k > 0; k--) { const j = (Math.random() * (k + 1)) | 0; [groups[k], groups[j]] = [groups[j], groups[k]]; }
      picks = groups.slice(0, 20);
      return {
        id: `${g.id}._exam`, game: g.id, title: '級・段テスト（20問・アプリ内の目安）',
        steps: picks.map((p) => standalone(p.step, p.lesson.title)),
      };
    }
    if (kind === '_daily') {
      picks = [pool[hashStr(g.id + todayKey()) % pool.length]];
    } else {
      const a = [...pool];
      for (let k = a.length - 1; k > 0; k--) { const j = (Math.random() * (k + 1)) | 0; [a[k], a[j]] = [a[j], a[k]]; }
      picks = a.slice(0, 10);
    }
    return {
      id: kind === '_daily' ? `${g.id}._daily` : `${g.id}._test`,
      game: g.id,
      title: kind === '_daily' ? `今日の1問（${todayKey()}）` : '実力テスト（10問）',
      steps: picks.map((p) => standalone(p.step, p.lesson.title)),
    };
  }


  // 既存の復習・対局記録・教材を組み合わせる15分メニュー
  function trainingPanel(g) {
    const lessons = flat(g);
    const done = lessons.filter((l) => store.isDone(l.id)).length;
    const due = store.pendingReviews(g.id + '.').filter((r) =>
      (r.due || 0) <= Date.now() && lessons.some((l) => l.id === r.lessonId));
    const mistakes = store.pendingMistakes(g.id).filter((r) => (r.due || 0) <= Date.now());
    const weakness = store.weakness(g.id, 10);
    const freq = Object.entries(weakness.total || {}).filter(([k, n]) => KIND_JA[k] && n > 0)
      .sort((a, b) => b[1] - a[1])[0];
    const weakId = freq && weakness.games >= 2 && freq[1] >= 2 ? lessonFor(g.id, freq[0]) : null;
    const weak = lessons.find((l) => l.id === weakId);
    const next = lessons.find((l) => !store.isDone(l.id));
    const strong = g.chapters.filter((c) => /強くなる|道場/.test(c.title))
      .flatMap((c) => c.lessons).find((l) => !store.isDone(l.id));
    const play = lessons.find((l) => l.steps.some((s) => ['play', 'play4', 'kpkplay'].includes(s.type)) &&
      !store.isDone(l.id)) || lessons.find((l) => l.steps.some((s) => ['play', 'play4', 'kpkplay'].includes(s.type)));
    const base = '#/' + g.id + '/';
    const reviewItem = due.length
      ? ['復習する（' + due.length + '問）', '忘れかけた問題に先に取り組む', base + due[0].lessonId + '/review']
      : ['今日の1問', '答えを見ずに考える', base + '_daily'];
    const focus = done < 3 ? next : (weak || strong || next);
    const focusItem = mistakes.length
      ? ['自分の悪手から（' + mistakes.length + '問）', '同じ悪手を繰り返さない', base + '_mine']
      : focus ? [focus.title, weak === focus ? '直近の対局で多い苦手を練習' : '今の段階に合うレッスン', base + focus.id]
        : ['強くなるコースの復習', 'ランダム10問で腕試し', base + '_review'];
    const playItem = play
      ? [play.title, '相手の応手を予想してから指す', base + play.id]
      : ['実力テスト', '10問で今の力を確認する', base + '_test'];
    const check = {
      chess: '王手はない？ 無防備な駒は？ 相手の次の一手は？',
      shogi: '王手は？ 駒をタダで取られない？ 相手の厳しい手は？',
      go: 'アタリは？ 石はつながる？ 眼は二つある？',
      mahjong: '向聴数・受け入れ・役・危険牌を確かめた？'
    };
    const sources = {
      chess: [['Lichess・練習問題', 'https://lichess.org/ja/practice'], ['Lichess・タクティクス', 'https://lichess.org/ja/training']],
      shogi: [['日本将棋連盟・オンライン将棋スクール', 'https://www.shogi.or.jp/school/oss.html'], ['81道場・感想戦', 'https://81dojo.com/jp/']],
      go: [['日本棋院・囲碁入門', 'https://www.nihonkiin.or.jp/teach/lesson/school/'], ['OGS・詰碁', 'https://online-go.com/puzzles']],
      mahjong: [['Riichi Book 1（英語）', 'https://repo.riichi.moe/books/rb1.html'], ['牌効率トレーナー（英語）', 'https://euophrys.itch.io/mahjong-efficiency-trainer']]
    };
    const section = el('section', 'training');
    section.style.setProperty('--tone', 'var(--' + g.id + ')');
    const title = el('h2', 'training__title'); title.id = 'training-' + g.id;
    const duration = el('div', 'training__duration');
    const durationLabel = el('label', 'training__durationLabel');
    durationLabel.textContent = '1日に使える時間';
    const durationInput = el('select', 'training__select');
    durationInput.id = 'training-minutes-' + g.id;
    durationLabel.htmlFor = durationInput.id;
    const allowedMinutes = [5, 15, 30];
    for (const n of allowedMinutes) {
      const option = document.createElement('option');
      option.value = String(n);
      option.textContent = n + '分';
      durationInput.appendChild(option);
    }
    durationInput.value = String(allowedMinutes.includes(Number(settings.get('trainingMinutes')))
      ? Number(settings.get('trainingMinutes')) : 15);
    duration.append(durationLabel, durationInput);
    section.setAttribute('aria-labelledby', title.id);
    const hint = el('p', 'training__intro');
    hint.textContent = done < 3 ? '最初は基本から。短い問題・練習・実戦を組み合わせましょう。'
      : due.length ? '今日の復習が届いています。先に解き直しましょう。'
        : freq && weakness.games >= 2 ? '直近' + weakness.games + '局の課題は「' + KIND_JA[freq[0]] + '」です。'
          : '1日で全部を覚えようとせず、少しずつ繰り返しましょう。';
    const grid = el('div', 'training__steps');
    const items = [['3分・思い出す', reviewItem], ['5分・弱点を直す', focusItem], ['7分〜・実戦で試す', playItem]];
    for (const [time, it] of items) {
      const a = el('a', 'training__step'); a.href = it[2];
      const badge = el('span', 'training__minutes'); badge.textContent = time;
      const name = el('strong', 'training__name'); name.textContent = it[0];
      const desc = el('span', 'training__note'); desc.textContent = it[1];
      a.append(badge, name, desc); grid.appendChild(a);
    }
    const updateDuration = () => {
      const minutes = Number(durationInput.value);
      const allocations = { 5: [1, 2, 2], 15: [3, 5, 7], 30: [5, 10, 15] };
      const parts = allocations[minutes] || allocations[15];
      title.textContent = '今日の' + minutes + '分・上達メニュー';
      grid.querySelectorAll('.training__minutes').forEach((part, i) => {
        const action = ['思い出す', '弱点を直す', '実戦で試す'][i];
        part.textContent = parts[i] + '分' + (i === 2 ? '〜' : '') + '・' + action;
      });
    };
    durationInput.addEventListener('change', () => {
      settings.set('trainingMinutes', Number(durationInput.value));
      updateDuration();
    });
    updateDuration();
    const question = el('p', 'training__check');
    question.textContent = 'コーチの確認ポイント：' + check[g.id];
    const more = el('details', 'training__more');
    const summary = el('summary'); summary.textContent = '4週間の強化コース・参考教材を開く';
    more.appendChild(summary);
    const stages = [
      '第1週：基本のレッスンと短い対局を繰り返す',
      '第2週：毎日5〜10問の練習、間違えた問題を後日解き直す',
      '第3週：考える時間を取って対局し、コーチの指摘を1つ選んで直す',
      '第4週：実力テストと棋譜・牌譜の振り返りで上達を確かめる'
    ];
    const ol = el('ol', 'training__weeks');
    for (const s of stages) { const li = el('li'); li.textContent = s; ol.appendChild(li); }
    more.appendChild(ol);
    const lead = el('p', 'training__resourcesTitle'); lead.textContent = '外部の公開教材（必要なときだけ）';
    more.appendChild(lead);
    const links = el('ul', 'training__links');
    for (const [name, href] of sources[g.id]) {
      const li = el('li'), a = el('a'); a.href = href; a.textContent = name;
      a.target = '_blank'; a.rel = 'noopener noreferrer'; li.appendChild(a); links.appendChild(li);
    }
    more.appendChild(links);
    const note = el('p', 'training__caveat');
    note.textContent = 'コーチの助言は学習用の局面評価・過去の記録に基づきます。プロの指導や公式の段級位認定とは異なります。';
    more.appendChild(note);
    section.append(title, duration, hint, grid, question, more);
    return section;
  }

  let lessonFilter = 'all';
  function viewGame(gameId) {
    const g = GAMES[gameId];
    const root = el('div', 'shell');
    root.style.setProperty('--tone', `var(--${g.id})`);
    root.appendChild(el('div', 'crumb', `<a href="#/">もどる</a>`));
    root.appendChild(el('div', 'hero', `<h1>${g.name}</h1><p>${g.blurb}</p>`));

    const lessons = flat(g);
    const nextId = lessons.find((l) => !store.isDone(l.id))?.id;
    let n = 0;

    // つぎのレッスンを、いちばん上に大きく出す（初めての人が、下まで探さなくても始められるように）
    const nextLesson = lessons.find((l) => l.id === nextId);
    if (nextLesson) {
      const no = lessons.indexOf(nextLesson) + 1;
      const go = el('button', 'btn btn--tone nextbtn',
        `<span class="nextbtn__k">${no === 1 ? 'はじめる' : 'つづける'}</span><span>${no}. ${nextLesson.title}</span>`);
      go.addEventListener('click', () => (location.hash = `#/${g.id}/${nextLesson.id}`));
      root.appendChild(go);
    }
    root.appendChild(trainingPanel(g));
    // 始めたばかりの人（修了したレッスンが3つ未満）には、練習メニューより先にレッスンの一覧を見せる
    const beginner = lessons.filter((l) => store.isDone(l.id)).length < 3;
    const practice = document.createDocumentFragment();

    // 今日の1問・実力テスト・苦手
    {
      const daily = store.state.lessons[`${g.id}._daily`];
      const doneToday = daily && daily.day === todayKey();
      const list = el('div', 'llist');
      const row = (no, t, d, s, href) => {
        const b = el('button', 'lrow');
        b.innerHTML = `<span class="lrow__no">${no}</span>
          <span><span class="lrow__t">${t}</span><br><span class="lrow__d">${d}</span></span>
          <span class="lrow__s">${s}</span>`;
        b.addEventListener('click', () => (location.hash = href));
        list.appendChild(b);
      };
      row('☀', '今日の1問', '毎日1問。全レッスンの中から出ます', doneToday ? '済' : '', `#/${g.id}/_daily`);
      row('✎', '実力テスト', '全範囲からランダムに10問。型の名前は出ません', '', `#/${g.id}/_test`);
      row('★', '強くなるコースの復習テスト', '強くなるコース・道場の問題から、毎回ちがう10問', '', `#/${g.id}/_review`);
      if (g.id === 'mahjong') {
        row('譜', '牌譜を振り返る', '天鳳の牌譜（mjlog）や tenhou.net/6 形式の JSON を貼り付けると、あなたの打牌・鳴き・アガリの見逃しをコーチが講評します', '', `#/${g.id}/_import`);
      } else {
        row('譜', '実戦の棋譜を振り返る', `${({ chess: 'PGN', shogi: 'KIF・KI2・CSA', go: 'SGF' })[g.id]} を貼り付けると、あなたの手をコーチが1手ずつ講評します`, '', `#/${g.id}/_import`);
      }
      if (g.id === 'mahjong') row('¥', '点数計算ドリル', '符と翻から点数を出す練習。8問', '', `#/${g.id}/_score`);
      else if (g.id === 'go') row('●', '詰碁ドリル', '生き死にの問題から、毎回ちがう向きで8問', '', `#/${g.id}/_tsumego`);
      else row('♔', '終盤の型ドリル', '裸の玉（キング）を詰ませきる練習。毎回ちがう配置で3問', '', `#/${g.id}/_endgame`);
      // 段階を上がっていく対局（どこまで進んだかは、この端末の設定に残っている）
      if (g.id === 'shogi' && lessons.some((l) => l.id === 'shogi.komaochi')) {
        row('落', '駒落ちチャレンジ', '相手が駒を落として指す対局。勝つたびに相手の駒が増え、平手まで進みます',
          settings.get('shogiChallenge.big') || '六枚落ち', '#/shogi/shogi.komaochi');
      }
      if (g.id === 'go' && lessons.some((l) => l.id === 'go.challenge')) {
        const h = settings.get('goChallenge.nine');
        row('碁', '置き碁チャレンジ', '9路盤で、勝つたびに置き石が1つ減り、互先まで進みます',
          h == null ? '置き石5子' : h ? `置き石${h}子` : '互先', '#/go/go.challenge');
      }
      // 対局でコーチが指摘した局面から作った問題。一発で解けたら卒業、間違えたら翌日にもう一度
      const mine = store.pendingMistakes(g.id);
      if (mine.length) {
        const due = mine.filter((m) => (m.due || 0) <= Date.now()).length;
        row('◎', '自分の悪手から', `対局で指摘された局面を解き直します。一発で解ければ卒業${due ? `（今日の分 ${due}問）` : ''}`, `${mine.length}問`, `#/${g.id}/_mine`);
      }
      const exam = store.state.lessons[`${g.id}._exam`];
      row('段', '級・段テスト', '全レッスンから20問。一発正解の数で、このアプリの中での級・段を出します（実際の段級位とは別の目安です）', exam ? `最高 ${examRank(exam.correct, exam.total)}` : '', `#/${g.id}/_exam`);
      if (g.tacticsBank?.length) {
        row('⚔', 'タクティクス自動ドリル', `自動で作った${g.tacticsBank.length}問から、毎回ランダムに10問`, '', `#/${g.id}/_tactics`);
      }
      // 苦手：一発正解の割合が低い、修了済みのレッスン
      const weak = lessons
        .map((l) => ({ l, r: store.state.lessons[l.id] }))
        .filter((x) => x.r && x.r.total >= 2 && x.r.correct / x.r.total < 0.7)
        .sort((a, b) => a.r.correct / a.r.total - b.r.correct / b.r.total)
        .slice(0, 3);
      for (const { l, r } of weak) {
        row('△', `苦手：${l.title}`, `最高 ${r.total}問中 ${r.correct}問を一発正解`, 'もう一度', `#/${g.id}/${l.id}`);
      }
      practice.append(el('h2', 'chapter', '毎日の練習'), list);

      // 麻雀（4人打ち）の成績：和了率・放銃率・立直率・副露率と、半荘の着順
      if (g.id === 'mahjong' && store.state.mj?.k) practice.append(el('h2', 'chapter', '成績（4人打ち）'), mjStatsPanel(store.state.mj));
      // あなたの傾向：最近の対局でコーチが指摘した種類を数え、いちばん多いものの練習を勧める
      const wk = store.weakness(g.id, 10);
      const rec = store.record(g.id);
      const rt = NS_PLAY.recordText(g.id, rec);
      const played = rec.w + rec.l + rec.d || (rt.detail ? 1 : 0);
      if (wk.games >= 3 || played) {
        const unit = '局';
        const top = Object.entries(wk.total).filter(([k]) => KIND_JA[k]).sort((a, b) => b[1] - a[1]).slice(0, 3);
        const panel = el('div', 'weak');
        if (played || rec.pt) {
          // 持ち点は本番の盤だけで数える。盤ごとの勝敗を添える
          const head = rt.rating ? `${rt.rating}${rt.detail ? `（${rt.detail}）` : ''}`
            : rt.detail ? `${rt.detail}（持ち点は、本番の盤で対局すると付きます）` : '';
          const acc = rec.pt ? `相手の応手の予想 ${Math.round((rec.ph || 0) / rec.pt * 100)}％的中（${rec.ph || 0}/${rec.pt}）` : '';
          panel.appendChild(el('p', 'weak__lead', [head, acc].filter(Boolean).join('／')));
        }
        if (!top.length) {
          panel.insertAdjacentHTML('beforeend', wk.games
            ? `<p>最近${wk.games}${unit}で、コーチが指摘した手はありませんでした。相手を「つよい」にしてみましょう。</p>`
            : '<p>対局するとここに傾向が出ます。</p>');
        } else {
          const max = top[0][1];
          panel.insertAdjacentHTML('beforeend', `<p class="weak__lead">最近${wk.games}${unit}でコーチが指摘した回数です。いちばん多いものから直すのが近道です。</p>`
            + top.map(([k, n]) => `<div class="weak__row"><span class="weak__k">${KIND_JA[k]}</span>`
              + `<span class="weak__bar"><i style="width:${Math.max(8, (n / max) * 100)}%"></i></span><span class="weak__n">${n}回</span></div>`).join(''));
          const link = lessonFor(g.id, top[0][0]);
          const target = link && flat(g).find((l) => l.id === link);
          if (target) {
            const b = el('button', 'btn btn--tone btn--sm', `おすすめの練習：${target.title}`);
            b.addEventListener('click', () => (location.hash = `#/${g.id}/${target.id}`));
            panel.appendChild(b);
          }
        }
        practice.append(el('h2', 'chapter', 'あなたの傾向'), panel);
      }
      // 上達の記録：対局ごとの持ち点と、日ごとの一発正解率
      const tr = store.trend(g.id);
      const days = Object.entries(tr.d).sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-30);
      if (tr.r.length >= 2 || days.length) {
        const box = el('div', 'weak trend');
        if (tr.r.length >= 2) box.appendChild(trendChart('持ち点の推移（対局ごと）', tr.r.map(([, v]) => v), (v) => `${v}`));
        if (days.length) {
          const ago = (k) => Math.round((new Date(new Date().toDateString()) - new Date(`${k}T00:00:00`)) / 86400000);
          const sum = (f) => days.filter(([k]) => f(ago(k))).reduce((a, [, [ok, ng]]) => [a[0] + ok, a[1] + ok + ng], [0, 0]);
          const [o1, t1] = sum((d) => d < 7), [o0, t0] = sum((d) => d >= 7 && d < 14);
          const pct = (o, t) => (t ? `${Math.round((o / t) * 100)}％（${t}問）` : '記録なし');
          box.appendChild(trendChart('一発正解率（日ごと）', days.map(([, [ok, ng]]) => Math.round((ok / Math.max(1, ok + ng)) * 100)),
            (v) => `${v}％`, days.map(([k]) => k.slice(5).replace('-', '/'))));
          box.appendChild(el('p', 'weak__lead', `最近7日：${pct(o1, t1)}　その前の7日：${pct(o0, t0)}`));
        }
        practice.append(el('h2', 'chapter', '上達の記録'), box);
      }
    }
    if (!beginner) root.appendChild(practice);

    // 復習：間違えたままの問題があるレッスン（期限が来た数も出す）
    const pend = store.pendingReviews(`${g.id}.`);
    const dueOf = (id) => pend.filter((r) => r.lessonId === id && (r.due || 0) <= Date.now()).length;
    if (pend.length) {
      const byLesson = new Map();
      for (const r of pend) {
        const l = lessons.find((x) => x.id === r.lessonId);
        if (!l) continue;
        const n = stepIndexOf(l, r.stepKey);
        if (n < 0 || l.steps[n].type === 'teach') continue;
        if (!byLesson.has(l.id)) byLesson.set(l.id, { l, steps: [] });
        const list = byLesson.get(l.id).steps;
        if (!list.includes(n)) list.push(n);   // 新旧どちらの形式でも、同じ問題は1つに数える
      }
      if (byLesson.size) {
        root.appendChild(el('h2', 'chapter', '復習'));
        const list = el('div', 'llist');
        for (const { l, steps } of byLesson.values()) {
          const row = el('button', 'lrow');
          row.innerHTML = `
            <span class="lrow__no">↺</span>
            <span><span class="lrow__t">${l.title}</span><br><span class="lrow__d">${dueOf(l.id)
              ? `今日の分 ${dueOf(l.id)}問`
              : '期限まで待ってもよい問題です'}</span></span>
            <span class="lrow__s">${steps.length}問</span>`;
          row.addEventListener('click', () => (location.hash = `#/${g.id}/${l.id}/review`));
          list.appendChild(row);
        }
        root.appendChild(list);
      }
    }

    const tagsOf = (ch, l) => ({
      todo: !store.isDone(l.id),
      dojo: /道場|強くなる/.test(ch.title) || /道場/.test(l.title),
      play: l.steps.some((s) => s.type === 'play' || s.type === 'play4' || s.type === 'kpkplay'),
    });
    const FILTERS = [['all', 'すべて'], ['todo', 'まだのレッスン'], ['dojo', '道場・強くなるコース'], ['play', '対局']];
    const counts = { all: 0, todo: 0, dojo: 0, play: 0 };
    for (const ch of g.chapters) for (const l of ch.lessons) { counts.all++; const t = tagsOf(ch, l); for (const k of ['todo', 'dojo', 'play']) if (t[k]) counts[k]++; }
    const fbar = el('div', 'lfilter', FILTERS.map(([k, v]) => `<button type="button" class="lfilter__b" data-f="${k}" aria-pressed="${k === lessonFilter}">${v}（${counts[k]}）</button>`).join(''));
    fbar.setAttribute('role', 'group');
    fbar.setAttribute('aria-label', 'レッスンの絞り込み');
    root.appendChild(fbar);
    const sections = [];
    for (const ch of g.chapters) {
      const head = el('h2', 'chapter', ch.title);
      root.appendChild(head);
      const list = el('div', 'llist');
      const rows = [];
      sections.push({ head, list, rows });
      for (const l of ch.lessons) {
        n++;
        const done = store.isDone(l.id);
        const rec = store.state.lessons[l.id];
        const row = el('button', 'lrow');
        const tg = tagsOf(ch, l);
        row.dataset.todo = tg.todo ? '1' : '';
        row.dataset.dojo = tg.dojo ? '1' : '';
        row.dataset.play = tg.play ? '1' : '';
        rows.push(row);
        row.dataset.s = done ? 'done' : l.id === nextId ? 'now' : '';
        row.innerHTML = `
          <span class="lrow__no">${n}</span>
          <span><span class="lrow__t">${l.title}</span><br><span class="lrow__d">${l.desc}</span></span>
          <span class="lrow__s">${done ? `${rec.correct}/${rec.total} 正解` : l.id === nextId ? 'つぎ' : ''}</span>`;
        row.addEventListener('click', () => (location.hash = `#/${g.id}/${l.id}`));
        list.appendChild(row);
      }
      root.appendChild(list);
    }
    const applyFilter = (f) => {
      lessonFilter = f;
      for (const b of fbar.querySelectorAll('[data-f]')) b.setAttribute('aria-pressed', String(b.dataset.f === f));
      for (const sec of sections) {
        let any = false;
        for (const r of sec.rows) { const show = f === 'all' || r.dataset[f] === '1'; r.hidden = !show; any = any || show; }
        sec.head.hidden = !any; sec.list.hidden = !any;
      }
    };
    fbar.addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (b) applyFilter(b.dataset.f); });
    applyFilter(lessonFilter);
    if (beginner) root.appendChild(practice);
    return root;
  }

  /** 実戦の棋譜を振り返る（チェス・将棋・囲碁）／牌譜を振り返る（麻雀） */
  function viewImport(gameId) {
    const g = GAMES[gameId];
    const root = el('div', 'shell');
    root.style.setProperty('--tone', `var(--${g.id})`);
    root.appendChild(el('div', 'crumb', `<a href="#/${g.id}">${g.name}</a> ／ ${g.id === 'mahjong' ? '牌譜を振り返る' : '実戦の棋譜を振り返る'}`));
    const host = el('div');
    root.appendChild(host);
    if (g.id === 'mahjong') NS_PLAY.reviewImportMahjong(host);
    else NS_PLAY.reviewImport(host, g.id);
    return root;
  }

  function viewLesson(gameId, lessonId, mode = '') {
    if (lessonId === '_import' && GAMES[gameId]) return viewImport(gameId);
    const g = GAMES[gameId];
    const lessons = flat(g);
    const synthetic = ['_daily', '_test', '_tactics', '_exam', '_mine', '_endgame', '_score', '_tsumego', '_review'].includes(lessonId);
    const idx = synthetic ? -1 : lessons.findIndex((l) => l.id === lessonId);
    // その遊びにない練習（将棋・麻雀のタクティクス、麻雀の終盤ドリル、チェス・将棋の点数計算）は URL で開いても一覧へ戻す
    const offered = !synthetic || !((lessonId === '_tactics' && !g.tacticsBank?.length)
      || (lessonId === '_endgame' && (g.id === 'mahjong' || g.id === 'go')) || (lessonId === '_score' && g.id !== 'mahjong')
      || (lessonId === '_tsumego' && g.id !== 'go'));
    const lesson = !offered ? null : synthetic ? syntheticLesson(g, lessonId) : lessons[idx];
    if (!lesson || !lesson.steps?.length) { location.hash = `#/${gameId}`; return el('div'); }

    const root = el('div', 'shell');
    root.style.setProperty('--tone', `var(--${g.id})`);
    root.appendChild(el('div', 'crumb',
      `<a href="#/${g.id}">${g.name}</a> ／ ${lesson.title}`));
    const host = el('div');
    root.appendChild(host);

    const only = mode === 'review'
      ? [...new Set(store.pendingReviews(`${lesson.id}#`).map((r) => stepIndexOf(lesson, r.stepKey)))]
        .filter((n) => n >= 0 && lesson.steps[n].type !== 'teach').sort((a, b) => a - b)
      : null;
    new LessonRunner(lesson, host, {
      only,
      // 実力テストは記録しない（毎回ちがう問題なので）。今日の1問は連続日数に数える
      transient: ['_test', '_tactics', '_exam', '_mine', '_endgame', '_score', '_tsumego', '_review'].includes(lessonId),
      onFinish: ({ correct, total, review }) => {
        askPersist();   // 1つ終えたところで、進捗を消されにくくするようブラウザに頼む
        if (lessonId === '_exam') {
          store.recordLesson(`${g.id}._exam`, { correct, total });
          const stage = el('div', 'stage');
          stage.style.setProperty('--tone', `var(--${g.id})`);
          const best = store.state.lessons[`${g.id}._exam`];
          stage.innerHTML = `<h2>級・段テスト 結果</h2>
            <p>${total}問中 ${correct}問を一発で正解。このアプリでの目安は <strong>${examRank(correct, total)}</strong> です。</p>
            <p class="note">これまでの最高：${examRank(best.correct, best.total)}。${examAdvice(correct, total)}</p>
            <p class="note">※アプリの問題の正答率から出した目安です。連盟・棋院などの段級位や、対局サイトの級・レーティングとは別のものです。</p>`;
          const a = el('div', 'actions');
          const again = el('button', 'btn btn--tone', 'もう一度受ける');
          again.addEventListener('click', () => { location.hash = `#/${g.id}`; setTimeout(() => (location.hash = `#/${g.id}/_exam`), 0); });
          const back = el('button', 'btn btn--ghost', '一覧にもどる');
          back.addEventListener('click', () => (location.hash = `#/${g.id}`));
          a.append(again, back); stage.appendChild(a);
          host.innerHTML = ''; host.appendChild(stage);
          return;
        }
        const next = review || synthetic ? null : lessons[idx + 1];
        const stage = el('div', 'stage');
        stage.style.setProperty('--tone', `var(--${g.id})`);
        stage.innerHTML = `
          <h2>${lesson.title} ${review ? '復習おわり' : '修了'}</h2>
          <p>${total ? `${total}問中 ${correct}問を一発で正解しました。` : 'お疲れさまでした。'}
          ${correct < total ? `間違えた問題は、${g.name}の一覧の「復習」から解き直せます。` : ''}</p>`;
        const acts = el('div', 'actions');
        if (next) {
          const b = el('button', 'btn btn--tone', `つぎへ：${next.title}`);
          b.addEventListener('click', () => (location.hash = `#/${g.id}/${next.id}`));
          acts.appendChild(b);
        }
        const b2 = el('button', 'btn btn--ghost', '一覧にもどる');
        b2.addEventListener('click', () => (location.hash = `#/${g.id}`));
        acts.appendChild(b2);
        stage.appendChild(acts);
        host.innerHTML = '';
        host.appendChild(stage);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
    });
    return root;
  }

  // ── 同期パネル ─────────────────────────────────────────
  function openSync() {
    const status = store.syncStatus();
    const sheet = el('div', 'sheet');
    const card = el('div', 'sheet__card');
    sheet.appendChild(card);

    const label = {
      off: 'この端末に保存しています（自動同期は使っていません）',
      loading: '読み込み中…',
      ready: 'ログインすれば同期できます',
      on: '同期しています',
      error: '同期に接続できませんでした',
    }[status] || status;

    card.innerHTML = `
      <h2>進捗の保存</h2>
      <p>この端末には自動で保存されています。${status === 'on'
        ? '<br>いまはログイン中なので、PCとスマホの進捗が自動でそろいます。'
        : ''}</p>
      <p><strong>状態：</strong>${label}</p>`;

    const row = el('div', 'sheet__row');
    if (status === 'ready') {
      const b = el('button', 'btn', 'Googleでログインして同期する');
      b.addEventListener('click', async () => {
        try { await store.sync.signIn(); } catch (e) { toast('ログインできませんでした'); }
      });
      row.appendChild(b);
    }
    if (status === 'on') {
      const b = el('button', 'btn btn--ghost', 'ログアウト');
      b.addEventListener('click', async () => { await store.sync.signOut(); sheet.remove(); openSync(); });
      row.appendChild(b);
    }
    if (status === 'off') {
      // 使う人向けの説明にする（自動同期の設定方法は開発者向けなので、ここには出さない。
      // 設定するときは、このファイルの firebaseConfig（「firebase-config.js」の区切りの下）に書き込む）
      const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
      card.appendChild(el('p', null,
        '進捗はこのブラウザの中にだけ保存されています。ブラウザのデータを消したり、別の端末で開いたりすると引き継がれません。'
        + 'ときどき下の「引き継ぎコードをコピー」で控えを取っておくと安心です。'
        + (ios && !standalone
          ? '<br>iPhone・iPadのSafariでは、しばらく開かないサイトのデータが消えることがあります。共有ボタンから「ホーム画面に追加」して使うと消えにくくなります。'
          : '')));
    }

    const copy = el('button', 'btn btn--ghost', '引き継ぎコードをコピー');
    const paste = el('button', 'btn btn--ghost', 'コードを読み込む');
    // コードを見せる・貼り付ける欄（prompt より長いコードを扱いやすい）
    const box = el('div', 'syncbox');
    box.hidden = true;
    const boxNote = el('p', 'syncbox__note');
    const ta = document.createElement('textarea');
    ta.className = 'syncbox__ta';
    ta.rows = 4;
    ta.spellcheck = false;
    ta.setAttribute('aria-label', '引き継ぎコード');
    const boxRow = el('div', 'sheet__row');
    const load = el('button', 'btn', '読み込む');
    boxRow.appendChild(load);
    box.append(boxNote, ta, boxRow);
    copy.addEventListener('click', async () => {
      const code = store.exportCode();
      try { await navigator.clipboard.writeText(code); toast('コピーしました'); box.hidden = true; }
      catch {
        // コピーできない画面では、欄に出して選んでおく
        box.hidden = false; load.hidden = true;
        boxNote.textContent = 'このコードを選んでコピーし、控えておいてください。';
        ta.readOnly = true; ta.value = code; ta.focus(); ta.select();
      }
    });
    paste.addEventListener('click', () => {
      box.hidden = false; load.hidden = false;
      boxNote.textContent = '別の端末でコピーした引き継ぎコードを貼り付けて、「読み込む」を押してください。';
      ta.readOnly = false; ta.value = ''; ta.focus();
    });
    load.addEventListener('click', () => {
      const code = ta.value.trim();
      if (!code) { ta.focus(); return; }
      try { store.importCode(code); toast('読み込みました'); sheet.remove(); render(); }
      catch { toast('コードを読み取れませんでした'); }
    });
    row.append(copy, paste);
    card.append(row, box);

    const row2 = el('div', 'sheet__row');
    const reset = el('button', 'btn btn--ghost', '進捗をすべて消す');
    reset.addEventListener('click', () => {
      const msg = store.syncStatus() === 'on'
        ? '進捗をすべて消します。同期しているほかの端末からも消えます。よろしいですか。'
        : 'この端末の進捗をすべて消します。よろしいですか。';
      if (confirm(msg)) {
        store.reset(); sheet.remove(); render(); toast('消しました');
      }
    });
    const close = el('button', 'btn btn--ghost', '閉じる');
    close.addEventListener('click', () => sheet.remove());
    row2.append(reset, close);
    card.appendChild(row2);

    sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.remove(); });
    document.body.appendChild(sheet);
    wireSheet(sheet, card);
  }

  function openSettings() {
    const sheet = el('div', 'sheet');
    const card = el('div', 'sheet__card');
    sheet.appendChild(card);
    card.innerHTML = `<h2>設定</h2><p>この端末だけの設定です。進捗とは別に保存されます。</p>`;

    const group = (title) => { card.appendChild(el('h3', 'sheet__h', title)); };
    const row = (label, note, checked, onChange) => {
      const l = el('label', 'toggle toggle--row');
      l.innerHTML = `<input type="checkbox" ${checked ? 'checked' : ''}>
        <span><b>${label}</b>${note ? `<small>${note}</small>` : ''}</span>`;
      l.querySelector('input').addEventListener('change', (e) => onChange(e.target.checked));
      card.appendChild(l);
      return l;
    };

    group('音');
    row('効果音を鳴らす', '駒や牌の音、正誤の合図', sfx.on, () => { sfx.toggle(); });

    group('盤の補助');
    row('動かせる場所を表示する', '駒をタップしたとき、行けるマスに印を出します',
      settings.get('showMoves'), (v) => settings.set('showMoves', v));
    row('危ない行き先を警告する', 'そこへ動かすと取られてしまうマスに赤い×を出します',
      settings.get('warnUnsafe'), (v) => settings.set('warnUnsafe', v));
    row('相手の利きを表示する', '相手の駒が届いているマスを薄く塗ります（情報量が多くなります）',
      settings.get('showThreat'), (v) => settings.set('showThreat', v));
    row('相手の狙いを先に質問する', '対局中に相手の狙いがあるとき、答えを言う前に「どこが危ない？」と聞きます。オフにすると、すぐに答えを表示します',
      settings.get('askThreat') !== false, (v) => settings.set('askThreat', v));
    row('相手の応手を予想する', '自分が指したあと、相手がどう応じるかを1手だけ予想します。読む力がいちばん伸びる練習です',
      settings.get('predict') !== false, (v) => settings.set('predict', v));

    group('見やすさ');
    row('印に形もつける', '良いマスに〇、危ないマスに×を重ねます。色だけに頼らない表示です',
      settings.get('shapes') !== false, (v) => settings.set('shapes', v));
    const ts = el('label', 'toggle toggle--row');
    ts.innerHTML = `<span><b>文字の大きさ</b><small>画面全体の大きさが変わります</small></span>`;
    const tsel = el('select', 'detail');
    tsel.innerHTML = TEXT_SIZES.map((t) => `<option value="${t.id}" ${t.id === (settings.get('textSize') || 'normal') ? 'selected' : ''}>${t.label}</option>`).join('');
    tsel.addEventListener('change', (e) => settings.set('textSize', e.target.value));
    ts.appendChild(tsel);
    card.appendChild(ts);

    group('麻雀');
    row('4人打ちで赤ドラを使う', '萬子・筒子・索子の5を1枚ずつ赤にします。持っているだけで1翻（役がある手のみ）。いまの麻雀はほとんどこのルールです',
      settings.get('aka'), (v) => settings.set('aka', v));

    group('コーチ');
    const dl = el('label', 'toggle toggle--row');
    dl.innerHTML = `<span><b>講評の詳しさ</b><small>対局中に出る説明の量</small></span>`;
    const sel = el('select', 'detail');
    sel.innerHTML = DETAILS.map((d) =>
      `<option value="${d.id}" ${d.id === settings.get('coachDetail') ? 'selected' : ''}>${d.label}</option>`).join('');
    sel.addEventListener('change', () => settings.set('coachDetail', sel.value));
    dl.appendChild(sel);
    card.appendChild(dl);

    group('その他');
    const stb = el('button', 'btn btn--ghost btn--sm', '自己診断を実行する');
    stb.addEventListener('click', () => { location.href = `${location.pathname}?selftest`; });
    const stn = el('p', 'note', 'すべての問題の表示・詰みの検算・麻雀の計算・保存まわりを、このアプリ自身で確かめます（1分ほど）。進捗は変わりません');
    card.append(stb, stn);

    const row2 = el('div', 'sheet__row');
    const close = el('button', 'btn', '閉じる');
    close.addEventListener('click', () => sheet.remove());
    row2.appendChild(close);
    card.appendChild(row2);

    sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.remove(); });
    document.body.appendChild(sheet);
    wireSheet(sheet, card);
  }

  // ── ルーティング ───────────────────────────────────────
  /**
   * 自己診断（?selftest で開く）。
   * 全問の表示・詰みの検算・麻雀の受け入れと点数計算・保存まわりを、このファイル自身で確かめる。
   * 手を入れたあと、壊れていないかを自分で確認できるようにしておく。
   */
  async function runSelfTest(root) {
    // 診断のあいだは保存も同期もしない。終わったら診断前の状態に戻す
    const savedState = store.state;
    const savedWrite = store._writeLocal, savedPush = store.sync.push;
    store._writeLocal = () => {};
    store.sync.push = () => {};
    try { await runSelfTestBody(root); } finally {
      store.state = savedState;
      store._writeLocal = savedWrite;
      store.sync.push = savedPush;
    }
  }
  async function runSelfTestBody(root) {
    const C = NS_CHESS, S = NS_SHOGI, M = NS_MAHJONG;
    const head = el('h1', 'hero__t', '自己診断');
    const prog = el('p', 'note', '準備中…');
    const list = el('div', 'llist');
    root.append(head, prog, list);
    const fails = [];
    let done = 0, total = 0;
    const breathe = () => new Promise((r) => setTimeout(r, 0));
    const section = (title, ok, n, notes = []) => {
      const row = el('div', 'selft');
      row.innerHTML = `<span class="selft__b" data-ok="${ok}">${ok ? '合格' : '要確認'}</span>`
        + `<span><span class="lrow__t">${title}</span><br><span class="lrow__d">${n}件を確認${notes.length ? `／${notes.length}件が要確認` : ''}</span></span>`;
      if (notes.length) {
        const ul = el('ul', 'selft__list');
        ul.innerHTML = notes.slice(0, 12).map((x) => `<li>${x}</li>`).join('');
        row.appendChild(ul);
      }
      list.appendChild(row);
    };

    // 1. 全レッスンの全ステップが、エラーなく表示できるか
    const host = el('div');
    host.style.cssText = 'position:absolute;left:-9999px;top:0;width:360px';
    document.body.appendChild(host);
    let steps = 0;
    const stepFails = [];
    for (const g of Object.values(GAMES)) {
      for (const l of flat(g)) {
        for (let i = 0; i < l.steps.length; i++) {
          const t = l.steps[i].type;
          if (t === 'play' || t === 'play4') continue;
          steps++;
          const box = el('div');
          host.appendChild(box);
          try {
            new LessonRunner(l, box, { only: [i], transient: true });
            if (!box.querySelector('.stage')) stepFails.push(`${l.id} #${i}（${t}）が表示されない`);
            else if (/undefined|NaN|\[object/.test(box.textContent)) stepFails.push(`${l.id} #${i}（${t}）の文章に undefined/NaN`);
          } catch (e) { stepFails.push(`${l.id} #${i}（${t}）で例外：${e}`); }
          box.remove();
          if (steps % 40 === 0) { prog.textContent = `問題の表示を確認中… ${steps}問`; await breathe(); }
        }
      }
    }
    host.remove();
    section('すべての問題が表示できる', !stepFails.length, steps, stepFails);

    // 1-2. レッスンのIDが重なっていないか（重なると、一覧で押したのと別のレッスンが開く）
    const idFails = [];
    let ids = 0;
    for (const g of Object.values(GAMES)) {
      const ls = flat(g);
      ls.forEach((l, k) => {
        ids++;
        if (!l.id.startsWith(`${g.id}.`)) idFails.push(`${l.id}：ゲーム名で始まっていない`);
        const at = ls.findIndex((x) => x.id === l.id);
        if (at !== k) idFails.push(`${l.id}（${l.title}）：同じIDの「${ls[at].title}」があり、一覧から開けない`);
      });
    }
    section('すべてのレッスンが一覧から開ける（IDが重ならない）', !idFails.length, ids, idFails);

    // 2. 詰みの検算（チェス・将棋）
    prog.textContent = '詰みの検算中…';
    await breathe();
    const mateFails = [];
    let mates = 0;
    for (const l of flat(GAMES.chess)) {
      for (const [i, st] of l.steps.entries()) {
        if (st.type === 'mateIn' && (st.moves || 3) <= 3) {
          mates++;
          const k = ((st.moves || 3) + 1) / 2;
          const opts = { w: st.w || 8, h: st.h || 8 };
          if (!C.findForcedMate(st.board, st.side || 'w', opts, k, 4000)) mateFails.push(`${l.id} #${i}：${st.moves || 3}手で詰まない`);
          else if (k > 1 && C.findForcedMate(st.board, st.side || 'w', opts, k - 1, 2000)) mateFails.push(`${l.id} #${i}：もっと短い詰みがある`);
          await breathe();
        }
        if (st.type === 'move' && st.goal === 'mate') {
          mates++;
          if (!C.findMateIn1(st.board, st.side || 'w', { w: st.w || 8, h: st.h || 8 }).length) mateFails.push(`${l.id} #${i}：1手詰めがない`);
        }
      }
    }
    for (const l of flat(GAMES.shogi)) {
      for (const [i, st] of l.steps.entries()) {
        if (st.type === 'mateIn' && st.mustCheck !== false && (st.moves || 3) <= 3) {
          mates++;
          if (!S.findMateIn(st.state, st.moves || 3, st.shape, 4000)) mateFails.push(`${l.id} #${i}：${st.moves || 3}手詰めがない`);
          await breathe();
        }
        if (st.type === 'move' && st.goal === 'mate') {
          mates++;
          if (!S.findMateIn1(st.state, st.shape).length) mateFails.push(`${l.id} #${i}：1手詰めがない`);
        }
      }
    }
    section('詰みの問題が、書かれた手数で詰む', !mateFails.length, mates, mateFails);

    // 3. 麻雀：待ち・受け入れ・牌の枚数
    prog.textContent = '麻雀の問題を検算中…';
    await breathe();
    const mjFails = [];
    let mj = 0;
    for (const l of flat(GAMES.mahjong)) {
      for (const [i, st] of l.steps.entries()) {
        if (st.tiles && M.toCounts(st.tiles).some((c) => c > 4)) mjFails.push(`${l.id} #${i}：同じ牌が5枚以上`);
        if (st.type === 'waits' && st.tiles) {
          mj++;
          const w = M.waits(st.tiles, st.sets || 4);
          if (!w.length) mjFails.push(`${l.id} #${i}：テンパイではない`);
        }
        if (st.type === 'discard' && st.tiles) {
          mj++;
          if (st.tiles.length !== (st.sets || 4) * 3 + 2) mjFails.push(`${l.id} #${i}：牌の枚数が合わない`);
          const t = NS_COACH.ukeire(M.sortTiles(st.tiles), st.sets || 4);
          const m = st.why && st.why.match(/最善は(.+?)切り/);
          if (m) {
            const ties = t.filter((r) => r.shanten === t[0].shanten && r.tiles === t[0].tiles).map((r) => M.tileName(r.tile));
            if (!ties.includes(m[1])) mjFails.push(`${l.id} #${i}：解説は${m[1]}切りだが、計算上は${ties.join('・')}`);
          }
        }
      }
      await breathe();
    }
    section('麻雀の問題と解説が、計算と合っている', !mjFails.length, mj, mjFails);

    // 3-2. 囲碁：問題がエンジンの判定で解けるか（「1つだけ」の問題はほかの手で解けないか）と、ルールの基本
    prog.textContent = '囲碁の問題を検算中…';
    await breathe();
    const goFails = [];
    let gos = 0;
    for (const l of flat(GAMES.go)) {
      for (const [i, st] of l.steps.entries()) {
        if (st.type === 'quiz' && st.goCheck) {
          // 「このシチョウは成功する？」の答えが、エンジンの読みと合っているか
          gos++;
          const G = NS_GO, p = G.parse(st.go.board), n = p.n, c = st.goCheck;
          const t = (c.target[1] - 1) * n + c.target[0] - 1, f = (c.first[1] - 1) * n + c.first[0] - 1;
          const r = G.play(p.s, n, f, 'X');
          const cap = !r.illegal && (r.s[t] !== 'O' || !G.canSave(r.s, n, t, r.ko));
          if (cap !== c.expect || st.answer !== (c.expect ? 0 : 1)) goFails.push(`${l.id} #${i}：答えがエンジンの読みと違う`);
          continue;
        }
        if (st.type !== 'gmove' && st.type !== 'gseq') continue;
        gos++;
        try {
          const sols = goSolutions(st);
          if (!sols.length) goFails.push(`${l.id} #${i}：正解の手が見つからない`);
          else if (st.unique && sols.length > 1) goFails.push(`${l.id} #${i}：正解が${sols.length}つある`);
        } catch (e) { goFails.push(`${l.id} #${i}：例外 ${e}`); }
        if (gos % 4 === 0) await breathe();
      }
    }
    {
      const G = NS_GO;
      const t1 = G.parse(['.X...', 'XOa..', '.X...', '.....', '.....']);
      gos++; if (G.play(t1.s, 5, t1.labels.a, 'X').captured?.length !== 1) goFails.push('石を取る判定がおかしい');
      const t2 = G.parse(['.X...', 'XaX..', '.X...', '.....', '.....']);
      gos++; if (G.play(t2.s, 5, t2.labels.a, 'O').illegal !== 'suicide') goFails.push('着手禁止点に打ててしまう');
      const t3 = G.parse(['.XO..', 'XOaO.', '.XO..', '.....', '.....']);
      const k3 = G.play(t3.s, 5, t3.labels.a, 'X');
      gos++; if (G.play(k3.s, 5, 6, 'O', k3.ko).illegal !== 'ko') goFails.push('コウをすぐに取り返せてしまう');
      const t4 = G.score({ n: 5, s: G.parse(['.X.O.', 'XX.OO', '..XO.', 'XXXO.', '..XO.']).s, caps: { X: 1, O: 0 } }, [], 0.5);
      gos++; if (t4.terr.X !== 5 || t4.terr.O !== 4 || t4.black !== 6 || t4.white !== 4.5) goFails.push(`地の計算がおかしい（黒${t4.terr.X}・白${t4.terr.O}）`);
    }
    section('囲碁のルールと問題が、エンジンの判定と合っている', !goFails.length, gos, goFails);

    // 4. 点数計算
    const scoreCases = [
      ['子 3翻30符 ロン', M.ronPoints(3, 30, false), 3900],
      ['親 3翻30符 ロン', M.ronPoints(3, 30, true), 5800],
      ['子 4翻30符 ロン', M.ronPoints(4, 30, false), 7700],
      ['子 満貫 ロン', M.ronPoints(5, 30, false), 8000],
      ['親 満貫 ロン', M.ronPoints(5, 30, true), 12000],
      ['子 跳満 ロン', M.ronPoints(6, 30, false), 12000],
      ['子 2翻30符 ツモ（子の支払い）', M.tsumoPoints(2, 30, false).fromKo, 500],
      ['子 2翻30符 ツモ（親の支払い）', M.tsumoPoints(2, 30, false).fromOya, 1000],
      ['親 2翻30符 ツモ（各家）', M.tsumoPoints(2, 30, true).fromKo, 1000],
      ['子 七対子25符2翻 ロン', M.ronPoints(2, 25, false), 1600],
    ];
    const scoreFails = scoreCases.filter(([, got, want]) => got !== want).map(([n, got, want]) => `${n}：${got}点（正しくは${want}点）`);
    section('点数計算が正しい', !scoreFails.length, scoreCases.length, scoreFails);

    // 5. 終盤ドリルの配置・棋譜の書き出し・復習の間隔
    prog.textContent = 'ドリルと棋譜の書き出しを確認中…';
    await breathe();
    const drillFails = [];
    let drills = 0;
    for (const [v, cfg] of Object.entries(NS_PLAY.CHESS_SETUPS)) {
      if (!cfg.make) continue;
      for (let i = 0; i < 30; i++) {
        drills++;
        const b = cfg.make();
        const vals = Object.values(b);
        if (!vals.includes('K') || !vals.includes('k')) { drillFails.push(`${v}：キングのない配置ができた`); break; }
        if (C.inCheck(b, 'b', { w: 8, h: 8 })) { drillFails.push(`${v}：最初から相手が王手されている`); break; }
      }
      await breathe();
    }
    // 棋譜：数手の対局を作って、書き出しが通るか
    try {
      let pos = { ...C.START_POSITION };
      const frames = [{ pos: { ...pos }, turn: 'w' }];
      for (const [a, b2] of [['e2', 'e4'], ['e7', 'e5'], ['g1', 'f3'], ['b8', 'c6']]) {
        const piece = pos[a], took = !!pos[b2];
        pos = C.applyMove(pos, a, b2, { w: 8, h: 8 });
        frames.push({ pos: { ...pos }, turn: frames.length % 2 ? 'b' : 'w', mv: { from: a, to: b2, piece, took, promo: null } });
      }
      const pgn = NS_PLAY.toPGN ? NS_PLAY.toPGN(frames, { w: 8, h: 8 }, 'win') : null;
      if (pgn && !/1\. e4 e5 2\. Nf3 Nc6/.test(pgn)) drillFails.push(`PGNの書き出しがおかしい：${pgn.split('\n').pop()}`);
      if (pgn && /\[FEN /.test(pgn)) drillFails.push('初期配置からの対局に FEN が付いている');
      drills++;
      // アンパッサンと昇格の表記
      const ep0 = { e1: 'K', e8: 'k', e5: 'P', d7: 'p', a7: 'P' };
      const f2 = [{ pos: ep0, turn: 'b' }];
      let q = C.applyMove(ep0, 'd7', 'd5', { w: 8, h: 8 });
      f2.push({ pos: q, turn: 'w', mv: { from: 'd7', to: 'd5', piece: 'p', took: false, promo: null } });
      const q2 = C.applyMove(q, 'e5', 'd6', { w: 8, h: 8 });
      f2.push({ pos: q2, turn: 'b', mv: { from: 'e5', to: 'd6', piece: 'P', took: true, promo: null } });
      const pg2 = NS_PLAY.toPGN(f2, { w: 8, h: 8 }, 'draw:material');
      if (!/1\.\.\. d5 2\. exd6/.test(pg2) || !/\[FEN "/.test(pg2) || !/1\/2-1\/2/.test(pg2)) drillFails.push(`途中局面のPGNがおかしい：${pg2.split('\n').pop()}`);
      drills++;
    } catch (e) { drillFails.push(`棋譜の書き出しで例外：${e}`); }
    // 駒落ちチャレンジ：段階ごとの駒の数と先に指す側、勝ち負けでの進み方、手合割つきの棋譜
    try {
      const SG = NS_SHOGI, KO = NS_PLAY.KOMAOCHI;
      const left = { 十枚落ち: 10, 八枚落ち: 12, 六枚落ち: 14, 四枚落ち: 16, 二枚落ち: 18, 飛香落ち: 18, 飛車落ち: 19, 角落ち: 19, 香落ち: 19, 平手: 20 };
      for (const k of KO) {
        drills++;
        const st = NS_PLAY.komaochiStart(k.name);
        const cnt = (c) => Object.values(st.board).filter((p) => SG.colorOf(p) === c).length;
        if (cnt('w') !== left[k.name] || cnt('b') !== 20) drillFails.push(`駒落ち（${k.name}）の駒の数がおかしい：上手${cnt('w')}枚・下手${cnt('b')}枚`);
        if (st.turn !== (k.name === '平手' ? 'b' : 'w')) drillFails.push(`駒落ち（${k.name}）で先に指す側がおかしい`);
        if (!SG.allLegalMoves(st, SG.BIG).length) drillFails.push(`駒落ち（${k.name}）の最初の局面で指せる手がない`);
      }
      drills++;
      const i6 = KO.findIndex((x) => x.name === '六枚落ち'), last = KO.length - 1;
      const won = NS_PLAY.komaochiNext(i6, true, 1), lost1 = NS_PLAY.komaochiNext(i6, false, 0), lost2 = NS_PLAY.komaochiNext(i6, false, 1);
      const done = NS_PLAY.komaochiNext(last, true, 0), floor = NS_PLAY.komaochiNext(0, false, 1);
      if (won.i !== i6 + 1 || won.loss || lost1.i !== i6 || lost1.loss !== 1 || lost2.i !== i6 - 1 || lost2.loss || done.i !== last || floor.i !== 0) {
        drillFails.push('駒落ちチャレンジの段階の進み方がおかしい');
      }
      drills++;
      let st = NS_PLAY.komaochiStart('二枚落ち');
      const kf = [{ board: { ...st.board }, hands: SG.cloneHands(st.hands), turn: st.turn }];
      for (const mv of [{ from: '33', to: '34' }, { from: '77', to: '76' }]) {
        const piece = st.board[mv.from];
        st = SG.applyMove(st, mv, SG.BIG);
        kf.push({ board: { ...st.board }, hands: SG.cloneHands(st.hands), turn: st.turn, mv: { ...mv, piece } });
      }
      const kif = NS_PLAY.toKIF(kf, null, SG.BIG, { handicap: '二枚落ち' });
      if (!/手合割：二枚落ち/.test(kif) || !/上手：/.test(kif) || !/1 ３四歩\(33\)/.test(kif) || !/2 ７六歩\(77\)/.test(kif)) {
        drillFails.push('駒落ちの棋譜（KIF）の書き出しがおかしい');
      }
    } catch (e) { drillFails.push(`駒落ちチャレンジの確認で例外：${e}`); }
    // 復習の間隔（1→3→7→21→45日で卒業）
    try {
      const key = `_selftest.${Date.now()}`;
      store.recordMiss(key, 'k');
      const days = [];
      for (let i = 0; i < 5; i++) {
        const r = store.state.reviews[`${key}#k`];
        if (r.cleared) break;
        days.push(Math.round((r.due - Date.now()) / 864e5));
        store.clearReview(key, 'k');
      }
      if (days.join() !== '1,3,7,21,45') drillFails.push(`復習の間隔が ${days.join('→')}日（正しくは 1→3→7→21→45日）`);
      store.update((st) => { delete st.reviews[`${key}#k`]; });
      drills++;
    } catch (e) { drillFails.push(`復習の間隔の確認で例外：${e}`); }
    section('ドリル・棋譜・復習の間隔が正しい', !drillFails.length, drills, drillFails);

    // 6. 保存と同期の合成
    const saveFails = [];
    try {
      const a = { lessons: { x: { done: true, correct: 1, total: 1, at: 100 } }, reviews: {}, mistakes: {}, games: {}, record: {}, streak: { count: 1, best: 1, last: '' }, updatedAt: 100, resetAt: 0 };
      const b = { lessons: { x: { done: true, correct: 2, total: 2, at: 200 } }, reviews: {}, mistakes: {}, games: {}, record: {}, streak: { count: 2, best: 2, last: '' }, updatedAt: 200, resetAt: 0 };
      const m = NS_STORE.mergeStates(a, b);
      if (m.lessons.x.correct !== 2) saveFails.push('新しい記録が優先されていない');
      // 盤ごとの強さ：盤ごとに対局数の多い方が残る。古い形式（盤ごとの記録がない）は、全部の対局を持ち点に数えた扱い
      const lvA = { full: { level: 'normal', run: 1, w: 1, l: 0, d: 0, at: 100 }, mini: { level: 'hard', run: 0, w: 4, l: 0, d: 0, at: 90 } };
      const lvB = { mini: { level: 'normal', run: 1, w: 1, l: 0, d: 0, at: 150 } };
      const m2 = NS_STORE.mergeStates({ ...a, record: { chess: { rating: 1010, w: 5, l: 0, d: 0, rn: 1, at: 100, lv: lvA } } },
        { ...b, record: { chess: { rating: 1000, w: 1, l: 0, d: 0, rn: 0, at: 150, lv: lvB } } });
      const lv2 = m2.record.chess.lv;
      if (lv2.mini?.level !== 'hard' || lv2.full?.w !== 1 || m2.record.chess.rn !== 1) saveFails.push('盤ごとの強さと成績の合成がおかしい');
      const m3 = NS_STORE.mergeStates({ ...a, record: { go: { rating: 1048, w: 3, l: 1, d: 0, level: 'hard', run: 0, at: 100 } } }, b);
      if (m3.record.go.rn !== 4 || Object.keys(m3.record.go.lv).length) saveFails.push('古い形式の成績の読み込みがおかしい');
      const code = store.exportCode();
      if (!code || code.length < 8) saveFails.push('書き出しコードが作れない');
      // 麻雀の成績：数えた局の多い方を採る。どちらの順で合わせても同じになる
      const mjA = { ...a, mj: { k: 10, a: 2, t: 1, ap: 8000, h: 1, hp: 3900, r: 2, f: 3, rk: [1, 0, 0, 0], at: 100 } };
      const mjB = { ...b, mj: { k: 7, a: 1, t: 0, ap: 2000, h: 2, hp: 5000, r: 1, f: 1, rk: [0, 0, 1, 0], at: 300 } };
      const x1 = NS_STORE.mergeStates(mjA, mjB), x2 = NS_STORE.mergeStates(mjB, mjA);
      if (x1.mj.k !== 10 || x1.mj.rk[0] !== 1 || JSON.stringify(x1.mj) !== JSON.stringify(x2.mj)) saveFails.push('麻雀の成績の合成がおかしい');
    } catch (e) { saveFails.push(`例外：${e}`); }
    section('進捗の保存・持ち出しが動く', !saveFails.length, 5, saveFails);

    // 8. コーチのひとこと：どの指摘の種類でも、どの良い手でも、文が作れる（「undefined」などが混ざらない）
    const talkFails = [];
    let talks = 0;
    const bad = (t) => !t || !t.text || /undefined|NaN|null|\[object/.test(t.text);
    const sample = { name: 'ナイト', by: 'ポーン', at: 'e5', moved: true, loss: 3, defended: false, target: 'ビショップ', piece: 'ナイト',
      safe: true, gain: 3, n: 1, fork: false, tile: '5萬', diff: 4, best: '北', k: 2, line: 2, mat: 5, drop: 9 };
    for (const game of ['chess', 'shogi', 'go', 'mahjong']) {
      for (const kind of Object.keys(NS_COACH.KIND_JA)) {
        for (const level of ['miss', 'blunder']) {
          talks++;
          try {
            const t = NS_COACH.talk(game, { level, lines: [{ kind, what: '指摘の文', d: { ...sample, moved: level === 'miss' } }] }, { theme: kind, themeN: level === 'miss' ? 1 : 2, streak: 0 });
            if (bad(t)) talkFails.push(`${game}・${kind}：文が作れない（${t && t.text}）`);
          } catch (e) { talkFails.push(`${game}・${kind}：例外 ${e.message || e}`); }
        }
      }
      const goods = [{ mate: true }, { mateRun: 1 }, { stalemateSave: true }, { stalemate: true }, { deepGood: 3 }, { fork: true, hitNames: ['キング', 'ルーク'], hits: ['e8のキング', 'a8のルーク'] },
        { took: 'ナイト' }, { check: true }, { hits: ['e8のキング'], hitNames: ['キング'] }, { tenpai: true, waits: '5萬・8萬' }, { kinds: 3, tiles: 10 },
        { gcap: true, k: 2 }, { gsave: true }, { gdouble: true }, { gatari: true }, {}];
      for (const d of goods) {
        for (const streak of [1, 3]) {
          talks++;
          try {
            const t = NS_COACH.talk(game, { level: 'ok', lines: [{ kind: 'good', what: '良い手', d }] }, { streak });
            if (bad(t)) talkFails.push(`${game}・良い手 ${Object.keys(d).join(',') || '（ふつう）'}：文が作れない（${t && t.text}）`);
          } catch (e) { talkFails.push(`${game}・良い手：例外 ${e.message || e}`); }
        }
      }
      talks++;
      const tip = NS_COACH.talk(game, { level: 'ok', lines: [{ kind: 'good', what: '良い手', d: {} }, { kind: 'tip', what: 'ひとこと', talk: 'コツのひとこと', mood: 'happy' }] }, {});
      if (bad(tip) || tip.text !== 'コツのひとこと') talkFails.push(`${game}・ひとこと（tip）が出ない`);
    }
    section('コーチのひとことが作れる', !talkFails.length, talks, talkFails);

    // 9. 麻雀の鳴きの判断（役が残るか）と、牌譜の振り返りでのアガリの見逃し
    const nkFails = [];
    let nks = 0;
    try {
      const W = { seatWind: 'z2', roundWind: 'z1' };
      const seen2 = new Array(34).fill(0);
      seen2[M.toIndex('z5')] = 2;
      const cases = [
        ['タンヤオが残るポン', ['m2', 'm3', 'm4', 'p5', 'p6', 'p7', 's3', 's4', 's6', 's6', 's7'], [{ type: 'pon', tiles: ['p2', 'p2', 'p2'] }], {}, (k) => k.includes('tanyao')],
        ['役のないチー', ['p1', 'p2', 'p3', 's4', 's5', 's6', 's7', 's8', 'z4', 'p9', 'm5'], [{ type: 'chi', tiles: ['m1', 'm2', 'm3'] }], {}, (k) => !k.length],
        ['混一色に向かうチー', ['s1', 's2', 's6', 's7', 's8', 's9', 's9', 'z3', 'z3', 'z6', 'p4'], [{ type: 'chi', tiles: ['s3', 's4', 's5'] }], {}, (k) => k.includes('honitsu')],
        ['対々和に向かうポン', ['p2', 'p2', 's5', 's5', 'z4', 'z4', 'm1', 'm1', 'p7', 's8', 's9'], [{ type: 'pon', tiles: ['m9', 'm9', 'm9'] }], {}, (k) => k.includes('toitoi')],
        ['役牌の対子がある鳴き', ['p1', 'p2', 'p3', 's4', 's5', 's6', 's7', 's8', 'z5', 'z5', 'm5'], [{ type: 'chi', tiles: ['m1', 'm2', 'm3'] }], {}, (k) => k.includes('pair-z5')],
        ['役牌の対子でも、残りがもう見えている鳴き', ['p1', 'p2', 'p3', 's4', 's5', 's6', 's7', 's8', 'z5', 'z5', 'm5'], [{ type: 'chi', tiles: ['m1', 'm2', 'm3'] }], { seen: seen2 }, (k) => !k.length],
        ['喰いタンなしの卓のポン', ['m2', 'm3', 'm4', 'p5', 'p6', 'p7', 's3', 's4', 's6', 's6', 's7'], [{ type: 'pon', tiles: ['p2', 'p2', 'p2'] }], { kuitan: false }, (k) => !k.includes('tanyao')],
      ];
      for (const [name, hand, melds, o, ok] of cases) {
        nks++;
        const keys = NS_MJAI.yakuPaths(hand, melds, { ...W, ...o }).map((x) => x.key);
        if (!ok(keys)) nkFails.push(`${name}：役の候補の判定が違う（${keys.join('・') || 'なし'}）`);
      }
      // オーラスの着順：あがったら何着で、そこで終わるか
      const P = NS_MJAI.placeAfterWin;
      const pcases = [
        ['ラス目の1300点のロン（4着のまま終局）', [18000, 35000, 25000, 22000], { me: 0, oya: 3, han: 1, fu: 40, tsumo: false, from: 3, target: 30000, yame: true }, { before: 4, after: 4, ends: true }],
        ['満貫ツモでトップに立つが、30000点に届かない（延長戦）', [20000, 28000, 28000, 24000], { me: 0, oya: 3, han: 5, fu: 30, tsumo: true, target: 30000, yame: true }, { before: 4, after: 1, ends: false }],
        ['親のアガリでもトップでなければ連荘', [30000, 26000, 20000, 24000], { me: 3, oya: 3, han: 2, fu: 30, tsumo: false, from: 2, target: 30000, yame: true }, { before: 3, after: 2, ends: false }],
        ['親がトップになるアガリはアガリ止め', [27000, 26000, 20000, 27000], { me: 3, oya: 3, han: 5, fu: 30, tsumo: false, from: 2, target: 30000, yame: true }, { before: 2, after: 1, ends: true }],
      ];
      for (const [name, sc, o, want] of pcases) {
        nks++;
        const r = P(sc, o);
        if (r.before !== want.before || r.after !== want.after || r.ends !== want.ends) nkFails.push(`${name}：着順の計算が違う（${r.before}着→${r.after}着、終局${r.ends ? 'する' : 'しない'}）`);
      }
      // オーラスの押し引き（4人打ちの対局の形で）：トップ目は危ない牌を止める、ラス目は押してよい
      const mkAL = (scores, hand13, cut) => {
        const g = new NS_MJ4.Game({ naki: true });
        g.deal();
        g.round = 1; g.kyoku = 4; g.oya = 3; g.honba = 0; g.riichiSticks = 1; g.scores = [...scores];
        g.hands = [[...hand13], g.hands[1], g.hands[2], g.hands[3]];
        g.melds = [[], [], [], []];
        g.discards = [cut ? [{ tile: cut }] : [], [], [{ tile: 'z7' }, { tile: 's9' }, { tile: 'p1', riichi: true }], []];
        g.riichi = [false, false, true, false];
        g.log = [{ kind: 'riichi', p: 2 }];
        g.doraInds = ['p9']; g.dora = 'p9';
        return g;
      };
      const tenpai13 = ['m2', 'm3', 'm4', 'p3', 'p4', 'p5', 's6', 's7', 's8', 'p6', 'p7', 'z2', 'z2'];
      const far13 = ['m1', 'm4', 'm7', 'p2', 'p5', 'p8', 's3', 's6', 's9', 'z1', 'z3', 'z5', 'z6'];
      nks += 3;
      const gTop = mkAL([33000, 28000, 22000, 17000], tenpai13, 'm5');
      const rTop = NS_MJAI.reviewTurn(gTop, 0, M.sortTiles([...tenpai13, 'm5']), 'm5');
      if (!rTop.lines.some((l) => l.kind === 'push' && l.sub === 'allLast')) nkFails.push('オーラスのトップ目がテンパイで危ない牌を押したのを、指摘していない');
      const gLast = mkAL([17000, 33000, 28000, 22000], far13, 'm5');
      const rLast = NS_MJAI.reviewTurn(gLast, 0, M.sortTiles([...far13, 'm5']), 'm5');
      if (rLast.lines.some((l) => l.kind === 'push') || rLast.lines[0]?.sub !== 'allLast4') nkFails.push('オーラスのラス目が押したのを、「降りる場面」と指摘している');
      const gPre = mkAL([33000, 28000, 22000, 17000], tenpai13, null);
      gPre.turn = 0; gPre.drawn = 'm5'; gPre.phase = 'discard';
      const adv = NS_MJAI.foldAdvice(gPre, 0);
      if (adv?.lines?.[0]?.kind !== 'fold') nkFails.push('オーラスのトップ目に、テンパイでも降りる助言が出ていない');
      // オーラスのリーチ判断：ダマでトップに届くならリーチは要らない／リーチでしか届かないならリーチ
      const mkR = (scores, hand13) => {
        const g = new NS_MJ4.Game({ naki: true });
        g.deal();
        g.round = 1; g.kyoku = 4; g.oya = 3; g.honba = 0; g.riichiSticks = 0; g.scores = [...scores];
        g.hands = [[...hand13], g.hands[1], g.hands[2], g.hands[3]];
        g.melds = [[], [], [], []]; g.discards = [[], [], [], []]; g.riichi = [false, false, false, false];
        g.doraInds = ['z1']; g.dora = 'z1';
        return g;
      };
      const pin13 = ['m2', 'm3', 'm4', 'p3', 'p4', 'p5', 's6', 's7', 's8', 'p6', 'p7', 's5', 's5'];
      const riichiCase = (scores, declared) => {
        const g = mkR(scores, pin13);
        return NS_MJAI.allLastRiichiLine(NS_MJAI.allLastRiichi(g, 0, { scores: g.scores, oya: 3, honba: 0, pot: 0, first: 0, target: 0 }, pin13), declared, '位');
      };
      nks += 2;
      const rA = riichiCase([26500, 28000, 24000, 21500], true);
      if (!(rA && rA.level === 'miss' && rA.line.sub === 'allLast')) nkFails.push('オーラスで、ダマでもトップに届く手のリーチを「要らない」と言えていない');
      const rB = riichiCase([24900, 29000, 23000, 23100], false);
      if (!(rB && rB.level === 'miss' && /リーチをかける場面/.test(rB.line.what))) nkFails.push('オーラスで、リーチでしかトップに届かない手のダマを指摘していない');
      // 小さな牌譜：1局目＝ツモあがりの見逃しと、自分で捨てた牌（フリテン）でのロン、2局目＝ロンの見逃し、3局目＝役のないチー、
      // 4局目＝オーラスで、あがっても4着のまま終わるロンの見送り（間違いではない）
      const others = (x) => [14, 15, 16, 17, 18, 19, 27, 28, 29, 31, 32, 33, x];
      const head = (k) => [[k, 0, 0], [25000, 25000, 25000, 25000], [47], []];
      const end = ['流局', [0, 0, 0, 0]];
      const log = {
        title: ['', ''], name: ['A', 'B', 'C', 'D'], rule: { disp: '般南喰赤', aka: 1 },
        log: [
          [...head(0), [11, 12, 13, 24, 25, 26, 37, 38, 39, 41, 41, 41, 22], [22, 15], [60, 60], others(34), [44], [60], others(35), [43], [60], others(36), [22], [60], end],
          [...head(1), [11, 12, 13, 24, 25, 26, 37, 38, 39, 45, 45, 45, 22], [19], [60], others(34), [22], [60], others(35), [44], [60], others(36), [43], [60], end],
          [...head(2), [12, 13, 21, 22, 23, 34, 35, 36, 37, 38, 44, 29, 15], ['c111213'], [44], others(34), [43], [60], others(35), [44], [60], others(36), [11], [60], end],
          [[7, 0, 0], [18000, 35000, 25000, 22000], [41], [], [11, 12, 13, 24, 25, 26, 37, 38, 39, 45, 45, 45, 22], [19], [60], others(35), [], [], others(36), [], [], others(34), [22], [60], end],
        ],
      };
      const g = NS_PLAY.mjLog.readMahjongLog(JSON.stringify(log));
      nks++;
      if (g.error) nkFails.push(`牌譜が読めない：${g.error}`);
      else {
        const rv = await NS_PLAY.mjLog.reviewMahjongGame(g, 0);
        nks += 4;
        const bad = rv.wins.filter((w) => w.review.level !== 'ok');
        if (bad.length !== 2) nkFails.push(`アガリの見逃しの数が違う（${bad.length}回。正しくはツモ1回・ロン1回で、フリテンのロンは数えない）`);
        else if (bad[0].how !== 'tsumo' || bad[1].how !== 'ron') nkFails.push('アガリの見逃しの種類（ツモ・ロン）が違う');
        const ok = rv.wins.filter((w) => w.review.level === 'ok');
        if (ok.length !== 1 || ok[0].place?.after !== 4 || !ok[0].place?.ends) nkFails.push('オーラスで着順の変わらないアガリの見送りを、間違いでないと判定できていない');
        if (rv.calls.length !== 1 || rv.calls[0].review.level === 'ok') nkFails.push('役のないチーを指摘していない');
        if (!rv.rounds[0].items.some((d) => d.type === 'win')) nkFails.push('アガリの見逃しが、局ごとの一覧に出ていない');
        nks++;
        const al = rv.allLast;
        if (al.length !== 1 || al[0].rank !== 4 || !al[0].entries.some((e) => e.cat === 'アガリの見送り' && e.lv === 'good')) nkFails.push('まとめの「オーラスの判断」に、着順の変わらないアガリの見送りが出ていない');
      }
      // オーラスで、ラス目が1300点をあがって4着のまま終わる（アガリラス）
      const log2 = { title: ['', ''], name: ['A', 'B', 'C', 'D'], rule: { disp: '般南喰赤', aka: 1 }, log: [
        [[7, 0, 0], [18000, 35000, 25000, 22000], [41], [], [11, 12, 13, 24, 25, 26, 37, 38, 39, 45, 45, 45, 22], [], [], others(35), [], [], others(36), [], [], others(34), [22], [60],
          ['和了', [1300, 0, 0, -1300], [0, 3, 0, '40符1飜1300点', '役牌 白(1飜)']]],
      ] };
      const g2 = NS_PLAY.mjLog.readMahjongLog(JSON.stringify(log2));
      nks++;
      if (g2.error) nkFails.push(`牌譜が読めない：${g2.error}`);
      else {
        const rv2 = await NS_PLAY.mjLog.reviewMahjongGame(g2, 0);
        if (rv2.wins.length || !rv2.rounds[0].items.some((d) => d.type === 'agari')) nkFails.push('アガリラス（4着のまま終わるアガリ）を指摘していない');
        nks++;
        if (!rv2.allLast[0]?.entries.some((e) => e.cat === 'アガリラス') || rv2.final?.rank !== 4 || rv2.final?.scores[0] !== 19300) nkFails.push('まとめの「オーラスの判断」に、アガリラスと最終の着順（4着・19,300点）が出ていない');
      }
      // オーラスで、2着から放銃して3着で終わる（まとめに「放銃」と、局の終わりの着順が出る）
      const log3 = { title: ['', ''], name: ['A', 'B', 'C', 'D'], rule: { disp: '般南喰赤', aka: 1 }, log: [
        [[7, 0, 0], [26000, 30000, 24000, 20000], [41], [], others(37), [22], [60], others(35), [], [], others(36), [], [], others(34), [44], [60],
          ['和了', [-3900, 3900, 0, 0], [1, 0, 1, '30符3飜3900点', '役牌 中(1飜)']]],
      ] };
      const g3 = NS_PLAY.mjLog.readMahjongLog(JSON.stringify(log3));
      nks++;
      if (g3.error) nkFails.push(`牌譜が読めない：${g3.error}`);
      else {
        const rv3 = await NS_PLAY.mjLog.reviewMahjongGame(g3, 0);
        const a3 = rv3.allLast[0];
        if (!a3 || !a3.entries.some((e) => e.cat === '放銃') || a3.endRank !== 3 || rv3.final?.rank !== 3) nkFails.push('まとめの「オーラスの判断」に、着順が落ちた放銃（2着→3着）が出ていない');
      }
      // 4人打ち：この局で半荘が終わるか（「半荘の結果を見る」を出す判定）が、実際の進み方と合う
      const endCases = [
        ['南4局で子があがる', { round: 1, kyoku: 4, result: { kind: 'win', winner: 0 } }, true],
        ['南4局で親があがる（連荘）', { round: 1, kyoku: 4, result: { kind: 'win', winner: 3 } }, false],
        ['南4局の流局で親がテンパイ', { round: 1, kyoku: 4, result: { kind: 'draw', tenpai: [false, false, false, true] } }, false],
        ['南4局の流局で親がノーテン', { round: 1, kyoku: 4, result: { kind: 'draw', tenpai: [true, false, false, false] } }, true],
        ['南4局の途中流局', { round: 1, kyoku: 4, result: { kind: 'draw', abort: 'kyuushu', tenpai: [false, false, false, false] } }, false],
        ['南3局で子があがる', { round: 1, kyoku: 3, oya: 2, result: { kind: 'win', winner: 0 } }, false],
        ['東2局で点棒がマイナスになる', { round: 0, kyoku: 2, oya: 1, scores: [-1000, 40000, 30000, 31000], result: { kind: 'win', winner: 1 } }, true],
      ];
      for (const [name, st, want] of endCases) {
        nks++;
        const g = new NS_MJ4.Game({ naki: true });
        g.deal();
        Object.assign(g, { oya: 3, honba: 0, riichiSticks: 0, scores: [25000, 25000, 25000, 25000] }, st);
        const said = g.endsAfterThis();
        g.nextKyoku();
        if (said !== want || !!g.over !== want) nkFails.push(`${name}：半荘が終わるかの判定が違う（判定は${said ? '終わる' : '続く'}・実際は${g.over ? '終わった' : '続いた'}）`);
      }
    } catch (e) { nkFails.push(`例外：${e.message || e}`); }
    section('麻雀の鳴き・アガリの見逃し・オーラスの判定が正しい', !nkFails.length, nks, nkFails);

    const allFail = stepFails.length + idFails.length + talkFails.length + mateFails.length + mjFails.length + goFails.length + scoreFails.length + drillFails.length + saveFails.length + nkFails.length;
    prog.innerHTML = allFail
      ? `<strong>${allFail}件の要確認がありました。</strong>下の一覧を見てください。`
      : '<strong>すべて合格しました。</strong>問題の表示・詰みの検算・麻雀の計算と講評・囲碁の判定・保存まわりに異常はありません。';
    const back = el('button', 'btn btn--ghost btn--sm', 'アプリに戻る');
    // ?selftest を外して開き直す。href を変えた直後に reload すると移動が取り消され、診断がもう一度走っていた
    back.addEventListener('click', () => { location.replace(location.pathname + '#/'); });
    root.appendChild(back);
  }

  function render() {
    const [gameId = '', lessonId = '', mode = ''] = location.hash.replace(/^#\/?/, '').split('/');
    const main = $('#main');
    main.innerHTML = '';

    let view;
    if (gameId && GAMES[gameId] && lessonId) view = viewLesson(gameId, lessonId, mode);
    else if (gameId && GAMES[gameId]) view = viewGame(gameId);
    else view = viewHub();

    main.appendChild(view);
    window.scrollTo(0, 0);

    const btn = $('#syncBtn');
    const s = store.syncStatus();
    btn.dataset.state = s === 'on' ? 'on' : 'off';
    btn.textContent = s === 'on' ? '同期中' : s === 'ready' ? 'ログイン' : '保存';
  }

  window.addEventListener('hashchange', render);
  $('#syncBtn').addEventListener('click', openSync);

  $('#settingsBtn').addEventListener('click', openSettings);

  store.subscribe(() => {
    const btn = $('#syncBtn');
    const s = store.syncStatus();
    btn.dataset.state = s === 'on' ? 'on' : 'off';
    btn.textContent = s === 'on' ? '同期中' : s === 'ready' ? 'ログイン' : '保存';
  });

  store.onSaveError = () => toast('この端末に進捗を保存できませんでした（空き容量やブラウザの設定のため）。右上の「保存」から引き継ぎコードを控えておいてください。', 9000);
  await store.init();
  migrateReviewKeys();
  if (new URLSearchParams(location.search).has('selftest')) {
    const main = $('#main');
    main.innerHTML = '';
    const box = el('div');
    main.appendChild(box);
    runSelfTest(box);
  } else render();

  // 静的ファイルをオフラインでも読めるようにする。初回表示は妨げない。
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    const registerOffline = () => {
      navigator.serviceWorker.register('./sw.js').catch(() => { /* 未対応環境はオンラインで使う */ });
    };
    if (document.readyState === 'complete') registerOffline();
    else window.addEventListener('load', registerOffline, { once: true });
  }

  return {};
})();

