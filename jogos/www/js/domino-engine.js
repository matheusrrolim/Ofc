/*
 * Dominó (regras brasileiras, 4 jogadores em duplas, sem compra).
 *
 * - 28 pedras, 7 para cada jogador.
 *   4 jogadores: duplas 0 e 2 contra 1 e 3, sem monte.
 *   2 jogadores (mano a mano): sobram 14 pedras no monte; quem não tem pedra
 *   que encaixe compra do monte até conseguir jogar (ou o monte acabar).
 * - Na primeira mão sai quem tem a maior carroça (com 4 jogadores, sempre o 6-6),
 *   que é obrigatória. Nas seguintes, quem ganhou a mão anterior sai com qualquer pedra.
 * - Quem não tem pedra que encaixe (e não tem mais monte), passa.
 * - Batida (acabar as pedras):
 *     comum = 1 ponto, carroça = 2, lá e lô = 3, cruzada = 4.
 * - Jogo fechado (todos passam): a dupla com menos pontos na mão ganha 1 ponto.
 * - Partida até 6 pontos.
 *
 * Sem DOM: funciona no navegador e no Node (testes).
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.Domino = mod;
})(this, function () {
  'use strict';

  const TARGET = 6;

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function fullSet() {
    const t = [];
    for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) t.push({ a, b, id: a + '-' + b });
    return t;
  }

  const isDouble = (t) => t.a === t.b;
  const pips = (t) => t.a + t.b;
  const fits = (t, v) => t.a === v || t.b === v;
  const handPips = (hand) => hand.reduce((s, t) => s + pips(t), 0);

  function newMatch(names) {
    return {
      players: names.map((name, i) => ({ name, hand: [], team: i % 2, bot: i !== 0 })),
      scores: [0, 0],
      target: TARGET,
      handNo: 0,
      nextStarter: null,
      lastStarter: null,
      hand: null,
      winnerTeam: null,
    };
  }

  /** Distribui as pedras. `tiles` opcional (testes) define a ordem do baralho. */
  function startHand(m, tiles) {
    const set = tiles ? tiles.slice() : shuffle(fullSet());
    const n = m.players.length;
    m.players.forEach((p, i) => { p.hand = set.slice(i * 7, i * 7 + 7); });
    const boneyard = set.slice(n * 7);
    m.handNo++;
    let current;
    let forced = null;
    if (m.nextStarter == null) {
      // Maior carroça que estiver na mão de alguém (sem carroças: a pedra mais pesada).
      let best = null;
      m.players.forEach((p, i) => p.hand.forEach((t) => {
        const score = (isDouble(t) ? 100 : 0) + pips(t);
        if (!best || score > best.score) best = { score, i, id: t.id };
      }));
      current = best.i;
      forced = best.id;
    } else {
      current = m.nextStarter;
    }
    m.lastStarter = current;
    m.hand = {
      chain: [], left: null, right: null, origin: null,
      boneyard,
      current, forced, passes: 0,
      lastMove: null, over: false, result: null,
    };
    return m;
  }

  function movesFor(m, pi) {
    const h = m.hand;
    const out = [];
    if (!h || h.over || h.current !== pi) return out;
    const hand = m.players[pi].hand;
    if (!h.chain.length) {
      for (const t of hand) if (!h.forced || t.id === h.forced) out.push({ tile: t, side: 'right' });
      return out;
    }
    for (const t of hand) {
      if (h.left === h.right) {
        if (fits(t, h.left)) out.push({ tile: t, side: 'right' });
        continue;
      }
      if (fits(t, h.left)) out.push({ tile: t, side: 'left' });
      if (fits(t, h.right)) out.push({ tile: t, side: 'right' });
    }
    return out;
  }

  function play(m, pi, tileId, side) {
    const h = m.hand;
    const mv = movesFor(m, pi).find((x) => x.tile.id === tileId && x.side === side);
    if (!mv) return false;
    const p = m.players[pi];
    const t = mv.tile;
    const L = h.left;
    const R = h.right;
    const wasEmpty = !h.chain.length;
    const dbl = isDouble(t);

    p.hand = p.hand.filter((x) => x.id !== tileId);
    if (wasEmpty) {
      h.chain.push({ l: t.a, r: t.b, id: t.id, dbl });
      h.left = t.a;
      h.right = t.b;
      h.forced = null;
      h.origin = t.id;
    } else if (side === 'left') {
      const other = t.a === L ? t.b : t.a;
      h.chain.unshift({ l: other, r: L, id: t.id, dbl });
      h.left = other;
    } else {
      const other = t.a === R ? t.b : t.a;
      h.chain.push({ l: R, r: other, id: t.id, dbl });
      h.right = other;
    }
    h.passes = 0;
    h.lastMove = { pi, id: t.id, side };

    if (!p.hand.length) {
      let kind = 'batida';
      let pts = 1;
      if (!wasEmpty) {
        if (dbl && L === t.a && R === t.a) { kind = 'cruzada'; pts = 4; }
        else if (!dbl && L !== R && ((t.a === L && t.b === R) || (t.a === R && t.b === L))) { kind = 'lá e lô'; pts = 3; }
        else if (dbl) { kind = 'carroça'; pts = 2; }
      }
      endHand(m, { type: 'batida', kind, pts, winner: pi, team: p.team });
    } else {
      h.current = (pi + 1) % m.players.length;
    }
    return true;
  }

  /** Mano a mano: sem pedra que encaixe, compra uma do monte. */
  function canBuy(m, pi) {
    const h = m.hand;
    return !h.over && h.current === pi && h.boneyard.length > 0 && !movesFor(m, pi).length;
  }

  function buy(m, pi) {
    if (!canBuy(m, pi)) return false;
    const h = m.hand;
    m.players[pi].hand.push(h.boneyard.pop());
    h.lastMove = { pi, buy: true };
    return true;
  }

  function pass(m, pi) {
    const h = m.hand;
    if (h.over || h.current !== pi || movesFor(m, pi).length || h.boneyard.length) return false;
    h.passes++;
    h.lastMove = { pi, pass: true };
    if (h.passes >= m.players.length) {
      const teamPips = [0, 0];
      m.players.forEach((p) => { teamPips[p.team] += handPips(p.hand); });
      if (teamPips[0] === teamPips[1]) {
        endHand(m, { type: 'fechado', kind: 'empate', pts: 0, team: null, winner: null, teamPips });
      } else {
        const team = teamPips[0] < teamPips[1] ? 0 : 1;
        let winner = null;
        m.players.forEach((p, i) => {
          if (p.team === team && (winner == null || handPips(p.hand) < handPips(m.players[winner].hand))) winner = i;
        });
        endHand(m, { type: 'fechado', kind: 'jogo fechado', pts: 1, team, winner, teamPips });
      }
    } else {
      h.current = (pi + 1) % m.players.length;
    }
    return true;
  }

  function endHand(m, res) {
    const h = m.hand;
    h.over = true;
    h.result = res;
    if (res.pts && res.team != null) m.scores[res.team] += res.pts;
    m.nextStarter = res.winner != null ? res.winner : (m.lastStarter + 1) % m.players.length;
    if (m.scores[0] >= m.target) m.winnerTeam = 0;
    else if (m.scores[1] >= m.target) m.winnerTeam = 1;
  }

  /** Bot simples: prefere carroças, pedras pesadas e pontas que ele mesmo tem. */
  function botMove(m, pi) {
    const mv = movesFor(m, pi);
    if (!mv.length) return null;
    const hand = m.players[pi].hand;
    let best = null;
    let bs = -Infinity;
    for (const x of mv) {
      const t = x.tile;
      let s = pips(t) + (isDouble(t) ? 6 : 0);
      if (m.hand.chain.length) {
        const end = x.side === 'left' ? m.hand.left : m.hand.right;
        const newEnd = t.a === end ? t.b : t.a;
        s += hand.filter((o) => o.id !== t.id && fits(o, newEnd)).length * 3;
      }
      s += Math.random();
      if (s > bs) { bs = s; best = x; }
    }
    return best;
  }

  return { TARGET, fullSet, newMatch, startHand, movesFor, play, pass, buy, canBuy, botMove, handPips, isDouble, pips };
});
