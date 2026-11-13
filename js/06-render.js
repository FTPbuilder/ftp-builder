"use strict";
// FTP Builder · rendu des onglets
/* ============ rendu ============ */
let TAB = 'today';
function applyTheme(){ const t = S.settings.theme; if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t); }
function render(){
  applyTheme(); applyWarmupPref();
  const app = $('#app'); const tabs = $('#tabs');
  // questionnaire déjà affiché : on n'y touche pas (un réaffichage pendant le chargement du compte faisait perdre le focus et la frappe en cours)
  if (!S.profile) { tabs.classList.add('hidden'); if (app.querySelector('.onb #qform')) return; app.innerHTML = onboardingHTML(); bindQuestionnaire(true); return; }
  tabs.classList.remove('hidden');
  tabs.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.tab === TAB));
  const head = `<header class="top"><div class="brand"><h1><span class="ftp">FTP</span><b>·</b>Builder</h1><small>v${APP_VERSION}</small></div><span class="chip num">FTP <b>${ftp()} W</b> · <b>${(ftp()/S.profile.weightKg).toFixed(2).replace('.', ',')}</b> W/kg</span></header>`;
  app.innerHTML = head + ({ today: todayHTML, cal: calHTML, prog: progHTML, profile: profileHTML })[TAB]();
  if (TAB === 'profile') bindQuestionnaire(false);
  if (TAB === 'profile' && PROFILE_PANE === 'garage') Garage.mount();
  moveTabPill();
  if (TAB === 'today' && TODAY_PANE === 'prog') bindArcs();
  // l'entrée de l'accueil (cartes + vague) ne joue qu'en arrivant, pas à chaque rafraîchissement.
  // Si un rafraîchissement tombe pendant l'entrée (synchro au démarrage…), elle continue là où elle en était.
  const home = document.querySelector('.home'), now = performance.now();
  // derrière l'écran d'ouverture, rien ne joue : l'entrée part quand il s'efface (il relance render())
  if (window.SPLASH_ON) return;
  if (home && !_homeShown) { _homeT0 = now; home.classList.add('arrive'); }
  if (home && now - _homeT0 < 2000) homeWave(_homeT0);
  _homeShown = !!home;
}
let _homeShown = false, _homeT0 = -1e9;
let _pillReady = false;
function moveTabPill(){
  const pill = $('#tabPill'), b = document.querySelector('#tabs button.on'); if (!pill || !b) return;
  if (!_pillReady) pill.classList.add('still');
  pill.style.left = b.offsetLeft + 'px'; pill.style.width = b.offsetWidth + 'px';
  if (!_pillReady && b.offsetWidth) { pill.offsetWidth; pill.classList.remove('still'); _pillReady = true; }
}
window.addEventListener('resize', () => { _pillReady = false; moveTabPill(); });
let TODAY_PANE = null;
document.addEventListener('click', e => {
  const b = e.target.closest('.tile[data-pane],.home [data-pane]'); if (b) { TODAY_PANE = b.dataset.pane; render(); window.scrollTo(0, 0); return; }
  if (e.target.closest('[data-paneback]')) { TODAY_PANE = null; render(); window.scrollTo(0, 0); }
});
$('#tabs').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (!b) return; if (b.dataset.tab === 'today') TODAY_PANE = null; if (b.dataset.tab === 'profile') PROFILE_PANE = null; TAB = b.dataset.tab; render(); window.scrollTo(0,0); });

/* ----- Aujourd'hui ----- */
// séances de la semaine en cours (vélo + nat / course) : faites / prévues, et tout ce qui reste à venir
function weekCount(){
  const t = todayISO(), w0 = monday(t), w1 = addDays(w0, 6), inW = d => d >= w0 && d <= w1;
  const refs = swapRefs(), swOk = x => x.swap && x.swap.sp !== 'rest';
  const bike = S.plan.filter(s => (s.status !== 'skipped' || swOk(s)) && inW(s.date) && mandatory(s));
  let done = bike.filter(s => s.status === 'done' || swOk(s)).length, total = bike.length;
  // sorties vélo hors plan comptées comme séances (case « compter comme une séance ») : elles remplissent d'abord une séance vélo encore ouverte
  const bikeOpen = bike.filter(s => s.status === 'planned').length, bikeX = S.activities.filter(a => !a.planId && a.countAsSession && inW(a.date) && !refs.has('a:' + a.id)).length;
  done += bikeX; total += Math.max(0, bikeX - bikeOpen);
  if (triOn()) for (const sp of ['swim', 'run']) {
    // nat / course : une séance faite un autre jour que prévu (ou avant la création du plan) remplit un créneau ouvert de la semaine, sinon s'ajoute
    const tp = (S.triPlan || []).filter(x => x.sport === sp && (x.status !== 'skipped' || swOk(x)) && inW(x.date));
    const okDates = new Set(tp.filter(x => triStatus(x) === 'done').map(x => x.date)), nSw = tp.filter(swOk).length;
    const extra = new Set(Health.extraWorkouts().filter(e => e.sport === sp && inW(e.date) && e.date <= t && (+e.w.duration_min || 0) >= 15 && !okDates.has(e.date) && !refs.has('w:' + e.w.start_at)).map(e => e.date)).size;
    const open = tp.length - okDates.size - nSw;
    done += okDates.size + nSw + extra; total += tp.length + Math.max(0, extra - open);
  }
  const left = S.plan.filter(s => s.status === 'planned' && s.date >= t && mandatory(s)).length + (triOn() ? (S.triPlan || []).filter(x => x.date >= t && triStatus(x) === 'planned').length : 0);
  return { done: Math.min(done, total), total, left };
}
// carte d'accueil : ce que je fais aujourd'hui, avec un conseil selon l'énergie du jour
function todayCardHTML(){
  const t = todayISO(), sc = Health.score();
  const bike = S.plan.filter(s => s.date === t && s.status !== 'skipped').map(s => { const W = WORKOUTS[s.workoutId];
    return { ic: '🚴', name: W.name, meta: `${fmtDur(wDur(s.workoutId))}${mainStep(s.workoutId) ? ` · ${watts(mainStep(s.workoutId).p, ftp(), sAdj(s))} W` : ''}`, done: s.status === 'done', hard: s.status === 'planned' && isHard(s.workoutId), attr: `data-open="${s.id}"`, s }; });
  const tp = triItems(t).filter(x => x.status !== 'skipped').map(x => { const W = triWorkout(x), E = triEst(x, W);
    return { ic: TRI_IC[x.sport], name: W.name, meta: x.sport === 'race' ? 'Jour J' : `${fmtDur(E.sec)} · ${x.sport === 'swim' ? E.m + ' m' : '~' + (E.m/1000).toFixed(1).replace('.', ',') + ' km'}`, done: triStatus(x) === 'done', hard: triStatus(x) === 'planned' && (x.wid === 'qual' || x.wid === 'long'), attr: `data-tri="${x.id}"`, x }; });
  const items = [...tp.filter(i => i.x.sport === 'swim'), ...bike, ...tp.filter(i => i.x.sport !== 'swim')];
  let body = '';
  if (items.length) body = items.map(i => `<button class="trow ${i.done ? 'done' : ''}" ${i.attr}><span class="ti">${i.ic}</span><span class="tm"><b>${esc(i.name)}</b><span class="tiny muted">${esc(i.meta)}</span></span><span class="tst">${i.done ? '✅' : '›'}</span></button>`).join('');
  else {
    const nb = S.plan.find(s => s.date > t && s.status === 'planned'), nt = triOn() ? (S.triPlan || []).find(x => x.date > t && triStatus(x) === 'planned') : null;
    const n = [nb && { d: nb.date, l: '🚴 ' + WORKOUTS[nb.workoutId].name, attr: `data-open="${nb.id}"` }, nt && { d: nt.date, l: TRI_IC[nt.sport] + ' ' + triWorkout(nt).name, attr: `data-tri="${nt.id}"` }].filter(Boolean).sort((a, b) => a.d.localeCompare(b.d))[0];
    body = `<p class="small" style="margin:0">Repos aujourd'hui.</p>${n ? `<button class="trow" ${n.attr}><span class="ti">📅</span><span class="tm"><b>${esc(n.l)}</b><span class="tiny muted">${diffDays(t, n.d) === 1 ? 'Demain' : fmtDate(n.d)}</span></span><span class="tst">›</span></button>` : ''}`;
  }
  // conseil : uniquement s'il reste une séance dure à faire aujourd'hui
  const hard = items.filter(i => i.hard), hb = hard.find(i => i.s);
  let tip = '';
  if (sc && hard.length) {
    if (sc.v < 40) tip = `<div class="note bad" style="margin:10px 0 0"><b>Énergie basse (${sc.v}).</b> Ton corps n'a pas récupéré : ${hb ? 'remplace par une récup ou reporte' : 'fais-la en version facile (footing / nage souple)'}.${hb ? `<div class="row" style="margin-top:8px;gap:6px"><button class="btn sm" data-sx="rec" data-sid="${hb.s.id}">Récup à la place</button><button class="btn sm" data-sx="post" data-sid="${hb.s.id}">Reporter</button></div>` : ''}</div>`;
    else if (sc.v < 55) tip = `<div class="note warn" style="margin:10px 0 0"><b>Énergie moyenne (${sc.v}).</b> Garde la séance mais lève un peu le pied.${hb ? `<div class="row" style="margin-top:8px;gap:6px"><button class="btn sm" data-sadj="0.95" data-sid="${hb.s.id}">Cibles −5 %</button>${neighbor(hb.s.workoutId, -1) ? `<button class="btn sm" data-sx="easier" data-sid="${hb.s.id}">Version plus facile</button>` : ''}</div>` : ''}</div>`;
    else if (sc.v >= 80) tip = `<div class="note ok" style="margin:10px 0 0"><b>Énergie haute (${sc.v}).</b> Feu vert : tu peux viser le haut des cibles si les jambes répondent à l'échauffement.</div>`;
  }
  const allDone = items.length && items.every(i => i.done);
  return `<div class="card today-card"><div class="row between" style="align-items:center"><div><h2 style="margin:0">Aujourd'hui</h2><span class="tiny muted">${fmtDate(t)}${triOn() ? ` · ${esc(tri().race.name)} J-${Math.max(0, diffDays(t, tri().race.date))}` : ''}</span></div>
      ${sc ? `<div class="tbatt" role="button" tabindex="0" data-i="score" aria-label="Énergie ${sc.v} sur 100, détail">${batterySVG(sc.v, 64)}<span class="tiny" style="color:${battCol(sc.v)}">${{ ok:'Prêt', mid:'Correct', warn:'Prudence', bad:'Récupère' }[sc.level]}</span></div>` : ''}</div>
    <div class="tlist">${body}</div>${allDone ? `<div class="note ok" style="margin:10px 0 0">Journée faite ✅</div>` : tip}</div>`;
}
function todayHTML(){
  const p = S.profile, t = todayISO();
  const next = S.plan.find(s => s.date >= t && s.status === 'planned');
  const todays = S.plan.filter(s => s.date === t);
  const done = countDone();
  const pct = clamp(done / p.minSessions * 100, 0, 100);
  const notes = coachNotes();
  let h = '';
  const progCard = `<div class="card"><div class="row between"><h2>Programme</h2><span class="muted small">jusqu'au ${fmtShort(p.endDate)}</span></div>
    <div class="grid3">
      <div class="kpi"><div class="v num">${done}<small>/${p.minSessions}</small></div><div class="l">Séances faites</div></div>
      <div class="kpi"><div class="v num">${ftp()}<small> W</small></div><div class="l">FTP actuelle</div></div>
      <div class="kpi"><div class="v num">${p.goalFtp}<small> W</small></div><div class="l">Objectif ${fmtShort(p.goalDate)}</div></div>
    </div><div class="bar" style="margin-top:12px"><i style="width:${pct}%"></i></div>
    <div class="tiny muted" style="margin-top:6px">${Math.max(diffDays(t,p.endDate),0)} jours restants · ${S.plan.filter(s=>s.status==='planned'&&mandatory(s)).length} séances clés prévues restantes</div></div>`;
  const sc = Health.score(), ll = lastLoad();
  const show0 = todays.length ? todays : (next ? [next] : []), s0 = show0[0], ms0 = s0 && mainStep(s0.workoutId);
  const chs = activeChallenges().map(c => ({ name:c.name, pct:Math.floor(clamp(chTotal(c)/c.target*100,0,100)) })).sort((x,y)=>y.pct-x.pct), chPct = chs.length ? chs[0].pct : 0;
  const sh = sportHoursRolling(), wk = weekCount();
  const tiles = [
    { k:'prog', l:'Programme', v:`${wk.done}/${wk.total}`, u:'', sub: triOn() ? `cette semaine · J-${Math.max(0, diffDays(t, tri().race.date))}` : `cette semaine · ${done}/${p.minSessions} au total` },
    { k:'forme', l:'Énergie', v:sc ? sc.v : ll ? Math.round(ll.tsb) : '—', u:'', col: sc ? battCol(sc.v) : null, sub:sc ? { ok:'Prêt', mid:'Correct', warn:'Prudence', bad:'Récupère' }[sc.level] + ' · sur 100' : 'forme de charge (TSB)' },
    { k:'heures', l:'Heures de sport', v:fmtH(sh.cur), u:'h', sub:`${sh.cur>=sh.prev?'+':'−'}${fmtH(Math.abs(sh.cur-sh.prev))} h vs 7 j précédents` },
    { k:'defis', l:'Défis', v:chPct, u:'%', sub:chs.length ? [chs[0].name, ...chs.slice(1).map(x=>`${x.name} ${x.pct} %`)].join(' · ') : '' },
  ];
  if (!TODAY_PANE) return h + guideCardHTML() + recapBannerHTML() + homeHTML({ wk, sh, sc, ll, chs });
  const cur = tiles.find(x => x.k === TODAY_PANE);
  h += `<div class="pane-in" id="todayPane" data-p="${TODAY_PANE}"><div class="pane-head"><button class="pane-back" data-paneback="1" aria-label="Retour aux tuiles"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button><h2>${cur.l}</h2><span class="pane-num num">${cur.v}${cur.u?`<small>${cur.u}</small>`:''}</span></div>`;
  if (TODAY_PANE === 'heures') h += sportHoursHTML();
  if (TODAY_PANE === 'defis') h += Social.html() + challengesHTML();
  if (TODAY_PANE === 'forme') { const lc = loadCardHTML(); h += (Health.todayCard() || (lc ? '' : ll ? `<div class="card"><h2>Forme</h2><div class="grid3"><div class="kpi"><div class="v num">${Math.round(ll.ctl)}</div><div class="l">Fitness (CTL)</div></div><div class="kpi"><div class="v num">${Math.round(ll.atl)}</div><div class="l">Fatigue (ATL)</div></div><div class="kpi"><div class="v num">${Math.round(ll.tsb)}</div><div class="l">Forme (TSB)</div></div></div><p class="tiny muted" style="margin:10px 0 0">Connecte Apple Santé (Profil › Réglages) pour l'indice de forme du jour.</p></div>` : `<div class="card"><h2>Forme</h2><p class="muted small" style="margin:0">Pas encore de données : importe des séances ou connecte Apple Santé (Profil › Réglages).</p></div>`)) + lc + Health.progressCards(); }
  if (TODAY_PANE === 'prog') {
  h += phaseHTML(true);
  h += arcsHTML(); let pre = '';
  for (const n of notes) pre += `<div class="note ${n.cls}">${esc(n.t)}${n.action?` <button class="btn sm" data-coach="${notes.indexOf(n)}" style="margin-left:6px">${esc(n.action.label)}</button>`:''}${n.plan?` <button class="btn sm" data-open="${n.plan}" style="margin-left:6px">Ouvrir</button>`:''}</div>`;
  window._coach = notes;
  const toFeel = S.activities.filter(a => (a.planId || a.source==='strava') && !a.feel?.rpe && diffDays(a.date, t) <= 7 && WORKOUTS[S.plan.find(s=>s.id===a.planId)?.workoutId]?.type !== 'test').sort((a,b)=>b.date.localeCompare(a.date));
  if (toFeel.length) pre += `<div class="note">${toFeel.length} séance${toFeel.length>1?'s':''} sans ressenti : ajoute ton RPE pour obtenir le verdict. <button class="btn sm" data-feelact="${toFeel[0].id}" style="margin-left:6px">Ajouter le ressenti</button></div>`;
  const show = todays.length ? todays : (next ? [next] : []);
  for (const s of show) {
    const W = WORKOUTS[s.workoutId];
    const isToday = s.date === t;
    h += `<div class="card"><div class="row between"><span class="tag" style="background:${ZCOL(zoneOf(mainStep(s.workoutId)?.p||60))};color:#111">${esc(W.type==='test'?'Test':s.kind==='optional'?'Optionnelle':s.kind==='recovery'?'Récup':'Séance clé')}</span><span class="muted small">${isToday ? "Aujourd'hui" : fmtDate(s.date)} · ${esc(s.block)}</span></div>
      <h2 style="margin-top:8px">${esc(W.name)}</h2><p class="muted small" style="margin:0 0 10px">${esc(W.goal)}</p>
      ${profileBars(s.workoutId)}
      <div class="row small muted" style="margin:8px 0 4px"><span class="num">${fmtDur(wDur(s.workoutId))}</span>·<span class="num">TSS ≈ ${wTSS(s.workoutId)}</span>${mainStep(s.workoutId)?`·<span class="num">bloc à ${watts(mainStep(s.workoutId).p, ftp(), sAdj(s))} W</span>`:''}${sAdj(s)!==1?`·<span style="color:var(--accent)">${sAdj(s)>1?'+':''}${Math.round((sAdj(s)-1)*100)} %</span>`:''}</div>
      ${s.status==='done' ? (evalHTML(S.activities.find(a=>a.id===s.activityId), s) || `<div class="note ok" style="margin:10px 0 0">Séance faite ✔</div>`) : `${isToday ? formeHint(s) : ''}
        <div class="row" style="margin-top:10px">
        <button class="btn primary" data-open="${s.id}">Voir la séance</button>
        ${Cloud.icu?.connected ? `<span class="tiny muted">Envoyée sur l'Edge via Intervals · validée automatiquement</span>` : `<button class="btn" data-export="${s.id}">Envoyer sur l'Edge (.fit)</button>`}</div>
        ${adjustHTML(s, true)}
        <details class="more"><summary>⋯ Autres actions</summary><div class="row" style="margin-top:8px;gap:6px">
          <button class="btn sm" data-log="${s.id}">Saisir la séance à la main</button>
          ${Cloud.icu?.connected ? `<button class="btn sm" data-export="${s.id}">Fichier .fit pour l'Edge</button>` : ''}
          <button class="btn sm" data-absence="1">✈︎ Absent / vacances</button>
          ${W.type==='test' ? `<button class="btn sm" data-proto="${s.workoutId==='ramp'?'20min':'ramp'}">${s.workoutId==='ramp'?'Revenir au test 20 min':'Passer au test rampe (ERG)'}</button>` : ''}</div></details>`}
    </div>`;
  }
  if (!show.length) h += `<div class="card"><h2>Plan terminé</h2><p class="muted">Plus aucune séance prévue. Régénère un plan depuis le Profil.</p></div>`;
  h += progCard + pre;
  h += `<div class="card"><h2>Ajouter une activité</h2><p class="muted small" style="margin-top:0">Fichier .fit (Garmin Connect : Exporter l'original · Strava : Exporter l'original) ou saisie manuelle.</p>
    <div class="row"><button class="btn primary" data-log="">Importer / saisir une séance</button></div></div>`;
  const recent = S.activities.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3);
  if (recent.length) h += `<div class="card"><h2>Dernières séances</h2>${recent.map(actRow).join('')}</div>`;
  }
  return h + `</div>`;
}
/* ----- Accueil : anneau Programme, cartes Heures / Énergie (courbe 10 j), carte Défi ----- */
const HOME_IC = {
  timer:'<path d="M12 13.5V9.5M10 2.5h4M18.5 6.5l1.5-1.5"/><circle cx="12" cy="13.5" r="7.5"/>',
  bolt:'<path d="M13 2.5 5 13.5h6l-1 8 8-11h-6l1-8z"/>',
  chaise:'<path d="M5 3v18"/><circle cx="10" cy="5" r="1.8"/><path d="M8 8.5l-.5 6h7l.5 5.5M8.2 11h5"/>',
  bulgares:'<circle cx="12" cy="4" r="1.8"/><path d="M12 6.5v6M12 12.5l-4 4.5v4M12 12.5l5 2 2 5h3M9 9h6"/>',
  gainage:'<circle cx="5" cy="9" r="1.8"/><path d="M7 10.5l14 3M3 15h6M7 10.5 6 15M21 13.5v2"/>',
  defi:'<path d="M7 4h10v4a5 5 0 0 1-10 0zM12 13v4M8 21h8M10 17h4M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3"/>',
};
const homeIcon = (k, col, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="${col}" stroke-width="${cls ? 1.7 : 2}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${HOME_IC[k] || HOME_IC.defi}</svg>`;
function homeRing(pct, size, sw, c1, c2, id){
  const r = (size - sw)/2, c = 2*Math.PI*r, len = Math.max(pct > 0 ? 0.001 : 0, clamp(pct, 0, 1))*c;
  return `<svg viewBox="0 0 ${size} ${size}" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="1" x2="1" y2="0"><stop offset="0" style="stop-color:${c1}"/><stop offset="1" style="stop-color:${c2}"/></linearGradient></defs>
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="color-mix(in srgb,var(--line) 85%,var(--bg))" stroke-width="${sw}"/>
    ${len ? `<circle class="harc" cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="url(#${id})" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${len.toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size/2} ${size/2})"/>` : ''}</svg>`;
}
// tracé lissé (Bézier) d'une courbe d'accueil
function homeSparkD(pts){
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i-1], [x1, y1] = pts[i], cx = ((x0 + x1)/2).toFixed(1); d += ` C${cx},${y0.toFixed(1)} ${cx},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`; }
  return d;
}
const SPARK_W = 180, SPARK_H = 48;
function homeSpark(vals, col, id){
  const pts0 = vals.map((v, i) => [i, v]).filter(x => x[1] != null); if (pts0.length < 3 || pts0.every(x => x[1] === pts0[0][1])) return '<div class="nospark"></div>';
  const W = SPARK_W, Hh = SPARK_H, n = vals.length - 1, lo = Math.min(...pts0.map(x => x[1])), hi = Math.max(...pts0.map(x => x[1]));
  const pts = pts0.map(([i, v]) => [i*W/n, Hh - 6 - (v - lo)/((hi - lo) || 1)*(Hh - 16)]);
  const d = homeSparkD(pts), [lx, ly] = pts[pts.length - 1];
  return `<svg class="spark" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" aria-hidden="true" data-pts="${pts.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ')}"><defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style="stop-color:${col};stop-opacity:.28"/><stop offset="1" style="stop-color:${col};stop-opacity:0"/></linearGradient></defs>
    <path class="sp-a" d="${d} L${lx.toFixed(1)},${Hh} L${pts[0][0].toFixed(1)},${Hh}Z" fill="url(#${id})"/><path class="sp-l" d="${d}" fill="none" stroke="${col}" stroke-width="2" vector-effect="non-scaling-stroke"/>
    <circle class="sp-d" cx="${Math.min(lx, W - 3.5).toFixed(1)}" cy="${ly.toFixed(1)}" r="3.5" fill="${col}"/></svg>`;
}
/* « La vague » : à l'arrivée sur l'accueil, chaque point des courbes se lève l'un après l'autre
   depuis le bas, dépasse un peu sa valeur puis s'y pose — comme une ola dans un stade. */
