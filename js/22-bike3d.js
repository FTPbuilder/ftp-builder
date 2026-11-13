"use strict";
// FTP Builder · Garage : maquette 3D du vélo (three.js), rotation libre et vue éclatée avec témoins d'usure par composant
/* ============ Bike3D ============
   Maquette procédurale (pas de fichier CAO : les marques ne les publient pas) aux cotes d'un Canyon Aeroad CFR taille M :
   empattement ~99 cm, stack 57 cm, reach 38 cm, roues DT Swiss ARC 1100 de 55 mm, Dura-Ace Di2 52/36 · 11-30, poste PACE T-Bar.
   Repère : x vers l'avant, y vers le haut, z côté transmission ; unité = mètre.
   Chaque composant est un groupe (clé = « g » des pièces du Garage) avec un décalage d'éclaté ; un toucher sur un composant renvoie sa clé. */
const Bike3D = (() => {
  const LIBS = ['https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js', 'https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/controls/OrbitControls.js'];
  const script = src => new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ko(new Error('bibliothèque 3D injoignable')); document.head.appendChild(s); });
  let libs = null;
  const loadLibs = () => libs ||= (async () => { if (!window.THREE) await script(LIBS[0]); if (!THREE.OrbitControls) await script(LIBS[1]); })().catch(e => { libs = null; throw e; });

  const LABEL = { tireF: 'Pneu AV', tireR: 'Pneu AR', chain: 'Chaîne', cassette: 'Cassette', crank: 'Pédalier', rd: 'Dérailleur AR', calipers: 'Freins', headset: 'Direction', bb: 'Boîtier', cockpit: 'Cockpit', battery: 'Batterie Di2', levers: 'Leviers Di2' };
  let R = null; // { r, scene, cam, ctl, root, groups, model }
  const st = { t: 0, target: 0, opts: null, el: null, raf: 0, last: 0, home: null };

  /* ---------- textures (texte, ombre) ---------- */
  function textTex(T, txt, { w = 1024, h = 192, size = 150, color = '#fff', font = 'italic 900', family = '"Arial Black","Helvetica Neue",Arial,sans-serif', spacing = 0 } = {}){
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    x.fillStyle = color; x.font = `${font} ${size}px ${family}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    if ('letterSpacing' in x) x.letterSpacing = spacing + 'px';
    x.fillText(txt, w/2, h/2 + size*0.04);
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 4; return t;
  }
  function ringTex(T, txt, rFrac, color, size = 54){ // texte posé en arc, deux fois (comme sur une jante)
    const S = 1024, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
    x.fillStyle = color; x.font = `italic 800 ${size}px "Arial Black",Arial,sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    const r = rFrac*S/2;
    for (const a0 of [Math.PI*0.5, Math.PI*1.5]) { const chars = [...txt], step = size*0.62/r; let a = a0 + step*(chars.length - 1)/2;
      for (const ch of chars) { x.save(); x.translate(S/2 + r*Math.cos(a), S/2 - r*Math.sin(a)); x.rotate(-(a - Math.PI/2)); x.fillText(ch, 0, 0); x.restore(); a -= step; } }
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t;
  }
  function shadowTex(T){ const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
    const g = x.createRadialGradient(128, 32, 4, 128, 32, 128); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 64);
    return new T.CanvasTexture(c); }

  /* ---------- construction ---------- */
  function build(T, model){
    const aero = model !== 'road';
    const V = (x, y, z = 0) => new T.Vector3(x, y, z);
    const M = {
      carbon: new T.MeshPhysicalMaterial({ color: 0x15171b, roughness: .42, metalness: .25, clearcoat: .9, clearcoatRoughness: .22 }),
      matte: new T.MeshStandardMaterial({ color: 0x1d1f24, roughness: .75, metalness: .1 }),
      rim: new T.MeshPhysicalMaterial({ color: 0x18191d, roughness: .5, metalness: .2, clearcoat: .5, clearcoatRoughness: .4 }),
      rubber: new T.MeshStandardMaterial({ color: 0x141518, roughness: .9, metalness: 0 }),
      alu: new T.MeshStandardMaterial({ color: 0xb8bdc4, roughness: .28, metalness: .95 }),
      steel: new T.MeshStandardMaterial({ color: 0x80858c, roughness: .35, metalness: .9 }),
      dark: new T.MeshStandardMaterial({ color: 0x2a2d33, roughness: .45, metalness: .7 }),
      spoke: new T.MeshStandardMaterial({ color: 0x0e0f12, roughness: .5, metalness: .6 }),
      batt: new T.MeshStandardMaterial({ color: 0x2b6cf0, roughness: .4, metalness: .3 }),
      white: new T.MeshStandardMaterial({ color: 0xffffff, roughness: .6 }),
    };
    for (const m of Object.values(M)) m.color.convertSRGBToLinear(); // r147 : les couleurs hex sont lues en linéaire, on les convertit pour garder le noir carbone
    const root = new T.Group(), groups = {};
    const grp = k => { if (!groups[k]) { const g = new T.Group(); g.userData.g = k; groups[k] = g; root.add(g); } return groups[k]; };
    const add = (k, mesh) => { mesh.userData.g = k; grp(k).add(mesh); return mesh; };

    // tube profilé (Kammtail tronqué) ou rond, de a à b ; profil : chord dans le plan du vélo, thick en latéral
    function frameTube(k, a, b, chord, thick, mat = M.carbon, cut = 0.82){
      const axis = b.clone().sub(a), len = axis.length(); axis.normalize();
      let n = V(-axis.y, axis.x, 0); if (n.lengthSq() < 1e-6) n = V(1, 0, 0); n.sub(axis.clone().multiplyScalar(n.dot(axis))).normalize(); if (n.x + n.y*0.3 < 0) n.negate();
      const lat = n.clone().cross(axis), sh = new T.Shape(), N = 18, pts = [];
      if (aero && chord > thick*1.15) { for (let i = 0; i <= N; i++) { const u = cut*i/N, w = (thick/2)*Math.min(1, (2.97*Math.sqrt(u) - 1.26*u - 3.52*u*u + 2.84*u*u*u - 1.02*u*u*u*u)/0.6); pts.push([w, chord/2 - u*chord]); }
        pts.forEach(([x, y], i) => i ? sh.lineTo(x, y) : sh.moveTo(x, y)); for (let i = pts.length - 1; i >= 0; i--) sh.lineTo(-pts[i][0], pts[i][1]); }
      else sh.absellipse(0, 0, thick/2, chord/2, 0, Math.PI*2, false, 0);
      const geo = new T.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false, curveSegments: 16 });
      const m = new T.Mesh(geo, mat), mx = new T.Matrix4().makeBasis(lat, n, axis); m.quaternion.setFromRotationMatrix(mx); m.position.copy(a);
      m.userData.frame = { a, b, axis, n, lat, chord, thick }; return add(k, m);
    }
    function decal(k, tube, txt, { at = 0.5, len = 0.32, size = 150, side = 1, color = '#fff' } = {}){
      const f = tube.userData.frame, tex = textTex(T, txt, { size, color });
      const h = len*192/1024, mat = new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
      for (const s of side === 2 ? [1, -1] : [side]) {
        const p = new T.Mesh(new T.PlaneGeometry(len, h), mat), c = f.a.clone().addScaledVector(f.axis, f.axis.dot(f.b.clone().sub(f.a))*at);
        let xd = f.axis.clone(), yd = f.n.clone(), zd = f.lat.clone().multiplyScalar(s); if (xd.clone().cross(yd).dot(zd) < 0) xd.negate();
        p.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(xd, yd, zd)); p.position.copy(c).addScaledVector(zd, f.thick*0.5 + 0.0012); add(k, p);
      }
    }
    const cyl = (k, r, len, mat, pos, seg = 24, axis = 'z') => { const m = new T.Mesh(new T.CylinderGeometry(r, r, len, seg), mat); if (axis === 'z') m.rotation.x = Math.PI/2; else if (axis === 'x') m.rotation.z = Math.PI/2; m.position.copy(pos); return add(k, m); };
    const box = (k, w, h, d, mat, pos, rotZ = 0) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.position.copy(pos); m.rotation.z = rotZ; return add(k, m); };
    const tube = (k, pts, r, mat, closed = false, seg = 64) => add(k, new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts, closed, 'centripetal'), seg, r, 8, closed), mat));
    const annulus = (r1, r0, depth, bevel = 0.0015, seg = 96) => { const s = new T.Shape(); s.absarc(0, 0, r1, 0, Math.PI*2, false); const hole = new T.Path(); hole.absarc(0, 0, r0, 0, Math.PI*2, true); s.holes.push(hole);
      const g = new T.ExtrudeGeometry(s, { depth, bevelEnabled: !!bevel, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: seg }); g.translate(0, 0, -depth/2); return g; };

    /* --- géométrie (taille M) --- */
    const RA = V(0, .335), BB = V(.408, .263), FA = V(.99, .335), d = V(-.292, .956), s = V(-.284, .959);
    const P0 = V(FA.x - .047, FA.y), HTb = P0.clone().addScaledVector(d, .37), HTt = HTb.clone().addScaledVector(d, .15);
    const ST = BB.clone().addScaledVector(s, .5), TTr = BB.clone().addScaledVector(s, .465), SSj = BB.clone().addScaledVector(s, .31);
    const at = (p, z) => V(p.x, p.y, z);

    // cadre
    const dt = frameTube('frame', HTb.clone().addScaledVector(d, .02), V(BB.x + .02, BB.y + .03), aero ? .078 : .05, aero ? .042 : .045);
    frameTube('frame', HTb.clone().addScaledVector(d, -.012), HTt.clone().addScaledVector(d, .012), aero ? .072 : .05, aero ? .044 : .042);
    frameTube('frame', HTt.clone().addScaledVector(d, -.022), TTr, aero ? .042 : .035, aero ? .032 : .034);
    const stb = frameTube('frame', V(BB.x - .004, BB.y + .01), ST, aero ? .058 : .034, aero ? .034 : .032);
    for (const z of [1, -1]) {
      frameTube('frame', V(RA.x + .012, RA.y + .005, .062*z), at(SSj, .022*z), aero ? .022 : .016, .016);
      frameTube('frame', V(RA.x + .012, RA.y - .004, .062*z), V(BB.x - .03, BB.y + .005, .036*z), aero ? .03 : .022, .019);
      box('frame', .035, .03, .008, M.carbon, V(RA.x + .006, RA.y, .066*z));
    }
    cyl('frame', .022, .084, M.carbon, BB, 24); // boîte de pédalier
    if (aero) { decal('frame', dt, 'CANYON', { at: .5, len: .36, side: 2 }); decal('frame', stb, '— CFR —', { at: .78, len: .08, size: 120, side: 2, color: '#d9dde3' }); }
    else decal('frame', dt, 'ROAD', { at: .5, len: .26, side: 2, color: '#d9dde3' });
    // fourche
    const crown = HTb.clone().addScaledVector(d, -.03);
    for (const z of [1, -1]) frameTube('fork', at(crown, .045*z), V(FA.x - .004, FA.y + .004, .053*z), aero ? .04 : .026, .02);
    box('fork', .06, .03, .12, M.carbon, crown.clone(), Math.atan2(d.y, d.x) - Math.PI/2);
    const fb = groups.fork.children[0]; if (aero) decal('fork', fb, 'CANYON', { at: .45, len: .2, side: 1, size: 130 });
    // direction : roulements haut / bas
    for (const p of [HTt.clone().addScaledVector(d, .006), HTb.clone().addScaledVector(d, -.004)]) { const m = new T.Mesh(new T.TorusGeometry(.019, .0055, 10, 28), M.steel); m.position.copy(p); m.rotation.x = Math.PI/2; m.rotation.y = Math.atan2(-d.x, d.y)*0; m.quaternion.setFromUnitVectors(V(0, 0, 1), d); add('headset', m); }
    // poste de pilotage : potence, cintre, cocottes, guidoline
    const sp = HTt.clone().addScaledVector(d, .03), bar = V(sp.x + .108, sp.y + .012);
    frameTube('cockpit', HTt.clone().addScaledVector(d, .004), sp, .05, .036, M.carbon);
    frameTube('cockpit', sp.clone().add(V(-.01, 0)), bar.clone().add(V(.01, 0)), .022, .03, M.carbon);
    const topBar = new T.Mesh(new T.CylinderGeometry(.012, .012, .40, 16), M.carbon); topBar.scale.set(1, 1, aero ? 2 : 1); topBar.rotation.x = Math.PI/2; topBar.position.copy(bar); add('cockpit', topBar);
    for (const z of [1, -1]) tube('cockpit', [V(bar.x, bar.y, .2*z), V(bar.x + .055, bar.y - .004, .2*z), V(bar.x + .085, bar.y - .045, .203*z), V(bar.x + .072, bar.y - .1, .207*z), V(bar.x + .03, bar.y - .125, .21*z), V(bar.x - .03, bar.y - .128, .212*z)], .012, M.matte, false, 40);
    // cocottes et leviers Di2 (piles CR1632)
    for (const z of [1, -1]) { box('levers', .075, .032, .028, M.matte, V(bar.x + .072, bar.y + .01, .2*z), -.35); tube('levers', [V(bar.x + .1, bar.y + .005, .2*z), V(bar.x + .108, bar.y - .04, .2*z), V(bar.x + .1, bar.y - .09, .203*z)], .006, M.dark, false, 16); }
    // tige de selle + selle
    const SP = ST.clone().addScaledVector(s, .22);
    frameTube('seatpost', ST.clone().addScaledVector(s, -.06), SP, aero ? .05 : .027, aero ? .026 : .027, M.carbon);
    const sh = new T.Shape(); sh.moveTo(.14, 0); sh.bezierCurveTo(.14, .016, .06, .02, .02, .03); sh.bezierCurveTo(-.06, .065, -.13, .066, -.135, .045); sh.lineTo(-.135, -.045); sh.bezierCurveTo(-.13, -.066, -.06, -.065, .02, -.03); sh.bezierCurveTo(.06, -.02, .14, -.016, .14, 0);
    const sg = new T.ExtrudeGeometry(sh, { depth: .018, bevelEnabled: true, bevelThickness: .008, bevelSize: .006, bevelSegments: 3, curveSegments: 18 }); sg.rotateX(Math.PI/2);
    const sad = new T.Mesh(sg, M.matte); sad.position.set(SP.x + .03, SP.y + .045, 0); add('seatpost', sad);
    for (const z of [1, -1]) tube('seatpost', [V(SP.x - .06, SP.y + .03, .02*z), V(SP.x, SP.y + .02, .02*z), V(SP.x + .07, SP.y + .03, .018*z)], .0035, M.dark, false, 12);
    // batterie Di2 (dans la tige de selle : visible en éclaté seulement)
    const bat = cyl('battery', .011, .12, M.batt, ST.clone().addScaledVector(s, .03), 18, 'y'); bat.quaternion.setFromUnitVectors(V(0, 1, 0), s); grp('battery').userData.hideAssembled = true;
    // boîtier de pédalier (roulements)
    cyl('bb', .0205, .09, M.steel, BB.clone(), 24); grp('bb').userData.hideAssembled = true;

    /* --- roues --- */
    function wheel(kW, kT, kRot, c, rear, tireW){
      const rimR = .311, depth = aero ? .055 : .03;
      const rim = new T.Mesh(annulus(rimR, rimR - depth, .026, .002), M.rim); rim.position.copy(c); add(kW, rim);
      if (aero || true) { const tex = ringTex(T, 'DT SWISS', (rimR - depth*0.52)/.32, '#e9ebee', 58), mat = new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
        for (const z of [1, -1]) { const p = new T.Mesh(new T.PlaneGeometry(.64, .64), mat); p.position.set(c.x, c.y, c.z + z*.0155); if (z < 0) p.rotation.y = Math.PI; add(kW, p); } }
      const tr = new T.Mesh(new T.TorusGeometry(rimR + tireW*0.42, tireW/2, 14, 96), M.rubber); tr.position.copy(c); add(kT, tr);
      const tTex = ringTex(T, rear ? 'GRAND PRIX 5000' : 'AERO 111', (rimR + tireW*0.42)/.335, '#9aa0a8', 30), tMat = new T.MeshBasicMaterial({ map: tTex, transparent: true, depthWrite: false });
      for (const z of [1, -1]) { const p = new T.Mesh(new T.PlaneGeometry(.67, .67), tMat); p.position.set(c.x, c.y, c.z + z*(tireW*0.47)); if (z < 0) p.rotation.y = Math.PI; add(kT, p); }
      cyl(kW, .016, rear ? .13 : .1, M.dark, c.clone(), 20);
      for (const z of [1, -1]) cyl(kW, .026, .004, M.dark, V(c.x, c.y, c.z + z*(rear ? .032 : .03)), 24);
      const n = 24, sg = new T.CylinderGeometry(.0011, .0011, 1, 5);
      for (let i = 0; i < n; i++) { const a = i/n*Math.PI*2 + (i%2 ? .06 : 0), z = (i%2 ? 1 : -1)*(rear ? .032 : .03);
        const p1 = V(c.x + .026*Math.cos(a), c.y + .026*Math.sin(a), c.z + z), b2 = a + (i%2 ? .22 : -.22), p2 = V(c.x + (rimR - depth + .002)*Math.cos(b2), c.y + (rimR - depth + .002)*Math.sin(b2), c.z);
        const m = new T.Mesh(sg, M.spoke), dv = p2.clone().sub(p1); m.scale.y = dv.length(); m.position.copy(p1).addScaledVector(dv, .5); m.quaternion.setFromUnitVectors(V(0, 1, 0), dv.normalize()); add(kW, m); }
      // disque
      const rr = rear ? .07 : .08, disc = new T.Mesh(annulus(rr, rr - .016, .0018, 0, 64), M.steel); disc.position.set(c.x, c.y, c.z - .058); add(kRot, disc);
      for (let i = 0; i < 6; i++) { const a = i/6*Math.PI*2, m = new T.Mesh(new T.BoxGeometry(rr - .03, .006, .002), M.dark); m.position.set(c.x + Math.cos(a)*(rr - .016)/2 + Math.cos(a)*.01, c.y + Math.sin(a)*((rr - .016)/2 + .01), c.z - .058); m.rotation.z = a; add(kRot, m); }
    }
    wheel('wheelF', 'tireF', 'rotorF', FA.clone(), false, aero ? .027 : .028);
    wheel('wheelR', 'tireR', 'rotorR', RA.clone(), true, aero ? .029 : .028);
    // étriers
    box('calipers', .05, .028, .022, M.dark, V(FA.x - .035, FA.y + .07, -.064), -.9);
    box('calipers', .05, .028, .022, M.dark, V(RA.x + .07, RA.y + .03, -.064), .35);

    /* --- transmission --- */
    const TZ = .041, cogR = t => 12.7*t/(2*Math.PI)/1000;
    const cogs = [11, 12, 13, 14, 15, 17, 19, 21, 23, 25, 27, 30];
    cogs.forEach((t, i) => cyl('cassette', cogR(t), .0018, M.steel, V(RA.x, RA.y, .052 - i*.0031), Math.max(12, t)));
    cyl('cassette', .017, .04, M.dark, V(RA.x, RA.y, .035), 16);
    // pédalier : plateaux 52/36, araignée + capteur, manivelles 165 mm
    for (const [t, z] of [[52, .046], [36, .039]]) { const r = cogR(t), m = new T.Mesh(annulus(r, r - .012, .003, 0, 80), t === 52 ? M.dark : M.steel); m.position.set(BB.x, BB.y, z); add('crank', m); }
    for (let i = 0; i < 4; i++) { const a = i/4*Math.PI*2 + .4, m = new T.Mesh(new T.BoxGeometry(.075, .014, .006), M.dark); m.position.set(BB.x + Math.cos(a)*.04, BB.y + Math.sin(a)*.04, .049); m.rotation.z = a; add('crank', m); }
    const ca = -1.1; // angle des manivelles
    for (const z of [1, -1]) { const a = z > 0 ? ca : ca + Math.PI, L = .165, m = new T.Mesh(new T.BoxGeometry(L + .02, .022, .012), M.dark);
      m.position.set(BB.x + Math.cos(a)*L/2, BB.y + Math.sin(a)*L/2, .058*z); m.rotation.z = a; add('crank', m);
      cyl('crank', .007, .02, M.alu, V(BB.x + Math.cos(a)*L, BB.y + Math.sin(a)*L, .072*z), 12); }
    cyl('crank', .012, .13, M.alu, BB.clone(), 16);
    // dérailleurs
    const J1 = V(RA.x + .004, RA.y - .055, .046), J2 = V(RA.x + .034, RA.y - .132, .046);
    box('rd', .028, .04, .016, M.dark, V(RA.x - .012, RA.y - .025, .062), .3);
    const cage = J2.clone().sub(J1); box('rd', .02, cage.length() + .03, .004, M.dark, J1.clone().add(J2).multiplyScalar(.5).add(V(0, 0, .009)), Math.atan2(cage.y, cage.x) - Math.PI/2);
    for (const j of [J1, J2]) cyl('rd', .012, .006, M.matte, j.clone(), 11);
    const FDp = BB.clone().addScaledVector(s, .2); box('fd', .055, .022, .018, M.dark, V(FDp.x + .015, FDp.y, .05), -.2);
    // chaîne : grand plateau → 17 dents → galets → retour
    const rB = cogR(52), rC = cogR(17), pts = [];
    for (let a = -90; a <= 90; a += 15) pts.push(V(BB.x + rB*Math.cos(a*Math.PI/180), BB.y + rB*Math.sin(a*Math.PI/180), TZ + .002));
    for (let a = 90; a <= 205; a += 15) pts.push(V(RA.x + rC*Math.cos(a*Math.PI/180), RA.y + rC*Math.sin(a*Math.PI/180), TZ));
    pts.push(V(J1.x - .013, J1.y + .004, TZ), V(J1.x - .006, J1.y - .03, TZ), V(J2.x - .014, J2.y + .004, TZ), V(J2.x - .004, J2.y - .013, TZ), V(J2.x + .012, J2.y - .008, TZ), V(RA.x + .2, BB.y - rB - .006, TZ + .001));
    tube('chain', pts, .0032, M.steel, true, 260);

    // ombre au sol
    const sm = new T.Mesh(new T.PlaneGeometry(1.7, .5), new T.MeshBasicMaterial({ map: shadowTex(T), transparent: true, depthWrite: false })); sm.rotation.x = -Math.PI/2; sm.position.set(.5, .0005, 0); root.add(sm);

    // décalages de la vue éclatée
    const OFF = { frame: [0, 0, 0], fork: [.16, -.06, 0], wheelF: [.42, 0, 0], tireF: [.78, 0, 0], rotorF: [.42, 0, -.24], wheelR: [-.32, 0, 0], tireR: [-.66, 0, 0], rotorR: [-.32, 0, -.24],
      cassette: [-.16, 0, .32], rd: [-.1, -.14, .36], chain: [.05, -.32, .26], crank: [.14, -.2, .44], bb: [0, -.32, 0], fd: [.06, 0, .3], seatpost: [-.04, .3, 0], battery: [-.24, .14, 0],
      cockpit: [.16, .26, 0], levers: [.32, .34, 0], headset: [.02, .14, .3], calipers: [0, 0, -.4] };
    for (const [k, g] of Object.entries(groups)) { g.userData.off = V(...(OFF[k] || [0, 0, 0])); const bx = new T.Box3().setFromObject(g); g.userData.center = bx.getCenter(V(0, 0, 0)); }
    root.position.set(-.5, 0, 0); // vélo centré sur l'origine
    return { root, groups };
  }

  // environnement réfléchissant (studio) pour le carbone et le métal
  function studio(T, r){
    const sc = new T.Scene(), room = new T.Mesh(new T.BoxGeometry(10, 10, 10), new T.MeshBasicMaterial({ color: 0x17181b, side: T.BackSide })); sc.add(room);
    const light = (w, h, pos, c = 0xffffff) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: c, side: T.DoubleSide })); m.position.copy(pos); m.lookAt(0, 0, 0); sc.add(m); };
    light(6, 2, new T.Vector3(0, 4.9, 0)); light(3, 3, new T.Vector3(4.9, 1, 2), 0xd8e2ff); light(3, 3, new T.Vector3(-4.9, 1.5, -2), 0xfff1dc); light(8, 1, new T.Vector3(0, -1, 4.9), 0x999999);
    const pm = new T.PMREMGenerator(r), env = pm.fromScene(sc, .03).texture; pm.dispose(); return env;
  }

  function setup(model){
    const T = THREE, r = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: !!navigator.webdriver });
    r.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); r.outputEncoding = T.sRGBEncoding; r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1; r.setClearColor(0, 0);
    const scene = new T.Scene(); scene.environment = studio(T, r);
    scene.add(new T.HemisphereLight(0xffffff, 0x30343c, .55));
    const key = new T.DirectionalLight(0xffffff, 1.3); key.position.set(1.5, 3, 2.5); scene.add(key);
    const rim = new T.DirectionalLight(0xbcd0ff, .7); rim.position.set(-2, 1.5, -2); scene.add(rim);
    const cam = new T.PerspectiveCamera(32, 1.3, .05, 40);
    const ctl = new T.OrbitControls(cam, r.domElement); ctl.enableDamping = true; ctl.dampingFactor = .09; ctl.enablePan = false; ctl.minDistance = 1.2; ctl.maxDistance = 8;
    ctl.minPolarAngle = .02; ctl.maxPolarAngle = Math.PI - .02; ctl.rotateSpeed = .8; ctl.target.set(0, .5, 0);
    const b = build(T, model); scene.add(b.root);
    R = { r, scene, cam, ctl, model, ...b }; resetView(true);
    const cv = r.domElement; cv.style.cssText = 'width:100%;height:100%;display:block;touch-action:none';
    let down = null;
    cv.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    cv.addEventListener('pointerup', e => { if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t; down = null; if (moved > 7 || dt > 600) return; tap(e); });
  }
  function resetView(now){ if (!R) return; const T = THREE, dist = 2.75*(1 + .75*ease(st.t));
    const dir = new T.Vector3().setFromSphericalCoords(1, Math.PI*0.44, Math.PI*0.07).normalize(); // 3/4 avant, côté transmission
    R.ctl.target.set(0, .5, 0); R.cam.position.copy(R.ctl.target).addScaledVector(dir, dist); R.cam.lookAt(R.ctl.target); R.ctl.update(); if (!now) kick(); }
  const ease = t => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3)/2;

  function tap(e){
    const T = THREE, cv = R.r.domElement, rc = cv.getBoundingClientRect(), m = new T.Vector2((e.clientX - rc.left)/rc.width*2 - 1, -(e.clientY - rc.top)/rc.height*2 + 1);
    const ray = new T.Raycaster(); ray.setFromCamera(m, R.cam);
    const hits = ray.intersectObjects(Object.values(R.groups).filter(g => g.visible), true).filter(h => h.object.visible && !h.object.material?.transparent);
    let g = hits[0]?.object; while (g && !g.userData.g) g = g.parent;
    st.opts?.onTap?.(g ? g.userData.g : null, !!hits.length);
  }

  /* ---------- étiquettes (vue éclatée) ---------- */
  function tagsHTML(){
    const tg = st.opts?.tags || {};
    return Object.keys(R.groups).filter(k => tg[k]).map(k => { const t = tg[k];
      return `<button type="button" class="gr-tag" data-g3="${k}" style="--c:${t.col}"><span><b>${LABEL[k] || t.l}</b><em>${t.txt}</em></span><span class="gr-tb"><i style="width:${Math.max(4, t.rem*100)}%"></i></span></button>`; }).join('');
  }
  const tmpV = () => new THREE.Vector3();
  function placeTags(w, h){
    const box = st.el?.querySelector('.gr-tags'); if (!box) return; const k = ease(st.t), show = k > .55;
    box.style.opacity = show ? String(Math.min(1, (k - .55)/.35)) : '0'; box.style.pointerEvents = show && st.target ? 'auto' : 'none'; if (!show) return;
    // position projetée de chaque composant, puis on écarte les étiquettes qui se chevauchent (quelques passes)
    const v = tmpV(), L = [];
    for (const el of box.children) { const g = R.groups[el.dataset.g3]; if (!g) continue;
      v.copy(g.userData.center).add(g.position).add(R.root.position).project(R.cam);
      L.push({ el, x: (v.x*.5 + .5)*w, y: (-v.y*.5 + .5)*h, w: (el._w ||= el.offsetWidth) + 4, h: (el._h ||= el.offsetHeight) + 3 }); }
    for (let it = 0; it < 6; it++) for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const a = L[i], b = L[j];
      const ox = (a.w + b.w)/2 - Math.abs(a.x - b.x), oy = (a.h + b.h)/2 - Math.abs(a.y - b.y); if (ox <= 0 || oy <= 0) continue;
      if (oy < ox) { const s = (a.y <= b.y ? -1 : 1)*oy/2; a.y += s; b.y -= s; } else { const s = (a.x <= b.x ? -1 : 1)*ox/2; a.x += s; b.x -= s; } }
    for (const t of L) { t.x = clamp(t.x, t.w/2, w - t.w/2); t.y = clamp(t.y, t.h/2, h - t.h/2); t.el.style.transform = `translate(${t.x}px, ${t.y}px) translate(-50%, -50%)`; }
  }

  /* ---------- boucle ---------- */
  function size(){ const el = st.el; if (!el || !R) return [0, 0]; const w = el.clientWidth || 320, h = el.clientHeight || 260;
    if (R.w !== w || R.h !== h) { R.r.setSize(w, h, false); R.cam.aspect = w/h; R.cam.updateProjectionMatrix(); R.w = w; R.h = h; } return [w, h]; }
  function frame(now){
    if (!R || !st.el?.isConnected) { st.raf = 0; return; }
    const dt = Math.min(.05, (now - (st.last || now))/1000); st.last = now;
    const prev = ease(st.t); st.t = st.target ? Math.min(1, st.t + dt*1.6) : Math.max(0, st.t - dt*1.9); const k = ease(st.t);
    if (k !== prev) { // on recule la caméra pendant l'éclaté, en gardant l'angle choisi par l'utilisateur
      const f = (1 + .75*k)/(1 + .75*prev), off = R.cam.position.clone().sub(R.ctl.target); R.cam.position.copy(R.ctl.target).addScaledVector(off, f); }
    for (const g of Object.values(R.groups)) { g.position.copy(g.userData.off).multiplyScalar(k); if (g.userData.hideAssembled) g.visible = k > .08; }
    R.ctl.update(); const [w, h] = size(); R.r.render(R.scene, R.cam); placeTags(w, h);
    st.raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!st.raf && st.el?.isConnected) { st.last = 0; st.raf = requestAnimationFrame(frame); } };

  /* ---------- API ---------- */
  async function mount(el, opts){
    await loadLibs();
    if (R && R.model !== opts.model) { R.r.dispose(); R = null; }
    if (!R) setup(opts.model);
    st.el = el; st.opts = opts; st.target = opts.exploded ? 1 : 0; if (st.t === 0 && opts.exploded) st.t = 1;
    el.innerHTML = ''; el.appendChild(R.r.domElement);
    const tags = document.createElement('div'); tags.className = 'gr-tags'; tags.innerHTML = tagsHTML(); el.appendChild(tags);
    tags.addEventListener('click', e => { const b = e.target.closest('[data-g3]'); if (b) st.opts?.onTap?.(b.dataset.g3, true); });
    R.w = R.h = 0; kick(); return true;
  }
  function explode(on){ st.target = on ? 1 : 0; kick(); }
  function stop(){ if (st.raf) cancelAnimationFrame(st.raf); st.raf = 0; }
  return { mount, explode, stop, resetView: () => resetView(false), LABEL, get R(){ return R; }, get t(){ return st.t; } };
})();
