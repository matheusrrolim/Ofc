/* Lobby da plataforma: perfil, fichas, jogos offline e mesas online. */
(function (root) {
  'use strict';
  const { el, store, modal, toast, wallet, tile } = root.U;

  const APP_NAME = 'Mesa de Jogos';

  // Para adicionar um jogo novo: crie www/js/<jogo>-engine.js + ui-<jogo>.js,
  // registre as regras em tables.js e coloque o jogo nesta lista.
  const GAMES = [
    { id: 'domino', name: 'Dominó', desc: 'Em duplas ou mano a mano', ui: () => root.DominoUI, icon: () => tile(6, 6, { vertical: true }) },
    { id: 'cacheta', name: 'Cacheta', desc: 'Em 4 ou mano a mano', ui: () => root.CachetaUI, icon: cardsIcon },
    { id: 'tranca', name: 'Tranca', desc: 'Canastras em dupla', soon: true, icon: () => el('div', { class: 'gicon' }, '♣') },
    { id: 'truco', name: 'Truco', desc: 'Truco paulista', soon: true, icon: () => el('div', { class: 'gicon' }, '♥') },
    { id: 'buraco', name: 'Buraco', desc: 'Buraco fechado', soon: true, icon: () => el('div', { class: 'gicon' }, '♦') },
    { id: 'damas', name: 'Damas', desc: 'Clássico de tabuleiro', soon: true, icon: () => el('div', { class: 'gicon' }, '⛀') },
  ];
  const playable = GAMES.filter((g) => !g.soon);
  const gameById = (id) => GAMES.find((g) => g.id === id);

  function cardsIcon() {
    const C = root.Cacheta;
    return el('div', { class: 'icon-cards' },
      root.U.playingCard(C.card(1, 0), { cls: 'small' }),
      root.U.playingCard(C.card(13, 1), { cls: 'small' }));
  }

  const app = document.getElementById('app');
  let exitHandlers = [];
  let session = null; // conexão online ativa

  function cleanup() {
    exitHandlers.forEach((f) => f());
    exitHandlers = [];
    document.querySelectorAll('.modal-back').forEach((m) => m.remove());
  }

  function profileName() { return store.get('nome', ''); }

  function askName(onDone) {
    const input = el('input', { class: 'input', id: 'name-input', maxlength: 16, placeholder: 'Seu nome', value: profileName() });
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

  /* ---------------- lobby ---------------- */
  function lobby() {
    cleanup();
    if (session) { session.close(); session = null; }
    const fichas = wallet.get();
    const back = root.Net.savedRoom();
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

        el('section', { class: 'online-box' },
          el('div', { class: 'online-head' },
            el('h3', {}, 'Jogar online'),
            el('button', { class: 'link-btn', onclick: serverSettings }, '⚙ Servidor')),
          back ? el('button', { class: 'btn btn-primary wide', onclick: () => goOnline((s) => s.resume()) }, `Voltar para a mesa ${back.code}`) : null,
          el('button', { class: 'big-option', onclick: () => pickMode('Partida rápida', (g, size) => goOnline((s) => s.quick(g.id, size))) },
            el('span', { class: 'big-ico' }, '⚡'),
            el('span', {}, el('b', {}, 'Partida rápida'), el('small', {}, 'Jogue com pessoas aleatórias'))),
          el('button', { class: 'big-option', onclick: () => pickMode('Jogar com amigos', (g, size) => goOnline((s) => s.create(g.id, size))) },
            el('span', { class: 'big-ico' }, '👥'),
            el('span', {}, el('b', {}, 'Jogar com amigos'), el('small', {}, 'Crie uma mesa e mande o código'))),
          el('button', { class: 'big-option', onclick: askCode },
            el('span', { class: 'big-ico' }, '🔑'),
            el('span', {}, el('b', {}, 'Entrar com código'), el('small', {}, 'Recebeu um código? Toque aqui')))),

        el('h3', { class: 'section-title' }, 'Jogar contra o computador'),
        el('div', { class: 'game-grid' },
          GAMES.map((g) => el('button', {
            class: 'game-card' + (g.soon ? ' soon' : ''),
            onclick: () => (g.soon ? toast(`${g.name} chega em breve!`) : pickMode(g.name, (game, size) => openLocal(game, size), g)),
          },
          el('div', { class: 'game-icon' }, g.icon()),
          el('div', { class: 'game-name' }, g.name),
          el('div', { class: 'game-desc' }, g.desc),
          g.soon ? el('span', { class: 'badge' }, 'Em breve') : null)))));
  }

  /* ---------------- jogo offline ---------------- */
  function openLocal(g, size) {
    cleanup();
    const me = profileName() || 'Você';
    const names = size === 2 ? [me, 'Carlos'] : [me, 'Carlos', 'Bia', 'Rosa'];
    const table = root.Tables.local(g.id, names);
    g.ui().mount(app, { exit: lobby, onExit: (f) => exitHandlers.push(f), table });
  }

  /* ---------------- online ---------------- */
  function serverSettings(after) {
    const input = el('input', {
      class: 'input', id: 'server-input', placeholder: 'https://mesa-de-jogos.onrender.com',
      value: store.get('servidor', '') || root.Net.serverUrl(), inputmode: 'url', autocapitalize: 'off', spellcheck: 'false',
    });
    modal('Endereço do servidor', el('div', {},
      el('p', {}, 'É o endereço onde o servidor do jogo está rodando. Normalmente já vem configurado; só mude se alguém te passar outro.'),
      input), [
      { label: 'Cancelar', onclick: () => {} },
      {
        label: 'Salvar', primary: true,
        onclick: () => {
          const v = input.value.trim();
          if (v && !/^https?:\/\/[^\s]+$/.test(v)) { toast('O endereço precisa começar com https://'); return false; }
          store.set('servidor', v);
          toast('Servidor salvo.');
          if (typeof after === 'function') setTimeout(after, 50);
          return true;
        },
      },
    ]);
  }

  function goOnline(action) {
    if (!profileName()) { askName(() => goOnline(action)); return; }
    if (!root.Net.serverUrl()) {
      toast('Configure o endereço do servidor primeiro.');
      serverSettings(() => goOnline(action));
      return;
    }
    cleanup();
    if (session) session.close();
    session = root.Net.session(profileName());
    action(session);
    waitingRoom(session);
  }

  const MODES = [
    { size: 4, label: '4 jogadores', desc: { domino: 'Em duplas', cacheta: 'Você e mais 3' } },
    { size: 2, label: 'Mano a mano', desc: { domino: '1 contra 1, com monte', cacheta: '1 contra 1' } },
  ];
  const modeName = (size) => (size === 2 ? 'Mano a mano' : '4 jogadores');

  /** Escolhe jogo + modo (4 jogadores ou mano a mano). Com `only`, só os modos daquele jogo. */
  function pickMode(title, onPick, only) {
    const games = only ? [only] : playable;
    let close = null;
    close = modal(title, el('div', { class: 'mode-list' },
      games.map((g) => el('div', { class: 'mode-game' },
        games.length > 1 ? el('div', { class: 'mode-title' }, g.name) : null,
        el('div', { class: 'mode-row' },
          MODES.map((md) => el('button', {
            class: 'mode-btn',
            onclick: () => { close(); onPick(g, md.size); },
          }, el('b', {}, md.label), el('small', {}, md.desc[g.id] || ''))))))),
    [{ label: 'Cancelar', onclick: () => {} }]);
  }

  function askCode() {
    const input = el('input', { class: 'input code-input', id: 'code-input', maxlength: 4, placeholder: 'ABCD', autocapitalize: 'characters', autocomplete: 'off', spellcheck: 'false' });
    modal('Código da mesa', el('div', {}, el('p', {}, 'Digite as 4 letras que te mandaram.'), input), [
      { label: 'Cancelar', onclick: () => {} },
      {
        label: 'Entrar', primary: true,
        onclick: () => {
          const code = input.value.trim().toUpperCase();
          if (!/^[A-Z]{4}$/.test(code)) { toast('O código tem 4 letras.'); return false; }
          setTimeout(() => goOnline((s) => s.join(code)), 0);
          return true;
        },
      },
    ]);
    setTimeout(() => input.focus(), 50);
  }

  function waitingRoom(s) {
    let mounted = false;
    let waited = 0;
    const slowTimer = setInterval(() => { waited++; if (!s.room) render(); }, 1000);
    exitHandlers.push(() => clearInterval(slowTimer));

    function exit() { s.leave(); session = null; lobby(); }

    function render() {
      if (mounted) return;
      const room = s.room;
      if (!room && s.searching) { searchScreen(); return; }
      if (!room) {
        app.replaceChildren(el('div', { class: 'room' },
          el('header', { class: 'game-bar' },
            el('button', { class: 'icon-btn', onclick: exit, 'aria-label': 'Voltar' }, '←'),
            el('div', { class: 'game-title' }, 'Conectando…')),
          el('div', { class: 'room-body center' },
            el('div', { class: 'spinner' }),
            el('p', {}, s.status === 'offline' ? 'Sem conexão com o servidor. Tentando de novo…' : 'Conectando ao servidor…'),
            waited >= 8 ? el('p', { class: 'muted' }, 'Na primeira vez do dia o servidor pode levar até 1 minuto para acordar.') : null,
            waited >= 20 ? el('button', { class: 'btn btn-ghost', onclick: () => serverSettings() }, 'Conferir endereço do servidor') : null)));
        return;
      }
      if (room.started && s.state) { startOnlineGame(room); return; }
      const g = gameById(room.game);
      const size = room.seats.length;
      const humans = room.seats.filter((x) => x && x.human).length;
      const invite = `Bora jogar ${g.name} na Mesa de Jogos! Código da mesa: ${room.code}`;
      app.replaceChildren(el('div', { class: 'room' },
        el('header', { class: 'game-bar' },
          el('button', { class: 'icon-btn', onclick: exit, 'aria-label': 'Sair da mesa' }, '←'),
          el('div', { class: 'game-title' }, `${g.name} · ${modeName(size)}`)),
        el('div', { class: 'room-body' },
          el('div', { class: 'code-box' },
            el('small', {}, 'Código da mesa'),
            el('div', { class: 'code' }, room.code),
            el('button', {
              class: 'btn btn-ghost',
              onclick: () => {
                const done = () => toast('Convite copiado! Cole no WhatsApp.');
                if (navigator.share) navigator.share({ text: invite }).catch(() => {});
                else if (navigator.clipboard) navigator.clipboard.writeText(invite).then(done, () => toast(`Código: ${room.code}`));
                else toast(`Código: ${room.code}`);
              },
            }, 'Enviar convite')),
          el('p', { class: 'muted' }, 'Quem for jogar abre o app, toca em "Entrar com código" e digita o código acima.'),
          el('div', { class: 'seats-list' },
            room.seats.map((x, i) => el('div', { class: 'seat-row' + (i === room.you ? ' me' : '') },
              el('span', { class: 'seat-num' }, g.id === 'domino' && size === 4 ? (i % 2 === 0 ? 'Dupla A' : 'Dupla B') : `Lugar ${i + 1}`),
              el('span', { class: 'seat-who' }, x ? x.name + (i === room.you ? ' (você)' : '') : 'Vaga livre'),
              el('span', { class: 'seat-state' }, x ? (x.online ? '🟢' : '⚪') : '🤖')))),
          room.host
            ? el('button', { class: 'btn btn-primary wide', onclick: () => s.start() }, humans < size ? `Começar (${size - humans} ${size - humans === 1 ? 'bot' : 'bots'})` : 'Começar partida')
            : el('p', { class: 'center muted' }, 'Esperando quem criou a mesa começar…'))));
    }

    let queueInfo = null;
    const searchStart = Date.now();
    function searchScreen() {
      const req = s.searchRequest || {};
      const secs = Math.floor((Date.now() - searchStart) / 1000);
      const g = gameById(req.game) || playable[0];
      const size = req.size || 4;
      const others = queueInfo ? Math.max(0, queueInfo.waiting - 1) : 0;
      app.replaceChildren(el('div', { class: 'room' },
        el('header', { class: 'game-bar' },
          el('button', { class: 'icon-btn', onclick: exit, 'aria-label': 'Cancelar' }, '←'),
          el('div', { class: 'game-title' }, 'Partida rápida')),
        el('div', { class: 'room-body center' },
          el('div', { class: 'spinner' }),
          el('h2', { class: 'search-title' }, 'Procurando jogadores…'),
          el('p', { class: 'muted' }, `${g.name} · ${modeName(size)} · ${secs}s`),
          el('p', {}, others ? `${others} ${others === 1 ? 'pessoa encontrada' : 'pessoas encontradas'}, esperando mais…` : 'Ninguém na fila ainda.'),
          secs >= 8 ? el('p', { class: 'muted' }, 'Se demorar, comece agora: os lugares vazios viram bots, e quem chegar depois pode entrar.') : null,
          secs >= 8 ? el('button', { class: 'btn btn-primary wide', onclick: () => s.quickBots() }, 'Começar agora com bots') : null,
          el('button', { class: 'btn btn-ghost wide', onclick: exit }, 'Cancelar'))));
    }

    function startOnlineGame(room) {
      mounted = true;
      clearInterval(slowTimer);
      const g = gameById(room.game);
      g.ui().mount(app, { exit, onExit: (f) => exitHandlers.push(f), table: s.controller });
    }

    s.on('room', render);
    s.on('state', render);
    s.on('status', render);
    s.on('queue', (q) => { queueInfo = q; render(); });
    s.on('error', (msg) => {
      toast(msg);
      if (!s.room && /não encontrada|cheia/.test(msg)) { s.leave(); session = null; lobby(); }
    });
    render();
  }

  lobby();
  if (!profileName()) askName(lobby);

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})(this);
