// Questionnaire d'avis (satisfaction, programme, synchro, facilité, social, suggestions) : proposé après connexion, réponses obligatoires, envoi dans feedback_surveys, « Plus tard » / « Non merci »
const pw = (await import('module')).createRequire(process.env.PW_REQUIRE || '/opt/npm-tools/node_modules/x.js')('playwright');
const out = process.env.SCRATCH || '.';
const b = await pw.chromium.launch(); const ctx = await b.newContext({ ...pw.devices['iPhone 13'], permissions: ['clipboard-read', 'clipboard-write'] });
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.clock.setFixedTime(new Date('2026-11-14T22:00:00+01:00'));
await pg.addInitScript(() => {
  const days = {0:{avail:false,max:75},1:{avail:true,max:75},2:{avail:false,max:75},3:{avail:true,max:75},4:{avail:false,max:75},5:{avail:true,max:120},6:{avail:false,max:120}};
  localStorage.setItem('ftpb_state_v1', JSON.stringify({ version:2, updatedAt:Date.now(), profile:{ name:'A', sex:'M', age:30, weightKg:80, heightCm:180, ftp:250, hrMax:195, goalFtp:300, goalDate:'2027-03-05', endDate:'2027-03-15', minSessions:35, startDate:'2026-10-20', days, keyPerWeek:2, optionalPerWeek:1, testProtocol:'20min', intensityAdj:1 }, plan:[], activities:[], ftpHistory:[{ date:'2026-10-20', ftp:250, source:'initial' }], settings:{ theme:'dark' } }));
});
await pg.goto(new URL('../index.html', import.meta.url).href); await pg.waitForTimeout(300);
let ok = true; const assert = (c, m) => { if (!c) { ok = false; console.error('ÉCHEC', m); } else console.log('ok', m); };
const ev = (f, a) => pg.evaluate(f, a);
// faux Supabase : on garde les lignes insérées
await ev(() => { window._ins = []; const fake = { from: t => ({ insert: async row => { window._ins.push({ t, row }); return { error: null }; } }) };
  Object.defineProperty(Cloud, 'sb', { get: () => fake, configurable: true }); Object.defineProperty(Cloud, 'user', { get: () => ({ id: 'usr' }), configurable: true }); });
assert(await ev(() => Survey.due()), 'à proposer : compte connecté, jamais répondu');
await ev(() => Survey.show()); await pg.waitForTimeout(200);
assert(await pg.locator('#dlg [data-sv]').count() === 32 && await pg.locator('#svTxt').count() === 1 && /7\. Des suggestions/.test(await pg.locator('#dlg').innerText()), '6 questions (notes, choix, synchro sur 2 lignes) + suggestions libres');
await pg.screenshot({ path: out + '/survey.png', fullPage: false });
await pg.tap('[data-svgo="send"]'); await pg.waitForTimeout(200);
assert(!(await ev(() => window._ins.length)) && await ev(() => dlg.open), 'envoi refusé tant que toutes les réponses ne sont pas données');
for (const [k, v] of [['sat', 4], ['follow', 'souvent'], ['fit', 5], ['sync_dev', 'oui'], ['sync_app', 'parfois'], ['ease', 2], ['social', 'inconnu']]) await pg.locator(`#dlg [data-sv="${k}"][data-v="${v}"]`).tap();
assert(await pg.locator('#dlg [data-sv="ease"][aria-checked="true"]').getAttribute('data-v') === '2', 'choix visible (aria-checked)');
await pg.fill('#svTxt', "La vue 3D rame un peu sur mon iPhone");
await pg.tap('[data-svgo="send"]'); await pg.waitForTimeout(300);
const ins = await ev(() => window._ins);
const A = ins[0]?.row.answers || {};
assert(ins.length === 1 && ins[0].t === 'feedback_surveys' && A.sat === 4 && A.follow === 'souvent' && A.fit === 5 && A.sync_dev === 'oui' && A.sync_app === 'parfois' && A.ease === 2 && A.social === 'inconnu' && /rame/.test(ins[0].row.comment) && ins[0].row.survey === 'avis-2026-11' && ins[0].row.who === 'A', 'réponses envoyées dans feedback_surveys');
assert(!(await ev(() => dlg.open)) && await ev(() => S.settings.surveys[Survey.ID]) === 'done' && !(await ev(() => Survey.due())), 'répondu : fenêtre fermée, plus reproposé');
// « Plus tard » : reproposé le lendemain ; « Non merci » : plus jamais
await ev(() => { S.settings.surveys = {}; Survey.show(); }); await pg.waitForTimeout(200); await pg.tap('[data-svgo="later"]'); await pg.waitForTimeout(200);
assert(!(await ev(() => Survey.due())), 'plus tard : pas aujourd\'hui');
await ev(() => { S.settings.surveys[Survey.ID] = '2026-11-13'; }); assert(await ev(() => Survey.due()), 'plus tard : reproposé le lendemain');
await ev(() => Survey.show()); await pg.waitForTimeout(200); await pg.tap('[data-svgo="no"]'); await pg.waitForTimeout(200);
assert(await ev(() => S.settings.surveys[Survey.ID]) === 'no' && !(await ev(() => Survey.due())), 'non merci : plus jamais');
console.log(ok && !errs.length ? 'OK' : 'ÉCHEC', errs); await b.close(); process.exit(ok && !errs.length ? 0 : 1);
