// OFC Manager — mobile-first prototype frontend.
// Plain JS, no build step. Talks to /api/v1/*.

const api = {
  base: '/api/v1',
  token: localStorage.getItem('ofc_token') || '',
  async req(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (this.token) headers.Authorization = 'Bearer ' + this.token;
    const res = await fetch(this.base + path, { ...opts, headers });
    let body = null;
    try { body = await res.json(); } catch (_) { /* no body */ }
    if (!res.ok) throw new Error((body && body.error) || ('HTTP ' + res.status));
    return body;
  },
  get(p) { return this.req(p); },
  post(p, body) { return this.req(p, { method: 'POST', body: body ? JSON.stringify(body) : undefined }); },
  patch(p, body) { return this.req(p, { method: 'PATCH', body: JSON.stringify(body) }); },
  put(p, body) { return this.req(p, { method: 'PUT', body: JSON.stringify(body) }); },
  del(p) { return this.req(p, { method: 'DELETE' }); },
  setToken(t) { this.token = t; if (t) localStorage.setItem('ofc_token', t); else localStorage.removeItem('ofc_token'); }
};

const state = { user: null, club: null, view: 'home' };

// ---- helpers ----
function el(tag, props = {}, ...children) {
  const e = document.createElement(tag);
  for (const k in props) {
    if (k === 'class') e.className = props[k];
    else if (k === 'html') e.innerHTML = props[k];
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), props[k]);
    else if (k === 'dataset') Object.assign(e.dataset, props[k]);
    else e.setAttribute(k, props[k]);
  }
  for (const c of children) {
    if (c == null) continue;
    e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return e;
}
function fmt(n) { return (n || 0).toLocaleString(); }
function toast(msg, ok = true) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = ok ? '' : '#5a1a1f';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

// ---- screens ----
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ---- auth ----
function setupAuth() {
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === t));
    const which = t.dataset.tab;
    document.getElementById('login-form').classList.toggle('hidden', which !== 'login');
    document.getElementById('register-form').classList.toggle('hidden', which !== 'register');
    document.getElementById('auth-error').textContent = '';
  }));
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const r = await api.post('/auth/login', { email: fd.get('email'), password: fd.get('password') });
      api.setToken(r.token);
      state.user = r.user; state.club = r.club;
      enterApp();
    } catch (err) { document.getElementById('auth-error').textContent = err.message; }
  });
  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const r = await api.post('/auth/register', {
        username: fd.get('username'), email: fd.get('email'),
        password: fd.get('password'), clubName: fd.get('clubName')
      });
      api.setToken(r.token);
      state.user = r.user; state.club = r.club;
      enterApp();
    } catch (err) { document.getElementById('auth-error').textContent = err.message; }
  });
}

async function tryAutoLogin() {
  if (!api.token) return false;
  try {
    const r = await api.get('/me');
    state.user = r.user; state.club = r.club;
    return true;
  } catch (_) { api.setToken(''); return false; }
}

// ---- navigation ----
function setupNav() {
  document.querySelectorAll('.nav').forEach(n => n.addEventListener('click', () => {
    document.querySelectorAll('.nav').forEach(x => x.classList.toggle('active', x === n));
    state.view = n.dataset.view;
    render();
  }));
}

function enterApp() {
  showScreen('screen-app');
  refreshHeader();
  render();
}

function refreshHeader() {
  document.getElementById('header-club').textContent = state.club ? state.club.name : '';
  document.getElementById('header-user').textContent = state.user ? '@' + state.user.username + ' · ' + state.user.division : '';
  document.getElementById('bal-soft').textContent = fmt(state.user && state.user.softCurrency);
  document.getElementById('bal-premium').textContent = fmt(state.user && state.user.premiumCurrency);
}

async function refreshMe() {
  const r = await api.get('/me');
  state.user = r.user; state.club = r.club;
  refreshHeader();
}

// ---- views ----
async function render() {
  const root = document.getElementById('content');
  root.innerHTML = '';
  try {
    if (state.view === 'home') await renderHome(root);
    else if (state.view === 'squad') await renderSquad(root);
    else if (state.view === 'match') await renderMatch(root);
    else if (state.view === 'market') await renderMarket(root);
    else if (state.view === 'packs') await renderPacks(root);
  } catch (err) { root.appendChild(el('p', { class: 'error' }, err.message)); }
}

