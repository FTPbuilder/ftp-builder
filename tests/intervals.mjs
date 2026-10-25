const pw = (await import('module')).createRequire('/opt/npm-tools/node_modules/x.js')('playwright');
import fs from 'fs'; import { createRequire } from 'module';
const req = createRequire(process.cwd() + '/package.json'); const FP = req('fit-file-parser'); const F = FP.default || FP;
const SC = process.cwd();
const fit = await new Promise(r => new F({ mode:'list' }).parse(fs.readFileSync('/home/claude/ftp-builder/tests/2026-10-19_seance.fit'), (e,d)=>r(d)));
const t0 = new Date(fit.records[0].timestamp).getTime()/1000;
const streams = { time: fit.records.map(x => Math.round(new Date(x.timestamp).getTime()/1000 - t0)), watts: fit.records.map(x=>x.power??null), heartrate: fit.records.map(x=>x.heart_rate??null), cadence: fit.records.map(x=>x.cadence??null) };
const inbox = [{ source:'intervals', ext_id:'i999', activity:{ id:'i999', name:'Préparation aux tests', type:'VirtualRide', start_date: new Date(t0*1000).toISOString(), moving_time:3155, distance:23955, trainer:true, average_watts:204, weighted_average_watts:229, average_heartrate:157, max_heartrate:183, device_watts:true }, streams }];
let pushed = null, imported = 0, connected = false;
const b = await pw.chromium.launch(); const ctx = await b.newContext({ ...pw.devices['iPhone 13'] });
const pg = await ctx.newPage(); const errs=[]; pg.on('pageerror', e=>errs.push(e.message));
await pg.clock.setFixedTime(new Date('2026-10-25T19:00:00+01:00'));
await pg.route('**/supabase.js', r => r.fulfill({ path: SC + '/node_modules/@supabase/supabase-js/dist/umd/supabase.js', contentType:'application/javascript' }));
await pg.route('**/*.supabase.co/**', async r => {
  const u = new URL(r.request().url()), m = r.request().method(); const j = (b, s=200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(b) });
  if (u.pathname.includes('/auth/v1/user')) return j({ id:'u1', email:'a@b.c', aud:'authenticated', role:'authenticated' });
  if (u.pathname.includes('/rpc/intervals_status')) return j(connected ? [{ connected:true, athlete_id:'i123456', athlete_name:'Arnaud Lacaze', last_sync_at: new Date().toISOString() }] : []);
  if (u.pathname.includes('/rpc/')) return j([]);
  if (u.pathname.endsWith('/functions/v1/intervals')) { const body = JSON.parse(r.request().postData());
    if (body.action === 'connect') { connected = true; return j({ connected:true, athlete:{ id:'i123456', name:'Arnaud Lacaze', ftp: 273 } }); }
    if (body.action === 'sync') return j({ rides:1, others:3, skipped:0, wellness:0, total:4 });
    if (body.action === 'push') { pushed = body; return j({ created: body.events.length, removed: body.remove.length }); }
    return j({}); }
  if (u.pathname.endsWith('/ext_inbox')) { if (m === 'PATCH') { imported++; return j([]); } return j(imported ? [] : inbox); }
  if (u.pathname.endsWith('/user_state')) return r.fulfill({ status:200, contentType:'application/json', body:'null' });
  return j([]);
});
await pg.addInitScript(() => {
  localStorage.setItem('sb-jhemwfhmohqncywjixgh-auth-token', JSON.stringify({ access_token:'x.y.z', refresh_token:'r', token_type:'bearer', expires_in:3600, expires_at:Math.floor(Date.now()/1000)+3600, user:{ id:'u1', email:'a@b.c', aud:'authenticated', role:'authenticated' } }));
});
await pg.goto('file:///home/claude/ftp-builder/index.html');
await pg.fill('[name=age]','27'); await pg.fill('[name=weightKg]','83.2'); await pg.fill('[name=ftp]','255');
await pg.fill('[name=startDate]','2026-10-19');
await pg.evaluate(()=>document.querySelector('button[type=submit]').click()); await pg.waitForSelector('#tabs:not(.hidden)');
await pg.evaluate(()=>document.querySelector('button[data-tab=profile]').click()); await pg.waitForTimeout(300);
await pg.fill('#icuKey', 'abcdefghijklmnop123');
await pg.evaluate(()=>document.querySelector('#icuConnect').click());
await pg.waitForTimeout(2500);
console.log('activities', await pg.evaluate(()=>JSON.stringify(FTPB.S.activities.map(a=>[a.source,a.date,a.np,a.tss,a.extId]))));
console.log('push events', pushed?.events.length, 'remove', pushed?.remove.length, 'first', pushed?.events[0]?.date, pushed?.events[0]?.name);
console.log('DESC:\n' + pushed?.events.find(e=>/Sweet spot 3/.test(e.name))?.description);
fs.writeFileSync('icu-push.fit', Buffer.from(pushed.events[0].fit_base64, 'base64'));
console.log('carte:', (await pg.locator('.card', { hasText:'Intervals.icu' }).first().innerText()).replace(/\n+/g,' | ').slice(0,500));
await pg.locator('.card', { hasText:'Intervals.icu' }).first().screenshot({ path:'icu-card.png' });
console.log('errs', errs); await b.close();
