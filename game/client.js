// ================= ONLINE CLIENT: accounts, hub screens, games against the computer =================
const ONLINE = true;
let ACC = null, CONF = null, TOKEN = null, SCREEN = 'home', VIEW = {}, GAME_ID = null, BUSY = false, TOAST = null, ADMIN = null, ACC_MODE = 'loading';
const ECONF = () => (CONF && CONF.econ) || { startSol: 500, winSol: 20, packPrice: 100, packSize: 5, tradeValue: 5, maxCopies: 3, deckSize: 40 };
const SETIDS = () => Object.values(DEFS).filter(d => d.type !== 'Mana').map(d => d.id);

function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
async function api(path, body) {
  const r = await fetch(path, { method: body === undefined ? 'GET' : 'POST', headers: Object.assign({ 'content-type': 'application/json' }, TOKEN ? { authorization: 'Bearer ' + TOKEN } : {}), body: body === undefined ? undefined : JSON.stringify(body) });
  let j; try { j = await r.json(); } catch (e) { j = { error: 'The server didn’t answer properly. Try again in a moment.' }; }
  if (r.status === 401 && TOKEN) { TOKEN = null; store('ahr_token', null); ACC = null; SCREEN = 'home'; G = null; }
  if (!r.ok) throw new Error(j.error || 'Error ' + r.status);
  return j;
}
function toast(msg) { TOAST = msg; render(); setTimeout(() => { if (TOAST === msg) { TOAST = null; render(); } }, 4500); }
async function busy(fn) {
  if (BUSY) return; BUSY = true; render();
  try { await fn(); } catch (e) { TOAST = e.message; setTimeout(() => { TOAST = null; render(); }, 5000); }
  finally { BUSY = false; render(); }
}

async function initAccount() {
  TOKEN = store('ahr_token');
  if (TOKEN) {
    try { const r = await api('/api/me'); ACC = r.account; CONF = r.config; if (ACC.inGame) await resumeGame(); }
    catch (e) { ACC = null; }
  }
  ACC_MODE = 'online';
  render();
}
async function resumeGame() {
  const r = await api('/api/game/current');
  if (r.gameId) { GAME_ID = r.gameId; loadView(r.view); }
}

// ---------- games ----------
function loadView(v) {
  const players = v.players.map((pl, i) => Object.assign({}, pl, {
    damageTurns: new Set(pl.damageTurns),
    deck: Array.from({ length: pl.deck }, () => ({})),
    hand: Array.isArray(pl.hand) ? pl.hand : Array.from({ length: pl.hand }, () => ({ hidden: true })),
  }));
  G = { players, active: v.active, turn: v.turn, phase: v.phase, log: v.log, over: v.over, winner: v.winner, combat: v.combat, attacked: v.attacked,
    viewer: v.viewer, hidden: true, pending: v.pending, stack: [], ai: [false, true], level: v.level, rewardText: G && G.rewardText };
  resetUI();
  render();
}
function sendAnswer(q, v) {
  if (BUSY) return;
  const wire = toWire(q, v);
  busy(async () => {
    G.pending = null;
    const r = await api('/api/game/act', { gameId: GAME_ID, answer: wire });
    if (r.account) ACC = r.account;
    loadView(r.view);
    if (r.reward) G.rewardText = r.reward;
  }).then(() => { if (G && !G.pending && !G.over) resumeGame().catch(() => {}); });
}
async function startRanked() {
  const deckId = document.getElementById('pdeck').value, aiFac = document.getElementById('d1').value, level = document.getElementById('lvl').value;
  VIEW.oppFac = aiFac;
  await busy(async () => {
    const r = await api('/api/game/new', { deckId, aiFac, level });
    ACC = r.account; GAME_ID = r.gameId; INSP = null; G = null; loadView(r.view);
  });
}
function onGameEnd() {}

