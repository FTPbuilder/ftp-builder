"use strict";
// FTP Builder · ajustement selon la forme du jour
/* ============ ajuster une séance selon la forme du jour ============ */
function adjustHTML(s, compact=false){
  if (s.status !== 'planned' || WORKOUTS[s.workoutId].type === 'test') return '';
  const easier = neighbor(s.workoutId, -1), harder = neighbor(s.workoutId, 1), k = sAdj(s);
  const chip = v => `<button type="button" class="${Math.abs(k - v) < 0.001 ? 'on' : ''}" data-sadj="${v}" data-sid="${s.id}">${v === 1 ? 'Prévu' : (v > 1 ? '+' : '−') + Math.round(Math.abs(v-1)*100) + ' %'}</button>`;
  return `<details class="adj" ${compact ? '' : 'open'} style="margin-top:12px"><summary class="small" style="cursor:pointer;color:var(--accent);font-weight:600">Ajuster : plus facile, plus dur, reporter</summary>
    <div class="row" style="margin-top:10px;gap:6px">
      ${easier ? `<button class="btn sm" data-sx="easier" data-sid="${s.id}" title="${esc(WORKOUTS[easier].name)}">⬇ Plus facile <span class="tiny muted">· ${esc(WORKOUTS[easier].name)}</span></button>` : ''}
      ${harder ? `<button class="btn sm" data-sx="harder" data-sid="${s.id}" title="${esc(WORKOUTS[harder].name)}">⬆ Plus dur <span class="tiny muted">· ${esc(WORKOUTS[harder].name)}</span></button>` : ''}
    </div>
    <div class="small muted" style="margin:10px 0 4px">Intensité de cette séance</div>
    <div class="seg">${[0.95, 0.97, 1, 1.03, 1.05].map(chip).join('')}</div>
    <div class="row" style="margin-top:10px;gap:6px">
      <button class="btn sm" data-sx="post" data-sid="${s.id}">Reporter</button>
      ${s.workoutId !== 'rec_45' ? `<button class="btn sm" data-sx="rec" data-sid="${s.id}">Remplacer par une récup</button>` : ''}
      ${s.origWorkoutId && s.origWorkoutId !== s.workoutId ? `<button class="btn sm ghost" data-sx="orig" data-sid="${s.id}">Revenir à « ${esc(WORKOUTS[s.origWorkoutId].name)} »</button>` : ''}
    </div></details><div style="height:12px"></div>`;
}
// suggestion du jour à partir de l'indice de forme et des ressentis récents
function formeHint(s){
  if (s.status !== 'planned' || !isHard(s.workoutId)) return '';
  const sc = (typeof Health !== 'undefined') ? Health.score() : null;
  const lastFeel = S.activities.filter(a => a.feel?.rpe).sort((a,b) => b.date.localeCompare(a.date))[0];
  let msg = '', btns = '';
  if (sc && sc.v < 40) { msg = `Énergie ${sc.v}/100 : ton corps n'a pas récupéré.`; btns = `<button class="btn sm" data-sx="post" data-sid="${s.id}">Reporter</button><button class="btn sm" data-sx="rec" data-sid="${s.id}">Récup à la place</button>`; }
  else if (sc && sc.v < 55) { msg = `Énergie ${sc.v}/100 : garde la séance mais lève un peu le pied.`; btns = `<button class="btn sm" data-sadj="0.95" data-sid="${s.id}">Cibles −5 %</button>${neighbor(s.workoutId,-1) ? `<button class="btn sm" data-sx="easier" data-sid="${s.id}">Version plus facile</button>` : ''}`; }
  else if (sc && sc.v >= 80 && (!lastFeel || lastFeel.feel.rpe <= 7)) { msg = `Énergie ${sc.v}/100 : tu es frais. Tu peux viser un cran au-dessus si les jambes répondent à l'échauffement.`; btns = `<button class="btn sm" data-sadj="1.03" data-sid="${s.id}">Cibles +3 %</button>${neighbor(s.workoutId,1) ? `<button class="btn sm" data-sx="harder" data-sid="${s.id}">Version plus dure</button>` : ''}`; }
  if (!msg) return '';
  return `<div class="note ${sc.v < 55 ? 'bad' : 'ok'}" style="margin:12px 0 0">${esc(msg)}<div class="row" style="margin-top:8px;gap:6px">${btns}</div></div>`;
}
function postpone(s){
  for (let k = 1; k <= 3; k++) {
    const d = addDays(s.date < todayISO() ? todayISO() : s.date, k);
    if (d > S.profile.endDate) break;
    if ((S.profile.absences || []).some(a => d >= a.from && d <= a.to)) continue;
    if (S.plan.some(x => x.id !== s.id && x.date === d && x.status === 'planned' && mandatory(x))) continue;
    if (hardConflict(s, d)) continue;
    for (const x of S.plan) if (x.date === d && x.status === 'planned' && !mandatory(x)) x.status = 'skipped'; // la sortie optionnelle cède sa place
    const from = s.date; s.date = d; s.week = Math.floor(diffDays(monday(S.profile.startDate), d)/7);
    S.plan.sort((a,b) => a.date.localeCompare(b.date));
    return { ok: true, from, to: d };
  }
  return { ok: false };
}
document.addEventListener('click', e => {
  const a = e.target.closest('[data-sx],[data-sadj]'); if (!a) return;
  const s = S.plan.find(x => x.id === a.dataset.sid); if (!s) return;
  const inDlg = !!a.closest('#dlg');
  if (a.dataset.sadj) { s.adj = +a.dataset.sadj; if (s.adj === 1) delete s.adj; toast(s.adj ? `Cibles ${s.adj > 1 ? '+' : '−'}${Math.round(Math.abs(s.adj-1)*100)} % pour cette séance` : 'Cibles prévues rétablies'); }
  else {
    const x = a.dataset.sx;
    if (x === 'easier' || x === 'harder' || x === 'rec') {
      const nw = x === 'rec' ? 'rec_45' : neighbor(s.workoutId, x === 'easier' ? -1 : 1); if (!nw) return;
      s.origWorkoutId ||= s.workoutId; s.workoutId = nw; delete s.adj;
      toast(`Séance remplacée : ${WORKOUTS[nw].name}`);
    } else if (x === 'orig') { s.workoutId = s.origWorkoutId; delete s.origWorkoutId; toast('Séance prévue rétablie'); }
    else if (x === 'post') { const r = postpone(s); if (!r.ok) { toast('Pas de créneau libre dans les 3 jours : choisis une date dans le détail de la séance'); if (!inDlg) sessionDlg(s.id); return; } toast(`Séance reportée au ${fmtDate(r.to)}`); }
  }
  save(); render(); if (inDlg) sessionDlg(s.id);
});
