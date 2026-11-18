// ================= COMPUTER OPPONENT =================
// A rules-aware heuristic player. It only looks at public information plus its own hand.
const AI_ENGINE_BONUS = { worldroot_colossus: 3, banner_sergeant: 1.5, oathbound_guardian: 1.5, seraph_first_song: 2, poisonmaster_varr: 2, deeproot_druid: 1.5,
  wandering_cartographer: 1, runecarver_adept: 1, choir_cantor: 0.5, paladin_commander: 1, lancer_of_dawn: 0.5, keeper_of_pages: 1, crypt_warden: 1, alley_cutpurse: 0.5, iron_tusk_charger: 0.5 };
function remH(u) { return stats(u).h - u.damage; }
function uval(u) {
  const s = stats(u);
  let v = Math.max(0, s.p) + Math.max(0, s.h - u.damage) * 0.7;
  if (hasKw(u, 'flying')) v += 1; if (hasKw(u, 'venom')) v += 2; if (hasKw(u, 'unblockable')) v += 1.5;
  if (hasKw(u, 'drain')) v += 0.5; if (hasKw(u, 'guard')) v += 0.5;
  if (def(u).runeP || def(u).runePH) v += 1;
  v += AI_ENGINE_BONUS[u.id] || 0;
  if (u.token) v -= 0.5;
  return v;
}
function dval(d) {
  if (d.type !== 'Unit') return d.mv * 0.9 + 1;
  let v = d.p + d.h * 0.7 + (d.kw.includes('flying') ? 1 : 0) + (d.kw.includes('venom') ? 2 : 0) + (d.kw.includes('unblockable') ? 1.5 : 0) + (d.enter ? 1 : 0) + (AI_ENGINE_BONUS[d.id] || 0);
  return v;
}
function canTargetSpell(p, u) { return !(u.ctrl !== p && def(u).hexproof); }
function powerOf(u) { return u.noDmg ? 0 : Math.max(0, stats(u).p); }
function kills(a, b, bonusA = 0) { const pa = powerOf(a) + bonusA; return pa > 0 && (pa >= remH(b) || hasKw(a, 'venom')); }
function maxBy(arr, f) { let best = null, bv = -Infinity; for (const x of arr) { const v = f(x); if (v > bv) { bv = v; best = x; } } return best; }
function minBy(arr, f) { return maxBy(arr, x => -f(x)); }
function enemyUnits(p) { return P(O(p)).board; }
function myUnits(p) { return P(p).board; }
function killable(p, n, spell) { return enemyUnits(p).filter(u => (!spell || canTargetSpell(p, u)) && remH(u) <= n); }
function bestKill(p, n, spell) { const k = maxBy(killable(p, n, spell), uval); return k ? uval(k) : 0; }
function bestEnemy(p, f = () => true, spell = true) { return maxBy(enemyUnits(p).filter(u => f(u) && (!spell || canTargetSpell(p, u))), uval); }

