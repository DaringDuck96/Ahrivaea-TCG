// ================= EXPANSION CARDS + RARITY =================
// 30 cards per faction that are only found in Expansion Packs.
// Rarity: C = Common, U = Uncommon, R = Rare, L = Legendary.
const RARITY = { C: 'Common', U: 'Uncommon', R: 'Rare', L: 'Legendary' };
Object.assign(TOK, {
  recruit: { name: 'Warband Recruit', fac: 'Warbound', type: 'Unit', p: 1, h: 1, g: 0, pips: 0, mv: 0, token: true, text: 'Swift', kw: ['swift'] },
  wolf: { name: 'Wolf', fac: 'Wildborn', type: 'Unit', p: 2, h: 2, g: 0, pips: 0, mv: 0, token: true, text: 'A token created by a Wildborn card.', kw: [] },
  spirit: { name: 'Spirit', fac: 'Oathsong', type: 'Unit', p: 1, h: 1, g: 0, pips: 0, mv: 0, token: true, text: 'Flying', kw: ['flying'] },
});

// Starter deck cards: 10 Common, 7 Uncommon, 3 Rare per faction.
const STARTER_RARITY = {
  R: ['ravager_captain', 'final_assault', 'emberhorn_dragon', 'erase_from_history', 'keeper_of_pages', 'living_codex', 'thunderhead_roc', 'storm_of_leaving', 'leviathan_far_sky',
      'thornmaw_wyrm', 'ancient_of_thorns', 'worldroot_colossus', 'poisonmaster_varr', 'master_of_whispers', 'guildmaster_unseen', 'archon_of_mercy', 'wrath_of_dawn', 'seraph_first_song'],
  U: ['banner_sergeant', 'warcallers_horn', 'flame_volley', 'iron_tusk_charger', 'warpath', 'skyfire_wyvern', 'siegebreaker_ogre',
      'runecarver_adept', 'tome_of_binding', 'well_drinker_sage', 'glyphwarden_golem', 'saga_sunken_library', 'stargazer_oracle', 'chronicles_end',
      'wandering_cartographer', 'counterwind', 'compass_far_roads', 'mistweaver', 'tidal_displacement', 'ponder_horizon', 'sky_sail_privateer',
      'hunters_pounce', 'thicket_stalker', 'deeproot_druid', 'snapping_vines', 'oakheart_druid', 'heart_old_grove', 'call_of_the_wild',
      'guild_assassin', 'kiss_of_the_viper', 'trapdoor', 'nightblade_stalker', 'thieves_guild_hall', 'toxic_fog', 'assassination',
      'sanctuary_ward', 'hymn_of_valor', 'judgment_light', 'paladin_commander', 'sanctified_ground', 'oathbound_guardian', 'last_stand'],
};
for (const d of Object.values(DEFS)) if (d.type !== 'Mana') d.rar = STARTER_RARITY.R.includes(d.id) ? 'R' : STARTER_RARITY.U.includes(d.id) ? 'U' : 'C';

// ---------- building blocks ----------
function X(id, name, type, g, pips, p, h, rar, text, x) { C(id, name, type, g, pips, p, h, text, Object.assign({ rar, exp: true }, x || {})); }
const enterHit = (name, n) => async (p, u) => { const t = await pickUnit(p, v => v !== u && v.ctrl !== p, `${name}: deal ${n} damage to an enemy unit.`); if (t) dmgUnit(t, n, { p }); };
const enterFace = n => async p => { await dmgPlayer(O(p), n, { p }); };
const enterDraw = n => async p => draw(p, n);
const enterGain = n => async p => gainLife(p, n);
const enterTokens = (key, n) => async p => { for (let i = 0; i < n; i++) await mkToken(p, key); };
const enterCounter = (name, n) => async (p, u) => { const t = await pickUnit(p, v => v.ctrl === p && v !== u, `${name}: put a +1/+1 counter on another unit you control.`); if (t) t.counters += n; };
const enterBounce = (name, mv) => async p => { const t = await pickUnit(p, u => u.ctrl !== p && mvOf(u) <= mv, `${name}: return an enemy unit${mv < 99 ? ` with mana value ${mv} or less` : ''} to its owner's hand.`); if (t) bounce(t); };
const enterInscribeSelf = n => async (p, u) => { u.runes += n; };
const spellHitAny = (name, n) => ({ dmg: n, aiAs: 'firebrand_bolt', tgt: async (p, x) => { x.t.a = await pickAny(p, () => true, `${name}: deal ${n} damage to a unit or player.`, { src: x.d }); }, res: async (p, x) => { await hitAny(x.t.a, n, { p }); } });
const spellHitUnit = (name, n, f = () => true, what = 'a unit') => ({ dmg: n, aiAs: 'warpath', can: () => allUnits().some(f), tgt: tgtUnit(() => f, `${name}: deal ${n} damage to ${what}.`), res: async (p, x) => { if (live(x.t.a)) dmgUnit(x.t.a, n, { p }); } });
const spellDestroy = (name, f, what, aiAs = 'assassination') => ({ aiAs, aiF: f, can: () => allUnits().some(f), tgt: tgtUnit(() => f, `${name}: destroy ${what}.`), res: async (p, x) => { if (live(x.t.a) && f(x.t.a)) await destroy(x.t.a); } });
const spellOwn = (name, fn, ai = 'pump') => ({ ai, can: p => P(p).board.length > 0, tgt: tgtUnit(own, `${name}: choose a unit you control.`), res: async (p, x) => { if (live(x.t.a)) await fn(p, x.t.a); } });
const reactHit = (name, n) => ({ when: 'attack', dmg: n, aiAs: 'sudden_riposte', tgt: tgtUnit(() => attackingFilter, `${name}: deal ${n} damage to an attacking unit.`), res: async (p, x) => { if (live(x.t.a)) dmgUnit(x.t.a, n, { p }); } });
const reactPump = (name, pp, hh) => ({ when: 'attack', aiAs: 'sudden_bloom', bp: pp, bh: hh, can: p => P(p).board.length > 0, tgt: tgtUnit(own, `${name}: choose a unit you control.`), res: async (p, x) => { if (live(x.t.a)) { x.t.a.tp += pp; x.t.a.th += hh; } } });
const reactKill = (name, f, what, extra) => ({ when: 'attack', aiAs: 'trapdoor', aiF: f, can: () => allUnits().some(u => u.attacking && f(u)), tgt: tgtUnit(() => u => u.attacking && f(u), `${name}: destroy ${what}.`), res: async (p, x) => { if (live(x.t.a) && f(x.t.a)) { await destroy(x.t.a); if (extra) await extra(p); } } });
const counterIf = (f, after) => ({ when: 'cast', aiAs: 'counterwind', can: (p, w) => w && f(w.d), res: async (p, x) => { x.w.cancelled = true; if (after) await after(p, x); } });
const runesOn = (p) => runeTotal(p);
const chapter = (...fns) => ({ chapters: fns });

