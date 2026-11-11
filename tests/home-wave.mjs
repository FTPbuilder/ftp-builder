// Accueil : les courbes Heures sport / Énergie font « la vague » à l'arrivée, pas à chaque rafraîchissement.
const pw = (await import('module')).createRequire(process.env.PW_REQUIRE || '/opt/npm-tools/node_modules/x.js')('playwright');
const out = process.env.SCRATCH || '.';
const assert = (c, m) => { if (!c) { console.error('ÉCHEC', m); process.exitCode = 1; } else console.log('ok', m); };
const b = await pw.chromium.launch(); const ctx = await b.newContext({ ...pw.devices['iPhone 13'], colorScheme:'dark' });
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.addInitScript(() => {
  if (localStorage.getItem('ftpb_state_v1')) return;
  const days = { 0:{avail:false,max:75}, 1:{avail:true,max:75}, 2:{avail:false,max:75}, 3:{avail:true,max:75}, 4:{avail:false,max:75}, 5:{avail:true,max:120}, 6:{avail:false,max:120} };
  localStorage.setItem('ftpb_state_v1', JSON.stringify({ version:1, updatedAt:Date.now(), profile:{ name:'A', sex:'M', age:28, weightKg:84, heightCm:181, ftp:260, hrMax:193, goalFtp:300, goalDate:'2027-03-05', endDate:'2027-03-15', minSessions:35, startDate:'2026-10-21', days, keyPerWeek:2, optionalPerWeek:0, holidays:true, testProtocol:'ramp', intensityAdj:1, ctl0:40 }, plan:[], activities:[], ftpHistory:[], settings:{ theme:'auto' }, guideOff:true }));
  const daily = [], wk = []; const t0 = Date.now();
  for (let i = 60; i >= 0; i--) { const d = new Date(t0 - i*864e5).toISOString().slice(0,10); daily.push({ day:d, metric:'hrv', value: 80 + 15*Math.sin(i/2) }, { day:d, metric:'rhr', value: 50 + 4*Math.cos(i/3) });
    if (i % 2 === 0) wk.push({ start_at:d + 'T06:00:00Z', type:i % 4 ? 'Course' : 'Natation', duration_min:30 + (i*7) % 50, distance_km:5, avg_hr:140, source:'Intervals.icu' }); }
  localStorage.setItem('ftpb_health_v1', JSON.stringify({ daily, sleep:[], token:null, workouts:wk }));
});
await pg.goto('file://' + new URL('../index.html', import.meta.url).pathname);
await pg.waitForSelector('.home .spark[data-pts]', { timeout:5000 });
const ys = () => pg.$$eval('.home .spark .sp-l', x => x.map(p => p.getAttribute('d')));
const final = await pg.$$eval('.home .spark', x => x.map(s => s.dataset.pts));
assert(final.length === 2, 'deux courbes sur l\'accueil');
await pg.waitForTimeout(1800); const end = await ys(); await pg.locator('.home .grid').screenshot({ path: out + '/wave-end.png' });
const endPts = await pg.$$eval('.home .spark', x => x.map(s => { const p = s.dataset.pts.split(' ').map(q => q.split(',').map(Number)); return homeSparkD(p) === s.querySelector('.sp-l').getAttribute('d'); }));
assert(endPts.every(Boolean), 'la courbe se pose exactement sur ses valeurs');
await pg.evaluate(() => render()); await pg.waitForTimeout(100);
const again = await pg.$$eval('.home .spark', x => x.map(s => { const p = s.dataset.pts.split(' ').map(q => q.split(',').map(Number)); return homeSparkD(p) === s.querySelector('.sp-l').getAttribute('d'); }));
assert(again.every(Boolean), 'pas de vague sur un simple rafraîchissement');
await pg.tap('button[data-tab="cal"]'); await pg.waitForTimeout(150); await pg.tap('button[data-tab="today"]'); await pg.waitForTimeout(550);
await pg.locator('.home .grid').screenshot({ path: out + '/wave-mid.png' });
const replay = await pg.$$eval('.home .spark', x => x.map(s => { const p = s.dataset.pts.split(' ').map(q => q.split(',').map(Number)); return homeSparkD(p) === s.querySelector('.sp-l').getAttribute('d'); }));
assert(replay.every(v => !v), 'la vague joue en arrivant sur Aujourd\'hui (courbes en mouvement)');
await pg.waitForTimeout(1800); assert(JSON.stringify(await ys()) === JSON.stringify(end), 'et se repose au même endroit');
// rafraîchissement pendant la vague (synchro au démarrage) : pas de saut
await pg.tap('button[data-tab="cal"]'); await pg.waitForTimeout(150); await pg.tap('button[data-tab="today"]'); await pg.waitForTimeout(400);
const jump = await pg.evaluate(() => { const g = () => [...document.querySelectorAll('.home .spark .sp-l')].map(p => p.getAttribute('d')); const a = g(); render(); const b2 = g();
  const pts = [...document.querySelectorAll('.home .spark')].map(s => homeSparkD(s.dataset.pts.split(' ').map(q => q.split(',').map(Number))));
  const nums = d => d.match(/-?[\d.]+/g).map(Number); const diff = a.map((d, i) => Math.max(...nums(d).map((v, j) => Math.abs(v - nums(b2[i])[j]))));
  return { diff, final: b2.some((d, i) => d === pts[i]), arrive: document.querySelector('.home').classList.contains('arrive') }; });
console.log('écart max au rafraîchissement :', jump.diff.map(v => v.toFixed(1)).join(' / '));
assert(!jump.final && jump.diff.every(v => v < 6), 'un rafraîchissement pendant la vague ne la fait pas sauter');
assert(!jump.arrive, 'les cartes ne rejouent pas leur entrée au rafraîchissement');
assert(!errs.length, 'aucune erreur JS ' + errs.join(' | '));
await b.close();
