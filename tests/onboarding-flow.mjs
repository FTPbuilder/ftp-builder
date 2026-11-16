// Parcours de départ : page d'accueil (compte obligatoire) → questionnaire en étapes → branchements → visite guidée ;
// un téléphone qui a déjà un plan sans compte passe aussi par la page d'accueil, et son plan part dans le compte.
const pw = (await import('module')).createRequire(process.env.PW_REQUIRE || '/opt/npm-tools/node_modules/x.js')('playwright');
const SC = process.env.SCRATCH || '.'; let ok = true; const assert = (c, m) => { if (!c) { ok = false; console.error('ÉCHEC', m); } else console.log('ok', m); };
const b = await pw.chromium.launch();
const U = { id:'u1', email:'a@b.c', aud:'authenticated', role:'authenticated' }, TOK = { access_token:'x.y.z', refresh_token:'r', token_type:'bearer', expires_in:3600, expires_at: Math.floor(Date.parse('2026-11-16T08:30:00+01:00')/1000) + 86400, user: U }; // horloge de la page figée
async function page(init){
  const ctx = await b.newContext({ ...pw.devices['iPhone 13'] }); const pg = await ctx.newPage(); const errs = [], pushes = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.clock.setFixedTime(new Date('2026-11-16T08:30:00+01:00'));
  await pg.route('**/supabase.js', r => r.fulfill({ path: SC + '/node_modules/@supabase/supabase-js/dist/umd/supabase.js', contentType:'application/javascript' }));
  await pg.route('**/*.supabase.co/**', async r => { const u = new URL(r.request().url()), m = r.request().method(); const j = (body, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(body) });
    if (u.pathname.endsWith('/auth/v1/signup')) return j(TOK);
    if (u.pathname.endsWith('/auth/v1/token')) { const p = JSON.parse(r.request().postData() || '{}'); return p.password === 'bonmotdepasse' || p.refresh_token ? j(TOK) : j({ error:'invalid_grant', error_description:'Invalid login credentials', msg:'Invalid login credentials' }, 400); }
    if (u.pathname.endsWith('/auth/v1/user')) return j(U);
    if (u.pathname.endsWith('/user_state')) { if (m !== 'GET') pushes.push(m); return r.fulfill({ status:200, contentType:'application/json', body: m === 'GET' ? 'null' : '[]' }); }
    return j([]); });
  await pg.addInitScript(init);
  await pg.goto(new URL('../index.html', import.meta.url).href); await pg.waitForTimeout(800);
  return { pg, errs, pushes, ctx };
}
// 1 · nouvel utilisateur : accueil → compte par email → questionnaire → tri → branchements → visite
{ const { pg, errs, ctx } = await page(() => localStorage.setItem('ftpb_gate', '1'));
  assert(await pg.locator('.land').count() === 1 && await pg.evaluate(() => document.querySelector('#tabs').classList.contains('hidden')), 'accueil : compte obligatoire, pas d\'onglets');
  await pg.fill('#lEmail', 'a@b.c'); await pg.fill('#lPass', 'court'); await pg.click('#lGo'); await pg.waitForTimeout(200);
  assert(/8 caractères/.test(await pg.textContent('#lMsg')), 'mot de passe trop court refusé');
  await pg.fill('#lPass', 'bonmotdepasse'); await pg.click('#lGo');
  await pg.waitForSelector('.wiz #wzNext', { timeout: 10000 });
  assert(/2 minutes/.test(await pg.locator('.wiz').innerText()), 'questionnaire : phrase d\'intro « 2 minutes »');
  await pg.click('#wzNext');
  await pg.click('#wzNext'); assert(/date de naissance/.test(await pg.textContent('#wzMsg')), 'étape Toi : date de naissance obligatoire');
  await pg.click('[data-k=sex] [data-v=F]'); await pg.fill('[name=name]', 'Léa'); await pg.fill('[name=birthDate]', '1992-05-14'); await pg.fill('[name=weightKg]', '62'); await pg.fill('[name=heightCm]', '168');
  await pg.click('[data-k=sport] [data-v=tri]'); await pg.click('#wzNext');
  await pg.click('[data-k=ftpKnown] [data-v="0"]'); await pg.click('[data-k=ctl0] [data-v="40"]'); await pg.click('[data-k=testProtocol] [data-v=ramp]');
  await pg.click('[data-k=trainer] [data-v=classic]'); await pg.click('[data-k=pm] [data-v="1"]'); await pg.selectOption('[name=device]', 'edge');
  const est = await pg.locator('.wiz').innerText(); assert(/Estimation : 140 W/.test(est), 'FTP inconnue : estimation 2,6 W/kg × 0,88 (femme), test au début du plan');
  await pg.click('#wzNext');
  for (const d of [0, 2]) await pg.click(`.day[data-day="${d}"] button`); // + lundi et mercredi
  await pg.click('#wzNext');
  assert(await pg.inputValue('[name=goalFtp]') === '155', 'objectif proposé : +10 %');
  await pg.fill('[name=goalDate]', '2027-03-07'); await pg.waitForTimeout(100);
  assert((await pg.textContent('#goalCheck')).length > 10, 'objectif : réalisme affiché');
  await pg.click('#wzNext');
  assert(await pg.locator('[data-k=kind] [data-v=tri].on').count() === 1, 'courses : triathlon pré-sélectionné (sport de prédilection)');
  await pg.click('[data-k=fmt] [data-v=m]'); await pg.fill('[name=rname]', 'Triathlon de Paris'); await pg.fill('[name=rdate]', '2027-06-27'); await pg.fill('[name=css_min]', '1'); await pg.fill('[name=css_s]', '55');
  await pg.screenshot({ path: SC + '/onb-courses.png' });
  await pg.click('#wzNext');
  await pg.waitForSelector('[data-wz=connected]');
  const c = await pg.locator('.wiz').innerText();
  assert(/Intervals\.icu/.test(c) && /Strava/.test(c) && !/Apple Santé|Raccourci/.test(c) && /Edge/.test(c), 'branchements : Intervals.icu et Strava, conseil selon le compteur, pas d\'Apple Santé');
  const r = await pg.evaluate(() => ({ p: S.profile, tri: S.tri, first: S.plan[0], onb: S.settings.onbStep, nTri: S.triPlan.length }));
  assert(r.p.age === 34 && r.p.sex === 'F' && r.p.sport === 'tri' && r.p.equip.trainer === 'classic' && r.p.equip.pm && r.p.equip.device === 'edge', 'profil : âge depuis la naissance, sport, équipement');
  assert(r.p.ftp === 140 && r.p.testProtocol === 'ramp' && r.first.kind === 'test', 'FTP estimée, plan qui commence par un test rampe');
  assert(r.tri.enabled && r.tri.mode === 'tri' && r.tri.race.swim === 1500 && r.tri.race.run === 10 && r.tri.css === 115 && r.nTri > 20, 'plan triathlon M créé (CSS saisie)');
  await pg.click('[data-wz=connected]'); await pg.waitForSelector('.tour:not(.wiz)');
  let slides = []; for (let k = 0; k < 13; k++) { slides.push(await pg.locator('.tour .tr-body').innerText()); if (k < 12) await pg.click('[data-tour=next]'); }
  assert(slides.some(x => /garage/i.test(x)) && slides.some(x => /amis/i.test(x)) && slides.some(x => /livre de traces/i.test(x)), 'visite : garage, amis et livre de traces GPX');
  assert(!slides.some(x => /Raccourci|Apple Santé/.test(x)), 'visite : plus de raccourci Apple Santé');
  await pg.click('[data-tour=done]'); await pg.waitForSelector('#tabs:not(.hidden)');
  assert(await pg.evaluate(() => !S.settings.onbStep && S.settings.tourSeen), 'fin : app ouverte, visite vue');
  { const t = await pg.locator('#app .guide').innerText().catch(() => ''); assert(!/raccourci/i.test(t), "Aujourd'hui : guide sans étape Raccourci Apple Santé (mode d'emploi dans Profil)"); }
  assert(!errs.length, 'aucune erreur JS ' + errs.join(' | ')); await ctx.close(); }
