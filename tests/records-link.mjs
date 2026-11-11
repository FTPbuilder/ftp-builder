// Records de puissance : un clic sur une case ouvre la séance où le record a été établi
const pw = (await import('module')).createRequire(process.env.PW_REQUIRE || '/opt/npm-tools/node_modules/x.js')('playwright');
const b = await pw.chromium.launch(); const pg = await b.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.goto('file://' + new URL('../index.html', import.meta.url).pathname);
await pg.fill('[name=age]', '28'); await pg.fill('[name=weightKg]', '83'); await pg.fill('[name=ftp]', '255'); await pg.fill('[name=startDate]', '2026-10-21');
await pg.evaluate(() => document.querySelector('button[type=submit]').click()); await pg.waitForSelector('#tabs:not(.hidden)');
await pg.evaluate(() => {
  FTPB.S.activities.push(
    { id:'sprint', name:'Séance sprint', date:'2026-10-19', source:'fit', durationS:3600, hasPower:true, indoor:true, best:{ s5:992, m1:330, m5:271, m20:219 } },
    { id:'ramp', name:'Ramp test', date:'2026-11-01', source:'fit', durationS:1212, hasPower:true, indoor:true, best:{ s5:390, m1:347, m5:303, m20:192 } });
  FTPB.save(); document.querySelector('button[data-tab=prog]').click();
});
const card = pg.locator('.card', { hasText: 'Records de puissance' });
const open = async label => { await card.locator('.kpi', { hasText: label }).first().click(); const t = await pg.locator('#dlg').innerText(); await pg.keyboard.press('Escape'); await pg.waitForTimeout(150); return t + (await pg.locator('#infoDlg[open]').count() ? ' [INFO OUVERTE]' : ''); };
const t1 = await open('1 min'), t5s = await open('5 s');
const dates = await card.innerText();
const ok = !/INFO/.test(t1 + t5s) && /ramp test/i.test(t1) && /sprint/i.test(t5s) && /›/.test(dates);
console.log('1 min →', t1.slice(0,160).replace(/\n+/g,' | '), '| 5 s →', t5s.slice(0,160).replace(/\n+/g,' | '));
console.log(ok ? 'OK' : 'ÉCHEC', errs); await b.close(); process.exit(ok && !errs.length ? 0 : 1);
