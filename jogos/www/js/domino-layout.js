/*
 * Posição das pedras na mesa do dominó, como numa mesa de verdade:
 *
 * - A primeira pedra fica no centro, em pé.
 * - A ponta esquerda da fila cresce para CIMA e a ponta direita para BAIXO.
 * - Quando a pedra não cabe mais, a fila vira num "L" (cima → esquerda → baixo,
 *   e baixo → direita → cima), encostando a pedra nova na anterior.
 * - Carroças (pedras dobradas) ficam atravessadas na fila.
 * - Usa o maior tamanho de pedra que faz tudo caber.
 *
 * Coordenadas com origem no centro da mesa. Sem DOM: testável no Node.
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.DominoLayout = mod;
})(this, function () {
  'use strict';

  const VEC = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const TURNS = {
    up: ['up', 'left', 'down', 'right'],
    down: ['down', 'right', 'up', 'left'],
  };
  const MAX_S = 34;
  const MIN_S = 10;

  function rect(cx, cy, w, h) { return { cx, cy, w, h }; }

  function inside(r, W, H) {
    return r.cx - r.w / 2 >= -W / 2 - 0.01 && r.cx + r.w / 2 <= W / 2 + 0.01
      && r.cy - r.h / 2 >= -H / 2 - 0.01 && r.cy + r.h / 2 <= H / 2 + 0.01;
  }

  function overlaps(a, b) {
    return Math.abs(a.cx - b.cx) * 2 < a.w + b.w - 0.5 && Math.abs(a.cy - b.cy) * 2 < a.h + b.h - 0.5;
  }

  /** Pedra seguindo reto na direção `dir` a partir da ponta P. */
  function straight(P, dir, S, gap, dbl) {
    const [dx, dy] = VEC[dir];
    const L = 2 * S;
    const len = dbl ? S : L; // carroça fica atravessada
    const wid = dbl ? L : S;
    const c = [P[0] + dx * (gap + len / 2), P[1] + dy * (gap + len / 2)];
    const horiz = dx !== 0;
    return {
      r: rect(c[0], c[1], horiz ? len : wid, horiz ? wid : len),
      end: [P[0] + dx * (gap + len), P[1] + dy * (gap + len)],
      dir,
      dblC: dbl ? c : null, // centro da carroça atravessada (para virar pela ponta dela)
    };
  }

  /** Pedra fazendo a curva: sai na direção `from`, segue na direção `to`. */
  function turn(P, from, to, S, gap) {
    const [fx, fy] = VEC[from];
    const [tx, ty] = VEC[to];
    const L = 2 * S;
    const c = [P[0] + fx * (gap + S / 2) + tx * (S / 2), P[1] + fy * (gap + S / 2) + ty * (S / 2)];
    const horiz = tx !== 0;
    return {
      r: rect(c[0], c[1], horiz ? L : S, horiz ? S : L),
      end: [c[0] + tx * (L / 2), c[1] + ty * (L / 2)],
      dir: to,
    };
  }

  /**
   * Curva logo depois de uma carroça atravessada: a pedra nova sai pela PONTA
   * da carroça (alinhada com o meio dela), nunca colada na lateral comprida.
   */
  function turnAtDouble(C, to, S, gap) {
    const [tx, ty] = VEC[to];
    const L = 2 * S;
    const c = [C[0] + tx * (S + gap + L / 2), C[1] + ty * (S + gap + L / 2)];
    const horiz = tx !== 0;
    return {
      r: rect(c[0], c[1], horiz ? L : S, horiz ? S : L),
      end: [C[0] + tx * (S + gap + L), C[1] + ty * (S + gap + L)],
      dir: to,
    };
  }

  /** Tenta posicionar tudo com pedras de lado curto S. Retorna null se não couber. */
  function layout(chain, originId, W, H, S) {
    if (!chain.length) return { S, tiles: [], ghosts: { left: null, right: null } };
    const gap = Math.max(1, Math.round(S * 0.06));
    const L = 2 * S;
    let oi = chain.findIndex((c) => c.id === originId);
    if (oi < 0) oi = 0;
    const o = chain[oi];
    const tiles = [];
    const placed = [];

    const or = o.dbl ? rect(0, 0, L, S) : rect(0, 0, S, L);
    if (!inside(or, W, H)) return null;
    tiles.push({ id: o.id, ...or, first: o.l, second: o.r, vertical: !o.dbl, dbl: !!o.dbl });
    placed.push(or);
    const half = o.dbl ? S / 2 : L / 2;

    function fits(r) { return inside(r, W, H) && !placed.some((p) => overlaps(p, r)); }

    const curve = (P, dblC, from, to) => (dblC ? turnAtDouble(dblC, to, S, gap) : turn(P, from, to, S, gap));

    function next(arm, dbl) {
      const dir = arm.seq[arm.k];
      const s = straight(arm.P, dir, S, gap, dbl);
      // Só segue reto se depois ainda sobrar espaço para fazer a curva.
      const canTurnAfter = arm.k + 1 >= arm.seq.length
        || inside(curve(s.end, s.dblC, dir, arm.seq[arm.k + 1]).r, W, H);
      if (fits(s.r) && canTurnAfter) return { ...s, k: arm.k };
      if (arm.k + 1 < arm.seq.length) {
        const t = curve(arm.P, arm.dblC, dir, arm.seq[arm.k + 1]);
        if (fits(t.r)) return { ...t, dblC: null, k: arm.k + 1 };
      }
      return null;
    }

    const arms = {
      left: { P: [0, -half], seq: TURNS.up, k: 0, dblC: o.dbl ? [0, 0] : null },
      right: { P: [0, half], seq: TURNS.down, k: 0, dblC: o.dbl ? [0, 0] : null },
    };
    const order = {
      left: chain.slice(0, oi).reverse().map((c) => ({ c, inner: c.r, outer: c.l })),
      right: chain.slice(oi + 1).map((c) => ({ c, inner: c.l, outer: c.r })),
    };

    for (const side of ['left', 'right']) {
      const arm = arms[side];
      for (const { c, inner, outer } of order[side]) {
        const p = next(arm, c.dbl);
        if (!p) return null;
        // A metade de cima/esquerda é a de fora quando a fila anda para cima/esquerda.
        const backwards = p.dir === 'up' || p.dir === 'left';
        tiles.push({
          id: c.id, ...p.r,
          first: backwards ? outer : inner,
          second: backwards ? inner : outer,
          vertical: p.r.h > p.r.w,
          dbl: !!p.dblC,
        });
        placed.push(p.r);
        arm.P = p.end;
        arm.k = p.k;
        arm.dblC = p.dblC || null;
      }
    }

    // Onde a próxima pedra entraria em cada ponta (para o jogador tocar).
    const ghosts = {};
    for (const side of ['left', 'right']) {
      const p = next(arms[side], false);
      ghosts[side] = p ? p.r : null;
      if (p) placed.push(p.r);
    }
    return { S, tiles, ghosts };
  }

  /** Maior tamanho de pedra que cabe na área W × H, de preferência com espaço nas duas pontas. */
  function fit(chain, originId, W, H) {
    const top = Math.max(MIN_S, Math.min(MAX_S, Math.floor(Math.min(W, H) / 5)));
    let fallback = null;
    for (let S = top; S >= MIN_S; S--) {
      const res = layout(chain, originId, W, H, S);
      if (!res) continue;
      if (res.ghosts.left && res.ghosts.right) return res;
      if (!fallback) fallback = res;
    }
    // Último recurso (não deveria acontecer): ignora os limites da mesa.
    return fallback || layout(chain, originId, 1e6, 1e6, MIN_S);
  }

  return { layout, fit, overlaps, inside };
});
