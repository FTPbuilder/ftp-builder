// Forme du jour : batterie (vert ≥ 60, jaune 35–59, rouge < 35) à la place de l'arc.
const pw = (await import('module')).createRequire(process.env.PW_REQUIRE || '/opt/npm-tools/node_modules/x.js')('playwright');
const out = process.env.SCRATCH || '.';
const b = await pw.chromium.launch(); let bad = 0;
for (const scheme of ['dark', 'light']) {
  const ctx = await b.newContext({ ...pw.devices['iPhone 13'], colorScheme: scheme });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.clock.setFixedTime(new Date('2026-10-28T22:05:00+01:00'));
  await pg.goto('file://' + new URL('../index.html', import.meta.url).pathname);
  await pg.fill('[name=age]', '28'); await pg.fill('[name=weightKg]', '83'); await pg.fill('[name=ftp]', '255'); await pg.fill('[name=startDate]', '2026-10-21');
  await pg.evaluate(() => document.querySelector('button[type=submit]').click()); await pg.waitForSelector('#tabs:not(.hidden)');
  await pg.evaluate(() => { const H = Health.H; H.daily.length = 0; H.sleep.length = 0;
    for (let i = 40; i >= 0; i--) { const d = addDays(todayISO(), -i); H.daily.push({ day: d, metric: 'hrv', value: 62 + Math.sin(i)*6 }, { day: d, metric: 'rhr', value: 49 }); H.sleep.push({ night: d, asleep_min: 420, source: 'Intervals.icu' }); }
    TODAY_PANE = 'forme'; render(); });
  await pg.waitForTimeout(900);
  const lab = await pg.getAttribute('[data-i="score"] svg', 'aria-label');
  const fill = await pg.getAttribute('[data-i="score"] .batt-fill', 'fill');
  console.log(scheme, lab, fill);
  if (!/Énergie \d+ sur 100/.test(lab) || !/var\(--(ok|warn|bad)\)/.test(fill) || errs.length) { bad++; console.log('ÉCHEC', errs); }
  await pg.locator('.card', { hasText: 'Énergie du jour' }).first().screenshot({ path: `${out}/battery-${scheme}.png` });
  // les trois couleurs
  const cols = await pg.evaluate(() => [85, 45, 20].map(v => (batterySVG(v).match(/class="batt-fill"[^>]*fill="([^"]+)"/) || [])[1]));
  console.log('couleurs 85/45/20', cols); if (cols.join() !== 'var(--ok),var(--warn),var(--bad)') bad++;
  await pg.evaluate(() => { document.body.insertAdjacentHTML('beforeend', `<div id="bt" style="display:flex;gap:10px;padding:12px;background:var(--card)">${[92, 72, 50, 38, 20, 6].map(v => batterySVG(v, 100)).join('')}</div>`); });
  await pg.locator('#bt').screenshot({ path: `${out}/battery-range-${scheme}.png` });
  await ctx.close();
}
console.log(bad ? 'ÉCHEC' : 'OK'); await b.close(); process.exit(bad ? 1 : 0);
