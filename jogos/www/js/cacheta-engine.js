/*
 * Cacheta (estilo pife), 4 jogadores, 2 baralhos de 52 cartas.
 *
 * - Cada jogador recebe 9 cartas. Uma carta vira no lixo (descarte).
 * - Na sua vez: compra do monte OU pega a carta de cima do lixo, depois descarta uma.
 *   A carta que você acabou de pegar do lixo não pode ser descartada na mesma vez.
 * - Bate quem, depois de descartar, fica com as 9 cartas todas formando jogos:
 *     trinca: 3 ou 4 cartas do mesmo valor com naipes diferentes;
 *     sequência: 3+ cartas do mesmo naipe em ordem (Ás vale 1 ou depois do K).
 *
 * Sem DOM: funciona no navegador e no Node (testes).
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.Cacheta = mod;
})(this, function () {
  'use strict';

  const HAND = 9;
  const MAX_TURNS = 600;
  const SUITS = ['♠', '♥', '♦', '♣'];
  const RED = [false, true, true, false];

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function deck() {
    const d = [];
    for (let k = 0; k < 2; k++) for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) d.push({ r, s, id: `${r}-${s}-${k}` });
    return d;
  }

  const rankLabel = (r) => ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }[r] || String(r));
  const card = (r, s, k = 0) => ({ r, s, id: `${r}-${s}-${k}` });

  function isSet(g) {
    if (g.length < 3 || g.length > 4) return false;
    if (!g.every((c) => c.r === g[0].r)) return false;
    return new Set(g.map((c) => c.s)).size === g.length;
  }

  function consecutive(rs) {
    rs.sort((a, b) => a - b);
    for (let i = 1; i < rs.length; i++) if (rs[i] !== rs[i - 1] + 1) return false;
    return true;
  }

  function isRun(g) {
    if (g.length < 3) return false;
    if (!g.every((c) => c.s === g[0].s)) return false;
    const rs = g.map((c) => c.r);
    if (consecutive(rs.slice())) return true;
    if (rs.includes(1)) return consecutive(rs.map((r) => (r === 1 ? 14 : r)));
    return false;
  }

  const isGroup = (g) => isSet(g) || isRun(g);

  /** Divide as cartas em jogos válidos. Retorna a lista de grupos ou null. */
  function partition(cards) {
    if (!cards.length) return [];
    if (cards.length < 3) return null;
    const first = cards[0];
    const rest = cards.slice(1);
    const n = rest.length;
    for (let mask = 1; mask < 1 << n; mask++) {
      const group = [first];
      const remaining = [];
      for (let i = 0; i < n; i++) (mask & (1 << i) ? group : remaining).push(rest[i]);
      if (group.length < 3 || (remaining.length > 0 && remaining.length < 3)) continue;
      if (!isGroup(group)) continue;
      const sub = partition(remaining);
      if (sub) return [group, ...sub];
    }
    return null;
  }

  /** Com 10 cartas: qual descarte faz bater? (exceto `exceptId`). */
  function winningDiscard(hand, exceptId) {
    for (const c of hand) {
      if (c.id === exceptId) continue;
      if (partition(hand.filter((x) => x !== c))) return c;
    }
    return null;
  }

  /** Agrupa de forma gulosa para organizar a mão na tela. */
  function suggestGroups(hand) {
    const full = partition(hand);
    if (full) return { groups: full, loose: [] };
    let pool = hand.slice();
    const groups = [];
    for (;;) {
      let best = null;
      const n = pool.length;
      for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) {
        const g = [pool[a], pool[b], pool[c]];
        if (!isGroup(g)) continue;
        // tenta estender uma sequência ou trinca
        let ext = g;
        for (const o of pool) {
          if (ext.includes(o)) continue;
          const t = [...ext, o];
          if (isGroup(t)) ext = t;
        }
        if (!best || ext.length > best.length) best = ext;
      }
      if (!best) break;
      groups.push(best);
      pool = pool.filter((x) => !best.includes(x));
    }
    return { groups, loose: pool };
  }

  function sortCards(cards, mode) {
    const r = (c) => (c.r === 1 ? 14 : c.r);
    return cards.slice().sort((x, y) => (mode === 'valor'
      ? r(x) - r(y) || x.s - y.s
      : x.s - y.s || r(x) - r(y)));
  }

  function newMatch(names) {
    return {
      players: names.map((name, i) => ({ name, hand: [], bot: i !== 0, wins: 0 })),
      dealer: -1,
      handNo: 0,
      hand: null,
    };
  }

  function startHand(m) {
    m.dealer = (m.dealer + 1) % m.players.length;
    m.handNo++;
    const d = shuffle(deck());
    m.players.forEach((p) => { p.hand = d.splice(0, HAND); });
    m.hand = {
      stock: d,
      pile: [d.pop()],
      current: (m.dealer + 1) % m.players.length,
      phase: 'draw',
      takenId: null,
      turns: 0,
      lastMove: null,
      over: false,
      winner: null,
      groups: null,
    };
    return m;
  }

  const topDiscard = (m) => m.hand.pile[m.hand.pile.length - 1] || null;

  function draw(m, pi, from) {
    const h = m.hand;
    if (h.over || h.current !== pi || h.phase !== 'draw') return false;
    let c;
    if (from === 'discard') {
      if (!h.pile.length) return false;
      c = h.pile.pop();
      h.takenId = c.id;
    } else {
      if (!h.stock.length) {
        const top = h.pile.pop();
        h.stock = shuffle(h.pile);
        h.pile = top ? [top] : [];
      }
      if (!h.stock.length) { endHand(m, null); return true; }
      c = h.stock.pop();
      h.takenId = null;
    }
    m.players[pi].hand.push(c);
    h.phase = 'discard';
    h.lastMove = { pi, draw: from === 'discard' ? 'discard' : 'stock', card: from === 'discard' ? c : null };
    return true;
  }

  function discard(m, pi, cardId) {
    const h = m.hand;
    if (h.over || h.current !== pi || h.phase !== 'discard') return false;
    if (cardId === h.takenId) return false;
    const p = m.players[pi];
    const c = p.hand.find((x) => x.id === cardId);
    if (!c) return false;
    p.hand = p.hand.filter((x) => x !== c);
    h.pile.push(c);
    h.takenId = null;
    h.turns++;
    h.lastMove = { pi, discard: c };
    const groups = partition(p.hand);
    if (groups) {
      h.groups = groups;
      endHand(m, pi);
    } else if (h.turns >= MAX_TURNS) {
      endHand(m, null);
    } else {
      h.current = (pi + 1) % m.players.length;
      h.phase = 'draw';
    }
    return true;
  }

  function endHand(m, winner) {
    m.hand.over = true;
    m.hand.winner = winner;
    if (winner != null) m.players[winner].wins++;
  }

  function closeRank(a, b) {
    const d = Math.abs(a - b);
    const ah = a === 1 ? 14 : a;
    const bh = b === 1 ? 14 : b;
    return Math.min(d, Math.abs(ah - bh));
  }

  /** Quão útil é uma carta para a mão (maior = guardar). */
  function usefulness(c, hand) {
    let s = 0;
    const others = hand.filter((o) => o !== c && o.id !== c.id);
    for (const o of others) {
      if (o.r === c.r && o.s !== c.s) s += 3;
      else if (o.s === c.s) {
        const d = closeRank(o.r, c.r);
        if (d === 1) s += 3;
        else if (d === 2) s += 1.5;
      }
    }
    for (let i = 0; i < others.length; i++) for (let j = i + 1; j < others.length; j++) {
      if (isGroup([c, others[i], others[j]])) return s + 8;
    }
    return s;
  }

  function botDraw(m, pi) {
    const hand = m.players[pi].hand;
    const top = topDiscard(m);
    if (top) {
      if (winningDiscard([...hand, top], top.id)) return 'discard';
      if (usefulness(top, hand) >= 8) return 'discard';
      if (usefulness(top, hand) >= 3 && Math.random() < 0.5) return 'discard';
    }
    return 'stock';
  }

  function botDiscard(m, pi) {
    const h = m.hand;
    const hand = m.players[pi].hand;
    const win = winningDiscard(hand, h.takenId);
    if (win) return win.id;
    let best = null;
    let bs = Infinity;
    for (const c of hand) {
      if (c.id === h.takenId) continue;
      const s = usefulness(c, hand) + Math.random() * 0.5;
      if (s < bs) { bs = s; best = c; }
    }
    return best.id;
  }

  return {
    HAND, SUITS, RED, deck, card, rankLabel, isSet, isRun, isGroup, partition,
    winningDiscard, suggestGroups, sortCards, newMatch, startHand, topDiscard,
    draw, discard, botDraw, botDiscard, usefulness,
  };
});
