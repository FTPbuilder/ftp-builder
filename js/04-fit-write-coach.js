"use strict";
// FTP Builder · écriture de séance FIT (workout), coach, charge CTL/ATL
/* ============ FIT : écriture de séance (workout) ============ */
const CRC_T = [0x0000,0xCC01,0xD801,0x1400,0xF001,0x3C00,0x2800,0xE401,0xA001,0x6C00,0x7800,0xB401,0x5000,0x9C01,0x8801,0x4400];
function fitCrc(bytes, crc=0){ for (const b of bytes){ let t = CRC_T[crc & 0xF]; crc = (crc >> 4) & 0x0FFF; crc = crc ^ t ^ CRC_T[b & 0xF]; t = CRC_T[crc & 0xF]; crc = (crc >> 4) & 0x0FFF; crc = crc ^ t ^ CRC_T[(b >> 4) & 0xF]; } return crc; }
const ascii = s => String(s).replace(/×/g,'x').replace(/·/g,'-').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^\x20-\x7e]/g,'');
function encodeWorkout(wid, f){
  const W = WORKOUTS[wid]; const bytes = [];
  const u8 = v => bytes.push(v & 0xFF);
  const u16 = v => { u8(v); u8(v >> 8); };
  const u32 = v => { u8(v); u8(v >> 8); u8(v >> 16); u8(v >>> 24); };
  const str = (s, n) => { const a = ascii(s).slice(0, n-1); for (let i=0;i<n;i++) u8(i < a.length ? a.charCodeAt(i) : 0); };
  const def = (local, gnum, fields) => { u8(0x40 | local); u8(0); u8(0); u16(gnum); u8(fields.length); for (const [n,s,t] of fields){ u8(n); u8(s); u8(t); } };
  // étapes : un niveau de répétition natif, répétitions imbriquées dépliées
  const steps = [];
  const pushStep = s => steps.push({ kind:'step', s });
  for (const top of W.steps) {
    if (!top.repeat) { pushStep(top); continue; }
    const hasNested = top.steps.some(x => x.repeat);
    if (hasNested) {
      for (let r=0;r<top.repeat;r++) for (const x of top.steps) {
        if (x.repeat) { const from = steps.length; x.steps.forEach(pushStep); steps.push({ kind:'rep', from, n: x.repeat }); }
        else pushStep(x);
      }
    } else { const from = steps.length; top.steps.forEach(pushStep); steps.push({ kind:'rep', from, n: top.repeat }); }
  }
  const now = Math.floor(Date.now()/1000) - FIT_EPOCH;
  def(0, 0, [[0,1,0x00],[1,2,0x84],[2,2,0x84],[3,4,0x8C],[4,4,0x86]]);
  u8(0); u8(5); u16(255); u16(0); u32((Math.random()*0xFFFFFFF|0)+1); u32(now);
  def(1, 26, [[8,32,0x07],[4,1,0x00],[5,4,0x8C],[6,2,0x84]]);
  u8(1); str(W.name, 32); u8(2); u32(0x20); u16(steps.length);
  def(2, 27, [[254,2,0x84],[0,16,0x07],[1,1,0x00],[2,4,0x86],[3,1,0x00],[4,4,0x86],[5,4,0x86],[6,4,0x86],[7,1,0x00]]);
  const INT = { active:0, rest:1, warmup:2, cooldown:3 };
  steps.forEach((st, i) => {
    u8(2); u16(i);
    if (st.kind === 'rep') { str('Repeter', 16); u8(6); u32(st.from); u8(2); u32(st.n); u32(0); u32(0); u8(0); return; }
    const s = st.s; const w = s.p/100 * f * adj();
    const name = s.max ? 'A FOND' : `${s.label}`;
    str(name, 16); u8(0); u32(s.d*1000);
    if (s.max) { u8(2); u32(0); u32(0); u32(0); }
    else { u8(4); u32(0); u32(Math.round(w*0.97)+1000); u32(Math.round(w*1.03)+1000); }
    u8(INT[s.int||'active'] ?? 0);
  });
  const data = Uint8Array.from(bytes);
  const hdr = [14, 0x20, ...[2132 & 0xFF, 2132 >> 8], ...[data.length & 0xFF, (data.length>>8)&0xFF, (data.length>>16)&0xFF, (data.length>>>24)&0xFF], 0x2E,0x46,0x49,0x54];
  const hcrc = fitCrc(hdr); hdr.push(hcrc & 0xFF, hcrc >> 8);
  const all = new Uint8Array(hdr.length + data.length + 2);
  all.set(hdr, 0); all.set(data, hdr.length);
  const crc = fitCrc(all.subarray(0, hdr.length + data.length));
  all[all.length-2] = crc & 0xFF; all[all.length-1] = crc >> 8;
  return all;
}
function download(name, bytes, type='application/octet-stream'){
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function exportWorkout(planOrWid){
  const wid = typeof planOrWid === 'string' ? planOrWid : planOrWid.workoutId;
  const date = typeof planOrWid === 'string' ? todayISO() : planOrWid.date;
  const bytes = encodeWorkout(wid, ftp() * (typeof planOrWid === 'string' ? 1 : sAdj(planOrWid)));
  download(`${date}_${ascii(WORKOUTS[wid].name).replace(/[^A-Za-z0-9]+/g,'-')}.fit`, bytes);
  toast('Fichier .fit téléchargé : copie-le dans Garmin/NewFiles de ton Edge');
}

/* ============ coach ============ */
function coachNotes(){
  const notes = [];
  const p = S.profile; if (!p) return notes;
  const done = S.plan.filter(s => s.status==='done');
  const doneCount = countDone();
  const t = todayISO();
  const daysLeft = Math.max(diffDays(t, p.endDate), 0), weeksLeft = daysLeft/7;
  const need = Math.max(p.minSessions - doneCount, 0);
  if (need > 0 && weeksLeft > 0) {
    const rate = need / weeksLeft;
    if (rate > 3) notes.push({ cls:'bad', t:`Il reste ${need} séances en ${Math.round(weeksLeft)} semaines (${rate.toFixed(1)}/sem.) : l'objectif des ${p.minSessions} devient difficile.` });
    else if (rate > 2.2) notes.push({ cls:'', t:`Rythme à tenir : ${rate.toFixed(1)} séances/semaine pour atteindre ${p.minSessions}.` });
  } else if (need === 0) notes.push({ cls:'ok', t:`Objectif des ${p.minSessions} séances atteint. Tout ce qui suit, c'est du bonus.` });
  // ressentis séances clés
  // verdicts des deux dernières séances clés évaluées (avec ressenti)
  const keyEv = S.activities.filter(a => a.planId && a.feel?.rpe).map(a => { const pl = S.plan.find(s=>s.id===a.planId); return pl?.kind === 'key' ? { a, e: sessionEval(a, pl) } : null; })
    .filter(x => x?.e).sort((x,y)=>x.a.date.localeCompare(y.a.date)).slice(-2).map(x => x.e);
  if (keyEv.length === 2) {
    const hard = keyEv.every(e => e.cause === 'hard' || (e.cause === 'missed' && !e.legsHeavy && e.units.some(u => u.under)));
    const easy = keyEv.every(e => e.cause === 'easy');
    const tired = keyEv.every(e => e.legsHeavy && e.lvl >= 1);
    if (hard) notes.push({ cls:'bad', t:`Tes deux dernières séances clés : cibles non tenues malgré un effort élevé. Je te propose de baisser les cibles de 3 %.`, action:{ label:'Baisser de 3 %', f:()=>{ p.intensityAdj = +(adj()*0.97).toFixed(3); } } });
    else if (easy) notes.push({ cls:'ok', t:`Deux séances clés dans la cible avec un effort sous l'attendu. Tu peux monter les cibles de 2 %.`, action:{ label:'Monter de 2 %', f:()=>{ p.intensityAdj = +(adj()*1.02).toFixed(3); } } });
    else if (tired) notes.push({ cls:'', t:`Deux séances clés de suite avec les jambes lourdes : c'est de la fatigue, pas un problème de cibles. Allège la prochaine séance clé ou ajoute un jour de repos.` });
  }
  if (adj() !== 1) notes.push({ cls:'', t:`Ajustement des cibles en cours : ${adj()>1?'+':''}${Math.round((adj()-1)*1000)/10} %.`, action:{ label:'Remettre à 0', f:()=>{ p.intensityAdj = 1; } } });
  const load = loadSeries(); const lastL = load[load.length-1];
  if (lastL && lastL.tsb < -25) notes.push({ cls:'bad', t:`Fatigue élevée (forme ${Math.round(lastL.tsb)}). Privilégie le sommeil et passe la prochaine séance en endurance si les jambes ne répondent pas.` });
  // séance manquée récente
  const missed = S.plan.filter(s => s.status==='planned' && s.date < t && diffDays(s.date, t) <= 3 && mandatory(s));
  if (missed.length) notes.push({ cls:'', t:`Séance non enregistrée : ${WORKOUTS[missed[0].workoutId].name} (${fmtDate(missed[0].date)}). Saisis-la, décale-la ou passe-la.`, plan: missed[0].id });
  return notes;
}
function countDone(){ return S.plan.filter(s => s.status==='done').length + S.activities.filter(a => !a.planId && a.countAsSession).length; }

/* ============ charge CTL / ATL ============ */
function loadSeries(){
  const hw = [...Health.extraWorkouts(), ...Health.exerciseLoad()];
  if (!S.activities.length && !hw.length) return [];
  const byDay = {}; for (const a of S.activities) byDay[a.date] = (byDay[a.date]||0) + (a.tss||0);
  for (const w of hw) byDay[w.date] = (byDay[w.date]||0) + w.tss;
  const first = [...S.activities.map(a=>a.date), ...hw.map(w=>w.date)].sort()[0]; const start = addDays(first < S.profile.startDate ? first : S.profile.startDate, -1);
  const end = todayISO(); const out = [];
  const longHistory = S.healthImportedAt && diffDays(start, end) >= 90;
  let ctl = longHistory ? 0 : (S.profile.ctl0 || 0), atl = ctl;
  for (let d = start; d <= end; d = addDays(d,1)) { const t = byDay[d]||0; const tsb = ctl - atl; ctl += (t-ctl)/42; atl += (t-atl)/7; out.push({ d, ctl, atl, tsb, tss:t }); }
  return out;
}
