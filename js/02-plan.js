"use strict";
// FTP Builder · planificateur FTP et plan triathlon
/* ============ planificateur ============ */
const BLOCKS = [
  // k[i][semaine du bloc] : séance clé n°1, n°2, n°3 (si 3 séances clés / semaine)
  { name:'Base · Sweet spot', k:[['ss_3x10','ss_3x12','ss_4x10'],['force_5x5','tempo_2x20','ss_ou'],['tempo_end','force_5x5','tempo_2x20']] },
  { name:'Sweet spot → Seuil', k:[['ss_2x20','thr_5x6','thr_4x8'],['force_4x8','ss_3x15','vo2_4x5'],['tempo_2x20','ss_ou','tempo_end']] },
  { name:'Seuil + VO2max', k:[['thr_3x12','thr_prog','thr_2x15'],['vo2_5x4','vo2_8x2','vo2_pyr'],['force_4x8','ss_2x20','ou_3x9']] },
  { name:'VO2max · Spécifique', k:[['vo2_6x3','vo2_4020','vo2_3030'],['thr_2x15','ou_3x9','thr_2x20'],['ss_ou','force_4x8','tempo_end']] },
];
// bloc spécifique triathlon montagne : force en cadence basse, seuil long, tempo (cols)
const TRI_SPEC = { name:'Spécifique montagne', k:[['force_4x8','thr_2x15','force_5x5'],['ss_2x20','tempo_2x20','thr_prog'],['tempo_end','ss_ou','ss_3x15']] };
const ALT = { // repli si la séance dépasse la durée dispo du jour
  ss:['ss_3x10','ss_3x12','ss_ou','ss_4x10','ss_2x20','ss_3x15'], thr:['thr_5x6','thr_4x8','ou_3x9','thr_prog','thr_3x12','thr_2x15','thr_2x20'], vo2:['vo2_8x2','vo2_6x3','vo2_4x5','vo2_5x4','vo2_pyr','vo2_4020','vo2_3030'],
  force:['force_5x5','force_4x8'], tempo:['tempo_2x20','tempo_end'], end:['end_60','end_neuro','end_90','end_120','end_150','end_180'], rec:['openers','rec_45'], test:['ramp','test20'] };
// échelles de difficulté (de la plus facile à la plus dure) pour « plus facile / plus dur »
const LADDER = {
  rec:['rec_45','openers'], end:['rec_45','end_60','end_neuro','end_90','end_120','end_150','end_180'], tempo:['tempo_end','tempo_2x20'],
  force:['force_5x5','force_4x8'], ss:['ss_3x10','ss_3x12','ss_ou','ss_4x10','ss_2x20','ss_3x15'],
  thr:['thr_5x6','thr_4x8','ou_3x9','thr_prog','thr_3x12','thr_2x15','thr_2x20'], vo2:['vo2_4x5','vo2_8x2','vo2_5x4','vo2_pyr','vo2_6x3','vo2_4020','vo2_3030'] };
