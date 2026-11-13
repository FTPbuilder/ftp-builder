"use strict";
// FTP Builder · Garage : scène 3D du vélo (three.js) — studio, rotation libre, vue éclatée « mode ingénieur », témoins d'usure ; import d'un vrai modèle GLB ; film image par image
/* ============ Bike3D ============
   Deux sources de maquette :
   - « glb » : le vrai modèle de l'utilisateur (fichier .glb importé), découpé en composants d'après le nom de ses objets (ou le réglage manuel) ;
   - « proc » : maquette générique procédurale aux cotes d'un Aeroad taille M (empattement 99 cm, stack 57, reach 38, roues de 55 mm) — fidèle en
     géométrie et en implantation des composants, mais PAS une numérisation du vélo : aucun marquage de marque, formes simplifiées.
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
  const clean = n => String(n || '').replace(/[_.\-]+/g, ' ').replace(/\s\d+$/, ''); // GLTFLoader remplace les espaces par « _ »
  const OFF = { frame: [0, 0, 0], fork: [.17, -.05, 0], wheelF: [.36, -.02, 0], tireF: [.6, .1, .12], rotors: [0, 0, -.3], wheelR: [-.28, -.02, 0], tireR: [-.52, .1, .12],
    cassette: [-.17, 0, .34], rd: [-.11, -.15, .38], chain: [.05, -.34, .28], crank: [.15, -.2, .46], bb: [0, -.34, 0], fd: [.07, .02, .32], seatpost: [-.05, .22, 0], saddle: [-.08, .42, 0],
    battery: [-.26, .12, 0], cockpit: [.17, .27, 0], levers: [.34, .36, 0], headset: [.03, .15, .32], calipers: [0, .02, -.42] };
  let R = null; // scène courante
  const st = { t: 0, target: 0, opts: null, el: null, raf: 0, last: 0, sel: null, idle: 0, intro: null, introDone: false, focus: null, busy: 0 };
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
    const T = THREE, b = opts.glb ? await buildGLB(T, opts.glb) : buildProc(T, opts.model, opts.variant);
    const r = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: !!navigator.webdriver });
    r.setPixelRatio(navigator.webdriver ? 1 : Math.min(devicePixelRatio || 1, 2)); r.outputEncoding = T.sRGBEncoding; r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.12; r.setClearColor(0, 0);
    r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap;
    const scene = new T.Scene(); scene.environment = studio(T, r);
    scene.add(new T.HemisphereLight(0xffffff, 0x2a2e36, .35));
    const key = new T.DirectionalLight(0xffffff, 2); key.position.set(1.2, 3.2, 1.8); key.castShadow = true; key.shadow.mapSize.setScalar(navigator.webdriver ? 512 : 2048); key.shadow.bias = -.0004; key.shadow.normalBias = .01;
    Object.assign(key.shadow.camera, { left: -1.6, right: 1.6, top: 1.6, bottom: -1.6, near: .5, far: 8 }); scene.add(key);
    const rim = new T.DirectionalLight(0xc8d8ff, .9); rim.position.set(-2.2, 1.6, -2.4); scene.add(rim);
    const fill = new T.DirectionalLight(0xffe9d6, .35); fill.position.set(-1, .6, 2.5); scene.add(fill);
    const ground = new T.Mesh(new T.PlaneGeometry(8, 8), new T.ShadowMaterial({ opacity: .28 })); ground.rotation.x = -Math.PI/2; ground.receiveShadow = true; scene.add(ground);
    const contact = new T.Mesh(new T.PlaneGeometry(1.9, .55), new T.MeshBasicMaterial({ map: contactTex(T), transparent: true, depthWrite: false })); contact.rotation.x = -Math.PI/2; contact.position.y = .001; scene.add(contact);
    const cam = new T.PerspectiveCamera(30, 1.3, .05, 40);
    const ctl = new T.OrbitControls(cam, r.domElement); Object.assign(ctl, { enableDamping: true, dampingFactor: .085, enablePan: true, screenSpacePanning: true, panSpeed: .6, minDistance: .6, maxDistance: 9,
      minPolarAngle: .02, maxPolarAngle: Math.PI - .02, rotateSpeed: .75, zoomSpeed: .8, autoRotateSpeed: .55 });
    ctl.addEventListener('start', () => { idleNow(); ctl.autoRotate = false; st.intro = null; wake(); });
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
    R.ctl.target.set(0, .5, 0); R.cam.position.copy(R.ctl.target).addScaledVector(dir, dist); R.cam.lookAt(R.ctl.target); R.ctl.update(); st.sel = null; st.focus = null; if (!now) wake(); }

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
  function applyLook(k){
    const sel = st.sel;
    for (const g of Object.values(R.groups)) {
      const dim = sel && g.userData.g !== sel, target = dim ? .14 : 1;
      for (const m of g.userData.mats) { const op = smooth(m.opacity, target*(m.userData.op0 ?? 1), .18); m.opacity = op; m.transparent = op < .99 || m.userData.tr0; m.depthWrite = op > .6; }
      const lm = g.userData.lineMat; if (lm) { lm.opacity = smooth(lm.opacity, k*(sel ? (dim ? .08 : .95) : .7), .15); lm.color.setHex(sel && !dim ? C_SEL : C_LINE).convertSRGBToLinear(); }
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
  const labelled = (key, w) => { const t = st.opts?.tags?.[key]; return key === st.sel || (t && t.rem < .6) || w >= 620 || st.opts?.allTags; };
  function placeOverlay(w, h){
    const el = st.el; if (!el) return; const box = el.querySelector('.gr-tags'), svg = el.querySelector('.gr-lines'), dots = el.querySelector('.gr-dots'); if (!box) return;
    const k = ease(st.t), show = k > .55, op = show ? Math.min(1, (k - .55)/.35) : 0;
    box.style.opacity = svg.style.opacity = String(op); box.style.pointerEvents = show && st.target ? 'auto' : 'none';
    const v = new THREE.Vector3(), A = {};
    for (const [key, g] of Object.entries(R.groups)) { v.copy(g.userData.center).add(g.position).add(R.root.position).project(R.cam); A[key] = [(v.x*.5 + .5)*w, (-v.y*.5 + .5)*h]; }
    // témoins : vélo monté → seulement ce qui demande de l'attention ; éclaté → un point par composant (touchable)
    for (const d of dots.children) { const key = d.dataset.gd, a = A[key], t = st.opts?.tags?.[key], att = t && t.rem < .6;
      const o = k < .3 ? (att ? 1 - k/.3 : 0) : show ? op*(st.sel && st.sel !== key ? .3 : 1) : 0; d.style.opacity = String(o); d.style.pointerEvents = o > .3 ? 'auto' : 'none';
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
    gs.forEach((g, i) => { const delay = (i/gs.length)*.35, kk = ease(clamp((st.t - delay)/.65, 0, 1)); g.position.copy(g.userData.off).multiplyScalar(kk); if (g.userData.hideAssembled) g.visible = kk > .06; });
    if (k > 0 || st.sel) ensureEdges(); if (R.edges) applyLook(k);
    // intro : travelling depuis le profil côté transmission
    if (st.intro) { const u = clamp((now - st.intro.t0)/1700, 0, 1), e = ease(u), dir = new T.Vector3().setFromSphericalCoords(1, smooth(Math.PI*.5, HOME.polar, e), smooth(-Math.PI*.12, HOME.az, e));
      R.cam.position.copy(R.ctl.target).addScaledVector(dir, smooth(3.9, HOME.dist, e)*(1 + 1.0*k)); if (u >= 1) { st.intro = null; st.idle = now; } }
    // focus sur le composant choisi
    if (st.focus) { R.ctl.target.lerp(st.focus.p, .1); const off = R.cam.position.clone().sub(R.ctl.target); off.setLength(smooth(off.length(), st.focus.d, .08)); R.cam.position.copy(R.ctl.target).add(off); }
    // présentoir : rotation lente quand on ne touche à rien (vélo monté)
    const idle = now - st.idle; R.ctl.autoRotate = !st.intro && !st.target && !st.sel && !navigator.webdriver && idle > 6000 && idle < 30000;
    if (R.ctl.update()) st.busy = Math.max(st.busy, now + 250); const [w, h] = size(); R.r.render(R.scene, R.cam); placeOverlay(w, h);
    // rendu à la demande : on s'arrête dès que plus rien ne bouge (batterie du téléphone)
    const moving = st.intro || R.ctl.autoRotate || (st.target ? st.t < 1 : st.t > 0) || now < st.busy;
    st.raf = moving ? requestAnimationFrame(frame) : 0;
  }
  const kick = () => { if (!st.raf && st.el?.isConnected) { st.last = 0; st.raf = requestAnimationFrame(frame); } };
  const wake = (ms = 1600) => { st.busy = Math.max(st.busy, performance.now() + ms); kick(); };
  let idleT = 0; const idleNow = () => { st.idle = performance.now(); clearTimeout(idleT); idleT = setTimeout(() => wake(200), 6100); };

  /* ---------- API ---------- */
  async function mount(el, opts){
    await loadLibs();
    if (R && R.key !== opts.key) { R.r.dispose(); R = null; st.t = 0; st.sel = null; st.focus = null; }
    if (!R) await setup(opts);
    st.el = el; st.opts = opts; st.target = opts.exploded ? 1 : 0; if (opts.exploded && st.t === 0) st.t = 1;
    el.querySelector('.gr-load')?.remove(); el.querySelectorAll('canvas,.gr-tags,.gr-lines,.gr-dots').forEach(x => x.remove());
    el.prepend(R.r.domElement); el.insertAdjacentHTML('beforeend', overlayHTML());
    for (const c of el.querySelectorAll('.gr-tags,.gr-dots')) c.addEventListener('click', e => { const b = e.target.closest('[data-g3],[data-gd]'); if (b) st.opts?.onTap?.(b.dataset.g3 || b.dataset.gd, true); });
    R.w = R.h = 0; idleNow(); wake(2000); return { names: R.names || null, glb: !!R.glb, groups: Object.keys(R.groups) };
  }
  function explode(on){ st.target = on ? 1 : 0; if (!on) { st.sel = null; st.focus = null; } wake(2500); }
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
  return { mount, explode, select, snapshot, stop, labels, resetView: () => home(false), LABEL, NAME_RX, KEYS: Object.keys(LABEL), get R(){ return R; }, get t(){ return st.t; }, get sel(){ return st.sel; } };
})();