async function renderHome(root) {
  await refreshMe();
  const standings = await api.get('/league').catch(() => []);
  const missions = await api.get('/missions').catch(() => []);
  const matches = await api.get('/clubs/' + state.club.id + '/matches?limit=5').catch(() => []);

  root.appendChild(el('div', { class: 'kpi-grid' },
    kpi('Division', state.user.division),
    kpi('Points', state.club.points),
    kpi('W-D-L', `${state.club.wins}-${state.club.draws}-${state.club.losses}`),
    kpi('Chemistry', (state.club.chemistryScore || 0) + '%'),
  ));

  root.appendChild(sectionTitle('Missions'));
  const ml = el('div', { class: 'list' });
  if (!missions.length) ml.appendChild(el('p', { class: 'muted' }, 'No missions yet.'));
  for (const m of missions) {
    const pct = Math.min(100, Math.round((m.progress / m.goal) * 100));
    const right = m.completed && !m.claimed
      ? el('button', { class: 'btn gold', onclick: async () => { await api.post('/missions/' + m.id + '/claim'); toast('Claimed +' + m.reward); render(); } }, '+' + m.reward)
      : el('div', { class: 'muted small' }, m.claimed ? 'claimed' : pct + '%');
    ml.appendChild(el('div', { class: 'tile' },
      el('div', { class: 'meta' },
        el('div', { class: 'name' }, m.description),
        el('div', { class: 'sub' }, `${m.progress}/${m.goal} · ${m.period}`),
      ),
      right,
    ));
  }
  root.appendChild(ml);

  root.appendChild(sectionTitle('Standings'));
  const sl = el('div', { class: 'list' });
  for (const r of standings.slice(0, 8)) {
    sl.appendChild(el('div', { class: 'tile' },
      el('div', { class: 'rating' }, String(r.points)),
      el('div', { class: 'meta' },
        el('div', { class: 'name' }, r.name + (r.isAI ? ' (AI)' : '')),
        el('div', { class: 'sub' }, `P:${r.played}  W:${r.wins}  D:${r.draws}  L:${r.losses}  GD:${r.goalDiff}`),
      ),
    ));
  }
  root.appendChild(sl);

  root.appendChild(sectionTitle('Recent matches'));
  const rl = el('div', { class: 'list' });
  if (!matches.length) rl.appendChild(el('p', { class: 'muted' }, 'No matches yet.'));
  for (const m of matches) {
    const isHome = m.homeClubId === state.club.id;
    const myG = isHome ? m.homeGoals : m.awayGoals;
    const oppG = isHome ? m.awayGoals : m.homeGoals;
    const oppName = isHome ? m.awayName : m.homeName;
    const won = myG > oppG, drawn = myG === oppG;
    rl.appendChild(el('div', { class: 'tile' },
      el('div', { class: 'rating ' + (won ? 'r-legendary' : drawn ? 'r-rare' : 'r-special') }, `${myG}-${oppG}`),
      el('div', { class: 'meta' },
        el('div', { class: 'name' }, oppName),
        el('div', { class: 'sub' }, m.mode + ' · ' + new Date(m.playedAt).toLocaleString()),
      ),
    ));
  }
  root.appendChild(rl);

  root.appendChild(el('button', { class: 'btn full', onclick: () => { api.setToken(''); state.user = null; state.club = null; showScreen('screen-auth'); } }, 'Logout'));
}

async function renderSquad(root) {
  const data = await api.get('/clubs/' + state.club.id + '/squad');
  const coaches = await api.get('/clubs/' + state.club.id + '/coaches');

  root.appendChild(el('div', { class: 'card' },
    el('div', { class: 'row between' },
      el('div', null,
        el('div', { class: 'name' }, 'Chemistry'),
        el('div', { class: 'sub muted' }, `Majority: ${data.chemistry.majorityNation || '—'} (${data.chemistry.majoritySize})`),
      ),
      el('div', { class: 'rating r-legendary' }, (data.chemistry.totalBonus || 0) + '%'),
    )
  ));

  if (data.coach) {
    root.appendChild(sectionTitle('Manager'));
    root.appendChild(coachTile(data.coach, true));
  }

  if (coaches.length > 1) {
    root.appendChild(sectionTitle('Coaching staff'));
    const list = el('div', { class: 'list' });
    for (const c of coaches) {
      const isActive = data.coach && c.id === data.coach.id;
      list.appendChild(coachTile(c, isActive, async () => {
        await api.put('/clubs/' + state.club.id + '/coach', { coachId: c.id });
        toast('Coach assigned');
        render();
      }));
    }
    root.appendChild(list);
  }

  const groups = { GK: [], DEF: [], MID: [], ATT: [] };
  for (const p of data.players) groups[p.position].push(p);
  for (const pos of Object.keys(groups)) {
    if (!groups[pos].length) continue;
    root.appendChild(sectionTitle(`${pos} (${groups[pos].length})`));
    const list = el('div', { class: 'list' });
    groups[pos].sort((a, b) => b.overallRating - a.overallRating);
    for (const p of groups[pos]) list.appendChild(playerTile(p));
    root.appendChild(list);
  }
}