// ================= WARBOUND =================
F = 'Warbound';
X('emberbrand_squire', 'Emberbrand Squire', 'Unit', 0, 1, 2, 1, 'C', 'Swift', { kw: ['swift'] });
X('cinder_scout', 'Cinder Scout', 'Unit', 1, 1, 2, 2, 'C', 'When this enters play, deal 1 damage to your opponent.', { enter: enterFace(1) });
X('searing_jab', 'Searing Jab', 'Spell', 0, 1, null, null, 'C', 'Deal 1 damage to any unit or player. Draw a card.', Object.assign(spellHitAny('Searing Jab', 1), { res: async (p, x) => { await hitAny(x.t.a, 1, { p }); await draw(p, 1); } }));
X('ironhide_marauder', 'Ironhide Marauder', 'Unit', 2, 1, 3, 3, 'C', '');
X('axe_thrower', 'Axe Thrower', 'Unit', 2, 1, 2, 2, 'C', 'When this enters play, deal 1 damage to an enemy unit.', { enter: enterHit('Axe Thrower', 1) });
X('war_chant', 'War Chant', 'Spell', 0, 1, null, null, 'C', 'A unit you control gets +2 Power and Swift this turn.', spellOwn('War Chant', (p, u) => { u.tp += 2; u.tkw.push('swift'); }));
X('molten_hound', 'Molten Hound', 'Unit', 1, 1, 3, 1, 'C', '');
X('raging_charge', 'Raging Charge', 'Spell', 1, 1, null, null, 'C', 'Units you control get +1 Power and Swift this turn.', { ai: 'buffAll', res: async p => { P(p).board.forEach(u => { u.tp += 1; u.tkw.push('swift'); }); } });
X('skirmish_captain', 'Skirmish Captain', 'Unit', 3, 1, 4, 3, 'C', 'Swift', { kw: ['swift'] });
X('hornblower', 'Hornblower', 'Unit', 1, 1, 1, 3, 'C', 'When this enters play, create a 1/1 Warband Recruit unit with Swift.', { enter: enterTokens('recruit', 1) });
X('blood_oath_berserker', 'Blood-Oath Berserker', 'Unit', 1, 1, 3, 1, 'U', 'Swift, Echo', { kw: ['swift', 'echo'] });
X('flameheart_brawler', 'Flameheart Brawler', 'Unit', 2, 1, 2, 2, 'U', 'Gets +2 Power while your opponent has 10 or less life.', { selfMod: (u) => ({ p: P(O(u.ctrl)).life <= 10 ? 2 : 0 }) });
X('scorching_volley', 'Scorching Volley', 'Spell', 3, 1, null, null, 'U', 'Deal 2 damage to each enemy unit.', { dmg: 2, aiAs: 'flame_volley', res: async p => { [...P(O(p)).board].forEach(u => dmgUnit(u, 2, { p })); } });
X('warlords_challenge', "Warlord's Challenge", 'Spell', 1, 1, null, null, 'U', 'A unit you control deals damage equal to its Power to an enemy unit.', { aiAs: 'hunters_pounce',
  can: p => P(p).board.length > 0 && P(O(p)).board.length > 0,
  tgt: async (p, x) => { x.t.a = await pickUnit(p, own(p), "Warlord's Challenge: choose your unit.", { src: x.d }); x.t.b = await pickUnit(p, enemy(p), "Warlord's Challenge: choose an enemy unit.", { src: x.d }); },
  res: async (p, x) => { if (live(x.t.a) && live(x.t.b)) dmgUnit(x.t.b, Math.max(0, stats(x.t.a).p), { unit: x.t.a }); } });
X('ashen_vanguard', 'Ashen Vanguard', 'Unit', 3, 1, 3, 3, 'U', 'Swift. Whenever this attacks, deal 1 damage to the defending player.', { kw: ['swift'], onAttack: async (p, u) => dmgPlayer(O(p), 1, { unit: u }) });
X('counterblow', 'Counterblow', 'Reaction', 1, 1, null, null, 'U', 'Play when your opponent declares attackers. Deal 3 damage to an attacking unit.', reactHit('Counterblow', 3));
X('firebrand_adept', 'Firebrand Adept', 'Unit', 2, 1, 2, 2, 'U', 'Whenever you cast a spell, deal 1 damage to your opponent.', { onSpell: async p => dmgPlayer(O(p), 1, { p }) });
X('siege_ram', 'Siege Ram', 'Unit', 3, 1, 5, 2, 'U', "Can't block.", { kw: ['noblock'] });
X('drums_red_march', 'Drums of the Red March', 'Relic', 2, 1, null, null, 'U', 'Your units get +1 Power while attacking.', { aura: { p: 1, when: u => u.attacking } });
X('pillager', 'Pillager', 'Unit', 2, 1, 3, 2, 'U', 'Whenever this deals damage to your opponent, draw a card.', { onHitFace: async p => draw(p, 1) });
X('red_banner_champion', 'Champion of the Red Banner', 'Unit', 3, 2, 5, 4, 'R', 'Swift. Your other units with Swift get +1 Power.', { kw: ['swift'], aura: { p: 1, when: u => hasKw(u, 'swift') } });
X('inferno_lance', 'Inferno Lance', 'Spell', 2, 2, null, null, 'R', 'Deal 5 damage to any unit or player.', spellHitAny('Inferno Lance', 5));
X('phoenix_hatchling', 'Phoenix Hatchling', 'Unit', 2, 1, 2, 1, 'R', 'Flying, Swift, Echo', { kw: ['flying', 'swift', 'echo'] });
X('warmonger_titan', 'Warmonger Titan', 'Unit', 5, 1, 6, 6, 'R', 'Swift. Whenever this attacks, deal 2 damage to the defending player.', { kw: ['swift'], onAttack: async (p, u) => dmgPlayer(O(p), 2, { unit: u }) });
X('molten_rain', 'Molten Rain', 'Spell', 3, 2, null, null, 'R', 'Deal 3 damage to each enemy unit, then deal 3 damage to your opponent.', { dmg: 3, aiAs: 'flame_volley', aiBonus: 3, res: async p => { [...P(O(p)).board].forEach(u => dmgUnit(u, 3, { p })); await dmgPlayer(O(p), 3, { p }); } });
X('burning_retort', 'Burning Retort', 'Reaction', 1, 1, null, null, 'R', 'Play when your opponent declares attackers. Deal 2 damage to each attacking unit.', { when: 'attack', ai: 'sweepAttackers', dmg: 2, res: async p => { allUnits().filter(u => u.attacking && u.ctrl !== p).forEach(u => dmgUnit(u, 2, { p })); } });
X('bladestorm_duelist', 'Bladestorm Duelist', 'Unit', 3, 1, 3, 3, 'R', 'Swift, Drain', { kw: ['swift', 'drain'] });
X('ignara_dragon_queen', 'Ignara, Dragon Queen', 'Unit', 5, 2, 7, 6, 'L', 'Flying, Swift. When this enters play, deal 3 damage to each enemy unit.', { kw: ['flying', 'swift'], enter: async p => { [...P(O(p)).board].forEach(u => dmgUnit(u, 3, { p })); } });
X('red_banner_unfurled', 'The Red Banner Unfurled', 'Relic', 3, 1, null, null, 'L', 'Your units have Swift and get +1 Power.', { aura: { p: 1, kw: 'swift' } });
X('warlord_grimjaw', 'Warlord Grimjaw', 'Unit', 4, 1, 5, 5, 'L', 'Swift. Whenever you attack, your other attacking units get +1 Power this turn.', { kw: ['swift'], onAnyAttack: async (p, u) => { P(p).board.filter(v => v !== u && v.attacking).forEach(v => v.tp += 1); } });

