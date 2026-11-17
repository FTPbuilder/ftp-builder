// Garage › Atelier 3D : la pièce (tapis + home trainer direct, rack, podium d'exposition, mur des roues, panneau à cassettes, étagère), roues et cassettes
// nommées qui se montent (freins compatibles, roue AR au mur pendant le home trainer direct), entretien sur le pied d'atelier écrit dans le carnet du Garage,
// vue éclatée, vélo mis en exposition puis rendu au home trainer, aménagement (glisser, tourner, collisions, sauvegarde) et persistance.
const pw = (await import('module')).createRequire(process.env.PW_REQUIRE || '/opt/npm-tools/node_modules/x.js')('playwright');
const out = process.env.SCRATCH || '.';
const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); const ctx = await b.newContext({ ...pw.devices['iPhone 13'] });
const pg = await ctx.newPage(); const errs = []; pg.on('console', m => { if (/warn|error/.test(m.type()) && !/GL Driver|GPU stall/.test(m.text())) console.log('[console]', m.type(), m.text().slice(0, 300)); }); pg.on('pageerror', e => errs.push(e.message));
for (const f of ['build/three.min.js', 'examples/js/controls/OrbitControls.js', 'examples/js/environments/RoomEnvironment.js', 'examples/js/loaders/GLTFLoader.js', 'examples/js/loaders/DRACOLoader.js', 'examples/js/libs/meshopt_decoder.js'])
  await pg.route('**/three@0.147.0/' + f, r => r.fulfill({ path: out + '/node_modules/three/' + f, contentType: 'application/javascript' }));
await pg.clock.setFixedTime(new Date('2026-11-13T20:00:00+01:00'));
await pg.addInitScript(() => {
  if (localStorage.getItem('ftpb_state_v1')) return; // rechargement : on garde l'état enregistré
  const days = {0:{avail:false,max:75},1:{avail:true,max:75},2:{avail:false,max:75},3:{avail:true,max:75},4:{avail:false,max:75},5:{avail:true,max:120},6:{avail:false,max:120}};
  const ts = s => Math.floor(Date.parse(s)/1000);
  const activities = [
    { id:'h1', date:'2026-11-10', name:'Seuil 2x15', durationS:3600, indoor:true, hasPower:true, tss:80, source:'intervals', startTs:ts('2026-11-10T19:00:00+01:00'), distanceKm:36 },
    { id:'o1', date:'2026-11-08', name:'Longchamp', durationS:9000, indoor:false, hasPower:false, tss:150, source:'strava', startTs:ts('2026-11-08T09:00:00+01:00'), distanceKm:80 },
    { id:'o2', date:'2026-10-25', name:'Vallée de Chevreuse', durationS:12600, indoor:false, hasPower:false, tss:170, source:'intervals', startTs:ts('2026-10-25T09:00:00+02:00'), distanceKm:102 },
  ];
  localStorage.setItem('ftpb_state_v1', JSON.stringify({ version:2, updatedAt:Date.now(), profile:{ name:'A', sex:'M', age:30, weightKg:84, heightCm:181, ftp:250, hrMax:195, goalFtp:300, goalDate:'2027-03-05', endDate:'2027-03-15', minSessions:35, startDate:'2026-10-21', days, keyPerWeek:2, optionalPerWeek:0, testProtocol:'ramp', intensityAdj:1, ctl0:40 }, plan:[], activities, ftpHistory:[{date:'2026-10-20',ftp:250,source:'initial'}], settings:{theme:'dark'} }));
});
await pg.goto(new URL('../index.html', import.meta.url).href); await pg.waitForTimeout(300);
let ok = true; const T0 = Date.now(); const assert = (c, m) => { if (!c) { ok = false; console.error('ÉCHEC', m); } else console.log('ok', m, ((Date.now() - T0)/1000).toFixed(0) + ' s'); };
const ev = (f, a) => pg.evaluate(f, a);
const settle = async () => { await pg.waitForFunction(() => Atelier.debug.flights === 0, null, { timeout: 20000 }).catch(() => {}); await ev(() => Atelier.debug.snap()); await pg.waitForTimeout(350); };
const shot = n => pg.screenshot({ path: `${out}/atelier-${n}.png` });
const until = (f, a) => pg.waitForFunction(f, a, { timeout: 8000 }).then(() => true, () => false); // le rendu logiciel peut retarder un événement

