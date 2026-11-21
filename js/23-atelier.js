"use strict";
// FTP Builder · Garage › Atelier 3D : la pièce où vivent les vélos du Garage — tapis + home trainer, rack mural, podium d'exposition, mur des roues, panneau à cassettes,
// étagère à pièces détachées, pied d'atelier, télé des kilomètres par vélo ; roues et cassettes nommées qui se montent d'un geste, entretien guidé, vue éclatée, aménagement libre
/* ============ Atelier ============
   S.garage.atelier = { v, wheels:[Paire], cass:[Cassette], stock:[Pièce], layout:{ clé → position }, spots:{ ht, racks:[], expo }, seeded:[id de vélo] }
   - Paire = { id, name, depth (mm, jante avant), depthR (mm, jante arrière si différente), wall 'noir'|'beige' (flancs), brakes 'rim'|'disc', tire (mm), bikeId|null, slot (0-3 sur le mur des roues)|null, since (pose)|null, km0, wear }
       km = km0 + km route du vélo depuis la pose ; usure = celle des pneus du vélo (Garage) quand elle est montée, sinon la dernière connue.
   - Cassette = { id, name, range '11-28', speeds, tint, loc 'wall'|'ht'|id de paire (roue AR), peg (0-4)|null, since, km0, wear }
   - Pièce = { id, name, qty } (étagère) ; layout = position des meubles : tapis du home trainer, pied d'atelier, podium d'exposition, pompe
     (x, z, r en degrés), mur des roues et étagère (z le long de leur mur), établi et rack (x le long du mur du fond).
   - Vélos : ceux du Garage encore en service, chacun à une place : tapis du home trainer (1), rack mural (2) ou podium d'exposition (1).
     Le premier qui reçoit les sorties home trainer va sur le tapis, les suivants sur le rack, puis sur le podium ; on les change de place
     depuis leur fiche (la place visée est occupée → échange). Home trainer direct : la roue AR attend au mur, la chaîne tourne sur la
     cassette du home trainer ; au rack et en exposition, le vélo garde ses deux roues.
   - L'entretien sur le pied d'atelier écrit dans le carnet du Garage (lubrification, dégraissage, nettoyage, mesure de chaîne, galets, sueur).
   - kit = { run:[Paire de course], wear:[Tenue], helmets:[Casque], bshoes:[Chaussures vélo] } : meuble à chaussures (mur de gauche) et penderie (mur de droite).
       Paire de course = { id, name, color, active, since, km0, life } : les sorties course à pied (sportSessions) comptent pour la paire en cours depuis sa mise en service ;
       Tenue = { id, name, type 'maillot'|'cuissard'|'veste'|'trifonction', color } et Casque = { id, name, color } : sans usure ;
       Chaussures vélo = { id, name, color, since (pose des cales), km0 } : km des sorties route (hors vélotaf) depuis la pose des cales.
   - Rien de la 3D n'est chargé tant que l'atelier n'est pas ouvert ; sans WebGL le Garage reste entier. */
