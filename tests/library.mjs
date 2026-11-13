// Profil : carrés « Mes ascensions » / « Mes GPX » sous Réglages, livre de traces noté (import, étoiles, tri, export), Mes courses (photos, course objectif ajoutée toute seule).
const pw = (await import('module')).createRequire(process.env.PW_REQUIRE || '/opt/npm-tools/node_modules/x.js')('playwright');
import fs from 'fs'; import path from 'path';
const out = process.env.SCRATCH || '.';
const assert = (c, m) => { if (!c) { console.error('ÉCHEC', m); process.exitCode = 1; } else console.log('ok', m); };
// GPX de test : boucle de ~20 km avec une bosse de ~150 m
const gpx = (name, n = 1500) => { let s = `<?xml version="1.0"?><gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>${name}</name><trkseg>`;
  for (let i = 0; i <= n; i++) { const a = i/n*2*Math.PI; s += `<trkpt lat="${(48.70 + 0.028*Math.sin(a)).toFixed(6)}" lon="${(2.00 + 0.042*(1 - Math.cos(a))).toFixed(6)}"><ele>${(100 + 150*Math.max(0, Math.sin(a))).toFixed(1)}</ele></trkpt>`; }
  return s + '</trkseg></trk></gpx>'; };
const f1 = path.join(out, 'chevreuse.gpx'), f2 = path.join(out, 'vexin.gpx');
fs.writeFileSync(f1, gpx('Boucle Chevreuse')); fs.writeFileSync(f2, gpx('Vexin &amp; boulangeries', 400));
// photo de test : PNG de la fixture
const photo = new URL('./fixtures/tile.png', import.meta.url).pathname;

const b = await pw.chromium.launch(); const ctx = await b.newContext({ ...pw.devices['iPhone 13'], colorScheme: 'dark', acceptDownloads: true });
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.addInitScript(() => {
  if (localStorage.getItem('ftpb_state_v1')) return;
  const days = {}; for (let d = 0; d < 7; d++) days[d] = { avail: [1, 3, 5].includes(d), max: 75 };
  localStorage.setItem('ftpb_state_v1', JSON.stringify({ version: 2, updatedAt: Date.now(), profile: { name: 'A', sex: 'M', age: 28, weightKg: 84, heightCm: 181, ftp: 260, hrMax: 193, goalFtp: 300, goalDate: '2027-03-05', endDate: '2027-03-15', minSessions: 35, startDate: '2026-10-21', days, keyPerWeek: 2, optionalPerWeek: 0, holidays: true, testProtocol: 'ramp', intensityAdj: 1, ctl0: 40 },
    plan: [], activities: [{ id: 'r1', date: '2026-06-07', durationS: 2400, name: 'Nat' }, { id: 'r2', date: '2026-06-07', durationS: 12600, name: 'Vélo' }, { id: 'r3', date: '2026-06-07', durationS: 6300, name: 'Course' }],
    ftpHistory: [], settings: { theme: 'auto', tourSeen: true },
    tri: { enabled: true, race: { name: 'AlpsMan Half', date: '2026-06-07', swim: 2000, bike: 100, bikeDp: 1920, run: 16, runDp: 1300 }, swimPerWeek: 2, runPerWeek: 3, doubles: true, swimDays: [1, 4], runDays: [0, 2, 6], css: 105, runThr: 270, pool: 25, longRide: 180 } }));
});
await pg.goto('file://' + new URL('../index.html', import.meta.url).pathname); await pg.waitForTimeout(1500);
await pg.evaluate(() => { const s = document.querySelector('#splash'); if (s) s.remove(); window.SPLASH_ON = false; });
await pg.tap('button[data-tab="profile"]'); await pg.waitForTimeout(300);

// --- carrés et ordre ---
const order = await pg.evaluate(() => { const app = document.querySelector('#app'), q = s => app.querySelector(s);
  const pos = el => el ? [...app.querySelectorAll('*')].indexOf(el) : -1;
  return { set: pos(q('[data-settings="open"]')), sq: pos(q('.pp-sq')), races: pos(q('#racesCard')), form: pos(q('#qform')),
    left: q('.pp-sq button:first-child')?.dataset.pp, right: q('.pp-sq button:last-child')?.dataset.pp }; });
