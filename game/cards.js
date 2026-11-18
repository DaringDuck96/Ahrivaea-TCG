// ================= CARD DATA =================
const FAC = {
  Warbound:     { s: '⚔️', c: '#b8412f' },
  Farstrider:   { s: '🧭', c: '#3170c4' },
  Wildborn:     { s: '🌿', c: '#2b8a4f' },
  Shadowmarked: { s: '💀', c: '#55546a' },
  Oathsong:     { s: '🕊️', c: '#c4961c' },
  Lorebound:    { s: '📜', c: '#8a48ab' },
};
const DEFS = {};
let F = '';
function C(id, name, type, g, pips, p, h, text, x) {
  DEFS[id] = Object.assign({ id, name, fac: F, type, g, pips, mv: g + pips, p, h, text, kw: [] }, x || {});
}
const TOK = {
  squire:    { name: 'Squire', fac: 'Oathsong', type: 'Unit', p: 1, h: 1, g: 0, pips: 0, mv: 0, token: true, text: 'A token created by an Oathsong card.', kw: [] },
  illusion:  { name: 'Illusion', fac: 'Farstrider', type: 'Unit', p: 2, h: 2, g: 0, pips: 0, mv: 0, token: true, text: 'When this is targeted by a spell or Reaction, destroy it.', kw: ['illusion'] },
  construct: { name: 'Lore Construct', fac: 'Lorebound', type: 'Unit', p: 3, h: 3, g: 0, pips: 0, mv: 0, token: true, text: 'A token created by Saga of the Sunken Library.', kw: [] },
};

// shared helpers used by card effects
const attackingFilter = u => u.attacking;
const own = p => u => u.ctrl === p;
const enemy = p => u => u.ctrl !== p;
const tgtUnit = (filter, prompt) => async (p, x) => { x.t.a = await pickUnit(p, filter(p), prompt, { src: x.d }); };
const live = u => u && inPlay(u);

// ---------------- WARBOUND ----------------
F = 'Warbound';
C('bloodied_recruit', 'Bloodied Recruit', 'Unit', 0, 1, 2, 1, '');
C('war_drummer', 'War Drummer', 'Unit', 0, 1, 1, 1, 'Whenever you attack, another attacking unit gets +1 Power this turn.', {
  onAnyAttack: async (p, u) => { const t = await pickUnit(p, v => v !== u && v.ctrl === p && v.attacking, 'War Drummer: give another attacking unit +1 Power.'); if (t) t.tp += 1; } });
C('firebrand_bolt', 'Firebrand Bolt', 'Spell', 0, 1, null, null, 'Deal 2 damage to any unit or player.', {
  tgt: async (p, x) => { x.t.a = await pickAny(p, () => true, 'Firebrand Bolt: choose a unit or player.', { src: x.d }); },
  res: async (p, x) => { await hitAny(x.t.a, 2, { p }); } });
C('raider_outrider', 'Raider Outrider', 'Unit', 1, 1, 2, 2, 'Swift', { kw: ['swift'] });
C('shieldbreaker_brute', 'Shieldbreaker Brute', 'Unit', 1, 1, 3, 1, '');
C('pit_fighter', 'Pit Fighter', 'Unit', 1, 1, 2, 2, 'Gets +1 Power while attacking.');
C('battle_cry', 'Battle Cry', 'Spell', 1, 1, null, null, 'Units you control get +1 Power this turn. Draw a card.', {
  res: async p => { P(p).board.forEach(u => u.tp += 1); await draw(p, 1); } });
C('sudden_riposte', 'Sudden Riposte', 'Reaction', 1, 1, null, null, 'Play when your opponent declares attackers. Deal 2 damage to an attacking unit.', {
  when: 'attack', tgt: tgtUnit(() => attackingFilter, 'Sudden Riposte: choose an attacking unit.'),
  res: async (p, x) => { if (live(x.t.a)) dmgUnit(x.t.a, 2, { p }); } });
C('stand_and_fight', 'Stand and Fight', 'Reaction', 1, 1, null, null, 'Play when your opponent declares attackers. A unit you control gets +2 Power and +1 Health this turn.', {
  when: 'attack', can: p => P(p).board.length > 0, tgt: tgtUnit(own, 'Stand and Fight: choose a unit you control.'),
  res: async (p, x) => { if (live(x.t.a)) { x.t.a.tp += 2; x.t.a.th += 1; } } });
C('banner_sergeant', 'Banner Sergeant', 'Unit', 2, 1, 3, 3, 'Your other units get +1 Power while attacking.');
C('ashblade_duelist', 'Ashblade Duelist', 'Unit', 2, 1, 3, 2, 'Swift', { kw: ['swift'] });
C('warcallers_horn', "Warcaller's Horn", 'Relic', 2, 1, null, null, 'The first unit you cast each turn has Swift.');
C('flame_volley', 'Flame Volley', 'Spell', 2, 1, null, null, 'Deal 1 damage to each enemy unit.', {
  res: async p => { [...P(O(p)).board].forEach(u => dmgUnit(u, 1, { p })); } });
C('iron_tusk_charger', 'Iron-Tusk Charger', 'Unit', 3, 1, 4, 3, 'Whenever this attacks, deal 1 damage to the defending player.', {
  onAttack: async (p, u) => { await dmgPlayer(O(p), 1, { unit: u }); } });
