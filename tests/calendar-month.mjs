const pw = (await import('module')).createRequire('/opt/npm-tools/node_modules/x.js')('playwright');
const b = await pw.chromium.launch(); const ctx = await b.newContext({ ...pw.devices['iPhone 13'] });
const pg = await ctx.newPage(); const errs=[]; pg.on('pageerror', e=>errs.push(e.message));
await pg.clock.setFixedTime(new Date('2026-10-25T20:00:00+01:00'));
await pg.addInitScript(() => {
  const days = {0:{avail:true,max:75},1:{avail:true,max:75},2:{avail:false,max:75},3:{avail:true,max:75},4:{avail:false,max:75},5:{avail:true,max:120},6:{avail:false,max:120}};
  const plan = [
    { id:'a', date:'2026-10-06', week:0, block:'x', kind:'key', workoutId:'ss_3x10', status:'done', activityId:'x1' },
    { id:'b', date:'2026-10-09', week:0, block:'x', kind:'key', workoutId:'thr_4x8', status:'planned' },
    { id:'c', date:'2026-10-14', week:1, block:'x', kind:'key', workoutId:'ss_3x12', status:'planned' },
    { id:'d', date:'2026-10-17', week:1, block:'x', kind:'optional', workoutId:'end_90', status:'planned' },
    { id:'e', date:'2026-10-27', week:2, block:'x', kind:'test', workoutId:'ramp', status:'planned' },
    { id:'f', date:'2026-10-29', week:2, block:'x', kind:'key', workoutId:'ss_3x10', status:'planned' },
  ];
  const A = (id,date,indoor,hasPower,name) => ({ id, date, name, durationS:3600, indoor, hasPower, tss:60, source:'fit' });
  const activities = [A('x1','2026-10-06',true,true,'HT'), A('x2','2026-10-11',false,false,'Sortie Longchamp'), A('x3','2026-10-19',true,true,'Prépa test'), A('x4','2026-10-19',false,false,'Vélotaf'), A('x5','2026-10-22',undefined,true,'Saisie manuelle')];
  localStorage.setItem('ftpb_state_v1', JSON.stringify({ version:1, updatedAt:Date.now(), profile:{ name:'A', sex:'M', age:27, weightKg:81, heightCm:181, ftp:255, hrMax:185, goalFtp:300, goalDate:'2027-03-05', endDate:'2027-03-15', minSessions:35, startDate:'2026-10-01', days, keyPerWeek:2, optionalPerWeek:1, testProtocol:'20min', intensityAdj:1, ctl0:40 }, plan, activities, ftpHistory:[{date:'2026-10-01',ftp:255,source:'initial'}], settings:{theme:'auto'} }));
});
await pg.goto('file:///home/claude/ftp-builder/index.html');
await pg.evaluate(()=>document.querySelector('button[data-tab=cal]').click()); await pg.waitForTimeout(300);
const card = pg.locator('.card').first(); await card.screenshot({ path:'mcal.png' });
console.log((await card.innerText()).split('\n').slice(-2).join(' | '));
console.log('miss cells', await pg.$$eval('.mcal .c.miss', c=>c.map(x=>x.dataset.calday)));
await pg.tap('[data-mnav="1"]'); console.log('next:', await pg.textContent('.mnav b'));
await pg.tap('[data-mnav="-1"]'); await pg.tap('[data-calday="2026-10-11"]'); await pg.waitForTimeout(200); console.log('dlg:', (await pg.textContent('#dlgBody')).slice(0,60).replace(/\s+/g,' '));
console.log('errs', errs); await b.close();
