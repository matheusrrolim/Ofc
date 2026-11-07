'use strict';
const test = require('node:test');
const assert = require('node:assert');
const WebSocket = require('ws');
const Domino = require('../www/js/domino-engine.js');
const Cacheta = require('../www/js/cacheta-engine.js');

process.env.BOT_DELAY = '5';
const { createServer } = require('../server/server.js');

function start() {
  const { server, rooms } = createServer();
  return new Promise((res) => server.listen(0, () => res({ server, rooms, url: `ws://localhost:${server.address().port}/ws` })));
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
  const { server, url } = await start();
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
    server.closeAllConnections();
    server.close();
  }
});

test('servidor: cacheta online esconde as cartas e bots completam a mesa', async () => {
  const { server, url } = await start();
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
    server.closeAllConnections();
    server.close();
  }
});

test('servidor: entrega o app e responde /health', async () => {
  const { server } = await start();
  try {
    const base = `http://localhost:${server.address().port}`;
    const h = await fetch(base + '/health');
    assert.strictEqual(await h.text(), 'ok');
    const page = await fetch(base + '/');
    assert.match(await page.text(), /Mesa de Jogos/);
    const bad = await fetch(base + '/../server/server.js');
    assert.notStrictEqual(bad.status, 200);
  } finally {
    server.closeAllConnections();
    server.close();
  }
});
