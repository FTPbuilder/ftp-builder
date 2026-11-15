"use strict";
// FTP Builder · Garage : scène 3D du vélo (three.js) — studio, rotation libre, zoom sur une zone, vue éclatée « mode ingénieur », témoins d'usure ; maquette FTP personnalisable ; import d'un vrai modèle GLB
/* ============ Bike3D ============
   Trois sources de maquette :
   - « glb » : le vrai modèle de l'utilisateur (fichier .glb importé), découpé en composants d'après le nom de ses objets (ou le réglage manuel) ;
   - « ftp » (par défaut) : le vélo aéro modélisé pour FTP Builder (models/velo-aero.js), cadre original sans marque aux cotes d'un vélo aéro
     taille M, personnalisable (couleur, finition, sticker, hauteur de jante, flancs) ;
   - « proc » : maquette générique procédurale aux mêmes cotes (empattement 99 cm, stack 57, reach 38) — repli si la maquette FTP ne se charge pas.
   Repère : x vers l'avant, y vers le haut, z côté transmission, en mètres. Chaque composant est un groupe (clé `g`) avec un décalage d'éclaté. */
const Bike3D = (() => {
  const CDN = 'https://cdn.jsdelivr.net/npm/three@0.147.0/';
  const script = src => new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ko(new Error('bibliothèque 3D injoignable')); document.head.appendChild(s); });
  let libs = null, gltfLibs = null;
  const loadLibs = () => libs ||= (async () => { if (!window.THREE) await script(CDN + 'build/three.min.js'); if (!THREE.OrbitControls) await script(CDN + 'examples/js/controls/OrbitControls.js');
    if (!THREE.RoomEnvironment) await script(CDN + 'examples/js/environments/RoomEnvironment.js').catch(() => {}); })().catch(e => { libs = null; throw e; });
  const loadGltf = () => gltfLibs ||= (async () => { await loadLibs(); if (!THREE.GLTFLoader) await script(CDN + 'examples/js/loaders/GLTFLoader.js'); if (!THREE.DRACOLoader) await script(CDN + 'examples/js/loaders/DRACOLoader.js').catch(() => {}); })().catch(e => { gltfLibs = null; throw e; });

  const LABEL = { frame: 'Cadre', fork: 'Fourche', wheelF: 'Roue AV', wheelR: 'Roue AR', tireF: 'Pneu AV', tireR: 'Pneu AR', chain: 'Chaîne', cassette: 'Cassette', crank: 'Pédalier',
    fd: 'Dérailleur AV', rd: 'Dérailleur AR', calipers: 'Freins', rotors: 'Disques', headset: 'Direction', bb: 'Boîtier', cockpit: 'Cockpit', levers: 'Leviers', seatpost: 'Tige de selle', saddle: 'Selle', battery: 'Batterie Di2' };
  // reconnaissance des composants d'un GLB d'après le nom des objets (français / anglais)
  const NAME_RX = [
    ['tireF', /(front|avant|_f\b|\bf_).*(tire|tyre|pneu)|(tire|tyre|pneu).*(front|avant)/i], ['tireR', /(rear|arri|_r\b|\br_).*(tire|tyre|pneu)|(tire|tyre|pneu).*(rear|arri)/i],
    ['frame', /stay|hauban|\bbases?\b|\btube\b|downtube|top.?tube|frame|cadre|logo|badge/i], // tubes et haubans avant « chain » (chain stay) et « seat » (seat tube)
    ['rotors', /rotor|\bdisc\b|disque/i], ['cassette', /cassette|sprocket|pignon|\bcog/i], ['chain', /\bchain\b(?!\s*-?(stay|ring|line))|\bcha[iî]ne\b/i], ['rd', /rear.?derail|d[ée]railleur.?(ar|arri)|\brd\b|jockey|galet|pulley/i],
    ['fd', /front.?derail|d[ée]railleur.?(av|avant)|\bfd\b/i], ['crank', /crank|manivelle|chainring|plateau|p[ée]dalier|spider|power|pedal|p[ée]dale/i], ['bb', /bottom.?bracket|bo[iî]tier|\bbb\b/i],
    ['calipers', /caliper|[ée]trier|brake(?!\s*-?(track|rotor|disc))|frein|\bpads?\b|patin|plaquette/i], ['levers', /lever|levier|shifter|hood|cocotte/i], ['cockpit', /handle|cintre|cockpit|stem|potence|\bbar|tape|guidoline/i],
    ['headset', /headset|direction|spacer/i], ['saddle', /saddle|selle\b/i], ['seatpost', /seat.?post|tige/i], ['battery', /batter|di2/i],
    ['fork', /fork|fourche/i], ['wheelF', /(front|avant).*(wheel|roue|rim|jante|hub|moyeu|spoke|rayon)|(wheel|roue|rim|jante).*(front|avant)/i],
    ['wheelR', /(rear|arri).*(wheel|roue|rim|jante|hub|moyeu|spoke|rayon)|(wheel|roue|rim|jante).*(rear|arri)/i],
  ];
  const ZONE_SPREAD = .55;
  const clean = n => String(n || '').replace(/[_.\-]+/g, ' ').replace(/\s\d+$/, ''); // GLTFLoader remplace les espaces par « _ »
  const OFF = { frame: [0, 0, 0], fork: [.17, -.05, 0], wheelF: [.36, -.02, 0], tireF: [.6, .1, .12], rotors: [0, 0, -.3], wheelR: [-.28, -.02, 0], tireR: [-.52, .1, .12],
    cassette: [-.17, 0, .34], rd: [-.11, -.15, .38], chain: [.05, -.34, .28], crank: [.15, -.2, .46], bb: [0, -.34, 0], fd: [.07, .02, .32], seatpost: [-.05, .22, 0], saddle: [-.08, .42, 0],
    battery: [-.26, .12, 0], cockpit: [.17, .27, 0], levers: [.34, .36, 0], headset: [.03, .15, .32], calipers: [0, .02, -.42] };
  let R = null; // scène courante
  const st = { t: 0, target: 0, opts: null, el: null, raf: 0, last: 0, sel: null, idle: 0, intro: null, introDone: false, focus: null, busy: 0, zone: null, zlast: null, zt: 0 };
  const ease = t => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3)/2;
  const smooth = (a, b, k) => a + (b - a)*k;

  /* ---------- géométries utiles ---------- */
  function toothed(T, teeth, rTip, rHole, depth, spider = 0){
    const s = new T.Shape(), n = teeth, tooth = .0042;
    for (let i = 0; i < n; i++) { const a = i/n*Math.PI*2, da = Math.PI*2/n;
      const pts = [[a, rTip - tooth], [a + da*.22, rTip - tooth*.2], [a + da*.38, rTip], [a + da*.62, rTip], [a + da*.78, rTip - tooth*.2]];
      pts.forEach(([b, r], j) => (i || j) ? s.lineTo(r*Math.cos(b), r*Math.sin(b)) : s.moveTo(r*Math.cos(b), r*Math.sin(b))); }
    s.closePath(); const h = new T.Path(); h.absarc(0, 0, rHole, 0, Math.PI*2, true); s.holes.push(h);
    for (let i = 0; i < spider; i++) { const a = (i + .5)/spider*Math.PI*2, c = (rHole + rTip - tooth)/2, w = (rTip - tooth - rHole)*.3; const p = new T.Path(); p.absellipse(c*Math.cos(a), c*Math.sin(a), w, w*1.5, 0, Math.PI*2, true, a); s.holes.push(p); }
    const g = new T.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 6 }); g.translate(0, 0, -depth/2); return g;
  }
  function annulus(T, r1, r0, depth, bevel = .0012, seg = 96){ const s = new T.Shape(); s.absarc(0, 0, r1, 0, Math.PI*2, false); const h = new T.Path(); h.absarc(0, 0, r0, 0, Math.PI*2, true); s.holes.push(h);
    const g = new T.ExtrudeGeometry(s, { depth, bevelEnabled: !!bevel, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: seg }); g.translate(0, 0, -depth/2); return g; }
  // jante profilée (révolution autour de z) : crochets, flancs bombés, pont de rayons
  function rimGeo(T, r, depth, w){ const h = w/2, p = [[r - .002, 0], [r, h*.72], [r + .002, h*.86], [r - .002, h], [r - depth*.25, h*1.06], [r - depth*.62, h*.92], [r - depth*.9, h*.5], [r - depth, 0]];
    const pts = [...p, ...p.slice(1, -1).reverse().map(([a, b]) => [a, -b])].map(([a, b]) => new T.Vector2(a, b)); pts.push(pts[0].clone());
    const g = new T.LatheGeometry(pts, 120); g.rotateX(Math.PI/2); g.computeVertexNormals(); return g; }

  /* ---------- maquette procédurale ---------- */
  function buildProc(T, model, variant){
    const aero = model !== 'road', rim = variant?.brakes === 'rim', V = (x, y, z = 0) => new T.Vector3(x, y, z);
    const base = {
      carbon: new T.MeshPhysicalMaterial({ color: 0x121418, roughness: .34, metalness: .15, clearcoat: 1, clearcoatRoughness: .12 }),
      carbonMatte: new T.MeshPhysicalMaterial({ color: 0x1a1c21, roughness: .62, metalness: .1, clearcoat: .2, clearcoatRoughness: .6 }),
      rim: new T.MeshPhysicalMaterial({ color: 0x15161a, roughness: .45, metalness: .2, clearcoat: .6, clearcoatRoughness: .3 }),
      track: new T.MeshStandardMaterial({ color: 0x3a3d43, roughness: .35, metalness: .6 }),
      rubber: new T.MeshStandardMaterial({ color: 0x17181b, roughness: .82, metalness: 0 }),
      tape: new T.MeshStandardMaterial({ color: 0x1b1c20, roughness: .95, metalness: 0 }),
      alu: new T.MeshStandardMaterial({ color: 0xc9ced6, roughness: .22, metalness: 1 }),
      steel: new T.MeshStandardMaterial({ color: 0x8d939b, roughness: .3, metalness: 1 }),
      darkMetal: new T.MeshStandardMaterial({ color: 0x2c2f35, roughness: .32, metalness: .85 }),
      polished: new T.MeshStandardMaterial({ color: 0x9aa1aa, roughness: .12, metalness: 1 }),
      spoke: new T.MeshStandardMaterial({ color: 0x101114, roughness: .45, metalness: .7 }),
      batt: new T.MeshStandardMaterial({ color: 0x1f6feb, roughness: .35, metalness: .3 }),
      pad: new T.MeshStandardMaterial({ color: 0x6b4a2e, roughness: .9 }),
    };
    for (const m of Object.values(base)) m.color.convertSRGBToLinear(); // r147 lit les hex en linéaire : on reconvertit pour garder le noir carbone
    const root = new T.Group(), groups = {}, matCache = {};
    const grp = k => { if (!groups[k]) { const g = new T.Group(); g.userData.g = k; groups[k] = g; root.add(g); } return groups[k]; };
    const matFor = (k, m) => matCache[k + ':' + m.uuid] ||= m.clone(); // matériaux par composant (pour estomper les autres)
    const add = (k, mesh) => { mesh.userData.g = k; mesh.castShadow = true; mesh.receiveShadow = true; if (mesh.material) mesh.material = matFor(k, mesh.material); grp(k).add(mesh); return mesh; };
    function frameTube(k, a, b, chord, thick, mat = base.carbon, cut = .82, taper = 1){
      const axis = b.clone().sub(a), len = axis.length(); axis.normalize();
      let n = V(-axis.y, axis.x, 0); if (n.lengthSq() < 1e-6) n = V(1, 0, 0); n.sub(axis.clone().multiplyScalar(n.dot(axis))).normalize(); if (n.x + n.y*.3 < 0) n.negate();
      const lat = n.clone().cross(axis), sh = new T.Shape(), N = 20, pts = [];
      if (aero && chord > thick*1.15) { for (let i = 0; i <= N; i++) { const u = cut*i/N, w = (thick/2)*Math.min(1, (2.97*Math.sqrt(u) - 1.26*u - 3.52*u*u + 2.84*u*u*u - 1.02*u*u*u*u)/.6); pts.push([w, chord/2 - u*chord]); }
        pts.forEach(([x, y], i) => i ? sh.lineTo(x, y) : sh.moveTo(x, y)); for (let i = pts.length - 1; i >= 0; i--) sh.lineTo(-pts[i][0], pts[i][1]); }
      else sh.absellipse(0, 0, thick/2, chord/2, 0, Math.PI*2, false, 0);
      const geo = new T.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false, curveSegments: 18, steps: taper !== 1 ? 6 : 1 });
      if (taper !== 1) { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const f = smooth(1, taper, p.getZ(i)/len); p.setX(i, p.getX(i)*f); p.setY(i, p.getY(i)*f); } geo.computeVertexNormals(); }
      const m = new T.Mesh(geo, mat); m.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(lat, n, axis)); m.position.copy(a); return add(k, m);
    }
    const node = (k, p, sx, sy, sz, mat = base.carbon) => { const m = new T.Mesh(new T.SphereGeometry(1, 24, 16), mat); m.scale.set(sx, sy, sz); m.position.copy(p); return add(k, m); };
    const cyl = (k, r, len, mat, pos, seg = 28, axis = 'z', r2 = r) => { const m = new T.Mesh(new T.CylinderGeometry(r, r2, len, seg), mat); if (axis === 'z') m.rotation.x = Math.PI/2; else if (axis === 'x') m.rotation.z = Math.PI/2; m.position.copy(pos); return add(k, m); };
    const roundBox = (w, h, d, r) => { const s = new T.Shape(), x = -w/2, y = -h/2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
      const g = new T.ExtrudeGeometry(s, { depth: Math.max(.0002, d - r), bevelEnabled: true, bevelThickness: r/2, bevelSize: r/2, bevelSegments: 3, curveSegments: 6 }); g.translate(0, 0, -Math.max(.0002, d - r)/2); return g; };
    const box = (k, w, h, d, mat, pos, rotZ = 0, r = 0) => { const m = new T.Mesh(r ? roundBox(w, h, d, r) : new T.BoxGeometry(w, h, d), mat); m.position.copy(pos); m.rotation.z = rotZ; return add(k, m); };
    const tube = (k, pts, r, mat, closed = false, seg = 64) => add(k, new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts, closed, 'centripetal'), seg, r, 10, closed), mat));

    /* géométrie taille M */
    const RA = V(0, .335), BB = V(.408, .263), FA = V(.99, .335), d = V(-.292, .956), s = V(-.284, .959);
    const P0 = V(FA.x - .047, FA.y), HTb = P0.clone().addScaledVector(d, .37), HTt = HTb.clone().addScaledVector(d, .15);
    const ST = BB.clone().addScaledVector(s, .5), TTr = BB.clone().addScaledVector(s, .465), SSj = BB.clone().addScaledVector(s, .31);
    const at = (p, z) => V(p.x, p.y, z);

    // cadre : tubes profilés + nœuds de jonction (raccords lissés)
    frameTube('frame', HTb.clone().addScaledVector(d, .02), V(BB.x + .02, BB.y + .03), aero ? .074 : .05, aero ? .04 : .045, base.carbon, .82, 1.12);
    frameTube('frame', HTb.clone().addScaledVector(d, -.014), HTt.clone().addScaledVector(d, .012), aero ? .074 : .05, aero ? .044 : .042);
    frameTube('frame', HTt.clone().addScaledVector(d, -.024), TTr, aero ? .044 : .035, aero ? .032 : .034, base.carbon, .82, .9);
    frameTube('frame', V(BB.x - .004, BB.y + .01), ST, aero ? .06 : .034, aero ? .034 : .032, base.carbon, .8, .92);
    for (const z of [1, -1]) {
      frameTube('frame', V(RA.x + .012, RA.y + .005, .062*z), at(SSj, .02*z), aero ? .022 : .016, .016, base.carbon, .82, 1.15);
      frameTube('frame', V(RA.x + .012, RA.y - .004, .062*z), V(BB.x - .03, BB.y + .005, .036*z), aero ? .03 : .022, .02, base.carbon, .82, 1.25);
      box('frame', .04, .032, .009, base.carbonMatte, V(RA.x + .008, RA.y, .066*z), 0, .003);
    }
    node('frame', BB, .03, .032, .046); node('frame', SSj, .026, .03, .024); node('frame', TTr, .024, .026, .02);
    node('frame', HTt.clone().addScaledVector(d, -.01), .03, .03, .024); node('frame', HTb.clone().addScaledVector(d, .01), .034, .034, .024);
    // fourche : fourreaux profilés, té
    const crown = HTb.clone().addScaledVector(d, -.032);
    for (const z of [1, -1]) frameTube('fork', at(crown, .046*z), V(FA.x - .004, FA.y + .004, .053*z), aero ? .042 : .026, .02, base.carbon, .82, .7);
    node('fork', crown, .034, .022, .066);
    for (const z of [1, -1]) box('fork', .028, .028, .008, base.carbonMatte, V(FA.x, FA.y, .057*z), 0, .003);
    // direction : roulements haut / bas
    for (const p of [HTt.clone().addScaledVector(d, .006), HTb.clone().addScaledVector(d, -.006)]) { const m = new T.Mesh(new T.TorusGeometry(.019, .0055, 12, 36), base.polished); m.position.copy(p); m.quaternion.setFromUnitVectors(V(0, 0, 1), d); add('headset', m); }
    cyl('headset', .02, .018, base.carbonMatte, HTt.clone().addScaledVector(d, .02), 28, 'y').quaternion.setFromUnitVectors(V(0, 1, 0), d);
    // cockpit intégré : potence profilée, tops aplatis, cintre, guidoline
    const sp = HTt.clone().addScaledVector(d, .03), bar = V(sp.x + .108, sp.y + .012);
    frameTube('cockpit', sp.clone().add(V(-.012, 0)), bar.clone().add(V(.012, 0)), .024, .032, base.carbon);
    node('cockpit', sp, .022, .02, .02);
    const top = new T.Mesh(new T.CylinderGeometry(.012, .012, .40, 24), base.carbon); top.scale.set(aero ? 2.1 : 1, 1, 1); top.rotation.x = Math.PI/2; top.position.copy(bar); add('cockpit', top);
    for (const z of [1, -1]) tube('cockpit', [V(bar.x, bar.y, .2*z), V(bar.x + .055, bar.y - .004, .201*z), V(bar.x + .086, bar.y - .045, .204*z), V(bar.x + .073, bar.y - .1, .208*z), V(bar.x + .03, bar.y - .126, .211*z), V(bar.x - .035, bar.y - .128, .213*z)], .0122, base.tape, false, 48);
    // leviers (cocottes + palettes)
    for (const z of [1, -1]) { box('levers', .078, .034, .028, base.carbonMatte, V(bar.x + .074, bar.y + .011, .2*z), -.32, .009); node('levers', V(bar.x + .11, bar.y + .024, .2*z), .012, .014, .013, base.carbonMatte);
      tube('levers', [V(bar.x + .102, bar.y + .006, .2*z), V(bar.x + .111, bar.y - .04, .2*z), V(bar.x + .102, bar.y - .094, .203*z)], .0065, base.darkMetal, false, 18); }
    // tige de selle aéro + selle (coque, rails)
    const SP = ST.clone().addScaledVector(s, .22);
    frameTube('seatpost', ST.clone().addScaledVector(s, -.07), SP, aero ? .05 : .027, aero ? .026 : .027, base.carbon);
    box('seatpost', .05, .016, .03, base.darkMetal, V(SP.x + .005, SP.y + .012, 0), 0, .004);
    const sh = new T.Shape(); sh.moveTo(.14, 0); sh.bezierCurveTo(.14, .017, .06, .02, .02, .03); sh.bezierCurveTo(-.06, .066, -.13, .067, -.136, .044); sh.lineTo(-.136, -.044); sh.bezierCurveTo(-.13, -.067, -.06, -.066, .02, -.03); sh.bezierCurveTo(.06, -.02, .14, -.017, .14, 0);
    const sg = new T.ExtrudeGeometry(sh, { depth: .014, bevelEnabled: true, bevelThickness: .009, bevelSize: .007, bevelSegments: 5, curveSegments: 24 }); sg.rotateX(Math.PI/2);
    const sad = new T.Mesh(sg, base.carbonMatte); sad.position.set(SP.x + .03, SP.y + .05, 0); add('saddle', sad);
    for (const z of [1, -1]) tube('saddle', [V(SP.x - .075, SP.y + .036, .022*z), V(SP.x - .03, SP.y + .022, .02*z), V(SP.x + .04, SP.y + .022, .019*z), V(SP.x + .095, SP.y + .036, .012*z)], .0035, base.darkMetal, false, 16);
    // batterie Di2 (dans la tige) et boîtier de pédalier : visibles en éclaté seulement
    const bat = cyl('battery', .011, .12, base.batt, ST.clone().addScaledVector(s, .03), 20, 'y'); bat.quaternion.setFromUnitVectors(V(0, 1, 0), s); grp('battery').userData.hideAssembled = true;
    cyl('bb', .0205, .088, base.polished, BB.clone(), 28); for (const z of [1, -1]) cyl('bb', .023, .006, base.darkMetal, V(BB.x, BB.y, .044*z), 28); grp('bb').userData.hideAssembled = true;

    /* roues : jantes profilées, pneus, moyeux, rayons droits, disques ou piste de freinage */
    function wheel(kW, kT, c, rear, tireW){
      const rimR = .311, depth = aero ? .055 : .03, rw = .028;
      add(kW, new T.Mesh(rimGeo(T, rimR, depth, rw), base.rim)).position.copy(c);
      if (rim) for (const z of [1, -1]) { const m = new T.Mesh(annulus(T, rimR - .001, rimR - .012, .0008, 0), base.track); m.position.set(c.x, c.y, c.z + z*rw*.52); add(kW, m); }
      const tr = new T.Mesh(new T.TorusGeometry(rimR + tireW*.4, tireW/2, 20, 140), base.rubber); tr.scale.set(1, 1, .96); tr.position.copy(c); add(kT, tr);
      cyl(kW, .015, rear ? .118 : .09, base.darkMetal, c.clone(), 28); for (const z of [1, -1]) cyl(kW, .027, .004, base.darkMetal, V(c.x, c.y, c.z + z*(rear ? .03 : .028)), 32);
      cyl(kW, .006, rear ? .142 : .1, base.alu, c.clone(), 16);
      const n = 24, sgeo = new T.CylinderGeometry(.00105, .00105, 1, 6), inst = new T.InstancedMesh(sgeo, matFor(kW, base.spoke), n), mx = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3();
      for (let i = 0; i < n; i++) { const a = i/n*Math.PI*2, z = (i%2 ? 1 : -1)*(rear ? .03 : .028), p1 = V(c.x + .025*Math.cos(a), c.y + .025*Math.sin(a), c.z + z), b2 = a + (i%2 ? .2 : -.2), rr = rimR - depth + .003, p2 = V(c.x + rr*Math.cos(b2), c.y + rr*Math.sin(b2), c.z);
        const dv = p2.clone().sub(p1), L = dv.length(); q.setFromUnitVectors(V(0, 1, 0), dv.normalize()); sc.set(1, L, 1); mx.compose(p1.clone().addScaledVector(dv, L/2), q, sc); inst.setMatrixAt(i, mx); }
      inst.castShadow = true; inst.userData.g = kW; inst.userData.noEdges = true; grp(kW).add(inst);
      if (!rim) { const rr = rear ? .07 : .08, disc = new T.Mesh(annulus(T, rr, rr - .017, .0018, 0, 72), base.steel); disc.position.set(c.x, c.y, c.z - .058); add('rotors', disc);
        const spi = new T.Mesh(toothed(T, 6, .034, .012, .003, 6), base.darkMetal); spi.position.set(c.x, c.y, c.z - .057); add('rotors', spi);
        for (let i = 0; i < 18; i++) { const a = i/18*Math.PI*2, h = new T.Mesh(new T.CylinderGeometry(.0024, .0024, .003, 8), base.darkMetal); h.rotation.x = Math.PI/2; h.position.set(c.x + Math.cos(a)*(rr - .009), c.y + Math.sin(a)*(rr - .009), c.z - .058); add('rotors', h); } }
    }
    wheel('wheelF', 'tireF', FA.clone(), false, (variant?.tireF || (aero ? 26 : 28))/1000 + .0015);
    wheel('wheelR', 'tireR', RA.clone(), true, (variant?.tireR || 28)/1000 + .0015);
    // freins : étriers à disque (flat mount) ou étriers sur jante (patins)
    if (!rim) { box('calipers', .052, .03, .024, base.carbonMatte, V(FA.x - .034, FA.y + .07, -.064), -.9, .006); box('calipers', .052, .03, .024, base.carbonMatte, V(RA.x + .072, RA.y + .03, -.064), .35, .006); }
    else { const cal = (c, ang) => { const p = V(c.x + .306*Math.cos(ang), c.y + .306*Math.sin(ang)), nrm = V(Math.cos(ang), Math.sin(ang));
        for (const z of [1, -1]) { tube('calipers', [p.clone().addScaledVector(nrm, .045).setZ(0), p.clone().addScaledVector(nrm, .04).setZ(.018*z), p.clone().addScaledVector(nrm, .012).setZ(.022*z), p.clone().setZ(.02*z)], .0045, base.darkMetal, false, 16);
          box('calipers', .03, .008, .006, base.pad, p.clone().setZ(.0165*z), ang + Math.PI/2); }
        node('calipers', p.clone().addScaledVector(nrm, .045), .012, .012, .012, base.darkMetal); };
      cal(FA, Math.PI*.58); cal(RA, -Math.PI*.06); }

    /* transmission */
    const TZ = .041, cogR = t => 12.7*t/(2*Math.PI)/1000, sp12 = (variant?.speeds || 12) === 12;
    const cogs = sp12 ? [11, 12, 13, 14, 15, 17, 19, 21, 23, 25, 27, 30] : [11, 12, 13, 14, 15, 17, 19, 21, 23, 25, 28];
    cogs.forEach((t, i) => { const m = new T.Mesh(toothed(T, t, cogR(t), .017, .0017, t > 20 ? 5 : 0), i%2 ? base.steel : base.polished); m.position.set(RA.x, RA.y, .052 - i*(sp12 ? .0031 : .0034)); add('cassette', m); });
    cyl('cassette', .017, .04, base.darkMetal, V(RA.x, RA.y, .035), 20);
    for (const [t, z, mat] of [[52, .046, base.darkMetal], [36, .039, base.steel]]) { const m = new T.Mesh(toothed(T, t, cogR(t), t === 52 ? .052 : .046, .003, 0), mat); m.position.set(BB.x, BB.y, z); add('crank', m); }
    const spider = new T.Mesh(toothed(T, 4, .056, .013, .006, 4), base.carbonMatte); spider.position.set(BB.x, BB.y, .05); spider.rotation.z = .4; add('crank', spider);
    const ca = -1.05;
    for (const z of [1, -1]) { const a = z > 0 ? ca : ca + Math.PI, L = .165; box('crank', L + .022, .024, .013, base.carbonMatte, V(BB.x + Math.cos(a)*L/2, BB.y + Math.sin(a)*L/2, .059*z), a, .006);
      cyl('crank', .0075, .022, base.alu, V(BB.x + Math.cos(a)*L, BB.y + Math.sin(a)*L, .073*z), 14); }
    cyl('crank', .012, .13, base.alu, BB.clone(), 18);
    // dérailleurs : chape, galets dentés, corps
    const J1 = V(RA.x + .004, RA.y - .055, .046), J2 = V(RA.x + .034, RA.y - .132, .046);
    box('rd', .03, .044, .018, base.carbonMatte, V(RA.x - .012, RA.y - .025, .062), .3, .006);
    const cage = J2.clone().sub(J1); box('rd', .022, cage.length() + .032, .004, base.darkMetal, J1.clone().add(J2).multiplyScalar(.5).add(V(0, 0, .01)), Math.atan2(cage.y, cage.x) - Math.PI/2, .0015);
    for (const j of [J1, J2]) { const m = new T.Mesh(toothed(T, 11, .012, .002, .005, 0), base.carbonMatte); m.position.copy(j); add('rd', m); }
    const FDp = BB.clone().addScaledVector(s, .2); box('fd', .058, .024, .02, base.carbonMatte, V(FDp.x + .016, FDp.y, .05), -.2, .006);
    // chaîne : maillons instanciés (plaques + rouleaux) le long du trajet plateau → pignon → galets
    const rB = cogR(52), rC = cogR(17), pts = [];
    for (let a = -90; a <= 90; a += 12) pts.push(V(BB.x + rB*Math.cos(a*Math.PI/180), BB.y + rB*Math.sin(a*Math.PI/180), TZ + .002));
    for (let a = 90; a <= 205; a += 12) pts.push(V(RA.x + rC*Math.cos(a*Math.PI/180), RA.y + rC*Math.sin(a*Math.PI/180), TZ));
    pts.push(V(J1.x - .013, J1.y + .004, TZ), V(J1.x - .006, J1.y - .03, TZ), V(J2.x - .014, J2.y + .004, TZ), V(J2.x - .004, J2.y - .013, TZ), V(J2.x + .012, J2.y - .008, TZ), V(RA.x + .2, BB.y - rB - .006, TZ + .001));
    const curve = new T.CatmullRomCurve3(pts, true, 'centripetal'), N = Math.round(curve.getLength()/.0127);
    const plate = new T.InstancedMesh(roundBox(.0158, .0074, .0011, .0011), matFor('chain', base.steel), N*2), roller = new T.InstancedMesh(new T.CylinderGeometry(.0036, .0036, .0074, 10), matFor('chain', base.polished), N);
    const m4 = new T.Matrix4(), qq = new T.Quaternion(), one = V(1, 1, 1), rq = new T.Quaternion().setFromAxisAngle(V(1, 0, 0), Math.PI/2);
    for (let i = 0; i < N; i++) { const u = i/N, p = curve.getPointAt(u), tg = curve.getTangentAt(u); qq.setFromAxisAngle(V(0, 0, 1), Math.atan2(tg.y, tg.x));
      for (const [j, z] of [[0, 1], [1, -1]]) { m4.compose(V(p.x, p.y, p.z + z*(i%2 ? .0046 : .0036)), qq, one); plate.setMatrixAt(i*2 + j, m4); }
      m4.compose(p, rq, one); roller.setMatrixAt(i, m4); }
    for (const im of [plate, roller]) { im.castShadow = true; im.userData.g = 'chain'; im.userData.noEdges = true; grp('chain').add(im); }

    root.position.set(-.5, 0, 0);
    return { root, groups, len: 1.66 };
  }

  /* ---------- modèle GLB de l'utilisateur ---------- */
  async function buildGLB(T, glb){
    await loadGltf();
    const loader = new T.GLTFLoader();
    if (T.DRACOLoader) { const dr = new T.DRACOLoader(); dr.setDecoderPath(CDN + 'examples/js/libs/draco/gltf/'); loader.setDRACOLoader(dr); }
    const buf = glb.blob ? await glb.blob.arrayBuffer() : await (await fetch(glb.url)).arrayBuffer();
    const gl = await new Promise((ok, ko) => loader.parse(buf, '', ok, e => ko(new Error('modèle illisible : ' + (e?.message || e)))));
    const scene = gl.scene || gl.scenes?.[0]; scene.updateMatrixWorld(true);
    // orientation : beaucoup d'outils exportent en z vers le haut (Blender sans conversion, trimesh…) ; on pose le vélo debout, long selon x,
    // l'avant (fourche, roue avant) vers +x, puis la rotation choisie par l'utilisateur. Hauteur = dimension intermédiaire, largeur = la plus petite.
    const upFix = new T.Group(), holder = new T.Group(); upFix.add(scene); holder.add(upFix);
    const box = () => { holder.updateMatrixWorld(true); return new T.Box3().setFromObject(holder); };
    let bx = box(), sz = bx.getSize(new T.Vector3()); const dims = [sz.x, sz.y, sz.z], order = [0, 1, 2].sort((a, b) => dims[a] - dims[b]), up = order[1];
    if (up === 2) upFix.rotation.x = -Math.PI/2; else if (up === 0) upFix.rotation.z = Math.PI/2;
    const centerOf = rx => { const b = new T.Box3(); let n = 0; holder.updateMatrixWorld(true); scene.traverse(o => { if (o.isMesh && rx.test(clean(o.name || o.parent?.name))) { b.expandByObject(o); n++; } }); return n ? b.getCenter(new T.Vector3()) : null; };
    bx = box(); sz = bx.getSize(new T.Vector3()); if (sz.z > sz.x) holder.rotation.y = Math.PI/2;
    const sad = centerOf(/saddle|selle/i), tir = centerOf(/tire|tyre|pneu|wheel|roue|rim|jante/i);
    if (sad && tir && sad.y < tir.y) { upFix.rotation.x += Math.PI; } // posé à l'envers
    const fr = centerOf(/front|avant|fork|fourche|stem|potence/i), rr = centerOf(/rear|arri|cassette|derail|saddle|selle/i);
    if (fr && rr && fr.x < rr.x) holder.rotation.y += Math.PI;
    holder.rotation.y += (glb.rotY || 0)*Math.PI/180;
    bx = box(); sz = bx.getSize(new T.Vector3());
    holder.scale.setScalar(1.66/Math.max(sz.x, .01)); holder.updateMatrixWorld(true);
    bx = new T.Box3().setFromObject(holder); const c = bx.getCenter(new T.Vector3()); holder.position.set(-c.x, -bx.min.y, -c.z); holder.updateMatrixWorld(true);
    // répartition des objets en composants
    const root = new T.Group(), groups = {}, names = [], map = glb.map || {};
    const grp = key => { if (!groups[key]) { const g = new T.Group(); g.userData.g = key; groups[key] = g; root.add(g); } return groups[key]; };
    const meshes = []; holder.traverse(o => { if (o.isMesh) meshes.push(o); });
    const keyOf = o => { for (let p = o; p && p !== holder; p = p.parent) { if (p.name && map[p.name]) return map[p.name]; const nm = clean(p.name); for (const [key, rx] of NAME_RX) if (nm && rx.test(nm)) return key; } return 'frame'; };
    for (const m of meshes) { if (!m.geometry.attributes.normal) m.geometry.computeVertexNormals(); // fichiers sans normales (trimesh…) : sinon l'éclairage est faux
      const key = keyOf(m); if (m.name && !names.includes(m.name)) names.push(m.name);
      m.material = Array.isArray(m.material) ? m.material.map(x => x.clone()) : m.material.clone();
      for (const x of [].concat(m.material)) if ('envMapIntensity' in x) x.envMapIntensity = .65; /* reflets du studio adoucis : sinon les teintes sombres virent au gris */ m.castShadow = m.receiveShadow = true; m.userData.g = key; grp(key).attach(m); }
    return { root, groups, len: 1.66, names: names.slice(0, 120), glb: true };
  }

  /* ---------- maquette FTP Builder : vélo aéro modélisé (models/velo-aero.js), personnalisable ----------
     Cadre original FTP Builder (aucune marque), géométrie taille M dans le même repère que la maquette procédurale. Les objets du GLB sont
     nommés : chacun rejoint un composant (vue éclatée, zones, témoins d'usure). Jantes, rayons et stickers sont générés ici (hauteur de jante,
     texte, couleurs au choix) ; freins à patins ou à disques et cassette 11 ou 12 vitesses suivent le vélo. Repli : maquette procédurale. */
  const PAINTS = [
    { id: 'stealth', name: 'Noir Stealth', hex: '#16181b', finish: 'mat' }, { id: 'graphite', name: 'Graphite', hex: '#3b3f45', finish: 'mat' },
    { id: 'beton', name: 'Gris Béton', hex: '#8d9195', finish: 'satin' }, { id: 'glacier', name: 'Blanc Glacier', hex: '#eceef0', finish: 'gloss' },
    { id: 'sable', name: 'Sable', hex: '#cbb999', finish: 'mat' }, { id: 'sauge', name: 'Vert Sauge', hex: '#8e9e88', finish: 'mat' },
    { id: 'olive', name: 'Kaki Olive', hex: '#4f583a', finish: 'mat' }, { id: 'foret', name: 'Vert Forêt', hex: '#1f3e2f', finish: 'gloss' },
    { id: 'nuit', name: 'Bleu Nuit', hex: '#1b2742', finish: 'metal' }, { id: 'ciel', name: 'Bleu Glacier', hex: '#a7c8d8', finish: 'gloss' },
    { id: 'petrole', name: 'Pétrole', hex: '#1f5862', finish: 'metal' }, { id: 'bordeaux', name: 'Bordeaux', hex: '#5c1424', finish: 'metal' },
    { id: 'volcan', name: 'Orange Volcan', hex: '#ff5b1f', finish: 'gloss' }, { id: 'fluo', name: 'Jaune Fluo', hex: '#d9f23c', finish: 'gloss' },
    { id: 'lavande', name: 'Lavande', hex: '#aa9ed2', finish: 'mat' },
    { id: 'cameleon', name: 'Caméléon', hex: '#2b1e58', finish: 'metal', irid: true, sw: 'conic-gradient(from 210deg,#2b1e58,#3a5fb8,#1d8a86,#7e3a9e,#2b1e58)' },
    // peinture à effet (flip-flop) : rose magenta face au regard, or puis vert olive quand la surface fuit ou regarde vers le haut ; sticker holographique par défaut
    { id: 'scarabee', name: 'Scarabée', hex: '#a8155a', finish: 'metal', flip: ['#a8155a', '#c79a35', '#4f6e2c'], ink: 'holo', sw: 'conic-gradient(from 200deg,#a8155a,#c79a35,#4f6e2c,#a8155a)' },
  ];
  const FINISHES = { mat: { l: 'Mat', rough: .6, metal: 0, cc: 0, ccr: .6 }, satin: { l: 'Satiné', rough: .42, metal: 0, cc: .45, ccr: .32 },
    gloss: { l: 'Brillant', rough: .3, metal: 0, cc: 1, ccr: .03 }, metal: { l: 'Métallisé', rough: .34, metal: .62, cc: 1, ccr: .04 } };
  const INKS = [{ id: 'auto', name: 'Auto' }, { id: 'blanc', name: 'Blanc', hex: '#f4f4f2' }, { id: 'noir', name: 'Noir', hex: '#121314' }, { id: 'argent', name: 'Argent', hex: '#d6d9de', metal: true },
    { id: 'or', name: 'Or', hex: '#e7bd62', metal: true }, { id: 'ton', name: 'Ton sur ton' }, { id: 'rouge', name: 'Rouge', hex: '#e2322c' }, { id: 'fluo', name: 'Fluo', hex: '#d8ff31' },
    { id: 'holo', name: 'Holo', hex: '#eef0f6', metal: true, irid: true }];
  const FONTS = { sport: { l: 'Sport', fam: 'FTPB Sport', style: 'italic', w: 800, track: .035 }, tech: { l: 'Tech', fam: 'FTPB Tech', style: 'normal', w: 800, track: .1 },
    bloc: { l: 'Bloc', fam: 'FTPB Bloc', style: 'normal', w: 400, track: .01 }, script: { l: 'Script', fam: 'FTPB Script', style: 'normal', w: 400, track: 0 } };
  const RIMS = [35, 45, 50, 62, 80];
  const LOOK0 = { paint: 'graphite', finish: null, custom: null, name: 'FTP builder', font: 'sport', ink: 'auto', rim: null, wall: 'noir' };
  const lookOf = (l, model) => { const x = { ...LOOK0, ...(l || {}) }; if (!RIMS.includes(+x.rim)) x.rim = model === 'road' ? 35 : 50; x.rim = +x.rim; if (!PAINTS.some(p => p.id === x.paint)) x.paint = LOOK0.paint;
    if (!FONTS[x.font]) x.font = 'sport'; if (!INKS.some(i => i.id === x.ink)) x.ink = 'auto'; if (typeof x.name !== 'string') x.name = LOOK0.name; return x; };
  // objet du GLB → composant
  const FTP_G = {};
  for (const [k, ns] of Object.entries({ frame: 'Frame_Paint Bottle_Bolts Decal_DownTube_R Decal_DownTube_L Decal_HeadTube', fork: 'Fork_Paint Decal_Fork_R Decal_Fork_L',
    seatpost: 'Seatpost_Paint Seat_Clamp', saddle: 'Saddle_Cover Saddle_Rails', cockpit: 'Cockpit_Carbon Bartape_R Bartape_L BarEnd_R BarEnd_L', levers: 'Hood_R Hood_L Lever_R Lever_L',
    crank: 'Crank_R Crank_L Crank_Bolts Chainring_Big Chainring_Small', chain: 'Chain_Outer Chain_Inner Chain_Rollers', fd: 'FD', rd: 'RD_Hanger RD_Body RD_Cage RD_Bolts RD_Pulleys RD_PulleyHubs',
    calipers: 'Caliper_F Caliper_F_Bolts Caliper_R Caliper_R_Bolts RimBrake_F RimBrake_F_Pads RimBrake_F_Shoes RimBrake_R RimBrake_R_Pads RimBrake_R_Shoes',
    rotors: 'Rotor_F_Band Rotor_F_Spider Rotor_F_Rivets Rotor_R_Band Rotor_R_Spider Rotor_R_Rivets', wheelF: 'Hub_F Lockring_F Axle_F', wheelR: 'Hub_R Lockring_R Axle_R',
    tireF: 'Tyre_F_Tread Tyre_F_Wall_R Tyre_F_Wall_L', tireR: 'Tyre_R_Tread Tyre_R_Wall_R Tyre_R_Wall_L', cassette: 'Cassette_Cogs Cassette_Cogs_11 Cassette_Core' })) for (const n of ns.split(' ')) FTP_G[n] = k;
  const b64 = s => { const bin = atob(s), n = bin.length, u = new Uint8Array(n); for (let i = 0; i < n; i++) u[i] = bin.charCodeAt(i); return u; };
  let ftpGl = null;
  const loadFtp = () => ftpGl ||= (async () => {
    await loadGltf();
    if (!window.MeshoptDecoder) await script(CDN + 'examples/js/libs/meshopt_decoder.js');
    if (!window.FTPB_BIKE) await script('models/velo-aero.js?v=' + (typeof APP_VERSION === 'string' ? APP_VERSION : '0'));
    const d = window.FTPB_BIKE; if (!d?.glb) throw new Error('maquette absente');
    for (const [k, f] of Object.entries(FONTS)) if (d.fonts?.[k] && !f.ok) { try { const ff = new FontFace(f.fam, b64(d.fonts[k]).buffer, { style: f.style, weight: String(f.w) }); await ff.load(); document.fonts.add(ff); f.ok = true; } catch (e) { /* police par défaut */ } }
    await MeshoptDecoder.ready;
    const loader = new THREE.GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
    const gl = await new Promise((ok, ko) => loader.parse(b64(d.glb).buffer, '', ok, e => ko(new Error('maquette illisible : ' + (e?.message || e)))));
    // occultation ambiante précalculée (COLOR_0 du GLB) : attribut à part, pour qu'elle n'agisse que sur l'éclairage indirect
    gl.scene.traverse(o => { const a = o.geometry?.attributes?.color; if (a) { o.geometry.setAttribute('bakeAO', a); o.geometry.deleteAttribute('color'); } });
    return gl;
  })().catch(e => { ftpGl = null; throw e; });
  function withAO(m){
    m.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 bakeAO;\nvarying float vBakeAO;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvBakeAO = bakeAO.r;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vBakeAO;').replace('#include <aomap_fragment>', `#include <aomap_fragment>
        { float bao = clamp(vBakeAO, 0.0, 1.0); reflectedLight.indirectDiffuse *= bao; reflectedLight.indirectSpecular *= mix(1.0, bao, 0.8);
          reflectedLight.directDiffuse *= mix(0.55, 1.0, bao); reflectedLight.directSpecular *= mix(0.55, 1.0, bao); }`);
    };
    m.customProgramCacheKey = () => 'ftpbAO'; return m;
  }
  // peinture à effet : la teinte glisse de C0 (surface face au regard) à C1 puis C2 (surface rasante ou tournée vers le haut), comme une peinture caméléon
  function withFlip(m){
    const U = m.userData.flip = { ftpbC0: { value: new THREE.Color() }, ftpbC1: { value: new THREE.Color() }, ftpbC2: { value: new THREE.Color() }, ftpbFlip: { value: 0 } }, ao = m.onBeforeCompile;
    m.onBeforeCompile = sh => { ao(sh); Object.assign(sh.uniforms, U);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 ftpbC0; uniform vec3 ftpbC1; uniform vec3 ftpbC2; uniform float ftpbFlip;')
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        if (ftpbFlip > 0.0) { float fv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0); vec3 wn = inverseTransformDirection(normal, viewMatrix);
          float ft = clamp((1.0 - fv)*1.7 + max(wn.y, 0.0)*0.8, 0.0, 1.0);
          vec3 fc = ft < 0.42 ? mix(ftpbC0, ftpbC1, smoothstep(0.08, 0.42, ft)) : mix(ftpbC1, ftpbC2, smoothstep(0.62, 0.98, ft));
          diffuseColor.rgb = mix(diffuseColor.rgb, fc, ftpbFlip); }`); };
    m.customProgramCacheKey = () => 'ftpbAOflip'; return m;
  }
  // jante profilée (révolution autour de z), rayons droits, valve
  const R_TOP = .3152, HOOK_IN = .0116, W_TOP = .0146;
  const sstep = (e0, e1, x) => { const t = clamp((x - e0)/(e1 - e0), 0, 1); return t*t*(3 - 2*t); };
  function rimHalf(s, D){ const body = W_TOP + .0012*Math.sin(Math.PI*.5*Math.min(s/.42, 1)) - .0027*sstep(.42, 1, s), noseR = Math.min(.0118, D*.34), sn = 1 - noseR/D;
    if (s > sn) { const t = (s - sn)/(1 - sn); return body*Math.sqrt(Math.max(0, 1 - t*t)); } return body; }
  function rimProfile(D){ const right = [[R_TOP - .0007, HOOK_IN], [R_TOP - .0001, HOOK_IN + .0004], [R_TOP + .00015, HOOK_IN + .0015], [R_TOP - .0001, W_TOP - .0004], [R_TOP - .0008, W_TOP]];
    for (let i = 1; i <= 24; i++) { const s = Math.pow(i/24, .92); right.push([R_TOP - .0008 - s*(D - .0008), i === 24 ? 0 : rimHalf(s, D)]); }
    const left = right.slice(0, -1).reverse().map(([r, z]) => [r, -z]);
    return [...right, ...left, [R_TOP - .0025, -HOOK_IN + .0006], [R_TOP - .004, -.006], [R_TOP - .0062, 0], [R_TOP - .004, .006], [R_TOP - .0025, HOOK_IN - .0006], [R_TOP - .0007, HOOK_IN]]; }
  function latheGeo(T, pts, seg, { uScale = 1, flipU = false, vVals = null, closed = false, offset = 0 } = {}){
    const k = pts.length, nrm = [], pos = [], nor = [], uv = [], idx = [], L = [0];
    for (let i = 0; i < k; i++) { let a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, k - 1)]; if (closed) { a = pts[(i - 1 + k)%k]; b = pts[(i + 1)%k]; }
      const tr = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(tr, tz) || 1; nrm.push([tz/l, -tr/l]); }
    for (let i = 1; i < k; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    for (let j = 0; j <= seg; j++) { const th = j/seg*Math.PI*2, c = Math.cos(th), s = Math.sin(th);
      for (let i = 0; i < k; i++) { const [r0, z0] = pts[i], [nr, nz] = nrm[i], r = r0 + nr*offset, z = z0 + nz*offset; pos.push(r*c, r*s, z); nor.push(nr*c, nr*s, nz);
        const u = j/seg*uScale; uv.push(flipU ? uScale - u : u, vVals ? vVals[i] : L[i]/L[k - 1]); } }
    for (let j = 0; j < seg; j++) for (let i = 0; i < k - 1; i++) { const a = j*k + i, b = (j + 1)*k + i; idx.push(a, b + 1, b, a, a + 1, b + 1); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    return wind(T, g); }
  function wind(T, g){ // faces orientées comme les normales
    const p = g.attributes.position, n = g.attributes.normal, I = g.index.array, A = new T.Vector3(), B = new T.Vector3(), C = new T.Vector3(), N = new T.Vector3(); let ok = 0, tot = 0;
    for (let t = 0; t < I.length; t += 3*37) { A.fromBufferAttribute(p, I[t]); B.fromBufferAttribute(p, I[t + 1]); C.fromBufferAttribute(p, I[t + 2]); N.fromBufferAttribute(n, I[t]);
      const f = B.sub(A).cross(C.sub(A)); if (f.lengthSq() < 1e-20) continue; tot++; if (f.dot(N) > 0) ok++; }
    if (ok < tot/2) { for (let t = 0; t < I.length; t += 3) { const x = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = x; } g.index.needsUpdate = true; } return g; }
  function spokesGeo(T, hub, D, front){
    const rNip = R_TOP - D + .0055, pos = [], nor = [], idx = [], total = hub.flanges.reduce((a, f) => a + f.n, 0), hubStep = 2*Math.PI/(total/2), Zv = new T.Vector3(0, 0, 1);
    for (let i = 0; i < total; i++) { const side = i%2, fl = hub.flanges[side ? 0 : 1], thR = i/total*2*Math.PI + (front ? 0 : .06), dir = Math.floor(i/2)%2 ? 1 : -1, thH = thR - dir*hubStep;
      const P = new T.Vector3(fl.r*Math.cos(thH), fl.r*Math.sin(thH), fl.z), Q = new T.Vector3(rNip*Math.cos(thR), rNip*Math.sin(thR), side ? -.0022 : .0022);
      const d = Q.clone().sub(P).normalize(), wa = d.clone().cross(Zv).normalize(), ta = wa.clone().cross(d).normalize(), hw = .00115, ht = .00042, cs = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
      for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0]]) { const off = pos.length/3, ca = cs[a], cb = cs[b];
        const n = wa.clone().multiplyScalar((ca[0] + cb[0])/2*ht).add(ta.clone().multiplyScalar((ca[1] + cb[1])/2*hw)).normalize();
        for (const E of [P, Q]) for (const c of [ca, cb]) { const v = E.clone().addScaledVector(wa, c[0]*hw).addScaledVector(ta, c[1]*ht); pos.push(v.x, v.y, v.z); nor.push(n.x, n.y, n.z); }
        idx.push(off, off + 1, off + 3, off, off + 3, off + 2); } }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); g.setIndex(idx); return wind(T, g); }
  // textes des stickers : taille réglée sur l'encombrement réel des lettres, pour que chaque style remplisse le tube de la même façon
  const setFont = (x, F, px) => { x.font = `${F.style} ${F.w} ${px}px "${F.fam}", "Arial Black", sans-serif`; if ('letterSpacing' in x) x.letterSpacing = `${(F.track*px).toFixed(1)}px`; };
  function fitText(x, txt, F, maxW, maxH){ setFont(x, F, 100); const m = x.measureText(txt), w = (m.actualBoundingBoxLeft + m.actualBoundingBoxRight) || m.width || 1, h = (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) || 75; setFont(x, F, 100*Math.min(maxW/w, maxH/h)); }
  function drawCentered(x, txt, cx, cy){ x.textAlign = 'left'; x.textBaseline = 'alphabetic'; const m = x.measureText(txt), w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight; x.fillText(txt, cx - w/2 + m.actualBoundingBoxLeft, cy + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent)/2); }
  const initials = s => { const w = String(s || '').trim().split(/\s+/).filter(Boolean); return !w.length ? 'FTP' : w[0].length <= 4 ? w[0].toUpperCase() : w.slice(0, 3).map(x => x[0]).join('').toUpperCase(); };
  const lin = (T, hex) => new T.Color(hex).convertSRGBToLinear();

  async function buildFTP(T, opts){
    const gl = await loadFtp(), V = opts.variant || {}, rimBrake = V.brakes === 'rim', s11 = +V.speeds === 11;
    const scene = gl.scene.clone(true), meta = gl.scene.userData || {}; scene.updateMatrixWorld(true);
    const skip = n => (rimBrake ? /^(Rotor_|Caliper_|Lockring_)/.test(n) : /^RimBrake_/.test(n)) || n === (s11 ? 'Cassette_Cogs' : 'Cassette_Cogs_11');
    const root = new T.Group(), groups = {}, grp = k => { if (!groups[k]) { const g = new T.Group(); g.userData.g = k; groups[k] = g; root.add(g); } return groups[k]; };
    const cv = (w, h, rep = 1) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 8;
      if (rep > 1) { t.wrapS = T.RepeatWrapping; t.repeat.set(rep, 1); } return { c, x: c.getContext('2d'), t }; };
    const dc = meta.decals || {}, cvs = { down: cv(2048, Math.round(2048*(dc.downtube?.height || .055)/(dc.downtube?.length || .5))), fork: cv(1024, Math.round(1024*(dc.fork?.height || .03)/(dc.fork?.length || .2))),
      head: cv(256, Math.round(256*(dc.headtube?.height || .09)/(dc.headtube?.width || .037))), rim: cv(1024, 64, 2), wall: cv(1024, 48, 2) };
    const ph = (o, ao = true) => { const m = new T.MeshPhysicalMaterial({ envMapIntensity: .95, ...o }); for (const k of ['color', 'sheenColor']) if (o[k] != null) m[k] = lin(T, o[k]); return ao ? withAO(m) : m; };
    const KIND = { // matériaux du GLB → rendu (une instance par composant : l'estompage du mode ingénieur agit composant par composant)
      Paint_Frame: () => ph({ color: '#3b3f45', roughness: .6 }), Carbon_Black: () => ph({ color: '#0c0c0d', roughness: .42, clearcoat: .35, clearcoatRoughness: .35 }),
      Rubber_Hood: () => ph({ color: '#0d0d0e', roughness: .82 }), Bar_Tape: () => ph({ color: '#111112', roughness: .78, sheen: .4, sheenRoughness: .6, sheenColor: '#333333' }),
      Saddle_Cover: () => ph({ color: '#0f0f10', roughness: .62, sheen: .35, sheenRoughness: .5, sheenColor: '#2a2a2a' }), Saddle_Rails: () => ph({ color: '#1a1a1c', roughness: .3, metalness: .4, clearcoat: .6 }),
      Tyre_Tread: () => ph({ color: '#151515', roughness: .74 }), Tyre_Wall: () => ph({ map: cvs.wall.t, roughness: .76 }), Metal_Silver: () => ph({ color: '#c9cbcf', roughness: .26, metalness: 1 }),
      Metal_Steel: () => ph({ color: '#9a9da3', roughness: .34, metalness: 1 }), Metal_Dark: () => ph({ color: '#2a2b2f', roughness: .34, metalness: .9 }),
      Anodized_Black: () => ph({ color: '#0e0e10', roughness: .36, metalness: .55, clearcoat: .3, clearcoatRoughness: .3 }), Brake_Pad: () => ph({ color: '#3a221a', roughness: .85 }) };
    const decalMat = t => ph({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8, roughness: .32, clearcoat: .7, clearcoatRoughness: .08, alphaTest: .02 }, false);
    const DECAL = { Decal_DownTube_R: cvs.down, Decal_DownTube_L: cvs.down, Decal_Fork_R: cvs.fork, Decal_Fork_L: cvs.fork, Decal_HeadTube: cvs.head };
    const mats = {}, paints = [], decals = [], walls = [];
    const matFor = (k, kind) => { const id = k + ':' + kind; if (mats[id]) return mats[id];
      const m = mats[id] = DECAL[kind] ? decalMat(DECAL[kind].t) : (KIND[kind] || KIND.Anodized_Black)(); m.name = kind;
      if (kind === 'Paint_Frame') paints.push(withFlip(m)); else if (DECAL[kind]) decals.push(m); else if (kind === 'Tyre_Wall') walls.push(m); return m; };
    const nameOf = o => { for (let p = o; p; p = p.parent) if (FTP_G[p.name]) return p.name; return null; };
    const tw = { F: clamp((+V.tireF || 28)/28, .93, 1.15), R: clamp((+V.tireR || 28)/28, .93, 1.15) };
    const meshes = []; scene.traverse(o => { if (o.isMesh) meshes.push(o); });
    const SCULPT = /^(Frame_Paint|Fork_Paint|Seatpost_Paint|Seat_Clamp|Saddle_|Cockpit_Carbon|Bartape_|Hood_|Lever_|Crank_|RD_Hanger|RD_Body|RD_Cage|RD_Bolts|FD|Caliper_|RimBrake_|Decal_|Tyre_)/;
    for (const m of meshes) { const n = nameOf(m); if (!n || skip(n)) continue; const k = FTP_G[n]; m.userData.part = n; if (SCULPT.test(n)) m.userData.noEdges = true;
      m.material = matFor(k, DECAL[n] ? n : m.material?.name); m.userData.g = k; m.castShadow = !DECAL[n]; m.receiveShadow = true; if (DECAL[n]) m.renderOrder = 2;
      grp(k).attach(m); if (k === 'tireF' || k === 'tireR') { const f = tw[k === 'tireF' ? 'F' : 'R']; m.position.z *= f; m.scale.z *= f; } }
    // jantes, rayons, valves (hauteur de jante au choix) et piste de freinage pour les patins
    const D = lookOf(opts.look, opts.model).rim/1000, AF = meta.axle_f || [.9919, .3395, 0], AR = meta.axle_r || [0, .3395, 0], HUB = meta.hub || {};
    const rimMat = ph({ color: '#0b0b0c', roughness: .36, clearcoat: .45, clearcoatRoughness: .22 }, false), spokeMat = ph({ color: '#18181a', roughness: .32, metalness: .7 }, false);
    const trackMat = ph({ color: '#202023', roughness: .72, metalness: .15 }, false), rimDecal = decalMat(cvs.rim.t); rimDecal.polygonOffsetFactor = -2; decals.push(rimDecal);
    const valveMat = ph({ color: '#c9cbcf', roughness: .26, metalness: 1 }, false), capMat = ph({ color: '#0e0e10', roughness: .36, metalness: .55 }, false);
    for (const [k, A, front] of [['wheelF', AF, true], ['wheelR', AR, false]]) {
      const w = new T.Group(); w.position.set(A[0], A[1], A[2] || 0); w.userData.g = k;
      const add = (geo, mat, ro = 0) => { const m = new T.Mesh(geo, mat); m.userData.g = k; m.castShadow = true; m.receiveShadow = true; m.renderOrder = ro; w.add(m); return m; };
      add(latheGeo(T, rimProfile(D), 128, { closed: true }), rimMat);
      const band = (s0, s1, off, mat, ro, flipV) => { const n = 10, pr = [], vv = []; for (let i = 0; i <= n; i++) { const s = s0 + (s1 - s0)*i/n; pr.push([R_TOP - .0008 - s*(D - .0008), rimHalf(s, D)]); vv.push(flipV ? 1 - i/n : i/n); }
        add(latheGeo(T, pr, 128, { flipU: true, vVals: vv, offset: off }), mat, ro).userData.noEdges = true; add(latheGeo(T, pr.map(([r, z]) => [r, -z]).reverse(), 128, { vVals: vv.slice().reverse(), offset: off }), mat, ro).userData.noEdges = true; };
      if (rimBrake) band(.012, Math.min(.42, .0135/D), .00012, trackMat, 1, false);
      band(rimBrake ? Math.min(.5, .016/D) : .16, .86, .00022, rimDecal, 2, true);
      add(spokesGeo(T, HUB[front ? 'front' : 'rear'] || { flanges: [{ z: -.03, r: .0205, n: 12 }, { z: .03, r: .0205, n: 12 }] }, D, front), spokeMat).userData.noEdges = true;
      const vg = new T.Group(), rIn = R_TOP - D, vb = new T.Mesh(new T.CylinderGeometry(.0026, .0026, .016, 16), valveMat), vc = new T.Mesh(new T.CylinderGeometry(.0034, .0034, .009, 16), capMat);
      vb.position.y = rIn - .004; vc.position.y = rIn - .013; for (const m of [vb, vc]) { m.userData.g = k; m.castShadow = true; vg.add(m); } vg.rotation.z = -Math.PI*.62; w.add(vg);
      grp(k).add(w); }
    // pièces internes, visibles en éclaté : roulements de direction, boîtier de pédalier, batterie Di2 (dans la tige de selle)
    const BB = new T.Vector3(...(meta.bb || [.4036, .2675, 0])), HT = new T.Vector3(...(meta.ht_top || [.7956, .8275, 0])), HA = 73*Math.PI/180, SA = 73.5*Math.PI/180;
    const dn = new T.Vector3(Math.cos(HA), -Math.sin(HA), 0), sd = new T.Vector3(-Math.cos(SA), Math.sin(SA), 0), HB = HT.clone().addScaledVector(dn, .15);
    const polished = ph({ color: '#9aa1aa', roughness: .12, metalness: 1 }, false), dark = ph({ color: '#2c2f35', roughness: .32, metalness: .85 }, false), batt = ph({ color: '#1f6feb', roughness: .35, metalness: .3 }, false);
    const extra = (k, geo, mat, pos, q) => { const m = new T.Mesh(geo, mat); m.position.copy(pos); if (q) m.quaternion.copy(q); m.userData.g = k; m.castShadow = true; grp(k).add(m); grp(k).userData.hideAssembled = true; return m; };
    const qd = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), dn);
    for (const p of [HT.clone().addScaledVector(dn, .008), HB.clone().addScaledVector(dn, -.008)]) extra('headset', new T.TorusGeometry(.0175, .0052, 12, 40), polished, p, qd);
    extra('bb', new T.CylinderGeometry(.0205, .0205, .088, 32), polished, BB, new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), Math.PI/2));
    for (const z of [1, -1]) extra('bb', new T.CylinderGeometry(.023, .023, .006, 32), dark, BB.clone().add(new T.Vector3(0, 0, .044*z)), new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), Math.PI/2));
    extra('battery', new T.CylinderGeometry(.011, .011, .12, 20), batt, BB.clone().addScaledVector(sd, .49), new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), sd));
    root.position.set(-.5, 0, 0);

    // apparence (couleur, finition, sticker, flancs) : modifiable sans reconstruire la scène
    let cur = null;
    const ft = { look: null, set(look){ const L = lookOf(look, opts.model), sig = JSON.stringify(L); if (sig === cur) return false; cur = sig; ft.look = L;
      const P = PAINTS.find(p => p.id === L.paint) || PAINTS[1], hex = L.custom || P.hex, F = FINISHES[L.finish] || FINISHES[P.finish] || FINISHES.mat, pc = lin(T, hex);
      const flip = !L.custom && P.flip;
      for (const m of paints) { m.color.copy(pc); m.roughness = F.rough; m.metalness = F.metal; m.clearcoat = F.cc; m.clearcoatRoughness = F.ccr; m.iridescence = P.irid && !L.custom ? 1 : 0; m.iridescenceIOR = 1.75; m.iridescenceThicknessRange = [260, 820];
        const U = m.userData.flip; if (U) { U.ftpbFlip.value = flip ? 1 : 0; if (flip) [U.ftpbC0, U.ftpbC1, U.ftpbC2].forEach((u, i) => u.value.copy(lin(T, P.flip[i]))); } m.needsUpdate = true; }
      const lum = .2126*pc.r + .7152*pc.g + .0722*pc.b, ink = INKS.find(i => i.id === L.ink) || INKS[0], auto = !L.custom && P.ink ? INKS.find(i => i.id === P.ink) : null;
      const spec = ink.id === 'auto' ? auto || { hex: lum > .32 ? '#141414' : '#f4f4f2' } : ink.id === 'ton' ? { hex, gloss: true, tone: true } : ink;
      for (const m of decals) { const onRim = m === rimDecal, s2 = onRim ? (ink.id === 'auto' ? auto || { hex: '#e9e9e9' } : ink.id === 'ton' || ink.id === 'noir' ? { hex: '#2b2b2d', gloss: true } : ink) : spec;
        m.color.copy(lin(T, s2.hex)); if (s2.tone) m.color.offsetHSL(0, 0, lum > .3 ? -.06 : .05); m.metalness = s2.metal ? .75 : 0; m.roughness = s2.metal ? .26 : s2.gloss ? .12 : .34;
        m.iridescence = s2.irid ? 1 : 0; m.iridescenceIOR = 1.9; m.iridescenceThicknessRange = [200, 900]; m.needsUpdate = true; }
      const name = L.name.trim() || 'FTP builder', Fo = FONTS[L.font] || FONTS.sport, Fb = L.font === 'script' ? FONTS.bloc : Fo;
      { const { c, x, t } = cvs.down; x.clearRect(0, 0, c.width, c.height); x.fillStyle = '#fff'; fitText(x, name, Fo, c.width*.84, c.height*(L.font === 'script' ? .8 : .66)); drawCentered(x, name, c.width/2, c.height*.52); t.needsUpdate = true; }
      { const { c, x, t } = cvs.fork; x.clearRect(0, 0, c.width, c.height); x.fillStyle = '#fff'; fitText(x, name, Fo, c.width*.8, c.height*(L.font === 'script' ? .62 : .48)); drawCentered(x, name, c.width/2, c.height*.52); t.needsUpdate = true; }
      { const { c, x, t } = cvs.head, W = c.width, cx = W/2, cy = c.height*.4, R = W*.43; x.clearRect(0, 0, W, c.height); x.strokeStyle = x.fillStyle = '#fff'; x.lineWidth = W*.055; x.lineJoin = 'round'; x.beginPath();
        for (let i = 0; i < 6; i++) { const a = -Math.PI/2 + i*Math.PI/3, px = cx + R*Math.cos(a), py = cy + R*1.18*Math.sin(a); i ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath(); x.stroke();
        fitText(x, initials(name), Fb, R*1.15, R*.62); drawCentered(x, initials(name), cx, cy + R*.02); x.lineWidth = W*.045;
        for (let j = 0; j < 2; j++) { const y = cy + R*1.55 + j*W*.13; x.beginPath(); x.moveTo(cx - W*.2, y); x.lineTo(cx, y + W*.08); x.lineTo(cx + W*.2, y); x.stroke(); } t.needsUpdate = true; }
      { const { c, x, t } = cvs.rim, H = c.height, ini = initials(name); x.clearRect(0, 0, c.width, H); x.fillStyle = '#fff'; x.textBaseline = 'middle'; x.textAlign = 'left';
        setFont(x, Fb, H*.62*(Fb === FONTS.tech ? .8 : 1.05)); let px = c.width*.06; x.fillText(ini, px, H*.53); px += x.measureText(ini).width + H*.35; x.fillRect(px, H*.24, H*.05, H*.56); px += H*.4;
        setFont(x, FONTS.tech, H*.26); x.fillText(`AERO ${L.rim}`, px, H*.4); setFont(x, FONTS.tech, H*.17); x.globalAlpha = .75; x.fillText(rimBrake ? 'CARBON  RIM  BRAKE' : 'CARBON  DISC  TLR', px, H*.7); x.globalAlpha = 1; t.needsUpdate = true; }
      { const { c, x, t } = cvs.wall, W = c.width, H = c.height, tan = L.wall === 'beige'; x.fillStyle = tan ? '#ae8a5e' : '#161616'; x.fillRect(0, 0, W, H); x.globalAlpha = tan ? .12 : .18; x.fillStyle = tan ? '#7d5d3a' : '#262626';
        for (let y = 4; y < H; y += 7) x.fillRect(0, y, W, 1); x.globalAlpha = 1; x.fillStyle = tan ? '#6e5032' : '#3a3a3a'; x.textBaseline = 'middle'; x.textAlign = 'left'; setFont(x, FONTS.bloc, H*.4); x.fillText('FTP RACE', W*.08, H*.52);
        setFont(x, FONTS.tech, H*.2); x.fillText(`700 × ${V.tireR || 28}C   ·   TUBELESS READY   ·   4–6 BAR`, W*.33, H*.5); t.needsUpdate = true; for (const m of walls) m.roughness = tan ? .82 : .76; }
      return true; },
      dispose(){ for (const k in cvs) cvs[k].t.dispose(); } };
    ft.set(opts.look);
    return { root, groups, len: 1.66, ft };
  }

  /* ---------- scène, lumière, sol ---------- */
  function studio(T, r){
    const pm = new T.PMREMGenerator(r);
    if (T.RoomEnvironment) { const env = pm.fromScene(new T.RoomEnvironment(), .035).texture; pm.dispose(); return env; }
    const sc = new T.Scene(); sc.add(new T.Mesh(new T.BoxGeometry(10, 10, 10), new T.MeshBasicMaterial({ color: 0x17181b, side: T.BackSide })));
    const light = (w, h, pos, c = 0xffffff) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: c, side: T.DoubleSide })); m.position.copy(pos); m.lookAt(0, 0, 0); sc.add(m); };
    light(6, 2, new T.Vector3(0, 4.9, 0)); light(3, 3, new T.Vector3(4.9, 1, 2), 0xd8e2ff); light(3, 3, new T.Vector3(-4.9, 1.5, -2), 0xfff1dc);
    const env = pm.fromScene(sc, .03).texture; pm.dispose(); return env;
  }
  function contactTex(T){ const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d');
    const g = x.createRadialGradient(256, 64, 6, 256, 64, 256); g.addColorStop(0, 'rgba(0,0,0,.6)'); g.addColorStop(.45, 'rgba(0,0,0,.22)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 512, 128); return new T.CanvasTexture(c); }

  async function setup(opts){
    const T = THREE, b = opts.glb ? await buildGLB(T, opts.glb) : await buildFTP(T, opts).catch(e => { console.warn('maquette FTP indisponible, maquette générique :', e?.message || e); return buildProc(T, opts.model, opts.variant); });
    const r = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: !!navigator.webdriver });
    r.setPixelRatio(navigator.webdriver ? 1 : Math.min(devicePixelRatio || 1, 2)); r.outputEncoding = T.sRGBEncoding; r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.12; r.setClearColor(0, 0);
    r.shadowMap.enabled = !navigator.webdriver; r.shadowMap.type = T.PCFSoftShadowMap; // tests : rendu logiciel, sans la passe d'ombres
    const scene = new T.Scene(); scene.environment = studio(T, r);
    const hemi = new T.HemisphereLight(0xffffff, 0x2a2e36, .35); scene.add(hemi);
    const key = new T.DirectionalLight(0xffffff, 2); key.position.set(1.2, 3.2, 1.8); key.castShadow = true; key.shadow.mapSize.setScalar(navigator.webdriver ? 512 : 2048); key.shadow.bias = -.0004; key.shadow.normalBias = .01;
    Object.assign(key.shadow.camera, { left: -1.6, right: 1.6, top: 1.6, bottom: -1.6, near: .5, far: 8 }); scene.add(key);
    const rim = new T.DirectionalLight(0xc8d8ff, .9); rim.position.set(-2.2, 1.6, -2.4); scene.add(rim);
    const fill = new T.DirectionalLight(0xffe9d6, .35); fill.position.set(-1, .6, 2.5); scene.add(fill);
    // maquette FTP : couleurs de peinture fidèles à leur nom (ACES de r147 multiplie l'exposition par 1/0,6) — lumières directes douces, reflets du studio
    if (b.ft) { r.toneMappingExposure = .66; key.intensity = .6; rim.intensity = .32; fill.intensity = .12; hemi.intensity = .12; }
    const ground = new T.Mesh(new T.PlaneGeometry(8, 8), new T.ShadowMaterial({ opacity: .28 })); ground.rotation.x = -Math.PI/2; ground.receiveShadow = true; scene.add(ground);
    const contact = new T.Mesh(new T.PlaneGeometry(1.9, .55), new T.MeshBasicMaterial({ map: contactTex(T), transparent: true, depthWrite: false })); contact.rotation.x = -Math.PI/2; contact.position.y = .001; scene.add(contact);
    const cam = new T.PerspectiveCamera(30, 1.3, .05, 40);
    const ctl = new T.OrbitControls(cam, r.domElement); Object.assign(ctl, { enableDamping: true, dampingFactor: .085, enablePan: true, screenSpacePanning: true, panSpeed: .6, minDistance: .6, maxDistance: 9,
      minPolarAngle: .02, maxPolarAngle: Math.PI - .02, rotateSpeed: .75, zoomSpeed: .8, autoRotateSpeed: .55 });
    ctl.addEventListener('start', () => { idleNow(); ctl.autoRotate = false; st.intro = null; st.focus = null; wake(); }); // le doigt reprend la main sur un recadrage en cours
    ctl.addEventListener('end', () => { idleNow(); wake(1200); });
    scene.add(b.root);
    for (const [k, g] of Object.entries(b.groups)) { const o = OFF[k] || [0, 0, 0]; g.userData.off = new T.Vector3(...o); g.userData.center = new T.Box3().setFromObject(g).getCenter(new T.Vector3()).sub(b.root.position);
      g.userData.mats = []; g.traverse(m => { if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach(x => { x.userData.op0 = x.opacity; x.userData.tr0 = x.transparent; g.userData.mats.push(x); }); }); }
    R = { r, scene, cam, ctl, key: opts.key, ...b, edges: null, w: 0, h: 0 };
    const cv = r.domElement; cv.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;outline:none';
    let down = null;
    cv.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; wake(); });
    cv.addEventListener('pointerup', e => { if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t; down = null; if (moved > 7 || dt > 600) return; tap(e); });
    home(true); if (!st.introDone && !navigator.webdriver) { st.intro = { t0: performance.now() }; st.introDone = true; }
  }
  const HOME = { polar: Math.PI*.455, az: Math.PI*.09, dist: 2.45 };
  function home(now){ if (!R) return; const T = THREE, dist = HOME.dist*(1 + 1.0*ease(st.t)), dir = new T.Vector3().setFromSphericalCoords(1, HOME.polar, HOME.az);
    R.ctl.target.set(0, .5, 0); R.cam.position.copy(R.ctl.target).addScaledVector(dir, dist); R.cam.lookAt(R.ctl.target); R.ctl.update(); st.sel = null; st.focus = null; if (st.zone) { st.zlast = st.zone; st.zone = null; } if (!now) wake(); }

  function tap(e){
    const T = THREE, cv = R.r.domElement, rc = cv.getBoundingClientRect(), m = new T.Vector2((e.clientX - rc.left)/rc.width*2 - 1, -(e.clientY - rc.top)/rc.height*2 + 1);
    const ray = new T.Raycaster(); ray.setFromCamera(m, R.cam);
    const hits = ray.intersectObjects(Object.values(R.groups).filter(g => g.visible), true).filter(h => h.object.visible && !h.object.isLineSegments);
    let g = hits[0]?.object; while (g && !g.userData.g) g = g.parent;
    st.opts?.onTap?.(g ? g.userData.g : null, !!hits.length);
  }

  /* ---------- mode ingénieur : arêtes, estompage, focus ---------- */
  function ensureEdges(){ if (R.edges) return; const T = THREE; R.edges = [];
    for (const g of Object.values(R.groups)) { const mat = new T.LineBasicMaterial({ color: 0x8cc8ff, transparent: true, opacity: 0, depthWrite: false }); mat.color.convertSRGBToLinear(); g.userData.lineMat = mat;
      g.traverse(m => { if (!m.isMesh || m.isInstancedMesh || m.userData.noEdges || !m.geometry?.attributes?.position || m.geometry.attributes.position.count > 60000) return;
        const ls = new T.LineSegments(new T.EdgesGeometry(m.geometry, 28), mat); ls.raycast = () => {}; m.add(ls); R.edges.push(ls); }); } }
  const C_LINE = 0x8cc8ff, C_SEL = 0xffb27a;
  function applyLook(k, zk = 0){
    const sel = st.sel, zone = st.zone;
    for (const g of Object.values(R.groups)) {
      const inZ = zone?.has(g.userData.g), dim = (sel && g.userData.g !== sel) || (!sel && zone && !inZ), target = dim ? .14 : 1;
      for (const m of g.userData.mats) { const op = smooth(m.opacity, target*(m.userData.op0 ?? 1), .18); m.opacity = op; m.transparent = op < .99 || m.userData.tr0; m.depthWrite = op > .6; }
      const lm = g.userData.lineMat; if (lm) { lm.opacity = smooth(lm.opacity, Math.max(k, inZ ? zk : 0)*(sel ? (dim ? .08 : .95) : .7), .15); lm.color.setHex(sel && !dim ? C_SEL : C_LINE).convertSRGBToLinear(); }
    }
  }

  /* ---------- étiquettes, lignes de rappel, témoins discrets ---------- */
  function overlayHTML(){
    const tg = st.opts?.tags || {}, keys = Object.keys(R.groups).filter(k => tg[k]);
    return `<svg class="gr-lines" aria-hidden="true"></svg><div class="gr-tags">${keys.map(k => { const t = tg[k];
      return `<button type="button" class="gr-tag" data-g3="${k}" style="--c:${t.col}"><span><b>${t.short || LABEL[k] || t.l}</b><em>${t.txt}</em></span><span class="gr-tb"><i style="width:${Math.max(4, t.rem*100)}%"></i></span></button>`; }).join('')}</div>
      <div class="gr-dots">${keys.map(k => `<button type="button" data-gd="${k}" style="--c:${tg[k].col}" aria-label="${LABEL[k] || tg[k].l} : ${tg[k].txt}"><i></i></button>`).join('')}</div>`;
  }
  // étiquette affichée : composant choisi, ce qui demande de l'attention, ou toutes sur grand écran ; sinon un simple témoin de couleur
  const labelled = (key, w) => { const t = st.opts?.tags?.[key]; if (st.zone) return st.zone.has(key); return key === st.sel || (t && t.rem < .6) || w >= 620 || st.opts?.allTags; };
  function placeOverlay(w, h){
    const el = st.el; if (!el) return; const box = el.querySelector('.gr-tags'), svg = el.querySelector('.gr-lines'), dots = el.querySelector('.gr-dots'); if (!box) return;
    const k = ease(st.t), zk = st.zone ? ease(st.zt) : 0, show = k > .55 || zk > .5, op = show ? Math.min(1, Math.max((k - .55)/.35, (zk - .5)/.35)) : 0;
    box.style.opacity = svg.style.opacity = String(op); box.style.pointerEvents = 'none'; const tagsOn = show && (st.target || st.zone); // le calque couvre toute la scène : seules les étiquettes captent le toucher, le reste va aux gestes (tourner, pincer, déplacer)
    for (const e2 of box.children) e2.style.pointerEvents = tagsOn ? 'auto' : 'none';
    const v = new THREE.Vector3(), A = {};
    for (const [key, g] of Object.entries(R.groups)) { v.copy(g.userData.center).add(g.position).add(R.root.position).project(R.cam); A[key] = [(v.x*.5 + .5)*w, (-v.y*.5 + .5)*h]; }
    // témoins : vélo monté → seulement ce qui demande de l'attention ; éclaté → un point par composant (touchable)
    for (const d of dots.children) { const key = d.dataset.gd, a = A[key], t = st.opts?.tags?.[key], att = t && t.rem < .6;
      const inZ = !st.zone || st.zone.has(key), o = show ? op*(st.sel && st.sel !== key ? .3 : 1)*(inZ ? 1 : 0) : k < .3 ? (att ? 1 - k/.3 : 0) : 0; d.style.opacity = String(o); d.style.pointerEvents = o > .3 ? 'auto' : 'none';
      if (a) d.style.transform = `translate(${a[0]}px, ${a[1]}px) translate(-50%, -50%)`; d.classList.toggle('on', key === st.sel); }
    if (!show) { svg.innerHTML = ''; return; }
    const L = [];
    for (const e2 of box.children) { const key = e2.dataset.g3, a = A[key], vis = a && labelled(key, w); e2.style.display = vis ? '' : 'none'; if (!vis) continue;
      const dx = a[0] - w/2, dy = a[1] - h*.48, len = Math.hypot(dx, dy) || 1;
      L.push({ el: e2, ax: a[0], ay: a[1], x: a[0] + dx/len*38, y: a[1] + dy/len*30, w: (e2._w ||= e2.offsetWidth) + 6, h: (e2._h ||= e2.offsetHeight) + 4, sel: key === st.sel }); }
    for (let it = 0; it < 24; it++) for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const a = L[i], b = L[j];
      const ox = (a.w + b.w)/2 - Math.abs(a.x - b.x), oy = (a.h + b.h)/2 - Math.abs(a.y - b.y); if (ox <= 0 || oy <= 0) continue;
      if (oy < ox) { const s = (a.y <= b.y ? -1 : 1)*oy/2; a.y += s; b.y -= s; } else { const s = (a.x <= b.x ? -1 : 1)*ox/2; a.x += s; b.x -= s; } }
    let lines = '';
    for (const t of L) { t.x = clamp(t.x, t.w/2, w - t.w/2); t.y = clamp(t.y, t.h/2, h - t.h/2); t.el.style.transform = `translate(${t.x}px, ${t.y}px) translate(-50%, -50%)`;
      t.el.classList.toggle('on', t.sel); t.el.classList.toggle('dim', !!st.sel && !t.sel);
      const ex = clamp(t.ax, t.x - t.w/2 + 6, t.x + t.w/2 - 6), ey = t.ay < t.y ? t.y - t.h/2 + 2 : t.y + t.h/2 - 2, c = t.el.style.getPropertyValue('--c'), fo = st.sel && !t.sel ? .15 : .7;
      lines += `<line x1="${ex.toFixed(1)}" y1="${ey.toFixed(1)}" x2="${t.ax.toFixed(1)}" y2="${t.ay.toFixed(1)}" stroke="${c}" stroke-opacity="${fo}"/>`; }
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`); svg.innerHTML = lines;
  }

  /* ---------- boucle ---------- */
  function size(){ const el = st.el; if (!el || !R) return [0, 0]; const w = el.clientWidth || 320, h = el.clientHeight || 260;
    if (R.w !== w || R.h !== h) { R.r.setSize(w, h, false); R.cam.aspect = w/h; R.cam.updateProjectionMatrix(); R.w = w; R.h = h; } return [w, h]; }
  function frame(now){
    if (!R || !st.el?.isConnected) { st.raf = 0; return; }
    const T = THREE, dt = Math.min(.1, (now - (st.last || now))/1000); st.last = now;
    const prev = ease(st.t); st.t = st.target ? Math.min(1, st.t + dt*1.25) : Math.max(0, st.t - dt*1.6); const k = ease(st.t);
    if (k !== prev && !st.focus && !st.intro) { const f = (1 + 1.0*k)/(1 + 1.0*prev), off = R.cam.position.clone().sub(R.ctl.target); R.cam.position.copy(R.ctl.target).addScaledVector(off, f); }
    // éclaté échelonné : les composants se détachent l'un après l'autre
    const gs = Object.values(R.groups);
    st.zt = st.zone ? Math.min(1, st.zt + dt*1.8) : Math.max(0, st.zt - dt*2.2); const zk = ease(st.zt), zs = st.zone || st.zlast;
    gs.forEach((g, i) => { const delay = (i/gs.length)*.35, kk = Math.max(ease(clamp((st.t - delay)/.65, 0, 1)), zs?.has(g.userData.g) ? zk*ZONE_SPREAD : 0);
      g.position.copy(g.userData.off).multiplyScalar(kk); if (g.userData.hideAssembled) g.visible = kk > .06; });
    if (k > 0 || st.sel || st.zt > 0) ensureEdges(); if (R.edges) applyLook(k, zk);
    // intro : travelling depuis le profil côté transmission
    if (st.intro) { const u = clamp((now - st.intro.t0)/1700, 0, 1), e = ease(u), dir = new T.Vector3().setFromSphericalCoords(1, smooth(Math.PI*.5, HOME.polar, e), smooth(-Math.PI*.12, HOME.az, e));
      R.cam.position.copy(R.ctl.target).addScaledVector(dir, smooth(3.9, HOME.dist, e)*(1 + 1.0*k)); if (u >= 1) { st.intro = null; st.idle = now; } }
    // focus sur le composant choisi
    if (st.focus) { R.ctl.target.lerp(st.focus.p, .1); const off = R.cam.position.clone().sub(R.ctl.target); off.setLength(smooth(off.length(), st.focus.d, .08)); R.cam.position.copy(R.ctl.target).add(off); }
    // présentoir : rotation lente quand on ne touche à rien (vélo monté)
    const idle = now - st.idle; R.ctl.autoRotate = !st.intro && !st.target && !st.sel && !st.zone && !navigator.webdriver && idle > 6000 && idle < 30000;
    if (R.ctl.update()) st.busy = Math.max(st.busy, now + 250); const [w, h] = size(); R.r.render(R.scene, R.cam); placeOverlay(w, h);
    // rendu à la demande : on s'arrête dès que plus rien ne bouge (batterie du téléphone)
    const moving = st.intro || R.ctl.autoRotate || (st.target ? st.t < 1 : st.t > 0) || (st.zone ? st.zt < 1 : st.zt > 0) || now < st.busy;
    st.raf = moving ? requestAnimationFrame(frame) : 0;
  }
  const kick = () => { if (!st.raf && st.el?.isConnected) { st.last = 0; st.raf = requestAnimationFrame(frame); } };
  const wake = (ms = 1600) => { st.busy = Math.max(st.busy, performance.now() + ms); kick(); };
  let idleT = 0; const idleNow = () => { st.idle = performance.now(); clearTimeout(idleT); idleT = setTimeout(() => wake(200), 6100); };

  /* ---------- API ---------- */
  // montages successifs (chaque rendu du Garage remonte la scène) : un seul construit à la fois, seul le dernier appel s'accroche à la page
  let pending = null, seq = 0;
  async function mount(el, opts){
    const my = ++seq;
    await loadLibs();
    while (pending) await pending.catch(() => {});
    if (my !== seq) return null;
    if (R && R.key !== opts.key) { R.r.dispose(); R.ft?.dispose(); R = null; st.t = 0; st.sel = null; st.focus = null; st.zone = st.zlast = null; st.zt = 0; }
    if (!R) { pending = setup(opts); try { await pending; } finally { pending = null; } if (my !== seq) return null; }
    else if (R.ft?.set(opts.look)) wake(300);
    st.el = el; st.opts = opts; st.target = opts.exploded ? 1 : 0; if (opts.exploded && st.t === 0) st.t = 1;
    el.querySelector('.gr-load')?.remove(); el.querySelectorAll('canvas,.gr-tags,.gr-lines,.gr-dots').forEach(x => x.remove());
    el.prepend(R.r.domElement); el.insertAdjacentHTML('beforeend', overlayHTML());
    for (const c of el.querySelectorAll('.gr-tags,.gr-dots')) c.addEventListener('click', e => { const b = e.target.closest('[data-g3],[data-gd]'); if (b) st.opts?.onTap?.(b.dataset.g3 || b.dataset.gd, true); });
    R.w = R.h = 0; idleNow(); wake(2000); return { names: R.names || null, glb: !!R.glb, ftp: !!R.ft, groups: Object.keys(R.groups) };
  }
  function explode(on){ st.target = on ? 1 : 0; if (st.zone) { st.zlast = st.zone; st.zone = null; } if (!on) { st.sel = null; st.focus = null; } wake(2500); }
  function select(key){ if (!R) return; st.sel = key && R.groups[key] ? key : null;
    if (st.sel) { const T = THREE, bx = new T.Box3().setFromObject(R.groups[key]), c = bx.getCenter(new T.Vector3()), r = bx.getSize(new T.Vector3()).length(); st.focus = { p: c, d: clamp(r*2.6, .7, 3.2) }; setTimeout(() => { if (st.focus?.p === c) st.focus = null; }, 1800); }
    else if (st.focus) { st.focus = { p: new THREE.Vector3(0, .5, 0), d: HOME.dist*(1 + 1.0*ease(st.t)) }; setTimeout(() => { if (!st.sel) st.focus = null; }, 900); }
    wake(2000); }
  // rendu isolé d'un composant (vignette de la fiche)
  function snapshot(key, w = 360, h = 220){
    if (!R || !R.groups[key]) return null; const T = THREE, g = R.groups[key], all = Object.values(R.groups), vis = all.map(x => x.visible);
    all.forEach(x => x.visible = x === g);
    const looks = g.userData.mats.map(m => [m.opacity, m.transparent]); g.userData.mats.forEach(m => { m.opacity = m.userData.op0 ?? 1; m.transparent = !!m.userData.tr0; });
    const lm = g.userData.lineMat, lo = lm?.opacity; if (lm) lm.opacity = 0;
    const bx = new T.Box3().setFromObject(g), c = bx.getCenter(new T.Vector3()), r = Math.max(.05, bx.getSize(new T.Vector3()).length()/2);
    const cam = new T.PerspectiveCamera(30, w/h, .01, 20), dir = new T.Vector3().setFromSphericalCoords(1, Math.PI*.42, Math.PI*.18);
    cam.position.copy(c).addScaledVector(dir, r/Math.sin(15*Math.PI/180)*1.05); cam.lookAt(c);
    const pw = R.w, ph = R.h; R.r.setSize(w, h, false); R.r.render(R.scene, cam); const url = R.r.domElement.toDataURL('image/png');
    R.r.setSize(pw, ph, false); all.forEach((x, i) => x.visible = vis[i]); g.userData.mats.forEach((m, i) => { m.opacity = looks[i][0]; m.transparent = looks[i][1]; }); if (lm) lm.opacity = lo;
    R.r.render(R.scene, R.cam); return url;
  }
  function stop(){ if (st.raf) cancelAnimationFrame(st.raf); st.raf = 0; }
  function labels(on){ if (st.opts) st.opts.allTags = on; wake(600); }
  // zone touchée : on rapproche la caméra de ses pièces, on les écarte un peu et on estompe le reste ; la navigation reste libre
  function zone(keys){
    if (!R) return; const T = THREE, ks = keys && keys.filter(k => R.groups[k]);
    if (!ks?.length) { if (st.zone) st.zlast = st.zone; st.zone = null; st.sel = null; const f = { p: new T.Vector3(0, .5, 0), d: HOME.dist*(1 + ease(st.t)) }; st.focus = f; setTimeout(() => { if (st.focus === f) st.focus = null; }, 1500); wake(2000); return; }
    st.zone = new Set(ks); st.zlast = null; st.sel = null;
    const bx = new T.Box3(); for (const k of ks) { const g = R.groups[k], b = new T.Box3().setFromObject(g), d = g.userData.off.clone().multiplyScalar(ZONE_SPREAD).sub(g.position); b.translate(d); bx.union(b); }
    const c = bx.getCenter(new T.Vector3()), r = bx.getSize(new T.Vector3()).length(), f = { p: c, d: clamp(r*1.9, .8, 3.4) }; st.focus = f;
    setTimeout(() => { if (st.focus === f) st.focus = null; }, 1800); wake(2200);
  }
  function zoom(f){ if (!R) return; st.focus = null; const off = R.cam.position.clone().sub(R.ctl.target); off.setLength(clamp(off.length()*f, R.ctl.minDistance, R.ctl.maxDistance)); R.cam.position.copy(R.ctl.target).add(off); idleNow(); wake(600); }
  // apparence de la maquette FTP (couleur, sticker…) : mise à jour immédiate, sans reconstruire la scène
  function setLook(look){ if (R?.ft?.set(look)) wake(300); }
  return { mount, explode, select, snapshot, stop, labels, zone, zoom, setLook, lookOf, PAINTS, FINISHES, INKS, FONTS, RIMS, resetView: () => home(false), LABEL, NAME_RX, KEYS: Object.keys(LABEL), get R(){ return R; }, get t(){ return st.t; }, get sel(){ return st.sel; }, get zoneKeys(){ return st.zone ? [...st.zone] : null; } };
})();
