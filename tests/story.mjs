// Phases du programme (Base / Build / Peak…) et bilan de la semaine en story le dimanche soir
const pw = (await import('module')).createRequire(process.env.PW_REQUIRE || '/opt/npm-tools/node_modules/x.js')('playwright');
const assert = (c, m) => { if (!c) { console.error('ÉCHEC', m); process.exitCode = 1; } else console.log('ok', m); };
const out = process.env.SCRATCH || '.';
const b = await pw.chromium.launch(); const ctx = await b.newContext({ ...pw.devices['iPhone 13'] });
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.clock.setFixedTime(new Date('2026-11-08T20:30:00+01:00')); // dimanche soir
await pg.addInitScript(() => {
  if (localStorage.getItem('ftpb_state_v1')) return;
  const days = { 0:{avail:false,max:75}, 1:{avail:true,max:75}, 2:{avail:false,max:75}, 3:{avail:true,max:75}, 4:{avail:false,max:75}, 5:{avail:true,max:120}, 6:{avail:false,max:120} };
  localStorage.setItem('ftpb_state_v1', JSON.stringify({ version:1, updatedAt:Date.now(), profile:{ name:'A', sex:'M', age:28, weightKg:84, heightCm:181, ftp:260, hrMax:201, goalFtp:300, goalDate:'2027-03-05', endDate:'2027-03-15', minSessions:35, startDate:'2026-10-21', days, keyPerWeek:2, optionalPerWeek:0, holidays:true, testProtocol:'ramp', intensityAdj:1, ctl0:40 }, plan:[], activities:[], ftpHistory:[], settings:{ theme:'auto' } }));
  const W = (start_at, type, duration_min, distance_km) => ({ start_at, type, duration_min, distance_km, avg_hr:140, source:'Intervals.icu' });
  localStorage.setItem('ftpb_health_v1', JSON.stringify({ daily:[], sleep:[], token:null, workouts:[W('2026-11-06T06:00:00Z','Natation',41,2.0), W('2026-11-08T10:00:00Z','Renforcement musculaire',45,null), W('2026-11-04T17:00:00Z','Course à pied',40,7.5)] }));
});
await pg.goto('file://' + new URL('../index.html', import.meta.url).pathname); await pg.waitForTimeout(300);
await pg.evaluate(() => { S.plan = generatePlan(S.profile); applyTri({ ...TRI_DEF(), enabled:true, css:110, runThr:290, swimDays:[1,4], runDays:[0,2,6], swimPerWeek:2, runPerWeek:3 });
  // une séance vélo faite mardi
  const s = S.plan.find(x => x.date >= '2026-11-02' && x.date <= '2026-11-08' && mandatory(x));
  S.activities.push({ id:'a1', source:'manual', date:s.date, name:'HT', durationS:4140, tss:66, np:235, hasPower:true, indoor:true, planId:s.id }); s.status = 'done'; s.activityId = 'a1';
  save(); render(); });
const P = await pg.evaluate(() => { const P = phases(); return { cur: P.cur.ph, i: P.cur.i, segs: P.segs.map(s => s.ph + ':' + s.weeks.length).join(' ') }; });
console.log('PHASES', JSON.stringify(P));
assert(P.cur === 'base' && /calib:1 base:\d+ build1:\d+ build2:\d+ spec:\d+.*taper:1 final:1/.test(P.segs), 'macro-cycle Base → Build → Spécifique → Affûtage → Objectif');
assert(await pg.locator('.recap').count() === 1, 'dimanche soir : bannière du bilan sur l\'accueil');
await pg.screenshot({ path: out + '/story-home.png' });
await pg.tap('.recap'); await pg.waitForTimeout(300);
const n = await pg.locator('#story .sty-s').count();
assert(n === 4, '4 écrans dans la story');
await pg.screenshot({ path: out + '/story-1.png' });
for (let i = 2; i <= 4; i++) { await pg.mouse.click(330, 500); await pg.waitForTimeout(250); await pg.screenshot({ path: out + `/story-${i}.png` }); }
const s3 = await pg.locator('#story .sty-s[data-s="2"]').innerText(), s4 = await pg.locator('#story .sty-s[data-s="3"]').innerText();
assert(/On track|Tu charges trop|Pas assez/.test(s3) && /charge prévue/.test(s3), 'bilan : verdict + indicateurs');
const nk = await pg.locator('#story .sty-s[data-s="3"] .sty-key').count();
assert(nk >= 2 && nk <= 3, `semaine prochaine : ${nk} séances clés`);
assert(/Semaine prochaine/i.test(s4), 'feuille semaine prochaine');
// tap sur une séance clé : ferme la story et ouvre la fiche
await pg.locator('#story .sty-s[data-s="3"] .sty-key').first().tap(); await pg.waitForTimeout(300);
assert(!(await pg.locator('#story.on').count()) && await pg.locator('#dlg[open]').count() === 1, 'séance clé → fiche de la séance');
await pg.evaluate(() => closeDlg());
assert(await pg.locator('.recap.seen').count() === 1, 'bilan marqué comme vu');
// calendrier : carte « Où j'en suis » + bouton Bilan par semaine
await pg.tap('button[data-tab="cal"]'); await pg.waitForTimeout(200);
const ph = await pg.locator('.card.phase').innerText();
assert(/Base/.test(ph) && /semaine \d\/\d du bloc/.test(ph) && /Ensuite/.test(ph), 'calendrier : phase en cours et la suivante');
await pg.locator('.card.phase').screenshot({ path: out + '/phase.png' });
assert(await pg.locator('.week [data-story]').count() >= 3, 'bouton Bilan sur les semaines passées');
await pg.locator('.ph-why').tap(); await pg.waitForTimeout(200);
assert(/polarisée/.test(await pg.locator('#infoDlg').innerText()), 'fiche méthode');
// mardi : plus de bannière
await pg.clock.setFixedTime(new Date('2026-11-10T09:00:00+01:00')); await pg.reload(); await pg.waitForTimeout(300);
assert(await pg.locator('.recap').count() === 0, 'mardi : pas de bannière');
assert(!errs.length, 'aucune erreur JS ' + errs.join(' | '));
await b.close();
