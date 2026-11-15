"use strict";
// FTP Builder · planificateur FTP et plan triathlon
/* ============ planificateur ============ */
const BLOCKS = [
  // k[i][semaine du bloc] : séance clé n°1, n°2, n°3 (si 3 séances clés / semaine)
  { name:'Base · Sweet spot', k:[['ss_3x10','ss_3x12','ss_4x10'],['force_5x5','tempo_2x20','ss_ou'],['tempo_end','force_5x5','tempo_2x20']] },
  { name:'Sweet spot → Seuil', k:[['ss_2x20','thr_5x6','thr_4x8'],['force_4x8','ss_3x15','vo2_4x5'],['tempo_2x20','ss_ou','tempo_end']] },
  { name:'Seuil + VO2max', k:[['thr_3x12','thr_prog','thr_2x15'],['vo2_5x4','vo2_8x2','vo2_pyr'],['force_4x8','ss_2x20','ou_3x9']] },
  { name:'VO2max · Spécifique', k:[['vo2_6x3','vo2_4020','vo2_3030'],['thr_2x15','ou_3x12','thr_2x20'],['ss_ou','force_4x8','tempo_end']] },
];
// bloc spécifique triathlon montagne : force en cadence basse, seuil long, tempo (cols)
const TRI_SPEC = { name:'Spécifique montagne', k:[['force_4x8','thr_2x15','force_5x5'],['ss_2x20','tempo_2x20','thr_prog'],['tempo_end','ss_ou','ss_3x15']] };
const ALT = { // repli si la séance dépasse la durée dispo du jour
  ss:['ss_3x10','ss_3x12','ss_ou','ss_4x10','ss_2x20','ss_3x15'], thr:['thr_5x6','thr_4x8','ou_3x9','thr_prog','thr_3x12','ou_3x12','thr_rel_3x12','thr_2x15','ou_3x12b','thr_2x20','ou_2x18','thr_rel_2x20'], vo2:['vo2_8x2','vo2_6x3','vo2_4x5','vo2_5x4','vo2_pyr','vo2_4020','vo2_3030'],
  force:['force_5x5','force_4x8'], tempo:['tempo_2x20','tempo_end'], end:['end_60','end_neuro','end_90','end_120','end_150','end_180'], rec:['openers','rec_45'], test:['ramp','test20'] };
