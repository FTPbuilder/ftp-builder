// Défis : clic sur le défi → détail (chiffres clés, 30 jours, journal horodaté des ajouts), anciennes saisies sans heure, correction
const pw = (await import('module')).createRequire('/opt/npm-tools/node_modules/x.js')('playwright');
const out = process.env.SCRATCH || '.';
const b = await pw.chromium.launch(); const ctx = await b.newContext({ ...pw.devices['iPhone 13'] });
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.clock.setFixedTime(new Date('2026-10-28T12:51:00+01:00'));
await pg.goto('file://' + new URL('../index.html', import.meta.url).pathname);
await pg.fill('[name=age]', '28'); await pg.fill('[name=weightKg]', '83'); await pg.fill('[name=ftp]', '255'); await pg.fill('[name=startDate]', '2026-10-21');
await pg.evaluate(() => document.querySelector('button[type=submit]').click()); await pg.waitForSelector('#tabs:not(.hidden)');
await pg.evaluate(() => { const c = FTPB.S.challenges ? FTPB.S.challenges[0] : null; render(); const sq = (FTPB.S.challenges || []).find(x => x.id === 'squats'); sq.entries['2026-10-26'] = 120; sq.entries['2026-10-27'] = 200; FTPB.save(); render(); });
await pg.click('.tile[data-pane=defis]'); await pg.click('[data-chadd="squats"][data-v="50"]'); await pg.clock.setFixedTime(new Date('2026-10-28T12:58:00+01:00')); await pg.click('[data-chadd="squats"][data-v="20"]');
await pg.locator('.chhead[data-chedit="squats"]').click(); await pg.waitForTimeout(200);
const txt = (await pg.locator('#dlg').innerText()).replace(/\n+/g, ' | ');
console.log('DÉTAIL', txt.slice(0, 520));
await pg.screenshot({ path: out + '/challenge.png', fullPage: true });
const ok = /\+50 à 12:51/.test(txt) && /\+20 à 12:58/.test(txt) && /saisi avant/.test(txt) && /jours d'affilée/i.test(txt) && /3\s*\|\s*jours d'affilée/i.test(txt);
console.log(ok ? 'OK' : 'ÉCHEC', 'erreurs', errs); await b.close(); process.exit(ok && !errs.length ? 0 : 1);
