// Adaptation : « j'ai fait autre chose » (séance prévue remplacée par ce qui a été fait), recaser une séance clé, compteurs de semaine
const pw = (await import('module')).createRequire(process.env.PW_REQUIRE || '/opt/npm-tools/node_modules/x.js')('playwright');
const assert = (c, m) => { if (!c) { console.error('ÉCHEC', m); process.exitCode = 1; } else console.log('ok', m); };
const out = process.env.SCRATCH || '.';
const b = await pw.chromium.launch(); const ctx = await b.newContext({ ...pw.devices['iPhone 13'] });
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.clock.setFixedTime(new Date('2026-11-08T23:40:00+01:00')); // dimanche soir
await pg.addInitScript(() => {
  if (localStorage.getItem('ftpb_state_v1')) return;
  const days = { 0:{avail:false,max:75}, 1:{avail:true,max:75}, 2:{avail:false,max:75}, 3:{avail:true,max:75}, 4:{avail:false,max:75}, 5:{avail:true,max:120}, 6:{avail:false,max:120} };
  localStorage.setItem('ftpb_state_v1', JSON.stringify({ version:1, updatedAt:Date.now(), profile:{ name:'A', sex:'M', age:28, weightKg:84, heightCm:181, ftp:260, hrMax:201, goalFtp:300, goalDate:'2027-03-05', endDate:'2027-03-15', minSessions:35, startDate:'2026-10-21', days, keyPerWeek:2, optionalPerWeek:0, holidays:true, testProtocol:'ramp', intensityAdj:1, ctl0:40 }, plan:[], activities:[], ftpHistory:[], settings:{ theme:'auto' } }));
  const W = (start_at, type, duration_min, distance_km) => ({ start_at, type, duration_min, distance_km, avg_hr:140, source:'Intervals.icu' });
  localStorage.setItem('ftpb_health_v1', JSON.stringify({ daily:[], sleep:[], token:null, workouts:[W('2026-10-27T06:04:55Z','Natation',45.5,2.625), W('2026-10-21T10:14:32Z','Course à pied',39.3,8.29),
    W('2026-11-08T10:00:00Z','Renforcement musculaire',45,null)] }));
});
await pg.goto('file://' + new URL('../index.html', import.meta.url).pathname); await pg.waitForTimeout(300);
await pg.evaluate(() => { S.plan = generatePlan(S.profile); applyTri({ ...TRI_DEF(), enabled:true, css:110, runThr:290, swimDays:[1,4], runDays:[0,2,6], swimPerWeek:2, runPerWeek:3 }); render(); });
// la sortie longue course de dimanche n'a pas été faite : renfo à la place
const run = await pg.evaluate(() => { const x = S.triPlan.find(y => y.date === '2026-11-08' && y.sport === 'run'); return x && { id: x.id, wid: x.wid, st: triStatus(x) }; });
assert(run && run.wid === 'long' && run.st === 'planned', 'sortie longue du dimanche encore prévue (jour même)');
await pg.tap('button[data-tab="cal"]'); await pg.waitForTimeout(200);
await pg.locator(`[data-tri="${run.id}"]`).scrollIntoViewIfNeeded(); await pg.locator(`[data-tri="${run.id}"]`).tap(); await pg.waitForTimeout(200);
const d1 = await pg.locator('#dlg').innerText();
assert(/Changer de séance/.test(d1), 'fiche : bouton « Changer de séance »');
await pg.screenshot({ path: out + '/adapt-1.png' });
await pg.locator('#dlg [data-swap]').first().tap(); await pg.waitForTimeout(200);
assert(/Renforcement musculaire/.test(await pg.locator('#swDet').innerText()), 'renfo du jour détecté');
await pg.locator('#swDet button').first().tap(); await pg.screenshot({ path: out + '/adapt-2.png' });
await pg.tap('#swOk'); await pg.waitForTimeout(200);
const s1 = await pg.evaluate(id => { const x = S.triPlan.find(y => y.id === id); return { sp: x.swap?.sp, min: x.swap?.min, st: triStatus(x) }; }, run.id);
assert(s1.sp === 'strength' && s1.min === 45 && s1.st === 'swapped', 'séance remplacée par le renfo');
const d2 = await pg.locator('#dlg').innerText();
assert(/ne remplace pas/.test(d2) && /Charge de la semaine/.test(d2), 'conseil d\'adaptation + charge de la semaine');
await pg.screenshot({ path: out + '/adapt-3.png' });
const rc = await pg.locator('#dlg [data-recase]').count();
if (rc) { await pg.locator('#dlg [data-recase]').first().tap(); await pg.waitForTimeout(200);
  const c = await pg.evaluate(id => { const c = S.triPlan.find(y => y.recasedFrom === id); const L = c && dayLoad(c.date, c.id); return c && { d: c.date, wid: c.wid, n: L.length, hardNear: [-1,0,1].some(o => dayLoad(addDays(c.date, o), c.id).some(y => y.i.hard)) }; }, run.id);
  console.log('RECASÉE', JSON.stringify(c));
  assert(c && c.wid === 'long' && c.d > '2026-11-08' && c.n < 2 && !c.hardNear, 'recasée sur un créneau propre (pas de séance dure à ±1 j)');
} else assert(/Pas de créneau propre/.test(d2), 'pas de créneau : on laisse tomber');
// samedi : tempo home trainer → sortie longue dehors à la main
const bk = await pg.evaluate(() => S.plan.find(s => s.date === '2026-11-07')?.id);
if (bk) {
  await pg.evaluate(id => { closeDlg(); swapDlg('b', id); }, bk); await pg.waitForTimeout(200);
  await pg.locator('#swSp button[data-v="bike_out"]').tap(); await pg.fill('#swMin', '150'); await pg.fill('#swRpe', '5'); await pg.fill('#swNote', 'Sortie longue dehors');
  await pg.tap('#swOk'); await pg.waitForTimeout(200);
  const s2 = await pg.evaluate(id => { const s = S.plan.find(x => x.id === id); return { st: s.status, sp: s.swap?.sp, tss: s.swap?.tss }; }, bk);
  assert(s2.st === 'skipped' && s2.sp === 'bike_out' && s2.tss > 100, 'samedi : séance HT remplacée par la sortie dehors (charge estimée)');
}
await pg.evaluate(() => closeDlg());
const wk = await pg.evaluate(() => { const r = document.querySelector('#w-2026-11-02'); return { txt: r?.querySelector('.wh')?.innerText, sw: r?.querySelectorAll('.sess.swapped').length }; });
console.log('SEMAINE', JSON.stringify(wk));
assert(wk.sw >= 1, 'lignes remplacées visibles dans le programme');
await pg.locator('#w-2026-11-02').scrollIntoViewIfNeeded(); await pg.screenshot({ path: out + '/adapt-4.png' });
// retour à la séance prévue
await pg.evaluate(id => swapDlg('t', id), run.id); await pg.waitForTimeout(150); await pg.tap('#swUndo'); await pg.waitForTimeout(150);
assert(await pg.evaluate(id => triStatus(S.triPlan.find(y => y.id === id)), run.id) === 'planned', 'retour à la séance prévue');
// séance manquée la veille : bloc Adapter (j'ai fait autre chose / recaser / laisser tomber)
const sat = await pg.evaluate(() => { const x = S.triPlan.find(y => y.date < '2026-11-08' && y.date >= '2026-11-02' && triStatus(y) === 'missed'); return x?.id; });
if (sat) { await pg.evaluate(id => triDlg(id), sat); await pg.waitForTimeout(150); const t = await pg.locator('#dlg').innerText();
  assert(/J'ai fait autre chose/.test(t) && /Laisser tomber/.test(t), 'séance manquée : bloc Adapter');
  await pg.locator('#dlg [data-drop]').tap(); await pg.waitForTimeout(150);
  assert(await pg.evaluate(id => S.triPlan.find(y => y.id === id).status, sat) === 'skipped', 'laisser tomber'); }
// persistance
await pg.reload(); await pg.waitForFunction(() => typeof S !== 'undefined' && S.plan && S.plan.length > 0); await pg.waitForTimeout(300);
assert(await pg.evaluate(bk => !bk || S.plan.find(s => s.id === bk)?.swap?.sp === 'bike_out', bk), 'remplacement conservé après rechargement');
assert(!errs.length, 'aucune erreur JS ' + errs.join(' | '));
await b.close();
