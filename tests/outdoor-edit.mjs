// Sortie extérieure : vitesse/D+, plus de rattachement automatique d'un trajet à un test, réparation de l'existant, modification d'une activité
const pw = (await import('module')).createRequire('/opt/npm-tools/node_modules/x.js')('playwright');
const out = process.env.SCRATCH || '.';
const b = await pw.chromium.launch(); const ctx = await b.newContext({ ...pw.devices['iPhone 13'] });
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.clock.setFixedTime(new Date('2026-10-27T21:00:00+01:00'));
const url = 'file://' + new URL('../index.html', import.meta.url).pathname;
await pg.goto(url);
await pg.fill('[name=age]', '28'); await pg.fill('[name=weightKg]', '83'); await pg.fill('[name=ftp]', '255'); await pg.fill('[name=startDate]', '2026-10-21');
await pg.evaluate(() => document.querySelector('button[type=submit]').click()); await pg.waitForSelector('#tabs:not(.hidden)');
// état d'Arnaud avant correctif : trajet Apple Santé de 16 min rattaché au test rampe du 26
const testId = await pg.evaluate(() => { const S = FTPB.S;
  let t = S.plan.find(s => s.kind === 'test'); t.date = '2026-10-26'; t.workoutId = 'ramp'; t.status = 'done'; t.activityId = 'j29';
  S.activities.push({ id:'j29', source:'health', healthStart:'2026-10-26T07:08:35+00:00', date:'2026-10-26', startTs:1792998515, name:'Vélo · Intervals.icu', durationS:999, distanceKm:5.8, avgHr:103, hasPower:false, indoor:false, planId:t.id, tss:9, feel:null });
  FTPB.save(); return t.id; });
await pg.reload(); await pg.waitForSelector('#tabs:not(.hidden)');
const rep = await pg.evaluate(id => { const t = FTPB.S.plan.find(s => s.id === id), a = FTPB.S.activities.find(x => x.id === 'j29'); return { test: t.status, act: a.planId }; }, testId);
console.log('RÉPARATION', JSON.stringify(rep));
// nouvelle sortie Apple Santé le jour d'une séance clé : ne doit pas s'y rattacher ; vitesses/D+ repris
const auto = await pg.evaluate(() => { const S = FTPB.S; const k = S.plan.find(s => s.kind === 'key' && s.status === 'planned');
  Health.H.workouts.push({ start_at: k.date + 'T07:10:00+00:00', type:'Vélo', duration_min:17, distance_km:5.8, avg_hr:105, source:'Intervals.icu', indoor:false, elevation_m:42, avg_speed_kmh:20.6, max_speed_kmh:38.4 });
  Health.promoteBikes(); const a = S.activities.find(x => x.date === k.date && x.source === 'health');
  return { plan: k.status, linked: a?.planId || null, elev: a?.elevM, vmax: a?.maxSpeed, vmoy: a?.avgSpeed }; });
console.log('AUTO', JSON.stringify(auto));
// fiche + modification
await pg.evaluate(() => { activityDlg('j29'); }); await pg.waitForTimeout(200);
console.log('KPI', (await pg.locator('#dlg .grid4').innerText()).replace(/\n+/g, ' | '));
await pg.click('#editAct'); await pg.fill('#eElev', '35'); await pg.fill('#eVmax', '41.2'); await pg.fill('#eName', 'Vélotaf');
await pg.screenshot({ path: out + '/edit-1.png', fullPage: true });
await pg.click('#eSave'); await pg.waitForTimeout(200);
console.log('APRÈS', (await pg.locator('#dlg').innerText()).replace(/\n+/g, ' | ').slice(0, 300));
await pg.screenshot({ path: out + '/edit-2.png', fullPage: true });
const a = await pg.evaluate(() => { const a = FTPB.S.activities.find(x => x.id === 'j29'); return { n: a.name, e: a.elevM, v: a.maxSpeed, m: a.linkManual, p: a.planId }; });
const ok = rep.test === 'planned' && !rep.act && !auto.linked && auto.plan === 'planned' && auto.elev === 42 && a.e === 35 && a.v === 41.2 && a.n === 'Vélotaf';
console.log(JSON.stringify(a), ok ? 'OK' : 'ÉCHEC', 'erreurs', errs); await b.close(); process.exit(ok && !errs.length ? 0 : 1);
