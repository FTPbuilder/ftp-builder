// Questionnaire rempli pendant que le compte se charge (réseau lent) : la saisie ne doit pas être perdue,
// ni avant l'envoi (réaffichage en cours de frappe) ni après (réponse tardive du serveur).
const pw = (await import('module')).createRequire(process.env.PW_REQUIRE || '/opt/npm-tools/node_modules/x.js')('playwright');
const SC = process.env.SCRATCH || '.'; let ok = true; const assert = (c, m) => { if (!c) { ok = false; console.error('ÉCHEC', m); } else console.log('ok', m); };
const b = await pw.chromium.launch();
async function scenario(name, delay, during){
  const ctx = await b.newContext({ ...pw.devices['iPhone 13'] }); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**/supabase.js', r => r.fulfill({ path: SC + '/node_modules/@supabase/supabase-js/dist/umd/supabase.js', contentType:'application/javascript' }));
  await pg.route('**/*.supabase.co/**', async r => { const u = new URL(r.request().url()); const j = (body, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(body) });
    if (u.pathname.includes('/auth/v1/user')) return j({ id:'u1', email:'a@b.c', aud:'authenticated', role:'authenticated' });
    await new Promise(res => setTimeout(res, delay)); // chaque appel de données traîne
    if (u.pathname.endsWith('/user_state')) return r.fulfill({ status:200, contentType:'application/json', body:'null' });
    return j([]); });
  await pg.addInitScript(() => localStorage.setItem('sb-jhemwfhmohqncywjixgh-auth-token', JSON.stringify({ access_token:'x.y.z', refresh_token:'r', token_type:'bearer', expires_in:3600, expires_at:Math.floor(Date.now()/1000)+3600, user:{ id:'u1', email:'a@b.c', aud:'authenticated', role:'authenticated' } })));
  await pg.goto(new URL('../index.html', import.meta.url).href);
  const r = await during(pg);
  assert(!errs.length, `${name} : aucune erreur JS ${errs.join(' | ')}`); await ctx.close(); return r;
}
// 1 · je tape pendant que le compte charge (étape « Toi » du questionnaire) : le champ garde le focus et sa valeur
await scenario('frappe pendant le chargement', 400, async pg => {
  await pg.click('#wzNext'); await pg.fill('[name=birthDate]', '1998-05-14');
  await pg.focus('[name=weightKg]'); await pg.keyboard.type('8');
  await pg.waitForFunction(() => Cloud.ready, null, { timeout: 20000 }); await pg.waitForTimeout(300); // le compte a fini de charger pendant la frappe
  await pg.keyboard.type('3');
  const v = await pg.evaluate(() => ({ w: document.querySelector('[name=weightKg]').value, b: document.querySelector('[name=birthDate]').value, focus: document.activeElement?.name }));
  assert(v.w === '83' && v.b === '1998-05-14', `la saisie survit au chargement du compte (poids ${v.w}, naissance ${v.b})`);
  assert(v.focus === 'weightKg', `le champ en cours garde le focus (${v.focus})`);
  await pg.click('#wzNext'); await pg.fill('[name=ftp]', '255'); await pg.click('#wzNext'); await pg.click('#wzNext'); await pg.click('#wzNext'); await pg.click('#wzNext');
  await pg.waitForSelector('[data-wz=connected]', { timeout: 10000 });
  assert(await pg.evaluate(() => S.profile?.ftp === 255 && S.profile.age >= 27 && S.plan.length >= 30), 'plan généré avec la FTP saisie');
});
// 2 · je valide tout de suite, les réponses du serveur arrivent après : le profil reste, pas de retour au questionnaire
await scenario('envoi avant la réponse du serveur', 1200, async pg => {
  await pg.waitForFunction(() => typeof Onboard !== 'undefined');
  await pg.evaluate(() => Onboard.finish({ ...Onboard.draft(), age:28, weightKg:83, ftp:255, goalFtp:300, startDate:'2026-10-21' }, { quick:true })); await pg.waitForSelector('#tabs:not(.hidden)', { timeout: 10000 });
  await pg.waitForFunction(() => Cloud.ready, null, { timeout: 30000 }); await pg.waitForTimeout(1500);
  const v = await pg.evaluate(() => ({ prof: !!S.profile, tabs: !document.querySelector('#tabs').classList.contains('hidden'), form: !!document.querySelector('.wiz') }));
  assert(v.prof && v.tabs && !v.form, 'le profil reste en place après les réponses tardives');
});
console.log(ok ? 'OK' : 'ÉCHEC'); await b.close(); process.exit(ok ? 0 : 1);
