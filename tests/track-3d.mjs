// Tracé 3D : sortie extérieure avec GPS (col simulé) → vue 3D paysage/portrait, lecture ▶, traceur synchronisé avec la portion parcourue
// Three.js est servi depuis node_modules (SCRATCH/three) à la place du CDN ; les tuiles satellite par SCRATCH/tile.png.
const pw = (await import('module')).createRequire('/opt/npm-tools/node_modules/x.js')('playwright');
const out = process.env.SCRATCH || '.';
const b = await pw.chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => m.type() === 'error' && errs.push(m.text()));
await pg.route('**/three@0.147.0/build/three.min.js', r => r.fulfill({ path: out + '/three/node_modules/three/build/three.min.js', contentType: 'application/javascript' }));
await pg.route('**/three@0.147.0/examples/js/controls/OrbitControls.js', r => r.fulfill({ path: out + '/three/node_modules/three/examples/js/controls/OrbitControls.js', contentType: 'application/javascript' }));
let tiles = 0; await pg.route('**/World_Imagery/MapServer/tile/**', r => { tiles++; return r.fulfill({ path: out + '/tile.png', contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' } }); });
await pg.clock.setFixedTime(new Date('2026-10-27T21:30:00+01:00'));
await pg.goto('file://' + new URL('../index.html', import.meta.url).pathname);
await pg.fill('[name=age]', '28'); await pg.fill('[name=weightKg]', '83'); await pg.fill('[name=ftp]', '255'); await pg.fill('[name=startDate]', '2026-10-21');
await pg.evaluate(() => document.querySelector('button[type=submit]').click()); await pg.waitForSelector('#tabs:not(.hidden)');
await pg.evaluate(() => {
  // aller-retour de 30 km avec une montée de col en lacets (≈ 600 m de D+)
  const lat = [], lon = [], alt = [], t = [], hr = [];
  for (let i = 0; i < 1800; i++) { const u = i/1799, up = u < .5 ? u*2 : (1-u)*2;
    const a = up*6.2, r = 0.004 + up*0.002; lat.push(43.05 + up*0.06 + Math.sin(a*6)*r*(up > .4 ? 1 : .3)); lon.push(0.1 + Math.cos(a)*0.03*up + Math.cos(a*6)*r*(up > .4 ? 1 : .3) + (u < .5 ? 0 : 0.004));
    alt.push(600 + 620*Math.pow(up, 1.3) + Math.sin(i/37)*3); t.push(i*4); hr.push(Math.round(120 + up*45)); }
  const track = Tracks.build({ lat, lon, alt, t, hr });
  const a = { id:'out1', source:'fit', date:'2026-10-24', startTs:1792823739, name:'Col du Soulor', durationS:7200, distanceKm:30.2, avgHr:142, maxHr:171, hasPower:false, indoor:false, elevM:610, maxSpeed:61.3, avgSpeed:15.1, feel:null, tss:120 };
  FTPB.S.activities.push(a); FTPB.save(); Tracks.put(a.startTs, track, 'fit');
});
await pg.evaluate(() => activityDlg('out1')); await pg.waitForTimeout(200);
await pg.screenshot({ path: out + '/t3-0-fiche.png' });
await pg.click('[data-track3d="out1"]');
await pg.waitForFunction(() => !!window._t3, null, { timeout: 15000 }); await pg.waitForTimeout(800);
await pg.screenshot({ path: out + '/t3-1-paysage.png' });
// synchro : à chaque point GPS, le traceur est sur le point et la portion parcourue s'arrête au traceur (écart en unités de scène, tracé ≈ 100)
const sync = await pg.evaluate(() => { const { st, P, place, tracker, pts, done, segs, radial, arcU, curve } = _t3; let maxPt = 0, maxDone = 0;
  for (const i of [5, 60, 150, 300, 450, 600, P.n-2]) { st.u = P.dist[i]/P.total; place();
    maxPt = Math.max(maxPt, tracker.position.distanceTo(pts[i]));
    const end = curve.getPointAt(done.drawRange.count/(radial*6)/segs); maxDone = Math.max(maxDone, end.distanceTo(tracker.position)); }
  st.u = 0; place(); return { maxPt: +maxPt.toFixed(3), maxDone: +maxDone.toFixed(3) }; });
console.log('SYNCHRO', JSON.stringify(sync));
await pg.click('[data-t3="play"]'); await pg.click('[data-t3="speed"]'); await pg.click('[data-t3="speed"]'); // ×4
await pg.waitForTimeout(2500);
const mid = await pg.evaluate(() => ({ u: +_t3.st.u.toFixed(3), play: _t3.st.play }));
await pg.screenshot({ path: out + '/t3-2-lecture.png' });
await pg.click('[data-t3="follow"]'); await pg.waitForTimeout(1500); await pg.screenshot({ path: out + '/t3-3-suivi.png' });
await pg.setViewportSize({ width: 390, height: 844 }); await pg.waitForTimeout(700); await pg.screenshot({ path: out + '/t3-4-portrait.png' });
const hud = await pg.locator('.t3hud').innerText();
await pg.click('[data-t3="close"]'); await pg.waitForTimeout(200);
const closed = await pg.evaluate(() => !document.querySelector('#fsDlg').open);
// tracé absent : message
await pg.evaluate(() => { FTPB.S.activities.push({ id:'out2', source:'health', date:'2026-10-26', startTs:1792998515, name:'Vélotaf', durationS:999, hasPower:false, indoor:false }); activityDlg('out2'); });
await pg.click('[data-track3d="out2"]'); await pg.waitForTimeout(600);
const msg = await pg.locator('.toast, #toast').last().innerText().catch(() => '');
console.log('tuiles', tiles, '| lecture', JSON.stringify(mid), '| HUD', hud.replace(/\n+/g, ' '), '| fermé', closed, '| sans tracé:', msg);
const ok = tiles > 0 && sync.maxPt < 0.05 && sync.maxDone < 0.6 && mid.u > 0.1 && closed && /Pas de tracé/.test(msg);
console.log(ok ? 'OK' : 'ÉCHEC', 'erreurs', errs); await b.close(); process.exit(ok && !errs.length ? 0 : 1);
