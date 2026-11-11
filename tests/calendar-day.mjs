// Calendrier : un jour à plusieurs séances ouvre le home trainer par défaut, sélecteur pour passer aux autres.
const pw = (await import('module')).createRequire(process.env.PW_REQUIRE || '/opt/npm-tools/node_modules/x.js')('playwright');
const assert = (c, m) => { if (!c) { console.error('ÉCHEC', m); process.exitCode = 1; } else console.log('ok', m); };
const b = await pw.chromium.launch(); const ctx = await b.newContext({ ...pw.devices['iPhone 13'] });
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.clock.setFixedTime(new Date('2026-11-03T21:00:00+01:00'));
await pg.addInitScript(() => {
  const days = {}; for (let i = 0; i < 7; i++) days[i] = { avail: i % 2 === 1, max: 75 };
  const ts = s => Math.floor(Date.parse(s)/1000);
  const activities = [
    { id:'t1', date:'2026-11-03', name:'Ride', durationS:1100, indoor:false, hasPower:false, source:'intervals', startTs:ts('2026-11-03T08:10:00+01:00'), distanceKm:5.6 },
    { id:'t2', date:'2026-11-03', name:'Ride', durationS:1150, indoor:false, hasPower:false, source:'intervals', startTs:ts('2026-11-03T18:40:00+01:00'), distanceKm:5.5 },
    { id:'ht', date:'2026-11-03', name:'Sweet spot', durationS:3660, indoor:true, hasPower:true, tss:70, np:235, source:'intervals', startTs:ts('2026-11-03T19:30:00+01:00'), distanceKm:38 },
  ];
  localStorage.setItem('ftpb_state_v1', JSON.stringify({ version:1, updatedAt:Date.now(), profile:{ name:'A', sex:'M', age:28, weightKg:83, heightCm:181, ftp:260, hrMax:201, goalFtp:300, goalDate:'2027-03-05', endDate:'2027-03-15', minSessions:35, startDate:'2026-10-21', days, keyPerWeek:2, optionalPerWeek:0, testProtocol:'ramp', intensityAdj:1, ctl0:40 }, plan:[], activities, ftpHistory:[], settings:{ theme:'auto' } }));
  localStorage.setItem('ftpb_health_v1', JSON.stringify({ daily:[], sleep:[], workouts:[{ start_at:'2026-11-03T05:57:39.000Z', type:'Natation', duration_min:63, distance_km:3.025, avg_hr:141, source:'Intervals.icu' }, { start_at:'2026-11-04T11:20:59.000Z', type:'Renforcement musculaire', duration_min:43, distance_km:null, avg_hr:129, source:'Intervals.icu' }], token:null }));
});
await pg.goto(new URL('../index.html', import.meta.url).href); await pg.waitForTimeout(300);
await pg.tap('button[data-tab="cal"]').catch(async () => { await pg.locator('#tabs button').nth(1).tap(); }); await pg.waitForTimeout(200);
await pg.tap('[data-calday="2026-11-03"]'); await pg.waitForTimeout(200);
const tabs = await pg.locator('#dlg .daysel button').allInnerTexts();
console.log('sélecteur', tabs);
assert(tabs.length === 4, '4 séances proposées le 3/11');
assert(/Home trainer/.test(await pg.locator('#dlg .daysel button.on').innerText()) && /Sweet spot|Home trainer/i.test(await pg.locator('#dlg h2').first().innerText()), 'home trainer ouvert par défaut');
await pg.locator('#dlg').screenshot({ path:'day-default.png' });
await pg.locator('#dlg .daysel button', { hasText:'Natation' }).tap(); await pg.waitForTimeout(200);
assert(/NATATION/i.test(await pg.locator('#dlg h2').first().innerText()) && /Natation/.test(await pg.locator('#dlg .daysel button.on').innerText()), 'passage à la natation');
await pg.locator('#dlg .daysel button', { hasText:'Vélotaf' }).first().tap(); await pg.waitForTimeout(200);
assert(/Vélotaf/.test(await pg.locator('#dlg .daysel button.on').innerText()), 'passage au vélotaf');
await pg.evaluate(() => document.querySelector('#dlg').close());
await pg.tap('[data-calday="2026-11-04"]'); await pg.waitForTimeout(200);
assert(/Renforcement/i.test(await pg.locator('#dlg h2').first().innerText()), 'jour avec renfo seul : la fiche s\'ouvre');
console.log('errs', errs); if (errs.length) process.exitCode = 1; await b.close();
