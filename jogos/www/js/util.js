/* Utilidades de interface compartilhadas por todos os jogos. */
(function (root) {
  'use strict';

  function el(tag, props, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v === false || v == null) continue;
      if (k === 'class') e.className = v;
      else if (k === 'style') e.style.cssText = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat(Infinity)) {
      if (k == null || k === false) continue;
      e.append(k.nodeType ? k : document.createTextNode(String(k)));
    }
    return e;
  }

  const store = {
    get(key, def) {
      try {
        const v = localStorage.getItem('mesa:' + key);
        return v == null ? def : JSON.parse(v);
      } catch (e) { return def; }
    },
    set(key, val) {
      try { localStorage.setItem('mesa:' + key, JSON.stringify(val)); } catch (e) { /* sem armazenamento */ }
    },
  };

  let toastTimer = null;
  function toast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  /* Camada dos sobrepostos (modais, chat, balões), dentro da moldura do app. */
  function layer() { return document.getElementById('overlay') || document.body; }

  function modal(title, body, actions) {
    const back = el('div', { class: 'modal-back' });
    const close = () => back.remove();
    const box = el('div', { class: 'modal' },
      el('h2', {}, title),
      el('div', { class: 'modal-body' }, body),
      el('div', { class: 'modal-actions' },
        actions.map((a) => el('button', {
          class: 'btn ' + (a.primary ? 'btn-primary' : 'btn-ghost'),
          onclick: () => { if (a.onclick() !== false) close(); },
        }, a.label))));
    back.append(box);
    layer().append(back);
    return close;
  }

  /* Pedra de dominó. vertical=true desenha em pé (mão do jogador). */
  const PIPS = { 0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  function half(n) {
    const h = el('div', { class: 'half' });
    for (let i = 0; i < 9; i++) h.append(el('span', { class: PIPS[n].includes(i) ? 'pip on' : 'pip' }));
    return h;
  }
  function tile(a, b, opts = {}) {
    return el('div', {
      class: 'tile' + (opts.vertical ? ' v' : '') + (opts.cls ? ' ' + opts.cls : ''),
      onclick: opts.onclick,
      'data-id': opts.id,
    }, half(a), el('i', { class: 'bar' }), half(b));
  }

  /* Carta de baralho. */
  function playingCard(c, opts = {}) {
    const C = root.Cacheta;
    const red = C.RED[c.s];
    const lab = C.rankLabel(c.r);
    const suit = C.SUITS[c.s];
    return el('div', {
      class: 'card' + (red ? ' red' : '') + (opts.cls ? ' ' + opts.cls : ''),
      onclick: opts.onclick,
      'data-id': c.id,
    },
    el('span', { class: 'corner' }, lab, el('br'), suit),
    el('span', { class: 'center' }, suit),
    el('span', { class: 'corner br' }, lab, el('br'), suit));
  }

  function cardBack(cls) { return el('div', { class: 'card back' + (cls ? ' ' + cls : '') }); }

  /* Carteira de fichas. */
  const wallet = {
    get() { return store.get('fichas', 1000); },
    add(n) {
      const v = Math.max(0, wallet.get() + n);
      store.set('fichas', v);
      document.querySelectorAll('[data-fichas]').forEach((e) => { e.textContent = v.toLocaleString('pt-BR'); });
      return v;
    },
  };

  root.U = { el, store, toast, modal, layer, tile, playingCard, cardBack, wallet };
})(this);
