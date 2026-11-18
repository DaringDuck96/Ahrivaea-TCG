// ================= UI =================
let UI = {}, INSP = null;
function resetUI() { UI = { sel: null, selWell: false, atk: new Set(), blk: {}, blkSel: null, cards: new Set(), order: [] }; }
resetUI();

function kwLine(o) {
  const d = def(o); const names = { flying: 'Flying', swift: 'Swift', guard: 'Guard', drain: 'Drain', venom: 'Venom', ambush: 'Ambush', unblockable: 'Unblockable', illusion: 'Illusion', reach: 'Reach', echo: 'Echo' };
  return d.kw.filter(k => names[k] && !(d.text || '').includes(names[k])).map(k => names[k]).join(', ');
}
function cardFace(o, big, cls = '') {
  const d = def(o), fc = FAC[d.fac].c, onBoard = o.ctrl != null && (inPlay(o) || (G && G.players.some(pl => pl.relics.includes(o))));
  let st = '';
  if (d.type === 'Unit') {
    if (onBoard && inPlay(o)) {
      const s = stats(o), hp = s.h - o.damage;
      st = `<div class="st"><span class="${s.p > d.p ? 'up' : s.p < d.p ? 'down' : ''}">${s.p}</span>/<span class="${o.damage ? 'down' : s.h > d.h ? 'up' : ''}">${hp}</span></div>`;
    } else st = `<div class="st">${d.p}/${d.h}</div>`;
  }
  const b = [];
  if (onBoard) {
    if (o.runes) b.push(`ᚱ ${o.runes} rune${o.runes > 1 ? 's' : ''}`);
    if (o.counters) b.push(`+${o.counters}/+${o.counters}`);
    if (o.marked) b.push('<span class="mk">Marked</span>');
    if (o.chapter) b.push(`Chapter ${['', 'I', 'II', 'III'][o.chapter]}`);
    if (o.data && o.data.bound) { const t = findUid(o.data.bound); if (t && inPlay(t)) b.push('Binding ' + esc(def(t).name)); }
    if (inPlay(o)) {
      if (o.sick && !hasKw(o, 'swift')) b.push('Just arrived');
      if (isBound(o)) b.push('Bound');
      if (o.skipUntap) b.push('Frozen');
      if (o.noDmg) b.push('Smoked');
      [...new Set([...o.tkw, ...o.pkw])].forEach(k => b.push(k[0].toUpperCase() + k.slice(1)));
      if (!d.kw.includes('venom') && hasKw(o, 'venom') && !o.tkw.includes('venom')) b.push('Venom');
    }
  }
  const kl = kwLine(o), id = d.token ? '' : d.id, tl = (d.text || '').length;
  const classes = ['card', big ? 'big' : '', cls, onBoard && inPlay(o) && o.tapped ? 'tapped' : '', d.name.length > 19 ? 'longname' : '', tl > 150 ? 'xlong' : tl > 105 ? 'long' : ''].join(' ');
  const hasArt = id && typeof CARD_ART !== 'undefined' && CARD_ART.has(id);
  const art = hasArt ? `<div class="art" style="background-image:url('art/${id}.webp')"></div>` : `<div class="art ph"><span>${FAC[d.fac].s}</span></div>`;
  return `<div class="${classes}" style="--fc:${fc};--frame:url('frames/${d.fac.toLowerCase()}.webp')" data-act="card" data-uid="${o.uid || ''}" data-def="${id}" tabindex="0">`
    + art
    + `<div class="hd"><span class="nm">${esc(d.name)}</span>${d.token || d.type === 'Mana' ? '' : `<span class="cost">${costStr(d)}</span>`}</div>`
    + `<div class="ty"><span>${d.token ? 'Token ' : ''}${d.type}${kl ? ' · ' + kl : ''}</span>${d.rar && typeof RARITY !== 'undefined' ? `<span class="rar r${d.rar}" title="${RARITY[d.rar]}">${RARITY[d.rar]}</span>` : ''}</div>`
    + `<div class="wm" aria-hidden="true">${FAC[d.fac].s}</div><div class="tx">${esc(d.text || '')}</div>`
    + (b.length ? `<div class="bd">${b.map(x => x.startsWith('<span') ? x : `<span>${x}</span>`).join('')}</div>` : '')
    + st + `</div>`;
}

