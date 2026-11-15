// Garage : « Je n'ai plus ce vélo » (vendu…) → carnet gardé, plus de sorties après la date, annulable ; suppression définitive
const pw = (await import('module')).createRequire(process.env.PW_REQUIRE || '/opt/npm-tools/node_modules/x.js')('playwright');
const out = process.env.SCRATCH || '.';
const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); const ctx = await b.newContext({ ...pw.devices['iPhone 13'] });
const pg = await ctx.newPage(); const errs = []; pg.on('console', m => { if (/warn|error/.test(m.type())) console.log('[console]', m.type(), m.text().slice(0, 300)); }); pg.on('requestfailed', r => console.log('[échec requête]', r.url().slice(0, 120))); pg.on('pageerror', e => errs.push(e.message));
await pg.route('**/pdfjs-dist@3.11.174/build/*', r => r.fulfill({ path: out + '/node_modules/pdfjs-dist/build/' + r.request().url().split('/').pop(), contentType: 'application/javascript' }));
for (const f of ['build/three.min.js', 'examples/js/controls/OrbitControls.js', 'examples/js/environments/RoomEnvironment.js', 'examples/js/loaders/GLTFLoader.js', 'examples/js/loaders/DRACOLoader.js', 'examples/js/exporters/GLTFExporter.js', 'examples/js/libs/meshopt_decoder.js'])
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
await pg.tap('.gr-tile'); await pg.waitForTimeout(150);
await ev(() => { const x = document.createElement('button'); x.dataset.gr = 'add'; x.dataset.m = 'aeroad-cfsl'; document.querySelector('.gr').append(x); x.click(); x.remove(); }); // gabarit Aeroad CF SL (création directe, sans le questionnaire) await pg.waitForTimeout(400);
const km0 = await ev(() => { const G = Garage, b = FTPB.S.garage.bikes[0]; return Math.round(G.ridesOf(b).reduce((s, r) => s + r.km, 0)); });
// 2e vélo, puis on se sépare du 1er le 9 novembre (vendu 1 500 €)
await ev(() => { const S = FTPB.S, nb = Garage.newBike('road'); nb.name = 'Route'; nb.rule = { out: true, ht: true, taf: false }; S.garage.bikes.push(nb); FTPB.save(); FTPB.render(); });
await pg.tap('[data-gr="sel"]:has-text("Vélo de tri")'); await pg.waitForTimeout(200);
await pg.tap('[data-gr="tab"][data-v="bike"]'); await pg.waitForTimeout(200);
await pg.tap('[data-gr="retire"]'); await pg.waitForTimeout(200);
await pg.fill('#grRtD', '2026-11-09'); await pg.fill('#grRtP', '1500'); await pg.fill('#grRtN', 'Vendu à Paul');
await pg.tap('#grRtR button[data-v="sold"]'); await pg.tap('[data-gr="retireok"]'); await pg.waitForTimeout(300);
const r1 = await ev(() => { const g = FTPB.S.garage, old = g.bikes.find(b => b.name === 'Vélo de tri'), nw = g.bikes.find(b => b.name === 'Route');
  return { ret: old.retired, sel: g.sel === nw.id, kmOld: Math.round(Garage.ridesOf(old).reduce((s, r) => s + r.km, 0)), after: Garage.ridesOf(old).filter(r => r.date > '2026-11-09').length,
    toNew: Garage.ridesOf(nw).filter(r => r.date > '2026-11-09' && !r.taf).length, chip: document.querySelector('.gr-bikes .gr-old')?.textContent.trim(), tile: document.querySelector('.gr-tile')?.innerText || '' }; });
console.log(JSON.stringify(r1));
assert(r1.ret?.date === '2026-11-09' && r1.ret.reason === 'sold' && r1.ret.price === 1500 && r1.ret.note === 'Vendu à Paul', 'vélo rangé : date, raison, prix, note');
assert(r1.sel, 'le vélo encore là est affiché');
assert(r1.after === 0 && r1.toNew >= 2 && r1.kmOld > 0 && r1.kmOld < km0, `plus de sorties après la date (${r1.kmOld} km gardés sur ${km0}), elles vont au vélo restant`);
assert(/🤝/.test(r1.chip || ''), 'puce « ancien vélo » dans le sélecteur');
await pg.tap('.gr-bikes .gr-old'); await pg.waitForTimeout(200);
assert(/Vendu.*9 nov/.test(await pg.locator('.gr .note.warn').first().innerText()), 'bandeau « Vendu le 9 nov. »');
await pg.screenshot({ path: out + '/garage-retire.png' });
await pg.tap('[data-gr="unretire"]'); await pg.waitForTimeout(200);
assert(await ev(() => !FTPB.S.garage.bikes.find(b => b.name === 'Vélo de tri').retired), '« Je l\'ai encore » annule');
pg.once('dialog', d => d.accept()); await pg.tap('[data-gr="tab"][data-v="bike"]'); await pg.waitForTimeout(150); await pg.tap('[data-gr="del"]'); await pg.waitForTimeout(300);
assert(await ev(() => FTPB.S.garage.bikes.length === 1), 'suppression définitive');
console.log(ok && !errs.length ? 'OK' : 'ÉCHEC', errs); await b.close(); process.exit(ok && !errs.length ? 0 : 1);
