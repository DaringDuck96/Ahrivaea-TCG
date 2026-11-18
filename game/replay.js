// ================= SERVER-SIDE GAME RUNNER =================
// A game is stored as { seed, cfg, answers[] }. Every request rebuilds the game
// by replaying the human's recorded answers; the computer's choices are recomputed.
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function toWire(q, v) {
  switch (q.kind) {
    case 'cards': case 'order': return (v || []).map(c => c.uid);
    case 'buttons': return q.options.findIndex(o => o[1] === v);
    default: return v === undefined ? null : v;
  }
}
function fromWire(q, w) {
  switch (q.kind) {
    case 'cards': case 'order': return w.map(id => q.cards.find(c => c.uid === id));
    case 'buttons': return q.options[w][1];
    default: return w;
  }
}
function validWire(q, w) {
  const isInt = x => Number.isInteger(x);
  const uniq = a => new Set(a).size === a.length;
  switch (q.kind) {
    case 'main': return w && ['end', 'cast', 'well', 'wellcast', 'power', 'attack'].includes(w.type) && (w.uid === undefined || isInt(w.uid)) && Object.keys(w).every(k => k === 'type' || k === 'uid');
    case 'pick':
      if (w === null) return !!q.optional;
      if (w && isInt(w.uid) && Object.keys(w).length === 1) return q.uids.includes(w.uid);
      if (w && isInt(w.p) && Object.keys(w).length === 1) return (q.players || []).includes(w.p);
      return false;
    case 'attack': return Array.isArray(w) && w.every(isInt) && uniq(w) && w.every(u => q.cands.includes(u));
    case 'react': return w === null || (isInt(w) && q.cards.includes(w));
    case 'block': {
      if (!w || typeof w !== 'object' || Array.isArray(w)) return false;
      const vals = Object.values(w);
      return uniq(vals) && Object.entries(w).every(([a, b]) => q.attackers.includes(+a) && isInt(b) && (q.pairs[a] || []).includes(b));
    }
    case 'buttons': return isInt(w) && w >= 0 && w < q.options.length;
    case 'cards': return Array.isArray(w) && w.every(isInt) && uniq(w) && w.length >= q.min && w.length <= q.max && w.every(id => q.cards.some(c => c.uid === id));
    case 'order': return Array.isArray(w) && w.every(isInt) && uniq(w) && w.length === q.cards.length && w.every(id => q.cards.some(c => c.uid === id));
    case 'reveal': return true;
  }
  return false;
}

// Runs a stored game forward until the human must decide, or the game ends.
async function replayGame(rec) {
  RNG = mulberry32(rec.seed);
  let idx = 0;
  AUTO = q => {
    if (G.ai[q.who]) { const a = aiAnswer(q); return a; }
    if (q.kind === 'reveal' && idx >= rec.answers.length) { /* reveals need an OK from the human */ }
    if (idx < rec.answers.length) return fromWire(q, rec.answers[idx++]);
    throw new Pause(q);
  };
  G = null;
  await newGame(rec.cfg);
  G.pending = G.over ? null : G.paused;
  G.paused = null;
  return G;
}

// What the human's browser is allowed to see.
function viewFor(seat, extra) {
  const pls = G.players.map((pl, i) => {
    const o = Object.assign({}, pl);
    o.damageTurns = [...pl.damageTurns];
    o.deck = pl.deck.length;
    o.hand = i === seat ? pl.hand : pl.hand.length;
    return o;
  });
  const q = G.pending ? Object.assign({}, G.pending) : null;
  if (q) delete q.res;
  return Object.assign({ players: pls, active: G.active, turn: G.turn, phase: G.phase, log: G.log.slice(0, 120), over: G.over, winner: G.winner,
    combat: G.combat, attacked: G.attacked, viewer: seat, pending: q, level: G.level }, extra || {});
}
