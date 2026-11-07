/*
 * Tela do Dominó. Em 4: você embaixo, o parceiro em cima, os adversários dos lados.
 * Mano a mano: o rival fica em cima e aparece o monte para comprar.
 * Funciona offline (contra bots) e online: só depende do "controle" recebido
 * em ctx.table (Tables.local ou Net.session().controller).
 */
(function (root) {
  'use strict';
  const { el, tile, modal, toast, wallet, avatar } = root.U;
  const D = root.Domino;
  const Layout = root.DominoLayout;

  const PRIZE = 100;
  const LOSS = 30;

  function mount(container, ctx) {
    const table = ctx.table;
    let m = table.state();
    let selected = null;
    let alive = true;
    let closeModal = null;
    let resultShownFor = null;
    let lastMsg = 'Quem tem a carroça de sena (6-6) começa.';
    const social = root.Social.create({
      name: (s) => (m && m.players[s] ? m.players[s].name : ''),
      isBot: (s) => !!(m && m.players[s] && m.players[s].bot),
      partner: m.players.length === 4 ? 2 : null,
      seats: m.players.length,
      onSend: (t) => table.sendChat(t),
      onEmoji: (e) => table.sendEmoji(e),
    });
    if (table.onChat) table.onChat((s, t) => social.receive(s, t));
    if (table.onEmoji) table.onEmoji((s, e) => social.react(s, e));

    const who = (pi) => (pi === 0 ? 'Você' : m.players[pi].name);
    const solo = () => m.players.length === 2; // mano a mano
    const us = () => (solo() ? 'Você' : 'Nós');
    const them = () => (solo() ? m.players[1].name : 'Eles');

    function describe(mv) {
      if (!mv) return '';
      if (mv.buy) return `${who(mv.pi)} comprou do monte.`;
      return mv.pass ? `${who(mv.pi)} passou.` : `${who(mv.pi)} jogou ${mv.id.replace('-', '|')}.`;
    }

    function seat(i, pos) {
      const p = m.players[i];
      const turn = !m.hand.over && m.hand.current === i;
      const n = p.hand.length;
      return el('div', { class: `seat seat-${pos}` + (turn ? ' turn' : '') },
        avatar(p.name, i),
        el('div', { class: 'seat-name' }, p.name, i === 2 && !solo() ? el('small', {}, ' · parceiro') : null),
        el('div', { class: 'seat-backs' }, p.hand.map(() => el('span', { class: 'mini-back' }))),
        el('div', { class: 'seat-count' }, `${n} ${n === 1 ? 'pedra' : 'pedras'}`));
    }

    /* ---------- mesa: fila que sobe e desce e vira nas pontas ---------- */
    function drawBoard() {
      const area = container.querySelector('.board-area');
      if (!area) return;
      const h = m.hand;
      const W = area.clientWidth;
      const H = area.clientHeight;
      area.replaceChildren();
      if (!h.chain.length) {
        area.append(el('div', { class: 'board-empty' }, 'Mesa vazia'));
        return;
      }
      const res = Layout.fit(h.chain, h.origin, W, H);
      const S = res.S;
      area.style.setProperty('--S', S + 'px');
      const place = (node, r) => {
        node.style.left = (W / 2 + r.cx - r.w / 2) + 'px';
        node.style.top = (H / 2 + r.cy - r.h / 2) + 'px';
        node.style.width = r.w + 'px';
        node.style.height = r.h + 'px';
        return node;
      };
      const ends = new Set([h.chain[0].id, h.chain[h.chain.length - 1].id]);
      const choosing = selected && h.current === 0;
      for (const t of res.tiles) {
        area.append(place(tile(t.first, t.second, {
          vertical: t.vertical,
          cls: [
            h.lastMove && h.lastMove.id === t.id ? 'last' : '',
            choosing && ends.has(t.id) ? 'end' : '',
          ].join(' '),
        }), t));
      }
      if (choosing) {
        let missing = false;
        for (const side of ['left', 'right']) {
          const g = res.ghosts[side];
          if (!g) { missing = true; continue; }
          area.append(place(el('button', {
            class: 'ghost',
            'aria-label': `Jogar na ponta ${side === 'left' ? h.left : h.right}`,
            onclick: () => humanPlay(selected, side),
          }, 'aqui'), g));
        }
        if (missing) {
          area.append(el('div', { class: 'side-choice' },
            ['left', 'right'].map((side) => el('button', { class: 'side-btn', onclick: () => humanPlay(selected, side) },
              `Ponta ${side === 'left' ? h.left : h.right}`))));
        }
      }
    }

    /** Mano a mano: as pedras do monte viradas para baixo; o jogador escolhe uma. */
    function buySheet(stock) {
      return el('div', { class: 'buy-sheet' },
        el('div', { class: 'buy-title' }, `Escolha uma pedra do monte (${stock})`),
        el('div', { class: 'buy-grid' },
          Array.from({ length: stock }, (_, i) => el('button', {
            class: 'tile-back',
            'aria-label': `Comprar a pedra ${i + 1} do monte`,
            onclick: (e) => { e.currentTarget.classList.add('picked'); table.act({ type: 'buy', index: i }); },
          }))));
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
      if (!alive || !m) return;
      const h = m.hand;
      const myTurn = !h.over && h.current === 0;
      const canPlay = myTurn && D.movesFor(m, 0).length > 0;
      const stock = h.boneyard ? h.boneyard.length : 0;
      const mustBuy = myTurn && !canPlay && stock > 0;
      let status = lastMsg;
      if (myTurn) {
        if (canPlay) status = selected ? 'Toque em "aqui" na ponta onde quer jogar.' : 'Sua vez: toque numa pedra destacada.';
        else status = mustBuy ? 'Nenhuma pedra encaixa: escolha uma pedra do monte.' : 'Você não tem pedra que encaixe.';
      }
      else if (!h.over && !lastMsg) status = `Vez de ${m.players[h.current].name}…`;
      container.replaceChildren(
        el('div', { class: 'game domino' },
          el('header', { class: 'game-bar' },
            el('button', { class: 'icon-btn', onclick: leave, 'aria-label': 'Voltar' }, '←'),
            el('div', { class: 'game-title' }, 'Dominó', table.online ? el('span', { class: 'online-tag' }, 'online') : null),
            el('div', { class: 'score' },
              el('span', { class: 'us' }, `${us()} ${m.scores[0]}`), ' × ',
              el('span', { class: 'them' }, `${m.scores[1]} ${them()}`))),
          el('div', { class: 'table' + (solo() ? ' solo' : '') },
            solo() ? seat(1, 'top') : [seat(2, 'top'), seat(3, 'left'), seat(1, 'right')],
            solo() ? el('div', { class: 'stock-tag' }, `Monte: ${stock}`) : null,
            el('div', { class: 'table-center' }, el('div', { class: 'board-area' })),
            el('div', { class: 'my-seat' }, avatar(m.players[0].name, 0), el('span', {}, 'Você')),
            social.toolbar(),
            mustBuy ? buySheet(stock) : null),
          el('div', { class: 'status' + (myTurn ? ' mine' : '') }, status),
          el('div', { class: 'me' + (myTurn ? ' turn' : '') },
            handView(),
            mustBuy ? null
              : myTurn && !canPlay ? el('button', { class: 'btn btn-primary', onclick: humanPass }, 'Passar a vez') : null)));
      drawBoard();
      if (h.over) setTimeout(showResult, 500);
      else if (closeModal) { closeModal(); closeModal = null; }
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
      table.act({ type: 'play', id, side });
    }

    function humanPass() { table.act({ type: 'pass' }); }

    // Toda mudança na mesa (sua jogada, bot, ou outra pessoa online).
    let prevMove = '';
    let winAnnounced = '';
    table.onChange(() => {
      if (!alive) return;
      m = table.state();
      const h = m.hand;
      // A mesma jogada pode chegar mais de uma vez (online); compara pelo conteúdo.
      const moveKey = `${m.handNo}|${h.chain.length}|${h.passes}|${h.boneyard ? h.boneyard.length : 0}|${JSON.stringify(h.lastMove)}`;
      if (h.lastMove && moveKey !== prevMove) {
        lastMsg = describe(h.lastMove);
        if (h.lastMove.pass) social.event('pass', h.lastMove.pi);
      }
      prevMove = moveKey;
      if (h.current !== 0) selected = null;
      render();
      const r = h.over && h.result;
      const key = m.handNo + ':' + m.scores.join();
      if (r && r.winner != null && r.pts && winAnnounced !== key) {
        winAnnounced = key;
        social.event('win', r.winner);
      }
    });

    function showResult() {
      const key = m.handNo + ':' + m.scores.join();
      if (!alive || !m.hand.over || resultShownFor === key || document.querySelector('.modal-back')) return;
      resultShownFor = key;
      const r = m.hand.result;
      const ours = r.team === 0;
      let title;
      let text;
      if (r.type === 'batida') {
        title = ours ? (solo() ? 'Você ganhou a mão!' : 'Ganhamos a mão!') : (solo() ? `${them()} ganhou a mão` : 'Eles ganharam a mão');
        text = `${who(r.winner)} bateu (${r.kind}): +${r.pts} ${r.pts > 1 ? 'pontos' : 'ponto'}.`;
      } else if (r.team == null) {
        title = 'Jogo fechado: empate';
        text = `Pontos na mão: ${us().toLowerCase()} ${r.teamPips[0]}, ${solo() ? them() : 'eles'} ${r.teamPips[1]}. Ninguém pontua.`;
      } else {
        title = ours ? (solo() ? 'Jogo fechado: você ganhou!' : 'Jogo fechado: ganhamos!') : `Jogo fechado: ${solo() ? them() + ' ganhou' : 'eles ganharam'}`;
        text = `Pontos na mão: ${us().toLowerCase()} ${r.teamPips[0]}, ${solo() ? them() : 'eles'} ${r.teamPips[1]}. Menor ganha 1 ponto.`;
      }
      const body = el('p', {}, text, el('br'), el('strong', {}, `Placar: ${us()} ${m.scores[0]} × ${m.scores[1]} ${them()}`));
      if (m.winnerTeam != null) {
        const won = m.winnerTeam === 0;
        wallet.add(won ? PRIZE : -LOSS);
        closeModal = modal(won ? '🏆 Vitória!' : 'Derrota',
          el('div', {}, body, el('p', {}, won ? `Você ganhou ${PRIZE} fichas.` : `Você perdeu ${LOSS} fichas.`)),
          [
            { label: 'Sair', onclick: () => ctx.exit() },
            { label: 'Jogar de novo', primary: true, onclick: () => { closeModal = null; table.next(); } },
          ]);
      } else {
        closeModal = modal(title, body, [{
          label: 'Próxima mão', primary: true,
          onclick: () => { closeModal = null; lastMsg = ''; table.next(); },
        }]);
      }
    }

    function leave() {
      modal('Sair da partida?', el('p', {}, table.online
        ? 'Você sai da mesa e um bot assume o seu lugar.'
        : 'A partida em andamento será perdida.'), [
        { label: 'Continuar', onclick: () => {} },
        { label: 'Sair', primary: true, onclick: () => { table.leave(); ctx.exit(); } },
      ]);
    }

    const onResize = () => { if (alive && m) drawBoard(); };
    window.addEventListener('resize', onResize);
    ctx.onExit(() => {
      alive = false;
      window.removeEventListener('resize', onResize);
      table.destroy();
      social.destroy();
    });
    render();
    table.start();
  }

  root.DominoUI = { mount };
})(this);
