"use strict";
// FTP Builder · graphiques SVG
/* ============ graphiques SVG ============ */
// hypnogramme de la nuit (phases minute par minute, comme l'app Santé) à partir des segments envoyés par le raccourci
function hypnogram(night){
  const segs = (Health.H.segs || []); if (!night || !segs.length) return '';
  const from = Date.parse(addDays(night, -1) + 'T18:00:00'), to = Date.parse(night + 'T14:00:00');
  let list = segs.filter(x => Date.parse(x.end_at) > from && Date.parse(x.start_at) < to && x.stage !== 'inbed');
  if (!list.length) return '';
  const bySrc = {}; for (const x of list) bySrc[x.source] = (bySrc[x.source] || 0) + 1; // une seule source : la plus détaillée (la montre)
  const src = Object.keys(bySrc).sort((a, b) => (/watch/i.test(b) - /watch/i.test(a)) || bySrc[b] - bySrc[a])[0]; list = list.filter(x => x.source === src);
  const ROW = { awake: 0, rem: 1, core: 2, asleep: 2, deep: 3 }, COL = ['var(--hy-awake)', 'var(--hy-rem)', 'var(--hy-core)', 'var(--hy-deep)'], LAB = ['Éveil', 'Paradoxal', 'Léger', 'Profond'];
  const t0 = Math.min(...list.map(x => Date.parse(x.start_at))), t1 = Math.max(...list.map(x => Date.parse(x.end_at)));
  const W = 330, L = 56, R = 6, T = 8, rowH = 30, Hh = T + rowH*4 + 22, X = ms => L + (ms - t0)/(t1 - t0 || 1)*(W - L - R), Yc = r => T + rowH*r + rowH/2;
  let g = ''; for (let r = 0; r < 4; r++) g += `<line x1="${L}" x2="${W-R}" y1="${T + rowH*(r+1)}" y2="${T + rowH*(r+1)}" stroke="var(--line)"/><circle cx="5" cy="${Yc(r)}" r="3.5" style="fill:${COL[r]}"/><text x="12" y="${Yc(r) + 3}" style="font-size:9.5px">${LAB[r]}</text>`;
  for (let h = Math.ceil(t0/3600000)*3600000; h <= t1; h += 3600000) { const d = new Date(h); if (d.getHours() % 2) continue;
    g += `<line x1="${X(h)}" x2="${X(h)}" y1="${T}" y2="${T + rowH*4}" stroke="var(--line)" stroke-dasharray="2 3"/><text x="${X(h)}" y="${Hh - 6}" text-anchor="middle" style="font-size:9px">${pad(d.getHours())}:00</text>`; }
  list.sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));
  let prev = null;
  for (const x of list) { const r = ROW[x.stage] ?? 2, x0 = X(Date.parse(x.start_at)), x1 = Math.max(x0 + 1.5, X(Date.parse(x.end_at)));
    if (prev) g += `<line x1="${x0}" x2="${x0}" y1="${Yc(prev)}" y2="${Yc(r)}" stroke="var(--muted)" stroke-width=".8" opacity=".5"/>`;
    g += `<rect x="${x0}" y="${Yc(r) - 9}" width="${x1 - x0}" height="18" rx="4" style="fill:${COL[r]}"/>`; prev = r; }
  const span = Math.round((t1 - t0)/60000);
  return `<h3 style="margin:2px 0 4px;font-size:15px">Ta nuit · phases</h3><svg class="chart" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Phases de sommeil de la nuit">${g}</svg>
    <p class="tiny muted" style="margin:0 0 12px">${new Date(t0).toTimeString().slice(0, 5)} → ${new Date(t1).toTimeString().slice(0, 5)} (${Math.floor(span/60)}h${pad(span%60)}) · ${esc(src || '')}</p>`;
}
/* ----- Analyse d'une nuit : phases, cycles, FC et respiration (échantillons du Raccourci) ----- */
const ST_L = { awake:'Éveil', rem:'Paradoxal', core:'Léger', deep:'Profond' }, ST_C = { awake:'var(--hy-awake)', rem:'var(--hy-rem)', core:'var(--hy-core)', deep:'var(--hy-deep)' };
function nightSegs(night){
  const segs = (Health.H.segs || []); if (!night || !segs.length) return null;
  const from = Date.parse(addDays(night, -1) + 'T18:00:00'), to = Date.parse(night + 'T14:00:00');
  const all = segs.filter(x => Date.parse(x.end_at) > from && Date.parse(x.start_at) < to);
  let list = all.filter(x => x.stage !== 'inbed'); if (!list.length) return null;
  const bySrc = {}; for (const x of list) bySrc[x.source] = (bySrc[x.source] || 0) + 1;
  const src = Object.keys(bySrc).sort((a, b) => (/watch/i.test(b) - /watch/i.test(a)) || bySrc[b] - bySrc[a])[0];
  list = list.filter(x => x.source === src).map(x => ({ a: Date.parse(x.start_at), b: Date.parse(x.end_at), st: x.stage === 'asleep' ? 'core' : x.stage })).sort((x, y) => x.a - y.a);
  const bed = all.filter(x => x.stage === 'inbed').map(x => [Date.parse(x.start_at), Date.parse(x.end_at)]);
  return { list, src, bed };
}
function nightAnalysis(night){
  const N = nightSegs(night); if (!N) return null;
  const { list } = N, t0 = list[0].a, t1 = list[list.length - 1].b;
  const stageAt = t => { for (const x of list) if (t >= x.a && t < x.b) return x.st; return null; };
  const smp = (Health.H.samples || []).filter(x => { const t = Date.parse(x.at); return t >= t0 && t <= t1; }).map(x => ({ m: x.metric, t: Date.parse(x.at), v: +x.value, st: stageAt(Date.parse(x.at)) }));
  const hr = smp.filter(x => x.m === 'hr'), rr = smp.filter(x => x.m === 'resp');
  const avg = a => a.length ? a.reduce((s, x) => s + x.v, 0)/a.length : null;
  const mins = st => list.filter(x => x.st === st).reduce((s, x) => s + (x.b - x.a), 0)/60000;
  const stages = ['awake', 'rem', 'core', 'deep'].map(st => ({ st, min: mins(st), hr: avg(hr.filter(x => x.st === st)), rr: avg(rr.filter(x => x.st === st)), nHr: hr.filter(x => x.st === st).length }));
  const asleepMin = stages.filter(x => x.st !== 'awake').reduce((s, x) => s + x.min, 0);
  // FC la plus basse : moyenne glissante sur 3 mesures pour ignorer un point isolé
  let low = null; for (let i = 0; i < hr.length; i++) { const w = hr.slice(Math.max(0, i - 1), i + 2), v = avg(w); if (!low || v < low.v) low = { v, t: hr[i].t }; }
  // cycles : chaque épisode de paradoxal (épisodes séparés de < 15 min fusionnés) ferme un cycle
  const remEp = []; for (const x of list.filter(x => x.st === 'rem')) { const l = remEp[remEp.length - 1]; if (l && x.a - l.b < 15*60000) l.b = Math.max(l.b, x.b); else remEp.push({ a: x.a, b: x.b }); }
  const firstSleep = (list.find(x => x.st !== 'awake') || list[0]).a;
  const bounds = []; let c0 = firstSleep;
  for (const e of remEp) { if (e.b - c0 >= 40*60000) { bounds.push([c0, e.b, true]); c0 = e.b; } }
  const lastSleep = [...list].reverse().find(x => x.st !== 'awake')?.b ?? t1;
  if (lastSleep - c0 >= 30*60000) bounds.push([c0, lastSleep, false]);
  const cyc = bounds.map(([a, b, full]) => { const part = list.map(x => ({ ...x, a: Math.max(x.a, a), b: Math.min(x.b, b) })).filter(x => x.b > x.a);
    const m = st => part.filter(x => x.st === st).reduce((s, x) => s + (x.b - x.a), 0)/60000;
    return { a, b, full, min: (b - a)/60000, deep: m('deep'), rem: m('rem'), core: m('core'), awake: m('awake'), hr: avg(hr.filter(x => x.t >= a && x.t < b)), rr: avg(rr.filter(x => x.t >= a && x.t < b)) }; });
  const wakes = list.filter((x, i) => x.st === 'awake' && i > 0 && i < list.length - 1 && x.b - x.a >= 60000).length;
  const bedStart = N.bed.length ? Math.min(...N.bed.map(x => x[0])) : null;
  return { night, src: N.src, t0, t1, list, hr, rr, stages, asleepMin, span: (t1 - t0)/60000, eff: asleepMin/((t1 - t0)/60000), wakes, latency: bedStart && firstSleep > bedStart ? (firstSleep - bedStart)/60000 : null,
    hrAvg: avg(hr), hrLow: low, rrAvg: avg(rr), rrMin: rr.length ? Math.min(...rr.map(x => x.v)) : null, rrMax: rr.length ? Math.max(...rr.map(x => x.v)) : null, cycles: cyc };
}
// courbe FC (ligne) + respiration (points), même axe des temps que l'hypnogramme
function nightCurves(A){
  if (A.hr.length < 3 && A.rr.length < 3) return '';
  const W = 330, L = 56, R = 6, T = 10, Hh = 120, B = 18, X = ms => L + (ms - A.t0)/(A.t1 - A.t0 || 1)*(W - L - R);
  const sc = (arr, pad) => { if (!arr.length) return null; const lo = Math.min(...arr.map(x => x.v)) - pad, hi = Math.max(...arr.map(x => x.v)) + pad; return { lo, hi, Y: v => T + (Hh - T - B)*(1 - (v - lo)/((hi - lo) || 1)) }; };
  const sh = sc(A.hr, 2), sr = sc(A.rr, 1);
  let g = '';
  // fond : bandes des phases profondes / paradoxales pour lire FC par phase
  for (const x of A.list) if (x.st === 'deep' || x.st === 'rem') g += `<rect x="${X(x.a)}" y="${T}" width="${Math.max(1, X(x.b) - X(x.a))}" height="${Hh - T - B}" style="fill:${ST_C[x.st]}" opacity=".16"/>`;
  if (sh) { g += `<text x="${L - 6}" y="${sh.Y(sh.hi - 2) + 3}" text-anchor="end" style="font-size:9px;fill:var(--bad)">${Math.round(sh.hi - 2)}</text><text x="${L - 6}" y="${sh.Y(sh.lo + 2) + 3}" text-anchor="end" style="font-size:9px;fill:var(--bad)">${Math.round(sh.lo + 2)}</text><text x="4" y="${(T + Hh - B)/2 - 4}" style="font-size:9px;fill:var(--bad)">FC</text><text x="4" y="${(T + Hh - B)/2 + 7}" style="font-size:9px;fill:var(--bad)">bpm</text>`;
    g += `<polyline points="${A.hr.map(x => `${X(x.t)},${sh.Y(x.v)}`).join(' ')}" fill="none" stroke="var(--bad)" stroke-width="1.8" stroke-linejoin="round"/>`;
    if (A.hrLow) g += `<circle cx="${X(A.hrLow.t)}" cy="${sh.Y(A.hrLow.v)}" r="4" style="fill:var(--bad)" stroke="var(--card)" stroke-width="1.5"/>`; }
  if (sr) { g += `<text x="4" y="${T + 8}" style="font-size:9px;fill:var(--z3)">resp/min</text>` + A.rr.map(x => `<circle cx="${X(x.t)}" cy="${sr.Y(x.v)}" r="2.4" style="fill:var(--z3)"/>`).join(''); }
  for (let h = Math.ceil(A.t0/3600000)*3600000; h <= A.t1; h += 3600000) { const d = new Date(h); if (d.getHours() % 2) continue; g += `<text x="${X(h)}" y="${Hh - 4}" text-anchor="middle" style="font-size:9px">${pad(d.getHours())}:00</text>`; }
  return `<svg class="chart" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Fréquence cardiaque et respiratoire pendant la nuit">${g}</svg>
    <div class="legend" style="margin:0 0 10px"><span><i style="background:var(--bad)"></i>FC</span>${sr ? '<span><i style="background:var(--z3)"></i>Respiration</span>' : ''}<span><i style="background:var(--hy-deep);opacity:.4"></i>Profond</span><span><i style="background:var(--hy-rem);opacity:.4"></i>Paradoxal</span></div>`;
}
function nightHTML(night){
  const A = nightAnalysis(night); if (!A) return '';
  const hm = m => `${Math.floor(m/60)}h${pad(Math.round(m % 60))}`, mm = m => m >= 60 ? hm(m) : `${Math.round(m)}'`, hh = t => new Date(t).toTimeString().slice(0, 5);
  const f1 = v => v == null ? '—' : v.toFixed(1).replace('.', ','), f0 = v => v == null ? '—' : Math.round(v);
  // référence : moyenne des nuits précédentes (jusqu'à 14)
  const prev = []; for (let i = 1; i <= 14; i++) { const B = nightAnalysis(addDays(night, -i)); if (B) prev.push(B); }
  const mean = k => { const v = prev.map(x => x[k]).filter(x => x != null); return v.length >= 3 ? v.reduce((a, b) => a + b, 0)/v.length : null; };
  const hrB = mean('hrAvg'), rrB = mean('rrAvg');
  const hasHr = A.hr.length >= 3, hasRr = A.rr.length >= 3;
  const chip = (t, c) => `<span class="chip num" style="color:${c || 'var(--text)'}">${t}</span>`;
  const chips = [
    chip(`Efficacité ${Math.round(A.eff*100)} %`, A.eff >= 0.9 ? 'var(--ok)' : A.eff >= 0.85 ? 'var(--warn)' : 'var(--bad)'),
    chip(`${A.wakes} réveil${A.wakes > 1 ? 's' : ''}`),
    A.latency != null ? chip(`Endormi en ${mm(A.latency)}`, A.latency <= 20 ? 'var(--ok)' : 'var(--warn)') : '',
    chip(`${A.cycles.filter(c => c.full).length} cycles complets`),
    hasHr ? chip(`FC moy. ${f0(A.hrAvg)} bpm${hrB ? ` · ${A.hrAvg - hrB >= 0 ? '+' : '−'}${Math.abs(Math.round(A.hrAvg - hrB))}` : ''}`, hrB ? (A.hrAvg <= hrB + 1 ? 'var(--ok)' : A.hrAvg <= hrB + 3 ? 'var(--warn)' : 'var(--bad)') : null) : '',
    hasHr && A.hrLow ? chip(`FC min ${f0(A.hrLow.v)} à ${hh(A.hrLow.t)}`) : '',
    hasRr ? chip(`Resp. ${f1(A.rrAvg)} /min${rrB ? ` · ${A.rrAvg - rrB >= 0 ? '+' : '−'}${f1(Math.abs(A.rrAvg - rrB))}` : ''}`, rrB ? (A.rrAvg - rrB < 0.7 ? 'var(--ok)' : A.rrAvg - rrB < 1.2 ? 'var(--warn)' : 'var(--bad)') : null) : '',
  ].join('');
  // lecture : ce que disent ces chiffres
  const notes = [];
  if (hasHr && A.hrLow) { const pos = (A.hrLow.t - A.t0)/(A.t1 - A.t0);
    notes.push(pos <= 0.6 ? ['ok', `FC au plus bas à ${hh(A.hrLow.t)}, dans la première partie de la nuit : ton corps a vite basculé en récupération.`]
      : ['warn', `FC au plus bas tard (${hh(A.hrLow.t)}, ${Math.round(pos*100)} % de la nuit) : souvent le signe d'une digestion, d'alcool, de chaleur ou d'une séance intense le soir qui retardent la récupération.`]); }
  if (hasRr && rrB && A.rrAvg - rrB >= 1) notes.push(['bad', `Respiration +${f1(A.rrAvg - rrB)} /min au-dessus de ta normale : à surveiller, c'est un des premiers signaux d'un début de maladie ou d'une grosse fatigue.`]);
  const deepPct = A.asleepMin ? A.stages.find(x => x.st === 'deep').min/A.asleepMin : 0, remPct = A.asleepMin ? A.stages.find(x => x.st === 'rem').min/A.asleepMin : 0;
  if (deepPct < 0.1) notes.push(['warn', `Peu de sommeil profond (${Math.round(deepPct*100)} %, repère 13–23 %) : c'est lui qui répare les muscles, il se concentre dans les 2 premiers cycles.`]);
  if (remPct < 0.15) notes.push(['warn', `Paradoxal court (${Math.round(remPct*100)} %, repère 20–25 %) : il s'allonge en fin de nuit, un réveil avancé le coupe en premier.`]);
  const dHr = A.stages.find(x => x.st === 'deep').hr, rHr = A.stages.find(x => x.st === 'rem').hr;
  if (dHr && rHr) notes.push(['', `FC ${Math.round(rHr - dHr)} bpm plus haute en paradoxal qu'en profond : normal, le paradoxal est une phase d'activité cérébrale intense.`]);
  const rows = A.stages.map(x => `<tr><td><i class="dot" style="background:${ST_C[x.st]}"></i>${ST_L[x.st]}</td><td class="num">${mm(x.min)}</td><td class="num muted">${x.st === 'awake' ? '' : Math.round(x.min/(A.asleepMin || 1)*100) + ' %'}</td>${hasHr ? `<td class="num">${f0(x.hr)}</td>` : ''}${hasRr ? `<td class="num">${f1(x.rr)}</td>` : ''}</tr>`).join('');
  const cycles = A.cycles.map((c, i) => { const tot = c.min || 1, bar = [['deep', c.deep], ['core', c.core], ['rem', c.rem], ['awake', c.awake]].filter(([, m]) => m > 0).map(([st, m]) => `<i style="width:${m/tot*100}%;background:${ST_C[st]}"></i>`).join('');
    return `<div class="hist" style="align-items:flex-start"><div style="flex:1;min-width:0"><b>Cycle ${i + 1}</b>${c.full ? '' : ' <span class="tiny muted">(fin de nuit)</span>'} <span class="tiny muted">${hh(c.a)} → ${hh(c.b)} · ${mm(c.min)}</span>
      <div class="cycbar">${bar}</div><div class="tiny muted">profond ${mm(c.deep)} · paradoxal ${mm(c.rem)}${c.awake >= 1 ? ` · éveil ${mm(c.awake)}` : ''}</div></div>
      ${hasHr || hasRr ? `<div class="tiny num" style="text-align:right;white-space:nowrap">${c.hr ? `<span style="color:var(--bad)">${f0(c.hr)} bpm</span>` : ''}${c.rr ? `<br><span style="color:var(--z3)">${f1(c.rr)} /min</span>` : ''}</div>` : ''}</div>`; }).join('');
  return `<div class="row" style="gap:6px;flex-wrap:wrap;margin:0 0 10px">${chips}</div>
    ${nightCurves(A)}
    <h3 style="margin:6px 0 4px;font-size:15px">Par phase</h3>
    <table class="ntab"><thead><tr><th></th><th>Durée</th><th></th>${hasHr ? '<th>FC</th>' : ''}${hasRr ? '<th>Resp.</th>' : ''}</tr></thead><tbody>${rows}</tbody></table>
    <h3 style="margin:12px 0 2px;font-size:15px">Par cycle</h3><p class="tiny muted" style="margin:0 0 2px">Un cycle (≈ 90 min) se termine à chaque épisode de paradoxal.</p>${cycles || '<p class="tiny muted">Pas de cycle complet détecté.</p>'}
    ${notes.length ? `<div style="margin-top:10px">${notes.map(([c, t]) => `<div class="note ${c}" style="margin:6px 0 0">${t}</div>`).join('')}</div>` : ''}
    ${!hasHr ? `<p class="tiny muted" style="margin:10px 0 0">FC et respiration de la nuit : ajoute-les au Raccourci (Profil › Réglages › Apple Santé › Guide du raccourci, partie B) pour les voir phase par phase.</p>` : ''}`;
}
// fiche Sommeil : 7 nuits par phases vs durée recommandée, puis VFC et FC de nuit
function sleepDetail(){
  const H = Health.H, t = todayISO(), n = 7, nights = Array.from({ length: n }, (_, i) => addDays(t, i - n + 1));
  const S0 = d => H.sleep.find(x => x.night === d) || null, val = (m, d) => H.daily.find(x => x.metric === m && x.day === d)?.value ?? null;
  const last = S0(t) || S0(addDays(t, -1)); if (!nights.some(S0) && !last) return '<p class="small muted">Aucune nuit reçue pour l\'instant : porte ta montre la nuit, l\'automatisation au réveil s\'occupe du reste.</p>';
  const REC = [7, 9], GOAL = 8; // adulte : 7 à 9 h ; sportif en charge : viser 8 h et plus
  const PH = [['deep_min', 'Profond', 'var(--hy-deep)'], ['core_min', 'Léger', 'var(--hy-core)'], ['rem_min', 'Paradoxal', 'var(--hy-rem)'], ['awake_min', 'Éveillé', 'var(--hy-awake)']]; // mêmes couleurs que l'hypnogramme
  const W = 330, Hh = 170, L = 26, R = 6, T = 16, B = 20, cw = (W - L - R)/n, maxH = 10, Y = h => T + (Hh - T - B)*(1 - Math.min(h, maxH)/maxH);
  const hhmm = m => `${Math.floor(m/60)}h${pad(Math.round(m%60))}`;
  let g = `<rect x="${L}" y="${Y(REC[1])}" width="${W-L-R}" height="${Y(REC[0]) - Y(REC[1])}" style="fill:var(--ok)" opacity=".10"/>
    <line x1="${L}" x2="${W-R}" y1="${Y(GOAL)}" y2="${Y(GOAL)}" stroke="var(--ok)" stroke-dasharray="4 4"/>`;
  for (const h of [0, 4, 7, 9]) g += `<text x="${L-4}" y="${Y(h)+3}" text-anchor="end" style="font-size:9px">${h} h</text>`;
  nights.forEach((d, i) => { const sl = S0(d), x = L + cw*i + cw*0.2, w = cw*0.6, cx = L + cw*i + cw/2;
    if (sl?.asleep_min) {
      const staged = (sl.deep_min || 0) + (sl.core_min || 0) + (sl.rem_min || 0);
      const parts = staged ? [[sl.deep_min || 0, PH[0][2]], [(sl.core_min || 0) + Math.max(0, sl.asleep_min - staged), PH[1][2]], [sl.rem_min || 0, PH[2][2]], [sl.awake_min || 0, PH[3][2]]].filter(([m]) => m > 0)
        : [[sl.asleep_min, 'var(--z2)']]; // durée seule (Intervals) : une barre unie
      let acc = 0; for (const [m, c] of parts) { const y0 = Y(acc/60), y1 = Y((acc + m)/60); g += `<rect x="${x}" y="${y1}" width="${w}" height="${Math.max(0, y0 - y1)}" style="fill:${c}"${acc === 0 ? ' rx="2"' : ''}/>`; acc += m; }
      g += `<text x="${cx}" y="${Y(acc/60) - 4}" text-anchor="middle" style="fill:var(--text);font-size:9.5px;font-weight:600">${hhmm(sl.asleep_min)}</text>`;
    } else g += `<text x="${cx}" y="${Y(0) - 5}" text-anchor="middle" style="font-size:10px">—</text>`;
    g += `<text x="${cx}" y="${Hh - 5}" text-anchor="middle" style="font-size:10px${d === t ? ';fill:var(--text);font-weight:600' : ''}">${d === t ? 'auj.' : +d.slice(8)}</text>`; });
  const hasPh = nights.some(d => S0(d)?.deep_min || S0(d)?.rem_min);
  const legend = `<div class="legend" style="margin:2px 0 10px">${hasPh ? PH.map(([, l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join('') : '<span><i style="background:var(--z2)"></i>Sommeil</span>'}<span><i style="background:var(--ok);opacity:.4"></i>Recommandé 7-9 h · cible 8 h</span></div>`;
  // dernière nuit
  let sum = '';
  if (last?.asleep_min) {
    const diff = last.asleep_min - GOAL*60, d0 = last.night, hrv = val('hrv', d0), rhr = val('rhr', d0), shr = val('sleep_hr', d0), hrvB = Health.trend('hrv', 1)[0]?.base;
    const ph = PH.slice(0, 3).filter(([k]) => last[k]).map(([k, l]) => `${l} ${hhmm(last[k])} (${Math.round(last[k]/last.asleep_min*100)} %)`);
    const chip = (txt, col) => `<span class="chip num" style="color:${col || 'var(--text)'}">${txt}</span>`;
    sum = `<div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:10px">
      ${chip(`${hhmm(last.asleep_min)} · ${diff >= 0 ? '+' : '−'}${hhmm(Math.abs(diff))} vs 8 h`, last.asleep_min >= REC[0]*60 ? 'var(--ok)' : last.asleep_min >= 6*60 ? 'var(--warn)' : 'var(--bad)')}
      ${hrv != null ? chip(`VFC ${Math.round(hrv)} ms${hrvB ? ` · moy. ${Math.round(hrvB)}` : ''}`, hrvB ? (hrv >= hrvB*0.95 ? 'var(--ok)' : 'var(--warn)') : null) : ''}
      ${rhr != null ? chip(`FC min ≈ ${Math.round(rhr)} bpm`) : ''}${shr != null ? chip(`FC moy. nuit ${Math.round(shr)} bpm`) : ''}
      ${last.bed_start && last.bed_end ? chip(`${new Date(last.bed_start).toTimeString().slice(0, 5)} → ${new Date(last.bed_end).toTimeString().slice(0, 5)}`) : ''}</div>
      ${ph.length ? `<p class="tiny muted" style="margin:-4px 0 10px">${ph.join(' · ')}</p>` : (hypnogram(last.night) ? '' : '<p class="tiny muted" style="margin:-4px 0 10px">Phases non reçues pour cette nuit (seule la durée est arrivée par Intervals) : elles arrivent avec le raccourci Santé au réveil.</p>')}`;
  }
  // VFC et FC de repos sur les 7 nuits
  const sv = nights.map(d => [d, val('hrv', d), val('rhr', d), val('sleep_hr', d)]);
  const spark = (idx, col, unit, label) => { const pts = sv.map((x, i) => [i, x[idx]]).filter(x => x[1] != null); if (pts.length < 2) return '';
    const lo = Math.min(...pts.map(x => x[1])), hi = Math.max(...pts.map(x => x[1])), X = i => 30 + i*(W - 46)/(n - 1), Yv = v => 26 - (v - lo)/((hi - lo) || 1)*18;
    return `<div class="row" style="gap:8px;align-items:center"><span class="tiny muted" style="width:62px">${label}</span><svg viewBox="0 0 ${W} 34" style="flex:1;height:34px" aria-label="${label}"><polyline points="${pts.map(([i, v]) => `${X(i)},${Yv(v)}`).join(' ')}" fill="none" stroke="${col}" stroke-width="2"/>${pts.map(([i, v]) => `<circle cx="${X(i)}" cy="${Yv(v)}" r="2.8" style="fill:${col}"/><text x="${X(i)}" y="${Yv(v) - 5}" text-anchor="middle" style="font-size:8.5px;fill:var(--muted)">${Math.round(v)}</text>`).join('')}</svg><span class="tiny muted" style="width:26px">${unit}</span></div>`; };
  const lines = [spark(1, 'var(--z3)', 'ms', 'VFC'), spark(2, 'var(--bad)', 'bpm', 'FC repos'), spark(3, 'var(--z5)', 'bpm', 'FC nuit')].join('');
  return `${sum}${hypnogram(last?.night)}${nightHTML(last?.night)}<h3 style="margin:14px 0 4px;font-size:15px">7 dernières nuits</h3><svg class="chart" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Sommeil des 7 dernières nuits">${g}</svg>${legend}
    ${lines ? `<h3 style="margin:6px 0 4px;font-size:15px">Cœur la nuit · 7 jours</h3>${lines}<p class="tiny muted" style="margin:4px 0 10px">FC min ≈ FC de repos de la montre. La FC max de la nuit n'est pas transmise par Apple Santé / Intervals.</p>` : ''}`;
}
// 5 jours en colonnes avec valeurs, moyenne 30 j en pointillé (fiches de la Forme du jour)
function trendChart(kind){
  const T = Health.trend(kind), vals = T.map(x => x.v).filter(v => v != null); if (vals.length < 2) return '';
  const fmt = { hrv: v => `${Math.round(v)}`, rhr: v => `${Math.round(v)}`, weight: v => v.toFixed(1).replace('.', ','), score: v => `${Math.round(v)}`, sleep: v => `${Math.floor(v)}h${pad(Math.round(v%1*60))}` }[kind];
  const unit = { hrv:'ms', rhr:'bpm', weight:'kg', score:'/100', sleep:'' }[kind], base = T.find(x => x.base != null)?.base ?? null;
  const all = [...vals, ...(base != null ? [base] : [])], lo0 = kind === 'score' ? 0 : Math.min(...all), hi0 = kind === 'score' ? 100 : Math.max(...all), pad0 = (hi0 - lo0)*0.25 || 1;
  const lo = kind === 'score' ? 0 : lo0 - pad0, hi = hi0 + (kind === 'score' ? 0 : pad0);
  const W = 320, Hh = 150, L = 8, R = 8, Tp = 22, B = 22, cw = (W - L - R)/T.length, Y = v => Tp + (Hh - Tp - B)*(1 - (v - lo)/(hi - lo || 1));
  const good = { hrv: 1, score: 1, sleep: 1, rhr: -1, weight: 0 }[kind];
  let g = '';
  if (base != null) g += `<line x1="${L}" x2="${W-R}" y1="${Y(base)}" y2="${Y(base)}" stroke="var(--muted)" stroke-dasharray="4 4"/><text x="${W-R}" y="${Y(base)-4}" text-anchor="end" style="font-size:9px">moy. 30 j ${fmt(base)}</text>`;
  T.forEach((x, i) => { const cx = L + cw*i + cw/2, today = i === T.length - 1;
    if (x.v != null) { const better = base == null || good === 0 ? null : (x.v - base)*good >= 0;
      const col = kind === 'score' ? (x.v >= 75 ? 'var(--ok)' : x.v >= 55 ? 'var(--z2)' : x.v >= 40 ? 'var(--warn)' : 'var(--bad)') : better == null ? 'var(--accent)' : better ? 'var(--ok)' : 'var(--warn)';
      g += `<rect x="${cx - cw*0.28}" y="${Y(x.v)}" width="${cw*0.56}" height="${Hh - B - Y(x.v)}" rx="5" style="fill:${col}" opacity="${today ? 1 : .55}"/><text x="${cx}" y="${Y(x.v) - 5}" text-anchor="middle" style="fill:var(--text);font-weight:600;font-size:11px">${fmt(x.v)}</text>`; }
    else g += `<text x="${cx}" y="${Hh - B - 6}" text-anchor="middle" style="font-size:10px">—</text>`;
    g += `<text x="${cx}" y="${Hh - 6}" text-anchor="middle" style="font-size:10px${today ? ';fill:var(--text);font-weight:600' : ''}">${today ? "auj." : fmtShort(x.d).replace(/ .*/, '')}</text>`; });
  return `<svg class="chart" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="5 derniers jours" style="margin:4px 0 10px">${g}</svg><div class="tiny muted" style="margin:-6px 0 10px">5 derniers jours${unit ? ` · ${unit}` : ''}</div>`;
}
function lineChart({ series, xMin, xMax, yMin, yMax, w=680, h=220, xLabels=[], yTicks=5, unit='' }){
  const L=34, R=10, T=10, B=22; const iw = w-L-R, ih = h-T-B;
  const X = x => L + (x - xMin)/(xMax - xMin || 1) * iw, Y = y => T + ih - (y - yMin)/(yMax - yMin || 1) * ih;
  let g = '';
  for (let i=0;i<=yTicks;i++){ const v = yMin + (yMax-yMin)*i/yTicks; const y = Y(v); g += `<line x1="${L}" x2="${w-R}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-width="1"/><text x="${L-6}" y="${y+3}" text-anchor="end">${Math.round(v)}${unit}</text>`; }
  for (const [x, lab] of xLabels) g += `<text x="${X(x)}" y="${h-6}" text-anchor="middle">${lab}</text>`;
  for (const s of series) {
    if (s.type === 'area') { const pts = s.pts.map(([x,y])=>`${X(x)},${Y(y)}`).join(' '); g += `<polygon points="${X(s.pts[0][0])},${Y(yMin)} ${pts} ${X(s.pts[s.pts.length-1][0])},${Y(yMin)}" fill="${s.color}" opacity="${s.opacity||.15}"/>`; }
    else if (s.type === 'dots') for (const [x,y,lab] of s.pts) g += `<circle cx="${X(x)}" cy="${Y(y)}" r="${s.r||4.5}" fill="${s.color}" stroke="var(--card)" stroke-width="2"/>${lab?`<text x="${X(x)}" y="${Y(y)-9}" text-anchor="middle" style="fill:var(--text);font-weight:600">${lab}</text>`:''}`;
    else if (s.pts.length) g += `<polyline points="${s.pts.map(([x,y])=>`${X(x)},${Y(y)}`).join(' ')}" fill="none" stroke="${s.color}" stroke-width="${s.width||2}" ${s.dash?`stroke-dasharray="${s.dash}"`:''} stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img">${g}</svg>`;
}
function profileBars(wid){
  const st = flat(WORKOUTS[wid].steps); const tot = st.reduce((a,s)=>a+s.d,0); const mx = Math.max(130, ...st.map(s=>s.p));
  return `<div class="prof">${st.map(s=>`<div title="${esc(s.label)} · ${fmtDur(s.d)} · ${s.p}%" style="flex:${s.d/tot};height:${Math.max(6, s.p/mx*100)}%;background:${ZCOL(zoneOf(s.p))};${s.max?'background-image:repeating-linear-gradient(45deg,transparent 0 4px,rgba(255,255,255,.35) 4px 7px)':''}"></div>`).join('')}</div>`;
}
function stepsTable(wid, k=1){
  const rows = [];
  const walk = (steps, prefix='') => { for (const s of steps) {
    if (s.repeat) { rows.push(`<tr><td colspan="3"><b>${s.repeat} ×</b></td></tr>`); walk(s.steps, '&nbsp;&nbsp;&nbsp;'); }
    else rows.push(`<tr><td>${prefix}<span class="zone" style="background:${ZCOL(zoneOf(s.p))}"></span>${esc(s.max ? s.label : s.label)}${s.cad?` <span class="muted tiny">· ${s.cad} rpm</span>`:''}</td><td class="r num">${fmtDur(s.d)}</td><td class="r num">${s.max ? '<b>max</b>' : `${watts(s.p, ftp(), k)} W <span class="muted tiny">${Math.round(s.p*k)}%</span>`}</td></tr>`);
  }};
  walk(WORKOUTS[wid].steps);
  return `<table class="steps">${rows.join('')}</table>`;
}