C('ravager_captain', 'Ravager Captain', 'Unit', 2, 2, 4, 4, 'When this enters play, deal 2 damage to a unit.', {
  enter: async (p, u) => { const t = await pickUnit(p, v => v !== u, 'Ravager Captain: deal 2 damage to a unit.'); if (t) dmgUnit(t, 2, { p }); } });
C('warpath', 'Warpath', 'Spell', 3, 1, null, null, 'Deal 4 damage to a unit.', {
  can: () => allUnits().length > 0, tgt: tgtUnit(() => () => true, 'Warpath: choose a unit.'),
  res: async (p, x) => { if (live(x.t.a)) dmgUnit(x.t.a, 4, { p }); } });
C('skyfire_wyvern', 'Skyfire Wyvern', 'Unit', 3, 1, 3, 2, 'Flying, Swift', { kw: ['flying', 'swift'] });
C('siegebreaker_ogre', 'Siegebreaker Ogre', 'Unit', 4, 1, 5, 5, "Can't be blocked by units with 2 or less Power.");
C('final_assault', 'Final Assault', 'Spell', 3, 2, null, null, 'Units you control get +2 Power and Swift this turn.', {
  res: async p => { P(p).board.forEach(u => { u.tp += 2; u.tkw.push('swift'); }); } });
C('emberhorn_dragon', 'Emberhorn Dragon', 'Unit', 4, 2, 6, 5, 'Flying. When this enters play, deal 2 damage to any unit or player.', {
  kw: ['flying'], enter: async (p, u) => { const t = await pickAny(p, v => v !== u, 'Emberhorn Dragon: deal 2 damage to a unit or player.'); await hitAny(t, 2, { p }); } });

// ---------------- LOREBOUND ----------------
F = 'Lorebound';
C('apprentice_scribe', 'Apprentice Scribe', 'Unit', 0, 1, 1, 2, 'When this enters play, Prophecy 2.', { enter: async p => prophecy(p, 2) });
C('glyph_of_hesitation', 'Glyph of Hesitation', 'Reaction', 0, 1, null, null, 'Play when your opponent declares attackers. An attacking unit gets -2 Power this turn.', {
  when: 'attack', tgt: tgtUnit(() => attackingFilter, 'Glyph of Hesitation: choose an attacking unit.'),
  res: async (p, x) => { if (live(x.t.a)) x.t.a.tp -= 2; } });
C('inkbound_familiar', 'Inkbound Familiar', 'Unit', 1, 1, 1, 3, 'When this enters play, Inscribe it. Gets +1 Power for each rune counter on it.', {
  runeP: true, enter: async (p, u) => { u.runes += 1; } });
C('wellspring_seeker', 'Wellspring Seeker', 'Unit', 1, 1, 2, 2, 'Gets +1 Power and +1 Health while you have 5 or more cards in your Well.');
C('archive_sentinel', 'Archive Sentinel', 'Unit', 1, 1, 0, 4, 'Guard. At the start of your turn, Inscribe this. Gets +1 Power for each rune counter on it.', {
  kw: ['guard'], runeP: true, startTurn: async (p, u) => { u.runes += 1; } });
C('glimpse_the_pages', 'Glimpse the Pages', 'Spell', 1, 1, null, null, 'Prophecy 3, then draw a card.', {
  res: async p => { await prophecy(p, 3); await draw(p, 1); } });
C('the_first_chapter', 'The First Chapter', 'Relic', 1, 1, null, null, 'Chapter I: Prophecy 2. Chapter II: Draw a card. Chapter III: Inscribe twice, then put this card into your Well.', {
  chapters: [async p => prophecy(p, 2), async p => draw(p, 1), async (p, r) => { await inscribe(p, 2); relicToWell(r); }] });
C('unwritten_answer', 'Unwritten Answer', 'Reaction', 1, 1, null, null, 'Play when your opponent casts a spell. Cancel it unless they pay 2 more mana.', {
  when: 'cast', res: async (p, x) => {
    const w = x.w, c = O(p);
    if (canAfford(c, { g: 2, pips: 0, fac: P(c).fac })) {
      const r = await ask({ kind: 'buttons', who: c, prompt: `Unwritten Answer: pay 2 more mana to keep ${nm(w.d.name)}?`, options: [['Pay 2', true], ["Don't pay", false]] });
      if (r) { pay(c, { g: 2, pips: 0, fac: P(c).fac }); log(`${esc(P(c).name)} pays 2 to keep ${nm(w.d.name)}.`); return; }
    }
    w.cancelled = true;
  } });
C('runecarver_adept', 'Runecarver Adept', 'Unit', 2, 1, 2, 3, 'Whenever you cast a spell, Inscribe.');
C('recall_the_lesson', 'Recall the Lesson', 'Spell', 2, 1, null, null, 'Return a card from your Well to your hand. Draw a card.', {
  res: async p => {
    const pl = P(p);
    const c = await chooseCards(p, pl.well, 'Recall the Lesson: return a card from your Well to your hand.', 1, 1);
    if (c[0]) { pl.well.splice(pl.well.indexOf(c[0]), 1); c[0].tapped = false; pl.hand.push(c[0]); }
    await draw(p, 1);
  } });
