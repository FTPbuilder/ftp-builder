// Sorties déjà importées sans vitesse/altitude (.fit ancien, import d'avant v0.11) : complétées depuis Intervals ;
// enregistrement parasite de 1 s supprimé ; sortie d'avant le programme qui ne compte plus comme séance.
const pw = (await import('module')).createRequire('/opt/npm-tools/node_modules/x.js')('playwright');
const SC = process.env.SCRATCH || process.cwd();
const t0 = Date.parse('2026-10-26T07:08:35Z')/1000, N = 999;
const streams = { time: [], watts: null, heartrate: [], cadence: [], velocity_smooth: [], altitude: [], distance: [] };
for (let i = 0; i < N; i++) { streams.time.push(i); streams.heartrate.push(95 + Math.round(15*Math.sin(i/90))); streams.cadence.push(80); streams.velocity_smooth.push(5.8 + Math.sin(i/40)); streams.altitude.push(35 + 10*Math.sin(i/200)); streams.distance.push(i*5.8); }
const inbox = [{ source:'intervals', ext_id:'i777', activity:{ id:'i777', name:'Vélotaf matin', type:'Ride', start_date: new Date(t0*1000).toISOString(), moving_time:N, distance:5817, trainer:false, average_watts:null, device_watts:false,
  average_heartrate:103, max_heartrate:121, total_elevation_gain:28, average_speed:5.82, max_speed:9.3 }, streams }];
let imported = 0; const enrichQ = [];
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
  if (u.pathname.endsWith('/ext_inbox')) { if (m === 'PATCH') return j([]); if (u.search.includes('imported=eq.false')) return j([]); enrichQ.push(decodeURIComponent(u.search)); return j(inbox); }
  if (u.pathname.endsWith('/user_state')) return r.fulfill({ status:200, contentType:'application/json', body:'null' });
  return j([]);
});
await pg.addInitScript(() => {
  localStorage.setItem('sb-jhemwfhmohqncywjixgh-auth-token', JSON.stringify({ access_token:'x.y.z', refresh_token:'r', token_type:'bearer', expires_in:3600, expires_at:Math.floor(Date.now()/1000)+3600, user:{ id:'u1', email:'a@b.c', aud:'authenticated', role:'authenticated' } }));
});
await pg.goto('file://' + new URL('../index.html', import.meta.url).pathname);
await pg.fill('[name=age]','28'); await pg.fill('[name=weightKg]','83'); await pg.fill('[name=ftp]','255'); await pg.fill('[name=startDate]','2026-10-21');
await pg.evaluate(() => document.querySelector('button[type=submit]').click()); await pg.waitForSelector('#tabs:not(.hidden)');
// .fit de la même sortie importé avant (sans vitesse), parasite de 1 s, vieille sortie comptée comme séance
await pg.evaluate(t0 => { const S = FTPB.S;
  S.activities.push({ id:'f1', source:'fit', date:'2026-10-26', startTs:t0, name:'Vélotaf (fit)', durationS:999, distanceKm:5.8, avgHr:103, hasPower:false, indoor:false, hrSample:[100,110,105], sampleSecs:999 });
  S.activities.push({ id:'j1', source:'intervals', extId:'i9', date:'2026-10-19', startTs:t0-600000, name:'Vélo', durationS:1, hasPower:false, indoor:true });
  S.activities.push({ id:'o1', source:'fit', date:'2026-10-10', startTs:t0-1400000, name:'Vieille sortie', durationS:5400, hasPower:false, indoor:false, countAsSession:true, enrichTried:true });
  FTPB.save(); }, t0);
await pg.reload(); await pg.waitForSelector('#tabs:not(.hidden)');
await pg.evaluate(() => Cloud.importExt());
const r = await pg.evaluate(() => { const S = FTPB.S, f = S.activities.find(x => x.id === 'f1'); return { spd: !!f.spdSample, alt: !!f.altSample, hr: f.hrSample.length, vmax: f.maxSpeed, elev: f.elevM, junk: !!S.activities.find(x => x.id === 'j1'), oldCount: S.activities.find(x => x.id === 'o1').countAsSession, tried: f.enrichTried }; });
console.log('ENRICHI', JSON.stringify(r), '| requête', enrichQ[0]);
const ok = r.spd && r.alt && r.hr === 3 && r.vmax === 33.5 && r.elev === 28 && !r.junk && r.oldCount === false && /start_date/.test(enrichQ[0] || '');
console.log(ok ? 'OK' : 'ÉCHEC', 'erreurs', errs); await b.close(); process.exit(ok && !errs.length ? 0 : 1);