// ---------- helpers ----------
const owned = id => (ACC.collection[id] || 0);
const lockedN = id => ((ACC.locked || {})[id] || 0);
const sellable = id => Math.max(0, owned(id) - lockedN(id));
const deckCount = d => Object.values(d.cards).reduce((s, n) => s + n, 0);
const deckProblems = d => {
  const out = [], n = deckCount(d), E = ECONF();
  if (n !== E.deckSize) out.push(`${n}/${E.deckSize} cards`);
  for (const [id, k] of Object.entries(d.cards)) if (k > owned(id)) out.push(`you own only ${owned(id)} ${DEFS[id].name}`);
  return out;
};
const overflow = id => Math.min(sellable(id), Math.max(0, owned(id) - ECONF().maxCopies));
const totalOverflow = () => Object.keys(ACC.collection).reduce((s, id) => s + overflow(id), 0);
function saveText() { return ''; }

// ---------- screens ----------
function hubHeader() {
  const tabs = [['home', 'Home'], ['play', 'Play'], ['decks', 'Decks'], ['collection', 'Collection'], ['shop', 'Shop']];
  if (ACC.admin) tabs.push(['admin', 'Admin']);
  return `<header class="hubbar"><div class="brand">Ahrivaea</div>
    <nav>${tabs.map(([k, l]) => `<button class="${SCREEN === k || (k === 'decks' && SCREEN === 'edit') ? '' : 'ghost'}" data-act="nav" data-to="${k}">${l}</button>`).join('')}</nav>
    <div class="purse"><span class="sol">${ACC.sol}</span> Sol<div class="who">${esc(ACC.name)} · <a href="#" data-act="logout">Log out</a></div></div></header>`;
}
function authHTML() {
  const mode = VIEW.auth || 'login', facs = Object.keys(HEROES), pick = VIEW.signFac || 'Warbound';
  return `<div class="setup"><h1>Ahrivaea</h1>
  <p class="sub">A fantasy trading card game. ${mode === 'login' ? 'Log in to your account.' : 'Create an account: you start with a starter deck and ' + ECONF().startSol + ' Sol to spend on packs.'}</p>
  <div class="authtabs"><button class="${mode === 'login' ? '' : 'ghost'}" data-act="authmode" data-m="login">Log in</button><button class="${mode === 'signup' ? '' : 'ghost'}" data-act="authmode" data-m="signup">Create account</button></div>
  <form class="seat" data-form="${mode}"><label for="accname">Player name</label><input id="accname" autocomplete="username" maxlength="20" value="${esc(VIEW.signName || '')}">
  <label for="accpass">Password</label><input id="accpass" type="password" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}">
  ${mode === 'signup' ? `<label>Your first starter deck</label><div class="facpick">${facs.map(f => `<button type="button" class="facbtn ${f === pick ? 'on' : ''}" style="--fc:${FAC[f].c}" data-act="signfac" data-f="${f}"><b>${f}</b><span>${esc(HEROES[f].name)}</span></button>`).join('')}</div><div class="hp">${heroPreview(pick)} Starter cards can never be sold, so you always keep a playable deck.</div>` : ''}
  <button type="submit" ${BUSY ? 'disabled' : ''}>${mode === 'login' ? 'Log in' : 'Create account'}</button></form></div>`;
}
function homeHTML() {
  const E = ECONF(), ready = ACC.decks.filter(d => !deckProblems(d).length).length;
  const n = Object.values(ACC.collection).reduce((s, k) => s + k, 0), uniq = Object.keys(ACC.collection).filter(id => owned(id)).length;
  return `<div class="hub"><h1>Welcome back, ${esc(ACC.name)}</h1>
  ${ACC.notice ? `<div class="notice">${esc(ACC.notice)}</div>` : ''}
  <div class="tiles">
    <button class="tile" data-act="nav" data-to="play"><b>Play</b><span>${ready} deck${ready === 1 ? '' : 's'} ready. Beat the computer to earn ${E.winSol} Sol.</span></button>
    <button class="tile" data-act="nav" data-to="decks"><b>Decks</b><span>${ACC.decks.length} saved. Build new ones from your collection.</span></button>
    <button class="tile" data-act="nav" data-to="collection"><b>Collection</b><span>${n} cards, ${uniq} of ${SETIDS().length} different.</span></button>
    <button class="tile" data-act="nav" data-to="shop"><b>Shop</b><span>${(CONF && CONF.setName) || 'Core Set'} packs: ${E.packSize} random cards for ${E.packPrice} Sol.</span></button>
  </div>
  <p class="record">Record: ${ACC.stats.wins} wins, ${ACC.stats.losses} losses, ${ACC.stats.packs} packs opened.</p></div>`;
}
function playHTML() {
  const ready = ACC.decks.filter(d => !deckProblems(d).length), facs = Object.keys(HEROES), opp = VIEW.oppFac || 'Lorebound';
  if (!ready.length) return `<div class="hub"><h1>Play</h1><p class="sub">You don't have a complete deck yet. Finish one in Decks first.</p><button data-act="nav" data-to="decks">Go to Decks</button></div>`;
  return `<div class="hub"><h1>Play against the computer</h1><p class="sub">Win to earn ${ECONF().winSol} Sol. The game runs on the server, so you can close the page and pick up where you left off.</p>
  <div class="seats">
    <div class="seat"><label for="pdeck">Your deck</label><select id="pdeck">${ready.map(d => `<option value="${d.id}">${esc(d.name)} (${d.fac})</option>`).join('')}</select>
      <label for="lvl">Difficulty</label><select id="lvl"><option value="hard">Hard</option><option value="normal">Normal</option></select></div>
    <div class="seat"><label for="d1">Computer's deck</label><select id="d1">${facs.map(f => `<option value="${f}" ${f === opp ? 'selected' : ''}>${f}: ${esc(HEROES[f].name)}</option>`).join('')}</select><div class="hp" id="hp1">${heroPreview(opp)}</div></div>
  </div>
  <button data-act="start" ${BUSY ? 'disabled' : ''}>Start game</button></div>`;
}
function decksHTML() {
  const E = ECONF();
  return `<div class="hub"><h1>Your decks</h1><p class="sub">A deck is a hero plus exactly ${E.deckSize} cards of that hero's faction (at most ${E.maxCopies} of each). 15 Mana cards are added for free.</p>
  <div class="decklist">${ACC.decks.map(d => { const pr = deckProblems(d); return `<div class="deckrow" style="--fc:${FAC[d.fac].c}"><div><b>${esc(d.name)}</b><span>${esc(HEROES[d.fac].name)}, ${d.fac}. ${pr.length ? 'Not ready: ' + esc(pr.join(', ')) + '.' : 'Ready to play.'}</span></div><div class="acts"><button class="ghost" data-act="editdeck" data-id="${d.id}">Edit</button><button class="ghost" data-act="dupdeck" data-id="${d.id}">Copy</button><button class="ghost" data-act="deldeck" data-id="${d.id}">Delete</button></div></div>`; }).join('') || '<p class="muted">No decks yet.</p>'}</div>
  <h2 class="h2">Build a new deck</h2><div class="facpick">${Object.keys(HEROES).map(f => `<button class="facbtn" style="--fc:${FAC[f].c}" data-act="newdeck" data-f="${f}"><b>${f}</b><span>${esc(HEROES[f].name)}</span></button>`).join('')}</div>
  ${VIEW.confirmDel ? `<div class="modal"><div class="box"><h2>Delete this deck?</h2><p>${esc((ACC.decks.find(d => d.id === VIEW.confirmDel) || {}).name || '')} will be removed. Your cards stay in your collection.</p><button data-act="deldeckyes">Delete deck</button> <button class="ghost" data-act="deldeckno">Keep it</button></div></div>` : ''}</div>`;
}
function editHTML() {
  const d = VIEW.draft, E = ECONF(); if (!d) return decksHTML();
  const pool = SETIDS().filter(id => DEFS[id].fac === d.fac).sort((a, b) => DEFS[a].mv - DEFS[b].mv || DEFS[a].name.localeCompare(DEFS[b].name));
  const n = deckCount(d), pr = deckProblems(d);
  const list = Object.entries(d.cards).filter(([, k]) => k > 0).sort((a, b) => DEFS[a[0]].mv - DEFS[b[0]].mv || DEFS[a[0]].name.localeCompare(DEFS[b[0]].name));
  return `<div class="hub wide"><div class="edtop"><input id="deckname" value="${esc(d.name)}" maxlength="40" aria-label="Deck name"><span class="count ${n === E.deckSize ? 'ok' : ''}">${n}/${E.deckSize}</span><button data-act="savedeck" ${BUSY ? 'disabled' : ''}>Save deck</button><button class="ghost" data-act="nav" data-to="decks">Cancel</button></div>
  <p class="sub small">${esc(HEROES[d.fac].name)}, ${d.fac}. Click a card to add a copy; click a line in the deck list to remove one. ${pr.length ? 'Not ready yet: ' + esc(pr.join(', ')) + '.' : 'This deck is ready to play.'}</p>
  <div class="editor"><div class="pool">${pool.map(id => { const have = owned(id), inD = d.cards[id] || 0; const can = have > inD && inD < E.maxCopies && n < E.deckSize;
    return `<div class="pcard ${have ? '' : 'none'}">${cardFace({ id }, false, can ? 'play' : '').replace('data-act="card"', `data-act="addcard" data-id="${id}"`)}<div class="own">${have ? `Own ${have} · In deck ${inD}` : 'Not owned'}</div></div>`; }).join('')}</div>
  <aside class="dlist"><h3>Deck list</h3>${list.length ? list.map(([id, k]) => `<button class="dline" style="--fc:${FAC[DEFS[id].fac].c}" data-act="remcard" data-id="${id}"><span>${k}×</span> ${esc(DEFS[id].name)} <em>${costStr(DEFS[id])}</em></button>`).join('') : '<p class="muted">Empty. Click cards on the left to add them.</p>'}<div class="dline mana">15× ${esc(MANA_NAMES[d.fac])} (free)</div></aside></div></div>`;
}
function collectionHTML() {
  const f = VIEW.colFac || 'All', E = ECONF();
  const ids = SETIDS().filter(id => f === 'All' || DEFS[id].fac === f).sort((a, b) => DEFS[a].fac.localeCompare(DEFS[b].fac) || DEFS[a].mv - DEFS[b].mv);
  const ex = totalOverflow();
  return `<div class="hub wide"><h1>Collection</h1>
  <p class="sub">Cards you open in packs can be sold for ${E.tradeValue} Sol each. Cards from your starter deck can't be sold, so you always keep a playable deck.</p>
  <div class="filters">${['All', ...Object.keys(HEROES)].map(x => `<button class="${x === f ? '' : 'ghost'}" data-act="colfac" data-f="${x}">${x}</button>`).join('')}
  ${ex ? `<button data-act="tradeall" class="tradeall" ${BUSY ? 'disabled' : ''}>Sell ${ex} copies beyond ${E.maxCopies} for ${ex * E.tradeValue} Sol</button>` : ''}</div>
  ${VIEW.flash ? `<div class="notice">${esc(VIEW.flash)}</div>` : ''}
  <div class="pool">${ids.map(id => { const have = owned(id), s = sellable(id), lk = Math.min(lockedN(id), have);
    return `<div class="pcard ${have ? '' : 'none'}">${cardFace({ id }, false).replace('data-act="card"', 'data-act="x"')}<div class="own">${have ? `Owned ×${have}${lk ? ` (${lk} from starter)` : ''}` : 'Not owned'}${s ? ` <button class="mini" data-act="trade1" data-id="${id}" ${BUSY ? 'disabled' : ''}>Sell 1 for ${E.tradeValue} Sol</button>` : ''}</div></div>`; }).join('')}</div></div>`;
}
function shopHTML() {
  const E = ECONF(), can = ACC.sol >= E.packPrice, opened = VIEW.opened, set = (CONF && CONF.setName) || 'Core Set';
  return `<div class="hub"><h1>Shop</h1>
  <div class="packoffer"><div class="pack"><span>${set}</span><b>${E.packSize} cards</b></div>
  <div><h2 class="h2">${set} pack</h2><p class="sub small">${E.packSize} cards picked at random from all ${SETIDS().length} cards in the ${set}. You have ${ACC.sol} Sol.</p>
  <button data-act="buypack" ${can && !BUSY ? '' : 'disabled'}>Buy a pack for ${E.packPrice} Sol</button>${can ? '' : `<p class="muted small">You need ${E.packPrice - ACC.sol} more Sol. Win games or sell cards from packs.</p>`}</div></div>
  ${opened ? `<h2 class="h2">You opened</h2><div class="reveal">${opened.map((c, i) => `<div class="rv" style="animation-delay:${i * 180}ms">${cardFace({ id: c.id }, false).replace('data-act="card"', 'data-act="x"')}${c.fresh ? '<div class="newtag">New</div>' : ''}</div>`).join('')}</div>` : ''}</div>`;
}
function adminHTML() {
  if (!ADMIN) return `<div class="hub"><h1>Admin</h1><p class="sub">Loading players…</p></div>`;
  return `<div class="hub"><h1>Admin</h1><p class="sub">Only you can see this page. Set any player's Sol; the change is saved on the server right away.</p>
  <table class="atable"><thead><tr><th>Player</th><th>Record</th><th>Packs</th><th>Sol</th><th></th></tr></thead><tbody>
  ${ADMIN.map((u, i) => `<tr><td>${esc(u.name)}${u.admin ? ' <span class="muted">(admin)</span>' : ''}</td><td>${u.wins}–${u.losses}</td><td>${u.packs}</td><td><input type="number" min="0" step="1" id="sol${i}" value="${u.sol}"></td><td><button class="mini" data-act="setsol" data-i="${i}" ${BUSY ? 'disabled' : ''}>Save</button></td></tr>`).join('')}
  </tbody></table></div>`;
}
function hubHTML() {
  const t = TOAST ? `<div class="toast" role="status">${esc(TOAST)}</div>` : '';
  if (ACC_MODE === 'loading') return `<div class="setup"><h1>Ahrivaea</h1><p class="sub">Loading…</p></div>`;
  if (!ACC) return authHTML() + t;
  const body = { home: homeHTML, play: playHTML, decks: decksHTML, edit: editHTML, collection: collectionHTML, shop: shopHTML, admin: adminHTML }[SCREEN] || homeHTML;
  return hubHeader() + body() + t;
}