C('tome_of_binding', 'Tome of Binding', 'Relic', 2, 1, null, null, "Chapter I: Choose an enemy unit. It can't attack or block while this is in play. Chapter II: Prophecy 1. Chapter III: Destroy the chosen unit, then put this card into your Well.", {
  chapters: [
    async (p, r) => { const t = await pickUnit(p, enemy(p), 'Tome of Binding: choose an enemy unit to bind.'); if (t) { r.data.bound = t.uid; log(`${nm(def(t).name)} is bound.`); } },
    async p => prophecy(p, 1),
    async (p, r) => { const t = findUid(r.data.bound); if (t && inPlay(t)) { log(`Tome of Binding destroys ${nm(def(t).name)}.`); await destroy(t); } relicToWell(r); },
  ] });
C('well_drinker_sage', 'Well-Drinker Sage', 'Unit', 2, 1, 2, 2, 'You may cast this from your Well. When this enters play, draw a card.', {
  fromWell: true, enter: async p => draw(p, 1) });
C('quillstorm', 'Quillstorm', 'Spell', 2, 1, null, null, 'Deal damage to a unit equal to the number of rune counters on cards you control.', {
  can: () => allUnits().length > 0, tgt: tgtUnit(() => () => true, 'Quillstorm: choose a unit.'),
  res: async (p, x) => { if (live(x.t.a)) dmgUnit(x.t.a, runeTotal(p), { p }); } });
C('glyphwarden_golem', 'Glyphwarden Golem', 'Unit', 3, 1, 3, 5, 'When this enters play, Inscribe it twice. Gets +1 Power for each rune counter on it.', {
  runeP: true, enter: async (p, u) => { u.runes += 2; } });
C('saga_sunken_library', 'Saga of the Sunken Library', 'Relic', 3, 1, null, null, 'Chapter I: Draw 2 cards. Chapter II: Put the top 2 cards of your deck into your Well. Chapter III: Create a 3/3 Lore Construct unit, then put this card into your Well.', {
  chapters: [async p => draw(p, 2), async p => topToWell(p, 2), async (p, r) => { await mkToken(p, 'construct'); relicToWell(r); }] });
C('erase_from_history', 'Erase from History', 'Spell', 3, 1, null, null, "Put an enemy unit with 4 or less Power into its owner's Well.", {
  can: p => P(O(p)).board.some(u => stats(u).p <= 4), tgt: tgtUnit(p => u => u.ctrl !== p && stats(u).p <= 4, 'Erase from History: choose an enemy unit with 4 or less Power.'),
  res: async (p, x) => { if (live(x.t.a) && stats(x.t.a).p <= 4) { log(`${nm(def(x.t.a).name)} is erased into a Well.`); unitToWell(x.t.a); } } });
C('stargazer_oracle', 'Stargazer Oracle', 'Unit', 2, 2, 3, 4, 'Flying. When this enters play, Prophecy 3.', { kw: ['flying'], enter: async p => prophecy(p, 3) });
C('keeper_of_pages', 'Keeper of Ten Thousand Pages', 'Unit', 4, 1, 4, 5, 'Gets +1 Power and +1 Health for every 3 cards in your Well.');
C('chronicles_end', "Chronicle's End", 'Spell', 3, 2, null, null, 'Draw 2 cards, then Inscribe each Lorebound card you control.', {
  res: async p => { await draw(p, 2); loreCards(p).forEach(c => c.runes += 1); } });
C('living_codex', 'The Living Codex', 'Unit', 4, 2, 5, 5, 'When this enters play, you may cast a Spell from your Well without paying its cost. Gets +1 Power and +1 Health for each rune counter on it.', {
  runePH: true, enter: async p => {
    const sp = P(p).well.filter(c => def(c).type === 'Spell' && (!def(c).can || def(c).can(p)));
    if (!sp.length) return;
    const c = await chooseCards(p, sp, 'The Living Codex: you may cast a Spell from your Well for free.', 0, 1);
    if (c[0]) await castCard(p, c[0], { fromWell: true, free: true });
  } });

// ---------------- FARSTRIDER ----------------
F = 'Farstrider';
C('cloud_scout', 'Cloud Scout', 'Unit', 0, 1, 1, 1, 'Flying', { kw: ['flying'] });
C('phantom_duelist', 'Phantom Duelist', 'Unit', 0, 1, 2, 2, 'When this is targeted by a spell or Reaction, destroy it.', { kw: ['illusion'] });
C('second_thoughts', 'Second Thoughts', 'Reaction', 0, 1, null, null, 'Play when your opponent casts a spell. Cancel it if its mana value is 2 or less.', {
  when: 'cast', can: (p, w) => w && w.d.mv <= 2, res: async (p, x) => { x.w.cancelled = true; } });
C('windward_courier', 'Windward Courier', 'Unit', 1, 1, 1, 1, 'Flying. When this enters play, draw a card.', { kw: ['flying'], enter: async p => draw(p, 1) });
C('skyhook_corsair', 'Skyhook Corsair', 'Unit', 1, 1, 2, 1, 'Flying', { kw: ['flying'] });
C('gust_of_return', 'Gust of Return', 'Spell', 1, 1, null, null, "Return a unit to its owner's hand.", {
  can: () => allUnits().length > 0, tgt: tgtUnit(() => () => true, 'Gust of Return: choose a unit.'),
  res: async (p, x) => { if (live(x.t.a)) bounce(x.t.a); } });
C('misdirect', 'Misdirect', 'Reaction', 1, 1, null, null, "Play when your opponent declares attackers. Return an attacking unit to its owner's hand.", {
  when: 'attack', tgt: tgtUnit(() => attackingFilter, 'Misdirect: choose an attacking unit.'),
  res: async (p, x) => { if (live(x.t.a)) bounce(x.t.a); } });
