'use strict';
const test = require('node:test');
const assert = require('node:assert');
const Domino = require('../www/js/domino-engine.js');
const Cacheta = require('../www/js/cacheta-engine.js');
const Layout = require('../www/js/domino-layout.js');

const T = (a, b) => ({ a, b, id: a + '-' + b });

test('dominó: primeira mão começa com 6-6 obrigatória', () => {
  const m = Domino.startHand(Domino.newMatch(['a', 'b', 'c', 'd']));
  const p = m.players[m.hand.current];
  assert.ok(p.hand.some((t) => t.id === '6-6'));
  const mv = Domino.movesFor(m, m.hand.current);
  assert.deepStrictEqual(mv.map((x) => x.tile.id), ['6-6']);
});

test('dominó: tipos de batida', () => {
  function setup(left, right, lastTile) {
    const m = Domino.newMatch(['a', 'b', 'c', 'd']);
    Domino.startHand(m);
    m.hand.chain = [{ l: left, r: 9, id: 'x' }, { l: 9, r: right, id: 'y' }];
    m.hand.left = left; m.hand.right = right; m.hand.forced = null; m.hand.current = 0;
    m.players[0].hand = [lastTile];
    return m;
  }
  let m = setup(3, 5, T(3, 5));
  Domino.play(m, 0, '3-5', 'left');
  assert.strictEqual(m.hand.result.kind, 'lá e lô');
  assert.strictEqual(m.scores[0], 3);

  m = setup(4, 4, T(4, 4));
  Domino.play(m, 0, '4-4', 'right');
  assert.strictEqual(m.hand.result.kind, 'cruzada');
  assert.strictEqual(m.scores[0], 4);

  m = setup(4, 2, T(4, 4));
  Domino.play(m, 0, '4-4', 'left');
  assert.strictEqual(m.hand.result.kind, 'carroça');

  m = setup(4, 2, T(4, 1));
  Domino.play(m, 0, '4-1', 'left');
  assert.strictEqual(m.hand.result.kind, 'batida');
  assert.strictEqual(m.scores[0], 1);
});

test('dominó: partidas inteiras entre bots terminam', () => {
  for (let g = 0; g < 300; g++) {
    const m = Domino.newMatch(['a', 'b', 'c', 'd']);
    let hands = 0;
    while (m.winnerTeam == null) {
      Domino.startHand(m);
      hands++;
      assert.ok(hands < 200, 'partida longa demais');
      let steps = 0;
      while (!m.hand.over) {
        const pi = m.hand.current;
        const mv = Domino.botMove(m, pi);
        assert.ok(mv ? Domino.play(m, pi, mv.tile.id, mv.side) : Domino.pass(m, pi));
        assert.ok(++steps < 200);
      }
      const total = m.players.reduce((s, p) => s + p.hand.length, 0) + m.hand.chain.length;
      assert.strictEqual(total, 28);
    }
    assert.ok(m.scores[m.winnerTeam] >= 6);
  }
});

test('cacheta: trincas e sequências', () => {
  const C = Cacheta.card;
  assert.ok(Cacheta.isSet([C(7, 0), C(7, 1), C(7, 2)]));
  assert.ok(!Cacheta.isSet([C(7, 0), C(7, 0, 1), C(7, 2)]));
  assert.ok(Cacheta.isRun([C(4, 1), C(5, 1), C(6, 1), C(7, 1)]));
  assert.ok(Cacheta.isRun([C(1, 2), C(2, 2), C(3, 2)]));
  assert.ok(Cacheta.isRun([C(12, 2), C(13, 2), C(1, 2)]));
  assert.ok(!Cacheta.isRun([C(13, 2), C(1, 2), C(2, 2)]));
  assert.ok(!Cacheta.isRun([C(4, 1), C(5, 2), C(6, 1)]));
});

test('cacheta: partição de mão vencedora', () => {
  const C = Cacheta.card;
  const win = [C(1, 0), C(1, 1), C(1, 2), C(5, 3), C(6, 3), C(7, 3), C(8, 3), C(10, 1), C(10, 2)];
  assert.strictEqual(Cacheta.partition(win), null);
  const win2 = [C(1, 0), C(1, 1), C(1, 2), C(5, 3), C(6, 3), C(7, 3), C(10, 0), C(10, 1), C(10, 2)];
  assert.ok(Cacheta.partition(win2));
  const ten = [...win2, C(13, 3)];
  assert.strictEqual(Cacheta.winningDiscard(ten).r, 13);
});

test('cacheta: mãos inteiras entre bots terminam', () => {
  let decided = 0;
  for (let g = 0; g < 200; g++) {
    const m = Cacheta.startHand(Cacheta.newMatch(['a', 'b', 'c', 'd']));
    while (!m.hand.over) {
      const pi = m.hand.current;
      assert.ok(Cacheta.draw(m, pi, Cacheta.botDraw(m, pi)));
      if (m.hand.over) break;
      assert.ok(Cacheta.discard(m, pi, Cacheta.botDiscard(m, pi)));
    }
    const cards = m.players.reduce((s, p) => s + p.hand.length, 0) + m.hand.stock.length + m.hand.pile.length;
    assert.strictEqual(cards, 104);
    if (m.hand.winner != null) {
      decided++;
      assert.ok(Cacheta.partition(m.players[m.hand.winner].hand));
    }
  }
  assert.ok(decided > 180, `poucas mãos decididas: ${decided}`);
});

test('dominó: mesa em L cabe no celular, sem pedras sobrepostas', () => {
  // Área do centro da mesa num celular comum (~390px de largura).
  const W = 230;
  const H = 470;
  let minS = Infinity;
  for (let g = 0; g < 150; g++) {
    const m = Domino.startHand(Domino.newMatch(['a', 'b', 'c', 'd']));
    while (!m.hand.over) {
      const pi = m.hand.current;
      const mv = Domino.botMove(m, pi);
      if (mv) Domino.play(m, pi, mv.tile.id, mv.side); else Domino.pass(m, pi);
      const res = Layout.fit(m.hand.chain, m.hand.origin, W, H);
      assert.strictEqual(res.tiles.length, m.hand.chain.length);
      for (const t of res.tiles) assert.ok(Layout.inside(t, W, H), 'pedra fora da mesa');
      for (let i = 0; i < res.tiles.length; i++) for (let j = i + 1; j < res.tiles.length; j++) {
        assert.ok(!Layout.overlaps(res.tiles[i], res.tiles[j]), 'pedras sobrepostas');
      }
      minS = Math.min(minS, res.S);
    }
  }
  assert.ok(minS >= 14, `pedras ficaram pequenas demais: ${minS}`);
});

test('dominó: metades encostadas têm o mesmo número', () => {
  const m = Domino.startHand(Domino.newMatch(['a', 'b', 'c', 'd']));
  while (!m.hand.over) {
    const pi = m.hand.current;
    const mv = Domino.botMove(m, pi);
    if (mv) Domino.play(m, pi, mv.tile.id, mv.side); else Domino.pass(m, pi);
  }
  const res = Layout.fit(m.hand.chain, m.hand.origin, 230, 470);
  const byId = Object.fromEntries(res.tiles.map((t) => [t.id, t]));
  // Cada pedra mostra os dois números que ela tem.
  for (const c of m.hand.chain) {
    const t = byId[c.id];
    assert.deepStrictEqual([t.first, t.second].sort(), [c.l, c.r].sort());
  }
});