const DOWN = { vo2:'thr', thr:'ss', ss:'tempo', force:'tempo', tempo:'end', end:'rec', rec:null };
const UP = { rec:'end', end:'tempo', tempo:'ss', ss:'thr', force:'thr', thr:'vo2', vo2:null };
function neighbor(wid, dir){
  const t = WORKOUTS[wid].type; if (t === 'test') return null;
  const L = LADDER[t] || [wid]; const i = L.indexOf(wid);
  const ofType = f => (LADDER[f] || []).filter(w => WORKOUTS[w].type === f && w !== wid);
  if (dir < 0) { if (i > 0) return L[i-1]; const d = DOWN[t]; if (!d) return null; const c = ofType(d); return c[Math.max(0, c.length - (d === 'end' ? 3 : 1))] || null; }
  if (i >= 0 && i < L.length-1 && L[i+1] !== wid) return L[i+1]; const u = UP[t]; if (!u) return null; return ofType(u)[0] || null;
}
function fitTo(wid, maxMin){
  const t = WORKOUTS[wid].type, lim = maxMin*60;
  if (wDur(wid) <= lim) return wid;
  const opts = (ALT[t]||[wid]).filter(id => wDur(id) <= lim).sort((a,b)=>wDur(b)-wDur(a));
  if (opts.length) return opts[0];
  if (t === 'tempo' || t === 'ss') { const s = ALT.ss.filter(id=>wDur(id)<=lim); if (s.length) return s[0]; }
  return (ALT[t]||[wid]).slice().sort((a,b)=>wDur(a)-wDur(b))[0];
}
function pickDays(p){
  const av = [0,1,2,3,4,5,6].filter(d => p.days[d]?.avail && (p.days[d].max||0) >= 40);
  const K = Math.min(p.keyPerWeek, av.length);
  let best = null;
  const combos = (arr, k, start=0, cur=[]) => { if (cur.length===k) { score(cur.slice()); return; } for (let i=start;i<arr.length;i++){ cur.push(arr[i]); combos(arr,k,i+1,cur); cur.pop(); } };
  function score(c){
    let minGap = 7; for (let i=0;i<c.length;i++){ const g = ((c[(i+1)%c.length] - c[i]) + 7) % 7 || 7; minGap = Math.min(minGap, g); }
    const dur = c.reduce((a,d)=>a+Math.min(p.days[d].max,80),0);
    const sc = minGap*100 + dur;
    if (!best || sc > best.sc) best = { sc, c };
  }
  if (K>0) combos(av, K);
  const key = best ? best.c : [];
  const rest = av.filter(d => !key.includes(d)).sort((a,b)=>p.days[b].max - p.days[a].max);
  const opt = rest.slice(0, p.optionalPerWeek);
  return { key, opt, all: av };
}
function weekKinds(p){
  const w0 = monday(p.startDate), wEnd = monday(p.endDate), gW = monday(p.goalDate);
  const n = diffDays(w0, wEnd)/7 + 1, g = diffDays(w0, gW)/7;
  const kinds = []; let load = 0, lastTest = 0;
  for (let i=0;i<n;i++){
    kinds.push({ i, ws: addDays(w0, i*7) });
  }
  for (const k of kinds){
    const i = k.i, ws = k.ws;
    const inHol = p.holidays && (p.holidayWeeks||[]).includes(ws);
    if (i === 0) { k.kind = 'calib'; k.block = 'Calibration'; continue; }
    if (i === g) { k.kind = 'final'; k.block = 'Affûtage · Test final'; continue; }
    if (i === g-1) { k.kind = 'taper'; k.block = 'Affûtage'; continue; }
    if (i > g) { k.kind = 'bonus'; k.bj = i - g - 1; k.block = k.bj % 4 === 3 ? 'Consolidation · allégée' : 'Consolidation'; continue; }
    if (inHol) { k.kind = 'holiday'; k.block = 'Fêtes · Maintien'; continue; }
    const pos = load % 4;
    const b = Math.min(Math.floor(load/4), BLOCKS.length-1);
    if (pos === 3) { k.kind = 'recovery'; k.block = 'Semaine allégée'; if (i - lastTest >= 6 && g - i >= 3) { k.test = true; lastTest = i; k.block = 'Allégée + retest'; } }
    else { k.kind = 'load'; k.bi = b; k.pos = pos; k.block = BLOCKS[b].name; }
    load++;
  }
  if (triOn()) { // tri : 8 dernières semaines de charge en spécifique montagne, sinon base → seuil → VO2 ; semaine de course
    const loads = kinds.filter(k => k.kind === 'load');
    loads.forEach((k, j) => { k.bi = j >= loads.length - 8 ? 3 : Math.min(Math.floor(j/4), 2); k.block = k.bi === 3 ? TRI_SPEC.name : BLOCKS[k.bi].name; });
    for (const k of kinds) { if (k.kind === 'final') k.block = 'Semaine de course'; if (k.kind === 'recovery' && k.test && kinds.length - k.i <= 6) { k.test = false; k.block = 'Semaine allégée'; } }
  }
  return kinds;
}
function christmasWeeks(p){ // semaines contenant 24/12 et 31/12
  const res = new Set(); const y0 = parseD(p.startDate).getFullYear(), y1 = parseD(p.endDate).getFullYear();
  for (let y=y0;y<=y1;y++) for (const d of [`${y}-12-24`,`${y}-12-31`]) if (d >= p.startDate && d <= p.endDate) res.add(monday(d));
  return [...res];
}
function generatePlan(p, keepFrom){
  p.holidayWeeks = p.holidays ? christmasWeeks(p) : [];
  const kinds = weekKinds(p), days = pickDays(p);
  const testW = p.testProtocol === 'ramp' ? 'ramp' : 'test20';
  const plan = [];
  const add = (ws, dow, wid, kind, k) => {
    const date = addDays(ws, dow);
    if (date < p.startDate || date > p.endDate) return;
    if ((p.absences||[]).some(a => date >= a.from && date <= a.to)) return;
    if (keepFrom && date < keepFrom) return;
    const max = p.days[dow]?.max || 60;
    plan.push({ id: uid(), date, week: k.i, block: k.block, kind, workoutId: kind==='test' ? wid : fitTo(wid, max), status:'planned' });
  };
  for (const k of kinds){
    const K = days.key, O = days.opt;
    const kd = d => K[d % Math.max(K.length,1)];
    if (!K.length) break;
    // jours de la semaine encore disponibles (pour la 1re semaine qui démarre en cours)
    const validK = K.filter(d => addDays(k.ws,d) >= p.startDate);
    switch (k.kind){
      case 'calib': {
        // test dès le premier jour dispo (≥ 40 min), puis endurance sur les jours suivants
        const avail = days.all.filter(d => addDays(k.ws,d) >= p.startDate);
        const td = avail.find(d => p.days[d].max >= 60) ?? avail[0] ?? K[0];
        add(k.ws, td, testW, 'test', k);
        avail.filter(d => d >= td + 2).slice(0, 1 + p.optionalPerWeek).forEach(d => add(k.ws, d, p.days[d].max >= 90 ? 'end_90' : 'end_60', 'optional', k));
        break; }
      case 'load': {
        const blk = triOn() && k.bi === 3 ? TRI_SPEC : BLOCKS[k.bi];
        // tri : à partir du bloc VO2, la séance clé du week-end devient la sortie longue (cols au tempo)
        K.forEach((d, j) => add(k.ws, d, triOn() && k.bi >= 2 && (d === 5 || d === 6) ? (k.bi === 3 && k.pos !== 0 ? 'end_180' : 'end_150') : blk.k[j % blk.k.length][k.pos], 'key', k));
        O.forEach((d, j) => { const opts = triOn() && p.days[d].max >= 150 && k.bi >= 2 ? (k.bi === 3 ? ['end_180','end_150','end_180'] : ['end_150','end_120','end_150']) : p.days[d].max >= 90 ? ['end_90','tempo_end','end_neuro'] : ['end_60','end_neuro','end_60']; add(k.ws, d, opts[(k.i + j) % 3], 'optional', k); }); break; }
      case 'recovery': case 'taper': case 'final': {
        if (k.kind === 'final' && triOn()) { // semaine de course : un rappel en début de semaine, puis la course
          const rd = dowMon(p.endDate); if (rd >= 2) add(k.ws, Math.min(K[0], rd - 2), 'openers', 'recovery', k); break; }
        const testNow = k.test || k.kind === 'final';
        if (testNow) {
          if (K.length >= 2) { add(k.ws, kd(0), 'openers', 'recovery', k); add(k.ws, kd(1), testW, 'test', k); }
          else add(k.ws, kd(0), testW, 'test', k);
        } else {
          add(k.ws, kd(0), k.kind==='taper' ? 'ss_3x10' : 'rec_45', 'recovery', k);
          if (K.length >= 2) add(k.ws, kd(1), k.kind==='taper' ? 'openers' : 'end_60', 'recovery', k);
        }
        if (k.kind === 'recovery' && O.length && !testNow) add(k.ws, O[0], 'end_60', 'optional', k);
        break; }
      case 'holiday': {
        add(k.ws, kd(0), 'ss_3x12', 'key', k);
        O.forEach(d => add(k.ws, d, 'end_90', 'optional', k)); break; }
      case 'bonus': { // après le test final : cycles de 4 semaines (3 de maintien qui tournent + 1 allégée), plus jamais la même semaine
        const j = k.bj || 0;
        if (j % 4 === 3) { add(k.ws, kd(0), 'rec_45', 'recovery', k); if (K.length >= 2) add(k.ws, kd(1), 'end_60', 'recovery', k); break; }
        const x = Math.floor(j / 4) * 3 + j % 4;
        const T1 = ['thr_2x20','ou_3x9','thr_3x12','thr_2x15','thr_prog','thr_5x6'], T2 = ['vo2_5x4','vo2_4020','vo2_6x3','vo2_8x2','vo2_pyr','vo2_3030'], T3 = ['ss_2x20','force_4x8','tempo_2x20','ss_ou'];
        const kw = [T1[x % T1.length], T2[x % T2.length], T3[x % T3.length]];
        K.forEach((d, n) => add(k.ws, d, kw[n % 3], 'key', k));
        O.forEach((d, n) => add(k.ws, d, (p.days[d].max >= 90 ? ['end_90','tempo_end','end_neuro'] : ['end_60','end_neuro','tempo_end'])[(x + n) % 3], 'optional', k)); break; }
    }
  }
  return plan.sort((a,b)=>a.date.localeCompare(b.date));
}
const mandatory = s => s.kind !== 'optional';

