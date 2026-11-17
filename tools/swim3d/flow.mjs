// Parcours complet de « Comprendre la séance » dans l'app (développement) : captures à chaque étape
// node flow.mjs out_prefix [wid=tech|qual] [WxH]
import path from 'path';
const pw = (await import('module')).createRequire(process.env.PW_REQUIRE || '/opt/npm-tools/node_modules/x.js')('playwright');
const S = process.env.SCRATCH || '/home/claude/scratch';
const [out = 'build/f', wid = 'tech', size = '390x760'] = process.argv.slice(2); const [w, h] = size.split('x').map(Number);
const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const pg = await ctx.newPage();
pg.on('pageerror', e => console.log('pageerror', e.message)); pg.on('console', m => { if (/error/.test(m.type()) && !/GL Driver|TUNNEL|Failed to load resource/.test(m.text())) console.log(m.type(), m.text().slice(0, 300)); });
for (const f of ['build/three.min.js', 'examples/js/loaders/GLTFLoader.js', 'examples/js/libs/meshopt_decoder.js', 'examples/js/controls/OrbitControls.js', 'examples/js/environments/RoomEnvironment.js'])
  await pg.route('**/three@0.147.0/' + f, r => r.fulfill({ path: path.join(S, 'node_modules/three', f), contentType: 'application/javascript' }));
await pg.route('**/supabase-js@2.45.4/**', r => r.fulfill({ path: path.join(S, 'node_modules/@supabase/supabase-js/dist/umd/supabase.js'), contentType: 'application/javascript' }));
await pg.clock.install({ time: new Date('2026-11-16T21:00:00+01:00') }); await pg.clock.resume();
await pg.addInitScript(() => {
  if (localStorage.getItem('ftpb_state_v1')) return;
  const days = { 0:{avail:false,max:75}, 1:{avail:true,max:75}, 2:{avail:false,max:75}, 3:{avail:true,max:75}, 4:{avail:false,max:75}, 5:{avail:true,max:120}, 6:{avail:false,max:120} };
  localStorage.setItem('ftpb_state_v1', JSON.stringify({ version:2, updatedAt:Date.now(), profile:{ name:'Arnaud', sex:'M', age:30, weightKg:84, heightCm:182, ftp:250, hrMax:195, goalFtp:300, goalDate:'2027-03-05', endDate:'2027-03-15', minSessions:35, startDate:'2026-10-21', days, keyPerWeek:2, optionalPerWeek:0, testProtocol:'ramp', intensityAdj:1, ctl0:40 }, plan:[], activities:[], ftpHistory:[], settings:{ theme:'dark' } }));
});
await pg.goto('file://' + path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../index.html')); await pg.waitForTimeout(400);
const id = await pg.evaluate(wid => { S.plan = generatePlan(S.profile); applyTri({ ...TRI_DEF(), mode: 'tri', enabled: true, css: 97 }); Garage.Adm.is = true; save(); render();
  const x = S.triPlan.find(y => y.sport === 'swim' && y.wid === wid && y.date >= '2026-11-17' && (wid !== 'qual' || y.ph === 'base')) || S.triPlan.find(y => y.sport === 'swim'); triDlg(x.id); return x.id; }, wid);
const shot = async (n) => { await pg.screenshot({ path: `${out}_${n}.png` }); console.log('→', `${out}_${n}.png`); };
await pg.waitForTimeout(200); await shot('00_fiche');
await pg.click('[data-swim3d]'); const t0 = Date.now();
await pg.waitForSelector('.s3d-card:not([hidden])', { timeout: 120000 }); console.log('prêt en', Date.now() - t0, 'ms');
await pg.waitForTimeout(1500); await shot('01_intro');
const beats = await pg.evaluate(() => Swim3D.debug.D.beats.map((b, i) => ({ i, ch: b.ch, t: b.line?.t?.slice(0, 50), shot: b.shot, coach: b.coach, demo: !!b.demo, cam: b.cam, dive: !!b.dive, sim: !!b.sim, end: !!b.end })));
console.log(beats.map(b => `${b.i} [${b.ch}] ${b.shot || b.cam || (b.dive ? 'DIVE' : b.sim ? 'SIM' : b.end ? 'END' : '')} ${b.coach || ''} ${b.t || ''}`).join('\n'));
await pg.click('[data-a="go"]'); await pg.evaluate(() => { Swim3D.debug.rate = 1; });
const pick = process.env.PICK ? process.env.PICK.split(',').map(Number) : null;
const want = [];
const find = f => beats.findIndex(f);
for (const [nm, i] of [['02_two', 0], ['03_ots', 1], ['04_cu', 2], ['05_board', find(b => b.shot === 'board')], ['06_mime', find(b => b.coach === 'mime')], ['07_pool', find(b => b.shot === 'pool')],
  ['08_cue0', find(b => b.cam === 'uwSide')], ['09_cue1', find(b => b.cam === 'uwFront')], ['10_cue2', find(b => b.cam === 'awSide')], ['11_clock', find(b => b.shot === 'clock')], ['12_outro', find(b => b.shot === 'rev')], ['13_dive', find(b => b.dive)]]) if (i >= 0) want.push([nm, i]);
for (const [nm, i] of want) {
  if (pick && !pick.includes(i)) continue;
  await pg.evaluate(i => Swim3D.debug.goto(i), i);
  if (nm === '13_dive') { for (const [k, tt] of [['a', .6], ['b', 1.45], ['c', 1.8], ['d', 2.05], ['e', 2.6], ['f', 3.9]]) { await pg.evaluate(tt => { Swim3D.debug.D.t = 0; Swim3D.debug.seekDive(tt); }, tt); await pg.waitForTimeout(700); await shot(nm + k); } continue; }
  await pg.waitForTimeout(nm.startsWith('08') || nm.startsWith('09') || nm.startsWith('10') ? 2500 : 1800); await shot(nm);
}
const simI = find(b => b.sim);
if (!pick || pick.includes(simI)) {
  await pg.evaluate(i => Swim3D.debug.goto(i), simI);
  for (const k of ['a', 'b', 'c', 'd', 'e']) { await pg.waitForTimeout(k === 'a' ? 1500 : 4000); await shot('14_sim' + k); }
  await pg.evaluate(() => { const D = Swim3D.debug.D; D.simT = D.sim.total - .5; }); await pg.waitForTimeout(2500); await shot('15_end');
}
const st = await pg.evaluate(() => ({ frames: Swim3D.debug.D.frames, i: Swim3D.debug.D.i }));
console.log('frames', st.frames, 'beat', st.i);
await pg.click('[data-a="close"]'); await pg.waitForTimeout(500);
console.log('fermé :', await pg.evaluate(() => !document.querySelector('.s3d') && !!document.querySelector('#dlg[open] [data-swim3d]')));
await b.close();
