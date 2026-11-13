// Profil › Échauffement préféré : rallonge le 1er palier d'échauffement des séances qui en prévoient moins, sans toucher aux autres.
const pw = (await import('module')).createRequire(process.env.PW_REQUIRE || '/opt/npm-tools/node_modules/x.js')('playwright');
const assert = (c, m) => { if (!c) { console.error('ÉCHEC', m); process.exitCode = 1; } else console.log('ok', m); };
const b = await pw.chromium.launch(); const ctx = await b.newContext({ ...pw.devices['iPhone 13'] });
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.addInitScript(() => {
  if (localStorage.getItem('ftpb_state_v1')) return;
  const days = {}; for (let d = 0; d < 7; d++) days[d] = { avail: [1,3,5].includes(d), max: 90 };
  localStorage.setItem('ftpb_state_v1', JSON.stringify({ version:2, updatedAt:Date.now(), profile:{ name:'A', sex:'M', age:28, weightKg:84, heightCm:181, ftp:260, hrMax:193, goalFtp:300, goalDate:'2027-03-05', endDate:'2027-03-15', minSessions:35, startDate:'2026-10-21', days, keyPerWeek:2, optionalPerWeek:0, holidays:true, testProtocol:'ramp', intensityAdj:1, ctl0:40 }, plan:[], activities:[], ftpHistory:[], settings:{ theme:'auto', tourSeen:true } }));
});
await pg.goto('file://' + new URL('../index.html', import.meta.url).pathname); await pg.waitForTimeout(1500);
await pg.evaluate(() => { const s = document.querySelector('#splash'); if (s) s.remove(); window.SPLASH_ON = false; });
const info = () => pg.evaluate(() => { const F = window.FTPB, W = F.WORKOUTS, fl = st => st.flatMap(s => s.repeat ? Array(s.repeat).fill(fl(s.steps)).flat() : [s]), dur = id => fl(W[id].steps).reduce((a, s) => a + s.d, 0);
  return Object.fromEntries(['ss_3x10', 'thr_4x8', 'end_60', 'end_180', 'rec_45', 'ramp'].map(id => [id, { wu: F.wuSec(W[id].steps), first: W[id].steps[0].d, dur: dur(id) }])); });
const before = await info();
assert(before.ss_3x10.wu === 13 * 60 && before.end_60.wu === 5 * 60, 'sans réglage : échauffements d’origine (13 et 5 min)');
// réglage depuis le formulaire du profil
await pg.tap('button[data-tab="profile"]'); await pg.waitForTimeout(300);
assert(await pg.locator('#qform select[name="warmupMin"]').count() === 1, 'champ Échauffement préféré dans Profil');
await pg.selectOption('#qform select[name="warmupMin"]', '15');
await pg.locator('#saveOnly').click(); await pg.waitForTimeout(300);
assert(await pg.evaluate(() => window.FTPB.S.profile.warmupMin) === 15, 'préférence enregistrée dans le profil');
const after = await info();
assert(after.ss_3x10.wu === 15 * 60 && after.ss_3x10.first === before.ss_3x10.first + 120, 'sweet spot : 1er palier +2 min → 15 min d’échauffement');
assert(after.ss_3x10.dur === before.ss_3x10.dur + 120, 'durée totale rallongée d’autant');
assert(after.thr_4x8.wu === 15 * 60, 'seuil (avec activations) : 15 min hors activations');
assert(after.end_60.wu === 15 * 60 && after.ramp.wu === 15 * 60, 'endurance 1 h et rampe : 15 min');
assert(after.end_180.wu === before.end_180.wu && after.end_180.dur === before.end_180.dur, 'sortie 3 h (déjà 15 min) inchangée');
assert(after.rec_45.dur === before.rec_45.dur, 'récup active (pas d’échauffement) inchangée');
// les paliers partagés ne sont pas modifiés en place : le retour à « Selon la séance » restaure tout
await pg.selectOption('#qform select[name="warmupMin"]', '0');
await pg.locator('#saveOnly').click(); await pg.waitForTimeout(300);
assert(JSON.stringify(await info()) === JSON.stringify(before), 'retour à « Selon la séance » : séances d’origine');
// la génération du plan tient compte de la préférence (durée max du jour)
const fits = await pg.evaluate(() => { const F = window.FTPB, p = structuredClone(F.S.profile); p.warmupMin = 25; const plan = F.generatePlan(p);
  const fl = st => st.flatMap(s => s.repeat ? Array(s.repeat).fill(fl(s.steps)).flat() : [s]);
  return plan.filter(s => s.workoutId && F.WORKOUTS[s.workoutId]).every(s => F.wuSec(F.WORKOUTS[s.workoutId].steps) >= 25 * 60 || !F.wuSec(F.WORKOUTS[s.workoutId].steps)); });
assert(fits, 'plan généré avec 25 min d’échauffement mini');
assert(!errs.length, 'pas d’erreur JS ' + errs.join(' | '));
await b.close();