function candCls(o, zone) {
  const q = G.pending; if (!q || G.over) return '';
  const uid = o.uid;
  if (q.kind === 'pick' && q.uids.includes(uid)) return 'cand';
  if (q.kind === 'react' && q.cards.includes(uid)) return 'cand';
  if (q.kind === 'attack') { if (UI.atk.has(uid)) return 'sel atk'; if (q.cands.includes(uid)) return 'cand'; }
  if (q.kind === 'block') {
    const isBlocker = Object.values(q.pairs).some(l => l.includes(uid));
    if (UI.blkSel === uid) return 'sel';
    if (Object.values(UI.blk).includes(uid)) return 'sel';
    if (q.attackers.includes(uid)) { const c = UI.blk[uid] ? 'atk sel' : 'atk'; return UI.blkSel && q.pairs[uid].includes(UI.blkSel) ? c + ' cand' : c; }
    if (isBlocker) return 'cand';
  }
  if (q.kind === 'main' && zone === 'hand' && q.who === G.viewer) {
    if (UI.sel === uid && !UI.selWell) return 'sel';
    const L = legalMain(q.who); if (L.cast.includes(uid) || (def(o).type === 'Mana' && L.well.includes(uid))) return 'play';
  }
  if (G.combat && inPlay(o) && o.attacking) return 'atk';
  return '';
}