// ---------- which cards to cast ----------
function aiCastScore(p, c, stage) {
  const d = def(c), pl = P(p), o = O(p), opp = P(o);
  const pre = stage === 'pre';
  const lifeO = opp.life;
  const attackersReady = pl.board.filter(canAttack).length;
  const removal = (score) => score >= 2.5 ? score + 1 : 0;
  const N = d.dmgFn ? d.dmgFn(p) : d.dmg;
  const bonus = d.aiBonus || 0;
  switch (d.aiAs || d.id) {
    case 'firebrand_bolt': { const n = N != null ? N : 2; return lifeO <= n ? 100 : removal(bestKill(p, n, true)) + (n >= 3 && lifeO <= n + 4 ? 2 : 0); }
    case 'warpath': return removal(bestKill(p, N != null ? N : 4, true));
    case 'quillstorm': return removal(bestKill(p, runeTotal(p), true));
    case 'flame_volley': { const n = N != null ? N : 1; const v = enemyUnits(p).filter(u => remH(u) <= n).reduce((s, u) => s + uval(u), 0) + bonus; return v >= 3 ? v : 0; }
    case 'kiss_of_the_viper': { const b = bestEnemy(p, d.aiF || (u => mvOf(u) <= 3)); return b && uval(b) >= 3 ? uval(b) + 1 : 0; }
    case 'assassination': { const b = bestEnemy(p, d.aiF || (() => true)); return b && uval(b) >= 4.5 ? uval(b) + 1 - (d.id === 'blood_price' && stats(b).p >= pl.life - 2 ? 99 : 0) : 0; }
    case 'judgment_light': { const b = bestEnemy(p, u => stats(u).p >= 4); return b ? uval(b) + 1 : 0; }
    case 'erase_from_history': { const b = bestEnemy(p, d.aiF || (u => stats(u).p <= 4)); return b && uval(b) >= 4 ? uval(b) : 0; }
    case 'wrath_of_dawn': { const e = enemyUnits(p).filter(u => stats(u).p >= 3).reduce((s, u) => s + uval(u), 0), m = myUnits(p).filter(u => stats(u).p >= 3).reduce((s, u) => s + uval(u), 0); return e - m >= 5 ? e - m : 0; }
    case 'toxic_fog': { const e = enemyUnits(p).filter(u => remH(u) <= 2).reduce((s, u) => s + uval(u), 0), m = myUnits(p).filter(u => remH(u) <= 2).reduce((s, u) => s + uval(u), 0); return e - m >= 3 ? e - m : 0; }
    case 'storm_of_leaving': { const v = enemyUnits(p).filter(u => mvOf(u) <= 3).reduce((s, u) => s + (u.token ? 3 : mvOf(u) * 0.8), 0); return v >= 4 ? v : 0; }
    case 'gust_of_return': { const b = maxBy(enemyUnits(p).filter(u => canTargetSpell(p, u)), u => u.token ? 4 : mvOf(u)); if (!b) return 0; const v = (b.token ? 4 : mvOf(b) * 0.8) + bonus; return v >= 3 ? v : 0; }
    case 'tidal_displacement': { const s = enemyUnits(p).filter(u => canTargetSpell(p, u)).map(u => u.token ? 4 : mvOf(u) * 0.8).sort((a, b) => b - a); const v = (s[0] || 0) + (s[1] || 0); return v >= 4.5 ? v : 0; }
    case 'hunters_pounce': { const mine = maxBy(myUnits(p).filter(u => canTargetSpell(p, u)), u => stats(u).p); if (!mine) return 0; const v = bestKill(p, stats(mine).p, true); return v >= 2.5 ? v + 1 : 0; }
    case 'poisoned_dart': { const v = bestKill(p, 1, true); if (v >= 1.5) return v + 1; return !pre && enemyUnits(p).some(u => !u.marked) && pl.board.concat(pl.relics).some(x => ['nightblade_stalker', 'master_of_whispers', 'thieves_guild_hall'].includes(x.id)) ? 1.2 : 0; }
    case 'battle_cry': return pre ? (attackersReady >= 2 ? 3 : 0) : 1.5;
    case 'final_assault': { if (!pre || !pl.board.length) return 0; const dmg = pl.board.reduce((s, u) => s + Math.max(0, stats(u).p) + 2, 0); return dmg >= lifeO || pl.board.length >= 3 ? 6 : 0; }
    case 'toxic_coating': return pre && attackersReady && enemyUnits(p).some(u => !u.tapped && uval(u) >= 4) ? 2.5 : 0;
    case 'wild_growth': return pl.board.length ? 2.5 : 1.2;
    case 'call_of_the_wild': return pl.board.length >= 2 ? pl.board.length * 2 : 0;
    case 'seed_the_earth': return !pre && pl.well.length < 7 && pl.hand.filter(x => x !== c).length >= 1 ? 2 : 0;
    case 'black_market_deal': return pl.life > 8 ? 3 : 0;
    case 'healing_hymn': return pl.life < 12 ? 4 : 2;
    case 'recall_the_lesson': return pl.well.length >= 6 ? 2.5 : 0.8;
    case 'glimpse_the_pages': case 'study_the_winds': return pre ? 0 : 2;
    case 'ponder_horizon': return pre ? 0 : 4.5;
    case 'chronicles_end': return pre ? 0 : 4.5;
    case 'rally_the_faithful': return pre ? 0 : 2;
    case 'call_to_arms': return pre ? 0 : 3;
    case 'tome_of_binding': { const b = bestEnemy(p, () => true, false); return b && uval(b) >= 3 ? uval(b) : 0; }
    case 'hired_thug': if (pl.life <= 5) return 0; break;
    case 'ravager_captain': if (!enemyUnits(p).length) return pre ? 0 : 2; break;
  }
  const live0 = myUnits(p).length, sum = (list) => list.reduce((s, u) => s + uval(u), 0);
  switch (d.ai) {
    case 'pump': return pre && pl.board.some(u => canAttack(u) || u.sick) ? 2.5 : 0;
    case 'counter': return live0 ? 2.2 : 0;
    case 'buffAll': return /this turn/.test(d.text) ? (pre && attackersReady >= 2 ? 2 + attackersReady : 0) : (live0 >= 2 ? (d.aiVal || 0) + live0 * 1.5 : 0);
    case 'draw': return pre ? 0 : (d.aiVal || 2.5);
    case 'tokens': return pre ? 0 : (d.aiVal || 3);
    case 'tokensPerEnemy': return !pre && enemyUnits(p).length >= 2 ? enemyUnits(p).length * 1.8 : 0;
    case 'ramp': return !pre && pl.well.length < 7 ? (d.aiVal || 2) : 0;
    case 'tap': { const b = bestEnemy(p, u => !u.tapped); return b && uval(b) >= 3 ? uval(b) * 0.6 : 0; }
    case 'discard': return pre ? 0 : 2.5;
    case 'gain': return pre ? 0 : (pl.life < 12 ? 4 : 1);
    case 'massBounce': { const v = sum(enemyUnits(p).filter(u => mvOf(u) <= 2)) - sum(myUnits(p).filter(u => mvOf(u) <= 2)); return v >= 3 ? v : 0; }
    case 'wipeEnemy': { const v = sum(enemyUnits(p)); return v >= 6 ? v : 0; }
    case 'wipeAll': { const v = sum(enemyUnits(p)) - sum(myUnits(p)); return v >= 6 ? v : 0; }
    case 'wipeMarked': { const v = sum(enemyUnits(p).filter(u => u.marked)) - sum(myUnits(p).filter(u => u.marked)); return v >= 4 ? v : 0; }
  }
  if (d.type === 'Relic') return pre ? (d.id === 'warcallers_horn' || d.id === 'hymn_of_valor' ? 3.5 : 0) : 3.5 + (d.id === 'hymn_of_valor' ? pl.board.length * 0.5 : 0);
  if (d.type === 'Unit') {
    const swift = d.kw.includes('swift') || (pl.relics.some(r => r.id === 'warcallers_horn') && pl.lastUnitTurn !== G.turn);
    if (pre && !swift) return 0;
    if (d.kw.includes('ambush')) {
      // keep Ambush units for the opponent's attack unless the hand is full
      if (pl.hand.length < 7) return 0;
    }
    return 3 + d.mv * 1.1 + dval(d) * 0.2;
  }
  if (d.type === 'Spell') return pre ? 0 : 2;
  return 0;
}
function aiBestCast(p, L, stage) {
  const pl = P(p);
  const cands = [...L.cast.map(u => ({ uid: u, type: 'cast' })), ...L.wellcast.map(u => ({ uid: u, type: 'wellcast' }))];
  let best = null, bv = 0;
  for (const c of cands) {
    const card = findUid(c.uid); if (!card) continue;
    let s = aiCastScore(p, card, stage);
    if (c.type === 'wellcast') { if (pl.well.length < 7 && !def(card).fromWell) s = 0; else s -= 0.5; }
    s += def(card).mv * 0.05;
    if (s > bv) { bv = s; best = c; }
  }
  return best;
}
function aiKeepScore(p, c) {
  const d = def(c), pl = P(p);
  if (d.type === 'Mana') return pl.well.length >= 7 ? -1 : 50;
  const castable = d.mv <= pl.well.length + 2;
  return dval(d) + (castable ? 1.5 : 0) - (d.mv >= 6 && pl.well.length < 4 ? 2 : 0) + (pl.hand.filter(x => x.id === c.id).length > 1 ? -0.7 : 0);
}
function aiSacrifice(p) {
  const pl = P(p);
  const spells = pl.hand.filter(c => def(c).type !== 'Mana');
  if (spells.length < 2) return null;
  const maxNeed = Math.max(...spells.map(c => def(c).mv));
  if (pl.well.length >= 6 || pl.well.length >= maxNeed + 1) return null;
  return minBy(spells, c => aiKeepScore(p, c));
}

