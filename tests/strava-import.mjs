const pw = (await import('module')).createRequire('/opt/npm-tools/node_modules/x.js')('playwright');
import fs from 'fs'; import { createRequire } from 'module';
const req = createRequire(process.cwd() + '/package.json'); const FP = req('fit-file-parser'); const F = FP.default || FP;
const SC = process.cwd();
// flux Strava simulés à partir de ta vraie séance du 19/10
const fit = await new Promise(r => new F({ mode:'list' }).parse(fs.readFileSync('/home/claude/ftp-builder/tests/2026-10-19_seance.fit'), (e,d)=>r(d)));
const t0 = new Date(fit.records[0].timestamp).getTime()/1000;
const streams = { time: fit.records.map(x => Math.round(new Date(x.timestamp).getTime()/1000 - t0)), watts: fit.records.map(x=>x.power??null), heartrate: fit.records.map(x=>x.heart_rate??null), cadence: fit.records.map(x=>x.cadence??null) };
const row = { id: 1, strava_id: 123456, activity: { id:123456, name:'Home trainer - test Strava', sport_type:'VirtualRide', start_date: new Date(t0*1000).toISOString(), moving_time: 3155, elapsed_time: 3155, distance: 23955, trainer:true, device_watts:true, average_watts:204, average_heartrate:157, max_heartrate:183 }, streams };
const b = await pw.chromium.launch(); const ctx = await b.newContext({ ...pw.devices['iPhone 13'] });
const pg = await ctx.newPage(); const errs=[]; pg.on('pageerror', e=>errs.push(e.message));
let patched = 0;
await pg.clock.setFixedTime(new Date('2026-10-19T21:00:00+02:00'));
await pg.route('**/supabase.js', r => r.fulfill({ path: SC + '/node_modules/@supabase/supabase-js/dist/umd/supabase.js', contentType:'application/javascript' }));
await pg.route('**/*.supabase.co/**', async r => {
  const u = new URL(r.request().url()), m = r.request().method(); const j = (b, s=200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(b) });
  if (u.pathname.includes('/auth/v1/user')) return j({ id:'u1', email:'a@b.c', aud:'authenticated', role:'authenticated' });
  if (u.pathname.includes('/rpc/strava_status')) return j([{ connected:true, athlete_id: 999 }]);
  if (u.pathname.includes('/rpc/')) return j([]);
  if (u.pathname.endsWith('/strava_inbox')) { if (m === 'PATCH') { patched++; return j([]); } return j(patched ? [] : [row]); }
  if (u.pathname.endsWith('/user_state')) return r.fulfill({ status:200, contentType:'application/json', body:'null' });
  return j([]);
});
await pg.addInitScript(() => {
  localStorage.setItem('sb-jhemwfhmohqncywjixgh-auth-token', JSON.stringify({ access_token:'x.y.z', refresh_token:'r', token_type:'bearer', expires_in:3600, expires_at:Math.floor(Date.now()/1000)+3600, user:{ id:'u1', email:'a@b.c', aud:'authenticated', role:'authenticated' } }));
  localStorage.setItem('ftpb_state_v1', JSON.stringify({ version:1, updatedAt:Date.now(), profile:{ name:'A', sex:'M', age:27, weightKg:81, heightCm:181, ftp:255, hrMax:185, goalFtp:300, goalDate:'2027-03-05', endDate:'2027-03-15', minSessions:35, startDate:'2026-10-19', days:{0:{avail:true,max:75},1:{avail:true,max:75},2:{avail:false,max:75},3:{avail:true,max:75},4:{avail:false,max:75},5:{avail:true,max:120},6:{avail:false,max:120}}, keyPerWeek:2, optionalPerWeek:1, testProtocol:'20min', intensityAdj:1, ctl0:40 },
    plan:[{ id:'p1', date:'2026-10-19', week:0, block:'Calibration', kind:'key', workoutId:'ss_3x10', status:'planned' }], activities:[], ftpHistory:[{date:'2026-10-19',ftp:255,source:'initial'}], settings:{theme:'auto'} }));
});
await pg.goto('file:///home/claude/ftp-builder/index.html'); await pg.waitForTimeout(1500);
const st = await pg.evaluate(() => { const S = FTPB.S; const a = S.activities[0]; return { n:S.activities.length, src:a?.source, name:a?.name, dur:a?.durationS, np:a?.np, avg:a?.avgPower, hr:a?.avgHr, tss:a?.tss, best20:a?.best?.m20, linked: S.plan[0].status, comp: a?.compliance }; });
console.log('IMPORT STRAVA', JSON.stringify(st), 'inbox marquée importée:', patched);
console.log('note:', await pg.locator('.note', { hasText:'Strava' }).first().innerText().catch(()=>'—'));
await pg.evaluate(()=>document.querySelector('button[data-tab=profile]').click()); await pg.waitForTimeout(300);
console.log('carte:', (await pg.locator('.card', { hasText:'Strava' }).first().innerText()).replace(/\n+/g,' | ').slice(0,300));
console.log('errs', errs); await b.close();
