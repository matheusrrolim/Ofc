/* Tela do Dominó: você (embaixo) + parceiro (em cima) contra dois bots. */
(function (root) {
  'use strict';
  const { el, tile, modal, toast, wallet } = root.U;
  const D = root.Domino;

  const PRIZE = 100;
  const LOSS = 30;
  const BOT_DELAY = 750;

  function mount(container, ctx) {
    const names = [ctx.name, 'Carlos', 'Bia (parceira)', 'Rosa'];
    const m = D.newMatch(names);
    D.startHand(m);
    let selected = null;
    let alive = true;
    let timer = null;
    let lastMsg = 'Quem tem a carroça de sena (6-6) começa.';

    function describe(mv) {
      if (!mv) return '';
      const who = mv.pi === 0 ? 'Você' : m.players[mv.pi].name;
      return mv.pass ? `${who} passou.` : `${who} jogou ${mv.id.replace('-', '|')}.`;
    }

    function seat(i, pos) {
      const p = m.players[i];
      const turn = !m.hand.over && m.hand.current === i;
      return el('div', { class: `seat seat-${pos}` + (turn ? ' turn' : '') },
        el('div', { class: 'seat-name' }, p.name),
        el('div', { class: 'seat-backs' }, p.hand.map(() => el('span', { class: 'mini-back' }))),
        el('div', { class: 'seat-count' }, `${p.hand.length} pedras`));
    }

    function board() {
      const h = m.hand;
      const chooseSide = selected && h.current === 0;
      const sideBtn = (side, label) => el('button', {
        class: 'side-btn',
        onclick: () => humanPlay(selected, side),
      }, label);
      const wrap = el('div', { class: 'board' });
      if (!h.chain.length) {
        wrap.append(el('div', { class: 'board-empty' }, 'Mesa vazia'));
      } else {
        if (chooseSide) wrap.append(sideBtn('left', '◀ aqui'));
        for (const c of h.chain) {
          wrap.append(tile(c.l, c.r, { vertical: c.dbl, cls: h.lastMove && h.lastMove.id === c.id ? 'last' : '' }));
        }
        if (chooseSide) wrap.append(sideBtn('right', 'aqui ▶'));
      }
      return wrap;
    }

    function handView() {
      const moves = D.movesFor(m, 0);
      const playable = new Set(moves.map((x) => x.tile.id));
      return el('div', { class: 'hand domino-hand' },
        m.players[0].hand.map((t) => tile(t.a, t.b, {
          vertical: true,
          id: t.id,
          cls: (playable.has(t.id) ? 'playable' : 'dim') + (selected === t.id ? ' selected' : ''),
          onclick: () => onTile(t.id),
        })));
    }

    function render() {
      if (!alive) return;
      const h = m.hand;
      const myTurn = !h.over && h.current === 0;
      const canPlay = myTurn && D.movesFor(m, 0).length > 0;
      container.replaceChildren(
        el('div', { class: 'game domino' },
          el('header', { class: 'game-bar' },
            el('button', { class: 'icon-btn', onclick: leave, 'aria-label': 'Voltar' }, '←'),
            el('div', { class: 'game-title' }, 'Dominó'),
            el('div', { class: 'score' },
              el('span', { class: 'us' }, `Nós ${m.scores[0]}`), ' × ',
              el('span', { class: 'them' }, `${m.scores[1]} Eles`))),
          el('div', { class: 'table' },
            seat(2, 'top'), seat(3, 'left'), seat(1, 'right'),
            el('div', { class: 'table-center' }, board())),
          el('div', { class: 'status' + (myTurn ? ' mine' : '') },
            myTurn ? (canPlay ? (selected ? 'Escolha a ponta onde jogar.' : 'Sua vez: toque numa pedra destacada.') : 'Você não tem pedra que encaixe.') : lastMsg),
          el('div', { class: 'me' + (myTurn ? ' turn' : '') },
            handView(),
            myTurn && !canPlay ? el('button', { class: 'btn btn-primary', onclick: humanPass }, 'Passar a vez') : null)));
      if (h.over) setTimeout(showResult, 500);
      else if (h.current !== 0) schedule();
    }

    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(botStep, BOT_DELAY);
    }

    function botStep() {
      if (!alive || m.hand.over || m.hand.current === 0) return;
      const pi = m.hand.current;
      const mv = D.botMove(m, pi);
      if (mv) D.play(m, pi, mv.tile.id, mv.side);
      else D.pass(m, pi);
      lastMsg = describe(m.hand.lastMove);
      render();
    }

    function onTile(id) {
      const moves = D.movesFor(m, 0).filter((x) => x.tile.id === id);
      if (!moves.length) {
        if (m.hand.current === 0) toast('Essa pedra não encaixa.');
        return;
      }
      if (moves.length === 1) humanPlay(id, moves[0].side);
      else { selected = selected === id ? null : id; render(); }
    }

    function humanPlay(id, side) {
      selected = null;
      if (D.play(m, 0, id, side)) lastMsg = describe(m.hand.lastMove);
      render();
    }

    function humanPass() {
      if (D.pass(m, 0)) lastMsg = 'Você passou.';
      render();
    }

    function showResult() {
      if (!alive || document.querySelector('.modal-back')) return;
      const r = m.hand.result;
      const ours = r.team === 0;
      let title;
      let text;
      if (r.type === 'batida') {
        const who = r.winner === 0 ? 'Você' : m.players[r.winner].name;
        title = ours ? 'Ganhamos a mão!' : 'Eles ganharam a mão';
        text = `${who} bateu (${r.kind}): +${r.pts} ${r.pts > 1 ? 'pontos' : 'ponto'}.`;
      } else if (r.team == null) {
        title = 'Jogo fechado: empate';
        text = `Pontos na mão: nós ${r.teamPips[0]}, eles ${r.teamPips[1]}. Ninguém pontua.`;
      } else {
        title = ours ? 'Jogo fechado: ganhamos!' : 'Jogo fechado: eles ganharam';
        text = `Pontos na mão: nós ${r.teamPips[0]}, eles ${r.teamPips[1]}. Menor ganha 1 ponto.`;
      }
      const body = el('p', {}, text, el('br'), el('strong', {}, `Placar: Nós ${m.scores[0]} × ${m.scores[1]} Eles`));
      if (m.winnerTeam != null) {
        const won = m.winnerTeam === 0;
        wallet.add(won ? PRIZE : -LOSS);
        modal(won ? '🏆 Vitória!' : 'Derrota',
          el('div', {}, body, el('p', {}, won ? `Você ganhou ${PRIZE} fichas.` : `Você perdeu ${LOSS} fichas.`)),
          [
            { label: 'Sair', onclick: () => ctx.exit() },
            { label: 'Jogar de novo', primary: true, onclick: () => { alive = false; mount(container, ctx); } },
          ]);
      } else {
        modal(title, body, [{
          label: 'Próxima mão', primary: true,
          onclick: () => { D.startHand(m); lastMsg = `${m.hand.current === 0 ? 'Você começa' : m.players[m.hand.current].name + ' começa'}.`; render(); },
        }]);
      }
    }

    function leave() {
      modal('Sair da partida?', el('p', {}, 'A partida em andamento será perdida.'), [
        { label: 'Continuar', onclick: () => {} },
        { label: 'Sair', primary: true, onclick: () => ctx.exit() },
      ]);
    }

    ctx.onExit(() => { alive = false; clearTimeout(timer); });
    render();
  }

  root.DominoUI = { mount };
})(this);
