// Intervals.icu prioritaire : une sortie dehors sans capteur arrive avec FC, vitesse, altitude seconde par seconde
// et remplace la version Apple Santé (résumé seul) en gardant les corrections faites à la main.
const pw = (await import('module')).createRequire('/opt/npm-tools/node_modules/x.js')('playwright');
const SC = process.env.SCRATCH || process.cwd();
const t0 = Date.parse('2026-10-26T07:08:35Z')/1000, N = 999;
const streams = { time: [], watts: null, heartrate: [], cadence: [], velocity_smooth: [], altitude: [], distance: [] };
for (let i = 0; i < N; i++) { streams.time.push(i); streams.heartrate.push(95 + Math.round(15*Math.sin(i/90))); streams.cadence.push(80); streams.velocity_smooth.push(5.8 + Math.sin(i/40)); streams.altitude.push(35 + 10*Math.sin(i/200)); streams.distance.push(i*5.8); }
const inbox = [{ source:'intervals', ext_id:'i777', activity:{ id:'i777', name:'Vélotaf matin', type:'Ride', start_date: new Date(t0*1000).toISOString(), moving_time:N, distance:5817, trainer:false, average_watts:null, device_watts:false,
  average_heartrate:103, max_heartrate:121, total_elevation_gain:28, average_speed:5.82, max_speed:9.3 }, streams }];
let imported = 0;
const b = await pw.chromium.launch(); const ctx = await b.newContext({ ...pw.devices['iPhone 13'] });
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.clock.setFixedTime(new Date('2026-10-27T22:40:00+01:00'));
await pg.route('**/supabase.js', r => r.fulfill({ path: SC + '/node_modules/@supabase/supabase-js/dist/umd/supabase.js', contentType:'application/javascript' }));
await pg.route('**/*.supabase.co/**', async r => {
  const u = new URL(r.request().url()), m = r.request().method(); const j = (body, s=200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(body) });
  if (u.pathname.includes('/auth/v1/user')) return j({ id:'u1', email:'a@b.c', aud:'authenticated', role:'authenticated' });
  if (u.pathname.includes('/rpc/intervals_status')) return j([{ connected:true, athlete_id:'i1', athlete_name:'Arnaud', last_sync_at: new Date().toISOString() }]);
  if (u.pathname.includes('/rpc/')) return j([]);
  if (u.pathname.endsWith('/functions/v1/intervals')) return j({ rides:1, others:0, skipped:0, tracks:0, wellness:0, total:1, created:0, removed:0 });
  if (u.pathname.endsWith('/ext_inbox')) { if (m === 'PATCH') { imported++; return j([]); } return j(imported ? [] : inbox); }
  if (u.pathname.endsWith('/user_state')) return r.fulfill({ status:200, contentType:'application/json', body:'null' });
  return j([]);
});
await pg.addInitScript(() => {
  localStorage.setItem('sb-jhemwfhmohqncywjixgh-auth-token', JSON.stringify({ access_token:'x.y.z', refresh_token:'r', token_type:'bearer', expires_in:3600, expires_at:Math.floor(Date.now()/1000)+3600, user:{ id:'u1', email:'a@b.c', aud:'authenticated', role:'authenticated' } }));
});
await pg.goto('file://' + new URL('../index.html', import.meta.url).pathname);
await pg.fill('[name=age]','28'); await pg.fill('[name=weightKg]','83'); await pg.fill('[name=ftp]','255'); await pg.fill('[name=startDate]','2026-10-21');
await pg.evaluate(() => document.querySelector('button[type=submit]').click()); await pg.waitForSelector('#tabs:not(.hidden)');
// version Apple Santé déjà présente, renommée et ressentie à la main
await pg.evaluate(t0 => { FTPB.S.activities.push({ id:'h1', source:'health', healthStart:new Date(t0*1000).toISOString(), date:'2026-10-26', startTs:t0, name:'Vélotaf', durationS:999, distanceKm:5.8, avgHr:103, hasPower:false, indoor:false, linkManual:true, countAsSession:false, feel:{ rpe:3, legs:4 } }); FTPB.save(); }, t0);
const n = await pg.evaluate(() => Cloud.importExt());
const a = await pg.evaluate(() => { const L = FTPB.S.activities.filter(x => x.date === '2026-10-26');
  return L.map(x => ({ src:x.source, name:x.name, rpe:x.feel?.rpe, hr:!!x.hrSample, spd:!!x.spdSample, alt:!!x.altSample, vmax:x.maxSpeed, elev:x.elevM, power:x.hasPower, count:x.countAsSession })); });
console.log('importées', n, JSON.stringify(a));
const id = await pg.evaluate(() => FTPB.S.activities.find(x => x.date === '2026-10-26').id);
await pg.evaluate(id => activityDlg(id), id); await pg.waitForTimeout(200);
const chips = await pg.locator('#dlg .achips').innerText(); console.log('courbes', chips.replace(/\n+/g, ' | '));
await pg.screenshot({ path: SC + '/prio-fiche.png', fullPage: true });
const ok = n === 1 && a.length === 1 && a[0].src === 'intervals' && a[0].name === 'Vélotaf' && a[0].rpe === 3 && a[0].hr && a[0].spd && a[0].alt && a[0].vmax === 33.5 && a[0].elev === 28 && !a[0].power && /Vitesse/.test(chips);
console.log(ok ? 'OK' : 'ÉCHEC', 'erreurs', errs); await b.close(); process.exit(ok && !errs.length ? 0 : 1);