const Atelier = (() => {
  let T = null, V3 = null, Q = null; // three.js : chargé à l'ouverture
  const D2R = Math.PI/180, ease = t => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3)/2, lerp = (a, b, k) => a + (b - a)*k;
  const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const fmtKm = n => Math.round(n).toLocaleString('fr-FR') + ' km';
  const mkRnd = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0)/4294967296; };
  const col = h => new T.Color(h).convertSRGBToLinear();
  const qY = a => new T.Quaternion().setFromAxisAngle(V3(0, 1, 0), a);
  const hasG = () => typeof Garage !== 'undefined';
  const FAST = !!navigator.webdriver; // tests (rendu logiciel lent) : caméra sans transition, pas d'images en trop

  /* ---------- la pièce ---------- */
  const ROOM = { x0: -2.6, x1: 2.6, zb: -2.2, zf: 2.8, h: 2.7 };
  const CAMBOX = { x: [-2.42, 2.42], y: [.25, 2.5], z: [-2.04, 2.66] };
  const LAY0 = { ht: { x: -1.32, z: .55, r: 0 }, stand: { x: .45, z: .25, r: 0 }, expo: { x: 1.75, z: 1.52, r: -90 }, pump: { x: 2.05, z: .4, r: 0 },
    wheels: { z: -1.05 }, bench: { x: -.15 }, rack: { x: 1.66 }, shelf: { z: -.55 }, tv: { x: -1.61 }, shoes: { z: 1.35 }, wardrobe: { z: 1.5 } };
  const ITEMS = { // meubles déplaçables : au sol (glissent et tournent) ou au mur (glissent le long de leur mur) ; empreinte au sol en repère local
    ht: { l: 'Home trainer', floor: true, w: 1.95, d: .95, cx: 0, cz: 0 }, stand: { l: "Pied d'atelier", floor: true, w: 1.4, d: 1.06, cx: -.06, cz: -.08 },
    expo: { l: 'Exposition', floor: true, w: 1.95, d: .8, cx: 0, cz: 0 }, pump: { l: 'Pompe', floor: true, w: .3, d: .24, cx: 0, cz: 0 },
    wheels: { l: 'Mur des roues', wall: 'left', w: 2.2, d: .45 }, bench: { l: 'Établi', wall: 'back', w: 1.84, d: .64 }, rack: { l: 'Rack', wall: 'back', w: 1.75, d: .5 },
    shelf: { l: 'Étagère', wall: 'right', w: 1.84, d: .4 }, tv: { l: 'Télé', wall: 'back', w: 1, d: .1 },
    shoes: { l: 'Meuble à chaussures', wall: 'left', w: .62, d: .32 }, wardrobe: { l: 'Penderie', wall: 'right', w: 1.7, d: .42 } };
  const FIXED = [{ x: -2.5, z: 2.1, hw: .1, hd: .42, r: 0 }]; // obstacles fixes : la pile de pneus neufs contre le mur de gauche, près de la porte
  const SPOT = { ht: { l: 'Home trainer', in: 'sur le home trainer', z: 'trainer', chip: 'Home trainer' }, rack: { l: 'Rack mural', in: 'sur le rack mural', z: 'rack', chip: 'Rack' },
    expo: { l: 'Exposition', in: 'en exposition', z: 'expo', chip: 'Exposition' } };
  const SLOTS = [[-.55, 1.95], [.55, 1.95], [-.55, 1.13], [.55, 1.13]]; // mur des roues : z relatif, hauteur du centre
  const PEGS = [-.77, -.42, -.07, .28, .63], PEG_Y = 1.36; // crochets à cassettes du panneau (x relatif à l'établi)
  const PANEL = { w: 2.0, h: 2.45, z: .7, y: 1.325, hide: 4.1 };
  const RANGES = { Shimano: ['11-25', '11-28', '11-30', '11-32', '11-34', '11-36'], SRAM: ['10-26', '10-28', '10-30', '10-33', '10-36'] }, DEPTHS = [35, 45, 50, 62, 80];
  const rangeOk = v => { const m = String(v || '').trim().match(/^(9|1[0-4])\s*[-–/ ]\s*(2[0-9]|3[0-9]|4[0-9]|5[0-2])$/); return m ? `${m[1]}-${m[2]}` : null; }; // étagement libre (Campagnolo, Ekar…)
  const TV = { w: 1, h: .58, y: 1.58, cw: 1280, ch: 720, road: '#e0642a', ht: '#4a8ae8' }; // télé du mur du fond : écran 16/9, couleurs des barres route / home trainer
  const QUICK = ['Pneu', 'Chambre à air', 'Chaîne', 'Patins / plaquettes', 'Câble', 'Lubrifiant'];

  /* ---------- données (S.garage.atelier) ---------- */
  function G(){
    const g = (S.garage ||= {}); g.bikes ||= []; g.log ||= [];
    const a = (g.atelier ||= {}); a.v ||= 1; a.wheels ||= []; a.cass ||= []; a.stock ||= []; a.layout ||= {}; a.spots ||= {}; a.spots.racks ||= []; a.seeded ||= [];
    return a;
  }
  const bikesOn = () => (S.garage?.bikes || []).filter(b => !b.retired);
  const bikeOf = id => (S.garage?.bikes || []).find(b => b.id === id);
  const vOf = b => hasG() && Garage.variant ? Garage.variant(b) : { brakes: 'disc', speeds: 12, group: 'meca', ...(b.variant || {}) };
  const direct = b => (b?.trainer || 'direct') === 'direct';
  const lay = k => ({ ...LAY0[k], ...(G().layout[k] || {}) });
  const pairOf = id => G().wheels.find(p => p.id === id), cassOf = id => G().cass.find(c => c.id === id);
  const pairOnBike = id => G().wheels.find(p => p.bikeId === id), cassOnPair = id => G().cass.find(c => c.loc === id), cassOnHT = () => G().cass.find(c => c.loc === 'ht');
  const depthR = p => +p.depthR || p.depth, depthTxt = p => depthR(p) !== p.depth ? `${p.depth}/${depthR(p)} mm` : `${p.depth} mm`; // jantes avant / arrière
  const bigOf = c => +String(c.range).split('-')[1] || 30;
  const brk = x => x === 'rim' ? 'à patins' : 'à disque';
  const htId = () => G().spots.ht || null, expoId = () => G().spots.expo || null;
  const spotOf = id => !id ? null : htId() === id ? 'ht' : expoId() === id ? 'expo' : G().spots.racks.includes(id) ? 'rack' : null;
  const placed = id => !!spotOf(id), zoneOf = id => SPOT[spotOf(id)]?.z || 'home';
  function rangeOf(b, speeds){ let s = ''; try { s = Garage.partInfo(b, 'cassette').spec || ''; } catch (e) {} const m = s.match(/(\d{1,2})\s*-\s*(\d{2})/); return m ? `${m[1]}-${m[2]}` : speeds === 12 ? '11-30' : '11-28'; }
  const needSlot = p => !p.bikeId || (htId() === p.bikeId && direct(bikeOf(p.bikeId))); // au mur, ou roue AR qui attend pendant le home trainer direct
  function fixSlots(){ const a = G(), used = new Set();
    for (const p of a.wheels) { if (!needSlot(p)) { p.slot = null; continue; } if (p.slot != null && p.slot >= 0 && p.slot < SLOTS.length && !used.has(p.slot)) used.add(p.slot); else p.slot = null; }
    for (const p of a.wheels) if (needSlot(p) && p.slot == null) { const s = SLOTS.findIndex((_, i) => !used.has(i)); if (s >= 0) { p.slot = s; used.add(s); } } }
  function fixPegs(){ const a = G(), used = new Set();
    for (const c of a.cass) { if (c.loc !== 'wall') { c.peg = null; continue; } if (c.peg != null && c.peg >= 0 && c.peg < PEGS.length && !used.has(c.peg)) used.add(c.peg); else c.peg = null; }
    for (const c of a.cass) if (c.loc === 'wall' && c.peg == null) { const k = PEGS.findIndex((_, i) => !used.has(i)); if (k >= 0) { c.peg = k; used.add(k); } } }
  const freeSlot = () => SLOTS.findIndex((_, i) => !G().wheels.some(p => needSlot(p) && p.slot === i));
  const freePeg = () => PEGS.findIndex((_, i) => !G().cass.some(c => c.loc === 'wall' && c.peg === i));
  // première ouverture : chaque vélo reçoit sa paire d'origine et sa cassette (plus celle du home trainer direct), puis sa place
  function seed(){
    const a = G(), act = bikesOn(), ids = act.map(b => b.id), today = todayISO();
    if (a.spots.ht && !ids.includes(a.spots.ht)) a.spots.ht = null;
    if (a.spots.expo && (!ids.includes(a.spots.expo) || a.spots.expo === a.spots.ht)) a.spots.expo = null;
    a.spots.racks = a.spots.racks.filter(id => ids.includes(id) && id !== a.spots.ht && id !== a.spots.expo).slice(0, 2);
    for (const b of act) { if (placed(b.id)) continue; if (!a.spots.ht && b.rule?.ht) a.spots.ht = b.id; else if (a.spots.racks.length < 2) a.spots.racks.push(b.id);
      else if (!a.spots.expo) a.spots.expo = b.id; else if (!a.spots.ht) a.spots.ht = b.id; }
    for (const b of act) { if (a.seeded.includes(b.id)) continue; a.seeded.push(b.id);
      const V = vOf(b), L = Bike3D.lookOf(b.look, b.model), r = rangeOf(b, V.speeds), since = b.since || today;
      let p = pairOnBike(b.id); if (!p) { p = { id: rid(), name: "Roues d'origine", depth: L.rim, wall: L.wall === 'beige' ? 'beige' : 'noir', brakes: V.brakes, tire: +b.tires?.r || 28, bikeId: b.id, slot: null, since, km0: 0, wear: 0 }; a.wheels.push(p); }
      if (!cassOnPair(p.id)) a.cass.push({ id: rid(), name: "Cassette d'origine", range: r, speeds: V.speeds, tint: '#c9cbcf', loc: p.id, peg: null, since, km0: 0, wear: 0 });
      if (a.spots.ht === b.id && direct(b) && !cassOnHT()) a.cass.push({ id: rid(), name: 'Cassette du home trainer', range: r, speeds: V.speeds, tint: '#3d4047', loc: 'ht', peg: null, since, km0: 0, wear: 0 }); }
    for (const p of a.wheels) if (p.bikeId && !ids.includes(p.bikeId)) unmountPair(p); // vélo vendu ou supprimé : ses roues reviennent au mur
    for (const c of a.cass) if (c.loc !== 'wall' && c.loc !== 'ht' && !pairOf(c.loc)) { c.loc = 'wall'; c.peg = null; }
    fixSlots(); fixPegs(); seedKit();
  }
  // kilométrage et usure : calculés à partir des sorties du vélo qui les porte (Garage) ; mémorisés quand on les démonte
  const roadKm = (b, from) => { try { return Garage.ridesOf(b).filter(r => !r.ht && r.date >= from).reduce((s, r) => s + r.km, 0); } catch (e) { return 0; } };
  const htKm = (b, from) => { try { return Garage.ridesOf(b).filter(r => r.ht && r.date >= from).reduce((s, r) => s + r.km, 0); } catch (e) { return 0; } };
  const pairKm = p => (+p.km0 || 0) + (p.bikeId && p.since && bikeOf(p.bikeId) ? roadKm(bikeOf(p.bikeId), p.since) : 0);
  function pairWear(p){ const b = p.bikeId && bikeOf(p.bikeId); if (b && hasG()) try { return Math.max(Garage.partInfo(b, 'tireF').wear, Garage.partInfo(b, 'tireR').wear); } catch (e) {} return +p.wear || 0; }
  const cassBike = c => c.loc === 'ht' ? bikeOf(htId()) : c.loc !== 'wall' && pairOf(c.loc)?.bikeId ? bikeOf(pairOf(c.loc).bikeId) : null;
  function cassKm(c){ const b = cassBike(c); if (!b || !c.since) return +c.km0 || 0; return (+c.km0 || 0) + (c.loc === 'ht' ? htKm(b, c.since) : roadKm(b, c.since)); }
  function cassWear(c){ const b = cassBike(c); if (b && c.loc !== 'ht' && hasG()) try { return Garage.partInfo(b, 'cassette').wear; } catch (e) {} return c.loc === 'ht' && b ? Math.min(1, cassKm(c)/12000) : +c.wear || 0; }
  function unmountPair(p){ if (p.bikeId) { p.km0 = pairKm(p); p.wear = pairWear(p); } p.bikeId = null; p.since = null; }
  function mountPairOn(p, id){ unmountPair(p); p.bikeId = id; p.since = todayISO(); }
  function moveCass(c, loc){ if (cassBike(c)) { c.km0 = cassKm(c); c.wear = cassWear(c); } c.loc = loc; c.since = loc === 'wall' ? null : todayISO(); }
  const wearCol = w => w >= .65 ? '#ff8a4c' : w >= .4 ? '#f5c542' : '#5ad19a', wearTxt = w => w >= .65 ? 'À remplacer bientôt' : w >= .4 ? 'À surveiller' : 'Bon état';
  const stockCount = () => G().stock.reduce((s, x) => s + (+x.qty || 0), 0);
  // meuble à chaussures et penderie
  const KITCOL = [['#ff8a4c', 'Orange'], ['#2f66d6', 'Bleu'], ['#e63946', 'Rouge'], ['#2a9d8f', 'Vert'], ['#f5c542', 'Jaune'], ['#f4f1ea', 'Blanc'], ['#1d1f24', 'Noir'], ['#8e5bd6', 'Violet']];
  const WEAR_T = { maillot: 'Maillot', cuissard: 'Cuissard', veste: 'Veste', trifonction: 'Trifonction' };
  const KMAX = { run: 6, wear: 8, helmets: 3, bshoes: 3 }, LIVES = [500, 700, 900], CLEAT_KM = 4000;
  const RUN_SLOTS = [[.68, -.15], [.68, .15], [.36, -.15], [.36, .15], [.06, -.15], [.06, .15]]; // meuble à chaussures : [dessus de l'étagère, z], du haut vers le bas
  const KIT3 = n => [[0], [-.28, .28], [-.5, 0, .5]][Math.min(n, 3) - 1] || [0]; // penderie : places des casques (étagère du haut) et des chaussures vélo (étagère du bas), centrées
  function K(){ const k = (G().kit ||= {}); for (const l of ['run', 'wear', 'helmets', 'bshoes']) k[l] ||= []; return k; }
  const kitOf = (l, id) => K()[l]?.find(x => x.id === id), kitZone = l => l === 'run' ? 'shoes' : 'wardrobe';
  const runsSince = from => { try { return sportSessions().filter(x => x.sport === 'run' && x.date >= from); } catch (e) { return []; } };
  const runKm = s => (+s.km0 || 0) + (s.active && s.since ? runsSince(s.since).reduce((t, x) => t + (+x.km || 0), 0) : 0);
  const runWear = s => Math.min(1, runKm(s)/(+s.life || 700));
  const runTxt = s => `${fmtKm(runKm(s))} · ${s.active ? 'paire en cours' : 'au repos'}`;
  function cleatKm(s){ const k0 = +s.km0 || 0; if (!s.since || !hasG()) return k0; try { return k0 + Garage.rides().filter(r => !r.ht && !r.taf && r.date >= s.since).reduce((t, r) => t + r.km, 0); } catch (e) { return k0; } }
  const cleatWear = s => Math.min(1, cleatKm(s)/CLEAT_KM);
  // première ouverture : une tenue de base dans la penderie, et une paire de course si l'app voit déjà des sorties course
  function seedKit(){ const a = G(); if (a.kitSeeded) return; a.kitSeeded = 1; const k = K(), t = todayISO();
    if (!k.wear.length) k.wear.push({ id: rid(), name: 'Maillot FTP builder', type: 'maillot', color: '#ff8a4c' }, { id: rid(), name: 'Cuissard', type: 'cuissard', color: '#1d1f24' });
    if (!k.helmets.length) k.helmets.push({ id: rid(), name: 'Casque', color: '#f4f1ea' });
    if (!k.bshoes.length) k.bshoes.push({ id: rid(), name: 'Chaussures vélo', color: '#1d1f24', since: t, km0: 0 });
    if (!k.run.length && runsSince('0000').length) k.run.push({ id: rid(), name: 'Chaussures de course', color: '#2f66d6', active: true, since: t, km0: 0, life: 700 }); }

  /* ---------- état d'une ouverture ---------- */
  let A = null; // scène : { el, R, scene, cam, groups, seats, B (vélos), W (paires), C (cassettes), trainer, panel, rig… }
  const st = { mode: 'atelier', zone: 'home', onStand: null, sel: null, done: {}, logged: [], arrSel: null, press: null };

  /* ---------- textures dessinées ---------- */
  function ctex(w, h, draw, { rep = [1, 1], rot = 0 } = {}){
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); draw(x, w, h);
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = A.aniso; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]);
    if (rot) { t.center.set(.5, .5); t.rotation = rot; } return t;
  }
  const rgb = (c, k = 1) => `rgb(${c.map(v => clamp(Math.round(v*k), 0, 255)).join(',')})`;
  const font = (F, px) => `${F.style} ${F.w} ${px}px "${F.fam}", "Arial Black", sans-serif`;
  function planks(x, w, h, { base, n = 8, vary = .08, seed = 1, grain = 16 }){
    const r = mkRnd(seed), pw = w/n, gc = base.map((v, i) => Math.round(v*[.55, .5, .45][i]));
    for (let i = 0; i < n; i++) { let y = -r()*h*.7; const x0 = i*pw;
      while (y < h) { const L = h*(.32 + r()*.5); x.fillStyle = rgb(base, 1 + (r() - .5)*2*vary); x.fillRect(x0, y, pw, L);
        for (let g = 0; g < grain; g++) { const gx = x0 + 2 + r()*(pw - 4); x.strokeStyle = `rgba(${gc.join(',')},${(.05 + r()*.12).toFixed(3)})`; x.lineWidth = .5 + r()*1.5;
          x.beginPath(); x.moveTo(gx, y); x.bezierCurveTo(gx + (r() - .5)*10, y + L*.33, gx + (r() - .5)*10, y + L*.66, gx + (r() - .5)*6, y + L); x.stroke(); }
        if (r() < .22) { x.fillStyle = `rgba(${gc.join(',')},.28)`; x.beginPath(); x.ellipse(x0 + pw*(.25 + r()*.5), y + L*(.2 + r()*.6), 3 + r()*4, 6 + r()*8, 0, 0, 7); x.fill(); }
        x.fillStyle = 'rgba(55,38,22,.5)'; x.fillRect(x0, y + L - 1.5, pw, 1.5); y += L; }
      x.fillStyle = 'rgba(55,38,22,.6)'; x.fillRect(x0, 0, 1.6, h); x.fillStyle = 'rgba(255,240,220,.12)'; x.fillRect(x0 + 1.6, 0, 1, h); }
  }
  function boards(x, w, h, { base, n = 5, seed = 5 }){
    const r = mkRnd(seed), bw = w/n;
    for (let i = 0; i < n; i++) { x.fillStyle = rgb(base, 1 + (r() - .5)*.035); x.fillRect(i*bw, 0, bw, h);
      for (let s = 0; s < 10; s++) { x.fillStyle = `rgba(0,0,0,${(r()*.03).toFixed(3)})`; x.fillRect(i*bw + r()*bw, 0, 1 + r()*4, h); }
      x.fillStyle = 'rgba(70,66,60,.5)'; x.fillRect(i*bw, 0, 2, h); x.fillStyle = 'rgba(255,255,255,.4)'; x.fillRect(i*bw + 2, 0, 1, h); }
  }

  // béton ciré brut : nuages de teinte, passes de lisseuse, pores et micro-fissures (couleur + relief)
  function concrete(x, w, h, { seed = 7, bump = false } = {}){
    const r = mkRnd(seed), b = bump ? [128, 128, 128] : [108, 106, 103];
    x.fillStyle = rgb(b); x.fillRect(0, 0, w, h);
    const blot = (cx, cy, rad, a, dark) => { for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) { const g = x.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, rad);
      const c = dark ? '40,38,36' : '235,232,226'; g.addColorStop(0, `rgba(${c},${a})`); g.addColorStop(1, `rgba(${c},0)`); x.fillStyle = g; x.fillRect(cx + ox - rad, cy + oy - rad, rad*2, rad*2); } };
    for (let i = 0; i < 70; i++) blot(r()*w, r()*h, w*(.05 + r()*.22), bump ? .03 : .05 + r()*.08, r() < .5);
    for (let i = 0; i < 46; i++) { const cx = r()*w, cy = r()*h, R = w*(.08 + r()*.2), a0 = r()*7; // passes de lisseuse
      x.strokeStyle = r() < .4 ? `rgba(225,222,216,${(bump ? .02 : .02 + r()*.03).toFixed(3)})` : `rgba(50,48,45,${(bump ? .02 : .03 + r()*.04).toFixed(3)})`; x.lineWidth = 10 + r()*30;
      x.beginPath(); x.arc(cx, cy, R, a0, a0 + .5 + r()*1.1); x.stroke(); }
    const img = x.getImageData(0, 0, w, h), d = img.data; // grain fin
    for (let i = 0; i < d.length; i += 4) { const n = (r() - .5)*(bump ? 18 : 10); d[i] += n; d[i + 1] += n; d[i + 2] += n; } x.putImageData(img, 0, 0);
    for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(30,28,26,${(bump ? .5 : .18 + r()*.3).toFixed(3)})`; x.beginPath(); x.arc(r()*w, r()*h, .5 + r()*1.6, 0, 7); x.fill(); } // pores
    x.lineWidth = 1; for (let i = 0; i < 5; i++) { let px = r()*w, py = r()*h; x.strokeStyle = `rgba(40,38,35,${bump ? .5 : .22})`; x.beginPath(); x.moveTo(px, py);
      for (let k = 0; k < 14; k++) { px += (r() - .5)*34; py += (r() - .3)*26; x.lineTo(px, py); } x.stroke(); }
  }
  // brique pleine en appareil à la française (demi-décalage), joints ciment légèrement creux
  const BRICK = { cols: 4, rows: 12 }; // un motif = 0,9 m × 0,9 m → brique ≈ 22,5 × 7,5 cm joint compris
  function bricks(x, w, h, { seed = 3, bump = false } = {}){
    const r = mkRnd(seed), bw = w/BRICK.cols, bh = h/BRICK.rows, j = Math.max(3, Math.round(bh*.13));
    x.fillStyle = bump ? '#3a3a3a' : rgb([176, 168, 156]); x.fillRect(0, 0, w, h);
    if (!bump) for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(${r() < .5 ? '90,84,76' : '220,214,204'},.35)`; x.fillRect(r()*w, r()*h, 1.5, 1.5); }
    const pal = [[156, 74, 50], [142, 64, 44], [168, 86, 58], [124, 56, 40], [150, 82, 60], [110, 50, 38], [176, 98, 68]];
    for (let row = 0; row < BRICK.rows; row++) { const off = row % 2 ? bw/2 : 0;
      for (let c = -1; c <= BRICK.cols; c++) { const bx = c*bw + off + j/2, by = row*bh + j/2, ww = bw - j, hh = bh - j, k = r();
        const base = pal[Math.floor(r()*pal.length)], v = 1 + (r() - .5)*.16;
        if (bump) { x.fillStyle = `rgb(${Math.round(190 + r()*30)},${Math.round(190 + r()*30)},${Math.round(190 + r()*30)})`; x.fillRect(bx, by, ww, hh); }
        else { const g = x.createLinearGradient(bx, by, bx + ww, by + hh); g.addColorStop(0, rgb(base, v*1.04)); g.addColorStop(1, rgb(base, v*.9)); x.fillStyle = g; x.fillRect(bx, by, ww, hh);
          if (k < .18) { x.fillStyle = 'rgba(40,20,14,.28)'; x.fillRect(bx, by, ww*(.3 + r()*.5), hh); } // tête de brique plus cuite
          if (k > .86) { x.fillStyle = 'rgba(230,220,205,.16)'; x.fillRect(bx, by, ww, hh); } // efflorescence légère
          x.fillStyle = 'rgba(255,220,190,.10)'; x.fillRect(bx, by, ww, 1.5); x.fillStyle = 'rgba(30,14,8,.22)'; x.fillRect(bx, by + hh - 1.5, ww, 1.5); }
        for (let s = 0; s < 70; s++) { x.fillStyle = bump ? `rgba(0,0,0,${(r()*.35).toFixed(3)})` : `rgba(${r() < .5 ? '30,14,8' : '235,190,160'},${(r()*.2).toFixed(3)})`; x.fillRect(bx + r()*ww, by + r()*hh, 1 + r()*2.5, 1 + r()*2); }
        if (r() < .3) { x.fillStyle = bump ? '#606060' : 'rgba(40,20,12,.3)'; x.beginPath(); x.ellipse(bx + r()*ww, by + r()*hh, 2 + r()*5, 1.5 + r()*3, 0, 0, 7); x.fill(); } } } // éclats
  }
  // aluminium brossé : stries horizontales fines, reflets froids
  function brushed(x, w, h, { seed = 9, bump = false } = {}){
    const r = mkRnd(seed); x.fillStyle = bump ? '#808080' : rgb([212, 215, 219]); x.fillRect(0, 0, w, h);
    for (let i = 0; i < h*4; i++) { const y = r()*h, l = r(); x.fillStyle = l < .5 ? `rgba(255,255,255,${(r()*(bump ? .2 : .05)).toFixed(3)})` : `rgba(60,64,70,${(r()*(bump ? .2 : .045)).toFixed(3)})`; x.fillRect(0, y, w, .3 + r()*.8); }
    for (let i = 0; i < 200; i++) { const y = r()*h, x0 = r()*w; x.fillStyle = `rgba(${r() < .5 ? '255,255,255' : '40,44,50'},${(r()*.06).toFixed(3)})`; x.fillRect(x0, y, w*(.1 + r()*.5), .5); }
    if (!bump) { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,.04)'); g.addColorStop(.5, 'rgba(0,0,0,.03)'); g.addColorStop(1, 'rgba(255,255,255,.04)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }
  }
  // couleur + carte de relief tirées du même motif (mêmes graines)
  const ctexPair = (w, h, draw, o) => { const b = ctex(w, h, (x, W, H) => draw(x, W, H, true), o); b.encoding = T.LinearEncoding; return [ctex(w, h, (x, W, H) => draw(x, W, H, false), o), b]; };

  /* ---------- petites briques ---------- */
  const std = (key, o) => A.mats[key] ||= new T.MeshStandardMaterial({ envMapIntensity: .55, ...o, ...(typeof o.color === 'string' ? { color: col(o.color) } : {}) });
  const mesh = (geo, m, parent, x = 0, y = 0, z = 0, cast = true) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = cast; o.receiveShadow = true; parent.add(o); return o; };
  const box = (w, h, d, m, parent, x, y, z, cast) => mesh(new T.BoxGeometry(w, h, d), m, parent, x, y, z, cast);
  const cyl = (r1, r2, h, m, parent, x, y, z, seg = 24) => mesh(new T.CylinderGeometry(r1, r2, h, seg), m, parent, x, y, z);
  const tor = (r, t, m, parent, x, y, z, seg = 48, arc = Math.PI*2) => mesh(new T.TorusGeometry(r, t, 10, seg, arc), m, parent, x, y, z);
  const M = () => ({ steel: std('steel', { color: '#2e3238', roughness: .5, metalness: .6 }), chrome: std('chrome', { color: '#c4c8ce', roughness: .25, metalness: 1 }),
    blk: std('blk', { color: '#1d1f24', roughness: .6 }), rub: std('rub', { color: '#141518', roughness: .92 }), blue: std('blue', { color: '#2f66d6', roughness: .42, metalness: .3 }),
    acc: std('acc', { color: '#ff8a4c', roughness: .45 }), body: std('tbody', { color: '#25282e', roughness: .42, metalness: .35 }), grey: std('grey', { color: '#6c737d', roughness: .4, metalness: .7 }) });
  function sign(text, w, h){ const F = Bike3D.FONTS;
    const t = ctex(512, Math.round(512*h/w), (x, W, H) => { x.fillStyle = '#f4f1ea'; x.fillRect(0, 0, W, H); x.strokeStyle = '#22252b'; x.lineWidth = 6; x.strokeRect(9, 9, W - 18, H - 18);
      x.fillStyle = '#22252b'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = font(F.bloc, H*.48); x.fillText(text, W/2, H*.54); });
    return new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshStandardMaterial({ map: t, roughness: .4, envMapIntensity: .4 }));
  }
  const HIT = () => A.mats.hit ||= new T.MeshBasicMaterial({ visible: false });
  const hitDisc = (r, d, z = 0) => { const m = new T.Mesh(new T.CylinderGeometry(r, r, d, 24), HIT()); m.rotation.x = Math.PI/2; m.position.z = z; m.castShadow = m.receiveShadow = false; m.userData.hit = true; return m; };

  /* ---------- murs, sol, plafond, lumières ---------- */
  function buildRoom(){
    const { x0, x1, zb, zf, h: H } = ROOM, W = x1 - x0, Dz = zf - zb, cz = (zb + zf)/2, g = new T.Group(), s = A.scene; s.add(g);
    // sol : béton ciré brut
    const [cMap, cBump] = ctexPair(1024, 1024, (x, w, h, b) => concrete(x, w, h, { seed: 11, bump: b }), { rep: [W/2.4, Dz/2.4] });
    const floor = mesh(new T.PlaneGeometry(W, Dz), new T.MeshStandardMaterial({ map: cMap, bumpMap: cBump, bumpScale: .25, roughness: .5, metalness: 0, envMapIntensity: .4 }), g, 0, 0, cz, false);
    floor.rotation.x = -Math.PI/2;
    const wallM = rep => new T.MeshStandardMaterial({ map: ctex(512, 512, (x, w, h) => boards(x, w, h, { base: [214, 211, 205] }), { rep }), roughness: .9, envMapIntensity: .35 });
    // mur du fond : grand panneau d'aluminium chromé brossé
    const [aMap, aBump] = ctexPair(1024, 1024, (x, w, h, b) => brushed(x, w, h, { seed: 9, bump: b }), { rep: [W/1.3, H/1.3] });
    const back = mesh(new T.PlaneGeometry(W, H), new T.MeshStandardMaterial({ color: col('#e6e9ed'), map: aMap, bumpMap: aBump, bumpScale: .03, metalness: 1, roughness: .3, envMapIntensity: .95 }), g, 0, H/2, zb, false);
    // murs de côté : brique
    const brickM = seed => { const [m, b] = ctexPair(1024, 1024, (x, w, h, bb) => bricks(x, w, h, { seed, bump: bb }), { rep: [Dz/.9, H/.9] }); return new T.MeshStandardMaterial({ map: m, bumpMap: b, bumpScale: 1.1, roughness: .88, envMapIntensity: .3 }); };
    const left = mesh(new T.PlaneGeometry(Dz, H), brickM(3), g, x0, H/2, cz, false); left.rotation.y = Math.PI/2;
    const right = mesh(new T.PlaneGeometry(Dz, H), brickM(17), g, x1, H/2, cz, false); right.rotation.y = -Math.PI/2;
    const front = new T.Group(); g.add(front); mesh(new T.PlaneGeometry(W, H), wallM([W, H]), front, 0, H/2, zf, false).rotation.y = Math.PI;
    box(.9, 2.05, .04, std('door', { color: '#3a3f47', roughness: .6 }), front, -1.2, 1.025, zf - .02, false);
    const ceil = new T.Group(); g.add(ceil);
    mesh(new T.PlaneGeometry(W, Dz), new T.MeshStandardMaterial({ map: ctex(1024, 1024, (x, w, h) => planks(x, w, h, { base: [222, 204, 170], n: 8, seed: 31, vary: .05, grain: 10 }), { rep: [Dz/1.6, W/1.6], rot: Math.PI/2 }), roughness: .8, envMapIntensity: .3 }), ceil, 0, H, cz, false).rotation.x = Math.PI/2;
    // finitions du panneau alu : cornières dans les angles brique/alu, profil bas et haut, vis inox
    const trim = std('alutrim', { color: '#a9aeb5', roughness: .3, metalness: 1 }), screw = std('screw', { color: '#cfd3d8', roughness: .22, metalness: 1 });
    box(W, .05, .02, trim, g, 0, .025, zb + .01, false); box(W, .03, .02, trim, g, 0, H - .015, zb + .01, false);
    for (const sx of [1, -1]) { const ex = sx > 0 ? x1 : x0; box(.04, H, .006, trim, g, ex - sx*.02, H/2, zb + .003, false); box(.006, H, .04, trim, g, ex - sx*.003, H/2, zb + .02, false); }
    for (let xi = x0 + .25; xi < x1 - .1; xi += .6) for (const y of [.1, H - .08]) { const sc = cyl(.007, .007, .004, screw, g, xi, y, zb + .002, 12); sc.rotation.x = Math.PI/2; sc.castShadow = false; }
    const led = A.mats.led = new T.MeshBasicMaterial({ color: col('#fff6e2') }), ring = std('spotring', { color: '#e8e3d9', roughness: .5 });
    for (const x of [-1.5, 0, 1.5]) for (const z of [-1.3, .4, 2.0]) { cyl(.07, .07, .01, ring, ceil, x, H - .004, z, 32).castShadow = false; cyl(.05, .05, .012, led, ceil, x, H - .006, z, 32).castShadow = false; }
    for (let i = 0; i < 4; i++) { const t = tor(.33, .016, M().rub, g, -2.555 + i*.032, .335, 2.05 + i*.035, 64); t.rotation.y = Math.PI/2; } // pneus neufs contre le mur (hors du champ du podium)
    Object.assign(A, { ceil, front, walls: { back, left, right, floor } }); A.occ.push(floor, back, left, right, ...front.children, ...ceil.children);
    s.add(new T.HemisphereLight(col('#fff3df'), col('#6b6864'), .62));
    const key = new T.DirectionalLight(col('#fff0d8'), 1.05); key.position.set(.9, 2.6, 1.7); key.target.position.set(-.2, 0, -.9); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -3.6, right: 3.6, top: 3.6, bottom: -3.6, near: .1, far: 9 }); key.shadow.bias = -.0004; key.shadow.normalBias = .015; s.add(key, key.target);
    for (const [x, y, z, i] of [[-.2, 2.3, -1.4, .55], [-1.3, 2.3, .6, .45], [1.6, 2.35, -1.3, .45], [1.9, 2.3, -.3, .35], [0, 2.4, 1.6, .3]]) { const p = new T.PointLight(col('#ffe4c2'), i, 4.2, 2); p.position.set(x, y, z); s.add(p); }
  }

  /* ---------- établi, panneau perforé (outils, crochets à cassettes) et panneau de la vue éclatée ---------- */
  function buildBench(g){
    const m = M(), zt = .028;
    const top = new T.MeshStandardMaterial({ map: ctex(512, 256, (x, w, h) => planks(x, w, h, { base: [178, 134, 88], n: 12, seed: 41, vary: .1, grain: 6 }), { rot: Math.PI/2 }), roughness: .55, envMapIntensity: .45 });
    A.occ.push(box(1.8, .05, .6, top, g, 0, .905, .3));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(.045, .88, .045, m.steel, g, sx*.86, .44, .3 + sz*.26);
    box(1.72, .025, .52, m.steel, g, 0, .22, .3);
    const drawer = std('drawer', { color: '#3d434c', roughness: .45, metalness: .5 });
    for (const dx of [.33, .68]) { box(.32, .14, .02, drawer, g, dx, .8, .6); box(.12, .012, .016, m.chrome, g, dx, .8, .615); }
    const red = std('red', { color: '#c0392b', roughness: .45, metalness: .3 });
    box(.46, .2, .24, red, g, -.45, .335, .3); box(.47, .03, .25, red, g, -.45, .45, .3); box(.18, .02, .02, m.blk, g, -.45, .475, .3);
    box(.2, .16, .3, std('carton', { color: '#b98a58', roughness: .9 }), g, .45, .315, .25);
    box(.16, .08, .12, m.grey, g, -.72, .97, .48); box(.04, .1, .16, m.grey, g, -.62, .985, .48); box(.012, .012, .2, m.chrome, g, -.76, .99, .48);
    const bottle = (x, z, r, h, c1, c2) => { cyl(r, r, h, std('b' + c1, { color: c1, roughness: .35 }), g, x, .93 + h/2, z, 20); cyl(r*.45, r*.55, .03, std('b' + c2, { color: c2, roughness: .4 }), g, x, .945 + h, z, 16); };
    bottle(.5, .18, .028, .17, '#2f6fd8', '#f2f2f0'); bottle(.58, .21, .025, .14, '#f2f2f0', '#2f6fd8'); bottle(.67, .16, .034, .2, '#4caf50', '#1d1f24');
    box(.22, .02, .15, std('rag', { color: '#d9d2c3', roughness: 1 }), g, .08, .94, .36).rotation.y = .3;
    const pegT = ctex(256, 256, (x, w, h) => { x.fillStyle = '#b3b9c1'; x.fillRect(0, 0, w, h); const n = 16, s = w/n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const cx = (i + .5)*s, cy = (j + .5)*s; x.fillStyle = '#4a5058'; x.beginPath(); x.arc(cx, cy, 2.9, 0, 7); x.fill(); x.fillStyle = 'rgba(255,255,255,.45)'; x.fillRect(cx - 3, cy + 3.3, 6, 1); } }, { rep: [1.8/.4, 1/.4] });
    A.occ.push(box(1.8, 1.0, .015, new T.MeshStandardMaterial({ map: pegT, roughness: .5, metalness: .35, envMapIntensity: .5 }), g, 0, 1.55, .01, false));
    const fr = std('pegframe', { color: '#8c939c', roughness: .4, metalness: .6 });
    box(1.84, .02, .025, fr, g, 0, 2.06, .015); box(1.84, .02, .025, fr, g, 0, 1.04, .015); box(.02, 1.04, .025, fr, g, -.91, 1.55, .015); box(.02, 1.04, .025, fr, g, .91, 1.55, .015);
    box(.3, .028, .03, m.blue, g, -.69, 1.995, .032);
    for (let i = 0; i < 9; i++) { const s = .0035 + i*.0006, L = .07 + i*.011, x = -.82 + i*.033; box(s, L, s, m.steel, g, x, 1.98 - L/2, zt); box(.02 + i*.002, s, s, m.steel, g, x + .01 + i*.001, 1.98 - L, zt); }
    for (let i = 0; i < 8; i++) { const L = .13 + i*.014, x = -.45 + i*.044, t2 = 1.985; box(.013 + i*.0012, L, .004, m.chrome, g, x, t2 - L/2, zt); tor(.011 + i*.0007, .0035, m.chrome, g, x, t2 - L - .008, zt, 20); box(.026 + i*.0014, .02, .004, m.chrome, g, x, t2 + .006, zt); }
    for (let i = 0; i < 5; i++) { const x = -.05 + i*.042; cyl(.012, .012, .085, i % 2 ? m.blk : m.blue, g, x, 1.935, .045, 16); cyl(.0028, .0028, .1, m.chrome, g, x, 1.845, .045, 8); }
    for (let i = 0; i < 3; i++) box(.016, .11, .006, i === 1 ? m.acc : m.blue, g, .27 + i*.03, 1.93, zt);
    box(.33, .022, .006, m.chrome, g, .59, 1.99, zt); box(.12, .03, .014, m.blue, g, .71, 1.99, .034);
    box(.026, .25, .006, m.blk, g, .83, 1.8, zt); box(.08, .016, .008, m.steel, g, .83, 1.665, zt);
    box(.03, .19, .03, m.blue, g, .45, 1.83, .035); box(.014, .06, .014, m.chrome, g, .45, 1.705, .035);
    for (const x of PEGS) { cyl(.004, .004, .075, m.chrome, g, x, PEG_Y, .05, 8).rotation.x = Math.PI/2; cyl(.004, .004, .02, m.chrome, g, x, PEG_Y + .009, .087, 8); }
    const sg = sign('CASSETTES', .3, .065); sg.position.set(-.07, 1.585, .02); g.add(sg);
    box(1.7, .022, .045, A.mats.led, g, 0, 2.2, .05, false);
    // panneau d'expo de la vue éclatée : il descend du plafond devant l'établi
    const p = new T.Group(); p.position.set(0, PANEL.hide, PANEL.z); p.visible = false; g.add(p);
    const c = document.createElement('canvas'); c.width = 2048; c.height = Math.round(2048*PANEL.h/PANEL.w); A.panelTex = new T.CanvasTexture(c); A.panelTex.encoding = T.sRGBEncoding; A.panelTex.anisotropy = A.aniso;
    const face = new T.MeshStandardMaterial({ map: A.panelTex, roughness: .85, envMapIntensity: .35 }), edge = std('panelEdge', { color: '#8d998a', roughness: .8 });
    const pm = new T.Mesh(new T.BoxGeometry(PANEL.w, PANEL.h, .03), [edge, edge, edge, edge, face, edge]); pm.castShadow = pm.receiveShadow = true; p.add(pm); A.occ.push(pm);
    for (const x of [-.85, .85]) cyl(.004, .004, 1.6, m.chrome, p, x, PANEL.h/2 + .8, 0, 6);
    A.panel = p;
  }
  function drawPanel(name){
    const c = A.panelTex.image, x = c.getContext('2d'), w = c.width, h = c.height, F = Bike3D.FONTS;
    x.fillStyle = '#a9b6a3'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(255,255,255,.05)'; for (let i = 0; i < w; i += 64) x.fillRect(i, 0, 2, h);
    x.fillStyle = '#ffffff'; x.textBaseline = 'alphabetic'; x.textAlign = 'left'; x.font = font(F.bloc, 190); x.fillText('ÉCLATÉ', 80, 240);
    x.textAlign = 'right'; x.font = font(F.tech, 44); x.fillText('V U E   I N G É N I E U R', w - 80, 160); x.font = font(F.sport, 60); x.fillText(name, w - 80, 236);
    x.fillRect(80, 290, w - 160, 5); x.globalAlpha = .8; x.font = font(F.tech, 34); x.fillText('FTP builder · atelier', w - 80, h - 60); x.globalAlpha = 1; A.panelTex.needsUpdate = true;
  }

  /* ---------- mur des roues (mur de gauche) ---------- */
  function buildWheelWall(g){
    const ply = ctex(512, 512, (x, w, h) => planks(x, w, h, { base: [214, 186, 140], n: 3, seed: 55, vary: .04, grain: 22 }));
    A.occ.push(box(.018, 1.86, 2.3, new T.MeshStandardMaterial({ map: ply, roughness: .75, envMapIntensity: .4 }), g, .009, 1.57, 0, false));
    const hk = std('hook', { color: '#25282e', roughness: .55, metalness: .3 });
    for (const [z, y] of SLOTS) for (const dz of [-.19, .19]) { cyl(.006, .006, .17, hk, g, .085, y + .3, z + dz, 10).rotation.z = Math.PI/2; cyl(.006, .006, .035, hk, g, .168, y + .316, z + dz, 10); }
    const sg = sign('ROUES', .26, .065); sg.rotation.y = Math.PI/2; sg.position.set(.02, 2.42, 0); g.add(sg);
  }
  const slotPose = (p, part) => { const [z, y] = SLOTS[p.slot]; return { pos: V3(part === 'rear' ? .145 : .055, y + .3 - (.3152 - (part === 'rear' ? depthR(p) : p.depth)/1000) + .008, z + (part === 'rear' ? .19 : -.19)), quat: qY(Math.PI/2) }; };

  /* ---------- tapis + home trainer (direct ou à rouleau), cale de roue avant ---------- */
  function buildTrainer(g){
    const m = M();
    const matT = ctex(1024, 512, (x, w, h) => { x.fillStyle = '#26292f'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(255,255,255,.035)'; x.lineWidth = 2;
      for (let i = -h; i < w; i += 18) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + h, h); x.stroke(); x.beginPath(); x.moveTo(i + h, 0); x.lineTo(i, h); x.stroke(); }
      x.strokeStyle = 'rgba(255,255,255,.1)'; x.lineWidth = 6; x.strokeRect(16, 16, w - 32, h - 32); x.fillStyle = 'rgba(238,240,244,.6)'; x.font = font(Bike3D.FONTS.sport, 66); x.textAlign = 'right'; x.fillText('FTP builder', w - 52, h - 48); });
    box(1.95, .006, .95, new T.MeshStandardMaterial({ map: matT, roughness: .9, envMapIntensity: .3 }), g, 0, .003, 0, false);
    const ay = .04 + .3395, td = new T.Group(); td.position.set(-.5, ay, 0); g.add(td); // home trainer direct : la cassette est la sienne
    cyl(.2, .2, .07, m.body, td, -.02, -.07, -.095, 48).rotation.x = Math.PI/2; tor(.2, .006, m.acc, td, -.02, -.07, -.058, 64);
    box(.1, .3, .07, m.body, td, 0, -.18, -.04); box(.05, .05, .1, m.body, td, 0, -.005, -.03); cyl(.016, .016, .15, m.chrome, td, 0, 0, 0, 20).rotation.x = Math.PI/2;
    const fy = -ay + .018; box(.86, .036, .06, m.body, td, -.05, fy, -.04); box(.07, .036, .66, m.body, td, -.38, fy, -.04); box(.07, .036, .66, m.body, td, .3, fy, -.04);
    for (const [x, z] of [[-.38, .28], [-.38, -.36], [.3, .28], [.3, -.36]]) cyl(.025, .025, .012, m.rub, td, x, -ay + .006, z, 16);
    tor(.06, .011, m.body, td, -.02, .13, -.095, 20, Math.PI);
    const anchor = new T.Object3D(); td.add(anchor);
    const tw = new T.Group(); tw.position.set(-.5, ay, 0); g.add(tw); // home trainer à rouleau : la roue AR reste sur le vélo
    for (const z of [-.11, .11]) { const leg = box(.035, .44, .035, m.body, tw, -.08, -.2, z); leg.rotation.z = .35; box(.05, .05, .05, m.body, tw, 0, 0, z*.75); }
    box(.5, .03, .05, m.body, tw, -.05, -ay + .015, .2); box(.5, .03, .05, m.body, tw, -.05, -ay + .015, -.2); box(.05, .03, .44, m.body, tw, -.28, -ay + .015, 0);
    cyl(.032, .032, .07, m.chrome, tw, -.06, -ay + .055, 0, 20).rotation.x = Math.PI/2; cyl(.07, .07, .05, m.acc, tw, -.06, -ay + .07, -.075, 32).rotation.x = Math.PI/2;
    box(.24, .04, .2, std('riser', { color: '#1b1d21', roughness: .7 }), g, .49, .02, 0);
    const seat = new T.Object3D(); seat.position.set(0, .04, 0); g.add(seat);
    return { td, tw, anchor, seat };
  }
  function trainerKind(){ const b = bikeOf(htId()), d = !b || direct(b); A.trainer.td.visible = d; A.trainer.tw.visible = !d; }

  /* ---------- pied d'atelier (sort du sol pour l'entretien) + tapis ---------- */
  function buildStand(g){
    const m = M();
    const smT = ctex(1024, 768, (x, w, h) => { x.fillStyle = '#2b2f36'; x.fillRect(0, 0, w, h); x.strokeStyle = '#ff8a4c'; x.lineWidth = 8; x.strokeRect(26, 26, w - 52, h - 52);
      x.fillStyle = 'rgba(255,138,76,.9)'; x.font = font(Bike3D.FONTS.sport, 92); x.textAlign = 'center'; x.fillText('FTP builder', w/2, h - 120);
      x.fillStyle = 'rgba(238,240,244,.55)'; x.font = font(Bike3D.FONTS.tech, 34); x.fillText('A T E L I E R', w/2, h - 68); });
    box(1.4, .006, 1.06, new T.MeshStandardMaterial({ map: smT, roughness: .9, envMapIntensity: .3 }), g, -.06, .003, -.08, false);
    const rig = new T.Group(); g.add(rig); const cx = -.284, cy = 1.24, pz = -.3;
    for (let i = 0; i < 3; i++) { const a = i*2*Math.PI/3 + .5; box(.5, .025, .04, m.body, rig, cx + Math.cos(a)*.24, .03, pz + Math.sin(a)*.24).rotation.y = -a; cyl(.02, .02, .01, m.rub, rig, cx + Math.cos(a)*.48, .005, pz + Math.sin(a)*.48, 12); }
    cyl(.032, .032, .12, m.body, rig, cx, .08, pz, 16); cyl(.022, .022, cy - .12, m.blue, rig, cx, (cy - .12)/2 + .12, pz, 20);
    cyl(.018, .018, .29, m.body, rig, cx, cy, pz + .15, 16).rotation.x = Math.PI/2;
    box(.07, .09, .06, m.blue, rig, cx, cy, -.04); box(.05, .075, .016, m.rub, rig, cx, cy, -.018); box(.05, .075, .016, m.rub, rig, cx, cy, .028);
    cyl(.024, .024, .05, m.blk, rig, cx + .055, cy, -.04, 16).rotation.z = Math.PI/2;
    cyl(.13, .13, .015, m.body, rig, cx, .98, pz, 32); tor(.13, .008, m.body, rig, cx, .99, pz, 32).rotation.x = Math.PI/2;
    rig.scale.set(1, .001, 1); rig.visible = false;
    const seat = new T.Object3D(); seat.position.set(0, .34, 0); g.add(seat);
    return { rig, seat };
  }

  /* ---------- podium d'exposition : le vélo debout sur ses deux roues, tenu par l'axe arrière, avec sa plaque ---------- */
  const EXPO = { w: 1.9, d: .76, h: .07 };
  function buildExpo(g){
    const m = M(), { w: W, d: D, h: H } = EXPO, rr = .1, sh = new T.Shape(), x0 = -W/2, y0 = -D/2;
    sh.moveTo(x0 + rr, y0); sh.lineTo(x0 + W - rr, y0); sh.quadraticCurveTo(x0 + W, y0, x0 + W, y0 + rr); sh.lineTo(x0 + W, y0 + D - rr); sh.quadraticCurveTo(x0 + W, y0 + D, x0 + W - rr, y0 + D);
    sh.lineTo(x0 + rr, y0 + D); sh.quadraticCurveTo(x0, y0 + D, x0, y0 + D - rr); sh.lineTo(x0, y0 + rr); sh.quadraticCurveTo(x0, y0, x0 + rr, y0);
    // plateau clair qui semble flotter : socle sombre en retrait, filet de LED dessous, halo chaud sur le parquet
    const top = new T.ExtrudeGeometry(sh, { depth: .032, bevelEnabled: true, bevelThickness: .006, bevelSize: .006, bevelSegments: 2, curveSegments: 8 }); top.rotateX(-Math.PI/2); top.translate(0, .032, 0);
    A.occ.push(mesh(top, [std('podium', { color: '#ece9e3', roughness: .4 }), std('podiumSide', { color: '#dedad2', roughness: .55 })], g));
    box(W - .1, .022, D - .1, m.blk, g, 0, .011, 0); box(W - .06, .004, D - .06, A.mats.led, g, 0, .024, 0, false);
    const glow = ctex(256, 128, (x, w, h) => { for (let i = 0; i < 14; i++) { const k = i/13, ix = 8 + k*44, iy = 4 + k*22; x.fillStyle = `rgba(255,214,160,${(.012 + .05*k*k).toFixed(3)})`; x.beginPath();
      if (x.roundRect) x.roundRect(ix, iy, w - 2*ix, h - 2*iy, 26 - k*14); else x.rect(ix, iy, w - 2*ix, h - 2*iy); x.fill(); } });
    const gl = mesh(new T.PlaneGeometry(W + .6, D + .5), new T.MeshBasicMaterial({ map: glow, transparent: true, depthWrite: false, blending: T.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2 }), g, 0, .002, 0, false);
    gl.rotation.x = -Math.PI/2; gl.receiveShadow = false; gl.renderOrder = 1;
    // pied d'exposition : deux chevalets qui viennent chercher les bouts de l'axe arrière (x = -0,5 dans le repère du vélo)
    const ay = H + .3395, rod = (a, b, rad) => { const dv = b.clone().sub(a), o = mesh(new T.CylinderGeometry(rad, rad, dv.length(), 12), m.steel, g); o.position.copy(a).addScaledVector(dv, .5); o.quaternion.setFromUnitVectors(V3(0, 1, 0), dv.normalize()); return o; };
    for (const s of [1, -1]) { for (const fx of [-.66, -.34]) rod(V3(fx, H + .012, s*.11), V3(-.5, ay - .014, s*.095), .009);
      box(.36, .016, .03, m.steel, g, -.5, H + .008, s*.11); cyl(.012, .012, .024, m.blk, g, -.5, ay, s*.084, 16).rotation.x = Math.PI/2; }
    box(.03, .016, .22, m.steel, g, -.66, H + .008, 0);
    // plaque inclinée au bord du plateau : nom du vélo exposé
    const plate = ctex(512, 128, () => {}), pl = new T.Group(); pl.position.set(.12, H, D/2 - .11); pl.rotation.x = -.95; g.add(pl);
    box(.48, .125, .014, m.blk, pl, 0, .0625, 0); const face = mesh(new T.PlaneGeometry(.46, .115), new T.MeshStandardMaterial({ map: plate, roughness: .5, envMapIntensity: .3 }), pl, 0, .0625, .0075, false);
    face.receiveShadow = false; box(.06, .03, .05, m.blk, g, .12, H + .015, D/2 - .1);
    g.userData.pick = { kind: 'expo' };
    const seat = new T.Object3D(); seat.position.set(0, H, 0); g.add(seat);
    return { seat, plate, plateName: null };
  }
  function expoPlate(){ const e = A.expo, b = bikeOf(expoId()), name = b?.name || 'Podium libre'; if (!e || e.plateName === name) return; e.plateName = name;
    const c = e.plate.image, x = c.getContext('2d'), W = c.width, H = c.height, F = Bike3D.FONTS;
    x.fillStyle = '#1b1d22'; x.fillRect(0, 0, W, H); x.fillStyle = '#ff8a4c'; x.fillRect(0, H - 7, W, 7);
    x.textAlign = 'left'; x.textBaseline = 'alphabetic'; x.font = font(F.tech, 21); x.fillText('E X P O S I T I O N', 24, 38);
    let px = 54; x.font = font(F.sport, px); while (x.measureText(name).width > W - 48 && px > 24) x.font = font(F.sport, px -= 2);
    x.fillStyle = b ? '#f4f4f2' : 'rgba(244,244,242,.45)'; x.fillText(name, 22, 98); e.plate.needsUpdate = true; }

  /* ---------- rack mural (1 ou 2 vélos superposés) ---------- */
  const rackYs = () => G().spots.racks.length > 1 ? [1.34, .22] : [.96];
  function buildRack(g){
    const m = M(); while (g.children.length) g.remove(g.children[0]);
    return rackYs().map(y => { for (const lx of [-.15, .2]) { const ya = y + .77; box(.06, .12, .02, m.body, g, lx, ya, .01); box(.03, .03, .3, m.body, g, lx, ya, .17); box(.034, .05, .012, m.rub, g, lx, ya + .03, .248); box(.034, .05, .012, m.rub, g, lx, ya + .03, .312); }
      const s = new T.Object3D(); s.position.set(0, y, .28); g.add(s); return s; });
  }

  /* ---------- étagère à pièces détachées (mur de droite) et pompe ---------- */
  function buildShelf(g){
    const m = M(), wood = new T.MeshStandardMaterial({ map: ctex(512, 128, (x, w, h) => planks(x, w, h, { base: [190, 150, 104], n: 2, seed: 61, grain: 30 }), { rot: Math.PI/2 }), roughness: .6, envMapIntensity: .4 });
    for (const y of [.95, 1.42, 1.89]) { box(.36, .025, 1.8, wood, g, -.18, y, 0); for (const z of [-.75, .75]) box(.3, .04, .02, m.body, g, -.14, y - .032, z); }
    const card = std('carton', { color: '#b98a58', roughness: .9 }), card2 = std('carton2', { color: '#cfa574', roughness: .9 }), bl = std('bluebox', { color: '#2f5fb8', roughness: .6 }), wh = std('whitebox', { color: '#ece8e0', roughness: .8 });
    const y3 = 1.9025; box(.3, .22, .28, card, g, -.16, y3 + .11, -.7); box(.26, .18, .22, card2, g, -.15, y3 + .09, -.43); box(.24, .16, .2, bl, g, -.15, y3 + .08, -.17); box(.24, .14, .2, bl, g, -.15, y3 + .07, .05); box(.22, .12, .18, wh, g, -.14, y3 + .06, .27);
    for (let i = 0; i < 3; i++) { box(.16, .09, .12, m.blue, g, -.2, y3 + .045, .53 + i*.14); box(.14, .01, .1, m.blk, g, -.2, y3 + .088, .53 + i*.14); }
    const y2 = 1.4325;
    for (let i = 0; i < 3; i++) tor(.15, .022, m.rub, g, -.18, y2 + .022 + i*.044, -.6, 40).rotation.x = Math.PI/2;
    for (let i = 0; i < 4; i++) box(.1, .13, .065, i % 2 ? m.blk : m.acc, g, -.17, y2 + .065, -.23 + i*.09);
    box(.14, .05, .09, std('chainbox', { color: '#2b2e33', roughness: .5 }), g, -.17, y2 + .025, .2); box(.2, .08, .14, wh, g, -.16, y2 + .04, .43);
    for (let i = 0; i < 2; i++) tor(.15, .022, m.rub, g, -.18, y2 + .022 + i*.044, .72, 40).rotation.x = Math.PI/2;
    const y1 = .9625;
    ['#f2f2f0', '#2f6fd8', '#4caf50', '#e9c46a', '#1d1f24', '#ff8a4c'].forEach((c, i) => { const r = .028 + (i % 3)*.004, h = .16 + (i % 2)*.05; cyl(r, r, h, std('b' + c, { color: c, roughness: .35 }), g, -.16, y1 + h/2, -.75 + i*.11, 18); cyl(r*.5, r*.55, .03, m.blk, g, -.16, y1 + h + .015, -.75 + i*.11, 12); });
    cyl(.06, .06, .22, m.grey, g, -.18, y1 + .11, .05, 24); box(.24, .12, .2, card, g, -.16, y1 + .06, .4); box(.18, .1, .16, bl, g, -.16, y1 + .05, .67);
    g.userData.pick = { kind: 'shelf' };
  }
  function buildPump(g){
    const m = M(); box(.22, .02, .09, m.blk, g, 0, .01, 0); cyl(.024, .024, .6, m.acc, g, 0, .32, 0, 16); cyl(.006, .006, .12, m.chrome, g, 0, .68, 0, 8); box(.24, .028, .028, m.blk, g, 0, .74, 0);
    cyl(.045, .045, .02, std('gauge', { color: '#f4f1ea', roughness: .4 }), g, .04, .08, 0, 24).rotation.z = Math.PI/2;
    const hose = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([V3(0, .05, .03), V3(.05, .2, .09), V3(.03, .5, .07), V3(0, .68, .03)]), 24, .006, 8), m.blk); hose.castShadow = true; g.add(hose);
    box(.3, .82, .24, HIT(), g, 0, .41, 0, false).userData.hit = true; // zone tactile : la pompe est fine
    g.userData.pick = { kind: 'pump' };
  }

  /* ---------- meuble à chaussures (mur de gauche), penderie (mur de droite) et ce qu'on y range ---------- */
  function soleShape(L, W, m){ const s = new T.Shape(), y = v => v*W*m; // contour de semelle vu de dessus : talon en x = 0, pointe en x = L ; m = ±1 (pied droit / gauche)
    s.moveTo(0, 0); s.bezierCurveTo(0, y(.44), L*.2, y(.48), L*.4, y(.42)); s.bezierCurveTo(L*.62, y(.36), L*.8, y(.54), L*.95, y(.36));
    s.bezierCurveTo(L*1.02, y(.2), L*1.02, y(-.18), L*.95, y(-.34)); s.bezierCurveTo(L*.8, y(-.5), L*.56, y(-.36), L*.4, y(-.38)); s.bezierCurveTo(L*.2, y(-.46), 0, y(-.42), 0, 0); return s; }
  const light = c => { const n = parseInt(c.slice(1), 16); return ((n >> 16)*.3 + (n >> 8 & 255)*.59 + (n & 255)*.11) > 150; };
  function shoe(color, bike, m){ // chaussure de course (semelle épaisse, lacets) ou de vélo (semelle carbone, molette, cale) ; pointe vers +x
    const g = new T.Group(), L = bike ? .27 : .285, W = bike ? .095 : .105, sh = soleShape(L, W, m), up = std('k' + color, { color, roughness: .55 }), acc = light(color) ? M().blk : std('kwhite', { color: '#f4f1ea', roughness: .6 });
    const ext = (h, b) => { const geo = new T.ExtrudeGeometry(sh, { depth: h, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 10 }); geo.rotateX(-Math.PI/2); return geo; };
    let y0;
    if (bike) { mesh(ext(.008, .003), M().blk, g, 0, .003, 0); box(.06, .01, .06, std('cleat', { color: '#e63946', roughness: .5 }), g, L*.64, .002, 0); y0 = .016; }
    else { mesh(ext(.006, .002), M().rub, g, 0, .002, 0); mesh(ext(.026, .005), std('midsole', { color: '#eeeae2', roughness: .7 }), g, 0, .012, 0); y0 = .044; }
    const h = bike ? .07 : .085, cx = L*.5, a = L*.5, tilt = .1, top = (x, dz = 0) => y0 - .004 + h*Math.sqrt(Math.max(0, 1 - ((x - cx)/a)**2 - (dz/(W*.43))**2)) + (cx - x)*tilt;
    const u = mesh(new T.SphereGeometry(1, 24, 12, 0, Math.PI*2, 0, Math.PI/2), up, g, cx, y0 - .004, 0); u.scale.set(a, h, W*.43); u.rotation.z = -tilt;
    const neck = mesh(new T.CylinderGeometry(1, 1, .004, 20), M().blk, g, L*.25, top(L*.25) - .002, 0, false); neck.scale.set(L*.12, 1, W*.27); neck.rotation.z = -tilt; // ouverture du col
    box(.022, .045, .03, acc, g, .006, y0 + .03, 0); // languette de talon
    if (bike) { cyl(.016, .016, .012, M().blk, g, L*.56, top(L*.56) + .003, 0, 20).rotation.z = -tilt*2; box(.008, .006, W*.8, acc, g, L*.7, top(L*.7) - .002, 0).rotation.z = -tilt*3; }
    else for (let i = 0; i < 4; i++) { const x = L*(.5 + i*.07); box(.008, .004, W*.42, std('lace', { color: '#f4f1ea', roughness: .8 }), g, x, top(x) + .001, 0).rotation.z = -tilt*(1 + i); }
    return g;
  }
  function shoePair(color, bike){ const g = new T.Group(), a = shoe(color, bike, 1), b = shoe(color, bike, -1); a.position.set(0, 0, -.055); b.position.set(.015, 0, .055); g.add(a, b);
    box(.3, .14, .23, HIT(), g, .15, .07, 0, false).userData.hit = true; return g; }
  function helmet(color){ // casque route : coque allongée, aérations, liseré du calotin ; avant vers +x
    const g = new T.Group(), r = .13, sx = 1.2, sz = .95, sh = mesh(new T.SphereGeometry(r, 32, 16, 0, Math.PI*2, 0, Math.PI*.55), std('kh' + color, { color, roughness: .3, metalness: .05 }), g); sh.scale.set(sx, .8, sz);
    const y = (x, z) => .8*Math.sqrt(Math.max(0, r*r - (x/sx)**2 - (z/sz)**2));
    for (const dz of [-.055, 0, .055]) for (const dx of [-.06, .045]) box(.055, .012, .016, M().blk, g, dx, y(dx, dz) - .003, dz);
    const rim = tor(r, .007, M().blk, g, 0, .005, 0, 48); rim.rotation.x = Math.PI/2; rim.scale.set(sx, sz, 1);
    box(.3, .15, .24, HIT(), g, 0, .06, 0, false).userData.hit = true; return g; }
  const WEAR_PTS = { // silhouettes vues de face, cintre en (0, 0)
    maillot: [[-.07, 0], [-.19, -.03], [-.3, -.15], [-.245, -.215], [-.2, -.175], [-.2, -.6], [.2, -.6], [.2, -.175], [.245, -.215], [.3, -.15], [.19, -.03], [.07, 0]],
    veste: [[-.07, 0], [-.19, -.03], [-.27, -.12], [-.3, -.56], [-.24, -.575], [-.215, -.2], [-.21, -.63], [.21, -.63], [.215, -.2], [.24, -.575], [.3, -.56], [.27, -.12], [.19, -.03], [.07, 0]],
    cuissard: [[-.13, -.005], [-.08, -.005], [-.06, -.24], [.06, -.24], [.08, -.005], [.13, -.005], [.17, -.3], [.19, -.58], [.04, -.6], [0, -.46], [-.04, -.6], [-.19, -.58], [-.17, -.3]],
    trifonction: [[-.07, 0], [-.14, -.01], [-.17, -.12], [-.155, -.4], [-.18, -.76], [-.04, -.78], [0, -.62], [.04, -.78], [.18, -.76], [.155, -.4], [.17, -.12], [.14, -.01], [.07, 0]] };
  const BAND = { maillot: [.4, -.26], veste: [.42, -.28], trifonction: [.31, -.22], cuissard: [.2, -.28] }; // bande de poitrine (ceinture du cuissard) : largeur, hauteur
  function garment(x){ // tenue sur son cintre, face avant vers +z
    const g = new T.Group(), type = WEAR_PTS[x.type] ? x.type : 'maillot', P = WEAR_PTS[type], s = new T.Shape(); s.moveTo(...P[0]); for (const p of P.slice(1)) s.lineTo(...p);
    if (type === 'cuissard') s.lineTo(...P[0]); else s.quadraticCurveTo(0, -.07, ...P[0]);
    const geo = new T.ExtrudeGeometry(s, { depth: .02, bevelEnabled: true, bevelThickness: .008, bevelSize: .006, bevelSegments: 2, curveSegments: 6 }); geo.translate(0, 0, -.01);
    mesh(geo, std('kw' + x.color, { color: x.color, roughness: .75 }), g); const [bw, by] = BAND[type];
    box(bw, type === 'cuissard' ? .03 : .05, .004, light(x.color) ? std('kband', { color: '#2b2f36', roughness: .7 }) : std('kwhite', { color: '#f4f1ea', roughness: .6 }), g, 0, by, .0195);
    const wood = std('hanger', { color: '#8a6a45', roughness: .55 }), bar = (x0, y0, x1, y1) => { const o = box(Math.hypot(x1 - x0, y1 - y0), .016, .02, wood, g, (x0 + x1)/2, (y0 + y1)/2, 0); o.rotation.z = Math.atan2(y1 - y0, x1 - x0); };
    bar(-.2, -.035, 0, .015); bar(0, .015, .2, -.035); cyl(.003, .003, .05, M().chrome, g, 0, .045, 0, 8); const hk = tor(.016, .003, M().chrome, g, -.016, .075, 0, 20, Math.PI*1.3); hk.rotation.z = -.4;
    box(.44, .8, .06, HIT(), g, 0, -.38, 0, false).userData.hit = true; return g; }
  const woodM = (seed, base) => new T.MeshStandardMaterial({ map: ctex(512, 128, (x, w, h) => planks(x, w, h, { base, n: 2, seed, grain: 14, vary: .03 }), { rot: Math.PI/2 }), roughness: .62, envMapIntensity: .4 });
  function buildShoeRack(g){ // repère du mur de gauche : x vers la pièce, z le long du mur
    const wood = woodM(67, [196, 160, 118]), D = .32, W = .62, H = 1.0;
    A.occ.push(box(.012, H, W, wood, g, .006, H/2, 0, false)); for (const s of [-1, 1]) box(D, H, .02, wood, g, D/2, H/2, s*(W/2 - .01));
    box(D, .05, W, wood, g, D/2, H - .025, 0); box(D - .01, .06, W - .04, wood, g, D/2, .03, 0); for (const y of [.35, .67]) box(D - .01, .02, W - .04, wood, g, D/2, y, 0);
    const sg = sign('RUN', .15, .042); sg.rotation.y = Math.PI/2; sg.position.set(D + .002, H - .025, 0); g.add(sg);
    const inner = new T.Group(); g.add(inner); g.userData.pick = { kind: 'shoes' }; return { inner };
  }
  function buildWardrobe(g){ // repère du mur de droite : -x vers la pièce, z le long du mur
    const m = M(), wood = woodM(71, [226, 214, 196]), D = .42, W = 1.7, H = 2.12;
    A.occ.push(box(.014, H, W, wood, g, -.007, H/2, 0, false)); for (const s of [-1, 1]) box(D, H, .026, wood, g, -D/2, H/2, s*(W/2 - .013));
    box(D, .028, W, wood, g, -D/2, H - .014, 0); box(.03, .12, W, wood, g, -D + .015, H - .06, 0); box(D - .02, .06, W - .05, wood, g, -D/2, .03, 0);
    box(D - .03, .022, W - .05, wood, g, -D/2 + .005, 1.86, 0); box(D - .03, .022, W - .05, wood, g, -D/2 + .005, .33, 0); // étagères des casques et des chaussures
    cyl(.012, .012, W - .06, m.chrome, g, -.21, 1.78, 0, 16).rotation.x = Math.PI/2; // tringle
    box(.3, .2, .44, std('carton', { color: '#b98a58', roughness: .9 }), g, -.21, .16, -.5); box(.3, .18, .4, std('bluebox', { color: '#2f5fb8', roughness: .6 }), g, -.21, .15, .05); box(.28, .16, .36, std('whitebox', { color: '#ece8e0', roughness: .8 }), g, -.21, .14, .55);
    box(.012, .006, W - .1, A.mats.led, g, -D + .045, H - .124, 0, false);
    const sg = sign('TENUES', .3, .066); sg.rotation.y = -Math.PI/2; sg.position.set(-D - .002, H - .06, 0); g.add(sg);
    const inner = new T.Group(); g.add(inner); g.userData.pick = { kind: 'wardrobe' }; return { inner };
  }
  function kitObj(o, parent, l, id){ o.userData.pick = { kind: 'kit', list: l, id }; parent.add(o); A.K[id] = o; return o; }
  function fillKit(){
    if (!A?.shoes) return; const k = K();
    for (const f of [A.shoes, A.ward]) while (f.inner.children.length) f.inner.remove(f.inner.children[0]); A.K = {};
    k.run.slice(0, KMAX.run).forEach((s, i) => { const [y, z] = RUN_SLOTS[i]; kitObj(shoePair(s.color, false), A.shoes.inner, 'run', s.id).position.set(.025, y + .002, z); });
    const wr = k.wear.slice(0, KMAX.wear), hs = k.helmets.slice(0, KMAX.helmets), bs = k.bshoes.slice(0, KMAX.bshoes);
    wr.forEach((c, i) => { const o = kitObj(garment(c), A.ward.inner, 'wear', c.id); o.position.set(-.21, 1.705, (i - (wr.length - 1)/2)*.18 - .04); o.rotation.y = -.7; }); // tringle : tenues centrées, de biais
    hs.forEach((h, i) => { const o = kitObj(helmet(h.color), A.ward.inner, 'helmets', h.id); o.position.set(-.2, 1.871, KIT3(hs.length)[i]); o.rotation.y = Math.PI/2; });
    bs.forEach((s, i) => { const o = kitObj(shoePair(s.color, true), A.ward.inner, 'bshoes', s.id); o.position.set(-.1, .343, KIT3(bs.length)[i] + .08); o.rotation.y = Math.PI*.75; }); // de trois quarts
    A.shadows = true; wake();
  }

  /* ---------- télé : kilomètres de chaque vélo en service (mur du fond) ---------- */
  function tvRows(){ if (!hasG()) return []; let all; try { all = Garage.rides(); } catch (e) { return []; }
    return bikesOn().map(b => { const s = Garage.stats(b, Garage.ridesOf(b, all)); return { id: b.id, name: b.name || 'Vélo', road: s.road, ht: s.ht, total: s.total, month: s.month, est: s.est }; }).sort((a, b) => b.total - a.total); }
  const kmN = n => Math.round(n).toLocaleString('fr-FR').replace(/\s/g, ' ');
  function buildTV(g){
    const m = M(), c = document.createElement('canvas'); c.width = TV.cw; c.height = TV.ch;
    const map = new T.CanvasTexture(c); map.encoding = T.sRGBEncoding; map.anisotropy = A.aniso;
    box(.42, .24, .025, m.steel, g, 0, TV.y, .0125); A.occ.push(box(TV.w, TV.h, .03, m.blk, g, 0, TV.y, .04));
    const sc = mesh(new T.PlaneGeometry(TV.w - .024, (TV.w - .024)*9/16), new T.MeshBasicMaterial({ map, toneMapped: false }), g, 0, TV.y + .004, .0556, false); sc.receiveShadow = false;
    box(.008, TV.y - TV.h/2 - .3, .006, m.blk, g, .3, (TV.y - TV.h/2 + .3)/2, .006, false); box(.08, .08, .01, std('prise', { color: '#ece8e0', roughness: .5 }), g, .3, .28, .005, false); // câble et prise
    g.userData.pick = { kind: 'tv' }; return { map, sig: null };
  }
  function tvDraw(){ const tv = A.tv; if (!tv) return; const rows = tvRows(), sig = JSON.stringify(rows.map(r => [r.name, Math.round(r.road), Math.round(r.ht)])); if (tv.sig === sig) return; tv.sig = sig;
    const x = tv.map.image.getContext('2d'), W = TV.cw, H = TV.ch, F = Bike3D.FONTS, L = 56, Rt = W - 56, INK = '#f4f4f2', MUTED = '#a3abb8';
    const rr = (px, y, w, h, r) => { r = Math.min(r, w/2, h/2); x.beginPath(); x.moveTo(px + r, y); x.arcTo(px + w, y, px + w, y + h, r); x.arcTo(px + w, y + h, px, y + h, r); x.arcTo(px, y + h, px, y, r); x.arcTo(px, y, px + w, y, r); x.closePath(); x.fill(); };
    const fit = (txt, f, px, max, min = px*.55) => { x.font = font(f, px); while (x.measureText(txt).width > max && px > min) x.font = font(f, px -= 2); if (x.measureText(txt).width <= max) return txt; let t = txt; while (t && x.measureText(t + '…').width > max) t = t.slice(0, -1); return t + '…'; };
    x.fillStyle = '#12141a'; x.fillRect(0, 0, W, H); x.textBaseline = 'alphabetic'; x.textAlign = 'left';
    x.fillStyle = MUTED; x.font = font(F.tech, 30); x.fillText('K I L O M È T R E S', L, 70);
    const sum = rows.reduce((s, r) => s + r.total, 0), hero = kmN(sum); x.fillStyle = INK; x.font = font(F.sport, 108); x.fillText(hero, L, 168); const hw = x.measureText(hero).width; x.font = font(F.sport, 50); x.fillText('km', L + hw + 16, 168);
    x.textAlign = 'right'; x.font = font(F.tech, 28); let lx = Rt; for (const [t, c] of [['HOME TRAINER', TV.ht], ['ROUTE', TV.road]]) { x.fillStyle = MUTED; x.fillText(t, lx, 70); lx -= x.measureText(t).width + 16; x.fillStyle = c; rr(lx - 26, 48, 26, 22, 5); lx -= 62; }
    x.textAlign = 'left';
    if (!rows.length) { x.fillStyle = MUTED; x.font = font(F.sport, 54); x.fillText('Aucun vélo au garage', L, 340); tv.map.needsUpdate = true; A.shadows = true; return wake(); }
    const more = rows.length > 4 ? rows.length - 4 : 0, shown = rows.slice(0, 4), y0 = 214, yEnd = more ? 650 : 694, rh = Math.min(240, (yEnd - y0)/shown.length), big = rh >= 140, huge = rh >= 200, max = Math.max(1, rows[0].total), bw = Rt - L;
    shown.forEach((r, i) => { const y = y0 + i*rh, px = huge ? 62 : big ? 52 : 42, base = y + px, tot = kmN(r.total) + ' km', bh = huge ? 34 : big ? 26 : 20, by = base + 14;
      x.textAlign = 'right'; x.fillStyle = INK; x.font = font(F.sport, px); x.fillText(tot, Rt, base); const tw = x.measureText(tot).width; x.textAlign = 'left'; x.fillText(fit(r.name, F.sport, px, bw - tw - 40), L, base);
      x.fillStyle = '#23272f'; rr(L, by, bw, bh, 7); const seg = [[r.road, TV.road], [r.ht, TV.ht]].filter(a => a[0] > 0), gap = seg.length > 1 ? 4 : 0, full = bw*r.total/max; let sx = L;
      for (const [km, c] of seg) { const w = Math.max(10, (full - gap)*km/r.total); x.fillStyle = c; rr(sx, by, w, bh, 7); sx += w + gap; }
      if (big) { x.fillStyle = MUTED; x.font = font(F.sport, huge ? 34 : 30); x.fillText(`${kmN(r.road)} route   ·   ${r.est ? '≈ ' : ''}${kmN(r.ht)} home trainer`, L, by + bh + 36); } });
    if (more) { x.fillStyle = MUTED; x.font = font(F.tech, 27); x.fillText(`+ ${more} autre${more > 1 ? 's' : ''} vélo${more > 1 ? 's' : ''}`, L, 692); }
    tv.map.needsUpdate = true; wake(); }

  /* ---------- position des meubles ---------- */
  function setGroup(k, L = lay(k)){ const g = A.groups[k], it = ITEMS[k];
    if (it.floor) { g.position.set(L.x, 0, L.z); g.rotation.y = (L.r || 0)*D2R; }
    else if (it.wall === 'left') g.position.set(ROOM.x0, 0, L.z); else if (it.wall === 'right') g.position.set(ROOM.x1, 0, L.z); else g.position.set(L.x, 0, ROOM.zb);
    g.updateMatrixWorld(true); A.shadows = true; }
  // empreinte au sol (rectangle orienté, repère monde x / z) : sert aux collisions de l'aménagement
  function rectOf(k, L = lay(k)){ const it = ITEMS[k];
    if (it.floor) { const r = (L.r || 0)*D2R, c = Math.cos(r), s = Math.sin(r); return { x: L.x + it.cx*c + it.cz*s, z: L.z - it.cx*s + it.cz*c, hw: it.w/2, hd: it.d/2, r }; }
    if (it.wall === 'back') return { x: L.x, z: ROOM.zb + it.d/2, hw: it.w/2, hd: it.d/2, r: 0 };
    return { x: it.wall === 'left' ? ROOM.x0 + it.d/2 : ROOM.x1 - it.d/2, z: L.z, hw: it.d/2, hd: it.w/2, r: 0 }; }
  const axesOf = R => [[Math.cos(R.r), -Math.sin(R.r)], [Math.sin(R.r), Math.cos(R.r)]];
  const corners = R => { const [ax, az] = axesOf(R); return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([i, j]) => [R.x + ax[0]*R.hw*i + az[0]*R.hd*j, R.z + ax[1]*R.hw*i + az[1]*R.hd*j]); };
  function overlap(a, b){ const pa = corners(a), pb = corners(b);
    for (const R of [a, b]) for (const [ux, uz] of axesOf(R)) { const pr = P => P.map(([x, z]) => x*ux + z*uz), u = pr(pa), v = pr(pb);
      if (Math.max(...u) <= Math.min(...v) + .005 || Math.max(...v) <= Math.min(...u) + .005) return false; }
    return true; }
  const inside = R => corners(R).every(([x, z]) => x >= ROOM.x0 - 1e-6 && x <= ROOM.x1 + 1e-6 && z >= ROOM.zb - 1e-6 && z <= ROOM.zf - .3);
  function valid(k, L){ const R = rectOf(k, L); if (!inside(R) || FIXED.some(F => overlap(R, F))) return false; for (const o in ITEMS) if (o !== k && overlap(R, rectOf(o))) return false; return true; }
  // meuble arrivé avec une mise à jour (podium d'exposition) : si sa place par défaut est prise par un meuble déplacé, la place libre la plus proche
  function ensureFree(k){ if (G().layout[k] || valid(k, lay(k))) return; const L0 = lay(k), it = ITEMS[k], C = [];
    for (let x = ROOM.x0; x <= ROOM.x1; x += .1) for (let z = ROOM.zb; z <= ROOM.zf; z += .1) for (const r of [L0.r || 0, ((L0.r || 0) + 450) % 360]) C.push({ x: +x.toFixed(2), z: +z.toFixed(2), r });
    const dist = L => Math.hypot(L.x - (L0.x ?? L.x), L.z - (L0.z ?? L.z)), ok = C.sort((a, b) => dist(a) - dist(b)).find(L => valid(k, L)); // meuble mural : seule sa position le long du mur compte
    if (ok) { G().layout[k] = it.floor ? ok : it.wall === 'back' ? { x: ok.x } : { z: ok.z }; save(); } }

  /* ---------- rendu, envols, effets ---------- */
  const flights = new Map(), tweens = [];
  function place(obj, parent, pos, quat, anim){
    const d = obj.userData.dest;
    if (d && d.parent === parent && d.pos.distanceToSquared(pos) < 1e-8 && Math.abs(d.quat.dot(quat)) > .99999) return false;
    obj.userData.dest = { parent, pos: pos.clone(), quat: quat.clone() }; obj.visible = true;
    if (!anim) { flights.delete(obj); parent.add(obj); obj.position.copy(pos); obj.quaternion.copy(quat); A.shadows = true; return true; }
    A.scene.attach(obj);
    flights.set(obj, { t0: performance.now() + (anim.delay || 0), dur: anim.dur || 1000, lift: anim.lift ?? .3, p0: obj.position.clone(), q0: obj.quaternion.clone(), done: anim.done, pop: anim.pop !== false });
    wake(); return true;
  }
  function stepFlights(now){ const _m = A._m, _p = A._p, _q = A._q, _s = A._s;
    for (const [obj, f] of flights) { const k = clamp((now - f.t0)/f.dur, 0, 1), e = ease(k), d = obj.userData.dest;
      d.parent.updateWorldMatrix(true, false); _m.compose(d.pos, d.quat, A.ONE).premultiply(d.parent.matrixWorld); _m.decompose(_p, _q, _s);
      obj.position.lerpVectors(f.p0, _p, e); obj.position.y += Math.sin(Math.PI*e)*f.lift; obj.quaternion.slerpQuaternions(f.q0, _q, e);
      if (k >= 1) { flights.delete(obj); d.parent.add(obj); obj.position.copy(d.pos); obj.quaternion.copy(d.quat); if (f.pop) burst(obj); f.done?.(); } }
    if (flights.size) A.shadows = true; return flights.size > 0;
  }
  function tween(dur, fn, done, delay = 0){ tweens.push({ t0: performance.now() + delay, dur, fn, done }); wake(); }
  function stepTweens(now){ for (let i = tweens.length - 1; i >= 0; i--) { const tw = tweens[i], k = clamp((now - tw.t0)/tw.dur, 0, 1); tw.fn(ease(k)); if (k >= 1) { tweens.splice(i, 1); tw.done?.(); } } return tweens.length > 0; }
  function sphereOf(obj){ if (!obj.userData.lsph) { obj.updateWorldMatrix(true, true); const b = new T.Box3().setFromObject(obj), s = b.getBoundingSphere(new T.Sphere()); obj.userData.lsph = { c: obj.worldToLocal(s.center.clone()), r: s.radius }; }
    return { center: obj.localToWorld(obj.userData.lsph.c.clone()), radius: obj.userData.lsph.r }; }
  function burst(obj){ const s = sphereOf(obj), m = new T.Mesh(A.ringGeo, new T.MeshBasicMaterial({ color: col('#ff8a4c'), transparent: true, opacity: .85, depthTest: false, side: T.DoubleSide }));
    m.renderOrder = 998; m.position.copy(s.center); m.userData = { r: s.radius, t0: performance.now() }; A.scene.add(m); A.bursts.push(m); wake(); }
  function stepBursts(now){ for (let i = A.bursts.length - 1; i >= 0; i--) { const m = A.bursts[i], k = (now - m.userData.t0)/560;
      if (k >= 1) { A.scene.remove(m); m.material.dispose(); A.bursts.splice(i, 1); continue; } m.scale.setScalar(m.userData.r*(1 + .45*ease(k))); m.material.opacity = .85*(1 - k); m.quaternion.copy(A.cam.quaternion); }
    return A.bursts.length > 0; }
  function haloObj(){ const s = st.sel; if (st.mode !== 'atelier' || !s) return null; if (s.kind === 'pair') return A.W[s.id]?.[s.part || 'rear']; if (s.kind === 'cassette') return A.C[s.id]; if (s.kind === 'kit') return A.K[s.id]; return null; }
  let raf = 0, last = 0, busyUntil = 0, dragging = false;
  function wake(ms = 300){ if (!A) return; busyUntil = Math.max(busyUntil, performance.now() + (FAST ? 0 : ms)); if (!raf) raf = requestAnimationFrame(loop); }
  function loop(now){
    raf = 0; if (!A?.R) return; const dt = Math.min(.05, (now - (last || now))/1000); last = now;
    const a = stepFlights(now), b = stepTweens(now), c = stepBursts(now), m = stepRig(dt); applyRig();
    const ho = haloObj(), h = A.halo; if (ho) { const s = sphereOf(ho); h.visible = true; h.position.copy(s.center); h.scale.setScalar(s.radius*1.08); h.quaternion.copy(A.cam.quaternion); } else h.visible = false;
    if (A.shadows) { A.R.shadowMap.needsUpdate = true; A.shadows = false; }
    A.R.render(A.scene, A.cam); placeTags();
    if (a || b || c || m || dragging || now < busyUntil) raf = requestAnimationFrame(loop); else last = 0;
  }

  /* ---------- caméra : regarder autour (vue d'ensemble) ou tourner autour d'un objet ---------- */
  const ui = { top: 70, bottom: 150 };
  const rig = { cur: null, goal: null, spec: null, style: 'look', base: { az: 0, el: 0 }, free: false };
  const dirOf = (az, el) => V3(Math.sin(az)*Math.cos(el), Math.sin(el), Math.cos(az)*Math.cos(el));
  function maxDist(t, d){ if (rig.free) return 14; let m = 9; for (const k of ['x', 'y', 'z']) { const [lo, hi] = CAMBOX[k], v = d[k]; if (v > 1e-6) m = Math.min(m, (hi - t[k])/v); else if (v < -1e-6) m = Math.min(m, (lo - t[k])/v); } return Math.max(.3, m); }
  const wp = (o, x, y, z) => o.localToWorld(V3(x, y, z));
  const ZONES = {
    home:    { l: 'Ensemble', s: () => { const h = wp(A.groups.ht, .35, .85, -.55), bz = wp(A.groups.bench, 0, .85, .9); return { t: h.lerp(bz, .3), az: 24, el: 15, w: 2.5, h: 2.2, look: true }; } },
    trainer: { l: 'Home trainer', s: () => ({ t: wp(A.groups.ht, 0, .56, 0), az: 36 + (lay('ht').r || 0), el: 20, w: 1.95, h: 1.15 }) },
    rack:    { l: 'Rack', s: () => { const ys = rackYs(); return { t: wp(A.groups.rack, 0, ys.length > 1 ? 1.25 : 1.45, .28), az: -16, el: 6, w: 1.95, h: ys.length > 1 ? 2.3 : 1.45 }; } },
    tv:      { l: 'Télé', s: () => ({ t: wp(A.groups.tv, 0, TV.y, .05), az: 0, el: 2, w: 1.12, h: .68 }) },
    expo:    { l: 'Exposition', s: () => ({ t: wp(A.groups.expo, 0, .6, 0), az: 8 + (lay('expo').r || 0), el: 9, w: 2.05, h: 1.25 }) }, // de profil, côté transmission
    wheels:  { l: 'Roues', s: () => ({ t: wp(A.groups.wheels, 0, 1.6, 0), az: 90, el: 2, w: 2.3, h: 1.8, maxD: 2.2 }) },
    pegs:    { l: 'Cassettes', s: () => ({ t: wp(A.groups.bench, -.07, 1.5, 0), az: 0, el: 6, w: 1.75, h: .75 }) },
    shelf:   { l: 'Pièces', s: () => ({ t: wp(A.groups.shelf, 0, 1.42, 0), az: -90, el: 6, w: 2.0, h: 1.65 }) },
    wardrobe: { l: 'Penderie', s: () => ({ t: wp(A.groups.wardrobe, -.21, 1.12, 0), az: -90, el: 10, w: 1.85, h: 2.2, maxD: 2.6 }) },
    shoes:   { l: 'Chaussures', s: () => ({ t: wp(A.groups.shoes, .16, .55, 0), az: 90, el: 12, w: .95, h: 1.15, maxD: 2.0 }) },
    stand:   { s: () => ({ t: wp(A.groups.stand, 0, .84, 0), az: 12 + (lay('stand').r || 0), el: 14, w: 1.9, h: 1.25 }) },
    explode: { s: () => ({ t: A.panel.localToWorld(V3(0, 0, 0)).setY(PANEL.y), az: 0, el: 0, w: 2.08, h: 2.5 }) },
    plan:    { s: () => ({ t: V3(0, .8, -.1), az: 0, el: 66, w: 5.75, h: 4.6, free: true }) },
  };
  const HOME_WIDE = () => ({ t: V3(-.3, .95, -.7), az: 10, el: 15, w: 4.4, h: 2.4, look: true });
  function frameSpec(sp){
    const w = A.el.clientWidth || innerWidth, h = A.el.clientHeight || innerHeight, hv = Math.max(140, h - ui.top - ui.bottom), aspect = w/hv;
    const tgt = sp.t.clone(), az = sp.az*D2R, el = sp.el*D2R, dir = dirOf(az, el), tf = Math.tan(31*D2R); rig.free = !!sp.free;
    let d = Math.max(sp.h/2/tf, sp.w/2/(tf*aspect))*1.04; d = Math.min(d, maxDist(tgt, dir), sp.maxD || 14);
    let tn = Math.max(sp.h/2/d, sp.w/2/(d*aspect))*1.04, fov = 2*Math.atan(tn*h/hv)/D2R;
    if (fov > 78) { fov = 78; tn = Math.tan(39*D2R)*hv/h; d = Math.min(Math.max(sp.h/2/tn, sp.w/2/(tn*aspect))*1.04, maxDist(tgt, dir), sp.maxD || 14); }
    return { tgt, az, el, d, fov: Math.max(24, fov), oy: (ui.bottom - ui.top)/2 };
  }
  function go(zone, quick){
    if (!A?.R) return; let sp;
    if (typeof zone === 'string') { if (st.mode === 'atelier' && ZONES[zone]?.l) st.zone = zone; sp = zone === 'home' && innerWidth > innerHeight*1.15 ? HOME_WIDE() : ZONES[zone].s(); }
    else sp = zone;
    rig.spec = sp; rig.style = sp.look ? 'look' : 'orbit'; const f = frameSpec(sp); rig.goal = f; rig.base = { az: f.az, el: f.el };
    if (!rig.cur || quick || FAST) rig.cur = { ...f, tgt: f.tgt.clone() };
    renderDock(); tagsRebuild(); wake(1800);
  }
  function refocus(){ if (!rig.spec || !A?.R) return; const f = frameSpec(rig.spec); rig.goal = f; rig.base = { az: f.az, el: f.el }; if (FAST) rig.cur = { ...f, tgt: f.tgt.clone() }; wake(1500); }
  function stepRig(dt){
    const c = rig.cur, g = rig.goal; if (!c) return false; const k = 1 - Math.exp(-dt*3.8);
    c.tgt.lerp(g.tgt, k); let da = g.az - c.az; da = Math.atan2(Math.sin(da), Math.cos(da)); c.az += da*k; c.el = lerp(c.el, g.el, k); c.d = lerp(c.d, g.d, k); c.fov = lerp(c.fov, g.fov, k); c.oy = lerp(c.oy, g.oy, k);
    return c.tgt.distanceToSquared(g.tgt) > 1e-6 || Math.abs(da) > 1e-4 || Math.abs(c.el - g.el) > 1e-4 || Math.abs(c.d - g.d) > 1e-4 || Math.abs(c.fov - g.fov) > .01 || Math.abs(c.oy - g.oy) > .3;
  }
  function applyRig(){ const c = rig.cur, cam = A.cam; if (!c) return; const w = A.el.clientWidth || innerWidth, h = A.el.clientHeight || innerHeight;
    cam.position.copy(c.tgt).addScaledVector(dirOf(c.az, c.el), c.d); cam.lookAt(c.tgt); cam.fov = c.fov; cam.aspect = w/h; cam.setViewOffset(w, h, 0, c.oy, w, h); cam.updateProjectionMatrix(); }
  function rotateBy(dx, dy){
    const c = rig.cur, g = rig.goal, b = rig.base; if (!c) return;
    if (rig.style === 'look') { const P = c.tgt.clone().addScaledVector(dirOf(c.az, c.el), c.d), az = clamp(c.az + dx*.0045, b.az - 1.2, b.az + 1.2), el = clamp(c.el - dy*.0035, -.38, .8);
      c.az = g.az = az; c.el = g.el = el; c.tgt.copy(P).addScaledVector(dirOf(az, el), -c.d); g.tgt.copy(c.tgt); }
    else { const span = st.mode === 'arrange' ? Math.PI : 1.25, az = clamp(c.az - dx*.006, b.az - span, b.az + span), el = clamp(c.el + dy*.005, st.mode === 'arrange' ? .35 : -.06, st.mode === 'arrange' ? 1.45 : 1.05);
      c.az = g.az = az; c.el = g.el = el; c.d = g.d = Math.min(g.d, maxDist(c.tgt, dirOf(az, el))); }
    wake();
  }
  function zoomBy(f){ const c = rig.cur, g = rig.goal; if (!c) return;
    if (rig.style === 'look') c.fov = g.fov = clamp(c.fov*f, 26, 88); else c.d = g.d = clamp(c.d*f, .35, maxDist(c.tgt, dirOf(c.az, c.el))); wake(); }

  /* ---------- gestes ---------- */
  const ptrs = new Map(); let drag = null, pinch = null, hoverT = 0;
  function rayAt(x, y){ const r = A.cv.getBoundingClientRect(); A.ndc.set((x - r.left)/r.width*2 - 1, -((y - r.top)/r.height)*2 + 1); A.ray.setFromCamera(A.ndc, A.cam); return A.ray; }
  function hitsAt(x, y, list){ return rayAt(x, y).intersectObjects(list, true).filter(h => { for (let o = h.object; o; o = o.parent) if (!o.visible) return false; return !h.object.isLine; }); }
  const pickOf = o => { while (o && !o.userData.pick) o = o.parent; return o ? o.userData.pick : null; };
  function pickAt(x, y){ const hs = hitsAt(x, y, [...A.pick, ...A.occ]);
    if (st.zone === 'wardrobe' || st.zone === 'shoes') for (const h of hs) { const p = pickOf(h.object); if (p && ['kit', 'wardrobe', 'shoes'].includes(p.kind)) return p; } // devant la penderie : le vélo exposé ne cache pas les tenues
    return hs.length ? pickOf(hs[0].object) : null; }
  function partAt(x, y){
    const id = st.onStand; if (!id || !A.B[id]) return null; const list = st.mode === 'explode' ? A.exp.map(e => e.obj) : [A.B[id].holder];
    for (const h of hitsAt(x, y, [...list, ...A.occ])) { if (h.object.userData.bikeHit) continue; for (let o = h.object; o; o = o.parent) { if (o.userData.g) return o.userData.g; const p = o.userData.pick;
      if (p?.kind === 'pair') return p.part === 'front' ? 'wheelF' : 'wheelR'; if (p?.kind === 'cassette') return 'cassette'; } return null; }
    return null;
  }
  const floorAt = (x, y) => rayAt(x, y).ray.intersectPlane(A.floorPlane, V3());
  function itemAt(x, y){ for (const h of hitsAt(x, y, Object.values(A.foot).map(f => f.mesh))) return h.object.userData.item; return null; }
  function bindGestures(){
    const cv = A.cv;
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture?.(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 1) { drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now(), moved: false };
        if (st.mode === 'arrange') { const k = itemAt(e.clientX, e.clientY); if (k) startMove(k, e.clientX, e.clientY); } dragging = true; }
      else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); drag = null; A.mv = null; } wake(); });
    cv.addEventListener('pointermove', e => {
      if (!ptrs.has(e.pointerId)) { if (e.pointerType === 'mouse' && performance.now() - hoverT > 90) { hoverT = performance.now();
        cv.style.cursor = st.mode === 'arrange' ? (itemAt(e.clientX, e.clientY) ? 'move' : 'grab') : (st.mode === 'atelier' ? pickAt(e.clientX, e.clientY) : partAt(e.clientX, e.clientY)) ? 'pointer' : 'grab'; } return; }
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && ptrs.size >= 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (d > 0) zoomBy(pinch/d); pinch = d; return; }
      if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
      if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 7) drag.moved = true;
      if (!drag.moved) return; if (A.mv) moveTo(e.clientX, e.clientY); else rotateBy(dx, dy); });
    const up = e => { const d = drag; ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null;
      if (!ptrs.size) { drag = null; dragging = false; if (A?.mv) endMove(); if (d && !d.moved && performance.now() - d.t < 500 && e.type === 'pointerup') tap(e.clientX, e.clientY); } };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', e => { e.preventDefault(); zoomBy(Math.exp(e.deltaY*.0012)); }, { passive: false });
  }
  function tap(x, y){
    if (st.mode === 'arrange') { const k = itemAt(x, y); arrSelect(k); return; }
    if (st.mode === 'atelier') { const p = pickAt(x, y); if (p) select(p); else if (st.sel) closeSheet(); return; }
    const k = partAt(x, y); if (k) partCard(k); else if (st.sel) closeSheet();
  }

  /* ---------- placement : chaque vélo, roue et cassette à sa place ---------- */
  const homeSeat = id => htId() === id ? A.trainer.seat : expoId() === id ? A.expo.seat : A.seats.rack[G().spots.racks.indexOf(id)] || null;
  function destPair(p, part){
    const b = p.bikeId && A.B[p.bikeId], parked = b && htId() === p.bikeId && direct(bikeOf(p.bikeId)) && st.onStand !== p.bikeId;
    if (b && (part === 'front' || !parked)) return { parent: part === 'front' ? b.anchorF : b.anchorR, pos: V3(), quat: Q() };
    if (p.slot == null) return null; return { parent: A.groups.wheels, ...slotPose(p, part) };
  }
  function destCass(c){
    if (c.loc === 'ht') return { parent: A.trainer.anchor, pos: V3(), quat: Q() };
    if (c.loc !== 'wall') { const w = A.W[c.loc]; return w ? { parent: w.rear, pos: V3(), quat: Q() } : null; }
    if (c.peg == null) return null; const b = A.C[c.id].userData.box; return { parent: A.groups.bench, pos: V3(PEGS[c.peg], PEG_Y - .012, .024 - b.min.z), quat: Q() };
  }
  function layout(anim = true){
    if (!A?.R || st.mode === 'explode') return; fixSlots(); fixPegs(); trainerKind(); expoPlate(); tvDraw();
    const AN = anim ? { dur: 1050, lift: .3 } : null; let moved = false, i = 0;
    for (const id in A.B) { const seat = st.onStand === id ? A.stand.seat : homeSeat(id); if (!seat) { A.B[id].holder.visible = false; continue; } if (place(A.B[id].holder, seat, V3(), Q(), AN && { dur: 1500, lift: .3, pop: false })) moved = true; }
    const d0 = moved ? 700 : 0;
    for (const p of G().wheels) for (const part of ['front', 'rear']) { const o = A.W[p.id]?.[part]; if (!o) continue; const d = destPair(p, part);
      if (!d) { o.visible = false; o.userData.dest = null; continue; } if (place(o, d.parent, d.pos, d.quat, AN && { ...AN, delay: d0 + i*110 })) i++; }
    for (const c of G().cass) { const o = A.C[c.id]; if (!o) continue; const d = destCass(c); if (!d) { o.visible = false; o.userData.dest = null; continue; }
      if (place(o, d.parent, d.pos, d.quat, AN && { dur: 950, lift: .22, delay: d0 + i*110 })) i++; }
    A.shadows = true; wake();
  }
  function makeBike(b){
    const V = vOf(b), m = Bike3D.atelier.bike({ look: Bike3D.lookOf(b.look, b.model), model: b.model, variant: { brakes: V.brakes, speeds: V.speeds, di2: V.group === 'di2' } }), h = new T.Group();
    h.add(m.root); h.userData.pick = { kind: 'bike', id: b.id }; A.scene.add(h); A.pick.push(h);
    { const px = new T.Mesh(new T.BoxGeometry(.46, .78, .12), HIT()); px.position.set(.5, .61, 0); px.userData.bikeHit = true; m.root.add(px); } // toucher le cadre sans viser un tube
    h.updateMatrixWorld(true); const cen = k => m.groups[k] ? new T.Box3().setFromObject(m.groups[k]).getCenter(V3()) : null, chB = m.groups.chain && new T.Box3().setFromObject(m.groups.chain);
    const bb = V3(...(m.meta.bb || [.4036, .2675, 0])).add(m.root.position), ht = V3(...(m.meta.ht_top || [.7956, .8275, 0])).add(m.root.position);
    m.local = { chain: chB ? V3(lerp(chB.min.x, chB.max.x, .42), chB.min.y + .012, chB.max.z) : bb.clone(), rd: cen('rd') || bb.clone(), brakeF: cen('brakeF') || ht.clone(), headset: ht.clone().add(V3(.012, -.06, .025)) };
    A.B[b.id] = { ...m, holder: h, bike: b };
  }
  function makePair(p){ const mk = front => { const o = Bike3D.atelier.wheel({ front, depth: front ? p.depth : depthR(p), brakes: p.brakes, tire: p.tire, wall: p.wall, mark: 'FTP' }); o.add(hitDisc(.345, .03));
      o.userData.pick = { kind: 'pair', id: p.id, part: front ? 'front' : 'rear' }; A.scene.add(o); A.pick.push(o); return o; };
    A.W[p.id] = { front: mk(true), rear: mk(false) }; }
  function makeCass(c){ const o = Bike3D.atelier.cassette({ speeds: c.speeds, big: bigOf(c), tint: c.tint }); o.userData.pick = { kind: 'cassette', id: c.id }; A.scene.add(o); o.updateMatrixWorld(true);
    const b0 = new T.Box3().setFromObject(o); o.add(hitDisc(Math.max(b0.max.x, b0.max.y) + .01, b0.max.z - b0.min.z + .02, (b0.max.z + b0.min.z)/2));
    o.userData.box = b0; A.pick.push(o); A.C[c.id] = o; }
  function dropObj(o){ if (!o) return; flights.delete(o); o.parent?.remove(o); const i = A.pick.indexOf(o); if (i >= 0) A.pick.splice(i, 1); }
  function swapObj(o, n){ o.parent.add(n); n.position.copy(o.position); n.quaternion.copy(o.quaternion); flights.delete(o);
    for (const ch of [...o.children]) if (ch.userData.pick?.kind === 'cassette') n.add(ch); dropObj(o); n.userData.dest = null; }
  function rebuildPair(p){ const old = A.W[p.id]; makePair(p); for (const part of ['front', 'rear']) swapObj(old[part], A.W[p.id][part]);
    for (const c of G().cass) if (c.loc === p.id && A.C[c.id]) A.C[c.id].userData.dest = null; layout(false); burst(A.W[p.id].front); burst(A.W[p.id].rear); }
  function rebuildCass(c){ const old = A.C[c.id]; makeCass(c); swapObj(old, A.C[c.id]); layout(false); burst(A.C[c.id]); }

  /* ---------- interface ---------- */
  const q = s => A.el.querySelector(s);
  let toastT = 0;
  function say(msg, kind = 'ok'){ if (!A) return toast(msg); const t = q('.at-toast'); t.querySelector('span').textContent = msg; t.className = 'at-toast show ' + kind; clearTimeout(toastT); toastT = setTimeout(() => { if (A) t.classList.remove('show'); }, 2900); } // la pastille garde sa couleur pendant le fondu
  function measureUI(){ ui.top = q('.at-top').offsetHeight; let b = 0; for (const s of ['.at-dock', '.at-maint', '.at-sheet', '.at-arr']) { const e = q(s); if (!e.hidden) b = Math.max(b, e.offsetHeight); } ui.bottom = b; }
  function panels(){ const sheet = !q('.at-sheet').hidden; q('.at-dock').hidden = sheet || st.mode !== 'atelier'; q('.at-maint').hidden = sheet || !['maint', 'explode'].includes(st.mode); q('.at-arr').hidden = sheet || st.mode !== 'arrange';
    A.el.dataset.mode = st.mode; measureUI(); }
  function updateTop(){
    const t = q('.at-ttl b'), s = q('.at-ttl span'), pg = q('.at-prog');
    if (st.mode === 'atelier') { t.textContent = 'Mon atelier'; const n = bikesOn().filter(b => placed(b.id)).length; s.textContent = `${n} vélo${n > 1 ? 's' : ''} · ${G().wheels.length} paire${G().wheels.length > 1 ? 's' : ''} de roues · ${G().cass.length} cassette${G().cass.length > 1 ? 's' : ''}`; }
    else if (st.mode === 'arrange') { t.textContent = 'Aménager'; s.textContent = 'Faites glisser les meubles, les vélos suivent'; }
    else { const b = bikeOf(st.onStand); t.textContent = st.mode === 'explode' ? 'Vue éclatée' : 'Entretien'; s.textContent = `${b?.name || 'Vélo'} · ${st.mode === 'explode' ? 'touchez un numéro' : "sur le pied d'atelier"}`; }
    pg.hidden = !['maint', 'explode'].includes(st.mode); if (!pg.hidden) { const pts = points(st.onStand); pg.textContent = `${pts.filter(x => x.done).length}/${pts.length}`; }
  }
  function renderDock(){
    const z = q('.at-zones'); if (!z.childElementCount) z.innerHTML = ['home', 'tv', 'trainer', 'rack', 'expo', 'wardrobe', 'shoes', 'wheels', 'pegs', 'shelf'].map(k => `<button type="button" data-at="zone:${k}" data-z="${k}">${ZONES[k].l}</button>`).join('');
    for (const b of z.children) { const on = b.dataset.z === st.zone; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }
    // « Faire un entretien » : le vélo qu'on regarde, sinon celui du home trainer, de l'exposition, puis du rack
    const mb = q('.at-dock [data-at^="maint"]'); if (mb) { const zid = st.zone === 'expo' ? expoId() : st.zone === 'rack' ? G().spots.racks[0] : null, id = zid || htId() || expoId() || G().spots.racks[0];
      mb.dataset.at = 'maint:' + (id || ''); mb.disabled = !id; }
  }
  const X_BTN = `<button type="button" class="at-ib at-x" data-at="close" aria-label="Fermer la fiche"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
  const wearHTML = (w, left) => `<div class="at-wear"><span>${left}</span><b style="color:${wearCol(w)}">${wearTxt(w)} · ${Math.round(w*100)} %</b></div><div class="at-bar"><i style="width:${Math.max(3, w*100)}%;background:${wearCol(w)}"></i></div>`;
  const head = (kick, nameHTML) => `<div class="at-sh-head"><div><div class="at-kick">${kick}</div>${nameHTML}</div>${X_BTN}</div>`;
  const nameInput = (key, v, label) => `<label class="at-ren"><input type="text" class="at-name" data-atname="${key}" value="${esc(v)}" aria-label="${label} (touchez pour renommer)" maxlength="34" enterkeyhint="done"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/></svg></label>`; // nom modifiable : crayon + soulignement
  function openSheet(html){ const sh = q('.at-sheet'); sh.innerHTML = html; sh.hidden = false; sh.scrollTop = 0; panels(); refocus(); tagsRebuild(); }
  function hideSheet(){ q('.at-sheet').hidden = true; st.sel = null; panels(); }
  function closeSheet(){ hideSheet(); if (st.mode === 'atelier') go(st.zone); else go(st.mode === 'explode' ? 'explode' : st.mode === 'arrange' ? 'plan' : 'stand'); }
  const where = p => p.bikeId ? `sur ${bikeOf(p.bikeId)?.name || 'un vélo'}` : `au mur · emplacement ${(p.slot ?? 0) + 1}`;
  function cassWhere(c){ if (c.loc === 'ht') return 'sur le home trainer'; if (c.loc === 'wall') return 'au panneau à outils'; const p = pairOf(c.loc); return p ? `roue AR · ${p.name}` : '—'; }
  const bikesIn = () => bikesOn().filter(b => placed(b.id));

  function pairSheet(p){
    const c = cassOnPair(p.id); let acts = '';
    for (const b of bikesIn()) { if (p.bikeId === b.id) continue; const ok = vOf(b).brakes === p.brakes;
      acts += `<button type="button" class="${ok ? 'at-primary' : 'at-sec'}" data-at="mount:${p.id}:${b.id}"${ok ? '' : ' disabled'}>Monter sur ${esc(b.name)}</button>` + (ok ? '' : `<p class="at-why">${esc(b.name)} a des freins ${brk(vOf(b).brakes)} : paire incompatible</p>`); }
    if (p.bikeId) acts += `<button type="button" class="at-sec" data-at="mount:${p.id}:wall">Raccrocher au mur</button>`;
    const note = p.bikeId && htId() === p.bikeId && direct(bikeOf(p.bikeId)) ? '<p class="at-why">Sur le home trainer direct, la roue arrière attend au mur.</p>' : '';
    openSheet(head('Paire de roues', nameInput('pair:' + p.id, p.name, 'Nom de la paire')) +
      `<p class="at-meta">Jantes ${depthTxt(p)} · flancs ${p.wall === 'beige' ? 'beiges' : 'noirs'} · freins ${brk(p.brakes)} · pneus ${p.tire || 28} mm</p>${wearHTML(pairWear(p), `${fmtKm(pairKm(p))} · ${esc(where(p))}`)}${note}
      <div class="at-acts">${acts}</div>
      <div class="at-kv" style="margin-top:14px"><span>Cassette AR</span><b>${c ? esc(c.name) + ' · ' + c.range : 'Aucune'}</b><button type="button" data-at="pickcass:${p.id}">${c ? 'Changer' : 'Monter'}</button></div>
      <details${pairKm(p) ? '' : ' open'}><summary>Réglages de la paire</summary>
      <div class="at-kv at-wrap"><span>Jante avant</span><div class="at-chips">${DEPTHS.map(d => `<button type="button" class="${d === p.depth ? 'on' : ''}" data-at="depth:${p.id}:${d}" aria-pressed="${d === p.depth}">${d}</button>`).join('')}</div></div>
      <div class="at-kv at-wrap"><span>Jante arrière</span><div class="at-chips">${DEPTHS.map(d => `<button type="button" class="${d === depthR(p) ? 'on' : ''}" data-at="depthr:${p.id}:${d}" aria-pressed="${d === depthR(p)}">${d}</button>`).join('')}</div></div>
      <div class="at-kv at-wrap"><span>Flancs</span><div class="at-chips">${[['noir', 'Noirs'], ['beige', 'Beiges']].map(([k, l]) => `<button type="button" class="${(p.wall || 'noir') === k ? 'on' : ''}" data-at="wall:${p.id}:${k}" aria-pressed="${(p.wall || 'noir') === k}">${l}</button>`).join('')}</div></div>
      <div class="at-kv at-wrap"><span>Freinage</span><div class="at-chips"><button type="button" class="${p.brakes === 'rim' ? 'on' : ''}" data-at="brk:${p.id}:rim">Patins</button><button type="button" class="${p.brakes === 'disc' ? 'on' : ''}" data-at="brk:${p.id}:disc">Disques</button></div></div>
      <div class="at-kv at-wrap"><span>Pneus</span><div class="at-chips">${[25, 28, 30, 32].map(t => `<button type="button" class="${t === (p.tire || 28) ? 'on' : ''}" data-at="tire:${p.id}:${t}">${t} mm</button>`).join('')}</div></div>
      <div class="at-kv"><span>Inventaire</span><b></b><button type="button" class="at-danger" data-at="delpair:${p.id}">Je n'ai plus cette paire</button></div></details>`);
  }
  function cassSheet(c){
    const rows = G().wheels.map(p => { const on = c.loc === p.id, other = cassOnPair(p.id);
      return `<div class="at-li"><div><b>Roue AR · ${esc(p.name)}</b><small>${esc(where(p))}${other && !on ? ' · remplace « ' + esc(other.name) + ' »' : ''}</small></div><button type="button" class="at-mini${on ? ' on' : ''}" data-at="cass:${c.id}:${p.id}"${on ? ' disabled' : ''}>${on ? 'Montée' : 'Monter'}</button></div>`; });
    const ht = cassOnHT(), hb = bikeOf(htId());
    if (hb && direct(hb)) rows.push(`<div class="at-li"><div><b>Home trainer</b><small>${esc(hb.name)}${ht && ht !== c ? ' · remplace « ' + esc(ht.name) + ' »' : ''}</small></div><button type="button" class="at-mini${c.loc === 'ht' ? ' on' : ''}" data-at="cass:${c.id}:ht"${c.loc === 'ht' ? ' disabled' : ''}>${c.loc === 'ht' ? 'Montée' : 'Monter'}</button></div>`);
    if (c.loc !== 'wall') rows.push(`<div class="at-li"><div><b>Panneau à outils</b><small>sur un crochet libre</small></div><button type="button" class="at-mini" data-at="cass:${c.id}:wall">Raccrocher</button></div>`);
    openSheet(head('Cassette', nameInput('cass:' + c.id, c.name, 'Nom de la cassette')) +
      `<p class="at-meta">${c.range} · ${c.speeds} vitesses</p>${wearHTML(cassWear(c), `${fmtKm(cassKm(c))} · ${esc(cassWhere(c))}`)}
      <div class="at-lbl">Monter sur</div><div class="at-list">${rows.join('')}</div>
      <details${cassKm(c) ? '' : ' open'}><summary>Réglages de la cassette</summary>
      ${Object.entries(RANGES).map(([brand, rs]) => `<div class="at-kv at-wrap"><span>${brand}</span><div class="at-chips">${rs.map(r => `<button type="button" class="${r === c.range ? 'on' : ''}" data-at="range:${c.id}:${r}" aria-pressed="${r === c.range}">${r}</button>`).join('')}</div></div>`).join('')}
      <div class="at-add"><input type="text" class="at-name at-small" id="atRange" value="${Object.values(RANGES).flat().includes(c.range) ? '' : esc(c.range)}" placeholder="Autre étagement : 10-44, 9-36…" maxlength="7" inputmode="text" aria-label="Autre étagement"><button type="button" class="at-mini" data-at="rangeset:${c.id}">OK</button></div>
      <div class="at-kv at-wrap"><span>Vitesses</span><div class="at-chips">${[11, 12].map(n => `<button type="button" class="${n === c.speeds ? 'on' : ''}" data-at="speeds:${c.id}:${n}">${n} v</button>`).join('')}</div></div>
      <div class="at-kv"><span>Inventaire</span><b></b><button type="button" class="at-danger" data-at="delcass:${c.id}">Je n'ai plus cette cassette</button></div></details>`);
  }
  function bikeSheet(id){
    const b = bikeOf(id), V = vOf(b), p = pairOnBike(id), c = p && cassOnPair(p.id), sp = spotOf(id), onHT = sp === 'ht', ht = onHT && direct(b) ? cassOnHT() : undefined;
    const busy = k => k === 'rack' ? (G().spots.racks.length >= 2 ? bikeOf(G().spots.racks[0]) : null) : bikeOf(G().spots[k]); // place occupée → échange
    openSheet(head(`Vélo · ${SPOT[sp]?.in || 'au garage'}`, `<h3 class="at-name">${esc(b.name)}</h3>`) +
      `<p class="at-meta">${esc([b.brand, b.modelName].filter(Boolean).join(' '))} · freins ${brk(V.brakes)} · ${V.speeds} vitesses</p>
      <div class="at-kv"><span>Roues</span><b>${p ? esc(p.name) + ' · ' + depthTxt(p) : 'Aucune'}</b><button type="button" data-at="pickpair:${id}">Changer</button></div>
      <div class="at-kv"><span>Cassette AR</span><b>${c ? esc(c.name) + ' · ' + c.range : 'Aucune'}</b>${p ? `<button type="button" data-at="pickcass:${p.id}">Changer</button>` : ''}</div>
      ${ht !== undefined ? `<div class="at-kv"><span>Home trainer</span><b>${ht ? esc(ht.name) + ' · ' + ht.range : 'Sans cassette'}</b><button type="button" data-at="pickcass:ht">Changer</button></div>` : ''}
      <div class="at-kv at-wrap"><span>Place</span><div class="at-chips">${Object.keys(SPOT).map(k => `<button type="button" class="${sp === k ? 'on' : ''}" data-at="spot:${id}:${k}" aria-pressed="${sp === k}">${SPOT[k].chip}</button>`).join('')}</div></div>
      ${Object.keys(SPOT).some(k => k !== sp && busy(k)) ? '<p class="at-why">Place déjà prise : les deux vélos échangent leur place.</p>' : ''}
      <div class="at-acts"><button type="button" class="at-primary" data-at="maint:${id}">Faire un entretien</button></div>`);
  }
  function tvSheet(){ tvDraw(); const rows = tvRows(), n = rows.length, sum = rows.reduce((s, r) => s + r.total, 0);
    openSheet(head('Télé · kilomètres', `<h3 class="at-name">${fmtKm(sum)}</h3>`) + `<p class="at-meta">${n} vélo${n > 1 ? 's' : ''} en service · route + home trainer</p><div class="at-list">` +
      (rows.map(r => `<div class="at-li"><div><b>${esc(r.name)}</b><small>${kmN(r.road)} route · ${r.est ? '≈ ' : ''}${kmN(r.ht)} home trainer · ${kmN(r.month)} ce mois</small></div><strong class="at-km">${fmtKm(r.total)}</strong></div>`).join('') || '<p class="at-why">Ajoutez un vélo au Garage pour suivre ses kilomètres.</p>') + '</div>' +
      (rows.some(r => r.est) ? '<p class="at-why">≈ : home trainer sans distance enregistrée, estimée à 30 km/h.</p>' : '')); }
  // pompe : pression conseillée et réglages de l'estimation, ceux de l'onglet Pression du Garage (mêmes champs, enregistrés sur le vélo choisi)
  function pumpBike(){ const on = bikesOn(), ok = id => on.some(b => b.id === id) && id, z = st.zone === 'expo' ? expoId() : st.zone === 'rack' ? G().spots.racks[0] : st.zone === 'trainer' ? htId() : null;
    return ok(st.press) || ok(z) || ok(S.garage?.sel) || ok(htId()) || on[0]?.id || null; }
  function pressSheet(id, keep){
    const b = bikeOf(id), on = bikesOn(); if (!b || !hasG()) return openSheet(head('Pompe', '<h3 class="at-name">Pression des pneus</h3>') + '<p class="at-why">Ajoutez un vélo au Garage pour calculer sa pression.</p>');
    st.press = id; S.garage.sel = id; // les champs de pression s'appliquent au vélo sélectionné du Garage
    const p = pairOnBike(id), w = +p?.tire || 0, t = Garage.pressure(b).t, diff = w && (+t.f !== w || +t.r !== w);
    const html = head('Pompe · pression des pneus', `<h3 class="at-name">${esc(b.name)}</h3>`) +
      (on.length > 1 ? `<div class="at-chips at-press-bikes">${on.map(x => `<button type="button" class="${x.id === id ? 'on' : ''}" data-at="pressbike:${x.id}" aria-pressed="${x.id === id}">${esc(x.name)}</button>`).join('')}</div>` : '') +
      (diff ? `<div class="at-li"><div><b>${esc(p.name)} : pneus de ${w} mm</b><small>L'estimation utilise ${t.f} / ${t.r} mm</small></div><button type="button" class="at-mini" data-at="presstire:${id}">Utiliser ${w} mm</button></div>` : '') +
      `<div class="at-press">${Garage.pressTab(b)}</div>`;
    if (!keep) return openSheet(html);
    const sh = q('.at-sheet'), top = sh.scrollTop, f = document.activeElement?.dataset?.grt; sh.innerHTML = html; sh.scrollTop = top; if (f) sh.querySelector(`[data-grt="${f}"]`)?.focus({ preventScroll: true });
  }
  const pumpSpec = () => { const o = A.groups.pump.position; return { t: wp(A.groups.pump, 0, .42, 0), az: Math.atan2(-o.x, .5 - o.z)/D2R, el: 10, w: .8, h: 1 }; };
  // choisir le vélo d'une place (podium, rack, home trainer) : place prise → échange ; un vélo hors de l'atelier peut y entrer
  const SPOT_GO = { ht: ['Installer un vélo', 'Installer'], rack: ['Ranger un vélo', 'Ranger'], expo: ['Exposer un vélo', 'Exposer'] };
  const SPOT_TXT = { ht: 'Le vélo du home trainer ; sur un home trainer direct, sa roue arrière attend au mur.', rack: 'Deux places, l\'une au-dessus de l\'autre ; le vélo garde ses roues.',
    expo: 'Le vélo exposé garde ses deux roues et sa cassette ; il reste prêt pour l\'entretien.' };
  function spotSheet(k){
    const s = G().spots, here = k === 'rack' ? s.racks : [s[k]].filter(Boolean), full = here.length >= (k === 'rack' ? 2 : 1), sw = full ? bikeOf(here[0]) : null, solo = k !== 'rack' && bikeOf(here[0]);
    openSheet(head(SPOT[k].l, `<h3 class="at-name">${solo ? esc(solo.name) : SPOT_GO[k][0]}</h3>`) + `<p class="at-meta">${SPOT_TXT[k]}</p><div class="at-list">` +
      bikesOn().map(b => { const on = here.includes(b.id), sp = spotOf(b.id), why = on ? 'ici' : (sp ? SPOT[sp].l : 'hors de l\'atelier (plus de place)') + (sw ? (sp ? ' · échange avec ' : ' · prend la place de ') + esc(sw.name) : '');
        return `<div class="at-li"><div><b>${esc(b.name)}</b><small>${why}</small></div><button type="button" class="at-mini${on ? ' on' : ''}" data-at="spot:${b.id}:${k}"${on ? ' disabled' : ''}>${on ? 'Ici' : SPOT_GO[k][1]}</button></div>`; }).join('') + '</div>' +
      (k === 'expo' && solo && s.racks.length < 2 ? `<div class="at-acts"><button type="button" class="at-sec" data-at="spot:${solo.id}:rack">Ranger ${esc(solo.name)} au rack</button></div>` : ''));
  }
  function pickPairSheet(id){
    const b = bikeOf(id), V = vOf(b);
    openSheet(head('Changer de roues', `<h3 class="at-name">${esc(b.name)}</h3>`) + `<p class="at-meta">Freins ${brk(V.brakes)} : seules les paires compatibles se montent.</p><div class="at-list">` +
      G().wheels.map(p => { const ok = p.brakes === V.brakes, on = p.bikeId === id;
        return `<div class="at-li"><div><b>${esc(p.name)}</b><small>${depthTxt(p)} · ${p.brakes === 'rim' ? 'patins' : 'disques'} · ${esc(where(p))}</small></div><button type="button" class="at-mini${on ? ' on' : ''}" data-at="mount:${p.id}:${id}"${on || !ok ? ' disabled' : ''}>${on ? 'Montée' : ok ? 'Monter' : 'Incompatible'}</button></div>`; }).join('') + '</div>');
  }
  function pickCassSheet(target){
    const label = target === 'ht' ? 'Home trainer' : 'Roue AR · ' + (pairOf(target)?.name || '');
    openSheet(head('Choisir une cassette', `<h3 class="at-name">${esc(label)}</h3>`) + '<div class="at-list">' +
      G().cass.map(c => { const on = c.loc === target; return `<div class="at-li"><div><b>${esc(c.name)}</b><small>${c.range} · ${c.speeds} v · ${esc(cassWhere(c))}</small></div><button type="button" class="at-mini${on ? ' on' : ''}" data-at="cass:${c.id}:${target}"${on ? ' disabled' : ''}>${on ? 'Montée' : 'Monter'}</button></div>`; }).join('') + '</div>');
  }
  function cassListSheet(){
    openSheet(head('Atelier', '<h3 class="at-name">Mes cassettes</h3>') + '<div class="at-list">' + G().cass.map(c => `<div class="at-li"><div><b>${esc(c.name)}</b><small>${c.range} · ${c.speeds} v · ${esc(cassWhere(c))}</small></div><button type="button" class="at-mini" data-at="cassette:${c.id}">Voir</button></div>`).join('') + '</div>' +
      (freePeg() >= 0 ? `<div class="at-acts"><button type="button" class="at-sec" data-at="addcass:${freePeg()}">+ Ajouter une cassette</button></div>` : ''));
  }
  function shelfSheet(){
    const st0 = G().stock;
    openSheet(head('Étagère', '<h3 class="at-name">Pièces détachées</h3>') + `<p class="at-meta">${stockCount()} article${stockCount() > 1 ? 's' : ''} en stock</p><div class="at-list">` +
      (st0.length ? st0.map(s => `<div class="at-li"><div><b>${esc(s.name)}</b></div><button type="button" class="at-mini" data-at="stock:${s.id}:-1" aria-label="Retirer : ${esc(s.name)}">−</button><span class="at-qty">${s.qty}</span><button type="button" class="at-mini" data-at="stock:${s.id}:1" aria-label="Ajouter : ${esc(s.name)}">+</button></div>`).join('') : '<p class="at-meta">Rien en stock pour l\'instant.</p>') +
      `</div><div class="at-lbl" style="margin-top:12px">Ajouter</div><div class="at-chips">${QUICK.map(n => `<button type="button" data-at="stockadd:${esc(n)}">${esc(n)}</button>`).join('')}</div>
      <div class="at-add"><input type="text" class="at-name at-small" id="atStockN" placeholder="Autre pièce…" maxlength="34" aria-label="Nom de la pièce"><button type="button" class="at-mini" data-at="stockadd">Ajouter</button></div>`);
  }

  function shoesSheet(){ const k = K();
    openSheet(head('Meuble à chaussures', '<h3 class="at-name">Chaussures de course</h3>') + '<p class="at-meta">Les sorties course à pied comptent pour la paire en cours, à partir de sa mise en service.</p><div class="at-list">' +
      (k.run.map(s => `<div class="at-li"><div><b>${esc(s.name)}</b><small>${esc(runTxt(s))}</small></div><span class="at-pct" style="color:${wearCol(runWear(s))}">${Math.round(runWear(s)*100)} %</span><button type="button" class="at-mini" data-at="kit:run:${s.id}">Voir</button></div>`).join('') || '<p class="at-meta">Aucune paire pour l\'instant.</p>') + '</div>' +
      (k.run.length < KMAX.run ? '<div class="at-acts"><button type="button" class="at-sec" data-at="kitadd:run">+ Ajouter une paire</button></div>' : `<p class="at-why">Meuble plein : ${KMAX.run} paires.</p>`)); }
  function wardrobeSheet(){ const k = K();
    const sec = (l, title, sub, add) => `<div class="at-lbl" style="margin-top:12px">${title} · ${k[l].length}/${KMAX[l]}</div><div class="at-list">` +
      (k[l].map(x => `<div class="at-li"><div><b>${esc(x.name)}</b><small>${esc(sub(x))}</small></div><button type="button" class="at-mini" data-at="kit:${l}:${x.id}">Voir</button></div>`).join('') || '<p class="at-meta">Rien pour l\'instant.</p>') + '</div>' +
      (k[l].length < KMAX[l] ? `<div class="at-chips">${add}</div>` : '');
    openSheet(head('Penderie', '<h3 class="at-name">Tenues, casques, chaussures</h3>') +
      sec('wear', 'Tenues', x => WEAR_T[x.type] || 'Tenue', Object.entries(WEAR_T).map(([t, n]) => `<button type="button" data-at="kitadd:wear:${t}">+ ${n}</button>`).join('')) +
      sec('helmets', 'Casques', () => 'Casque', '<button type="button" data-at="kitadd:helmets">+ Casque</button>') +
      sec('bshoes', 'Chaussures vélo', x => `cales : ${fmtKm(cleatKm(x))} de sorties`, '<button type="button" data-at="kitadd:bshoes">+ Paire</button>')); }
  function kitSheet(l, id){
    const x = kitOf(l, id); if (!x) return; const nm = nameInput(`kit:${l}:${id}`, x.name, 'Nom');
    const colors = `<div class="at-kv at-wrap"><span>Couleur</span><div class="at-chips">${KITCOL.map(([c, n], i) => `<button type="button" class="at-sw${c === x.color ? ' on' : ''}" style="--sw:${c}" data-at="kitcol:${l}:${id}:${i}" aria-label="${n}" aria-pressed="${c === x.color}"></button>`).join('')}</div></div>`;
    const del = `<div class="at-kv"><span>Inventaire</span><b></b><button type="button" class="at-danger" data-at="kitdel:${l}:${id}">Je n'en ai plus</button></div>`;
    if (l === 'run') { const life = +x.life || 700;
      return openSheet(head('Chaussures de course', nm) + wearHTML(runWear(x), esc(runTxt(x))) +
        `<p class="at-why">Repère indicatif : ${life} km. Changez-les plus tôt si l'amorti est tassé ou la semelle lisse.</p>` +
        (x.active ? '' : `<div class="at-acts"><button type="button" class="at-primary" data-at="kitrun:${id}">Courir avec cette paire</button></div>`) +
        `<details${runKm(x) ? '' : ' open'}><summary>Réglages de la paire</summary>${colors}
        <div class="at-kv at-wrap"><span>Durée de vie</span><div class="at-chips">${LIVES.map(n => `<button type="button" class="${n === life ? 'on' : ''}" data-at="kitlife:${id}:${n}" aria-pressed="${n === life}">${n} km</button>`).join('')}</div></div>
        <div class="at-lbl" style="margin-top:8px">Kilomètres réels de la paire</div><div class="at-add"><input type="number" class="at-name at-small" id="atKmTot" inputmode="numeric" min="0" max="5000" value="${Math.round(runKm(x)) || ''}" placeholder="Ex. 250" aria-label="Kilomètres réels de la paire"><button type="button" class="at-mini" data-at="kitkm:${id}">OK</button></div>${del}</details>`); }
    if (l === 'bshoes') return openSheet(head('Chaussures vélo', nm) + wearHTML(cleatWear(x), `Cales : ${fmtKm(cleatKm(x))} de sorties route${x.since ? ' depuis le ' + fmtShort(x.since) : ''}`) +
      `<p class="at-why">Repère indicatif : ${kmN(CLEAT_KM)} km environ. Changez les cales plus tôt si elles ont du jeu ou déclipsent mal.</p>
      <div class="at-acts"><button type="button" class="at-sec" data-at="kitcleat:${id}">Cales changées aujourd'hui</button></div><details><summary>Réglages</summary>${colors}${del}</details>`);
    const types = l === 'wear' ? `<div class="at-kv at-wrap"><span>Type</span><div class="at-chips">${Object.entries(WEAR_T).map(([t, n]) => `<button type="button" class="${t === x.type ? 'on' : ''}" data-at="kittype:${id}:${t}" aria-pressed="${t === x.type}">${n}</button>`).join('')}</div></div>` : '';
    openSheet(head(l === 'wear' ? 'Penderie · tenue' : 'Penderie · casque', nm) + types + colors + del);
  }
  function kitAdd(l, type){ const k = K(); if (!k[l]) return; if (k[l].length >= KMAX[l]) return say('Plus de place ici', 'err');
    const t = todayISO(), c0 = KITCOL[k[l].length % KITCOL.length][0];
    const x = l === 'run' ? { id: rid(), name: 'Nouvelle paire', color: c0, active: !k.run.some(s => s.active), since: null, km0: 0, life: 700 }
      : l === 'wear' ? { id: rid(), name: WEAR_T[type] || 'Maillot', type: WEAR_T[type] ? type : 'maillot', color: c0 }
      : l === 'helmets' ? { id: rid(), name: 'Casque', color: c0 } : { id: rid(), name: 'Chaussures vélo', color: '#1d1f24', since: t, km0: 0 };
    if (x.active) x.since = t; k[l].push(x); save(); fillKit(); select({ kind: 'kit', list: l, id: x.id }); say('Donnez-lui un nom et sa couleur'); }
  function kitEdit(l, id, ch){ const x = kitOf(l, id); if (!x) return; Object.assign(x, ch); save(); fillKit(); kitSheet(l, id); tagsRebuild(); }
  function kitRun(id){ const s = kitOf('run', id); if (!s) return; for (const o of K().run) if (o.active && o !== s) { o.km0 = runKm(o); o.active = false; o.since = null; }
    s.km0 = runKm(s); s.active = true; s.since = todayISO(); save(); kitSheet('run', id); tagsRebuild(); say(`${s.name} : vos prochaines sorties course comptent pour elle`); }
  function kitDel(l, id){ const k = K(), x = kitOf(l, id); if (!x) return; k[l] = k[l].filter(o => o !== x); save(); hideSheet(); fillKit(); go(kitZone(l)); say(`${x.name} retiré de l'atelier`); }

  /* ---------- entretien sur le pied d'atelier : les points de contrôle écrivent dans le carnet du Garage ---------- */
  const POINTS = [
    { key: 'chain', l: 'Chaîne', parts: ['chain'], care: ['lube', 'degrease', 'check'], at: 'chain', exp: 'chain' },
    { key: 'cass', l: 'Cassette et plateaux', parts: ['cassette', 'rings'], care: ['clean'], at: 'cassette', exp: 'cassette' },
    { key: 'rd', l: 'Dérailleurs et galets', parts: ['rd', 'jockey', 'fd'], care: ['jockey'], at: 'rd', exp: 'rd' },
    { key: 'brakes', l: 'Freins', parts: ['padsF', 'padsR'], care: [], at: 'brakeF', exp: 'brakeF' },
    { key: 'tires', l: 'Pneus', parts: ['tireF', 'tireR', 'sealant'], care: [], at: 'tires', exp: 'wheelF' },
    { key: 'head', l: 'Direction et sueur', parts: ['headset', 'tape'], care: ['wipe'], at: 'headset', exp: 'headset' },
  ];
  const EXP_PARTS = { chain: ['chain'], cassette: ['cassette'], crank: ['rings', 'pm'], rd: ['rd', 'jockey'], fd: ['fd'], brakeF: ['padsF'], brakeR: ['padsR'], headset: ['headset'], bb: ['bb'],
    cockpit: ['tape'], battery: ['di2'], levers: ['coin', 'axs'], wheelF: ['tireF', 'hubF'], wheelR: ['tireR', 'hubR', 'sealant'] };
  const PART_L = { frame: 'Cadre', fork: 'Fourche', seatpost: 'Tige de selle', saddle: 'Selle', cockpit: 'Cintre et potence', levers: 'Leviers', crank: 'Pédalier et plateaux', chain: 'Chaîne',
    fd: 'Dérailleur avant', rd: 'Dérailleur arrière', brakeF: 'Frein avant', brakeR: 'Frein arrière', headset: 'Jeu de direction', bb: 'Boîtier de pédalier', battery: 'Batterie Di2', wheelF: 'Roue avant', wheelR: 'Roue arrière', cassette: 'Cassette' };
  function partsOf(b, keys){ if (!hasG()) return []; try { const all = Garage.allParts(b); return keys.map(k => all.find(i => i.k === k)).filter(Boolean); } catch (e) { return []; } }
  function points(id){
    const b = bikeOf(id); if (!b) return []; let care = []; try { care = Garage.careAll(b); } catch (e) {}
    return POINTS.map(pt => { const parts = partsOf(b, pt.parts), cc = care.filter(c => pt.care.includes(c.k)), worst = parts.reduce((m, i) => Math.min(m, i.rem), 1), due = cc.reduce((m, c) => Math.max(m, c.ratio || 0), 0);
      const lvl = worst < .35 || due >= 1 ? 2 : worst < .6 || due >= .75 ? 1 : 0, dueC = cc.find(c => c.due);
      return { ...pt, parts, care: cc, worst, due, lvl, col: ['#5ad19a', '#f5c542', '#ff8a4c'][lvl], txt: dueC ? dueC.l : ['Bon état', 'À surveiller', 'Intervention à prévoir'][lvl], done: !!st.done[pt.key] }; });
  }
  function anchorOf(id, key){
    const b = A.B[id], p = pairOnBike(id);
    if (key === 'cassette') { const c = p && cassOnPair(p.id); return c && A.C[c.id] ? A.C[c.id].localToWorld(V3(0, .05, .05)) : b.anchorR.localToWorld(V3(0, 0, .05)); }
    if (key === 'tires') return (p && A.W[p.id] ? A.W[p.id].front : b.anchorF).localToWorld(V3(.2, -.25, .02));
    return b.holder.localToWorld(b.local[key].clone());
  }
  function logCare(b, k, value){ const e = { id: rid(), ts: Date.now(), bikeId: b.id, date: todayISO(), part: ['lube', 'degrease', 'check'].includes(k) ? 'chain' : k === 'jockey' ? 'jockey' : k === 'clean' ? 'cassette' : '', kind: k, label: '', price: 0, ...(value != null ? { value } : {}) };
    S.garage.log.push(e); st.logged.push(e.id); save(); return e; }
  function pointCard(key){
    const id = st.onStand, b = bikeOf(id), pt = points(id).find(x => x.key === key); if (!pt) return; st.sel = { kind: 'point', key };
    const today = todayISO(), mine = k => S.garage.log.find(e => st.logged.includes(e.id) && e.bikeId === id && e.kind === k && e.date === today);
    const careHTML = pt.care.map(c => { const e = mine(c.k);
      if (c.k === 'check') return `<div class="at-li"><div><b>${esc(c.l)}</b><small>${e ? `Mesuré : ${String(e.value).replace('.', ',')} %` : c.due ? 'À faire' : 'Pas encore nécessaire'}</small></div><input type="number" class="at-name at-small at-meas" id="atMeas" inputmode="decimal" step="0.05" min="0" max="1.5" placeholder="%" aria-label="Allongement mesuré (%)"><button type="button" class="at-mini" data-at="measure">Noter</button></div>`;
      return `<div class="at-li"><div><b>${esc(c.l)}</b><small style="color:${e ? '#5ad19a' : c.due ? '#ff8a4c' : 'inherit'}">${e ? 'Fait aujourd\'hui ✓' : c.due ? 'À faire' : 'Bientôt'}</small></div>${e ? `<button type="button" class="at-mini" data-at="undo:${e.id}">Annuler</button>` : `<button type="button" class="at-mini on" data-at="care:${c.k}">Fait</button>`}</div>`; }).join('');
    const partsHTML = pt.parts.map(i => `<div class="at-li"><div><b>${esc(i.l)}</b><small>${esc(i.spec || '')}</small></div><span class="at-pct" style="color:${wearCol(1 - i.rem)}">${Math.round(i.rem*100)} %</span><button type="button" class="at-mini" data-at="sheet:${i.k}">Fiche</button></div>`).join('');
    openSheet(head('Point de contrôle', `<h3 class="at-name">${esc(pt.l)}</h3>`) + `<p class="at-meta">${esc(b.name)} · état restant estimé par le Garage</p>` +
      (partsHTML ? `<div class="at-list">${partsHTML}</div>` : '') + (careHTML ? `<div class="at-lbl" style="margin-top:12px">Opérations</div><div class="at-list">${careHTML}</div>` : '') +
      `<div class="at-acts"><button type="button" class="${pt.done ? 'at-sec' : 'at-primary'}" data-at="point:${key}">${pt.done ? 'Remettre à vérifier' : 'Contrôlé ✓'}</button></div>`);
  }
  function partCard(key){
    const id = st.onStand, b = bikeOf(id); if (!b) return; const n = A.exp.findIndex(e => e.key === key);
    if (st.mode !== 'explode') { const pt = POINTS.find(x => x.exp === key || (key === 'wheelR' && x.key === 'tires') || (key === 'crank' && x.key === 'cass') || (key === 'brakeR' && x.key === 'brakes') || (key === 'fd' && x.key === 'rd'));
      if (pt) return pointCard(pt.key); }
    st.sel = { kind: 'part', key };
    const p = pairOnBike(id), c = p && cassOnPair(p.id), parts = partsOf(b, EXP_PARTS[key] || []);
    const sub = key === 'cassette' && c ? `${c.name} · ${c.range}` : (key === 'wheelF' || key === 'wheelR') && p ? `${p.name} · ${depthTxt(p)}` : b.name;
    openSheet(head(n >= 0 ? `Pièce n° ${n + 1}` : 'Pièce', `<h3 class="at-name">${PART_L[key] || key}</h3>`) + `<p class="at-meta">${esc(sub)}</p>` +
      (parts.length ? `<div class="at-list">${parts.map(i => `<div class="at-li"><div><b>${esc(i.l)}</b><small>${esc(i.spec || '')}</small></div><span class="at-pct" style="color:${wearCol(1 - i.rem)}">${Math.round(i.rem*100)} %</span><button type="button" class="at-mini" data-at="sheet:${i.k}">Fiche</button></div>`).join('')}</div>` : '<p class="at-meta">Pas de suivi d\'usure pour cette pièce.</p>'));
    if (n >= 0) { const e = A.exp[n], s = Math.max(e.size.x, e.size.y, .3); go({ t: e.center.clone(), az: 0, el: 0, w: s*2.1, h: s*1.6 }); }
  }
  function renderMaint(){
    const el = q('.at-maint'), id = st.onStand; if (!id) return;
    if (st.mode === 'explode') el.innerHTML = `<div class="at-mhead"><b>Vue éclatée</b><span>${A.exp.length} pièces · touchez un numéro</span></div><div class="at-row2"><button type="button" class="at-sec" data-at="assemble">Remonter le vélo</button><button type="button" class="at-primary" data-at="finish">Terminer</button></div>`;
    else { const pts = points(id), n = pts.filter(t => t.done).length;
      el.innerHTML = `<div class="at-mhead"><b>Points de contrôle</b><span>${n}/${pts.length} vérifiés</span></div><div class="at-bar" style="margin:0"><i style="width:${n/pts.length*100}%;background:var(--at-acc)"></i></div>
        <div class="at-tasks">${pts.map((t, i) => `<button type="button" class="at-task${t.done ? ' done' : ''}" style="--c:${t.done ? '#5ad19a' : t.col}" data-at="pcard:${t.key}"><i></i><div><b>${i + 1}. ${t.l}</b><small>${t.done ? 'Vérifié ✓' : esc(t.txt)}</small></div></button>`).join('')}</div>
        <div class="at-row2"><button type="button" class="at-sec" data-at="explode">Vue éclatée</button><button type="button" class="at-primary" data-at="finish">Terminer</button></div>`; }
    updateTop(); panels();
  }

  /* ---------- étiquettes accrochées à la 3D ---------- */
  let TAGS = [];
  const PLUS = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  function tagsRebuild(){
    if (!A?.R) return; const box = q('.at-tags'); box.innerHTML = ''; TAGS = [];
    const add = (cls, html, pos, act, o = {}) => { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.innerHTML = html; if (act) b.dataset.at = act; if (o.c) b.style.setProperty('--c', o.c);
      if (o.label) b.setAttribute('aria-label', o.label); if (o.item) b.dataset.item = o.item; box.append(b); TAGS.push({ el: b, pos, ay: o.ay ?? -100, dy: o.dy ?? -8 }); };
    const sel = st.sel, sheetOpen = !q('.at-sheet').hidden, a = G();
    if (st.mode === 'atelier') {
      if (st.zone === 'home') {
        add('at-tag', `<b>Mur des roues</b><small>${a.wheels.length} paire${a.wheels.length > 1 ? 's' : ''}</small>`, () => wp(A.groups.wheels, .1, 2.52, 0), 'zone:wheels');
        add('at-tag', `<b>Cassettes</b><small>${a.cass.length} nommée${a.cass.length > 1 ? 's' : ''}</small>`, () => wp(A.groups.bench, -.07, 1.64, .08), 'zone:pegs');
        add('at-tag', `<b>Pièces détachées</b><small>${stockCount()} en stock</small>`, () => wp(A.groups.shelf, -.18, 2.15, 0), 'zone:shelf');
        add('at-tag', `<b>Télé</b><small>${fmtKm(tvRows().reduce((s, r) => s + r.total, 0))}</small>`, () => wp(A.groups.tv, 0, TV.y + TV.h/2 + .02, .05), 'zone:tv');
        add('at-tag', `<b>Chaussures</b><small>${K().run.length} paire${K().run.length > 1 ? 's' : ''} de course</small>`, () => wp(A.groups.shoes, .16, 1.12, 0), 'zone:shoes');
        add('at-tag', `<b>Penderie</b><small>${K().wear.length} tenue${K().wear.length > 1 ? 's' : ''}</small>`, () => wp(A.groups.wardrobe, -.21, 2.2, 0), 'zone:wardrobe');
        for (const b of bikesIn()) if (A.B[b.id]) add('at-tag', `<b>${esc(b.name)}</b><small>${SPOT[spotOf(b.id)].l}</small>`, () => A.B[b.id].holder.localToWorld(V3(0, 1.08, 0)), 'zone:' + zoneOf(b.id));
      } else if (st.zone === 'wheels') {
        for (let s = 0; s < SLOTS.length; s++) { const p = a.wheels.find(x => x.slot === s), at = () => wp(A.groups.wheels, .1, SLOTS[s][1] + .4, SLOTS[s][0]);
          if (!p) add('at-tag add', `${PLUS}<b>Paire</b>`, at, 'addpair:' + s, { label: 'Ajouter une paire de roues' });
          else { const ghost = !!p.bikeId, on = sel?.kind === 'pair' && sel.id === p.id;
            add('at-tag' + (ghost ? ' ghost' : '') + (on ? ' on' : ''), `<b>${esc(p.name)}</b><small>${depthTxt(p)} · ${p.brakes === 'rim' ? 'patins' : 'disques'}${ghost ? ` · <em>sur ${esc(bikeOf(p.bikeId)?.name || '')}</em>` : ''}</small>`, at, 'pair:' + p.id); } }
        for (const p of a.wheels.filter(x => x.slot == null)) add('at-tag ghost flat', `<b>${esc(p.name)}</b><small>sur ${esc(bikeOf(p.bikeId)?.name || '')}</small>`, () => wp(A.groups.wheels, .1, .55, 0), 'pair:' + p.id);
      } else if (st.zone === 'pegs') {
        const onWall = a.cass.filter(c => c.loc === 'wall'), fp = freePeg();
        add('at-tag', `<b>Toutes les cassettes</b><small>${onWall.length} au panneau · ${a.cass.length - onWall.length} montée${a.cass.length - onWall.length > 1 ? 's' : ''}</small>`, () => wp(A.groups.bench, -.07, 1.64, .06), 'casslist');
        for (let k = 0; k < PEGS.length; k++) { const c = onWall.find(x => x.peg === k), low = k % 2 === 1, at = () => wp(A.groups.bench, PEGS[k], low ? PEG_Y - .1 : PEG_Y + .06, .06), o = { ay: low ? 0 : -100, dy: low ? 8 : -8 };
          if (c) add('at-tag flat' + (sel?.kind === 'cassette' && sel.id === c.id ? ' on' : ''), `<b>${esc(c.name)}</b><small>${c.range} · ${c.speeds} v</small>`, at, 'cassette:' + c.id, o);
          else if (k === fp) add('at-tag add flat', `${PLUS}<b>Cassette</b>`, at, 'addcass:' + k, { ...o, label: 'Ajouter une cassette' }); }
      } else if (st.zone === 'trainer') { const b = bikeOf(htId());
        if (b && A.B[b.id]) add('at-tag', `<b>${esc(b.name)}</b><small>${esc(pairOnBike(b.id)?.name || 'sans roues')}</small>`, () => A.B[b.id].holder.localToWorld(V3(.25, 1.05, 0)), 'bike:' + b.id);
        if (!b || direct(b)) { const ht = cassOnHT(); add('at-tag', `<b>Home trainer</b><small>${ht ? esc(ht.name) + ' · ' + ht.range : 'sans cassette'}</small>`, () => A.trainer.td.localToWorld(V3(0, .32, .05)), ht ? 'cassette:' + ht.id : 'pickcass:ht'); }
        if (!b) add('at-tag add', `${PLUS}<b>Installer un vélo</b>`, () => wp(A.groups.ht, .15, .95, 0), 'spotpick:ht', { label: 'Choisir le vélo du home trainer' });
      } else if (st.zone === 'rack') { for (const id of a.spots.racks) { const b = bikeOf(id); if (b && A.B[id]) add('at-tag', `<b>${esc(b.name)}</b><small>${esc(pairOnBike(id)?.name || 'sans roues')}</small>`, () => A.B[id].holder.localToWorld(V3(.1, 1.05, 0)), 'bike:' + id); }
        if (a.spots.racks.length < 2) add('at-tag add', `${PLUS}<b>Ranger un vélo</b>`, () => wp(A.groups.rack, a.spots.racks.length ? .62 : 0, a.spots.racks.length ? .5 : 1.25, .3), 'spotpick:rack', { label: 'Choisir un vélo à ranger au rack' });
      } else if (st.zone === 'expo') { const b = bikeOf(expoId());
        if (b && A.B[b.id]) add('at-tag', `<b>${esc(b.name)}</b><small>${esc(pairOnBike(b.id)?.name || 'sans roues')}</small>`, () => A.B[b.id].holder.localToWorld(V3(.2, 1.08, 0)), 'bike:' + b.id);
        else add('at-tag add', `${PLUS}<b>Exposer un vélo</b>`, () => wp(A.groups.expo, 0, .55, 0), 'spotpick:expo', { label: 'Choisir le vélo à exposer' });
      } else if (st.zone === 'tv') add('at-tag', `<b>Détail par vélo</b><small>route, home trainer, ce mois</small>`, () => wp(A.groups.tv, 0, TV.y + TV.h/2 + .02, .05), 'tv');
      else if (st.zone === 'shoes') { const k = K().run, on = id => sel?.kind === 'kit' && sel.id === id;
        RUN_SLOTS.forEach(([y, z], i) => { const s = k[i], at = () => wp(A.groups.shoes, .3, y + .19, z), o = { ay: 0, dy: 0 };
          if (s) add('at-tag flat' + (on(s.id) ? ' on' : '') + (s.active ? '' : ' ghost'), `<b>${esc(s.name)}</b><small>${fmtKm(runKm(s))}${s.active ? ' · en cours' : ''}</small>`, at, `kit:run:${s.id}`, o);
          else if (i === k.length) add('at-tag add flat', `${PLUS}<b>Paire</b>`, at, 'kitadd:run', { ...o, label: 'Ajouter une paire de course' }); }); }
      else if (st.zone === 'wardrobe') { const k = K();
        add('at-tag', `<b>Casques</b><small>${k.helmets.length}/${KMAX.helmets}</small>`, () => wp(A.groups.wardrobe, -.42, 1.84, .62), 'kitlist:wardrobe');
        add('at-tag', `<b>Tenues</b><small>${k.wear.length}/${KMAX.wear}</small>`, () => wp(A.groups.wardrobe, -.42, 1.05, -.6), 'kitlist:wardrobe');
        add('at-tag', `<b>Chaussures vélo</b><small>${k.bshoes.length}/${KMAX.bshoes}</small>`, () => wp(A.groups.wardrobe, -.42, .32, .5), 'kitlist:wardrobe'); }
      else if (st.zone === 'shelf') add('at-tag', `<b>Pièces détachées</b><small>${stockCount()} en stock · voir</small>`, () => wp(A.groups.shelf, -.18, 2.15, 0), 'shelf');
    } else if (st.mode === 'maint' && !sheetOpen) {
      points(st.onStand).forEach((t, i) => add('at-dot' + (t.done ? ' done' : ''), `<span>${t.done ? '✓' : i + 1}</span>`, () => anchorOf(st.onStand, t.at), 'pcard:' + t.key, { c: t.done ? '#5ad19a' : t.col, ay: -50, dy: 0, label: `${t.l} : ${t.done ? 'vérifié' : t.txt}` }));
    } else if (st.mode === 'explode') {
      A.exp.forEach((e, i) => add('at-num' + (sel?.key === e.key ? ' on' : ''), `<i>${i + 1}</i>`, e.tag, 'part:' + e.key, { ay: -50, dy: 0, label: `${i + 1}. ${PART_L[e.key] || e.key}` }));
    } else if (st.mode === 'arrange') {
      for (const k in ITEMS) add('at-tag at-mv flat' + (st.arrSel === k ? ' on' : ''), `${svg('move', 15)}<b>${ITEMS[k].l}</b>`, () => { const R = rectOf(k); return V3(R.x, ITEMS[k].floor ? .6 : 1, R.z); }, 'arrsel:' + k, { item: k, ay: -50, dy: 0, label: `Déplacer : ${ITEMS[k].l}` });
    }
    placeTags(); wake();
  }
  function placeTags(){
    if (!A?.R) return; const w = A.el.clientWidth, h = A.el.clientHeight, v = A._v, L = [];
    for (const t of TAGS) { const p = typeof t.pos === 'function' ? t.pos() : t.pos; v.copy(p).project(A.cam);
      const x = (v.x*.5 + .5)*w, y = (-v.y*.5 + .5)*h, vis = v.z < 1 && x > -40 && x < w + 40 && y > ui.top + 12 && y < h - ui.bottom - 8;
      t.el.style.visibility = vis ? 'visible' : 'hidden'; if (!vis) continue; const tw = (t.w ||= t.el.offsetWidth), th = (t.h ||= t.el.offsetHeight);
      L.push({ t, x: clamp(x, tw/2 + 6, w - tw/2 - 6), y: y + t.dy, cy: y + t.dy + th*(t.ay/100 + .5), w: tw + 6, h: th + 4, s: 0 }); }
    // étiquettes qui se chevauchent : on les écarte verticalement
    for (let it = 0; it < 12; it++) for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const a = L[i], b = L[j];
      const ox = (a.w + b.w)/2 - Math.abs(a.x - b.x), oy = (a.h + b.h)/2 - Math.abs(a.cy + a.s - b.cy - b.s); if (ox <= 0 || oy <= 0) continue;
      const d = (a.cy + a.s <= b.cy + b.s ? -1 : 1)*oy/2; a.s += d; b.s -= d; }
    for (const l of L) l.t.el.style.transform = `translate(${l.x.toFixed(1)}px,${(l.y + l.s).toFixed(1)}px) translate(-50%,${l.t.ay}%)`;
  }

  /* ---------- actions ---------- */
  const slotSpec = p => ({ t: wp(A.groups.wheels, 0, SLOTS[p.slot][1] + .05, SLOTS[p.slot][0]), az: 90, el: 3, w: 1.3, h: .95 });
  function select(p){
    st.sel = p;
    if (p.kind === 'pair') { const pr = pairOf(p.id); if (!pr) return; const d = destPair(pr, p.part || 'rear');
      if (!d || d.parent === A.groups.wheels) { st.zone = 'wheels'; if (pr.slot != null) go(slotSpec(pr)); else go('wheels'); } else go(zoneOf(pr.bikeId)); pairSheet(pr); }
    else if (p.kind === 'cassette') { const c = cassOf(p.id), o = A.C[c?.id]; if (!c || !o) return;
      if (c.loc === 'wall') { st.zone = 'pegs'; go({ t: wp(A.groups.bench, PEGS[c.peg ?? 0], PEG_Y - .03, 0), az: 0, el: 4, w: .6, h: .45 }); }
      else { const onWall = c.loc !== 'ht' && destPair(pairOf(c.loc), 'rear')?.parent === A.groups.wheels, dir = V3(0, 0, 1).applyQuaternion(o.getWorldQuaternion(Q())); // côté transmission, où que soit le vélo
        go({ t: o.getWorldPosition(V3()).add(dir.clone().multiplyScalar(.03)), az: onWall ? 90 : 34 + Math.atan2(dir.x, dir.z)/D2R, el: 12, w: .8, h: .6 }); }
      cassSheet(c); }
    else if (p.kind === 'bike') { go(zoneOf(p.id)); bikeSheet(p.id); }
    else if (p.kind === 'expo') { go('expo'); spotSheet('expo'); }
    else if (p.kind === 'shelf') { go('shelf'); shelfSheet(); }
    else if (p.kind === 'tv') { go('tv'); tvSheet(); }
    else if (p.kind === 'pump') { go(pumpSpec()); pressSheet(pumpBike()); }
    else if (p.kind === 'shoes') { go('shoes'); shoesSheet(); }
    else if (p.kind === 'wardrobe') { go('wardrobe'); wardrobeSheet(); }
    else if (p.kind === 'kit') { const x = kitOf(p.list, p.id), o = A.K[p.id]; if (!x) return; st.zone = kitZone(p.list);
      if (o) { const s = sphereOf(o), r = Math.max(.16, s.radius); go({ t: s.center, az: p.list === 'run' ? 90 : -90, el: p.list === 'bshoes' ? 30 : 14, w: r*3.4, h: r*2.8 }); } else go(st.zone);
      kitSheet(p.list, p.id); }
  }
  function mountPair(pid, target){
    const p = pairOf(pid); if (!p) return; let old = null;
    if (target !== 'wall') { const b = bikeOf(target), V = vOf(b); if (V.brakes !== p.brakes) return say(`${p.name} : freins ${brk(p.brakes)}, incompatible avec ${b.name}`, 'err');
      old = pairOnBike(target); if (old === p) old = null;
      const freeAfter = SLOTS.length - G().wheels.filter(x => x !== old && x !== p && needSlot(x)).length - (htId() === target && direct(b) ? 1 : 0);
      if (old && freeAfter < 1) return say('Mur des roues plein : libérez un emplacement d\'abord', 'err'); }
    else if (p.slot == null && freeSlot() < 0) return say('Mur des roues plein (4 emplacements)', 'err');
    if (old) unmountPair(old); if (target === 'wall') unmountPair(p); else mountPairOn(p, target); save();
    hideSheet(); go(target === 'wall' ? 'wheels' : zoneOf(target)); layout(true);
    if (target === 'wall') say(`${p.name} raccrochée au mur`);
    else { const b = bikeOf(target), c = cassOnPair(p.id), V = vOf(b); say(`${p.name} montée sur ${b.name}${old ? ' · ' + old.name + ' au mur' : ''}`);
      if (!c && !(htId() === target && direct(b))) setTimeout(() => say('Pas de cassette sur la roue arrière : pensez à en monter une', 'warn'), 3000);
      else if (c && c.speeds !== V.speeds) setTimeout(() => say(`Cassette ${c.speeds} v sur un vélo ${V.speeds} v : à vérifier`, 'warn'), 3000); }
    updateTop();
  }
  function mountCass(cid, target){
    const c = cassOf(cid); if (!c) return; const old = target === 'wall' ? null : G().cass.find(x => x.loc === target && x !== c);
    if ((target === 'wall' || old) && G().cass.filter(x => x.loc === 'wall' && x !== c).length >= PEGS.length) return say('Panneau plein : 5 crochets à cassettes', 'err');
    moveCass(c, target); if (old) moveCass(old, 'wall'); fixPegs(); save(); hideSheet();
    if (target === 'wall') go('pegs'); else if (target === 'ht') go('trainer');
    else { const pr = pairOf(target); if (destPair(pr, 'rear')?.parent === A.groups.wheels) { st.zone = 'wheels'; go(slotSpec(pr)); } else go(zoneOf(pr.bikeId)); }
    layout(true);
    say(`${c.name} ${target === 'wall' ? 'raccrochée au panneau' : target === 'ht' ? 'montée sur le home trainer' : `montée sur la roue AR de « ${pairOf(target).name} »`}${old ? ' · ' + old.name + ' au panneau' : ''}`);
    const b = target === 'ht' ? bikeOf(htId()) : target !== 'wall' && pairOf(target).bikeId ? bikeOf(pairOf(target).bikeId) : null;
    if (b && vOf(b).speeds !== c.speeds) setTimeout(() => say(`${c.speeds} v sur un vélo ${vOf(b).speeds} v : à vérifier`, 'warn'), 3000);
  }
  function addPair(slot){ if (slot < 0 || G().wheels.some(p => needSlot(p) && p.slot === slot)) return;
    const b0 = bikeOf(htId()) || bikesIn()[0], p = { id: rid(), name: 'Nouvelle paire', depth: 50, wall: 'noir', brakes: b0 ? vOf(b0).brakes : 'disc', tire: 28, bikeId: null, slot, since: null, km0: 0, wear: 0 };
    G().wheels.push(p); save(); makePair(p);
    for (const o of [A.W[p.id].front, A.W[p.id].rear]) o.position.copy(A.cam.position).add(V3(0, -.6, 0)).addScaledVector(A.cam.getWorldDirection(V3()), 1.2);
    layout(true); select({ kind: 'pair', id: p.id, part: 'rear' }); say('Nouvelle paire : donnez-lui un nom et sa hauteur de jante'); updateTop(); }
  function addCass(peg){ if (peg < 0 || G().cass.some(c => c.loc === 'wall' && c.peg === peg)) return;
    const b0 = bikeOf(htId()) || bikesIn()[0], sp = b0 ? vOf(b0).speeds : 12, c = { id: rid(), name: 'Nouvelle cassette', range: b0 ? rangeOf(b0, sp) : '11-30', speeds: sp, tint: '#c4c8ce', loc: 'wall', peg, since: null, km0: 0, wear: 0 };
    G().cass.push(c); save(); makeCass(c); A.C[c.id].position.copy(A.cam.position).add(V3(0, -.3, 0)).addScaledVector(A.cam.getWorldDirection(V3()), .8);
    layout(true); select({ kind: 'cassette', id: c.id }); say('Nouvelle cassette : nommez-la (vitesse, montagne…)'); updateTop(); }
  function editPair(pid, ch){ const p = pairOf(pid); if (!p) return; Object.assign(p, ch);
    if (p.bikeId && vOf(bikeOf(p.bikeId)).brakes !== p.brakes) { const b = bikeOf(p.bikeId); if (freeSlot() < 0 && !needSlot(p)) { Object.assign(p, { brakes: vOf(b).brakes }); return say('Mur des roues plein : impossible de la démonter', 'err'); }
      unmountPair(p); say(`${p.name} n'est plus compatible avec ${b.name} : raccrochée au mur`, 'warn'); }
    save(); rebuildPair(p); layout(true); pairSheet(p); tagsRebuild(); }
  function editCass(cid, ch){ const c = cassOf(cid); if (!c) return; Object.assign(c, ch); save(); rebuildCass(c); cassSheet(c); tagsRebuild(); }
  function delPair(pid){ const p = pairOf(pid); if (!p) return; const a = G(); for (const c of a.cass) if (c.loc === p.id) { moveCass(c, 'wall'); }
    a.wheels = a.wheels.filter(x => x !== p); fixPegs(); save(); const w = A.W[pid]; if (w) { for (const ch of [...w.rear.children]) if (ch.userData.pick?.kind === 'cassette') A.scene.attach(ch); dropObj(w.front); dropObj(w.rear); delete A.W[pid]; }
    hideSheet(); layout(true); go('wheels'); say(`${p.name} retirée de l'atelier`); updateTop(); }
  function delCass(cid){ const c = cassOf(cid); if (!c) return; G().cass = G().cass.filter(x => x !== c); save(); dropObj(A.C[cid]); delete A.C[cid]; hideSheet(); layout(true); go('pegs'); say(`${c.name} retirée de l'atelier`); updateTop(); }
  function rename(key, v){ const [k, id, id2] = key.split(':'), o = k === 'pair' ? pairOf(id) : k === 'kit' ? kitOf(id, id2) : cassOf(id); v = String(v || '').trim().slice(0, 34); if (!o || !v) return; o.name = v; save(); tagsRebuild(); }
  // changer un vélo de place (home trainer, rack, exposition) : si la place visée est prise, l'occupant prend la place libérée ;
  // un vélo resté hors de l'atelier (plus de 4 vélos) peut y entrer, l'occupant délogé en sort alors
  function moveBike(id, to){
    const a = G(), s = a.spots, b = bikeOf(id), from = spotOf(id); if (!b || b.retired || !SPOT[to] || from === to) return;
    if (st.mode !== 'atelier') return say("Terminez d'abord l'entretien", 'warn');
    const other = to === 'rack' ? (s.racks.length >= 2 ? s.racks[0] : null) : s[to] || null;
    if (from === 'rack') { const i = s.racks.indexOf(id); if (other) s.racks[i] = other; else s.racks.splice(i, 1); } else if (from) s[from] = other;
    if (to === 'rack') { const i = other ? s.racks.indexOf(other) : -1; if (i >= 0) s.racks[i] = id; else s.racks.push(id); } else s[to] = id;
    const hb = bikeOf(s.ht);
    if (hb && direct(hb) && !cassOnHT()) { const V = vOf(hb), c = { id: rid(), name: 'Cassette du home trainer', range: rangeOf(hb, V.speeds), speeds: V.speeds, tint: '#3d4047', loc: 'ht', peg: null, since: todayISO(), km0: 0, wear: 0 }; a.cass.push(c); makeCass(c); }
    fixSlots(); save(); hideSheet();
    const fresh = [id, other].filter(x => x && placed(x) && !A.B[x]); for (const x of fresh) makeBike(bikeOf(x));
    for (const k in A.B) { A.scene.attach(A.B[k].holder); A.B[k].holder.userData.dest = null; } A.seats.rack = buildRack(A.groups.rack); // le rack change de forme (1 ou 2 vélos)
    for (const x of fresh) { place(A.B[x].holder, homeSeat(x), V3(), Q(), null); burst(A.B[x].holder); }
    layout(true); go(zoneOf(id));
    const ob = bikeOf(other); say(`${b.name} ${SPOT[to].in}${ob ? ` · ${ob.name} ${from ? SPOT[from].in : "n'a plus de place dans l'atelier"}` : ''}`); updateTop();
    const hc = cassOnHT(); if (hb && direct(hb) && [id, other].includes(hb.id) && hc && hc.speeds !== vOf(hb).speeds) setTimeout(() => say(`Cassette du home trainer en ${hc.speeds} v, ${hb.name} en ${vOf(hb).speeds} v : à vérifier`, 'warn'), 3000);
  }
  function startMaint(id){
    if (st.mode !== 'atelier' || !id || !A.B[id]) return; Object.assign(st, { mode: 'maint', onStand: id, sel: null, done: {} });
    q('.at-sheet').hidden = true; standFade(true, 0); renderMaint(); layout(true); go('stand'); say(`${bikeOf(id).name} sur le pied d'atelier : touchez les points numérotés`);
  }
  function togglePoint(k){ if (!st.onStand) return; st.done[k] = !st.done[k]; const pts = points(st.onStand);
    if (st.sel?.kind === 'point') pointCard(st.sel.key); renderMaint(); if (!q('.at-sheet').hidden) panels(); tagsRebuild(); updateTop();
    if (pts.every(t => t.done)) say('Tout est vérifié : vous pouvez terminer l\'entretien'); }
  const EXP_POS = { saddle: [-.7, 1.84], seatpost: [-.4, 1.8], battery: [-.22, 1.8], headset: [-.04, 1.84], cockpit: [.34, 1.84], levers: [.74, 1.82],
    frame: [-.16, 1.33], fork: [.66, 1.33], crank: [-.74, .9], bb: [-.44, .92], chain: [-.04, .9], fd: [.3, .94], rd: [.5, .9], brakeF: [.71, .94], brakeR: [.89, .9],
    wheelR: [-.5, .43], cassette: [0, .44], wheelF: [.5, .43] };
  const EXP_ORDER = ['saddle', 'seatpost', 'battery', 'headset', 'cockpit', 'levers', 'frame', 'fork', 'crank', 'bb', 'chain', 'fd', 'rd', 'brakeF', 'brakeR', 'wheelR', 'cassette', 'wheelF'];
  // boîte englobante d'un objet dans son propre repère (pour le poser à plat sur le panneau, quel que soit l'angle du pied d'atelier)
  function localBox(o){ o.updateWorldMatrix(true, true); const inv = o.matrixWorld.clone().invert(), bx = new T.Box3(), m = new T.Matrix4();
    o.traverse(x => { if (!x.isMesh || x.material === A.mats.hit || !x.geometry) return; for (let p = x; p && p !== o; p = p.parent) if (!p.visible) return; x.geometry.boundingBox || x.geometry.computeBoundingBox(); bx.union(x.geometry.boundingBox.clone().applyMatrix4(m.multiplyMatrices(inv, x.matrixWorld))); });
    return bx; }
  function explode(){
    const id = st.onStand, b = A.B[id]; if (!b || st.mode !== 'maint') return; if (flights.size) return say('Un instant, le vélo se met en place…', 'warn');
    hideSheet(); st.mode = 'explode'; drawPanel(bikeOf(id).name); panelShow(true);
    const p = pairOnBike(id), c = p && cassOnPair(p.id), objs = { ...b.groups }; if (p && A.W[p.id]) { objs.wheelF = A.W[p.id].front; objs.wheelR = A.W[p.id].rear; } if (c && A.C[c.id]) objs.cassette = A.C[c.id];
    A.exp = []; A.panel.updateWorldMatrix(true, false); const P0 = PANEL.hide;
    EXP_ORDER.filter(k => objs[k]).forEach((k, i) => { const o = objs[k]; o.visible = true; const bx = localBox(o), lc = bx.getCenter(V3()), size = bx.getSize(V3()), [tx, ty] = EXP_POS[k];
      // cible dans le repère du panneau (posé à sa hauteur finale) : centre de la pièce en (tx, ty), dos contre le panneau
      const tl = V3(tx, ty - PANEL.y, .03 + size.z/2), center = A.panel.localToWorld(tl.clone()).setY(ty), dest = tl.clone().sub(lc);
      A.exp.push({ key: k, obj: o, home: { parent: o.parent, pos: o.position.clone(), quat: o.quaternion.clone() }, center, size, tag: A.panel.localToWorld(V3(tx - size.x/2 - .045, ty - PANEL.y + Math.min(size.y/2, .1), tl.z)).setY(ty + Math.min(size.y/2, .1)) });
      place(o, A.panelSeat, dest, Q(), { dur: 1200, delay: 600 + i*75, lift: .1, pop: false }); });
    renderMaint(); go('explode');
  }
  function panelShow(on){ const g = A.panel, y0 = g.position.y, y1 = on ? PANEL.y : PANEL.hide; g.visible = true; standFade(!on);
    tween(on ? 1000 : 750, k => { g.position.y = lerp(y0, y1, k); A.shadows = true; }, () => { g.visible = on; A.shadows = true; }, on ? 0 : 650); }
  function standFade(show, delay = show ? 900 : 0){ const g = A.stand.rig, s0 = g.scale.y; g.visible = true; tween(show ? 650 : 500, k => { g.scale.set(1, lerp(s0, show ? 1 : .001, k), 1); A.shadows = true; }, () => { g.visible = show; }, delay); }
  function assemble(then){
    if (st.mode !== 'explode') return then?.(); st.mode = 'maint'; hideSheet();
    [...A.exp].reverse().forEach((e, i) => place(e.obj, e.home.parent, e.home.pos, e.home.quat, { dur: 950, delay: i*45, lift: .1, pop: false, done: () => { if (e.obj.userData.hideAssembled) e.obj.visible = false; } }));
    A.exp = []; panelShow(false); renderMaint(); go('stand'); if (then) setTimeout(then, 1500);
  }
  function finishMaint(){
    if (st.mode === 'explode') return assemble(finishMaint); const id = st.onStand; if (!id) return;
    const n = st.logged.filter(x => S.garage.log.some(e => e.id === x)).length;
    Object.assign(st, { mode: 'atelier', onStand: null, sel: null, done: {}, logged: [] }); q('.at-sheet').hidden = true; panels(); layout(true); standFade(false, 1300);
    go(zoneOf(id)); updateTop(); say(n ? `Entretien noté dans le carnet : ${n} opération${n > 1 ? 's' : ''}` : 'Vélo remis à sa place');
  }

  /* ---------- aménagement : faire glisser les meubles, les vélos et les roues suivent ---------- */
  function buildFoot(){
    A.foot = {}; const fill = new T.MeshBasicMaterial({ color: col('#ff8a4c'), transparent: true, opacity: .16, depthWrite: false }), line = new T.LineBasicMaterial({ color: col('#ff8a4c'), transparent: true, opacity: .9 });
    for (const k in ITEMS) { const it = ITEMS[k], w = it.floor || it.wall === 'back' ? it.w : it.d, d = it.floor || it.wall === 'back' ? it.d : it.w, g = new T.Group();
      const m = new T.Mesh(new T.PlaneGeometry(w, d), fill.clone()); m.rotation.x = -Math.PI/2; m.userData.item = k; g.add(m);
      const l = new T.LineSegments(new T.EdgesGeometry(new T.PlaneGeometry(w, d)), line.clone()); l.rotation.x = -Math.PI/2; g.add(l);
      g.position.y = .014; g.visible = false; g.renderOrder = 5; A.scene.add(g); A.foot[k] = { g, mesh: m, line: l }; }
  }
  function footSync(){ for (const k in A.foot) { const f = A.foot[k], R = rectOf(k), on = st.arrSel === k; f.g.position.set(R.x, .014, R.z); f.g.rotation.y = R.r; f.g.visible = st.mode === 'arrange';
      f.mesh.material.opacity = on ? .34 : .14; f.line.material.color.copy(col(on ? '#ffffff' : '#ff8a4c')); } A.shadows = true; wake(); }
  function arrange(on){
    if (on) { if (st.mode !== 'atelier') return; hideSheet(); st.mode = 'arrange'; st.arrSel = null; A.ceil.visible = A.front.visible = A.walls.left.visible = A.walls.right.visible = false; footSync(); renderArr(); panels(); updateTop(); go('plan'); }
    else { st.mode = 'atelier'; st.arrSel = null; A.ceil.visible = A.front.visible = A.walls.left.visible = A.walls.right.visible = true; footSync(); panels(); updateTop(); go('home'); }
  }
  function renderArr(){
    const k = st.arrSel, it = k && ITEMS[k];
    q('.at-arr').innerHTML = `<div class="at-mhead"><b>${it ? esc(it.l) : 'Aménager l\'atelier'}</b><span>${it ? (it.floor ? 'glissez · tournez' : 'glissez le long du mur') : 'touchez puis faites glisser un meuble'}</span></div>
      ${it?.floor ? `<div class="at-row3"><button type="button" class="at-sec" data-at="rot:-15" aria-label="Tourner de 15° à gauche">↺ 15°</button><button type="button" class="at-sec" data-at="rot:90" aria-label="Tourner d'un quart de tour">⟳ 90°</button><button type="button" class="at-sec" data-at="rot:15" aria-label="Tourner de 15° à droite">↻ 15°</button></div>` : ''}
      <div class="at-row2"><button type="button" class="at-sec" data-at="arrreset">Disposition d'origine</button><button type="button" class="at-primary" data-at="arrdone">Terminé</button></div>`;
    panels();
  }
  // sélection d'un meuble : les poignées ne sont pas reconstruites (celle qu'on tient garde le doigt)
  function arrSelect(k){ st.arrSel = k && ITEMS[k] ? k : null; footSync(); renderArr(); q('.at-tags').querySelectorAll('[data-item]').forEach(e => e.classList.toggle('on', e.dataset.item === st.arrSel)); }
  function startMove(k, x, y){ const f = floorAt(x, y); if (!f) return; const L = lay(k); if (st.arrSel !== k) arrSelect(k); A.mv = { k, ox: (L.x ?? 0) - f.x, oz: (L.z ?? 0) - f.z, L0: { ...L } }; }
  const snap = v => Math.round(v/.05)*.05;
  function tryMove(k, L){ // déplacement valide, sinon on glisse le long de l'obstacle (l'axe libre qui rapproche le plus du doigt)
    const cur = lay(k); if (valid(k, L)) return L;
    const d = t => Math.hypot((t.x ?? 0) - (L.x ?? 0), (t.z ?? 0) - (L.z ?? 0));
    return ['x', 'z'].filter(ax => ax in L && L[ax] !== cur[ax]).map(ax => ({ ...cur, [ax]: L[ax] })).filter(t => valid(k, t)).sort((a, b) => d(a) - d(b))[0] || null; }
  function setLay(k, L){ const it = ITEMS[k], keep = it.floor ? { x: +L.x.toFixed(3), z: +L.z.toFixed(3), r: L.r || 0 } : it.wall === 'back' ? { x: +L.x.toFixed(3) } : { z: +L.z.toFixed(3) };
    G().layout[k] = keep; setGroup(k); footSync(); }
  function moveTo(x, y){ const mv = A.mv, f = floorAt(x, y); if (!mv || !f) return; const it = ITEMS[mv.k], L = { ...lay(mv.k) };
    if (it.floor || it.wall === 'back') L.x = snap(f.x + mv.ox); if (it.floor || it.wall !== 'back') L.z = snap(f.z + mv.oz);
    const ok = tryMove(mv.k, L); if (ok) setLay(mv.k, ok); }
  function endMove(){ const mv = A.mv; A.mv = null; if (!mv) return; save(); A.shadows = true; wake(); }
  function rotateItem(d){ const k = st.arrSel; if (!k || !ITEMS[k].floor) return; const L = { ...lay(k), r: ((lay(k).r || 0) + d + 360) % 360 };
    if (!valid(k, L)) return say('Pas assez de place pour tourner ici', 'err'); setLay(k, L); save(); }
  function arrReset(){ const from = {}; for (const k in ITEMS) from[k] = lay(k); G().layout = {}; save();
    tween(700, e => { for (const k in ITEMS) { const a = from[k], b = lay(k), L = { ...b }; for (const ax of ['x', 'z', 'r']) if (ax in b) L[ax] = lerp(a[ax] ?? b[ax], b[ax], e); setGroup(k, L); } footSync(); }, () => { for (const k in ITEMS) setGroup(k); footSync(); });
    say('Disposition d\'origine'); }

  /* ---------- actions de l'interface ---------- */
  function act(s){
    const [a, x, y, z] = s.split(':');
    switch (a) {
      case 'close': return closeSheet();
      case 'back': return back();
      case 'zone': st.sel = null; if (!q('.at-sheet').hidden) hideSheet(); return go(x);
      case 'recenter': return st.mode === 'atelier' ? go(st.zone) : go(st.mode === 'explode' ? 'explode' : st.mode === 'arrange' ? 'plan' : 'stand');
      case 'arrange': return st.mode === 'arrange' ? arrange(false) : st.mode === 'atelier' ? arrange(true) : say("Terminez d'abord l'entretien", 'warn');
      case 'pair': return select({ kind: 'pair', id: x, part: 'rear' });
      case 'cassette': return select({ kind: 'cassette', id: x });
      case 'bike': return select({ kind: 'bike', id: x });
      case 'shelf': return select({ kind: 'shelf' });
      case 'tv': return select({ kind: 'tv' });
      case 'pump': return select({ kind: 'pump' });
      case 'pressbike': return pressSheet(x, true);
      case 'presstire': { const b = bikeOf(x), w = +pairOnBike(x)?.tire; if (!b || !w) return; b.tires = { ...(b.tires || {}), f: w, r: w }; save(); say(`Estimation sur des pneus de ${w} mm`); return pressSheet(x, true); }
      case 'casslist': return cassListSheet();
      case 'kitlist': return select({ kind: x });
      case 'kit': return select({ kind: 'kit', list: x, id: y });
      case 'kitadd': return kitAdd(x, y);
      case 'kitdel': return kitDel(x, y);
      case 'kitcol': { const c = KITCOL[+z]; return c && kitEdit(x, y, { color: c[0] }); }
      case 'kittype': return WEAR_T[y] && kitEdit('wear', x, { type: y });
      case 'kitlife': return kitEdit('run', x, { life: +y });
      case 'kitrun': return kitRun(x);
      case 'kitkm': { const o = kitOf('run', x), v = parseFloat(String(q('#atKmTot')?.value || '').replace(',', '.')); if (!o) return; if (!(v >= 0 && v <= 5000)) return say('Entre 0 et 5 000 km', 'err');
        kitEdit('run', x, { km0: Math.round(v - (runKm(o) - (+o.km0 || 0))) }); return say('Kilomètres de la paire mis à jour'); }
      case 'kitcleat': { kitEdit('bshoes', x, { since: todayISO(), km0: 0 }); return say('Cales neuves : compteur remis à zéro'); }
      case 'mount': return mountPair(x, y);
      case 'cass': return mountCass(x, y);
      case 'pickcass': return pickCassSheet(x);
      case 'pickpair': return pickPairSheet(x);
      case 'depth': return editPair(x, { depth: +y });
      case 'depthr': return editPair(x, { depthR: +y });
      case 'wall': return editPair(x, { wall: y === 'beige' ? 'beige' : 'noir' });
      case 'brk': return editPair(x, { brakes: y });
      case 'tire': return editPair(x, { tire: +y });
      case 'range': return editCass(x, { range: y });
      case 'rangeset': { const r = rangeOk(q('#atRange')?.value); if (!r) return say('Étagement du type 10-33 (petit-grand pignon)', 'err'); return editCass(x, { range: r }); }
      case 'speeds': return editCass(x, { speeds: +y });
      case 'delpair': return delPair(x);
      case 'delcass': return delCass(x);
      case 'spot': return moveBike(x, y);
      case 'spotpick': if (x === 'expo') return select({ kind: 'expo' }); go(SPOT[x].z); return spotSheet(x);
      case 'stock': { const it = G().stock.find(i => i.id === x); if (it) { it.qty = Math.max(0, (+it.qty || 0) + +y); if (!it.qty && +y < 0) G().stock = G().stock.filter(i => i !== it); save(); } return shelfSheet(); }
      case 'stockadd': { const n = (x || q('#atStockN')?.value || '').trim().slice(0, 34); if (!n) return; const it = G().stock.find(i => i.name.toLowerCase() === n.toLowerCase());
        if (it) it.qty = (+it.qty || 0) + 1; else G().stock.push({ id: rid(), name: n, qty: 1 }); save(); say(`${n} ajouté à l'étagère`); return shelfSheet(); }
      case 'addpair': return addPair(+x);
      case 'addcass': return addCass(+x);
      case 'maint': return startMaint(x);
      case 'pcard': return pointCard(x);
      case 'point': return togglePoint(x);
      case 'care': { const b = bikeOf(st.onStand); if (!b) return; logCare(b, x); st.done[st.sel?.key] = true; say('Noté dans le carnet du Garage'); return pointCard(st.sel.key); }
      case 'measure': { const b = bikeOf(st.onStand), v = parseFloat(String(q('#atMeas')?.value || '').replace(',', '.')); if (!b) return; if (!(v >= 0 && v <= 1.5)) return say('Mesure entre 0 et 1,5 %', 'err');
        logCare(b, 'check', v); st.done.chain = true; say(v >= (vOf(b).speeds === 12 ? .5 : .75) ? 'Chaîne à changer' : 'Mesure notée dans le carnet', v >= (vOf(b).speeds === 12 ? .5 : .75) ? 'warn' : 'ok'); return pointCard('chain'); }
      case 'undo': { S.garage.log = S.garage.log.filter(e => e.id !== x); st.logged = st.logged.filter(i => i !== x); save(); return st.sel?.kind === 'point' ? pointCard(st.sel.key) : null; }
      case 'sheet': { if (!hasG() || !st.onStand) return; S.garage.sel = st.onStand; return Garage.partSheet(x); }
      case 'part': return partCard(x);
      case 'explode': return explode();
      case 'assemble': return assemble();
      case 'finish': return finishMaint();
      case 'arrsel': return arrSelect(x);
      case 'rot': return rotateItem(+x);
      case 'arrreset': return arrReset();
      case 'arrdone': return arrange(false);
    }
  }
  function back(){ if (!q('.at-sheet').hidden) return closeSheet(); if (st.mode === 'arrange') return arrange(false); if (st.mode !== 'atelier') return finishMaint(); if (st.zone !== 'home') return go('home'); close(); }

  /* ---------- ouverture / fermeture ---------- */
  const ICO = { back: '<path d="M15 18l-6-6 6-6"/>', move: '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
    frame: '<path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"/><circle cx="12" cy="12" r="2.5"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>' };
  const svg = (k, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[k]}</svg>`;
  function uiEl(){
    const el = document.createElement('div'); el.className = 'at3d'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Atelier 3D');
    el.innerHTML = `<div class="at-stage"></div><div class="at-tags"></div>
      <header class="at-top"><button type="button" class="at-ib" data-at="back" aria-label="Retour">${svg('back')}</button><div class="at-ttl"><b>Mon atelier</b><span>Garage</span></div><div class="at-prog" hidden>0/6</div>
        <button type="button" class="at-ib" data-at="arrange" aria-label="Aménager l'atelier">${svg('move')}</button><button type="button" class="at-ib" data-at="recenter" aria-label="Recadrer la vue">${svg('frame')}</button></header>
      <div class="at-toast" role="status" aria-live="polite"><i></i><span></span></div>
      <nav class="at-dock at-panel" aria-label="Zones de l'atelier"><div class="at-zones"></div><button type="button" class="at-primary" data-at="maint:">${svg('wrench')} Faire un entretien</button><div class="at-hint">Glissez pour regarder autour · touchez un objet pour l'inspecter</div></nav>
      <section class="at-maint at-panel" hidden aria-label="Entretien"></section><section class="at-arr at-panel" hidden aria-label="Aménagement"></section><section class="at-sheet at-panel" hidden aria-label="Fiche"></section>
      <div class="at-load"><div class="at-spin"></div><b>Ouverture de l'atelier</b><small>Chargement de la maquette 3D…</small></div>`;
    el.addEventListener('click', e => { const b = e.target.closest('[data-at]'); if (!b || b.disabled) return; e.preventDefault(); act(b.dataset.at); });
    el.addEventListener('change', e => { const t = e.target.closest('[data-atname]'); if (t) rename(t.dataset.atname, t.value);
      if (e.target.closest('.at-press [data-grt]')) setTimeout(() => { if (A && st.sel?.kind === 'pump') pressSheet(st.press, true); }); }); // le Garage enregistre d'abord la valeur (écouteur du document)
    el.addEventListener('toggle', () => { measureUI(); refocus(); }, true);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches?.('[data-atname]')) e.target.blur(); if (e.key === 'Escape') { e.preventDefault(); back(); } });
    // poignées des meubles (mode Aménager) : on les fait glisser directement
    el.querySelector('.at-tags').addEventListener('pointerdown', e => { const t = e.target.closest('[data-item]'); if (!t || st.mode !== 'arrange') return; e.preventDefault(); t.setPointerCapture?.(e.pointerId);
      startMove(t.dataset.item, e.clientX, e.clientY); dragging = true; const mv = ev => { moveTo(ev.clientX, ev.clientY); }, up = () => { t.removeEventListener('pointermove', mv); t.removeEventListener('pointerup', up); t.removeEventListener('pointercancel', up); dragging = false; endMove(); };
      t.addEventListener('pointermove', mv); t.addEventListener('pointerup', up); t.addEventListener('pointercancel', up); });
    document.body.appendChild(el); return el;
  }
  let ready = null;
  async function open(){
    if (A) return ready; if (!bikesOn().length) { toast('Ajoute d\'abord ton vélo au Garage'); return; }
    if (typeof dlg !== 'undefined' && dlg.open) dlg.close();
    seed(); save(); Object.assign(st, { mode: 'atelier', zone: 'home', onStand: null, sel: null, done: {}, logged: [], arrSel: null });
    A = { el: uiEl(), mats: {}, occ: [], pick: [], B: {}, W: {}, C: {}, K: {}, exp: [], bursts: [], groups: {}, seats: {} }; document.documentElement.classList.add('at-open');
    return ready = (async () => {
      try { await Bike3D.atelier.kit(); } catch (e) { if (A) A.el.querySelector('.at-load small').textContent = "L'atelier 3D n'a pas pu se charger (connexion ?). Le reste du Garage fonctionne."; if (typeof Errors !== 'undefined') Errors.report?.(e, 'atelier'); return false; }
      if (!A) return false; T = THREE; V3 = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z); Q = () => new T.Quaternion();
      try { build(); } catch (e) { if (A) A.el.querySelector('.at-load small').textContent = '3D indisponible sur cet appareil (WebGL). Le reste du Garage fonctionne.'; if (typeof Errors !== 'undefined') Errors.report?.(e, 'atelier'); return false; }
      return true; })();
  }
  function build(){
    const el = A.el, R = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!navigator.webdriver });
    R.setPixelRatio(navigator.webdriver ? .5 : Math.min(devicePixelRatio || 1, 2)); // tests (rendu logiciel) : demi-résolution
    R.outputEncoding = T.sRGBEncoding; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = .92;
    R.shadowMap.enabled = !navigator.webdriver; R.shadowMap.type = T.PCFSoftShadowMap; R.shadowMap.autoUpdate = false;
    const cv = R.domElement; cv.className = 'at-cv'; cv.setAttribute('aria-label', 'Atelier vélo en 3D : touchez un objet pour l\'inspecter'); el.querySelector('.at-stage').appendChild(cv);
    const scene = new T.Scene(); scene.background = new T.Color('#1a1d24'); // couleur d'écran (non convertie : le fond n'est pas ré-encodé en r147)
    { const pm = new T.PMREMGenerator(R); scene.environment = pm.fromScene(new T.RoomEnvironment(), .04).texture; pm.dispose(); }
    Object.assign(A, { R, cv, scene, cam: new T.PerspectiveCamera(60, 1, .02, 40), aniso: Math.min(8, R.capabilities.getMaxAnisotropy()), shadows: true, ray: new T.Raycaster(), ndc: new T.Vector2(), floorPlane: new T.Plane(V3(0, 1, 0), 0),
      _m: new T.Matrix4(), _p: V3(), _q: Q(), _s: V3(), _v: V3(), ONE: V3(1, 1, 1), ringGeo: new T.RingGeometry(.9, 1, 64) });
    A.halo = new T.Mesh(new T.RingGeometry(.965, 1, 72), new T.MeshBasicMaterial({ color: col('#ff8a4c'), transparent: true, opacity: .6, depthTest: false, side: T.DoubleSide })); A.halo.renderOrder = 997; A.halo.visible = false; scene.add(A.halo);
    buildRoom();
    for (const k of Object.keys(ITEMS)) { const g = new T.Group(); g.userData.item = k; scene.add(g); A.groups[k] = g; }
    buildBench(A.groups.bench); A.panelSeat = A.panel; buildWheelWall(A.groups.wheels); A.trainer = buildTrainer(A.groups.ht); A.stand = buildStand(A.groups.stand); A.expo = buildExpo(A.groups.expo); A.seats.rack = buildRack(A.groups.rack); buildShelf(A.groups.shelf); buildPump(A.groups.pump); A.tv = buildTV(A.groups.tv);
    A.shoes = buildShoeRack(A.groups.shoes); A.ward = buildWardrobe(A.groups.wardrobe); fillKit();
    A.pick.push(A.groups.shelf, A.groups.pump, A.groups.expo, A.groups.tv, A.groups.shoes, A.groups.wardrobe); for (const k of ['expo', 'tv', 'shoes', 'wardrobe']) ensureFree(k); for (const k in ITEMS) setGroup(k); buildFoot();
    for (const b of bikesOn()) if (placed(b.id)) makeBike(b);
    for (const p of G().wheels) makePair(p);
    for (const c of G().cass) makeCass(c);
    layout(false); updateTop(); renderDock(); bindGestures(); measureUI(); R.setSize(el.clientWidth, el.clientHeight, false); go('home', true);
    if (!FAST) { const c0 = rig.cur; c0.fov += 9; c0.el += .12; c0.az -= .16; c0.d *= .96; } // petite entrée en scène
    addEventListener('resize', onResize); A.shadows = true; R.compile(scene, A.cam); wake(2400);
    requestAnimationFrame(() => { const l = el.querySelector('.at-load'); if (l) { l.classList.add('out'); setTimeout(() => l.remove(), 600); } });
  }
  function onResize(){ if (!A?.R) return; A.R.setSize(A.el.clientWidth, A.el.clientHeight, false); measureUI(); refocus(); wake(); }
  function close(){
    if (!A) return; cancelAnimationFrame(raf); raf = 0; removeEventListener('resize', onResize); flights.clear(); tweens.length = 0; ptrs.clear(); drag = pinch = null; dragging = false;
    if (A.R) { A.R.dispose(); A.R.forceContextLoss?.(); }
    A.el.remove(); A = null; rig.cur = rig.goal = rig.spec = null; TAGS = []; ready = null; document.documentElement.classList.remove('at-open');
    if (typeof render === 'function') try { render(); } catch (e) {}
  }
  document.addEventListener('click', e => { const b = e.target.closest('[data-atelier]'); if (b) { e.preventDefault(); open(); } });
  // accès pour le développement et les tests
  const debug = { get A(){ return A; }, st, G, K, act, runKm, cleatKm, go, rectOf, valid, lay, points, tvRows, get ready(){ return ready; }, get flights(){ return flights.size + tweens.length; },
    snap(){ if (rig.goal) { rig.cur = { ...rig.goal, tgt: rig.goal.tgt.clone() }; wake(); } },
    move(k, L){ const ok = tryMove(k, { ...lay(k), ...L }); if (ok) { setLay(k, ok); save(); } return !!ok; },
    world: o => o.getWorldPosition(V3()).toArray().map(v => +v.toFixed(3)) };
  return { open, close, debug, button: () => `<button type="button" class="btn gr-atelier" data-atelier>🛠️ <b>Mon atelier 3D</b><span class="tiny muted">roues, cassettes, tenues, chaussures, entretien</span></button>` };
})();