function heroHTML(i, isTop) {
  const pl = P(i), h = HEROES[pl.fac], q = G.pending;
  const cand = q && q.kind === 'pick' && q.players && q.players.includes(i);
  const pw = curPower(i), pc = costStr({ g: pw.g, pips: pw.pips, fac: pl.fac });
  const mine = q && q.kind === 'main' && q.who === i && !isTop && !UI.sel;
  const L = mine ? legalMain(i) : null;
  const power = L ? `<button data-act="power" ${L.power ? '' : 'disabled'} title="Once per turn">Hero power (${pc}): ${esc(pw.label)}</button>`
    : `Hero power (${pc}): ${esc(pw.label)}${pl.hero.used && G.active === i ? ' <span class="muted">(used this turn)</span>' : ''}`;
  return `<div class="hero ${cand ? 'cand' : ''}" style="--fc:${FAC[pl.fac].c}" data-act="player" data-p="${i}">`
    + `<div class="life ${pl.life <= 5 ? 'low' : ''}" title="Life">${pl.life}</div>`
    + `<div class="hname">${esc(h.name)}${pl.hero.awakened ? '<span class="badge-aw">Awakened</span>' : ''}</div>`
    + `<div class="who">${esc(pl.name)}, ${pl.fac}${G.active === i ? ' (their turn)' : ''}</div>`
    + `<div class="pw">${power}</div>`
    + (pl.hero.awakened ? (h.awPassive ? `<div class="awk">${esc(h.awPassive)}</div>` : '') : `<div class="awk"><b>Awaken:</b> ${esc(h.awText)} (${h.prog(i)})</div>`)
    + `<div class="zones">Deck ${pl.deck.length}, hand ${pl.hand.length}, graveyard ${pl.grave.length}</div></div>`;
}
function wellHTML(i) {
  const pl = P(i), q = G.pending, ready = pl.well.filter(c => !c.tapped).length;
  const L = q && q.kind === 'main' && q.who === i && i === G.viewer ? legalMain(i) : null;
  const counts = {}; pl.well.forEach(c => { if (!c.tapped) { const f = def(c).fac; counts[f] = (counts[f] || 0) + 1; } });
  const mana = Object.entries(counts).map(([f, n]) => `${n}${FAC[f].s}`).join(' ');
  return `<div class="well"><div class="wl">Well: <b>${ready}</b> of ${pl.well.length} ready ${mana ? '(' + mana + ')' : ''}${pl.wellPlays && G.active === i ? ', card added this turn' : ''}</div><div class="wtiles">`
    + (pl.well.length ? pl.well.map(c => {
      const cand = (L && L.wellcast.includes(c.uid)) || (q && q.kind === 'pick' && q.uids.includes(c.uid));
      return `<div class="wt ${c.tapped ? 'tap' : ''} ${cand ? 'cand' : ''}" style="--fc:${FAC[def(c).fac].c}" data-act="well" data-uid="${c.uid}" data-def="${c.id}">${esc(def(c).name)}</div>`;
    }).join('') : '<span class="muted">Empty. Put one card here each turn to make mana.</span>') + `</div></div>`;
}
function areaHTML(i, isTop) {
  const pl = P(i);
  let hand;
  if (isTop) {
    hand = G.hidden ? (pl.hand.length ? `<div class="ohand">${pl.hand.map(() => '<div class="back"></div>').join('')}</div>` : '')
      : (pl.hand.length ? `<div class="ohand wtiles">${pl.hand.map(c => `<div class="wt" style="--fc:${FAC[def(c).fac].c}" data-uid="${c.uid}" data-def="${c.id}">${esc(def(c).name)}</div>`).join('')}</div>` : '');
  } else hand = `<div class="row handrow">${pl.hand.map(c => `<div class="hslot">${cardFace(c, false, candCls(c, 'hand'))}${UI.sel === c.uid && !UI.selWell ? cardMenuHTML(c) : ''}</div>`).join('') || '<span class="muted">No cards in hand.</span>'}</div>`;
  const relics = pl.relics.map(r => cardFace(r, false, candCls(r, 'relic'))).join('');
  const units = pl.board.map(u => cardFace(u, false, candCls(u, 'board'))).join('');
  const board = `<div class="row battlefield ${pl.board.length || pl.relics.length ? '' : 'empty'}" data-empty="${esc(pl.name)}'s battlefield is empty.">${relics}${relics && units ? '<div class="sep"></div>' : ''}${units}</div>`;
  const col = `<div class="hcol">${heroHTML(i, isTop)}${wellHTML(i)}${isTop ? hand : ''}</div>`;
  return `<section class="parea ${isTop ? 'top' : 'bottom'}"><div class="tablerow">${col}${board}</div>${isTop ? '' : hand}</section>`;
}
// MTG-style phase tracker. Ready and Draw happen on their own; the player acts in Main 1, Combat and Main 2.
const PHASES = [['ready', 'Ready'], ['draw', 'Draw'], ['main1', 'Main 1'], ['combat', 'Combat'], ['main2', 'Main 2'], ['end', 'End']];
function phaseKey() {
  const q = G.pending;
  if (!G.turn) return '';
  if (G.over) return 'end';
  if (q && (q.kind === 'attack' || q.kind === 'block')) return 'combat';
  if (G.phase === 'Blocks' || G.phase === 'Damage' || (G.combat && G.combat.length)) return 'combat';
  if (G.phase === 'Main') return G.attacked ? 'main2' : 'main1';
  return ({ Ready: 'ready', Draw: 'draw', End: 'end' })[G.phase] || '';
}
function phaseHTML() {
  const k = phaseKey(), mine = G.active === G.viewer;
  return `<ol class="phases ${mine ? 'mine' : 'theirs'}" aria-label="Turn phases">${PHASES.map(([key, label]) => `<li class="${key === k ? 'now' : ''}" ${key === k ? 'aria-current="step"' : ''}>${label}</li>`).join('')}</ol>`;
}
// The menu that opens on a hand card you click during your main phase.
function cardMenuHTML(c) {
  const q = G.pending, L = legalMain(q.who), d = def(c), cs = costStr(costOf(q.who, d));
  let h = '';
  if (d.type === 'Mana') {
    h += L.well.includes(c.uid) ? `<button data-act="towell">Play ${esc(d.name)}</button>` : `<p>You've already played a Mana card this turn.</p>`;
  } else {
    if (L.cast.includes(c.uid)) h += `<button data-act="cast">Cast for ${cs}</button>`;
    else h += `<p>${d.type === 'Reaction' ? 'Reactions are played on your opponent’s turn, when they cast a card or attack.' : `Not enough mana to cast this (costs ${cs}).`}</p>`;
    if (L.well.includes(c.uid)) h += `<button data-act="towell" class="ghost">Put into Well as mana</button>`;
  }
  return `<div class="cardmenu" role="menu">${h}<button data-act="unsel" class="linkish">Cancel</button></div>`;
}
function midHTML() {
  const q = G.pending, mine = G.active === G.viewer;
  let banner = mine ? 'Your turn' : `${esc(P(G.active).name)}’s turn`, prompt = '', main = '', alt = '';
  const B = (act, label, extra = '') => `<button class="primary" data-act="${act}" ${extra}>${label}</button>`;
  const S = (act, label, extra = '') => `<button class="ghost" data-act="${act}" ${extra}>${label}</button>`;
  if (!G.turn) banner = 'Opening hand';
  if (G.over) { banner = G.winner === G.viewer ? 'Victory' : 'Defeat'; prompt = `<b>${esc(P(G.winner).name)} wins!</b> ${G.rewardText ? esc(G.rewardText) : ''}`; main = B('home', 'Back to home'); }
  else if (q) {
    switch (q.kind) {
      case 'main': {
        const L = legalMain(q.who), pl = P(q.who), k = phaseKey();
        if (UI.sel && UI.selWell) {
          const d = def(findUid(UI.sel));
          prompt = `Cast ${nm(d.name)} from your Well?`;
          main = B('wellcast', `Cast for ${costStr(costOf(q.who, d))}`); alt = S('unsel', 'Cancel');
        } else {
          const tips = [];
          if (L.well.length && !pl.wellPlays) tips.push(pl.hand.some(c => def(c).type === 'Mana') ? 'Play a Mana card' : 'Put a card into your Well for mana');
          if (L.cast.length) tips.push('cast glowing cards');
          if (L.power) tips.push('use your hero power');
          if (k === 'main1' && L.attack) tips.push('then go to combat');
          prompt = tips.length ? tips.join(', ').replace(/^./, x => x.toUpperCase()) + '.' : 'Nothing else to play this turn.';
          if (k === 'main1' && L.attack) { main = B('attack', 'Go to combat'); alt = S('end', 'End turn'); }
          else main = B('end', 'End turn');
        }
        break;
      }
      case 'attack': banner = 'Combat: choose attackers';
        prompt = `${UI.atk.size ? `${UI.atk.size} attacking.` : 'Click your untapped units to attack with them.'} <span class="muted">${esc(q.prompt)}</span>`;
        main = UI.atk.size ? B('confirmAttack', `Attack with ${UI.atk.size}`) : B('cancelAttack', 'No attack');
        if (UI.atk.size) alt = S('cancelAttack', 'Cancel'); break;
      case 'block': { banner = 'Combat: choose blockers'; const n = Object.keys(UI.blk).length;
        prompt = UI.blkSel ? 'Now click the attacker it should block.' : 'Click one of your units, then the attacker it blocks.';
        main = B('confirmBlock', n ? `Confirm ${n} block${n > 1 ? 's' : ''}` : 'No blocks'); break; }
      case 'react': banner = mine ? 'Your turn: respond?' : 'Respond?';
        prompt = `${q.prompt} <span class="muted">Click a glowing Reaction to play it.</span>`; main = B('done', 'Pass'); break;
      case 'pick': banner = 'Choose a target';
        prompt = q.prompt + (q.players && q.players.length ? ' <span class="muted">Click a glowing unit or hero.</span>' : ' <span class="muted">Click a glowing card.</span>');
        if (q.optional) main = B('skip', 'Skip'); break;
      case 'buttons': prompt = q.prompt; main = q.options.length ? B('opt', esc(q.options[0][0]), 'data-k="0"') : '';
        alt = q.options.slice(1).map((o, k) => S('opt', esc(o[0]), `data-k="${k + 1}"`)).join(''); break;
      default: prompt = q.prompt || '';
    }
  } else prompt = '<span class="muted">The computer is thinking…</span>';
  const forfeit = typeof ONLINE !== 'undefined' && !G.over ? `<button data-act="forfeit" class="linkish" title="Counts as a loss">Forfeit</button>` : '';
  return `<div id="mid" class="${mine ? 'mine' : 'theirs'}"><div class="tbanner"><b>${banner}</b><span class="tn">Turn ${G.turn || 0}</span></div>${phaseHTML()}<div class="prompt">${prompt}</div><div class="btns">${alt}${main}${forfeit}</div></div>`;
}
function modalHTML() {
  const q = G.pending; if (!q || G.over) return '';
  if (q.kind === 'pass') { const n = esc(P(q.who).name); return `<div class="modal pass"><div class="box"><h2>Pass to ${n}</h2><p>The other player looks away. ${n}, click when you're ready to see your cards.</p><button data-act="passok">Show ${n}'s cards</button></div></div>`; }
  if (q.kind === 'cards') {
    const ok = UI.cards.size >= q.min && UI.cards.size <= q.max;
    return `<div class="modal"><div class="box"><h2>Choose ${q.min === q.max ? q.min : (q.min ? q.min + ' to ' + q.max : 'up to ' + q.max)}</h2><p>${q.prompt}</p><div class="cards">${q.cards.map(c => cardFace(c, false, UI.cards.has(c.uid) ? 'sel' : 'cand').replace('data-act="card"', 'data-act="mcard"')).join('')}</div><button data-act="mconfirm" ${ok ? '' : 'disabled'}>Confirm</button></div></div>`;
  }
  if (q.kind === 'order') {
    return `<div class="modal"><div class="box"><h2>Prophecy</h2><p>${q.prompt}</p><div class="cards">${q.cards.map(c => { const k = UI.order.indexOf(c.uid); return `<div style="position:relative">${cardFace(c, false, k >= 0 ? 'sel' : 'cand').replace('data-act="card"', 'data-act="ocard"')}${k >= 0 ? `<div class="ord">${k + 1}</div>` : ''}</div>`; }).join('')}</div><button data-act="oconfirm" ${UI.order.length === q.cards.length ? '' : 'disabled'}>Put back in this order</button> <button data-act="oreset" class="ghost">Start over</button></div></div>`;
  }
  if (q.kind === 'reveal') return `<div class="modal"><div class="box"><h2>Revealed</h2><p>${q.prompt}</p><div class="cards">${q.cards.length ? q.cards.map(c => cardFace(c, false).replace('data-act="card"', 'data-act="x"')).join('') : '<span class="muted">Their hand is empty.</span>'}</div><button data-act="ok">Done</button></div></div>`;
  return '';
}

