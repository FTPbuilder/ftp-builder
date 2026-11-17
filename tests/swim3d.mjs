// Natation · « Comprendre la séance » : bouton réservé à l'admin, séance → blocs (allures sur la CSS, départs), script du coach,
// expérience 3D (chargement du bassin et des nageurs, « Faire la séance », démonstration des éducatifs, séance en accéléré, bilan), fermeture.
const pw = (await import('module')).createRequire(process.env.PW_REQUIRE || '/opt/npm-tools/node_modules/x.js')('playwright');
const out = process.env.SCRATCH || '.';
const assert = (c, m) => { if (!c) { console.error('ÉCHEC', m); process.exitCode = 1; } else console.log('ok', m); };
const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ ...pw.devices['iPhone 13'] });
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
for (const f of ['build/three.min.js', 'examples/js/loaders/GLTFLoader.js', 'examples/js/libs/meshopt_decoder.js'])
  await pg.route('**/three@0.147.0/' + f, r => r.fulfill({ path: out + '/node_modules/three/' + f, contentType: 'application/javascript' }));
await pg.clock.install({ time: new Date('2026-11-16T21:00:00+01:00') }); await pg.clock.resume();
await pg.addInitScript(() => {
  if (localStorage.getItem('ftpb_state_v1')) return;
  const days = { 0:{avail:false,max:75}, 1:{avail:true,max:75}, 2:{avail:false,max:75}, 3:{avail:true,max:75}, 4:{avail:false,max:75}, 5:{avail:true,max:120}, 6:{avail:false,max:120} };
  localStorage.setItem('ftpb_state_v1', JSON.stringify({ version:2, updatedAt:Date.now(), profile:{ name:'Arnaud', sex:'M', age:30, weightKg:84, heightCm:182, ftp:250, hrMax:195, goalFtp:300, goalDate:'2027-03-05', endDate:'2027-03-15', minSessions:35, startDate:'2026-10-21', days, keyPerWeek:2, optionalPerWeek:0, testProtocol:'ramp', intensityAdj:1, ctl0:40 }, plan:[], activities:[], ftpHistory:[], settings:{ theme:'dark' } }));
});
await pg.goto('file://' + new URL('../index.html', import.meta.url).pathname); await pg.waitForTimeout(300);
const ids = await pg.evaluate(() => { S.plan = generatePlan(S.profile); applyTri({ ...TRI_DEF(), mode: 'tri', enabled: true, css: 97 }); save(); render();
  const f = (wid, ph) => S.triPlan.find(x => x.sport === 'swim' && x.wid === wid && (!ph || x.ph === ph) && x.date >= '2026-11-17')?.id;
  return { tech: f('tech', 'base') || f('tech'), qual: f('qual', 'base'), run: S.triPlan.find(x => x.sport === 'run')?.id }; });
// réservé à l'admin tant que le module n'est pas ouvert à tous
await pg.evaluate(id => triDlg(id), ids.tech); await pg.waitForTimeout(150);
assert(await pg.locator('#dlg [data-swim3d]').count() === 0, 'compte non admin : pas de bouton « Comprendre la séance »');
await pg.evaluate(id => { Garage.Adm.is = true; triDlg(id); }, ids.tech); await pg.waitForTimeout(150);
assert(/Comprendre la séance/.test(await pg.locator('#dlg [data-swim3d]').innerText()), 'admin : bouton « Comprendre la séance » sur une séance de nat');
await pg.evaluate(id => triDlg(id), ids.run); await pg.waitForTimeout(100);
assert(await pg.locator('#dlg [data-swim3d]').count() === 0, 'pas de bouton sur une séance de course');
// séance → blocs et script du coach
const p = await pg.evaluate(({ tech, qual }) => {
  const r = {}; for (const [k, id] of Object.entries({ tech, qual })) { const x = S.triPlan.find(y => y.id === id), P = Swim3D.plan(x), E = triEst(x);
    r[k] = { total: P.total, estM: E.m, sec: Math.round(P.sec), estS: E.sec, css: P.css, blocks: P.blocks.map(b => ({ n: b.n, d: b.d, z: b.z, pace: b.pace, dep: b.dep, kind: b.kind, drill: b.drill, gear: b.gear })),
      lines: P.lines.map(l => l.act + ':' + l.t), beats: Swim3D.debug.beatsOf(P).map(b => b.sim ? 'SIM' : b.dive ? 'DIVE' : b.end ? 'END' : b.demo ? 'CUE' : b.coach), sim: Swim3D.debug.buildSim(P).total }; }
  r.spoken = Swim3D.spoken("8 × 50 m à 1'37/100 m, 15 s de récup · CSS"); return r; }, ids);
