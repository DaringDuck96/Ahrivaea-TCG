// ================= ONLINE CLIENT: accounts, hub screens, games against the computer =================
const ONLINE = true;
let ACC = null, CONF = null, TOKEN = null, SCREEN = 'home', VIEW = {}, GAME_ID = null, BUSY = false, TOAST = null, ADMIN = null, ACC_MODE = 'loading';
const ECONF = () => (CONF && CONF.econ) || { startSol: 500, starterPrice: 500, winSol: 20, packPrice: 100, packSize: 5, tradeValue: 5, maxCopies: 3, deckSize: 40 };
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
  finally { BUSY = false; render(); if (TOAST) { const m = TOAST; setTimeout(() => { if (TOAST === m) { TOAST = null; render(); } }, 4500); } }
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
  <p class="sub">A fantasy trading card game. ${mode === 'login' ? 'Log in to your account.' : 'Create an account to start collecting.'}</p>
  ${mode === 'signup' ? `<div class="pricebox"><div><b>${ECONF().startSol} Sol</b><span>Every new account gets</span></div><div class="op">−</div><div><b>${ECONF().starterPrice} Sol</b><span>Your first Starter Deck costs</span></div><div class="op">=</div><div><b>${ECONF().startSol - ECONF().starterPrice} Sol</b><span>Left after you start</span></div></div><p class="sub small">Win games to earn ${ECONF().winSol} Sol each, then spend it on packs and more Starter Decks in the Shop.</p>` : ''}
  <div class="authtabs"><button class="${mode === 'login' ? '' : 'ghost'}" data-act="authmode" data-m="login">Log in</button><button class="${mode === 'signup' ? '' : 'ghost'}" data-act="authmode" data-m="signup">Create account</button></div>
  <form class="seat" data-form="${mode}"><label for="accname">Player name</label><input id="accname" autocomplete="username" maxlength="20" value="${esc(VIEW.signName || '')}">
  <label for="accpass">Password${mode === 'signup' ? ' (at least 8 characters)' : ''}</label><input id="accpass" type="password" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" ${mode === 'signup' ? 'minlength="8"' : ''}>
  ${mode === 'signup' ? `<label>Choose your Starter Deck (${ECONF().starterPrice} Sol)</label><div class="facpick">${facs.map(f => `<button type="button" class="facbtn ${f === pick ? 'on' : ''}" style="--fc:${FAC[f].c}" data-act="signfac" data-f="${f}"><b>${f}</b><span>${esc(HEROES[f].name)}</span><em>${ECONF().starterPrice} Sol</em></button>`).join('')}</div><div class="hp">${heroPreview(pick)} You get 40 cards and a ready-to-play deck. Starter cards can never be sold, so you always keep a playable deck.</div>` : ''}
  <button type="submit" ${BUSY ? 'disabled' : ''}>${mode === 'login' ? 'Log in' : `Create account and buy the ${pick} Starter Deck`}</button></form></div>`;
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
    <button class="tile" data-act="nav" data-to="shop"><b>Shop</b><span>Packs: ${E.packSize} random cards for ${E.packPrice} Sol. Starter Decks: ${E.starterPrice} Sol.</span></button>
  </div>
  <p class="record">Record: ${ACC.stats.wins} wins, ${ACC.stats.losses} losses, ${ACC.stats.packs} packs opened.</p>
  <div class="acct"><button class="ghost mini" data-act="pwtoggle">${VIEW.pwOpen ? 'Close' : 'Change password'}</button>
  ${VIEW.pwOpen ? `<div class="pwform"><label for="pwcur">Current password</label><input id="pwcur" type="password" autocomplete="current-password"><label for="pwnew">New password (at least 8 characters)</label><input id="pwnew" type="password" autocomplete="new-password"><button data-act="changepw" ${BUSY ? 'disabled' : ''}>Save new password</button></div>` : ''}</div></div>`;
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
const RAR_RANK = { C: 0, U: 1, R: 2, L: 3 };
const sellOf = id => ((CONF && CONF.sell) || { C: 5, U: 10, R: 25, L: 60 })[DEFS[id].rar] || 5;
function curveOf(cards) { const c = [0, 0, 0, 0, 0, 0]; for (const [id, k] of Object.entries(cards)) c[Math.min(6, Math.max(1, DEFS[id].mv)) - 1] += k; return c; }
function curveHTML(cards) {
  const c = curveOf(cards), m = Math.max(1, ...c);
  return `<div class="curve" aria-label="Mana curve">${c.map((n, i) => `<div class="bar"><span class="n">${n || ''}</span><span class="fill" style="height:${Math.round(n / m * 100)}%"></span><span class="lbl">${i === 5 ? '6+' : i + 1}</span></div>`).join('')}</div>`;
}
function decksHTML() {
  const E = ECONF();
  return `<div class="hub wide"><h1>Decks</h1><p class="sub">Click a deck to edit it. A deck is a hero plus ${E.deckSize} cards from that hero's faction; 15 Mana cards are added for free.</p>
  <div class="deckgrid"><button class="decktile newtile" data-act="newdeck"><b>+</b><span>New deck</span></button>
  ${ACC.decks.map(d => { const pr = deckProblems(d); return `<div class="decktile" style="--fc:${FAC[d.fac].c}"><button class="dtmain" data-act="editdeck" data-id="${d.id}"><span class="dthero">${esc(HEROES[d.fac].name)}</span><b>${esc(d.name)}</b><span class="dtstat ${pr.length ? 'bad' : 'ok'}">${pr.length ? 'Not ready: ' + esc(pr[0]) : 'Ready to play'}</span>${curveHTML(d.cards)}</button><div class="dtacts"><button class="mini ghost" data-act="dupdeck" data-id="${d.id}">Copy</button><button class="mini ghost" data-act="deldeck" data-id="${d.id}">Delete</button></div></div>`; }).join('')}</div>
  ${VIEW.confirmDel ? `<div class="modal"><div class="box"><h2>Delete this deck?</h2><p>${esc((ACC.decks.find(d => d.id === VIEW.confirmDel) || {}).name || '')} will be removed. Your cards stay in your collection.</p><button data-act="deldeckyes">Delete deck</button> <button class="ghost" data-act="deldeckno">Keep it</button></div></div>` : ''}</div>`;
}
function builderPool() {
  const d = VIEW.draft, f = VIEW.f, q = (f.q || '').toLowerCase();
  return SETIDS().filter(id => {
    const x = DEFS[id];
    if (d.fac ? x.fac !== d.fac : (f.fac && x.fac !== f.fac)) return false;
    if (!f.unowned && !owned(id)) return false;
    if (f.type && x.type !== f.type) return false;
    if (f.cost && (f.cost === 6 ? x.mv < 6 : x.mv !== f.cost)) return false;
    if (f.rar && x.rar !== f.rar) return false;
    if (q && !(x.name.toLowerCase().includes(q) || (x.text || '').toLowerCase().includes(q))) return false;
    return true;
  }).sort((a, b) => DEFS[a].mv - DEFS[b].mv || DEFS[a].name.localeCompare(DEFS[b].name));
}
function canAdd(id) { const d = VIEW.draft, E = ECONF(), k = d.cards[id] || 0; return owned(id) > k && k < E.maxCopies && deckCount(d) < E.deckSize && (!d.fac || DEFS[id].fac === d.fac); }
function editHTML() {
  const d = VIEW.draft, E = ECONF(); if (!d) return decksHTML();
  const f = VIEW.f || (VIEW.f = {});
  const n = deckCount(d), pr = deckProblems(d), pool = builderPool();
  const chip = (key, val, label, extra = '') => `<button class="chip ${f[key] === val ? 'on' : ''}" data-act="bf" data-k="${key}" data-v="${val === undefined ? '' : val}" ${extra}>${label}</button>`;
  const list = Object.entries(d.cards).filter(([, k]) => k > 0).sort((a, b) => DEFS[a[0]].mv - DEFS[b[0]].mv || DEFS[a[0]].name.localeCompare(DEFS[b[0]].name));
  const pips = id => { const have = owned(id), inD = d.cards[id] || 0; let s = ''; for (let i = 0; i < E.maxCopies; i++) s += `<i class="${i < inD ? 'in' : i < have ? 'own' : ''}"></i>`; return s + (have > E.maxCopies ? `<em>+${have - E.maxCopies}</em>` : ''); };
  return `<div class="builder">
  <section class="bmain">
    <div class="bfilters">
      <input id="bsearch" type="search" placeholder="Search names and rules text" value="${esc(f.q || '')}" aria-label="Search cards">
      ${d.fac ? `<span class="facnote" style="--fc:${FAC[d.fac].c}">${d.fac} cards only</span>` : `<div class="chips">${chip('fac', undefined, 'All factions')}${Object.keys(HEROES).map(x => chip('fac', x, x, `style="--fc:${FAC[x].c}"`)).join('')}</div>`}
      <div class="chips">${chip('cost', undefined, 'Any cost')}${[1, 2, 3, 4, 5, 6].map(x => chip('cost', x, x === 6 ? '6+' : String(x))).join('')}</div>
      <div class="chips">${chip('type', undefined, 'All types')}${['Unit', 'Spell', 'Relic', 'Reaction'].map(x => chip('type', x, x + 's')).join('')}</div>
      <div class="chips">${chip('rar', undefined, 'Any rarity')}${['C', 'U', 'R', 'L'].map(x => chip('rar', x, RARITY[x])).join('')}
        <label class="chk inline"><input type="checkbox" data-act="bunowned" ${f.unowned ? 'checked' : ''}> Show cards I don't own</label></div>
    </div>
    <div class="bpool">${pool.length ? pool.map(id => `<div class="pcard ${owned(id) ? '' : 'none'}">${cardFace({ id }, false, canAdd(id) ? 'play' : '').replace('data-act="card"', `data-act="addcard" data-id="${id}"`)}<div class="pips" title="Owned ${owned(id)}, in deck ${d.cards[id] || 0}">${pips(id)}</div></div>`).join('') : '<p class="muted">No cards match these filters.</p>'}</div>
  </section>
  <aside class="bside">
    <div id="bpreview" class="bpreview"><div class="hint">Hover a card to see it full size.</div></div>
    <input id="deckname" class="dname" value="${esc(d.name)}" maxlength="40" aria-label="Deck name">
    ${d.fac ? `<div class="herobox" style="--fc:${FAC[d.fac].c}"><b>${esc(HEROES[d.fac].name)}</b><span>${d.fac} hero, ${HEROES[d.fac].life} life</span><button class="mini ghost" data-act="clearhero">Change hero</button></div>`
      : `<div class="herobox empty"><b>Choose a hero</b><span>Or click any card to use its faction's hero.</span><div class="heropick">${Object.keys(HEROES).map(x => `<button class="mini" style="--fc:${FAC[x].c}" data-act="sethero" data-f="${x}">${x}</button>`).join('')}</div></div>`}
    <div class="bcount"><span class="count ${n === E.deckSize ? 'ok' : ''}">${n}/${E.deckSize}</span><span class="muted small">${pr.length ? esc(pr.join(', ')) : 'Ready to play'}</span></div>
    ${curveHTML(d.cards)}
    <div class="dlist2">${list.map(([id, k]) => `<button class="dline r${DEFS[id].rar}" style="--fc:${FAC[DEFS[id].fac].c}" data-act="remcard" data-id="${id}" title="Click to remove one"><em>${costStr(DEFS[id])}</em> ${esc(DEFS[id].name)} <span>×${k}</span></button>`).join('') || '<p class="muted small">Click cards on the left to add them.</p>'}
    ${d.fac ? `<div class="dline mana">15× ${esc(MANA_NAMES[d.fac])} (free)</div>` : ''}</div>
    <div class="bbtns"><button data-act="savedeck" ${BUSY ? 'disabled' : ''}>Done</button><button class="ghost" data-act="autofill" ${d.fac ? '' : 'disabled'}>Auto-fill</button><button class="ghost" data-act="cleardeck">Clear</button><button class="ghost" data-act="nav" data-to="decks">Cancel</button></div>
  </aside></div>`;
}
function collectionHTML() {
  const f = VIEW.colFac || 'All', r = VIEW.colRar || 'All';
  const ids = SETIDS().filter(id => (f === 'All' || DEFS[id].fac === f) && (r === 'All' || DEFS[id].rar === r)).sort((a, b) => DEFS[a].fac.localeCompare(DEFS[b].fac) || RAR_RANK[DEFS[b].rar] - RAR_RANK[DEFS[a].rar] || DEFS[a].mv - DEFS[b].mv);
  const ex = totalOverflow(), exSol = Object.keys(ACC.collection).reduce((s, id) => s + overflow(id) * sellOf(id), 0);
  const have = SETIDS().filter(id => owned(id)).length;
  return `<div class="hub wide"><h1>Collection</h1>
  <p class="sub">${have} of ${SETIDS().length} cards in ${esc((CONF && CONF.releaseName) || 'Intro to Ahrivaea')}. Cards from packs sell for 5 Sol (Common), 10 (Uncommon), 25 (Rare) or 60 (Legendary). Starter Deck cards can't be sold.</p>
  <div class="filters">${['All', ...Object.keys(HEROES)].map(x => `<button class="${x === f ? '' : 'ghost'}" data-act="colfac" data-f="${x}">${x}</button>`).join('')}</div>
  <div class="filters">${['All', 'C', 'U', 'R', 'L'].map(x => `<button class="${x === r ? '' : 'ghost'}" data-act="colrar" data-f="${x}">${x === 'All' ? 'All rarities' : RARITY[x]}</button>`).join('')}
  ${ex ? `<button data-act="tradeall" class="tradeall" ${BUSY ? 'disabled' : ''}>Sell ${ex} copies beyond ${ECONF().maxCopies} for ${exSol} Sol</button>` : ''}</div>
  ${VIEW.flash ? `<div class="notice">${esc(VIEW.flash)}</div>` : ''}
  <div class="pool">${ids.map(id => { const hv = owned(id), s = sellable(id), lk = Math.min(lockedN(id), hv);
    return `<div class="pcard ${hv ? '' : 'none'}">${cardFace({ id }, false).replace('data-act="card"', 'data-act="x"')}<div class="own">${hv ? `Owned ×${hv}${lk ? ` (${lk} from starter)` : ''}` : 'Not owned'}${s ? ` <button class="mini" data-act="trade1" data-id="${id}" ${BUSY ? 'disabled' : ''}>Sell 1 for ${sellOf(id)} Sol</button>` : ''}</div></div>`; }).join('')}</div></div>`;
}
function shopHTML() {
  const E = ECONF(), can = ACC.sol >= E.packPrice, opened = VIEW.opened, rel = (CONF && CONF.releaseName) || 'Intro to Ahrivaea';
  const lp = Math.round(((CONF && CONF.legendaryChance) || 0.15) * 100);
  return `<div class="hub"><h1>Shop</h1>
  <div class="packoffer"><div class="pack"><span>${esc(rel)}</span><b>Expansion Pack</b></div>
  <div><h2 class="h2">${esc(rel)} Expansion Pack</h2><p class="sub small">${E.packSize} cards from all ${SETIDS().length} cards in ${esc(rel)}, including cards you can't get any other way: 3 Common, 1 Uncommon and 1 Rare. That Rare is upgraded to a Legendary ${lp}% of the time. You have ${ACC.sol} Sol.</p>
  <button data-act="buypack" ${can && !BUSY ? '' : 'disabled'}>Buy a pack for ${E.packPrice} Sol</button>${can ? '' : `<p class="muted small">You need ${E.packPrice - ACC.sol} more Sol. Win games or sell cards from packs.</p>`}</div></div>
  ${opened ? `<h2 class="h2">You opened</h2><div class="reveal">${opened.map((c, i) => `<div class="rv" style="animation-delay:${i * 180}ms">${cardFace({ id: c.id }, false).replace('data-act="card"', 'data-act="x"')}${c.fresh ? '<div class="newtag">New</div>' : ''}</div>`).join('')}</div>` : ''}
  <h2 class="h2">Starter Decks: ${E.starterPrice} Sol each</h2>
  <p class="sub small">40 cards from one faction and a ready-to-play deck. Starter Deck cards can't be sold.</p>
  <div class="facpick">${Object.keys(HEROES).map(f => `<button class="facbtn" style="--fc:${FAC[f].c}" data-act="buystarter" data-f="${f}" ${ACC.sol >= E.starterPrice && !BUSY ? '' : 'disabled'}><b>${f}</b><span>${esc(HEROES[f].name)}</span><em>Buy for ${E.starterPrice} Sol</em></button>`).join('')}</div>
  ${ACC.sol < E.starterPrice ? `<p class="muted small">You need ${E.starterPrice - ACC.sol} more Sol for a Starter Deck.</p>` : ''}</div>`;
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
  const heroModal = SCREEN === 'edit' && VIEW.confirmHero ? `<div class="modal"><div class="box"><h2>Change hero?</h2><p>Your deck's cards all belong to the current hero's faction, so changing heroes empties the deck.</p><button data-act="clearheroyes">Change hero and empty the deck</button> <button class="ghost" data-act="clearherono">Keep this hero</button></div></div>` : '';
  return hubHeader() + body() + heroModal + t;
}

function keepName() { const el = document.getElementById('deckname'); if (el && VIEW.draft) VIEW.draft.name = el.value; }
function hubClick(el, act) {
  const id = el.dataset.id;
  switch (act) {
    case 'authmode': VIEW.auth = el.dataset.m; VIEW.signName = (document.getElementById('accname') || {}).value || ''; render(); return true;
    case 'signfac': VIEW.signName = (document.getElementById('accname') || {}).value || ''; VIEW.signFac = el.dataset.f; render(); return true;
    case 'logout': busy(async () => { try { await api('/api/logout', {}); } catch (e) {} TOKEN = null; store('ahr_token', null); ACC = null; G = null; SCREEN = 'home'; VIEW = {}; }); return true;
    case 'nav': SCREEN = el.dataset.to; VIEW = { oppFac: VIEW.oppFac }; render(); window.scrollTo(0, 0); if (SCREEN === 'admin') { ADMIN = null; busy(async () => { ADMIN = (await api('/api/admin/users')).users; }); } return true;
    case 'newdeck': { VIEW = { draft: { id: '', name: 'New deck', fac: null, cards: {} }, f: {} }; SCREEN = 'edit'; render(); window.scrollTo(0, 0); return true; }
    case 'editdeck': { const d = ACC.decks.find(x => x.id === id); VIEW = { draft: JSON.parse(JSON.stringify(d)), f: {} }; SCREEN = 'edit'; render(); window.scrollTo(0, 0); return true; }
    case 'bf': { const k = el.dataset.k, v = el.dataset.v; VIEW.f[k] = v === '' ? undefined : (k === 'cost' ? +v : v); keepName(); render(); return true; }
    case 'bunowned': VIEW.f.unowned = el.checked; keepName(); render(); return true;
    case 'sethero': { keepName(); const d = VIEW.draft; d.fac = el.dataset.f; for (const cid of Object.keys(d.cards)) if (DEFS[cid].fac !== d.fac) delete d.cards[cid]; if (/^New deck$/.test(d.name)) d.name = 'New ' + d.fac + ' deck'; render(); return true; }
    case 'clearhero': { keepName(); const d = VIEW.draft; if (deckCount(d)) { VIEW.confirmHero = true; } else d.fac = null; render(); return true; }
    case 'clearheroyes': { const d = VIEW.draft; d.fac = null; d.cards = {}; VIEW.confirmHero = false; render(); return true; }
    case 'clearherono': VIEW.confirmHero = false; render(); return true;
    case 'cleardeck': keepName(); VIEW.draft.cards = {}; render(); return true;
    case 'autofill': { keepName(); const d = VIEW.draft, E = ECONF(); const pool = SETIDS().filter(x => DEFS[x].fac === d.fac && owned(x)).sort((a, b) => RAR_RANK[DEFS[b].rar] - RAR_RANK[DEFS[a].rar] || Math.abs(DEFS[a].mv - 3) - Math.abs(DEFS[b].mv - 3));
      for (let pass = 0; pass < E.maxCopies && deckCount(d) < E.deckSize; pass++) for (const x of pool) { if (deckCount(d) >= E.deckSize) break; if (canAdd(x)) d.cards[x] = (d.cards[x] || 0) + 1; }
      render(); return true; }
    case 'dupdeck': { const d = ACC.decks.find(x => x.id === id); const c = JSON.parse(JSON.stringify(d)); c.id = ''; c.name = (d.name + ' (copy)').slice(0, 40); busy(async () => { ACC = (await api('/api/deck/save', { deck: c })).account; }); return true; }
    case 'deldeck': VIEW.confirmDel = id; render(); return true;
    case 'deldeckno': VIEW.confirmDel = null; render(); return true;
    case 'deldeckyes': { const del = VIEW.confirmDel; VIEW.confirmDel = null; busy(async () => { ACC = (await api('/api/deck/delete', { id: del })).account; }); return true; }
    case 'addcard': { const d = VIEW.draft; keepName(); if (!d.fac && owned(id)) d.fac = DEFS[id].fac; if (/^New deck$/.test(d.name)) d.name = 'New ' + d.fac + ' deck'; if (canAdd(id)) d.cards[id] = (d.cards[id] || 0) + 1; render(); return true; }
    case 'remcard': { const d = VIEW.draft; keepName(); if (d.cards[id]) { d.cards[id]--; if (!d.cards[id]) delete d.cards[id]; } render(); return true; }
    case 'savedeck': { const d = VIEW.draft; keepName(); d.name = d.name.trim() || 'Untitled deck'; if (!d.fac) { TOAST = 'Choose a hero first.'; render(); return true; } busy(async () => { ACC = (await api('/api/deck/save', { deck: d })).account; SCREEN = 'decks'; VIEW = {}; }); return true; }
    case 'colfac': VIEW.colFac = el.dataset.f; VIEW.flash = null; render(); return true;
    case 'colrar': VIEW.colRar = el.dataset.f; VIEW.flash = null; render(); return true;
    case 'trade1': busy(async () => { const r = await api('/api/trade', { id, n: 1 }); ACC = r.account; VIEW.flash = `Sold 1 ${DEFS[id].name} for ${r.gained} Sol.`; }); return true;
    case 'tradeall': busy(async () => { const r = await api('/api/trade', { all: true }); ACC = r.account; VIEW.flash = `Sold your extra copies for ${r.gained} Sol.`; }); return true;
    case 'changepw': { const cur = document.getElementById('pwcur').value, nw = document.getElementById('pwnew').value; busy(async () => { await api('/api/password', { current: cur, password: nw }); VIEW.pwOpen = false; TOAST = 'Password changed.'; }); return true; }
    case 'pwtoggle': VIEW.pwOpen = !VIEW.pwOpen; render(); return true;
    case 'buystarter': { const f = el.dataset.f; busy(async () => { const r = await api('/api/starter', { fac: f }); ACC = r.account; TOAST = `You bought the ${f} Starter Deck. It's in your Decks.`; }); return true; }
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

if (typeof document !== 'undefined') {
  document.addEventListener('input', e => {
    if (e.target.id !== 'bsearch') return;
    VIEW.f.q = e.target.value; keepName(); render();
    const s = document.getElementById('bsearch'); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
  });
  document.addEventListener('mouseover', e => {
    if (G) return;
    const el = e.target.closest('.card'); const box = document.getElementById('bpreview');
    if (!el || !box || el.classList.contains('big') || !el.dataset.def) return;
    box.innerHTML = cardFace({ id: el.dataset.def }, true);
  });
}
