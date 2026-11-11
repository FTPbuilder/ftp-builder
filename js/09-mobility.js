"use strict";
// FTP Builder · mobilité : silhouettes SVG, mannequin 3D, routines et lecteur
/* ============ mobilité : silhouettes animées (SVG) ============ */
const MobAnim = (() => {
  const B = 'var(--mb)', B2 = 'var(--mb2)', A = 'var(--accent)', MU = 'var(--muted)';
  const L = (a, b, w, c = B) => `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
  const C = (p, r, c = B, x = '') => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r}" fill="${c}" ${x}/>`;
  const T = (x, y, s, a = 'middle') => `<text x="${x}" y="${y}" text-anchor="${a}" font-size="11" fill="${MU}">${s}</text>`;
  const P = (x, y) => ({ x, y }), add = (p, q) => P(p.x + q.x, p.y + q.y), mul = (p, k) => P(p.x * k, p.y * k);
  const R = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return P(v.x * c - v.y * s, v.x * s + v.y * c); };
  const D = d => d * Math.PI / 180, ease = x => (1 - Math.cos(Math.PI * x)) / 2;
  const S = {
    // vue de face : la tête dessine un grand cercle (flexion → inclinaison → extension → inclinaison)
    neck_cars:{ per:8, vb:'0 0 200 220', f:t => { const th = 2*Math.PI*t, fl = Math.cos(th), tilt = D(24)*Math.sin(th);
      const nb = P(100, 104), hd = add(nb, R(P(0, -30 + 5*fl), tilt)), sh = [P(62, 118), P(138, 118)];
      let h = L(P(100, 150), P(100, 215), 62) + L(sh[0], sh[1], 24);
      for (const s of sh) { const e = add(s, P(s.x < 100 ? -6 : 6, 46)); h += L(s, e, 17) + L(e, add(e, P(0, 42)), 15); }
      h += L(nb, add(nb, R(P(0, -16), tilt)), 16, A);
      const trail = Array.from({ length: 40 }, (_, i) => { const a = 2*Math.PI*i/40; return add(nb, R(P(0, -30 + 5*Math.cos(a)), D(24)*Math.sin(a))); });
      h += `<polyline points="${trail.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')} ${trail[0].x.toFixed(1)},${trail[0].y.toFixed(1)}" fill="none" stroke="${A}" stroke-width="1.4" stroke-dasharray="3 4" opacity=".7"/>`;
      h += C(hd, 21); const eye = P(0, -2 + 7*fl);
      h += C(add(hd, R(add(eye, P(-7, 0)), tilt)), 2.4, '#222') + C(add(hd, R(add(eye, P(7, 0)), tilt)), 2.4, '#222') + C(add(hd, R(add(eye, P(0, 7)), tilt)), 1.8, '#555');
      return h + T(100, 14, 'vue de face · cercle lent, épaules immobiles'); } },
    // vue de dos : les omoplates montent, se serrent, descendent puis s'écartent
    scap_cars:{ per:6, vb:'0 0 200 220', f:t => { const th = 2*Math.PI*t, dy = -10*Math.cos(th), dm = 8*Math.sin(th);
      const sh = [P(62 + dm, 120 + dy), P(138 - dm, 120 + dy)];
      let h = L(P(100, 150), P(100, 215), 62) + L(sh[0], sh[1], 24) + L(P(100, 112), P(100, 210), 2, B2);
      for (const s of sh) { const e = add(s, P(s.x < 100 ? -6 : 6, 46)); h += L(s, e, 17) + L(e, add(e, P(0, 42)), 15); }
      for (const [s, k] of [[sh[0], 1], [sh[1], -1]]) { const a = add(s, P(k*12, 4)), b = add(s, P(k*32, 6)), c = add(s, P(k*24, 42));
        h += `<path d="M${a.x},${a.y} L${b.x},${b.y} L${c.x},${c.y} Z" fill="${A}" opacity=".9" stroke="${A}" stroke-width="4" stroke-linejoin="round"/>`; }
      h += L(P(100, 108), P(100, 86), 15) + C(P(100, 70), 21, B2);
      const lab = ['monte', 'serre', 'descends', 'écarte'][Math.round(th / (Math.PI/2)) % 4];
      return h + T(100, 14, `vue de dos · ${lab}`); } },
    // vue de profil : bras tendu, grand cercle avant → haut → arrière, puis retour par le même chemin
    shoulder_cars:{ per:12, vb:'0 0 200 270', f:t => { const u = t < .5 ? ease(2*t) : 1 - ease(2*t - 1), ph = D(350*u);
      const sh = P(104, 88), hip = P(104, 158), kn = P(104, 208), an = P(104, 258);
      let h = `<circle cx="${sh.x}" cy="${sh.y}" r="88" fill="none" stroke="${A}" stroke-width="1.4" stroke-dasharray="3 4" opacity=".6"/>`;
      h += L(sh, add(sh, P(4, 50)), 15, B2) + L(add(sh, P(4, 50)), add(sh, P(2, 92)), 13, B2);
      h += L(hip, kn, 22) + L(kn, an, 19) + L(an, P(88, 262), 10) + L(hip, sh, 40) + L(sh, P(102, 66), 15) + C(P(98, 50), 19) + C(P(80, 52), 4);
      const hand = add(sh, P(-88*Math.sin(ph), 88*Math.cos(ph))), out = ph > D(150) && ph < D(280);
      h += L(sh, hand, 16, A) + C(hand, 9, out ? '#c96a35' : A);
      return h + T(100, 14, out ? 'paume tournée vers l’extérieur' : 'vue de profil · bras tendu, buste gainé'); } },
    // vue depuis la tête : couché sur le côté, le bras du dessus s'ouvre de l'avant vers l'arrière, le regard suit la main
    open_book:{ per:7, vb:'0 0 260 200', f:t => { const s = ease(t < .5 ? 2*t : 2 - 2*t), psi = D(60*s), a = D(215 - 240*s);
      const bs = P(120, 170), ts = add(bs, R(P(0, -62), psi)), dir = P(Math.cos(a), -Math.sin(a)), hand = add(ts, mul(dir, 82));
      let h = L(P(10, 186), P(250, 186), 2, B2) + `<rect x="34" y="150" width="46" height="30" rx="14" fill="${B2}"/>` + T(57, 144, 'genoux');
      h += L(bs, P(36, 178), 15, B2) + L(bs, ts, 36) + L(ts, hand, 16, A) + C(hand, 8, A);
      const hc = add(bs, R(P(0, -31), psi)); h += C(hc, 20) + C(add(hc, mul(dir, 13)), 3, '#222');
      return h + T(130, 14, 'vue depuis la tête · expire en ouvrant'); } },
    // vue de dessus : avant-bras collé au montant, le buste tourne à l'opposé
    pec_wall:{ per:7, vb:'0 0 220 200', f:t => { const b = D(35*ease(t < .5 ? 2*t : 2 - 2*t)), M = P(130, 120);
      const ls = add(M, R(P(-38, 0), b)), rs = add(M, R(P(38, 0), b)), E = P(36, 120), face = R(P(0, -1), b);
      let h = `<rect x="14" y="30" width="14" height="150" rx="3" fill="${B2}"/>` + T(21, 194, 'montant');
      h += L(ls, rs, 30) + L(rs, add(rs, R(P(16, 20), b)), 15) + L(ls, E, 16, A) + C(E, 10, A);
      h += L(add(ls, mul(face, 8)), add(add(ls, mul(face, 8)), R(P(26, 0), b)), 8, A);
      return h + C(M, 20) + C(add(M, mul(face, 15)), 3.5, '#222') + T(125, 14, 'vue de dessus · le buste tourne'); } },
  };
  const has = id => !!S[id];
  const svg = (id, t = 0) => S[id] ? `<svg viewBox="${S[id].vb}" class="manim" data-ex="${id}" role="img" aria-label="Animation ${id}">${S[id].f(t)}</svg>` : '';
  let raf = 0, t0 = 0;
  function loop(ts){ const els = document.querySelectorAll('svg.manim[data-ex]'); if (!els.length) { raf = 0; return; }
    t0 ||= ts; for (const el of els) { const s = S[el.dataset.ex]; el.innerHTML = s.f(((ts - t0) / 1000 / s.per) % 1); }
    raf = requestAnimationFrame(loop); }
  const start = () => { if (!raf) raf = requestAnimationFrame(loop); };
  return { has, svg, start, S };
})();

