// Profil › GARAGE : ajout de l'Aeroad CFR, km route / home trainer (vélotaf exclu), usure, entretien, pression, journal, maquette 3D éclatée.
const pw = (await import('module')).createRequire(process.env.PW_REQUIRE || '/opt/npm-tools/node_modules/x.js')('playwright');
const out = process.env.SCRATCH || '.';
const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); const ctx = await b.newContext({ ...pw.devices['iPhone 13'] });
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.route('**/three@0.147.0/build/three.min.js', r => r.fulfill({ path: out + '/node_modules/three/build/three.min.js', contentType: 'application/javascript' }));
await pg.route('**/three@0.147.0/examples/js/controls/OrbitControls.js', r => r.fulfill({ path: out + '/node_modules/three/examples/js/controls/OrbitControls.js', contentType: 'application/javascript' }));
await pg.clock.setFixedTime(new Date('2026-11-13T20:00:00+01:00'));
await pg.addInitScript(() => {
  const days = {0:{avail:false,max:75},1:{avail:true,max:75},2:{avail:false,max:75},3:{avail:true,max:75},4:{avail:false,max:75},5:{avail:true,max:120},6:{avail:false,max:120}};
  const ts = s => Math.floor(Date.parse(s)/1000);
  const activities = [
    { id:'h1', date:'2026-11-10', name:'Seuil 2x15', durationS:3600, indoor:true, hasPower:true, tss:80, source:'intervals', startTs:ts('2026-11-10T19:00:00+01:00'), distanceKm:36 },
    { id:'h2', date:'2026-11-05', name:'HT sans distance', durationS:3600, indoor:true, hasPower:true, tss:60, source:'fit', startTs:ts('2026-11-05T19:00:00+01:00') }, // 60 min → 30 km estimés
    { id:'o1', date:'2026-11-08', name:'Longchamp', durationS:9000, indoor:false, hasPower:false, tss:150, source:'intervals', startTs:ts('2026-11-08T09:00:00+01:00'), distanceKm:80 },
    { id:'o2', date:'2026-10-25', name:'Vallée de Chevreuse', durationS:12600, indoor:false, hasPower:false, tss:170, source:'intervals', startTs:ts('2026-10-25T09:00:00+02:00'), distanceKm:102 },
    { id:'t1', date:'2026-11-12', name:'Vélotaf', durationS:1100, indoor:false, hasPower:false, tss:10, source:'intervals', startTs:ts('2026-11-12T08:10:00+01:00'), distanceKm:6.1 },
  ];
  localStorage.setItem('ftpb_state_v1', JSON.stringify({ version:2, updatedAt:Date.now(), profile:{ name:'A', sex:'M', age:30, weightKg:84, heightCm:181, ftp:250, hrMax:195, goalFtp:300, goalDate:'2027-03-05', endDate:'2027-03-15', minSessions:35, startDate:'2026-10-21', days, keyPerWeek:2, optionalPerWeek:0, testProtocol:'ramp', intensityAdj:1, ctl0:40 }, plan:[], activities, ftpHistory:[{date:'2026-10-20',ftp:250,source:'initial'}], settings:{theme:'dark'} }));
});
await pg.goto(new URL('../index.html', import.meta.url).href); await pg.waitForTimeout(300);
let ok = true; const assert = (c, m) => { if (!c) { ok = false; console.error('ÉCHEC', m); } else console.log('ok', m); };
await pg.tap('#tabs [data-tab="profile"]'); await pg.waitForTimeout(150);
assert(/Garage/i.test(await pg.locator('.gr-tile').innerText()), 'Profil : tuile GARAGE');
await pg.tap('.gr-tile'); await pg.waitForTimeout(150);
await pg.tap('[data-gr="add"][data-m="aeroad-cfr"]'); await pg.waitForTimeout(400);
const g = await pg.evaluate(() => { const b = S.garage.bikes[0], s = Garage.stats(b); return { since: b.since, road: s.road, ht: s.ht, n: s.n, model: b.model }; });
console.log('vélo', g);
// route 80 + 102 = 182 ; HT 36 + 30 (estimé) = 66 ; vélotaf exclu
assert(g.model === 'aeroad-cfr' && g.since === '2026-10-25', 'Aeroad CFR, suivi depuis la 1re sortie hors vélotaf');
assert(Math.round(g.road) === 182 && Math.round(g.ht) === 66 && g.n === 4, 'km route 182 / HT 66 (vélotaf exclu, HT sans distance à 30 km/h)');
const kms = (await pg.locator('.gr-kms').innerText()).replace(/\s+/g, ' '); console.log('kms', kms);
assert(/248/.test(await pg.locator('.gr-km').innerText()), 'total 248 km affiché');
// usure : chaîne = route + HT ; pneu = route seule ; direction = route + 1,5 × HT
const w = await pg.evaluate(() => { const b = S.garage.bikes[0], P = k => Garage.partInfo(b, k); return { chain: P('chain').used, tire: P('tireR').used, head: P('headset').used, cas: P('cassette').used, di2: P('di2').rem }; });
console.log('usure', w);
assert(Math.round(w.chain) === 248 && Math.round(w.tire) === 182 && Math.round(w.head) === 281 && Math.round(w.cas) === 182, 'usure : chaîne route+HT, pneu et cassette route (Flux 2 direct), direction ×1,5 HT');
// pression : 84 + 7,12 + 1,5 kg, route usée, chambre, 26/28 mm sur 22 mm internes
const pr = await pg.evaluate(() => Garage.pressure(S.garage.bikes[0]));
console.log('pression', pr.f, pr.r);
assert(pr.f.bar > 4 && pr.f.bar < 5.5 && pr.r.bar > 4 && pr.r.bar < 5.5, 'pression avant / arrière plausible (4–5,5 bar)');
await pg.selectOption('[data-grt="surface"]', 'cobble'); await pg.waitForTimeout(150);
const pr2 = await pg.evaluate(() => Garage.pressure(S.garage.bikes[0]));
assert(pr2.r.psi < pr.r.psi, 'route pavée → pression plus basse');
await pg.check('[data-grt="hookless"]'); await pg.selectOption('[data-grt="surface"]', 'new'); await pg.waitForTimeout(150);
assert((await pg.evaluate(() => Garage.pressure(S.garage.bikes[0]))).r.psi <= 72.5, 'hookless : plafond 5 bar');
// entretien : lubrification → compteur à zéro
await pg.tap('[data-gr="care"][data-k="lube"]'); await pg.waitForTimeout(150);
assert(await pg.evaluate(() => Garage.careInfo(S.garage.bikes[0], Garage.CARE[0]).km === 0), 'chaîne lubrifiée aujourd\'hui : 0 km depuis');
// remplacement de la chaîne + mesure
await pg.tap('[data-gr="part"][data-k="chain"]'); await pg.waitForTimeout(150);
await pg.fill('#grRepP', '45'); await pg.fill('#grRepS', 'Shimano XTR M9100'); await pg.tap('[data-gr="replace"][data-k="chain"]'); await pg.waitForTimeout(150);
const c2 = await pg.evaluate(() => ({ used: Garage.partInfo(S.garage.bikes[0], 'chain').used, spent: S.garage.log.reduce((s, e) => s + (+e.price || 0), 0) }));
assert(c2.used === 0 && c2.spent === 45, 'chaîne remplacée : compteur à zéro, 45 € au journal');
// vélotaf réattribué à la main
const bid = await pg.evaluate(() => S.garage.bikes[0].id); await pg.selectOption('[data-grassign="a:t1"]', bid); await pg.waitForTimeout(150);
assert(await pg.evaluate(() => Garage.stats(S.garage.bikes[0]).n === 5), 'sortie vélotaf attribuée à la main au vélo de tri');
await pg.selectOption('[data-grassign="a:t1"]', ''); await pg.waitForTimeout(150);
// 3D : maquette chargée, toucher → vue éclatée avec témoins
await pg.waitForSelector('#gr3d canvas', { timeout: 15000 }); await pg.waitForTimeout(600);
await pg.locator('#gr3d').scrollIntoViewIfNeeded();
await pg.screenshot({ path: out + '/garage-3d.png' });
const box = await pg.locator('#gr3d').boundingBox(); await pg.mouse.click(box.x + box.width*0.5, box.y + box.height*0.55); await pg.waitForFunction(() => Bike3D.t > 0.99, null, { timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(300);
const tags = await pg.$$eval('.gr-tag', t => t.map(x => x.dataset.g3)); console.log('étiquettes', tags.join());
assert(await pg.evaluate(() => Garage.explode && Bike3D.t > 0.95), 'toucher le vélo → vue éclatée');
assert(['tireF', 'tireR', 'chain', 'cassette', 'battery', 'headset'].every(k => tags.includes(k)), 'témoins d\'usure / batterie sur les composants');
await pg.screenshot({ path: out + '/garage-exploded.png' });
await pg.locator('.gr-tag[data-g3="battery"]').click(); await pg.waitForTimeout(200);
assert(/Batterie Di2/.test(await pg.locator('#dlgBody').innerText()), 'toucher un témoin → fiche du composant');
await pg.screenshot({ path: out + '/garage-part.png' });
await pg.tap('#dlgBody [data-gr="charge"]'); await pg.waitForTimeout(200);
assert(await pg.evaluate(() => Garage.partInfo(S.garage.bikes[0], 'di2').rem === 1), 'batterie rechargée → 100 %');
await pg.screenshot({ path: out + '/garage-full.png', fullPage: true });
// tuile du Profil
await pg.tap('.pane-head [data-pp="back"]'); await pg.waitForTimeout(150);
console.log('tuile', (await pg.locator('.gr-tile').innerText()).replace(/\s+/g, ' '));
assert(/Vélo de tri/.test(await pg.locator('.gr-tile').innerText()), 'tuile : vélo de tri et son composant le plus usé');
console.log(ok && !errs.length ? 'OK' : 'ÉCHEC', 'erreurs', errs); await b.close(); process.exit(ok && !errs.length ? 0 : 1);
