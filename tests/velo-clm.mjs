// Garage › gabarit « Vélo de CLM / triathlon » : questionnaire (freins à disque seulement), maquette 3D models/velo-clm.js (prolongateurs, repose-bras,
// cintre de base à crochets, bidons, mono plateau sans dérailleur avant, roue AR lenticulaire, jante AV de 80), roue à rayons au choix, vue éclatée ; atelier : paire d'origine avec lenticulaire, roue pendue
// par l'axe sur un crochet du bas, pince du pied d'atelier sur la tige de selle aéro, réglage « Lenticulaire » de la paire.
const pw = (await import('module')).createRequire(process.env.PW_REQUIRE || '/opt/npm-tools/node_modules/x.js')('playwright');
const out = process.env.SCRATCH || '.';
const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); const ctx = await b.newContext({ ...pw.devices['iPhone 13'] });
const pg = await ctx.newPage(); const errs = []; pg.on('console', m => { if (/warn|error/.test(m.type()) && !/GL Driver|GPU stall/.test(m.text())) console.log('[console]', m.type(), m.text().slice(0, 300)); }); pg.on('pageerror', e => errs.push(e.message));
for (const f of ['build/three.min.js', 'examples/js/controls/OrbitControls.js', 'examples/js/environments/RoomEnvironment.js', 'examples/js/loaders/GLTFLoader.js', 'examples/js/loaders/DRACOLoader.js', 'examples/js/libs/meshopt_decoder.js'])
  await pg.route('**/three@0.147.0/' + f, r => r.fulfill({ path: out + '/node_modules/three/' + f, contentType: 'application/javascript' }));
await pg.clock.setFixedTime(new Date('2026-11-13T20:00:00+01:00'));
await pg.addInitScript(() => {
  if (localStorage.getItem('ftpb_state_v1')) return;
  const days = {0:{avail:false,max:75},1:{avail:true,max:75},2:{avail:false,max:75},3:{avail:true,max:75},4:{avail:false,max:75},5:{avail:true,max:120},6:{avail:false,max:120}};
  localStorage.setItem('ftpb_state_v1', JSON.stringify({ version:2, updatedAt:Date.now(), profile:{ name:'A', sex:'M', age:30, weightKg:80, heightCm:180, ftp:250, hrMax:195, goalFtp:300, goalDate:'2027-03-05', endDate:'2027-03-15', minSessions:35, startDate:'2026-10-20', days, keyPerWeek:2, optionalPerWeek:0, testProtocol:'ramp', intensityAdj:1, ctl0:40 }, plan:[], activities:[], ftpHistory:[{date:'2026-10-20', ftp:250, source:'test'}], onboarded:true }));
});
await pg.goto(new URL('../index.html', import.meta.url).href); await pg.waitForTimeout(300);
let ok = true; const T0 = Date.now(); const assert = (c, m) => { if (!c) { ok = false; console.error('ÉCHEC', m); } else console.log('ok', m, ((Date.now() - T0)/1000).toFixed(0) + ' s'); };
const ev = (f, a) => pg.evaluate(f, a), wz = async (a, v) => { await pg.tap(`[data-wz="${a}"]${v != null ? `[data-v="${v}"]` : ''}`); await pg.waitForTimeout(120); };

// questionnaire : gabarit générique CLM / triathlon → transmission SRAM AXS, freins à disque seulement
await pg.tap('#tabs [data-tab="profile"]'); await pg.waitForTimeout(150); await pg.tap('.gr-tile'); await pg.waitForTimeout(150);
await pg.tap('[data-gr="addask"]'); await pg.waitForTimeout(150);
assert(await pg.locator('[data-wz="frame"][data-v="clm"]').count() === 1, 'questionnaire : gabarit « Vélo de CLM / triathlon »');
await wz('frame', 'clm'); await wz('brand', 'SRAM');
if (await pg.locator('[data-wz="shift"]').count()) await wz('shift', 'elec');
assert(await pg.locator('[data-wz="brakes"][data-v="rim"]').count() === 0, 'CLM : pas de freins à patins proposés');
const picks = await pg.locator('[data-wz="pick"]').allInnerTexts(); assert(picks.some(x => /Force/.test(x)), `déclinaisons SRAM AXS à disques (${picks.length})`);
await pg.locator('[data-wz="pick"]').filter({ hasText: 'Force eTap AXS' }).first().tap(); await pg.waitForTimeout(400);
let bk = await ev(() => { const b = S.garage.bikes[0]; return { model: b.model, name: b.name, brakes: Garage.variant(b).brakes, group: b.groupset, shape: Bike3D.shapeOf(b.model), look: Bike3D.lookOf(b.look, b.model) }; });
assert(bk.model === 'clm' && bk.shape === 'clm' && bk.name === 'Vélo de CLM' && bk.brakes === 'disc' && /^sr-force/.test(bk.group || '') && bk.look.rim === 80 && bk.look.disc === true, `vélo créé : gabarit CLM, disques, jante AV 80, lenticulaire (${JSON.stringify(bk)})`);