// ---------- combat ----------
function withAttacking(units, fn) {
  const was = units.map(u => u.attacking); units.forEach(u => u.attacking = true);
  try { return fn(); } finally { units.forEach((u, i) => u.attacking = was[i]); }
}
function aiPlanAttack(p) {
  const o = O(p), me = P(p), opp = P(o);
  let atk = me.board.filter(canAttack).filter(u => stats(u).p > 0);
  if (!atk.length) return [];
  const blockers = opp.board.filter(b => !b.tapped && !isBound(b));
  const guards = opp.board.filter(u => hasKw(u, 'guard'));
  G.aiGuard = {};
  if (guards.length) {
    const plan = [];
    withAttacking(atk, () => {
      for (const a of atk) {
        const good = guards.filter(g => kills(a, g) && (!kills(g, a) || uval(g) >= uval(a) - 0.5));
        if (good.length) { const g = maxBy(good, x => uval(x) - (kills(x, a) ? uval(a) : 0)); plan.push(a); G.aiGuard[a.uid] = g.uid; }
        else if (!guards.some(g => kills(g, a))) { plan.push(a); G.aiGuard[a.uid] = minBy(guards, g => remH(g)).uid; }
      }
    });
    return plan.map(u => u.uid);
  }
  // lethal check: opponent blocks our biggest blockable attackers
  const lethal = withAttacking(atk, () => {
    const pw = atk.map(u => ({ u, p: powerOf(u) })).sort((a, b) => b.p - a.p);
    const used = new Set(); let dmg = 0;
    for (const x of pw) {
      const b = blockers.find(b => !used.has(b) && canBlock(b, x.u));
      if (b) used.add(b); else dmg += x.p;
    }
    return dmg >= opp.life;
  });
  if (lethal) return atk.map(u => u.uid);
  let plan = withAttacking(atk, () => atk.filter(a => {
    const bs = blockers.filter(b => canBlock(b, a));
    if (!bs.length) return true;
    return !bs.some(b => kills(b, a) && (!kills(a, b) || uval(b) < uval(a) - 0.5));
  }));
  // keep enough defenders home: our attackers stay tapped during the opponent's turn
  const oppThreat = opp.board.map(u => Math.max(0, stats(u).p)).sort((a, b) => b - a);
  const keep = () => me.board.filter(u => !plan.includes(u) && !u.tapped);
  const danger = () => { const k = keep().length; return oppThreat.slice(k).reduce((s, x) => s + x, 0) + (opp.hand.length ? 2 : 0); };
  while (plan.length && danger() >= me.life) {
    const drop = maxBy(plan, u => remH(u) - powerOf(u) * 0.5);
    plan = plan.filter(u => u !== drop);
  }
  return plan.map(u => u.uid);
}
function aiBlocks(q) {
  const p = q.who, me = P(p);
  const atks = q.attackers.map(findUid).filter(Boolean).sort((a, b) => powerOf(b) - powerOf(a));
  const res = {}, used = new Set();
  const avail = a => (q.pairs[a.uid] || []).map(findUid).filter(b => b && !used.has(b.uid));
  for (const a of atks) {
    let best = null, bs = 0.4;
    for (const b of avail(a)) {
      const k = kills(b, a), d = kills(a, b);
      let s = (k ? uval(a) : 0) - (d ? uval(b) : 0) + (!d ? 0.4 + Math.min(powerOf(a), 3) * 0.2 : 0);
      if (!k && !d && powerOf(a) === 0) s = 0;
      if (s > bs) { bs = s; best = b; }
    }
    if (best) { res[a.uid] = best.uid; used.add(best.uid); }
  }
  const unblocked = () => atks.filter(a => !res[a.uid]).reduce((s, a) => s + powerOf(a), 0);
  // survive: chump the biggest hits if we would die
  for (const a of atks) {
    if (unblocked() < me.life) break;
    if (res[a.uid]) continue;
    const b = minBy(avail(a), uval);
    if (b) { res[a.uid] = b.uid; used.add(b.uid); }
  }
  // under heavy pressure, take even trades
  if (unblocked() >= me.life * 0.5) {
    for (const a of atks) {
      if (res[a.uid]) continue;
      const b = maxBy(avail(a).filter(b => kills(b, a) && uval(b) <= uval(a) + 1), b => uval(a) - uval(b));
      if (b) { res[a.uid] = b.uid; used.add(b.uid); }
    }
  }
  return res;
}