C('wandering_cartographer', 'Wandering Cartographer', 'Unit', 1, 1, 1, 3, 'Whenever you cast a Reaction, draw a card.');
C('study_the_winds', 'Study the Winds', 'Spell', 1, 1, null, null, 'Draw 2 cards, then discard a card.', { res: async p => { await draw(p, 2); await discard(p, 1); } });
C('veilstep_rogue', 'Veilstep Rogue', 'Unit', 2, 1, 2, 2, "Can't be blocked.", { kw: ['unblockable'] });
C('stormglass_seer', 'Stormglass Seer', 'Unit', 2, 1, 2, 2, 'Flying. When this enters play, draw a card.', { kw: ['flying'], enter: async p => draw(p, 1) });
C('counterwind', 'Counterwind', 'Reaction', 1, 2, null, null, 'Play when your opponent casts a spell. Cancel it.', { when: 'cast', res: async (p, x) => { x.w.cancelled = true; } });
C('compass_far_roads', 'Compass of the Far Roads', 'Relic', 2, 1, null, null, 'Your Reactions cost 1 less (to a minimum of 1).');
C('sky_sail_privateer', 'Sky-Sail Privateer', 'Unit', 3, 1, 3, 3, "Flying. When this enters play, return an enemy unit with mana value 2 or less to its owner's hand.", {
  kw: ['flying'], enter: async p => { const t = await pickUnit(p, u => u.ctrl !== p && mvOf(u) <= 2, "Sky-Sail Privateer: return an enemy unit with mana value 2 or less."); if (t) bounce(t); } });
C('mistweaver', 'Mistweaver', 'Unit', 3, 1, 2, 4, 'When this enters play, create a 2/2 Illusion unit with "When this is targeted by a spell or Reaction, destroy it."', { enter: async p => mkToken(p, 'illusion') });
C('tidal_displacement', 'Tidal Displacement', 'Spell', 3, 1, null, null, "Return up to two units to their owners' hands.", {
  can: () => allUnits().length > 0,
  tgt: async (p, x) => {
    x.t.a = await pickUnit(p, () => true, 'Tidal Displacement: choose the first unit.', { src: x.d });
    x.t.b = await pickUnit(p, u => u !== x.t.a, 'Tidal Displacement: choose a second unit (optional).', { src: x.d, optional: true });
  },
  res: async (p, x) => { if (live(x.t.a)) bounce(x.t.a); if (live(x.t.b)) bounce(x.t.b); } });
C('ponder_horizon', 'Ponder the Horizon', 'Spell', 2, 2, null, null, 'Draw 3 cards.', { res: async p => draw(p, 3) });
C('thunderhead_roc', 'Thunderhead Roc', 'Unit', 4, 1, 4, 4, "Flying. When this enters play, tap an enemy unit. It doesn't untap during its owner's next Ready step.", {
  kw: ['flying'], enter: async p => { const t = await pickUnit(p, enemy(p), 'Thunderhead Roc: tap an enemy unit.'); if (t) { t.tapped = true; t.skipUntap = true; } } });
C('storm_of_leaving', 'Storm of Leaving', 'Spell', 3, 2, null, null, "Return each enemy unit with mana value 3 or less to its owner's hand.", {
  res: async p => { [...P(O(p)).board].filter(u => mvOf(u) <= 3).forEach(bounce); } });
C('leviathan_far_sky', 'Leviathan of the Far Sky', 'Unit', 4, 2, 5, 6, "Flying. Can't be targeted by your opponent's spells or Reactions.", { kw: ['flying'], hexproof: true });

// ---------------- WILDBORN ----------------
F = 'Wildborn';
C('mossling', 'Mossling', 'Unit', 0, 1, 1, 2, 'When this enters play, you may put a card from your hand into your Well.', { enter: async p => handToWell(p, true) });
C('thornpup', 'Thornpup', 'Unit', 0, 1, 1, 1, 'When this enters play, put a +1/+1 counter on it.', { enter: async (p, u) => { u.counters += 1; } });
C('wild_growth', 'Wild Growth', 'Spell', 0, 1, null, null, 'Put a +1/+1 counter on a unit, then draw a card.', {
  can: () => allUnits().length > 0, tgt: tgtUnit(() => () => true, 'Wild Growth: choose a unit.'),
  res: async (p, x) => { if (live(x.t.a)) x.t.a.counters += 1; await draw(p, 1); } });
C('grove_tender', 'Grove Tender', 'Unit', 1, 1, 1, 3, 'When this enters play, put the top card of your deck into your Well.', { enter: async p => topToWell(p, 1) });
C('ironbark_bear', 'Ironbark Bear', 'Unit', 1, 1, 2, 3, '');
C('pack_stalker', 'Pack Stalker', 'Unit', 1, 1, 2, 2, 'Gets +1 Power and +1 Health while you control a unit with 4 or more Power.');
C('sudden_bloom', 'Sudden Bloom', 'Reaction', 1, 1, null, null, 'Play when your opponent declares attackers. A unit you control gets +2 Power and +2 Health this turn.', {
  when: 'attack', can: p => P(p).board.length > 0, tgt: tgtUnit(own, 'Sudden Bloom: choose a unit you control.'),
  res: async (p, x) => { if (live(x.t.a)) { x.t.a.tp += 2; x.t.a.th += 2; } } });