/* ============ mobilité : mannequin 3D animé (three.js) ============ */
const Mannequin = (() => {
  const URL3 = 'https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js';
  let lib = null, R = null, cur = null, raf = 0;
  const load = () => lib ||= (window.THREE ? Promise.resolve() : new Promise((ok, ko) => { const s = document.createElement('script'); s.src = URL3; s.onload = ok; s.onerror = () => { lib = null; ko(new Error('3D indisponible')); }; document.head.appendChild(s); }));
  const ease = x => (1 - Math.cos(Math.PI * x)) / 2, sstep = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
  function build(){
    const T = THREE, r = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap;
    r.outputEncoding = T.sRGBEncoding; r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.1;
    const sc = new T.Scene(), BG = 0xe9ebf2; sc.background = new T.Color(BG); sc.fog = new T.Fog(BG, 5, 11);
    sc.add(new T.HemisphereLight(0xffffff, 0xaeb3c4, 0.8));
    const key = new T.DirectionalLight(0xffffff, 1.25); key.position.set(2.2, 4.2, 3); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 5; key.shadow.bias = -0.0004;
    Object.assign(key.shadow.camera, { left: -1.6, right: 1.6, top: 2.4, bottom: -1, near: 0.5, far: 12 }); sc.add(key);
    const rim = new T.DirectionalLight(0xdde4ff, 0.55); rim.position.set(-3, 2.5, -2.5); sc.add(rim);
    const floor = new T.Mesh(new T.PlaneGeometry(40, 40), new T.ShadowMaterial({ opacity: 0.18 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; sc.add(floor);
    const yoga = new T.Mesh(new T.BoxGeometry(0.62, 0.012, 1.8), new T.MeshStandardMaterial({ color: 0x2f3138, roughness: 0.95 })); yoga.position.y = 0.006; yoga.receiveShadow = true; sc.add(yoga);
    const wood = new T.MeshStandardMaterial({ color: 0xe4ddd2, roughness: 0.7 }), wallM = new T.MeshStandardMaterial({ color: 0xf3f2ef, roughness: 0.95 });
    const door = new T.Group(); sc.add(door);
    const jamb = new T.Mesh(new T.BoxGeometry(0.1, 2.15, 0.16), wood); jamb.position.set(0.6, 1.075, -0.1); jamb.castShadow = jamb.receiveShadow = true; door.add(jamb);
    const wall = new T.Mesh(new T.BoxGeometry(1.6, 2.15, 0.12), wallM); wall.position.set(1.45, 1.075, -0.1); wall.receiveShadow = true; door.add(wall);
    const cam = new T.PerspectiveCamera(30, 1.5, 0.1, 30);
    const skin = new T.MeshStandardMaterial({ color: 0xd9b9a0, roughness: 0.6 }), cloth = new T.MeshStandardMaterial({ color: 0x24262c, roughness: 0.85 });
    const hair = new T.MeshStandardMaterial({ color: 0x3b2c24, roughness: 0.8 }), hi = new T.MeshStandardMaterial({ color: 0xff8a4c, roughness: 0.55, emissive: 0x5a2208 });
    for (const m of [skin, cloth, hair, hi, wood, wallM, yoga.material]) m.color.convertSRGBToLinear(); hi.emissive.convertSRGBToLinear();
    const G = (p, x, y, z) => { const g = new T.Group(); g.position.set(x, y, z); g.userData.rest = g.position.clone(); p.add(g); return g; };
    const shadow = m => { m.castShadow = true; m.receiveShadow = true; return m; };
    const ell = (p, sx, sy, sz, m, x = 0, y = 0, z = 0) => { const me = shadow(new T.Mesh(new T.SphereGeometry(1, 32, 24), m)); me.scale.set(sx, sy, sz); me.position.set(x, y, z); p.add(me); return me; };
    const cap = (p, rad, len, m, y) => { const me = shadow(new T.Mesh(new T.CapsuleGeometry(rad, len, 8, 20), m)); me.position.y = y; p.add(me); return me; };
    const root = new T.Group(); sc.add(root);
    const J = { root, sh: [], el: [], hand: [], hip: [], kn: [], an: [], scap: [], arm: [], leg: [], foot: [] };
    J.pelvis = G(root, 0, 0.995, 0); ell(J.pelvis, 0.155, 0.11, 0.105, cloth, 0, 0.01);
    J.spine = G(J.pelvis, 0, 0.08, 0); J.spineM = ell(J.spine, 0.13, 0.12, 0.09, skin, 0, 0.07);
    J.chest = G(J.spine, 0, 0.15, 0); ell(J.chest, 0.17, 0.17, 0.105, cloth, 0, 0.11); ell(J.chest, 0.2, 0.07, 0.09, cloth, 0, 0.2);
    J.neck = G(J.chest, 0, 0.28, 0); const neckM = cap(J.neck, 0.043, 0.06, skin, 0.03);
    J.head = G(J.neck, 0, 0.075, 0); ell(J.head, 0.084, 0.11, 0.096, skin, 0, 0.1); ell(J.head, 0.088, 0.085, 0.092, hair, 0, 0.145, -0.018); ell(J.head, 0.045, 0.045, 0.045, hair, 0, 0.12, -0.105); ell(J.head, 0.014, 0.022, 0.018, skin, 0, 0.085, 0.094);
    for (const s of [1, -1]) {
      const sh = G(J.chest, s * 0.19, 0.215, 0); ell(sh, 0.05, 0.052, 0.05, skin, 0, -0.01);
      const up = cap(sh, 0.043, 0.24, skin, -0.14); const el = G(sh, 0, -0.29, 0); const fo = cap(el, 0.036, 0.2, skin, -0.12);
      const hd = G(el, 0, -0.265, 0); const hm = ell(hd, 0.033, 0.07, 0.022, skin, 0, -0.045);
      J.sh.push(sh); J.el.push(el); J.hand.push(hd); J.arm.push([up, fo, hm]);
      const hp = G(J.pelvis, s * 0.088, -0.06, 0); const thM = cap(hp, 0.064, 0.32, cloth, -0.2); const kn = G(hp, 0, -0.43, 0); const shM = cap(kn, 0.05, 0.32, cloth, -0.19); J.leg.push([thM, shM]);
      const an = G(kn, 0, -0.43, 0); J.foot.push(ell(an, 0.042, 0.032, 0.115, skin, 0, -0.04, 0.055)); J.hip.push(hp); J.kn.push(kn); J.an.push(an);
      J.scap.push(ell(J.chest, 0.042, 0.078, 0.012, hi, s * 0.09, 0.16, -0.103));
    }
    const ring = new T.LineLoop(new T.BufferGeometry().setFromPoints(Array.from({ length: 96 }, (_, i) => { const a = 2 * Math.PI * i / 96; return new T.Vector3(0, -Math.cos(a) * 0.56, Math.sin(a) * 0.56); })), new T.LineDashedMaterial({ color: 0xff8a4c, dashSize: 0.03, gapSize: 0.025, transparent: true, opacity: 0.95 }));
    ring.computeLineDistances(); sc.add(ring);
    const wall2 = new T.Mesh(new T.BoxGeometry(1, 1, 1), wallM); wall2.receiveShadow = true; sc.add(wall2);
    const boxM = new T.MeshStandardMaterial({ color: 0xc9bfae, roughness: 0.9 }); boxM.color.convertSRGBToLinear(); const box = shadow(new T.Mesh(new T.BoxGeometry(1, 1, 1), boxM)); sc.add(box);
    const band = new T.Mesh(new T.CylinderGeometry(0.009, 0.009, 1, 8), hi); sc.add(band);
    R = { T, r, sc, cam, J, yoga, door, ring, neckM, wall2, box, band, mats: { skin, cloth, hi } };
  }
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  function aim(g, dir, twist = 0){ const T = THREE; g.parent.updateMatrixWorld(true); const qp = new T.Quaternion(); g.parent.getWorldQuaternion(qp);
    g.quaternion.copy(qp.invert().multiply(new T.Quaternion().setFromUnitVectors(V(0, -1, 0), dir.clone().normalize()))); if (twist) g.rotateY(twist); g.updateMatrixWorld(true); }
  const wpos = g => { g.updateMatrixWorld(true); return g.getWorldPosition(V(0, 0, 0)); };
  function reset(){
    const { J } = R; J.root.position.set(0, 0, 0); J.root.rotation.set(0, 0, 0);
    J.root.traverse(o => { if (o.isGroup && o !== J.root) { o.rotation.set(0, 0, 0); o.quaternion.identity(); if (o.userData.rest) o.position.copy(o.userData.rest); } });
    for (let i = 0; i < 2; i++) { J.sh[i].rotation.z = (i ? -1 : 1) * 0.07; J.el[i].rotation.x = -0.12; J.arm[i].forEach(m => m.material = R.mats.skin); J.scap[i].visible = false; J.hand[i].scale.set(1, 1, 1); }
    for (let i = 0; i < 2; i++) { J.leg[i].forEach(m => m.material = R.mats.cloth); J.foot[i].material = R.mats.skin; } J.spineM.material = R.mats.skin;
    R.wall2.visible = R.box.visible = R.band.visible = false; R.door.position.set(0, 0, 0);
    R.neckM.material = R.mats.skin; R.yoga.rotation.y = 0; R.yoga.position.set(0, 0.006, 0); R.door.visible = false; R.yoga.visible = true; R.ring.visible = false;
  }
  const HL = i => R.J.arm[i].forEach(m => m.material = R.mats.hi);
  // ---- aides de pose en repère monde ----
  const N = (x, y, z) => V(x, y, z).normalize(), pp = t => ease(t < 0.5 ? 2 * t : 2 - 2 * t), SG = i => i ? -1 : 1;
  function orient(g, Y, Z, zFirst){ const T = THREE, y = Y.clone().normalize(), z = Z.clone().normalize();
    if (zFirst) y.sub(z.clone().multiplyScalar(y.dot(z))).normalize(); else z.sub(y.clone().multiplyScalar(z.dot(y))).normalize();
    const q = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(V(0, 0, 0).crossVectors(y, z), y, z));
    g.parent.updateMatrixWorld(true); const qp = new T.Quaternion(); g.parent.getWorldQuaternion(qp); g.quaternion.copy(qp.invert().multiply(q)); g.updateMatrixWorld(true); }
  // corps : U = axe tête, F = ventre, P = position du bassin
  function body(U, F, P){ const r = R.J.root; r.position.set(0, 0, 0); orient(r, U, F); r.position.copy(P.clone().sub(wpos(R.J.pelvis))); r.updateMatrixWorld(true); }
  // IK 2 segments : extrémité sur T, coude/genou du côté de « pole »
  function two(a, b, L1, L2, T, pole){ const S = wpos(a), v = T.clone().sub(S), d = Math.min(Math.max(v.length(), 0.05), (L1 + L2) * 0.999), u = v.normalize();
    const ca = Math.min(1, Math.max(-1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))), p = pole.clone().sub(u.clone().multiplyScalar(pole.dot(u))).normalize();
    const E = S.clone().addScaledVector(u, L1 * ca).addScaledVector(p, L1 * Math.sqrt(1 - ca * ca)); aim(a, E.clone().sub(S)); aim(b, T.clone().sub(E)); }
  const armTo = (i, T, pole) => two(R.J.sh[i], R.J.el[i], 0.29, 0.265, T, pole), legTo = (i, T, pole) => two(R.J.hip[i], R.J.kn[i], 0.43, 0.43, T, pole);
  const armDir = (i, a, b) => { aim(R.J.sh[i], a); aim(R.J.el[i], b || a); }, legDir = (i, a, b) => { aim(R.J.hip[i], a); aim(R.J.kn[i], b || a); };
  const foot = (i, toe, up = V(0, 1, 0)) => orient(R.J.an[i], up, toe, true), palm = (i, fing, n = V(0, 1, 0)) => orient(R.J.hand[i], fing.clone().negate(), n, true);
  const hang = i => armDir(i, N(SG(i) * 0.12, -1, 0.02), N(SG(i) * 0.06, -1, 0.12));
  const onHips = i => { const s = SG(i), q = R.J.root.quaternion; armTo(i, wpos(R.J.pelvis).add(V(s * 0.17, 0.07, 0.01).applyQuaternion(q)), V(s, 0, -0.5).applyQuaternion(q)); };
  const KF = (ks, t, j = 1) => { let i = 0; while (i < ks.length - 2 && t > ks[i + 1][0]) i++; const a = ks[i], b = ks[i + 1], u = ease(Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0])))); return V(...a[j]).lerp(V(...b[j]), u).normalize(); };
  const HLL = (i, k = [0, 1]) => k.forEach(j => R.J.leg[i][j].material = R.mats.hi), HLF = i => { R.J.foot[i].material = R.mats.hi; }, HLS = () => { R.J.spineM.material = R.mats.hi; };
  const prop = (m, x, y, z, sx, sy, sz) => { m.visible = true; m.position.set(x, y, z); m.scale.set(sx, sy, sz); };
  function band(a, b){ const m = R.band, d = b.clone().sub(a); m.visible = true; m.position.copy(a).addScaledVector(d, 0.5); m.scale.set(1, d.length(), 1); m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); }
  // à quatre pattes : genoux sous les hanches, mains sous les épaules (cibles mémorisées avant flexion de la colonne)
  function quad(bend = () => {}){ const { J } = R; let a = 0.2;
    for (let it = 0; it < 4; it++) { body(N(0, Math.sin(a), Math.cos(a)), N(0, -Math.cos(a), Math.sin(a)), V(0, 0.52, -0.25)); bend(); a += (0.6 - (wpos(J.sh[0]).y + wpos(J.sh[1]).y) / 2) / 0.45; }
    for (let i = 0; i < 2; i++) { legDir(i, N(SG(i) * 0.02, -1, -0.05), V(0, -0.08, -1)); foot(i, V(0, 0, -1), V(0, -1, 0)); }
    R.qT = [0, 1].map(i => V(SG(i) * 0.19, 0.035, 0.22)); }
  const quadArms = skip => { for (let i = 0; i < 2; i++) if (i !== skip) { armTo(i, R.qT[i], V(0, 0.2, -1)); palm(i, V(0, 0, 1)); } };
  // sommets du mannequin : contact au sol et cadrage
  function verts(fn, step = 1){ const v = V(0, 0, 0); R.J.root.updateMatrixWorld(true);
    R.J.root.traverse(o => { if (!o.isMesh || !o.visible) return; const p = o.geometry.attributes.position; for (let k = 0; k < p.count; k += step) fn(v.fromBufferAttribute(p, k).applyMatrix4(o.matrixWorld)); }); }
  function drop(){ let m = Infinity; verts(v => { if (v.y < m) m = v.y; }, 2); R.J.root.position.y += 0.012 - m; R.J.root.updateMatrixWorld(true); }
  const FR = {};
  function frame(id){ const k = id + R.cam.aspect.toFixed(2); if (FR[k]) return FR[k]; const e = EX[id], bx = new THREE.Box3(), pts = [];
    for (let i = 0; i < 8; i++) { apply(id, i / 8); verts(v => { bx.expandByPoint(v); pts.push(v.clone()); }, 7); }
    const c = bx.getCenter(V(0, 0, 0)), d = V(...e.v).normalize(), rt = V(0, 0, 0).crossVectors(d, V(0, 1, 0)).normalize(), up = V(0, 0, 0).crossVectors(rt, d);
    const tv = Math.tan(R.cam.fov * Math.PI / 360) / (e.z || 1.06); let D = 0;
    for (const p of pts) { const q = p.sub(c), z = q.dot(d); D = Math.max(D, z + Math.abs(q.dot(up)) / tv, z + Math.abs(q.dot(rt)) / (tv * R.cam.aspect)); }
    return FR[k] = [c.clone().addScaledVector(d, D).toArray(), c.toArray()]; }
  function apply(id, t){ reset(); EX[id].f(t); if (!EX[id].cam) drop(); }
  const EX = {
    neck_cars:{ per:8, key:0.25, cam:[[0.6, 1.66, 1.6], [0, 1.47, 0]], f:t => { const { J } = R, th = 2 * Math.PI * t, c = Math.cos(th);
      J.neck.rotation.x = 0.42 * c; J.neck.rotation.z = 0.42 * Math.sin(th); J.head.rotation.x = 0.25 * c; J.head.rotation.z = 0.2 * Math.sin(th); R.neckM.material = R.mats.hi; } },
    scap_cars:{ per:6, key:0.15, cam:[[-0.5, 1.66, -1.95], [0, 1.32, 0]], f:t => { const { J } = R, th = 2 * Math.PI * t, up = Math.cos(th), back = Math.sin(th);
      for (let i = 0; i < 2; i++) { const s = i ? -1 : 1, sh = J.sh[i], sp = J.scap[i];
        sh.position.set(s * (0.19 - 0.022 * back), 0.215 + 0.04 * up, -0.035 * back + 0.02 * Math.max(0, -back));
        sp.visible = true; sp.position.set(s * (0.09 - 0.03 * back), 0.16 + 0.04 * up, -0.103); sp.rotation.z = s * 0.25 * up; } } },
    shoulder_cars:{ per:12, key:0.25, cam:[[2.75, 1.3, 0.5], [0, 1.16, 0.12]], f:t => { const { J } = R, u = t < 0.5 ? ease(2 * t) : 1 - ease(2 * t - 1), ph = 350 * u * Math.PI / 180;
      HL(0); J.hand[0].scale.set(1, 0.72, 1.3); J.el[0].rotation.x = 0;
      aim(J.sh[0], V(0.06, -Math.cos(ph), Math.sin(ph)), -Math.PI * 0.85 * sstep(2.5, 4.2, ph));
      R.ring.visible = true; R.ring.position.copy(wpos(J.sh[0])); R.ring.position.x += 0.06; } },
    open_book:{ per:7, key:0.5, cam:[[0.45, 2.05, 2.15], [-0.05, 0.22, 0.05]], f:t => { const { J } = R, s = ease(t < 0.5 ? 2 * t : 2 - 2 * t), a = 0.12 + 2.85 * s;
      J.root.rotation.z = Math.PI / 2; J.root.position.set(0.8, 0.165, 0); R.yoga.rotation.y = Math.PI / 2; R.yoga.position.set(-0.05, 0.006, 0.2);
      for (let i = 0; i < 2; i++) { J.hip[i].rotation.x = -1.45; J.kn[i].rotation.x = 1.55; }
      J.hip[0].position.z = 0.03; J.spine.rotation.y = 0.3 * s; J.chest.rotation.y = 0.75 * s; J.neck.rotation.z = -0.25; J.head.rotation.y = 0.55 * s; J.head.rotation.x = 0.1;
      aim(J.sh[1], V(0, 0.02, 1)); J.el[1].rotation.x = 0; J.el[0].rotation.x = 0;
      HL(0); aim(J.sh[0], V(0, Math.sin(a), Math.cos(a))); } },
    pec_wall:{ per:7, key:0.5, cam:[[-0.55, 2.35, 2.5], [0.25, 1.15, 0]], f:t => { const { J } = R, s = ease(t < 0.5 ? 2 * t : 2 - 2 * t);
      R.door.visible = true; R.yoga.visible = false; J.root.rotation.y = -0.75 * s; J.root.position.z = 0.04 * s; J.head.rotation.y = -0.15 * s;
      const E = V(0.52, 1.46, 0.0), S0 = wpos(J.sh[0]); HL(0);
      aim(J.sh[0], E.clone().sub(S0)); J.el[0].rotation.set(0, 0, 0); aim(J.el[0], V(0, 1, 0)); } },
    // ---- 24 exercices posés en repère monde (IK 2 segments, contact au sol automatique, cadrage auto via v = direction caméra) ----
    spine_cars:{ per:10, key:0, v:[1.3, 0.35, 1], f:t => { const { J } = R, th = 2 * Math.PI * t, c = Math.cos(th), sn = Math.sin(th), fx = c > 0 ? c : 0.55 * c; HLS();
      J.spine.rotation.x = 0.4 * fx; J.chest.rotation.x = 0.45 * fx; J.neck.rotation.x = 0.35 * fx; J.spine.rotation.z = 0.2 * sn; J.chest.rotation.z = 0.25 * sn; J.neck.rotation.z = 0.15 * sn;
      for (let i = 0; i < 2; i++) { J.hip[i].rotation.x = -0.12; J.kn[i].rotation.x = 0.22; J.an[i].rotation.x = -0.1; hang(i); } } },
    hip_cars:{ per:10, key:0.42, v:[1.5, 0.45, 1.1], f:t => { HLL(0);
      const ks = [[0, [0, -1, 0], [0, -1, 0]], [0.18, [0.05, 0.08, 1], [0, -1, 0.05]], [0.42, [1, 0.08, 0.25], [0.05, -1, 0]], [0.64, [0.6, -0.25, -0.75], [0.75, 0.35, 0.45]], [0.84, [0.15, -0.95, -0.3], [0.15, -0.9, -0.4]], [1, [0, -1, 0], [0, -1, 0]]];
      legDir(0, KF(ks, t), KF(ks, t, 2)); onHips(0); onHips(1); } },
    knee_cars:{ per:8, key:0.15, v:[1.6, 0.45, 0.9], f:t => { const { J } = R, th = 2 * Math.PI * t; HLL(0, [1]);
      J.spine.rotation.x = 0.12; legDir(0, N(0.04, 0.02, 1), N(0.22 * Math.sin(th), -1, 0.22 * Math.cos(th))); foot(0, N(0.45 * Math.sin(th), 0.2 * Math.cos(th), 1));
      const M = wpos(J.hip[0]).lerp(wpos(J.kn[0]), 0.55); armTo(0, M.clone().add(V(0.07, -0.04, 0)), V(1, -0.3, -0.5)); armTo(1, M.clone().add(V(-0.06, -0.06, 0)), V(-1, -0.3, -0.5)); } },
    ankle_cars:{ per:6, key:0.1, v:[1.4, 0.3, 1.3], f:t => { const th = 2 * Math.PI * t; HLF(0);
      legDir(0, N(0.03, 0.05, 1), V(0, -1, 0)); foot(0, N(0.55 * Math.sin(th), 0.55 * Math.cos(th), 0.75)); onHips(0); onHips(1); } },
    foot_cars:{ per:6, key:0.3, v:[0.9, 1, 1.6], f:t => { const { J } = R, th = 2 * Math.PI * t; body(N(0, 1, -0.3), N(0, 0.3, 1), V(0, 0.13, 0));
      for (let i = 0; i < 2; i++) { const s = SG(i); legDir(i, N(s * 0.1, -0.12, 1)); HLF(i); foot(i, N(s * (0.15 + 0.4 * Math.sin(th)), 0.85 + 0.35 * Math.cos(th), 0.35), V(0, 0, -1));
        armTo(i, wpos(J.pelvis).add(V(s * 0.22, 0, -0.28)).setY(0.035), V(s * 0.5, 0, -1)); palm(i, V(s * 0.3, 0, -1)); } } },
    cat_cow:{ per:6, key:0, v:[1.7, 0.5, 0.25], f:t => { const { J } = R, c = Math.cos(2 * Math.PI * t); HLS();
      quad(() => { J.spine.rotation.x = 0.32 * c; J.chest.rotation.x = 0.26 * c; J.neck.rotation.x = 0.45 * c + 0.05; }); quadArms(); } },
    thread_needle:{ per:8, key:0.25, v:[1.25, 0.55, 1.15], f:t => { const { J } = R, k = Math.sin(2 * Math.PI * t); HL(0);
      quad(() => { J.spine.rotation.y = 0.3 * k; J.chest.rotation.y = 0.7 * k; J.neck.rotation.y = 0.5 * k; }); quadArms(0);
      if (k < 0) { armTo(0, R.qT[0].clone().lerp(V(-0.3, 0.05, R.qT[1].z - 0.02), -k), V(0, 1, -0.4)); palm(0, V(-1, 0, 0)); }
      else armTo(0, wpos(J.sh[0]).add(V(0, -1, 0.03).lerp(V(0.3, 1, 0.05), k).normalize().multiplyScalar(0.58)), V(0, 0, 1)); } },
    wall_slides:{ per:6, key:0.5, v:[0.9, 0.3, 1.9], f:t => { const s = pp(t); prop(R.wall2, 0, 1.1, -0.2, 2.4, 2.2, 0.1); HL(0); HL(1);
      for (let i = 0; i < 2; i++) { const g = SG(i); armDir(i, V(g, -0.35, -0.04).lerp(V(g * 0.45, 1, -0.04), s).normalize(), V(g * 0.12, 1, -0.04).lerp(V(g * 0.4, 1, -0.04), s).normalize()); } } },
    streamline:{ per:6, key:0.5, v:[0.9, 0.3, 1.9], f:t => { const s = pp(t); prop(R.wall2, 0, 1.1, -0.2, 2.4, 2.2, 0.1); HL(0); HL(1);
      R.J.spine.rotation.x = 0.06 * s; for (let i = 0; i < 2; i++) armDir(i, N(-SG(i) * (0.3 + 0.03 * s), 1, -0.03 - 0.04 * s)); } },
    lat_prayer:{ per:7, key:0.5, v:[1.8, 0.7, -0.5], f:t => { const { J } = R, s = pp(t); HL(0); HL(1);
      body(N(0, -0.3 - 0.12 * s, 1), N(0, -1, -0.3 - 0.12 * s), V(0, 0.3, -0.05 - 0.04 * s)); J.neck.rotation.x = 0.15;
      for (let i = 0; i < 2; i++) { const g = SG(i), H = wpos(J.hip[i]), e = Math.asin(Math.min(0.95, Math.max(0.1, (H.y - 0.055) / 0.43)));
        aim(J.hip[i], N(g * 0.08, -Math.sin(e), Math.cos(e))); aim(J.kn[i], V(g * 0.12, 0.07, H.z - 0.1).sub(wpos(J.kn[i]))); foot(i, V(0, 0, -1), V(0, -1, 0));
        const S = wpos(J.sh[i]); armTo(i, V(g * 0.24, 0.035, S.z + 0.5), V(0, 1, 0)); palm(i, V(0, 0, 1)); } } },
    sleeper:{ per:7, key:0.6, v:[0.25, 1.3, 1.3], f:t => { const { J } = R, a = 1.15 * pp(t); HL(1);
      body(V(-1, 0, 0), V(0, 0, 1), V(0.42, 0.2, 0)); R.yoga.rotation.y = Math.PI / 2; R.yoga.position.set(0, 0.006, 0.15);
      for (let i = 0; i < 2; i++) { J.hip[i].rotation.x = -1.1; J.kn[i].rotation.x = 1.4; } J.neck.rotation.z = 0.3;
      armDir(1, N(0, -0.05, 1), N(Math.sin(a), Math.cos(a), 0)); armTo(0, wpos(J.hand[1]).add(V(0.02, 0.07, 0)), V(0, 0.5, 1)); } },
    band_er:{ per:5, key:0.7, v:[0.35, 0.55, 1.9], f:t => { const a = -0.45 + 1.35 * pp(t); R.door.visible = true; R.door.position.x = -1.05; HL(0);
      armDir(0, N(0.04, -1, 0.02), N(Math.sin(a), -0.03, Math.cos(a))); hang(1); band(wpos(R.J.hand[0]), V(-0.42, wpos(R.J.hand[0]).y, -0.04)); } },
    ankle_pf:{ per:6, key:0.75, v:[1.8, 0.5, 0.6], f:t => { const { J } = R, s = pp(t); HLF(0); HLF(1);
      body(N(0, 1, -0.15 * s), N(0, 0.15 * s, 1), V(0, 0.22, 0));
      for (let i = 0; i < 2; i++) { const g = SG(i), H = wpos(J.hip[i]), e = Math.asin(Math.min(0.95, (H.y - 0.055) / 0.43)) - 0.32 * s;
        aim(J.hip[i], N(g * 0.03, -Math.sin(e), Math.cos(e))); aim(J.kn[i], V(g * 0.1, 0.075, H.z - 0.06).sub(wpos(J.kn[i]))); foot(i, V(0, 0, -1), V(0, -1, 0));
        armTo(i, wpos(J.hip[i]).lerp(wpos(J.kn[i]), 0.75).add(V(g * 0.02, 0.07, 0)), V(g, 0, -0.4)); palm(i, V(0, 0, 1)); } } },
    knee_wall:{ per:5, key:0.6, v:[1.9, 0.5, 0.15], f:t => { const s = pp(t); HLL(0, [1]); HLF(0); prop(R.wall2, 0, 1.1, 0.6, 2.4, 2.2, 0.1);
      body(N(0, 1, 0.12), V(0, 0, 1), V(0, 0.86 - 0.07 * s, 0.02 + 0.14 * s));
      legTo(0, V(0.1, 0.075, 0.32), V(0, 0, 1)); foot(0, V(0, 0, 1)); legTo(1, V(-0.1, 0.075, -0.4), V(0, -0.2, 1)); foot(1, V(0, 0, 1));
      for (let i = 0; i < 2; i++) { armTo(i, V(SG(i) * 0.22, 1.25, 0.53), V(SG(i), -0.5, -0.4)); palm(i, V(0, 1, 0), V(0, 0, -1)); } } },
    calf_wall:{ per:8, key:0.25, v:[1.9, 0.45, 0.1], f:t => { const b = pp(t); HLL(0, [1]); prop(R.wall2, 0, 1.1, 0.75, 2.4, 2.2, 0.1);
      body(N(0, 1, 0.3), N(0, -0.3, 1), V(0, 0.84 - 0.06 * b, 0.05));
      legTo(1, V(-0.1, 0.075, 0.3), V(0, 0, 1)); foot(1, V(0, 0, 1)); legTo(0, V(0.1, 0.075, -0.45 + 0.12 * b), V(0, -0.3, 1)); foot(0, V(0, 0, 1));
      for (let i = 0; i < 2; i++) { armTo(i, V(SG(i) * 0.22, 1.3, 0.68), V(SG(i), -0.5, -0.4)); palm(i, V(0, 1, 0), V(0, 0, -1)); } } },
    ninety:{ per:8, key:0, v:[0.5, 1.4, 1.6], f:t => { const u = pp(t), e = Math.sin(Math.PI * u) * 1.1; HLL(0, [0]); HLL(1, [0]);
      body(V(0, 1, 0), V(0, 0, 1), V(0, 0.13, 0));
      const A = [[V(-0.28, 0.06, 0.45), V(0.55, 0.06, -0.3)], [V(-0.55, 0.06, -0.3), V(0.28, 0.06, 0.45)]];
      for (let i = 0; i < 2; i++) { const az = (i ? -90 + 80 * u : 10 + 80 * u) * Math.PI / 180;
        legTo(i, A[i][0].clone().lerp(A[i][1], u), V(Math.sin(az) * Math.cos(e), Math.sin(e), Math.cos(az) * Math.cos(e)));
        armTo(i, V(SG(i) * 0.26, 0.035, -0.22), V(SG(i), 0, -0.4)); palm(i, V(SG(i) * 0.3, 0, -1)); } } },
    hip_flexor:{ per:8, key:0.7, v:[1.9, 0.45, 0.1], f:t => { const { J } = R, s = pp(t), a = 1.05 * Math.PI * s; HLL(0, [0]);
      body(N(0, 1, -0.05 * s), N(0, 0.05 * s, 1), V(0, 0.55 - 0.03 * s, 0.02 + 0.09 * s));
      legTo(1, V(-0.12, 0.075, 0.55), V(0, 0.3, 1)); foot(1, V(0, 0, 1)); legTo(0, V(0.1, 0.075, -0.5), V(0, -1, 0.15)); foot(0, V(0, 0, -1), V(0, -1, 0));
      armDir(0, N(0.05, -Math.cos(a), Math.sin(a))); armTo(1, wpos(J.kn[1]).add(V(0, 0.07, 0)), V(-1, 0, -0.3)); } },
    quad_couch:{ per:8, key:0.8, v:[1.9, 0.5, 0.1], f:t => { const { J } = R, s = pp(t); HLL(0, [0]); prop(R.box, 0, 0.22, -0.62, 1.1, 0.44, 0.6);
      body(N(0, 1, 0.55 * (1 - s)), N(0, -0.55 * (1 - s), 1), V(0, 0.52, 0));
      legTo(1, V(-0.12, 0.075, 0.55), V(0, 0.3, 1)); foot(1, V(0, 0, 1));
      legDir(0, V(0.1, 0.06, -0.24).sub(wpos(J.hip[0])), N(0, 1, -0.05)); foot(0, V(0, 0, -1), V(0, -1, 0));
      armTo(1, wpos(J.kn[1]).add(V(0, 0.07, 0)), V(-1, 0, -0.3)); onHips(0); } },
    ham_hinge:{ per:7, key:0.8, v:[1.9, 0.45, 0.35], f:t => { const { J } = R, a = 0.1 + 0.85 * pp(t); HLL(0, [0]); prop(R.box, 0.1, 0.1, 0.58, 0.45, 0.2, 0.32);
      body(N(0, Math.cos(a), Math.sin(a)), N(0, -Math.sin(a), Math.cos(a)), V(0, 0.95, -0.02 - 0.05 * pp(t)));
      legTo(0, V(0.1, 0.27, 0.56), V(0, 1, 0.2)); foot(0, N(0, 0.85, 0.5), N(0, 0.5, -0.85)); legTo(1, V(-0.1, 0.075, -0.04), V(0, 0, 1)); foot(1, V(0, 0, 1));
      const M = wpos(J.hip[0]).lerp(wpos(J.kn[0]), 0.7); for (let i = 0; i < 2; i++) armTo(i, M.clone().add(V(SG(i) * 0.06, 0.06, 0)), V(SG(i), 0.3, -0.5)); } },
    glute_fig4:{ per:7, key:0.8, v:[1.2, 0.8, 1.5], f:t => { const { J } = R, a = -0.1 + 0.55 * pp(t); HLL(0, [0]);
      body(V(0, 0, -1), V(0, 1, 0), V(0, 0.12, 0.25));
      legDir(1, N(0, Math.cos(a), -Math.sin(a)), N(0, Math.sin(a), Math.cos(a)));
      legTo(0, wpos(J.kn[1]).add(V(0.03, 0.07, -0.05)), V(1, 0.4, 0.2)); foot(0, V(-1, 0, 0.2));
      const M = wpos(J.hip[1]).lerp(wpos(J.kn[1]), 0.6); for (let i = 0; i < 2; i++) armTo(i, M.clone().add(V(SG(i) * 0.08, 0, -0.06)), V(SG(i), 0, -0.3)); } },
    cobra:{ per:6, key:0.55, v:[1.9, 0.55, 0.6], f:t => { const { J } = R, s = sstep(0, 0.35, t) * (1 - sstep(0.75, 1, t)); HLS();
      body(V(0, 0, 1), V(0, -1, 0), V(0, 0.11, -0.25));
      for (let i = 0; i < 2; i++) { legDir(i, N(SG(i) * 0.06, -0.03, -1)); foot(i, V(0, 0, -1), V(0, -1, 0)); }
      const T = [0, 1].map(i => { const S = wpos(J.sh[i]); return V(S.x + SG(i) * 0.04, 0.035, S.z - 0.06); });
      J.spine.rotation.x = -0.45 * s; J.chest.rotation.x = -0.4 * s; J.neck.rotation.x = -0.25 * s;
      for (let i = 0; i < 2; i++) { armTo(i, T[i], N(SG(i) * 0.3, 0.6, -1)); palm(i, V(0, 0, 1)); } } },
    worlds:{ per:8, key:0.62, v:[1.6, 0.6, 0.9], f:t => { const { J } = R, o = sstep(0.25, 0.85, pp(t)); HL(0);
      body(N(0, 0.2, 1), N(0, -1, 0.2), V(0, 0.48, -0.02));
      legTo(0, V(0.16, 0.075, 0.58), V(0.15, 0.2, 1)); foot(0, V(0, 0, 1)); legTo(1, V(-0.1, 0.1, -0.72), V(0, -0.4, 1)); foot(1, N(0, -0.5, 0.85), N(0, 0.85, 0.5));
      J.spine.rotation.y = 0.25 * o - 0.1; J.chest.rotation.y = 0.85 * o - 0.25; J.neck.rotation.y = 0.5 * o;
      armTo(1, V(-0.02, 0.035, 0.55), V(-1, 0, -0.2)); palm(1, V(0, 0, 1));
      armTo(0, V(0.06, 0.12, 0.5).lerp(wpos(J.sh[0]).add(N(0.25, 1, 0.05).multiplyScalar(0.55)), o), V(0, 1, -0.5)); } },
    leg_swings:{ per:6, key:0.12, v:[1.4, 0.4, 1.4], f:t => { const sg = t < 0.5, a = Math.sin(4 * Math.PI * t); HLL(0); prop(R.wall2, -0.62, 1.1, 0, 0.1, 2.2, 1.6);
      const d = sg ? N(0, -Math.cos(0.8 * a), Math.sin(0.8 * a)) : N(Math.sin(a > 0 ? 0.6 * a : 0.45 * a), -Math.cos(0.6 * a), 0.12);
      legDir(0, d, d.clone().add(V(0, 0, -0.08)).normalize()); armTo(1, V(-0.55, 1.32, 0.05), V(0, -1, -0.3)); palm(1, V(0, 1, 0), V(1, 0, 0)); onHips(0); } },
    hip_open_walk:{ per:6, key:0.55, v:[1, 0.45, 1.6], f:t => { HLL(0); const sw = Math.sin(2 * Math.PI * t);
      const ks = [[0, [0, -1, 0], [0, -1, 0]], [0.3, [0.08, 0.12, 1], [0, -1, 0.1]], [0.6, [1, 0.12, 0.25], [0.1, -1, 0]], [0.85, [0.25, -0.95, 0.15], [0, -1, 0]], [1, [0, -1, 0], [0, -1, 0]]];
      legDir(0, KF(ks, t), KF(ks, t, 2)); armDir(0, N(0.12, -1, -0.25 * sw), N(0.06, -1, 0.3)); armDir(1, N(-0.12, -1, 0.25 * sw), N(-0.06, -1, 0.3)); } },
    lunge_matrix:{ per:9, key:0.17, v:[1.3, 0.55, 1.6], f:t => { const ph = Math.min(2, Math.floor(t * 3)), k = Math.sin(Math.PI * (t * 3 - ph)); HLL(0);
      const D = [[V(0.12, 0.075, 0.78), V(0.02, 0.64, 0.3), 0, V(0, 0, 1), V(0, 0, 1)], [V(0.78, 0.075, 0.05), V(0.33, 0.76, 0), 0, N(0.3, 0, 1), V(1, 0, 0.3)], [V(0.55, 0.075, -0.5), V(0.2, 0.72, -0.16), 0.7, N(1, 0, -1), N(1, 0, -1)]][ph];
      const yaw = D[2] * k; body(V(0, 1, 0), V(Math.sin(yaw), 0, Math.cos(yaw)), V(0, 0.995, 0).lerp(D[1], k));
      legTo(0, V(0.09, 0.075, 0).lerp(D[0], k), D[4]); foot(0, V(0, 0, 1).lerp(D[3], k).normalize()); legTo(1, V(-0.09, 0.075, 0), V(0, 0, 1)); foot(1, V(0, 0, 1));
      onHips(0); onHips(1); } },
  };
  function pose(id, t){ const [p, l] = EX[id].cam || frame(id); apply(id, t); R.cam.position.set(...p); R.cam.lookAt(...l); }
  function size(w, h){ R.r.setSize(w, h, false); R.cam.aspect = w / h; R.cam.updateProjectionMatrix(); }
  async function mount(el, id){
    await load(); if (!R) build(); cur = { el, id, t0: performance.now() };
    const cv = R.r.domElement; cv.style.cssText = 'width:100%;height:100%;display:block'; el.innerHTML = ''; el.appendChild(cv);
    const w = el.clientWidth || 320, h = el.clientHeight || 210; size(w, h);
    if (!raf) { const tick = now => { if (!cur || !cv.isConnected) { raf = 0; return; } const e = EX[cur.id]; pose(cur.id, ((now - cur.t0) / 1000 / e.per) % 1); R.r.render(R.sc, R.cam); raf = requestAnimationFrame(tick); }; raf = requestAnimationFrame(tick); }
  }
  const cache = {};
  async function thumb(id){ if (cache[id]) return cache[id]; await load(); if (!R) build(); if (cur && R.r.domElement.isConnected) return null;
    size(240, 240); pose(id, EX[id].key); R.r.render(R.sc, R.cam); return cache[id] = R.r.domElement.toDataURL('image/jpeg', 0.86); }
  async function fillThumbs(root = document){ for (const img of root.querySelectorAll('img[data-m3]')) { try { const u = await thumb(img.dataset.m3); if (u) img.src = u; } catch(e){ img.replaceWith(document.createRange().createContextualFragment(MobAnim.svg(img.dataset.m3))); } } }
  const stop = () => { cur = null; };
  return { has: id => !!EX[id], mount, thumb, fillThumbs, stop, pose, size: (w, h) => size(w, h), EX, get R(){ return R; } };
})();

