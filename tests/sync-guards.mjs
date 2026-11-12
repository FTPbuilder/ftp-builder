// Synchro du compte : on n'écrase jamais des données sans le dire.
//  A · questionnaire refait sur un téléphone vierge puis connexion → le compte l'emporte, rien n'est envoyé
//  B · téléphone avec des séances, jamais relié à ce compte → on demande ; aucun envoi avant le choix
//  C · état d'avant la v2 (déjà en service) → ancienne règle : le plus récent l'emporte, puis l'état est relié au compte
//  D · le compte a été écrit par une app plus récente → rien n'est envoyé ni remplacé
//  E · stockage local illisible → copie de secours conservée, pas de plantage
const pw = (await import('module')).createRequire(process.env.PW_REQUIRE || '/opt/npm-tools/node_modules/x.js')('playwright');
const SC = process.env.SCRATCH || '.'; let ok = true; const assert = (c, m) => { if (!c) { ok = false; console.error('ÉCHEC', m); } else console.log('ok', m); };
const b = await pw.chromium.launch();
const days = { 0:{avail:false,max:75}, 1:{avail:true,max:75}, 2:{avail:false,max:75}, 3:{avail:true,max:75}, 4:{avail:false,max:75}, 5:{avail:true,max:120}, 6:{avail:false,max:120} };
const profile = { name:'A', sex:'M', age:28, weightKg:83, heightCm:181, ftp:260, hrMax:201, goalFtp:300, goalDate:'2027-03-05', endDate:'2027-03-15', minSessions:35, startDate:'2026-10-21', days, keyPerWeek:2, optionalPerWeek:0, testProtocol:'ramp', intensityAdj:1, ctl0:40 };
const act = (id, date) => ({ id, date, name:'Sortie ' + id, durationS:3600, indoor:true, hasPower:true, tss:60, source:'fit' });
const T0 = Date.parse('2026-11-01T10:00:00Z');
const REMOTE = v => ({ version:v, updatedAt:T0, profile:{ ...profile, name:'Compte' }, plan:[], activities:[act('r1','2026-10-22'), act('r2','2026-10-24'), act('r3','2026-10-27')], ftpHistory:[], settings:{ theme:'auto', tourSeen:true } });
async function scenario(name, { local, rawLocal, remote }, run){
  const ctx = await b.newContext({ ...pw.devices['iPhone 13'] }); const pg = await ctx.newPage(); const errs = [], posts = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**/supabase.js', r => r.fulfill({ path: SC + '/node_modules/@supabase/supabase-js/dist/umd/supabase.js', contentType:'application/javascript' }));
  await pg.route('**/*.supabase.co/**', async r => { const u = new URL(r.request().url()), m = r.request().method(); const j = (body, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(body) });
    if (u.pathname.includes('/auth/v1/user')) return j({ id:'u1', email:'a@b.c', aud:'authenticated', role:'authenticated' });
    if (u.pathname.endsWith('/user_state')) { if (m === 'GET') return j(remote ? [{ data: remote, updated_at: new Date(T0).toISOString() }] : []); const body = JSON.parse(r.request().postData()); posts.push(Array.isArray(body) ? body[0] : body); return j([], 201); }
    return j([]); });
  await pg.addInitScript(({ local, rawLocal }) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
    localStorage.setItem('sb-jhemwfhmohqncywjixgh-auth-token', JSON.stringify({ access_token:'x.y.z', refresh_token:'r', token_type:'bearer', expires_in:3600, expires_at:Math.floor(Date.now()/1000)+3600, user:{ id:'u1', email:'a@b.c', aud:'authenticated', role:'authenticated' } }));
    if (rawLocal != null) localStorage.setItem('ftpb_state_v1', rawLocal); else if (local) localStorage.setItem('ftpb_state_v1', JSON.stringify(local)); }, { local, rawLocal });
  await pg.goto(new URL('../index.html', import.meta.url).href);
  const state = () => pg.evaluate(() => ({ name: S.profile?.name, n: S.activities.length, v: S.version, synced: S.syncedUser, legacy: !!S.syncLegacy, stale: APP_STALE, backup: backupInfo()?.why || null, dlg: document.querySelector('#dlg').open ? document.querySelector('#dlg h2')?.textContent : null }));
  await run({ pg, posts, state }); assert(!errs.length, `${name} : aucune erreur JS ${errs.join(' | ')}`); await ctx.close();
}
const settled = pg => pg.waitForFunction(() => Cloud.ready, null, { timeout: 20000 }).then(() => pg.waitForTimeout(400));

await scenario('A', { local: { version:2, updatedAt:T0 + 9e6, profile:{ ...profile, name:'Tel' }, plan:[], activities:[], ftpHistory:[], settings:{ theme:'auto', tourSeen:true } }, remote: REMOTE(2) }, async ({ pg, posts, state }) => {
  await settled(pg); const s = await state();
  assert(s.name === 'Compte' && s.n === 3 && s.synced === 'u1', 'A · téléphone vierge plus récent que le compte : le compte est conservé (3 séances)');
  assert(posts.length === 0, 'A · rien envoyé au compte'); assert(/questionnaire local/.test(s.backup || ''), 'A · questionnaire local gardé en copie de secours');
  await pg.evaluate(() => { S.settings.x = 1; save(); }); await pg.waitForTimeout(2200);
  assert(posts.length === 1 && posts[0].data.activities.length === 3 && posts[0].data.syncedUser === 'u1', 'A · ensuite, la synchro normale reprend (envoi après une modification)');
});

