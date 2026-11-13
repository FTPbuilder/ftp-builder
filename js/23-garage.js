"use strict";
// FTP Builder · Profil › GARAGE : mes vélos, kilométrage route / home trainer, usure des composants, entretien, pression des pneus
/* ============ Garage ============
   S.garage = { bikes:[Bike], log:[Entrée], assign:{ ref → bikeId | 'none' }, sel:bikeId }
   - Bike = { id, name, model ('aeroad-cfr' | 'road'), since (date ISO : les sorties comptent à partir de ce jour), km0:{ road, ht } (km avant),
              rule:{ out, ht, taf } (sorties extérieures, home trainer, vélotaf reçues par ce vélo), trainer ('direct' | 'wheel'),
              tires:{ f, r (largeur gravée, mm), internal (largeur interne jante, mm), setup ('tube' | 'latex' | 'tubeless'), hookless, surface, speed },
              parts:{ key → { at (date de pose), spec, life } } }
   - Entrée = { id, bikeId, date, part (clé ou ''), kind ('replace' | 'charge' | 'lube' | 'clean' | 'check' | 'service' | 'buy'), label, price, value }
   - aucune distance n'est stockée : tout se recalcule à partir des sorties (S.activities + séances vélo d'Apple Santé / Intervals),
     donc le kilométrage monte tout seul à chaque sortie importée et reste juste après une resynchro. */