/* ============ mobilité : routines natation / vélo / course (5, 10, 20 min) ============
   CARs (Controlled Articular Rotations, Functional Range Conditioning) : rotations actives, lentes, gainées, en bout d'amplitude.
   Étirements tenus < 60 s par muscle avant l'effort (Behm et al. 2016, APNM 41:1-11) ; dynamique en échauffement. */
const Mobility = (() => {
  const X = {
    neck_cars:['CARs cou','CARs',"Menton rentré, dessine le plus grand cercle possible avec la tête, très lentement. 2 tours par sens, épaules immobiles."],
    scap_cars:['CARs omoplates','CARs',"Bras le long du corps, tout le corps gainé à ~30 % : monte, recule, descends puis avance les omoplates en cercle. 3 tours par sens."],
    shoulder_cars:['CARs épaule','CARs',"Poing serré, corps gainé. Bras tendu, monte devant puis au-dessus de la tête, tourne la paume vers l'extérieur et descends derrière en allant le plus loin possible. Retour par le même chemin. 2–3 reps par sens.",1],
    spine_cars:['CARs colonne','CARs',"Debout, genoux souples : enroule la colonne vertèbre par vertèbre, puis inclinaison, extension, autre inclinaison. Lent, 2 tours par sens."],
    hip_cars:['CARs hanche','CARs',"À quatre pattes ou debout, gainé : monte le genou devant, ouvre sur le côté, tourne vers l'arrière, ramène. Le bassin ne bouge pas. 2–3 tours par sens.",1],
    knee_cars:['CARs genou','CARs',"Debout, cuisse tenue à l'horizontale et immobile : tourne le tibia vers l'intérieur puis l'extérieur, puis petits cercles lents.",1],
    ankle_cars:['CARs cheville','CARs',"Tibia immobile, dessine le plus grand cercle possible avec le pied. 3 tours par sens et par pied."],
    foot_cars:['CARs orteils & pied','CARs',"Écarte, lève et plie les orteils, puis cercles lents du pied. Réveille l'appui avant de courir."],
    cat_cow:['Chat-vache segmentaire','dyn',"À quatre pattes, arrondis puis creuse le dos en partant du bassin, une vertèbre après l'autre."],
    open_book:['Livre ouvert','dyn',"Couché sur le côté, genoux à 90° : ouvre le bras du dessus vers le sol derrière toi en suivant la main des yeux. Expire en ouvrant.",1],
    thread_needle:['Thread the needle','dyn',"À quatre pattes, glisse un bras sous l'autre jusqu'à poser l'épaule, puis ouvre vers le plafond. Alterne."],
    wall_slides:['Anges au mur','dyn',"Dos, tête et bras contre le mur, monte et descends les bras sans décoller le bas du dos."],
    streamline:['Flèche au mur','stat',"Dos au mur, bras tendus au-dessus de la tête, mains l'une sur l'autre ; serre les côtes pour coller le bas du dos. 20 s, relâche, recommence."],
    pec_wall:['Pectoraux au mur','stat',"Avant-bras contre un montant de porte, coude à hauteur d'épaule, tourne le buste à l'opposé. Doux, jamais de douleur.",1],
    lat_prayer:['Grand dorsal en prière','stat',"À genoux, mains loin devant au sol, fesses vers les talons, poitrine vers le sol."],
    sleeper:['Sleeper stretch','stat',"Couché sur l'épaule, bras à 90°, l'autre main pousse doucement l'avant-bras vers le sol. Tu dois sentir l'arrière de l'épaule, jamais l'avant.",1],
    band_er:['Rotations externes élastique','renfo',"Coude collé au corps (serviette roulée sous le bras), tourne l'avant-bras vers l'extérieur, 3 s pour revenir. 2 × 12 par bras."],
    ankle_pf:['Assis sur les talons','stat',"À genoux, dessus des pieds à plat, assieds-toi sur les talons ; soulève un peu les genoux pour étirer le cou-de-pied (battements)."],
    knee_wall:['Genou au mur','dyn',"Pied à 10 cm du mur, talon au sol : avance le genou jusqu'à toucher le mur sans décoller le talon. Recule le pied si c'est facile.",1],
    calf_wall:['Mollets au mur','stat',"Mains au mur, jambe arrière tendue talon au sol, puis genou plié (soléaire). Chaque côté.",1],
    ninety:['Transitions 90/90','dyn',"Assis, une jambe à 90° devant et l'autre à 90° sur le côté, bascule les genoux d'un côté à l'autre, buste droit."],
    hip_flexor:['Fente basse (psoas)','stat',"Genou arrière au sol, serre la fesse arrière et rentre le bassin, avance un peu ; bras du même côté vers le haut.",1],
    quad_couch:['Couch stretch','stat',"Genou arrière contre un mur ou un canapé, pied en hauteur, l'autre pied devant. Fesse serrée, redresse le buste petit à petit.",1],
    ham_hinge:['Ischios en charnière','stat',"Talon posé sur une marche, jambe tendue, dos plat : bascule le bassin vers l'avant jusqu'à sentir l'arrière de cuisse.",1],
    glute_fig4:['Fessier en figure 4','stat',"Sur le dos, cheville sur le genou opposé, tire la cuisse vers toi.",1],
    cobra:['Cobra','dyn',"À plat ventre, mains sous les épaules, décolle la poitrine en gardant le bassin au sol. 5 reps de 5 s."],
    worlds:["World's greatest stretch",'dyn',"Grande fente, main intérieure au sol, coude vers la cheville, puis ouvre le bras vers le ciel. Alterne les côtés."],
    leg_swings:['Balancés de jambe','dyn',"En appui au mur : 10 balancés avant-arrière puis 10 latéraux par jambe, amplitude croissante.",1],
    hip_open_walk:['Ouverture de hanche marchée','dyn',"En marchant, monte le genou, ouvre-le vers l'extérieur et pose. Puis l'inverse (de l'extérieur vers l'intérieur)."],
    lunge_matrix:['Lunge matrix','dyn',"Fente avant, latérale puis en rotation (pied à 45° vers l'arrière), en alternant les jambes. Contrôlé, buste droit."],
  };
  const SP = {
    swim:{ ic:'🏊', l:'Natation', focus:'Épaules, thoracique, chevilles · CARs', note:"À sec avant la piscine ou le soir. Les CARs travaillent l'amplitude active : lent, gainé, sans tricher avec les articulations voisines. Le travail des rotateurs externes équilibre la rotation interne très sollicitée par le crawl.",
      r:{ 5:[['neck_cars',45],['scap_cars',45],['shoulder_cars',90],['open_book',60],['pec_wall',60]],
          10:[['neck_cars',45],['scap_cars',45],['shoulder_cars',120],['spine_cars',60],['open_book',60],['thread_needle',60],['pec_wall',60],['lat_prayer',45],['sleeper',60],['ankle_pf',45]],
          20:[['neck_cars',60],['scap_cars',60],['shoulder_cars',150],['spine_cars',90],['cat_cow',60],['open_book',90],['thread_needle',60],['wall_slides',60],['streamline',50],['pec_wall',90],['lat_prayer',60],['sleeper',60],['band_er',120],['hip_cars',90],['ankle_pf',60],['ankle_cars',40]] } },
    bike:{ ic:'🚴', l:'Vélo', focus:'Hanches, ischios, dos et cou', note:"Idéal après la séance ou une journée assise : la position sur le vélo ferme la hanche et arrondit le haut du dos. Tiens les étirements sans forcer.",
      r:{ 5:[['hip_cars',60],['hip_flexor',60],['open_book',60],['ham_hinge',60],['neck_cars',60]],
          10:[['neck_cars',45],['spine_cars',60],['cat_cow',45],['cobra',45],['hip_cars',60],['hip_flexor',60],['quad_couch',60],['ham_hinge',60],['glute_fig4',60],['ninety',60],['ankle_cars',45]],
          20:[['neck_cars',60],['scap_cars',60],['spine_cars',90],['cat_cow',60],['cobra',60],['thread_needle',60],['pec_wall',60],['hip_cars',90],['ninety',90],['hip_flexor',90],['quad_couch',90],['ham_hinge',90],['glute_fig4',90],['worlds',90],['ankle_cars',60],['calf_wall',60]] } },
    run:{ ic:'🏃', l:'Course à pied', focus:'Chevilles, hanches, chaîne arrière · dynamique', note:"Utilisable en échauffement : mouvements dynamiques d'abord, étirements tenus courts (moins de 60 s par muscle) pour ne pas perdre en réactivité.",
      r:{ 5:[['ankle_cars',45],['leg_swings',60],['hip_cars',60],['lunge_matrix',75],['knee_wall',60]],
          10:[['ankle_cars',45],['knee_wall',60],['calf_wall',45],['leg_swings',60],['hip_cars',60],['hip_open_walk',60],['lunge_matrix',90],['worlds',60],['ninety',60],['hip_flexor',60]],
          20:[['foot_cars',60],['ankle_cars',60],['knee_wall',90],['calf_wall',60],['knee_cars',60],['hip_cars',90],['leg_swings',90],['hip_open_walk',60],['lunge_matrix',120],['worlds',90],['ninety',90],['hip_flexor',90],['quad_couch',60],['ham_hinge',60],['glute_fig4',60],['spine_cars',60]] } },
  };
  const TAG = { CARs:'CARs', dyn:'dynamique', stat:'étirement', renfo:'renfo' };
  const log = () => (S.mobility ||= []);
  const dur = () => S.mobDur || 10;
  const fmtS = s => s >= 60 ? `${Math.floor(s/60)} min${s % 60 ? ` ${pad(s % 60)}` : ''}` : `${s} s`;
  const weekMin = () => { const t = todayISO(), from = addDays(t, -6); return log().filter(x => x.date >= from).reduce((a, x) => a + x.min, 0); };
  function card(){
    const w = weekMin(), n7 = log().filter(x => x.date >= addDays(todayISO(), -6)).length, d = dur();
    const last = sp => { const l = log().filter(x => x.sport === sp).sort((a, b) => b.ts - a.ts)[0]; return l ? `faite ${l.date === todayISO() ? "aujourd'hui" : `le ${fmtShort(l.date)}`}` : 'jamais faite'; };
    return { id:'mobilite', tint:CH_TINT.mobilite,
      head:() => `<div class="row between"><b>Mobilité <span class="muted" style="font-weight:400">›</span></b><span class="num small"><b>${w}</b> min · ${n7} routine${n7 > 1 ? 's' : ''} sur 7 j</span></div>
        <div class="tiny muted" style="margin:8px 0">Routines courtes par sport, inspirées des CARs.</div>`,
      body:`<div class="seg" id="mobDur" style="margin:4px 0 10px">${[5,10,20].map(m => `<button type="button" data-mobdur="${m}" class="${m === d ? 'on' : ''}">${m} min</button>`).join('')}</div>
        <div class="mcards">${Object.entries(SP).map(([k, s]) => `<div class="mcard" data-mobopen="${k}" role="button" tabindex="0">
          <span class="mic">${s.ic}</span><div style="flex:1;min-width:0"><b>${s.l}</b><div class="tiny muted">${s.focus}</div><div class="tiny muted">${s.r[d].length} exercices · ${last(k)}</div></div>
          <button class="btn sm primary" data-mobgo="${k}" aria-label="Démarrer la routine ${s.l}">▶</button></div>`).join('')}</div>` };
  }
  function listDlg(sp){
    const s = SP[sp], d = dur();
    openDlg(`<span class="muted small">${s.focus}</span><h2 style="margin:4px 0 8px">${s.ic} Mobilité ${s.l.toLowerCase()}</h2>
      <div class="seg" style="margin:0 0 10px">${[5,10,20].map(m => `<button type="button" data-mobdurdlg="${m}" data-sp="${sp}" class="${m === d ? 'on' : ''}">${m} min</button>`).join('')}</div>
      <p class="small muted" style="margin:0 0 10px">${s.note}</p>
      <div>${s.r[d].map(([id, sec], i) => { const x = X[id]; return `<div class="hist" style="align-items:flex-start">${Mannequin.has(id) ? `<span class="mthumb"><img data-m3="${id}" alt=""></span>` : MobAnim.has(id) ? `<span class="mthumb">${MobAnim.svg(id)}</span>` : `<span class="num muted" style="width:18px">${i + 1}</span>`}<div style="flex:1;min-width:0"><b>${x[0]}${x[3] ? ' <span class="tiny muted">(chaque côté)</span>' : ''}</b> <span class="chip tiny">${TAG[x[1]]}</span><div class="tiny muted">${x[2]}</div></div><b class="num small">${fmtS(sec)}</b></div>`; }).join('')}</div>
      <div class="row" style="margin-top:12px"><button class="btn primary" data-mobgo="${sp}">▶ Démarrer (${d} min)</button><button class="btn ghost" data-mobdone="${sp}">Déjà faite</button></div>`);
    MobAnim.start(); Mannequin.fillThumbs($('#dlg'));
  }
  // lecteur guidé : un exercice à la fois, compte à rebours, changement de côté à mi-temps
  let P = null;
  // son (Web Audio, créé au tap « Démarrer » pour iOS) : tic chaque seconde, bips 3-2-1, bip long au changement
  let AC = null;
  const snd = () => S.mobSound !== false;
  function tone(f, d, v){ if (!AC || !snd()) return; try { const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime; o.frequency.value = f; o.type = f < 1500 ? 'sine' : 'square';
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g).connect(AC.destination); o.start(t); o.stop(t + d + 0.02); } catch(e){} }
  const tick = () => tone(2200, 0.03, 0.05), beep = () => tone(880, 0.15, 0.35), gong = () => tone(1320, 0.5, 0.45);
  function stop(){ Mannequin.stop(); audioOff(); if (P) { clearInterval(P.iv); try { P.wl?.release(); } catch(e){} P = null; } }
  // iOS coupe le Web Audio en mode silencieux : session « playback » (iOS 17+) + boucle <audio> muette (iOS plus anciens) pour passer en catégorie média
  let SIL = null;
  function silentLoop(){ if (SIL) return SIL; const n = 8000, b = new ArrayBuffer(44 + n), v = new DataView(b), w = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true);
    for (let i = 0; i < n; i++) v.setUint8(44 + i, 128); SIL = new Audio(URL.createObjectURL(new Blob([b], { type: 'audio/wav' }))); SIL.loop = true; SIL.setAttribute('playsinline', ''); return SIL; }
  function audioOn(){ if (!snd()) return; try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch(e){}
    try { silentLoop().play().catch(() => {}); } catch(e){}
    try { AC ||= new (window.AudioContext || window.webkitAudioContext)(); AC.resume?.(); } catch(e){ AC = null; } }
  function audioOff(){ try { SIL?.pause(); } catch(e){} try { if (navigator.audioSession) navigator.audioSession.type = 'auto'; } catch(e){} }
  function play(sp){
    stop(); audioOn(); const s = SP[sp], d = dur(), list = s.r[d];
    P = { sp, d, list, i:0, left:list[0][1], paused:false, iv:null, wl:null };
    try { navigator.wakeLock?.request('screen').then(w => { if (P) P.wl = w; }).catch(() => {}); } catch(e){}
    openDlg(`<span class="muted small" id="mpTop"></span><h2 id="mpName" style="margin:4px 0 6px"></h2><div id="mpTag"></div><div id="mpAnim" class="mpanim"></div>
      <div class="num" id="mpT" style="font-size:72px;font-weight:800;text-align:center;margin:10px 0 2px"></div><div class="tiny" id="mpSide" style="text-align:center;min-height:18px;color:var(--accent)"></div>
      <div class="bar" style="margin:10px 0"><i id="mpBar" style="width:0%"></i></div>
      <p class="small" id="mpCue" style="min-height:66px"></p><p class="tiny muted" id="mpNext"></p>
      <div class="row" style="margin-top:10px"><button class="btn" id="mpPrev">‹</button><button class="btn primary" id="mpPause" style="flex:1">Pause</button><button class="btn" id="mpSkip">›</button><button class="btn" id="mpSnd" aria-label="Son"></button></div>`);
    const tot = list.reduce((a, x) => a + x[1], 0);
    const draw = () => { if (!P) return; const [id, sec] = list[P.i], x = X[id], el = sec - P.left;
      $('#mpTop').textContent = `${s.ic} ${s.l} · ${d} min · ${P.i + 1}/${list.length}`; $('#mpName').textContent = x[0];
      $('#mpTag').innerHTML = `<span class="chip tiny">${TAG[x[1]]}</span>`; if (P.shown !== P.i) { P.shown = P.i; const box = $('#mpAnim'); box.classList.toggle('hidden', !Mannequin.has(id) && !MobAnim.has(id)); if (Mannequin.has(id)) Mannequin.mount(box, id).catch(() => { box.innerHTML = MobAnim.svg(id); MobAnim.start(); }); else { Mannequin.stop(); box.innerHTML = MobAnim.svg(id); MobAnim.start(); } } $('#mpT').textContent = `${Math.floor(P.left/60)}:${pad(P.left % 60)}`;
      const half = Math.floor(sec / 2), toSide = x[3] ? P.left - half : 0;
      $('#mpSide').textContent = x[3] && toSide > 0 && toSide <= 3 ? `Change de côté dans ${toSide}…` : P.left > 0 && P.left <= 3 && (!x[3] || toSide <= 0) ? `${list[P.i + 1] ? 'Exercice suivant' : 'Fin'} dans ${P.left}…` : x[3] ? (toSide > 0 ? 'Côté 1' : 'Côté 2') : '';
      $('#mpSnd').textContent = snd() ? '🔊' : '🔇';
      $('#mpCue').textContent = x[2]; $('#mpNext').textContent = list[P.i + 1] ? `Ensuite : ${X[list[P.i + 1][0]][0]}` : 'Dernier exercice';
      const doneSec = list.slice(0, P.i).reduce((a, y) => a + y[1], 0) + el; $('#mpBar').style.width = `${doneSec/tot*100}%`;
      $('#mpPause').textContent = P.paused ? 'Reprendre' : 'Pause'; };
    const go = i => { if (i >= list.length) return finish(); P.i = Math.max(0, i); P.left = list[P.i][1]; try { navigator.vibrate?.(200); } catch(e){} draw(); };
    P.iv = setInterval(() => { if (!P || P.paused) return; P.left--; const [id, sec] = list[P.i];
      const toSide = X[id][3] ? P.left - Math.floor(sec/2) : -1;
      if (toSide === 0) { gong(); try { navigator.vibrate?.([80, 60, 80]); } catch(e){} }
      else if ((toSide > 0 && toSide <= 3) || (toSide < 0 && P.left > 0 && P.left <= 3)) beep();
      else if (P.left <= 0) gong(); else tick();
      if (P.left <= 0) go(P.i + 1); else draw(); }, 1000);
    $('#mpPause').onclick = () => { P.paused = !P.paused; draw(); };
    $('#mpSnd').onclick = () => { S.mobSound = !snd(); save(); if (snd()) { audioOn(); beep(); } else audioOff(); draw(); };
    $('#mpSkip').onclick = () => go(P.i + 1); $('#mpPrev').onclick = () => go(P.i - 1);
    draw();
  }
  function record(sp, min){ log().push({ date: todayISO(), sport: sp, min, ts: Date.now() }); save(); }
  function finish(){ const { sp, d } = P; stop(); record(sp, d); closeDlg(); render(); toast(`Routine ${SP[sp].l.toLowerCase()} terminée · ${d} min 🧘`); }
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-mobdur],[data-mobdurdlg],[data-mobgo],[data-mobopen],[data-mobdone]'); if (!a) return;
    if (a.dataset.mobdur) { S.mobDur = +a.dataset.mobdur; save(); render(); return; }
    if (a.dataset.mobdurdlg) { S.mobDur = +a.dataset.mobdurdlg; save(); listDlg(a.dataset.sp); render(); return; }
    if (a.dataset.mobgo) { e.stopPropagation(); return play(a.dataset.mobgo); }
    if (a.dataset.mobdone) { record(a.dataset.mobdone, dur()); closeDlg(); render(); return toast(`+${dur()} min de mobilité 🧘`); }
    if (a.dataset.mobopen) return listDlg(a.dataset.mobopen);
  });
  $('#dlg').addEventListener('close', stop);
  return { card, SP, X, play, listDlg };
})();