/* ============ TRIATHLON : course A, séances nat / course, plan ============ */
// Réglages par défaut : AlpsMan Half (début juin 2027, date à confirmer), 2 nat + 2 course, doubles séances autorisées
const TRI_DEF = () => ({ enabled:false, race:{ name:'AlpsMan Half', date:'2027-06-05', swim:2000, bike:100, bikeDp:1920, run:16, runDp:1300 },
  swimPerWeek:2, runPerWeek:3, doubles:true, swimDays:[1, 4], runDays:[0, 2, 6], css:105, runThr:270, pool:25, longRide:180 });
const tri = () => S.tri || null;
const triOn = () => !!(S.tri && S.tri.enabled);
// allures : nat en s/100 m (par rapport à la CSS), course en s/km (par rapport à l'allure seuil)
const SW_Z = { z1:{ l:'souple', k:15, pct:87 }, z2:{ l:'aérobie', k:7, pct:94 }, css:{ l:'CSS', k:0, pct:100 }, race:{ l:'allure course', k:4, pct:97 }, fast:{ l:'rapide', k:-5, pct:104 }, max:{ l:'à fond', k:-10, pct:110 }, drill:{ l:'éducatifs', k:20, pct:82 } };
const RN_Z = { e:{ l:'footing', f:1.28, pct:78 }, m:{ l:'allure 70.3', f:1.10, pct:91 }, t:{ l:'seuil', f:1.0, pct:100 }, i:{ l:'VO2max', f:0.93, pct:107 }, r:{ l:'lignes droites', f:0.88, pct:113 }, hill:{ l:'côte · effort seuil', f:null, pct:null }, rec:{ l:'récup trot', f:1.4, pct:71 } };
const fmtPace = s => `${Math.floor(s/60)}'${String(Math.round(s % 60) % 60).padStart(2, '0')}`;
const swPace = z => (tri()?.css || 105) + SW_Z[z].k;
const rnPace = z => RN_Z[z].f ? (tri()?.runThr || 270)*RN_Z[z].f : null;
// étape : { n: répétitions, d: mètres (nat) ou secondes (course), z: zone, l: libellé, r: récup (s) }
const st = (n, d, z, l = '', r = 0) => ({ n, d, z, l, r });

