// Défis : un état avec l'ancien défi « Squats » le passe en archive (historique conservé) et ouvre « Squats bulgares ».
const pw = (await import('module')).createRequire(process.env.PW_REQUIRE || '/opt/npm-tools/node_modules/x.js')('playwright');
const b = await pw.chromium.launch(); const ctx = await b.newContext({ ...pw.devices['iPhone 13'] });
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.clock.setFixedTime(new Date('2026-11-02T08:00:00+01:00'));
await pg.addInitScript(() => {
  const days = {0:{avail:false,max:75},1:{avail:true,max:75},2:{avail:false,max:75},3:{avail:true,max:75},4:{avail:false,max:75},5:{avail:true,max:120},6:{avail:false,max:120}};
  localStorage.setItem('ftpb_state_v1', JSON.stringify({ version:1, updatedAt:Date.now(), profile:{ name:'A', sex:'M', age:28, weightKg:83, heightCm:181, ftp:260, hrMax:201, goalFtp:300, goalDate:'2027-03-05', endDate:'2027-03-15', minSessions:35, startDate:'2026-10-21', days, keyPerWeek:2, optionalPerWeek:0, testProtocol:'ramp', intensityAdj:1, ctl0:40 }, plan:[], activities:[], ftpHistory:[], settings:{theme:'auto'},
    challenges:[ { id:'squats', name:'Squats', unit:'squats', target:10000, step:[20,50,100], start:'2026-10-21', end:'2027-03-15', entries:{'2026-10-26':300,'2026-10-27':323} },
                 { id:'chaise', name:'Chaise', unit:'min', target:300, step:[1,2,5], start:'2026-10-21', end:'2027-03-15', entries:{'2026-10-27':5} } ] }));
});
await pg.goto('file://' + new URL('../index.html', import.meta.url).pathname); await pg.waitForTimeout(300);
await pg.tap('.home [data-pane=defis]'); await pg.waitForTimeout(200);
const active = await pg.$$eval('.dstack .dcard', x => x.map(e => e.querySelector('b').textContent.replace('›', '').trim()));
const arch = (await pg.locator('.card:has(h2:text("Défis archivés"))').innerText()).replace(/\s+/g, ' ');
await pg.tap('[data-chadd="bulgares"][data-v="16"]');
const st = await pg.evaluate(() => FTPB.S.challenges.map(c => [c.id, c.archived || '', Object.values(c.entries).reduce((a, b) => a + b, 0)]));
console.log('actifs', active, '| archive', arch, '| état', JSON.stringify(st));
const ok = active.join() === 'Squats bulgares,Chaise,Mobilité' && /Squats.*623 squats/.test(arch) && JSON.stringify(st) === '[["bulgares","",16],["chaise","",5],["squats","2026-11-02",623]]';
console.log(ok ? 'OK' : 'ÉCHEC', 'erreurs', errs); await b.close(); process.exit(ok && !errs.length ? 0 : 1);