await pg.tap('#tabs [data-tab="profile"]'); await pg.waitForTimeout(150);
await pg.tap('.gr-tile'); await pg.waitForTimeout(150);
await ev(() => { const x = document.createElement('button'); x.dataset.gr = 'add'; x.dataset.m = 'aeroad-cfsl'; document.querySelector('.gr').append(x); x.click(); x.remove(); }); await pg.waitForTimeout(300);
assert(await pg.locator('[data-atelier]').count() === 1, 'Garage : bouton « Mon atelier 3D »');
await pg.tap('[data-atelier]');
await pg.waitForFunction(() => Atelier.debug.A?.R && !document.querySelector('.at-load'), null, { timeout: 90000 }); await settle();
const bikeId = await ev(() => S.garage.bikes[0].id);
let g = await ev(() => { const a = Atelier.debug.G(); return { ht: a.spots.ht, wheels: a.wheels.map(p => ({ b: p.bikeId, d: p.depth, br: p.brakes, slot: p.slot })), cass: a.cass.map(c => c.loc) }; });
console.log('atelier', JSON.stringify(g));
assert(g.ht === bikeId && g.wheels.length === 1 && g.wheels[0].b === bikeId && g.wheels[0].br === 'rim' && g.wheels[0].slot != null, 'vélo sur le tapis du home trainer, paire d\'origine à patins (CF SL), emplacement réservé au mur');
assert(g.cass.length === 2 && g.cass.includes('ht'), 'cassette d\'origine sur la roue AR + cassette du home trainer direct');
const p0 = await ev(() => Atelier.debug.G().wheels[0].id);
let w = await ev(([id, p]) => { const A = Atelier.debug.A; return { front: A.W[p].front.parent === A.B[id].anchorF, rear: Atelier.debug.world(A.W[p].rear), htCass: A.C[Atelier.debug.G().cass.find(c => c.loc === 'ht').id].parent === A.trainer.anchor }; }, [bikeId, p0]);
assert(w.front && w.rear[0] < -2.3 && w.htCass, 'home trainer direct : roue AV sur le vélo, roue AR accrochée au mur, chaîne sur la cassette du home trainer');
await shot('accueil');

// toucher le vélo → sa fiche
await ev(() => Atelier.debug.act('zone:trainer')); await settle();
// point du cadre qui n'est caché par aucune étiquette
const bp = await ev(id => { const A = Atelier.debug.A; for (const [x, y] of [[0, .6], [.1, .5], [-.1, .7], [.2, .62], [-.05, .45]]) { const v = A.B[id].holder.localToWorld(new THREE.Vector3(x, y, 0)).project(A.cam), px = (v.x*.5 + .5)*innerWidth, py = (-v.y*.5 + .5)*innerHeight;
  if (document.elementFromPoint(px, py) === A.cv) return [px, py]; } return null; }, bikeId);
await pg.mouse.click(bp[0], bp[1]);
assert(await until(() => Atelier.debug.st.sel?.kind === 'bike' && /Faire un entretien/.test(document.querySelector('.at-sheet').innerText)), 'toucher le vélo → fiche du vélo (roues, cassettes, entretien)');

// nouvelle paire : nom, freins incompatibles refusés, puis montée → l'ancienne paire repart au mur
await ev(() => Atelier.debug.act('close')); await ev(() => Atelier.debug.act('zone:wheels')); await settle();
const free = await pg.locator('.at-tag.add').count(); assert(free >= 1, 'mur des roues : emplacement libre « + Paire »');
await pg.locator('.at-tag.add').first().click(); await settle();
const p1 = await ev(() => Atelier.debug.G().wheels.at(-1).id);
await pg.fill('.at-sheet input.at-name', 'Paire montagne'); await pg.press('.at-sheet input.at-name', 'Enter');
assert(await until(id => Atelier.debug.G().wheels.find(p => p.id === id).name === 'Paire montagne', p1), 'paire renommée');
await ev(id => Atelier.debug.act(`brk:${id}:disc`), p1); await settle();
await ev(([id, b]) => Atelier.debug.act(`mount:${id}:${b}`), [p1, bikeId]);
assert(await until(id => !Atelier.debug.G().wheels.find(p => p.id === id).bikeId && /incompatible/.test(document.querySelector('.at-toast').innerText), p1), 'paire à disques refusée sur un vélo à patins');
await ev(id => Atelier.debug.act(`brk:${id}:rim`), p1); await ev(id => Atelier.debug.act(`depth:${id}:80`), p1); await settle();
await ev(id => Atelier.debug.act(`depthr:${id}:62`), p1); await ev(id => Atelier.debug.act(`wall:${id}:beige`), p1); await settle();
w = await ev(id => { const p = Atelier.debug.G().wheels.find(x => x.id === id); return { f: p.depth, r: p.depthR, wall: p.wall, txt: document.querySelector('.at-sheet .at-meta').innerText, pencil: !!document.querySelector('.at-sheet .at-ren svg') }; }, p1);
assert(w.f === 80 && w.r === 62 && w.wall === 'beige' && /80\/62 mm/.test(w.txt) && /flancs beiges/.test(w.txt) && w.pencil, 'jantes avant / arrière différentes (80/62 mm), flancs beiges, nom modifiable (crayon)');
await ev(([id, b]) => Atelier.debug.act(`mount:${id}:${b}`), [p1, bikeId]); await settle(); await pg.waitForTimeout(1500); await settle();
w = await ev(([id, a, z]) => { const A = Atelier.debug.A, G = Atelier.debug.G(), n = G.wheels.find(p => p.id === a), o = G.wheels.find(p => p.id === z);
  return { nb: n.bikeId, ob: o.bikeId, oslot: o.slot, front: A.W[a].front.parent === A.B[id].anchorF, oldOnWall: A.W[z].front.parent === A.groups.wheels && A.W[z].rear.parent === A.groups.wheels }; }, [bikeId, p1, p0]);
