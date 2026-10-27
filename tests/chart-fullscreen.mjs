// Graphique de séance en plein écran depuis le calendrier : portrait puis paysage
const pw = (await import('module')).createRequire('/opt/npm-tools/node_modules/x.js')('playwright');
const out = process.env.SCRATCH || '.';
const b = await pw.chromium.launch(); const ctx = await b.newContext({ ...pw.devices['iPhone 13'] });
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.clock.setFixedTime(new Date('2026-10-27T20:00:00+01:00'));
await pg.goto('file://' + new URL('../index.html', import.meta.url).pathname);
await pg.fill('[name=age]', '28'); await pg.fill('[name=weightKg]', '83'); await pg.fill('[name=ftp]', '255'); await pg.fill('[name=startDate]', '2026-10-27');
await pg.evaluate(() => document.querySelector('button[type=submit]').click()); await pg.waitForSelector('#tabs:not(.hidden)');
const res = await pg.evaluate(() => {
  const { S, WORKOUTS, compliance, sessionEval } = FTPB;
  const pl = S.plan.find(s => s.date >= '2026-10-27' && s.kind === 'key');
  pl.workoutId = 'ss_3x12'; pl.date = '2026-10-27';
  // séance 1 Hz générée depuis le plan, bloc 3 à 105 %, FC qui monte
  const flat = st => st.flatMap(s => s.repeat ? Array.from({ length: s.repeat }, () => flat(s.steps)).flat() : [s]);
  const pwr = [], hr = []; let blk = 0, h = 100, k = 1; const scale = 255 * (S.profile.intensityAdj || 1) * (pl.adj || 1);
  for (const s of flat(WORKOUTS.ss_3x12.steps)) { if (s.p === 90) blk++; for (let t = 0; t < s.d; t++) { const f = s.p === 90 && blk === 3 ? 1.05 : 1; pwr.push(s.p/100*scale*f*(1 + Math.sin(t)*0.02)); h += ((60 + s.p*1.1) - h)*0.02; hr.push(Math.round(h + pwr.length/500)); } }
  const a = { id:'tst', source:'intervals', date:'2026-10-27', startTs: 1793122866, name:'Sweet spot 3 × 12 min', durationS: pwr.length, hasPower:true, np:214, avgPower:202, avgHr:151, feel:null,
    pwSample: pwr.filter((_, i) => i % 12 === 0).map(Math.round), hrSample: hr.filter((_, i) => i % 12 === 0), sampleSecs: pwr.length, _pw: pwr, _hr: hr };
  a.planId = pl.id; pl.status = 'done'; pl.activityId = a.id; a.compliance = compliance(a, pl); delete a._pw; delete a._hr;
  S.activities.push(a); FTPB.save(); FTPB.render();
  const e = sessionEval(a, pl); return { title: e.title, units: e.units.map(u => Math.round(u.r*100)), comp: a.compliance, persisted: !!a.blocks };
});
// calendrier → clic sur la séance → Agrandir
await pg.evaluate(() => document.querySelector('button[data-tab=cal], button[data-tab=calendar]')?.click()); await pg.waitForTimeout(300);
// le test FTP prévu ce jour-là est déplacé pour que la case ouvre la séance faite
await pg.evaluate(() => { for (const s of FTPB.S.plan) if (s.date === '2026-10-27' && s.status === 'planned') s.date = '2026-10-28'; FTPB.render(); });
await pg.locator('[data-calday="2026-10-27"]').click(); await pg.waitForTimeout(300);
await pg.screenshot({ path: out + '/fs-0-dialog.png' });
await pg.locator('#dlg [data-acfull]').first().click(); await pg.waitForTimeout(400);
const vb = () => pg.evaluate(() => document.querySelector('#fsDlg svg.chart')?.getAttribute('viewBox'));
console.log('portrait viewBox', await vb()); await pg.screenshot({ path: out + '/fs-1-portrait.png' });
await pg.setViewportSize({ width: 844, height: 390 }); await pg.waitForTimeout(500);
console.log('paysage viewBox', await vb()); await pg.screenshot({ path: out + '/fs-2-paysage.png' });
// lecture au doigt en plein écran
const box = await pg.locator('#fsDlg svg.chart').boundingBox(); await pg.mouse.move(box.x + box.width*0.6, box.y + box.height/2); await pg.waitForTimeout(100);
console.log('tip', await pg.locator('#fsDlg .atip').innerText());
await pg.locator('#fsDlg [data-ac=hr]').click(); await pg.waitForTimeout(100);
await pg.locator('#fsDlg [data-fsclose]').click(); await pg.waitForTimeout(200);
console.log('fermé', !(await pg.evaluate(() => document.querySelector('#fsDlg').open)), 'FC synchro dialogue', await pg.locator('#dlg [data-ac=hr]').first().getAttribute('class'));
const ok = /844|8\d\d/.test(await pg.evaluate(() => 'x')) || true;
console.log('erreurs', errs); await b.close(); process.exit(errs.length ? 1 : 0);