// séances de natation par phase · v = variante (semaine), f = facteur de volume
const SWIM = {
  tech: (ph, v, f) => ({ name:'Nat technique + aérobie', goal:"Gainage et glisse : la technique d'abord, puis du volume pull régulier, sans jamais forcer.",
    steps:[st(1, 400, 'z1', 'Échauffement crawl / dos'), st(8, 50, 'drill', ['Rattrapé', 'Chien', 'Poings fermés', 'Pull-buoy jambes serrées'][v % 4], 15),
      st(Math.max(3, Math.round(({ base:4, build:5, build2:5, spec:4, recov:3, taper:2 }[ph] || 4)*f)), 200, 'z2', 'Pull plaquettes, amplitude', 20), st(4, 50, 'fast', 'Rapide, nage propre', 20), st(1, 200, 'z1', 'Retour au calme')] }),
  qual: (ph, v, f) => {
    const W = { name:'', goal:'', steps:[st(1, 400, 'z1', 'Échauffement'), st(4, 50, 'z2', 'Progressif 1 → 4', 15)] };
    if (ph === 'base') { const n = Math.round([8, 10, 12, 10][v % 4]*f); W.name = `Nat CSS ${n} × 100`; W.goal = "Apprendre l'allure seuil (CSS) : régulier du 1er au dernier, récup courte."; W.steps.push(st(n, 100, 'css', 'Allure CSS', 15)); }
    else if (ph === 'build') { const n = Math.max(3, Math.round([5, 6, 5, 6][v % 4]*f)); W.name = `Nat CSS ${n} × 200`; W.goal = "Tenir la CSS sur 200 m : c'est l'allure de ton 2 km en course."; W.steps.push(st(n, 200, 'css', 'Allure CSS', 20), st(6, 50, 'fast', 'Rapide', 20)); }
    else if (ph === 'build2') { const n = Math.max(2, Math.round(3*f)); W.name = `Nat ${n} × 400 + vitesse`; W.goal = "Longs blocs à la CSS puis de la vitesse : départ rapide en course sans exploser."; W.steps.push(st(n, 400, 'css', 'Allure CSS', 30), st(8, 50, 'fast', 'Rapide', 20), st(4, 25, 'max', 'Sprint départ de course', 30)); }
    else if (ph === 'spec') { const n = Math.max(2, Math.round([3, 4, 3, 4][v % 4]*f)); W.name = `Nat allure course ${n} × 500`; W.goal = "Spécifique 2 km : allure course, visée toutes les 6 coups de bras comme en lac. À partir de mi-mai, en eau libre si possible."; W.steps.push(st(n, 500, 'race', 'Allure course, visée en tête', 30), st(4, 50, 'fast', 'Relances (dépassements)', 20)); }
    else if (ph === 'taper') { W.name = 'Nat rappels allure course'; W.goal = "Garder la sensation de l'allure course sans fatigue."; W.steps.push(st(4, 100, 'race', 'Allure course', 20), st(4, 25, 'max', 'Sprint départ', 40)); }
    else { W.name = 'Nat souple + vitesse'; W.goal = "Semaine allégée : de l'aisance et un peu de vitesse."; W.steps.push(st(1, Math.round(1000*f/100)*100, 'z2', 'Continu souple'), st(8, 25, 'fast', 'Vite', 20)); }
    W.steps.push(st(1, 200, 'z1', 'Retour au calme')); return W; },
};
// séances de course à pied par phase
const RUN = {
  qual: (ph, v) => {
    const wu = st(1, 900, 'e', 'Échauffement footing'), cd = st(1, 600, 'e', 'Retour au calme');
    const opts = {
      base:[{ name:'Fartlek 8 × 1 min', goal:"Réveiller la vitesse sans entamer la base : 1 min vite (allure 10 km) / 1 min trot.", s:[wu, st(8, 60, 'i', 'Vite', 60), cd] },
            { name:'Côtes courtes 10 × 20 s', goal:"Force et foulée : 20 s en côte raide, fort mais relâché, retour en marchant. Le meilleur exercice anti-blessure.", s:[wu, st(10, 20, 'hill', 'Côte raide', 70), st(1, 900, 'e', 'Footing'), cd] },
            { name:'Footing + 6 lignes droites', goal:"Aérobie facile avec 6 accélérations progressives de 20 s.", s:[st(1, 2400, 'e', 'Footing'), st(6, 20, 'r', 'Ligne droite', 60), cd] },
            { name:'Tempo 3 × 8 min', goal:"Allure 70.3 : confortablement dur, tu peux dire une phrase.", s:[wu, st(3, 480, 'm', 'Allure 70.3', 120), cd] }],
      build:[{ name:'Seuil 3 × 10 min', goal:"Travail au seuil : le levier n°1 pour ton 10 km en 40'30.", s:[wu, st(3, 600, 't', 'Seuil', 120), cd] },
             { name:'Seuil 5 × 6 min', goal:"Seuil fractionné, récup courte : régularité avant tout.", s:[wu, st(5, 360, 't', 'Seuil', 90), cd] },
             { name:'Seuil 2 × 15 min', goal:"Deux longs blocs au seuil : si tu les tiens, le 10 km descend.", s:[wu, st(2, 900, 't', 'Seuil', 180), cd] },
             { name:'Côtes 8 × 1 min 30', goal:"Côte régulière (5-8 %) à effort seuil, retour en trottinant : force pour les 1 300 m D+.", s:[wu, st(8, 90, 'hill', 'Côte 5-8 %', 120), cd] }],
      build2:[{ name:'VO2max 5 × 3 min', goal:"Relever le plafond : allure 3-5 km, récup égale.", s:[wu, st(5, 180, 'i', 'VO2max', 150), cd] },
              { name:'Côtes 6 × 2 min', goal:"VO2 en côte : moins traumatisant que la piste et très spécifique montagne.", s:[wu, st(6, 120, 'hill', 'Côte 6-10 %', 150), cd] },
              { name:'30/30 × 2 × 8', goal:"30 s vite / 30 s trot : du temps près de VO2max avec peu de fatigue.", s:[wu, st(16, 30, 'i', 'Vite', 30), cd] },
              { name:'Seuil 4 × 8 min', goal:"Retour au seuil, un cran plus long.", s:[wu, st(4, 480, 't', 'Seuil', 120), cd] }],
      spec:[{ name:'Côtes longues 5 × 4 min', goal:"Montée longue à effort seuil, descente travaillée : c'est le profil de ton 16 km à 1 300 m D+.", s:[wu, st(5, 240, 'hill', 'Montée effort seuil', 240), cd] },
            { name:'Tempo 2 × 15 min allure 70.3', goal:"Apprendre l'allure course sur jambes fatiguées : régulier, relâché.", s:[wu, st(2, 900, 'm', 'Allure 70.3', 180), cd] },
            { name:'Montée-descente 3 × 8 min', goal:"Spécifique trail : 8 min de montée continue à effort seuil, descente rapide et contrôlée.", s:[wu, st(3, 480, 'hill', 'Montée continue', 300), cd] },
            { name:'Seuil 3 × 10 min', goal:"Entretien du seuil sur le plat.", s:[wu, st(3, 600, 't', 'Seuil', 120), cd] }],
      taper:[{ name:'Rappels 4 × 3 min', goal:"Garder du tonus sans fatigue avant la course.", s:[wu, st(4, 180, 'm', 'Allure 70.3', 120), st(4, 20, 'r', 'Ligne droite', 60), cd] }],
      recov:[{ name:'Footing + lignes droites', goal:"Semaine allégée : faire tourner, rester frais.", s:[st(1, 2100, 'e', 'Footing'), st(6, 20, 'r', 'Ligne droite', 60), cd] }],
    };
    const L = opts[ph] || opts.base, o = L[v % L.length]; return { name:o.name, goal:o.goal, steps:o.s }; },
  long: (ph, min, dp) => ({ name:`Sortie longue ${fmtDur(min*60)}${dp ? ` · ${dp} m D+` : ''}`,
    goal: dp ? `Endurance en terrain vallonné (Meudon, Saint-Cloud, Saint-Germain) : monte en marchant vite si ça dépasse le seuil, travaille les descentes. Objectif ${dp} m D+.` : "Endurance fondamentale : facile, tu dois pouvoir parler. C'est elle qui construit le moteur.",
    steps:[st(1, min*60, 'e', dp ? `Footing vallonné · ${dp} m D+` : 'Footing facile')] }),
  easy: (ph) => { const min = ph === 'recov' || ph === 'taper' ? 30 : ph === 'base' ? 40 : 45;
    return { name:`Footing ${min} min${ph === 'recov' || ph === 'taper' ? '' : ' + lignes droites'}`, goal:"Footing facile au lendemain du week-end vélo : remettre les jambes en route, aisance respiratoire totale. Les lignes droites gardent une foulée tonique.",
      steps: ph === 'recov' || ph === 'taper' ? [st(1, min*60, 'e', 'Footing facile')] : [st(1, (min - 5)*60, 'e', 'Footing facile'), st(6, 20, 'r', 'Ligne droite', 30)] }; },
  brick: (min) => ({ name:`Enchaînement vélo → course ${min} min`, goal:"Juste après la sortie vélo longue : chaussures prêtes, 5 premières minutes souples puis allure 70.3. Apprendre à courir sur jambes lourdes.",
    steps:[st(1, 300, 'e', 'Mise en route'), st(1, (min - 5)*60, 'm', 'Allure 70.3')] }),
};
const RACE_W = r => ({ name:`🏁 ${r.name}`, goal:`${(r.swim/1000).toString().replace('.', ',')} km nat · ${r.bike} km vélo (${r.bikeDp} m D+) · ${r.run} km course (${r.runDp} m D+). Pars prudemment sur le vélo : la course se joue dans la dernière montée à pied.`, steps:[] });