assert(w.nb === bikeId && !w.ob && w.oslot != null && w.front && w.oldOnWall, 'paire 80 mm montée sur le vélo, la paire d\'origine raccrochée au mur');
await shot('roues');

// cassette nommée, montée sur la roue AR de la nouvelle paire
await ev(() => Atelier.debug.act('zone:pegs')); await settle();
await pg.locator('.at-tag.add').first().click(); await settle();
const c1 = await ev(() => Atelier.debug.G().cass.at(-1).id);
await pg.fill('.at-sheet input.at-name', 'Cassette Alpes'); await pg.press('.at-sheet input.at-name', 'Enter');
await ev(id => Atelier.debug.act(`range:${id}:11-34`), c1); await settle();
await ev(([c, p]) => Atelier.debug.act(`cass:${c}:${p}`), [c1, p1]); await settle(); await pg.waitForTimeout(1200); await settle();
w = await ev(([c, p]) => { const A = Atelier.debug.A, x = Atelier.debug.G().cass.find(y => y.id === c); return { name: x.name, range: x.range, loc: x.loc, parent: A.C[c].parent === A.W[p].rear }; }, [c1, p1]);
assert(w.name === 'Cassette Alpes' && w.range === '11-34' && w.loc === p1 && w.parent, 'cassette « Cassette Alpes » 11-34 montée sur la roue AR de la nouvelle paire');
await ev(c => Atelier.debug.act(`cassette:${c}`), c1); await settle();
assert(await pg.locator('.at-sheet [data-at$=":10-33"]').count() === 1, 'étagements SRAM (10-xx) proposés');
await pg.fill('#atRange', '10 - 44'); await pg.locator('.at-sheet [data-at^="rangeset:"]').click();
assert(await until(c => Atelier.debug.G().cass.find(x => x.id === c).range === '10-44', c1), 'étagement libre saisi (10-44)');
await ev(c => Atelier.debug.act(`range:${c}:11-34`), c1); await ev(() => Atelier.debug.act('close')); await settle();

