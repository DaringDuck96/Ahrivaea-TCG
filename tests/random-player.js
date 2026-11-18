// Random decision-maker used for automated rules testing.
function autoAnswer(q) {
  const R = a => a[Math.floor(Math.random() * a.length)];
  switch (q.kind) {
    case 'main': {
      const L = legalMain(q.who), acts = [];
      L.cast.forEach(u => acts.push({ type: 'cast', uid: u }, { type: 'cast', uid: u }, { type: 'cast', uid: u }));
      if (L.well.length) acts.push({ type: 'well', uid: R(L.well) }, { type: 'well', uid: R(L.well) }, { type: 'well', uid: R(L.well) });
      L.wellcast.forEach(u => acts.push({ type: 'wellcast', uid: u }));
      if (L.power) acts.push({ type: 'power' });
      if (L.attack) acts.push({ type: 'attack' }, { type: 'attack' });
      acts.push({ type: 'end' });
      return R(acts);
    }
    case 'pick': {
      const opts = [...q.uids.map(u => ({ uid: u })), ...(q.players || []).map(p => ({ p }))];
      if (q.optional && Math.random() < 0.2) return null;
      return R(opts);
    }
    case 'attack': return q.cands.filter(() => Math.random() < 0.7);
    case 'react': return Math.random() < 0.6 ? R(q.cards) : null;
    case 'block': {
      const res = {}, used = new Set();
      for (const a of q.attackers) { const c = q.pairs[a].filter(b => !used.has(b)); if (c.length && Math.random() < 0.6) { const b = R(c); res[a] = b; used.add(b); } }
      return res;
    }
    case 'buttons': return R(q.options)[1];
    case 'cards': { const k = q.min + Math.floor(Math.random() * (q.max - q.min + 1)); return shuffle([...q.cards]).slice(0, k); }
    case 'order': return shuffle([...q.cards]);
    default: return undefined;
  }
}