// maquette 3D du Garage
await pg.waitForSelector('#gr3d canvas', { timeout: 30000 }); await pg.waitForFunction(() => Bike3D.R?.ft, null, { timeout: 90000 }); await pg.waitForTimeout(800);
const parts3d = () => ev(() => { const R = Bike3D.R, n = new Set(); R.root.traverse(o => { if (o.userData.part) n.add(o.userData.part); }); let spokesR = 0; R.groups.wheelR.traverse(o => { if (o.isMesh && !o.userData.part && o.geometry.index && o.geometry.attributes.position.count > 2000 && !o.geometry.attributes.uv) spokesR++; });
  return { key: R.key, groups: Object.keys(R.groups), names: [...n], clm: !!window.FTPB_BIKE_CLM, aero: !!window.FTPB_BIKE, look: R.ft.look, spokesR }; });
let p3 = await parts3d(); console.log('3D', p3.key, p3.groups.join(','));
const want = ['Frame_Paint', 'Fork_Paint', 'Cockpit_Carbon', 'Extensions', 'Arm_Cups', 'Arm_Pads', 'Hood_R', 'Lever_L', 'Bartape_R', 'Bottles', 'Bottle_Cages', 'Bento', 'Seatpost_Paint', 'Saddle_Cover', 'Caliper_R', 'Rotor_F_Band', 'Cassette_Cogs', 'Chain_Outer', 'Chainring_Big', 'Chainring_Cover'];
assert(p3.clm && !p3.aero && want.every(n => p3.names.includes(n)) && !p3.names.some(n => /^RimBrake_|Cassette_Cogs_11/.test(n)), `maquette CLM chargée seule (models/velo-clm.js) : ${want.filter(n => !p3.names.includes(n)).join(', ') || 'toutes les pièces'}`);
assert(!p3.names.some(n => n === 'FD' || n === 'Chainring_Small') && !p3.groups.includes('fd'), 'mono plateau : ni petit plateau ni dérailleur avant');
const gp = await ev(() => { const b = S.garage.bikes[0], ps = Garage.allParts(b); return { fd: ps.some(i => i.k === 'fd'), rings: ps.find(i => i.k === 'rings'), oneby: Garage.variant(b).oneby }; });
assert(gp.oneby && !gp.fd && gp.rings?.l === 'Plateau' && /54 dents/.test(gp.rings?.spec || ''), `Garage : pas de dérailleur avant à contrôler, « Plateau » unique 54 dents (${gp.rings?.l} · ${gp.rings?.spec})`);
assert(['cockpit', 'levers', 'ravito', 'wheelR', 'tireR', 'cassette', 'calipers', 'rotors'].every(k => p3.groups.includes(k)) && /\|ftp80d$/.test(p3.key) && p3.look.disc, 'composants : cockpit, leviers, ravitaillement ; roue AR lenticulaire, jante AV de 80');
const dims = await ev(() => { const R = Bike3D.R, bx = k => new THREE.Box3().setFromObject(R.groups[k]), w = bx('wheelR').getSize(new THREE.Vector3()), f = bx('wheelF').getSize(new THREE.Vector3()), c = bx('cockpit'), s = bx('saddle');
  return { rearW: w.z, frontW: f.z, cockFront: c.max.x - R.root.position.x, saddleTop: s.max.y, cockTop: c.max.y, wb: bx('wheelF').getCenter(new THREE.Vector3()).x - bx('wheelR').getCenter(new THREE.Vector3()).x }; });
console.log('cotes', JSON.stringify(dims));
assert(dims.cockFront > 1.15 && dims.saddleTop > .98 && dims.saddleTop < 1.06 && dims.cockTop < dims.saddleTop && dims.wb > 1.0 && dims.wb < 1.03, 'géométrie CLM : prolongateurs devant l\'axe AV, repose-bras sous la selle, empattement ≈ 1,02 m');
await ev(() => window.scrollTo(0, 0)); await pg.waitForTimeout(200); await pg.locator('.gr-stage').screenshot({ path: out + '/clm-3d.png' });

// apparence : roue arrière à rayons, puis retour à la lenticulaire
await pg.tap('.gr-tabs [data-v="bike"]').catch(() => {}); await pg.waitForTimeout(200);
assert(await pg.locator('[data-grlook="disc"]').count() === 2, 'onglet Vélo : choix « Lenticulaire / À rayons » pour le gabarit CLM');
await pg.locator('[data-grlook="disc"][data-v="0"]').tap(); await pg.waitForFunction(() => Bike3D.R && /\|ftp80$/.test(Bike3D.R.key), null, { timeout: 40000 }).catch(() => {}); await pg.waitForTimeout(300);
p3 = await parts3d(); assert(/\|ftp80$/.test(p3.key) && p3.look.disc === false && await ev(() => S.garage.bikes[0].look.disc === false), 'roue AR à rayons : maquette reconstruite');
await pg.locator('[data-grlook="disc"][data-v="1"]').tap(); await pg.waitForFunction(() => Bike3D.R && /\|ftp80d$/.test(Bike3D.R.key), null, { timeout: 40000 }).catch(() => {});
assert(await ev(() => /\|ftp80d$/.test(Bike3D.R.key)), 'retour à la lenticulaire');

