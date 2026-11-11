"use strict";
// FTP Builder · dialogues
/* ============ dialogues ============ */
const dlg = $('#dlg'), dlgBody = $('#dlgBody');
function openDlg(html){ dlgBody.innerHTML = `<button class="x" data-close aria-label="Fermer">×</button>` + html; if (!dlg.open) dlg.showModal(); }
function closeDlg(){ if (dlg.open) dlg.close(); }
dlg.addEventListener('click', e => { if (e.target === dlg || e.target.closest('[data-close]')) closeDlg(); });

function sessionDlg(id){
  const s = S.plan.find(x => x.id === id); if (!s) return;
  const W = WORKOUTS[s.workoutId]; const act = s.activityId ? S.activities.find(a=>a.id===s.activityId) : null;
  const opts = Object.entries(WORKOUTS).map(([k,w])=>`<option value="${k}" ${k===s.workoutId?'selected':''}>${esc(w.name)} · ${fmtDur(wDur(k))}</option>`).join('');
  openDlg(`<span class="muted small">${fmtDate(s.date)} · Sem. ${s.week+1} · ${esc(s.block)}${s.kind==='optional'?' · optionnelle':''}</span>
    <h2 style="margin:6px 0">${esc(W.name)}</h2><p class="muted small">${esc(W.goal)}</p>
    ${profileBars(s.workoutId)}
    <div class="row small muted" style="margin:8px 0"><span class="num">${fmtDur(wDur(s.workoutId))}</span>·<span class="num">TSS ≈ ${wTSS(s.workoutId)}</span>·<span>FTP ${ftp()} W${adj()!==1?` (ajust. ${Math.round((adj()-1)*1000)/10} %)`:''}</span></div>
    ${adaptHTML('b', s)}
    ${s.swap ? '' : adjustHTML(s)}
    ${stepsTable(s.workoutId, sAdj(s))}
    ${act ? `<div class="note ok" style="margin-top:12px">Réalisée : ${fmtDur(act.durationS)}${act.np?` · NP ${act.np} W`:''}${act.avgHr?` · ${act.avgHr} bpm`:''}${act.feel?.rpe?` · RPE ${act.feel.rpe}`:''}</div>${evalHTML(act, s)}${ActChart.html(act, s)}` : ''}
    <div class="row" style="margin-top:14px;gap:6px;flex-wrap:wrap">
      <button class="btn" data-swap="b:${s.id}">🔄 ${s.swap ? 'Modifier le remplacement' : 'Changer de séance'}</button>
      ${s.swap && s.status !== 'done' ? '' : s.status === 'done' ? `<button class="btn primary" data-act="${act?.id}">Voir l'activité</button>` : Cloud.icu?.connected ? `<span class="tiny muted">Envoyée sur l'Edge via Intervals.icu, validée automatiquement après la synchro.</span>` : `<button class="btn primary" data-export="${s.id}">Envoyer sur l'Edge (.fit)</button>`}
    </div>
    ${W.type==='test' && s.status==='planned' ? `<button class="btn sm ghost" data-proto="${s.workoutId==='ramp'?'20min':'ramp'}" style="margin-top:8px">${s.workoutId==='ramp'?'Revenir au test 20 min':'Passer au test rampe (ERG)'}</button>` : ''}
    <details class="more" style="margin-top:14px"><summary>⋯ Autres actions : saisir, déplacer, remplacer, passer</summary>
    <div class="row" style="margin-top:8px;gap:6px">${s.status !== 'done' ? `<button class="btn sm" data-log="${s.id}">Saisir la séance à la main</button>` : ''}${Cloud.icu?.connected || s.status === 'done' ? `<button class="btn sm" data-export="${s.id}">Fichier .fit pour l'Edge</button>` : ''}</div>
    <label class="f">Déplacer au</label><div class="row"><input type="date" id="mvDate" value="${s.date}" style="flex:1"><button class="btn" id="mvBtn">Déplacer</button></div>
    <div id="mvWarn" class="tiny" style="color:var(--warn);margin-top:4px"></div>
    <label class="f">Remplacer par</label><div class="row"><select id="rpSel" style="flex:1">${opts}</select><button class="btn" id="rpBtn">Remplacer</button></div>
    <div class="row" style="margin-top:14px">${s.status==='planned'?`<button class="btn sm" id="skipBtn">Passer cette séance</button>`:''}${s.status==='skipped'?`<button class="btn sm" id="unskipBtn">Remettre au programme</button>`:''}<button class="btn sm danger" id="delBtn">Supprimer</button></div></details>`);
  const warn = () => { const d = $('#mvDate').value; $('#mvWarn').textContent = hardConflict(s, d); };
  $('#mvDate').oninput = warn;
  $('#mvBtn').onclick = () => { const d = $('#mvDate').value; if (!d) return; s.date = d; s.week = Math.floor(diffDays(monday(S.profile.startDate), d)/7); S.plan.sort((a,b)=>a.date.localeCompare(b.date)); save(); closeDlg(); render(); toast('Séance déplacée'); };
  $('#rpBtn').onclick = () => { s.workoutId = $('#rpSel').value; save(); sessionDlg(s.id); render(); };
  const sk = $('#skipBtn'); if (sk) sk.onclick = () => { s.status = 'skipped'; save(); closeDlg(); render(); };
  const us = $('#unskipBtn'); if (us) us.onclick = () => { s.status = 'planned'; save(); closeDlg(); render(); };
  $('#delBtn').onclick = () => { if (s.activityId) { const a = S.activities.find(x=>x.id===s.activityId); if (a) a.planId = null; } S.plan = S.plan.filter(x=>x.id!==s.id); save(); closeDlg(); render(); };
}
function hardConflict(s, date){
  if (!isHard(s.workoutId)) return '';
  const near = S.plan.find(x => x.id !== s.id && x.status !== 'skipped' && isHard(x.workoutId) && Math.abs(diffDays(x.date, date)) < 2);
  return near ? `⚠️ ${WORKOUTS[near.workoutId].name} le ${fmtDate(near.date)} : deux séances intenses à moins de 48 h.` : '';
}
function addSessionDlg(){
  const opts = Object.entries(WORKOUTS).map(([k,w])=>`<option value="${k}">${esc(w.name)} · ${fmtDur(wDur(k))}</option>`).join('');
  openDlg(`<h2>Ajouter une séance</h2><label class="f">Date</label><input type="date" id="adDate" value="${todayISO()}"><label class="f">Séance</label><select id="adSel">${opts}</select>
    <label class="row small" style="margin-top:10px;gap:8px"><input type="checkbox" id="adOpt"> Optionnelle</label>
    <div class="row" style="margin-top:14px"><button class="btn primary" id="adBtn">Ajouter</button></div>`);
  $('#adBtn').onclick = () => { const d = $('#adDate').value; S.plan.push({ id:uid(), date:d, week: Math.floor(diffDays(monday(S.profile.startDate), d)/7), block:'Ajoutée', kind: $('#adOpt').checked?'optional':'key', workoutId: $('#adSel').value, status:'planned' }); S.plan.sort((a,b)=>a.date.localeCompare(b.date)); save(); closeDlg(); render(); toast('Séance ajoutée'); };
}

/* ----- saisie / import d'une séance ----- */
let _pending = null;
function pickFile(cb){ const inp = $('#fileIn'); inp.value = ''; inp.onchange = () => inp.files[0] && cb(inp.files[0]); inp.click(); }
function logDlg(planId){
  _pending = { planId: planId || null, act: null };
  const plan = planId ? S.plan.find(s=>s.id===planId) : null;
  openDlg(`<h2>${plan ? esc(WORKOUTS[plan.workoutId].name) : 'Nouvelle séance'}</h2>${plan?`<p class="muted small" style="margin-top:4px">${fmtDate(plan.date)}</p>`:''}
    <div class="seg" id="logMode" style="margin:12px 0"><button type="button" class="on" data-m="file">Fichier .fit</button><button type="button" data-m="manual">Saisie manuelle</button><button type="button" data-m="strava">Strava</button></div>
    <div id="logFile"><div class="drop" id="dropZone">Dépose ou choisis un fichier <b>.fit</b>, <b>.zip</b> (Garmin) ou <b>.fit.gz</b><br><span class="tiny">Garmin Connect › activité › ⚙ › Exporter l'original · Strava › … › Exporter l'original</span></div></div>
    <div id="logManual" class="hidden"><div class="grid2">
      <div><label class="f">Date</label><input type="date" id="mDate" value="${plan?.date || todayISO()}"></div>
      <div><label class="f">Durée (min)</label><input type="number" id="mDur" min="5" max="600" value="${plan ? Math.round(wDur(plan.workoutId)/60) : 60}"></div>
      <div><label class="f">Puissance moyenne (W)</label><input type="number" id="mAvgP" placeholder="vide si dehors"></div>
      <div><label class="f">Puissance normalisée (W)</label><input type="number" id="mNP" placeholder="optionnel"></div>
      <div><label class="f">FC moyenne</label><input type="number" id="mHr"></div>
      <div><label class="f">FC max</label><input type="number" id="mHrMax"></div>
      <div><label class="f">Distance (km)</label><input type="number" id="mDist" step="0.1"></div>
      <div><label class="f">Meilleur 20 min (W)</label><input type="number" id="mB20" placeholder="test uniquement"></div>
    </div><div class="row" style="margin-top:12px"><button class="btn" id="mApply">Valider les chiffres</button></div></div>
    <div id="logStrava" class="hidden"><div class="note">La synchro automatique Strava arrive en V2 (connexion OAuth + webhook via Supabase). En attendant : sur Strava, ouvre l'activité › ⋯ › <b>Exporter l'original</b>, puis importe le fichier ici.</div></div>
    <div id="logResult"></div>`);
  $('#logMode').querySelectorAll('button').forEach(b => b.onclick = () => { $('#logMode').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); for (const m of ['file','manual','strava']) $('#log'+m[0].toUpperCase()+m.slice(1)).classList.toggle('hidden', b.dataset.m !== m); });
  const dz = $('#dropZone');
  dz.onclick = () => pickFile(handleFitFile);
  dz.ondragover = e => { e.preventDefault(); dz.style.borderColor = 'var(--accent)'; };
  dz.ondragleave = () => dz.style.borderColor = '';
  dz.ondrop = e => { e.preventDefault(); dz.style.borderColor = ''; const f = e.dataTransfer.files[0]; if (f) handleFitFile(f); };
  $('#mApply').onclick = () => {
    const dur = (+$('#mDur').value||0)*60; const avgP = +$('#mAvgP').value || null; const np = +$('#mNP').value || avgP;
    const a = { id:uid(), source:'manual', date: $('#mDate').value, name: plan ? WORKOUTS[plan.workoutId].name : 'Séance', durationS: dur, distanceKm: +$('#mDist').value || null,
      avgPower: avgP, np, maxPower:null, avgHr: +$('#mHr').value || null, maxHr: +$('#mHrMax').value || null, avgCad:null, hasPower: !!avgP,
      best: $('#mB20').value ? { m20: +$('#mB20').value } : (avgP && dur >= 1200 && plan && WORKOUTS[plan.workoutId].type==='test' ? null : null), feel:null, planId:null };
    _pending.act = a; showLogResult();
  };
}
async function handleFitFile(file){
  try {
    const fit = await FIT.readFile(file);
    const a = activityFromFit(fit, file.name);
    a._pw = powerSeries(fit.records.filter(r=>r.t!=null), 'pw'); a._hr = powerSeries(fit.records.filter(r=>r.t!=null), 'hr');
    if (!a.indoor) a._track = Tracks.fromRecords(fit.records);
    // doublon ?
    const dup = S.activities.find(x => x.startTs && x.startTs === a.startTs);
    if (dup) { toast('Cette activité est déjà importée'); return; }
    _pending.act = a;
    if (!_pending.planId) { // rattacher automatiquement à la séance prévue du même jour
      const near = autoPlanFor(a) || S.plan.find(s => s.status==='planned' && Math.abs(diffDays(s.date, a.date)) <= 1 && planFits(a, s));
      if (near) _pending.planId = near.id;
    }
    showLogResult();
  } catch(e){ console.error(e); toast('Lecture impossible : ' + e.message); }
}
function showLogResult(){
  const a = _pending.act; if (!a) return;
  const candidates = S.plan.filter(s => (s.status === 'planned' || s.id === _pending.planId) && Math.abs(diffDays(s.date, a.date)) <= 7);
  const planSel = `<select id="lPlan"><option value="">— Séance libre (hors plan) —</option>${candidates.map(s=>`<option value="${s.id}" ${s.id===_pending.planId?'selected':''}>${fmtShort(s.date)} · ${esc(WORKOUTS[s.workoutId].name)}</option>`).join('')}</select>`;
  const f = ftpAt(a.date);
  const np = a.np, IF = np ? (np/f) : null;
  const metrics = [
    ['Durée', fmtDur(a.durationS)], ['Distance', a.distanceKm!=null?`${a.distanceKm} km`:'—'],
    ['P. moy.', a.avgPower?`${a.avgPower} W`:'—'], ['NP', np?`${np} W`:'—'], ['IF', IF?IF.toFixed(2):'—'], ['TSS', np?tssFrom(a.durationS,np,f):(hrTSS(a.durationS,a.avgHr,S.profile.hrMax)??'—')],
    ['FC moy.', a.avgHr?`${a.avgHr}`:'—'], ['FC max', a.maxHr?`${a.maxHr}`:'—'],
  ];
  const bests = a.best ? [['5 s',a.best.s5],['1 min',a.best.m1],['5 min',a.best.m5],['20 min',a.best.m20]].filter(x=>x[1]) : [];
  const chips = (id, n, lab, labels) => `<label class="f">${lab}</label><div class="seg" data-feel="${id}">${Array.from({length:n},(_,i)=>`<button type="button" data-v="${i+1}" title="${labels?labels[i]:''}">${labels?labels[i]:i+1}</button>`).join('')}</div>`;
  $('#logResult').innerHTML = `<hr style="border:0;border-top:1px solid var(--line);margin:16px 0">
    <div class="row between"><h3>${esc(a.name)}</h3><span class="muted small">${fmtDate(a.date)}${a.indoor?' · home trainer':''}</span></div>
    <div class="grid4" style="margin:8px 0">${metrics.map(([l,v])=>`<div class="kpi"><div class="v num" style="font-size:22px">${v}</div><div class="l">${l}</div></div>`).join('')}</div>
    ${bests.length?`<div class="small muted">Meilleures puissances : ${bests.map(([l,v])=>`<b class="num" style="color:var(--text)">${v} W</b> ${l}`).join(' · ')}</div>`:''}
    ${a.pwSample?`<div style="margin-top:8px">${lineChart({ series:[{type:'area',pts:a.pwSample.map((v,i)=>[i,v]),color:'var(--accent)',opacity:.2},{pts:a.pwSample.map((v,i)=>[i,v]),color:'var(--accent)',width:1.2}, ...(a.hrSample?[{pts:a.hrSample.map((v,i)=>[i,v]),color:'var(--bad)',width:1}]:[])], xMin:0, xMax:a.pwSample.length-1, yMin:0, yMax:Math.max(...a.pwSample, 200)*1.05, h:150, yTicks:4 })}<div class="legend"><span><i style="background:var(--accent)"></i>Puissance (W)</span>${a.hrSample?'<span><i style="background:var(--bad)"></i>FC (bpm)</span>':''}</div></div>`:''}
    <label class="f">Rattacher à la séance prévue</label>${planSel}
    <div id="testBox"></div><div id="compBox" class="small" style="margin-top:8px"></div>
    <h3 style="margin-top:16px">Ressenti</h3>
    ${chips('rpe',10,'Effort perçu (RPE 1 = très facile · 10 = maximal)')}
    ${chips('legs',5,'Jambes',['Vides','Lourdes','Normales','Bonnes','Top'])}
    ${chips('breath',5,'Souffle',['Asphyxie','Dur','Correct','Facile','Aisé'])}
    ${chips('motivation',5,'Motivation',['Nulle','Faible','Moyenne','Bonne','À fond'])}
    <div class="grid2"><div><label class="f">Sommeil la nuit d'avant (h)</label><input type="number" id="lSleep" step="0.5" min="0" max="14"></div></div>
    <label class="f">Commentaire</label><textarea id="lNote" placeholder="Chaleur, ERG, douleurs, alimentation…"></textarea>
    <div class="row" style="margin-top:14px"><button class="btn primary" id="lSave">Enregistrer la séance</button></div>`;
  const feel = {};
  $('#logResult').querySelectorAll('.seg[data-feel]').forEach(seg => seg.querySelectorAll('button').forEach(b => b.onclick = () => { feel[seg.dataset.feel] = +b.dataset.v; seg.querySelectorAll('button').forEach(x=>x.classList.toggle('on', x===b)); showEval(); }));
  const updatePlanBits = () => {
    const pid = $('#lPlan').value; const pl = pid ? S.plan.find(s=>s.id===pid) : null;
    const isTest = pl && WORKOUTS[pl.workoutId].type === 'test';
    let tb = '';
    if (isTest && a.best) {
      const ramp = pl.workoutId === 'ramp';
      const val = ramp ? (a.best.m1 ? Math.round(a.best.m1*0.75) : null) : (a.best.m20 ? Math.round(a.best.m20*0.95) : null);
      if (val) tb = `<div class="note ok" style="margin-top:12px"><b>Test FTP :</b> ${ramp?`meilleure minute ${a.best.m1} W × 0,75`:`meilleur 20 min ${a.best.m20} W × 0,95`} = <b class="num">${val} W</b> (${(val/S.profile.weightKg).toFixed(2)} W/kg).
        <label class="row small" style="margin-top:8px;gap:8px"><input type="checkbox" id="lAcceptFtp" checked> Adopter <input type="number" id="lFtpVal" value="${val}" style="width:90px;min-height:32px;padding:4px 8px"> W comme nouvelle FTP (toutes les cibles futures sont recalculées)</label></div>`;
    }
    $('#testBox').innerHTML = tb;
    const c = pl && !isTest ? compliance(a, pl) : (a.blocks = null);
    a._comp = c; a._pl = pl && !isTest ? pl : null;
    showEval();
  };
  const showEval = () => { const pl = a._pl; if (!pl) { $('#compBox').innerHTML = ''; return; }
    const keep = a.feel; a.feel = feel; $('#compBox').innerHTML = evalHTML(a, pl).replace(/<button[^>]*data-feelact[^>]*>.*?<\/button>/, ''); a.feel = keep; };
  $('#lPlan').onchange = updatePlanBits; updatePlanBits();
  $('#lSave').onclick = () => {
    const pid = $('#lPlan').value || null;
    a.feel = { ...feel, sleep: +$('#lSleep').value || null, note: $('#lNote').value.trim() || null };
    a.compliance = a._comp || null; delete a._comp; delete a._pl; delete a._pw; delete a._hr;
    if (a._track) { Tracks.put(a.startTs, a._track, 'fit'); delete a._track; }
    const oldH = a.startTs ? replaceHealthDuplicate(a.startTs) : null;
    if (oldH?.feel && !Object.keys(a.feel).some(k => a.feel[k])) a.feel = oldH.feel;
    a.planId = pid; a.countAsSession = !pid && a.durationS >= 1800;
    if (pid) { const pl = S.plan.find(s=>s.id===pid); if (pl.activityId && pl.activityId !== a.id) { const old = S.activities.find(x=>x.id===pl.activityId); if (old) old.planId = null; } pl.status = 'done'; pl.activityId = a.id; }
    const acc = $('#lAcceptFtp');
    if (acc && acc.checked) { const v = +$('#lFtpVal').value; if (v) { S.ftpHistory.push({ date: a.date, ftp: v, source:'test', protocol: S.plan.find(s=>s.id===pid)?.workoutId }); S.ftpHistory.sort((x,y)=>x.date.localeCompare(y.date)); S.profile.ftp = S.ftpHistory[S.ftpHistory.length-1].ftp; S.profile.intensityAdj = 1; } }
    computeLoad(a);
    S.activities.push(a); save(); closeDlg(); render();
    toast(acc && acc.checked ? `Nouvelle FTP : ${S.profile.ftp} W 🎯` : 'Séance enregistrée 💪');
  };
}
const fmtKmh = v => v ? `${(+v).toFixed(1).replace('.', ',')}<small> km/h</small>` : '—';
// indicateurs de la fiche activité : vitesse et dénivelé pour les sorties extérieures
function actKpis(a){
  if (isIndoor(a)) return [['Durée',fmtDur(a.durationS)],['NP',a.np?a.np+' W':'—'],['TSS',a.tss??'—'],['FC moy.',a.avgHr??'—'],['P. moy.',a.avgPower?a.avgPower+' W':'—'],['IF',a.if??'—'],['FC max',a.maxHr??'—'],['Cadence',a.avgCad??'—']];
  const k = [['Durée',fmtDur(a.durationS)],['Distance',a.distanceKm!=null?`${String(a.distanceKm).replace('.',',')}<small> km</small>`:'—'],['Vitesse moy.',fmtKmh(speedOf(a))],['Vitesse max',fmtKmh(a.maxSpeed)],
    ['D+',a.elevM!=null?`${a.elevM}<small> m</small>`:'—'],['FC moy.',a.avgHr??'—'],['FC max',a.maxHr??'—'],['TSS',a.tss??'—']];
  if (a.hasPower) k.push(['NP',a.np?a.np+' W':'—'],['P. moy.',a.avgPower?a.avgPower+' W':'—'],['IF',a.if??'—'],['Cadence',a.avgCad??'—']);
  return k;
}
// corriger une activité : infos, type, rattachement au plan (une correction n'est jamais défaite par l'app)
function editActDlg(id){
  const a = S.activities.find(x => x.id === id); if (!a) return;
  const cands = S.plan.filter(s => (s.status === 'planned' || s.id === a.planId) && Math.abs(diffDays(s.date, a.date)) <= 7).sort((x,y) => x.date.localeCompare(y.date));
  const num = (id, lab, v, step=1, ph='') => `<div><label class="f" for="${id}">${lab}</label><input type="number" id="${id}" step="${step}" min="0" value="${v ?? ''}" placeholder="${ph}"></div>`;
  openDlg(`<h2>Modifier l'activité</h2>
    <label class="f" for="eName">Nom</label><input id="eName" value="${esc(a.name || '')}">
    <div class="grid2"><div><label class="f" for="eDate">Date</label><input type="date" id="eDate" value="${a.date}"></div>${num('eDur','Durée (min)', a.durationS ? Math.round(a.durationS/60) : '')}</div>
    <label class="f">Type</label><div class="seg" id="eIndoor"><button type="button" data-v="1" class="${isIndoor(a)?'on':''}">Home trainer</button><button type="button" data-v="0" class="${isIndoor(a)?'':'on'}">Extérieur</button></div>
    <div class="grid2">${num('eDist','Distance (km)', a.distanceKm, 0.1)}${num('eElev','D+ (m)', a.elevM)}${num('eVmoy','Vitesse moy. (km/h)', a.avgSpeed, 0.1, speedOf(a) ? String(speedOf(a)) : '')}${num('eVmax','Vitesse max (km/h)', a.maxSpeed, 0.1)}${num('eHr','FC moyenne', a.avgHr)}${num('eHrMax','FC max', a.maxHr)}</div>
    <label class="f" for="ePlan">Séance du plan</label><select id="ePlan"><option value="">— Aucune (séance libre) —</option>${cands.map(s => `<option value="${s.id}" ${s.id===a.planId?'selected':''}>${fmtShort(s.date)} · ${esc(WORKOUTS[s.workoutId].name)}${s.status==='done' && s.id!==a.planId?' (déjà faite)':''}</option>`).join('')}</select>
    <label class="row small" id="eCountRow" style="margin-top:8px;gap:8px"><input type="checkbox" id="eCount" ${a.countAsSession?'checked':''}> Compter comme une séance du programme</label>
    <div class="row" style="margin-top:14px"><button class="btn primary" id="eSave">Enregistrer</button><button class="btn ghost" id="eCancel">Annuler</button></div>`);
  let indoor = isIndoor(a);
  $('#eIndoor').querySelectorAll('button').forEach(b => b.onclick = () => { indoor = b.dataset.v === '1'; $('#eIndoor').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); });
  const syncCount = () => $('#eCountRow').classList.toggle('hidden', !!$('#ePlan').value); $('#ePlan').onchange = syncCount; syncCount();
  $('#eCancel').onclick = () => activityDlg(a.id);
  $('#eSave').onclick = () => {
    const v = id => { const x = $(id).value.trim(); return x === '' ? null : +x; };
    a.name = $('#eName').value.trim() || a.name; a.date = $('#eDate').value || a.date; a.indoor = indoor;
    if (v('#eDur') && v('#eDur') !== Math.round(a.durationS/60)) a.durationS = Math.round(v('#eDur')*60); // inchangée : on garde la durée exacte
    a.distanceKm = v('#eDist'); a.elevM = v('#eElev') != null ? Math.round(v('#eElev')) : null; a.avgSpeed = v('#eVmoy'); a.maxSpeed = v('#eVmax'); a.avgHr = v('#eHr'); a.maxHr = v('#eHrMax');
    const pid = $('#ePlan').value || null;
    if (pid !== a.planId) {
      const old = a.planId && S.plan.find(s => s.id === a.planId); if (old && old.activityId === a.id) { old.status = 'planned'; old.activityId = null; }
      a.planId = pid; a.blocks = null; a.compliance = null;
      if (pid) { const pl = S.plan.find(s => s.id === pid); if (pl.activityId && pl.activityId !== a.id) { const o = S.activities.find(x => x.id === pl.activityId); if (o) o.planId = null; } pl.status = 'done'; pl.activityId = a.id; a.compliance = compliance(a, pl); }
    }
    a.linkManual = true; a.countAsSession = !pid && $('#eCount').checked;
    computeLoad(a); save(); render(); activityDlg(a.id); toast('Activité modifiée');
  };
}
function activityDlg(id){
  const a = S.activities.find(x=>x.id===id); if (!a) return;
  const pl = a.planId ? S.plan.find(s=>s.id===a.planId) : null;
  const fe = a.feel || {};
  openDlg(`<span class="muted small">${fmtDate(a.date)} · ${ {fit:'fichier .fit', manual:'saisie manuelle', strava:'Strava', intervals:'Intervals.icu', health:'Apple Santé'}[a.source] || a.source }</span>
    <h2 style="margin:6px 0">${esc(pl ? WORKOUTS[pl.workoutId].name : a.name)}</h2>
    ${a.source==='health' ? `<p class="tiny muted" style="margin:0 0 6px">Venue d'Apple Santé (${isIndoor(a)?'home trainer':'extérieur'}, sans puissance). Si tu importes le .fit de cette sortie, il la remplacera automatiquement.</p><div class="row" style="margin-bottom:8px"><button class="btn sm" data-toggleindoor="${a.id}">Marquer comme ${isIndoor(a)?'extérieur':'home trainer'}</button></div>` : ''}
    ${!isIndoor(a) ? `<button class="btn primary" data-track3d="${a.id}" style="margin:4px 0 2px">🗺️ Tracé 3D · ▶</button>` : ''}
    <div class="grid4" style="margin:8px 0">${actKpis(a).map(([l,v])=>`<div class="kpi"><div class="v num" style="font-size:22px">${v}</div><div class="l">${l}</div></div>`).join('')}</div>
    ${a.best?`<div class="small muted">Records : ${[['5 s',a.best.s5],['1 min',a.best.m1],['5 min',a.best.m5],['20 min',a.best.m20]].filter(x=>x[1]).map(([l,v])=>`<b class="num" style="color:var(--text)">${v} W</b> ${l}`).join(' · ')}</div>`:''}
    ${ActChart.html(a)}
    ${pl ? evalHTML(a, pl) : ''}
    <p class="small">${fe.rpe?`RPE <b>${fe.rpe}</b>`:'Pas de ressenti'}${fe.legs?` · jambes ${fe.legs}/5`:''}${fe.breath?` · souffle ${fe.breath}/5`:''}${fe.motivation?` · motivation ${fe.motivation}/5`:''}${fe.sleep?` · ${fe.sleep} h de sommeil`:''}</p>
    ${fe.note?`<p class="small muted">« ${esc(fe.note)} »</p>`:''}
    <div class="row" style="margin-top:12px"><button class="btn sm" id="editAct">Modifier</button><button class="btn sm" data-feelact="${a.id}">${fe.rpe ? 'Modifier mon ressenti' : 'Ajouter mon ressenti'}</button><button class="btn sm danger" id="delAct">Supprimer l'activité</button></div>`);
  $('#editAct').onclick = () => editActDlg(a.id);
  $('#delAct').onclick = () => { if (pl) { pl.status = 'planned'; pl.activityId = null; } if (a.healthStart) (S.dismissedHealth ||= []).push(a.healthStart); S.activities = S.activities.filter(x=>x.id!==a.id); save(); closeDlg(); render(); toast('Activité supprimée'); };
}

// retire la version « Apple Santé » d'une sortie quand une version plus riche (puissance) arrive
function replaceHealthDuplicate(startTs){
  const old = S.activities.find(x => x.source === 'health' && x.startTs && Math.abs(x.startTs - startTs) < 1800);
  if (!old) return null;
  S.activities = S.activities.filter(x => x !== old);
  if (old.planId) { const pl = S.plan.find(s => s.id === old.planId); if (pl && pl.activityId === old.id) { pl.status = 'planned'; pl.activityId = null; } }
  return old;
}