function playerTile(p, opts = {}) {
  return el('div', { class: 'tile' },
    el('div', { class: 'rating r-' + p.rarity }, String(p.overallRating)),
    el('div', { class: 'meta' },
      el('div', { class: 'name' }, p.name),
      el('div', { class: 'sub' }, `${p.nationality} · ${p.age}y · `, el('span', { class: 'pos-pill' }, p.position)),
    ),
    opts.right || (p.onMarket ? el('div', { class: 'muted small' }, 'on market') :
      el('button', {
        class: 'btn',
        onclick: async () => {
          const v = prompt('Sale price (soft currency):');
          if (!v) return;
          try { await api.post('/market', { playerId: p.id, price: Number(v) }); toast('Listed'); render(); }
          catch (e) { toast(e.message, false); }
        },
      }, 'Sell')),
  );
}

function coachTile(c, isActive, onSelect) {
  return el('div', { class: 'tile' },
    el('div', { class: 'rating r-' + c.rarity }, '★'),
    el('div', { class: 'meta' },
      el('div', { class: 'name' }, c.name + (isActive ? ' · active' : '')),
      el('div', { class: 'sub' }, `${c.nationality} · TAC +${c.bonuses.tacticalBoost}% · STA +${c.bonuses.staminaBoost}% · CHE +${c.bonuses.chemistryBoost}%`),
    ),
    !isActive && onSelect ? el('button', { class: 'btn', onclick: onSelect }, 'Use') : null,
  );
}

async function renderMatch(root) {
  root.appendChild(el('div', { class: 'card' },
    el('div', { class: 'row gap-12' },
      el('button', { class: 'btn primary full', onclick: () => playMatch('quick') }, 'Quick match vs AI'),
    ),
    el('div', { style: 'height:8px' }),
    el('div', { class: 'row gap-12' },
      el('button', { class: 'btn full', onclick: () => playMatch('league') }, 'Play league fixture'),
    ),
    el('p', { class: 'muted small', style: 'margin-top:10px' }, 'Quick match keeps the rewards but doesn\'t affect standings. League matches do.'),
  ));
}

async function playMatch(mode) {
  try {
    const path = mode === 'league' ? '/matches/league' : '/matches/quick';
    const m = await api.post(path, {});
    await refreshMe();
    document.getElementById('content').innerHTML = '';
    showMatchResult(m);
  } catch (e) { toast(e.message, false); }
}

function showMatchResult(m) {
  const root = document.getElementById('content');
  root.appendChild(el('div', { class: 'score-banner' },
    el('div', { class: 'teams' },
      el('div', { class: 'team-name' }, m.homeName),
      el('div', { class: 'score' }, `${m.homeGoals} : ${m.awayGoals}`),
      el('div', { class: 'team-name' }, m.awayName),
    ),
    el('div', { class: 'muted small', style: 'margin-top:8px' }, m.mode + ' · reward +' + m.reward),
  ));
  root.appendChild(el('div', { class: 'kpi-grid' },
    kpi('Shots', `${m.homeStats.shots} – ${m.awayStats.shots}`),
    kpi('On target', `${m.homeStats.onTarget} – ${m.awayStats.onTarget}`),
    kpi('Possession', `${m.homeStats.possession}% – ${m.awayStats.possession}%`),
    kpi('Chances', `${m.homeStats.chances} – ${m.awayStats.chances}`),
  ));
  root.appendChild(sectionTitle('Events'));
  const list = el('div', { class: 'list' });
  for (const ev of m.events) {
    list.appendChild(el('div', { class: 'event-row ' + ev.type },
      el('span', { class: 'min' }, ev.minute + "'"),
      el('span', { class: 'icon' }, ev.type === 'goal' ? '⚽' : ev.type === 'save' ? '🧤' : '↗'),
      el('span', null, `${ev.team.toUpperCase()} — ${ev.note}`),
    ));
  }
  root.appendChild(list);
  root.appendChild(el('button', { class: 'btn full', onclick: () => render() }, 'Done'));
}