function homeWave(t0){
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll('.home .spark[data-pts]').forEach((svg, k) => {
    const pts = svg.dataset.pts.split(' ').map(p => p.split(',').map(Number)), n = pts.length, Hh = SPARK_H;
    const A = svg.querySelector('.sp-a'), L = svg.querySelector('.sp-l'), D = svg.querySelector('.sp-d'); if (!A || !L || !D) return;
    const delay0 = 180 + k*120, step = 55, dur = 650, total = delay0 + step*(n - 1) + dur;
    // easeOutBack : monte, dépasse, revient (la crête de la vague)
    const ease = t => { const c = 2.2; return 1 + (c + 1)*Math.pow(t - 1, 3) + c*Math.pow(t - 1, 2); };
    const frame = (now, t0) => {
      const el = now - t0;
      const cur = pts.map(([x, y], i) => { const t = Math.min(1, Math.max(0, (el - delay0 - i*step)/dur)); return [x, Hh + (y - Hh)*ease(t)]; });
      const d = homeSparkD(cur), [lx, ly] = cur[n - 1];
      L.setAttribute('d', d); A.setAttribute('d', `${d} L${lx.toFixed(1)},${Hh} L${cur[0][0].toFixed(1)},${Hh}Z`);
      D.setAttribute('cy', ly.toFixed(1)); D.style.opacity = el > delay0 + step*(n - 1) ? 1 : 0;
      if (el < total && svg.isConnected) requestAnimationFrame(t => frame(t, t0));
    };
    frame(performance.now(), t0); // pose la vague là où elle en est, avant le premier affichage
    requestAnimationFrame(t => frame(t, t0));
  });
}
function homeHTML({ wk, sh, sc, ll, chs }){
  const t = todayISO(), N = 10, days = Array.from({ length:N }, (_, i) => addDays(t, i - N + 1));
  // heures de sport glissantes sur 7 j, pour chacun des 10 derniers jours
  const ss = sportSessions(), hrs = days.map(d => ss.filter(x => x.date > addDays(d, -7) && x.date <= d).reduce((a, x) => a + x.min, 0)/60);
  const nrg = days.map(d => { try { return Health.score(d)?.v ?? null; } catch { return null; } });
  const dh = sh.cur - sh.prev, up = dh >= 0;
  const arrow = `<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="${up ? 'M5 1l4 7H1z' : 'M5 9 1 2h8z'}" fill="${up ? 'var(--ok)' : 'var(--bad)'}"/></svg>`;
  const ev = sc ? sc.v : ll ? Math.round(ll.tsb) : '—', el = sc ? { ok:'Prêt', mid:'Correct', warn:'Prudence', bad:'Récupère' }[sc.level] : ll ? 'Forme (TSB)' : 'Santé non reliée';
  const c = activeChallenges().map(c => ({ c, pct: clamp(chTotal(c)/c.target, 0, 1) })).sort((a, b) => b.pct - a.pct)[0];
  const fmtU = (v, u) => u === 'min' ? (v < 1 ? `${Math.round(v*60)} s` : `${(Math.round(v*10)/10).toString().replace('.', ',')} min`) : `${Math.round(v)} ${u}`;
  const [hi, hf] = fmtH(sh.cur).split(',');
  return `<div class="home">
    <button class="hero" data-pane="prog" aria-label="Programme : ${wk.done} séances faites sur ${wk.total} cette semaine">${homeRing(wk.total ? wk.done/wk.total : 0, 240, 16, 'var(--h-prog1)', 'var(--h-prog2)', 'hRingP')}
      <span class="in"><span class="lab" style="color:var(--h-prog1)">Programme</span><span class="num0">${wk.done}<small>/${wk.total}</small></span><span class="sub hsub">cette semaine${triOn() ? `<b>J-${Math.max(0, diffDays(t, tri().race.date))}</b>` : ''}</span></span></button>
    <div class="grid">
      <button class="hc" data-pane="heures"><span class="top">${homeIcon('timer', 'var(--h-hrs)')}<span class="lab" style="color:var(--h-hrs)">Heures sport</span></span>
        <span class="num0">${hi}${hf ? `,${hf}` : ''}<small>h</small></span><span class="sub">${arrow}${up ? '+' : '−'}${fmtH(Math.abs(dh))} h vs 7 j</span>${homeSpark(hrs, 'var(--h-hrs)', 'hSpH')}</button>
      <button class="hc" data-pane="forme"><span class="top">${homeIcon('bolt', 'var(--h-nrg)')}<span class="lab" style="color:var(--h-nrg)">Énergie</span></span>
        <span class="num0">${ev}</span><span class="sub">${esc(el)}</span>${homeSpark(nrg, 'var(--h-nrg)', 'hSpE')}</button>
      <button class="hc wide" data-pane="defis"><span><span class="top"><span class="lab" style="color:var(--h-def)">Défi</span>${c ? `<span class="lab" style="color:var(--text)">${esc(c.c.name)}</span>` : ''}</span>
        <span class="num0" style="display:block">${c ? Math.floor(c.pct*100) : 0}<small>%</small></span><span class="sub">${c ? `${fmtU(chTotal(c.c), c.c.unit)} / ${fmtU(c.c.target, c.c.unit)}` : 'Aucun défi en cours'}</span></span>
        <span class="ring">${homeRing(c ? c.pct : 0, 86, 6, 'var(--h-def)', 'var(--h-def)', 'hRingD')}${homeIcon(c ? c.c.id : 'defi', 'var(--h-def)', 'ic')}</span></button>
    </div></div>`;
}
/* Batterie de forme : se vide de vert (≥ 60) à jaune (35–59) puis rouge (< 35) */
const battCol = v => v >= 60 ? 'var(--ok)' : v >= 35 ? 'var(--warn)' : 'var(--bad)';
function batterySVG(v, w = 132){
  v = clamp(Math.round(v), 0, 100);
  const col = battCol(v), X = 4, Y = 6, W = 104, H = 52, P = 5, iw = W - 2*P, fw = Math.max(v ? 6 : 0, iw*v/100);
  // 5 segments : repères de charge
  const seps = [1, 2, 3, 4].map(k => { const x = X + P + iw*k/5; return x < X + P + fw ? `<line x1="${x}" y1="${Y + P}" x2="${x}" y2="${Y + H - P}" stroke="var(--card)" stroke-width="2.5" opacity=".55"/>` : ''; }).join('');
  return `<svg viewBox="0 0 120 64" width="${w}" height="${Math.round(w*64/120)}" role="img" aria-label="Énergie ${v} sur 100">
    <rect x="${X}" y="${Y}" width="${W}" height="${H}" rx="11" fill="var(--bg2)" stroke="${col}" stroke-width="3"/>
    <rect x="${X + W + 2}" y="${Y + H/2 - 10}" width="7" height="20" rx="3" fill="${col}"/>
    <rect class="batt-fill" x="${X + P}" y="${Y + P}" width="${fw}" height="${H - 2*P}" rx="6" fill="${col}"/>${seps}
    <text x="${X + W/2}" y="${Y + H/2 + 11}" text-anchor="middle" style="font:700 32px 'Barlow Condensed','Arial Narrow',sans-serif;fill:var(--text);paint-order:stroke;stroke:var(--bg2);stroke-width:5px;stroke-linejoin:round">${v}</text>
  </svg>`;
}
/* ----- Heures de sport (hors vélotaf et marche) ----- */
const SPORTS3 = { bike:{ l:'Vélo', ic:'🚴' }, swim:{ l:'Natation', ic:'🏊' }, run:{ l:'Course à pied', ic:'🏃' } };
const fmtH = h => (Math.round(h*10)/10).toFixed(1).replace('.', ',');
function sportSessions(){
  const out = [];
  for (const a of S.activities) { if (isVelotaf(a) || !a.durationS) continue; out.push({ ref:'a:'+a.id, name:a.name, date:a.date, ts:a.startTs || 0, sport:'bike', min:a.durationS/60, km:+a.distanceKm || 0, ext:!isIndoor(a), hr:a.avgHr || null }); }
  const hw = Health.extraWorkouts().filter(e => e.sport !== 'walk' && !(e.sport === 'bike' && isVelotafW(e.w)))
    .map(e => ({ ref:'w:'+e.w.start_at, name:e.w.type, src:e.w.source, date:e.date, ts:Math.floor(Date.parse(e.w.start_at)/1000), sport:e.sport, min:+e.w.duration_min || 0, km:+e.w.distance_km || 0, ext:e.sport === 'bike' ? !Health.bikeIndoor(e.w) : true, hr:e.w.avg_hr ? Math.round(e.w.avg_hr) : null }))
    .filter(x => x.min > 1).sort((x, y) => x.ts - y.ts);
  // doublons Santé (même sport, séances qui se chevauchent) : on garde la plus longue
  for (const x of hw) { const o = out.find(y => y.sport === x.sport && y.ts && Math.abs(y.ts - x.ts) < Math.max(y.min, x.min)*60); if (o) { if (x.min > o.min) Object.assign(o, x); } else out.push(x); }
  return out;
}
function sportHoursRolling(){
  const t = todayISO(), a = addDays(t, -6), b = addDays(t, -13), ss = sportSessions();
  const sum = (from, to) => ss.filter(x => x.date >= from && x.date <= to).reduce((s, x) => s + x.min, 0)/60;
  return { cur: sum(a, t), prev: sum(b, addDays(a, -1)) };
}
function sportHoursHTML(){
  const N = 12, w0 = addDays(monday(todayISO()), -7*(N-1)), ss = sportSessions();
  const weeks = Array.from({ length:N }, (_, i) => addDays(w0, 7*i));
  const xl = weeks.map((w, i) => [i, i % 3 === 1 ? fmtShort(w).replace(/\.$/, '') : '']).filter(x => x[1]);
  const COL = { t:'var(--accent)', k:'var(--z2)', p:'var(--z3)' };
  let h = `<p class="tiny muted" style="margin:0 0 10px">12 dernières semaines · hors vélotaf et marche. Les trois courbes sont à leur propre échelle : seule leur évolution se compare.</p>`;
  for (const [sp, S3] of Object.entries(SPORTS3)) {
    const rows = weeks.map(w => { const xs = ss.filter(x => x.sport === sp && x.date >= w && x.date <= addDays(w, 6)); const min = xs.reduce((s, x) => s + x.min, 0), km = xs.reduce((s, x) => s + x.km, 0);
      const px = sp === 'bike' ? xs.filter(x => x.ext && x.km) : xs.filter(x => x.km); const pm = px.reduce((s, x) => s + x.min, 0), pk = px.reduce((s, x) => s + x.km, 0);
      const pace = !pk || !pm ? null : sp === 'bike' ? pk/(pm/60) : sp === 'run' ? pm/pk : pm/(pk*10);
      return { h:min/60, km, pace }; });
    const tot = rows.reduce((s, r) => s + r.h, 0);
    if (!tot) { h += `<div class="card"><h2>${S3.ic} ${S3.l}</h2><p class="muted small">Aucune séance sur 12 semaines.</p></div>`; continue; }
    const norm = (vals, invert) => { const v = vals.filter(x => x != null); const lo = Math.min(...v), hi = Math.max(...v);
      return vals.map((x, i) => x == null ? null : [i, hi === lo ? 50 : 8 + 84*((invert ? hi - x : x - lo)/(hi - lo))]); };
    const seg = pts => { const out = []; let cur = []; for (const p of pts) { if (p) cur.push(p); else if (cur.length) { out.push(cur); cur = []; } } if (cur.length) out.push(cur); return out; };
    const series = [];
    const add = (vals, color, invert, dash) => { for (const pts of seg(norm(vals, invert))) { series.push({ pts, color, width:2.5, dash }); if (pts.length === 1) series.push({ type:'dots', pts, color, r:3.5 }); } };
    add(rows.map(r => r.h), COL.t); add(rows.map(r => r.km || null), COL.k); add(rows.map(r => r.pace), COL.p, sp !== 'bike', '5 4');
    const last = rows[N-1], lastPace = [...rows].reverse().find(r => r.pace != null)?.pace;
    const fmtPace = v => v == null ? '—' : sp === 'bike' ? `${v.toFixed(1).replace('.', ',')} km/h` : `${Math.floor(v)}'${String(Math.round((v % 1)*60)).padStart(2, '0')} /${sp === 'run' ? 'km' : '100 m'}`;
    const chart = lineChart({ series, xMin:0, xMax:N-1, yMin:0, yMax:100, h:170, xLabels:xl, yTicks:4 }).replace(/<text x="\d+(\.\d+)?" y="[\d.]+" text-anchor="end">\d+<\/text>/g, '');
    h += `<div class="card"><div class="row between"><h2>${S3.ic} ${S3.l}</h2><span class="muted small num">${fmtH(tot)} h · ${Math.round(rows.reduce((s, r) => s + r.km, 0))} km</span></div>
      <div class="mleg" style="margin:0 0 6px"><span><i style="background:${COL.t}"></i>Temps <b class="num" style="color:var(--text)">${fmtH(last.h)} h</b></span><span><i style="background:${COL.k}"></i>Km <b class="num" style="color:var(--text)">${Math.round(last.km)}</b></span><span><i style="background:${COL.p}"></i>Allure <b class="num" style="color:var(--text)">${fmtPace(lastPace)}</b></span></div>
      ${chart}<p class="tiny muted" style="margin:4px 0 0">Valeurs de la semaine en cours${sp === 'bike' ? ' · vitesse sur les sorties extérieures' : sp === 'run' ? ' · courbe d\'allure : plus haut = plus rapide' : ' · courbe d\'allure : plus haut = plus rapide'}.</p>${lastSessionsHTML(sp, ss)}</div>`;
  }
  return h;
}
/* ===== RECOMP ===== Recomposition de séance (natation, course) : texte libre -> blocs typés -> alignés sur le flux distance/FC Intervals.icu */
const Recomp = (() => {
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  // intensités (la première trouvée l'emporte) et accessoires / nages
  const INT = [
    ['max', /\b(a fonds?|fonds?|max|sprint|tout droit)\b/], ['rapide', /\b(rapide|vite|tempo|seuil|fort|soutenu|race)\b/],
    ['amplitude', /\b(amplitude|ampli|allonge|glisse)\b/], ['educ', /\b(edu|educ|educatifs?|technique)\b/],
    ['echauff', /\b(echauffement|echauff|echauf)\b/], ['calme', /\b(calme|souple|facile|recup|recuperation|cool|lent|tranquille|ral)\b/],
  ];
  const TAGS = [['pull', /\bpull\b/], ['plaquettes', /\bplaquettes?\b/], ['palmes', /\bpalmes?\b/], ['tuba', /\btuba\b/], ['jambes', /\b(jambes|battements|planche)\b/], ['chevilles', /\b(chevill\w*|elastiques?)\b/],
    ['brasse', /\bbrasse\b/], ['dos', /\bdos\b/], ['pap', /\b(pap|papillon)\b/], ['4n', /\b4\s*n(ages)?\b/]];
  const INT_L = { max:'à fond', rapide:'rapide', amplitude:'amplitude', educ:'éducatifs', echauff:'échauffement', calme:'calme', moyen:'' };
  const intOf = t => { for (const [k, re] of INT) if (re.test(t)) return k; return null; };
  const tagsOf = t => TAGS.filter(([, re]) => re.test(t)).map(([k]) => k);
  // repos : « 10 sec », « 10s », « 10'' », « 10' » (≥ 6 = secondes, notation bassin), « 1 min », « 1'30 »
  const REST = /(\d+)\s*(?:(?:'|’|´|′)\s*(\d{1,2})|(min|mn)|(s|sec|secs|secondes?|''|"|″|’’|´´)|('|’|´|′))(?![a-z0-9])\s*(?:de\s+)?(?:r[ée]cup\w*|repos|rest)?/gi;
  function restSec(m){ const a = +m[1]; if (m[2] != null) return a*60 + +m[2]; if (m[3]) return a*60; if (m[4]) return a; return a <= 5 ? a*60 : a; }

  // une ligne -> liste d'items (un item = ce qui se nage d'une traite, avec ses morceaux et le repos qui suit)
  function parseLine(raw, sport){
    // « 500pull », « 4x100plaquettes », « 10sec » : on décolle chiffres et lettres
    let t = norm(raw).replace(/[()]/g, ' ').replace(/(\d)([a-z])/g, '$1 $2').replace(/\s+/g, ' ').trim();
    if (!t) return [];
    t = t.replace(/\ba\s*\d+\s*['’´′]\s*\d{2}\b(\s*\/\s*km)?/g, ' '); // allure cible « à 4'05 » : ignorée
    // séries en temps (course) : « 3x10 min seuil », « 15 min échauffement »
    const tm = t.match(/^(?:(\d+)\s*[x×*]\s*)?(\d+)\s*(?:min|mn|['’´′])(?:\s*(\d{1,2}))?(?![a-z0-9])/);
    let timed = null;
    if (tm && (sport === 'run' || tm[1])) { timed = { n: +(tm[1] || 1), dur: +tm[2]*60 + +(tm[3] || 0) }; t = t.slice(tm[0].length); }
    let rest = null; t = t.replace(REST, (...m) => { rest = restSec(m); return ' '; }).replace(/\s+/g, ' ').trim();
    if (rest != null) t = t.replace(/\b(r(e)?cup\w*|repos|rest)\b/g, ' ').replace(/\s+/g, ' ').trim();
    const twice = /(repete|repeter|refai[st]|une deuxieme fois|2 fois|x ?2 ?$|bis\b)/.test(t);
    t = t.replace(/\b(et )?(on )?(le )?(repete|repeter|refait|refais)( une)?( deuxieme fois| 2 fois)?\b/g, ' ').replace(/\s+/g, ' ').trim();
    const lineInt = intOf(t), mixed = /\bcrawl\b/.test(t) || lineInt === 'echauff' || lineInt === 'educ';
    const lineTags = tagsOf(t).filter(k => !(mixed && ['brasse','dos','pap','4n'].includes(k)));
    const unit = sport === 'run' ? 'km' : 'm';
    const toM = (n, u) => u === 'km' || (sport === 'run' && n < 50 && /[.,]/.test(String(n))) ? Math.round(parseFloat(String(n).replace(',', '.'))*1000) : Math.round(+n);
    if (timed) {
      const intv = lineInt || 'moyen'; let n = timed.n; if (twice) n *= 2;
      return Array.from({ length:n }, (_, i) => ({ label: raw.trim(), rep: n > 1 ? `${i+1}/${n}` : '', pieces: [{ d: 0, dur: timed.dur, int: intv, tags: lineTags }], rest }));
    }
    // « 4x200 … »
    let m = t.match(/^(\d+)\s*[x×*]\s*(\d+(?:[.,]\d+)?)\s*(km|m)?\b/);
    if (m) {
      let n = +m[1]; const d = toM(m[2], m[3]); const after = t.slice(m[0].length);
      // alternance « 1 200 amplitude 2e rapide » / « 1 sur 2 rapide »
      const alt = [];
      const am = after.match(/\b1\s*(?:er|re|ere)?\b(.*?)\b2\s*(?:e|eme|nd|nde)\b(.*)$/);
      if (am) { const a = intOf(am[1]), b = intOf(am[2]); if (a && b) alt.push(a, b); }
      const sur = after.match(/\b1\s*sur\s*(\d)\b\s*([a-z ]+)/); if (!alt.length && sur) { const k = +sur[1] || 2, x = intOf(sur[2]) || 'rapide'; for (let j = 0; j < k; j++) alt.push(j === 0 ? x : (lineInt && lineInt !== x ? lineInt : 'moyen')); }
      if (twice && !(alt.length && n % (2*alt.length) === 0)) n *= 2;
      const base = intOf(after.replace(am ? am[0] : '', '').replace(/\b1\s*sur\s*\d\b\s*[a-z]+/, '')) || lineInt;
      return Array.from({ length:n }, (_, i) => ({ label: raw.trim(), rep: `${i+1}/${n}`, pieces: [{ d, int: alt.length ? alt[i % alt.length] : base || 'moyen', tags: lineTags }], rest }));
    }
    // morceaux « 75 à fond 25 calme »
    const parts = []; const re = /(\d+(?:[.,]\d+)?)\s*(km|m)?\b([^0-9]*)/g; let p;
    while ((p = re.exec(t))) parts.push({ d: toM(p[1], p[2]), txt: p[3].trim() });
    if (!parts.length) return [];
    const head = parts[0], subs = parts.slice(1).filter(x => x.d >= 10);
    const subSum = subs.reduce((s, x) => s + x.d, 0);
    let pieces;
    const hI = intOf(head.txt);
    if (subs.length && subSum < head.d && head.d % subSum === 0 && (!hI || hI === 'educ' || hI === 'echauff')) {
      // « 300 edu 25 chien 50 rattrapé » -> motif répété jusqu'à 300 m
      const hInt = intOf(head.txt) || lineInt;
      pieces = [{ d: head.d, int: hInt || 'educ', tags: lineTags, detail: subs.map(x => `${x.d} ${x.txt}`).join(' + ') }];
    } else if (subs.length) {
      pieces = parts.filter(x => x.d >= 10).map(x => ({ d: x.d, int: intOf(x.txt) || lineInt || 'moyen', tags: [...new Set([...lineTags, ...tagsOf(x.txt)])] }));
    } else pieces = [{ d: head.d, int: intOf(head.txt) || lineInt || 'moyen', tags: lineTags }];
    const items = [{ label: raw.trim(), pieces, rest }];
    return twice ? [...items, ...items.map(x => ({ ...x }))] : items;
  }
  function parse(text, sport){
    const items = [];
    for (const line of String(text || '').split(/\n|;/)) items.push(...parseLine(line, sport));
    return items.map((x, i) => ({ ...x, i, d: x.pieces.reduce((s, p) => s + p.d, 0), dur: x.pieces.reduce((s, p) => s + (p.dur || 0), 0) }));
  }

  // flux -> instants de repos (paliers de distance) et interpolation
  function stream(laps){
    const s = laps?.s; if (!s?.t?.length || !s?.d?.length) return null;
    const t = s.t, d = s.d.map(x => x ?? 0), hr = s.hr || null;
    const dt = t.length > 1 ? (t[t.length-1] - t[0])/(t.length-1) : 1;
    const plateaus = []; // { d, t0, t1 }
    let i = 0;
    while (i < d.length) { let j = i; while (j+1 < d.length && d[j+1] - d[i] < 3) j++; if (t[j] - t[i] >= 7 && j > i) plateaus.push({ d: d[i], t0: t[i], t1: t[j] }); i = j + 1; }
    const timeAt = x => { for (let k = 1; k < d.length; k++) if (d[k] >= x) { const f = d[k] === d[k-1] ? 0 : (x - d[k-1])/(d[k] - d[k-1]); return t[k-1] + f*(t[k] - t[k-1]); } return t[t.length-1]; };
    const hrBetween = (a, b) => { if (!hr) return null; let s = 0, n = 0, mx = 0; for (let k = 0; k < t.length; k++) if (t[k] >= a && t[k] <= b && hr[k]) { s += hr[k]; n++; mx = Math.max(mx, hr[k]); } return n ? { avg: Math.round(s/n), max: mx } : null; };
    return { t, d, dt, total: d[d.length-1], plateaus, timeAt, hrBetween, lapTol: 30 };
  }

  // aligne les items sur le flux : chaque frontière se cale sur le palier (repos) le plus proche, sinon coupe à la distance (ou au temps)
  function align(items, laps){
    const S = stream(laps); if (!S || !items.length) return null;
    const planned = items.reduce((s, x) => s + x.d, 0), allDist = items.every(x => x.d > 0);
    const r = allDist && planned ? S.total/planned : 1; // compteur de longueurs qui sur/sous-compte : on répartit l'écart
    const distAt = tt => { const t = S.t, d = S.d; for (let k = 1; k < t.length; k++) if (t[k] >= tt) { const f = (tt - t[k-1])/((t[k] - t[k-1]) || 1); return d[k-1] + f*(d[k] - d[k-1]); } return S.total; };
    let pos = 0; const out = [];
    items.forEach((it, k) => {
      const last = k === items.length - 1;
      const pl0 = S.plateaus.find(p => Math.abs(p.d - pos) < 1);
      const t0 = pl0 ? pl0.t1 : S.timeAt(pos + 0.5);
      let end, snapped = null;
      if (last) end = S.total;
      else if (it.dur && !it.d) {
        // série en temps : coupe à t0 + durée, calée sur un arrêt proche s'il y en a un
        const te = t0 + it.dur, tol = Math.max(20, 0.1*it.dur);
        let best = null; for (const p of S.plateaus) { if (p.d <= pos + 1) continue; const e = Math.abs(p.t0 - te); if (e <= tol && (!best || e < best.e)) best = { p, e }; }
        if (best) { end = best.p.d; snapped = best.p; } else end = distAt(te);
      } else {
        end = pos + it.d*r;
        const tol = Math.max(S.lapTol, 0.2*it.d*r);
        let best = null; for (const p of S.plateaus) { if (p.d <= pos + 1) continue; const e = Math.abs(p.d - end); if (e <= tol && (!best || e < best.e)) best = { p, e }; }
        if (best) { end = best.p.d; snapped = best.p; }
      }
      end = Math.min(Math.max(end, pos), S.total);
      const t1 = S.timeAt(end - 0.5), md = end - pos;
      // morceaux enchaînés : découpe proportionnelle (distance prévue, ou durée prévue)
      const w = it.pieces.map(pc => pc.d || pc.dur || 1), W = w.reduce((a, x) => a + x, 0);
      let cur = pos; const pcs = it.pieces.map((pc, j) => { const a = cur, b = j === it.pieces.length - 1 ? end : cur + md*w[j]/W; cur = b;
        const ta = j === 0 ? t0 : S.timeAt(a), tb = S.timeAt(b - 0.5); const h = S.hrBetween(ta, tb);
        return { ...pc, md: Math.round(b - a), sec: Math.max(0, Math.round(tb - ta)), hr: h?.avg ?? null, hrMax: h?.max ?? null }; });
      const h = S.hrBetween(t0, t1);
      out.push({ ...it, md: Math.round(md), sec: Math.max(0, Math.round(t1 - t0)), hr: h?.avg ?? null, hrMax: h?.max ?? null, restSec: snapped ? Math.round(snapped.t1 - snapped.t0) : null, snapped: !!snapped, pieces: pcs });
      pos = end;
      // récup active (footing, nage lente) sans arrêt détecté : on saute la durée de récup prévue
      if (!last && !snapped && it.rest) pos = Math.min(S.total, Math.max(pos, distAt(t1 + it.rest)));
      out[out.length-1].restSec ??= it.rest && !snapped ? it.rest : null;
    });
    return { items: out, planned, measured: Math.round(S.total), ratio: r, allDist };
  }

  // clé de comparaison d'un morceau : sport · distance · intensité · accessoires
  const keyOf = (sport, pc) => [sport, pc.d || `${pc.dur}s`, pc.int, ...(pc.tags || []).slice().sort()].join('|');
  const pieceLabel = pc => [pc.dur && !pc.d ? fmtSec(pc.dur) : `${pc.d >= 1000 && pc.d % 100 === 0 ? (pc.d/1000).toString().replace('.', ',') + ' km' : pc.d + ' m'}`, INT_L[pc.int] || '', ...(pc.tags || [])].filter(Boolean).join(' · ');
  // résumé à garder : allure par morceau (s/100 m ou s/km)
  function summarize(sport, res){
    const per = sport === 'run' ? 1000 : 100, out = [];
    for (const it of res.items) for (const pc of it.pieces) if (pc.md > 0 && pc.sec > 0) out.push({ k: keyOf(sport, pc), d: pc.d, dur: pc.dur || null, int: pc.int, tags: pc.tags || [], pace: Math.round(pc.sec/pc.md*per*10)/10, hr: pc.hr });
    return out;
  }
  function fmtSec(x){ x = Math.round(x); const m = Math.floor(x/60), r = x % 60; return m ? (r ? `${m}'${String(r).padStart(2, '0')}` : `${m} min`) : `${r} s`; }
  // lignes non vides dont aucun bloc n'a été tiré (signalées à l'écran, sinon l'écart de distance part en silence)
  const unparsed = (text, sport) => String(text || '').split(/\n|;/).filter(l => l.trim() && !parseLine(l, sport).length).map(l => l.trim());
  return { fmtSec, parse, unparsed, align, summarize, keyOf, pieceLabel, INT_L, stream };
})();
/* ===== /RECOMP ===== */
/* ----- Recomposition : écran, enregistrement, suivi par bloc ----- */
const RC_EX = { swim:"400 échauffement crawl brasse\n300 edu 25 chien 50 rattrapé\n4x200 pull plaquettes 1 amplitude 2e rapide\n100 à fond 10'' récup\n75 à fond 25 calme 10'' récup\n100 calme", run:"15 min échauffement\n6x400 rapide 1'30 récup\n10 min calme" };
const _lapsCache = {};
async function lapsFor(x){
  if (x.ref in _lapsCache) return _lapsCache[x.ref];
  const sb = Cloud.sb, u = Cloud.user; if (!sb || !u) return null;
  const t = Date.parse(x.ref.slice(2));
  try {
    const { data } = await sb.from('workout_laps').select('laps, start_at').gte('start_at', new Date(t - 300000).toISOString()).lte('start_at', new Date(t + 300000).toISOString()).limit(1);
    return (_lapsCache[x.ref] = data?.[0]?.laps || null);
  } catch (e) { console.warn('laps', e); return null; }
}
const rcPer = sp => sp === 'run' ? 1000 : 100;
const fmtRcPace = (sp, s100) => s100 == null ? '—' : `${Math.floor(s100/60)}'${String(Math.round(s100 % 60) % 60).padStart(2, '0')}`;
// historique des morceaux : toutes les recompositions enregistrées, triées par date
function rcHistory(sp){
  const out = [];
  for (const [ref, r] of Object.entries(S.recomp || {})) if (r.sport === sp) for (const p of r.sum || []) out.push({ ...p, ref, date: r.date, ts: r.ts || 0 });
  return out.sort((a, b) => a.ts - b.ts);
}
// tendance d'un morceau vs médiane des mêmes blocs avant cette séance (+ = plus rapide)
function rcTrend(sp, p, ts, hist = rcHistory(sp)){
  const prev = hist.filter(h => h.k === p.k && h.ts < ts).map(h => h.pace); const m = med(prev);
  return m == null || p.pace == null ? null : { d: (m - p.pace)/m, n: prev.length, m };
}
function rcRowsHTML(sp, rows, ts){
  const hist = rcHistory(sp), per = sp === 'run' ? '/km' : '/100 m';
  return `<div class="rc-rows">${rows.map(r => `<div class="hist" style="align-items:flex-start"><div style="flex:1;min-width:0"><b>${esc(r.lab)}</b>${r.rep ? ` <span class="tiny muted">${esc(r.rep)}</span>` : ''}
      <div class="tiny muted">${r.md} m · ${fmtDur(r.sec)}${r.hr ? ` · ${r.hr} bpm` : ''}${r.rest ? ` · récup ${Recomp.fmtSec(r.rest)}` : ''}</div>
      ${r.parts.length > 1 ? `<div class="tiny muted">${r.parts.map(p => `${esc(p.lab)} <b class="num" style="color:var(--text)">${fmtRcPace(sp, p.pace)}</b>`).join(' · ')}</div>` : ''}</div>
      <div style="text-align:right"><div class="num"><b>${fmtRcPace(sp, r.parts.length > 1 ? (r.sec/r.md*rcPer(sp)) : r.parts[0]?.pace)}</b><span class="tiny muted"> ${per}</span></div>
      ${r.parts.length === 1 && r.parts[0].k ? (t => t ? trendChip(t.d) : '')(rcTrend(sp, r.parts[0], ts, hist)) : ''}</div></div>`).join('')}</div>`;
}
// résultat d'alignement -> lignes compactes (gardées avec la séance : affichables sans les données Intervals)
function rcRows(sp, res){
  const per = rcPer(sp);
  return res.items.map(it => ({ lab: it.pieces.map(Recomp.pieceLabel).join(' + '), rep: it.rep || '', md: it.md, sec: it.sec, hr: it.hr, rest: it.restSec,
    parts: it.pieces.map(pc => ({ lab: Recomp.pieceLabel(pc), k: pc.md > 0 && pc.sec > 0 ? Recomp.keyOf(sp, pc) : null, pace: pc.md > 0 && pc.sec > 0 ? Math.round(pc.sec/pc.md*per*10)/10 : null })) }));
}
function recompSavedHTML(x){
  const r = S.recomp?.[x.ref]; if (!r) return '';
  const intense = r.sum.filter(p => ['max', 'rapide'].includes(p.int));
  return `<h3 style="margin:14px 0 2px;font-size:14px">🧩 Séance recomposée</h3>
    <p class="tiny muted" style="margin:0 0 4px">${r.measured} m mesurés pour ${r.planned} m prévus${Math.abs(r.measured - r.planned) > 0.1*r.planned ? ' · écart important : vérifie la saisie ou le comptage de longueurs' : ''}. Pastilles : allure vs tes blocs identiques précédents.</p>
    ${rcRowsHTML(x.sport, r.rows, r.ts)}
    ${intense.length ? `<div class="note" style="margin-top:10px">Travail intense : ${intense.reduce((s, p) => s + p.d, 0)} m${intense.some(p => p.hr) ? ` · FC moy. ${Math.round(med(intense.map(p => p.hr)))} bpm` : ''}</div>` : ''}
    <div class="row" style="margin-top:8px"><button class="btn sm" data-recomp="${esc(x.ref)}">Modifier la recomposition</button></div>`;
}
async function recompDlg(ref){
  const x = sportSessions().find(y => y.ref === ref); if (!x) return;
  const sp = x.sport, saved = S.recomp?.[ref];
  openDlg(`<span class="muted small">${fmtDate(x.date)} · ${x.km ? (sp === 'swim' ? Math.round(x.km*1000) + ' m' : x.km.toFixed(1).replace('.', ',') + ' km') : ''} · ${fmtDur(x.min*60)}</span>
    <h2 style="margin:6px 0">🧩 Recomposer la séance</h2>
    <p class="tiny muted" style="margin:0 0 8px">Une ligne par bloc, comme sur ton carnet : « 4x200 pull plaquettes 1 amplitude 2e rapide », « 75 à fond 25 calme 10'' récup »${sp === 'run' ? ", « 3x10 min seuil 2 min récup »" : ''}. L'app découpe ta séance aux arrêts enregistrés par la montre.</p>
    <textarea id="rcText" rows="9" placeholder="${esc(RC_EX[sp] || RC_EX.swim)}" style="font-size:15px">${esc(saved?.text || '')}</textarea>
    <div class="row" style="margin-top:8px"><button class="btn primary" id="rcGo">Analyser</button>${saved ? `<button class="btn ghost" id="rcDel">Supprimer</button>` : ''}</div>
    <div id="rcOut" style="margin-top:10px"></div>`);
  const out = $('#rcOut');
  const laps = await lapsFor(x);
  if (!laps?.s) out.innerHTML = `<div class="note warn">${Cloud.user ? "Pas encore de détail longueur par longueur pour cette séance : il arrive avec la prochaine synchro Intervals.icu (Profil › Réglages › Synchroniser)." : "Connecte-toi (Profil › Réglages) pour récupérer le détail de la séance depuis Intervals.icu."}</div>`;
  let last = null;
  $('#rcGo').onclick = () => {
    const text = $('#rcText').value.trim(); if (!text) { out.innerHTML = `<div class="note warn">Écris ta séance, une ligne par bloc.</div>`; return; }
    const items = Recomp.parse(text, sp);
    if (!items.length) { out.innerHTML = `<div class="note warn">Je n'ai reconnu aucun bloc : commence chaque ligne par une distance (« 200 ») ou une série (« 4x100 »).</div>`; return; }
    const skip = Recomp.unparsed(text, sp);
    const skipNote = skip.length ? `<div class="note warn" style="margin:0 0 8px">Ligne${skip.length > 1 ? 's' : ''} non reconnue${skip.length > 1 ? 's' : ''}, ignorée${skip.length > 1 ? 's' : ''} : ${skip.map(l => `« ${esc(l)} »`).join(', ')}. Commence par une distance (« 200 pull ») ou une série (« 4x100 »).</div>` : '';
    const res = laps?.s ? Recomp.align(items, laps) : null;
    const ts = Math.floor(Date.parse(ref.slice(2))/1000);
    if (!res) { out.innerHTML = skipNote + `<p class="small">${items.length} bloc${items.length > 1 ? 's' : ''} reconnu${items.length > 1 ? 's' : ''} · ${items.reduce((s, i) => s + i.d, 0)} m prévus</p>` + items.map(i => `<div class="hist"><div style="flex:1">${esc(i.pieces.map(Recomp.pieceLabel).join(' + '))} <span class="tiny muted">${esc(i.rep || '')}</span></div></div>`).join(''); return; }
    last = { sport: sp, date: x.date, ts, text, planned: res.planned, measured: res.measured, rows: rcRows(sp, res), sum: Recomp.summarize(sp, res), at: Date.now() };
    const gap = res.allDist ? res.measured - res.planned : 0;
    out.innerHTML = skipNote + `<p class="small" style="margin:0 0 4px"><b>${items.length} blocs</b> · ${res.planned} m prévus · ${res.measured} m mesurés${res.allDist && Math.abs(gap) > 0.05*res.planned ? ` <span class="muted">(écart ${gap > 0 ? '+' : ''}${gap} m réparti sur les blocs)</span>` : ''}</p>
      ${rcRowsHTML(sp, last.rows, ts)}
      <div class="row" style="margin-top:10px"><button class="btn primary" id="rcSave">Enregistrer</button></div>`;
    $('#rcSave').onclick = () => { (S.recomp ||= {})[ref] = last; save(); render(); toast('Séance recomposée enregistrée'); sportSessionDlg(ref); };
  };
  if ($('#rcDel')) $('#rcDel').onclick = () => { delete S.recomp[ref]; save(); render(); toast('Recomposition supprimée'); sportSessionDlg(ref); };
  if (saved && laps?.s) $('#rcGo').click();
}
// suivi par bloc : les blocs identiques nagés/courus au moins deux fois
function rcTrackedHTML(sp){
  const hist = rcHistory(sp); if (!hist.length) return '';
  // un point par séance (médiane des répétitions du même bloc dans la séance)
  const g = {}; for (const h of hist) (g[h.k + '§' + h.ref] ||= []).push(h);
  const by = {}; for (const xs of Object.values(g)) { const h = xs[0]; (by[h.k] ||= []).push({ ...h, pace: med(xs.map(x => x.pace)), reps: xs.length }); }
  for (const v of Object.values(by)) v.sort((a, b) => a.ts - b.ts);
  const keys = Object.entries(by).filter(([, v]) => v.length >= 2).sort((a, b) => b[1].length - a[1].length || b[1][b[1].length-1].ts - a[1][a[1].length-1].ts).slice(0, 6);
  if (!keys.length) return `<p class="tiny muted" style="margin:10px 0 0">🧩 Recompose tes séances (touche une séance › Recomposer) : dès qu'un bloc revient, sa progression s'affiche ici.</p>`;
  const per = sp === 'run' ? '/km' : '/100 m';
  return `<h3 style="margin:14px 0 2px;font-size:14px">🧩 Progression par bloc</h3>${keys.map(([k, v]) => { const lastS = v[v.length-1], prevByRef = {}; for (const h of v.slice(0, -1)) (prevByRef[h.ref] ||= []).push(h.pace);
    const best = Math.min(...v.map(h => h.pace)), t = rcTrend(sp, lastS, lastS.ts, v);
    const lab = Recomp.pieceLabel({ d: lastS.d, dur: lastS.dur, int: lastS.int, tags: lastS.tags });
    return `<div class="hist"><div style="flex:1;min-width:0"><b>${esc(lab)}</b><div class="tiny muted">${v.length} séances · meilleur ${fmtRcPace(sp, best)}${per} · dernier ${fmtShort(lastS.date)}</div></div><span class="num"><b>${fmtRcPace(sp, lastS.pace)}</b></span>${t ? trendChip(t.d) : ''}</div>`; }).join('')}`;
}
document.addEventListener('click', e => { const r = e.target.closest('[data-recomp]'); if (r) recompDlg(r.dataset.recomp); });
/* ----- Dernières séances par sport + progression séance par séance ----- */
// « vraie » séance : ≥ 10 min (hors vélotaf et marche, déjà exclus de sportSessions)
const realSessions = (sp, ss = sportSessions()) => ss.filter(x => x.sport === sp && x.min >= 10).sort((a, b) => (b.ts || 0) - (a.ts || 0) || b.date.localeCompare(a.date));
// allure : vélo km/h (extérieur), course min/km, natation min/100 m ; efficacité = mètres par battement
const sPace = x => !x.km || !x.min ? null : x.sport === 'bike' ? (x.ext ? x.km/(x.min/60) : null) : x.sport === 'run' ? x.min/x.km : x.min/(x.km*10);
const sEff = x => { const p = sPace(x); if (!p || !x.hr) return null; const mpm = x.sport === 'bike' ? p*1000/60 : x.sport === 'run' ? 1000/p : 100/p; return mpm / x.hr; };
const fmtSPace = (sp, v) => v == null ? '—' : sp === 'bike' ? `${v.toFixed(1).replace('.', ',')} km/h` : `${Math.floor(v)}'${String(Math.round((v % 1)*60) % 60).padStart(2, '0')}`;
const paceUnit = sp => sp === 'bike' ? '' : sp === 'run' ? ' /km' : ' /100 m';
const med = v => { const a = v.filter(x => x != null).sort((x, y) => x - y); return a.length ? (a.length % 2 ? a[(a.length-1)/2] : (a[a.length/2-1] + a[a.length/2])/2) : null; };
// séances comparables : même sport, distance à ±30 % (ou durée à ±30 % sans distance), antérieures
function similarBefore(x, all){
  return all.filter(y => y !== x && y.sport === x.sport && (y.ts || 0) < (x.ts || 0) && (x.km && y.km ? Math.abs(y.km - x.km) <= 0.3*x.km : Math.abs(y.min - x.min) <= 0.3*x.min)).slice(0, 8);
}
// tendance d'allure vs médiane des séances comparables (+ = plus rapide)
function paceTrend(x, all){
  const p = sPace(x); if (p == null) return null;
  const m = med(similarBefore(x, all).map(sPace)); if (m == null) return null;
  return x.sport === 'bike' ? (p - m)/m : (m - p)/m;
}
const trendChip = d => d == null ? '' : Math.abs(d) < 0.01 ? `<span class="chip num" title="Allure stable vs tes séances comparables">＝</span>` : `<span class="chip num" style="color:${d > 0 ? 'var(--ok)' : 'var(--bad)'}" title="Allure vs médiane de tes séances comparables">${d > 0 ? '▲' : '▼'} ${Math.round(Math.abs(d)*100)} %</span>`;
function lastSessionsHTML(sp, ss){
  const all = realSessions(sp, ss), xs = all.slice(0, 5);
  if (!xs.length) return '';
  return `<h3 style="margin:14px 0 2px;font-size:14px">Dernières séances</h3>${xs.map(x => { const p = sPace(x);
    return `<div class="hist" data-ssess="${esc(x.ref)}" role="button" tabindex="0" style="cursor:pointer"><div style="flex:1;min-width:0"><b>${fmtDate(x.date)}</b>${S.recomp?.[x.ref] ? ' <span title="Séance recomposée">🧩</span>' : ''}<div class="tiny muted">${fmtDur(x.min*60)}${x.km ? ` · ${sp === 'swim' ? Math.round(x.km*1000) + ' m' : x.km.toFixed(1).replace('.', ',') + ' km'}` : ''}${p != null ? ` · ${fmtSPace(sp, p)}${paceUnit(sp)}` : ''}${x.hr ? ` · ${x.hr} bpm` : ''}</div></div>${trendChip(paceTrend(x, all))}<span class="muted" aria-hidden="true">›</span></div>`; }).join('')}${sp === 'swim' || sp === 'run' ? rcTrackedHTML(sp) : ''}`;
}
function sportSessionDlg(ref){
  if (ref.startsWith('a:')) return activityDlg(ref.slice(2));
  const ss = sportSessions(), x = ss.find(y => y.ref === ref); if (!x) return;
  const sp = x.sport, S3 = SPORTS3[sp]; if (!S3) return;
  const all = realSessions(sp, ss), p = sPace(x), e = sEff(x);
  const sim = similarBefore(x, all), mp = med(sim.map(sPace)), me = med(sim.map(sEff)), mh = med(sim.map(y => y.hr));
  const d = paceTrend(x, all);
  const kpis = [['Durée', fmtDur(x.min*60)], ['Distance', x.km ? (sp === 'swim' ? `${Math.round(x.km*1000)} m` : `${x.km.toFixed(1).replace('.', ',')} km`) : '—'], [`Allure${paceUnit(sp)}`, fmtSPace(sp, p)], ['FC moy.', x.hr ? `${x.hr} bpm` : '—']];
  // historique : 12 dernières séances du sport, la séance ouverte en surbrillance
  const hist = all.slice(0, 12).reverse(), iCur = hist.indexOf(x);
  let chart = '';
  const pv = hist.map(sPace);
  if (pv.filter(v => v != null).length >= 2) {
    const v = pv.filter(v => v != null), lo = Math.min(...v), hi = Math.max(...v), pad = (hi - lo)*0.15 || lo*0.05;
    // l'axe va vers le haut quand c'est plus rapide
    const yv = val => sp === 'bike' ? val : (lo + hi) - val;
    const pts = pv.map((val, i) => val == null ? null : [i, yv(val)]).filter(Boolean);
    const series = [{ pts, color:'var(--z3)', width:2.5 }, { type:'dots', pts, color:'var(--z3)', r:3.5 }];
    if (iCur >= 0 && pv[iCur] != null) series.push({ type:'dots', pts:[[iCur, yv(pv[iCur])]], color:'var(--accent)', r:6 });
    chart = lineChart({ series, xMin:0, xMax:Math.max(hist.length-1, 1), yMin:lo - pad, yMax:hi + pad, h:150, xLabels:hist.map((y, i) => [i, i === 0 || i === hist.length-1 || i === iCur ? `${+y.date.slice(8)}/${+y.date.slice(5, 7)}` : '']).filter(z => z[1]), yTicks:3 })
      .replace(/<text x="\d+(\.\d+)?" y="[\d.]+" text-anchor="end">-?\d+<\/text>/g, '');
  }
  const pct = (a, b, inv) => a == null || b == null ? null : (inv ? (b - a)/b : (a - b)/b);
  const line = (l, cur, ref, fmt, better) => cur == null || ref == null ? '' : `<div class="hist"><div style="flex:1">${l}</div><span class="num" style="white-space:nowrap">${fmt(cur)}</span><span class="tiny muted num" style="white-space:nowrap;min-width:64px;text-align:right">méd. ${fmt(ref)}</span>${trendChip(better)}</div>`;
  const cmp = sim.length ? `<h3 style="margin:14px 0 2px;font-size:14px">Vs tes ${sim.length} séance${sim.length > 1 ? 's' : ''} comparable${sim.length > 1 ? 's' : ''}</h3>
      <p class="tiny muted" style="margin:0 0 4px">${sp === 'swim' ? 'Natation' : S3.l} de distance proche (±30 %), avant celle-ci.</p>
      ${line(`Allure${paceUnit(sp)}`, p, mp, v => fmtSPace(sp, v), sp === 'bike' ? pct(p, mp) : pct(p, mp, true))}
      ${line('FC moy. <span class="tiny muted">bpm</span>', x.hr, mh, v => Math.round(v), pct(x.hr, mh, true))}
      ${line('Efficacité <span class="tiny muted">m/batt.</span>', e, me, v => v.toFixed(2).replace('.', ','), pct(e, me))}
      ${d != null ? `<div class="note ${d >= 0.01 ? 'ok' : d <= -0.01 ? 'warn' : ''}" style="margin-top:10px">${d >= 0.01 ? `Plus rapide que d'habitude sur ce format (+${Math.round(d*100)} %)` : d <= -0.01 ? `Plus lent que d'habitude sur ce format (−${Math.round(-d*100)} %)` : 'Allure dans ta moyenne sur ce format'}${e != null && me != null ? (e > me*1.01 ? ', avec un meilleur rendement cardio.' : e < me*0.99 ? ', pour un rendement cardio en retrait.' : ', rendement cardio stable.') : '.'}</div>` : ''}`
    : `<p class="tiny muted" style="margin-top:12px">Pas encore de séance comparable (distance proche) pour situer celle-ci.</p>`;
  openDlg(`<span class="muted small">${fmtDate(x.date)}${x.src ? ' · ' + esc(x.src) : ''}</span>
    <h2 style="margin:6px 0">${S3.ic} ${esc(x.name || S3.l)}</h2>
    <div class="grid4" style="margin:8px 0">${kpis.map(([l, v]) => `<div class="kpi"><div class="v num" style="font-size:22px">${v}</div><div class="l">${l}</div></div>`).join('')}</div>
    ${chart ? `<h3 style="margin:12px 0 2px;font-size:14px">Allure sur tes ${hist.length} dernières séances</h3><p class="tiny muted" style="margin:0">Plus haut = plus rapide · point orange : cette séance.</p>${chart}` : ''}
    ${cmp}
    ${sp === 'swim' || sp === 'run' ? (recompSavedHTML(x) || `<div class="row" style="margin-top:12px"><button class="btn" data-recomp="${esc(x.ref)}">🧩 Recomposer la séance</button><span class="tiny muted">bloc par bloc : séries, sprints, récup</span></div>`) : ''}
    <p class="tiny muted" style="margin-top:10px">Efficacité = mètres parcourus par battement cardiaque : à allure égale, elle monte quand tu progresses.</p>`);
}
document.addEventListener('click', e => { const r = e.target.closest('[data-ssess]'); if (r) sportSessionDlg(r.dataset.ssess); });
document.addEventListener('keydown', e => { if (e.key !== 'Enter' && e.key !== ' ') return; const r = e.target.closest?.('[data-ssess]'); if (r) { e.preventDefault(); sportSessionDlg(r.dataset.ssess); } });
function actRow(a){
  const pl = a.planId ? S.plan.find(s=>s.id===a.planId) : null;
  const ev = pl ? sessionEval(a, pl) : null;
  return `<div class="hist" data-act="${a.id}" style="cursor:pointer"><div style="flex:1;min-width:0"><b>${ev ? `<span title="${esc(ev.title)}">${ev.icon}</span> ` : ''}${esc(pl ? WORKOUTS[pl.workoutId].name : a.name)}</b><div class="tiny muted">${fmtDate(a.date)} · ${fmtDur(a.durationS)}${!isIndoor(a) && a.distanceKm ? ` · ${String(a.distanceKm).replace('.',',')} km${speedOf(a)?` · ${String(speedOf(a)).replace('.',',')} km/h`:''}${a.elevM?` · D+ ${a.elevM} m`:''}` : ''}${a.np?` · NP ${a.np} W`:''}${a.avgHr?` · ${a.avgHr} bpm`:''}${a.tss?` · TSS ${a.tss}`:''}</div></div>${a.feel?.rpe?`<span class="chip num">RPE ${a.feel.rpe}</span>`:''}</div>`;
}

/* ----- Calendrier ----- */
let calMonth = null; // 'YYYY-MM'
const isIndoor = a => a.indoor === true || (a.indoor == null && !!a.hasPower);
/* Vélotaf : sortie extérieure de 5 à 9 km (trajet domicile-travail). */
const VELOTAF_KM = [5, 9];
const isVelotafKm = km => km != null && +km >= VELOTAF_KM[0] && +km <= VELOTAF_KM[1];
const isVelotaf = a => !isIndoor(a) && isVelotafKm(a.distanceKm);
const isVelotafW = w => !Health.bikeIndoor(w) && isVelotafKm(w.distance_km);
function monthHTML(){
  const t = todayISO();
  if (!calMonth) calMonth = t.slice(0, 7);
  const [y, m] = calMonth.split('-').map(Number);
  const first = `${calMonth}-01`, start = monday(first);
  const last = iso(new Date(y, m, 0)); const end = addDays(monday(last), 6);
  const MONTHS_L = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  let cells = DOW.map(d => `<div class="dh">${d.slice(0,1)}</div>`).join('');
  let done = 0, missed = 0, indoor = 0, outdoor = 0, others = 0, taf = 0;
  const extraByDay = {}; for (const e of Health.extraWorkouts()) (extraByDay[e.date] ||= []).push(e);
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const inMonth = d.slice(0, 7) === calMonth;
    const acts = S.activities.filter(a => a.date === d);
    const extra = extraByDay[d] || [];
    const plan = S.plan.filter(s => s.date === d);
    const miss = d < t && plan.some(s => s.status === 'planned' && mandatory(s)) && !acts.length;
    const tp = triItems(d), tpl = tp.filter(x => triStatus(x) === 'planned' || x.sport === 'race' && d >= t);
    const planned = d >= t && plan.some(s => s.status === 'planned');
    if (inMonth) { if (miss) missed++; for (const a of acts) { if (isVelotaf(a)) { taf++; continue; } done++; isIndoor(a) ? indoor++ : outdoor++; } for (const e of extra) { if (e.sport === 'bike') { if (isVelotafW(e.w)) { taf++; continue; } done++; Health.bikeIndoor(e.w) ? indoor++ : outdoor++; } else others++; } }
    const rings = [...(planned ? plan.filter(s => s.status === 'planned').map(() => 'pl') : []), ...tpl.map(x => x.sport === 'race' ? 'race' : 'pl ' + (x.sport === 'swim' ? 'sw' : 'rn'))];
    const dots = [...acts.map(a => isIndoor(a) ? 'in' : isVelotaf(a) ? 'taf' : 'ext'), ...extra.map(e => e.sport === 'bike' ? (Health.bikeIndoor(e.w) ? 'in' : isVelotafW(e.w) ? 'taf' : 'ext') : e.sport === 'swim' ? 'sw' : e.sport === 'run' ? 'rn' : 'oth'), ...rings].slice(0, 5).map(c => `<i class="${c}"></i>`).join('');
 const target = (plan[0]?.id || acts.length || extra.length || tp.length) ? `data-calday="${d}"` : '';
    const title = [...acts.map(a => `${isIndoor(a)?'Home trainer':isVelotaf(a)?'Vélotaf':'Extérieur'} · ${a.name}`), ...extra.map(e => `${e.w.type}${e.w.duration_min ? ' · ' + fmtDur(e.w.duration_min*60) : ''}`), ...tp.map(x => `${triWorkout(x).name} (prévue)`), ...plan.map(s => `${WORKOUTS[s.workoutId].name}${s.status==='done'?' ✓':s.status==='skipped'?' (sautée)':''}`)].join('\n');
    cells += `<div class="c ${inMonth?'':'out'} ${d===t?'today':''} ${miss?'miss':''} ${dots ? 'hasdots' : ''}" ${target} title="${esc(title)}" aria-label="${fmtDate(d)}${miss?', séance manquée':''}">
      <span>${+d.slice(8)}</span>${miss ? '<span class="sm" aria-hidden="true">😞</span>' : ''}${dots ? `<div class="dots">${dots}</div>` : ''}</div>`;
  }
  return `<div class="card">
    <div class="mnav"><button data-mnav="-1" aria-label="Mois précédent">‹</button><b>${MONTHS_L[m-1]} ${y}</b><button data-mnav="1" aria-label="Mois suivant">›</button></div>
    <div class="mcal">${cells}</div>
    <div class="mleg"><span><i style="background:var(--accent)"></i>Home trainer</span><span><i style="background:var(--z2)"></i>Extérieur</span><span><i style="background:var(--z4)"></i>Vélotaf</span>${triOn() || Health.extraWorkouts().some(e => e.sport === 'swim') ? '<span><i style="background:var(--swim)"></i>Nat</span><span><i style="background:var(--run)"></i>Course</span>' : ''}<span><i style="background:var(--muted);opacity:.7"></i>Autre sport</span><span><i class="ring"></i>Prévue${triOn() ? ' (couleur du sport)' : ''}</span><span>😞 Manquée</span></div>
    <div class="tiny muted" style="margin-top:8px">Ce mois-ci : <b style="color:var(--text)">${done}</b> sortie${done>1?'s':''} vélo (${indoor} home trainer, ${outdoor} extérieur)${taf ? ` · ${taf} vélotaf` : ''}${others ? ` · ${others} autre${others>1?'s':''} sport${others>1?'s':''}` : ''}${missed ? ` · <b style="color:var(--bad)">${missed} manquée${missed>1?'s':''}</b>` : ''}</div>
  </div>`;
}
document.addEventListener('click', e => {
  const nav = e.target.closest('[data-mnav]');
  if (nav) { const [y, m] = calMonth.split('-').map(Number); const d = new Date(y, m - 1 + (+nav.dataset.mnav), 1); calMonth = `${d.getFullYear()}-${pad(d.getMonth()+1)}`; render(); return; }
  const c = e.target.closest('[data-calday]'); if (c) dayDlg(c.dataset.calday);
});
/* Jour du calendrier : toutes les séances du jour, home trainer par défaut, sélecteur pour passer de l'une à l'autre */
function dayItems(d){
  const items = [];
  for (const a of S.activities.filter(a => a.date === d)) {
    const pl = a.planId ? S.plan.find(s => s.id === a.planId) : null, taf = isVelotaf(a), ind = isIndoor(a);
    items.push({ key:'a:' + a.id, ts:a.startTs || 0, prio: ind ? 0 : taf ? 5 : 2, ic: ind ? '🏠' : taf ? '🚲' : '🚴', l: ind ? 'Home trainer' : taf ? 'Vélotaf' : (pl ? WORKOUTS[pl.workoutId].name : 'Vélo'), open: () => activityDlg(a.id) });
  }
  for (const s of S.plan.filter(s => s.date === d && s.status === 'planned'))
    items.push({ key:'p:' + s.id, ts:0, prio:1, ic:'○', l: WORKOUTS[s.workoutId].name, open: () => sessionDlg(s.id) });
  for (const x of triItems(d).filter(x => triStatus(x) !== 'done')) {
    const W = triWorkout(x); items.push({ key:'tri:' + x.id, ts:0, prio: x.sport === 'race' ? -1 : 1, ic: TRI_IC[x.sport], l: x.sport === 'race' ? 'Course' : W.name.replace(/^Nat |^Sortie /, ''), open: () => triDlg(x.id) });
  }
  for (const e of Health.extraWorkouts().filter(x => x.date === d)) {
    const sp = e.sport, ref = 'w:' + e.w.start_at, taf = sp === 'bike' && isVelotafW(e.w);
    const inSS = ['bike', 'swim', 'run'].includes(sp) && !taf && (+e.w.duration_min || 0) > 1; // fiche « séance » : vélo, nat, course uniquement
    items.push({ key: ref, ts: Math.floor(Date.parse(e.w.start_at)/1000), prio: sp === 'bike' ? (taf ? 5 : Health.bikeIndoor(e.w) ? 0 : 2) : 3,
      ic: SPORTS3[sp]?.ic || { strength:'🏋️', walk:'🚶', mobility:'🧘' }[sp] || '⏱️', l: taf ? 'Vélotaf' : e.w.type || 'Séance',
      open: () => inSS ? sportSessionDlg(ref) : openDlg(`<span class="muted small">${fmtDate(d)} · ${esc(e.w.source || '')}</span><h2 style="margin:6px 0">${esc(e.w.type)}</h2><div class="grid4" style="margin:8px 0">${[['Durée', e.w.duration_min ? fmtDur(e.w.duration_min*60) : '—'], ['Distance', e.w.distance_km ? (+e.w.distance_km).toFixed(1).replace('.', ',') + ' km' : '—'], ['FC moy.', e.w.avg_hr ? Math.round(e.w.avg_hr) + ' bpm' : '—'], ['TSS', '~' + e.tss]].map(([l, v]) => `<div class="kpi"><div class="v num" style="font-size:22px">${v}</div><div class="l">${l}</div></div>`).join('')}</div><p class="tiny muted">Activité Apple Santé / Intervals.icu, comptée dans ta forme et ta fatigue.</p>`) });
  }
  items.sort((x, y) => x.ts - y.ts || x.prio - y.prio);
  // libellés en double (deux vélotafs…) : on ajoute l'heure
  const cnt = {}; for (const x of items) cnt[x.l] = (cnt[x.l] || 0) + 1;
  for (const x of items) if (x.ts && cnt[x.l] > 1) { const t = new Date(x.ts*1000); x.l += ` ${t.getHours()}h${pad(t.getMinutes())}`; }
  return items;
}
function dayDlg(d, key){
  const items = dayItems(d); if (!items.length) return;
  const cur = items.find(x => x.key === key) || items.slice().sort((x, y) => x.prio - y.prio || x.ts - y.ts)[0];
  cur.open();
  if (items.length < 2) return;
  const bar = `<div class="seg daysel" role="tablist" aria-label="Séances du ${fmtDate(d)}" style="margin:0 34px 10px 0">${items.map(x => `<button role="tab" aria-selected="${x === cur}" class="${x === cur ? 'on' : ''}" data-dayitem="${esc(x.key)}" data-day="${d}">${x.ic} ${esc(x.l)}</button>`).join('')}</div>`;
  const xb = dlgBody.querySelector('.x'); if (xb) xb.insertAdjacentHTML('afterend', bar); else dlgBody.insertAdjacentHTML('afterbegin', bar);
}
document.addEventListener('click', e => { const b = e.target.closest('[data-dayitem]'); if (b) { e.stopPropagation(); dayDlg(b.dataset.day, b.dataset.dayitem); } });
function calHTML(){
  const t = todayISO();
  const weeks = {}; for (const s of S.plan) (weeks[monday(s.date)] ||= []).push(s);
  const tweeks = {}; if (triOn()) for (const x of S.triPlan || []) { (tweeks[monday(x.date)] ||= []).push(x); weeks[monday(x.date)] ||= []; }
  const keys = Object.keys(weeks).sort();
  const total = S.plan.length, mand = S.plan.filter(mandatory).length;
  let h = monthHTML() + phaseHTML() + triBannerHTML() + `<div class="card"><div class="row between"><h2>Programme</h2><span class="muted small">${(() => { const w = weekCount(); return `${w.done}/${w.total} cette semaine · ${w.left} à venir`; })()}</span></div>
    <p class="muted small" style="margin:0">Touchez une séance pour la voir, la déplacer ou la changer (« j'ai fait autre chose ») : le programme s'adapte.</p>
    <div class="row" style="margin-top:10px"><button class="btn sm" id="jumpToday">Aller à cette semaine</button><button class="btn sm" data-add="1">+ Ajouter une séance</button><button class="btn sm" data-absence="1">✈︎ Absence / vacances</button></div>
    ${absencesHTML()}</div>`;
  for (const k of keys) {
    const list = weeks[k], tl = tweeks[k] || []; const done = list.filter(s=>s.status==='done' || (s.swap && s.swap.sp !== 'rest')).length + tl.filter(x => triStatus(x) === 'done' || (x.swap && x.swap.sp !== 'rest')).length;
    const tss = list.reduce((a,s)=>a+wTSS(s.workoutId),0), hd = list[0] || tl[0];
    const triVol = tl.length ? (() => { const sw = tl.filter(x => x.sport === 'swim').reduce((a, x) => a + triEst(x).m, 0), rn = tl.filter(x => x.sport === 'run').reduce((a, x) => a + triEst(x).sec, 0); return `${sw ? ` · 🏊 ${(sw/1000).toFixed(1).replace('.', ',')} km` : ''}${rn ? ` · 🏃 ${fmtDur(rn)}` : ''}`; })() : '';
    h += `<div class="week" id="w-${k}"><div class="wh"><h3>Sem. ${hd.week+1} · ${esc(hd.block)}</h3><span class="tiny muted num">${fmtShort(k)} · ${done}/${list.length + tl.length}${tss ? ` · TSS ${tss}` : ''}${triVol}${k <= t ? ` · <button class="linkbtn" data-story="${k}">📊 Bilan</button>` : ''}</span></div>`;
    const rows = [...list.map(s => ({ d: s.date, o: 0, s })), ...tl.map(x => ({ d: x.date, o: x.sport === 'swim' ? -1 : 1, x }))].sort((a, b) => a.d.localeCompare(b.d) || a.o - b.o);
    for (const { s, x } of rows) {
      if (x) { h += x.swap ? swapRowHTML('t', x) : triRowHTML(x); continue; }
      if (s.swap) { h += swapRowHTML('b', s); continue; }
      const W = WORKOUTS[s.workoutId], d = parseD(s.date);
      h += `<div class="sess ${s.status} ${s.date===t?'today':''} ${s.kind==='optional'?'opt':''}" data-open="${s.id}">
        <div class="d"><span>${DOW[dowMon(s.date)]}</span><b class="num">${d.getDate()}</b></div>
        <div class="m"><b>${esc(W.name)}</b><span class="tiny muted"><span class="zone" style="background:${ZCOL(zoneOf(mainStep(s.workoutId)?.p||W.steps.length&&flat(W.steps)[0].p))}"></span>${fmtDur(wDur(s.workoutId))} · TSS ${wTSS(s.workoutId)}${mainStep(s.workoutId)?` · ${watts(mainStep(s.workoutId).p)} W`:''}</span></div>
        <div class="st">${s.status==='done'?'✅':s.status==='skipped'?'⏭️':W.type==='test'?'🎯':''}</div></div>`;
    }
    h += `</div>`;
  }
  setTimeout(() => { const b = $('#jumpToday'); if (b) b.onclick = () => { const el = document.getElementById('w-'+monday(t)) || document.querySelector('.week'); el?.scrollIntoView({ behavior:'smooth', block:'start' }); }; }, 0);
  return h;
}

/* ----- Triathlon : réglages, fiche séance, intégration calendrier / programme ----- */
const parsePace = (v, def) => { const m = String(v || '').trim().match(/^(\d{1,2})\s*[:'’.,h]\s*(\d{1,2})/); return m ? +m[1]*60 + +m[2] : (+v > 30 ? +v : def); };
// estimations depuis tes séances : CSS ≈ allure moyenne des nats ≥ 1,5 km − 5 s ; seuil course ≈ allure des courses de 35-70 min les plus rapides
function triGuess(){
  const ws = Health.extraWorkouts(), med = a => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(b.length/2)] : null; };
  const sw = ws.filter(e => e.sport === 'swim' && +e.w.distance_km >= 1.5 && +e.w.duration_min > 20).map(e => e.w.duration_min*60/(e.w.distance_km*10));
  const rn = ws.filter(e => e.sport === 'run' && +e.w.distance_km >= 6 && +e.w.duration_min >= 30 && +e.w.duration_min <= 75).map(e => e.w.duration_min*60/e.w.distance_km).sort((a, b) => a - b).slice(0, 3); // tes courses d'entraînement sont plus lentes que le seuil : ~5 %
  return { css: sw.length >= 2 ? Math.round(med(sw) - 5) : null, runThr: rn.length ? Math.round(rn[0]*0.95) : null };
}
const WG_SP = [['bike', '🚴', 'Vélo'], ['swim', '🏊', 'Nat'], ['run', '🏃', 'Course']];
function weekGridHTML(m){ // m = { bike:[jours], swim:[…], run:[…] }
  const DN = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  return `<div class="wgrid" role="group" aria-label="Ma semaine"><span></span>${DN.map((d, i) => `<span class="wh">${d}</span>`).join('')}
    ${WG_SP.map(([k, ic, l]) => `<span class="wl">${ic} ${l}</span>${DN.map((_, i) => `<button type="button" class="wc ${k} ${m[k].includes(i) ? 'on' : ''}" data-wg="${k}" data-v="${i}" aria-pressed="${m[k].includes(i)}" aria-label="${l} ${DOW[i]}">${m[k].includes(i) ? ic : ''}</button>`).join('')}`).join('')}</div>`;
}
function bindWeekGrid(root, m){
  root.querySelectorAll('[data-wg]').forEach(b => b.onclick = e => { e.stopPropagation(); const k = b.dataset.wg, v = +b.dataset.v, on = !m[k].includes(v);
    m[k] = on ? [...m[k], v].sort((a, c) => a - c) : m[k].filter(x => x !== v); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.textContent = on ? WG_SP.find(x => x[0] === k)[1] : ''; });
}
function triSetupDlg(){
  const T = Object.assign(TRI_DEF(), S.tri || {}), g = triGuess();
  const wm = { bike: [0, 1, 2, 3, 4, 5, 6].filter(d => S.profile.days[d]?.avail), swim: T.swimDays.slice(0, T.swimPerWeek), run: T.runDays.slice(0, T.runPerWeek) };
  if (!S.tri) { if (g.css) T.css = g.css; if (g.runThr) T.runThr = g.runThr; }
  const DN = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const dayPick = (name, sel) => `<div class="seg multi" data-days="${name}">${DN.map((l, i) => `<button type="button" class="${sel.includes(i) ? 'on' : ''}" data-v="${i}" aria-pressed="${sel.includes(i)}" aria-label="${DOW[i]}">${l}</button>`).join('')}</div>`;
  const cnt = (name, v) => `<div class="seg" data-cnt="${name}">${[1, 2, 3].map(n => `<button type="button" class="${v === n ? 'on' : ''}" data-v="${n}">${n}</button>`).join('')}</div>`;
  openDlg(`<h2 style="margin:0 0 4px">🏁 Plan triathlon</h2>
    <p class="small muted" style="margin:0 0 10px">Tout le plan (vélo, nat, course) est construit en arrière depuis ta course : base → seuil → VO2 → spécifique montagne → affûtage. Les séances vélo à venir sont régénérées ; celles déjà faites restent.</p>
    <form id="triF" class="grid2" style="gap:10px">
      <div style="grid-column:1/-1"><label class="f">Course A</label><input type="text" name="name" value="${esc(T.race.name)}"></div>
      <div><label class="f">Date</label><input type="date" name="date" value="${T.race.date}" min="${addDays(todayISO(), 21)}"></div>
      <div><label class="f">Nat (m)</label><input type="number" name="swim" value="${T.race.swim}" step="100"></div>
      <div><label class="f">Vélo (km)</label><input type="number" name="bike" value="${T.race.bike}"></div>
      <div><label class="f">Vélo D+ (m)</label><input type="number" name="bikeDp" value="${T.race.bikeDp}" step="10"></div>
      <div><label class="f">Course (km)</label><input type="number" name="run" value="${T.race.run}" step="0.1"></div>
      <div><label class="f">Course D+ (m)</label><input type="number" name="runDp" value="${T.race.runDp}" step="10"></div>
      <div><label class="f">CSS nat (/100 m)</label><input type="text" name="css" value="${fmtPace(T.css)}" inputmode="numeric"><span class="tiny muted">${g.css && !S.tri ? 'estimée sur tes nats' : 'allure seuil en piscine'}</span></div>
      <div><label class="f">Seuil course (/km)</label><input type="text" name="runThr" value="${fmtPace(T.runThr)}" inputmode="numeric"><span class="tiny muted">${g.runThr && !S.tri ? 'estimé sur tes courses' : '≈ allure 10 km + 8 s'}</span></div>
      <div style="grid-column:1/-1"><label class="f">Ma semaine</label>${weekGridHTML(wm)}
        <p class="tiny muted" style="margin:6px 0 0">Vélo : les 2 jours les plus espacés portent les séances clés (durées max dans Profil). Course : la dernière de la semaine = sortie longue ; avec 3 courses, la 1re = footing facile. Nat : la 1re = qualité.</p></div>
      <div style="grid-column:1/-1"><label class="f">Sortie vélo longue du week-end <span class="tiny muted">(à partir du bloc VO2)</span></label><select name="longRide">${[120, 150, 180, 210].map(m => `<option value="${m}" ${T.longRide === m ? 'selected' : ''}>jusqu'à ${fmtDur(m*60)}</option>`).join('')}</select></div>
      <label class="small" style="grid-column:1/-1;display:flex;gap:8px;align-items:center"><input type="checkbox" name="doubles" ${T.doubles ? 'checked' : ''} style="width:auto"> Doubles séances (nat le matin + vélo le soir, enchaînements vélo → course)</label>
    </form>
    <p class="tiny muted" id="triMsg" style="margin:8px 0 0"></p>
    <div class="row" style="margin-top:12px"><button class="btn primary" id="triGo">${triOn() ? 'Mettre à jour le plan' : 'Créer le plan triathlon'}</button>${triOn() ? '<button class="btn ghost" id="triOff">Revenir au plan vélo seul</button>' : ''}</div>`);
  const f = $('#triF'); bindWeekGrid(f, wm);
  f.querySelectorAll('[data-days] button').forEach(b => b.onclick = () => { b.classList.toggle('on'); b.setAttribute('aria-pressed', b.classList.contains('on')); });
  f.querySelectorAll('[data-cnt] button').forEach(b => b.onclick = () => { b.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); });
  const days = n => [...f.querySelectorAll(`[data-days="${n}"] button.on`)].map(b => +b.dataset.v);
  const cntV = n => +(f.querySelector(`[data-cnt="${n}"] button.on`)?.dataset.v || 2);
  $('#triGo').onclick = () => {
    const E = f.elements, race = { name: E.name.value.trim() || 'Course A', date: E.date.value, swim: +E.swim.value || 2000, bike: +E.bike.value || 90, bikeDp: +E.bikeDp.value || 0, run: +E.run.value || 21, runDp: +E.runDp.value || 0 };
    if (T.race.bikeProf && race.bike === T.race.bike) race.bikeProf = T.race.bikeProf; if (T.race.runProf && race.run === T.race.run) race.runProf = T.race.runProf; // tracés GPX gardés si la distance ne change pas
    const nT = { ...T, enabled:true, race, css: parsePace(E.css.value, T.css), runThr: parsePace(E.runThr.value, T.runThr), swimPerWeek: Math.min(3, wm.swim.length), runPerWeek: Math.min(3, wm.run.length), swimDays: wm.swim, runDays: wm.run, doubles: E.doubles.checked, longRide: +E.longRide.value || 180 };
    const msg = !race.date || race.date < addDays(todayISO(), 21) ? 'Choisis une date au moins 3 semaines plus tard.' : !wm.bike.length ? 'Coche au moins un jour de vélo.' : !wm.swim.length ? 'Coche au moins un jour de nat.' : !wm.run.length ? 'Coche au moins un jour de course.' : '';
    if (msg) { $('#triMsg').textContent = msg; $('#triMsg').style.color = 'var(--bad)'; return; }
    for (let d = 0; d < 7; d++) S.profile.days[d].avail = wm.bike.includes(d);
    applyTri(nT); closeDlg(); TAB = 'cal'; render(); toast(`Plan triathlon créé : ${S.triPlan.filter(x => x.date >= todayISO()).length} séances nat / course jusqu'au ${fmtDate(race.date)}`);
  };
  if ($('#triOff')) $('#triOff').onclick = () => { S.tri.enabled = false; S.triPlan = (S.triPlan || []).filter(x => x.date < todayISO()); save(); closeDlg(); render(); toast('Plan triathlon désactivé : les séances nat / course à venir sont retirées'); };
}
function applyTri(T){
  const p = S.profile, t = todayISO();
  S.tri = T;
  // le vélo suit la course : fin du plan = jour de course, semaine de course = dernière semaine
  p.endDate = T.race.date; p.goalDate = T.race.date;
  const wk = [5, 6].find(d => p.days[d]?.avail); if (wk != null) p.days[wk].max = Math.max(p.days[wk].max || 0, T.longRide || 180);
  regenerateFuture();
  const keep = (S.triPlan || []).filter(x => x.date < t);
  S.triPlan = [...keep, ...generateTri(p, T, t)];
  save();
}
const triItems = d => triOn() ? (S.triPlan || []).filter(x => x.date === d) : [];
function triRowHTML(x){
  const W = triWorkout(x), E = triEst(x, W), stt = triStatus(x), t = todayISO();
  const meta = x.sport === 'race' ? esc(T_raceLine()) : `${fmtDur(E.sec)} · ${x.sport === 'swim' ? E.m + ' m' : (E.m/1000).toFixed(1).replace('.', ',') + ' km'}${x.kind === 'optional' ? ' · optionnelle' : ''}`;
  return `<div class="sess ${stt === 'missed' ? 'planned' : stt} ${x.date === t ? 'today' : ''} ${x.kind === 'optional' ? 'opt' : ''} tri-${x.sport}" data-tri="${x.id}">
    <div class="d"><span>${DOW[dowMon(x.date)]}</span><b class="num">${parseD(x.date).getDate()}</b></div>
    <div class="m"><b>${TRI_IC[x.sport]} ${esc(W.name)}</b><span class="tiny muted">${meta}</span></div>
    <div class="st">${stt === 'done' ? '✅' : stt === 'skipped' ? '⏭️' : stt === 'missed' ? '😞' : x.sport === 'race' ? '🏁' : ''}</div></div>`;
}
const T_raceLine = () => { const r = tri().race; return `${r.swim} m · ${r.bike} km (${r.bikeDp} m D+) · ${r.run} km (${r.runDp} m D+)`; };
/* ----- Course A : objectifs et prédiction par discipline ----- */
// vélo : modèle physique (puissance = gravité + roulement + aéro), parcours découpé en montées à 5 %, descentes et plat
function bikeSpeed(P, grade, m, cda = 0.32, crr = 0.005, rho = 1.15, eta = 0.975){
  const g = 9.81, th = Math.atan(grade), F = m*g*(Math.sin(th) + crr*Math.cos(th));
  let lo = 0.5, hi = 25; // m/s : bissection sur P·η = (F + ½ρ·CdA·v²)·v
  for (let k = 0; k < 60; k++) { const v = (lo + hi)/2; ((F + 0.5*rho*cda*v*v)*v > P*eta) ? hi = v : lo = v; }
  return (lo + hi)/2;
}
// parcours GPX → altitude tous les 100 m (lissée sur 300 m) : de quoi simuler chaque portion
function gpxProfile(txt){
  const pts = [...txt.matchAll(/<trkpt[^>]*lat="([\d.\-]+)"[^>]*lon="([\d.\-]+)"[^>]*>[\s\S]*?<ele>([\d.\-]+)<\/ele>/g)].map(m => [+m[1], +m[2], +m[3]]);
  if (pts.length < 10) return null;
  const D = [0], E = [pts[0][2]];
  for (let i = 1; i < pts.length; i++) { const [a1, o1] = pts[i-1], [a2, o2, e] = pts[i], R = Math.PI/180;
    D.push(D[i-1] + 6371000*Math.hypot((o2 - o1)*R*Math.cos((a1 + a2)/2*R), (a2 - a1)*R)); E.push(e); }
  const raw = []; for (let x = 0, j = 0; x <= D[D.length - 1]; x += 100) { while (j < D.length - 2 && D[j+1] < x) j++; const t = (x - D[j])/Math.max(D[j+1] - D[j], 1e-9); raw.push(E[j] + t*(E[j+1] - E[j])); }
  const el = raw.map((_, i) => { const w = raw.slice(Math.max(0, i - 1), i + 2); return Math.round(w.reduce((a, b) => a + b, 0)/w.length*10)/10; });
  let up = 0, dn = 0; for (let i = 1; i < el.length; i++) { const d = el[i] - el[i-1]; d > 0 ? up += d : dn -= d; }
  return { step:100, el, km: Math.round(el.length*0.1*10)/10, up: Math.round(up), dn: Math.round(dn) };
}
// coût énergétique de la course selon la pente (Minetti 2002), relatif au plat ; au-delà de 15 % on marche vite : plafonné
const minetti = g => { g = Math.max(-0.3, Math.min(0.4, g)); const c = 155.4*g**5 - 30.4*g**4 - 43.3*g**3 + 46.3*g**2 + 19.5*g + 3.6; return Math.min(c/3.6, g > 0.15 ? 3 : 9); };
function triPredict(){
  const T = Object.assign(TRI_DEF(), S.tri || {}), r = T.race, g = triGuess(), kg = +S.profile?.weightKg || 75;
  const css = g.css || T.css, thr = g.runThr || T.runThr;
  // nat : allure course ≈ CSS + 4 s/100 m sur 2 km, +3 % de distance en eau libre (trajectoire, visée)
  const swim = r.swim/100*(css + 4)*1.03;
  // vélo : IF 0,78 × FTP sur un half vallonné (0,75–0,83 selon le niveau), +8 % dans les montées, roue libre dans les descentes (≤ 52 km/h)
  const P = 0.78*ftp(), m = kg + 8.5;
  let bike = 0;
  if (r.bikeProf) { const el = r.bikeProf.el, st = r.bikeProf.step;
    for (let i = 1; i < el.length; i++) { const gr = (el[i] - el[i-1])/st, pw = gr > 0.02 ? P*1.08 : gr < -0.03 ? P*0.3 : P;
      let v = bikeSpeed(pw, gr, m, 0.30, 0.005, 1.12); if (gr < -0.03) v = Math.min(v, 52/3.6); bike += st/v; } }
  else { const climbKm = Math.min(r.bike*0.45, (r.bikeDp || 0)/0.05/1000), flatKm = Math.max(0, r.bike - 2*climbKm);
    bike = climbKm*1000/bikeSpeed(P*1.08, 0.05, m) + climbKm*1000/Math.min(bikeSpeed(P*0.3, -0.05, m), 52/3.6) + flatKm*1000/bikeSpeed(P, 0, m); }
  // course : allure plat d'après vélo ≈ seuil × 1,10, modulée par la pente portion par portion (Minetti)
  const flat = thr*1.10;
  let run = 0;
  if (r.runProf) { const el = r.runProf.el, st = r.runProf.step; for (let i = 1; i < el.length; i++) run += st/1000*flat*minetti((el[i] - el[i-1])/st); }
  else { const gUp = (r.runDp || 0)/(r.run*500); run = r.run/2*flat*(minetti(gUp) + minetti(-gUp)); } // sans tracé : moitié montée, moitié descente
  return { swim, t1: 180, bike, t2: 90, run, css, thr, P: Math.round(P), cssData: !!g.css, thrData: !!g.runThr, flat, bikeGpx: !!r.bikeProf, runGpx: !!r.runProf };
}
const fmtHMS = sec => { sec = Math.round(sec); const h = Math.floor(sec/3600), m = Math.floor(sec % 3600/60), x = sec % 60; return h ? `${h}h${pad(m)}'${pad(x)}` : `${m}'${pad(x)}`; };
const parseHMS = v => { const n = String(v || '').trim().split(/[^\d]+/).filter(Boolean).map(Number); if (!n.length) return null; return n.length >= 3 ? n[0]*3600 + n[1]*60 + n[2] : n.length === 2 ? n[0]*60 + n[1] : n[0]*60; };
const TRI_LEGS = [['swim', '🏊 Nat'], ['t1', 'T1'], ['bike', '🚴 Vélo'], ['t2', 'T2'], ['run', '🏃 Course']];
function triGoalTableHTML(){
  const pr = triPredict(), G = tri()?.goals || {}, sum = o => TRI_LEGS.reduce((a, [k]) => a + (o[k] || 0), 0);
  const hasG = TRI_LEGS.some(([k]) => G[k]), gTot = TRI_LEGS.every(([k]) => G[k]) ? sum(G) : null, pTot = sum(pr);
  const cell = g => { if (!g) return '<td class="num muted">—</td>'; return `<td class="num">${fmtHMS(g)}</td>`; };
  const dlt = (g, p) => g ? `<span class="${p <= g ? 'ok' : 'bad'}">${p <= g ? '−' : '+'}${fmtHMS(Math.abs(p - g))}</span>` : '';
  return `<table class="tgoal"><thead><tr><th></th><th>Objectif</th><th>Prédiction</th></tr></thead><tbody>
    ${TRI_LEGS.map(([k, l]) => `<tr><th>${l}</th>${cell(G[k], pr[k])}<td class="num">${fmtHMS(pr[k])} ${dlt(G[k], pr[k])}</td></tr>`).join('')}
    <tr class="tot"><th>Total</th>${gTot ? `<td class="num">${fmtHMS(gTot)}</td>` : '<td class="num muted">—</td>'}<td class="num">${fmtHMS(pTot)} ${dlt(gTot, pTot)}</td></tr></tbody></table>
    ${triBenchHTML(pr)}
    <p class="tiny muted" style="margin:6px 0 0">Nat : CSS ${fmtPace(pr.css)} /100 m${pr.cssData ? ' (tes nats)' : ''} + 4 s, +3 % en eau libre · Vélo : ${pr.P} W (78 % FTP), modèle physique ${pr.bikeGpx ? 'sur le tracé GPX' : 'sans tracé (montées à 5 %)'} · Course : ${fmtPace(pr.flat)} /km sur le plat (seuil ${fmtPace(pr.thr)}${pr.thrData ? ', tes courses' : ''} × 1,10), modulé par la pente ${pr.runGpx ? 'du tracé GPX' : ''} (Minetti) · T1/T2 : ordre de grandeur de tes transitions. <a href="#" data-trigoals="1">Objectifs et tracés GPX</a></p>`;
}
// repères par distance : niveau actuel (tes allures) vs niveau qu'il faut pour tenir l'objectif de la course A
const riegel = (t, d0, d1, b = 1.06) => t*Math.pow(d1/d0, b);
function triBenchHTML(pr){
  const G = tri()?.goals || {}, r = tri().race;
  // course : seuil ≈ allure 10 km + 8 s → 10 km = (seuil − 8 s) × 10, puis Riegel (b = 1,06)
  const runFactor = pr.run/pr.flat; // somme des facteurs de pente (Minetti) : temps course = allure plat × facteur
  const thrGoal = G.run ? G.run/runFactor/1.10 : null;
  const run10 = thr => (thr - 8)*10;
  const RD = [['5 km', 5], ['10 km', 10], ['Semi', 21.0975]];
  // nat : CSS ≈ allure tenable ~1500 m (≈ 25–30 min) → 1500 m = 15 × CSS, puis Riegel (b = 1,04 en natation)
  const cssGoal = G.swim ? G.swim/(r.swim/100*1.03) - 4 : null;
  const SD = [['400 m', 400], ['1000 m', 1000], ['2000 m', 2000]];
  const row = (l, a, b) => `<tr><th>${l}</th><td class="num">${fmtHMS(a)}</td><td class="num ${b ? '' : 'muted'}">${b ? fmtHMS(b) : '—'}${b ? ` <span class="${a <= b ? 'ok' : 'bad'}">${a <= b ? '✓' : '+' + fmtHMS(a - b)}</span>` : ''}</td></tr>`;
  const tb = (title, rows) => `<table class="tgoal" style="margin-top:6px"><thead><tr><th>${title}</th><th>Actuel</th><th>Cible</th></tr></thead><tbody>${rows}</tbody></table>`;
  return `<details class="tbench"><summary>Repères par distance</summary>
    ${tb('🏃 Course', RD.map(([l, d]) => row(l, riegel(run10(pr.thr), 10, d), thrGoal ? riegel(run10(thrGoal), 10, d) : null)).join(''))}
    <p class="tiny muted" style="margin:4px 0 8px">Actuel : seuil ${fmtPace(pr.thr)} /km (≈ allure 10 km + 8 s), loi de Riegel. Cible : l'allure seuil qu'il faut pour courir ${G.run ? fmtHMS(G.run) : 'ton objectif'} sur le tracé${thrGoal ? ` = ${fmtPace(thrGoal)} /km` : ''}.</p>
    ${tb('🏊 Nat', SD.map(([l, d]) => row(l, riegel(15*pr.css, 1500, d, 1.04), cssGoal ? riegel(15*cssGoal, 1500, d, 1.04) : null)).join(''))}
    <p class="tiny muted" style="margin:4px 0 0">Actuel : CSS ${fmtPace(pr.css)} /100 m. Cible : la CSS qu'il faut pour nager ${G.swim ? fmtHMS(G.swim) : 'ton objectif'} sur ${r.swim} m${cssGoal ? ` = ${fmtPace(cssGoal)} /100 m` : ''}. Temps en piscine, sans combinaison.</p></details>`;
}
function triGoalsDlg(){
  const G = tri()?.goals || {}, pr = triPredict(), r = tri().race, prof = { bikeProf: r.bikeProf || null, runProf: r.runProf || null };
  const gl = p => p ? `${p.km} km · ${p.up} m D+ ✓` : 'aucun tracé';
  openDlg(`<h2 style="margin:0 0 4px">🎯 Objectifs ${esc(r.name)}</h2><p class="small muted" style="margin:0 0 10px">En gris : la prédiction. Laisse une ligne vide pour ne pas fixer d'objectif.</p>
    <form id="tgF" class="tgin">${TRI_LEGS.map(([k, l]) => { const v = G[k] || 0, ph = Math.round(pr[k]), hasH = k === 'bike' || k === 'run';
      const fld = (u, val, pv, max) => `<label><input type="number" inputmode="numeric" pattern="[0-9]*" min="0" max="${max}" name="${k}_${u}" value="${v ? val : ''}" placeholder="${pv}"><span>${u}</span></label>`;
      return `<div class="tgrow"><span class="tgl">${l}</span>${hasH ? fld('h', Math.floor(v/3600), Math.floor(ph/3600), 12) : '<span></span>'}${fld('min', Math.floor(v % 3600/60), Math.floor(ph % 3600/60), 59)}${fld('s', v % 60, ph % 60, 59)}</div>`; }).join('')}</form>
    <h3 style="margin:14px 0 4px">Tracés GPX</h3><p class="tiny muted" style="margin:0 0 6px">La prédiction suit alors chaque portion du parcours ; distance et D+ de la course sont mis à jour.</p>
    <div class="grid2" style="gap:10px"><label class="btn sm" style="flex-direction:column">🚴 Vélo<input type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml" data-gpx="bikeProf" hidden><span class="tiny muted" id="g_bikeProf">${gl(prof.bikeProf)}</span></label>
      <label class="btn sm" style="flex-direction:column">🏃 Course<input type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml" data-gpx="runProf" hidden><span class="tiny muted" id="g_runProf">${gl(prof.runProf)}</span></label></div>
    <div class="row" style="margin-top:12px"><button class="btn primary" id="tgGo">Enregistrer</button></div>`);
  document.querySelectorAll('[data-gpx]').forEach(inp => inp.onchange = async () => { const f = inp.files[0]; if (!f) return; const p = gpxProfile(await f.text()), k = inp.dataset.gpx;
    $('#g_' + k).textContent = p ? gl(p) : 'fichier illisible'; if (p) prof[k] = p; });
  $('#tgGo').onclick = () => { const E = $('#tgF').elements, goals = {}; for (const [k] of TRI_LEGS) { const n = u => +(E[`${k}_${u}`]?.value || 0), v = n('h')*3600 + n('min')*60 + n('s'); if (v) goals[k] = v; }
    S.tri.goals = goals;
    if (prof.bikeProf) { r.bikeProf = prof.bikeProf; r.bike = prof.bikeProf.km; r.bikeDp = prof.bikeProf.up; }
    if (prof.runProf) { r.runProf = prof.runProf; r.run = prof.runProf.km; r.runDp = prof.runProf.up; }
    save(); closeDlg(); render(); toast('Objectifs et parcours enregistrés'); };
}
document.addEventListener('click', e => { const g = e.target.closest('[data-trigoals]'); if (g) { e.preventDefault(); triGoalsDlg(); } });
function triStepsHTML(x, W){
  if (x.sport === 'race') return '';
  return `<div class="tsteps">${W.steps.map(s => {
    const z = x.sport === 'swim' ? SW_Z[s.z] : RN_Z[s.z];
    const pace = x.sport === 'swim' ? `${fmtPace(swPace(s.z))} /100 m` : rnPace(s.z) ? `${fmtPace(rnPace(s.z))} /km` : 'effort seuil (FC)';
    const qty = x.sport === 'swim' ? `${s.n > 1 ? s.n + ' × ' : ''}${s.d} m` : `${s.n > 1 ? s.n + ' × ' : ''}${s.d >= 60 ? fmtDur(s.d) : s.d + ' s'}`;
    return `<div class="tstep z-${s.z}"><div style="flex:1;min-width:0"><b class="num">${qty}</b> ${esc(s.l)}${s.r ? ` <span class="tiny muted">· récup ${s.r >= 60 ? fmtDur(s.r) : s.r + "''"}</span>` : ''}</div><span class="tiny num" style="white-space:nowrap">${esc(z.l)} · ${pace}</span></div>`; }).join('')}</div>`;
}
function triDlg(id){
  const x = (S.triPlan || []).find(y => y.id === id); if (!x) return;
  const W = triWorkout(x), E = triEst(x, W), stt = triStatus(x), done = triDone(x);
  const daysLeft = diffDays(todayISO(), tri().race.date);
  openDlg(`<span class="muted small">${fmtDate(x.date)} · Sem. ${x.week + 1} · ${esc(x.block)}${x.kind === 'optional' ? ' · optionnelle' : ''}</span>
    <h2 style="margin:6px 0">${TRI_IC[x.sport]} ${esc(W.name)}</h2><p class="muted small">${esc(W.goal)}</p>
    ${x.sport === 'race' ? `<div class="note ok">${daysLeft > 0 ? `J-${daysLeft}` : daysLeft === 0 ? "C'est aujourd'hui !" : 'Course passée'} · ${esc(T_raceLine())}</div>`
      : `<div class="grid3" style="margin:8px 0"><div class="kpi"><div class="v num" style="font-size:22px">${fmtDur(E.sec)}</div><div class="l">Durée estimée</div></div><div class="kpi"><div class="v num" style="font-size:22px">${x.sport === 'swim' ? E.m + ' m' : '~' + (E.m/1000).toFixed(1).replace('.', ',') + ' km'}</div><div class="l">Distance</div></div><div class="kpi"><div class="v num" style="font-size:22px">${x.sport === 'swim' ? fmtPace(tri().css) : fmtPace(tri().runThr)}</div><div class="l">${x.sport === 'swim' ? 'CSS /100 m' : 'Seuil /km'}</div></div></div>`}
    ${adaptHTML('t', x)}
    ${triStepsHTML(x, W)}
    ${stt === 'done' ? `<div class="note ok" style="margin-top:10px">✅ Faite : ${esc(done.w.type)} · ${fmtDur(done.w.duration_min*60)}${done.w.distance_km ? ` · ${x.sport === 'swim' ? Math.round(done.w.distance_km*1000) + ' m' : (+done.w.distance_km).toFixed(1).replace('.', ',') + ' km'}` : ''}</div>` : stt === 'missed' ? `<div class="note warn" style="margin-top:10px">Pas de séance de ${x.sport === 'swim' ? 'nat' : 'course'} trouvée ce jour-là.</div>` : ''}
    ${x.sport !== 'race' ? `<div class="row" style="margin-top:12px;flex-wrap:wrap">
      <button class="btn" data-swap="t:${x.id}">🔄 ${x.swap ? 'Modifier le remplacement' : 'Changer de séance'}</button>
      ${done ? `<button class="btn" data-ssess="w:${esc(done.w.start_at)}">Voir la séance faite</button>` : ''}
      <label class="small" style="display:flex;gap:6px;align-items:center">Déplacer au <input type="date" id="triMove" value="${x.date}" style="width:auto"></label>
      ${x.swap ? '' : `<button class="btn ghost sm" id="triSkip">${x.status === 'skipped' ? 'Rétablir' : 'Sauter'}</button>`}</div>` : ''}
    <p class="tiny muted" style="margin-top:10px">Allures calculées sur ta CSS (${fmtPace(tri().css)} /100 m) et ton seuil course (${fmtPace(tri().runThr)} /km) · <a href="#" id="triEdit">modifier</a></p>`);
  $('#triEdit').onclick = e => { e.preventDefault(); triSetupDlg(); };
  if ($('#triSkip')) $('#triSkip').onclick = () => { x.status = x.status === 'skipped' ? 'planned' : 'skipped'; save(); render(); triDlg(id); };
  if ($('#triMove')) $('#triMove').onchange = e => { const d = e.target.value; if (!d) return; x.date = d; S.triPlan.sort((a, b) => a.date.localeCompare(b.date)); save(); render(); toast(`Séance déplacée au ${fmtDate(d)}`); triDlg(id); };
}
document.addEventListener('click', e => { const r = e.target.closest('[data-tri]'); if (r) triDlg(r.dataset.tri); const s = e.target.closest('[data-trisetup]'); if (s) triSetupDlg(); });
/* ===== ADAPTATION : « j'ai fait autre chose », recaser, alléger (v0.23) ===== */
// une séance prévue (vélo 'b' ou nat/course 't') peut être remplacée par ce qui a vraiment été fait (ou sera fait) :
// x.swap = { sp, min, rpe, tss, l, ref, note } ; la séance prévue passe en 'skipped' sauf si l'activité choisie lui est déjà rattachée
const qsa = sel => [...document.querySelectorAll(sel)];
const SWAP_SP = { bike_out:{ ic:'🚴', l:'Vélo dehors' }, bike_in:{ ic:'🏠', l:'Home trainer libre' }, run:{ ic:'🏃', l:'Course' }, swim:{ ic:'🏊', l:'Natation' }, strength:{ ic:'🏋️', l:'Renfo' }, mobility:{ ic:'🧘', l:'Mobilité / yoga' }, other:{ ic:'⏱️', l:'Autre sport' }, rest:{ ic:'😴', l:'Repos' } };
const SWAP_IF = { bike_out:0.7, bike_in:0.72, run:0.78, swim:0.72, strength:0.6, mobility:0.4, other:0.65, rest:0 };
// charge estimée : TSS mesuré si l'activité vient d'un import, sinon durée × IF² (IF tiré du RPE quand il est donné)
const swapTSS = sw => sw.sp === 'rest' ? 0 : sw.tss != null ? sw.tss : Math.round((sw.min || 0)/60 * Math.pow(sw.rpe ? Math.min(0.95, 0.5 + sw.rpe*0.04) : (SWAP_IF[sw.sp] || 0.6), 2) * 100);
const pItem = (k, id) => k === 't' ? (S.triPlan || []).find(x => x.id === id) : S.plan.find(x => x.id === id);
const triHard = x => ['qual', 'long'].includes(x.wid) && x.ph !== 'recov' && x.ph !== 'taper';
function pInfo(k, x){
  if (k === 't') { const W = triWorkout(x), E = triEst(x, W), hard = triHard(x);
    return { sport: x.sport, ic: TRI_IC[x.sport], name: W.name, sec: E.sec, tss: Math.round(E.sec/3600 * Math.pow(hard ? 0.82 : 0.7, 2) * 100), hard, key: x.kind === 'key' }; }
  const W = WORKOUTS[x.workoutId];
  return { sport:'bike', ic:'🚴', name: W.name, sec: wDur(x.workoutId), tss: wTSS(x.workoutId), hard: isHard(x.workoutId), key: mandatory(x), type: W.type };
}
const swapSpOf = (sport, indoor) => sport === 'bike' ? (indoor ? 'bike_in' : 'bike_out') : sport === 'walk' ? 'other' : SWAP_SP[sport] ? sport : 'other';
// ce qui a été enregistré un jour donné (activités vélo de l'app + séances Apple Santé / Intervals)
function dayDone(date){
  const out = S.activities.filter(a => a.date === date).map(a => ({ sp: isIndoor(a) ? 'bike_in' : 'bike_out', min: Math.round((a.durationS || 0)/60), tss: a.tss ?? null, l: a.name, ref: 'a:' + a.id }));
  for (const e of Health.extraWorkouts()) if (e.date === date) out.push({ sp: swapSpOf(e.sport, e.sport === 'bike' && Health.bikeIndoor(e.w)), min: Math.round(+e.w.duration_min || 0), tss: e.tss ?? null, l: e.w.type || 'Séance', ref: 'w:' + e.w.start_at });
  return out.filter(o => o.min >= 10);
}
const swapRefs = () => new Set([...S.plan, ...(S.triPlan || [])].map(x => x.swap?.ref).filter(Boolean));
function applySwap(k, x, sw){
  sw = { ...sw }; sw.tss = swapTSS(sw);
  const keep = k === 'b' && x.activityId && sw.ref === 'a:' + x.activityId; // l'activité déjà rattachée : on ne fait que renommer
  if (k === 'b' && x.activityId && !keep) { const a = S.activities.find(y => y.id === x.activityId); if (a) { a.planId = null; a.linkManual = true; } x.activityId = null; }
  if (!keep) { sw.prev = x.status; x.status = 'skipped'; }
  x.swap = sw;
}
function undoSwap(k, x){ if (x.status === 'skipped' && x.swap?.prev !== 'skipped') x.status = 'planned'; delete x.swap; }
// séances (vélo + nat/course) encore au programme un jour donné
const dayLoad = (date, except) => [...S.plan.filter(s => s.date === date && s.status !== 'skipped' && s.id !== except).map(s => ({ k:'b', x:s, i:pInfo('b', s) })),
  ...(triOn() ? (S.triPlan || []).filter(x => x.date === date && x.status !== 'skipped' && x.id !== except && x.sport !== 'race').map(x => ({ k:'t', x, i:pInfo('t', x) })) : [])];
// créneau pour recaser une séance clé : ≤ 3 jours, pas d'absence, pas le même sport le même jour, 2 séances max par jour, 48 h entre deux séances dures
function findSlot(k, x){
  const info = pInfo(k, x), t = todayISO(), end = k === 't' ? tri().race.date : S.profile.endDate;
  const base = x.date < t ? t : addDays(x.date, 1);
  for (let j = 0; j <= 3; j++) {
    const d = addDays(base, j); if (d > end || diffDays(x.date, d) > 4) break;
    if ((S.profile.absences || []).some(a => d >= a.from && d <= a.to)) continue;
    if (k === 't' && d === tri().race.date) continue;
    const L = dayLoad(d, x.id);
    if (L.length >= 2 || L.some(o => o.i.sport === info.sport && o.i.key)) continue;
    if (k === 'b' && S.profile.days?.[parseD(d).getDay()]?.avail === false && L.length) continue;
    if (info.hard && [-1, 0, 1].some(o => dayLoad(addDays(d, o), x.id).some(y => y.i.hard))) continue;
    return d;
  }
  return null;
}
function weekLoadHTML(date){
  const w0 = monday(date), w1 = addDays(w0, 6), inW = d => d >= w0 && d <= w1, t = todayISO();
  const all = [...S.plan.filter(s => inW(s.date)).map(s => ['b', s]), ...(triOn() ? (S.triPlan || []).filter(x => inW(x.date) && x.sport !== 'race').map(x => ['t', x]) : [])];
  let plan = 0, real = 0;
  for (const [k, x] of all) {
    if (x.status === 'skipped' && !x.swap) continue;
    const i = pInfo(k, x); plan += i.tss;
    if (x.swap) real += swapTSS(x.swap);
    else if (k === 'b' && x.status === 'done') real += S.activities.find(a => a.id === x.activityId)?.tss ?? i.tss;
    else if (k === 't' && triStatus(x) === 'done') real += triDone(x)?.tss ?? i.tss;
  }
  if (!plan) return '';
  const past = all.filter(([, x]) => x.date <= t).reduce((a, [k, x]) => a + (x.status === 'skipped' && !x.swap ? 0 : pInfo(k, x).tss), 0);
  const r = past ? real/past : 1;
  return `<p class="tiny muted" style="margin:8px 0 0">Charge de la semaine : ≈ ${real} TSS faits sur ${past} prévus à ce jour (${plan} sur la semaine)${past ? ` · ${r >= 0.85 && r <= 1.15 ? 'dans les clous' : r < 0.85 ? 'en dessous' : 'au-dessus'}` : ''}.</p>`;
}
// bloc « Adapter » affiché dans la fiche d'une séance remplacée ou manquée
function adaptHTML(k, x){
  if (k === 't' && x.sport === 'race') return '';
  const t = todayISO(), info = pInfo(k, x), sw = x.swap;
  const missed = !sw && x.date < t && (k === 't' ? triStatus(x) === 'missed' : x.status === 'planned');
  if (!sw && !missed) return '';
  const recased = [...S.plan, ...(S.triPlan || [])].find(y => y.recasedFrom === x.id);
  const msgs = [], btns = [];
  let covered = false;
  if (sw) {
    const st = swapTSS(sw), same = info.sport === 'bike' ? sw.sp.startsWith('bike') : sw.sp === info.sport;
    covered = same && st >= info.tss*0.7 && !(info.hard && sw.sp === 'bike_out' && info.type !== 'end');
    if (sw.sp === 'rest') msgs.push(['warn', `Repos à la place de « ${info.name} ».${info.key ? ' Séance clé : à recaser si un créneau propre existe, sinon on passe.' : ' Séance secondaire : rien à rattraper.'}`]);
    else if (covered) msgs.push(['ok', `Bien remplacée : même sport, charge comparable (≈ ${st} TSS contre ${info.tss} prévus). Rien à rattraper.`]);
    else if (same && info.hard) msgs.push(['warn', `Le volume est là (≈ ${st} TSS), mais pas le travail d'intensité de « ${info.name} ».${info.key ? ' Tu peux le recaser si la semaine le permet.' : ''}`]);
    else msgs.push(['warn', `${SWAP_SP[sw.sp].l} (≈ ${st} TSS) ne remplace pas « ${info.name} » : ${same ? 'charge bien plus faible' : 'autre sport'}.${info.key ? ' Séance clé : à recaser si possible.' : ' Séance secondaire : rien à rattraper.'}`]);
    // grosse substitution : alléger la prochaine séance dure dans les 48 h
    if (st > info.tss*1.3 + 15) {
      const nx = [1, 2].flatMap(o => dayLoad(addDays(x.date, o))).find(o => o.i.hard && o.x.status === 'planned');
      if (nx) { const ez = nx.k === 'b' ? neighbor(nx.x.workoutId, -1) : null;
        msgs.push(['warn', `Charge plus forte que prévu : ${nx.i.ic} ${nx.i.name} arrive le ${fmtDate(nx.x.date)}.${ez ? '' : ' Écoute les jambes à l\'échauffement, quitte à passer en version souple.'}`]);
        if (ez) btns.push(`<button class="btn sm" data-sx="easier" data-sid="${nx.x.id}">⬇ Alléger : ${esc(WORKOUTS[ez].name)} le ${fmtShort(nx.x.date)}</button>`); }
    }
  } else msgs.push(['warn', `« ${info.name} » n'a pas été faite${info.key ? '' : ' (séance secondaire, rien à rattraper)'}.`]);
  if (!covered && info.key && !recased && x.date >= addDays(t, -3)) {
    const d = findSlot(k, x);
    if (d) btns.push(`<button class="btn sm primary" data-recase="${k}:${x.id}:${d}">↪ Recaser ${DOW[dowMon(d)].toLowerCase()} ${fmtShort(d)}</button>`);
    else msgs.push(['', `Pas de créneau propre dans les 3 jours (48 h entre deux séances dures, 2 séances max par jour) : on la laisse tomber, ne l'empile pas.`]);
  }
  if (recased) msgs.push(['ok', `Recasée le ${fmtDate(recased.date)}.`]);
  if (missed) btns.push(`<button class="btn sm" data-swap="${k}:${x.id}">🔄 J'ai fait autre chose</button><button class="btn sm ghost" data-drop="${k}:${x.id}">Laisser tomber</button>`);
  return `<div class="adapt">${msgs.map(([c, m]) => `<div class="note ${c}" style="margin:0 0 6px">${esc(m)}</div>`).join('')}${btns.length ? `<div class="row" style="gap:6px;flex-wrap:wrap">${btns.join('')}</div>` : ''}${weekLoadHTML(x.date)}</div>`;
}
const reopen = (k, id) => k === 't' ? triDlg(id) : sessionDlg(id);
function swapDlg(k, id){
  const x = pItem(k, id); if (!x) return;
  const info = pInfo(k, x), past = x.date <= todayISO(), sw0 = x.swap || {};
  const refs = swapRefs(); const det = dayDone(x.date).filter(o => !refs.has(o.ref) || o.ref === sw0.ref);
  let cur = { sp: sw0.sp || (k === 't' ? x.sport : 'bike_out'), min: sw0.min || Math.round(info.sec/60), rpe: sw0.rpe || '', note: sw0.note || '', ref: sw0.ref || null, tss: sw0.ref ? sw0.tss : null, l: sw0.l || null };
  const opts = k === 'b' ? Object.entries(WORKOUTS).map(([w, W]) => `<option value="${w}" ${w === x.workoutId ? 'selected' : ''}>${esc(W.name)} · ${fmtDur(wDur(w))}</option>`).join('') : '';
  openDlg(`<span class="muted small">${fmtDate(x.date)} · prévu : ${info.ic} ${esc(info.name)}</span>
    <h2 style="margin:6px 0">Changer de séance</h2>
    <p class="muted small" style="margin:0 0 10px">${past ? "Qu'as-tu fait à la place ?" : 'Que vas-tu faire à la place ?'} Le programme s'adapte ensuite (recaser, alléger la suite).</p>
    ${det.length ? `<div class="small muted" style="margin-bottom:4px">Enregistré ce jour-là</div><div class="seg" id="swDet" style="margin-bottom:10px">${det.map((o, i) => `<button type="button" data-i="${i}" class="${o.ref === cur.ref ? 'on' : ''}">${SWAP_SP[o.sp].ic} ${esc(o.l)} · ${fmtDur(o.min*60)}</button>`).join('')}</div>` : ''}
    <div class="small muted" style="margin-bottom:4px">${det.length ? 'Ou à la main' : 'Activité'}</div>
    <div class="seg" id="swSp">${Object.entries(SWAP_SP).map(([s, o]) => `<button type="button" data-v="${s}" class="${s === cur.sp && !cur.ref ? 'on' : ''}">${o.ic} ${o.l}</button>`).join('')}</div>
    <div id="swF"><div class="grid2" style="margin-top:6px"><div><label class="f">Durée (min)</label><input type="number" id="swMin" min="5" max="600" inputmode="numeric" value="${cur.min}"></div>
    <div><label class="f">Ressenti (RPE 1–10)</label><input type="number" id="swRpe" min="1" max="10" inputmode="numeric" value="${cur.rpe}" placeholder="optionnel"></div></div>
    <label class="f">Note</label><input id="swNote" value="${esc(cur.note)}" placeholder="ex. sortie longue dehors, circuit gainage…"></div>
    <div class="row" style="margin-top:14px;gap:6px"><button class="btn primary" id="swOk">Valider</button>${x.swap ? `<button class="btn ghost" id="swUndo">Revenir à « ${esc(info.name)} »</button>` : ''}</div>
    ${k === 'b' ? `<details class="more" style="margin-top:14px"><summary>Ou une autre séance home trainer du programme</summary><div class="row" style="margin-top:8px"><select id="swW" style="flex:1">${opts}</select><button class="btn" id="swWOk">Remplacer</button></div></details>` : ''}`);
  const sync = () => { $('#swF').style.display = cur.sp === 'rest' ? 'none' : ''; qsa('#swSp button').forEach(b => b.classList.toggle('on', !cur.ref && b.dataset.v === cur.sp)); qsa('#swDet button').forEach(b => b.classList.toggle('on', det[+b.dataset.i].ref === cur.ref)); };
  qsa('#swSp button').forEach(b => b.onclick = () => { cur = { ...cur, sp: b.dataset.v, ref: null, tss: null, l: null }; sync(); });
  qsa('#swDet button').forEach(b => b.onclick = () => { const o = det[+b.dataset.i]; cur = { ...cur, ...o }; $('#swMin').value = o.min; sync(); });
  sync();
  $('#swOk').onclick = () => {
    const min = +$('#swMin').value || 0, rpe = Math.min(10, Math.max(0, +$('#swRpe').value || 0)) || null;
    if (cur.sp !== 'rest' && min < 5) { toast('Indique une durée'); return; }
    if (cur.ref && min !== cur.min) { cur.tss = null; } // durée corrigée à la main : charge réestimée
    applySwap(k, x, { sp: cur.sp, min: cur.sp === 'rest' ? 0 : min, rpe, note: $('#swNote').value.trim() || null, ref: cur.ref, tss: cur.ref ? cur.tss : null, l: cur.ref ? cur.l : null });
    save(); render(); toast(cur.sp === 'rest' ? 'Noté : repos' : `Remplacée par : ${SWAP_SP[cur.sp].l}`); reopen(k, id);
  };
  if ($('#swUndo')) $('#swUndo').onclick = () => { undoSwap(k, x); save(); render(); toast('Séance prévue rétablie'); reopen(k, id); };
  if ($('#swWOk')) $('#swWOk').onclick = () => { if (x.swap) undoSwap(k, x); x.origWorkoutId ||= x.workoutId; x.workoutId = $('#swW').value; delete x.adj; save(); render(); toast(`Séance remplacée : ${WORKOUTS[x.workoutId].name}`); sessionDlg(id); };
}
function recase(k, id, d){
  const x = pItem(k, id); if (!x) return;
  if (x.swap || x.date < todayISO() || x.status !== 'planned') { // la trace d'origine reste ; une copie part sur le nouveau créneau
    const c = { ...x, id: uid(), date: d, status: 'planned', recasedFrom: x.id }; delete c.swap; delete c.activityId; delete c.adj;
    c.week = Math.floor(diffDays(monday(S.profile.startDate), d)/7);
    if (k === 't') { S.triPlan.push(c); S.triPlan.sort((a, b) => a.date.localeCompare(b.date)); if (!x.swap) x.status = 'skipped'; }
    else { S.plan.push(c); S.plan.sort((a, b) => a.date.localeCompare(b.date)); if (!x.swap) x.status = 'skipped'; }
  } else { x.date = d; (k === 't' ? S.triPlan : S.plan).sort((a, b) => a.date.localeCompare(b.date)); }
  save(); render(); toast(`Recasée ${DOW[dowMon(d)].toLowerCase()} ${fmtDate(d)}`); reopen(k, id);
}
document.addEventListener('click', e => {
  const sw = e.target.closest('[data-swap]'), rc = e.target.closest('[data-recase]'), dr = e.target.closest('[data-drop]');
  if (sw) { e.stopPropagation(); const [k, id] = sw.dataset.swap.split(':'); swapDlg(k, id); }
  else if (rc) { e.stopPropagation(); const [k, id, d] = rc.dataset.recase.split(':'); recase(k, id, d); }
  else if (dr) { e.stopPropagation(); const [k, id] = dr.dataset.drop.split(':'); const x = pItem(k, id); if (x) { x.status = 'skipped'; save(); render(); toast('Séance laissée de côté'); reopen(k, id); } }
}, true);
// ligne du programme pour une séance remplacée
function swapRowHTML(k, x){
  const sw = x.swap, o = SWAP_SP[sw.sp], info = pInfo(k, x), t = todayISO();
  const name = sw.sp === 'rest' ? 'Repos' : sw.note || sw.l || o.l;
  const meta = `${sw.sp === 'rest' ? '' : `${fmtDur(sw.min*60)} · ≈ TSS ${swapTSS(sw)} · `}au lieu de ${info.ic} ${esc(info.name)}`;
  return `<div class="sess swapped ${x.date === t ? 'today' : ''}" ${k === 't' ? `data-tri="${x.id}"` : `data-open="${x.id}"`}>
    <div class="d"><span>${DOW[dowMon(x.date)]}</span><b class="num">${parseD(x.date).getDate()}</b></div>
    <div class="m"><b>${o.ic} ${esc(name)}</b><span class="tiny muted">${meta}</span></div>
    <div class="st">${x.status === 'done' ? '✅' : sw.sp === 'rest' ? '😴' : '🔄'}</div></div>`;
}
/* ===== /ADAPTATION ===== */
/* ===== PHASES DU PROGRAMME + BILAN DE LA SEMAINE EN STORY (v0.24) ===== */
// macro-cycle : chaque semaine de weekKinds() rangée dans une grande phase (les semaines allégées restent dans leur bloc)
const PHASE_INFO = {
  calib:{ l:'Calibration', c:'var(--z1)', d:"Test pour fixer ta FTP et tes zones ; tout le plan est calé dessus." },
  base:{ l:'Base', c:'var(--z2)', d:"Sweet spot (88–94 % FTP) et force en cadence basse : beaucoup de temps près du seuil pour une fatigue modérée. On élargit le moteur aérobie." },
  build1:{ l:'Build 1', c:'var(--z3)', d:"Du sweet spot vers le seuil (95–105 %) : intervalles plus longs et plus durs. C'est la phase où la FTP monte le plus." },
  build2:{ l:'Build 2', c:'var(--z4)', d:"Seuil + VO2max (106–120 %) : on relève le plafond aérobie pour que le seuil puisse encore grimper." },
  peak:{ l:'Peak', c:'var(--z5)', d:"VO2max et séances spécifiques : volume stable, intensité haute, on aiguise avant l'objectif." },
  spec:{ l:'Spécifique', c:'var(--z5)', d:"Force en cadence basse, seuil long et tempo en côte : on prépare les cols de la course A." },
  taper:{ l:'Affûtage', c:'var(--z6)', d:"Volume réduit d'environ 40 %, intensité conservée : la fatigue tombe, la forme monte." },
  final:{ l:'Objectif', c:'var(--accent)', d:"Test final ou course : on récolte." },
  bonus:{ l:'Consolidation', c:'var(--z1)', d:"Après l'objectif : maintien du seuil et du VO2max." },
};
function phaseOf(k, prev){
  if (k.kind === 'calib') return 'calib';
  if (k.kind === 'taper') return 'taper';
  if (k.kind === 'final') return 'final';
  if (k.kind === 'bonus') return 'bonus';
  if (k.kind === 'load') return [ 'base', 'build1', 'build2', triOn() ? 'spec' : 'peak' ][k.bi ?? 0];
  return prev || 'base'; // semaine allégée / fêtes : dans le bloc en cours
}
function phases(){
  if (!S.profile) return null;
  const ks = weekKinds(S.profile); let prev = null;
  const weeks = ks.map(k => { const ph = phaseOf(k, prev); prev = ph; return { ...k, ph }; });
  const segs = []; for (const w of weeks) { const l = segs[segs.length - 1]; if (l && l.ph === w.ph) l.weeks.push(w); else segs.push({ ph: w.ph, weeks: [w] }); }
  const t = todayISO(), cur = weeks.find(w => t >= w.ws && t <= addDays(w.ws, 6)) || (t < weeks[0].ws ? weeks[0] : weeks[weeks.length - 1]);
  return { weeks, segs, cur, seg: segs.find(s => s.weeks.includes(cur)) };
}
const weekRole = w => w.kind === 'recovery' ? (w.test ? 'Semaine allégée + retest FTP' : 'Semaine allégée : la progression se fait pendant la récup') : w.kind === 'holiday' ? 'Semaine des fêtes : maintien' : w.kind === 'load' ? `Semaine de charge ${(w.pos ?? 0) + 1}/3` : '';
function phaseHTML(compact){
  const P = phases(); if (!P) return '';
  const { weeks, segs, cur, seg } = P, n = weeks.length, I = PHASE_INFO[cur.ph];
  const iw = seg.weeks.indexOf(cur) + 1, nxt = segs[segs.indexOf(seg) + 1];
  const bar = segs.map(s => `<div class="ph-seg ${s === seg ? 'on' : ''}" style="flex:${s.weeks.length};background:${PHASE_INFO[s.ph].c}" title="${esc(PHASE_INFO[s.ph].l)} · ${s.weeks.length} sem."><span>${s.weeks.length >= 3 ? esc(PHASE_INFO[s.ph].l) : ''}</span></div>`).join('');
  const pos = (cur.i + 0.5)/n*100;
  return `<div class="card phase"><div class="row between"><h2>Où j'en suis</h2><span class="tiny muted num">Sem. ${cur.i + 1}/${n}</span></div>
    <div class="ph-bar">${bar}<i class="ph-you" style="left:${pos}%"></i></div>
    <div class="ph-now"><b style="color:${I.c}">${esc(I.l)}</b> · semaine ${iw}/${seg.weeks.length} du bloc${weekRole(cur) ? ` · ${esc(weekRole(cur))}` : ''}</div>
    ${compact ? '' : `<p class="small" style="margin:6px 0 0">${esc(I.d)}</p>`}
    ${nxt ? `<p class="tiny muted" style="margin:6px 0 0">Ensuite : <b>${esc(PHASE_INFO[nxt.ph].l)}</b> dans ${seg.weeks.length - iw + 1} sem. (${fmtShort(nxt.weeks[0].ws)})</p>` : ''}
    ${compact ? '' : `<span class="tiny ph-why" role="button" tabindex="0" data-i="periodisation">Quelle méthode ? ›</span>`}</div>`;
}
// ---- bilan de la semaine ----
function weekReview(w0){
  const w1 = addDays(w0, 6), t = todayISO(), inW = d => d >= w0 && d <= w1;
  const P = phases(), wk = P?.weeks.find(w => w.ws === w0);
  const L = loadSeries(), at = d => { let r = null; for (const x of L) { if (x.d <= d) r = x; else break; } return r; };
  const end = w1 < t ? w1 : t, a0 = at(addDays(w0, -1)), a1 = at(end);
  const real = L.filter(x => inW(x.d)).reduce((a, x) => a + x.tss, 0);
  const items = [...S.plan.filter(s => inW(s.date)).map(s => ['b', s]), ...(triOn() ? (S.triPlan || []).filter(x => inW(x.date) && x.sport !== 'race').map(x => ['t', x]) : [])];
  const mand = items.filter(([k, x]) => k === 't' ? x.kind === 'key' : mandatory(x));
  const planned = mand.reduce((a, [k, x]) => a + pInfo(k, x).tss, 0);
  const st = ([k, x]) => x.swap ? (x.swap.sp === 'rest' ? 'rest' : 'swap') : k === 't' ? triStatus(x) : x.status === 'done' ? 'done' : x.status === 'skipped' ? 'skipped' : x.date < t ? 'missed' : 'planned';
  const keys = mand.filter(([k, x]) => pInfo(k, x).hard || (k === 'b' && WORKOUTS[x.workoutId].type === 'test'));
  const keyDone = keys.filter(i => st(i) === 'done').length;
  // par sport (tout ce qui a été fait, prévu ou non)
  const bySp = {}; const addSp = (sp, min) => { bySp[sp] = (bySp[sp] || 0) + min; };
  for (const a of S.activities) if (inW(a.date)) addSp('bike', (a.durationS || 0)/60);
  for (const e of Health.extraWorkouts()) if (inW(e.date)) addSp(e.sport === 'walk' ? 'other' : e.sport, +e.w.duration_min || 0);
  const nSess = S.activities.filter(a => inW(a.date) && (a.durationS || 0) >= 600).length + Health.extraWorkouts().filter(e => inW(e.date) && (+e.w.duration_min || 0) >= 10).length;
  const ramp = a0 && a1 ? a1.ctl - a0.ctl : null, tsb = a1 ? a1.ctl - a1.atl : null, comp = planned ? real/planned : null;
  // verdict : charge faite / prévue, montée de fitness (CTL / semaine), fraîcheur en fin de semaine
  const easy = wk && ['recovery', 'taper', 'holiday', 'final'].includes(wk.kind);
  let v = 'ok', why = [];
  if (easy) {
    if (comp != null && comp > 1.25) { v = 'over'; why.push(`tu as fait ${Math.round(comp*100)} % de la charge d'une semaine censée être allégée`); }
    else why.push('semaine allégée respectée : la fatigue redescend, c\'est là que tu progresses');
  } else {
    if ((ramp != null && ramp > 8) || (tsb != null && tsb < -30) || (comp != null && comp > 1.3)) { v = 'over'; }
    else if ((comp != null && comp < 0.75) || (ramp != null && ramp < 1 && comp != null && comp < 0.9)) { v = 'under'; }
    if (comp != null) why.push(`${Math.round(comp*100)} % de la charge prévue`);
    if (ramp != null) why.push(`fitness ${ramp >= 0 ? '+' : '−'}${Math.abs(ramp).toFixed(1).replace('.', ',')} CTL (cible +3 à +7 en semaine de charge)`);
    if (tsb != null && tsb < -30) why.push(`forme à ${Math.round(tsb)} : fatigue élevée`);
  }
  if (keys.length) why.push(`${keyDone}/${keys.length} séance${keys.length > 1 ? 's' : ''} clé${keys.length > 1 ? 's' : ''} faite${keyDone > 1 ? 's' : ''}`);
  // FTP : trajectoire linéaire départ → objectif
  const p = S.profile, f0 = S.ftpHistory[0]?.ftp || p.ftp, d0 = S.ftpHistory[0]?.date || p.startDate;
  const exp = Math.round(f0 + (p.goalFtp - f0) * clamp(diffDays(d0, end)/Math.max(1, diffDays(d0, p.goalDate)), 0, 1));
  return { w0, w1, wk, real: Math.round(real), planned, comp, ramp, tsb, ctl: a1?.ctl, keys, keyDone, items, st, bySp, nSess, v, why, ftpNow: ftp(), ftpExp: exp };
}
function nextKeys(w0){
  const w1 = addDays(w0, 6), inW = d => d >= w0 && d <= w1;
  const c = [...S.plan.filter(s => inW(s.date) && mandatory(s) && s.status === 'planned').map(s => ({ k:'b', x:s })),
    ...(triOn() ? (S.triPlan || []).filter(x => inW(x.date) && x.status !== 'skipped' && x.kind !== 'optional' && x.sport !== 'race').map(x => ({ k:'t', x })) : [])];
  const score = ({ k, x }) => k === 'b' && WORKOUTS[x.workoutId].type === 'test' ? 0 : pInfo(k, x).hard ? (k === 'b' ? 1 : 2) : 5;
  const pick = c.sort((a, b) => score(a) - score(b) || a.x.date.localeCompare(b.x.date)).slice(0, 3).sort((a, b) => a.x.date.localeCompare(b.x.date));
  return pick.map(({ k, x }) => { const i = pInfo(k, x), W = k === 't' ? triWorkout(x) : WORKOUTS[x.workoutId];
    return { k, x, i, goal: W.goal, meta: k === 'b' ? `${fmtDur(i.sec)} · TSS ${i.tss}${mainStep(x.workoutId) ? ` · ${watts(mainStep(x.workoutId).p, ftp(), sAdj(x))} W` : ''}` : `${fmtDur(i.sec)} · ${x.sport === 'swim' ? triEst(x).m + ' m' : '~' + (triEst(x).m/1000).toFixed(1).replace('.', ',') + ' km'}` }; });
}
const SP_L = { bike:['🚴','Vélo'], run:['🏃','Course'], swim:['🏊','Nat'], strength:['🏋️','Renfo'], mobility:['🧘','Mobilité'], other:['⏱️','Autre'] };
const ST_IC = { done:'✅', swap:'🔄', rest:'😴', skipped:'⏭️', missed:'😞', planned:'·', swapped:'🔄' };
function storySlides(w0){
  const R = weekReview(w0), P = phases(), nw0 = addDays(w0, 7), nwk = P?.weeks.find(w => w.ws === nw0), NK = nextKeys(nw0);
  const ph = R.wk ? PHASE_INFO[R.wk.ph] : null, totH = Object.values(R.bySp).reduce((a, m) => a + m, 0)/60;
  const V = { ok:{ t:'On track', e:'🎯', c:'var(--ok)', s:'Charge dans les clous : continue comme ça.' }, over:{ t:'Tu charges trop', e:'🔥', c:'var(--bad)', s:'Lève le pied en début de semaine prochaine : la fatigue doit retomber avant la prochaine séance clé.' }, under:{ t:'Pas assez', e:'🪫', c:'var(--warn)', s:'Moins de charge que prévu. Pas de rattrapage en bloc : fais les séances clés de la semaine prochaine, c\'est ce qui compte.' } }[R.v];
  const sps = Object.entries(R.bySp).filter(([, m]) => m >= 5).sort((a, b) => b[1] - a[1]);
  const maxM = Math.max(1, ...sps.map(([, m]) => m));
  const s1 = `<div class="sty-k">Semaine ${R.wk ? R.wk.i + 1 : ''} · ${fmtShort(R.w0)} → ${fmtShort(R.w1)}</div>
    <div class="sty-big">${String(totH.toFixed(1)).replace('.', ',')}<small> h</small></div><div class="sty-sub">${R.nSess} séance${R.nSess > 1 ? 's' : ''} · ≈ ${R.real} TSS</div>
    ${ph ? `<div class="sty-pill" style="background:${ph.c}">${esc(ph.l)}${R.wk.kind !== 'load' && weekRole(R.wk) ? ' · allégée' : ''}</div>` : ''}
    <div class="sty-bars">${sps.map(([sp, m]) => `<div class="sty-row"><span>${SP_L[sp]?.[0] || '⏱️'} ${SP_L[sp]?.[1] || sp}</span><i style="width:${Math.round(m/maxM*100)}%"></i><b class="num">${fmtDur(m*60)}</b></div>`).join('') || '<p>Aucune séance enregistrée.</p>'}</div>`;
  const list = R.items.filter(([k, x]) => k === 't' ? x.kind === 'key' || x.swap : mandatory(x) || x.status === 'done').sort((a, b) => a[1].date.localeCompare(b[1].date));
  const s2 = `<div class="sty-k">Le programme</div><div class="sty-h">${R.items.filter(i => ['done','swap'].includes(R.st(i))).length}/${list.length} séances</div>
    <div class="sty-list">${list.map(i => { const [k, x] = i, inf = pInfo(k, x), s = R.st(i);
      return `<div class="sty-li ${s}"><span class="num">${DOW[dowMon(x.date)]}</span><span>${x.swap ? `${SWAP_SP[x.swap.sp].ic} ${esc(x.swap.note || x.swap.l || SWAP_SP[x.swap.sp].l)}<small> au lieu de ${esc(inf.name)}</small>` : `${inf.ic} ${esc(inf.name)}`}</span><b>${ST_IC[s] || ''}</b></div>`; }).join('')}</div>`;
  const s3 = `<div class="sty-k">Bilan</div><div class="sty-verdict" style="color:${V.c}">${V.e}<br>${V.t}</div>
    <div class="sty-kpis"><div><b class="num">${R.comp != null ? Math.round(R.comp*100) + ' %' : '—'}</b><span>charge prévue</span></div><div><b class="num">${R.ramp != null ? (R.ramp >= 0 ? '+' : '−') + Math.abs(R.ramp).toFixed(1).replace('.', ',') : '—'}</b><span>fitness (CTL)</span></div><div><b class="num">${R.tsb != null ? Math.round(R.tsb) : '—'}</b><span>forme (TSB)</span></div></div>
    <p class="sty-p">${esc(R.why.join(' · '))}.</p><p class="sty-p"><b>${esc(V.s)}</b></p>
    <p class="sty-p sty-m">FTP ${R.ftpNow} W · trajectoire vers ${S.profile.goalFtp} W : ${R.ftpExp} W attendus à ce stade${R.ftpNow >= R.ftpExp ? ' ✓' : ` (écart ${R.ftpExp - R.ftpNow} W, le prochain test tranchera)`}.</p>`;
  const nph = nwk ? PHASE_INFO[nwk.ph] : null;
  const s4 = `<div class="sty-k">Semaine prochaine${nwk ? ` · sem. ${nwk.i + 1}` : ''}</div>
    ${nph ? `<div class="sty-pill" style="background:${nph.c}">${esc(nph.l)}</div><p class="sty-p sty-m">${esc(weekRole(nwk) || nph.d)}</p>` : ''}
    <div class="sty-h">${NK.length ? `Les ${NK.length} séances clés` : 'Rien de prévu'}</div>
    ${NK.map(o => `<div class="sty-key" ${o.k === 't' ? `data-tri="${o.x.id}"` : `data-open="${o.x.id}"`}><div class="sty-kd"><span>${DOW[dowMon(o.x.date)]}</span><b class="num">${parseD(o.x.date).getDate()}</b></div><div><b>${o.i.ic} ${esc(o.i.name)}</b><small class="num">${esc(o.meta)}</small><p>${esc(o.goal)}</p></div></div>`).join('')}
    <p class="sty-p sty-m">Le reste de la semaine : endurance facile et récup, sans forcer.</p>`;
  return [s1, s2, s3, s4];
}
// semaine à résumer : le dimanche (dès 17 h) et le lundi, la semaine qui se termine / vient de se terminer
function recapWeek(){
  const t = todayISO(), dow = dowMon(t), h = new Date().getHours();
  if (dow === 6 && h >= 17) return monday(t);
  if (dow === 0) return addDays(monday(t), -7);
  return null;
}
function recapBannerHTML(){
  const w0 = recapWeek(); if (!w0 || !S.profile || w0 < monday(S.profile.startDate)) return '';
  const seen = S.settings.storySeen === w0;
  return `<button class="recap ${seen ? 'seen' : ''}" data-story="${w0}"><span class="rc-ic">📊</span><span><b>${seen ? 'Revoir le bilan de la semaine' : 'Ton bilan de la semaine est prêt'}</b><small>Charge, verdict, séances clés à venir</small></span><span>›</span></button>`;
}
let STORY = null;
function openStory(w0){
  const slides = storySlides(w0);
  let el = document.getElementById('story'); if (!el) { el = document.createElement('div'); el.id = 'story'; document.body.appendChild(el); }
  STORY = { w0, i: 0, n: slides.length };
  el.innerHTML = `<div class="sty-prog">${slides.map((_, i) => `<i data-n="${i}"><b></b></i>`).join('')}</div><button class="sty-x" aria-label="Fermer">×</button>
    ${slides.map((s, i) => `<section class="sty-s" data-s="${i}">${s}</section>`).join('')}
    <div class="sty-nav"><button class="sty-prev" aria-label="Précédent"></button><button class="sty-next" aria-label="Suivant"></button></div>
    <button class="btn sm sty-share">Partager</button>`;
  el.classList.add('on'); document.body.style.overflow = 'hidden';
  if (S.settings.storySeen !== w0 && w0 === recapWeek()) { S.settings.storySeen = w0; save(); }
  showSlide(0);
}
function showSlide(i){
  const el = document.getElementById('story'); if (!el || !STORY) return;
  STORY.i = clamp(i, 0, STORY.n - 1);
  el.querySelectorAll('.sty-s').forEach(s => s.classList.toggle('on', +s.dataset.s === STORY.i));
  el.querySelectorAll('.sty-prog i').forEach(b => b.className = +b.dataset.n < STORY.i ? 'past' : +b.dataset.n === STORY.i ? 'cur' : '');
}
function closeStory(){ const el = document.getElementById('story'); if (el) el.classList.remove('on'); document.body.style.overflow = ''; STORY = null; render(); }
function storyText(w0){
  const R = weekReview(w0), NK = nextKeys(addDays(w0, 7));
  const V = { ok:'On track 🎯', over:'Je charge trop 🔥', under:'Pas assez 🪫' }[R.v];
  return `FTP Builder · semaine du ${fmtShort(R.w0)}\n${R.nSess} séances · ≈ ${R.real} TSS\n${V} : ${R.why.join(' · ')}\nÀ venir : ${NK.map(o => `${DOW[dowMon(o.x.date)]} ${o.i.name}`).join(' · ')}`;
}
document.addEventListener('click', e => {
  const s = e.target.closest('[data-story]'); if (s) { e.preventDefault(); openStory(s.dataset.story); return; }
  const st = e.target.closest('#story'); if (!st) return;
  if (e.target.closest('.sty-x')) { closeStory(); return; }
  if (e.target.closest('.sty-share')) { const txt = storyText(STORY.w0); if (navigator.share) navigator.share({ text: txt }).catch(() => {}); else navigator.clipboard?.writeText(txt).then(() => toast('Bilan copié')); return; }
  const k = e.target.closest('[data-open],[data-tri]'); if (k) { closeStory(); return; } // l'autre écouteur ouvre la fiche
  if (e.target.closest('.sty-prev')) showSlide(STORY.i - 1);
  else if (e.target.closest('.sty-next')) { if (STORY.i === STORY.n - 1) closeStory(); else showSlide(STORY.i + 1); }
}, true);
document.addEventListener('keydown', e => { if (!STORY) return; if (e.key === 'Escape') closeStory(); if (e.key === 'ArrowRight') showSlide(STORY.i + 1); if (e.key === 'ArrowLeft') showSlide(STORY.i - 1); });
/* ===== /PHASES + BILAN ===== */
function triBannerHTML(){
  if (triOn()) { const T = tri(), d = diffDays(todayISO(), T.race.date), next = (S.triPlan || []).filter(x => x.date >= todayISO() && triStatus(x) === 'planned');
    return `<div class="card tri-banner"><div class="row between"><h2 style="margin:0">🏁 ${esc(T.race.name)}</h2><span class="num" style="font-size:22px;font-weight:700">J-${d}</span></div>
      <p class="tiny muted" style="margin:4px 0 0">${fmtDate(T.race.date)} · ${esc(T_raceLine())} · ${next.length} séances nat / course à venir</p>
      ${triGoalTableHTML()}
      <div class="row" style="margin-top:10px"><button class="btn sm" data-trisetup="1">Réglages du plan tri</button></div></div>`; }
  return `<div class="card tri-banner"><h2 style="margin:0 0 4px">🏁 Passer en plan triathlon</h2><p class="small muted" style="margin:0 0 8px">Un seul plan vélo + nat + course construit autour de ta course A (AlpsMan Half, début juin).</p><button class="btn primary sm" data-trisetup="1">Configurer</button></div>`;
}

/* ----- Carrousel d'arches (programme) ----- */
// couleurs du carrousel = palette de l'icône, du plus facile (bleu) au plus dur (orange)
const ARC_COL = { 1:'#7cc3ff', 2:'#8f86ff', 3:'#ad5cf0', 4:'#e05ad0', 5:'#ff6f8a', 6:'#ff9a52' };
function arcsHTML(){
  if (!S.plan.length) return '';
  const t = todayISO(), plan = S.plan.slice().sort((a,b)=>a.date.localeCompare(b.date));
  return `<div class="arcs-wrap"><div class="arcs-head"><h2>Séances</h2><span class="muted small num" id="arcPos"></span></div>
    <div class="arcs" id="arcs">${plan.map(s => { const W = WORKOUTS[s.workoutId]; const ms = mainStep(s.workoutId);
      const col = ARC_COL[zoneOf(ms?.p || (W.steps.length && flat(W.steps)[0].p) || 60)] || ARC_COL[2];
      return `<div class="arc ${s.status}" data-arc="${s.id}" data-date="${s.date}" style="--ac:${col}"><span class="ast">${s.status==='done'?'✅':s.status==='skipped'?'⏭️':W.type==='test'?'🎯':''}</span><span class="ad">${s.date===t?"Aujourd'hui":fmtShort(s.date)}</span><span class="an">${esc(W.name)}</span><span class="am num">${fmtDur(wDur(s.workoutId))}${ms?` · ${watts(ms.p)} W`:''}</span></div>`; }).join('')}</div>
    <div class="arcs-hint">Glisse · touche la séance au centre pour l'ouvrir</div></div>`;
}
function bindArcs(){
  const box = $('#arcs'); if (!box) return;
  const cards = [...box.children]; let cur = -1, raf = 0;
  const upd = () => { raf = 0; const c = box.scrollLeft + box.clientWidth / 2; let best = 0, bd = 1e9;
    cards.forEach((el, i) => { const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - c); const k = Math.min(d / 115, 1);
      el.style.transform = `scale(${(1.16 - k * 0.38).toFixed(3)})`; el.style.zIndex = Math.round(1000 - d); el.style.setProperty('--fo', (1 - k * 0.7).toFixed(2)); if (d < bd) { bd = d; best = i; } });
    if (best !== cur) { cards[cur]?.classList.remove('on'); cards[best].classList.add('on'); cur = best; const pos = $('#arcPos'); if (pos) pos.textContent = cards[best].dataset.date === todayISO() ? "aujourd'hui" : fmtDate(cards[best].dataset.date); } };
  box.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(upd); }, { passive: true });
  box.addEventListener('click', e => { const el = e.target.closest('.arc'); if (!el) return; const i = cards.indexOf(el);
    if (i === cur) sessionDlg(el.dataset.arc); else box.scrollTo({ left: el.offsetLeft + el.offsetWidth / 2 - box.clientWidth / 2, behavior: 'smooth' }); });
  const t = todayISO(); let start = cards.findIndex(el => el.dataset.date >= t && el.classList.contains('planned')); if (start < 0) start = cards.findIndex(el => el.dataset.date >= t); if (start < 0) start = cards.length - 1;
  const go = () => { const el = cards[start]; box.scrollLeft = el.offsetLeft + el.offsetWidth / 2 - box.clientWidth / 2; upd(); };
  go(); requestAnimationFrame(go);
}

/* graphe Forme & fatigue (CTL/ATL/TSB) — affiché dans la rubrique Forme de l'accueil */
function loadCardHTML(){
  const L = loadSeries();
  if (L.length > 2) {
    const lx0 = parseD(L[0].d).getTime(), lx1 = parseD(L[L.length-1].d).getTime();
    const vals = L.flatMap(l=>[l.ctl,l.atl,l.tsb]);
    const xl2 = L.filter((l,i)=>i % Math.ceil(L.length/6) === 0).map(l=>[parseD(l.d).getTime(), fmtShort(l.d)]);
    const last = L[L.length-1];
    return `<div class="card"><div class="row between"><h2>Forme & fatigue</h2><span class="muted small num">Forme ${Math.round(last.tsb)}</span></div>
      <div class="grid3" style="margin-bottom:10px"><div class="kpi"><div class="v num">${Math.round(last.ctl)}</div><div class="l">Fitness (CTL)</div></div><div class="kpi"><div class="v num">${Math.round(last.atl)}</div><div class="l">Fatigue (ATL)</div></div><div class="kpi"><div class="v num">${Math.round(last.tsb)}</div><div class="l">Forme (TSB)</div></div></div>
      ${lineChart({ series:[ { type:'area', pts:L.map(l=>[parseD(l.d).getTime(), l.ctl]), color:'var(--z2)' }, { pts:L.map(l=>[parseD(l.d).getTime(), l.ctl]), color:'var(--z2)' }, { pts:L.map(l=>[parseD(l.d).getTime(), l.atl]), color:'var(--z5)', width:1.5 }, { pts:L.map(l=>[parseD(l.d).getTime(), l.tsb]), color:'var(--z3)', width:1.5, dash:'4 3' } ], xMin:lx0, xMax:lx1, yMin:Math.floor(Math.min(0,...vals)/10)*10, yMax:Math.ceil(Math.max(20,...vals)/10)*10, xLabels:xl2, h:180 })}
      <div class="legend"><span><i style="background:var(--z2)"></i>Fitness</span><span><i style="background:var(--z5)"></i>Fatigue</span><span><i style="background:var(--z3)"></i>Forme</span></div></div>`;
  }
  return '';
}
/* ----- Progression ----- */
function progHTML(){
  const p = S.profile, t = todayISO();
  const done = countDone();
  const acts = S.activities.slice().sort((a,b)=>a.date.localeCompare(b.date));
  const best = k => Math.max(0, ...acts.map(a => a.best?.[k] || 0)) || null;
  // séance qui détient le record (la plus récente en cas d'égalité)
  const bestAct = k => { const v = best(k); return v ? acts.filter(a => a.best?.[k] === v).pop() : null; };
  const f0 =S.ftpHistory[0]?.ftp || ftp();
  const proj = projection();
  let h = '';
  // courbe FTP
  const x0 = parseD(p.startDate).getTime(), x1 = parseD(p.endDate).getTime();
  const tests = S.ftpHistory.map(h => [parseD(h.date).getTime(), h.ftp, String(h.ftp)]);
  const floor = acts.filter(a=>a.best?.m20).map(a => [parseD(a.date).getTime(), Math.round(a.best.m20*0.95)]);
  const ys = [f0, p.goalFtp, ...tests.map(x=>x[1]), ...floor.map(x=>x[1])];
  const yMin = Math.floor((Math.min(...ys)-15)/10)*10, yMax = Math.ceil((Math.max(...ys)+15)/10)*10;
  const xl = []; for (let d = p.startDate.slice(0,8)+'01'; d <= p.endDate; d = addDays(d, 32).slice(0,8)+'01') if (d >= p.startDate) xl.push([parseD(d).getTime(), MONTHS[parseD(d).getMonth()]]);
  const series = [
    { pts:[[x0,f0],[parseD(p.goalDate).getTime(),p.goalFtp]], color:'var(--muted)', dash:'5 5', width:1.5 },
    { type:'dots', pts: floor, color:'var(--z2)', r:3 },
    { pts: tests.map(x=>[x[0],x[1]]), color:'var(--accent)', width:2.5 },
    { type:'dots', pts: tests, color:'var(--accent)' },
  ];
  if (proj) series.push({ pts:[[parseD(proj.fromDate).getTime(), proj.from],[parseD(p.goalDate).getTime(), proj.value]], color:'var(--accent)', dash:'2 4', width:1.5 });
  const todayX = parseD(t).getTime();
  h += `<div class="card"><h2>FTP vs objectif</h2>${lineChart({ series, xMin:x0, xMax:x1, yMin, yMax, xLabels:xl })}
    <div class="legend"><span><i style="background:var(--accent)"></i>Tests FTP</span><span><i style="background:var(--muted)"></i>Trajectoire cible</span><span><i style="background:var(--z2)"></i>95 % du meilleur 20 min de chaque séance</span></div></div>`;
  // records
  // records actuels, ou projetés à la FTP objectif : l'aérobie suit la FTP, le sprint beaucoup moins
  const rGoal = p.goalFtp && ftp() ? p.goalFtp / ftp() : 1, showGoal = recGoal && rGoal > 1;
  const projRec = (k, v) => !v ? null : Math.round(v * (1 + (rGoal - 1) * ({ s5: 0.2, m1: 0.5, m5: 0.9, m20: 1 }[k])));
  h += `<div class="card"><div class="row between"><h2>Records de puissance</h2>${p.goalFtp > ftp() ? `<button class="btn sm ${showGoal ? 'primary' : ''}" data-recgoal aria-pressed="${showGoal}">${showGoal ? 'Actuels' : `À ${p.goalFtp} W`}</button>` : ''}</div>
    <div class="grid4">${[['s5','5 s'],['m1','1 min'],['m5','5 min'],['m20','20 min']].map(([k,l]) => { const v = showGoal ? projRec(k, best(k)) : best(k), ra = bestAct(k);
      return `<div class="kpi"${ra ? ` data-act="${ra.id}" role="button" tabindex="0" aria-label="Voir la séance du record ${l}" style="cursor:pointer"` : ''}><div class="v num"${showGoal ? ' style="color:var(--accent)"' : ''}>${v ?? '—'}<small>${v ? ' W' : ''}</small></div><div class="l">${l}${v ? ` · ${(v/p.weightKg).toFixed(1)} W/kg` : ''}</div>${showGoal && v ? `<div class="tiny muted" style="margin-top:2px">+${v - best(k)} W</div>` : ra ? `<div class="tiny muted" style="margin-top:2px">${fmtShort(ra.date)} ›</div>` : ''}</div>`; }).join('')}
    </div>${showGoal ? `<p class="tiny muted" style="margin:10px 0 0">Projection si ta FTP passe de ${ftp()} à ${p.goalFtp} W (+${Math.round((rGoal-1)*100)} %) à poids égal : 20 min et 5 min suivent la FTP, la minute à moitié, le sprint de 5 s à peine (il dépend surtout de la force et de la vitesse de pédalage). Ordres de grandeur, pas une promesse.</p>` : ''}</div>`;
  // ressentis
  const felt = acts.filter(a=>a.feel?.rpe);
  if (felt.length) {
    h += `<div class="card"><h2>Ressentis</h2><div style="display:flex;align-items:flex-end;gap:4px;height:90px">${felt.slice(-30).map(a=>`<div title="${fmtShort(a.date)} · RPE ${a.feel.rpe}" style="flex:1;max-width:22px;height:${a.feel.rpe*10}%;border-radius:4px 4px 0 0;background:${a.feel.rpe>=9?'var(--bad)':a.feel.rpe>=7?'var(--warn)':'var(--ok)'}"></div>`).join('')}</div>
      <div class="tiny muted" style="margin-top:6px">RPE moyen sur les 5 dernières : <b class="num">${(felt.slice(-5).reduce((a,x)=>a+x.feel.rpe,0)/Math.min(5,felt.length)).toFixed(1)}</b></div></div>`;
  }
  h += `<div class="card"><h2>Historique</h2>${acts.length ? acts.slice().reverse().map(actRow).join('') : '<p class="muted">Aucune séance enregistrée.</p>'}</div>`;
  h += Health.otherSportsHTML();
  return h;
}
function projection(){
  const p = S.profile; const H = S.ftpHistory.filter(h => h.source === 'test');
  if (!H.length) return null;
  const last = H[H.length-1];
  const all = S.ftpHistory;
  let rate; // W par semaine
  if (H.length >= 2) { const first = H[0]; const w = diffDays(first.date, last.date)/7; rate = w > 0 ? (last.ftp - first.ftp)/w : 0; }
  else rate = 1.5; // hypothèse prudente : +1,5 W/semaine avec 2-3 séances structurées
  rate = clamp(rate, 0, 3);
  const weeks = Math.max(diffDays(last.date, p.goalDate)/7, 0);
  const value = Math.round(last.ftp + rate*weeks);
  const gap = p.goalFtp - value;
  const text = H.length >= 2
    ? `Au rythme mesuré entre tes tests (${rate.toFixed(1)} W/semaine), tu serais vers ${value} W le ${fmtShort(p.goalDate)}${gap>0?` (${gap} W sous l'objectif)`:' : objectif en vue'}.`
    : `Hypothèse prudente de +1,5 W/semaine : ~${value} W le ${fmtShort(p.goalDate)}. Il te faudrait ${((p.goalFtp-last.ftp)/Math.max(weeks,1)).toFixed(1)} W/semaine pour ${p.goalFtp} W. Le prochain test affinera.`;
  return { value, text, from: last.ftp, fromDate: last.date };
}

/* ----- Profil / questionnaire ----- */
function defaultProfile(){
  const t = todayISO();
  const days = {}; for (let d=0; d<7; d++) days[d] = { avail: [1,3,5].includes(d), max: d>=5 ? 120 : 75 };
  return { name:'', sex:'M', age:'', weightKg:'', heightCm:'', ftp:'', hrMax:'', hrRest:'', goalFtp:300, goalDate:'2027-03-05', endDate:'2027-03-15', minSessions:35,
    startDate: addDays(t,1), days, keyPerWeek:2, optionalPerWeek:1, otherSports:true, holidays:true, testProtocol:'20min', warmupMin:0, intensityAdj:1, ctl0: 40 };
}
function qHTML(p, onboarding){
  const T0 = triOn() ? tri() : null, tsw = T0 ? T0.swimDays.slice(0, T0.swimPerWeek) : [], trn = T0 ? T0.runDays.slice(0, T0.runPerWeek) : [];
  const dayCells = [0,1,2,3,4,5,6].map(d => `<div class="day ${p.days[d].avail?'on':''}" data-day="${d}"><button type="button">${DOW[d]}</button><input type="number" min="30" max="300" step="15" value="${p.days[d].max}" ${p.days[d].avail?'':'disabled'} aria-label="Durée max vélo ${DOW[d]}"><div class="tiny muted">min 🚴</div>${T0 ? `<div class="dsp"><span class="sp ${tsw.includes(d)?'on':''}" data-sp="swim" data-v="${d}" role="button" aria-pressed="${tsw.includes(d)}" aria-label="Nat ${DOW[d]}">🏊</span><span class="sp ${trn.includes(d)?'on':''}" data-sp="run" data-v="${d}" role="button" aria-pressed="${trn.includes(d)}" aria-label="Course ${DOW[d]}">🏃</span></div>` : ''}</div>`).join('');
  return `<form id="qform" autocomplete="off">
  <div class="card"><div class="row between"><h2>Toi</h2><button type="button" class="btn sm" id="prefill">Pré-remplir depuis un .fit Garmin</button></div>
    <div class="grid2">
      <div><label class="f">Prénom</label><input type="text" name="name" value="${esc(p.name)}"></div>
      <div><label class="f">Sexe</label><select name="sex"><option value="M" ${p.sex==='M'?'selected':''}>Homme</option><option value="F" ${p.sex==='F'?'selected':''}>Femme</option></select></div>
      <div><label class="f">Âge</label><input type="number" name="age" min="12" max="99" value="${p.age}" required></div>
      <div><label class="f">Poids (kg)</label><input type="number" name="weightKg" step="0.1" min="35" max="160" value="${p.weightKg}" required></div>
      <div><label class="f">Taille (cm)</label><input type="number" name="heightCm" min="130" max="220" value="${p.heightCm}"></div>
      <div><label class="f">FC max (bpm)</label><input type="number" name="hrMax" min="140" max="230" value="${p.hrMax}" placeholder="ex. 188"></div>
    </div>
    <div id="prefillInfo" class="tiny muted" style="margin-top:8px"></div>
  </div>
  <div class="card"><h2>Ton objectif</h2>
    <div class="grid2">
      <div><label class="f">FTP actuelle (W)</label><input type="number" name="ftp" min="80" max="600" value="${p.ftp}" required placeholder="ex. 255"></div>
      <div><label class="f">FTP visée (W)</label><input type="number" name="goalFtp" min="80" max="600" value="${p.goalFtp}" required></div>
      <div><label class="f">Date du test final</label><input type="date" name="goalDate" value="${p.goalDate}" required></div>
      <div><label class="f">Fin du programme</label><input type="date" name="endDate" value="${p.endDate}" required></div>
      <div><label class="f">Début du programme</label><input type="date" name="startDate" value="${p.startDate}" required></div>
      <div><label class="f">Séances minimum</label><input type="number" name="minSessions" min="5" max="200" value="${p.minSessions}" required></div>
    </div>
    <div id="goalCheck" class="small" style="margin-top:10px"></div>
  </div>
  <div class="card"><h2>Ma semaine</h2>
    <p class="muted small" style="margin-top:0">${triOn() ? 'Vélo : touche un jour pour l\'activer, puis règle sa durée max. Nat et course : touche 🏊 ou 🏃 sous le jour.' : 'Touche un jour pour l\'activer ou le retirer, puis ajuste sa durée max en minutes.'}</p>
    <div class="days">${dayCells}</div>
    <div class="grid2" style="margin-top:6px">
      <div><label class="f">Séances clés / semaine (home trainer)</label><div class="seg" data-seg="keyPerWeek">${[1,2,3].map(n=>`<button type="button" class="${p.keyPerWeek===n?'on':''}" data-v="${n}">${n}</button>`).join('')}</div></div>
      <div><label class="f">Séances optionnelles / semaine (endurance)</label><div class="seg" data-seg="optionalPerWeek">${[0,1,2].map(n=>`<button type="button" class="${p.optionalPerWeek===n?'on':''}" data-v="${n}">${n}</button>`).join('')}</div></div>
      <div><label class="f">Test FTP</label><select name="testProtocol"><option value="20min" ${p.testProtocol==='20min'?'selected':''}>20 min (recommandé)</option><option value="ramp" ${p.testProtocol==='ramp'?'selected':''}>Rampe</option></select></div>
      <div><label class="f">Échauffement préféré</label><select name="warmupMin">${[[0,'Selon la séance'],[10,'10 min mini'],[12,'12 min mini'],[15,'15 min mini'],[20,'20 min mini'],[25,'25 min mini']].map(([v,l])=>`<option value="${v}" ${(+p.warmupMin||0)===v?'selected':''}>${l}</option>`).join('')}</select></div>
      <div><label class="f">Fitness actuelle (CTL estimée)</label><select name="ctl0">${[[20,'Reprise (20)'],[40,'Régulier (40)'],[60,'Bien entraîné (60)'],[80,'Très chargé (80)']].map(([v,l])=>`<option value="${v}" ${+p.ctl0===v?'selected':''}>${l}</option>`).join('')}</select></div>
    </div>
    <p class="tiny muted" style="margin:8px 0 0">Échauffement préféré : si une séance prévoit moins, son premier palier d'échauffement est rallongé (activations non comptées). Les séances qui en prévoient déjà plus ne changent pas.</p>
    <label class="row small" style="margin-top:12px;gap:8px"><input type="checkbox" name="otherSports" ${p.otherSports?'checked':''}> Je pratique aussi d'autres sports (course, natation…)</label>
    <label class="row small" style="margin-top:6px;gap:8px"><input type="checkbox" name="holidays" ${p.holidays?'checked':''}> Alléger les semaines des fêtes de fin d'année</label>
  </div>
  <div class="row" style="margin-bottom:16px"><button class="btn primary" type="submit">${onboarding ? 'Générer mon plan' : 'Enregistrer et régénérer les séances à venir'}</button>${onboarding?'':'<button class="btn" type="button" id="saveOnly">Enregistrer sans régénérer</button>'}</div>
  </form>`;
}
function onboardingHTML(){
  return `<div class="onb"><div class="hero"><h1>FTP<b>·</b>Builder</h1><p class="muted">Réponds à quelques questions : je construis ton plan de séances jusqu'à ton test final, avec les watts exacts à envoyer sur ton Edge.</p></div>${qHTML(_draft ||= defaultProfile(), true)}
    <div class="card"><h3>Déjà des données ?</h3><div class="row"><button class="btn sm" data-auth="open">Se connecter</button><button class="btn sm" data-guide="open">Comment ça marche ?</button><button class="btn sm" id="importJsonOnb">Restaurer une sauvegarde JSON</button></div></div><p class="tiny muted" style="text-align:center"><a href="confidentialite.html">Politique de confidentialité</a></p></div>`;
}
let _draft = null;
function readForm(base){
  const f = $('#qform'); const fd = new FormData(f); const p = structuredClone(base);
  for (const k of ['name','sex','goalDate','endDate','startDate','testProtocol']) p[k] = fd.get(k);
  for (const k of ['age','weightKg','heightCm','ftp','hrMax','goalFtp','minSessions','ctl0','warmupMin']) p[k] = fd.get(k) === '' ? '' : +fd.get(k);
  p.otherSports = !!fd.get('otherSports'); p.holidays = !!fd.get('holidays');
  f.querySelectorAll('.day').forEach(el => { const d = +el.dataset.day; p.days[d].max = +el.querySelector('input').value || 60; });
  return p;
}
function goalCheckText(p){
  if (!p.ftp || !p.goalFtp || !p.goalDate || !p.startDate) return '';
  const w = diffDays(p.startDate, p.goalDate)/7; const gain = p.goalFtp - p.ftp; const pct = gain/p.ftp*100; const perW = gain/Math.max(w,1);
  const avail = [0,1,2,3,4,5,6].filter(d=>p.days[d].avail).length;
  const sessions = Math.round(w * Math.min(p.keyPerWeek + p.optionalPerWeek, avail));
  let cls = 'ok', msg = `+${gain} W (${pct.toFixed(0)} %) en ${Math.round(w)} semaines, soit ${perW.toFixed(1)} W/semaine.`;
  if (pct > 15) { cls = 'bad'; msg += ` C'est très ambitieux : au-delà de 10-12 % en 4-5 mois, il faut un vrai volume (3 séances/sem. ou plus) et un peu de chance. Le plan reste valable, la projection te dira où tu en es.`; }
  else if (pct > 8) { cls = ''; msg += ` Ambitieux mais jouable avec de la régularité.`; }
  msg += ` Environ ${sessions} séances prévues.`;
  const after = p.endDate ? Math.round(diffDays(p.goalDate, p.endDate) / 7) : 0;
  if (after >= 2) { if (cls === 'ok') cls = ''; msg += ` Attention : ton test final (${fmtShort(p.goalDate)}) tombe ${after} semaines avant la fin du plan (${fmtShort(p.endDate)}). Après le test, l'app passe en « consolidation » (maintien). Si c'est ton vrai objectif, mets le test final plus près de la fin.`; }
  else if (after < 0) { cls = 'bad'; msg += ` Le test final est après la date de fin du plan : recule la date de fin.`; }
  return `<div class="note ${cls}" style="margin:0">${esc(msg)}</div>`;
}
function bindQuestionnaire(onboarding){
  const f = $('#qform'); if (!f) return;
  let base = onboarding ? _draft : structuredClone(S.profile);
  const refresh = () => { base = readForm(base); if (onboarding) _draft = base; $('#goalCheck').innerHTML = goalCheckText(base); };
  f.addEventListener('input', refresh);
  f.querySelectorAll('.day').forEach(el => el.addEventListener('click', e => {
    const inp = el.querySelector('input');
    if (e.target === inp && !inp.disabled) return; // saisie des minutes
    e.preventDefault();
    const d = +el.dataset.day; base.days[d].avail = !base.days[d].avail;
    el.classList.toggle('on', base.days[d].avail); inp.disabled = !base.days[d].avail; refresh();
  }));
  const triDays = triOn() ? { swim: tri().swimDays.slice(0, tri().swimPerWeek), run: tri().runDays.slice(0, tri().runPerWeek) } : null;
  f.querySelectorAll('[data-sp]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); const k = b.dataset.sp, v = +b.dataset.v, on = !triDays[k].includes(v);
    triDays[k] = on ? [...triDays[k], v].sort((a, c) => a - c) : triDays[k].filter(x => x !== v); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }));
  f.querySelectorAll('.seg').forEach(seg => seg.querySelectorAll('button').forEach(b => b.onclick = () => { base[seg.dataset.seg] = +b.dataset.v; seg.querySelectorAll('button').forEach(x=>x.classList.toggle('on', x===b)); refresh(); }));
  $('#prefill').onclick = () => pickFile(async file => {
    try {
      const fit = await FIT.readFile(file); const u = fit.user, z = fit.zones, s = fit.sessions[0] || {};
      const set = (name, v) => { const el = f.elements[name]; if (v != null && v !== '' && el && el.value === '') el.value = v; };
      set('age', u.age); set('weightKg', u.weightKg); set('heightCm', u.heightCm);
      if (u.sex) f.elements.sex.value = u.sex;
      const hrM = u.hrMaxBike || u.hrMax || z.hrMax; set('hrMax', hrM);
      set('ftp', z.ftp || s.ftp);
      $('#prefillInfo').innerHTML = `Trouvé dans le fichier : ${[u.age&&`${u.age} ans`, u.weightKg&&`${u.weightKg} kg`, u.heightCm&&`${u.heightCm} cm`, (z.ftp||s.ftp)&&`FTP réglée sur le Garmin ${z.ftp||s.ftp} W`, hrM&&`FC max réglée ${hrM}`, s.maxHr&&`FC max de la séance ${s.maxHr}`].filter(Boolean).join(' · ')}. Les champs déjà remplis n'ont pas été modifiés.`;
      refresh();
    } catch(e){ toast(e.message); }
  });
  f.addEventListener('submit', e => {
    e.preventDefault(); refresh();
    const p = base;
    if (![0,1,2,3,4,5,6].some(d=>p.days[d].avail)) return toast('Choisis au moins un jour disponible');
    if (p.goalDate > p.endDate) return toast('La date du test final doit précéder la fin du programme');
    if (onboarding) {
      S.profile = p; S.ftpHistory = [{ date: p.startDate < todayISO() ? p.startDate : todayISO(), ftp: p.ftp, source:'initial' }];
      S.plan = generatePlan(p); save(); TAB = 'today'; render(); toast(`Plan généré : ${S.plan.length} séances`);
    } else {
      p.ftp = S.profile.ftp; // la FTP ne change que via un test ou l'édition explicite
      const newF = +f.elements.ftp.value; if (newF && newF !== S.profile.ftp) { p.ftp = newF; S.ftpHistory.push({ date: todayISO(), ftp: newF, source:'manual' }); }
      S.profile = p;
      if (triDays && triDays.swim.length && triDays.run.length) { applyTri({ ...tri(), swimDays: triDays.swim, runDays: triDays.run, swimPerWeek: Math.min(3, triDays.swim.length), runPerWeek: Math.min(3, triDays.run.length) }); render(); toast('Ma semaine enregistrée : vélo, nat et course à venir régénérés'); return; }
      regenerateFuture(); save(); render(); toast('Profil enregistré, séances à venir régénérées');
    }
  });
  const so = $('#saveOnly'); if (so) so.onclick = () => { refresh(); const newF = +f.elements.ftp.value; if (newF && newF !== S.profile.ftp) S.ftpHistory.push({ date: todayISO(), ftp: newF, source:'manual' }); base.ftp = newF || S.profile.ftp; S.profile = base; save(); render(); toast('Profil enregistré'); };
  const ij = $('#importJsonOnb'); if (ij) ij.onclick = importJSON;
  refresh();
}
function regenerateFuture(){
  const t = todayISO(); const p = S.profile;
  const keep = S.plan.filter(s => s.date < t || s.status !== 'planned');
  const fresh = generatePlan(p, t).filter(s => !keep.some(k => k.date === s.date));
  S.plan = [...keep, ...fresh].sort((a,b)=>a.date.localeCompare(b.date));
}
/* Profil › Réglages : Bien démarrer, Compte, Apple Santé regroupés derrière un bouton */
let PROFILE_PANE = null;
const GEAR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`;
function settingsBtnHTML(){
  const st = Cloud.ready ? guideSteps() : [], left = st.filter(x => x.must && !x.done).length;
  const sub = !Cloud.user ? 'Compte non connecté' : left ? `Bien démarrer : ${left} étape${left > 1 ? 's' : ''} à faire` : 'Bien démarrer, compte, Apple Santé';
  return `<button class="card set-btn" data-settings="open"><span class="set-ic">${GEAR}</span><span style="flex:1;min-width:0;text-align:left"><b>Réglages</b><span class="tiny muted" style="display:block">${sub}</span></span>${left ? `<span class="set-dot" aria-label="${left} étape(s) à faire">${left}</span>` : ''}<span class="muted" aria-hidden="true">›</span></button>`;
}
function settingsPaneHTML(){
  return `<div class="pane-in"><div class="pane-head"><button class="pane-back" data-settings="back" aria-label="Retour au profil"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button><h2>Réglages</h2></div>
    ${Cloud.ready ? guideHTML(false) : ''}${Cloud.accountHTML()}${Health.settingsHTML() || `<div class="card"><div class="row between"><h2>Apple Santé</h2><a class="small" href="raccourci.html">Guide du raccourci</a></div><p class="small muted" style="margin:0">Un Raccourci iOS envoie chaque jour sommeil, VFC, FC repos et poids vers l'app. ${Cloud.sb ? 'Connecte-toi (carte Compte ci-dessus) pour générer ta clé.' : 'Hors ligne : reviens avec la connexion pour générer ta clé.'}</p></div>`}</div>`;
}
document.addEventListener('click', e => { const b = e.target.closest('[data-settings]'); if (!b) return;
  PROFILE_PANE = b.dataset.settings === 'open' ? 'settings' : null; if (dlg.open) closeDlg(); TAB = 'profile'; render(); window.scrollTo(0, 0); });
function profileHTML(){
  if (PROFILE_PANE === 'settings') return settingsPaneHTML();
  if (PROFILE_PANE === 'climbs') return Library.climbsPane();
  if (PROFILE_PANE === 'gpx') return Library.gpxPane();
  if (PROFILE_PANE === 'garage') return Garage.pane();
  return settingsBtnHTML() + Library.squaresHTML() + Garage.tileHTML() + Library.racesHTML() + qHTML(S.profile, false) + `<div class="card"><h2>Données</h2>
    <div class="row" style="margin-bottom:8px"><button class="btn" data-tour="open">Revoir la visite guidée</button></div>
    <div class="row"><button class="btn" id="expJson">Exporter mes données (JSON)</button><button class="btn" id="impJson">Importer</button>
    <select id="themeSel" style="width:auto"><option value="auto">Thème auto</option><option value="dark">Sombre</option><option value="light">Clair</option></select></div>
    <div class="row between" style="margin-top:8px"><button class="btn danger sm" id="reset">Tout effacer</button><a class="small" href="confidentialite.html">Politique de confidentialité</a></div></div>
    <div class="card"><h2>Envoyer une séance sur l'Edge 530</h2><ol class="small muted" style="padding-left:18px;margin:0">
      <li>Dans une séance, touche « Envoyer sur l'Edge (.fit) ».</li>
      <li>Branche l'Edge à l'ordinateur en USB et copie le fichier dans <b>Garmin/NewFiles</b>.</li>
      <li>Débranche : la séance apparaît dans <b>Entraînement › Entraînements</b>. Connecte le Flux 2 comme home trainer : l'Edge règle la résistance (ERG) à chaque palier.</li>
      <li>Les paliers « À FOND » des tests n'ont pas de cible : passe le Flux 2 en mode résistance/pente pour l'effort.</li></ol></div>
    <div class="card"><h2>Bibliothèque de séances</h2>${Object.entries(WORKOUTS).map(([id,W])=>`<div class="hist"><div style="flex:1"><b>${esc(W.name)}</b><div class="tiny muted">${fmtDur(wDur(id))} · TSS ${wTSS(id)}</div></div><button class="btn sm" data-lib="${id}">Voir</button></div>`).join('')}</div>`;
}
function exportJSON(){ download(`ftp-builder-${todayISO()}.json`, new TextEncoder().encode(JSON.stringify(S, null, 1)), 'application/json'); }
function importJSON(){
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = async () => { try { const d = JSON.parse(await inp.files[0].text()); if (!d.version) throw new Error('Fichier non reconnu'); const m = migrateState(d); if (!m) throw new Error('Fichier non reconnu'); if (m.newer) throw new Error("Sauvegarde faite avec une version plus récente de l'app : mets l'app à jour puis réessaie"); if (S.profile) backupState(S, 'remplacé par une sauvegarde JSON'); S = Object.assign(blank(), m.state); delete S.syncLegacy; delete S.syncedUser; if (Cloud.user) S.syncedUser = Cloud.user.id; save(); TAB='today'; render(); toast('Données importées'); } catch(e){ toast(e.message); } };
  inp.click();
}
