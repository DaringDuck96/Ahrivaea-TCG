// ================= UI =================
let UI = {}, INSP = null;
function resetUI() { UI = { sel: null, selWell: false, atk: new Set(), blk: {}, blkSel: null, cards: new Set(), order: [] }; }
resetUI();

function kwLine(o) {
  const d = def(o); const names = { flying: 'Flying', swift: 'Swift', guard: 'Guard', drain: 'Drain', venom: 'Venom', ambush: 'Ambush', unblockable: 'Unblockable', illusion: 'Illusion' };
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
  const kl = kwLine(o);
  const classes = ['card', big ? 'big' : '', cls, onBoard && inPlay(o) && o.tapped ? 'tapped' : ''].join(' ');
  return `<div class="${classes}" style="--fc:${fc}" data-act="card" data-uid="${o.uid || ''}" data-def="${d.token ? '' : d.id}" tabindex="0">`
    + `<div class="hd"><span class="nm">${esc(d.name)}</span>${d.token || d.type === 'Mana' ? '' : `<span class="cost">${costStr(d)}</span>`}</div>`
    + `<div class="ty">${d.token ? 'Token ' : ''}${d.type}${kl ? ' · ' + kl : ''}</div>`
    + `<div class="tx">${esc(d.text || '')}</div>`
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
  } else hand = `<div class="row handrow">${pl.hand.map(c => cardFace(c, false, candCls(c, 'hand'))).join('') || '<span class="muted">No cards in hand.</span>'}</div>`;
  const relics = pl.relics.map(r => cardFace(r, false, candCls(r, 'relic'))).join('');
  const units = pl.board.map(u => cardFace(u, false, candCls(u, 'board'))).join('');
  const board = `<div class="row battlefield ${pl.board.length || pl.relics.length ? '' : 'empty'}" data-empty="${esc(pl.name)}'s battlefield is empty.">${relics}${relics && units ? '<div class="sep"></div>' : ''}${units}</div>`;
  const col = `<div class="hcol">${heroHTML(i, isTop)}${wellHTML(i)}${isTop ? hand : ''}</div>`;
  return `<section class="parea ${isTop ? 'top' : 'bottom'}"><div class="tablerow">${col}${board}</div>${isTop ? '' : hand}</section>`;
}
function midHTML() {
  const q = G.pending, a = P(G.active);
  let prompt = '', btns = '';
  if (G.over) { prompt = `<b>${esc(P(G.winner).name)} wins!</b> ${G.rewardText ? esc(G.rewardText) : ''}`; btns = `<button data-act="home">Back to home</button>`; }
  else if (q) {
    const who = q.who != null ? esc(P(q.who).name) : '';
    switch (q.kind) {
      case 'main': {
        const L = legalMain(q.who);
        if (UI.sel) {
          const c = findUid(UI.sel), d = def(c), cs = costStr(costOf(q.who, d));
          prompt = `${nm(d.name)}: what would you like to do?`;
          if (UI.selWell) btns += `<button data-act="wellcast">Cast from Well (${cs})</button>`;
          else {
            if (d.type === 'Mana') {
              if (L.well.includes(UI.sel)) btns += `<button data-act="towell">Play ${esc(d.name)}</button>`;
              else prompt += ' <span class="muted">You\u2019ve already added a card to your Well this turn.</span>';
            } else {
              if (L.cast.includes(UI.sel)) btns += `<button data-act="cast">Cast (${cs})</button>`;
              else prompt += ` <span class="muted">${d.type === 'Reaction' ? 'Reactions are played during your opponent’s turn.' : 'You can’t cast this right now.'}</span>`;
              if (L.well.includes(UI.sel)) btns += `<button data-act="towell" class="ghost">Use as mana (put into Well)</button>`;
            }
          }
          btns += `<button data-act="unsel" class="ghost">Back</button>`;
        } else {
          prompt = `${who}, it's your main phase. Click a card in your hand to cast it or add it to your Well.`;
          if (L.attack) btns += `<button data-act="attack">Attack</button>`;
          btns += `<button data-act="end" class="ghost">End turn</button>`;
        }
        break;
      }
      case 'pick': prompt = q.prompt + (q.players && q.players.length ? ' <span class="muted">Click a highlighted unit or hero.</span>' : ' <span class="muted">Click a highlighted card.</span>'); if (q.optional) btns = `<button data-act="skip" class="ghost">Skip</button>`; break;
      case 'attack': prompt = `${q.prompt} <span class="muted">${UI.atk.size} selected.</span>`; btns = `<button data-act="confirmAttack" ${UI.atk.size ? '' : 'disabled'}>Attack with ${UI.atk.size}</button><button data-act="cancelAttack" class="ghost">Cancel</button>`; break;
      case 'react': prompt = `${q.prompt} <span class="muted">Click a highlighted card to play it.</span>`; btns = `<button data-act="done" class="ghost">Don't respond</button>`; break;
      case 'block': prompt = q.prompt + (UI.blkSel ? ' <span class="muted">Now click the attacker it blocks.</span>' : ''); btns = `<button data-act="confirmBlock">Confirm blocks</button>`; break;
      case 'buttons': prompt = q.prompt; btns = q.options.map((o, k) => `<button data-act="opt" data-k="${k}" ${k ? 'class="ghost"' : ''}>${esc(o[0])}</button>`).join(''); break;
      default: prompt = q.prompt || '';
    }
  } else prompt = '<span class="muted">The computer is thinking…</span>';
  if (typeof ONLINE !== 'undefined' && !G.over) btns += `<button data-act="forfeit" class="ghost" title="Counts as a loss">Forfeit</button>`;
  return `<div id="mid"><div class="turn">Turn ${G.turn || 0}, ${esc(a.name)}</div><div class="prompt">${prompt}</div><div class="btns">${btns}</div></div>`;
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
  if (q.kind === 'main' && q.who === G.viewer && P(G.viewer).hand.includes(c)) { UI.sel = uid; UI.selWell = false; render(); return; }
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
