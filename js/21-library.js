"use strict";
// FTP Builder · bibliothèque perso du Profil : Mes ascensions, Mes GPX (livre de traces noté, ouvert aux amis) et Mes courses (avec photos)
/* ============ Profil : deux carrés sous Réglages (Ascensions à gauche, GPX à droite) puis Mes courses ============
   - S.gpxBook : [{ id, name, km, dp, pts:[[lat, lon, alt]…] (≤ 600 points), notes:{ fun, diff, asph, boul } (1-5), comment, added }]
   - S.gpxShare : livre ouvert aux amis (table gpx_book, lecture seule pour eux ; rien n'y est tant que c'est fermé)
   - S.races : [{ id, name, date, sport, time, rank, note, photos:[{ id, kind, up }], auto? }] ; photos en IndexedDB + stockage privé race-photos
   - la course objectif du plan tri, une fois passée, s'ajoute toute seule (S.racesSkip : celles supprimées à la main) */
const Library = (() => {
  const CRIT = [['fun', 'Fun', '😄'], ['diff', 'Difficulté', '🔥'], ['asph', 'Asphalte', '🛣️'], ['boul', 'Boulangerie', '🥐']];
  const SPORTS = { tri: ['🏅', 'Triathlon'], bike: ['🚴', 'Vélo'], run: ['🏃', 'Course à pied'], trail: ['⛰️', 'Trail'], swim: ['🏊', 'Natation'], other: ['🏁', 'Autre'] };
  const KINDS = { medal: 'Médaille', bib: 'Dossard', finish: "Ligne d'arrivée", other: 'Autre' };
  const MAXP = 600, BUCKET = 'race-photos';
  const uid = () => Cloud.user?.id, sb = () => Cloud.sb;
  const book = () => (S.gpxBook ||= []), races = () => (S.races ||= []);
  const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const f1 = v => (Math.round(v*10)/10).toString().replace('.', ',');
  const dateFR = s => { const d = parseD(s); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
  const hms = s => { s = Math.round(s); return `${Math.floor(s/3600)}:${pad(Math.floor(s%3600/60))}:${pad(s%60)}`; };
  const R = Math.PI/180, dist = (a, b) => 6371*Math.hypot((b[1] - a[1])*R*Math.cos((a[0] + b[0])/2*R), (b[0] - a[0])*R);
  const BACK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>`;
  const paneHead = (t, a = 'back') => `<div class="pane-head"><button class="pane-back" data-pp="${a}" aria-label="Retour">${BACK}</button><h2>${t}</h2></div>`;

  /* ---------- GPX : lecture, simplification, export ---------- */
  function parseGPX(txt, fileName = ''){
    const doc = new DOMParser().parseFromString(txt, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) return null;
    let nodes = [...doc.getElementsByTagName('trkpt')]; if (nodes.length < 2) nodes = [...doc.getElementsByTagName('rtept')];
    const raw = nodes.map(n => { const e = n.getElementsByTagName('ele')[0]; return [+n.getAttribute('lat'), +n.getAttribute('lon'), e && e.textContent.trim() !== '' && isFinite(+e.textContent) ? +e.textContent : null]; })
      .filter(p => isFinite(p[0]) && isFinite(p[1]) && (p[0] || p[1]));
    if (raw.length < 2) return null;
    const nm = [...doc.getElementsByTagName('name')].map(x => x.textContent.trim()).find(Boolean);
    return fromRaw(raw, (nm || fileName.replace(/\.gpx$/i, '') || 'Trace').slice(0, 60));
  }
  // points [lat, lon, alt|null] → trace du livre (distance, D+, ≤ 600 points)
  function fromRaw(raw, name){
    const D = [0]; for (let i = 1; i < raw.length; i++) D.push(D[i-1] + dist(raw[i-1], raw[i]));
    const km = D[D.length - 1]; if (km < 0.2) return null;
    // D+ avec hystérésis de 3 m (filtre le bruit de l'altitude GPS)
    let up = 0, ref = null; for (const p of raw) { if (p[2] == null) continue; if (ref == null || p[2] < ref - 3) ref = p[2]; else if (p[2] > ref + 3) { up += p[2] - ref; ref = p[2]; } }
    const step = km/MAXP, pts = []; let next = 0;
    raw.forEach((p, i) => { if (D[i] >= next || i === raw.length - 1) { pts.push([+p[0].toFixed(5), +p[1].toFixed(5), p[2] == null ? null : Math.round(p[2])]); next = D[i] + step; } });
    return { name, km: Math.round(km*10)/10, dp: Math.round(up), pts };
  }
  const isLoop = t => t.pts.length > 2 && dist(t.pts[0], t.pts[t.pts.length - 1]) < 0.5;
  const xmlEsc = s => String(s).replace(/[<>&"]/g, c => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;' }[c]));
  const toGPX = t => `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="FTP Builder" xmlns="http://www.topografix.com/GPX/1/1">\n<metadata><name>${xmlEsc(t.name)}</name></metadata>\n<trk><name>${xmlEsc(t.name)}</name><trkseg>\n`
    + t.pts.map(p => `<trkpt lat="${p[0]}" lon="${p[1]}">${p[2] != null ? `<ele>${p[2]}</ele>` : ''}</trkpt>`).join('\n') + `\n</trkseg></trk>\n</gpx>\n`;
  const fileOf = t => (t.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'trace') + '.gpx';
  const dlGPX = t => download(fileOf(t), new TextEncoder().encode(toGPX(t)), 'application/gpx+xml');

  /* ---------- dessins : tracé vu du dessus et profil d'altitude ---------- */
  function mapSVG(pts, w = 320, h = 200, cls = 'gpxmap'){
    if (!pts?.length) return '';
    const la0 = pts.reduce((a, p) => a + p[0], 0)/pts.length, kx = Math.cos(la0*R);
    const xs = pts.map(p => p[1]*kx), ys = pts.map(p => -p[0]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), pd = Math.min(w, h)*0.08;
    const s = Math.min((w - 2*pd)/((x1 - x0) || 1e-6), (h - 2*pd)/((y1 - y0) || 1e-6)), ox = (w - (x1 - x0)*s)/2, oy = (h - (y1 - y0)*s)/2;
    const P = xs.map((x, i) => [ox + (x - x0)*s, oy + (ys[i] - y0)*s]), sw = Math.max(2, w/110);
    const d = P.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
    const e = P[P.length - 1];
    return `<svg class="${cls}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><path d="${d}" fill="none" stroke="var(--accent)" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>`
      + `<circle cx="${e[0].toFixed(1)}" cy="${e[1].toFixed(1)}" r="${sw*1.6}" fill="var(--bad)" stroke="var(--card)" stroke-width="${sw*0.6}"/><circle cx="${P[0][0].toFixed(1)}" cy="${P[0][1].toFixed(1)}" r="${sw*1.6}" fill="var(--ok)" stroke="var(--card)" stroke-width="${sw*0.6}"/></svg>`;
  }
  function eleSVG(pts, w = 640, h = 140){
    if (!pts || pts.filter(p => p[2] != null).length < 2) return '';
    const D = [0]; for (let i = 1; i < pts.length; i++) D.push(D[i-1] + dist(pts[i-1], pts[i]));
    let last = pts.find(p => p[2] != null)[2]; const E = pts.map(p => last = p[2] ?? last);
    const lo = Math.min(...E), hi = Math.max(...E), span = Math.max(50, hi - lo), top = 18, bot = h - 18, L = D[D.length - 1] || 1;
    const X = d => (d/L*w).toFixed(1), Y = e => (bot - (e - lo)/span*(bot - top)).toFixed(1);
    const line = E.map((e, i) => `${i ? 'L' : 'M'}${X(D[i])} ${Y(e)}`).join('');
    return `<svg class="chart gpxele" viewBox="0 0 ${w} ${h}" aria-label="Profil d'altitude"><path d="${line}L${w} ${bot}L0 ${bot}Z" fill="color-mix(in srgb,var(--accent) 22%,transparent)"/><path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2"/>`
      + `<text x="4" y="12" font-size="12" fill="var(--muted)">${Math.round(hi)} m</text><text x="4" y="${h - 4}" font-size="12" fill="var(--muted)">${Math.round(lo)} m</text><text x="${w - 4}" y="${h - 4}" font-size="12" fill="var(--muted)" text-anchor="end">${f1(L)} km</text></svg>`;
  }
  const starsRO = v => `<span class="stars ro" aria-label="${v || 0} sur 5">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= v ? 'on' : ''}">★</i>`).join('')}</span>`;
  const starsIn = (k, v, lab) => `<span class="stars" data-gstar="${k}" role="group" aria-label="${lab}">${[1, 2, 3, 4, 5].map(i => `<button type="button" data-v="${i}" class="${i <= v ? 'on' : ''}" aria-label="${lab} : ${i} étoile${i > 1 ? 's' : ''}">★</button>`).join('')}</span>`;
  const notesRO = n => `<div class="gnotes">${CRIT.map(([k, l, ic]) => `<span class="gn" title="${l}"><span aria-hidden="true">${ic}</span>${starsRO(n?.[k] || 0)}</span>`).join('')}</div>`;

  /* ---------- bandeau : zone, autour de moi, filtres par note, tri ---------- */
  // zones d'Île-de-France (centre, rayon km) ; ailleurs, la ville de départ (géocodeur Photon / OpenStreetMap)
  const ZONES = [
    { l: 'Bords de Marne', c: [48.845, 2.58], r: 13 }, { l: 'Vallée de Chevreuse', c: [48.71, 2.03], r: 14 },
    { l: 'Vexin', c: [49.13, 1.85], r: 22 }, { l: 'Forêt de Rambouillet', c: [48.64, 1.80], r: 14 },
    { l: 'Fontainebleau', c: [48.40, 2.68], r: 20 }, { l: 'Paris', c: [48.858, 2.345], r: 8 },
  ];
  const ptsOf = t => t.pts?.length ? t.pts : [];
  function zoneOf(t){
    const P = ptsOf(t); if (!P.length) return t.town || 'Autre';
    let best = null, bf = 0.25; for (const z of ZONES) { const f = P.filter(p => dist(p, z.c) <= z.r).length/P.length; if (f > bf) { bf = f; best = z; } }
    return best ? best.l : (t.town || 'Autre');
  }
  let sortK = 'recent', zoneF = null, here = null; const filt = { fun: 0, diff: 0, asph: 0, boul: 0 };
  const SORTS = [['recent', 'Récentes'], ...CRIT.map(([k, l]) => [k, l])];
  const nearKm = t => here ? Math.min(...ptsOf(t).map(p => dist(p, here))) : null;
  function view(L){
    let V = L.filter(t => CRIT.every(([k]) => !filt[k] || (t.notes?.[k] || 0) >= filt[k]));
    if (zoneF === 'near') V = V.filter(t => nearKm(t) <= 30).sort((a, b) => nearKm(a) - nearKm(b));
    else { if (zoneF) V = V.filter(t => zoneOf(t) === zoneF);
      V.sort(sortK === 'recent' ? (a, b) => (b.added || '').localeCompare(a.added || '') : (a, b) => (b.notes?.[sortK] || 0) - (a.notes?.[sortK] || 0) || a.name.localeCompare(b.name)); }
    return V;
  }
  const chip = (attr, v, on, lab) => `<button type="button" ${attr}="${esc(v)}" class="${on ? 'on' : ''}">${lab}</button>`;
  function barHTML(L){
    if (L.length < 2 && !zoneF && !CRIT.some(([k]) => filt[k])) return '';
    const zs = {}; for (const t of L) { const z = zoneOf(t); zs[z] = (zs[z] || 0) + 1; }
    const zl = Object.keys(zs).sort((a, b) => zs[b] - zs[a] || a.localeCompare(b));
    const any = zoneF || CRIT.some(([k]) => filt[k]);
    return `<div class="card gx-bar"><div class="gx-row" role="group" aria-label="Zone">${chip('data-gxzone', 'near', zoneF === 'near', '📍 Autour de moi')}${chip('data-gxzone', '', !zoneF, 'Toutes')}${zl.map(z => chip('data-gxzone', z, zoneF === z, `${esc(z)} <span class="gx-n">${zs[z]}</span>`)).join('')}</div>
      <div class="gx-row" role="group" aria-label="Filtrer par note">${CRIT.map(([k, l, ic]) => chip('data-gxfilt', k, filt[k], `${ic} ${l}${filt[k] ? ` ≥ ${filt[k]}★` : ''}`)).join('')}${any ? chip('data-gxfilt', '_reset', false, '✕ Effacer') : ''}</div>
      ${zoneF === 'near' ? `<p class="tiny muted" style="margin:6px 0 0">Traces passant à moins de 30 km de toi, les plus proches d'abord.</p>` : `<div class="gx-row" role="group" aria-label="Trier par"><span class="tiny muted" style="align-self:center">Trier :</span>${SORTS.map(([k, l]) => chip('data-gxsort', k, sortK === k, l)).join('')}</div>`}</div>`;
  }
  function locate(){
    if (!navigator.geolocation) { toast('Localisation indisponible sur cet appareil'); return; }
    toast('Recherche de ta position…');
    navigator.geolocation.getCurrentPosition(p => { here = [p.coords.latitude, p.coords.longitude]; zoneF = 'near'; render(); },
      () => { toast('Position refusée : autorise la localisation pour l\'app dans Réglages › Safari (ou ton navigateur)'); }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  }
  // ville de départ (une requête par trace, au rythme du géocodeur)
  const PHOTON = 'https://photon.komoot.io/reverse';
  const wait = ms => new Promise(r => setTimeout(r, ms));
  let townBusy = false; const townTried = new Set();
  async function fillTowns(){
    if (townBusy || !navigator.onLine) return; townBusy = true;
    try { for (const t of book()) { if (t.town !== undefined || townTried.has(t.id) || !t.pts?.length) continue; townTried.add(t.id);
        try { const q = new URLSearchParams({ lat: t.pts[0][0], lon: t.pts[0][1], limit: '1', lang: 'fr', radius: '8' }); for (const g of ['place:city', 'place:town', 'place:village']) q.append('osm_tag', g);
          const r = await fetch(`${PHOTON}?${q}`, { signal: AbortSignal.timeout?.(8000) }); if (!r.ok) continue;
          const f = (await r.json()).features?.[0]?.properties; t.town = (f?.name || f?.city || '').slice(0, 40); save(); pushSoon();
          if (TAB === 'profile' && PROFILE_PANE === 'gpx') render(); } catch (e) { console.warn('ville', e); }
        await wait(1200); } } finally { townBusy = false; }
  }
  const cardHTML = (t, act, extra = '') => { const nk = zoneF === 'near' ? nearKm(t) : null;
    return `<div class="gxc" data-gx="${act}" data-id="${esc(t.id)}"${extra} role="button" tabindex="0" aria-label="Ouvrir ${esc(t.name)}">
    <div class="gxc-map">${mapSVG(t.pts, 120, 96)}</div><div class="gxc-b"><b>${esc(t.name)}</b><div class="tiny muted">${f1(t.km)} km · ${t.dp} m D+${t.loop ?? isLoop(t) ? ' · boucle' : ''}</div>
    <div class="tiny muted gxc-z">📍 ${esc(zoneOf(t))}${t.town && zoneOf(t) !== t.town ? ` · départ ${esc(t.town)}` : ''}${nk != null ? ` · à ${f1(nk)} km` : ''}${t.bk?.length ? ` · 🥐 ${t.bk.length}` : ''}</div>${notesRO(t.notes)}</div></div>`; };
  const listHTML = (L, act, extra) => { const V = view(L);
    return V.length ? `<div class="gxlist">${V.map(t => cardHTML(t, act, extra)).join('')}</div>` : `<div class="card"><p class="muted small" style="margin:0 0 8px">Aucune trace ne correspond${zoneF === 'near' ? ' autour de toi' : ''}.</p><button class="btn sm" data-gxfilt="_reset">Tout afficher</button></div>`; };

  /* ---------- volet Mes GPX ---------- */
  let friendView = null; // id d'un ami dont on lit le livre
  const FR = { loaded: false, busy: false, err: null, list: [], names: {} };
  function gpxPane(){
    if (friendView) return friendPane();
    const L = book(); setTimeout(fillTowns, 0);
    let h = `<div class="pane-in">${paneHead('Mes GPX')}<div class="card"><div class="row between" style="align-items:center;gap:8px"><h2 style="margin:0">Mon livre de traces</h2><button class="btn sm primary" data-gx="import">+ Importer un GPX</button></div>
      <p class="tiny muted" style="margin:6px 0 0">Tes parcours préférés notés de 1 à 5 : 😄 fun, 🔥 difficulté, 🛣️ asphalte (qualité du revêtement), 🥐 boulangerie (les pauses gourmandes).</p></div>`;
    h += L.length ? barHTML(L) + listHTML(L, 'open', '')
      : `<div class="card"><p class="muted small" style="margin:0">Aucune trace pour l'instant. Importe un fichier .gpx exporté de Strava, Komoot, Garmin Connect ou RideWithGPS, ou ajoute une sortie depuis le Calendrier.</p></div>`;
    return h + shareHTML() + '</div>';
  }
  function shareHTML(){
    if (!Cloud.user) return `<div class="card"><h2>Ouvrir à mes amis</h2><p class="small muted" style="margin:0 0 10px">Connecte-toi pour ouvrir ton livre de traces à tes amis de l'app et lire le leur.</p><button class="btn primary" data-auth="open">Me connecter</button></div>`;
    if (!FR.loaded && !FR.busy) loadFriends().then(() => { if (TAB === 'profile' && PROFILE_PANE === 'gpx') render(); });
    const by = {}; for (const r of FR.list) (by[r.user_id] ||= []).push(r);
    const ids = Object.keys(by).sort((a, b) => (FR.names[a] || '').localeCompare(FR.names[b] || ''));
    return `<div class="card"><h2>Ouvrir à mes amis</h2>
      <label class="gx-tgl"><input type="checkbox" id="gxShare" ${S.gpxShare ? 'checked' : ''}><span><b>Mon livre est ouvert à mes amis</b><span class="tiny muted" style="display:block">Tes amis (volet Défis › Ajouter des amis) voient tes traces et tes notes, et peuvent télécharger le GPX. Ils ne peuvent rien modifier.</span></span></label>
      <h3 style="margin-top:14px">Les livres de mes amis</h3>
      ${!FR.loaded ? '<p class="small muted" style="margin:0">Chargement…</p>' : FR.err ? `<p class="small muted" style="margin:0">Livres indisponibles pour l'instant.</p><button class="btn sm" data-gx="retry" style="margin-top:8px">Réessayer</button>`
        : ids.length ? ids.map(u => `<div class="hist" data-gx="friend" data-u="${u}" role="button" tabindex="0" style="cursor:pointer"><span style="font-size:20px" aria-hidden="true">📖</span><b style="flex:1;min-width:0">${esc(FR.names[u] || 'Ami')}</b><span class="tiny muted">${by[u].length} trace${by[u].length > 1 ? 's' : ''}</span><span class="muted" aria-hidden="true">›</span></div>`).join('')
        : `<p class="small muted" style="margin:0">Aucun ami n'a encore ouvert son livre.</p>`}</div>`;
  }
  const friendTracks = u => FR.list.filter(r => r.user_id === u).map(r => ({ id: r.track_id, ...(r.meta || {}), pts: r.meta?.prev || [] }));
  function friendPane(){
    const L = friendTracks(friendView);
    return `<div class="pane-in">${paneHead(esc(FR.names[friendView] || 'Ami'), 'fback')}<div class="card"><h2 style="margin:0 0 4px">Son livre de traces</h2><p class="tiny muted" style="margin:0">Lecture seule : ses notes à lui. Touche une trace pour la voir et télécharger le GPX.</p></div>
      ${L.length ? barHTML(L) + listHTML(L, 'fopen', ` data-u="${friendView}"`) : '<div class="card"><p class="muted small" style="margin:0">Ce livre est vide ou n\'est plus partagé.</p></div>'}</div>`;
  }
  async function loadFriends(){
    if (!sb() || !uid()) return; FR.busy = true;
    try {
      const { data, error } = await sb().from('gpx_book').select('user_id, track_id, meta:data->meta').neq('user_id', uid()); if (error) throw error;
      FR.list = data || []; const ids = [...new Set(FR.list.map(r => r.user_id))];
      if (ids.length) { const { data: m } = await sb().from('members').select('user_id, display_name').in('user_id', ids); FR.names = Object.fromEntries((m || []).map(x => [x.user_id, x.display_name])); }
      FR.err = null;
    } catch (e) { console.warn('gpx amis', e); FR.err = e?.message || String(e); } finally { FR.loaded = true; FR.busy = false; }
  }

  /* ---------- synchro du livre partagé (seulement s'il est ouvert) ---------- */
  const PUSH_KEY = 'ftpb-gpx-pushed';
  const meta = t => ({ name: t.name, km: t.km, dp: t.dp, loop: isLoop(t), notes: t.notes || {}, comment: t.comment || '', added: t.added || null, town: t.town || '', bk: (t.bk || []).map(b => ({ la: b.la, lo: b.lo, n: b.n })),
    prev: t.pts.filter((_, i, a) => i % Math.max(1, Math.ceil(a.length/80)) === 0 || i === a.length - 1).map(p => [p[0], p[1]]) }); // aperçu léger pour la liste
  let pushT = null, pushing = false;
  const pushSoon = () => { clearTimeout(pushT); pushT = setTimeout(() => pushBook().catch(e => { console.warn('gpx partage', e); }), 1500); };
  async function pushBook(){
    if (!sb() || !uid() || pushing) return; pushing = true;
    try {
      let done = {}; try { done = JSON.parse(localStorage.getItem(PUSH_KEY) || '{}'); } catch {}
      if (done._u !== uid()) done = { _u: uid() };
      if (!S.gpxShare) { if (Object.keys(done).length > 1 || done._open !== false) { const { error } = await sb().from('gpx_book').delete().eq('user_id', uid()); if (error) throw error; done = { _u: uid(), _open: false }; } }
      else {
        delete done._open;
        const rows = book().map(t => ({ t, sig: JSON.stringify(meta(t)) })).filter(x => done[x.t.id] !== x.sig);
        if (rows.length) { const { error } = await sb().from('gpx_book').upsert(rows.map(({ t }) => ({ user_id: uid(), track_id: t.id, data: { meta: meta(t), pts: t.pts }, updated_at: new Date().toISOString() }))); if (error) throw error;
          rows.forEach(x => done[x.t.id] = x.sig); }
        const gone = Object.keys(done).filter(k => k[0] !== '_' && !book().some(t => t.id === k));
        if (gone.length) { const { error } = await sb().from('gpx_book').delete().eq('user_id', uid()).in('track_id', gone); if (error) throw error; gone.forEach(k => delete done[k]); }
      }
      localStorage.setItem(PUSH_KEY, JSON.stringify(done));
    } finally { pushing = false; }
  }

  /* ---------- import et fiche d'une trace ---------- */
  function importGPX(){
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.gpx,application/gpx+xml,application/xml,text/xml'; inp.multiple = true;
    inp.onchange = async () => { let n = 0, bad = 0, last = null;
      for (const f of inp.files) { const g = parseGPX(await f.text(), f.name); if (!g) { bad++; continue; }
        last = { id: rid(), ...g, notes: { fun: 0, diff: 0, asph: 0, boul: 0 }, comment: '', added: todayISO() }; book().push(last); n++; }
      if (n) { save(); pushSoon(); render(); }
      toast(n ? `${n} trace${n > 1 ? 's' : ''} ajoutée${n > 1 ? 's' : ''}${bad ? ` · ${bad} fichier${bad > 1 ? 's' : ''} illisible${bad > 1 ? 's' : ''}` : ''}` : 'Fichier GPX illisible (aucun point de trace)');
      if (n === 1) trackDlg(last.id, true); };
    inp.click();
  }
  function trackDlg(id, fresh){
    const t = book().find(x => x.id === id); if (!t) return;
    openDlg(`<div class="row" style="gap:8px;margin:0 30px 8px 0"><input id="gxName" value="${esc(t.name)}" aria-label="Nom de la trace" style="flex:1;min-width:0"><button class="btn sm" id="gxRename">Renommer</button></div>
      <p class="muted small" style="margin:0 0 8px">${f1(t.km)} km · ${t.dp} m D+${isLoop(t) ? ' · boucle' : ''} · ajoutée le ${dateFR(t.added || todayISO())}</p>
      <div class="gx-big">${mapSVG(t.pts, 640, 360, 'gpxmap big')}</div>${eleSVG(t.pts)}
      ${fresh ? '<div class="note" style="margin:8px 0">Note ta trace : touche les étoiles.</div>' : ''}
      <div class="gx-rate">${CRIT.map(([k, l, ic]) => `<div class="gx-rr"><span class="gx-rl"><span aria-hidden="true">${ic}</span> ${l}</span>${starsIn(k, t.notes?.[k] || 0, l)}</div>`).join('')}</div>
      <label class="f" for="gxCom">Mon commentaire</label><textarea id="gxCom" rows="2" maxlength="300" placeholder="La boulangerie de Dampierre, le revêtement refait après Senlisse…">${esc(t.comment || '')}</textarea>
      <h3 style="margin:14px 0 6px">🥐 Mes boulangeries</h3><div class="gx-lmap" id="gxLmap" role="application" aria-label="Carte du parcours : touche pour placer une boulangerie"></div>
      <div id="gxBk">${bkListHTML(t)}</div><button type="button" class="btn sm" id="gxBkFind" style="margin-top:8px">🔍 Chercher les boulangeries sur le parcours</button><div id="gxBkSug"></div>
      <div class="row between" style="margin-top:12px;gap:8px"><button class="btn primary" id="gxDl">Télécharger le GPX</button><button class="btn danger sm" id="gxDel">Supprimer</button></div>`);
    const commit = () => { save(); pushSoon(); render(); };
    $('#gxRename').onclick = () => { const v = $('#gxName').value.trim().slice(0, 60); if (!v) return; t.name = v; commit(); toast('Trace renommée'); };
    $('#gxCom').onchange = () => { t.comment = $('#gxCom').value.trim().slice(0, 300); commit(); };
    dlgBody.querySelectorAll('[data-gstar]').forEach(g => g.onclick = e => { const b = e.target.closest('button[data-v]'); if (!b) return;
      const k = g.dataset.gstar, v = +b.dataset.v; t.notes ||= {}; t.notes[k] = t.notes[k] === v ? v - 1 : v; // retoucher la même étoile retire une étoile
      g.querySelectorAll('button').forEach(x => x.classList.toggle('on', +x.dataset.v <= t.notes[k])); commit(); });
    $('#gxDl').onclick = () => dlGPX(t);
    wireBakeries(t, commit);
    $('#gxDel').onclick = () => { if (!confirmDel.armed) { confirmDel.armed = true; $('#gxDel').textContent = 'Confirmer la suppression'; setTimeout(() => confirmDel.armed = false, 4000); return; }
      confirmDel.armed = false; S.gpxBook = book().filter(x => x !== t); closeDlg(); commit(); toast('Trace supprimée'); };
  }
  const confirmDel = { armed: false };
  async function friendDlg(u, id){
    const m = friendTracks(u).find(x => x.id === id); if (!m) return;
    openDlg(`<h2 style="margin-right:30px">${esc(m.name)}</h2><p class="muted small" style="margin:0 0 8px">${esc(FR.names[u] || 'Ami')} · ${f1(m.km)} km · ${m.dp} m D+${m.loop ? ' · boucle' : ''}</p><div id="gxFr"><p class="small muted">Chargement du tracé…</p></div>`);
    let full = null;
    try { const { data, error } = await sb().from('gpx_book').select('data').eq('user_id', u).eq('track_id', id).maybeSingle(); if (error) throw error; full = data?.data; } catch (e) { console.warn('gpx ami', e); }
    const box = $('#gxFr'); if (!box) return;
    if (!full?.pts) { box.innerHTML = '<p class="small muted">Trace indisponible (plus partagée ?).</p>'; return; }
    const t = { ...m, pts: full.pts };
    box.innerHTML = `<div class="gx-big">${mapSVG(t.pts, 640, 360, 'gpxmap big')}</div>${eleSVG(t.pts)}
      <div class="gx-rate">${CRIT.map(([k, l, ic]) => `<div class="gx-rr"><span class="gx-rl"><span aria-hidden="true">${ic}</span> ${l}</span>${starsRO(t.notes?.[k] || 0)}</div>`).join('')}</div>
      ${t.comment ? `<p class="small" style="margin:10px 0 0">« ${esc(t.comment)} »</p>` : ''}
      <h3 style="margin:14px 0 6px">🥐 Ses boulangeries</h3><div class="gx-lmap" id="gxFrMap"></div><div>${bkListHTML(t, true)}</div>
      <div class="row" style="margin-top:12px;gap:8px"><button class="btn primary" id="gxFrDl">Télécharger le GPX</button><button class="btn" id="gxFrAdd">Copier dans mon livre</button></div>`;
    $('#gxFrDl').onclick = () => dlGPX(t);
    bakeryMap($('#gxFrMap'), t, null);
    $('#gxFrAdd').onclick = () => { book().push({ id: rid(), name: t.name, km: t.km, dp: t.dp, pts: t.pts, bk: (t.bk || []).map(b => ({ id: rid(), ...b })), notes: { fun: 0, diff: 0, asph: 0, boul: 0 }, comment: '', added: todayISO() }); save(); pushSoon(); toast('Trace copiée dans ton livre : à toi de la noter'); };
  }

  /* ---------- depuis une sortie extérieure (Calendrier › séance › « Ajouter à mes traces ») ---------- */
  const inBook = actId => book().find(t => t.act === actId);
  const addBtnHTML = a => !a || isIndoor(a) ? '' : inBook(a.id) ? `<button class="btn" data-gxact="${esc(a.id)}" style="margin:4px 0 2px">✓ Dans mes traces · voir</button>` : `<button class="btn" data-gxact="${esc(a.id)}" style="margin:4px 0 2px">⭐ Ajouter à mes traces</button>`;
  async function addFromActivity(id){
    const a = S.activities.find(x => x.id === id); if (!a) return;
    const have = inBook(a.id); if (have) { trackDlg(have.id); return; }
    const tr = await Tracks.get(a);
    if (!tr?.lat?.length) { toast(a.startTs ? "Pas encore de tracé GPS pour cette sortie : il arrive avec la synchro Intervals.icu, un fichier .fit ou Strava." : 'Pas de tracé GPS pour cette sortie.'); return; }
    const raw = tr.lat.map((la, i) => [la, tr.lon[i], tr.alt?.[i] ?? null]).filter(p => p[0] != null && p[1] != null && isFinite(p[0]) && isFinite(p[1]) && (p[0] || p[1]));
    const pl = a.planId ? S.plan.find(s => s.id === a.planId) : null;
    const g = fromRaw(raw, ((pl ? WORKOUTS[pl.workoutId]?.name : a.name) || 'Sortie').slice(0, 60)); if (!g) { toast('Tracé trop court pour le livre'); return; }
    const t = { id: rid(), act: a.id, ...g, notes: { fun: 0, diff: 0, asph: 0, boul: 0 }, comment: '', added: todayISO() };
    book().push(t); save(); pushSoon(); render(); toast('Ajoutée à Mes GPX : note-la !'); trackDlg(t.id, true);
  }

  /* ---------- carte des boulangeries (Leaflet chargé à la demande, fond CARTO / OpenStreetMap) ---------- */
  const LEAF = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/';
  let leafP = null;
  const loadLeaflet = () => window.L?.map ? Promise.resolve(window.L) : leafP ||= new Promise((ok, ko) => {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = LEAF + 'leaflet.css'; document.head.appendChild(l);
    const s = document.createElement('script'); s.src = LEAF + 'leaflet.js'; s.onload = () => ok(window.L); s.onerror = () => { leafP = null; ko(new Error('carte indisponible')); }; document.head.appendChild(s); });
  const darkMap = () => { const th = document.documentElement.getAttribute('data-theme'); return th ? th === 'dark' : !matchMedia('(prefers-color-scheme: light)').matches; };
  async function bakeryMap(box, t, onAdd){
    let L; try { L = await loadLeaflet(); } catch { box.classList.add('off'); box.innerHTML = '<p class="tiny muted" style="margin:0;padding:12px">Carte indisponible hors connexion.</p>'; return null; }
    if (!box.isConnected || !t.pts?.length) return null;
    const m = L.map(box, { zoomControl: true, attributionControl: true });
    L.tileLayer(`https://{s}.basemaps.cartocdn.com/${darkMap() ? 'dark_all' : 'light_all'}/{z}/{x}/{y}{r}.png`, { maxZoom: 19, subdomains: 'abcd', attribution: '© OpenStreetMap · © CARTO' }).addTo(m);
    const line = L.polyline(t.pts.map(p => [p[0], p[1]]), { color: '#ff8a4c', weight: 4, opacity: 0.9 }).addTo(m);
    m.fitBounds(line.getBounds(), { padding: [18, 18] });
    const icon = () => L.divIcon({ className: 'bk-ic', html: '🥐', iconSize: [30, 30], iconAnchor: [15, 15] });
    const layer = L.layerGroup().addTo(m), sug = L.layerGroup().addTo(m);
    const draw = () => { layer.clearLayers(); for (const b of t.bk || []) L.marker([b.la, b.lo], { icon: icon(), title: b.n || 'Boulangerie', keyboard: false }).bindTooltip(esc(b.n || 'Boulangerie')).addTo(layer); };
    draw();
    if (onAdd) m.on('click', e => onAdd(+e.latlng.lat.toFixed(5), +e.latlng.lng.toFixed(5)));
    setTimeout(() => m.invalidateSize(), 60);
    return { m, L, draw, sug };
  }
  const bkListHTML = (t, ro) => (t.bk || []).length ? t.bk.map((b, i) => ro ? `<div class="bk-row"><span aria-hidden="true">🥐</span><span>${esc(b.n || 'Boulangerie')}</span></div>`
      : `<div class="bk-row"><span aria-hidden="true">🥐</span><input data-bkn="${i}" value="${esc(b.n || '')}" placeholder="Nom de la boulangerie" maxlength="60" aria-label="Nom de la boulangerie"><button type="button" class="btn sm ghost" data-bkdel="${i}" aria-label="Retirer cette boulangerie">×</button></div>`).join('')
    : `<p class="tiny muted" style="margin:6px 0 0">${ro ? 'Aucune boulangerie notée.' : "Touche la carte à l'endroit d'une boulangerie pour l'ajouter, ou cherche celles du parcours."}</p>`;
  // boulangeries OpenStreetMap à moins de 300 m du tracé (quelques points du parcours, au rythme du géocodeur)
  async function findBakeries(t, onStep){
    const P = t.pts, n = Math.min(12, Math.max(3, Math.round(t.km/8))), seen = new Map();
    for (let k = 0; k < n; k++) { const p = P[Math.round(k*(P.length - 1)/Math.max(1, n - 1))]; onStep(k + 1, n);
      try { const q = new URLSearchParams({ lat: p[0], lon: p[1], limit: '8', lang: 'fr', radius: '1', osm_tag: 'shop:bakery' });
        const r = await fetch(`${PHOTON}?${q}`, { signal: AbortSignal.timeout?.(8000) });
        if (r.ok) for (const f of (await r.json()).features || []) { const [lo, la] = f.geometry?.coordinates || []; if (la == null) continue;
          const key = la.toFixed(4) + ',' + lo.toFixed(4); if (!seen.has(key)) seen.set(key, { la: +la.toFixed(5), lo: +lo.toFixed(5), n: (f.properties?.name || 'Boulangerie').slice(0, 60), city: f.properties?.city || '' }); } } catch (e) { console.warn('boulangeries', e); }
      if (k < n - 1) await wait(1100); }
    return [...seen.values()].filter(s => Math.min(...P.map(p => dist(p, [s.la, s.lo]))) < 0.3 && !(t.bk || []).some(b => dist([b.la, b.lo], [s.la, s.lo]) < 0.05));
  }
  function wireBakeries(t, commit){
    const box = $('#gxLmap'), list = $('#gxBk'), sugBox = $('#gxBkSug'); let M = null, found = [];
    const refresh = () => { list.innerHTML = bkListHTML(t); M?.draw(); };
    const add = (la, lo, n = 'Boulangerie') => { (t.bk ||= []).push({ id: rid(), la, lo, n }); refresh(); commit(); };
    bakeryMap(box, t, add).then(x => M = x);
    list.oninput = e => { const i = e.target.dataset?.bkn; if (i == null || !t.bk[i]) return; t.bk[i].n = e.target.value.slice(0, 60); };
    list.onchange = e => { if (e.target.dataset?.bkn != null) { M?.draw(); commit(); } };
    list.onclick = e => { const d = e.target.closest('[data-bkdel]'); if (!d) return; t.bk.splice(+d.dataset.bkdel, 1); refresh(); commit(); };
    const drawSug = () => { if (M) { M.sug.clearLayers(); for (const s of found) M.L.circleMarker([s.la, s.lo], { radius: 7, color: '#ffb02e', weight: 2, fillOpacity: 0.25 }).bindTooltip(esc(s.n)).addTo(M.sug); }
      sugBox.innerHTML = found.length ? `<p class="tiny muted" style="margin:8px 0 2px">Trouvées près du parcours (OpenStreetMap) :</p>${found.map((s, i) => `<div class="bk-row"><span aria-hidden="true">🥐</span><span style="flex:1;min-width:0">${esc(s.n)}${s.city ? ` <span class="tiny muted">· ${esc(s.city)}</span>` : ''}</span><button type="button" class="btn sm" data-bksug="${i}">+ Ajouter</button></div>`).join('')}` : ''; };
    sugBox.onclick = e => { const b = e.target.closest('[data-bksug]'); if (!b) return; const s = found.splice(+b.dataset.bksug, 1)[0]; if (s) { add(s.la, s.lo, s.n); drawSug(); } };
    const fb = $('#gxBkFind'); fb.onclick = async () => { fb.disabled = true;
      found = await findBakeries(t, (k, n) => fb.textContent = `Recherche… ${k}/${n}`);
      fb.disabled = false; fb.textContent = '🔍 Chercher les boulangeries sur le parcours';
      if (!found.length) sugBox.innerHTML = '<p class="tiny muted" style="margin:8px 0 0">Aucune boulangerie connue d\'OpenStreetMap à moins de 300 m du parcours (ou recherche impossible hors connexion).</p>'; else drawSug(); };
  }

  /* ---------- carrés du Profil ---------- */
  const IC = { climbs: '<path d="M3 20l6-10 4 6 3-4 5 8z"/><path d="M9 10l1.6-2.6"/>', gpx: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7"/>' };
  const sq = (k, col, big, lab) => `<button type="button" data-pp="${k}" style="--sq:${col}"><svg viewBox="0 0 24 24" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[k]}</svg>
    <span><span class="big num">${big}</span><br><span class="lab" style="color:${col}">${lab}</span></span></button>`;
  const squaresHTML = () => { let nC = 0; try { nC = Climbs.groups().length; } catch {} return `<div class="dsq pp-sq">${sq('climbs', 'var(--h-prog1)', nC, 'Mes<br>ascensions')}${sq('gpx', 'var(--accent)', book().length, 'Mes<br>GPX')}</div>`; };
  const climbsPane = () => `<div class="pane-in pp-climbs">${paneHead('Ascensions')}${Climbs.html()}</div>`;

  /* ---------- photos : IndexedDB (cache local) + stockage privé Supabase (dossier = id du compte) ---------- */
  const PH = (() => {
    let dbp = null; const urls = {}, tried = new Set();
    const db = () => dbp ||= new Promise((res, rej) => { const r = indexedDB.open('ftpb-photos', 1); r.onupgradeneeded = () => r.result.createObjectStore('p'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const tx = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('p', mode), q = fn(t.objectStore('p')); t.oncomplete = () => res(q?.result); t.onerror = () => rej(t.error); }); };
    const path = id => `${uid()}/${id}.jpg`;
    const put = (id, blob) => tx('readwrite', s => s.put(blob, id));
    const blob = id => tx('readonly', s => s.get(id)).catch(() => null);
    async function url(id){
      if (urls[id]) return urls[id];
      let b = await blob(id);
      if (!b && sb() && uid()) { try { const { data } = await sb().storage.from(BUCKET).download(path(id)); if (data) { b = data; put(id, b).catch(() => {}); } } catch (e) { console.warn('photo', e); } }
      return b ? (urls[id] = URL.createObjectURL(b)) : null;
    }
    async function upload(p){
      if (!sb() || !uid() || p.up || tried.has(p.id)) return; tried.add(p.id);
      const b = await blob(p.id); if (!b) return;
      const { error } = await sb().storage.from(BUCKET).upload(path(p.id), b, { contentType: 'image/jpeg', upsert: true });
      if (error) console.warn('photo', error); else { p.up = true; save(); }
    }
    async function del(id){
      tx('readwrite', s => s.delete(id)).catch(() => {}); if (urls[id]) URL.revokeObjectURL(urls[id]); delete urls[id];
      if (sb() && uid()) { try { await sb().storage.from(BUCKET).remove([path(id)]); } catch {} }
    }
    return { put, url, upload, del };
  })();
  async function shrink(file){ // ≤ 1600 px, JPEG : une photo de téléphone passe de ~4 Mo à ~300 ko
    let src = await createImageBitmap(file).catch(() => null), w, h;
    if (src) { w = src.width; h = src.height; }
    else { src = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); }); w = src.naturalWidth; h = src.naturalHeight; }
    const k = Math.min(1, 1600/Math.max(w, h)), c = document.createElement('canvas'); c.width = Math.round(w*k); c.height = Math.round(h*k);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return new Promise(res => c.toBlob(res, 'image/jpeg', 0.82));
  }
  function hydrate(root = document){
    root.querySelectorAll('img[data-ph]:not([src])').forEach(async img => { const u = await PH.url(img.dataset.ph); if (u) img.src = u; else img.closest('.rc-f, .race-th, .rc-bigw')?.classList.add('miss'); });
  }

  /* ---------- Mes courses ---------- */
  function autoRace(){
    const r = S.tri?.race; if (!r?.date || !r.name || r.date >= todayISO()) return;
    const key = 'tri-' + r.date; if (races().some(x => x.auto === key) || (S.racesSkip || []).includes(key)) return;
    let ex = []; try { ex = Health.extraWorkouts() || []; } catch {}
    const sec = S.activities.filter(a => a.date === r.date).reduce((s, a) => s + (a.durationS || 0), 0) + ex.filter(e => e.date === r.date).reduce((s, e) => s + (e.w?.duration_min || 0)*60, 0);
    races().push({ id: rid(), auto: key, name: r.name, date: r.date, sport: 'tri', time: sec ? hms(sec) : '', rank: '', note: '', photos: [] }); save();
  }
  function racesHTML(){
    autoRace();
    const L = races().slice().sort((a, b) => b.date.localeCompare(a.date));
    if (Cloud.user) for (const r of L) for (const p of r.photos || []) if (!p.up) PH.upload(p);
    setTimeout(() => hydrate($('#racesCard') || document), 0);
    return `<div class="card" id="racesCard"><div class="row between" style="align-items:center;gap:8px"><h2 style="margin:0">Mes courses</h2><button class="btn sm primary" data-rc="new">+ Ajouter</button></div>
      ${L.length ? `<div style="margin-top:6px">${L.map(r => `<div class="race" data-rc="open" data-id="${esc(r.id)}" role="button" tabindex="0" aria-label="Ouvrir ${esc(r.name)}"><span class="race-ic" aria-hidden="true">${(SPORTS[r.sport] || SPORTS.other)[0]}</span>
        <div style="flex:1;min-width:0"><b>${esc(r.name)}</b><div class="tiny muted">${dateFR(r.date)}${r.time ? ` · ${esc(r.time)}` : ''}${r.rank ? ` · ${esc(r.rank)}` : ''}</div></div>
        ${r.photos?.length ? `<div class="race-th">${r.photos.slice(0, 3).map(p => `<img data-ph="${esc(p.id)}" alt="">`).join('')}${r.photos.length > 3 ? `<span class="tiny muted">+${r.photos.length - 3}</span>` : ''}</div>` : ''}</div>`).join('')}</div>`
        : `<p class="small muted" style="margin:10px 0 0">Garde ici tes courses passées : temps, classement, et les photos (médaille, dossard, ligne d'arrivée…).${S.tri?.race?.name ? ` « ${esc(S.tri.race.name)} » s'ajoutera toute seule une fois courue.` : ''}</p>`}</div>`;
  }
  let draft = null;
  function raceDlg(id){
    const r = id ? races().find(x => x.id === id) : null; if (id && !r) return;
    draft = r || { id: null, name: '', date: todayISO(), sport: 'tri', time: '', rank: '', note: '', photos: [] };
    const d = draft;
    openDlg(`<h2 style="margin-right:30px">${r ? esc(r.name) : 'Nouvelle course'}</h2>
      <label class="f" for="rcName">Nom</label><input id="rcName" value="${esc(d.name)}" maxlength="80" placeholder="AlpsMan Half, Marmotte, semi de Paris…">
      <div class="grid2"><div><label class="f" for="rcDate">Date</label><input type="date" id="rcDate" value="${d.date}" max="${todayISO()}"></div>
        <div><label class="f" for="rcSport">Sport</label><select id="rcSport">${Object.entries(SPORTS).map(([k, [ic, l]]) => `<option value="${k}"${d.sport === k ? ' selected' : ''}>${ic} ${l}</option>`).join('')}</select></div></div>
      <div class="grid2"><div><label class="f" for="rcTime">Temps</label><input id="rcTime" value="${esc(d.time)}" placeholder="5:42:10" inputmode="numeric" maxlength="12"></div>
        <div><label class="f" for="rcRank">Classement</label><input id="rcRank" value="${esc(d.rank)}" placeholder="152e / 900" maxlength="40"></div></div>
      ${d.auto ? `<p class="tiny muted" style="margin:6px 0 0">Ajoutée toute seule après ta course objectif. ${d.time ? 'Temps calculé avec tes séances du jour (transitions non comprises) : corrige-le avec ton temps officiel.' : 'Saisis ton temps officiel.'}</p>` : ''}
      <label class="f" for="rcNote">Souvenirs</label><textarea id="rcNote" rows="2" maxlength="500" placeholder="Météo, sensations, ravitos…">${esc(d.note)}</textarea>
      <h3 style="margin-top:14px">Photos</h3><div class="rc-ph" id="rcPh">${photosHTML(d)}</div>
      <button class="btn" id="rcAdd" style="margin-top:8px">📷 Ajouter des photos</button>
      <div class="row between" style="margin-top:14px;gap:8px"><button class="btn primary" id="rcSave">Enregistrer</button>${r ? '<button class="btn danger sm" id="rcDel">Supprimer la course</button>' : ''}</div>`);
    hydrate(dlgBody);
    const read = () => { d.name = $('#rcName').value.trim().slice(0, 80); d.date = $('#rcDate').value || d.date; d.sport = $('#rcSport').value; d.time = $('#rcTime').value.trim().slice(0, 12); d.rank = $('#rcRank').value.trim().slice(0, 40); d.note = $('#rcNote').value.trim().slice(0, 500); };
    const commit = () => { read(); if (!d.name) { toast('Donne un nom à ta course'); $('#rcName').focus(); return false; }
      if (!d.id) { d.id = rid(); races().push(d); } save(); render(); return true; };
    $('#rcSave').onclick = () => { if (commit()) { closeDlg(); toast('Course enregistrée'); } };
    $('#rcAdd').onclick = () => { if (!commit()) return;
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
      inp.onchange = async () => { const files = [...inp.files].slice(0, 12); if (!files.length) return; toast(`Ajout de ${files.length} photo${files.length > 1 ? 's' : ''}…`);
        let n = 0; for (const f of files) { try { const b = await shrink(f); if (!b) continue; const p = { id: rid(), kind: d.photos.length ? 'other' : 'medal', up: false }; await PH.put(p.id, b); d.photos.push(p); n++; PH.upload(p); } catch (e) { console.warn('photo', e); } }
        save(); render(); const box = $('#rcPh'); if (box) { box.innerHTML = photosHTML(d); hydrate(box); }
        if (n < files.length) toast(`${files.length - n} photo${files.length - n > 1 ? 's' : ''} illisible${files.length - n > 1 ? 's' : ''}`); };
      inp.click(); };
    $('#rcPh').onchange = e => { const s = e.target.closest('select[data-phk]'); if (!s) return; const p = d.photos.find(x => x.id === s.dataset.phk); if (p) { p.kind = s.value; if (d.id) { save(); render(); } } };
    $('#rcPh').onclick = e => { const del = e.target.closest('[data-phdel]');
      if (del) { const p = d.photos.find(x => x.id === del.dataset.phdel); if (!p) return; d.photos = d.photos.filter(x => x !== p); PH.del(p.id); if (d.id) { save(); render(); } $('#rcPh').innerHTML = photosHTML(d); hydrate($('#rcPh')); return; }
      const im = e.target.closest('img[data-ph]'); if (im && d.id) { read(); bigDlg(d, im.dataset.ph); } };
    const rd = $('#rcDel'); if (rd) rd.onclick = () => { if (!confirmDel.armed) { confirmDel.armed = true; rd.textContent = 'Confirmer : effacer course et photos'; setTimeout(() => confirmDel.armed = false, 4000); return; }
      confirmDel.armed = false; for (const p of d.photos) PH.del(p.id); S.races = races().filter(x => x !== d); if (d.auto) (S.racesSkip ||= []).push(d.auto); save(); closeDlg(); render(); toast('Course supprimée'); };
  }
  const photosHTML = d => d.photos.length ? d.photos.map(p => `<figure class="rc-f"><img data-ph="${esc(p.id)}" alt="${esc(KINDS[p.kind] || 'Photo')}" role="button" tabindex="0">
      <figcaption><select data-phk="${esc(p.id)}" aria-label="Type de photo">${Object.entries(KINDS).map(([k, l]) => `<option value="${k}"${p.kind === k ? ' selected' : ''}>${l}</option>`).join('')}</select></figcaption>
      <button type="button" class="rc-x" data-phdel="${esc(p.id)}" aria-label="Retirer la photo">×</button></figure>`).join('')
    : '<p class="tiny muted" style="margin:0">Médaille, dossard, ligne d\'arrivée… tes photos restent privées (ton téléphone + ton compte).</p>';
  function bigDlg(d, pid){
    const i = d.photos.findIndex(p => p.id === pid), p = d.photos[i]; if (!p) return;
    openDlg(`<button class="btn sm ghost" data-rc="open" data-id="${esc(d.id)}">‹ ${esc(d.name)}</button>
      <div class="rc-bigw"><img class="rc-big" data-ph="${esc(p.id)}" alt="${esc(KINDS[p.kind] || 'Photo')}"></div>
      <div class="row between" style="margin-top:8px"><span class="small muted">${esc(KINDS[p.kind] || 'Photo')} · ${i + 1}/${d.photos.length}</span>
      <span class="row" style="gap:6px">${d.photos.length > 1 ? `<button class="btn sm" data-rcph="${esc(d.photos[(i - 1 + d.photos.length) % d.photos.length].id)}" aria-label="Photo précédente">‹</button><button class="btn sm" data-rcph="${esc(d.photos[(i + 1) % d.photos.length].id)}" aria-label="Photo suivante">›</button>` : ''}</span></div>`);
    hydrate(dlgBody);
    dlgBody.querySelectorAll('[data-rcph]').forEach(b => b.onclick = () => bigDlg(d, b.dataset.rcph));
  }

  /* ---------- clics ---------- */
  document.addEventListener('click', e => {
    const pp = e.target.closest('[data-pp]');
    if (pp) { const v = pp.dataset.pp;
      if (v === 'fback') friendView = null; else { PROFILE_PANE = v === 'back' ? null : v; friendView = null; if (v === 'gpx') FR.loaded = false; }
      if (dlg.open) closeDlg(); TAB = 'profile'; render(); window.scrollTo(0, 0); return; }
    const gs = e.target.closest('[data-gxsort]'); if (gs) { sortK = gs.dataset.gxsort; render(); return; }
    const gz = e.target.closest('[data-gxzone]'); if (gz) { const v = gz.dataset.gxzone; if (v === 'near') { if (zoneF === 'near') { zoneF = null; render(); } else locate(); } else { zoneF = v || null; render(); } return; }
    const gf = e.target.closest('[data-gxfilt]'); if (gf) { const k = gf.dataset.gxfilt; if (k === '_reset') { CRIT.forEach(([c]) => filt[c] = 0); zoneF = null; } else filt[k] = [0, 3, 4, 5][([0, 3, 4, 5].indexOf(filt[k]) + 1) % 4]; render(); return; }
    const gx = e.target.closest('[data-gx]');
    if (gx) { const a = gx.dataset.gx;
      if (a === 'import') importGPX();
      else if (a === 'open') trackDlg(gx.dataset.id);
      else if (a === 'friend') { friendView = gx.dataset.u; render(); window.scrollTo(0, 0); }
      else if (a === 'fopen') friendDlg(gx.dataset.u, gx.dataset.id);
      else if (a === 'retry') { FR.loaded = false; render(); }
      return; }
    const ga = e.target.closest('[data-gxact]'); if (ga) { addFromActivity(ga.dataset.gxact); return; }
    const rc = e.target.closest('[data-rc]');
    if (rc) raceDlg(rc.dataset.rc === 'open' ? rc.dataset.id : null);
  });
  document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('.gxc, .race, [data-gx="friend"]')) { e.preventDefault(); e.target.click(); } });
  document.addEventListener('change', async e => { if (e.target.id !== 'gxShare') return;
    const on = e.target.checked; S.gpxShare = on; save();
    try { await pushBook(); toast(on ? 'Livre ouvert à tes amis' : 'Livre fermé : tes amis ne voient plus tes traces'); }
    catch (er) { S.gpxShare = !on; save(); e.target.checked = !on; toast('Partage impossible pour l\'instant : ' + (er?.message || er)); } });

  const wipeLocal = () => { try { indexedDB.deleteDatabase('ftpb-photos'); localStorage.removeItem(PUSH_KEY); } catch {} };
  return { addBtnHTML, addFromActivity, wipeLocal, squaresHTML, racesHTML, gpxPane, climbsPane, parseGPX, toGPX, pushBook, autoRace, get FR(){ return FR; } };
})();
