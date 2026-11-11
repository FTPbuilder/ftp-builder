"use strict";
// FTP Builder · Apple Santé via le Raccourci iOS, ressenti
/* ============ Apple Santé (via le Raccourci iOS) ============ */
const Health = (() => {
  const LS = 'ftpb_health_v1';
  let H = { daily: [], sleep: [], workouts: [], token: null, loadedAt: 0 };
  try { const r = localStorage.getItem(LS); if (r) H = Object.assign(H, JSON.parse(r)); } catch(e){}
  const persist = () => { try { localStorage.setItem(LS, JSON.stringify({ daily:H.daily, sleep:H.sleep, workouts:H.workouts, token:H.token })); } catch(e){} };
  const INGEST_URL = SB_URL + '/functions/v1/health-ingest';

  async function load(sb){
    if (!sb) return;
    const since = addDays(todayISO(), -130);
    const [d, s, w, t, g, ns] = await Promise.all([
      sb.from('health_daily').select('day, metric, value').gte('day', since).order('day'),
      sb.from('health_sleep').select('night, source, asleep_min, deep_min, rem_min, core_min, awake_min, in_bed_min, bed_start, bed_end').gte('night', since).order('night'),
      sb.from('health_workouts').select('start_at, end_at, type, duration_min, distance_km, energy_kcal, avg_hr, source, indoor, elevation_m, avg_speed_kmh, max_speed_kmh').gte('start_at', since).order('start_at'),
      sb.rpc('ingest_status'),
      sb.from('health_sleep_seg').select('start_at, end_at, stage, source').gte('end_at', addDays(todayISO(), -15)).order('start_at'), // phases détaillées (hypnogramme, cycles)
      sb.from('health_samples').select('metric, at, value').gte('at', addDays(todayISO(), -15)).order('at').limit(20000), // FC / respiration de la nuit
    ]);
    if (!d.error) H.daily = d.data; if (!s.error) H.sleep = s.data; if (!w.error) H.workouts = w.data; if (g && !g.error) H.segs = g.data;
    if (ns && !ns.error) H.samples = ns.data;
    promoteBikes();
    H.token = t.data && t.data.length ? { last: t.data[0].last_used_at } : null;
    persist();
  }
  // séries utilitaires
  const series = m => H.daily.filter(x => x.metric === m).map(x => [x.day, x.value]);
  const valOn = (m, day) => H.daily.find(x => x.metric === m && x.day === day)?.value ?? null;
  const latest = m => { const s = series(m); return s.length ? s[s.length-1] : null; };
  function stats(m, upto, days=60){
    const vals = H.daily.filter(x => x.metric === m && x.day < upto && x.day >= addDays(upto, -days)).map(x => x.value);
    if (vals.length < 7) return null;
    const mean = vals.reduce((a,b)=>a+b,0)/vals.length, sd = Math.sqrt(vals.reduce((a,b)=>a+(b-mean)**2,0)/vals.length) || 1;
    return { mean, sd, n: vals.length };
  }
  // Indice de forme 0-100 : VFC (ln, vs 60 j), FC repos, sommeil (nuit + 3 nuits), équilibre de charge (TSB)
  function score(day = todayISO()){
    const parts = [];
    const hrv = valOn('hrv', day) ?? valOn('hrv', addDays(day,-1));
    const hs = (() => { const vals = H.daily.filter(x => x.metric==='hrv' && x.day < day && x.day >= addDays(day,-60)).map(x => Math.log(x.value)); if (vals.length < 7) return null; const m = vals.reduce((a,b)=>a+b,0)/vals.length; return { m, sd: Math.sqrt(vals.reduce((a,b)=>a+(b-m)**2,0)/vals.length) || 0.1 }; })();
    if (hrv != null && hs) { const z = (Math.log(hrv) - hs.m) / hs.sd; parts.push({ k:'VFC', w:.35, s: clamp(60 + z*22, 0, 100), d:`${Math.round(hrv)} ms vs ${Math.round(Math.exp(hs.m))} habituel` }); }
    const rhr = valOn('rhr', day) ?? valOn('rhr', addDays(day,-1)), rs = stats('rhr', day);
    if (rhr != null && rs) { const d = rhr - rs.mean; parts.push({ k:'FC repos', w:.2, s: clamp(75 - d*9, 0, 100), d:`${Math.round(rhr)} bpm (${d>=0?'+':''}${d.toFixed(0)})` }); }
    const sl = sleepOn(day);
    if (sl && sl.asleep_min) {
      const last3 = [0,1,2].map(i => sleepOn(addDays(day,-i))?.asleep_min).filter(Boolean);
      const avg3 = last3.reduce((a,b)=>a+b,0)/last3.length;
      const f = m => clamp((m/60 - 5) / 3 * 100, 0, 100); // 5 h = 0, 8 h = 100
      parts.push({ k:'Sommeil', w:.25, s: f(sl.asleep_min)*0.6 + f(avg3)*0.4, d:`${fmtDur(sl.asleep_min*60)} cette nuit, ${fmtDur(avg3*60)} sur 3 nuits` });
    }
    const L = loadSeries(); const l = L.find(x => x.d === day) || L[L.length-1];
    if (l && (S.activities.length || H.workouts.length)) parts.push({ k:'Charge', w:.2, s: clamp(65 + l.tsb*1.6, 0, 100), d:`forme (TSB) ${Math.round(l.tsb)}` });
    if (!parts.some(p => p.k === 'VFC' || p.k === 'Sommeil')) return null;
    const W = parts.reduce((a,p)=>a+p.w,0); const v = Math.round(parts.reduce((a,p)=>a+p.s*p.w,0)/W);
    return { v, parts, level: v >= 75 ? 'ok' : v >= 55 ? 'mid' : v >= 40 ? 'warn' : 'bad' };
  }
  function baseline(m, upto, days=30){
    const vals = H.daily.filter(x => x.metric === m && x.day < upto && x.day >= addDays(upto, -days)).map(x => x.value);
    if (vals.length < 4) return null; return vals.reduce((a,b)=>a+b,0)/vals.length;
  }
  const sleepOn = day => H.sleep.find(s => s.night === day) || null;
  // 5 derniers jours d'un indicateur (+ moyenne 30 j) pour les graphiques des fiches « Forme du jour »
  function trend(kind, n = 5){
    const t = todayISO(); const days = Array.from({ length: n }, (_, i) => addDays(t, i - n + 1));
    if (kind === 'score') return days.map(d => ({ d, v: score(d)?.v ?? null, base: null }));
    if (kind === 'sleep') { const b = H.sleep.filter(x => x.night < t && x.night >= addDays(t, -30) && x.asleep_min).map(x => x.asleep_min/60);
      return days.map(d => ({ d, v: sleepOn(d)?.asleep_min ? sleepOn(d).asleep_min/60 : null, base: b.length >= 4 ? b.reduce((a, x) => a + x, 0)/b.length : null })); }
    return days.map(d => ({ d, v: valOn(kind, d), base: baseline(kind, t) }));
  }

  // sport -> catégorie + TSS estimé
  function sportOf(type){
    const t = (type||'').toLowerCase();
    if (/vélo|velo|cycl|bike|ride|vtt/.test(t)) return 'bike';
    if (/course|run|trail|jogging/.test(t)) return 'run';
    if (/nata|swim|piscine|eau libre/.test(t)) return 'swim';
    if (/renfo|force|muscu|strength|fonctionnel|hiit|core|training/.test(t)) return 'strength';
    if (/marche|walk|randonn|hiking/.test(t)) return 'walk';
    if (/yoga|pilates|étirement|mobilit|stretch/.test(t)) return 'mobility';
    return 'other';
  }
  const IF_GUESS = { run:0.78, swim:0.72, strength:0.6, walk:0.45, mobility:0.4, bike:0.7, other:0.65 };
  const ICON = { run:'🏃', swim:'🏊', strength:'🏋️', walk:'🚶', mobility:'🧘', bike:'🚴', other:'⏱️' };
  const LABEL = { run:'Course', swim:'Natation', strength:'Renfo', walk:'Marche', mobility:'Mobilité', bike:'Vélo', other:'Autre' };
  function wTss(w){
    const min = w.duration_min || (w.end_at ? (Date.parse(w.end_at)-Date.parse(w.start_at))/60000 : 0);
    const sp = sportOf(w.type);
    const hrMax = S.profile?.hrMax;
    if (w.avg_hr && hrMax && sp !== 'swim') return Math.round(min/60 * Math.pow(w.avg_hr/(0.9*hrMax), 2) * 100);
    return Math.round(min/60 * Math.pow(IF_GUESS[sp], 2) * 100);
  }
  // séances Santé à ajouter à la charge (sauf vélos déjà importés dans l'app)
  const bikeIndoor = w => w.indoor ?? /home trainer|intérieur|indoor|virtual|zwift|mywhoosh|rouvy/i.test(`${w.type} ${w.source}`);
  function fillSpeed(a, w){
    let ch = false;
    if (a.elevM == null && w.elevation_m != null) { a.elevM = Math.round(w.elevation_m); ch = true; }
    if (a.maxSpeed == null && w.max_speed_kmh) { a.maxSpeed = +(+w.max_speed_kmh).toFixed(1); ch = true; }
    if (a.avgSpeed == null && w.avg_speed_kmh) { a.avgSpeed = +(+w.avg_speed_kmh).toFixed(1); ch = true; }
    return ch;
  }
  function promoteBikes(){
    if (!S.profile) return 0;
    let n = 0;
    for (const w of H.workouts) {
      if (sportOf(w.type) !== 'bike') continue;
      const date = iso(new Date(w.start_at)); if (date < S.profile.startDate) continue;
      const start = Math.floor(Date.parse(w.start_at)/1000);
      if (S.activities.some(a => a.healthStart === w.start_at || (a.startTs && Math.abs(a.startTs - start) < 1800) || (!a.startTs && a.date === date && a.source === 'manual'))) continue;
      if ((S.dismissedHealth || []).includes(w.start_at)) continue;
      const a = { id: uid(), source:'health', healthStart: w.start_at, date, startTs: start, name: `${w.type || 'Vélo'}${w.source ? ' · ' + w.source : ''}`,
        durationS: Math.round((w.duration_min || 0) * 60), distanceKm: w.distance_km ? +(+w.distance_km).toFixed(1) : null, avgHr: w.avg_hr ? Math.round(w.avg_hr) : null,
        maxHr: null, avgPower: null, np: null, hasPower: false, indoor: bikeIndoor(w), best: null, feel: null };
      fillSpeed(a, w);
      const pl = autoPlanFor(a);
      if (pl) { a.planId = pl.id; pl.status = 'done'; pl.activityId = a.id; } else a.countAsSession = a.durationS >= 1800;
      computeLoad(a); if (a.tss == null) a.tss = wTss(w);
      S.activities.push(a); n++;
    }
    // complète vitesses et D+ des sorties déjà présentes (.fit, Apple Santé) quand la synchro les apporte
    let m = 0;
    for (const a of S.activities) {
      if (!a.startTs || (a.elevM != null && a.maxSpeed != null)) continue;
      const w = H.workouts.find(w => sportOf(w.type) === 'bike' && Math.abs(Date.parse(w.start_at)/1000 - a.startTs) < 1800);
      if (w && fillSpeed(a, w)) m++;
    }
    const fixed = repairAutoLinks();
    if (n || m || fixed) save();
    if (n) toast(`${n} sortie${n>1?'s':''} vélo ajoutée${n>1?'s':''} depuis Apple Santé`);
    return n;
  }
  function extraWorkouts(){
    return H.workouts.map(w => {
      const start = Math.floor(Date.parse(w.start_at)/1000), date = iso(new Date(w.start_at));
      const sp = sportOf(w.type);
      if (sp === 'bike' && S.activities.some(a => (a.startTs && Math.abs(a.startTs - start) < 1800) || (!a.startTs && a.date === date))) return null;
      return { date, sport: sp, tss: wTss(w), w };
    }).filter(Boolean);
  }

  // indicateur de forme du jour
  function readiness(day = todayISO()){
    const out = { items: [], bad: 0, warn: 0 };
    const hrv = valOn('hrv', day) ?? valOn('hrv', addDays(day,-1)), hrvB = baseline('hrv', day);
    if (hrv != null) { const r = hrvB ? hrv/hrvB : null; const st = r == null ? '' : r >= 0.95 ? 'ok' : r >= 0.85 ? 'warn' : 'bad';
      out.items.push({ l:'VFC', v:`${Math.round(hrv)} ms`, sub: hrvB ? `moy. 30 j ${Math.round(hrvB)}` : 'référence en construction', st }); }
    const rhr = valOn('rhr', day) ?? valOn('rhr', addDays(day,-1)), rhrB = baseline('rhr', day);
    if (rhr != null) { const d = rhrB ? rhr - rhrB : null; const st = d == null ? '' : d <= 2 ? 'ok' : d <= 5 ? 'warn' : 'bad';
      out.items.push({ l:'FC repos', v:`${Math.round(rhr)} bpm`, sub: rhrB ? `${d>=0?'+':''}${d.toFixed(0)} vs moy.` : 'référence en construction', st }); }
    const sl = sleepOn(day);
    if (sl && sl.asleep_min) { const hh = sl.asleep_min/60; const st = hh >= 7 ? 'ok' : hh >= 6 ? 'warn' : 'bad';
      out.items.push({ l:'Sommeil', v:`${Math.floor(hh)}h${pad(Math.round(sl.asleep_min%60))}`, sub: sl.deep_min||sl.rem_min ? `profond ${fmtDur((sl.deep_min||0)*60)} · paradoxal ${fmtDur((sl.rem_min||0)*60)}` : esc(sl.source||''), st }); }
    const wt = latest('weight');
    if (wt) out.items.push({ l:'Poids', v:`${wt[1].toFixed(1)} kg`, sub: wt[0] === day ? "aujourd'hui" : fmtShort(wt[0]), st:'' });
    for (const i of out.items) { if (i.st === 'bad') out.bad++; if (i.st === 'warn') out.warn++; }
    out.level = !out.items.some(i=>i.st) ? 'none' : out.bad >= 2 ? 'bad' : (out.bad === 1 || out.warn >= 2) ? 'warn' : 'ok';
    return out;
  }
  function todayCard(){
    if (!H.daily.length && !H.sleep.length) return '';
    const r = readiness();
    if (!r.items.length) return '';
    const msg = { ok:"Feu vert : tu es récupéré, fais la séance comme prévue.", warn:"Récupération moyenne : garde la séance, mais baisse les cibles de 3 à 5 % si les jambes ne répondent pas à l'échauffement.", bad:"Récupération faible : remplace la séance clé par de l'endurance ou décale-la de 24 h.", none:"Encore quelques jours de données et je pourrai comparer à tes valeurs habituelles." }[r.level];
    const col = { ok:'var(--ok)', warn:'var(--warn)', bad:'var(--bad)', '':'var(--muted)' };
    const p = S.profile; const wt = latest('weight');
    const wNote = wt && p && Math.abs(wt[1] - p.weightKg) >= 0.5 ? `<div class="row" style="margin-top:10px"><span class="small muted">Ton poids Santé (${wt[1].toFixed(1)} kg) diffère de ton profil (${p.weightKg} kg).</span><button class="btn sm" data-hweight="${wt[1].toFixed(1)}">Mettre à jour</button></div>` : '';
    const sc = score();
    const scCol = sc ? battCol(sc.v) : 'var(--muted)';
    const scTxt = sc ? { ok:"Fais la séance comme prévue, c'est un bon jour pour pousser.", mid:"Séance prévue, sans chercher à dépasser les cibles.", warn:"Garde la séance mais baisse les cibles de 3 à 5 %, ou raccourcis le bloc principal.", bad:"Remplace la séance clé par de l'endurance ou décale-la de 24 h." }[sc.level] : msg;
    const gauge = sc ? `<div class="row" style="gap:16px;margin-bottom:12px;cursor:pointer" data-i="score">
        ${batterySVG(sc.v)}
        <div style="flex:1;min-width:150px"><div class="disp" style="font-size:22px;font-weight:700;color:${scCol};text-transform:uppercase">${ {ok:'Prêt',mid:'Correct',warn:'Prudence',bad:'Récupère'}[sc.level] } <span class="tiny muted" style="text-transform:none;font-family:Inter,sans-serif;font-weight:500">· détail ⓘ</span></div><div class="small">${scTxt}</div></div></div>` : '';
    return `<div class="card"><div class="row between"><h2>Énergie du jour</h2><span class="chip" style="color:${col[r.level==='none'?'':r.level]}">● ${ {ok:'Récupéré',warn:'Moyen',bad:'Fatigué',none:'Apple Santé'}[r.level] }</span></div>
      ${gauge}<div class="grid4">${r.items.map(i=>`<div class="kpi"><div class="v num" style="font-size:24px;color:${i.st?col[i.st]:'var(--text)'}">${i.v}</div><div class="l">${i.l}</div><div class="tiny muted" style="margin-top:2px">${i.sub}</div></div>`).join('')}</div>
      ${sc ? '' : `<p class="small" style="margin:10px 0 0">${msg}</p>`}${wNote}
      ${H.daily.filter(x => x.metric === 'hrv' && x.day >= addDays(todayISO(), -60)).length < 21 ? `<p class="tiny muted" style="margin:10px 0 0">Pour un indice fiable dès aujourd'hui, importe ton historique Santé (Profil › Apple Santé) : il faut ~3 semaines de VFC pour connaître ta normale.</p>` : ''}</div>`;
  }
  function progressCards(){
    if (!H.daily.length && !H.sleep.length && !H.workouts.length) return '';
    let h = '';
    const t = todayISO(), from = addDays(t, -42);
    const hrv = series('hrv').filter(x => x[0] >= from), rhr = series('rhr').filter(x => x[0] >= from);
    if (hrv.length >= 3 || rhr.length >= 3) {
      const X = d => parseD(d).getTime(); const all = [...hrv.map(x=>x[1]), ...rhr.map(x=>x[1])];
      const xl = []; for (let i=0;i<=3;i++){ const d = addDays(from, Math.round(42*i/3)); xl.push([X(d), fmtShort(d)]); }
      h += `<div class="card"><h2>Récupération (6 sem.)</h2>${lineChart({ series:[ { pts: hrv.map(x=>[X(x[0]),x[1]]), color:'var(--z3)', width:2 }, { type:'dots', pts: hrv.slice(-1).map(x=>[X(x[0]),x[1],Math.round(x[1])+' ms']), color:'var(--z3)' }, { pts: rhr.map(x=>[X(x[0]),x[1]]), color:'var(--bad)', width:1.5 } ], xMin:X(from), xMax:X(t), yMin: Math.floor(Math.min(...all, 40)/10)*10, yMax: Math.ceil(Math.max(...all)/10)*10+10, xLabels:xl, h:170 })}
        <div class="legend"><span><i style="background:var(--z3)"></i>VFC (ms)</span><span><i style="background:var(--bad)"></i>FC repos (bpm)</span></div>`;
      const nights = H.sleep.filter(s => s.night >= addDays(t,-14));
      if (nights.length) h += `<div style="display:flex;align-items:flex-end;gap:4px;height:70px;margin-top:14px">${nights.map(s=>`<div title="${fmtShort(s.night)} · ${fmtDur(s.asleep_min*60)}" style="flex:1;max-width:24px;height:${clamp(s.asleep_min/600*100,5,100)}%;border-radius:4px 4px 0 0;background:${s.asleep_min>=420?'var(--z2)':s.asleep_min>=360?'var(--warn)':'var(--bad)'}"></div>`).join('')}</div><div class="tiny muted" style="margin-top:4px">Sommeil des 14 dernières nuits · moyenne ${fmtDur(nights.reduce((a,s)=>a+s.asleep_min,0)/nights.length*60)}</div>`;
      h += `</div>`;
    }
    return h;
  }
  // autres sports : tout en bas de Progression, 3 dernières séances puis « + Découvrir »
  let sportsOpen = false;
  document.addEventListener('click', e => { if (e.target.closest('[data-sportsmore]')) { sportsOpen = !sportsOpen; render(); } });
  function otherSportsHTML(){
    if (!S.profile) return ''; const t = todayISO(); let h = '';
    const exm = exerciseLoad().filter(x => x.date >= addDays(t,-13));
    if (exm.length && !H.workouts.length) h += `<div class="card"><h2>Autres sports</h2><div style="display:flex;align-items:flex-end;gap:4px;height:70px">${exm.map(x=>`<div title="${fmtShort(x.date)} · ${x.minutes} min" style="flex:1;max-width:24px;height:${clamp(x.minutes/120*100,5,100)}%;border-radius:4px 4px 0 0;background:var(--z3)"></div>`).join('')}</div>
      <p class="tiny muted" style="margin:6px 0 0">Minutes d'exercice Apple Santé hors vélo, 14 derniers jours : ${exm.reduce((a,x)=>a+x.minutes,0)} min. Comptées dans ta forme/fatigue (~0,9 TSS/min).</p></div>`;
    const ex = extraWorkouts().slice(-30).reverse();
    if (ex.length) {
      const week = ex.filter(e => e.date >= addDays(t,-6));
      const bySport = {}; for (const e of week) bySport[e.sport] = (bySport[e.sport]||0) + (e.w.duration_min||0);
      h += `<div class="card"><h2>Autres sports</h2>${Object.keys(bySport).length?`<div class="row" style="margin-bottom:8px">${Object.entries(bySport).map(([s,m])=>`<span class="chip">${ICON[s]} ${LABEL[s]} ${fmtDur(m*60)} / 7 j</span>`).join('')}</div>`:''}
        ${ex.slice(0, sportsOpen ? 30 : 3).map(e=>`<div class="hist"><span style="font-size:20px">${ICON[e.sport]}</span><div style="flex:1;min-width:0"><b>${esc(e.w.type||LABEL[e.sport])}</b><div class="tiny muted">${fmtDate(e.date)} · ${fmtDur((e.w.duration_min||0)*60)}${e.w.distance_km?` · ${(+e.w.distance_km).toFixed(1)} km`:''}${e.w.avg_hr?` · ${Math.round(e.w.avg_hr)} bpm`:''} · ${esc(e.w.source||'')}</div></div><span class="chip num">TSS ~${e.tss}</span></div>`).join('')}
        ${ex.length > 3 ? `<button class="btn ghost more" data-sportsmore>${sportsOpen ? '− Réduire' : `+ Découvrir (${ex.length})`}</button>` : ''}
        <p class="tiny muted" style="margin:8px 0 0">Ces séances comptent dans ta forme/fatigue (TSS estimé à la FC ou selon le sport).</p></div>`;
    }
    return h;
  }
  function settingsHTML(){
    const sb = Cloud.sb;
    if (!sb || !Cloud.user) return '';
    const last = H.token?.last ? new Date(H.token.last) : null;
    return `<div class="card"><div class="row between"><h2>Apple Santé</h2><a class="small" href="raccourci.html">Guide du raccourci</a></div>
      <p class="small muted" style="margin-top:0">Un Raccourci iOS envoie chaque jour sommeil, VFC, FC repos, poids et entraînements (montre, Withings, Strava, Garmin Connect…) vers l'app.</p>
      <p class="small">${H.token ? (last ? `Dernier envoi : <b>${last.toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'})}</b>` : 'Clé créée, aucun envoi reçu pour l’instant.') : 'Aucune clé pour l’instant.'}</p>
      <div id="hKeyBox"></div>
      <div class="row"><button class="btn primary" id="hKeyBtn">${H.token ? 'Générer une nouvelle clé' : 'Générer ma clé'}</button><button class="btn ghost" id="hReload">Actualiser</button></div>
      <hr style="border:0;border-top:1px solid var(--line);margin:16px 0">
      <h3>Importer ton historique</h3>
      <p class="small muted" style="margin-top:0">Une fois : 4 mois de VFC, FC repos, sommeil, poids, VO2max et toutes tes séances, pour calibrer ton énergie du jour et ta fitness.</p>
      <ol class="small" style="padding-left:20px;margin:6px 0 10px"><li>App <b>Santé</b> › ta photo en haut à droite › <b>Exporter toutes les données de santé</b> › Exporter (1 à 5 min).</li><li>Choisis <b>Enregistrer dans Fichiers</b>.</li><li>Ici : <b>Choisir export.zip</b> (ou export.xml si tu l'as décompressé).</li></ol>
      <button class="btn" id="hImportBtn">Choisir export.zip</button><div id="hImportBox" class="small" style="margin-top:10px">${HealthImport.last || (S.healthImportedAt ? `<span class="muted">Dernier import : ${new Date(S.healthImportedAt).toLocaleDateString('fr-FR')}</span>` : '')}</div></div>`;
  }
  async function genKey(btn){
    const sb = Cloud.sb, box = $('#hKeyBox');
    if (!sb || !Cloud.user) { box.innerHTML = '<div class="note bad">Connecte-toi d’abord (carte Compte ci-dessus).</div>'; return; }
    btn.disabled = true; btn.textContent = 'Génération…';
    let data, error;
    try { ({ data, error } = await sb.rpc('create_ingest_token')); } catch(e) { error = e; }
    btn.disabled = false; btn.textContent = 'Générer une nouvelle clé';
    if (error || !data) { box.innerHTML = `<div class="note bad">Impossible de générer la clé : ${esc(error?.message || 'réponse vide')}. Vérifie ta connexion et réessaie.</div>`; return; }
    H.token = { last: null }; persist();
    $('#hKeyBox').innerHTML = `<div class="note" style="margin-top:8px"><b>Ta clé (affichée une seule fois) :</b>
      <div class="num small" style="word-break:break-all;margin:6px 0;user-select:all">Bearer ${data}</div>
      <div class="row"><button class="btn sm" data-copy="Bearer ${data}">Copier « Bearer … »</button></div>
      <div class="small" style="margin-top:10px"><b>Adresse :</b> <span class="num" style="word-break:break-all;user-select:all">${INGEST_URL}</span></div>
      <div class="row" style="margin-top:6px"><button class="btn sm" data-copy="${INGEST_URL}">Copier l'adresse</button></div>
      <p class="tiny muted" style="margin:8px 0 0">Colle-les dans le raccourci (voir le guide). Ne partage pas cette clé : elle permet d'écrire dans tes données. Générer une nouvelle clé désactive l'ancienne.</p></div>`;
    box.scrollIntoView({ behavior:'smooth', block:'center' });
  }
  document.addEventListener('click', async e => {
    const b = e.target.closest('#hKeyBtn,#hReload,#hImportBtn,[data-copy],[data-hweight]'); if (!b) return;
    if (b.id === 'hImportBtn') { pickFile(f => HealthImport.run(f, $('#hImportBox'))); return; }
    if (b.id === 'hKeyBtn') genKey(b);
    else if (b.id === 'hReload') { await load(Cloud.sb); render(); toast('Données Santé actualisées'); }
    else if (b.dataset.copy) { try { await navigator.clipboard.writeText(b.dataset.copy); toast('Copié'); } catch(err){ toast('Sélectionne le texte et copie-le'); } }
    else if (b.dataset.hweight) { S.profile.weightKg = +b.dataset.hweight; save(); render(); toast('Poids mis à jour'); }
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Cloud.user && Date.now() - H.loadedAt > 60000) { H.loadedAt = Date.now(); load(Cloud.sb).then(render); } });
  // plan B : minutes d'exercice du jour (Apple Santé) moins le temps des séances vélo déjà dans l'app
  function exerciseLoad(){
    const out = [];
    for (const x of H.daily.filter(x => x.metric === 'exercise_min')) {
      if (H.workouts.some(w => iso(new Date(w.start_at)) === x.day)) continue; // séances détaillées déjà comptées
      const bikeMin = S.activities.filter(a => a.date === x.day).reduce((s,a) => s + (a.durationS||0)/60, 0);
      const extra = x.value - bikeMin;
      if (extra >= 10) out.push({ date: x.day, minutes: Math.round(extra), tss: Math.round(extra * 0.9) });
    }
    return out;
  }
  return { load, todayCard, progressCards, otherSportsHTML, settingsHTML, extraWorkouts, readiness, exerciseLoad, score, trend, promoteBikes, bikeIndoor, sportOf, get H(){ return H; }, persist };
})();

// ressenti a posteriori (activité importée ou correction) : pré-rempli, verdict affiché à l'enregistrement
function feelDlg(id){
  const a = S.activities.find(x => x.id === id); if (!a) return;
  const chips = (k, n, lab, labels) => `<label class="f">${lab}</label><div class="seg" data-feel="${k}">${Array.from({length:n},(_,i)=>`<button type="button" data-v="${i+1}">${labels?labels[i]:i+1}</button>`).join('')}</div>`;
  openDlg(`<h2>${esc(a.name)}</h2><p class="muted small">${fmtDate(a.date)} · ${fmtDur(a.durationS)}${a.np?` · NP ${a.np} W`:''}${a.avgHr?` · ${a.avgHr} bpm`:''}</p>
    ${chips('rpe',10,'Effort perçu (RPE)')}${chips('legs',5,'Jambes',['Vides','Lourdes','Normales','Bonnes','Top'])}${chips('breath',5,'Souffle',['Asphyxie','Dur','Correct','Facile','Aisé'])}${chips('motivation',5,'Motivation',['Nulle','Faible','Moyenne','Bonne','À fond'])}
    <label class="f" for="fNote">Commentaire</label><textarea id="fNote">${esc(a.feel?.note || '')}</textarea>
    <div class="row" style="margin-top:12px"><button class="btn primary" id="fSave">Enregistrer</button></div>`);
  const feel = { ...(a.feel || {}) }; delete feel.note;
  dlgBody.querySelectorAll('.seg[data-feel]').forEach(seg => seg.querySelectorAll('button').forEach(b => { if (feel[seg.dataset.feel] === +b.dataset.v) b.classList.add('on'); b.onclick = () => { feel[seg.dataset.feel] = +b.dataset.v; seg.querySelectorAll('button').forEach(x=>x.classList.toggle('on', x===b)); }; }));
  $('#fSave').onclick = () => { a.feel = { ...feel, note: $('#fNote').value.trim() || null }; if (!a.np) computeLoad(a); save(); closeDlg(); render();
    const pl = a.planId ? S.plan.find(s=>s.id===a.planId) : null, e = pl ? sessionEval(a, pl) : null;
    toast(e ? `${e.icon} ${e.title}` : 'Ressenti enregistré'); };
}
