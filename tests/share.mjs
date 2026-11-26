// Partage d'une séance : carrousel d'images 1080 px (résumé, courbes réelles, tracé et stats transparents, efforts), bouton sur la fiche, toast après le ressenti
const pw = (await import('module')).createRequire(process.env.PW_REQUIRE || '/opt/npm-tools/node_modules/x.js')('playwright');
const assert = (c, m) => { if (!c) { console.error('ÉCHEC', m); process.exitCode = 1; } else console.log('ok', m); };
const out = process.env.SCRATCH || '.';
const b = await pw.chromium.launch(); const ctx = await b.newContext({ ...pw.devices['iPhone 13'] });
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.clock.setFixedTime(new Date('2026-11-26T21:00:00+01:00'));
await pg.addInitScript(() => {
  if (localStorage.getItem('ftpb_state_v1')) return;
  const days = { 0:{avail:false,max:75}, 1:{avail:true,max:75}, 2:{avail:false,max:75}, 3:{avail:true,max:75}, 4:{avail:false,max:75}, 5:{avail:true,max:120}, 6:{avail:false,max:120} };
  localStorage.setItem('ftpb_state_v1', JSON.stringify({ version:1, updatedAt:Date.now(), profile:{ name:'A', sex:'M', age:28, weightKg:84, heightCm:181, ftp:255, hrMax:201, goalFtp:300, goalDate:'2027-03-05', endDate:'2027-03-15', minSessions:35, startDate:'2026-10-21', days, keyPerWeek:2, optionalPerWeek:0, holidays:true, testProtocol:'ramp', intensityAdj:1, ctl0:40 }, plan:[], activities:[], ftpHistory:[], settings:{ theme:'dark' } }));
});
await pg.goto('file://' + new URL('../index.html', import.meta.url).pathname); await pg.waitForTimeout(300);
await pg.evaluate(() => {
  S.plan = generatePlan(S.profile);
  const pl = S.plan.find(x => x.date <= '2026-11-26' && x.workoutId) || S.plan[0]; pl.workoutId = 'ss_3x12'; pl.date = '2026-11-26';
  // 3 × 12 min à ~240 W avec du bruit réaliste, puis échantillonnée à 300 points comme un import .fit
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pw1 = [], hr1 = []; let hr = 100;
  const seg = (sec, w, h) => { for (let i = 0; i < sec; i++) { pw1.push(Math.max(0, Math.round(w + (rnd() - 0.5) * 40 + (rnd() < 0.01 ? -w : 0)))); hr += (h - hr) * 0.01 + (rnd() - 0.5) * 0.8; hr1.push(Math.round(hr)); } };
  seg(600, 150, 120); for (let k = 0; k < 3; k++) { seg(720, 242, 162); seg(300, 130, 125); } seg(360, 140, 120);
  const ds = arr => Array.from({ length: 300 }, (_, i) => { const a0 = Math.floor(i * arr.length / 300), a1 = Math.floor((i + 1) * arr.length / 300); let t = 0; for (let j = a0; j < a1; j++) t += arr[j]; return Math.round(t / (a1 - a0)); });
  S.activities.push({ id:'a0', source:'strava', date:'2026-11-10', name:'Seuil', durationS:3600, tss:70, np:230, hasPower:true, indoor:true, best:{ s5:380, m1:290, m5:265, m20:232 } });
  S.activities.push({ id:'a1', source:'strava', stravaId: 123456, date:'2026-11-26', name:'Sweet spot', durationS: pw1.length, tss:71, np:225, avgPower:210, if:0.83, avgHr:147, maxHr:170, avgCad:95, hasPower:true, indoor:true,
    planId: pl.id, pwSample: ds(pw1), hrSample: ds(hr1), sampleSecs: pw1.length, best:{ s5:362, m1:286, m5:272, m8:262, m20:237 }, feel:{ rpe:6, legs:4 } });
  pl.status = 'done'; pl.activityId = 'a1';
  const lat = [], lon = []; for (let i = 0; i < 400; i++) { const t = i / 400 * Math.PI * 2; lat.push(48.72 + 0.08 * Math.sin(t) + 0.015 * Math.sin(5 * t)); lon.push(2.05 + 0.12 * Math.cos(t) + 0.02 * Math.cos(3 * t)); }
  Tracks.put(1763800000, { v:1, lat, lon }, 'fit');
  S.activities.push({ id:'a2', source:'strava', startTs: 1763800000, date:'2026-11-22', name:'Sortie vallée de Chevreuse', durationS: 9000, tss:120, distanceKm:72.4, elevM:820, avgSpeed:29, avgHr:138, maxHr:176, indoor:false,
    altSample: Array.from({length:600}, (_, i) => 80 + 60*Math.sin(i/40) + i/10), hrSample: Array.from({length:600}, (_, i) => 130 + 10*Math.sin(i/30)), sampleSecs: 9000 });
  save(); render(); activityDlg('a1');
});
await pg.waitForTimeout(200);
assert(await pg.locator('#shareAct').count() === 1, 'bouton Partager sur la fiche de la séance');
await pg.locator('#shareAct').tap(); await pg.waitForSelector('#shrCar img', { timeout: 8000 });
const m = await pg.evaluate(async () => { const m = await Share.model(S.activities.find(a => a.id === 'a1')); return { ...m, slides: Share.slidesOf(m) }; });
assert(m.hero[0] === '225' && m.stats.length === 6 && m.ch?.tgt && m.ch.main.length === 300, 'modèle : NP en héros, 6 indicateurs, vraie courbe (300 points) avec cible');
assert(m.ch.units?.length === 3 && m.ch.units.every(u => Math.abs(u.got - 242) < 8), 'courbes : puissance moyenne des 3 blocs');
assert(m.efforts.find(e => e.k === 'm20').rec && !m.efforts.find(e => e.k === 's5').rec, 'efforts : record sur 20 min, pas sur 5 s');
assert(m.prog && m.prog.i === 1 && m.prog.n === 35, 'progression du programme (séance 1 / 35)');
assert(m.slides.join() === 'resume,courbe,efforts,stats', 'home trainer : résumé, courbes, efforts, stats');
const m2 = await pg.evaluate(async () => Share.slidesOf(await Share.model(S.activities.find(a => a.id === 'a2'))));
assert(m2.join() === 'resume,courbe,trace,stats', 'sortie dehors : avec le tracé GPS');
assert(await pg.locator('#shrCar .shr-it').count() === 4, '4 images dans le carrousel');
const dims = await pg.evaluate(() => { const i = document.querySelector('#shrCar img'); return [i.naturalWidth, i.naturalHeight]; });
assert(dims[0] === 1080 && dims[1] === 1920, 'story en 1080 × 1920');
assert(/\(4\)/.test(await pg.locator('#shrSave').innerText()), 'enregistrer les 4 images');
await pg.locator('#shrCar .shr-it[data-k="efforts"]').tap(); await pg.waitForTimeout(100);
assert(/\(3\)/.test(await pg.locator('#shrSave').innerText()) && await pg.locator('#shrCar .shr-it.off').count() === 1, 'une image retirée du carrousel');
await pg.locator('#shrCar .shr-it[data-k="efforts"]').tap();
assert(await pg.locator('#shrStrava').getAttribute('href') === 'https://www.strava.com/activities/123456', 'lien « Ouvrir dans Strava »');
// sauvegarde de toutes les variantes en PNG pour contrôle visuel
const fs = await import('fs');
const dump = async (id, k, fmt, sty) => { const d = await pg.evaluate(async ([id, k, fmt, sty]) => Share.draw(await Share.model(S.activities.find(a => a.id === id)), k, fmt, sty).toDataURL('image/png'), [id, k, fmt, sty]);
  fs.writeFileSync(`${out}/share-${id}-${k}-${fmt}-${sty}.png`, Buffer.from(d.split(',')[1], 'base64')); };