// ---------- reactions ----------
function aiReactScore(p, c, kind) {
  const d = def(c), opp = O(p), me = P(p);
  const atk = allUnits().filter(u => u.attacking && u.ctrl === opp);
  const incoming = atk.reduce((s, u) => s + powerOf(u), 0);
  const danger = incoming >= me.life ? 6 : incoming >= me.life * 0.5 ? 2 : 0;
  G.aiPlan = [];
  if (kind === 'cast') {
    const x = G.cur; if (!x) return 0;
    const sd = x.d, targetsMine = tUnits(x).filter(u => u.ctrl === p);
    const hurt = targetsMine.length ? Math.max(...targetsMine.map(uval)) : 0;
    const worth = Math.max(hurt, sd.type === 'Unit' ? dval(sd) * 0.6 : sd.mv * 1.1);
    switch (d.aiAs || d.id) {
      case 'counterwind': return worth >= 4.5 ? worth : 0;
      case 'second_thoughts': return worth >= 2.5 ? worth : 0;
      case 'unwritten_answer': { const left = pool(opp).length; return left < 2 && worth >= 3.5 ? worth : 0; }
      case 'sanctuary_ward': return hurt >= 2 ? hurt + 1 : 0;
    }
    return 0;
  }
  const best = (list, f) => { const u = maxBy(list.filter(u => canTargetSpell(p, u)), f); if (u) G.aiPlan = [u.uid]; return u; };
  const N = d.dmgFn ? d.dmgFn(p) : (d.dmg != null ? d.dmg : 2);
  switch (d.ai) {
    case 'sweepAttackers': { const v = atk.filter(u => remH(u) <= N).reduce((s, u) => s + uval(u), 0); return v >= 2.5 ? v + danger : 0; }
    case 'fogAll': return danger >= 2 ? incoming * 0.8 + danger : 0;
    case 'killAllAttackers': { const v = atk.reduce((s, u) => s + uval(u), 0); return v >= 5 || danger >= 6 ? v + danger : 0; }
  }
  switch (d.aiAs || d.id) {
    case 'sudden_riposte': { const u = best(atk.filter(u => remH(u) <= N), uval); return u ? uval(u) + 0.5 : (danger ? (best(atk, powerOf) ? danger : 0) : 0); }
    case 'trapdoor': { const u = best(atk.filter(d.aiF || (u => stats(u).p <= 2)), uval); return u ? uval(u) + 0.5 + danger * 0.3 - (d.id === 'ambush_strike' ? 3 : 0) : 0; }
    case 'snapping_vines': { const u = best(atk.filter(u => hasKw(u, 'flying')), uval); return u ? uval(u) + 1 : 0; }
    case 'misdirect': { const u = best(atk.filter(d.aiF || (() => true)), u => u.token ? 5 : mvOf(u) + powerOf(u) * 0.3); return u ? (u.token ? 4 : mvOf(u) * 0.7) + danger : 0; }
    case 'smoke_bomb': { const u = best(atk, powerOf); return u && (powerOf(u) >= 4 || danger) ? powerOf(u) * 0.8 + danger : 0; }
    case 'glyph_of_hesitation': { const u = best(atk, powerOf); return u && (powerOf(u) >= 4 || danger) ? 2 + danger * 0.5 : 0; }
    case 'stand_and_fight': case 'sudden_bloom': {
      const bp = d.bp != null ? d.bp : 2, bh = d.bh != null ? d.bh : (d.id === 'stand_and_fight' ? 1 : 2);
      let bv = 0, pick = null;
      for (const b of me.board.filter(b => !b.tapped && !isBound(b))) for (const a of atk) {
        if (!canBlock(b, a)) continue;
        const nowGood = kills(b, a) && !kills(a, b);
        const after = (powerOf(b) + bp >= remH(a) || hasKw(b, 'venom')) && !(powerOf(a) >= remH(b) + bh || hasKw(a, 'venom'));
        if (after && !nowGood && uval(a) > bv) { bv = uval(a); pick = b; }
      }
      if (pick) G.aiPlan = [pick.uid];
      return bv ? bv : 0;
    }
    case 'last_stand': return me.board.filter(b => !b.tapped).length >= 2 && atk.length ? 3 + danger : 0;
  }
  if (d.id === 'last_stand' || d.aiAs === 'last_stand') return me.board.filter(b => !b.tapped).length >= 2 && atk.length ? 3 + danger : 0;
  if (d.type === 'Unit' && d.kw.includes('ambush')) {
    let bv = 0;
    for (const a of atk) {
      if (hasKw(a, 'flying') || hasKw(a, 'unblockable')) continue;
      const k = d.kw.includes('venom') || d.p >= remH(a), dies = powerOf(a) >= d.h || hasKw(a, 'venom');
      const v = (k ? uval(a) : 0) - (dies ? dval(d) * 0.5 : 0) + (!dies ? 1 : 0);
      bv = Math.max(bv, v);
    }
    if (d.id === 'master_of_whispers' && allUnits().some(u => u.marked && u.ctrl === opp)) bv += 4;
    if (d.id === 'nightblade_stalker' && allUnits().some(u => u.marked && u.ctrl === opp && remH(u) <= 2)) bv += 3;
    return bv + 1 + danger * 0.5;
  }
  return 0;
}

