// Plan triathlon : création depuis le calendrier, séances nat / course alignées sur les semaines vélo, semaine de course, fiche séance.
const pw = (await import('module')).createRequire('/opt/npm-tools/node_modules/x.js')('playwright');
const assert = (c, m) => { if (!c) { console.error('ÉCHEC', m); process.exitCode = 1; } else console.log('ok', m); };
const b = await pw.chromium.launch(); const ctx = await b.newContext({ ...pw.devices['iPhone 13'] });
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.clock.setFixedTime(new Date('2026-11-05T21:00:00+01:00'));
await pg.addInitScript(() => {
  if (localStorage.getItem('ftpb_state_v1')) return;
  const days = { 0:{avail:false,max:75}, 1:{avail:true,max:75}, 2:{avail:false,max:75}, 3:{avail:true,max:75}, 4:{avail:false,max:75}, 5:{avail:true,max:120}, 6:{avail:false,max:120} };
  localStorage.setItem('ftpb_state_v1', JSON.stringify({ version:1, updatedAt:Date.now(), profile:{ name:'A', sex:'M', age:28, weightKg:84, heightCm:181, ftp:260, hrMax:201, goalFtp:300, goalDate:'2027-03-05', endDate:'2027-03-15', minSessions:35, startDate:'2026-10-21', days, keyPerWeek:2, optionalPerWeek:0, holidays:true, testProtocol:'ramp', intensityAdj:1, ctl0:40 }, plan:[], activities:[], ftpHistory:[], settings:{ theme:'auto' } }));
  const W = (start_at, type, duration_min, distance_km) => ({ start_at, type, duration_min, distance_km, avg_hr:140, source:'Intervals.icu' });
  localStorage.setItem('ftpb_health_v1', JSON.stringify({ daily:[], sleep:[], token:null, workouts:[W('2026-10-27T06:04:55Z','Natation',45.5,2.625), W('2026-11-03T05:57:39Z','Natation',53.1,3.025), W('2026-10-21T10:14:32Z','Course à pied',39.3,8.29), W('2026-10-30T11:13:34Z','Course à pied',44.3,8.27)] }));
});
await pg.goto('file://' + new URL('../index.html', import.meta.url).pathname); await pg.waitForTimeout(300);
await pg.evaluate(() => { S.plan = generatePlan(S.profile); save(); render(); });
await pg.tap('button[data-tab="cal"]'); await pg.waitForTimeout(200);
await pg.locator('[data-trisetup]').first().tap(); await pg.waitForTimeout(200);
assert(await pg.inputValue('[name=css]') !== '' && /^\d'\d\d$/.test(await pg.inputValue('[name=runThr]')), 'allures pré-remplies depuis les séances');
await pg.tap('#triGo'); await pg.waitForTimeout(300);
const r = await pg.evaluate(() => ({ n: S.triPlan.length, swim: S.triPlan.filter(x => x.sport === 'swim').length, run: S.triPlan.filter(x => x.sport === 'run' && x.wid !== 'brick').length,
  race: S.triPlan.filter(x => x.sport === 'race').map(x => x.date), end: S.profile.endDate, after: S.plan.filter(s => s.date > '2027-06-05').length,
  spec: S.plan.some(s => s.block === 'Spécifique montagne'), long3h: S.plan.some(s => s.workoutId === 'end_180'), longDp: S.triPlan.filter(x => x.wid === 'long' && x.dp >= 800).length,
  weekOk: (() => { const w = S.triPlan.filter(x => x.date >= '2026-11-09' && x.date <= '2026-11-15'); return [w.filter(x => x.sport === 'swim').length, w.filter(x => x.sport === 'run').length]; })(),
  raceWeekBike: S.plan.filter(s => s.date >= '2027-05-31').map(s => s.workoutId) }));
console.log(JSON.stringify(r));
assert(r.race.join() === '2027-06-05' && r.end === '2027-06-05' && r.after === 0, 'course le 5 juin, plan vélo prolongé jusqu\'à la course');
assert(r.weekOk.join() === '2,2', '2 nat + 2 course par semaine');
assert(r.spec && r.long3h && r.longDp >= 3, 'bloc spécifique montagne : sorties vélo 3 h, sorties longues à pied avec D+');
assert(r.raceWeekBike.join() === 'openers', 'semaine de course : un seul rappel vélo, pas de test FTP');
// calendrier : ronds prévus visibles et jour cliquable avec sélecteur
const cell = pg.locator('[data-calday="2026-11-10"]');
assert(await cell.locator('i.pl.sw').count() === 1 && await cell.locator('i.pl').count() === 2, '10/11 : rond vélo + rond nat');
await cell.tap(); await pg.waitForTimeout(200);
await pg.locator('#dlg .daysel button', { hasText: 'CSS' }).tap(); await pg.waitForTimeout(150);
assert(/CSS/.test(await pg.locator('#dlg h2').first().innerText()) && await pg.locator('#dlg .tstep').count() >= 4, 'fiche nat : étapes avec allures');
await pg.tap('#triSkip'); await pg.waitForTimeout(150);
assert(await pg.evaluate(() => S.triPlan.find(x => x.date === '2026-11-10' && x.sport === 'swim').status) === 'skipped', 'séance sautée');
// séance faite : la nat du 3/11 (plan passé) ne doit pas être « manquée » si une nat existe ce jour-là
await pg.evaluate(() => { S.triPlan.push({ id:'t-done', date:'2026-11-03', sport:'swim', wid:'qual', ph:'base', v:0, f:1, kind:'key', status:'planned', week:2, block:'Base' }); });
assert(await pg.evaluate(() => triStatus(S.triPlan.find(x => x.id === 't-done'))) === 'done', 'nat du 3/11 reconnue comme faite');
console.log('errs', errs); if (errs.length) process.exitCode = 1; await b.close();