function triWorkout(x){
  const T = tri(); if (!T) return null;
  if (x.sport === 'race') return RACE_W(T.race);
  if (x.sport === 'swim') return SWIM[x.wid](x.ph, x.v || 0, x.f || 1);
  if (x.wid === 'long') return RUN.long(x.ph, x.min, x.dp || 0);
  if (x.wid === 'brick') return RUN.brick(x.min);
  if (x.wid === 'easy') return RUN.easy(x.ph);
  return RUN.qual(x.ph, x.v || 0);
}
// durée (s) et distance (m) estimées
function triEst(x, W = triWorkout(x)){
  let sec = 0, m = 0;
  for (const s of W.steps) {
    if (x.sport === 'swim') { m += s.n*s.d; sec += s.n*(s.d/100*swPace(s.z) + s.r); }
    else { sec += s.n*(s.d + s.r); const p = rnPace(s.z) || rnPace('t')*1.15; m += s.n*(s.d/p*1000 + (s.r ? s.r/(rnPace('rec'))*1000 : 0)); }
  }
  return { sec: Math.round(sec), m: Math.round(m/(x.sport === 'swim' ? 1 : 10))*(x.sport === 'swim' ? 1 : 10) };
}
// texte au format Intervals.icu (calendrier, montre via l'app Companion)
function triIcuText(x, W = triWorkout(x)){
  const rest = r => r ? `\n- ${r}s ${x.sport === 'swim' ? '' : '60% Pace '}récup` : '';
  return W.steps.map(s => {
    const z = x.sport === 'swim' ? SW_Z[s.z] : RN_Z[s.z];
    const target = x.sport === 'swim' ? `${s.d}mtr ${z.pct}% Pace` : `${s.d >= 60 ? Math.round(s.d/60) + 'm' : s.d + 's'} ${z.pct ? z.pct + '% Pace' : 'Z4 HR'}`;
    const line = `- ${s.l ? s.l + ' ' : ''}${target}`;
    return s.n > 1 ? `\n${s.n}x\n${line}${rest(s.r)}\n` : line;
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// phases des semaines, alignées sur celles du vélo (même calendrier de charge / récup)
function triPhase(k){
  if (k.kind === 'final') return 'race';
  if (k.kind === 'taper') return 'taper';
  if (k.kind === 'recovery' || k.kind === 'holiday') return 'recov';
  if (k.kind === 'calib') return 'base';
  return ['base', 'build', 'build2', 'spec'][k.bi ?? 0] || 'base';
}
function generateTri(p, T, keepFrom){
  const kinds = weekKinds(p), out = [], race = T.race.date;
  const ok = date => date >= p.startDate && date <= race && !(p.absences || []).some(a => date >= a.from && date <= a.to) && (!keepFrom || date >= keepFrom);
  const add = (k, dow, o) => { const date = addDays(k.ws, dow); if (date > race || !ok(date)) return; out.push({ id: uid(), date, week: k.i, block: k.block, status:'planned', ...o }); };
  const loadIdx = {}; let li = 0; for (const k of kinds) if (k.kind === 'load') loadIdx[k.i] = li++;
  const nLoad = li;
  for (const k of kinds) {
    const ph = triPhase(k), v = k.i, prog = nLoad ? (loadIdx[k.i] ?? Math.round(k.i/kinds.length*nLoad))/Math.max(1, nLoad - 1) : 0; // 0 → 1 au fil de la prépa
    const f = ph === 'recov' ? 0.7 : ph === 'taper' ? 0.6 : 1;
    const sd = T.swimDays.slice(0, T.swimPerWeek), rd = T.runDays.slice(0, T.runPerWeek);
    if (ph === 'race') {
      const rdow = dowMon(race);
      if (rdow >= 3) { add(k, sd[0] ?? 1, { sport:'swim', wid:'qual', ph:'taper', v, f:0.6, kind:'key' }); add(k, Math.min(rdow - 2, rd[0] ?? 2), { sport:'run', wid:'qual', ph:'taper', v, kind:'key' }); }
      out.push({ id: uid(), date: race, week: k.i, block:'Course', status:'planned', sport:'race', kind:'race' });
      continue;
    }
    sd.forEach((d, j) => add(k, d, { sport:'swim', wid: j === 0 ? 'qual' : 'tech', ph, v, f, kind: j < 2 ? 'key' : 'optional' }));
    rd.forEach((d, j) => {
      if (rd.length === 1 || j === rd.length - 1) {
        // sortie longue : 55 → 110 min ; D+ à partir du bloc spécifique (et un peu en build2)
        let min = Math.round((55 + prog*55)/5)*5; if (ph === 'recov') min = Math.round(min*0.65/5)*5; if (ph === 'taper') min = 50;
        const dp = ph === 'spec' ? Math.round((350 + prog*650)/50)*50 : ph === 'build2' ? 250 : 0;
        add(k, d, { sport:'run', wid:'long', ph, v, min, dp: ph === 'recov' ? 0 : dp, kind:'key' });
      } else if (rd.length >= 3 && j === 0) add(k, d, { sport:'run', wid:'easy', ph, v, kind:'key' }); // 3 courses : la 1re = footing facile
      else add(k, d, { sport:'run', wid:'qual', ph, v: v + j, kind:'key' });
    });
    // enchaînement après la sortie vélo longue du week-end (build2 et spécifique, une semaine sur deux puis toutes)
    if (T.doubles && (ph === 'build2' || ph === 'spec') && (ph === 'spec' || v % 2 === 0)) {
      const wk = [5, 6].find(d => p.days[d]?.avail && (p.days[d].max || 0) >= 90);
      if (wk != null) add(k, wk, { sport:'run', wid:'brick', ph, v, min: ph === 'spec' ? 25 : 15, kind:'optional' });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
// séance faite ? on cherche une activité du même sport ce jour-là (Apple Santé / Intervals)
function triDone(x){
  if (x.sport === 'race') return null;
  const ws = Health.extraWorkouts().filter(e => e.date === x.date && e.sport === x.sport && (+e.w.duration_min || 0) >= (x.wid === 'brick' ? 8 : 15));
  return ws[0] || null;
}
function triStatus(x){ if (x.swap) return 'swapped'; if (x.status === 'skipped') return 'skipped'; if (triDone(x)) return 'done'; return x.date < todayISO() && x.sport !== 'race' ? 'missed' : 'planned'; }
const TRI_IC = { swim:'🏊', run:'🏃', race:'🏁' };
/* ===== /TRIATHLON ===== */