// ---------- targeting ----------
let AI_NAMES = null;
const AI_TARGET = {
  harm: { 'Firebrand Bolt': 2, 'Emberhorn Dragon': 2, 'Ravager Captain': 2, 'Sudden Riposte': 2, 'Nightblade Stalker': 2, 'Nyra Vesk': 2, 'Warpath': 4, 'Poisoned Dart': 1 },
  destroy: ['Kiss of the Viper', 'Assassination', 'Judgment Light', 'Master of Whispers', 'Trapdoor', 'Snapping Vines', 'Tome of Binding', 'Erase from History', 'Quillstorm', 'Thunderhead Roc'],
  bounce: ['Gust of Return', 'Misdirect', 'Tidal Displacement', 'Sky-Sail Privateer'],
  debuff: ['Glyph of Hesitation', 'Smoke Bomb'],
  own: ['Stand and Fight', 'Sudden Bloom', 'Korga', 'Toxic Coating', 'War Drummer', 'Wild Growth', 'Thicket Stalker', 'Deeproot Druid', 'Mother Bramblewood'],
};
function aiPick(q) {
  const p = q.who, o = O(p);
  const cands = q.uids.map(findUid).filter(Boolean);
  const enemies = cands.filter(u => u.ctrl === o && u.board !== undefined || (u.ctrl === o));
  const mine = cands.filter(u => u.ctrl === p);
  const name0 = q.prompt.split(':')[0];
  if (!AI_NAMES) { AI_NAMES = {}; for (const x of Object.values(DEFS)) AI_NAMES[x.name] = x; }
  const dd = AI_NAMES[name0];
  const name = dd && dd.aiAs ? DEFS[dd.aiAs].name : name0;
  const dm = q.prompt.match(/deal (\d+) damage/);
  // a target chosen in advance when the card was played
  if (G.aiPlan && G.aiPlan.length) { const t = G.aiPlan.find(id => q.uids.includes(id)); if (t != null) { G.aiPlan = G.aiPlan.filter(x => x !== t); return { uid: t }; } }
  if (name.startsWith('Guard')) {
    const e = G.combat && G.combat.list.find(x => x.guard == null);
    const pref = e && G.aiGuard && G.aiGuard[e.a];
    if (pref && q.uids.includes(pref)) return { uid: pref };
    const a = e && findUid(e.a);
    const g = a ? (maxBy(cands.filter(g => kills(a, g) && !kills(g, a)), uval) || minBy(cands, g => powerOf(g))) : cands[0];
    return { uid: g.uid };
  }
  if (name === 'Inscribe') { const r = maxBy(mine, u => (def(u).runeP || def(u).runePH ? 5 : 0) + (u.chapter ? -2 : 0)); return r ? { uid: r.uid } : (q.optional ? null : { uid: q.uids[0] }); }
  if (name0.startsWith("Navigator")) return null;
  if (name === "Hunter's Pounce") {
    if (q.prompt.includes('your unit')) { const u = maxBy(mine, x => stats(x).p); G.aiPounce = u ? stats(u).p : 0; return { uid: u.uid }; }
    const k = maxBy(enemies.filter(u => remH(u) <= (G.aiPounce || 0)), uval) || maxBy(enemies, uval);
    return { uid: (k || cands[0]).uid };
  }
  if (name === 'Tidal Displacement') {
    const t = maxBy(enemies, u => u.token ? 9 : mvOf(u));
    if (t) return { uid: t.uid };
    return q.optional ? null : { uid: minBy(mine, uval).uid };
  }
  const harm = dm ? +dm[1] : (AI_TARGET.harm[name] || (name === 'Quillstorm' ? runeTotal(p) : null));
  if (harm != null && !AI_TARGET.destroy.includes(name) && !(dd && dd.aiT === 'destroy')) {
    if (q.players && q.players.includes(o) && P(o).life <= harm) return { p: o };
    const k = maxBy(enemies.filter(u => remH(u) <= harm), uval);
    if (k) return { uid: k.uid };
    if (q.players && q.players.includes(o)) return { p: o };
    const e = maxBy(enemies, uval); if (e) return { uid: e.uid };
    if (q.optional) return null;
    const m = minBy(mine, uval); return m ? { uid: m.uid } : (q.players && q.players.length ? { p: o } : null);
  }
  if (AI_TARGET.own.includes(name) || (dd && (dd.ai === 'pump' || dd.ai === 'counter')) || /(a|another) unit you control/.test(q.prompt)) {
    const m = maxBy(mine, u => (u.attacking ? 3 : 0) + (u.sick && name === 'Korga' ? 4 : 0) + powerOf(u) + uval(u) * 0.3);
    if (m) return { uid: m.uid };
    if (q.optional) return null;
    return { uid: minBy(cands, uval).uid };
  }
  if (AI_TARGET.debuff.includes(name)) { const a = maxBy(enemies, powerOf); return { uid: (a || cands[0]).uid }; }
  // default: hurt the most valuable enemy (destroy, bounce, mark, bind, tap)
  const bounce = AI_TARGET.bounce.includes(name);
  const e = maxBy(enemies, u => uval(u) + (bounce && u.token ? 4 : 0) + (u.marked ? -2 : 0));
  if (e) return { uid: e.uid };
  if (q.optional) return null;
  const m = minBy(mine, uval);
  return m ? { uid: m.uid } : (q.players && q.players.length ? { p: q.players[0] } : null);
}