// 2 · plan déjà sur le téléphone sans compte : accueil avec message, connexion, le plan part dans le compte
{ const { pg, errs, pushes, ctx } = await page(() => { localStorage.setItem('ftpb_gate', '1'); if (localStorage.getItem('ftpb_state_v1')) return;
    const days = {}; for (let d = 0; d < 7; d++) days[d] = { avail: [1, 3, 5].includes(d), max: 90 };
    localStorage.setItem('ftpb_state_v1', JSON.stringify({ version:1, updatedAt: Date.now(), profile:{ name:'A', sex:'M', age:30, weightKg:80, heightCm:180, ftp:250, hrMax:190, goalFtp:280, goalDate:'2027-03-05', endDate:'2027-03-15', minSessions:30, startDate:'2026-11-10', days, keyPerWeek:2, optionalPerWeek:1, holidays:true, testProtocol:'20min', intensityAdj:1, ctl0:40 }, plan:[], activities:[], ftpHistory:[], settings:{ theme:'auto', tourSeen:true } })); });
  assert(/Ton plan est sur ce téléphone/.test(await pg.locator('.land').innerText()), 'plan sans compte : accueil qui demande de créer son compte');
  await pg.click('[data-amode] [data-v=in]'); await pg.fill('#lEmail', 'a@b.c'); await pg.fill('#lPass', 'faux-mot-de-passe'); await pg.click('#lGo'); await pg.waitForTimeout(400);
  assert(/incorrect/.test(await pg.textContent('#lMsg')), 'mauvais mot de passe : message en français');
  await pg.fill('#lPass', 'bonmotdepasse'); await pg.click('#lGo');
  await pg.waitForSelector('#tabs:not(.hidden)', { timeout: 10000 }); await pg.waitForTimeout(800);
  assert(await pg.evaluate(() => S.profile.ftp === 250 && !document.querySelector('.wiz')), 'connecté : le plan du téléphone est gardé, pas de questionnaire');
  assert(pushes.length > 0, 'le plan est envoyé dans le compte');
  assert(!errs.length, 'aucune erreur JS ' + errs.join(' | ')); await ctx.close(); }
