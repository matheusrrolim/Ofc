/* Lobby da plataforma: perfil, fichas e lista de jogos. */
(function (root) {
  'use strict';
  const { el, store, modal, toast, wallet, tile } = root.U;

  const APP_NAME = 'Mesa de Jogos';

  // Para adicionar um jogo novo: crie www/js/<jogo>-engine.js + ui-<jogo>.js
  // e registre aqui com `ui` apontando para o objeto que tem mount().
  const GAMES = [
    { id: 'domino', name: 'Dominó', desc: 'Em duplas, até 6 pontos', ui: () => root.DominoUI, icon: () => tile(6, 6, { vertical: true }) },
    { id: 'cacheta', name: 'Cacheta', desc: 'Forme 3 jogos e bata', ui: () => root.CachetaUI, icon: cardsIcon },
    { id: 'tranca', name: 'Tranca', desc: 'Canastras em dupla', soon: true, icon: () => el('div', { class: 'gicon' }, '♣') },
    { id: 'truco', name: 'Truco', desc: 'Truco paulista', soon: true, icon: () => el('div', { class: 'gicon' }, '♥') },
    { id: 'buraco', name: 'Buraco', desc: 'Buraco fechado', soon: true, icon: () => el('div', { class: 'gicon' }, '♦') },
    { id: 'damas', name: 'Damas', desc: 'Clássico de tabuleiro', soon: true, icon: () => el('div', { class: 'gicon' }, '⛀') },
  ];

  function cardsIcon() {
    const C = root.Cacheta;
    return el('div', { class: 'icon-cards' },
      root.U.playingCard(C.card(1, 0), { cls: 'small' }),
      root.U.playingCard(C.card(13, 1), { cls: 'small' }));
  }

  const app = document.getElementById('app');
  let exitHandlers = [];

  function profileName() { return store.get('nome', ''); }

  function askName(onDone) {
    const input = el('input', { class: 'input', maxlength: 16, placeholder: 'Seu nome', value: profileName() });
    modal('Como quer ser chamado?', input, [{
      label: 'Salvar', primary: true,
      onclick: () => {
        const v = input.value.trim();
        if (!v) { toast('Digite um nome.'); return false; }
        store.set('nome', v);
        if (onDone) onDone();
        return true;
      },
    }]);
    setTimeout(() => input.focus(), 50);
  }

  function lobby() {
    exitHandlers.forEach((f) => f());
    exitHandlers = [];
    const fichas = wallet.get();
    app.replaceChildren(
      el('div', { class: 'lobby' },
        el('header', { class: 'lobby-bar' },
          el('div', { class: 'brand' }, el('span', { class: 'logo' }, '♠'), APP_NAME),
          el('div', { class: 'coins', title: 'Fichas' }, el('span', { class: 'coin' }), el('span', { 'data-fichas': true }, fichas.toLocaleString('pt-BR')))),
        el('section', { class: 'hello' },
          el('div', {},
            el('div', { class: 'hello-sub' }, 'Olá,'),
            el('button', { class: 'hello-name', onclick: () => askName(lobby) }, profileName() || 'Jogador', ' ✎')),
          fichas < 50 ? el('button', { class: 'btn btn-primary', onclick: () => { wallet.add(500); toast('+500 fichas!'); lobby(); } }, 'Ganhar 500 fichas') : null),
        el('h3', { class: 'section-title' }, 'Jogos'),
        el('div', { class: 'game-grid' },
          GAMES.map((g) => el('button', {
            class: 'game-card' + (g.soon ? ' soon' : ''),
            onclick: () => (g.soon ? toast(`${g.name} chega em breve!`) : openGame(g)),
          },
          el('div', { class: 'game-icon' }, g.icon()),
          el('div', { class: 'game-name' }, g.name),
          el('div', { class: 'game-desc' }, g.desc),
          g.soon ? el('span', { class: 'badge' }, 'Em breve') : null))),
        el('footer', { class: 'lobby-foot' }, 'Jogue contra o computador. Multiplayer online em breve.')));
  }

  function openGame(g) {
    exitHandlers.forEach((f) => f());
    exitHandlers = [];
    const ctx = {
      name: profileName() || 'Você',
      exit: lobby,
      onExit: (f) => exitHandlers.push(f),
    };
    g.ui().mount(app, ctx);
  }

  lobby();
  if (!profileName()) askName(lobby);

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})(this);