function heroPreview(f) { const h = HEROES[f]; return `<b>${esc(h.name)}</b>, ${h.life} life. Power: ${esc(h.power.label)}. Awakens when: ${esc(h.awText.toLowerCase())}.`; }
function setupHTML() {
  const facs = Object.keys(HEROES);
  const sel = (i, d) => `<select id="d${i}" data-act="deckpick">${facs.map(f => `<option value="${f}" ${f === d ? 'selected' : ''}>${f}: ${esc(HEROES[f].name)}</option>`).join('')}</select>`;
  return `<div class="setup"><h1>Untitled TCG</h1><p class="sub">A playable prototype of the six starter decks (55 cards each). Two players share one screen and take turns.</p>
  <div class="seats">
    <div class="seat"><label for="n0">Player 1 name</label><input id="n0" value="Player 1"><label for="d0">Deck</label>${sel(0, 'Warbound')}<div class="hp" id="hp0">${heroPreview('Warbound')}</div></div>
    <div class="seat"><label for="n1">Player 2 name</label><input id="n1" value="Player 2"><label for="d1">Deck</label>${sel(1, 'Lorebound')}<div class="hp" id="hp1">${heroPreview('Lorebound')}</div></div>
  </div>
  <label class="chk"><input type="checkbox" id="hid" checked> Hide each player's hand from the other. The screen asks you to pass the device whenever the other player needs to make a choice.</label>
  <button data-act="start">Start game</button>
  <div class="quick"><h2>How a turn works</h2><ol>
    <li>Your units and Well untap, and you draw a card.</li>
    <li>Once per turn, play a Mana card into your Well. No Mana card? Put any other card in instead. Each Well card makes 1 mana of its faction.</li>
    <li>Cast cards, use your hero power once, and attack once. Click a card in your hand to see your options.</li>
    <li>Your opponent can answer with Reactions when you cast a card or attack, and chooses blockers.</li>
    <li>Bring the other hero to 0 life to win. Hover any card to read it in full on the right.</li>
  </ol></div></div>`;
}