// ---------- hero powers ----------
function aiUsePower(p, stage) {
  const pl = P(p), f = pl.fac, aw = pl.hero.awakened;
  if (f === 'Warbound') return stage === 'pre' && pl.board.some(u => u.sick || canAttack(u));
  if (stage === 'pre') return false;
  if (f === 'Farstrider') return true;
  if (f === 'Wildborn') return pl.board.length > 0;
  if (f === 'Shadowmarked') return aw ? enemyUnits(p).some(u => u.marked && remH(u) <= 2) : enemyUnits(p).some(u => !u.marked);
  if (f === 'Oathsong') return true;
  if (f === 'Lorebound') return loreCards(p).some(c => def(c).runeP || def(c).runePH);
  return false;
}

// ---------- main entry ----------
function aiMain(q) {
  const p = q.who, pl = P(p), L = legalMain(p);
  if (G.aiTurn !== G.turn) { G.aiTurn = G.turn; G.aiStage = 'pre'; }
  if (L.well.length) {
    const m = pl.hand.find(c => def(c).type === 'Mana');
    if (m) return { type: 'well', uid: m.uid };
    const s = aiSacrifice(p); if (s) return { type: 'well', uid: s.uid };
  }
  if (G.aiStage === 'pre') {
    const b = aiBestCast(p, L, 'pre'); if (b) { G.aiPlan = []; return b; }
    if (L.power && aiUsePower(p, 'pre')) return { type: 'power' };
    G.aiStage = 'attack';
  }
  if (G.aiStage === 'attack') {
    G.aiStage = 'post';
    if (L.attack) { G.aiAttack = aiPlanAttack(p); if (G.aiAttack.length) return { type: 'attack' }; }
  }
  const b = aiBestCast(p, L, 'post'); if (b) { G.aiPlan = []; return b; }
  if (L.power && aiUsePower(p, 'post')) return { type: 'power' };
  return { type: 'end' };
}
function aiCards(q) {
  const p = q.who, pl = P(p), pr = q.prompt;
  let ranked;
  if (pr.startsWith("Navigator")) { const c = q.cards[0]; return def(c).type === 'Mana' && pl.well.length >= 6 ? [c] : []; }
  if (pr.startsWith('Discard')) ranked = [...q.cards].sort((a, b) => aiKeepScore(p, a) - aiKeepScore(p, b));
  else if (pr.includes('into your Well')) {
    ranked = [...q.cards].sort((a, b) => aiKeepScore(p, a) - aiKeepScore(p, b));
    const m = q.cards.find(c => def(c).type === 'Mana'); if (m) ranked = [m, ...ranked.filter(c => c !== m)];
    if (q.min === 0 && pl.well.length >= 7) return [];
  } else ranked = [...q.cards].sort((a, b) => aiCastScore(p, b, 'post') + dval(def(b)) * 0.3 - (aiCastScore(p, a, 'post') + dval(def(a)) * 0.3));
  return ranked.slice(0, Math.max(q.min, Math.min(q.max, 1)));
}
function aiOrder(q) {
  const p = q.who, pl = P(p);
  const wantMana = pl.well.length < 5 && !pl.hand.some(c => def(c).type === 'Mana');
  return [...q.cards].sort((a, b) => score(b) - score(a));
  function score(c) { const d = def(c); if (d.type === 'Mana') return wantMana ? 10 : (pl.well.length >= 6 ? -5 : 1); return dval(d) * 0.4 + (d.mv <= pl.well.length + 1 ? 3 : 0); }
}
function aiAnswer(q) {
  // Normal difficulty sometimes makes a casual choice
  const lvl = Array.isArray(G.level) ? G.level[q.who] : G.level;
  if (lvl === 'normal' && ['main', 'attack', 'block', 'react'].includes(q.kind) && RNG() < 0.25) {
    const r = randomAnswer(q); if (r !== undefined) return r;
  }
  switch (q.kind) {
    case 'main': return aiMain(q);
    case 'attack': { const plan = (G.aiAttack || []).filter(u => q.cands.includes(u)); return plan.length ? plan : q.cands.filter(u => powerOf(findUid(u)) > 0).slice(0, 1); }
    case 'block': return aiBlocks(q);
    case 'react': {
      let best = null, bv = 2;
      for (const uid of q.cards) { const c = findUid(uid); const s = aiReactScore(q.who, c, q.prompt.includes('is casting') ? 'cast' : 'attack'); if (s > bv) { bv = s; best = uid; } }
      if (best != null) aiReactScore(q.who, findUid(best), q.prompt.includes('is casting') ? 'cast' : 'attack');
      return best;
    }
    case 'pick': return aiPick(q);
    case 'buttons': {
      if (q.options[0][0] === 'Keep hand') { const m = P(q.who).hand.filter(c => def(c).type === 'Mana').length; return m === 0 || m >= 5; }
      return q.options[0][1];
    }
    case 'cards': return aiCards(q);
    case 'order': return aiOrder(q);
    default: return undefined;
  }
}
function randomAnswer(q) {
  const R = a => a[Math.floor(RNG() * a.length)];
  if (q.kind === 'main') { const L = legalMain(q.who); const acts = [...L.cast.map(u => ({ type: 'cast', uid: u })), ...(L.attack ? [{ type: 'attack' }] : [])]; if (!acts.length) return undefined; G.aiAttack = q.who != null ? P(q.who).board.filter(canAttack).map(u => u.uid) : []; return R(acts); }
  if (q.kind === 'react') return null;
  if (q.kind === 'block') return {};
  if (q.kind === 'attack') return q.cands.filter(() => RNG() < 0.5);
  return undefined;
}
