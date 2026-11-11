// Recomposition de séance : parseur (texte libre -> blocs), calage sur le flux distance/FC, écran et suivi par bloc.
import fs from 'fs';
const jsDir = new URL('../js/', import.meta.url); const html = [fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8'), ...fs.readdirSync(jsDir).sort().map(f => fs.readFileSync(new URL(f, jsDir), 'utf8'))].join('\n');
const Recomp = new Function(html.slice(html.indexOf('/* ===== RECOMP ====='), html.indexOf('/* ===== /RECOMP ===== */')) + '; return Recomp;')();
const assert = (c, m) => { if (!c) { console.error('ÉCHEC', m); process.exitCode = 1; } else console.log('ok', m); };
const TXT = `400m échauffement crawl brasse crawl
300m edu 25 chien 50 rattrapé
4x200 pull plaquette 1 200 amplitude 2e rapide (et on répète une deuxième fois)
400 recup pull
100 à fonds 10sec recup
75 à fonds 25 calme 10´ recup
50 à fonds 50 calme 10´ recup
25 à fonds 75 calme 10´ recup
100 calme
50 à fonds 10’ recup
25 a fond 10’ recup
25 a fond 10’ recup
50 calme`;
const items = Recomp.parse(TXT, 'swim');
assert(items.length === 16 && items.reduce((s, x) => s + x.d, 0) === 2550, 'nat du 3/11 : 16 blocs, 2550 m');
assert(items[2].pieces[0].int === 'amplitude' && items[3].pieces[0].int === 'rapide' && items[3].pieces[0].tags.join() === 'pull,plaquettes', '4x200 pull plaquettes en alternance amplitude / rapide');
assert(items[8].pieces.map(p => p.d + p.int).join() === '75max,25calme' && items[8].rest === 10, '« 75 à fond 25 calme 10´ récup »');
assert(items[6].pieces[0].int === 'calme' && items[6].pieces[0].tags.join() === 'pull', '« 400 recup pull »');
const run = Recomp.parse("15 min échauffement\n3x10 min seuil 2 min recup\n6x400 rapide 1'30 récup\n4x1km à 4'05 récup 1 min", 'run');
assert(run[0].dur === 900 && run[1].dur === 600 && run[1].rest === 120 && run[4].d === 400 && run[4].rest === 90 && run[10].d === 1000 && run[10].rest === 60, 'formats course (temps, distance, récup)');
assert(Recomp.parse('8x50 palmes 1 sur 2 rapide', 'swim').map(x => x.pieces[0].int).slice(0, 2).join() === 'rapide,moyen', '« 1 sur 2 rapide »');
// flux synthétique : la montre compte ~8 % de trop, repos = palier de distance
function swimStream(its, speed = { max: 1.35, rapide: 1.1 }){ // m/s
  const t = [0], d = [0], hr = [120]; let T = 0, D = 0;
  for (const it of its) { for (const pc of it.pieces) { const v = speed[pc.int] || 0.85; let left = pc.d*1.08; while (left > 0) { const s = Math.min(left, v*3); D += s; left -= s; T += 3; t.push(T); d.push(+D.toFixed(1)); hr.push(pc.int === 'max' ? 160 : 135); } }
    for (let k = 0; k < (it.rest || 20)/3; k++) { T += 3; t.push(T); d.push(+D.toFixed(1)); hr.push(125); } }
  return { v:2, intervals:[], s:{ t, d, hr } };
}
const res = Recomp.align(items, swimStream(items));
assert(res.items.every(it => it.snapped || it === res.items[res.items.length-1]), 'chaque bloc calé sur un repos');
const r200 = res.items[3].pieces[0];
assert(Math.abs(r200.sec/r200.md*100 - 91) < 3, `allure 200 rapide ≈ 1'31 /100 m (${(r200.sec/r200.md*100).toFixed(1)} s)`);
const p75 = res.items[8].pieces;
assert(p75[0].hr > p75[1].hr && Math.abs(p75[0].sec/p75[0].md*100 - 74) < 8, '75 à fond puis 25 calme découpés dans le même bloc');

// nat du 9/11 : « 500pull » collé, chevilles ; la montre ne s'arrête qu'après 950 m puis 2000 m
const n9 = Recomp.parse("500pull\n100pull chevill\n350 free\n1050 pull\n200 free", 'swim');
assert(n9.length === 5 && n9.reduce((s, x) => s + x.d, 0) === 2200 && n9[1].pieces[0].tags.join() === 'pull,chevilles', '« 500pull » / « 100pull chevill » reconnus (2200 m)');
assert(Recomp.unparsed("500 pull\nnotes du coach\n200", 'swim').join() === 'notes du coach', 'ligne non reconnue signalée');
{ const t = [0], d = [0]; let T = 0, D = 0;
  const go = (m, sec) => { const n = Math.round(sec/3); for (let k = 0; k < n; k++) { T += 3; D += m/n; t.push(T); d.push(+D.toFixed(1)); } };
  const rest = sec => { for (let k = 0; k < sec/3; k++) { T += 3; t.push(T); d.push(+D.toFixed(1)); } };
  go(500, 480); go(100, 105); go(350, 336); rest(95); go(1050, 1009); rest(88); go(200, 177);
  const r9 = Recomp.align(n9, { v:2, intervals:[], s:{ t, d } });
  assert(r9.items.map(x => x.md).join() === '500,100,350,1050,200' && r9.items[2].snapped && r9.items[3].snapped, `blocs calés sur les arrêts montre (${r9.items.map(x => x.md)})`);
  assert(Math.abs(r9.items[3].sec - 1009) < 6, '1050 pull ≈ 16\'49 comme la montre'); }

// écran
const pw = (await import('module')).createRequire(process.env.PW_REQUIRE || '/opt/npm-tools/node_modules/x.js')('playwright');
const b = await pw.chromium.launch(); const ctx = await b.newContext({ ...pw.devices['iPhone 13'] });
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.clock.setFixedTime(new Date('2026-11-03T20:00:00+01:00'));
const prevRef = 'w:2026-10-27T06:04:00.000Z', curRef = 'w:2026-11-03T05:57:39.000Z';
// séance précédente déjà recomposée : 200 rapide en 1'34
const prev = { sport:'swim', date:'2026-10-27', ts: Date.parse('2026-10-27T06:04:00Z')/1000, text:'4x200 pull plaquettes rapide', planned:800, measured:800, rows:[], sum:[1,2,3,4].map(() => ({ k:'swim|200|rapide|plaquettes|pull', d:200, int:'rapide', tags:['pull','plaquettes'], pace:94, hr:150 })) };
await pg.addInitScript(([prev, prevRef]) => {
  const days = {}; for (let i = 0; i < 7; i++) days[i] = { avail: i % 2 === 1, max: 75 };
  localStorage.setItem('ftpb_state_v1', JSON.stringify({ version:1, updatedAt:Date.now(), profile:{ name:'A', sex:'M', age:28, weightKg:83, heightCm:181, ftp:260, hrMax:201, goalFtp:300, goalDate:'2027-03-05', endDate:'2027-03-15', minSessions:35, startDate:'2026-10-21', days, keyPerWeek:2, optionalPerWeek:0, testProtocol:'ramp', intensityAdj:1, ctl0:40 }, plan:[], activities:[], ftpHistory:[], settings:{ theme:'auto' }, recomp:{ [prevRef]: prev } }));
  const W = (start, type, min, km, hr) => ({ start_at:start, type, duration_min:min, distance_km:km, avg_hr:hr, source:'Intervals.icu' });
  localStorage.setItem('ftpb_health_v1', JSON.stringify({ daily:[], sleep:[], workouts:[ W('2026-10-27T06:04:00.000Z','Natation',46,2.6,138), W('2026-11-03T05:57:39.000Z','Natation',63,3.025,141), W('2026-10-30T12:13:00+01:00','Course à pied',44,8.3,150) ], token:null }));
}, [prev, prevRef]);
await pg.goto('file://' + new URL('../index.html', import.meta.url).pathname); await pg.waitForTimeout(300);
const laps = swimStream(items);
await pg.evaluate(([laps]) => { window.lapsFor = async () => laps; }, [laps]);
await pg.tap('.home [data-pane="heures"]'); await pg.waitForTimeout(200);
await pg.locator(`[data-ssess="${curRef}"]`).tap(); await pg.waitForTimeout(200);
assert(await pg.locator('#dlg [data-recomp]').count() === 1, 'bouton « Recomposer » sur la fiche natation');
await pg.locator('#dlg [data-recomp]').tap(); await pg.waitForTimeout(200);
await pg.fill('#rcText', TXT); await pg.tap('#rcGo'); await pg.waitForTimeout(200);
const rows = await pg.locator('#rcOut .hist').allInnerTexts();
console.log(rows.slice(2, 5).map(r => r.replace(/\s+/g, ' ')));
assert(rows.length === 16, '16 blocs affichés');
assert(/▲ [34] %/.test(rows[3]), '200 rapide : 1\'31 vs 1\'34 la semaine précédente → ▲ 3 %');
await pg.locator('#dlg').screenshot({ path:'recomp-preview.png' });
await pg.tap('#rcSave'); await pg.waitForTimeout(200);
assert(/Séance recomposée/.test(await pg.locator('#dlg').innerText()), 'fiche : séance recomposée enregistrée');
await pg.locator('#dlg').screenshot({ path:'recomp-saved.png' });
await pg.tap('[data-close]'); await pg.waitForTimeout(100);
const trk = await pg.locator('#todayPane .card').nth(1).innerText();
assert(/Progression par bloc/.test(trk) && /200 m · rapide · pull · plaquettes/.test(trk), 'suivi « Progression par bloc » sur la carte natation');
await pg.locator('#todayPane .card').nth(1).screenshot({ path:'recomp-card.png' });
const st = await pg.evaluate(() => JSON.parse(localStorage.getItem('ftpb_state_v1')).recomp);
assert(Object.keys(st).length === 2 && st['w:2026-11-03T05:57:39.000Z'].sum.length >= 16, 'recomposition sauvegardée dans l\'état');
console.log('errs', errs); if (errs.length) process.exitCode = 1; await b.close();
