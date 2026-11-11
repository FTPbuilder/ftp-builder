// Réglages › Compte › Supprimer mon compte : confirmation SUPPRIMER, appel de la fonction delete-account, effacement local (Supabase simulé ; supabase-js local dans /tmp/sbjs)
// teste l'UI de suppression avec Supabase simulé
const pw = (await import('module')).createRequire(process.env.PW_REQUIRE || '/opt/npm-tools/node_modules/x.js')('playwright');
const b = await pw.chromium.launch(); const ctx = await b.newContext({ ...pw.devices['iPhone 13'] }); const pg = await ctx.newPage();
const errs=[]; pg.on('pageerror', e=>errs.push(e.message));
let called = null;
const fs = await import('fs');
await pg.route('**/cdn.jsdelivr.net/npm/@supabase/**', r => r.fulfill({ status:200, contentType:'application/javascript', body: fs.readFileSync((process.env.SCRATCH || '/tmp/sbjs') + '/node_modules/@supabase/supabase-js/dist/umd/supabase.js','utf8') }));
await pg.route('**/jhemwfhmohqncywjixgh.supabase.co/**', async r => { const u = new URL(r.request().url());
  if (u.pathname.endsWith('/delete-account')) { called = r.request().postData(); return r.fulfill({ status:200, contentType:'application/json', headers:{'access-control-allow-origin':'*'}, body:'{"deleted":true}' }); }
  if (r.request().method()==='OPTIONS') return r.fulfill({ status:200, headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'} });
  if (u.pathname.includes('/auth/v1/user')) return r.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ id:'u1', email:'a@b.c', aud:'authenticated' }) });
  return r.fulfill({ status:200, contentType:'application/json', body: u.pathname.includes('/rpc/') ? 'null' : '[]' }); });
await pg.addInitScript(() => {
  if (sessionStorage.getItem('done')) return; sessionStorage.setItem('done','1');
  localStorage.setItem('sb-jhemwfhmohqncywjixgh-auth-token', JSON.stringify({ access_token:'x.y.z', refresh_token:'r', token_type:'bearer', expires_in:3600, expires_at:Math.floor(Date.now()/1000)+3600, user:{ id:'u1', email:'a@b.c', aud:'authenticated' } }));
  const days = {}; for (let d=0; d<7; d++) days[d] = { avail:[1,3,5].includes(d), max:75 };
  localStorage.setItem('ftpb_state_v1', JSON.stringify({ version:1, updatedAt:Date.now(), profile:{ name:'A', sex:'M', age:28, weightKg:84, heightCm:181, ftp:260, hrMax:193, goalFtp:300, goalDate:'2027-03-05', endDate:'2027-03-15', minSessions:35, startDate:'2026-10-21', days, keyPerWeek:2, optionalPerWeek:0, holidays:true, testProtocol:'ramp', intensityAdj:1, ctl0:40 }, plan:[], activities:[], ftpHistory:[], settings:{ theme:'auto', tourSeen:true } }));
});
await pg.goto(new URL('../index.html', import.meta.url).href); await pg.waitForTimeout(2500);
await pg.evaluate(() => { document.querySelector('#splash')?.remove(); window.SPLASH_ON=false; });
await pg.evaluate(()=>document.querySelector('button[data-tab=profile]').click()); await pg.waitForTimeout(300);
await pg.evaluate(()=>document.querySelector('[data-settings=open]').click()); await pg.waitForTimeout(300);
console.log('bouton', await pg.locator('[data-auth=delete]').count());
await pg.evaluate(()=>document.querySelector('[data-auth=delete]').click()); await pg.waitForTimeout(200);
console.log('désactivé', await pg.locator('#delGo').isDisabled());
await pg.fill('#delConf','supprimer'); console.log('activé', !(await pg.locator('#delGo').isDisabled()));
await pg.screenshot({ path:'/tmp/out/del.png' });
await pg.click('#delGo'); await pg.waitForTimeout(800);
console.log('appel', called, 'local', await pg.evaluate(()=>Object.keys(localStorage).filter(k=>/^(ftpb|sb-)/.test(k))));
console.log('errs', errs); await b.close();
