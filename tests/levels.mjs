// Niveaux de progression et calibrage : over-unders réussis → niveau Seuil en hausse, test FTP → niveaux redescendus et
// séances clés à venir recalées dans leur famille (durée du jour respectée, séance du jour intacte) ; carte Progression ; export .fit des nouvelles séances
const pw = (await import('module')).createRequire(process.env.PW_REQUIRE || '/opt/npm-tools/node_modules/x.js')('playwright');
const out = process.env.SCRATCH || '.';
const b = await pw.chromium.launch(); const ctx = await b.newContext({ ...pw.devices['iPhone 13'] });
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.clock.setFixedTime(new Date('2026-11-20T20:00:00+01:00'));
await pg.goto('file://' + new URL('../index.html', import.meta.url).pathname);
await pg.waitForFunction(() => typeof Onboard !== 'undefined' && Cloud.ready); await pg.evaluate(o => Onboard.finish({ ...Onboard.draft(), ...o }, { quick:true }), { age:35, weightKg:75, ftp:255, goalFtp:300, startDate:'2026-11-20' });
 await pg.waitForSelector('#tabs:not(.hidden)');
const fail = []; const check = (c, m) => { if (!c) fail.push(m); };
const res = await pg.evaluate(() => {
  const { S, WORKOUTS, WLVL, WFAM, Levels, compliance, encodeWorkout } = FTPB;
  const flat = st => st.flatMap(s => s.repeat ? Array.from({ length: s.repeat }, () => flat(s.steps)).flat() : [s]);
  // séance simulée à 1 Hz, conforme aux cibles, avec le ressenti donné
  const ride = (pl, rpe) => {
    const scale = S.profile.ftp * (pl.adj || 1), pwr = [], hr = []; let h = 100;
    for (const s of flat(WORKOUTS[pl.workoutId].steps)) for (let t = 0; t < s.d; t++) { pwr.push(s.p/100*scale*(1 + Math.sin(t)*0.01)); h += ((60 + s.p*1.1) - h)*0.02; hr.push(Math.round(h)); }
    const a = { id:'a' + pl.id, source:'intervals', date: pl.date, startTs: Date.parse(pl.date)/1000 + 64800, name: WORKOUTS[pl.workoutId].name, durationS: pwr.length, hasPower:true, np:230, avgPower:215, avgHr:150,
      feel:{ rpe, legs:3 }, pwSample: pwr.filter((_, i) => i % 12 === 0).map(Math.round), hrSample: hr.filter((_, i) => i % 12 === 0), sampleSecs: pwr.length, _pw: pwr, _hr: hr };
    a.planId = pl.id; pl.status = 'done'; pl.activityId = a.id; a.compliance = compliance(a, pl); delete a._pw; delete a._hr; S.activities.push(a);
  };
  window._ride = ride; const r = {};
  r.newOk = ['ou_3x12','ou_3x12b','ou_2x18','thr_rel_3x12','thr_rel_2x20'].every(id => WORKOUTS[id]?.type === 'thr' && WLVL[id] != null && WFAM.ou.includes(id));
  r.fit = ['ou_2x18','thr_rel_2x20'].map(id => { const by = encodeWorkout(id, 255); return by.length > 200 && String.fromCharCode(...by.slice(8, 12)) === '.FIT'; });
  // séance du jour remplacée par des over-unders 3 × 9, réussis
  const keys = S.plan.filter(s => s.kind === 'key' && s.status === 'planned');
  const today = keys.find(s => s.date === '2026-11-20') || S.plan.find(s => s.date === '2026-11-20');
  const pl = today || keys[0]; pl.date = '2026-11-20'; pl.workoutId = 'ou_3x9'; pl.kind = 'key';
  ride(pl, 7); FTPB.save();
  const L1 = Levels.compute('2026-11-20'); r.thr1 = L1.cur.thr; r.seen = L1.seen; r.ss1 = L1.cur.ss;
  // séance de demain, placée en over-unders 3 × 9 : elle sera recalée ; une séance modifiée à la main ne bouge pas
  const fut = S.plan.filter(s => s.kind === 'key' && s.status === 'planned' && s.date > '2026-11-21');
  const target = fut[0]; target.workoutId = 'ou_2x18'; target.pos = 2;
  const manual = fut[1]; manual.workoutId = 'thr_5x6'; manual.origWorkoutId = 'thr_2x20';
  // test FTP à +4 % → niveaux − 1
  S.ftpHistory.push({ date:'2026-11-20', ftp: 265, source:'test' }); S.profile.ftp = 265; FTPB.save();
  const L2 = Levels.compute('2026-11-20'); r.thr2 = L2.cur.thr; r.vo2 = L2.cur.vo2;
  const cal = Levels.calibrate('test');
  r.changes = cal.changes.length; r.reason = cal.reason;
  r.targetTo = target.workoutId; r.manualKept = manual.workoutId === 'thr_5x6'; r.todayKept = pl.workoutId === 'ou_3x9';
  r.famOk = cal.changes.every(c => Object.values(WFAM).some(f => f.includes(c.from) && f.includes(c.to)));
  r.durOk = cal.changes.every(c => { const s = S.plan.find(x => x.id === c.id); return FTPB.WORKOUTS[s.workoutId] && flat(WORKOUTS[s.workoutId].steps).reduce((t, x) => t + x.d, 0) <= (S.profile.days[(new Date(s.date).getDay() + 6) % 7].max) * 60; });
  r.aim = Math.abs(WLVL[target.workoutId] - (L2.cur.thr + 1.0));
  r.monthlyNow = Levels.monthly(); // calibrage tout juste fait : rien à faire
  return r;
});
console.log(JSON.stringify(res));
check(res.newOk, 'les 5 nouvelles séances existent, en Seuil, avec un niveau et dans la famille over-under');
check(res.fit.every(Boolean), 'export .fit des nouvelles séances');
check(res.thr1 === 4.2 && res.seen.thr && !res.seen.ss && res.ss1 === 3, `over-unders 3 × 9 réussis → Seuil 4,2 (obtenu ${res.thr1})`);
check(res.thr2 === 3.2 && res.vo2 === 2, `test FTP +3,9 % → niveaux −1 (Seuil ${res.thr2}, VO2 ${res.vo2})`);
check(res.changes >= 1 && res.reason === 'test', 'le calibrage recale au moins une séance');
check(res.targetTo === 'ou_3x9' && res.aim <= 0.6, `séance de 3e semaine visée vers 4,2 : ${res.targetTo}`);
check(res.manualKept, 'une séance modifiée à la main ne bouge pas');
check(res.todayKept, 'la séance du jour ne bouge pas');
check(res.famOk, 'une séance n’est remplacée que par une séance de sa famille');
check(res.durOk, 'durée du jour respectée');
check(res.monthlyNow === null, 'pas de calibrage mensuel juste après un calibrage');
// carte Progression
await pg.evaluate(() => { document.querySelector('button[data-tab=prog]').click(); });
await pg.waitForSelector('text=Niveaux de progression');
const card = await pg.locator('.card', { hasText: 'Niveaux de progression' }).innerText();
console.log('CARTE:', card.replace(/\n+/g, ' | '));
check(/Seuil\s*\|?\s*3,2/.test(card) && /après le test FTP/.test(card) && /recalée/.test(card), 'carte : niveaux, raison et séances recalées');
await pg.locator('.card', { hasText: 'Niveaux de progression' }).screenshot({ path: out + '/levels-card.png' });
await pg.click('[data-calib]'); await pg.waitForTimeout(200);
const n = await pg.evaluate(() => FTPB.S.levelCal.length); check(n === 2, 'bouton Recalibrer');
// un mois plus tard, avec une nouvelle séance évaluée : calibrage mensuel au démarrage
await pg.evaluate(() => { const { S } = FTPB; const a = S.activities[0]; const pl = S.plan.find(s => s.kind === 'key' && s.status === 'planned' && s.date > '2026-12-10' && s.date <= '2026-12-20' && FTPB.WLVL[s.workoutId] != null && true);
  pl.workoutId = 'ou_3x9'; window._ride(pl, 7); FTPB.save(); });
await pg.clock.setFixedTime(new Date('2026-12-21T08:00:00+01:00')); await pg.reload(); await pg.waitForSelector('#tabs:not(.hidden)'); await pg.waitForTimeout(300);
const last = await pg.evaluate(() => FTPB.Levels.last()); console.log('MENSUEL', JSON.stringify(last));
check(last?.reason === 'mois' && last.date === '2026-12-21' && last.levels.thr > 3.2, 'calibrage mensuel au démarrage');
console.log(fail.length ? 'ÉCHEC ' + fail.join(' ; ') : 'OK', 'erreurs', errs);
await b.close(); process.exit(fail.length || errs.length ? 1 : 0);
