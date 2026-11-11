"use strict";
// FTP Builder · test 20 min / rampe, absences
/* ============ test : 20 min <-> rampe ERG ============ */
function switchTestProtocol(proto){
  const wid = proto === 'ramp' ? 'ramp' : 'test20';
  S.profile.testProtocol = proto;
  let n = 0; for (const s of S.plan) if (s.status === 'planned' && WORKOUTS[s.workoutId].type === 'test') { s.workoutId = wid; n++; }
  save(); closeDlg(); render();
  toast(`${n} test${n>1?'s':''} passé${n>1?'s':''} en ${proto==='ramp'?'rampe ERG':'20 min'}`);
}

/* ============ absences : reprogrammer les séances ============ */
function absencesHTML(){
  const list = (S.profile.absences || []).filter(a => a.to >= addDays(todayISO(), -14));
  if (!list.length) return '';
  return `<div style="margin-top:12px">${list.map(a => `<div class="hist"><span>✈︎</span><div style="flex:1"><b>${fmtShort(a.from)} → ${fmtShort(a.to)}</b><div class="tiny muted">${a.moves.length} séance${a.moves.length>1?'s':''} reprogrammée${a.moves.length>1?'s':''}${a.label?` · ${esc(a.label)}`:''}</div></div><button class="btn sm ghost" data-undoabs="${a.id}">Annuler</button></div>`).join('')}</div>`;
}
const dayFree = (date, exceptIds, absFrom, absTo) => !(date >= absFrom && date <= absTo) && !S.plan.some(x => x.date === date && x.status !== 'skipped' && !exceptIds.has(x.id) && mandatory(x));
function hardOk(s, date, moved){
  if (!isHard(s.workoutId)) return true;
  return !S.plan.some(x => x.id !== s.id && x.status !== 'skipped' && isHard(moved.get(x.id)?.workoutId || x.workoutId) && Math.abs(diffDays(moved.get(x.id)?.date || x.date, date)) < 2 && !(moved.get(x.id)?.skip));
}
// propose une nouvelle date pour chaque séance tombant pendant l'absence
function planAbsence(from, to){
  const p = S.profile, t = todayISO();
  const hit = S.plan.filter(s => s.status === 'planned' && s.date >= from && s.date <= to).sort((a,b) => (mandatory(b)-mandatory(a)) || a.date.localeCompare(b.date));
  const moved = new Map(); // id -> {date, skip}
  const taken = new Set();
  for (const s of hit) {
    if (!mandatory(s)) { moved.set(s.id, { date: s.date, skip: true, reason: 'optionnelle' }); continue; }
    const cands = [];
    for (let k = -4; k <= 9; k++) {
      const d = k < 0 ? addDays(from, k) : addDays(to, k + 1);
      if (d <= t || d > p.endDate) continue; // à partir de demain
      if (taken.has(d)) continue;
      const avail = p.days[dowMon(d)]?.avail;
      if (!dayFree(d, new Set([s.id]), from, to)) continue;
      if (!hardOk(s, d, moved)) continue;
      // éviter d'empiler le test juste avant/après une séance clé
      const dist = k < 0 ? -k : k + 1;
      const score = (avail ? 0 : 6) + dist + (k < 0 ? 0.5 : 0) + (WORKOUTS[s.workoutId].type === 'test' && k < 0 && dist === 1 ? 2 : 0);
      cands.push({ d, score });
    }
    cands.sort((a,b) => a.score - b.score);
    if (cands.length) { moved.set(s.id, { date: cands[0].d, skip: false }); taken.add(cands[0].d); }
    else moved.set(s.id, { date: s.date, skip: true, reason: 'pas de créneau' });
  }
  // un test doit précéder les séances clés suivantes (leurs watts en dépendent) : on échange
  for (const [id, m] of [...moved]) {
    const s = S.plan.find(x => x.id === id);
    if (m.skip || WORKOUTS[s.workoutId].type !== 'test') continue;
    const before = S.plan.filter(x => x.status === 'planned' && !moved.has(x.id) && mandatory(x) && WORKOUTS[x.workoutId].type !== 'test' && x.date > to && x.date < m.date).sort((a,b)=>a.date.localeCompare(b.date))[0];
    if (before) { const d = m.date; moved.set(id, { date: before.date, skip: false }); moved.set(before.id, { date: d, skip: false, reason: 'échangée avec le test pour qu’il passe en premier' }); }
  }
  // les séances optionnelles qui gênent un créneau choisi sont sautées
  const bump = [];
  for (const [id, m] of moved) if (!m.skip) for (const x of S.plan) if (x.date === m.date && x.status === 'planned' && !mandatory(x) && !moved.has(x.id)) bump.push(x);
  for (const x of bump) moved.set(x.id, { date: x.date, skip: true, reason: 'remplacée par une séance déplacée' });
  return { hit: [...moved.keys()].map(id => S.plan.find(s => s.id === id)), moved };
}
function absenceDlg(){
  const t = todayISO();
  openDlg(`<h2>Absence / vacances</h2><p class="muted small">Indique tes dates : je propose où recaser chaque séance, tu ajustes si besoin.</p>
    <div class="grid2"><div><label class="f" for="abFrom">Du</label><input type="date" id="abFrom" value="${addDays(t,2)}"></div><div><label class="f" for="abTo">Au (inclus)</label><input type="date" id="abTo" value="${addDays(t,5)}"></div></div>
    <label class="f" for="abLabel">Note (facultatif)</label><input type="text" id="abLabel" placeholder="Vacances, déplacement pro…">
    <div id="abPrev" style="margin-top:12px"></div>`);
  const prev = () => {
    const from = $('#abFrom').value, to = $('#abTo').value;
    if (!from || !to || to < from) { $('#abPrev').innerHTML = '<p class="small" style="color:var(--bad)">Vérifie les dates.</p>'; return; }
    const { hit, moved } = planAbsence(from, to);
    if (!hit.length) { $('#abPrev').innerHTML = `<div class="note ok">Aucune séance prévue sur ces dates : rien à déplacer.</div><div class="row"><button class="btn primary" id="abOk">Enregistrer l'absence</button></div>`; $('#abOk').onclick = () => applyAbsence(from, to, new Map()); return; }
    $('#abPrev').innerHTML = `<h3>${hit.length} séance${hit.length>1?'s':''} concernée${hit.length>1?'s':''}</h3>` + hit.sort((a,b)=>a.date.localeCompare(b.date)).map(s => {
      const m = moved.get(s.id);
      return `<div class="hist" style="flex-wrap:wrap"><div style="flex:1;min-width:160px"><b>${esc(WORKOUTS[s.workoutId].name)}</b><div class="tiny muted">prévue ${fmtDate(s.date)}${mandatory(s)?'':' · optionnelle'}</div></div>
        <div class="row" style="gap:6px"><select data-abmode="${s.id}" style="width:auto;min-height:36px;padding:4px 8px"><option value="move" ${m.skip?'':'selected'}>Déplacer au</option><option value="skip" ${m.skip?'selected':''}>Sauter</option></select>
        <input type="date" data-abdate="${s.id}" value="${m.date}" style="width:auto;min-height:36px;padding:4px 8px" ${m.skip?'disabled':''}></div>
        ${m.reason ? `<div class="tiny muted" style="width:100%">${esc(m.reason)}</div>` : ''}<div class="tiny" data-abwarn="${s.id}" style="width:100%;color:var(--warn)"></div></div>`;
    }).join('') + `<div class="row" style="margin-top:12px"><button class="btn primary" id="abOk">Appliquer</button></div>`;
    const check = () => {
      const tmp = new Map(); dlgBody.querySelectorAll('[data-abmode]').forEach(sel => { const id = sel.dataset.abmode; tmp.set(id, { skip: sel.value==='skip', date: dlgBody.querySelector(`[data-abdate="${id}"]`).value }); });
      for (const [id, m] of tmp) { const s = S.plan.find(x=>x.id===id); const w = dlgBody.querySelector(`[data-abwarn="${id}"]`); dlgBody.querySelector(`[data-abdate="${id}"]`).disabled = m.skip;
        w.textContent = m.skip ? '' : (m.date >= from && m.date <= to) ? '⚠️ toujours pendant ton absence' : tentativeConflict(s, m.date, tmp); }
      return tmp;
    };
    dlgBody.querySelectorAll('[data-abmode],[data-abdate]').forEach(el => el.onchange = check); check();
    $('#abOk').onclick = () => applyAbsence(from, to, check());
  };
  $('#abFrom').onchange = prev; $('#abTo').onchange = prev; prev();
}
function tentativeConflict(s, date, tmp){ // comme hardConflict, mais avec les déplacements proposés
  if (!isHard(s.workoutId)) return '';
  const near = S.plan.find(x => { if (x.id === s.id) return false; const m = tmp.get(x.id); if (m?.skip || (!m && x.status === 'skipped')) return false;
    return isHard(x.workoutId) && Math.abs(diffDays(m ? m.date : x.date, date)) < 2; });
  return near ? `⚠️ ${WORKOUTS[near.workoutId].name} à moins de 48 h` : '';
}
function applyAbsence(from, to, choices){
  const p = S.profile; p.absences ||= [];
  const rec = { id: uid(), from, to, label: $('#abLabel')?.value.trim() || '', moves: [] };
  for (const [id, m] of choices) {
    const s = S.plan.find(x => x.id === id); if (!s) continue;
    rec.moves.push({ id, date: s.date, status: s.status, week: s.week });
    if (m.skip) s.status = 'skipped';
    else { s.date = m.date; s.week = Math.floor(diffDays(monday(p.startDate), m.date)/7); }
  }
  // jours indisponibles mémorisés pour les prochaines régénérations
  p.absences.push(rec);
  S.plan.sort((a,b)=>a.date.localeCompare(b.date));
  save(); closeDlg(); render();
  const mv = rec.moves.length; toast(mv ? `Absence enregistrée · ${mv} séance${mv>1?'s':''} reprogrammée${mv>1?'s':''}` : 'Absence enregistrée');
}
function undoAbsence(id){
  const p = S.profile; const a = (p.absences||[]).find(x => x.id === id); if (!a) return;
  for (const m of a.moves) { const s = S.plan.find(x => x.id === m.id); if (s && s.status !== 'done') { s.date = m.date; s.status = m.status; s.week = m.week; } }
  p.absences = p.absences.filter(x => x.id !== id);
  S.plan.sort((x,y)=>x.date.localeCompare(y.date)); save(); render(); toast('Absence annulée, séances remises à leur place');
}
