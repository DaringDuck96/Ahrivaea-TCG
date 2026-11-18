// ================= AHRIVAEA TCG SERVER (Cloudflare Worker + Durable Object) =================
import { DEFS, HEROES, DECKS, MANA, replayGame, viewFor, validWire, gameState } from './core.js';

const ECON = { startSol: 500, winSol: 20, packPrice: 100, packSize: 5, tradeValue: 5, maxCopies: 3, deckSize: 40, maxDecks: 30 };
const SET_NAME = 'Core Set';
const SET = () => Object.values(DEFS).filter(d => d.type !== 'Mana').map(d => d.id);
const SESSION_DAYS = 60;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      const id = env.HUB.idFromName('main');
      return env.HUB.get(id).fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (status, msg) => { throw new HttpError(status, msg); };
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const randHex = n => hex(crypto.getRandomValues(new Uint8Array(n)));
const randInt = n => crypto.getRandomValues(new Uint32Array(1))[0] % n;

async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256);
  return hex(bits);
}
function safeEqual(a, b) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }

export class Hub {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; this.store = ctx.storage; }

  async fetch(request) {
    try {
      const url = new URL(request.url);
      const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
      const route = request.method + ' ' + url.pathname;
      const auth = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
      switch (route) {
        case 'POST /api/signup': return json(await this.signup(body));
        case 'POST /api/login': return json(await this.login(body));
      }
      const { user, token } = await this.auth(auth);
      switch (route) {
        case 'POST /api/logout': await this.store.delete('s:' + token); return json({ ok: true });
        case 'GET /api/me': return json({ account: this.pub(user), config: this.config() });
        case 'POST /api/pack': return json(await this.pack(user));
        case 'POST /api/trade': return json(await this.trade(user, body));
        case 'POST /api/deck/save': return json(await this.saveDeck(user, body));
        case 'POST /api/deck/delete': return json(await this.deleteDeck(user, body));
        case 'POST /api/game/new': return json(await this.newGame(user, body));
        case 'GET /api/game/current': return json(await this.currentGame(user));
        case 'POST /api/game/act': return json(await this.act(user, body));
        case 'POST /api/game/forfeit': return json(await this.forfeit(user));
        case 'GET /api/admin/users': return json(await this.adminUsers(user));
        case 'POST /api/admin/sol': return json(await this.adminSol(user, body));
      }
      return json({ error: 'Not found' }, 404);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: 'Something went wrong on the server.' }, 500);
    }
  }

  config() { return { econ: ECON, setName: SET_NAME, setSize: SET().length }; }

  // ---------- accounts ----------
  async signup({ name, password, starter }) {
    name = String(name || '').trim();
    if (!/^[A-Za-z0-9_ -]{3,20}$/.test(name)) fail(400, 'Names are 3 to 20 characters: letters, numbers, spaces, - and _.');
    if (String(password || '').length < 6) fail(400, 'Use a password of at least 6 characters.');
    if (!DECKS[starter]) fail(400, 'Choose a starter deck.');
    const key = 'u:' + name.toLowerCase();
    if (await this.store.get(key)) fail(409, 'That name is taken. Try another.');
    const meta = (await this.store.get('meta')) || { users: 0 };
    const salt = randHex(16);
    const collection = {}, locked = {}, cards = {};
    DECKS[starter].forEach(id => { collection[id] = 2; locked[id] = 2; cards[id] = 2; });
    const user = { name, salt, hash: await hashPassword(password, salt), sol: ECON.startSol, created: Date.now(),
      admin: meta.users === 0, collection, locked,
      decks: [{ id: 'd' + randHex(4), name: HEROES[starter].name.split(',')[0] + ' Starter', fac: starter, cards }],
      stats: { wins: 0, losses: 0, packs: 0 }, game: null };
    meta.users++;
    await this.store.put(key, user);
    await this.store.put('meta', meta);
    return { token: await this.newSession(user), account: this.pub(user), config: this.config() };
  }
  async login({ name, password }) {
    const user = await this.store.get('u:' + String(name || '').trim().toLowerCase());
    if (!user || !safeEqual(await hashPassword(String(password || ''), user.salt), user.hash)) fail(401, 'Wrong name or password.');
    await this.migrate(user);
    return { token: await this.newSession(user), account: this.pub(user), config: this.config() };
  }
  async newSession(user) {
    const token = randHex(32);
    await this.store.put('s:' + token, { user: user.name.toLowerCase(), exp: Date.now() + SESSION_DAYS * 864e5 });
    return token;
  }
  async auth(token) {
    if (!/^[0-9a-f]{64}$/.test(token)) fail(401, 'Please log in.');
    const s = await this.store.get('s:' + token);
    if (!s || s.exp < Date.now()) fail(401, 'Your session has ended. Please log in again.');
    const user = await this.store.get('u:' + s.user);
    if (!user) fail(401, 'Please log in.');
    await this.migrate(user);
    return { user, token };
  }
  isAdmin(user) {
    const list = String(this.env.ADMIN_USERS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    return !!user.admin || list.includes(user.name.toLowerCase());
  }
  save(user) { return this.store.put('u:' + user.name.toLowerCase(), user); }
  pub(user) {
    return { name: user.name, sol: user.sol, collection: user.collection, locked: user.locked || {}, decks: user.decks, stats: user.stats,
      admin: this.isAdmin(user), inGame: !!user.game, notice: user.notice || null };
  }

  // Keeps accounts valid after the game's card list changes.
  async migrate(user) {
    const known = new Set(SET());
    let refund = 0, changed = false;
    user.locked = user.locked || {};
    for (const id of Object.keys(user.collection)) {
      if (!known.has(id)) { refund += (user.collection[id] - (user.locked[id] || 0)) * ECON.tradeValue; delete user.collection[id]; delete user.locked[id]; changed = true; }
    }
    for (const d of user.decks) for (const id of Object.keys(d.cards)) if (!known.has(id)) { delete d.cards[id]; changed = true; }
    if (refund > 0) { user.sol += refund; user.notice = `Some cards were retired in a game update. You were refunded ${refund} Sol.`; }
    if (changed) await this.save(user);
  }

  // ---------- economy ----------
  sellable(user, id) { return Math.max(0, (user.collection[id] || 0) - ((user.locked || {})[id] || 0)); }
  async pack(user) {
    if (user.game) fail(409, 'Finish or forfeit your current game first.');
    if (user.sol < ECON.packPrice) fail(400, `A pack costs ${ECON.packPrice} Sol.`);
    const pool = SET(), cards = [];
    for (let k = 0; k < ECON.packSize; k++) cards.push(pool[randInt(pool.length)]);
    const opened = cards.map((id, i) => ({ id, fresh: !user.collection[id] && cards.indexOf(id) === i }));
    user.sol -= ECON.packPrice;
    cards.forEach(id => user.collection[id] = (user.collection[id] || 0) + 1);
    user.stats.packs++;
    await this.save(user);
    return { opened, account: this.pub(user) };
  }
  async trade(user, { id, n, all }) {
    let gained = 0;
    if (all) {
      // sell pack copies beyond the 3 a deck can use
      for (const cid of Object.keys(user.collection)) {
        const k = Math.min(this.sellable(user, cid), Math.max(0, user.collection[cid] - ECON.maxCopies));
        if (k > 0) { user.collection[cid] -= k; gained += k * ECON.tradeValue; }
      }
    } else {
      if (!DEFS[id]) fail(400, 'Unknown card.');
      const k = Math.min(Math.max(1, Math.floor(+n || 1)), this.sellable(user, id));
      if (k <= 0) fail(400, 'Cards from your starter deck can’t be sold.');
      user.collection[id] -= k; gained = k * ECON.tradeValue;
    }
    for (const cid of Object.keys(user.collection)) if (user.collection[cid] <= 0) delete user.collection[cid];
    user.sol += gained;
    await this.save(user);
    return { gained, account: this.pub(user) };
  }
  async saveDeck(user, { deck }) {
    if (!deck || typeof deck !== 'object') fail(400, 'No deck sent.');
    const fac = deck.fac;
    if (!HEROES[fac]) fail(400, 'Unknown hero.');
    const name = String(deck.name || 'Untitled deck').slice(0, 40);
    const cards = {}; let total = 0;
    for (const [id, k] of Object.entries(deck.cards || {})) {
      const d = DEFS[id], n = Math.floor(+k);
      if (!d || d.type === 'Mana' || d.fac !== fac) fail(400, 'That deck has a card from another faction.');
      if (!(n >= 1 && n <= ECON.maxCopies)) fail(400, `At most ${ECON.maxCopies} copies of a card.`);
      if (n > (user.collection[id] || 0)) fail(400, `You don't own ${n} ${d.name}.`);
      cards[id] = n; total += n;
    }
    if (total > ECON.deckSize) fail(400, `A deck has at most ${ECON.deckSize} cards.`);
    const id = /^d[0-9a-f]{8}$/.test(deck.id || '') ? deck.id : 'd' + randHex(4);
    const i = user.decks.findIndex(d => d.id === id);
    const clean = { id, name, fac, cards };
    if (i >= 0) user.decks[i] = clean;
    else { if (user.decks.length >= ECON.maxDecks) fail(400, `You can keep up to ${ECON.maxDecks} decks.`); user.decks.push(clean); }
    await this.save(user);
    return { account: this.pub(user), deckId: id };
  }
  async deleteDeck(user, { id }) {
    user.decks = user.decks.filter(d => d.id !== id);
    await this.save(user);
    return { account: this.pub(user) };
  }

  // ---------- games against the computer ----------
  deckList(user, deck) {
    let total = 0;
    for (const [id, k] of Object.entries(deck.cards)) { if (k > (user.collection[id] || 0)) return null; total += k; }
    if (total !== ECON.deckSize) return null;
    return Object.entries(deck.cards).flatMap(([id, k]) => Array(k).fill(id));
  }
  async run(rec) { await replayGame(rec); return gameState(); }
  async newGame(user, { deckId, aiFac, level }) {
    const deck = user.decks.find(d => d.id === deckId);
    if (!deck) fail(400, 'Choose one of your decks.');
    const list = this.deckList(user, deck);
    if (!list) fail(400, 'That deck isn’t complete yet.');
    if (!HEROES[aiFac]) fail(400, 'Choose an opponent.');
    if (user.game) await this.finish(user, await this.store.get('g:' + user.game), false, true);
    const rec = { id: 'g' + randHex(8), owner: user.name.toLowerCase(), seed: crypto.getRandomValues(new Uint32Array(1))[0], answers: [], created: Date.now(),
      cfg: { decks: [deck.fac, aiFac], lists: [list, null], names: [user.name, 'Computer'], ai: [false, true], level: level === 'normal' ? 'normal' : 'hard' } };
    const st = await this.run(rec);
    user.game = rec.id;
    await this.store.put('g:' + rec.id, rec);
    await this.save(user);
    return { gameId: rec.id, view: st.view, account: this.pub(user) };
  }
  async currentGame(user) {
    if (!user.game) return { gameId: null };
    const rec = await this.store.get('g:' + user.game);
    if (!rec) { user.game = null; await this.save(user); return { gameId: null }; }
    const st = await this.run(rec);
    return { gameId: rec.id, view: st.view };
  }
  async act(user, { gameId, answer }) {
    if (!user.game || user.game !== gameId) fail(409, 'That game is no longer running.');
    const rec = await this.store.get('g:' + gameId);
    let st = await this.run(rec);
    if (st.over) fail(409, 'That game is already over.');
    if (!st.pending || !validWire(st.pending, answer)) fail(400, 'That move isn’t allowed right now.');
    rec.answers.push(answer);
    st = await this.run(rec);
    let reward = null;
    if (st.over) reward = await this.finish(user, rec, st.winner === 0, false);
    else await this.store.put('g:' + rec.id, rec);
    return { view: st.view, reward, account: this.pub(user) };
  }
  async forfeit(user) {
    if (!user.game) return { account: this.pub(user) };
    await this.finish(user, await this.store.get('g:' + user.game), false, true);
    return { account: this.pub(user) };
  }
  async finish(user, rec, won, forfeited) {
    user.game = null;
    let text;
    if (won) { user.sol += ECON.winSol; user.stats.wins++; text = `You won and earned ${ECON.winSol} Sol.`; }
    else { user.stats.losses++; text = forfeited ? 'Game forfeited.' : `The computer won this one. Win a game to earn ${ECON.winSol} Sol.`; }
    await this.save(user);
    if (rec) await this.store.delete('g:' + rec.id);
    return text;
  }

  // ---------- admin ----------
  async adminUsers(user) {
    if (!this.isAdmin(user)) fail(403, 'Only the game’s owner can do that.');
    const all = await this.store.list({ prefix: 'u:' });
    return { users: [...all.values()].map(u => ({ name: u.name, sol: u.sol, wins: u.stats.wins, losses: u.stats.losses, packs: u.stats.packs, created: u.created, admin: this.isAdmin(u) })).sort((a, b) => a.name.localeCompare(b.name)) };
  }
  async adminSol(user, { name, sol }) {
    if (!this.isAdmin(user)) fail(403, 'Only the game’s owner can do that.');
    const n = Math.floor(+sol);
    if (!(n >= 0 && n <= 10000000)) fail(400, 'Sol must be a whole number from 0 to 10,000,000.');
    const key = 'u:' + String(name || '').toLowerCase();
    const target = key === 'u:' + user.name.toLowerCase() ? user : await this.store.get(key);
    if (!target) fail(404, 'No player with that name.');
    target.sol = n;
    await this.store.put(key, target);
    return { ok: true, account: this.pub(user) };
  }
}
