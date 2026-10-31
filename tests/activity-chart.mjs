const pw = (await import('module')).createRequire('/opt/npm-tools/node_modules/x.js')('playwright');
const b = await pw.chromium.launch(); const ctx = await b.newContext({ ...pw.devices['iPhone 13'] });
const pg = await ctx.newPage(); const errs=[]; pg.on('pageerror', e=>errs.push(e.message));
await pg.clock.setFixedTime(new Date('2026-10-25T20:00:00+01:00'));
await pg.addInitScript(() => {
  const days = {0:{avail:true,max:75},1:{avail:true,max:75},2:{avail:false,max:75},3:{avail:true,max:75},4:{avail:false,max:75},5:{avail:true,max:120},6:{avail:false,max:120}};
  localStorage.setItem('ftpb_state_v1', JSON.stringify({ version:1, updatedAt:Date.now(), profile:{ name:'A', sex:'M', age:27, weightKg:83, heightCm:181, ftp:255, hrMax:185, goalFtp:300, goalDate:'2027-03-05', endDate:'2027-03-15', minSessions:35, startDate:'2026-10-12', days, keyPerWeek:2, optionalPerWeek:1, testProtocol:'20min', intensityAdj:1, ctl0:40 },
    plan:[{ id:'p1', date:'2026-10-19', week:1, block:'Base', kind:'key', workoutId:'ss_3x10', status:'planned' }], activities:[], ftpHistory:[{date:'2026-10-12',ftp:255,source:'initial'}], settings:{theme:'auto'} }));
});
await pg.goto('file:///home/claude/ftp-builder/index.html');
await pg.evaluate(()=>{ TODAY_PANE = 'seance'; render(); document.querySelector('button[data-log=""]').click(); });
const fc = pg.waitForEvent('filechooser'); await pg.evaluate(()=>document.querySelector('#dropZone').click()); (await fc).setFiles('/home/claude/ftp-builder/tests/2026-10-19_seance.fit');
await pg.waitForSelector('#lSave'); await pg.evaluate(()=>document.querySelector('#lSave').click()); await pg.waitForTimeout(300);
// 2e séance (copie décalée) pour la comparaison
await pg.evaluate(() => { const a = structuredClone(FTPB.S.activities[0]); a.id='cmp1'; a.date='2026-10-12'; a.startTs -= 7*86400; a.planId=null; a.pwSample = a.pwSample.map(v=>Math.round(v*0.93)); a.best = Object.fromEntries(Object.entries(a.best).map(([k,v])=>[k, v && Math.round(v*0.95)])); FTPB.S.activities.push(a); });
await pg.evaluate(() => sessionDlg('p1')); await pg.waitForTimeout(200);
console.log('chips:', await pg.$$eval('#dlg .achips button', bs=>bs.map(b=>b.textContent+(b.classList.contains('on')?'*':'')).join(' | ')));
await pg.click('#dlg [data-ac="cad"]'); await pg.click('#dlg [data-ac="pw30"]'); await pg.click('#dlg [data-ac="zones"]');
await pg.selectOption('#acCmp', 'cmp1');
const box = await pg.locator('#dlg .awrap svg').boundingBox(); await pg.mouse.move(box.x + box.width*0.55, box.y + box.height/2); await pg.waitForTimeout(100);
console.log('tip:', await pg.textContent('#dlg .atip'));
await pg.locator('#dlg .actchart').screenshot({ path:'chart2.png' });
console.log('errs', errs); await b.close();