// ================= LOREBOUND =================
F = 'Lorebound';
X('ink_stained_novice', 'Ink-Stained Novice', 'Unit', 0, 1, 1, 1, 'C', 'When this enters play, Inscribe.', { enter: async p => inscribe(p, 1) });
X('tome_warden', 'Tome Warden', 'Unit', 1, 1, 1, 4, 'C', 'Guard', { kw: ['guard'] });
X('pages_of_insight', 'Pages of Insight', 'Spell', 1, 1, null, null, 'C', 'Draw a card, then Prophecy 2.', { ai: 'draw', aiVal: 2, res: async p => { await draw(p, 1); await prophecy(p, 2); } });
X('runic_sentry', 'Runic Sentry', 'Unit', 2, 1, 2, 3, 'C', 'When this enters play, Inscribe it. Gets +1 Power for each rune counter on it.', { runeP: true, enter: enterInscribeSelf(1) });
X('well_keeper', 'Well Keeper', 'Unit', 1, 1, 1, 3, 'C', 'When this enters play, put the top card of your deck into your Well.', { enter: async p => topToWell(p, 1) });
X('archive_runner', 'Archive Runner', 'Unit', 2, 1, 3, 2, 'C', 'When this enters play, Prophecy 2.', { enter: async p => prophecy(p, 2) });
X('binding_word', 'Binding Word', 'Spell', 1, 1, null, null, 'C', "Tap an enemy unit. It doesn't untap during its owner's next Ready step.", { ai: 'tap', aiT: 'destroy', can: p => P(O(p)).board.some(u => !u.tapped), tgt: tgtUnit(p => u => u.ctrl !== p && !u.tapped, 'Binding Word: choose an enemy unit.'), res: async (p, x) => { if (live(x.t.a)) { x.t.a.tapped = true; x.t.a.skipUntap = true; } } });
X('scroll_golem', 'Scroll Golem', 'Unit', 3, 1, 2, 5, 'C', 'When this enters play, Inscribe it. Gets +1 Power for each rune counter on it.', { runeP: true, enter: enterInscribeSelf(1) });
X('quill_familiar', 'Quill Familiar', 'Unit', 1, 1, 1, 2, 'C', 'Flying. When this enters play, Inscribe.', { kw: ['flying'], enter: async p => inscribe(p, 1) });
X('lamplit_study', 'Lamplit Study', 'Relic', 1, 1, null, null, 'C', 'Chapter I: Draw a card. Chapter II: Inscribe. Chapter III: Draw a card, then put this card into your Well.', chapter(async p => draw(p, 1), async p => inscribe(p, 1), async (p, r) => { await draw(p, 1); relicToWell(r); }));
X('runebound_archer', 'Runebound Archer', 'Unit', 2, 1, 2, 2, 'U', 'When this enters play, deal damage to an enemy unit equal to the number of rune counters on cards you control.', { enter: async (p, u) => { const n = runesOn(p); if (!n) return; const t = await pickUnit(p, v => v.ctrl !== p, `Runebound Archer: deal ${n} damage to an enemy unit.`); if (t) dmgUnit(t, n, { p }); } });
X('twin_lessons', 'Twin Lessons', 'Spell', 2, 1, null, null, 'U', 'Draw 2 cards.', { ai: 'draw', aiVal: 3.5, res: async p => draw(p, 2) });
X('seal_of_silence', 'Seal of Silence', 'Reaction', 1, 1, null, null, 'U', 'Play when your opponent casts a spell. Cancel it if its mana value is 3 or less.', Object.assign(counterIf(d => d.mv <= 3), { aiAs: 'second_thoughts' }));
X('living_index', 'Living Index', 'Unit', 3, 1, 3, 3, 'U', 'Gets +1 Power and +1 Health for each Relic you control.', { selfMod: (u, me) => ({ p: me.relics.length, h: me.relics.length }) });
X('burning_chapter', 'The Burning Chapter', 'Relic', 2, 1, null, null, 'U', 'Chapter I: Deal 1 damage to an enemy unit. Chapter II: Deal 2 damage to an enemy unit. Chapter III: Deal 3 damage to an enemy unit, then put this card into your Well.',
  chapter(...[1, 2, 3].map(n => async (p, r) => { const t = await pickUnit(p, u => u.ctrl !== p, `The Burning Chapter: deal ${n} damage to an enemy unit.`); if (t) dmgUnit(t, n, { p }); if (n === 3) relicToWell(r); })));
X('wellsight_oracle', 'Wellsight Oracle', 'Unit', 3, 1, 2, 4, 'U', 'You may cast this from your Well. When this enters play, Prophecy 3.', { fromWell: true, enter: async p => prophecy(p, 3) });
X('runic_overload', 'Runic Overload', 'Spell', 2, 1, null, null, 'U', 'Deal damage to any unit or player equal to the number of rune counters on cards you control.', { aiAs: 'firebrand_bolt', dmgFn: runesOn,
  tgt: async (p, x) => { x.t.a = await pickAny(p, () => true, `Runic Overload: deal ${runesOn(p)} damage to a unit or player.`, { src: x.d }); }, res: async (p, x) => { await hitAny(x.t.a, runesOn(p), { p }); } });
X('memory_thief', 'Memory Thief', 'Unit', 2, 1, 2, 2, 'U', "When this enters play, look at your opponent's hand and choose a card. They discard it.", { enter: async p => {
  const oh = P(O(p)).hand; const c = await chooseCards(p, oh, "Memory Thief: choose a card from your opponent's hand for them to discard.", 1, 1);
  if (c[0]) { oh.splice(oh.indexOf(c[0]), 1); P(O(p)).grave.push(c[0]); log(`${esc(P(O(p)).name)} discards ${nm(def(c[0]).name)}.`); } } });
