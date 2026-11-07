/*
 * Conexão com o servidor do multiplayer (server/server.js).
 *
 * Net.session(name) abre a conexão, cria ou entra numa mesa e devolve um
 * "controle" com a mesma interface da mesa offline (Tables.local), então as
 * telas dos jogos funcionam igual nos dois modos.
 *
 * Se a internet cair, reconecta sozinho e volta para o mesmo lugar.
 */
(function (root) {
  'use strict';
  const { store } = root.U;

  /** Endereço do servidor: configurado no app, no config.js, ou o próprio site. */
  function serverUrl() {
    const saved = store.get('servidor', '');
    if (saved) return saved;
    // No navegador, o próprio site é o servidor. O app instalado usa o config.js.
    const isApp = !!root.Capacitor || location.protocol === 'capacitor:' || location.protocol === 'file:';
    const isServerSite = /^https?:$/.test(location.protocol) && !/(^|\.)claude\.ai$|claudeusercontent/.test(location.hostname);
    if (!isApp && isServerSite) return location.origin;
    return root.MESA_SERVER || '';
  }

  function wsUrl(base) {
    return base.replace(/\/+$/, '').replace(/^http/, 'ws') + '/ws';
  }

  function session(name) {
    const base = serverUrl();
    const listeners = { room: [], state: [], chat: [], emoji: [], error: [], status: [], queue: [] };
    const emit = (k, ...a) => listeners[k].forEach((f) => f(...a));
    let ws = null;
    let closed = false;
    let retry = 0;
    let room = null;
    let state = null;
    let pending = null; // ação a enviar quando conectar (create/join)
    let saved = store.get('mesaOnline', null); // { code, token } para voltar à mesa
    let status = 'connecting';
    let searching = null; // pedido de partida rápida em andamento

    function setStatus(s) { status = s; emit('status', s); }

    function send(msg) {
      if (ws && ws.readyState === 1) { ws.send(JSON.stringify(msg)); return true; }
      return false;
    }

    function open() {
      if (closed) return;
      setStatus('connecting');
      try { ws = new WebSocket(wsUrl(base)); } catch (e) { scheduleRetry(); return; }
      ws.onopen = () => {
        retry = 0;
        setStatus('online');
        if (pending) { send(pending); pending = null; }
        else if (saved) send({ t: 'join', code: saved.code, token: saved.token, name });
        else if (searching && !room) send(searching); // caiu enquanto procurava: volta para a fila
      };
      ws.onmessage = (ev) => {
        let m;
        try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.t === 'joined') {
          searching = null;
          saved = { code: m.code, token: m.token };
          store.set('mesaOnline', saved);
        } else if (m.t === 'room') { room = m.room; emit('room', room); }
        else if (m.t === 'state') { state = m.state; emit('state', state); }
        else if (m.t === 'chat' || m.t === 'emoji') {
          const you = room ? room.you : 0;
          emit(m.t, (m.seat - you + 4) % 4, m.text);
        } else if (m.t === 'queue') emit('queue', m);
        else if (m.t === 'error') emit('error', m.msg);
      };
      ws.onclose = () => { if (!closed) { setStatus('offline'); scheduleRetry(); } };
      ws.onerror = () => {};
    }

    function scheduleRetry() {
      if (closed) return;
      retry = Math.min(retry + 1, 6);
      setTimeout(open, 600 * retry);
    }

    function request(msg) {
      msg.name = name;
      if (!send(msg)) pending = msg;
    }

    const controller = {
      online: true,
      state: () => state,
      act(a) { send({ t: 'act', action: a }); return true; },
      next() { send({ t: 'next' }); },
      onChange(f) { listeners.state.push(f); },
      onChat(f) { listeners.chat.push(f); },
      onEmoji(f) { listeners.emoji.push(f); },
      start() {},
      sendChat(text) { send({ t: 'chat', text }); },
      sendEmoji(e) { send({ t: 'emoji', text: e }); },
      leave() { s.leave(); },
      destroy() {},
    };

    const s = {
      base,
      get room() { return room; },
      get state() { return state; },
      get status() { return status; },
      on(k, f) { listeners[k].push(f); },
      off(k, f) { listeners[k] = listeners[k].filter((x) => x !== f); },
      create(game, size) { saved = null; request({ t: 'create', game, size }); },
      quick(game, size) {
        saved = null;
        searching = { t: 'quick', game, size, name };
        request({ t: 'quick', game, size });
      },
      quickBots() { send({ t: 'quickBots' }); },
      get searching() { return !!searching && !room; },
      get searchRequest() { return searching; },
      join(code, keepToken) {
        const token = keepToken && saved && saved.code === code ? saved.token : undefined;
        request({ t: 'join', code: code.toUpperCase().trim(), token });
      },
      resume() { if (saved) request({ t: 'join', code: saved.code, token: saved.token }); },
      start() { send({ t: 'start' }); },
      controller,
      leave() {
        if (searching) send({ t: 'quickCancel' });
        searching = null;
        send({ t: 'leave' });
        store.set('mesaOnline', null);
        saved = null;
        s.close();
      },
      close() {
        closed = true;
        if (ws) { ws.onclose = null; ws.close(); }
        Object.keys(listeners).forEach((k) => { listeners[k] = []; });
      },
    };
    open();
    return s;
  }

  root.Net = { serverUrl, session, savedRoom: () => store.get('mesaOnline', null) };
})(this);
