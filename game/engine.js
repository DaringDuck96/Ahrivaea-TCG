// ================= ENGINE =================
let G = null, UID = 1, AUTO = null, RNG = Math.random;
class Pause extends Error { constructor(q) { super('pause'); this.q = q; } }
const P = i => G.players[i], O = i => 1 - i;
class GameEnd extends Error {}

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(RNG() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function def(x) { return x.token ? TOK[x.token] : DEFS[x.id]; }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function nm(s) { return '<b>' + esc(s) + '</b>'; }
function log(m) { G.log.unshift(m); if (G.log.length > 400) G.log.length = 400; }
function allUnits() { return [...P(0).board, ...P(1).board]; }
function inPlay(u) { return !!u && G.players.some(pl => pl.board.includes(u)); }
function findUid(uid) { uid = +uid; for (const pl of G.players) for (const z of ['board', 'relics', 'hand', 'well', 'grave']) { const f = pl[z].find(c => c.uid === uid); if (f) return f; } return null; }
function mvOf(u) { return def(u).mv; }
function costStr(c) { const n = c.g ? String(c.g) : (c.pips ? '' : '0'); return n + FAC[c.fac].s.repeat(c.pips); }
function loreCards(p) { return [...P(p).board, ...P(p).relics].filter(c => def(c).fac === 'Lorebound'); }
function runeTotal(p) { return [...P(p).board, ...P(p).relics].reduce((s, c) => s + (c.runes || 0), 0); }
function isBound(u) { return G.players.some(pl => pl.relics.some(r => r.data && r.data.bound === u.uid)); }
function tUnits(w) { return Object.values(w.t || {}).map(v => v && v.u ? v.u : v).filter(v => v && v.ctrl != null && inPlay(v)); }
function isSpellish(d) { return d && (d.type === 'Spell' || d.type === 'Reaction'); }

function hasKw(u, k) {
  const d = def(u);
  if (d.kw.includes(k) || u.tkw.includes(k) || u.pkw.includes(k)) return true;
  if (k === 'venom' && P(u.ctrl).board.some(v => v !== u && v.id === 'poisonmaster_varr')) return true;
  const me = P(u.ctrl);
  for (const v of me.board) { const a = v !== u && def(v).aura; if (a && a.kw === k && (!a.when || a.when(u))) return true; }
  for (const r of me.relics) { const a = def(r).aura; if (a && a.kw === k && (!a.when || a.when(u))) return true; }
  return false;
}

function stats(u, depth = 0) {
  const d = def(u), me = P(u.ctrl);
  let p = d.p + u.counters + u.tp, h = d.h + u.counters + u.th;
  if (d.runeP) p += u.runes;
  if (d.runePH) { p += u.runes; h += u.runes; }
  if (u.id === 'pit_fighter' && u.attacking) p += 1;
  if (u.id === 'wellspring_seeker' && me.well.length >= 5) { p += 1; h += 1; }
  if (u.id === 'keeper_of_pages') { const k = Math.floor(me.well.length / 3); p += k; h += k; }
  if (u.id === 'lancer_of_dawn' && me.board.filter(v => v !== u).length >= 3) p += 1;
  if (u.id === 'pack_stalker' && depth === 0 && me.board.some(v => v !== u && stats(v, 1).p >= 4)) { p += 1; h += 1; }
  for (const v of me.board) {
    if (v === u) continue;
    if (v.id === 'banner_sergeant' && u.attacking) p += 1;
    if (v.id === 'worldroot_colossus') { p += 1; h += 1; }
    if (v.id === 'oathbound_guardian') h += 1;
    if (v.id === 'seraph_first_song') p += 1;
  }
  for (const r of me.relics) {
    if (r.id === 'hymn_of_valor') p += 1;
    const a = def(r).aura; if (a && (a.p || a.h) && (!a.when || a.when(u))) { p += a.p || 0; h += a.h || 0; }
  }
  for (const v of me.board) { const a = v !== u && def(v).aura; if (a && (a.p || a.h) && (!a.when || (depth === 0 ? a.when(u) : false))) { p += a.p || 0; h += a.h || 0; } }
  if (d.selfMod && depth === 0) { const m = d.selfMod(u, me); p += m.p || 0; h += m.h || 0; }
  if (me.fac === 'Oathsong' && me.hero.awakened) h += 1;
  return { p, h };
}

// ---------- mana ----------
function costOf(p, d) {
  let g = d.g;
  if (d.type === 'Reaction') g = Math.max(0, g - P(p).relics.filter(r => r.id === 'compass_far_roads').length - P(p).board.filter(u => def(u).cheapReactions).length);
  return { g, pips: d.pips, fac: d.fac };
}
function pool(p, ex) { return P(p).well.filter(c => !c.tapped && c.uid !== ex); }
function canAfford(p, cost, ex) {
  const pl = pool(p, ex);
  if (pl.filter(c => def(c).fac === cost.fac).length < cost.pips) return false;
  return pl.length >= cost.g + cost.pips;
}
function pay(p, cost, ex) {
  const pl = pool(p, ex);
  const match = pl.filter(c => def(c).fac === cost.fac);
  const used = match.slice(0, cost.pips);
  const rest = [...pl.filter(c => def(c).fac !== cost.fac), ...match.slice(cost.pips)];
  used.push(...rest.slice(0, cost.g));
  used.forEach(c => c.tapped = true);
}

// ---------- prompts ----------
async function decide(i) {
  if (G.viewer === i) return;
  G.viewer = i;
  if (G.hidden && !AUTO) await new Promise(res => { G.pending = { kind: 'pass', who: i, res }; resetUI(); render(); });
  else render();
}
async function ask(q) {
  if (q.who != null) await decide(q.who);
  if (AUTO) return Promise.resolve().then(() => AUTO(q));
  return new Promise(res => { G.pending = Object.assign({}, q, { res }); resetUI(); render(); });
}
function answer(v) { const q = G.pending; if (!q) return; if (typeof ONLINE !== 'undefined' && ONLINE) return sendAnswer(q, v); G.pending = null; render(); q.res(v); }

async function pickUid(ch, uids, prompt, optional) {
  if (!uids.length) return null;
  if (uids.length === 1 && !optional) return findUid(uids[0]);
  const r = await ask({ kind: 'pick', who: ch, uids, players: [], prompt, optional: !!optional });
  return r && r.uid != null ? findUid(r.uid) : null;
}
async function pickUnit(ch, filter, prompt, o = {}) {
  let c = allUnits().filter(filter);
  if (o.src && isSpellish(o.src)) c = c.filter(u => !(u.ctrl !== ch && def(u).hexproof));
  const u = await pickUid(ch, c.map(u => u.uid), prompt, o.optional);
  if (u && o.src && isSpellish(o.src) && hasKw(u, 'illusion')) {
    log(`${nm(def(u).name)} was targeted and vanished. It was an Illusion.`);
    await destroy(u); return null;
  }
  return u;
}
async function pickAny(ch, filter, prompt, o = {}) {
  let c = allUnits().filter(filter);
  if (o.src && isSpellish(o.src)) c = c.filter(u => !(u.ctrl !== ch && def(u).hexproof));
  const r = await ask({ kind: 'pick', who: ch, uids: c.map(u => u.uid), players: [0, 1], prompt, optional: false });
  if (!r) return null;
  if (r.p != null) return { p: r.p };
  const u = findUid(r.uid);
  if (u && o.src && isSpellish(o.src) && hasKw(u, 'illusion')) { log(`${nm(def(u).name)} was targeted and vanished. It was an Illusion.`); await destroy(u); return null; }
  return u ? { u } : null;
}
async function chooseCards(p, cards, prompt, min, max) {
  if (!cards.length) return [];
  if (min >= cards.length) return [...cards];
  return await ask({ kind: 'cards', who: p, cards: [...cards], prompt, min, max }) || [];
}

// ---------- effects ----------
function gainLife(p, n) { if (n > 0) { P(p).life += n; log(`${esc(P(p).name)} gains ${n} life.`); } }
function loseLife(p, n) { if (n > 0) { P(p).life -= n; log(`${esc(P(p).name)} loses ${n} life.`); } }
function dmgUnit(u, n, src) {
  if (!inPlay(u) || n <= 0) return;
  u.damage += n;
  log(`${nm(def(u).name)} takes ${n} damage.`);
  if (src && src.unit) {
    if (hasKw(src.unit, 'venom')) u.venomed = true;
    if (hasKw(src.unit, 'drain')) gainLife(src.unit.ctrl, n);
  }
}
async function dmgPlayer(i, n, src) {
  if (n <= 0) return;
  P(i).life -= n;
  log(`${esc(P(i).name)} takes ${n} damage.`);
  if (!src) return;
  const sp = src.unit ? src.unit.ctrl : src.p;
  if (sp === O(i)) P(sp).damageTurns.add(G.turn);
  if (src.unit) {
    if (hasKw(src.unit, 'drain')) gainLife(src.unit.ctrl, n);
    if (src.unit.id === 'alley_cutpurse' && P(i).life > 0) await markPick(src.unit.ctrl);
    if (def(src.unit).onHitFace && P(i).life > 0) await def(src.unit).onHitFace(src.unit.ctrl, src.unit, n);
  }
}
async function hitAny(t, n, src) { if (!t) return; if (t.p != null) await dmgPlayer(t.p, n, src); else if (t.u) dmgUnit(t.u, n, src); }
async function draw(p, n) {
  for (let k = 0; k < n; k++) {
    const pl = P(p);
    if (!pl.deck.length) { log(`${esc(pl.name)} has no cards left to draw!`); gameOver(O(p)); }
    pl.hand.push(pl.deck.shift());
  }
}
async function discard(p, n) {
  const pl = P(p); if (!pl.hand.length) return;
  const k = Math.min(n, pl.hand.length);
  const sel = await chooseCards(p, pl.hand, `Discard ${k} card${k > 1 ? 's' : ''}.`, k, k);
  for (const c of sel) { pl.hand.splice(pl.hand.indexOf(c), 1); pl.grave.push(c); log(`${esc(pl.name)} discards ${nm(def(c).name)}.`); }
}
async function prophecy(p, n) {
  const pl = P(p); const top = pl.deck.slice(0, n);
  if (top.length <= 1) return;
  const order = await ask({ kind: 'order', who: p, cards: top, prompt: `Prophecy ${n}: click the cards in the order you want them, first click goes on top.` });
  pl.deck.splice(0, top.length, ...(order && order.length === top.length ? order : top));
  log(`${esc(pl.name)} uses Prophecy ${n}.`);
}
async function inscribe(p, n) {
  for (let k = 0; k < n; k++) {
    const c = loreCards(p);
    const t = await pickUid(p, c.map(x => x.uid), 'Inscribe: choose a Lorebound card you control.', false);
    if (!t) return;
    t.runes += 1; log(`${nm(def(t).name)} gains a rune counter.`);
  }
}
function markUnit(u) { if (inPlay(u) && !u.marked) { u.marked = true; log(`${nm(def(u).name)} is marked.`); } }
async function markPick(p) {
  const opts = P(O(p)).board;
  if (!opts.length) return;
  const fresh = opts.filter(u => !u.marked);
  const t = await pickUid(p, (fresh.length ? fresh : opts).map(u => u.uid), 'Mark an enemy unit.', false);
  if (t) markUnit(t);
}
async function handToWell(p, optional) {
  const pl = P(p);
  const c = await chooseCards(p, pl.hand, 'Put a card from your hand into your Well.', optional ? 0 : 1, 1);
  if (c[0]) { pl.hand.splice(pl.hand.indexOf(c[0]), 1); c[0].tapped = false; pl.well.push(c[0]); log(`${esc(pl.name)} puts a card into their Well.`); }
}
function topToWell(p, n) {
  const pl = P(p); let k = 0;
  for (; k < n && pl.deck.length; k++) { const c = pl.deck.shift(); c.tapped = false; pl.well.push(c); }
  if (k) log(`${esc(pl.name)} puts the top ${k} card${k > 1 ? 's' : ''} of their deck into their Well.`);
}
function leave(x) {
  if (G.combat) G.combat.list = G.combat.list.filter(e => e.a !== x.uid);
  for (const pl of G.players) {
    let i = pl.board.indexOf(x); if (i >= 0) pl.board.splice(i, 1);
    i = pl.relics.indexOf(x); if (i >= 0) pl.relics.splice(i, 1);
  }
  if (x.token) return null;
  return { uid: UID++, id: x.id, owner: x.owner, tapped: false };
}
function bounce(u) { if (!inPlay(u)) return; const c = leave(u); log(`${nm(def(u).name)} returns to ${esc(P(u.owner).name)}'s hand.`); if (c) P(u.owner).hand.push(c); }
function unitToWell(u) { const c = leave(u); if (c) P(u.owner).well.push(c); }
function relicToWell(r) { const c = leave(r); if (c) P(r.owner).well.push(c); log(`${nm(def(r).name)} finishes and goes into the Well.`); }
async function destroy(u) {
  if (!inPlay(u)) return;
  const marker = O(u.ctrl), echo = hasKw(u, 'echo') && !u.echoed;
  const c = leave(u);
  log(`${nm(def(u).name)} is destroyed.`);
  if (c && echo) { c.echoed = true; P(u.owner).hand.push(c); log(`${nm(def(u).name)} returns to its owner's hand (Echo).`); }
  else if (c) P(u.owner).grave.push(c);
  if (def(u).onDeath) await def(u).onDeath(u.ctrl, u);
  if (u.marked) {
    P(marker).markedKills++;
    for (const r of P(marker).relics) { if (r.id === 'thieves_guild_hall') gainLife(marker, 2); if (def(r).onMarkedDeath) await def(r).onMarkedDeath(marker, u); }
    if (P(marker).fac === 'Shadowmarked' && P(marker).hero.awakened) await draw(marker, 1);
  }
}
async function mkToken(p, key) {
  const u = { uid: UID++, token: key, owner: p };
  await enterUnit(p, u, {});
}

function freshUnit(c, p) {
  return Object.assign(c, { ctrl: p, damage: 0, counters: 0, runes: 0, marked: false, tapped: false, sick: true, tp: 0, th: 0, tkw: [], pkw: [], noDmg: false, attacking: false, skipUntap: false, venomed: false });
}
async function enterUnit(p, c, o) {
  const pl = P(p); const u = freshUnit(c, p); const d = def(u);
  pl.board.push(u);
  if (o.first && pl.relics.some(r => r.id === 'warcallers_horn')) u.pkw.push('swift');
  log(`${nm(d.name)} enters play for ${esc(pl.name)}.`);
  if (d.enter) await d.enter(p, u);
  for (const v of pl.board) if (v !== u && v.id === 'choir_cantor') gainLife(p, 1);
  if (inPlay(u) && stats(u).p >= 5) for (const r of pl.relics) if (r.id === 'heart_old_grove') await draw(p, 1);
  await checkState();
}
async function enterRelic(p, c) {
  const r = Object.assign(c, { ctrl: p, chapter: 0, runes: 0, data: {} });
  P(p).relics.push(r);
  log(`${nm(def(r).name)} enters play for ${esc(P(p).name)}.`);
  const d = def(r);
  if (d.chapters) { r.chapter = 1; log(`${nm(d.name)}: Chapter I.`); await d.chapters[0](p, r); }
  await checkState();
}
async function advanceChapters(p) {
  for (const r of [...P(p).relics]) {
    const d = def(r);
    if (!d.chapters || !r.chapter || !P(p).relics.includes(r)) continue;
    r.chapter++;
    log(`${nm(d.name)}: Chapter ${['', 'I', 'II', 'III'][r.chapter]}.`);
    await d.chapters[r.chapter - 1](p, r);
    await checkState();
  }
}

function gameOver(w) {
  if (G.over) throw new GameEnd();
  G.over = true; G.winner = w; G.pending = null;
  log(`🏆 ${esc(P(w).name)} wins!`);
  if (typeof onGameEnd === 'function') onGameEnd(w);
  render();
  throw new GameEnd();
}
async function checkState() {
  let again = true;
  while (again) {
    again = false;
    for (const u of allUnits()) {
      const s = stats(u);
      if (s.h <= 0 || u.damage >= s.h || u.venomed) {
        if (u.venomed && u.damage < s.h && s.h > 0) log(`Venom takes effect on ${nm(def(u).name)}.`);
        await destroy(u); again = true; break;
      }
    }
  }
  for (const i of [0, 1]) if (P(i).life <= 0) gameOver(O(i));
  for (const i of [0, 1]) {
    const pl = P(i), h = HEROES[pl.fac];
    if (!pl.hero.awakened && h.aw(i)) { pl.hero.awakened = true; log(`✨ ${nm(h.name)} awakens!`); }
  }
}

// ---------- casting ----------
function canAttack(u) { return !u.tapped && (!u.sick || hasKw(u, 'swift')) && !isBound(u); }
function canBlock(b, a) {
  if (b.tapped || isBound(b)) return false;
  if (hasKw(a, 'unblockable')) return false;
  if (hasKw(b, 'noblock')) return false;
  if (hasKw(a, 'flying') && !hasKw(b, 'flying') && !hasKw(b, 'reach')) return false;
  if ((a.id === 'siegebreaker_ogre' || def(a).minBlockPower) && stats(b).p < (def(a).minBlockPower || 3)) return false;
  return true;
}
function wellLimit(p) { const pl = P(p); return 1 + (pl.fac === 'Wildborn' && pl.hero.awakened ? 1 : 0) + (pl.board.some(u => def(u).extraWell) ? 1 : 0); }
function curPower(p) { const pl = P(p), h = HEROES[pl.fac]; return pl.hero.awakened && h.awPower ? h.awPower : h.power; }
function legalMain(p) {
  const pl = P(p), r = { cast: [], well: [], wellcast: [], power: false, attack: false };
  for (const c of pl.hand) { const d = def(c); if (d.type !== 'Reaction' && d.type !== 'Mana' && canAfford(p, costOf(p, d)) && (!d.can || d.can(p))) r.cast.push(c.uid); }
  if (pl.wellPlays < wellLimit(p)) r.well = pl.hand.map(c => c.uid);
  for (const c of pl.well) {
    const d = def(c);
    if (c.tapped || d.type === 'Reaction' || d.type === 'Mana') continue;
    const ok = d.fromWell || (pl.fac === 'Lorebound' && pl.hero.awakened && !pl.hero.wellCast);
    if (ok && canAfford(p, costOf(p, d), c.uid) && (!d.can || d.can(p))) r.wellcast.push(c.uid);
  }
  const pw = curPower(p);
  r.power = !pl.hero.used && canAfford(p, { g: pw.g, pips: pw.pips, fac: pl.fac }) && (!pw.can || pw.can(p));
  r.attack = !G.attacked && pl.board.some(canAttack);
  return r;
}
function canReact(p, c, kind, w) {
  const d = def(c);
  if (d.type === 'Reaction') return d.when === kind && (!d.can || d.can(p, w)) && canAfford(p, costOf(p, d));
  if (kind === 'attack' && d.type === 'Unit' && d.kw.includes('ambush')) return canAfford(p, costOf(p, d));
  return false;
}
function removeFromZone(p, c) {
  const pl = P(p);
  let i = pl.hand.indexOf(c); if (i >= 0) { pl.hand.splice(i, 1); return 'hand'; }
  i = pl.well.indexOf(c); if (i >= 0) { pl.well.splice(i, 1); return 'well'; }
  return null;
}
async function spellTriggers(p, d) {
  if (!isSpellish(d)) return;
  for (const u of [...P(p).board]) if (u.id === 'runecarver_adept' && inPlay(u)) await inscribe(p, 1);
  for (const u of [...P(p).board]) if (def(u).onSpell && inPlay(u)) await def(u).onSpell(p, u, d);
  if (d.type === 'Reaction') {
    P(p).reactionsCast++;
    for (const u of P(p).board) if (u.id === 'wandering_cartographer') await draw(p, 1);
    for (const u of [...P(p).board]) if (def(u).onReaction && inPlay(u)) await def(u).onReaction(p, u, d);
  }
}
async function castCard(p, c, o = {}) {
  const pl = P(p), d = def(c);
  const cost = o.free ? null : costOf(p, d);
  removeFromZone(p, c);
  G.stack.push(c);
  if (cost) pay(p, cost);
  log(`${esc(pl.name)} casts ${nm(d.name)}${o.fromWell ? ' from their Well' : ''}.`);
  let first = false;
  if (d.type === 'Unit') { first = pl.lastUnitTurn !== G.turn; pl.lastUnitTurn = G.turn; }
  const x = { card: c, d, p, t: {}, cancelled: false };
  G.cur = x;
  if (d.tgt) await d.tgt(p, x);
  await reactionWindow('cast', x);
  if (x.cancelled) { log(`${nm(d.name)} is cancelled.`); G.stack.splice(G.stack.indexOf(c), 1); pl.grave.push({ uid: UID++, id: c.id, owner: c.owner, tapped: false }); await checkState(); return; }
  G.stack.splice(G.stack.indexOf(c), 1);
  if (d.type === 'Unit') await enterUnit(p, c, { first });
  else if (d.type === 'Relic') await enterRelic(p, c);
  else { G.stack.push(c); if (d.res) await d.res(p, x); G.stack.splice(G.stack.indexOf(c), 1); pl.grave.push({ uid: UID++, id: c.id, owner: c.owner, tapped: false }); }
  await spellTriggers(p, d);
  await checkState();
}
async function castReaction(p, c, w) {
  const pl = P(p), d = def(c);
  removeFromZone(p, c);
  pay(p, costOf(p, d));
  G.stack.push(c);
  log(`${esc(pl.name)} responds with ${nm(d.name)}${d.type === 'Unit' ? ' (Ambush)' : ''}.`);
  const x = { card: c, d, p, t: {}, w };
  if (d.type === 'Unit') {
    G.stack.splice(G.stack.indexOf(c), 1);
    const first = pl.lastUnitTurn !== G.turn; pl.lastUnitTurn = G.turn;
    await enterUnit(p, c, { first });
  } else {
    if (d.tgt) await d.tgt(p, x);
    if (d.res) await d.res(p, x);
    G.stack.splice(G.stack.indexOf(c), 1);
    pl.grave.push({ uid: UID++, id: c.id, owner: c.owner, tapped: false });
  }
  await spellTriggers(p, d);
  await checkState();
}
async function reactionWindow(kind, w) {
  const d = O(G.active);
  while (!G.over) {
    if (kind === 'attack' && !(G.combat && G.combat.list.some(e => { const u = findUid(e.a); return u && inPlay(u) && u.attacking; }))) return;
    const cands = P(d).hand.filter(c => canReact(d, c, kind, w));
    if (!cands.length) return;
    const prompt = kind === 'cast' ? `${esc(P(G.active).name)} is casting ${nm(w.d.name)}. Respond with a Reaction?` : `${esc(P(G.active).name)} is attacking. Play a Reaction or an Ambush unit?`;
    const r = await ask({ kind: 'react', who: d, cards: cands.map(c => c.uid), prompt });
    if (r == null) return;
    const c = findUid(r); if (!c) return;
    await castReaction(d, c, w);
    if (w && w.cancelled) return;
  }
}

// ---------- combat ----------
async function doAttack(p) {
  const o = O(p), pl = P(p);
  const elig = pl.board.filter(canAttack);
  if (!elig.length) return;
  const sel = await ask({ kind: 'attack', who: p, cands: elig.map(u => u.uid), prompt: 'Click units to attack with, then confirm.' });
  if (!sel || !sel.length) return;
  G.attacked = true;
  const atk = sel.map(findUid).filter(u => u && inPlay(u));
  atk.forEach(u => { u.tapped = true; u.attacking = true; });
  G.combat = { list: atk.map(u => ({ a: u.uid, guard: null, block: null })) };
  log(`${esc(pl.name)} attacks with ${atk.map(u => nm(def(u).name)).join(', ')}.`);
  const guards = () => P(o).board.filter(u => hasKw(u, 'guard'));
  if (guards().length) {
    for (const e of G.combat.list) {
      const gs = guards(); if (!gs.length) break;
      const t = await pickUid(p, gs.map(x => x.uid), `Guard: choose which Guard unit ${nm(def(findUid(e.a)).name)} attacks.`, false);
      if (t) { e.guard = t.uid; log(`${nm(def(findUid(e.a)).name)} must attack ${nm(def(t).name)} (Guard).`); }
    }
  }
  for (const u of atk) if (def(u).onAttack && inPlay(u)) await def(u).onAttack(p, u);
  for (const u of [...pl.board]) if (def(u).onAnyAttack && inPlay(u)) await def(u).onAnyAttack(p, u);
  if (atk.length >= 3) for (const u of [...pl.board]) if (u.id === 'paladin_commander') await draw(p, 1);
  await checkState();
  await reactionWindow('attack', {});
  const list = G.combat.list.filter(e => { const u = findUid(e.a); return u && inPlay(u) && u.attacking; });
  const guardLive = e => e.guard && inPlay(findUid(e.guard));
  const toPlayer = list.filter(e => !guardLive(e));
  const guarded = new Set(list.filter(guardLive).map(e => e.guard));
  const blockers = P(o).board.filter(u => !guarded.has(u.uid));
  const pairs = {};
  for (const e of toPlayer) pairs[e.a] = blockers.filter(b => canBlock(b, findUid(e.a))).map(b => b.uid);
  if (toPlayer.length && Object.values(pairs).some(x => x.length)) {
    G.phase = 'Blocks';
    const asg = await ask({ kind: 'block', who: o, attackers: toPlayer.map(e => e.a), pairs, prompt: `${esc(P(o).name)}: assign blockers. Click one of your units, then the attacker it blocks.` });
    const used = new Set();
    for (const [a, b] of Object.entries(asg || {})) {
      const e = list.find(x => x.a === +a);
      if (e && pairs[e.a] && pairs[e.a].includes(+b) && !used.has(+b)) { e.block = +b; used.add(+b); log(`${nm(def(findUid(+b)).name)} blocks ${nm(def(findUid(e.a)).name)}.`); }
    }
  }
  G.phase = 'Damage';
  const ev = [], retaliated = new Set();
  for (const e of list) {
    const a = findUid(e.a); if (!a || !inPlay(a)) continue;
    const ap = a.noDmg ? 0 : Math.max(0, stats(a).p);
    let dU = null;
    if (guardLive(e)) dU = findUid(e.guard);
    else if (e.block && inPlay(findUid(e.block))) dU = findUid(e.block);
    if (dU) {
      ev.push({ u: dU, n: ap, src: a });
      if (!retaliated.has(dU.uid)) { retaliated.add(dU.uid); ev.push({ u: a, n: Math.max(0, stats(dU).p), src: dU }); }
    } else ev.push({ p: o, n: ap, src: a });
  }
  for (const x of ev) if (x.u) dmgUnit(x.u, x.n, { unit: x.src });
  for (const x of ev) if (x.p != null) await dmgPlayer(x.p, x.n, { unit: x.src });
  allUnits().forEach(u => u.attacking = false);
  G.combat = null;
  G.phase = 'Main';
  await checkState();
}

// ---------- turn flow ----------
async function heroPower(p) {
  const pl = P(p), pw = curPower(p);
  pay(p, { g: pw.g, pips: pw.pips, fac: pl.fac });
  pl.hero.used = true;
  log(`${esc(pl.name)} uses ${nm(HEROES[pl.fac].name)}'s power.`);
  await pw.run(p);
  await checkState();
}
async function mainPhase(p) {
  const pl = P(p);
  while (!G.over) {
    const a = await ask({ kind: 'main', who: p });
    if (!a || a.type === 'end') return;
    const L = legalMain(p);
    if (a.type === 'cast' && L.cast.includes(a.uid)) await castCard(p, findUid(a.uid));
    else if (a.type === 'well' && L.well.includes(a.uid)) {
      const c = findUid(a.uid); pl.hand.splice(pl.hand.indexOf(c), 1); c.tapped = false; pl.well.push(c); pl.wellPlays++;
      log(def(c).type === 'Mana' ? `${esc(pl.name)} plays ${nm(def(c).name)}.` : `${esc(pl.name)} puts ${nm(def(c).name)} into their Well.`);
      await checkState();
    } else if (a.type === 'wellcast' && L.wellcast.includes(a.uid)) {
      const c = findUid(a.uid), viaHero = !def(c).fromWell;
      if (viaHero) pl.hero.wellCast = true;
      await castCard(p, c, { fromWell: true });
      if (viaHero) topToWell(p, 1);
    } else if (a.type === 'power' && L.power) await heroPower(p);
    else if (a.type === 'attack' && L.attack) await doAttack(p);
  }
}
async function takeTurn() {
  const p = G.active, pl = P(p);
  G.turn++;
  G.phase = 'Ready';
  for (const u of pl.board) { if (u.skipUntap) u.skipUntap = false; else u.tapped = false; u.sick = false; }
  pl.well.forEach(c => c.tapped = false);
  pl.hero.used = false; pl.hero.wellCast = false; pl.wellPlays = 0; G.attacked = false;
  log(`<span class="turnlog">Turn ${G.turn}: ${esc(pl.name)}</span>`);
  for (const u of [...pl.board]) if (def(u).startTurn && inPlay(u)) await def(u).startTurn(p, u);
  for (const r of [...pl.relics]) if (def(r).startTurn) await def(r).startTurn(p, r);
  await checkState();
  G.phase = 'Draw';
  if (G.turn > 1) await draw(p, 1);
  G.phase = 'Main';
  await advanceChapters(p);
  await mainPhase(p);
  G.phase = 'End';
  for (const u of allUnits()) { u.damage = 0; u.tp = 0; u.th = 0; u.tkw = []; u.noDmg = false; u.attacking = false; }
  await checkState();
  if (pl.hand.length > 8) await discard(p, pl.hand.length - 8);
}
function mkPlayer(i, cfg) {
  const fac = cfg.decks[i], h = HEROES[fac];
  const spells = cfg.lists && cfg.lists[i] ? cfg.lists[i] : DECKS[fac].flatMap(id => [id, id]);
  const nMana = cfg.mana && cfg.mana[i] != null ? cfg.mana[i] : MANA_COPIES;
  const deck = shuffle([...spells, ...Array(nMana).fill(MANA[fac])].map(id => ({ uid: UID++, id, owner: i, tapped: false })));
  return { i, name: cfg.names[i] || ('Player ' + (i + 1)), fac, hero: { awakened: false, used: false, wellCast: false }, life: h.life,
    deck, hand: [], well: [], board: [], relics: [], grave: [], wellPlays: 0, damageTurns: new Set(), reactionsCast: 0, markedKills: 0, lastUnitTurn: -1 };
}
function newGame(cfg) {
  UID = 1;
  G = { players: [], active: 0, turn: 0, phase: 'Setup', log: [], over: false, winner: null, pending: null, viewer: 0, hidden: !!cfg.hidden, ranked: !!cfg.ranked, combat: null, attacked: false, stack: [], ai: cfg.ai || [false, false], level: cfg.level || 'hard' };
  G.players = [mkPlayer(0, cfg), mkPlayer(1, cfg)];
  G.active = RNG() < 0.5 ? 0 : 1;
  G.viewer = G.active;
  log(`${esc(P(G.active).name)} goes first (and skips their first draw).`);
  return run();
}
async function run() {
  try {
    const order = [G.active, O(G.active)];
    for (const i of order) for (let k = 0; k < 6; k++) P(i).hand.push(P(i).deck.shift());
    for (const i of order) {
      const m = await ask({ kind: 'buttons', who: i, prompt: `${esc(P(i).name)}: keep this opening hand, or take your one free mulligan?`, options: [['Keep hand', false], ['Mulligan', true]] });
      if (m) { const pl = P(i); pl.deck.push(...pl.hand); pl.hand = []; shuffle(pl.deck); for (let k = 0; k < 6; k++) pl.hand.push(pl.deck.shift()); log(`${esc(pl.name)} takes a mulligan.`); }
    }
    while (!G.over) { await takeTurn(); G.active = O(G.active); }
  } catch (e) {
    if (e instanceof Pause) { G.paused = e.q; return; }
    if (!(e instanceof GameEnd)) { console.error(e); if (G) { log('⚠️ Rules engine error: ' + esc(e.message)); render(); } if (AUTO) throw e; }
  }
}