assert(order.set >= 0 && order.set < order.sq && order.sq < order.races && order.races < order.form, 'Réglages › carrés › Mes courses › questionnaire ' + JSON.stringify(order));
assert(order.left === 'climbs' && order.right === 'gpx', 'ascensions à gauche, GPX à droite');

// --- course objectif passée : ajoutée toute seule avec le temps des séances du jour ---
const auto = await pg.evaluate(() => FTPB.S.races?.find(r => r.auto));
assert(auto && auto.name === 'AlpsMan Half' && auto.time === '5:55:00' && auto.sport === 'tri', 'AlpsMan passée → dans Mes courses, temps 5:55:00 ' + JSON.stringify(auto));
await pg.screenshot({ path: out + '/library-profile.png', fullPage: true });

// --- photos d'une course ---
await pg.tap('#racesCard [data-rc="open"]'); await pg.waitForSelector('#rcName');
await pg.fill('#rcTime', '6:02:41'); await pg.fill('#rcRank', '152e / 900');
const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.tap('#rcAdd')]);
await fc.setFiles([photo, photo]);
await pg.waitForFunction(() => document.querySelectorAll('#rcPh img[src]').length === 2, null, { timeout: 8000 });
await pg.selectOption('#rcPh select[data-phk] >> nth=1', 'bib');
const ph = await pg.evaluate(() => FTPB.S.races.find(r => r.auto).photos.map(p => p.kind));
assert(JSON.stringify(ph) === '["medal","bib"]', 'deux photos, la 1re = médaille, la 2e passée en dossard ' + JSON.stringify(ph));
await pg.screenshot({ path: out + '/library-race.png', fullPage: true });
await pg.tap('#rcPh img >> nth=0'); await pg.waitForFunction(() => document.querySelector('.rc-big')?.getAttribute('src'), null, { timeout: 5000 });
await pg.screenshot({ path: out + '/library-photo.png' });
await pg.tap('#dlg [data-rc="open"]'); await pg.waitForSelector('#rcSave'); await pg.tap('#rcSave'); await pg.waitForTimeout(300);
const saved = await pg.evaluate(() => { const r = FTPB.S.races.find(r => r.auto); return { time: r.time, rank: r.rank, thumbs: document.querySelectorAll('#racesCard .race-th img').length }; });
assert(saved.time === '6:02:41' && saved.rank === '152e / 900' && saved.thumbs === 2, 'temps officiel + classement enregistrés, vignettes dans la liste ' + JSON.stringify(saved));
// course ajoutée à la main
await pg.tap('[data-rc="new"]'); await pg.waitForSelector('#rcName'); await pg.fill('#rcName', 'Marmotte'); await pg.fill('#rcDate', '2025-07-06'); await pg.selectOption('#rcSport', 'bike'); await pg.tap('#rcSave'); await pg.waitForTimeout(200);
const names = await pg.$$eval('#racesCard .race b', x => x.map(e => e.textContent));
assert(JSON.stringify(names) === '["AlpsMan Half","Marmotte"]', 'courses triées de la plus récente à la plus ancienne ' + JSON.stringify(names));
// suppression de la course auto : elle ne revient pas
await pg.tap('#racesCard [data-rc="open"] >> nth=0'); await pg.waitForSelector('#rcDel'); await pg.tap('#rcDel'); await pg.tap('#rcDel'); await pg.waitForTimeout(200);
await pg.tap('button[data-tab="today"]'); await pg.tap('button[data-tab="profile"]'); await pg.waitForTimeout(200);
assert(await pg.evaluate(() => FTPB.S.races.length === 1 && FTPB.S.racesSkip?.includes('tri-2026-06-07')), 'course auto supprimée : pas recréée');

