/* Tela da Cacheta: você contra três bots. */
(function (root) {
  'use strict';
  const { el, playingCard, cardBack, modal, toast, wallet } = root.U;
  const C = root.Cacheta;

  const PRIZE = 60;
  const LOSS = 15;
  const BOT_DELAY = 700;

  function mount(container, ctx) {
    const names = [ctx.name, 'Carlos', 'Bia', 'Rosa'];
    const m = C.newMatch(names);
    const social = root.Social.create({ names, partner: null });
    C.startHand(m);
    let selected = null;
    let sortMode = 'grupos';
    let alive = true;
    let timer = null;
    let lastMsg = '';

    const label = (c) => C.rankLabel(c.r) + C.SUITS[c.s];

    function describe(mv) {
      if (!mv) return '';
      const who = mv.pi === 0 ? 'Você' : m.players[mv.pi].name;
      if (mv.discard) return `${who} descartou ${label(mv.discard)}.`;
      return mv.draw === 'discard' ? `${who} pegou ${label(mv.card)} do lixo.` : `${who} comprou do monte.`;
    }

    function arranged(hand) {
      if (sortMode === 'grupos') {
        const { groups, loose } = C.suggestGroups(hand);
        return [...groups.map((g) => C.sortCards(g, 'valor')), C.sortCards(loose, 'naipe')];
      }
      return [C.sortCards(hand, sortMode)];
    }

    function seat(i, pos) {
      const p = m.players[i];
      const turn = !m.hand.over && m.hand.current === i;
      return el('div', { class: `seat seat-${pos}` + (turn ? ' turn' : '') },
        el('div', { class: 'seat-name' }, p.name),
        el('div', { class: 'seat-cards' }, p.hand.map(() => el('span', { class: 'mini-card' }))),
        el('div', { class: 'seat-count' }, `${p.hand.length} cartas`));
    }

    function render() {
      if (!alive) return;
      const h = m.hand;
      const myTurn = !h.over && h.current === 0;
      const drawPhase = myTurn && h.phase === 'draw';
      const discPhase = myTurn && h.phase === 'discard';
      const top = C.topDiscard(m);
      const hand = m.players[0].hand;
      const winners = discPhase ? new Set(hand.filter((c) => c.id !== h.takenId && C.partition(hand.filter((x) => x !== c))).map((c) => c.id)) : new Set();

      let status;
      if (drawPhase) status = 'Sua vez: compre do monte ou pegue do lixo.';
      else if (discPhase) status = winners.size ? 'Você pode BATER! Descarte a carta brilhando.' : 'Escolha uma carta para descartar.';
      else status = lastMsg || `${m.players[h.current].name} está jogando…`;

      const groups = arranged(hand);
      container.replaceChildren(
        el('div', { class: 'game cacheta' },
          el('header', { class: 'game-bar' },
            el('button', { class: 'icon-btn', onclick: leave, 'aria-label': 'Voltar' }, '←'),
            el('div', { class: 'game-title' }, 'Cacheta'),
            social.chatButton(),
            el('div', { class: 'score' }, `Mão ${m.handNo} · Vitórias ${m.players[0].wins}`)),
          el('div', { class: 'table' },
            seat(2, 'top'), seat(3, 'left'), seat(1, 'right'),
            el('div', { class: 'table-center' },
              el('div', { class: 'piles' },
                el('div', { class: 'pile' + (drawPhase ? ' active' : ''), onclick: () => humanDraw('stock') },
                  cardBack(), el('small', {}, `Monte (${h.stock.length})`)),
                el('div', { class: 'pile' + (drawPhase && top ? ' active' : ''), onclick: () => humanDraw('discard') },
                  top ? playingCard(top) : el('div', { class: 'card empty' }), el('small', {}, 'Lixo')))),
            social.emojiButton()),
          el('div', { class: 'status' + (myTurn ? ' mine' : '') }, status),
          el('div', { class: 'me' + (myTurn ? ' turn' : '') },
            el('div', { class: 'hand card-hand' },
              groups.map((g, gi) => el('div', { class: 'card-group' + (gi < groups.length - 1 || sortMode !== 'grupos' ? '' : ' loose') },
                g.map((c) => playingCard(c, {
                  cls: [
                    selected === c.id ? 'selected' : '',
                    winners.has(c.id) ? 'win-hint' : '',
                    c.id === h.takenId ? 'taken' : '',
                  ].join(' '),
                  onclick: () => onCard(c.id),
                }))))),
            el('div', { class: 'hand-tools' },
              ['grupos', 'naipe', 'valor'].map((mode) => el('button', {
                class: 'chip' + (sortMode === mode ? ' on' : ''),
                onclick: () => { sortMode = mode; render(); },
              }, mode === 'grupos' ? 'Jogos' : mode === 'naipe' ? 'Naipe' : 'Valor')),
              discPhase && selected ? el('button', { class: 'btn btn-primary', onclick: () => humanDiscard(selected) }, winners.has(selected) ? 'Bater!' : 'Descartar') : null))));
      if (h.over) setTimeout(showResult, 600);
      else if (h.current !== 0) schedule();
    }

    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(botStep, BOT_DELAY);
    }

    function botStep() {
      if (!alive || m.hand.over || m.hand.current === 0) return;
      const pi = m.hand.current;
      if (m.hand.phase === 'draw') {
        C.draw(m, pi, C.botDraw(m, pi));
      } else {
        C.discard(m, pi, C.botDiscard(m, pi));
      }
      lastMsg = describe(m.hand.lastMove);
      render();
      if (m.hand.over && m.hand.winner != null) social.event('win', m.hand.winner);
    }

    function humanDraw(from) {
      const h = m.hand;
      if (h.over || h.current !== 0 || h.phase !== 'draw') return;
      if (from === 'discard' && !C.topDiscard(m)) return;
      C.draw(m, 0, from);
      selected = null;
      render();
    }

    function onCard(id) {
      const h = m.hand;
      if (h.over || h.current !== 0) return;
      if (h.phase !== 'discard') { toast('Primeiro compre uma carta.'); return; }
      if (id === h.takenId) { toast('Não pode descartar a carta que pegou do lixo.'); return; }
      if (selected === id) humanDiscard(id);
      else { selected = id; render(); }
    }

    function humanDiscard(id) {
      if (C.discard(m, 0, id)) {
        selected = null;
        lastMsg = describe(m.hand.lastMove);
      }
      render();
      if (m.hand.over && m.hand.winner === 0) social.event('win', 0);
    }

    function showResult() {
      if (!alive || document.querySelector('.modal-back')) return;
      const h = m.hand;
      const w = h.winner;
      const won = w === 0;
      let body;
      if (w == null) {
        body = el('p', {}, 'O monte acabou e ninguém bateu. Mão empatada.');
      } else {
        wallet.add(won ? PRIZE : -LOSS);
        body = el('div', {},
          el('p', {}, won ? `Você bateu e ganhou ${PRIZE} fichas!` : `${m.players[w].name} bateu. Você perdeu ${LOSS} fichas.`),
          el('div', { class: 'win-groups' }, h.groups.map((g) => el('div', { class: 'card-group' }, C.sortCards(g, 'valor').map((c) => playingCard(c, { cls: 'small' }))))));
      }
      modal(won ? '🏆 Você bateu!' : w == null ? 'Empate' : 'Fim da mão', body, [
        { label: 'Sair', onclick: () => ctx.exit() },
        { label: 'Próxima mão', primary: true, onclick: () => { C.startHand(m); lastMsg = ''; selected = null; render(); } },
      ]);
    }

    function leave() {
      modal('Sair da partida?', el('p', {}, 'A mão em andamento será perdida.'), [
        { label: 'Continuar', onclick: () => {} },
        { label: 'Sair', primary: true, onclick: () => ctx.exit() },
      ]);
    }

    ctx.onExit(() => { alive = false; clearTimeout(timer); social.destroy(); });
    render();
  }

  root.CachetaUI = { mount };
})(this);