console.log(JSON.stringify(p.tech.blocks), '\n', p.tech.lines.slice(0, 6).join(' | '));
assert(p.tech.total === p.tech.estM && p.qual.total === p.qual.estM, `distance des blocs = distance de la séance (${p.tech.total} m, ${p.qual.total} m)`);
assert(Math.abs(p.tech.sec - p.tech.estS) <= 2 && Math.abs(p.qual.sec - p.qual.estS) <= 2, 'durée des blocs = durée estimée de la séance');
const css = p.qual.blocks.find(b => b.z === 'css');
assert(css && css.pace === 97 && css.dep % 5 === 0 && css.dep >= 97 + 15, `bloc CSS : 1'37/100, départ à la pendule arrondi à 5 s (${css && css.dep} s)`);
assert(p.tech.blocks[0].kind === 'warmup' && p.tech.blocks[0].pace === 112 && p.tech.blocks.at(-1).kind === 'cooldown', "échauffement souple (CSS + 15 s) et retour au calme");
const dr = p.tech.blocks.find(b => b.kind === 'drill');
assert(dr && ['catchup', 'dog', 'fist', 'buoy'].includes(dr.drill), `éducatif reconnu : ${dr && dr.drill}`);
assert(p.tech.blocks.some(b => b.gear.buoy && b.gear.paddles), 'pull plaquettes : pull-buoy et plaquettes');
assert(/^intro:Salut Arnaud/.test(p.tech.lines[0]) && p.tech.lines.some(l => /^cue:/.test(l)) && p.tech.lines.some(l => /à l'eau/.test(l)), 'script : accueil par le prénom, points clés des éducatifs, « à l\'eau »');
assert(p.qual.lines.some(l => /^clock:Départ toutes les/.test(l)), 'script : le coach explique la pendule des départs');
assert(p.tech.beats.includes('mime') && p.tech.beats.includes('CUE') && p.tech.beats.slice(-3).join() === 'DIVE,SIM,END', 'déroulé : mime, démonstration dans l\'eau, plongeon, séance en accéléré, bilan');
assert(p.tech.sim >= p.tech.sec, 'séance simulée : toutes les longueurs et récups');
assert(p.spoken === '8 fois 50 mètres à 1 minute 37 aux 100, 15 secondes de récup · C.S.S.', `voix : « ${p.spoken} »`);
// l'expérience 3D
await pg.evaluate(id => triDlg(id), ids.tech); await pg.waitForTimeout(100);
await pg.tap('#dlg [data-swim3d]');
await pg.waitForSelector('.s3d .s3d-card:not([hidden]) [data-a="go"]', { timeout: 150000 });
assert(await pg.evaluate(() => !dlg.open && !!document.querySelector('.s3d canvas')), 'plein écran : la fiche se ferme, le bassin 3D se charge');
assert(await pg.evaluate(() => { const R = Swim3D.debug.R; return !!(R && R.swimmer && R.coach && R.swimmer.names.length === 29 && R.coach.names.length === 29); }), 'nageur et coach chargés avec leur squelette (29 os)');
await pg.tap('[data-a="go"]'); await pg.waitForTimeout(1200);
assert(/Salut Arnaud/.test(await pg.locator('.s3d-sub span').innerText()), 'Faire la séance : le coach commence (sous-titres)');
const demo = await pg.evaluate(() => { const D = Swim3D.debug.D; Swim3D.debug.goto(D.beats.findIndex(b => b.demo)); return D.i; }); await pg.waitForTimeout(1500);
assert(await pg.locator('.s3d-cues:not([hidden]) div.on').count() === 1 && await pg.evaluate(() => Swim3D.debug.R.cam.position.y < 0), 'démonstration : points clés affichés, caméra sous l\'eau');
await pg.evaluate(() => { const D = Swim3D.debug.D; Swim3D.debug.goto(D.beats.findIndex(b => b.dive)); }); await pg.waitForTimeout(1000);
await pg.evaluate(() => { const D = Swim3D.debug.D; Swim3D.debug.goto(D.beats.findIndex(b => b.sim)); }); await pg.waitForTimeout(1500);
const hud = await pg.locator('.s3d-hud').innerText(); console.log('HUD', hud.replace(/\s+/g, ' '));
assert(/Bloc 1\/\d/i.test(hud) && /1'52\/100/.test(hud), 'séance en accéléré : bloc en cours, allure cible');
await pg.tap('[data-a="speed"]'); await pg.waitForTimeout(800); assert(/×6/.test(await pg.locator('[data-a="speed"]').innerText()), 'vitesse réglable (Auto → ×6)');
await pg.evaluate(() => { const D = Swim3D.debug.D; D.simT = D.sim.total - .01; }); await pg.waitForTimeout(1500);
assert(/Séance comprise/i.test(await pg.locator('.s3d-card').innerText()), 'fin : bilan de la séance');
const fr = await pg.evaluate(() => Swim3D.debug.D.frames); assert(fr > 10, `rendu continu (${fr} images)`);
await pg.tap('.s3d-card [data-a="close"]'); await pg.waitForTimeout(400);
assert(await pg.evaluate(() => !document.querySelector('.s3d') && dlg.open && !!document.querySelector('#dlg [data-swim3d]')), 'fermer : retour à la fiche de la séance');
console.log('errs', errs); assert(!errs.length, 'aucune erreur JS');
await b.close();
