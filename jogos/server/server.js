/*
 * Servidor do multiplayer da Mesa de Jogos.
 *
 * - Serve o app (pasta www/) por HTTP: no iPhone basta abrir o endereço no Safari.
 * - WebSocket em /ws: salas com código de 4 letras, mesas de 4 ou mano a mano (2).
 *   Lugares vazios viram bots.
 * - Partida rápida: fila por jogo/tamanho que junta desconhecidos numa mesa. Quem cai da conexão volta para o mesmo lugar
 *   (enquanto isso, um bot joga por ele).
 * - As regras rodam aqui (mesmos arquivos do app), então ninguém trapaceia.
 *
 * Rodar: node server/server.js   (porta: variável PORT, padrão 8080)
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const Tables = require('../www/js/tables.js');

const WWW = path.join(__dirname, '..', 'www');
const BOT_NAMES = ['Carlos', 'Bia', 'Rosa', 'Zé', 'Lu'];
const BOT_DELAY = Number(process.env.BOT_DELAY || 800);
const EMPTY_ROOM_TTL = 10 * 60 * 1000;
// Partida rápida de 4: se já tem 2+ pessoas esperando há esse tempo, completa com bots.
const QUICK_FILL_MS = Number(process.env.QUICK_FILL_MS || 20000);
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png',
};

function serveStatic(req, res) {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/health') { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('ok'); return; }
  const file = path.normalize(path.join(WWW, url === '/' ? 'index.html' : url));
  if (!file.startsWith(WWW)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('não encontrado'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(data);
  });
}

function createServer() {
  const server = http.createServer(serveStatic);
  const wss = new WebSocketServer({ server, path: '/ws' });
  const rooms = new Map();
  const queues = new Map(); // 'jogo:tamanho' -> [{ ws, name, since }]

  function sizeFor(game, size) {
    const g = Tables.games[game];
    if (!g) return null;
    const n = Number(size) || 4;
    return g.sizes.includes(n) ? n : null;
  }

  function newCode() {
    for (;;) {
      let c = '';
      for (let i = 0; i < 4; i++) c += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
      if (!rooms.has(c)) return c;
    }
  }

  const send = (ws, msg) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); };
  const humans = (room) => room.seats.filter((s) => s && s.human);

  function roomInfo(room, seat) {
    return {
      t: 'room',
      room: {
        code: room.code,
        game: room.game,
        size: room.seats.length,
        quick: !!room.quick,
        started: !!room.state,
        you: seat,
        host: room.seats[seat] && room.seats[seat].token === room.hostToken,
        seats: room.seats.map((s, i) => (s ? { name: s.name, human: s.human, online: !!s.ws, seat: i } : null)),
      },
    };
  }

  function broadcast(room) {
    room.seats.forEach((s, i) => {
      if (!s || !s.ws) return;
      send(s.ws, roomInfo(room, i));
      if (room.state) send(s.ws, { t: 'state', state: Tables.view(room.game, room.state, i) });
    });
  }

  /** Bot joga pelos lugares de bot e por quem está desconectado. */
  function driveBots(room) {
    clearTimeout(room.botTimer);
    if (!room.state) return;
    const g = Tables.games[room.game];
    const cur = g.current(room.state);
    if (cur == null) return;
    const s = room.seats[cur];
    if (s && s.human && s.ws) return;
    // Ninguém conectado na mesa: os bots esperam alguém voltar.
    if (!room.seats.some((x) => x && x.human && x.ws)) return;
    room.botTimer = setTimeout(() => {
      if (!rooms.has(room.code) || !room.state) return;
      if (g.current(room.state) !== cur) return;
      g.bot(room.state);
      broadcast(room);
      driveBots(room);
    }, BOT_DELAY);
    room.botTimer.unref();
  }

  function startGame(room) {
    let b = 0;
    room.seats = room.seats.map((s) => s || { name: BOT_NAMES[b++ % BOT_NAMES.length], human: false });
    room.state = Tables.games[room.game].create(room.seats.map((s) => s.name));
    room.state.players.forEach((p, i) => { p.bot = !room.seats[i].human; });
    broadcast(room);
    driveBots(room);
  }

  function newRoom(game, size, people, quick) {
    const r = { code: newCode(), game, seats: Array(size).fill(null), state: null, quick: !!quick };
    people.forEach((p, i) => { r.seats[i] = { name: p.name, human: true, token: crypto.randomUUID(), ws: null }; });
    r.hostToken = r.seats[0].token;
    rooms.set(r.code, r);
    return r;
  }

  /* ---------- partida rápida ---------- */
  function queueStatus(key) {
    const q = queues.get(key) || [];
    const size = Number(key.split(':')[1]);
    q.forEach((e) => send(e.ws, { t: 'queue', waiting: q.length, size }));
  }

  function unqueue(ws) {
    const key = ws.queue;
    if (!key) return;
    ws.queue = null;
    const q = queues.get(key);
    if (!q) return;
    const i = q.findIndex((e) => e.ws === ws);
    if (i >= 0) q.splice(i, 1);
    queueStatus(key);
  }

  function startQuick(game, size, group) {
    const r = newRoom(game, size, group, true);
    group.forEach((e, i) => {
      e.ws.room = r.code;
      r.seats[i].ws = e.ws;
      send(e.ws, { t: 'joined', code: r.code, token: r.seats[i].token });
    });
    startGame(r);
  }

  function match(key) {
    const q = queues.get(key);
    if (!q) return;
    const [game, sizeStr] = key.split(':');
    const size = Number(sizeStr);
    while (q.length >= size) {
      const group = q.splice(0, size);
      group.forEach((e) => { e.ws.queue = null; });
      startQuick(game, size, group);
    }
    if (size > 2 && q.length >= 2 && Date.now() - q[0].since >= QUICK_FILL_MS) {
      const group = q.splice(0, size);
      group.forEach((e) => { e.ws.queue = null; });
      startQuick(game, size, group);
    }
    queueStatus(key);
  }

  const matcher = setInterval(() => queues.forEach((q, key) => { if (q.length) match(key); }), 2000);
  matcher.unref();

  function seatOf(room, ws) { return room.seats.findIndex((s) => s && s.ws === ws); }

  function leave(ws, permanent) {
    const room = ws.room && rooms.get(ws.room);
    if (!room) return;
    const i = seatOf(room, ws);
    ws.room = null;
    if (i < 0) return;
    const s = room.seats[i];
    s.ws = null;
    if (permanent) {
      // Saiu de vez: antes de começar libera o lugar; depois um bot assume.
      if (!room.state) room.seats[i] = null;
      else { s.human = false; s.token = null; room.state.players[i].bot = true; }
    }
    // Se o anfitrião saiu, passa para outra pessoa.
    if (!room.seats.some((x) => x && x.token && x.token === room.hostToken)) {
      const next = humans(room)[0];
      room.hostToken = next ? next.token : null;
    }
    if (!humans(room).some((x) => x.ws)) {
      clearTimeout(room.ttl);
      room.ttl = setTimeout(() => { clearTimeout(room.botTimer); rooms.delete(room.code); }, EMPTY_ROOM_TTL);
      room.ttl.unref();
    }
    broadcast(room);
    driveBots(room);
  }

  function attach(ws, room, seat) {
    clearTimeout(room.ttl);
    ws.room = room.code;
    room.seats[seat].ws = ws;
    send(ws, { t: 'joined', code: room.code, token: room.seats[seat].token });
    broadcast(room);
    driveBots(room);
  }

  function handle(ws, msg) {
    const name = String(msg.name || 'Jogador').trim().slice(0, 16) || 'Jogador';
    const room = ws.room && rooms.get(ws.room);
    switch (msg.t) {
      case 'create': {
        const size = sizeFor(msg.game, msg.size);
        if (!size) return send(ws, { t: 'error', msg: 'Jogo desconhecido.' });
        if (room) leave(ws, true);
        unqueue(ws);
        const r = newRoom(msg.game, size, [{ ws, name }]);
        return attach(ws, r, 0);
      }
      case 'quick': {
        const size = sizeFor(msg.game, msg.size);
        if (!size) return send(ws, { t: 'error', msg: 'Jogo desconhecido.' });
        if (room) leave(ws, true);
        unqueue(ws);
        const key = `${msg.game}:${size}`;
        if (!queues.has(key)) queues.set(key, []);
        queues.get(key).push({ ws, name, since: Date.now() });
        ws.queue = key;
        return match(key);
      }
      case 'quickCancel':
        return unqueue(ws);
      case 'quickBots': {
        // Cansou de esperar: começa agora com quem estiver na fila + bots.
        const key = ws.queue;
        const q = key && queues.get(key);
        if (!q) return;
        const [game, size] = key.split(':');
        const group = q.splice(0, Number(size));
        if (!group.some((e) => e.ws === ws)) { q.unshift(...group); return; }
        group.forEach((e) => { e.ws.queue = null; });
        startQuick(game, Number(size), group);
        return queueStatus(key);
      }
      case 'join': {
        const r = rooms.get(String(msg.code || '').toUpperCase().trim());
        if (!r) return send(ws, { t: 'error', msg: 'Mesa não encontrada. Confira o código.' });
        // Voltando para o próprio lugar?
        let seat = msg.token ? r.seats.findIndex((s) => s && s.token === msg.token) : -1;
        if (seat < 0) {
          seat = r.seats.findIndex((s) => !s || (!s.human && r.state));
          if (seat < 0) return send(ws, { t: 'error', msg: 'Essa mesa está cheia.' });
          const token = crypto.randomUUID();
          if (r.seats[seat] && r.state) {
            // Entra no lugar de um bot no meio do jogo.
            r.state.players[seat].name = name;
            r.state.players[seat].bot = false;
          }
          r.seats[seat] = { name, human: true, token, ws: null };
          if (!r.hostToken) r.hostToken = token;
        } else {
          const old = r.seats[seat].ws;
          if (old && old !== ws) { old.room = null; send(old, { t: 'error', msg: 'Você entrou em outro aparelho.' }); }
          if (r.state) r.state.players[seat].bot = false;
        }
        if (room && room !== r) leave(ws, true);
        return attach(ws, r, seat);
      }
      case 'start': {
        if (!room || room.state) return;
        const s = room.seats[seatOf(room, ws)];
        if (!s || s.token !== room.hostToken) return send(ws, { t: 'error', msg: 'Só quem criou a mesa pode começar.' });
        return startGame(room);
      }
      case 'act': {
        if (!room || !room.state) return;
        const seat = seatOf(room, ws);
        const g = Tables.games[room.game];
        if (seat < 0 || g.current(room.state) !== seat) return;
        if (!g.act(room.state, seat, msg.action || {})) return send(ws, { t: 'error', msg: 'Jogada inválida.' });
        broadcast(room);
        return driveBots(room);
      }
      case 'next': {
        if (!room || !room.state) return;
        if (Tables.games[room.game].next(room.state)) { broadcast(room); driveBots(room); }
        return;
      }
      case 'chat':
      case 'emoji': {
        if (!room) return;
        const seat = seatOf(room, ws);
        const text = String(msg.text || '').slice(0, 140).trim();
        if (seat < 0 || !text) return;
        room.seats.forEach((s) => { if (s && s.ws && s.ws !== ws) send(s.ws, { t: msg.t, seat, text }); });
        return;
      }
      case 'leave':
        return leave(ws, true);
      case 'ping':
        return send(ws, { t: 'pong' });
      default:
    }
  }

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('message', (data) => {
      let msg;
      try { msg = JSON.parse(data); } catch (e) { return; }
      try { handle(ws, msg); } catch (e) { console.error(e); send(ws, { t: 'error', msg: 'Erro no servidor.' }); }
    });
    ws.on('close', () => { unqueue(ws); leave(ws, false); });
  });

  // Derruba conexões mortas (celular que perdeu sinal).
  const beat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) { ws.terminate(); return; }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);
  beat.unref();
  server.on('close', () => { clearInterval(beat); clearInterval(matcher); wss.clients.forEach((ws) => ws.terminate()); });

  /** Desliga tudo (usado nos testes): fecha as conexões e para os bots. */
  function shutdown() {
    rooms.forEach((r) => { clearTimeout(r.botTimer); clearTimeout(r.ttl); });
    wss.clients.forEach((ws) => ws.terminate());
    server.closeAllConnections();
    server.close();
  }

  return { server, rooms, shutdown };
}

if (require.main === module) {
  const port = Number(process.env.PORT || 8080);
  createServer().server.listen(port, () => console.log(`Mesa de Jogos no ar: http://localhost:${port}`));
}

module.exports = { createServer };
