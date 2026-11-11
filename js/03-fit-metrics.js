"use strict";
// FTP Builder · lecture FIT, métriques, rattachement au plan, évaluation de séance
/* ============ FIT : lecture ============ */
const FIT_EPOCH = 631065600;
const FIT = {
  async readFile(file){
    let buf = await file.arrayBuffer(); const u = new Uint8Array(buf);
    if (u[0] === 0x50 && u[1] === 0x4b) buf = await FIT.unzipFirstFit(buf);
    else if (u[0] === 0x1f && u[1] === 0x8b) {
      if (!('DecompressionStream' in window)) throw new Error('Décompression .gz non supportée par ce navigateur');
      buf = await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    }
    return FIT.decode(buf);
  },
  async unzipFirstFit(buf){ // export « fichier original » de Garmin Connect = .zip contenant le .fit
    const dv = new DataView(buf); let eocd = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('Archive .zip illisible');
    let p = dv.getUint32(eocd + 16, true); const n = dv.getUint16(eocd + 10, true);
    for (let k = 0; k < n; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
      const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(new Uint8Array(buf, p + 46, nl));
      p += 46 + nl + xl + cl;
      if (!/\.fit$/i.test(name)) continue;
      const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
      const data = buf.slice(start, start + csize);
      if (method === 0) return data;
      if (method === 8) {
        if (!('DecompressionStream' in window)) throw new Error('Décompression .zip non supportée : mets à jour ton navigateur');
        return await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
      }
      throw new Error('Format de compression non supporté');
    }
    throw new Error('Aucun fichier .fit dans cette archive');
  },
  decode(buf){
    const dv = new DataView(buf); const hs = dv.getUint8(0);
    if (buf.byteLength < 14 || String.fromCharCode(dv.getUint8(8),dv.getUint8(9),dv.getUint8(10),dv.getUint8(11)) !== '.FIT') throw new Error("Ce n'est pas un fichier FIT valide");
    const end = Math.min(hs + dv.getUint32(4, true), buf.byteLength - 2);
    const defs = {}; let p = hs, lastTs = 0;
    const out = { records:[], sessions:[], laps:[], user:{}, zones:{}, workout:{}, fileId:{} };
    const SZ = {0:1,1:1,2:1,3:2,4:2,5:4,6:4,7:1,8:4,9:8,10:1,11:2,12:4,13:1,14:8,15:8,16:8};
    const readVal = (bt, off, size, le) => {
      const t = bt & 0x1f;
      if (t === 7) { let s = ''; const bytes = []; for (let i=0;i<size;i++){ const c = dv.getUint8(off+i); if (!c) break; bytes.push(c); } try { s = new TextDecoder().decode(new Uint8Array(bytes)); } catch(e){} return s; }
      if (size !== SZ[t]) return null; // tableaux ignorés
      let v;
      switch (t){
        case 0: case 2: v = dv.getUint8(off); return v === 0xFF ? null : v;
        case 10: case 13: v = dv.getUint8(off); return v === 0 ? null : v;
        case 1: v = dv.getInt8(off); return v === 0x7F ? null : v;
        case 3: v = dv.getInt16(off, le); return v === 0x7FFF ? null : v;
        case 4: v = dv.getUint16(off, le); return v === 0xFFFF ? null : v;
        case 11: v = dv.getUint16(off, le); return v === 0 ? null : v;
        case 5: v = dv.getInt32(off, le); return v === 0x7FFFFFFF ? null : v;
        case 6: v = dv.getUint32(off, le); return v === 0xFFFFFFFF ? null : v;
        case 12: v = dv.getUint32(off, le); return v === 0 ? null : v;
        case 8: v = dv.getFloat32(off, le); return isFinite(v) ? v : null;
        case 9: v = dv.getFloat64(off, le); return isFinite(v) ? v : null;
        default: return null;
      }
    };
    const readData = (local, ts) => {
      const d = defs[local]; if (!d) throw new Error('Définition FIT manquante');
      const m = {};
      for (const f of d.fields) { m[f.num] = readVal(f.type, p, f.size, d.le); p += f.size; }
      p += d.devSize;
      if (m[253] != null) lastTs = m[253]; else if (ts != null) m[253] = ts;
      handle(d.gnum, m);
    };
    const handle = (g, m) => {
      const t = m[253] != null ? (m[253] + FIT_EPOCH) : null;
      if (g === 20) out.records.push({ t, hr: m[3], cad: m[4], pw: m[7], dist: m[5] != null ? m[5]/100000 : null,
        lat: m[0] != null ? m[0]*180/2147483648 : null, lon: m[1] != null ? m[1]*180/2147483648 : null,
        alt: m[78] != null ? m[78]/5-500 : m[2] != null ? m[2]/5-500 : null, spd: (m[73] ?? m[6]) != null ? (m[73] ?? m[6])/1000*3.6 : null });
      else if (g === 18) out.sessions.push({ avgSpeed: (m[124] ?? m[14]) != null ? (m[124] ?? m[14])/1000 : null, maxSpeed: (m[125] ?? m[15]) != null ? (m[125] ?? m[15])/1000 : null, ascent: m[22] ?? null, start: m[2] != null ? m[2]+FIT_EPOCH : t, sport: m[5], subSport: m[6], elapsed: m[7]!=null?m[7]/1000:null, timer: m[8]!=null?m[8]/1000:null, distKm: m[9]!=null?m[9]/100000:null, avgHr: m[16], maxHr: m[17], avgCad: m[18], avgPw: m[20], maxPw: m[21], np: m[34], tss: m[35]!=null?m[35]/10:null, if: m[36]!=null?m[36]/1000:null, ftp: m[45] });
      else if (g === 19) out.laps.push({ start: m[2]!=null?m[2]+FIT_EPOCH:null, timer: m[8]!=null?m[8]/1000:null, avgPw: m[19], avgHr: m[15] });
      else if (g === 3) Object.assign(out.user, { sex: m[1]===1?'M':m[1]===0?'F':null, age: m[2], heightCm: m[3]!=null?m[3]:null, weightKg: m[4]!=null?m[4]/10:null, hrMaxBike: m[10], hrMax: m[11] });
      else if (g === 7) Object.assign(out.zones, { hrMax: m[1], lthr: m[2], ftp: m[3] });
      else if (g === 26) Object.assign(out.workout, { name: m[8] });
      else if (g === 0) Object.assign(out.fileId, { type: m[0], created: m[4]!=null?m[4]+FIT_EPOCH:null });
    };
    while (p < end) {
      const h = dv.getUint8(p++);
      if (h & 0x80) { // en-tête à horodatage compressé
        const local = (h >> 5) & 3, off = h & 0x1f;
        let ts = (lastTs & ~0x1f) + off; if (off < (lastTs & 0x1f)) ts += 0x20; lastTs = ts;
        readData(local, ts);
      } else if (h & 0x40) { // définition
        const local = h & 0x0f, dev = h & 0x20; p++;
        const le = dv.getUint8(p++) === 0; const gnum = dv.getUint16(p, le); p += 2;
        const n = dv.getUint8(p++); const fields = [];
        for (let i=0;i<n;i++){ fields.push({ num: dv.getUint8(p), size: dv.getUint8(p+1), type: dv.getUint8(p+2) }); p += 3; }
        let devSize = 0;
        if (dev) { const nd = dv.getUint8(p++); for (let i=0;i<nd;i++){ devSize += dv.getUint8(p+1); p += 3; } }
        defs[local] = { le, gnum, fields, devSize };
      } else readData(h & 0x0f, null);
    }
    return out;
  },
};

