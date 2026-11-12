"use strict";
// FTP Builder · Supabase (compte, synchro), Strava, Intervals.icu
/* ============ cloud : Supabase (compte, synchro) + Strava ============ */
const Cloud = (() => {
  const sb = window.supabase ? window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, detectSessionInUrl: true, flowType: 'pkce' } }) : null;
  let session = null, pushTimer = null, strava = { connected: false }, busy = false, ready = false; // ready : compte et connexions vérifiés (le guide attend ce moment)
  const appUrl = () => location.origin + location.pathname;
  // Intervals.icu exige une adresse de retour identique au caractère près : toujours la racine de l'app, sans index.html
  const icuRedirect = () => location.origin + location.pathname.replace(/index\.html$/, '');
  const user = () => session?.user || null;

  async function init(){
    if (!sb) { ready = true; render(); window.splashReady?.(); return; }
    const { data } = await sb.auth.getSession(); session = data.session;
    if (!session) { ready = true; render(); window.splashReady?.(); }
    sb.auth.onAuthStateChange((ev, s) => { const was = !!session; session = s; if (s && !was) afterLogin(); if (!s && was) { strava = { connected:false }; pulled = false; hold = false; render(); } });
    await handleStravaReturn();
    await handleIcuReturn();
    if (session) await afterLogin();
  }
  async function afterLogin(){
    await pull();
    await refreshStrava();
    await refreshIcu();
    ready = true; render(); // connexions connues : le guide peut s'afficher juste
    await importInbox();
    if (icu.connected) await autoIcu();
    await Health.load(sb);
    render(); window.splashReady?.(); // données là : l'écran d'ouverture peut s'effacer
    Social.load().then(() => { if (TAB === 'today' && TODAY_PANE === 'defis') render(); });
    Tour.maybe(); // visite guidée : une fois, juste après l'authentification
  }
  /* ----- Intervals.icu ----- */
  let icu = { connected:false }, icuBusy = false;
  async function refreshIcu(){
    if (!user()) return;
    const { data } = await sb.rpc('intervals_status');
    icu = data && data.length ? { connected:true, ...data[0] } : { connected:false };
  }
  async function icuCall(body){
    const { data, error } = await sb.functions.invoke('intervals', { body });
    if (error || data?.error) {
      let msg = data?.error || error?.message || 'erreur';
      try { const ctx = await error?.context?.json?.(); if (ctx?.error) msg = ctx.error; } catch(e){}
      throw new Error(msg);
    }
    return data;
  }
  // synchro silencieuse : au plus toutes les 15 min, et envoi du plan s'il a changé
  async function autoIcu(force=false){
    if (icuBusy || !icu.connected) return;
    const last = S.icuLastAuto || 0;
    if (!force && S.icuBackfill === 2 && Date.now() - last < 15*60000) return;
    icuBusy = true; S.icuLastAuto = Date.now();
    try {
      // une fois (puis à chaque synchro manuelle) : 4 mois d'historique pour récupérer les anciennes sorties avec leurs flux et tracés
      const deep = force || S.icuBackfill !== 2;
      const r = await icuCall({ action:'sync', days: deep ? 120 : 14 });
      const n = await importExt();
      if (deep && S.icuBackfill !== 2) { S.icuBackfill = 2; save(); }
      await Health.load(sb);
      const pushed = await pushPlan(false);
      if (force) toast(`Intervals : ${n} séance${n>1?'s':''} vélo importée${n>1?'s':''}, ${r.others} autre${r.others>1?'s':''} activité${r.others>1?'s':''}${pushed ? `, ${pushed} séance${pushed>1?'s':''} envoyée${pushed>1?'s':''} au calendrier` : ''}`);
      else if (n) toast(`${n} séance${n>1?'s':''} importée${n>1?'s':''} depuis Intervals.icu`);
      await refreshIcu();
    } catch(e) { if (force) toast('Intervals : ' + e.message); console.warn('icu', e); }
    finally { icuBusy = false; render(); }
  }
  // texte de séance au format Intervals.icu (lisible dans leur calendrier)
  function icuText(wid){
    const d = s => { const m = Math.floor(s/60), r = Math.round(s%60); return m ? `${m}m${r?r+'s':''}` : `${r}s`; };
    const line = s => `- ${s.max ? 'À FOND ' : ''}${s.label && !s.max ? s.label + ' ' : ''}${d(s.d)} ${s.p}%${s.cad ? ' ' + s.cad + 'rpm' : ''}`;
    const out = [];
    for (const s of WORKOUTS[wid].steps) {
      if (!s.repeat) { out.push(line(s)); continue; }
      const inner = s.steps.some(x => x.repeat);
      if (inner) for (let k=0;k<s.repeat;k++) for (const x of s.steps) { if (x.repeat) { out.push('', `${x.repeat}x`, ...x.steps.map(line), ''); } else out.push(line(x)); }
      else out.push('', `${s.repeat}x`, ...s.steps.map(line), '');
    }
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  const b64 = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
  // envoie les 4 prochaines semaines ; retire du calendrier Intervals ce qui a été sauté/supprimé
  async function pushPlan(force=true){
    if (!icu.connected || !S.profile) return 0;
    const t = todayISO(), until = addDays(t, 28);
    const items = S.plan.filter(s => s.status === 'planned' && s.date >= t && s.date <= until);
    const titems = triOn() ? (S.triPlan || []).filter(x => x.sport !== 'race' && x.status !== 'skipped' && x.date >= t && x.date <= until && !triDone(x)) : [];
    const sig = JSON.stringify([ftp(), adj(), items.map(s => [s.id, s.date, s.workoutId, s.adj || 1]), titems.map(x => [x.id, x.date, x.wid, x.ph]), tri()?.css, tri()?.runThr]);
    if (!force && sig === S.icuPushSig) return 0;
    const events = items.map(s => { const W = WORKOUTS[s.workoutId]; return { date: s.date, name: `${W.name}${s.kind==='optional'?' (optionnelle)':''}`, external_id: 'ftpb-' + s.id, moving_time: wDur(s.workoutId),
      description: `${W.goal}\n\nFTP ${ftp()} W · créé par FTP Builder\n\n${icuText(s.workoutId)}`, fit_base64: b64(encodeWorkout(s.workoutId, ftp() * sAdj(s))) }; });
    // nat / course : séance texte au format Intervals (allures en % du seuil)
    for (const x of titems) { const W = triWorkout(x), E = triEst(x, W);
      events.push({ date: x.date, type: x.sport === 'swim' ? 'Swim' : 'Run', name: `${W.name}${x.kind === 'optional' ? ' (optionnelle)' : ''}`, external_id: 'ftpb-t-' + x.id, moving_time: E.sec,
        description: `${W.goal}\n\n${x.sport === 'swim' ? `CSS ${fmtPace(tri().css)} /100 m` : `Seuil ${fmtPace(tri().runThr)} /km`} · créé par FTP Builder\n\n${triIcuText(x, W)}` }); }
    const prev = S.icuPushed || {};
    const ids = new Set([...items.map(s => s.id), ...titems.map(x => 't-' + x.id)]);
    const remove = Object.keys(prev).filter(id => !ids.has(id) && prev[id] >= t).map(id => 'ftpb-' + id);
    const r = await icuCall({ action:'push', events, remove });
    S.icuPushed = Object.fromEntries([...items.map(s => [s.id, s.date]), ...titems.map(x => ['t-' + x.id, x.date])]);
    S.icuPushSig = sig; save();
    return r.created || events.length;
  }
  // « Se connecter avec Intervals.icu » (OAuth) : plus besoin de copier une clé API
  function connectIcuOAuth(){
    if (!ICU_CLIENT_ID) { TAB = 'profile'; PROFILE_PANE = 'settings'; render(); return toast('Colle ta clé API Intervals.icu dans la carte Compte'); }
    if (!user()) { authDlg(); return toast('Crée d’abord ton compte FTP Builder'); }
    const u = new URL('https://intervals.icu/oauth/authorize');
    u.search = new URLSearchParams({ client_id: ICU_CLIENT_ID, redirect_uri: icuRedirect(), scope: ICU_SCOPE, state: 'icu' });
    location.href = u.toString();
  }
  async function handleIcuReturn(){
    const q = new URLSearchParams(location.search);
    if (q.get('state') !== 'icu') return;
    history.replaceState(null, '', appUrl());
    if (q.get('error')) return toast('Connexion Intervals.icu annulée');
    if (!session) return toast('Connecte-toi puis relance la connexion Intervals.icu');
    try {
      const r = await icuCall({ action:'oauth', code: q.get('code'), redirect_uri: icuRedirect() });
      const a = r.athlete || {};
      toast(`Intervals.icu connecté${a.name ? ' : ' + a.name : ''} ✅`);
      if (a.ftp && a.ftp !== ftp()) S.icuFtpHint = a.ftp;
      S.icuBackfill = 0; save(); // premier passage : 4 mois d'historique
    } catch(e) { toast('Intervals : ' + e.message); }
  }
  async function connectIcu(){
    const k = ($('#icuKey')?.value || '').trim();
    if (!k) return toast('Colle ta clé API Intervals.icu');
    const btn = $('#icuConnect'); if (btn) { btn.disabled = true; btn.textContent = 'Connexion…'; }
    try {
      const r = await icuCall({ action:'connect', apiKey: k });
      await refreshIcu();
      const a = r.athlete || {};
      toast(`Intervals.icu connecté${a.name ? ' : ' + a.name : ''}`);
      if (a.ftp && a.ftp !== ftp()) S.icuFtpHint = a.ftp;
      await autoIcu(true);
    } catch(e) { toast('Intervals : ' + e.message); }
    finally { render(); }
  }
  // Synchro de l'état : une ligne par compte, le plus récent l'emporte — sauf deux cas où l'on n'écrase jamais sans le dire :
  //  · l'état vient d'une app plus récente (APP_STALE) : on n'envoie rien et on se met à jour ;
  //  · l'état local n'a jamais été relié à ce compte, qui contient déjà des données (questionnaire refait sur un nouveau
  //    téléphone puis connexion) : on prend le compte si le téléphone est vierge, sinon on demande.
  let hold = false;   // envois suspendus tant qu'un choix est en attente
  let pulled = false; // le compte a été lu au moins une fois : aucun envoi avant (on n'écrase pas ce qu'on n'a pas regardé)
  const linked = () => S.syncedUser === user()?.id;
  function link(){ if (S.syncedUser === user().id && !S.syncLegacy) return; S.syncedUser = user().id; delete S.syncLegacy; save({ remote:true }); }
  const localFresh = () => !S.activities.length && !S.plan.some(s => s.status === 'done') && !(S.triPlan || []).some(x => x.status === 'done');
  function stale(){ APP_STALE = true; toast("Tes données viennent d'une version plus récente de l'app : mise à jour…"); try { checkUpdate(); } catch(e){} }
  function adopt(st){ S = Object.assign(blank(), st); link(); save({ remote:true }); if (repairAutoLinks()) save(); toast('Données récupérées depuis ton compte'); }
  const sumState = st => `${st.activities?.length || 0} séance${(st.activities?.length || 0) > 1 ? 's' : ''} enregistrée${(st.activities?.length || 0) > 1 ? 's' : ''}, modifié le ${fmtShort(iso(new Date(st.updatedAt || Date.now())))}`;
  function askWhich(remote){ return new Promise(res => { let done = false; const end = v => { if (done) return; done = true; dlg.removeEventListener('close', onClose); res(v); }, onClose = () => end(null);
    openDlg(`<h2>Deux jeux de données</h2><p class="small muted">Ton compte contient déjà des données, et ce téléphone aussi. Lesquelles garder ? L'autre jeu est conservé ${BACKUP_DAYS} jours en copie de secours.</p>
      <div class="note"><b>Ton compte</b><br>${esc(sumState(remote))}</div><div class="note"><b>Ce téléphone</b><br>${esc(sumState(S))}</div>
      <div class="row" style="margin-top:12px"><button class="btn primary" id="syKeepR">Garder le compte</button><button class="btn" id="syKeepL">Garder ce téléphone</button></div>
      <p class="tiny muted" style="margin:10px 0 0">Tant que tu n'as pas choisi, rien n'est envoyé ni remplacé.</p>`);
    $('#syKeepR').onclick = () => { end('remote'); closeDlg(); }; $('#syKeepL').onclick = () => { end('local'); closeDlg(); }; dlg.addEventListener('close', onClose); }); }
  let pulling = null; // une seule lecture du compte à la fois
  const pull = () => pulling ||= doPull().finally(() => { pulling = null; });
  async function doPull(){
    const { data, error } = await sb.from('user_state').select('data, updated_at').maybeSingle();
    if (error) { console.warn(error); return; }
    pulled = true;
    if (APP_STALE) return stale();
    const m = data?.data ? migrateState(data.data) : null;
    if (!m) { if (S.profile) await push(); return; }
    if (m.newer) return stale();
    const remote = m.state, rT = remote.updatedAt || Date.parse(data.updated_at) || 0, lT = S.updatedAt || 0;
    if (!S.profile) return adopt(remote);
    if (!linked() && !S.syncLegacy && remote.profile) { // jamais relié à ce compte
      if (localFresh()) { backupState(S, 'questionnaire local remplacé par le compte'); return adopt(remote); }
      hold = true; const pick = await askWhich(remote); 
      if (pick === 'remote') { backupState(S, 'téléphone remplacé par le compte'); hold = false; return adopt(remote); }
      if (pick === 'local') { backupState(remote, 'compte remplacé par le téléphone'); hold = false; S.updatedAt = Date.now(); save({ remote:true }); return push(); } // daté de maintenant : ce choix l'emporte aussi sur les autres appareils
      return; // pas de choix : on reposera la question au prochain lancement, rien n'est envoyé d'ici là
    }
    if (rT > lT) adopt(remote);
    else if (lT > rT) await push();
    else link();
  }
  let pushFails = 0;
  async function push(){
    if (!sb || !user() || !S.profile || APP_STALE || hold) return;
    if (!pulled) return pull(); // premier envoi de la session : on lit d'abord le compte, pull() décide
    const uid = user().id, { error } = await sb.from('user_state').upsert({ user_id: uid, data: { ...S, syncedUser: uid, syncLegacy: undefined }, updated_at: new Date().toISOString() });
    if (error) { console.warn('push', error); if (++pushFails === 3) Errors.report(new Error('Synchro du compte en échec : ' + (error.message || error.code || '')), 'push'); } else { pushFails = 0; link(); }
  }
  function schedulePush(){ if (!user()) return; clearTimeout(pushTimer); pushTimer = setTimeout(push, 1500); }

  /* ----- Strava ----- */
  async function refreshStrava(){
    if (!user()) return;
    const { data } = await sb.rpc('strava_status');
    strava = data && data.length ? { connected: true, athlete: data[0].athlete_id } : { connected: false };
  }
  function connectStrava(){
    if (!STRAVA_CLIENT_ID) return toast("Strava n'est pas encore configuré (Client ID manquant)");
    if (!user()) return toast('Connecte-toi d’abord à ton compte FTP Builder');
    const u = new URL('https://www.strava.com/oauth/authorize');
    u.search = new URLSearchParams({ client_id: STRAVA_CLIENT_ID, redirect_uri: appUrl(), response_type:'code', approval_prompt:'auto', scope:'read,activity:read_all', state:'strava' });
    location.href = u.toString();
  }
  async function handleStravaReturn(){
    const q = new URLSearchParams(location.search);
    if (q.get('state') !== 'strava') return;
    history.replaceState(null, '', appUrl());
    if (q.get('error')) return toast('Connexion Strava annulée');
    if (!session) return toast('Connecte-toi puis relance la connexion Strava');
    const { data, error } = await sb.functions.invoke('strava', { body: { action:'exchange', code: q.get('code'), scope: q.get('scope') } });
    if (error || data?.error) return toast('Strava : ' + (data?.error || error.message));
    toast(`Strava connecté${data.athlete?.firstname ? ' : ' + data.athlete.firstname : ''} 🚴${data.webhook && !data.webhook.subscribed ? ' (synchro auto à finaliser)' : ''}`);
    if (data.webhook && !data.webhook.subscribed) console.warn('webhook Strava', data.webhook);
    await syncStrava(30);
  }
  async function syncStrava(days=14){
    if (busy) return; busy = true;
    try {
      const { data, error } = await sb.functions.invoke('strava', { body: { action:'sync', days } });
      if (error || data?.error) throw new Error(data?.error || error.message);
      const n = await importInbox();
      toast(n ? `${n} sortie${n>1?'s':''} importée${n>1?'s':''} depuis Strava` : 'Rien de nouveau sur Strava');
    } catch(e){ toast('Strava : ' + e.message); } finally { busy = false; render(); }
  }
  async function disconnectStrava(){
    await sb.functions.invoke('strava', { body: { action:'disconnect' } }); strava = { connected:false }; render(); toast('Strava déconnecté');
  }
  // convertit les activités reçues (webhook ou synchro) en séances de l'app
  // activité externe (résumé + flux seconde par seconde) -> séance FTP Builder ; renvoie null si doublon
  const recordsFrom = (st, start) => (st?.time || []).map((t, i) => ({ t: start + t, pw: st.watts?.[i] ?? null, hr: st.heartrate?.[i] ?? null, cad: st.cadence?.[i] ?? null,
    spd: st.velocity_smooth?.[i] != null ? st.velocity_smooth[i]*3.6 : null, alt: st.altitude?.[i] ?? null, dist: st.distance?.[i] != null ? st.distance[i]/1000 : null }));
  // complète une sortie dehors déjà en place (import plus ancien ou .fit) avec la vitesse et l'altitude d'Intervals
  function enrich(a, row){
    const start = Math.floor(Date.parse(row.activity.start_date)/1000), rec = recordsFrom(row.streams, start); if (!rec.length) return false;
    const x = activityFromFit({ records: rec, laps:[], user:{}, zones:{}, workout:{}, noPower: true, sessions:[{ start, timer: row.activity.moving_time }] }, 'x');
    for (const k of ['spdSample','altSample','cadSample','hrSample']) if (!a[k] && x[k]) a[k] = x[k];
    if (!a.sampleSecs && x.sampleSecs) a.sampleSecs = x.sampleSecs;
    const a0 = row.activity;
    if (a.avgSpeed == null && a0.average_speed) a.avgSpeed = +(a0.average_speed*3.6).toFixed(1);
    if (a.maxSpeed == null && a0.max_speed) a.maxSpeed = +(a0.max_speed*3.6).toFixed(1);
    if (a.elevM == null && a0.total_elevation_gain != null) a.elevM = Math.round(a0.total_elevation_gain);
    return !!a.spdSample;
  }
  function extToActivity(a0, st, source){
    st = st || {};
    const start = Math.floor(Date.parse(a0.start_date)/1000);
    if (S.activities.some(x => x.startTs && x.source !== 'health' && Math.abs(x.startTs - start) < 120)) return null; // déjà importée (.fit ou autre source)
    const old = replaceHealthDuplicate(start); // la version Apple Santé (résumé seul) laisse la place, ses corrections sont reprises plus bas
    if ((a0.moving_time || 0) < 120) return null; // enregistrement parasite (quelques secondes)
    const records = recordsFrom(st, start);
    const fit = { records, laps:[], user:{}, zones:{}, workout:{ name: a0.name }, noPower: !a0.device_watts,
      sessions:[{ start, timer: a0.moving_time, distKm: (a0.distance||0)/1000, subSport: a0.trainer ? 6 : 0, avgSpeed: a0.average_speed || null, maxSpeed: a0.max_speed || null, ascent: a0.total_elevation_gain ?? null, avgHr: a0.average_heartrate ? Math.round(a0.average_heartrate) : null, maxHr: a0.max_heartrate || null }] };
    let a;
    if (records.length) a = activityFromFit(fit, a0.name || 'Sortie');
    else a = { id: uid(), date: iso(new Date(start*1000)), name: a0.name || 'Sortie', durationS: a0.moving_time || 0, distanceKm: a0.distance ? +(a0.distance/1000).toFixed(1) : null,
      avgPower: a0.average_watts ? Math.round(a0.average_watts) : null, np: a0.weighted_average_watts ? Math.round(a0.weighted_average_watts) : null, avgHr: a0.average_heartrate ? Math.round(a0.average_heartrate) : null,
      maxHr: a0.max_heartrate || null, hasPower: !!a0.average_watts, best: null, feel: null };
    a.source = source; a.startTs = start;
    if (!a.durationS) a.durationS = a0.moving_time || 0;
    if (a.avgSpeed == null && a0.average_speed) a.avgSpeed = +(a0.average_speed*3.6).toFixed(1);
    if (a.maxSpeed == null && a0.max_speed) a.maxSpeed = +(a0.max_speed*3.6).toFixed(1);
    if (a.elevM == null && a0.total_elevation_gain != null) a.elevM = Math.round(a0.total_elevation_gain);
    if (old) { // corrections faites à la main sur la version Apple Santé
      if (old.feel) a.feel = old.feel;
      if (old.linkManual) { a.name = old.name; a.indoor = old.indoor; a.linkManual = true; a.countAsSession = old.countAsSession; }
    }
    const manual = old?.linkManual ? (old.planId && S.plan.find(s => s.id === old.planId && s.status === 'planned')) : null;
    const pl = old?.linkManual ? manual : autoPlanFor(a);
    if (pl) { a.planId = pl.id; pl.status = 'done'; pl.activityId = a.id; if (records.length) a.compliance = compliance(Object.assign(a, { _pw: powerSeries(records, 'pw'), _hr: powerSeries(records, 'hr') }), pl); }
    else if (!old?.linkManual) a.countAsSession = a.durationS >= 1800 && a.date >= (S.profile?.startDate || ''); // une sortie d'avant le programme ne compte pas
    delete a._pw; delete a._hr;
    computeLoad(a);
    return a;
  }
  async function importExt(){
    if (!user() || !S.profile) return 0;
    const { data, error } = await sb.from('ext_inbox').select('source, ext_id, activity, streams').eq('imported', false).order('received_at');
    if (error) return 0;
    let n = 0;
    for (const row of (data || []).sort((x,y) => String(x.activity.start_date).localeCompare(String(y.activity.start_date)))) {
      if (!S.activities.some(x => x.extId === row.ext_id)) {
        const a = extToActivity(row.activity, row.streams, row.source);
        if (a) { a.extId = row.ext_id; S.activities.push(a); n++; }
      }
      await sb.from('ext_inbox').update({ imported:true }).eq('source', row.source).eq('ext_id', row.ext_id);
    }
    // sorties dehors importées avant que les flux vitesse/altitude existent : on les complète une fois
    const need = S.activities.filter(a => !isIndoor(a) && !a.spdSample && a.startTs && !a.enrichTried && a.source !== 'health');
    let m = 0;
    for (const a of need) {
      a.enrichTried = true;
      let q = sb.from('ext_inbox').select('activity, streams').eq('source', 'intervals');
      q = a.extId ? q.eq('ext_id', a.extId) : q.gte('activity->>start_date', new Date((a.startTs-120)*1000).toISOString().slice(0,19)).lte('activity->>start_date', new Date((a.startTs+120)*1000).toISOString().slice(0,19) + 'Z');
      const { data: rows } = await q.limit(1);
      if (rows?.[0]?.streams && enrich(a, rows[0])) m++;
    }
    if (n || need.length) save();
    return n;
  }
  async function importInbox(){
    if (!user() || !S.profile) return 0;
    const { data, error } = await sb.from('strava_inbox').select('id, strava_id, activity, streams').eq('imported', false).order('received_at');
    if (error || !data?.length) return 0;
    let n = 0;
    for (const row of data) {
      const a0 = row.activity, st = row.streams || {};
      if (S.activities.some(x => x.stravaId === row.strava_id)) { await sb.from('strava_inbox').update({ imported:true }).eq('id', row.id); continue; }
      // démarrage accidentel (quelques secondes, aucune distance) : ignoré
      if ((a0.moving_time || 0) < 60 && (a0.distance || 0) < 200) { await sb.from('strava_inbox').update({ imported:true }).eq('id', row.id); continue; }
      const start = Math.floor(Date.parse(a0.start_date)/1000);
      const time = st.time || [];
      const records = time.map((t, i) => ({ t: start + t, pw: st.watts?.[i] ?? null, hr: st.heartrate?.[i] ?? null, cad: st.cadence?.[i] ?? null,
        spd: st.velocity_smooth?.[i] != null ? st.velocity_smooth[i]*3.6 : null, alt: st.altitude?.[i] ?? null, dist: st.distance?.[i] != null ? st.distance[i]/1000 : null }));
      const fit = { records, laps:[], user:{}, zones:{}, workout:{ name: a0.name }, noPower: !a0.device_watts,
        sessions:[{ start, timer: a0.moving_time, distKm: a0.distance/1000, subSport: a0.trainer ? 6 : 0, avgSpeed: a0.average_speed || null, maxSpeed: a0.max_speed || null, ascent: a0.total_elevation_gain ?? null, avgHr: a0.average_heartrate ? Math.round(a0.average_heartrate) : null, maxHr: a0.max_heartrate || null }] };
      const a = activityFromFit(fit, a0.name);
      a.source = 'strava'; a.stravaId = row.strava_id; a.startTs = start;
      if (!a0.trainer && st.latlng) Tracks.put(start, Tracks.fromStreams(st), 'strava');
      if (!a.durationS) a.durationS = a0.moving_time;
      // doublon avec un .fit déjà importé (même départ à 2 min près)
      if (S.activities.some(x => x.startTs && Math.abs(x.startTs - start) < 120)) { await sb.from('strava_inbox').update({ imported:true }).eq('id', row.id); continue; }
      const pl = autoPlanFor(a);
      if (pl) { a.planId = pl.id; pl.status = 'done'; pl.activityId = a.id; a.compliance = compliance(Object.assign(a, { _pw: powerSeries(records, 'pw'), _hr: powerSeries(records, 'hr') }), pl); }
      else a.countAsSession = a.durationS >= 1800;
      delete a._pw; delete a._hr;
      computeLoad(a); S.activities.push(a); n++;
      await sb.from('strava_inbox').update({ imported:true }).eq('id', row.id);
    }
    if (n) save();
    return n;
  }

  /* ----- interface compte ----- */
  function accountHTML(){
    if (!sb) return `<div class="card"><h2>Compte</h2><p class="muted small">Hors ligne : la synchronisation reviendra avec la connexion.</p></div>`;
    if (!user()) return `<div class="card"><h2>Compte</h2><p class="muted small" style="margin-top:0">Connecte-toi pour sauvegarder tes séances dans le cloud, les retrouver sur tous tes appareils et activer Intervals.icu.</p><button class="btn primary" data-auth="open">Se connecter / créer un compte</button></div>`;
    return `<div class="card"><div class="row between"><h2>Compte</h2><button class="btn sm ghost" data-auth="logout">Se déconnecter</button></div>
      <p class="small muted" style="margin:0 0 12px">Connecté : <b style="color:var(--text)">${esc(user().email || '')}</b> · synchro automatique</p>
      <h3>Intervals.icu</h3>
      ${icu.connected
        ? `<p class="small muted" style="margin:0 0 8px">Connecté${icu.athlete_name ? ` : <b style="color:var(--text)">${esc(icu.athlete_name)}</b>` : ''} (${esc(icu.athlete_id)})${icu.last_sync_at ? ` · dernière synchro ${new Date(icu.last_sync_at).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'})}` : ''}.<br>Tes sorties Garmin arrivent toutes seules à l'ouverture de l'app, et tes 4 prochaines semaines de séances sont envoyées dans ton calendrier Intervals.</p>
           ${S.icuFtpHint && S.icuFtpHint !== ftp() ? `<div class="note" style="margin:0 0 8px">FTP réglée dans Intervals : <b>${S.icuFtpHint} W</b>, ici : <b>${ftp()} W</b>. Mets la même valeur des deux côtés (Intervals › Réglages › Vélo), sinon les zones et la charge différeront.</div>` : ''}
           <div class="row"><button class="btn" data-icu="sync">Synchroniser maintenant</button><button class="btn" data-icu="push">Renvoyer le plan</button><button class="btn sm ghost" data-icu="off">Déconnecter</button></div>`
        : (() => { const keyRow = `<div class="row"><input type="password" id="icuKey" placeholder="Clé API Intervals.icu" autocomplete="off" style="flex:1;min-width:160px;background:var(--bg2);border:1px solid var(--line);border-radius:10px;padding:10px 12px;min-height:42px"><button class="btn ${ICU_CLIENT_ID ? '' : 'primary'}" id="icuConnect" data-icu="on">Connecter</button></div>`;
            const keyHelp = `Clé API : <a href="https://intervals.icu/settings" target="_blank" rel="noopener">intervals.icu/settings</a> › Developer Settings, tout en bas.`;
            return `<p class="small muted" style="margin:0 0 8px">La meilleure source pour l'app : tes 3 sports avec le détail tour par tour (recomposition nat/course), le bien-être, et tes séances planifiées envoyées vers ta montre ou ton compteur. Relie d'abord ta montre à Intervals.icu (Réglages › Connexions : Garmin, Coros, Suunto, Wahoo, Polar…).</p>
              ${ICU_CLIENT_ID ? `<button class="btn primary" data-icu="oauth" style="width:100%">Se connecter avec Intervals.icu</button>
                <details style="margin-top:10px"><summary class="small muted" style="cursor:pointer">Ou avec une clé API</summary><p class="tiny muted" style="margin:6px 0">${keyHelp}</p>${keyRow}</details>`
              : `<p class="small muted" style="margin:0 0 8px">${keyHelp}</p>${keyRow}`}`; })()}
      <h3 style="margin-top:16px">Strava</h3>
      ${strava.connected
        ? `<p class="small muted" style="margin:0 0 8px">Connecté (athlète ${esc(strava.athlete)}). Chaque nouvelle sortie vélo arrive toute seule ; ouvre l'app pour l'intégrer.</p><div class="row"><button class="btn" data-strava="sync">Synchroniser maintenant</button><button class="btn sm ghost" data-strava="off">Déconnecter Strava</button></div>`
        : STRAVA_CLIENT_ID
          ? `<p class="small muted" style="margin:0 0 8px">Récupère automatiquement tes sorties (puissance, FC, cadence) dès qu'elles arrivent sur Strava.</p><button class="btn" data-strava="on" style="background:#fc4c02;border-color:#fc4c02;color:#fff">Connecter Strava</button>`
          : `<p class="small muted" style="margin:0">Connexion Strava bientôt disponible.</p>`}
      <hr style="border:0;border-top:1px solid var(--line);margin:16px 0 10px">
      <div class="row between" style="align-items:center"><a class="small" href="confidentialite.html">Où sont mes données ?</a><button class="btn sm danger" data-auth="delete">Supprimer mon compte</button></div>
    </div>`;
  }
  // suppression définitive : révocation Strava/Intervals + compte + toutes les données cloud, puis effacement local
  function deleteDlg(){
    openDlg(`<h2>Supprimer mon compte</h2>
      <p class="small">Ça efface <b>définitivement</b> ton compte et toutes tes données dans le cloud : profil, plan, séances, tracés, données Apple Santé, défis et amis. L'accès de l'app à Strava et Intervals.icu est révoqué, et les données de ce téléphone sont effacées.</p>
      <p class="small muted">Tes données restent intactes chez Strava, Intervals.icu et dans Apple Santé. Pense à exporter tes données (Profil › Données) si tu veux les garder.</p>
      <label class="f" for="delConf">Écris <b>SUPPRIMER</b> pour confirmer</label><input type="text" id="delConf" autocomplete="off" autocapitalize="characters">
      <div class="row" style="margin-top:12px"><button class="btn danger" id="delGo" disabled>Supprimer définitivement</button><button class="btn" data-close>Annuler</button></div>
      <div id="delMsg" class="small" style="margin-top:10px"></div>`);
    const inp = $('#delConf'), go = $('#delGo');
    inp.oninput = () => go.disabled = inp.value.trim().toUpperCase() !== 'SUPPRIMER';
    go.onclick = async () => {
      go.disabled = true; go.textContent = 'Suppression…';
      let data, error; try { ({ data, error } = await sb.functions.invoke('delete-account', { body: { confirm:'SUPPRIMER' } })); } catch (e) { error = e; }
      if (error || !data?.deleted) { $('#delMsg').innerHTML = `<div class="note bad">Échec : ${esc(error?.message || data?.error || 'réponse vide')}. Rien n'a été effacé sur ce téléphone ; réessaie.</div>`; go.disabled = false; go.textContent = 'Supprimer définitivement'; return; }
      try { await sb.auth.signOut({ scope:'local' }); } catch {}
      try { Object.keys(localStorage).filter(k => /^(ftpb|sb-)/.test(k)).forEach(k => localStorage.removeItem(k)); Storage.prototype.setItem = () => {}; } catch {} // plus aucune écriture jusqu'au rechargement
      document.body.innerHTML = `<div style="padding:40px 20px;text-align:center;font-family:system-ui"><h2>Compte supprimé</h2><p>Toutes tes données ont été effacées.</p></div>`;
      setTimeout(() => location.replace(appUrl()), 1800);
    };
  }
  function authDlg(){
    openDlg(`<h2>Mon compte</h2><p class="muted small">Tes séances sont sauvegardées et synchronisées entre tes appareils.</p>
      <button class="btn" id="gBtn" style="width:100%;margin-top:6px">Continuer avec Google</button>
      <div class="tiny muted" style="text-align:center;margin:12px 0">ou par email</div>
      <label class="f" for="aEmail">Email</label><input type="text" id="aEmail" inputmode="email" autocomplete="email">
      <label class="f" for="aPass">Mot de passe (8 caractères min.)</label><input type="password" id="aPass" autocomplete="current-password" style="width:100%;background:var(--bg2);border:1px solid var(--line);border-radius:10px;padding:10px 12px;min-height:42px">
      <div class="row" style="margin-top:12px"><button class="btn primary" id="aIn">Se connecter</button><button class="btn" id="aUp">Créer un compte</button></div>
      <div id="aMsg" class="small" style="margin-top:10px"></div>`);
    const msg = t => $('#aMsg').textContent = t;
    $('#gBtn').onclick = () => sb.auth.signInWithOAuth({ provider:'google', options:{ redirectTo: appUrl() } });
    $('#aIn').onclick = async () => { const { error } = await sb.auth.signInWithPassword({ email: $('#aEmail').value.trim(), password: $('#aPass').value }); if (error) msg(error.message === 'Invalid login credentials' ? 'Email ou mot de passe incorrect.' : error.message); else { closeDlg(); toast('Connecté'); } };
    $('#aUp').onclick = async () => { const { data, error } = await sb.auth.signUp({ email: $('#aEmail').value.trim(), password: $('#aPass').value, options:{ emailRedirectTo: appUrl() } }); if (error) msg(error.message); else if (!data.session) msg('Compte créé : clique sur le lien reçu par email pour l’activer.'); else { closeDlg(); toast('Compte créé'); } };
  }
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-auth],[data-strava],[data-feelact],[data-icu]'); if (!a) return;
    if (a.dataset.icu === 'on') { connectIcu(); return; }
    if (a.dataset.icu === 'oauth') { connectIcuOAuth(); return; }
    if (a.dataset.icu === 'sync') { autoIcu(true); toast('Synchronisation Intervals…'); return; }
    if (a.dataset.icu === 'push') { pushPlan(true).then(n => toast(`${n} séance${n>1?'s':''} envoyée${n>1?'s':''} à Intervals.icu`)).catch(err => toast('Intervals : ' + err.message)); return; }
    if (a.dataset.icu === 'off') { icuCall({ action:'disconnect' }).then(() => { icu = { connected:false }; render(); toast('Intervals.icu déconnecté'); }); return; }
    if (a.dataset.auth === 'open') authDlg();
    else if (a.dataset.auth === 'logout') sb.auth.signOut();
    else if (a.dataset.auth === 'delete') deleteDlg();
    else if (a.dataset.strava === 'on') connectStrava();
    else if (a.dataset.strava === 'sync') syncStrava(30);
    else if (a.dataset.strava === 'off') disconnectStrava();
    else if (a.dataset.feelact) feelDlg(a.dataset.feelact);
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && user()) { importInbox().then(n => { if (n) { render(); toast(`${n} sortie${n>1?'s':''} Strava importée${n>1?'s':''}`); } }); autoIcu(); } });
  return { init, schedulePush, accountHTML, importInbox, importExt, pushPlan, autoIcu, icuText, connectIcuOAuth, connectStrava, authDlg, get ready(){ return ready; }, get icu(){ return icu; }, get strava(){ return strava; }, get user(){ return user(); }, get sb(){ return sb; } };
})();
