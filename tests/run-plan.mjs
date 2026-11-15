// Plan course à pied (10 km, semi, marathon) : création depuis le calendrier, périodisation construite depuis la course,
// allures de Daniels (VDOT) et allure spécifique = objectif, plan vélo inchangé, fiche séance.
const pw = (await import('module')).createRequire(process.env.PW_REQUIRE || '/opt/npm-tools/node_modules/x.js')('playwright');
const assert = (c, m) => { if (!c) { console.error('ÉCHEC', m); process.exitCode = 1; } else console.log('ok', m); };
const b = await pw.chromium.launch(); const ctx = await b.newContext({ ...pw.devices['iPhone 13'] });
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.clock.setFixedTime(new Date('2026-11-15T21:00:00+01:00'));
await pg.addInitScript(() => {
  if (localStorage.getItem('ftpb_state_v1')) return;
  const days = { 0:{avail:false,max:75}, 1:{avail:true,max:75}, 2:{avail:false,max:75}, 3:{avail:true,max:75}, 4:{avail:false,max:75}, 5:{avail:true,max:120}, 6:{avail:false,max:120} };
  localStorage.setItem('ftpb_state_v1', JSON.stringify({ version:1, updatedAt:Date.now(), profile:{ name:'A', sex:'M', age:28, weightKg:84, heightCm:181, ftp:260, hrMax:201, goalFtp:300, goalDate:'2027-03-05', endDate:'2027-03-15', minSessions:35, startDate:'2026-10-21', days, keyPerWeek:2, optionalPerWeek:0, holidays:true, testProtocol:'ramp', intensityAdj:1, ctl0:40 }, plan:[], activities:[], ftpHistory:[], settings:{ theme:'auto' } }));
  const W = (start_at, type, duration_min, distance_km) => ({ start_at, type, duration_min, distance_km, avg_hr:140, source:'Intervals.icu' });
  localStorage.setItem('ftpb_health_v1', JSON.stringify({ daily:[], sleep:[], token:null, workouts:[W('2026-10-21T10:14:32Z','Course à pied',39.3,8.29), W('2026-10-30T11:13:34Z','Course à pied',44.3,8.27)] }));
});
await pg.goto('file://' + new URL('../index.html', import.meta.url).pathname); await pg.waitForTimeout(300);
await pg.evaluate(() => { S.plan = generatePlan(S.profile); save(); render(); });
// moteur : équivalences de Daniels (VDOT 50 ≈ 41'21 au 10 km, 3h10'49 au marathon, seuil 4'15, VO2 3'55)
const v = await pg.evaluate(() => ({ t10: vdotTime(50, 10000), tm: vdotTime(50, 42195), t: vdotPace(50, 0.88), i: vdotPace(50, 0.975) }));
assert(Math.abs(v.t10 - 2481) < 10 && Math.abs(v.tm - 11449) < 40 && Math.abs(v.t - 255) < 3 && Math.abs(v.i - 235) < 3, `VDOT 50 conforme aux tables de Daniels ${JSON.stringify(v)}`);
const bikeBefore = await pg.evaluate(() => ({ end: S.profile.endDate, n: S.plan.length }));
await pg.tap('button[data-tab="cal"]'); await pg.waitForTimeout(200);
await pg.locator('[data-runsetup]').first().tap(); await pg.waitForTimeout(200);
assert(/^\d'\d\d$/.test(await pg.inputValue('[name=runThr]')), 'seuil pré-rempli depuis les courses');
assert(await pg.inputValue('[name=date]') === '2027-01-24', `10 km par défaut : date conseillée à 10 semaines (${await pg.inputValue('[name=date]')})`);
await pg.locator('[data-rdist] button', { hasText: 'Semi' }).tap();
assert(await pg.inputValue('[name=date]') === '2027-02-07', 'semi : la date proposée passe à 12 semaines');
await pg.fill('[name=name]', 'Semi de Paris'); await pg.fill('[name=date]', '2027-03-07');
await pg.fill('[name=goal_h]', '1'); await pg.fill('[name=goal_min]', '29'); await pg.fill('[name=goal_s]', '0');
await pg.selectOption('[name=refM]', '10000'); await pg.fill('[name=ref_min]', '42'); await pg.fill('[name=ref_s]', '30');
// semaine : course lun., mer., ven., dim. (la grille vélo reste telle quelle)
for (const d of [0, 2, 4, 6]) { const c = pg.locator(`[data-wg="run"][data-v="${d}"]`); if (await c.getAttribute('aria-pressed') !== 'true') await c.tap(); }
for (const d of [1, 3, 5]) { const c = pg.locator(`[data-wg="run"][data-v="${d}"]`); if (await c.getAttribute('aria-pressed') === 'true') await c.tap(); }
await pg.waitForTimeout(100);
const info = await pg.locator('#runInfo').innerText(); console.log(info);
assert(/prédiction 1h3\d/.test(info) && /ambitieux|réaliste/.test(info), 'info : prédiction semi et faisabilité de l\'objectif');
await pg.tap('#runGo'); await pg.waitForTimeout(300);
const r = await pg.evaluate(() => {
  const P = S.triPlan, wk = (a, b) => P.filter(x => x.date >= a && x.date <= b);
  return { mode: S.tri.mode, n: P.length, swim: P.filter(x => x.sport === 'swim').length, race: P.filter(x => x.sport === 'race').map(x => x.date),
    end: S.profile.endDate, nb: S.plan.length, spec: S.plan.some(s => s.block === 'Spécifique montagne'),
    week1: wk('2026-11-16', '2026-11-22').map(x => DOW[dowMon(x.date)].toLowerCase().slice(0, 3) + ':' + x.wid),
    blocks: [...new Set(P.map(x => x.block))], longMax: Math.max(...P.filter(x => x.wid === 'long').map(x => x.min)),
    rpSessions: P.filter(x => x.wid === 'qual' && triWorkout(x).steps.some(s => s.z === 'rp')).length,
    rp: Math.round(rnPace('rp', P[0])), t0: Math.round(rnPace('t', P[0])), tLast: Math.round(rnPace('t', P.filter(x => x.sport === 'run').at(-1))),
    raceWeek: wk('2027-03-01', '2027-03-07').map(x => DOW[dowMon(x.date)].toLowerCase().slice(0, 3) + ':' + (x.wid || x.sport)),
    afterRace: P.filter(x => x.date > '2027-03-07').length };
});
console.log(JSON.stringify(r));
assert(r.mode === 'run' && r.swim === 0 && r.race.join() === '2027-03-07' && r.afterRace === 0, 'mode course : aucune nat, course le 7 mars, rien après');
assert(r.end === bikeBefore.end && !r.spec, 'plan vélo : dates inchangées, pas de bloc spécifique tri');
assert(r.week1.join() === 'lun:easy,mer:qual,ven:qual,dim:long', `semaine type 4 courses : footing le lendemain de la longue, 2 qualités espacées, longue le dim. (${r.week1})`);
assert(['Base · Endurance', 'Seuil', 'Seuil + VO2max', 'Spécifique semi-marathon', 'Affûtage', 'Semaine de course', 'Semaine allégée'].every(x => r.blocks.includes(x)), 'phases du semi présentes');
assert(r.longMax === 105 && r.rpSessions >= 4, 'sortie longue jusqu\'à 1h45, séances à l\'allure semi');
assert(Math.abs(r.rp - Math.round(5340/21.0975)) <= 1, `allure spécifique = objectif 1h29 (${r.rp} s/km)`);
assert(r.tLast < r.t0, 'allures de qualité qui progressent vers l\'objectif au fil du plan');
assert(r.raceWeek.join() === 'jeu:qual,sam:easy,dim:race', `semaine de course : rappel jeu., footing sam., course dim. (${r.raceWeek})`);
// bandeau et fiche séance
assert(/Semi de Paris/i.test(await pg.locator('.tri-banner').innerText()) && /1h29'00/.test(await pg.locator('.tri-banner').innerText()), 'bandeau : course, objectif, prédiction');
await pg.evaluate(() => triDlg(S.triPlan.find(x => x.wid === 'qual' && x.ph === 'spec').id)); await pg.waitForTimeout(150);
const dlg = await pg.locator('#dlg').innerText();
assert(/allure semi-marathon · 4'1\d \/km/.test(dlg) && /VDOT/.test(dlg), 'fiche : étapes à l\'allure semi et VDOT');
await pg.evaluate(() => closeDlg());
// 10 km et marathon : périodisation et contenus spécifiques
const o = await pg.evaluate(() => { const mk = (dist, date, goal) => { const T = { ...RUN_DEF(), enabled:true, dist, goal, runThr:255, start:'2026-11-15', runDays:[1, 3, 6], runPerWeek:3, race:{ name:'X', date, run: RUN_D[dist].km, runDp:0 } }; S.tri = T; return generateRun(T, '2026-11-16'); };
  const ten = mk(10, '2027-01-31', 2400), res = { tenBlocks: [...new Set(ten.map(x => x.block))], tenVo2: ten.filter(x => x.wid === 'qual' && /VO2/.test(runWorkout(x, S.tri).name)).length };
  const mar = mk(42, '2027-04-11', 3*3600 + 15*60);
  Object.assign(res, { marLong: Math.max(...mar.filter(x => x.wid === 'long').map(x => x.min)), marMp: mar.filter(x => x.wid === 'long' && /allure/.test(runWorkout(x, S.tri).name)).length,
    marTaper: mar.filter(x => x.block === 'Affûtage').length, marWeeks: new Set(mar.map(x => x.week)).size, marQ: mar.filter(x => x.date >= '2026-11-16' && x.date <= '2026-11-22').map(x => x.wid) });
  return res; });
console.log(JSON.stringify(o));
assert(o.tenBlocks.includes('VO2max') && o.tenBlocks.includes('Spécifique 10 km') && o.tenVo2 >= 1, '10 km : bloc VO2max et spécifique 10 km');
assert(o.marLong >= 140 && o.marLong <= 150 && o.marMp >= 3 && o.marTaper >= 4, 'marathon : longue jusqu\'à ~2h30, longues à allure marathon, 2 semaines d\'affûtage');
assert(o.marQ.join() === 'easy,qual,long', '3 courses : footing mar., qualité jeu., longue dim.');
console.log('errs', errs); if (errs.length) process.exitCode = 1; await b.close();
