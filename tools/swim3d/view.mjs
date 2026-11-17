// Aperçu d'un GLB sous plusieurs angles (développement) : node view.mjs build/x.glb out.png [vues]
// vues : "face,profil,dos,visage,main" ; SCRATCH = dossier avec three@0.147.0 ; PW_REQUIRE pour playwright
import fs from 'fs'; import path from 'path';
const pw = (await import('module')).createRequire(process.env.PW_REQUIRE || '/opt/npm-tools/node_modules/x.js')('playwright');
const [glbPath, outPath, viewsArg, poseArg] = process.argv.slice(2);
const S = process.env.SCRATCH || '/home/claude/scratch';
const views = (viewsArg || 'face,profil,dos,visage').split((viewsArg || '').includes('[') ? ';' : ',');
const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const pg = await b.newPage({ viewport: { width: 400 * Math.min(views.length, 4), height: 520 * Math.ceil(views.length / 4) } });
pg.on('pageerror', e => console.log('pageerror', e.message)); pg.on('console', m => { if (m.type() !== 'log') console.log(m.type(), m.text()); });
const lib = f => fs.readFileSync(path.join(S, 'node_modules/three', f), 'utf8');
await pg.setContent(`<html><body style="margin:0;background:#334"><script>${lib('build/three.min.js')}</script><script>${lib('examples/js/loaders/GLTFLoader.js')}</script><script>${lib('examples/js/environments/RoomEnvironment.js')}</script></body></html>`);
const glb = fs.readFileSync(glbPath).toString('base64');
if (poseArg) await pg.evaluate(p => { window.POSE = JSON.parse(p); }, poseArg);
await pg.evaluate(async ({ glb, views }) => {
  const T = THREE, W = 400, H = 520;
  const r = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setSize(W * Math.min(views.length, 4), H * Math.ceil(views.length / 4)); r.outputEncoding = T.sRGBEncoding; r.toneMapping = T.ACESFilmicToneMapping; r.setScissorTest(true);
  document.body.appendChild(r.domElement);
  const sc = new T.Scene(); sc.background = new T.Color(0x3a4250);
  sc.environment = new T.PMREMGenerator(r).fromScene(new T.RoomEnvironment(), 0.04).texture;
  const key = new T.DirectionalLight(0xffffff, 2.2); key.position.set(2, 3, 2.5); sc.add(key); sc.add(new T.HemisphereLight(0xdde8ff, 0x403830, 0.6));
  const bin = Uint8Array.from(atob(glb), c => c.charCodeAt(0));
  const gl = await new Promise((ok, ko) => new T.GLTFLoader().parse(bin.buffer, '', ok, ko));
  sc.add(gl.scene);
  const nag = gl.scene.getObjectByName('Nageur'), co = gl.scene.getObjectByName('Coach'); if (nag && co) { nag.position.x = -0.55; co.position.x = 0.55; co.rotation.y = -0.35; nag.rotation.y = 0.35; }
  if (window.POSE) gl.scene.traverse(o => { const p = window.POSE[o.name.replace(/^[NC]_/, '')]; if (o.isBone && p) o.rotation.set(...p); });
  const bb = new T.Box3().setFromObject(gl.scene), c = bb.getCenter(new T.Vector3()), sz = bb.getSize(new T.Vector3());
  const P = { face: [[0, 0.95, 3.6], [0, 0.95, 0], 32], profil: [[3.6, 0.95, 0], [0, 0.95, 0], 32], dos: [[0, 1.0, -3.6], [0, 0.95, 0], 32], trois: [[2.4, 1.3, 2.6], [0, 0.95, 0], 32],
    visage: [[0.35, 1.72, 0.9], [0, 1.69, 0], 22], visage2: [[0, 1.70, 0.9], [0, 1.69, 0], 20], torse: [[0.6, 1.3, 1.6], [0, 1.25, 0], 34], main: [[0.95, 1.75, 0.55], [0.82, 1.45, 0], 24], pied: [[0.6, 0.3, 0.8], [0.12, 0.08, 0.05], 26],
    haut: [[0, 4.5, 0.01], [0, 0, 0], 30], cotevisage: [[0.9, 1.69, 0.02], [0, 1.69, 0.02], 18], visage3: [[-0.5, 1.75, 0.75], [0, 1.69, 0.02], 20], cote: [[3.6, 0.3, 0], [0, 0.3, 0], 40] };
  views.forEach((v, i) => {
    const [p, t, fov] = P[v] || JSON.parse(v); const cam = new T.PerspectiveCamera(fov, W / H, 0.01, 50); cam.position.set(...p); cam.lookAt(...t);
    const x = (i % 4) * W, y = (Math.ceil(views.length / 4) - 1 - Math.floor(i / 4)) * H; r.setViewport(x, y, W, H); r.setScissor(x, y, W, H); r.render(sc, cam);
  });
}, { glb, views });
await pg.screenshot({ path: outPath }); await b.close(); console.log('→', outPath);
