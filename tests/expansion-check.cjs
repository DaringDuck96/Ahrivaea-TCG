// Plays many games with random 40-card decks drawn from each faction's full card pool.
const fs = require('fs'), vm = require('vm');
const src = ['cards.js', 'expansion.js', 'engine.js', 'ai.js', 'replay.js'].map(f => fs.readFileSync(__dirname + '/../game/' + f, 'utf8')).join('\n') + '\n' + fs.readFileSync(__dirname + '/random-player.js', 'utf8');
const ctx = { console, Math, Promise, Set, Object, Array, String, Error, JSON, Number, Date };
vm.createContext(ctx);
vm.runInContext(src + `
function render(){} function resetUI(){}
function randomList(fac) { const pool = Object.values(DEFS).filter(d => d.fac === fac && d.type !== 'Mana').map(d => d.id); const out = []; while (out.length < 40) { const id = pool[Math.floor(Math.random() * pool.length)]; if (out.filter(x => x === id).length < 3) out.push(id); } return out; }
async function games(n, aiBoth) {
  const facs = Object.keys(HEROES); const res = { games: 0, bad: 0, turns: 0, aiWins: 0, byFac: {}, seen: new Set() };
  for (let k = 0; k < n; k++) {
    const a = facs[k % 6], b = facs[Math.floor(k / 6) % 6];
    const lists = [randomList(a), randomList(b)];
    lists.flat().forEach(id => res.seen.add(id));
    RNG = Math.random;
    AUTO = q => {
      if (G.ai[q.who]) { const ans = aiAnswer(q); if (!validWire(q, toWire(q, ans))) { res.bad++; if (res.bad < 5) console.log('BAD', q.kind, q.prompt, JSON.stringify(toWire(q, ans))); } return ans; }
      return autoAnswer(q);
    };
    await newGame({ decks: [a, b], lists, names: ['A', 'B'], ai: aiBoth ? [true, true] : [true, false], level: 'hard' });
    if (!G.over) throw new Error('unfinished');
    for (const pl of G.players) { const total = pl.deck.length + pl.hand.length + pl.well.length + pl.grave.length + pl.board.filter(u => !u.token).length + pl.relics.length + G.stack.filter(c => c.owner === pl.i).length; if (total !== 55) throw new Error('card count ' + total + ' ' + pl.fac); }
    res.games++; res.turns += G.turn; if (G.ai[G.winner] && !G.ai[1 - G.winner]) res.aiWins++;
    const wf = P(G.winner).fac; res.byFac[wf] = (res.byFac[wf] || 0) + 1;
  }
  res.seen = res.seen.size; res.avgTurns = (res.turns / res.games).toFixed(1);
  return res;
}`, ctx);
ctx.games(+process.argv[2] || 120, process.argv[3] === 'ai').then(r => console.log(JSON.stringify(r))).catch(e => { console.error('FAIL', e.stack); process.exit(1); });
