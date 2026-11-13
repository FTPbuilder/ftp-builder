"use strict";
// FTP Builder · Profil › GARAGE : carnet de vie des vélos — km route / home trainer, usure des composants, entretien, achats, pression, maquette 3D
/* ============ Garage ============
   S.garage = { bikes:[Bike], log:[Entrée], assign:{ ref → bikeId | 'none' }, cond:{ ref → 'dry'|'wet'|'rain' }, sel }
   - Bike = { id, name, brand, modelName, year, purchased, model (gabarit : 'aeroad-cfsl' | 'aeroad-cfr' | 'road'), variant:{ brakes, speeds, pm },
              since, km0:{ road, ht }, rule:{ out, ht, taf }, gearIds:[], trainer, tires:{…, maxF, maxR, rimMax, silca:{ f, r, date } }, parts:{ clé → { at, spec, life } },
              glb:{ id, name, size, rotY, map }, fit:{ date, src, title, v:{ clé → valeur }, file:{ id, name, type }, thumb } }
   - Entrée = { id, bikeId, date, part, kind, label, brand, ref, supplier, buyDate, price, value, cat, note }
       kind : replace (pose → compteur à zéro) · buy · charge (value = % lu) · inspect (value = état constaté %) · check (allongement chaîne %)
              lube · degrease · clean · jockey · wipe · service
   - aucune distance stockée : kilométrage et usure se recalculent à partir des sorties (S.activities + séances vélo Santé / Intervals).
     Une sortie va : 1) au vélo choisi à la main, 2) au vélo qui porte son vélo Strava / Intervals (gearId), 3) au premier vélo qui reçoit son type.
   - modèle 3D (.glb) et étude posturale (PDF / photo) : IndexedDB sur l'appareil + espace privé Supabase « garage-media » (dossier = id du compte). */