/* ============ métriques ============ */
function powerSeries(recs, key='pw'){ // série 1 Hz, trous ≤ 5 s comblés
  const arr = []; let prev = null;
  for (const r of recs) {
    if (r.t == null) continue;
    const v = r[key] ?? 0;
    if (prev != null) { const dt = r.t - prev.t; const fill = Math.min(Math.max(dt,1), 5); for (let i=1;i<fill;i++) arr.push(prev.v); }
    arr.push(v); prev = { t: r.t, v };
  }
  return arr;
}
function bestAvg(arr, w){ if (arr.length < w) return null; let s=0, b=0; for (let i=0;i<arr.length;i++){ s += arr[i]; if (i>=w) s -= arr[i-w]; if (i>=w-1 && s>b) b = s; } return Math.round(b/w); }
function normPower(arr){ if (arr.length < 30) return null; let s=0, acc=0, n=0; for (let i=0;i<arr.length;i++){ s += arr[i]; if (i>=30) s -= arr[i-30]; if (i>=29){ acc += Math.pow(s/30,4); n++; } } return Math.round(Math.pow(acc/n, .25)); }
const tssFrom = (durS, np, f) => np && f ? Math.round(durS * np * (np/f) / (f*3600) * 100) : null;
function hrTSS(durS, avgHr, hrMax){ if (!avgHr || !hrMax) return null; const lthr = 0.9*hrMax; return Math.round(durS/3600 * Math.pow(avgHr/lthr, 2) * 100); }
function activityFromFit(fit, fname){
  const recs = fit.records.filter(r => r.t != null);
  if (!recs.length && !fit.sessions.length) throw new Error('Aucune donnée dans ce fichier');
  const sess = fit.sessions[0] || {};
  const pw = powerSeries(recs, 'pw'), hr = powerSeries(recs, 'hr');
  const hasPower = !fit.noPower && pw.some(v => v > 0);
  const durS = sess.timer || pw.length || 0;
  const start = sess.start || recs[0]?.t;
  const date = start ? iso(new Date(start*1000)) : todayISO();
  const hrVals = recs.map(r=>r.hr).filter(Boolean), cad = recs.map(r=>r.cad).filter(Boolean);
  const np = hasPower ? normPower(pw) : null;
  const avgPower = hasPower ? Math.round(pw.reduce((a,b)=>a+b,0)/pw.length) : null;
  const a = {
    id: uid(), source:'fit', date, startTs: start, name: fit.workout.name || fname.replace(/\.(fit|gz)$/gi,''),
    durationS: Math.round(durS), distanceKm: sess.distKm != null ? +sess.distKm.toFixed(1) : null,
    avgPower, np, maxPower: hasPower ? Math.max(...pw) : null,
    avgHr: hrVals.length ? Math.round(hrVals.reduce((a,b)=>a+b,0)/hrVals.length) : (sess.avgHr||null),
    maxHr: hrVals.length ? Math.max(...hrVals) : (sess.maxHr||null),
    avgCad: cad.length ? Math.round(cad.reduce((a,b)=>a+b,0)/cad.length) : (sess.avgCad||null),
    hasPower, indoor: sess.subSport === 6 || sess.subSport === 58,
    avgSpeed: sess.avgSpeed > 0 ? +(sess.avgSpeed*3.6).toFixed(1) : null, maxSpeed: sess.maxSpeed > 0 ? +(sess.maxSpeed*3.6).toFixed(1) : null, elevM: sess.ascent != null ? Math.round(sess.ascent) : null,
    best: hasPower ? { s5: bestAvg(pw,5), m1: bestAvg(pw,60), m5: bestAvg(pw,300), m8: bestAvg(pw,480), m20: bestAvg(pw,1200), m60: bestAvg(pw,3600) } : null,
    hrBest20: bestAvg(hr, 1200),
    feel: null, planId: null, compliance: null,
    pwSample: hasPower ? downsample(pw, 300) : null, hrSample: hr.some(v=>v>0) ? downsample(hr, 300) : null,
    cadSample: (() => { const c = powerSeries(recs, 'cad'); return c.some(v=>v>0) ? downsample(c, 300) : null; })(),
    spdSample: (() => { const c = powerSeries(recs, 'spd'); return c.some(v=>v>0) ? downsample(c, 300) : null; })(),
    altSample: (() => { const f = recs.find(r => r.alt != null); if (!f) return null; let last = f.alt; // trous d'altitude : dernière valeur connue
      return downsample(powerSeries(recs.map(r => { if (r.alt != null) last = r.alt; return { t: r.t, alt: last }; }), 'alt'), 300); })(),
    sampleSecs: Math.max(pw.length, hr.length) || Math.round(durS),
  };
  return a;
}
function downsample(arr, n){ if (arr.length <= n) return arr.slice(); const out = [], k = arr.length/n; for (let i=0;i<n;i++){ const s = Math.floor(i*k), e = Math.floor((i+1)*k); let sum=0; for (let j=s;j<e;j++) sum += arr[j]; out.push(Math.round(sum/(e-s))); } return out; }
function computeLoad(a){
  const f = ftpAt(a.date);
  a.if = a.np ? +(a.np/f).toFixed(2) : null;
  a.tss = a.np ? tssFrom(a.durationS, a.np, f) : (hrTSS(a.durationS, a.avgHr, S.profile?.hrMax) ?? (a.feel?.rpe ? Math.round(a.durationS/3600 * Math.pow(a.feel.rpe/10*1.05,2)*100) : null));
}
function ftpAt(date){ let f = S.ftpHistory[0]?.ftp || ftp(); for (const h of S.ftpHistory) if (h.date <= date) f = h.ftp; return f; }
// respect des cibles : moyenne de TOUS les blocs d'effort (et plus le meilleur bloc), calculée par blocksOf()
// a._pw / a._hr : séries 1 Hz, présentes seulement au moment de l'import
/* ============ rattachement automatique au plan ============ */
// une activité importée ne remplit une séance prévue que si elle peut vraiment en tenir lieu
// (un trajet vélo de 16 min sans capteur n'est pas un test rampe)
function planFits(a, s){
  const W = WORKOUTS[s?.workoutId]; if (!W) return false;
  if ((a.durationS || 0) < wDur(s.workoutId) * 0.6) return false;
  if (W.type === 'test') return !!a.hasPower;
  if (['end','rec','tempo'].includes(W.type)) return true;
  return !!a.hasPower || a.indoor === true;
}
const autoPlanFor = a => S.plan.find(s => s.date === a.date && s.status === 'planned' && planFits(a, s)) || null;
// répare les rattachements automatiques faits avant ces règles (sorties Apple Santé / Intervals sans puissance)
function repairAutoLinks(){
  let n = 0;
  // enregistrements parasites de quelques secondes ; sorties d'avant le programme qui ne comptent pas comme séances
  const junk = S.activities.filter(a => a.source === 'intervals' && !a.planId && (a.durationS || 0) < 120);
  if (junk.length) { S.activities = S.activities.filter(a => !junk.includes(a)); n += junk.length; }
  for (const a of S.activities) if (a.countAsSession && !a.planId && !a.linkManual && S.profile?.startDate && a.date < S.profile.startDate) { a.countAsSession = false; n++; }
  for (const a of S.activities) {
    if (a.source !== 'health' || !a.planId || a.linkManual) continue;
    const pl = S.plan.find(s => s.id === a.planId);
    if (pl && !planFits(a, pl)) { if (pl.activityId === a.id) { pl.status = 'planned'; pl.activityId = null; } a.planId = null; a.countAsSession = a.durationS >= 1800; a.blocks = null; a.compliance = null; n++; }
  }
  return n;
}
const speedOf = a => a.avgSpeed || (a.distanceKm && a.durationS ? +(a.distanceKm / (a.durationS/3600)).toFixed(1) : null);

