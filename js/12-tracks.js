"use strict";
// FTP Builder · tracés GPS et vue 3D
/* ============ tracés GPS (sorties extérieures) ============ */
// stockés à part (table activity_tracks + cache local), retrouvés par l'heure de départ de la sortie
const Tracks = (() => {
  const KEY = 'ftpb-tracks', MAX_LOCAL = 40;
  let cache = {}; try { cache = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch {}
  const persist = () => { try {
    const ks = Object.keys(cache);
    if (ks.length > MAX_LOCAL) ks.sort((a, b) => (cache[a].at || 0) - (cache[b].at || 0)).slice(0, ks.length - MAX_LOCAL).forEach(k => delete cache[k]);
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {} };
  // séries alignées -> tracé compact (≤ 800 points) ; d en km, spd en km/h, alt en m
  function build({ lat, lon, alt, d, t, spd, hr }){
    const idx = []; for (let i = 0; i < (lat?.length || 0); i++) if (lat[i] != null && lon[i] != null && (lat[i] || lon[i])) idx.push(i);
    if (idx.length < 10) return null;
    const k = Math.max(1, Math.ceil(idx.length / 800)), pick = idx.filter((_, j) => j % k === 0); if (pick[pick.length-1] !== idx[idx.length-1]) pick.push(idx[idx.length-1]);
    const r = (x, n) => x == null || !isFinite(x) ? null : +(+x).toFixed(n);
    const col = (arr, n) => arr && arr.some(v => v != null) ? pick.map(i => r(arr[i], n)) : null;
    return { v:1, lat: pick.map(i => r(lat[i], 5)), lon: pick.map(i => r(lon[i], 5)), alt: col(alt, 1), d: col(d, 3), t: t ? pick.map(i => t[i]) : null, spd: col(spd, 1), hr: col(hr, 0) };
  }
  const fromRecords = recs => { const R = recs.filter(x => x.t != null); const t0 = R[0]?.t || 0;
    return build({ lat: R.map(x => x.lat), lon: R.map(x => x.lon), alt: R.map(x => x.alt), d: R.map(x => x.dist), t: R.map(x => x.t - t0), spd: R.map(x => x.spd), hr: R.map(x => x.hr) }); };
  const fromStreams = st => !st?.latlng ? null : build({ lat: st.latlng.map(p => p?.[0]), lon: st.latlng.map(p => p?.[1]), alt: st.altitude, d: st.distance?.map(x => x/1000), t: st.time, spd: st.velocity_smooth?.map(x => x*3.6), hr: st.heartrate });
  function local(ts){ for (const k of Object.keys(cache)) if (Math.abs(+k - ts) <= 180) return cache[k].track; return null; }
  async function put(ts, track, source){
    if (!ts || !track) return; cache[ts] = { track, at: Date.now() }; persist();
    try { const sb = Cloud.sb, u = Cloud.user; if (sb && u) await sb.from('activity_tracks').upsert({ user_id: u.id, start_ts: ts, source, track }); } catch (e) { console.warn('tracé', e); }
  }
  async function get(a){
    if (!a?.startTs) return null;
    const l = local(a.startTs); if (l) return l;
    try { const sb = Cloud.sb, u = Cloud.user; if (!sb || !u) return null;
      const { data } = await sb.from('activity_tracks').select('start_ts, track').gte('start_ts', a.startTs - 180).lte('start_ts', a.startTs + 180).limit(1);
      if (data?.[0]) { cache[data[0].start_ts] = { track: data[0].track, at: Date.now() }; persist(); return data[0].track; }
    } catch (e) { console.warn('tracé', e); }
    return null;
  }
  return { build, fromRecords, fromStreams, put, get, local };
})();

/* ============ vue 3D du tracé avec lecture ============ */
const Track3D = (() => {
  const LIBS = ['https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js', 'https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/controls/OrbitControls.js'];
  let libs = null;
  const script = src => new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ko(new Error('chargement 3D impossible')); document.head.appendChild(s); });
  const loadLibs = () => libs ||= (async () => { if (!window.THREE) await script(LIBS[0]); if (!THREE.OrbitControls) await script(LIBS[1]); })().catch(e => { libs = null; throw e; });
  const fs = document.getElementById('fsDlg');
  let V = null; // vue courante

  // couleur néon selon l'altitude (bleu -> violet -> orange -> jaune)
  const STOPS = [[0,[0.15,0.55,1]],[0.4,[0.55,0.3,1]],[0.7,[1,0.35,0.45]],[0.88,[1,0.55,0.15]],[1,[1,0.9,0.35]]];
  const heat = u => { u = clamp(u, 0, 1); for (let i = 1; i < STOPS.length; i++) if (u <= STOPS[i][0]) { const [a, ca] = STOPS[i-1], [b, cb] = STOPS[i], f = (u-a)/(b-a); return ca.map((c, j) => c + (cb[j]-c)*f); } return STOPS[STOPS.length-1][1]; };
  const fmt1 = v => v == null ? '—' : (Math.round(v*10)/10).toString().replace('.', ',');

  // tracé -> points locaux (m), distance cumulée, altitudes lissées
  function prepare(tr){
    const n = tr.lat.length, lat0 = tr.lat.reduce((a, b) => a+b, 0)/n, lon0 = tr.lon.reduce((a, b) => a+b, 0)/n, kx = Math.cos(lat0*Math.PI/180)*111320, kz = 110540;
    const X = tr.lon.map(v => (v - lon0)*kx), Z = tr.lat.map(v => -(v - lat0)*kz);
    let alt = tr.alt ? tr.alt.map(v => v ?? null) : Array(n).fill(0); for (let i = 0; i < n; i++) if (alt[i] == null) alt[i] = alt[i-1] ?? alt.find(v => v != null) ?? 0;
    alt = alt.map((_, i) => { let s = 0, c = 0; for (let j = Math.max(0, i-2); j <= Math.min(n-1, i+2); j++) { s += alt[j]; c++; } return s/c; }); // lissage léger (bruit GPS)
    const D = [0]; for (let i = 1; i < n; i++) D.push(D[i-1] + Math.hypot(X[i]-X[i-1], Z[i]-Z[i-1])/1000);
    const dist = tr.d && tr.d[n-1] ? tr.d.map((v, i) => v ?? D[i]) : D;
    let up = 0; for (let i = 1; i < n; i++) if (alt[i] > alt[i-1]) up += alt[i]-alt[i-1];
    return { n, X, Z, alt, dist, total: dist[n-1], up: Math.round(up), aMin: Math.min(...alt), aMax: Math.max(...alt), spd: tr.spd, hr: tr.hr, t: tr.t,
      geo: { lat0, lon0, kx, kz, latMin: Math.min(...tr.lat), latMax: Math.max(...tr.lat), lonMin: Math.min(...tr.lon), lonMax: Math.max(...tr.lon) } };
  }

  // fond satellite : tuiles Esri World Imagery assemblées sur une toile, posées au sol sous le tracé
  const SAT = (z, y, x) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
  const lon2x = (lon, z) => (lon + 180)/360*2**z, lat2y = (lat, z) => { const r = lat*Math.PI/180; return (1 - Math.log(Math.tan(r) + 1/Math.cos(r))/Math.PI)/2*2**z; };
  const x2lon = (x, z) => x/2**z*360 - 180, y2lat = (y, z) => Math.atan(Math.sinh(Math.PI*(1 - 2*y/2**z)))*180/Math.PI;
  async function satellite(G){
    const mLat = (G.latMax - G.latMin)*0.35 + 0.002, mLon = (G.lonMax - G.lonMin)*0.35 + 0.003; // marge autour du tracé
    const box = { n: G.latMax + mLat, s: G.latMin - mLat, w: G.lonMin - mLon, e: G.lonMax + mLon };
    let z = 17, x0, x1, y0, y1;
    for (; z > 3; z--) { x0 = Math.floor(lon2x(box.w, z)); x1 = Math.floor(lon2x(box.e, z)); y0 = Math.floor(lat2y(box.n, z)); y1 = Math.floor(lat2y(box.s, z)); if ((x1-x0+1)*(y1-y0+1) <= 36) break; }
    const W = x1-x0+1, H = y1-y0+1, cv = document.createElement('canvas'); cv.width = W*256; cv.height = H*256; const g = cv.getContext('2d');
    g.fillStyle = '#0a1020'; g.fillRect(0, 0, cv.width, cv.height);
    let ok = 0; const jobs = [];
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) jobs.push(new Promise(res => { const im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = () => { g.drawImage(im, (tx-x0)*256, (ty-y0)*256); ok++; res(); }; im.onerror = () => res(); im.src = SAT(z, ty, tx); }));
    await Promise.all(jobs);
    if (!ok) return null;
    return { canvas: cv, w: x2lon(x0, z), e: x2lon(x1+1, z), n: y2lat(y0, z), s: y2lat(y1+1, z) };
  }
  let satOn = true; try { satOn = localStorage.getItem('ftpb-sat') !== '0'; } catch {}

  async function open(a){
    if (!a) return;
    toast('Chargement du tracé…');
    const tr = await Tracks.get(a);
    if (!tr) { toast(a.startTs ? "Pas de tracé GPS pour cette sortie : il arrive avec la synchro Intervals.icu, un fichier .fit ou Strava." : 'Pas de tracé GPS pour cette sortie.'); return; }
    try { await loadLibs(); } catch (e) { toast('Vue 3D indisponible hors connexion'); return; }
    show(a, prepare(tr));
  }

  function show(a, P){
    const pl = a.planId ? S.plan.find(s => s.id === a.planId) : null;
    fs.classList.add('fs3d');
    fs.innerHTML = `<div class="t3d">
      <canvas class="t3c"></canvas>
      <div class="t3top"><div class="t3title"><b>${esc(pl ? WORKOUTS[pl.workoutId].name : a.name)}</b><span>${fmtShort(a.date)} · ${fmt1(P.total)} km · D+ ${P.up} m</span></div>
        <button type="button" class="t3btn" data-t3="sat" title="Fond satellite">🛰️</button><button type="button" class="t3btn" data-t3="follow" aria-pressed="false" title="Suivre le traceur">🎥</button><button type="button" class="t3btn" data-t3="close" aria-label="Fermer">×</button></div>
      <div class="t3hud"><div><small>Distance</small><b data-h="d">0</b> km</div><div><small>Altitude</small><b data-h="a">—</b> m</div><div><small>Pente</small><b data-h="g">—</b> %</div><div><small>Vitesse</small><b data-h="v">—</b> km/h</div>${P.hr ? '<div><small>FC</small><b data-h="hr">—</b></div>' : ''}</div>
      <div class="t3bot"><svg class="t3prof" viewBox="0 0 1000 60" preserveAspectRatio="none"></svg>
        <div class="t3ctl"><button type="button" class="t3play" data-t3="play" aria-label="Lecture">▶</button><input type="range" class="t3seek" min="0" max="1000" value="0" aria-label="Position sur le tracé">
          <button type="button" class="t3btn t3spd" data-t3="speed">×1</button></div><div class="t3attr" hidden>Imagerie © Esri, Maxar, Earthstar Geographics</div></div>
    </div>`;
    if (!fs.open) fs.showModal();
    const root = fs.querySelector('.t3d'), canvas = root.querySelector('canvas');
    const T = THREE;
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    const scene = new T.Scene(); scene.background = new T.Color(0x0a1020); scene.fog = new T.Fog(0x0a1020, 160, 420);
    const camera = new T.PerspectiveCamera(45, 1, 0.5, 2000);

    // échelle : le tracé tient dans ~100 unités ; relief exagéré pour rester lisible
    const ext = Math.max(Math.max(...P.X) - Math.min(...P.X), Math.max(...P.Z) - Math.min(...P.Z), 50), sc = 100/ext;
    const cx = (Math.max(...P.X) + Math.min(...P.X))/2, cz = (Math.max(...P.Z) + Math.min(...P.Z))/2;
    const relief = (P.aMax - P.aMin)*sc, ex = relief > 0.01 ? clamp(14/relief, 1.5, 25) : 1;
    const base = 1.2, H = i => base + (P.alt[i] - P.aMin)*sc*ex, au = i => P.aMax > P.aMin ? (P.alt[i] - P.aMin)/(P.aMax - P.aMin) : 0.3;
    const pts = P.X.map((x, i) => new T.Vector3((x - cx)*sc, H(i), (P.Z[i] - cz)*sc));
    const curve = new T.CatmullRomCurve3(pts, false, 'centripetal');
    // synchro : la courbe passe par le point i au paramètre t = i/(n-1), mais les tubes sont découpés selon la longueur d'arc.
    // arcU[i] = part de la longueur de courbe au point i : le traceur, la portion parcourue et les couleurs utilisent la même référence.
    const SUB = 8; curve.arcLengthDivisions = (P.n-1)*SUB; // même finesse pour getPointAt (traceur) et pour les tubes
    const L = curve.getLengths(), Ltot = L[L.length-1] || 1, arcU = P.X.map((_, i) => L[i*SUB]/Ltot);
    const idxOfArc = a => { let lo = 0, hi = P.n-1; while (lo < hi) { const m = (lo+hi+1) >> 1; if (arcU[m] <= a) lo = m; else hi = m-1; } return lo; };
    const segs = Math.min(1600, P.n*2), radial = 6;

    // sol : grille + ombre du tracé
    const grid = new T.GridHelper(220, 44, 0x1d5a7a, 0x12324a); grid.material.transparent = true; grid.material.opacity = 0.55; scene.add(grid);
    // fond satellite (chargé après coup ; sans réseau, on garde la grille)
    let satMesh = null;
    const toLocal = (lat, lon) => [((lon - P.geo.lon0)*P.geo.kx - cx)*sc, (-(lat - P.geo.lat0)*P.geo.kz - cz)*sc];
    const applySat = () => { if (satMesh) satMesh.visible = satOn; grid.visible = !(satOn && satMesh); root.querySelector('[data-t3="sat"]')?.classList.toggle('on', satOn); root.querySelector('.t3attr').hidden = !(satOn && satMesh); };
    let alive = true;
    satellite(P.geo).then(m => { if (!m || !alive) return;
      const [xw, zn] = toLocal(m.n, m.w), [xe, zs] = toLocal(m.s, m.e);
      const tex = new T.CanvasTexture(m.canvas); tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      satMesh = new T.Mesh(new T.PlaneGeometry(xe - xw, zs - zn), new T.MeshBasicMaterial({ map: tex, color: 0x9aa6bd, fog: true })); // un peu assombri pour garder le tracé lumineux
      satMesh.rotation.x = -Math.PI/2; satMesh.position.set((xw + xe)/2, -0.05, (zn + zs)/2); satMesh.renderOrder = -1; scene.add(satMesh); applySat();
    }).catch(() => {});
    const shadow = new T.BufferGeometry().setFromPoints(pts.map(p => new T.Vector3(p.x, 0.02, p.z)));
    scene.add(new T.Line(shadow, new T.LineBasicMaterial({ color: 0x2fa8ff, transparent: true, opacity: 0.35 })));
    // rideau entre le sol et le tracé
    { const pos = [], colA = [];
      for (let i = 0; i < P.n; i++) { const p = pts[i], c = heat(au(i)); pos.push(p.x, 0, p.z, p.x, p.y, p.z); colA.push(c[0]*0.05, c[1]*0.05, c[2]*0.08, c[0]*0.55, c[1]*0.55, c[2]*0.55); }
      const idx = []; for (let i = 0; i < P.n-1; i++) { const a0 = i*2; idx.push(a0, a0+1, a0+2, a0+1, a0+3, a0+2); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(colA, 3)); g.setIndex(idx);
      scene.add(new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false }))); }
    // tracé lumineux coloré selon l'altitude + halo
    const tube = new T.TubeGeometry(curve, segs, 0.32, radial, false);
    { const c = []; for (let s = 0; s <= segs; s++) { const i = idxOfArc(s/segs), col = heat(au(i)); for (let r = 0; r <= radial; r++) c.push(...col); }
      tube.setAttribute('color', new T.Float32BufferAttribute(c, 3)); }
    scene.add(new T.Mesh(tube, new T.MeshBasicMaterial({ vertexColors: true })));
    const halo = new T.TubeGeometry(curve, segs, 0.9, radial, false); halo.setAttribute('color', tube.getAttribute('color'));
    scene.add(new T.Mesh(halo, new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.16, blending: T.AdditiveBlending, depthWrite: false })));
    // portion parcourue (blanche) : on révèle l'index au fil de la lecture
    const done = new T.TubeGeometry(curve, segs, 0.42, radial, false);
    const doneMesh = new T.Mesh(done, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 })); done.setDrawRange(0, 0); scene.add(doneMesh);
    // départ / arrivée
    const dot = (p, col) => { const m = new T.Mesh(new T.SphereGeometry(0.9, 16, 12), new T.MeshBasicMaterial({ color: col })); m.position.copy(p); scene.add(m);
      const beam = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(p.x, 0, p.z), p]), new T.LineBasicMaterial({ color: col, transparent: true, opacity: 0.6 })); scene.add(beam); };
    dot(pts[0], 0x3ecf8e); dot(pts[P.n-1], 0xff4d5e);
    // traceur : point lumineux + halo + onde qui pulse, toujours visible, taille constante à l'écran
    const tracker = new T.Group(); tracker.renderOrder = 12;
    const tMat = (color, opacity, add) => new T.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false, ...(add ? { blending: T.AdditiveBlending } : {}) });
    const core = new T.Mesh(new T.SphereGeometry(0.55, 20, 14), tMat(0xffffff, 1)); core.renderOrder = 13;
    const halo3 = new T.Mesh(new T.SphereGeometry(1.25, 20, 14), tMat(0xffb347, 0.45, true)); halo3.renderOrder = 12;
    const ring = new T.Mesh(new T.RingGeometry(1.3, 1.65, 48), tMat(0xffd27a, 0.8, true)); ring.rotation.x = -Math.PI/2; ring.renderOrder = 12;
    tracker.add(halo3, ring, core); scene.add(tracker);
    const bbeam = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3()]), new T.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.7 })); scene.add(bbeam);

    const controls = new T.OrbitControls(camera, canvas); controls.enableDamping = true; controls.dampingFactor = 0.08; controls.maxPolarAngle = Math.PI*0.49; controls.minDistance = 15; controls.maxDistance = 400;
    // cadrage initial : tout le tracé visible, vu de trois quarts
    const box = new T.Box3().setFromPoints(pts), ctr = box.getCenter(new T.Vector3()), rad = Math.max(box.getSize(new T.Vector3()).length()/2, 20);
    const frameAll = () => { const fov = camera.fov*Math.PI/180, fit = rad/Math.sin(Math.min(fov, fov*camera.aspect)/2)*1.05;
      camera.position.copy(ctr).add(new T.Vector3(0.5, 0.62, 0.6).normalize().multiplyScalar(fit)); controls.target.copy(ctr); controls.update(); };

    // profil d'altitude (SVG) sous la vue
    const prof = root.querySelector('.t3prof');
    { const k = Math.max(1, Math.floor(P.n/300)), ptsP = []; for (let i = 0; i < P.n; i += k) ptsP.push(`${(P.dist[i]/P.total*1000).toFixed(1)},${(56 - au(i)*50).toFixed(1)}`);
      prof.innerHTML = `<defs><linearGradient id="t3g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ff8a3d" stop-opacity=".75"/><stop offset="1" stop-color="#2f7dff" stop-opacity=".15"/></linearGradient></defs>
        <path d="M0,60 L${ptsP.join(' L')} L1000,60 Z" fill="url(#t3g)"/><path d="M${ptsP.join(' L')}" fill="none" stroke="#ffd27a" stroke-width="1.5" vector-effect="non-scaling-stroke"/><line class="t3cur" x1="0" x2="0" y1="0" y2="60" stroke="#fff" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`; }

    // état de lecture : u = part de la distance parcourue
    const st = { u: 0, play: false, speed: 1, follow: false, last: 0, raf: 0 };
    const SPEEDS = [0.5, 1, 2, 4], BASE_S = 40; // lecture complète en 40 s à ×1
    const idxAt = u => { const target = u*P.total; let lo = 0, hi = P.n-1; while (lo < hi) { const m = (lo+hi) >> 1; if (P.dist[m] < target) lo = m+1; else hi = m; } return lo; };
    const hud = k => root.querySelector(`[data-h="${k}"]`);
    function place(){
      // position exacte entre deux points GPS (par la distance), puis même abscisse curviligne pour le traceur et la portion parcourue
      const target = st.u*P.total; let i = Math.max(0, idxAt(st.u) - 1); while (i < P.n-2 && P.dist[i+1] < target) i++;
      const seg = P.dist[i+1] - P.dist[i], f = P.n > 1 && seg > 0 ? clamp((target - P.dist[i])/seg, 0, 1) : 0;
      const a = P.n > 1 ? arcU[i] + (arcU[i+1] - arcU[i])*f : 0, p = curve.getPointAt(clamp(a, 0, 1));
      const k = camera.position.distanceTo(p)*0.02, ph = (performance.now()/1200) % 1;
      tracker.position.copy(p); tracker.scale.setScalar(k); ring.scale.setScalar(1 + ph*1.6); ring.material.opacity = 0.85*(1 - ph);
      bbeam.geometry.setFromPoints([new T.Vector3(p.x, 0, p.z), p]);
      done.setDrawRange(0, Math.floor(a*segs)*radial*6);
      const j = Math.max(0, i-3), k2 = Math.min(P.n-1, i+3), dd = (P.dist[k2]-P.dist[j])*1000;
      hud('d').textContent = fmt1(target); hud('a').textContent = Math.round(P.alt[i]);
      hud('g').textContent = dd > 5 ? fmt1((P.alt[k2]-P.alt[j])/dd*100) : '—';
      const v = P.spd?.[i] ?? (P.t && P.t[k2] > P.t[j] ? (P.dist[k2]-P.dist[j])/((P.t[k2]-P.t[j])/3600) : null); hud('v').textContent = fmt1(v);
      if (P.hr) hud('hr').textContent = P.hr[i] ?? '—';
      root.querySelector('.t3cur').setAttribute('x1', st.u*1000); root.querySelector('.t3cur').setAttribute('x2', st.u*1000);
      if (document.activeElement !== seek) seek.value = Math.round(st.u*1000);
      if (st.follow) { const ahead = curve.getPointAt(Math.min(1, a + 0.02)), dir = ahead.clone().sub(p).setY(0); if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0); dir.normalize();
        const want = p.clone().sub(dir.multiplyScalar(rad*0.55)).add(new T.Vector3(0, rad*0.38, 0)); camera.position.lerp(want, 0.08); controls.target.lerp(p, 0.15); }
    }
    const seek = root.querySelector('.t3seek'), playBtn = root.querySelector('[data-t3="play"]');
    const setPlay = on => { st.play = on; playBtn.textContent = on ? '❚❚' : '▶'; playBtn.setAttribute('aria-label', on ? 'Pause' : 'Lecture'); if (on && st.u >= 1) st.u = 0; };
    function frame(ts){
      const dt = st.last ? Math.min(0.1, (ts - st.last)/1000) : 0; st.last = ts;
      if (st.play) { st.u = Math.min(1, st.u + dt*st.speed/BASE_S); if (st.u >= 1) setPlay(false); }
      place(); controls.update(); renderer.render(scene, camera); st.raf = requestAnimationFrame(frame);
    }
    function resize(){ const w = root.clientWidth, h = root.clientHeight; renderer.setSize(w, h, false); camera.aspect = w/h; camera.fov = w < h ? 60 : 45; camera.updateProjectionMatrix(); }
    root.addEventListener('click', e => { const b = e.target.closest('[data-t3]'); if (!b) return; const k = b.dataset.t3;
      if (k === 'close') fs.close();
      else if (k === 'play') setPlay(!st.play);
      else if (k === 'speed') { st.speed = SPEEDS[(SPEEDS.indexOf(st.speed)+1) % SPEEDS.length]; b.textContent = '×' + String(st.speed).replace('.', ','); }
      else if (k === 'sat') { satOn = !satOn; try { localStorage.setItem('ftpb-sat', satOn ? '1' : '0'); } catch {} applySat(); }
      else if (k === 'follow') { st.follow = !st.follow; b.setAttribute('aria-pressed', st.follow); b.classList.toggle('on', st.follow); if (!st.follow) frameAll(); } });
    seek.addEventListener('input', () => { st.u = seek.value/1000; });
    prof.addEventListener('pointerdown', e => { const r = prof.getBoundingClientRect(); st.u = clamp((e.clientX - r.left)/r.width, 0, 1); });
    const ro = new ResizeObserver(resize); ro.observe(root); resize(); frameAll();
    st.raf = requestAnimationFrame(frame);
    try { if (fs.requestFullscreen && !/iPhone|iPod/.test(navigator.userAgent)) fs.requestFullscreen().catch(() => {}); } catch {}
    V = { dispose(){ alive = false; cancelAnimationFrame(st.raf); ro.disconnect(); controls.dispose(); scene.traverse(o => { o.geometry?.dispose?.(); if (o.material) { o.material.map?.dispose?.(); o.material.dispose?.(); } }); renderer.dispose(); renderer.forceContextLoss?.(); } };
    window._t3 = { st, P, place, tracker, pts, done, segs, radial, arcU, curve }; // tests
  }
  fs.addEventListener('close', () => { if (V) { V.dispose(); V = null; } fs.classList.remove('fs3d'); });
  document.addEventListener('click', e => { const b = e.target.closest('[data-track3d]'); if (!b) return; open(S.activities.find(a => a.id === b.dataset.track3d)); });
  return { open };
})();
