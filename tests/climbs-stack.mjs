// Ascensions en pile façon dossiers (4 montées), « + Découvrir » pour tout déplier, autres sports repliés en bas de Progression
// + nommage par la fonction serveur climb-names une fois la session prête
const pw = (await import('module')).createRequire('/opt/npm-tools/node_modules/x.js')('playwright');
const out = process.env.SCRATCH || '.';
const b = await pw.chromium.launch(); const ctx = await b.newContext({ ...pw.devices['iPhone 13'], colorScheme: process.env.DARK ? 'dark' : 'light' });
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
const calls = { fn: 0 }; const TABLE = {};
// noms renvoyés par le serveur selon la latitude du départ (la logique Photon est testée côté fonction)
const NAMEFN = c => c.s[0] > 46 ? 'Col de Joux Plane depuis Samoëns' : c.s[0] > 43.5 ? 'Col de Vence depuis Vence' : c.s[0] > 42.99 ? 'Hautacam depuis Argelès-Gazost' : 'Col du Soulor depuis Arrens-Marsous';
// session Supabase simulée + fonction climb-names (le nommage passe par le serveur)
const SC0 = process.env.SCRATCH || '.';
await pg.route('**/supabase.js', r => r.fulfill({ path: SC0 + '/node_modules/@supabase/supabase-js/dist/umd/supabase.js', contentType:'application/javascript' }));
await pg.route('**/*.supabase.co/**', async r => {
  const u = new URL(r.request().url()); const j = (body, s=200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(body) });
  if (u.pathname.includes('/auth/v1/user')) return j({ id:'u1', email:'a@b.c', aud:'authenticated', role:'authenticated' });
  if (u.pathname.endsWith('/functions/v1/climb-names')) { calls.fn++; const body = JSON.parse(r.request().postData()); for (const c of body.climbs) TABLE[c.key] = NAMEFN(c); return j({ queued: body.climbs.length }); }
  if (u.pathname.endsWith('/rest/v1/climb_names')) return j(Object.entries(TABLE).map(([key, name]) => ({ key, name, error: null })));
  if (u.pathname.endsWith('/user_state')) return r.fulfill({ status:200, contentType:'application/json', body:'null' });
  return j([]);
});
await pg.addInitScript(() => localStorage.setItem('sb-jhemwfhmohqncywjixgh-auth-token', JSON.stringify({ access_token:'x.y.z', refresh_token:'r', token_type:'bearer', expires_in:3600, expires_at:Math.floor(Date.now()/1000)+3600, user:{ id:'u1', email:'a@b.c', aud:'authenticated', role:'authenticated' } })));
await pg.clock.setFixedTime(new Date('2026-10-28T00:10:00+01:00'));
await pg.goto('file://' + new URL('../index.html', import.meta.url).pathname);
await pg.fill('[name=age]', '28'); await pg.fill('[name=weightKg]', '83'); await pg.fill('[name=ftp]', '255'); await pg.fill('[name=startDate]', '2026-10-21');
await pg.evaluate(() => document.querySelector('button[type=submit]').click()); await pg.waitForSelector('#tabs:not(.hidden)').catch(async e => { console.log('ERRS', errs, await pg.evaluate(() => document.body.innerText.slice(0, 300))); throw e; });
await pg.evaluate(() => {
  const mk = (lat0, lon0, km, H, T, prof) => { const lat = [], lon = [], alt = [], t = [], d = []; let x = 0, tt = 0, h = 500;
    const seg = (k, dh, dur) => { const n = Math.round(k*30); for (let i = 0; i < n; i++) { x += k/n; tt += dur/n; h += dh/n; d.push(+x.toFixed(4)); t.push(Math.round(tt)); alt.push(+h.toFixed(1)); lat.push(lat0 + x*0.004); lon.push(lon0); } };
    seg(3, 0, 400); prof.forEach(g => seg(km/prof.length, km/prof.length*g*10, T/prof.length)); seg(km, -H, 900);
    return Tracks.build({ lat, lon, alt, d, t }); };
  const rides = [['Hautacam', 43.0, -0.1, 13.5, 1050, 4800, [6,7,9,10,8,9,7]], ['Col de Vence', 43.7, 7.1, 9.6, 640, 2900, [5,6,7,7,6]], ['Joux Plane', 46.15, 6.72, 11.6, 989, 3811, [6,8,9,10,9,9]], ['Col du Soulor', 42.95, -0.25, 12, 830, 3700, [4,5,7,8,6]]];
  rides.forEach(([name, la, lo, L, H, T, prof], i) => { const a = { id:'r'+i, source:'intervals', date:`2026-0${7+Math.floor(i/2)}-1${i}`, startTs: 1785000000 + i*90000, name, durationS: T+2000, hasPower:false, indoor:false };
    FTPB.S.activities.push(a); Tracks.put(a.startTs, mk(la, lo, L, H, T, prof), 'intervals'); });
  FTPB.save(); });
await pg.evaluate(() => document.querySelector('button[data-tab=prog]').click());
await pg.waitForFunction(() => document.querySelectorAll('.climb').length >= 4, null, { timeout: 8000 }); await pg.waitForTimeout(300);
await pg.locator('#climbsCard').screenshot({ path: out + '/stack-1.png' });
const stacked = await pg.evaluate(() => ({ stack: !!document.querySelector('.climbs.stack'), cards: document.querySelectorAll('.climb').length, h: [...document.querySelectorAll('.climb')].map(c => Math.round(c.getBoundingClientRect().height)) }));
await pg.click('[data-climbmore]'); await pg.waitForTimeout(200);
const open = await pg.evaluate(() => !document.querySelector('.climbs.stack'));
await pg.locator('#climbsCard').screenshot({ path: out + '/stack-2.png' });
console.log('PILE', JSON.stringify(stacked), '| dépliée', open);
const lastCard = await pg.evaluate(() => [...document.querySelectorAll('#progView .card, .card')].slice(-1)[0]?.querySelector('h2')?.textContent);
console.log('dernière carte', lastCard);
await pg.waitForFunction(() => Climbs.groups().filter(g => FTPB.S.climbAuto?.[g.key] != null).length === 4, null, { timeout: 30000 }).catch(() => {});
const names = await pg.evaluate(() => Climbs.groups().map(g => g.name).sort());
console.log('NOMS', JSON.stringify(names), JSON.stringify(calls));
const ok = JSON.stringify(names) === JSON.stringify(['Col de Joux Plane depuis Samoëns', 'Col de Vence depuis Vence', 'Col du Soulor depuis Arrens-Marsous', 'Hautacam depuis Argelès-Gazost']) && calls.fn >= 1 && stacked.stack && stacked.cards === 4 && stacked.h.slice(0, 3).every(h => h <= 92) && open;
console.log(ok ? 'OK' : 'ÉCHEC', 'erreurs', errs); await b.close(); process.exit(ok && !errs.length ? 0 : 1);