function render() {
  if (typeof document === 'undefined') return;
  const app = document.getElementById('app');
  if (!G) { app.innerHTML = hubHTML(); return; }
  const v = G.viewer, t = O(v);
  const insp = INSP ? cardFace(INSP, true) : '<div class="hint">Hover over any card to read it here at full size.</div>';
  app.innerHTML = `<div id="game"><main id="board">${areaHTML(t, true)}${midHTML()}${areaHTML(v, false)}</main>`
    + `<aside class="side"><div id="insp">${insp}</div><div id="log" aria-live="polite">${G.log.map(l => `<div>${l}</div>`).join('')}</div></aside></div>${modalHTML()}`
    + (typeof TOAST !== 'undefined' && TOAST ? `<div class="toast" role="status">${esc(TOAST)}</div>` : '');
}

function onClick(e) {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act;
  if (act === 'start') { startRanked(); return; }
  if (act === 'logout' && e.preventDefault) e.preventDefault();
  if (act === 'home' || act === 'forfeit' || (!G && typeof hubClick === 'function')) { if (hubClick(el, act)) return; }
  if (!G || !G.pending) return;
  const q = G.pending, uid = el.dataset.uid ? +el.dataset.uid : null;
  switch (act) {
    case 'passok': if (q.kind === 'pass') answer(); break;
    case 'card': cardClick(uid); break;
    case 'well':
      if (q.kind === 'main' && q.who === G.viewer && legalMain(q.who).wellcast.includes(uid)) { UI.sel = uid; UI.selWell = true; render(); }
      else if (q.kind === 'pick' && q.uids.includes(uid)) answer({ uid });
      break;
    case 'player': if (q.kind === 'pick' && q.players && q.players.includes(+el.dataset.p)) answer({ p: +el.dataset.p }); break;
    case 'power': if (q.kind === 'main') answer({ type: 'power' }); break;
    case 'attack': if (q.kind === 'main') answer({ type: 'attack' }); break;
    case 'end': if (q.kind === 'main') answer({ type: 'end' }); break;
    case 'cast': answer({ type: 'cast', uid: UI.sel }); break;
    case 'towell': answer({ type: 'well', uid: UI.sel }); break;
    case 'wellcast': answer({ type: 'wellcast', uid: UI.sel }); break;
    case 'unsel': UI.sel = null; UI.selWell = false; render(); break;
    case 'skip': answer(null); break;
    case 'confirmAttack': answer([...UI.atk]); break;
    case 'cancelAttack': answer([]); break;
    case 'done': answer(null); break;
    case 'confirmBlock': answer(Object.assign({}, UI.blk)); break;
    case 'opt': answer(q.options[+el.dataset.k][1]); break;
    case 'mcard': if (q.kind === 'cards') { if (UI.cards.has(uid)) UI.cards.delete(uid); else { if (q.max === 1) UI.cards.clear(); if (UI.cards.size < q.max) UI.cards.add(uid); } render(); } break;
    case 'mconfirm': answer(q.cards.filter(c => UI.cards.has(c.uid))); break;
    case 'ocard': if (!UI.order.includes(uid)) { UI.order.push(uid); render(); } break;
    case 'oreset': UI.order = []; render(); break;
    case 'oconfirm': answer(UI.order.map(u => q.cards.find(c => c.uid === u))); break;
    case 'ok': answer(); break;
  }
}
function cardClick(uid) {
  const q = G.pending, c = findUid(uid); if (!c) return;
  if (q.kind === 'main' && q.who === G.viewer && P(G.viewer).hand.includes(c)) {
    if (UI.sel === uid && !UI.selWell) { UI.sel = null; render(); return; } // click again to close the menu
    if (def(c).type === 'Mana' && legalMain(q.who).well.includes(uid)) { answer({ type: 'well', uid }); return; } // Mana cards play in one click
    UI.sel = uid; UI.selWell = false; render(); return;
  }
  if (q.kind === 'react' && q.cards.includes(uid)) { answer(uid); return; }
  if (q.kind === 'pick' && q.uids.includes(uid)) { answer({ uid }); return; }
  if (q.kind === 'attack' && q.cands.includes(uid)) { UI.atk.has(uid) ? UI.atk.delete(uid) : UI.atk.add(uid); render(); return; }
  if (q.kind === 'block') {
    const isBlocker = Object.values(q.pairs).some(l => l.includes(uid));
    if (isBlocker) {
      for (const [a, b] of Object.entries(UI.blk)) if (b === uid) { delete UI.blk[a]; UI.blkSel = null; render(); return; }
      UI.blkSel = UI.blkSel === uid ? null : uid; render(); return;
    }
    if (q.attackers.includes(uid) && UI.blkSel && q.pairs[uid].includes(UI.blkSel)) { UI.blk[uid] = UI.blkSel; UI.blkSel = null; render(); return; }
  }
}
function onHover(e) {
  if (!G) return;
  const el = e.target.closest('.card,.wt'); if (!el || el.classList.contains('big')) return;
  let o = el.dataset.uid ? findUid(+el.dataset.uid) : null;
  if (!o && G.pending && G.pending.cards) o = G.pending.cards.find(c => c.uid === +el.dataset.uid) || null;
  if (!o && el.dataset.def) o = { id: el.dataset.def };
  if (!o || o === INSP) return;
  INSP = o;
  const b = document.getElementById('insp'); if (b) b.innerHTML = cardFace(o, true);
}
function onChange(e) {
  const m = e.target.id && e.target.id.match(/^d(\d)$/);
  if (m) { const hp = document.getElementById('hp' + m[1]); if (hp) hp.innerHTML = heroPreview(e.target.value); }
}
function onKey(e) {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.card[tabindex]')) { e.preventDefault(); onClick({ target: e.target }); }
}
if (typeof document !== 'undefined') {
  document.addEventListener('click', onClick);
  document.addEventListener('mouseover', onHover);
  document.addEventListener('focusin', onHover);
  document.addEventListener('change', onChange);
  document.addEventListener('keydown', onKey);
  render();
  initAccount();
}
