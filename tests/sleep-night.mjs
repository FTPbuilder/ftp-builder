// Fiche Sommeil : analyse de la nuit (phases, cycles, FC et respiration par phase et par cycle).
const pw = (await import('module')).createRequire('/opt/npm-tools/node_modules/x.js')('playwright');
const out = process.env.SCRATCH || '.';
const b = await pw.chromium.launch(); const ctx = await b.newContext({ ...pw.devices['iPhone 13'], colorScheme:'dark' });
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.clock.setFixedTime(new Date('2026-11-04T09:00:00+01:00'));
await pg.goto('file://' + new URL('../index.html', import.meta.url).pathname);
await pg.fill('[name=age]', '28'); await pg.fill('[name=weightKg]', '83'); await pg.fill('[name=ftp]', '255'); await pg.fill('[name=startDate]', '2026-10-21');
await pg.evaluate(() => document.querySelector('button[type=submit]').click()); await pg.waitForSelector('#tabs:not(.hidden)');
await pg.evaluate(() => {
  const H = Health.H; H.daily.length = 0; H.sleep.length = 0; H.segs = []; H.samples = [];
  // 6 nuits : 5 cycles (léger → profond → léger → paradoxal), profond en début, paradoxal qui s'allonge
  let seed = 7; const rnd = () => (seed = (seed*16807) % 2147483647)/2147483647;
  for (let n = 5; n >= 0; n--) {
    const night = addDays(todayISO(), -n); let t = Date.parse(addDays(night, -1) + 'T23:20:00');
    H.segs.push({ start_at: new Date(t - 15*60000).toISOString(), end_at: new Date(t).toISOString(), stage:'inbed', source:'iPhone' });
    const plan = [[['core',20],['deep',45],['core',15],['rem',10]], [['core',25],['deep',35],['core',15],['awake',3],['core',5],['rem',15]], [['core',35],['deep',15],['core',20],['rem',22]], [['core',45],['deep',5],['core',15],['rem',28]], [['core',40],['rem',30],['awake',6]]];
    for (const cyc of plan) for (const [st, m] of cyc) { const a = t; t += m*60000; H.segs.push({ start_at: new Date(a).toISOString(), end_at: new Date(t).toISOString(), stage: st, source:'Apple Watch de Arnaud' });
      // FC : basse en profond, plus haute en paradoxal ; minimum vers 2h30 ; respiration plus rapide et irrégulière en paradoxal
      for (let k = a; k < t; k += 4*60000) { const h = (k - Date.parse(addDays(night, -1) + 'T23:20:00'))/3600000, base = 52 + Math.pow(h - 3, 2)*0.6 + (n === 0 ? 2 : 0);
        H.samples.push({ metric:'hr', at: new Date(k).toISOString(), value: Math.round(base + { deep:-3, core:0, rem:5, awake:9 }[st] + rnd()*2) }); }
      for (let k = a + 60000; k < t; k += 9*60000) H.samples.push({ metric:'resp', at: new Date(k).toISOString(), value: +(14.2 + { deep:-0.6, core:0, rem:1.1, awake:1.5 }[st] + rnd()*0.5 + (n === 0 ? 0.3 : 0)).toFixed(1) });
    }
    H.sleep.push({ night, asleep_min: 400, deep_min: 100, core_min: 220, rem_min: 105, awake_min: 9, source:'Apple Watch de Arnaud', bed_start: new Date(Date.parse(addDays(night, -1) + 'T23:05:00')).toISOString(), bed_end: new Date(t).toISOString() });
    H.daily.push({ day: night, metric:'hrv', value: 60 }, { day: night, metric:'rhr', value: 50 });
  }
  TODAY_PANE = 'forme'; render(); });
await pg.locator('.kpi', { hasText: 'Sommeil' }).first().click(); await pg.waitForTimeout(300);
const txt = (await pg.locator('#infoBody').innerText()).replace(/\n+/g, ' | ');
console.log(txt.slice(0, 900));
const cyc = await pg.locator('#infoBody .cycbar').count(), rows = await pg.locator('#infoBody .ntab tbody tr').count();
const ok = cyc === 5 && rows === 4 && /5 cycles complets/.test(txt) && /FC min \d+ à 0[1-3]:/.test(txt) && /Resp\. 1\d,\d/.test(txt) && /Par phase/.test(txt) && /plus haute en paradoxal/.test(txt);
await pg.evaluate(() => { const n = document.createElement('div'); n.id = 'cap'; n.style.cssText = 'position:absolute;left:0;top:0;width:390px;padding:16px;background:var(--card);z-index:99999'; n.innerHTML = document.querySelector('#infoBody').innerHTML; document.body.appendChild(n); document.querySelector('#infoDlg')?.close?.(); });
await pg.locator('#cap').screenshot({ path: out + '/sleep-night.png' });
console.log(ok ? 'OK' : 'ÉCHEC', 'cycles', cyc, 'lignes', rows, 'erreurs', errs); await b.close(); process.exit(ok && !errs.length ? 0 : 1);
