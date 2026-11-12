// Accueil « Aujourd'hui », vocabulaire Énergie, compteurs de semaine, barre d'onglets, actions secondaires, « Ma semaine » partagée.
const pw = (await import('module')).createRequire(process.env.PW_REQUIRE || '/opt/npm-tools/node_modules/x.js')('playwright');
const out = process.env.SCRATCH || '.';
const assert = (c, m) => { if (!c) { console.error('ÉCHEC', m); process.exitCode = 1; } else console.log('ok', m); };
const b = await pw.chromium.launch(); const ctx = await b.newContext({ ...pw.devices['iPhone 13'], colorScheme:'dark' });
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.clock.setFixedTime(new Date('2026-11-10T07:30:00+01:00')); // mardi : nat le matin, vélo le soir
await pg.addInitScript(() => {
  if (localStorage.getItem('ftpb_state_v1')) return;
  const days = { 0:{avail:false,max:75}, 1:{avail:true,max:75}, 2:{avail:false,max:75}, 3:{avail:true,max:75}, 4:{avail:false,max:75}, 5:{avail:true,max:120}, 6:{avail:false,max:120} };
  localStorage.setItem('ftpb_state_v1', JSON.stringify({ version:1, updatedAt:Date.now(), profile:{ name:'Arnaud', sex:'M', age:28, weightKg:84, heightCm:181, ftp:260, hrMax:193, goalFtp:300, goalDate:'2027-03-05', endDate:'2027-03-15', minSessions:35, startDate:'2026-10-21', days, keyPerWeek:2, optionalPerWeek:0, holidays:true, testProtocol:'ramp', intensityAdj:1, ctl0:40 }, plan:[], activities:[], ftpHistory:[], settings:{ theme:'auto' } }));
  const daily = []; for (let i = 40; i >= 0; i--) { const d = new Date(Date.parse('2026-11-10') - i*864e5).toISOString().slice(0,10); daily.push({ day:d, metric:'hrv', value: i ? 92 : 70 }, { day:d, metric:'rhr', value: i ? 50 : 56 }); }
  localStorage.setItem('ftpb_health_v1', JSON.stringify({ daily, sleep:[{ night:'2026-11-10', asleep_min:330, source:'Intervals.icu' }], token:null, workouts:[{ start_at:'2026-11-03T05:57:39Z', type:'Natation', duration_min:53, distance_km:3.025, avg_hr:142, source:'Intervals.icu' }] }));
});
await pg.goto('file://' + new URL('../index.html', import.meta.url).pathname); await pg.waitForTimeout(300);
await pg.evaluate(() => { S.plan = generatePlan(S.profile); applyTri({ ...TRI_DEF(), enabled:true }); render(); });
await pg.waitForTimeout(300);
// accueil : 4 bulles (Programme, Heures sport, Énergie, Défi) ; Programme porte la semaine en cours et le J- de la course
const order = await pg.$$eval('.home [data-pane]', x => x.map(e => e.dataset.pane));
assert(order.join() === 'prog,heures,forme,defis', 'accueil : Programme, Heures sport, Énergie, Défi');
const labs = await pg.$$eval('.home .lab', x => x.map(e => e.textContent));
assert(labs.includes('Énergie') && !labs.includes('Forme'), 'bulle « Énergie »');
const prog = (await pg.locator('.home [data-pane="prog"]').innerText()).replace(/\s+/g, ' ');
console.log('programme :', prog);
assert(/\d+ ?\/ ?\d+ cette semaine ?J-\d+/i.test(prog), 'bulle Programme : semaine en cours + J-');
const lbls = await pg.$$eval('#tabs .lbl', x => x.map(e => getComputedStyle(e).position + ':' + e.offsetHeight));
assert(lbls.every(l => !l.startsWith('absolute') && +l.split(':')[1] > 5), 'libellés visibles sous les icônes');
await pg.screenshot({ path: out + '/home-today.png' });
// volet Programme : la séance vélo du jour, avec sa fiche
await pg.tap('.home [data-pane="prog"]'); await pg.waitForTimeout(300);
const bikeToday = await pg.evaluate(() => S.plan.find(s => s.date === todayISO())?.id);
assert(!!bikeToday, 'une séance vélo est prévue ce mardi');
// fiche séance : action principale + autres actions repliées
await pg.locator(`#todayPane [data-open="${bikeToday}"]`).first().tap(); await pg.waitForTimeout(200);
assert(await pg.locator('#dlg details.more').count() === 1 && !(await pg.locator('#dlg details.more').getAttribute('open')), 'fiche vélo : autres actions repliées');
assert(await pg.locator('#dlg [data-log]').isHidden(), '« saisir à la main » rangé dans le menu');
await pg.evaluate(() => document.querySelector('#dlg').close());
// Profil : « Ma semaine » avec nat / course
await pg.tap('button[data-tab="profile"]'); await pg.waitForTimeout(300);
assert(await pg.locator('.card h2', { hasText: 'Ma semaine' }).count() === 1, 'Profil : carte « Ma semaine »');
const sp = await pg.$$eval('.day .sp.on', x => x.map(e => e.dataset.sp + e.dataset.v));
console.log('pastilles', sp);
assert(sp.join() === 'run0,swim1,run2,swim4,run6', 'nat mar. + ven., course lun. + mer. + dim.');
await pg.locator('.day[data-day="3"] .sp[data-sp="swim"]').tap(); await pg.locator('.day[data-day="4"] .sp[data-sp="swim"]').tap();
assert(await pg.locator('.day[data-day="3"]').evaluate(e => e.classList.contains('on')), 'toucher 🏊 ne désactive pas le vélo du jeudi');
await pg.locator('.card', { hasText: 'Ma semaine' }).screenshot({ path: out + '/ma-semaine.png' });
await pg.evaluate(() => document.querySelector('#qform').requestSubmit()); await pg.waitForTimeout(300);
const sw = await pg.evaluate(() => [tri().swimDays.join(), S.triPlan.filter(x => x.sport === 'swim' && x.date >= '2026-11-16' && x.date <= '2026-11-22').map(x => dowMon(x.date)).join()]);
assert(sw[0] === '1,3' && sw[1] === '1,3', 'nat déplacée au jeudi et plan régénéré');
// réglages tri : la même grille
await pg.evaluate(() => triSetupDlg()); await pg.waitForTimeout(200);
assert(await pg.locator('#dlg .wgrid .wc.on').count() === 3 + 2 + 3, 'grille du plan tri : 3 vélo + 2 nat + 3 course');
await pg.locator('#dlg').screenshot({ path: out + '/tri-grid.png' });
console.log('errs', errs); if (errs.length) process.exitCode = 1; await b.close();