// 3 · course à pied choisie dans le questionnaire : plan semi créé avec l'objectif
{ const { pg, errs, ctx } = await page(() => {});
  await pg.evaluate(() => { const d = Onboard.draft(); Object.assign(d, { age:30, weightKg:70, ftp:240, sport:'run' }); d.race = { kind:'21', name:'Semi de Paris', date:'2027-03-07', goal: 5400, ref10: 2520 }; Onboard.finish(d); });
  const r = await pg.evaluate(() => ({ mode: S.tri.mode, dist: S.tri.dist, goal: S.tri.goal, ref: S.tri.ref, n: S.triPlan.filter(x => x.sport === 'run').length, onb: S.settings.onbStep }));
  assert(r.mode === 'run' && r.dist === 21 && r.goal === 5400 && r.ref.t === 2520 && r.n > 30 && r.onb === 'connect', 'semi : plan course à pied avec objectif et chrono 10 km, puis branchements');
  assert(!errs.length, 'aucune erreur JS ' + errs.join(' | ')); await ctx.close(); }
// 4 · pas de course prévue : bouton dédié à l'étape courses, plan vélo seul
{ const { pg, errs, ctx } = await page(() => {});
  await pg.click('#wzNext'); await pg.fill('[name=birthDate]', '1990-01-01'); await pg.fill('[name=weightKg]', '75'); await pg.click('#wzNext');
  await pg.fill('[name=ftp]', '230'); await pg.click('#wzNext'); await pg.click('#wzNext'); await pg.click('#wzNext');
  assert(await pg.locator('[data-k=kind] button.on').count() === 0 && await pg.locator('[data-wz=norace]').isVisible(), 'courses : aucun type choisi, bouton « Pas de course prévue pour le moment »');
  await pg.click('[data-k=kind] [data-v="21"]'); await pg.click('[data-wz=norace]');
  await pg.waitForSelector('[data-wz=connected]');
  assert(await pg.evaluate(() => S.profile.ftp === 230 && !S.tri?.enabled && S.plan.length > 20), 'pas de course : plan vélo seul, même après avoir touché « Semi »');
  assert(!errs.length, 'aucune erreur JS ' + errs.join(' | ')); await ctx.close(); }
console.log(ok ? 'OK' : 'ÉCHEC'); await b.close(); process.exit(ok ? 0 : 1);