C('seed_the_earth', 'Seed the Earth', 'Spell', 1, 1, null, null, 'Put a card from your hand into your Well, then draw a card.', { res: async p => { await handToWell(p, false); await draw(p, 1); } });
C('hunters_pounce', "Hunter's Pounce", 'Spell', 1, 1, null, null, 'A unit you control deals damage equal to its Power to an enemy unit.', {
  can: p => P(p).board.length > 0 && P(O(p)).board.length > 0,
  tgt: async (p, x) => {
    x.t.a = await pickUnit(p, own(p), "Hunter's Pounce: choose your unit.", { src: x.d });
    x.t.b = await pickUnit(p, enemy(p), "Hunter's Pounce: choose an enemy unit.", { src: x.d });
  },
  res: async (p, x) => { if (live(x.t.a) && live(x.t.b)) dmgUnit(x.t.b, Math.max(0, stats(x.t.a).p), { unit: x.t.a }); } });
C('mossback_tortoise', 'Mossback Tortoise', 'Unit', 2, 1, 2, 5, 'Guard', { kw: ['guard'] });
C('thicket_stalker', 'Thicket Stalker', 'Unit', 2, 1, 3, 3, 'When this enters play, put a +1/+1 counter on another unit you control.', {
  enter: async (p, u) => { const t = await pickUnit(p, v => v.ctrl === p && v !== u, 'Thicket Stalker: put a +1/+1 counter on another unit you control.'); if (t) t.counters += 1; } });
C('deeproot_druid', 'Deeproot Druid', 'Unit', 2, 1, 2, 3, 'At the start of your turn, put a +1/+1 counter on another unit you control.', {
  startTurn: async (p, u) => { const t = await pickUnit(p, v => v.ctrl === p && v !== u, 'Deeproot Druid: put a +1/+1 counter on another unit you control.'); if (t) t.counters += 1; } });
C('snapping_vines', 'Snapping Vines', 'Reaction', 2, 1, null, null, 'Play when your opponent declares attackers. Destroy an attacking unit with Flying.', {
  when: 'attack', can: () => allUnits().some(u => u.attacking && hasKw(u, 'flying')),
  tgt: tgtUnit(() => u => u.attacking && hasKw(u, 'flying'), 'Snapping Vines: choose an attacking unit with Flying.'),
  res: async (p, x) => { if (live(x.t.a)) await destroy(x.t.a); } });
C('grizzled_mauler', 'Grizzled Mauler', 'Unit', 3, 1, 5, 4, '');
C('oakheart_druid', 'Oakheart Druid', 'Unit', 3, 1, 3, 4, 'When this enters play, put the top 2 cards of your deck into your Well.', { enter: async p => topToWell(p, 2) });
C('heart_old_grove', 'Heart of the Old Grove', 'Relic', 3, 1, null, null, 'Whenever a unit with 5 or more Power enters play under your control, draw a card.');
C('thornmaw_wyrm', 'Thornmaw Wyrm', 'Unit', 4, 1, 6, 5, 'When this enters play, deal 2 damage to each enemy unit with Flying.', {
  enter: async (p, u) => { [...P(O(p)).board].filter(v => hasKw(v, 'flying')).forEach(v => dmgUnit(v, 2, { p })); } });
C('call_of_the_wild', 'Call of the Wild', 'Spell', 3, 2, null, null, 'Put two +1/+1 counters on each unit you control.', { res: async p => { P(p).board.forEach(u => u.counters += 2); } });
C('ancient_of_thorns', 'Ancient of Thorns', 'Unit', 4, 2, 7, 7, 'When this enters play, put the top card of your deck into your Well.', { enter: async p => topToWell(p, 1) });
C('worldroot_colossus', 'Worldroot Colossus', 'Unit', 5, 2, 8, 8, 'Other units you control get +1 Power and +1 Health.');

// ---------------- SHADOWMARKED ----------------
F = 'Shadowmarked';
C('alley_cutpurse', 'Alley Cutpurse', 'Unit', 0, 1, 2, 1, 'Whenever this deals damage to your opponent, Mark an enemy unit.');
C('viper_handler', 'Viper Handler', 'Unit', 0, 1, 1, 1, 'Venom', { kw: ['venom'] });
C('poisoned_dart', 'Poisoned Dart', 'Spell', 0, 1, null, null, 'Mark an enemy unit, then deal 1 damage to it.', {
  can: p => P(O(p)).board.length > 0, tgt: tgtUnit(enemy, 'Poisoned Dart: choose an enemy unit.'),
  res: async (p, x) => { if (live(x.t.a)) { markUnit(x.t.a); dmgUnit(x.t.a, 1, { p }); } } });
C('black_market_deal', 'Black Market Deal', 'Spell', 1, 1, null, null, 'Pay 2 life. Draw 2 cards.', { res: async p => { loseLife(p, 2); await draw(p, 2); } });
C('shadow_lurker', 'Shadow Lurker', 'Unit', 1, 1, 2, 2, 'Ambush', { kw: ['ambush'] });
C('hired_thug', 'Hired Thug', 'Unit', 1, 1, 3, 2, 'When this enters play, lose 2 life.', { enter: async p => loseLife(p, 2) });
C('smoke_bomb', 'Smoke Bomb', 'Reaction', 1, 1, null, null, 'Play when your opponent declares attackers. An attacking unit deals no damage this turn.', {
  when: 'attack', tgt: tgtUnit(() => attackingFilter, 'Smoke Bomb: choose an attacking unit.'),
  res: async (p, x) => { if (live(x.t.a)) x.t.a.noDmg = true; } });