// échelles de difficulté (de la plus facile à la plus dure) pour « plus facile / plus dur »
const LADDER = {
  rec:['rec_45','openers'], end:['rec_45','end_60','end_neuro','end_90','end_120','end_150','end_180'], tempo:['tempo_end','tempo_2x20'],
  force:['force_5x5','force_4x8'], ss:['ss_3x10','ss_3x12','ss_ou','ss_4x10','ss_2x20','ss_3x15'],
  thr:['thr_5x6','thr_4x8','ou_3x9','thr_prog','thr_3x12','ou_3x12','thr_rel_3x12','thr_2x15','ou_3x12b','thr_2x20','ou_2x18','thr_rel_2x20'], vo2:['vo2_4x5','vo2_8x2','vo2_5x4','vo2_pyr','vo2_6x3','vo2_4020','vo2_3030'] };
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
  if (triFull()) { // tri : 8 dernières semaines de charge en spécifique montagne, sinon base → seuil → VO2 ; semaine de course
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
  applyWarmupPref(p);
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
    plan.push({ id: uid(), date, week: k.i, block: k.block, kind, workoutId: kind==='test' ? wid : fitTo(wid, max), status:'planned', ...(k.pos != null ? { pos: k.pos } : {}) });
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
        const blk = triFull() && k.bi === 3 ? TRI_SPEC : BLOCKS[k.bi];
        // tri : à partir du bloc VO2, la séance clé du week-end devient la sortie longue (cols au tempo)
        K.forEach((d, j) => add(k.ws, d, triFull() && k.bi >= 2 && (d === 5 || d === 6) ? (k.bi === 3 && k.pos !== 0 ? 'end_180' : 'end_150') : blk.k[j % blk.k.length][k.pos], 'key', k));
        O.forEach((d, j) => { const opts = triFull() && p.days[d].max >= 150 && k.bi >= 2 ? (k.bi === 3 ? ['end_180','end_150','end_180'] : ['end_150','end_120','end_150']) : p.days[d].max >= 90 ? ['end_90','tempo_end','end_neuro'] : ['end_60','end_neuro','end_60']; add(k.ws, d, opts[(k.i + j) % 3], 'optional', k); }); break; }
      case 'recovery': case 'taper': case 'final': {
        if (k.kind === 'final' && triFull()) { // semaine de course : un rappel en début de semaine, puis la course
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
        const T1 = ['thr_2x20','ou_3x12','thr_3x12','thr_rel_3x12','thr_2x15','ou_3x12b','thr_prog','ou_2x18'], T2 = ['vo2_5x4','vo2_4020','vo2_6x3','vo2_8x2','vo2_pyr','vo2_3030'], T3 = ['ss_2x20','force_4x8','tempo_2x20','ss_ou'];
        const kw = [T1[x % T1.length], T2[x % T2.length], T3[x % T3.length]];
        K.forEach((d, n) => add(k.ws, d, kw[n % 3], 'key', k));
        O.forEach((d, n) => add(k.ws, d, (p.days[d].max >= 90 ? ['end_90','tempo_end','end_neuro'] : ['end_60','end_neuro','tempo_end'])[(x + n) % 3], 'optional', k)); break; }
    }
  }
  plan.sort((a,b)=>a.date.localeCompare(b.date));
  if (S.levelCal?.length) Levels.apply(plan, p, Levels.compute(), keepFrom || todayISO()); // plan régénéré : on garde le calage sur les niveaux
  return plan;
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
const rnPace = (z, x) => runOn() ? runPaces(x?.vd ?? runVdot())[z] ?? null : RN_Z[z]?.f ? (tri()?.runThr || 270)*RN_Z[z].f : null;
// zone course : libellé et % de l'allure seuil (format Intervals.icu)
const rnZ = (z, x) => { if (!runOn()) return RN_Z[z]; const P = runPaces(x?.vd ?? runVdot()); return { l: RUN_ZL(z), pct: P[z] ? Math.round(P.t/P[z]*100) : null }; };
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
  if (T.mode === 'run') return runWorkout(x, T);
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
    else { sec += s.n*(s.d + s.r); const p = rnPace(s.z, x) || rnPace('t', x)*1.15; m += s.n*(s.d/p*1000 + (s.r ? s.r/(rnPace('rec', x))*1000 : 0)); }
  }
  return { sec: Math.round(sec), m: Math.round(m/(x.sport === 'swim' ? 1 : 10))*(x.sport === 'swim' ? 1 : 10) };
}
// texte au format Intervals.icu (calendrier, montre via l'app Companion)
function triIcuText(x, W = triWorkout(x)){
  const rest = r => r ? `\n- ${r}s ${x.sport === 'swim' ? '' : '60% Pace '}récup` : '';
  return W.steps.map(s => {
    const z = x.sport === 'swim' ? SW_Z[s.z] : rnZ(s.z, x);
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
  applyWarmupPref(p);
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
/* ============ COURSE À PIED : 10 km, semi, marathon (mode « run » du plan) ============ */
// Même rails que le plan tri (S.tri / S.triPlan : calendrier, accueil, Intervals.icu), avec S.tri.mode = 'run' :
// pas de nat, le plan vélo n'est pas modifié. Allures de Jack Daniels : un niveau (seuil ou chrono) → VDOT → allures E / M / T / I / R ;
// l'allure spécifique = l'objectif de temps (sinon la prédiction). Périodisation construite en arrière depuis la course.
const triMode = () => tri()?.mode === 'run' ? 'run' : 'tri';
const runOn = () => triOn() && triMode() === 'run';
const triFull = () => triOn() && triMode() !== 'run';
// weeks : durée conseillée ; min : en dessous, plan compressé ; taper : semaines d'affûtage avant la semaine de course
// long / easy : durées (min) de la sortie longue et des footings, du début au pic ; ph : part des semaines de charge par phase
const RUN_D = {
  10:{ l:'10 km', km:10, weeks:10, min:6, taper:1, long:[50, 80], easy:[35, 45], ph:[0.2, 0.25, 0.3, 0.25], b2:'VO2max' },
  21:{ l:'Semi-marathon', km:21.0975, weeks:12, min:8, taper:1, long:[60, 105], easy:[40, 50], ph:[0.25, 0.25, 0.15, 0.35], b2:'Seuil + VO2max' },
  42:{ l:'Marathon', km:42.195, weeks:16, min:10, taper:2, long:[75, 150], easy:[45, 60], ph:[0.25, 0.25, 0.1, 0.4], b2:'Seuil + allure marathon' } };
// Daniels & Gilbert (1979) : VO2 de la vitesse (m/min) et part de VO2max tenable sur la durée (min)
const vdotOf = (m, sec) => { const t = sec/60, v = m/t; return (-4.6 + 0.182258*v + 0.000104*v*v)/(0.8 + 0.1894393*Math.exp(-0.012778*t) + 0.2989558*Math.exp(-0.1932605*t)); };
const vdotSpeed = vo2 => (-0.182258 + Math.sqrt(0.182258**2 + 4*0.000104*(vo2 + 4.6)))/(2*0.000104);
const vdotPace = (vd, pct) => 60000/vdotSpeed(vd*pct); // s/km
const vdotTime = (vd, m) => { let lo = 60, hi = 36000; for (let k = 0; k < 50; k++) { const t = (lo + hi)/2; vdotOf(m, t) > vd ? lo = t : hi = t; } return (lo + hi)/2; };
// niveau actuel : chrono de référence si renseigné, sinon allure seuil (≈ allure 10 km + 8 s)
const runVdot = (T = tri()) => T?.ref?.t ? vdotOf(T.ref.m, T.ref.t) : vdotOf(10000, ((T?.runThr || 270) - 8)*10);
// relief : facteur de temps moitié montée, moitié descente (Minetti), 1 sur le plat
const runHill = r => { const km = +r?.run || 10, dp = +r?.runDp || 0; if (dp < 50 || typeof minetti !== 'function') return 1; const g = dp/(km*500); return (minetti(g) + minetti(-g))/2; };
const runPredict = (T = tri(), vd = runVdot(T)) => vdotTime(vd, RUN_D[T.dist].km*1000)*runHill(T.race);
// VDOT de l'objectif (ramené au plat)
const runGoalVdot = (T = tri()) => T?.goal ? vdotOf(RUN_D[T.dist].km*1000, T.goal/runHill(T.race)) : null;
const RUN_PC = new Map();
function runPaces(vd, T = tri()){
  const key = vd.toFixed(2) + '|' + (T?.dist || 10) + '|' + (T?.goal || 0) + '|' + (T?.race?.runDp || 0) + '|' + (T?.ref?.t || T?.runThr);
  if (RUN_PC.has(key)) return RUN_PC.get(key);
  const D = RUN_D[T?.dist] || RUN_D[10], m = D.km*1000;
  const P = { e: vdotPace(vd, 0.67), rec: vdotPace(vd, 0.58), m: vdotTime(vd, 42195)/42.195, t: vdotPace(vd, 0.88), i: vdotPace(vd, 0.975), r: vdotPace(vd, 1.05), hill: null };
  P.rp = T?.goal ? T.goal/runHill(T.race)/D.km : vdotTime(runVdot(T), m)/D.km; // allure course visée (équivalent plat)
  if (RUN_PC.size > 200) RUN_PC.clear(); RUN_PC.set(key, P); return P;
}
const RUN_ZL = z => ({ e:'footing (E)', rec:'récup trot', m:'allure marathon', t:'seuil (T)', i:'VO2max (I)', r:'vitesse (R)', hill:'côte · effort seuil', rp:`allure ${RUN_D[tri()?.dist]?.l.toLowerCase() || 'course'}` })[z] || z;
const RUN_DEF = () => ({ mode:'run', enabled:false, dist:10, race:{ name:'', date:'', run:10, runDp:0, swim:0, bike:0, bikeDp:0 }, goal:null, ref:null,
  runPerWeek:4, runDays:[1, 3, 5, 6], swimPerWeek:0, swimDays:[], doubles:false, css:105, runThr:270 });
// date conseillée quand aucune course n'est renseignée : dimanche après la durée conseillée
// le plan commence la semaine en cours (ou la suivante si on est dimanche)
const runW0 = from => monday(addDays(from, 1));
const runDefaultDate = (dist, from = todayISO()) => addDays(runW0(from), (RUN_D[dist].weeks - 1)*7 + 6);
// semaines du plan : entretien (course lointaine) → base → seuil → VO2 / allure → spécifique → affûtage → course ; 3 semaines de charge + 1 allégée
function runWeeks(T){
  const D = RUN_D[T.dist], w0 = runW0(T.start || todayISO()), wr = monday(T.race.date), n = Math.max(1, diffDays(w0, wr)/7 + 1);
  const tap = Math.min(D.taper, Math.max(0, n - 3)), pre = n - 1 - tap, ent = Math.max(0, pre - (D.weeks - 1 - D.taper));
  const W = [];
  for (let i = 0; i < n; i++) {
    const ws = addDays(w0, i*7);
    if (i === n - 1) { W.push({ i, ws, ph:'race', block:'Semaine de course' }); continue; }
    if (i >= pre) { W.push({ i, ws, ph:'taper', block:'Affûtage' }); continue; }
    const rec = (pre - 1 - i) % 4 === 3 && i >= 2; // jamais d'allégée avant 2 semaines de charge
    W.push({ i, ws, ph: rec ? 'recov' : 'load', ent: i < ent, block: rec ? 'Semaine allégée' : '' });
  }
  const main = W.filter(w => w.ph === 'load' && !w.ent), cum = D.ph.reduce((a, x) => [...a, (a.at(-1) || 0) + x], []);
  main.forEach((w, j) => { const f = (j + 0.5)/main.length, b = cum.findIndex(c => f <= c + 1e-9);
    w.ph = ['base', 'build', 'build2', 'spec'][b < 0 ? 3 : b]; w.p = main.length > 1 ? j/(main.length - 1) : 1; w.li = j;
    w.block = { base:'Base · Endurance', build:'Seuil', build2: D.b2, spec:`Spécifique ${D.l.toLowerCase()}` }[w.ph]; });
  for (const w of W) if (w.ent && w.ph === 'load') { w.ph = 'base'; w.p = 0; w.li = 0; w.block = 'Base · Entretien'; }
  // allégées et affûtage : progression de la semaine de charge précédente
  let last = { p:0, li:0 }; for (const w of W) { if (w.ph === 'recov' || w.ph === 'taper' || w.ph === 'race') { w.p ??= last.p; w.li ??= last.li; } else last = w; }
  return W;
}
// jours : la sortie longue le dernier jour coché ; les séances de qualité les plus espacées entre elles et de la longue
// bike : séances clés vélo de la semaine, à éviter pour la qualité course (même jour)
function runSlots(days, nQ, bike = []){
  const d = [...new Set(days)].sort((a, b) => a - b), long = d.at(-1), rest = d.slice(0, -1);
  const k = Math.min(nQ, rest.length); let best = null;
  const gap = s => { const all = [...s, long].sort((a, b) => a - b); let g = 7; for (let i = 0; i < all.length; i++) g = Math.min(g, ((all[(i + 1) % all.length] - all[i]) + 7) % 7 || 7); return g; };
  const combos = (st = 0, cur = []) => { if (cur.length === k) { const sc = gap(cur)*10 - (cur.includes((long + 6) % 7) ? 5 : 0) - cur.filter(d => bike.includes(d)).length*4; if (!best || sc > best.sc) best = { sc, c: cur.slice() }; return; }
    for (let i = st; i < rest.length; i++) { cur.push(rest[i]); combos(i + 1, cur); cur.pop(); } };
  combos();
  const q = best ? best.c : [];
  return { long, q, easy: rest.filter(x => !q.includes(x)) };
}
function generateRun(T, keepFrom){
  const D = RUN_D[T.dist], race = T.race.date, W = runWeeks(T), t0 = keepFrom || todayISO(), out = [];
  const v0 = runVdot(T), vg = runGoalVdot(T), gap = vg ? Math.max(0, vg - v0) : 0;
  const N = T.runDays.length, S0 = runSlots(T.runDays, N >= 4 ? 2 : N >= 2 ? 1 : 0, (() => { try { return S.profile ? pickDays(S.profile).key : []; } catch { return []; } })());
  const add = (w, dow, o) => { const date = addDays(w.ws, dow); if (date < t0 || date >= race || (S.profile?.absences || []).some(a => date >= a.from && date <= a.to)) return;
    out.push({ id: uid(), date, week: w.i, block: w.block, status:'planned', sport:'run', ph: w.ph, v: w.i, p: Math.round(w.p*100)/100,
      vd: Math.round((v0 + Math.min(gap, 0.25*(w.li || 0), 3))*10)/10, ...o }); };
  const r5 = x => Math.round(x/5)*5;
  for (const w of W) {
    if (w.ph === 'race') {
      const rd = dowMon(race), rem = rd >= 3 ? rd - 3 : null;
      if (rem != null) add(w, rem, { wid:'qual', j:0, kind:'key' });
      if (N >= 4 && rd >= 2) add(w, rd - 1, { wid:'easy', min:20, kind:'optional', strides:true });
      if (race >= t0) out.push({ id: uid(), date: race, week: w.i, block:'Course', status:'planned', sport:'race', kind:'race' });
      continue;
    }
    const L = D.long, E = D.easy, f = w.ph === 'recov' ? 0.7 : 1;
    let lmin = r5((L[0] + (L[1] - L[0])*w.p)*f);
    if (w.ph === 'taper') { const left = diffDays(w.ws, monday(race))/7; lmin = r5(L[1]*(left >= 2 ? 0.7 : T.dist === 42 ? 0.5 : 0.6)); }
    if (T.dist === 42) lmin = Math.min(lmin, r5(32*runPaces(v0).e/60)); // pas plus de ~32 km en sortie longue
    add(w, S0.long, { wid:'long', min: lmin, dp: w.ph === 'spec' && (+T.race.runDp || 0) >= 200 ? r5(Math.min(+T.race.runDp, 150 + w.p*(+T.race.runDp))/10)*10 : 0, kind:'key' });
    S0.q.forEach((d, j) => { if (w.ph === 'recov' || w.ph === 'taper') { if (j === 0) add(w, d, { wid:'qual', j:0, kind:'key' }); else add(w, d, { wid:'easy', min: r5(E[0]*0.8), strides:true, kind:'key' }); }
      else add(w, d, { wid:'qual', j, kind:'key' }); });
    S0.easy.forEach((d, j) => add(w, d, { wid:'easy', min: r5((E[0] + (E[1] - E[0])*w.p)*(w.ph === 'recov' || w.ph === 'taper' ? 0.8 : 1)), strides: j === 0 && S0.q.length < 2, kind: j < 2 ? 'key' : 'optional' }));
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
// bibliothèque de séances : [phase][créneau] → variantes ; p = progression 0 → 1 dans la prépa
const runQ = (dist, ph, j, v, p) => {
  const wu = st(1, 900, 'e', 'Échauffement footing'), cd = st(1, 600, 'e', 'Retour au calme'), D = RUN_D[dist], rpl = `Allure ${D.l.toLowerCase()}`;
  const S_ = (name, goal, ...s) => ({ name, goal, s:[wu, ...s, cd] });
  const base = [[S_('Fartlek 8 × 1 min', "Réveiller la vitesse sans entamer la base : 1 min vite, 1 min trot. Aisance avant tout.", st(8, 60, 'i', 'Vite', 60)),
      S_('Côtes courtes 10 × 20 s', "Force et foulée : 20 s en côte raide, fort mais relâché, retour en marchant. Le meilleur exercice anti-blessure.", st(10, 20, 'hill', 'Côte raide', 70), st(1, 600, 'e', 'Footing')),
      S_('Fartlek 10 × 1 min', "Un cran de plus que la semaine passée : régulier du 1er au dernier.", st(10, 60, 'i', 'Vite', 60))],
    [S_('Footing + 8 lignes droites', "Aérobie facile, puis 8 accélérations progressives de 20 s : foulée tonique sans fatigue.", st(1, 1200, 'e', 'Footing'), st(8, 20, 'r', 'Ligne droite', 60)),
      S_('Tempo 20 min', "Premier contact avec le seuil : « confortablement dur », tu peux dire quelques mots.", st(1, 1200, 't', 'Seuil continu')),
      S_('Côtes 8 × 45 s', "Côte régulière (5-8 %), effort soutenu, retour en trottinant.", st(8, 45, 'hill', 'Côte 5-8 %', 90))]];
  const recov = [S_('Footing + lignes droites', "Semaine allégée : faire tourner, rester frais, 6 accélérations sans forcer.", st(1, 1200, 'e', 'Footing'), st(6, 20, 'r', 'Ligne droite', 60))];
  const thr = [S_('Seuil 3 × 10 min', "Le levier n°1 de l'endurance : allure seuil régulière, récup courte.", st(3, 600, 't', 'Seuil', 120)),
    S_('Seuil 5 × 6 min', "Seuil fractionné, récup courte : la régularité avant tout.", st(5, 360, 't', 'Seuil', 90)),
    S_('Seuil 4 × 8 min', "Un cran plus long : si le dernier est aussi rapide que le premier, c'est réussi.", st(4, 480, 't', 'Seuil', 120)),
    S_('Seuil 2 × 15 min', "Deux longs blocs au seuil : tenir sans accélérer à la fin.", st(2, 900, 't', 'Seuil', 180))];
  const vo2 = [S_('VO2max 5 × 3 min', "Relever le plafond : allure 3-5 km, récup en trottinant aussi longue que l'effort.", st(5, 180, 'i', 'VO2max', 150)),
    S_('VO2max 6 × 3 min', "Une répétition de plus, même allure : pas plus vite que prévu.", st(6, 180, 'i', 'VO2max', 150)),
    S_('VO2max 5 × 4 min', "Blocs plus longs à l'allure VO2max : c'est là que le 10 km se gagne.", st(5, 240, 'i', 'VO2max', 180)),
    S_('Vitesse 12 × 30 s', "Économie de course : rapide et relâché, récup complète entre chaque.", st(12, 30, 'r', 'Vite relâché', 90))];
  const hills = [S_('Côtes 8 × 1 min 30', "Côte régulière (5-8 %) à effort seuil, retour en trottinant : de la force sans choc.", st(8, 90, 'hill', 'Côte 5-8 %', 120))];
  const pick = (L, k = v) => L[((k % L.length) + L.length) % L.length];
  const m = x => Math.round(x/300)*300; // multiples de 5 min
  const spec = {
    10:[[S_(`${rpl} 5 × 5 min`, "Apprendre l'allure de course : régulier, récup courte en trottinant.", st(5, 300, 'rp', rpl, 90)),
         S_(`${rpl} 3 × 8 min`, "Blocs longs à l'allure course : le cœur du spécifique 10 km.", st(3, 480, 'rp', rpl, 120)),
         S_(`${rpl} 6 × 4 min`, "Allure course, récup 1 min : la fatigue des 3 derniers km.", st(6, 240, 'rp', rpl, 60)),
         S_(`${rpl} 2 × 15 min`, "Deux moitiés de course : si tu tiens, l'objectif est là.", st(2, 900, 'rp', rpl, 180))],
        [pick(vo2, v + 1), thr[0], pick(vo2, v + 2), thr[1]]],
    21:[[S_(`${rpl} 3 × 15 min`, "Le cœur du spécifique : allure semi régulière, relâchée, récup 2 min.", st(3, 900, 'rp', rpl, 120)),
         S_(`${rpl} 2 × 20 min`, "Deux longs blocs à l'allure du jour J.", st(2, 1200, 'rp', rpl, 180)),
         S_(`${rpl} 4 × 10 min`, "Allure semi, récup courte : la fin de course se prépare ici.", st(4, 600, 'rp', rpl, 90)),
         S_(`${rpl} ${m(1500 + p*900)/60} min continu`, "Bloc continu à l'allure semi : la meilleure répétition générale.", st(1, m(1500 + p*900), 'rp', rpl))],
        [thr[2], pick(vo2, v), thr[3], hills[0]]],
    42:[[S_(`Allure marathon ${m(1800 + p*1800)/60} min`, "Bloc continu à l'allure marathon : régulier, relâché, et bois comme le jour J.", st(1, m(1800 + p*1800), 'rp', 'Allure marathon')),
         S_(`Allure marathon 3 × ${m(900 + p*600)/60} min`, "Allure marathon par blocs, récup 3 min au footing.", st(3, m(900 + p*600), 'rp', 'Allure marathon', 180)),
         S_(`Allure marathon 2 × ${m(1200 + p*900)/60} min`, "Deux grands blocs : l'allure doit sembler facile, c'est le but.", st(2, m(1200 + p*900), 'rp', 'Allure marathon', 240))],
        [thr[0], thr[2], thr[1], hills[0]]] };
  const T = {
    base, recov,
    build:[thr, dist === 10 ? vo2 : [...hills, vo2[0]]],
    build2: dist === 10 ? [vo2, thr] : dist === 21 ? [thr.slice(2).concat([S_('Tempo 25 min', "Seuil continu : la base de l'allure semi.", st(1, 1500, 't', 'Seuil continu'))]), vo2]
      : [[thr[3], S_('Seuil 3 × 12 min', "Seuil long, récup 2 min : l'endurance qui portera l'allure marathon.", st(3, 720, 't', 'Seuil', 120))], [S_('Allure marathon 3 × 15 min', "Premier contact avec l'allure marathon : elle doit sembler facile.", st(3, 900, 'm', 'Allure marathon', 180))]],
    spec: spec[dist],
    taper:[[dist === 42 ? S_('Allure marathon 2 × 10 min', "Affûtage : garder la sensation de l'allure sans fatigue.", st(2, 600, 'rp', 'Allure marathon', 180), st(4, 20, 'r', 'Ligne droite', 60))
      : S_(`${rpl} 4 × 3 min`, "Affûtage : du tonus sans fatigue, 4 lignes droites pour finir.", st(4, 180, 'rp', rpl, 120), st(4, 20, 'r', 'Ligne droite', 60))]],
    race:[[dist === 42 ? { name:'Rappel allure marathon', goal:"3 jours avant : 3 × 5 min à l'allure du jour J pour régler le pas, rien de plus.", s:[st(1, 900, 'e', 'Footing'), st(3, 300, 'rp', 'Allure marathon', 120), st(1, 600, 'e', 'Footing')] }
      : { name:`Rappel ${rpl.toLowerCase()}`, goal:"3 jours avant : quelques minutes à l'allure du jour J et des lignes droites, rien de plus.", s:[st(1, 900, 'e', 'Footing'), st(3, dist === 10 ? 120 : 300, 'rp', rpl, 120), st(4, 20, 'r', 'Ligne droite', 60), st(1, 600, 'e', 'Footing')] }]] };
  const P = T[ph] || T.base, L = P[Math.min(j, P.length - 1)];
  const o = Array.isArray(L) ? pick(L, v + j) : L; return { name:o.name, goal:o.goal, steps:o.s };
};
function runWorkout(x, T){
  const D = RUN_D[T.dist] || RUN_D[10];
  if (x.sport === 'race') { const pr = runPredict(T), g = T.goal, tgt = g || pr;
    const tip = { 10:"Pars à ton allure, pas plus vite : les 2 premiers km trop rapides se paient au 7e.", 21:"Les 5 premiers km à l'allure prévue (ou 2-3 s plus lent), accélère après le 15e si tu te sens bien.", 42:"Allure régulière jusqu'au 30e, bois et mange dès le début (un gel toutes les 30-40 min). Le marathon commence au 30e." }[T.dist];
    return { name:`🏁 ${T.race.name || D.l}`, goal:`${D.l}${T.race.runDp ? ` · ${T.race.runDp} m D+` : ''} · ${g ? 'objectif' : 'prédiction'} ${fmtHMS(tgt)} (${fmtPace(tgt/D.km)} /km). ${tip}`, steps:[] }; }
  if (x.wid === 'long') { const P = runPaces(x.vd ?? runVdot(T)), sp = x.ph === 'spec' && T.dist >= 21 && x.v % 2 === 0, b2 = x.ph === 'build2' && T.dist >= 21 && x.v % 2 === 0;
    const rpMin = sp ? Math.round((T.dist === 42 ? 30 + x.p*30 : 20 + x.p*15)/5)*5 : b2 ? 15 : 0, tot = x.min*60, z = b2 ? 'm' : 'rp';
    const lab = T.dist === 42 ? 'Allure marathon' : `Allure ${D.l.toLowerCase()}`;
    if (x.ph === 'spec' && T.dist === 42 && !sp) { const bl = Math.round((15 + x.p*10)/5)*5; // marathon : une longue sur deux avec 2 blocs à l'allure marathon au milieu
      return { name:`Sortie longue ${fmtDur(tot)} dont 2 × ${bl} min allure marathon`, goal:"Footing facile, 2 blocs à l'allure marathon au milieu (5 min de footing entre les deux), puis retour facile : régler l'allure et les ravitaillements.",
        steps:[st(1, 1800, 'e', 'Footing facile'), st(2, bl*60, 'rp', 'Allure marathon', 300), st(1, Math.max(600, tot - 1800 - bl*120 - 300), 'e', 'Footing facile')] }; }
    return { name:`Sortie longue ${fmtDur(tot)}${rpMin ? ` dont ${rpMin} min ${b2 ? 'allure marathon' : 'allure course'}` : ''}${x.dp ? ` · ${x.dp} m D+` : ''}`,
      goal: rpMin ? `Footing facile, puis ${rpMin} min ${b2 ? "à l'allure marathon" : "à l'allure objectif"} sur la fin : apprendre à tenir l'allure sur jambes fatiguées. Bois et mange comme le jour J.`
        : x.dp ? `Endurance en terrain vallonné : monte en marchant vite si ça dépasse le seuil, travaille les descentes. Objectif ${x.dp} m D+.` : "Endurance fondamentale : facile, tu dois pouvoir parler. C'est elle qui construit le moteur.",
      steps: rpMin ? [st(1, tot - rpMin*60, 'e', 'Footing facile'), st(1, rpMin*60, z, b2 ? 'Allure marathon' : lab)] : [st(1, tot, 'e', x.dp ? `Footing vallonné · ${x.dp} m D+` : 'Footing facile')] }; }
  if (x.wid === 'easy') return { name:`Footing ${x.min} min${x.strides ? ' + lignes droites' : ''}`, goal: x.strides ? "Footing facile, aisance respiratoire totale, puis 6 accélérations progressives de 20 s." : "Footing facile : récupérer en faisant tourner les jambes.",
    steps: x.strides ? [st(1, (x.min - 4)*60, 'e', 'Footing facile'), st(6, 20, 'r', 'Ligne droite', 30)] : [st(1, x.min*60, 'e', 'Footing facile')] };
  return runQ(T.dist, x.ph, x.j || 0, x.v || 0, x.p || 0);
}
/* ===== /COURSE À PIED ===== */
const TRI_IC = { swim:'🏊', run:'🏃', race:'🏁' };
/* ===== /TRIATHLON ===== */

/* ============ NIVEAUX DE PROGRESSION ET CALIBRAGE ============ */
// Niveau de difficulté de chaque séance (1-10) dans sa zone, façon « Progression Levels » de TrainerRoad.
const WLVL = { ss_3x10:2.5, ss_3x12:3.2, ss_ou:3.6, ss_4x10:4.0, ss_2x20:4.8, ss_3x15:5.6,
  thr_5x6:3.0, thr_4x8:3.6, ou_3x9:4.2, thr_prog:4.6, thr_3x12:4.8, ou_3x12:5.0, thr_rel_3x12:5.3, thr_2x15:5.4, ou_3x12b:5.8, thr_2x20:6.2, ou_2x18:6.6, thr_rel_2x20:7.2,
  vo2_4x5:3.0, vo2_8x2:3.6, vo2_5x4:4.2, vo2_pyr:4.8, vo2_6x3:5.4, vo2_4020:6.0, vo2_3030:6.6 };
// familles interchangeables : le calibrage ne remplace une séance que par une autre du même genre (seuil continu ↔ seuil continu, over-under ↔ over-under…)
const WFAM = { ss:['ss_3x10','ss_3x12','ss_ou','ss_4x10','ss_2x20','ss_3x15'], thr:['thr_5x6','thr_4x8','thr_prog','thr_3x12','thr_2x15','thr_2x20'],
  ou:['ou_3x9','ou_3x12','thr_rel_3x12','ou_3x12b','ou_2x18','thr_rel_2x20'], vo2:['vo2_4x5','vo2_8x2','vo2_5x4','vo2_pyr','vo2_6x3','vo2_4020','vo2_3030'] };
const LZONES = [['ss','Sweet spot'],['thr','Seuil'],['vo2','VO2max']];
const LV0 = { ss:3, thr:3, vo2:3 };
const LV_AIM = [0.3, 0.7, 1.0]; // au-dessus du niveau selon la semaine du bloc : productive → plus dure → « stretch »
const LV_EVERY = 28; // calibrage mensuel (en jours), en plus de celui qui suit chaque test FTP
const famOf = wid => Object.keys(WFAM).find(f => WFAM[f].includes(wid)) || null;
const lvRound = v => Math.round(clamp(v, 1, 10)*10)/10;
const Levels = {
  // rejoue l'historique : séances du programme évaluées (réussie / trop dure / manquée) et tests FTP, dans l'ordre
  compute(upTo = todayISO()){
    const key = `${S.updatedAt}|${S.plan.length}|${S.activities.length}|${S.ftpHistory.length}|${upTo}`;
    if (this._c?.key === key) return this._c.v;
    const cur = { ...LV0 }, seen = {}, hist = [], byAct = {}, ev = [];
    for (const s of S.plan) {
      if (s.status !== 'done' || !s.activityId || WLVL[s.workoutId] == null || s.date > upTo) continue;
      const a = S.activities.find(x => x.id === s.activityId); if (a) ev.push({ date: s.date, o: 0, a, s });
    }
    const H = S.ftpHistory || [];
    H.forEach((h, i) => { if (h.source === 'test' && i > 0 && h.date <= upTo) ev.push({ date: h.date, o: 1, h, prev: H[i-1].ftp }); });
    ev.sort((x, y) => x.date.localeCompare(y.date) || x.o - y.o);
    for (const x of ev) {
      if (x.h) { // FTP en hausse : chaque séance devient plus dure en watts, les niveaux redescendent un peu
        const d = (x.h.ftp / x.prev - 1) * 100; if (!isFinite(d) || !d) continue;
        const from = { ...cur }; for (const z in cur) cur[z] = lvRound(cur[z] - clamp(0.25*d, -1, 2));
        hist.push({ date: x.date, test: true, ftp: x.h.ftp, prev: x.prev, from, to: { ...cur } }); continue;
      }
      const { a, s } = x, z = WORKOUTS[s.workoutId].type, Lw = WLVL[s.workoutId], L = cur[z];
      let e = null; try { e = sessionEval(a, s); } catch(err) {}
      if (!e || (!e.units.length && e.pending)) continue; // ni puissance ni ressenti : rien à conclure
      let n = L;
      if (e.cause === 'missed' || e.cause === 'hard' || (e.lvl === 2 && e.cause === 'under')) { if (Lw <= L + 0.5) n = L - 0.3; }
      else if (e.lvl === 0) { if (Lw >= L - 0.5) n = Math.min(L + 1.5, Math.max(L + 0.1, Lw + (e.cause === 'easy' ? 0.3 : 0))); }
      else if (e.lvl === 1 && Lw > L) n = L + Math.min(0.6, (Lw - L)/2);
      n = lvRound(n); seen[z] = true;
      byAct[a.id] = { z, from: L, to: n, wl: Lw };
      if (n !== L) { cur[z] = n; hist.push({ date: x.date, z, from: L, to: n, wid: s.workoutId, act: a.id }); }
    }
    const v = { cur, seen, hist, byAct }; this._c = { key, v }; return v;
  },
  // choisit, pour chaque séance clé à venir, la séance de la même famille au bon niveau (durée du jour respectée, pas deux fois la même en 2 semaines)
  apply(plan, p, L, from = todayISO()){
    const kinds = weekKinds(p), out = [];
    const pool = [...S.plan.filter(x => x.date < from), ...plan];
    const recent = (wid, date, id) => pool.some(x => x.id !== id && x.workoutId === wid && x.status !== 'skipped' && x.date < date && diffDays(x.date, date) <= 13);
    for (const s of plan.slice().sort((a, b) => a.date.localeCompare(b.date))) {
      if (s.status !== 'planned' || s.kind !== 'key' || s.date < from || s.origWorkoutId) continue;
      const fam = famOf(s.workoutId), z = WORKOUTS[s.workoutId]?.type; if (!fam || !L.seen[z]) continue;
      const pos = s.pos ?? kinds[s.week]?.pos, aim = L.cur[z] + (LV_AIM[pos] ?? LV_AIM[1]);
      const max = (p.days[dowMon(s.date)]?.max || 60) * 60;
      const c = WFAM[fam].filter(w => wDur(w) <= max); if (!c.length) continue;
      const sc = w => Math.abs(WLVL[w] - aim) + (w === s.workoutId ? -0.05 : recent(w, s.date, s.id) ? 0.6 : 0);
      const best = c.reduce((b, w) => sc(w) < sc(b) ? w : b);
      if (best !== s.workoutId) { out.push({ s, from: s.workoutId, to: best }); s.workoutId = best; delete s.adj; }
    }
    return out;
  },
  // calibrage : après un test FTP, chaque mois, ou à la demande ; ne touche jamais la séance du jour
  calibrate(reason){
    if (!S.profile || !S.plan.length) return null;
    const t = todayISO(), L = this.compute(t);
    const ch = this.apply(S.plan, S.profile, L, addDays(t, 1));
    S.levelCal = [...(S.levelCal || []), { date: t, reason, levels: { ...L.cur }, seen: Object.keys(L.seen),
      changes: ch.map(c => ({ id: c.s.id, date: c.s.date, from: c.from, to: c.to })) }].slice(-24);
    save(); return S.levelCal[S.levelCal.length - 1];
  },
  last: () => (S.levelCal || [])[(S.levelCal || []).length - 1] || null,
  nextDate(){ const l = this.last(); return addDays(l ? l.date : (S.profile?.startDate || todayISO()), LV_EVERY); },
  // au démarrage : calibrage mensuel s'il est dû et que de nouvelles séances l'alimentent
  monthly(){
    if (!S.profile || !S.plan.length || todayISO() < this.nextDate()) return null;
    const l = this.last(), L = this.compute();
    if (!L.hist.some(h => !l || h.date > l.date)) return null; // rien de neuf depuis le dernier calibrage
    return this.calibrate('mois');
  },
  reasonTxt: r => ({ test:'après le test FTP', mois:'calibrage mensuel', manuel:'à ta demande' })[r] || r,
  fmt: v => String(v.toFixed(1)).replace('.', ','),
  html(){
    if (!S.profile) return '';
    const L = this.compute(), l = this.last(), base = l?.levels || LV0;
    const bar = (z, label) => {
      const v = L.cur[z], d = Math.round((v - base[z])*10)/10, on = !!L.seen[z];
      const lo = Math.min(v, base[z]), w = x => `${(x/10*100).toFixed(1)}%`;
      return `<div class="row" style="gap:8px;align-items:center;margin:6px 0"><span class="small" style="width:76px">${label}</span><b class="num small" style="width:28px">${on ? this.fmt(v) : '—'}</b>
        <div style="flex:1;height:12px;background:var(--line);border-radius:3px;position:relative;overflow:hidden">${on ? `<div style="position:absolute;left:0;top:0;bottom:0;width:${w(lo)};background:var(--accent)"></div>${d ? `<div style="position:absolute;left:${w(lo)};top:0;bottom:0;width:${w(Math.abs(d))};background:repeating-linear-gradient(135deg,var(--accent) 0 3px,transparent 3px 6px);opacity:${d > 0 ? 1 : 0.45}"></div>` : ''}` : ''}</div>
        <span class="tiny num" style="width:34px;text-align:right;color:${d > 0 ? 'var(--ok)' : d < 0 ? 'var(--bad)' : 'var(--muted)'}">${on && d ? (d > 0 ? '+' : '−') + this.fmt(Math.abs(d)) : ''}</span></div>`;
    };
    const chg = l?.changes || [];
    return `<div class="card"><div class="row between"><h2>Niveaux de progression</h2><button class="btn sm" data-calib>Recalibrer</button></div>
      ${LZONES.map(([z, lab]) => bar(z, lab)).join('')}
      <p class="tiny muted" style="margin:8px 0 0">${l ? `Dernier calibrage le ${fmtShort(l.date)} (${this.reasonTxt(l.reason)})${chg.length ? ` : ${chg.length} séance${chg.length > 1 ? 's' : ''} recalée${chg.length > 1 ? 's' : ''}` : ' : programme déjà au bon niveau'}. ` : 'Pas encore de calibrage. '}Prochain : vers le ${fmtShort(this.nextDate())}, ou plus tôt après ton prochain test FTP. Les hachures montrent l'évolution depuis le dernier calibrage.</p>
      ${chg.length ? `<details style="margin-top:8px"><summary class="small" style="cursor:pointer;color:var(--accent);font-weight:600">Séances recalées</summary>${chg.map(c => `<div class="small" style="margin:4px 0">${fmtShort(c.date)} · ${esc(WORKOUTS[c.from]?.name || c.from)} → <b>${esc(WORKOUTS[c.to]?.name || c.to)}</b></div>`).join('')}</details>` : ''}
      <details style="margin-top:8px"><summary class="small" style="cursor:pointer;color:var(--accent);font-weight:600">Comment ça marche ?</summary><p class="small muted" style="margin:6px 0 0">Chaque séance a un niveau de 1 à 10 dans sa zone. Une séance réussie près ou au-dessus de ton niveau le fait monter, une séance manquée ou trop dure à ton niveau le fait baisser, et une hausse de FTP le fait redescendre un peu (les mêmes pourcentages valent plus de watts). Au calibrage, chaque séance clé à venir est remplacée par une séance du même genre, un peu au-dessus de ton niveau : +0,3 la 1re semaine du bloc, +0,7 la 2e, +1 la 3e. Les séances que tu as modifiées à la main ne bougent pas.</p></details></div>`;
  },
};
