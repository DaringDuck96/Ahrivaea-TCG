// End-to-end checks of the server rules. Run: npm test
import assert from 'node:assert/strict';
import { Hub } from '../src/worker.js';
import { MANA } from '../src/core.js';
import { MemoryStorage, randomWire } from './mock-do.mjs';
const hub = new Hub({ storage: new MemoryStorage() }, { ADMIN_USERS: '' });
async function call(path, body, token) {
  const r = await hub.fetch(new Request('http://x' + path, { method: body === undefined ? 'GET' : 'POST', headers: Object.assign({ 'content-type': 'application/json' }, token ? { authorization: 'Bearer ' + token } : {}), body: body === undefined ? undefined : JSON.stringify(body) }));
  return { status: r.status, body: await r.json() };
}
let r;
// accounts
r = await call('/api/signup', { name: 'Owner', password: 'secret11', starter: 'Warbound' });
assert.equal(r.status, 200); const owner = r.body.token; assert.equal(r.body.account.sol, 0, '500 Sol minus the 500 Sol starter deck'); assert.equal(r.body.account.admin, true);
assert.equal(r.body.account.decks.length, 1); assert.equal(Object.values(r.body.account.decks[0].cards).reduce((a, b) => a + b, 0), 40);
assert.equal((await call('/api/starter', { fac: 'Oathsong' }, owner)).status, 400, 'no Sol for a second starter');
r = await call('/api/signup', { name: 'friend', password: 'secret22', starter: 'Lorebound' });
const friend = r.body.token; assert.equal(r.body.account.admin, false);
assert.equal((await call('/api/signup', { name: 'OWNER', password: 'xxxxxxxx', starter: 'Warbound' })).status, 409, 'names are unique');
assert.equal((await call('/api/login', { name: 'Owner', password: 'nope' })).status, 401);
r = await call('/api/login', { name: 'owner', password: 'secret11' }); assert.equal(r.status, 200);
assert.equal((await call('/api/me')).status, 401, 'needs a token');
assert.equal((await call('/api/signup', { name: 'Shorty', password: 'short', starter: 'Warbound' })).status, 400, 'passwords need 8 characters');
// too many wrong passwords locks the login for a while
for (let i = 0; i < 8; i++) assert.equal((await call('/api/login', { name: 'friend', password: 'wrong-guess' })).status, 401);
assert.equal((await call('/api/login', { name: 'friend', password: 'secret22' })).status, 429, 'locked after 8 wrong tries');
// changing a password
assert.equal((await call('/api/password', { current: 'nope', password: 'newpass123' }, owner)).status, 400);
assert.equal((await call('/api/password', { current: 'secret11', password: 'newpass123' }, owner)).status, 200);
assert.equal((await call('/api/login', { name: 'Owner', password: 'newpass123' })).status, 200);
// starter cards can't be sold
r = await call('/api/trade', { id: 'bloodied_recruit', n: 1 }, owner); assert.equal(r.status, 400);
// packs (the owner gives themselves Sol first)
assert.equal((await call('/api/admin/sol', { name: 'Owner', sol: 1000 }, owner)).status, 200);
r = await call('/api/starter', { fac: 'Oathsong' }, owner); assert.equal(r.status, 200); assert.equal(r.body.account.sol, 500); assert.equal(r.body.account.decks.length, 2);
assert.equal(r.body.account.locked['shieldmaiden'], 2, 'bought starter cards are locked too');
assert.equal(r.body.account.collection[MANA.Oathsong], 15, 'a starter deck comes with 15 Mana cards of its faction');
assert.equal(r.body.account.collection[MANA.Warbound], 15); assert.equal(r.body.account.locked[MANA.Warbound], 15, 'Mana cards are locked');
assert.equal((await call('/api/trade', { id: MANA.Warbound }, owner)).status, 400, 'Mana cards cannot be sold');
{ // an account made before starters included Mana gets them on next login
  const u = await hub.store.get('u:friend'); delete u.manaGiven; delete u.collection[MANA.Lorebound]; delete u.locked[MANA.Lorebound]; await hub.store.put('u:friend', u);
  const lr = await call('/api/me', undefined, friend);
  assert.equal(lr.body.account.collection[MANA.Lorebound], 15, 'old accounts get their Mana'); assert.equal(lr.body.account.collection[MANA.Warbound], undefined);
  const lr2 = await call('/api/me', undefined, friend);
  assert.equal(lr2.body.account.collection[MANA.Lorebound], 15, 'and only once');
}
for (let i = 0; i < 5; i++) { r = await call('/api/pack', {}, owner); assert.equal(r.status, 200); assert.equal(r.body.opened.length, 5);
  const rs = r.body.opened.map(c => c.rar); assert.deepEqual(rs.slice(0, 4), ['C', 'C', 'C', 'U']); assert.ok(['R', 'L'].includes(rs[4])); }
