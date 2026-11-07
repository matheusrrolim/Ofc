/*
 * Mesas: liga as regras de cada jogo a quem está jogando.
 *
 * - `Tables.games[id]` descreve um jogo (criar, jogar, vez de quem, bot, visão).
 * - `Tables.view(id, m, seat)` mostra a mesa do ponto de vista de um lugar:
 *   esse lugar vira o índice 0 e as mãos dos outros ficam escondidas.
 * - `Tables.local(id, names)` é a mesa offline: você + bots no próprio aparelho.
 *
 * O servidor (server/server.js) usa este mesmo arquivo, então as regras são
 * as mesmas online e offline.
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const mod = factory(
    isNode ? require('./domino-engine.js') : root.Domino,
    isNode ? require('./cacheta-engine.js') : root.Cacheta,
  );
  if (isNode) module.exports = mod;
  else root.Tables = mod;
})(this, function (D, C) {
  'use strict';

  const rot = (i, r, n) => (i == null ? i : (i - r + n) % n);
  const hidden = (n) => Array.from({ length: n }, () => ({}));

  const games = {
    domino: {
      seats: 4,
      create(names) { const m = D.newMatch(names); D.startHand(m); return m; },
      current(m) { return m.hand.over ? null : m.hand.current; },
      handOver(m) { return m.hand.over; },
      act(m, seat, a) {
        if (a.type === 'play') return D.play(m, seat, a.id, a.side);
        if (a.type === 'pass') return D.pass(m, seat);
        return false;
      },
      bot(m) {
        const pi = m.hand.current;
        const mv = D.botMove(m, pi);
        return mv ? D.play(m, pi, mv.tile.id, mv.side) : D.pass(m, pi);
      },
      next(m) {
        if (!m.hand.over) return false;
        if (m.winnerTeam != null) {
          const fresh = D.newMatch(m.players.map((p) => p.name));
          Object.assign(m, fresh);
        }
        D.startHand(m);
        return true;
      },
      view(m, r) {
        const n = 4;
        const swap = r % 2 === 1; // as duplas trocam de lado quando você está num lugar ímpar
        const team = (t) => (t == null ? t : swap ? 1 - t : t);
        const h = m.hand;
        const players = [];
        for (let i = 0; i < n; i++) {
          const p = m.players[(i + r) % n];
          players.push({ name: p.name, team: i % 2, bot: !!p.bot, hand: i === 0 ? p.hand : hidden(p.hand.length) });
        }
        const res = h.result && {
          ...h.result,
          winner: rot(h.result.winner, r, n),
          team: team(h.result.team),
          teamPips: h.result.teamPips && (swap ? [h.result.teamPips[1], h.result.teamPips[0]] : h.result.teamPips),
        };
        return {
          players,
          scores: swap ? [m.scores[1], m.scores[0]] : m.scores.slice(),
          target: m.target,
          handNo: m.handNo,
          winnerTeam: team(m.winnerTeam),
          hand: {
            chain: h.chain, left: h.left, right: h.right, origin: h.origin, forced: h.forced, passes: h.passes,
            current: rot(h.current, r, n),
            lastMove: h.lastMove && { ...h.lastMove, pi: rot(h.lastMove.pi, r, n) },
            over: h.over,
            result: res,
          },
        };
      },
    },

    cacheta: {
      seats: 4,
      create(names) { const m = C.newMatch(names); C.startHand(m); return m; },
      current(m) { return m.hand.over ? null : m.hand.current; },
      handOver(m) { return m.hand.over; },
      act(m, seat, a) {
        if (a.type === 'draw') return C.draw(m, seat, a.from);
        if (a.type === 'discard') return C.discard(m, seat, a.id);
        return false;
      },
      bot(m) {
        const pi = m.hand.current;
        return m.hand.phase === 'draw' ? C.draw(m, pi, C.botDraw(m, pi)) : C.discard(m, pi, C.botDiscard(m, pi));
      },
      next(m) {
        if (!m.hand.over) return false;
        C.startHand(m);
        return true;
      },
      view(m, r) {
        const n = m.players.length;
        const h = m.hand;
        const players = [];
        for (let i = 0; i < n; i++) {
          const p = m.players[(i + r) % n];
          players.push({ name: p.name, bot: !!p.bot, wins: p.wins, hand: i === 0 ? p.hand : hidden(p.hand.length) });
        }
        const top = h.pile[h.pile.length - 1];
        return {
          players,
          handNo: m.handNo,
          hand: {
            stock: { length: h.stock.length },
            pile: top ? [top] : [],
            current: rot(h.current, r, n),
            phase: h.phase,
            takenId: rot(h.current, r, n) === 0 ? h.takenId : null,
            lastMove: h.lastMove && { ...h.lastMove, pi: rot(h.lastMove.pi, r, n) },
            over: h.over,
            winner: rot(h.winner, r, n),
            groups: h.groups,
          },
        };
      },
    },
  };

  function view(id, m, seat) { return games[id].view(m, seat); }

  /**
   * Mesa offline: você no lugar 0 e bots nos outros.
   * Mesma interface da mesa online (net.js): state(), act(), next(), onChange(), destroy().
   */
  function local(id, names, opts = {}) {
    const g = games[id];
    const m = g.create(names);
    m.players.forEach((p, i) => { p.bot = i !== 0; });
    const delay = opts.botDelay == null ? 750 : opts.botDelay;
    const listeners = [];
    let timer = null;
    let alive = true;

    const notify = () => listeners.forEach((f) => f());
    function schedule() {
      clearTimeout(timer);
      const cur = g.current(m);
      if (!alive || cur == null || cur === 0) return;
      timer = setTimeout(() => {
        if (!alive) return;
        g.bot(m);
        notify();
        schedule();
      }, delay);
    }

    return {
      online: false,
      state: () => m,
      act(a) {
        const ok = g.act(m, 0, a);
        if (ok) { notify(); schedule(); }
        return ok;
      },
      next() { if (g.next(m)) { notify(); schedule(); } },
      onChange(f) { listeners.push(f); },
      start() { schedule(); },
      sendChat() {},
      sendEmoji() {},
      leave() {},
      destroy() { alive = false; clearTimeout(timer); },
    };
  }

  return { games, view, local };
});
