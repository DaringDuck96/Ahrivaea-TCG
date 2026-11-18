// Minimal stand-ins for Cloudflare's Durable Object storage, for local testing.
export class MemoryStorage {
  constructor() { this.m = new Map(); }
  async get(k) { const v = this.m.get(k); return v === undefined ? undefined : structuredClone(v); }
  async put(k, v) { this.m.set(k, structuredClone(v)); }
  async delete(k) { return this.m.delete(k); }
  async list({ prefix = '' } = {}) { const out = new Map(); for (const [k, v] of [...this.m.entries()].sort()) if (k.startsWith(prefix)) out.set(k, structuredClone(v)); return out; }
}
export function randomWire(q) {
  const R = a => a[Math.floor(Math.random() * a.length)];
  switch (q.kind) {
    case 'main': { const r = Math.random(); return r < 0.3 ? { type: 'end' } : r < 0.5 ? { type: 'attack' } : r < 0.6 ? { type: 'power' } : { type: R(['cast', 'well']), uid: Math.floor(Math.random() * 120) + 1 }; }
    case 'pick': { const o = [...q.uids.map(u => ({ uid: u })), ...(q.players || []).map(p => ({ p }))]; return q.optional && Math.random() < 0.2 ? null : R(o); }
    case 'attack': return q.cands.filter(() => Math.random() < 0.7);
    case 'react': return Math.random() < 0.5 ? R(q.cards) : null;
    case 'block': { const res = {}, used = new Set(); for (const a of q.attackers) { const c = q.pairs[a].filter(b => !used.has(b)); if (c.length && Math.random() < 0.6) { const b = R(c); res[a] = b; used.add(b); } } return res; }
    case 'buttons': return Math.floor(Math.random() * q.options.length);
    case 'cards': { const k = q.min + Math.floor(Math.random() * (q.max - q.min + 1)); return q.cards.map(c => c.uid).sort(() => Math.random() - 0.5).slice(0, k); }
    case 'order': return q.cards.map(c => c.uid).sort(() => Math.random() - 0.5);
    default: return null;
  }
}
