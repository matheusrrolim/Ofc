'use strict';
const test = require('node:test');
const assert = require('node:assert');
const WebSocket = require('ws');
const Domino = require('../www/js/domino-engine.js');
const Cacheta = require('../www/js/cacheta-engine.js');

process.env.BOT_DELAY = '5';
process.env.QUICK_FILL_MS = '300';
const { createServer } = require('../server/server.js');

function start() {
  const { server, rooms, shutdown } = createServer();
  return new Promise((res) => server.listen(0, () => res({ server, rooms, shutdown, url: `ws://localhost:${server.address().port}/ws` })));
}

/** Cliente de teste: guarda a última sala/estado e espera mensagens. */
function client(url) {
  const ws = new WebSocket(url);
  const c = { ws, room: null, state: null, chats: [], errors: [], waiters: [] };
  ws.on('message', (d) => {
    const m = JSON.parse(d);
    if (m.t === 'room') c.room = m.room;
    if (m.t === 'state') c.state = m.state;
    if (m.t === 'joined') c.token = m.token;
    if (m.t === 'chat') c.chats.push(m);
    if (m.t === 'error') c.errors.push(m.msg);
    if (m.t === 'queue') c.queueSeen = m;
    c.waiters = c.waiters.filter((w) => !w(m));
  });
  c.send = (m) => ws.send(JSON.stringify(m));
  c.until = (pred, ms = 3000) => new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('tempo esgotado')), ms);
    const check = () => { if (pred(c)) { clearTimeout(t); res(); return true; } return false; };
    if (!check()) c.waiters.push(() => check());
  });
  c.open = new Promise((res) => ws.on('open', res));
  return c;
}

test('servidor: duas pessoas jogam dominó online com chat e reconexão', async () => {
  const { server, url, shutdown } = await start();
  try {
    const a = client(url);
    const b = client(url);
    await Promise.all([a.open, b.open]);

    a.send({ t: 'create', game: 'domino', name: 'Matheus' });
    await a.until((c) => c.room && c.room.code);
    const code = a.room.code;
    assert.match(code, /^[A-Z]{4}$/);
    assert.ok(a.room.host);

    b.send({ t: 'join', code: code.toLowerCase(), name: 'Irmão' });
    await b.until((c) => c.room && c.room.you === 1);
    await a.until((c) => c.room.seats[1] && c.room.seats[1].name === 'Irmão');
    assert.ok(!b.room.host);

    // Só o anfitrião começa.
    b.send({ t: 'start' });
    await b.until((c) => c.errors.length === 1);
    a.send({ t: 'start' });
    await a.until((c) => c.state);
    await b.until((c) => c.state);

    // Cada um se vê no lugar 0 e não vê as pedras dos outros.
    assert.strictEqual(a.state.players[0].name, 'Matheus');
    assert.strictEqual(b.state.players[0].name, 'Irmão');
    assert.strictEqual(b.state.players[3].name, 'Matheus');
    assert.ok(a.state.players[1].hand.every((t) => t.a === undefined));
    assert.strictEqual(a.state.players[0].hand.length + b.state.players[0].hand.length, 14);

    // Chat chega para o outro com o lugar de quem mandou.
    a.send({ t: 'chat', text: 'Bora!' });
    await b.until((c) => c.chats.length === 1);
    assert.deepStrictEqual([b.chats[0].seat, b.chats[0].text], [0, 'Bora!']);

    // Os dois jogam uma mão inteira (os bots jogam sozinhos no servidor).
    const play = (c) => {
      const s = c.state;
      if (!s || s.hand.over || s.hand.current !== 0) return;
      const mv = Domino.movesFor(s, 0)[0];
      c.send({ t: 'act', action: mv ? { type: 'play', id: mv.tile.id, side: mv.side } : { type: 'pass' } });
    };
    a.waiters.push(() => { play(a); return false; });
    b.waiters.push(() => { play(b); return false; });
    play(a); play(b);
    await a.until((c) => c.state.hand.over, 10000);
    assert.ok(a.errors.length === 0, a.errors.join());

    // Placar igual para os dois (duplas trocadas porque B está em lugar ímpar).
    await b.until((c) => c.state.hand.over);
    assert.deepStrictEqual(a.state.scores, b.state.scores.slice().reverse());

    // B cai e volta para o mesmo lugar com o token.
    const token = b.token;
    b.ws.close();
    await a.until((c) => c.room.seats[1] && !c.room.seats[1].online);
    const b2 = client(url);
    await b2.open;
    b2.send({ t: 'join', code, token, name: 'Irmão' });
    await b2.until((c) => c.room && c.room.you === 1 && c.state);
    await a.until((c) => c.room.seats[1].online);

    a.ws.close();
    b2.ws.close();
  } finally {
    shutdown();
  }
});

test('servidor: cacheta online esconde as cartas e bots completam a mesa', async () => {
  const { server, url, shutdown } = await start();
  try {
    const a = client(url);
    await a.open;
    a.send({ t: 'create', game: 'cacheta', name: 'Ana' });
    await a.until((c) => c.room);
    a.send({ t: 'start' });
    await a.until((c) => c.state);
    assert.strictEqual(a.state.players.length, 4);
    assert.ok(a.state.players.slice(1).every((p) => p.bot));
    assert.ok(a.state.players[1].hand.every((x) => x.r === undefined));

    let moves = 0;
    const play = () => {
      const s = a.state;
      if (s.hand.over || s.hand.current !== 0) return;
      moves++;
      if (s.hand.phase === 'draw') a.send({ t: 'act', action: { type: 'draw', from: 'stock' } });
      else {
        const card = s.players[0].hand.find((x) => x.id !== s.hand.takenId);
        const win = Cacheta.winningDiscard(s.players[0].hand, s.hand.takenId);
        a.send({ t: 'act', action: { type: 'discard', id: (win || card).id } });
      }
    };
    a.waiters.push(() => { play(); return false; });
    play();
    await a.until((c) => c.state.hand.over, 20000);
    assert.ok(moves > 0);
    a.send({ t: 'next' });
    await a.until((c) => !c.state.hand.over && c.state.handNo === 2);
    a.ws.close();
  } finally {
    shutdown();
  }
});