C('toxic_coating', 'Toxic Coating', 'Spell', 1, 1, null, null, 'A unit you control gets +1 Power and gains Venom this turn.', {
  can: p => P(p).board.length > 0, tgt: tgtUnit(own, 'Toxic Coating: choose a unit you control.'),
  res: async (p, x) => { if (live(x.t.a)) { x.t.a.tp += 1; x.t.a.tkw.push('venom'); } } });
C('informant', 'Informant', 'Unit', 1, 1, 1, 2, "When this enters play, look at your opponent's hand, then Mark an enemy unit.", {
  enter: async p => { await ask({ kind: 'reveal', who: p, cards: [...P(O(p)).hand], prompt: `Informant: ${esc(P(O(p)).name)}'s hand.` }); await markPick(p); } });
C('guild_assassin', 'Guild Assassin', 'Unit', 2, 1, 2, 2, 'Ambush, Venom', { kw: ['ambush', 'venom'] });
C('leech_blade_duelist', 'Leech-Blade Duelist', 'Unit', 2, 1, 3, 2, 'Drain', { kw: ['drain'] });
C('kiss_of_the_viper', 'Kiss of the Viper', 'Spell', 1, 2, null, null, 'Destroy a unit with mana value 3 or less.', {
  can: () => allUnits().some(u => mvOf(u) <= 3), tgt: tgtUnit(() => u => mvOf(u) <= 3, 'Kiss of the Viper: choose a unit with mana value 3 or less.'),
  res: async (p, x) => { if (live(x.t.a)) await destroy(x.t.a); } });
C('trapdoor', 'Trapdoor', 'Reaction', 2, 1, null, null, 'Play when your opponent declares attackers. Destroy an attacking unit with 2 or less Power.', {
  when: 'attack', can: () => allUnits().some(u => u.attacking && stats(u).p <= 2),
  tgt: tgtUnit(() => u => u.attacking && stats(u).p <= 2, 'Trapdoor: choose an attacking unit with 2 or less Power.'),
  res: async (p, x) => { if (live(x.t.a) && stats(x.t.a).p <= 2) await destroy(x.t.a); } });
C('nightblade_stalker', 'Nightblade Stalker', 'Unit', 3, 1, 3, 3, 'Ambush. When this enters play, deal 2 damage to a marked unit.', {
  kw: ['ambush'], enter: async (p, u) => { const t = await pickUnit(p, v => v.marked, 'Nightblade Stalker: deal 2 damage to a marked unit.'); if (t) dmgUnit(t, 2, { p }); } });
C('thieves_guild_hall', "Thieves' Guild Hall", 'Relic', 3, 1, null, null, 'At the start of your turn, Mark an enemy unit. Whenever a marked unit is destroyed, you gain 2 life.', { startTurn: async p => markPick(p) });
C('toxic_fog', 'Toxic Fog', 'Spell', 3, 1, null, null, 'Each unit gets -2 Power and -2 Health this turn.', { res: async () => { allUnits().forEach(u => { u.tp -= 2; u.th -= 2; }); } });
C('poisonmaster_varr', 'Poisonmaster Varr', 'Unit', 2, 2, 2, 3, 'Venom. Your other units have Venom.', { kw: ['venom'] });
C('assassination', 'Assassination', 'Spell', 4, 1, null, null, 'Destroy a unit.', {
  can: () => allUnits().length > 0, tgt: tgtUnit(() => () => true, 'Assassination: choose a unit.'),
  res: async (p, x) => { if (live(x.t.a)) await destroy(x.t.a); } });
C('master_of_whispers', 'Master of Whispers', 'Unit', 4, 1, 4, 4, 'Ambush. When this enters play, destroy a marked unit.', {
  kw: ['ambush'], enter: async p => { const t = await pickUnit(p, v => v.marked, 'Master of Whispers: destroy a marked unit.'); if (t) await destroy(t); } });
C('guildmaster_unseen', 'Guildmaster of the Unseen', 'Unit', 4, 2, 5, 5, 'Ambush, Venom. When this enters play, Mark each enemy unit.', {
  kw: ['ambush', 'venom'], enter: async p => { P(O(p)).board.forEach(markUnit); } });

// ---------------- OATHSONG ----------------
F = 'Oathsong';
C('oathsworn_page', 'Oathsworn Page', 'Unit', 0, 1, 1, 2, 'Guard', { kw: ['guard'] });
C('temple_acolyte', 'Temple Acolyte', 'Unit', 0, 1, 1, 1, 'When this enters play, gain 2 life.', { enter: async p => gainLife(p, 2) });
C('rally_the_faithful', 'Rally the Faithful', 'Spell', 0, 1, null, null, 'Create a 1/1 Squire unit. Gain 1 life.', { res: async p => { await mkToken(p, 'squire'); gainLife(p, 1); } });
C('shieldmaiden', 'Shieldmaiden', 'Unit', 1, 1, 2, 3, 'Guard', { kw: ['guard'] });
C('choir_cantor', 'Choir Cantor', 'Unit', 1, 1, 1, 2, 'Whenever another unit enters play under your control, gain 1 life.');
C('lancer_of_dawn', 'Lancer of the Dawn', 'Unit', 1, 1, 2, 2, 'Gets +1 Power while you control 3 or more other units.');
C('sanctuary_ward', 'Sanctuary Ward', 'Reaction', 1, 1, null, null, 'Play when your opponent casts a spell that targets a unit you control. Cancel it.', {
  when: 'cast', can: (p, w) => w && tUnits(w).some(u => u.ctrl === p), res: async (p, x) => { x.w.cancelled = true; } });