X('sealed_vault', 'Sealed Vault', 'Relic', 3, 1, null, null, 'U', 'At the start of your turn, if you have 6 or more cards in your Well, draw a card.', { startTurn: async p => { if (P(p).well.length >= 6) await draw(p, 1); } });
X('ward_of_runes', 'Ward of Runes', 'Reaction', 1, 1, null, null, 'U', 'Play when your opponent declares attackers. A unit you control gets +3 Health this turn.', reactPump('Ward of Runes', 0, 3));
X('archivist_vell', 'Archivist Vell', 'Unit', 3, 2, 3, 5, 'R', 'Whenever you cast a spell, draw a card.', { onSpell: async p => draw(p, 1) });
X('codex_endless_pages', 'Codex of Endless Pages', 'Relic', 4, 1, null, null, 'R', 'Chapter I: Draw 2 cards. Chapter II: Draw 2 cards. Chapter III: Draw 2 cards, then put this card into your Well.', chapter(async p => draw(p, 2), async p => draw(p, 2), async (p, r) => { await draw(p, 2); relicToWell(r); }));
X('rune_colossus', 'Rune Colossus', 'Unit', 5, 1, 4, 6, 'R', 'When this enters play, Inscribe it three times. Gets +1 Power and +1 Health for each rune counter on it.', { runePH: true, enter: enterInscribeSelf(3) });
X('unmake', 'Unmake', 'Spell', 3, 2, null, null, 'R', "Put any unit into its owner's Well.", { aiAs: 'erase_from_history', aiF: () => true, can: () => allUnits().length > 0, tgt: tgtUnit(() => () => true, 'Unmake: choose a unit.'), res: async (p, x) => { if (live(x.t.a)) { log(`${nm(def(x.t.a).name)} is unmade into a Well.`); unitToWell(x.t.a); } } });
X('prophet_of_ash', 'Prophet of Ash', 'Unit', 3, 1, 3, 3, 'R', 'Flying. At the start of your turn, Prophecy 2.', { kw: ['flying'], startTurn: async p => prophecy(p, 2) });
X('rewrite_fate', 'Rewrite Fate', 'Reaction', 2, 2, null, null, 'R', 'Play when your opponent casts a spell. Cancel it, then draw a card.', counterIf(() => true, async p => draw(p, 1)));
X('runeblade_sentinel', 'Runeblade Sentinel', 'Unit', 2, 1, 1, 3, 'R', 'Guard. Gets +1 Power for each rune counter on cards you control.', { kw: ['guard'], selfMod: u => ({ p: runeTotal(u.ctrl) }) });
X('ninefold_eye', 'The Ninefold Eye', 'Relic', 3, 2, null, null, 'L', 'At the start of your turn, Inscribe each Lorebound card you control.', { startTurn: async p => { loreCards(p).forEach(c => c.runes += 1); } });
X('librarian_oth', 'Eternal Librarian Oth', 'Unit', 4, 2, 5, 6, 'L', 'Whenever you cast a spell, put a +1/+1 counter on each unit you control.', { onSpell: async p => { P(p).board.forEach(u => u.counters += 1); } });
X('the_final_page', 'The Final Page', 'Spell', 6, 1, null, null, 'L', 'Destroy each enemy unit.', { ai: 'wipeEnemy', res: async p => { for (const u of [...P(O(p)).board]) if (live(u)) await destroy(u); } });

// ================= FARSTRIDER =================
F = 'Farstrider';
X('mist_sprite', 'Mist Sprite', 'Unit', 1, 1, 1, 2, 'C', 'Flying', { kw: ['flying'] });
X('skyship_deckhand', 'Sky-Ship Deckhand', 'Unit', 1, 1, 2, 2, 'C', 'When this enters play, draw a card, then discard a card.', { enter: async p => { await draw(p, 1); await discard(p, 1); } });
X('gust_step', 'Gust Step', 'Reaction', 0, 1, null, null, 'C', "Play when your opponent declares attackers. Return an attacking unit with mana value 2 or less to its owner's hand.", { when: 'attack', aiAs: 'misdirect', aiF: u => mvOf(u) <= 2,
  can: () => allUnits().some(u => u.attacking && mvOf(u) <= 2), tgt: tgtUnit(() => u => u.attacking && mvOf(u) <= 2, 'Gust Step: return an attacking unit with mana value 2 or less.'), res: async (p, x) => { if (live(x.t.a)) bounce(x.t.a); } });
X('cloudreader', 'Cloudreader', 'Unit', 2, 1, 2, 3, 'C', 'Whenever you cast a Reaction, put a +1/+1 counter on this.', { onReaction: async (p, u) => { u.counters += 1; } });
X('tailwind', 'Tailwind', 'Spell', 0, 1, null, null, 'C', 'A unit you control gains Flying this turn. Draw a card.', spellOwn('Tailwind', async (p, u) => { u.tkw.push('flying'); await draw(p, 1); }));
X('harbor_illusionist', 'Harbor Illusionist', 'Unit', 2, 1, 1, 3, 'C', 'When this enters play, create a 2/2 Illusion unit.', { enter: enterTokens('illusion', 1) });
X('drifting_scholar', 'Drifting Scholar', 'Unit', 2, 1, 2, 2, 'C', 'Flying', { kw: ['flying'] });
X('riptide', 'Riptide', 'Spell', 2, 1, null, null, 'C', "Return a unit to its owner's hand. Draw a card.", { aiAs: 'gust_of_return', aiBonus: 1.5, can: () => allUnits().length > 0, tgt: tgtUnit(() => () => true, 'Riptide: return a unit to its owner’s hand.'), res: async (p, x) => { if (live(x.t.a)) bounce(x.t.a); await draw(p, 1); } });
X('phantom_lancer', 'Phantom Lancer', 'Unit', 1, 1, 3, 2, 'C', 'When this is targeted by a spell or Reaction, destroy it.', { kw: ['illusion'] });
X('fog_bank', 'Fog Bank', 'Reaction', 1, 1, null, null, 'C', 'Play when your opponent declares attackers. An attacking unit deals no damage this turn.', { when: 'attack', aiAs: 'smoke_bomb', tgt: tgtUnit(() => attackingFilter, 'Fog Bank: choose an attacking unit.'), res: async (p, x) => { if (live(x.t.a)) x.t.a.noDmg = true; } });
X('tempest_mage', 'Tempest Mage', 'Unit', 3, 1, 2, 3, 'U', "Flying. When this enters play, return an enemy unit with mana value 3 or less to its owner's hand.", { kw: ['flying'], enter: enterBounce('Tempest Mage', 3) });
X('thought_snare', 'Thought Snare', 'Reaction', 2, 1, null, null, 'U', 'Play when your opponent casts a spell. Cancel it if it is a Unit.', counterIf(d => d.type === 'Unit'));
X('skyborne_courier', 'Skyborne Courier', 'Unit', 3, 1, 2, 2, 'U', 'Flying. When this enters play, draw 2 cards.', { kw: ['flying'], enter: enterDraw(2) });
X('phantom_legion', 'Phantom Legion', 'Spell', 3, 1, null, null, 'U', 'Create two 2/2 Illusion units.', { ai: 'tokens', aiVal: 4, res: async p => { await mkToken(p, 'illusion'); await mkToken(p, 'illusion'); } });
X('navigators_chart', "Navigator's Chart", 'Relic', 1, 1, null, null, 'U', 'At the start of your turn, look at the top card of your deck. You may put it on the bottom.', { startTurn: async p => {
  const pl = P(p); if (!pl.deck.length) return; const top = pl.deck[0];
  const c = await chooseCards(p, [top], "Navigator's Chart: choose the card to put it on the bottom of your deck, or confirm with none to keep it on top.", 0, 1);
  if (c[0]) { pl.deck.shift(); pl.deck.push(top); log(`${esc(pl.name)} puts a card on the bottom of their deck.`); } } });
