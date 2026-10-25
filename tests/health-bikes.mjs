const pw = (await import('module')).createRequire('/opt/npm-tools/node_modules/x.js')('playwright');
const b = await pw.chromium.launch(); const ctx = await b.newContext({ ...pw.devices['iPhone 13'] });
const pg = await ctx.newPage(); const errs=[]; pg.on('pageerror', e=>errs.push(e.message));
await pg.clock.setFixedTime(new Date('2026-10-25T20:00:00+01:00'));
await pg.addInitScript(() => {
  const days = {0:{avail:true,max:75},1:{avail:true,max:75},2:{avail:false,max:75},3:{avail:true,max:75},4:{avail:false,max:75},5:{avail:true,max:120},6:{avail:false,max:120}};
  const plan = [ { id:'k1', date:'2026-10-22', week:0, block:'x', kind:'test', workoutId:'test20', status:'planned' }, { id:'k2', date:'2026-10-24', week:0, block:'x', kind:'key', workoutId:'ss_3x10', status:'planned' } ];
  localStorage.setItem('ftpb_state_v1', JSON.stringify({ version:1, updatedAt:Date.now(), profile:{ name:'A', sex:'M', age:27, weightKg:81, heightCm:181, ftp:255, hrMax:185, goalFtp:300, goalDate:'2027-03-05', endDate:'2027-03-15', minSessions:35, startDate:'2026-10-20', days, keyPerWeek:2, optionalPerWeek:1, testProtocol:'20min', intensityAdj:1, ctl0:40 }, plan, activities:[], ftpHistory:[{date:'2026-10-20',ftp:255,source:'initial'}], settings:{theme:'auto'} }));
  localStorage.setItem('ftpb_health_v1', JSON.stringify({ daily:[], sleep:[], workouts:[
    { start_at:'2026-10-08T17:00:00Z', type:'Vélo', duration_min:60, avg_hr:140, source:'Apple Watch', indoor:true },
    { start_at:'2026-10-11T08:00:00Z', type:'Vélo', duration_min:120, avg_hr:132, source:'Connect', indoor:false },
    { start_at:'2026-10-13T11:00:00Z', type:'Course à pied', duration_min:45, avg_hr:150, source:'Apple Watch' },
    { start_at:'2026-10-22T17:00:00Z', type:'Vélo', duration_min:64, avg_hr:160, source:'Connect', indoor:true },
    { start_at:'2026-10-23T07:30:00Z', type:'Vélo', duration_min:25, avg_hr:120, source:'Strava', indoor:null },
  ] }));
});
await pg.goto('file:///home/claude/ftp-builder/index.html');
console.log('promoted', await pg.evaluate(() => Health.promoteBikes()));
console.log('acts', await pg.evaluate(() => JSON.stringify(FTPB.S.activities.map(a => [a.date, a.source, a.indoor, a.tss, a.planId, a.countAsSession]))), 'plan', await pg.evaluate(() => FTPB.S.plan.map(s => s.status).join(',')));
await pg.evaluate(()=>{ render(); document.querySelector('button[data-tab=cal]').click(); }); await pg.waitForTimeout(300);
const card = pg.locator('.card').first(); await card.screenshot({ path:'bikes.png' });
console.log((await card.innerText()).split('\n').slice(-1)[0], '| miss', await pg.$$eval('.mcal .c.miss', c=>c.map(x=>x.dataset.calday)));
// import .fit du 22 -> remplace la version Santé du 22 ? (fit du 19 ici : start différent, donc pas de remplacement attendu)
console.log('replace test', await pg.evaluate(() => { const st = FTPB.S.activities.find(a => a.date==='2026-10-22').startTs; const r = replaceHealthDuplicate(st + 300); return [!!r, FTPB.S.activities.length, FTPB.S.plan.find(s=>s.id==='k1').status]; }));
console.log('errs', errs); await b.close();
