// Évaluation de séance : séance sweet spot simulée (bloc 3 à +5 %) → verdict provisoire, puis ressenti RPE 8 → « trop dure »
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
console.log('AVANT RESSENTI', JSON.stringify(res));
const home = await pg.locator('.note', { hasText: 'provisoire' }).first().innerText(); console.log('ACCUEIL:', home.replace(/\n+/g, ' | '));
await pg.screenshot({ path: out + '/eval-1-accueil.png', fullPage: true });
await pg.locator('button[data-feelact="tst"]').first().click();
await pg.locator('.seg[data-feel=rpe] button[data-v="8"]').click(); await pg.locator('.seg[data-feel=legs] button[data-v="4"]').click();
await pg.click('#fSave'); await pg.waitForTimeout(300);
const after = await pg.locator('.note.warn').first().innerText(); console.log('APRÈS RESSENTI:', after.replace(/\n+/g, ' | '));
await pg.screenshot({ path: out + '/eval-2-verdict.png', fullPage: true });
const ok = /trop dure/.test(after) && /105 %/.test(after) && res.persisted;
console.log(ok ? 'OK' : 'ÉCHEC', 'erreurs', errs); await b.close(); process.exit(ok && !errs.length ? 0 : 1);