X('storm_petrel', 'Storm Petrel', 'Unit', 2, 1, 2, 1, 'U', 'Flying, Swift', { kw: ['flying', 'swift'] });
X('dispel', 'Dispel', 'Reaction', 0, 1, null, null, 'U', 'Play when your opponent casts a spell. Cancel it if it is a Spell or a Relic.', Object.assign(counterIf(d => d.type === 'Spell' || d.type === 'Relic'), { aiAs: 'second_thoughts' }));
X('wavebreaker_sentinel', 'Wavebreaker Sentinel', 'Unit', 3, 1, 2, 5, 'U', 'Flying', { kw: ['flying'] });
X('mass_mirage', 'Mass Mirage', 'Spell', 4, 1, null, null, 'U', "Return each unit with mana value 2 or less to its owner's hand.", { ai: 'massBounce', res: async () => { allUnits().filter(u => mvOf(u) <= 2).forEach(bounce); } });
X('sky_pirate', 'Sky Pirate', 'Unit', 2, 1, 2, 2, 'U', 'Flying. Whenever this deals damage to your opponent, draw a card.', { kw: ['flying'], onHitFace: async p => draw(p, 1) });
X('cloudpiercer_roc', 'Cloudpiercer Roc', 'Unit', 4, 1, 4, 5, 'R', "Flying. When this enters play, return an enemy unit to its owner's hand.", { kw: ['flying'], enter: enterBounce('Cloudpiercer Roc', 99) });
X('timeless_fog', 'Timeless Fog', 'Reaction', 2, 1, null, null, 'R', 'Play when your opponent declares attackers. Attacking units deal no damage this turn.', { when: 'attack', ai: 'fogAll', res: async p => { allUnits().filter(u => u.attacking).forEach(u => u.noDmg = true); } });
X('archmage_currents', 'Archmage of Currents', 'Unit', 3, 2, 3, 4, 'R', 'Your Reactions cost 1 less. Whenever you cast a Reaction, draw a card.', { cheapReactions: true, onReaction: async p => draw(p, 1) });
X('doubling_mirage', 'Doubling Mirage', 'Spell', 2, 1, null, null, 'R', 'Create a 2/2 Illusion unit for each unit your opponent controls.', { ai: 'tokensPerEnemy', res: async p => { const n = P(O(p)).board.length; for (let i = 0; i < n; i++) await mkToken(p, 'illusion'); } });
X('stormcaller_sylra', 'Stormcaller Sylra', 'Unit', 4, 1, 3, 3, 'R', 'Flying. Whenever you cast a Reaction, deal 2 damage to an enemy unit.', { kw: ['flying'], onReaction: async p => { const t = await pickUnit(p, u => u.ctrl !== p, 'Stormcaller Sylra: deal 2 damage to an enemy unit.'); if (t) dmgUnit(t, 2, { p }); } });
X('deny_the_tide', 'Deny the Tide', 'Reaction', 2, 2, null, null, 'R', "Play when your opponent casts a spell. Cancel it, then return a unit they control to their hand.", counterIf(() => true, async p => { const t = await pickUnit(p, u => u.ctrl !== p, "Deny the Tide: return an enemy unit to its owner's hand."); if (t) bounce(t); }));
X('veil_walker', 'Veil Walker', 'Unit', 3, 1, 3, 3, 'R', "Can't be blocked. Can't be targeted by your opponent's spells or Reactions.", { kw: ['unblockable'], hexproof: true });
X('queen_endless_sky', 'Queen of the Endless Sky', 'Unit', 5, 2, 6, 6, 'L', "Flying. When this enters play, return each enemy unit with mana value 3 or less to its owner's hand.", { kw: ['flying'], enter: async p => { [...P(O(p)).board].filter(u => mvOf(u) <= 3).forEach(bounce); } });
X('sky_citadel', 'The Sky Citadel', 'Relic', 3, 2, null, null, 'L', 'Your units have Flying.', { aura: { kw: 'flying' } });
X('tidebreaker_wyrm', 'Tidebreaker Wyrm', 'Unit', 4, 2, 5, 5, 'L', 'Flying, Echo. When this enters play, draw a card.', { kw: ['flying', 'echo'], enter: enterDraw(1) });

// ================= WILDBORN =================
F = 'Wildborn';
X('sapling', 'Sapling', 'Unit', 0, 1, 0, 3, 'C', 'When this enters play, put a +1/+1 counter on another unit you control.', { enter: enterCounter('Sapling', 1) });
X('timber_wolf', 'Timber Wolf', 'Unit', 1, 1, 3, 2, 'C', '');
X('root_surge', 'Root Surge', 'Spell', 0, 1, null, null, 'C', 'Put the top card of your deck into your Well.', { ai: 'ramp', res: async p => topToWell(p, 1) });
X('thornback_boar', 'Thornback Boar', 'Unit', 2, 1, 3, 4, 'C', '');
X('vine_lasher', 'Vine Lasher', 'Unit', 2, 1, 2, 3, 'C', 'Reach', { kw: ['reach'] });
X('feral_instinct', 'Feral Instinct', 'Reaction', 0, 1, null, null, 'C', 'Play when your opponent declares attackers. A unit you control gets +1 Power and +2 Health this turn.', reactPump('Feral Instinct', 1, 2));
X('greathorn_elk', 'Greathorn Elk', 'Unit', 3, 1, 4, 4, 'C', '');
X('den_mother', 'Den Mother', 'Unit', 3, 1, 2, 3, 'C', 'When this enters play, create a 2/2 Wolf unit.', { enter: enterTokens('wolf', 1) });
X('overgrowth', 'Overgrowth', 'Spell', 1, 1, null, null, 'C', 'Put a +1/+1 counter on each unit you control.', { ai: 'buffAll', res: async p => { P(p).board.forEach(u => u.counters += 1); } });
X('mossy_giant', 'Mossy Giant', 'Unit', 5, 1, 6, 6, 'C', '');
X('alpha_wolf', 'Alpha Wolf', 'Unit', 3, 1, 3, 3, 'U', 'Your other units get +1 Power.', { aura: { p: 1 } });
X('bountiful_harvest', 'Bountiful Harvest', 'Spell', 2, 1, null, null, 'U', 'Put the top 2 cards of your deck into your Well. Draw a card.', { ai: 'ramp', aiVal: 3.5, res: async p => { topToWell(p, 2); await draw(p, 1); } });
X('canopy_spider', 'Canopy Spider', 'Unit', 2, 1, 1, 4, 'U', 'Reach, Venom', { kw: ['reach', 'venom'] });
X('savage_bite', 'Savage Bite', 'Spell', 0, 1, null, null, 'U', 'A unit you control deals damage equal to its Power to an enemy unit.', { aiAs: 'hunters_pounce',
  can: p => P(p).board.length > 0 && P(O(p)).board.length > 0,
  tgt: async (p, x) => { x.t.a = await pickUnit(p, own(p), 'Savage Bite: choose your unit.', { src: x.d }); x.t.b = await pickUnit(p, enemy(p), 'Savage Bite: choose an enemy unit.', { src: x.d }); },
  res: async (p, x) => { if (live(x.t.a) && live(x.t.b)) dmgUnit(x.t.b, Math.max(0, stats(x.t.a).p), { unit: x.t.a }); } });