// entretien sur le pied d'atelier : points de contrôle, carnet du Garage
await ev(() => Atelier.debug.act('close'));
await pg.tap('.at-dock [data-at^="maint"]'); await pg.waitForTimeout(2600); await settle();
w = await ev(([id, p]) => { const A = Atelier.debug.A; return { seat: A.B[id].holder.parent === A.stand.seat, rear: A.W[p].rear.parent === A.B[id].anchorR, dots: document.querySelectorAll('.at-dot').length, rig: A.stand.rig.visible }; }, [bikeId, p1]);
assert(w.seat && w.rear && w.dots === 6 && w.rig, 'entretien : vélo sur le pied d\'atelier avec sa roue AR, 6 points de contrôle');
await shot('entretien');
await ev(() => Atelier.debug.act('pcard:chain')); await pg.waitForTimeout(200);
await pg.locator('.at-sheet [data-at="care:lube"]').click();
assert(await until(id => S.garage.log.some(e => e.bikeId === id && e.kind === 'lube' && e.date === todayISO()) && Atelier.debug.st.done.chain === true, bikeId), 'lubrification notée dans le carnet du Garage');
await pg.fill('#atMeas', '0.4'); await pg.locator('.at-sheet [data-at="measure"]').click();
assert(await until(id => S.garage.log.some(e => e.bikeId === id && e.kind === 'check' && e.value === .4), bikeId), 'mesure de chaîne notée (0,4 %)');
await ev(() => Atelier.debug.act('close'));
await ev(() => Atelier.debug.act('explode')); await pg.waitForTimeout(2800); await settle();
w = await ev(() => { const A = Atelier.debug.A; return { n: A.exp.length, nums: document.querySelectorAll('.at-num').length, panel: A.panel.visible, y: A.panel.position.y, onPanel: A.exp.every(e => e.obj.parent === A.panel) }; });
assert(w.n >= 15 && w.nums === w.n && w.panel && Math.abs(w.y - 1.325) < .01 && w.onPanel, `vue éclatée : ${w.n} pièces numérotées sur le panneau descendu du plafond`);
await shot('eclate');
await ev(() => Atelier.debug.act('part:rd'));
assert(await until(() => /Dérailleur arrière/.test(document.querySelector('.at-sheet').innerText)), 'pièce n° → fiche avec son usure');
await ev(() => Atelier.debug.act('finish')); await pg.waitForTimeout(4200); await settle();
w = await ev(([id, p]) => { const A = Atelier.debug.A; return { mode: Atelier.debug.st.mode, seat: A.B[id].holder.parent === A.trainer.seat, rear: A.W[p].rear.parent === A.groups.wheels, groups: Object.values(A.B[id].groups).every(g => g.parent === A.B[id].root) }; }, [bikeId, p1]);
assert(w.mode === 'atelier' && w.seat && w.rear && w.groups, 'terminer : pièces remontées, vélo revenu sur le home trainer, roue AR au mur');

// exposition : le vélo quitte le home trainer pour le podium avec ses deux roues et sa cassette ; le podium se déplace, le vélo suit
await ev(id => Atelier.debug.act(`spot:${id}:expo`), bikeId); await settle(); await pg.waitForTimeout(1600); await settle();
w = await ev(([id, p, c]) => { const A = Atelier.debug.A, s = S.garage.atelier.spots, h = Atelier.debug.G().cass.find(x => x.loc === 'ht');
  return { expo: s.expo, ht: s.ht, seat: A.B[id].holder.parent === A.expo.seat, front: A.W[p].front.parent === A.B[id].anchorF, rear: A.W[p].rear.parent === A.B[id].anchorR,
    cass: A.C[c].parent === A.W[p].rear, htCass: !!h && A.C[h.id].parent === A.trainer.anchor, plate: A.expo.plateName === S.garage.bikes[0].name, zone: Atelier.debug.st.zone }; }, [bikeId, p1, c1]);
assert(w.expo === bikeId && !w.ht && w.seat && w.front && w.rear && w.cass && w.htCass && w.plate && w.zone === 'expo', 'exposition : vélo debout sur le podium avec ses deux roues et sa cassette, plaque à son nom');
await shot('exposition');
const ex0 = await ev(id => Atelier.debug.world(Atelier.debug.A.B[id].holder)[0], bikeId);
assert(await ev(() => Atelier.debug.move('expo', { x: 1.6 })), 'podium d\'exposition déplacé');
assert(Math.abs(await ev(id => Atelier.debug.world(Atelier.debug.A.B[id].holder)[0], bikeId) - ex0 + .15) < .02, 'le vélo exposé suit son podium');
await ev(id => Atelier.debug.act(`spot:${id}:ht`), bikeId); await settle(); await pg.waitForTimeout(1600); await settle();
w = await ev(([id, p]) => { const A = Atelier.debug.A, s = S.garage.atelier.spots; return { ht: s.ht, expo: s.expo, seat: A.B[id].holder.parent === A.trainer.seat, rear: A.W[p].rear.parent === A.groups.wheels }; }, [bikeId, p1]);
assert(w.ht === bikeId && !w.expo && w.seat && w.rear, 'retour sur le home trainer : la roue AR raccrochée au mur');