test('servidor: entrega o app e responde /health', async () => {
  const { server, shutdown } = await start();
  try {
    const base = `http://localhost:${server.address().port}`;
    const h = await fetch(base + '/health');
    assert.strictEqual(await h.text(), 'ok');
    const page = await fetch(base + '/');
    assert.match(await page.text(), /Mesa de Jogos/);
    const bad = await fetch(base + '/../server/server.js');
    assert.notStrictEqual(bad.status, 200);
  } finally {
    shutdown();
  }
});

test('servidor: mano a mano com amigo (mesa de 2)', async () => {
  const { server, url, shutdown } = await start();
  try {
    const a = client(url); const b = client(url);
    await Promise.all([a.open, b.open]);
    a.send({ t: 'create', game: 'domino', size: 2, name: 'Ana' });
    await a.until((c) => c.room);
    assert.strictEqual(a.room.size, 2);
    b.send({ t: 'join', code: a.room.code, name: 'Beto' });
    await b.until((c) => c.room && c.room.you === 1);
    a.send({ t: 'start' });
    await b.until((c) => c.state);
    assert.strictEqual(b.state.players.length, 2);
    assert.ok(b.state.players.every((p) => !p.bot));
    assert.strictEqual(b.state.hand.boneyard.length, 14);
    // Uma terceira pessoa não cabe.
    const c3 = client(url); await c3.open;
    c3.send({ t: 'join', code: a.room.code, name: 'Caio' });
    await c3.until((c) => c.errors.length);
    assert.match(c3.errors[0], /cheia/);
    // Jogam até o fim da mão, comprando do monte quando precisa.
    const play = (c) => {
      const s = c.state;
      if (!s || s.hand.over || s.hand.current !== 0) return;
      const mv = Domino.movesFor(s, 0)[0];
      if (mv) c.send({ t: 'act', action: { type: 'play', id: mv.tile.id, side: mv.side } });
      else c.send({ t: 'act', action: { type: s.hand.boneyard.length ? 'buy' : 'pass' } });
    };
    a.waiters.push((m) => { if (m.t === 'state') play(a); return false; });
    b.waiters.push((m) => { if (m.t === 'state') play(b); return false; });
    play(a); play(b);
    await a.until((c) => c.state.hand.over, 10000);
    assert.deepStrictEqual(a.errors, []);
    [a, b, c3].forEach((x) => x.ws.close());
  } finally { shutdown(); }
});

test('servidor: partida rápida junta dois desconhecidos no mano a mano', async () => {
  const { server, url, shutdown } = await start();
  try {
    const a = client(url); const b = client(url);
    await Promise.all([a.open, b.open]);
    a.send({ t: 'quick', game: 'cacheta', size: 2, name: 'Ana' });
    await a.until((c) => c.queueSeen, 500).catch(() => {});
    b.send({ t: 'quick', game: 'cacheta', size: 2, name: 'Beto' });
    await a.until((c) => c.state);
    await b.until((c) => c.state);
    assert.ok(a.room.quick && a.room.started);
    assert.strictEqual(a.state.players[1].name, 'Beto');
    assert.strictEqual(b.state.players[1].name, 'Ana');
    [a, b].forEach((x) => x.ws.close());
  } finally { shutdown(); }
});

test('servidor: partida rápida de 4 completa com bots e "começar com bots"', async () => {
  const { server, url, shutdown } = await start();
  try {
    // Duas pessoas esperando: depois de um tempo a mesa de 4 começa com 2 bots.
    const a = client(url); const b = client(url);
    await Promise.all([a.open, b.open]);
    a.send({ t: 'quick', game: 'domino', size: 4, name: 'Ana' });
    b.send({ t: 'quick', game: 'domino', size: 4, name: 'Beto' });
    await a.until((c) => c.state, 5000);
    assert.strictEqual(a.state.players.filter((p) => p.bot).length, 2);

    // Sozinho na fila: pede para começar com bots.
    const c = client(url); await c.open;
    c.send({ t: 'quick', game: 'domino', size: 2, name: 'Caio' });
    await new Promise((r) => setTimeout(r, 100));
    assert.ok(!c.state);
    c.send({ t: 'quickBots' });
    await c.until((x) => x.state);
    assert.ok(c.state.players[1].bot);

    // Cancelar sai da fila.
    const d = client(url); await d.open;
    d.send({ t: 'quick', game: 'cacheta', size: 2, name: 'Duda' });
    d.send({ t: 'quickCancel' });
    const e = client(url); await e.open;
    e.send({ t: 'quick', game: 'cacheta', size: 2, name: 'Edu' });
    await new Promise((r) => setTimeout(r, 300));
    assert.ok(!e.state && !d.state);
    [a, b, c, d, e].forEach((x) => x.ws.close());
  } finally { shutdown(); }
});