const Garage = (() => {
  const G = () => { const g = (S.garage ||= {}); g.bikes ||= []; g.log ||= []; g.assign ||= {}; return g; };
  const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const n0 = v => Math.round(v).toLocaleString('fr-FR');
  const dfr = s => { const d = parseD(s); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
  const BACK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>`;

  /* ---------- catalogue : modèles 3D et composants ---------- */
  const MODELS = {
    'aeroad-cfr': { name: 'Canyon Aeroad CFR Di2', short: 'Aeroad CFR', kg: 7.12, di2: true, pm: true, tires: { f: 26, r: 28, internal: 22 },
      spec: { tireF: 'Continental Aero 111 · 26 mm', tireR: 'Continental Grand Prix 5000 S TR · 28 mm', chain: 'Shimano XTR 12 v', cassette: 'Dura-Ace CS-R9200 · 11-30', rings: 'Dura-Ace 52/36', jockey: 'Galets RD-R9250',
        pads: 'Étriers Dura-Ace BR-R9270', rotors: 'Shimano RT-CL900 · 160 / 140 mm', headset: 'Jeu de direction Aeroad', bb: 'Boîtier de pédalier', tape: 'Lizard Skins DSP V2 · 1,8 mm',
        di2: 'Shimano BT-DN300 (dans la tige de selle)', coin: 'Piles CR1632 des leviers ST-R9270', pm: 'Dura-Ace Powermeter · 165 mm', sealant: 'Liquide préventif tubeless' },
      life: { tireF: 3000 } },
    road: { name: 'Vélo de route', short: 'Route', kg: 8.5, di2: false, pm: false, tires: { f: 28, r: 28, internal: 21 }, spec: {}, life: {} },
  };
  // basis : road = km dehors · all = dehors + home trainer × ht · time = jours · charge = km (ou h) depuis la dernière recharge
  const PARTS = [
    { k: 'tireF', l: 'Pneu avant', g: 'tireF', basis: 'road', life: 4000, tip: 'Remplace au témoin d\'usure, à la toile visible ou après plusieurs coupures.' },
    { k: 'tireR', l: 'Pneu arrière', g: 'tireR', basis: 'road', life: 3500, tip: 'L\'arrière s\'use ~1,5× plus vite que l\'avant ; tu peux permuter une fois à mi-vie.' },
    { k: 'chain', l: 'Chaîne', g: 'chain', basis: 'all', ht: 1, life: 4000, tip: 'Le home trainer use la chaîne autant que la route : elle compte les deux.' },
    { k: 'cassette', l: 'Cassette', g: 'cassette', basis: 'road', life: 12000, tip: 'Compte ~3 chaînes par cassette si la chaîne est changée à 0,5 %.' },
    { k: 'rings', l: 'Plateaux', g: 'crank', basis: 'all', ht: 1, life: 20000 },
    { k: 'jockey', l: 'Galets de dérailleur', g: 'rd', basis: 'all', ht: 1, life: 10000 },
    { k: 'pads', l: 'Plaquettes de frein', g: 'calipers', basis: 'road', life: 3000, tip: 'Remplace sous 0,5 mm de garniture (ou plus tôt après des descentes sous la pluie).' },
    { k: 'headset', l: 'Roulements de direction', g: 'headset', basis: 'all', ht: 1.5, life: 12000, tip: 'La sueur du home trainer coule sur la direction : elle compte 1,5× les km d\'intérieur.' },
    { k: 'bb', l: 'Boîtier de pédalier', g: 'bb', basis: 'all', ht: 1, life: 15000 },
    { k: 'tape', l: 'Guidoline', g: 'cockpit', basis: 'time', life: 365 },
    { k: 'sealant', l: 'Liquide préventif', g: 'tireR', basis: 'time', life: 120, only: b => b.tires?.setup === 'tubeless' },
    { k: 'di2', l: 'Batterie Di2', g: 'battery', basis: 'charge', life: 1500, unit: 'km', only: b => MODELS[b.model]?.di2, tip: 'Shimano annonce de 1 000 à 2 000 km par charge : recharge-la avant une course.' },
    { k: 'coin', l: 'Piles des leviers', g: 'levers', basis: 'time', life: 540, only: b => MODELS[b.model]?.di2, tip: 'CR1632 : autour de 1,5 à 2 ans.' },
    { k: 'pm', l: 'Capteur de puissance', g: 'crank', basis: 'charge', life: 300, unit: 'h', only: b => MODELS[b.model]?.pm, tip: 'Environ 300 h par charge.' },
  ];
  const partsOf = b => PARTS.filter(p => !p.only || p.only(b));
  const P = k => PARTS.find(p => p.k === k);

  /* ---------- sorties vélo : route ou home trainer, vélotaf ou non ---------- */
  function rides(){
    const out = [];
    for (const a of S.activities || []) { if (!a.date) continue; const ht = isIndoor(a), min = (a.durationS || 0)/60; let km = +a.distanceKm || 0, est = false;
      if (!km && ht && min) { km = min/2; est = true; } // home trainer sans distance : 30 km/h
      out.push({ ref: 'a:' + a.id, date: a.date, ts: a.startTs || 0, km, est, ht, taf: isVelotaf(a), name: a.name || 'Vélo', min }); }
    try { for (const e of Health.extraWorkouts()) if (e.sport === 'bike') { const w = e.w, ht = Health.bikeIndoor(w), min = +w.duration_min || 0; let km = +w.distance_km || 0, est = false;
      if (!km && ht && min) { km = min/2; est = true; }
      out.push({ ref: 'w:' + w.start_at, date: e.date, ts: Math.floor(Date.parse(w.start_at)/1000), km, est, ht, taf: isVelotafW(w), name: w.type || 'Vélo', min }); } } catch (e) {}
    return out.sort((x, y) => (y.date.localeCompare(x.date)) || (y.ts - x.ts));
  }
  const kindOf = r => r.ht ? 'ht' : r.taf ? 'taf' : 'out';
  function bikeIdOf(r){
    const g = G(), o = g.assign[r.ref];
    if (o) return o === 'none' || !g.bikes.some(b => b.id === o) ? null : o;
    const b = g.bikes.find(b => r.date >= (b.since || '0000') && b.rule?.[kindOf(r)]);
    return b ? b.id : null;
  }
  const ridesOf = (b, all = rides()) => all.filter(r => bikeIdOf(r) === b.id);

  /* ---------- usure ---------- */
  const daysSince = d => Math.max(0, diffDays(d, todayISO()));
  const lastLog = (b, kind, part, after) => G().log.filter(e => e.bikeId === b.id && e.kind === kind && (!part || e.part === part) && (!after || e.date >= after)).sort((x, y) => y.date.localeCompare(x.date))[0];
  function partInfo(b, k, rs = ridesOf(b)){
    const p = P(k), st = b.parts?.[k] || {}, at = st.at || b.since, life = +st.life || MODELS[b.model]?.life?.[k] || p.life;
    const after = rs.filter(r => r.date >= at), road = after.filter(r => !r.ht).reduce((s, r) => s + r.km, 0), ht = after.filter(r => r.ht).reduce((s, r) => s + r.km, 0);
    const orig = !st.at; // pièce d'origine : on ajoute les km d'avant le suivi
    const road0 = orig ? (+b.km0?.road || 0) : 0, ht0 = orig ? (+b.km0?.ht || 0) : 0;
    let used, unit = 'km', since = at;
    if (p.basis === 'time') { used = daysSince(at); unit = 'j'; }
    else if (p.basis === 'charge') { const c = lastLog(b, 'charge', k, at); since = c ? c.date : at; const rr = rs.filter(r => r.date >= since);
      used = p.unit === 'h' ? rr.reduce((s, r) => s + r.min, 0)/60 : rr.reduce((s, r) => s + r.km, 0); unit = p.unit; }
    else { const htF = p.basis === 'road' ? (k === 'cassette' && b.trainer === 'wheel' ? 1 : 0) : (p.ht ?? 1);
      used = road + road0 + (ht + ht0)*htF; }
    let wear = clamp(used/life, 0, 1.5), measured = null;
    if (k === 'chain') { const m = lastLog(b, 'check', 'chain', at); if (m && +m.value > 0) { measured = +m.value; wear = Math.max(wear, clamp(measured/0.5, 0, 1.5)); } }
    return { k, l: p.l, g: p.g, spec: st.spec || MODELS[b.model]?.spec?.[k] || '', at, since, orig, life, used, unit, road: road + road0, ht: ht + ht0, wear, rem: clamp(1 - wear, 0, 1), measured, charge: p.basis === 'charge' };
  }
  const allParts = (b, rs = ridesOf(b)) => partsOf(b).map(p => partInfo(b, p.k, rs));
  const col = rem => rem >= .6 ? 'var(--ok)' : rem >= .35 ? 'var(--warn)' : 'var(--bad)';
  const pct = v => Math.round(v*100) + ' %';
  const usedTxt = i => i.unit === 'j' ? `${i.used} j / ${i.life} j` : i.unit === 'h' ? `${Math.round(i.used)} h / ${i.life} h` : `${n0(i.used)} / ${n0(i.life)} km`;
  const barHTML = (rem, charge) => `<span class="gr-bar${charge ? ' bat' : ''}" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(rem*100)}"><i style="width:${Math.max(3, rem*100)}%;background:${col(rem)}"></i></span>`;

  function stats(b, rs = ridesOf(b)){
    const m = todayISO().slice(0, 7), road = rs.filter(r => !r.ht).reduce((s, r) => s + r.km, 0) + (+b.km0?.road || 0), ht = rs.filter(r => r.ht).reduce((s, r) => s + r.km, 0) + (+b.km0?.ht || 0);
    const month = rs.filter(r => r.date.startsWith(m)).reduce((s, r) => s + r.km, 0);
    return { road, ht, total: road + ht, month, n: rs.length, last: rs[0] || null, est: rs.some(r => r.est) };
  }

  /* ---------- entretien de la transmission ---------- */
  const CARE = [
    { k: 'lube', l: 'Lubrifier la chaîne', km: 300, how: 'Chaîne propre et sèche : une goutte par rouleau côté intérieur, tourne les manivelles 30 s, laisse pénétrer quelques minutes puis essuie l\'excédent. Après une sortie sous la pluie : le jour même.' },
    { k: 'clean', l: 'Nettoyage complet', km: 1500, days: 60, how: 'Dégraissant sur chaîne, cassette, plateaux et galets, brosse, rinçage à l\'eau douce (pas de jet haute pression sur les roulements), séchage complet, puis lubrification.' },
    { k: 'check', l: 'Mesurer l\'allongement de la chaîne', km: 1000, how: 'Jauge 0,5 % : en 12 vitesses, change la chaîne dès 0,5 % pour épargner cassette et plateaux. Saisis la mesure, elle corrige l\'usure estimée.' },
  ];
  function careInfo(b, c, rs = ridesOf(b)){
    const e = lastLog(b, c.k), from = e ? e.date : b.since, rr = rs.filter(r => r.date > from || (!e && r.date >= from));
    const km = rr.reduce((s, r) => s + r.km*(r.ht ? 0.5 : 1), 0), d = daysSince(from); // home trainer : transmission moins encrassée
    const ratio = Math.max(km/c.km, c.days ? d/c.days : 0);
    return { ...c, from, done: !!e, km, d, ratio, rem: clamp(1 - ratio, 0, 1), wet: rr.some(r => !r.ht) };
  }

  /* ---------- pression des pneus (méthode inspirée de SILCA) ----------
     Base : 15 % d'écrasement du pneu (courbes de Frank Berto) selon la charge par roue et la largeur MESURÉE,
     puis on descend selon l'état de la route (l'impédance de surface de SILCA : au-delà d'une pression « point de rupture », le pneu rebondit et ralentit),
     un peu moins avec latex / tubeless, un peu plus vite on roule. Plafond 5 bar (72,5 psi) en jante hookless (norme ETRTO). */
  const SURF = { new: ['Neuf, très lisse', .92], worn: ['Usé, quelques fissures', .85], poor: ['Dégradé, gravillons', .77], cobble: ['Pavés, chemins', .66] };
  const SETUP = { tube: ['Chambre butyl', 1], latex: ['Chambre latex', .97], tubeless: ['Tubeless', .95] };
  function pressure(b){
    const t = { ...MODELS[b.model]?.tires, surface: 'worn', setup: 'tube', ...(b.tires || {}) }, kg = (+S.profile?.weightKg || 75) + (MODELS[b.model]?.kg || 8.5) + 1.5;
    const v = +t.speed || avgSpeed(b) || 30, sp = clamp(1 + (v - 30)*0.004, 0.95, 1.06), sf = SURF[t.surface]?.[1] || .85, tf = SETUP[t.setup]?.[1] || 1;
    const meas = w => +w + Math.max(0, (+t.internal || 19) - 19)*0.5; // une jante large ouvre le pneu : ~ +0,5 mm par mm au-delà de 19
    const one = (w, share) => { const lb = kg*share*2.2046, mw = meas(w), psi = 80*(lb/100)*Math.pow(28/mw, 1.845)*sf*tf*sp; return { mw, psi }; };
    const f = one(t.f, .47), r = one(t.r, .53), cap = t.hookless ? 72.5 : Infinity;
    const out = x => { const psi = Math.min(cap, Math.max(40, x.psi)); return { psi: Math.round(psi), bar: Math.round(psi/14.5038*10)/10, mw: x.mw, capped: x.psi > cap }; };
    return { t, kg, v, f: out(f), r: out(r) };
  }
  function avgSpeed(b){ const out = ridesOf(b).filter(r => !r.ht && !r.taf && r.km > 20 && r.min > 30).slice(0, 10); if (!out.length) return null;
    return Math.round(out.reduce((s, r) => s + r.km, 0)/out.reduce((s, r) => s + r.min/60, 0)); }

  /* ---------- vélos ---------- */
  function newBike(model = 'aeroad-cfr'){
    const first = rides().filter(r => !r.taf).map(r => r.date).sort()[0] || todayISO(), M = MODELS[model];
    return { id: rid(), name: model === 'aeroad-cfr' ? 'Vélo de tri' : M.name, model, since: first, km0: { road: 0, ht: 0 }, rule: { out: true, ht: true, taf: false }, trainer: 'direct', tires: { ...M.tires, setup: 'tube', surface: 'worn', hookless: false }, parts: {}, added: todayISO() };
  }
  const cur = () => { const g = G(); return g.bikes.find(b => b.id === g.sel) || g.bikes[0] || null; };
  let explode = false, lastHit = null;

  /* ---------- Profil : tuile GARAGE ---------- */
  function tileHTML(){
    const b = cur(); if (!b) return `<button type="button" class="card gr-tile" data-pp="garage"><span class="gr-tl">Garage</span><span class="tiny muted">Ajoute ton vélo : kilométrage, usure, entretien, pression</span><span class="muted" aria-hidden="true">›</span></button>`;
    const rs = ridesOf(b), s = stats(b, rs), worst = allParts(b, rs).sort((x, y) => x.rem - y.rem)[0];
    return `<button type="button" class="card gr-tile" data-pp="garage"><span class="gr-tl">Garage</span><span style="flex:1;min-width:0;text-align:left"><b>${esc(b.name)}</b><span class="tiny muted" style="display:block">${esc(MODELS[b.model]?.name || '')} · ${n0(s.total)} km</span>
      ${worst ? `<span class="tiny" style="display:flex;gap:6px;align-items:center;margin-top:4px"><span class="muted">${esc(worst.l)}</span>${barHTML(worst.rem, worst.charge)}<b style="color:${col(worst.rem)}">${pct(worst.rem)}</b></span>` : ''}</span><span class="muted" aria-hidden="true">›</span></button>`;
  }

  /* ---------- volet GARAGE ---------- */
  const head = (t, extra = '') => `<div class="pane-head"><button class="pane-back" data-pp="back" aria-label="Retour">${BACK}</button><h2>${t}</h2>${extra}</div>`;
  function pane(){
    const g = G(), b = cur();
    if (!b) return `<div class="pane-in gr">${head('Garage')}<div class="card"><h2>Ton premier vélo</h2><p class="small muted">Le kilométrage se calcule tout seul à partir de tes sorties (dehors et home trainer, le vélotaf à part), et chaque composant affiche son usure estimée.</p>
      <div class="row"><button class="btn primary" data-gr="add" data-m="aeroad-cfr">+ Canyon Aeroad CFR Di2</button><button class="btn" data-gr="add" data-m="road">+ Autre vélo de route</button></div></div></div>`;
    const rs = ridesOf(b), s = stats(b, rs), parts = allParts(b, rs), M = MODELS[b.model] || MODELS.road;
    const chips = `<div class="seg gr-bikes">${g.bikes.map(x => `<button type="button" class="${x.id === b.id ? 'on' : ''}" data-gr="sel" data-id="${x.id}">${esc(x.name)}</button>`).join('')}<button type="button" data-gr="addask">+ Vélo</button></div>`;
    let h = `<div class="pane-in gr">${head('Garage')}${chips}
      <div class="card gr-3dcard"><div class="row between" style="align-items:baseline"><div><h2 style="margin:0">${esc(b.name)}</h2><div class="tiny muted">${esc(M.name)}</div></div><span class="num gr-km">${n0(s.total)}<small> km</small></span></div>
        <div class="gr-view" id="gr3d" data-exploded="${explode ? 1 : 0}"><div class="gr-load tiny muted">Chargement de la maquette 3D…</div></div>
        <div class="row between" style="margin-top:8px"><span class="tiny muted" id="grHint">${explode ? 'Touche un composant pour son détail' : 'Glisse pour tourner · touche le vélo pour l\'éclater'}</span>
          <span class="row" style="gap:6px"><button class="btn sm" data-gr="reset3d" aria-label="Recentrer la vue">⟲</button><button class="btn sm${explode ? '' : ' primary'}" data-gr="explode">${explode ? 'Remonter' : 'Éclater'}</button></span></div></div>`;
    // kilométrage
    h += `<div class="card"><h2>Kilométrage</h2><div class="gr-kms"><div><small>Route</small><b class="num">${n0(s.road)}</b> km</div><div><small>Home trainer</small><b class="num">${n0(s.ht)}</b> km</div><div><small>Ce mois-ci</small><b class="num">${n0(s.month)}</b> km</div></div>
      <div class="tiny muted" style="margin-top:6px">${s.n} sortie${s.n > 1 ? 's' : ''} depuis le ${dfr(b.since)}${(+b.km0?.road || +b.km0?.ht) ? ` + ${n0((+b.km0.road || 0) + (+b.km0.ht || 0))} km d'avant` : ''}${b.rule?.taf ? '' : ' · vélotaf exclu'}${s.est ? ' · HT sans distance compté à 30 km/h' : ''}</div></div>`;
    // usure
    const sorted = parts.slice().sort((x, y) => x.rem - y.rem);
    h += `<div class="card"><div class="row between"><h2 style="margin:0">Usure estimée</h2><span class="tiny muted">reste</span></div><div class="gr-parts">${sorted.map(i => `<button type="button" class="gr-part" data-gr="part" data-k="${i.k}"><span class="gr-pl"><b>${esc(i.l)}</b><span class="tiny muted">${usedTxt(i)}${i.measured ? ` · mesurée ${String(i.measured).replace('.', ',')} %` : ''}</span></span>${barHTML(i.rem, i.charge)}<b class="gr-pv" style="color:${col(i.rem)}">${i.charge ? '🔋 ' : ''}${pct(i.rem)}</b></button>`).join('')}</div>
      <p class="tiny muted" style="margin:8px 0 0">Durées de vie moyennes, ajustables dans chaque fiche. Une pièce remplacée repart de zéro à sa date de pose.</p></div>`;
    // entretien transmission
    const care = CARE.map(c => careInfo(b, c, rs));
    h += `<div class="card"><h2>Entretien de la transmission</h2>${care.map(c => `<div class="gr-care"><div class="row between" style="gap:8px;flex-wrap:nowrap"><span style="min-width:0"><b>${esc(c.l)}</b><span class="tiny muted" style="display:block">${c.done ? `fait le ${fmtShort(c.from)} · ` : ''}${n0(c.km)} km${c.k !== 'check' && c.days ? ` · ${c.d} j` : ''} depuis — à refaire tous les ${n0(CARE.find(x => x.k === c.k).km)} km${c.days ? ` ou ${c.days} j` : ''}</span></span>
        <span class="gr-st" style="color:${c.ratio >= 1 ? 'var(--bad)' : c.ratio >= .75 ? 'var(--warn)' : 'var(--ok)'}">${c.ratio >= 1 ? 'À faire' : c.ratio >= .75 ? 'Bientôt' : 'OK'}</span>
        <button class="btn sm" data-gr="care" data-k="${c.k}">${c.k === 'check' ? 'Mesurer' : 'Fait'}</button></div><details class="tiny muted"><summary>Comment faire</summary>${esc(c.how)}</details></div>`).join('')}
      <p class="tiny muted" style="margin:8px 0 0">Les km de home trainer comptent pour moitié (transmission moins encrassée). Après le HT : essuie la sueur sur la direction, le cintre et la tige de selle.</p></div>`;
    // pression
    const pr = pressure(b), t = pr.t, opt = (o, v) => Object.entries(o).map(([k, [l]]) => `<option value="${k}"${k === v ? ' selected' : ''}>${l}</option>`).join('');
    h += `<div class="card gr-pr"><div class="row between"><h2 style="margin:0">Pression des pneus</h2><a class="tiny" href="https://silca.cc/pages/sppc-pro" target="_blank" rel="noopener">Calculateur SILCA ↗</a></div>
      <div class="gr-prout"><div><small>Avant · ${t.f} mm</small><b class="num">${String(pr.f.bar).replace('.', ',')}</b> bar<span class="tiny muted">${pr.f.psi} psi</span></div><div><small>Arrière · ${t.r} mm</small><b class="num">${String(pr.r.bar).replace('.', ',')}</b> bar<span class="tiny muted">${pr.r.psi} psi</span></div></div>
      ${pr.f.capped || pr.r.capped ? '<p class="tiny" style="color:var(--warn);margin:4px 0">Plafonné à 5 bar : limite des jantes hookless.</p>' : ''}
      <div class="gr-grid"><div><label class="f">Route</label><select data-grt="surface">${opt(SURF, t.surface)}</select></div><div><label class="f">Montage</label><select data-grt="setup">${opt(SETUP, t.setup)}</select></div>
        <div><label class="f">Pneu avant (mm)</label><input type="number" inputmode="numeric" min="20" max="40" data-grt="f" value="${t.f}"></div><div><label class="f">Pneu arrière (mm)</label><input type="number" inputmode="numeric" min="20" max="40" data-grt="r" value="${t.r}"></div>
        <div><label class="f">Largeur interne jante (mm)</label><input type="number" inputmode="numeric" min="13" max="30" data-grt="internal" value="${t.internal}"></div><div><label class="f">Vitesse moyenne (km/h)</label><input type="number" inputmode="numeric" min="15" max="50" data-grt="speed" value="${t.speed || ''}" placeholder="${pr.v}"></div></div>
      <label class="row tiny" style="margin-top:8px;gap:8px"><input type="checkbox" data-grt="hookless" ${t.hookless ? 'checked' : ''}> Jante hookless (5 bar max)</label>
      <p class="tiny muted" style="margin:8px 0 0">Système ${Math.round(pr.kg)} kg (toi ${S.profile?.weightKg || '?'} kg + vélo ${String(M.kg).replace('.', ',')} kg + 1,5 kg d'équipement), 47 % avant / 53 % arrière, largeur mesurée ≈ ${String(Math.round(pr.f.mw*10)/10).replace('.', ',')} / ${String(Math.round(pr.r.mw*10)/10).replace('.', ',')} mm. Estimation inspirée de la méthode SILCA (écrasement de 15 % puis impédance de la route) : vérifie sur leur calculateur, et ne dépasse jamais la pression maxi du pneu ni de la jante.</p></div>`;
    // journal & achats
    const log = g.log.filter(e => e.bikeId === b.id).sort((x, y) => y.date.localeCompare(x.date)), spent = log.reduce((s, e) => s + (+e.price || 0), 0);
    h += `<div class="card"><div class="row between"><h2 style="margin:0">Journal et achats</h2><button class="btn sm primary" data-gr="log">+ Ajouter</button></div>
      ${spent ? `<div class="tiny muted" style="margin-top:4px">Dépensé : <b style="color:var(--text)">${n0(spent)} €</b></div>` : ''}
      ${log.length ? `<div class="gr-log">${log.slice(0, 30).map(e => `<button type="button" class="gr-le" data-gr="logopen" data-id="${e.id}"><span>${KIND[e.kind]?.[0] || '•'}</span><span style="flex:1;min-width:0"><b>${esc(e.label || (P(e.part)?.l) || KIND[e.kind]?.[1] || '')}</b><span class="tiny muted" style="display:block">${fmtShort(e.date)}${e.part && P(e.part) && e.label ? ' · ' + esc(P(e.part).l) : ''}${e.value ? ` · ${String(e.value).replace('.', ',')} %` : ''}</span></span>${e.price ? `<b class="num">${n0(e.price)} €</b>` : ''}</button>`).join('')}</div>` : '<p class="small muted" style="margin:8px 0 0">Pièces achetées, remplacements, recharges, nettoyages : tout s\'enregistre ici.</p>'}</div>`;
    // sorties
    const allR = rides().slice(0, 40), opts = r => [['', 'Auto'], ...g.bikes.map(x => [x.id, x.name]), ['none', 'Aucun']].map(([v, l]) => `<option value="${v}"${(g.assign[r.ref] || '') === v ? ' selected' : ''}>${esc(l)}</option>`).join('');
    h += `<div class="card"><h2>Sorties</h2><p class="tiny muted" style="margin:-4px 0 8px">Chaque sortie va au vélo qui reçoit son type (dehors, home trainer, vélotaf). Corrige ici si besoin.</p>
      <div class="gr-rides">${allR.map(r => { const bid = bikeIdOf(r), bb = g.bikes.find(x => x.id === bid); return `<div class="gr-ride"><span class="gr-ic" aria-hidden="true">${r.ht ? '🏠' : r.taf ? '🚲' : '🚴'}</span><span style="flex:1;min-width:0"><b>${esc(r.name)}</b><span class="tiny muted" style="display:block">${fmtShort(r.date)} · ${n0(r.km)} km${r.est ? ' (est.)' : ''} · ${r.ht ? 'home trainer' : r.taf ? 'vélotaf' : 'route'}${bb ? '' : ' · non compté'}</span></span><select data-grassign="${esc(r.ref)}" aria-label="Vélo de cette sortie">${opts(r)}</select></div>`; }).join('') || '<p class="small muted">Aucune sortie pour l\'instant.</p>'}</div></div>`;
    // réglages du vélo
    h += `<div class="card"><details><summary><b>Réglages du vélo</b></summary>
      <label class="f">Nom</label><input data-grb="name" value="${esc(b.name)}" maxlength="40">
      <label class="f">Modèle</label><select data-grb="model">${Object.entries(MODELS).map(([k, m]) => `<option value="${k}"${k === b.model ? ' selected' : ''}>${esc(m.name)}</option>`).join('')}</select>
      <label class="f">Les sorties comptent à partir du</label><input type="date" data-grb="since" value="${b.since}">
      <div class="gr-grid"><div><label class="f">Km route avant</label><input type="number" inputmode="numeric" min="0" data-grb="km0.road" value="${+b.km0?.road || 0}"></div><div><label class="f">Km home trainer avant</label><input type="number" inputmode="numeric" min="0" data-grb="km0.ht" value="${+b.km0?.ht || 0}"></div></div>
      <label class="f">Ce vélo reçoit</label><div class="row tiny" style="gap:14px"><label class="row" style="gap:6px"><input type="checkbox" data-grb="rule.out" ${b.rule?.out ? 'checked' : ''}> Sorties dehors</label><label class="row" style="gap:6px"><input type="checkbox" data-grb="rule.ht" ${b.rule?.ht ? 'checked' : ''}> Home trainer</label><label class="row" style="gap:6px"><input type="checkbox" data-grb="rule.taf" ${b.rule?.taf ? 'checked' : ''}> Vélotaf</label></div>
      <label class="f">Home trainer</label><select data-grb="trainer"><option value="direct"${b.trainer !== 'wheel' ? ' selected' : ''}>Transmission directe (Tacx Flux 2 : sa propre cassette)</option><option value="wheel"${b.trainer === 'wheel' ? ' selected' : ''}>Roue sur rouleau (la cassette du vélo tourne)</option></select>
      <div class="row between" style="margin-top:12px">${g.bikes[0]?.id !== b.id ? '<button class="btn sm" data-gr="main">Mettre en premier</button>' : '<span class="tiny muted">Vélo principal</span>'}<button class="btn sm danger" data-gr="del">Supprimer ce vélo</button></div></details></div>`;
    return h + '</div>';
  }
  const KIND = { replace: ['🔧', 'Remplacement'], buy: ['🛒', 'Achat'], charge: ['🔋', 'Recharge'], lube: ['💧', 'Lubrification'], clean: ['🧽', 'Nettoyage complet'], check: ['📏', 'Mesure de la chaîne'], service: ['🛠️', 'Révision'] };

  /* ---------- fiches ---------- */
  function partDlg(k){
    const b = cur(); if (!b || !P(k)) return; const i = partInfo(b, k), p = P(k);
    const hist = G().log.filter(e => e.bikeId === b.id && e.part === k).sort((x, y) => y.date.localeCompare(x.date));
    openDlg(`<h3 style="margin:0 0 2px">${esc(i.l)}</h3><div class="tiny muted">${esc(i.spec || '—')}</div>
      <div class="gr-big"><span style="color:${col(i.rem)}" class="num">${i.charge ? '🔋 ' : ''}${pct(i.rem)}</span><span class="tiny muted">${i.charge ? 'de charge estimée' : 'de vie restante'}</span></div>${barHTML(i.rem, i.charge)}
      <div class="tiny muted" style="margin:8px 0">${usedTxt(i)} ${i.charge ? `depuis la recharge du ${fmtShort(i.since)}` : `depuis ${i.orig ? 'l\'origine' : 'la pose'} (${dfr(i.at)})`}${!i.charge && i.unit === 'km' ? ` · route ${n0(i.road)} km, home trainer ${n0(i.ht)} km` : ''}</div>
      ${p.tip ? `<p class="small muted" style="margin:0 0 8px">${esc(p.tip)}</p>` : ''}
      ${k === 'chain' ? `<label class="f">Mesure d'allongement (%)</label><div class="row"><input type="number" step="0.05" min="0" max="1.5" inputmode="decimal" id="grMeas" placeholder="0,25" style="flex:1"><button class="btn" data-gr="measure">Enregistrer</button></div>` : ''}
      ${i.charge ? `<button class="btn primary" data-gr="charge" data-k="${k}" style="width:100%;margin-top:8px">🔋 Rechargé aujourd'hui</button>` : ''}
      <details class="more" style="margin-top:10px"${i.charge ? '' : ' open'}><summary>${i.charge ? 'Remplacer' : 'Remplacé'}</summary>
        <div class="gr-grid"><div><label class="f">Date de pose</label><input type="date" id="grRepD" value="${todayISO()}"></div><div><label class="f">Prix (€)</label><input type="number" inputmode="decimal" min="0" id="grRepP" placeholder="0"></div></div>
        <label class="f">Modèle</label><input id="grRepS" value="${esc(i.spec)}" maxlength="80">
        <button class="btn primary" data-gr="replace" data-k="${k}" style="width:100%;margin-top:10px">Enregistrer le remplacement</button></details>
      <label class="f">Durée de vie (${i.unit === 'j' ? 'jours' : i.unit === 'h' ? 'heures par charge' : i.charge ? 'km par charge' : 'km'})</label><div class="row"><input type="number" inputmode="numeric" min="1" id="grLife" value="${i.life}" style="flex:1"><button class="btn" data-gr="life" data-k="${k}">OK</button></div>
      ${hist.length ? `<h4 style="margin:14px 0 4px">Historique</h4>${hist.map(e => `<div class="tiny muted">${fmtShort(e.date)} · ${KIND[e.kind]?.[1] || ''}${e.label ? ' · ' + esc(e.label) : ''}${e.price ? ` · ${n0(e.price)} €` : ''}</div>`).join('')}` : ''}`);
  }
  function logDlg(id){
    const b = cur(), e = id ? G().log.find(x => x.id === id) : null; if (!b) return;
    openDlg(`<h3 style="margin:0 0 6px">${e ? 'Modifier' : 'Ajouter au journal'}</h3>
      <label class="f">Type</label><select id="grLK">${Object.entries(KIND).map(([k, [ic, l]]) => `<option value="${k}"${(e?.kind || 'buy') === k ? ' selected' : ''}>${ic} ${l}</option>`).join('')}</select>
      <label class="f">Composant</label><select id="grLP"><option value="">—</option>${partsOf(b).map(p => `<option value="${p.k}"${e?.part === p.k ? ' selected' : ''}>${esc(p.l)}</option>`).join('')}</select>
      <label class="f">Libellé (marque, modèle…)</label><input id="grLL" maxlength="80" value="${esc(e?.label || '')}" placeholder="Ex. chaîne Shimano XTR M9100">
      <div class="gr-grid"><div><label class="f">Date</label><input type="date" id="grLD" value="${e?.date || todayISO()}"></div><div><label class="f">Prix (€)</label><input type="number" inputmode="decimal" min="0" id="grLPr" value="${e?.price || ''}"></div></div>
      <p class="tiny muted">« Remplacement » remet le compteur du composant à zéro à cette date.</p>
      <div class="row between" style="margin-top:10px">${e ? `<button class="btn danger sm" data-gr="logdel" data-id="${e.id}">Supprimer</button>` : '<span></span>'}<button class="btn primary" data-gr="logsave" data-id="${e?.id || ''}">Enregistrer</button></div>`);
  }
  function addAskDlg(){
    openDlg(`<h3 style="margin:0 0 6px">Ajouter un vélo</h3><p class="small muted">Maquette 3D détaillée pour l'Aeroad CFR ; les autres marques arrivent ensuite (maquette générique en attendant).</p>
      <div class="row"><button class="btn primary" data-gr="add" data-m="aeroad-cfr">Canyon Aeroad CFR Di2</button><button class="btn" data-gr="add" data-m="road">Autre vélo de route</button></div>
      <p class="tiny muted" style="margin-top:10px">Un 2e vélo (vélotaf…) ne reçoit que les sorties que tu lui attribues dans ses réglages.</p>`);
  }
  // pose d'une pièce : compteur remis à zéro (rechargement si batterie)
  function setPart(b, k, at, spec, price){
    b.parts ||= {}; b.parts[k] = { ...(b.parts[k] || {}), at, spec: spec || b.parts[k]?.spec || '' };
    G().log.push({ id: rid(), bikeId: b.id, date: at, part: k, kind: 'replace', label: spec || '', price: +price || 0 });
  }

  /* ---------- 3D ---------- */
  function mount(){
    const el = document.getElementById('gr3d'), b = cur(); if (!el || !b) return;
    const parts = allParts(b);
    // les groupes 3D portent le témoin de la pièce la plus usée qu'ils contiennent
    const tags = {}; for (const i of parts) { if (!tags[i.g] || i.rem < tags[i.g].rem) tags[i.g] = { k: i.k, l: i.l, rem: i.rem, charge: i.charge, col: col(i.rem), txt: (i.charge ? '🔋 ' : '') + pct(i.rem) }; }
    Bike3D.mount(el, { model: b.model, exploded: explode, tags, onTap: hit => {
      if (!explode) { explode = true; Bike3D.explode(true); sync(); return; }
      if (hit && tags[hit]) partDlg(tags[hit].k);
    } }).catch(e => { el.innerHTML = `<div class="gr-load tiny muted">3D indisponible (${esc(e.message || e)}) — tout le reste fonctionne.</div>`; });
  }
  function sync(){ const v = document.getElementById('gr3d'); if (v) v.dataset.exploded = explode ? 1 : 0; const h = document.getElementById('grHint'); if (h) h.textContent = explode ? 'Touche un composant pour son détail' : 'Glisse pour tourner · touche le vélo pour l\'éclater';
    const btn = document.querySelector('[data-gr="explode"]'); if (btn) { btn.textContent = explode ? 'Remonter' : 'Éclater'; btn.classList.toggle('primary', !explode); } }

  /* ---------- événements ---------- */
  const done = (msg, keepDlg) => { save(); if (!keepDlg && dlg.open) closeDlg(); render(); if (msg) toast(msg); };
  document.addEventListener('click', e => {
    const x = e.target.closest('[data-gr]'); if (!x) return; const a = x.dataset.gr, g = G(), b = cur();
    if (a === 'add') { const nb = newBike(x.dataset.m); if (g.bikes.length) { nb.rule = { out: false, ht: false, taf: true }; nb.name = x.dataset.m === 'road' ? 'Vélotaf' : nb.name; } g.bikes.push(nb); g.sel = nb.id; PROFILE_PANE = 'garage'; TAB = 'profile'; explode = false; done('Vélo ajouté au garage'); window.scrollTo(0, 0); return; }
    if (a === 'addask') return addAskDlg();
    if (a === 'sel') { g.sel = x.dataset.id; explode = false; save(); render(); return; }
    if (!b) return;
    if (a === 'explode') { explode = !explode; Bike3D.explode(explode); sync(); }
    else if (a === 'reset3d') Bike3D.resetView();
    else if (a === 'part') partDlg(x.dataset.k);
    else if (a === 'care') { const k = x.dataset.k; if (k === 'check') { partDlg('chain'); setTimeout(() => document.getElementById('grMeas')?.focus(), 50); return; }
      g.log.push({ id: rid(), bikeId: b.id, date: todayISO(), part: 'chain', kind: k, label: '', price: 0 }); done(k === 'lube' ? 'Chaîne lubrifiée 💧' : 'Transmission nettoyée 🧽'); }
    else if (a === 'measure') { const v = parseFloat(String(document.getElementById('grMeas')?.value || '').replace(',', '.')); if (!(v >= 0 && v <= 1.5)) return toast('Mesure entre 0 et 1,5 %');
      g.log.push({ id: rid(), bikeId: b.id, date: todayISO(), part: 'chain', kind: 'check', label: '', price: 0, value: v }); done(v >= 0.5 ? 'Chaîne à changer (≥ 0,5 %)' : 'Mesure enregistrée'); }
    else if (a === 'charge') { g.log.push({ id: rid(), bikeId: b.id, date: todayISO(), part: x.dataset.k, kind: 'charge', label: '', price: 0 }); done('Rechargé 🔋'); }
    else if (a === 'replace') { const d = document.getElementById('grRepD')?.value || todayISO(); setPart(b, x.dataset.k, d, document.getElementById('grRepS')?.value.trim(), document.getElementById('grRepP')?.value); done(`${P(x.dataset.k).l} : compteur remis à zéro`); }
    else if (a === 'life') { const v = +document.getElementById('grLife')?.value; if (!(v > 0)) return; b.parts ||= {}; b.parts[x.dataset.k] = { ...(b.parts[x.dataset.k] || {}), life: v }; save(); render(); partDlg(x.dataset.k); toast('Durée de vie mise à jour'); }
    else if (a === 'log') logDlg();
    else if (a === 'logopen') logDlg(x.dataset.id);
    else if (a === 'logsave') { const id = x.dataset.id, kind = $('#grLK').value, part = $('#grLP').value, date = $('#grLD').value || todayISO(), label = $('#grLL').value.trim(), price = +String($('#grLPr').value).replace(',', '.') || 0;
      if (id) { const en = g.log.find(y => y.id === id); Object.assign(en, { kind, part, date, label, price }); }
      else if (kind === 'replace' && part) setPart(b, part, date, label, price);
      else g.log.push({ id: rid(), bikeId: b.id, date, part, kind, label, price });
      if (id && kind === 'replace' && part) { b.parts ||= {}; b.parts[part] = { ...(b.parts[part] || {}), at: date, spec: label || b.parts[part]?.spec || '' }; }
      done('Enregistré'); }
    else if (a === 'logdel') { g.log = g.log.filter(y => y.id !== x.dataset.id); done('Supprimé'); }
    else if (a === 'main') { g.bikes = [b, ...g.bikes.filter(y => y !== b)]; done('Vélo principal'); }
    else if (a === 'del') { if (!confirm(`Supprimer « ${b.name} » et son journal ?`)) return; g.bikes = g.bikes.filter(y => y !== b); g.log = g.log.filter(y => y.bikeId !== b.id); for (const r in g.assign) if (g.assign[r] === b.id) delete g.assign[r]; g.sel = g.bikes[0]?.id; explode = false; done('Vélo supprimé'); }
  });
  const setPath = (o, p, v) => { const ks = p.split('.'); let t = o; for (const k of ks.slice(0, -1)) t = (t[k] ||= {}); t[ks[ks.length - 1]] = v; };
  document.addEventListener('change', e => {
    const t = e.target, b = cur(); if (!b) return;
    if (t.dataset.grassign != null) { const g = G(); if (t.value) g.assign[t.dataset.grassign] = t.value; else delete g.assign[t.dataset.grassign]; save(); render(); return; }
    if (t.dataset.grt) { const k = t.dataset.grt; b.tires ||= {}; b.tires[k] = t.type === 'checkbox' ? t.checked : t.type === 'number' ? (t.value === '' ? null : +t.value) : t.value; save(); render(); return; }
    if (t.dataset.grb) { const k = t.dataset.grb, v = t.type === 'checkbox' ? t.checked : t.type === 'number' ? Math.max(0, +t.value || 0) : t.value;
      if (k === 'name' && !String(v).trim()) return; if (k === 'since' && !v) return;
      if (k === 'model') { b.model = v; b.tires = { ...MODELS[v].tires, ...(b.tires || {}), f: MODELS[v].tires.f, r: MODELS[v].tires.r, internal: MODELS[v].tires.internal }; explode = false; }
      else setPath(b, k, k === 'name' ? String(v).trim() : v);
      save(); render(); }
  });
  return { tileHTML, pane, mount, rides, ridesOf, bikeIdOf, partInfo, allParts, stats, pressure, careInfo, CARE, MODELS, PARTS, newBike, get explode(){ return explode; } };
})();
