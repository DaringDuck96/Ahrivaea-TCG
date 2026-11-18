const fs = require('fs'), vm = require('vm');
const src = ['cards.js', 'engine.js', 'ai.js', 'replay.js', '../tests/random-player.js'].map(f => fs.readFileSync(__dirname + '/../game/' + f, 'utf8')).join('\n');
const ctx = { console, Math, setTimeout, Promise, Set, Object, Array, String, Error, JSON, Number, Date };
vm.createContext(ctx);
vm.runInContext(src + `
function render(){} function resetUI(){}
async function aiGames(n, levels) {
  const facs = Object.keys(HEROES); const res = { aiWins: 0, games: 0, bad: 0, turns: 0, byFac: {} };
  for (let k = 0; k < n; k++) {
    const a = facs[k % 6], b = facs[Math.floor(k / 6) % 6];
    RNG = Math.random;
    AUTO = q => {
      if (G.ai[q.who]) { const ans = aiAnswer(q); if (!validWire(q, toWire(q, ans))) { res.bad++; console.log('BAD', q.kind, q.prompt, JSON.stringify(toWire(q, ans))); } return ans; }
      return autoAnswer(q);
    };
    await newGame({ decks: [a, b], names: ['A', 'B'], ai: levels, level: 'hard' });
    res.games++; res.turns += G.turn;
    if (levels[G.winner]) res.aiWins++;
    const wf = P(G.winner).fac; res.byFac[wf] = (res.byFac[wf] || 0) + 1;
  }
  res.avgTurns = (res.turns / res.games).toFixed(1);
  return res;
}
async function replayTest(n) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const rec = { seed: 1000 + k, cfg: { decks: ['Warbound', Object.keys(HEROES)[k % 6]], names: ['You', 'AI'], ai: [false, true], level: 'hard' }, answers: [] };
    let steps = 0, t0 = Date.now(), maxMs = 0;
    while (true) {
      const s = Date.now();
      await replayGame(rec);
      maxMs = Math.max(maxMs, Date.now() - s);
      if (G.over) break;
      const q = G.pending;
      const save = RNG; RNG = Math.random; const a = autoAnswer(q); RNG = save;
      const w = toWire(q, a);
      if (!validWire(q, w)) throw new Error('invalid wire from random player ' + q.kind + ' ' + JSON.stringify(w));
      rec.answers.push(JSON.parse(JSON.stringify(w)));
      if (++steps > 3000) throw new Error('too many steps');
    }
    out.push({ steps, winner: G.winner, turns: G.turn, maxReplayMs: maxMs, totalMs: Date.now() - t0 });
  }
  return out;
}
`, ctx);
(async () => {
  const mode = process.argv[2];
  if (mode === 'vsrandom') console.log(JSON.stringify(await ctx.aiGames(+process.argv[3] || 72, [true, false])));
  else if (mode === 'aiai') console.log(JSON.stringify(await ctx.aiGames(+process.argv[3] || 72, [true, true])));
  else if (mode === 'replay') console.log(JSON.stringify(await ctx.replayTest(+process.argv[3] || 3)));
})().catch(e => { console.error('FAIL', e.stack); process.exit(1); });
vm.runInContext(`
async function hardVsNormal(n){ let hard=0; for(let k=0;k<n;k++){ const facs=Object.keys(HEROES); const a=facs[k%6], b=facs[Math.floor(k/6)%6]; RNG=Math.random; AUTO=q=>aiAnswer(q); const hs = k%2; const lv = hs===0?['hard','normal']:['normal','hard']; await newGame({decks:[a,b],names:['A','B'],ai:[true,true],level:lv}); if(G.winner===hs) hard++; } return {hard, n}; }
async function oneLog(a,b){ RNG=Math.random; AUTO=q=>aiAnswer(q); await newGame({decks:[a,b],names:['AI-'+a,'AI-'+b],ai:[true,true],level:'hard'}); return G.log.slice().reverse().join('\\n').replace(/<[^>]+>/g,''); }
`, ctx);
if (process.argv[2] === 'hvn') ctx.hardVsNormal(+process.argv[3] || 72).then(r => console.log(JSON.stringify(r)));
if (process.argv[2] === 'log') ctx.oneLog(process.argv[3], process.argv[4]).then(r => console.log(r));