// --- Mes GPX ---
await pg.tap('[data-pp="gpx"]'); await pg.waitForTimeout(200);
assert(await pg.locator('.pane-head h2', { hasText: 'Mes GPX' }).count() === 1, 'volet Mes GPX');
let [ch] = await Promise.all([pg.waitForEvent('filechooser'), pg.tap('[data-gx="import"]')]);
await ch.setFiles(f1); await pg.waitForSelector('#gxName');
const t1 = await pg.evaluate(() => FTPB.S.gpxBook[0]);
console.log('TRACE', t1.name, t1.km, 'km', t1.dp, 'm', t1.pts.length, 'points');
assert(t1.name === 'Boucle Chevreuse' && t1.km > 18 && t1.km < 25 && t1.dp > 120 && t1.dp < 180 && t1.pts.length <= 601, 'GPX lu : nom, distance, D+, ≤ 600 points');
// notes : 4 critères
for (const [k, v] of [['fun', 5], ['diff', 3], ['asph', 4], ['boul', 2]]) await pg.tap(`[data-gstar="${k}"] button[data-v="${v}"]`);
await pg.tap('[data-gstar="boul"] button[data-v="2"]'); // retoucher la même étoile en retire une
await pg.fill('#gxCom', 'Pause à Dampierre'); await pg.locator('#gxCom').dispatchEvent('change');
await pg.screenshot({ path: out + '/library-gpx-dlg.png', fullPage: true });
const n1 = await pg.evaluate(() => FTPB.S.gpxBook[0]);
assert(JSON.stringify(n1.notes) === '{"fun":5,"diff":3,"asph":4,"boul":1}' && n1.comment === 'Pause à Dampierre', 'étoiles fun / difficulté / asphalte / boulangerie + commentaire ' + JSON.stringify(n1.notes));
// export GPX relu
const [dl] = await Promise.all([pg.waitForEvent('download'), pg.tap('#gxDl')]);
const back = fs.readFileSync(await dl.path(), 'utf8'), re = await pg.evaluate(t => Library.parseGPX(t), back);
assert(dl.suggestedFilename() === 'Boucle_Chevreuse.gpx' && re && Math.abs(re.km - t1.km) < 0.3 && re.pts.length === t1.pts.length, 'GPX téléchargé, relisible ' + dl.suggestedFilename());
await pg.tap('#dlg [data-close]');
[ch] = await Promise.all([pg.waitForEvent('filechooser'), pg.tap('[data-gx="import"]')]);
await ch.setFiles(f2); await pg.waitForSelector('#gxName');
await pg.tap('[data-gstar="boul"] button[data-v="5"]'); await pg.tap('[data-gstar="fun"] button[data-v="3"]'); await pg.tap('#dlg [data-close]'); await pg.waitForTimeout(150);
const byName = async k => { await pg.tap(`[data-gxsort="${k}"]`); await pg.waitForTimeout(100); return pg.$$eval('.gxc b', x => x.map(e => e.textContent)); };
assert((await byName('boul'))[0] === 'Vexin & boulangeries' && (await byName('fun'))[0] === 'Boucle Chevreuse', 'tri par boulangerie / par fun');
assert(await pg.locator('.gxc').first().locator('.gnotes .gn').count() === 4, 'chaque trace affiche ses 4 notes');
assert(await pg.locator('[data-auth="open"]').count() >= 1, 'hors connexion : invitation à se connecter pour partager');
await pg.screenshot({ path: out + '/library-gpx.png', fullPage: true });
// carré mis à jour, retour
await pg.tap('[data-pp="back"]'); await pg.waitForTimeout(150);
assert((await pg.locator('[data-pp="gpx"] .big').innerText()).trim() === '2', 'carré GPX : 2 traces');
await pg.tap('[data-pp="climbs"]'); await pg.waitForTimeout(200);
assert(await pg.locator('#climbsCard').count() === 1 && await pg.locator('.pane-head h2', { hasText: 'Ascensions' }).count() === 1, 'carré Ascensions → bibliothèque des ascensions');
await pg.tap('button[data-tab="prog"]'); await pg.waitForTimeout(200);
assert(await pg.locator('#climbsCard').count() === 0, 'ascensions sorties de Progression');
// sauvegarde JSON → réimport : traces et courses conservées
const st = await pg.evaluate(() => ({ g: FTPB.S.gpxBook.length, r: FTPB.S.races.length }));
assert(st.g === 2 && st.r === 1, 'état : 2 traces, 1 course');
assert(!errs.length, 'pas d’erreur JS ' + errs.join(' | '));
await b.close();
