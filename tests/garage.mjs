// Profil › GARAGE : carnet de vie du vélo — km route / HT (vélotaf exclu, vélo Strava), usure (estimée, inspectée, mesurée, lue), assistant d'entretien
// (pluie, home trainer), achats par catégorie, pression (estimation + SILCA saisi), maquette 3D (studio, éclaté ingénieur, fiche), import GLB.
const pw = (await import('module')).createRequire(process.env.PW_REQUIRE || '/opt/npm-tools/node_modules/x.js')('playwright');
const out = process.env.SCRATCH || '.';
const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); const ctx = await b.newContext({ ...pw.devices['iPhone 13'] });
const pg = await ctx.newPage(); const errs = []; pg.on('console', m => { if (/warn|error/.test(m.type())) console.log('[console]', m.type(), m.text().slice(0, 300)); }); pg.on('requestfailed', r => console.log('[échec requête]', r.url().slice(0, 120))); pg.on('pageerror', e => errs.push(e.message));
for (const f of ['build/three.min.js', 'examples/js/controls/OrbitControls.js', 'examples/js/environments/RoomEnvironment.js', 'examples/js/loaders/GLTFLoader.js', 'examples/js/loaders/DRACOLoader.js', 'examples/js/exporters/GLTFExporter.js'])
  await pg.route('**/three@0.147.0/' + f, r => r.fulfill({ path: out + '/node_modules/three/' + f, contentType: 'application/javascript' }));