assert.equal(r.body.account.sol, 0);
assert.equal((await call('/api/pack', {}, owner)).status, 400, 'no Sol, no pack');
// selling a pack card works, starter copies stay
const acc = r.body.account;
const sellableId = Object.keys(acc.collection).find(id => acc.collection[id] > (acc.locked[id] || 0));
r = await call('/api/trade', { id: sellableId, n: 99 }, owner); assert.equal(r.status, 200);
assert.equal(r.body.account.collection[sellableId] || 0, acc.locked[sellableId] || 0, 'only pack copies are sold');
assert.ok(r.body.account.sol > 0);
// Sol can't be set by a normal player
assert.equal((await call('/api/admin/sol', { name: 'friend', sol: 99999 }, friend)).status, 403);
assert.equal((await call('/api/admin/users', undefined, friend)).status, 403);
r = await call('/api/admin/sol', { name: 'friend', sol: 1234 }, owner); assert.equal(r.status, 200);
assert.equal((await call('/api/me', undefined, friend)).body.account.sol, 1234);
// decks are checked against the collection
assert.equal((await call('/api/deck/save', { deck: { name: 'Cheat', fac: 'Lorebound', cards: { living_codex: 3 } } }, friend)).status, 400);
assert.equal((await call('/api/deck/save', { deck: { name: 'Mixed', fac: 'Lorebound', cards: { bloodied_recruit: 1 } } }, friend)).status, 400);
assert.equal((await call('/api/deck/save', { deck: { name: 'Half', fac: 'Lorebound', cards: { apprentice_scribe: 2 } } }, friend)).status, 200);
// games against the computer
const me = (await call('/api/me', undefined, friend)).body.account;
const deckId = me.decks[0].id;
assert.equal((await call('/api/game/new', { deckId: me.decks[1].id, aiFac: 'Warbound' }, friend)).status, 400, 'incomplete deck');
let wins = 0, losses = 0, totalMoves = 0;
for (let g = 0; g < 4; g++) {
  r = await call('/api/game/new', { deckId, aiFac: ['Warbound', 'Oathsong', 'Shadowmarked', 'Farstrider'][g], level: 'hard' }, friend);
  assert.equal(r.status, 200);
  const gameId = r.body.gameId; let view = r.body.view;
  assert.equal(typeof view.players[1].hand, 'number', 'computer hand is hidden');
  assert.equal(typeof view.players[0].deck, 'number', 'deck order is hidden');
  // an illegal answer is refused
  assert.equal((await call('/api/game/act', { gameId, answer: { type: 'cast', uid: 1, extra: true } }, friend)).status, 400);
  let moves = 0;
  while (!view.over) {
    r = await call('/api/game/act', { gameId, answer: randomWire(view.pending) }, friend);
    if (r.status === 400) { r = await call('/api/game/current', undefined, friend); view = r.body.view; continue; }
    assert.equal(r.status, 200, JSON.stringify(r.body));
    view = r.body.view; moves++;
    assert.ok(moves < 3000);
  }
  totalMoves += moves;
  if (view.winner === 0) wins++; else losses++;
  assert.ok(r.body.reward, 'reward message at the end');
}
const after = (await call('/api/me', undefined, friend)).body.account;
assert.equal(after.stats.wins, wins); assert.equal(after.stats.losses, losses);
assert.equal(after.sol, 1234 + 20 * wins, 'only wins pay Sol');
assert.equal(after.inGame, false);
// forfeit counts as a loss and pays nothing
r = await call('/api/game/new', { deckId, aiFac: 'Wildborn' }, friend);
r = await call('/api/game/forfeit', {}, friend);
assert.equal(r.body.account.stats.losses, losses + 1); assert.equal(r.body.account.sol, after.sol);
console.log(`All server checks passed. A random-clicking player went ${wins}-${losses} against the Hard computer in ${totalMoves} moves.`);