C('healing_hymn', 'Healing Hymn', 'Spell', 1, 1, null, null, 'Gain 3 life and draw a card.', { res: async p => { gainLife(p, 3); await draw(p, 1); } });
C('call_to_arms', 'Call to Arms', 'Spell', 1, 1, null, null, 'Create two 1/1 Squire units.', { res: async p => { await mkToken(p, 'squire'); await mkToken(p, 'squire'); } });
C('knight_silver_oath', 'Knight of the Silver Oath', 'Unit', 2, 1, 3, 3, 'When this enters play, create a 1/1 Squire unit.', { enter: async p => mkToken(p, 'squire') });
C('pegasus_rider', 'Pegasus Rider', 'Unit', 2, 1, 2, 2, 'Flying', { kw: ['flying'] });
C('hymn_of_valor', 'Hymn of Valor', 'Relic', 2, 1, null, null, 'Your units get +1 Power.');
C('judgment_light', 'Judgment Light', 'Spell', 2, 1, null, null, 'Destroy a unit with 4 or more Power.', {
  can: () => allUnits().some(u => stats(u).p >= 4), tgt: tgtUnit(() => u => stats(u).p >= 4, 'Judgment Light: choose a unit with 4 or more Power.'),
  res: async (p, x) => { if (live(x.t.a) && stats(x.t.a).p >= 4) await destroy(x.t.a); } });
C('paladin_commander', 'Paladin Commander', 'Unit', 3, 1, 3, 4, 'Whenever you attack with 3 or more units, draw a card.');
C('sanctified_ground', 'Sanctified Ground', 'Relic', 3, 1, null, null, 'At the start of your turn, create a 1/1 Squire unit.', { startTurn: async p => mkToken(p, 'squire') });
C('oathbound_guardian', 'Oathbound Guardian', 'Unit', 2, 2, 2, 6, 'Guard. Your other units get +1 Health.', { kw: ['guard'] });
C('last_stand', 'Last Stand', 'Reaction', 3, 1, null, null, 'Play when your opponent declares attackers. Your units get +1 Power and +2 Health this turn.', {
  when: 'attack', res: async p => { P(p).board.forEach(u => { u.tp += 1; u.th += 2; }); } });
C('archon_of_mercy', 'Archon of Mercy', 'Unit', 4, 1, 4, 4, 'Flying. When this enters play, create two 1/1 Squire units.', { kw: ['flying'], enter: async p => { await mkToken(p, 'squire'); await mkToken(p, 'squire'); } });
C('wrath_of_dawn', 'Wrath of the Dawn', 'Spell', 3, 2, null, null, 'Destroy each unit with 3 or more Power.', {
  res: async () => { const list = allUnits().filter(u => stats(u).p >= 3); for (const u of list) if (live(u)) await destroy(u); } });
C('seraph_first_song', 'Seraph of the First Song', 'Unit', 4, 2, 5, 5, 'Flying. When this enters play, gain 5 life. Your other units get +1 Power.', { kw: ['flying'], enter: async p => gainLife(p, 5) });

// ---------------- MANA ----------------
const MANA = { Warbound: 'bloodfire_shard', Farstrider: 'skywind_shard', Wildborn: 'rootheart_shard', Shadowmarked: 'nightglass_shard', Oathsong: 'dawnlight_shard', Lorebound: 'runestone_shard' };
const MANA_NAMES = { Warbound: 'Bloodfire Shard', Farstrider: 'Skywind Shard', Wildborn: 'Rootheart Shard', Shadowmarked: 'Nightglass Shard', Oathsong: 'Dawnlight Shard', Lorebound: 'Runestone Shard' };
const MANA_COPIES = 15;
for (const f of Object.keys(MANA)) { F = f; C(MANA[f], MANA_NAMES[f], 'Mana', 0, 0, null, null, `Play this by putting it into your Well (your one Well card for the turn). It makes 1${FAC[f].s} mana.`); }