await pg.clock.setFixedTime(new Date('2026-11-13T20:00:00+01:00'));
await pg.addInitScript(() => {
  const days = {0:{avail:false,max:75},1:{avail:true,max:75},2:{avail:false,max:75},3:{avail:true,max:75},4:{avail:false,max:75},5:{avail:true,max:120},6:{avail:false,max:120}};
  const ts = s => Math.floor(Date.parse(s)/1000);
  const activities = [
    { id:'h1', date:'2026-11-10', name:'Seuil 2x15', durationS:3600, indoor:true, hasPower:true, tss:80, source:'intervals', startTs:ts('2026-11-10T19:00:00+01:00'), distanceKm:36 },
    { id:'h2', date:'2026-11-05', name:'HT sans distance', durationS:3600, indoor:true, hasPower:true, tss:60, source:'fit', startTs:ts('2026-11-05T19:00:00+01:00') }, // 60 min → 30 km estimés
    { id:'o1', date:'2026-11-08', name:'Longchamp', durationS:9000, indoor:false, hasPower:false, tss:150, source:'strava', startTs:ts('2026-11-08T09:00:00+01:00'), distanceKm:80, gearId:'b111', gearName:'Aeroad' },
    { id:'o2', date:'2026-10-25', name:'Vallée de Chevreuse', durationS:12600, indoor:false, hasPower:false, tss:170, source:'intervals', startTs:ts('2026-10-25T09:00:00+02:00'), distanceKm:102 },
    { id:'t1', date:'2026-11-12', name:'Vélotaf', durationS:1100, indoor:false, hasPower:false, tss:10, source:'intervals', startTs:ts('2026-11-12T08:10:00+01:00'), distanceKm:6.1 },
    { id:'g2', date:'2026-11-11', name:'Sortie vélo taf longue', durationS:3600, indoor:false, hasPower:false, tss:40, source:'strava', startTs:ts('2026-11-11T18:00:00+01:00'), distanceKm:25, gearId:'b222', gearName:'Vélo taf' },
  ];
  localStorage.setItem('ftpb_state_v1', JSON.stringify({ version:2, updatedAt:Date.now(), profile:{ name:'A', sex:'M', age:30, weightKg:84, heightCm:181, ftp:250, hrMax:195, goalFtp:300, goalDate:'2027-03-05', endDate:'2027-03-15', minSessions:35, startDate:'2026-10-21', days, keyPerWeek:2, optionalPerWeek:0, testProtocol:'ramp', intensityAdj:1, ctl0:40 }, plan:[], activities, ftpHistory:[{date:'2026-10-20',ftp:250,source:'initial'}], settings:{theme:'dark'} }));
});
await pg.goto(new URL('../index.html', import.meta.url).href); await pg.waitForTimeout(300);
let ok = true; const T0 = Date.now(); const assert = (c, m) => { if (!c) { ok = false; console.error('ÉCHEC', m); } else console.log('ok', m, ((Date.now() - T0)/1000).toFixed(0) + ' s'); };
const ev = f => pg.evaluate(f);
await pg.tap('#tabs [data-tab="profile"]'); await pg.waitForTimeout(150);
assert(/Garage/i.test(await pg.locator('.gr-tile').innerText()), 'Profil : tuile GARAGE');
await pg.tap('.gr-tile'); await pg.waitForTimeout(150);
await pg.tap('[data-gr="add"][data-m="aeroad-cfsl"]'); await pg.waitForTimeout(400);
// vélo Strava : la sortie « Aeroad » et la sortie « Vélo taf » (25 km, pas un vélotaf court) — sans lien, les deux iraient au vélo de tri
let g = await ev(() => { const b = S.garage.bikes[0], s = Garage.stats(b); return { since: b.since, road: s.road, ht: s.ht, n: s.n, model: b.model, brand: b.brand }; });
console.log('vélo', g);
assert(g.model === 'aeroad-cfsl' && g.brand === 'Canyon' && g.since === '2026-10-25', 'Aeroad CF SL Di2, suivi depuis la 1re sortie hors vélotaf');
assert(Math.round(g.road) === 207 && Math.round(g.ht) === 66 && g.n === 5, 'sans lien Strava : route 80 + 102 + 25, HT 36 + 30 estimés, vélotaf court exclu');
await pg.tap('.gr-tabs [data-v="bike"]'); await pg.waitForTimeout(150);
await pg.check('[data-grgear="b111"]'); await pg.waitForTimeout(150);
g = await ev(() => { const s = Garage.stats(S.garage.bikes[0]); return { road: s.road, n: s.n }; });
assert(Math.round(g.road) === 182 && g.n === 4, 'vélo Strava « Aeroad » coché : la sortie du vélo taf (autre vélo Strava) ne compte plus');
assert(await ev(() => !!document.querySelector('[data-grv="brakes"] option[value="rim"][selected]')), 'CF SL : freins à patins par défaut');
// usure estimée
const w = await ev(() => { const b = S.garage.bikes[0], P = k => Garage.partInfo(b, k); return { chain: P('chain').used, tire: P('tireR').used, head: P('headset').used, cas: P('cassette').used, hubR: P('hubR').used, pads: P('padsF').life, src: P('chain').src, coin: Garage.allParts(b).some(i => i.k === 'coin') }; });
console.log('usure', w);
assert(Math.round(w.chain) === 248 && Math.round(w.tire) === 182 && Math.round(w.head) === 281 && Math.round(w.cas) === 182 && Math.round(w.hubR) === 182, 'usure : chaîne route+HT, pneu / cassette / moyeu AR route seule (Flux 2 direct), direction ×1,5 HT');
assert(w.pads === 2500 && w.src === 'estimation' && !w.coin, 'patins sur jante (2 500 km), état « estimé », pas de piles de leviers en 11 v filaire');
// résumé du configurateur
const hud = (await pg.locator('.gr-stage').innerText()).replace(/\s+/g, ' '); console.log('scène', hud.slice(0, 260));
assert(/248\s*km/.test(hud) && /182 route · 66 HT/.test(hud) && /Prochaine/.test(hud), 'scène : km total, répartition route / HT, prochaine opération');
// fiche composant : inspection et mesure
await pg.tap('.gr-tabs [data-v="parts"]'); await pg.waitForTimeout(150);
await pg.tap('[data-gr="part"][data-k="tireR"]'); await pg.waitForTimeout(250);
assert(await pg.locator('#grSheet[open]').count() === 1 && /Pneu arrière/.test(await pg.locator('#grSheet').textContent()), 'fiche latérale du composant');
await pg.locator('#grInsp').fill('60'); await pg.tap('#grSheet [data-gr="inspect"]'); await pg.waitForTimeout(200);
let pi = await ev(() => Garage.partInfo(S.garage.bikes[0], 'tireR')); assert(pi.src === 'inspection' && Math.abs(pi.rem - .6) < .01, 'inspection : l\'état constaté (60 %) remplace l\'estimation');
await pg.tap('#grSheet [data-grclose]'); await pg.tap('[data-gr="part"][data-k="chain"]'); await pg.waitForTimeout(200);
await pg.fill('#grMeas', '0.5'); await pg.tap('#grSheet [data-gr="measure"]'); await pg.waitForTimeout(200);
pi = await ev(() => Garage.partInfo(S.garage.bikes[0], 'chain')); assert(pi.src === 'mesure' && Math.abs(pi.rem - (1 - .5/.75)) < .01, 'mesure de chaîne 0,5 % en 11 v → état mesuré');
await pg.locator('#grSheet details.more summary').first().click(); await pg.fill('#grRepP', '32'); await pg.fill('#grRepS', 'Shimano Ultegra HG701'); await pg.fill('#grRepF', 'Alltricks'); await pg.tap('#grSheet [data-gr="replace"]'); await pg.waitForTimeout(200);
pi = await ev(() => Garage.partInfo(S.garage.bikes[0], 'chain')); assert(pi.total === 0 && pi.rem === 1 && pi.src === 'estimation', 'chaîne posée : compteur à zéro');
assert(/pose à 248 km/.test(await pg.locator('#grSheet').textContent()), 'historique : kilométrage à la pose');
await pg.tap('#grSheet [data-grclose]');
// batterie : niveau lu
await pg.tap('[data-gr="part"][data-k="di2"]'); await pg.waitForTimeout(200); await pg.fill('#grLvl', '70'); await pg.tap('#grSheet [data-gr="level"]'); await pg.waitForTimeout(200);
pi = await ev(() => Garage.partInfo(S.garage.bikes[0], 'di2')); assert(pi.src === 'lecture' && Math.abs(pi.rem - .7) < .01, 'batterie Di2 : niveau lu 70 %');
await pg.tap('#grSheet [data-grclose]');
// entretien : la pluie rend la lubrification nécessaire
await pg.tap('.gr-tabs [data-v="care"]'); await pg.tap('[data-gr="care"][data-k="lube"]'); await pg.waitForTimeout(150);
assert(await ev(() => !Garage.careInfo(S.garage.bikes[0], Garage.CARE[0]).due), 'lubrification faite : à jour');
await ev(() => { S.garage.cond['a:o1'] = 'rain'; S.garage.log.find(e => e.kind === 'lube').date = '2026-11-07'; save(); render(); });
assert(await ev(() => { const c = Garage.careInfo(S.garage.bikes[0], Garage.CARE[0]); return c.due && c.rain; }), 'sortie sous la pluie après la lubrification → à refaire');
assert(await ev(() => Garage.careAll(S.garage.bikes[0]).some(c => c.k === 'wipe')), 'home trainer : rappel « essuyer la sueur »');
// achats : catégories et période
await pg.tap('.gr-tabs [data-v="buy"]'); await pg.tap('[data-gr="log"]'); await pg.waitForTimeout(200);
await pg.selectOption('#grLK', 'buy'); await pg.fill('#grLL', 'Lubrifiant cire'); await pg.selectOption('#grLC', 'produits'); await pg.fill('#grLPr', '18'); await pg.tap('#grSheet [data-gr="logsave"]'); await pg.waitForTimeout(200);
const sp = (await pg.locator('.gr-panel').innerText()).replace(/\s+/g, ' '); console.log('achats', sp.slice(0, 160));
assert(/50 €/.test(sp) && /Transmission/.test(sp) && /Produits/.test(sp), 'dépenses : 50 € sur 12 mois, par catégorie');
// pression : estimation + valeur SILCA saisie, plafonds
await pg.tap('.gr-tabs [data-v="pressure"]'); await pg.waitForTimeout(150);
let pr = await ev(() => Garage.pressure(S.garage.bikes[0])); console.log('pression', pr.f, pr.r);
assert(pr.f.bar > 4.5 && pr.f.bar < 7 && pr.r.bar > 4.5 && pr.r.bar < 7.5, 'pression 25 mm plausible');
await pg.fill('[data-grt="maxR"]', '5'); await pg.locator('[data-grt="maxR"]').dispatchEvent('change'); await pg.waitForTimeout(150);
assert((await ev(() => Garage.pressure(S.garage.bikes[0]))).r.bar <= 5, 'plafond : pression maxi du pneu');
await pg.fill('[data-grt="silca.f"]', '5.6'); await pg.locator('[data-grt="silca.f"]').dispatchEvent('change'); await pg.waitForTimeout(150);
assert(await ev(() => S.garage.bikes[0].tires.silca.f === 5.6) && /Valeurs SILCA officielles/.test(await pg.locator('.gr-panel').innerText()), 'valeur SILCA officielle saisie à part');
// 3D : studio, éclaté ingénieur, fiche depuis la maquette
await pg.waitForSelector('#gr3d canvas', { timeout: 20000 }); await pg.waitForTimeout(800);
await ev(() => window.scrollTo(0, 0)); await pg.waitForTimeout(200);
await pg.locator('.gr-stage').screenshot({ path: out + '/garage-3d.png' });
const box = await pg.locator('#gr3d').boundingBox(); await pg.mouse.click(box.x + box.width*.5, box.y + box.height*.55);
await pg.waitForFunction(() => Bike3D.t > .99, null, { timeout: 40000 }).catch(() => {}); await pg.waitForTimeout(600);
console.log('après toucher', await ev(() => [Garage.mode, Bike3D.t]));
const tags = await pg.$$eval('.gr-dots [data-gd]', t => t.map(x => x.dataset.gd)); console.log('étiquettes', tags.join());
assert(await ev(() => Garage.mode === 'explode' && Bike3D.t > .95), 'toucher le vélo → vue éclatée');
assert(['tireF', 'tireR', 'chain', 'cassette', 'battery', 'headset', 'calipers', 'fd'].every(k => tags.includes(k)), 'témoins sur les composants (dont dérailleur AV)');
console.log('arêtes', await ev(() => [Bike3D.R.edges?.length, Bike3D.R.groups.frame.userData.lineMat?.opacity]));
await pg.tap('[data-gr="labels"]'); await pg.waitForTimeout(500);
assert(await ev(() => Bike3D.R.edges?.length > 50 && document.querySelectorAll('.gr-lines line').length > 8), 'mode ingénieur : arêtes, étiquettes et lignes de rappel');
await pg.locator('.gr-stage').screenshot({ path: out + '/garage-exploded.png' }); await pg.tap('[data-gr="labels"]'); await pg.waitForTimeout(300);
await pg.locator('.gr-dots [data-gd="battery"]').click(); await pg.waitForTimeout(700);
assert(/Batterie Di2/.test(await pg.locator('#grSheet').textContent()) && await ev(() => Bike3D.sel === 'battery'), 'toucher un témoin → fiche + composant mis en avant');
assert(await ev(() => /^data:image\/png/.test(document.querySelector('.gr-shot')?.src || '')), 'fiche : rendu 3D du composant');
await pg.screenshot({ path: out + '/garage-part.png' });
await pg.tap('#grSheet [data-grclose]'); await pg.waitForTimeout(300);
// import d'un vrai modèle GLB (objets nommés) → composants reconnus
const glbOk = await ev(async () => {
  await new Promise((ok, ko) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/exporters/GLTFExporter.js'; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
  const T = THREE, sc = new T.Scene(), mk = (n, x, y, w = .1) => { const m = new T.Mesh(new T.BoxGeometry(w, .05, .05), new T.MeshStandardMaterial({ color: 0x222222 })); m.name = n; m.position.set(x, y, 0); sc.add(m); };
  mk('Frame', .5, .5, .6); mk('Front Tire', 1, .33, .6); mk('Rear Tire', 0, .33, .6); mk('Chain', .2, .26, .3); mk('Cassette', 0, .33); mk('Saddle', .2, .95); mk('Bolt_017', .4, .4, .02);
  const bin = await new Promise(ok => new T.GLTFExporter().parse(sc, ok, e => ok(null), { binary: true }));
  const b = S.garage.bikes[0], id = 'glb-test'; await Garage.Media.put(id, new Blob([bin], { type: 'model/gltf-binary' }));
  b.glb = { id, name: 'test', size: bin.byteLength, rotY: 0, map: {} }; save(); Garage.setMode('view'); render(); return true; }).catch(e => String(e));
await pg.waitForFunction(() => Bike3D.R?.glb, null, { timeout: 15000 }).catch(() => {});
console.log('glb état', await ev(() => [Bike3D.R?.key, document.querySelector('#gr3d')?.innerText, S.garage.bikes[0].glb]));
const gk = await ev(() => Object.keys(Bike3D.R?.groups || {}).sort().join());
console.log('glb', glbOk, gk);
assert(glbOk === true && gk === 'cassette,chain,frame,saddle,tireF,tireR', 'GLB : objets reconnus par leur nom, le reste rangé dans le cadre');
assert(/Ton modèle 3D/.test(await pg.locator('.gr-fid').innerText()), 'scène : indique que c\'est le modèle de l\'utilisateur');
await pg.screenshot({ path: out + '/garage-full.png', fullPage: true });
// film : vidéo (ici enregistrée à la volée) décodée image par image, pilotable au doigt
const filmOk = await ev(async () => {
  const c = document.createElement('canvas'); c.width = 320; c.height = 180; const x = c.getContext('2d'), rec = new MediaRecorder(c.captureStream(30), { mimeType: 'video/webm' }), parts = [];
  rec.ondataavailable = e => parts.push(e.data); rec.start(); for (let i = 0; i < 40; i++) { x.fillStyle = `hsl(${i*9},70%,50%)`; x.fillRect(0, 0, 320, 180); await new Promise(r => setTimeout(r, 33)); }
  await new Promise(r => { rec.onstop = r; rec.stop(); }); const blob = new Blob(parts, { type: 'video/webm' });
  const b = S.garage.bikes[0]; await Garage.Media.put('film-test', blob); b.film = { id: 'film-test', name: 'test.webm', size: blob.size }; save(); Garage.setMode('film'); return blob.size > 0; }).catch(e => String(e));
await pg.waitForSelector('canvas.gr-film', { timeout: 30000 }).catch(() => {});
assert(filmOk === true && await pg.locator('canvas.gr-film').count() === 1 && await ev(() => BikeFilm.cur?.frames.length >= 24), 'film : décodé en images et affiché');
await ev(() => Garage.setMode('view'));
await pg.tap('.pane-head [data-pp="back"]'); await pg.waitForTimeout(150);
console.log('tuile', (await pg.locator('.gr-tile').innerText()).replace(/\s+/g, ' '));
assert(/Vélo de tri/.test(await pg.locator('.gr-tile').innerText()) && /à surveiller|Bon état|prévoir/.test(await pg.locator('.gr-tile').innerText()), 'tuile : vélo et état général');
console.log(ok && !errs.length ? 'OK' : 'ÉCHEC', 'erreurs', errs); await b.close(); process.exit(ok && !errs.length ? 0 : 1);