function hubClick(el, act) {
  const id = el.dataset.id;
  switch (act) {
    case 'authmode': VIEW.auth = el.dataset.m; VIEW.signName = (document.getElementById('accname') || {}).value || ''; render(); return true;
    case 'signfac': VIEW.signName = (document.getElementById('accname') || {}).value || ''; VIEW.signFac = el.dataset.f; render(); return true;
    case 'logout': busy(async () => { try { await api('/api/logout', {}); } catch (e) {} TOKEN = null; store('ahr_token', null); ACC = null; G = null; SCREEN = 'home'; VIEW = {}; }); return true;
    case 'nav': SCREEN = el.dataset.to; VIEW = { oppFac: VIEW.oppFac }; render(); window.scrollTo(0, 0); if (SCREEN === 'admin') { ADMIN = null; busy(async () => { ADMIN = (await api('/api/admin/users')).users; }); } return true;
    case 'newdeck': { const f = el.dataset.f; VIEW = { draft: { id: '', name: 'New ' + f + ' deck', fac: f, cards: {} } }; SCREEN = 'edit'; render(); return true; }
    case 'editdeck': { const d = ACC.decks.find(x => x.id === id); VIEW = { draft: JSON.parse(JSON.stringify(d)) }; SCREEN = 'edit'; render(); return true; }
    case 'dupdeck': { const d = ACC.decks.find(x => x.id === id); const c = JSON.parse(JSON.stringify(d)); c.id = ''; c.name = (d.name + ' (copy)').slice(0, 40); busy(async () => { ACC = (await api('/api/deck/save', { deck: c })).account; }); return true; }
    case 'deldeck': VIEW.confirmDel = id; render(); return true;
    case 'deldeckno': VIEW.confirmDel = null; render(); return true;
    case 'deldeckyes': { const del = VIEW.confirmDel; VIEW.confirmDel = null; busy(async () => { ACC = (await api('/api/deck/delete', { id: del })).account; }); return true; }
    case 'addcard': { const d = VIEW.draft, E = ECONF(); d.name = document.getElementById('deckname').value; const k = d.cards[id] || 0; if (owned(id) > k && k < E.maxCopies && deckCount(d) < E.deckSize) d.cards[id] = k + 1; render(); return true; }
    case 'remcard': { const d = VIEW.draft; d.name = document.getElementById('deckname').value; if (d.cards[id]) { d.cards[id]--; if (!d.cards[id]) delete d.cards[id]; } render(); return true; }
    case 'savedeck': { const d = VIEW.draft; d.name = document.getElementById('deckname').value.trim() || 'Untitled deck'; busy(async () => { ACC = (await api('/api/deck/save', { deck: d })).account; SCREEN = 'decks'; VIEW = {}; }); return true; }
    case 'colfac': VIEW.colFac = el.dataset.f; VIEW.flash = null; render(); return true;
    case 'trade1': busy(async () => { const r = await api('/api/trade', { id, n: 1 }); ACC = r.account; VIEW.flash = `Sold 1 ${DEFS[id].name} for ${r.gained} Sol.`; }); return true;
    case 'tradeall': busy(async () => { const r = await api('/api/trade', { all: true }); ACC = r.account; VIEW.flash = `Sold your extra copies for ${r.gained} Sol.`; }); return true;
    case 'buypack': busy(async () => { const r = await api('/api/pack', {}); ACC = r.account; VIEW.opened = r.opened; }); return true;
    case 'setsol': { const u = ADMIN[+el.dataset.i], v = document.getElementById('sol' + el.dataset.i).value; busy(async () => { const r = await api('/api/admin/sol', { name: u.name, sol: +v }); ACC = r.account; u.sol = Math.floor(+v); TOAST = `${u.name} now has ${u.sol} Sol.`; }); return true; }
    case 'forfeit': busy(async () => { ACC = (await api('/api/game/forfeit', {})).account; G = null; GAME_ID = null; SCREEN = 'home'; }); return true;
    case 'home': busy(async () => { const r = await api('/api/me'); ACC = r.account; G = null; GAME_ID = null; INSP = null; SCREEN = 'home'; VIEW = {}; }); return true;
  }
  return false;
}
if (typeof document !== 'undefined') {
  document.addEventListener('submit', e => {
    const f = e.target.closest('form[data-form]'); if (!f) return;
    e.preventDefault();
    const mode = f.dataset.form, name = document.getElementById('accname').value.trim(), password = document.getElementById('accpass').value;
    VIEW.signName = name;
    busy(async () => {
      const r = await api(mode === 'login' ? '/api/login' : '/api/signup', mode === 'login' ? { name, password } : { name, password, starter: VIEW.signFac || 'Warbound' });
      TOKEN = r.token; store('ahr_token', TOKEN); ACC = r.account; CONF = r.config; SCREEN = 'home'; VIEW = {};
      if (ACC.inGame) await resumeGame();
    });
  });
}
