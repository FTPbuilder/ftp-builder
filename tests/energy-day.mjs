// Batterie de la journée : énergie au réveil, vidée par les séances du jour (nat le matin, course le midi, vélotaf) ;
// coût de chaque séance, conseils (nuit courte, protéines / glucides), bulle Énergie = maintenant · réveil
const pw = (await import('module')).createRequire(process.env.PW_REQUIRE || '/opt/npm-tools/node_modules/x.js')('playwright');
const out = process.env.SCRATCH || '.';
const assert = (c, m) => { if (!c) { console.error('ÉCHEC', m); process.exitCode = 1; } else console.log('ok', m); };
const b = await pw.chromium.launch(); const ctx = await b.newContext({ ...pw.devices['iPhone 13'], colorScheme:'dark' });
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.clock.setFixedTime(new Date('2026-11-24T23:30:00+01:00'));
await pg.addInitScript(() => {
  if (localStorage.getItem('ftpb_state_v1')) return;
  const days = { 0:{avail:false,max:75}, 1:{avail:true,max:75}, 2:{avail:true,max:75}, 3:{avail:false,max:75}, 4:{avail:true,max:75}, 5:{avail:false,max:120}, 6:{avail:true,max:120} };
  localStorage.setItem('ftpb_state_v1', JSON.stringify({ version:1, updatedAt:Date.now(), profile:{ name:'A', sex:'M', age:30, weightKg:84, heightCm:181, ftp:260, hrMax:193, goalFtp:300, goalDate:'2027-03-05', endDate:'2027-03-15', minSessions:35, startDate:'2026-10-21', days, keyPerWeek:2, optionalPerWeek:0, holidays:true, testProtocol:'ramp', intensityAdj:1, ctl0:40 }, plan:[], activities:[], ftpHistory:[], settings:{ theme:'auto', guideHidden:true } }));
  const daily = []; for (let i = 40; i >= 0; i--) { const d = new Date(Date.parse('2026-11-24') - i*864e5).toISOString().slice(0,10); daily.push({ day:d, metric:'hrv', value: i ? 90 : 91 }, { day:d, metric:'rhr', value: i % 3 ? 52 : 50 }); }
  localStorage.setItem('ftpb_health_v1', JSON.stringify({ daily, token:null,
    sleep:[{ night:'2026-11-24', asleep_min:341, source:'Intervals.icu' }, { night:'2026-11-23', asleep_min:420, source:'Intervals.icu' }, { night:'2026-11-22', asleep_min:450, source:'Intervals.icu' }],
    workouts:[
      { start_at:'2026-11-24T05:51:34Z', type:'Vélo', duration_min:16, distance_km:5.89, source:'Intervals.icu', indoor:false },
      { start_at:'2026-11-24T06:04:18Z', type:'Natation', duration_min:54.3, distance_km:2.825, source:'Intervals.icu' },
      { start_at:'2026-11-24T11:22:20Z', type:'Course à pied', duration_min:46.6, distance_km:8.45, avg_hr:156, source:'Intervals.icu' } ] }));
});
await pg.goto('file://' + new URL('../index.html', import.meta.url).pathname); await pg.waitForTimeout(300);
await pg.evaluate(() => { S.plan = generatePlan(S.profile); render(); });
const B = await pg.evaluate(() => { const B = dayBattery(); return B && { v0: B.v0, now: B.now, ses: B.ses.map(s => s.l + ':' + s.cost), wake: new Date(B.wake*1000).getHours(), tips: energyTips(B) }; });
console.log(JSON.stringify(B));
assert(B && B.ses.length === 3, '3 séances du jour (vélotaf, nat, course)');
assert(B.ses[0].startsWith('Vélotaf') && /Natation:\d+/.test(B.ses[1]) && /Course:\d+/.test(B.ses[2]), 'séances reconnues et triées');
assert(B.now < B.v0 - 20, `batterie vidée dans la journée (${B.v0} → ${B.now})`);
assert(B.wake <= 6, 'réveil avant la première séance');
assert(B.tips.some(t => /Nuit courte \(5h41\)/.test(t)), 'conseil : nuit courte');
assert(B.tips.some(t => /25 g de protéines/.test(t) && /séance de midi \(course\)/.test(t)), 'conseil : protéines selon le poids, après la course de midi');
// bulle Énergie de l'accueil : valeur actuelle, réveil rappelé
const tile = (await pg.locator('.home [data-pane="forme"]').innerText()).replace(/\s+/g, ' ');
assert(tile.includes(String(B.now)) && tile.toLowerCase().includes(`réveil ${B.v0}`), 'bulle Énergie : maintenant + réveil · ' + tile);
// fiche Énergie : courbe de la journée, coûts, conseils, puis barres au réveil
await pg.evaluate(() => openInfo ? openInfo('score') : null).catch(() => {});
if (!(await pg.locator('.eday').count())) { await pg.tap('.home [data-pane="forme"]'); await pg.waitForTimeout(300); }
const ed = pg.locator('.eday').first();
assert(await ed.count() === 1, 'courbe « Batterie de la journée » affichée');
const tx = await ed.innerText();
assert(/🏊/.test(tx) && /🏃/.test(tx) && /−\d+ pts/.test(tx), 'coût de chaque séance en points');
assert(await ed.locator('polyline').count() === 1, 'courbe tracée');
await ed.scrollIntoViewIfNeeded(); await pg.screenshot({ path: out + '/energy-day.png', fullPage: false });
assert(!errs.length, 'aucune erreur JS ' + errs.join(' | '));
await b.close();
