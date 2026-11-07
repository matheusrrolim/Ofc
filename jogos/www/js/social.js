/*
 * Chat da mesa + reações com emoji (balões em cima de cada jogador).
 *
 * Usado por todos os jogos. Hoje os outros lugares são bots, que respondem com
 * frases prontas. No multiplayer online, `send` passa a mandar pela rede e
 * `receive` é chamado quando chega mensagem de outro jogador.
 *
 * Lugares: 0 = você (embaixo), 1 = direita, 2 = em cima, 3 = esquerda.
 */
(function (root) {
  'use strict';
  const { el, layer } = root.U;

  const EMOJIS = ['👏', '😂', '😎', '🔥', '😱', '😡', '🤔', '😭', '🙏', '👍'];
  const QUICK = ['Boa jogada!', 'Vamos lá!', 'Que sorte, hein?', 'Tô pensando…', 'Kkkkk', 'Joga logo! 😅'];
  const SEAT_SEL = { 0: '.me', 1: '.seat-right', 2: '.seat-top', 3: '.seat-left' };

  const BOT_LINES = {
    reply: ['Kkkk', 'Verdade!', 'Foco no jogo 😄', 'Hoje eu tô com sorte', 'Calma que a mão vira', 'Haha boa'],
    partner: ['Tamo junto, parceiro!', 'Deixa comigo 💪', 'Confia!'],
    win: ['Bati! 😎', 'É isso aí!', 'Essa foi fácil', 'Toma!'],
    lose: ['Ah não…', 'Por pouco!', 'Na próxima eu pego', 'Que azar'],
    pass: ['Passo 😩', 'Tô sem…', 'Passo.'],
  };
  const BOT_EMOJI = { win: ['😎', '🔥', '👏'], lose: ['😭', '😱', '😡', '🙏'], pass: ['😩', '🤔'] };

  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  function create(opts) {
    const names = opts.names; // nome de cada lugar
    const partner = opts.partner; // índice do parceiro (ou null)
    const messages = [];
    let unread = 0;
    let panel = null;
    let emojiBar = null;
    let alive = true;
    const timers = [];

    const later = (ms, f) => timers.push(setTimeout(() => { if (alive) f(); }, ms));

    // Posição do lugar relativa à camada (que fica dentro da moldura do app).
    function anchor(seat) {
      const e = document.querySelector(SEAT_SEL[seat]);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      const o = (document.getElementById('phone') || document.body).getBoundingClientRect();
      return { left: r.left - o.left, top: r.top - o.top, width: r.width, height: r.height, max: o.width };
    }

    function bubble(seat, content, isEmoji) {
      const r = anchor(seat);
      if (!r) return;
      const b = el('div', { class: 'bubble' + (isEmoji ? ' emoji' : '') + (seat === 0 ? ' mine' : '') }, content);
      layer().append(b);
      const bw = b.offsetWidth;
      const x = Math.min(Math.max(8, r.left + r.width / 2 - bw / 2), r.max - bw - 8);
      const y = seat === 0 ? r.top - b.offsetHeight - 6 : r.top + r.height * 0.15;
      b.style.left = x + 'px';
      b.style.top = Math.max(8, y) + 'px';
      setTimeout(() => b.classList.add('out'), isEmoji ? 1800 : 2800);
      setTimeout(() => b.remove(), isEmoji ? 2200 : 3200);
    }

    function receive(seat, text) {
      messages.push({ seat, text, t: Date.now() });
      if (messages.length > 100) messages.shift();
      bubble(seat, text, false);
      if (panel) renderList();
      else if (seat !== 0) { unread++; refreshBadge(); }
    }

    function react(seat, emoji) { bubble(seat, emoji, true); }

    // --------- você ---------
    function send(text) {
      text = text.trim().slice(0, 140);
      if (!text) return;
      receive(0, text);
      botReplyTo(text);
    }

    function sendEmoji(emoji) {
      react(0, emoji);
      if (Math.random() < 0.5) later(900 + Math.random() * 900, () => react(randomBot(), pick(EMOJIS)));
    }

    // --------- bots ---------
    function randomBot() { return 1 + Math.floor(Math.random() * 3); }

    function botReplyTo(text) {
      const toPartner = partner != null && /parceir|bia|junto|confia/i.test(text);
      if (!toPartner && Math.random() > 0.6) return;
      const seat = toPartner ? partner : randomBot();
      later(1200 + Math.random() * 1500, () => receive(seat, pick(toPartner ? BOT_LINES.partner : BOT_LINES.reply)));
    }

    /** Eventos do jogo: 'win' (seat ganhou), 'pass' (seat passou). */
    function event(kind, seat) {
      if (kind === 'pass' && seat !== 0 && Math.random() < 0.3) {
        if (Math.random() < 0.5) react(seat, pick(BOT_EMOJI.pass));
        else receive(seat, pick(BOT_LINES.pass));
      }
      if (kind === 'win') {
        if (seat !== 0) later(300, () => (Math.random() < 0.5 ? receive(seat, pick(BOT_LINES.win)) : react(seat, pick(BOT_EMOJI.win))));
        for (let s = 1; s < names.length; s++) {
          if (s === seat || Math.random() > 0.45) continue;
          const sameTeam = partner != null && (s % 2) === (seat % 2);
          later(700 + Math.random() * 1200, () => {
            if (sameTeam) react(s, pick(BOT_EMOJI.win));
            else if (Math.random() < 0.5) react(s, pick(BOT_EMOJI.lose));
            else receive(s, pick(BOT_LINES.lose));
          });
        }
      }
    }

    // --------- interface ---------
    function refreshBadge() {
      document.querySelectorAll('[data-chat-badge]').forEach((b) => {
        b.textContent = unread;
        b.hidden = !unread;
      });
    }

    function chatButton() {
      return el('button', { class: 'icon-btn chat-btn', onclick: openChat, 'aria-label': 'Chat da mesa' },
        '💬', el('span', { class: 'badge-dot', 'data-chat-badge': true, hidden: !unread }, unread));
    }

    function emojiButton() {
      return el('button', { class: 'emoji-fab', onclick: toggleEmojiBar, 'aria-label': 'Reagir com emoji' }, '😀');
    }

    function toggleEmojiBar() {
      if (emojiBar) { emojiBar.remove(); emojiBar = null; return; }
      emojiBar = el('div', { class: 'emoji-bar' },
        EMOJIS.map((e) => el('button', { onclick: () => { sendEmoji(e); toggleEmojiBar(); } }, e)));
      layer().append(emojiBar);
    }

    let listEl = null;
    function renderList() {
      if (!listEl) return;
      listEl.replaceChildren(...(messages.length ? messages.map((m) => el('div', { class: 'msg' + (m.seat === 0 ? ' mine' : '') },
        m.seat === 0 ? null : el('b', {}, names[m.seat]),
        el('span', {}, m.text))) : [el('div', { class: 'msg-empty' }, 'Ninguém falou nada ainda. Diga oi para a mesa!')]));
      listEl.scrollTop = listEl.scrollHeight;
    }

    function openChat() {
      if (panel) return;
      if (emojiBar) toggleEmojiBar();
      unread = 0;
      refreshBadge();
      const input = el('input', { class: 'input', id: 'chat-input', maxlength: 140, placeholder: 'Mensagem para a mesa', autocomplete: 'off', enterkeyhint: 'send' });
      const submit = (e) => { e.preventDefault(); send(input.value); input.value = ''; };
      listEl = el('div', { class: 'chat-list' });
      panel = el('div', { class: 'chat-back', onclick: (e) => { if (e.target === panel) closeChat(); } },
        el('div', { class: 'chat-sheet' },
          el('div', { class: 'chat-head' },
            el('strong', {}, 'Chat da mesa'),
            el('button', { class: 'icon-btn', onclick: closeChat, 'aria-label': 'Fechar chat' }, '✕')),
          listEl,
          el('div', { class: 'chat-quick' }, QUICK.map((q) => el('button', { class: 'chip', onclick: () => send(q) }, q))),
          el('form', { class: 'chat-form', onsubmit: submit },
            input,
            el('button', { class: 'btn btn-primary', type: 'submit' }, 'Enviar'))));
      layer().append(panel);
      renderList();
    }

    function closeChat() {
      if (panel) panel.remove();
      panel = null;
      listEl = null;
    }

    function destroy() {
      alive = false;
      timers.forEach(clearTimeout);
      closeChat();
      if (emojiBar) emojiBar.remove();
      emojiBar = null;
      document.querySelectorAll('.bubble').forEach((b) => b.remove());
    }

    return { chatButton, emojiButton, send, receive, react, event, destroy };
  }

  root.Social = { create, EMOJIS };
})(this);