X('old_treefolk', 'Old Treefolk', 'Unit', 4, 1, 3, 7, 'U', 'Guard, Reach', { kw: ['guard', 'reach'] });
X('rampaging_rhino', 'Rampaging Rhino', 'Unit', 4, 1, 5, 4, 'U', "Can't be blocked by units with 2 or less Power.", { minBlockPower: 3 });
X('strangling_roots', 'Strangling Roots', 'Reaction', 1, 1, null, null, 'U', 'Play when your opponent declares attackers. Deal damage to an attacking unit equal to the Power of the strongest unit you control.', { when: 'attack', aiAs: 'sudden_riposte',
  dmgFn: p => Math.max(0, ...P(p).board.map(u => stats(u).p)), can: p => P(p).board.length > 0,
  tgt: async (p, x) => { const n = Math.max(0, ...P(p).board.map(u => stats(u).p)); x.t.a = await pickUnit(p, attackingFilter, `Strangling Roots: deal ${n} damage to an attacking unit.`, { src: x.d }); },
  res: async (p, x) => { if (live(x.t.a)) dmgUnit(x.t.a, Math.max(0, ...P(p).board.map(u => stats(u).p)), { p }); } });
X('circle_of_druids', 'Circle of Druids', 'Relic', 2, 1, null, null, 'U', 'At the start of your turn, put a +1/+1 counter on a unit you control.', { startTurn: async p => { const t = await pickUnit(p, own(p), 'Circle of Druids: put a +1/+1 counter on a unit you control.'); if (t) t.counters += 1; } });
X('stampede', 'Stampede', 'Spell', 3, 1, null, null, 'U', 'Units you control get +2 Power and +1 Health this turn.', { ai: 'buffAll', res: async p => { P(p).board.forEach(u => { u.tp += 2; u.th += 1; }); } });
X('seedkeeper_elder', 'Seedkeeper Elder', 'Unit', 2, 1, 1, 3, 'U', 'When this enters play, put a card from your hand into your Well, then draw a card.', { enter: async p => { await handToWell(p, false); await draw(p, 1); } });
X('ancient_hydra', 'Ancient Hydra', 'Unit', 3, 2, 4, 4, 'R', 'When this enters play, put a +1/+1 counter on it for each other unit you control.', { enter: async (p, u) => { u.counters += P(p).board.filter(v => v !== u).length; } });
X('call_the_herd', 'Call the Herd', 'Spell', 3, 2, null, null, 'R', 'Create three 2/2 Wolf units.', { ai: 'tokens', aiVal: 6, res: async p => { for (let i = 0; i < 3; i++) await mkToken(p, 'wolf'); } });
X('worldtree_dryad', 'Dryad of the Worldtree', 'Unit', 2, 1, 2, 2, 'R', 'While this is in play, you may add a second card to your Well each turn.', { extraWell: true });
X('bramblehorn_king', 'Bramblehorn King', 'Unit', 5, 1, 6, 6, 'R', 'Guard. Your other units get +1 Power and +1 Health.', { kw: ['guard'], aura: { p: 1, h: 1 } });
X('primal_rage', 'Primal Rage', 'Reaction', 1, 1, null, null, 'R', 'Play when your opponent declares attackers. A unit you control gets +4 Power and +4 Health this turn.', reactPump('Primal Rage', 4, 4));
X('verdant_titan', 'Verdant Titan', 'Unit', 6, 1, 8, 8, 'R', 'Reach. When this enters play, put the top 2 cards of your deck into your Well.', { kw: ['reach'], enter: async p => topToWell(p, 2) });
X('undying_thornbeast', 'Undying Thornbeast', 'Unit', 3, 1, 4, 4, 'R', 'Echo', { kw: ['echo'] });
X('yrsa_heart_wild', 'Yrsa, Heart of the Wild', 'Unit', 5, 2, 7, 7, 'L', 'Reach. Your other units get +2 Power and +2 Health.', { kw: ['reach'], aura: { p: 2, h: 2 } });
X('eternal_grove', 'The Eternal Grove', 'Relic', 4, 1, null, null, 'L', 'At the start of your turn, create a 2/2 Wolf unit, then put a +1/+1 counter on each unit you control.', { startTurn: async p => { await mkToken(p, 'wolf'); P(p).board.forEach(u => u.counters += 1); } });
X('awakening_giants', 'Awakening of Giants', 'Spell', 4, 2, null, null, 'L', 'Put the top 3 cards of your deck into your Well. Put three +1/+1 counters on each unit you control.', { ai: 'buffAll', aiVal: 7, res: async p => { topToWell(p, 3); P(p).board.forEach(u => u.counters += 3); } });

