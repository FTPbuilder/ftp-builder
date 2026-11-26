// Visuel de partage d'une séance : image 1080 px (story 9:16, post 4:5 ; sombre, clair, transparent), bouton sur la fiche, toast après le ressenti
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
  // 3 × 12 min à ~240 W, récup 5 min, échauffement 10 min
  const pwS = [], hrS = []; let hr = 100;
  const seg = (sec, w, h) => { for (let i = 0; i < sec; i++) { pwS.push(Math.round(w + Math.sin(i / 7) * 8)); hr += (h - hr) * 0.02; hrS.push(Math.round(hr)); } };
  seg(600, 150, 120); for (let k = 0; k < 3; k++) { seg(720, 242, 162); seg(300, 130, 125); } seg(360, 140, 120);
  S.activities.push({ id:'a1', source:'strava', date:'2026-11-26', name:'Sweet spot', durationS: pwS.length, tss:71, np:225, avgPower:210, if:0.83, avgHr:147, maxHr:170, avgCad:95, hasPower:true, indoor:true,
    planId: pl.id, pwSample: pwS, hrSample: hrS, sampleSecs: pwS.length, best:{ s5:362, m1:286, m5:272, m20:237 }, feel:{ rpe:6, legs:4 } });
  pl.status = 'done'; pl.activityId = 'a1';
  S.activities.push({ id:'a2', source:'strava', date:'2026-11-22', name:'Sortie vallée de Chevreuse', durationS: 9000, tss:120, distanceKm:72.4, elevM:820, avgSpeed:29, avgHr:138, maxHr:176, indoor:false,
    altSample: Array.from({length:600}, (_, i) => 80 + 60*Math.sin(i/40) + i/10), hrSample: Array.from({length:600}, (_, i) => 130 + 10*Math.sin(i/30)), sampleSecs: 9000 });
  save(); render(); activityDlg('a1');
});
await pg.waitForTimeout(200);
assert(await pg.locator('#shareAct').count() === 1, 'bouton Partager sur la fiche de la séance');
await pg.locator('#shareAct').tap(); await pg.waitForSelector('#shrPrev img', { timeout: 8000 });
const m = await pg.evaluate(() => Share.model(S.activities.find(a => a.id === 'a1')));
assert(m.hero[0] === '225' && m.stats.length === 6 && m.recs.length === 4 && m.ch?.tgt, 'modèle : NP en héros, 6 indicateurs, 4 records, courbe avec cible');
assert(m.prog && m.prog.i === 1 && m.prog.n === 35, 'progression du programme (séance 1 / 35)');
const dims = await pg.evaluate(() => { const i = document.querySelector('#shrPrev img'); return [i.naturalWidth, i.naturalHeight]; });
assert(dims[0] === 1080 && dims[1] === 1920, 'story en 1080 × 1920');
// sauvegarde des variantes en PNG pour contrôle visuel
const dump = async (id, fmt, sty, name) => { const d = await pg.evaluate(([id, fmt, sty]) => Share.draw(S.activities.find(a => a.id === id), fmt, sty).toDataURL('image/png'), [id, fmt, sty]);
  (await import('fs')).writeFileSync(`${out}/${name}.png`, Buffer.from(d.split(',')[1], 'base64')); };
await dump('a1', 'story', 'dark', 'share-story-dark'); await dump('a1', 'post', 'light', 'share-post-light'); await dump('a1', 'story', 'clear', 'share-story-clear'); await dump('a2', 'post', 'dark', 'share-post-outdoor');
// changement de format → 4:5
await pg.locator('.seg[data-shr="fmt"] button[data-v="post"]').tap(); await pg.waitForFunction(() => document.querySelector('#shrPrev img')?.naturalHeight === 1350, null, { timeout: 8000 });
assert(true, 'post en 1080 × 1350');
const transparent = await pg.evaluate(() => { const c = Share.draw(S.activities[0], 'story', 'clear'); return c.getContext('2d').getImageData(5, 5, 1, 1).data[3]; });
assert(transparent === 0, 'style transparent : fond sans pixels');
await pg.screenshot({ path: out + '/share-dlg.png' });
// retour à la fiche
await pg.locator('#shrBack').tap(); await pg.waitForTimeout(150);
assert(await pg.locator('#shareAct').count() === 1, 'retour à la fiche');
// toast avec action après le ressenti
await pg.evaluate(() => feelDlg('a1')); await pg.locator('#fSave').tap(); await pg.waitForTimeout(150);
assert(await pg.locator('.toast button').count() === 1, 'toast « Partager › » après le ressenti');
await pg.locator('.toast button').tap(); await pg.waitForSelector('#shrPrev img', { timeout: 8000 });
assert(await pg.locator('#dlg[open] #shrGo').count() === 1, 'le toast ouvre le partage');
assert(!errs.length, 'aucune erreur JS ' + errs.join(' | '));
await b.close();
