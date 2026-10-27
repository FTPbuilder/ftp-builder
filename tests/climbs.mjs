// Ascensions : détection des montées ≥ 400 m (une petite côte de 250 m ignorée), regroupement des passages,
// estimation W/kg par la physique, profil façon ClimbFinder, prédiction (loi de puissance type Riegel)
const pw = (await import('module')).createRequire('/opt/npm-tools/node_modules/x.js')('playwright');
const out = process.env.SCRATCH || '.';
const b = await pw.chromium.launch(); const ctx = await b.newContext({ ...pw.devices['iPhone 13'] });
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.clock.setFixedTime(new Date('2026-10-27T23:30:00+01:00'));
await pg.goto('file://' + new URL('../index.html', import.meta.url).pathname);
await pg.fill('[name=age]', '28'); await pg.fill('[name=weightKg]', '83'); await pg.fill('[name=ftp]', '255'); await pg.fill('[name=startDate]', '2026-10-21');
await pg.evaluate(() => document.querySelector('button[type=submit]').click()); await pg.waitForSelector('#tabs:not(.hidden)');
const res = await pg.evaluate(() => {
  // sortie : 8 km plats, col type Joux Plane (11,6 km, 989 m, 1h03'31), descente, côte de 250 m, retour
  function ride(colTime, seed){ const lat = [], lon = [], alt = [], t = [], d = []; let x = 0, tt = 0, h = 700, r = seed;
    const rnd = () => (r = (r*16807) % 2147483647)/2147483647 - 0.5;
    const seg = (km, dh, dur) => { const n = Math.round(km*40); for (let i = 0; i < n; i++) { x += km/n; tt += dur/n; h += dh/n + rnd()*1.2; d.push(+x.toFixed(4)); t.push(Math.round(tt)); alt.push(+h.toFixed(1)); lat.push(46.15 + x*0.004); lon.push(6.72 + Math.sin(x/3)*0.01); } };
    seg(8, 5, 900); // plat
    for (const [k, g] of [[1,6],[1,7.5],[1,8],[1,9.5],[1,10],[1,9],[1,8.5],[1,8.5],[1,9],[1,10.2],[1,9.5],[0.6,9.7]]) seg(k, k*g*10*(989/1035), colTime*k/11.6);
    seg(11.6, -989, 1100); seg(3, 250, 900); seg(3, -250, 300); seg(5, 0, 600);
    return Tracks.build({ lat, lon, alt, d, t }); }
  const S = FTPB.S, acts = [['c1','2026-08-14','Col de Joux Plane',3811,1],['c2','2026-09-20','Sortie Samoëns',3600,7]];
  for (const [id, date, name, T, seed] of acts) { const a = { id, source:'intervals', date, startTs: Date.parse(date+'T08:00:00Z')/1000, name, durationS: 12000, hasPower:false, indoor:false, feel:null };
    S.activities.push(a); Tracks.put(a.startTs, ride(T, seed), 'intervals'); }
  FTPB.save(); return true; });
await pg.evaluate(() => document.querySelector('button[data-tab=prog]').click());
await pg.waitForFunction(() => document.querySelectorAll('.climb').length > 0, null, { timeout: 8000 });
await pg.waitForTimeout(300);
const info = await pg.evaluate(() => { const G = Climbs.groups(); return { groups: G.length, list: G[0].list.map(c => ({ L:c.L, H:c.H, T:c.T, wkg:c.wkg, vam:c.vam, gmax:c.gmax })), name: G[0].name,
  nClimbsPerRide: FTPB.S.activities.filter(a => a.climbs).map(a => a.climbs.length) }; });
console.log('ASCENSIONS', JSON.stringify(info));
const pred = await pg.locator('#cpOut').innerText(); console.log('PRÉDICTION', pred.replace(/\n+/g, ' | '));
await pg.locator('#climbsCard').screenshot({ path: out + '/climbs-card.png' });
await pg.selectOption('#cpSel', 'p:alpe'); await pg.waitForTimeout(100); console.log('ALPE', (await pg.locator('#cpOut').innerText()).replace(/\n+/g, ' | '));
await pg.locator('.climb').first().click(); await pg.waitForTimeout(200);
await pg.fill('#clName', 'Joux Plane'); await pg.click('#clRename'); await pg.waitForTimeout(200);
const renamed = await pg.evaluate(() => Climbs.groups()[0].name);
await pg.locator('.climb').first().click(); await pg.waitForTimeout(200); await pg.screenshot({ path: out + '/climbs-detail.png' });
const c0 = info.list[0];
const ok = info.groups === 1 && info.nClimbsPerRide.every(n => n === 1) && Math.abs(c0.H - 989) < 40 && Math.abs(c0.L - 11.6) < 0.8 && c0.wkg > 2.8 && c0.wkg < 3.4 && renamed === 'Joux Plane';
console.log(ok ? 'OK' : 'ÉCHEC', 'erreurs', errs); await b.close(); process.exit(ok && !errs.length ? 0 : 1);