// ================= SHADOWMARKED =================
F = 'Shadowmarked';
X('street_urchin', 'Street Urchin', 'Unit', 0, 1, 1, 1, 'C', 'When this enters play, Mark an enemy unit.', { enter: async p => markPick(p) });
X('shiv', 'Shiv', 'Spell', 0, 1, null, null, 'C', 'Deal 2 damage to an enemy unit, then Mark it.', Object.assign(spellHitUnit('Shiv', 2, u => true, 'an enemy unit'), { can: p => P(O(p)).board.length > 0, tgt: tgtUnit(enemy, 'Shiv: deal 2 damage to an enemy unit.'), res: async (p, x) => { if (live(x.t.a)) { dmgUnit(x.t.a, 2, { p }); markUnit(x.t.a); } } }));
X('smuggler', 'Smuggler', 'Unit', 1, 1, 2, 2, 'C', 'When this enters play, draw a card and lose 1 life.', { enter: async p => { await draw(p, 1); loseLife(p, 1); } });
X('rooftop_lookout', 'Rooftop Lookout', 'Unit', 1, 1, 1, 3, 'C', 'Ambush', { kw: ['ambush'] });
X('venom_vial', 'Venom Vial', 'Spell', 0, 1, null, null, 'C', 'A unit you control gains Venom this turn.', spellOwn('Venom Vial', (p, u) => { u.tkw.push('venom'); }));
X('cutthroat', 'Cutthroat', 'Unit', 2, 1, 3, 1, 'C', 'Venom', { kw: ['venom'] });
X('blackmail', 'Blackmail', 'Spell', 1, 1, null, null, 'C', 'Your opponent discards a random card.', { ai: 'discard', can: p => P(O(p)).hand.length > 0, res: async p => { const oh = P(O(p)).hand; if (!oh.length) return; const c = oh[Math.floor(RNG() * oh.length)]; oh.splice(oh.indexOf(c), 1); P(O(p)).grave.push(c); log(`${esc(P(O(p)).name)} discards ${nm(def(c).name)}.`); } });
X('alley_ambusher', 'Alley Ambusher', 'Unit', 2, 1, 3, 2, 'C', 'Ambush', { kw: ['ambush'] });
X('dirty_trick', 'Dirty Trick', 'Reaction', 0, 1, null, null, 'C', 'Play when your opponent declares attackers. An attacking unit gets -2 Power this turn.', { when: 'attack', aiAs: 'glyph_of_hesitation', tgt: tgtUnit(() => attackingFilter, 'Dirty Trick: choose an attacking unit.'), res: async (p, x) => { if (live(x.t.a)) x.t.a.tp -= 2; } });
X('dock_enforcer', 'Dock Enforcer', 'Unit', 3, 1, 4, 4, 'C', 'When this enters play, lose 2 life.', { enter: async p => loseLife(p, 2) });
X('contract_killer', 'Contract Killer', 'Unit', 3, 1, 3, 2, 'U', 'Ambush. When this enters play, destroy a marked unit with 3 or less Power.', { kw: ['ambush'], enter: async p => { const t = await pickUnit(p, u => u.marked && stats(u).p <= 3, 'Contract Killer: destroy a marked unit with 3 or less Power.'); if (t) await destroy(t); } });
X('poison_cloud', 'Poison Cloud', 'Spell', 2, 1, null, null, 'U', 'Each enemy unit gets -1 Power and -1 Health this turn.', { dmg: 1, aiAs: 'flame_volley', res: async p => { P(O(p)).board.forEach(u => { u.tp -= 1; u.th -= 1; }); } });
X('the_fence', 'The Fence', 'Relic', 1, 1, null, null, 'U', 'Whenever a marked unit is destroyed, draw a card.', { onMarkedDeath: async p => draw(p, 1) });
X('shadow_step', 'Shadow Step', 'Spell', 1, 1, null, null, 'U', "A unit you control can't be blocked this turn. Draw a card.", spellOwn('Shadow Step', async (p, u) => { u.tkw.push('unblockable'); await draw(p, 1); }));
X('night_widow', 'Night Widow', 'Unit', 2, 1, 1, 4, 'U', 'Venom', { kw: ['venom'] });
X('blood_price', 'Blood Price', 'Spell', 2, 1, null, null, 'U', 'Destroy a unit. You lose life equal to its Power.', Object.assign(spellDestroy('Blood Price', () => true, 'a unit'), { res: async (p, x) => { if (live(x.t.a)) { const n = Math.max(0, stats(x.t.a).p); await destroy(x.t.a); loseLife(p, n); } } }));
X('spy_network', 'Spy Network', 'Relic', 2, 1, null, null, 'U', 'Whenever a marked unit is destroyed, your opponent loses 2 life.', { onMarkedDeath: async p => loseLife(O(p), 2) });
X('garrote', 'Garrote', 'Reaction', 1, 1, null, null, 'U', 'Play when your opponent declares attackers. Destroy an attacking unit that is marked.', reactKill('Garrote', u => u.marked, 'an attacking marked unit'));
X('venomancer', 'Venomancer', 'Unit', 3, 1, 3, 4, 'U', 'Venom', { kw: ['venom'] });
X('masked_duelist', 'Masked Duelist', 'Unit', 2, 1, 2, 2, 'U', 'Drain, Echo', { kw: ['drain', 'echo'] });
X('nightshade_matriarch', 'Nightshade Matriarch', 'Unit', 3, 2, 4, 4, 'R', 'Venom, Drain', { kw: ['venom', 'drain'] });
X('night_of_knives', 'Night of Knives', 'Spell', 4, 1, null, null, 'R', 'Destroy each marked unit.', { ai: 'wipeMarked', res: async () => { for (const u of allUnits().filter(u => u.marked)) if (live(u)) await destroy(u); } });
X('guild_spymaster', 'Guild Spymaster', 'Unit', 2, 1, 2, 3, 'R', 'At the start of your turn, Mark an enemy unit, then deal 1 damage to each marked unit.', { startTurn: async p => { await markPick(p); allUnits().filter(u => u.marked).forEach(u => dmgUnit(u, 1, { p })); } });
X('the_executioner', 'The Executioner', 'Unit', 4, 1, 5, 4, 'R', 'When this enters play, destroy an enemy unit with 3 or less Power.', { enter: async p => { const t = await pickUnit(p, u => u.ctrl !== p && stats(u).p <= 3, 'The Executioner: destroy an enemy unit with 3 or less Power.'); if (t) await destroy(t); } });
X('ambush_strike', 'Ambush Strike', 'Reaction', 1, 1, null, null, 'R', 'Play when your opponent declares attackers. Destroy an attacking unit. You lose 3 life.', reactKill('Ambush Strike', () => true, 'an attacking unit', async p => loseLife(p, 3)));
X('lotus_poison', 'Lotus Poison', 'Spell', 1, 1, null, null, 'R', 'An enemy unit gets -4 Power and -4 Health this turn.', { dmg: 4, aiAs: 'warpath', can: p => P(O(p)).board.length > 0, tgt: tgtUnit(enemy, 'Lotus Poison: choose an enemy unit.'), res: async (p, x) => { if (live(x.t.a)) { x.t.a.tp -= 4; x.t.a.th -= 4; } } });
X('shadow_double', 'Shadow Double', 'Unit', 3, 1, 3, 3, 'R', 'Ambush, Echo', { kw: ['ambush', 'echo'] });
X('vex_thousand_faces', 'Vex, the Thousand Faces', 'Unit', 4, 2, 5, 5, 'L', 'Ambush, Venom. When this enters play, destroy each marked unit.', { kw: ['ambush', 'venom'], enter: async () => { for (const u of allUnits().filter(u => u.marked)) if (live(u)) await destroy(u); } });
X('crimson_contract', 'The Crimson Contract', 'Relic', 3, 2, null, null, 'L', 'At the start of your turn, Mark an enemy unit. Whenever a marked unit is destroyed, your opponent loses 3 life and you gain 3 life.', { startTurn: async p => markPick(p), onMarkedDeath: async p => { loseLife(O(p), 3); gainLife(p, 3); } });
X('death_from_shadows', 'Death from Shadows', 'Reaction', 3, 1, null, null, 'L', 'Play when your opponent declares attackers. Destroy each attacking unit.', { when: 'attack', ai: 'killAllAttackers', res: async p => { for (const u of allUnits().filter(u => u.attacking && u.ctrl !== p)) if (live(u)) await destroy(u); } });