function compliance(a, planItem){
  if (!planItem) { a.blocks = null; return null; }
  const B = blocksOf(a, planItem, a._pw, a._hr);
  a.blocks = B && a._pw ? B : null; // on ne persiste que le calcul fait à 1 Hz
  const us = (B?.units || []).filter(u => u.cover >= 0.5);
  if (!us.length) return null;
  const D = us.reduce((s,u)=>s+u.d,0), got = us.reduce((s,u)=>s+u.got*u.d,0)/D, target = us.reduce((s,u)=>s+u.target*u.d,0)/D;
  return { stepMin: Math.round(us[0].d/60), target: Math.round(target), got: Math.round(got), ratio: +(got/target).toFixed(3) };
}

/* ============ évaluation de séance ============ */
// Tolérances (réalisé / cible) et RPE attendu par type de séance.
// band = vert · warn = orange · au-delà = rouge. drift : la dérive cardiaque compte-t-elle ?
const EVAL = {
  end:  { band:[0.90,1.08], warn:[0.85,1.15], rpe:[3,4], drift:true },
  tempo:{ band:[0.95,1.04], warn:[0.90,1.08], rpe:[5,6], drift:true },
  ss:   { band:[0.95,1.03], warn:[0.90,1.08], rpe:[6,7], drift:true },
  force:{ band:[0.95,1.04], warn:[0.90,1.08], rpe:[6,7], drift:true },
  thr:  { band:[0.96,1.03], warn:[0.92,1.06], rpe:[7,8], drift:true },
  vo2:  { band:[0.95,1.05], warn:[0.90,1.10], rpe:[8,9], drift:false },
  rec:  { band:null, warn:null, rpe:[1,3], drift:false },
};
const DRIFT = [0.05, 0.10]; // dérive W/FC : < 5 % vert, < 10 % orange
// blocs d'effort du plan : un bloc long = une unité ; une répétition de petits efforts (30/30, relances, over-unders) = une « série »
function planUnits(wid){
  const W = WORKOUTS[wid]; if (!W || W.type === 'test' || W.type === 'rec') return { units:[], prof:[], dur:0 };
  const thr = W.type === 'end' ? 60 : 75;
  const isWork = s => (s.int || 'active') === 'active' && !s.max && !s.wu && s.p >= thr;
  const units = [], prof = []; let t = 0, nb = 0, ns = 0;
  const lay = s => { const st = { ...s, t0: t }; prof.push(st); t += s.d; return st; };
  for (const top of W.steps) {
    if (!top.repeat) { const st = lay(top); if (isWork(st)) units.push({ label:`Bloc ${++nb}`, steps:[st] }); continue; }
    for (let r = 0; r < top.repeat; r++) {
      const work = flat(top.steps).map(lay).filter(isWork);
      if (!work.length) continue;
      if (work.length === 1 && work[0].d >= 120) units.push({ label:`Bloc ${++nb}`, steps:work });
      else units.push({ label:`Série ${++ns}`, steps:work });
    }
  }
  return { units, prof, dur: t };
}
// aligne le plan sur la puissance réelle puis mesure chaque bloc ; pw/hr = séries régulières (pas dt secondes)
function measureUnits(wid, scale, pw, hr, dt){
  const P = planUnits(wid); if (!P.units.length || !pw?.length) return null;
  const n = pw.length, at = (arr, k) => (k >= 0 && k < n ? (arr[k] || 0) : 0);
  const tgt = sec => { for (const s of P.prof) if (sec < s.t0 + s.d) return s.max ? null : s.p/100*scale; return null; };
  const T = Array.from({ length: Math.ceil(P.dur/dt) }, (_, k) => tgt(k*dt));
  const score = (o, k0, k1) => { let e = 0, c = 0; for (let k = Math.max(0,k0); k < Math.min(T.length,k1); k++) { if (T[k] == null) continue; e += Math.abs(at(pw, k+o) - T[k]); c++; } return c ? e/c : Infinity; };
  // 1) décalage global (échauffement rallongé ou raccourci, départ en retard…)
  const step = Math.max(1, Math.round(5/dt)), lo = -Math.round(600/dt), hi = Math.round(1200/dt);
  let best = 0, bs = Infinity;
  for (let o = lo; o <= hi; o += step) { const s = score(o, 0, T.length); if (s < bs) { bs = s; best = o; } }
  for (let o = best-step; o <= best+step; o++) { const s = score(o, 0, T.length); if (s < bs) { bs = s; best = o; } }
  // 2) recalage bloc par bloc (pauses, récup prolongée) : ± 90 s autour du décalage précédent
  let off = best; const w = Math.round(90/dt), m = Math.round(60/dt);
  const avg = (arr, a0, a1, pos) => { let s = 0, c = 0; for (let k = a0; k < a1; k++) if (k >= 0 && k < n && (!pos || arr[k] > 0)) { s += arr[k] || 0; c++; } return c ? s/c : null; };
  const units = P.units.map(u => {
    const k0 = Math.floor(u.steps[0].t0/dt), last = u.steps[u.steps.length-1], k1 = Math.ceil((last.t0+last.d)/dt);
    let bo = off, bsc = Infinity;
    for (let o = off-w; o <= off+w; o++) { const s = score(o, k0-m, k1+m); if (s < bsc) { bsc = s; bo = o; } }
    off = bo;
    let gs = 0, ts = 0, D = 0, cov = 0;
    for (const s of u.steps) {
      const trim = Math.min(20, 0.1*s.d); // laisse l'ERG monter en puissance
      const a0 = Math.round((s.t0+trim)/dt)+off, a1 = Math.round((s.t0+s.d)/dt)+off;
      // puissance nulle = pas de pédalage (arrêt, pause) : compté comme non fait, pas comme un bloc sous la cible
      let sv = 0, c = 0; for (let k = Math.max(a0,0); k < Math.min(a1,n); k++) if (pw[k] > 0) { sv += pw[k]; c++; }
      const f = c / Math.max(1, a1-a0);
      cov += f*s.d; gs += (c ? sv/c : 0)*f*s.d; ts += s.p/100*scale*s.d; D += s.d;
    }
    const span = last.t0 + last.d - u.steps[0].t0, u0 = Math.round(u.steps[0].t0/dt)+off, u1 = u0 + Math.round(span/dt);
    const e0 = u0 + Math.round(Math.max(60, span/3)/dt); // la FC met du temps à monter : on la lit sur la fin du bloc
    const r = { label:u.label, d:D, sd: D/u.steps.length, target:Math.round(ts/D), got: cov ? Math.round(gs/cov) : 0, cover:+(cov/D).toFixed(2) };
    if (hr && span >= 300) { const h = avg(hr, e0, u1, 1), p = avg(pw, e0, u1); if (h > 60 && p) { r.he = Math.round(h); r.pe = Math.round(p); } }
    if (hr && span >= 1200) { const mid = Math.round((u0+u1)/2), s0 = u0 + Math.round(120/dt);
      const h1 = avg(hr, s0, mid, 1), h2 = avg(hr, mid, u1, 1), p1 = avg(pw, s0, mid), p2 = avg(pw, mid, u1);
      if (h1 > 60 && h2 > 60 && p1 && p2) r.halves = [[Math.round(p1), Math.round(h1)], [Math.round(p2), Math.round(h2)]]; }
    return r;
  });
  return { units, offset: Math.round(best*dt) };
}
const blocksKey = pl => `${pl.id}|${pl.workoutId}`;
// blocs mesurés : à 1 Hz si dispo (import), sinon calcul persistant, sinon à partir des échantillons (≈ 300 points)
function blocksOf(a, pl, pw1, hr1){
  if (!pl || !a.hasPower) return null;
  const scale = ftpAt(a.date) * adj() * sAdj(pl);
  if (pw1?.length) { const m = measureUnits(pl.workoutId, scale, pw1, hr1?.some(v=>v>0) ? hr1 : null, 1); return m && { key: blocksKey(pl), ...m }; }
  if (a.blocks?.key === blocksKey(pl)) return a.blocks;
  if (!a.pwSample) return null;
  const n = a.pwSample.length, dt = (a.sampleSecs || a.durationS || n) / n;
  const hr = a.hrSample && a.hrSample.length === n ? a.hrSample : null;
  const m = measureUnits(pl.workoutId, scale, a.pwSample, hr, dt); return m && { key: blocksKey(pl), ...m };
}
function cardiacDrift(units){
  const u = units.filter(x => x.he && x.pe && x.cover >= 0.8);
  if (u.length >= 2) { const ef0 = u[0].pe/u[0].he; let d = 0, at = 1; u.slice(1).forEach((x,i) => { const v = 1 - (x.pe/x.he)/ef0; if (v > d) { d = v; at = i+1; } }); return { v:d, how:`${u[at].label} vs ${u[0].label}` }; }
  const h = units.find(x => x.halves); if (h) { const [[p1,h1],[p2,h2]] = h.halves; return { v: 1 - (p2/h2)/(p1/h1), how:'2ᵉ moitié vs 1ʳᵉ' }; }
  return null;
}
const pctTxt = r => `${Math.round(r*100)} %`;
// verdict : pire des critères (complétion, précision, dérive cardiaque, RPE) + une cause et un conseil
function sessionEval(a, pl, feelOverride){
  if (!a || !pl) return null;
  const W = WORKOUTS[pl.workoutId]; const cfg = W && EVAL[W.type]; if (!cfg) return null; // tests : évalués par le résultat FTP
  const fe = feelOverride || a.feel || {};
  const B = cfg.band ? blocksOf(a, pl) : null;
  const units = (B?.units || []).map(u => {
    const r = u.target ? u.got/u.target : 0, wd = u.sd < 90 ? 0.03 : 0; // efforts courts : l'ERG met quelques secondes à suivre
    const lvl = r >= cfg.band[0]-wd && r <= cfg.band[1]+wd ? 0 : r >= cfg.warn[0]-wd && r <= cfg.warn[1]+wd ? 1 : 2;
    return { ...u, r, lvl, over: r > cfg.band[1]+wd, under: r < cfg.band[0]-wd };
  });
  const C = {};
  if (units.length) {
    const D = units.reduce((s,u)=>s+u.d,0), done = units.filter(u => u.r >= 0.85).reduce((s,u)=>s+u.d*u.cover,0), c = done/D;
    C.comp = { v:c, lvl: c >= 0.95 ? 0 : c >= 0.80 ? 1 : 2 };
    const meas = units.filter(u => u.cover >= 0.5);
    if (meas.length) C.prec = { lvl: Math.max(...meas.map(u=>u.lvl)) };
    if (cfg.drift) { const d = cardiacDrift(units); if (d) C.drift = { v:d.v, how:d.how, lvl: d.v < DRIFT[0] ? 0 : d.v < DRIFT[1] ? 1 : 2 }; }
  }
  const rpe = fe.rpe || null, [rLo, rHi] = cfg.rpe;
  if (rpe) C.rpe = { v:rpe, lvl: rpe <= rHi ? 0 : rpe === rHi+1 ? 1 : 2 };
  const legsHeavy = !!(fe.legs && fe.legs <= 2);
  const lvl = Math.max(0, ...Object.values(C).map(c => c.lvl));
  const over = units.filter(u => u.over && u.cover >= 0.5), under = units.filter(u => u.under && u.cover >= 0.5);
  const worst = arr => arr.slice().sort((x,y) => Math.abs(y.r-1) - Math.abs(x.r-1))[0];
  const rpeHigh = (C.rpe?.lvl || 0) >= 1, driftHigh = (C.drift?.lvl || 0) >= 1, easyRpe = rpe && rpe < rLo;
  let cause, advice;
  if (C.comp?.lvl === 2) {
    cause = 'missed';
    advice = legsHeavy ? "Jambes lourdes : c'est de la fatigue. Allège ou décale la prochaine séance clé."
      : under.length ? "Cibles non tenues : FTP peut-être surestimée ou récupération insuffisante. Si ça se répète, baisse les cibles."
      : "Séance écourtée : une partie des blocs manque.";
  } else if (C.comp?.lvl === 1 && !rpeHigh && !over.length && !under.length) {
    cause = 'partial'; advice = `Séance presque complète : ${pctTxt(C.comp.v)} du travail prévu réalisé. Rien à changer pour la suite.`;
  } else if (over.length && (rpeHigh || driftHigh)) {
    const u = worst(over); cause = 'over';
    advice = `Trop appuyé : ${u.label.toLowerCase()} à ${pctTxt(u.r)} de la cible. Garde la même puissance sur tous les blocs${W.type==='ss'||W.type==='tempo'?' : ce type de séance doit laisser de la marge.':'.'}`;
  } else if (under.length && rpeHigh) {
    cause = legsHeavy ? 'fatigue' : 'hard';
    advice = legsHeavy ? "Cibles non tenues avec les jambes lourdes : c'est de la fatigue. Allège ou décale la prochaine séance clé."
      : "Cibles non tenues malgré un effort élevé : FTP peut-être surestimée ou récupération insuffisante. Si ça se répète, l'app te proposera de baisser les cibles.";
  } else if (rpeHigh && legsHeavy) {
    cause = 'fatigue'; advice = "Puissance tenue, mais effort élevé et jambes lourdes : c'est de la fatigue. Allège ou décale la prochaine séance clé.";
  } else if (rpeHigh) {
    cause = 'cost'; advice = "Puissance dans la cible mais effort plus élevé que prévu : vérifie sommeil, alimentation, chaleur. Garde les mêmes cibles.";
  } else if (driftHigh) {
    cause = 'drift'; advice = `Dérive cardiaque de ${pctTxt(C.drift.v)} : pense ventilateur et hydratation. Cibles inchangées.`;
  } else if (over.length) {
    const u = worst(over); cause = 'over'; advice = `Un peu au-dessus de la cible (${u.label.toLowerCase()} à ${pctTxt(u.r)}). Sans conséquence aujourd'hui, mais reste dans la plage.`;
  } else if (under.length) {
    const u = worst(under); cause = 'under'; advice = `Un peu sous la cible (${u.label.toLowerCase()} à ${pctTxt(u.r)}). Si l'effort te paraissait juste, c'est normal ; sinon, vise la plage.`;
  } else if (easyRpe && (!C.drift || C.drift.v < 0.03)) {
    cause = 'easy'; advice = `Tout dans la cible avec un RPE de ${rpe} (attendu ${rLo}-${rHi}). Si la prochaine séance clé est aussi facile, monte les cibles.`;
  } else { cause = 'ok'; advice = units.length ? "Séance dans la cible, effort conforme. Rien à changer." : "Effort conforme à ce qui était prévu."; }
  const icon = ['✅','⚠️','❌'][lvl];
  const title = cause === 'missed' ? 'Séance manquée' : cause === 'partial' ? 'Presque complète'
    : lvl === 0 ? (cause === 'easy' ? 'Objectif atteint · facile' : 'Objectif atteint')
    : cause === 'hard' ? 'Cibles non tenues'
    : cause === 'under' ? 'Un peu sous la cible'
    : cause === 'over' && !rpeHigh && !driftHigh ? 'Un peu au-dessus de la cible'
    : lvl === 2 ? 'Bien trop dure' : 'Atteinte, mais trop dure';
  return { lvl, cause, icon, title, advice, units, C, rpe, rpeRange: cfg.rpe, legs: fe.legs || null, legsHeavy, pending: !rpe, type: W.type };
}
const LEGS = ['Vides','Lourdes','Normales','Bonnes','Top'];
function evalHTML(a, pl){
  const e = sessionEval(a, pl); if (!e) return '';
  const col = l => ['var(--ok)','var(--warn)','var(--bad)'][l];
  const dot = l => `<i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${col(l)}"></i>`;
  const chip = (l, txt) => `<span class="chip" style="color:var(--text)">${l == null ? '' : dot(l)}${txt}</span>`;
  const crit = [];
  if (e.C.comp) crit.push(chip(e.C.comp.lvl, `Complétion ${pctTxt(e.C.comp.v)}`));
  if (e.C.drift) crit.push(chip(e.C.drift.lvl, `Dérive cardiaque ${(e.C.drift.v*100).toFixed(1).replace('.',',')} %`));
  crit.push(e.rpe ? chip(e.C.rpe.lvl, `RPE ${e.rpe} · attendu ${e.rpeRange[0]}-${e.rpeRange[1]}`) : chip(null, 'RPE à saisir'));
  if (e.legs) crit.push(chip(null, `Jambes ${LEGS[e.legs-1].toLowerCase()}`));
  const blocks = e.units.length ? `<div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap">${e.units.map(u => `<span class="chip num" title="cible ${u.target} W" style="color:var(--text)">${dot(u.cover < 0.5 ? 2 : u.lvl)}${esc(u.label.replace('Bloc ','B').replace('Série ','S'))} · ${u.cover < 0.5 ? 'non fait' : `${u.got} W · ${pctTxt(u.r)}`}</span>`).join('')}</div>` : '';
  return `<div class="note ${['ok','warn','bad'][e.lvl]}" style="margin-top:12px"><b>${e.icon} ${esc(e.title)}${e.pending ? ' <span class="tiny muted">(provisoire)</span>' : ''}</b>
    <div class="small" style="margin-top:4px">${esc(e.advice)}</div>${blocks}
    <div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap">${crit.join('')}</div>
    ${e.pending ? `<button class="btn sm" data-feelact="${a.id}" style="margin-top:10px">Ajouter mon ressenti</button>` : ''}</div>`;
}