for (const k of ['resume', 'courbe', 'efforts', 'stats']) { await dump('a1', k, 'story', 'dark'); await dump('a1', k, 'post', 'light'); }
for (const k of ['resume', 'courbe', 'trace', 'stats']) await dump('a2', k, 'post', 'dark');
await dump('a2', 'trace', 'story', 'dark');
const transparent = await pg.evaluate(async () => { const c = Share.draw(await Share.model(S.activities.find(a => a.id === 'a2')), 'trace', 'story', 'dark'); return c.getContext('2d').getImageData(5, 5, 1, 1).data[3]; });
assert(transparent === 0, 'tracé : fond transparent');
// format post
await pg.locator('.seg[data-shr="fmt"] button[data-v="post"]').tap(); await pg.waitForFunction(() => document.querySelector('#shrCar img')?.naturalHeight === 1350, null, { timeout: 8000 });
assert(true, 'post en 1080 × 1350');
await pg.screenshot({ path: out + '/share-dlg.png' });
// retour à la fiche
await pg.locator('#shrBack').tap(); await pg.waitForTimeout(150);
assert(await pg.locator('#shareAct').count() === 1, 'retour à la fiche');
// toast avec action après le ressenti
await pg.evaluate(() => feelDlg('a1')); await pg.locator('#fSave').tap(); await pg.waitForTimeout(150);
assert(await pg.locator('.toast button').count() === 1, 'toast « Partager › » après le ressenti');
await pg.locator('.toast button').tap(); await pg.waitForSelector('#shrCar img', { timeout: 8000 });
assert(await pg.locator('#dlg[open] #shrGo').count() === 1, 'le toast ouvre le partage');
assert(!errs.length, 'aucune erreur JS ' + errs.join(' | '));
await b.close();
