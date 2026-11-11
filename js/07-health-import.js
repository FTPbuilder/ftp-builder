"use strict";
// FTP Builder · import de l'export Apple Santé
/* ============ import de l'export Apple Santé (export.zip / export.xml) ============ */
const HealthImport = (() => {
  const DAYS = 120;
  const Q = { // type HealthKit -> [métrique, agrégat]
    HKQuantityTypeIdentifierHeartRateVariabilitySDNN: ['hrv','avg'], HKQuantityTypeIdentifierRestingHeartRate: ['rhr','avg'],
    HKQuantityTypeIdentifierBodyMass: ['weight','last'], HKQuantityTypeIdentifierVO2Max: ['vo2max','last'],
    HKQuantityTypeIdentifierRespiratoryRate: ['resp_rate','avg'], HKQuantityTypeIdentifierOxygenSaturation: ['spo2','avg'],
    HKQuantityTypeIdentifierBodyFatPercentage: ['body_fat','last'], HKQuantityTypeIdentifierLeanBodyMass: ['lean_mass','last'],
    HKQuantityTypeIdentifierAppleExerciseTime: ['exercise_min','sum'], HKQuantityTypeIdentifierWalkingHeartRateAverage: ['walking_hr','avg'],
    HKQuantityTypeIdentifierBloodPressureSystolic: ['systolic','avg'], HKQuantityTypeIdentifierBloodPressureDiastolic: ['diastolic','avg'],
  };
  const SLEEP = 'HKCategoryTypeIdentifierSleepAnalysis';
  const WT = { Running:'Course à pied', Cycling:'Vélo', Swimming:'Natation', Walking:'Marche', Hiking:'Randonnée', TraditionalStrengthTraining:'Renforcement musculaire', FunctionalStrengthTraining:'Renforcement fonctionnel', HighIntensityIntervalTraining:'HIIT', CoreTraining:'Gainage', Yoga:'Yoga', Pilates:'Pilates', Elliptical:'Elliptique', Rowing:'Aviron', CrossTraining:'Cross training', Flexibility:'Mobilité', MixedCardio:'Cardio', Other:'Autre', Surfing:'Surf', SurfingSports:'Surf', Climbing:'Escalade', Cooldown:'Retour au calme', Soccer:'Football', Tennis:'Tennis', Basketball:'Basket', Skiing:'Ski', DownhillSkiing:'Ski alpin', CrossCountrySkiing:'Ski de fond', Boxing:'Boxe', MartialArts:'Arts martiaux', Paddling:'Paddle', StairClimbing:'Escaliers', Dance:'Danse', Badminton:'Badminton', Squash:'Squash', Padel:'Padel', PickleBall:'Pickleball' };
  const isoOf = s => s ? s.replace(' ', 'T').replace(/ ([+-]\d{2})(\d{2})$/, '$1:$2') : null; // "2026-10-20 07:12:00 +0200"
  const attrs = s => { const o = {}; s.replace(/(\w+)="([^"]*)"/g, (_, k, v) => { o[k] = v; return ''; }); return o; };

  // --- lecture du zip sans tout charger en mémoire (gère le ZIP64 des gros exports) ---
  async function zipEntry(file){
    const tailLen = Math.min(file.size, 70000), tail = new DataView(await file.slice(file.size - tailLen).arrayBuffer());
    let e = -1; for (let i = tailLen - 22; i >= 0; i--) if (tail.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error('Archive .zip illisible');
    let cdOff = tail.getUint32(e + 16, true), cdSize = tail.getUint32(e + 12, true), n = tail.getUint16(e + 10, true);
    if (cdOff === 0xFFFFFFFF || n === 0xFFFF) { // ZIP64
      const loc = e - 20; if (loc < 0 || tail.getUint32(loc, true) !== 0x07064b50) throw new Error('ZIP64 non reconnu');
      const e64 = Number(tail.getBigUint64(loc + 8, true));
      const r = new DataView(await file.slice(e64, e64 + 56).arrayBuffer());
      n = Number(r.getBigUint64(32, true)); cdSize = Number(r.getBigUint64(40, true)); cdOff = Number(r.getBigUint64(48, true));
    }
    const cd = new DataView(await file.slice(cdOff, cdOff + cdSize).arrayBuffer());
    let p = 0;
    for (let k = 0; k < n && p < cd.byteLength; k++) {
      const method = cd.getUint16(p + 10, true); let csize = cd.getUint32(p + 20, true), usize = cd.getUint32(p + 24, true);
      const nl = cd.getUint16(p + 28, true), xl = cd.getUint16(p + 30, true), cl = cd.getUint16(p + 32, true); let off = cd.getUint32(p + 42, true);
      const name = new TextDecoder().decode(new Uint8Array(cd.buffer, p + 46, nl));
      let x = p + 46 + nl; const xe = x + xl;
      while (x + 4 <= xe) { const id = cd.getUint16(x, true), sz = cd.getUint16(x + 2, true); if (id === 1) { let q = x + 4; if (usize === 0xFFFFFFFF) { usize = Number(cd.getBigUint64(q, true)); q += 8; } if (csize === 0xFFFFFFFF) { csize = Number(cd.getBigUint64(q, true)); q += 8; } if (off === 0xFFFFFFFF) { off = Number(cd.getBigUint64(q, true)); } } x += 4 + sz; }
      p = xe + cl;
      if (!/(^|\/)export\.xml$/i.test(name)) continue;
      const lh = new DataView(await file.slice(off, off + 30).arrayBuffer());
      const start = off + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
      return { start, csize, method };
    }
    throw new Error('export.xml introuvable dans l’archive');
  }

  async function run(file, box){
    const sb = Cloud.sb, user = Cloud.user;
    if (!sb || !user) { box.innerHTML = '<div class="note bad">Connecte-toi d’abord à ton compte.</div>'; return; }
    if (!('DecompressionStream' in window) || !('TextDecoderStream' in window)) { box.innerHTML = '<div class="note bad">Navigateur trop ancien : mets à jour iOS (16.4 minimum).</div>'; return; }
    const btn = $('#hImportBtn'); if (btn) btn.disabled = true;
    const status = t => box.innerHTML = `<div class="note">${t}</div>`;
    try {
      status('Ouverture du fichier…');
      const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
      let stream, total;
      if (head[0] === 0x50 && head[1] === 0x4b) {
        const ent = await zipEntry(file); total = ent.csize;
        let s = file.slice(ent.start, ent.start + ent.csize).stream();
        stream = { s, deflate: ent.method === 8 };
      } else { total = file.size; stream = { s: file.stream(), deflate: false }; }
      let read = 0, lastUi = 0;
      const counter = new TransformStream({ transform(chunk, ctrl){ read += chunk.byteLength; const now = Date.now(); if (now - lastUi > 400) { lastUi = now; status(`Lecture de ton historique… <b>${Math.min(99, Math.round(read/total*100))} %</b><br><span class="tiny muted">${(read/1e6).toFixed(0)} / ${(total/1e6).toFixed(0)} Mo · ne quitte pas l'app</span>`); } ctrl.enqueue(chunk); } });
      let s = stream.s.pipeThrough(counter);
      if (stream.deflate) s = s.pipeThrough(new DecompressionStream('deflate-raw'));
      const reader = s.pipeThrough(new TextDecoderStream()).getReader();

      const cutoff = addDays(todayISO(), -DAYS);
      const daily = {}; // day|metric -> {sum,n,last,lastT}
      const segs = []; const workouts = []; let cur = null;
      const RE = /<(Record|Workout|WorkoutStatistics|MetadataEntry|\/Workout)\b([^>]*)>/g;
      const handle = (tag, a) => {
        if (tag === 'Record') {
          const t = a.match(/type="([^"]+)"/)?.[1]; if (!t) return;
          if (t !== SLEEP && !Q[t]) return;
          const at = attrs(a); const sd = at.startDate || ''; if (sd.slice(0, 10) < cutoff) return;
          if (t === SLEEP) { segs.push({ s: isoOf(at.startDate), e: isoOf(at.endDate), v: at.value || '', src: at.sourceName || '' }); return; }
          const [m, agg] = Q[t]; let v = parseFloat(at.value); if (isNaN(v)) return;
          if (m === 'weight' && /lb/i.test(at.unit || '')) v *= 0.4536;
          if ((m === 'spo2' || m === 'body_fat') && v <= 1) v *= 100;
          if (m === 'exercise_min' && !/watch/i.test(at.sourceName || '') && !/watch/i.test(at.device || '')) { /* minutes d'exercice : la montre fait foi */ }
          const day = sd.slice(0, 10), key = day + '|' + m, o = daily[key] ||= { day, m, agg, sum: 0, n: 0, last: null, lastT: '' };
          o.sum += v; o.n++; if (sd >= o.lastT) { o.last = v; o.lastT = sd; }
        } else if (tag === 'Workout') {
          const at = attrs(a); if ((at.startDate || '').slice(0, 10) < cutoff) { cur = null; return; }
          const type = (at.workoutActivityType || '').replace('HKWorkoutActivityType', '');
          let dur = parseFloat(at.duration); if (/s$|^s/i.test(at.durationUnit || '') && at.durationUnit !== 'min') dur = dur / 60; if (/hr|h$/i.test(at.durationUnit || '')) dur = dur * 60;
          cur = { start_at: isoOf(at.startDate), end_at: isoOf(at.endDate), type: WT[type] || type, duration_min: isNaN(dur) ? null : dur,
            distance_km: at.totalDistance ? +at.totalDistance * (/mi/i.test(at.totalDistanceUnit||'') ? 1.609 : /^m$/i.test(at.totalDistanceUnit||'') ? 0.001 : 1) : null,
            energy_kcal: at.totalEnergyBurned ? +at.totalEnergyBurned : null, avg_hr: null, source: at.sourceName || '' };
          if (/\/\s*$/.test(a)) { workouts.push(cur); cur = null; }
        } else if (tag === 'MetadataEntry') {
          if (cur && /key="HKIndoorWorkout"/.test(a)) cur.indoor = /value="1"/.test(a);
        } else if (tag === 'WorkoutStatistics' && cur) {
          const at = attrs(a), t = at.type || '';
          if (/HeartRate$/.test(t) && at.average) cur.avg_hr = +at.average;
          else if (/ActiveEnergyBurned/.test(t) && at.sum) cur.energy_kcal = +at.sum;
          else if (/Distance/.test(t) && at.sum) cur.distance_km = +at.sum * (/mi/i.test(at.unit||'') ? 1.609 : /^m$/i.test(at.unit||'') ? 0.001 : 1);
        } else if (tag === '/Workout' && cur) { workouts.push(cur); cur = null; }
      };
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (value) buf += value;
        const cut = done ? buf.length : buf.lastIndexOf('>') + 1;
        if (cut > 0) { const part = buf.slice(0, cut); buf = buf.slice(cut); RE.lastIndex = 0; let m; while ((m = RE.exec(part))) handle(m[1], m[2]); }
        if (done) break;
      }

      status('Calcul de tes nuits et de tes séances…');
      // mesures quotidiennes
      const rowsD = Object.values(daily).map(o => ({ user_id: user.id, day: o.day, metric: o.m, value: +(o.agg === 'sum' ? o.sum : o.agg === 'last' ? o.last : o.sum / o.n).toFixed(2), updated_at: new Date().toISOString() }));
      // nuits : rattachées au jour du réveil, une source retenue (montre en priorité)
      const stage = v => /InBed/.test(v) ? 'inbed' : /Deep/.test(v) ? 'deep' : /REM/.test(v) ? 'rem' : /Core/.test(v) ? 'core' : /Awake/.test(v) ? 'awake' : 'asleep';
      const byNight = {};
      for (const g of segs) { if (!g.s || !g.e) continue; const night = g.e.slice(0, 10); ((byNight[night] ||= {})[g.src] ||= []).push({ s: Date.parse(g.s), e: Date.parse(g.e), st: stage(g.v) }); }
      const union = iv => { iv.sort((a,b)=>a[0]-b[0]); let t=0, cs=-1, ce=-1; for (const [s,e] of iv){ if (s>ce){ if (ce>cs) t+=ce-cs; cs=s; ce=e; } else ce=Math.max(ce,e); } if (ce>cs) t+=ce-cs; return Math.round(t/60000); };
      const rowsS = [];
      for (const [night, bySrc] of Object.entries(byNight)) {
        const cands = Object.entries(bySrc).map(([src, list]) => {
          const m = st => union(list.filter(x => x.st === st).map(x => [x.s, x.e]));
          const core = m('core'), deep = m('deep'), rem = m('rem'), plain = m('asleep'), asleep = core + deep + rem || plain;
          return { source: src, asleep_min: asleep, core_min: core || null, deep_min: deep || null, rem_min: rem || null, awake_min: m('awake') || null, in_bed_min: m('inbed') || null,
            bed_start: new Date(Math.min(...list.map(x=>x.s))).toISOString(), bed_end: new Date(Math.max(...list.map(x=>x.e))).toISOString(),
            sc: asleep + (/watch/i.test(src) ? 10000 : 0) + (deep + rem ? 5000 : 0) };
        }).filter(c => c.asleep_min >= 120).sort((a,b) => b.sc - a.sc);
        if (cands.length) { const { sc, ...best } = cands[0]; rowsS.push({ user_id: user.id, night, ...best, updated_at: new Date().toISOString() }); }
      }
      // séances : doublons (montre / Strava / Garmin Connect) à ±5 min fusionnés
      const prio = s => /garmin|connect/i.test(s) ? 3 : /watch|apple|forme|fitness/i.test(s) ? 2 : /strava/i.test(s) ? 1 : 0;
      workouts.sort((a,b) => a.start_at.localeCompare(b.start_at));
      const rowsW = [];
      for (const w of workouts) {
        const prev = rowsW[rowsW.length-1];
        if (prev && Math.abs(Date.parse(w.start_at) - Date.parse(prev.start_at)) <= 300000) {
          const keepNew = prio(w.source) > prio(prev.source); const base = keepNew ? { ...w } : prev, other = keepNew ? prev : w;
          for (const k of ['end_at','duration_min','distance_km','energy_kcal','avg_hr','indoor']) if (base[k] == null) base[k] = other[k];
          if (/^(Autre|Other|)$/.test(base.type || '') && other.type && !/^(Autre|Other)$/.test(other.type)) base.type = other.type; // garder le type le plus précis (ex. Hevy > Strava « Autre »)
          if (keepNew) rowsW[rowsW.length-1] = { ...base, user_id: user.id }; else rowsW[rowsW.length-1] = base;
          continue;
        }
        rowsW.push({ ...w, user_id: user.id, updated_at: new Date().toISOString() });
      }
      // envoi
      // chaque ligne doit avoir exactement les mêmes colonnes (sinon PostgREST met les absentes à NULL)
      const COLS = { health_daily:['user_id','day','metric','value'], health_sleep:['user_id','night','source','asleep_min','core_min','deep_min','rem_min','awake_min','in_bed_min','bed_start','bed_end'], health_workouts:['user_id','start_at','end_at','type','duration_min','distance_km','energy_kcal','avg_hr','source','indoor'] };
      const norm = (table, rows) => { const now = new Date().toISOString(); return rows.map(r => { const o = { updated_at: now }; for (const c of COLS[table]) o[c] = r[c] ?? null; o.user_id = user.id; return o; }); };
      const up = async (table, rows0, conflict) => { const rows = norm(table, rows0); for (let i = 0; i < rows.length; i += 400) { status(`Enregistrement… ${table.replace('health_','')} ${Math.min(i+400, rows.length)}/${rows.length}`); const { error } = await sb.from(table).upsert(rows.slice(i, i+400), { onConflict: conflict }); if (error) throw new Error(error.message); } };
      // les séances déjà présentes (raccourci) à ±5 min sont remplacées par la version de l'export
      if (rowsW.length) { const since = rowsW[0].start_at; await sb.from('health_workouts').delete().eq('user_id', user.id).gte('start_at', since); }
      await up('health_daily', rowsD, 'user_id,day,metric');
      await up('health_sleep', rowsS, 'user_id,night');
      await up('health_workouts', rowsW, 'user_id,start_at');
      S.healthImportedAt = new Date().toISOString(); save();
      await Health.load(sb);
      const nH = rowsD.filter(r => r.metric === 'hrv').length;
      HealthImport.last = `<div class="note ok"><b>Historique importé ✔</b><br>${nH} jours de VFC · ${rowsD.filter(r=>r.metric==='rhr').length} de FC repos · ${rowsS.length} nuits · ${rowsW.length} séances${rowsD.some(r=>r.metric==='weight')?' · poids':''}${rowsD.some(r=>r.metric==='vo2max')?' · VO2max':''} (${DAYS} derniers jours).<br>Ton indice de forme est calibré : regarde l'onglet Aujourd'hui.</div>`;
      render();
    } catch (e) {
      console.error(e);
      box.innerHTML = `<div class="note bad">Import interrompu : ${esc(e.message || e)}. Réessaie ; si ça recommence, envoie-moi une capture.</div>`;
    } finally { const b = $('#hImportBtn'); if (b) b.disabled = false; }
  }
  return { run, last: '' };
})();