// vue éclatée : le ravitaillement se détache comme un composant
await ev(() => Bike3D.explode(true)); await pg.waitForFunction(() => Bike3D.t > .99, null, { timeout: 40000 }).catch(() => {}); await pg.waitForTimeout(300);
assert(await ev(() => Bike3D.R.groups.ravito.position.length() > .3 && Bike3D.LABEL.ravito === 'Ravitaillement'), 'vue éclatée : ravitaillement détaché');
await ev(() => Bike3D.explode(false)); await pg.waitForTimeout(300);

// atelier : paire de CLM (lenticulaire), vélo du home trainer direct → roue AR pendue par l'axe sur un crochet du bas
await pg.tap('[data-atelier]');
await pg.waitForFunction(() => Atelier.debug.A?.R && !document.querySelector('.at-load'), null, { timeout: 120000 });
await pg.waitForFunction(() => Atelier.debug.flights === 0, null, { timeout: 20000 }).catch(() => {});
const id = await ev(() => S.garage.bikes[0].id);
let at = await ev(id => { const a = Atelier.debug.G(), A = Atelier.debug.A, p = a.wheels[0]; return { ht: a.spots.ht, n: a.wheels.length, p, shape: A.B[id]?.shape, disc: !!A.W[p.id]?.rear.userData.disc, front: A.W[p.id]?.front.userData.disc,
  rearOnWall: A.W[p.id]?.rear.parent === A.groups.wheels, off: A.B[id]?.standOff.x }; }, id);
console.log('atelier', JSON.stringify(at));
assert(at.ht === id && at.shape === 'clm' && at.n === 1 && at.p.depthR === 'disc' && at.p.depth === 80 && at.p.name === 'Roues de CLM' && at.disc && !at.front, 'atelier : vélo CLM sur le home trainer, paire d\'origine 80 mm + lenticulaire');
assert(at.rearOnWall && at.p.slot >= 2, 'home trainer direct : la lenticulaire attend au mur, sur un crochet du bas');
assert(at.off < -.03 && at.off > -.10, 'pied d\'atelier : vélo reculé pour que la pince serre la tige de selle aéro');
await pg.screenshot({ path: out + '/clm-atelier.png' });
await ev(id => Atelier.debug.act('maint:' + id), id); await pg.waitForFunction(() => Atelier.debug.flights === 0, null, { timeout: 20000 }).catch(() => {}); await pg.waitForTimeout(300);
const pinch = await ev(id => { const A = Atelier.debug.A, h = A.B[id].holder; return { onStand: Atelier.debug.st.onStand === id, dx: h.position.x - A.stand.seat.getWorldPosition(new THREE.Vector3()).x }; }, id);
assert(pinch.onStand, 'entretien du vélo CLM sur le pied d\'atelier');
const pts = await ev(id => Atelier.debug.points(id).map(p => p.l), id);
assert(pts.includes('Dérailleur et galets') && pts.includes('Cassette et plateau'), `points de contrôle du mono plateau (${pts.join(', ')})`);
await pg.screenshot({ path: out + '/clm-pied.png' });
await ev(() => Atelier.debug.act('finish')).catch(() => {}); await pg.waitForFunction(() => Atelier.debug.flights === 0, null, { timeout: 20000 }).catch(() => {});

// réglages de la paire : jante arrière classique puis retour à la lenticulaire
const pid = at.p.id;
await ev(pid => Atelier.debug.act('depthr:' + pid + ':62'), pid); await pg.waitForTimeout(300);
let p = await ev(pid => { const p = Atelier.debug.G().wheels.find(x => x.id === pid), A = Atelier.debug.A; return { d: p.depthR, disc: !!A.W[pid].rear.userData.disc }; }, pid);
assert(p.d === 62 && !p.disc, 'paire : jante arrière de 62 mm (roue à rayons reconstruite)');
await ev(pid => Atelier.debug.act('depthr:' + pid + ':disc'), pid); await pg.waitForTimeout(300);
p = await ev(pid => { const p = Atelier.debug.G().wheels.find(x => x.id === pid), A = Atelier.debug.A; return { d: p.depthR, disc: !!A.W[pid].rear.userData.disc, chip: !!document.querySelector(`[data-at="depthr:${pid}:disc"].on`) }; }, pid);
assert(p.d === 'disc' && p.disc && p.chip, 'paire : retour à la lenticulaire (puce « Lenticulaire » active)');

assert(!errs.length, 'aucune erreur JS ' + errs.join(' | '));
await b.close(); process.exit(ok ? 0 : 1);