const DECKS = {
  Warbound: ['bloodied_recruit','war_drummer','firebrand_bolt','raider_outrider','shieldbreaker_brute','pit_fighter','battle_cry','sudden_riposte','stand_and_fight','banner_sergeant','ashblade_duelist','warcallers_horn','flame_volley','iron_tusk_charger','ravager_captain','warpath','skyfire_wyvern','siegebreaker_ogre','final_assault','emberhorn_dragon'],
  Lorebound: ['apprentice_scribe','glyph_of_hesitation','inkbound_familiar','wellspring_seeker','archive_sentinel','glimpse_the_pages','the_first_chapter','unwritten_answer','runecarver_adept','recall_the_lesson','tome_of_binding','well_drinker_sage','quillstorm','glyphwarden_golem','saga_sunken_library','erase_from_history','stargazer_oracle','keeper_of_pages','chronicles_end','living_codex'],
  Farstrider: ['cloud_scout','phantom_duelist','second_thoughts','windward_courier','skyhook_corsair','gust_of_return','misdirect','wandering_cartographer','study_the_winds','veilstep_rogue','stormglass_seer','counterwind','compass_far_roads','sky_sail_privateer','mistweaver','tidal_displacement','ponder_horizon','thunderhead_roc','storm_of_leaving','leviathan_far_sky'],
  Wildborn: ['mossling','thornpup','wild_growth','grove_tender','ironbark_bear','pack_stalker','sudden_bloom','seed_the_earth','hunters_pounce','mossback_tortoise','thicket_stalker','deeproot_druid','snapping_vines','grizzled_mauler','oakheart_druid','heart_old_grove','thornmaw_wyrm','call_of_the_wild','ancient_of_thorns','worldroot_colossus'],
  Shadowmarked: ['alley_cutpurse','viper_handler','poisoned_dart','black_market_deal','shadow_lurker','hired_thug','smoke_bomb','toxic_coating','informant','guild_assassin','leech_blade_duelist','kiss_of_the_viper','trapdoor','nightblade_stalker','thieves_guild_hall','toxic_fog','poisonmaster_varr','assassination','master_of_whispers','guildmaster_unseen'],
  Oathsong: ['oathsworn_page','temple_acolyte','rally_the_faithful','shieldmaiden','choir_cantor','lancer_of_dawn','sanctuary_ward','healing_hymn','call_to_arms','knight_silver_oath','pegasus_rider','hymn_of_valor','judgment_light','paladin_commander','sanctified_ground','oathbound_guardian','last_stand','archon_of_mercy','wrath_of_dawn','seraph_first_song'],
};

const HEROES = {
  Warbound: { name: 'Korga, the Red Banner', life: 18,
    power: { g: 1, pips: 1, label: 'Give a unit you control +1 Power and Swift this turn', can: p => P(p).board.length > 0,
      run: async p => { const u = await pickUnit(p, own(p), 'Korga: choose a unit you control.'); if (u) { u.tp += 1; u.tkw.push('swift'); } } },
    awText: 'Deal damage to your opponent on 3 different turns', prog: p => `${P(p).damageTurns.size}/3 turns`, aw: p => P(p).damageTurns.size >= 3,
    awPower: { g: 1, pips: 1, label: 'All your units get +1 Power and Swift this turn', can: p => P(p).board.length > 0,
      run: async p => { P(p).board.forEach(u => { u.tp += 1; u.tkw.push('swift'); }); } } },
  Farstrider: { name: 'Selene Windward', life: 20,
    power: { g: 2, pips: 1, label: 'Draw a card, then discard a card', run: async p => { await draw(p, 1); await discard(p, 1); } },
    awText: 'Cast 2 Reactions', prog: p => `${Math.min(2, P(p).reactionsCast)}/2 Reactions`, aw: p => P(p).reactionsCast >= 2,
    awPower: { g: 2, pips: 1, label: 'Draw a card', run: async p => draw(p, 1) } },
  Wildborn: { name: 'Mother Bramblewood', life: 22,
    power: { g: 3, pips: 1, label: 'Put a +1/+1 counter on a unit', can: () => allUnits().length > 0,
      run: async p => { const u = await pickUnit(p, () => true, 'Mother Bramblewood: choose a unit.'); if (u) u.counters += 1; } },
    awText: 'Control a unit with 6 or more Power', prog: p => `strongest unit: ${Math.max(0, ...P(p).board.map(u => stats(u).p))} Power`, aw: p => P(p).board.some(u => stats(u).p >= 6),
    awPassive: 'Once per turn, you may add a second card to your Well.' },
  Shadowmarked: { name: 'Nyra Vesk, the Quiet Knife', life: 20,
    power: { g: 1, pips: 1, label: 'Mark an enemy unit', can: p => P(O(p)).board.length > 0, run: async p => markPick(p) },
    awText: '3 marked units have been destroyed', prog: p => `${Math.min(3, P(p).markedKills)}/3 marked units destroyed`, aw: p => P(p).markedKills >= 3,
    awPassive: 'Whenever a marked unit is destroyed, draw a card.',
    awPower: { g: 2, pips: 1, label: 'Deal 2 damage to a marked unit', can: () => allUnits().some(u => u.marked),
      run: async p => { const u = await pickUnit(p, v => v.marked, 'Nyra Vesk: deal 2 damage to a marked unit.'); if (u) dmgUnit(u, 2, { p }); } } },
  Oathsong: { name: 'Dame Aurelle, First Oath', life: 22,
    power: { g: 3, pips: 1, label: 'Create a 1/1 Squire unit', run: async p => mkToken(p, 'squire') },
    awText: 'Control 5 or more units', prog: p => `${P(p).board.length}/5 units`, aw: p => P(p).board.length >= 5,
    awPassive: 'Your units get +1 Health.' },
  Lorebound: { name: 'The Archivist Ninefold', life: 20,
    power: { g: 2, pips: 1, label: 'Inscribe (add a rune counter to a Lorebound card you control)', can: p => loreCards(p).length > 0, run: async p => inscribe(p, 1) },
    awText: '7 or more cards in your Well', prog: p => `${P(p).well.length}/7 cards in Well`, aw: p => P(p).well.length >= 7,
    awPassive: 'Once per turn, you may cast a card from your Well, then put the top card of your deck into your Well.' },
};
