"use strict";
// FTP Builder · ascensions
/* ============ ascensions (≥ 400 m de D+ consécutifs) ============ */
// détectées dans les tracés GPS, puissance estimée par la physique (ou mesurée si capteur), prédiction façon loi de Riegel
const Climbs = (() => {
  const MIN_GAIN = 400, K = 0.07, CV = 3; // CV : version de l'analyse (2 : trajet de la montée gardé pour le nommage) // P(t) = P60 × (t/60 min)^−K : l'équivalent vélo de la loi de Riegel (b ≈ 1,07)
  const PHY = { g: 9.81, bike: 8, crr: 0.005, cda: 0.35, eta: 0.975 };
  const COLORS = [[4,'var(--g1)'],[7,'var(--g2)'],[10,'var(--g3)'],[99,'var(--g4)']]; // 4 teintes : < 4 %, 4-7, 7-10, ≥ 10 %
  const catOf = p => COLORS.findIndex(([m]) => p < m), gradCol = p => COLORS[catOf(p)][1];
  const PRESETS = [ // valeurs approximatives (longueur km, D+ m)
    { id:'alpe', name:"Alpe d'Huez (Bourg-d'Oisans)", L:13.8, H:1071 },
    { id:'tourmalet', name:'Tourmalet (Luz-Saint-Sauveur)', L:19.0, H:1404 },
    { id:'ventoux', name:'Mont Ventoux (Bédoin)', L:21.5, H:1610 },
    { id:'galibier', name:'Galibier (Valloire)', L:18.1, H:1245 },
    { id:'jouxplane', name:'Joux Plane (Samoëns)', L:11.6, H:989 },
  ];
  let scanning = false, open = false, predOpen = false; const tried = new Set();
  const fmtT = s => { s = Math.round(s); const h = Math.floor(s/3600), m = Math.floor(s%3600/60), x = s%60; return h ? `${h}h${pad(m)}'${pad(x)}` : `${m}'${pad(x)}`; };
  const f1 = v => (Math.round(v*10)/10).toString().replace('.', ','), f2 = v => v.toFixed(2).replace('.', ',');
  const rho = alt => 1.225*Math.exp(-(alt || 0)/8500);
  const km = (la1, lo1, la2, lo2) => Math.hypot((lo2-lo1)*Math.cos(la1*Math.PI/180)*111.32, (la2-la1)*110.54);

  // détection : du point bas au sommet, une redescente de plus de max(30 m, 10 % du gain, ≤ 100 m) clôt la montée
  function prep(tr){
    const n = tr.lat.length;
    let alt = tr.alt.map(v => v ?? null); for (let i = 0; i < n; i++) if (alt[i] == null) alt[i] = alt[i-1] ?? alt.find(v => v != null) ?? 0;
    alt = alt.map((_, i) => { let s = 0, c = 0; for (let j = Math.max(0, i-2); j <= Math.min(n-1, i+2); j++) { s += alt[j]; c++; } return s/c; });
    let d = tr.d; if (!d || d[n-1] == null) { d = [0]; for (let i = 1; i < n; i++) d.push(d[i-1] + km(tr.lat[i-1], tr.lon[i-1], tr.lat[i], tr.lon[i])); }
    return { n, alt, d };
  }
  // point du tracé le plus proche d'une position (entre lo et hi)
  const nearestIdx = (tr, p, lo = 0, hi = tr.lat.length - 1) => { let best = lo, bd = Infinity; for (let i = lo; i <= hi; i++) { const x = km(p[0], p[1], tr.lat[i], tr.lon[i]); if (x < bd) { bd = x; best = i; } } return { i: best, dist: bd }; };
  // bornes corrigées à la main : on les applique à toute montée détectée au même endroit (passages passés et futurs)
  function applyFix(act, tr, c){
    const f = (S.climbFix || []).find(f => km(...f.from.s, ...c.s) < 0.5 && km(...f.from.e, ...c.e) < 0.5); if (!f) return c;
    const P = prep(tr), a = nearestIdx(tr, f.to.s), b = nearestIdx(tr, f.to.e, a.i + 1);
    if (a.dist > 0.3 || b.dist > 0.3 || b.i <= a.i) return c;
    return { ...measure(act, tr, { a: a.i, b: b.i, ...P }), fixed: true };
  }
  function detect(tr){
    const n = tr.lat.length; if (!tr.alt || n < 20) return [];
    const { alt, d } = prep(tr);
    const out = []; let s = 0, p = 0;
    // bornes : on retire le plat avant le pied et le replat sous le sommet (pente < 2 % sur 500 m)
    const ahead = (i, lim) => { let j = i; while (j < lim && d[j] - d[i] < 0.5) j++; return j; };
    const behind = (i, lim) => { let j = i; while (j > lim && d[i] - d[j] < 0.5) j--; return j; };
    const close = () => { if (alt[p] - alt[s] < MIN_GAIN) return; let a = s, b = p;
      while (a < b) { const j = ahead(a, b); if (j > a && (alt[j] - alt[a])/((d[j] - d[a])*1000 || 1) < 0.02) a++; else break; }
      while (b > a) { const j = behind(b, a); if (j < b && (alt[b] - alt[j])/((d[b] - d[j])*1000 || 1) < 0.02) b--; else break; }
      if (alt[b] - alt[a] < MIN_GAIN) return;
      // cœur de la montée : la portion ≥ 400 m qui maximise D+² / longueur (l'indice « difficulté » des sites de cols)
      let ba = a, bb = b, best = (alt[b] - alt[a])**2/Math.max(0.1, d[b] - d[a]);
      for (let i = a; i < b; i++) for (let j = b; j > i; j--) { const H = alt[j] - alt[i]; if (H < MIN_GAIN) break; const sc = H*H/Math.max(0.1, d[j] - d[i]); if (sc > best*1.08) { best = sc; ba = i; bb = j; } }
      out.push([ba, bb]); };
    for (let i = 1; i < n; i++) {
      if (alt[i] > alt[p]) p = i;
      else if (alt[i] <= alt[s] && p === s) { s = i; p = i; }
      else if (alt[p] - alt[i] > Math.min(100, Math.max(30, 0.1*(alt[p] - alt[s])))) { close(); s = i; p = i; }
      if (alt[i] < alt[s] && alt[p] - alt[s] < 20) { s = i; p = i; }
    }
    close();
    return out.map(([a, b]) => ({ a, b, alt, d }));
  }
  // une ascension : longueur, D+, pentes par tronçon, temps en mouvement, VAM, puissance estimée
  function measure(act, tr, { a, b, alt, d }){
    const kg = S.profile.weightKg, m = kg + PHY.bike;
    let E = 0, T = 0, up = 0;
    for (let j = a; j < b; j++) {
      const dl = (d[j+1] - d[j])*1000, dh = alt[j+1] - alt[j], dt = tr.t ? tr.t[j+1] - tr.t[j] : null;
      if (dh > 0) up += dh;
      if (!dt || dt <= 0) continue; const v = dl/dt; if (v < 0.8) continue; // à l'arrêt : ni temps ni énergie
      E += m*PHY.g*dh + PHY.crr*m*PHY.g*dl + 0.5*rho(alt[j])*PHY.cda*v*v*dl; T += dt;
    }
    const L = d[b] - d[a], H = alt[b] - alt[a];
    let P = T ? E/T/PHY.eta : null, measured = false;
    if (act.hasPower && act.pwSample && tr.t) { // capteur : moyenne réelle sur la fenêtre de la montée
      const n = act.pwSample.length, secs = act.sampleSecs || act.durationS || n, i0 = Math.floor(tr.t[a]/secs*n), i1 = Math.ceil(tr.t[b]/secs*n);
      const w = act.pwSample.slice(Math.max(0, i0), Math.min(n, i1)); if (w.length > 3) { P = w.reduce((x, y) => x+y, 0)/w.length; measured = true; }
    }
    const step = L <= 6 ? 0.5 : 1, prof = [];
    const altAt = x => { let lo = a, hi = b; while (lo < hi) { const k = (lo+hi) >> 1; if (d[k] < x) lo = k+1; else hi = k; } const i = Math.max(a+1, lo), f = d[i] > d[i-1] ? (x - d[i-1])/(d[i] - d[i-1]) : 0; return alt[i-1] + (alt[i] - alt[i-1])*clamp(f, 0, 1); };
    for (let x = 0; x < L - 1e-6; x += step) { const x1 = Math.min(L, x + step); prof.push([+x1.toFixed(2), Math.round(altAt(d[a] + x1))]); }
    let gmax = 0; for (let x = 0; x + 0.5 <= L; x += 0.25) gmax = Math.max(gmax, (altAt(d[a]+x+0.5) - altAt(d[a]+x))/5);
    return { act: act.id, date: act.date, L: +L.toFixed(2), H: Math.round(H), up: Math.round(up), a0: Math.round(alt[a]), a1: Math.round(alt[b]),
      grad: +(H/(L*10)).toFixed(1), gmax: +gmax.toFixed(1), T: T || null, vam: T ? Math.round(H/(T/3600)) : null,
      P: P ? Math.round(P) : null, wkg: P ? +(P/kg).toFixed(2) : null, measured, prof,
      s: [tr.lat[a], tr.lon[a]], e: [tr.lat[b], tr.lon[b]],
      path: Array.from({ length: 9 }, (_, k) => { const i = Math.round(a + (b - a)*k/8); return [+tr.lat[i].toFixed(5), +tr.lon[i].toFixed(5)]; }) };
  }
  // lecture des tracés par paquets, résultat gardé dans l'activité (a.climbs) : l'analyse ne tourne qu'une fois
  async function scan(){
    if (scanning || !S.profile) return; scanning = true;
    try {
      const todo = S.activities.filter(a => !isIndoor(a) && a.startTs && a.climbsV !== CV && !tried.has(a.id));
      if (!todo.length) return;
      const sb = Cloud.sb, u = Cloud.user, remote = {};
      const miss = todo.filter(a => !Tracks.local(a.startTs));
      if (sb && u) for (let i = 0; i < miss.length; i += 15) {
        const part = miss.slice(i, i+15).map(a => a.startTs);
        const { data } = await sb.from('activity_tracks').select('start_ts, track').in('start_ts', part);
        for (const r of data || []) remote[r.start_ts] = r.track;
      }
      let changed = 0;
      for (const a of todo) {
        tried.add(a.id);
        const tr = Tracks.local(a.startTs) || remote[a.startTs]; if (!tr) continue;
        a.climbs = detect(tr).map(c => applyFix(a, tr, measure(a, tr, c))); a.climbsV = CV; changed++;
      }
      if (changed) { save(); if (TAB === 'prog') render(); }
    } catch (e) { console.warn('ascensions', e); }
    finally { scanning = false; }
  }
  // mêmes départ et sommet (à 400 m près) = même ascension
  function groups(){
    const G = [];
    for (const a of S.activities) for (const c of a.climbs || []) {
      let g = G.find(g => km(...g.e, ...c.e) < 0.4 && km(...g.s, ...c.s) < 0.4);
      if (!g) { g = { key: `${c.e[0].toFixed(3)},${c.e[1].toFixed(3)}`, s: c.s, e: c.e, list: [] }; G.push(g); }
      g.list.push({ ...c, name: a.name }); if (c.path && !g.path) g.path = c.path;
    }
    for (const g of G) { g.list.sort((x, y) => (x.T || 9e9) - (y.T || 9e9)); g.best = g.list[0]; g.ref = g.list.slice().sort((x, y) => y.L - x.L)[0];
      g.last = g.list.reduce((m, c) => c.date > m ? c.date : m, ''); g.osm = S.climbAuto?.[g.key] || null; g.name = S.climbNames?.[g.key] || g.osm || autoName(g); }
    return G.sort((x, y) => y.last.localeCompare(x.last));
  }
  const wait = ms => new Promise(r => setTimeout(r, ms));
  let naming = false;
  // noms : la fonction serveur climb-names les calcule en tâche de fond (Photon / OpenStreetMap) et les range dans la table climb_names ;
  // l'app lit la table, demande les montées manquantes (au plus une fois toutes les 10 min) et relit quelques fois ensuite
  let polls = 0; const asked = {}; // demandes envoyées pendant cette session (pas dans S : une synchro cloud peut remplacer S)
  async function autoNames(G){
    if (S.climbAutoV !== 4) { S.climbAuto = {}; S.climbAutoV = 4; }
    const sb = Cloud.sb, u = Cloud.user;
    const todo = G.filter(g => !S.climbNames?.[g.key] && !S.climbAuto?.[g.key]);
    if (naming || !todo.length || !navigator.onLine || !sb || !u) return;
    naming = true; let changed = 0, again = false;
    try {
      const { data: rows, error } = await sb.from('climb_names').select('key, name, error').in('key', todo.map(g => g.key));
      if (error) throw error;
      const got = new Map((rows || []).map(r => [r.key, r]));
      for (const g of todo) { const r = got.get(g.key); if (r?.name) { (S.climbAuto ||= {})[g.key] = r.name; changed++; } }
      const errs = (rows || []).filter(r => r.error && r.error !== 'en cours').map(r => r.error);
      S.climbNameErr = errs.length ? errs[0] : null;
      const now = Date.now(), ask = todo.filter(g => !got.get(g.key)?.name && now - (asked[g.key] || 0) > 10*60000);
      if (ask.length) {
        for (const g of ask) asked[g.key] = now;
        await sb.functions.invoke('climb-names', { body: { climbs: ask.map(g => ({ key: g.key, s: g.s, e: g.e, path: g.path || null })) } });
        polls = 0;
      }
      again = todo.length > changed && polls < 8; // la tâche de fond prend ~5-10 s par montée
    }
    catch (e) { S.climbNameErr = String(e?.message || e); console.warn('noms des cols', e); }
    finally {
      naming = false; if (changed) save();
      if (changed && TAB === 'prog') render();
      if (again) { polls++; setTimeout(() => { if (TAB === 'prog') autoNames(groups()).then(() => {}); }, 8000); }
    }
  }
  const autoName = g => { const nm = g.list.map(c => c.name).find(n => /\b(col|mont|côte|cote|alpe|pic|hautacam|ventoux|tourmalet|joux)\b/i.test(n || ''));
    return nm ? nm.replace(/^.*?\b((?:col|mont|côte|cote|alpe|pic)\b.*)$/i, '$1').slice(0, 40) : `Montée de ${f1(g.ref.L)} km à ${f1(g.ref.grad)} %`; };
  // profil façon ClimbFinder : un trapèze par tronçon, coloré selon la pente, pourcentage inscrit
  function profileSVG(c, W = 600, Hh = 150){
    const L = c.L, lo = c.a0, hi = Math.max(...c.prof.map(p => p[1]), c.a1), pad = (hi - lo)*0.08 || 10;
    const X = x => 30 + x/L*(W-40), Y = v => Hh-18 - (v - (lo - pad))/(hi - lo + 2*pad)*(Hh-30);
    let g = '', px = 0, pa = c.a0;
    for (const [x, al] of c.prof) { const pct = (al - pa)/((x - px)*10), col = gradCol(pct);
      g += `<path d="M${X(px)},${Hh-18}L${X(px)},${Y(pa)}L${X(x)},${Y(al)}L${X(x)},${Hh-18}Z" style="fill:${col}" stroke="var(--card)" stroke-width="1"/>`;
      if (X(x) - X(px) > 24) g += `<text x="${(X(px)+X(x))/2}" y="${Hh-24}" text-anchor="middle" style="fill:${catOf(pct) === 3 ? '#fff' : 'var(--gt)'};font-weight:600;font-size:10px">${f1(pct)}</text>`;
      px = x; pa = al; }
    const st = L > 12 ? 2 : 1; for (let x = 0; x <= L + 1e-6; x += st) g += `<text x="${X(x)}" y="${Hh-4}" text-anchor="middle">${x}</text>`;
    g += `<text x="26" y="${Y(lo)+3}" text-anchor="end">${lo}</text><text x="26" y="${Y(hi)+3}" text-anchor="end">${hi}</text>`;
    return `<svg class="chart" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Profil de l'ascension">${g}</svg>`;
  }
  // P60 « de référence » : moyenne des 3 meilleures montées ramenées à 1 h par la loi de puissance
  function p60(G){
    const pts = G.flatMap(g => g.list).filter(c => c.P && c.T >= 600).map(c => c.P*Math.pow(c.T/3600, K)).sort((x, y) => y - x).slice(0, 3);
    return pts.length ? pts.reduce((x, y) => x+y, 0)/pts.length : null;
  }
  // temps pour une montée (L km, H m) avec P(t) = P60·(t/1 h)^−K : on cherche t où la puissance demandée égale la puissance tenable
  function predict(L, H, P60){
    const m = S.profile.weightKg + PHY.bike, Lm = L*1000, r = 1.1;
    const need = t => (m*PHY.g*H + PHY.crr*m*PHY.g*Lm + 0.5*r*PHY.cda*Math.pow(Lm/t, 2)*Lm)/t/PHY.eta;
    let lo = 120, hi = 6*3600; for (let i = 0; i < 60; i++) { const t = (lo+hi)/2; if (need(t) > P60*Math.pow(t/3600, -K)) lo = t; else hi = t; }
    const t = (lo+hi)/2, P = need(t); return { t, P, wkg: P/S.profile.weightKg };
  }
  function predictorHTML(G, P60){
    const own = G.map(g => `<option value="g:${g.key}">${esc(g.name)} · ${f1(g.ref.L)} km · ${g.ref.H} m</option>`).join('');
    return `<div class="climbpred"><label class="f" for="cpSel">Choisis une montée</label>
      <select id="cpSel">${own ? `<optgroup label="Mes ascensions">${own}</optgroup>` : ''}<optgroup label="Cols célèbres (valeurs approx.)">${PRESETS.map(p => `<option value="p:${p.id}">${esc(p.name)} · ${f1(p.L)} km · ${p.H} m</option>`).join('')}</optgroup><option value="custom">Personnalisée…</option></select>
      <div class="grid2 hidden" id="cpCustom"><div><label class="f" for="cpL">Longueur (km)</label><input type="number" id="cpL" step="0.1" value="10"></div><div><label class="f" for="cpH">D+ (m)</label><input type="number" id="cpH" step="10" value="800"></div></div>
      <div id="cpOut"></div><p class="tiny muted" style="margin:4px 0 0">Temps estimé · W/kg à tenir.</p>
      <p class="tiny muted" style="margin:6px 0 0">Loi de Riegel version vélo : la puissance tenable baisse avec la durée, P(t) = P<sub>1 h</sub> × (t / 1 h)<sup>−0,07</sup> (l'équivalent d'un exposant b ≈ 1,07 sur les temps). Le temps est calculé par la physique : poids ${S.profile.weightKg} kg + vélo ${PHY.bike} kg, sans vent. ${P60 ? `Ta référence tirée de tes 3 meilleures montées : ${Math.round(P60)} W sur 1 h.` : ''}</p></div>`;
  }
  function wirePredictor(G, P60){
    const sel = $('#cpSel'); if (!sel) return;
    const run = () => {
      const v = sel.value; $('#cpCustom').classList.toggle('hidden', v !== 'custom');
      let L, H, actual = null;
      if (v.startsWith('g:')) { const g = G.find(x => x.key === v.slice(2)); L = g.ref.L; H = g.ref.H; actual = g.best; }
      else if (v.startsWith('p:')) { const p = PRESETS.find(x => x.id === v.slice(2)); L = p.L; H = p.H; }
      else { L = +$('#cpL').value || 0; H = +$('#cpH').value || 0; }
      if (!(L > 0 && H > 0)) { $('#cpOut').innerHTML = ''; return; }
      const rows = [];
      if (P60) rows.push(['Selon tes ascensions', predict(L, H, P60)]);
      rows.push([`Selon ta FTP (${ftp()} W)`, predict(L, H, ftp())]);
      if (S.profile.goalFtp) rows.push([`À ton objectif (${S.profile.goalFtp} W)`, predict(L, H, S.profile.goalFtp)]);
      $('#cpOut').innerHTML = `<div class="grid${rows.length > 2 ? 3 : 2}" style="margin-top:10px">${rows.map(([l, r]) => `<div class="kpi"><div class="v num" style="font-size:22px">${fmtT(r.t)}<small> · ${f2(r.wkg)}</small></div><div class="l">${esc(l)}</div></div>`).join('')}</div>
        ${actual?.T ? `<p class="small muted" style="margin:8px 0 0">Ton record ici : <b class="num" style="color:var(--text)">${fmtT(actual.T)}</b> le ${fmtShort(actual.date)} (${f2(actual.wkg)} W/kg${actual.measured ? ' mesurés' : ' estimés'}).</p>` : ''}`;
    };
    sel.onchange = run; $('#cpL').oninput = run; $('#cpH').oninput = run; run();
  }
  function cardHTML(g){
    const c = g.ref, b = g.best;
    return `<div class="climb" data-climb="${g.key}" role="button" tabindex="0" style="--tint:${gradCol(c.grad)}">
      <div class="row between" style="gap:8px"><b style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(g.name)}</b><span class="tiny muted">${g.list.length} ascension${g.list.length > 1 ? 's' : ''}</span></div>
      <div class="tiny muted cstat">${f1(c.L)} km · ${c.H} m D+ · ${f1(c.grad)} % moy. · ${f1(c.gmax)} % max · ${c.a0} → ${c.a1} m</div>
      ${profileSVG(c)}
      ${b.T ? `<div class="row" style="gap:6px;flex-wrap:wrap"><span class="chip num" style="color:var(--text)">⏱ ${fmtT(b.T)}</span><span class="chip num">VAM ${b.vam} m/h</span>${b.wkg ? `<span class="chip num">${f2(b.wkg)} W/kg ${b.measured ? 'mesurés' : 'estimés'}</span>` : ''}<span class="chip">${fmtShort(b.date)}</span></div>` : ''}
    </div>`;
  }
  function html(){
    if (!S.profile) return '';
    scan();
    const G = groups(), P60 = p60(G);
    autoNames(G);
    const pending = S.activities.some(a => !isIndoor(a) && a.startTs && a.climbsV !== CV && !tried.has(a.id));
    let h = `<div class="card" id="climbsCard"><h2>Ascensions</h2>`;
    if (!G.length) return h + `<p class="muted small" style="margin:0">${pending ? 'Analyse de tes tracés en cours…' : "Aucune montée de plus de 400 m de D+ dans tes sorties pour l'instant. Elles apparaîtront ici automatiquement (tracés Intervals.icu, .fit ou Strava)."}</p>${predictorHTML(G, P60)}</div>`;
    const all = G.flatMap(g => g.list), totH = all.reduce((s, c) => s + c.H, 0), bestVam = Math.max(...all.map(c => c.vam || 0));
    h += `<div class="grid4"><div class="kpi"><div class="v num">${all.length}</div><div class="l">Ascensions</div></div><div class="kpi"><div class="v num">${totH.toLocaleString('fr-FR')}<small> m</small></div><div class="l">D+ en montées</div></div>
      <div class="kpi"><div class="v num">${bestVam || '—'}<small> m/h</small></div><div class="l">Meilleure VAM</div></div><div class="kpi"><div class="v num">${P60 ? Math.round(P60) : '—'}<small>${P60 ? ' W' : ''}</small></div><div class="l">Puissance 1 h estimée</div></div></div>
      ${pending ? '<p class="tiny muted">Analyse des autres tracés en cours…</p>' : ''}${G.some(g => !S.climbNames?.[g.key] && !S.climbAuto?.[g.key]) && Cloud.user ? `<p class="tiny muted">${S.climbNameErr ? `Noms des cols : service de cartes indisponible (${esc(S.climbNameErr).slice(0, 50)}), nouvel essai dans quelques minutes.` : 'Recherche des noms des cols…'}</p>` : ''}
      <div class="climbs ${open ? '' : 'stack'}">${(open ? G : G.slice(0, 4).reverse()).map(cardHTML).join('')}</div>
      ${G.length > 1 ? `<button class="btn ghost more" data-climbmore>${open ? '− Réduire' : `+ Découvrir${G.length > 4 ? ` les ${G.length} ascensions` : ''}`}</button>` : ''}
      <details class="climbpredwrap"${predOpen ? ' open' : ''}><summary>Prédire une ascension</summary>${predictorHTML(G, P60)}</details>
      <p class="tiny muted" style="margin:8px 0 0">Pentes : <span class="gdot" style="background:var(--g1)"></span> &lt; 4 % <span class="gdot" style="background:var(--g2)"></span> 4-7 <span class="gdot" style="background:var(--g3)"></span> 7-10 <span class="gdot" style="background:var(--g4)"></span> ≥ 10 %. W/kg estimés par la physique sans capteur (±10 %, faussés par le vent ou l'aspiration). Noms © contributeurs OpenStreetMap.</p></div>`;
    setTimeout(() => wirePredictor(G, P60), 0);
    return h;
  }
  function detailDlg(key){
    const g = groups().find(x => x.key === key); if (!g) return;
    openDlg(`<span class="muted small">${g.list.length} ascension${g.list.length > 1 ? 's' : ''} · ${f1(g.ref.L)} km · ${g.ref.H} m D+${!S.climbNames?.[g.key] && g.osm ? ' · nom trouvé sur OpenStreetMap' : ''}</span>
      <div class="row" style="gap:8px;margin:6px 0"><input id="clName" value="${esc(g.name)}" style="flex:1" aria-label="Nom de l'ascension"><button class="btn sm" id="clRename">Renommer</button></div>
      <div class="grid4" style="margin:6px 0">${[['Longueur', `${f1(g.ref.L)}<small> km</small>`], ['Pente moy.', `${f1(g.ref.grad)}<small> %</small>`], ['Pente max', `${f1(g.ref.gmax)}<small> %</small>`], ['Sommet', `${g.ref.a1}<small> m</small>`]].map(([l, v]) => `<div class="kpi"><div class="v num" style="font-size:22px">${v}</div><div class="l">${l}</div></div>`).join('')}</div>
      ${profileSVG(g.ref, 640, 190)}
      <div class="row" style="gap:8px;margin-top:8px"><button class="btn sm" id="clEdit">✎ Corriger départ / arrivée</button>${(S.climbFix || []).some(f => km(...f.to.e, ...g.e) < 0.5) ? '<button class="btn sm ghost" id="clReset">Revenir à la détection auto</button>' : ''}</div>
      <div id="clEditor"></div>
      <h3 style="margin-top:14px">Tes passages</h3>
      ${g.list.map((c, i) => `<div class="hist"><div style="flex:1;min-width:0"><b>${i === 0 && c.T ? '🏆 ' : ''}${c.T ? fmtT(c.T) : '—'}</b> <span class="tiny muted">${fmtDate(c.date)}</span>
        <div class="tiny muted">VAM ${c.vam ?? '—'} m/h · ${c.P ? `${c.P} W · ${f2(c.wkg)} W/kg ${c.measured ? 'mesurés' : 'estimés'}` : 'puissance inconnue'}</div></div>
        <button class="btn sm" data-track3d="${c.act}">3D ▶</button></div>`).join('')}`);
    $('#clEdit').onclick = () => editor(g);
    $('#clReset') && ($('#clReset').onclick = () => { S.climbFix = (S.climbFix || []).filter(f => km(...f.to.e, ...g.e) >= 0.5); for (const c of g.list) { const a = S.activities.find(x => x.id === c.act); if (a) a.climbsV = 0; } tried.clear(); save(); closeDlg(); render(); toast('Détection automatique rétablie'); });
    $('#clRename').onclick = () => { const v = $('#clName').value.trim(); S.climbNames ||= {}; if (v) S.climbNames[g.key] = v; else delete S.climbNames[g.key]; save(); closeDlg(); render(); toast(v ? 'Ascension renommée' : 'Nom automatique rétabli'); };
  }
  // éditeur : profil de la sortie autour de la montée, deux curseurs (départ, arrivée), stats en direct
  async function editor(g){
    const box = $('#clEditor'); box.innerHTML = '<p class="small muted">Chargement du tracé…</p>';
    const c = g.ref, act = S.activities.find(a => a.id === c.act), tr = act && await Tracks.get(act);
    if (!tr?.alt) { box.innerHTML = '<p class="small muted">Tracé indisponible pour cette sortie.</p>'; return; }
    const P = prep(tr), a0 = nearestIdx(tr, c.s).i, b0 = nearestIdx(tr, c.e, a0 + 1).i;
    let w0 = a0; while (w0 > 0 && P.d[a0] - P.d[w0] < 4) w0--; let w1 = b0; while (w1 < P.n - 1 && P.d[w1] - P.d[b0] < 4) w1++;
    let A = a0, B = b0;
    box.innerHTML = `<div class="climbpred" style="margin-top:10px"><svg class="chart" id="clEdSvg" viewBox="0 0 640 150"></svg>
      <label class="f" for="clA">Départ</label><div class="row" style="gap:6px"><button class="btn sm" data-ced="A-">−</button><input type="range" id="clA" min="${w0}" max="${w1}" value="${A}" style="flex:1"><button class="btn sm" data-ced="A+">+</button></div>
      <label class="f" for="clB">Arrivée</label><div class="row" style="gap:6px"><button class="btn sm" data-ced="B-">−</button><input type="range" id="clB" min="${w0}" max="${w1}" value="${B}" style="flex:1"><button class="btn sm" data-ced="B+">+</button></div>
      <p class="small" id="clEdStats" style="margin:8px 0"></p><p class="tiny muted" style="margin:0 0 8px">La correction s'applique à tous tes passages sur cette montée, et aux prochains.</p>
      <div class="row"><button class="btn primary" id="clEdSave">Enregistrer les bornes</button></div></div>`;
    const lo = Math.min(...P.alt.slice(w0, w1+1)), hi = Math.max(...P.alt.slice(w0, w1+1)), X = i => 10 + (P.d[i] - P.d[w0])/(P.d[w1] - P.d[w0] || 1)*620, Y = v => 135 - (v - lo)/(hi - lo || 1)*120;
    const area = (i0, i1, fill, op) => { let d = `M${X(i0)},135`; for (let i = i0; i <= i1; i++) d += `L${X(i).toFixed(1)},${Y(P.alt[i]).toFixed(1)}`; return `<path d="${d}L${X(i1)},135Z" fill="${fill}" opacity="${op}"/>`; };
    const draw = () => {
      if (B <= A) B = Math.min(w1, A + 1);
      $('#clEdSvg').innerHTML = area(w0, w1, 'var(--muted)', .25) + area(A, B, 'var(--accent)', .85) +
        `<line x1="${X(A)}" x2="${X(A)}" y1="10" y2="135" stroke="#3ecf8e" stroke-width="2"/><line x1="${X(B)}" x2="${X(B)}" y1="10" y2="135" stroke="#ff4d5e" stroke-width="2"/>` +
        `<text x="${X(A)+4}" y="20" style="fill:#3ecf8e">${Math.round(P.alt[A])} m</text><text x="${X(B)-4}" y="20" text-anchor="end" style="fill:#ff4d5e">${Math.round(P.alt[B])} m</text>`;
      const L = P.d[B] - P.d[A], H = P.alt[B] - P.alt[A];
      $('#clEdStats').innerHTML = `<b class="num">${f1(L)} km</b> · <b class="num">${Math.round(H)} m</b> D+ · <b class="num">${f1(H/(L*10 || 1))} %</b> moy.${H < MIN_GAIN ? ' <span style="color:var(--warn)">· moins de 400 m : elle ne sera plus listée</span>' : ''}`;
      $('#clA').value = A; $('#clB').value = B;
    };
    $('#clA').oninput = e => { A = +e.target.value; draw(); }; $('#clB').oninput = e => { B = +e.target.value; draw(); };
    box.querySelectorAll('[data-ced]').forEach(b => b.onclick = () => { const k = b.dataset.ced; if (k[0] === 'A') A = clamp(A + (k[1] === '+' ? 1 : -1), w0, w1); else B = clamp(B + (k[1] === '+' ? 1 : -1), w0, w1); draw(); });
    draw();
    $('#clEdSave').onclick = async () => {
      const to = { s: [tr.lat[A], tr.lon[A]], e: [tr.lat[B], tr.lon[B]] };
      const oldKey = g.key, newKey = `${to.e[0].toFixed(3)},${to.e[1].toFixed(3)}`;
      S.climbFix = (S.climbFix || []).filter(f => km(...f.to.e, ...g.e) >= 0.5 || km(...f.to.s, ...g.s) >= 0.5);
      for (const p of g.list) S.climbFix.push({ from: { s: p.s, e: p.e }, to }); // chaque passage reconnu à sa détection d'origine
      for (const p of g.list) { // recalcul immédiat de chaque passage
        const ac = S.activities.find(x => x.id === p.act), t2 = ac && (Tracks.local(ac.startTs) || await Tracks.get(ac)); if (!t2?.alt) continue;
        const P2 = prep(t2), ia = nearestIdx(t2, to.s), ib = nearestIdx(t2, to.e, ia.i + 1);
        const idx = (ac.climbs || []).findIndex(x => km(...x.s, ...p.s) < 0.05 && km(...x.e, ...p.e) < 0.05); if (idx < 0) continue;
        if (ia.dist > 0.3 || ib.dist > 0.3) continue;
        const m = { ...measure(ac, t2, { a: ia.i, b: ib.i, ...P2 }), fixed: true };
        if (m.H >= MIN_GAIN) ac.climbs[idx] = m; else ac.climbs.splice(idx, 1);
      }
      for (const k of ['climbNames', 'climbAuto']) if (S[k]?.[oldKey] != null && newKey !== oldKey) { S[k][newKey] = S[k][oldKey]; delete S[k][oldKey]; }
      save(); render(); toast('Départ et arrivée corrigés'); detailDlg(newKey);
    };
  }
  document.addEventListener('click', e => { const c = e.target.closest('[data-climb]'); if (c) detailDlg(c.dataset.climb);
    if (e.target.closest('[data-climbmore]')) { open = !open; render(); } });
  document.addEventListener('toggle', e => { if (e.target.classList?.contains('climbpredwrap')) predOpen = e.target.open; }, true);
  return { html, scan, detect, measure, predict, groups };
})();
