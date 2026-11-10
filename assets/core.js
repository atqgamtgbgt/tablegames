
// ── js/games/chess.js ───────────────────────────────────────
const CHESS_FACTORY = () => {

  // chess.js — 学習用チェスエンジン
  // 盤は { "d4": "R", "f6": "p" } 形式。大文字=白, 小文字=黒。
  // アンパッサン／キャスリングは「後から教える特殊ルール」として別扱いにする。

  const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'];

  const PIECE_JA = {
    K: 'キング', Q: 'クイーン', R: 'ルーク', B: 'ビショップ', N: 'ナイト', P: 'ポーン',
  };
  const PIECE_VALUE = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };

  const sq = (fi, ri) => FILES[fi] + RANKS[ri];
  const idx = (s) => [FILES.indexOf(s[0]), RANKS.indexOf(s[1])];
  const onBoard = (fi, ri, w = 8, h = 8) => fi >= 0 && fi < w && ri >= 0 && ri < h;
  const colorOf = (p) => (p === p.toUpperCase() ? 'w' : 'b');
  const kindOf = (p) => p.toUpperCase();

  /** 盤の指定サイズ内に収まるマスだけを列挙する（ミニ盤用） */
  function squaresOf(w = 8, h = 8) {
    const out = [];
    for (let ri = h - 1; ri >= 0; ri--) for (let fi = 0; fi < w; fi++) out.push(sq(fi, ri));
    return out;
  }

  const SLIDES = {
    R: [[1, 0], [-1, 0], [0, 1], [0, -1]],
    B: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
    Q: [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]],
  };
  const STEPS = {
    N: [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]],
    K: [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]],
  };

  /**
   * 1つの駒の「疑似合法手」（自分のキングが取られる形かどうかは見ない）
   * opts: { w, h, noPawnDouble }
   */
  function pseudoMoves(board, from, opts = {}) {
    const w = opts.w ?? 8, h = opts.h ?? 8;
    const piece = board[from];
    if (!piece) return [];
    const me = colorOf(piece), kind = kindOf(piece);
    const [f, r] = idx(from);
    const out = [];
    const at = (fi, ri) => board[sq(fi, ri)];
    const friendly = (t) => !opts.anyColor && colorOf(t) === me;
    const push = (fi, ri) => {
      if (!onBoard(fi, ri, w, h)) return false;
      const t = at(fi, ri);
      if (!t) { out.push(sq(fi, ri)); return true; }
      if (!friendly(t)) out.push(sq(fi, ri));
      return false;
    };

    if (kind === 'P') {
      const dir = me === 'w' ? 1 : -1;
      const startRank = me === 'w' ? 1 : h - 2;
      if (onBoard(f, r + dir, w, h) && !at(f, r + dir)) {
        out.push(sq(f, r + dir));
        // 2マス進みは6段以上の盤だけ。4×4などで使うと初手で昇格してしまう
        if (!opts.noPawnDouble && h >= 6 && r === startRank
          && onBoard(f, r + 2 * dir, w, h) && !at(f, r + 2 * dir)) out.push(sq(f, r + 2 * dir));
      }
      for (const df of [-1, 1]) {
        if (!onBoard(f + df, r + dir, w, h)) continue;
        const t = at(f + df, r + dir);
        if (t && (opts.anyColor || colorOf(t) !== me)) out.push(sq(f + df, r + dir));
        // アンパッサン（opts.ep に「通過したマス」が入っているときだけ）
        else if (!t && opts.ep && opts.ep === sq(f + df, r + dir)) {
          const victim = at(f + df, r);
          if (victim && kindOf(victim) === 'P' && colorOf(victim) !== me) out.push(opts.ep);
        }
      }
      return out;
    }
    if (STEPS[kind]) {
      for (const [df, dr] of STEPS[kind]) push(f + df, r + dr);
      return out;
    }
    for (const [df, dr] of SLIDES[kind]) {
      let fi = f + df, ri = r + dr;
      while (push(fi, ri)) { fi += df; ri += dr; }
    }
    return out;
  }

  function findKing(board, color) {
    for (const [s, p] of Object.entries(board)) if (kindOf(p) === 'K' && colorOf(p) === color) return s;
    return null;
  }

  /**
   * その駒が「利いている」マス。ポーンは斜め前だけ（前進は攻撃ではない）。
   * 空きマスへの利きも数えるので、キャスリングの判定や利きの表示に使える。
   */
  function attacks(board, from, opts = {}) {
    const piece = board[from];
    if (!piece) return [];
    if (kindOf(piece) !== 'P') return pseudoMoves(board, from, { w: opts.w, h: opts.h, anyColor: true, noPawnDouble: true });
    const w = opts.w ?? 8, h = opts.h ?? 8;
    const [f, r] = idx(from);
    const dir = colorOf(piece) === 'w' ? 1 : -1;
    const out = [];
    for (const df of [-1, 1]) if (onBoard(f + df, r + dir, w, h)) out.push(sq(f + df, r + dir));
    return out;
  }

  function isAttacked(board, target, byColor, opts = {}) {
    for (const [s, p] of Object.entries(board)) {
      if (colorOf(p) !== byColor) continue;
      if (attacks(board, s, opts).includes(target)) return true;
    }
    return false;
  }

  function inCheck(board, color, opts = {}) {
    const k = findKing(board, color);
    return k ? isAttacked(board, k, color === 'w' ? 'b' : 'w', opts) : false;
  }

  /** promo：昇格する駒（'Q' 'R' 'B' 'N'）。省略するとクイーン */
  function applyMove(board, from, to, opts = {}, promo = 'Q') {
    const h = opts.h ?? 8;
    const next = { ...board };
    let piece = next[from];
    delete next[from];
    if (kindOf(piece) === 'P') {
      // アンパッサン：斜めに空きマスへ進んだら、横にいる相手のポーンを取る
      if (from[0] !== to[0] && !board[to]) delete next[to[0] + from[1]];
      // プロモーション（自動でクイーン。学習段階では選択させない）
      const lastRank = colorOf(piece) === 'w' ? RANKS[h - 1] : RANKS[0];
      if (to[1] === lastRank) {
        const k = ['Q', 'R', 'B', 'N'].includes(promo) ? promo : 'Q';
        piece = colorOf(piece) === 'w' ? k : k.toLowerCase();
      }
    }
    // キャスリング：キングが2マス横に動いたら、ルークも反対側へ
    if (kindOf(piece) === 'K' && Math.abs(FILES.indexOf(from[0]) - FILES.indexOf(to[0])) === 2) {
      const rank = from[1];
      const kingSide = to[0] === 'g';
      const rFrom = (kingSide ? 'h' : 'a') + rank, rTo = (kingSide ? 'f' : 'd') + rank;
      if (next[rFrom]) { next[rTo] = next[rFrom]; delete next[rFrom]; }
    }
    next[to] = piece;
    return next;
  }

  /** 自分のキングが取られない手だけを返す */
  function legalMoves(board, from, opts = {}) {
    const piece = board[from];
    if (!piece) return [];
    const me = colorOf(piece);
    if (!findKing(board, me)) return pseudoMoves(board, from, opts); // キングのいない練習盤
    const out = pseudoMoves(board, from, opts).filter(
      (to) => !inCheck(applyMove(board, from, to, opts), me, opts)
    );
    return kindOf(piece) === 'K' ? out.concat(castleMoves(board, from, opts)) : out;
  }

  /**
   * キャスリングの行き先（キングの着地マス）。opts.castle = { w:{k,q}, b:{k,q} } のときだけ。
   * 条件：キングもルークも初期位置／間が空いている／いまチェックされていない／
   * キングが通るマスと着くマスが攻撃されていない。
   */
  function castleMoves(board, from, opts = {}) {
    const piece = board[from];
    if (!piece || kindOf(piece) !== 'K' || !opts.castle) return [];
    if ((opts.w ?? 8) !== 8 || (opts.h ?? 8) !== 8) return [];
    const me = colorOf(piece), foe = me === 'w' ? 'b' : 'w';
    const rank = me === 'w' ? '1' : '8';
    const rights = opts.castle[me] || {};
    if (from !== 'e' + rank || inCheck(board, me, opts)) return [];
    const rook = me === 'w' ? 'R' : 'r';
    const out = [];
    const free = (fs) => fs.every((f) => !board[f + rank]);
    const safe = (fs) => fs.every((f) => !isAttacked(board, f + rank, foe, opts));
    if (rights.k && board['h' + rank] === rook && free(['f', 'g']) && safe(['f', 'g'])) out.push('g' + rank);
    if (rights.q && board['a' + rank] === rook && free(['b', 'c', 'd']) && safe(['c', 'd'])) out.push('c' + rank);
    return out;
  }

  /** 1手指したあとの、キャスリング権とアンパッサンのマス */
  function nextRights(opts, board, from, to) {
    const piece = board[from];
    const castle = opts.castle ? { w: { ...opts.castle.w }, b: { ...opts.castle.b } } : null;
    if (castle) {
      for (const s of [from, to]) {
        if (s === 'e1') castle.w = { k: false, q: false };
        if (s === 'e8') castle.b = { k: false, q: false };
        if (s === 'h1') castle.w.k = false;
        if (s === 'a1') castle.w.q = false;
        if (s === 'h8') castle.b.k = false;
        if (s === 'a8') castle.b.q = false;
      }
    }
    let ep = null;
    if (piece && kindOf(piece) === 'P' && from[0] === to[0] && Math.abs(Number(from[1]) - Number(to[1])) === 2) {
      ep = from[0] + String((Number(from[1]) + Number(to[1])) / 2);
    }
    return { ...opts, castle, ep };
  }

  function allLegalMoves(board, color, opts = {}) {
    const out = [];
    for (const [s, p] of Object.entries(board)) {
      if (colorOf(p) !== color) continue;
      for (const to of legalMoves(board, s, opts)) out.push({ from: s, to });
    }
    return out;
  }

  function gameStatus(board, turn, opts = {}) {
    const moves = allLegalMoves(board, turn, opts);
    if (moves.length) return inCheck(board, turn, opts) ? 'check' : 'playing';
    return inCheck(board, turn, opts) ? 'checkmate' : 'stalemate';
  }

  /** 1手詰めを探す（レッスンの答え合わせ用） */
  function findMateIn1(board, color, opts = {}) {
    const foe = color === 'w' ? 'b' : 'w';
    return allLegalMoves(board, color, opts).filter(
      (m) => gameStatus(applyMove(board, m.from, m.to, opts), foe, opts) === 'checkmate'
    );
  }

  /** ソリティア・チェス：必ず取る手のみ。全駒を1つに減らせれば成功 */
  function captureMoves(board, from, opts = {}) {
    return pseudoMoves(board, from, { ...opts, noPawnDouble: true, anyColor: true })
      .filter((to) => board[to]);
  }
  function solitaireSolvable(board, opts = {}) {
    const keys = Object.keys(board);
    if (keys.length <= 1) return true;
    for (const from of keys) {
      for (const to of captureMoves(board, from, opts)) {
        const next = { ...board };
        next[to] = next[from];
        delete next[from];
        if (solitaireSolvable(next, opts)) return true;
      }
    }
    return false;
  }

  /**
   * 素朴な評価付き先読み。レッスン内の対局相手用（弱く、しかし馬鹿すぎない）。
   * 画面が固まらないよう、浅い読みから順に深くし、持ち時間（timeMs）を過ぎたら
   * 最後に読み切った深さの手を返す。取る手から先に読むので枝刈りもよく効く。
   */
  function pickMove(board, color, opts = {}, depth = 2, timeMs = 900) {
    const moves = allLegalMoves(board, color, opts);
    if (!moves.length) return null;
    // 読みの中ではキャスリング権／アンパッサンを追跡しないので外しておく
    const inner = { ...opts, castle: null, ep: null };
    const score = (b, me) => {
      let s = 0;
      for (const p of Object.values(b)) s += (colorOf(p) === me ? 1 : -1) * PIECE_VALUE[kindOf(p)];
      return s;
    };
    // 取る手（高い駒を取る手）を先に
    const order = (b, ms) => ms
      .map((m) => ({ m, k: b[m.to] ? PIECE_VALUE[kindOf(b[m.to])] * 10 - PIECE_VALUE[kindOf(b[m.from])] : -100 }))
      .sort((x, y) => y.k - x.k).map((x) => x.m);
    const deadline = Date.now() + timeMs;
    const TIMEOUT = {};
    let nodes = 0;
    const search = (b, turn, d, alpha, beta) => {
      if ((++nodes & 255) === 0 && Date.now() > deadline) throw TIMEOUT;
      if (d === 0) {
        // 末端では合法手を作らない（重いので）。ただし王手がかかっている局面だけは詰みかを確かめる。
        // これがないと深さ2では「指したあと1手で詰まされる手」に気づかない
        if (inCheck(b, turn, inner) && !allLegalMoves(b, turn, inner).length) return turn === color ? -999 : 999;
        return score(b, color);
      }
      const ms = allLegalMoves(b, turn, inner);
      if (!ms.length) return inCheck(b, turn, inner) ? (turn === color ? -999 - d : 999 + d) : 0;
      const next = turn === 'w' ? 'b' : 'w';
      if (turn === color) {
        let best = -Infinity;
        for (const m of order(b, ms)) {
          best = Math.max(best, search(applyMove(b, m.from, m.to, inner), next, d - 1, alpha, beta));
          alpha = Math.max(alpha, best);
          if (beta <= alpha) break;
        }
        return best;
      }
      let best = Infinity;
      for (const m of order(b, ms)) {
        best = Math.min(best, search(applyMove(b, m.from, m.to, inner), next, d - 1, alpha, beta));
        beta = Math.min(beta, best);
        if (beta <= alpha) break;
      }
      return best;
    };
    const JITTER = 0.4;
    let result = null;
    let rootOrder = order(board, moves);
    for (let d = 1; d <= depth; d++) {
      let best = null, bestScore = -Infinity;
      const scored = [];
      try {
        for (const m of rootOrder) {
          // 乱数の幅より悪いと分かれば十分なので、そこで打ち切ってよい（fail-low の値は選ばれない）
          const floor = bestScore === -Infinity ? -Infinity : bestScore - JITTER - 0.01;
          const raw = search(applyMove(board, m.from, m.to, opts), color === 'w' ? 'b' : 'w', d - 1, floor, Infinity);
          const v = raw + Math.random() * JITTER;
          scored.push({ m, raw });
          if (v > bestScore) { bestScore = v; best = m; }
        }
      } catch (e) {
        if (e !== TIMEOUT) throw e;
        if (d === 1 && !result) result = best || moves[0];   // 1手読みすら終わらないことは実際にはない
        break;
      }
      result = best;
      // 次の深さは、いまの評価が高い手から読む
      rootOrder = scored.sort((x, y) => y.raw - x.raw).map((x) => x.m);
    }
    return result;
  }

  const START_POSITION = (() => {
    const b = {};
    const back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
    FILES.forEach((f, i) => {
      b[f + '1'] = back[i]; b[f + '2'] = 'P';
      b[f + '7'] = 'p'; b[f + '8'] = back[i].toLowerCase();
    });
    return b;
  })();

  /**
   * 駒の組み合わせ的に、もう誰もチェックメイトできない（K対K、K＋小駒1枚対K、
   * キングのほかはビショップだけで、全部が同じ色のマスにいる。例：K＋B 対 K＋B で、2つのビショップが同じ色のマス）
   */
  function insufficientMaterial(board) {
    const rest = Object.entries(board).filter(([, p]) => kindOf(p) !== 'K');
    if (!rest.length) return true;
    if (rest.length === 1 && ['N', 'B'].includes(kindOf(rest[0][1]))) return true;
    if (rest.every(([, p]) => kindOf(p) === 'B')) {
      const shade = (s) => (FILES.indexOf(s[0]) + Number(s.slice(1))) % 2;
      return new Set(rest.map(([s]) => shade(s))).size === 1;
    }
    return false;
  }

  /**
   * 相手がどう受けても、自分の手 k 回以内でチェックメイトできる初手を探す。
   * 見つかれば手、ないと分かれば null、時間切れで分からなければ undefined。
   */
  function findForcedMate(board, color, opts = {}, k = 2, timeMs = 300) {
    const foe = color === 'w' ? 'b' : 'w';
    const inner = { ...opts, castle: null, ep: null };
    const deadline = Date.now() + timeMs;
    const TO = {};
    const memo = new Map();
    const forced = (b, n) => {
      if (Date.now() > deadline) throw TO;
      const key = n + JSON.stringify(b);
      if (memo.has(key)) return memo.get(key);
      let hit = null;
      for (const m of allLegalMoves(b, color, inner)) {
        const b1 = applyMove(b, m.from, m.to, inner);
        const st = gameStatus(b1, foe, inner);
        if (st === 'checkmate') { hit = m; break; }
        if (n === 1 || st === 'stalemate') continue;
        const reps = allLegalMoves(b1, foe, inner);
        if (reps.length && reps.every((r) => forced(applyMove(b1, r.from, r.to, inner), n - 1))) { hit = m; break; }
      }
      memo.set(key, hit);
      return hit;
    };
    try { return forced(board, k); } catch (e) { if (e === TO) return undefined; throw e; }
  }
  /** 相手の番の局面で、相手のどの受けにも自分の1手メイトが残るか（強制メイトの2手目以降が続いているか） */
  function stillMating(board, color, opts = {}) {
    const foe = color === 'w' ? 'b' : 'w';
    const inner = { ...opts, castle: null, ep: null };
    const reps = allLegalMoves(board, foe, inner);
    return reps.length > 0 && reps.every((r) => findMateIn1(applyMove(board, r.from, r.to, inner), color, inner).length > 0);
  }

  return { findForcedMate, stillMating, FILES, RANKS, PIECE_JA, PIECE_VALUE, sq, idx, onBoard, colorOf, kindOf, squaresOf, pseudoMoves, attacks, findKing, isAttacked, inCheck, applyMove, legalMoves, castleMoves, nextRights, allLegalMoves, gameStatus, findMateIn1, captureMoves, solitaireSolvable, pickMove, insufficientMaterial, START_POSITION };
};
const NS_CHESS = CHESS_FACTORY();

// ── js/games/shogi.js ───────────────────────────────────────
const SHOGI_FACTORY = () => {

  // shogi.js — 学習用将棋エンジン
  // マスは "55" = 5筋5段。筋は右から1..w、段は上から1..h。
  // 駒: P歩 L香 N桂 S銀 G金 B角 R飛 K玉 / 成駒は先頭に "+"。
  // 大文字 = 先手(b, 下側・上に進む), 小文字 = 後手(w)。

  const PIECE_JA = {
    P: '歩', L: '香', N: '桂', S: '銀', G: '金', B: '角', R: '飛', K: '玉',
    '+P': 'と', '+L': '成香', '+N': '成桂', '+S': '成銀', '+B': '馬', '+R': '竜',
  };
  const PIECE_NAME = {
    P: '歩兵', L: '香車', N: '桂馬', S: '銀将', G: '金将', B: '角行', R: '飛車', K: '玉将',
    '+P': 'と金', '+L': '成香', '+N': '成桂', '+S': '成銀', '+B': '竜馬', '+R': '竜王',
  };
  const HAND_ORDER = ['R', 'B', 'G', 'S', 'N', 'L', 'P'];
  const PIECE_VALUE = {
    P: 1, L: 3, N: 4, S: 6, G: 7, B: 9, R: 11, K: 0,
    '+P': 7, '+L': 6, '+N': 6, '+S': 6, '+B': 12, '+R': 14,
  };

  const sq = (f, r) => `${f}${r}`;
  const idx = (s) => [Number(s[0]), Number(s[1])];
  const colorOf = (p) => (p.replace('+', '') === p.replace('+', '').toUpperCase() ? 'b' : 'w');
  const baseOf = (p) => p.replace('+', '').toUpperCase();
  const kindOf = (p) => (p.startsWith('+') ? '+' : '') + baseOf(p);
  const isPromoted = (p) => p.startsWith('+');
  const opponent = (c) => (c === 'b' ? 'w' : 'b');
  const cased = (kind, color) =>
    (kind.startsWith('+') ? '+' : '') +
    (color === 'b' ? baseOf(kind) : baseOf(kind).toLowerCase());

  const GOLD = [[0, -1], [-1, -1], [1, -1], [-1, 0], [1, 0], [0, 1]];
  const STEP = {
    P: [[0, -1]],
    N: [[-1, -2], [1, -2]],
    S: [[0, -1], [-1, -1], [1, -1], [-1, 1], [1, 1]],
    G: GOLD, '+P': GOLD, '+L': GOLD, '+N': GOLD, '+S': GOLD,
    K: [[0, -1], [-1, -1], [1, -1], [-1, 0], [1, 0], [0, 1], [-1, 1], [1, 1]],
    '+B': [[0, -1], [0, 1], [-1, 0], [1, 0]],
    '+R': [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  };
  const SLIDE = {
    L: [[0, -1]],
    B: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
    R: [[1, 0], [-1, 0], [0, 1], [0, -1]],
    '+B': [[1, 1], [1, -1], [-1, 1], [-1, -1]],
    '+R': [[1, 0], [-1, 0], [0, 1], [0, -1]],
  };

  /** 盤サイズと成りの陣地。9x9なら camp=3, 5五将棋・ミニ将棋は camp=1 */
  const shape = (w = 9, h = 9, camp = 3) => ({ w, h, camp });
  const BIG = shape(9, 9, 3);
  const GOGO = shape(5, 5, 1);
  const MINI = shape(3, 4, 1);

  function squaresOf({ w, h }) {
    const out = [];
    for (let r = 1; r <= h; r++) for (let f = w; f >= 1; f--) out.push(sq(f, r));
    return out;
  }
  const inside = (f, r, { w, h }) => f >= 1 && f <= w && r >= 1 && r <= h;

  /**
   * その駒が動けるマス（自玉が取られる形かは見ない）
   * opts.anyColor = true で、味方の駒がいるマスも「利きがある」として含める。
   * 守りの駒を数えるのに要る。
   */
  function pseudoMoves(board, from, sh = BIG, opts = {}) {
    const p = board[from];
    if (!p) return [];
    const me = colorOf(p), k = kindOf(p);
    const [f, r] = idx(from);
    const sign = me === 'b' ? 1 : -1;
    const out = [];
    const tryPush = (nf, nr) => {
      if (!inside(nf, nr, sh)) return false;
      const t = board[sq(nf, nr)];
      if (!t) { out.push(sq(nf, nr)); return true; }
      if (opts.anyColor || colorOf(t) !== me) out.push(sq(nf, nr));
      return false;
    };
    for (const [df, dr] of STEP[k] || []) tryPush(f + df * sign, r + dr * sign);
    for (const [df, dr] of SLIDE[k] || []) {
      let nf = f + df * sign, nr = r + dr * sign;
      while (tryPush(nf, nr)) { nf += df * sign; nr += dr * sign; }
    }
    return out;
  }

  const emptyHands = () => ({ b: {}, w: {} });
  const cloneHands = (h) => ({ b: { ...h.b }, w: { ...h.w } });

  function findKing(board, color) {
    for (const [s, p] of Object.entries(board)) if (baseOf(p) === 'K' && colorOf(p) === color) return s;
    return null;
  }

  /**
   * target に byColor の駒が利いているか。
   * 全部の駒の行き先を作るのではなく、target から逆向きにたどる（読みの速さに直結する）。
   */
  function isAttacked(board, target, byColor, sh = BIG) {
    const [tf, tr] = idx(target);
    const sign = byColor === 'b' ? 1 : -1;
    for (const kind of Object.keys(STEP)) {
      for (const [df, dr] of STEP[kind]) {
        const f = tf - df * sign, r = tr - dr * sign;
        if (!inside(f, r, sh)) continue;
        const p = board[sq(f, r)];
        if (p && colorOf(p) === byColor && kindOf(p) === kind) return true;
      }
    }
    for (const kind of Object.keys(SLIDE)) {
      for (const [df, dr] of SLIDE[kind]) {
        let f = tf - df * sign, r = tr - dr * sign;
        while (inside(f, r, sh)) {
          const p = board[sq(f, r)];
          if (p) {
            if (colorOf(p) === byColor && kindOf(p) === kind) return true;
            break;
          }
          f -= df * sign; r -= dr * sign;
        }
      }
    }
    return false;
  }
  function inCheck(board, color, sh = BIG) {
    const k = findKing(board, color);
    return k ? isAttacked(board, k, opponent(color), sh) : false;
  }

  /** 成れるか（陣地に入る・出る・陣地内での移動） */
  function canPromote(piece, from, to, sh = BIG) {
    if (isPromoted(piece) || ['G', 'K'].includes(baseOf(piece))) return false;
    const color = colorOf(piece);
    const zone = (r) => (color === 'b' ? r <= sh.camp : r > sh.h - sh.camp);
    return zone(idx(from)[1]) || zone(idx(to)[1]);
  }
  /** 成らないと二度と動けない駒か */
  function mustPromote(piece, to, sh = BIG) {
    if (isPromoted(piece)) return false;   // もう成っている駒（と・成香・成桂）は対象外
    const color = colorOf(piece), k = baseOf(piece), r = idx(to)[1];
    const dist = color === 'b' ? r : sh.h - r + 1;
    if ((k === 'P' || k === 'L') && dist <= 1) return true;
    if (k === 'N' && dist <= 2) return true;
    return false;
  }

  function applyMove(state, move, sh = BIG) {
    const board = { ...state.board };
    const hands = cloneHands(state.hands);
    if (move.drop) {
      const c = state.turn;
      hands[c][move.drop] = (hands[c][move.drop] || 0) - 1;
      if (hands[c][move.drop] <= 0) delete hands[c][move.drop];
      board[move.to] = cased(move.drop, c);
    } else {
      const p = board[move.from];
      const captured = board[move.to];
      if (captured) {
        const k = baseOf(captured);
        if (k !== 'K') hands[state.turn][k] = (hands[state.turn][k] || 0) + 1;
      }
      delete board[move.from];
      board[move.to] = move.promote ? '+' + p.replace('+', '') : p;
    }
    return { board, hands, turn: opponent(state.turn) };
  }

  /** 指定マスから動かす合法手（成り／不成を分けて返す） */
  function legalMovesFrom(state, from, sh = BIG) {
    const p = state.board[from];
    if (!p || colorOf(p) !== state.turn) return [];
    const out = [];
    for (const to of pseudoMoves(state.board, from, sh)) {
      const forced = mustPromote(p, to, sh);
      const may = canPromote(p, from, to, sh);
      const variants = forced ? [true] : may ? [false, true] : [false];
      for (const promote of variants) {
        const next = applyMove(state, { from, to, promote }, sh);
        if (!inCheck(next.board, state.turn, sh)) out.push({ from, to, promote });
      }
    }
    return out;
  }

  /** 打てるマス（二歩・行き所なし・打ち歩詰めを除外） */
  function legalDrops(state, kind, sh = BIG) {
    const c = state.turn;
    if (!state.hands[c]?.[kind]) return [];
    const out = [];
    const pawnFiles = new Set();
    if (kind === 'P') {
      for (const [s, p] of Object.entries(state.board)) {
        if (baseOf(p) === 'P' && !isPromoted(p) && colorOf(p) === c) pawnFiles.add(idx(s)[0]);
      }
    }
    // 打つ手は自玉の利きを開けないので、王手されていなければ「王手放置」の確認は要らない
    const checked = inCheck(state.board, c, sh);
    // 打ち歩詰めになりうるのは、相手玉の真正面に打つときだけ
    const foeKing = kind === 'P' ? findKing(state.board, opponent(c)) : null;
    const pawnCheckSq = foeKing
      ? sq(idx(foeKing)[0], idx(foeKing)[1] + (c === 'b' ? 1 : -1)) : null;
    for (const s of squaresOf(sh)) {
      if (state.board[s]) continue;
      const [f] = idx(s);
      if (kind === 'P' && pawnFiles.has(f)) continue;               // 二歩
      if (mustPromote(cased(kind, c), s, sh)) continue;             // 行き所のない駒
      const next = checked || s === pawnCheckSq ? applyMove(state, { drop: kind, to: s }, sh) : null;
      if (checked && inCheck(next.board, c, sh)) continue;          // 自玉が王手のまま
      if (s === pawnCheckSq && isMate(next, sh)) continue;          // 打ち歩詰め
      out.push(s);
    }
    return out;
  }

  function allLegalMoves(state, sh = BIG) {
    const out = [];
    for (const [s, p] of Object.entries(state.board)) {
      if (colorOf(p) === state.turn) out.push(...legalMovesFrom(state, s, sh));
    }
    for (const k of Object.keys(state.hands[state.turn] || {})) {
      for (const to of legalDrops(state, k, sh)) out.push({ drop: k, to });
    }
    return out;
  }

  /** state.turn 側が詰んでいるか */
  function isMate(state, sh = BIG) {
    if (!inCheck(state.board, state.turn, sh)) return false;
    return allLegalMoves(state, sh).length === 0;
  }
  function gameStatus(state, sh = BIG) {
    const moves = allLegalMoves(state, sh);
    if (!moves.length) return inCheck(state.board, state.turn, sh) ? 'checkmate' : 'stuck';
    return inCheck(state.board, state.turn, sh) ? 'check' : 'playing';
  }
  function findMateIn1(state, sh = BIG) {
    return allLegalMoves(state, sh).filter((m) => isMate(applyMove(state, m, sh), sh));
  }

  function moveLabel(state, move, sh = BIG) {
    const [f, r] = idx(move.to);
    const jp = '一二三四五六七八九'[r - 1];
    if (move.drop) return `${f}${jp}${PIECE_JA[move.drop]}打`;
    const piece = state.board[move.from];
    // 成れるのに成らなかった手は「不成」と書く（成る手と区別できるように）
    const promo = move.promote ? '成' : canPromote(piece, move.from, move.to, sh) ? '不成' : '';
    return `${f}${jp}${PIECE_JA[kindOf(piece)]}${promo}`;
  }

  /**
   * レッスン内の対局相手。浅い読み＋少しの揺らぎ。
   * 持ち駒があると手の数が一気に増えるので、反復深化＋持ち時間（timeMs）で打ち切る。
   */
  function pickMove(state, sh = BIG, depth = 2, timeMs = 900) {
    const me = state.turn;
    const moves = allLegalMoves(state, sh);
    if (!moves.length) return null;
    const score = (st) => {
      let s = 0;
      for (const p of Object.values(st.board)) s += (colorOf(p) === me ? 1 : -1) * PIECE_VALUE[kindOf(p)];
      for (const [c, h] of Object.entries(st.hands)) {
        for (const [k, n] of Object.entries(h)) s += (c === me ? 1 : -1) * PIECE_VALUE[k] * n;
      }
      return s;
    };
    // 取る手・成る手を先に、打つ手は後に
    const order = (st, ms) => ms.map((m) => {
      const cap = !m.drop && st.board[m.to] ? PIECE_VALUE[kindOf(st.board[m.to])] * 10 : 0;
      return { m, k: cap + (m.promote ? 5 : 0) - (m.drop ? 1 : 0) };
    }).sort((x, y) => y.k - x.k).map((x) => x.m);
    const deadline = Date.now() + timeMs;
    const TIMEOUT = {};
    let nodes = 0;
    const search = (st, d, alpha, beta) => {
      if ((++nodes & 255) === 0 && Date.now() > deadline) throw TIMEOUT;
      if (d === 0) {
        // 末端では合法手を作らない（持ち駒があると非常に重い）。王手がかかっているときだけ詰みかを確かめる
        if (inCheck(st.board, st.turn, sh) && !allLegalMoves(st, sh).length) return st.turn === me ? -9999 : 9999;
        return score(st);
      }
      const ms = allLegalMoves(st, sh);
      if (!ms.length) return st.turn === me ? -9999 - d : 9999 + d;
      if (st.turn === me) {
        let best = -Infinity;
        for (const m of order(st, ms)) {
          best = Math.max(best, search(applyMove(st, m, sh), d - 1, alpha, beta));
          alpha = Math.max(alpha, best);
          if (beta <= alpha) break;
        }
        return best;
      }
      let best = Infinity;
      for (const m of order(st, ms)) {
        best = Math.min(best, search(applyMove(st, m, sh), d - 1, alpha, beta));
        beta = Math.min(beta, best);
        if (beta <= alpha) break;
      }
      return best;
    };
    const JITTER = 0.5;
    let result = null;
    let rootOrder = order(state, moves);
    for (let d = 1; d <= depth; d++) {
      let best = null, bestV = -Infinity;
      const scored = [];
      try {
        for (const m of rootOrder) {
          const floor = bestV === -Infinity ? -Infinity : bestV - JITTER - 0.01;
          const raw = search(applyMove(state, m, sh), d - 1, floor, Infinity);
          const v = raw + Math.random() * JITTER;
          scored.push({ m, raw });
          if (v > bestV) { bestV = v; best = m; }
        }
      } catch (e) {
        if (e !== TIMEOUT) throw e;
        if (!result) result = best || moves[0];
        break;
      }
      result = best;
      rootOrder = scored.sort((x, y) => y.raw - x.raw).map((x) => x.m);
    }
    return result;
  }

  // --- 初期配置 -------------------------------------------------------------
  function startBig() {
    const b = {};
    const back = { 1: 'L', 2: 'N', 3: 'S', 4: 'G', 5: 'K', 6: 'G', 7: 'S', 8: 'N', 9: 'L' };
    for (let f = 1; f <= 9; f++) {
      b[sq(f, 1)] = back[f].toLowerCase();
      b[sq(f, 3)] = 'p';
      b[sq(f, 7)] = 'P';
      b[sq(f, 9)] = back[f];
    }
    b['22'] = 'b'; b['82'] = 'r'; b['88'] = 'B'; b['28'] = 'R';
    return { board: b, hands: emptyHands(), turn: 'b' };
  }
  /** 5五将棋: 玉金銀角飛歩（標準の初期配置。先後は点対称） */
  function startGogo() {
    const b = {
      '51': 'r', '41': 'b', '31': 's', '21': 'g', '11': 'k', '12': 'p',
      '55': 'K', '45': 'G', '35': 'S', '25': 'B', '15': 'R', '54': 'P',
    };
    return { board: b, hands: emptyHands(), turn: 'b' };
  }
  /** ミニ将棋 3×4: 玉・金・銀・歩。持ち駒も成りもある、いちばん小さな「本物」 */
  function startMini() {
    const b = {
      '11': 'g', '21': 'k', '31': 's', '22': 'p',
      '23': 'P', '14': 'S', '24': 'K', '34': 'G',
    };
    return { board: b, hands: emptyHands(), turn: 'b' };
  }

  /**
   * 手番側が王手の連続で n 手（奇数）以内に詰ませられる初手を探す。
   * 見つかれば手、ないと分かれば null、時間切れで分からなければ undefined。
   */
  function findMateIn(state, n = 3, sh = BIG, timeMs = 300) {
    const deadline = Date.now() + timeMs;
    const TO = {};
    const memo = new Map();
    const search = (st, k) => {
      if (Date.now() > deadline) throw TO;
      const key = k + st.turn + JSON.stringify(st.board) + JSON.stringify(st.hands);
      if (memo.has(key)) return memo.get(key);
      let hit = null;
      for (const mv of allLegalMoves(st, sh)) {
        const s1 = applyMove(st, mv, sh);
        if (!inCheck(s1.board, opponent(st.turn), sh)) continue;
        const reps = allLegalMoves(s1, sh);
        if (!reps.length) { hit = mv; break; }
        if (k > 1 && reps.every((r) => search(applyMove(s1, r, sh), k - 2))) { hit = mv; break; }
      }
      memo.set(key, hit);
      return hit;
    };
    try { return search(state, n); } catch (e) { if (e === TO) return undefined; throw e; }
  }
  /** 相手の番の局面で、相手が王手を受けても必ず1手詰めが残るか（詰みの手順が続いているか） */
  function stillMating(state, sh = BIG) {
    if (!inCheck(state.board, state.turn, sh)) return false;
    const reps = allLegalMoves(state, sh);
    return reps.length > 0 && reps.every((r) => findMateIn1(applyMove(state, r, sh), sh).length > 0);
  }

  return { findMateIn, stillMating, PIECE_JA, PIECE_NAME, HAND_ORDER, PIECE_VALUE, sq, idx, colorOf, baseOf, kindOf, isPromoted, opponent, shape, BIG, GOGO, MINI, squaresOf, pseudoMoves, emptyHands, cloneHands, findKing, isAttacked, inCheck, canPromote, mustPromote, applyMove, legalMovesFrom, legalDrops, allLegalMoves, isMate, gameStatus, findMateIn1, moveLabel, pickMove, startBig, startGogo, startMini };
};
const NS_SHOGI = SHOGI_FACTORY();

// ── js/games/go.js ──────────────────────────────────────────
const GO_FACTORY = () => {

  // go.js — 囲碁のルール判定・形の読み・死活の読み・対局相手。
  // 盤は文字列で持つ（'.' 空き・'X' 黒・'O' 白）。添字は i = y*n + x（y=0 が上辺、x=0 が左辺）。
  // 文字列なので、そのまま比べたり、Worker に送ったり、保存したりできる。
  // 画面には触らない（Worker の中でも同じコードを動かす）。

  const KANJI = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九'];
  const other = (c) => (c === 'X' ? 'O' : 'X');
  const COLOR_JA = { X: '黒', O: '白' };
  /** 点の名前（日本式：横は左から 1, 2, 3…、縦は上から 一, 二, 三…。例「3の三」） */
  const ptName = (n, i) => (i < 0 ? 'パス' : `${(i % n) + 1}の${KANJI[(i / n) | 0]}`);

  const NBR = {}, DIAG = {};
  function nbr(n) {
    if (NBR[n]) return NBR[n];
    const a = [];
    for (let i = 0; i < n * n; i++) {
      const x = i % n, y = (i / n) | 0, l = [];
      if (y > 0) l.push(i - n);
      if (x > 0) l.push(i - 1);
      if (x < n - 1) l.push(i + 1);
      if (y < n - 1) l.push(i + n);
      a.push(l);
    }
    return (NBR[n] = a);
  }
  function diag(n) {
    if (DIAG[n]) return DIAG[n];
    const a = [];
    for (let i = 0; i < n * n; i++) {
      const x = i % n, y = (i / n) | 0, l = [];
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const X = x + dx, Y = y + dy;
        if (X >= 0 && X < n && Y >= 0 && Y < n) l.push(Y * n + X);
      }
      a.push(l);
    }
    return (DIAG[n] = a);
  }

  /**
   * 図（行の配列）を読む。
   * 'X' 黒・'O' 白・'.' 空き・',' 空き（問題の範囲外。死活の読みではここに打たない）・英小文字 空き（印つき。x と o は使わない）
   * 行の中の空白は無視する（見やすく書くため）。
   */
  function parse(rows) {
    const clean = rows.map((r) => r.replace(/\s+/g, ''));
    const n = clean.length;
    let s = '';
    const area = [], labels = {}, outside = [];
    clean.forEach((row, y) => {
      if (row.length !== n) throw new Error(`盤の行の長さが違います（${y + 1}行目）: ${row}`);
      for (let x = 0; x < n; x++) {
        const ch = row[x], i = y * n + x;
        if (ch === 'X' || ch === 'O') { s += ch; continue; }
        s += '.';
        if (ch !== ',') area.push(i); else outside.push(i);
        if (/^[a-np-wyz]$/.test(ch)) labels[ch] = i;
        else if (ch !== '.' && ch !== ',' && ch !== '+') throw new Error(`盤に使えない文字があります: ${ch}`);
      }
    });
    return { n, s, area, labels, outside };
  }
  /** 盤の文字列を行の配列に戻す（保存用・確認用） */
  const rowsOf = (n, s) => Array.from({ length: n }, (_, y) => s.slice(y * n, y * n + n));

  /** つながった石と、その呼吸点 */
  function group(s, n, i) {
    const c = s[i];
    if (c !== 'X' && c !== 'O') return null;
    const N = nbr(n), seen = new Uint8Array(n * n), lseen = new Uint8Array(n * n);
    const stones = [i], libs = [];
    seen[i] = 1;
    for (let k = 0; k < stones.length; k++) {
      for (const j of N[stones[k]]) {
        const v = s[j];
        if (v === c) { if (!seen[j]) { seen[j] = 1; stones.push(j); } }
        else if (v === '.' && !lseen[j]) { lseen[j] = 1; libs.push(j); }
      }
    }
    return { color: c, stones, libs };
  }
  /** 盤上のすべての石のかたまり（重複なし） */
  function groups(s, n, color = null) {
    const seen = new Uint8Array(n * n), out = [];
    for (let i = 0; i < n * n; i++) {
      if (seen[i] || s[i] === '.' || (color && s[i] !== color)) continue;
      const g = group(s, n, i);
      for (const k of g.stones) seen[k] = 1;
      out.push(g);
    }
    return out;
  }

  /**
   * 1手打つ。打てれば { s, captured, ko }、打てなければ { illegal: 'occupied' | 'suicide' | 'ko' }。
   * ko はコウで「次の手番の人がすぐには打てない点」（なければ -1）。
   */
  function play(s, n, i, c, ko = -1) {
    if (i < 0 || i >= n * n) return { illegal: 'occupied' };
    if (s[i] !== '.') return { illegal: 'occupied' };
    if (i === ko) return { illegal: 'ko' };
    const N = nbr(n), o = other(c);
    const arr = s.split('');
    arr[i] = c;
    const t = arr.join('');
    let cur = t;
    const captured = [];
    for (const j of N[i]) {
      if (cur[j] !== o) continue;
      const g = group(cur, n, j);
      if (g.libs.length) continue;
      const a2 = cur.split('');
      for (const k of g.stones) { a2[k] = '.'; captured.push(k); }
      cur = a2.join('');
    }
    const me = group(cur, n, i);
    if (!me.libs.length) return { illegal: 'suicide' };
    // コウ：1個だけ取り、打った石が単独で呼吸点1つ（＝取った点）なら、相手はすぐには取り返せない
    const nko = captured.length === 1 && me.stones.length === 1 && me.libs.length === 1 ? captured[0] : -1;
    return { s: cur, captured, ko: nko };
  }
  const isLegal = (s, n, i, c, ko = -1) => !play(s, n, i, c, ko).illegal;
  function legalMoves(s, n, c, ko = -1, area = null) {
    const out = [];
    for (const i of area || Array.from({ length: n * n }, (_, k) => k)) if (s[i] === '.' && isLegal(s, n, i, c, ko)) out.push(i);
    return out;
  }

  /** 対局の状態 { n, s, turn, ko, caps: { X, O }, passes, moves } に1手（i = -1 はパス）を加える。打てなければ null */
  function apply(st, i) {
    if (i < 0) return { ...st, turn: other(st.turn), ko: -1, passes: (st.passes || 0) + 1, moves: (st.moves || 0) + 1, last: -1 };
    const r = play(st.s, st.n, i, st.turn, st.ko);
    if (r.illegal) return null;
    const caps = { ...st.caps };
    caps[st.turn] = (caps[st.turn] || 0) + r.captured.length;
    return { ...st, s: r.s, turn: other(st.turn), ko: r.ko, caps, passes: 0, moves: (st.moves || 0) + 1, last: i, captured: r.captured };
  }
  const newGame = (n, turn = 'X') => ({ n, s: '.'.repeat(n * n), turn, ko: -1, caps: { X: 0, O: 0 }, passes: 0, moves: 0, last: -1 });

  /** 自分の石だけに囲まれた空き点か（眼の形）。端では斜めに相手の石が1つでもあれば欠け眼 */
  function eyeLike(s, n, i, c) {
    if (s[i] !== '.') return false;
    for (const j of nbr(n)[i]) if (s[j] !== c) return false;
    const D = diag(n)[i];
    let bad = 0;
    for (const j of D) if (s[j] === other(c)) bad++;
    return D.length < 4 ? bad === 0 : bad < 2;
  }

  // ── 地を数える ───────────────────────────────────────────
  /** 空き点のまとまりと、それに接する石の色 */
  function regions(s, n) {
    const N = nbr(n), seen = new Uint8Array(n * n), out = [];
    for (let i = 0; i < n * n; i++) {
      if (seen[i] || s[i] !== '.') continue;
      const pts = [i], border = new Set();
      seen[i] = 1;
      for (let k = 0; k < pts.length; k++) {
        for (const j of N[pts[k]]) {
          if (s[j] === '.') { if (!seen[j]) { seen[j] = 1; pts.push(j); } }
          else border.add(s[j]);
        }
      }
      out.push({ pts, owner: border.size === 1 ? [...border][0] : null });
    }
    return out;
  }
  /**
   * 日本ルールの計算。dead は死に石の添字（配列か Set）。
   * 黒 ＝ 黒の地 ＋ 黒が取った石 ＋ 白の死に石、白 ＝ 白の地 ＋ 白が取った石 ＋ 黒の死に石 ＋ コミ。
   * map は点ごとの持ち主（'X' / 'O' / null）。死に石の点は取った側の地になる。
   */
  function score(st, dead = [], komi = 6.5) {
    const n = st.n, arr = st.s.split('');
    const deadSet = new Set(dead);
    const deadN = { X: 0, O: 0 };
    for (const i of deadSet) { if (arr[i] === 'X' || arr[i] === 'O') { deadN[arr[i]]++; arr[i] = '.'; } }
    const s2 = arr.join('');
    const terr = { X: 0, O: 0 }, map = new Array(n * n).fill(null);
    for (const r of regions(s2, n)) {
      if (!r.owner) continue;
      terr[r.owner] += r.pts.length;
      for (const p of r.pts) map[p] = r.owner;
    }
    const caps = { X: st.caps?.X || 0, O: st.caps?.O || 0 };
    const black = terr.X + caps.X + deadN.O;
    const white = terr.O + caps.O + deadN.X + komi;
    return { terr, caps, dead: deadN, komi, black, white, diff: black - white, map };
  }
  /** 結果の言い方（例「黒の3目半勝ち」） */
  function resultText(diff) {
    if (diff === 0) return '持碁（引き分け）';
    const a = Math.abs(diff), whole = Math.floor(a), half = a - whole >= 0.5;
    return `${diff > 0 ? '黒' : '白'}の${whole ? `${whole}目` : ''}${half ? '半' : ''}勝ち`;
  }

  // ── 無条件の生き（Benson の判定） ─────────────────────────
  /** 相手がどう打っても（自分がパスし続けても）取られない石の添字の集合 */
  function bensonAlive(s, n, c) {
    const N = nbr(n);
    const chainOf = new Int32Array(n * n).fill(-1), chains = [];
    for (let i = 0; i < n * n; i++) {
      if (s[i] !== c || chainOf[i] >= 0) continue;
      const g = group(s, n, i), id = chains.length;
      for (const k of g.stones) chainOf[k] = id;
      chains.push({ stones: g.stones, libs: new Set(g.libs) });
    }
    if (!chains.length) return new Set();
    const regOf = new Int32Array(n * n).fill(-1), regs = [];
    for (let i = 0; i < n * n; i++) {
      if (s[i] === c || regOf[i] >= 0) continue;
      const id = regs.length, pts = [i], adj = new Set();
      regOf[i] = id;
      for (let k = 0; k < pts.length; k++) {
        for (const j of N[pts[k]]) {
          if (s[j] === c) adj.add(chainOf[j]);
          else if (regOf[j] < 0) { regOf[j] = id; pts.push(j); }
        }
      }
      regs.push({ pts, empties: pts.filter((p) => s[p] === '.'), adj });
    }
    const X = new Set(chains.map((_, k) => k)), R = new Set(regs.map((_, k) => k));
    const healthy = (r, x) => regs[r].empties.every((p) => chains[x].libs.has(p));
    for (let changed = true; changed;) {
      changed = false;
      for (const x of [...X]) {
        let h = 0;
        for (const r of R) if (regs[r].adj.has(x) && healthy(r, x)) h++;
        if (h < 2) { X.delete(x); changed = true; }
      }
      for (const r of [...R]) {
        for (const x of regs[r].adj) if (!X.has(x)) { R.delete(r); changed = true; break; }
      }
    }
    const out = new Set();
    for (const x of X) for (const k of chains[x].stones) out.add(k);
    return out;
  }

  // ── 形の読み（アタリ・シチョウ・ゲタ・ウッテガエシ・オイオトシ） ─────────
  // 呼吸点が2つまでの石について、取れるか・助かるかを読む。呼吸点が3つになったら「逃げた」とみなす。
  const READ_DEPTH = 60;
  /** 攻め方の手番で、target の石を取れるか */
  function canCapture(s, n, target, ko = -1, bud = { left: 30000 }, depth = 0) {
    const g = group(s, n, target);
    if (!g) return true;
    const ac = other(g.color);
    if (g.libs.length === 1) return g.libs[0] !== ko && isLegal(s, n, g.libs[0], ac, ko);
    if (g.libs.length > 2 || depth > READ_DEPTH || --bud.left < 0) return false;
    for (const m of g.libs) {
      const r = play(s, n, m, ac, ko);
      if (r.illegal) continue;
      if (r.s[target] !== g.color) return true;
      if (!canSave(r.s, n, target, r.ko, bud, depth + 1)) return true;
    }
    return false;
  }
  /** 守り方の手番で、target の石を助けられるか（何もしなくても取られないなら true） */
  function canSave(s, n, target, ko = -1, bud = { left: 30000 }, depth = 0) {
    const g = group(s, n, target);
    if (!g) return false;
    if (g.libs.length >= 3 || depth > READ_DEPTH || --bud.left < 0) return true;
    const dc = g.color;
    // 呼吸点が2つなら、手を抜いても取られないか
    if (g.libs.length === 2 && !canCapture(s, n, target, -1, bud, depth + 1)) return true;
    const cands = [];
    // 接している相手の石で、呼吸点が1つのものを取る
    const seen = new Set();
    for (const k of g.stones) {
      for (const j of nbr(n)[k]) {
        if (s[j] !== other(dc) || seen.has(j)) continue;
        const h = group(s, n, j);
        for (const q of h.stones) seen.add(q);
        if (h.libs.length === 1) cands.push(h.libs[0]);
      }
    }
    for (const l of g.libs) cands.push(l);
    for (const m of [...new Set(cands)]) {
      const r = play(s, n, m, dc, ko);
      if (r.illegal) continue;
      const g2 = group(r.s, n, target);
      if (g2.libs.length >= 3) return true;
      if (g2.libs.length === 1) {
        // 呼吸点1つでも、そこが相手にとってコウで打てない点なら次は取られない
        if (g2.libs[0] === r.ko || !isLegal(r.s, n, g2.libs[0], other(dc), r.ko)) {
          if (!canCapture(r.s, n, target, -1, bud, depth + 1)) return true;
        }
        continue;
      }
      if (!canCapture(r.s, n, target, r.ko, bud, depth + 1)) return true;
    }
    return false;
  }
  /** 攻め方の手番で取れる手（1つ目の手）を全部 */
  function captureMoves(s, n, target, ko = -1) {
    const g = group(s, n, target);
    if (!g) return [];
    const ac = other(g.color), out = [];
    const cands = new Set(g.libs);
    // ゲタ：呼吸点の隣の点も候補にする
    for (const l of g.libs) for (const j of nbr(n)[l]) if (s[j] === '.') cands.add(j);
    for (const l of g.libs) for (const j of diag(n)[l]) if (s[j] === '.') cands.add(j);
    for (const m of cands) {
      const r = play(s, n, m, ac, ko);
      if (r.illegal) continue;
      if (r.s[target] !== g.color || !canSave(r.s, n, target, r.ko)) out.push(m);
    }
    return out;
  }
  /** 守り方の手番で助かる手を全部 */
  function saveMoves(s, n, target, ko = -1) {
    const g = group(s, n, target);
    if (!g) return [];
    const out = [];
    for (let m = 0; m < n * n; m++) {
      if (s[m] !== '.') continue;
      const r = play(s, n, m, g.color, ko);
      if (r.illegal) continue;
      if (!canCapture(r.s, n, target, r.ko)) out.push(m);
    }
    return out;
  }

  /**
   * 取られそうな石の側の応手（取る問題で、相手がいちばん粘る手）。
   * 逃げ切れる手があればそれ、なければ呼吸点がいちばん多くなる手。打てる手がなければ -1
   */
  function defendReply(s, n, target, ko = -1) {
    const g = group(s, n, target);
    if (!g) return -1;
    const dc = g.color, cands = new Set(g.libs);
    for (const k of g.stones) {
      for (const j of nbr(n)[k]) {
        if (s[j] !== other(dc)) continue;
        const h = group(s, n, j);
        if (h.libs.length === 1) cands.add(h.libs[0]);
      }
    }
    let best = -1, bs = -1e9;
    for (const m of cands) {
      const r = play(s, n, m, dc, ko);
      if (r.illegal) continue;
      const g2 = group(r.s, n, target);
      const sc = (canCapture(r.s, n, target, r.ko) ? 0 : 1000) + g2.libs.length * 10 + r.captured.length * 5 + g2.stones.length;
      if (sc > bs) { bs = sc; best = m; }
    }
    return best;
  }

  // ── 死活の読み ─────────────────────────────────────────
  /**
   * area（打てる点）の中だけで、黒白が交互に打つ（パスあり）。
   * target の石が取られれば攻め方の勝ち、無条件の生き（二眼）になれば守り方の勝ち。
   * 両者がパスで終わったとき（セキなど、取られずに残ったとき）は守り方の勝ち。
   * 返り値：手番の側が勝てるか。読み切れないとき（時間切れ・深すぎ）は pov の側の負けとして扱う。
   */
  function solveLD(s, n, { target, area, toMove, ko = -1, pov = toMove, limitMs = 4000, maxNodes = 400000 }) {
    const dc = s[target];
    if (dc !== 'X' && dc !== 'O') return toMove !== dc;
    const ac = other(dc);
    const memo = new Map(), path = new Set();
    const t0 = Date.now();
    let nodes = 0, broke = false;
    const maxDepth = area.length * 2 + 6;
    const pts = [...area];
    function rec(s, ko, tm, passed, depth) {
      if (s[target] !== dc) return tm === ac;
      if (bensonAlive(s, n, dc).has(target)) return tm === dc;
      if (depth > maxDepth || broke) { broke = true; return tm !== pov; }
      if ((++nodes & 1023) === 0 && (Date.now() - t0 > limitMs || nodes > maxNodes)) { broke = true; return tm !== pov; }
      const key = s + tm + ko + (passed ? 'p' : '');
      if (memo.has(key)) return memo.get(key);
      let win = false;
      for (const m of pts) {
        if (s[m] !== '.' || eyeLike(s, n, m, tm)) continue;
        const r = play(s, n, m, tm, ko);
        if (r.illegal) continue;
        const pk = r.s + tm;
        if (path.has(pk)) continue;   // 同じ局面のくり返しは打たない
        path.add(pk);
        const child = rec(r.s, r.ko, other(tm), false, depth + 1);
        path.delete(pk);
        if (!child) { win = true; break; }
      }
      if (!win) {
        if (passed) win = tm === dc;   // 両者パス：取られずに残ったので守り方の勝ち
        else win = !rec(s, -1, other(tm), true, depth + 1);
      }
      if (!broke) memo.set(key, win);
      return win;
    }
    const res = rec(s, ko, toMove, false, 0);
    return broke ? { win: toMove !== pov, unsure: true } : { win: res, unsure: false };
  }
  /** 死活：手番の側が勝てる1手目を全部（area の中、パスは含めない） */
  function ldWinningMoves(s, n, { target, area, toMove, ko = -1, limitMs = 4000 }) {
    const out = [];
    for (const m of area) {
      if (s[m] !== '.') continue;
      const r = play(s, n, m, toMove, ko);
      if (r.illegal) continue;
      const res = solveLD(r.s, n, { target, area, toMove: other(toMove), ko: r.ko, pov: toMove, limitMs });
      if (!res.win && !res.unsure) out.push(m);
    }
    return out;
  }
  /**
   * 死活の問題での相手の応手。負けが決まっていても、いちばん粘る手（相手に正しく応じさせる手）を選ぶ。
   * 勝てる手があればそれを選ぶ。
   */
  function ldReply(s, n, { target, area, toMove, ko = -1 }) {
    let best = -1, bestScore = -1;
    for (const m of area) {
      if (s[m] !== '.' || eyeLike(s, n, m, toMove)) continue;
      const r = play(s, n, m, toMove, ko);
      if (r.illegal) continue;
      const res = solveLD(r.s, n, { target, area, toMove: other(toMove), ko: r.ko, pov: toMove, limitMs: 1500 });
      if (!res.win && !res.unsure) return m;   // 勝てる手
      // 粘る手：この手のあと相手がパスしたら、こちらが勝てる（＝相手に応じさせる手）
      const threat = solveLD(r.s, n, { target, area, toMove, ko: -1, pov: toMove, limitMs: 800 });
      const gt = group(r.s, n, target);
      let sc = (threat.win ? 10 : 0) + r.captured.length * 3;
      if (gt) sc += toMove === s[target] ? gt.libs.length : 6 - Math.min(6, gt.libs.length);
      if (nbr(n)[m].some((j) => r.s[j] === s[target])) sc += 1;
      if (sc > bestScore) { bestScore = sc; best = m; }
    }
    return best;
  }

  // ── 3×3 の形（MoGo 型の着手パターン） ─────────────────────
  // 乱打ちのとき、直前の手のまわり8点のうち「ハネ・キリ・辺の形」になる空き点を優先する。
  // 形は黒白どちらにとっても良い手として扱い、回転・反転・色の入れ替えをすべて表に入れる。
  // 記号：X・O は石、'.' 空き、'#' 盤の外、'?' 何でも、x は「Xでない」、o は「Oでない」
  const PAT_SRC = [
    ['XOX', '...', '???'], ['XO.', '...', '?.?'], ['XO?', 'X..', 'x.?'], ['.O.', 'X..', '...'],
    ['XO?', 'O.o', '?o?'], ['XO?', 'O.X', '???'], ['?X?', 'O.O', 'ooo'], ['OX?', 'o.O', '???'],
    ['X.?', 'O.?', '##?'], ['OX?', 'X.O', '###'], ['?X?', 'x.O', '###'], ['?XO', 'x.x', '###'], ['?OX', 'X.O', '###'],
  ];
  const PAT = (() => {
    const tab = new Uint8Array(65536);
    const rot = (p) => [p[2][0] + p[1][0] + p[0][0], p[2][1] + p[1][1] + p[0][1], p[2][2] + p[1][2] + p[0][2]];
    const flip = (p) => p.map((r) => r.split('').reverse().join(''));
    const swap = (p) => p.map((r) => r.replace(/[XOxo]/g, (c) => ({ X: 'O', O: 'X', x: 'o', o: 'x' })[c]));
    const sets = { '.': [0], X: [1], O: [2], '#': [3], '?': [0, 1, 2, 3], x: [0, 2, 3], o: [0, 1, 3] };
    const add = (p) => {
      const cells = [p[0][0], p[0][1], p[0][2], p[1][0], p[1][2], p[2][0], p[2][1], p[2][2]];
      const rec = (k, code) => { if (k === 8) { tab[code] = 1; return; } for (const v of sets[cells[k]]) rec(k + 1, code + v * 4 ** k); };
      rec(0, 0);
    };
    for (const src of PAT_SRC) {
      let p = src;
      for (let r = 0; r < 4; r++) { for (const q of [p, flip(p)]) { add(q); add(swap(q)); } p = rot(p); }
    }
    return tab;
  })();

  // ── 対局相手（モンテカルロ木探索） ───────────────────────
  // 速さのために、縁つきの配列で盤を持つ（0 空き・1 黒・2 白・3 盤の外）。
  function xorshift(seed) {
    let x = (seed >>> 0) || 0x9e3779b9;
    return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
  }
  class Fast {
    constructor(n) {
      this.n = n;
      const W = this.W = n + 2;
      this.cell = new Uint8Array(W * W).fill(3);
      this.pts = [];
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const p = (y + 1) * W + x + 1; this.cell[p] = 0; this.pts.push(p); }
      this.mark = new Uint32Array(W * W); this.gen = 1;
      this.lmark = new Uint32Array(W * W); this.lgen = 1;
      this.stack = new Int32Array(W * W);
      this.dirs = [1, -1, W, -W];
      this.diags = [W + 1, W - 1, -W + 1, -W - 1];
      this.ko = 0; this.caps = [0, 0, 0]; this.lastLib = 0; this.size = 0;
    }
    i2p(i) { return (((i / this.n) | 0) + 1) * this.W + (i % this.n) + 1; }
    p2i(p) { return (((p / this.W) | 0) - 1) * this.n + (p % this.W) - 1; }
    load(st) {
      for (let i = 0; i < this.n * this.n; i++) this.cell[this.i2p(i)] = st.s[i] === 'X' ? 1 : st.s[i] === 'O' ? 2 : 0;
      this.ko = st.ko >= 0 ? this.i2p(st.ko) : 0;
      this.caps[1] = st.caps?.X || 0; this.caps[2] = st.caps?.O || 0;
    }
    copy(o) { this.cell.set(o.cell); this.ko = o.ko; this.caps[1] = o.caps[1]; this.caps[2] = o.caps[2]; }
    /** 呼吸点を max 個まで数える。1つだけのときは this.lastLib にその点、this.size に石の数 */
    libs(p, max = 99) {
      const cell = this.cell, st = this.stack, mark = this.mark, lmark = this.lmark, dirs = this.dirs;
      const c = cell[p], g = ++this.gen, lg = ++this.lgen;
      let sp = 0, count = 0, size = 1;
      st[sp++] = p; mark[p] = g;
      while (sp) {
        const q = st[--sp];
        for (let d = 0; d < 4; d++) {
          const r = q + dirs[d], v = cell[r];
          if (v === 0) { if (lmark[r] !== lg) { lmark[r] = lg; this.lastLib = r; if (++count >= max) { this.size = size; return count; } } }
          else if (v === c && mark[r] !== g) { mark[r] = g; st[sp++] = r; size++; }
        }
      }
      this.size = size;
      return count;
    }
    remove(p) {
      const cell = this.cell, st = this.stack, dirs = this.dirs, c = cell[p];
      let sp = 0, cnt = 1;
      st[sp++] = p; cell[p] = 0;
      while (sp) {
        const q = st[--sp];
        for (let d = 0; d < 4; d++) { const r = q + dirs[d]; if (cell[r] === c) { cell[r] = 0; st[sp++] = r; cnt++; } }
      }
      return cnt;
    }
    legal(p, c) {
      const cell = this.cell, dirs = this.dirs;
      if (cell[p] !== 0 || p === this.ko) return false;
      for (let d = 0; d < 4; d++) if (cell[p + dirs[d]] === 0) return true;
      for (let d = 0; d < 4; d++) {
        const r = p + dirs[d], v = cell[r];
        if (v === c) { if (this.libs(r, 2) >= 2) return true; }
        else if (v === 3 - c) { if (this.libs(r, 2) === 1) return true; }
      }
      return false;
    }
    play(p, c) {
      const cell = this.cell, dirs = this.dirs, o = 3 - c;
      cell[p] = c;
      let cap = 0, capAt = 0;
      for (let d = 0; d < 4; d++) {
        const r = p + dirs[d];
        if (cell[r] === o && this.libs(r, 1) === 0) { capAt = r; cap += this.remove(r); }
      }
      this.ko = 0;
      if (cap === 1) {
        let single = true;
        for (let d = 0; d < 4; d++) if (cell[p + dirs[d]] === c) { single = false; break; }
        if (single && this.libs(p, 2) === 1) this.ko = capAt;
      }
      this.caps[c] += cap;
      return cap;
    }
    eyeish(p, c) {
      const cell = this.cell;
      for (let d = 0; d < 4; d++) { const v = cell[p + this.dirs[d]]; if (v !== c && v !== 3) return false; }
      let bad = 0, edge = 0;
      for (let d = 0; d < 4; d++) { const v = cell[p + this.diags[d]]; if (v === 3) edge = 1; else if (v === 3 - c) bad++; }
      return bad + edge < 2;
    }
    /** p に c を打つと、自分の石（size 個以上）が呼吸点1つになるか（相手の石を取る手は除く） */
    selfAtari(p, c, minSize = 2) {
      const cell = this.cell, dirs = this.dirs, o = 3 - c;
      for (let d = 0; d < 4; d++) { const r = p + dirs[d]; if (cell[r] === o && this.libs(r, 2) === 1) return false; }
      cell[p] = c;
      const l = this.libs(p, 2), size = this.size;
      cell[p] = 0;
      return l <= 1 && size >= minSize;
    }
    /** 打ったあとの呼吸点の数（取れる石は考えない簡易版） */
    libsAfter(p, c) { this.cell[p] = c; const l = this.libs(p, 3); this.cell[p] = 0; return l; }
    /** 直前の手で生じたアタリへの対応（取る・逃げる） */
    tactical(c, last, rnd) {
      if (!last) return 0;
      const cell = this.cell, dirs = this.dirs, o = 3 - c;
      if (cell[last] === o && this.libs(last, 2) === 1) { const q = this.lastLib; if (this.legal(q, c)) return q; }
      const start = (rnd() * 4) | 0;
      for (let k = 0; k < 4; k++) {
        const r = last + dirs[(start + k) & 3];
        if (cell[r] !== c || this.libs(r, 2) !== 1) continue;
        const q = this.lastLib;
        // アタリの石に接する相手の石を取って助かるなら、それを優先する
        if (this.legal(q, c) && this.libsAfter(q, c) >= 2) return q;
      }
      return 0;
    }
    randomMove(c, rnd, buf, capture) {
      let k = 0;
      for (const p of this.pts) if (this.cell[p] === 0) buf[k++] = p;
      while (k) {
        const j = (rnd() * k) | 0, p = buf[j];
        buf[j] = buf[--k];
        if (!this.legal(p, c)) continue;
        if (!capture && this.eyeish(p, c)) continue;
        if (this.selfAtari(p, c, capture ? 1 : 2) && rnd() < 0.92) continue;
        return p;
      }
      return 0;
    }
    /** 点 p のまわり8点の並び（形の表を引く鍵） */
    pat3(p) {
      const c = this.cell, W = this.W;
      return c[p - W - 1] + 4 * c[p - W] + 16 * c[p - W + 1] + 64 * c[p - 1] + 256 * c[p + 1]
        + 1024 * c[p + W - 1] + 4096 * c[p + W] + 16384 * c[p + W + 1];
    }
    /** 直前の手のまわりで、良い形になる手（なければ 0） */
    patternMove(c, last, rnd) {
      const W = this.W, cell = this.cell, cand = this.cand || (this.cand = new Int32Array(8));
      let k = 0;
      for (const q of [last - W - 1, last - W, last - W + 1, last - 1, last + 1, last + W - 1, last + W, last + W + 1]) {
        if (cell[q] !== 0 || !PAT[this.pat3(q)]) continue;
        if (!this.legal(q, c) || this.selfAtari(q, c, 1)) continue;
        cand[k++] = q;
      }
      return k ? cand[(rnd() * k) | 0] : 0;
    }
    /** 盤を最後まで打ち切ったときの黒の目数 − 白の目数（石と眼を数える） */
    area() {
      const cell = this.cell, dirs = this.dirs;
      let b = 0, w = 0;
      for (const p of this.pts) {
        const v = cell[p];
        if (v === 1) b++;
        else if (v === 2) w++;
        else {
          let nb = 0, nw = 0;
          for (let d = 0; d < 4; d++) { const u = cell[p + dirs[d]]; if (u === 1) nb++; else if (u === 2) nw++; }
          if (nb && !nw) b++; else if (nw && !nb) w++;
        }
      }
      return b - w;
    }
  }

  /** 候補手の事前の見込み（少ない読みでも筋の良い手を選べるように） */
  function priorOf(fb, p, c, last, stones, capture) {
    const cell = fb.cell, dirs = fb.dirs, o = 3 - c, n = fb.n, W = fb.W;
    let pn = 10, pw = 5;
    let caps = 0, saves = false, ataris = 0;
    for (let d = 0; d < 4; d++) {
      const r = p + dirs[d], v = cell[r];
      if (v === o) {
        const l = fb.libs(r, 3);
        if (l === 1) caps += fb.size;
        else if (l === 2) ataris++;
      } else if (v === c && fb.libs(r, 2) === 1) saves = true;
    }
    if (caps) { pn += 20; pw += 14 + Math.min(6, caps); }
    if (saves && fb.libsAfter(p, c) >= 3) { pn += 20; pw += 17; }
    if (!caps && fb.selfAtari(p, c, capture ? 1 : 2)) { pn += 30; pw += 1; }
    if (capture && ataris) { pn += 10; pw += 7; }
    if (!capture && PAT[fb.pat3(p)]) { pn += 10; pw += 6.5; }
    const x = (p % W) - 1, y = ((p / W) | 0) - 1;
    const line = Math.min(x, y, n - 1 - x, n - 1 - y);
    if (!capture && n >= 7) {
      // 序盤は1線・2線を避ける（近くに石がないとき）
      let near = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const q = p + dy * W + dx;
        if (q >= 0 && q < cell.length && (cell[q] === 1 || cell[q] === 2)) near++;
      }
      if (line === 0 && near === 0) { pn += 20; pw += 2; }
      else if (line === 1 && near === 0 && stones < n) { pn += 10; pw += 3; }
      else if (stones < n && line >= 2 && line <= 3) { pn += 5; pw += 3.5; }
    }
    if (last) {
      const lx = (last % W) - 1, ly = ((last / W) | 0) - 1;
      if (Math.abs(lx - x) + Math.abs(ly - y) <= 2) { pn += 6; pw += 3.8; }
    }
    return [pn, pw];
  }

  class Node {
    constructor(move, color) {
      this.move = move; this.color = color;   // color はこの手を打った側
      this.N = 0; this.W = 0; this.pN = 0; this.pW = 0; this.rN = 0; this.rW = 0;
      this.kids = null;
    }
  }

  /**
   * 次の一手を考える。
   * mode: 'territory'（地の多い方が勝ち）／'capture'（先に target 個取った方が勝ち）
   * 返り値 { move: 添字（-1 はパス）, winrate, visits, owner }
   */
  function think({ n, s, turn = 'X', ko = -1, caps = { X: 0, O: 0 }, last = -1, mode = 'territory', target = 1,
    komi = 6.5, playouts = 2000, timeMs = 3000, seed = 0, wantOwner = false }) {
    const rnd = xorshift(seed || (Date.now() ^ (Math.random() * 1e9)));
    const root = new Fast(n), fb = new Fast(n);
    root.load({ s, ko, caps });
    const capture = mode === 'capture';
    const me = turn === 'X' ? 1 : 2;
    const SZ = root.W * root.W;
    const buf = new Int32Array(SZ);
    const firstB = new Int32Array(SZ), firstW = new Int32Array(SZ);
    const seqP = new Int32Array(n * n * 4 + 40), seqC = new Uint8Array(n * n * 4 + 40);
    const owner = new Float32Array(SZ);
    const lastP = last >= 0 ? root.i2p(last) : 0;
    const maxMoves = n * n * 3;
    let stones0 = 0;
    for (const p of root.pts) if (root.cell[p]) stones0++;

    const expand = (node, board, c, lastMove) => {
      node.kids = [];
      let stones = 0;
      for (const p of board.pts) if (board.cell[p]) stones++;
      for (const p of board.pts) {
        if (!board.legal(p, c)) continue;
        if (!capture && board.eyeish(p, c)) continue;
        const k = new Node(p, c);
        [k.pN, k.pW] = priorOf(board, p, c, lastMove, stones, capture);
        node.kids.push(k);
      }
      // 打てる手がないときだけパスを候補にする（地の勝負の終わりは呼び出し側で決める）
      if (!node.kids.length) node.kids.push(new Node(0, c));
    };
    const rootNode = new Node(-1, 3 - me);
    expand(rootNode, root, me, lastP);

    const select = (node) => {
      let best = null, bv = -1;
      const logN = Math.log(node.N + 1);
      for (const k of node.kids) {
        const n1 = k.N + k.pN, q = n1 ? (k.W + k.pW) / n1 : 0.5;
        let v = q;
        if (k.rN) {
          const beta = k.rN / (k.rN + n1 + n1 * k.rN * 0.0025);
          v = (1 - beta) * q + beta * (k.rW / k.rN);
        }
        v += 0.12 * Math.sqrt(logN / (n1 + 1));
        if (v > bv) { bv = v; best = k; }
      }
      return best;
    };

    const t0 = Date.now();
    let done = 0;
    while (done < playouts) {
      if ((done & 31) === 0 && done > 0 && Date.now() - t0 > timeMs) break;
      done++;
      fb.copy(root);
      let node = rootNode, c = me, len = 0, lastMove = lastP, passes = 0;
      const path = [rootNode];
      let winner = -1;
      // 木を下る
      while (node.kids && node.kids.length) {
        const k = select(node);
        if (k.move) {
          if (!fb.legal(k.move, c)) { k.pN += 50; break; }   // コウなどで打てない（まれ）
          fb.play(k.move, c); passes = 0;
        } else { fb.ko = 0; passes++; }
        seqP[len] = k.move; seqC[len] = c; len++;
        lastMove = k.move;
        path.push(k);
        node = k;
        c = 3 - c;
        if (capture && (fb.caps[1] >= target || fb.caps[2] >= target)) { winner = fb.caps[1] >= target ? 1 : 2; break; }
        if (passes >= 2) break;
      }
      // 葉を広げる
      if (winner < 0 && !node.kids && node.N >= 4 && passes < 2) {
        expand(node, fb, c, lastMove);
      }
      // 最後まで打つ
      if (winner < 0) {
        let m = 0;
        while (m++ < maxMoves && passes < 2) {
          let p = 0;
          if (lastMove && rnd() < 0.9) p = fb.tactical(c, lastMove, rnd);
          if (!p && !capture && lastMove && rnd() < 0.9) p = fb.patternMove(c, lastMove, rnd);
          if (!p) p = fb.randomMove(c, rnd, buf, capture);
          if (p) { fb.play(p, c); passes = 0; if (len < seqP.length) { seqP[len] = p; seqC[len] = c; len++; } }
          else { passes++; fb.ko = 0; }
          lastMove = p; c = 3 - c;
          if (capture && (fb.caps[1] >= target || fb.caps[2] >= target)) { winner = fb.caps[1] >= target ? 1 : 2; break; }
        }
        if (winner < 0) {
          if (capture) winner = fb.caps[1] > fb.caps[2] ? 1 : fb.caps[2] > fb.caps[1] ? 2 : 0;
          else { const a = fb.area() - komi; winner = a > 0 ? 1 : a < 0 ? 2 : 0; }
        }
      }
      if (wantOwner && !capture) {
        for (const p of fb.pts) {
          const v = fb.cell[p];
          if (v === 1) owner[p]++; else if (v === 2) owner[p]--;
          else {
            let nb = 0, nw = 0;
            for (let d = 0; d < 4; d++) { const u = fb.cell[p + fb.dirs[d]]; if (u === 1) nb++; else if (u === 2) nw++; }
            if (nb && !nw) owner[p]++; else if (nw && !nb) owner[p]--;
          }
        }
      }
      // 結果を戻す（RAVE：あとで同じ色が同じ点に打っていれば、その手の成績にも数える）
      firstB.fill(0x7fffffff); firstW.fill(0x7fffffff);
      for (let k = len - 1; k >= 0; k--) {
        const p = seqP[k];
        if (!p) continue;
        if (seqC[k] === 1) firstB[p] = k; else firstW[p] = k;
      }
      for (let d = 0; d < path.length; d++) {
        const nd = path[d];
        nd.N++;
        nd.W += winner === nd.color ? 1 : winner === 0 ? 0.5 : 0;
        if (nd.kids) {
          for (const k of nd.kids) {
            if (!k.move) continue;
            const f = k.color === 1 ? firstB[k.move] : firstW[k.move];
            if (f >= d && f < len) { k.rN++; k.rW += winner === k.color ? 1 : winner === 0 ? 0.5 : 0; }
          }
        }
      }
    }
    let best = null;
    for (const k of rootNode.kids) if (!best || k.N > best.N || (k.N === best.N && (k.W + k.pW) / (k.N + k.pN) > (best.W + best.pW) / (best.N + best.pN))) best = k;
    const ranked = [...rootNode.kids].sort((a, b) => b.N - a.N).slice(0, 6)
      .map((k) => ({ move: k.move ? root.p2i(k.move) : -1, visits: k.N, rate: k.N ? k.W / k.N : 0.5 }));
    const out = {
      move: best && best.move ? root.p2i(best.move) : -1,
      winrate: best && best.N ? best.W / best.N : 0.5,
      visits: done, top: ranked, ms: Date.now() - t0,
    };
    if (wantOwner && !capture) {
      out.owner = Array.from({ length: n * n }, (_, i) => Math.round((owner[root.i2p(i)] / Math.max(1, done)) * 100) / 100);
    }
    return out;
  }

  /** 終局の局面から、点ごとの持ち主の見込み（黒 +1 〜 白 −1）を乱打ちで求める */
  function ownership({ n, s, ko = -1, turn = 'X', playouts = 400, timeMs = 2500, seed = 0 }) {
    const rnd = xorshift(seed || (Date.now() ^ 0x5bd1e995));
    const root = new Fast(n), fb = new Fast(n);
    root.load({ s, ko, caps: { X: 0, O: 0 } });
    const SZ = root.W * root.W, buf = new Int32Array(SZ), own = new Float32Array(SZ);
    const t0 = Date.now();
    let done = 0;
    for (; done < playouts; done++) {
      if ((done & 15) === 0 && done && Date.now() - t0 > timeMs) break;
      fb.copy(root);
      let c = turn === 'X' ? 1 : 2, passes = 0, last = 0, m = 0;
      while (passes < 2 && m++ < n * n * 3) {
        let p = 0;
        if (last && rnd() < 0.9) p = fb.tactical(c, last, rnd);
        if (!p && last && rnd() < 0.9) p = fb.patternMove(c, last, rnd);
        if (!p) p = fb.randomMove(c, rnd, buf, false);
        if (p) { fb.play(p, c); passes = 0; } else { passes++; fb.ko = 0; }
        last = p; c = 3 - c;
      }
      for (const p of fb.pts) {
        const v = fb.cell[p];
        if (v === 1) own[p]++; else if (v === 2) own[p]--;
        else {
          let nb = 0, nw = 0;
          for (let d = 0; d < 4; d++) { const u = fb.cell[p + fb.dirs[d]]; if (u === 1) nb++; else if (u === 2) nw++; }
          if (nb && !nw) own[p]++; else if (nw && !nb) own[p]--;
        }
      }
    }
    return Array.from({ length: n * n }, (_, i) => own[root.i2p(i)] / Math.max(1, done));
  }
  /** 死に石の見込み：かたまりごとに、相手の持ちになる割合が高いものを死に石とする */
  function deadStones(st, owner) {
    const dead = [];
    for (const g of groups(st.s, st.n)) {
      let sum = 0;
      for (const k of g.stones) sum += owner[k];
      const avg = sum / g.stones.length;
      const mine = g.color === 'X' ? avg : -avg;
      if (mine < -0.3) dead.push(...g.stones);
    }
    return dead;
  }
  /** 形勢の目安（黒から見た目数の差。コミ込み）。棋譜の形勢グラフ用 */
  function estimate(st, komi = 6.5, playouts = 160) {
    const own = ownership({ n: st.n, s: st.s, ko: st.ko, turn: st.turn, playouts, timeMs: 600 });
    let sum = 0;
    for (const v of own) sum += v;
    return sum - komi;
  }

  /**
   * 対局相手の一手。level: easy / normal / hard。
   * 地の勝負では、手を打っても形勢が変わらないところまで来たらパスする（相手がパスした直後は、勝っていればパス）。
   */
  function pick({ st, level = 'normal', mode = 'territory', target = 1, komi = 6.5 }) {
    const n = st.n;
    const cfg = { easy: [mode === 'capture' ? 160 : 110, 600], normal: [1300, 1800], hard: [6000, 3200] }[level] || [1300, 1800];
    const res = think({ n, s: st.s, turn: st.turn, ko: st.ko, caps: st.caps, last: st.last ?? -1, mode, target, komi,
      playouts: cfg[0] * (n <= 7 ? 1 : n <= 9 ? 1 : 0.6), timeMs: cfg[1], wantOwner: mode !== 'capture' });
    let move = res.move;
    // やさしい：ときどき候補の2番手・3番手を選ぶ（取られる手や眼をつぶす手は選ばない）
    if (level === 'easy' && res.top.length > 1 && Math.random() < (mode === 'capture' ? 0.35 : 0.45)) {
      const alt = res.top.slice(1, mode === 'capture' ? 4 : 5).filter((t) => t.move >= 0 && t.visits > 0);
      if (alt.length) move = alt[(Math.random() * alt.length) | 0].move;
    }
    if (mode === 'capture') return { move, winrate: res.winrate, visits: res.visits };
    const me = st.turn;
    // パスの判断
    const owner = res.owner;
    const settled = (i) => Math.abs(owner[i]) > 0.8;
    const ownerOf = (i) => (owner[i] > 0 ? 'X' : 'O');
    const pointless = move < 0 || (settled(move) && (ownerOf(move) === me
      ? true
      : !nbr(n)[move].some((j) => st.s[j] === other(me))));
    const empties = [...st.s].filter((ch) => ch === '.').length;
    const anyAtari = groups(st.s, n).some((g) => g.libs.length === 1);
    if (st.passes >= 1) {
      // 相手がパスした：いまの局面で数えて勝っているなら、こちらもパスして終局
      const dead = deadStones(st, owner);
      const sc = score(st, dead, komi);
      const ahead = me === 'X' ? sc.diff > 0 : sc.diff < 0;
      if (ahead || pointless || res.winrate < 0.03) return { move: -1, winrate: res.winrate, visits: res.visits, owner };
    } else if (pointless && !anyAtari && empties < n * n * 0.5) {
      return { move: -1, winrate: res.winrate, visits: res.visits, owner };
    }
    return { move, winrate: res.winrate, visits: res.visits };
  }

  // ── コーチ（打った手の講評） ───────────────────────────
  /**
   * st（打つ前の状態、手番は打った側）と打った点 i から、講評を作る。
   * 返り値 { level: 'ok' | 'miss' | 'blunder', lines: [{ kind, what, why, better, marks }] }
   */
  function review(st, i) {
    const n = st.n, s = st.s, c = st.turn, o = other(c);
    const lines = [];
    if (i < 0) return { level: 'ok', lines };
    const r = play(s, n, i, c, st.ko);
    if (r.illegal) return { level: 'ok', lines };
    const after = r.s;
    const P = (k) => ptName(n, k);
    const cnt = (k) => `${k}子`;
    // 打つ前に：相手のアタリの石（取れるもの）と、自分のアタリの石
    const foeAtari = groups(s, n, o).filter((g) => g.libs.length === 1 && isLegal(s, n, g.libs[0], c, st.ko));
    const myAtari = groups(s, n, c).filter((g) => g.libs.length === 1);
    const bigFoe = foeAtari.reduce((a, g) => (!a || g.stones.length > a.stones.length ? g : a), null);
    const captured = r.captured.length;
    // 自分のアタリの石を助けたか
    const savedAny = myAtari.filter((g) => {
      if (after[g.stones[0]] !== c) return false;
      const g2 = group(after, n, g.stones[0]);
      return g2.libs.length >= 2;
    });
    let level = 'ok';
    const bump = (lv) => { if (lv === 'blunder' || (lv === 'miss' && level === 'ok')) level = lv; };
    const me = group(after, n, i);

    // 1. 自分からアタリに入った（取られる）
    if (me.libs.length === 1 && isLegal(after, n, me.libs[0], o, r.ko)) {
      // ウッテガエシなど：取らせたあとで、取った石を取り返せるならわざとの手
      const rr = play(after, n, me.libs[0], o, r.ko);
      let trick = false;
      if (!rr.illegal) {
        const g2 = group(rr.s, n, me.libs[0]);
        if (g2 && g2.libs.length === 1 && isLegal(rr.s, n, g2.libs[0], c, rr.ko) && g2.stones.length >= rr.captured.length) trick = true;
      }
      if (!trick && !(captured && me.stones.length <= captured)) {
        const big = me.stones.length >= 2;
        bump(big ? 'blunder' : 'miss');
        lines.push({
          kind: 'gselfatari', d: { k: me.stones.length }, what: `自分からアタリになりました（${P(i)}の石${big ? `を含む${cnt(me.stones.length)}` : ''}）`,
          why: `打った石の呼吸点が${P(me.libs[0])}の1つだけです。次に相手にそこへ打たれると取られます。`,
          lesson: '打つ前に「打ったあとの呼吸点」を数えます。1つしかなければ、そこは打ってはいけない点です。',
          marks: Object.fromEntries([...me.stones.map((k) => [k, 'ng']), [me.libs[0], 'hint']]),
        });
      }
    }
    // 2. 取れる石を見逃した
    if (bigFoe && !captured && !savedAny.some((g) => g.stones.length >= bigFoe.stones.length)) {
      const cap = bigFoe.libs[0];
      const big = bigFoe.stones.length >= 3;
      bump(big ? 'blunder' : 'miss');
      lines.push({
        kind: 'gmisscap', d: { k: bigFoe.stones.length }, what: `取れる石がありました（${cnt(bigFoe.stones.length)}）`,
        why: `相手の石は呼吸点が${P(cap)}の1つだけで、アタリになっていました。`,
        better: { to: cap, label: `${P(cap)}に打って取る` },
        lesson: '相手が打ったら、まず「アタリになっている石はないか」を見ます。',
        marks: Object.fromEntries([...bigFoe.stones.map((k) => [k, 'hint']), [cap, 'ok']]),
      });
    }
    // 3. アタリを放置した
    if (myAtari.length && !savedAny.length && !(captured && bigFoe)) {
      const g = myAtari.reduce((a, b) => (b.stones.length > a.stones.length ? b : a));
      if (after[g.stones[0]] === c && group(after, n, g.stones[0]).libs.length === 1) {
        const ways = saveMoves(s, n, g.stones[0], st.ko);
        if (ways.length) {
          const big = g.stones.length >= 3;
          bump(big ? 'blunder' : 'miss');
          lines.push({
            kind: 'gignore', d: { k: g.stones.length }, what: `アタリの石をそのままにしました（${cnt(g.stones.length)}）`,
            why: `${P(g.libs[0])}に打たれると取られます。`,
            better: { to: ways[0], label: `${P(ways[0])}に打って助ける` },
            lesson: 'アタリをかけられたら、逃げる（呼吸点を増やす）か、相手の石を取って助けます。',
            marks: Object.fromEntries([...g.stones.map((k) => [k, 'ng']), [ways[0], 'ok']]),
          });
        }
      }
    }
    // 4. シチョウで逃げた
    for (const g of myAtari) {
      if (after[g.stones[0]] !== c || !me.stones.includes(g.stones[0])) continue;
      const g2 = group(after, n, g.stones[0]);
      if (g2.libs.length === 2 && canCapture(after, n, g.stones[0], r.ko)) {
        const big = g2.stones.length >= 3;
        bump(big ? 'blunder' : 'miss');
        lines.push({
          kind: 'gladder', what: '逃げても取られる形です（シチョウ）',
          why: '呼吸点が2つのまま相手に追いかけられ、最後は盤の端で取られます。逃げるほど取られる石が増えます。',
          lesson: 'シチョウになる石は逃げずに、ほかの大きいところに打ちます。',
          marks: Object.fromEntries(g2.stones.map((k) => [k, 'ng'])),
        });
      }
      break;
    }
    // 5. 自分の眼をつぶした
    if (!captured && eyeLike(s, n, i, c)) {
      const owners = new Set(nbr(n)[i].map((j) => s[j]));
      if (owners.size === 1) {
        bump('miss');
        lines.push({
          kind: 'geye', what: '自分の眼をつぶしました',
          why: '自分の石だけに囲まれた点は「眼」です。眼が2つあれば石は取られませんが、自分で埋めると眼が減ります。',
          lesson: '自分の地の中や眼には打ちません。打つところがなければパスします。',
          marks: { [i]: 'ng' },
        });
      }
    }
    // 6. 序盤に1線・2線へ打った（9路以上。まわりに石がなく、取る・助ける・アタリでもない手だけ）
    const x0 = i % n, y0 = (i / n) | 0;
    const lineNo = Math.min(x0, y0, n - 1 - x0, n - 1 - y0) + 1;
    const nearStone = (k0, dist) => { for (let k = 0; k < n * n; k++) if (s[k] !== '.' && Math.abs((k % n) - (k0 % n)) + Math.abs(((k / n) | 0) - ((k0 / n) | 0)) <= dist) return true; return false; };
    const atariNow = groups(after, n, o).filter((g) => g.libs.length === 1 && nbr(n)[i].some((j) => g.stones.includes(j)));
    if (level === 'ok' && n >= 9 && !captured && !savedAny.length && !atariNow.length && lineNo <= 2
      && (st.moves || 0) < (n >= 13 ? 24 : 10) && !nearStone(i, 2)) {
      // 代わりに：空いている隅の3線・4線（まわり2路に石がない点）
      const cand = n >= 13 ? [[3, 3], [3, 9], [9, 3], [9, 9], [2, 3], [3, 2]] : [[2, 2], [2, 6], [6, 2], [6, 6], [2, 4], [4, 2]];
      const better = cand.map(([cx, cy]) => cy * n + cx).find((k) => s[k] === '.' && !nearStone(k, 2));
      bump('miss');
      lines.push({
        kind: 'gedge', d: { line: lineNo },
        what: `序盤に、盤の端に近い${lineNo}線に打ちました`,
        why: '端に近すぎる石は、囲える地が小さくなります。序盤は隅や辺の3線・4線に打つのが基本です。',
        ...(better != null ? { better: { to: better, label: `${P(better)}のような、空いている隅の3線・4線に打つ` } } : {}),
        lesson: '序盤は「隅 → 辺 → 中央」。高さは3線か4線が目安です。',
        marks: { [i]: 'ng', ...(better != null ? { [better]: 'ok' } : {}) },
      });
    }
    // 7. 自分の地の中に打った：まわりが自分の石だけで囲まれ、囲んでいる石が無条件に生きている（守る必要がない）
    if (!captured && !lines.some((l) => l.kind === 'geye' || l.kind === 'gselfatari')) {
      const region = [], seen = new Set([i]), stack = [i];
      let foeTouch = false;
      while (stack.length && region.length < 40) {
        const k = stack.pop();
        region.push(k);
        for (const j of nbr(n)[k]) {
          if (s[j] === '.') { if (!seen.has(j)) { seen.add(j); stack.push(j); } } else if (s[j] === o) foeTouch = true;
        }
      }
      if (!foeTouch && !stack.length && region.length >= 2 && region.length <= 12) {
        const border = new Set();
        for (const k of region) for (const j of nbr(n)[k]) if (s[j] === c) border.add(j);
        const alive = border.size ? bensonAlive(s, n, c) : new Set();
        if (border.size && [...border].every((j) => alive.has(j))) {
          bump('miss');
          lines.push({
            kind: 'gfill',
            what: '自分の地の中に打ちました',
            why: 'まわりの石はもう取られない形なので、ここはあなたの地です。日本ルールでは、自分の地に打つと1目へります。',
            lesson: '打つところがなくなったら「パス」を押します。パスが2回続くと終局して、地を数えます。',
            marks: { [i]: 'ng' },
          });
        }
      }
    }
    // 良い手
    if (level === 'ok') {
      if (captured) lines.push({ kind: 'good', d: { gcap: true, k: captured }, what: `${cnt(captured)}取りました`, why: '取った石はアゲハマになり、終局のときに1個1目として数えます。' });
      else if (savedAny.length) lines.push({ kind: 'good', d: { gsave: true }, what: 'アタリの石を助けました', why: '呼吸点が増えて、すぐには取られなくなりました。' });
      else {
        if (atariNow.length >= 2) lines.push({ kind: 'good', d: { gdouble: true }, what: '両アタリです', why: '2か所を同時にアタリにしました。どちらかは取れます。' });
        else if (atariNow.length) lines.push({ kind: 'good', d: { gatari: true }, what: 'アタリをかけました', why: '相手の石の呼吸点が1つになりました。' });
      }
    }
    return { level, lines };
  }

  // ── 棋譜（SGF） ────────────────────────────────────────
  function toSGF(n, moves, { komi = 6.5, result = '', rule = 'Japanese', setup = null } = {}) {
    const c = (i) => (i < 0 ? '' : String.fromCharCode(97 + (i % n)) + String.fromCharCode(97 + ((i / n) | 0)));
    let head = `(;GM[1]FF[4]CA[UTF-8]AP[盤戯]SZ[${n}]KM[${komi}]RU[${rule}]${result ? `RE[${result}]` : ''}`;
    if (setup) {
      const ab = [], aw = [];
      for (let i = 0; i < n * n; i++) { if (setup[i] === 'X') ab.push(c(i)); else if (setup[i] === 'O') aw.push(c(i)); }
      if (ab.length) head += `AB${ab.map((x) => `[${x}]`).join('')}`;
      if (aw.length) head += `AW${aw.map((x) => `[${x}]`).join('')}`;
    }
    return `${head}${moves.map((m) => `;${m.color === 'X' ? 'B' : 'W'}[${c(m.i)}]`).join('')})`;
  }

  /** 盤の向きを変える（問題を回転・反転して増やすため）。k = 0〜7 */
  function transform(n, i, k) {
    let x = i % n, y = (i / n) | 0;
    if (k & 4) [x, y] = [y, x];
    if (k & 1) x = n - 1 - x;
    if (k & 2) y = n - 1 - y;
    return y * n + x;
  }
  function transformRows(rows, k) {
    const { n } = parse(rows);
    const src = rows.map((r) => r.replace(/\s+/g, ''));
    const out = Array.from({ length: n }, () => new Array(n));
    for (let i = 0; i < n * n; i++) { const j = transform(n, i, k); out[(j / n) | 0][j % n] = src[(i / n) | 0][i % n]; }
    return out.map((r) => r.join(''));
  }

  return {
    KANJI, COLOR_JA, other, ptName, nbr, diag, parse, rowsOf, group, groups, play, isLegal, legalMoves, apply, newGame,
    eyeLike, regions, score, resultText, bensonAlive, canCapture, canSave, captureMoves, saveMoves, defendReply,
    solveLD, ldWinningMoves, ldReply, think, ownership, deadStones, estimate, pick, review, toSGF, transform, transformRows,
  };
};
const NS_GO = GO_FACTORY();

// ── js/games/kpk.js ─────────────────────────────────────────
const KPK_FACTORY = () => {

  // kpk.js — キング＋ポーン対キングの勝敗表。
  // 白キング・白ポーン・黒キングの全局面（約39万×手番）を、最後まで計算して勝ち／引き分けを決める。
  // 最初に使うときだけ数秒かかる（別スレッドで作り、作った表はそのスレッドで使い回す）。
  // 昇格はクイーンだけ（このアプリの盤はクイーンに昇格するため）。画面には触らない。
  const F = (i) => i & 7, Rk = (i) => i >> 3;
  const adj = (a, b) => a !== b && Math.abs(F(a) - F(b)) <= 1 && Math.abs(Rk(a) - Rk(b)) <= 1;
  const KM = [];
  for (let i = 0; i < 64; i++) { KM.push([]); for (let j = 0; j < 64; j++) if (adj(i, j)) KM[i].push(j); }
  const pawnAtt = (p, q) => Rk(q) === Rk(p) + 1 && Math.abs(F(q) - F(p)) === 1;
  const idx = (wk, bk, p, stm) => (((wk * 64 + bk) * 48 + (p - 8)) * 2 + stm);
  const valid = (wk, bk, p, stm) => wk !== bk && wk !== p && bk !== p && !adj(wk, bk) && !(stm === 0 && pawnAtt(p, bk));
  // ORD は勝ちと決まった順番。勝ちの局面からは、必ず ORD のより小さい勝ちの局面へ進める（ORD の小さい手を選び続ければ、堂々めぐりせずに勝ちきれる）
  let RES = null, DEP = null, ORD = null;

  function qAttacks(q, t, wk) {
    for (const [df, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      let f = F(q) + df, r = Rk(q) + dr;
      while (f >= 0 && f < 8 && r >= 0 && r < 8) { const s = r * 8 + f; if (s === t) return true; if (s === wk) break; f += df; r += dr; }
    }
    return false;
  }
  /** クイーンに昇格した直後（黒番）：取られず、ステイルメイトでもなければ勝ち */
  function promoWins(wk, bk, q) {
    if (adj(bk, q) && !adj(wk, q)) return false;
    const check = qAttacks(q, bk, wk);
    for (const t of KM[bk]) {
      if (t === wk || adj(t, wk)) continue;
      if (t === q) { if (!adj(wk, q)) return true; continue; }
      if (!qAttacks(q, t, wk)) return true;
    }
    return check;   // 動ける手がない：王手なら詰み（勝ち）、王手でなければステイルメイト
  }
  function build() {
    if (RES) return;
    const N = 64 * 64 * 48 * 2;
    RES = new Uint8Array(N); DEP = new Uint8Array(N); ORD = new Uint32Array(N);
    let cnt = 0;
    for (let it = 1, changed = true; changed; it++) {
      changed = false;
      for (let wk = 0; wk < 64; wk++) for (let bk = 0; bk < 64; bk++) for (let p = 8; p < 56; p++) {
        let i = idx(wk, bk, p, 0);
        if (!RES[i] && valid(wk, bk, p, 0)) {
          let win = false;
          for (const t of KM[wk]) { if (t === p || adj(t, bk)) continue; if (RES[idx(t, bk, p, 1)] && valid(t, bk, p, 1)) { win = true; break; } }
          if (!win) {
            const one = p + 8;
            if (one !== wk && one !== bk) {
              if (one >= 56) win = promoWins(wk, bk, one);
              else if (RES[idx(wk, bk, one, 1)]) win = true;
              if (!win && Rk(p) === 1) { const two = p + 16; if (two !== wk && two !== bk && RES[idx(wk, bk, two, 1)]) win = true; }
            }
          }
          if (win) { RES[i] = 1; DEP[i] = it; ORD[i] = ++cnt; changed = true; }
        }
        i = idx(wk, bk, p, 1);
        if (!RES[i] && valid(wk, bk, p, 1)) {
          let n = 0, all = true;
          for (const t of KM[bk]) {
            if (adj(t, wk) || t === wk || pawnAtt(p, t)) continue;
            if (t === p) { if (!adj(wk, p)) { all = false; n++; break; } continue; }
            n++;
            if (!RES[idx(wk, t, p, 0)]) { all = false; break; }
          }
          if ((n === 0 && pawnAtt(p, bk)) || (n > 0 && all)) { RES[i] = 1; DEP[i] = it; ORD[i] = ++cnt; changed = true; }
        }
      }
    }
  }
  const sqi = (s) => s.charCodeAt(0) - 97 + (Number(s.slice(1)) - 1) * 8;
  const sqn = (i) => 'abcdefgh'[F(i)] + (Rk(i) + 1);
  /** 盤（{ e4: 'P', ... }）から、白キング・黒キング・白ポーンの位置。ほかの駒があれば null */
  function locate(board) {
    let wk = -1, bk = -1, p = -1;
    for (const [s, pc] of Object.entries(board)) {
      if (pc === 'K') wk = sqi(s); else if (pc === 'k') bk = sqi(s); else if (pc === 'P') p = sqi(s); else return null;
    }
    return wk >= 0 && bk >= 0 && p >= 8 && p < 56 ? { wk, bk, p } : null;
  }
  /** 勝敗：stm は 'w' か 'b'。{ win, depth }（キング＋ポーン対キングでなければ null） */
  function info(board, stm) {
    build();
    const L = locate(board);
    if (!L || !valid(L.wk, L.bk, L.p, stm === 'w' ? 0 : 1)) return null;
    const i = idx(L.wk, L.bk, L.p, stm === 'w' ? 0 : 1);
    return { win: !!RES[i], depth: DEP[i] };
  }
  /**
   * 白番で、勝ちにつながる手の一覧（[{ from, to, ord }]）。勝ちに早く近づく手から並べる。
   * 先頭の手を選び続ければ、黒がどう受けても必ず勝ちきれる（勝ちを保つだけの手をくり返すと、同じ局面を行き来することがある）
   */
  function winning(board) {
    build();
    const L = locate(board);
    if (!L) return [];
    const { wk, bk, p } = L, out = [];
    for (const t of KM[wk]) {
      if (t === p || adj(t, bk)) continue;
      const j = idx(t, bk, p, 1);
      if (RES[j]) out.push({ from: sqn(wk), to: sqn(t), ord: ORD[j] });
    }
    const one = p + 8;
    if (one !== wk && one !== bk) {
      if (one >= 56) { if (promoWins(wk, bk, one)) out.push({ from: sqn(p), to: sqn(one), ord: 0 }); }
      else if (RES[idx(wk, bk, one, 1)]) out.push({ from: sqn(p), to: sqn(one), ord: ORD[idx(wk, bk, one, 1)] });
      if (Rk(p) === 1) { const two = p + 16; if (two !== wk && two !== bk && RES[idx(wk, bk, two, 1)]) out.push({ from: sqn(p), to: sqn(two), ord: ORD[idx(wk, bk, two, 1)] }); }
    }
    return out.sort((a, b) => a.ord - b.ord);
  }
  /** 黒番の応手：引き分けにできる手があればそれ、なければ決着がいちばん遠くなる手（最善の粘り） */
  function reply(board) {
    build();
    const L = locate(board);
    if (!L) return null;
    const { wk, bk, p } = L, ms = [];
    for (const t of KM[bk]) {
      if (t === wk || adj(t, wk) || pawnAtt(p, t)) continue;
      if (t === p) { if (!adj(wk, p)) ms.push({ t, sc: 1e6 }); continue; }
      const i = idx(wk, t, p, 0);
      ms.push({ t, sc: RES[i] ? DEP[i] : 1e5 });
    }
    if (!ms.length) return null;
    ms.sort((a, b) => b.sc - a.sc);
    const best = ms.filter((m) => m.sc === ms[0].sc);
    const m = best[(Math.random() * best.length) | 0];
    return { from: sqn(bk), to: sqn(m.t) };
  }

  return { info, winning, reply, build };
};
const NS_KPK = KPK_FACTORY();

// ── js/core/think.js ────────────────────────────────────────
const NS_THINK = (() => {
  // think.js — 重い読み（相手の思考・講評・形勢グラフ）を別スレッド（Web Worker）で動かし、画面が固まらないようにする。
  // Worker が使えない環境（古いブラウザ・厳しい CSP）では、これまでどおり画面側で動かす。
  // 仕事の中身は THINK_TASKS_FACTORY（コーチの下）にあり、Worker にはエンジン・コーチごと同じコードを送る。
  let worker = null, broken = false, seq = 0, tasks = null, srcUrl = null;
  const waiting = new Map();   // id -> { task, args, done }
  const local = (task, args) => (tasks ||= THINK_TASKS_FACTORY())[task](...args);
  // forever = false のときは作り直せる（時間切れ）。true はスレッド自体が使えないとき
  const giveUp = (forever = true) => {
    if (forever) broken = true;
    try { worker?.terminate(); } catch { }
    worker = null;
    const rest = [...waiting.entries()];
    waiting.clear();
    // 時間切れで作り直すときは、ほかに待っている仕事を新しいスレッドへ送り直す。
    // 画面側でやり直すと、そのあいだ画面が固まる（スレッドに出した意味がなくなる）
    const w = forever ? null : get();
    for (const [id, job] of rest) {
      if (w) {
        try { waiting.set(id, job); w.postMessage({ id, task: job.task, args: job.args }); continue; } catch { waiting.delete(id); }
      }
      job.done({ err: 'worker' });
    }
  };
  function get() {
    if (worker || broken) return worker;
    try {
      const src = [
        `const NS_CHESS = (${CHESS_FACTORY.toString()})();`,
        `const NS_SHOGI = (${SHOGI_FACTORY.toString()})();`,
        `const NS_MAHJONG = (${MAHJONG_FACTORY.toString()})();`,
        `const NS_GO = (${GO_FACTORY.toString()})();`,
        `const NS_KPK = (${KPK_FACTORY.toString()})();`,
        `const NS_COACH = (${COACH_FACTORY.toString()})();`,
        `const TASKS = (${THINK_TASKS_FACTORY.toString()})();`,
        'onmessage = (e) => { const { id, task, args } = e.data; let r = null, err = null;'
        + ' try { r = TASKS[task](...args); } catch (x) { err = String(x && x.stack || x); }'
        + ' try { postMessage({ id, r, err }); } catch (x) { postMessage({ id, r: null, err: "clone: " + x }); } };',
      ].join('\n');
      srcUrl ||= URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));   // 作り直すたびに増やさない
      worker = new Worker(srcUrl);
      worker.onmessage = (e) => {
        const job = waiting.get(e.data.id);
        if (job) { waiting.delete(e.data.id); job.done(e.data); }
      };
      worker.onerror = (e) => { e.preventDefault?.(); giveUp(); };
    } catch { broken = true; worker = null; }
    return worker;
  }
  /**
   * 仕事を頼む。結果は Promise。Worker で失敗したら画面側でやり直す。
   * onTimeout を渡すと、時間切れのときは同じ重い計算を画面側でやり直さず（画面が固まるので）、その値で済ませる
   */
  function run(task, args, limitMs = 10000, onTimeout = null) {
    const w = get();
    if (!w) { try { return Promise.resolve(local(task, args)); } catch (e) { return Promise.reject(e); } }
    return new Promise((resolve, reject) => {
      const id = ++seq;
      const fallback = () => { try { resolve(local(task, args)); } catch (e) { reject(e); } };
      const timer = setTimeout(() => {
        if (!waiting.has(id)) return;
        // 時間切れ：スレッドは止めて作り直す（次の仕事からまたスレッドを使う）
        waiting.delete(id);
        giveUp(false);
        if (onTimeout) resolve(onTimeout()); else fallback();
      }, limitMs);
      waiting.set(id, { task, args, done: (d) => {
        clearTimeout(timer);
        if (d.err) { if (d.err !== 'worker') console.warn('読みのスレッドで失敗しました。画面側でやり直します', d.err); fallback(); }
        else resolve(d.r);
      } });
      try { w.postMessage({ id, task, args }); } catch { waiting.delete(id); clearTimeout(timer); fallback(); }
    });
  }
  const pickMove = (game, args) => run('pick', [game, args]);
  return { run, pickMove };
})();

// ── js/games/mahjong.js ─────────────────────────────────────
const MAHJONG_FACTORY = () => {

  // mahjong.js — 学習用麻雀エンジン
  // 牌の表記: m1..m9(萬子) p1..p9(筒子) s1..s9(索子) z1..z7(東南西北白發中)
  // 内部は34種のカウント配列。面子数を可変にしてあるので「豆麻雀(2面子1雀頭)」も同じ関数で扱える。

  const SUITS = ['m', 'p', 's', 'z'];
  const SUIT_JA = { m: '萬子', p: '筒子', s: '索子', z: '字牌' };
  const SUIT_YOMI = { m: 'マンズ', p: 'ピンズ', s: 'ソーズ', z: 'ツーパイ' };
  const HONOR_JA = ['東', '南', '西', '北', '白', '發', '中'];
  const HONOR_YOMI = ['トン', 'ナン', 'シャー', 'ペー', 'ハク', 'ハツ', 'チュン'];
  const NUM_YOMI = ['イー', 'リャン', 'サン', 'スー', 'ウー', 'ロー', 'チー', 'パー', 'キュー'];

  const ALL_TILES = (() => {
    const out = [];
    for (const s of ['m', 'p', 's']) for (let n = 1; n <= 9; n++) out.push(s + n);
    for (let n = 1; n <= 7; n++) out.push('z' + n);
    return out;
  })();

  // 赤5は「m0 / p0 / s0」と書く。種類としては5と同じに数える（toIndex・norm）
  const isRed = (t) => t[1] === '0';
  const norm = (t) => (t && t[1] === '0' ? t[0] + '5' : t);
  const toIndex = (t) => {
    const s = t[0], n = Number(t[1]) || 5;
    return { m: 0, p: 9, s: 18, z: 27 }[s] + n - 1;
  };
  const fromIndex = (i) =>
    i < 9 ? 'm' + (i + 1) : i < 18 ? 'p' + (i - 8) : i < 27 ? 's' + (i - 17) : 'z' + (i - 26);

  const isHonor = (t) => t[0] === 'z';
  const isTerminal = (t) => !isHonor(t) && (t[1] === '1' || t[1] === '9');
  const isYaochu = (t) => isHonor(t) || isTerminal(t);

  function tileName(t) {
    if (isHonor(t)) return HONOR_JA[Number(t[1]) - 1];
    if (isRed(t)) return `赤5${SUIT_JA[t[0]][0]}`;
    return `${t[1]}${SUIT_JA[t[0]][0]}`;
  }
  function tileYomi(t) {
    if (isHonor(t)) return HONOR_YOMI[Number(t[1]) - 1];
    const n = Number(norm(t)[1]);
    return (isRed(t) ? 'アカ' : '') + NUM_YOMI[n - 1] + { m: 'ワン', p: 'ピン', s: 'ソー' }[t[0]];
  }

  const toCounts = (tiles) => {
    const c = new Array(34).fill(0);
    for (const t of tiles) c[toIndex(t)]++;
    return c;
  };
  const fromCounts = (c) => {
    const out = [];
    c.forEach((n, i) => { for (let k = 0; k < n; k++) out.push(fromIndex(i)); });
    return out;
  };
  const sortTiles = (tiles) => [...tiles].sort((a, b) => toIndex(a) - toIndex(b) || (isRed(a) ? 1 : 0) - (isRed(b) ? 1 : 0));

  function makeWall(pool = ALL_TILES) {
    const w = [];
    for (const t of pool) for (let i = 0; i < 4; i++) w.push(t);
    for (let i = w.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [w[i], w[j]] = [w[j], w[i]];
    }
    return w;
  }

  // --- 和了形の分解 ---------------------------------------------------------
  /**
   * 手牌を「n面子 + 1雀頭」に分解できる全パターンを返す。
   * 返り値: [{ pair: 'm5', sets: [['m1','m2','m3'], ...] }, ...]
   */
  function decompose(tiles, sets = 4) {
    const counts = toCounts(tiles);
    const results = [];
    const seen = new Set();

    const takeSets = (c, need, acc) => {
      if (need === 0) {
        const key = acc.map((s) => s.join('')).sort().join('|');
        if (!seen.has(key)) { seen.add(key); results.push(acc.slice()); }
        return;
      }
      const i = c.findIndex((n) => n > 0);
      if (i < 0) return;
      if (c[i] >= 3) { // 刻子
        c[i] -= 3; acc.push([fromIndex(i), fromIndex(i), fromIndex(i)]);
        takeSets(c, need - 1, acc);
        acc.pop(); c[i] += 3;
      }
      if (i < 27 && i % 9 <= 6 && c[i + 1] > 0 && c[i + 2] > 0) { // 順子
        c[i]--; c[i + 1]--; c[i + 2]--;
        acc.push([fromIndex(i), fromIndex(i + 1), fromIndex(i + 2)]);
        takeSets(c, need - 1, acc);
        acc.pop(); c[i]++; c[i + 1]++; c[i + 2]++;
      }
    };

    const out = [];
    for (let p = 0; p < 34; p++) {
      if (counts[p] < 2) continue;
      counts[p] -= 2;
      results.length = 0; seen.clear();
      takeSets(counts.slice(), sets, []);
      for (const r of results) out.push({ pair: fromIndex(p), sets: r });
      counts[p] += 2;
    }
    return out;
  }

  const isAgari = (tiles, sets = 4) => decompose(tiles, sets).length > 0;
  const isChiitoi = (tiles) =>
    tiles.length === 14 && toCounts(tiles).filter((n) => n === 2).length === 7;
  const isKokushi = (tiles) => {
    if (tiles.length !== 14) return false;
    const y = ALL_TILES.filter(isYaochu);
    const c = toCounts(tiles);
    if (fromCounts(c).some((t) => !isYaochu(t))) return false;
    return y.every((t) => c[toIndex(t)] >= 1) && y.some((t) => c[toIndex(t)] === 2);
  };
  const isWin = (tiles, sets = 4) =>
    isAgari(tiles, sets) || (sets === 4 && (isChiitoi(tiles) || isKokushi(tiles)));

  // --- 待ち ---------------------------------------------------------------
  /** あと1枚で和了になる牌を列挙。sets=4 なら13枚、sets=2 なら7枚を渡す */
  function waits(tiles, sets = 4) {
    const counts = toCounts(tiles);
    const out = [];
    for (const t of ALL_TILES) {
      if (counts[toIndex(t)] >= 4) continue;
      if (isWin([...tiles, t], sets)) out.push(t);
    }
    return out;
  }
  const isTenpai = (tiles, sets = 4) => waits(tiles, sets).length > 0;

  const WAIT_TYPES = {
    ryanmen: { ja: '両面', desc: '3456のように両側で待つ形。いちばん広い。' },
    kanchan: { ja: '嵌張', desc: '1_3 のように真ん中が抜けた形。待ちは1種類。' },
    penchan: { ja: '辺張', desc: '12 で3を待つ、89で7を待つ形。端なので片側しかない。' },
    shanpon: { ja: '双ポン', desc: '同じ牌2枚が2組。どちらかが3枚目になれば和了。' },
    tanki: { ja: '単騎', desc: '雀頭がまだ1枚。その1枚の相方を待つ形。' },
  };

  /** 待ち牌 win で和了したときの、その待ちの形を判定する */
  function waitType(tiles13, win, sets = 4) {
    win = norm(win);
    const hand = [...tiles13.map(norm), win];
    const types = new Set();
    for (const d of decompose(hand, sets)) {
      // 雀頭で和了 = 単騎（他の面子は手牌の中で完成していたことになる）
      if (d.pair === win) types.add('tanki');
      for (const s of d.sets) {
        if (!s.includes(win)) continue;
        if (s[0] === s[1] && s[1] === s[2]) { types.add('shanpon'); continue; }
        const nums = s.map((t) => Number(t[1]));
        const pos = nums.indexOf(Number(win[1]));
        if (pos === 1) types.add('kanchan');
        else if ((pos === 0 && nums[0] === 7) || (pos === 2 && nums[2] === 3)) types.add('penchan');
        else types.add('ryanmen');
      }
    }
    return [...types];
  }

  // --- シャンテン数 ---------------------------------------------------------
  // 色ごとに分けて計算し、結果を覚えておく。
  // 全部まとめて総当たりすると、受け入れ計算のたびに数百回呼ばれて重くなる。

  const SUIT_MEMO = new Map();

  /** 1色ぶんの「面子・塔子・対子の取り方」を列挙する（無駄な組は捨てる） */
  function suitOptions(arr, isHonor) {
    const key = (isHonor ? 'z' : 'n') + arr.join('');
    const hit = SUIT_MEMO.get(key);
    if (hit) return hit;

    const found = [];
    const seen = new Set();
    const rec = (c, i, melds, partials, pairs) => {
      while (i < c.length && c[i] === 0) i++;
      if (i >= c.length) {
        const k = `${melds},${partials},${pairs}`;
        if (!seen.has(k)) { seen.add(k); found.push([melds, partials, pairs]); }
        return;
      }
      if (c[i] >= 3) { c[i] -= 3; rec(c, i, melds + 1, partials, pairs); c[i] += 3; }
      if (!isHonor && i + 2 < c.length && c[i + 1] && c[i + 2]) {
        c[i]--; c[i + 1]--; c[i + 2]--; rec(c, i, melds + 1, partials, pairs);
        c[i]++; c[i + 1]++; c[i + 2]++;
      }
      if (c[i] >= 2) { c[i] -= 2; rec(c, i, melds, partials, pairs + 1); c[i] += 2; }
      if (!isHonor && i + 1 < c.length && c[i + 1]) {
        c[i]--; c[i + 1]--; rec(c, i, melds, partials + 1, pairs); c[i]++; c[i + 1]++;
      }
      if (!isHonor && i + 2 < c.length && c[i + 2]) {
        c[i]--; c[i + 2]--; rec(c, i, melds, partials + 1, pairs); c[i]++; c[i + 2]++;
      }
      c[i]--; rec(c, i, melds, partials, pairs); c[i]++;
    };
    rec(arr.slice(), 0, 0, 0, 0);

    // 他の組に完全に負けている取り方は捨てる
    const pruned = found.filter((a) =>
      !found.some((b) => b !== a && b[0] >= a[0] && b[1] >= a[1] && b[2] >= a[2]
        && (b[0] > a[0] || b[1] > a[1] || b[2] > a[2])));
    if (SUIT_MEMO.size > 20000) SUIT_MEMO.clear();
    SUIT_MEMO.set(key, pruned);
    return pruned;
  }

  /** シャンテン数。0 でテンパイ、-1 で和了 */
  function shanten(tiles, sets = 4) {
    const c = toCounts(tiles);
    const groups = [
      suitOptions(c.slice(0, 9), false),
      suitOptions(c.slice(9, 18), false),
      suitOptions(c.slice(18, 27), false),
      suitOptions(c.slice(27, 34), true),
    ];
    let best = sets * 2;
    const combine = (i, melds, partials, pairs) => {
      if (i === 4) {
        for (const head of pairs > 0 ? [1, 0] : [0]) {
          const m = Math.min(melds, sets);
          const p = Math.min(partials + (pairs - head), sets - m);
          const v = sets * 2 - m * 2 - p - head;
          if (v < best) best = v;
        }
        return;
      }
      for (const [gm, gp, gq] of groups[i]) combine(i + 1, melds + gm, partials + gp, pairs + gq);
    };
    combine(0, 0, 0, 0);
    return best;
  }

  // --- 役（入門で扱う分だけ） -----------------------------------------------
  const YAKU_JA = {
    riichi: { ja: 'リーチ', han: 1, desc: 'テンパイを宣言する。門前限定。' },
    tsumo: { ja: '門前清自摸和', han: 1, desc: '鳴かずに自分でツモって和了。' },
    tanyao: { ja: 'タンヤオ', han: 1, desc: '1・9と字牌をいっさい使わない。' },
    yakuhai: { ja: '役牌', han: 1, desc: '白・發・中や自分の風の刻子。' },
    pinfu: { ja: 'ピンフ', han: 1, desc: '順子だけ＋役牌でない雀頭＋両面待ち。' },
    chiitoi: { ja: '七対子', han: 2, desc: '同じ牌2枚を7組。' },
    iipeiko: { ja: '一盃口', han: 1, desc: 'まったく同じ順子が2組。門前限定。' },
    haitei: { ja: '海底摸月', han: 1, desc: '山の最後の1枚でツモあがり。' },
    houtei: { ja: '河底撈魚', han: 1, desc: '最後の捨て牌でロンあがり。' },
    rinshan: { ja: '嶺上開花', han: 1, desc: 'カンをして引いた嶺上牌でツモあがり。' },
    chankan: { ja: '槍槓', han: 1, desc: '他家が加槓した牌でロンあがり。' },
    sankantsu: { ja: '三槓子', han: 2, desc: 'カンを3回している。' },
    ittsu: { ja: '一気通貫', han: 2, naki: 1, desc: '同じ色で123・456・789がそろう。鳴くと1翻。' },
    sanshoku: { ja: '三色同順', han: 2, naki: 1, desc: '萬子・筒子・索子で同じ数の順子。鳴くと1翻。' },
    toitoi: { ja: '対々和', han: 2, desc: '4つの組が全部刻子（同じ牌3枚）。' },
    sanankou: { ja: '三暗刻', han: 2, desc: '鳴かずにそろえた刻子が3つ（ロンで完成した刻子は数えない）。' },
    sanshokudoukou: { ja: '三色同刻', han: 2, desc: '萬子・筒子・索子で同じ数の刻子（槓子も含む）。鳴いても2翻。' },
    chanta: { ja: '混全帯幺九', han: 2, naki: 1, desc: 'すべての組と雀頭に1・9・字牌が入る（順子を含む）。鳴くと1翻。' },
    shousangen: { ja: '小三元', han: 2, desc: '白・發・中のうち2つが刻子、残り1つが雀頭。' },
    honroutou: { ja: '混老頭', han: 2, desc: '1・9と字牌だけでできている。' },
    ryanpeikou: { ja: '二盃口', han: 3, desc: '一盃口が2組。門前限定。七対子とは複合しない。' },
    junchan: { ja: '純全帯幺九', han: 3, naki: 2, desc: 'すべての組と雀頭に1・9が入る（字牌なし）。鳴くと2翻。' },
    honitsu: { ja: '混一色', han: 3, naki: 2, desc: '1種類の数牌と字牌だけ。鳴くと2翻。' },
    chinitsu: { ja: '清一色', han: 6, naki: 5, desc: '1種類の数牌だけ。鳴くと5翻。' },
    kokushi: { ja: '国士無双', han: 13, desc: '1・9・字牌13種類を1枚ずつ＋どれか1枚。役満。' },
    suuankou: { ja: '四暗刻', han: 13, desc: '鳴かずにそろえた刻子が4つ。役満。' },
    daisangen: { ja: '大三元', han: 13, desc: '白・發・中の3つとも刻子。役満。' },
    tsuuiisou: { ja: '字一色', han: 13, desc: '字牌だけでできている（七対子の形でもよい）。役満。' },
    chinroutou: { ja: '清老頭', han: 13, desc: '1と9の数牌だけでできている。役満。' },
    ryuuiisou: { ja: '緑一色', han: 13, desc: '2・3・4・6・8の索子と發だけでできている。役満。' },
    daisuushii: { ja: '大四喜', han: 13, desc: '東・南・西・北の4つとも刻子。役満。' },
    shousuushii: { ja: '小四喜', han: 13, desc: '風牌のうち3つが刻子、残り1つが雀頭。役満。' },
    chuuren: { ja: '九蓮宝燈', han: 13, desc: '1種類の数牌で1112345678999の形＋同じ色の1枚。門前限定。役満。' },
    suukantsu: { ja: '四槓子', han: 13, desc: 'カンを4回している。役満。' },
    // ここから下は局の進み方で決まる役（対局の中で付ける）
    dblriichi: { ja: 'ダブルリーチ', han: 2, desc: '最初の打牌で、だれも鳴いていないうちにリーチする。門前限定。' },
    tenhou: { ja: '天和', han: 13, desc: '親が配牌の14枚（最初のツモ）であがっている。役満。' },
    chiihou: { ja: '地和', han: 13, desc: '子が、だれも鳴いていないうちに最初のツモであがる。役満。' },
  };
  const YAKUMAN = new Set(['kokushi', 'suuankou', 'daisangen', 'tsuuiisou', 'chinroutou', 'ryuuiisou', 'daisuushii', 'shousuushii', 'chuuren', 'suukantsu', 'tenhou', 'chiihou']);
  const GREEN = new Set(['s2', 's3', 's4', 's6', 's8', 'z6']);
  const WINDS = ['z1', 'z2', 'z3', 'z4'];
  const DRAGONS = ['z5', 'z6', 'z7'];

  /** 基本点（符×2^(翻+2)。満貫以上は区切りの値） */
  function basePoints(han, fu) {
    if (han >= 13) return 8000;
    if (han >= 11) return 6000;
    if (han >= 8) return 4000;
    if (han >= 6) return 3000;
    const b = fu * 2 ** (han + 2);
    return han >= 5 || b >= 2000 ? 2000 : b;
  }
  const up100 = (x) => Math.ceil(x / 100) * 100;
  /** ロンの点数 */
  const ronPoints = (han, fu, oya) => up100(basePoints(han, fu) * (oya ? 6 : 4));
  /** ツモの支払い：{ fromOya, fromKo }（親のツモなら fromKo だけ） */
  const tsumoPoints = (han, fu, oya) => {
    const b = basePoints(han, fu);
    return oya ? { fromKo: up100(b * 2) } : { fromOya: up100(b * 2), fromKo: up100(b) };
  };

  /**
   * 七対子も含めたシャンテン数（国士無双は入門では扱わないので含めない）。
   * 七対子：6 − 対子の種類数 ＋ 足りない種類数（7種類に満たないぶん）
   */
  function shantenAll(tiles, sets = 4) {
    const normal = shanten(tiles, sets);
    if (sets !== 4 || tiles.length < 13) {
      return normal === 0 && tiles.length % 3 === 1 && !waits(tiles, sets).length ? 1 : normal;
    }
    const c = toCounts(tiles);
    const pairs = c.filter((n) => n >= 2).length;
    const kinds = c.filter((n) => n >= 1).length;
    const chiitoi = 6 - pairs + Math.max(0, 7 - kinds);
    const best = Math.min(normal, chiitoi);
    // 形はテンパイでも、待ちが「自分で4枚持っている牌」だけなら、あがれないので1シャンテンと同じ
    if (best === 0 && tiles.length % 3 === 1 && !waits(tiles, sets).length) return 1;
    return best;
  }

  /** 役の翻数（鳴いていると下がる役がある） */
  const yakuHan = (k, menzen) => {
    const y = YAKU_JA[k];
    if (!y) return 0;
    return menzen ? y.han : (y.naki ?? y.han);
  };

  const yakuhaiSet = (ctx) => new Set(['z5', 'z6', 'z7', ctx.seatWind, ctx.roundWind].filter(Boolean));
  /** 役牌1組あたりの翻（三元牌1翻、自風・場風それぞれ1翻＝連風牌2翻） */
  const yakuhaiHanOf = (t, ctx) => (DRAGONS.includes(t) ? 1
    : (t === ctx.seatWind ? 1 : 0) + (t === ctx.roundWind ? 1 : 0));

  const EMPTY_EVAL = () => ({ list: [], han: 0, fu: 0, yakuhai: 0, yakuman: false });

  /**
   * 和了形を採点する。役・翻・符は必ず「同じ分け方・同じあがり牌の当てはめ方」から数え、
   * いちばん点数が高い解釈を採る（分け方ごとに役と符を混ぜると、ありえない組み合わせになる）。
   * tiles は手の中の牌（あがり牌を含む）。鳴いた組は ctx.melds（4枚ならカン）。
   * ctx: { riichi, tsumo, menzen, seatWind, roundWind, winTile, melds, last }
   *   last … 山の最後の牌でのあがり（ツモなら海底、ロンなら河底）
   * 返り値: { list, han, fu, yakuhai, yakuman }（ドラ・一発は含まない）
   */
  function evaluateHand(tiles, ctx = {}) {
    // 赤5は役や符の上では普通の5と同じ。ここで揃えておく（赤ドラの枚数は呼び出し側で数える）
    tiles = tiles.map(norm);
    ctx = { ...ctx, winTile: norm(ctx.winTile) };
    // 鳴いた組は [牌…]（副露）か { tiles, closed }（closed: true は暗槓）で受け取る
    const melds = (ctx.melds || []).map((m) => (Array.isArray(m) ? { tiles: m.map(norm), closed: false } : { tiles: m.tiles.map(norm), closed: !!m.closed }));
    const sets = 4 - melds.length;
    const menzen = ctx.menzen !== false && melds.every((m) => m.closed);   // 暗槓だけなら門前のまま
    if (!isWin(tiles, sets)) return EMPTY_EVAL();

    // 国士無双は役満。ほかの役とは複合させない
    if (sets === 4 && isKokushi(tiles)) return { list: ['kokushi'], han: 13, fu: 30, yakuhai: 0, yakuman: true };

    const all = [...tiles, ...melds.flatMap((m) => m.tiles)];
    // 分け方によらない役
    const common = [];
    if (ctx.riichi && menzen) common.push('riichi');
    if (ctx.tsumo && menzen) common.push('tsumo');
    if (ctx.rinshan && ctx.tsumo) common.push('rinshan');
    else if (ctx.last) common.push(ctx.tsumo ? 'haitei' : 'houtei');   // 嶺上牌は海底牌ではない
    if (ctx.chankan && !ctx.tsumo) common.push('chankan');
    if (melds.filter((m) => m.tiles.length === 4).length >= 3) common.push('sankantsu');
    if (!all.some(isYaochu)) common.push('tanyao');          // 喰いタンあり
    if (all.every(isYaochu)) common.push('honroutou');
    const suits = new Set(all.filter((t) => !isHonor(t)).map((t) => t[0]));
    if (suits.size === 1) common.push(all.some(isHonor) ? 'honitsu' : 'chinitsu');

    const sum = (list, yh) => list.reduce((a, k) => a + (k === 'yakuhai' ? yh : yakuHan(k, menzen)), 0);
    const cands = [];

    // 分け方によらない役満（字一色・清老頭・緑一色・九蓮宝燈・四槓子）
    const ykCommon = [];
    if (all.every(isHonor)) ykCommon.push('tsuuiisou');
    if (all.every(isTerminal)) ykCommon.push('chinroutou');
    if (all.every((t) => GREEN.has(t))) ykCommon.push('ryuuiisou');
    if (melds.filter((m) => m.tiles.length === 4).length === 4) ykCommon.push('suukantsu');
    if (!melds.length && suits.size === 1 && !all.some(isHonor)) {
      const c = toCounts(tiles), b = toIndex(`${[...suits][0]}1`);
      const need = [3, 1, 1, 1, 1, 1, 1, 1, 3];
      if (need.every((k, i) => c[b + i] >= k)) ykCommon.push('chuuren');
    }

    // 七対子（二盃口の形でも、下の分け方の方が高ければそちらが採られる）
    if (sets === 4 && isChiitoi(tiles)) {
      const list = [...common, 'chiitoi'];
      if (ykCommon.includes('tsuuiisou')) cands.push({ list: ['tsuuiisou'], han: 13, fu: 25, yakuhai: 0, yakuman: true });
      else cands.push({ list, han: sum(list, 0), fu: 25, yakuhai: 0, yakuman: false });
    }

    const yhTiles = yakuhaiSet(ctx);
    const meldSets = melds.map((m) => ({ t: sortTiles(m.tiles).slice(0, 3), n: m.tiles.length, open: !m.closed }));
    const isSeq = (s) => s[0] !== s[1];
    const w = ctx.winTile;

    for (const d of decompose(tiles, sets)) {
      const places = [];
      if (w && d.pair === w) places.push({ kind: 'pair' });
      d.sets.forEach((s, i) => { if (w && s.includes(w)) places.push({ kind: 'set', i }); });
      if (!places.length) places.push({ kind: 'none' });

      for (const pl of places) {
        // この解釈での全ての組（手の中＋鳴き）。ロンで完成した刻子は明刻扱い
        const groups = [
          ...d.sets.map((t, i) => ({ t, n: 3, open: !ctx.tsumo && pl.kind === 'set' && pl.i === i && !isSeq(t) })),
          ...meldSets,
        ];
        const seqs = groups.filter((g) => isSeq(g.t));
        const trips = groups.filter((g) => !isSeq(g.t));
        const list = [...common];
        const yaku = [];
        const yakuman = [...ykCommon];
        // 四喜和
        const windTrips = trips.filter((g) => WINDS.includes(g.t[0])).length;
        if (windTrips === 4) yakuman.push('daisuushii');
        else if (windTrips === 3 && WINDS.includes(d.pair)) yakuman.push('shousuushii');

        // 役牌
        let yh = 0;
        for (const g of trips) yh += yakuhaiHanOf(g.t[0], ctx);
        if (yh > 0) yaku.push('yakuhai');

        // ピンフ：門前・順子だけ・役牌でない雀頭・両面待ち
        const winSet = pl.kind === 'set' ? d.sets[pl.i] : null;
        let ryanmen = false;
        if (winSet && isSeq(winSet)) {
          const pos = winSet.indexOf(w), lo = Number(winSet[0][1]);
          ryanmen = (pos === 0 && lo !== 7) || (pos === 2 && lo !== 1);
        }
        const pinfu = menzen && !trips.length && !yhTiles.has(d.pair) && ryanmen;
        if (pinfu) yaku.push('pinfu');

        // 一盃口／二盃口（門前）
        if (menzen) {
          const cnt = new Map();
          for (const g of seqs) { const k = g.t.join(''); cnt.set(k, (cnt.get(k) || 0) + 1); }
          const pairsOfSeq = [...cnt.values()].reduce((a, n) => a + Math.floor(n / 2), 0);
          if (pairsOfSeq >= 2) yaku.push('ryanpeikou');
          else if (pairsOfSeq === 1) yaku.push('iipeiko');
        }

        // 一気通貫・三色同順
        const hasSeq = (tile) => seqs.some((g) => g.t[0] === tile);
        if (['m', 'p', 's'].some((c) => [1, 4, 7].every((n) => hasSeq(`${c}${n}`)))) yaku.push('ittsu');
        if ([1, 2, 3, 4, 5, 6, 7].some((n) => ['m', 'p', 's'].every((c) => hasSeq(`${c}${n}`)))) yaku.push('sanshoku');

        // 刻子系
        if (groups.length === 4 && !seqs.length) yaku.push('toitoi');
        const concealed = trips.filter((g) => !g.open).length;
        if (concealed === 4) yakuman.push('suuankou');
        else if (concealed === 3) yaku.push('sanankou');
        // 三色同刻（萬子・筒子・索子で同じ数の刻子）
        const hasTrip = (tile) => trips.some((g) => g.t[0] === tile);
        if ([1, 2, 3, 4, 5, 6, 7, 8, 9].some((n) => ['m', 'p', 's'].every((c) => hasTrip(`${c}${n}`)))) yaku.push('sanshokudoukou');

        // 三元牌
        const dragonTrips = trips.filter((g) => DRAGONS.includes(g.t[0])).length;
        if (dragonTrips === 3) yakuman.push('daisangen');
        else if (dragonTrips === 2 && DRAGONS.includes(d.pair)) yaku.push('shousangen');

        // チャンタ／純チャン（順子を1つ以上含み、全ての組と雀頭に幺九牌）
        if (seqs.length && isYaochu(d.pair) && groups.every((g) => g.t.some(isYaochu))) {
          yaku.push(all.some(isHonor) ? 'chanta' : 'junchan');
        }

        if (yakuman.length) {
          // 役満が重なっても、点数は役満1つ分として数える（ダブル役満は扱わない）
          cands.push({ list: [...new Set(yakuman)], han: 13, fu: 30, yakuhai: 0, yakuman: true });
          continue;
        }

        // 符
        let fu;
        if (pinfu) fu = ctx.tsumo ? 20 : 30;
        else {
          fu = 20;
          if (menzen && !ctx.tsumo) fu += 10;          // 門前ロン
          if (ctx.tsumo) fu += 2;                       // ツモ
          for (const g of trips) {
            const y = isYaochu(g.t[0]) ? 2 : 1;
            if (g.n === 4) fu += (g.open ? 8 : 16) * y;  // 明槓 8/16・暗槓 16/32
            else fu += (g.open ? 2 : 4) * y;            // 明刻 2/4・暗刻 4/8
          }
          fu += (DRAGONS.includes(d.pair) ? 2 : 0)
            + (d.pair === ctx.seatWind ? 2 : 0) + (d.pair === ctx.roundWind ? 2 : 0);
          if (pl.kind === 'pair') fu += 2;               // 単騎
          else if (winSet && isSeq(winSet) && !ryanmen) fu += 2;   // 嵌張・辺張
          if (!menzen && fu === 20) fu = 30;             // 鳴いた平和形は30符
          fu = Math.ceil(fu / 10) * 10;
        }

        const full = [...list, ...yaku];
        cands.push({ list: full, han: sum(full, yh), fu, yakuhai: yh, yakuman: false });
      }
    }

    if (!cands.length) return EMPTY_EVAL();
    // 役のない解釈より役のある解釈、その中で点数が高いもの（同じ点数なら翻、さらに符の多い方）
    const value = (c) => (c.han > 0 ? basePoints(c.han, c.fu) * 1e5 + c.han * 1e3 + c.fu : -1);
    cands.sort((a, b) => value(b) - value(a));
    const best = cands[0];
    return { ...best, list: [...new Set(best.list)] };
  }

  /**
   * 成立する役を判定する（入門レッスンで扱う範囲）。evaluateHand のいちばん高い解釈の役。
   * ctx: { riichi, tsumo, menzen, seatWind: 'z1'.., roundWind: 'z1'.., winTile, melds, last }
   */
  const judgeYaku = (tiles, ctx = {}) => evaluateHand(tiles, ctx).list;

  /** 符（役と同じ解釈から数える） */
  function calcFu(tiles, ctx = {}) {
    return evaluateHand(tiles, ctx).fu || 30;
  }

  /** 役牌の翻数（刻子1つにつき1翻。連風牌は2翻）。鳴いた刻子・槓子も数える */
  function countYakuhai(tiles, ctx = {}) {
    return evaluateHand(tiles, ctx).yakuhai;
  }
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  /** 和了形をランダムに「組み立てる」（抽選では当たらないので構成する） */
  function randomWinHand({ sets = 4, tanyao = false, honors = true } = {}) {
    const pool = ALL_TILES.filter((t) => (tanyao ? !isYaochu(t) : honors || !isHonor(t)));
    for (let attempt = 0; attempt < 300; attempt++) {
      const counts = new Array(34).fill(0);
      const tryAdd = (tiles) => {
        const tmp = counts.slice();
        for (const t of tiles) { tmp[toIndex(t)]++; if (tmp[toIndex(t)] > 4) return false; }
        for (const t of tiles) counts[toIndex(t)]++;
        return true;
      };
      const randMeld = () => {
        if (Math.random() < 0.6) {
          const s = pick(['m', 'p', 's']);
          const lo = tanyao ? 2 : 1, hi = tanyao ? 6 : 7;
          const n = lo + Math.floor(Math.random() * (hi - lo + 1));
          return [s + n, s + (n + 1), s + (n + 2)];
        }
        const t = pick(pool);
        return [t, t, t];
      };
      const pairTile = pick(pool);
      if (!tryAdd([pairTile, pairTile])) continue;
      let ok = true;
      for (let i = 0; i < sets && ok; i++) {
        let placed = false;
        for (let k = 0; k < 40 && !placed; k++) placed = tryAdd(randMeld());
        ok = placed;
      }
      if (!ok) continue;
      const hand = sortTiles(fromCounts(counts));
      if (hand.length !== sets * 3 + 2 || !isAgari(hand, sets)) continue;
      return hand;
    }
    return null;
  }

  /**
   * テンパイ形をランダムに作る（練習問題の自動生成用）
   * waitTypes を渡すと「両面だけ」「嵌張だけ」といった出題ができる
   */
  function randomTenpai({ sets = 4, tanyao = false, honors = true, waitTypes = null } = {}) {
    for (let i = 0; i < 200; i++) {
      const hand = randomWinHand({ sets, tanyao, honors });
      if (!hand) continue;
      const t13 = [...hand];
      const winTile = t13.splice(Math.floor(Math.random() * t13.length), 1)[0];
      const w = waits(t13, sets);
      if (!w.length) continue;
      if (waitTypes) {
        // 待ち牌すべてについて形を調べる（1枚だけ見ると、別の形の待ちが混ざる）
        const types = new Set(w.flatMap((t) => waitType(t13, t, sets)));
        if (!types.size || ![...types].every((t) => waitTypes.includes(t))) continue;
      }
      return { tiles: sortTiles(t13), waits: w, winTile };
    }
    return null;
  }

  return { isRed, norm, SUITS, SUIT_JA, SUIT_YOMI, HONOR_JA, HONOR_YOMI, NUM_YOMI, ALL_TILES, toIndex, fromIndex, isHonor, isTerminal, isYaochu, tileName, tileYomi, toCounts, fromCounts, sortTiles, makeWall, decompose, isAgari, isChiitoi, isKokushi, isWin, waits, isTenpai, WAIT_TYPES, waitType, shanten, shantenAll, YAKU_JA, YAKUMAN, yakuHan, evaluateHand, judgeYaku, countYakuhai, calcFu, basePoints, ronPoints, tsumoPoints, randomWinHand, randomTenpai };
};
const NS_MAHJONG = MAHJONG_FACTORY();

// ── js/games/mahjong4.js ────────────────────────────────────
const NS_MJ4 = (() => {
  const M = NS_MAHJONG;
  // mahjong4.js — 4人打ちの局進行。
  //
  // 方針：鳴きは最初から実装しておき、rule.naki で開け閉めする。
  // 入門のコースでは閉じて始め、後のコースで開ける。
  // 点数は符計算をせず、翻数からの簡易表で出す（入門では符は教えないため）。


  const SEAT_JA = ['東', '南', '西', '北'];
  const SEAT_TILE = ['z1', 'z2', 'z3', 'z4'];

  const DEFAULT_RULE = {
    naki: false,      // ポン・チーを許すか
    kan: false,       // カンを許すか
    startScore: 25000,
    handLimit: 0,     // 1人あたりの最大ツモ数。0 なら通常どおり70枚
    aka: false,       // 赤ドラ（萬子・筒子・索子の5を1枚ずつ赤にする）
  };

  /** 配列から牌を1枚抜く。同じ牌があればそれを、なければ赤5と普通の5を同じものとして探す */
  function takeTile(arr, t) {
    let i = arr.indexOf(t);
    if (i < 0) i = arr.findIndex((x) => M.norm(x) === M.norm(t));
    return i < 0 ? null : arr.splice(i, 1)[0];
  }

  /**
   * 喰い替えで切れなくなる牌（種類）。ポンは鳴いた牌、チーは鳴いた牌と「筋の反対側」。
   * 例：4・5を持って3をチー → 3と6は切れない
   */
  function kuikaeBan(type, tile, pat) {
    const t = M.norm(tile);
    if (type === 'pon') return [t];
    if (type !== 'chi') return [];
    const n = Number(t[1]);
    const nums = [n, ...pat.map((x) => Number(M.norm(x)[1]))].sort((a, b) => a - b);
    const ban = [t];
    if (n === nums[0] && n + 3 <= 9) ban.push(t[0] + (n + 3));
    if (n === nums[2] && n - 3 >= 1) ban.push(t[0] + (n - 3));
    return ban;
  }

  /** 点数の呼び名。満貫未満は「翻・符」で表す（点数は M.ronPoints / M.tsumoPoints で計算） */
  function scoreLabel(han, fu) {
    if (han >= 13) return '役満';
    if (han >= 11) return '三倍満';
    if (han >= 8) return '倍満';
    if (han >= 6) return '跳満';
    if (M.basePoints(han, fu) >= 2000) return '満貫';
    return `${han}翻${fu}符`;
  }

  class Game {
    constructor(rule = {}) {
      this.rule = { ...DEFAULT_RULE, ...rule };
      this.scores = [0, 1, 2, 3].map(() => this.rule.startScore);
      this.oya = 0;
      this.round = 0;      // 0=東場
      this.kyoku = 1;
      this.honba = 0;
      this.riichiSticks = 0;
      this.log = [];
    }

    /** 新しい局を始める */
    deal(sameWall = null) {
      // 「同じ配牌でやり直す」ときは、前に配った山をそのまま使う
      const wall = sameWall ? [...sameWall] : M.makeWall();
      if (this.rule.aka && !sameWall) {
        // 各色の5のうち1枚を赤にする（山は混ぜたあとなので、最初に見つかった1枚でよい）
        for (const s of ['m', 'p', 's']) { const i = wall.indexOf(s + '5'); if (i >= 0) wall[i] = s + '0'; }
      }
      this.dealtWall = [...wall];                // 配った山（同じ配牌でやり直すために覚えておく）
      this.dora = wall.pop();                    // ドラ表示牌
      // 先に配牌を取り、そのあとで「ツモれる枚数」を決める。
      // 順番を逆にすると、山が尽きて誰もあがれない局になる。
      this.hands = [0, 1, 2, 3].map(() => M.sortTiles(wall.splice(0, 13)));
      const draws = this.rule.handLimit ? this.rule.handLimit * 4 : 70;
      this.wall = wall.slice(0, Math.min(draws, 70));
      // 王牌の残り（嶺上牌とカンドラ表示牌に使う）
      this.dead = wall.slice(70);
      // 裏ドラ表示牌：表のドラ表示牌（最初の1枚＋カンドラ最大4枚）それぞれの「下」にある牌。
      // 王牌13枚のうち5枚を先に取り分けておく。残り8枚でカン4回ぶん（カンドラ表示牌4枚＋嶺上牌4枚）が足りる
      this.uraPool = this.dead.splice(0, 5);
      this.doraInds = [this.dora];
      this.kanCount = 0;
      this.kanBy = [];        // カンをした人（四開槓の判定用）
      this.rinshan = false;   // いまのツモ牌が嶺上牌か
      this.melds = [[], [], [], []];
      this.discards = [[], [], [], []];
      this.riichi = [false, false, false, false];
      this.dblRiichi = [false, false, false, false];   // ダブルリーチ（最初の打牌でのリーチ）
      this.riichiAt = [-1, -1, -1, -1];
      this.ippatsu = [false, false, false, false];
      this.tempFuriten = [false, false, false, false];   // 見逃し（次に自分が切るまで）
      this.riichiFuriten = [false, false, false, false]; // リーチ後の見逃し（局の終わりまで）
      this.kuikae = null;     // { p, ban: [...] } 鳴いた直後に切れない牌
      // 「やり直す」で局の途中から戻すときのために、配牌時点の点棒を覚えておく
      this.startScores = [...this.scores];
      this.startSticks = this.riichiSticks;
      this.lastDiscard = null;
      this.turn = this.oya;
      this.drawn = null;      // いまツモった牌
      this.phase = 'draw';    // draw | discard | call | end
      this.pending = null;    // 鳴き／ロンの待ち
      this.result = null;
      this.turnCount = 0;
      this.log = [];
      return this;
    }

    // --- 風 -----------------------------------------------------------------
    seatWind(p) { return SEAT_TILE[(p - this.oya + 4) % 4]; }
    roundWind() { return SEAT_TILE[this.round]; }
    seatJa(p) { return SEAT_JA[(p - this.oya + 4) % 4]; }
    isOya(p) { return p === this.oya; }

    /** ドラ表示牌から実際のドラを求める */
    doraTile() {
      // 表示牌が赤5（m0 など）でも正しく次の牌を返すよう、nextOf に任せる
      return this.dora ? Game.nextOf(this.dora) : null;
    }
    /** 表示牌1枚から、実際のドラ（表示牌の次の牌）を求める */
    static nextOf(t) {
      t = M.norm(t);
      const s = t[0], n = Number(t[1]);
      if (s === 'z') return n <= 4 ? `z${(n % 4) + 1}` : `z${((n - 5 + 1) % 3) + 5}`;
      return `${s}${(n % 9) + 1}`;
    }
    /** 表示牌すべて（カンドラを含む）から実際のドラを求める */
    doraTiles() {
      return (this.doraInds || [this.dora]).filter(Boolean).map(Game.nextOf);
    }
    /** いまめくれる裏ドラ表示牌（表の表示牌と同じ枚数だけ。カンをするとカン裏も増える） */
    uraInds() {
      return (this.uraPool || []).slice(0, (this.doraInds || [this.dora]).length);
    }
    /** 裏ドラの枚数。extra にあがり牌を渡すと、それも数える */
    uraCount(p, extra = null) {
      const ds = this.uraInds().map(Game.nextOf);
      if (!ds.length) return 0;
      const all = [...this.hands[p], ...this.melds[p].flatMap((m) => m.tiles), ...(extra ? [extra] : [])];
      return ds.reduce((a, d) => a + all.filter((t) => M.norm(t) === d).length, 0);
    }
    /** 赤ドラの枚数 */
    akaCount(p, extra = null) {
      const all = [...this.hands[p], ...this.melds[p].flatMap((m) => m.tiles), ...(extra ? [extra] : [])];
      return all.filter(M.isRed).length;
    }
    /** その牌をいま切れるか（喰い替えの禁止） */
    canDiscard(p, t) {
      return !(this.kuikae && this.kuikae.p === p && this.kuikae.ban.includes(M.norm(t)));
    }
    /** extra にあがり牌を渡すと、それも数える */
    doraCount(p, extra = null) {
      const ds = this.doraTiles();
      if (!ds.length) return 0;
      const all = [...this.hands[p], ...this.melds[p].flatMap((m) => m.tiles), ...(extra ? [extra] : [])];
      return ds.reduce((a, d) => a + all.filter((t) => M.norm(t) === d).length, 0);
    }

    /** 局の途中でやり直すとき、点棒と供託を配牌時点に戻す */
    rollback() {
      if (this.startScores) this.scores = [...this.startScores];
      this.riichiSticks = this.startSticks ?? this.riichiSticks;
    }

    /** 手の中で使える面子の数（鳴いた分を引く） */
    setsNeeded(p) { return 4 - this.melds[p].length; }
    /** 門前か（暗槓だけなら門前のまま） */
    isMenzen(p) { return this.melds[p].every((m) => m.type === 'ankan'); }
    /** 役の判定に渡す形 */
    meldsFor(p) { return this.melds[p].map((m) => ({ tiles: m.tiles, closed: m.type === 'ankan' })); }

    // --- カン -----------------------------------------------------------------
    /** 自分の手番でできるカン（暗槓・加槓）。ツモった直後だけ */
    kanOptions(p = this.turn) {
      if (!this.rule.kan || p !== this.turn || this.phase !== 'discard' || !this.drawn) return [];
      if (this.kanCount >= 4 || !this.wall.length || this.dead.length < 2) return [];
      const hand = this.fullHand(p);
      const c = M.toCounts(hand);
      const out = [];
      for (const t of new Set(hand.map(M.norm))) {
        if (c[M.toIndex(t)] < 4) continue;
        if (this.riichi[p]) {
          // リーチ後の暗槓は、ツモった牌で、待ちが変わらないときだけ
          if (t !== M.norm(this.drawn)) continue;
          const before = M.waits(M.sortTiles(this.hands[p]), this.setsNeeded(p)).join();
          const rest = hand.filter((x) => M.norm(x) !== t);
          const after = M.waits(M.sortTiles(rest), this.setsNeeded(p) - 1).join();
          if (!before || before !== after) continue;
        }
        out.push({ type: 'ankan', tile: t });
      }
      if (!this.riichi[p]) {
        for (const m of this.melds[p]) {
          if (m.type === 'pon' && hand.some((x) => M.norm(x) === M.norm(m.tiles[0]))) out.push({ type: 'kakan', tile: M.norm(m.tiles[0]) });
        }
      }
      return out;
    }

    /**
     * 暗槓・加槓をする。加槓は他家の槍槓（ロン）を先に確かめ、
     * ロンできる人がいれば phase='call' で返す（見送られたら passCalls で嶺上牌を引く）。
     */
    selfKan(p, type, tile) {
      if (!this.kanOptions(p).some((o) => o.type === type && o.tile === tile)) return null;
      const hand = this.fullHand(p);
      if (type === 'ankan') {
        this.hands[p] = hand.filter((t) => M.norm(t) !== tile);
        this.melds[p].push({ type: 'ankan', tiles: M.sortTiles(hand.filter((t) => M.norm(t) === tile)), from: p });
      } else {
        const added = takeTile(hand, tile);
        this.hands[p] = hand;
        const m = this.melds[p].find((x) => x.type === 'pon' && M.norm(x.tiles[0]) === tile);
        m.type = 'kakan';
        m.tiles = [...m.tiles, added];
        tile = added;   // 槍槓で奪われるのは、実際に加えた1枚
      }
      this.drawn = null;
      for (let i = 0; i < 4; i++) this.ippatsu[i] = false;
      this.log.push({ kind: 'kan', p, type, tile });
      if (type === 'kakan') {
        // 槍槓：加槓した牌でロンできる人がいるか
        this.lastDiscard = { p, tile, chankan: true };
        const rons = [];
        for (let i = 0; i < 4; i++) {
          if (i === p) continue;
          const h = M.sortTiles([...this.hands[i], tile]);
          if (M.isWin(h, this.setsNeeded(i)) && !this.isFuriten(i) && this.yakuOf(i, tile, false).han > 0) {
            rons.push({ p: i, type: 'ron', tile });
          }
        }
        if (rons.length) { this.phase = 'call'; this.pending = rons; return rons; }
      }
      this._afterKan(p);
      return [];
    }

    /** カンのあと：新しいドラ表示牌をめくり、嶺上牌を引く。海底は1枚手前にずれる */
    _afterKan(p) {
      this.kanCount++;
      this.kanBy.push(p);
      if (this.dead.length > 1) this.doraInds.push(this.dead.shift());
      this.drawn = this.dead.pop();
      if (this.wall.length) this.wall.shift();
      this.turn = p;
      this.turnCount++;
      this.rinshan = true;
      this.pending = null;
      this.phase = 'discard';
    }

    // --- 進行 ---------------------------------------------------------------
    /** ツモる。山が尽きたら流局 */
    draw() {
      if (this.phase !== 'draw') return null;
      if (!this.wall.length) { this.exhaustive(); return null; }
      this.drawn = this.wall.pop();
      this.turnCount++;
      this.phase = 'discard';
      return this.drawn;
    }

    /** いまの手牌（ツモ牌を含む） */
    fullHand(p) {
      return p === this.turn && this.drawn
        ? M.sortTiles([...this.hands[p], this.drawn])
        : M.sortTiles(this.hands[p]);
    }

    /** ツモあがりできるか */
    canTsumo(p = this.turn) {
      if (p !== this.turn || !this.drawn) return false;
      const hand = this.fullHand(p);
      if (!M.isWin(hand, this.setsNeeded(p))) return false;
      return this.yakuOf(p, this.drawn, true).han > 0;
    }

    /** リーチを宣言できるか。宣言できる場合は、切れる牌の一覧を返す */
    riichiOptions(p = this.turn) {
      if (this.riichi[p] || !this.isMenzen(p) || this.scores[p] < 1000) return [];
      if (p !== this.turn || !this.drawn) return [];
      if (this.wall.length < 4) return [];   // 残りツモが1巡ないとリーチできない
      const hand = this.fullHand(p);
      const out = [];
      for (const t of new Set(hand)) {
        const rest = [...hand];
        rest.splice(rest.indexOf(t), 1);
        if (M.isTenpai(rest, this.setsNeeded(p))) out.push(t);
      }
      return out;
    }

    /** フリテンか（自分の捨て牌に待ちがある／見逃した直後／リーチ後に見逃した） */
    isFuriten(p) {
      if (this.tempFuriten[p] || this.riichiFuriten[p]) return true;
      const hand = M.sortTiles(this.hands[p]);
      const w = M.waits(hand, this.setsNeeded(p));
      if (!w.length) return false;
      return w.some((t) => this.discards[p].some((d) => M.norm(d.tile) === t));
    }

    /** 牌を切る。鳴き・ロンの確認へ進む */
    discard(tile, { riichi = false } = {}) {
      if (this.phase !== 'discard') return;
      const p = this.turn;
      // リーチ後はツモ切りしかできない
      if (this.riichi[p] && this.drawn && tile !== this.drawn) return;
      if (!this.canDiscard(p, tile)) return;   // 喰い替え
      this.kuikae = null;
      const hand = this.fullHand(p);
      const i = hand.indexOf(tile);
      if (i < 0) return;
      hand.splice(i, 1);
      this.tempFuriten[p] = false;   // 同巡内フリテンは自分が切れば解ける
      this.hands[p] = hand;
      this.drawn = null;
      this.rinshan = false;
      if (riichi) {
        this.riichi[p] = true;
        // 最初の打牌で、まだだれも鳴いて（カンして）いなければダブルリーチ
        this.dblRiichi[p] = !this.discards[p].length && !this.log.some((e) => e.kind === 'call' || e.kind === 'kan');
        this.riichiAt[p] = this.discards[p].length;
        this.ippatsu[p] = true;
        this.scores[p] -= 1000;
        this.riichiSticks++;
        this.log.push({ kind: 'riichi', p });
      } else if (this.ippatsu[p]) {
        this.ippatsu[p] = false;
      }
      this.discards[p].push({ tile, riichi });
      this.lastDiscard = { p, tile };
      this.log.push({ kind: 'discard', p, tile, riichi });
      this.phase = 'call';
      this.pending = this.collectCalls(p, tile);
      return this.pending;
    }

    /** その捨て牌に対して、誰が何をできるか */
    collectCalls(from, tile) {
      const calls = [];
      for (let i = 0; i < 4; i++) {
        if (i === from) continue;
        // ロン
        const hand = M.sortTiles([...this.hands[i], tile]);
        if (M.isWin(hand, this.setsNeeded(i)) && !this.isFuriten(i)) {
          if (this.yakuOf(i, tile, false).han > 0) calls.push({ p: i, type: 'ron', tile });
        }
        // 河底牌（山が尽きたあとの最後の捨て牌）は、ロン以外では鳴けない
        if (!this.rule.naki || this.riichi[i] || !this.wall.length) continue;
        const c = M.toCounts(this.hands[i]);
        // 鳴いたあとに切れる牌が1枚も残らない鳴きは、喰い替えになるのでできない
        const leaves = (used, type, pat) => {
          const rest = [...this.hands[i]];
          for (const u of used) takeTile(rest, u);
          const ban = kuikaeBan(type, tile, pat);
          return rest.some((x) => !ban.includes(M.norm(x)));
        };
        // ポン
        if (c[M.toIndex(tile)] >= 2 && leaves([tile, tile], 'pon')) calls.push({ p: i, type: 'pon', tile });
        // カン（大明槓）。山と嶺上牌が残っているときだけ
        if (this.rule.kan && c[M.toIndex(tile)] >= 3 && this.wall.length && this.kanCount < 4 && this.dead.length > 1) {
          calls.push({ p: i, type: 'kan', tile });
        }
        // チー（上家からのみ）
        if (this.rule.naki && i === (from + 1) % 4 && tile[0] !== 'z') {
          for (const pat of this.chiPatterns(i, tile)) if (leaves(pat, 'chi', pat)) calls.push({ p: i, type: 'chi', tile, pat });
        }
      }
      // ロンが最優先
      return calls.sort((a, b) => (a.type === 'ron' ? -1 : b.type === 'ron' ? 1 : 0));
    }

    chiPatterns(p, tile) {
      const c = M.toCounts(this.hands[p]);
      const s = tile[0], n = Number(M.norm(tile)[1]);
      const has = (m) => m >= 1 && m <= 9 && c[M.toIndex(s + m)] > 0;
      const out = [];
      if (has(n - 2) && has(n - 1)) out.push([s + (n - 2), s + (n - 1)]);
      if (has(n - 1) && has(n + 1)) out.push([s + (n - 1), s + (n + 1)]);
      if (has(n + 1) && has(n + 2)) out.push([s + (n + 1), s + (n + 2)]);
      return out;
    }

    /** ロンできたのに見送った人をフリテンにする（次に自分が切るまで。リーチしていれば局の終わりまで） */
    _markPassedRons() {
      for (const c of this.pending || []) {
        if (c.type !== 'ron') continue;
        this.tempFuriten[c.p] = true;
        if (this.riichi[c.p]) this.riichiFuriten[c.p] = true;
      }
    }

    /** 誰も鳴かない／ロンしないとき、次の人へ */
    passCalls() {
      if (this.phase !== 'call') return;
      this._markPassedRons();
      this.pending = null;
      // 槍槓を見送った：加槓した人が嶺上牌を引く
      if (this.lastDiscard.chankan) { this._afterKan(this.lastDiscard.p); return; }
      // 四開槓：2人以上で合わせて4回カンをして、その打牌が通ったら流局
      if (this.kanCount >= 4 && new Set(this.kanBy).size > 1) { this._abort('suukaikan'); return; }
      // 四風連打：1巡目に、だれも鳴かず（カンもせず）、4人とも同じ風牌を切ったら流局
      if (this.discards.every((d) => d.length === 1) && !this.log.some((e) => e.kind === 'call' || e.kind === 'kan')) {
        const first = this.discards.map((d) => M.norm(d[0].tile));
        if (['z1', 'z2', 'z3', 'z4'].includes(first[0]) && first.every((t) => t === first[0])) {
          this._abort('suufon'); this.result.tile = first[0]; return;
        }
      }
      // 四家立直：4人ともリーチして、4人目の宣言牌が通ったら流局（リーチ棒は場に残る）
      if (this.riichi.every(Boolean)) { this._abort('suucha'); return; }
      this.turn = (this.lastDiscard.p + 1) % 4;
      // 一発は「リーチした人が次に切るまで」と「誰かが鳴くまで」。ここでは消さない
      this.phase = 'draw';
    }

    /** 鳴く */
    call(p, type, tile, pat) {
      if (this.phase !== 'call') return;
      // ロンを見送ったあと、ほかの人がその牌を鳴いても、見送った人はフリテンになる（以前は鳴かれると記録されなかった）
      this._markPassedRons();
      const from = this.lastDiscard.p;
      let tiles;
      if (type === 'pon' || type === 'kan') {
        const n = type === 'pon' ? 2 : 3;
        tiles = [tile];
        for (let k = 0; k < n; k++) tiles.push(takeTile(this.hands[p], tile));
      } else {
        tiles = [tile];
        for (const t of pat) tiles.push(takeTile(this.hands[p], t));
        tiles = M.sortTiles(tiles);
      }
      this.kuikae = type === 'pon' || type === 'chi' ? { p, ban: kuikaeBan(type, tile, pat) } : null;
      this.melds[p].push({ type, tiles, from });
      this.discards[from][this.discards[from].length - 1].called = true;
      for (let i = 0; i < 4; i++) this.ippatsu[i] = false;
      this.turn = p;
      this.pending = null;
      this.phase = 'discard';
      this.log.push({ kind: 'call', p, type, tiles });
      // 大明槓のあとは嶺上牌を引いてから切る
      if (type === 'kan') this._afterKan(p);
    }

    // --- あがり -------------------------------------------------------------
    yakuOf(p, winTile, tsumo) {
      const hand = tsumo ? this.fullHand(p) : M.sortTiles([...this.hands[p], winTile]);
      const menzen = this.isMenzen(p);
      const concealed = M.isWin(hand, this.setsNeeded(p));
      if (!concealed) return { han: 0, list: [], extras: [], dora: 0 };
      const yctx = {
        riichi: this.riichi[p], tsumo, menzen,
        seatWind: this.seatWind(p), roundWind: this.roundWind(), winTile,
        melds: this.meldsFor(p),
        rinshan: tsumo && this.rinshan,
        chankan: !tsumo && !!this.lastDiscard?.chankan,
      };
      // 山の最後の牌（ツモなら海底、ロンなら河底）
      yctx.last = this.wall.length === 0;
      // 役・翻・符はすべて同じ解釈から数える（役牌は刻子の数だけ、連風牌は2翻）
      const ev = M.evaluateHand(hand, yctx);
      let list = ev.list;
      let han = ev.han;
      const fu = ev.fu;
      const extras = [];
      // 天和・地和：最初のツモ（自分はまだ1枚も切っていない・だれも鳴いて／カンしていない）であがった
      if (tsumo && ev.han > 0 && !this.discards[p].length && !this.log.some((e) => e.kind === 'call' || e.kind === 'kan')) {
        list = [this.isOya(p) ? 'tenhou' : 'chiihou', ...(ev.yakuman ? list : [])];
        han = 13;
      } else if (this.dblRiichi[p] && list.includes('riichi')) {
        // ダブルリーチはリーチより1翻多い
        list = list.map((k) => (k === 'riichi' ? 'dblriichi' : k));
        if (!ev.yakuman) han += 1;
      }
      // 役満（天和・地和を含む）には、一発・ドラ・赤ドラ・裏ドラを足さない（足しても点数は同じだが、「天和・ドラ1（14翻）」と出ていた）
      const yakuman = !!ev.yakuman || list[0] === 'tenhou' || list[0] === 'chiihou';
      if (yakuman) return { han: 13, fu, list, extras, dora: 0, ura: 0, yakuman: true };
      if (this.ippatsu[p] && this.riichi[p]) { han += 1; extras.push('一発'); }
      // hand は手の中の牌＋あがり牌。ロンのあがり牌も tsumo のツモ牌も hands[p] には入っていない
      const dora = this.doraCount(p, winTile);
      if (dora && han > 0) { han += dora; extras.push(`ドラ${dora}`); }
      const aka = han > 0 ? this.akaCount(p, winTile) : 0;
      if (aka) { han += aka; extras.push(`赤ドラ${aka}`); }
      // 裏ドラはリーチしてあがった人だけ。役がない手に裏ドラだけでは、あがれるようにはならない
      let ura = 0;
      if (this.riichi[p] && han > 0) {
        ura = this.uraCount(p, winTile);
        if (ura) { han += ura; extras.push(`裏ドラ${ura}`); }
      }
      return { han, fu, list, extras, dora, ura };
    }

    tsumo(p = this.turn) {
      const y = this.yakuOf(p, this.drawn, true);
      if (!y.han) return null;
      const t = M.tsumoPoints(y.han, y.fu, this.isOya(p));
      const pays = [0, 0, 0, 0];
      for (let i = 0; i < 4; i++) if (i !== p) pays[i] = this.isOya(i) ? t.fromOya : t.fromKo;
      this.settle(p, pays, y, { tsumo: true, tile: this.drawn });
      return this.result;
    }

    ron(p, tile = this.lastDiscard.tile) {
      const y = this.yakuOf(p, tile, false);
      if (!y.han) return null;
      // リーチ宣言牌でロンされたら、リーチは不成立。供託の1000点は本人に戻す
      const from = this.lastDiscard.p;
      const last = this.lastDiscard.chankan ? null : this.discards[from][this.discards[from].length - 1];
      if (this.lastDiscard.chankan) {
        // 槍槓：加槓された牌を奪うので、その組はポンに戻る
        const m = this.melds[from].find((x) => x.type === 'kakan' && M.norm(x.tiles[0]) === M.norm(tile));
        if (m) {
          // 奪われるのは加えた1枚（赤5で加槓したなら赤5）
          const i = m.tiles.lastIndexOf(tile);
          m.type = 'pon';
          m.tiles = m.tiles.filter((_, j) => j !== (i >= 0 ? i : m.tiles.length - 1));
        }
      }
      if (last?.riichi && this.riichi[from]) {
        this.riichi[from] = false;
        this.ippatsu[from] = false;
        this.scores[from] += 1000;
        this.riichiSticks = Math.max(0, this.riichiSticks - 1);
        last.riichi = false;
      }
      const total = M.ronPoints(y.han, y.fu, this.isOya(p));
      const pays = [0, 0, 0, 0];
      pays[this.lastDiscard.p] = total;
      this.settle(p, pays, y, { tsumo: false, tile, from: this.lastDiscard.p });
      return this.result;
    }

    settle(winner, pays, y, info) {
      const honbaBonus = this.honba * (info.tsumo ? 100 : 300);
      let gain = 0;
      for (let i = 0; i < 4; i++) {
        if (!pays[i]) continue;
        const add = pays[i] + (info.tsumo ? this.honba * 100 : honbaBonus);
        this.scores[i] -= add;
        gain += add;
      }
      gain += this.riichiSticks * 1000;
      this.scores[winner] += gain;
      this.riichiSticks = 0;
      this.phase = 'end';
      this.result = {
        kind: 'win', winner, ...info, ...y,
        riichiWin: !!this.riichi[winner],
        uraShown: this.riichi[winner] ? this.uraInds() : [],
        hand: info.tsumo ? this.fullHand(winner) : M.sortTiles([...this.hands[winner], info.tile]),
        melds: this.melds[winner],
        gain, label: scoreLabel(y.han, y.fu),
      };
    }

    /** 途中流局（点棒は動かさず、親はそのまま） */
    _abort(kind) {
      this.phase = 'end';
      this.pending = null;
      this.drawn = this.drawn || null;
      this.result = { kind: 'draw', abort: kind, tenpai: [false, false, false, false] };
    }
    /** 九種九牌を宣言できるか：最初のツモで、まだ誰も鳴いていない／カンしていない、幺九牌が9種類以上 */
    kyuushuOk(p = this.turn) {
      if (p !== this.turn || !this.drawn || this.rinshan || this.phase !== 'discard') return false;
      if (this.discards[p].length || this.melds.some((m) => m.length)) return false;
      if (this.log.some((e) => e.kind === 'call' || e.kind === 'kan')) return false;
      return this.yaochuKinds(p) >= 9;
    }
    /** 手の中の幺九牌の種類数 */
    yaochuKinds(p) {
      return new Set(this.fullHand(p).map(M.norm).filter(M.isYaochu)).size;
    }
    kyuushu(p = this.turn) {
      if (!this.kyuushuOk(p)) return null;
      this.log.push({ kind: 'kyuushu', p });
      this._abort('kyuushu');
      this.result.by = p;
      return this.result;
    }
    /** 流局 */
    exhaustive() {
      const tenpai = [0, 1, 2, 3].map((p) => M.isTenpai(M.sortTiles(this.hands[p]), this.setsNeeded(p)));
      const n = tenpai.filter(Boolean).length;
      if (n > 0 && n < 4) {
        const get = 3000 / n, pay = 3000 / (4 - n);
        for (let i = 0; i < 4; i++) this.scores[i] += tenpai[i] ? get : -pay;
      }
      this.phase = 'end';
      this.result = { kind: 'draw', tenpai };
    }

    /** 次の局へ。親が続くかどうかを返す */
    nextKyoku() {
      const r = this.result;
      const draw = r?.kind === 'draw';
      const oyaWin = r?.kind === 'win' && r.winner === this.oya;
      const oyaTenpai = draw && (r.abort || r.tenpai[this.oya]);   // 途中流局は親が続く
      if (oyaWin || oyaTenpai) {
        this.honba++;
      } else {
        // 流局なら親が流れても本場は積む。子のあがりで0に戻る
        this.honba = draw ? this.honba + 1 : 0;
        this.oya = (this.oya + 1) % 4;
        this.kyoku++;
        if (this.kyoku > 4) { this.kyoku = 1; this.round++; }
      }
      // 南4局が終わった／誰かの点棒がマイナス → 半荘終了
      if (this.round >= 2 || this.scores.some((s) => s < 0)) {
        // 残った供託（リーチ棒）はトップが受け取る
        if (this.riichiSticks) {
          this.scores[this.standings()[0].i] += this.riichiSticks * 1000;
          this.riichiSticks = 0;
        }
        this.over = true;
        this.phase = 'over';
        return this;
      }
      return this.deal();
    }

    /** 最後の局か（半荘なら南4局） */
    isAllLast() { return this.round === 1 && this.kyoku === 4; }
    /** この局で半荘が終わるか（nextKyoku と同じ決まり：南4局で親が続かない、または誰かの点棒がマイナス） */
    endsAfterThis() {
      const r = this.result;
      if (!r) return false;
      if (this.scores.some((s) => s < 0)) return true;
      const keep = (r.kind === 'win' && r.winner === this.oya) || (r.kind === 'draw' && (r.abort || r.tenpai[this.oya]));
      return this.isAllLast() && !keep;
    }
    /** 順位と、トップとの点差 */
    standings() {
      // 同点なら、最初の親（起家）に近い席が上
      const order = this.scores.map((v, i) => ({ i, v })).sort((a, b) => b.v - a.v || a.i - b.i);
      return order.map((x, k) => ({ ...x, rank: k + 1 }));
    }
    kyokuLabel() {
      return `${SEAT_JA[Math.min(this.round, 3)]}${this.kyoku}局${this.honba ? ` ${this.honba}本場` : ''}`;
    }
  }

  return { SEAT_JA, SEAT_TILE, DEFAULT_RULE, scoreLabel, Game, kuikaeBan };
})();

// ── js/core/audio.js ────────────────────────────────────────
const NS_AUDIO = (() => {

  // audio.js — 効果音。音声ファイルを一切持たず、その場で合成する。
  // 1ファイル配布にしたいので外部アセットは使わない。
  // AudioContext は「最初にユーザーが触った時」に作る（ブラウザの自動再生制限のため）。

  const KEY = 'bangi.sound';

  class Sfx {
    constructor() {
      this.ctx = null;
      let saved = null;
      try { saved = localStorage.getItem(KEY); } catch { }
      this.on = saved !== 'off';
    }

    toggle() {
      this.on = !this.on;
      try { localStorage.setItem(KEY, this.on ? 'on' : 'off'); } catch { }
      if (this.on) this.pick();
      return this.on;
    }

    _ac() {
      if (!this.on) return null;
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    }

    /** 木がぶつかる音。帯域を変えて駒／牌を鳴らし分ける */
    _clack({ freq = 1200, q = 7, decay = 0.07, gain = 0.28, thump = 160 } = {}) {
      const ac = this._ac();
      if (!ac) return;
      const t = ac.currentTime;

      // 短いノイズを共鳴させると「木」に聞こえる
      const len = Math.ceil(ac.sampleRate * decay);
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;

      const src = ac.createBufferSource();
      src.buffer = buf;
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
      const g = ac.createGain();
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      src.connect(bp).connect(g).connect(ac.destination);
      src.start(t); src.stop(t + decay);

      // 低い芯を足すと、置いた重みが出る
      if (thump) {
        const o = ac.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(thump, t);
        o.frequency.exponentialRampToValueAtTime(thump * 0.6, t + 0.05);
        const og = ac.createGain();
        og.gain.setValueAtTime(gain * 0.5, t);
        og.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
        o.connect(og).connect(ac.destination);
        o.start(t); o.stop(t + 0.07);
      }
    }

    _tone(freq, at = 0, dur = 0.1, gain = 0.16, type = 'sine') {
      const ac = this._ac();
      if (!ac) return;
      const t = ac.currentTime + at;
      const o = ac.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(ac.destination);
      o.start(t); o.stop(t + dur + 0.02);
    }

    // --- 場面ごとの音 -------------------------------------------------------
    /** 駒や牌を置く。ゲームごとに音色を変える */
    place(game) {
      if (game === 'shogi') this._clack({ freq: 1150, q: 9, decay: 0.08, gain: 0.32, thump: 150 });
      else if (game === 'mahjong') this._clack({ freq: 2400, q: 5, decay: 0.05, gain: 0.24, thump: 220 });
      else if (game === 'go') this._clack({ freq: 1900, q: 6, decay: 0.05, gain: 0.34, thump: 240 });
      else this._clack({ freq: 720, q: 4, decay: 0.09, gain: 0.26, thump: 120 });
    }
    /** 駒を取る。少し濁らせる */
    capture(game) {
      this.place(game);
      setTimeout(() => this._clack({ freq: 420, q: 3, decay: 0.09, gain: 0.2, thump: 90 }), 45);
    }
    /** 選択したときの小さな合図 */
    pick() { this._tone(880, 0, 0.05, 0.07, 'triangle'); }

    correct() { this._tone(660, 0, 0.11, 0.14); this._tone(990, 0.09, 0.16, 0.12); }
    wrong() {
      this._tone(196, 0, 0.16, 0.13, 'sawtooth');
      this._tone(185, 0.02, 0.16, 0.09, 'sine');
    }
    /** レッスン修了。ペンタトニックで上がる */
    finish() {
      [523, 587, 784, 1047].forEach((f, i) => this._tone(f, i * 0.1, 0.34, 0.12, 'triangle'));
    }
  }

  const sfx = new Sfx();

  return { sfx };
})();

// ── js/core/settings.js ─────────────────────────────────────
const NS_SETTINGS = (() => {

  // settings.js — 表示まわりの設定。端末ごとに保存する。
  // 進捗(store)とは別扱い。端末によって見やすさが違うので、同期しない方が都合がよい。

  const KEY = 'bangi.settings.v1';

  const DEFAULTS = {
    showMoves: true,    // 駒を選んだとき、動かせるマスを出す
    warnUnsafe: true,   // そのうち「動かすと取られるマス」を赤で警告する
    showThreat: false,  // 相手の利きが及ぶマスを薄く塗る
    coachDetail: 'normal', // short | normal | deep
    aka: false,         // 4人打ちで赤ドラを使う
    askThreat: true,    // 相手の狙いを、答えを言う前に質問する
    predict: true,      // 相手の応手を予想する練習
    shapes: true,       // 印に色だけでなく形（○×）も使う
    textSize: 'normal', // small | normal | large
    aiLevel: 'auto',    // やさしい・ふつう・つよい・じどう
    trainingMinutes: 15, // 日々の上達メニュー（5・15・30分）
  };

  const TEXT_SIZES = [
    { id: 'small', label: '小', px: 15 },
    { id: 'normal', label: '中', px: 17 },
    { id: 'large', label: '大', px: 19.5 },
  ];

  const DETAILS = [
    { id: 'short', label: 'ひとこと' },
    { id: 'normal', label: 'ふつう' },
    { id: 'deep', label: 'じっくり' },
  ];

  class Settings {
    constructor() {
      this.values = { ...DEFAULTS };
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) Object.assign(this.values, JSON.parse(raw));
      } catch { /* 読めなければ既定値のまま */ }
      // 旧バージョンのキーから引き継ぐ
      try {
        const old = localStorage.getItem('bangi.coachDetail');
        if (old && !localStorage.getItem(KEY)) this.values.coachDetail = old;
      } catch { }
      this.subs = new Set();
    }
    get(k) { return this.values[k]; }
    set(k, v) {
      this.values[k] = v;
      try { localStorage.setItem(KEY, JSON.stringify(this.values)); } catch { }
      for (const fn of this.subs) fn(this.values);
    }
    subscribe(fn) { this.subs.add(fn); return () => this.subs.delete(fn); }
  }

  const settings = new Settings();

  /** 文字サイズと印の形を画面に反映する（root の font-size。rem 指定なので全体が拡大縮小する） */
  function applyDisplay() {
    const t = TEXT_SIZES.find((x) => x.id === settings.get('textSize')) || TEXT_SIZES[1];
    // px で決めると、ブラウザ側で文字を大きくしている人の設定が効かなくなる。標準（16px）を基準にした % にする
    document.documentElement.style.fontSize = `${(t.px / 16) * 100}%`;
    document.documentElement.dataset.shapes = settings.get('shapes') === false ? 'off' : 'on';
  }
  applyDisplay();
  settings.subscribe(applyDisplay);

  return { DEFAULTS, DETAILS, settings, TEXT_SIZES };
})();

// ── js/core/coach.js ────────────────────────────────────────
const COACH_FACTORY = () => {
  const C = NS_CHESS;
  const S = NS_SHOGI;
  const M = NS_MAHJONG;
  // coach.js — 「いまの手はどうだったのか」を判定する。
  //
  // 初心者が負ける理由は、序盤の形の悪さではなく
  //   ・タダで駒を取られた
  //   ・タダで取れる駒を見逃した
  //   ・相手の狙いに気づかなかった
  // のほぼ3つ。ここではその3つだけを、盤面から機械的に見つける。
  //
  // 厳密な読み（完全なSEE）はやらない。初心者の実戦で起きることの9割は
  // 「守られていない駒」と「安い駒に高い駒が狙われている」で説明がつく。




  // ───────────────────────────────────────────────
  // チェス／将棋 共通の道具
  // ───────────────────────────────────────────────
  const ENGINE = {
    chess: {
      colorOf: C.colorOf,
      kindOf: C.kindOf,
      value: (p) => C.PIECE_VALUE[C.kindOf(p)],
      name: (p) => C.PIECE_JA[C.kindOf(p)],
      isKing: (p) => C.kindOf(p) === 'K',
      foe: (c) => (c === 'w' ? 'b' : 'w'),
      // 「利き」。ポーンの前進は攻撃ではないので C.attacks を使う
      reach: (board, from, ctx) => C.attacks(board, from, ctx),
      moves: (board, from, ctx) => C.legalMoves(board, from, ctx),
      apply: (board, m, ctx) => C.applyMove(board, m.from, m.to, ctx),
      best: (board, color, ctx) => C.pickMove(board, color, ctx, 2, 300),
      square: (s) => s,
      inCheck: (board, color, ctx) => C.inCheck(board, color, ctx),
    },
    shogi: {
      colorOf: S.colorOf,
      kindOf: S.kindOf,
      value: (p) => S.PIECE_VALUE[S.kindOf(p)],
      name: (p) => S.PIECE_JA[S.kindOf(p)],
      isKing: (p) => S.baseOf(p) === 'K',
      foe: S.opponent,
      reach: (board, from, ctx) => S.pseudoMoves(board, from, ctx, { anyColor: true }),
      // 成り／不成で同じ行き先が2回出るので重複を消す
      moves: (board, from, ctx) => [...new Set(
        S.legalMovesFrom({ board, hands: S.emptyHands(), turn: S.colorOf(board[from]) }, from, ctx)
          .map((m) => m.to))],
      apply: (board, m, ctx) => {
        if (m.drop) {
          // 打つ手：講評では持ち駒の数は使わないので、盤に置くだけ
          return { ...board, [m.to]: (coachTurn || 'b') === 'b' ? m.drop : m.drop.toLowerCase() };
        }
        const st = { board, hands: S.emptyHands(), turn: S.colorOf(board[m.from]) };
        return S.applyMove(st, { from: m.from, to: m.to, promote: false }, ctx).board;
      },
      // 講評中の局面の持ち駒（explainMove が info.hands で渡す）。打つ手も候補に入れる
      best: (board, color, ctx) => {
        const hands = coachHands ? JSON.parse(JSON.stringify(coachHands)) : S.emptyHands();
        return S.pickMove({ board, hands, turn: color }, ctx, 2, 300) || null;
      },
      square: (s) => `${s[0]}${'一二三四五六七八九'[Number(s[1]) - 1]}`,
      inCheck: (board, color, ctx) => S.inCheck(board, color, ctx),
    },
  };

  // 講評している局面の持ち駒と手番（将棋の「こうすれば」で打つ手を読むため）
  let coachHands = null, coachTurn = null;

  /** そのマスに利きを持つ駒を、価値の安い順に返す */
  function attackers(game, board, sq, byColor, ctx) {
    const E = ENGINE[game];
    const out = [];
    for (const [from, p] of Object.entries(board)) {
      if (E.colorOf(p) !== byColor || from === sq) continue;
      if (E.reach(board, from, ctx).includes(sq)) {
        out.push({ from, piece: p, value: E.value(p), name: E.name(p) });
      }
    }
    return out.sort((a, b) => a.value - b.value);
  }

  /**
   * from の駒が、sq にある相手の駒を合法に取れるか。
   * ピンされている駒（取ると自分の玉・キングに王手がかかる）や、守られたマスへ入る王・キングは取れない。
   */
  function canTake(game, board, from, sq, ctx) {
    const p = board[from];
    if (!p) return false;
    if (game === 'chess') {
      const color = C.colorOf(p);
      if (!C.findKing(board, color)) return true;   // キングのいない練習盤
      return !C.inCheck(C.applyMove(board, from, sq, ctx), color, ctx);
    }
    const color = S.colorOf(p);
    if (!S.findKing(board, color)) return true;
    const st = { board, hands: S.emptyHands(), turn: color };
    return !S.inCheck(S.applyMove(st, { from, to: sq, promote: false }, ctx).board, color, ctx);
  }

  /**
   * 実際に取りにこられる駒だけ（価値の安い順）。
   * 以前は利きだけで数えていたので、ピンされて動けない駒に「取られる」と言っていた。
   */
  function realAttackers(game, board, sq, byColor, ctx) {
    return attackers(game, board, sq, byColor, ctx).filter((a) => canTake(game, board, a.from, sq, ctx));
  }

  /**
   * 「取られたら損をする」自分の駒を探す。
   * 守りがゼロなら丸損、守りがあっても安い駒に狙われていれば差額ぶんの損。
   */
  function hanging(game, board, color, ctx) {
    const E = ENGINE[game];
    const out = [];
    for (const [sq, p] of Object.entries(board)) {
      if (E.colorOf(p) !== color || E.isKing(p)) continue;
      const atk = realAttackers(game, board, sq, E.foe(color), ctx);
      if (!atk.length) continue;
      // 守り：いちばん安い駒に取られたあと、実際に取り返せる駒（ピンされている駒は取り返せない）
      const took = { ...board, [sq]: atk[0].piece };
      delete took[atk[0].from];
      const def = attackers(game, took, sq, color, ctx).filter((d) => canTake(game, took, d.from, sq, ctx));
      const val = E.value(p);
      let loss = 0;
      if (!def.length) loss = val;
      else if (atk[0].value < val) loss = val - atk[0].value;
      if (loss > 0) out.push({ sq, piece: p, name: E.name(p), loss, by: atk[0], defended: def.length > 0 });
    }
    return out.sort((a, b) => b.loss - a.loss);
  }

  /** タダ同然で取れる相手の駒 */
  function freeCaptures(game, board, color, ctx) {
    const E = ENGINE[game];
    const out = [];
    for (const [from, p] of Object.entries(board)) {
      if (E.colorOf(p) !== color) continue;
      for (const to of E.moves(board, from, ctx)) {
        const target = board[to];
        if (!target || E.colorOf(target) === color) continue;
        const after = E.apply(board, { from, to }, ctx);
        const recapture = realAttackers(game, after, to, E.foe(color), ctx);
        const gain = E.value(target) - (recapture.length ? E.value(p) : 0);
        if (gain > 0) {
          out.push({ from, to, gain, target: E.name(target), piece: E.name(p), safe: !recapture.length });
        }
      }
    }
    return out.sort((a, b) => b.gain - a.gain);
  }

  /** 1手で2枚以上の駒を同時に狙う手（両取り・フォーク）を探す */
  function forks(game, board, color, ctx) {
    const E = ENGINE[game];
    // 王・玉は「取られたら負け」なので、価値の比較では最上位として扱う
    const threatValue = (p) => (E.isKing(p) ? 100 : E.value(p));
    const out = [];
    for (const [from, p] of Object.entries(board)) {
      if (E.colorOf(p) !== color) continue;
      for (const to of E.moves(board, from, ctx)) {
        const after = E.apply(board, { from, to }, ctx);
        if (!after[to]) continue;
        const hit = E.reach(after, to, ctx)
          .map((sq) => ({ sq, piece: after[sq] }))
          .filter((x) => x.piece && E.colorOf(x.piece) === E.foe(color) && threatValue(x.piece) >= E.value(p));
        // 自分がそこで取られるなら両取りにならない
        const punished = realAttackers(game, after, to, E.foe(color), ctx).length
          && !attackers(game, after, to, color, ctx).length;
        if (hit.length >= 2 && !punished) {
          out.push({ from, to, targets: hit.map((x) => ({ sq: x.sq, name: E.name(x.piece) })) });
        }
      }
    }
    return out;
  }

  // ───────────────────────────────────────────────
  // 麻雀：受け入れ計算（本物の「何切る」）
  // ───────────────────────────────────────────────
  const shantenCache = new Map();
  function shantenOf(tiles, sets) {
    const key = sets + ':' + M.toCounts(tiles).join('');
    if (shantenCache.has(key)) return shantenCache.get(key);
    const v = M.shantenAll(tiles, sets);   // 七対子の形も数える
    if (shantenCache.size > 6000) shantenCache.clear();
    shantenCache.set(key, v);
    return v;
  }

  /**
   * 各切り牌について「シャンテン数」と「受け入れ（何種・何枚）」を計算する。
   * 良い順に並べて返す。
   */
  function ukeire(hand, sets = 4, seen = []) {
    const visible = M.toCounts([...hand, ...seen]);
    const out = [];
    for (const d of [...new Set(hand)]) {
      const rest = [...hand];
      rest.splice(rest.indexOf(d), 1);
      const sh = shantenOf(rest, sets);
      const accept = [];
      let tiles = 0;
      for (const t of M.ALL_TILES) {
        const left = 4 - (visible[M.toIndex(t)] || 0);
        if (left <= 0) continue;
        if (shantenOf([...rest, t], sets) < sh) { accept.push(t); tiles += left; }
      }
      out.push({ tile: d, shanten: sh, kinds: accept.length, tiles, accept });
    }
    // 受け入れが同じなら、字牌 → 端牌 → 中張牌 の順に切るのが定番
    const dropOrder = (t) => (M.isHonor(t) ? 0 : M.isTerminal(t) ? 1 : 2);
    return out.sort((a, b) =>
      a.shanten - b.shanten || b.tiles - a.tiles || b.kinds - a.kinds
      || dropOrder(a.tile) - dropOrder(b.tile));
  }

  /**
   * テンパイまでの道筋（読み筋の再生用・麻雀）。first を切ってから、
   * 「受け入れの牌のうち、残りがいちばん多い牌を引く → 受け入れがいちばん広い牌を切る」をテンパイまでくり返す。
   * 引きが良かったとしたときの、いちばん素直な道筋。steps[i] = { discard, shanten, tiles, accept: [{ tile, left }], draw }
   * （draw は次に引く牌。テンパイか、先が読めないときは null）
   */
  function discardRoute(hand, first, sets = 4, seen = [], maxSteps = 6) {
    let cur = M.sortTiles(hand);
    const gone = [...seen];
    const steps = [];
    let d = first;
    for (let i = 0; i < maxSteps && d; i++) {
      const row = ukeire(cur, sets, gone).find((r) => r.tile === d);
      if (!row) break;
      const rest = [...cur];
      rest.splice(rest.indexOf(d), 1);
      const visible = M.toCounts([...cur, ...gone]);
      const accept = row.accept.map((t) => ({ tile: t, left: 4 - (visible[M.toIndex(t)] || 0) })).filter((a) => a.left > 0);
      const step = { discard: d, shanten: row.shanten, tiles: row.tiles, accept, draw: null };
      steps.push(step);
      gone.push(d);
      if (row.shanten <= 0 || !accept.length) break;   // テンパイ（受け入れ＝待ち）で終わり
      const pick = [...accept].sort((a, b) => b.left - a.left || M.toIndex(a.tile) - M.toIndex(b.tile))[0];
      step.draw = pick.tile;
      cur = M.sortTiles([...rest, pick.tile]);
      d = ukeire(cur, sets, gone)[0]?.tile || null;
    }
    return steps;
  }
  /** あなたの切り方と、最善の切り方の道筋を並べて返す */
  function discardRoutes(hand, played, best, sets = 4, seen = []) {
    return { played: discardRoute(hand, played, sets, seen), best: best ? discardRoute(hand, best, sets, seen) : null };
  }

  /** 受け入れが最善と並んでいる切り牌が他にもあるか */
  function tiedWithBest(table, tile) {
    const best = table[0];
    const mine = table.find((r) => r.tile === tile);
    return !!mine && mine.shanten === best.shanten && mine.tiles === best.tiles;
  }

  // ───────────────────────────────────────────────
  // 講評の中身を厚くする
  // 事実だけでなく「なぜ問題か」「どうすればよかったか」「次に気づくコツ」まで出す
  // ───────────────────────────────────────────────

  /** 次に気づくためのコツ。指摘の種類ごとに用意する */
  const LESSON_TEXT = {
    hang: {
      chess: '駒を置く前に、その行き先が相手の何かに狙われていないかを確かめる。とくに相手のポーンの斜め前は、いちばん見落とす場所です。',
      shogi: '駒を進める前に、その行き先に相手の利きがないかを確かめる。将棋は取られた駒が相手の持ち駒になるので、1枚の損が二重に効きます。',
    },
    missed: {
      chess: '自分の番になったら、まず相手の駒で「誰にも守られていないもの」を探す。見つけたら取れないか考える。この順番を毎回やるだけで変わります。',
      shogi: '自分の番になったら、相手の駒で「誰も守っていないもの」を先に探す。将棋では取った駒がそのまま自分の戦力になります。',
    },
    threat: {
      chess: '相手が直前に動かした駒が、新しくどこへ届くようになったかを目でたどる。狙いはたいていそこにあります。',
      shogi: '相手が直前に動かした駒の利きを、1マスずつ目でたどる。とくに大駒（飛・角）は盤の端から一気に届きます。',
    },
  };

  /** 損の重さを、初心者に伝わる言葉にする */
  function weight(loss) {
    if (loss >= 8) return 'これだけで勝負が決まるほどの差です。';
    if (loss >= 4) return 'かなり大きい損です。';
    if (loss >= 2) return '小さくない損です。';
    return 'わずかですが損です。';
  }

  /** 代わりに指すべきだった手を探す */
  function suggestBetter(game, board, color, ctx, preferFrom = null, avoid = null) {
    const E = ENGINE[game];
    // 指した手そのものは勧めない
    const same = (m) => !!avoid && !!m && (m.from || null) === (avoid.from || null) && m.to === avoid.to && (m.drop || null) === (avoid.drop || null);
    // 1. タダで取れる駒があるなら、それがいちばん分かりやすい正解
    const free = freeCaptures(game, board, color, ctx).filter((m) => !same(m));
    if (free.length && free[0].gain >= 3) {
      const m = free[0];
      return { from: m.from, to: m.to,
        label: `${E.square(m.to)}の${m.target}を${m.piece}で取る`,
        reason: `${m.gain}点ぶん得をします。` };
    }
    // 2. 両取りがあるなら次点
    const fk = forks(game, board, color, ctx).filter((m) => !same(m));
    if (fk.length) {
      const m = fk[0];
      return { from: m.from, to: m.to,
        label: `${E.square(m.from)}の駒を${E.square(m.to)}へ`,
        reason: `${m.targets.map((t) => t.name).join('と')}の両取りになります。` };
    }
    // 3. いま動かした駒を、安全なマスへ逃がす案（いちばん飲み込みやすい）
    if (preferFrom && board[preferFrom]) {
      const p = board[preferFrom];
      for (const to of E.moves(board, preferFrom, ctx)) {
        if (same({ from: preferFrom, to })) continue;
        const after = E.apply(board, { from: preferFrom, to }, ctx);
        if (!hanging(game, after, color, ctx).length) {
          return { from: preferFrom, to,
            label: `同じ${E.name(p)}でも${E.square(to)}へ`,
            reason: 'それなら取られませんでした。' };
        }
      }
    }

    // 4. エンジンに読ませて、損の出ない手を推す（将棋は持ち駒を打つ手も含む）
    try {
      const mv0 = E.best(board, color, ctx);
      const mv = same(mv0) ? null : mv0;
      if (mv && mv.drop && !hanging(game, E.apply(board, mv, ctx), color, ctx).length) {
        return { from: null, to: mv.to, drop: mv.drop,
          label: `持ち駒の${S.PIECE_JA[mv.drop]}を${E.square(mv.to)}に打つ`,
          reason: '持ち駒を打てば、損を出さずに指せます。' };
      }
      if (mv && mv.from && !hanging(game, E.apply(board, mv, ctx), color, ctx).length) {
        const took = board[mv.to];
        return { from: mv.from, to: mv.to,
          label: `${E.name(board[mv.from])}を${E.square(mv.to)}へ`,
          reason: took ? `${E.name(took)}を取れます。` : 'この手なら損が出ません。' };
      }
    } catch { /* 読みに失敗しても致命的ではない */ }

    // 5. それでも駄目なら、どれでも損の出ない手を1つ
    const order = Object.entries(board)
      .filter(([, p]) => E.colorOf(p) === color)
      .sort(([a], [b]) => (a === preferFrom ? -1 : b === preferFrom ? 1 : 0));
    for (const [from, p] of order) {
      for (const to of E.moves(board, from, ctx)) {
        if (same({ from, to })) continue;
        const after = E.apply(board, { from, to }, ctx);
        if (!hanging(game, after, color, ctx).length) {
          return { from, to,
            label: `${E.name(p)}を${E.square(to)}へ`,
            reason: 'この手なら、取られる駒が出ません。' };
        }
      }
    }
    return null;
  }

  /**
   * reviewMove を「読んで分かる」形に組み立て直したもの。
   * 返り値の各 line は what / why / better / lesson を持つ。
   */
  /** 実際に指した手で得た点数（取った駒 − 取り返されるなら自分の駒） */
  function gainOfMove(game, before, after, move, color, ctx) {
    const E = ENGINE[game];
    const target = before[move.to];
    if (!move.from || !target || E.colorOf(target) === color) return 0;
    const recapture = realAttackers(game, after, move.to, E.foe(color), ctx);
    return E.value(target) - (recapture.length ? E.value(before[move.from]) : 0);
  }

  /**
   * info.mate = true なら、その手で相手を詰ませている（講評は「詰み」だけにする）。
   * 詰ませた手で「駒が取られる場所です」と言うと、初心者は正解を悪手と覚えてしまう。
   */
  // 講評の種類ごとに、練習できるレッスン
  const LESSON_LINK = {
    chess: { hang: 'chess.routine', missed: 'chess.value', threat: 'chess.tac-fork', allowmate: 'chess.defense', missedmate: 'chess.mate1', deep: 'chess.calc',
      deepmiss: 'chess.tac-drill', stalemate: 'chess.stalemate', opening: 'chess.openings' },
    go: { gselfatari: 'go.atari', gmisscap: 'go.capture', gignore: 'go.escape', gladder: 'go.shicho', geye: 'go.eye', gedge: 'go.opening', gfill: 'go.end', gloss: 'go.kyuba' },
    shogi: { hang: 'shogi.routine', missed: 'shogi.routine', threat: 'shogi.routine', allowmate: 'shogi.uke', missedmate: 'shogi.check', deep: 'shogi.calc',
      deepmiss: 'shogi.tesuji', nopromo: 'shogi.promote', igyoku: 'shogi.kakoi', slow: 'shogi.hisshi1' },
  };
  const withLinks = (game, rv) => {
    for (const l of rv.lines) if (!l.link && LESSON_LINK[game]?.[l.kind]) l.link = `#/${game}/${LESSON_LINK[game][l.kind]}`;
    return rv;
  };


  // ───────────────────────────────────────────────
  // 読みによる講評（対局中だけ使う）
  //   上の「取られる駒」「取れる駒」の見つけ方は形だけを見るので、
  //   ピンされた守り駒・駒の取り合いの順番・相手の次の狙いなどは見落とす。
  //   そこで短い読み（2手＋駒の取り合いを最後まで）で、
  //   「指した手」と「いちばん良い手」の差を点数で比べる。
  // ───────────────────────────────────────────────
  const SEARCH_TIMEOUT = {};
  function makeSearcher(game, ctx) {
    if (game === 'chess') {
      const o = { ...(ctx || {}), castle: null, ep: null };
      const other = (c) => (c === 'w' ? 'b' : 'w');
      return {
        unit: 1,
        moves: (p) => C.allLegalMoves(p.b, p.turn, o),
        apply: (p, m) => ({ b: C.applyMove(p.b, m.from, m.to, o), turn: other(p.turn) }),
        inCheck: (p) => C.inCheck(p.b, p.turn, o),
        victim: (p, m) => (p.b[m.to] ? C.PIECE_VALUE[C.kindOf(p.b[m.to])] : 0),
        mat: (p) => {
          let v = 0;
          for (const x of Object.values(p.b)) v += (C.colorOf(x) === p.turn ? 1 : -1) * C.PIECE_VALUE[C.kindOf(x)];
          return v;
        },
        noMoves: (p) => (C.inCheck(p.b, p.turn, o) ? -1000 : 0),   // 詰み／ステイルメイト
        board: (p) => p.b,
        mate1: (p) => C.findMateIn1(p.b, p.turn, o).length > 0,   // 手番側に1手詰めがあるか
      };
    }
    return {
      unit: 2,   // 将棋の駒の点数は歩1・金7くらいの幅があるので、閾値を少し上げる
      moves: (p) => S.allLegalMoves(p, ctx),
      apply: (p, m) => S.applyMove(p, m, ctx),
      inCheck: (p) => S.inCheck(p.board, p.turn, ctx),
      victim: (p, m) => (!m.drop && p.board[m.to] ? S.PIECE_VALUE[S.kindOf(p.board[m.to])] : 0),
      mat: (p) => {
        let v = 0;
        for (const x of Object.values(p.board)) v += (S.colorOf(x) === p.turn ? 1 : -1) * S.PIECE_VALUE[S.kindOf(x)];
        for (const [c, h] of Object.entries(p.hands)) for (const [k, n] of Object.entries(h)) v += (c === p.turn ? 1 : -1) * S.PIECE_VALUE[k] * n;
        return v;
      },
      noMoves: () => -1000,   // 将棋は指せる手がなければ負け
      board: (p) => p.board,
      mate1: (p) => S.findMateIn1(p, ctx).length > 0,
    };
  }

  /** 手番側から見た評価（negamax）。末端では駒を取り合う手だけを最後まで読む */
  function searchValue(X, p, depth, deadline) {
    const order = (q, ms) => ms.map((m) => ({ m, k: X.victim(q, m) })).sort((a, b) => b.k - a.k).map((x) => x.m);
    const qs = (q, a, b, qd) => {
      if (Date.now() > deadline) throw SEARCH_TIMEOUT;
      // 王手をかけられている側は「何もしない」ができないので、全部の逃げ方を読む
      // （これをしないと、王手で1手稼ぐだけの手が得に見えてしまう）
      if (qd > 0 && X.inCheck(q)) {
        const ev = X.moves(q);
        if (!ev.length) return X.noMoves(q);
        let bestE = -Infinity;
        for (const m of order(q, ev)) {
          const v = -qs(X.apply(q, m), -b, -a, qd - 1);
          if (v > bestE) bestE = v;
          if (v > a) a = v;
          if (a >= b) break;
        }
        return bestE;
      }
      const stand = X.mat(q);
      if (qd === 0 || stand >= b) return stand;
      if (stand > a) a = stand;
      const caps = order(q, X.moves(q).filter((m) => X.victim(q, m) > 0));
      for (const m of caps) {
        const v = -qs(X.apply(q, m), -b, -a, qd - 1);
        if (v >= b) return v;
        if (v > a) a = v;
      }
      return a;
    };
    const nm = (q, d, a, b) => {
      if (Date.now() > deadline) throw SEARCH_TIMEOUT;
      if (d <= 0) return qs(q, a, b, 4);
      const ms = X.moves(q);
      if (!ms.length) { const v = X.noMoves(q); return v < 0 ? v - d : v; }   // 早い詰みほど悪い（ステイルメイトは0のまま）
      let best = -Infinity;
      for (const m of order(q, ms)) {
        const v = -nm(X.apply(q, m), d - 1, -b, -a);
        if (v > best) best = v;
        if (v > a) a = v;
        if (a >= b) break;
      }
      return best;
    };
    // ルート：一番良い手とその評価
    const ms = X.moves(p);
    if (!ms.length) return { v: X.noMoves(p), m: null };
    let best = null, bestV = -Infinity;
    for (const m of order(p, ms)) {
      const v = -nm(X.apply(p, m), depth - 1, -Infinity, -bestV);
      if (v > bestV) { bestV = v; best = m; }
    }
    return { v: bestV, m: best };
  }

  /**
   * searchValue と同じ読みで、最善の「手順」も返す（読み筋の再生用）。{ v, pv }
   * 取り合いの読み（qs）で選ばれた取り・取り返しも手順に含める。
   */
  function searchLine(X, p, depth, deadline) {
    // 取る駒の大きい順。同じなら成る手を先に読む（評価が同じとき、見せる手順が「不成」にならないように）
    const order = (q, ms) => ms.map((m) => ({ m, k: X.victim(q, m) * 2 + (m.promote ? 1 : 0) })).sort((a, b) => b.k - a.k).map((x) => x.m);
    const qs = (q, a, b, qd) => {
      if (Date.now() > deadline) throw SEARCH_TIMEOUT;
      if (qd > 0 && X.inCheck(q)) {
        const ev = X.moves(q);
        if (!ev.length) return { v: X.noMoves(q), pv: [] };
        let best = { v: -Infinity, pv: [] };
        for (const m of order(q, ev)) {
          const r = qs(X.apply(q, m), -b, -a, qd - 1);
          if (-r.v > best.v) best = { v: -r.v, pv: [m, ...r.pv] };
          if (best.v > a) a = best.v;
          if (a >= b) break;
        }
        return best;
      }
      const stand = X.mat(q);
      let best = { v: stand, pv: [] };
      if (qd === 0 || stand >= b) return best;
      if (stand > a) a = stand;
      for (const m of order(q, X.moves(q).filter((mv) => X.victim(q, mv) > 0))) {
        const r = qs(X.apply(q, m), -b, -a, qd - 1);
        if (-r.v > best.v) best = { v: -r.v, pv: [m, ...r.pv] };
        if (best.v >= b) return best;
        if (best.v > a) a = best.v;
      }
      return best;
    };
    const nm = (q, d, a, b) => {
      if (Date.now() > deadline) throw SEARCH_TIMEOUT;
      if (d <= 0) return qs(q, a, b, 4);
      const ms = X.moves(q);
      if (!ms.length) { const v = X.noMoves(q); return { v: v < 0 ? v - d : v, pv: [] }; }
      let best = { v: -Infinity, pv: [] };
      for (const m of order(q, ms)) {
        const r = nm(X.apply(q, m), d - 1, -b, -a);
        if (-r.v > best.v) best = { v: -r.v, pv: [m, ...r.pv] };
        if (best.v > a) a = best.v;
        if (a >= b) break;
      }
      return best;
    };
    const ms = X.moves(p);
    if (!ms.length) return { v: X.noMoves(p), pv: [] };
    let best = { v: -Infinity, pv: [] };
    for (const m of order(p, ms)) {
      const r = nm(X.apply(p, m), depth - 1, -Infinity, -best.v);
      if (-r.v > best.v) best = { v: -r.v, pv: [m, ...r.pv] };
    }
    return best;
  }

  /**
   * 読み筋の再生用。指す前の局面での最善手順（best）と、指したあとの局面での相手の最善手順（reply）。
   * 時間の許すかぎり1手ずつ深く読み、最後まで読み切れた深さの手順を返す（1つも読めなければ null）
   */
  function readingLines(game, beforePos, afterPos, ctx, timeMs = 1500, alt = null) {
    const X = makeSearcher(game, ctx);
    const deadline = Date.now() + timeMs;
    // alt：コーチが「こうすれば」と勧めた手。その手のあとの続きも読む（文章と再生を食い違わせない）。
    // 成り・不成の指定がないときは、合法な両方を読んで良いほうを使う
    const altCands = alt ? X.moves(beforePos).filter((m) => m.to === alt.to && (m.from || null) === (alt.from || null)
      && (m.drop || null) === (alt.drop || null) && (alt.promote == null || !!m.promote === !!alt.promote)) : [];
    let best = null, reply = null, altMove = null, altReply = null;
    for (const d of [2, 3, 4]) {
      try {
        const b = searchLine(X, beforePos, d, deadline);
        const r = searchLine(X, afterPos, d - 1, deadline);
        let am = null, ar = null;
        for (const m of altCands) {
          const x = searchLine(X, X.apply(beforePos, m), d - 1, deadline);
          // 相手から見た評価が低いほど、こちらに良い。同じなら成る手を選ぶ
          if (!ar || x.v < ar.v || (x.v === ar.v && m.promote && !am.promote)) { am = m; ar = x; }
        }
        best = b; reply = r; altMove = am; altReply = ar;
      } catch (e) {
        if (e !== SEARCH_TIMEOUT) throw e;
        break;
      }
    }
    return { best, reply, altMove, altReply };
  }

  const sameMove = (a, b) => !!a && !!b && a.to === b.to && (a.from || null) === (b.from || null)
    && (a.drop || null) === (b.drop || null) && (!!a.promote === !!b.promote || a.promote === undefined || b.promote === undefined);

  /**
   * 読みで「指した手がどれだけ損か」を調べ、講評の行を返す（なければ null）。
   * pos は手番（color）側の局面：チェス { b, turn }、将棋 { board, hands, turn }
   */
  function deepReview(game, beforePos, afterPos, move, ctx, timeMs = 600) {
    const X = makeSearcher(game, ctx);
    const E = ENGINE[game];
    const deadline = Date.now() + timeMs;
    let best, reply;
    try {
      best = searchValue(X, beforePos, 2, deadline);        // 自分の最善（2手＋取り合い）
      reply = searchValue(X, afterPos, 1, deadline);        // 指した手への相手の最善応手
    } catch (e) {
      if (e === SEARCH_TIMEOUT) return null;                // 読み切れないときは何も言わない
      throw e;
    }
    // 時間が残っていれば1手深く読み直す（王手で1手稼ぐだけの手を「良い手」と誤解しないため）
    try {
      const b3 = searchValue(X, beforePos, 3, deadline);
      const r3 = searchValue(X, afterPos, 2, deadline);
      best = b3; reply = r3;
    } catch (e) {
      if (e !== SEARCH_TIMEOUT) throw e;
    }
    if (!best.m) return null;
    const played = -reply.v;
    const drop = best.v - played;
    const base = X.mat(beforePos);
    const lbl = (p, m) => {
      const b = X.board(p);
      if (m.drop) return `${E.square(m.to)}に${S.PIECE_JA[m.drop]}を打つ`;
      if (b[m.to]) return `${E.name(b[m.from])}で${E.square(m.to)}の${E.name(b[m.to])}を取る`;
      return `${E.name(b[m.from])}を${E.square(m.to)}へ`;
    };
    const small = 2 * X.unit, big = 3 * X.unit;
    // 詰みがからむ差は上の「1手詰め」の講評に任せる（ここでは駒の損得だけを扱う）
    if (Math.abs(best.v) >= 500 || Math.abs(played) >= 500) return null;

    // 指した手そのものの損（指す前と比べて）。これが小さいのに drop が大きいなら「損」ではなく「もっと良い手の見逃し」
    const loss = base - played;
    if (drop >= small && reply.m && !sameMove(best.m, move) && loss < small && best.v - base >= small) {
      // 両取り（フォーク）なら名前を出す
      let forkNote = '';
      try {
        if (best.m.from && !best.m.drop) {
          const fk = forks(game, X.board(beforePos), X.board(beforePos)[best.m.from] ? E.colorOf(X.board(beforePos)[best.m.from]) : null, ctx)
            .find((f) => f.from === best.m.from && f.to === best.m.to);
          if (fk) forkNote = `${fk.targets.map((t) => t.name).join('と')}の両取り（${game === 'chess' ? 'フォーク' : '両取り'}）になる手です。`;
        }
      } catch { /* 名前が出せなくても講評は出す */ }
      return {
        level: 'miss',
        line: {
          kind: 'deepmiss', sq: best.m.to,
          what: `悪い手ではありませんが、もっと得をする手がありました（約${best.v - base}点）。`,
          why: `${lbl(beforePos, best.m)}なら、相手がどう受けても駒得になりました。${forkNote}`,
          better: { from: best.m.from || null, to: best.m.to, drop: best.m.drop,
            label: lbl(beforePos, best.m), reason: `${best.v - base}点ほど得をする手でした。` },
          lesson: game === 'chess'
            ? '自分の番では、まず「チェック・取る手・狙う手」の順に候補を挙げます。2つの駒を同時に狙える場所がないかも探します。'
            : '自分の番では、まず「王手・取る手・両取り」の順に候補を挙げます。',
          marks: { ...(best.m.from ? { [best.m.from]: 'sel' } : {}), [best.m.to]: 'ok' },
          arrows: [{ from: best.m.from || null, to: best.m.to, c: 'ok' }],
          d: { gain: best.v - base, fork: !!forkNote },
        },
      };
    }
    // 相手の「駒を取る」応手のあとに、こちらの1手詰めが残るなら、その損は本物ではない（詰めろの手。時間切れで浅い読みになったときに起きる）
    if (drop >= small && reply.m && !sameMove(best.m, move) && X.mate1(X.apply(afterPos, reply.m))) return null;
    if (drop >= small && reply.m && !sameMove(best.m, move)) {
      const rb = X.board(afterPos);
      const took = !reply.m.drop && rb[reply.m.to];
      return {
        level: drop >= big ? 'blunder' : 'miss',
        line: {
          kind: 'deep', sq: reply.m.to,
          what: `読んでみると、この手は駒の損得で約${Math.max(loss, drop)}点の損になります。`,
          why: took
            ? `相手に${E.name(rb[reply.m.from])}で${E.square(reply.m.to)}の${E.name(took)}を取られると、取り返しても元が取れません。`
            : `相手に${lbl(afterPos, reply.m)}と指されると、次に駒を取られる形が残ります。`,
          better: { from: best.m.from || null, to: best.m.to, drop: best.m.drop,
            label: lbl(beforePos, best.m),
            reason: best.v - base > 0 ? `${best.v - base}点ほど得をする手でした。` : 'この手なら損が出ませんでした。' },
          lesson: game === 'chess'
            ? '駒を動かす前に「相手のいちばん嫌な返し」を1つだけ想像します。取る手・チェックから先に確かめると見落としが減ります。'
            : '指す前に「相手のいちばん嫌な返し」を1つだけ想像します。取る手と王手から先に確かめると見落としが減ります。',
          marks: { ...(reply.m.from ? { [reply.m.from]: 'hint' } : {}), [reply.m.to]: 'ng' },
          arrows: [{ from: reply.m.from || null, to: reply.m.to, c: 'ng' }],
          d: { loss: Math.max(loss, drop), took: took ? E.name(took) : null, by: !reply.m.drop && rb[reply.m.from] ? E.name(rb[reply.m.from]) : null },
        },
      };
    }
    if (sameMove(best.m, move) && best.v - base >= small) {
      return {
        level: 'ok',
        line: {
          kind: 'good', sq: move.to,
          what: `好手です。読むと${best.v - base}点ほど得をする手でした。`,
          why: '相手がどう返しても、駒の取り合いでこちらが得をします。',
          better: null, lesson: '', marks: { [move.to]: 'ok' }, d: { deepGood: best.v - base },
        },
      };
    }
    return null;
  }

  /**
   * info.missedMate：指す前に1手詰めがあった（その手）
   * info.allowsMate：指したあと、相手に1手詰めがある（その手）
   * どちらも持ち駒まで含めて呼び出し側が調べて渡す（将棋の打つ手を読むため）
   */
  function explainMove(game, before, after, move, color, ctx, info = {}) {
    coachHands = game === 'shogi' ? info.hands || null : null;
    coachTurn = color;
    try {
      const rv = info.onlyDeep ? { level: 'ok', lines: [] } : explainMoveRaw(game, before, after, move, color, ctx, info);
      // 対局中は、形だけでは分からない損を短い読みで補う（悪い指摘がまだないときだけ。ステイルメイトのあとは読まない）
      if (info.search && !info.mate && !info.stalemate && !rv.lines.some((l) => l.kind !== 'good')) {
        const d = deepReview(game, info.search.before, info.search.after, move, ctx);
        if (d) {
          rv.lines = rv.lines.filter((l) => l.kind !== 'good');
          rv.lines.unshift(d.line);
          if (d.level !== 'ok') rv.level = d.level;
        }
      }
      return withLinks(game, rv);
    } finally { coachHands = null; }
  }

  /** 詰みの手数の呼び方。将棋は「3手詰め」、チェスは自分の手の回数で「2手メイト」 */
  const mateName = (game, plies, sep) => (game === 'shogi'
    ? `${sep}${plies}手詰め`
    : `${sep}${(plies + 1) / 2}手でチェックメイトする手順`);

  function explainMoveRaw(game, before, after, move, color, ctx, info = {}) {
    const E = ENGINE[game];
    const lines = [];
    let level = 'ok';
    const label = (mv) => mv ? (mv.drop ? `${E.square(mv.to)}に${S.PIECE_JA[mv.drop] || ''}を打つ手` : `${E.square(mv.from)}→${E.square(mv.to)}`) : '';

    if (!info.mate && info.allowsMate) {
      level = 'blunder';
      lines.push({
        kind: 'allowmate', sq: info.allowsMate.to,
        what: `この手のあと、相手に${label(info.allowsMate)}${mateName(game, info.allowsMateN || 1, 'の')}があります。`,
        why: '駒の損得より先に、自分の玉（キング）が詰まないかを確かめます。',
        lesson: '指す前に「相手の王手になる手」を全部見る習慣をつけると、ほとんど防げます。',
        marks: { [info.allowsMate.to]: 'ng' },
        arrows: [{ from: info.allowsMate.from || null, to: info.allowsMate.to, c: 'ng' }],
        d: { n: info.allowsMateN || 1 },
      });
    }
    if (!info.mate && info.missedMate) {
      if (level === 'ok') level = 'miss';
      const mm = info.missedMate;
      lines.push({
        kind: 'missedmate', sq: mm.to,
        what: `ここは${mateName(game, info.missedMateN || 1, '')}がありました（初手 ${label(mm)}）。`,
        why: '詰みがある局面では、駒得よりも詰みが優先です。',
        lesson: '自分の番が来たら、まず「王手になる手」から探します。',
        marks: { ...(mm.from ? { [mm.from]: 'sel' } : {}), [mm.to]: 'ok' },
        arrows: [{ from: mm.from || null, to: mm.to, c: 'ok' }],
        d: { n: info.missedMateN || 1 },
      });
    }

    if (info.mate) {
      return { level: 'ok', lines: [{
        kind: 'good', sq: move.to,
        what: '詰みです。',
        why: '相手の玉（キング）に逃げ道も防ぐ手もありません。駒が取られるかどうかは、もう関係ありません。',
        better: null, lesson: '', marks: {}, d: { mate: true },
      }] };
    }

    // チェス：相手が動けないのに王手になっていない（ステイルメイト＝引き分け）
    if (game === 'chess' && info.stalemate) {
      let mat = 0;
      for (const p of Object.values(after)) if (!E.isKing(p)) mat += (E.colorOf(p) === color ? 1 : -1) * E.value(p);
      if (mat >= 2) {
        // 勝っていたのに引き分け。詰ませる手か、ステイルメイトにならない安全な手を示す
        let better = null;
        try {
          const all = C.allLegalMoves(before, color, ctx);
          const foe = E.foe(color);
          const mateMv = all.find((m) => C.gameStatus(C.applyMove(before, m.from, m.to, ctx), foe, ctx) === 'checkmate');
          const safe = mateMv || all.find((m) => {
            const a = C.applyMove(before, m.from, m.to, ctx);
            return C.gameStatus(a, foe, ctx) !== 'stalemate' && !hanging(game, a, color, ctx).length;
          });
          if (safe) better = { from: safe.from, to: safe.to, label: `${E.name(before[safe.from])}を${E.square(safe.to)}へ`,
            reason: mateMv ? 'チェックメイトでした。' : 'これなら相手に動ける手が残り、勝負が続きます。' };
        } catch { /* 代わりの手が出せなくても講評は出す */ }
        return { level: 'blunder', lines: [{
          kind: 'stalemate', sq: move.to,
          what: 'ステイルメイトです。勝っていたのに、引き分けになってしまいました。',
          why: '相手のキングはチェックされていないのに、動ける手がひとつもありません。チェスではこれを引き分けにします。',
          better,
          lesson: '駒がたくさん残って勝っているときは、相手のキングに「動けるマス」を1つ残しながら追い込みます。最後の1手だけがチェックメイトです。',
          marks: { [move.to]: 'ng' },
          arrows: better ? [{ from: better.from, to: better.to, c: 'ok' }] : [],
          d: { mat },
        }] };
      }
      return { level: 'ok', lines: [{
        kind: 'good', sq: move.to,
        what: mat <= -2 ? 'ステイルメイトで、負けそうな局を引き分けにしました。' : 'ステイルメイトで引き分けになりました。',
        why: '相手が動けないのに、チェックされていない形です。チェスではこれを引き分けにします。',
        better: null, lesson: '', marks: {}, d: { stalemateSave: mat <= -2, stalemate: true },
      }] };
    }

    const hung = hanging(game, after, color, ctx);
    if (hung.length) {
      const h = hung[0];
      level = level === 'blunder' || h.loss >= 3 ? 'blunder' : 'miss';
      const moved = h.sq === move.to;
      // 指す前から取られる形だった駒なら「取られる形のまま」
      const still = !moved && hanging(game, before, color, ctx).some((x) => x.sq === h.sq);
      lines.push({
        kind: 'hang',
        sq: h.sq,
        what: moved
          ? `いま動かした${h.name}が、${E.square(h.by.from)}の${h.by.name}に取られる場所です。`
          : still
            ? `${E.square(h.sq)}の${h.name}が、${E.square(h.by.from)}の${h.by.name}に取られる形のままです。`
            : `${E.square(h.sq)}の${h.name}が、${E.square(h.by.from)}の${h.by.name}に取られる形になりました。`,
        why: h.defended
          ? `守ってはいますが、${h.by.name}の方が安い駒です。取り合いになると${h.loss}点ぶん損をします。${weight(h.loss)}`
          : `この駒を守っている味方が1枚もありません。取られたら${h.loss}点がまるごと消えます。${weight(h.loss)}`,
        better: suggestBetter(game, before, color, ctx, move.from, move),
        lesson: LESSON_TEXT.hang[game],
        marks: { [h.sq]: 'ng', [h.by.from]: 'hint' },
        arrows: [{ from: h.by.from, to: h.sq, c: 'ng' }],
        d: { name: h.name, by: h.by.name, at: E.square(h.sq), moved, still, loss: h.loss, defended: h.defended },
      });
    }

    // 同じ駒を取った手や、指した手より得の小さい取りは「取り逃がし」にしない
    const played = gainOfMove(game, before, after, move, color, ctx);
    const missed = freeCaptures(game, before, color, ctx)
      .filter((m) => m.to !== move.to && m.gain > played);
    if (missed.length) {
      const m = missed[0];
      // 駒（3点以上）の取り逃がしは警告、歩1枚ぶんは「ついでに一言」程度に留める
      if (m.gain - played >= 3 && level === 'ok') level = 'miss';
      lines.push({
        kind: 'missed',
        sq: m.to,
        what: m.safe
          ? `${E.square(m.to)}の${m.target}が、タダで取れる場面でした。`
          : `${E.square(m.to)}の${m.target}を取れば、得をする場面でした。`,
        why: m.safe
          ? `あの${m.target}は誰にも守られていませんでした。${m.gain}点をただでもらえるところです。`
          : `取り返されても、差し引き${m.gain}点の得になる形でした。`,
        better: { from: m.from, to: m.to, label: `${E.square(m.from)}の${m.piece}で${E.square(m.to)}を取る`, reason: '' },
        lesson: LESSON_TEXT.missed[game],
        marks: { [m.to]: 'ng', [m.from]: 'sel' },
        arrows: [{ from: m.from, to: m.to, c: 'ok' }],
        d: { target: m.target, piece: m.piece, at: E.square(m.to), safe: m.safe, gain: m.gain },
      });
    }

    const theirs = freeCaptures(game, after, E.foe(color), ctx);
    if (theirs.length && theirs[0].gain >= 3 && !hung.some((h) => h.sq === theirs[0].to)) {
      const m = theirs[0];
      lines.push({
        kind: 'threat',
        sq: m.to,
        what: `相手は次に、${E.square(m.to)}の${m.target}を${m.piece}で取れます。`,
        why: `いま守っておかないと、${m.gain}点を失います。`,
        better: null,
        lesson: LESSON_TEXT.threat[game],
        marks: { [m.to]: 'ng', [m.from]: 'hint' },
        arrows: [{ from: m.from, to: m.to, c: 'ng' }],
        d: { target: m.target, piece: m.piece, at: E.square(m.to), gain: m.gain },
      });
    }

    if (!lines.length) {
      const took = move.from && before[move.to] && E.colorOf(before[move.to]) !== color ? before[move.to] : null;
      // 良い手のときこそ「次に何を見るか」を言う。ここが抜けると手が続かない
      const nowHits = E.reach(after, move.to, ctx)
        .map((sq) => ({ sq, piece: after[sq] }))
        .filter((x) => x.piece && E.colorOf(x.piece) === E.foe(color));
      let why;
      if (took) {
        why = `${E.value(took)}点ぶん得をしました。取り返される心配もありません。`;
      } else if (nowHits.length) {
        why = `この手で${nowHits.map((x) => `${E.square(x.sq)}の${E.name(x.piece)}`).join('と')}`
          + `に当たりが出ました。相手が守らなければ、次に取れます。`;
      } else {
        why = 'いま取られる形の駒はありません。このまま進めて大丈夫です。';
      }
      // 両取り：自分より価値の高い駒（か王・キング）を2枚以上同時に狙っている
      const movedVal = after[move.to] ? E.value(after[move.to]) : 0;
      const forkHits = nowHits.filter((x) => E.isKing(x.piece) || E.value(x.piece) >= movedVal);
      const isCheck = !!E.inCheck(after, E.foe(color), ctx);
      lines.push({
        kind: 'good',
        sq: move.to,
        what: took ? `${E.name(took)}を取りました。安全な手です。` : '安全な手です。',
        why,
        better: null,
        lesson: '次は相手の番です。相手が動かした駒が、新しくどこへ届くようになったかを目でたどってください。狙いはたいていそこにあります。',
        marks: nowHits.length ? Object.fromEntries(nowHits.map((x) => [x.sq, 'hint'])) : {},
        arrows: nowHits.slice(0, 3).map((x) => ({ from: move.to, to: x.sq, c: 'tone' })),
        d: { took: took ? E.name(took) : null, check: isCheck, fork: forkHits.length >= 2,
          hits: nowHits.map((x) => `${E.square(x.sq)}の${E.name(x.piece)}`), hitNames: nowHits.map((x) => E.name(x.piece)) },
      });
    }
    return { level, lines };
  }

  /**
   * 何切るの講評を厚くしたもの。
   * 「どの形が壊れて、何を受け入れられなくなったか」まで出す。
   */
  function explainDiscard(hand, tile, sets = 4, seen = [], banned = null) {
    // banned：喰い替えで切れない牌（種類）。勧める牌の候補から外す
    const table = ukeire(hand, sets, seen).filter((r) => !banned || r.tile === tile || !banned.has(M.norm(r.tile)));
    const best = table[0];
    const mine = table.find((r) => r.tile === tile);
    if (!mine) return { level: 'ok', lines: [], table };

    const lost = best.accept.filter((t) => !mine.accept.includes(t));
    const lostText = lost.length ? lost.map(M.tileName).join('・') : '';
    const gained = mine.accept.filter((t) => !best.accept.includes(t));

    let level = 'ok';
    const lines = [];

    if (mine.shanten > best.shanten) {
      level = 'blunder';
      lines.push({
        kind: 'shanten',
        what: `${M.tileName(tile)}切りは、アガリまでの距離が1つ遠くなる切り方です。`,
        why: `${M.tileName(tile)}は、手の中の組（またはその候補）に使われていました。`
          + `${M.tileName(best.tile)}を切っていれば${best.shanten === 0 ? 'テンパイのまま保てました' : `テンパイまであと${best.shanten}枚の状態を保てました`}。`,
        better: { tile: best.tile, label: `${M.tileName(best.tile)}切り`,
          reason: `${best.kinds}種${best.tiles}枚を受け入れます。` },
        lesson: '切る前に、その牌が「もう組の一部になっていないか」を確かめる。組を壊す切り方がいちばん大きな損です。',
        d: { tile: M.tileName(tile) },
      });
    } else if (best.tiles - mine.tiles >= 4) {
      level = 'miss';
      lines.push({
        kind: 'narrow',
        what: `${M.tileName(tile)}でも進みますが、受け入れが${best.tiles - mine.tiles}枚せまくなります。`,
        why: lostText
          ? `この切り方だと、${lostText} を受け入れられなくなります。${M.tileName(best.tile)}を切れば、それが残ります。`
          : `${M.tileName(best.tile)}切りなら${best.kinds}種${best.tiles}枚、いまの切り方は${mine.kinds}種${mine.tiles}枚です。`,
        better: { tile: best.tile, label: `${M.tileName(best.tile)}切り`,
          reason: `${best.kinds}種${best.tiles}枚を受け入れます。` },
        lesson: '両面（34のような形）は最後まで残す。切るなら孤立した牌か、端の形から。',
        d: { diff: best.tiles - mine.tiles, best: M.tileName(best.tile) },
      });
    } else {
      const tied = mine.tiles === best.tiles && mine.tile !== best.tile;
      lines.push({
        kind: 'good',
        what: mine.shanten === 0
          ? `テンパイです。${mine.accept.map(M.tileName).join('・')}を待っています。`
          : `いい切り方です。${mine.kinds}種${mine.tiles}枚を受け入れます。`,
        why: mine.shanten === 0
          ? (() => {
              const rest13 = [...hand].filter((x, j) => j !== hand.indexOf(tile));
              const names = [...new Set(mine.accept.flatMap((w) => M.waitType(rest13, w, sets)))]
                .map((k) => M.WAIT_TYPES[k]?.ja).filter(Boolean).join('・');
              if (names) return `待ちは${names}の形です。`;
              // 七対子・国士無双は4面子1雀頭に分けられないので、形の名前が出ない
              if (sets === 4 && mine.accept.length) {
                const done = M.sortTiles([...rest13, mine.accept[0]]);
                if (M.isChiitoi(done)) return '七対子の単騎待ちです。';
                if (M.isKokushi(done)) return '国士無双の待ちです。';
              }
              return '';
            })()
          : (gained.length ? `${gained.map(M.tileName).join('・')}を新しく受け入れられます。` : ''),
        better: tied
          ? (() => {
              const same = table.filter((r) => r.shanten === mine.shanten && r.tiles === mine.tiles && r.tile !== tile);
              return { tile: best.tile,
                label: `${same.map((r) => M.tileName(r.tile)).join('・')}切りも同じ`,
                reason: '受け入れ枚数は変わりません。どれでも構いません。' };
            })()
          : null,
        lesson: '',
        d: mine.shanten === 0 ? { tenpai: true, waits: mine.accept.map(M.tileName).join('・') } : { kinds: mine.kinds, tiles: mine.tiles },
      });
    }
    return { level, lines, best, mine, table };
  }

  /**
   * 駒を選んだときに盤へ出す印を作る。
   * 設定に応じて「動かせるマス」「行くと取られるマス」「相手の利き」を出し分ける。
   */
  function moveMarks(game, board, from, targets, color, ctx, opt = {}) {
    const E = ENGINE[game];
    const marks = { [from]: 'sel' };
    if (opt.showThreat) {
      for (const [s2, p] of Object.entries(board)) {
        if (E.colorOf(p) === color) continue;
        for (const sq of E.reach(board, s2, ctx)) if (!marks[sq]) marks[sq] = 'threat';
      }
      marks[from] = 'sel';
    }
    if (!opt.showMoves) return marks;
    for (const to of targets) {
      let kind = 'move';
      if (opt.warnUnsafe) {
        const after = E.apply(board, { from, to }, ctx);
        // 動かした駒そのものが取られる形になるか
        if (hanging(game, after, color, ctx).some((h) => h.sq === to)) kind = 'unsafe';
      }
      marks[to] = kind;
    }
    return marks;
  }

  /** 孤立している牌（どこともつながっていない牌）を探す。最初に切るべきもの */
  function isolated(hand) {
    hand = hand.map(M.norm);
    const c = M.toCounts(hand);
    return [...new Set(hand)].filter((t) => {
      const i = M.toIndex(t);
      if (c[i] >= 2) return false;
      if (M.isHonor(t)) return true;
      const n = Number(t[1]);
      for (const d of [-2, -1, 1, 2]) {
        const m = n + d;
        if (m >= 1 && m <= 9 && c[M.toIndex(t[0] + m)] > 0) return false;
      }
      return true;
    });
  }

  /**
   * 形勢グラフ用の評価。手番側から見た駒得（短い読み＋取り合い）。
   * pos はチェス { b, turn }、将棋 { board, hands, turn }。詰みは ±1000 前後。
   */
  function evalPosition(game, pos, ctx, timeMs = 120) {
    const X = makeSearcher(game, ctx);
    const deadline = Date.now() + timeMs;
    try { return searchValue(X, pos, 2, deadline).v; } catch (e) {
      if (e !== SEARCH_TIMEOUT) throw e;
      try { return searchValue(X, pos, 1, Date.now() + timeMs).v; } catch (e2) {
        if (e2 !== SEARCH_TIMEOUT) throw e2;
        return X.mat(pos);
      }
    }
  }

  /**
   * 指した手のあと（相手の番の局面 after）、相手がどう受けても自分が詰ませられるか。
   * 駒を捨てる手でも、詰みが続いているなら悪手ではない。その見分けに使う。
   * 返り値：詰むまでに自分が指す残りの手の回数（1 = 次の手で詰む、2 = その次）。詰まない・読み切れないときは 0。
   * チェスの after は盤、将棋の after は { board, hands, turn }。読みは ms ミリ秒で打ち切る（打ち切ったら 0 = 何も言わない）
   */
  function mateRun(game, after, me, ctx, ms = 400) {
    const deadline = Date.now() + ms;
    if (game === 'chess') {
      const o = { ...(ctx || {}), castle: null, ep: null };
      const foe = me === 'w' ? 'b' : 'w';
      const reps = C.allLegalMoves(after, foe, o);
      if (!reps.length) return 0;   // 詰み・ステイルメイトは呼び出し側で扱う
      // 取る手から調べる（詰みを逃れる受けは、たいてい捨てた駒を取る手か玉の手）
      reps.sort((a, b) => (after[b.to] ? 1 : 0) - (after[a.to] ? 1 : 0));
      let all1 = true;
      for (const r of reps) {
        if (Date.now() > deadline) return 0;
        if (!C.findMateIn1(C.applyMove(after, r.from, r.to, o), me, o).length) { all1 = false; break; }
      }
      if (all1) return 1;
      for (const r of reps) {
        const left = deadline - Date.now();
        if (left <= 0) return 0;
        // null（詰まない）も undefined（時間切れ）も、詰みとは言わない
        if (!C.findForcedMate(C.applyMove(after, r.from, r.to, o), me, o, 2, left)) return 0;
      }
      return 2;
    }
    const reps = S.allLegalMoves(after, ctx);
    if (!reps.length) return 0;
    reps.sort((a, b) => ((!b.drop && after.board[b.to]) ? 1 : 0) - ((!a.drop && after.board[a.to]) ? 1 : 0));
    let all1 = true;
    for (const r of reps) {
      if (Date.now() > deadline) return 0;
      if (!S.findMateIn1(S.applyMove(after, r, ctx), ctx).length) { all1 = false; break; }
    }
    if (all1) return 1;
    // 王手の連続で、もう1手長い詰み（合わせて5手詰めの1手目）。王手でない手からの長い詰みは重いので読まない
    if (!S.inCheck(after.board, after.turn, ctx)) return 0;
    for (const r of reps) {
      const left = deadline - Date.now();
      if (left <= 0) return 0;
      if (!S.findMateIn(S.applyMove(after, r, ctx), 3, ctx, left)) return 0;
    }
    return 2;
  }

  // 駒の損得から出す指摘（詰みが続いているときは出さない）
  const MATERIAL_KINDS = new Set(['hang', 'missed', 'threat', 'deep', 'deepmiss']);
  /**
   * 講評 rv を「詰みへの手」に直す。駒の損得の指摘を消し、詰みの手順の1手目だと伝える。
   * 詰みの見逃し（もっと短い詰みがあった）などの指摘は残す。check：その手が王手か（将棋の必至の言い方に使う）
   */
  function withMateRun(game, rv, move, n, check) {
    const keep = rv.lines.filter((l) => !MATERIAL_KINDS.has(l.kind) && l.kind !== 'good');
    const plies = 2 * n + 1;
    const hisshi = game === 'shogi' && n === 1 && !check;
    keep.push({
      kind: 'good', sq: move.to,
      what: hisshi ? '必至です。' : `${mateName(game, plies, '')}の1手目です。`,
      why: hisshi
        ? '王手ではありませんが、相手がどう受けても次の手で詰みます。駒を取られる形でも関係ありません。'
        : '相手がどう受けても詰みます。駒を取られる形でも、ほかに取れる駒があっても、詰みがあるときは詰みが先です。',
      better: null, lesson: '', marks: { [move.to]: 'ok' }, d: { mateRun: n },
    });
    const bad = keep.filter((l) => !['good', 'goal', 'tip'].includes(l.kind));
    const level = bad.some((l) => l.kind === 'allowmate') ? 'blunder' : bad.length ? 'miss' : 'ok';
    return { ...rv, level, lines: keep };
  }

  /** 講評の種類（弱点の集計で使う） */
  const KIND_JA = {
    hang: '駒をタダで取られる', missed: '取れる駒の見逃し', threat: '相手の狙いの見落とし',
    allowmate: '詰まされる手を指した', missedmate: '詰みの見逃し', deep: '取り合いの読み抜け',
    shanten: '形を崩す切り方', narrow: '受け入れの狭い切り方', push: '危険牌の押しすぎ',
    dealin: '放銃', value: 'ドラ・役の見落とし', riichi: 'リーチ判断のミス',
    gselfatari: '自分からアタリになる', gmisscap: '取れる石の見逃し', gignore: 'アタリの放置', gladder: 'シチョウで逃げる', geye: '自分の眼をつぶす',
    deepmiss: 'もっと良い手の見逃し', stalemate: 'ステイルメイトで引き分け', nopromo: '成れる駒を成らない', slow: '必至の見逃し（寄せの遅れ）',
    gedge: '序盤に端へ打つ', gfill: '自分の地に打つ', gloss: '形勢を大きく損ねる手',
    nakiyaku: '役のない鳴き', agarimiss: 'アガリの見逃し', agarirasu: 'アガリラス',
  };
  /** 対局のはじめに示す「今回のテーマ」の言い方（弱点の種類ごと） */
  const THEME_JA = {
    hang: '駒をタダで取られない', missed: 'タダで取れる駒を見逃さない', threat: '相手の狙いに気づく',
    allowmate: '詰まされる手を指さない', missedmate: '詰みを見逃さない', deep: '取り合いを最後まで読む', deepmiss: 'もっと良い手を探す',
    stalemate: 'ステイルメイトに気をつける', nopromo: '成れる駒は成る', slow: '終盤は駒得より寄せの速さ',
    shanten: '組を崩さない', narrow: '受け入れの広い牌を残す', push: '危ない牌を押しすぎない', dealin: '振り込まない',
    value: 'ドラと役を見逃さない', riichi: 'リーチの判断',
    gselfatari: '自分からアタリにならない', gmisscap: '取れる石を見逃さない', gignore: 'アタリの石を助ける',
    gladder: 'シチョウの石は逃げない', geye: '自分の眼をつぶさない', gedge: '序盤は3線・4線に打つ', gfill: '自分の地に打たない', gloss: '打つ前に、急ぐ所（危ない石）と大きい所を比べる',
    nakiyaku: '鳴く前に役を確かめる', agarimiss: 'アガリを見逃さない', agarirasu: 'オーラスは着順を計算してからあがる',
  };
  const MJ_LINK = { shanten: 'mahjong.efficiency', narrow: 'mahjong.nanikiru', push: 'mahjong.betaori',
    dealin: 'mahjong.oshihiki', value: 'mahjong.yaku-why', riichi: 'mahjong.riichi',
    nakiyaku: 'mahjong.yaku-judge', agarimiss: 'mahjong.pat-tamen', agarirasu: 'mahjong.allast' };
  const lessonFor = (game, kind) => (game === 'mahjong' ? MJ_LINK[kind] : LESSON_LINK[game]?.[kind]) || null;

  // ───────────────────────────────────────────────
  // コーチのひとこと：講評（rv）から、初心者向けの短い話し言葉・表情・盤の矢印を作る
  //   同じ指摘でも言い方を何通りか用意して、毎回同じ文にならないようにする
  // ───────────────────────────────────────────────
  const pickOne = (a) => a[(Math.random() * a.length) | 0];
  const KING = { chess: 'キング', shogi: '玉', go: '石', mahjong: '手' };
  const TALK = {
    allowmate: (g, d) => [
      `たいへん！ この手のあと、相手に${d.n === 1 ? '次の1手で' : 'すぐ'}詰まされてしまいます。`,
      `ちょっと待って！ ${KING[g]}が危ないです。相手に${d.n === 1 ? '1手で' : ''}詰まされる手があります。`,
    ],
    missedmate: (g, d) => [
      `あっ、惜しい！ ここは${d.n === 1 ? '1手で' : ''}詰ませるチャンスでした。`,
      `詰みがありました！ 自分の番では、まず「${g === 'chess' ? 'チェック' : '王手'}になる手」を見てみましょう。`,
    ],
    hang: (g, d) => (d.moved ? [
      d.defended
        ? `おっと！ その${d.name}、${d.by}に取られると、取り返しても${d.loss}点の損です。`
        : `おっと！ その${d.name}、${d.by}にタダで取られちゃいます。守ってくれる味方がいません。`,
      `あぶない！ ${d.at}は${d.by}の利きの中です。${d.name}が取られてしまいます。`,
      `その${d.name}、${d.by}に狙われていますよ。動かす前に「行き先は安全？」を確かめましょう。`,
    ] : d.still ? [
      `${d.at}の${d.name}が、${d.by}に取られる形のままです。先に守るか、逃げましょう。`,
    ] : [
      `${d.at}の${d.name}が、${d.by}に取られる形になっています。`,
      `いまの手で、${d.at}の${d.name}が${d.by}に狙われる形になりました。`,
    ]),
    missed: (g, d) => (d.safe ? [
      `あっ、${d.at}の${d.target}がタダで取れました！`,
      `チャンスでした！ 相手の${d.target}は、誰にも守られていませんでした。`,
      `${d.target}、取れましたよ。自分の番では、まず「タダで取れる駒」を探しましょう。`,
    ] : [`${d.at}の${d.target}を取れば、取り返されても${d.gain}点の得でした。`]),
    threat: (g, d) => [
      `相手は次に、${d.at}の${d.target}を狙っています。いまのうちに守りましょう。`,
      `気をつけて。相手の${d.piece}が、あなたの${d.target}を取ろうとしています。`,
    ],
    deep: (g, d) => [
      `うーん、取り合いを最後まで読むと、${d.loss}点の損になります。`,
      `この手、相手にうまく返されると${d.loss}点の損です。「相手のいちばん嫌な返し」を想像してみましょう。`,
    ],
    deepmiss: (g, d) => (d.fork ? [`悪くない手です。でも、両取りのチャンスがありました！`, `惜しい！ 2つの駒を同時に狙える手がありました。`]
      : [`悪くない手です。でも、もっと得をする手がありました。`, `安全な手ですが、${d.gain}点得をする手を見逃しています。`]),
    stalemate: () => [
      'あちゃー、ステイルメイトです！ 勝っていたのに引き分けになってしまいました。',
      'ステイルメイトで引き分けです……。相手のキングに、逃げ道を1つ残してあげましょう。',
    ],
    nopromo: (g, d) => [`成れるのに成りませんでしたね。${d.name}は成ると強くなるだけで、損はありません。`],
    slow: () => ['ここは必至をかけるチャンスでした！ 終盤は、駒の損得より速さです。', '惜しい！ 相手がどう受けても詰む手（必至）がありました。'],
    shanten: (g, d) => [`あっ、その${d.tile}は組の一部でした！ テンパイから1歩遠くなります。`, `${d.tile}を切ると、せっかくの形が崩れてしまいます。`],
    narrow: (g, d) => [`進みますが、もっと広く受けられる牌がありました（${d.diff}枚ちがいます）。`, `惜しい！ ${d.best}を切れば、${d.diff}枚多く受けられました。`],
    gselfatari: () => ['おっと！ 自分からアタリになりました。次に取られてしまいます。', 'その石、呼吸点が1つしかありません。取られちゃいます！'],
    gmisscap: (g, d) => [`チャンスでした！ アタリの石（${d.k}子）が取れました。`, `あっ、取れる石がありました。相手が打ったら、まずアタリを探しましょう。`],
    gignore: (g, d) => [`アタリの石（${d.k}子）がそのままです。逃げるか、相手を取って助けましょう。`, `あぶない！ ${d.k}子が取られそうです。`],
    gladder: () => ['その石、逃げてもシチョウで取られる形です。逃げるほど損が大きくなります。'],
    geye: () => ['あっ、自分の眼をつぶしてしまいました。眼は2つ残すのが生きるコツです。'],
    gedge: (g, d) => [`序盤から端に近すぎます（${d.line}線）。まずは隅の3線・4線に打ちましょう。`, `${d.line}線は低すぎて、囲える地が小さくなります。序盤は3線・4線が目安です。`],
    gfill: () => ['そこはもうあなたの地です。自分の地に打つと1目減ってしまいます。打つ所がなければパスでOK！'],
    gloss: (g, d) => [`うーん、この手で形勢の見込みが約${d.drop}目下がりました。危ない石や、大きい所はありませんでしたか？`, `この手は約${d.drop}目の損になったようです。打つ前に、守る所と大きい所を見比べてみましょう。`],
    nakiyaku: () => ['その鳴き、役が残らなそうです。鳴く前に「この手の役は何か」を確かめましょう。', '鳴くと役がなくなりそうです。門前なら、リーチという役が使えますよ。'],
    agarimiss: (g, d) => [d.tile ? `あっ、${d.tile}であがれました！ アガリの形でしたよ。` : 'あっ、あがれる形でした！', 'アガリを見逃しています！ ツモったら、まず「あがれる形か」を確かめましょう。'],
    agarirasu: () => ['あがったけれど、4着のまま終わってしまいました。オーラスは「あがったら何着か」を先に計算しましょう。'],
  };
  const PRAISE = {
    mate: (g) => [g === 'chess' ? 'チェックメイト！ おみごとです！' : '詰みです！ おみごと！'],
    stalemateSave: () => ['ナイス粘り！ ステイルメイトで、負けそうな局を引き分けにしました。'],
    stalemate: () => ['ステイルメイトで引き分けです。'],
    fork: (g, d) => [`すごい！ 両取りです。${d.hitNames.slice(0, 2).join('と')}を同時に狙っています。`, `いい手！ ${d.hitNames.slice(0, 2).join('と')}の両取りです。どちらかは取れそう。`],
    took: (g, d) => [`ナイス！ ${d.took}をいただきました。`, `${d.took}を取りました。取り返されない、いい取り方です。`, `いいですね、${d.took}をゲット！`],
    check: (g) => [g === 'chess' ? 'チェック！ キングの逃げ道を減らしていきましょう。' : '王手！ 玉の逃げ道を減らしていきましょう。'],
    hits: (g, d) => [`${d.hits[0]}に当たりをかけました。相手は守れるかな？`, `${d.hits[0]}を狙いました。相手の受けを見てみましょう。`],
    deepGood: (g, d) => [`好手です！ 読むと${d.deepGood}点得をする手でした。`],
    mateRun: (g) => [g === 'chess' ? 'おみごと！ この手で、相手はもうチェックメイトから逃げられません。' : 'おみごと！ この手で、相手はもう詰みから逃げられません。',
      'いい手！ この手で詰みまで見えています。'],
    tsumero: () => ['詰めろです！ 相手が受けなければ、次に詰みます。', 'いい寄せです。相手は受けに回るしかありません。'],
    safe: (g) => (g === 'mahjong' ? ['いい切り方です。', 'その調子！'] : ['いい手です。取られる駒はありません。', '落ち着いた一手。この調子！', '安全な手です。相手の次の狙いも見ておきましょう。']),
    tenpai: (g, d) => [`テンパイ！ ${d.waits}待ちです。あとはアガリ牌を引くだけ！`, `テンパイしました！ ${d.waits}が来ればアガリです。`],
    mjgood: (g, d) => [`いい切り方！ ${d.kinds}種${d.tiles}枚を受け入れます。`, `ナイス！ 受け入れは${d.tiles}枚。広い形です。`],
    gcap: (g, d) => [`${d.k}子取りました！ アゲハマは1つ1目です。`, `ナイス！ ${d.k}子をいただきました。`],
    gsave: () => ['アタリの石を助けました。いい判断です！'],
    gdouble: () => ['両アタリ！ どちらかは取れます。'],
    gatari: () => ['アタリをかけました。相手は逃げられるかな？'],
    gquiet: () => ['いい場所です。', 'いい感じです。', '落ち着いた一手です。'],
  };
  const BAD_KINDS = new Set(Object.keys(TALK));
  /**
   * 講評からひとことを作る。ext = { theme（弱点の種類）, streak（連続で良い手）}
   * 返り値 { text, mood: happy|cheer|think|hmm|worry|alert, arrows: [{from,to,c}], kind }
   */
  function talk(game, rv, ext = {}) {
    if (!rv || !rv.lines || !rv.lines.length) return null;
    const bad = rv.level !== 'ok' ? rv.lines.find((l) => BAD_KINDS.has(l.kind)) : null;
    const goal = rv.lines.find((l) => l.kind === 'goal' && !l.ok);
    const tip = rv.lines.find((l) => l.kind === 'tip');
    if (bad) {
      const d = bad.d || {};
      let text = pickOne(TALK[bad.kind](game, d));
      if (ext.theme && ext.theme === bad.kind) {
        const tl = THEME_JA[bad.kind] || KIND_JA[bad.kind];
        text += ext.themeN > 1 ? `（テーマ「${tl}」、この局${ext.themeN}回目）` : `（今回のテーマ「${tl}」です）`;
      }
      const arrows = [...(bad.arrows || [])];
      // 「こうすれば」の手も緑の矢印で（成り忘れは同じ手なので出さない）
      if (bad.kind !== 'nopromo' && bad.better?.to && bad.better.from && !arrows.some((a) => a.to === bad.better.to && a.from === bad.better.from)) {
        arrows.push({ from: bad.better.from, to: bad.better.to, c: 'ok' });
      }
      return { text, mood: rv.level === 'blunder' ? 'worry' : 'hmm', arrows, kind: bad.kind };
    }
    if (goal) return { text: `めあて：${goal.what}`, mood: 'hmm', arrows: [], kind: 'goal' };
    // 言い方を用意していない指摘（新しい種類など）は、講評の文をそのまま使う
    const other = rv.level !== 'ok' ? rv.lines.find((l) => !['good', 'goal', 'tip'].includes(l.kind)) : null;
    if (other) return { text: other.what, mood: rv.level === 'blunder' ? 'worry' : 'hmm', arrows: other.arrows || [], kind: other.kind };
    if (tip) return { text: tip.talk || tip.what, mood: tip.mood || 'think', arrows: tip.arrows || [], kind: 'tip' };
    const good = rv.lines.find((l) => l.kind === 'good') || rv.lines[0];
    const d = good.d || {};
    let key = 'safe';
    if (d.mate) key = 'mate';
    else if (d.stalemateSave) key = 'stalemateSave';
    else if (d.stalemate) key = 'stalemate';
    else if (d.mateRun) key = 'mateRun';
    else if (d.tsumero) key = 'tsumero';
    else if (d.deepGood) key = 'deepGood';
    else if (d.fork) key = 'fork';
    else if (d.took) key = 'took';
    else if (d.check) key = 'check';
    else if (d.hits && d.hits.length) key = 'hits';
    else if (d.tenpai) key = 'tenpai';
    else if (d.kinds != null) key = 'mjgood';
    else if (d.gcap) key = 'gcap';
    else if (d.gsave) key = 'gsave';
    else if (d.gdouble) key = 'gdouble';
    else if (d.gatari) key = 'gatari';
    else if (game === 'go') key = 'gquiet';
    let text = pickOne(PRAISE[key](game, d));
    if (key === 'safe' || key === 'gquiet' || key === 'mjgood') {
      if (ext.streak >= 3 && ext.streak % 3 === 0) text = `${ext.streak}手続けてノーミス！ ${text}`;
    }
    const mood = key === 'mate' || key === 'mateRun' || key === 'tsumero' || key === 'fork' || key === 'stalemateSave' || key === 'tenpai' ? 'cheer'
      : key === 'stalemate' ? 'think' : key === 'safe' || key === 'gquiet' ? 'think' : 'happy';
    return { text, mood, arrows: key === 'fork' || key === 'hits' ? (good.arrows || []) : [], kind: 'good' };
  }

  return { THEME_JA, talk, evalPosition, KIND_JA, lessonFor, attackers, realAttackers, hanging, freeCaptures, forks, ukeire, tiedWithBest, suggestBetter, explainMove, explainDiscard, moveMarks, isolated, gainOfMove, readingLines, discardRoutes, mateRun, withMateRun };
};
const NS_COACH = COACH_FACTORY();

// ── js/core/think-tasks.js ──────────────────────────────────
// 重い読み（相手の思考・講評の読み・形勢グラフ）をまとめたもの。
// Worker の中でも、Worker が使えないときは画面側でも、同じこの関数を動かす。
const THINK_TASKS_FACTORY = () => {
  const C = NS_CHESS, S = NS_SHOGI, K = NS_COACH;
  const badKind = (rv) => (rv.level !== 'ok' ? rv.lines.find((l) => !['good', 'goal'].includes(l.kind))?.kind : null);
  /**
   * 将棋の終盤の速度。指した手が王手でない詰めろ（相手が受けなければ次に詰む）なら、必至かどうかまで見てほめる。
   * 指した手が詰めろでもないのに、必至（相手がどう受けても次に詰む）をかける手があったなら「寄せの遅れ」として教える。
   * 必至を探すのは、相手玉の近く（2マス以内）に行く手・打つ手と、飛・角・香・竜・馬の手だけ。読みは合わせて約0.7秒で打ち切る
   */
  function speedReview(beforeState, state, mv, shape, rv) {
    const me = beforeState.turn || 'b';
    const foeK = S.findKing(beforeState.board, S.opponent(me));
    if (!foeK || !S.findKing(beforeState.board, me)) return rv;
    const t0 = Date.now(), BUDGET = 700, left = () => BUDGET - (Date.now() - t0);
    const threatens = (st) => S.findMateIn1({ ...st, turn: me }, shape).length > 0;   // 詰めろ（相手が何もしなければ詰む）
    const check = S.inCheck(state.board, state.turn, shape);
    // 1) 指した手が詰めろなら、ほめる（必至ならそう言う）。駒の取り逃がしの指摘があるときは、そのまま
    if (!check && threatens(state)) {
      if (rv.level !== 'ok') return rv;
      if (K.mateRun('shogi', state, me, shape, Math.min(600, left())) === 1) return K.withMateRun('shogi', rv, mv, 1, false);
      const praise = { what: '詰めろです。', why: '相手が受けなければ、次の手で詰みます。終盤は、駒を取るより相手玉に迫る手が速い勝ち方です。' };
      // 打つ手は形の講評をしないので、良い手の行がないことがある。そのときは足す
      if (!rv.lines.some((l) => l.kind === 'good')) {
        return { ...rv, lines: [...rv.lines, { kind: 'good', sq: mv.to, ...praise, better: null, lesson: '', marks: {}, d: { tsumero: true } }] };
      }
      return { ...rv, lines: rv.lines.map((l) => (l.kind === 'good' ? { ...l, ...praise, d: { ...(l.d || {}), tsumero: true } } : l)) };
    }
    if (check) return rv;
    // 2) 必至があったか。攻め駒（相手玉から2マス以内にいる歩以外の駒と、歩以外の持ち駒）が2つ以上あるときだけ探す。
    //    序盤や、攻め駒のない局面で読みの時間を使わない
    const kf = Number(foeK[0]), kr = Number(foeK[1]);
    const dist = (sq) => Math.max(Math.abs(Number(sq[0]) - kf), Math.abs(Number(sq[1]) - kr));
    const nearAttackers = Object.entries(beforeState.board)
      .filter(([sq, p]) => S.colorOf(p) === me && !['P', 'K'].includes(S.baseOf(p)) && dist(sq) <= 2).length;
    const handAttackers = Object.entries(beforeState.hands?.[me] || {}).filter(([k, n]) => k !== 'P' && n > 0).reduce((a, [, n]) => a + n, 0);
    if (nearAttackers + handAttackers < 2) return rv;
    const near = (sq) => dist(sq) <= 2;
    const LONG = new Set(['R', 'B', 'L']);
    let hit = null;
    const cands = S.allLegalMoves(beforeState, shape)
      .filter((m) => near(m.to) || (m.from && LONG.has(S.baseOf(beforeState.board[m.from]))))
      .sort((a, b) => dist(a.to) - dist(b.to));   // 必至はたいてい玉のすぐそばの手なので、近い手から読む
    for (const m of cands) {
      if (left() <= 0) return rv;   // 読み切れないときは何も言わない
      const s1 = S.applyMove(beforeState, m, shape);
      if (S.inCheck(s1.board, s1.turn, shape)) continue;   // 王手の詰みは「詰みの見逃し」で見る
      if (!threatens(s1)) continue;
      if (K.mateRun('shogi', s1, me, shape, Math.min(400, left())) === 1) { hit = m; break; }
    }
    if (!hit) return rv;
    const label = S.moveLabel(beforeState, hit, shape);
    const line = {
      kind: 'slow', sq: hit.to,
      what: `ここは相手玉に必至をかける手がありました（▲${label}）。`,
      why: '必至は、相手がどう受けても次の手で詰む形です。終盤は、駒を取ったり守ったりするより、相手玉に迫る方が速く勝てます。',
      better: { from: hit.from || null, to: hit.to, drop: hit.drop || null, promote: !!hit.promote, label: `▲${label}`, reason: '相手がどう受けても、次の手で詰みます。' },
      lesson: '終盤は「自玉に詰めろがかかっているか」→「相手玉に詰めろ・必至をかけられるか」の順に見ます。',
      marks: { ...(hit.from ? { [hit.from]: 'sel' } : {}), [hit.to]: 'ok' },
      arrows: [{ from: hit.from || null, to: hit.to, c: 'ok' }],
      d: { hisshi: true, label },
    };
    return { ...rv, level: 'miss', lines: [line, ...rv.lines.filter((l) => !['good', 'missed', 'deepmiss'].includes(l.kind))] };
  }
  return {
    pick: (game, args) => (game === 'chess' ? C : S).pickMove(...args),
    eval: (game, pos, ctx, ms) => K.evalPosition(game, pos, ctx, ms),
    /** 読み筋の再生用の手順（コーチの読みと同じもの） */
    lines: (game, beforePos, afterPos, ctx, ms, alt) => K.readingLines(game, beforePos, afterPos, ctx, ms, alt),
    /** 麻雀：テンパイまでの道筋（あなたの切り方と最善の切り方） */
    mjRoutes: (hand, played, best, sets, seen) => K.discardRoutes(hand, played, best, sets, seen),

    /** 囲碁：相手の一手／終局の死に石の見込み／形勢グラフ */
    goPick: (args) => NS_GO.pick(args),
    goOwner: (args) => NS_GO.ownership(args),
    /** 囲碁の地の見込み（黒から見た目数・コミ込み）。playouts を省くと速い既定の量で読む */
    goEval: (st, komi, playouts) => NS_GO.estimate(st, komi, playouts),
    /** キング＋ポーンの終盤：勝敗／勝つ手／黒の最善の応手（勝敗表はこのスレッドで1回だけ作る） */
    kpkInfo: (board, stm) => NS_KPK.info(board, stm),
    kpkWins: (board) => NS_KPK.winning(board),
    kpkReply: (board) => NS_KPK.reply(board),

    /** チェス：自分が指した手の講評（詰みの見逃し／許した詰み／形の講評／読み） */
    chessReview({ beforeMove, beforeOpts, position, opts, me, foe, mfrom, sq, special }) {
      const mate = C.gameStatus(position, foe, opts) === 'checkmate';
      const missed = mate ? [] : C.findMateIn1(beforeMove, me, beforeOpts);
      const allows = mate ? [] : C.findMateIn1(position, foe, opts);
      // 1手で詰まなくても、2手で必ず詰む手順（メイト・イン・2）を見逃していないか／許していないか
      let missedMate = missed[0], missedMateN = 1, allowsMate = allows[0], allowsMateN = 1;
      if (!mate && !missedMate && !special) {
        const fm = C.findForcedMate(beforeMove, me, beforeOpts, 2, 250);
        if (fm && !C.stillMating(position, me, opts)) { missedMate = fm; missedMateN = 3; }
      }
      if (!mate && !allowsMate && !special) {
        const fa = C.findForcedMate(position, foe, opts, 2, 250);
        if (fa) { allowsMate = fa; allowsMateN = 3; }
      }
      // ステイルメイト（ポーンゲームのように「動けなくなったら負け」の盤は除く）
      const stalemate = !mate && !special && C.gameStatus(position, foe, opts) === 'stalemate';
      let rv = K.explainMove('chess', beforeMove, position, { from: mfrom, to: sq }, me, beforeOpts,
        { mate, missedMate, missedMateN, allowsMate, allowsMateN, stalemate,
          search: { before: { b: beforeMove, turn: me }, after: { b: position, turn: foe } } });
      // 詰みへの捨て駒：駒を取られる形でも、相手がどう受けても詰むなら悪手ではない（駒の損得の指摘を消す）
      if (!mate && !stalemate && !special && rv.lines.some((l) => ['hang', 'missed', 'threat', 'deep', 'deepmiss'].includes(l.kind))) {
        const run = K.mateRun('chess', position, me, opts, 600);
        if (run) rv = K.withMateRun('chess', rv, { from: mfrom, to: sq }, run, C.inCheck(position, foe, opts));
      }
      const kind = badKind(rv);
      let caps = null, unsolvable = false;
      if (kind === 'missed') caps = K.freeCaptures('chess', beforeMove, me, beforeOpts);
      if (kind === 'allowmate') {
        unsolvable = !C.allLegalMoves(beforeMove, me, beforeOpts).some((m) => !(m.from === mfrom && m.to === sq)
          && !C.findMateIn1(C.applyMove(beforeMove, m.from, m.to, beforeOpts), foe, beforeOpts).length);
      }
      return { mate, missedMate: missedMate || null, missedMateN, allowsMate: allowsMate || null, allowsMateN, rv, kind, caps, unsolvable };
    },

    /** 将棋：自分が指した手の講評（持ち駒を打つ手も読む） */
    shogiReview({ beforeState, state, mv, shape, win }) {
      const missed = win ? [] : S.findMateIn1(beforeState, shape);
      const allows = win ? [] : S.findMateIn1(state, shape);
      let missedMate = missed[0], missedMateN = 1, allowsMate = allows[0], allowsMateN = 1;
      if (!win && !missedMate) {
        const fm = S.findMateIn(beforeState, 3, shape, 300);
        if (fm && !S.stillMating(state, shape)) { missedMate = fm; missedMateN = 3; }
      }
      if (!win && !allowsMate) {
        const fa = S.findMateIn(state, 3, shape, 300);
        if (fa) { allowsMate = fa; allowsMateN = 3; }
      }
      const info = { mate: win, missedMate, missedMateN, allowsMate, allowsMateN, hands: beforeState.hands,
        search: { before: beforeState, after: state } };
      // 打つ手は形の講評をせず、1手詰めと読みの講評だけにする
      let rv = mv.from
        ? K.explainMove('shogi', beforeState.board, state.board, mv, beforeState.turn || 'b', shape, info)
        : K.explainMove('shogi', beforeState.board, state.board, { from: null, to: mv.to, drop: mv.drop }, beforeState.turn || 'b', shape,
          { ...info, onlyDeep: !(info.missedMate || info.allowsMate) });
      // 詰みへの捨て駒・必至：駒を取られる形でも、相手がどう受けても詰むなら悪手ではない
      if (!win && rv.lines.some((l) => ['hang', 'missed', 'threat', 'deep', 'deepmiss'].includes(l.kind))) {
        const run = K.mateRun('shogi', state, beforeState.turn || 'b', shape, 600);
        if (run) rv = K.withMateRun('shogi', rv, mv, run, S.inCheck(state.board, state.turn, shape));
      }
      // 終盤の速度：詰めろ・必至をかけた手はそう伝え、必至があったのに詰めろにもならない手を指したら教える。
      // 駒の取り逃がしより必至の見逃しの方が大きいので、取り逃がしの指摘だけのときも見る
      if (!win && !missedMate && !allowsMate && rv.lines.every((l) => ['good', 'goal', 'tip', 'missed', 'deepmiss'].includes(l.kind))) {
        rv = speedReview(beforeState, state, mv, shape, rv);
      }
      const kind = badKind(rv);
      let caps = null, unsolvable = false;
      if (kind === 'missed') caps = K.freeCaptures('shogi', beforeState.board, beforeState.turn || 'b', shape);
      if (kind === 'allowmate') {
        const t0 = Date.now();
        unsolvable = !S.allLegalMoves(beforeState, shape).some((m) => Date.now() - t0 > 400
          || (!(m.from === mv.from && m.to === mv.to && m.drop === mv.drop) && !S.findMateIn1(S.applyMove(beforeState, m, shape), shape).length));
      }
      return { missedMate: missedMate || null, missedMateN, allowsMate: allowsMate || null, allowsMateN, rv, kind, caps, unsolvable };
    },

    /**
     * 詰みの問題の相手の応手：いちばん長く逃げられる手を選ぶ（読みは1.5秒で打ち切る）。
     * 画面側で読むとそのあいだ画面が止まるので、スレッドで読む。中身は以前の画面側の処理と同じ
     */
    mateDefend({ game, position, state, side, foe, opts, shape, limit, ply, ms }) {
      // 読みは時間で打ち切る（チェス1.5秒・将棋3秒）。打ち切るときは、そこまでに絞った候補から選ぶ
      const LATE = {};
      const started = Date.now();
      const budget = ms || (game === 'chess' ? 1500 : 3000);
      const tick = () => { if (Date.now() - started > budget) throw LATE; };
      if (game === 'chess') {
        const moves = C.allLegalMoves(position, foe, opts);
        if (!moves.length) return null;
        // 攻め方が k 手以内に必ず詰ませられるか（k = 攻め方の残り手数）
        const memo = new Map();
        const forced = (b, k) => {
          tick();
          const key = k + JSON.stringify(b);
          if (memo.has(key)) return memo.get(key);
          let r = false;
          for (const m of C.allLegalMoves(b, side, opts)) {
            const b1 = C.applyMove(b, m.from, m.to, opts);
            const st = C.gameStatus(b1, foe, opts);
            if (st === 'checkmate') { r = true; break; }
            if (k === 1 || st === 'stalemate') continue;
            const reps = C.allLegalMoves(b1, foe, opts);
            if (reps.length && reps.every((x) => forced(C.applyMove(b1, x.from, x.to, opts), k - 1))) { r = true; break; }
          }
          memo.set(key, r);
          return r;
        };
        // いちばん長く逃げられる手を選ぶ（1手で詰まない手 → 2手でも詰まない手 …）
        const left = Math.floor((limit - ply - 1 + 1) / 2);   // この応手のあと、攻め方に残る手数
        let pool = moves;
        // 応手が1つしかなければ読まない（読むと画面が数秒止まっていた）
        if (moves.length > 1) {
          try {
            const p1 = moves.filter((m) => !forced(C.applyMove(position, m.from, m.to, opts), 1));
            if (p1.length) pool = p1;
            for (let k = 2; k <= left; k++) {
              const longer = pool.filter((m) => !forced(C.applyMove(position, m.from, m.to, opts), k));
              if (!longer.length) break;
              pool = longer;
            }
          } catch (e) { if (e !== LATE) throw e; }
        }
        const pick = pool[0];
        return pick;
      } else {
        const moves = S.allLegalMoves(state, shape);
        if (!moves.length) return null;
        // 王手の連続で n 手以内に詰むか（詰将棋なので攻め方は王手だけ）
        const memo = new Map();
        const mateWithin = (st, n) => {
          tick();
          const k = n + st.turn + JSON.stringify(st.board) + JSON.stringify(st.hands);
          if (memo.has(k)) return memo.get(k);
          const r = mateWithinRaw(st, n);
          memo.set(k, r);
          return r;
        };
        const mateWithinRaw = (st, n) => {
          for (const mv of S.allLegalMoves(st, shape)) {
            const s1 = S.applyMove(st, mv, shape);
            if (!S.inCheck(s1.board, S.opponent(st.turn), shape)) continue;
            const reps = S.allLegalMoves(s1, shape);
            if (!reps.length) return true;
            if (n > 1 && reps.every((r) => mateWithin(S.applyMove(s1, r, shape), n - 2))) return true;
          }
          return false;
        };
        // いちばん長く逃げられる手を選ぶ（1手で詰まない手 → 3手でも → 5手でも …）。
        // 以前は5手までしか読まず、9手詰めでは「7手で詰む受け」と「逃れる受け」を見分けられなかった。
        // また時間切れになると、それまでに確かめた分を捨てていたので、逃れる受けがあるのに詰む受けを選んでいた
        const left = limit - ply - 1;   // この応手のあと、攻め方に残る手数
        let pool = moves;
        if (moves.length > 1) {
          // 逃れやすい受けから調べる：攻めている駒を取る手 → 玉が逃げる手 → 盤上の駒の合駒 → 持ち駒の合駒
          const kSq = S.findKing(state.board, state.turn);
          const rank = (m) => (m.drop ? 3 : state.board[m.to] ? 0 : m.from === kSq ? 1 : 2);
          pool = [...moves].sort((a, b) => rank(a) - rank(b));
          let partial = [], failed = new Set();
          try {
            for (let n = 1; n <= left; n += 2) {
              partial = []; failed = new Set();
              for (const m of pool) {
                if (!mateWithin(S.applyMove(state, m, shape), n)) partial.push(m); else failed.add(m);
              }
              if (!partial.length) break;   // どの受けでも n 手で詰む：ここまでに残った受けから選ぶ
              pool = partial;
              partial = []; failed = new Set();
            }
          } catch (e) {
            if (e !== LATE) throw e;
            // 読みの途中で時間切れ：この深さでも詰まないと確かめた受け → まだ確かめていない受け → 残りの順に選ぶ
            // （この深さで詰むと分かった受けは選ばない）
            const unknown = pool.filter((m) => !failed.has(m) && !partial.includes(m));
            if (partial.length) pool = partial;
            else if (unknown.length) pool = unknown;
          }
        }
        const pick = pool[0];
        return pick;
      }
    },
  };
};

// ── js/core/goals.js ────────────────────────────────────────
const NS_GOALS = (() => {
  const C = NS_CHESS;
  const S = NS_SHOGI;
  const M = NS_MAHJONG;
  const { isolated, ukeire } = NS_COACH;
  // goals.js — 「そのレッスンで言われたことが、実際にできているか」を見る。
  //
  // coach.js が見ているのは、どの局面でも変わらない良し悪し（駒がタダになる、受け入れが狭い）。
  // こちらは「いまこのレッスンで意識してほしいこと」に沿っているかを見る。
  //
  // レッスンの play ステップに goals: ['chess.opening'] のように書くと、
  // 対局中その観点でも講評が出る。





  const sqJa = (s) => `${s[0]}${'一二三四五六七八九'[Number(s[1]) - 1]}`;

  /**
   * 各ゴールは check(info) を持つ。
   * info = { before, after, move, color, ctx, ply, history, hand, tile, sets, discards }
   * 返り値は { kind:'goal', what, why, lesson, ok } か null。
   */
  const GOALS = {

    // ── チェス：序盤の3つ ──────────────────────────────
    'chess.opening': {
      label: '序盤の3つ（中央・展開・キャスリング）',
      check({ before, after, move, color, ctx, ply, history }) {
        if (ply > 24) return null;  // 12手目くらいまでを序盤として見る
        const back = color === 'w' ? '1' : '8';
        const piece = before[move.from];
        if (!piece) return null;           // 盤面と手が食い違っていたら黙って見送る
        const kind = C.kindOf(piece);

        // キャスリング（キングが2マス横へ）
        if (kind === 'K' && Math.abs(C.FILES.indexOf(move.from[0]) - C.FILES.indexOf(move.to[0])) === 2) {
          return {
            kind: 'goal', ok: true,
            what: 'キャスリングしました。キングが隅に隠れ、ルークも中央へ出てきました。',
            why: '', lesson: '',
          };
        }

        // 同じ駒を2回以上動かしていないか
        // history には自分の手だけが入っている。いま指した手は除いて数える
        // この駒が来た道を、いまのマスから逆にたどって数える（直前の1手だけ見ると3回目でも「2回目」になる）
        let moved = 0;
        for (let k = history.length - 1, at = move.from; k >= 0; k--) {
          const hm = history[k].move;
          if (!hm || hm === move || hm.to !== at) continue;
          moved++; at = hm.from;
        }
        if (moved >= 1 && ply <= 16 && kind !== 'K' && !before[move.to]) {
          return {
            kind: 'goal', ok: false,
            what: `序盤にこの${C.PIECE_JA[kind]}を動かすのは${moved + 1}回目です。`,
            why: '序盤は「1手で1枚ずつ前に出す」競争です。1枚を2回動かす間に、相手は2枚を働かせています。',
            lesson: 'まだ初期位置から一度も動いていない駒がないか、先に探してみてください。',
          };
        }

        // 早すぎるクイーン
        if (kind === 'Q' && ply <= 6) {
          return {
            kind: 'goal', ok: false,
            what: '序盤の早い段階でクイーンを出しました。',
            why: 'クイーンは相手の安い駒に追いかけ回されます。逃げるたびに1手損をして、その間に相手は駒を展開します。',
            lesson: 'クイーンは、ナイトとビショップを出してから動かします。',
          };
        }

        // 中央のポーンを動かしたか
        const centerDone = Object.keys(after).some((s2) =>
          ['d4', 'e4', 'd5', 'e5'].includes(s2) && after[s2] && C.colorOf(after[s2]) === color
          && C.kindOf(after[s2]) === 'P');
        if (!centerDone && ply >= 4) {
          return {
            kind: 'goal', ok: false,
            what: 'まだ中央のポーンが進んでいません。',
            why: '中央（d・e列）を取ると、ナイトもビショップも動ける範囲が一気に広がります。',
            lesson: '最初の1手か2手で、e4かd4にポーンを進めるのが定番です。',
          };
        }

        // 奥に眠っている駒
        const asleep = Object.entries(after).filter(([s2, p]) =>
          C.colorOf(p) === color && s2[1] === back && ['N', 'B'].includes(C.kindOf(p)));
        if (asleep.length && ply >= 10) {
          return {
            kind: 'goal', ok: false,
            what: `${asleep.map(([s2, p]) => `${s2}の${C.PIECE_JA[C.kindOf(p)]}`).join('と')}が、まだ初期位置のままです。`,
            why: '出ていない駒は、盤にいても0点と同じです。相手より働いている駒が多い方が、必ず有利になります。',
            lesson: 'ナイトを先に、そのあとビショップ。出したらキャスリングでキングを隅へ。',
          };
        }

        if (['N', 'B'].includes(kind) && move.from[1] === back) {
          return {
            kind: 'goal', ok: true,
            what: `${C.PIECE_JA[kind]}を展開しました。序盤の狙いどおりです。`,
            why: '', lesson: '',
          };
        }
        return null;
      },
    },

    // ── 将棋：玉を囲う ────────────────────────────────
    'shogi.castle': {
      label: '玉を囲う（金銀3枚を玉のそばへ）',
      check({ before, after, move, ctx, ply }) {
        if (ply > 30) return null;
        const kingSq = S.findKing(after, 'b');
        if (!kingSq) return null;
        const [kf] = S.idx(kingSq);
        const rook = Object.entries(after).find(([, p]) => S.baseOf(p) === 'R' && S.colorOf(p) === 'b');

        // 玉と飛車が同じ側にいないか
        if (rook && ply >= 8) {
          const rf = S.idx(rook[0])[0];
          if (Math.abs(kf - rf) <= 2) {
            return {
              kind: 'goal', ok: false,
              what: `玉（${sqJa(kingSq)}）と飛車（${sqJa(rook[0])}）が近すぎます。`,
              why: '飛車のまわりは必ず戦場になります。そこに玉がいると、攻められた瞬間に玉まで危なくなります。',
              lesson: '飛車が右なら玉は左へ、飛車を左に振ったなら玉は右へ。まずここを引き離します。',
            };
          }
        }

        // 玉がまだ初期位置
        if (kingSq === '59' && ply >= 10) {
          return {
            kind: 'goal', ok: false,
            what: 'まだ玉が5九から動いていません。',
            why: '真ん中の玉は上下左右すべてから攻められます。囲いは攻める前に作るものです。',
            lesson: '玉を2八や8八のほうへ寄せて、金と銀をそのまわりに集めます。',
          };
        }

        // 玉のそばの金銀の枚数
        const near = Object.entries(after).filter(([s2, p]) => {
          if (S.colorOf(p) !== 'b' || !['G', 'S'].includes(S.baseOf(p))) return false;
          const [f, r] = S.idx(s2), [kf2, kr] = S.idx(kingSq);
          return Math.abs(f - kf2) <= 2 && Math.abs(r - kr) <= 2;
        }).length;
        if (ply >= 20 && near < 2) {
          return {
            kind: 'goal', ok: false,
            what: `玉のまわりに金銀が${near}枚しかありません。`,
            why: '囲いで本当に大事なのは形の名前ではなく、金銀3枚が玉のそばに寄っていることです。',
            lesson: '攻めの手が思いついても、金銀が寄るまではもう少し我慢します。',
          };
        }

        const k = move.from && before[move.from] ? S.baseOf(before[move.from]) : '';
        if (['G', 'S'].includes(k)) {
          const [f, r] = S.idx(move.to), [kf2, kr] = S.idx(kingSq);
          if (Math.abs(f - kf2) <= 2 && Math.abs(r - kr) <= 2) {
            return { kind: 'goal', ok: true, what: '金銀が玉に寄りました。囲いの狙いどおりです。', why: '', lesson: '' };
          }
        }
        return null;
      },
    },

    // ── 将棋：歩から攻める ────────────────────────────
    'shogi.attack': {
      label: '攻めは歩から',
      check({ before, move, ply }) {
        if (ply < 20) return null;
        const moved = move.from ? before[move.from] : null;
        if (!moved && !move.drop) return null;
        const k = moved ? S.baseOf(moved) : '';
        const isDrop = !!move.drop;
        const toRank = S.idx(move.to)[1];
        // 大駒が単騎で敵陣へ飛び込んでいないか
        if (['R', 'B'].includes(k) && toRank <= 3) {
          return {
            kind: 'goal', ok: false,
            what: '大駒だけで敵陣に飛び込みました。',
            why: '大駒は強い代わりに、逃げ場を失うと安い駒で捕まえられます。取られると相手の持ち駒になって戻ってきます。',
            lesson: '「歩のない攻めは切れる」と言われます。まず歩で相手の守りを動かしてから、大駒を使います。',
          };
        }
        if (k === 'P' || move.drop === 'P') {
          return {
            kind: 'goal', ok: true,
            what: isDrop ? '歩を打ちました。攻めの基本の形です。' : '歩を使いました。攻めの起点として正しい考え方です。',
            why: '', lesson: '',
          };
        }
        return null;
      },
    },

    // ── 麻雀：孤立牌から切る ──────────────────────────
    'mahjong.isolated': {
      label: '孤立牌から切る',
      check({ hand, tile, sets }) {
        const lone = isolated(hand);
        if (!lone.length) return null;
        if (lone.includes(M.norm(tile))) {
          return {
            kind: 'goal', ok: true,
            what: `${M.tileName(tile)}は孤立牌でした。切る順番として正しいです。`,
            why: '', lesson: '',
          };
        }
        const order = (t) => {
          if (M.isHonor(t)) return 0;
          const n = Number(t[1]);
          return n === 1 || n === 9 ? 1 : n === 2 || n === 8 ? 2 : 3;
        };
        const first = [...lone].sort((a, b) => order(a) - order(b))[0];
        return {
          kind: 'goal', ok: false,
          what: `まだ${lone.map(M.tileName).join('・')}が孤立して残っています。`,
          why: `孤立牌は、いまのところどの組にも入っていない牌です。組の一部になっている牌より先に切ります。`,
          lesson: `迷ったら 字牌 → 1と9 → 2と8 → 3〜7 の順。この手なら${M.tileName(first)}からです。`,
        };
      },
    },

    // ── 麻雀：両面を残す ──────────────────────────────
    'mahjong.ryanmen': {
      label: '両面（34のような形）を残す',
      check({ hand, tile, sets }) {
        const table = ukeire(hand, sets);
        const best = table[0];
        const mine = table.find((r) => r.tile === tile);
        if (!mine || !best) return null;
        if (mine.shanten > best.shanten) {
          return {
            kind: 'goal', ok: false,
            what: `${M.tileName(tile)}切りで、テンパイから1歩遠ざかりました。`,
            why: 'できている組や両面を崩すと、受け入れの枚数より先に「あと何枚」が悪くなります。',
            lesson: '切る前に、その牌がすでに組や両面の一部になっていないかを確かめます。',
          };
        }
        if (mine.tiles >= best.tiles) {
          return { kind: 'goal', ok: true, what: '受け入れをいちばん広く保てています。', why: '', lesson: '' };
        }
        const lost = best.accept.filter((t) => !mine.accept.includes(t));
        if (!lost.length) return null;
        return {
          kind: 'goal', ok: false,
          what: `${lost.map(M.tileName).join('・')}が受け入れられなくなりました。`,
          why: '両面（3と4のような形）は、上下どちらからも面子になります。ここを崩すと受け入れが一気に減ります。',
          lesson: '切るのは、孤立牌か、片側しか伸びない形（12や89、間の抜けた13）から。',
        };
      },
    },
  };

  /**
   * play ステップに書かれた goals を順に見て、最初に引っかかったものを返す。
   * 「できている」判定は、警告が1つもないときだけ出す。
   */
  function checkGoals(ids, info) {
    if (!ids || !ids.length) return [];
    const results = [];
    for (const id of ids) {
      const g = GOALS[id];
      if (!g) continue;
      try {
        const r = g.check(info);
        if (r) results.push({ ...r, goalId: id, goalLabel: g.label });
      } catch { /* ゴール判定の失敗で対局を壊さない */ }
    }
    const bad = results.filter((r) => !r.ok);
    return bad.length ? bad.slice(0, 1) : results.slice(0, 1);
  }

  return { GOALS, checkGoals };
})();

// ── js/core/board.js ────────────────────────────────────────
const NS_BOARD = (() => {
  const { PIECE_JA: SHOGI_JA } = NS_SHOGI;
  // board.js — チェス盤／将棋盤を SVG で描く。入力は1つの委譲クリックで受ける。

  const CELL = 100;
  const CFILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const CRANKS = ['1', '2', '3', '4', '5', '6', '7', '8'];

  // 白黒どちらも塗りつぶしグリフを使い、色と輪郭で描き分ける（書体差に強い）
  // U+FE0E を付けて「文字として描く」ことを指定する（iOSなどで♟が絵文字になり、色が付かないのを防ぐ）
  const CHESS_GLYPH = { K: '♚\uFE0E', Q: '♛\uFE0E', R: '♜\uFE0E', B: '♝\uFE0E', N: '♞\uFE0E', P: '♟\uFE0E' };

  const LAYOUT = {
    chess: (w, h) => ({
      key: (c, r) => CFILES[c] + CRANKS[h - 1 - r],
      colRow: (s) => [CFILES.indexOf(s[0]), h - 1 - CRANKS.indexOf(s[1])],
      fileLabel: (c) => CFILES[c],
      rankLabel: (r) => CRANKS[h - 1 - r],
    }),
    shogi: (w, h) => ({
      key: (c, r) => `${w - c}${r + 1}`,
      colRow: (s) => [w - Number(s[0]), Number(s[1]) - 1],
      fileLabel: (c) => String(w - c),
      rankLabel: (r) => '一二三四五六七八九'[r],
    }),
  };

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

  class Board {
    /**
     * @param {HTMLElement} host
     * @param {{variant:'chess'|'shogi', w:number, h:number, coords?:boolean, flipped?:boolean}} opts
     */
    constructor(host, opts) {
      this.host = host;
      this.variant = opts.variant;
      this.w = opts.w; this.h = opts.h;
      this.coords = opts.coords ?? false;
      this.flipped = opts.flipped ?? false;
      this.L = LAYOUT[this.variant](this.w, this.h);
      this.onPick = null;
      this.position = {};
      this.marks = {};
      this.host.classList.add('boardwrap');
      this.svg = null;
      // キーボード操作：矢印キーでマスを動かし、Enter／スペースで決定する。読み上げ用の欄も持つ
      this.cursor = null;
      this.focused = false;
      this.live = document.createElement('div');
      this.live.className = 'sr';
      this.live.setAttribute('aria-live', 'polite');
      this.host.setAttribute('aria-label', '盤。矢印キーでマスを選び、Enterキーで決定します');
      this._bind();
    }

    get onPick() { return this._onPick || null; }
    set onPick(fn) {
      this._onPick = fn || null;
      // 触れる盤だけをタブで選べるようにする（説明用の盤は飛ばす）
      if (this._onPick) { this.host.tabIndex = 0; this.host.setAttribute('role', 'application'); }
      else { this.host.removeAttribute('tabindex'); this.host.removeAttribute('role'); }
    }

    _bind() {
      this.host.addEventListener('click', (e) => {
        const cell = e.target.closest('[data-sq]');
        if (!cell || !this.onPick) return;
        this.cursor = cell.dataset.sq;
        this.onPick(cell.dataset.sq);
      });
      this.host.addEventListener('focus', () => {
        if (!this.onPick) return;
        // マウスやタッチで触ったときは描き直さない。描き直すとタップしたマスが消えて、1回目のタップが無視される
        let byKeyboard = false;
        try { byKeyboard = this.host.matches(':focus-visible'); } catch { /* :focus-visible を知らない古いブラウザ */ }
        if (!byKeyboard) return;
        this.focused = true;
        if (!this.cursor) this.cursor = this.L.key(Math.floor(this.w / 2), this.flipped ? 0 : this.h - 1);
        this.draw();
        this._announce();
      });
      this.host.addEventListener('blur', () => { if (!this.focused) return; this.focused = false; this.draw(); });
      this.host.addEventListener('keydown', (e) => {
        if (!this.onPick) return;
        if (!this.focused && (e.key.startsWith('Arrow') || e.key === 'Enter' || e.key === ' ')) {
          // マウスやタッチで触ったあとにキーを使い始めたときは、最初の1回でカーソルを出すだけにする
          e.preventDefault();
          this.focused = true;
          if (!this.cursor) this.cursor = this.L.key(Math.floor(this.w / 2), this.flipped ? 0 : this.h - 1);
          this.draw();
          this._announce();
          return;
        }
        if (!this.cursor) return;
        const [col, row] = this.L.colRow(this.cursor);
        let [sc, sr] = this._screen(col, row);
        const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
        if (moves[e.key]) {
          e.preventDefault();
          sc = Math.max(0, Math.min(this.w - 1, sc + moves[e.key][0]));
          sr = Math.max(0, Math.min(this.h - 1, sr + moves[e.key][1]));
          const [c2, r2] = this._screen(sc, sr);   // 反転は自分自身の逆
          this.cursor = this.L.key(c2, r2);
          this.draw();
          this._announce();
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const sq = this.cursor;
          this.onPick(sq);
          // 盤が描き直されたあとの状態を読み上げる
          this._announce();
        }
      });
    }

    /** いまのマスを言葉にする（例：「e4、白のポーン、行けるマス」） */
    _announce() {
      if (!this.cursor) return;
      const sq = this.cursor;
      const p = this.position[sq];
      const name = this.variant === 'chess'
        ? sq
        : `${sq[0]}${'一二三四五六七八九'[Number(sq[1]) - 1] || sq[1]}`;
      let what = '空き';
      if (p) {
        if (this.variant === 'chess') {
          const ja = { K: 'キング', Q: 'クイーン', R: 'ルーク', B: 'ビショップ', N: 'ナイト', P: 'ポーン' }[p.toUpperCase()];
          what = `${p === p.toUpperCase() ? '白' : '黒'}の${ja}`;
        } else {
          const base = p.replace('+', '');
          what = `${base === base.toUpperCase() ? '先手' : '後手'}の${SHOGI_JA[(p.startsWith('+') ? '+' : '') + base.toUpperCase()]}`;
        }
      }
      const MARK_JA = { sel: '選択中', move: '行けるマス', unsafe: '行けるが取られるマス', last: '直前の手', hint: 'ヒント', ng: '注意', ok: '正解', target: '目標', threat: '相手の利き' };
      const mark = MARK_JA[this.marks[sq]];
      this.live.textContent = `${name}、${what}${mark ? `、${mark}` : ''}`;
    }

    setPosition(position, marks = {}) {
      this.position = position || {};
      this.marks = marks || {};
      this.arrows = [];   // コーチの矢印は、盤を描き直したら消す
      this.draw();
    }
    setMarks(marks) { this.marks = marks || {}; this.draw(); }
    /** コーチの矢印を出す。arrows = [{ from, to, c: 'ng' | 'ok' | 'tone' }]（from がない＝打つ手は、行き先に波紋だけ） */
    flash(arrows) {
      this.arrows = (arrows || []).filter((a) => a && a.to && this.L.colRow(a.to)[0] >= 0 && (!a.from || this.L.colRow(a.from)[0] >= 0));
      this.draw();
    }
    _arrow(a) {
      const c = ['ng', 'ok', 'tone'].includes(a.c) ? a.c : 'ng';
      const t = this.center(a.to);
      const ring = `<circle class="ping ping--${c}" cx="${t.x}" cy="${t.y}" r="44"/>`;
      if (!a.from || a.from === a.to) return `<g class="arw arw--${c}">${ring}</g>`;
      const f = this.center(a.from);
      const dx = t.x - f.x, dy = t.y - f.y, len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      const x1 = f.x + ux * 20, y1 = f.y + uy * 20;      // 駒の中心から少し離して引く
      const hx = t.x - ux * 10, hy = t.y - uy * 10;      // 矢じりの先
      const bx = hx - ux * 34, by = hy - uy * 34;        // 矢じりの付け根
      const px = -uy * 19, py = ux * 19;
      const L = Math.max(1, Math.hypot(bx - x1, by - y1));
      const n = (v) => v.toFixed(1);
      return `<g class="arw arw--${c}"><path class="arw__l" d="M${n(x1)} ${n(y1)}L${n(bx)} ${n(by)}" stroke-width="13" opacity=".86" stroke-dasharray="${n(L)}" stroke-dashoffset="${n(L)}"/>`
        + `<polygon class="arw__h" points="${n(hx)},${n(hy)} ${n(bx + px)},${n(by + py)} ${n(bx - px)},${n(by - py)}"/>${ring}</g>`;
    }

    _screen(col, row) {
      return this.flipped ? [this.w - 1 - col, this.h - 1 - row] : [col, row];
    }

    /** マスの中心（SVG の座標）。読み筋の再生で、駒や矢印の位置を決めるのに使う */
    center(key) {
      const pad = this.coords ? 34 : 6;
      const [c, r] = this.L.colRow(key);
      const [sc, sr] = this._screen(c, r);
      return { x: pad + sc * CELL + CELL / 2, y: pad + sr * CELL + CELL / 2 };
    }

    draw() {
      const pad = this.coords ? 34 : 6;
      const W = this.w * CELL + pad * 2;
      const H = this.h * CELL + pad * 2;
      const parts = [];

      const light = this.variant === 'chess' ? '#e8e2d2' : '#e5c98f';
      const dark = this.variant === 'chess' ? '#7f9a86' : '#e5c98f';

      const frame = 5;
      parts.push(`<rect x="${pad - frame}" y="${pad - frame}"
        width="${this.w * CELL + frame * 2}" height="${this.h * CELL + frame * 2}"
        fill="${this.variant === 'chess' ? '#3a4b42' : '#b08a4d'}" rx="3"/>`);

      for (let row = 0; row < this.h; row++) {
        for (let col = 0; col < this.w; col++) {
          const key = this.L.key(col, row);
          const [sc, sr] = this._screen(col, row);
          const x = pad + sc * CELL, y = pad + sr * CELL;
          // a1 が必ず黒マスになるように、盤の大きさではなく座標から色を決める
          const isDark = (col + (this.h - 1 - row)) % 2 === 0;
          const fill = this.variant === 'chess' ? (isDark ? dark : light) : light;
          parts.push(
            `<rect class="sq" data-sq="${key}" x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="${fill}"/>`
          );
          if (this.variant === 'shogi') {
            parts.push(`<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="none" stroke="#6b5326" stroke-width="2" pointer-events="none"/>`);
          }
        }
      }

      // 星（将棋の9×9のみ）
      if (this.variant === 'shogi' && this.w === 9 && this.h === 9) {
        // 星はマスではなく線の交点にある。反転時は交点を w−c / h−r で映す
        for (const [c, r] of [[3, 3], [6, 3], [3, 6], [6, 6]]) {
          const [sc, sr] = this.flipped ? [this.w - c, this.h - r] : [c, r];
          parts.push(`<circle cx="${pad + sc * CELL}" cy="${pad + sr * CELL}" r="5" fill="#6b5326" pointer-events="none"/>`);
        }
      }

      // マーク（下敷き）
      for (const [key, kind] of Object.entries(this.marks)) {
        const cr = this.L.colRow(key);
        if (cr[0] < 0 || cr[0] >= this.w || cr[1] < 0 || cr[1] >= this.h) continue;
        const [sc, sr] = this._screen(cr[0], cr[1]);
        const x = pad + sc * CELL, y = pad + sr * CELL;
        parts.push(this._mark(kind, x, y, !!this.position[key]));
      }

      // 駒
      for (const [key, piece] of Object.entries(this.position)) {
        const cr = this.L.colRow(key);
        if (cr[0] < 0 || cr[0] >= this.w || cr[1] < 0 || cr[1] >= this.h) continue;
        const [sc, sr] = this._screen(cr[0], cr[1]);
        parts.push(`<g data-p="${key}"><g class="pc">${this._piece(piece, pad + sc * CELL, pad + sr * CELL)}</g></g>`);
      }
      // コーチの矢印（駒の上に重ねる。触っても盤の操作のじゃまをしない）
      for (const a of this.arrows || []) parts.push(this._arrow(a));

      // 座標
      if (this.coords) {
        for (let col = 0; col < this.w; col++) {
          const [sc] = this._screen(col, 0);
          const x = pad + sc * CELL + CELL / 2;
          const label = this.L.fileLabel(col);
          const y = this.variant === 'shogi' ? pad - 14 : H - 8;
          parts.push(`<text x="${x}" y="${y}" font-size="27" fill="#4d5862" font-weight="500"
            text-anchor="middle" pointer-events="none">${label}</text>`);
        }
        for (let row = 0; row < this.h; row++) {
          const [, sr] = this._screen(0, row);
          const y = pad + sr * CELL + CELL / 2 + 8;
          const label = this.L.rankLabel(row);
          const x = this.variant === 'shogi' ? W - 15 : 15;
          parts.push(`<text x="${x}" y="${y}" font-size="27" fill="#4d5862" font-weight="500"
            text-anchor="middle" pointer-events="none">${label}</text>`);
        }
      }

      // キーボードのカーソル（盤にフォーカスがあるときだけ）
      if (this.focused && this.cursor) {
        const cr = this.L.colRow(this.cursor);
        if (cr[0] >= 0 && cr[0] < this.w && cr[1] >= 0 && cr[1] < this.h) {
          const [sc, sr] = this._screen(cr[0], cr[1]);
          parts.push(`<rect x="${pad + sc * CELL + 3}" y="${pad + sr * CELL + 3}" width="${CELL - 6}" height="${CELL - 6}"
            fill="none" stroke="#1b5fd1" stroke-width="7" rx="4" pointer-events="none"/>`);
        }
      }

      // クリック面を最前面に置き直す（駒の上でも拾えるように）
      for (let row = 0; row < this.h; row++) {
        for (let col = 0; col < this.w; col++) {
          const key = this.L.key(col, row);
          const [sc, sr] = this._screen(col, row);
          parts.push(`<rect data-sq="${key}" x="${pad + sc * CELL}" y="${pad + sr * CELL}" width="${CELL}" height="${CELL}" fill="transparent" class="sq"/>`);
        }
      }

      // 3×4のような縦長の盤が間延びしないよう、縦横比から最大幅を決める
      const maxRem = Math.min(26, 26 * (W / H));
      this.host.innerHTML =
        `<svg class="board" style="width:min(100%, ${maxRem.toFixed(1)}rem)"
          viewBox="0 0 ${W} ${H}" aria-hidden="true">${parts.join('')}</svg>`;
      this.host.appendChild(this.live);
      this.svg = this.host.querySelector('svg');
    }

    _mark(kind, x, y, occupied) {
      const cx = x + CELL / 2, cy = y + CELL / 2;
      const shapes = document.documentElement.dataset.shapes !== 'off';
      const box = (color, dash = '') =>
        `<rect x="${x + 4}" y="${y + 4}" width="${CELL - 8}" height="${CELL - 8}" fill="none" stroke="${color}" stroke-width="6" ${dash} pointer-events="none" rx="2"/>`;
      switch (kind) {
        case 'sel': return `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="#c2453a" opacity=".3" pointer-events="none"/>` + box('#c2453a');
        case 'move': return occupied
          ? `<circle cx="${cx}" cy="${cy}" r="46" fill="none" stroke="#c2453a" stroke-width="8" opacity=".75" pointer-events="none"/>`
          : `<circle cx="${cx}" cy="${cy}" r="17" fill="#3c4a3f" opacity=".45" pointer-events="none"/>`;
        case 'target': return box('#4a6fa5', 'stroke-dasharray="10 8"');
        case 'hint': return box('#c8964a', 'stroke-dasharray="10 8"');
        // 色だけで伝えない：〇（良い）と ×（悪い）の形も重ねる
        case 'ok': return `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="#4f9e78" opacity=".45" pointer-events="none"/>`
          + (shapes ? `<circle cx="${cx}" cy="${cy}" r="26" fill="none" stroke="#1f4d3a" stroke-width="7" opacity=".85" pointer-events="none"/>` : '');
        case 'ng': return `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="#c2453a" opacity=".45" pointer-events="none"/>`
          + (shapes ? `<path d="M${cx - 22},${cy - 22} L${cx + 22},${cy + 22} M${cx + 22},${cy - 22} L${cx - 22},${cy + 22}"
               stroke="#6e1f18" stroke-width="8" stroke-linecap="round" opacity=".9" pointer-events="none"/>` : '');
        case 'miss': return `<circle cx="${cx}" cy="${cy}" r="20" fill="none" stroke="#4f9e78" stroke-width="9" pointer-events="none"/>`;
        case 'last': return `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="#c8964a" opacity=".3" pointer-events="none"/>`;
        // 行けるが、行くと取られてしまうマス
        case 'unsafe': return occupied
          ? `<circle cx="${cx}" cy="${cy}" r="46" fill="none" stroke="#c2453a" stroke-width="8" opacity=".85" pointer-events="none"/>
             <path d="M${cx - 20},${cy - 20} L${cx + 20},${cy + 20} M${cx + 20},${cy - 20} L${cx - 20},${cy + 20}"
               stroke="#c2453a" stroke-width="9" stroke-linecap="round" pointer-events="none"/>`
          : `<circle cx="${cx}" cy="${cy}" r="21" fill="#c2453a" opacity=".3" pointer-events="none"/>
             <path d="M${cx - 13},${cy - 13} L${cx + 13},${cy + 13} M${cx + 13},${cy - 13} L${cx - 13},${cy + 13}"
               stroke="#c2453a" stroke-width="7" stroke-linecap="round" pointer-events="none"/>`;
        // 相手の駒が利いているマス
        case 'threat': return `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="#c2453a" opacity=".12" pointer-events="none"/>`;
        default: return '';
      }
    }

    _piece(piece, x, y) {
      return this.variant === 'chess' ? this._chessPiece(piece, x, y) : this._shogiPiece(piece, x, y);
    }

    _chessPiece(piece, x, y) {
      const isWhite = piece === piece.toUpperCase();
      const glyph = CHESS_GLYPH[piece.toUpperCase()];
      const fill = isWhite ? '#f7f4ec' : '#20272f';
      const stroke = isWhite ? '#20272f' : '#0c1015';
      return `<text x="${x + CELL / 2}" y="${y + CELL / 2 + 30}" font-size="82" text-anchor="middle"
        font-family="'Segoe UI Symbol','Apple Symbols','Noto Sans Symbols 2',sans-serif"
        fill="${fill}" stroke="${stroke}" stroke-width="2.2" paint-order="stroke"
        pointer-events="none">${glyph}</text>`;
    }

    _shogiPiece(piece, x, y) {
      const promoted = piece.startsWith('+');
      const base = piece.replace('+', '');
      const isSente = base === base.toUpperCase();
      const label = SHOGI_JA[(promoted ? '+' : '') + base.toUpperCase()];
      const cx = x + CELL / 2, cy = y + CELL / 2;
      const rot = isSente ? 0 : 180;
      // 五角形の駒
      const shape = 'M 0,-42 L 27,-28 L 33,42 L -33,42 L -27,-28 Z';
      const two = label.length > 1;
      const text = two
        ? `<text y="-6" font-size="34" text-anchor="middle">${label[0]}</text>
           <text y="30" font-size="34" text-anchor="middle">${label[1]}</text>`
        : `<text y="20" font-size="58" text-anchor="middle">${label}</text>`;
      return `<g transform="translate(${cx},${cy}) rotate(${rot})" pointer-events="none">
        <path d="${shape}" fill="#f4dfab" stroke="#6b5326" stroke-width="3"/>
        <g fill="${promoted ? '#b03030' : '#2b2318'}" font-family="'Zen Old Mincho',serif" font-weight="700">${text}</g>
      </g>`;
    }
  }

  /** 持ち駒の表示。onPick(kind) でその駒を打つモードに入る */
  function renderHand(host, hand, { label = '持ち駒', selected = null, onPick = null, order = [] } = {}) {
    const entries = order.filter((k) => hand?.[k] > 0).map((k) => [k, hand[k]]);
    host.className = 'hand';
    if (!entries.length) {
      host.innerHTML = `<span class="hand__label">${esc(label)}</span><span>なし</span>`;
      return;
    }
    host.innerHTML =
      `<span class="hand__label">${esc(label)}</span>` +
      entries.map(([k, n]) =>
        `<button class="hand__p" data-k="${k}" ${selected === k ? 'data-on' : ''}>${SHOGI_JA[k]}${n > 1 ? `<sup>${n}</sup>` : ''}</button>`
      ).join('');
    if (onPick) {
      host.querySelectorAll('.hand__p').forEach((b) =>
        b.addEventListener('click', () => onPick(b.dataset.k)));
    }
  }

  return { Board, renderHand };
})();

// ── js/core/goboard.js ──────────────────────────────────────
const NS_GOBOARD = (() => {
  const GO = NS_GO;
  // goboard.js — 碁盤を SVG で描く。石は線の交点に置く。入力は1つの委譲クリックで受ける（Board と同じ使い方）。
  // 位置は文字列（'.' 'X' 'O'）、印は { 添字: 種類 }。

  const CELL = 100;
  let uid = 0;
  const STARS = {
    9: [[2, 2], [6, 2], [4, 4], [2, 6], [6, 6]],
    13: [[3, 3], [9, 3], [6, 6], [3, 9], [9, 9]],
    19: [[3, 3], [9, 3], [15, 3], [3, 9], [9, 9], [15, 9], [3, 15], [9, 15], [15, 15]],
    7: [[3, 3]], 5: [[2, 2]],
  };
  const MARK_JA = { last: '直前の手', ok: '正解', ng: '注意', hint: 'ヒント', sel: '選択中', lib: '呼吸点', dead: '死に石',
    terrX: '黒の地', terrO: '白の地', tri: '印', sq: '印', atari: 'アタリ', ghostX: '黒を置く候補', ghostO: '白を置く候補' };

  const { settings } = NS_SETTINGS;
  /** 仮置き（2回タップで決定）を使うか。設定が「じどう」なら、指で操作する端末だけ */
  function confirmOn() {
    const v = settings.get('goConfirm');
    if (v === true || v === false) return v;
    try { return matchMedia('(pointer: coarse)').matches; } catch { return false; }
  }

  class GoBoard {
    /** @param {HTMLElement} host  @param {{n:number, coords?:boolean}} opts */
    constructor(host, opts = {}) {
      this.host = host;
      this.n = opts.n || 9;
      this.coords = opts.coords ?? false;
      this.id = `gb${++uid}`;
      this.s = '.'.repeat(this.n * this.n);
      this.marks = {};
      this.labels = {};
      this.turn = 'X';
      this.dim = null;   // 問題の範囲外の点（薄く塗る）
      this.cursor = null;
      this.focused = false;
      this.host.classList.add('boardwrap');
      this.live = document.createElement('div');
      this.live.className = 'sr';
      this.live.setAttribute('aria-live', 'polite');
      this.host.setAttribute('aria-label', '碁盤。矢印キーで交点を選び、Enterキーで石を置きます');
      this._bind();
    }
    get onPick() { return this._onPick || null; }
    set onPick(fn) {
      this._onPick = fn || null;
      if (this._onPick) { this.host.tabIndex = 0; this.host.setAttribute('role', 'application'); }
      else { this.host.removeAttribute('tabindex'); this.host.removeAttribute('role'); }
      this.svg?.classList.toggle('is-live', !!this._onPick);
    }
    _bind() {
      this.host.addEventListener('click', (e) => {
        const cell = e.target.closest('[data-sq]');
        if (!cell || !this.onPick) return;
        this.cursor = Number(cell.dataset.sq);
        this.onPick(this.cursor);
      });
      this.host.addEventListener('focus', () => {
        if (!this.onPick) return;
        let byKeyboard = false;
        try { byKeyboard = this.host.matches(':focus-visible'); } catch { }
        if (!byKeyboard) return;
        this.focused = true;
        if (this.cursor == null) this.cursor = ((this.n / 2) | 0) * (this.n + 1);
        this.draw(); this._announce();
      });
      this.host.addEventListener('blur', () => { if (!this.focused) return; this.focused = false; this.draw(); });
      this.host.addEventListener('keydown', (e) => {
        if (!this.onPick) return;
        const n = this.n;
        if (!this.focused && (e.key.startsWith('Arrow') || e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          this.focused = true;
          if (this.cursor == null) this.cursor = ((n / 2) | 0) * (n + 1);
          this.draw(); this._announce();
          return;
        }
        if (this.cursor == null) return;
        let x = this.cursor % n, y = (this.cursor / n) | 0;
        const mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
        if (mv) {
          e.preventDefault();
          x = Math.max(0, Math.min(n - 1, x + mv[0]));
          y = Math.max(0, Math.min(n - 1, y + mv[1]));
          this.cursor = y * n + x;
          this.draw(); this._announce();
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.onPick(this.cursor);
          this._announce();
        }
      });
    }
    /**
     * 2回タップで決める。1回目は仮置き（影の石）、同じ点をもう一度で決定。ほかの点なら仮置きを移す。
     * 石のある点のタップ（終局の死に石の指定など）は、そのまま handler に渡す。
     */
    pickTwice(handler, enabled = confirmOn) {
      this.pending = null;
      this.onPick = (i) => {
        if (!enabled() || this.s[i] !== '.') { this.pending = null; return handler(i); }
        if (this.pending === i) { this.pending = null; this.draw(); return handler(i); }
        this.pending = i;
        this.draw();
        this.live.textContent = `${GO.ptName(this.n, i)}に仮置きしました。もう一度タップで決定します`;
      };
    }
    _announce() {
      if (this.cursor == null) return;
      const i = this.cursor, v = this.s[i];
      const what = v === 'X' ? '黒石' : v === 'O' ? '白石' : '空き';
      const m = MARK_JA[this.marks[i]];
      this.live.textContent = `${GO.ptName(this.n, i)}、${what}${this.labels[i] ? `、${this.labels[i]}` : ''}${m ? `、${m}` : ''}`;
    }
    /** s: 盤の文字列、marks: { 添字: 種類 }、extra.labels: { 添字: 'A' }、extra.turn: 置く石の色（なぞったときの影） */
    setPosition(s, marks = {}, extra = {}) {
      this.s = s || '.'.repeat(this.n * this.n);
      if (this.pending != null && this.s[this.pending] !== '.') this.pending = null;
      this.marks = marks || {};
      if (extra.labels) this.labels = extra.labels;
      if (extra.turn) this.turn = extra.turn;
      this.pings = [];   // コーチの波紋は、盤を描き直したら消す
      this.draw();
    }
    setMarks(marks) { this.marks = marks || {}; this.draw(); }
    setLabels(labels) { this.labels = labels || {}; this.draw(); }
    /** コーチの目印：点に波紋を出す。points = [{ i, c: 'ng' | 'ok' | 'tone' }] */
    flash(points) { this.pings = (points || []).filter((q) => q && q.i >= 0 && q.i < this.n * this.n); this.draw(); }
    xy(i) {
      const pad = this.coords ? 78 : 58;
      return [pad + (i % this.n) * CELL, pad + ((i / this.n) | 0) * CELL];
    }
    draw() {
      const n = this.n, pad = this.coords ? 78 : 58;
      const W = (n - 1) * CELL + pad * 2;
      const id = this.id;
      const p = [];
      p.push(`<defs>
        <radialGradient id="${id}b" cx="35%" cy="32%" r="70%"><stop offset="0" stop-color="#6b6f74"/><stop offset=".45" stop-color="#2a2d31"/><stop offset="1" stop-color="#0d0f11"/></radialGradient>
        <radialGradient id="${id}w" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#eeece4"/><stop offset="1" stop-color="#c9c5b8"/></radialGradient>
        <linearGradient id="${id}k" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e3be7c"/><stop offset=".5" stop-color="#d8ad66"/><stop offset="1" stop-color="#cc9f58"/></linearGradient>
      </defs>`);
      p.push(`<rect x="0" y="0" width="${W}" height="${W}" rx="6" fill="url(#${id}k)"/>`);
      // 木目（ごく薄く）
      for (let k = 0; k < 7; k++) {
        const y = (W / 7) * (k + 0.5) + ((k * 37) % 23) - 11;
        p.push(`<path d="M0 ${y} C ${W * 0.3} ${y - 9}, ${W * 0.6} ${y + 11}, ${W} ${y - 3}" stroke="#b9894a" stroke-width="2" opacity=".18" fill="none"/>`);
      }
      // 線
      const a = pad, b = pad + (n - 1) * CELL;
      let d = '';
      for (let k = 0; k < n; k++) { const v = pad + k * CELL; d += `M${a} ${v}H${b}M${v} ${a}V${b}`; }
      p.push(`<path d="${d}" stroke="#2f2416" stroke-width="2.6" fill="none" stroke-linecap="square"/>`);
      p.push(`<rect x="${a}" y="${a}" width="${b - a}" height="${b - a}" fill="none" stroke="#2f2416" stroke-width="4.5"/>`);
      for (const [sx, sy] of STARS[n] || []) p.push(`<circle cx="${pad + sx * CELL}" cy="${pad + sy * CELL}" r="9" fill="#2f2416"/>`);
      if (this.dim) {
        for (const i of this.dim) {
          const [x, y] = this.xy(i);
          p.push(`<rect x="${x - CELL / 2}" y="${y - CELL / 2}" width="${CELL}" height="${CELL}" fill="#f4ecdb" opacity=".5" pointer-events="none"/>`);
        }
      }
      // 座標：上に 1, 2, 3…、右に 一, 二, 三…
      if (this.coords) {
        for (let k = 0; k < n; k++) {
          p.push(`<text x="${pad + k * CELL}" y="${pad - 44}" font-size="30" fill="#5b4526" text-anchor="middle" font-weight="500">${k + 1}</text>`);
          p.push(`<text x="${b + 46}" y="${pad + k * CELL + 11}" font-size="30" fill="#5b4526" text-anchor="middle" font-weight="500" font-family="'Zen Old Mincho',serif">${GO.KANJI[k]}</text>`);
        }
      }
      // 地の印（石の下）
      for (const [k, kind] of Object.entries(this.marks)) {
        if (kind !== 'terrX' && kind !== 'terrO') continue;
        const [x, y] = this.xy(+k);
        if (this.s[k] !== '.') continue;
        p.push(`<rect x="${x - 17}" y="${y - 17}" width="34" height="34" fill="${kind === 'terrX' ? '#1b1e22' : '#f6f4ee'}" stroke="${kind === 'terrX' ? '#000' : '#7a7466'}" stroke-width="2" opacity=".85" pointer-events="none"/>`);
      }
      // 石
      for (let i = 0; i < n * n; i++) {
        const v = this.s[i];
        if (v !== 'X' && v !== 'O') continue;
        const [x, y] = this.xy(i);
        const dead = this.marks[i] === 'dead';
        p.push(`<g pointer-events="none"${dead ? ' opacity=".45"' : ''}>
          <circle cx="${x + 3}" cy="${y + 5}" r="46" fill="#000" opacity=".22"/>
          <circle cx="${x}" cy="${y}" r="46.5" fill="url(#${id}${v === 'X' ? 'b' : 'w'})" ${v === 'O' ? 'stroke="#9d978a" stroke-width="1.5"' : ''}/>
        </g>`);
      }
      // 印（石の上）
      for (const [k, kind] of Object.entries(this.marks)) p.push(this._mark(+k, kind));
      // 文字の印（A, B…）
      for (const [k, label] of Object.entries(this.labels)) {
        const [x, y] = this.xy(+k);
        const v = this.s[k];
        const col = v === 'X' ? '#fff' : '#1d2329';
        if (v === '.') p.push(`<circle cx="${x}" cy="${y}" r="27" fill="#e4c48a" pointer-events="none"/>`);
        p.push(`<text x="${x}" y="${y + 15}" font-size="44" font-weight="700" fill="${col}" text-anchor="middle" pointer-events="none" font-family="'Zen Kaku Gothic New',sans-serif">${label}</text>`);
      }
      // コーチの波紋
      for (const q of this.pings || []) {
        const [qx, qy] = this.xy(q.i);
        const qc = ['ng', 'ok', 'tone'].includes(q.c) ? q.c : 'tone';
        p.push(`<circle class="ping ping--${qc}" cx="${qx}" cy="${qy}" r="40"/>`);
      }
      // 仮置き（2回タップで決定）の影
      if (this.pending != null && this.s[this.pending] === '.') {
        const [x, y] = this.xy(this.pending);
        p.push(`<circle cx="${x}" cy="${y}" r="45" fill="url(#${id}${this.turn === 'O' ? 'w' : 'b'})" opacity=".6" pointer-events="none"/>`
          + `<circle cx="${x}" cy="${y}" r="52" fill="none" stroke="#c2453a" stroke-width="6" stroke-dasharray="12 9" pointer-events="none"/>`);
      }
      // キーボードのカーソル
      if (this.focused && this.cursor != null) {
        const [x, y] = this.xy(this.cursor);
        p.push(`<rect x="${x - 46}" y="${y - 46}" width="92" height="92" rx="10" fill="none" stroke="#1b5fd1" stroke-width="7" pointer-events="none"/>`);
      }
      // クリック面（なぞると、置く石の影が出る）
      const ghost = this.turn === 'O' ? 'w' : 'b';
      for (let i = 0; i < n * n; i++) {
        const [x, y] = this.xy(i);
        const empty = this.s[i] === '.';
        p.push(`<g class="gp" data-sq="${i}"><rect x="${x - CELL / 2}" y="${y - CELL / 2}" width="${CELL}" height="${CELL}" fill="transparent"/>${empty
          ? `<circle class="gp__ghost" cx="${x}" cy="${y}" r="45" fill="url(#${id}${ghost})"/>` : ''}</g>`);
      }
      const maxRem = n >= 13 ? 30 : 26;
      this.host.innerHTML = `<svg class="board goban${this.onPick ? ' is-live' : ''}" style="width:min(100%, ${maxRem}rem)" viewBox="0 0 ${W} ${W}" aria-hidden="true">${p.join('')}</svg>`;
      this.host.appendChild(this.live);
      this.svg = this.host.querySelector('svg');
    }
    _mark(i, kind) {
      const [x, y] = this.xy(i);
      const v = this.s[i];
      const shapes = document.documentElement.dataset.shapes !== 'off';
      const onStone = v === 'X' || v === 'O';
      const ink = v === 'X' ? '#ffffff' : '#c2453a';
      switch (kind) {
        case 'last': return `<circle cx="${x}" cy="${y}" r="17" fill="none" stroke="${v === 'X' ? '#fff' : '#1d2329'}" stroke-width="7" pointer-events="none"/>`;
        case 'ok': return `<circle cx="${x}" cy="${y}" r="${onStone ? 30 : 24}" fill="${onStone ? 'none' : '#4f9e78'}" fill-opacity=".55" stroke="#1f6b4a" stroke-width="8" pointer-events="none"/>`;
        case 'ng': return `<circle cx="${x}" cy="${y}" r="${onStone ? 49 : 30}" fill="${onStone ? 'none' : '#c2453a'}" fill-opacity=".35" stroke="#c2453a" stroke-width="8" pointer-events="none"/>`
          + (shapes ? `<path d="M${x - 17},${y - 17}L${x + 17},${y + 17}M${x + 17},${y - 17}L${x - 17},${y + 17}" stroke="${onStone ? ink : '#6e1f18'}" stroke-width="8" stroke-linecap="round" pointer-events="none"/>` : '');
        case 'hint': return `<circle cx="${x}" cy="${y}" r="40" fill="none" stroke="#c8964a" stroke-width="8" stroke-dasharray="14 10" pointer-events="none"/>`;
        case 'sel': return `<circle cx="${x}" cy="${y}" r="50" fill="none" stroke="#c2453a" stroke-width="7" pointer-events="none"/>`;
        case 'atari': return `<circle cx="${x}" cy="${y}" r="51" fill="none" stroke="#c2453a" stroke-width="9" opacity=".9" pointer-events="none"/>`;
        case 'lib': return `<circle cx="${x}" cy="${y}" r="15" fill="#4a6fa5" stroke="#fff" stroke-width="4" pointer-events="none"/>`;
        case 'dot': return `<circle cx="${x}" cy="${y}" r="13" fill="#c2453a" pointer-events="none"/>`;
        case 'tri': return `<path d="M${x},${y - 26}L${x + 24},${y + 16}L${x - 24},${y + 16}Z" fill="none" stroke="${onStone ? ink : '#c2453a'}" stroke-width="7" stroke-linejoin="round" pointer-events="none"/>`;
        case 'sq': return `<rect x="${x - 19}" y="${y - 19}" width="38" height="38" fill="none" stroke="${onStone ? ink : '#c2453a'}" stroke-width="7" pointer-events="none"/>`;
        case 'dead': return `<path d="M${x - 22},${y - 22}L${x + 22},${y + 22}M${x + 22},${y - 22}L${x - 22},${y + 22}" stroke="#c2453a" stroke-width="9" stroke-linecap="round" pointer-events="none"/>`;
        case 'ghostX': case 'ghostO':
          return `<circle cx="${x}" cy="${y}" r="45" fill="url(#${this.id}${kind === 'ghostX' ? 'b' : 'w'})" opacity=".5" pointer-events="none"/>`;
        default: return '';
      }
    }
  }

  return { GoBoard, confirmOn };
})();

// ── js/core/tiles.js ────────────────────────────────────────
const NS_TILES = (() => {

  // tiles.js — 麻雀牌を SVG で描く。
  // 絵柄を省いて文字だけにすると、萬子・筒子・索子の区別が身につかないので実際に描く。

  const KAN = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const HONOR = ['東', '南', '西', '北', '白', '發', '中'];

  const BLUE = '#1f5b96';
  const GREEN = '#1c7a4c';
  const RED = '#bb392e';
  const INK = '#2b2318';

  // 数ごとの配置（0..1 の正規座標）
  const SPOTS = {
    1: [[.5, .5]],
    2: [[.5, .27], [.5, .73]],
    3: [[.27, .22], [.5, .5], [.73, .78]],
    4: [[.3, .29], [.7, .29], [.3, .71], [.7, .71]],
    5: [[.28, .25], [.72, .25], [.5, .5], [.28, .75], [.72, .75]],
    6: [[.3, .23], [.7, .23], [.3, .5], [.7, .5], [.3, .77], [.7, .77]],
    7: [[.5, .16], [.28, .4], [.72, .4], [.28, .63], [.72, .63], [.28, .86], [.72, .86]],
    8: [[.3, .15], [.7, .15], [.3, .38], [.7, .38], [.3, .62], [.7, .62], [.3, .85], [.7, .85]],
    9: [[.25, .2], [.5, .2], [.75, .2], [.25, .5], [.5, .5], [.75, .5], [.25, .8], [.5, .8], [.75, .8]],
  };
  const SCALE = { 1: 1, 2: 1, 3: .94, 4: .94, 5: .86, 6: .86, 7: .74, 8: .74, 9: .70 };
  // 実物の並びに近づける：7筒は斜め3つ＋下に4つ。3索は上1本・下2本、6索は3本×2段、7索は上1本＋3本×2段、8索は4本×2段。
  // 8筒・9筒・8索・9索は、丸や棒どうしが重なって1本の長い棒に見えないよう、少し小さくして間をあける
  const PIN_SPOTS = { ...SPOTS,
    7: [[.2, .12], [.5, .26], [.8, .4], [.3, .64], [.7, .64], [.3, .88], [.7, .88]],
    9: [[.18, .2], [.5, .2], [.82, .2], [.18, .5], [.5, .5], [.82, .5], [.18, .8], [.5, .8], [.82, .8]] };
  const PIN_SCALE = { ...SCALE, 8: .68, 9: .66 };
  const SOU_SPOTS = { ...SPOTS,
    3: [[.5, .25], [.3, .75], [.7, .75]],
    6: [[.18, .27], [.5, .27], [.82, .27], [.18, .73], [.5, .73], [.82, .73]],
    7: [[.5, .155], [.18, .5], [.5, .5], [.82, .5], [.18, .845], [.5, .845], [.82, .845]],
    8: [[.13, .27], [.377, .27], [.623, .27], [.87, .27], [.13, .73], [.377, .73], [.623, .73], [.87, .73]],
    9: [[.18, .2], [.5, .2], [.82, .2], [.18, .5], [.5, .5], [.82, .5], [.18, .8], [.5, .8], [.82, .8]] };
  const SOU_SCALE = { ...SCALE, 7: .68, 8: .62, 9: .54 };

  const X = (u) => 8 + u * 44;   // 描画領域 x: 8..52
  const Y = (v) => 10 + v * 62;  // 描画領域 y: 10..72

  function pinzu(n, aka = false) {
    const r = 10 * PIN_SCALE[n];
    return PIN_SPOTS[n].map(([u, v], i) => {
      const red = aka || (n === 5 && i === 2) || (n === 1);
      const cx = X(u), cy = Y(v);
      if (n === 1) {
        return `<circle cx="${cx}" cy="${cy}" r="18" fill="none" stroke="${BLUE}" stroke-width="4"/>
                <circle cx="${cx}" cy="${cy}" r="10" fill="none" stroke="${RED}" stroke-width="4"/>
                <circle cx="${cx}" cy="${cy}" r="3.5" fill="${BLUE}"/>`;
      }
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${red ? RED : BLUE}"/>
              <circle cx="${cx}" cy="${cy}" r="${r * .42}" fill="#fffdf6"/>`;
    }).join('');
  }

  function souzu(n, aka = false) {
    if (n === 1) {
      // 一索は鳥。簡略化した形で「特別な牌」であることが伝わればよい
      return `<g>
        <ellipse cx="30" cy="46" rx="11" ry="16" fill="${GREEN}"/>
        <circle cx="30" cy="26" r="8" fill="${GREEN}"/>
        <circle cx="33" cy="24" r="2" fill="#fffdf6"/>
        <path d="M38 25 L46 28 L38 30 Z" fill="${RED}"/>
        <path d="M30 62 L22 74 M30 62 L38 74" stroke="${RED}" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M20 44 q10 -8 20 0" stroke="#fffdf6" stroke-width="2.5" fill="none"/>
      </g>`;
    }
    const hh = 14 * SOU_SCALE[n], w = 4.8 * SOU_SCALE[n];
    return SOU_SPOTS[n].map(([u, v], i) => {
      const red = aka || (n === 5 && i === 2) || (n === 7 && i === 0);
      const c = red ? RED : GREEN;
      const cx = X(u), cy = Y(v);
      return `<rect x="${cx - w}" y="${cy - hh}" width="${w * 2}" height="${hh * 2}" rx="${w}" fill="${c}"/>
              <rect x="${cx - w * 1.6}" y="${cy - hh * .28}" width="${w * 3.2}" height="${hh * .22}" rx="1" fill="${c}"/>`;
    }).join('');
  }

  function manzu(n, aka = false) {
    return `<text x="30" y="36" font-size="30" text-anchor="middle" fill="${aka ? RED : INK}"
              font-family="'Zen Old Mincho',serif" font-weight="700">${KAN[n - 1]}</text>
            <text x="30" y="70" font-size="26" text-anchor="middle" fill="${RED}"
              font-family="'Zen Old Mincho',serif" font-weight="700">萬</text>`;
  }

  function honor(n) {
    if (n === 5) { // 白
      return `<rect x="13" y="16" width="34" height="50" rx="2" fill="none" stroke="${BLUE}" stroke-width="3"/>`;
    }
    const ch = HONOR[n - 1];
    const color = n === 6 ? GREEN : n === 7 ? RED : INK;
    return `<text x="30" y="56" font-size="40" text-anchor="middle" fill="${color}"
              font-family="'Zen Old Mincho',serif" font-weight="700">${ch}</text>`;
  }

  /** 牌1枚の中身（viewBox 0 0 60 82） */
  function tileFace(tile) {
    const s = tile[0], aka = tile[1] === '0', n = aka ? 5 : Number(tile[1]);
    const body = s === 'm' ? manzu(n, aka) : s === 'p' ? pinzu(n, aka) : s === 's' ? souzu(n, aka) : honor(n);
    return `<svg viewBox="0 0 60 82" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;
  }

  function tileLabel(tile) {
    const s = tile[0], aka = tile[1] === '0', n = aka ? 5 : Number(tile[1]);
    if (s === 'z') return HONOR[n - 1];
    return `${aka ? '赤' : ''}${n}${{ m: '萬', p: '筒', s: '索' }[s]}`;
  }

  /**
   * 牌の列を描く
   * @param {HTMLElement} host
   * @param {string[]} tiles
   * @param {{states?:Object, onPick?:Function, disabled?:boolean, tight?:boolean, backs?:number}} o
   */
  function renderTiles(host, tiles, o = {}) {
    host.className = 'tiles' + (o.tight ? ' tiles--tight' : '');
    const html = tiles.map((t, i) => {
      const st = o.states?.[i];
      return `<button class="tile" data-i="${i}" data-t="${t}" ${st ? `data-s="${st}"` : ''}
        ${o.disabled ? 'disabled' : ''} aria-label="${tileLabel(t)}">${tileFace(t)}</button>`;
    });
    for (let i = 0; i < (o.backs || 0); i++) html.push(`<span class="tile tile--back"></span>`);
    host.innerHTML = html.join('');
    if (o.onPick) {
      host.querySelectorAll('.tile[data-i]').forEach((b) =>
        b.addEventListener('click', () => o.onPick(Number(b.dataset.i), b.dataset.t)));
    }
  }

  /** 面子（3枚組）をまとめて表示する */
  function renderMelds(host, melds) {
    host.className = 'meldbox';
    host.innerHTML = melds.length
      ? melds.map((m) => `<span class="meld">${m.map((t) =>
          `<span class="tile">${tileFace(t)}</span>`).join('')}</span>`).join('')
      : '<span class="note">ここに組を作ります</span>';
  }

  return { tileFace, tileLabel, renderTiles, renderMelds };
})();

// ── js/core/firebase-config.js ──────────────────────────────
const NS_FBCONF = (() => {

  // firebase-config.js
  // ここに自分の Firebase プロジェクトの値を入れると、端末間の自動同期が有効になります。
  // 空のままでも、アプリはこの端末だけの保存（localStorage）で完全に動きます。
  //
  // 値の取り方は README.md の「Firebaseを繋ぐ」を見てください。
  // この値はブラウザに露出しますが、それは Firebase の設計上そういうものです。
  // 安全性は Firestore のセキュリティルールで担保します（README に設定文あり）。

  const firebaseConfig = null;

  /* 例：
  const firebaseConfig = {
    apiKey: "AIza....",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:abcdef",
  };
  */

  return { firebaseConfig };
})();

// ── js/core/firebase-sync.js ────────────────────────────────
const NS_FBSYNC = (() => {

  // firebase-sync.js — 差し替え可能なクラウド保存アダプタ。
  // firebase-config.js が null のときは何もしない（アプリは端末保存のまま完全に動く）。

  const V = '10.12.2';
  const CDN = `https://www.gstatic.com/firebasejs/${V}`;

  class FirebaseSync {
    constructor(config) {
      this.config = config;
      this.status = config ? 'loading' : 'off';
      this.user = null;
      this.listeners = new Set();
      this._unsub = null;
      this._fb = null;
      this._writeTimer = null;
      this._lastPushed = null;
    }

    on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
    _emit(kind, payload) { for (const fn of this.listeners) fn(kind, payload); }
    _setStatus(s) { this.status = s; this._emit('status', s); }

    async init() {
      if (!this.config) return;
      try {
        const [app, auth, fs] = await Promise.all([
          import(`${CDN}/firebase-app.js`),
          import(`${CDN}/firebase-auth.js`),
          import(`${CDN}/firebase-firestore.js`),
        ]);
        this._fb = { app, auth, fs };
        const a = app.initializeApp(this.config);
        this.auth = auth.getAuth(a);
        this.db = fs.getFirestore(a);
        await auth.getRedirectResult(this.auth).catch(() => {});
        auth.onAuthStateChanged(this.auth, (u) => {
          this.user = u;
          if (u) { this._setStatus('on'); this._watch(); }
          else { this._stopWatch(); this._setStatus('ready'); }
        });
        if (this.status === 'loading') this._setStatus('ready');
      } catch (e) {
        console.warn('Firebase の読み込みに失敗しました', e);
        this._setStatus('error');
      }
    }

    async signIn() {
      if (!this.auth) return;
      const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = this._fb.auth;
      const provider = new GoogleAuthProvider();
      try {
        await signInWithPopup(this.auth, provider);
      } catch (e) {
        const code = String(e?.code || '');
        // 自分でポップアップを閉じた・もう一度押した：やめたと受け取り、何もしない（勝手に画面を切り替えない）
        if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
        // ポップアップが塞がれる環境（スマホの一部）ではリダイレクトに切り替える
        if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') await signInWithRedirect(this.auth, provider);
        else throw e;
      }
    }

    async signOut() {
      if (this.auth) await this._fb.auth.signOut(this.auth);
    }

    _ref() {
      const { doc } = this._fb.fs;
      return doc(this.db, 'players', this.user.uid);
    }

    _watch() {
      this._stopWatch();
      const { onSnapshot } = this._fb.fs;
      this._unsub = onSnapshot(this._ref(), (snap) => {
        const json = FirebaseSync.jsonOf(snap.data());
        if (!json) return;
        // 自分が今書いたものが返ってきただけなら無視する
        if (json === this._lastPushed) return;
        try { this._emit('remote', JSON.parse(json)); } catch { /* 壊れたデータは無視 */ }
      }, (e) => {
        console.warn('同期の購読に失敗しました', e);
        this._setStatus('error');
      });
    }
    _stopWatch() { if (this._unsub) { this._unsub(); this._unsub = null; } }

    /**
     * 保存する形：状態は JSON 文字列 1つ（stateJson）。
     * Firestore は undefined や「配列の中の配列」を受け付けず、書き込みが黙って失敗するため。
     * 古い版が書いた { state: {...} } も読める。
     */
    static jsonOf(data) {
      if (!data) return null;
      if (typeof data.stateJson === 'string') return data.stateJson;
      if (data.state) return JSON.stringify(data.state);
      return null;
    }
    _current(state) { return this.getState ? this.getState() : state; }
    _write() {
      const { setDoc } = this._fb.fs;
      const json = JSON.stringify(this._current(this._queued));
      this._queued = null;
      this._lastPushed = json;
      return setDoc(this._ref(), { stateJson: json, updatedAt: Date.now() });
    }

    /** 書き込みはまとめて。連続更新でも1秒に1回に抑える。送るのは送る瞬間の最新の状態 */
    push(state) {
      if (this.status !== 'on' || !this.user) return;
      this._queued = state;
      // すでに送る予定があるときは、タイマーを延ばさない（操作が続いても、約1秒ごとに送る）
      if (this._writeTimer) return;
      this._writeTimer = setTimeout(async () => {
        this._writeTimer = null;
        try { await this._write(); } catch (e) { console.warn('同期の書き込みに失敗しました', e); }
      }, 900);
    }

    /** 待っている書き込みをすぐ送る（タブを閉じる・アプリを切り替えるとき用） */
    flush(state) {
      if (!this._writeTimer || this.status !== 'on' || !this.user) return;
      clearTimeout(this._writeTimer);
      this._writeTimer = null;
      if (!this._queued) this._queued = state;
      try { this._write().catch(() => {}); } catch { /* 送れなければ次回の起動時に突き合わせる */ }
    }

    async pull() {
      if (this.status !== 'on' || !this.user) return null;
      const { getDoc } = this._fb.fs;
      const snap = await getDoc(this._ref());
      const json = snap.exists() ? FirebaseSync.jsonOf(snap.data()) : null;
      try { return json ? JSON.parse(json) : null; } catch { return null; }
    }
  }

  return { FirebaseSync };
})();

// ── js/core/store.js ────────────────────────────────────────
const NS_STORE = (() => {
  const { FirebaseSync } = NS_FBSYNC;
  const { firebaseConfig } = NS_FBCONF;
  // store.js — 進捗の唯一の入口。
  // 端末保存(localStorage)を土台に、Firebase があれば上に重ねる。
  // 競合は「レッスン単位で新しい方を採用」する。丸ごと上書きしないので、
  // PC で1章、スマホで2章を進めても、どちらも消えない。



  const KEY = 'bangi.progress.v1';
  // 復習の間隔（日）。正解するたびに次の箱へ進み、最後まで行けば卒業。間違えたら最初の箱に戻る
  const INTERVALS = [1, 3, 7, 21, 45];
  const dueAfter = (box) => Date.now() + INTERVALS[Math.min(box, INTERVALS.length - 1)] * 864e5;
  const GAMES_KEPT = 30;      // 弱点の集計に使う対局数の上限
  const MISTAKES_KEPT = 60;   // 1ゲームあたりに残す「自分の悪手」問題の上限
  const today = () => new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD

  const emptyState = () => ({
    v: 1,
    lessons: {},                 // id -> { done, correct, total, at }
    streak: { last: null, count: 0, best: 0 },
    reviews: {},                 // "lessonId#step" -> { box, due, miss, at } / 卒業したら { cleared: true, at }
    mistakes: {},                // 対局中の悪手から作った問題：id -> { game, kind, step, from, box, due, miss, at } / 卒業したら { cleared: true, at }
    games: {},                   // 対局ごとの講評の集計：game -> [{ at, kinds: { hang: 2, ... } }]（新しい30局まで）
    record: {},                  // 対局成績：game -> { rating, w, l, d, level, run }（run は連勝・連敗）
    trend: {},                   // 上達の記録：game -> { r: [[時刻, 持ち点], ...]（新しい60局）, d: { 'YYYY-MM-DD': [一発正解, 間違い] }（新しい90日） }
    // 麻雀（4人打ち）の成績：k 局数、a 和了（t うちツモ、ap 打点の合計）、h 放銃（hp 失点の合計）、r 立直した局、f 副露した局、rk 半荘の着順の回数
    mj: { k: 0, a: 0, t: 0, ap: 0, h: 0, hp: 0, r: 0, f: 0, rk: [0, 0, 0, 0], at: 0 },
    resetAt: 0,                  // 「進捗をすべて消す」をした時刻。これより古い記録は他の端末から来ても捨てる
    updatedAt: 0,
  });

  // ── 読み込んだデータの無害化 ──────────────────────────────
  // 引き継ぎコードや同期で届いた進捗は、画面に innerHTML で出る部分がある（悪手の問題文など）。
  // アプリ自身が使う飾りのタグ（属性なし、span は class だけ）以外はすべて文字として扱う。
  const SAFE_TAGS = new Set(['b', 'strong', 'em', 'i', 'small', 'br', 'span', 'code']);
  const escHtml = (t) => t.replace(/&(?![a-zA-Z#0-9]+;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function cleanHtml(str) {
    if (typeof str !== 'string') return str;
    let out = '', last = 0;
    const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^<>]*)>/g;
    let m;
    while ((m = re.exec(str))) {
      out += escHtml(str.slice(last, m.index));
      const [, close, tagRaw, attrs] = m;
      const tag = tagRaw.toLowerCase();
      if (SAFE_TAGS.has(tag)) {
        const cls = !close && tag === 'span' && /^\s*class="[\w\s-]*"\s*\/?\s*$/.test(attrs) ? attrs.match(/class="[\w\s-]*"/)[0] : '';
        out += `<${close}${tag}${cls ? ` ${cls}` : ''}>`;
      } else out += escHtml(m[0]);
      last = re.lastIndex;
    }
    return out + escHtml(str.slice(last));
  }
  // __proto__ などは、ふつうの代入で使うとオブジェクトの元（プロトタイプ）を書き換えてしまうので受け付けない
  const SAFE_KEY = /^(?!(?:__proto__|constructor|prototype)$)[\w#.+:-]{1,200}$/;
  const own = (o, k) => (o && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined);
  function cleanDeep(v, depth = 0) {
    if (depth > 12) return null;
    if (typeof v === 'string') return cleanHtml(v);
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    if (v === null || typeof v === 'boolean') return v;
    if (Array.isArray(v)) return v.slice(0, 500).map((x) => cleanDeep(x, depth + 1));
    if (typeof v === 'object') {
      const o = {};
      for (const [k, x] of Object.entries(v)) {
        if (!SAFE_KEY.test(k) || k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
        if (x === undefined) continue;
        o[k] = cleanDeep(x, depth + 1);
      }
      return o;
    }
    return null;
  }
  const num = (x, d = 0) => (typeof x === 'number' && Number.isFinite(x) ? x : Number.isFinite(Number(x)) && x !== '' && x != null ? Number(x) : d);
  const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
  const cleanMap = (m, fn) => {
    const o = {};
    for (const [k, v] of Object.entries(obj(m))) if (SAFE_KEY.test(k) && v && typeof v === 'object') o[k] = fn(v);
    return o;
  };
  const LEVELS = ['easy', 'normal', 'hard'];
  const LEVEL_UP = { easy: 'normal', normal: 'hard', hard: 'hard' };
  const LEVEL_DOWN = { hard: 'normal', normal: 'easy', easy: 'easy' };
  /** 持ち点の計算で、相手の強さをどのくらいの持ち点とみなすか（目安） */
  const AI_RATING = { easy: 700, normal: 1000, hard: 1300 };
  const RATING_K = 32;
  const emptyRecord = () => ({ rating: 1000, w: 0, l: 0, d: 0, rn: 0, level: 'normal', run: 0, lv: {} });

  /** 欠けた項目を補い、型をそろえる（古い形式や壊れたデータ、細工されたデータを読んでも落ちないように） */
  const normalize = (s) => {
    const e = emptyState();
    if (!s || typeof s !== 'object') return e;
    const st = obj(s.streak);
    return {
      ...e,
      v: 1,
      resetAt: num(s.resetAt),
      updatedAt: num(s.updatedAt),
      lessons: cleanMap(s.lessons, (r) => ({
        done: !!r.done, correct: num(r.correct), total: num(r.total), at: num(r.at),
        ...(typeof r.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.day) ? { day: r.day } : {}),
      })),
      reviews: cleanMap(s.reviews, (r) => (r.cleared ? { cleared: true, at: num(r.at) }
        : { box: num(r.box), miss: num(r.miss), due: num(r.due), at: num(r.at) })),
      mistakes: cleanMap(s.mistakes, (m) => (m.cleared ? { cleared: true, at: num(m.at) } : {
        game: typeof m.game === 'string' ? cleanHtml(m.game) : '', kind: typeof m.kind === 'string' ? cleanHtml(m.kind) : '',
        step: cleanDeep(obj(m.step)), from: typeof m.from === 'string' ? cleanHtml(m.from) : '',
        box: num(m.box), miss: num(m.miss), due: num(m.due), at: num(m.at),
      })),
      games: Object.fromEntries(Object.entries(obj(s.games)).filter(([g, list]) => SAFE_KEY.test(g) && Array.isArray(list))
        .map(([g, list]) => [g, list.filter((r) => r && typeof r === 'object').map((r) => ({
          at: num(r.at),
          kinds: Object.fromEntries(Object.entries(obj(r.kinds)).filter(([k]) => SAFE_KEY.test(k)).map(([k, v]) => [k, num(v)])),
        }))])),
      record: cleanMap(s.record, (r) => ({
        rating: num(r.rating, 1000), w: num(r.w), l: num(r.l), d: num(r.d),
        // 持ち点に数えた対局の数。古い形式は、すべての対局を持ち点に数えていた
        rn: r.rn != null ? num(r.rn) : num(r.w) + num(r.l) + num(r.d),
        level: LEVELS.includes(r.level) ? r.level : 'normal', run: num(r.run),
        // 盤の種類ごとの「じどう」の強さと成績
        lv: cleanMap(r.lv, (v) => ({
          level: LEVELS.includes(v.level) ? v.level : 'normal', run: num(v.run),
          w: num(v.w), l: num(v.l), d: num(v.d), at: num(v.at),
        })),
        ...(r.pt != null ? { pt: num(r.pt), ph: num(r.ph) } : {}), at: num(r.at),
      })),
      trend: Object.fromEntries(Object.entries(obj(s.trend)).filter(([g]) => SAFE_KEY.test(g)).map(([g, t]) => {
        const o = obj(t);
        const r = (Array.isArray(o.r) ? o.r : []).filter((x) => Array.isArray(x) && x.length === 2)
          .map(([a, v]) => [num(a), num(v, 1000)]).slice(-60);
        const d = Object.fromEntries(Object.entries(obj(o.d))
          .filter(([k, v]) => /^\d{4}-\d{2}-\d{2}$/.test(k) && Array.isArray(v)).map(([k, v]) => [k, [num(v[0]), num(v[1])]])
          .sort((x, y) => (x[0] < y[0] ? -1 : 1)).slice(-90));
        return [g, { r, d }];
      })),
      streak: {
        last: typeof st.last === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(st.last) ? st.last : null,
        count: num(st.count), best: num(st.best),
      },
      mj: (() => {
        const m = obj(s.mj), rk = Array.isArray(m.rk) ? m.rk : [];
        const n0 = (x) => Math.max(0, num(x));
        return { k: n0(m.k), a: n0(m.a), t: n0(m.t), ap: n0(m.ap), h: n0(m.h), hp: n0(m.hp), r: n0(m.r), f: n0(m.f),
          rk: [0, 1, 2, 3].map((i) => n0(rk[i])), at: num(m.at) };
      })(),
    };
  };
  /** 消したことの記録（cleared）は、十分古くなったら捨てる。いつまでも残すとデータが膨らみ続ける */
  const TOMBSTONE_DAYS = 120;
  function pruneTombstones(st) {
    const limit = Date.now() - TOMBSTONE_DAYS * 864e5;
    for (const col of ['reviews', 'mistakes']) {
      for (const [k, r] of Object.entries(st[col])) if (r && r.cleared && (r.at || 0) < limit) delete st[col][k];
    }
  }

  /**
   * 2つの状態を合わせる。項目ごとに新しい方を採用する。
   * 削除は「消した」という記録（cleared / resetAt）で伝える。単純な和集合だと、消したものが別の端末から戻ってくる。
   */
  function mergeStates(a, b) {
    const A = normalize(a), B = normalize(b);
    const out = emptyState();
    out.resetAt = Math.max(A.resetAt || 0, B.resetAt || 0);
    const alive = (rec) => rec && (rec.at || 0) >= out.resetAt;
    for (const id of new Set([...Object.keys(A.lessons), ...Object.keys(B.lessons)])) {
      const x = alive(A.lessons[id]) ? A.lessons[id] : null;
      const y = alive(B.lessons[id]) ? B.lessons[id] : null;
      const pick = !x ? y : !y ? x : (y.at || 0) > (x.at || 0) ? y : x;
      if (pick) out.lessons[id] = pick;
    }
    for (const id of new Set([...Object.keys(A.reviews), ...Object.keys(B.reviews)])) {
      const x = alive(A.reviews[id]) ? A.reviews[id] : null;
      const y = alive(B.reviews[id]) ? B.reviews[id] : null;
      const pick = !x ? y : !y ? x : (y.at || 0) > (x.at || 0) ? y : x;
      if (pick) out.reviews[id] = pick;
    }
    for (const id of new Set([...Object.keys(A.mistakes), ...Object.keys(B.mistakes)])) {
      const x = alive(A.mistakes[id]) ? A.mistakes[id] : null;
      const y = alive(B.mistakes[id]) ? B.mistakes[id] : null;
      const pick = !x ? y : !y ? x : (y.at || 0) > (x.at || 0) ? y : x;
      if (pick) out.mistakes[id] = pick;
    }
    // 対局の記録は両方を合わせる（同じ時刻の記録は1つ）
    for (const g of new Set([...Object.keys(A.games), ...Object.keys(B.games)])) {
      const seen = new Set();
      out.games[g] = [...(A.games[g] || []), ...(B.games[g] || [])]
        .filter((r) => r && (r.at || 0) >= out.resetAt && !seen.has(r.at) && seen.add(r.at))
        .sort((a, b) => a.at - b.at).slice(-GAMES_KEPT);
    }
    // 対局成績は、対局数が多い方を採る（同じなら新しい方）。リセットより前の成績は捨てる。
    // 応手の予想（pt/ph）は対局の勝敗と別に数えているので、予想した回数が多い方を残す
    for (const g of new Set([...Object.keys(A.record), ...Object.keys(B.record)])) {
      const x = alive(A.record[g]) ? A.record[g] : null, y = alive(B.record[g]) ? B.record[g] : null;
      if (!x && !y) continue;
      const n = (r) => (r ? (r.w || 0) + (r.l || 0) + (r.d || 0) : -1);
      const base = !x ? y : !y ? x : n(y) > n(x) || (n(y) === n(x) && (y.at || 0) > (x.at || 0)) ? y : x;
      const pr = !x ? y : !y ? x : (y.pt || 0) > (x.pt || 0) || ((y.pt || 0) === (x.pt || 0) && (y.ph || 0) > (x.ph || 0)) ? y : x;
      const r = { ...base };
      if (pr && pr.pt != null) { r.pt = pr.pt; r.ph = pr.ph || 0; }
      // 盤の種類ごとの強さと成績も、盤ごとに対局数の多い方（同じなら新しい方）を採る
      const lv = {};
      for (const v of new Set([...Object.keys(x?.lv || {}), ...Object.keys(y?.lv || {})])) {
        const p = alive(x?.lv?.[v]) ? x.lv[v] : null, q = alive(y?.lv?.[v]) ? y.lv[v] : null;
        const pick = !p ? q : !q ? p : n(q) > n(p) || (n(q) === n(p) && (q.at || 0) > (p.at || 0)) ? q : p;
        if (pick) lv[v] = { ...pick };
      }
      r.lv = lv;
      out.record[g] = r;
    }
    // 上達の記録：持ち点は時刻でまとめ、1日の数は多い方を取る（同じ記録が二重に数えられないように）
    const resetDay = out.resetAt ? new Date(out.resetAt).toLocaleDateString('sv-SE') : '';
    for (const g of new Set([...Object.keys(A.trend || {}), ...Object.keys(B.trend || {})])) {
      const x = (A.trend || {})[g] || { r: [], d: {} }, y = (B.trend || {})[g] || { r: [], d: {} };
      const seen = new Set();
      const r = [...x.r, ...y.r].filter(([at]) => at >= out.resetAt && !seen.has(at) && seen.add(at)).sort((p, q) => p[0] - q[0]).slice(-60);
      const d = {};
      for (const k of new Set([...Object.keys(x.d), ...Object.keys(y.d)])) {
        if (resetDay && k < resetDay) continue;
        const p = x.d[k] || [0, 0], q = y.d[k] || [0, 0];
        d[k] = [Math.max(p[0], q[0]), Math.max(p[1], q[1])];
      }
      out.trend[g] = { r, d };
    }
    // 麻雀（4人打ち）の成績：数えた局と半荘の多い方を採る（同じなら新しい方）。
    // 2台で別々に打った分は、どの局を数えたか分からないので足し合わせない（対局成績と同じ考え方）
    {
      const size = (m) => ((m.at || 0) >= out.resetAt ? m.k + m.rk.reduce((x, y) => x + y, 0) : -1);
      const ka = size(A.mj), kb = size(B.mj);
      const pick = kb > ka || (kb === ka && ((B.mj.at || 0) > (A.mj.at || 0)
        || ((B.mj.at || 0) === (A.mj.at || 0) && JSON.stringify(B.mj) > JSON.stringify(A.mj)))) ? B.mj : A.mj;
      out.mj = size(pick) >= 0 ? { ...pick, rk: [...pick.rk] } : emptyState().mj;
    }
    const sa = (A.updatedAt || 0) >= out.resetAt ? A.streak : emptyState().streak;
    const sb = (B.updatedAt || 0) >= out.resetAt ? B.streak : emptyState().streak;
    // 最後に学んだ日が新しい方を採る。同じ日なら、続いた日数の長い方（どちらの端末で開いても同じ結果になるように）
    out.streak = (sb.last || '') > (sa.last || '') ? { ...sb } : (sa.last || '') > (sb.last || '') ? { ...sa }
      : { ...sa, count: Math.max(sa.count || 0, sb.count || 0) };
    out.streak.best = Math.max(sa.best || 0, sb.best || 0);
    out.updatedAt = Math.max(A.updatedAt || 0, B.updatedAt || 0);
    return out;
  }

  class Store {
    constructor() {
      this.state = emptyState();
      this.subs = new Set();
      this.sync = new FirebaseSync(firebaseConfig);
      // 書き込みの直前に「その時点の最新の状態」を読む。予約した時点の古い状態で上書きしないため
      this.sync.getState = () => this.state;
    }

    async init() {
      this.state = this._readLocal();
      this.sync.on((kind, payload) => {
        if (kind === 'remote') {
          this.state = mergeStates(this.state, payload);
          this._writeLocal();
          this._emit();
        } else {
          this._emit();
        }
      });
      // タブを閉じる・裏に回すときは、待たせている書き込みをすぐ送る
      const flush = () => this.sync.flush(this.state);
      window.addEventListener('pagehide', flush);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
      await this.sync.init();
      // ログイン済みなら、購読が走る前に一度だけ突き合わせておく
      if (this.sync.status === 'on') {
        const remote = await this.sync.pull();
        if (remote) { this.state = mergeStates(this.state, remote); this._writeLocal(); }
        this.sync.push(this.state);
      }
      this._emit();
      return this.state;
    }

    subscribe(fn) { this.subs.add(fn); return () => this.subs.delete(fn); }
    _emit() { for (const fn of this.subs) fn(this.state, this.syncStatus()); }
    syncStatus() { return this.sync.status; }

    _readLocal() {
      let raw = null;
      try {
        raw = localStorage.getItem(KEY);
        if (!raw) return emptyState();
        const st = mergeStates(emptyState(), JSON.parse(raw));
        pruneTombstones(st);
        return st;
      } catch {
        // 壊れたデータは上書きする前に退避しておく（手で直せる可能性を残す）
        try { if (raw) localStorage.setItem(`${KEY}.broken.${Date.now()}`, raw); } catch { }
        return emptyState();
      }
    }
    _writeLocal() {
      try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch (e) {
        // 容量超過・保存が禁止された設定など。黙っていると進捗が残っていないことに気づけないので、一度だけ知らせる
        if (!this._saveWarned) { this._saveWarned = true; try { this.onSaveError?.(e); } catch { } }
      }
    }

    update(fn) {
      const next = structuredClone(this.state);
      fn(next);
      pruneTombstones(next);
      next.updatedAt = Date.now();
      this.state = next;
      this._writeLocal();
      this.sync.push(next);
      this._emit();
      return next;
    }

    // --- レッスンの記録 -----------------------------------------------------
    recordLesson(id, { correct, total }) {
      return this.update((s) => {
        const prev = s.lessons[id] || { correct: 0, total: 0 };
        s.lessons[id] = {
          done: true,
          correct: Math.max(prev.correct || 0, correct),
          total,
          at: Date.now(),
          day: today(),
        };
        this._touchStreak(s);
      });
    }
    recordMiss(lessonId, stepKey) {
      return this.update((s) => {
        const k = `${lessonId}#${stepKey}`;
        const prev = s.reviews[k] && !s.reviews[k].cleared ? s.reviews[k] : { miss: 0 };
        // 間違えたら最初の箱に戻す（翌日にもう一度）
        s.reviews[k] = { box: 0, miss: (prev.miss || 0) + 1, due: dueAfter(0), at: Date.now() };
      });
    }
    /**
     * 解き直せたときに呼ぶ。次の箱へ進めて間隔を伸ばし（1日→3日→1週間→3週間→1か月半）、
     * 最後まで行けたら卒業させる。
     */
    clearReview(lessonId, stepKey) {
      const k = `${lessonId}#${stepKey}`;
      const r = this.state.reviews[k];
      if (!r || r.cleared) return this.state;
      const box = (r.box || 0) + 1;
      return this.update((s) => {
        s.reviews[k] = box >= INTERVALS.length
          ? { cleared: true, at: Date.now() }
          : { ...r, box, due: dueAfter(box), at: Date.now() };
      });
    }
    /** まだ解き直していない問題（期限が来ていないものも含む） */
    pendingReviews(prefix = '') {
      return Object.entries(this.state.reviews)
        .filter(([k, r]) => r && !r.cleared && k.startsWith(prefix))
        .map(([k, r]) => ({ key: k, lessonId: k.split('#')[0], stepKey: k.split('#').slice(1).join('#'), ...r }));
    }
    _touchStreak(s) {
      const d = today();
      if (s.streak.last === d) return;
      const yd = new Date(); yd.setDate(yd.getDate() - 1);   // 24時間前ではなく暦の前日（夏時間の切り替え日でもずれない）
      const y = yd.toLocaleDateString('sv-SE');
      s.streak.count = s.streak.last === y ? (s.streak.count || 0) + 1 : 1;
      s.streak.last = d;
      s.streak.best = Math.max(s.streak.best || 0, s.streak.count);
    }

    // --- 対局の記録（弱点の集計と、自分の悪手から作る問題） -------------------
    /** 1局ぶんの講評の種類を記録する。kinds = { hang: 2, missed: 1 } */
    recordGame(game, kinds) {
      return this.update((s) => {
        const list = s.games[game] || [];
        list.push({ at: Date.now(), kinds: { ...kinds } });
        s.games[game] = list.slice(-GAMES_KEPT);
      });
    }
    /** 最近 n 局の集計。{ games, total: { kind: 回数 } } */
    weakness(game, n = 10) {
      const list = (this.state.games[game] || []).slice(-n);
      const total = {};
      for (const r of list) for (const [k, v] of Object.entries(r.kinds || {})) total[k] = (total[k] || 0) + v;
      return { games: list.length, total };
    }
    /** 悪手の局面を問題として保存する。step は LessonRunner でそのまま解ける形 */
    addMistake(game, kind, step, from = '') {
      const id = `${game}.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      return this.update((s) => {
        s.mistakes[id] = { game, kind, step, from, box: 0, miss: 0, due: Date.now(), at: Date.now() };
        // 多すぎる分は、解き終えたもの → 古いもの の順に捨てる
        const live = Object.entries(s.mistakes).filter(([, m]) => m && !m.cleared && m.game === game)
          .sort((a, b) => a[1].at - b[1].at);
        while (live.length > MISTAKES_KEPT) { const [old] = live.shift(); s.mistakes[old] = { cleared: true, at: Date.now() }; }
      });
    }
    /** 解けたら消す（一発正解のとき）。間違えたら翌日にもう一度 */
    markMistake(id, ok) {
      const m = this.state.mistakes[id];
      if (!m || m.cleared) return;
      this.update((s) => {
        const box = (m.box || 0) + 1;
        s.mistakes[id] = ok
          ? (box >= INTERVALS.length ? { cleared: true, at: Date.now() } : { ...m, box, due: dueAfter(box), at: Date.now() })
          : { ...m, box: 0, miss: (m.miss || 0) + 1, due: dueAfter(0), at: Date.now() };
      });
    }
    /** まだ解いていない「自分の悪手」問題（期限の来たものから） */
    pendingMistakes(game) {
      return Object.entries(this.state.mistakes)
        .filter(([id, m]) => m && !m.cleared && m.game === game && m.step)
        .map(([id, m]) => ({ id, ...m }))
        .sort((a, b) => (a.due - b.due) || (a.at - b.at));
    }

    // --- 対局成績（持ち点と、相手の強さの自動調整） ---------------------------
    /** 相手の応手の予想が当たったか（対局画面の予想ドリル） */
    recordPredict(game, hit) {
      if (!SAFE_KEY.test(game)) return this.state;
      return this.update((s) => {
        const r = own(s.record, game) || emptyRecord();
        r.pt = (r.pt || 0) + 1;
        if (hit) r.ph = (r.ph || 0) + 1;
        r.at = Date.now();
        s.record[game] = r;
      });
    }
    /**
     * 1局の結果を記録して、持ち点と「じどう」の強さを更新する。
     * variant: 盤の種類。「じどう」の強さは盤の種類ごとに上下させる（4×4で勝ち続けても、本物の盤の相手は強くならない）
     * rated: 持ち点に数えるか（本番の盤だけ数える）。opp: 相手の強さ。handicap: 自分がもらった置き石の数、stone: 1子の重み。
     * drill: 詰ませる練習（ドリル）。強さの調整と、その盤の成績だけを記録する（対局の勝敗には数えない）
     */
    recordResult(game, outcome, { variant = 'main', rated = true, opp = 'normal', handicap = 0, stone = 100, drill = false } = {}) {
      if (!SAFE_KEY.test(game) || !SAFE_KEY.test(variant)) return this.state;
      if (drill) rated = false;
      return this.update((s) => {
        const r = own(s.record, game) || emptyRecord();
        const lv = r.lv || (r.lv = {});
        const v = own(lv, variant) || { level: 'normal', run: 0, w: 0, l: 0, d: 0 };
        const k = outcome === 'win' ? 'w' : outcome === 'lose' ? 'l' : 'd';
        v[k]++;
        if (!drill) r[k]++;
        v.run = k === 'w' ? (v.run > 0 ? v.run + 1 : 1) : k === 'l' ? (v.run < 0 ? v.run - 1 : -1) : 0;
        // 2連勝で強く、2連敗でやさしく。勝率が5割あたりで落ち着くようにする
        if (v.run >= 2) { v.level = LEVEL_UP[v.level] || 'normal'; v.run = 0; }
        if (v.run <= -2) { v.level = LEVEL_DOWN[v.level] || 'normal'; v.run = 0; }
        v.at = Date.now();
        lv[variant] = v;
        if (rated) {
          // 持ち点：相手の強さから見込まれる勝ち星と、実際の結果の差だけ動かす。
          // 弱い相手に勝ってもあまり上がらず、強い相手に勝つと大きく上がる（置き石をもらった分は、相手を弱く見る）
          const score = outcome === 'win' ? 1 : outcome === 'lose' ? 0 : 0.5;
          const oppR = (AI_RATING[opp] || AI_RATING.normal) - stone * (handicap || 0);
          const expect = 1 / (1 + 10 ** ((oppR - r.rating) / 400));
          r.rating = Math.round(Math.max(400, Math.min(2400, r.rating + RATING_K * (score - expect))));
          r.rn = (r.rn || 0) + 1;
          const t = own(s.trend, game) || (s.trend[game] = { r: [], d: {} });
          t.r.push([Date.now(), r.rating]);
          if (t.r.length > 60) t.r.splice(0, t.r.length - 60);
        }
        r.at = Date.now();
        s.record[game] = r;
      });
    }
    /** 問題を1問解いたときの記録（一発正解か）。上達の記録の正答率に使う */
    recordAttempt(game, ok) {
      if (!SAFE_KEY.test(game)) return this.state;
      return this.update((s) => {
        const t = own(s.trend, game) || (s.trend[game] = { r: [], d: {} });
        const k = new Date().toLocaleDateString('sv-SE');
        const v = t.d[k] || [0, 0];
        t.d[k] = ok ? [v[0] + 1, v[1]] : [v[0], v[1] + 1];
        const keys = Object.keys(t.d).sort();
        while (keys.length > 90) delete t.d[keys.shift()];
      });
    }
    trend(game) { return own(this.state.trend, game) || { r: [], d: {} }; }
    record(game) { return own(this.state.record, game) || emptyRecord(); }

    // --- 麻雀（4人打ち）の成績 ---------------------------------------------
    /** 1局ぶんを数える。win・tsumo：あがったか（ツモか）と gain（打点）。dealin：放銃したかと loss（失点）。riichi・furo：立直・副露したか */
    recordMjKyoku({ win = false, tsumo = false, gain = 0, dealin = false, loss = 0, riichi = false, furo = false } = {}) {
      return this.update((s) => {
        const m = s.mj;
        m.k++;
        if (win) { m.a++; if (tsumo) m.t++; m.ap += Math.max(0, num(gain)); }
        if (dealin) { m.h++; m.hp += Math.max(0, num(loss)); }
        if (riichi) m.r++;
        if (furo) m.f++;
        m.at = Date.now();
      });
    }
    /** 半荘の着順（1〜4位） */
    recordMjRank(rank) {
      if (![1, 2, 3, 4].includes(rank)) return this.state;
      return this.update((s) => { s.mj.rk[rank - 1]++; s.mj.at = Date.now(); });
    }
    /** 「じどう」のときに使う相手の強さ（盤の種類ごと） */
    autoLevel(game, variant = 'main') { return own(this.record(game).lv, variant)?.level || 'normal'; }

    isDone(id) { return !!this.state.lessons[id]?.done; }
    reset() {
      this.state = emptyState();
      this.state.resetAt = Date.now();
      this.state.updatedAt = this.state.resetAt;
      this._writeLocal();
      this.sync.push(this.state);
      this._emit();
    }

    // --- 引き継ぎコード（Firebase を使わない／使えないときの逃げ道） --------
    exportCode() {
      const json = JSON.stringify(this.state);
      // 大きな配列を一度に展開すると引数の上限を超えるので、少しずつ文字にする
      const bytes = new TextEncoder().encode(json);
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(bin);
    }
    importCode(code) {
      const json = new TextDecoder().decode(
        // コピー時に混ざった改行や空白は取り除く
        Uint8Array.from(atob(code.replace(/\s+/g, '')), (c) => c.charCodeAt(0))
      );
      const parsed = JSON.parse(json);
      if (!parsed || parsed.v !== 1) throw new Error('コードの形式が違います');
      const incoming = normalize(parsed);
      // 読み込みは「バックアップから戻す」操作。こちらで「すべて消す」をしたあとでも、
      // 読み込んだ記録が消去より古いからと捨てられないよう、時刻をいまに付け替える
      const floor = Math.max(this.state.resetAt || 0, incoming.resetAt || 0);
      const now = Date.now();
      const restamp = (r) => (r && (r.at || 0) < floor ? { ...r, at: now } : r);
      for (const col of ['lessons', 'reviews', 'mistakes', 'record']) {
        for (const k of Object.keys(incoming[col])) incoming[col][k] = restamp(incoming[col][k]);
      }
      // 盤の種類ごとの強さと成績も（入れ子の記録にも時刻がある）
      for (const r of Object.values(incoming.record)) {
        for (const v of Object.keys(r.lv || {})) r.lv[v] = restamp(r.lv[v]);
      }
      incoming.mj = restamp(incoming.mj);
      for (const g of Object.keys(incoming.games)) {
        const list = incoming.games[g];
        // 対局の記録は並び順を保ったまま、いまの直前の時刻へずらす
        incoming.games[g] = list.map((r, k) => ((r.at || 0) < floor ? { ...r, at: now - (list.length - k) } : r));
      }
      // 持ち点の推移も同じようにずらす（ずらさないと、消去より古い記録として捨てられていた）
      for (const t of Object.values(incoming.trend || {})) {
        const list = t.r || [];
        t.r = list.map(([at, v], k) => [(at || 0) < floor ? now - (list.length - k) : at, v]);
      }
      incoming.resetAt = 0;
      incoming.updatedAt = now;
      this.state = mergeStates(this.state, incoming);
      this._writeLocal();
      this.sync.push(this.state);
      this._emit();
    }
  }

  const store = new Store();

  return { emptyState, mergeStates, store };
})();

// ── js/games/mahjong-ai.js ──────────────────────────────────
const NS_MJAI = (() => {
  const M = NS_MAHJONG;
  const { ukeire } = NS_COACH;
  // mahjong-ai.js — CPU3人の打ち手と、押し引きのコーチ。
  //
  // CPUは強さを求めない。「受け入れが広い牌を残す」「リーチが来たら降りる」という
  // 教科書どおりの打ち方をさせる。学習者が真似できることが大事なので。



  /**
   * 絶対に当たらない牌：現物（その人の捨て牌）と、リーチ後に誰かが切って通った牌。
   * リーチ後の見逃しはフリテンになるので、通った牌ではもうロンされない。
   */
  function genbutsu(game, target) {
    const safe = new Set(game.discards[target].map((d) => M.norm(d.tile)));
    if (game.riichi?.[target] && game.log) {
      const at = game.log.findIndex((e) => e.kind === 'riichi' && e.p === target);
      if (at >= 0) {
        // 宣言牌より後の捨て牌。ただし、いま場に出ていて鳴き・ロンの判断待ちの1枚は、まだ通っていない
        const after = game.log.slice(at + 1).filter((e) => e.kind === 'discard');
        if (game.phase === 'call' && after.length) after.pop();
        for (const e of after) safe.add(M.norm(e.tile));
      }
    }
    return safe;
  }

  /**
   * 危険度をざっくり出す。0 = 安全、大きいほど危ない。
   * 入門で扱うのは「現物」「字牌の見えた枚数」くらいまでに留める。
   */
  /**
   * スジ：リーチした人が n±3 を捨てていれば、n は両面待ちでは当たらない。
   * 1〜3 と 7〜9 は片側だけ見ればよい。4〜6 は両側そろって「両スジ」、片側だけなら「片スジ」。
   * 戻り値: 'full'（スジ）/ 'half'（片スジ）/ null
   */
  function sujiOf(tile, safe, seen = null) {
    tile = M.norm(tile);
    if (M.isHonor(tile)) return null;
    const c = tile[0], n = Number(tile[1]);
    // 壁：両面の形に必要な牌が4枚とも見えていれば、その側の両面はありえない（ノーチャンス）
    const wall = (k) => seen && k >= 1 && k <= 9 && (seen[M.toIndex(`${c}${k}`)] || 0) >= 4;
    const lo = n - 3 >= 1 ? safe.has(`${c}${n - 3}`) || wall(n - 1) || wall(n - 2) : null;
    const hi = n + 3 <= 9 ? safe.has(`${c}${n + 3}`) || wall(n + 1) || wall(n + 2) : null;
    if (lo === null) return hi ? 'full' : null;
    if (hi === null) return lo ? 'full' : null;
    return lo && hi ? 'full' : lo || hi ? 'half' : null;
  }

  /** 場に見えている牌の枚数（全員の捨て牌と鳴いた牌） */
  function seenCounts(game) {
    const all = [];
    for (let p = 0; p < 4; p++) {
      for (const d of game.discards[p] || []) all.push(d.tile);
      for (const m of game.melds?.[p] || []) all.push(...m.tiles);
    }
    return M.toCounts(all);
  }

  function danger(game, tile, target) {
    tile = M.norm(tile);
    const safe = genbutsu(game, target);
    if (safe.has(tile)) return 0;
    const suji = sujiOf(tile, safe, seenCounts(game));
    if (suji === 'full') {
      const n = Number(tile[1]);
      // スジでも単騎・双ポン・嵌張には当たる。端ほど安全
      return n === 1 || n === 9 ? 3 : n === 2 || n === 8 ? 4 : 5;
    }
    if (suji === 'half') return 9;
    const visible = [
      ...game.discards.flatMap((d) => d.map((x) => x.tile)),
      ...game.melds.flatMap((m) => m.flatMap((x) => x.tiles)),
    ].filter((t) => M.norm(t) === tile).length;
    if (M.isHonor(tile)) return visible >= 3 ? 1 : visible >= 2 ? 3 : 6;
    const n = Number(tile[1]);
    if (n === 1 || n === 9) return 7;
    if (n === 2 || n === 8) return 9;
    return 12;   // 中張牌がいちばん危ない
  }

  /** いまリーチしている他家 */
  function riichiPlayers(game, me) {
    return [0, 1, 2, 3].filter((p) => p !== me && game.riichi[p]);
  }

  /**
   * 降りるべきか。判断はできるだけ単純にする。
   * 「誰かがリーチ」かつ「自分の手がテンパイまであと2枚以上」なら降りる。
   */
  function shouldFold(game, me) {
    const threats = riichiPlayers(game, me);
    if (!threats.length) return false;
    const sh = M.shantenAll(game.fullHand(me), game.setsNeeded(me));
    return sh >= 2;
  }

  /** 降りるときに切る牌（いちばん安全なもの） */
  function safestDiscard(game, me) {
    const threats = riichiPlayers(game, me);
    const hand = game.fullHand(me);
    let best = null, bestD = Infinity;
    for (const t of new Set(hand)) {
      if (game.canDiscard && !game.canDiscard(me, t)) continue;   // 喰い替えで切れない牌
      const d = Math.max(...threats.map((p) => danger(game, t, p)));
      if (d < bestD) { bestD = d; best = t; }
    }
    return { tile: best, danger: bestD };
  }

  /** CPUの1手。教科書どおりに打つ */
  function cpuTurn(game, me) {
    const a = cpuTurnRaw(game, me);
    if (a.action !== 'discard') return a;
    const hand = game.fullHand(me);
    const ok = (t) => !game.canDiscard || game.canDiscard(me, t);
    // 喰い替えで切れない牌を選んでいたら、受け入れがいちばん広い切れる牌に替える
    if (!ok(a.tile)) {
      const alt = ukeire(hand, game.setsNeeded(me)).find((r) => ok(r.tile));
      a.tile = alt ? alt.tile : hand.find(ok);
    }
    // 同じ5を切るなら、赤5ではなく普通の5から（リーチ後のツモ切りは除く）
    if (M.isRed(a.tile) && !(game.riichi[me] && a.tile === game.drawn)) {
      const plain = hand.find((t) => t === M.norm(a.tile));
      if (plain && ok(plain)) a.tile = plain;
    }
    return a;
  }
  function cpuTurnRaw(game, me) {
    if (game.canTsumo(me)) return { action: 'tsumo' };
    // カン：加槓はいつでも、暗槓は形が悪くならないときだけ（降りているときはしない）
    const kans = game.kanOptions ? game.kanOptions(me) : [];
    if (kans.length && !shouldFold(game, me)) {
      const hand = game.fullHand(me);
      const now = ukeire(hand, game.setsNeeded(me))[0]?.shanten ?? 8;
      for (const k of kans) {
        if (k.type === 'kakan' || game.riichi[me]) return { action: 'kan', type: k.type, tile: k.tile };
        const rest = hand.filter((t) => M.norm(t) !== k.tile);
        if (M.shanten(rest, game.setsNeeded(me) - 1) <= now) return { action: 'kan', type: k.type, tile: k.tile };
      }
    }
    // リーチ後はツモ切りしかできない
    if (game.riichi[me] && game.drawn) return { action: 'discard', tile: game.drawn };

    if (shouldFold(game, me)) {
      return { action: 'discard', tile: safestDiscard(game, me).tile, reason: 'fold' };
    }

    const rOpts = game.riichiOptions(me);
    if (rOpts.length && Math.random() < 0.85) {
      // 受け入れがいちばん広くなる牌でリーチ
      const table = ukeire(game.fullHand(me), game.setsNeeded(me));
      const pick = table.find((r) => rOpts.includes(r.tile)) || { tile: rOpts[0] };
      return { action: 'discard', tile: pick.tile, riichi: true };
    }

    const table = ukeire(game.fullHand(me), game.setsNeeded(me));
    // 他家にリーチが入っているなら、同じ受け入れなら安全な方を選ぶ
    const threats = riichiPlayers(game, me);
    if (threats.length) {
      const best = table[0];
      const tied = table.filter((r) => r.shanten === best.shanten && r.tiles >= best.tiles - 2);
      tied.sort((a, b) =>
        Math.max(...threats.map((p) => danger(game, a.tile, p))) -
        Math.max(...threats.map((p) => danger(game, b.tile, p))));
      return { action: 'discard', tile: tied[0].tile };
    }
    return { action: 'discard', tile: table[0].tile };
  }

  /** CPUが鳴くかどうか。鳴きが有効なときだけ呼ばれる */
  function cpuCall(game, call) {
    const p = call.p;
    if (call.type === 'ron') return true;
    if (game.riichi[p]) return false;
    // 役牌のポンだけ受ける。それ以外は鳴かない（初心者に真似させたくないため）
    if (call.type === 'pon') {
      const yakuhai = ['z5', 'z6', 'z7', game.seatWind(p), game.roundWind()];
      return yakuhai.includes(call.tile);
    }
    return false;
  }

  /**
   * 押し引きのコーチ。学習者が牌を切る「前」に出す助言と、切った「後」の講評。
   */
  /**
   * リーチするかの助言。リーチできる牌ごとに待ちの残り枚数を数え、いちばん良いものを基準にする。
   * 役がなければリーチしないとあがれない。役があって待ちが狭いなら、ダマ（リーチしない）も選べる。
   */
  function riichiAdvice(game, me) {
    const opts = game.riichiOptions(me);
    if (!opts.length) return null;
    const full = game.fullHand(me);
    const seen = seenCounts(game);
    const mine = M.toCounts(full);
    // 自分の捨て牌に待ちがあるとフリテン（リーチしてもロンできない）。いま切る牌も捨て牌になる
    const own = new Set((game.discards?.[me] || []).map((d) => M.norm(d.tile)));
    const cands = [];
    for (const t of opts) {
      const rest = [...full]; rest.splice(rest.indexOf(t), 1);
      const w = M.waits(M.sortTiles(rest), game.setsNeeded(me));
      const left = w.reduce((a, x) => a + Math.max(0, 4 - (seen[M.toIndex(x)] || 0) - (mine[M.toIndex(x)] || 0)), 0);
      // 役があるか（リーチなしのロンで判定）
      const yaku = w.some((x) => M.judgeYaku(M.sortTiles([...rest, x]), {
        menzen: true, seatWind: game.seatWind(me), roundWind: game.roundWind(), winTile: x,
        melds: game.meldsFor ? game.meldsFor(me) : [],
      }).length);
      const dead = w.filter((x) => own.has(x) || x === M.norm(t));   // フリテンの原因になる待ち
      cands.push({ tile: t, waits: w, left, yaku, dead, furiten: dead.length > 0 });
    }
    // フリテンにならない切り方を優先し、その中で待ちの残りが多いもの
    let best = null;
    for (const c of cands) if (!best || (best.furiten && !c.furiten) || (best.furiten === c.furiten && c.left > best.left)) best = c;
    const wt = best.waits.map(M.tileName).join('・');
    const why = (c) => (c.dead.some((x) => own.has(x))
      ? `待ちの${c.dead.filter((x) => own.has(x)).map(M.tileName).join('・')}をすでに自分で捨てている`
      : `切った${M.tileName(c.tile)}が待ちになる`);
    // オーラス：リーチかダマかは、着順で決める
    if (!best.furiten && game.isAllLast && game.isAllLast()) {
      const rest = [...full]; rest.splice(rest.indexOf(best.tile), 1);
      const al = { scores: game.scores, oya: game.oya, honba: game.honba, pot: game.riichiSticks, first: 0, target: 0, yame: false };
      const r = allLastRiichi(game, me, al, M.sortTiles(rest));
      if (r && r.riichi < r.dama && r.deposit === r.now) {
        return { level: 'ok', lines: [{ kind: 'riichi',
          what: `オーラスです。${M.tileName(best.tile)}を切ってリーチすれば、あがったとき${r.riichi === 1 ? 'トップ' : `${r.riichi}位`}になれます。`,
          why: r.damaYaku ? `ダマでは、あがっても${r.dama}位までです。条件に届くのはリーチだけです。` : 'この手には役がないので、ダマではツモでしかあがれません。',
          lesson: 'オーラスは「ダマで届くか」「リーチで届くか」を先に計算します。' }] };
      }
      if (r && r.damaYaku && !r.improves && (r.deposit > r.now || r.dama === 1)) {
        return { level: 'ok', lines: [{ kind: 'riichi',
          what: `オーラスです。ダマでも、あがれば${r.dama === 1 ? 'トップ' : `${r.dama}位`}になれる手です。`,
          why: r.deposit > r.now ? `リーチ棒（1000点）を出すと、あがれずに終わったとき${r.deposit}位に落ちることがあります。ダマで待ちましょう。`
            : 'リーチをかけても順位は変わりません。相手に警戒されないよう、ダマで待ちましょう。',
          lesson: 'オーラスは、ダマで条件に届くならダマが基本です。' }] };
      }
    }
    if (best.furiten) {
      return { level: 'ok', lines: [{ kind: 'riichi',
        what: `テンパイですが、どう切ってもフリテンになります（待ち：${wt}）。`,
        why: `${why(best)}ので、この待ちではロンできません。リーチするとツモでしかあがれず、待ちも変えられなくなります。`,
        lesson: 'フリテンのテンパイは、リーチせずに手を進めて、待ちを変えるのが基本です。' }] };
    }
    // 待ちは広いがフリテンになる切り方があれば、選ばなかった理由を添える
    const wider = cands.filter((c) => c.furiten && c.left > best.left).sort((a, b) => b.left - a.left)[0];
    const note = wider ? `（${M.tileName(wider.tile)}切りなら待ちは広くなりますが、${why(wider)}のでフリテンになり、ロンできません）` : '';
    if (!best.yaku) {
      return { level: 'ok', lines: [{ kind: 'riichi',
        what: `テンパイです。${M.tileName(best.tile)}を切ってリーチしましょう（待ち：${wt}、残り${best.left}枚）。`,
        why: `この手には役がないので、リーチしないとロンであがれません。${note}`,
        lesson: '役のないテンパイは、リーチが役の代わりになります。' }] };
    }
    if (best.left >= 5) {
      return { level: 'ok', lines: [{ kind: 'riichi',
        what: `テンパイです。待ちが広い（残り${best.left}枚）ので、リーチで点数を上げましょう。`,
        why: `${M.tileName(best.tile)}切りで ${wt} 待ち。リーチで1翻増え、裏ドラや一発の可能性もつきます。${note}`,
        lesson: '良い待ちのテンパイは、リーチが基本です。' }] };
    }
    return { level: 'ok', lines: [{ kind: 'riichi',
      what: `テンパイです。役があるので、リーチしない（ダマ）選択もあります。`,
      why: `待ちは ${wt}（残り${best.left}枚）と狭めです。リーチすると相手に警戒されて出にくくなるので、ダマで待つのも手です。${note}`,
      lesson: '役がある・待ちが悪い・点数が十分、のどれかならダマも考えます。' }] };
  }

  /** トイトイまでのシャンテン数（刻子と対子だけで数える。-1 なら完成） */
  function toitoiShanten(hand, sets) {
    const c = M.toCounts(hand.map(M.norm));
    let T = 0, P = 0, S = 0;
    for (const n of c) { if (n >= 3) T++; else if (n === 2) P++; else if (n === 1) S++; }
    // 刻子は0枚、対子はあと1枚、1枚だけの牌はあと2枚で刻子になる。足りなければ、まったく新しい牌3枚
    const fill = (t, p, s) => {
      let k = sets, need = 0;
      const a = Math.min(t, k); k -= a;
      const b = Math.min(p, k); k -= b; need += b;
      const d = Math.min(s, k); k -= d; need += 2 * d;
      return need + 3 * k;
    };
    // 雀頭をどこから取るか（対子・余った刻子・1枚の牌・何もない）で、いちばん近いもの
    const opts = [2 + fill(T, P, S)];
    if (P > 0) opts.push(fill(T, P - 1, S));
    if (T > 0) opts.push(fill(T - 1, P, S));
    if (S > 0) opts.push(1 + fill(T, P, S - 1));
    return Math.min(...opts) - 1;
  }

  /**
   * 鳴いたあとに、役になる道筋が残っているか。
   * hand：鳴いた後の手の中の牌（切る前）、melds：鳴いた組（今回の鳴きを含む。{ type, tiles }）
   * o：{ seatWind, roundWind, seen（手の外に見えている牌の枚数。役牌の残りを数える）, kuitan（false なら喰いタンなし） }
   * 返り値：[{ key, ja, sure }]。sure は、役がもう決まっているもの。空なら役の道筋がない。
   * 「役がない」と言いすぎないよう、少し遠くても届きそうな役は候補に入れる
   */
  function yakuPaths(hand, melds, o = {}) {
    const H = M.sortTiles(hand.map(M.norm));
    const mt = melds.map((m) => M.sortTiles(m.tiles.map(M.norm)));
    const sets = 4 - melds.length;
    const yh = [...new Set(['z5', 'z6', 'z7', o.seatWind, o.roundWind].filter(Boolean))];
    const cnt = M.toCounts(H);
    const seen = o.seen || [];
    const isTrip = (ts) => ts[0] === ts[1];
    const out = [];
    const add = (key, ja, sure = false) => { if (!out.some((x) => x.key === key)) out.push({ key, ja, sure }); };
    // 役牌：鳴いた刻子・手の中の暗刻なら決まり。対子なら、残りの牌がまだ見えていなければ候補
    for (const t of yh) {
      const c = cnt[M.toIndex(t)];
      if (c >= 3 || mt.some((ts) => isTrip(ts) && ts[0] === t)) add(`yakuhai-${t}`, `役牌（${M.tileName(t)}）`, true);
      else if (c === 2 && 2 - (seen[M.toIndex(t)] || 0) > 0) add(`pair-${t}`, `役牌（${M.tileName(t)}の対子）`);
    }
    const sh = M.shanten(H, sets);
    // タンヤオ：鳴いた組に1・9・字牌がなく、手の中の1・9・字牌を外しても、遠くなりすぎない（2枚ぶんまで）
    if (o.kuitan !== false && !mt.some((ts) => ts.some(M.isYaochu))) {
      const rest = H.filter((t) => !M.isYaochu(t));
      if (M.shanten(rest, sets) <= sh + 2) add('tanyao', 'タンヤオ', rest.length === H.length);
    }
    // ホンイツ・チンイツ：鳴いた組が1色（と字牌）で、ほかの色の牌を外しても、遠くなりすぎない（2枚ぶんまで）
    for (const s of ['m', 'p', 's']) {
      if (!mt.every((ts) => ts.every((t) => t[0] === s || t[0] === 'z'))) continue;
      const rest = H.filter((t) => t[0] === s || t[0] === 'z');
      if (!rest.some((t) => t[0] === s) && !mt.some((ts) => ts[0][0] === s)) continue;
      if (M.shanten(rest, sets) <= sh + 2) {
        const chin = !rest.some((t) => t[0] === 'z') && !mt.some((ts) => ts[0][0] === 'z');
        add('honitsu', chin ? '清一色' : '混一色', rest.length === H.length);
      }
    }
    // トイトイ：鳴いた組が全部ポン・カンで、対子が多い
    if (mt.every(isTrip) && toitoiShanten(H, sets) <= sh + 2) add('toitoi', '対々和');
    // 三暗刻：手の中に暗刻が3つ
    if (cnt.filter((n) => n >= 3).length >= 3) add('sanankou', '三暗刻');
    // チャンタ：鳴いた組のどれにも1・9・字牌が入り、4〜6の牌を外しても、ほとんど遠くならない
    if (mt.every((ts) => ts.some(M.isYaochu))) {
      const rest = H.filter((t) => M.isHonor(t) || ![4, 5, 6].includes(Number(t[1])));
      if (M.shanten(rest, sets) <= sh + 1) add('chanta', 'チャンタ');
    }
    // 三色同順・一気通貫：足りない牌が2枚以内
    const seqMeld = (s, n) => mt.some((ts) => ts[0] === `${s}${n}` && ts[1] === `${s}${n + 1}`);
    const lack = (s, n) => [0, 1, 2].filter((k) => !cnt[M.toIndex(`${s}${n + k}`)]).length;
    for (let n = 1; n <= 7; n++) {
      const need = ['m', 'p', 's'].filter((s) => !seqMeld(s, n));
      if (need.length <= sets && need.reduce((a, s) => a + lack(s, n), 0) <= 2) add('sanshoku', '三色同順');
    }
    for (const s of ['m', 'p', 's']) {
      const need = [1, 4, 7].filter((n) => !seqMeld(s, n));
      if (need.length <= sets && need.reduce((a, n) => a + lack(s, n), 0) <= 2) add('ittsu', '一気通貫');
    }
    // もう役のあるテンパイが取れる（三色同刻・小三元など、上で見ていない役もここで拾う）
    if (sh <= 0) {
      const ms = melds.map((m) => ({ tiles: m.tiles, closed: m.type === 'ankan' }));
      const ok = (r) => M.waits(r, sets).some((w) => {
        const ev = M.evaluateHand([...r, w], { menzen: false, seatWind: o.seatWind, roundWind: o.roundWind, winTile: w, melds: ms });
        return ev.han - (o.kuitan === false && ev.list.includes('tanyao') ? 1 : 0) > 0;
      });
      const opts = H.length % 3 === 2 ? [...new Set(H)].map((t) => { const r = [...H]; r.splice(r.indexOf(t), 1); return r; }) : [H];
      if (opts.some(ok)) add('tenpai', '役のあるテンパイ', true);
    }
    return out;
  }

  /** 1枚だけある役牌のうち、まだ2枚以上残っているもの（重なれば役になる「後付け」の候補） */
  function lateYakuhai(hand, o = {}) {
    const c = M.toCounts(hand.map(M.norm));
    const seen = o.seen || [];
    return [...new Set(['z5', 'z6', 'z7', o.seatWind, o.roundWind].filter(Boolean))]
      .filter((t) => c[M.toIndex(t)] === 1 && 3 - (seen[M.toIndex(t)] || 0) >= 2);
  }

  /** 役の道筋がない鳴きについて、なぜ役がないのかを短く言う */
  function nakiReason(hand, melds, o = {}) {
    const H = hand.map(M.norm);
    const mt = melds.map((m) => M.sortTiles(m.tiles.map(M.norm)));
    const why = [];
    const yaoMeld = mt.find((ts) => ts.some(M.isYaochu));
    why.push(o.kuitan === false ? 'この卓は喰いタンなしなので、鳴いた手はタンヤオになりません'
      : yaoMeld ? `鳴いた組（${yaoMeld.map(M.tileName).join('')}）に1・9・字牌が入っているので、タンヤオにはなりません`
        : '手の中に1・9・字牌が多く、タンヤオには遠い形です');
    const yh = [...new Set(['z5', 'z6', 'z7', o.seatWind, o.roundWind].filter(Boolean))];
    const c = M.toCounts(H);
    const dead = yh.find((t) => c[M.toIndex(t)] === 2);
    const singles = lateYakuhai(hand, o);
    why.push(dead ? `役牌の${M.tileName(dead)}は2枚ありますが、残りの${M.tileName(dead)}はもう場に見えています`
      : singles.length ? `役牌は${singles.map(M.tileName).join('・')}が${singles.length > 1 ? '1枚ずつ' : '1枚'}あるだけです。あと2枚重ならないと役になりません（後付け）`
        : '役牌の刻子も対子もありません');
    const suits = new Set([...H, ...mt.flat()].filter((t) => !M.isHonor(t)).map((t) => t[0]));
    if (suits.size >= 2) why.push('色が混ざっていて、混一色にも遠い形です');
    return `${why.join('。')}。`;
  }

  /** 見えている牌の枚数（捨て牌は鳴かれていないものだけ。鳴かれた牌は鳴いた組の方で数える） */
  function visibleCounts(game) {
    const seen = new Array(34).fill(0);
    for (let p = 0; p < 4; p++) {
      for (const d of game.discards[p] || []) if (!d.called) seen[M.toIndex(M.norm(d.tile))]++;
      for (const m of game.melds?.[p] || []) for (const t of m.tiles) seen[M.toIndex(M.norm(t))]++;
    }
    return seen;
  }

  /** 鳴くかの助言（ポン・チー・カン）。役が残る鳴きかを、鳴く「前」に見る */
  function callAdvice(game, me, call) {
    const tile = call.tile;
    const yakuhai = ['z5', 'z6', 'z7', game.seatWind(me), game.roundWind()].includes(M.norm(tile));
    if (call.type === 'pon' && yakuhai) {
      return { level: 'ok', lines: [{ kind: 'call',
        what: `${M.tileName(tile)}は役牌です。ポンすれば役が確定します。`,
        why: '役牌のポンは、手を早くしながら役もつく、いちばん損の少ない鳴きです。',
        lesson: '役牌が2枚あって、それが出たら鳴く。これが鳴きの基本です。' }] };
    }
    // 鳴いた後の手と組
    const used = call.type === 'chi' ? [...(call.pat || [])] : [tile, tile, ...(call.type === 'kan' ? [tile] : [])];
    const after = [...game.hands[me]];
    for (const t of used) {
      let i = after.indexOf(t);
      if (i < 0) i = after.findIndex((x) => M.norm(x) === M.norm(t));
      if (i >= 0) after.splice(i, 1);
    }
    const melds = [...game.melds[me].map((m) => ({ type: m.type, tiles: m.tiles })), { type: call.type === 'kan' ? 'kan' : call.type, tiles: [tile, ...used] }];
    const o = { seatWind: game.seatWind(me), roundWind: game.roundWind(), seen: visibleCounts(game) };
    const paths = yakuPaths(after, melds, o);
    const sure = paths.filter((x) => x.sure);
    // 「役のあるテンパイ」は、ほかに役の名前が言えるときは言わない
    const names = (list) => (list.length > 1 ? list.filter((x) => x.key !== 'tenpai') : list).map((x) => x.ja).join('・');
    if (sure.length) {
      return { level: 'ok', lines: [{ kind: 'call',
        what: `鳴いても役は残ります（${names(sure)}）。`,
        why: 'ただし、鳴くとリーチ・ツモ・ピンフはつかなくなり、点数は下がります。早くあがりたい場面向けです。',
        lesson: '鳴くのは「役が残る」ときだけ、と覚えておけば失敗しません。' }] };
    }
    if (paths.length) {
      return { level: 'ok', lines: [{ kind: 'call',
        what: `鳴くなら、役の候補は${names(paths)}です。`,
        why: 'まだ役が決まったわけではありません。鳴いたあと、その役に向かって手を進められるかを考えてから鳴きます。鳴くとリーチ・ツモ・ピンフはつかなくなります。',
        lesson: '鳴くのは「役が残る」ときだけ、と覚えておけば失敗しません。' }] };
    }
    const singles = lateYakuhai(after, o);
    return { level: 'miss', lines: [{ kind: 'call',
      what: singles.length ? `この鳴きは、役牌の${singles.map(M.tileName).join('・')}が重ならないと役がありません（後付け）。` : 'この鳴きは、役がなくなる危険があります。',
      why: `${nakiReason(after, melds, o)}鳴くとリーチもできないので、あがれない手になりがちです。`,
      lesson: '迷ったら鳴かない。門前ならリーチという役がいつでも使えます。' }] };
  }

  /**
   * オーラスのアガリで、着順がどう変わるか（ここで対局が終わるか）。
   * scores：いまの持ち点（場の供託は含めない）
   * o：{ me, oya, honba, pot（場の供託の本数）, han, fu, tsumo, from（ロンなら放銃した人）, first（起家。同点なら起家に近い方が上）,
   *      target（返し点。0 なら返し点を見ず、子のアガリで終局・親のアガリで連荘）, yame（親がトップになるアガリで終局する「アガリ止め」） }
   * 返り値：{ before（いまの着順）, after（あがったときの着順）, ends（このアガリで終局するか）, scores（あがった後の点数） }
   */
  function placeAfterWin(scores, o) {
    const oya = o.me === o.oya;
    const next = [...scores];
    const honba = o.honba || 0;
    if (o.tsumo) {
      const t = M.tsumoPoints(o.han, o.fu || 30, oya);
      for (let p = 0; p < 4; p++) {
        if (p === o.me) continue;
        const pay = (p === o.oya ? t.fromOya : t.fromKo) + honba * 100;
        next[p] -= pay; next[o.me] += pay;
      }
    } else {
      const pay = M.ronPoints(o.han, o.fu || 30, oya) + honba * 300;
      next[o.from] -= pay; next[o.me] += pay;
    }
    next[o.me] += (o.pot || 0) * 1000;
    const ord = (p) => (p - (o.first || 0) + 4) % 4;
    const rank = (sc, p) => 1 + [0, 1, 2, 3].filter((q) => q !== p && (sc[q] > sc[p] || (sc[q] === sc[p] && ord(q) < ord(p)))).length;
    const before = rank(scores, o.me), after = rank(next, o.me);
    let ends;
    if (next.some((v) => v < 0)) ends = true;                                  // 飛び
    else if (!o.target) ends = !oya;                                            // 子のアガリで終局、親のアガリは連荘
    else if (oya) ends = !!o.yame && after === 1 && Math.max(...next) >= o.target;   // 親はトップならアガリ止め
    else ends = Math.max(...next) >= o.target;                                  // 返し点に届く人がいなければ延長戦
    return { before, after, ends, scores: next };
  }

  /**
   * オーラスの押し引き：リーチした人に振り込んだら／自分があがったら、着順がどうなるか。
   * al：{ scores, oya, honba, pot, first, target, yame, unit }（オーラスでなければ null）
   * hand：自分の手の中の牌（3n+1枚なら切った後の形、3n+2枚なら切る前の形で、どれかを切ったテンパイを見る）
   * 返り値：{ cur（いまの着順）, high（満貫を振り込んだときの着順。リーチが2人ならいちばん悪い方）,
   *          ends（振り込んでも、流局でも、この局で対局が終わるか）, rise（あがれば着順が上がるか）, riseRank }
   */
  function allLastRisk(game, me, al, hand) {
    const threats = riichiPlayers(game, me);
    if (!al || !threats.length) return null;
    const ord = (p) => (p - (al.first || 0) + 4) % 4;
    const rank = (sc, p) => 1 + [0, 1, 2, 3].filter((q) => q !== p && (sc[q] > sc[p] || (sc[q] === sc[p] && ord(q) < ord(p)))).length;
    const cur = rank(al.scores, me);
    const base = { oya: al.oya, honba: al.honba || 0, pot: al.pot || 0, first: al.first || 0, target: al.target || 0, yame: !!al.yame };
    let high = cur, ends = false;
    for (const t of threats) {
      const hi = placeAfterWin(al.scores, { ...base, me: t, han: 5, fu: 30, tsumo: false, from: me });   // 満貫を振り込む
      if (hi.ends) { ends = true; high = Math.max(high, rank(hi.scores, me)); }
    }
    // 自分があがったら：テンパイの形のどれかで、ツモでも、だれからのロンでも、着順が上がるか
    let riseRank = cur;
    if (hand && hand.length) {
      const sets = game.setsNeeded(me);
      const melds = game.meldsFor ? game.meldsFor(me) : [];
      const menzen = game.isMenzen ? game.isMenzen(me) : true;
      const doras = game.doraTiles ? game.doraTiles() : [];
      const meldTiles = (game.melds?.[me] || []).flatMap((m) => m.tiles);
      const forms = hand.length % 3 === 2 ? [...new Set(hand)].map((t) => { const r = [...hand]; r.splice(r.indexOf(t), 1); return r; }) : [hand];
      for (const h of forms) {
        for (const w of M.waits(M.sortTiles(h), sets)) {
          for (const tsumo of [true, false]) {
            const ev = M.evaluateHand(M.sortTiles([...h, w]), { riichi: !!game.riichi?.[me], tsumo, menzen, seatWind: game.seatWind(me), roundWind: game.roundWind(), winTile: w, melds });
            if (!(ev.han > 0)) continue;
            const all = [...h, w, ...meldTiles];
            const han = ev.han + doras.reduce((a, d) => a + all.filter((x) => M.norm(x) === d).length, 0) + all.filter(M.isRed).length;
            for (const from of tsumo ? [null] : [0, 1, 2, 3].filter((q) => q !== me)) {
              const r = placeAfterWin(al.scores, { ...base, me, han, fu: ev.fu, tsumo, from });
              riseRank = Math.min(riseRank, r.after);
            }
          }
        }
      }
    }
    // 流局しても終わるか（30000点に届いている人がいるか）。届いていなければ延長戦なので、降りても終わらない
    const drawEnds = !al.target || Math.max(...al.scores) >= al.target;
    return { cur, high, ends: ends && drawEnds, rise: riseRank < cur, riseRank };
  }

  /**
   * オーラスの押し引き（リーチが入っているとき）。着順で考えると、ふだんの「テンパイなら押す」「手が遠ければ降りる」が変わる。
   *  ・トップ目：満貫を振り込むと着順が落ちるなら、テンパイでも危ない牌は止める
   *  ・2着・3着：あがっても着順が上がらず、振り込むと落ちるなら、危ない牌は止める
   *  ・ラス目：振り込んでも着順は下がらないので、押してよい（「降りる場面」とは言わない）
   * review は切った後の押し引きの講評（reviewDiscard4）。返り値：{ review（置きかえた講評）, note（講評の先頭に足す1行） }
   */
  function allLastPush(game, me, tile, review, al) {
    const risk = allLastRisk(game, me, al, M.sortTiles(game.hands[me]));
    if (!risk || !risk.ends) return { review, note: null };
    const u = al.unit || '着';
    const threats = riichiPlayers(game, me);
    const d = Math.max(...threats.map((p) => danger(game, tile, p)));
    const safe = safestDiscard(game, me);
    const sh = M.shantenAll(M.sortTiles(game.hands[me]), game.setsNeeded(me));
    const dangerous = d >= 9 && safe.tile != null && safe.danger < d;
    const better = safe.tile != null ? { tile: safe.tile, label: `${M.tileName(safe.tile)}切り`,
      reason: safe.danger === 0 ? '現物なので100%安全です。' : 'いまの手牌でいちばん安全です。' } : null;
    const worse = (a, b) => (a === 'blunder' || b === 'blunder' ? 'blunder' : 'miss');
    if (risk.cur === 4) {
      // ラス目：振り込んでも着順は下がらない。降りる・押すの指摘はせず、手を進めたかを見る
      if (!review.lines.some((l) => l.kind === 'push' || l.kind === 'safe')) return { review, note: null };
      return { review: { level: 'ok', lines: [] }, note: { kind: 'good', sub: 'allLast4',
        what: `オーラスのラス目です。振り込んでも${u === '位' ? '順位' : '着順'}は下がらないので、押して構いません。`,
        why: risk.rise ? `あがれば${risk.riseRank}${u}に上がれる手です。` : 'ラスを抜けるには、あがるしかありません。降りずに手を進めます。', lesson: '' } };
    }
    if (risk.cur === 1 && risk.high > 1 && dangerous) {
      return { review: { level: sh >= 1 ? 'blunder' : 'miss', lines: [{
        kind: 'push', sub: 'allLast',
        what: `オーラスのトップ目で、${M.tileName(tile)}は危ない牌です。`,
        why: `リーチに満貫を振り込むと、${risk.high}${u}に落ちて終わります。`
          + (sh === 0 ? 'テンパイですが、あがってトップのまま終わる得より、振り込んで着順を落とす損の方が大きい場面です。' : '手もまだ遠いので、押す理由がありません。'),
        better, lesson: 'トップ目のオーラスは「あがる」より「振り込まない」。危ない牌を止めれば、流局でもトップで終われます。',
      }] }, note: null };
    }
    if ((risk.cur === 2 || risk.cur === 3) && risk.high > risk.cur && !risk.rise && dangerous) {
      return { review: { level: worse(review.level, 'miss'), lines: [{
        kind: 'push', sub: 'allLast',
        what: `オーラスの${risk.cur}${u}${u === '着' ? '目' : ''}で、${M.tileName(tile)}は危ない牌です。`,
        why: `${sh === 0 ? 'テンパイですが、あがっても着順は上がりません。' : 'この手では、あがっても着順は上がりません。'}リーチに満貫を振り込むと${risk.high}${u}に落ちて終わるので、押す得がない場面です。`,
        better, lesson: 'オーラスは「あがったら何着か」「振り込んだら何着か」を比べて、押すか降りるかを決めます。',
      }] }, note: null };
    }
    if (risk.rise && sh === 0) {
      return { review, note: { kind: 'good', sub: 'allLastRise', what: `あがれば${risk.riseRank}${u}に上がれるテンパイです。オーラスは、着順が上がる手なら押す価値があります。`, why: '', lesson: '' } };
    }
    return { review, note: null };
  }

  /**
   * オーラスのリーチ判断：テンパイ（切った後の手 hand13、門前）で、リーチとダマのどちらが着順に良いか。
   * al：{ scores（リーチ棒を出す前）, oya, honba, pot, first, target, yame }
   * 返り値：null（判断しない）か { now（いまの着順）, deposit（リーチ棒を出してあがれずに終わったとき）,
   *          dama・riichi（あがったときに届くいちばん良い着順。5 はあがれない）, damaYaku（ダマでもロンできるか）,
   *          improves（どれかのあがり方で、リーチの方が着順が良くなるか） }
   */
  function allLastRiichi(game, me, al, hand13) {
    if (!al) return null;
    if (al.target && Math.max(...al.scores) < al.target) return null;   // 延長戦：流局しても終わらない
    const sets = game.setsNeeded(me);
    const ws = M.waits(M.sortTiles(hand13), sets);
    if (!ws.length) return null;
    const ord = (p) => (p - (al.first || 0) + 4) % 4;
    const rank = (sc, p) => 1 + [0, 1, 2, 3].filter((q) => q !== p && (sc[q] > sc[p] || (sc[q] === sc[p] && ord(q) < ord(p)))).length;
    const now = rank(al.scores, me);
    const dep = [...al.scores];
    dep[me] -= 1000;
    const deposit = rank(dep, me);
    const base = { oya: al.oya, honba: al.honba || 0, first: al.first || 0, target: al.target || 0, yame: !!al.yame };
    const doras = game.doraTiles ? game.doraTiles() : [];
    const melds = game.meldsFor ? game.meldsFor(me) : [];
    const meldTiles = (game.melds?.[me] || []).flatMap((m) => m.tiles);
    let dama = 5, riichi = 5, damaYaku = false, improves = false;
    for (const w of ws) {
      const all = [...hand13, w, ...meldTiles];
      const extra = doras.reduce((a, d) => a + all.filter((x) => M.norm(x) === d).length, 0) + all.filter(M.isRed).length;
      for (const tsumo of [true, false]) {
        const ctx = { tsumo, menzen: true, seatWind: game.seatWind(me), roundWind: game.roundWind(), winTile: w, melds };
        const ev = M.evaluateHand(M.sortTiles([...hand13, w]), { ...ctx, riichi: false });
        const evR = M.evaluateHand(M.sortTiles([...hand13, w]), { ...ctx, riichi: true });
        if (ev.han > 0 && !tsumo) damaYaku = true;
        for (const from of tsumo ? [null] : [0, 1, 2, 3].filter((q) => q !== me)) {
          // 同じあがり方（同じ待ち・ツモか、だれからのロンか）で、リーチの方が着順が良くなるか。
          // ダマであがっても対局が終わらない（親の連荘・延長戦）なら、点数が多いほど得なので、リーチにも意味がある
          const dw = ev.han > 0 ? placeAfterWin(al.scores, { ...base, me, pot: al.pot || 0, han: ev.han + extra, fu: ev.fu, tsumo, from }) : null;
          const rw = evR.han > 0 ? placeAfterWin(dep, { ...base, me, pot: (al.pot || 0) + 1, han: evR.han + extra, fu: evR.fu, tsumo, from }) : null;
          const d = dw ? dw.after : 5, rr = rw ? rw.after : 5;
          dama = Math.min(dama, d);
          riichi = Math.min(riichi, rr);
          if (rr < d || (dw && !dw.ends)) improves = true;
        }
      }
    }
    return { now, deposit, dama, riichi, damaYaku, improves };
  }

  /**
   * オーラスのリーチ判断の講評。declared：リーチしたか。unit：「着」か「位」
   * 返り値：null か { level, line, drop（ふだんの「役なしダマ」の指摘を出さない） }
   */
  function allLastRiichiLine(r, declared, unit = '着') {
    if (!r) return null;
    const u = unit;
    const top = (n) => (n === 1 ? 'トップ' : `${n}${u}`);
    const lesson = 'オーラスは「ダマで届くか」「リーチで届くか」を先に計算します。ダマで届くならダマ、リーチでしか届かないならリーチです。';
    const depo = `リーチ棒（1000点）を出すと、あがれずに終わったとき${r.deposit}${u}に落ちることがあります。`;
    if (declared) {
      if (r.damaYaku && !r.improves && (r.deposit > r.now || r.dama === 1)) {
        return { level: 'miss', drop: true, line: { kind: 'riichi', sub: 'allLast', what: 'オーラスで、リーチは要らない場面でした。',
          why: `ダマでも、あがれば${top(r.dama)}になれる手です。`
            + (r.deposit > r.now ? depo : 'リーチをかけると、相手に警戒されてあがり牌が出にくくなり、危ない牌も止められなくなります。'),
          lesson } };
      }
      return null;
    }
    if (r.riichi < r.dama) {
      const damaJa = r.damaYaku ? `ダマでは、あがっても${top(r.dama)}までです。` : 'ダマでは役がなく、ツモでしかあがれません。';
      if (r.deposit > r.now) {
        return { level: 'ok', drop: true, line: { kind: 'good', sub: 'allLastTradeoff', what: `リーチをかければ、あがったとき${top(r.riichi)}になれる手でした。`,
          why: `${damaJa}ただし、${depo}どちらを取るかの勝負どころです。`, lesson: '' } };
      }
      return { level: 'miss', drop: true, line: { kind: 'riichi', sub: 'allLast', what: 'オーラスで、リーチをかける場面でした。',
        why: `リーチをかければ、あがったとき${top(r.riichi)}になれました。${damaJa}`, lesson } };
    }
    if (r.damaYaku && !r.improves && (r.deposit > r.now || r.dama === 1)) {
      return { level: 'ok', drop: true, line: { kind: 'good', sub: 'allLastDama', what: `ダマでも、あがれば${top(r.dama)}になれる手です。オーラスは、ダマで十分な場面です。`,
        why: r.deposit > r.now ? depo : '', lesson: '' } };
    }
    if (!r.damaYaku && r.deposit > r.now) {
      return { level: 'ok', drop: true, line: { kind: 'good', sub: 'allLastTradeoff', what: '役がないので、リーチしないとロンできない手です。',
        why: `${depo}ダマでツモあがりを待つ考え方もあります。`, lesson: '' } };
    }
    return null;
  }

  function foldAdvice(game, me) {
    const threats = riichiPlayers(game, me);
    if (!threats.length) return null;
    const sh = M.shantenAll(game.fullHand(me), game.setsNeeded(me));
    const safe = safestDiscard(game, me);
    const names = threats.map((p) => `${game.seatJa(p)}家`).join('と');
    const oya = threats.some((p) => game.isOya(p))
      ? '　しかもリーチしたのは親。振り込むと点数は1.5倍（満貫なら12000点）です。' : '';
    // オーラス：押すか降りるかは、着順で決める
    const al = game.isAllLast && game.isAllLast()
      ? { scores: game.scores, oya: game.oya, honba: game.honba, pot: game.riichiSticks, first: 0, target: 0, yame: false } : null;
    const risk = al ? allLastRisk(game, me, al, game.fullHand(me)) : null;
    if (risk && risk.ends) {
      const better = safe.tile != null ? { tile: safe.tile, label: `${M.tileName(safe.tile)}切り`,
        reason: safe.danger === 0 ? 'リーチした人が自分で捨てている牌なので、100%当たりません。' : 'いまの手牌でいちばん安全です。' } : null;
      if (risk.cur === 4) {
        return { level: 'ok', lines: [{ kind: 'push', what: `${names}がリーチ。あなたはオーラスのラス目です。`,
          why: `振り込んでも順位は下がりません。${risk.rise ? `あがれば${risk.riseRank}位に上がれる手なので、押しましょう。` : 'ラスを抜けるには、あがるしかありません。降りずに手を進めましょう。'}`,
          lesson: 'オーラスは「あがったら何位か」「振り込んだら何位か」で、押すか降りるかを決めます。' }] };
      }
      if (risk.cur === 1 && risk.high > 1) {
        return { level: sh >= 2 ? 'blunder' : 'miss', lines: [{ kind: 'fold', what: `${names}がリーチ。あなたはオーラスのトップ目です。`,
          why: `満貫を振り込むと${risk.high}位に落ちて終わります。${sh <= 0 ? 'テンパイでも、' : ''}危ない牌は止めて、安全な牌から切りましょう。流局でもトップで終われます。`,
          better, lesson: 'トップ目のオーラスは「あがる」より「振り込まない」が最優先です。' }] };
      }
      if ((risk.cur === 2 || risk.cur === 3) && risk.high > risk.cur && !risk.rise) {
        return { level: sh >= 2 ? 'blunder' : 'miss', lines: [{ kind: 'fold', what: `${names}がリーチ。あなたはオーラスの${risk.cur}位です。`,
          why: `この手では、あがっても順位は上がらず、満貫を振り込むと${risk.high}位に落ちて終わります。危ない牌は止めましょう。`,
          better, lesson: 'オーラスは「あがったら何位か」「振り込んだら何位か」で、押すか降りるかを決めます。' }] };
      }
      if (risk.rise && sh <= 0) {
        return { level: 'ok', lines: [{ kind: 'push', what: `${names}がリーチ。あなたはテンパイで、あがれば${risk.riseRank}位に上がれます。`,
          why: '順位が上がる手なら、押す価値があります。', lesson: '' }] };
      }
    }

    if (sh <= 0) {
      return {
        level: 'ok',
        lines: [{
          kind: 'push',
          what: `${names}がリーチしていますが、あなたもテンパイです。`,
          why: 'テンパイしているなら、押して構いません。降りてもアガリの権利を捨てるだけです。',
          lesson: '「リーチが来たら降りる」は、自分の手が遠いときの話です。テンパイなら押す。',
        }],
      };
    }
    if (sh === 1) {
      return {
        level: 'miss',
        lines: [{
          kind: 'push',
          what: `${names}がリーチ。あなたはあと1枚でテンパイです。`,
          why: '微妙な場面です。危ない牌を切ってまで進めるかどうか、ここは人によって判断が分かれます。' + oya,
          lesson: `迷ったら降りて構いません。いちばん安全なのは${M.tileName(safe.tile)}です。`,
        }],
      };
    }
    return {
      level: 'blunder',
      lines: [{
        kind: 'fold',
        what: `${names}がリーチ。あなたの手はテンパイまであと${sh}枚です。ここは降りる場面です。`,
        why: '手が遠いのに押すと、あがれないうえに振り込みます。麻雀でいちばん大きな損はこれです。' + oya,
        better: { tile: safe.tile, label: `${M.tileName(safe.tile)}切り`,
          reason: safe.danger === 0 ? 'リーチした人が自分で捨てている牌なので、100%当たりません。' : 'いまの手牌でいちばん安全です。' },
        lesson: '麻雀は4人で1人しかあがれません。「あがる技術」と同じくらい「振り込まない技術」が効きます。',
      }],
    };
  }

  /** 切った後の講評。押し引きがあるときはそちらを優先する */
  function reviewDiscard4(game, me, tile) {
    const threats = riichiPlayers(game, me);
    const lines = [];
    let level = 'ok';

    if (threats.length) {
      const d = Math.max(...threats.map((p) => danger(game, tile, p)));
      const sh = M.shantenAll(M.sortTiles(game.hands[me]), game.setsNeeded(me));
      const safe = safestDiscard(game, me);
      if (d === 0) {
        lines.push({
          kind: 'safe',
          what: `${M.tileName(tile)}は現物です。100%当たりません。`,
          why: '自分が捨てた牌ではロンできない（フリテン）ので、リーチした人の捨て牌は完全に安全です。',
          lesson: '降りるときは、まずリーチした人の捨て牌の中から探します。',
        });
      } else if (sh >= 2 && safe.tile != null && safe.danger < d && (d >= 9 || d - safe.danger >= 3)) {
        // 手が遠い（降りる場面）のに、もっと安全な牌があった
        level = d >= 9 ? 'blunder' : 'miss';
        lines.push({
          kind: 'push',
          what: d >= 9
            ? `${M.tileName(tile)}は危ない牌です。しかも手はテンパイまであと${sh}枚です。`
            : `${M.tileName(tile)}より安全な牌がありました。手はテンパイまであと${sh}枚で、降りる場面です。`,
          why: d >= 9
            ? '手が遠いのに危険牌を押すのは、いちばん損な打ち方です。あがれないうえに振り込みます。'
            : '降りるときは、いちばん安全な牌から順に切ります。少しでも当たる可能性のある牌は、あとに回します。',
          better: { tile: safe.tile, label: `${M.tileName(safe.tile)}切り`,
            reason: safe.danger === 0 ? '現物なので100%安全です。' : 'いまの手牌でいちばん安全です。' },
          lesson: '手が遠い（テンパイまであと2枚以上）＋ リーチが入っている ＝ 降りる。この条件だけ覚えてください。',
        });
      } else if (sh >= 2) {
        // 降りる場面で、安全な牌（またはそれに近い牌）を選べている
        lines.push({
          kind: 'safe',
          what: safe.danger < d ? `${M.tileName(tile)}は、比較的安全な牌です。` : `${M.tileName(tile)}は、いまの手でいちばん安全な牌です。`,
          why: '手が遠いので降りる場面です。現物がないときは、スジの牌や、場に見えている字牌から切ります。',
          lesson: '',
        });
      } else if (sh === 1 && d >= 9 && safe.tile != null && safe.danger < d) {
        level = 'miss';
        const n = Number(tile[1]);
        const half = threats.some((q) => sujiOf(tile, genbutsu(game, q)) === 'half');
        lines.push({
          kind: 'push',
          what: `${M.tileName(tile)}は危険度の高い牌です。`,
          why: (half ? '片スジ（片側だけスジが通っている）なので、もう片側の両面には当たります。' : n === 2 || n === 8
            ? '2と8は、3〜7の次に当たりやすい牌です。'
            : '3〜7の牌は、両面待ちの両側になりやすく、いちばん当たりやすい牌です。')
            + '手はあと1枚でテンパイなので、押すか降りるかは判断が分かれる場面です。押すなら、承知のうえで。',
          better: safe.tile != null && safe.danger < d ? { tile: safe.tile, label: `${M.tileName(safe.tile)}切り`,
            reason: safe.danger === 0 ? '降りるなら、現物なので100%安全です。' : '降りるなら、いまの手牌でいちばん安全です。' } : null,
          lesson: '危ない順は、3〜7 → 2と8 → 1と9 → 字牌 → 現物。',
        });
      }
      // テンパイしているなら押してよい（受け入れ・ドラの講評に任せる）
    }
    return { level, lines };
  }

  /**
   * 1打ぶんの講評をまとめる：押し引き → 受け入れ → ドラ・役。4人打ちの対局と、牌譜の振り返りで同じものを使う。
   * game は切った「後」の状態。o.seen：見えている牌（受け入れの残り枚数を数える）、o.banned：喰い替えで切れなかった牌。
   * リーチに対して、受け入れの広い牌より安全な牌で手を進めた（回し打ち）なら、受け入れやドラの損は問わない
   */
  function reviewTurn(game, me, before, tile, o = {}) {
    const sets = game.setsNeeded(me);
    // オーラスなら、押し引きを着順で見直す（o.allLast：牌譜の振り返りから渡す。4人打ちの対局は game から作る）
    const al = o.allLast !== undefined ? o.allLast : (game.isAllLast && game.isAllLast()
      ? { scores: game.scores, oya: game.oya, honba: game.honba, pot: game.riichiSticks, first: 0, target: 0, yame: false, unit: '位' } : null);
    const raw = reviewDiscard4(game, me, tile);
    const { review, note } = al ? allLastPush(game, me, tile, raw, al) : { review: raw, note: null };
    const withNote = (rv) => (note ? { ...rv, lines: [note, ...rv.lines] } : rv);
    if (review.lines.length) return withNote(review);
    // 勧めない牌：喰い替えで切れない牌と、2枚以上持っている役牌（ポンや雀頭で役になる大事な牌）
    const yakuhai = ['z5', 'z6', 'z7', game.seatWind(me), game.roundWind()];
    const cnt = M.toCounts(before);
    const keep = yakuhai.filter((t) => cnt[M.toIndex(t)] >= 2);
    const exclude = new Set([...[...(o.banned || [])].map(M.norm), ...keep]);   // banned は配列でも Set でもよい
    const threats = riichiPlayers(game, me);
    const dz = (t) => (threats.length ? Math.max(...threats.map((p) => danger(game, t, p))) : 0);
    const safer = (alt) => threats.length && alt && dz(tile) < dz(alt);
    // リーチはしていないが、たくさん鳴いて手を進めている相手（テンパイが近い）
    const open = [0, 1, 2, 3].filter((p) => p !== me && !game.riichi[p] && game.melds?.[p]
      && (game.melds[p].length >= 3 || (game.melds[p].length >= 2 && (game.discards[p] || []).length >= 6)));
    let base = NS_COACH.explainDiscard(before, tile, sets, o.seen || [], exclude.size ? exclude : null);
    if (base.level !== 'ok' && base.best && safer(base.best.tile)) {
      base = { ...base, level: 'ok', lines: [{ kind: 'good',
        what: `${M.tileName(tile)}は、受け入れの広い${M.tileName(base.best.tile)}より安全な牌です。`,
        why: 'リーチに対して、安全な牌を使いながら手を進める「回し打ち」です。受け入れが少し狭くなるのは、安全のための代金です。',
        lesson: '' }] };
    } else if (base.level !== 'ok' && open.length) {
      base = { ...base, level: 'ok', lines: [{ kind: 'good',
        what: `${open.map((p) => `${game.seatJa(p)}家`).join('と')}がたくさん鳴いて、テンパイが近そうな場面です。受け入れより守りを優先した切り方として、受け入れの損は問いません。`,
        why: '鳴いている人の捨て牌の近くの牌や、まだ場に見えていない役牌は、当たりやすい牌です。',
        lesson: '' }] };
    }
    // 1枚だけの役牌を残して受け入れを狭めた：考え方としてはあるので、そのことも添える
    const eff = base.lines.find((l) => (l.kind === 'narrow' || l.kind === 'shanten') && l.better?.tile);
    if (eff && yakuhai.includes(M.norm(eff.better.tile)) && cnt[M.toIndex(eff.better.tile)] === 1) {
      base = { ...base, lines: base.lines.map((l) => (l === eff ? { ...l, why: `${l.why}（役牌を1枚残しておく考え方もありますが、受け入れの差が大きいので、先に切るのが基本です。）` } : l)) };
    }
    const val = valueReview(game, me, before, tile);
    const vlines = val.lines.filter((l) => !(l.better?.tile && (exclude.has(M.norm(l.better.tile)) || safer(l.better.tile)))
      && !(open.length && l.sub === 'dora'));
    if (!vlines.length) return withNote(base);
    const worse = (a, b) => (a === 'blunder' || b === 'blunder' ? 'blunder' : a === 'miss' || b === 'miss' ? 'miss' : 'ok');
    return withNote({ ...base, level: worse(base.level, val.level), lines: [...vlines, ...base.lines.filter((l) => l.kind !== 'good')] });
  }

  /**
   * 受け入れの枚数だけでは分からない損を見る。
   *  ・受け入れがほぼ同じなのにドラ（赤5）を切った
   *  ・鳴いた手で、役のないテンパイに取った（あがれない）
   * before は切る前の手牌（ツモ牌を含む）。
   */
  function valueReview(game, me, before, tile) {
    const sets = game.setsNeeded(me);
    const table = ukeire(before, sets);
    const mine = table.find((r) => r.tile === tile);
    const out = { level: 'ok', lines: [] };
    if (!mine) return out;
    const doras = new Set(game.doraTiles());
    const isDora = (t) => doras.has(M.norm(t)) || M.isRed(t);
    if (isDora(tile)) {
      const alt = table.find((r) => r.shanten === mine.shanten && r.tiles >= mine.tiles - 2 && !isDora(r.tile));
      if (alt) {
        out.level = 'miss';
        out.lines.push({
          kind: 'value', sub: 'dora',
          what: `${M.tileName(tile)}は${M.isRed(tile) ? '赤ドラ' : 'ドラ'}です。受け入れがほぼ同じなら、ドラは残しましょう。`,
          why: `${M.tileName(alt.tile)}切りでも受け入れは${alt.tiles}枚（${M.tileName(tile)}切りは${mine.tiles}枚）。ドラは1枚で1翻、あがったときの点数が大きく変わります。`,
          better: { tile: alt.tile, label: `${M.tileName(alt.tile)}切り`, reason: '受け入れをほとんど減らさずに、ドラを残せます。' },
          lesson: '受け入れの差が2枚以内なら、ドラ・赤5・役になる牌を残す方を選びます。',
        });
      }
    }
    if (mine.shanten === 0 && !game.isMenzen(me)) {
      const without = (t) => { const r = [...before]; r.splice(r.indexOf(t), 1); return r; };
      const hasYaku = (rest) => M.waits(M.sortTiles(rest), sets).some((w) => M.judgeYaku(M.sortTiles([...rest.map(M.norm), w]), {
        menzen: false, tsumo: false, seatWind: game.seatWind(me), roundWind: game.roundWind(), winTile: w, melds: game.meldsFor(me),
      }).length > 0);
      if (!hasYaku(without(tile))) {
        const alt = table.filter((r) => r.shanten === 0 && r.tile !== tile).find((r) => hasYaku(without(r.tile)));
        out.level = alt ? 'blunder' : (out.level === 'ok' ? 'miss' : out.level);
        out.lines.unshift({
          kind: 'value', sub: 'yaku',
          what: '鳴いているのに、役のないテンパイです。このままではあがれません。',
          why: alt ? `${M.tileName(alt.tile)}を切れば、役のあるテンパイになりました。`
            : '鳴いた手はリーチで役をつけられません。役牌やタンヤオなど、役を確保してから鳴きます。',
          better: alt ? { tile: alt.tile, label: `${M.tileName(alt.tile)}切り`, reason: '役のあるテンパイです。' } : null,
          lesson: '鳴く前に「この手の役は何か」を決めておきます。',
        });
      }
    }
    return out;
  }

  return { valueReview, genbutsu, sujiOf, seenCounts, riichiAdvice, callAdvice, danger, riichiPlayers, shouldFold, safestDiscard, cpuTurn, cpuCall, foldAdvice, reviewDiscard4, reviewTurn, yakuPaths, nakiReason, lateYakuhai, toitoiShanten, visibleCounts, placeAfterWin, allLastRisk, allLastPush, allLastRiichi, allLastRiichiLine };
})();

// ── js/core/play.js ─────────────────────────────────────────
const NS_PLAY = (() => {
  const { sfx } = NS_AUDIO;
  const K = NS_COACH;
  const { checkGoals, GOALS } = NS_GOALS;
  const { settings, DETAILS, TEXT_SIZES } = NS_SETTINGS;
  const { store } = NS_STORE;
  const CH = NS_CHESS, SH = NS_SHOGI, MJ = NS_MAHJONG;

  // ───────────────────────────────────────────────
  // 対局をまたいで強くなるための道具
  // ───────────────────────────────────────────────

  /** 1局ぶんの講評の種類を数え、終わったら記録する（弱点の集計に使う） */
  function makeTally(game) {
    let kinds = {}, moves = 0, saved = false;
    return {
      /** 講評1回ぶん。良い手・レッスンの狙いの指摘は数えない */
      add(rv) {
        moves++;
        if (!rv) return;
        for (const k of new Set(rv.lines.map((l) => l.kind))) {
          if (!k || k === 'good' || k === 'goal' || k === 'safe' || k === 'ron' || k === 'call' || k === 'tip') continue;
          if (rv.level === 'ok' && k !== 'threat') continue;
          kinds[k] = (kinds[k] || 0) + 1;
        }
      },
      bump(k) { moves++; kinds[k] = (kinds[k] || 0) + 1; },
      /** 対局が終わったとき（途中でやめたときも）に1回だけ記録する */
      flush() {
        if (saved || !moves) return;
        saved = true;
        try { store.recordGame(game, kinds); } catch { /* 記録に失敗しても対局は続ける */ }
      },
      get moves() { return moves; },
      /** この局でコーチが指摘した種類と回数 */
      counts() { return { ...kinds }; },
    };
  }

  const today = () => { const d = new Date(); return `${d.getMonth() + 1}/${d.getDate()}`; };
  const MISTAKE_PROMPT = {
    missedmate: '実戦のこの局面には<strong>詰み</strong>がありました。詰ませる初手を指してください。',
    missed: '実戦のこの局面には<strong>得をする手</strong>がありました。見つけてください。',
    allowmate: '実戦ではここで、相手に詰まされる手を指しました。<strong>詰まされない手</strong>を指してください。',
    deepmiss: '実戦のこの局面には、<strong>駒得になる手</strong>がありました。見つけてください。',
    slow: '実戦のこの局面には<strong>必至</strong>（相手がどう受けても次に詰む手）がありました。王手をせずに、必至をかけてください。',
    stalemate: '実戦ではここでステイルメイトにして、勝ちを逃しました。<strong>ステイルメイトにならない手</strong>を指してください。',
    default: '実戦ではここで損をしました。<strong>損をしない手</strong>を指してください。',
  };

  /**
   * 悪手の局面を「次の一手」の問題にして保存する。
   * base には盤（chess: board/w/h/castle、shogi: state/shape）を入れる。同じ局面はくり返し保存しない。
   */
  function saveMoveMistake(game, rv, base, played, extra = {}) {
    const l = rv.lines.find((x) => x.kind && !['good', 'goal', 'tip'].includes(x.kind));
    if (!l || rv.level === 'ok' || l.kind === 'threat' || l.kind === 'nopromo') return;
    // 解けない問題は作らない：代わりの手が見つかっていない「取られる」、どう指しても詰まされる局面
    if (l.kind === 'hang' && !l.better) return;
    if (extra.unsolvable) return;
    delete extra.unsolvable;
    // コーチが「こうすれば」で示した手は、必ず正解として受け付ける
    if (l.better && l.better.to && !extra.answers) {
      extra.alsoAccept = [{ from: l.better.from || null, to: l.better.to, drop: l.better.drop || null }];
    }
    const sig = JSON.stringify(base.board || base.state);
    if (store.pendingMistakes(game).some((m) => JSON.stringify(m.step.board || m.step.state) === sig)) return;
    const E = game === 'chess' ? ((x) => x) : ((x) => `${x[0]}${'一二三四五六七八九'[Number(x[1]) - 1]}`);
    const label = played.drop ? `${E(played.to)}に${SH.PIECE_JA[played.drop]}を打つ手` : `${E(played.from)}→${E(played.to)}`;
    const step = {
      type: 'bestmove', coords: true, ...base, deep: true,
      avoid: { from: played.from || null, to: played.to, drop: played.drop || null },
      prompt: MISTAKE_PROMPT[l.kind] || MISTAKE_PROMPT.default,
      note: `実戦では ${label} と指しました。`,
      why: `${l.what}${l.better ? `<br>こうすれば：${l.better.label}${l.better.reason ? ` — ${l.better.reason}` : ''}` : ''}`,
      hint: l.lesson || '',
      ...extra,
    };
    try { store.addMistake(game, l.kind, step, `${today()}の対局`); } catch { }
  }

  /**
   * 放銃した場面を「この中からいちばん安全な牌を選ぶ」問題にして残す。
   * リーチなど、危険が見えていた場面だけを問題にする（読みようがない放銃は出さない）。
   */
  function saveDealInMistake(discards, hand, tile, o = {}) {
    const disc = [...discards];
    if (disc.length < 4) return;
    const pool = [...new Set(hand.map(MJ.norm))].filter((t) => t !== MJ.norm(tile));
    for (let k = pool.length - 1; k > 0; k--) { const j = (Math.random() * (k + 1)) | 0; [pool[k], pool[j]] = [pool[j], pool[k]]; }
    const cands = MJ.sortTiles([MJ.norm(tile), ...pool.slice(0, 4)]);
    // 現物が1枚もないと「いちばん安全」が分かりにくいので、相手の捨て牌から1枚足す
    if (!cands.some((t) => disc.includes(t))) cands.push(disc[disc.length - 1]);
    const sig = disc.join() + '/' + cands.join();
    if (store.pendingMistakes('mahjong').some((m) => (m.step.discards || []).join() + '/' + (m.step.candidates || []).join() === sig)) return;
    try {
      store.addMistake('mahjong', o.kind || 'dealin', {
        type: 'safetile', discards: disc, candidates: MJ.sortTiles(cands),
        prompt: o.prompt || `実戦でこの場面から<strong>${MJ.tileName(tile)}</strong>を切って放銃しました。下がリーチした人の捨て牌です。この中から<strong>いちばん安全な牌</strong>を選んでください。`,
      }, o.src || `${today()}の対局`);
    } catch { }
  }

  /** 何切るの悪手を問題にして保存する（受け入れで損した切り方だけ） */
  function saveDiscardMistake(rv, hand, sets, src = null) {
    const l = rv.lines[0];
    if (!l || rv.level === 'ok' || !['shanten', 'narrow'].includes(l.kind)) return;
    const tiles = MJ.sortTiles(hand);
    if (tiles.length !== sets * 3 + 2) return;
    const sig = tiles.join();
    if (store.pendingMistakes('mahjong').some((m) => (m.step.tiles || []).join() === sig)) return;
    try {
      store.addMistake('mahjong', l.kind, {
        type: 'discard', sets, strict: true, tiles,
        prompt: '実戦でこの手から<strong>受け入れを損する牌</strong>を切りました。いちばん広く受ける牌を切ってください。',
        why: l.better ? `${l.better.label}：${l.better.reason}` : '',
        hint: l.lesson || '',
      }, src || `${today()}の対局`);
    } catch { }
  }

  /** アガリを見逃した手を「アガリ牌を全部選ぶ」問題にして残す。hand はアガリ牌を除いた手の中の牌 */
  function saveWinMissMistake(hand, sets, tile, o = {}) {
    const tiles = MJ.sortTiles(hand);
    if (tiles.length !== sets * 3 + 1 || !MJ.waits(tiles, sets).length) return;
    const sig = tiles.join();
    if (store.pendingMistakes('mahjong').some((m) => m.step.type === 'waits' && (m.step.tiles || []).join() === sig)) return;
    try {
      store.addMistake('mahjong', 'agarimiss', {
        type: 'waits', sets, tiles,
        prompt: `実戦ではこの手で<strong>${MJ.tileName(tile)}</strong>${o.tsumo ? 'をツモった' : 'が出た'}のに、あがりませんでした。この手のアガリ牌を<strong>全部</strong>選んでください。${sets < 4 ? '（鳴いた組は省いています）' : ''}`,
        why: o.why || '',
      }, o.src || `${today()}の対局`);
    } catch { }
  }

  /**
   * 相手の狙いを、答えを言う前に考えさせる。
   * 1回目の間違いではヒント（相手の直前の手に印）、2回目か「わからない」で答えを見せる。
   */
  function makeThreatQuiz({ status, paint, say = null }) {
    let q = null;
    const box = el('div', 'actions quizbox');
    const end = () => { q = null; box.remove(); };
    const reveal = () => {
      if (!q) return;
      status.textContent = q.th.text;
      paint(q.th.marks);
      say?.({ text: q.th.kind === 'mate' ? 'ここが相手の狙いです。詰まされないように受けましょう。' : '狙われているのはこの駒です。逃げるか、守るか、考えてみましょう。', mood: 'think' });
      end();
    };
    return {
      get active() { return !!q; },
      start(th, lastMarks) {
        q = { th, lastMarks, tries: 0 };
        status.textContent = th.kind === 'mate'
          ? '考えてみよう：相手には次に詰ませる狙いがあります。相手の駒が入ってくるマスをタップしてください。'
          : '考えてみよう：相手には次に駒を取る狙いがあります。狙われている自分の駒をタップしてください。';
        say?.(th.kind === 'mate'
          ? { text: 'ちょっと待って！ 相手は次に詰ませる狙いがあります。相手の駒が入ってくるマスはどこかな？', mood: 'alert' }
          : { text: pickOne(['ちょっと待って！ 狙われている駒があります。どれだか分かるかな？', '相手の狙いに気づけるかな？ 狙われている自分の駒をタップしてみて。']), mood: 'alert' });
        box.innerHTML = '';
        const b = el('button', 'btn btn--ghost btn--sm', 'わからない（答えを見る）');
        b.addEventListener('click', reveal);
        box.appendChild(b);
        status.after(box);
      },
      pick(sq) {
        if (!q) return false;
        q.tries++;
        if (q.th.answers.includes(sq)) {
          sfx.correct();
          status.textContent = `正解です。${q.th.text.replace(/^注意：/, '')}`;
          paint(q.th.marks);
          say?.({ text: pickOne(['そのとおり！ 相手の狙いを見抜けました。守る手を考えましょう。', '正解！ よく気づきました。次は、守るか逃げるかです。']), mood: 'happy' });
          end();
        } else if (q.tries === 1) {
          sfx.wrong();
          status.textContent = 'ちがいます。ヒント：相手が直前に動かした駒（印のあるマス）から、どこへ届くかをたどってみてください。';
          paint({ ...q.lastMarks, [sq]: 'ng' });
        } else {
          sfx.wrong();
          reveal();
        }
        return true;
      },
      clear: end,
    };
  }

  /**
   * 相手の応手を1手だけ予想する練習。自分が指したあと、相手が動かす駒の行き先を当てる。
   * ask() で聞き、settle(実際の手) で答え合わせの文章を返す。
   */
  function makePredictDrill({ status, label, game }) {
    const box = el('div', 'actions quizbox');
    let pending = null, hits = 0, asks = 0;
    return {
      get active() { return !!pending; },
      /** 何手かに1回だけ聞く。聞いたら true（相手の手はまだ指さない） */
      ask(nth, onSkip) {
        if (settings.get('predict') === false) return false;
        if (nth % 3 !== 0) return false;
        pending = {};
        status.textContent = '予想してみよう：相手はどう応じると思いますか？ 相手の駒が動く先のマスをタップしてください。';
        box.innerHTML = '';
        const b = el('button', 'btn btn--ghost btn--sm', 'わからない（相手の手を見る）');
        b.addEventListener('click', () => { pending = null; box.remove(); onSkip(); });
        box.appendChild(b);
        status.after(box);
        return true;
      },
      /** マスが選ばれたとき。true を返したら、呼び出し側は相手の手を指す */
      pick(sq, onGo) {
        if (!pending) return false;
        pending.guess = sq;
        box.remove();
        status.textContent = '相手の手を見てみましょう…';
        onGo();
        return true;
      },
      /** 相手が指したあとの答え合わせ。文章（なければ null）を返す */
      settle(mv) {
        if (!pending) return null;
        const guess = pending.guess;
        pending = null;
        if (!guess) return null;
        asks++;
        const hit = guess === mv.to;
        if (hit) { hits++; sfx.correct(); } else sfx.wrong();
        try { store.recordPredict(game, hit); } catch { /* 記録に失敗しても対局は続ける */ }
        return hit
          ? `予想が当たりました（的中 ${hits}/${asks}）。相手の手が読めています。`
          : `予想は外れました。相手は${label(mv)}と指しました（的中 ${hits}/${asks}）。`;
      },
      clear() { pending = null; box.remove(); },
    };
  }

  /** チェスの棋譜を PGN にする。frames は showKifu と同じ形（pos と mv を持つ） */
  /** 盤を FEN の配置部分にする（8×8のみ） */
  function fenOf(pos, turn) {
    const rows = [];
    for (let r = 8; r >= 1; r--) {
      let row = '', empty = 0;
      for (const f of 'abcdefgh') {
        const p = pos[f + r];
        if (!p) { empty++; continue; }
        if (empty) { row += empty; empty = 0; }
        row += p;
      }
      rows.push(row + (empty || ''));
    }
    // キャスリング権：キングとルークが初期位置にいるものだけ（途中局面から始める対局では権利を持たない）
    return `${rows.join('/')} ${turn || 'w'} - - 0 1`;
  }
  function toPGN(frames, opts, result, me = 'w') {
    const L = { K: 'K', Q: 'Q', R: 'R', B: 'B', N: 'N', P: '' };
    const body = [];
    for (let i = 1; i < frames.length; i++) {
      const f = frames[i], pre = frames[i - 1].pos, mv = f.mv;
      if (!mv) continue;
      const piece = mv.piece, kind = CH.kindOf(piece), color = CH.colorOf(piece);
      const foe = color === 'w' ? 'b' : 'w';
      let san;
      if (kind === 'K' && Math.abs(mv.from.charCodeAt(0) - mv.to.charCodeAt(0)) === 2) {
        san = mv.to[0] === 'g' ? 'O-O' : 'O-O-O';
      } else if (kind === 'P') {
        san = (mv.took ? `${mv.from[0]}x` : '') + mv.to + (mv.promo && mv.to[1] !== '1' && mv.to[1] !== '8' ? '' : mv.promo ? `=${mv.promo}` : '');
      } else {
        const others = CH.allLegalMoves(pre, color, opts)
          .filter((m) => m.to === mv.to && m.from !== mv.from && CH.kindOf(pre[m.from]) === kind);
        let dis = '';
        if (others.length) {
          dis = others.every((m) => m.from[0] !== mv.from[0]) ? mv.from[0]
            : others.every((m) => m.from[1] !== mv.from[1]) ? mv.from[1] : mv.from;
        }
        san = L[kind] + dis + (mv.took ? 'x' : '') + mv.to;
      }
      const st = CH.gameStatus(f.pos, foe, opts);
      san += st === 'checkmate' ? '#' : CH.inCheck(f.pos, foe, opts) ? '+' : '';
      const firstBlack = (frames[0]?.turn || 'w') === 'b';
      const n = Math.floor((i - 1 + (firstBlack ? 1 : 0)) / 2) + 1;
      body.push(color === 'w' ? `${n}. ${san}` : (i === 1 ? `${n}... ${san}` : san));
    }
    const d = new Date();
    const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    // result は「自分から見た」結果。'lose:limit'（手数切れ）はチェスの勝敗ではないので未決着
    const meWins = me === 'w' ? '1-0' : '0-1', meLoses = me === 'w' ? '0-1' : '1-0';
    const res = result === 'win' ? meWins : result === 'lose' ? meLoses
      : String(result || '').startsWith('draw') ? '1/2-1/2' : '*';
    const tags = [`[Event "盤戯"]`, `[Site "?"]`, `[Date "${date}"]`, `[Round "-"]`,
      `[White "${me === 'w' ? 'あなた' : 'コンピュータ'}"]`, `[Black "${me === 'w' ? 'コンピュータ' : 'あなた'}"]`, `[Result "${res}"]`];
    const w = opts?.w ?? 8, h = opts?.h ?? 8;
    const start = frames[0]?.pos || {};
    const isStd = w === 8 && h === 8 && Object.keys(start).length === Object.keys(CH.START_POSITION).length
      && Object.entries(CH.START_POSITION).every(([k, v]) => start[k] === v);
    if (w !== 8 || h !== 8) tags.push(`[Variant "${w}x${h}"]`, '[Annotator "※小さい盤の対局です。通常のチェスソフトでは読み込めません"]');
    else if (!isStd) tags.push('[SetUp "1"]', `[FEN "${fenOf(start, frames[0]?.turn)}"]`);
    return [...tags, '', `${body.join(' ')} ${res}`].join('\n');
  }

  /** 将棋の棋譜を KIF にする */
  function toKIF(frames, result, sh = SH.BIG, { handicap = null } = {}) {
    const Z = '０１２３４５６７８９', KAN = '〇一二三四五六七八九';
    const NAME = { P: '歩', L: '香', N: '桂', S: '銀', G: '金', B: '角', R: '飛', K: '玉',
      '+P': 'と', '+L': '成香', '+N': '成桂', '+S': '成銀', '+B': '馬', '+R': '龍' };   // KIF の決まりでは「龍」
    const sq = (x) => `${Z[Number(x[0])]}${KAN[Number(x[1])]}`;
    const lines = [];
    for (let i = 1; i < frames.length; i++) {
      const f = frames[i], mv = f.mv;
      if (!mv) continue;
      const base = SH.baseOf(mv.piece || 'P');
      const kind = mv.drop ? mv.drop : (SH.isPromoted(mv.piece) ? `+${base}` : base);
      const txt = mv.drop
        ? `${sq(mv.to)}${NAME[mv.drop] || ''}打`
        : `${sq(mv.to)}${NAME[kind] || ''}${mv.promote ? '成' : SH.canPromote(mv.piece, mv.from, mv.to, sh) ? '不成' : ''}(${mv.from})`;
      lines.push(`${String(i).padStart(4)} ${txt}`);
    }
    const d = new Date();
    return ['# KIF形式棋譜ファイル（盤戯）',
      `開始日時：${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`,
      ...(handicap && handicap !== '平手' ? [`手合割：${handicap}`, '下手：あなた', '上手：コンピュータ'] : ['手合割：平手', '先手：あなた', '後手：コンピュータ']),
      '手数----指手---------消費時間--', ...lines,
      result === 'win' ? `${String(frames.length).padStart(4)} 投了` : ''].filter(Boolean).join('\n');
  }

  /** 形勢グラフ（SVG）。vals は開始局面からの評価（プレイヤー側から見て＋が有利） */
  function graphSVG(vals, at, drops, unit) {
    const W = 300, H = 84, M = 10 * unit, n = vals.length;
    const x = (i) => (n <= 1 ? 0 : (i / (n - 1)) * W);
    const y = (v) => H / 2 - (Math.max(-M, Math.min(M, v)) / M) * (H / 2 - 6);
    const pts = vals.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
    const area = pts.length ? `${line}L${pts[pts.length - 1][0].toFixed(1)},${H / 2}L${pts[0][0].toFixed(1)},${H / 2}Z` : '';
    const dots = drops.filter((i) => vals[i] != null)
      .map((i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(vals[i]).toFixed(1)}" r="4.5" fill="#c2453a"/>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <rect x="0" y="0" width="${W}" height="${H / 2}" fill="color-mix(in srgb, var(--tone) 7%, transparent)"/>
      <line x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}" stroke="#b9b3a2" stroke-width="1"/>
      ${area ? `<path d="${area}" fill="color-mix(in srgb, var(--tone) 22%, transparent)"/>` : ''}
      ${line ? `<path d="${line}" fill="none" stroke="var(--tone)" stroke-width="2" vector-effect="non-scaling-stroke"/>` : ''}
      <line x1="${x(at).toFixed(1)}" y1="0" x2="${x(at).toFixed(1)}" y2="${H}" stroke="#232a2e" stroke-width="1" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>
      ${dots}
    </svg>`;
  }

  /**
   * 麻雀の振り返り：1局の中で気になった切り方を最大3つ。タップすると、その時の手牌と正解の牌を見せる。
   * items: [{ n, hand, tile, better, level, line }]
   */
  function showMjRecap(box, items, renderTiles, onReplay = null) {
    box.innerHTML = '';
    if (!items.length) {
      box.appendChild(el('p', 'recap__note', '振り返り：この局では、コーチが指摘した切り方はありませんでした。'));
      return;
    }
    const rank = (x) => (x.level === 'blunder' ? 0 : 1);
    const top = [...items].sort((a, b) => rank(a) - rank(b) || a.n - b.n).slice(0, 3).sort((a, b) => a.n - b.n);
    box.appendChild(el('p', 'recap__note', `振り返り：この局で気になった切り方（${top.length}つ）。タップすると、その時の手牌を出します。`));
    const view = el('div');
    const note = el('p', 'recap__note');
    for (const it of top) {
      const b = el('button', 'btn btn--ghost btn--sm recap__item', `${it.n}巡目：${it.line.what}`);
      b.addEventListener('click', () => {
        const states = {};
        it.hand.forEach((t, i) => {
          if (t === it.tile && !Object.values(states).includes('ng')) states[i] = 'ng';
          else if (it.better && t === it.better && !Object.values(states).includes('ok')) states[i] = 'ok';
        });
        renderTiles(view, it.hand, { states, disabled: true, tight: true });
        note.innerHTML = `${it.line.why || ''}${it.line.better ? `<br>こうすれば：${it.line.better.label}${it.line.better.reason ? ` — ${it.line.better.reason}` : ''}` : ''}`
          + `<br><span style="color:var(--ng)">■</span> 切った牌　${it.better ? '<span style="color:var(--ok)">■</span> こちらが良かった牌' : ''}`;
        if (onReplay && it.replay) {
          const rb = el('button', 'btn btn--ghost btn--sm recap__replay', it.replay.label || '▶ 読み筋を見る');
          rb.addEventListener('click', () => onReplay(it.replay, rb));
          note.appendChild(rb);
        }
      });
      box.appendChild(b);
    }
    box.append(view, note);
  }





  // play.js — レッスンの中で実際に1局指す／打つ。
  // 「小さいけれど完結した本物」を遊ばせるのがこのアプリの核なので、
  // 勝敗がつくところまでちゃんと動かす。

  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const readDetail = () => settings.get('coachDetail');

  /**
   * 対局中のコーチ欄。
   * 「何が起きたか／なぜ問題か／どうすればよかったか／次に気づくコツ」を、
   * 選んだ詳しさに応じて出す。指摘と同時に「やり直す」を出せるのがここの要点。
   */
  // ───────────────────────────────────────────────
  // 読み筋の再生：コーチの読んだ手順を、別の盤で1手ずつ動かして見せる（チェス・将棋）
  // ───────────────────────────────────────────────
  const SVGNS = 'http://www.w3.org/2000/svg';
  const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0');

  /** 取り合いが終わったあとの静かな手は見せない。最後の「取る・チェック（王手）・成り・詰み」までで切る */
  function trimQuiet(frames) {
    let lastEvent = Math.min(1, frames.length - 1);
    frames.forEach((f, i) => { if (i > 0 && (f.victimSq || f.check || f.promote || f.end)) lastEvent = i; });
    return frames.slice(0, lastEvent + 1);
  }

  /**
   * チェスの手順を再生用のコマにする。frames[0] は開始局面、frames[i] は i 手目のあと。
   * 合法でない手が来たらそこで止める（読みの手順と盤がずれないように、ここで確かめ直す）
   */
  function chessFrames(start, startOpts, firstTurn, moves, me, h) {
    const val = (b) => {
      let v = 0;
      for (const x of Object.values(b)) v += (CH.colorOf(x) === me ? 1 : -1) * CH.PIECE_VALUE[CH.kindOf(x)];
      return v;
    };
    const base = val(start);
    const frames = [{ pos: { ...start }, score: 0 }];
    let pos = { ...start }, o = { ...startOpts }, turn = firstTurn;
    for (const m of moves.slice(0, 8)) {
      const piece = pos[m.from];
      if (!piece || CH.colorOf(piece) !== turn || !CH.legalMoves(pos, m.from, o).includes(m.to)) break;
      const kind = CH.kindOf(piece);
      const ep = kind === 'P' && m.from[0] !== m.to[0] && !pos[m.to];
      const victimSq = ep ? m.to[0] + m.from[1] : m.to;
      const took = pos[victimSq] || null;
      const lastRank = CH.colorOf(piece) === 'w' ? String(h) : '1';
      const promo = kind === 'P' && m.to[1] === lastRank ? (m.promo || 'Q') : null;
      const castle = kind === 'K' && Math.abs(m.from.charCodeAt(0) - m.to.charCodeAt(0)) === 2;
      const next = CH.applyMove(pos, m.from, m.to, o, promo || 'Q');
      const nextOpts = CH.nextRights(o, pos, m.from, m.to);
      const foe = turn === 'w' ? 'b' : 'w';
      const st = CH.gameStatus(next, foe, nextOpts);
      const who = turn === me ? 'me' : 'foe';
      const cap = `${who === 'me' ? 'あなた' : '相手'}：${CH.PIECE_JA[kind]} ${m.from}→${m.to}`
        + (castle ? '（キャスリング）' : '')
        + (took ? `（${CH.PIECE_JA[CH.kindOf(took)]}を取る）` : '')
        + (promo ? `（${CH.PIECE_JA[promo]}に昇格）` : '')
        + (st === 'checkmate' ? '　チェックメイト' : st === 'check' ? '　チェック' : st === 'stalemate' ? '　ステイルメイト' : '');
      frames.push({
        pos: next, move: { from: m.from, to: m.to }, who, owner: turn, cap, score: val(next) - base,
        victimSq: took ? victimSq : null, check: st === 'check', promote: !!promo,
        rook: castle ? (m.to[0] === 'g' ? [`h${m.from[1]}`, `f${m.from[1]}`] : [`a${m.from[1]}`, `d${m.from[1]}`]) : null,
        end: st === 'checkmate' ? 'mate' : st === 'stalemate' ? 'stalemate' : null,
      });
      pos = next; o = nextOpts; turn = foe;
      if (st === 'checkmate' || st === 'stalemate') break;
    }
    return trimQuiet(frames);
  }

  /** 将棋の手順を再生用のコマにする（持ち駒も含む）。合法手でなければそこで止め、成り・不成も合法手にそろえる */
  function shogiFrames(start, moves, me, sh) {
    const val = (st) => {
      let v = 0;
      for (const x of Object.values(st.board)) v += (SH.colorOf(x) === me ? 1 : -1) * SH.PIECE_VALUE[SH.kindOf(x)];
      for (const [c, hand] of Object.entries(st.hands)) for (const [k, n] of Object.entries(hand)) v += (c === me ? 1 : -1) * SH.PIECE_VALUE[k] * n;
      return v;
    };
    const base = val(start);
    let st = { board: { ...start.board }, hands: SH.cloneHands(start.hands), turn: start.turn };
    const frames = [{ pos: { ...st.board }, hands: SH.cloneHands(st.hands), score: 0 }];
    for (const m of moves.slice(0, 8)) {
      const mv = SH.allLegalMoves(st, sh).find((x) => x.to === m.to && (x.from || null) === (m.from || null)
        && (x.drop || null) === (m.drop || null) && !!x.promote === !!m.promote);
      if (!mv) break;
      const took = !mv.drop && st.board[mv.to] ? st.board[mv.to] : null;
      const next = SH.applyMove(st, mv, sh);
      const status = SH.gameStatus(next, sh);
      const who = st.turn === me ? 'me' : 'foe';
      const cap = `${who === 'me' ? 'あなた' : '相手'}：${SH.moveLabel(st, mv, sh)}`
        + (took ? `（${SH.PIECE_JA[SH.kindOf(took)]}を取る）` : '')
        + (status === 'checkmate' ? '　詰み' : status === 'check' ? '　王手' : '');
      frames.push({
        pos: { ...next.board }, hands: SH.cloneHands(next.hands),
        move: { from: mv.from || null, to: mv.to, drop: mv.drop || null }, who, owner: st.turn, cap, score: val(next) - base,
        piece: mv.drop ? (st.turn === 'b' ? mv.drop : mv.drop.toLowerCase()) : st.board[mv.from],
        victimSq: took ? mv.to : null, captured: took, promote: !!mv.promote, check: status === 'check',
        end: status === 'checkmate' || status === 'stuck' ? 'mate' : null,
      });
      st = next;
      if (status === 'checkmate' || status === 'stuck') break;
    }
    return trimQuiet(frames);
  }

  /** 手順の終わりのひとこと */
  function replayOutro(frames, game = 'chess') {
    const f = frames[frames.length - 1];
    if (f.end === 'mate') {
      if (game === 'shogi') return f.who === 'me' ? '詰みまで進みます。' : 'この手順では、詰まされてしまいます。';
      return f.who === 'me' ? 'チェックメイトまで進みます。' : 'この手順では、チェックメイトされてしまいます。';
    }
    if (f.end === 'stalemate') return 'ステイルメイト（引き分け）になります。';
    return f.score === 0 ? 'この手順の終わりで、駒の損得は差し引き0です。'
      : `この手順の終わりで、駒の損得は ${signed(f.score)} です（指す前と比べて）。`;
  }

  /**
   * 読み筋の再生パネルの外枠：タブ・説明・コマ送り・閉じる。盤や牌をどう描き、どう動かすかは view にまかせる。
   * view = { nodes, init({ reduce }), draw(f, kk, frames), animate(f0, f1, alive), after?(f1), info(f), outro?(frames), stepName?(kk), preview?(...) }
   * 「動きを減らす」設定のときは animate を呼ばず、局面を切り替えるだけにする
   */
  function replayShell({ title = '読み筋', tone = 'chess', opener = null, view }) {
    const reduce = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const sheet = el('div', 'sheet');
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-label', title);
    const card = el('div', 'sheet__card replay');
    card.style.setProperty('--tone', `var(--${tone})`);
    card.tabIndex = -1;
    const tabs = el('div', 'replay__tabs');
    tabs.setAttribute('role', 'tablist');
    const lead = el('p', 'replay__lead', '読み筋を読んでいます…');
    const cap = el('p', 'replay__cap');
    cap.setAttribute('aria-live', 'polite');
    const score = el('p', 'replay__score');
    const nav = el('div', 'kifu__nav replay__nav');
    const mk = (label, aria, fn) => {
      const b = el('button', 'btn btn--ghost btn--sm', label);
      b.setAttribute('aria-label', aria);
      b.addEventListener('click', fn);
      nav.appendChild(b);
      return b;
    };
    const bFirst = mk('⏮', '最初の局面', () => { stop(); go(0); });
    const bPrev = mk('◀', '1手もどる', () => { stop(); go(k - 1); });
    const bPlay = mk('再生', '再生', () => (playing ? stop() : play()));
    const bNext = mk('▶', '1手すすむ', () => { stop(); stepForward(); });
    const count = el('span', 'kifu__count');
    nav.appendChild(count);
    const row = el('div', 'sheet__row');
    const bClose = el('button', 'btn', '閉じる');
    row.appendChild(bClose);
    card.append(el('h2', '', title), tabs, lead, ...view.nodes, cap, score, nav, row);
    sheet.appendChild(card);
    document.body.appendChild(sheet);
    view.init({ reduce });

    let lines = [], cur = 0, frames = [], k = 0, playing = false, seq = 0, playSeq = 0, closed = false;
    for (const b of [bFirst, bPrev, bPlay, bNext]) b.disabled = true;

    function draw(kk) {
      const f = frames[kk];
      if (!f) return;
      view.draw(f, kk, frames);
      const last = frames.length - 1;
      cap.textContent = kk === 0 ? (f.cap || '開始の局面です。') : view.stepName ? `${view.stepName(kk)}　${f.cap}` : f.cap;
      score.innerHTML = view.info(f);
      lead.textContent = kk === last && last > 0 ? (lines[cur]?.outro || view.outro?.(frames) || '') : (lines[cur]?.intro || '');
      count.textContent = `${kk} / ${last}`;
      bFirst.disabled = bPrev.disabled = kk === 0;
      bNext.disabled = kk >= last;
      bPlay.disabled = last === 0;
    }

    function go(n) {
      seq++;
      k = Math.max(0, Math.min(frames.length - 1, n));
      draw(k);
    }

    /** 1コマすすめる。動きを見せてから、次の局面を描く */
    async function stepForward() {
      if (k >= frames.length - 1) return false;
      const my = ++seq;
      const alive = () => my === seq && !closed;
      if (!reduce) {
        await view.animate(frames[k], frames[k + 1], alive);
        if (!alive()) return false;
      }
      k++;
      draw(k);
      if (!reduce) view.after?.(frames[k]);
      return true;
    }

    async function play() {
      if (k >= frames.length - 1) go(0);
      const my = ++playSeq;
      playing = true;
      bPlay.textContent = '止める';
      bPlay.setAttribute('aria-label', '一時停止');
      await wait(450);
      while (playing && my === playSeq && !closed) {
        if (!(await stepForward())) break;
        if (k >= frames.length - 1) break;
        await wait(reduce ? 1500 : 950);
      }
      if (my !== playSeq || closed) return;
      playing = false;
      bPlay.textContent = k >= frames.length - 1 ? 'もう一度' : '再生';
      bPlay.setAttribute('aria-label', bPlay.textContent);
    }

    function stop() {
      if (!playing) return;
      playing = false;
      playSeq++;
      bPlay.textContent = '再生';
      bPlay.setAttribute('aria-label', '再生');
      go(k);
    }

    function select(i) {
      playing = false; playSeq++;
      cur = i;
      frames = lines[i].frames;
      [...tabs.children].forEach((b, j) => {
        b.className = `btn btn--sm${j === i ? '' : ' btn--ghost'}`;
        b.setAttribute('aria-selected', String(j === i));
      });
      go(0);
      play();
    }

    function close() {
      if (closed) return;
      closed = true;
      playing = false; playSeq++; seq++;
      sheet.remove();
      for (const f of document.querySelectorAll('.replay__fly')) f.remove();
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('hashchange', close);
      opener?.focus?.();
    }

    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      // フォーカスをパネルの中にとどめる（持ち駒は押せないので飛ばす）
      const items = [...card.querySelectorAll('button:not(.hand__p)')].filter((x) => !x.disabled && x.offsetParent !== null);
      if (!items.length) return;
      const first = items[0], lastItem = items[items.length - 1], at = document.activeElement;
      if (e.shiftKey && (at === first || at === card || !card.contains(at))) { e.preventDefault(); lastItem.focus(); }
      else if (!e.shiftKey && (at === lastItem || !card.contains(at))) { e.preventDefault(); first.focus(); }
    };
    bClose.addEventListener('click', close);
    sheet.addEventListener('click', (e) => { if (e.target === sheet) close(); });
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('hashchange', close);
    card.focus();

    return {
      /** 読み終わるまで、開始の局面だけ出しておく */
      preview(...a) { if (!lines.length) view.preview?.(...a); },
      setLines(ls) {
        if (closed) return;
        lines = ls.filter((l) => l.frames.length > 1);
        if (!lines.length) { this.fail('見せられる読み筋がありませんでした。'); return; }
        tabs.innerHTML = '';
        lines.forEach((l, i) => {
          const b = el('button', 'btn btn--sm', l.label);
          b.setAttribute('role', 'tab');
          b.addEventListener('click', () => select(i));
          tabs.appendChild(b);
        });
        select(0);
      },
      fail(msg) {
        if (closed) return;
        lead.textContent = msg;
        for (const b of [bFirst, bPrev, bPlay, bNext]) b.disabled = true;
      },
      close,
    };
  }

  /**
   * 盤の読み筋（チェス・将棋）。盤は局面ごとに描き直し、動く駒だけを動かす。
   * 将棋では、持ち駒から打つ駒・取って持ち駒に入る駒を盤の外まで飛ばし、成る駒は裏返す
   */
  function boardView({ variant = 'chess', w = 8, h = 8, flipped = false, me = 'w' }) {
    const isShogi = variant === 'shogi';
    const boardHost = el('div', 'replay__board');
    const foeHand = isShogi ? el('div', 'hand') : null;
    const myHand = isShogi ? el('div', 'hand') : null;
    const foeColor = me === 'b' ? 'w' : 'b';
    let board = null, reduce = false;

    /** 持ち駒（将棋だけ）。再生用なので押せないようにしておく */
    function paintHands(hands) {
      if (!isShogi || !hands) return;
      NS_BOARD.renderHand(foeHand, hands[foeColor], { label: '相手の持ち駒', order: SH.HAND_ORDER });
      NS_BOARD.renderHand(myHand, hands[me], { label: 'あなたの持ち駒', order: SH.HAND_ORDER });
      for (const b of [...foeHand.querySelectorAll('.hand__p'), ...myHand.querySelectorAll('.hand__p')]) {
        b.tabIndex = -1;
        b.setAttribute('aria-disabled', 'true');
      }
    }
    const handOf = (color) => (color === me ? myHand : foeHand);
    const handItem = (color, kind) => handOf(color).querySelector(`.hand__p[data-k="${kind}"]`);

    /** 矢印（自分の手は青、相手の手は赤）。animate のときは線を伸ばして描く */
    function arrow(move, who, animate) {
      const svg = board.svg;
      if (!svg || !move?.from) return;
      const a = board.center(move.from), b = board.center(move.to);
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
      if (!len) return;
      const ux = dx / len, uy = dy / len;
      const sx = a.x + ux * 20, sy = a.y + uy * 20;
      const ex = b.x - ux * 34, ey = b.y - uy * 34;
      const tx = b.x - ux * 6, ty = b.y - uy * 6;
      const color = who === 'me' ? '#2f6fdb' : '#c2453a';
      const g = document.createElementNS(SVGNS, 'g');
      g.setAttribute('pointer-events', 'none');
      g.setAttribute('opacity', '.8');
      const line = document.createElementNS(SVGNS, 'path');
      line.setAttribute('d', `M${sx},${sy} L${ex},${ey}`);
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', '14');
      line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('fill', 'none');
      const head = document.createElementNS(SVGNS, 'path');
      head.setAttribute('d', `M${tx},${ty} L${ex - uy * 24},${ey + ux * 24} L${ex + uy * 24},${ey - ux * 24} Z`);
      head.setAttribute('fill', color);
      g.append(line, head);
      svg.appendChild(g);
      if (animate && !reduce && line.animate) {
        const L = Math.hypot(ex - sx, ey - sy);
        line.style.strokeDasharray = String(L);
        line.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 260, easing: 'ease-out' });
        head.animate([{ opacity: 0 }, { opacity: 0, offset: .8 }, { opacity: 1 }], { duration: 300 });
      }
    }

    /** 盤のマスの中心を、画面の座標に直す（持ち駒と盤のあいだで駒を飛ばすとき） */
    function screenOf(sq) {
      const c = board.center(sq), m = board.svg.getScreenCTM();
      return { x: m.a * c.x + m.c * c.y + m.e, y: m.b * c.x + m.d * c.y + m.f, size: Math.abs(m.a) * 100 };
    }
    const centerOf = (node) => {
      const r = node.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    /** 盤の外（持ち駒）と盤のあいだで駒を飛ばす。画面の上に一時的な駒を重ねて動かす */
    function fly(from, to, piece, size, { r0 = 0, r1 = 0, s0 = 1, s1 = 1, duration = 480 } = {}) {
      const d = el('div', 'replay__fly');
      d.style.left = `${from.x - size / 2}px`;
      d.style.top = `${from.y - size / 2}px`;
      d.style.width = d.style.height = `${size}px`;
      d.innerHTML = `<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">${board._piece(piece, 0, 0)}</svg>`;
      document.body.appendChild(d);
      if (!d.animate) { d.remove(); return Promise.resolve(); }
      return d.animate([
        { transform: `translate(0px, 0px) rotate(${r0}deg) scale(${s0})` },
        { transform: `translate(${to.x - from.x}px, ${to.y - from.y}px) rotate(${r1}deg) scale(${s1})` },
      ], { duration, easing: 'cubic-bezier(.4, .1, .3, 1)', fill: 'forwards' }).finished.catch(() => {}).then(() => d.remove());
    }
    /** 成る駒を裏返す（横につぶして、成った面で開く） */
    function flip(node, a, b, duration) {
      const pc = node?.querySelector('.pc');
      if (!pc?.animate) return Promise.resolve();
      pc.style.transformBox = 'fill-box';
      pc.style.transformOrigin = 'center';
      return pc.animate([{ transform: `scaleX(${a})` }, { transform: `scaleX(${b})` }],
        { duration, easing: 'ease-in-out', fill: 'forwards' }).finished.catch(() => {});
    }

    return {
      nodes: isShogi ? [foeHand, boardHost, myHand] : [boardHost],
      init(o) {
        reduce = o.reduce;
        board = new NS_BOARD.Board(boardHost, { variant, w, h, coords: true, flipped });
      },
      draw(f) {
        const marks = !f.move ? {} : f.move.from ? { [f.move.from]: 'last', [f.move.to]: 'last' } : { [f.move.to]: 'last' };
        board.setPosition(f.pos, marks);
        paintHands(f.hands);
        if (f.move) arrow(f.move, f.who, false);
      },
      stepName: (kk) => `${kk}手目`,
      // 将棋は取った駒が相手の持ち駒になるので、損得は盤の上と持ち駒の両方で数える
      info: (f) => `駒の損得（指す前と比べて${isShogi ? '・持ち駒も含む' : ''}）：<b data-s="${f.score > 0 ? 'up' : f.score < 0 ? 'down' : ''}">${signed(f.score)}</b>`,
      outro: (frames) => replayOutro(frames, variant),
      preview(pos, hands = null) { board.setPosition(pos, {}); paintHands(hands); },
      /** 1手ぶんの動き。駒を動かし（打つ駒は持ち駒から飛ばし）、取った駒を持ち駒へ送る */
      async animate(f0, f1, alive) {
        board.setPosition(f0.pos, {});
        paintHands(f0.hands);
        const svg = board.svg;
        let moving = null;
        if (f1.move.drop) {
          const src = handItem(f1.owner, f1.move.drop) || handOf(f1.owner);
          const from = centerOf(src);
          paintHands(f1.hands);   // 打った駒を持ち駒から減らしてから飛ばす
          const to = screenOf(f1.move.to);
          await fly(from, to, f1.piece, to.size, { s0: .55, s1: 1, duration: 520 });
        } else {
          arrow(f1.move, f1.who, true);
          const slide = (fromSq, toSq, delay) => {
            const pc = svg.querySelector(`[data-p="${fromSq}"]`);
            if (!pc?.animate) return null;
            svg.appendChild(pc);   // 動く駒は、ほかの駒より上に描く
            const a = board.center(fromSq), b = board.center(toSq);
            return pc.animate([{ transform: 'translate(0px, 0px)' }, { transform: `translate(${b.x - a.x}px, ${b.y - a.y}px)` }],
              { duration: 520, delay, easing: 'cubic-bezier(.3, .7, .35, 1)', fill: 'forwards' });
          };
          moving = svg.querySelector(`[data-p="${f1.move.from}"]`);
          const vic = f1.victimSq && svg.querySelector(`[data-p="${f1.victimSq}"]`);
          const anims = [slide(f1.move.from, f1.move.to, 140)];
          if (f1.rook) anims.push(slide(f1.rook[0], f1.rook[1], 260));
          if (vic?.animate && !isShogi) anims.push(vic.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, delay: 480, fill: 'forwards' }));
          await Promise.all(anims.filter(Boolean).map((x) => x.finished.catch(() => {})));
          if (!alive()) return;
          if (isShogi && vic) {
            // 取った駒は、取った側の持ち駒へ飛んでいく（向きも取った側に変わる）
            vic.style.visibility = 'hidden';
            const from = screenOf(f1.victimSq);
            paintHands(f1.hands);
            const target = handItem(f1.owner, SH.baseOf(f1.captured)) || handOf(f1.owner);
            await fly(from, centerOf(target), f1.captured, from.size, { r1: 180, s1: .5, duration: 460 });
          }
        }
        if (!alive()) return;
        if (f1.promote && moving) await flip(moving, 1, 0, 150);
      },
      /** 次の局面を描いたあと：成った駒を開き、持ち駒に入った駒を弾ませる */
      after(f1) {
        if (f1.promote) flip(board.svg.querySelector(`[data-p="${f1.move.to}"]`), 0, 1, 180);
        if (isShogi && f1.captured) {
          handItem(f1.owner, SH.baseOf(f1.captured))?.animate?.(
            [{ transform: 'scale(1)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 320 });
        }
      },
    };
  }

  /** 盤の読み筋を開く（チェス・将棋） */
  function openReplay({ title = '読み筋', tone = 'chess', opener = null, ...rest }) {
    return replayShell({ title, tone, opener, view: boardView(rest) });
  }

  // ── 麻雀：テンパイまでの道筋 ───────────────────────────
  /**
   * 道筋（コーチの計算）を、再生用のコマにする。牌に番号をつけて、同じ牌が2枚あっても動きを追えるようにする。
   * コマは「切る」と「引く」が交互に並ぶ。poolTotal は牌の総数（字牌なしなら108）、seenCount は見えている牌の数
   */
  function mahjongFrames(hand, steps, { poolTotal = 136, seenCount = 0 } = {}) {
    let id = 0;
    const sortHand = (xs) => [...xs].sort((a, b) => MJ.toIndex(a.t) - MJ.toIndex(b.t) || Number(MJ.isRed(a.t)) - Number(MJ.isRed(b.t)) || a.id - b.id);
    let cur = sortHand(MJ.sortTiles(hand).map((t) => ({ id: id++, t })));
    let river = [];
    const frames = [{ hand: cur, drawn: null, river, accept: null, cap: `この${hand.length}枚から1枚切ります。`, info: '' }];
    steps.forEach((s, i) => {
      const prev = frames[frames.length - 1];
      const all = prev.drawn ? [...cur, prev.drawn] : cur;
      // 引いた牌と同じ牌を切るときは、引いた牌を切る（ツモ切り）
      const gone = prev.drawn && prev.drawn.t === s.discard ? prev.drawn : all.find((x) => x.t === s.discard);
      if (!gone) return;
      cur = sortHand(all.filter((x) => x !== gone));
      river = [...river, gone];
      const unseen = poolTotal - cur.length - seenCount - river.length;
      const pct = unseen > 0 ? Math.round((s.tiles / unseen) * 100) : 0;
      const tenpai = s.shanten <= 0;
      const info = tenpai
        ? `待ち：<b>${s.accept.map((a) => MJ.tileName(a.tile)).join('・')}</b>（残り${s.tiles}枚）`
        : `受け入れ <b>${s.tiles}枚</b>（${s.accept.length}種）　次のツモで進む確率 約${pct}%`;
      frames.push({
        hand: cur, drawn: null, river, accept: s.accept, discardedId: gone.id, tenpai,
        cap: `${i + 1}巡目：${MJ.tileName(s.discard)}を切る → ${tenpai ? 'テンパイ' : `${s.shanten}シャンテン`}`, info,
      });
      if (s.draw) {
        const nt = { id: id++, t: s.draw };
        const nextD = steps[i + 1]?.discard;
        const nx = !nextD ? null : nt.t === nextD ? nt : cur.find((x) => x.t === nextD);
        frames.push({
          hand: cur, drawn: nt, river, accept: s.accept, drawnId: nt.id, next: nx ? nx.id : null,
          cap: `${MJ.tileName(s.draw)}を引く（受け入れの牌。残りがいちばん多い牌を引いたとします）`, info,
        });
      }
    });
    return frames;
  }

  /** 牌の読み筋（麻雀）。切った牌は下へ抜け、引いた牌は上から入り、残りの牌はすべるように詰まる */
  function tileView() {
    const handRow = el('div', 'replay__hand');
    const accRow = el('div', 'replay__row');
    const riverRow = el('div', 'replay__row');
    let reduce = false, slots = 15;
    const face = (x, cls = '') =>
      `<span class="tile${cls}" data-id="${x.id}" role="img" aria-label="${NS_TILES.tileLabel(x.t)}">${NS_TILES.tileFace(x.t)}</span>`;
    const small = (t) => `<span class="tile" role="img" aria-label="${NS_TILES.tileLabel(t)}">${NS_TILES.tileFace(t)}</span>`;
    function paintHand(f) {
      handRow.style.setProperty('--n', String(slots));
      handRow.innerHTML = f.hand.map((x) => face(x, f.next === x.id ? ' is-next' : '')).join('')
        + (f.drawn ? `<span class="replay__gap"></span>${face(f.drawn, f.next === f.drawn.id ? ' is-new is-next' : ' is-new')}` : '');
    }
    function paintAcc(f) {
      accRow.innerHTML = f.accept
        ? `<b>${f.tenpai ? '待ち' : '受け入れ'}</b>` + f.accept.map((a) => `<span class="replay__acc">${small(a.tile)}<sup>${a.left}</sup></span>`).join('')
        : '';
    }
    function paintRiver(f) {
      riverRow.innerHTML = f.river.length ? `<b>切った牌</b>${f.river.map((x) => small(x.t)).join('')}` : '';
    }
    const rects = () => new Map([...handRow.querySelectorAll('[data-id]')].map((e) => [e.dataset.id, e.getBoundingClientRect()]));
    return {
      nodes: [handRow, accRow, riverRow],
      init(o) { reduce = o.reduce; },
      draw(f, kk, frames) {
        slots = (frames[0]?.hand.length || 14) + 1;
        paintHand(f); paintAcc(f); paintRiver(f);
      },
      info: (f) => f.info || '',
      preview(hand) {
        slots = hand.length + 1;
        paintHand({ hand: MJ.sortTiles(hand).map((t, i) => ({ id: `p${i}`, t })), drawn: null });
      },
      async animate(f0, f1, alive) {
        if (f1.discardedId != null) {
          // 切る牌は下へ抜ける → 残りの牌をすべらせて詰める（位置の差を動きにする）
          const gone = handRow.querySelector(`[data-id="${f1.discardedId}"]`);
          if (gone?.animate) {
            await gone.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(70%)', opacity: 0 }],
              { duration: 260, easing: 'ease-in', fill: 'forwards' }).finished.catch(() => {});
          }
          if (!alive()) return;
          const before = rects();
          paintHand(f1); paintRiver(f1); paintAcc(f1);
          for (const e of handRow.querySelectorAll('[data-id]')) {
            const r0 = before.get(e.dataset.id);
            if (!r0 || !e.animate) continue;
            const r1 = e.getBoundingClientRect();
            const dx = r0.left - r1.left, dy = r0.top - r1.top;
            if (Math.abs(dx) > .5 || Math.abs(dy) > .5) {
              e.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0px, 0px)' }],
                { duration: 280, easing: 'cubic-bezier(.3, .7, .35, 1)' });
            }
          }
          riverRow.querySelector('.tile:last-child')?.animate?.([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 240 });
          accRow.querySelectorAll('.replay__acc').forEach((n, i) => n.animate?.([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }],
            { duration: 220, delay: 120 + i * 40, fill: 'backwards' }));
          await wait(320);
        } else if (f1.drawnId != null) {
          // 引いた牌は、上から手牌の右はしに入る
          paintHand(f1); paintAcc(f1);
          const nt = handRow.querySelector(`[data-id="${f1.drawnId}"]`);
          if (nt?.animate) {
            await nt.animate([{ transform: 'translateY(-80%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }],
              { duration: 340, easing: 'cubic-bezier(.3, .7, .35, 1)' }).finished.catch(() => {});
          }
        }
      },
    };
  }

  /** 麻雀：あなたの切り方と最善の切り方の「テンパイまでの道筋」を並べて見せる */
  function openMahjongRoutes(data, opener) {
    const shell = replayShell({ title: 'テンパイまでの道筋', tone: 'mahjong', opener, view: tileView() });
    shell.preview(data.hand);
    NS_THINK.run('mjRoutes', [data.hand, data.tile, data.best, data.sets, data.seen || []], 10000, () => null)
      .then((res) => {
        if (!res || !res.played?.length) { shell.fail('道筋を計算できませんでした。'); return; }
        const opt = { poolTotal: data.poolTotal || 136, seenCount: (data.seen || []).length };
        const summary = (steps) => {
          const last = steps[steps.length - 1];
          const reached = last.shanten <= 0;
          const draws = steps.filter((s) => s.draw).length;
          return reached
            ? `受け入れの牌を引き続ければ、${draws ? `${draws}回のツモで` : 'すぐに'}テンパイ。最初の受け入れは${steps[0].tiles}枚、待ちは${last.tiles}枚です。`
            : `${steps.length}巡では、まだテンパイしません。最初の受け入れは${steps[0].tiles}枚です。`;
        };
        const lines = [{
          label: 'あなたの切り方',
          intro: `あなたの切り方（${MJ.tileName(data.tile)}切り）で、受け入れの牌を引き続けたときの道筋です。`,
          outro: summary(res.played),
          frames: mahjongFrames(data.hand, res.played, opt),
        }];
        if (res.best?.length && data.best && data.best !== data.tile) {
          const a = res.played[0], b = res.best[0];
          const diff = a.shanten !== b.shanten
            ? `シャンテン数が${a.shanten - b.shanten}つ少なく、テンパイに近い切り方です。`
            : `最初の受け入れが${b.tiles - a.tiles}枚多い切り方です（${a.tiles}枚 → ${b.tiles}枚）。`;
          lines.push({
            label: '最善の切り方',
            intro: `最善の切り方（${MJ.tileName(data.best)}切り）の道筋です。${diff}`,
            outro: summary(res.best),
            frames: mahjongFrames(data.hand, res.best, opt),
          });
        }
        shell.setLines(lines);
      })
      .catch(() => shell.fail('道筋を計算できませんでした。'));
    return shell;
  }

  // コーチの顔。表情ごとに目と口を変える（鉢巻きはゲームの色）
  const FACE = {
    think: '<circle cx="17" cy="24" r="2.3" fill="#232a2e" stroke="none"/><circle cx="31" cy="24" r="2.3" fill="#232a2e" stroke="none"/><path d="M19.5 32.5h9"/>',
    happy: '<path d="M14 25q3-4 6 0M28 25q3-4 6 0"/><path d="M17 30.5q7 7 14 0"/><circle cx="12.5" cy="30" r="2.6" fill="#f0a49c" stroke="none" opacity=".75"/><circle cx="35.5" cy="30" r="2.6" fill="#f0a49c" stroke="none" opacity=".75"/>',
    cheer: '<path d="M14 24q3-5 6 0M28 24q3-5 6 0"/><path d="M16 29.5q8 10 16 0z" fill="#c2453a"/><circle cx="12" cy="30" r="2.7" fill="#f0a49c" stroke="none" opacity=".8"/><circle cx="36" cy="30" r="2.7" fill="#f0a49c" stroke="none" opacity=".8"/>',
    hmm: '<circle cx="17" cy="24.5" r="2.3" fill="#232a2e" stroke="none"/><circle cx="31" cy="24.5" r="2.3" fill="#232a2e" stroke="none"/><path d="M13.5 19l6-1M28.5 17.5l6 2"/><path d="M19 33q5-3 10 0"/>',
    worry: '<circle cx="17" cy="25" r="2.3" fill="#232a2e" stroke="none"/><circle cx="31" cy="25" r="2.3" fill="#232a2e" stroke="none"/><path d="M13 20.5l7-2.5M35 20.5l-7-2.5"/><path d="M17.5 35q6.5-6 13 0"/>',
    alert: '<circle cx="17" cy="24" r="3" fill="#232a2e" stroke="none"/><circle cx="31" cy="24" r="3" fill="#232a2e" stroke="none"/><circle cx="24" cy="33" r="3.2"/><path d="M45 3.5v9" stroke="#c2453a" stroke-width="3.4"/><circle cx="45" cy="17.5" r="1.9" fill="#c2453a" stroke="none"/>',
  };
  const faceSVG = (mood) => `<svg viewBox="0 0 48 48" aria-hidden="true">`
    + '<circle cx="24" cy="25.5" r="20" fill="#fffdf7" stroke="var(--tone)" stroke-width="2.6"/>'
    + '<path d="M6.5 18.5q17.5-11 35 0" fill="none" stroke="var(--tone)" stroke-width="5" stroke-linecap="round"/>'
    + '<path d="M40.5 18l4.5-3.5M40.5 18l5 1.5" fill="none" stroke="var(--tone)" stroke-width="3" stroke-linecap="round"/>'
    + `<g fill="none" stroke="#232a2e" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${FACE[mood] || FACE.think}</g></svg>`;
  const pickOne = (a) => a[(Math.random() * a.length) | 0];

  function makeCoach(ctx, { label = 'コーチ', onUndo = null, onShowBetter = null, onReplay = null, goals = [] } = {}) {
    const wrap = el('div', 'coachwrap');
    const bar = el('div', 'coachbar');
    const box = el('div', 'coach');
    // コーチのひとこと（顔と吹き出し）。くわしい講評は下の欄に出す
    const bub = el('div', 'cbub');
    bub.hidden = true;
    const face = el('div', 'cbub__face');
    const btext = el('p', 'cbub__text');
    btext.setAttribute('role', 'status');
    btext.setAttribute('aria-live', 'polite');
    bub.append(face, btext);
    if (goals.length) {
      const names = goals.map((g) => GOALS[g]?.label).filter(Boolean);
      if (names.length) wrap.appendChild(el('p', 'coachgoal', `このレッスンで見ているところ：${names.join(' / ')}`));
    }

    const toggle = el('label', 'toggle');
    toggle.innerHTML = `<input type="checkbox" checked> ${label}`;
    const sel = el('select', 'detail');
    sel.innerHTML = DETAILS.map((d) =>
      `<option value="${d.id}" ${d.id === readDetail() ? 'selected' : ''}>${d.label}</option>`).join('');
    sel.setAttribute('aria-label', '講評の詳しさ');
    sel.addEventListener('change', () => {
      settings.set('coachDetail', sel.value);
      if (last) render(last);
    });

    bar.append(toggle, sel);
    wrap.append(bar, bub, box);
    ctx.mount.appendChild(wrap);
    const input = toggle.querySelector('input');
    input.addEventListener('change', () => {
      sel.disabled = !input.checked;
      if (!input.checked) { box.innerHTML = ''; bub.hidden = true; }
      else { if (last) render(last); if (lastSay) sayNow(lastSay, false); }
    });
    let lastSay = null;
    /** ひとことを出す。t = { text, mood }。新しいときは顔と吹き出しを小さく動かす */
    function sayNow(t, animate = true) {
      if (!t || !t.text || !input.checked) { bub.hidden = true; return; }
      const mood = FACE[t.mood] ? t.mood : 'think';
      bub.hidden = false;
      bub.dataset.mood = mood;
      face.innerHTML = faceSVG(mood);
      btext.textContent = t.text;
      bub.classList.remove('is-new');
      if (animate) { void bub.offsetWidth; bub.classList.add('is-new'); }
    }

    let last = null;

    function render(review) {
      if (!input.checked || !review || !review.lines.length) { box.innerHTML = ''; return; }
      const d = sel.value;
      const level = review.level;
      box.dataset.level = level;

      const shown = d === 'short' ? review.lines.slice(0, 1) : review.lines.slice(0, 3);
      const html = shown.map((l) => {
        const parts = [`<b${l.kind === 'goal' ? ' class="coach__goal"' : ''}>${l.what}</b>`];
        if (d !== 'short' && l.why) parts.push(`<span>${l.why}</span>`);
        if (d !== 'short' && l.better) {
          const bl = l.better.label + (l.better.reason ? ` — ${l.better.reason}` : '');
          parts.push(`<span class="coach__better">こうすれば：${bl}</span>`);
        }
        if (d === 'deep' && l.lesson) parts.push(`<span class="coach__lesson">${l.lesson}</span>`);
        if (d !== 'short' && l.link) parts.push(`<a class="coach__link" href="${l.link}">関連するレッスンで練習する →</a>`);
        return `<div class="coach__line">${parts.join('')}</div>`;
      }).join('');

      box.innerHTML = html;

      // 悪い手を指摘したときだけ、その場でやり直せるようにする
      const acts = el('div', 'coach__acts');
      let any = false;
      if (onUndo && level !== 'ok') {
        const b = el('button', 'btn btn--ghost btn--sm', 'いまの手をやり直す');
        b.addEventListener('click', () => { box.innerHTML = ''; last = null; onUndo(); });
        acts.appendChild(b); any = true;
      }
      const withMarks = shown.find((l) => l.marks && Object.keys(l.marks).length);
      if (onShowBetter && withMarks && d !== 'short') {
        const b = el('button', 'btn btn--ghost btn--sm', '盤で見る');
        b.addEventListener('click', () => onShowBetter(withMarks));
        acts.appendChild(b); any = true;
      }
      if (onReplay && review.replay) {
        const b = el('button', 'btn btn--ghost btn--sm', review.replay.label || '▶ 読み筋を見る');
        b.addEventListener('click', () => onReplay(review.replay, b));
        acts.appendChild(b); any = true;
      }
      if (any) box.appendChild(acts);
    }

    return {
      get on() { return input.checked; },
      clear() { last = null; box.innerHTML = ''; lastSay = null; bub.hidden = true; },
      show(review) { last = review; render(review); },
      /** 吹き出しにひとこと（コーチがオフのときは覚えておくだけ） */
      say(t) { if (!t || !t.text) return; lastSay = t; sayNow(t); },
    };
  }

  /**
   * 対局ごとのコーチの「話し相手」。今回のテーマ（最近10局でいちばん多い指摘）・連続ノーミス・
   * 一度だけ言うひとこと（序盤・終盤のコツ）を覚えておき、場面に合ったひとことを返す
   */
  function makeTalker(game, intro = null) {
    let theme = null;
    try {
      const wk = store.weakness(game, 10);
      const top = Object.entries(wk.total).filter(([k]) => K.THEME_JA[k]).sort((a, b) => b[1] - a[1])[0];
      if (top && wk.games >= 2) theme = { kind: top[0], label: K.THEME_JA[top[0]], n: top[1], games: wk.games, avg: top[1] / wk.games };
    } catch { /* 記録が読めなくても対局はできる */ }
    let streak = 0, said = new Set(), lastWasBad = false, themeN = 0;
    const FIRST = {
      chess: 'よろしくお願いします！ 指す前に「その駒、取られない？」を一緒に確かめていきましょう。',
      shogi: 'よろしくお願いします！ まずは「駒をタダで取られない」ことだけ気をつけましょう。',
      go: 'よろしくお願いします！ 打つ前に、石の呼吸点を数えるクセをつけていきましょう。',
      mahjong: 'よろしくお願いします！ 迷ったら、ひとりぼっちの字牌から切っていきましょう。',
    };
    const fmt = (v) => (v >= 10 ? String(Math.round(v)) : String(Math.round(v * 10) / 10));
    return {
      get theme() { return theme; },
      /** 対局のはじめ：テーマがあればテーマ、なければ最初のあいさつ */
      hello() {
        streak = 0; said = new Set(); lastWasBad = false; themeN = 0;
        if (theme) {
          return { text: `今回のテーマは「${theme.label}」。最近${theme.games}局で${theme.n}回ありました（1局あたり${fmt(theme.avg)}回）。この局は、それより少なくを目指しましょう！`, mood: 'think' };
        }
        return { text: intro || FIRST[game], mood: 'happy' };
      },
      /** 自分の手の講評から */
      mine(rv) {
        if (!rv) return null;
        lastWasBad = rv.level !== 'ok';
        if (rv.level === 'ok') streak++; else streak = 0;
        if (theme && rv.level !== 'ok' && rv.lines.some((l) => l.kind === theme.kind)) themeN++;
        return K.talk(game, rv, { theme: theme?.kind, themeN, streak });
      },
      /** 直前の自分の手が悪手だったか（相手の番に、急がないひとことで吹き出しを上書きしないため） */
      get lastBad() { return streak === 0 && lastWasBad; },
      /** その話題が初めてなら true（覚える） */
      first(key) { if (said.has(key)) return false; said.add(key); return true; },
      /** 一度だけ言うひとこと */
      once(key, text, mood = 'think', extra = {}) {
        if (said.has(key)) return null;
        said.add(key);
        return { text, mood, ...extra };
      },
      fmt,
    };
  }

  /** コーチが話した直後に、相手が手を指すまで待つ時間。矢印と吹き出しを見て、読む時間を取る */
  const coachPause = (rv, said) => (!said || !rv ? 0
    : rv.level === 'blunder' ? 1800 : rv.level === 'miss' ? 1200 : said.arrows?.length ? 600 : 0);

  /**
   * 対局が終わったとき：この局でコーチが指摘した種類と回数、テーマの結果を、振り返りの上にまとめて出す。
   * 吹き出しに出す締めのひとことを返す
   */
  function showSummary(box, game, tally, talker, result, custom = null) {
    const counts = tally ? tally.counts() : {};
    const entries = Object.entries(counts).filter(([k, n]) => K.KIND_JA[k] && n > 0).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((a, [, n]) => a + n, 0);
    const theme = talker?.theme;
    const wrap = el('div', 'gsum');
    let html = '<h3>この局のまとめ</h3>';
    html += total
      ? `<p>コーチの指摘は${total}回でした。</p><p>${entries.map(([k, n]) => `<span class="gsum__k">${K.KIND_JA[k]} ×${n}</span>`).join('')}</p>`
      : '<p>コーチが指摘した手は、ひとつもありませんでした。</p>';
    let themeMsg = '';
    if (theme) {
      const n = counts[theme.kind] || 0;
      const good = n < theme.avg || n === 0;
      themeMsg = n === 0 ? `テーマ「${theme.label}」も達成です！` : good ? 'テーマの回数も、前より減っています。' : '';
      html += `<p class="gsum__theme" data-ok="${good ? 1 : ''}">テーマ「${theme.label}」：この局は${n}回（最近の平均 ${talker.fmt(theme.avg)}回）。`
        + `${n === 0 ? '達成です！' : good ? '前より減っています。' : '次の局でもう一度ねらいましょう。'}</p>`;
    }
    wrap.innerHTML = html;
    box.prepend(wrap);
    const end = custom ? `${custom} ${themeMsg}` : result === 'win'
      ? (total ? `勝ちました、おめでとう！ ${themeMsg || '気になった手は、下の「振り返り」で見直せます。'}` : `ノーミスで勝ち！ 完ぺきです！ ${themeMsg}`)
      : result === 'draw'
        ? `引き分けでした。${themeMsg || '振り返りで、勝ちきる手がなかったか見てみましょう。'}`
        : `今回は負けましたが、負けた局ほど伸びます。${themeMsg || '下の「振り返り」を見てから、もう一局どうぞ。'}`;
    return { text: end.trim(), mood: result === 'win' ? 'cheer' : result === 'draw' ? 'think' : 'hmm' };
  }


  // ── チェス ────────────────────────────────────────────────
  const CHESS_SETUPS = {
    // ポーンゲーム：ポーンだけ。向こう端に到達すれば勝ち。最初の1局に向く
    pawns: {
      w: 8, h: 8, side: 'w', depth: 2, stuckLoses: true,
      board: (() => {
        const b = {};
        for (const f of 'abcdefgh') { b[f + '2'] = 'P'; b[f + '7'] = 'p'; }
        return b;
      })(),
      win: '自分のポーンを8段目まで運ぶ（相手が動けなくなっても勝ち）',
      check: (board) => {
        for (const f of 'abcdefgh') {
          if (board[f + '8'] && board[f + '8'] === board[f + '8'].toUpperCase()) return 'win';
          if (board[f + '1'] && board[f + '1'] === board[f + '1'].toLowerCase()) return 'lose';
        }
        return null;
      },
    },
    // 4×4。キングがいるので本物のチェックメイトが起きる（ポーンの2マス進みはない）
    mini: {
      w: 4, h: 4, side: 'w', depth: 3,
      board: { a1: 'R', b1: 'K', a2: 'P', b2: 'P', d4: 'r', c4: 'k', d3: 'p', c3: 'p' },
      win: '相手のキングをチェックメイトする',
    },
    // 終盤ドリル：裸のキングを詰ませきる練習。毎回ちがう配置で出る
    drill_rr: {
      w: 8, h: 8, side: 'w', depth: 2, drill: true, limit: 14,
      make: () => randomEndgame(['K', 'R', 'R', 'k']),
      win: '2つのルークで相手のキングを追い詰めて詰ませる（14手以内）',
      prompt: '<strong>ルーク2枚の詰ませ方</strong>を練習します。段（横のライン）を1つずつ削って、キングを端へ追い込みます。14手以内に詰ませてください。',
    },
    drill_q: {
      w: 8, h: 8, side: 'w', depth: 2, drill: true, limit: 16,
      make: () => randomEndgame(['K', 'Q', 'k']),
      win: 'クイーンとキングで詰ませる（16手以内）',
      prompt: '<strong>クイーンでの詰ませ方</strong>を練習します。クイーンだけでは詰みません。自分のキングを近づけて、端で詰ませます。ステイルメイトに注意。',
    },
    drill_r: {
      w: 8, h: 8, side: 'w', depth: 2, drill: true, limit: 25,
      make: () => randomEndgame(['K', 'R', 'k']),
      win: 'ルーク1枚とキングで詰ませる（25手以内）',
      prompt: '<strong>ルーク1枚での詰ませ方</strong>。キングどうしを向き合わせ（オポジション）、ルークで王手して1段ずつ追い詰めます。',
    },
    // ルーセナ：K＋R＋P 対 K＋R。ポーンを成らせ、そのクイーンが黒の手のあとも残っていれば勝ち
    lucena: {
      w: 8, h: 8, side: 'w', depth: 2, drill: true, limit: 16,
      board: { b8: 'K', b7: 'P', c1: 'R', d7: 'k', a2: 'r' },
      win: 'ポーンを成らせて、そのクイーンを守りきる（16手以内）',
      prompt: '最後に、ルーセナの形から実際に勝ちきってください。黒はコンピューターが受けます。<strong>ポーンを成らせて、そのクイーンを守りきれば合格</strong>です（16手以内）。',
      coachIntro: 'ルーセナです。まず王手で黒のキングを遠ざけて、ルークを4段目へ。橋をかける準備から始めましょう。',
      winMsg: '<b>勝ちきりました</b>ポーンを成らせる（または黒のルークを取る）ところまで、形にできました。',
      limitMsg: '<b>手数が尽きました</b>王手で相手のキングを遠ざけ、ルークを4段目に上げてから、キングを外に出すのが順番です。もう一度やってみましょう。',
      loseMsg: '<b>ポーンかルークを取られて、勝てない形になりました</b>キングを出す前に、ルークを4段目に上げて、橋の準備をしておきましょう。',
      check: (board, turn) => {
        const v = Object.values(board);
        const rSq = Object.keys(board).find((k) => board[k] === 'r');
        if (v.includes('Q') && turn === 'w') return 'win';                 // 成ったクイーンが、黒の手のあとも残っている
        // 黒のルークを取った（ルークかクイーンが残っているか、ポーンが7段目なら勝ち）
        if (!rSq && (v.includes('R') || v.includes('Q') || Object.keys(board).some((k) => board[k] === 'P' && k[1] === '7'))) return 'win';
        if (turn !== 'w') return null;
        // ポーンかルークを取られた：すぐに黒のルークを取り返せるなら続ける。取り返せなければ、もう勝てない
        const lost = !v.includes('R') || (!v.includes('P') && !v.includes('Q'));
        if (lost && !(rSq && NS_CHESS.allLegalMoves(board, 'w', { w: 8, h: 8 }).some((m) => m.to === rSq))) return 'lose';
        return null;
      },
    },
    // 本物の盤。キャスリングとアンパッサンも指せる
    full: {
      w: 8, h: 8, side: 'w', depth: 2, board: null, special: true,
      win: '相手のキングをチェックメイトする',
    },
  };

  /** 終盤ドリル用に、王手のかかっていないランダムな配置を作る */
  function randomEndgame(pieces) {
    const files = 'abcdefgh';
    for (let t = 0; t < 400; t++) {
      const used = new Set();
      const b = {};
      let ok = true;
      for (const p of pieces) {
        let sq = null;
        for (let k = 0; k < 60; k++) {
          const c = files[(Math.random() * 8) | 0] + (1 + ((Math.random() * 8) | 0));
          if (!used.has(c)) { sq = c; break; }
        }
        if (!sq) { ok = false; break; }
        used.add(sq); b[sq] = p;
      }
      if (!ok) continue;
      const wk = Object.keys(b).find((x) => b[x] === 'K'), bk = Object.keys(b).find((x) => b[x] === 'k');
      // 玉どうしが接していない・黒が王手されていない・すぐ取られる駒がない配置だけ使う
      if (Math.abs(files.indexOf(wk[0]) - files.indexOf(bk[0])) <= 1 && Math.abs(+wk[1] - +bk[1]) <= 1) continue;
      if (CH.inCheck(b, 'b', { w: 8, h: 8 })) continue;
      if (CH.allLegalMoves(b, 'b', { w: 8, h: 8 }).some((m) => b[m.to] && CH.colorOf(b[m.to]) === 'w')) continue;
      return b;
    }
    return { a1: 'K', h8: 'k', d4: 'R' };
  }

  const DRAW_REASON = {
    stalemate: 'ステイルメイト（動ける手がないのにチェックされていない）',
    material: '駒が足りず、どちらもチェックメイトできない',
    repetition: '同じ局面が3回くり返された',
    fifty: '50手のあいだ、駒を取る手もポーンを動かす手もなかった',
  };

  /**
   * 棋譜。frames[0] が開始局面、frames[i] が i 手目を指したあとの局面。
   * ◀ ▶ で1手ずつ、手の名前をタップするとその局面へ飛ぶ。show(frame) で盤に描く。
   */
  function showKifu(box, frames, show, graph = null) {
    box.innerHTML = '';
    if (frames.length < 2) return;
    const last = frames.length - 1;
    let at = last;
    // 形勢グラフ：1局面ずつ少しだけ読んで評価する。画面が止まらないよう、1局面ごとに処理を返す
    let drawGraph = () => {};
    if (graph && graph.evalOf) {
      const wrap = el('div', 'kifu__graph');
      const cap = el('p', 'recap__note', '形勢グラフ（上ほどあなたが有利）を計算しています…');
      const pic = el('div', 'kifu__pic');
      const now = el('p', 'note');   // いま見ている局面の値（囲碁は目数）
      wrap.append(cap, pic);
      if (graph.valueText) wrap.appendChild(now);
      box.appendChild(wrap);
      const vals = [];
      let drops = [];
      drawGraph = () => {
        pic.innerHTML = graphSVG(vals, at, drops, graph.unit);
        if (graph.valueText) now.textContent = vals[at] != null ? graph.valueText(vals[at]) : '';
      };
      pic.addEventListener('click', (e) => {
        const r = pic.getBoundingClientRect();
        go(Math.round(((e.clientX - r.left) / r.width) * last));
      });
      const stepEval = (i) => {
        if (!pic.isConnected && i > 0) return;   // 盤を離れた・もう一局を始めた
        if (i > last) {
          // 自分の手で、形勢が大きく下がったところ（分かれ目）
          drops = [];
          for (let k = 1; k <= last; k++) {
            if (frames[k].mover === graph.me && vals[k - 1] != null && vals[k] != null
              && vals[k - 1] - vals[k] >= 3 * graph.unit) drops.push(k);
          }
          cap.textContent = drops.length
            ? `形勢グラフ（上ほどあなたが有利）。赤い点は、あなたの手で形勢が大きく下がったところです（${drops.map((k) => (graph.dropText ? graph.dropText(k, vals[k - 1] - vals[k]) : `${k}手目`)).join('・')}）。グラフをタップするとその局面に飛びます。`
            : '形勢グラフ（上ほどあなたが有利）。大きく形勢を損ねた手はありませんでした。グラフをタップするとその局面に飛びます。';
          drawGraph();
          return;
        }
        let pending;
        try { pending = Promise.resolve(graph.evalOf(frames[i])); } catch { pending = Promise.resolve(null); }
        pending.catch(() => null).then((v) => {
          if (!pic.isConnected && i > 0) return;
          vals[i] = typeof v === 'number' && Number.isFinite(v) ? v : null;
          drawGraph();
          setTimeout(() => stepEval(i + 1), 0);
        });
      };
      setTimeout(() => stepEval(0), 30);
    }
    box.appendChild(el('p', 'recap__note', '棋譜：◀ ▶ で1手ずつ再生できます。手の名前をタップすると、その局面に飛びます。'));
    // 棋譜の書き出し（チェスは PGN、将棋は KIF）。他のソフトで並べ直したり、人に見せて聞いたりできる
    if (graph?.exportText) {
      const wrap = el('div', 'kifu__export');
      const b = el('button', 'btn btn--ghost btn--sm', `棋譜を書き出す（${graph.exportName}）`);
      b.addEventListener('click', () => {
        const text = graph.exportText();
        wrap.innerHTML = '';
        const ta = el('textarea', 'kifu__text');
        ta.value = text; ta.readOnly = true; ta.rows = 6;
        const copy = el('button', 'btn btn--ghost btn--sm', 'コピーする');
        const msg = el('span', 'kifu__count');
        copy.addEventListener('click', async () => {
          try { await navigator.clipboard.writeText(text); msg.textContent = 'コピーしました'; }
          catch { ta.select(); msg.textContent = '長押しして選択・コピーしてください'; }
        });
        wrap.append(ta, copy, msg);
      });
      wrap.appendChild(b);
      box.appendChild(wrap);
    }
    const nav = el('div', 'kifu__nav');
    const mk = (label, aria, fn) => {
      const b = el('button', 'btn btn--ghost btn--sm', label);
      b.setAttribute('aria-label', aria);
      b.addEventListener('click', fn);
      nav.appendChild(b);
      return b;
    };
    const bFirst = mk('⏮', '最初の局面', () => go(0));
    const bPrev = mk('◀', '1手もどる', () => go(at - 1));
    const bNext = mk('▶', '1手すすむ', () => go(at + 1));
    const bLast = mk('⏭', '最後の局面', () => go(last));
    const count = el('span', 'kifu__count');
    nav.appendChild(count);
    const list = el('ol', 'kifu__list');
    const items = frames.slice(1).map((f, i) => {
      const li = el('li');
      const b = el('button', 'kifu__mv', f.label);
      b.addEventListener('click', () => go(i + 1));
      li.appendChild(b);
      list.appendChild(li);
      return b;
    });
    let sugNote = null;
    if (graph?.suggest) {
      const sw = el('div', 'kifu__export');
      const sb = el('button', 'btn btn--ghost btn--sm', 'この局面のおすすめ（AI）');
      sugNote = el('span', 'kifu__count');
      let tok = 0;
      sb.addEventListener('click', async () => {
        const my = ++tok, k = at;
        sugNote.textContent = '考えています…';
        let r = null;
        try { r = await graph.suggest(frames[k], frames[k + 1] || null); } catch { r = null; }
        if (my !== tok || k !== at || !sugNote.isConnected) return;
        if (!r) { sugNote.textContent = 'この局面では、おすすめを出せませんでした。'; return; }
        show(frames[k], r.marks || {});
        sugNote.textContent = r.text || '';
      });
      sw.append(sb, sugNote);
      box.appendChild(sw);
    }
    box.append(nav, list);
    function go(i) {
      if (sugNote) sugNote.textContent = '';
      at = Math.max(0, Math.min(last, i));
      show(frames[at]);
      items.forEach((b, j) => { if (j + 1 === at) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
      count.textContent = at === 0 ? '開始局面' : `${at}手目 / ${last}手`;
      bFirst.disabled = bPrev.disabled = at === 0;
      bNext.disabled = bLast.disabled = at === last;
      const cur = items[at - 1];
      if (cur) list.scrollTop = Math.max(0, cur.offsetTop - list.clientHeight / 2);   // ページではなく一覧の中だけ動かす
      drawGraph();
    }
    go(last);
  }

  /**
   * 対局後の振り返り：コーチが指摘した手から、重いものを最大3つ選んで並べる。
   * タップすると、その手を指す前の局面を盤に出し、正しい手の説明を見せる。
   */
  function showRecap(box, recap, show, onReplay = null) {
    box.innerHTML = '';
    if (!recap.length) {
      box.appendChild(el('p', 'recap__note', '振り返り：この局では、コーチが指摘した手はありませんでした。'));
      return;
    }
    const rank = (x) => (x.rv.level === 'blunder' ? 0 : 1);
    const top = [...recap].sort((a, b) => rank(a) - rank(b) || a.n - b.n).slice(0, 3).sort((a, b) => a.n - b.n);
    box.appendChild(el('p', 'recap__note', `振り返り：この局で気になった手（${top.length}つ）。タップすると、その手を指す前の局面を盤に出します。`));
    const note = el('p', 'recap__note');
    for (const it of top) {
      const l = it.rv.lines[0];
      const b = el('button', 'btn btn--ghost btn--sm recap__item', `${it.n}手目：${l.what}`);
      b.addEventListener('click', () => {
        const marks = { ...(it.move.from ? { [it.move.from]: 'hint' } : {}), [it.move.to]: 'ng', ...(l.marks || {}) };
        show(it, marks);
        note.innerHTML = `${l.why || ''}`
          + `${l.better ? `<br>こうすれば：${l.better.label}${l.better.reason ? ` — ${l.better.reason}` : ''}` : ''}`
          + `${l.link ? `<br><a class="coach__link" href="${l.link}">関連するレッスンで練習する →</a>` : ''}`;
        if (onReplay && it.rv.replay) {
          const rb = el('button', 'btn btn--ghost btn--sm recap__replay', '▶ 読み筋を見る');
          rb.addEventListener('click', () => onReplay(it.rv.replay, rb));
          note.appendChild(rb);
        }
      });
      box.appendChild(b);
    }
    box.appendChild(note);
  }

  /**
   * 相手の強さ。やさしい＝浅く読み、ときどき気まぐれな手／ふつう／つよい＝1手深く読む。
   * 選んだ強さは設定に保存して、次の対局でも使う。
   */
  /** 対局の途中保存。key ごとに1局。中身は開始局面と手順だけ（局面は手順を並べ直して戻す） */
  function gameSaver(key) {
    return {
      load() {
        try {
          const v = JSON.parse(localStorage.getItem(key) || 'null');
          return v && v.v === 1 && Array.isArray(v.moves) && v.moves.length ? v : null;
        } catch { return null; }
      },
      save(data) { try { localStorage.setItem(key, JSON.stringify({ v: 1, ...data })); } catch { } },
      clear() { try { localStorage.removeItem(key); } catch { } },
    };
  }
  const AI_LEVELS = [['auto', 'じどう'], ['easy', 'やさしい'], ['normal', 'ふつう'], ['hard', 'つよい']];
  const LEVEL_JA = { easy: 'やさしい', normal: 'ふつう', hard: 'つよい' };
  /**
   * 相手の強さの選び方。「じどう」の強さと成績は盤の種類（variant）ごとに分ける。
   * rated の盤（本物の盤）だけを持ち点に数える。小さな盤や練習の盤で勝ち続けても、持ち点や本番の相手の強さは変わらない
   */
  function aiLevelPicker(ctx, { variant = 'main', rated = true } = {}) {
    const game = ctx.lesson.game;
    // 強さはゲームごとに覚える（以前は全ゲーム共通で、チェスで「つよい」にすると将棋も強くなっていた）
    const LKEY = `aiLevel.${game}`;
    const lvSetting = () => settings.get(LKEY) || settings.get('aiLevel') || 'auto';
    const row = el('label', 'ailevel');
    row.innerHTML = `相手の強さ <select>${AI_LEVELS.map(([id, ja]) =>
      `<option value="${id}" ${id === lvSetting() ? 'selected' : ''}>${ja}</option>`).join('')}</select>`;
    const note = el('span', 'ailevel__n');
    row.appendChild(note);
    row.querySelector('select').addEventListener('change', (e) => { settings.set(LKEY, e.target.value); refresh(); });
    ctx.mount.appendChild(row);
    /** いま実際に使う強さ。「じどう」は、この盤での勝敗に合わせて上下する */
    const cur = () => {
      const v = lvSetting();
      return v === 'auto' ? store.autoLevel(game, variant) : v;
    };
    const refresh = () => {
      const r = store.record(game), v = r.lv?.[variant];
      const parts = [];
      if (lvSetting() === 'auto') parts.push(`いまは「${LEVEL_JA[cur()]}」`);
      if (v && v.w + v.l + v.d) parts.push(`この盤で${v.w}勝${v.l}敗${v.d ? `${v.d}分` : ''}`);
      parts.push(rated ? `持ち点 ${r.rating}` : '練習の盤なので持ち点には数えません');
      note.textContent = parts.join('／');
    };
    refresh();
    // この局で相手が使った、いちばん弱い強さ（途中で強くしても、持ち点は弱い方の相手として数える）
    let weakest = null;
    const fn = () => {
      const l = cur();
      if (!weakest || LEVELS_ORDER.indexOf(l) < LEVELS_ORDER.indexOf(weakest)) weakest = l;
      return l;
    };
    fn.refresh = refresh;
    fn.weakest = () => weakest || cur();
    fn.newGame = () => { weakest = null; };
    fn.variant = variant;
    fn.rated = rated;
    return fn;
  }
  const LEVELS_ORDER = ['easy', 'normal', 'hard'];
  /** 持ち点に数える盤（本番の盤）。ほかの盤は、強さの自動調整と勝敗だけを盤ごとに記録する */
  const RATED_VARIANTS = { chess: ['full'], shogi: ['big'], go: ['nine', 'thirteen', 'nineteen'] };
  /** 盤の種類の名前（成績の内訳に使う） */
  const VARIANT_JA = {
    chess: { pawns: 'ポーンゲーム', mini: '4×4の盤', full: '本物の盤', drill_rr: 'ルーク2枚のドリル', drill_q: 'クイーンのドリル', drill_r: 'ルーク1枚のドリル', lucena: 'ルーセナ' },
    shogi: { mini: '3×4の盤', gogo: '5五将棋', big: '本将棋', big_ch: '駒落ちチャレンジ', drill_kin: '金3枚のドリル', drill_hisha: '飛車2枚のドリル', drill_ryu: '竜と金のドリル' },
    go: { cap1: '1子取り碁', cap3: '3子取り碁', cap5: '5子取り碁', nine: '9路盤', thirteen: '13路盤', nineteen: '19路盤',
      nine_ch: '9路の置き碁チャレンジ', thirteen_ch: '13路の置き碁チャレンジ' },
  };
  /**
   * 成績の文。rating：持ち点（本番の盤で対局していれば）、detail：盤ごとの勝敗
   * 例 { rating: '持ち点 1032', detail: '4×4の盤 5勝0敗・本物の盤 3勝1敗' }
   */
  function recordText(game, rec) {
    const names = VARIANT_JA[game] || {};
    const rows = Object.keys(names).map((k) => [k, rec.lv?.[k]]).filter(([, v]) => v && v.w + v.l + v.d)
      .map(([k, v]) => `${names[k]} ${v.w}勝${v.l}敗${v.d ? `${v.d}分` : ''}`);
    const played = rec.w + rec.l + rec.d;
    return {
      rating: rec.rn ? `持ち点 ${rec.rating}` : null,
      detail: rows.length ? rows.join('・') : played ? `${rec.w}勝${rec.l}敗${rec.d}分` : '',
    };
  }
  /** 1局の結果を、盤の種類と相手の強さをつけて記録する */
  function saveResult(game, level, outcome, extra = {}) {
    store.recordResult(game, outcome, { variant: level.variant, rated: level.rated, opp: level.weakest(), ...extra });
  }
  const levelDepth = (lvl, normal) => (lvl === 'easy' ? 1 : lvl === 'hard' ? normal + 1 : normal);

  function playChess(ctx, { Board, C }) {
    const s = ctx.step;
    const cfg = CHESS_SETUPS[s.variant || 'mini'];
    const baseOpts = { w: cfg.w, h: cfg.h };
    const me = cfg.side, foe = me === 'w' ? 'b' : 'w';

    ctx.prompt(s.prompt || cfg.prompt || `あなたは白です。${cfg.win}。`);
    const variant = s.variant || 'mini';
    const level = aiLevelPicker(ctx, { variant, rated: RATED_VARIANTS.chess.includes(variant) });
    const host = ctx.boardHost();
    const board = new Board(host, { variant: 'chess', w: cfg.w, h: cfg.h, coords: true });
    const status = el('p', 'note');
    ctx.mount.appendChild(status);
    const recapBox = el('div', 'recap');
    // opts にはキャスリング権とアンパッサンのマスが入る（本物の盤のときだけ）
    let position, turn, from, busy, finished, opts, quiet, seen;
    let history = [];   // 自分の手番の直前の状態を積む（待った用）
    let recap = [];     // 振り返り用：講評で指摘した手
    let pauseNext = 0;  // コーチが指摘した直後に、相手が待つ時間（ミリ秒）
    let kifu = [];      // 棋譜：開始局面と、1手ごとの局面
    let tally = null;   // この局の講評の集計（弱点の記録用）
    let lastMarks = {}; // 相手の直前の手（相手の狙いを考えさせるときのヒント）
    let token = 0;      // 待ったや最初からで、考え中のAIの手を捨てるための番号

    /** 読み筋の再生：指す前の最善手順と、指した手への相手の最善手順を読み、別の盤で動かして見せる */
    const openChessReplay = (data, opener) => {
      const panel = openReplay({ title: '読み筋', variant: 'chess', w: cfg.w, h: cfg.h, flipped: me === 'b', tone: 'chess', opener });
      panel.preview(data.before);
      const name = (m) => `${C.PIECE_JA[C.kindOf(data.before[m.from])]} ${m.from}→${m.to}`;
      const alt = data.alt && !(data.alt.from === data.move.from && data.alt.to === data.move.to) ? data.alt : null;
      NS_THINK.run('lines', ['chess', { b: data.before, turn: me }, { b: data.after, turn: foe }, baseOpts, 1500, alt], 10000, () => null)
        .then((res) => {
          if (!res || !res.best || !res.reply) { panel.fail('読み筋を読み切れませんでした。'); return; }
          const played = data.move;
          const lines = [{
            label: 'あなたの手のあと',
            intro: `あなたの手（${name(played)}）のあと、相手のいちばん良い続きです。`,
            frames: chessFrames(data.before, data.beforeOpts, me, [played, ...res.reply.pv], me, cfg.h),
          }];
          // 「こうすれば」の手があれば、その手から。なければ読みの最善手から
          const bestLine = res.altMove && res.altReply ? [res.altMove, ...res.altReply.pv] : res.best.pv;
          const first = bestLine[0];
          if (first && !(first.from === played.from && first.to === played.to)) {
            lines.push({
              label: '本当はこう指せた',
              intro: res.altMove ? `コーチのおすすめ（${name(first)}）のあとの、いちばん良い続きです。` : `${name(first)} から始まる、いちばん良い手順です。`,
              frames: chessFrames(data.before, data.beforeOpts, me, bestLine, me, cfg.h),
            });
          }
          // 見逃しの指摘（取れた駒・詰み）のときは、「本当はこう指せた」を先に見せる
          if (lines.length > 1 && data.focus === 'best') lines.reverse();
          panel.setLines(lines);
        })
        .catch(() => panel.fail('読み筋を読み切れませんでした。'));
    };
    const coach = makeCoach(ctx, {
      goals: s.goals || [],
      onUndo: () => undo(),
      onShowBetter: (line) => board.setPosition(position, line.marks),
      onReplay: openChessReplay,
    });
    const talker = makeTalker('chess', cfg.coachIntro ? cfg.coachIntro : cfg.drill ? '相手のキングの動ける範囲を、1マスずつ狭めていきましょう。最後の1手だけがチェックメイトです。'
      : (s.variant || 'mini') === 'pawns' ? 'ポーンだけの勝負です。相手のポーンにタダで取られない進め方を、一緒に考えましょう。'
        : (s.variant || 'mini') === 'mini' ? '小さな盤です。キングを守りながら、相手のキングを追い詰めましょう。' : null);
    ctx.mount.appendChild(recapBox);
    const kifuBox = el('div', 'kifu');
    ctx.mount.appendChild(kifuBox);
    const record = (who, mfrom, mto, piece, took, promo = null) => kifu.push({
      pos: { ...position }, mover: who, turn: who === 'w' ? 'b' : 'w',
      mv: { from: mfrom, to: mto, piece, took, promo },
      label: `${who === 'w' ? '白' : '黒'} ${C.PIECE_JA[C.kindOf(piece)]} ${mfrom}${took ? '×' : '→'}${mto}`,
      mark: { [mfrom]: 'last', [mto]: 'last' },
    });
    // 途中保存：開始局面と手順（キャスリング権・千日手の記録などは、並べ直すときに同じ処理で戻る）
    const saver = gameSaver(`bangi.save.${ctx.lesson.id}.${s.variant || 'mini'}`);
    const persist = () => (finished ? saver.clear()
      : saver.save({ start: kifu[0].pos, moves: kifu.slice(1).map((f) => ({ f: f.mv.from, t: f.mv.to, p: f.mv.promo || null })) }));
    const showKifuHere = () => showKifu(kifuBox, kifu, (f) => board.setPosition(f.pos, f.mark), {
      me, unit: 1,
      evalOf: (f) => NS_THINK.run('eval', ['chess', { b: f.pos, turn: f.turn }, baseOpts, 90]).then((v) => (f.turn === me ? v : -v)),
      exportName: 'PGN',
      exportText: () => toPGN(kifu, baseOpts, lastResult, me),
    });
    let lastResult = null;
    let resultSaved = false;   // この局の勝敗をもう記録したか（「1手もどす」で指し直しても二重に記録しない）
    const quiz = makeThreatQuiz({ status, paint: (m) => paint(m), say: (t) => coach.say(t) });
    const predict = makePredictDrill({ status, game: 'chess', label: (mv) => ` ${mv.from}→${mv.to} ` });
    let predictMsg = null;
    const hintMarks = (sq) => K.moveMarks('chess', position, sq,
      C.legalMoves(position, sq, opts), me, opts, {
        showMoves: settings.get('showMoves'),
        warnUnsafe: settings.get('warnUnsafe'),
        showThreat: settings.get('showThreat'),
      });
    const posKey = () => `${turn}|${opts.ep || ''}|${JSON.stringify(opts.castle)}|`
      + Object.keys(position).sort().map((k) => k + position[k]).join(',');
    const remember = () => { const k = posKey(); seen.set(k, (seen.get(k) || 0) + 1); };

    const reset = (opt) => {
      const resume = !!(opt && opt.resume === true);   // ボタンから呼ばれるとクリックのイベントが渡るので、明示したときだけ
      if (!resume) saver.clear();
      token++;
      promoBox?.remove(); promoBox = null; pendingPromo = false;
      position = { ...(resume ? opt.start : (cfg.make ? cfg.make() : cfg.board || C.START_POSITION)) };
      opts = cfg.special
        ? { ...baseOpts, castle: { w: { k: true, q: true }, b: { k: true, q: true } }, ep: null }
        : { ...baseOpts };
      turn = 'w'; from = null; busy = false; finished = false; quiet = 0; resultSaved = false;
      level.newGame();
      seen = new Map(); remember();
      history = []; recap = [];
      kifu = [{ pos: { ...position }, label: '開始', mark: {}, turn: 'w' }];
      recapBox.innerHTML = ''; kifuBox.innerHTML = '';
      tally?.flush();   // 途中でやめた局も記録する
      tally = makeTally('chess');
      quiz.clear(); predict.clear(); predictMsg = null; lastMarks = {};
      ctx.clear(); coach.clear(); paint();
      coach.say(talker.hello());
      tell('あなたの番です。動かしたい駒をタップしてください。');
      paintActions();
    };
    /** 保存した手順を並べ直す（自分の手の前の状態は「1手もどす」用に積む） */
    const replay = (list) => {
      for (const m of list) {
        const who = turn, piece = position[m.f];
        if (!piece || C.colorOf(piece) !== who || !C.legalMoves(position, m.f, opts).includes(m.t)) break;
        if (who === me) history.push({ position: { ...position }, turn, move: { from: m.f, to: m.t }, opts, quiet, seen: new Map(seen), kifuLen: kifu.length });
        const took = isCapture(position, m.f, m.t);
        play(m.f, m.t, m.p || 'Q');
        record(who, m.f, m.t, piece, took, promoOf(piece, m.t, m.p || 'Q'));
        turn = who === 'w' ? 'b' : 'w';
        remember();
      }
      paint(kifu.length > 1 ? kifu[kifu.length - 1].mark : {});
    };
    const startOrResume = () => {
      const sv = saver.load();
      if (!sv || !sv.start) return reset();
      reset({ resume: true, start: sv.start });
      replay(sv.moves);
      busy = true;
      tell('前回の対局が残っています。');
      ctx.say(`<b>前回の続きから指せます</b>${kifu.length - 1}手目まで指してあります。`);
      ctx.actions([
        { label: '続きから指す', variant: 'tone', onClick: () => {
          busy = false; ctx.clear(); paintActions();
          if (turn !== me) aiTurn(); else tell('前回の続きです。あなたの番です。');
        } },
        { label: '新しく始める', variant: 'ghost', onClick: () => reset() },
      ]);
    };
    const tell = (t) => (status.textContent = t);
    const paint = (extra = {}) => board.setPosition(position, extra);
    /** 駒を取る手か（アンパッサンは行き先が空きマスでも取る手） */
    const isCapture = (pos, mfrom, mto) => !!pos[mto]
      || (!!pos[mfrom] && C.kindOf(pos[mfrom]) === 'P' && mfrom[0] !== mto[0]);
    /** 昇格した駒（ミニ盤でも、その盤の最終段で判定する） */
    const promoOf = (piece, mto, promo) => {
      if (!piece || C.kindOf(piece) !== 'P') return null;
      const last = C.colorOf(piece) === 'w' ? String(cfg.h) : '1';
      return mto[1] === last ? (promo || 'Q') : null;
    };

    /** 手を盤に反映する（キャスリング権・アンパッサン・50手ルールの記録も進める） */
    const play = (mfrom, mto, promo = 'Q') => {
      const piece = position[mfrom];
      const irreversible = !!position[mto] || C.kindOf(piece) === 'P';
      const nextOpts = cfg.special ? C.nextRights(opts, position, mfrom, mto) : opts;
      position = C.applyMove(position, mfrom, mto, opts, promo);
      opts = nextOpts;
      quiet = irreversible ? 0 : quiet + 1;
    };

    const verdict = () => {
      if (cfg.check) { const r = cfg.check(position, turn); if (r) return r; }
      const st = C.gameStatus(position, turn, opts);
      if (st === 'checkmate') return turn === me ? 'lose' : 'win';
      if (st === 'stalemate') {
        // ポーンゲームだけは「相手が動けなくなったら勝ち」というルール
        if (cfg.stuckLoses) return turn === me ? 'lose' : 'win';
        return 'draw:stalemate';
      }
      if (cfg.limit && history.length >= cfg.limit) return 'lose:limit';
      if (!cfg.check && C.insufficientMaterial(position)) return 'draw:material';
      if ((seen.get(posKey()) || 0) >= 3) return 'draw:repetition';
      if (quiet >= 100) return 'draw:fifty';
      return null;
    };

    const finish = (r) => {
      // 盤の onPick は外さない（finished で止める）。外すと「もう一局」や「待った」で盤が動かなくなる
      finished = true; busy = false;
      tell('対局が終わりました。');
      quiz.clear(); predict.clear();
      lastResult = r === 'win' ? 'win' : r.startsWith('draw') ? 'draw' : 'lose';
      saver.clear();
      tally.flush();
      // 最初に決まった結果だけを記録する（負けたあと「1手もどす」で指し直して勝っても、勝ちを足さない）。
      // ドリルは対局の勝敗に数えず、そのドリルの相手の強さの調整にだけ使う
      if (!resultSaved) saveResult('chess', level, lastResult, { drill: !!cfg.drill });
      resultSaved = true;
      level.refresh();
      if (r === 'win') {
        // 勝ったあとも、続けてもう一局指せるようにする（以前は「次へ」しか出ず、レッスンを開き直す必要があった）
        ctx.solved(cfg.winMsg || (cfg.drill ? '<b>詰ませました</b>この形は覚えるまでくり返すのがいちばん早いです。'
          : '<b>勝ちました</b>盤の上で最後まで形にできました。'), [{ label: cfg.drill ? 'もう一度' : 'もう一局', variant: 'ghost', onClick: reset }]);
        showRecap(recapBox, recap, (item, marks) => board.setPosition(item.pos, marks), openChessReplay);
        showKifuHere();
        coach.say(showSummary(recapBox, 'chess', tally, talker, 'win'));
        return;
      }
      if (r.startsWith('draw')) {
        ctx.say(`<b>引き分けです</b>${DRAW_REASON[r.split(':')[1]] || ''}。勝ちきるには、詰ませる手順が必要です。`);
      } else if (r === 'lose:limit') {
        ctx.miss();
        ctx.say(cfg.limitMsg || '<b>手数が尽きました</b>詰ませきれませんでした。キングを盤の端に追い込んでから、最後に王手をかけるのが基本の順番です。もう一度やってみましょう。', 'ng');
      } else {
        ctx.miss();
        ctx.say(cfg.loseMsg || '<b>今回は負けました</b>もう一局やってみましょう。負けた局の方が身につきます。', 'ng');
      }
      ctx.actions([
        { label: 'もう一局', variant: 'tone', onClick: reset },
        { label: '1手もどす', variant: 'ghost', onClick: undo, disabled: !history.length },
        // 勝てなかった局で先へ進むときは「一発正解」には数えない
        { label: '次へ進む', variant: 'ghost', onClick: () => { ctx.miss(); ctx.solved(); ctx.advance(); } },
      ]);
      showRecap(recapBox, recap, (item, marks) => board.setPosition(item.pos, marks), openChessReplay);
      showKifuHere();
      coach.say(showSummary(recapBox, 'chess', tally, talker, lastResult));
    };

    const aiTurn = async () => {
      const my = ++token;
      busy = true; tell('相手が考えています…');
      await wait(420 + pauseNext); pauseNext = 0;
      if (my !== token || finished || !ctx.alive()) return;   // 考えている間に待った／最初からが押された
      const lvl = level();
      const legal = C.allLegalMoves(position, foe, opts);
      // やさしい：4回に1回は気まぐれな手を指す
      const mv = lvl === 'easy' && legal.length && Math.random() < 0.25
        ? legal[(Math.random() * legal.length) | 0]
        : await NS_THINK.pickMove('chess', [position, foe, opts, levelDepth(lvl, cfg.depth)]);
      if (my !== token || finished || !ctx.alive()) return;   // 考えている間に待った／最初からが押された
      if (!mv) { busy = false; return finish(verdict() || 'draw:stalemate'); }
      const took = isCapture(position, mv.from, mv.to);
      const movedPiece = position[mv.from];
      // 取られた自分の駒（アンパッサンは行き先が空きマス）
      const victim = took ? (position[mv.to] || position[mv.to[0] + mv.from[1]] || null) : null;
      play(mv.from, mv.to);
      record(foe, mv.from, mv.to, movedPiece, took, promoOf(movedPiece, mv.to, 'Q'));
      persist();
      lastMarks = { [mv.from]: 'hint', [mv.to]: 'hint' };
      took ? sfx.capture('chess') : sfx.place('chess');
      predictMsg = predict.settle(mv);
      turn = me;
      remember();
      paint({ [mv.from]: 'last', [mv.to]: 'last' });
      busy = false;
      const r = verdict();
      if (r) return finish(r);
      tell(C.inCheck(position, me, opts) ? 'あなたのキングがチェックされています。' : 'あなたの番です。');
      warnThreat();
      if (!quiz.active) chessTheirs(mv, victim);
      if (predictMsg) { status.textContent = `${predictMsg} ${status.textContent}`; predictMsg = null; }
      paintActions();
    };

    /** 相手の次の狙いを知らせる（コーチがオンのときだけ）。詰み → 取られる駒 の順 */
    function warnThreat() {
      if (!coach.on) return;
      let th = null;
      const mates = C.findMateIn1(position, foe, opts);
      if (mates.length) {
        const m = mates[0];
        th = { kind: 'mate', answers: [m.to], text: `注意：相手は次に ${m.from}→${m.to} で詰ませる狙いがあります。`,
          marks: { [m.from]: 'hint', [m.to]: 'ng' } };
      } else {
        const h = K.hanging('chess', position, me, opts)[0];
        if (h && h.loss >= 3) th = { kind: 'hang', answers: [h.sq], text: `注意：${h.sq}の${h.name}が、${h.by.from}の${h.by.name}に狙われています。`,
          marks: { [h.sq]: 'ng', [h.by.from]: 'hint' } };
      }
      if (!th) return;
      // 設定で「先に質問する」なら、答えを言う前に自分で探してもらう
      if (settings.get('askThreat') !== false) quiz.start(th, lastMarks);
      else { tell(th.text); if (th.kind === 'mate') paint(th.marks); }
    }

    /** 相手が指したあとのひとこと：チェック → 取られた駒（取り返せるか）→ タダで取れる駒 → 序盤・終盤のコツ */
    function chessTheirs(mv, victim) {
      if (!coach.on || finished) return;
      const kSq = Object.keys(position).find((k) => position[k] === (me === 'w' ? 'K' : 'k'));
      if (kSq && C.inCheck(position, me, opts)) {
        const atk = K.attackers('chess', position, kSq, foe, opts);
        coach.say({ text: pickOne(['チェックされました！ キングを逃がす・間に駒を入れる・チェックしている駒を取る、の3つから選びます。',
          'チェックです！ まず、チェックしている駒を取れないか見てみましょう。']), mood: 'alert' });
        if (atk.length) board.flash(atk.slice(0, 2).map((a) => ({ from: a.from, to: kSq, c: 'ng' })));
        return;
      }
      if (victim) {
        const name = C.PIECE_JA[C.kindOf(victim)];
        const back = K.freeCaptures('chess', position, me, opts).find((m) => m.to === mv.to);
        if (back) {
          coach.say({ text: pickOne([`${name}を取られました。でも、取り返せます！`, `${name}を取られましたが、${back.piece}で取り返せますよ。`]), mood: 'think' });
          board.flash([{ from: back.from, to: back.to, c: 'ok' }]);
        } else {
          coach.say({ text: pickOne([`${name}を取られてしまいました。取られる前に、守るか逃げるかを考えましょう。`,
            `あっ、${name}が取られました。相手の駒がどこまで届くか、1枚ずつたどるクセをつけましょう。`]), mood: 'hmm' });
        }
        return;
      }
      if (K.freeCaptures('chess', position, me, opts).some((m) => m.safe && m.gain >= 3)) {
        coach.say({ text: pickOne(['おっ、チャンスかも。タダで取れる駒がありますよ。探してみて！', '盤をよく見て。相手の駒で、誰にも守られていないものがあります。']), mood: 'happy' });
        return;
      }
      if (talker.lastBad) return;   // 自分の手の指摘を読んでいるところなので、急がないひとことで上書きしない
      const n = history.length;
      let t = null;
      if (cfg.special) {
        const rights = opts.castle?.[me];
        const kHome = position[me === 'w' ? 'e1' : 'e8'] === (me === 'w' ? 'K' : 'k');
        if (n <= 1) t = talker.once('open1', '序盤は、まん中のポーンを進めて、ナイトとビショップを外へ出しましょう。');
        else if (n >= 5 && n <= 12 && kHome && rights && (rights.k || rights.q)) t = talker.once('castle', 'そろそろキャスリングで、キングを安全な端へ移しましょう。キングとルークの間の駒をどかすとできます。');
      }
      if (!t && cfg.w === 8 && !cfg.check && !cfg.drill
        && Object.values(position).filter((p) => !['K', 'P'].includes(C.kindOf(p))).length <= 4) {
        t = talker.once('endgame', '駒が少なくなってきました。終盤はキングも大事な戦力です。前に出して使いましょう。');
      }
      if (t) { coach.say(t); return; }
      if (n % 3 === 1 && position[mv.to]) {
        const nm = C.PIECE_JA[C.kindOf(position[mv.to])];
        coach.say({ text: pickOne([`相手は${nm}を${mv.to}へ動かしました。その${nm}は、次にどこへ届くかな？`, `相手の${nm}が動きました。新しく狙われた駒はないか、見てみましょう。`]), mood: 'think' });
      }
    }
    /** 序盤の原則のひとこと（本物の盤・自分の12手目まで）。悪手には数えない */
    function chessOpeningTip(beforeMove, beforeOpts, mfrom, sq, piece, took) {
      const n = history.length;
      // レッスンに独自の「めあて」があるときは、そちらに任せる（同じことを二重に言わない）
      if (n > 12 || !piece || (s.goals || []).length) return null;
      const kind = C.kindOf(piece);
      if (kind === 'K' && Math.abs(mfrom.charCodeAt(0) - sq.charCodeAt(0)) === 2) {
        return talker.first('castled') ? { kind: 'tip', what: 'キャスリングしました',
          why: 'キングを端の安全な場所へ移しながら、ルークを真ん中へ近づける、一石二鳥の手です。',
          talk: pickOne(['キャスリング成功！ キングが安全になって、ルークも働きやすくなりました。', 'ナイスキャスリング！ これでキングは安心です。']),
          mood: 'happy', marks: {}, lesson: '' } : null;
      }
      const rights = beforeOpts.castle?.[me];
      if (kind === 'K' && rights && (rights.k || rights.q) && talker.first('oking')) {
        return { kind: 'tip', what: 'キングを動かしたので、もうキャスリングはできません',
          why: 'キャスリングは、キングもルークも一度も動いていないときだけできます。序盤はキングを動かさず、キャスリングを目指しましょう。',
          talk: 'キングが動きました。これで、もうキャスリングはできません。序盤はキングを動かさないのがコツです。',
          mood: 'hmm', marks: { [sq]: 'hint' }, lesson: '' };
      }
      if (kind === 'Q' && n <= 4 && !took && talker.first('oqueen')) {
        return { kind: 'tip', what: '序盤に、クイーンを早く出しました',
          why: 'クイーンは強いぶん、相手のナイトやビショップに追い回されて、そのたびに逃げる手が必要になります。',
          talk: 'クイーンが早く出ましたね。追い回されやすいので、先にナイトとビショップを出すのがおすすめです。',
          mood: 'hmm', marks: { [sq]: 'hint' }, lesson: '' };
      }
      if ((kind === 'N' || kind === 'B') && n <= 8 && !took) {
        const movedBefore = history.slice(0, -1).some((h) => h.move.to === mfrom);
        const home = me === 'w' ? ['b1', 'g1', 'c1', 'f1'] : ['b8', 'g8', 'c8', 'f8'];
        const waiting = home.filter((q) => beforeMove[q] && C.colorOf(beforeMove[q]) === me && ['N', 'B'].includes(C.kindOf(beforeMove[q]))).length;
        const fled = K.hanging('chess', beforeMove, me, beforeOpts).some((h) => h.sq === mfrom);
        if (movedBefore && waiting >= 1 && !fled && talker.first('otwice')) {
          return { kind: 'tip', what: '序盤に、同じ駒を2回動かしました',
            why: 'まだ出ていない駒があるうちは、新しい駒を1つずつ出すほうが、全体の働きが早くそろいます。',
            talk: '同じ駒を2回動かしましたね。序盤は、まだ出ていない駒を1つずつ出していくのが近道です。',
            mood: 'think', marks: { [sq]: 'hint' }, lesson: '' };
        }
      }
      return null;
    }

    board.onPick = (sq) => {
      if (predict.active) { predict.pick(sq, () => aiTurn()); return; }
      if (busy || finished || turn !== me) return;
      if (quiz.active) { quiz.pick(sq); return; }
      if (from === null) {
        if (!position[sq] || C.colorOf(position[sq]) !== me) return;
        from = sq;
        paint(hintMarks(sq));
        return;
      }
      if (sq === from) { from = null; paint(); return; }
      const targets = C.legalMoves(position, from, opts);
      if (!targets.includes(sq)) {
        if (position[sq] && C.colorOf(position[sq]) === me) {
          from = sq;
          paint(hintMarks(sq));
        }
        return;
      }
      const mfrom = from;
      // 本物の盤では、昇格する駒を選べる（ミニ盤は学習段階なので自動でクイーン）
      const lastRank = me === 'w' ? String(cfg.h) : '1';
      if (cfg.special && C.kindOf(position[mfrom]) === 'P' && sq[1] === lastRank && !pendingPromo) {
        pendingPromo = true;
        busy = true;
        const my = token;
        askChessPromo((k) => {
          pendingPromo = false;
          if (my !== token) return;   // 選んでいる間に「待った」「最初から」が押された
          busy = false;
          // 「やめる」：まだ指していないので、駒を選び直せる状態に戻すだけ（1手前には戻さない）
          if (!k) { from = null; paint(); tell('あなたの番です。動かしたい駒をタップしてください。'); return; }
          from = mfrom;
          commitMove(mfrom, sq, k);
        });
        return;
      }
      commitMove(mfrom, sq, 'Q');
    };

    let pendingPromo = false;
    let promoBox = null;
    /** 昇格の選択。「1手もどす」などは残したいので actions ではなく盤の下に出す */
    function askChessPromo(done) {
      promoBox?.remove();
      promoBox = el('div', 'actions');
      promoBox.setAttribute('role', 'group');
      promoBox.setAttribute('aria-label', '昇格する駒を選んでください');
      promoBox.appendChild(el('span', 'note', '何に昇格しますか？'));
      [['Q', 'クイーン'], ['R', 'ルーク'], ['B', 'ビショップ'], ['N', 'ナイト']].forEach(([k, ja], i) => {
        const b = el('button', `btn btn--sm ${i === 0 ? 'btn--tone' : 'btn--ghost'}`, ja);
        b.addEventListener('click', () => { promoBox?.remove(); promoBox = null; done(k); });
        promoBox.appendChild(b);
      });
      const cancel = el('button', 'btn btn--sm btn--ghost', 'やめる');
      cancel.addEventListener('click', () => { promoBox?.remove(); promoBox = null; done(null); });
      promoBox.appendChild(cancel);
      status.after(promoBox);
      promoBox.querySelector('button')?.focus();
    }

    async function commitMove(mfrom, sq, promo) {
      const took = isCapture(position, mfrom, sq);
      const beforeMove = position;
      const beforeOpts = opts;
      history.push({ position: { ...position }, turn, move: { from: mfrom, to: sq }, opts, quiet, seen: new Map(seen), kifuLen: kifu.length });
      const movedPiece = position[mfrom];
      play(mfrom, sq, promo);
      record(me, mfrom, sq, movedPiece, took, promoOf(movedPiece, sq, promo));
      turn = foe;
      remember();
      persist();
      took ? sfx.capture('chess') : sfx.place('chess');
      const r = verdict();
      // 講評の読み（最大1秒ほど）の前に、指した手をまず盤に描く
      const myTok = ++token;
      paint({ [mfrom]: 'last', [sq]: 'last' });
      if (!r) tell('講評を考えています…');
      // 講評の読み（詰みの確認と取り合いの読みで最大1秒ほど）は別スレッドで。そのあいだも画面は動く
      const review = await NS_THINK.run('chessReview', [{ beforeMove, beforeOpts, position, opts, me, foe, mfrom, sq, special: !!cfg.check }],
        10000, () => ({ rv: { level: 'ok', lines: [] } }));   // 時間切れなら、この手の講評は出さずに進める
      if (myTok !== token || !ctx.alive()) return;   // そのあいだに「1手もどす」「最初から」が押された
      const { mate, missedMate, missedMateN, rv } = review;
      // 本物の盤の序盤：キャスリング・キングを動かす・クイーンを早く出す・同じ駒を2回（悪手には数えないひとこと）
      if (cfg.special && !r && rv.level === 'ok') {
        const tip = chessOpeningTip(beforeMove, beforeOpts, mfrom, sq, movedPiece, took);
        if (tip) rv.lines.push(tip);
      }
      if (rv.level !== 'ok') {
        recap.push({ n: history.length, pos: beforeMove, move: { from: mfrom, to: sq }, rv });
        // 自分の悪手から問題を作る（あとで「自分の悪手から」で解き直せる）
        const kind = review.kind;
        const extra = {};
        if (kind === 'missedmate' && missedMate) {
          Object.assign(extra, { answers: [{ from: missedMate.from, to: missedMate.to }], acceptMate: true, acceptStillMating: missedMateN > 1 });
        } else if (kind === 'missed') {
          const caps = review.caps || [];
          const top = caps.length ? caps[0].gain : 0;
          extra.answers = caps.filter((c) => c.gain === top).map((c) => ({ from: c.from, to: c.to }));
          extra.acceptMate = true;
        } else if (kind === 'allowmate') {
          extra.acceptNoMate = true;
          extra.unsolvable = review.unsolvable;
        }
        saveMoveMistake('chess', rv, { board: { ...beforeMove }, side: me, w: cfg.w, h: cfg.h, ...(beforeOpts.castle ? { castle: beforeOpts.castle } : {}) },
          { from: mfrom, to: sq }, extra);
      }
      tally.add(rv);
      const gl = r === 'win' ? [] : checkGoals(s.goals, {
        before: beforeMove, after: position, move: { from: mfrom, to: sq }, color: me, ctx: beforeOpts,
        // ply は両者の手を数えた手数（白の n 手目 = 2n−1）
        ply: history.length * 2 - 1, history,
      });
      // 目標にそぐわない指摘は先に、できている報告は後に回す
      rv.lines = [...gl.filter((g) => !g.ok), ...rv.lines, ...gl.filter((g) => g.ok)];
      if (gl.some((g) => !g.ok) && rv.level === 'ok') rv.level = 'miss';
      // 読み筋の再生用：駒の損得や詰みがからむ指摘のときだけ、指す前後の局面を添える
      if (rv.level !== 'ok' && rv.lines.some((l) => !['goal', 'good', 'tip', 'nopromo'].includes(l.kind))) {
        const sug = rv.lines.find((l) => l.better?.from && l.better?.to)?.better;
        rv.replay = { before: { ...beforeMove }, beforeOpts: { ...beforeOpts }, after: { ...position },
          move: { from: mfrom, to: sq, promo: promoOf(movedPiece, sq, promo) },
          alt: sug ? { from: sug.from, to: sug.to } : null,
          focus: ['missed', 'missedmate', 'deepmiss'].includes(rv.lines.find((l) => !['goal', 'good', 'tip'].includes(l.kind))?.kind) ? 'best' : 'played' };
      }
      coach.show(rv);
      // 講評が触れているマスを盤の上でも示す。文章だけでは探せない
      const cm = rv.lines.find((l) => l.marks && Object.keys(l.marks).length);
      paint({ [mfrom]: 'last', [sq]: 'last', ...(cm ? cm.marks : {}) });
      // コーチのひとことと、盤の矢印（狙っている駒 → 狙われている駒、緑は「こうすれば」）
      const said = talker.mine(rv);
      if (said) { coach.say(said); if (coach.on && said.arrows?.length) board.flash(said.arrows); }
      pauseNext = coach.on ? coachPause(rv, said) : 0;
      from = null;
      if (r) return finish(r);
      // 3手に1回、相手の応手を予想してもらう（読む力がいちばん伸びる練習）
      if (!cfg.drill && predict.ask(history.length, () => aiTurn())) return;
      aiTurn();
    };

    const undo = () => {
      const prev = history.pop();
      if (!prev) return;
      token++;   // 考え中のAIの手を捨てる
      position = prev.position; turn = prev.turn; opts = prev.opts; quiet = prev.quiet; seen = prev.seen;
      kifu.length = prev.kifuLen; kifuBox.innerHTML = '';
      promoBox?.remove(); promoBox = null; pendingPromo = false;
      recap = recap.filter((x) => x.n <= history.length);
      recapBox.innerHTML = '';
      from = null; busy = false; finished = false;
      quiz.clear(); predict.clear(); predictMsg = null;
      coach.clear(); ctx.clear(); paint();
      coach.say({ text: pickOne(['1手もどしました。今度はどう指しますか？', 'やり直しです。指す前に「その駒、取られない？」を確かめましょう。']), mood: 'think' });
      tell('1手もどしました。もう一度どうぞ。');
      paintActions();
      persist();
    };

    function paintActions() {
      ctx.actions([
        { label: '1手もどす', variant: 'ghost', onClick: undo, disabled: !history.length },
        { label: '最初から', variant: 'ghost', onClick: reset },
      ]);
    }

    startOrResume();
  }

  // ── 将棋 ──────────────────────────────────────────────────
  /**
   * 寄せの型ドリル。裸の玉を、決まった戦力で詰ませきる練習。毎回ちがう配置で出す。
   * hands は自分の持ち駒。limit は自分の手数の上限。
   */
  const SHOGI_DRILLS = {
    drill_kin: {
      limit: 16, hands: { G: 3 }, rank: 1,
      board: [],
      prompt: '<strong>持ち駒の金3枚だけで詰ませる</strong>練習です。最上段に逃げた玉を、金で押さえて頭金。16手以内に詰ませてください。',
      win: '金3枚で相手の玉を詰ませる（16手以内）',
    },
    drill_hisha: {
      limit: 12, hands: {}, board: ['R', 'R'], rank: 2,
      prompt: '<strong>飛車2枚で追い詰める</strong>練習です。段を1つずつ空けさせて、玉を端まで追い込みます。12手以内に詰ませてください。',
      win: '飛車2枚で相手の玉を詰ませる（12手以内）',
    },
    drill_ryu: {
      limit: 14, hands: { G: 1 }, board: ['+R'], rank: 3,
      prompt: '<strong>竜（成り飛車）と金1枚</strong>で詰ませる練習です。竜で逃げ道を押さえ、金を打ち込みます。14手以内に詰ませてください。',
      win: '竜と金で相手の玉を詰ませる（14手以内）',
    },
  };
  for (const [id, d] of Object.entries(SHOGI_DRILLS)) {
    d.make = () => {
      const sq = (f, r) => `${f}${r}`;
      for (let t = 0; t < 300; t++) {
        const used = new Set();
        const pick = () => {
          for (let k = 0; k < 40; k++) {
            const c = sq(1 + ((Math.random() * 9) | 0), 1 + ((Math.random() * 9) | 0));
            if (!used.has(c)) { used.add(c); return c; }
          }
          return null;
        };
        const board = {};
        const ok = (x) => x && Number(x[1]) >= 5;   // 自分の駒は下段寄りに置く
        const kSq = sq(1 + ((Math.random() * 9) | 0), 1 + ((Math.random() * (d.rank || 3)) | 0));   // 相手玉は上段
        used.add(kSq); board[kSq] = 'k';
        let my = pick(); while (!ok(my)) { my = pick(); if (!my) break; }
        if (!my) continue;
        board[my] = 'K';
        let bad = false;
        for (const p of d.board) { const c = pick(); if (!c) { bad = true; break; } board[c] = p; }
        if (bad) continue;
        const st = { board, hands: { b: { ...d.hands }, w: {} }, turn: 'b' };
        // 相手の玉がいきなり王手になっている配置・すぐ駒を取られる配置は使わない
        if (SH.inCheck(board, 'w', SH.BIG)) continue;
        if (SH.allLegalMoves({ ...st, turn: 'w' }, SH.BIG).some((m) => board[m.to] && SH.colorOf(board[m.to]) === 'b')) continue;
        return st;
      }
      return { board: { 51: 'k', 59: 'K' }, hands: { b: { ...d.hands }, w: {} }, turn: 'b' };
    };
  }

  /**
   * 駒落ちチャレンジの段階。上手（相手）が落とす駒の多い順。勝てば次の段階（上手の駒が増える）へ進み、平手で勝てば達成。
   * elo：持ち点の計算で、その手合いの相手を「ふつう」よりどれだけ弱く見るか（目安）。tip：下手の作戦のひとこと
   */
  const KOMAOCHI = [
    { name: '十枚落ち', elo: 800, tip: '上手には玉と歩しかありません。飛車・角・金・銀をそろえて、数で攻めれば崩れます。' },
    { name: '八枚落ち', elo: 700, tip: '上手には金2枚と歩しかありません。飛車と角を両方使い、駒の数で攻めます。' },
    { name: '六枚落ち', elo: 600, tip: '上手には飛車・角・香・桂がありません。9筋の端に香・角・飛車を集めて攻めるのが定跡です。' },
    { name: '四枚落ち', elo: 500, tip: '上手には飛車・角・香がありません。六枚落ちと同じく、端に駒を集めて攻めるのが有力です。' },
    { name: '二枚落ち', elo: 400, tip: '上手には飛車と角がありません。銀を前に出し、歩を突いて攻めます（定跡は「二歩突っ切り」「銀多伝」など）。' },
    { name: '飛香落ち', elo: 300, tip: '上手には飛車と左の香がありません。飛車の利きがないので、右四間飛車や棒銀の攻めが通りやすい手合いです。' },
    { name: '飛車落ち', elo: 250, tip: '上手には飛車がありません。右四間飛車や棒銀で攻めるのが定番です。' },
    { name: '角落ち', elo: 200, tip: '上手には角がありません。角の斜めの利きを気にせずに、棒銀などで攻められます。' },
    { name: '香落ち', elo: 100, tip: '上手には左の香（1一）がありません。1筋の端が弱くなっています。' },
    { name: '平手', elo: 0, tip: '平手です。あなたが先手で、駒の数は同じ。玉を囲ってから攻めましょう。' },
  ];
  const KOMAOCHI_KEY = 'shogiChallenge.big', KOMAOCHI_LOSS = 'shogiChallenge.big.loss';
  /** いまの段階（この端末に記録した段階。なければ問題の指定、それもなければ六枚落ち） */
  function komaochiStage(def) {
    const at = (name) => KOMAOCHI.findIndex((x) => x.name === name);
    const i = at(settings.get(KOMAOCHI_KEY) || def || '六枚落ち');
    return i >= 0 ? i : at('六枚落ち');
  }
  /** 駒落ちの開始局面。上手は後手（上側）で、駒を落とした側から指し始める */
  function komaochiStart(name) {
    const st = SH.startBig();
    for (const sq of HANDICAP[name] || []) delete st.board[sq];
    return { ...st, turn: name === '平手' ? 'b' : 'w' };
  }
  /** 勝てば1つ進み、2回続けて負けたら1つ戻る（置き碁チャレンジと同じ）。返り値 { i, loss, note } */
  function komaochiNext(i, won, loss) {
    if (won) {
      if (i >= KOMAOCHI.length - 1) return { i, loss: 0, note: '平手で勝ちました。挑戦達成です！ 次は通常の対局で「相手の強さ」を上げて挑戦してみましょう。' };
      return { i: i + 1, loss: 0, note: `挑戦の段階が進みました。次は${KOMAOCHI[i + 1].name}です。` };
    }
    const l = loss + 1;
    if (l >= 2) {
      if (i <= 0) return { i, loss: 0, note: 'これより多くは駒を落とせません。同じ手合いで、もう一度挑戦しましょう。' };
      return { i: i - 1, loss: 0, note: `2回続けて負けたので、次は${KOMAOCHI[i - 1].name}にします。` };
    }
    return { i, loss: l, note: 'もう1回続けて負けると、1つ前の手合い（上手の駒が少ない方）に戻します。' };
  }

  function playShogi(ctx, { Board, renderHand, S }) {
    const s = ctx.step;
    const variant = s.variant || 'mini';
    const drill = SHOGI_DRILLS[variant] || null;
    const shape = drill ? S.BIG : variant === 'mini' ? S.MINI : variant === 'gogo' ? S.GOGO : S.BIG;
    // 駒落ちチャレンジ（本将棋だけ）：上手（相手）が駒を落として先に指す。相手の強さは固定で、勝つと上手の駒が増える
    const challenge = !!s.challenge && variant === 'big' && !drill;
    let stage = challenge ? komaochiStage(s.handicap) : -1;
    let gameHc = null;   // この局の手合い（挑戦で次の段階に進んでも、棋譜と記録はこの局のまま）
    const stageName = () => (stage >= 0 ? KOMAOCHI[stage].name : '平手');
    const start = challenge ? () => komaochiStart(stageName())
      : drill ? drill.make : variant === 'mini' ? S.startMini : variant === 'gogo' ? S.startGogo : S.startBig;
    const depth = variant === 'big' || drill ? 2 : 3;

    const setPrompt = () => ctx.prompt(s.prompt || drill?.prompt || (challenge && stageName() !== '平手'
      ? `駒落ち（${stageName()}）です。あなたは下手（下側）。上手（相手）が駒を落とし、上手から指します。相手の玉を詰ませば勝ちです。`
      : 'あなたは先手（下側）です。相手の玉を詰ませば勝ちです。'));
    setPrompt();
    const level = aiLevelPicker(ctx, { variant, rated: RATED_VARIANTS.shogi.includes(variant) });
    const chNote = el('p', 'note');
    const showCh = () => {
      const nx = KOMAOCHI[stage + 1];
      chNote.innerHTML = `挑戦の段階：<b>${stageName()}</b>（${nx ? `勝つと${nx.name}に進みます` : 'ここで勝てば挑戦達成です'}）`
        + `<br>${KOMAOCHI[stage].tip}`
        + `<br>相手の強さ：${LEVEL_JA[s.level || 'normal']}（挑戦のあいだは固定）`;
    };
    if (challenge) {
      // 強さの選択は出さない（段階の意味が変わらないように固定する）。置き碁チャレンジと同じ
      const lv = ctx.mount.querySelector('label.ailevel');
      if (lv) { const nx = lv.nextElementSibling; lv.remove(); if (nx && /いまは/.test(nx.textContent || '')) nx.remove(); }
      ctx.mount.appendChild(chNote);
      showCh();
    }
    const foeHandHost = el('div', 'hand');
    const host = ctx.boardHost();
    const myHandHost = el('div', 'hand');
    const status = el('p', 'note');
    ctx.mount.insertBefore(foeHandHost, host);
    ctx.mount.append(myHandHost, status);

    const board = new Board(host, { variant: 'shogi', w: shape.w, h: shape.h, coords: true });
    let state, from, dropKind, busy, finished, seen;
    let trail = [];  // 局面の履歴：{ k, by（指した側）, check（その手が王手か） }。連続王手の千日手の判定に使う
    let kifu = [];   // 棋譜
    let history = [];
    let recap = [];  // 振り返り用
    let pauseNext = 0;  // コーチが指摘した直後に、相手が待つ時間（ミリ秒）
    let tally = null;    // この局の講評の集計
    let lastMarks = {};  // 相手の直前の手
    let token = 0;   // 待った・最初からで、考え中の相手の手を捨てるための番号

    const sameShogiMove = (a, b) => a.to === b.to && (a.from || null) === (b.from || null)
      && (a.drop || null) === (b.drop || null) && !!a.promote === !!b.promote;
    /** 読み筋の再生：持ち駒から打つ手・取って持ち駒に入る駒・成りも、動きで見せる */
    const openShogiReplay = (data, opener) => {
      const panel = openReplay({ title: '読み筋', variant: 'shogi', w: shape.w, h: shape.h, tone: 'shogi', me: 'b', opener });
      panel.preview(data.before.board, data.before.hands);
      const name = (m) => S.moveLabel(data.before, m, shape);
      NS_THINK.run('lines', ['shogi', data.before, data.after, shape, 1500, data.alt], 10000, () => null)
        .then((res) => {
          if (!res || !res.best || !res.reply) { panel.fail('読み筋を読み切れませんでした。'); return; }
          const played = data.move;
          const lines = [{
            label: 'あなたの手のあと',
            intro: `あなたの手（${name(played)}）のあと、相手のいちばん良い続きです。`,
            frames: shogiFrames(data.before, [played, ...res.reply.pv], 'b', shape),
          }];
          // 「こうすれば」の手があれば、その手から。なければ読みの最善手から
          const bestLine = res.altMove && res.altReply ? [res.altMove, ...res.altReply.pv] : res.best.pv;
          const first = bestLine[0];
          if (first && !sameShogiMove(first, played)) {
            lines.push({
              label: '本当はこう指せた',
              intro: res.altMove ? `コーチのおすすめ（${name(first)}）のあとの、いちばん良い続きです。` : `${name(first)} から始まる、いちばん良い手順です。`,
              frames: shogiFrames(data.before, bestLine, 'b', shape),
            });
          }
          // 見逃しの指摘（取れた駒・詰み）のときは、「本当はこう指せた」を先に見せる
          if (lines.length > 1 && data.focus === 'best') lines.reverse();
          panel.setLines(lines);
        })
        .catch(() => panel.fail('読み筋を読み切れませんでした。'));
    };
    const coach = makeCoach(ctx, {
      goals: s.goals || [],
      onUndo: () => undo(),
      onShowBetter: (line) => board.setPosition(state.board, line.marks),
      onReplay: openShogiReplay,
    });
    const talker = makeTalker('shogi', drill ? '相手の玉の逃げ道を、1つずつふさいでいきましょう。持ち駒は、玉の頭や逃げ道に打つと効きます。'
      : variant === 'mini' ? '小さな盤の将棋です。取った駒は、自分の持ち駒として打てますよ。' : null);
    const recapBox = el('div', 'recap');
    ctx.mount.appendChild(recapBox);
    const kifuBox = el('div', 'kifu');
    ctx.mount.appendChild(kifuBox);
    const showRecapHere = () => showRecap(recapBox, recap, (item, marks) => board.setPosition(item.pos, marks), openShogiReplay);

    /** 相手の次の狙い（持ち駒の打ち込みも含めた1手詰め → 取られる駒） */
    const quiz = makeThreatQuiz({ status, paint: (m) => paint(m), say: (t) => coach.say(t) });
    const jpSq = (x) => `${x[0]}${'〇一二三四五六七八九'[Number(x[1])]}`;
    const predict = makePredictDrill({ status, game: 'shogi', label: (mv) => (mv.drop ? `${jpSq(mv.to)}に駒を打つ手` : ` ${jpSq(mv.from)}→${jpSq(mv.to)} `) });
    let predictMsg = null;
    function warnThreat() {
      if (!coach.on) return;
      const jp = (x) => `${x[0]}${'〇一二三四五六七八九'[Number(x[1])]}`;
      let th = null;
      const mates = S.findMateIn1({ ...state, turn: 'w' }, shape);
      if (mates.length) {
        const m = mates[0];
        th = { kind: 'mate', answers: [m.to],
          text: `注意：相手は次に${m.drop ? `${jp(m.to)}への駒打ち` : `${jp(m.from)}→${jp(m.to)}`}で詰ませる狙いがあります。`,
          marks: { ...(m.from ? { [m.from]: 'hint' } : {}), [m.to]: 'ng' } };
      } else {
        const h = K.hanging('shogi', state.board, 'b', shape)[0];
        if (h && h.loss >= 3) th = { kind: 'hang', answers: [h.sq],
          text: `注意：${jp(h.sq)}の${h.name}が、${jp(h.by.from)}の${h.by.name}に狙われています。`,
          marks: { [h.sq]: 'ng', [h.by.from]: 'hint' } };
      }
      if (!th) return;
      if (settings.get('askThreat') !== false) quiz.start(th, lastMarks);
      else { tell(th.text); if (th.kind === 'mate') paint(th.marks); }
    }
    const hintMarks = (sq) => K.moveMarks('shogi', state.board, sq,
      [...new Set(S.legalMovesFrom(state, sq, shape).map((m) => m.to))], 'b', shape, {
        showMoves: settings.get('showMoves'),
        warnUnsafe: settings.get('warnUnsafe'),
        showThreat: settings.get('showThreat'),
      });
    const tell = (t) => (status.textContent = t);
    const key = () => state.turn + JSON.stringify(state.board) + JSON.stringify(state.hands);
    /** by：いま指した側（開始局面なら null） */
    const remember = (by = null) => {
      const k = key();
      seen.set(k, (seen.get(k) || 0) + 1);
      trail.push({ k, by, check: by ? S.inCheck(state.board, S.opponent(by), shape) : false });
    };
    const record = (before, mv) => kifu.push({
      board: { ...state.board }, hands: S.cloneHands(state.hands), mover: before.turn, turn: state.turn,
      mv: { ...mv, piece: mv.from ? before.board[mv.from] : null },
      label: `${before.turn === 'b' ? '▲' : '△'}${S.moveLabel(before, mv, shape)}`,
      mark: { ...(mv.from ? { [mv.from]: 'last' } : {}), [mv.to]: 'last' },
    });
    const saver = gameSaver(`bangi.save.${ctx.lesson.id}.${variant}`);
    const persist = () => (finished ? saver.clear() : saver.save({
      start: { board: kifu[0].board, hands: kifu[0].hands, turn: kifu[0].turn || 'b' },
      ...(gameHc ? { hc: gameHc } : {}),
      moves: kifu.slice(1).map((f) => ({ from: f.mv.from || null, to: f.mv.to, drop: f.mv.drop || null, promote: !!f.mv.promote })),
    }));
    const showKifuHere = () => showKifu(kifuBox, kifu, (f) => {
      board.setPosition(f.board, f.mark);
      renderHand(foeHandHost, f.hands.w, { label: '相手の持ち駒', order: S.HAND_ORDER });
      renderHand(myHandHost, f.hands.b, { label: 'あなたの持ち駒', order: S.HAND_ORDER });
    }, {
      me: 'b', unit: 2,
      evalOf: (f) => NS_THINK.run('eval', ['shogi', { board: f.board, hands: f.hands, turn: f.turn }, shape, 110]).then((v) => (f.turn === 'b' ? v : -v)),
      exportName: 'KIF',
      exportText: () => (variant === 'big' ? '' : '# ※小さい盤の対局です。通常の将棋ソフトでは読み込めません\n') + toKIF(kifu, lastResult, shape, { handicap: gameHc }),
    });
    let lastResult = null;
    let resultSaved = false;   // この局の勝敗をもう記録したか（「1手もどす」で指し直しても二重に記録しない）

    const paintHands = () => {
      renderHand(foeHandHost, state.hands.w, { label: '相手の持ち駒', order: S.HAND_ORDER });
      renderHand(myHandHost, state.hands.b, {
        label: 'あなたの持ち駒', order: S.HAND_ORDER, selected: dropKind,
        onPick: (k) => {
          if (busy || finished || state.turn !== 'b' || quiz.active) return;
          dropKind = dropKind === k ? null : k;
          from = null;
          const m = {};
          if (dropKind) for (const t of S.legalDrops(state, dropKind, shape)) m[t] = 'move';
          paint(m);
          paintHands();
        },
      });
    };
    const paint = (extra = {}) => board.setPosition(state.board, extra);

    const reset = (opt) => {
      const resume = !!(opt && opt.resume === true);
      if (!resume) saver.clear();
      token++;
      // 途中保存から戻すときは、その局の手合いに合わせる
      if (challenge && resume && opt.hc) { const i = KOMAOCHI.findIndex((x) => x.name === opt.hc); if (i >= 0) { stage = i; showCh(); } }
      gameHc = challenge ? stageName() : null;
      setPrompt();
      state = resume ? { board: { ...opt.start.board }, hands: S.cloneHands(opt.start.hands), turn: opt.start.turn || 'b' } : start(); from = null; dropKind = null; busy = false; finished = false; resultSaved = false;
      level.newGame();
      seen = new Map(); trail = []; remember();
      history = []; recap = [];
      kifu = [{ board: { ...state.board }, hands: S.cloneHands(state.hands), label: gameHc && gameHc !== '平手' ? `開始（${gameHc}）` : '開始', mark: {}, turn: state.turn }];
      recapBox.innerHTML = ''; kifuBox.innerHTML = '';
      tally?.flush();
      tally = makeTally('shogi');
      quiz.clear(); predict.clear(); predictMsg = null; lastMarks = {};
      ctx.clear(); coach.clear(); paint(); paintHands();
      coach.say(talker.hello());
      tell(state.turn === 'b' ? 'あなたの番です。駒か持ち駒をタップしてください。' : '上手（相手）から指します。');
      paintActions();
      if (!resume && state.turn === 'w') aiTurn();   // 駒落ちは上手から
    };
    const replay = (list) => {
      for (const m of list) {
        const legal = S.allLegalMoves(state, shape);
        const mv = legal.find((x) => (x.from || null) === (m.from || null) && x.to === m.to
          && (x.drop || null) === (m.drop || null) && !!x.promote === !!m.promote);
        if (!mv) break;
        const before = state, by = state.turn;
        if (by === 'b') history.push({ board: { ...state.board }, hands: S.cloneHands(state.hands), turn: state.turn, move: mv, seen: new Map(seen), trailLen: trail.length, kifuLen: kifu.length });
        state = S.applyMove(state, mv, shape);
        remember(by);
        record(before, mv);
      }
      paint(kifu.length > 1 ? kifu[kifu.length - 1].mark : {}); paintHands();
    };
    const startOrResume = () => {
      const sv = saver.load();
      if (!sv || !sv.start) return reset();
      reset({ resume: true, start: sv.start, hc: sv.hc });
      replay(sv.moves);
      busy = true;
      tell('前回の対局が残っています。');
      ctx.say(`<b>前回の続きから指せます</b>${kifu.length - 1}手目まで指してあります。`);
      ctx.actions([
        { label: '続きから指す', variant: 'tone', onClick: () => {
          busy = false; ctx.clear(); paintActions();
          if (state.turn !== 'b') aiTurn(); else tell('前回の続きです。あなたの番です。');
        } },
        { label: '新しく始める', variant: 'ghost', onClick: () => reset() },
      ]);
    };

    const finish = (r) => {
      // onPick は外さない（finished で止める）。外すと「もう一局」「待った」で盤が動かなくなる
      finished = true; busy = false;
      tell('対局が終わりました。');
      quiz.clear(); predict.clear();
      lastResult = r === 'win' || r === 'win:perpetual' ? 'win' : r === 'draw' ? 'draw' : 'lose';
      saver.clear();
      tally.flush();
      // 駒落ちチャレンジ：勝てば次の段階へ、2回続けて負けたら1つ戻る（千日手は動かさない）
      let chMsg = '';
      const hcElo = challenge ? (KOMAOCHI.find((x) => x.name === gameHc)?.elo || 0) : 0;
      if (challenge && !resultSaved && lastResult !== 'draw') {
        const nx = komaochiNext(stage, lastResult === 'win', settings.get(KOMAOCHI_LOSS) || 0);
        settings.set(KOMAOCHI_KEY, KOMAOCHI[nx.i].name); settings.set(KOMAOCHI_LOSS, nx.loss);
        chMsg = `<br><span class="note">${nx.note}</span>`;
        stage = nx.i; showCh();
      }
      // 最初に決まった結果だけを記録する（負けたあと「1手もどす」で指し直して勝っても、勝ちを足さない）。
      // ドリルは対局の勝敗に数えず、そのドリルの相手の強さの調整にだけ使う。
      // 駒落ちは、落とした駒の分だけ相手を弱いとみなす。強さは固定なので、ふだんの「じどう」とは別の盤として数える
      if (!resultSaved) {
        saveResult('shogi', level, lastResult, { drill: !!drill,
          ...(challenge ? { opp: s.level || 'normal', variant: 'big_ch', handicap: hcElo ? 1 : 0, stone: hcElo } : {}) });
      }
      resultSaved = true;
      level.refresh();
      if (r === 'lose:limit') {
        ctx.miss();
        ctx.say('<b>手数が尽きました</b>詰ませきれませんでした。まず玉の逃げ道を数え、逃げ道をふさいでから王手をかけるのが順番です。もう一度どうぞ。', 'ng');
      } else if (r === 'win') {
        ctx.solved(drill ? '<b>詰ませました</b>この寄せの形は、体で覚えるまでくり返すのが近道です。'
          : challenge ? `<b>勝ちました</b>${gameHc}で上手の玉を詰ませました。${chMsg}`
            : '<b>詰みました</b>持ち駒まで使えているなら、もう将棋を指せています。',
        [{ label: drill ? 'もう一度' : challenge && gameHc !== '平手' ? '次の段階に挑戦' : 'もう一局', variant: 'ghost', onClick: reset }]);
        showRecapHere(); showKifuHere(); coach.say(showSummary(recapBox, 'shogi', tally, talker, lastResult));
        return;
      }
      if (r === 'win:perpetual') {
        ctx.solved(`<b>相手の反則負けです</b>相手が王手をかけ続けて、同じ局面が4回くり返されました（連続王手の千日手）。王手をかけ続けた側の負けになります。${chMsg}`,
          [{ label: challenge && gameHc !== '平手' ? '次の段階に挑戦' : 'もう一局', variant: 'ghost', onClick: reset }]);
        showRecapHere(); showKifuHere(); coach.say(showSummary(recapBox, 'shogi', tally, talker, lastResult));
        return;
      }
      if (r === 'lose:limit') {
        // 手数切れの説明は上で出している
      } else if (r === 'draw') {
        ctx.say('<b>千日手です</b>同じ局面が4回くり返されたので、引き分け（指し直し）になりました。');
      } else if (r === 'lose:perpetual') {
        ctx.miss();
        ctx.say('<b>連続王手の千日手で、反則負けです</b>王手をかけ続けて同じ局面を4回くり返すと、王手をかけた側の負けになります。'
          + `王手で詰ませられないときは、別の攻め方に切り替えます。${chMsg}`, 'ng');
      } else {
        ctx.miss();
        ctx.say(`<b>今回は詰まされました</b>取られた駒は相手の戦力になります。そこが将棋の勝負どころです。${chMsg}`, 'ng');
      }
      ctx.actions([
        { label: 'もう一局', variant: 'tone', onClick: reset },
        { label: '1手もどす', variant: 'ghost', onClick: undo, disabled: !history.length },
        { label: '次へ進む', variant: 'ghost', onClick: () => { ctx.miss(); ctx.solved(); ctx.advance(); } },
      ]);
      showRecapHere(); showKifuHere(); coach.say(showSummary(recapBox, 'shogi', tally, talker, lastResult));
    };

    const check = () => {
      const st = S.gameStatus(state, shape);
      if (st === 'checkmate' || st === 'stuck') return state.turn === 'b' ? 'lose' : 'win';
      if (drill && history.length >= drill.limit && !S.isMate(state, shape)) return 'lose:limit';
      const k = key();
      if ((seen.get(k) || 0) >= 4) {
        // 同じ局面が最初に現れてからいままでの間、片方の手がすべて王手なら、その側の負け（連続王手の千日手）
        const first = trail.findIndex((t) => t.k === k);
        const span = trail.slice(first + 1);
        const allChecks = (c) => { const mine = span.filter((t) => t.by === c); return mine.length > 0 && mine.every((t) => t.check); };
        if (allChecks('b')) return 'lose:perpetual';
        if (allChecks('w')) return 'win:perpetual';
        return 'draw';
      }
      return null;
    };

    const aiTurn = async () => {
      const my = ++token;
      busy = true; tell('相手が考えています…');
      await wait(450 + pauseNext); pauseNext = 0;
      if (my !== token || finished || !ctx.alive()) return;
      const lvl = challenge ? (s.level || 'normal') : level();
      const legal = S.allLegalMoves(state, shape);
      let mv = lvl === 'easy' && legal.length && Math.random() < 0.25
        ? legal[(Math.random() * legal.length) | 0]
        : await NS_THINK.pickMove('shogi', [state, shape, levelDepth(lvl, depth)]);
      if (my !== token || finished || !ctx.alive()) return;
      // 連続王手の千日手になる王手（同じ局面の4回目）は反則負けなので、相手も避ける
      const losesByRepetition = (m) => {
        const nx = S.applyMove(state, m, shape);
        const k = nx.turn + JSON.stringify(nx.board) + JSON.stringify(nx.hands);
        return (seen.get(k) || 0) >= 3 && S.inCheck(nx.board, 'b', shape);
      };
      if (mv && losesByRepetition(mv)) {
        const alt = legal.filter((m) => !losesByRepetition(m));
        if (alt.length) mv = alt[(Math.random() * alt.length) | 0];
      }
      if (!mv) { busy = false; return finish('win'); }
      const took = !!state.board[mv.to];
      const beforeAi = state;
      state = S.applyMove(state, mv, shape);
      remember('w');
      record(beforeAi, mv);
      persist();
      lastMarks = { ...(mv.from ? { [mv.from]: 'hint' } : {}), [mv.to]: 'hint' };
      took ? sfx.capture('shogi') : sfx.place('shogi');
      predictMsg = predict.settle(mv);
      paint({ ...(mv.from ? { [mv.from]: 'last' } : {}), [mv.to]: 'last' });
      paintHands();
      busy = false;
      const r = check();
      if (r) return finish(r);
      tell(S.inCheck(state.board, 'b', shape) ? 'あなたの玉に王手がかかっています。' : 'あなたの番です。');
      warnThreat();
      if (!quiz.active) shogiTheirs(mv, took ? beforeAi.board[mv.to] : null);
      if (predictMsg) { status.textContent = `${predictMsg} ${status.textContent}`; predictMsg = null; }
      paintActions();
    };

    const commit = async (mv, mark) => {
      const took = !!state.board[mv.to];
      const beforeBoard = state.board;
      const beforeState = state;
      history.push({ board: { ...state.board }, hands: S.cloneHands(state.hands), turn: state.turn, move: mv, seen: new Map(seen),
        trailLen: trail.length, kifuLen: kifu.length });
      state = S.applyMove(state, mv, shape);
      remember('b');
      record(beforeState, mv);
      persist();
      took ? sfx.capture('shogi') : sfx.place('shogi');
      paint(mark); paintHands();
      const r = check();
      // 講評の読みの前に、指した手をまず画面に出す
      const myTok = ++token;
      if (!r) tell('講評を考えています…');
      // 詰みの見逃し・相手の詰み・取り合いの読み（持ち駒を打つ手も含む）は別スレッドで
      const review = await NS_THINK.run('shogiReview', [{ beforeState, state, mv, shape, win: r === 'win' }],
        10000, () => ({ rv: { level: 'ok', lines: [] } }));   // 時間切れなら、この手の講評は出さずに進める
      if (myTok !== token || !ctx.alive()) return;
      const { missedMate, missedMateN, rv } = review;
      // 成れるのに成らなかった（飛・角・歩は、成って損をすることがほとんどない）
      if (mv.from && !mv.promote && r !== 'win') {
        const pc = beforeState.board[mv.from];
        if (pc && ['R', 'B', 'P'].includes(S.baseOf(pc)) && !S.isPromoted(pc) && S.canPromote(pc, mv.from, mv.to, shape)) {
          const nm = S.PIECE_JA[S.kindOf(pc)];
          rv.lines.push({ kind: 'nopromo', what: `${nm}が成れるのに、成りませんでした`,
            why: '飛車・角・歩は、成ると動ける場所が増えるだけで、損はありません。敵陣に入ったら成りましょう。',
            better: { from: mv.from, to: mv.to, promote: true, label: '同じ手を「成る」で指す', reason: '動きが強くなります。' },
            lesson: '「成りますか？」と聞かれたら、飛・角・歩は「成る」が基本です。',
            marks: { [mv.to]: 'ng' }, d: { name: nm } });
          if (rv.level === 'ok') rv.level = 'miss';
        }
      }
      // 居玉（本将棋）：10手を過ぎても玉が5九のまま（悪手には数えないひとこと）
      if (variant === 'big' && !drill && !(s.goals || []).length && rv.level === 'ok' && history.length >= 10 && history.length <= 40
        && state.board['59'] === 'K' && talker.first('igyoku')) {
        rv.lines.push({ kind: 'tip', what: '玉が、まだ最初の場所（5九）にいます',
          why: '「居玉は避けよ」という格言があります。戦いが始まる前に、玉を2八や7八のほうへ動かして、金銀で囲いましょう。',
          talk: '玉がまだ5九にいますね。戦いが始まる前に、玉を囲っておくと安心です。',
          mood: 'think', marks: { 59: 'hint' }, lesson: '' });
      }
      if (rv.level !== 'ok') {
        recap.push({ n: history.length, pos: beforeBoard, move: mv, rv });
        const kind = review.kind;
        const extra = {};
        if (kind === 'missedmate' && missedMate) {
          Object.assign(extra, { answers: [{ from: missedMate.from || null, to: missedMate.to, drop: missedMate.drop || null, promote: !!missedMate.promote }],
            acceptMate: true, acceptStillMating: missedMateN > 1 });
        } else if (kind === 'missed') {
          const caps = review.caps || [];
          const top = caps.length ? caps[0].gain : 0;
          extra.answers = caps.filter((c) => c.gain === top).map((c) => ({ from: c.from, to: c.to }));
          extra.acceptMate = true;
        } else if (kind === 'allowmate') {
          extra.acceptNoMate = true;
          extra.unsolvable = review.unsolvable;
        } else if (kind === 'slow') {
          const b = rv.lines.find((l) => l.kind === 'slow')?.better;
          if (b) extra.answers = [{ from: b.from, to: b.to, drop: b.drop, promote: b.promote }];
          Object.assign(extra, { acceptMate: true, acceptHisshi: true });
        }
        saveMoveMistake('shogi', rv, { state: { board: { ...beforeBoard }, hands: S.cloneHands(beforeState.hands), turn: 'b' }, shape },
          mv, extra);
      }
      tally.add(rv);
      const gl = r === 'win' ? [] : checkGoals(s.goals, {
        before: beforeBoard, after: state.board, move: mv, color: 'b', ctx: shape,
        ply: history.length * 2 - 1, history,   // 両者の手を数えた手数
      });
      rv.lines = [...gl.filter((g) => !g.ok), ...rv.lines, ...gl.filter((g) => g.ok)];
      if (gl.some((g) => !g.ok) && rv.level === 'ok') rv.level = 'miss';
      // 読み筋の再生用：駒の損得や詰みがからむ指摘のときだけ、指す前後の局面（持ち駒も）を添える
      if (rv.level !== 'ok' && rv.lines.some((l) => !['goal', 'good', 'tip', 'nopromo'].includes(l.kind))) {
        const sug = rv.lines.find((l) => l.better?.to && (l.better.from || l.better.drop))?.better;
        rv.replay = {
          before: { board: { ...beforeBoard }, hands: S.cloneHands(beforeState.hands), turn: 'b' },
          after: { board: { ...state.board }, hands: S.cloneHands(state.hands), turn: 'w' },
          move: { from: mv.from || null, to: mv.to, drop: mv.drop || null, promote: !!mv.promote },
          alt: sug ? { from: sug.from || null, to: sug.to, drop: sug.drop || null, ...(sug.promote != null ? { promote: !!sug.promote } : {}) } : null,
          focus: ['missed', 'missedmate', 'deepmiss'].includes(rv.lines.find((l) => !['goal', 'good', 'tip'].includes(l.kind))?.kind) ? 'best' : 'played',
        };
      }
      if (rv.lines.length) {
        coach.show(rv);
        const cm = rv.lines.find((l) => l.marks && Object.keys(l.marks).length);
        if (cm) paint({ ...mark, ...cm.marks });
      } else coach.clear();
      // コーチのひとことと、盤の矢印
      const said = rv.lines.length ? talker.mine(rv)
        : mv.drop ? { text: pickOne(['持ち駒を打ちました。持ち駒は好きな場所に打てるのが、将棋の面白いところです。', 'いい打ち込みです。打った駒が取られないかも見ておきましょう。']), mood: 'think' } : null;
      if (said) { coach.say(said); if (coach.on && said.arrows?.length) board.flash(said.arrows); }
      pauseNext = coach.on ? coachPause(rv, said) : 0;
      from = null; dropKind = null;
      if (r) return finish(r);
      // 3手に1回、相手の応手を予想してもらう（チェスと同じ）
      if (!drill && predict.ask(history.length, () => aiTurn())) return;
      aiTurn();
    };

    /** 相手が指したあとのひとこと：王手 → 取られた駒（取り返せるか）→ タダで取れる駒 → 序盤・持ち駒のコツ */
    function shogiTheirs(mv, victim) {
      if (!coach.on || finished) return;
      const kSq = Object.keys(state.board).find((k) => state.board[k] === 'K');
      if (kSq && S.inCheck(state.board, 'b', shape)) {
        const atk = K.attackers('shogi', state.board, kSq, 'w', shape);
        coach.say({ text: pickOne(['王手です！ 玉を逃げる・間に駒を打つ（合駒）・王手している駒を取る、の3つから選びます。',
          '王手されました！ まず、王手している駒を取れないか見てみましょう。']), mood: 'alert' });
        if (atk.length) board.flash(atk.slice(0, 2).map((a) => ({ from: a.from, to: kSq, c: 'ng' })));
        return;
      }
      if (victim) {
        const name = S.PIECE_JA[S.kindOf(victim)];
        const back = K.freeCaptures('shogi', state.board, 'b', shape).find((m) => m.to === mv.to);
        if (back) {
          coach.say({ text: pickOne([`${name}を取られました。でも、取り返せます！`, `${name}を取られましたが、${back.piece}で取り返せますよ。`]), mood: 'think' });
          board.flash([{ from: back.from, to: back.to, c: 'ok' }]);
        } else {
          coach.say({ text: pickOne([`${name}を取られてしまいました。取られた駒は、相手の持ち駒になります。`,
            `あっ、${name}を取られました。相手の駒の利きを、1マスずつたどってみましょう。`]), mood: 'hmm' });
        }
        return;
      }
      if (K.freeCaptures('shogi', state.board, 'b', shape).some((m) => m.safe && m.gain >= 3)) {
        coach.say({ text: pickOne(['おっ、チャンスかも。タダで取れる駒がありますよ。探してみて！', '盤をよく見て。相手の駒で、誰にも守られていないものがあります。']), mood: 'happy' });
        return;
      }
      if (talker.lastBad) return;
      const n = history.length;
      let t = null;
      if (variant === 'big' && !drill && n <= 1) t = talker.once('open1', 'まずは、角道を開ける7六歩や、飛車先を伸ばす2六歩から始めるのが定番です。');
      else if (!drill && Object.values(state.hands.b || {}).reduce((a, v) => a + v, 0) >= 3) {
        t = talker.once('hands', '持ち駒が増えてきました。持ち駒は好きな所に打てます。相手の玉の近くに打つ手も考えてみましょう。');
      }
      if (t) { coach.say(t); return; }
      if (n % 3 === 1 && mv.from && state.board[mv.to]) {
        const nm = S.PIECE_JA[S.kindOf(state.board[mv.to])];
        coach.say({ text: pickOne([`相手は${nm}を動かしました。その${nm}は、次にどこへ届くかな？`, `相手の${nm}が動きました。新しく狙われた駒はないか、見てみましょう。`]), mood: 'think' });
      }
    }

    board.onPick = (sq) => {
      if (predict.active) { predict.pick(sq, () => aiTurn()); return; }
      if (busy || finished || state.turn !== 'b') return;
      if (quiz.active) { quiz.pick(sq); return; }
      if (dropKind) {
        if (!S.legalDrops(state, dropKind, shape).includes(sq)) return;
        return commit({ drop: dropKind, to: sq }, { [sq]: 'last' });
      }
      if (from === null) {
        if (!state.board[sq] || S.colorOf(state.board[sq]) !== 'b') return;
        from = sq;
        paint(hintMarks(sq));
        return;
      }
      if (sq === from) { from = null; paint(); return; }
      const cands = S.legalMovesFrom(state, from, shape).filter((m) => m.to === sq);
      if (!cands.length) {
        if (state.board[sq] && S.colorOf(state.board[sq]) === 'b') {
          from = sq;
          paint(hintMarks(sq));
        }
        return;
      }
      const promo = cands.find((m) => m.promote);
      const plain = cands.find((m) => !m.promote);
      const mark = { [from]: 'last', [sq]: 'last' };   // いまの from を固定しておく
      if (promo && plain) {
        // 成るか聞いている間は盤を止める。止めないと別の手を指したあとに古い手が指される
        busy = true;
        const my = token;   // 聞いている間に「最初から」などが押されたら、古い手は指さない
        askPromote(ctx,
          () => { if (my !== token || finished) return; busy = false; commit(promo, mark); },
          () => { if (my !== token || finished) return; busy = false; commit(plain, mark); });
        return;
      }
      commit(cands[0], mark);
    };

    const undo = () => {
      const prev = history.pop();
      if (!prev) return;
      token++;   // 考え中の相手の手を捨てる
      state = { board: prev.board, hands: prev.hands, turn: prev.turn };
      seen = prev.seen;
      trail.length = prev.trailLen; kifu.length = prev.kifuLen; kifuBox.innerHTML = '';
      quiz.clear(); predict.clear(); predictMsg = null;
      recap = recap.filter((x) => x.n <= history.length);
      recapBox.innerHTML = '';
      from = null; dropKind = null; busy = false; finished = false;
      coach.clear(); ctx.clear(); paint(); paintHands();
      coach.say({ text: pickOne(['1手もどしました。今度はどう指しますか？', 'やり直しです。相手の駒の利きを、もう一度たどってみましょう。']), mood: 'think' });
      tell('1手もどしました。もう一度どうぞ。');
      paintActions();
      persist();
    };

    function paintActions() {
      ctx.actions([
        { label: '1手もどす', variant: 'ghost', onClick: undo, disabled: !history.length },
        { label: '最初から', variant: 'ghost', onClick: reset },
      ]);
    }

    startOrResume();
  }

  function askPromote(ctx, onYes, onNo) {
    // 選んだらすぐにボタンを消す。残しておくと、相手が考えている間にもう一度押せてしまい、
    // もう駒のいないマスから同じ手が指されて盤が壊れていた
    let decided = false;
    const pick = (fn) => { if (decided) return; decided = true; ctx.clear(); ctx.actions([]); fn(); };
    ctx.say('<b>成りますか？</b>成ると動きが強くなりますが、元には戻せません。');
    ctx.actions([
      { label: '成る', variant: 'tone', onClick: () => pick(onYes) },
      { label: '成らない', variant: 'ghost', onClick: () => pick(onNo) },
    ]);
  }

  // ── 麻雀（一人麻雀） ──────────────────────────────────────
  function soloMahjong(ctx, { renderTiles, M }) {
    const s = ctx.step;
    const sets = s.sets || 2;                 // 2 = 豆麻雀、4 = 本物の枚数
    const handSize = sets * 3 + 2;            // ツモ後の枚数（豆麻雀なら8、本物なら14）
    // 巡目の上限。あがれなくても、テンパイまで作れれば合格にする（初心者でも8割前後が合格できる長さ）
    const limit = s.limit || (sets === 2 ? 20 : 24);
    const pool = s.honors === false ? M.ALL_TILES.filter((t) => !M.isHonor(t)) : M.ALL_TILES;

    ctx.prompt(s.prompt ||
      `牌を1枚ツモって1枚捨てる、これをくり返します。<strong>${sets}面子1雀頭</strong>の形になったらアガリです。`);

    const handHost = el('div');
    const status = el('p', 'note');
    const riverLabel = el('p', 'note', '捨てた牌');
    const river = el('div');
    ctx.mount.append(handHost, status);
    const coach = makeCoach(ctx, {
      label: 'コーチ（切るたびに受け入れを教えます）',
      goals: s.goals || [],
      onUndo: () => undo(),
      onReplay: openMahjongRoutes,
    });
    const talker = makeTalker('mahjong', sets === 2 ? '豆麻雀です。3枚の組を2つと、同じ牌2枚がそろえばアガリ！ ひとりぼっちの牌から切っていきましょう。' : null);
    ctx.mount.append(riverLabel, river);
    const recapBox = el('div', 'recap');
    ctx.mount.appendChild(recapBox);

    let wall, hand, discards, turns, finished;
    let history = [];
    let items = [];      // 振り返り用：指摘した切り方
    let tally = null;    // この局の講評の集計
    const endRound = (custom, result) => {
      tally.flush();
      showMjRecap(recapBox, items, renderTiles, openMahjongRoutes);
      coach.say(showSummary(recapBox, 'mahjong', tally, talker, result, custom));
    };

    const reset = () => {
      wall = M.makeWall(pool);
      hand = M.sortTiles(wall.splice(0, handSize));
      discards = []; turns = 0; finished = false;
      history = []; items = [];
      tally?.flush();
      tally = makeTally('mahjong');
      recapBox.innerHTML = '';
      ctx.clear(); coach.clear();
      coach.say(talker.hello());
      paintActions();   // 先にボタンを戻す（配牌でいきなりアガリのときは paint が上書きする）
      paint();
    };

    const paint = () => {
      const done = M.isWin(hand, sets);
      renderTiles(handHost, hand, {
        disabled: finished,
        onPick: (i) => discard(i),
      });
      renderTiles(river, discards, { disabled: true, tight: true });
      riverLabel.style.display = discards.length ? '' : 'none';
      if (done && !finished) return win();
      const sh = M.shantenAll(hand, sets);
      // 14枚（ツモ後）で数えたシャンテン数なので、0 は「うまく切ればテンパイ」
      status.textContent = finished ? ''
        : `${turns + 1}巡目（残り${limit - turns}回）／ ${sh <= 0 ? '1枚切ればテンパイです。' : `テンパイまであと${sh}枚。`}捨てる牌をタップ。`
          + (turns === 0 ? `${limit}回以内にあがるか、テンパイ（あと1枚であがれる形）まで作れば合格です。` : '');
    };

    const win = () => {
      finished = true;
      const dec = M.decompose(hand, sets)[0];
      const detail = dec ? `${dec.sets.map((g) => g.map(M.tileName).join('')).join(' / ')} ＋ ${M.tileName(dec.pair)}${M.tileName(dec.pair)}` : '';
      renderTiles(handHost, hand, { disabled: true });
      status.textContent = '';
      ctx.solved(`<b>アガリ</b>${turns}巡でそろいました。<br>${detail}`, [{ label: 'もう一度打つ', variant: 'ghost', onClick: reset }]);
      endRound(pickOne(['アガリ！ おめでとうございます！', 'ツモ！ きれいにそろいました！']), 'win');
    };

    const discard = (i) => {
      if (finished) return;
      sfx.place('mahjong');
      history.push({ hand: [...hand], wall: [...wall], discards: [...discards], turns, nItems: items.length });
      // 講評は、コーチ表示のオン・オフにかかわらず集計する（弱点の記録と振り返りに使う）
      const judged = K.explainDiscard(hand, hand[i], sets, discards);
      // テンパイまでの道筋（読み筋の再生）：最善と違う牌を切ったときだけ
      if (judged.level !== 'ok' && judged.best && judged.best.tile !== hand[i]) {
        judged.replay = { label: '▶ テンパイまでの道筋を見る', hand: [...hand], tile: hand[i], best: judged.best.tile,
          sets, seen: [...discards], poolTotal: pool.length * 4 };
      }
      tally.add(judged);
      if (judged.level !== 'ok' && judged.lines[0]) {
        items.push({ n: turns + 1, hand: [...hand], tile: hand[i], better: judged.best?.tile, level: judged.level, line: judged.lines[0],
          replay: judged.replay || null });
        if (sets === 4) saveDiscardMistake(judged, hand, sets);
      }
      if (coach.on) {
        const rv = judged;
        const gl = checkGoals(s.goals, { hand, tile: hand[i], sets, discards });
        rv.lines = [...gl.filter((g) => !g.ok), ...rv.lines, ...gl.filter((g) => g.ok)];
        if (gl.some((g) => !g.ok) && rv.level === 'ok') rv.level = 'miss';
        coach.show(rv);
        const said = talker.mine(rv);
        if (said) coach.say(said);
      }
      const nudge = coach.on && judged.level !== 'ok';
      discards.push(hand[i]);
      hand = M.sortTiles(hand.filter((_, j) => j !== i));
      turns++;
      if (turns >= limit) {
        finished = true;
        renderTiles(handHost, hand, { disabled: true });
        status.textContent = '';
        const w = M.waits(hand, sets);
        if (w.length) {
          // 時間切れでも、テンパイ（あと1枚であがれる形）まで作れていれば合格にする
          ctx.solved(`<b>テンパイ（合格）</b>時間切れですが、あと1枚であがれる形まで作れました。${w.map(M.tileName).join('・')} を引けばアガリでした。`,
            [{ label: 'もう一度打つ', variant: 'ghost', onClick: reset }]);
          endRound('テンパイまで作れました。合格です！', 'win');
          return;
        }
        ctx.miss();
        ctx.say('<b>時間切れです</b>テンパイまであと少しでした。もう一度やってみましょう。', 'ng');
        endRound('時間切れでした。でも形は近づいています。もう一度やってみましょう。', 'lose');
        ctx.actions([
          { label: 'もう一度', variant: 'tone', onClick: reset },
          { label: '1枚もどす', variant: 'ghost', onClick: undo },
          { label: '次へ進む', variant: 'ghost', onClick: () => { ctx.solved(); ctx.advance(); } },
        ]);
        return;
      }
      hand = M.sortTiles([...hand, wall.pop()]);
      paintActions();   // 先にボタンを戻す（ツモであがったときは、paint の中の「次へ」がこれを置き換える）
      paint();
      // 気になる切り方だったときは、いま捨てた牌を小さく弾ませる
      if (nudge) river.querySelector('.tile:last-of-type')?.classList.add('is-nudge');
    };

    const undo = () => {
      const prev = history.pop();
      if (!prev) return;
      hand = prev.hand; wall = prev.wall; discards = prev.discards; turns = prev.turns;
      items.length = prev.nItems; recapBox.innerHTML = '';
      finished = false;
      coach.clear(); ctx.clear(); paint(); paintActions();
      coach.say({ text: '1枚もどしました。受け入れの広い切り方を探してみましょう。', mood: 'think' });
    };

    function paintActions() {
      ctx.actions([
        { label: '1枚もどす', variant: 'ghost', onClick: undo, disabled: !history.length },
        { label: '配りなおす', variant: 'ghost', onClick: reset },
      ]);
    }

    reset();
  }


  // ── 囲碁 ──────────────────────────────────────────────────
  // 石取りゲーム（先に決まった数を取った方が勝ち）と、地を数える本番の対局。
  // 相手の思考・終局の死に石の判定・形勢グラフは別スレッドで読む。
  const GO_SETUPS = {
    cap1: { n: 7, mode: 'capture', target: 1, cross: true, win: '先に相手の石を1個取った方が勝ち' },
    cap3: { n: 7, mode: 'capture', target: 3, cross: true, win: '先に相手の石を3個取った方が勝ち' },
    cap5: { n: 9, mode: 'capture', target: 5, cross: true, win: '先に相手の石を5個取った方が勝ち' },
    nine: { n: 9, mode: 'territory', komi: 6.5, win: '終局したとき、地とアゲハマの合計が多い方が勝ち（白にコミ6目半）' },
    thirteen: { n: 13, mode: 'territory', komi: 6.5, win: '終局したとき、地とアゲハマの合計が多い方が勝ち（白にコミ6目半）' },
    nineteen: { n: 19, mode: 'territory', komi: 6.5, win: '終局したとき、地とアゲハマの合計が多い方が勝ち（白にコミ6目半）' },
  };
  const GO_ILLEGAL = {
    occupied: 'そこにはもう石があります。',
    suicide: 'そこは打てない点です。打つと自分の石の呼吸点がなくなります（相手の石を取れるときだけ打てます）。',
    ko: 'コウです。取られた直後は、すぐには取り返せません。ほかの場所に1手打ってからなら取り返せます。',
  };

  /**
   * 置き碁チャレンジの進み方。勝てば置き石を1つ減らし（2子の次は互先）、2回続けて負けたら1つ増やす。
   * 返り値 { h: 次の置き石, loss: 続けて負けた回数, note: 知らせる文 }
   */
  function goChallengeNext(h, won, loss, max) {
    if (won) {
      if (h === 0) return { h: 0, loss: 0, note: '互先で勝ちました。挑戦達成です！ 次は通常の対局で「相手の強さ」を上げて挑戦してみましょう。' };
      const nh = h > 2 ? h - 1 : 0;
      return { h: nh, loss: 0, note: `挑戦の段階が進みました。次は${nh ? `置き石${nh}子` : '互先（コミ6目半）'}です。` };
    }
    const l = loss + 1;
    if (l >= 2) {
      if (h >= max) return { h, loss: 0, note: '置き石はこれ以上増やせません。同じ置き石で、もう一度挑戦しましょう。' };
      const nh = h === 0 ? 2 : h + 1;
      return { h: nh, loss: 0, note: `2回続けて負けたので、次は置き石${nh}子にします。` };
    }
    return { h, loss: l, note: 'もう1回続けて負けると、置き石を1つ増やします。' };
  }

  function playGo(ctx) {
    const G = NS_GO;
    const { GoBoard } = NS_GOBOARD;
    const s = ctx.step;
    const cfg = GO_SETUPS[s.variant || 'nine'] || GO_SETUPS.nine;
    const n = cfg.n, me = 'X', foe = 'O';
    const capture = cfg.mode === 'capture';
    const challenge = !!s.challenge && !capture;   // 置き碁チャレンジ（相手の強さは固定、置き石は勝敗で増減）
    // 置き石（9路・13路）。置き碁はコミなし・白（相手）から打つ。前回の選択をゲームの種類ごとに覚える
    const HC_KEY = `goHandicap.${s.variant || 'nine'}`;
    const CH_KEY = `goChallenge.${s.variant || 'nine'}`, CH_LOSS = `${CH_KEY}.loss`;
    const HC_MAX = n >= 13 ? 9 : 5;
    const hcSaved = settings.get(challenge ? CH_KEY : HC_KEY);
    let handicap = capture ? 0 : (hcSaved ?? s.handicap ?? 0);
    let komi = handicap ? 0 : (cfg.komi ?? 6.5);
    const HC_POINTS = {
      9: [[6, 2], [2, 6], [6, 6], [2, 2], [4, 4]],
      13: [[9, 3], [3, 9], [9, 9], [3, 3], [6, 6], [3, 6], [9, 6], [6, 3], [6, 9]],
      19: [[15, 3], [3, 15], [15, 15], [3, 3], [9, 9], [3, 9], [15, 9], [9, 3], [9, 15]],
    };

    const setPrompt = () => ctx.prompt(s.prompt || (handicap
      ? `あなたは黒です。置き石${handicap}子をもらい、白（相手）から打ちます。終局したとき、地とアゲハマの合計が多い方が勝ち（置き碁なのでコミなし）。`
      : `あなたは黒（先手）です。${cfg.win}。`));
    setPrompt();
    const variant = GO_SETUPS[s.variant] ? s.variant : 'nine';
    const level = aiLevelPicker(ctx, { variant, rated: RATED_VARIANTS.go.includes(variant) });
    const chNote = el('p', 'note');
    const showCh = () => {
      chNote.innerHTML = (handicap ? `挑戦の段階：<b>置き石${handicap}子</b>（勝つと${handicap > 2 ? `置き石${handicap - 1}子` : '互先'}に進みます）`
        : '挑戦の段階：<b>互先（コミ6目半）</b>。ここで勝てば挑戦達成です。') + `<br>相手の強さ：${{ easy: 'やさしい', normal: 'ふつう', hard: 'つよい' }[s.level || 'normal']}（挑戦のあいだは固定）`;
    };
    if (challenge) {
      // 強さの選択は出さない（段階の意味が変わらないように固定する）
      const lv = ctx.mount.querySelector('label.ailevel');
      if (lv) { const nx = lv.nextElementSibling; lv.remove(); if (nx && /いまは/.test(nx.textContent || '')) nx.remove(); }
      ctx.mount.appendChild(chNote);
      showCh();
    }
    if (!capture && !challenge) {
      const hc = el('label', 'ailevel');
      const opts = n >= 13 ? [0, 2, 3, 4, 5, 6, 9] : [0, 2, 3, 4, 5];
      hc.innerHTML = `置き石 <select data-hc>${opts.map((k) => `<option value="${k}" ${k === handicap ? 'selected' : ''}>${k ? `${k}子（コミなし）` : 'なし（互先・コミ6目半）'}</option>`).join('')}</select>`;
      hc.querySelector('select').addEventListener('change', (e) => {
        handicap = Number(e.target.value);
        komi = handicap ? 0 : (cfg.komi ?? 6.5);
        settings.set(HC_KEY, handicap);
        reset();
      });
      ctx.mount.appendChild(hc);
    }
    const cf = el('label', 'ailevel');
    cf.innerHTML = '<input type="checkbox"> タップで仮置き（もう一度タップで決定）';
    const cfBox = cf.querySelector('input');
    cfBox.checked = NS_GOBOARD.confirmOn();
    cfBox.addEventListener('change', () => settings.set('goConfirm', cfBox.checked));
    ctx.mount.appendChild(cf);
    const host = ctx.boardHost();
    const board = new GoBoard(host, { n, coords: n >= 9 });
    const capsLine = el('p', 'note gocaps');
    const status = el('p', 'note');
    ctx.mount.append(capsLine, status);
    const recapBox = el('div', 'recap');
    let st, history, kifu, moves, recap, tally, busy, finished, scoring, dead, owner;
    let token = 0, resultSaved = false, lastResult = null, lastMarks = {}, passOk = false;
    let pauseNext = 0;  // コーチが指摘した直後に、相手が待つ時間（ミリ秒）
    let moveSeq = 0;    // 打つ・もどす・最初から で増やす（形勢の見込みが前の局面のものなら使わない）
    // 形勢の見込み（目数）の読みの量。盤が広いほど1回の読みが重いので減らす
    const EST_PLAYOUTS = n <= 9 ? 400 : n <= 13 ? 250 : 160;
    /** 見込みの文（v は黒から見た目数・コミ込み。あなたは黒） */
    const estText = (v) => (v >= 0.5 ? `黒（あなた）が約${Math.round(v)}目リード` : v <= -0.5 ? `白（相手）が約${Math.round(-v)}目リード` : 'ほぼ互角');
    // あなたの番の局面の見込みを、考えている間に先に読んでおく（打ったあとに読むのは1回で済む）
    let estCache = null;
    const estKey = (x) => `${x.s}${x.turn}${x.ko}`;
    const estOf = (x) => (estCache && estCache.key === estKey(x) ? estCache.p
      : NS_THINK.run('goEval', [x, komi, EST_PLAYOUTS], 8000, () => null));
    const prefetchEst = () => {
      if (capture || !coach.on || finished || st.turn !== me) return;
      estCache = { key: estKey(st), p: NS_THINK.run('goEval', [st, komi, EST_PLAYOUTS], 8000, () => null) };
    };

    const coach = makeCoach(ctx, {
      onUndo: () => undo(),
      onShowBetter: (line) => board.setPosition(st.s, line.marks, { turn: st.turn }),
    });
    const talker = makeTalker('go', capture ? '石取りゲームです。相手の石の呼吸点を、1つずつふさいでいきましょう。'
      : n >= 13 ? `よろしくお願いします！ ${n}路盤は広いので、まずは4つの隅から打っていきましょう。` : null);
    ctx.mount.appendChild(recapBox);
    const kifuBox = el('div', 'kifu');
    ctx.mount.appendChild(kifuBox);

    const tell = (t) => (status.textContent = t);
    // 途中保存：手順だけを端末に残す（局面は手順を並べ直して戻す）。ゲームの種類ごとに1局
    const SAVE_KEY = `bangi.go.save.${s.variant || 'nine'}${challenge ? '.challenge' : ''}`;
    const saveGame = () => {
      try {
        if (finished || !moves.length) localStorage.removeItem(SAVE_KEY);
        else localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, handicap, moves }));
      } catch { }
    };
    const clearSave = () => { try { localStorage.removeItem(SAVE_KEY); } catch { } };
    const loadSave = () => {
      try {
        const sv = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
        return sv && sv.v === 1 && Array.isArray(sv.moves) && sv.moves.length ? sv : null;
      } catch { return null; }
    };
    const paint = (extra = {}) => board.setPosition(st.s, extra, { turn: st.turn });
    const showCaps = () => {
      capsLine.textContent = capture
        ? `取った石：あなた（黒）${st.caps.X}個 ／ 相手（白）${st.caps.O}個（先に${cfg.target}個で勝ち）`
        : `アゲハマ：黒 ${st.caps.X}個 ／ 白 ${st.caps.O}個　　${st.moves}手目`;
    };
    const P = (i) => G.ptName(n, i);
    const record = (who, i, captured) => {
      moves.push({ color: who, i });
      kifu.push({
        pos: st.s, st: { ...st }, mover: who, turn: st.turn,
        label: `${G.COLOR_JA[who]} ${i < 0 ? 'パス' : P(i)}${captured ? `（${captured}子取る）` : ''}`,
        mark: i >= 0 ? { [i]: 'last' } : {},
      });
    };
    const start = () => {
      let s0 = '.'.repeat(n * n);
      let turn = 'X';
      if (handicap >= 2) {
        const a = s0.split('');
        const H = HC_POINTS[n] || [];
        const corners = H.slice(0, 4), C = H[4], sides = H.slice(5);
        const pts = handicap <= 4 ? corners.slice(0, handicap) : handicap === 5 ? [...corners, C]
          : handicap === 6 ? [...corners, ...sides.slice(0, 2)] : handicap === 7 ? [...corners, ...sides.slice(0, 2), C]
            : handicap === 8 ? [...corners, ...sides] : [...corners, ...sides, C];
        for (const [x, y] of pts) a[y * n + x] = 'X';
        s0 = a.join('');
        turn = 'O';
      }
      if (cfg.cross) {
        const c = (n / 2) | 0, a = s0.split('');
        a[(c - 1) * n + (c - 1)] = 'X'; a[c * n + c] = 'X'; a[(c - 1) * n + c] = 'O'; a[c * n + (c - 1)] = 'O';
        s0 = a.join('');
      }
      return { n, s: s0, turn, ko: -1, caps: { X: 0, O: 0 }, passes: 0, moves: 0, last: -1 };
    };

    const reset = (quiet = false) => {
      quiet = quiet === true;   // ボタンから呼ばれるとクリックのイベントが渡ってくるので、true のときだけ「静かに」
      if (!quiet) clearSave();
      token++; moveSeq++;
      st = start();
      history = []; recap = []; moves = [];
      kifu = [{ pos: st.s, st: { ...st }, label: handicap ? `開始（置き石${handicap}子）` : '開始', mark: {}, turn: st.turn }];
      busy = false; finished = false; scoring = false; dead = new Set(); owner = null; resultSaved = false; lastMarks = {}; passOk = false;
      level.newGame();
      recapBox.innerHTML = ''; kifuBox.innerHTML = '';
      tally?.flush();
      tally = makeTally('go');
      ctx.clear(); coach.clear(); setPrompt(); paint(); showCaps();
      coach.say(talker.hello());
      tell(capture ? 'あなたの番です。線の交わる点をタップして黒石を置きます。' : 'あなたの番です。最初は隅の近く（3の三・4の四のあたり）か、中央がおすすめです。');
      paintActions();
      if (!quiet && st.turn === foe) aiTurn();   // 置き碁は白（相手）から
      else prefetchEst();
    };
    /** 保存した手順を並べ直す（自分の手の前の局面は「1手もどす」用に残す） */
    function replay(list) {
      for (const m of list) {
        if (m.color === me) history.push({ st, kifuLen: kifu.length, movesLen: moves.length, recapLen: recap.length });
        const nx = G.apply(st, m.i);
        if (!nx) break;
        st = nx;
        record(m.color, m.i, m.i >= 0 ? (st.captured || []).length : 0);
      }
      lastMarks = st.last >= 0 ? { [st.last]: 'last' } : {};
      paint(lastMarks); showCaps();
    }
    function offerResume(sv) {
      handicap = capture ? 0 : (sv.handicap || 0);
      komi = handicap ? 0 : (cfg.komi ?? 6.5);
      const sel = ctx.mount.querySelector('label.ailevel select[data-hc]');
      if (sel) sel.value = String(handicap);
      reset(true);
      replay(sv.moves);
      busy = true;
      tell('前回の対局が残っています。');
      ctx.say(`<b>前回の続きから打てます</b>${st.moves}手目まで打ってあります${handicap ? `（置き石${handicap}子）` : ''}。`);
      ctx.actions([
        { label: '続きから打つ', variant: 'tone', onClick: () => {
          busy = false; ctx.clear(); paintActions();
          if (!capture && st.passes >= 2) return endGame();
          if (st.turn === foe) aiTurn(); else tell('前回の続きです。あなたの番です。');
        } },
        { label: '新しく始める', variant: 'ghost', onClick: () => reset() },
      ]);
    }

    const finish = (r) => {
      finished = true; busy = false; scoring = false;
      lastResult = r.startsWith('win') ? 'win' : r.startsWith('draw') ? 'draw' : 'lose';
      const gameKomi = komi;   // この局のコミ（挑戦で次の局の置き石が変わっても、棋譜はこの局のまま）
      const gameHc = handicap; // この局の置き石（持ち点の計算に使う）
      let chMsg = '';
      if (challenge && !resultSaved && lastResult !== 'draw') {
        const nx = goChallengeNext(handicap, lastResult === 'win', settings.get(CH_LOSS) || 0, HC_MAX);
        settings.set(CH_KEY, nx.h); settings.set(CH_LOSS, nx.loss);
        chMsg = `<br><span class="note">${nx.note}</span>`;
        handicap = nx.h; komi = handicap ? 0 : (cfg.komi ?? 6.5);
        showCh();
      }
      tally.flush();
      clearSave();
      if (!resultSaved) {
        // 置き石をもらった局は、相手を置き石の分だけ弱いとみなす（1子の重みは目安。小さな盤ほど1子が大きい）
        saveResult('go', level, lastResult, {
          handicap: gameHc, stone: n <= 9 ? 80 : n <= 13 ? 60 : 50,
          // 置き碁チャレンジは強さが固定。ふだんの対局の「じどう」の強さが動かないよう、別の盤として数える
          ...(challenge ? { opp: s.level || 'normal', variant: `${variant}_ch` } : {}),
        });
      }
      resultSaved = true;
      level.refresh();
      if (lastResult === 'win') {
        ctx.solved(capture ? `<b>勝ちました</b>${cfg.target}個取りました。アタリを見つける目が育っています。`
          : `<b>勝ちました</b>${r.includes(':') ? r.split(':').slice(1).join(':') : ''}${chMsg}`,
        [{ label: challenge && gameHc ? '次の段階に挑戦' : 'もう一局', variant: 'ghost', onClick: reset }]);
      } else {
        if (lastResult === 'draw') ctx.say(`<b>引き分けです</b>${r.split(':').slice(1).join(':')}`);
        else {
          ctx.miss();
          ctx.say((r === 'lose:resign' ? '<b>投了しました</b>負けた局ほど身につきます。振り返りを見てから、もう一局どうぞ。'
            : `<b>今回は負けました</b>${r.includes(':') ? r.split(':').slice(1).join(':') : ''}`) + chMsg, 'ng');
        }
        ctx.actions([
          { label: 'もう一局', variant: 'tone', onClick: reset },
          { label: '1手もどす', variant: 'ghost', onClick: undo, disabled: !history.length },
          { label: '次へ進む', variant: 'ghost', onClick: () => { ctx.miss(); ctx.solved(); ctx.advance(); } },
        ]);
      }
      tell('対局が終わりました。');
      showRecap(recapBox, recap, (item, marks) => board.setPosition(item.pos, marks, { turn: me }));
      coach.say(showSummary(recapBox, 'go', tally, talker, lastResult));
      // 検討：棋譜の各局面で、相手と同じAIのおすすめを出し、実際の手と比べる
      const suggest = async (f, nx) => {
        if (!f.st || (f.st.passes || 0) >= 2) return null;
        const res = await NS_THINK.run('goPick', [{ st: f.st, level: 'normal', mode: cfg.mode, target: cfg.target || 1, komi: gameKomi }], 15000, () => null);
        if (!res) return null;
        const who = G.COLOR_JA[f.st.turn];
        const actual = nx ? `実際の手は${nx.label.replace(/^(黒|白) /, '')}。` : '';
        if (res.move < 0) return { marks: {}, text: `${who}の番：おすすめはパスです。${actual}` };
        const same = !!nx && nx.label.replace(/^(黒|白) /, '').startsWith(P(res.move));
        return { marks: { [res.move]: f.st.turn === 'X' ? 'ghostX' : 'ghostO' },
          text: `${who}の番：おすすめは${P(res.move)}（影の石）。${same ? '実際の手と同じです。' : actual}` };
      };
      showKifu(kifuBox, kifu, (f, extra) => board.setPosition(f.pos, { ...f.mark, ...(extra || {}) }, { turn: f.turn }), capture ? {
        suggest,
        me, unit: 1, exportName: 'SGF',
        exportText: () => G.toSGF(n, moves, { komi: 0, setup: kifu[0].pos, rule: 'Japanese', result: lastResult === 'win' ? 'B+' : 'W+' }),
      } : {
        suggest,
        me, unit: 3,
        evalOf: (f) => NS_THINK.run('goEval', [f.st, gameKomi, EST_PLAYOUTS], 6000, () => null),
        valueText: (v) => `この局面の見込み：${estText(v)}（コミ込み）`,
        dropText: (k, d) => `${k}手目（約${Math.round(d)}目）`,
        exportName: 'SGF',
        exportText: () => G.toSGF(n, moves, { komi: gameKomi, rule: 'Japanese', setup: /[XO]/.test(kifu[0].pos) ? kifu[0].pos : null, result: lastResult === 'win' ? 'B+' : lastResult === 'lose' ? 'W+' : '0' }),
      });
    };

    /** 終局：死に石を見込んで、地を数える。石をタップすると死に石の判定を直せる */
    async function endGame() {
      const my = ++token;
      busy = true; scoring = true;
      tell('おたがいにパスしたので終局です。死に石と地を数えています…');
      const own = await NS_THINK.run('goOwner', [{ n, s: st.s, ko: st.ko, turn: st.turn, playouts: 700, timeMs: 3000 }], 12000, () => null);
      if (my !== token || !ctx.alive()) return;
      owner = own;
      dead = new Set(own ? G.deadStones(st, own) : []);
      busy = false;
      showScore();
    }
    function showScore() {
      const sc = G.score(st, [...dead], komi);
      const m = {};
      sc.map.forEach((o, i) => { if (o) m[i] = o === 'X' ? 'terrX' : 'terrO'; });
      for (const i of dead) m[i] = 'dead';
      board.setPosition(st.s, m, { turn: st.turn });
      const res = G.resultText(sc.diff);
      ctx.say(`<b>数えると：${res}</b>`
        + `黒：地 ${sc.terr.X}目 ＋ アゲハマ ${sc.caps.X + sc.dead.O}個 ＝ ${sc.black}目<br>`
        + `白：地 ${sc.terr.O}目 ＋ アゲハマ ${sc.caps.O + sc.dead.X}個 ＋ コミ ${komi}目 ＝ ${sc.white}目<br>`
        + '<span class="note">×の石は死に石（取り上げてアゲハマに入れる石）と見ています。判定が違うと思ったら、石をタップすると直せます。</span>');
      tell('数え終わりました。結果を確かめてください。');
      ctx.actions([
        { label: 'この結果で終える', variant: 'tone', onClick: () => {
          const diff = G.score(st, [...dead], komi).diff;
          const hcNote = handicap ? `（置き石${handicap}子）` : '';
          finish(diff > 0 ? `win:${G.resultText(diff)}です${hcNote}。` : diff < 0 ? `lose:${G.resultText(diff)}です${hcNote}。` : `draw:持碁です${hcNote}。`);
        } },
        { label: '対局を続ける', variant: 'ghost', onClick: () => {
          scoring = false; dead = new Set(); st = { ...st, passes: 0 }; ctx.clear(); paint(); paintActions();
          if (st.turn === foe) aiTurn(); else tell('対局を続けます。あなたの番です。');
        } },
      ]);
    }

    const aiTurn = async () => {
      const my = ++token;
      busy = true; tell('相手が考えています…');
      await wait(260 + pauseNext); pauseNext = 0;
      if (my !== token || finished || !ctx.alive()) return;
      const lvl = challenge ? (s.level || 'normal') : level();
      const res = await NS_THINK.run('goPick', [{ st, level: lvl, mode: cfg.mode, target: cfg.target || 1, komi }], 20000,
        () => G.pick({ st, level: 'easy', mode: cfg.mode, target: cfg.target || 1, komi }));
      if (my !== token || finished || !ctx.alive()) return;
      let mv = res ? res.move : -1;
      if (mv >= 0 && !G.apply(st, mv)) mv = -1;   // 念のため：打てない手ならパス
      if (mv < 0) {
        st = G.apply(st, -1);
        record(foe, -1, 0);
        saveGame();
        sfx.pick();
        busy = false;
        showCaps();
        if (!capture && st.passes >= 2) return endGame();
        paint(lastMarks = {});
        tell(capture ? '相手はパスしました。あなたの番です。' : '相手はパスしました。あなたもパスすると終局です（まだ打つところがあれば打ちます）。');
        paintActions();
        return;
      }
      const prev = st;
      st = G.apply(st, mv);
      const took = st.captured.length;
      record(foe, mv, took);
      saveGame();
      took ? sfx.capture('go') : sfx.place('go');
      busy = false;
      showCaps();
      lastMarks = { [mv]: 'last' };
      if (capture && st.caps.O >= cfg.target) { paint(lastMarks); return finish('lose:相手に先に取られました。アタリになった石は、逃げるか相手の石を取って助けます。'); }
      if (!capture && st.moves >= n * n * 2.5) { paint(lastMarks); return endGame(); }
      warnAtari(prev);
      goTheirs(took);
      paintActions();
      prefetchEst();
    };

    /** 相手の手で、自分の石がアタリになったら知らせる */
    function warnAtari(prev) {
      const mine = G.groups(st.s, n, me).filter((g) => g.libs.length === 1);
      const m = { ...lastMarks };
      if (mine.length && coach.on) {
        for (const g of mine) for (const k of g.stones) m[k] = 'atari';
        const big = mine.reduce((a, b) => (b.stones.length > a.stones.length ? b : a));
        tell(`注意：あなたの石（${P(big.stones[0])}${big.stones.length > 1 ? `など${big.stones.length}子` : ''}）がアタリです。逃げるか、相手の石を取って助けましょう。`);
      } else {
        const last = st.last >= 0 ? `相手は${P(st.last)}に打ちました。` : '';
        tell(`${last}あなたの番です。`);
      }
      paint(m);
    }

    /** 相手が打ったあとのひとこと：自分の石のアタリ → 取られた石 → 取れる石 → 序盤・終盤のコツ */
    function goTheirs(took) {
      if (!coach.on || finished) return;
      const mine = G.groups(st.s, n, me).filter((g) => g.libs.length === 1);
      if (mine.length) {
        const big = mine.reduce((a, b) => (b.stones.length > a.stones.length ? b : a));
        const k = big.stones.length;
        coach.say({ text: pickOne([`アタリです！ ${k > 1 ? `${k}子の` : ''}石が取られそう。逃げるか、相手の石を取って助けましょう。`,
          `あぶない！ ${k > 1 ? `${k}子の` : 'その'}石の呼吸点が、あと1つです。`]), mood: 'alert' });
        board.flash([{ i: big.libs[0], c: 'ng' }]);
        return;
      }
      if (took) {
        coach.say({ text: pickOne([`${took}子取られました。アタリになった石は、早めに逃げるのがコツです。`, `あっ、${took}子取られました。でも、まだまだこれから！`]), mood: 'hmm' });
        return;
      }
      if (G.groups(st.s, n, foe).some((g) => g.libs.length === 1 && G.isLegal(st.s, n, g.libs[0], me, st.ko))) {
        coach.say({ text: pickOne(['チャンス！ 相手の石に、アタリのものがあります。取れるかな？', '盤をよく見て。呼吸点が1つしかない相手の石がありますよ。']), mood: 'happy' });
        return;
      }
      if (talker.lastBad || capture) return;
      const t = st.moves <= 3 ? talker.once('open1', '序盤は隅から。隅 → 辺 → 中央の順に打つと、地を作りやすいです。')
        : st.moves >= n * n * 0.6 ? talker.once('late', 'そろそろ終盤。境界が閉じていない所はありませんか？ 打つ所がなくなったら、パスで終局です。')
          : null;
      if (t) coach.say(t);
    }

    board.pickTwice((i) => {
      if (busy || finished) return;
      if (scoring) {
        // 死に石の判定を直す：タップした石のかたまりごと切り替える
        if (st.s[i] === '.') return;
        const g = G.group(st.s, n, i);
        const on = !dead.has(i);
        for (const k of g.stones) { if (on) dead.add(k); else dead.delete(k); }
        showScore();
        return;
      }
      if (st.turn !== me) return;
      const r = G.play(st.s, n, i, me, st.ko);
      if (r.illegal) { if (r.illegal !== 'occupied') ctx.say(GO_ILLEGAL[r.illegal], 'ng'); return; }
      commit(i);
    }, () => NS_GOBOARD.confirmOn() && !busy && !finished && !scoring && st.turn === me);

    async function commit(i) {
      const before = st;
      history.push({ st: before, kifuLen: kifu.length, movesLen: moves.length, recapLen: recap.length });
      const rv = G.review(before, i);
      st = G.apply(st, i);
      const took = st.captured.length;
      record(me, i, took);
      saveGame();
      took ? sfx.capture('go') : sfx.place('go');
      ctx.clear();
      showCaps();
      const seq = ++moveSeq;
      // 形勢の見込み（目数）：形の講評で指摘がない手でも、見込みが大きく下がったら知らせる。
      // 良い手でもふつうは見込みが上がる（手番の分）ので、8目以上下がったときだけ言う
      if (!capture && coach.on && rv.level === 'ok') {
        busy = true; paint({ [i]: 'last' }); tell('相手が考えています…');
        const [eb, ea] = await Promise.all([estOf(before), estOf(st)]);
        if (seq !== moveSeq || finished || !ctx.alive()) return;
        busy = false;
        const est = typeof eb === 'number' && typeof ea === 'number' ? { b: eb, a: ea } : null;
        const drop = est ? Math.round((est.b - est.a) * (me === 'X' ? 1 : -1)) : 0;
        if (drop >= 8) {
          rv.level = 'miss';
          rv.lines = [{ kind: 'gloss', sq: i,
            what: `この手のあと、形勢の見込みが約${drop}目下がりました（${estText(est.b)} → ${estText(est.a)}）。`,
            why: 'AIが盤面の地を見積もった目安です。大きく下がる手は、たいてい「危ない石を守らなかった」「もっと大きい所があった」のどちらかです。',
            lesson: '打つ前に、急ぐ所（アタリや眼のない石）→ 大きい所（広い隅や辺）の順に見比べます。',
            marks: { [i]: 'ng' }, d: { drop } }, ...rv.lines.filter((l) => l.kind !== 'good')];
        }
      }
      for (const l of rv.lines) {
        const link = K.lessonFor('go', l.kind);
        if (link && !l.link) l.link = `#/go/${link}`;
        // 盤で見るための「こうすれば」の点に、置く石の影を出す
        if (l.better && l.marks) l.marks = { ...l.marks, [l.better.to]: 'ghostX' };
      }
      tally.add(rv);
      if (rv.level !== 'ok') {
        recap.push({ n: history.length, pos: before.s, move: { from: null, to: i }, rv });
        saveGoMistake(before, rv);
      }
      coach.show(rv);
      const cm = rv.lines.find((l) => l.marks && rv.level !== 'ok');
      paint({ [i]: 'last', ...(cm ? cm.marks : {}) });
      // コーチのひとことと、盤の目印（緑＝こうすれば、赤＝気をつける点）
      const said = rv.lines.length ? talker.mine(rv) : talker.mine({ level: 'ok', lines: [{ kind: 'good', d: {} }] });
      if (said && coach.on) {
        coach.say(said);
        const bad = rv.level !== 'ok' ? rv.lines.find((l) => l.kind !== 'good') : null;
        const pts = [];
        if (bad?.better?.to != null) pts.push({ i: bad.better.to, c: 'ok' });
        if (bad?.kind === 'gselfatari') {
          const lib = Object.entries(bad.marks || {}).find(([, v]) => v === 'hint');
          if (lib) pts.push({ i: +lib[0], c: 'ng' });
        }
        if (['gedge', 'gfill', 'geye'].includes(bad?.kind)) pts.push({ i, c: 'ng' });
        if (pts.length) board.flash(pts);
      }
      pauseNext = coach.on ? coachPause(rv, said) : 0;
      if (capture && st.caps.X >= cfg.target) return finish('win');
      if (!capture && st.moves >= n * n * 2.5) return endGame();
      aiTurn();
    }

    /** 実戦の見逃し（取れる石・助けられる石）を、あとで解き直す問題にして残す */
    function saveGoMistake(before, rv) {
      if (before.ko >= 0) return;
      const l = rv.lines.find((x) => (x.kind === 'gmisscap' || x.kind === 'gignore') && x.better);
      if (!l) return;
      const stones = Object.entries(l.marks || {}).filter(([k, v]) => (v === 'hint' || v === 'ng') && before.s[k] !== '.').map(([k]) => +k);
      if (!stones.length) return;
      const t = stones[0];
      const step = {
        type: 'gmove', board: G.rowsOf(n, before.s), turn: me,
        goal: l.kind === 'gmisscap' ? 'take' : 'escape', target: [(t % n) + 1, ((t / n) | 0) + 1],
        prompt: l.kind === 'gmisscap'
          ? '実戦のこの局面には<strong>取れる石</strong>がありました。取ってください。'
          : '実戦ではここで、アタリの石をそのままにしました。<strong>石を助ける手</strong>を打ってください。',
        why: `${l.what}。${l.why}`, hint: l.lesson || '',
      };
      const sig = before.s;
      if (store.pendingMistakes('go').some((m) => (m.step.board || []).join('') === sig)) return;
      try { store.addMistake('go', l.kind, step, `${today()}の対局`); } catch { }
    }

    const pass = () => {
      if (busy || finished || scoring || st.turn !== me) return;
      // 早すぎるパスは確かめる（2回続くと、その場で終局して数えるため）
      if (!capture && !passOk && st.moves < n * n * 0.45) {
        ctx.say('<b>まだ打てるところが多く残っています</b>パスが2回続くと、その場で終局して地を数えます。本当にパスしますか。', 'ng');
        ctx.actions([
          { label: 'パスする', variant: 'ghost', onClick: () => { passOk = true; pass(); } },
          { label: '打ち続ける', variant: 'tone', onClick: () => { ctx.clear(); paintActions(); } },
        ]);
        return;
      }
      history.push({ st, kifuLen: kifu.length, movesLen: moves.length, recapLen: recap.length });
      st = G.apply(st, -1);
      record(me, -1, 0);
      saveGame();
      sfx.pick();
      coach.clear(); ctx.clear(); showCaps();
      if (!capture && st.passes >= 2) return endGame();
      aiTurn();
    };
    const resign = () => {
      if (finished || scoring) return;
      token++;
      finish('lose:resign');
    };
    const undo = () => {
      const prev = history.pop();
      if (!prev) return;
      token++; moveSeq++;
      st = prev.st;
      kifu.length = prev.kifuLen; moves.length = prev.movesLen; recap.length = prev.recapLen;
      kifuBox.innerHTML = ''; recapBox.innerHTML = '';
      busy = false; finished = false; scoring = false; dead = new Set();
      coach.clear(); ctx.clear(); paint(); showCaps();
      coach.say({ text: pickOne(['1手もどしました。今度はどこに打ちますか？', 'やり直しです。打つ前に、呼吸点を数えてみましょう。']), mood: 'think' });
      tell('1手もどしました。もう一度どうぞ。');
      paintActions();
      saveGame();
    };
    /** ヒント：相手と同じ考え方で、いまの局面のおすすめを1つ示す（勝敗の記録には影響しない） */
    const hint = async () => {
      if (busy || finished || scoring || st.turn !== me) return;
      const my = ++token;
      busy = true; tell('おすすめの手を考えています…');
      const res = await NS_THINK.run('goPick', [{ st, level: 'normal', mode: cfg.mode, target: cfg.target || 1, komi }], 15000, () => null);
      if (my !== token || !ctx.alive()) return;
      busy = false;
      if (!res || res.move < 0) { tell(capture ? 'おすすめが見つかりませんでした。' : 'もう大きなところは残っていないようです。パスしてもよさそうです。'); return; }
      paint({ ...lastMarks, [res.move]: 'ghostX' });
      tell(`おすすめ：${P(res.move)}（影の石の点）。理由を考えてから打ってみましょう。`);
    };
    /** いまの形勢の見込み（目数）を出す。勝敗の記録には影響しない */
    const showEstimate = async () => {
      if (busy || finished || scoring) return;
      const my = ++token;
      busy = true; tell('形勢を見ています…');
      const v = await estOf(st);
      if (my !== token || !ctx.alive()) return;
      busy = false;
      if (typeof v !== 'number') { tell('形勢を見られませんでした。'); return; }
      tell(`いまの見込み：${estText(v)}（コミ${komi}目込み。死に石や地の境界はAIの見立てなので、目安です）。${st.turn === me ? 'あなたの番です。' : ''}`);
    };
    function paintActions() {
      ctx.actions([
        { label: 'ヒント', variant: 'ghost', onClick: hint },
        ...(capture ? [] : [{ label: '形勢（目数）', variant: 'ghost', onClick: showEstimate }]),
        ...(capture ? [] : [{ label: 'パス', variant: 'ghost', onClick: pass }]),
        { label: '1手もどす', variant: 'ghost', onClick: undo, disabled: !history.length },
        { label: '投了', variant: 'ghost', onClick: resign },
        { label: '最初から', variant: 'ghost', onClick: reset },
      ]);
    }

    const sv = loadSave();
    if (sv) offerResume(sv); else reset();
  }

  // ───────────────────────────────────────────────
  // 実戦の棋譜を振り返る：PGN（チェス）・KIF/CSA（将棋）・SGF（囲碁）を読み込み、
  // コーチが自分の手を1手ずつ講評する。悪手は「自分の悪手から」の復習問題にできる
  // ───────────────────────────────────────────────
  const escH = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const IMPORT_FMT = { chess: 'PGN', shogi: 'KIF・KI2・CSA', go: 'SGF' };
  const KAN19 = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九'];

  /** PGN → { headers, sans }。コメント・変化手順・手数・結果は取り除く */
  function parsePGN(text) {
    const headers = {};
    const src = String(text || '');
    src.replace(/\[(\w+)\s+"([^"]*)"\]/g, (_, k, v) => { headers[k] = v; return ''; });
    let body = src.replace(/\[[^\]]*\]/g, ' ').replace(/\{[^}]*\}/g, ' ').replace(/;[^\n]*/g, ' ');
    for (let prev = ''; prev !== body;) { prev = body; body = body.replace(/\([^()]*\)/g, ' '); }
    body = body.replace(/\$\d+/g, ' ').replace(/\d+\s*\.(\s*\.\.)?/g, ' ');
    // 「e.p.」（アンパッサンの印）が手と離れて書かれていることがある
    const sans = body.split(/\s+/).filter((t) => t && !/^(1-0|0-1|1\/2-1\/2|½-½|\*|e\.p\.)$/.test(t));
    return { headers, sans };
  }
  /** FEN（途中の局面）→ { pos, turn, opts, no（手数） }。読めなければ null */
  function fromFEN(fen) {
    const [place, side = 'w', cas = '-', ep = '-', , no = '1'] = String(fen || '').trim().split(/\s+/);
    const rows = (place || '').split('/');
    if (rows.length !== 8) return null;
    const pos = {};
    for (let i = 0; i < 8; i++) {
      let f = 0;
      for (const ch of rows[i]) {
        if (/[1-8]/.test(ch)) { f += Number(ch); continue; }
        if (!/[KQRBNPkqrbnp]/.test(ch) || f > 7) return null;
        pos['abcdefgh'[f] + (8 - i)] = ch;
        f++;
      }
      if (f !== 8) return null;
    }
    const v = Object.values(pos);
    if (v.filter((x) => x === 'K').length !== 1 || v.filter((x) => x === 'k').length !== 1) return null;
    // キャスリング権は、キングとルークが元の位置にいるときだけ残す
    const castle = {
      w: { k: cas.includes('K') && pos.e1 === 'K' && pos.h1 === 'R', q: cas.includes('Q') && pos.e1 === 'K' && pos.a1 === 'R' },
      b: { k: cas.includes('k') && pos.e8 === 'k' && pos.h8 === 'r', q: cas.includes('q') && pos.e8 === 'k' && pos.a8 === 'r' },
    };
    return { pos, turn: side === 'b' ? 'b' : 'w', opts: { w: 8, h: 8, castle, ep: /^[a-h][36]$/.test(ep) ? ep : null }, no: Math.max(1, Number(no) || 1) };
  }
  // 駒の絵文字で書かれた棋譜（♘f3 など）も読む
  const FIGURINE = { '♔': 'K', '♕': 'Q', '♖': 'R', '♗': 'B', '♘': 'N', '♙': '', '♚': 'K', '♛': 'Q', '♜': 'R', '♝': 'B', '♞': 'N', '♟': '' };
  /** SAN の1手を、合法手の中から探す（見つからない・決まらないときは null） */
  function sanMove(pos, opts, side, san) {
    const s = san.replace(/[♔♕♖♗♘♙♚♛♜♝♞♟]/g, (c) => FIGURINE[c]).replace(/[!?]+/g, '').replace(/[+#]/g, '').replace(/e\.p\.$/, '')
      .replace(/^0-0-0$/, 'O-O-O').replace(/^0-0$/, 'O-O');
    const legal = CH.allLegalMoves(pos, side, opts);
    if (s === 'O-O' || s === 'O-O-O') {
      const r = side === 'w' ? '1' : '8';
      const to = `${s === 'O-O' ? 'g' : 'c'}${r}`;
      const m = legal.find((x) => x.from === `e${r}` && x.to === to && CH.kindOf(pos[x.from]) === 'K');
      return m ? { from: m.from, to: m.to, promo: null } : null;
    }
    const m = s.match(/^([KQRBN])?([a-h])?([1-8])?x?([a-h][1-8])=?([QRBN])?$/);
    if (!m) return null;
    const piece = m[1] || 'P';
    const c = legal.filter((x) => x.to === m[4] && CH.kindOf(pos[x.from]) === piece
      && (!m[2] || x.from[0] === m[2]) && (!m[3] || x.from[1] === m[3]));
    if (c.length !== 1) return null;
    const last = side === 'w' ? '8' : '1';
    return { from: c[0].from, to: c[0].to, promo: piece === 'P' && m[4][1] === last ? (m[5] || 'Q') : null };
  }
  function readChess(text) {
    const { headers, sans } = parsePGN(text);
    let pos = { ...CH.START_POSITION };
    let opts = { w: 8, h: 8, castle: { w: { k: true, q: true }, b: { k: true, q: true } }, ep: null };
    let turn = 'w', no = 1;
    // 途中の局面（FEN）から始まる棋譜も読む。Chess960 は読まない
    if (/960/.test(headers.Variant || '')) return { error: 'チェス960の棋譜には対応していません。' };
    if (headers.FEN) {
      const f = fromFEN(headers.FEN);
      if (!f) return { error: '始まりの局面（FEN）が読めませんでした。' };
      ({ pos, opts, turn, no } = f);
    }
    const plies = [];
    const first = turn;
    for (let k = 0; k < sans.length; k++) {
      const num = no + Math.floor((k + (first === 'b' ? 1 : 0)) / 2);
      if (sans[k] === '--' || sans[k] === 'Z0') return { error: `${num}手目の「${escH(sans[k])}」（パス）を含む棋譜には対応していません。`, plies };
      const mv = sanMove(pos, opts, turn, sans[k]);
      if (!mv) return { error: `${num}手目（${turn === 'w' ? '白' : '黒'}）の「${escH(sans[k])}」が読めませんでした。`, plies };
      const next = CH.nextRights(opts, pos, mv.from, mv.to);
      const after = CH.applyMove(pos, mv.from, mv.to, opts, mv.promo || undefined);
      plies.push({ side: turn, label: `${num}${turn === 'w' ? '.' : '…'} ${sans[k]}`, before: pos, beforeOpts: opts, after, afterOpts: next, mv });
      pos = after; opts = next; turn = turn === 'w' ? 'b' : 'w';
    }
    if (!plies.length) return { error: '手が見つかりませんでした。PGN をそのまま貼り付けてください。' };
    return { plies, sides: [['w', `白（${headers.White || '先に指した側'}）`], ['b', `黒（${headers.Black || '後に指した側'}）`]] };
  }

  const KIF_P = { 歩: 'P', 香: 'L', 桂: 'N', 銀: 'S', 金: 'G', 角: 'B', 飛: 'R', 玉: 'K', 王: 'K', と: '+P', 成香: '+L', 成桂: '+N', 成銀: '+S', 馬: '+B', 龍: '+R', 竜: '+R', 杏: '+L', 圭: '+N', 全: '+S' };
  const CSA_P = { FU: 'P', KY: 'L', KE: 'N', GI: 'S', KI: 'G', KA: 'B', HI: 'R', OU: 'K', TO: '+P', NY: '+L', NK: '+N', NG: '+S', UM: '+B', RY: '+R' };
  const KAN_N = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  /** 駒落ち：上手（後手）が落とす駒のマス。上手から指し始める */
  const HANDICAP = {
    香落ち: ['11'], 右香落ち: ['91'], 角落ち: ['22'], 飛車落ち: ['82'], 飛落ち: ['82'], 飛香落ち: ['82', '11'],
    二枚落ち: ['82', '22'], 三枚落ち: ['82', '22', '11'], 四枚落ち: ['82', '22', '11', '91'], 五枚落ち: ['82', '22', '11', '91', '81'],
    六枚落ち: ['82', '22', '11', '91', '21', '81'], 七枚落ち: ['82', '22', '11', '91', '21', '81', '71'],
    八枚落ち: ['82', '22', '11', '91', '21', '81', '31', '71'], 十枚落ち: ['82', '22', '11', '91', '21', '81', '31', '71', '41', '61'],
  };
  /** KIF の持ち駒の書き方（「歩十八 金二 銀」）→ { P: 18, G: 2, S: 1 }。読めなければ null */
  function kifHand(text) {
    const h = {};
    for (const tok of String(text).replace(/なし/, '').split(/[\s　]+/).filter(Boolean)) {
      const k = KIF_P[tok[0]];
      if (!k || k.startsWith('+') || k === 'K') return null;
      const rest = tok.slice(1);
      const n = !rest ? 1 : rest[0] === '十' ? 10 + (KAN_N[rest[1]] || 0) : KAN_N[rest];
      if (!n) return null;
      h[k] = (h[k] || 0) + n;
    }
    return h;
  }
  /**
   * 棋譜の始まりの局面。KIF の「手合割」（駒落ち）・盤面図（BOD）・持駒・手番、
   * CSA の PI（駒落ち）・P1〜P9（盤面）・P+／P-（持ち駒）・手番の行を読む。
   * 返り値 { st }（平手なら startBig と同じ）か { error }
   */
  function shogiStart(lines, csa) {
    let st = SH.startBig();
    if (csa) {
      const rows = {};
      for (const raw of lines) {
        for (const line of raw.trim().split(',')) {
          let m;
          if ((m = line.match(/^PI((?:\d\d[A-Z]{2})*)\s*$/))) {
            for (const [, sqr] of m[1].matchAll(/(\d\d)[A-Z]{2}/g)) delete st.board[sqr];
          } else if ((m = line.match(/^P([1-9])(.*)$/))) {
            rows[m[1]] = m[2];
          } else if ((m = line.match(/^P([+-])((?:\d\d[A-Z]{2})+)\s*$/))) {
            const side = m[1] === '+' ? 'b' : 'w';
            for (const [, sqr, code] of m[2].matchAll(/(\d\d)([A-Z]{2})/g)) {
              if (code === 'AL') return { error: '持ち駒を「AL」で書いた CSA には対応していません。' };
              const k = CSA_P[code];
              if (!k) return { error: 'CSA の局面が読めませんでした。' };
              if (sqr === '00') st.hands[side][k] = (st.hands[side][k] || 0) + 1;
              else st.board[sqr] = side === 'b' ? k : k.replace(/[A-Z]/, (c) => c.toLowerCase());
            }
          } else if (/^[+-]$/.test(line.trim())) {
            st.turn = line.trim() === '+' ? 'b' : 'w';
          }
        }
      }
      if (Object.keys(rows).length) {
        if (Object.keys(rows).length !== 9) return { error: 'CSA の盤面（P1〜P9）が読めませんでした。' };
        const board = {};
        for (let r = 1; r <= 9; r++) {
          const row = rows[r].padEnd(27, ' ');
          for (let c = 0; c < 9; c++) {
            const cell = row.slice(c * 3, c * 3 + 3);
            if (cell.trim() === '*' || !cell.trim()) continue;
            const k = CSA_P[cell.slice(1, 3)];
            if (!k || !/^[+-]$/.test(cell[0])) return { error: 'CSA の盤面（P1〜P9）が読めませんでした。' };
            board[`${9 - c}${r}`] = cell[0] === '+' ? k : k.replace(/[A-Z]/, (x) => x.toLowerCase());
          }
        }
        st = { ...st, board };
      }
    } else {
      let bod = null;
      for (const raw of lines) {
        const line = raw.replace(/\s+$/, '');
        let m;
        if ((m = line.match(/^手合割[：:]\s*(.+)$/))) {
          const name = m[1].trim();
          if (/平手/.test(name)) continue;
          if (/その他/.test(name)) continue;   // 盤面図で決まる
          const drop = HANDICAP[name];
          if (!drop) return { error: `手合割「${escH(name)}」には対応していません。` };
          for (const q of drop) delete st.board[q];
          st.turn = 'w';
        } else if ((m = line.match(/^\|(.*)\|\s*([一二三四五六七八九])/))) {
          bod = bod || {};
          const r = KAN_N[m[2]];
          const cells = [...m[1]];
          // 1マス2文字（「v」か空白＋駒の字。空きは「・」）
          if (cells.length < 18) return { error: '盤面図が読めませんでした。' };
          for (let c = 0; c < 9; c++) {
            const side = cells[c * 2], ch = cells[c * 2 + 1];
            if (ch === '・' || ch === ' ' || ch === '　') continue;
            const k = KIF_P[ch];
            if (!k) return { error: '盤面図が読めませんでした。' };
            bod[`${9 - c}${r}`] = side === 'v' ? k.replace(/[A-Z]/, (x) => x.toLowerCase()) : k;
          }
        } else if ((m = line.match(/^(先手|後手|下手|上手)の持駒[：:](.*)$/))) {
          const h = kifHand(m[2]);
          if (!h) return { error: '持駒の行が読めませんでした。' };
          st.hands[m[1] === '先手' || m[1] === '下手' ? 'b' : 'w'] = h;
        } else if (/^(後手番|上手番)/.test(line.trim())) st.turn = 'w';
        else if (/^(先手番|下手番)/.test(line.trim())) st.turn = 'b';
      }
      if (bod) st = { ...st, board: bod };
    }
    // 玉が1枚ずつあること
    const v = Object.values(st.board);
    if (v.filter((x) => x === 'K').length !== 1 || v.filter((x) => x === 'k').length !== 1) return { error: '始まりの局面が読めませんでした（玉が見つかりません）。' };
    return { st };
  }

  /**
   * KI2（「▲７六歩 △３四歩 ▲２二角成」のように、動かした駒の元のマスを書かない形式）の1手を、合法手から探す。
   * 同じマスに同じ駒が2枚以上行けるときは、右・左・直・上・引・寄 で決める
   */
  function ki2Move(st, shape, to, kind, rel, act) {
    const legal = SH.allLegalMoves(st, shape);
    const me = st.turn;
    if (act === '打') return legal.find((m) => m.drop && m.drop.toUpperCase() === kind && m.to === to) || null;
    let c = legal.filter((m) => !m.drop && m.to === to && SH.kindOf(st.board[m.from]) === kind);
    // 「成」と書いてあれば成る手。書いていなければ成らない手（成るしかない手しかないときは、それを採る）
    if (act === '成') c = c.filter((m) => m.promote);
    else { const np = c.filter((m) => !m.promote); c = np.length ? np : c; }
    // 打つ手でも動かす手でも書ける形（打を省略）は、盤上の駒の手を優先する
    if (!c.length && !act) {
      const d = legal.find((m) => m.drop && m.drop.toUpperCase() === kind && m.to === to);
      return d || null;
    }
    if (c.length <= 1) return c[0] || null;
    // 先手から見た向き：段が小さい方が前、筋が小さい方が右（後手は逆）
    const fwd = (m) => (me === 'b' ? Number(m.from[1]) - Number(to[1]) : Number(to[1]) - Number(m.from[1]));   // 前へ進んだ段数
    const side = (m) => (me === 'b' ? Number(m.from[0]) - Number(to[0]) : Number(to[0]) - Number(m.from[0]));   // 正なら左から来た（移動先から見て元が左）
    // 上・引・寄で絞ってから、右・左・直で決める（「右上」は、上がる駒のうち右の駒）
    const chars = [...(rel || '')].sort((x, y) => ('上引寄'.includes(y) ? 1 : 0) - ('上引寄'.includes(x) ? 1 : 0));
    for (const ch of chars) {
      if (ch === '上') c = c.filter((m) => fwd(m) > 0);
      else if (ch === '引') c = c.filter((m) => fwd(m) < 0);
      else if (ch === '寄') c = c.filter((m) => fwd(m) === 0);
      else if (ch === '直') c = c.filter((m) => fwd(m) === 1 && side(m) === 0);
      else if (ch === '右' || ch === '左') {
        // 動かす駒のうち、指す人から見て右（左）にある駒
        const pos = (m) => (me === 'b' ? Number(m.from[0]) : -Number(m.from[0]));   // 先手は筋が大きいほど左
        const ext = ch === '右' ? Math.min(...c.map(pos)) : Math.max(...c.map(pos));
        c = c.filter((m) => pos(m) === ext);
      }
    }
    return c.length === 1 ? c[0] : null;
  }

  function readShogi(text) {
    const shape = SH.BIG;
    const lines = String(text || '').split(/\r?\n/);
    const csa = lines.some((l) => /^[+-]\d{4}[A-Z]{2}/.test(l.trim().split(',')[0]) || /,[+-]\d{4}[A-Z]{2}/.test(l));
    const s0 = shogiStart(lines, csa);
    if (s0.error) return { error: s0.error };
    let st = s0.st;
    const plies = [];
    const names = { b: '先手', w: '後手' };
    const pick = (want) => SH.allLegalMoves(st, shape).find((m) => (want.drop ? m.drop && m.drop.toUpperCase() === want.drop : !m.drop && m.from === want.from)
      && m.to === want.to && !!m.promote === !!want.promote);
    const sq = (to) => `${to[0]}${'一二三四五六七八九'[Number(to[1]) - 1]}`;
    const push = (mv, text2) => {
      const after = SH.applyMove(st, mv, shape);
      plies.push({ side: st.turn, label: `${plies.length + 1} ${st.turn === 'b' ? '▲' : '△'}${text2}`, before: st, after, mv });
      st = after;
    };
    let lastTo = null;
    if (csa) {
      for (const raw of lines) {
        for (const line of raw.trim().split(',')) {
          if (/^N\+/.test(line)) { names.b = line.slice(2).trim() || names.b; continue; }
          if (/^N-/.test(line)) { names.w = line.slice(2).trim() || names.w; continue; }
          const m = line.match(/^([+-])(\d)(\d)(\d)(\d)([A-Z]{2})/);
          if (!m) continue;
          const [, sign, f1, r1, f2, r2, code] = m;
          const kind = CSA_P[code];
          const to = `${f2}${r2}`;
          if (!kind) return { error: `${plies.length + 1}手目が読めませんでした。`, plies };
          if ((sign === '+') !== (st.turn === 'b')) return { error: `${plies.length + 1}手目（${escH(line.slice(0, 7))}）の手番が合いません。`, plies };
          let want;
          if (f1 === '0') want = { drop: kind, to };
          else {
            const from = `${f1}${r1}`, pc = st.board[from];
            want = { from, to, promote: !!pc && !SH.isPromoted(pc) && kind.startsWith('+') };
          }
          const mv = pick(want);
          if (!mv) return { error: `${plies.length + 1}手目（${escH(line.slice(0, 7))}）は、この局面では指せない手です。`, plies };
          push(mv, `${sq(to)}${SH.PIECE_JA[kind] || ''}${want.promote ? '成' : ''}${want.drop ? '打' : ''}`);
        }
      }
    } else {
      let kifMoves = false;
      for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;
        if (/^変化[：:]/.test(line)) break;   // ここから先は別の変化（本譜ではない）
        const h = line.match(/^(先手|後手|下手|上手)[：:](.*)$/);
        if (h) {
          if (h[1] === '先手' || h[1] === '下手') names.b = h[2].trim() || names.b;
          else names.w = h[2].trim() || names.w;
          continue;
        }
        const m = line.match(/^(\d+)\s+(.+)$/);
        if (!m) continue;
        kifMoves = true;
        let t = m[2].replace(/\+$/, '').replace(/\s*\(\s*\d+:\d+(?:\/[\d:]+)?\s*\)\s*$/, '').trim();
        if (/^(投了|中断|千日手|持将棋|詰み|切れ負け|反則|入玉|不詰|タイムアップ|勝ち宣言|封じ手)/.test(t)) break;
        const shown = t.replace(/\(\d\d\)/, '').replace(/[\s　]+/g, '');
        let to;
        if (t[0] === '同') { to = lastTo; t = t.slice(1).replace(/^[\s　]+/, ''); }
        else {
          const f = '１２３４５６７８９'.indexOf(t[0]) + 1 || '123456789'.indexOf(t[0]) + 1;
          const r = '一二三四五六七八九'.indexOf(t[1]) + 1;
          if (!f || !r) return { error: `${m[1]}手目（${escH(t)}）が読めませんでした。`, plies };
          to = `${f}${r}`;
          t = t.slice(2);
        }
        if (!to) return { error: `${m[1]}手目の「同」が読めませんでした。`, plies };
        const fromM = t.match(/\((\d)(\d)\)/);
        let name = t.replace(/\(.*$/, '').trim();
        const drop = /打$/.test(name);
        name = name.replace(/打$/, '');
        let promote = false;
        if (/不成$/.test(name)) name = name.replace(/不成$/, '');
        else if (/成$/.test(name) && !['成香', '成桂', '成銀'].includes(name)) { promote = true; name = name.slice(0, -1); }
        const kind = KIF_P[name];
        if (!kind || (!drop && !fromM)) return { error: `${m[1]}手目（${escH(m[2])}）が読めませんでした。`, plies };
        const mv = pick(drop ? { drop: kind, to } : { from: `${fromM[1]}${fromM[2]}`, to, promote });
        if (!mv) return { error: `${m[1]}手目（${escH(shown)}）は、この局面では指せない手です。`, plies };
        push(mv, shown);
        lastTo = to;
      }
      // 手数の番号がない棋譜は KI2（▲７六歩 △３四歩 …）として読む
      if (!kifMoves) {
        const body = lines.filter((l) => !/^(開始日時|終了日時|棋戦|場所|持ち時間|手合割|先手|後手|下手|上手|戦型|\*|#|&|\||まで)/.test(l.trim())).join(' ');
        const re = /([▲△☗☖])\s*(同|[１-９1-9][一二三四五六七八九])[\s　]*(成香|成桂|成銀|[歩香桂銀金角飛玉王と杏圭全馬龍竜])([右左直]?)([上寄引]?)(不成|成|打)?/g;
        let mm;
        while ((mm = re.exec(body))) {
          const [, mark, where, pname, lr, ud, act] = mm;
          const side = mark === '▲' || mark === '☗' ? 'b' : 'w';
          if (side !== st.turn) return { error: `${plies.length + 1}手目（${escH(mm[0])}）の手番が合いません。`, plies };
          const to = where === '同' ? lastTo : `${'１２３４５６７８９'.indexOf(where[0]) + 1 || '123456789'.indexOf(where[0]) + 1}${KAN_N[where[1]]}`;
          if (!to) return { error: `${plies.length + 1}手目の「同」が読めませんでした。`, plies };
          const kind = KIF_P[pname];
          const mv = ki2Move(st, shape, to, kind, lr + ud, act === '不成' ? '' : act || '');
          if (!mv) return { error: `${plies.length + 1}手目（${escH(mm[0])}）は、この局面では指せない手か、どの駒か決められません。`, plies };
          push(mv, `${mark}${where === '同' ? '同' : sq(to)}${pname}${lr}${ud}${act || ''}`.slice(1));
          lastTo = to;
        }
        for (const l of lines) {
          const h = l.trim().match(/^(先手|後手|下手|上手)[：:](.*)$/);
          if (h) { if (h[1] === '先手' || h[1] === '下手') names.b = h[2].trim() || names.b; else names.w = h[2].trim() || names.w; }
        }
      }
    }
    if (!plies.length) return { error: '手が見つかりませんでした。KIF・KI2・CSA のどれかを、そのまま貼り付けてください。' };
    return { plies, sides: [['b', `先手（${names.b}）`], ['w', `後手（${names.w}）`]] };
  }

  /** SGF → 本譜（最初の変化だけ）のノード */
  function sgfNodes(text) {
    const src = String(text || '');
    let i = 0;
    const nodes = [];
    const ws = () => { while (i < src.length && /\s/.test(src[i])) i++; };
    const seq = (main) => {
      let child = 0;
      while (i < src.length) {
        ws();
        const ch = src[i];
        if (ch === ';') {
          i++;
          const props = {};
          for (;;) {
            ws();
            const m = /^[A-Za-z]+/.exec(src.slice(i, i + 16));
            if (!m) break;
            i += m[0].length;
            const key = m[0].replace(/[a-z]/g, '');
            const vals = [];
            ws();
            while (src[i] === '[') {
              let j = i + 1, v = '';
              while (j < src.length && src[j] !== ']') { if (src[j] === '\\') j++; v += src[j] ?? ''; j++; }
              vals.push(v); i = j + 1; ws();
            }
            props[key] = (props[key] || []).concat(vals);
          }
          if (main) nodes.push(props);
        } else if (ch === '(') { i++; seq(main && child++ === 0); }
        else if (ch === ')') { i++; return; }
        else i++;
      }
    };
    seq(true);
    return nodes;
  }
  function readGo(text) {
    const GE = NS_GO;
    const nodes = sgfNodes(text);
    if (!nodes.length) return { error: 'SGF が読めませんでした。' };
    const root = nodes[0];
    const n = Number(root.SZ?.[0] || 19);
    if (!(n >= 5 && n <= 19)) return { error: '盤の大きさ（SZ）が読めませんでした。' };
    const pt = (v) => {
      if (!v || (v === 'tt' && n <= 19)) return -1;
      const x = v.charCodeAt(0) - 97, y = v.charCodeAt(1) - 97;
      return x >= 0 && x < n && y >= 0 && y < n ? y * n + x : -2;
    };
    const s0 = Array(n * n).fill('.');
    for (const v of root.AB || []) { const k = pt(v); if (k >= 0) s0[k] = 'X'; }
    for (const v of root.AW || []) { const k = pt(v); if (k >= 0) s0[k] = 'O'; }
    let st = { n, s: s0.join(''), turn: 'X', ko: -1, caps: { X: 0, O: 0 }, passes: 0, moves: 0, last: -1 };
    const plies = [];
    const nm = (k) => `${(k % n) + 1}の${KAN19[((k / n) | 0) + 1]}`;
    for (const nd of nodes) {
      const col = nd.B ? 'X' : nd.W ? 'O' : null;
      if (!col) continue;
      const k = pt((nd.B || nd.W)[0]);
      if (k === -2) return { error: `${plies.length + 1}手目の座標が読めませんでした。`, plies };
      const before = { ...st, turn: col };
      if (k === -1) {
        const after = { ...before, turn: GE.other(col), ko: -1, passes: (before.passes || 0) + 1 };
        plies.push({ side: col, label: `${plies.length + 1} ${col === 'X' ? '●' : '○'}パス`, before, after, i: -1 });
        st = after;
        continue;
      }
      const after = before.s[k] === '.' ? GE.apply(before, k) : null;
      if (!after) return { error: `${plies.length + 1}手目（${nm(k)}）は、打てない点です。`, plies };
      plies.push({ side: col, label: `${plies.length + 1} ${col === 'X' ? '●' : '○'}${nm(k)}`, before, after, i: k });
      st = after;
    }
    if (!plies.length) return { error: '手が見つかりませんでした。SGF をそのまま貼り付けてください。' };
    return { plies, n, sides: [['X', `黒（${root.PB?.[0] || '先に打った側'}）`], ['O', `白（${root.PW?.[0] || '後に打った側'}）`]] };
  }

  /** 1手ぶんの講評。チェス・将棋は別スレッドの読み、囲碁はその場で */
  async function reviewPly(game, p) {
    if (game === 'chess') {
      const res = await NS_THINK.run('chessReview', [{ beforeMove: p.before, beforeOpts: p.beforeOpts, position: p.after, opts: p.afterOpts,
        me: p.side, foe: p.side === 'w' ? 'b' : 'w', mfrom: p.mv.from, sq: p.mv.to, special: false }], 12000, () => ({ rv: { level: 'ok', lines: [] } }));
      return res;
    }
    if (game === 'shogi') {
      const shape = SH.BIG;
      const res = await NS_THINK.run('shogiReview', [{ beforeState: p.before, state: p.after, mv: p.mv, shape, win: SH.isMate(p.after, shape) }],
        12000, () => ({ rv: { level: 'ok', lines: [] } }));
      return res;
    }
    if (p.i < 0) return { rv: { level: 'ok', lines: [] } };
    return { rv: NS_GO.review(p.before, p.i) };
  }
  const isBad = (rv) => rv && rv.level !== 'ok' && rv.lines.some((l) => !['good', 'goal', 'tip'].includes(l.kind));

  /** 講評の結果から、問題を作るときの追加情報（正解の手・受け付ける手）を作る */
  function mistakeExtra(r) {
    const extra = {};
    if (r.kind === 'missedmate' && r.missedMate) {
      Object.assign(extra, { answers: [{ from: r.missedMate.from, to: r.missedMate.to, ...(r.missedMate.drop ? { drop: r.missedMate.drop } : {}) }], acceptMate: true, acceptStillMating: (r.missedMateN || 1) > 1 });
    } else if (r.kind === 'missed') {
      const caps = r.caps || [];
      const top = caps.length ? caps[0].gain : 0;
      extra.answers = caps.filter((c) => c.gain === top).map((c) => ({ from: c.from, to: c.to }));
      extra.acceptMate = true;
    } else if (r.kind === 'allowmate') {
      extra.acceptNoMate = true;
      extra.unsolvable = r.unsolvable;
    }
    return extra;
  }
  /** 将棋：後手で指した局面を、盤を180度回して先手の向きにする（講評と問題は先手の番で作るため） */
  const rotSq = (q) => (q ? `${10 - Number(q[0])}${10 - Number(q[1])}` : q);
  const flipPc = (pc) => pc.replace(/[a-z]/i, (c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()));
  const rotState = (st) => ({
    board: Object.fromEntries(Object.entries(st.board).map(([k, v]) => [rotSq(k), flipPc(v)])),
    hands: { b: { ...(st.hands?.w || {}) }, w: { ...(st.hands?.b || {}) } },
    turn: st.turn === 'b' ? 'w' : 'b',
  });

  /** 悪手を「自分の悪手から」の問題にする（作れない形は飛ばす）。作れた数を返す */
  async function saveImported(game, p, me) {
    const before = store.pendingMistakes(game).length;
    const r = p.res || {};
    const extra = mistakeExtra(r);
    if (game === 'chess') {
      saveMoveMistake('chess', p.res.rv, { board: { ...p.before }, side: me, w: 8, h: 8, ...(p.beforeOpts.castle ? { castle: p.beforeOpts.castle } : {}) },
        { from: p.mv.from, to: p.mv.to }, extra);
    } else if (game === 'shogi') {
      if (me === 'b') {
        saveMoveMistake('shogi', p.res.rv, { state: { board: { ...p.before.board }, hands: SH.cloneHands(p.before.hands), turn: 'b' }, shape: SH.BIG }, p.mv, extra);
      } else {
        // 後手で指した局面は、盤を回して先手の向きにし、その向きで講評を読み直してから問題にする（文中のマスの名前も合う）
        const q = { side: 'b', before: rotState(p.before), after: rotState(p.after),
          mv: { ...p.mv, from: rotSq(p.mv.from), to: rotSq(p.mv.to) } };
        const r2 = await reviewPly('shogi', q);
        if (!isBad(r2?.rv)) return 0;
        saveMoveMistake('shogi', r2.rv, { state: { board: { ...q.before.board }, hands: SH.cloneHands(q.before.hands), turn: 'b' }, shape: SH.BIG },
          q.mv, mistakeExtra(r2));
      }
    } else {
      const b = p.before, n = b.n;
      if (b.ko >= 0) return 0;
      const l = p.res.rv.lines.find((x) => (x.kind === 'gmisscap' || x.kind === 'gignore') && x.better);
      if (!l) return 0;
      const stones = Object.entries(l.marks || {}).filter(([k, v]) => (v === 'hint' || v === 'ng') && b.s[k] !== '.').map(([k]) => +k);
      if (!stones.length) return 0;
      const t = stones[0];
      const step = {
        type: 'gmove', board: NS_GO.rowsOf(n, b.s), turn: me, coords: true,
        goal: l.kind === 'gmisscap' ? 'take' : 'escape', target: [(t % n) + 1, ((t / n) | 0) + 1],
        prompt: l.kind === 'gmisscap' ? '実戦のこの局面には<strong>取れる石</strong>がありました。取ってください。'
          : '実戦ではここで、アタリの石をそのままにしました。<strong>石を助ける手</strong>を打ってください。',
        why: `${l.what}。${l.why}`, hint: l.lesson || '',
      };
      if (!store.pendingMistakes('go').some((m) => (m.step.board || []).join('') === b.s)) {
        try { store.addMistake('go', l.kind, step, `${today()}の実戦の棋譜`); } catch { /* 保存できなくても振り返りは続ける */ }
      }
    }
    return store.pendingMistakes(game).length - before;
  }

  /** 画面：棋譜を貼り付ける → どちらを指したか選ぶ → コーチが講評 → 悪手を復習問題に */
  function reviewImport(host, game) {
    const { Board, renderHand } = NS_BOARD;
    const { GoBoard } = NS_GOBOARD;
    const stage = el('div', 'stage imp');
    host.appendChild(stage);
    stage.appendChild(el('h2', 'imp__title', '実戦の棋譜を振り返る'));
    const fmt = IMPORT_FMT[game];
    stage.appendChild(el('p', 'imp__lead', `${game === 'chess' ? 'chess.com や Lichess' : game === 'shogi' ? '将棋ウォーズや将棋倶楽部24' : '囲碁の対局サイト'}で打った対局の棋譜（<strong>${fmt}</strong>）を貼り付けると、あなたの手をコーチが1手ずつ講評します。`));
    const ta = el('textarea', 'imp__text');
    ta.setAttribute('aria-label', `棋譜（${fmt}）`);
    ta.placeholder = game === 'chess' ? '[Event "..."]\n1. e4 e5 2. Nf3 Nc6 ...' : game === 'shogi' ? '手合割：平手\n   1 ７六歩(77)\n   2 ３四歩(33)\n ...' : '(;GM[1]SZ[19];B[pd];W[dp] ...)';
    stage.appendChild(ta);
    const row1 = el('div', 'actions');
    const fileLab = el('label', 'btn btn--ghost', 'ファイルを選ぶ');
    const file = el('input');
    file.type = 'file'; file.accept = game === 'chess' ? '.pgn,.txt' : game === 'shogi' ? '.kif,.kifu,.ki2,.ki2u,.csa,.txt' : '.sgf,.txt';
    file.hidden = true;
    fileLab.appendChild(file);
    const goBtn = el('button', 'btn btn--tone', '読み込む');
    row1.append(goBtn, fileLab);
    stage.appendChild(row1);
    const status = el('p', 'note imp__status');
    status.setAttribute('role', 'status');
    stage.appendChild(status);
    const sideBox = el('div', 'actions imp__sides');
    stage.appendChild(sideBox);
    const boardHost = el('div', 'imp__board');
    const handsHost = el('div', 'imp__hands');
    const result = el('div', 'imp__result');
    stage.append(boardHost, handsHost, result);

    let parsed = null, token = 0;
    file.addEventListener('change', async () => {
      const f = file.files?.[0];
      if (!f) return;
      try {
        const buf = await f.arrayBuffer();
        let txt = new TextDecoder('utf-8').decode(buf);
        // 将棋の KIF は Shift_JIS のことが多い
        if (/\uFFFD/.test(txt)) { try { txt = new TextDecoder('shift_jis').decode(buf); } catch { /* そのまま */ } }
        ta.value = txt;
        status.textContent = `${f.name} を読み込みました。「読み込む」を押してください。`;
      } catch { status.textContent = 'ファイルを読めませんでした。中身をコピーして、貼り付けてください。'; }
    });
    goBtn.addEventListener('click', () => {
      token++;
      result.innerHTML = ''; boardHost.innerHTML = ''; handsHost.innerHTML = ''; sideBox.innerHTML = '';
      const r = game === 'chess' ? readChess(ta.value) : game === 'shogi' ? readShogi(ta.value) : readGo(ta.value);
      if (r.error) { parsed = null; status.innerHTML = `<b>読めませんでした</b>${r.error}`; return; }
      parsed = r;
      status.textContent = `${r.plies.length}手を読み込みました。あなたが指したのはどちらですか。`;
      for (const [side, label] of r.sides) {
        const b = el('button', 'btn btn--ghost', `${escH(label)}として振り返る`);
        b.addEventListener('click', () => run(side));
        sideBox.appendChild(b);
      }
    });

    let board = null;
    const showPos = (p, marks = {}, extra = null) => {
      if (game === 'go') {
        if (!board) board = new GoBoard(boardHost, { n: parsed.n, coords: true });
        board.setPosition(p ? p.before.s : parsed.plies[parsed.plies.length - 1].after.s, marks, { turn: p ? p.side : 'X' });
        if (extra?.length) board.flash(extra);
        return;
      }
      if (!board) {
        board = game === 'chess'
          ? new Board(boardHost, { variant: 'chess', w: 8, h: 8, coords: true, flipped: parsed.me === 'b' })
          : new Board(boardHost, { variant: 'shogi', w: 9, h: 9, coords: true, flipped: parsed.me === 'w' });
      }
      const last = parsed.plies[parsed.plies.length - 1];
      const at = p ? p.before : last.after;
      if (game === 'chess') board.setPosition(at, marks);
      else {
        board.setPosition(at.board, marks);
        handsHost.innerHTML = '';
        const ORDER = ['R', 'B', 'G', 'S', 'N', 'L', 'P'];
        for (const [c, lab] of [['w', '後手の持ち駒'], ['b', '先手の持ち駒']]) {
          const d = el('div');
          renderHand(d, at.hands[c], { label: lab, order: ORDER });
          handsHost.appendChild(d);
        }
      }
      if (extra?.length) board.flash(extra);
    };

    async function run(me) {
      const my = ++token;
      parsed.me = me;
      board = null; boardHost.innerHTML = ''; result.innerHTML = ''; sideBox.innerHTML = '';
      const mine = parsed.plies.filter((p) => p.side === me);
      showPos(null);
      for (let k = 0; k < mine.length; k++) {
        if (my !== token || !stage.isConnected) return;
        status.textContent = `コーチが講評しています… ${k + 1} / ${mine.length}手`;
        try { mine[k].res = await reviewPly(game, mine[k]); } catch { mine[k].res = { rv: { level: 'ok', lines: [] } }; }
        if (game === 'go' && k % 8 === 7) await new Promise((r) => setTimeout(r, 0));   // 画面を止めない
      }
      if (my !== token || !stage.isConnected) return;
      const bad = mine.filter((p) => isBad(p.res?.rv));
      status.textContent = '講評が終わりました。';
      // まとめ
      const kinds = {};
      for (const p of bad) for (const k of new Set(p.res.rv.lines.map((l) => l.kind))) if (K.KIND_JA[k]) kinds[k] = (kinds[k] || 0) + 1;
      const big = bad.filter((p) => p.res.rv.level === 'blunder').length;
      const top = Object.entries(kinds).sort((a, b) => b[1] - a[1])[0];
      const linkId = top ? K.lessonFor(game, top[0]) : null;
      const linkTitle = linkId ? (() => {
        const g = { chess: NS_DCHESS.chess, shogi: NS_DSHOGI.shogi, go: NS_DGO.go }[game];
        for (const c of g?.chapters || []) for (const l of c.lessons) if (l.id === linkId) return l.title;
        return null;
      })() : null;
      const link = linkId && linkTitle ? { id: linkId, title: linkTitle } : null;
      const sum = el('div', 'gsum');
      sum.innerHTML = `<h3>この対局のまとめ</h3><p>あなたの手 ${mine.length}手のうち、コーチが指摘したのは ${bad.length}手でした${bad.length ? `（大きな悪手 ${big}・悪手 ${bad.length - big}）` : ''}。</p>`
        + (bad.length ? `<p>${Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<span class="gsum__k">${K.KIND_JA[k]} ×${n}</span>`).join('')}</p>` : '<p>大きな見落としは見つかりませんでした。</p>')
        + (link ? `<p>おすすめの練習：<a href="#/${game}/${link.id}">${escH(link.title)}</a></p>` : '');
      result.appendChild(sum);
      if (!bad.length) return;
      // 悪手の一覧（押すと、その局面を盤に出す）
      const list = el('div', 'imp__list');
      bad.forEach((p, idx) => {
        const l = p.res.rv.lines.find((x) => !['good', 'goal', 'tip'].includes(x.kind)) || p.res.rv.lines[0];
        const item = el('button', 'imp__item');
        item.type = 'button';
        item.innerHTML = `<span class="imp__no">${escH(p.label)}</span><span class="imp__lv" data-lv="${p.res.rv.level}">${p.res.rv.level === 'blunder' ? '大きな悪手' : '悪手'}</span>`
          + `<span class="imp__what">${l.what}</span>`
          + `<span class="imp__why">${l.why || ''}${l.better?.label ? `<br>こうすれば：${l.better.label}${l.better.reason ? ` — ${l.better.reason}` : ''}` : ''}</span>`;
        item.addEventListener('click', () => {
          list.querySelectorAll('.imp__item').forEach((x) => x.removeAttribute('aria-current'));
          item.setAttribute('aria-current', 'true');
          const t = K.talk(game, p.res.rv) || { arrows: [] };
          const marks = { ...(l.marks || {}) };
          if (game === 'go') {
            const pts = [];
            if (l.better?.to != null) pts.push({ i: l.better.to, c: 'ok' });
            if (p.i >= 0) pts.push({ i: p.i, c: 'ng' });
            showPos(p, marks, pts);
          } else {
            showPos(p, { ...marks, ...(p.mv.from ? { [p.mv.from]: 'last' } : {}), [p.mv.to]: 'last' }, [...(t.arrows || []), { from: p.mv.from || null, to: p.mv.to, c: 'tone' }]);
          }
          boardHost.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        list.appendChild(item);
        if (idx === 0) setTimeout(() => item.click(), 0);
      });
      result.appendChild(list);
      // 復習問題にする
      const save = el('div', 'actions');
      const sb = el('button', 'btn btn--tone', `指摘された手を、復習問題に入れる（${bad.length}手）`);
      sb.addEventListener('click', async () => {
        sb.disabled = true;
        sb.textContent = '問題にしています…';
        let made = 0;
        for (const p of bad) { try { made += (await saveImported(game, p, me)) || 0; } catch { /* 作れない形は飛ばす */ } }
        if (!stage.isConnected) return;
        sb.textContent = `指摘された手を、復習問題に入れる（${bad.length}手）`;
        const note = el('p', 'note');
        note.innerHTML = made
          ? `${made}問を「自分の悪手から」に入れました。${game === 'shogi' && me !== 'b' ? '後手で指した局面は、盤を回して先手の向きにしています。' : ''}<a href="#/${game}/_mine">いま解いてみる</a>`
          : '問題にできる形の手は、ありませんでした（同じ局面がすでに入っている場合も含みます）。';
        save.after(note);
      });
      save.appendChild(sb);
      result.appendChild(save);
    }
  }

  // ───────────────────────────────────────────────
  // 麻雀の牌譜を振り返る：天鳳の mjlog（XML）と、tenhou.net/6 形式（JSON）を読み込み、
  // 選んだ人の打牌を、4人打ちの対局と同じコーチで1打ずつ講評する
  // ───────────────────────────────────────────────
  const MJ_SEAT_TILE = ['z1', 'z2', 'z3', 'z4'];
  const MJ_WIND_JA = '東南西北';
  const mjKyokuJa = (k, honba) => `${MJ_WIND_JA[Math.floor(k / 4) % 4]}${(k % 4) + 1}局${honba ? ` ${honba}本場` : ''}`;
  const mjEsc = (x) => String(x ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  class MjLogError extends Error {}

  /** 天鳳の牌番号（0〜135）→ このアプリの牌（m1〜z7、赤5は m0/p0/s0） */
  function tenhouTile(id, aka) {
    const k = id >> 2;
    if (!(id >= 0 && id < 136)) return null;
    if (aka && (id === 16 || id === 52 || id === 88)) return `${'mps'[(k / 9) | 0]}0`;
    return k < 27 ? `${'mps'[(k / 9) | 0]}${(k % 9) + 1}` : `z${k - 26}`;
  }
  /** tenhou.net/6 の牌番号（11〜47、赤5は51〜53）→ このアプリの牌 */
  function tenhou6Tile(code) {
    const c = Number(code);
    if (c >= 51 && c <= 53) return `${'mps'[c - 51]}0`;
    const s = (c / 10) | 0, n = c % 10;
    if (s >= 1 && s <= 3 && n >= 1 && n <= 9) return `${'mps'[s - 1]}${n}`;
    if (s === 4 && n >= 1 && n <= 7) return `z${n}`;
    return null;
  }

  /**
   * 天鳳 mjlog の鳴き（N タグの m）を読む。tenhou.net の tehai.js と同じ分け方。
   * from は鳴かれた人の席。hand は鳴いた人の手から出た牌
   */
  function decodeTenhouMeld(m, who, aka) {
    const T = (id) => tenhouTile(id, aka);
    const from = (who + (m & 3)) % 4;
    if (m & 0x4) {   // チー
      const t = [(m >> 3) & 3, (m >> 5) & 3, (m >> 7) & 3];
      const bc = m >> 10, r = bc % 3;
      let base = (bc / 3) | 0;
      base = ((base / 7) | 0) * 9 + (base % 7);
      const ids = [t[0] + 4 * base, t[1] + 4 * (base + 1), t[2] + 4 * (base + 2)];
      return { t: 'chi', from, called: T(ids[r]), hand: ids.filter((_, i) => i !== r).map(T), tiles: ids.map(T) };
    }
    if (m & 0x18) {  // ポン・加槓
      const t4 = (m >> 5) & 3, bc = m >> 9, r = bc % 3, base = (bc / 3) | 0;
      const ids = [[1, 2, 3], [0, 2, 3], [0, 1, 3], [0, 1, 2]][t4].map((i) => i + 4 * base);
      if (m & 0x8) return { t: 'pon', from, called: T(ids[r]), hand: ids.filter((_, i) => i !== r).map(T), tiles: ids.map(T) };
      return { t: 'kakan', added: T(t4 + 4 * base), tiles: [...ids, t4 + 4 * base].map(T) };
    }
    if (m & 0x20) return { t: 'nuki' };
    const hai0 = (m >> 8) & 0xff, base = (hai0 / 4) | 0;
    const ids = [0, 1, 2, 3].map((i) => 4 * base + i);
    if (!(m & 3)) return { t: 'ankan', tiles: ids.map(T) };
    return { t: 'minkan', from, called: T(hai0), hand: ids.filter((x) => x !== hai0).map(T), tiles: ids.map(T) };
  }

  const RYUU_JA = { '': '流局', yao9: '九種九牌', reach4: '四家立直', ron3: '三家和了', kan4: '四槓散了', kaze4: '四風連打', nm: '流し満貫' };
  const LIMIT_JA = ['', '満貫', '跳満', '倍満', '三倍満', '役満'];

  /** 天鳳の mjlog（XML）を読む */
  function readMjlog(text) {
    let doc;
    try { doc = new DOMParser().parseFromString(text, 'application/xml'); } catch { doc = null; }
    if (!doc || doc.getElementsByTagName('parsererror').length || !doc.documentElement) {
      return { error: 'XML として読めませんでした。牌譜の中身を、最初から最後まで全部貼り付けてください。' };
    }
    const root = doc.documentElement;
    const go = root.getElementsByTagName('GO')[0];
    const type = Number(go?.getAttribute('type') || 0);
    if (type & 0x10) return { error: '三人麻雀の牌譜には、まだ対応していません。' };
    const aka = !(type & 0x02);
    const kuitan = !(type & 0x04);   // 喰いタン（鳴いたタンヤオ）を認める卓か
    const east = !(type & 0x08);     // 東風戦か（東南戦なら false）
    const T = (id) => tenhouTile(Number(id), aka);
    let names = ['', '', '', ''];
    const rounds = [];
    let cur = null, final = null;
    const pending = [false, false, false, false];
    // sc：「その時の点数, 点数の動き」の組（100点単位）が4人ぶん。owari：「最終の点数, 順位点」の組
    const scDelta = (node) => {
      const sc = (node.getAttribute('sc') || '').split(',').map(Number);
      return sc.length >= 8 && sc.every(Number.isFinite) ? [0, 1, 2, 3].map((k) => sc[2 * k + 1] * 100) : null;
    };
    const readOwari = (node) => {
      const ow = (node.getAttribute('owari') || '').split(',').map(Number);
      if (ow.length >= 8 && ow.every(Number.isFinite)) final = [0, 1, 2, 3].map((k) => Math.round(ow[2 * k] * 100));
    };
    for (const node of root.children) {
      const tag = node.tagName;
      const A = (k) => node.getAttribute(k);
      if (tag === 'UN' && A('dan') != null) {
        names = [0, 1, 2, 3].map((i) => { try { return decodeURIComponent(A(`n${i}`) || ''); } catch { return A(`n${i}`) || ''; } });
        if (!names[3]) return { error: '三人麻雀の牌譜には、まだ対応していません。' };
      } else if (tag === 'INIT') {
        const seed = (A('seed') || '').split(',').map(Number);
        const haipai = [0, 1, 2, 3].map((i) => (A(`hai${i}`) || '').split(',').filter((x) => x !== '').map(T));
        if (haipai.some((h) => h.length !== 13 || h.includes(null))) return { error: '配牌が読めませんでした（三人麻雀か、壊れた牌譜かもしれません）。' };
        cur = {
          kyoku: seed[0] || 0, honba: seed[1] || 0, sticks: seed[2] || 0, oya: Number(A('oya')) || 0,
          scores: (A('ten') || '250,250,250,250').split(',').map((x) => Number(x) * 100),
          doraInds: [T(seed[5])], haipai, events: [], results: [],
        };
        pending.fill(false);
        rounds.push(cur);
      } else if (!cur) {
        continue;
      } else if (/^[TUVW]\d+$/.test(tag)) {
        cur.events.push({ t: 'draw', p: 'TUVW'.indexOf(tag[0]), tile: T(tag.slice(1)), id: Number(tag.slice(1)) });
      } else if (/^[DEFG]\d+$/.test(tag)) {
        const p = 'DEFG'.indexOf(tag[0]), id = Number(tag.slice(1));
        const prev = cur.events[cur.events.length - 1];
        cur.events.push({ t: 'discard', p, tile: T(id), riichi: pending[p], tsumogiri: !!prev && prev.t === 'draw' && prev.p === p && prev.id === id });
        pending[p] = false;
      } else if (tag === 'N') {
        const who = Number(A('who'));
        const mm = decodeTenhouMeld(Number(A('m')), who, aka);
        if (mm.t === 'nuki') return { error: '三人麻雀の牌譜には、まだ対応していません。' };
        cur.events.push({ ...mm, p: who });
      } else if (tag === 'REACH') {
        if (A('step') === '1') pending[Number(A('who'))] = true;
      } else if (tag === 'DORA') {
        cur.events.push({ t: 'dora', tile: T(A('hai')) });
      } else if (tag === 'AGARI') {
        const ten = (A('ten') || '0,0,0').split(',').map(Number);
        const yaku = (A('yaku') || '').split(',').filter(Boolean).map(Number);
        const han = yaku.filter((_, i) => i % 2 === 1).reduce((a, b) => a + b, 0);
        const ura = yaku.reduce((a, v, i) => (i % 2 === 0 && v === 53 ? a + (yaku[i + 1] || 0) : a), 0);   // 53 は裏ドラ
        const yakuman = (A('yakuman') || '').split(',').filter(Boolean).length;
        const text = ten[2] ? `${LIMIT_JA[ten[2]] || ''} ${ten[1]}点` : `${han}翻${ten[0]}符 ${ten[1]}点`;
        cur.results.push({ kind: 'agari', who: Number(A('who')), from: Number(A('fromWho')), text, delta: scDelta(node), han: yakuman ? 13 * yakuman : han, fu: ten[0] || 30, ura });
        readOwari(node);
      } else if (tag === 'RYUUKYOKU') {
        cur.results.push({ kind: 'draw', text: RYUU_JA[A('type') || ''] || '流局', delta: scDelta(node) });
        readOwari(node);
      }
    }
    if (!rounds.length) return { error: '局が見つかりませんでした。天鳳の牌譜（mjlog）か、tenhou.net/6 形式の JSON を貼り付けてください。' };
    return { names: names.map((n, i) => n || `${MJ_WIND_JA[i]}家スタートの人`), rounds, aka, kuitan, east, final };
  }

  /** tenhou.net/6 の鳴きの文字列（c・p・m・a・k）を読む */
  function parseTenhou6Call(str, who) {
    const s = String(str);
    const at = s.search(/[cpmak]/);
    if (at < 0) return null;
    const L = s[at];
    const nums = (x) => (x.match(/\d\d/g) || []).map(tenhou6Tile);
    if (L === 'c') {
      const ts = nums(s.slice(at + 1));
      return { t: 'chi', from: (who + 3) % 4, called: ts[0], hand: ts.slice(1), tiles: ts };
    }
    if (L === 'p' || L === 'm') {
      // 文字の位置で、誰から鳴いたかが分かる（左から 上家・対面・下家）
      const rel = L === 'p' ? { 0: 3, 2: 2, 4: 1 }[at] : { 0: 3, 2: 2, 6: 1 }[at];
      if (rel == null) return null;
      const called = tenhou6Tile(s.slice(at + 1, at + 3));
      const hand = nums(s.slice(0, at) + s.slice(at + 3));
      return { t: L === 'p' ? 'pon' : 'minkan', from: (who + rel) % 4, called, hand, tiles: [called, ...hand] };
    }
    if (L === 'a') return { t: 'ankan', tiles: nums(s.replace('a', '')) };
    // 加槓：k のすぐ後ろが、加えた牌
    const added = tenhou6Tile(s.slice(at + 1, at + 3));
    return { t: 'kakan', added, tiles: [added, ...nums(s.slice(0, at) + s.slice(at + 3))] };
  }

  /**
   * tenhou.net/6 の1局ぶんを、席ごとの「ツモ」「打牌」の列から、起きた順の出来事に並べ直す。
   * 打牌のたびに、ほかの人の次のツモ欄が「その牌への鳴き」かを見て、次に動く人を決める。
   * 同じ人が同じ牌を続けて切ったとき、どちらが鳴かれたのかは形式からは分からないので、
   * 「先の方を鳴いた」として進め、手牌が合わなくなったら、もう一方を試す（後戻り）
   */
  function replayTenhou6Round(r, label) {
    const [[kyoku, honba, sticks], scores, dora] = r;
    const hai = [r[4], r[7], r[10], r[13]], take = [r[5], r[8], r[11], r[14]], dah = [r[6], r[9], r[12], r[15]];
    if (hai.some((h) => !Array.isArray(h) || h.length !== 13) || take.some((x) => !Array.isArray(x)) || dah.some((x) => !Array.isArray(x))) {
      throw new MjLogError(`${label}：配牌が読めませんでした（三人麻雀には、まだ対応していません）。`);
    }
    const oya = kyoku % 4;
    // 各席の打牌を、ツモ切り（60）も実際の牌に直して並べておく（ツモ欄と打牌欄は1つずつ対応している）
    const resolved = [0, 1, 2, 3].map((q) => dah[q].map((d, i) => {
      let x = d;
      if (typeof x === 'string' && x[0] === 'r') x = Number(x.slice(1));
      if (x === 60) return typeof take[q][i] === 'number' ? tenhou6Tile(take[q][i]) : null;
      return typeof x === 'number' && x > 0 ? tenhou6Tile(x) : null;
    }));
    const same = (a, b) => a && b && MJ.norm(a) === MJ.norm(b);
    const bad = (why) => { throw new MjLogError(`${label}：${why}`); };

    const simulate = (decide) => {
      const events = [];
      const hands = hai.map((h) => h.map(tenhou6Tile));
      const pons = [[], [], [], []];
      const ti = [0, 0, 0, 0], di = [0, 0, 0, 0];
      const kanDora = (dora || []).slice(1).map(tenhou6Tile);
      let p = oya, mode = 'draw', lastDraw = null, guard = 0, doraAfterDiscard = 0;
      const revealDora = () => { if (kanDora.length) events.push({ t: 'dora', tile: kanDora.shift() }); };
      const takeOut = (q, t) => { if (!t || !mjTake(hands[q], t)) bad('手牌と合わない手順があります。'); };
      while (guard++ < 800) {
        if (mode === 'draw') {
          if (ti[p] >= take[p].length) break;            // 流局、または前の打牌でロン
          const tk = take[p][ti[p]];
          if (typeof tk !== 'number') bad(`手順が読めませんでした（${mjEsc(tk)}）。`);
          ti[p]++;
          lastDraw = tenhou6Tile(tk);
          if (!lastDraw) bad(`ツモが読めませんでした（${mjEsc(tk)}）。`);
          hands[p].push(lastDraw);
          events.push({ t: 'draw', p, tile: lastDraw });
          mode = 'discard';
        }
        if (di[p] >= dah[p].length) break;                // ツモあがり・九種九牌など
        let dh = dah[p][di[p]++];
        if (dh === 0) { mode = 'draw'; continue; }         // 大明槓のあとの空欄：嶺上牌を引く
        if (typeof dh === 'string' && /[ak]/.test(dh)) {   // 暗槓・加槓のあとも嶺上牌を引く
          const c = parseTenhou6Call(dh, p);
          if (!c) bad(`カンが読めませんでした（${mjEsc(dh)}）。`);
          if (c.t === 'ankan') {
            if (c.tiles.length !== 4) bad(`カンが読めませんでした（${mjEsc(dh)}）。`);
            c.tiles.forEach((t) => takeOut(p, t));
          } else {
            takeOut(p, c.added);
            const k = pons[p].findIndex((t) => same(t, c.added));
            if (k < 0) bad('ポンしていない牌の加槓があります。');
            pons[p].splice(k, 1);
          }
          events.push({ ...c, p });
          if (c.t === 'ankan') revealDora(); else doraAfterDiscard++;
          mode = 'draw';
          continue;
        }
        let riichi = false;
        if (typeof dh === 'string' && dh[0] === 'r') { riichi = true; dh = Number(dh.slice(1)); }
        const tsumogiri = dh === 60;
        const tile = tsumogiri ? lastDraw : tenhou6Tile(dh);
        if (!tile) bad(`打牌が読めませんでした（${mjEsc(dah[p][di[p] - 1])}）。`);
        takeOut(p, tile);
        events.push({ t: 'discard', p, tile, riichi, tsumogiri });
        for (; doraAfterDiscard > 0; doraAfterDiscard--) revealDora();   // 明槓・加槓のドラは、次の打牌のあとにめくる
        lastDraw = null;
        // 次に動く人：ポン・カン（だれでも）→ チー（下家だけ）→ 下家のツモ
        let next = null, call = null;
        for (const k of [1, 2, 3]) {
          const q = (p + k) % 4, nx = take[q][ti[q]];
          if (typeof nx === 'string' && /[pm]/.test(nx)) {
            const c = parseTenhou6Call(nx, q);
            if (c && c.from === p && same(c.called, tile)) { next = q; call = c; break; }
          }
        }
        // 同じ人が、このあとも同じ牌を切るなら、どちらを鳴いたのかは決められない（先の方から試す）
        if (call && resolved[p].slice(di[p]).some((t) => same(t, tile)) && !decide()) { next = null; call = null; }
        if (next === null) {
          const q = (p + 1) % 4, nx = take[q][ti[q]];
          if (typeof nx === 'string' && nx.includes('c')) {
            const c = parseTenhou6Call(nx, q);
            if (c && same(c.called, tile)) { next = q; call = c; }
          }
        }
        if (call) {
          ti[next]++;
          call.hand.forEach((t) => takeOut(next, t));
          if (call.t === 'pon') pons[next].push(call.called);
          events.push({ ...call, p: next });
          if (call.t === 'minkan') doraAfterDiscard++;
          p = next;
          mode = 'discard';
          continue;
        }
        p = (p + 1) % 4;
        mode = 'draw';
      }
      // 正しく並べられたなら、全員のツモ欄と打牌欄をちょうど使い切る
      for (let q = 0; q < 4; q++) if (ti[q] !== take[q].length || di[q] !== dah[q].length) bad('手順の数が合いませんでした。');
      return events;
    };

    const choices = [];
    let firstErr = null, events = null;
    for (let attempt = 0; attempt < 300 && !events; attempt++) {
      let at = 0;
      try {
        events = simulate(() => { if (at >= choices.length) choices.push(true); return choices[at++]; });
      } catch (e) {
        if (!(e instanceof MjLogError)) throw e;
        firstErr = firstErr || e;
        // いちばん最近の「先の方を鳴いた」を「後の方」に変えて、やり直す
        choices.length = at;
        let j = at - 1;
        while (j >= 0 && !choices[j]) j--;
        if (j < 0) break;
        choices[j] = false;
        choices.length = j + 1;
      }
    }
    if (!events) throw firstErr || new MjLogError(`${label}：手順が読めませんでした。`);
    // 結果
    const res = r[16] || [];
    const results = [];
    if (res[0] === '和了') {
      for (let k = 2; k < res.length; k += 2) {
        const info = res[k] || [];
        const d = res[k - 1];
        const delta = Array.isArray(d) && d.length >= 4 && d.slice(0, 4).every((x) => Number.isFinite(Number(x))) ? d.slice(0, 4).map(Number) : null;
        // 役の一覧（「立直(1飜)」「裏ドラ(1飜)」「国士無双(役満)」など）から、翻数と裏ドラの数を数える
        const yk = info.slice(4).map(String);
        const hanOf = (y) => (/役満/.test(y) ? 13 : Number((y.match(/\((\d+)飜\)/) || [])[1] || 0));
        const han = yk.reduce((a, y) => a + hanOf(y), 0);
        const ura = yk.filter((y) => /^裏ドラ/.test(y)).reduce((a, y) => a + hanOf(y), 0);
        const fu = Number((String(info[3] || '').match(/(\d+)符/) || [])[1] || 30);
        results.push({ kind: 'agari', who: Number(info[0]), from: Number(info[1]), text: String(info[3] || '').replace(/飜/g, '翻'), delta, han: han || null, fu, ura });
      }
    } else if (res[0]) {
      const d = res[1];
      const delta = Array.isArray(d) && d.length >= 4 && d.slice(0, 4).every((x) => Number.isFinite(Number(x))) ? d.slice(0, 4).map(Number) : null;
      results.push({ kind: 'draw', text: String(res[0]), delta });
    }
    return {
      kyoku, honba, sticks, oya, scores: [...scores],
      doraInds: [tenhou6Tile((dora || [])[0])], haipai: hai.map((h) => h.map(tenhou6Tile)), events, results,
    };
  }

  /** tenhou.net/6 形式（JSON）を読む */
  function readTenhou6(text) {
    let obj;
    try { obj = JSON.parse(text); } catch { return { error: 'JSON として読めませんでした。中身を、最初から最後まで全部貼り付けてください。' }; }
    if (!obj || !Array.isArray(obj.log) || !obj.log.length) return { error: 'tenhou.net/6 形式の牌譜（"log" のある JSON）ではないようです。' };
    // 三人麻雀は、4人目の配牌が空になる（名前が空なだけの牌譜もあるので、名前では決めない）
    if (obj.ratingc === 'PF3' || obj.log.some((r) => Array.isArray(r) && Array.isArray(r[13]) && !r[13].length)) return { error: '三人麻雀の牌譜には、まだ対応していません。' };
    const rounds = [];
    for (const r of obj.log) {
      const label = Array.isArray(r?.[0]) ? mjKyokuJa(r[0][0], r[0][1]) : '局';
      try { rounds.push(replayTenhou6Round(r, label)); } catch (e) {
        return { error: e instanceof MjLogError ? e.message : `${label}が読めませんでした。` };
      }
    }
    const names = (Array.isArray(obj.name) ? obj.name : []).slice(0, 4);
    // 卓の決まり（天鳳の表示「般南喰赤」など）：「喰」がなければ喰いタンなし、「東」なら東風戦、「南」なら東南戦。
    // 天鳳の表示だと分かるものだけを使う（ほかの形式から変換した牌譜では、分からないものとして扱う）
    const disp = String(obj.rule?.disp || '');
    const tenhouDisp = /^(般|上|特|鳳|技|若|銀|琥|孔)/.test(disp);
    const kuitan = !(tenhouDisp && !disp.includes('喰'));
    const east = disp.includes('東') ? true : disp.includes('南') ? false : undefined;
    // sc：「最終の点数, 順位点」の組（天鳳の牌譜には入っている）
    const sc = Array.isArray(obj.sc) ? obj.sc.map(Number) : [];
    const final = sc.length >= 8 && sc.every(Number.isFinite) ? [0, 1, 2, 3].map((k) => sc[2 * k]) : null;
    return { names: [0, 1, 2, 3].map((i) => String(names[i] || '') || `${MJ_WIND_JA[i]}家スタートの人`), rounds, aka: true, kuitan, east, final };
  }

  /** 貼り付けた文字やファイルの中身を、形式を見分けて読む */
  function readMahjongLog(text) {
    const s = String(text || '').replace(/^\uFEFF/, '').trim();
    if (!s) return { error: '牌譜が空です。' };
    // ブラウザで開いた牌譜を全部コピーすると、先頭に説明の文が付くことがあるので、本体から読む
    const x = s.indexOf('<mjloggm');
    if (x >= 0) return readMjlog(s.slice(x));
    if (s[0] === '<') return readMjlog(s);
    const j = s.indexOf('{');
    if (j >= 0 && /"log"\s*:/.test(s)) return readTenhou6(s.slice(j, s.lastIndexOf('}') + 1));
    return { error: '形式が分かりませんでした。天鳳の牌譜（mjlog・XML）か、tenhou.net/6 形式の JSON を貼り付けてください。' };
  }

  /** 天鳳の牌譜を見るURL（…/0/?log=〜&tw=〜）から、牌譜の中身のURLと、自分の席を取り出す */
  function tenhouUrlInfo(text) {
    const m = String(text || '').match(/tenhou\.net\/\d\/\?log=([0-9A-Za-z-]+)/);
    if (!m) return null;
    const tw = String(text).match(/[?&]tw=(\d)/);
    return { id: m[1], data: `https://tenhou.net/0/log/?${m[1]}`, tw: tw ? Number(tw[1]) : null };
  }

  /** 配列から牌を1枚抜く（同じ牌、なければ赤5と5を同じとみなす） */
  function mjTake(arr, t) {
    let i = arr.indexOf(t);
    if (i < 0) i = arr.findIndex((x) => MJ.norm(x) === MJ.norm(t));
    if (i < 0) return false;
    arr.splice(i, 1);
    return true;
  }
  const mjWorse = (a, b) => (a === 'blunder' || b === 'blunder' ? 'blunder' : a === 'miss' || b === 'miss' ? 'miss' : 'ok');

  const MJ_CALL_JA = { chi: 'チー', pon: 'ポン', minkan: 'カン' };
  const MJ_REL_JA = { 1: '下家', 2: '対面', 3: '上家' };
  const mjWhen = (n) => (n ? `${n}打目のあと` : '最初の打牌の前');

  /**
   * 牌譜を1局ずつ再生して、me（席番号）の打牌・鳴き・アガリの見逃しを講評する。
   * 返り値 { decisions（打牌）, calls（鳴き）, wins（アガリの見逃し）, rounds: [{ label, results, items }], dealins }
   */
  async function reviewMahjongGame(g, me, onProgress = null) {
    const { reviewTurn, riichiPlayers, safestDiscard, yakuPaths, nakiReason, lateYakuhai, placeAfterWin } = NS_MJAI;
    const { Game, kuikaeBan } = NS_MJ4;
    const total = g.rounds.reduce((a, rd) => a + rd.events.filter((e) => e.t === 'discard' && e.p === me).length, 0);
    let done = 0, lastYield = Date.now();
    const out = { decisions: [], calls: [], wins: [], rounds: [], dealins: 0, dealinPush: 0, total, allLast: [], final: null };
    let lastEnd = null;   // 最後の局が終わったときの点数（牌譜に最終の点数がないときに使う）
    // オーラス：東南戦なら南4局から、東風戦なら東4局から（30000点に届く人がいないときの延長戦も含む）。
    // 決まりが分からない牌譜は、南場の局があれば東南戦とみなす
    const lastFrom = g.east === true ? 3 : g.east === false ? 7 : (g.rounds.some((r) => r.kyoku >= 4) ? 7 : 3);
    const first = (g.rounds[0].oya - (g.rounds[0].kyoku % 4) + 4) % 4;   // 起家（同点なら起家に近い方が上）
    for (const rd of g.rounds) {
      const label = mjKyokuJa(rd.kyoku, rd.honba);
      const seatWind = MJ_SEAT_TILE[(me - rd.oya + 4) % 4];
      const roundWind = MJ_SEAT_TILE[Math.floor(rd.kyoku / 4) % 4];
      const seatJa = MJ_WIND_JA[(me - rd.oya + 4) % 4];
      const allLast = rd.kyoku >= lastFrom;
      // オーラスの局は、まとめの「オーラスの判断」に出す（開始時の点数と着順）
      const alRound = allLast ? { label, scores: [...rd.scores], rank: mjRank(rd.scores, me, first), entries: [] } : null;
      if (alRound) out.allLast.push(alRound);
      const st = {
        hands: rd.haipai.map((h) => [...h]), melds: [[], [], [], []], discards: [[], [], [], []],
        riichi: [false, false, false, false], log: [], doraInds: [...rd.doraInds].filter(Boolean),
        drawsLeft: 70, ban: [null, null, null, null], scores: [...rd.scores], n: 0,
        furiTemp: false, furiRiichi: false,   // 自分の見逃し（同巡内・リーチ後）
      };
      const roundOut = { label, oya: rd.oya, kyoku: rd.kyoku, results: rd.results, items: [] };
      const roundDecs = [], extra = [];
      let lastMine = null, afterTsumoMiss = false;
      const fail = (i) => { throw new MjLogError(`${label}の途中（${i + 1}番目の出来事）で、牌譜の手順が合わなくなりました。`); };
      // 局の最後の出来事（新しいドラをめくっただけの出来事は数えない）
      const acts = rd.events.map((e, k) => (e.t === 'dora' ? -1 : k)).filter((k) => k >= 0);
      const lastAct = acts.length ? acts[acts.length - 1] : -1;
      const nextAct = (i) => acts.find((k) => k > i);
      const prevAct = (i) => { for (let k = acts.length - 1; k >= 0; k--) if (acts[k] < i) return acts[k]; return -1; };
      const endedWith = (i, who, from) => i === lastAct && rd.results.some((r) => r.kind === 'agari' && r.who === who && r.from === from);
      // 手の外に見えている牌（捨て牌は鳴かれていないものだけ・鳴いた組・ドラ表示牌）
      const seenNow = () => {
        const s = new Array(34).fill(0);
        for (const ds of st.discards) for (const d of ds) if (!d.called) s[MJ.toIndex(MJ.norm(d.tile))]++;
        for (const ms of st.melds) for (const m of ms) for (const t of m.tiles) s[MJ.toIndex(MJ.norm(t))]++;
        for (const t of st.doraInds) s[MJ.toIndex(MJ.norm(t))]++;
        return s;
      };
      const ctx = { label, seatJa, seatWind, roundWind, allLast, first, rd, kuitan: g.kuitan, Game, yakuPaths, nakiReason, lateYakuhai, placeAfterWin };
      // ロン（槍槓を含む）できたのに見送ったか。フリテンのときは数えない
      const checkRon = (tile, q, i, how) => {
        const sets = 4 - st.melds[me].length;
        const closed = st.hands[me];
        if (closed.length !== sets * 3 + 1 || !MJ.isWin(MJ.sortTiles([...closed, tile]), sets)) return;
        if (endedWith(i, me, q)) return;   // ロンした
        if (i === lastAct && !rd.results.length) return;   // 結果が書かれていない（途中で切れた牌譜）
        // ほかの人がこの牌でロンして局が終わった（頭ハネの決まりの牌譜もある）・三家和了は、見逃しに数えない
        const ended = i === lastAct && rd.results.some((r) => (r.kind === 'agari' && r.from === q) || (r.kind === 'draw' && r.text === '三家和了'));
        const ws = MJ.waits(MJ.sortTiles(closed), sets);
        const furiten = st.furiTemp || st.furiRiichi || st.discards[me].some((d) => ws.includes(MJ.norm(d.tile)));
        if (!furiten && !ended) {
          const w = mjWinInfo(st, me, closed, tile, how, i, rd, ctx, prevAct);
          if (w) { const d = mjWinMiss(st, me, how, tile, q, closed, w, ctx); d.seq = i; out.wins.push(d); extra.push(d); }
        }
        // 見送ったので、次に自分が切るまで（リーチ中なら局の終わりまで）ロンできない
        st.furiTemp = true;
        if (st.riichi[me]) st.furiRiichi = true;
      };
      for (const [i, ev] of rd.events.entries()) {
        const p = ev.p;
        if (ev.t === 'draw') {
          st.hands[p].push(ev.tile);
          st.drawsLeft--;
          // ツモあがりの見逃し：あがれる形なのに、あがらずに切った（カンした）
          if (p === me && !endedWith(i, me, me)) {
            const nk = nextAct(i);
            const ne = nk != null ? rd.events[nk] : null;
            if (ne && ne.p === me && ['discard', 'ankan', 'kakan'].includes(ne.t)) {
              const closed = [...st.hands[me]];
              mjTake(closed, ev.tile);
              const w = mjWinInfo(st, me, closed, ev.tile, 'tsumo', i, rd, ctx, prevAct);
              if (w) {
                const d = mjWinMiss(st, me, 'tsumo', ev.tile, me, closed, w, ctx);
                d.seq = i; out.wins.push(d); extra.push(d);
                afterTsumoMiss = ne.t === 'discard';
              }
            }
          }
        } else if (ev.t === 'discard') {
          const before = MJ.sortTiles(st.hands[p]);
          if (before.length !== 14 - 3 * st.melds[p].length || !mjTake(st.hands[p], ev.tile)) fail(i);
          if (p !== me) checkRon(ev.tile, p, i, 'ron');
          if (p === me) {
            done++;
            const already = st.riichi[me];
            st.n++;
            if (!already || ev.riichi) {
              // オーラスなら、押し引きを着順で見る（いまの点数・供託・本場）
              const al = allLast ? { scores: [...st.scores], oya: rd.oya, honba: rd.honba || 0, pot: (rd.sticks || 0) + st.log.filter((e) => e.kind === 'riichi').length, first, target: 30000, yame: true } : null;
              const alPre = al ? { ...al, scores: [...al.scores] } : null;   // リーチ棒を出す前（リーチ判断に使う）
              if (al && ev.riichi) { al.scores[me] -= 1000; al.pot++; }
              const dec = mjDecision(st, rd, me, before, ev, { reviewTurn, riichiPlayers, safestDiscard, Game, al, alPre });
              if (afterTsumoMiss) {
                // アガリを見逃した直後の打牌：受け入れやドラの指摘は、見逃しの話と重なるので出さない（押し引きだけ残す）
                const keep = dec.review.lines.filter((l) => l.kind === 'push' || l.kind === 'safe');
                dec.review = { ...dec.review, lines: keep, level: keep.some((l) => l.kind === 'push') ? dec.review.level : 'ok' };
                dec.replay = null;
              }
              dec.round = label;
              dec.seq = i;
              out.decisions.push(dec);
              roundDecs.push(dec);
              lastMine = dec;
            } else lastMine = { round: label, n: st.n, tile: ev.tile, before, skipped: true };
            if (onProgress && Date.now() - lastYield > 60) {
              onProgress(done, total);
              await new Promise((res) => setTimeout(res, 0));   // 画面を止めない
              lastYield = Date.now();
            }
          }
          st.discards[p].push({ tile: ev.tile, riichi: !!ev.riichi });
          if (ev.riichi) { st.riichi[p] = true; st.log.push({ kind: 'riichi', p }); st.scores[p] -= 1000; }
          st.log.push({ kind: 'discard', p, tile: ev.tile, riichi: !!ev.riichi });
          st.ban[p] = null;
          if (p === me) { st.furiTemp = false; afterTsumoMiss = false; }   // 同巡内のフリテンは、自分が切れば解ける
        } else if (ev.t === 'chi' || ev.t === 'pon' || ev.t === 'minkan') {
          const handBefore = p === me ? MJ.sortTiles(st.hands[me]) : null;
          for (const t of ev.hand) if (!mjTake(st.hands[p], t)) fail(i);
          const rv = st.discards[ev.from];
          const last = rv[rv.length - 1];
          if (!last || MJ.norm(last.tile) !== MJ.norm(ev.called)) fail(i);
          last.called = true;
          st.melds[p].push({ type: ev.t === 'minkan' ? 'kan' : ev.t, tiles: MJ.sortTiles(ev.tiles), from: ev.from });
          st.ban[p] = ev.t === 'minkan' ? null : new Set(kuikaeBan(ev.t, ev.called, ev.hand));
          st.log.push({ kind: 'call', p, type: ev.t, tiles: ev.tiles });
          if (p === me) {
            const d = mjCallReview(st, me, ev, handBefore, { ...ctx, seen: seenNow() });
            d.seq = i;
            out.calls.push(d);
            if (mjIsBad(d.review)) extra.push(d);
          }
        } else if (ev.t === 'ankan') {
          for (const t of ev.tiles) if (!mjTake(st.hands[p], t)) fail(i);
          st.melds[p].push({ type: 'ankan', tiles: MJ.sortTiles(ev.tiles), from: p });
        } else if (ev.t === 'kakan') {
          if (!mjTake(st.hands[p], ev.added)) fail(i);
          const m = st.melds[p].find((x) => x.type === 'pon' && MJ.norm(x.tiles[0]) === MJ.norm(ev.added));
          if (!m) fail(i);
          m.type = 'kakan';
          m.tiles = MJ.sortTiles([...m.tiles, ev.added]);
          if (p !== me) checkRon(ev.added, p, i, 'chankan');   // 槍槓
        } else if (ev.t === 'dora') {
          if (ev.tile) st.doraInds.push(ev.tile);
        }
      }
      // 放銃：最後の出来事が自分の打牌で、それでロンされた（ダブロンでも1回と数える）
      const lastEv = lastAct >= 0 ? rd.events[lastAct] : null;
      const dealt = rd.results.filter((res) => res.kind === 'agari' && res.from === me && res.who !== me);
      if (dealt.length && lastEv && lastEv.t === 'kakan' && lastEv.p === me) out.dealins++;   // 槍槓（加槓した牌でロンされた）
      let counted = false;
      for (const res of dealt) {
        if (!lastMine || !lastEv || lastEv.t !== 'discard' || lastEv.p !== me) continue;
        if (!counted) { out.dealins++; counted = true; }
        const dec = lastMine.skipped ? null : lastMine;
        const winner = g.names[res.who];
        if (dec && !dec.dealin) {
          dec.dealin = { who: res.who, text: res.text };
          // オーラスの押し引き：着順で見ると押すべきでなかった（トップ目など）／ラス目なので押してよかった
          const alPush = dec.review.lines.some((l) => l.kind === 'push' && l.sub === 'allLast');
          const alFree = dec.review.lines.some((l) => l.sub === 'allLast4');
          const pushNow = (dec.threats.length && dec.shAfter >= 1 && !alFree) || alPush;
          if (pushNow) out.dealinPush++;
          const safe = dec.safe;
          dec.review = {
            ...dec.review,
            level: pushNow ? 'blunder' : dec.review.level,
            lines: [{
              kind: 'dealin',
              what: `${MJ.tileName(dec.tile)}で、${mjEsc(winner)}に放銃しました（${mjEsc(res.text)}）。`,
              why: alPush ? 'オーラスで、着順を考えると押すと損な場面でした（くわしくは下の講評）。'
                : alFree ? 'オーラスのラス目なので、押したこと自体は間違いではありません。'
                : dec.threats.length
                ? (dec.shAfter >= 1
                  ? `リーチが入っていて、手はまだテンパイではありませんでした（テンパイまであと${dec.shAfter}枚）。手が遠いときは、現物（リーチした人の捨て牌）から切って降ります。`
                  : 'テンパイしていたので押した場面です。テンパイなら押すのが基本なので、仕方のない放銃です。')
                : st.melds[res.who].length
                  ? `${mjEsc(winner)}は鳴いて手を進めていました。鳴いている人の捨て牌の近くの牌や、まだ場に見えていない役牌は、当たりやすい牌です。`
                  : 'リーチのない相手（ダマテン）への放銃は、防ぎにくいものです。',
              better: pushNow && safe && safe.tile && MJ.norm(safe.tile) !== MJ.norm(dec.tile)
                ? { tile: safe.tile, label: `${MJ.tileName(safe.tile)}切り`, reason: safe.danger === 0 ? 'リーチした人の現物で、100%当たりません。' : 'いまの手牌でいちばん安全でした。' } : null,
              lesson: alPush ? 'オーラスは「あがったら何着か」「振り込んだら何着か」で、押すか降りるかを決めます。'
                : pushNow ? '手が遠い（テンパイまであと2枚以上）＋ リーチが入っている ＝ 降りる。' : '',
            }, ...dec.review.lines],
          };
        } else if (lastMine.skipped) {
          lastMine.dealin = { who: res.who, text: res.text };
        }
      }
      // 局の終わりの点数（点数の動きが牌譜にあるとき）。ロンされたのがリーチ宣言の牌なら、そのリーチは成立していない（供託は出ていない）
      const pre = [...st.scores];
      {
        const le = lastAct >= 0 ? rd.events[lastAct] : null;
        if (le && le.t === 'discard' && le.riichi && rd.results.some((r) => r.kind === 'agari' && r.from === le.p && r.who !== le.p)) pre[le.p] += 1000;
      }
      if (rd.results.length && rd.results.every((r) => Array.isArray(r.delta))) {
        lastEnd = pre.map((v, p) => v + rd.results.reduce((a, r) => a + (r.delta[p] || 0), 0));
        // 流局で残った供託は、対局が終わればトップがもらう
        if (!rd.results.some((r) => r.kind === 'agari')) {
          const pot = (rd.sticks || 0) + st.log.filter((e) => e.kind === 'riichi').length;
          const top = [0, 1, 2, 3].find((p) => mjRank(lastEnd, p, first) === 1);
          lastEnd = lastEnd.map((v, p) => (p === top ? v + pot * 1000 : v));
        }
      } else lastEnd = null;
      // オーラスの局の終わり：あがって着順が上がった・4着のまま終わった（アガリラス）・放銃して着順が落ちた
      const isFinal = rd === g.rounds[g.rounds.length - 1];
      if (allLast) {
        const wins = rd.results.filter((r) => r.kind === 'agari' && Array.isArray(r.delta));
        if (wins.length && wins.length === rd.results.filter((r) => r.kind === 'agari').length) {
          const post = pre.map((v, p) => v + wins.reduce((a, r) => a + (r.delta[p] || 0), 0));
          const b = mjRank(pre, me, first), a = mjRank(post, me, first);
          const mine = wins.find((r) => r.who === me);
          let uraChance = false;
          if (mine && a === 4 && st.riichi[me] && mine.han) {
            const pot = (rd.sticks || 0) + st.log.filter((e) => e.kind === 'riichi').length;
            const j = placeAfterWin(pre, { me, oya: rd.oya, honba: rd.honba || 0, pot, han: mine.han - (mine.ura || 0) + 1, fu: mine.fu, tsumo: mine.from === me, from: mine.from, first, target: 30000, yame: true });
            uraChance = j.after < 4;
          }
          if (isFinal && mine && a === 4 && !uraChance) {
            const third = [0, 1, 2, 3].find((p) => p !== me && mjRank(post, p, first) === 3);
            const d = mjAgariLast(st, me, rd, mine, { label, seatJa, gap: post[third] - post[me], name: g.names[third], pre, lastAct });
            if (d) { d.seq = lastAct + 0.5; extra.push(d); out.agariLast = (out.agariLast || 0) + 1; }
          } else if (mine && a < b) {
            // あがって着順が上がった（よい結果として、まとめに出す）
            const line = { kind: 'good', what: `このアガリ（${mjEsc(mine.text)}）で、${b}着から${a}着に上がりました${isFinal ? '。そのまま対局が終わりました' : ''}。`, why: '', lesson: '' };
            const d = mjAgariLast(st, me, rd, mine, { label, seatJa, lastAct, line, level: 'ok' });
            if (d) { d.seq = lastAct + 0.5; d.goodWin = true; extra.push(d); }
          }
          const dl = wins.find((r) => r.from === me && r.who !== me);
          if (dl && lastMine && !lastMine.skipped && lastMine.dealin) {
            if (isFinal && a > b) {
              const l0 = lastMine.review.lines.find((l) => l.kind === 'dealin');
              if (l0) l0.why += `この放銃で、${b}着から${a}着に落ちて対局が終わりました。オーラスは、振り込むと着順がそのまま決まります。`;
            }
            lastMine.allLastDeal = { from: b, to: a, ended: isFinal };
          }
        }
      }
      if (alRound) {
        alRound.entries = mjAllLastEntries(roundDecs, extra.filter((d) => d.type === 'win' || d.type === 'agari'));
        // この局が終わったときの着順（点数の動きが分かるとき）
        if (rd.results.length && rd.results.every((r) => Array.isArray(r.delta))) {
          alRound.endRank = mjRank(pre.map((v, p) => v + rd.results.reduce((a, r) => a + (r.delta[p] || 0), 0)), me, first);
        }
      }
      // 同じ局で、同じ牌を残し続けたための指摘（受け入れ）が続くときは、最初の1つにまとめる
      let prev = null;
      const listed = [];
      for (const d of roundDecs) {
        const bad = mjIsBad(d.review);
        if (!bad && !d.dealin) { prev = null; continue; }
        const eff = d.review.lines.find((l) => (l.kind === 'narrow' || l.kind === 'shanten') && l.better?.tile);
        const key = eff && !d.dealin && d.review.lines.every((l) => ['narrow', 'shanten', 'good'].includes(l.kind)) ? MJ.norm(eff.better.tile) : null;
        if (key && prev && prev.key === key) { prev.d.repeat = (prev.d.repeat || 0) + 1; d.dup = true; continue; }
        listed.push(d);
        prev = key ? { key, d } : null;
      }
      // 打牌・鳴き・アガリの見逃しを、起きた順に並べる
      roundOut.items = [...listed, ...extra].sort((a, b) => a.seq - b.seq);
      out.rounds.push(roundOut);
    }
    // 対局の最終結果：牌譜に最終の点数があればそれを、なければ最後の局の点数の動きから
    const fin = g.final || lastEnd;
    if (fin) out.final = { scores: fin, rank: mjRank(fin, me, first) };
    if (onProgress) onProgress(total, total);
    return out;
  }

  /**
   * あがれる形で、役があるか（あがれないなら null）。closed はアガリ牌を除いた手の中の牌。
   * how：'tsumo' | 'ron' | 'chankan'。ロンのときは、ほかの待ちの方が高いか（安い方を見送った可能性）も見る
   */
  function mjWinInfo(st, me, closed, tile, how, i, rd, ctx, prevAct) {
    const sets = 4 - st.melds[me].length;
    if (closed.length !== sets * 3 + 1) return null;
    if (!MJ.isWin(MJ.sortTiles([...closed, tile]), sets)) return null;
    const melds = st.melds[me].map((m) => ({ tiles: m.tiles, closed: m.type === 'ankan' }));
    const menzen = st.melds[me].every((m) => m.type === 'ankan');
    const pk = prevAct(i);
    const pe = pk >= 0 ? rd.events[pk] : null;
    const rinshan = how === 'tsumo' && !!pe && pe.p === me && ['ankan', 'kakan', 'minkan'].includes(pe.t);
    const base = { riichi: st.riichi[me], tsumo: how === 'tsumo', menzen, seatWind: ctx.seatWind, roundWind: ctx.roundWind, melds,
      rinshan, chankan: how === 'chankan', last: st.drawsLeft === 0 && how !== 'chankan' };
    const doras = st.doraInds.map(ctx.Game.nextOf);
    const value = (w) => {
      const ev = MJ.evaluateHand(MJ.sortTiles([...closed, w]), { ...base, winTile: w });
      let han = ev.han;
      if (ctx.kuitan === false && !menzen && ev.list.includes('tanyao')) han -= 1;   // 喰いタンなしの卓
      if (!(han > 0)) return null;
      const all = [...closed, w, ...st.melds[me].flatMap((m) => m.tiles)];
      const dora = doras.reduce((a, d) => a + all.filter((t) => MJ.norm(t) === d).length, 0);
      const aka = all.filter(MJ.isRed).length;
      return { han, dora, aka, list: ev.list, total: han + dora + aka, fu: ev.fu };
    };
    const v = value(tile);
    if (!v) return null;
    const yaku = [...v.list.map((k) => MJ.YAKU_JA[k]?.ja).filter(Boolean), ...(v.dora ? [`ドラ${v.dora}`] : []), ...(v.aka ? [`赤ドラ${v.aka}`] : [])];
    // ほかの待ちの方が高いなら、安い方をわざと見送ったのかもしれない（高目待ち）
    let higher = null;
    for (const w of MJ.waits(MJ.sortTiles(closed), sets)) {
      if (w === MJ.norm(tile)) continue;
      const x = value(w);
      if (x && x.total > v.total && (!higher || x.total > higher.total)) higher = { tile: w, total: x.total, fu: x.fu };
    }
    return { yaku, han: v.total, fu: v.fu, higher, sets };
  }

  /** アガリの見逃しの講評 */
  function mjWinMiss(st, me, how, tile, from, closed, w, ctx) {
    const who = MJ_REL_JA[(from - me + 4) % 4] || '';
    let level = w.higher ? 'miss' : 'blunder';
    let why = how === 'tsumo'
      ? 'ツモあがりを宣言せずに、先へ進めています。あがれるときは、まずあがるのが基本です。'
      : `ロンを宣言せずに見送っています。${st.riichi[me] ? 'リーチ中に見送ったので、この局はもうロンできません（ツモならあがれます）。' : '見送ると、次に自分が牌を切るまでロンできません（同巡内フリテン）。'}`;
    if (w.higher) why += `待ちのうち${MJ.tileName(w.higher.tile)}なら点数が高くなる形なので、安い方をわざと見送ったのかもしれません。その場合も、見送るとフリテンになることを覚えておきましょう。`;
    // オーラス：このアガリで対局が終わるなら、着順が上がる（トップを守る）かで判断する
    let place = null;
    if (ctx.allLast) {
      const pot = (ctx.rd.sticks || 0) + st.log.filter((e) => e.kind === 'riichi').length;
      const base = { me, oya: ctx.rd.oya, honba: ctx.rd.honba || 0, pot, tsumo: how === 'tsumo', from, first: ctx.first, target: 30000, yame: true };
      const j = ctx.placeAfterWin(st.scores, { ...base, han: w.han, fu: w.fu });
      const hi = w.higher ? ctx.placeAfterWin(st.scores, { ...base, han: w.higher.total, fu: w.higher.fu }) : null;
      const ura = st.riichi[me] ? ctx.placeAfterWin(st.scores, { ...base, han: w.han + 1, fu: w.fu }) : null;
      const link = '（考え方は「<a href="#/mahjong/mahjong.allast">オーラスの条件計算</a>」で）';
      place = j;
      if (!j.ends) {
        level = w.higher ? 'miss' : 'blunder';
        why += me === ctx.rd.oya
          ? 'オーラスですが親なので、あがれば終わらずに続けられる（連荘）場面でした。点数を取っておく方が得です。'
          : 'オーラスですが、このアガリではまだ誰も30000点に届かず、対局が続く場面でした。点数を取っておく方が得です。';
      } else if (j.after < j.before) {
        level = 'blunder';
        why += `オーラスで、あがれば${j.before}着から${j.after}着に上がって、対局が終わっていました。${link}`;
      } else if (j.after === 1) {
        level = 'blunder';
        why += `オーラスで、あがればトップのまま対局が終わっていました。トップ目のオーラスは、あがって終わらせるのがいちばん確実です。${link}`;
      } else {
        // あがっても着順が変わらずに終わる：見送って高いアガリを狙うのは、理にかなった判断
        level = 'ok';
        why = `オーラスで、あがっても${j.after}着のまま対局が終わる場面でした。着順を上げるには、もっと高いアガリが必要なので、見送る判断は理にかなっています。`
          + (hi && hi.ends && hi.after < j.after ? `${MJ.tileName(w.higher.tile)}なら${hi.after}着に上がれました。` : '')
          + (ura && ura.after < j.after ? `ただし、裏ドラが1枚乗れば${ura.after}着に上がれたので、あがる手もありました。` : '')
          + (how === 'tsumo' ? '' : st.riichi[me] ? 'リーチ中の見送りなので、この局はもうロンできず、ツモでしかあがれません。' : '見送った牌では、次に自分が切るまでロンできません。')
          + link;
      }
    }
    const yaku = w.yaku.join('・');
    const line = {
      kind: 'agarimiss',
      what: how === 'tsumo' ? `${MJ.tileName(tile)}をツモって、あがれる形でした（${yaku}）。`
        : how === 'chankan' ? `${who}が加槓した${MJ.tileName(tile)}で、ロン（槍槓）できました（${yaku}）。`
          : `${who}の${MJ.tileName(tile)}で、ロンできました（${yaku}）。`,
      why,
      lesson: level === 'ok' ? 'オーラスは「あがったら何着で終わるか」を先に計算します。着順が変わらないアガリは、見送って高い手を狙う考え方もあります。'
        : how === 'tsumo' ? 'ツモったら、まず「あがれる形か」を確かめます。' : 'あがれる牌が出たら、役があるかを確かめて、あればロンします。',
      d: { tile: MJ.tileName(tile) },
    };
    return {
      type: 'win', how, n: st.n, round: ctx.label, seat: ctx.seatJa, tile, from, before: MJ.sortTiles(closed), sets: w.sets,
      melds: st.melds[me].map((m) => ({ type: m.type, tiles: [...m.tiles] })), dora: [...st.doraInds], yaku: w.yaku, han: w.han,
      riichi: st.riichi[me], review: { level, lines: [line] }, place,
    };
  }

  /**
   * オーラスの局で、着順にかかわる判断（押し引き・リーチ・アガリの見送りと見逃し・アガリラス・着順が落ちた放銃）を集める。
   * よい判断・参考は、同じ種類が続くときは最初の1つだけ出して、あとは回数で数える
   */
  function mjAllLastEntries(decs, others) {
    const out = [];
    const firstOf = new Map();
    for (const d of decs) {
      const l = d.review.lines.find((x) => x.sub && x.sub.startsWith('allLast'));
      const dl = d.allLastDeal;   // 着順の動きは、局の結果の行に出す
      if (!l && !dl) continue;
      const flagged = l && l.sub === 'allLast';
      const cat = dl ? '放銃' : (l.kind === 'riichi' || l.sub === 'allLastDama' || l.sub === 'allLastTradeoff') ? 'リーチ判断' : '押し引き';
      const lv = flagged ? (d.review.level === 'ok' ? 'miss' : d.review.level)
        : dl ? (d.review.level === 'ok' ? 'note' : d.review.level) : l.sub === 'allLastTradeoff' ? 'note' : 'good';
      const dealWhat = dl ? (d.review.lines.find((x) => x.kind === 'dealin') || d.review.lines[0]).what : '';
      const text = [flagged ? l.what : '', dl ? dealWhat : (l ? l.what : '')].filter(Boolean).join(' ');
      // よい判断・参考（放銃は除く）は、同じ種類の2回目からは数えるだけ
      const dedupe = !dl && l && (lv === 'good' || lv === 'note');
      if (dedupe) {
        const seen = firstOf.get(l.sub);
        if (seen) { seen.more++; continue; }
      }
      const e = { d, cat, lv, text, more: 0, seq: d.seq };
      if (dedupe) firstOf.set(l.sub, e);
      out.push(e);
    }
    for (const d of others) {
      const bad = mjIsBad(d.review);
      const how = d.how === 'tsumo' ? 'ツモ' : 'ロン';
      out.push({ d, cat: d.type === 'agari' ? (d.goodWin ? 'アガリ' : 'アガリラス') : bad ? 'アガリの見逃し' : 'アガリの見送り', lv: bad ? d.review.level : 'good',
        text: !bad && d.place ? `${MJ.tileName(d.tile)}の${how}を見送りました。あがっても${d.place.after}着のまま終わる場面でした。` : d.review.lines[0].what,
        more: 0, seq: d.seq });
    }
    return out.sort((a, b) => a.seq - b.seq);
  }

  /** 点数での着順（同点なら起家に近い方が上） */
  function mjRank(sc, p, first) {
    const ord = (q) => (q - first + 4) % 4;
    return 1 + [0, 1, 2, 3].filter((q) => q !== p && (sc[q] > sc[p] || (sc[q] === sc[p] && ord(q) < ord(p)))).length;
  }

  /** オーラスのアガリの項目。ふつうはアガリラス（4着のまま終わった）の講評。o.line・o.level を渡すと、その文で作る */
  function mjAgariLast(st, me, rd, res, o) {
    // あがった手：ロンなら最後に出た牌、ツモなら最後に引いた牌
    const le = o.lastAct >= 0 ? rd.events[o.lastAct] : null;
    if (!le) return null;
    const tsumo = res.from === me;
    const tile = tsumo ? (le.t === 'draw' && le.p === me ? le.tile : null) : (le.t === 'discard' ? le.tile : le.t === 'kakan' ? le.added : null);
    if (!tile) return null;
    const closed = [...st.hands[me]];
    if (tsumo) mjTake(closed, tile);
    const line = o.line || {
      kind: 'agarirasu',
      what: `このアガリ（${mjEsc(res.text)}）で対局が終わり、4着のままでした（アガリラス）。`,
      why: `あがっても、3着の${mjEsc(o.name)}まで${o.gap}点届きませんでした。オーラスのラス目は、ラスを抜けられる点数のアガリを狙い、届かないアガリは見送る考え方があります（見送っても、ほかの人のアガリや流局で終わることはあります）。`
        + '（考え方は「<a href="#/mahjong/mahjong.allast">オーラスの条件計算</a>」で）',
      lesson: 'オーラスは「あがったら何着で終わるか」を先に計算します。',
    };
    return {
      type: 'agari', how: tsumo ? 'tsumo' : 'ron', n: st.n, round: o.label, seat: o.seatJa, tile, from: res.from,
      before: MJ.sortTiles(closed), sets: 4 - st.melds[me].length,
      melds: st.melds[me].map((m) => ({ type: m.type, tiles: [...m.tiles] })), dora: [...st.doraInds], riichi: st.riichi[me],
      review: { level: o.level || 'miss', lines: [line] },
    };
  }

  /** 鳴きの講評：鳴いた後に、役になる道筋が残っているか */
  function mjCallReview(st, me, ev, before, o) {
    const after = MJ.sortTiles(st.hands[me]);
    const melds = st.melds[me].map((m) => ({ type: m.type, tiles: [...m.tiles] }));
    const sets = 4 - melds.length;
    const opt = { seatWind: o.seatWind, roundWind: o.roundWind, seen: o.seen, kuitan: o.kuitan };
    const paths = o.yakuPaths(after, melds, opt);
    const rel = (ev.from - me + 4) % 4;
    // 終盤に、流局したときのテンパイ（形式テンパイ）を取りにいく鳴きは、役がなくても意味がある
    const sh = MJ.shanten(after, sets);
    const late = (sh <= 0 && st.drawsLeft <= 24) || (sh <= 1 && st.drawsLeft <= 16);
    const singles = o.lateYakuhai(after, opt);
    let review;
    if (paths.length) {
      review = { level: 'ok', lines: [{ kind: 'good', what: `役の候補が残る鳴きです（${paths.map((x) => x.ja).join('・')}）。`, why: '', lesson: '' }] };
    } else if (late) {
      review = { level: 'ok', lines: [{ kind: 'good', what: '終盤の鳴きです。役はありませんが、流局したときにテンパイしていれば点数がもらえる（形式テンパイ）ので、意味のある鳴きです。', why: '', lesson: '' }] };
    } else {
      review = { level: 'miss', lines: [{
        kind: 'nakiyaku',
        what: singles.length
          ? `${MJ_REL_JA[rel] || ''}の${MJ.tileName(ev.called)}を${MJ_CALL_JA[ev.t]}しましたが、いまは役がありません（役牌の${singles.map(MJ.tileName).join('・')}が重なれば役になる「後付け」です）。`
          : `${MJ_REL_JA[rel] || ''}の${MJ.tileName(ev.called)}を${MJ_CALL_JA[ev.t]}しましたが、この鳴きで役がなくなりそうです。`,
        why: `${o.nakiReason(after, melds, opt)}鳴いた手はリーチができないので、このままではテンパイしてもあがれません。`,
        better: { label: '鳴かずに門前で進める', reason: '門前なら、テンパイしたときにリーチという役がつけられます。' },
        lesson: singles.length ? '後付けは、役牌が重ならないとあがれない、上級者向けの鳴きです。初心者のうちは「役が決まってから鳴く」のが安全です。'
          : '鳴く前に「この手の役は何か」を決めておきます。役が決まらないなら、鳴きません。',
      }] };
    }
    return {
      type: 'call', n: st.n, round: o.label, seat: o.seatJa, call: ev.t, called: ev.called, from: ev.from, rel, left: st.drawsLeft,
      before, used: [...ev.hand], after, melds, dora: [...st.doraInds], review, paths: paths.map((x) => x.ja),
    };
  }
  const mjIsBad = (rv) => rv && rv.level !== 'ok' && rv.lines.some((l) => !['good', 'goal', 'tip', 'safe'].includes(l.kind));

  /** 自分の1打ぶんの講評（4人打ちの対局と同じ流れ：押し引き → 受け入れ → ドラ・役、役なしダマ） */
  function mjDecision(st, rd, me, before, ev, F) {
    const { reviewTurn, riichiPlayers, safestDiscard, Game } = F;
    const sets = 4 - st.melds[me].length;
    const tile = ev.tile;
    const round = Math.floor(rd.kyoku / 4) % 4;
    // 切った「後」の場の形（4人打ちの対局で講評するときと同じ）
    const adapter = {
      hands: st.hands.map((h) => [...h]),
      melds: st.melds.map((ms) => ms.map((m) => ({ ...m, tiles: [...m.tiles] }))),
      discards: st.discards.map((ds) => ds.map((d) => ({ ...d }))),
      riichi: [...st.riichi], log: [...st.log], phase: 'call', drawn: null, turn: me, oya: rd.oya,
      doraInds: [...st.doraInds],
      seatWind(p) { return MJ_SEAT_TILE[(p - this.oya + 4) % 4]; },
      roundWind() { return MJ_SEAT_TILE[round]; },
      seatJa(p) { return MJ_WIND_JA[(p - this.oya + 4) % 4]; },
      isOya(p) { return p === this.oya; },
      doraTiles() { return this.doraInds.map(Game.nextOf); },
      setsNeeded(p) { return 4 - this.melds[p].length; },
      isMenzen(p) { return this.melds[p].every((m) => m.type === 'ankan'); },
      meldsFor(p) { return this.melds[p].map((m) => ({ tiles: m.tiles, closed: m.type === 'ankan' })); },
      fullHand(p) { return MJ.sortTiles(this.hands[p]); },
    };
    adapter.discards[me].push({ tile, riichi: !!ev.riichi });
    if (ev.riichi) { adapter.riichi[me] = true; adapter.log.push({ kind: 'riichi', p: me }); }
    adapter.log.push({ kind: 'discard', p: me, tile, riichi: !!ev.riichi });
    // 見えている牌（受け入れの残り枚数を数える）
    const seen = [];
    for (const ds of st.discards) for (const d of ds) if (!d.called) seen.push(d.tile);
    for (const ms of st.melds) for (const m of ms) seen.push(...m.tiles);
    seen.push(...st.doraInds);
    // 役のないテンパイなのにリーチしなかった（4人打ちの対局と同じ条件）
    let riichiMiss = null;
    const menzen = adapter.isMenzen(me);
    if (!ev.riichi && !st.riichi[me] && menzen && st.scores[me] >= 1000 && st.drawsLeft >= 4) {
      const rest = MJ.sortTiles(st.hands[me]);
      const ws = MJ.waits(rest, sets);
      if (ws.length) {
        const yaku = ws.some((w) => MJ.judgeYaku(MJ.sortTiles([...rest.map(MJ.norm), w]), {
          menzen: true, seatWind: adapter.seatWind(me), roundWind: adapter.roundWind(), winTile: w, melds: adapter.meldsFor(me),
        }).length > 0);
        const own = new Set([...st.discards[me].map((d) => MJ.norm(d.tile)), MJ.norm(tile)]);
        if (!yaku && !ws.some((w) => own.has(w))) {
          riichiMiss = { kind: 'riichi', what: '役のないテンパイなのに、リーチしませんでした。',
            why: 'この形はリーチしないとロンであがれません（ツモなら門前清自摸和という役がつきます）。',
            lesson: '役のないテンパイは、リーチが役の代わりになります。' };
        }
      }
    }
    // オーラス：リーチかダマかを着順で見る（フリテンの待ちは見ない）
    let alRiichi = null;
    if (F.alPre && menzen && !st.riichi[me] && st.scores[me] >= 1000 && st.drawsLeft >= 4) {
      const rest = MJ.sortTiles(st.hands[me]);
      const ws = MJ.waits(rest, sets);
      const own = new Set([...st.discards[me].map((d) => MJ.norm(d.tile)), MJ.norm(tile)]);
      if (ws.length && !ws.some((w) => own.has(w))) {
        alRiichi = NS_MJAI.allLastRiichiLine(NS_MJAI.allLastRiichi(adapter, me, F.alPre, rest), !!ev.riichi, '着');
        if (alRiichi?.drop) riichiMiss = null;
      }
    }
    let review = reviewTurn(adapter, me, before, tile, { seen, banned: st.ban[me], allLast: F.al || null });
    if (riichiMiss) review = { ...review, lines: [riichiMiss, ...review.lines], level: mjWorse(review.level, 'miss') };
    if (alRiichi) review = { ...review, lines: [alRiichi.line, ...review.lines], level: alRiichi.level === 'miss' ? mjWorse(review.level, 'miss') : review.level };
    const threats = riichiPlayers(adapter, me);
    const shAfter = MJ.shantenAll(MJ.sortTiles(st.hands[me]), sets);
    const safe = threats.length ? safestDiscard(adapter, me) : null;
    // 「テンパイまでの道筋」（受け入れの指摘のとき）
    const l0 = review.lines.find((l) => l.kind === 'shanten' || l.kind === 'narrow');
    const replay = l0 && l0.better?.tile && l0.better.tile !== tile
      ? { label: '▶ テンパイまでの道筋を見る', hand: [...before], tile, best: l0.better.tile, sets, seen: [...seen], poolTotal: 136 } : null;
    return {
      n: st.n, before, tile, sets, riichi: !!ev.riichi, review, threats, shAfter, safe, replay,
      banned: st.ban[me] ? [...st.ban[me]] : null,
      dora: [...st.doraInds],
      melds: st.melds[me].map((m) => ({ type: m.type, tiles: [...m.tiles] })),
      rivers: threats.map((q) => ({ p: q, seat: adapter.seatJa(q), tiles: st.discards[q].map((d) => ({ ...d })) })),
      seat: adapter.seatJa(me),
    };
  }

  /** 起家（東1局の親）の席。同点の着順を決めるのに使う */
  const parsedFirst = (g) => (g.rounds[0].oya - (g.rounds[0].kyoku % 4) + 4) % 4;

  /** 画面：牌譜を貼り付ける → 自分の席を選ぶ → コーチが講評 → 気になった打牌を一覧 → 復習問題に */
  function reviewImportMahjong(host) {
    const { renderTiles, tileFace } = NS_TILES;
    const stage = el('div', 'stage imp mji');
    host.appendChild(stage);
    stage.appendChild(el('h2', 'imp__title', '牌譜を振り返る'));
    stage.appendChild(el('p', 'imp__lead', '天鳳の牌譜（<strong>mjlog・XML</strong>）か、<strong>tenhou.net/6 形式の JSON</strong> を貼り付けると、あなたの打牌・鳴き・アガリの見逃しを、コーチが講評します。雀魂などの牌譜も、tenhou.net/6 形式に変換したものなら読めます。'));
    const ta = el('textarea', 'imp__text');
    ta.setAttribute('aria-label', '牌譜（mjlog または JSON）');
    ta.placeholder = '<mjloggm ver="2.3"><GO type="169"/> …\nまたは\n{"title":[…],"name":[…],"log":[…]}';
    stage.appendChild(ta);
    const row1 = el('div', 'actions');
    const fileLab = el('label', 'btn btn--ghost', 'ファイルを選ぶ');
    const file = el('input');
    file.type = 'file'; file.accept = '.mjlog,.xml,.json,.txt,.gz';
    file.hidden = true;
    fileLab.appendChild(file);
    const goBtn = el('button', 'btn btn--tone', '読み込む');
    row1.append(goBtn, fileLab);
    stage.appendChild(row1);
    const tip = el('p', 'note imp__tip', '天鳳の牌譜を見るURL（https://tenhou.net/0/?log=…）を貼ると、牌譜の中身を開くリンクを出します。');
    stage.appendChild(tip);
    const status = el('p', 'note imp__status');
    status.setAttribute('role', 'status');
    stage.appendChild(status);
    const sideBox = el('div', 'actions imp__sides');
    stage.appendChild(sideBox);
    // まとめ → 選んだ打牌のくわしい講評 → 局ごとの一覧 の順に並べる
    const sumBox = el('div');
    const detail = el('div', 'mji__detail');
    detail.hidden = true;
    const result = el('div', 'imp__result');
    stage.append(sumBox, detail, result);

    let parsed = null, token = 0, seatHint = null;
    const decodeBuf = async (buf, name) => {
      let bytes = new Uint8Array(buf);
      if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
        if (typeof DecompressionStream === 'undefined') throw new Error('gzip');
        const ds = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
        bytes = new Uint8Array(await new Response(ds).arrayBuffer());
      }
      let txt = new TextDecoder('utf-8').decode(bytes);
      if (/�/.test(txt)) { try { txt = new TextDecoder('shift_jis').decode(bytes); } catch { /* そのまま */ } }
      // ファイル名に「tw=2」のような席の番号があれば、それを使う（なければ前の手がかりは消す）
      const tw = String(name || '').match(/tw=(\d)/);
      seatHint = tw ? Number(tw[1]) : null;
      return txt;
    };
    file.addEventListener('change', async () => {
      const f = file.files?.[0];
      if (!f) return;
      try {
        ta.value = await decodeBuf(await f.arrayBuffer(), f.name);
        status.textContent = `${f.name} を読み込みました。「読み込む」を押してください。`;
      } catch (e) {
        status.textContent = e?.message === 'gzip'
          ? '圧縮されたファイルは、このブラウザでは開けません。中身を開いて、貼り付けてください。'
          : 'ファイルを読めませんでした。中身をコピーして、貼り付けてください。';
      }
    });
    goBtn.addEventListener('click', () => {
      token++;
      result.innerHTML = ''; sumBox.innerHTML = ''; sideBox.innerHTML = ''; detail.hidden = true; detail.innerHTML = '';
      const url = tenhouUrlInfo(ta.value);
      if (url && !/^\s*[<{]/.test(ta.value)) {
        parsed = null;
        if (url.tw != null) seatHint = url.tw;
        status.innerHTML = '<b>これは牌譜を見るURLです</b>この画面からは天鳳のサイトを読みに行けません。'
          + `下のリンクを開くと、牌譜の中身（XML）が表示されます。それを全部コピーして、ここに貼り付けてください。<br><a href="${mjEsc(url.data)}" target="_blank" rel="noopener">${mjEsc(url.data)}</a>`
          + '<br>うまく表示されないときは、牌譜の中身を保存したファイルを「ファイルを選ぶ」から選んでください。'
          + (url.tw != null ? `<br>URLの「tw=${url.tw}」から、あなたの席を覚えておきます。` : '');
        return;
      }
      const r = readMahjongLog(ta.value);
      if (r.error) { parsed = null; status.innerHTML = `<b>読めませんでした</b>${r.error}`; return; }
      parsed = r;
      const oya0 = r.rounds[0].oya;
      status.textContent = `${r.rounds.length}局を読み込みました。あなたはどの席でしたか。`;
      [0, 1, 2, 3].forEach((p) => {
        const b = el('button', `btn ${seatHint === p ? 'btn--tone' : 'btn--ghost'}`,
          `${mjEsc(r.names[p])}（最初は${MJ_WIND_JA[(p - oya0 + 4) % 4]}家）${seatHint === p ? ' ← URLの席' : ''}`);
        b.addEventListener('click', () => run(p));
        sideBox.appendChild(b);
      });
    });

    const mini = (t, cls = '') => `<span class="tile tile--mini ${cls}">${tileFace(t)}</span>`;
    const meldsHtml = (ms) => ms.map((m) => `<span class="mji__meld">${m.tiles.map((t) => mini(t)).join('')}</span>`).join('');
    const notesHtml = (lines) => lines.filter((x) => x.what).map((x, k) => `<p class="${k ? '' : 'mji__what'}">${k ? '' : '<b>'}${x.what}${k ? '' : '</b>'}</p>`
      + (x.why ? `<p class="mji__why">${x.why}</p>` : '')
      + (x.better?.label ? `<p class="mji__why">こうすれば：${x.better.label}${x.better.reason ? ` — ${x.better.reason}` : ''}</p>` : '')
      + (x.lesson ? `<p class="mji__lesson">${x.lesson}</p>` : '')).join('');
    /** 鳴きの講評：鳴く前の手（鳴きに使った牌に印）と、鳴いた牌 */
    function showCallDetail(d) {
      detail.innerHTML = `<h3 class="mji__h">${mjEsc(d.round)}　${mjWhen(d.n)}の鳴き（${d.seat}家）</h3>`
        + `<p class="mji__ctx">ドラ表示牌 ${d.dora.map((t) => mini(t)).join('')}</p>`
        + `<p class="mji__ctx"><b>${MJ_REL_JA[d.rel] || ''}の捨て牌</b>${mini(d.called)}<b>を${MJ_CALL_JA[d.call]}</b>（山の残り ${d.left}枚）</p>`
        + (d.melds.length > 1 ? `<p class="mji__ctx">それまでの鳴き ${meldsHtml(d.melds.slice(0, -1))}</p>` : '');
      const handBox = el('div');
      const states = {};
      const used = [...d.used];
      for (const same of [(a, b) => a === b, (a, b) => MJ.norm(a) === MJ.norm(b)]) {
        d.before.forEach((t, i) => {
          if (states[i]) return;
          const k = used.findIndex((u) => same(u, t));
          if (k >= 0) { states[i] = 'ng'; used.splice(k, 1); }
        });
      }
      renderTiles(handBox, d.before, { states, disabled: true, tight: true });
      detail.appendChild(handBox);
      const note = el('div', 'mji__note');
      note.innerHTML = notesHtml(d.review.lines)
        + `<p class="mji__key"><span style="color:var(--ng)">■</span> 鳴きに使った牌（鳴く前の手）</p>`;
      detail.appendChild(note);
    }
    /** アガリの見逃し：手の中の牌と、アガリ牌 */
    function showWinDetail(d) {
      const what = d.type === 'agari' ? `あなたの${d.how === 'tsumo' ? 'ツモ' : 'ロン'}` : `${d.how === 'tsumo' ? 'ツモ' : 'ロン'}の${mjIsBad(d.review) ? '見逃し' : '見送り'}`;
      detail.innerHTML = `<h3 class="mji__h">${mjEsc(d.round)}　${what}（${d.seat}家${d.riichi ? '・リーチ中' : ''}）</h3>`
        + `<p class="mji__ctx">ドラ表示牌 ${d.dora.map((t) => mini(t)).join('')}</p>`
        + (d.melds.length ? `<p class="mji__ctx">あなたの鳴き ${meldsHtml(d.melds)}</p>` : '');
      const handBox = el('div');
      renderTiles(handBox, [...d.before, d.tile], { states: { [d.before.length]: 'ok' }, disabled: true, tight: true });
      handBox.lastElementChild?.classList.add('tile--drawn');
      detail.appendChild(handBox);
      const note = el('div', 'mji__note');
      note.innerHTML = notesHtml(d.review.lines)
        + `<p class="mji__key"><span style="color:var(--ok)">■</span> アガリ牌（${d.how === 'tsumo' ? 'ツモった牌' : '出た牌'}）</p>`;
      detail.appendChild(note);
    }
    function showDetail(d) {
      detail.hidden = false;
      if (d.type === 'call') { showCallDetail(d); return; }
      if (d.type === 'win' || d.type === 'agari') { showWinDetail(d); return; }
      const l = d.review.lines.find((x) => !['good', 'goal', 'tip', 'safe'].includes(x.kind)) || d.review.lines[0] || {};
      const better = l.better?.tile || null;
      detail.innerHTML = `<h3 class="mji__h">${mjEsc(d.round)}　${d.n}打目（${d.seat}家）${d.riichi ? '　リーチ宣言' : ''}</h3>`
        + `<p class="mji__ctx">ドラ表示牌 ${d.dora.map((t) => mini(t)).join('')}</p>`
        + d.rivers.map((rv) => `<div class="mji__ctx"><b>${rv.seat}家の捨て牌（リーチ）</b><span class="mji__riv">${rv.tiles.map((x) => mini(x.tile, `${x.riichi ? 'is-riichi' : ''} ${x.called ? 'is-called' : ''}`)).join('')}</span></div>`).join('')
        + (d.melds.length ? `<p class="mji__ctx">あなたの鳴き ${d.melds.map((m) => `<span class="mji__meld">${m.tiles.map((t) => mini(t)).join('')}</span>`).join('')}</p>` : '');
      const handBox = el('div');
      const states = {};
      d.before.forEach((t, i) => {
        if (t === d.tile && !Object.values(states).includes('ng')) states[i] = 'ng';
        else if (better && t === better && !Object.values(states).includes('ok')) states[i] = 'ok';
      });
      renderTiles(handBox, d.before, { states, disabled: true, tight: true });
      detail.appendChild(handBox);
      const note = el('div', 'mji__note');
      note.innerHTML = notesHtml(d.review.lines)
        + `<p class="mji__key"><span style="color:var(--ng)">■</span> 切った牌${better ? '　<span style="color:var(--ok)">■</span> コーチのおすすめ' : ''}</p>`;
      if (d.replay) {
        const rb = el('button', 'btn btn--ghost btn--sm', d.replay.label);
        rb.addEventListener('click', () => openMahjongRoutes(d.replay, rb));
        note.appendChild(rb);
      }
      detail.appendChild(note);
    }

    async function run(me) {
      const my = ++token;
      result.innerHTML = ''; sumBox.innerHTML = ''; detail.hidden = true; detail.innerHTML = '';
      sideBox.querySelectorAll('button').forEach((b, i) => { b.className = `btn ${i === me ? 'btn--tone' : 'btn--ghost'}`; });
      let rv;
      try {
        rv = await reviewMahjongGame(parsed, me, (k, n) => {
          if (my === token) status.textContent = `コーチが講評しています… ${k} / ${n}打`;
        });
      } catch (e) {
        if (my === token) status.innerHTML = `<b>読めませんでした</b>${e instanceof MjLogError ? e.message : '牌譜の途中で、手順が合わなくなりました。'}`;
        return;
      }
      if (my !== token || !stage.isConnected) return;
      status.textContent = '講評が終わりました。';
      const decs = rv.decisions;
      const bad = decs.filter((d) => mjIsBad(d.review));
      const big = bad.filter((d) => d.review.level === 'blunder').length;
      const badCalls = rv.calls.filter((d) => mjIsBad(d.review));
      const badWins = rv.wins.filter((d) => mjIsBad(d.review));
      const kinds = {};
      const lastWins = rv.rounds.flatMap((r) => r.items.filter((d) => d.type === 'agari' && !d.goodWin));
      for (const d of [...decs, ...badCalls, ...badWins, ...lastWins]) {
        if (!mjIsBad(d.review) && !d.dealin) continue;
        for (const k of new Set(d.review.lines.map((x) => x.kind))) if (K.KIND_JA[k] && (k !== 'dealin' || d.dealin)) kinds[k] = (kinds[k] || 0) + 1;
      }
      const top = Object.entries(kinds).filter(([k]) => k !== 'dealin' || rv.dealinPush).sort((a, b) => b[1] - a[1])[0];
      const linkId = top ? K.lessonFor('mahjong', top[0]) : null;
      let linkTitle = null;
      for (const c of NS_DMAHJONG.mahjong.chapters) for (const l of c.lessons) if (l.id === linkId) linkTitle = l.title;
      const sum = el('div', 'gsum');
      sum.innerHTML = `<h3>この対局のまとめ</h3><p>あなたの打牌 ${rv.total}打のうち、講評した ${decs.length}打（リーチ後のツモ切りは除く）で、コーチが指摘したのは ${bad.length}打でした${bad.length ? `（大きな悪手 ${big}・悪手 ${bad.length - big}）` : ''}。</p>`
        + `<p>放銃は ${rv.dealins}回${rv.dealins ? `（そのうち、リーチに対して手が遠いのに押した放銃 ${rv.dealinPush}回）` : ''}。</p>`
        + (rv.calls.length ? `<p>鳴きは ${rv.calls.length}回${badCalls.length ? `（そのうち、役がなくなりそうな鳴き ${badCalls.length}回）` : '（どれも、役の候補が残る鳴きでした）'}。</p>` : '')
        + (badWins.length ? `<p>アガリの見逃しが ${badWins.length}回ありました。</p>` : '')
        + (rv.wins.length > badWins.length ? `<p>オーラスで、あがっても着順が変わらないアガリを見送った場面が ${rv.wins.length - badWins.length}回あります（これは間違いとしていません）。</p>` : '')
        + (lastWins.length ? '<p>オーラスで、4着のまま終わるアガリをしました（アガリラス）。</p>' : '')
        + (Object.keys(kinds).length ? `<p>${Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<span class="gsum__k">${K.KIND_JA[k]} ×${n}</span>`).join('')}</p>` : '<p>大きな見落としは見つかりませんでした。</p>')
        + (linkId && linkTitle ? `<p>おすすめの練習：<a href="#/mahjong/${linkId}">${mjEsc(linkTitle)}</a></p>` : '');
      sumBox.appendChild(sum);
      // オーラスの判断（押し引き・リーチ・アガリの見送りと見逃し・アガリラス）を1つの欄にまとめる
      if (rv.allLast.length) {
        const fmt = (v) => Number(v).toLocaleString('ja-JP');
        const box = el('div', 'gsum mji__al');
        box.appendChild(el('h3', '', 'オーラスの判断'));
        for (const ar of rv.allLast) {
          const sc = ar.scores, r = ar.rank;
          const at = (k) => [0, 1, 2, 3].find((p) => mjRank(sc, p, parsedFirst(parsed)) === k);
          // 同点なら、起家に近い席が上（「0点差」とは書かない）
          const gu = r > 1 ? sc[at(r - 1)] - sc[me] : 0, gd = r < 4 ? sc[me] - sc[at(r + 1)] : 0;
          const upName = r === 2 ? 'トップ' : `${r - 1}着`;
          const up = r > 1 ? (gu ? `${upName}まで${fmt(gu)}点` : `${upName}と同点（席順で下）`) : '';
          const down = r < 4 ? (gd ? `${r + 1}着とは${fmt(gd)}点差` : `${r + 1}着と同点（席順で上）`) : '';
          box.appendChild(el('p', 'mji__alh', `<b>${mjEsc(ar.label)}</b>　はじめは${r}着（${fmt(sc[me])}点）。${[up, down].filter(Boolean).join('、')}。`));
          if (!ar.entries.length) box.appendChild(el('p', 'mji__alnone', 'この局では、着順にかかわる判断の場面はありませんでした。'));
          for (const e of ar.entries) {
            const b = el('button', 'mji__alrow');
            b.type = 'button';
            const lvJa = { blunder: '大きな悪手', miss: '悪手', good: 'よい判断', note: '参考' }[e.lv] || '悪手';
            const when = e.d.type === 'win' || e.d.type === 'agari' ? '' : `（${e.d.n}打目）`;
            b.innerHTML = `<span class="imp__lv" data-lv="${e.lv}">${lvJa}</span><span class="mji__alc">${e.cat}${when}</span>`
              + `<span class="mji__alt">${e.text}${e.more ? `（このあとも同じ場面が${e.more}回）` : ''}</span>`;
            b.addEventListener('click', () => { showDetail(e.d); detail.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
            box.appendChild(b);
          }
          // 局の結果と、終わったときの着順
          const ro = rv.rounds.find((x) => x.label === ar.label);
          if (ro && ro.results.length) {
            const res = ro.results.map((x) => (x.kind === 'agari'
              ? `${x.who === me ? 'あなた' : mjEsc(parsed.names[x.who])}が${x.who === x.from ? 'ツモ' : `${x.from === me ? 'あなた' : mjEsc(parsed.names[x.from])}からロン`}（${mjEsc(x.text)}）`
              : mjEsc(x.text))).join('・');
            const mv = ar.endRank == null ? '' : ar.endRank === r ? `あなたは${r}着のまま。` : `あなたは${r}着から${ar.endRank}着に。`;
            box.appendChild(el('p', 'mji__alnone', `この局の結果：${res}。${mv}`));
          }
        }
        if (rv.final) box.appendChild(el('p', 'mji__alres', `結果：<b>${rv.final.rank}着</b>（${fmt(rv.final.scores[me])}点）で終わりました。`));
        sumBox.appendChild(box);
      }
      // 局ごとの結果と、気になった打牌
      const listed = [];
      for (const ro of rv.rounds) {
        const resText = ro.results.length ? ro.results.map((x) => (x.kind === 'agari'
          ? `${x.who === me ? 'あなた' : mjEsc(parsed.names[x.who])}が${x.who === x.from ? 'ツモ' : `${x.from === me ? 'あなた' : mjEsc(parsed.names[x.from])}からロン`}（${mjEsc(x.text)}）`
          : mjEsc(x.text))).join('・') : '結果なし';
        const sec = el('div', 'mji__round');
        sec.appendChild(el('p', 'mji__rh', `<b>${mjEsc(ro.label)}</b>　${resText}`));
        for (const d of ro.items) {
          const l = d.review.lines.find((x) => !['good', 'goal', 'tip', 'safe'].includes(x.kind)) || d.review.lines[0];
          const item = el('button', 'imp__item');
          item.type = 'button';
          const lv = mjIsBad(d.review) ? d.review.level : d.type === 'win' || d.type === 'agari' ? 'good' : 'deal';
          const head = d.type === 'call' ? `${mjWhen(d.n)} ${MJ.tileName(d.called)}を${MJ_CALL_JA[d.call]}`
            : d.type === 'agari' ? `あなたのアガリ（${MJ.tileName(d.tile)}で${d.how === 'tsumo' ? 'ツモ' : 'ロン'}）`
            : d.type === 'win' ? `${d.how === 'tsumo' ? 'ツモ' : 'ロン'}の${lv === 'good' ? '見送り' : '見逃し'}（${MJ.tileName(d.tile)}）`
              : `${d.n}打目 ${MJ.tileName(d.tile)}切り`;
          const lvJa = { blunder: '大きな悪手', miss: '悪手', good: 'よい判断', deal: '放銃' }[lv];
          item.innerHTML = `<span class="imp__no">${head}</span><span class="imp__lv" data-lv="${lv}">${lvJa}</span>`
            + `<span class="imp__what">${l.what}</span>`
            + (d.repeat ? `<span class="imp__why">このあとも${d.repeat}回、同じ牌を残して受け入れを狭めています。</span>` : '')
            + (lv === 'good' && d.place ? `<span class="imp__why">オーラスで、あがっても${d.place.after}着のまま終わる場面でした。</span>` : '');
          item.addEventListener('click', () => {
            result.querySelectorAll('.imp__item').forEach((x) => x.removeAttribute('aria-current'));
            item.setAttribute('aria-current', 'true');
            showDetail(d);
            detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
          sec.appendChild(item);
          listed.push({ item, d });
        }
        result.appendChild(sec);
      }
      // 最初の1つを開いておく（読み込んだ直後は、画面を動かさない）
      if (listed.length) { listed[0].item.setAttribute('aria-current', 'true'); showDetail(listed[0].d); }
      if (!bad.length && !rv.dealins && !badWins.length) return;
      // 復習問題にする（何切る・安全牌の問題になる打牌と、アガリ牌を選ぶ問題になるアガリの見逃し）
      const save = el('div', 'actions');
      const sb = el('button', 'btn btn--tone', '指摘された場面を、復習問題に入れる');
      sb.addEventListener('click', () => {
        sb.disabled = true;
        const before = store.pendingMistakes('mahjong').length;
        const src = `${today()}の牌譜`;
        for (const d of decs) {
          if (d.dup) continue;
          try {
            const kinds2 = new Set(d.review.lines.map((x) => x.kind));
            if ((kinds2.has('shanten') || kinds2.has('narrow')) && !d.banned?.length) {
              // 問題は「見えている牌」を数えない受け入れで判定されるので、その数え方でも損な切り方だけを残す
              const base0 = K.explainDiscard(d.before, d.tile, d.sets);
              saveDiscardMistake(base0, d.before, d.sets, src);
            }
            const alPush = d.review.lines.some((x) => x.kind === 'push' && x.sub === 'allLast');
            const alFree = d.review.lines.some((x) => x.sub === 'allLast4');
            if (d.rivers.length && !alFree && (kinds2.has('push') || (d.dealin && d.shAfter >= 1))) {
              const river = d.rivers[0].tiles.map((x) => x.tile);
              saveDealInMistake(river, d.before, d.tile, alPush
                ? { src, kind: 'push', prompt: `実戦でこの場面から<strong>${MJ.tileName(d.tile)}</strong>を切りましたが、オーラスの着順を考えると、降りる場面でした。下がリーチした人の捨て牌です。この中から<strong>いちばん安全な牌</strong>を選んでください。` }
                : d.dealin
                  ? { src }
                  : { src, kind: 'push', prompt: `実戦でこの場面から<strong>${MJ.tileName(d.tile)}</strong>を切りましたが、手はまだ遠く、降りる場面でした。下がリーチした人の捨て牌です。この中から<strong>いちばん安全な牌</strong>を選んでください。` });
            }
          } catch { /* 作れない形は飛ばす */ }
        }
        for (const d of badWins) {
          try {
            saveWinMissMistake(d.before, d.sets, d.tile, { tsumo: d.how === 'tsumo', src, why: `実戦では${MJ.tileName(d.tile)}であがれました（${d.yaku.join('・')}）。` });
          } catch { /* 作れない形は飛ばす */ }
        }
        const made = store.pendingMistakes('mahjong').length - before;
        const note = el('p', 'note');
        note.innerHTML = made
          ? `${made}問を「自分の悪手から」に入れました。<a href="#/mahjong/_mine">いま解いてみる</a>`
          : '問題にできる形の場面は、ありませんでした（ドラ・リーチ・鳴きの判断は問題にしていません。同じ問題がすでに入っている場合も含みます）。';
        save.after(note);
      });
      save.appendChild(sb);
      result.appendChild(save);
    }
  }

  return { CHESS_SETUPS, playChess, playShogi, playGo, goChallengeNext, KOMAOCHI, komaochiNext, komaochiStart, soloMahjong, makeTally, showMjRecap, saveDiscardMistake, saveDealInMistake, saveWinMissMistake, toPGN, toKIF, openMahjongRoutes, reviewImport, reviewImportMahjong,
    mjLog: { readMahjongLog, reviewMahjongGame, tenhouUrlInfo }, coachFace: faceSVG, recordText };
})();

// ── js/core/play4.js ────────────────────────────────────────
const NS_PLAY4 = (() => {
  const M = NS_MAHJONG;
  const { Game, SEAT_JA } = NS_MJ4;
  const { cpuTurn, cpuCall, foldAdvice, reviewTurn, riichiPlayers, danger, riichiAdvice, callAdvice, placeAfterWin, allLastRiichi, allLastRiichiLine } = NS_MJAI;
  const { makeTally, showMjRecap, saveDiscardMistake, saveDealInMistake, saveWinMissMistake, openMahjongRoutes } = NS_PLAY;
  const K = NS_COACH;
  const { sfx } = NS_AUDIO;
  const { settings } = NS_SETTINGS;
  const { store } = NS_STORE;
  // play4.js — 4人打ちの対局画面。
  //
  // 麻雀卓の形（上＝対面、左＝上家、右＝下家、下＝自分）で4人ぶんの河を見せる。







  const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function playFour(ctx, { renderTiles, tileFace }) {
    const s = ctx.step;
    const rule = { naki: false, kan: false, aka: !!settings.get('aka'), ...(s.rule || {}) };
    const ME = 0;
    let game = new Game(rule);
    let busy = false, showDanger = s.showDanger !== false;
    // オーラスから始める練習（s.allLast）：南4局で、あなたは南家。点数の状況は、いくつかの中から選ぶ
    const ALL_LAST = [
      [27000, 31000, 22000, 20000], [33000, 28000, 22000, 17000], [19000, 33000, 25000, 23000],
      [24000, 26000, 27000, 23000], [30000, 29000, 21000, 20000], [22000, 36000, 23000, 19000],
    ];
    const setupAllLast = (g) => {
      if (!s.allLast) return g;
      g.round = 1; g.kyoku = 4; g.oya = 3; g.honba = 0; g.riichiSticks = 0;
      g.scores = [...ALL_LAST[(Math.random() * ALL_LAST.length) | 0]];
      return g;
    };
    setupAllLast(game);

    ctx.prompt(s.prompt || 'あなたは東家（下）です。1局打ってみましょう。');

    // ── 画面の骨組み：麻雀卓の形にする
    //   上＝対面、左＝上家、右＝下家、下＝自分。河が四方を囲む。
    const table = el('div', 'mjtable');
    const seatBox = {};
    const SEATS = [
      { p: 0, cls: 'me' }, { p: 1, cls: 'right' }, { p: 2, cls: 'across' }, { p: 3, cls: 'left' },
    ];
    for (const seat of SEATS) {
      const box = el('div', `mjseat mjseat--${seat.cls}`);
      const backs = el('div', 'mjbacks');
      const melds = el('div', 'mjmelds');
      const wrap = el('div', 'mjrwrap');
      const riv = el('div', 'mjr');
      wrap.appendChild(riv);
      box.append(backs, melds, wrap);
      seatBox[seat.p] = { box, riv, backs, melds, cls: seat.cls };
      table.appendChild(box);
    }
    const center = el('div', 'mjcenter');
    table.appendChild(center);

    const handWrap = el('div', 'mjhand');
    const status = el('p', 'note');
    const coachBox = el('div', 'coach');
    const bar = el('div', 'coachbar');
    const toggle = el('label', 'toggle');
    toggle.innerHTML = '<input type="checkbox" checked> コーチ（押し引きを教えます）';
    const dtoggle = el('label', 'toggle');
    dtoggle.innerHTML = `<input type="checkbox" ${showDanger ? 'checked' : ''}> 危険度を牌に表示`;
    bar.append(toggle, dtoggle);
    const recapBox = el('div', 'recap');
    ctx.mount.append(table, handWrap, status, bar, coachBox, recapBox);
    // オーラスの判断の記録（半荘が終わったら、まとめて見せる）
    const alBox = el('div', 'mji__albox');
    ctx.mount.appendChild(alBox);
    let allLastLog = [];
    let alCur = null;   // いまのオーラスの局の記録
    /** オーラスの局が始まったら、はじめの点数と順位を覚える（同じ局をやり直したら、前の記録を置きかえる） */
    const alStart = () => {
      if (!(game.isAllLast && game.isAllLast())) { alCur = null; return; }
      const label = game.kyokuLabel();
      const rec = { label, scores: [...game.scores], rank: game.standings().find((x) => x.i === ME).rank, entries: [], first: new Map() };
      const k = allLastLog.findIndex((x) => x.label === label);
      if (k >= 0) allLastLog[k] = rec; else allLastLog.push(rec);
      alCur = rec;
    };
    /** 判断を1つ記録する。よい判断・参考は、同じ種類の2回目からは数えるだけ */
    const alAdd = (e0) => {
      if (!alCur) return;
      const e = { more: 0, ...e0 };
      if ((e.lv === 'good' || e.lv === 'note') && e.sub) {
        const seen = alCur.first.get(e.sub);
        if (seen) { seen.more++; return; }
        alCur.first.set(e.sub, e);
      }
      alCur.entries.push(e);
    };
    /** 1打の講評から、オーラスの判断（押し引き・リーチ判断）を記録する */
    const alFromReview = (review, n, hand, tile) => {
      const l = review.lines.find((x) => x.sub && x.sub.startsWith('allLast'));
      if (!l) return;
      const flagged = l.sub === 'allLast';
      const cat = l.kind === 'riichi' || l.sub === 'allLastDama' || l.sub === 'allLastTradeoff' ? 'リーチ判断' : '押し引き';
      const lv = flagged ? (review.level === 'ok' ? 'miss' : review.level) : l.sub === 'allLastTradeoff' ? 'note' : 'good';
      alAdd({ cat, lv, text: l.what, n, hand, tile, sub: flagged ? null : l.sub });
    };
    /** 半荘が終わったときの「オーラスの判断」 */
    function showAllLastPanel(place) {
      alBox.innerHTML = '';
      if (!allLastLog.length) return;
      const fmt = (v) => Number(v).toLocaleString('ja-JP');
      const box = el('div', 'gsum mji__al');
      box.appendChild(el('h3', '', 'オーラスの判断'));
      const view = el('div');
      const vnote = el('p', 'recap__note');
      if (allLastLog.some((ar) => ar.entries.some((e) => e.hand))) vnote.textContent = '行を押すと、そのときの手牌がここに出ます。';
      for (const ar of allLastLog) {
        const sc = ar.scores, r = ar.rank;
        const order = [0, 1, 2, 3].map((i) => ({ i, v: sc[i] })).sort((a, b) => b.v - a.v || a.i - b.i);
        const at = (k) => order[k - 1].i;
        // 同点なら、起家に近い席が上（「0点差」とは書かない）
        const gu = r > 1 ? sc[at(r - 1)] - sc[ME] : 0, gd = r < 4 ? sc[ME] - sc[at(r + 1)] : 0;
        const upName = r === 2 ? 'トップ' : `${r - 1}位`;
        const up = r > 1 ? (gu ? `${upName}まで${fmt(gu)}点` : `${upName}と同点（席順で下）`) : '';
        const down = r < 4 ? (gd ? `${r + 1}位とは${fmt(gd)}点差` : `${r + 1}位と同点（席順で上）`) : '';
        box.appendChild(el('p', 'mji__alh', `<b>${ar.label}</b>　はじめは${r}位（${fmt(sc[ME])}点）。${[up, down].filter(Boolean).join('、')}。`));
        if (!ar.entries.length) box.appendChild(el('p', 'mji__alnone', 'この局では、順位にかかわる判断の場面はありませんでした。'));
        for (const e of ar.entries) {
          const b = el('button', 'mji__alrow');
          b.type = 'button';
          const lvJa = { blunder: '大きな悪手', miss: '悪手', good: 'よい判断', note: '参考' }[e.lv] || '参考';
          b.innerHTML = `<span class="imp__lv" data-lv="${e.lv}">${lvJa}</span><span class="mji__alc">${e.cat}${e.n ? `（${e.n}巡目）` : ''}</span>`
            + `<span class="mji__alt">${e.text}${e.more ? `（このあとも同じ場面が${e.more}回）` : ''}</span>`;
          // 押すと、そのときの手牌を出す
          if (e.hand) {
            b.addEventListener('click', () => {
              const tiles = e.winHand ? [...e.hand] : e.win ? [...M.sortTiles(e.hand), e.tile] : [...e.hand];
              const states = {};
              const k = e.win && !e.winHand ? tiles.length - 1 : tiles.indexOf(e.tile);
              if (k >= 0) states[k] = e.win ? 'ok' : 'ng';
              renderTiles(view, tiles, { states, disabled: true, tight: true });
              vnote.innerHTML = `${ar.label}${e.n ? `・${e.n}巡目` : ''}　`
                + (e.win ? '<span style="color:var(--ok)">■</span> アガリ牌' : '<span style="color:var(--ng)">■</span> 切った牌');
              view.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            });
          }
          box.appendChild(b);
        }
        if (ar.result) {
          const mv = ar.endRank == null ? '' : ar.endRank === r ? `あなたは${r}位のまま。` : `あなたは${r}位から${ar.endRank}位に。`;
          box.appendChild(el('p', 'mji__alnone', `この局の結果：${ar.result}。${mv}`));
        }
      }
      box.appendChild(el('p', 'mji__alres', `結果：<b>${place}位</b>（${fmt(game.scores[ME])}点）で終わりました。`));
      box.append(view, vnote);
      alBox.appendChild(box);
    }
    let tally = null;       // この局の講評の集計
    let items = [];         // 振り返り用：指摘した切り方
    let lastMine = null;    // 自分の直前の打牌（放銃したときの振り返り用）
    // 成績（和了率・放銃率など）。同じ局をやり直しても、数えるのは最初の1回だけ。着順は半荘を最後まで打ったときだけ
    let counted = new Set(), rankDone = false, myRiichi = false;
    const LV = { ok: 0, miss: 1, blunder: 2 };
    const worse = (a, b) => (LV[a] >= LV[b] ? a : b);

    dtoggle.querySelector('input').addEventListener('change', (e) => { showDanger = e.target.checked; paint(); });
    toggle.querySelector('input').addEventListener('change', (e) => { if (!e.target.checked) coachBox.innerHTML = ''; });
    const coachOn = () => toggle.querySelector('input').checked;

    const showCoach = (review) => {
      if (!coachOn() || !review || !review.lines.length) { coachBox.innerHTML = ''; return; }
      const d = settings.get('coachDetail');
      coachBox.dataset.level = review.level;
      coachBox.innerHTML = review.lines.slice(0, 2).map((l) => {
        const p = [`<b>${l.what}</b>`];
        if (d !== 'short' && l.why) p.push(`<span>${l.why}</span>`);
        if (d !== 'short' && l.better) p.push(`<span class="coach__better">こうすれば：${l.better.label} — ${l.better.reason}</span>`);
        if (d === 'deep' && l.lesson) p.push(`<span class="coach__lesson">${l.lesson}</span>`);
        return `<div class="coach__line">${p.join('')}</div>`;
      }).join('');
      if (review.replay) {
        const acts = el('div', 'coach__acts');
        const b = el('button', 'btn btn--ghost btn--sm', review.replay.label || '▶ 読み筋を見る');
        b.addEventListener('click', () => openMahjongRoutes(review.replay, b));
        acts.appendChild(b);
        coachBox.appendChild(acts);
      }
    };

    // ── 描画
    function paintCenter() {
      const dora = game.doraTile();
      const seatCell = (p) => {
        const cls = p === ME ? 'me' : p === 1 ? 'right' : p === 2 ? 'across' : 'left';
        return `<div class="mjc__s mjc__s--${cls} ${game.turn === p && game.phase !== 'end' ? 'is-turn' : ''}">
          <b>${game.seatJa(p)}</b><span>${game.scores[p].toLocaleString()}</span>
          ${game.riichi[p] ? '<i class="mjstick"></i>' : ''}
        </div>`;
      };
      center.innerHTML = `
        ${[0, 1, 2, 3].map(seatCell).join('')}
        <div class="mjc__mid">
          <div class="mjc__k">${game.kyokuLabel()}</div>
          <div class="mjc__dora">${dora ? (game.doraInds || [game.dora]).map((t) => `<span class="tile tile--mini">${tileFace(t)}</span>`).join('') : ''}</div>
          <div class="mjc__w">残 ${game.wall.length}${game.riichiSticks ? ` / 供託${game.riichiSticks}` : ''}</div>
        </div>`;
    }

    function paintSeat(p) {
      const b = seatBox[p];
      b.box.dataset.riichi = game.riichi[p] ? '1' : '';
      b.box.dataset.turn = (game.turn === p && game.phase !== 'end') ? '1' : '';
      // 相手の手牌は裏向きで枚数だけ見せる
      if (p === ME) { b.backs.innerHTML = ''; } else {
        const n = game.hands[p].length + (game.turn === p && game.drawn ? 1 : 0);
        b.backs.innerHTML = Array.from({ length: n }, () => '<i></i>').join('');
      }
      b.melds.innerHTML = game.melds[p].map((m) =>
        `<span class="mjmeld" aria-label="${m.type === 'ankan' ? '暗槓' : m.type === 'kakan' ? '加槓' : m.type === 'kan' ? '明槓' : m.type === 'pon' ? 'ポン' : 'チー'}">${m.tiles.map((t, i) =>
          m.type === 'ankan' && (i === 0 || i === 3)
            ? '<span class="tile tile--mini tile--back"></span>'
            : `<span class="tile tile--mini">${tileFace(t)}</span>`).join('')}</span>`).join('');
      // 直前に置かれた1枚だけアニメーションさせる。全部動くとうるさい
      const last = game.discards[p].length - 1;
      b.riv.innerHTML = game.discards[p].map((d, i) =>
        `<span class="tile tile--mini ${d.riichi ? 'is-riichi' : ''} ${d.called ? 'is-called' : ''}${
          i === last && game.lastDiscard?.p === p ? ' is-new' : ''}">${tileFace(d.tile)}</span>`).join('');
    }

    function paintHand() {
      // リーチする牌を選んでいる途中なら、その表示のまま描き直す（危険度の表示を切り替えたときなど）
      if (riichiMode) { paintRiichiHand(); return; }
      const hand = M.sortTiles(game.hands[ME]);
      const drawn = game.turn === ME ? game.drawn : null;
      const tiles = drawn ? [...hand, drawn] : hand;
      const threats = riichiPlayers(game, ME);
      const states = {};
      if (showDanger && threats.length) {
        tiles.forEach((t, i) => {
          const d = Math.max(...threats.map((q) => danger(game, t, q)));
          states[i] = d === 0 ? 'safe' : d >= 9 ? 'risk' : d >= 6 ? 'warn' : 'mid';
        });
      }
      // リーチ中はツモ牌（右端）以外を薄くする
      if (game.riichi[ME] && drawn) tiles.forEach((_, i) => { if (i < tiles.length - 1) states[i] = 'dim'; });
      // 鳴いた直後は、喰い替えになる牌を薄くする
      if (game.turn === ME && game.phase === 'discard') tiles.forEach((t, i) => { if (!game.canDiscard(ME, t)) states[i] = 'dim'; });
      handWrap.innerHTML = '';
      const box = el('div');
      handWrap.appendChild(box);
      renderTiles(box, tiles, {
        states,
        disabled: busy || game.phase !== 'discard' || game.turn !== ME,
        onPick: (i, t) => onDiscard(t),
      });
      if (drawn) {
        const kids = box.querySelectorAll('.tile');
        if (kids.length) kids[kids.length - 1].classList.add('tile--drawn');
      }
    }

    const paint = () => { paintCenter(); [0, 1, 2, 3].forEach(paintSeat); paintHand(); };

    // ── 進行
    // restart や次の局で古いループを止めるための番号。await をまたいだら必ず確かめる
    let runId = 0;

    async function loop() {
      const my = runId;
      let guard = 0;
      while (game.phase !== 'end' && guard++ < 400) {
        if (my !== runId || !ctx.alive()) return;
        if (game.phase === 'draw') {
          game.draw();
          if (game.phase === 'end') break;
          if (game.turn === ME) { paint(); return myTurn(); }
          continue;
        }
        if (game.phase === 'discard') {
          // 鳴き・カンのあとで自分の手番になったとき
          if (game.turn === ME) { paint(); return myTurn(); }
          // 九種九牌：国士無双を狙えるほど（11種以上）でなければ流す
          if (game.kyuushuOk(game.turn) && game.yaochuKinds(game.turn) <= 10) {
            tell(`${game.seatJa(game.turn)}家が九種九牌で流しました。`);
            game.kyuushu(game.turn);
            break;
          }
          const a = cpuTurn(game, game.turn);
          if (a.action === 'tsumo') { game.tsumo(); break; }
          if (a.action === 'kan') {
            await wait(260);
            if (my !== runId || !ctx.alive()) return;
            game.selfKan(game.turn, a.type, a.tile);
            sfx.place('mahjong');
            tell(`${game.seatJa(game.turn)}家が${a.type === 'ankan' ? '暗槓' : '加槓'}しました。`);
            paint();
            continue;   // 槍槓の確認（call）か、嶺上牌を引いたあとの打牌（discard）へ
          }
          await wait(260);
          if (my !== runId || !ctx.alive()) return;
          game.discard(a.tile, { riichi: a.riichi });
          sfx.place('mahjong');
          if (a.riichi) tell(`${game.seatJa(game.lastDiscard.p)}家がリーチ！`);
          paint();
          await wait(180);
          if (my !== runId || !ctx.alive()) return;
          continue;
        }
        if (game.phase === 'call') {
          const r = resolveCalls(false);
          if (r === 'me') return;
          if (r === 'ended') break;
          continue;
        }
        break;
      }
      if (my !== runId || !ctx.alive()) return;
      paint();
      finish();
    }

    /**
     * 捨て牌に対する鳴き・ロンを優先順位どおりに裁く。
     * ロン（頭ハネ：捨てた人から近い順）＞ ポン・カン ＞ チー。
     * 戻り値: 'me' 自分に選ばせる / 'ended' 局が終わった / 'continue' 次へ
     */
    function resolveCalls(mePassed) {
      const pending = game.pending || [];
      const order = (p) => (p - game.lastDiscard.p + 4) % 4;
      const rons = pending.filter((c) => c.type === 'ron').sort((a, b) => order(a.p) - order(b.p));
      const mine = pending.filter((c) => c.p === ME);
      // 頭ハネ：捨てた人から近い順で、最初にロンできる人だけがあがれる
      if (!mePassed && rons.length && rons[0].p === ME) { paint(); offerCalls(mine); return 'me'; }
      const cpuRon = rons.find((c) => c.p !== ME);
      if (cpuRon) { game.ron(cpuRon.p, cpuRon.tile); return 'ended'; }

      const cpuWants = pending.filter((c) => c.p !== ME && c.type !== 'ron' && cpuCall(game, c));
      const cpuPon = cpuWants.find((c) => c.type === 'pon' || c.type === 'kan');
      if (cpuPon) { game.call(cpuPon.p, cpuPon.type, cpuPon.tile, cpuPon.pat); paint(); return 'continue'; }
      const myCalls = mine.filter((c) => c.type !== 'ron');
      if (!mePassed && myCalls.length) { paint(); offerCalls(myCalls); return 'me'; }
      const cpuChi = cpuWants.find((c) => c.type === 'chi');
      if (cpuChi) { game.call(cpuChi.p, cpuChi.type, cpuChi.tile, cpuChi.pat); paint(); return 'continue'; }
      game.passCalls();
      return 'continue';
    }

    function tell(t) { status.textContent = t; }

    function myTurn() {
      paint();
      const acts = [];
      if (game.canTsumo(ME)) {
        acts.push({ label: 'ツモ！', variant: 'tone', onClick: () => { runId++; game.tsumo(ME); paint(); finish(); } });
      }
      if (game.kyuushuOk(ME)) {
        acts.push({ label: '九種九牌で流す', variant: 'ghost', onClick: () => {
          if (busy || !game.kyuushuOk(ME)) return;
          runId++; game.kyuushu(ME); paint(); finish();
        } });
      }
      const rOpts = game.riichiOptions(ME);
      if (rOpts.length) {
        acts.push({
          label: 'リーチ', variant: 'ghost', onClick: () => {
            tell('リーチする牌を選んでください（下線のある牌）。');
            riichiMode = true;
            paintRiichi(rOpts);
          },
        });
      }
      for (const k of game.kanOptions(ME)) {
        acts.push({
          label: `${k.type === 'ankan' ? '暗槓' : '加槓'}（${M.tileName(k.tile)}）`, variant: 'ghost',
          onClick: async () => {
            if (busy || game.phase !== 'discard' || game.turn !== ME) return;
            game.selfKan(ME, k.type, k.tile);
            sfx.place('mahjong');
            paint();
            if (game.phase === 'call') {
              // 槍槓できる人がいる
              const r = resolveCalls(true);
              if (r === 'ended') { paint(); finish(); return; }
              return loop();
            }
            myTurn();   // 嶺上牌を引いたので、そのまま切る（嶺上開花ならツモできる）
          },
        });
      }
      acts.push(...redoActions());
      ctx.actions(acts);

      // 押し引きの助言は、切る「前」に出すのが要点。
      // 助言が無い場面では、直前の講評を残す（消すと読む間もなく消える）
      if (coachOn() && !game.riichi[ME]) {
        // リーチがかかっていれば押し引き、なければリーチするかの助言
        const adv = foldAdvice(game, ME) || riichiAdvice(game, ME);
        if (adv) showCoach(adv);
      }
      const threats = riichiPlayers(game, ME);
      if (game.kuikae?.p === ME) tell(`鳴いた直後は、喰い替えになる牌（${game.kuikae.ban.map(M.tileName).join('・')}）は切れません。薄くなっている牌です。`);
      else if (game.riichi[ME]) tell('リーチ中です。ツモった牌をそのまま切ります（あがれるときはツモ）。');
      else tell(threats.length
        ? `${threats.map((p) => game.seatJa(p) + '家').join('と')}がリーチ中。切る牌を選んでください。`
        : '切る牌を選んでください。');
    }

    let riichiMode = false, riichiOpts = [];
    function paintRiichi(opts) {
      riichiMode = true;
      riichiOpts = opts;
      paintRiichiHand();
      ctx.actions([
        { label: 'リーチをやめる', variant: 'ghost', onClick: () => { riichiMode = false; myTurn(); } },
      ]);
    }
    function paintRiichiHand() {
      const opts = riichiOpts;
      const tiles = M.sortTiles([...game.hands[ME], ...(game.drawn ? [game.drawn] : [])]);
      const states = {};
      tiles.forEach((t, i) => { if (opts.includes(t)) states[i] = 'on'; });
      handWrap.innerHTML = '';
      const box = el('div'); handWrap.appendChild(box);
      renderTiles(box, tiles, {
        states,
        onPick: (i, t) => {
          if (!opts.includes(t)) { tell('その牌ではテンパイになりません。'); return; }
          riichiMode = false;
          onDiscard(t, true);
        },
      });
    }

    async function onDiscard(tile, riichi = false) {
      if (busy || game.phase !== 'discard' || game.turn !== ME) return;
      if (game.riichi[ME] && game.drawn && tile !== game.drawn) {
        tell('リーチ中は、ツモった牌（右端）しか切れません。');
        return;
      }
      if (!game.canDiscard(ME, tile)) {
        tell(`${M.tileName(tile)}は切れません。鳴いた直後に、鳴いた牌と同じ牌（チーなら筋の反対側も）を切るのは「喰い替え」という反則です。`);
        return;
      }
      busy = true;
      const before = M.sortTiles([...game.hands[ME], ...(game.drawn ? [game.drawn] : [])]);
      const sets = game.setsNeeded(ME);
      // 役のないテンパイでリーチしなかったか（切る前に調べる）
      let riichiMiss = null;
      if (!riichi && !game.riichi[ME] && game.riichiOptions(ME).includes(tile)) {
        const rest = [...before]; rest.splice(rest.indexOf(tile), 1);
        const ws = M.waits(M.sortTiles(rest), sets);
        const yaku = ws.some((w) => M.judgeYaku(M.sortTiles([...rest.map(M.norm), w]), {
          menzen: true, seatWind: game.seatWind(ME), roundWind: game.roundWind(), winTile: w, melds: game.meldsFor(ME),
        }).length > 0);
        // フリテンの待ちなら、リーチしてもロンできない。リーチしない判断を「見逃し」とは言えない
        const own = new Set([...game.discards[ME].map((d) => M.norm(d.tile)), M.norm(tile)]);
        const furiten = ws.some((w) => own.has(w));
        if (!yaku && !furiten) {
          riichiMiss = { kind: 'riichi', what: '役のないテンパイなのに、リーチしませんでした。',
            why: 'この形はリーチしないとロンであがれません（ツモなら門前清自摸和という役がつきます）。',
            lesson: '役のないテンパイは、リーチが役の代わりになります。' };
        }
      }
      // オーラス：リーチかダマかを着順で見る（切る前の点数で。フリテンの待ちは見ない）
      let alRiichi = null;
      if (game.isAllLast && game.isAllLast() && !game.riichi[ME] && game.riichiOptions(ME).includes(tile)) {
        const rest = [...before]; rest.splice(rest.indexOf(tile), 1);
        const own = new Set([...game.discards[ME].map((d) => M.norm(d.tile)), M.norm(tile)]);
        if (!M.waits(M.sortTiles(rest), sets).some((w) => own.has(w))) {
          const al = { scores: game.scores, oya: game.oya, honba: game.honba, pot: game.riichiSticks, first: 0, target: 0, yame: false };
          alRiichi = allLastRiichiLine(allLastRiichi(game, ME, al, M.sortTiles(rest)), riichi, '位');
          if (alRiichi?.drop) riichiMiss = null;
        }
      }
      // 鳴いた直後に、喰い替えで切れない牌（講評で勧めない）。discard で消えるので先に覚える
      const banned = game.kuikae && game.kuikae.p === ME ? [...game.kuikae.ban] : null;
      // ツモあがりできたのに切った（切る前に調べる。リーチ後のツモ切りでも見る）
      const drawnNow = game.drawn;
      let winMiss = drawnNow && game.canTsumo(ME) ? { kind: 'agarimiss', what: `${M.tileName(drawnNow)}をツモった時点で、あがれる形でした。`,
        why: 'あがれるときは「ツモ！」を押します。あがらずに切ると、その局のアガリを捨てることになります。',
        lesson: 'ツモったら、まず「あがれる形か」を確かめます。', d: { tile: M.tileName(drawnNow) } } : null;
      // オーラス：あがっても着順が変わらずに終わるなら、見送って高い手を狙うのも1つの考え方
      if (winMiss && game.isAllLast && game.isAllLast()) {
        const y = game.yakuOf(ME, drawnNow, true);
        const j = placeAfterWin(game.scores, { me: ME, oya: game.oya, honba: game.honba, pot: game.riichiSticks, han: y.han, fu: y.fu, tsumo: true, first: 0, target: 0 });
        if (j.ends && j.after === j.before && j.after > 1) {
          winMiss = { kind: 'good', ok: true, what: `${M.tileName(drawnNow)}であがれましたが、あがっても${j.after}位のまま終わる場面でした。`,
            why: '着順を上げるには、もっと高いアガリが必要です。オーラスでは、着順の変わらないアガリを見送って高い手を狙う考え方もあります。',
            lesson: '' };
        } else if (j.ends) {
          winMiss.why += j.after < j.before ? `あがれば${j.before}位から${j.after}位に上がって終わっていました。` : 'あがればトップのまま終わっていました。';
        } else {
          winMiss.why += '親なので、あがれば終わらずに続けられました（連荘）。';
        }
      }
      const closedNow = winMiss ? (() => { const r = [...before]; r.splice(r.indexOf(drawnNow), 1); return r; })() : null;
      game.discard(tile, { riichi });
      if (riichi && game.riichi[ME]) myRiichi = true;   // 宣言牌で放銃して立直が取り消されても、立直した局に数える
      sfx.place('mahjong');
      lastMine = { before, tile, n: game.discards[ME].length };

      // 講評：押し引きがあるならそちら、なければ受け入れ＋ドラ・役（リーチ後のツモ切りは、アガリの見逃しだけ見る）
      const postRiichi = game.riichi[ME] && !riichi;
      if (!postRiichi || winMiss) {
        let review = postRiichi ? { level: 'ok', lines: [] } : reviewTurn(game, ME, before, tile, { banned });
        const eff = review.lines.find((l) => l.kind === 'shanten' || l.kind === 'narrow');
        if (eff && eff.better?.tile && eff.better.tile !== tile) {
          review = { ...review, replay: { label: '▶ テンパイまでの道筋を見る', hand: [...before], tile, best: eff.better.tile, sets, seen: [], poolTotal: 136 } };
        }
        if (riichiMiss) { review = { ...review, lines: [riichiMiss, ...review.lines], level: worse(review.level, 'miss') }; }
        if (alRiichi) { review = { ...review, lines: [alRiichi.line, ...review.lines], level: alRiichi.level === 'miss' ? worse(review.level, 'miss') : review.level }; }
        // アガリを見逃したときは、その話だけにする（受け入れやリーチの指摘は重なるので出さない。押し引きは残す）
        const forSave = winMiss ? { level: 'ok', lines: [] } : review;
        if (winMiss?.ok) {
          const keep = review.lines.filter((x) => x.kind === 'push' || x.kind === 'safe');
          review = { ...review, lines: [winMiss, ...keep], level: keep.some((x) => x.kind === 'push') ? review.level : 'ok', replay: null };
        } else if (winMiss) {
          review = { ...review, lines: [winMiss, ...review.lines.filter((x) => x.kind === 'push' || x.kind === 'safe')], level: 'blunder', replay: null };
          saveWinMissMistake(closedNow, sets, drawnNow, { tsumo: true });
        }
        tally.add(review);
        const l = review.lines[0];
        if (review.level !== 'ok' && l) {
          items.push({ n: game.discards[ME].length, hand: before, tile, better: l.better?.tile, level: review.level, line: l,
            replay: review.replay || null });
          saveDiscardMistake(forSave, before, sets);
        }
        if (coachOn()) showCoach(review);
        // オーラスの判断を記録する（押し引き・リーチ判断、ツモの見逃し・見送り）
        alFromReview(review, game.discards[ME].length, before, tile);
        if (winMiss && alCur) {
          alAdd({ cat: winMiss.ok ? 'アガリの見送り' : 'アガリの見逃し', lv: winMiss.ok ? 'good' : 'blunder', text: winMiss.what,
            n: game.discards[ME].length, hand: closedNow, tile: drawnNow, win: true });
        }
      }
      paint();
      ctx.actions(redoActions());
      busy = false;
      const my = runId;
      await wait(500);
      if (my !== runId || !ctx.alive()) return;
      await loop();
    }

    function offerCalls(mine) {
      const ron = mine.find((c) => c.type === 'ron');
      const acts = [];
      let decided = false;   // 連打で2回実行されないように
      if (ron) acts.push({ label: 'ロン！', variant: 'tone', onClick: () => {
        if (decided || game.phase !== 'call') return;
        decided = true; runId++; game.ron(ME, ron.tile); paint(); finish();
      } });
      for (const c of mine.filter((x) => x.type !== 'ron')) {
        const label = c.type === 'pon' ? 'ポン' : c.type === 'kan' ? 'カン'
          : `チー（${c.pat.map(M.tileName).join('')}）`;
        acts.push({
          label,
          variant: 'ghost',
          onClick: () => {
            if (decided || game.phase !== 'call') return;
            decided = true;
            // 役の道筋がない鳴きは、弱点の記録に残す（助言は鳴く前に出している）
            if (callAdvice(game, ME, c).level !== 'ok') tally.bump('nakiyaku');
            game.call(ME, c.type, c.tile, c.pat); paint();
            // ポン・チーはそのまま切る。大明槓は嶺上牌を引いてから切る
            myTurn();
          },
        });
      }
      acts.push({
        label: 'パス', variant: 'ghost', onClick: async () => {
          if (decided || game.phase !== 'call') return;
          decided = true;
          ctx.actions([]);
          if (ron) {
            // 見逃し：次に自分が切るまでロンできない（リーチ中なら局の終わりまで）
            game.tempFuriten[ME] = true;
            if (game.riichi[ME]) game.riichiFuriten[ME] = true;
            // オーラス：ロンを見送ったのは、順位で見て正しかったか
            if (alCur) {
              const y = game.yakuOf(ME, ron.tile, false);
              const j = placeAfterWin(game.scores, { me: ME, oya: game.oya, honba: game.honba, pot: game.riichiSticks, han: y.han, fu: y.fu, tsumo: false, from: game.lastDiscard.p, first: 0, target: 0 });
              const ok = j.ends && j.after === j.before && j.after > 1;
              alAdd({ cat: ok ? 'アガリの見送り' : 'アガリの見逃し', lv: ok ? 'good' : 'blunder',
                text: ok ? `${M.tileName(ron.tile)}のロンを見送りました。あがっても${j.after}位のまま終わる場面でした。`
                  : `${M.tileName(ron.tile)}でロンできました。${j.ends ? (j.after < j.before ? `あがれば${j.before}位から${j.after}位に上がって終わっていました。` : 'あがればトップのまま終わっていました。') : '親なので、あがれば続けられました（連荘）。'}`,
                // 何巡目か：この巡で、自分がまだ切っていなければ次の巡
                n: game.discards[ME].length + ((game.lastDiscard.p - game.oya + 4) % 4 < (ME - game.oya + 4) % 4 ? 1 : 0),
                hand: [...game.hands[ME]], tile: ron.tile, win: true });
            }
          }
          const r = resolveCalls(true);
          if (r === 'ended') { paint(); finish(); return; }
          await loop();
        },
      });
      ctx.actions(acts);
      tell(ron ? `${M.tileName(ron.tile)}が出ました。ロンできます。` : `${M.tileName(mine[0].tile)}が出ました。鳴けます。`);
      if (!ron && coachOn()) {
        const c = mine.find((x) => x.type === 'pon') || mine[0];
        showCoach(callAdvice(game, ME, c));
      }
      if (ron && coachOn()) {
        showCoach({ level: 'ok', lines: [{
          kind: 'ron', what: `${M.tileName(ron.tile)}であがれます。`,
          why: game.riichi[ME]
            ? '見逃すとフリテンになり、リーチ中なのでこの局はもうロンできません（ツモならあがれます）。'
            : '見逃すとフリテンになり、次に自分が牌を切るまでロンできません。',
          lesson: '',
        }] });
      }
    }

    /** この局を成績に数える（局ごとに最初の1回だけ） */
    function countKyoku(r) {
      const key = game.kyokuLabel();
      if (counted.has(key)) return;
      counted.add(key);
      const win = r.kind === 'win' && r.winner === ME;
      const dealin = r.kind === 'win' && !r.tsumo && r.from === ME;
      let value = 0;
      if (r.kind === 'win') {
        const oya = game.isOya(r.winner);
        if (r.tsumo) { const t = M.tsumoPoints(r.han, r.fu, oya); value = oya ? t.fromKo * 3 : t.fromKo * 2 + t.fromOya; }
        else value = M.ronPoints(r.han, r.fu, oya);
      }
      store.recordMjKyoku({ win, tsumo: win && !!r.tsumo, gain: win ? value : 0, dealin, loss: dealin ? value + game.honba * 300 : 0,
        riichi: myRiichi, furo: game.melds[ME].some((m) => m.type !== 'ankan') });
    }

    function finish() {
      const r = game.result;
      if (!r) return;
      countKyoku(r);
      tell(r.kind === 'win' ? `${r.winner === ME ? 'あなた' : `${game.seatJa(r.winner)}家`}のあがりです。` : '');
      // この局で半荘が終わるなら、「次の局」ではなく結果へ進む
      const gameEnds = game.endsAfterThis();
      const nextLabel = gameEnds ? '半荘の結果を見る' : '次の局へ';
      const others = [
        { label: nextLabel, variant: 'tone', onClick: nextHand },
        // 放銃した局などを、同じ牌で打ち直して試せるようにする
        { label: '同じ配牌でもう一度', variant: 'ghost', onClick: () => restart(true) },
        // 勝てなかった局で先へ進むときは「一発正解」には数えない
        { label: '次へ進む', variant: 'ghost', onClick: () => { ctx.miss(); ctx.solved(); ctx.advance(); } },
      ];
      // この局の記録と振り返り
      const dealInNow = r.kind === 'win' && !r.tsumo && r.from === ME;
      if (dealInNow && lastMine) {
        tally.bump('dealin');
        const threats = riichiPlayers(game, ME);
        // リーチが入っていた場面なら、同じ捨て牌から安全牌を選ぶ問題にして残す
        if (threats.length) saveDealInMistake(game.discards[threats[0]].map((d) => d.tile), lastMine.before, lastMine.tile);
        items.push({ n: lastMine.n, hand: lastMine.before, tile: lastMine.tile, better: null, level: 'blunder',
          line: { what: `${M.tileName(lastMine.tile)}で放銃しました。`,
            why: threats.length ? 'リーチが入っていた場面です。手が遠いなら、現物（リーチした人の捨て牌）から切って降ります。'
              : 'リーチのない相手（ダマテン）への放銃は防ぎにくいものです。相手が鳴いて手を進めているときは、その人の捨て牌の近くに注意します。' } });
      }
      // オーラスで、あがっても4位のまま半荘が終わった（アガリラス）。親のアガリは連荘なので終わらない
      const lastAgari = r.kind === 'win' && r.winner === ME && game.isAllLast && game.isAllLast() && !game.isOya(ME)
        && game.standings().find((x) => x.i === ME).rank === 4;
      if (lastAgari) tally.bump('agarirasu');
      // オーラスの記録：放銃・アガリ（順位の動き）と、局の結果
      if (alCur && r) {
        const nowRank = game.standings().find((x) => x.i === ME).rank;
        if (dealInNow && lastMine) alAdd({ cat: '放銃', lv: 'note', text: `${M.tileName(lastMine.tile)}で放銃しました。`, n: lastMine.n, hand: lastMine.before, tile: lastMine.tile });
        if (r.kind === 'win' && r.winner === ME) {
          if (lastAgari) alAdd({ cat: 'アガリラス', lv: 'miss', text: 'このアガリで半荘が終わり、4位のままでした（アガリラス）。', hand: r.hand, tile: r.tile, win: true, winHand: true });
          else if (nowRank < alCur.rank) alAdd({ cat: 'アガリ', lv: 'good', text: `あがって、${alCur.rank}位から${nowRank}位に上がりました。`, hand: r.hand, tile: r.tile, win: true, winHand: true });
        }
        alCur.endRank = nowRank;
        alCur.result = r.kind === 'win'
          ? `${r.winner === ME ? 'あなた' : `${game.seatJa(r.winner)}家`}が${r.tsumo ? 'ツモ' : `${r.from === ME ? 'あなた' : `${game.seatJa(r.from)}家`}からロン`}（${r.label}）`
          : r.abort ? '途中流局' : '流局';
      }
      tally.flush();
      showMjRecap(recapBox, items, renderTiles, openMahjongRoutes);
      if (r.kind === 'draw' && r.abort) {
        const why = r.abort === 'kyuushu'
          ? `${r.by === ME ? 'あなた' : `${game.seatJa(r.by)}家`}が九種九牌を宣言しました（最初のツモで幺九牌が9種類以上）。`
          : r.abort === 'suufon' ? `1巡目に4人とも同じ風牌（${M.tileName(r.tile)}）を切ったので、四風連打で流局です。`
            : r.abort === 'suucha' ? '4人ともリーチしたので、四家立直で流局です。出ているリーチ棒は場に残り、次にあがった人がもらいます。'
              : '2人以上で合わせて4回カンをしたので、四開槓で流局です。';
        tell('途中流局です。');
        ctx.say(`<b>途中流局</b>${why}点棒は動かず、親はそのまま続きます。`);
        ctx.actions(others);
        return;
      }
      if (r.kind === 'draw') {
        const mine = r.tenpai[ME];
        // ノーテン罰符（テンパイの人数で、合計3000点をやりとりする）と、親が続くかどうか
        const who = (p) => (p === ME ? 'あなた' : `${game.seatJa(p)}家`);
        const ten = [0, 1, 2, 3].filter((p) => r.tenpai[p]);
        const pay = ten.length && ten.length < 4
          ? `テンパイは${ten.map(who).join('・')}。ノーテンの人が${(3000 / (4 - ten.length)).toLocaleString()}点ずつ払い、テンパイの人が${(3000 / ten.length).toLocaleString()}点ずつ受け取りました（ノーテン罰符）。`
          : ten.length ? '全員テンパイなので、点棒は動きません。' : '全員ノーテンなので、点棒は動きません。';
        const oyaStays = r.tenpai[game.oya];
        const next = game.endsAfterThis() ? '' : `親の${who(game.oya)}は${oyaStays ? 'テンパイなので親を続けます' : 'ノーテンなので親が次の人へ移ります'}（本場が1つ増えます）。`;
        tell('流局しました。');
        ctx.say(`<b>流局</b>${mine ? 'あなたはテンパイでした。' : 'あなたはテンパイしていませんでした。'}<br><span class="note">${pay}${next}</span>`,
          mine ? 'ok' : 'ng');
        ctx.actions(others);
        return;
      }
      const who = r.winner === ME ? 'あなた' : `${game.seatJa(r.winner)}家`;
      const yaku = [...r.list.map((k) => M.YAKU_JA[k]?.ja).filter(Boolean), ...(r.extras || [])].join('・');
      // 役満は翻と符を出さない（13翻とみなして数えているだけなので）
      const hanText = r.yakuman ? '役満' : `${r.han}翻${r.fu}符${M.basePoints(r.han, r.fu) >= 2000 ? ` ${r.label}` : ''}`;
      const meldHtml = (r.melds || []).map((m) =>
        `<span class="mjmeld">${m.tiles.map((t) => `<span class="tile">${tileFace(t)}</span>`).join('')}</span>`).join('');
      const uraHtml = r.riichiWin && r.uraShown?.length && !r.yakuman
        ? `<div class="mjura"><span>裏ドラ表示牌</span>${r.uraShown.map((t) => `<span class="tile tile--mini">${tileFace(t)}</span>`).join('')}`
          + `<span>${r.ura ? `→ 裏ドラ${r.ura}枚（${r.ura}翻）` : '→ 乗りませんでした'}</span></div>`
        : '';
      const handHtml = `<div class="tiles tiles--tight" style="margin-top:.5rem">${
        r.hand.map((t) => `<span class="tile">${tileFace(t)}</span>`).join('')}${meldHtml}</div>${uraHtml}`;
      if (r.winner === ME) {
        sfx.finish();
        ctx.solved(`<b>あがりました</b>${yaku}（${hanText}）${r.gain.toLocaleString()}点${handHtml}`);
        if (lastAgari && coachOn()) {
          showCoach({ level: 'miss', lines: [{ kind: 'agarirasu', what: 'このアガリで半荘が終わり、4位のままでした（アガリラス）。',
            why: 'オーラスのラス目は、ラスを抜けられる点数のアガリを狙い、届かないアガリは見送る考え方があります。',
            lesson: 'オーラスは「あがったら何位で終わるか」を先に計算します。' }] });
        }
        // 次の局も打てるようにしておく（このアガリで半荘が終わるなら、結果を先に見せる）
        ctx.actions(gameEnds ? [
          { label: nextLabel, variant: 'tone', onClick: nextHand },
          { label: '次へ', variant: 'ghost', onClick: () => ctx.advance() },
        ] : [
          { label: '次へ', variant: 'tone', onClick: () => ctx.advance() },
          { label: nextLabel, variant: 'ghost', onClick: nextHand },
        ]);
      } else {
        const dealIn = !r.tsumo && r.from === ME;
        ctx.say(`<b>${who}のあがり</b>${dealIn ? 'あなたの捨て牌に当たりました（放銃）。' : ''}`
          + `${yaku}（${hanText}）${handHtml}`, dealIn ? 'ng' : undefined);
        if (dealIn) ctx.miss();
        ctx.actions(others);
      }
    }

    /**
     * オーラス（最後の局）なら、逆転に必要な条件を先に伝える。
     * 本場・供託（場に出ているリーチ棒）・同点のときの席順まで入れて、実際にあがったときの点数で計算する
     * （以前は「ロン○点」の早見表だけで、本場や供託を数えておらず、条件がずれることがあった）
     */
    function showAllLastNote() {
      if (!coachOn() || !game.isAllLast || !game.isAllLast()) return;
      const st = game.standings();
      const me = st.find((x) => x.i === ME);
      const honba = game.honba || 0, pot = game.riichiSticks || 0;
      const extra = [honba ? `${honba}本場` : '', pot ? `供託${pot}本` : ''].filter(Boolean).join('・');
      if (me.rank === 1) {
        showCoach({ level: 'ok', lines: [{ kind: 'safe', what: `オーラスです。あなたは現在トップ（${me.v}点）。`,
          why: '逆転されない限り勝ちです。無理に手を作らず、危ない牌を止めて、早くあがるか流局に持ち込みます。',
          lesson: 'トップ目のオーラスは「あがる」より「放銃しない」が優先です。' }] });
        return;
      }
      const top = st[0];
      const diff = top.v - me.v;
      const isOya = game.isOya(ME);
      const base = { me: ME, oya: game.oya, honba, pot, first: 0, target: 0, yame: false };
      // 打点の候補（安い順）
      const HANDS = [[1, 30], [1, 40], [2, 30], [2, 40], [3, 30], [3, 40], [4, 30], [5, 30], [6, 30], [8, 30], [11, 30], [13, 30]];
      const handName = (han, fu) => (han >= 13 ? '役満' : han >= 11 ? '三倍満' : han >= 8 ? '倍満' : han >= 6 ? '跳満'
        : han >= 5 || M.basePoints(han, fu) >= 2000 ? '満貫' : `${han}翻${fu}符`);
      const ronText = (han, fu) => `${handName(han, fu)}（${M.ronPoints(han, fu, isOya).toLocaleString()}点）`;
      const tsumoText = (han, fu) => {
        const t = M.tsumoPoints(han, fu, isOya);
        return `${handName(han, fu)}（${isOya ? `${t.fromKo.toLocaleString()}点オール` : `${t.fromKo.toLocaleString()}・${t.fromOya.toLocaleString()}点`}）`;
      };
      /** あがり方 o で、着順を goal 以内にするのに必要な、いちばん安い打点 */
      const cheapest = (o, goal) => HANDS.find(([han, fu]) => placeAfterWin(game.scores, { ...base, han, fu, ...o }).after <= goal) || null;
      const others = [0, 1, 2, 3].filter((p) => p !== ME && p !== top.i);
      // トップ以外からのロンでは、トップの点数は動かない。だれから出ても条件は同じなので、いちばん厳しい人で数える
      const fromOther = others.map((p) => cheapest({ tsumo: false, from: p }, 1));
      const ron = fromOther.some((x) => !x) ? null : fromOther.sort((a, b) => M.ronPoints(b[0], b[1], isOya) - M.ronPoints(a[0], a[1], isOya))[0];
      const direct = cheapest({ tsumo: false, from: top.i }, 1);
      const tsumo = cheapest({ tsumo: true, from: null }, 1);
      const any = (x) => x && x[0] === 1 && x[1] === 30;
      let why;
      if (any(ron) && any(direct) && any(tsumo)) why = 'どんな手でも、あがればトップです。';
      else {
        why = [ron ? `ロンなら${ronText(...ron)}` : 'ほかの人からのロンでは、役満でも届きません',
          direct ? `トップから直撃なら${ronText(...direct)}` : 'トップからの直撃でも届きません',
          tsumo ? `ツモなら${tsumoText(...tsumo)}` : 'ツモでは役満でも届きません'].join('、') + 'が必要です。';
      }
      // ラス目なら、ラスを抜けるだけの条件も（ロンはいちばん楽な人から、ツモも見る）
      if (me.rank === 4) {
        const opts = [...[0, 1, 2, 3].filter((p) => p !== ME).map((p) => ({ o: { tsumo: false, from: p }, h: cheapest({ tsumo: false, from: p }, 3) })),
          { o: { tsumo: true, from: null }, h: cheapest({ tsumo: true, from: null }, 3) }].filter((x) => x.h);
        if (opts.length) {
          const pts = (x) => (x.o.tsumo ? M.basePoints(x.h[0], x.h[1]) * 4 : M.ronPoints(x.h[0], x.h[1], isOya));
          const easy = opts.sort((a, b) => pts(a) - pts(b))[0];
          why += easy.o.tsumo ? `ラスを抜けるだけなら、ツモで${tsumoText(...easy.h)}。`
            : `ラスを抜けるだけなら、${game.seatJa(easy.o.from)}家からのロンで${ronText(...easy.h)}。`;
        }
      }
      if (isOya) why += '親なので、あがると局が続きます（連荘）。';
      showCoach({ level: 'ok', lines: [{ kind: 'safe',
        what: `オーラスです。あなたは${me.rank}位、トップまで${diff.toLocaleString()}点差${extra ? `（${extra}）` : ''}。`,
        why,
        lesson: '点差から「必要な打点」を決めてから、鳴くか・リーチするかを決めます。リーチするなら、リーチ棒の1000点も点差に足します。' }] });
    }

    function begin() {
      busy = false; riichiMode = false; myRiichi = false;
      tally?.flush();   // 途中でやり直した局も記録する
      tally = makeTally('mahjong');
      items = []; lastMine = null; recapBox.innerHTML = '';
      alStart();
      coachBox.innerHTML = ''; ctx.clear(); tell('');
      // 前の局の「次の局へ」などを残さない。残すと、自分の番が来る前にもう一度押せて、局が丸ごと飛ばされていた
      ctx.actions(redoActions());
      showAllLastNote();
      paint();
      loop();
    }

    /**
     * 局をやり直す。same なら同じ配牌（同じ山）で最初から、そうでなければ新しく配り直す。
     * どちらも点棒と供託を配牌時点に戻す（局が終わったあとでも）
     */
    function restart(same = false) {
      runId++;
      game.rollback();
      game.deal(same && game.dealtWall ? game.dealtWall : null);
      begin();
    }
    /** 局の途中に出すボタン */
    const redoActions = () => [
      { label: '同じ配牌でやり直す', variant: 'ghost', onClick: () => restart(true) },
      { label: '配り直す', variant: 'ghost', onClick: () => restart(false) },
    ];

    /** 次の局へ進む。半荘が終わったら結果を出す */
    function nextHand() {
      runId++;
      game.nextKyoku();
      if (!game.over) { begin(); return; }
      paint();
      tell('半荘が終わりました。');
      const place = game.standings().find((x) => x.i === ME).rank;
      // 着順は、東1局から最後まで打った半荘だけ数える（オーラスから始める練習は数えない）
      if (!s.allLast && !rankDone) { rankDone = true; store.recordMjRank(place); }
      ctx.say(`<b>半荘終了</b>あなたは${place}位（${game.scores[ME].toLocaleString()}点）でした。`);
      showAllLastPanel(place);
      ctx.actions([
        { label: s.allLast ? '別の点数でもう一度' : '新しい半荘', variant: 'tone', onClick: () => { runId++; allLastLog = []; alBox.innerHTML = ''; counted = new Set(); rankDone = false; game = setupAllLast(new Game(rule)); game.deal(); begin(); } },
        { label: '次へ進む', variant: 'ghost', onClick: () => { if (place > 1) ctx.miss(); ctx.solved(); ctx.advance(); } },
      ]);
    }

    game.deal();
    begin();
  }

  return { playFour };
})();

// ── js/core/lesson.js ───────────────────────────────────────
const NS_LESSON = (() => {
  const { Board, renderHand } = NS_BOARD;
  const { renderTiles, renderMelds, tileFace } = NS_TILES;
  const C = NS_CHESS;
  const S = NS_SHOGI;
  const M = NS_MAHJONG;
  const { playChess, playShogi, playGo, soloMahjong } = NS_PLAY;
  const { playFour } = NS_PLAY4;
  const { store } = NS_STORE;
  const { sfx } = NS_AUDIO;
  const K = NS_COACH;
  const { settings } = NS_SETTINGS;
  const MJAI = NS_MJAI;
  // lesson.js — レッスンを1ステップずつ進める実行エンジン。
  // 問題形式ごとの描画は STEPS に登録する。新しい形式はここに足すだけで増やせる。













  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[b[i], b[j]] = [b[j], b[i]]; } return b; };
  const sameSet = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

  // ── 問題のID：復習の記録を「何問目か」ではなく「問題の中身」で覚える。
  //    レッスンに問題を足したり並べ替えたりしても、記録が別の問題を指さないようにするため。
  //    中身がまったく同じ問題が2つあるときは、出てきた順で -1, -2 … を付けて区別する。
  const hash32 = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  //    解説・ヒントなど「問題の中身ではない文章」はIDの計算に入れない。誤字を直したり
  //    ヒントを書き足したりしても、その問題の復習の記録が別物にならないようにするため。
  const TEXT_ONLY = new Set(['hint', 'why', 'wrong', 'note', 'notes', 'doneMsg', 'next']);
  const keyBody = (st) => JSON.stringify(st, (k, v) => (TEXT_ONLY.has(k) ? undefined : v));
  const KEY_CACHE = new WeakMap();
  const keysOf = (lesson, bodyOf) => {
    const seen = new Map();
    return lesson.steps.map((st, i) => {
      let body;
      try { body = bodyOf(st); } catch { body = `#${i}`; }
      const h = hash32(body).toString(36);
      const n = seen.get(h) || 0;
      seen.set(h, n + 1);
      return `s${h}${n ? `-${n}` : ''}`;
    });
  };
  // 新しいIDと、以前の版のID（文章まで含めて計算していたもの）を、起動直後に一度だけ作る
  function keyTable(lesson) {
    let t = KEY_CACHE.get(lesson);
    if (!t) {
      t = { keys: keysOf(lesson, keyBody), legacy: keysOf(lesson, (st) => JSON.stringify(st)) };
      KEY_CACHE.set(lesson, t);
    }
    return t;
  }
  function stepKeys(lesson) { return keyTable(lesson).keys; }
  /** 以前の版のID。前に付けた復習の記録を読む・付け替えるために残す */
  function legacyStepKeys(lesson) { return keyTable(lesson).legacy; }
  /** 記録のキーから問題番号を求める。古い形式（数字＝何問目か・以前の版のID）も読む。見つからなければ -1 */
  function stepIndexOf(lesson, key) {
    if (/^\d+$/.test(key)) { const n = Number(key); return lesson.steps[n] ? n : -1; }
    const n = stepKeys(lesson).indexOf(key);
    return n >= 0 ? n : legacyStepKeys(lesson).indexOf(key);
  }

  class LessonRunner {
    /**
     * opts.only に問題番号の配列を渡すと、その問題だけを解き直す「復習」になる。
     * 復習では修了の記録は付けず、一発で解けた問題の復習だけを消す。
     */
    constructor(lesson, host, { onFinish, onExit, only = null, transient = false } = {}) {
      this.lesson = lesson;
      this.transient = transient;   // 実力テストなど：ミスも修了も記録しない
      this.host = host;
      this.onFinish = onFinish;
      this.onExit = onExit;
      this.order = only && only.length ? only.filter((n) => lesson.steps[n]) : lesson.steps.map((_, n) => n);
      if (!this.order.length) this.order = lesson.steps.map((_, n) => n);
      this.review = !!(only && only.length);
      this.pos = 0;
      this.correct = 0;
      this.missedThisStep = false;
      this.solvedThisStep = false;
      this.render();
    }

    get i() { return this.order[this.pos]; }
    get step() { return this.lesson.steps[this.i]; }

    render() {
      this.host.innerHTML = '';
      const stage = el('div', 'stage');
      stage.style.setProperty('--tone', `var(--${this.lesson.game})`);

      const bar = el('div', 'steps');
      this.order.forEach((_, n) => {
        const i = el('i');
        i.dataset.s = n < this.pos ? 'done' : n === this.pos ? 'now' : '';
        bar.appendChild(i);
      });
      stage.appendChild(bar);
      if (this.review) stage.appendChild(el('p', 'note', '復習：前に間違えた問題をもう一度解きます。'));

      this.titleEl = el('h2');
      this.promptEl = el('p', 'prompt');
      this.mount = el('div');
      this.feedbackEl = el('div');
      this.actionsEl = el('div', 'actions');
      stage.append(this.titleEl, this.promptEl, this.mount, this.feedbackEl, this.actionsEl);
      // 今日の1問・実力テスト・段位認定などは、解けない問題で止まらないよう「とばす」を出す
      if (this.step.fromLesson || this.lesson.id.endsWith('._tactics')) {
        const skip = el('button', 'btn btn--ghost btn--sm', 'わからないので次へ');
        skip.style.marginTop = '.6rem';
        skip.addEventListener('click', () => {
          if (this.solvedThisStep) return this._advance();
          this.ctx().miss();
          this._solved('<b>とばしました</b>この問題は正解に数えません。');
        });
        stage.appendChild(skip);
      }
      this.host.appendChild(stage);

      this.titleEl.style.display = 'none';
      this.promptEl.style.display = 'none';
      // 長い問題の下で「次へ」を押すと、次の問題が途中から表示されてしまう。頭が隠れていれば戻す
      if (this.gen && stage.getBoundingClientRect().top < 0) {
        stage.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }
      // 世代番号：前の問題のタイマーや思考中のAIが、次の問題の画面に書き込まないようにする
      this.gen = (this.gen || 0) + 1;
      this.missedThisStep = false;
      this.solvedThisStep = false;
      this._runStep();
    }

    // --- ステップから呼ばれる道具 -------------------------------------------
    ctx() {
      const self = this;
      const gen = this.gen;
      // この ctx を作った問題がまだ画面に出ているか（次へ進んだ／画面を離れたら false）
      // 生成直後はまだ文書に入っていないので、一度つながったあとで外れたときだけ「離れた」とみなす
      const alive = () => {
        if (gen !== self.gen) return false;
        if (self.host.isConnected) { self._mounted = true; return true; }
        return !self._mounted;
      };
      return {
        step: this.step,
        lesson: this.lesson,
        mount: this.mount,
        alive,
        title(t) { if (!alive()) return; self.titleEl.textContent = t; self.titleEl.style.display = ''; },
        prompt(html) { if (!alive()) return; self.promptEl.innerHTML = html; self.promptEl.style.display = ''; },
        say(html, kind) {
          if (!alive()) return;
          self.feedbackEl.innerHTML =
            `<div class="feedback" ${kind ? `data-s="${kind}"` : ''}>${html}</div>`;
          if (kind === 'ng') sfx.wrong();
        },
        clear() { if (!alive()) return; self.feedbackEl.innerHTML = ''; },
        miss() {
          if (!alive()) return;
          // 解き終わったあとの操作はミスに数えない
          if (!self.missedThisStep && !self.solvedThisStep) {
            self.missedThisStep = true;
            if (!['teach', 'play', 'play4', 'gfree'].includes(self.step.type)) store.recordAttempt(self.lesson.game, false);
            // 自分の悪手から作った問題：間違えたら翌日にもう一度出す
            if (self.step.mistakeId) store.markMistake(self.step.mistakeId, false);
            if (self.step.retryAsMistake && !self.step.mistakeId) {
              const { fromLesson, retryAsMistake, mistakeId, ...clean } = self.step;
              const sig = JSON.stringify(clean.board || clean.state || clean.tiles || '');
              if (!store.pendingMistakes(self.lesson.game).some((m) => JSON.stringify(m.step.board || m.step.state || m.step.tiles || '') === sig)) {
                try { store.addMistake(self.lesson.game, 'drill', clean, fromLesson || ''); } catch { }
              }
            }
            if (self.step.type !== 'teach' && !self.transient && !self.lesson.id.endsWith('._daily')) {
              store.recordMiss(self.lesson.id, stepKeys(self.lesson)[self.i]);
            }
          }
        },
        solved(msg, extra = []) { if (alive()) self._solved(msg, extra); },
        advance() { if (alive()) self._advance(); },
        actions(list) { if (alive()) self._actions(list); },
        boardHost() { const d = el('div'); self.mount.appendChild(d); return d; },
        node: el,
      };
    }

    _actions(list) {
      this.actionsEl.innerHTML = '';
      for (const a of list) {
        if (a === 'spacer') { this.actionsEl.appendChild(el('div', 'actions__spacer')); continue; }
        const b = el('button', 'btn' + (a.variant ? ` btn--${a.variant}` : ''), a.label);
        if (a.disabled) b.disabled = true;
        b.addEventListener('click', a.onClick);
        this.actionsEl.appendChild(b);
      }
    }

    _advance() {
      if (this.pos === this.order.length - 1) this._finish();
      else { this.pos++; this.render(); }
    }

    _solved(msg, extra = []) {
      // 1つの問題で2回以上呼ばれても（対局で2回勝つなど）、正解数は1回だけ数える
      const first = !this.solvedThisStep;
      this.solvedThisStep = true;
      if (first && this.step.type !== 'teach') {
        if (!this.missedThisStep) {
          this.correct++;
          if (!['play', 'play4', 'gfree'].includes(this.step.type)) store.recordAttempt(this.lesson.game, true);
          if (this.step.mistakeId) store.markMistake(this.step.mistakeId, true);   // 一発で解けたら卒業
          // 一発で解けたら復習リストから外す。間違えたら残して、あとで解き直せるようにする
          if (!this.transient) {
            store.clearReview(this.lesson.id, stepKeys(this.lesson)[this.i]);
            store.clearReview(this.lesson.id, String(this.i));   // 古い形式の記録も消す
            store.clearReview(this.lesson.id, legacyStepKeys(this.lesson)[this.i]);
          }
        }
        sfx.correct();
      }
      // 今日の1問・実力テストでは、どのレッスンの問題だったかを最後に見せる
      if (this.step.fromLesson) msg = `${msg || '<b>正解</b>'}<br><span class="note">出題元：${this.step.fromLesson}</span>`;
      if (msg) this.ctx().say(msg, 'ok');
      const last = this.pos === this.order.length - 1;
      this._actions([{
        label: last ? (this.review ? '復習を終える' : 'レッスンを終える') : '次へ',
        variant: 'tone',
        onClick: () => this._advance(),
      }, ...extra]);
    }

    _finish() {
      const total = this.order.filter((n) => this.lesson.steps[n].type !== 'teach').length;
      sfx.finish();
      if (!this.review && !this.transient) store.recordLesson(this.lesson.id, { correct: this.correct, total });
      this.onFinish?.({ correct: this.correct, total, review: this.review });
    }

    _runStep() {
      const handler = STEPS[this.step.type];
      if (!handler) { console.warn('未知のステップ形式:', this.step.type); return this._advance(); }
      handler(this.ctx());
    }
  }

  // ───────────────────────────────────────────────────────────────
  // 問題形式
  // ───────────────────────────────────────────────────────────────
  const STEPS = {};

  /** 説明カード。読んで次へ進むだけ */
  STEPS.teach = (ctx) => {
    const s = ctx.step;
    if (s.title) ctx.title(s.title);
    ctx.mount.appendChild(el('div', null, s.body));
    if (s.board) mountStaticBoard(ctx, s.board);
    if (s.go) mountGoStatic(ctx, s.go);
    if (s.tiles) {
      const d = el('div');
      ctx.mount.appendChild(d);
      renderTiles(d, s.tiles, { disabled: true, states: s.tileStates });
    }
    ctx.actions([{ label: s.next || 'わかった', variant: 'tone', onClick: () => ctx.advance() }]);
  };

  /** 選択問題 */
  STEPS.quiz = (ctx) => {
    const s = ctx.step;
    ctx.prompt(s.prompt);
    if (s.board) mountStaticBoard(ctx, s.board);
    if (s.go) mountGoStatic(ctx, s.go);
    if (s.tiles) { const d = el('div'); ctx.mount.appendChild(d); renderTiles(d, s.tiles, { disabled: true }); }

    const order = s.keepOrder ? s.choices.map((_, i) => i) : shuffle(s.choices.map((_, i) => i));
    const box = el('div', 'choices');
    box.dataset.cols = s.choices.every((c) => (c.t || c).length < 14) ? '2' : '1';
    ctx.mount.appendChild(box);

    order.forEach((idx) => {
      const c = s.choices[idx];
      const b = el('button', 'choice', typeof c === 'string' ? c : c.t);
      b.addEventListener('click', () => {
        if (idx === s.answer) {
          b.dataset.s = 'ok';
          box.querySelectorAll('.choice').forEach((x) => (x.disabled = true));
          ctx.solved(s.why ? `<b>その通り</b>${s.why}` : '<b>正解</b>');
        } else {
          b.dataset.s = 'ng';
          b.disabled = true;
          ctx.miss();
          const why = (typeof c === 'object' && c.why) || s.wrong || 'もう一度考えてみましょう。';
          ctx.say(`<b>おしい</b>${why}`, 'ng');
        }
      });
      box.appendChild(b);
    });
    ctx.actions([]);
  };

  /** 盤：その駒が動けるマスを全部タップする */
  STEPS.targets = (ctx) => {
    const s = ctx.step;
    ctx.prompt(s.prompt);
    const { board, opts, shape } = boardSpec(ctx, s);
    const answer = ctx.lesson.game === 'chess'
      ? C.pseudoMoves(s.board, s.from, opts)
      : S.pseudoMoves(s.board, s.from, shape);

    const picked = new Set();
    const marks = () => {
      const m = { [s.from]: 'sel' };
      for (const sq of picked) m[sq] = answer.includes(sq) ? 'ok' : 'ng';
      return m;
    };
    board.setPosition(s.board, marks());

    board.onPick = (sq) => {
      if (sq === s.from || picked.has(sq)) return;
      picked.add(sq);
      board.setMarks(marks());
      if (!answer.includes(sq)) {
        ctx.miss();
        ctx.say(`<b>そこへは行けません</b>${s.hint || 'マークのついたマスをもう一度見てください。'}`, 'ng');
        return;
      }
      sfx.place(ctx.lesson.game);
      const hit = [...picked].filter((x) => answer.includes(x));
      if (hit.length === answer.length) {
        board.onPick = null;
        ctx.solved(`<b>全部見つかりました</b>${s.why || `動けるマスは${answer.length}か所です。`}`);
      } else {
        ctx.say(`あと ${answer.length - hit.length} か所。`);
      }
    };

    ctx.actions([{
      label: '答えを見る', variant: 'ghost',
      onClick: () => {
        ctx.miss();
        const m = { [s.from]: 'sel' };
        for (const sq of answer) m[sq] = picked.has(sq) ? 'ok' : 'miss';
        board.setMarks(m);
        board.onPick = null;
        ctx.solved(`<b>ここが答えです</b>${s.why || ''}`);
      },
    }]);
  };

  /** 盤：1手指して目標を達成する */
  STEPS.move = (ctx) => {
    const s = ctx.step;
    ctx.prompt(s.prompt);
    const game = ctx.lesson.game;
    const { board, opts, shape } = boardSpec(ctx, s);
    let from = null;

    const position = () => (game === 'chess' ? s.board : s.state.board);
    const paint = (extra = {}) => board.setPosition(position(), { ...(s.marks || {}), ...extra });
    let locked = false;   // 不正解の手を盤に残している間は、次の操作を受け付けない
    paint();

    // 将棋で持ち駒があるときは、盤の下に打てる駒を出す
    let dropKind = null, handHost = null;
    let paintHand = () => {};
    if (game === 'shogi' && Object.keys(s.state.hands?.[s.state.turn] || {}).length) {
      handHost = el('div', 'hand');
      ctx.mount.appendChild(handHost);
      // 失敗してやり直すときも、必ずこの関数で描き直す。
      // onPick を付けずに描き直すと、二度と持ち駒を選べなくなる。
      paintHand = () => renderHand(handHost, s.state.hands[s.state.turn], {
        label: 'あなたの持ち駒', order: S.HAND_ORDER, selected: dropKind,
        onPick: (k) => {
          dropKind = dropKind === k ? null : k;
          from = null;
          const m = {};
          if (dropKind) for (const t of S.legalDrops(s.state, dropKind, shape)) m[t] = 'move';
          paint(m);
          paintHand();
        },
      });
      paintHand();
    }

    const legalFrom = (sq) => game === 'chess'
      ? C.legalMoves(s.board, sq, opts)
      : S.legalMovesFrom(s.state, sq, shape).map((m) => m.to);
    const hintMarks = (sq) => K.moveMarks(game, position(), sq, legalFrom(sq),
      game === 'chess' ? (s.side || 'w') : s.state.turn, game === 'chess' ? opts : shape, {
        showMoves: settings.get('showMoves'),
        warnUnsafe: s.warnUnsafe ?? settings.get('warnUnsafe'),
        showThreat: settings.get('showThreat'),
      });

    const judge = (result) => {
      const ok = typeof s.goal === 'function'
        ? s.goal(result)
        : s.goal?.to
          ? result.to === s.goal.to && (!s.goal.from || result.from === s.goal.from)
          : s.goal === 'mate'
            ? (game === 'chess'
              ? C.gameStatus(result.board, result.foe, opts) === 'checkmate'
              : S.isMate({ ...result.next }, shape))
            : true;
      if (ok) {
        board.onPick = null;
        ctx.solved(`<b>その通り</b>${s.why || ''}`);
      } else {
        ctx.miss();
        ctx.say(`<b>これでは目的を果たせません</b>${s.hint || 'もう一度やってみましょう。'}`, 'ng');
        locked = true;
        setTimeout(() => { if (!ctx.alive()) return; locked = false; from = null; dropKind = null; paint(); paintHand(); }, 850);
      }
    };

    board.onPick = (sq) => {
      if (locked) return;
      const pos = position();
      if (dropKind) {
        if (!S.legalDrops(s.state, dropKind, shape).includes(sq)) return;
        const mv = { drop: dropKind, to: sq };
        const next = S.applyMove(s.state, mv, shape);
        board.setPosition(next.board, { [sq]: 'last' });
        sfx.place('shogi');
        const k = dropKind; dropKind = null;
        paintHand();
        judge({ ...mv, drop: k, next, board: next.board });
        return;
      }
      if (from === null) {
        if (!pos[sq]) return;
        const mine = game === 'chess'
          ? C.colorOf(pos[sq]) === (s.side || 'w')
          : S.colorOf(pos[sq]) === s.state.turn;
        if (!mine) return;
        from = sq;
        paint(hintMarks(sq));
        return;
      }
      if (sq === from) { from = null; paint(); return; }
      const targets = legalFrom(from);
      if (!targets.includes(sq)) {
        if (pos[sq] && (game === 'chess' ? C.colorOf(pos[sq]) === (s.side || 'w') : S.colorOf(pos[sq]) === s.state.turn)) {
          from = sq;
          paint(hintMarks(sq));
        }
        return;
      }
      if (game === 'chess') {
        const nb = C.applyMove(s.board, from, sq, opts);
        board.setPosition(nb, { [from]: 'last', [sq]: 'last' });
        s.board[sq] ? sfx.capture('chess') : sfx.place('chess');
        judge({ from, to: sq, board: nb, foe: (s.side || 'w') === 'w' ? 'b' : 'w' });
      } else {
        const cands = S.legalMovesFrom(s.state, from, shape).filter((m) => m.to === sq);
        const promo = cands.find((m) => m.promote), plain = cands.find((m) => !m.promote);
        const mfrom = from;
        const go = (mv) => {
          const next = S.applyMove(s.state, mv, shape);
          board.setPosition(next.board, { [mfrom]: 'last', [sq]: 'last' });
          s.state.board[sq] ? sfx.capture('shogi') : sfx.place('shogi');
          judge({ ...mv, next, board: next.board });
        };
        from = null;
        // 成る・成らないの両方が指せるときは、実戦と同じように指す人に聞く
        // （以前は自動で成っていたので、成るかどうかを自分で決める機会がなく、「成らない」が正解の形も指せなかった）。
        // preferPromote: false の問題だけは、聞かずに成らずに指す
        if (promo && plain) {
          if (s.preferPromote === false) go(plain);
          else askPromote(mfrom, sq, promo, plain, go);
          return;
        }
        go(cands[0]);
      }
      from = null;
    };

    /** 盤の下に「成る／成らない」を出す。選ぶまで盤は止める */
    let promoBox = null;
    function askPromote(mfrom, sq, promo, plain, go) {
      locked = true;
      promoBox?.remove();
      promoBox = el('div', 'actions');
      promoBox.setAttribute('role', 'group');
      promoBox.setAttribute('aria-label', '成りますか');
      const yes = el('button', 'btn btn--tone btn--sm', '成る');
      const no = el('button', 'btn btn--ghost btn--sm', '成らない');
      const back = el('button', 'btn btn--ghost btn--sm', 'やめる');
      const close = () => { promoBox?.remove(); promoBox = null; locked = false; };
      yes.addEventListener('click', () => { close(); go(promo); });
      no.addEventListener('click', () => { close(); go(plain); });
      back.addEventListener('click', () => { close(); paint(); paintHand(); });
      promoBox.append(el('span', 'note', '成りますか？'), yes, no, back);
      ctx.mount.appendChild(promoBox);
      paint({ [mfrom]: 'sel', [sq]: 'move' });
      yes.focus();
    }

    const acts = [];
    if (s.allowHint !== false) {
      acts.push({
        label: 'ヒント', variant: 'ghost', onClick: () => {
          ctx.miss();
          ctx.say(`<b>ヒント</b>${s.hint || (s.goal === 'mate' ? '玉／キングの逃げ道を先に数えてみましょう。' : '目標のマスをよく見てください。')}`);
        },
      });
    }
    ctx.actions(acts);
  };

  /** ソリティア・チェス：毎手かならず取る。1枚になれば成功 */
  STEPS.solitaire = (ctx) => {
    const s = ctx.step;
    ctx.prompt(s.prompt || '毎回かならず駒を取ります。最後の1枚になるまで取りきってください。');
    const host = ctx.boardHost();
    const board = new Board(host, { variant: 'chess', w: s.w || 4, h: s.h || 4 });
    const opts = { w: s.w || 4, h: s.h || 4 };
    let position = { ...s.board };
    let from = null;

    const paint = (extra = {}) => board.setPosition(position, extra);
    const reset = () => { position = { ...s.board }; from = null; paint(); ctx.clear(); };
    paint();

    board.onPick = (sq) => {
      if (from === null) {
        if (!position[sq]) return;
        if (!C.captureMoves(position, sq, opts).length) {
          ctx.say('その駒はいま何も取れません。取れる駒を選びましょう。', 'ng');
          return;
        }
        from = sq;
        const m = { [sq]: 'sel' };
        for (const t of C.captureMoves(position, sq, opts)) m[t] = 'move';
        paint(m);
        return;
      }
      if (sq === from) { from = null; paint(); return; }
      if (!C.captureMoves(position, from, opts).includes(sq)) { from = null; paint(); return; }
      position = { ...position };
      position[sq] = position[from];
      delete position[from];
      from = null;
      ctx.clear();
      sfx.capture('chess');
      paint({ [sq]: 'last' });

      const left = Object.keys(position).length;
      if (left === 1) { board.onPick = null; ctx.solved('<b>取りきりました</b>駒の動きが手に入っています。'); return; }
      const stuck = Object.keys(position).every((k) => !C.captureMoves(position, k, opts).length);
      if (stuck) {
        ctx.miss();
        ctx.say(`<b>手詰まりです</b>あと${left}枚残っています。順番を変えるとうまくいきます。`, 'ng');
      }
    };

    ctx.actions([
      { label: 'やり直す', variant: 'ghost', onClick: reset },
      { label: 'ヒント', variant: 'ghost', onClick: () => {
        ctx.miss();
        const order = Object.keys(position).find((k) =>
          C.captureMoves(position, k, opts).some((t) => {
            const n = { ...position }; n[t] = n[k]; delete n[k];
            return C.solitaireSolvable(n, opts);
          }));
        ctx.say(order ? `<b>ヒント</b>${order} の駒から動かすと、最後まで取りきれます。` : 'この形からは取りきれません。やり直してください。');
      } },
    ]);
  };

  /** ミニ盤・本盤での対局 */
  STEPS.play = (ctx) => {
    const g = ctx.lesson.game;
    if (g === 'chess') return playChess(ctx, { Board, C });
    if (g === 'shogi') return playShogi(ctx, { Board, renderHand, S });
    if (g === 'go') return playGo(ctx);
    return soloMahjong(ctx, { renderTiles, M });
  };

  /** 4人打ち */
  STEPS.play4 = (ctx) => playFour(ctx, { renderTiles, tileFace });

  // --- 麻雀 ---------------------------------------------------------------

  /** 牌を見て名前を答える */
  STEPS.tileid = (ctx) => {
    const s = ctx.step;
    const tile = s.tile || M.ALL_TILES[(Math.random() * M.ALL_TILES.length) | 0];
    ctx.prompt(s.prompt || 'この牌はなんという牌でしょう。');
    const d = el('div'); ctx.mount.appendChild(d);
    renderTiles(d, [tile], { disabled: true });

    const wrongs = shuffle(M.ALL_TILES.filter((t) => t !== tile)).slice(0, 3);
    const choices = shuffle([tile, ...wrongs]);
    const box = el('div', 'choices'); box.dataset.cols = '2';
    ctx.mount.appendChild(box);
    choices.forEach((t) => {
      const b = el('button', 'choice', `${M.tileName(t)}（${M.tileYomi(t)}）`);
      b.addEventListener('click', () => {
        if (t === tile) {
          b.dataset.s = 'ok';
          box.querySelectorAll('.choice').forEach((x) => (x.disabled = true));
          ctx.solved(`<b>正解</b>${M.tileName(tile)}、読みは「${M.tileYomi(tile)}」です。`);
        } else {
          b.dataset.s = 'ng'; b.disabled = true; ctx.miss();
          ctx.say(`<b>ちがいます</b>それは ${M.tileName(t)} です。`, 'ng');
        }
      });
      box.appendChild(b);
    });
    ctx.actions([]);
  };

  /** 牌を選んで3枚の組（順子／刻子）を作る */
  STEPS.sets = (ctx) => {
    const s = ctx.step;
    ctx.prompt(s.prompt);
    const need = s.need || 2;
    let pool = [...s.tiles];
    const melds = [];
    const sel = new Set();

    const poolHost = el('div'); const meldHost = el('div', 'meldbox');
    ctx.mount.append(meldHost, el('p', 'note', '下の牌をタップして3枚えらぶと、組になります。'), poolHost);
    renderMelds(meldHost, melds);
    meldHost.style.setProperty('--tone', `var(--mahjong)`);

    const isSet = (t) => {
      const a = M.sortTiles(t);
      if (a[0] === a[1] && a[1] === a[2]) return '刻子';
      if (a[0][0] === a[1][0] && a[1][0] === a[2][0] && a[0][0] !== 'z'
        && +a[1][1] === +a[0][1] + 1 && +a[2][1] === +a[1][1] + 1) return '順子';
      return null;
    };

    const paint = () => {
      const states = {};
      sel.forEach((i) => (states[i] = 'on'));
      renderTiles(poolHost, pool, {
        states,
        onPick: (i) => {
          if (sel.has(i)) sel.delete(i); else if (sel.size < 3) sel.add(i);
          if (sel.size === 3) {
            const idxs = [...sel];
            const tiles = idxs.map((i) => pool[i]);
            const kind = isSet(tiles);
            if (!kind) {
              ctx.miss();
              ctx.say('<b>これは組になりません</b>同じ牌3枚か、同じ種類の連番3枚にしましょう。', 'ng');
              sel.clear(); paint(); return;
            }
            sfx.place('mahjong');
            melds.push(M.sortTiles(tiles));
            pool = pool.filter((_, i) => !idxs.includes(i));
            sel.clear();
            renderMelds(meldHost, melds);
            ctx.say(`${kind} ができました。`, 'ok');
            paint();
            if (melds.length >= need) ctx.solved(`<b>できました</b>${s.why || '3枚の組が面子です。'}`);
            return;
          }
          paint();
        },
      });
    };
    paint();
    ctx.actions([{ label: 'やり直す', variant: 'ghost', onClick: () => { pool = [...s.tiles]; melds.length = 0; sel.clear(); renderMelds(meldHost, melds); paint(); ctx.clear(); } }]);
  };

  /** この手はアガっているか */
  STEPS.agari = (ctx) => {
    const s = ctx.step;
    const sets = s.sets || 4;
    const hand = s.tiles || (() => {
      let w = null;
      for (let k = 0; k < 20 && !w; k++) w = M.randomWinHand({ sets, tanyao: s.tanyao });
      if (!w) w = sets === 2 ? ['m2', 'm3', 'm4', 'p7', 'p7', 'p7', 's5', 's5']
        : ['m1', 'm2', 'm3', 'p4', 'p5', 'p6', 's7', 's8', 's9', 'z1', 'z1', 'z1', 'm5', 'm5'];
      if (Math.random() < 0.5) return w;
      // 1枚だけ入れ替えて崩す。同じ牌が5枚になる入れ替えは選ばない
      for (let k = 0; k < 30; k++) {
        const broken = [...w];
        const swap = M.ALL_TILES[(Math.random() * M.ALL_TILES.length) | 0];
        broken[(Math.random() * broken.length) | 0] = swap;
        if (M.toCounts(broken).some((c) => c > 4)) continue;
        if (!M.isWin(M.sortTiles(broken), sets)) return M.sortTiles(broken);
      }
      return w;
    })();
    const truth = M.isWin(hand, sets);

    ctx.prompt(s.prompt || `この手は「${sets}面子1雀頭」の形になっているでしょうか。`);
    const d = el('div'); ctx.mount.appendChild(d);
    renderTiles(d, M.sortTiles(hand), { disabled: true, tight: true });

    const box = el('div', 'choices'); box.dataset.cols = '2';
    ctx.mount.appendChild(box);
    [['なっている', true], ['なっていない', false]].forEach(([label, v]) => {
      const b = el('button', 'choice', label);
      b.addEventListener('click', () => {
        if (v === truth) {
          b.dataset.s = 'ok';
          box.querySelectorAll('.choice').forEach((x) => (x.disabled = true));
          const dec = M.decompose(hand, sets)[0];
          const detail = dec
            ? `${dec.sets.map((g) => g.map(M.tileName).join('')).join(' / ')} ＋ 雀頭 ${M.tileName(dec.pair)}`
            : sets === 4 && M.isChiitoi(hand) ? '七対子（同じ牌2枚×7組）の形です。4面子1雀頭ではありませんが、アガリです。'
            : sets === 4 && M.isKokushi(hand) ? '国士無双の形です。'
            : 'どう分けても組が足りません。';
          ctx.solved(`<b>正解</b>${detail}`);
        } else {
          b.dataset.s = 'ng'; b.disabled = true; ctx.miss();
          ctx.say('<b>もう一度</b>3枚の組を左から順に切り出してみてください。最後に2枚（雀頭）が残れば完成です。', 'ng');
        }
      });
      box.appendChild(b);
    });
    ctx.actions([]);
  };

  /** テンパイの手から、アガリ牌を全部選ぶ */
  STEPS.waits = (ctx) => {
    const s = ctx.step;
    const sets = s.sets || 4;
    const gen = s.tiles ? { tiles: s.tiles, waits: M.waits(s.tiles, sets) }
      : M.randomTenpai({ sets, tanyao: s.tanyao, honors: s.honors !== false, waitTypes: s.waitTypes });
    const hand = M.sortTiles(gen.tiles);
    const answer = gen.waits;

    ctx.prompt(s.prompt || 'この手はテンパイです。アガリ牌を<strong>全部</strong>選んでください。');
    const handHost = el('div'); ctx.mount.appendChild(handHost);
    renderTiles(handHost, hand, { disabled: true, tight: true });
    ctx.mount.appendChild(el('p', 'note', '候補から選びます。'));

    const wrongs = shuffle(M.ALL_TILES.filter((t) => !answer.includes(t))).slice(0, Math.max(3, 7 - answer.length));
    const candidates = M.sortTiles([...answer, ...wrongs]);
    const picked = new Set();
    let finished = false;
    const candHost = el('div'); ctx.mount.appendChild(candHost);

    const paint = () => {
      const states = {};
      candidates.forEach((t, i) => { if (picked.has(i)) states[i] = answer.includes(t) ? 'ok' : 'ng'; });
      renderTiles(candHost, candidates, {
        states,
        onPick: (i, t) => {
          if (picked.has(i) || finished) return;
          picked.add(i); paint();
          if (!answer.includes(t)) {
            ctx.miss();
            ctx.say(`<b>${M.tileName(t)}ではアガれません</b>その牌を足しても、どこかの組が足りないままです。`, 'ng');
            return;
          }
          const hit = candidates.filter((x, j) => picked.has(j) && answer.includes(x));
          if (hit.length === answer.length) {
            finished = true;
            const types = [...new Set(answer.flatMap((w) => M.waitType(hand, w, sets)))];
            const names = types.map((t) => M.WAIT_TYPES[t]?.ja).filter(Boolean).join('・');
            ctx.solved(`<b>全部そろいました</b>アガリ牌は ${answer.map(M.tileName).join('・')}。${names ? `待ちの形は<strong>${names}</strong>です。` : ''}${s.why ? `<br>${s.why}` : ''}`);
          } else {
            ctx.say(`あと ${answer.length - hit.length} 種類あります。`);
          }
        },
      });
    };
    paint();
    ctx.actions([{
      label: '答えを見る', variant: 'ghost', onClick: () => {
        ctx.miss();
        const states = {};
        candidates.forEach((t, i) => { states[i] = answer.includes(t) ? 'ok' : 'dim'; });
        renderTiles(candHost, candidates, { states, disabled: true });
        ctx.solved(`<b>答え</b>${answer.map(M.tileName).join('・')} でアガれます。`);
      },
    }]);
  };

  /** 待ちの形を名前で答える */
  STEPS.waittype = (ctx) => {
    const s = ctx.step;
    const kinds = s.kinds || ['ryanmen', 'kanchan', 'penchan', 'shanpon', 'tanki'];
    const target = s.kind || kinds[(Math.random() * kinds.length) | 0];
    // randomTenpai は待ち牌すべての形が target だけになる手を返す（答えが1つに決まる）
    let gen = null;
    for (let k = 0; k < 5 && !gen; k++) gen = M.randomTenpai({ sets: s.sets || 2, waitTypes: [target], honors: false });
    if (!gen) {
      // 生成に失敗したときの固定問題（正解扱いで飛ばさない）
      const fixed = {
        ryanmen: ['m3', 'm4', 'p2', 'p3', 'p4', 's6', 's6'], kanchan: ['m3', 'm5', 'p2', 'p3', 'p4', 's6', 's6'],
        penchan: ['m1', 'm2', 'p2', 'p3', 'p4', 's6', 's6'], shanpon: ['m5', 'm5', 'p2', 'p3', 'p4', 's6', 's6'],
        tanki: ['m5', 'p2', 'p3', 'p4', 's6', 's7', 's8'],
      }[target];
      gen = { tiles: fixed, waits: M.waits(fixed, 2) };
    }
    const hand = M.sortTiles(gen.tiles);

    ctx.prompt('この手の<strong>待ちの形</strong>はどれでしょう。');
    const d = el('div'); ctx.mount.appendChild(d);
    renderTiles(d, hand, { disabled: true, tight: true });
    ctx.mount.appendChild(el('p', 'note',
      `アガリ牌は ${gen.waits.map(M.tileName).join('・')} です。`));

    const box = el('div', 'choices'); box.dataset.cols = '2';
    ctx.mount.appendChild(box);
    shuffle(kinds).forEach((k) => {
      const b = el('button', 'choice', M.WAIT_TYPES[k].ja);
      b.addEventListener('click', () => {
        if (k === target) {
          b.dataset.s = 'ok';
          box.querySelectorAll('.choice').forEach((x) => (x.disabled = true));
          ctx.solved(`<b>正解</b>${M.WAIT_TYPES[target].ja}：${M.WAIT_TYPES[target].desc}`);
        } else {
          b.dataset.s = 'ng'; b.disabled = true; ctx.miss();
          ctx.say(`<b>ちがいます</b>${M.WAIT_TYPES[k].ja}は「${M.WAIT_TYPES[k].desc}」です。`, 'ng');
        }
      });
      box.appendChild(b);
    });
    ctx.actions([]);
  };

  /** 成立している役を選ぶ */
  STEPS.yaku = (ctx) => {
    const s = ctx.step;
    const hand = M.sortTiles(s.tiles);
    const truth = M.judgeYaku(hand, s.ctx || { tsumo: true, menzen: true });
    ctx.prompt(s.prompt || 'この手であがったとき、ついている役を全部選んでください。');
    const d = el('div'); ctx.mount.appendChild(d);
    renderTiles(d, hand, { disabled: true, tight: true });

    const options = s.options || ['tanyao', 'yakuhai', 'pinfu', 'chiitoi', 'tsumo'];
    // 選択肢の中に正解がひとつもない手もある。そのときは「役なし」が正解
    const expect = truth.filter((t) => options.includes(t));
    const box = el('div', 'choices'); box.dataset.cols = '2';
    ctx.mount.appendChild(box);
    const found = new Set();
    const names = () => (truth.length ? truth.map((t) => M.YAKU_JA[t]?.ja).filter(Boolean).join('・') : '役なし（このままではあがれません）');
    const done = () => {
      box.querySelectorAll('.choice').forEach((x) => (x.disabled = true));
      ctx.solved(`<b>そろいました</b>${names()}`);
    };
    options.forEach((k) => {
      const y = M.YAKU_JA[k];
      const b = el('button', 'choice', `${y.ja}<span class="lrow__d"><br>${y.desc}</span>`);
      b.addEventListener('click', () => {
        if (expect.includes(k)) {
          b.dataset.s = 'ok'; b.disabled = true; found.add(k);
          if (found.size === expect.length) done();
          else ctx.say('ほかにもあります。');
        } else {
          b.dataset.s = 'ng'; b.disabled = true; ctx.miss();
          ctx.say(`<b>${y.ja}はついていません</b>${y.desc}`, 'ng');
        }
      });
      box.appendChild(b);
    });
    const none = el('button', 'choice', '役なし<span class="lrow__d"><br>この中の役はひとつもつかない</span>');
    none.addEventListener('click', () => {
      if (!expect.length) { none.dataset.s = 'ok'; done(); return; }
      none.dataset.s = 'ng'; none.disabled = true; ctx.miss();
      ctx.say('<b>役はあります</b>もう一度、条件をひとつずつ確かめてください。', 'ng');
    });
    box.appendChild(none);
    ctx.actions([{
      label: '答えを見る', variant: 'ghost', onClick: () => {
        ctx.miss();
        box.querySelectorAll('.choice').forEach((x) => (x.disabled = true));
        ctx.solved(`<b>答え</b>${names()}`);
      },
    }]);
  };


  // ── 「どう指すか」の問題形式 ───────────────────────────────

  /** 危ない自分の駒を全部タップする（相手の狙いを読む訓練） */
  STEPS.danger = (ctx) => {
    const s = ctx.step;
    const game = ctx.lesson.game;
    const { board, opts, shape } = boardSpec(ctx, s);
    const cctx = game === 'chess' ? opts : shape;
    const position = game === 'chess' ? s.board : s.state.board;
    const side = game === 'chess' ? (s.side || 'w') : s.state.turn;

    const answer = K.hanging(game, position, side, cctx).map((h) => h.sq);
    ctx.prompt(s.prompt ||
      'いま<strong>取られると損をする自分の駒</strong>を、全部タップしてください。');
    board.setPosition(position, s.marks || {});

    if (!answer.length) { ctx.solved('この局面では、取られる駒はありません。'); return; }

    const picked = new Set();
    // 見つけた危ない駒にだけ印を付ける。大丈夫な駒に「正解」と同じ〇を付けると、間違えたのに合っていたように見える
    const marks = () => {
      const m = { ...(s.marks || {}) };
      for (const sq of picked) if (answer.includes(sq)) m[sq] = 'ng';
      return m;
    };
    const mine = (sq) => !!position[sq] && (game === 'chess' ? C.colorOf(position[sq]) : S.colorOf(position[sq])) === side;
    board.onPick = (sq) => {
      // 答えは自分の駒だけ。相手の駒や空きマスに触れても、ミスには数えない
      if (picked.has(sq) || !mine(sq)) return;
      picked.add(sq);
      board.setMarks(marks());
      if (!answer.includes(sq)) {
        ctx.miss();
        ctx.say('<b>その駒は大丈夫です</b>相手のどの駒がどこまで届くかを、1枚ずつたどってみてください。', 'ng');
        return;
      }
      sfx.place(game);
      const hit = [...picked].filter((x) => answer.includes(x));
      if (hit.length === answer.length) {
        board.onPick = null;
        // 守りのない駒と、守っていても安い駒に狙われている駒では、危ない理由がちがう
        const detail = K.hanging(game, position, side, cctx)
          .map((h) => (h.defended
            ? `${h.name}（守りはありますが、${h.by.name}の方が安い駒です。取り合うと${h.loss}点の損）`
            : `${h.name}（守りがなく、${h.by.name}にタダで取られます）`)).join('、');
        ctx.solved(`<b>全部見つかりました</b>${detail}。${s.why || ''}`);
      } else ctx.say(`あと ${answer.length - hit.length} 枚あります。`);
    };
    ctx.actions([{
      label: '答えを見る', variant: 'ghost', onClick: () => {
        ctx.miss();
        const m = { ...(s.marks || {}) };
        for (const sq of answer) m[sq] = 'ng';
        board.setMarks(m); board.onPick = null;
        ctx.solved('<b>ここが危ない駒です</b>');
      },
    }]);
  };

  /**
   * 次の一手。指した手をコーチが講評する。
   * 対局の悪手から作った問題では、次の指定も使う：
   *   avoid … 実戦で指した手（これは不正解）／deep … 対局と同じ基準（詰まされる手・短い読み）で講評する
   *   acceptMate … 詰ませる手は answers になくても正解／acceptStillMating … 詰みの手順が続く初手も正解
   */
  STEPS.bestmove = (ctx) => {
    const s = ctx.step;
    const game = ctx.lesson.game;
    const { board, opts, shape } = boardSpec(ctx, s);
    const cctx = game === 'chess' ? opts : shape;
    const before = game === 'chess' ? s.board : s.state.board;
    const side = game === 'chess' ? (s.side || 'w') : s.state.turn;
    const foe = game === 'chess' ? (side === 'w' ? 'b' : 'w') : S.opponent(side);
    let from = null, dropKind = null;
    let locked = false;   // 不正解の手を盤に残している間は、次の操作を受け付けない
    ctx.prompt(s.prompt || '<strong>いちばん良い手</strong>を1手指してください。');
    if (s.note) ctx.mount.appendChild(el('p', 'note', s.note));
    const paint = (extra = {}) => board.setPosition(before, { ...(s.marks || {}), ...extra });
    paint();

    // 将棋で持ち駒があれば、盤の下に出して打てるようにする
    let handHost = null, paintHand = () => {};
    if (game === 'shogi' && Object.keys(s.state.hands?.[side] || {}).length) {
      handHost = el('div', 'hand');
      ctx.mount.appendChild(handHost);
      paintHand = () => renderHand(handHost, s.state.hands[side], {
        label: 'あなたの持ち駒', order: S.HAND_ORDER, selected: dropKind,
        onPick: (k) => {
          if (locked) return;
          dropKind = dropKind === k ? null : k;
          from = null;
          const m = {};
          if (dropKind) for (const t of S.legalDrops(s.state, dropKind, shape)) m[t] = 'move';
          paint(m); paintHand();
        },
      });
      paintHand();
    }

    const same = (a, b) => !!a && !!b && a.to === b.to && (a.from || null) === (b.from || null) && (a.drop || null) === (b.drop || null);
    const accept = (move) => (s.answers ? s.answers.some((a) => same(a, move)) : null);

    const commit = (move, after, nextState) => {
      const mate = game === 'chess'
        ? C.gameStatus(after, foe, cctx) === 'checkmate'
        : S.isMate(nextState, cctx);
      const info = { mate, stalemate: game === 'chess' && !mate && C.gameStatus(after, foe, cctx) === 'stalemate' };
      if (s.deep && !mate) {
        if (game === 'chess') {
          info.allowsMate = C.findMateIn1(after, foe, cctx)[0];
          info.search = { before: { b: before, turn: side }, after: { b: after, turn: foe } };
        } else {
          info.allowsMate = S.findMateIn1(nextState, shape)[0];
          info.hands = s.state.hands;
          info.search = { before: s.state, after: nextState };
        }
      }
      const review = move.drop
        ? K.explainMove(game, before, after, { from: null, to: move.to, drop: move.drop }, side, cctx, { ...info, onlyDeep: !info.allowsMate })
        : K.explainMove(game, before, after, move, side, cctx, info);
      const explicit = accept(move);
      let good = explicit !== null ? explicit : review.level === 'ok';
      // 詰ませる手は、正解の一覧になくても正解（詰みより良い手はない）。詰ませてほしくない問題だけ acceptMate: false にする
      if (!good && mate && s.acceptMate !== false) good = true;
      // 対局の悪手から作った問題：詰みへの捨て駒（相手がどう受けても次に詰む手）も正解
      let mateNext = false;
      if (!good && !mate && s.deep) {
        mateNext = game === 'chess' ? C.stillMating(after, side, cctx) : S.stillMating(nextState, shape);
        if (mateNext) good = true;
      }
      if (!good && s.alsoAccept?.some((a) => same(a, move))) good = true;
      // 「詰まされない手を指す」問題：相手の1手詰めが消えていれば正解（ほかの損は講評で伝える）
      if (!good && s.acceptNoMate && !mate) {
        const threat = game === 'chess' ? C.findMateIn1(after, foe, cctx) : S.findMateIn1(nextState, shape);
        if (!threat.length) good = true;
      }
      if (!good && s.acceptStillMating) {
        good = game === 'chess' ? C.stillMating(after, side, cctx) : S.stillMating(nextState, shape);
      }
      // 必至の問題（対局で必至を逃した局面から作ったもの）：どう受けても次に詰む手なら、答えと違っても正解
      if (!good && !mate && s.acceptHisshi && game === 'shogi' && !S.inCheck(nextState.board, nextState.turn, shape)
        && K.mateRun('shogi', nextState, side, shape, 1500) === 1) { good = true; mateNext = true; }
      const repeated = s.avoid && same(s.avoid, move);
      if (repeated) good = false;
      board.setPosition(after, { ...(move.from ? { [move.from]: 'last' } : {}), [move.to]: 'last' });
      before[move.to] ? sfx.capture(game) : sfx.place(game);

      if (good) {
        board.onPick = null;
        if (handHost) renderHand(handHost, nextState?.hands?.[side] || {}, { label: 'あなたの持ち駒', order: S.HAND_ORDER });
        // 詰み・詰みへの手で正解したときは、駒の損得の講評（「取られる場所です」など）を出さない
        const okText = mate && !(explicit && s.why) ? (game === 'chess' ? 'チェックメイトです。' : '詰みです。')
          : mateNext ? '相手がどう受けても、次の手で詰みます。駒の損得より詰みが先です。'
            : s.why || review.lines.map((l) => l.what).join(' ');
        ctx.solved(`<b>その手です</b>${okText}`);
        return;
      }
      ctx.miss();
      const l = review.lines[0];
      const stalemate = game === 'chess'
        && C.gameStatus(after, foe, cctx) === 'stalemate';
      if (repeated) {
        ctx.say('<b>実戦で指した手と同じです</b>'
          + `${l && review.level !== 'ok' ? `${l.what}<br><span class="note">${l.why || ''}</span>`
            : s.acceptHisshi ? 'この手では、相手玉への寄せが遅れます。王手をせずに、どう受けても次に詰む手を探してください。'
              : 'この手で損をしました。別の手を探してください。'}`
          + `${s.hint ? `<br><span class="note">ヒント：${s.hint}</span>` : ''}`, 'ng');
      } else if (stalemate) {
        ctx.say('<b>ステイルメイトです</b>相手は動ける手がないのに、チェックされていません。これでは引き分けです。'
          + `${s.hint ? `<br>${s.hint}` : ''}`, 'ng');
      } else if (review.level === 'ok') {
        // 危険ではないが、この問題で狙ってほしい手ではない（s.wrong があればその説明を優先）
        ctx.say(s.wrong ? `<b>${s.wrong}</b>` : `<b>その手も悪くありません</b>ただ、ここで見つけてほしいのは別の手です。`
          + `${s.hint ? `<br>${s.hint}` : ''}`, 'ng');
      } else {
        ctx.say(`<b>${review.level === 'blunder' ? 'それは危ない手です' : 'おしい'}</b>`
          + `${l.what}<br><span class="note">${l.why}</span>`
          + `${l.better ? `<br><span class="note">こうすれば：${l.better.label}</span>` : ''}`, 'ng');
      }
      locked = true;
      setTimeout(() => { if (!ctx.alive()) return; locked = false; from = null; dropKind = null; paint(); paintHand(); }, 1200);
    };

    board.onPick = (sq) => {
      if (locked) return;
      if (game === 'shogi' && dropKind) {
        if (!S.legalDrops(s.state, dropKind, shape).includes(sq)) return;
        const mv = { drop: dropKind, to: sq };
        const next = S.applyMove(s.state, mv, shape);
        dropKind = null;
        return commit(mv, next.board, next);
      }
      const mine = (x) => before[x] &&
        (game === 'chess' ? C.colorOf(before[x]) === side : S.colorOf(before[x]) === side);
      const targets = (x) => game === 'chess'
        ? C.legalMoves(before, x, opts)
        : [...new Set(S.legalMovesFrom(s.state, x, shape).map((m) => m.to))];
      const hint = (x) => K.moveMarks(game, before, x, targets(x), side, cctx, {
        showMoves: settings.get('showMoves'),
        warnUnsafe: s.warnUnsafe ?? false,   // 次の一手は自分で見つける問題なので既定では警告しない
        showThreat: settings.get('showThreat'),
      });
      if (from === null) {
        if (!mine(sq)) return;
        from = sq; paint(hint(sq));
        return;
      }
      if (sq === from) { from = null; paint(); return; }
      if (!targets(from).includes(sq)) {
        if (mine(sq)) { from = sq; paint(hint(sq)); }
        return;
      }
      if (game === 'chess') {
        const mv = { from, to: sq };
        const after = C.applyMove(before, from, sq, opts);
        from = null;
        return commit(mv, after, null);
      }
      // 将棋：成り・不成のどちらも指せるときは、指す人に聞く（詰みの問題と同じ）。
      // 以前は正解データに合わせて自動で決めていたので、成るかどうかを自分で判断する機会がなかった
      const cands = S.legalMovesFrom(s.state, from, shape).filter((m) => m.to === sq);
      const mfrom = from;
      from = null;
      const go = (mv) => { const next = S.applyMove(s.state, mv, shape); commit(mv, next.board, next); };
      const promo = cands.find((m) => m.promote), plain = cands.find((m) => !m.promote);
      if (promo && plain) { askPromote(mfrom, sq, promo, plain, go); return; }
      go(cands[0]);
    };

    /** 盤の下に「成る／成らない」を出す。選ぶまで盤は止める */
    let promoBox = null;
    function askPromote(mfrom, sq, promo, plain, go) {
      locked = true;
      promoBox?.remove();
      promoBox = el('div', 'actions');
      promoBox.setAttribute('role', 'group');
      promoBox.setAttribute('aria-label', '成りますか');
      const yes = el('button', 'btn btn--tone btn--sm', '成る');
      const no = el('button', 'btn btn--ghost btn--sm', '成らない');
      const back = el('button', 'btn btn--ghost btn--sm', 'やめる');
      const close = () => { promoBox?.remove(); promoBox = null; locked = false; };
      yes.addEventListener('click', () => { close(); go(promo); });
      no.addEventListener('click', () => { close(); go(plain); });
      back.addEventListener('click', () => { close(); paint(); paintHand(); });
      promoBox.append(el('span', 'note', '成りますか？'), yes, no, back);
      ctx.mount.appendChild(promoBox);
      paint({ [mfrom]: 'sel', [sq]: 'move' });
      yes.focus();
    }

    ctx.actions([{
      label: 'ヒント', variant: 'ghost', onClick: () => {
        ctx.miss();
        ctx.say(`<b>ヒント</b>${s.hint || '相手の駒でタダで取れるものはありませんか。次に自分の駒が取られないかも見てください。'}`);
      },
    }]);
  };

  /** 何切る。受け入れ枚数で採点する */
  STEPS.discard = (ctx) => {
    const s = ctx.step;
    const sets = s.sets || 4;
    const hand = s.tiles
      ? M.sortTiles(s.tiles)
      : (() => {
          const deal = () => {
            const w = M.makeWall(s.honors === false ? M.ALL_TILES.filter((t) => !M.isHonor(t)) : M.ALL_TILES);
            return M.sortTiles(w.slice(0, sets * 3 + 2));
          };
          if (!s.goodOnly) return deal();
          // 良問だけ：テンパイに近く（2シャンテン以内）、最善がはっきりしている手を選ぶ
          //   最善と同じシャンテン数の候補のうち、2番手より受け入れが4枚以上多い（または最善の牌が1種類だけ）
          for (let k = 0; k < 300; k++) {
            const h = deal();
            const t = K.ukeire(h, sets);
            if (!t.length || t[0].shanten > 2 || t[0].shanten < 0) continue;
            const same = t.filter((r) => r.shanten === t[0].shanten);
            const tops = same.filter((r) => r.tiles === same[0].tiles);
            const next = same.find((r) => r.tiles < same[0].tiles);
            if (tops.length > 2) continue;
            if (!next || same[0].tiles - next.tiles >= 4) return h;
          }
          return deal();
        })();

    ctx.prompt(s.prompt || 'この手から<strong>1枚だけ</strong>切るとしたら、どれを切りますか。');
    const host = el('div');
    ctx.mount.appendChild(host);
    const note = el('p', 'note');
    ctx.mount.appendChild(note);

    const table = K.ukeire(hand, sets);
    const best = table[0];

    const paint = (states, disabled) => renderTiles(host, hand, {
      states, disabled,
      onPick: (i, t) => {
        const rv = K.explainDiscard(hand, t, sets);
        const l = rv.lines[0];
        sfx.place('mahjong');
        // strict の問題は、最善と同じ（シャンテン数も受け入れ枚数も同じ）牌だけを正解にする
        const mine = table.find((r) => r.tile === t);
        const good = s.strict
          ? !!mine && mine.shanten === best.shanten && mine.tiles === best.tiles
          : rv.level === 'ok';
        if (s.strict && !good && rv.level === 'ok') {
          ctx.miss();
          const st = {};
          hand.forEach((x, j) => { if (x === t) st[j] = 'ng'; });
          paint(st, false);
          ctx.say(`<b>悪くはありませんが、もっと良い牌があります</b>`
            + `<span class="note">${M.tileName(t)}切りの受け入れは${mine ? mine.tiles : 0}枚。最善は${best.tiles}枚です。</span>`
            + `${s.hint ? `<br><span class="note">ヒント：${s.hint}</span>` : ''}`, 'ng');
          return;
        }
        const st = {};
        hand.forEach((x, j) => { if (x === t) st[j] = good ? 'ok' : 'ng'; });
        if (good) {
          paint(st, true);
          note.innerHTML = tableHTML(table, t);
          ctx.solved(`<b>${l.what}</b>${l.why || ''}${l.better ? `<br><span class="note">${l.better.label}：${l.better.reason}</span>` : ''}`
            + `${s.why ? `<br>${s.why}` : ''}`);
        } else {
          ctx.miss();
          paint(st, false);
          ctx.say(`<b>${l.what}</b><span class="note">${l.why}</span>`
            + `${l.better ? `<br><span class="note">こうすれば：${l.better.label}（${l.better.reason}）</span>` : ''}`
            + `${l.lesson ? `<br><span class="note">${l.lesson}</span>` : ''}`
            + `${s.hint ? `<br><span class="note">ヒント：${s.hint}</span>` : ''}`, 'ng');
        }
      },
    });
    paint({}, false);

    ctx.actions([{
      label: '答えを見る', variant: 'ghost', onClick: () => {
        ctx.miss();
        const tied = table.filter((r) => r.shanten === best.shanten && r.tiles === best.tiles);
        const st = {};
        hand.forEach((x, j) => { if (tied.some((r) => r.tile === x)) st[j] = 'ok'; });
        paint(st, true);
        note.innerHTML = tableHTML(table, best.tile);
        ctx.solved(tied.length > 1
          ? `<b>${tied.map((r) => M.tileName(r.tile)).join('・')}のどれでも同じです</b>`
            + `どれを切っても${best.kinds}種${best.tiles}枚を受け入れます。`
            + `<span class="note">迷ったら、いちばん使い道の少ない牌（字牌→端→中）から切ります。</span>`
          : `<b>${M.tileName(best.tile)}切りが最善です</b>${best.kinds}種${best.tiles}枚を受け入れます。${s.why ? `<br>${s.why}` : ''}`);
      },
    }]);
  };

  function tableHTML(table, chosen) {
    const rows = table.slice(0, 5).map((r) =>
      `<tr${r.tile === chosen ? ' style="font-weight:700"' : ''}>
         <td>${M.tileName(r.tile)}切り</td>
         <td>${r.shanten === 0 ? 'テンパイ' : `あと${r.shanten}枚`}</td>
         <td>${r.kinds}種 ${r.tiles}枚</td></tr>`).join('');
    // シャンテン数は「テンパイまで」の枚数。あがりまではさらに1枚要る
    return `<table class="ukeire"><thead><tr><th>切る牌</th><th>テンパイまで</th><th>受け入れ</th></tr></thead><tbody>${rows}</tbody></table>`;
  }


  /**
   * 7手以上の詰将棋の「正しい初手」と「間違った初手への逃れ方」。
   * 相手の受けは毎回読んで選ぶが、長い詰将棋は読みが重く、遅い端末では時間切れで詰む受けを選ぶことがあった
   * （間違った初手でも正解になる）。問題は決まっているので、初手の分だけ前もって計算して持っておく。
   * キーは問題の局面（tsumeKey）。問題を足したり変えたりしたら、tools/verify_puzzles.py --tsume-book で作り直す。
   * ここにない局面は、これまでどおりその場で読む。
   */
  const TSUME_BOOK = {"15B,22k,99K|G2/":{"n":7,"sol":["G*33"],"ref":{"1533":"2223","1533+":"2233","G*21":"2223","G*32":"2213","G*12":"2223","G*23":"2223","G*13":"2213"}},"31k,51+B,99K|R1S1/":{"n":7,"sol":["R*33"],"ref":{"5141":"3141","5142":"3142","R*41":"3132","R*21":"3132","R*11":"3132","R*32":"3132","R*34":"3121","R*35":"3121","R*36":"3121","R*37":"3121","R*38":"3121","R*39":"3121","S*42":"3122","S*32":"3132","S*22":"3122"}},"11k,34s,99K|B1R1/":{"n":7,"sol":["B*33"],"ref":{"R*91":"1112","R*81":"1112","R*71":"1112","R*61":"1112","R*51":"1112","R*41":"1112","R*31":"1112","R*21":"1112","R*12":"1112","R*13":"1122","R*14":"1122","R*15":"1122","R*16":"1122","R*17":"1122","R*18":"1122","R*19":"1122","B*22":"1112","B*44":"1112","B*55":"1112","B*66":"1112","B*77":"1112","B*88":"1112"}},"41k,54L,99K|B1R1/":{"n":7,"sol":["B*23"],"ref":{"5452+":"4152","5451+":"4142","R*91":"4142","R*81":"4142","R*71":"4142","R*61":"4142","R*51":"4142","R*31":"4131","R*21":"4142","R*11":"4142","R*42":"4142","R*43":"4132","R*44":"4132","R*45":"4132","R*46":"4132","R*47":"4132","R*48":"4132","R*49":"4132","B*52":"4142","B*32":"4142","B*63":"4142","B*74":"4142","B*14":"4142","B*85":"4142","B*96":"4142"}},"31k,34G,53g,99K|G1R1/":{"n":7,"sol":["R*71"],"ref":{"R*91":"3142","R*81":"3142","R*61":"3142","R*51":"3142","R*41":"3132","R*21":"3132","R*11":"3142","R*32":"3132","R*33":"3142","G*41":"3132","G*21":"3132","G*42":"3142","G*32":"3132","G*22":"3142"}},"21k,33L,41S,99K|R1S1/":{"n":7,"sol":["4132"],"ref":{"3332+":"2112","3331+":"2122","4132+":"2112","R*31":"2122","R*11":"2122","R*22":"2122","R*23":"2112","R*24":"2112","R*25":"2112","R*26":"2112","R*27":"2112","R*28":"2112","R*29":"2112","S*32":"2112","S*22":"2122","S*12":"2122"}},"11k,15B,22l,99K|G2N1/":{"n":9,"sol":["N*23"],"ref":{"G*21":"1112","G*12":"1112"}},"12L,15B,21k,99K|G2P1/":{"n":9,"sol":["1211+"],"ref":{"G*31":"2122","G*11":"2122","G*32":"2132","G*22":"2122","P*22":"2112"}},"12k,13s,15B,99K|G2R1/":{"n":9,"sol":["R*32"],"ref":{"G*11":"1223","G*22":"1222","G*23":"1223","R*11":"1223","R*92":"1223","R*82":"1223","R*72":"1223","R*62":"1223","R*52":"1223","R*42":"1223","R*22":"1222"}}};
  const tsumeKey = (st) => Object.keys(st.board).sort().map((k) => k + st.board[k]).join(',')
    + '|' + ['b', 'w'].map((c) => Object.keys(st.hands?.[c] || {}).sort().map((k) => k + st.hands[c][k]).join('')).join('/');
  const shogiMoveKey = (m) => (m.drop ? `${m.drop}*${m.to}` : `${m.from}${m.to}${m.promote ? '+' : ''}`);

  /** 三手詰めなど、複数手で詰ませる問題。相手は最善で逃げる */
  STEPS.mateIn = (ctx) => {
    const s = ctx.step;
    const game = ctx.lesson.game;
    const { board, opts, shape } = boardSpec(ctx, s);
    const limit = s.moves || 3;              // 何手で詰ませるか（自分の手数は (limit+1)/2）
    const side = game === 'chess' ? (s.side || 'w') : 'b';
    const foe = game === 'chess' ? (side === 'w' ? 'b' : 'w') : 'w';

    let position = game === 'chess' ? { ...s.board } : null;
    let state = game === 'shogi' ? JSON.parse(JSON.stringify(s.state)) : null;
    let from = null, ply = 0, dropKind = null, handHost = null, busy = false, token = 0;
    let firstMove = null;   // 将棋：自分の初手（長い詰将棋で、前もって計算した逃れ方を引くため）

    // 手数の数え方：将棋は両者の手を数える（3手詰め）。チェスは自分の手だけを数える（2手で詰み＝両者で3手）
    const shownMoves = game === 'chess' ? Math.ceil(limit / 2) : limit;
    ctx.prompt(s.prompt || `<strong>${shownMoves}手</strong>で詰ませてください。相手は最善を尽くして逃げます。`);
    const info = el('p', 'note');
    ctx.mount.appendChild(info);
    // 詰将棋の約束ごと：ここでは玉方（相手）は持ち駒を持たない。合駒は盤上の駒を動かすだけ
    if (game === 'shogi' && !Object.keys(s.state?.hands?.w || {}).length) {
      ctx.mount.appendChild(el('p', 'note', 'この問題では、相手は持ち駒を持っていません（駒を打って合駒をすることはありません）。'));
    }

    const pos = () => (game === 'chess' ? position : state.board);
    const paint = (extra = {}) => board.setPosition(pos(), extra);

    const reset = () => {
      token++;
      promoBox?.remove(); promoBox = null;
      position = game === 'chess' ? { ...s.board } : null;
      state = game === 'shogi' ? JSON.parse(JSON.stringify(s.state)) : null;
      from = null; dropKind = null; ply = 0; busy = false; firstMove = null;
      ctx.clear(); paint(); paintHand();
      info.textContent = game === 'chess' ? `${shownMoves}手で詰ませます。あなたの手番です。` : `${limit}手詰め。あなたの手番です。`;
    };

    function paintHand() {
      if (game !== 'shogi') return;
      const hands = state.hands[state.turn] || {};
      if (!Object.keys(hands).length) { if (handHost) handHost.innerHTML = ''; return; }
      if (!handHost) { handHost = el('div', 'hand'); ctx.mount.appendChild(handHost); }
      renderHand(handHost, hands, {
        label: 'あなたの持ち駒', order: S.HAND_ORDER, selected: dropKind,
        onPick: (k) => {
          dropKind = dropKind === k ? null : k;
          from = null;
          const m = {};
          if (dropKind) for (const t of S.legalDrops(state, dropKind, shape)) m[t] = 'move';
          paint(m); paintHand();
        },
      });
    }

    const mated = () => game === 'chess'
      ? C.gameStatus(position, foe, opts) === 'checkmate'
      : S.gameStatus(state, shape) === 'checkmate';
    const checking = () => game === 'chess'
      ? C.inCheck(position, foe, opts)
      : S.inCheck(state.board, 'w', shape);

    const fail = (msg) => {
      ctx.miss();
      busy = true;   // やり直しまでの間は盤を止める
      ctx.say(`<b>${msg}</b>${s.hint ? `<br><span class="note">${s.hint}</span>` : ''}`, 'ng');
      const my = ++token;
      setTimeout(() => { if (my === token) { reset(); ctx.say(`<b>${msg}</b>もう一度どうぞ。${s.hint ? `<br><span class="note">${s.hint}</span>` : ''}`, 'ng'); } }, 1400);
    };

    /** 相手の受け。詰まされにくい手を選ぶ。読みはスレッドで行うので、そのあいだも画面は止まらない */
    async function defend(my) {
      const job = { game, position, state, side, foe, opts, shape, limit, ply };
      let pick = null;
      // 長い詰将棋の初手が間違いなら、前もって計算した逃れ方で受ける（読みの時間切れで詰む受けを選ばないように）
      if (game === 'shogi' && ply === 1 && firstMove) {
        const rk = TSUME_BOOK[tsumeKey(s.state)]?.ref?.[shogiMoveKey(firstMove)];
        if (rk) pick = S.allLegalMoves(state, shape).find((m) => shogiMoveKey(m) === rk) || null;
      }
      if (!pick) pick = await NS_THINK.run('mateDefend', [job], 8000, () => null);
      if (my !== token || !ctx.alive()) return false;   // 読んでいる間に「やり直す」が押された／画面を離れた
      if (!pick) {
        // 読めなかったとき（時間切れなど）は、指せる手から選ぶ
        pick = (game === 'chess' ? C.allLegalMoves(position, foe, opts) : S.allLegalMoves(state, shape))[0];
        if (!pick) return true;
      }
      if (game === 'chess') {
        position = C.applyMove(position, pick.from, pick.to, opts);
        paint({ [pick.from]: 'last', [pick.to]: 'last' });
      } else {
        state = S.applyMove(state, pick, shape);
        paint({ ...(pick.from ? { [pick.from]: 'last' } : {}), [pick.to]: 'last' });
      }
      paintHand();
      return true;
    }

    function afterMyMove(label) {
      ply++;
      if (mated()) {
        board.onPick = null;
        ctx.solved(`<b>詰みました</b>${s.why || `${ply}手で仕留めました。`}`);
        return;
      }
      const mustCheck = s.mustCheck ?? (game === 'shogi');
      if (mustCheck && !checking()) {
        return fail(game === 'shogi'
          ? '王手が続いていません。詰将棋では毎手かならず王手をかけます。'
          : '王手が続いていません。この問題は、王手を続けて詰ませます。');
      }
      // ply は両者の手数。limit 手目（最後の自分の手）で詰んでいなければ失敗
      if (ply >= limit) return fail(`${shownMoves}手では詰みませんでした。`);
      const stuck = game === 'chess' && !C.allLegalMoves(position, foe, opts).length;
      if (stuck) return fail('相手が動けなくなりました。王手がかかっていないので、チェスではステイルメイト（引き分け）です。');
      info.textContent = '相手が逃げます…';
      busy = true;
      const my = ++token;
      setTimeout(async () => {
        if (my !== token) return;
        if (!(await defend(my))) return;
        ply++;
        busy = false;
        info.textContent = game === 'chess' ? `あと${Math.ceil((limit - ply) / 2)}手で詰ませます。` : `あと${limit - ply}手で詰ませます。`;
      }, 520);
    }

    board.onPick = (sq) => {
      if (busy) return;
      const p = pos();
      if (game === 'shogi' && dropKind) {
        if (!S.legalDrops(state, dropKind, shape).includes(sq)) return;
        if (ply === 0) firstMove = { drop: dropKind, to: sq };
        state = S.applyMove(state, { drop: dropKind, to: sq }, shape);
        dropKind = null; paint({ [sq]: 'last' }); paintHand(); sfx.place('shogi');
        return afterMyMove();
      }
      const mine = (x) => p[x] && (game === 'chess'
        ? C.colorOf(p[x]) === side : S.colorOf(p[x]) === 'b');
      const targets = (x) => game === 'chess'
        ? C.legalMoves(position, x, opts)
        : S.legalMovesFrom(state, x, shape).map((m) => m.to);
      if (from === null) {
        if (!mine(sq)) return;
        from = sq;
        const m = { [sq]: 'sel' };
        for (const t of targets(sq)) m[t] = 'move';
        paint(m);
        return;
      }
      if (sq === from) { from = null; paint(); return; }
      if (!targets(from).includes(sq)) {
        if (mine(sq)) { from = sq; const m = { [sq]: 'sel' }; for (const t of targets(sq)) m[t] = 'move'; paint(m); }
        return;
      }
      if (game === 'chess') {
        position = C.applyMove(position, from, sq, opts);
        paint({ [from]: 'last', [sq]: 'last' });
      } else {
        const cands = S.legalMovesFrom(state, from, shape).filter((m) => m.to === sq);
        const promo = cands.find((m) => m.promote), plain = cands.find((m) => !m.promote);
        const mfrom = from;
        const commit = (mv) => {
          if (ply === 0) firstMove = mv;
          state = S.applyMove(state, mv, shape);
          paint({ [mfrom]: 'last', [sq]: 'last' });
          paintHand();
          sfx.place(game);
          from = null;
          afterMyMove();
        };
        // 成る・成らないの両方が指せるときは聞く。詰将棋では「不成」が正解の問題もある
        if (promo && plain) { askPromoteInline(promo, plain, commit); return; }
        return commit(cands[0]);
      }
      sfx.place(game);
      from = null;
      afterMyMove();
    };

    /** 盤の下に「成る／成らない」を出す。やり直しボタンは残したいので actions は使わない */
    let promoBox = null;
    function askPromoteInline(promo, plain, commit) {
      busy = true;
      const my = token;
      promoBox?.remove();
      promoBox = el('div', 'actions');
      promoBox.setAttribute('role', 'group');
      promoBox.setAttribute('aria-label', '成りますか');
      const q = el('span', 'note', '成りますか？');
      const yes = el('button', 'btn btn--tone btn--sm', '成る');
      const no = el('button', 'btn btn--ghost btn--sm', '成らない');
      const pick = (mv) => {
        promoBox?.remove(); promoBox = null;
        if (my !== token) return;   // 聞いている間に「やり直す」が押された
        busy = false;
        commit(mv);
      };
      yes.addEventListener('click', () => pick(promo));
      no.addEventListener('click', () => pick(plain));
      promoBox.append(q, yes, no);
      info.after(promoBox);
      yes.focus();
    }

    reset();
    ctx.actions([
      { label: 'やり直す', variant: 'ghost', onClick: reset },
      { label: 'ヒント', variant: 'ghost', onClick: () => {
        ctx.miss();
        ctx.say(`<b>ヒント</b>${s.hint || '先に相手の玉（キング）の逃げ道を全部数えてください。手はそのあとです。'}`);
      } },
    ]);
  };

  /** 捨て牌を見て、いちばん安全な牌を選ぶ */
  STEPS.safetile = (ctx) => {
    const s = ctx.step;
    const discards = s.discards || M.sortTiles(M.makeWall().slice(0, 8));
    const fake = {
      discards: [[], discards.map((t) => ({ tile: t })), [], []],
      melds: [[], [], [], []],
    };
    const cands = s.candidates || (() => {
      const pool = M.ALL_TILES.filter((t) => !discards.includes(t));
      return M.sortTiles([discards[0], ...shuffle(pool).slice(0, 4)]);
    })();
    const scored = cands.map((t) => ({ t, d: MJAI.danger(fake, t, 1) }))
      .sort((a, b) => a.d - b.d);
    const bestD = scored[0].d;

    ctx.prompt(s.prompt || '南家がリーチしています。下が南家の捨て牌です。<strong>いちばん安全な牌</strong>を選んでください。');
    const dh = el('div'); ctx.mount.appendChild(dh);
    renderTiles(dh, discards, { disabled: true, tight: true });
    ctx.mount.appendChild(el('p', 'note', 'あなたの手牌から、切る候補はこちらです。'));
    const ch = el('div'); ctx.mount.appendChild(ch);

    const picked = new Set();
    let finished = false;
    const paint = () => {
      const st = {};
      cands.forEach((t, i) => { if (picked.has(i)) st[i] = MJAI.danger(fake, t, 1) === bestD ? 'ok' : 'ng'; });
      renderTiles(ch, cands, {
        states: st,
        onPick: (i, t) => {
          if (picked.has(i) || finished) return;
          picked.add(i); paint();
          const d = MJAI.danger(fake, t, 1);
          if (d === bestD) {
            finished = true;
            const why = d === 0
              ? `${M.tileName(t)}は南家自身が捨てている牌（現物）です。フリテンのルールにより100%当たりません。`
              : `${M.tileName(t)}がこの中ではいちばん安全です。`;
            ctx.solved(`<b>正解</b>${why}`);
          } else {
            ctx.miss();
            ctx.say(`<b>${M.tileName(t)}は危険です</b>${
              MJAI.sujiOf(t, new Set(discards)) === 'full' ? 'スジなので両面には当たりませんが、単騎・双ポン・嵌張には当たります。現物のほうが安全です。'
              : MJAI.sujiOf(t, new Set(discards)) === 'half' ? '片スジです。もう片側の両面には当たります。'
              : M.isHonor(t) ? `字牌ですが、見えているのは${discards.filter((x) => x === t).length}枚だけです。単騎や双ポンで待たれます。`
              : Number(t[1]) >= 3 && Number(t[1]) <= 7 ? '3〜7の牌は両面待ちの両側になりやすく、いちばん当たりやすい牌です。'
              : Number(t[1]) === 2 || Number(t[1]) === 8 ? '2と8は、3〜7の次に当たりやすい牌です。'
              : '1と9は端の牌で比較的安全ですが、現物ではありません。'}`, 'ng');
          }
        },
      });
    };
    paint();
    ctx.actions([{ label: '答えを見る', variant: 'ghost', onClick: () => {
      ctx.miss();
      const st = {}; cands.forEach((t, i) => { st[i] = MJAI.danger(fake, t, 1) === bestD ? 'ok' : 'dim'; });
      renderTiles(ch, cands, { states: st, disabled: true });
      ctx.solved(`<b>答え</b>${M.tileName(scored[0].t)}がいちばん安全です。`);
    } }]);
  };


  /**
   * 目標の形ができるまで、自由に指す。
   * 「囲いを組む」のように、手順ではなく形を覚えてほしいときに使う。
   */
  // ── チェス：数手の組み合わせで駒得する問題
  //    s.moves = 自分が指す手数（2なら「自分・相手・自分」）、s.gain = 最低これだけ得すれば正解
  //    判定は駒の点数だけで読む小さな探索（取り合いは最後まで読む）。相手は最善の応手を選ぶ。
  const TAC_VALUE = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };
  const tacMaterial = (b) => Object.values(b).reduce(
    (a, p) => a + (p === p.toUpperCase() ? 1 : -1) * TAC_VALUE[p.toUpperCase()], 0);
  // 取る手（高い駒を安い駒で取る手）から読む。読みの結果は変わらず、枝刈りが効いて速くなる
  const tacOrder = (b, ms) => ms
    .map((mv) => ({ mv, k: b[mv.to] ? 100 + TAC_VALUE[b[mv.to].toUpperCase()] * 10 - TAC_VALUE[b[mv.from].toUpperCase()] : 0 }))
    .sort((x, y) => y.k - x.k).map((x) => x.mv);
  function tacQuiet(b, turn, alpha, beta, depth, opts) {
    const stand = tacMaterial(b);
    if (depth === 0) return stand;
    const caps = tacOrder(b, C.allLegalMoves(b, turn, opts).filter((mv) => b[mv.to]));
    if (turn === 'w') {
      let best = stand;
      if (best >= beta) return best;
      alpha = Math.max(alpha, best);
      for (const mv of caps) {
        best = Math.max(best, tacQuiet(C.applyMove(b, mv.from, mv.to, opts), 'b', alpha, beta, depth - 1, opts));
        alpha = Math.max(alpha, best);
        if (alpha >= beta) break;
      }
      return best;
    }
    let best = stand;
    if (best <= alpha) return best;
    beta = Math.min(beta, best);
    for (const mv of caps) {
      best = Math.min(best, tacQuiet(C.applyMove(b, mv.from, mv.to, opts), 'w', alpha, beta, depth - 1, opts));
      beta = Math.min(beta, best);
      if (alpha >= beta) break;
    }
    return best;
  }
  function tacSearch(b, turn, d, alpha, beta, opts) {
    const ms = C.allLegalMoves(b, turn, opts);
    if (!ms.length) return C.inCheck(b, turn, opts) ? (turn === 'w' ? -1000 - d : 1000 + d) : 0;
    if (d === 0) return tacQuiet(b, turn, alpha, beta, 3, opts);
    const next = turn === 'w' ? 'b' : 'w';
    let best = turn === 'w' ? -1e9 : 1e9;
    for (const mv of tacOrder(b, ms)) {
      const v = tacSearch(C.applyMove(b, mv.from, mv.to, opts), next, d - 1, alpha, beta, opts);
      if (turn === 'w') { best = Math.max(best, v); alpha = Math.max(alpha, best); }
      else { best = Math.min(best, v); beta = Math.min(beta, best); }
      if (alpha >= beta) break;
    }
    return best;
  }

  STEPS.combo = (ctx) => {
    const s = ctx.step;
    const total = s.moves || 2;
    const need = s.gain ?? 3;
    ctx.prompt(s.prompt || `<strong>${total}手</strong>の組み合わせで駒得してください。相手は最善で応じます。`);
    const { board, opts } = boardSpec(ctx, s);
    const info = el('p', 'note');
    ctx.mount.appendChild(info);
    const base = tacMaterial(s.board);
    let position, from, n, busy, token = 0;

    const paint = (extra = {}) => board.setPosition(position, extra);
    const reset = () => {
      token++;
      position = { ...s.board }; from = null; n = 0; busy = false;
      ctx.clear(); paint();
      info.textContent = `あなたの番です（あと${total}手）。`;
    };
    const fail = (msg) => {
      ctx.miss();
      busy = true;
      const my = ++token;
      ctx.say(`<b>${msg}</b>${s.hint ? `<br><span class="note">${s.hint}</span>` : ''}`, 'ng');
      setTimeout(() => { if (my === token) { reset(); ctx.say(`<b>${msg}</b>もう一度どうぞ。`, 'ng'); } }, 1600);
    };
    const win = (msg) => {
      busy = true;
      ctx.solved(`<b>${msg}</b>${s.why || ''}`);
    };

    const afterMyMove = (mark) => {
      n++;
      paint(mark);
      if (C.gameStatus(position, 'b', opts) === 'checkmate') return win('チェックメイトです');
      const left = total - n;
      // 相手の応手から先を読んで、最後にどれだけ得をしているか
      // 読みの深さは3手まで（それ以上はスマホで数十秒かかる）。取り合いは静かな局面まで読む
      // まだ手が残っているときに知りたいのは「need 点以上の得が残るか」だけなので、その境目だけを読む。
      // 全部を読むと、静かな手を指したときに画面が数秒〜十数秒固まっていた
      const depth = Math.min(3, 1 + 2 * left);
      const v = (left === 0
        ? tacSearch(position, 'b', depth, -1e9, 1e9, opts)
        : tacSearch(position, 'b', depth, base + need - 1, base + need, opts)) - base;
      if (v >= 900) {
        if (left === 0) return win('詰みが見えています');
      } else if (v < need) {
        return fail(n === 1 ? 'その手では、相手にうまく応じられてしまいます。' : 'ここで決めきれませんでした。');
      }
      if (left === 0) return win(`駒得が決まりました（+${v}点）`);
      busy = true;
      info.textContent = '相手が応じます…';
      const my = token;
      setTimeout(() => {
        if (my !== token) return;
        // 相手は、こちらの得がいちばん小さくなる手を選ぶ
        let pick = null, bestV = Infinity;
        for (const mv of C.allLegalMoves(position, 'b', opts)) {
          // いまの最善より良いかどうかだけ分かればよいので、上限を bestV にして読む（選ぶ手は変わらない）
          const v2 = tacSearch(C.applyMove(position, mv.from, mv.to, opts), 'w', Math.min(3, 2 * left - 1), -1e9, bestV === Infinity ? 1e9 : bestV, opts);
          if (v2 < bestV) { bestV = v2; pick = mv; }
        }
        if (!pick) { busy = false; return; }
        position = C.applyMove(position, pick.from, pick.to, opts);
        paint({ [pick.from]: 'last', [pick.to]: 'last' });
        busy = false;
        info.textContent = `あなたの番です（あと${left}手）。`;
      }, 550);
    };

    board.onPick = (sq) => {
      if (busy) return;
      const mine = (x) => position[x] && C.colorOf(position[x]) === 'w';
      if (from === null) {
        if (!mine(sq)) return;
        from = sq;
        const m = { [sq]: 'sel' };
        for (const t of C.legalMoves(position, sq, opts)) m[t] = 'move';
        paint(m);
        return;
      }
      if (sq === from) { from = null; paint(); return; }
      if (!C.legalMoves(position, from, opts).includes(sq)) {
        if (mine(sq)) { from = null; board.onPick(sq); }
        return;
      }
      const f = from;
      from = null;
      position = C.applyMove(position, f, sq, opts);
      sfx.place('chess');
      afterMyMove({ [f]: 'last', [sq]: 'last' });
    };

    ctx.actions([
      { label: 'やり直す', variant: 'ghost', onClick: reset },
      { label: 'ヒント', variant: 'ghost', onClick: () => { ctx.miss(); ctx.say(s.hint || 'まず王手、次に守られていない駒を探します。'); } },
    ]);
    reset();
  };

  // ── チェス：定跡の手順をなぞる。白は自分、黒は決まった手を自動で指す
  //    s.line = ['e2e4', 'e7e5', ...]（白黒交互）、s.notes = { 手の番号: '説明' }
  STEPS.line = (ctx) => {
    const s = ctx.step;
    ctx.prompt(s.prompt);
    const { board } = boardSpec(ctx, s);
    const info = el('p', 'note');
    ctx.mount.appendChild(info);
    const START = { w: { k: true, q: true }, b: { k: true, q: true } };
    const me = s.side === 'b' ? 'b' : 'w';   // 黒の定跡は、白の手を自動で指してから始める
    let position, opts, i, from, busy, token = 0;

    const paint = (extra = {}) => board.setPosition(position, extra);
    const say = () => {
      const n = Math.floor(i / 2) + 1;
      info.innerHTML = `${n}手目：あなた（${me === 'w' ? '白' : '黒'}）の番です。${s.notes?.[i] ? `<br>${s.notes[i]}` : ''}`;
    };
    const play = (mv) => {
      const f = mv.slice(0, 2), t = mv.slice(2, 4);
      const next = C.nextRights(opts, position, f, t);
      position = C.applyMove(position, f, t, opts);
      opts = next;
      return { [f]: 'last', [t]: 'last' };
    };
    const reset = () => {
      token++;
      position = { ...(s.board || C.START_POSITION) };
      opts = { w: 8, h: 8, castle: { w: { ...START.w }, b: { ...START.b } }, ep: null };
      i = 0; from = null; busy = false;
      ctx.clear(); paint();
      if (me === 'b') { info.innerHTML = '白が指します…'; blackReply(); } else say();
    };
    const blackReply = () => {
      busy = true;
      const my = token;
      setTimeout(() => {
        if (my !== token) return;
        const mark = play(s.line[i]);
        i++;
        sfx.place('chess');
        paint(mark);
        busy = false;
        if (i >= s.line.length) {
          ctx.solved(`<b>${s.doneMsg || '定跡どおりです'}</b>${s.why || ''}`);
          return;
        }
        say();
      }, 450);
    };

    board.onPick = (sq) => {
      if (busy || i >= s.line.length) return;
      const mine = (x) => position[x] && C.colorOf(position[x]) === me;
      if (from === null) {
        if (!mine(sq)) return;
        from = sq;
        const m = { [sq]: 'sel' };
        for (const t of C.legalMoves(position, sq, opts)) m[t] = 'move';
        paint(m);
        return;
      }
      if (sq === from) { from = null; paint(); return; }
      if (!C.legalMoves(position, from, opts).includes(sq)) {
        if (mine(sq)) { from = null; board.onPick(sq); }
        return;
      }
      const want = s.line[i];
      if (from + sq !== want) {
        ctx.miss();
        const w = want.slice(0, 2);
        ctx.say(`<b>この定跡では別の手です</b>${C.PIECE_JA[C.kindOf(position[w])]}を動かします。`, 'ng');
        from = null;
        paint({ [w]: 'hint' });
        return;
      }
      from = null;
      ctx.clear();
      const mark = play(want);
      i++;
      sfx.place('chess');
      paint(mark);
      if (i >= s.line.length) { ctx.solved(`<b>${s.doneMsg || '定跡どおりです'}</b>${s.why || ''}`); return; }
      blackReply();
    };

    ctx.actions([{ label: '最初から', variant: 'ghost', onClick: reset }]);
    reset();
  };

  // ── 将棋：戦法の手順をなぞる。先手は自分、後手は決まった手を自動で指す
  //    s.line = ['7776', '3334', ...]（'*P55' は打つ手、末尾 '+' は成り）、s.notes = { 手の番号: '説明' }
  const parseSMove = (x) => (x[0] === '*'
    ? { drop: x[1], to: x.slice(2, 4) }
    : { from: x.slice(0, 2), to: x.slice(2, 4), promote: x.endsWith('+') });
  STEPS.sline = (ctx) => {
    const s = ctx.step;
    const shape = s.shape || S.BIG;
    ctx.prompt(s.prompt);
    const { board } = boardSpec(ctx, { ...s, shape });
    const info = el('p', 'note');
    ctx.mount.appendChild(info);
    let state, i, from, busy, token = 0;
    const paint = (extra = {}) => board.setPosition(state.board, extra);
    const say = () => {
      info.innerHTML = `${Math.floor(i / 2) + 1}手目：あなた（先手）の番です。${s.notes?.[i] ? `<br>${s.notes[i]}` : ''}`;
    };
    const play = (mv) => {
      state = S.applyMove(state, mv, shape);
      return { ...(mv.from ? { [mv.from]: 'last' } : {}), [mv.to]: 'last' };
    };
    const done = () => ctx.solved(`<b>手順どおりです</b>${s.why || ''}`);
    const reset = () => {
      token++;
      state = s.state ? JSON.parse(JSON.stringify(s.state)) : S.startBig();
      i = 0; from = null; busy = false;
      ctx.clear(); paint(); say();
    };
    const reply = () => {
      busy = true;
      const my = token;
      setTimeout(() => {
        if (my !== token) return;
        const mark = play(parseSMove(s.line[i]));
        i++;
        sfx.place('shogi');
        paint(mark);
        busy = false;
        if (i >= s.line.length) return done();
        say();
      }, 450);
    };
    board.onPick = (sq) => {
      if (busy || i >= s.line.length) return;
      const mine = (x) => state.board[x] && S.colorOf(state.board[x]) === 'b';
      if (from === null) {
        if (!mine(sq)) return;
        from = sq;
        const m = { [sq]: 'sel' };
        for (const mv of S.legalMovesFrom(state, sq, shape)) m[mv.to] = 'move';
        paint(m);
        return;
      }
      if (sq === from) { from = null; paint(); return; }
      if (!S.legalMovesFrom(state, from, shape).some((mv) => mv.to === sq)) {
        if (mine(sq)) { from = null; board.onPick(sq); }
        return;
      }
      const want = parseSMove(s.line[i]);
      if (want.drop || want.from !== from || want.to !== sq) {
        ctx.miss();
        ctx.say(`<b>この戦法では別の手です</b>印のついた駒を動かします。`, 'ng');
        from = null;
        paint(want.from ? { [want.from]: 'hint' } : {});
        return;
      }
      from = null;
      ctx.clear();
      const mark = play(want);
      i++;
      sfx.place('shogi');
      paint(mark);
      if (i >= s.line.length) return done();
      reply();
    };
    ctx.actions([{ label: '最初から', variant: 'ghost', onClick: reset }]);
    reset();
  };

  STEPS.build = (ctx) => {
    const s = ctx.step;
    const shape = s.shape || S.BIG;
    const limit = s.limit || 12;
    let state = JSON.parse(JSON.stringify(s.state || S.startBig()));
    let from = null, moves = 0, done = false, token = 0;

    ctx.prompt(s.prompt);
    const { board } = boardSpec(ctx, { ...s, shape });
    const status = el('p', 'note');
    const checklist = el('ul', 'checks');
    ctx.mount.append(checklist, status);

    const paint = (extra = {}) => board.setPosition(state.board, extra);

    /** 目標がどこまで達成できたか */
    const progress = () => (s.checks || []).map((c) => ({ label: c.label, ok: c.test(state, shape) }));

    const paintChecks = () => {
      const p = progress();
      checklist.innerHTML = p.map((x) =>
        `<li data-ok="${x.ok ? 1 : ''}">${x.ok ? '✓' : '○'} ${x.label}</li>`).join('');
      return p;
    };

    const reset = () => {
      token++;   // 考え中の相手の手を捨てる
      state = JSON.parse(JSON.stringify(s.state || S.startBig()));
      from = null; moves = 0; done = false;
      ctx.clear(); paint(); paintChecks();
      status.textContent = `${limit}手以内に形を作ってください。（0/${limit}手）`;
      ctx.actions([{ label: '最初から', variant: 'ghost', onClick: () => { reset(); bind(); } }]);
    };

    const afterMove = () => {
      moves++;
      const p = paintChecks();
      if (p.every((x) => x.ok)) {
        done = true; board.onPick = null;
        ctx.solved(`<b>できました</b>${moves}手で形になりました。${s.why || ''}`,
          [{ label: 'もう一度', variant: 'ghost', onClick: () => { reset(); bind(); } }]);
        return;
      }
      if (moves >= limit) {
        ctx.miss();
        ctx.say(`<b>${limit}手では組めませんでした</b>できていない項目を見て、もう一度やってみましょう。`
          + `${s.hint ? `<br><span class="note">${s.hint}</span>` : ''}`, 'ng');
        board.onPick = null;
        ctx.actions([
          { label: 'もう一度', variant: 'tone', onClick: () => { reset(); bind(); } },
          { label: '次へ進む', variant: 'ghost', onClick: () => { ctx.solved(); ctx.advance(); } },
        ]);
        return;
      }
      status.textContent = `（${moves}/${limit}手）`;
      // 相手も1手指す（自陣を組むだけなので、相手は静かに駒を動かす）
      if (s.opponent === false) { state = { ...state, turn: 'b' }; return; }   // 相手なしなら手番を戻す
      const my = token;
      setTimeout(() => {
        if (my !== token) return;
        const mv = S.pickMove(state, shape, 1);
        if (mv) {
          state = S.applyMove(state, mv, shape);
          paint({ ...(mv.from ? { [mv.from]: 'last' } : {}), [mv.to]: 'last' });
          paintChecks();
        } else state = { ...state, turn: 'b' };   // 相手が指せないときも手番を戻す
      }, 380);
    };

    function bind() {
      board.onPick = (sq) => {
        if (done) return;
        const mine = (x) => state.board[x] && S.colorOf(state.board[x]) === 'b';
        const targets = (x) => S.legalMovesFrom(state, x, shape).map((m) => m.to);
        if (from === null) {
          if (!mine(sq)) return;
          from = sq;
          const m = { [sq]: 'sel' };
          for (const t of targets(sq)) m[t] = 'move';
          paint(m);
          return;
        }
        if (sq === from) { from = null; paint(); return; }
        if (!targets(from).includes(sq)) {
          if (mine(sq)) { from = sq; const m = { [sq]: 'sel' }; for (const t of targets(sq)) m[t] = 'move'; paint(m); }
          return;
        }
        const cands = S.legalMovesFrom(state, from, shape).filter((m) => m.to === sq);
        state = S.applyMove(state, cands.find((m) => !m.promote) || cands[0], shape);
        sfx.place('shogi');
        paint({ [from]: 'last', [sq]: 'last' });
        from = null;
        afterMove();
      };
    }

    reset(); bind();
  };


  // --- 囲碁 ---------------------------------------------------------------
  // 図は行の配列で書く（'X' 黒・'O' 白・'.' 空き・',' 範囲外の空き・英小文字は印つきの空き）。
  // 石や点の指定は、印の文字か [横, 縦]（1から数える。[3, 3] は「3の三」）。
  const GO = NS_GO;
  const { GoBoard } = NS_GOBOARD;
  const GO_ILLEGAL_JA = {
    occupied: 'そこにはもう石があります。石は空いている交点に置きます。',
    suicide: 'そこは打てない点です。打つと自分の石の呼吸点がなくなります（相手の石を取れるときだけ打てます）。',
    ko: 'コウです。取られた直後は、すぐには取り返せません。',
  };
  function goSetup(s) {
    const p = GO.parse(s.board);
    const at = (v) => {
      if (v == null) return -1;
      if (Array.isArray(v)) return (v[1] - 1) * p.n + (v[0] - 1);
      if (typeof v === 'number') return v;
      return p.labels[v] ?? -1;
    };
    return { ...p, at, turn: s.turn || 'X' };
  }
  /** 印 { a: 'tri', '3,4': 'sq' } を盤の添字に直す */
  function goMarksOf(p, marks) {
    const out = {};
    for (const [k, v] of Object.entries(marks || {})) {
      const i = /^\d+,\d+$/.test(k) ? p.at(k.split(',').map(Number)) : p.at(k);
      if (i >= 0) out[i] = v;
    }
    return out;
  }
  /** 文字の印 ['a', 'b'] → { 添字: 'A' } */
  function goLabelsOf(p, list) {
    const out = {};
    for (const k of list || []) { const i = p.at(k); if (i >= 0) out[i] = String(k).toUpperCase(); }
    return out;
  }
  function goBoard(ctx, p, s) {
    const b = new GoBoard(ctx.boardHost(), { n: p.n, coords: s.coords ?? false });
    if (p.outside?.length) b.dim = new Set(p.outside);   // 死活の問題：打たない範囲を薄くする
    return b;
  }
  function mountGoStatic(ctx, spec) {
    const p = goSetup(spec);
    const b = goBoard(ctx, p, spec);
    b.setPosition(p.s, goMarksOf(p, spec.marks), { labels: goLabelsOf(p, spec.labels) });
    return b;
  }
  const goLabelAt = (p, i) => Object.keys(p.labels).find((k) => p.labels[k] === i);

  /** 自由に置いてみる（黒と白を交互に） */
  STEPS.gfree = (ctx) => {
    const s = ctx.step;
    const p = goSetup(s);
    const need = s.count || 4;
    ctx.prompt(s.prompt || `線の交わる点をタップして、石を${need}つ置いてみましょう。黒と白を交互に置きます。`);
    const board = goBoard(ctx, p, s);
    const info = el('p', 'note');
    ctx.mount.appendChild(info);
    let st = { n: p.n, s: p.s, turn: p.turn, ko: -1, caps: { X: 0, O: 0 } }, placed = 0;
    const paint = (m = {}) => board.setPosition(st.s, m, { turn: st.turn });
    const say = () => { info.textContent = `${GO.COLOR_JA[st.turn]}の番です（${placed}/${need}）`; };
    paint(); say();
    board.onPick = (i) => {
      const nx = GO.apply(st, i);
      if (!nx) { ctx.say(GO_ILLEGAL_JA[GO.play(st.s, p.n, i, st.turn, st.ko).illegal] || 'そこには置けません。'); return; }
      st = nx; placed++;
      sfx.place('go');
      ctx.clear();
      paint({ [i]: 'last' }); say();
      if (placed >= need) { board.onPick = null; info.textContent = ''; ctx.solved(`<b>置けました</b>${s.why || ''}`); }
    };
    ctx.actions([]);
  };

  /** 盤の点や石を全部タップする（呼吸点・地・アタリの石など） */
  STEPS.gpick = (ctx) => {
    const s = ctx.step;
    const p = goSetup(s);
    ctx.prompt(s.prompt);
    const board = goBoard(ctx, p, s);
    const base = goMarksOf(p, s.marks);
    let answer;
    if (s.answer === 'libs') answer = GO.group(p.s, p.n, p.at(s.target)).libs;
    else if (s.answer === 'terr') {
      const sc = GO.score({ n: p.n, s: p.s, caps: {} }, (s.dead || []).map(p.at));
      answer = sc.map.map((o, i) => (o === s.color ? i : -1)).filter((i) => i >= 0);
    } else if (s.answer === 'atari') answer = GO.groups(p.s, p.n, s.color).filter((g) => g.libs.length === 1).flatMap((g) => g.stones);
    else answer = s.answer.map(p.at);
    const stonesOnly = answer.every((i) => p.s[i] !== '.'), emptyOnly = answer.every((i) => p.s[i] === '.');
    const good = s.pickMark || (stonesOnly ? 'atari' : s.answer === 'libs' ? 'lib' : 'ok');
    const picked = new Set();
    const marks = () => {
      const m = { ...base };
      for (const i of picked) m[i] = answer.includes(i) ? good : 'ng';
      return m;
    };
    board.setPosition(p.s, marks(), { labels: goLabelsOf(p, s.labels) });
    board.onPick = (i) => {
      if (picked.has(i)) return;
      // 答えが空き点だけなら石へのタップは、答えが石だけなら空き点へのタップは数えない
      if ((emptyOnly && p.s[i] !== '.') || (stonesOnly && p.s[i] === '.')) return;
      picked.add(i);
      board.setMarks(marks());
      if (!answer.includes(i)) {
        ctx.miss();
        ctx.say(`<b>そこではありません</b>${s.hint || ''}`, 'ng');
        return;
      }
      sfx.pick();
      const hit = [...picked].filter((x) => answer.includes(x)).length;
      if (hit === answer.length) {
        board.onPick = null;
        ctx.solved(`<b>全部見つかりました</b>${s.why || `全部で${answer.length}か所です。`}`);
      } else ctx.say(`あと ${answer.length - hit} か所。`);
    };
    ctx.actions([{
      label: '答えを見る', variant: 'ghost', onClick: () => {
        ctx.miss();
        const m = { ...base };
        for (const i of answer) m[i] = good;
        board.setMarks(m);
        board.onPick = null;
        ctx.solved(`<b>ここが答えです</b>${s.why || ''}`);
      },
    }]);
  };

  /**
   * 打った手が目標を果たしたか。goal:
   *   take（その場で取る）／capture（取る・逃げられない形にする）／atari／escape（取られない形にする）／
   *   connect（2つの石をつなぐ）／kill・live（死活。area の中だけで読む）／answers（決まった点）
   */
  function goJudge(s, p, i, r, target, area) {
    const n = p.n, me = p.turn, foe = GO.other(me);
    const gone = target >= 0 && r.s[target] !== p.s[target];
    switch (s.goal) {
      case 'take': return { ok: gone, msg: '相手の石の呼吸点がまだ残っています。呼吸点を全部ふさぐと取れます。' };
      case 'capture': {
        if (gone) return { ok: true };
        if (!GO.canSave(r.s, n, target, r.ko)) return { ok: true };
        return { ok: false, msg: 'これでは相手に逃げられてしまいます。', refute: GO.defendReply(r.s, n, target, r.ko) };
      }
      case 'atari': {
        const g = GO.group(r.s, n, target);
        return { ok: !!g && g.libs.length === 1, msg: 'これでは相手の石の呼吸点が2つ以上残っています。' };
      }
      case 'escape': {
        if (GO.canCapture(r.s, n, target, r.ko)) {
          const g = GO.group(r.s, n, target);
          const lib = g && g.libs.length === 1 ? g.libs[0] : -1;
          return { ok: false, msg: g && g.libs.length === 1 ? 'まだアタリのままです。' : '逃げても、追いかけられて取られてしまいます。', refute: lib };
        }
        return { ok: true };
      }
      case 'connect': {
        const [a, b] = (s.connect || []).map(p.at);
        const g = GO.group(r.s, n, a);
        return { ok: !!g && g.stones.includes(b) && g.libs.length >= 2, msg: 'まだ2つの石はつながっていません。' };
      }
      case 'kill': case 'live': {
        const res = GO.solveLD(r.s, n, { target, area, toMove: foe, ko: r.ko, pov: me, limitMs: 3000 });
        if (!res.win && !res.unsure) return { ok: true };
        const refute = GO.ldReply(r.s, n, { target, area, toMove: foe, ko: r.ko });
        return { ok: false, msg: s.goal === 'kill' ? 'これでは相手に二眼を作られて、生きられてしまいます。' : 'これでは二眼ができず、取られてしまいます。', refute };
      }
      case 'double': {
        const at = GO.groups(r.s, n, foe).filter((g) => g.libs.length === 1);
        const me1 = GO.group(r.s, n, i);
        return { ok: at.length >= 2 && me1.libs.length >= 2, msg: at.length === 1 ? 'アタリになったのは1か所だけです。' : '2つ同時にアタリになる点を探しましょう。' };
      }
      case 'line': {
        const x = i % n, y = (i / n) | 0, line = Math.min(x, y, n - 1 - x, n - 1 - y) + 1;
        return { ok: line >= (s.minLine || 3), msg: `${line}線は低すぎます。序盤は3線・4線か、中央に打ちます。` };
      }
      case 'cut': {
        // 2つの石のかたまりに共通の呼吸点がなくなり（1手でつながれない）、切った石も取られないこと
        const [a, b] = (s.cut || []).map(p.at);
        const ga = GO.group(r.s, n, a), gb = GO.group(r.s, n, b);
        const apart = !!ga && !!gb && !ga.stones.includes(b) && !ga.libs.some((l) => gb.libs.includes(l));
        return { ok: apart && !GO.canCapture(r.s, n, i, r.ko), msg: apart ? '切った石が取られてしまいます。' : 'まだ白は、1手でつながれる形です。' };
      }
      case 'answers': default:
        return { ok: (s.answers || []).map(p.at).includes(i) };
    }
  }

  /** 1手で目標を果たす */
  STEPS.gmove = (ctx) => {
    const s = ctx.step;
    const p = goSetup(s), n = p.n;
    ctx.prompt(s.prompt);
    if (s.note) ctx.mount.appendChild(el('p', 'note', s.note));
    const board = goBoard(ctx, p, s);
    const base = goMarksOf(p, s.marks);
    const labels = goLabelsOf(p, s.labels);
    const target = p.at(s.target);
    const area = s.area ? s.area.map(p.at) : p.area;
    const ko = s.ko != null ? p.at(s.ko) : -1;
    let locked = false;
    const paint = (pos, m = {}) => board.setPosition(pos, { ...base, ...m }, { labels, turn: p.turn });
    paint(p.s);
    const onTap = (i) => {
      if (locked) return;
      const r = GO.play(p.s, n, i, p.turn, ko);
      if (r.illegal) {
        // 打てない点に打とうとしたこと自体は、ミスに数えない（打てない点を学ぶ問題では解説を出す）
        ctx.say(`<b>そこには打てません</b>${s.illegalMsg?.[r.illegal] || GO_ILLEGAL_JA[r.illegal]}`, 'ng');
        return;
      }
      r.captured.length ? sfx.capture('go') : sfx.place('go');
      paint(r.s, { [i]: 'last' });
      const res = goJudge(s, p, i, r, target, area);
      if (res.ok) {
        board.onPick = null;
        ctx.solved(`<b>その通り</b>${s.why || ''}`);
        return;
      }
      ctx.miss();
      const lab = goLabelAt(p, i);
      const why = (lab && s.wrongs?.[lab]) || res.msg || s.hint || 'もう一度考えてみましょう。';
      ctx.say(`<b>ちがいます</b>${why}`, 'ng');
      locked = true;
      const showRefute = res.refute != null && res.refute >= 0;
      if (showRefute) {
        setTimeout(() => {
          if (!ctx.alive() || !locked) return;
          const r2 = GO.play(r.s, n, res.refute, GO.other(p.turn), r.ko);
          if (!r2.illegal) { paint(r2.s, { [res.refute]: 'last' }); sfx.place('go'); }
        }, 650);
      }
      setTimeout(() => { if (!ctx.alive()) return; locked = false; paint(p.s); }, showRefute ? 2300 : 1100);
    };
    if (n >= 9) board.pickTwice(onTap, () => NS_GOBOARD.confirmOn() && !locked); else board.onPick = onTap;
    ctx.actions([{
      label: 'ヒント', variant: 'ghost', onClick: () => {
        ctx.miss();
        ctx.say(`<b>ヒント</b>${s.hint || '相手の石の呼吸点を数えてみましょう。'}`);
        if (s.hintMarks && !locked) paint(p.s, goMarksOf(p, s.hintMarks));
      },
    }]);
  };

  /** 数手の問題（シチョウ・ゲタ・死活など）。相手はいちばん粘る手で応じる */
  STEPS.gseq = (ctx) => {
    const s = ctx.step;
    const p = goSetup(s), n = p.n, me = p.turn, foe = GO.other(me);
    ctx.prompt(s.prompt);
    const board = goBoard(ctx, p, s);
    const info = el('p', 'note');
    ctx.mount.appendChild(info);
    const base = goMarksOf(p, s.marks);
    const target = p.at(s.target);
    const area = s.area ? s.area.map(p.at) : p.area;
    const need = s.moves || (s.goal === 'capture' ? 99 : 1);
    let pos, ko, made, busy, token = 0;
    const paint = (m = {}) => board.setPosition(pos, { ...base, ...m }, { turn: me });
    const reset = () => {
      token++;
      pos = p.s; ko = -1; made = 0; busy = false;
      ctx.clear(); paint();
      info.textContent = `${GO.COLOR_JA[me]}の番です。`;
    };
    const win = (msg) => { busy = true; board.onPick = null; ctx.solved(`<b>${msg}</b>${s.why || ''}`); };
    const fail = (msg, refute) => {
      ctx.miss();
      busy = true;
      const my = ++token;
      ctx.say(`<b>${msg}</b>${s.hint ? `<br><span class="note">${s.hint}</span>` : ''}`, 'ng');
      if (refute != null && refute >= 0) {
        setTimeout(() => {
          if (my !== token || !ctx.alive()) return;
          const r2 = GO.play(pos, n, refute, foe, ko);
          if (!r2.illegal) { pos = r2.s; paint({ [refute]: 'last' }); sfx.place('go'); }
        }, 650);
      }
      setTimeout(() => { if (my === token && ctx.alive()) { reset(); ctx.say(`<b>${msg}</b>もう一度どうぞ。`, 'ng'); } }, 2400);
    };
    const reply = (pickMove) => {
      busy = true;
      info.textContent = '相手が応じます…';
      const my = token;
      setTimeout(() => {
        if (my !== token || !ctx.alive()) return;
        const m = pickMove();
        if (m < 0) { busy = false; info.textContent = `相手はパスしました。${GO.COLOR_JA[me]}の番です。`; ko = -1; return; }
        const r2 = GO.play(pos, n, m, foe, ko);
        if (r2.illegal) { busy = false; return; }
        pos = r2.s; ko = r2.ko;
        r2.captured.length ? sfx.capture('go') : sfx.place('go');
        paint({ [m]: 'last' });
        busy = false;
        info.textContent = `${GO.COLOR_JA[me]}の番です。`;
      }, 480);
    };
    const onTap = (i) => {
      if (busy) return;
      const r = GO.play(pos, n, i, me, ko);
      if (r.illegal) { ctx.say(`<b>そこには打てません</b>${GO_ILLEGAL_JA[r.illegal]}`, 'ng'); return; }
      pos = r.s; ko = r.ko; made++;
      r.captured.length ? sfx.capture('go') : sfx.place('go');
      ctx.clear();
      paint({ [i]: 'last' });
      const gone = pos[target] !== p.s[target];
      if (s.goal === 'capture') {
        if (gone) return win(s.doneMsg || '取りました');
        if (GO.canSave(pos, n, target, ko)) return fail('これでは逃げられてしまいます。', GO.defendReply(pos, n, target, ko));
        if (made >= (s.limit || 20)) return fail('手数がかかりすぎました。');
        return reply(() => GO.defendReply(pos, n, target, ko));
      }
      // 死活
      const res = GO.solveLD(pos, n, { target, area, toMove: foe, ko, pov: me, limitMs: 3000 });
      if (res.win || res.unsure) {
        return fail(s.goal === 'kill' ? '相手に生きられてしまいます。' : 'これでは取られてしまいます。',
          GO.ldReply(pos, n, { target, area, toMove: foe, ko }));
      }
      if (s.goal === 'kill' && gone) return win(s.doneMsg || '取りました');
      if (s.goal === 'live' && GO.bensonAlive(pos, n, me).has(target)) return win(s.doneMsg || '生きました');
      if (made >= need) return win(s.doneMsg || (s.goal === 'kill' ? 'もう生きられません' : 'これで生きています'));
      reply(() => GO.ldReply(pos, n, { target, area, toMove: foe, ko }));
    };
    if (n >= 9) board.pickTwice(onTap, () => NS_GOBOARD.confirmOn() && !busy); else board.onPick = onTap;
    ctx.actions([
      { label: 'やり直す', variant: 'ghost', onClick: reset },
      { label: 'ヒント', variant: 'ghost', onClick: () => { ctx.miss(); ctx.say(`<b>ヒント</b>${s.hint || '相手の石の呼吸点を数えてみましょう。'}`); } },
    ]);
    reset();
  };

  /** 地・呼吸点・結果を数えて答える。答えは盤から計算する（手で数えた数字を書かない） */
  STEPS.gcount = (ctx) => {
    const s = ctx.step;
    const p = goSetup(s), n = p.n;
    ctx.prompt(s.prompt);
    const board = goBoard(ctx, p, s);
    const dead = (s.dead || []).map(p.at);
    const base = goMarksOf(p, s.marks);
    for (const i of dead) base[i] = 'dead';
    const labels = goLabelsOf(p, s.labels);
    board.setPosition(p.s, base, { labels });
    const komi = s.komi ?? 6.5;
    const sc = GO.score({ n, s: p.s, caps: s.caps || { X: 0, O: 0 } }, dead, komi);
    let truth, choices, detail = '';
    if (s.what === 'result') {
      truth = GO.resultText(sc.diff);
      const alts = [sc.diff + 1, sc.diff - 1, -sc.diff, sc.diff + 2, sc.diff - 2, -sc.diff + 1].map(GO.resultText);
      choices = shuffle([...new Set([truth, ...alts])].slice(0, 4));
      detail = `黒：地 ${sc.terr.X}目 ＋ アゲハマ ${sc.caps.X + sc.dead.O}個 ＝ ${sc.black}目。白：地 ${sc.terr.O}目 ＋ アゲハマ ${sc.caps.O + sc.dead.X}個 ＋ コミ ${komi}目 ＝ ${sc.white}目。`;
    } else {
      const libs = s.what === 'libs';
      const v = libs ? GO.group(p.s, n, p.at(s.target)).libs.length : sc.terr[s.color];
      const unit = libs ? 'つ' : '目';
      truth = `${v}${unit}`;
      const lo = Math.max(0, Math.min(v - 1, v - ((v * 7) % 3)));
      choices = [lo, lo + 1, lo + 2, lo + 3].map((x) => `${x}${unit}`);
      if (!libs) detail = `${s.color === 'X' ? '黒' : '白'}の地は${v}目です。`;
    }
    const box = el('div', 'choices');
    box.dataset.cols = '2';
    ctx.mount.appendChild(box);
    const reveal = () => {
      if (s.what === 'libs') return;
      const m = { ...base };
      sc.map.forEach((o, i) => { if (o && (s.what === 'result' || o === s.color)) m[i] = o === 'X' ? 'terrX' : 'terrO'; });
      board.setMarks(m);
    };
    choices.forEach((c) => {
      const b = el('button', 'choice', c);
      b.addEventListener('click', () => {
        if (c === truth) {
          b.dataset.s = 'ok';
          box.querySelectorAll('.choice').forEach((x) => (x.disabled = true));
          reveal();
          ctx.solved(`<b>その通り</b>${detail}${s.why ? ` ${s.why}` : ''}`);
        } else {
          b.dataset.s = 'ng'; b.disabled = true;
          ctx.miss();
          ctx.say(`<b>おしい</b>${s.hint || 'まとまりごとに数えて、足してみましょう。'}`, 'ng');
        }
      });
      box.appendChild(b);
    });
    ctx.actions([]);
  };
  /** 自己診断用：その問題で目標を果たす手（gmove・gseq の1手目）を全部 */
  function goSolutions(s) {
    const p = goSetup(s), n = p.n;
    const target = p.at(s.target);
    const area = s.area ? s.area.map(p.at) : p.area;
    const ko = s.ko != null ? p.at(s.ko) : -1;
    const out = [];
    for (let i = 0; i < n * n; i++) {
      if (p.s[i] !== '.') continue;
      if ((s.goal === 'kill' || s.goal === 'live') && !area.includes(i)) continue;
      const r = GO.play(p.s, n, i, p.turn, ko);
      if (r.illegal) continue;
      if (goJudge(s, p, i, r, target, area).ok) out.push(i);
    }
    return out;
  }


  // --- キング＋ポーンの終盤を勝ちきる（相手は勝敗表で最善の守り） ---------------
  STEPS.kpkplay = (ctx) => {
    const s = ctx.step;
    ctx.prompt(s.prompt || '白番です。黒のキングは最善の守りで粘ります。ポーンをクイーンに昇格させて、勝ちきってください。');
    const { board, opts } = boardSpec(ctx, s);
    const info = el('p', 'note');
    ctx.mount.appendChild(info);
    let pos, from = null, busy = false, past = [], token = 0, failed = false;
    const tell = (t) => { info.textContent = t; };
    const paint = (m = {}) => board.setPosition(pos, m);
    const LOCAL = { kpkInfo: (b, t) => NS_KPK.info(b, t), kpkWins: (b) => NS_KPK.winning(b), kpkReply: (b) => NS_KPK.reply(b) };
    const ask = (task, args) => NS_THINK.run(task, args, 30000, () => LOCAL[task](...args));
    const marksFor = (sq) => Object.fromEntries([[sq, 'sel'], ...C.legalMoves(pos, sq, opts).map((t) => [t, 'move'])]);
    const acts = () => ctx.actions([
      { label: '1手もどす', variant: 'ghost', disabled: !past.length, onClick: undo },
      { label: 'ヒント', variant: 'ghost', onClick: hint },
      { label: '最初から', variant: 'ghost', onClick: reset },
    ]);
    function reset() {
      token++;
      pos = { ...s.board }; from = null; busy = false; past = []; failed = false;
      ctx.clear(); paint();
      tell('白の番です。ポーンを急いで突かず、キングを先にポーンの前へ。');
      acts();
      ask('kpkInfo', [pos, 'w']);   // 勝敗表を先に作っておく（最初の1回だけ少し時間がかかる）
    }
    function undo() {
      if (!past.length) return;
      token++;
      pos = past.pop(); from = null; busy = false; failed = false;
      ctx.clear(); paint(); tell('1手もどしました。白の番です。'); acts();
    }
    async function hint() {
      if (busy) return;
      ctx.miss();
      const my = ++token;
      busy = true; tell('勝ちにつながる手を探しています…');
      const ws = await ask('kpkWins', [pos]);
      if (my !== token || !ctx.alive()) return;
      busy = false;
      if (!ws || !ws.length) { tell('この局面からは勝てません。「1手もどす」でやり直しましょう。'); return; }
      // いちばん早く勝ちに近づく手だけに印をつける（勝ちを保つだけの手まで出すと、同じ局面を行き来してしまうことがある）
      const best = ws[0];
      paint({ [best.from]: 'sel', [best.to]: 'move' });
      tell(ws.length > 1 ? `いちばん早く勝ちに近づく手に印をつけました（ほかにも勝ちを保つ手が${ws.length - 1}つあります）。`
        : '勝ちにつながる手は、印の1つだけです。');
    }
    const draw = (msg) => {
      failed = true; busy = false;
      ctx.miss();
      ctx.say(`<b>引き分けの形になりました</b>${msg}`, 'ng');
      tell('「1手もどす」で直前の局面に戻れます。');
      acts();
    };
    const win = () => {
      // onPick は外さない（busy で止める）。外すと「もう一度」で盤が動かなくなる
      busy = true;
      ctx.solved(`<b>勝ちきりました</b>${s.why || 'ポーンを無事にクイーンへ昇格させました。ここからはキング＋クイーン対キングの勝ち方で詰ませられます。'}`,
        [{ label: 'もう一度', variant: 'ghost', onClick: reset }]);
    };
    async function afterWhite() {
      const my = ++token;
      busy = true;
      const q = Object.keys(pos).find((k) => pos[k] === 'Q');
      if (q) {
        const st = C.gameStatus(pos, 'b', opts);
        if (st === 'checkmate') return win();
        if (st === 'stalemate') return draw('黒は動ける場所がないのに、王手になっていません（ステイルメイト）。昇格の前に、黒キングの逃げ場を確かめます。');
        if (C.allLegalMoves(pos, 'b', opts).some((m) => m.to === q)) return draw('昇格したクイーンを、黒キングに取られてしまいます。昇格するマスは、自分のキングで守ってから突きます。');
        return win();
      }
      tell('黒が考えています…');
      const inf = await ask('kpkInfo', [pos, 'b']);
      if (my !== token || !ctx.alive()) return;
      if (!inf || !inf.win) return draw('この手のあとは、黒が正しく守れば引き分けです。ポーンの前を黒キングにふさがれたり、対抗を取られたりしていないか見直しましょう。');
      await new Promise((r) => setTimeout(r, 320));
      const mv = await ask('kpkReply', [pos]);
      if (my !== token || !ctx.alive()) return;
      if (!mv) return C.inCheck(pos, 'b', opts) ? win() : draw('ステイルメイトになりました。');
      pos = C.applyMove(pos, mv.from, mv.to, opts);
      sfx.place('chess');
      paint({ [mv.from]: 'last', [mv.to]: 'last' });
      busy = false;
      tell(`黒は${mv.to}へ動きました。白の番です。`);
      acts();
    }
    board.onPick = (sq) => {
      if (busy || failed) return;
      if (from === null) { if (pos[sq] && C.colorOf(pos[sq]) === 'w') { from = sq; paint(marksFor(sq)); } return; }
      if (sq === from) { from = null; paint(); return; }
      if (!C.legalMoves(pos, from, opts).includes(sq)) {
        if (pos[sq] && C.colorOf(pos[sq]) === 'w') { from = sq; paint(marksFor(sq)); }
        return;
      }
      past.push(pos);
      const f = from;
      from = null;
      pos = C.applyMove(pos, f, sq, opts);
      sfx.place('chess');
      ctx.clear();
      paint({ [f]: 'last', [sq]: 'last' });
      afterWhite();
    };
    reset();
  };

  // --- 共通ヘルパ ----------------------------------------------------------
  function boardSpec(ctx, s) {
    const host = ctx.boardHost();
    if (ctx.lesson.game === 'chess') {
      const w = s.w || 8, h = s.h || 8;
      const board = new Board(host, { variant: 'chess', w, h, coords: s.coords ?? true, flipped: !!s.flip });
      // s.castle があればキャスリングを指せる（キャスリングを練習する問題用）
      return { board, opts: { w, h, ...(s.castle ? { castle: s.castle } : {}) }, shape: null };
    }
    const shape = s.shape || S.BIG;
    const board = new Board(host, { variant: 'shogi', w: shape.w, h: shape.h, coords: s.coords ?? true });
    return { board, opts: null, shape };
  }

  function mountStaticBoard(ctx, spec) {
    const host = ctx.boardHost();
    const game = ctx.lesson.game;
    const b = game === 'chess'
      ? new Board(host, { variant: 'chess', w: spec.w || 8, h: spec.h || 8, coords: spec.coords ?? true, flipped: !!spec.flip })
      : new Board(host, { variant: 'shogi', w: (spec.shape || S.BIG).w, h: (spec.shape || S.BIG).h, coords: spec.coords ?? true });
    b.setPosition(spec.position, spec.marks || {});
    // 考え方を示す矢印（計画・駒の通り道など）
    if (spec.arrows?.length) b.flash(spec.arrows);
    return b;
  }

  return { LessonRunner, stepKeys, legacyStepKeys, stepIndexOf, goSolutions, TSUME_BOOK, tsumeKey, shogiMoveKey };
})();
