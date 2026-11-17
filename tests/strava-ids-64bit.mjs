// Identifiants Strava 64 bits (obligatoires à partir du 1er juin 2027) :
//  1. helpers des Edge Functions (sid, rawInt) : l'ID reste exact au-delà de 2^53, y compris dans un webhook brut
//  2. app : une sortie à ID 64 bits est importée avec son ID exact, et une ancienne sortie (stravaId numérique) n'est pas réimportée
import { spawnSync } from 'child_process';
const pw = (await import('module')).createRequire(process.env.PW_REQUIRE || '/opt/npm-tools/node_modules/x.js')('playwright');
const SC = process.env.SCRATCH || process.cwd();
const BIG = '9007199254740993'; // 2^53 + 1 : JSON.parse le transforme en ...992
let ok = true; const assert = (c, m) => { if (!c) { ok = false; console.error('ÉCHEC', m); } else console.log('ok', m); };

// 1. helpers (TypeScript sans dépendance, chargé avec le retrait de types natif de Node 22)
const ids = new URL('../supabase/functions/_shared/ids.ts', import.meta.url).href;
const code = `const { sid, rawInt } = await import(${JSON.stringify(ids)});
const raw = '{"aspect_type":"create","event_time":1800000000,"object_id":${BIG},"object_type":"activity","owner_id":${BIG}7,"subscription_id":1,"updates":{}}';
console.log(JSON.stringify({ a: sid({ id: 1, id_str: '${BIG}' }), b: sid({ id: 123456 }), c: rawInt(raw, 'object_id'), d: rawInt(raw, 'owner_id'), e: rawInt('{"object_id":"${BIG}"}', 'object_id'), f: rawInt('{}', 'object_id') }));`;
const r = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', '--input-type=module', '-e', code], { encoding: 'utf8' });
let h = {}; try { h = JSON.parse(r.stdout.trim().split('\n').pop()); } catch { console.error(r.stderr); }
assert(h.a === BIG && h.b === '123456', 'sid : id_str prioritaire, sinon l\'entier converti en texte');
assert(h.c === BIG && h.d === BIG + '7', 'webhook : object_id et owner_id 64 bits lus exacts dans le JSON brut');
assert(h.e === BIG && h.f === null, 'rawInt : ID déjà en texte accepté, champ absent → null');

// 2. import dans l'app
const t0 = Math.floor(new Date('2026-10-19T18:00:00Z').getTime() / 1000);
const act = (id, start, name) => ({ id: Number(id) || 0, name, sport_type: 'VirtualRide', start_date: new Date(start * 1000).toISOString(), moving_time: 3600, elapsed_time: 3600, distance: 30000, trainer: true, device_watts: true, average_watts: 200 });
const rows = [
  { id: 1, strava_id: '123456', activity: act('123456', t0 - 86400 * 3, 'Ancienne sortie'), streams: null }, // déjà importée avant le passage en texte
  { id: 2, strava_id: BIG, activity: act(BIG, t0, 'Sortie 64 bits'), streams: null },
];
const b = await pw.chromium.launch(); const ctx = await b.newContext({ ...pw.devices['iPhone 13'] });
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
const patched = new Set(); let selectQ = '';
await pg.clock.setFixedTime(new Date('2026-10-19T21:00:00+02:00'));
await pg.route('**/supabase.js', r => r.fulfill({ path: SC + '/node_modules/@supabase/supabase-js/dist/umd/supabase.js', contentType: 'application/javascript' }));
await pg.route('**/*.supabase.co/**', async r => {
  const u = new URL(r.request().url()), m = r.request().method(); const j = (b, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
  if (u.pathname.includes('/auth/v1/user')) return j({ id: 'u1', email: 'a@b.c', aud: 'authenticated', role: 'authenticated' });
  if (u.pathname.includes('/rpc/strava_status')) return j([{ connected: true, athlete_id: BIG }]);
  if (u.pathname.includes('/rpc/')) return j([]);
  if (u.pathname.endsWith('/strava_inbox')) {
    if (m === 'PATCH') { patched.add(u.searchParams.get('id')); return j([]); }
    selectQ = u.searchParams.get('select') || ''; return j(rows.filter(x => !patched.has('eq.' + x.id)));
  }
  if (u.pathname.endsWith('/user_state')) return r.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
  return j([]);
});
await pg.addInitScript(([t0]) => {
  localStorage.setItem('sb-jhemwfhmohqncywjixgh-auth-token', JSON.stringify({ access_token: 'x.y.z', refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'u1', email: 'a@b.c', aud: 'authenticated', role: 'authenticated' } }));
  localStorage.setItem('ftpb_state_v1', JSON.stringify({ version: 1, updatedAt: Date.now(), profile: { name: 'A', sex: 'M', age: 27, weightKg: 81, heightCm: 181, ftp: 255, hrMax: 185, goalFtp: 300, goalDate: '2027-03-05', endDate: '2027-03-15', minSessions: 35, startDate: '2026-10-12', days: { 0: { avail: true, max: 75 }, 1: { avail: true, max: 75 }, 2: { avail: false, max: 75 }, 3: { avail: true, max: 75 }, 4: { avail: false, max: 75 }, 5: { avail: true, max: 120 }, 6: { avail: false, max: 120 } }, keyPerWeek: 2, optionalPerWeek: 1, testProtocol: '20min', intensityAdj: 1, ctl0: 40 },
    plan: [], activities: [{ id: 'old1', source: 'strava', stravaId: 123456, startTs: t0 - 86400 * 3 + 7200, date: '2026-10-16', name: 'Ancienne sortie', durationS: 3600, avgPower: 200, np: 205, hasPower: true, tss: 60, best: null, feel: null }],
    ftpHistory: [{ date: '2026-10-12', ftp: 255, source: 'initial' }], settings: { theme: 'auto' } }));
}, [t0]);
await pg.goto(new URL('../index.html', import.meta.url).href); await pg.waitForTimeout(1500);
const st = await pg.evaluate(() => FTPB.S.activities.map(a => ({ name: a.name, sid: a.stravaId })));
console.log('ACTIVITÉS', JSON.stringify(st), 'select:', selectQ, 'marquées:', [...patched]);
assert(/strava_id:strava_id::text/.test(selectQ), 'strava_id demandé en texte à Supabase');
assert(st.length === 2 && st.filter(a => a.name === 'Ancienne sortie').length === 1, 'ancienne sortie (ID numérique) non réimportée');
assert(st.some(a => a.name === 'Sortie 64 bits' && a.sid === BIG), 'sortie 64 bits importée avec son ID exact');
assert(patched.has('eq.1') && patched.has('eq.2'), 'les deux lignes de la boîte de réception marquées importées');
await pg.evaluate(() => { try { Tour.close(); } catch {} document.querySelector('button[data-tab=profile]').click(); }); await pg.waitForTimeout(300);
await pg.evaluate(() => document.querySelector('[data-settings=open]').click()); await pg.waitForTimeout(300);
const card = (await pg.locator('.card:has([data-strava="sync"])').first().innerText()).replace(/\n+/g, ' | ');
assert(card.includes(`athlète ${BIG}`), 'Réglages : ID athlète 64 bits affiché exact');
console.log(ok && !errs.length ? 'OK' : 'ÉCHEC', 'erreurs', errs); await b.close(); process.exit(ok && !errs.length ? 0 : 1);