const LOCAL_B = { version:2, updatedAt:T0 + 9e6, profile:{ ...profile, name:'Tel' }, plan:[], activities:[act('l1','2026-11-02')], ftpHistory:[], settings:{ theme:'auto', tourSeen:true } };
await scenario('B1', { local: LOCAL_B, remote: REMOTE(2) }, async ({ pg, posts, state }) => {
  await pg.waitForSelector('#syKeepR', { timeout: 20000 }); let s = await state();
  assert(s.dlg === 'Deux jeux de données' && s.name === 'Tel', 'B · deux jeux de données : la question est posée');
  await pg.evaluate(() => { S.settings.x = 1; save(); }); await pg.waitForTimeout(2200);
  assert(posts.length === 0, "B · aucun envoi tant que le choix n'est pas fait");
  await pg.click('#syKeepR'); await settled(pg); s = await state();
  assert(s.name === 'Compte' && s.n === 3 && posts.length === 0 && /téléphone remplacé/.test(s.backup || ''), 'B · « Garder le compte » : compte repris, téléphone en copie de secours, rien envoyé');
});
await scenario('B2', { local: LOCAL_B, remote: REMOTE(2) }, async ({ pg, posts, state }) => {
  await pg.waitForSelector('#syKeepL', { timeout: 20000 }); await pg.click('#syKeepL'); await settled(pg); const s = await state();
  assert(s.name === 'Tel' && s.n === 1 && posts.length === 1 && posts[0].data.profile.name === 'Tel' && posts[0].data.updatedAt > T0 + 9e6 && /compte remplacé/.test(s.backup || ''), 'B · « Garder ce téléphone » : téléphone envoyé, compte en copie de secours');
});
await scenario('B3', { local: LOCAL_B, remote: REMOTE(2) }, async ({ pg, posts, state }) => {
  await pg.waitForSelector('#syKeepL', { timeout: 20000 }); await pg.evaluate(() => closeDlg()); await settled(pg);
  await pg.evaluate(() => { S.settings.x = 2; save(); }); await pg.waitForTimeout(2200); const s = await state();
  assert(s.name === 'Tel' && posts.length === 0 && !s.synced, 'B · fenêtre fermée sans choisir : rien envoyé, rien remplacé');
  await pg.waitForTimeout(600); await pg.reload(); await pg.waitForSelector('#syKeepL', { timeout: 20000 }); assert(true, 'B · la question revient au lancement suivant');
});

await scenario('C', { local: { version:1, updatedAt:T0 + 9e6, profile:{ ...profile, name:'Tel' }, plan:[], activities:[act('l1','2026-11-02'), act('l2','2026-11-03'), act('l3','2026-11-04'), act('l4','2026-11-05')], ftpHistory:[], settings:{ theme:'auto', tourSeen:true } }, remote: REMOTE(1) }, async ({ pg, posts, state }) => {
  await settled(pg); const s = await state();
  assert(s.v === 2 && s.name === 'Tel' && s.n === 4 && s.dlg === null, "C · état d'avant la v2 : migré, pas de question");
  assert(posts.length === 1 && posts[0].data.version === 2 && posts[0].data.activities.length === 4, 'C · plus récent que le compte : envoyé (règle habituelle)');
  assert(s.synced === 'u1' && !s.legacy && /migration v1/.test(s.backup || ''), 'C · relié au compte ; état v1 gardé en copie de secours');
});

await scenario('D', { local: { version:2, updatedAt:T0 + 9e6, syncedUser:'u1', profile:{ ...profile, name:'Tel' }, plan:[], activities:[act('l1','2026-11-02')], ftpHistory:[], settings:{ theme:'auto', tourSeen:true } }, remote: REMOTE(99) }, async ({ pg, posts, state }) => {
  await settled(pg); await pg.evaluate(() => { S.settings.x = 1; save(); }); await pg.waitForTimeout(2200); const s = await state();
  assert(s.stale && s.name === 'Tel' && s.n === 1 && posts.length === 0, 'D · compte écrit par une app plus récente : rien envoyé, rien remplacé');
});

await scenario('E', { rawLocal: '{"version":1,"profile":{"name":"cass', remote: null }, async ({ pg, posts, state }) => {
  await settled(pg); const s = await state();
  assert(s.name == null && s.backup === 'illisible' && await pg.locator('.onb').count() === 1, 'E · stockage illisible : questionnaire affiché, copie de secours conservée');
  assert(await pg.evaluate(() => backupInfo().raw.startsWith('{"version":1,"profile":{"name":"cass') && Errors.list().some(e => /illisible/.test(e.msg))), 'E · contenu brut gardé et erreur signalée');
  assert(posts.length === 0, 'E · rien envoyé');
});
console.log(ok ? 'OK' : 'ÉCHEC'); await b.close(); process.exit(ok ? 0 : 1);