async function renderMarket(root) {
  const listings = await api.get('/market');
  root.appendChild(sectionTitle('Marketplace'));
  if (!listings.length) { root.appendChild(el('p', { class: 'muted' }, 'No listings.')); return; }
  const list = el('div', { class: 'list' });
  for (const l of listings) {
    if (!l.player) continue;
    const isMine = l.sellerId === state.club.id;
    list.appendChild(el('div', { class: 'tile' },
      el('div', { class: 'rating r-' + l.player.rarity }, String(l.player.overallRating)),
      el('div', { class: 'meta' },
        el('div', { class: 'name' }, l.player.name),
        el('div', { class: 'sub' }, `${l.player.nationality} · ${l.player.age}y · `, el('span', { class: 'pos-pill' }, l.player.position)),
        el('div', { class: 'sub' }, '⛁ ' + fmt(l.price)),
      ),
      isMine
        ? el('button', { class: 'btn danger', onclick: async () => { await api.del('/market/' + l.listingId); toast('Cancelled'); render(); } }, 'Cancel')
        : el('button', { class: 'btn primary', onclick: async () => {
            try { await api.post('/market/' + l.listingId + '/buy'); toast('Purchased!'); await refreshMe(); render(); }
            catch (e) { toast(e.message, false); }
          } }, 'Buy'),
    ));
  }
  root.appendChild(list);
}

async function renderPacks(root) {
  const packs = await api.get('/packs');
  root.appendChild(sectionTitle('Packs'));
  const list = el('div', { class: 'list' });
  for (const p of packs) {
    const buttons = el('div', { class: 'row gap-8' });
    if (p.priceSoft > 0) buttons.appendChild(el('button', { class: 'btn primary', onclick: () => openPack(p.id, 'soft') }, '⛁ ' + fmt(p.priceSoft)));
    if (p.pricePremium > 0) buttons.appendChild(el('button', { class: 'btn gold', onclick: () => openPack(p.id, 'premium') }, '★ ' + fmt(p.pricePremium)));
    list.appendChild(el('div', { class: 'tile' },
      el('div', { class: 'rating r-' + (p.tier === 'elite' ? 'special' : p.tier === 'premium' ? 'epic' : 'rare') }, '🎁'),
      el('div', { class: 'meta' },
        el('div', { class: 'name' }, p.name),
        el('div', { class: 'sub' }, `${p.playerCount} players · ${p.coachChance}% coach`),
      ),
      buttons,
    ));
  }
  root.appendChild(list);
}

async function openPack(id, currency) {
  try {
    const r = await api.post('/packs/open', { packId: id, currency });
    await refreshMe();
    showPackResult(r);
  } catch (e) { toast(e.message, false); }
}

function showPackResult(res) {
  const root = document.getElementById('content');
  root.innerHTML = '';
  root.appendChild(el('div', { class: 'score-banner' },
    el('div', { style: 'font-size:48px' }, '🎉'),
    el('div', { class: 'team-name', style: 'font-size:18px' }, res.pack.name + ' opened'),
  ));
  if (res.coach) {
    root.appendChild(sectionTitle('Coach'));
    root.appendChild(coachTile(res.coach, false));
  }
  root.appendChild(sectionTitle('Players'));
  const list = el('div', { class: 'list' });
  for (const p of res.players) list.appendChild(playerTile(p, { right: el('div', { class: 'muted small' }, p.rarity) }));
  root.appendChild(list);
  root.appendChild(el('button', { class: 'btn full', onclick: () => render() }, 'Done'));
}

function kpi(label, value) {
  return el('div', { class: 'kpi' }, el('div', { class: 'label' }, label), el('div', { class: 'value' }, String(value)));
}
function sectionTitle(t) { return el('div', { class: 'section-title' }, el('h2', null, t)); }

// ---- bootstrap ----
(async function init() {
  setupAuth();
  setupNav();
  if (await tryAutoLogin()) enterApp();
  else showScreen('screen-auth');
})();