/* ============ Film : animation montage → éclaté image par image (vidéo générée par l'utilisateur, ex. Higgsfield, Kling, Veo) ============
   La vidéo est décodée une fois en 24 à 96 images, puis on la fait défiler au doigt ou en lecture aller / retour, comme un configurateur. */
const BikeFilm = (() => {
  let cur = null; // { id, frames, w, h }
  async function decode(blob, id, onProgress){
    if (cur?.id === id) return cur;
    const url = URL.createObjectURL(blob), v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
    try {
      await new Promise((ok, ko) => { v.onloadeddata = ok; v.onerror = () => ko(new Error('vidéo illisible sur cet appareil')); });
      if (!isFinite(v.duration)) await new Promise(ok => { v.onseeked = ok; v.currentTime = 1e7; }); // webm sans durée (enregistrement direct)
      if (!isFinite(v.duration) || !v.duration) throw new Error('vidéo sans durée lisible');
      const N = clamp(Math.round(v.duration*12), 24, 96), W = Math.min(960, v.videoWidth || 960), H = Math.round(W*(v.videoHeight || 540)/(v.videoWidth || 960)), frames = [];
      for (let i = 0; i < N; i++) {
        await new Promise(ok => { v.onseeked = ok; v.currentTime = Math.min(v.duration - .001, i/(N - 1)*v.duration); });
        const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').drawImage(v, 0, 0, W, H);
        frames.push(window.createImageBitmap ? await createImageBitmap(c) : c); onProgress?.((i + 1)/N);
      }
      return cur = { id, frames, w: W, h: H };
    } finally { URL.revokeObjectURL(url); }
  }
  function mount(el, film){
    const cv = document.createElement('canvas'); cv.className = 'gr-film'; cv.width = film.w; cv.height = film.h; el.querySelectorAll('canvas').forEach(x => x.remove()); el.prepend(cv);
    const ctx = cv.getContext('2d'), n = film.frames.length; let f = 0, target = 0, raf = 0, drag = null;
    const draw = () => { ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(film.frames[clamp(Math.round(f), 0, n - 1)], 0, 0); };
    const loop = () => { f += (target - f)*.2; draw(); raf = Math.abs(target - f) > .05 && cv.isConnected ? requestAnimationFrame(loop) : 0; };
    const go = t => { target = clamp(t, 0, n - 1); if (!raf) raf = requestAnimationFrame(loop); };
    cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, f: target }; cv.setPointerCapture?.(e.pointerId); });
    cv.addEventListener('pointermove', e => { if (drag) go(drag.f + (e.clientX - drag.x)/cv.clientWidth*n*1.2); });
    cv.addEventListener('pointerup', () => { drag = null; });
    draw(); return { play: fwd => go(fwd ? n - 1 : 0), get pos(){ return n > 1 ? f/(n - 1) : 0; } };
  }
  return { decode, mount, get cur(){ return cur; } };
})();
