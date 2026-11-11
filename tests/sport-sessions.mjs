// Volet « Heures de sport » : dernières séances par sport (cliquables) et fiche de progression séance par séance.
const pw = (await import('module')).createRequire(process.env.PW_REQUIRE || '/opt/npm-tools/node_modules/x.js')('playwright');
const b = await pw.chromium.launch(); const ctx = await b.newContext({ ...pw.devices['iPhone 13'] });
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.clock.setFixedTime(new Date('2026-11-01T20:00:00+01:00'));
await pg.addInitScript(() => {
  const days = {0:{avail:false,max:75},1:{avail:true,max:75},2:{avail:false,max:75},3:{avail:true,max:75},4:{avail:false,max:75},5:{avail:true,max:120},6:{avail:false,max:120}};
  const plan = [
    { id:'a', date:'2026-10-27', week:1, block:'Base', kind:'key', workoutId:'ss_3x12', status:'done', activityId:'x1' },
    { id:'b', date:'2026-11-03', week:2, block:'Base', kind:'key', workoutId:'ss_3x12', status:'planned' },
  ];
  const ts = s => Math.floor(Date.parse(s)/1000);
  const activities = [
    { id:'x1', date:'2026-10-27', name:'SS', durationS:3661, indoor:true, hasPower:true, tss:72, source:'intervals', planId:'a', startTs:ts('2026-10-27T19:00:00+01:00'), distanceKm:42.8 },
    { id:'x2', date:'2026-10-24', name:'Longue', durationS:12720, indoor:false, hasPower:false, tss:150, source:'fit', startTs:ts('2026-10-24T08:15:00+02:00'), distanceKm:98.6 },
    { id:'x3', date:'2026-10-28', name:'Ride', durationS:1096, indoor:false, hasPower:false, tss:11, source:'intervals', startTs:ts('2026-10-28T08:12:00+01:00'), distanceKm:5.4 }, // vélotaf
  ];
  localStorage.setItem('ftpb_state_v1', JSON.stringify({ version:1, updatedAt:Date.now(), profile:{ name:'A', sex:'M', age:28, weightKg:83, heightCm:181, ftp:260, hrMax:201, goalFtp:300, goalDate:'2027-03-05', endDate:'2027-03-15', minSessions:35, startDate:'2026-10-21', days, keyPerWeek:2, optionalPerWeek:0, testProtocol:'ramp', intensityAdj:1, ctl0:40 }, plan, activities, ftpHistory:[{date:'2026-10-20',ftp:255,source:'initial'}], settings:{theme:'auto'} }));
  const W = (start, type, min, km, hr) => ({ start_at:start, type, duration_min:min, distance_km:km, avg_hr:hr ?? (/Course/.test(type) ? 150 : 135), source:'Intervals.icu' });
  localStorage.setItem('ftpb_health_v1', JSON.stringify({ daily:[], sleep:[], workouts:[
    W('2026-10-21T12:14:00+02:00','Course à pied',39,8.3), W('2026-10-23T11:01:00+02:00','Course à pied',44,6.3),
    W('2026-10-20T12:06:00+02:00','Natation',37,2.3), W('2026-10-24T17:10:00+02:00','Marche',102,1.8),
    W('2026-10-26T12:19:00+01:00','Renforcement musculaire',42,null), W('2026-10-27T07:04:00+01:00','Natation',46,2.6),
    W('2026-10-28T19:07:00+01:00','Course à pied',56,9.3), W('2026-10-30T12:13:00+01:00','Course à pied',44,8.3),
    W('2026-10-31T15:49:00+01:00','Natation',35,2.1),
    W('2026-10-17T09:25:00+02:00','Course à pied',382,49.1), W('2026-10-17T10:52:00+02:00','Course à pied',323,33.6), // doublon
  ], token:null }));
});
await pg.goto('file:///home/claude/ftp-builder/index.html');
await pg.waitForTimeout(300);
await pg.tap('.home [data-pane="heures"]'); await pg.waitForTimeout(300);
for (const n of [1,2]) console.log('liste', n, (await pg.locator('#todayPane .card').nth(n).locator('[data-ssess]').allInnerTexts()).map(t => t.replace(/\s+/g,' ')));
await pg.screenshot({ path:'sessions-list.png', fullPage:true });
await pg.locator('#todayPane .card').nth(1).locator('[data-ssess]').first().tap(); await pg.waitForTimeout(300);
console.log('fiche', (await pg.locator('#dlg').innerText()).replace(/\s+/g,' ').slice(0, 600));
await pg.locator('#dlg').screenshot({ path:'session-dlg.png' });
await pg.tap('[data-close]'); await pg.locator('#todayPane .card').nth(0).locator('[data-ssess]').first().tap(); await pg.waitForTimeout(300);
console.log('vélo ->', (await pg.locator('#dlg h2').first().innerText()));
console.log('errs', errs); await b.close();