// ================= OATHSONG =================
F = 'Oathsong';
X('shrine_maiden', 'Shrine Maiden', 'Unit', 0, 1, 1, 2, 'C', 'When this enters play, gain 1 life.', { enter: enterGain(1) });
X('eager_squire', 'Eager Squire', 'Unit', 1, 1, 1, 1, 'C', 'When this enters play, create a 1/1 Squire unit.', { enter: enterTokens('squire', 1) });
X('blessing_of_steel', 'Blessing of Steel', 'Spell', 0, 1, null, null, 'C', 'Put a +1/+1 counter on a unit you control. Gain 1 life.', spellOwn('Blessing of Steel', (p, u) => { u.counters += 1; gainLife(p, 1); }, 'counter'));
X('temple_guard', 'Temple Guard', 'Unit', 2, 1, 2, 4, 'C', 'Guard', { kw: ['guard'] });
X('dawn_patrol', 'Dawn Patrol', 'Spell', 2, 1, null, null, 'C', 'Create two 1/1 Spirit units with Flying.', { ai: 'tokens', aiVal: 3, res: async p => { await mkToken(p, 'spirit'); await mkToken(p, 'spirit'); } });
X('radiant_lancer', 'Radiant Lancer', 'Unit', 2, 1, 3, 2, 'C', 'Gets +1 Power while you control 3 or more other units.', { selfMod: (u, me) => ({ p: me.board.filter(v => v !== u).length >= 3 ? 1 : 0 }) });
X('hymnal_acolyte', 'Hymnal Acolyte', 'Unit', 1, 1, 1, 3, 'C', 'Drain', { kw: ['drain'] });
X('sanctified_blade', 'Sanctified Blade', 'Reaction', 0, 1, null, null, 'C', 'Play when your opponent declares attackers. A unit you control gets +1 Power and +1 Health this turn.', reactPump('Sanctified Blade', 1, 1));
X('griffin_rider', 'Griffin Rider', 'Unit', 3, 1, 3, 3, 'C', 'Flying', { kw: ['flying'] });
X('vigil_keeper', 'Vigil Keeper', 'Unit', 3, 1, 2, 5, 'C', 'Guard. When this enters play, gain 2 life.', { kw: ['guard'], enter: enterGain(2) });
X('captain_of_guard', 'Captain of the Guard', 'Unit', 3, 1, 3, 3, 'U', 'Your other units get +1 Health.', { aura: { h: 1 } });
X('rallying_cry', 'Rallying Cry', 'Spell', 2, 1, null, null, 'U', 'Units you control get +1 Power and +1 Health this turn. Gain 1 life for each unit you control.', { ai: 'buffAll', res: async p => { P(p).board.forEach(u => { u.tp += 1; u.th += 1; }); gainLife(p, P(p).board.length); } });
X('shield_of_faith', 'Shield of Faith', 'Reaction', 0, 1, null, null, 'U', 'Play when your opponent declares attackers. Your units get +2 Health this turn.', { when: 'attack', aiAs: 'last_stand', res: async p => { P(p).board.forEach(u => { u.th += 2; }); } });
X('cathedral_of_dawn', 'Cathedral of Dawn', 'Relic', 2, 1, null, null, 'U', 'At the start of your turn, gain 2 life.', { startTurn: async p => gainLife(p, 2) });
X('lightbringer', 'Lightbringer', 'Unit', 3, 1, 2, 3, 'U', 'Flying, Drain', { kw: ['flying', 'drain'] });
X('banish', 'Banish', 'Spell', 2, 1, null, null, 'U', 'Destroy a tapped enemy unit.', spellDestroy('Banish', u => u.tapped && u.ctrl !== G.active, 'a tapped enemy unit', 'kiss_of_the_viper'));
X('master_at_arms', 'Master-at-Arms', 'Unit', 2, 1, 2, 3, 'U', 'At the start of your turn, create a 1/1 Squire unit.', { startTurn: async p => mkToken(p, 'squire') });
X('oath_of_unity', 'Oath of Unity', 'Spell', 3, 1, null, null, 'U', 'Put a +1/+1 counter on each unit you control.', { ai: 'buffAll', res: async p => { P(p).board.forEach(u => u.counters += 1); } });
X('mending_light', 'Mending Light', 'Spell', 1, 1, null, null, 'U', 'Gain 5 life.', { ai: 'gain', res: async p => gainLife(p, 5) });
X('shield_wall', 'Shield Wall', 'Unit', 2, 1, 1, 5, 'U', 'Guard', { kw: ['guard'] });
X('high_paladin_seren', 'High Paladin Seren', 'Unit', 3, 2, 4, 5, 'R', 'Guard, Drain', { kw: ['guard', 'drain'] });
X('day_of_judgment', 'Day of Judgment', 'Spell', 4, 2, null, null, 'R', 'Destroy each unit.', { ai: 'wipeAll', res: async () => { for (const u of allUnits()) if (live(u)) await destroy(u); } });
X('angelic_host', 'Angelic Host', 'Spell', 4, 1, null, null, 'R', 'Create three 1/1 Spirit units with Flying. Gain 3 life.', { ai: 'tokens', aiVal: 5.5, res: async p => { for (let i = 0; i < 3; i++) await mkToken(p, 'spirit'); gainLife(p, 3); } });
X('guardian_seraph', 'Guardian Seraph', 'Unit', 4, 1, 4, 4, 'R', 'Flying. Your other units get +1 Power and +1 Health.', { kw: ['flying'], aura: { p: 1, h: 1 } });
X('righteous_fury', 'Righteous Fury', 'Reaction', 2, 1, null, null, 'R', 'Play when your opponent declares attackers. Destroy an attacking unit with 4 or more Power.', reactKill('Righteous Fury', u => stats(u).p >= 4, 'an attacking unit with 4 or more Power'));
X('knight_commander_alric', 'Knight-Commander Alric', 'Unit', 4, 1, 4, 4, 'R', 'When this enters play, create two 1/1 Squire units. Your Squires get +1 Power and +1 Health.', { enter: enterTokens('squire', 2), aura: { p: 1, h: 1, when: u => u.token === 'squire' } });
X('temple_of_sun', 'Temple of the Sun', 'Relic', 3, 1, null, null, 'R', 'Your units get +1 Health. At the start of your turn, gain 1 life.', { aura: { h: 1 }, startTurn: async p => gainLife(p, 1) });
X('solenne_avatar', 'Solenne, Avatar of Dawn', 'Unit', 5, 2, 6, 6, 'L', 'Flying, Drain. Your other units get +1 Power and +1 Health.', { kw: ['flying', 'drain'], aura: { p: 1, h: 1 } });
X('eternal_oath', 'The Eternal Oath', 'Relic', 3, 2, null, null, 'L', 'At the start of your turn, create a 1/1 Spirit unit with Flying. Your units get +1 Power.', { aura: { p: 1 }, startTurn: async p => mkToken(p, 'spirit') });
X('dawn_resurrection', 'Dawn of Resurrection', 'Spell', 4, 2, null, null, 'L', 'Gain 10 life. Create three 1/1 Squire units.', { ai: 'tokens', aiVal: 7, res: async p => { gainLife(p, 10); for (let i = 0; i < 3; i++) await mkToken(p, 'squire'); } });

// ================= RELEASES =================
// Every card so far belongs to the first Release. A later Release gets its own id and name here.
const RELEASES = { intro: { name: 'Intro to Ahrivaea' } };
const CURRENT_RELEASE = 'intro';
for (const d of Object.values(DEFS)) if (!d.rel) d.rel = 'intro';