const Garage = (() => {
  const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const n0 = v => Math.round(v).toLocaleString('fr-FR');
  const f1 = v => (Math.round(v*10)/10).toString().replace('.', ',');
  const dfr = s => { const d = parseD(s); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
  const BACK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>`;

  /* ---------- catalogue (gabarits : composants d'origine, maquette, pneus) ---------- */
  const MODELS = {
    'aeroad-cfsl': { brand: 'Canyon', name: 'Aeroad CF SL Di2', kg: 7.6, di2: true, pm: false, speeds: 11, brakes: 'rim', tires: { f: 25, r: 25, internal: 17 },
      spec: { tireF: 'Continental Grand Prix 5000 · 25 mm', tireR: 'Continental Grand Prix 5000 · 25 mm', chain: 'Shimano Ultegra HG701 · 11 v', cassette: 'Shimano Ultegra R8000 · 11-28', rings: 'Shimano Ultegra R8000 · 52/36',
        fd: 'Shimano Ultegra Di2 FD-R8050', rd: 'Shimano Ultegra Di2 RD-R8050 SS', jockey: 'Galets RD-R8050', hubF: 'Moyeu DT Swiss (ARC 1400 DICUT)', hubR: 'Moyeu DT Swiss (ARC 1400 DICUT)', spokes: 'Rayons DT Swiss Aerolite',
        padsF: 'Patins Shimano Ultegra (jante carbone)', padsR: 'Patins Shimano Ultegra (jante carbone)', headset: 'Jeu de direction Aeroad', bb: 'Boîtier pédalier', seatpost: 'Canyon S27 Aero VCLS CF',
        cockpit: 'Canyon H36 Aerocockpit CF', tape: 'Guidoline', di2: 'Shimano BT-DN110 (dans la tige de selle)', sealant: 'Liquide préventif' } },
    'aeroad-cfr': { brand: 'Canyon', name: 'Aeroad CFR Di2', kg: 7.12, di2: true, pm: true, speeds: 12, brakes: 'disc', tires: { f: 26, r: 28, internal: 22 },
      spec: { tireF: 'Continental Aero 111 · 26 mm', tireR: 'Continental Grand Prix 5000 S TR · 28 mm', chain: 'Shimano XTR · 12 v', cassette: 'Shimano Dura-Ace CS-R9200 · 11-30', rings: 'Shimano Dura-Ace · 52/36',
        fd: 'Shimano Dura-Ace Di2 FD-R9250', rd: 'Shimano Dura-Ace Di2 RD-R9250', jockey: 'Galets RD-R9250', hubF: 'Moyeu DT Swiss 180 (ARC 1100 DICUT 55)', hubR: 'Moyeu DT Swiss 180 (ARC 1100 DICUT 55)', spokes: 'Rayons DT Swiss Aerolite',
        padsF: 'Plaquettes Dura-Ace (étrier BR-R9270)', padsR: 'Plaquettes Dura-Ace (étrier BR-R9270)', headset: 'Jeu de direction Aeroad', bb: 'Boîtier pédalier', seatpost: 'Canyon SP0105 Aero',
        cockpit: 'Canyon CP0048 PACE T-Bar', tape: 'Lizard Skins DSP V2 · 1,8 mm', di2: 'Shimano BT-DN300 (dans la tige de selle)', coin: 'Piles CR1632 des leviers ST-R9270', pm: 'Dura-Ace Powermeter · 165 mm', sealant: 'Liquide préventif' },
      life: { tireF: 3000 } },
    road: { brand: '', name: 'Vélo de route', kg: 8.5, di2: false, pm: false, speeds: 11, brakes: 'disc', tires: { f: 28, r: 28, internal: 21 }, spec: {} },
  };
  const CATS = { trans: 'Transmission', roues: 'Roues et pneus', cadre: 'Cadre et direction', frein: 'Freinage', elec: 'Électronique', produits: 'Produits (lubrifiant, nettoyage…)', autre: 'Autre' };
  // basis : road = km dehors · all = dehors + HT × ht · time = jours · charge = km (ou h) depuis la recharge · inspect = jours entre deux contrôles
  const PARTS = [
    { k: 'chain', l: 'Chaîne', cat: 'trans', g: 'chain', basis: 'all', ht: 1, life: 4000, tip: 'Remplace à 0,5 % d\'allongement (12 v) ou 0,75 % (11 v). Le home trainer l\'use autant que la route.' },
    { k: 'cassette', l: 'Cassette', cat: 'trans', g: 'cassette', basis: 'road', life: 12000, tip: 'Environ 3 chaînes par cassette si la chaîne est changée à temps. Un saut de chaîne neuve sur les petits pignons = cassette finie.' },
    { k: 'rings', l: 'Plateaux', cat: 'trans', g: 'crank', basis: 'all', ht: 1, life: 20000 },
    { k: 'fd', l: 'Dérailleur avant', cat: 'trans', g: 'fd', basis: 'inspect', life: 365, tip: 'Contrôle : butées, position au-dessus du grand plateau, réglage E-Tube.' },
    { k: 'rd', l: 'Dérailleur arrière', cat: 'trans', g: 'rd', basis: 'inspect', life: 365, tip: 'Contrôle : patte droite, jeu de la chape, indexation.' },
    { k: 'jockey', l: 'Galets de dérailleur', cat: 'trans', g: 'rd', basis: 'all', ht: 1, life: 10000, tip: 'Dents en pointe ou jeu latéral : à remplacer.' },
    { k: 'tireF', l: 'Pneu avant', cat: 'roues', g: 'tireF', basis: 'road', life: 4000, tip: 'Inspecte la bande de roulement (témoin, méplat), les coupures et les flancs.' },
    { k: 'tireR', l: 'Pneu arrière', cat: 'roues', g: 'tireR', basis: 'road', life: 3500, tip: 'L\'arrière s\'use ~1,5× plus vite ; méplat central = à changer.' },
    { k: 'hubF', l: 'Roulements de moyeu AV', cat: 'roues', g: 'wheelF', basis: 'road', life: 15000, tip: 'Roue en l\'air : elle doit tourner sans point dur ni jeu latéral.' },
    { k: 'hubR', l: 'Roulements de moyeu AR', cat: 'roues', g: 'wheelR', basis: 'road', life: 12000, tip: 'Corps de roue libre : nettoyage et graisse au remplacement de cassette.' },
    { k: 'sealant', l: 'Liquide préventif', cat: 'roues', g: 'tireR', basis: 'time', life: 120, only: b => b.tires?.setup === 'tubeless' },
    { k: 'headset', l: 'Roulements de direction', cat: 'cadre', g: 'headset', basis: 'all', ht: 1.5, life: 12000, tip: 'La sueur du home trainer coule sur la direction : elle compte 1,5× les km d\'intérieur.' },
    { k: 'bb', l: 'Boîtier de pédalier', cat: 'cadre', g: 'bb', basis: 'all', ht: 1, life: 15000, tip: 'Craquement ou point dur en tournant le pédalier à la main : à contrôler.' },
    { k: 'tape', l: 'Guidoline', cat: 'cadre', g: 'cockpit', basis: 'time', life: 365 },
    { k: 'padsF', l: 'Freins avant', cat: 'frein', g: 'calipers', basis: 'road', life: 3000, rimLife: 2500, tip: 'Rainures disparues ou < 0,5 mm (plaquettes) : à remplacer. Patins sur jante carbone : uniquement des patins carbone.' },
    { k: 'padsR', l: 'Freins arrière', cat: 'frein', g: 'calipers', basis: 'road', life: 2500, rimLife: 2000 },
    { k: 'di2', l: 'Batterie Di2', cat: 'elec', g: 'battery', basis: 'charge', life: 1500, unit: 'km', only: b => variant(b).group === 'di2', tip: 'Shimano annonce 1 000 à 2 000 km par charge. Le niveau réel se lit dans E-Tube ou sur l\'Edge : saisis-le avec sa date, il remplace l\'estimation.' },
    { k: 'axs', l: 'Batteries AXS (dérailleurs)', cat: 'elec', g: 'rd', basis: 'charge', life: 60, unit: 'h', only: b => variant(b).group === 'axs', tip: 'SRAM annonce une soixantaine d\'heures par charge ; garde la batterie de rechange chargée.' },
    { k: 'coin', l: 'Piles des leviers', lab: b => variant(b).group === 'axs' ? 'Piles des cocottes' : 'Piles des leviers', cat: 'elec', g: 'levers', basis: 'time', life: 540, only: b => variant(b).group === 'axs' || (variant(b).group === 'di2' && variant(b).speeds === 12), tip: 'Shimano sans fil : CR1632 (~1,5 à 2 ans). SRAM AXS : CR2032 dans chaque cocotte (~2 ans).' },
    { k: 'pm', l: 'Capteur de puissance', cat: 'elec', g: 'crank', basis: 'charge', life: 300, unit: 'h', only: b => variant(b).pm, tip: 'Environ 300 h par charge.' },
  ];
  const model = b => MODELS[b.model] || MODELS.road;
  const variant = b => ({ brakes: model(b).brakes, speeds: model(b).speeds, pm: model(b).pm, group: model(b).di2 ? 'di2' : 'meca', ...(b.variant || {}) });
  const P = k => PARTS.find(p => p.k === k);
  const partsOf = b => PARTS.filter(p => !p.only || p.only(b));
  const lifeOf = (b, p) => +b.parts?.[p.k]?.life || model(b).life?.[p.k] || (variant(b).brakes === 'rim' && p.rimLife) || p.life;
  const specOf = (b, k) => b.parts?.[k]?.spec || (k.startsWith('pads') && variant(b).brakes !== model(b).brakes ? (variant(b).brakes === 'rim' ? 'Patins de frein' : 'Plaquettes de frein') : model(b).spec[k]) || '';

  /* ---------- état et migration douce (v0.37 → v0.38) ---------- */
  function G(){
    const g = (S.garage ||= {}); g.bikes ||= []; g.log ||= []; g.assign ||= {}; g.cond ||= {};
    for (const b of g.bikes) {
      if (b.parts?.pads) { b.parts.padsF ||= { ...b.parts.pads }; b.parts.padsR ||= { ...b.parts.pads }; delete b.parts.pads; }
      b.brand ??= model(b).brand; b.modelName ??= model(b).name; b.gearIds ||= []; b.variant ||= {};
    }
    for (const e of g.log) if (e.part === 'pads') e.part = 'padsF';
    return g;
  }

  /* ---------- sorties vélo ---------- */
  function rides(){
    const out = [], seen = new Set();
    for (const a of S.activities || []) { if (!a.date) continue; const ht = isIndoor(a), min = (a.durationS || 0)/60; let km = +a.distanceKm || 0, est = false;
      if (!km && ht && min) { km = min/2; est = true; } // home trainer sans distance : 30 km/h
      const ref = 'a:' + a.id; if (seen.has(ref)) continue; seen.add(ref);
      out.push({ ref, date: a.date, ts: a.startTs || 0, km, est, ht, taf: isVelotaf(a), name: a.name || 'Vélo', min, src: a.source || 'fit', gear: a.gearId || null, gearName: a.gearName || null }); }
    try { for (const e of Health.extraWorkouts()) if (e.sport === 'bike') { const w = e.w, ht = Health.bikeIndoor(w), min = +w.duration_min || 0; let km = +w.distance_km || 0, est = false;
      if (!km && ht && min) { km = min/2; est = true; }
      const ref = 'w:' + w.start_at; if (seen.has(ref)) continue; seen.add(ref);
      out.push({ ref, date: e.date, ts: Math.floor(Date.parse(w.start_at)/1000), km, est, ht, taf: isVelotafW(w), name: w.type || 'Vélo', min, src: w.source || 'Santé', gear: null }); } } catch (e) {}
    return out.sort((x, y) => (y.date.localeCompare(x.date)) || (y.ts - x.ts));
  }
  const kindOf = r => r.ht ? 'ht' : r.taf ? 'taf' : 'out';
  function bikeIdOf(r){
    const g = G(), o = g.assign[r.ref];
    if (o) return o === 'none' || !g.bikes.some(b => b.id === o) ? null : o;
    if (r.gear) { const b = g.bikes.find(b => b.gearIds?.includes(r.gear)); if (b) return b.id; if (g.bikes.some(b => b.gearIds?.length)) { const free = g.bikes.find(b => !b.gearIds?.length && r.date >= (b.since || '0000') && b.rule?.[kindOf(r)]); return free ? free.id : null; } }
    const b = g.bikes.find(b => r.date >= (b.since || '0000') && b.rule?.[kindOf(r)]);
    return b ? b.id : null;
  }
  const ridesOf = (b, all = rides()) => all.filter(r => bikeIdOf(r) === b.id);
  const odo = (b, date, rs = ridesOf(b)) => (+b.km0?.road || 0) + (+b.km0?.ht || 0) + rs.filter(r => r.date < date).reduce((s, r) => s + r.km, 0);

  /* ---------- usure : estimation, inspection, mesure, lecture ---------- */
  const daysSince = d => Math.max(0, diffDays(d, todayISO()));
  const logOf = (b, f) => G().log.filter(e => e.bikeId === b.id && f(e)).sort((x, y) => y.date.localeCompare(x.date) || (y.ts || 0) - (x.ts || 0));
  function used(b, p, from, rs, withKm0){
    if (p.basis === 'time' || p.basis === 'inspect') return daysSince(from);
    const rr = rs.filter(r => r.date >= from);
    if (p.basis === 'charge') return p.unit === 'h' ? rr.reduce((s, r) => s + r.min, 0)/60 : rr.reduce((s, r) => s + r.km, 0);
    const htF = p.basis === 'road' ? ((p.k === 'cassette' || p.k === 'hubR') && b.trainer === 'wheel' ? 1 : 0) : (p.ht ?? 1);
    let u = rr.reduce((s, r) => s + r.km*(r.ht ? htF : 1), 0); if (withKm0) u += (+b.km0?.road || 0) + (+b.km0?.ht || 0)*htF; return u;
  }
  function dailyRate(b, p, rs){ // usage moyen par jour sur 8 semaines (pour dater la prochaine intervention)
    if (p.basis === 'time' || p.basis === 'inspect') return 1; const from = addDays(todayISO(), -56); return used(b, p, from, rs, false)/56; }
  function partInfo(b, k, rs = ridesOf(b)){
    const p = P(k), st = b.parts?.[k] || {}, at = st.at || b.since, orig = !st.at, life = lifeOf(b, p);
    const unit = p.basis === 'time' || p.basis === 'inspect' ? 'j' : p.basis === 'charge' ? p.unit : 'km';
    // repère le plus récent après la pose : inspection (état constaté), mesure de chaîne, lecture / recharge de batterie
    const after = e => e.date > at || (e.date === at && (e.ts || 0) > (st.atTs || 0)); // après la pose (même jour : enregistré après)
    const anchor = logOf(b, e => e.part === k && (orig ? e.date >= at : after(e)) && (e.kind === 'inspect' || (e.kind === 'check' && k === 'chain') || (e.kind === 'charge' && p.basis === 'charge') || (e.kind === 'service' && p.basis === 'inspect')))[0];
    let rem, src = 'estimation', from = at, u;
    if (anchor) { from = anchor.date; u = used(b, p, from, rs, false);
      const v0 = anchor.kind === 'check' ? clamp(1 - (+anchor.value || 0)/(variant(b).speeds === 12 ? .5 : .75), 0, 1) : anchor.kind === 'service' ? 1 : (anchor.value != null && anchor.value !== '' ? +anchor.value/100 : 1);
      rem = v0 - u/life; src = anchor.kind === 'check' ? 'mesure' : anchor.kind === 'inspect' ? 'inspection' : anchor.kind === 'service' ? 'contrôle' : (anchor.value != null && anchor.value !== '' ? 'lecture' : 'recharge'); }
    else { u = used(b, p, at, rs, orig); rem = 1 - u/life; }
    rem = clamp(rem, 0, 1);
    const total = p.basis === 'charge' || p.basis === 'time' || p.basis === 'inspect' ? null : used(b, p, at, rs, orig); // km depuis la pose
    const left = rem*life, rate = dailyRate(b, p, rs), inDays = rate > 0 ? Math.round(left/rate) : null;
    const nextDate = unit === 'j' ? addDays(todayISO(), Math.round(left)) : inDays != null && inDays < 3650 ? addDays(todayISO(), inDays) : null;
    const last = logOf(b, e => e.part === k)[0] || null;
    return { k, l: p.lab ? p.lab(b) : p.l, cat: p.cat, g: p.g, spec: specOf(b, k), at, orig, life, unit, used: u, total, rem, wear: 1 - rem, src, from, left, nextDate, last, charge: p.basis === 'charge', inspect: p.basis === 'inspect', basis: p.basis };
  }
  const allParts = (b, rs = ridesOf(b)) => partsOf(b).map(p => partInfo(b, p.k, rs));
  const col = rem => rem >= .6 ? 'var(--ok)' : rem >= .35 ? 'var(--warn)' : 'var(--bad)';
  const pct = v => Math.round(v*100) + ' %';
  const SRC = { estimation: 'estimé', inspection: 'inspecté', mesure: 'mesuré', lecture: 'niveau lu', recharge: 'depuis recharge', 'contrôle': 'contrôlé' };
  const leftTxt = i => i.unit === 'j' ? (i.inspect ? `contrôle ${i.nextDate ? 'le ' + fmtShort(i.nextDate) : ''}` : `encore ~${n0(i.left)} j`) : i.unit === 'h' ? `~${n0(i.left)} h` : `~${n0(i.left)} km`;
  const barHTML = (rem, charge) => `<span class="gr-bar${charge ? ' bat' : ''}" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(rem*100)}"><i style="width:${Math.max(3, rem*100)}%;background:${col(rem)}"></i></span>`;

  function stats(b, rs = ridesOf(b)){
    const m = todayISO().slice(0, 7), road = rs.filter(r => !r.ht).reduce((s, r) => s + r.km, 0) + (+b.km0?.road || 0), ht = rs.filter(r => r.ht).reduce((s, r) => s + r.km, 0) + (+b.km0?.ht || 0);
    const month = rs.filter(r => r.date.startsWith(m)).reduce((s, r) => s + r.km, 0);
    return { road, ht, total: road + ht, month, n: rs.length, last: rs[0] || null, est: rs.some(r => r.est) };
  }

  /* ---------- assistant d'entretien (conditions sec / humide / pluie / home trainer) ---------- */
  const COND = { dry: ['☀️', 'Sec'], wet: ['💧', 'Humide'], rain: ['🌧️', 'Pluie'] };
  const condOf = r => r.ht ? 'ht' : G().cond[r.ref] || 'dry';
  const CARE = [
    { k: 'lube', l: 'Lubrifier la chaîne', km: 300, w: { dry: 1, wet: 2, rain: 4, ht: .5 }, rainNow: true, how: 'Chaîne propre et sèche : une goutte par rouleau côté intérieur, tourne 30 s, laisse pénétrer quelques minutes puis essuie l\'excédent. Après la pluie : le jour même (sèche-la d\'abord).' },
    { k: 'degrease', l: 'Dégraisser la chaîne', km: 1000, w: { dry: 1, wet: 1.5, rain: 2.5, ht: .4 }, how: 'Dégraissant (ou bac) sur la chaîne, brosse, rinçage, séchage complet, puis lubrification. Ne jamais lubrifier une chaîne encrassée.' },
    { k: 'clean', l: 'Nettoyer cassette, plateaux et galets', km: 2000, days: 90, w: { dry: 1, wet: 1.5, rain: 2.5, ht: .3 }, how: 'Cassette démontée ou brosse entre les pignons, plateaux et galets au dégraissant, rinçage à l\'eau douce (pas de jet haute pression sur les roulements), séchage.' },
    { k: 'check', l: 'Mesurer l\'allongement de la chaîne', km: 1000, w: { dry: 1, wet: 1, rain: 1, ht: 1 }, how: 'Jauge 0,5 % (12 v) / 0,75 % (11 v). Saisis la mesure : elle remplace l\'estimation de la chaîne.' },
    { k: 'jockey', l: 'Inspecter les galets', km: 3000, w: { dry: 1, wet: 1.3, rain: 1.6, ht: 1 }, how: 'Dents pointues, jeu latéral, bruit : nettoyage ou remplacement.' },
    { k: 'wipe', l: 'Essuyer la sueur après le home trainer', sessions: 4, how: 'Sueur = corrosion : essuie direction, cintre, tige de selle et boîtier, housse anti-sueur sur le cadre.' },
  ];
  function careInfo(b, c, rs = ridesOf(b)){
    const e = logOf(b, x => x.kind === c.k)[0], from = e ? e.date : b.since, rr = rs.filter(r => e ? r.date > from : r.date >= from);
    if (c.sessions) { const n = rr.filter(r => r.ht).length, ratio = n/c.sessions; return { ...c, from, done: !!e, n, km: 0, d: daysSince(from), ratio, show: rs.some(r => r.ht), due: ratio >= 1 }; }
    const km = rr.reduce((s, r) => s + r.km*(c.w[condOf(r)] ?? 1), 0), d = daysSince(from), rain = c.rainNow && rr.some(r => condOf(r) === 'rain');
    const ratio = Math.max(km/c.km, c.days ? d/c.days : 0, rain ? 1 : 0);
    return { ...c, from, done: !!e, km, d, ratio, rain, show: true, due: ratio >= 1 };
  }
  const careAll = (b, rs) => CARE.map(c => careInfo(b, c, rs)).filter(c => c.show);

  /* ---------- pression des pneus ----------
     Estimation FTP Builder (pas une valeur SILCA) : 15 % d'écrasement du pneu (courbes de Frank Berto) selon la charge par roue et la largeur réelle,
     corrigé par l'état de la route (principe d'impédance de surface publié par SILCA), le montage et la vitesse ; plafonnée par les limites du pneu et de la jante.
     Les valeurs SILCA officielles s'obtiennent sur leur calculateur et se saisissent à côté. */
  const SURF = { new: ['Neuf, très lisse', .92], worn: ['Usé, quelques fissures', .85], poor: ['Dégradé, gravillons', .77], cobble: ['Pavés, chemins', .66] };
  const SETUP = { tube: ['Chambre butyl', 1], latex: ['Chambre latex', .97], tubeless: ['Tubeless', .95] };
  const WET = { dry: ['Sec', 1], wet: ['Mouillé', .94] };
  function pressure(b){
    const M = model(b), t = { ...M.tires, surface: 'worn', setup: 'tube', wet: 'dry', ...(b.tires || {}) }, kg = (+S.profile?.weightKg || 75) + (+t.bikeKg || M.kg) + 1.5;
    const v = +t.speed || avgSpeed(b) || 30, sp = clamp(1 + (v - 30)*.004, .95, 1.06), sf = SURF[t.surface]?.[1] || .85, tf = SETUP[t.setup]?.[1] || 1, wf = WET[t.wet]?.[1] || 1;
    const fShare = clamp((+t.front || 47)/100, .35, .6);
    const meas = w => +t.measured || (+w + Math.max(0, (+t.internal || 19) - 19)*.5); // une jante large ouvre le pneu : ~ +0,5 mm par mm au-delà de 19
    const one = (w, share, mw) => { const lb = kg*share*2.2046, psi = 80*(lb/100)*Math.pow(28/mw, 1.845)*sf*tf*sp*wf; return { mw, psi }; };
    const caps = [t.hookless ? 5 : null, +t.rimMax || null].filter(Boolean), capF = Math.min(...caps, +t.maxF || 99, 99), capR = Math.min(...caps, +t.maxR || 99, 99);
    const out = (x, cap) => { let bar = x.psi/14.5038, capped = bar > cap; bar = Math.max(2.7, Math.min(cap, bar)); return { bar: Math.round(bar*10)/10, psi: Math.round(bar*14.5038), mw: x.mw, capped }; };
    return { t, kg, v, fShare, f: out(one(t.f, fShare, +t.measuredF || meas(t.f)), capF), r: out(one(t.r, 1 - fShare, +t.measuredR || meas(t.r)), capR) };
  }
  function avgSpeed(b){ const out = ridesOf(b).filter(r => !r.ht && !r.taf && r.km > 20 && r.min > 30).slice(0, 10); if (!out.length) return null;
    return Math.round(out.reduce((s, r) => s + r.km, 0)/out.reduce((s, r) => s + r.min/60, 0)); }

  /* ---------- médias : modèle 3D (.glb), étude posturale, appareil + espace privé ---------- */
  const Media = (() => {
    const BUCKET = 'garage-media'; let dbp = null;
    const db = () => dbp ||= new Promise((res, rej) => { const r = indexedDB.open('ftpb-garage', 1); r.onupgradeneeded = () => r.result.createObjectStore('m'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const tx = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('m', mode), q = fn(t.objectStore('m')); t.oncomplete = () => res(q?.result); t.onerror = () => rej(t.error); }); };
    const path = id => `${Cloud.user?.id}/${id}`;
    async function put(id, blob){ await tx('readwrite', s => s.put(blob, id)); try { if (Cloud.sb && Cloud.user) { const { error } = await Cloud.sb.storage.from(BUCKET).upload(path(id), blob, { upsert: true, contentType: blob.type || 'application/octet-stream' }); if (error) throw error; return true; } } catch (e) { console.warn('garage média', e); } return false; }
    async function get(id){ let b = await tx('readonly', s => s.get(id)).catch(() => null);
      if (!b && Cloud.sb && Cloud.user) { try { const { data } = await Cloud.sb.storage.from(BUCKET).download(path(id)); if (data) { b = data; tx('readwrite', s => s.put(b, id)).catch(() => {}); } } catch (e) { console.warn('garage média', e); } }
      return b || null; }
    async function del(id){ await tx('readwrite', s => s.delete(id)).catch(() => {}); try { if (Cloud.sb && Cloud.user) await Cloud.sb.storage.from(BUCKET).remove([path(id)]); } catch (e) {} }
    return { put, get, del, wipe: () => { try { indexedDB.deleteDatabase('ftpb-garage'); } catch (e) {} dbp = null; } };
  })();

  /* ---------- vélos ---------- */
  function newBike(m = 'aeroad-cfsl'){
    const first = rides().filter(r => !r.taf).map(r => r.date).sort()[0] || todayISO(), M = MODELS[m] || MODELS.road;
    return { id: rid(), name: m === 'road' ? M.name : 'Vélo de tri', brand: M.brand, modelName: M.name, year: null, purchased: null, model: m, variant: {}, since: first, km0: { road: 0, ht: 0 },
      rule: { out: true, ht: true, taf: false }, gearIds: [], trainer: 'direct', tires: { ...M.tires, setup: 'tube', surface: 'worn', hookless: false }, parts: {}, added: todayISO() };
  }
  const cur = () => { const g = G(); return g.bikes.find(b => b.id === g.sel) || g.bikes[0] || null; };
  let mode = 'view', tab = 'parts', spendP = '365', sheetKey = null, allTags = false, zoneK = null;
  // zones du vélo : un toucher sur la maquette montée rapproche la caméra de la zone et en détaille les pièces
  const ZONES = { trans: ['Transmission', ['chain', 'cassette', 'crank', 'rd', 'fd', 'bb']], rear: ['Roue arrière', ['wheelR', 'tireR', 'cassette']], front: ['Roue avant', ['wheelF', 'tireF', 'fork']],
    cockpit: ['Poste de pilotage', ['cockpit', 'levers', 'headset']], seat: ['Selle et batterie', ['saddle', 'seatpost', 'battery']], brakes: ['Freins', ['calipers', 'rotors']], frame: ['Cadre', ['frame', 'headset', 'bb', 'fork']] };
  const zoneOfG = g => g === 'frame' ? 'frame' : Object.keys(ZONES).find(z => ZONES[z][1].includes(g)) || 'frame';
  const explode = () => mode === 'explode';

  // synthèse : état général, composants à surveiller, prochaine opération
  function summary(b, rs = ridesOf(b)){
    const parts = allParts(b, rs), care = careAll(b, rs), worst = parts.slice().sort((x, y) => x.rem - y.rem)[0];
    const att = parts.filter(i => i.rem < .6).length + care.filter(c => c.due).length;
    const state = !worst || worst.rem >= .6 ? ['Bon état', 'var(--ok)'] : worst.rem >= .35 ? ['À surveiller', 'var(--warn)'] : ['Intervention à prévoir', 'var(--bad)'];
    const dueCare = care.filter(c => c.ratio >= .75).sort((x, y) => y.ratio - x.ratio)[0];
    const soonPart = parts.filter(i => !i.charge).sort((x, y) => (x.nextDate || '9999').localeCompare(y.nextDate || '9999') || x.rem - y.rem)[0];
    let next = null;
    if (dueCare && (dueCare.due || !soonPart || soonPart.rem > .35)) next = { l: dueCare.l, txt: dueCare.due ? (dueCare.rain ? 'après la pluie' : 'à faire') : 'bientôt', col: dueCare.due ? 'var(--bad)' : 'var(--warn)', care: dueCare.k };
    else if (soonPart) next = { l: soonPart.inspect ? `Contrôler : ${soonPart.l.toLowerCase()}` : soonPart.l, txt: soonPart.nextDate ? `vers le ${fmtShort(soonPart.nextDate)}` : leftTxt(soonPart), col: col(soonPart.rem), part: soonPart.k };
    return { parts, care, worst, att, state, next };
  }

  /* ---------- Profil : tuile GARAGE ---------- */
  function tileHTML(){
    const b = cur(); if (!b) return `<button type="button" class="card gr-tile" data-pp="garage"><span class="gr-tl">Garage</span><span class="tiny muted" style="flex:1;text-align:left">Le carnet de vie de ton vélo : km route et home trainer, usure, entretien, 3D</span><span class="muted" aria-hidden="true">›</span></button>`;
    const rs = ridesOf(b), s = stats(b, rs), sm = summary(b, rs);
    return `<button type="button" class="card gr-tile" data-pp="garage"><span class="gr-tl">Garage</span><span style="flex:1;min-width:0;text-align:left"><b>${esc(b.name)}</b><span class="tiny muted" style="display:block">${esc([b.brand, b.modelName].filter(Boolean).join(' '))} · ${n0(s.total)} km</span>
      <span class="tiny" style="display:flex;gap:6px;align-items:center;margin-top:4px"><i class="gr-dot" style="background:${sm.state[1]}"></i><span>${sm.state[0]}${sm.att ? ` · ${sm.att} à surveiller` : ''}</span></span></span><span class="muted" aria-hidden="true">›</span></button>`;
  }

  /* ---------- volet GARAGE ---------- */
  const head = t => `<div class="pane-head"><button class="pane-back" data-pp="back" aria-label="Retour">${BACK}</button><h2>${t}</h2></div>`;
  const TABS = [['parts', 'Composants'], ['care', 'Entretien'], ['fit', 'Position'], ['buy', 'Achats'], ['pressure', 'Pression'], ['rides', 'Sorties'], ['bike', 'Vélo']];
  function pane(){
    const g = G(), b = cur();
    if (!b) return `<div class="pane-in gr">${head('Garage')}<div class="gr-empty"><div class="gr-tl" style="font-size:44px">Garage</div><p class="small muted">Le carnet de vie de ton vélo. Le kilométrage se calcule tout seul à partir de tes sorties (dehors et home trainer, le vélotaf à part) et chaque composant affiche son état estimé.</p>
      <div class="gr-pick">${['aeroad-cfsl', 'aeroad-cfr', 'road'].map(m => `<button class="btn${m === 'aeroad-cfsl' ? ' primary' : ''}" data-gr="add" data-m="${m}">+ ${esc([MODELS[m].brand, MODELS[m].name].filter(Boolean).join(' '))}</button>`).join('')}</div></div></div>`;
    const rs = ridesOf(b), s = stats(b, rs), sm = summary(b, rs), M = model(b), glb = !!b.glb;
    const split = s.total ? s.road/s.total : 1;
    let h = `<div class="pane-in gr">${head('Garage')}<div class="seg gr-bikes">${g.bikes.map(x => `<button type="button" class="${x.id === b.id ? 'on' : ''}" data-gr="sel" data-id="${x.id}">${esc(x.name)}</button>`).join('')}<button type="button" data-gr="addask" aria-label="Ajouter un vélo">+</button></div>
      <section class="gr-stage" data-mode="${mode}">
        <div class="gr-hud"><div><div class="gr-name">${esc(b.name)}</div><div class="tiny muted">${esc([b.brand, b.modelName, b.year].filter(Boolean).join(' · '))}</div></div>
          <div class="gr-odo"><b class="num">${n0(s.total)}</b><small>km</small><span class="gr-split" title="Route ${n0(s.road)} km · Home trainer ${n0(s.ht)} km"><i style="width:${split*100}%"></i></span><span class="tiny muted">${n0(s.road)} route · ${n0(s.ht)} HT</span></div></div>
        <div class="gr-view" id="gr3d" data-exploded="${explode() ? 1 : 0}"><div class="gr-load tiny muted">Préparation du studio 3D…</div></div>
        <div class="gr-ctl"><div class="seg gr-modes" role="tablist">${[['view', 'Vue'], ['explode', 'Éclaté']].map(([k, l]) => `<button type="button" role="tab" class="${mode === k ? 'on' : ''}" data-gr="mode" data-v="${k}">${l}</button>`).join('')}</div>
          <button class="btn sm ghost${allTags ? ' on' : ''}" data-gr="labels" aria-pressed="${allTags}" title="Toutes les étiquettes" ${mode === 'explode' ? '' : 'hidden'}>Aa</button><button class="btn sm ghost" data-gr="zoom" data-v="out" aria-label="Zoom arrière">−</button><button class="btn sm ghost" data-gr="zoom" data-v="in" aria-label="Zoom avant">+</button><button class="btn sm ghost" data-gr="reset3d" aria-label="Revenir à la vue initiale">⟲</button></div>
        <div class="gr-hint tiny muted" id="grHint">${hint()}</div><div id="grZone">${zoneHTML(b, sm)}</div>
        <div class="gr-status"><button type="button" class="gr-chip" data-gr="tab" data-v="parts"><i class="gr-dot" style="background:${sm.state[1]}"></i>${sm.state[0]}</button>
          <button type="button" class="gr-chip" data-gr="tab" data-v="parts"><b>${sm.att}</b> à surveiller</button>
          ${sm.next ? `<button type="button" class="gr-chip gr-next" data-gr="${sm.next.care ? 'tab' : 'part'}" data-v="care" data-k="${sm.next.part || ''}"><span class="muted">Prochaine</span> <b>${esc(sm.next.l)}</b> <span style="color:${sm.next.col}">${esc(sm.next.txt)}</span></button>` : ''}</div>
        <div class="gr-fid tiny">${glb ? `🧩 Ton modèle 3D « ${esc(b.glb.name)} »` : '◇ Maquette générique : géométrie et implantation fidèles, formes simplifiées, sans marquages — importe ton modèle 3D dans l\'onglet Vélo'}</div>
      </section>
      <div class="seg gr-tabs" role="tablist">${TABS.map(([k, l]) => `<button type="button" role="tab" class="${tab === k ? 'on' : ''}" data-gr="tab" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="gr-panel">${({ parts: partsTab, care: careTab, fit: fitTab, buy: buyTab, pressure: pressTab, rides: ridesTab, bike: bikeTab })[tab](b, rs, s, sm)}</div></div>`;
    return h;
  }
  const hint = () => mode === 'explode' ? 'Touche un composant pour sa fiche · pince pour zoomer · deux doigts pour déplacer' : zoneK ? 'Touche une pièce pour sa fiche · tourne, pince, déplace librement' : 'Glisse pour tourner (haut, bas, côtés) · touche une zone du vélo pour voir ses pièces';
  function zoneHTML(b, sm){
    if (!zoneK || mode === 'explode') return '';
    const [lab, gs] = ZONES[zoneK], ps = sm.parts.filter(i => gs.includes(i.g)).sort((x, y) => x.rem - y.rem);
    return `<div class="gr-zone"><div class="row between"><b class="gr-zt">${lab}</b><button class="btn sm ghost" data-gr="zoneoff">Tout le vélo</button></div>
      ${ps.length ? ps.map(i => `<button type="button" class="gr-zp" data-gr="part" data-k="${i.k}"><span>${esc(i.l)}</span>${barHTML(i.rem, i.charge)}<b style="color:${col(i.rem)}">${pct(i.rem)}</b></button>`).join('') : '<p class="tiny muted" style="margin:4px 0 0">Pas de pièce d\'usure suivie dans cette zone.</p>'}
      <div class="gr-zs">${Object.entries(ZONES).map(([k, [l]]) => `<button type="button" class="${k === zoneK ? 'on' : ''}" data-gr="zone" data-v="${k}">${l}</button>`).join('')}</div></div>`;
  }

  /* --- onglet Composants --- */
  function partsTab(b, rs, s, sm){
    const by = {}; for (const i of sm.parts) (by[i.cat] ||= []).push(i);
    return Object.entries(CATS).filter(([c]) => by[c]).map(([c, l]) => `<div class="gr-sec"><h3>${l}</h3>${by[c].map(i => `<button type="button" class="gr-part" data-gr="part" data-k="${i.k}"><span class="gr-pl"><b>${esc(i.l)}</b><span class="tiny muted">${i.total != null ? n0(i.total) + ' km · ' : ''}${leftTxt(i)} · <span class="gr-src">${SRC[i.src]}</span></span></span>${barHTML(i.rem, i.charge)}<b class="gr-pv" style="color:${col(i.rem)}">${pct(i.rem)}</b></button>`).join('')}</div>`).join('')
      + `<p class="tiny muted gr-note">« estimé » = calcul à partir des km et du temps, pas une mesure. Une inspection, une mesure de chaîne ou un niveau de batterie lu remplacent l'estimation à leur date. Seuils réglables dans chaque fiche.</p>`;
  }
  /* --- onglet Entretien --- */
  function careTab(b, rs){
    const care = careAll(b, rs).sort((x, y) => y.ratio - x.ratio), wetN = rs.filter(r => !r.ht && condOf(r) !== 'dry').length;
    return `<div class="gr-sec">${care.map(c => { const stc = c.ratio >= 1 ? ['À faire', 'var(--bad)'] : c.ratio >= .75 ? ['Bientôt', 'var(--warn)'] : ['OK', 'var(--ok)'];
      const det = c.sessions ? `${c.n} séance${c.n > 1 ? 's' : ''} HT depuis — tous les ${c.sessions}` : `${n0(c.km)} km pondérés${c.days ? ` · ${c.d} j` : ''} depuis — tous les ${n0(c.km0 || CARE.find(x => x.k === c.k).km)} km${c.days ? ` ou ${c.days} j` : ''}${c.rain ? ' · <b style="color:var(--bad)">sortie sous la pluie</b>' : ''}`;
      return `<div class="gr-care"><div class="row between" style="gap:8px;flex-wrap:nowrap"><span style="min-width:0"><b>${esc(c.l)}</b><span class="tiny muted" style="display:block">${c.done ? `fait le ${fmtShort(c.from)} · ` : ''}${det}</span></span>
        <span class="gr-st" style="color:${stc[1]}">${stc[0]}</span><button class="btn sm" data-gr="care" data-k="${c.k}">${c.k === 'check' ? 'Mesurer' : 'Fait'}</button></div><details class="tiny muted"><summary>Comment faire</summary>${esc(c.how)}</details></div>`; }).join('')}</div>
      <p class="tiny muted gr-note">Pondération : sortie humide ×2 et pluie ×4 pour la lubrification (une sortie sous la pluie la rend nécessaire tout de suite), home trainer ×0,5. Indique la météo de tes sorties dans l'onglet Sorties${wetN ? ` (${wetN} sortie${wetN > 1 ? 's' : ''} mouillée${wetN > 1 ? 's' : ''} notée${wetN > 1 ? 's' : ''})` : ''}.</p>`;
  }
  /* --- onglet Achats --- */
  const catOf = e => e.cat || P(e.part)?.cat || (['lube', 'degrease', 'clean'].includes(e.kind) ? 'produits' : 'autre');
  function buyTab(b, rs){
    const from = spendP === 'all' ? '0000' : addDays(todayISO(), -(+spendP)), log = logOf(b, () => true), inP = log.filter(e => e.date >= from && +e.price > 0), tot = inP.reduce((s, e) => s + +e.price, 0);
    const byC = {}; for (const e of inP) byC[catOf(e)] = (byC[catOf(e)] || 0) + +e.price; const mx = Math.max(1, ...Object.values(byC));
    const km = stats(b, rs).total;
    return `<div class="gr-sec"><div class="row between"><div class="seg gr-per">${[['30', '30 j'], ['365', '12 mois'], ['all', 'Tout']].map(([k, l]) => `<button type="button" class="${spendP === k ? 'on' : ''}" data-gr="per" data-v="${k}">${l}</button>`).join('')}</div><button class="btn sm primary" data-gr="log">+ Ajouter</button></div>
      <div class="gr-spend"><b class="num">${n0(tot)} €</b><span class="tiny muted">${spendP === 'all' && km > 100 ? `soit ${f1(tot/km*100)} € / 100 km` : 'sur la période'}</span></div>
      ${Object.entries(byC).sort((x, y) => y[1] - x[1]).map(([c, v]) => `<div class="gr-cat"><span>${CATS[c]}</span><span class="gr-cb"><i style="width:${v/mx*100}%"></i></span><b class="num">${n0(v)} €</b></div>`).join('')}</div>
      <div class="gr-sec"><h3>Historique</h3>${log.length ? log.slice(0, 60).map(e => `<button type="button" class="gr-le" data-gr="logopen" data-id="${e.id}"><span>${KIND[e.kind]?.[0] || '•'}</span><span style="flex:1;min-width:0"><b>${esc(e.label || P(e.part)?.l || KIND[e.kind]?.[1] || '')}</b><span class="tiny muted" style="display:block">${fmtShort(e.date)} · ${KIND[e.kind]?.[1] || ''}${e.part && P(e.part) && e.label ? ' · ' + esc(P(e.part).l) : ''}${e.supplier ? ' · ' + esc(e.supplier) : ''}${e.value != null && e.value !== '' ? ` · ${f1(+e.value)} %` : ''}${e.kind === 'replace' ? ` · pose à ${n0(odo(b, e.date, rs))} km` : ''}</span></span>${+e.price ? `<b class="num">${n0(e.price)} €</b>` : ''}</button>`).join('') : '<p class="small muted">Chaînes, pneus, patins, lubrifiant, produits de nettoyage, révisions : tout s\'enregistre ici avec le prix, pour connaître le coût d\'usage du vélo.</p>'}</div>`;
  }
  /* --- onglet Pression --- */
  function pressTab(b){
    const pr = pressure(b), t = pr.t, opt = (o, v) => Object.entries(o).map(([k, [l]]) => `<option value="${k}"${k === v ? ' selected' : ''}>${l}</option>`).join(''), sv = t.silca || {};
    const num = (k, l, v, ph = '', step = 1) => `<div><label class="f">${l}</label><input type="number" inputmode="decimal" step="${step}" data-grt="${k}" value="${v ?? ''}" placeholder="${ph}"></div>`;
    return `<div class="gr-sec"><div class="gr-prout"><div><small>Avant</small><b class="num">${f1(pr.f.bar)}</b> bar<span class="tiny muted">${pr.f.psi} psi</span></div><div><small>Arrière</small><b class="num">${f1(pr.r.bar)}</b> bar<span class="tiny muted">${pr.r.psi} psi</span></div></div>
      <p class="tiny muted" style="margin:2px 0 8px">Estimation FTP Builder — pas une valeur SILCA. ${pr.f.capped || pr.r.capped ? '<b style="color:var(--warn)">Plafonnée par la pression maxi du pneu ou de la jante.</b>' : ''}</p>
      <div class="gr-silca"><div class="row between"><b>Valeurs SILCA officielles</b><a class="btn sm primary" href="https://silca.cc/pages/pro-tire-pressure-calculator" target="_blank" rel="noopener">Ouvrir SILCA ↗</a></div>
        <p class="tiny muted" style="margin:4px 0 6px">À reporter dans leur calculateur : poids total ${Math.round(pr.kg)} kg · pneus ${t.f} / ${t.r} mm (mesurés ≈ ${f1(pr.f.mw)} / ${f1(pr.r.mw)} mm) · 700c · ${SETUP[t.setup][0].toLowerCase()} · ${SURF[t.surface][0].toLowerCase()} · ${pr.v} km/h · ${Math.round(pr.fShare*100)} / ${100 - Math.round(pr.fShare*100)}.</p>
        <div class="gr-grid">${num('silca.f', 'SILCA avant (bar)', sv.f, '—', .05)}${num('silca.r', 'SILCA arrière (bar)', sv.r, '—', .05)}</div>${sv.f || sv.r ? `<p class="tiny muted" style="margin:4px 0 0">Saisies le ${fmtShort(sv.date || todayISO())}${sv.f && Math.abs(sv.f - pr.f.bar) > .4 ? ' · écart notable avec l\'estimation : garde la valeur SILCA' : ''}.</p>` : ''}</div>
      <div class="gr-grid"><div><label class="f">Route</label><select data-grt="surface">${opt(SURF, t.surface)}</select></div><div><label class="f">Conditions</label><select data-grt="wet">${opt(WET, t.wet)}</select></div>
        <div><label class="f">Montage</label><select data-grt="setup">${opt(SETUP, t.setup)}</select></div>${num('front', 'Poids sur l\'avant (%)', t.front, '47')}
        ${num('f', 'Pneu avant (mm, gravé)', t.f)}${num('r', 'Pneu arrière (mm, gravé)', t.r)}${num('measuredF', 'Largeur mesurée AV (mm)', t.measuredF, f1(pr.f.mw), .1)}${num('measuredR', 'Largeur mesurée AR (mm)', t.measuredR, f1(pr.r.mw), .1)}
        ${num('internal', 'Largeur interne jante (mm)', t.internal)}${num('speed', 'Vitesse moyenne (km/h)', t.speed, pr.v)}${num('bikeKg', 'Poids du vélo (kg)', t.bikeKg, String(model(b).kg).replace('.', ','), .1)}
        ${num('maxF', 'Maxi pneu AV (bar)', t.maxF, 'flanc', .1)}${num('maxR', 'Maxi pneu AR (bar)', t.maxR, 'flanc', .1)}${num('rimMax', 'Maxi jante (bar)', t.rimMax, 'jante', .1)}</div>
      <label class="row tiny" style="margin-top:10px;gap:8px"><input type="checkbox" data-grt="hookless" ${t.hookless ? 'checked' : ''}> Jante hookless (5 bar maximum, norme ETRTO)</label>
      <p class="tiny muted gr-note">Méthode : écrasement de 15 % du pneu selon la charge par roue (${Math.round(pr.kg)} kg au total, toi + vélo + 1,5 kg d'équipement) et la largeur réelle, puis corrections route, conditions, montage et vitesse. Ne dépasse jamais la pression maximale du pneu ni de la jante.</p></div>`;
  }
  /* --- onglet Sorties --- */
  function ridesTab(b){
    const g = G(), allR = rides().slice(0, 60), opts = r => [['', 'Auto'], ...g.bikes.map(x => [x.id, x.name]), ['none', 'Aucun']].map(([v, l]) => `<option value="${v}"${(g.assign[r.ref] || '') === v ? ' selected' : ''}>${esc(l)}</option>`).join('');
    return `<div class="gr-sec"><p class="tiny muted" style="margin:0 0 8px">Chaque sortie compte une seule fois et va au vélo choisi à la main, sinon au vélo Strava / Intervals associé, sinon au vélo qui reçoit ce type (dehors, home trainer, vélotaf).</p>
      <div class="gr-rides">${allR.map(r => { const bid = bikeIdOf(r), bb = g.bikes.find(x => x.id === bid), c = condOf(r);
        return `<div class="gr-ride"><span class="gr-ic" aria-hidden="true">${r.ht ? '🏠' : r.taf ? '🚲' : '🚴'}</span><span style="flex:1;min-width:0"><b>${esc(r.name)}</b><span class="tiny muted" style="display:block">${fmtShort(r.date)} · ${n0(r.km)} km${r.est ? ' (est.)' : ''} · ${r.ht ? 'home trainer' : r.taf ? 'vélotaf' : 'route'}${r.gearName ? ' · ' + esc(r.gearName) : ''}${bb ? '' : ' · non compté'}</span></span>
          ${r.ht ? '' : `<select data-grcond="${esc(r.ref)}" aria-label="Météo de la sortie" class="gr-cond">${Object.entries(COND).map(([k, [ic, l]]) => `<option value="${k}"${c === k ? ' selected' : ''}>${ic} ${l}</option>`).join('')}</select>`}<select data-grassign="${esc(r.ref)}" aria-label="Vélo de cette sortie">${opts(r)}</select></div>`; }).join('') || '<p class="small muted">Aucune sortie pour l\'instant.</p>'}</div></div>`;
  }
  /* --- onglet Vélo --- */
  function bikeTab(b){
    const g = G(), M = model(b), V = variant(b), gears = [...new Map(rides().filter(r => r.gear).map(r => [r.gear, r.gearName || r.gear])).entries()];
    const field = (k, l, v, type = 'text', attrs = '') => `<div><label class="f">${l}</label><input type="${type}" data-grb="${k}" value="${esc(v ?? '')}" ${attrs}></div>`;
    return `<div class="gr-sec"><h3>Identité</h3><div class="gr-grid">${field('name', 'Nom', b.name, 'text', 'maxlength="40"')}${field('brand', 'Marque', b.brand, 'text', 'maxlength="30"')}${field('modelName', 'Modèle', b.modelName, 'text', 'maxlength="50"')}${field('year', 'Année', b.year, 'number', 'min="1990" max="2035" inputmode="numeric"')}${field('purchased', 'Date d\'achat', b.purchased, 'date')}${field('since', 'Sorties comptées depuis le', b.since, 'date')}</div>
      <label class="f">Gabarit (composants d'origine, maquette)</label><select data-grb="model">${Object.entries(MODELS).map(([k, m]) => `<option value="${k}"${k === b.model ? ' selected' : ''}>${esc([m.brand, m.name].filter(Boolean).join(' '))}</option>`).join('')}</select>
      <div class="gr-grid"><div><label class="f">Freins</label><select data-grv="brakes"><option value="rim"${V.brakes === 'rim' ? ' selected' : ''}>Patins (sur jante)</option><option value="disc"${V.brakes === 'disc' ? ' selected' : ''}>Disques</option></select></div>
        <div><label class="f">Vitesses</label><select data-grv="speeds"><option value="11"${V.speeds === 11 ? ' selected' : ''}>11</option><option value="12"${V.speeds === 12 ? ' selected' : ''}>12</option></select></div>
        <div><label class="f">Transmission</label><select data-grv="group"><option value="di2"${V.group === 'di2' ? ' selected' : ''}>Shimano Di2</option><option value="axs"${V.group === 'axs' ? ' selected' : ''}>SRAM AXS</option><option value="meca"${V.group === 'meca' ? ' selected' : ''}>Mécanique</option></select></div></div>
      <label class="row tiny" style="margin-top:8px;gap:8px"><input type="checkbox" data-grv="pm" ${V.pm ? 'checked' : ''}> Capteur de puissance sur le vélo</label></div>
      <div class="gr-sec"><h3>Kilométrage</h3><div class="gr-grid">${field('km0.road', 'Km route avant le suivi', +b.km0?.road || 0, 'number', 'min="0" inputmode="numeric"')}${field('km0.ht', 'Km home trainer avant', +b.km0?.ht || 0, 'number', 'min="0" inputmode="numeric"')}</div>
      <label class="f">Ce vélo reçoit</label><div class="row tiny" style="gap:14px"><label class="row" style="gap:6px"><input type="checkbox" data-grb="rule.out" ${b.rule?.out ? 'checked' : ''}> Sorties dehors</label><label class="row" style="gap:6px"><input type="checkbox" data-grb="rule.ht" ${b.rule?.ht ? 'checked' : ''}> Home trainer</label><label class="row" style="gap:6px"><input type="checkbox" data-grb="rule.taf" ${b.rule?.taf ? 'checked' : ''}> Vélotaf</label></div>
      <label class="f">Vélo dans Strava / Intervals.icu</label>${gears.length ? `<div class="row tiny" style="gap:12px">${gears.map(([id, nm]) => `<label class="row" style="gap:6px"><input type="checkbox" data-grgear="${esc(id)}" ${b.gearIds?.includes(id) ? 'checked' : ''}> ${esc(nm)}</label>`).join('')}</div>` : '<p class="tiny muted" style="margin:0">Aucun vélo Strava / Intervals vu pour l\'instant : il s\'affichera ici après les prochaines synchros. Coche-le pour attribuer ses sorties automatiquement.</p>'}
      <label class="f">Home trainer</label><select data-grb="trainer"><option value="direct"${b.trainer !== 'wheel' ? ' selected' : ''}>Transmission directe (Tacx Flux 2 : sa propre cassette)</option><option value="wheel"${b.trainer === 'wheel' ? ' selected' : ''}>Roue sur rouleau (cassette et moyeu AR tournent)</option></select></div>
      <div class="gr-sec"><h3>Maquette 3D</h3>${b.glb ? `<div class="row between"><span class="small">🧩 ${esc(b.glb.name)} · ${f1((b.glb.size || 0)/1048576)} Mo</span><span class="row" style="gap:6px"><button class="btn sm" data-gr="glbrot">↻ 90°</button><button class="btn sm danger" data-gr="glbdel">Retirer</button></span></div>${glbMapHTML(b)}`
        : `<p class="tiny muted" style="margin:0 0 8px">Pour une maquette fidèle (formes, couleurs, marquages), importe un vrai modèle 3D .glb de ton vélo : acheté sur un site de modèles 3D (vérifie la licence), généré à partir de tes photos (Hyper3D Rodin, Meshy, Tripo, Hunyuan3D…), ou modélisé dans Blender. Nomme ses objets (chain, cassette, fork, front tire…) pour qu'ils deviennent sélectionnables et s'éclatent ; sinon règle-les ici après l'import.</p>`}
        <div class="row" style="gap:8px;margin-top:8px"><button class="btn sm${b.glb ? '' : ' primary'}" data-gr="glbimp">${b.glb ? 'Remplacer le .glb' : 'Importer un .glb'}</button></div></div>
      <div class="row between gr-sec">${g.bikes[0]?.id !== b.id ? '<button class="btn sm" data-gr="main">Vélo principal</button>' : '<span class="tiny muted">Vélo principal</span>'}<button class="btn sm danger" data-gr="del">Supprimer ce vélo</button></div>`;
  }
  let glbNames = null;
  function glbMapHTML(b){
    if (!glbNames) return '<p class="tiny muted">Ouvre la vue 3D pour lister les objets du modèle.</p>';
    const map = b.glb.map || {}, auto = n => { const c = String(n).replace(/[_.\-]+/g, ' '); for (const [k, rx] of Bike3D.NAME_RX) if (rx.test(c)) return k; return 'frame'; };
    return `<details style="margin-top:8px"><summary class="small">Composants du modèle (${glbNames.length} objets)</summary><div class="gr-map">${glbNames.map(n => `<label><span class="tiny">${esc(n)}</span><select data-grmap="${esc(n)}">${['', ...Bike3D.KEYS].map(k => `<option value="${k}"${(map[n] || '') === k ? ' selected' : ''}>${k ? Bike3D.LABEL[k] : 'Auto : ' + Bike3D.LABEL[auto(n)]}</option>`).join('')}</select></label>`).join('')}</div></details>`;
  }

  /* ---------- étude posturale (bike fit) ----------
     Fiche PDF du fitter (formulaire Paris Bike Co « Road positioning chart » lu champ par champ avec pdf.js) ou photo de la fiche ;
     seules les cotes sont reprises (pas le nom, le téléphone ni l'e-mail). Tout reste corrigeable à la main. */
  const FIT_G = { selle: 'Selle', cockpit: 'Poste de pilotage', trans: 'Transmission', pieds: 'Pieds et cales', prolong: 'Prolongateurs (tri)', velo: 'Vélo étudié' };
  const FIT = [
    ['saddleH', 'Hauteur de selle', 'cm', 'selle', 'Text23'], ['setback', 'Recul de selle', 'cm', 'selle', 'Text21'], ['saddleA', 'Angle de selle', '°', 'selle', 'Text22'], ['saddleM', 'Selle', '', 'selle', 'Text16'],
    ['sbReach', 'Distance selle → cintre', 'cm', 'cockpit', 'Text20'], ['drop', 'Drop selle → cintre', 'cm', 'cockpit', 'Text19'], ['stem', 'Potence', 'mm', 'cockpit', 'Text33'], ['stemNeed', 'Potence conseillée', 'mm', 'cockpit', 'Text34'],
    ['stemA', 'Angle de potence', '°', 'cockpit', 'Text35'], ['spacers', 'Entretoises', 'mm', 'cockpit', 'Text37'], ['barA', 'Angle du cintre', '°', 'cockpit', 'Text36'], ['shifterA', 'Angle des cocottes', '°', 'cockpit', 'Text38'],
    ['barW', 'Largeur du cintre', 'cm', 'cockpit', 'Text27'], ['barWNeed', 'Largeur conseillée', 'cm', 'cockpit', 'Text28'], ['dropW', 'Largeur aux drops', 'cm', 'cockpit', 'Text29'], ['barReach', 'Reach du cintre', 'mm', 'cockpit', 'Text25'],
    ['grip', 'Largeur de prise (cocottes)', 'cm', 'cockpit', 'Text24'], ['barM', 'Cintre', '', 'cockpit', 'Text15'],
    ['crank', 'Manivelles', 'mm', 'trans', 'Text17'], ['crankNeed', 'Manivelles conseillées', 'mm', 'trans', 'Text18'],
    ['pedals', 'Pédales', '', 'pieds', 'Text10'], ['spL', 'Rondelles pédale gauche', '', 'pieds', 'Text11'], ['spR', 'Rondelles pédale droite', '', 'pieds', 'Text12'], ['shoes', 'Chaussures', '', 'pieds', 'Text13'], ['shoeSize', 'Pointure', '', 'pieds', 'Text14'],
    ['extL', 'Longueur des extensions', 'mm', 'prolong', 'Text30'], ['extA', 'Angle des extensions', '°', 'prolong', 'Text31'], ['padH', 'Hauteur des repose-coudes', 'mm', 'prolong', 'Text32'], ['padW', 'Largeur des repose-coudes', 'mm', 'prolong', 'Text26'],
    ['make', 'Marque', '', 'velo', 'Text4'], ['model', 'Modèle', '', 'velo', 'Text5'], ['size', 'Taille', '', 'velo', 'Text6'], ['stack', 'Stack', 'mm', 'velo', 'Text7'], ['reach', 'Reach', 'mm', 'velo', 'Text8'],
  ];
  const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/';
  let pdfP = null;
  const loadPdf = () => pdfP ||= new Promise((ok, ko) => { if (window.pdfjsLib) return ok(window.pdfjsLib); const sc = document.createElement('script'); sc.src = PDFJS + 'pdf.min.js';
    sc.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; ok(window.pdfjsLib); }; sc.onerror = () => { pdfP = null; ko(new Error('lecteur PDF injoignable')); }; document.head.appendChild(sc); });
  const toBlob = (c, q = .82) => new Promise(ok => c.toBlob(ok, 'image/jpeg', q));
  async function readFit(file){
    const out = { v: {}, title: '', date: null, src: '', thumb: null };
    if (/pdf/i.test(file.type) || /\.pdf$/i.test(file.name)) {
      const lib = await loadPdf(), doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      try { const md = await doc.getMetadata(); out.title = String(md?.info?.Title || ''); const m = String(md?.info?.CreationDate || '').match(/D:(\d{4})(\d\d)(\d\d)/); if (m) out.date = `${m[1]}-${m[2]}-${m[3]}`; } catch (e) {}
      let fields = {}; try { fields = (await doc.getFieldObjects()) || {}; } catch (e) {}
      const val = n => { const f = fields[n]; const x = Array.isArray(f) ? f.find(y => y.value != null && String(y.value).trim() !== '') : null; return x ? String(x.value).trim() : ''; };
      for (const [k, , , , fld] of FIT) { const v = val(fld).replace(/\bor\b/gi, 'ou'); if (v) out.v[k] = v; }
      if (/paris.?bike/i.test(out.title) || (fields.Text23 && fields.Text33)) out.src = 'Paris Bike Co';
      const pg = await doc.getPage(1), vp0 = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: Math.min(2.2, 1400/vp0.width) }), c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
      await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise; out.thumb = await toBlob(c);
    } else {
      const url = URL.createObjectURL(file), im = new Image(); await new Promise((ok, ko) => { im.onload = ok; im.onerror = () => ko(new Error('image illisible')); im.src = url; });
      const k = Math.min(1, 1400/im.width), c = document.createElement('canvas'); c.width = im.width*k; c.height = im.height*k; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url); out.thumb = await toBlob(c);
    }
    if (!out.date) { const m = file.name.match(/(\d\d)(\d\d)(20\d\d)/); if (m) out.date = `${m[3]}-${m[2]}-${m[1]}`; } // …_06022026.pdf
    return out;
  }
  const num = v => parseFloat(String(v || '').replace(',', '.').replace(/[^\d.\-]/g, ''));
  function fitAdvice(f){
    const v = f?.v || {}, out = [];
    if (v.stemNeed && v.stemNeed !== v.stem) out.push(['Potence', v.stem ? v.stem + ' mm' : '—', v.stemNeed + ' mm']);
    if (v.crankNeed && num(v.crankNeed) !== num(v.crank)) out.push(['Manivelles', v.crank ? v.crank + ' mm' : '—', v.crankNeed + ' mm']);
    if (v.barWNeed && num(v.barWNeed) !== num(v.barW)) out.push(['Largeur du cintre', v.barW ? v.barW + ' cm' : '—', v.barWNeed + ' cm']);
    return out;
  }
  function fitTab(b){
    const f = b.fit;
    if (!f) return `<div class="gr-sec"><h3>Étude posturale</h3><p class="small muted" style="margin:4px 0 10px">Charge la fiche de ton bike fit (PDF ou photo). Les cotes d'une fiche PDF remplie (ex. Paris Bike Co) sont lues automatiquement ; sinon tu les saisis ici. Tes coordonnées figurant sur la fiche ne sont pas reprises.</p>
      <div class="row" style="gap:8px"><button class="btn primary" data-gr="fitimp">Charger mon étude</button><button class="btn" data-gr="fitnew">Saisir à la main</button></div></div>`;
    const adv = fitAdvice(f), by = {}; for (const r of FIT) (by[r[3]] ||= []).push(r);
    return `<div class="gr-sec"><div class="gr-fithead">${f.thumbId ? `<button type="button" class="gr-fitthumb" data-gr="fitopen" aria-label="Ouvrir l'étude"><img data-grthumb="${esc(f.thumbId)}" alt="Fiche de l'étude posturale"></button>` : ''}
        <div style="flex:1;min-width:0"><b>Étude posturale</b><span class="tiny muted" style="display:block">${esc([f.src, f.date ? dfr(f.date) : ''].filter(Boolean).join(' · ') || 'Saisie manuelle')}${f.v?.model ? ` · ${esc([f.v.make, f.v.model, f.v.size].filter(Boolean).join(' '))}` : ''}</span>
          <div class="row" style="gap:6px;margin-top:6px">${f.file ? '<button class="btn sm" data-gr="fitopen">Ouvrir</button>' : ''}<button class="btn sm" data-gr="fitimp">${f.file ? 'Remplacer' : 'Charger la fiche'}</button><button class="btn sm danger" data-gr="fitdel">Supprimer</button></div></div></div>
      ${adv.length ? `<div class="gr-adv"><b>À changer d'après l'étude</b>${adv.map(([l, a, c]) => `<div class="gr-advr"><span>${l}</span><span class="muted">${esc(a)}</span><span>→</span><b>${esc(c)}</b></div>`).join('')}</div>` : ''}</div>
      ${Object.entries(FIT_G).map(([g, l]) => `<div class="gr-sec"><h3>${l}</h3><div class="gr-fit">${by[g].map(([k, lab, u]) => `<label><span>${lab}</span><span class="gr-fv"><input data-grfit="${k}" value="${esc(f.v?.[k] || '')}" placeholder="—" inputmode="${u && u !== '°' ? 'decimal' : 'text'}">${u ? `<i>${u}</i>` : ''}</span></label>`).join('')}</div></div>`).join('')}
      <p class="tiny muted gr-note">Valeurs reprises telles quelles de la fiche${f.src ? ' ' + esc(f.src) : ''} : vérifie-les, surtout les unités. La fiche elle-même reste privée (sur ton téléphone et dans ton espace).</p>`;
  }
  async function hydrateThumbs(){ for (const im of document.querySelectorAll('img[data-grthumb]')) { if (im.src) continue; const bl = await Media.get(im.dataset.grthumb).catch(() => null); if (bl && im.isConnected) im.src = URL.createObjectURL(bl); } }

  /* ---------- fiche latérale (composant) ---------- */
  let sheet = null;
  function sheetEl(){ if (sheet) return sheet; sheet = document.createElement('dialog'); sheet.className = 'gr-sheet'; sheet.id = 'grSheet'; document.body.appendChild(sheet);
    sheet.addEventListener('click', e => { if (e.target === sheet || e.target.closest('[data-grclose]')) closeSheet(); }); sheet.addEventListener('close', () => { sheetKey = null; if (explode()) Bike3D.select(null); }); return sheet; }
  function closeSheet(){ if (sheet?.open) sheet.close(); }
  function partSheet(k){
    const b = cur(); if (!b || !P(k)) return; const rs = ridesOf(b), i = partInfo(b, k, rs), p = P(k), siblings = partsOf(b).filter(x => x.g === p.g && x.k !== k);
    const hist = logOf(b, e => e.part === k), shot = Bike3D.R ? Bike3D.snapshot(p.g) : null; sheetKey = k;
    const replaces = hist.filter(e => e.kind === 'replace');
    const nextTxt = i.inspect ? (i.nextDate ? `Contrôle conseillé le ${fmtShort(i.nextDate)}` : '—') : i.charge ? `Recharge dans ${leftTxt(i)}` : `${leftTxt(i)} restants${i.nextDate ? ` · vers le ${fmtShort(i.nextDate)} à ton rythme actuel` : ''}`;
    const el = sheetEl(); el.innerHTML = `<div class="gr-sh"><button class="x" data-grclose aria-label="Fermer">×</button>
      ${shot ? `<img class="gr-shot" src="${shot}" alt="Rendu 3D : ${esc(i.l)}">` : ''}
      <div class="tiny muted gr-cat0">${CATS[i.cat]}</div><h3>${esc(i.l)}</h3><div class="small muted">${esc(i.spec || 'Référence à renseigner')}</div>
      ${siblings.length ? `<div class="seg gr-sib">${[p, ...siblings].map(x => `<button type="button" class="${x.k === k ? 'on' : ''}" data-gr="part" data-k="${x.k}">${esc(x.l)}</button>`).join('')}</div>` : ''}
      <div class="gr-big"><span style="color:${col(i.rem)}" class="num">${pct(i.rem)}</span><span class="tiny muted">${i.charge ? 'de charge' : 'd\'état'} · <span class="gr-src">${SRC[i.src]}</span>${i.src !== 'estimation' ? ` le ${fmtShort(i.from)}` : ''}</span></div>${barHTML(i.rem, i.charge)}
      <dl class="gr-dl"><div><dt>${i.charge ? 'Depuis la recharge' : 'Depuis la pose'}</dt><dd>${i.total != null ? `${n0(i.total)} km` : i.unit === 'h' ? `${Math.round(i.used)} h` : i.unit === 'km' ? `${n0(i.used)} km` : `${i.used} j`}<small>${i.orig ? 'origine' : fmtShort(i.at)}</small></dd></div>
        <div><dt>Durée de vie restante</dt><dd>${leftTxt(i)}<small>sur ${n0(i.life)} ${i.unit === 'j' ? 'j' : i.unit}</small></dd></div>
        <div><dt>Dernière intervention</dt><dd>${i.last ? `${KIND[i.last.kind]?.[1] || ''}<small>${fmtShort(i.last.date)}</small>` : '—'}</dd></div>
        <div><dt>Prochaine conseillée</dt><dd style="font-size:12.5px">${esc(nextTxt)}</dd></div></dl>
      ${p.tip ? `<p class="small muted" style="margin:6px 0 10px">${esc(p.tip)}</p>` : ''}
      ${i.charge ? `<div class="gr-act"><div class="gr-grid"><div><label class="f">Dernière recharge</label><input type="date" id="grChD" value="${todayISO()}" max="${todayISO()}"></div><div><label class="f">Niveau après (%)</label><input type="number" min="0" max="100" inputmode="numeric" id="grLvl" placeholder="100"></div></div>
        <button class="btn primary" data-gr="charge" data-k="${k}" style="width:100%;margin-top:8px">🔋 Enregistrer la recharge</button><p class="tiny muted" style="margin:6px 0 0">Laisse 100 % pour une recharge complète, ou saisis le niveau lu dans E-Tube / sur l'Edge à cette date.</p></div>` : ''}
      ${k === 'chain' ? `<div class="gr-act"><label class="f">Mesure d'allongement (%)</label><div class="row"><input type="number" step="0.05" min="0" max="1.5" inputmode="decimal" id="grMeas" placeholder="0,25" style="flex:1"><button class="btn" data-gr="measure">Enregistrer</button></div></div>` : ''}
      ${!i.charge ? `<div class="gr-act"><label class="f">Inspection : état constaté ${i.inspect ? '(ou contrôle fait)' : ''}</label><div class="row"><input type="range" min="0" max="100" step="5" value="${Math.round(i.rem*100)}" id="grInsp" style="flex:1" oninput="this.nextElementSibling.textContent=this.value+' %'"><b class="num" style="min-width:44px">${Math.round(i.rem*100)} %</b><button class="btn" data-gr="inspect" data-k="${k}">Noter</button></div></div>` : ''}
      <details class="more"><summary>${i.charge ? 'Remplacer' : 'Remplacé / nouvelle pièce'}</summary>
        <div class="gr-grid"><div><label class="f">Date de pose</label><input type="date" id="grRepD" value="${todayISO()}"></div><div><label class="f">Prix (€)</label><input type="number" inputmode="decimal" min="0" id="grRepP" placeholder="0"></div>
          <div><label class="f">Marque et référence</label><input id="grRepS" value="${esc(i.spec)}" maxlength="80"></div><div><label class="f">Fournisseur</label><input id="grRepF" maxlength="40" placeholder="Magasin, site…"></div></div>
        <button class="btn primary" data-gr="replace" data-k="${k}" style="width:100%;margin-top:10px">Enregistrer la pose (compteur à zéro)</button></details>
      <details class="more"><summary>Seuil d'usure</summary><label class="f">Durée de vie (${i.unit === 'j' ? 'jours' : i.unit === 'h' ? 'heures par charge' : i.charge ? 'km par charge' : 'km'})</label><div class="row"><input type="number" inputmode="numeric" min="1" id="grLife" value="${i.life}" style="flex:1"><button class="btn" data-gr="life" data-k="${k}">OK</button></div></details>
      ${hist.length ? `<h4>Historique</h4>${hist.map(e => { const nx = e.kind === 'replace' ? replaces[replaces.indexOf(e) - 1] : null;
        return `<div class="gr-h"><span>${KIND[e.kind]?.[0] || '•'}</span><span style="flex:1"><b>${KIND[e.kind]?.[1] || ''}</b>${e.label ? ' · ' + esc(e.label) : ''}<span class="tiny muted" style="display:block">${fmtShort(e.date)}${e.kind === 'replace' ? ` · pose à ${n0(odo(b, e.date, rs))} km${nx ? ` · utilisée ${n0(odo(b, nx.date, rs) - odo(b, e.date, rs))} km (${diffDays(e.date, nx.date)} j)` : ''}` : ''}${e.value != null && e.value !== '' ? ` · ${f1(+e.value)} %` : ''}${e.supplier ? ' · ' + esc(e.supplier) : ''}</span></span>${+e.price ? `<b class="num">${n0(e.price)} €</b>` : ''}</div>`; }).join('')}` : ''}</div>`;
    if (!el.open) el.showModal();
    if (explode()) Bike3D.select(p.g);
  }
  function logDlg(id){
    const b = cur(), e = id ? G().log.find(x => x.id === id) : null; if (!b) return;
    const el = sheetEl(); el.innerHTML = `<div class="gr-sh"><button class="x" data-grclose aria-label="Fermer">×</button><h3>${e ? 'Modifier' : 'Ajouter au carnet'}</h3>
      <div class="gr-grid"><div><label class="f">Type</label><select id="grLK">${Object.entries(KIND).map(([k, [ic, l]]) => `<option value="${k}"${(e?.kind || 'buy') === k ? ' selected' : ''}>${ic} ${l}</option>`).join('')}</select></div>
        <div><label class="f">Composant</label><select id="grLP"><option value="">—</option>${partsOf(b).map(p => `<option value="${p.k}"${e?.part === p.k ? ' selected' : ''}>${esc(p.l)}</option>`).join('')}</select></div>
        <div><label class="f">Produit</label><input id="grLL" maxlength="80" value="${esc(e?.label || '')}" placeholder="Chaîne Shimano XTR M9100"></div><div><label class="f">Catégorie</label><select id="grLC"><option value="">Auto</option>${Object.entries(CATS).map(([k, l]) => `<option value="${k}"${e?.cat === k ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
        <div><label class="f">Marque · référence</label><input id="grLR" maxlength="60" value="${esc(e?.ref || '')}" placeholder="CN-M9100"></div><div><label class="f">Fournisseur</label><input id="grLS" maxlength="40" value="${esc(e?.supplier || '')}"></div>
        <div><label class="f">Date d'achat</label><input type="date" id="grLB" value="${e?.buyDate || ''}"></div><div><label class="f">Date (pose / intervention)</label><input type="date" id="grLD" value="${e?.date || todayISO()}"></div>
        <div><label class="f">Prix (€)</label><input type="number" inputmode="decimal" min="0" id="grLPr" value="${e?.price || ''}"></div><div><label class="f">Valeur (%)</label><input type="number" inputmode="decimal" min="0" max="100" id="grLV" value="${e?.value ?? ''}" placeholder="mesure, état, batterie"></div></div>
      <label class="f">Commentaire</label><input id="grLN" maxlength="140" value="${esc(e?.note || '')}">
      <p class="tiny muted">« Remplacement » remet le compteur du composant à zéro à cette date ; « Inspection » et « Mesure » remplacent l'estimation.</p>
      <div class="row between" style="margin-top:10px">${e ? `<button class="btn danger sm" data-gr="logdel" data-id="${e.id}">Supprimer</button>` : '<span></span>'}<button class="btn primary" data-gr="logsave" data-id="${e?.id || ''}">Enregistrer</button></div></div>`;
    if (!el.open) el.showModal();
  }
  function addAskDlg(){
    const el = sheetEl(); el.innerHTML = `<div class="gr-sh"><button class="x" data-grclose aria-label="Fermer">×</button><h3>Ajouter un vélo</h3><p class="small muted">Gabarits avec maquette et composants d'origine ; les autres marques arriveront ensuite (gabarit générique en attendant, ou ton propre modèle 3D).</p>
      <div class="gr-pick">${Object.entries(MODELS).map(([k, m]) => `<button class="btn" data-gr="add" data-m="${k}">${esc([m.brand, m.name].filter(Boolean).join(' '))}</button>`).join('')}</div>
      <p class="tiny muted" style="margin-top:10px">Un 2e vélo (vélotaf…) ne reçoit que les sorties que tu lui attribues : ses km ne se mélangent jamais à ceux du vélo de tri.</p></div>`;
    if (!el.open) el.showModal();
  }
  const KIND = { replace: ['🔧', 'Remplacement'], buy: ['🛒', 'Achat'], inspect: ['🔍', 'Inspection'], check: ['📏', 'Mesure de chaîne'], charge: ["🔋", "Recharge / niveau lu"], lube: ['💧', 'Lubrification'],
    degrease: ['🧴', 'Dégraissage'], clean: ['🧽', 'Nettoyage transmission'], jockey: ['⚙️', 'Inspection des galets'], wipe: ['🧻', 'Sueur essuyée'], service: ['🛠️', 'Révision / contrôle'] };
  function setPart(b, k, at, spec, price, supplier){
    b.parts ||= {}; b.parts[k] = { ...(b.parts[k] || {}), at, atTs: Date.now(), spec: spec || b.parts[k]?.spec || '' };
    G().log.push({ id: rid(), ts: Date.now(), bikeId: b.id, date: at, part: k, kind: 'replace', label: spec || '', price: +price || 0, supplier: supplier || '' });
  }

  /* ---------- scène 3D ---------- */
  let mountTok = 0;
  async function mount(){
    const el = document.getElementById('gr3d'), b = cur(); if (!el || !b) return; const tok = ++mountTok;
    hydrateThumbs();
    const rs = ridesOf(b), parts = allParts(b, rs), tags = {};
    for (const i of parts) { if (!tags[i.g] || i.rem < tags[i.g].rem) tags[i.g] = { k: i.k, l: i.l, rem: i.rem, charge: i.charge, col: col(i.rem), txt: (i.charge ? '🔋 ' : '') + pct(i.rem) }; }
    let glb = null;
    if (b.glb) { const blob = await Media.get(b.glb.id).catch(() => null); if (blob) glb = { blob, rotY: b.glb.rotY || 0, map: b.glb.map || {} }; }
    const V = variant(b), key = [b.id, b.model, V.brakes, V.speeds, b.tires?.f, b.tires?.r, glb ? b.glb.id + ':' + (b.glb.rotY || 0) + ':' + JSON.stringify(b.glb.map || {}) : 'proc'].join('|');
    try {
      const info = await Bike3D.mount(el, { key, model: b.model, variant: { ...V, tireF: b.tires?.f, tireR: b.tires?.r }, glb, exploded: explode(), allTags, tags, onTap: g => {
        if (!explode()) { const z = g ? zoneOfG(g) : null; if (!zoneK || !ZONES[zoneK][1].includes(g)) { if (z) setZone(z); return; } }
        const t = tags[g]; if (t) partSheet(t.k); else Bike3D.select(null);
      } });
      if (info?.names && JSON.stringify(info.names) !== JSON.stringify(glbNames)) { glbNames = info.names; if (tab === 'bike') render(); }
      if (zoneK && !explode() && JSON.stringify(Bike3D.zoneKeys || []) !== JSON.stringify(ZONES[zoneK][1].filter(k => info.groups.includes(k)))) Bike3D.zone(ZONES[zoneK][1]);
    } catch (e) { if (tok === mountTok) el.innerHTML = `<div class="gr-load tiny muted">3D indisponible (${esc(e.message || e)}) — tout le reste du Garage fonctionne.</div>`; }
  }
  function setZone(z){ zoneK = z; if (mode === 'explode') { mode = 'view'; Bike3D.explode(false); } Bike3D.zone(z ? ZONES[z][1] : null); syncUI(); }
  function syncUI(){ const sm = cur() ? summary(cur()) : null, el = document.getElementById('grZone'); if (el && sm) el.innerHTML = zoneHTML(cur(), sm); const h = document.getElementById('grHint'); if (h) h.textContent = hint(); }
  function setMode(m){
    mode = m; if (m === 'explode' && zoneK) zoneK = null;
    Bike3D.explode(m === 'explode'); syncUI(); const st = document.querySelector('.gr-stage'); if (st) st.dataset.mode = m;
    const v = document.getElementById('gr3d'); if (v) v.dataset.exploded = m === 'explode' ? 1 : 0; const h = document.getElementById('grHint'); if (h) h.textContent = hint();
    document.querySelectorAll('[data-gr="mode"]').forEach(x => x.classList.toggle('on', x.dataset.v === m)); const lb = document.querySelector('[data-gr="labels"]'); if (lb) lb.hidden = m !== 'explode';
  }
  function pickFile(accept, max){ return new Promise(ok => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.onchange = () => { const f = i.files?.[0]; if (f && f.size > max) { toast(`Fichier trop lourd (${f1(f.size/1048576)} Mo, max ${Math.round(max/1048576)} Mo)`); ok(null); } else ok(f || null); }; i.click(); }); }

  /* ---------- événements ---------- */
  const done = (msg, keep) => { save(); if (!keep) closeSheet(); render(); if (msg) toast(msg); };
  const refreshSheet = k => { save(); render(); partSheet(k); };
  document.addEventListener('click', async e => {
    const x = e.target.closest('[data-gr]'); if (!x) return; const a = x.dataset.gr, g = G(), b = cur();
    if (a === 'add') { const nb = newBike(x.dataset.m); if (g.bikes.length) { nb.rule = { out: false, ht: false, taf: true }; nb.name = x.dataset.m === 'road' ? 'Vélotaf' : nb.name; } g.bikes.push(nb); g.sel = nb.id; PROFILE_PANE = 'garage'; TAB = 'profile'; mode = 'view'; tab = 'parts'; done('Vélo ajouté au garage'); window.scrollTo(0, 0); return; }
    if (a === 'addask') return addAskDlg();
    if (a === 'sel') { g.sel = x.dataset.id; mode = 'view'; glbNames = null; save(); render(); return; }
    if (!b) return;
    if (a === 'mode') setMode(x.dataset.v);
    else if (a === 'tab') { tab = x.dataset.v; render(); document.querySelector('.gr-tabs')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    else if (a === 'per') { spendP = x.dataset.v; render(); }
    else if (a === 'reset3d') { zoneK = null; Bike3D.resetView(); syncUI(); }
    else if (a === 'zoom') Bike3D.zoom(x.dataset.v === 'in' ? .8 : 1.25);
    else if (a === 'zone') setZone(x.dataset.v);
    else if (a === 'zoneoff') setZone(null);
    else if (a === 'labels') { allTags = !allTags; Bike3D.labels(allTags); x.classList.toggle('on', allTags); x.setAttribute('aria-pressed', allTags); }
    else if (a === 'part') { if (x.dataset.k) partSheet(x.dataset.k); else { tab = 'care'; render(); } }
    else if (a === 'care') { const k = x.dataset.k; if (k === 'check') { partSheet('chain'); setTimeout(() => document.getElementById('grMeas')?.focus(), 60); return; }
      g.log.push({ id: rid(), ts: Date.now(), bikeId: b.id, date: todayISO(), part: ['lube', 'degrease'].includes(k) ? 'chain' : k === 'jockey' ? 'jockey' : k === 'clean' ? 'cassette' : '', kind: k, label: '', price: 0 }); done(KIND[k][0] + ' ' + KIND[k][1] + ' enregistré'); }
    else if (a === 'measure') { const v = parseFloat(String($('#grMeas')?.value || '').replace(',', '.')); if (!(v >= 0 && v <= 1.5)) return toast('Mesure entre 0 et 1,5 %');
      g.log.push({ id: rid(), ts: Date.now(), bikeId: b.id, date: todayISO(), part: 'chain', kind: 'check', label: '', price: 0, value: v }); refreshSheet('chain'); toast(v >= (variant(b).speeds === 12 ? .5 : .75) ? 'Chaîne à changer' : 'Mesure enregistrée'); }
    else if (a === 'inspect') { const v = +$('#grInsp')?.value; g.log.push({ id: rid(), ts: Date.now(), bikeId: b.id, date: todayISO(), part: x.dataset.k, kind: P(x.dataset.k).basis === 'inspect' ? 'service' : 'inspect', label: '', price: 0, value: P(x.dataset.k).basis === 'inspect' ? null : v }); refreshSheet(x.dataset.k); toast('Inspection notée'); }
    else if (a === 'charge') { const d = $('#grChD')?.value || todayISO(), lv = $('#grLvl')?.value, v = lv === '' || lv == null ? 100 : +lv; if (!(v >= 0 && v <= 100)) return toast('Niveau entre 0 et 100 %'); if (d > todayISO()) return toast('Date dans le futur');
      g.log.push({ id: rid(), ts: Date.now(), bikeId: b.id, date: d, part: x.dataset.k, kind: 'charge', label: v < 100 ? 'niveau lu' : '', price: 0, value: v }); refreshSheet(x.dataset.k); toast(`Recharge du ${fmtShort(d)} enregistrée 🔋`); }
    else if (a === 'replace') { const k = x.dataset.k; setPart(b, k, $('#grRepD')?.value || todayISO(), $('#grRepS')?.value.trim(), $('#grRepP')?.value, $('#grRepF')?.value.trim()); refreshSheet(k); toast(`${P(k).l} : compteur remis à zéro`); }
    else if (a === 'life') { const v = +$('#grLife')?.value; if (!(v > 0)) return; b.parts ||= {}; b.parts[x.dataset.k] = { ...(b.parts[x.dataset.k] || {}), life: v }; refreshSheet(x.dataset.k); toast('Seuil mis à jour'); }
    else if (a === 'log') logDlg();
    else if (a === 'logopen') logDlg(x.dataset.id);
    else if (a === 'logsave') { const id = x.dataset.id, v = $('#grLV').value, en = { kind: $('#grLK').value, part: $('#grLP').value, date: $('#grLD').value || todayISO(), label: $('#grLL').value.trim(), cat: $('#grLC').value, ref: $('#grLR').value.trim(),
        supplier: $('#grLS').value.trim(), buyDate: $('#grLB').value || '', price: +String($('#grLPr').value).replace(',', '.') || 0, value: v === '' ? null : +v, note: $('#grLN').value.trim() };
      if (id) Object.assign(g.log.find(y => y.id === id), en); else g.log.push({ id: rid(), ts: Date.now(), bikeId: b.id, ...en });
      if (en.kind === 'replace' && en.part) { b.parts ||= {}; b.parts[en.part] = { ...(b.parts[en.part] || {}), at: en.date, atTs: Date.now(), spec: [en.label, en.ref].filter(Boolean).join(' · ') || b.parts[en.part]?.spec || '' }; }
      done('Enregistré'); }
    else if (a === 'logdel') { g.log = g.log.filter(y => y.id !== x.dataset.id); done('Supprimé'); }
    else if (a === 'main') { g.bikes = [b, ...g.bikes.filter(y => y !== b)]; done('Vélo principal'); }
    else if (a === 'del') { if (!confirm(`Supprimer « ${b.name} » et son carnet ?`)) return; g.bikes = g.bikes.filter(y => y !== b); g.log = g.log.filter(y => y.bikeId !== b.id); for (const r in g.assign) if (g.assign[r] === b.id) delete g.assign[r];
      if (b.glb) Media.del(b.glb.id); if (b.fit?.file) Media.del(b.fit.file.id); g.sel = g.bikes[0]?.id; mode = 'view'; done('Vélo supprimé'); }
    else if (a === 'glbimp') { const f = await pickFile('.glb,model/gltf-binary', 50*1048576); if (!f) return; const id = 'glb-' + rid(); toast('Import du modèle 3D…');
      const cloud = await Media.put(id, f); if (b.glb) Media.del(b.glb.id); b.glb = { id, name: f.name.replace(/\.glb$/i, ''), size: f.size, rotY: 0, map: {} }; glbNames = null; mode = 'view'; done(cloud ? 'Modèle 3D importé et sauvegardé' : 'Modèle 3D importé sur cet appareil'); }
    else if (a === 'fitimp') { const f = await pickFile('.pdf,application/pdf,image/*', 20*1048576); if (!f) return; toast('Lecture de l\'étude…');
      let r; try { r = await readFit(f); } catch (e) { return toast('Étude illisible : ' + (e.message || e)); }
      const id = 'fit-' + rid(), tid = 'fitthumb-' + rid(); const cloud = await Media.put(id, f); if (r.thumb) await Media.put(tid, r.thumb);
      if (b.fit?.file) Media.del(b.fit.file.id); if (b.fit?.thumbId) Media.del(b.fit.thumbId);
      const n = Object.keys(r.v).length; b.fit = { date: r.date || todayISO(), src: r.src, title: r.title, v: { ...(n ? {} : b.fit?.v || {}), ...r.v }, file: { id, name: f.name, type: f.type || '' }, thumbId: r.thumb ? tid : null };
      tab = 'fit'; done(n ? `Étude chargée : ${n} cotes lues${cloud ? '' : ' (sur cet appareil)'}` : 'Étude chargée : saisis les cotes à la main'); }
    else if (a === 'fitnew') { b.fit = { date: todayISO(), src: '', v: {} }; save(); render(); }
    else if (a === 'fitopen') { const bl = b.fit?.file ? await Media.get(b.fit.file.id) : null; if (!bl) return toast('Fichier introuvable sur cet appareil'); const u = URL.createObjectURL(bl); window.open(u, '_blank') || (location.href = u); }
    else if (a === 'fitdel') { if (!confirm('Supprimer l\'étude posturale de ce vélo ?')) return; if (b.fit?.file) Media.del(b.fit.file.id); if (b.fit?.thumbId) Media.del(b.fit.thumbId); delete b.fit; done('Étude supprimée'); }
    else if (a === 'glbrot') { b.glb.rotY = ((b.glb.rotY || 0) + 90) % 360; save(); render(); }
    else if (a === 'glbdel') { Media.del(b.glb.id); delete b.glb; glbNames = null; done('Retour à la maquette générique'); }
  });
  const setPath = (o, p, v) => { const ks = p.split('.'); let t = o; for (const k of ks.slice(0, -1)) t = (t[k] ||= {}); t[ks[ks.length - 1]] = v; };
  document.addEventListener('change', e => {
    const t = e.target, b = cur(); if (!b) return; const g = G();
    if (t.dataset.grassign != null) { if (t.value) g.assign[t.dataset.grassign] = t.value; else delete g.assign[t.dataset.grassign]; save(); render(); return; }
    if (t.dataset.grcond != null) { if (t.value === 'dry') delete g.cond[t.dataset.grcond]; else g.cond[t.dataset.grcond] = t.value; save(); render(); return; }
    if (t.dataset.grgear != null) { const id = t.dataset.grgear; b.gearIds = (b.gearIds || []).filter(x => x !== id); if (t.checked) { for (const o of g.bikes) o.gearIds = (o.gearIds || []).filter(x => x !== id); b.gearIds.push(id); } save(); render(); return; }
    if (t.dataset.grmap != null) { b.glb.map ||= {}; if (t.value) b.glb.map[t.dataset.grmap] = t.value; else delete b.glb.map[t.dataset.grmap]; save(); render(); return; }
    if (t.dataset.grv) { const k = t.dataset.grv; b.variant ||= {}; b.variant[k] = t.type === 'checkbox' ? t.checked : k === 'speeds' ? +t.value : t.value; if (k === 'group' && t.value === 'axs') b.variant.speeds = 12; save(); render(); return; }
    if (t.dataset.grfit) { b.fit ||= { v: {} }; b.fit.v ||= {}; const v = t.value.trim(); if (v) b.fit.v[t.dataset.grfit] = v; else delete b.fit.v[t.dataset.grfit]; if (!b.fit.date) b.fit.date = todayISO(); save(); render(); return; }
    if (t.dataset.grt) { const k = t.dataset.grt; b.tires ||= {}; const v = t.type === 'checkbox' ? t.checked : t.type === 'number' ? (t.value === '' ? null : +String(t.value).replace(',', '.')) : t.value;
      if (k.startsWith('silca.')) { b.tires.silca ||= {}; b.tires.silca[k.slice(6)] = v; b.tires.silca.date = todayISO(); } else b.tires[k] = v; save(); render(); return; }
    if (t.dataset.grb) { const k = t.dataset.grb, v = t.type === 'checkbox' ? t.checked : t.type === 'number' ? (t.value === '' ? null : Math.max(0, +t.value || 0)) : t.value;
      if (k === 'name' && !String(v).trim()) return; if (k === 'since' && !v) return;
      if (k === 'model') { const M = MODELS[v], old = model(b); b.model = v; b.variant = {}; b.tires = { ...(b.tires || {}), f: M.tires.f, r: M.tires.r, internal: M.tires.internal };
        if (!b.brand || b.brand === old.brand) b.brand = M.brand; if (!b.modelName || b.modelName === old.name) b.modelName = M.name; mode = 'view'; }
      else setPath(b, k, typeof v === 'string' && k !== 'since' && k !== 'purchased' ? v.trim() : v);
      save(); render(); }
  });
  return { tileHTML, pane, mount, readFit, FIT, fitAdvice, setZone, ZONES, rides, ridesOf, bikeIdOf, partInfo, allParts, stats, summary, pressure, careInfo, careAll, CARE, MODELS, PARTS, newBike, Media, setMode, partSheet, closeSheet,
    wipeLocal: () => Media.wipe(), get mode(){ return mode; }, get explode(){ return explode(); } };
})();