// aménagement : glisser, tourner, collisions, sauvegarde
await ev(() => Atelier.debug.act('arrange')); await settle();
assert(await ev(() => Atelier.debug.st.mode === 'arrange' && !Atelier.debug.A.ceil.visible && document.querySelectorAll('.at-tag.at-mv').length === 8), 'aménager : vue de dessus, 8 meubles à déplacer');
const x0 = await ev(id => Atelier.debug.world(Atelier.debug.A.B[id].holder)[0], bikeId);
assert(await ev(() => Atelier.debug.move('ht', { x: -.9, z: 1.25 })), 'tapis du home trainer déplacé');
w = await ev(id => ({ x: Atelier.debug.world(Atelier.debug.A.B[id].holder)[0], saved: S.garage.atelier.layout.ht }), bikeId);
assert(Math.abs(w.x - x0 - .42) < .02 && w.saved?.x === -.9 && w.saved?.z === 1.25, 'le vélo suit son tapis, position enregistrée');
await ev(() => Atelier.debug.act('arrsel:ht')); await ev(() => Atelier.debug.act('rot:90')); await settle();
w = await ev(id => ({ r: S.garage.atelier.layout.ht.r, q: Atelier.debug.A.B[id].holder.getWorldQuaternion(new THREE.Quaternion()).y }), bikeId);
assert(w.r === 90 && Math.abs(Math.abs(w.q) - Math.SQRT1_2) < .02, 'tapis tourné d\'un quart de tour, le vélo avec');
assert(await ev(() => { Atelier.debug.move('stand', { x: -1.0, z: 1.3 }); const R = Atelier.debug.rectOf('stand'); return Atelier.debug.valid('stand', Atelier.debug.lay('stand')) && !(Math.abs(R.x + 1.06) < .1 && Math.abs(R.z - 1.22) < .1); }), 'collision : le pied d\'atelier ne passe pas sur le tapis du home trainer');
await settle(); const pz0 = await ev(() => Atelier.debug.lay('pump').z);
// poignée de la pompe : on attend qu'elle soit posée (les étiquettes voisines s'écartent à l'image suivante) et bien sous le doigt
const [hx, hy] = await pg.waitForFunction(() => { const r = document.querySelector('.at-tag.at-mv[data-item="pump"]')?.getBoundingClientRect(); if (!r) return null;
  const x = r.left + r.width/2, y = r.top + r.height/2, k = `${x.toFixed(0)},${y.toFixed(0)}`, same = window.__pumpAt === k; window.__pumpAt = k;
  return same && document.elementFromPoint(x, y)?.closest('[data-item="pump"]') ? [x, y] : null; }, null, { timeout: 8000, polling: 300 }).then(h => h.jsonValue());
await pg.mouse.move(hx, hy); await pg.mouse.down(); for (let i = 1; i <= 6; i++) await pg.mouse.move(hx, hy - i*12); await pg.mouse.up(); await pg.waitForTimeout(200);
const pz1 = await ev(() => S.garage.atelier.layout.pump?.z);
console.log('pompe', pz0, '→', pz1);
assert(pz1 != null && pz1 < pz0 - .1, 'pompe glissée au doigt par sa poignée');
await shot('amenager');
await ev(() => Atelier.debug.act('arrdone')); await settle();
assert(await ev(() => Atelier.debug.st.mode === 'atelier' && Atelier.debug.A.ceil.visible), 'fin de l\'aménagement : retour dans la pièce');

// fermer, rouvrir : tout est conservé (et enregistré dans l'état local)
await ev(() => Atelier.close()); await pg.waitForTimeout(300);
assert(await ev(() => !document.querySelector('.at3d') && !Atelier.debug.A), 'atelier fermé, retour au Garage');
w = await ev(() => JSON.parse(localStorage.getItem('ftpb_state_v1')).garage.atelier);
assert(w.layout?.ht?.r === 90 && w.layout?.expo?.x === 1.6 && w.wheels.length === 2 && w.cass.some(c => c.name === 'Cassette Alpes'), 'atelier enregistré dans l\'état local (disposition, roues, cassettes)');
await pg.tap('[data-atelier]'); await pg.waitForFunction(() => Atelier.debug.A?.R && !document.querySelector('.at-load'), null, { timeout: 90000 }); await settle();
w = await ev(([id, p, c]) => { const A = Atelier.debug.A, G = Atelier.debug.G(); return { ht: S.garage.atelier.layout.ht, pair: G.wheels.find(x => x.bikeId === id)?.id, cass: G.cass.find(x => x.id === c)?.loc, wheels: G.wheels.length, front: A.W[p].front.parent === A.B[id].anchorF, q: A.B[id].holder.getWorldQuaternion(new THREE.Quaternion()).y }; }, [bikeId, p1, c1]);
assert(w.ht?.r === 90 && Math.abs(Math.abs(w.q) - Math.SQRT1_2) < .02 && w.pair === p1 && w.cass === p1 && w.wheels === 2 && w.front, 'réouverture : disposition, roues et cassettes retrouvées');
await shot('retour');
console.log(ok && !errs.length ? 'OK' : 'ÉCHEC', 'erreurs', errs); await b.close(); process.exit(ok && !errs.length ? 0 : 1);
