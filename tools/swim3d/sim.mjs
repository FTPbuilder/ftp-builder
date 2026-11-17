// Captures de la séance en accéléré à des instants choisis (développement) : node sim.mjs out_prefix
import path from 'path';
const pw = (await import('module')).createRequire(process.env.PW_REQUIRE || '/opt/npm-tools/node_modules/x.js')('playwright');
const S = process.env.SCRATCH || '/home/claude/scratch';
const [out = 'build/m', wid = 'tech'] = process.argv.slice(2);
const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const pg = await (await b.newContext({ viewport: { width: 390, height: 700 }, isMobile: true, hasTouch: true })).newPage();
pg.on('pageerror', e => console.log('pageerror', e.message));
for (const f of ['build/three.min.js', 'examples/js/loaders/GLTFLoader.js', 'examples/js/libs/meshopt_decoder.js']) await pg.route('**/three@0.147.0/' + f, r => r.fulfill({ path: path.join(S, 'node_modules/three', f), contentType: 'application/javascript' }));
await pg.route('**/supabase-js@2.45.4/**', r => r.fulfill({ path: path.join(S, 'node_modules/@supabase/supabase-js/dist/umd/supabase.js'), contentType: 'application/javascript' }));
await pg.addInitScript(() => { const days = { 0:{avail:false,max:75}, 1:{avail:true,max:75}, 2:{avail:false,max:75}, 3:{avail:true,max:75}, 4:{avail:false,max:75}, 5:{avail:true,max:120}, 6:{avail:false,max:120} };
  if (!localStorage.getItem('ftpb_state_v1')) localStorage.setItem('ftpb_state_v1', JSON.stringify({ version:2, updatedAt:Date.now(), profile:{ name:'Arnaud', sex:'M', age:30, weightKg:84, heightCm:182, ftp:250, hrMax:195, goalFtp:300, goalDate:'2027-03-05', endDate:'2027-03-15', minSessions:35, startDate:'2026-10-21', days, keyPerWeek:2, optionalPerWeek:0, testProtocol:'ramp', intensityAdj:1, ctl0:40 }, plan:[], activities:[], ftpHistory:[], settings:{ theme:'dark' } })); });
await pg.goto('file://' + path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../index.html')); await pg.waitForTimeout(300);
const id = await pg.evaluate(wid => { S.plan = generatePlan(S.profile); applyTri({ ...TRI_DEF(), mode: 'tri', enabled: true, css: 97 }); Garage.Adm.is = true; save(); render();
  return (S.triPlan.find(y => y.sport === 'swim' && y.wid === wid && y.date >= '2026-11-27') || S.triPlan.find(y => y.sport === 'swim')).id; }, wid);
await pg.evaluate(id => Swim3D.open(id), id); await pg.waitForSelector('.s3d-card:not([hidden])', { timeout: 120000 });
await pg.click('[data-a="go"]');
const sim = await pg.evaluate(() => { const D = Swim3D.debug.D; Swim3D.debug.goto(D.beats.findIndex(b => b.sim)); D.simFreeze = true; return D.sim.segs.map(s => ({ ...s })); });
const T = [];
const lenTurn = sim.find(s => s.type === 'len' && s.turn), rest = sim.find(s => s.type === 'rest'), after = sim[sim.indexOf(rest) + 1];
const pullB = sim.find(s => s.type === 'len' && s.style === 'paddles') || sim.find(s => s.type === 'len' && s.style === 'buoy'), drill = sim.find(s => s.type === 'len' && s.style !== 'free');
const back = sim.find(s => s.type === 'len' && s.style === 'back');
T.push(['dos', back ? back.t0 + back.dur*.45 : 5, 0], ['dos_dessous', back ? back.t0 + back.dur*.45 : 5, 1], ['virage_dos', back ? back.t0 + .15 : 5, 0], ['nage', sim[0].t0 + sim[0].dur*.5, 0], ['culbute1', lenTurn.t0 + lenTurn.dur - .35, 4], ['culbute2', lenTurn.t0 + lenTurn.dur - .08, 4], ['coulee', lenTurn.t0 + lenTurn.dur + .3, 4],
  ['repos', rest.t0 + 2, 0], ['poussee', after.t0 + .55, 0], ['educ', drill.t0 + drill.dur*.4, 0], ['educ_dessous', drill.t0 + drill.dur*.4, 1], ['pull', pullB ? pullB.t0 + pullB.dur*.5 : 10, 0], ['pull_dessous', pullB ? pullB.t0 + pullB.dur*.5 : 10, 1], ['haut', sim[2].t0 + 6, 2], ['bord', sim[2].t0 + 6, 3]);
for (const [nm, t, cam] of (process.env.ONLY ? T.filter(x => process.env.ONLY.split(',').includes(x[0])) : T)) {
  await pg.evaluate(({ t, cam }) => { const D = Swim3D.debug.D; D.simT = t; D.u.swim = t*.6; D.simShot = -999; D.simCam = cam - 1; }, { t, cam });
  await pg.waitForTimeout(900); await pg.screenshot({ path: `${out}_${nm}.png` });
}
console.log('ok', T.length); await b.close();
