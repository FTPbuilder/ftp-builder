// Forme du jour : clic sur VFC / FC repos / Sommeil / indice → graphique des 5 derniers jours (+ moyenne 30 j)
const pw = (await import('module')).createRequire('/opt/npm-tools/node_modules/x.js')('playwright');
const out = process.env.SCRATCH || '.';
const b = await pw.chromium.launch(); const ctx = await b.newContext({ ...pw.devices['iPhone 13'] });
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.clock.setFixedTime(new Date('2026-10-28T22:05:00+01:00'));
await pg.goto('file://' + new URL('../index.html', import.meta.url).pathname);
await pg.fill('[name=age]', '28'); await pg.fill('[name=weightKg]', '83'); await pg.fill('[name=ftp]', '255'); await pg.fill('[name=startDate]', '2026-10-21');
await pg.evaluate(() => document.querySelector('button[type=submit]').click()); await pg.waitForSelector('#tabs:not(.hidden)');
await pg.evaluate(() => { const H = Health.H; H.daily.length = 0; H.sleep.length = 0;
  for (let i = 40; i >= 0; i--) { const d = addDays(todayISO(), -i); H.daily.push({ day: d, metric: 'hrv', value: 62 + Math.sin(i)*6 - (i < 3 ? 9 : 0) }, { day: d, metric: 'rhr', value: 49 + (i < 2 ? 4 : Math.cos(i)) }, { day: d, metric: 'weight', value: 83.2 - i*0.01 });
    H.sleep.push({ night: d, asleep_min: 420 + Math.round(Math.sin(i*1.7)*50), deep_min: 60, rem_min: 90, source: 'Apple Watch' }); }
  render(); });
const kpis = await pg.locator('.kpi', { hasText: 'VFC' }).count(); console.log('kpi VFC', kpis);
await pg.locator('.kpi', { hasText: 'VFC' }).first().click(); await pg.waitForTimeout(200);
const hrv = await pg.locator('#infoBody').innerText(); await pg.locator('#infoBody').screenshot({ path: out + '/forme-hrv.png' });
await pg.click('[data-closeinfo]'); await pg.locator('[data-i="score"]').first().click(); await pg.waitForTimeout(200);
const sc = await pg.locator('#infoBody svg.chart').count();
console.log('VFC:', hrv.replace(/\n+/g, ' | ').slice(0, 200), '| graphe indice', sc);
const ok = /5 derniers jours/.test(hrv) && /moy\. 30 j/.test(hrv) && sc >= 1;
console.log(ok ? 'OK' : 'ÉCHEC', 'erreurs', errs); await b.close(); process.exit(ok && !errs.length ? 0 : 1);
