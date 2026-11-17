// Images fixes de la scène « Comprendre la séance » (développement) : node shot.mjs out.png 'json des vues'
// Chaque vue : { swim | swimStand | coach | cam: [[x,y,z],[x,y,z],fov], t, clock, board? }
import fs from 'fs'; import path from 'path';
const pw = (await import('module')).createRequire(process.env.PW_REQUIRE || '/opt/npm-tools/node_modules/x.js')('playwright');
const S = process.env.SCRATCH || '/home/claude/scratch';
const [out, viewsJson, size = '390x700'] = process.argv.slice(2);
const views = JSON.parse(viewsJson.endsWith('.json') ? fs.readFileSync(viewsJson, 'utf8') : viewsJson); const [w, h] = size.split('x').map(Number);
const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const pg = await b.newPage({ viewport: { width: w, height: h } });
pg.on('pageerror', e => console.log('pageerror', e.message)); pg.on('console', m => { if (/error|warn/.test(m.type()) && !/GL Driver|GPU stall/.test(m.text())) console.log(m.type(), m.text().slice(0, 300)); });
for (const f of ['build/three.min.js', 'examples/js/loaders/GLTFLoader.js', 'examples/js/libs/meshopt_decoder.js', 'examples/js/controls/OrbitControls.js', 'examples/js/environments/RoomEnvironment.js'])
  await pg.route('**/three@0.147.0/' + f, r => r.fulfill({ path: path.join(S, 'node_modules/three', f), contentType: 'application/javascript' }));
await pg.route('**/supabase-js@2.45.4/**', r => r.fulfill({ path: path.join(S, 'node_modules/@supabase/supabase-js/dist/umd/supabase.js'), contentType: 'application/javascript' }));
await pg.goto('file://' + path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../index.html'));
await pg.waitForTimeout(400);
await pg.evaluate(() => { const d = document.createElement('div'); d.id = 'dev3d'; d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#000'; document.body.appendChild(d); });
const t0 = Date.now();
await pg.evaluate(() => Swim3D.debug.init(document.getElementById('dev3d')));
console.log('init', Date.now() - t0, 'ms');
const shots = [];
for (const [i, v] of views.entries()) {
  if (v.board) v.board = await pg.evaluate(() => Swim3D.plan(null, { css: 97, W: { name: 'Nat CSS 10 × 100', goal: 'test', steps: [{ n: 1, d: 400, z: 'z1', l: 'Échauffement', r: 0 }, { n: 8, d: 50, z: 'drill', l: 'Rattrapé', r: 15 }, { n: 10, d: 100, z: 'css', l: 'Allure CSS', r: 15 }, { n: 1, d: 200, z: 'z1', l: 'Retour au calme', r: 0 }] } }));
  await pg.evaluate(v => Swim3D.debug.still(v), v);
  const f = out.replace(/\.png$/, `_${i}.png`); await pg.screenshot({ path: f }); shots.push(f);
}
await b.close();
console.log(shots.join('\n'));
