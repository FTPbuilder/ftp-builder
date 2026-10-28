// Records de puissance : bouton « À 300 W » → projection (20 min et 5 min ∝ FTP, 1 min à moitié, 5 s à peine)
const pw = (await import('module')).createRequire('/opt/npm-tools/node_modules/x.js')('playwright');
const b = await pw.chromium.launch(); const pg = await b.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.goto('file://' + new URL('../index.html', import.meta.url).pathname);
await pg.fill('[name=age]', '28'); await pg.fill('[name=weightKg]', '83'); await pg.fill('[name=ftp]', '255'); await pg.fill('[name=startDate]', '2026-10-21');
await pg.evaluate(() => document.querySelector('button[type=submit]').click()); await pg.waitForSelector('#tabs:not(.hidden)');
await pg.evaluate(() => { FTPB.S.activities.push({ id:'x', date:'2026-10-27', source:'fit', durationS:3600, hasPower:true, indoor:true, best:{ s5:992, m1:339, m5:274, m20:223 } }); FTPB.save(); document.querySelector('button[data-tab=prog]').click(); });
const card = () => pg.locator('.card', { hasText: 'Records de puissance' }).innerText();
const before = (await card()).replace(/\n+/g, ' | ');
await pg.click('[data-recgoal]'); const after = (await card()).replace(/\n+/g, ' | ');
console.log('AVANT', before.slice(0, 120)); console.log('APRÈS', after.slice(0, 260));
const ok = /262 W/.test(after) && /318 W/.test(after) && /369 W/.test(after) && /1027 W/.test(after) && /\+39 W/.test(after);
console.log(ok ? 'OK' : 'ÉCHEC', errs); await b.close(); process.exit(ok && !errs.length ? 0 : 1);
