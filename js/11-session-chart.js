"use strict";
// FTP Builder · graphique de séance
/* ============ graphique de séance : courbes superposables ============ */
const ActChart = (() => {
  const C = { pw:'var(--accent)', pw30:'#b4380a', hr:'var(--bad)', cad:'var(--z3)', tgt:'var(--z2)', cmp:'var(--muted)', spd:'#0ea5e9', alt:'var(--muted)' };
  const NAMES = { pw:'Puissance', pw30:'Puissance 30 s', hr:'FC', cad:'Cadence', tgt:'Cible prévue', cmp:'Comparaison', zones:'Zones', spd:'Vitesse', alt:'Altitude' };
  let st = { on: new Set(['pw','hr','tgt','spd','alt']), cmp: null, id: null, planId: null };
  const smooth = (arr, w) => { if (!arr) return null; const out = []; let s = 0; for (let i=0;i<arr.length;i++){ s += arr[i]; if (i>=w) s -= arr[i-w]; out.push(Math.round(s/Math.min(i+1,w))); } return out; };
  function target(planItem, secs, n){
    if (!planItem) return null;
    const steps = flat(WORKOUTS[planItem.workoutId].steps); const f = ftpAt(S.activities.find(a=>a.planId===planItem.id)?.date || todayISO()) * adj() * sAdj(planItem);
    const per = []; for (const s of steps) for (let k=0;k<s.d;k++) per.push(s.max ? null : Math.round(s.p/100*f));
    return Array.from({length:n}, (_,i) => { const t = Math.floor(i*secs/n); return t < per.length ? per[t] : null; });
  }
  function html(a, planItem){
    if (!a || !(a.pwSample || a.hrSample || a.spdSample)) return '';
    st.id = a.id; st.planId = planItem?.id || a.planId || null; if (st.cmp === a.id) st.cmp = null;
    const others = S.activities.filter(x => x.id !== a.id && x.pwSample).sort((x,y) => y.date.localeCompare(x.date)).slice(0, 30);
    const avail = availOf(a);
    return `<div class="actchart" data-aid="${a.id}">
      <div class="achips">${chips(avail)}<button type="button" class="afull" data-acfull="${a.id}" aria-label="Agrandir le graphique">⤢ Agrandir</button></div>
      <div class="awrap"><div class="achart">${svg(a)}</div><div class="atip" hidden></div></div>
      ${others.length && a.pwSample ? `<div class="row" style="margin-top:8px;gap:6px"><label class="small muted" for="acCmp">Superposer avec</label><select id="acCmp" style="flex:1;min-width:150px;min-height:36px;padding:4px 8px"><option value="">—</option>${others.map(o => `<option value="${o.id}" ${st.cmp===o.id?'selected':''}>${fmtShort(o.date)} · ${esc(o.planId ? WORKOUTS[S.plan.find(s=>s.id===o.planId)?.workoutId]?.name || o.name : o.name)}${o.np?` · ${o.np} W`:''}</option>`).join('')}</select></div>` : ''}
      ${a.best ? `<h3 style="margin-top:16px">Courbe de puissance</h3>${curve(a)}` : ''}
    </div>`;
  }
  const chips = avail => avail.map(k => `<button type="button" class="${st.on.has(k)?'on':''}" data-ac="${k}"><i style="background:${k==='zones'?'linear-gradient(90deg,var(--z2),var(--z4),var(--z6))':C[k]}"></i>${NAMES[k]}</button>`).join('');
  const availOf = a => ['pw','pw30','hr','spd','alt','cad','tgt','zones'].filter(k => k === 'zones' ? a.pwSample : k === 'tgt' ? !!(st.planId && S.plan.find(s=>s.id===st.planId)) : k === 'cad' ? a.cadSample : k === 'hr' ? a.hrSample : k === 'spd' ? a.spdSample : k === 'alt' ? a.altSample : a.pwSample);
  // plein écran : occupe tout l'écran et se redessine à la taille réelle (paysage si on tourne le téléphone)
  const fs = document.getElementById('fsDlg');
  function openFull(id){
    const a = S.activities.find(x => x.id === id); if (!a) return;
    const pl = S.plan.find(s => s.id === st.planId);
    fs.innerHTML = `<div class="actchart full" data-aid="${a.id}"><div class="fshead"><h3>${esc(pl ? WORKOUTS[pl.workoutId].name : a.name)} <span class="muted small">· ${fmtShort(a.date)}</span></h3><button type="button" data-fsclose aria-label="Fermer">×</button></div>
      <div class="achips">${chips(availOf(a))}</div><div class="awrap"><div class="achart"></div><div class="atip" hidden></div></div><div class="fshint">Tourne ton téléphone pour un affichage en paysage</div></div>`;
    fs.showModal(); redraw(fs.querySelector('.actchart'));
    try { if (fs.requestFullscreen && !/iPhone|iPod/.test(navigator.userAgent)) fs.requestFullscreen().catch(() => {}); } catch {}
  }
  function closeFull(){ if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); if (fs.open) fs.close(); }
  fs.addEventListener('close', () => { fs.innerHTML = ''; if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    document.querySelectorAll('.actchart:not(.full)').forEach(box => { box.querySelectorAll('[data-ac]').forEach(b => b.classList.toggle('on', st.on.has(b.dataset.ac))); redraw(box); }); });
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && fs.open) setTimeout(() => redraw(fs.querySelector('.actchart')), 50); });
  let rz; const onResize = () => { clearTimeout(rz); rz = setTimeout(() => { if (fs.open) redraw(fs.querySelector('.actchart')); }, 120); };
  window.addEventListener('resize', onResize); screen.orientation?.addEventListener?.('change', onResize);
  function series(a){
    const n = (a.pwSample || a.hrSample || a.spdSample).length, secs = a.sampleSecs || a.durationS || n;
    const out = {};
    if (a.spdSample) out.spd = a.spdSample; if (a.altSample) out.alt = a.altSample;
    if (a.pwSample) { out.pw = a.pwSample; out.pw30 = smooth(a.pwSample, Math.max(1, Math.round(30 / (secs/n)))); }
    if (a.hrSample) out.hr = a.hrSample; if (a.cadSample) out.cad = a.cadSample;
    const pl = S.plan.find(s => s.id === st.planId); out.tgt = target(pl, secs, n);
    if (st.cmp) { const o = S.activities.find(x => x.id === st.cmp); if (o?.pwSample) { const on = o.pwSample.length, os = o.sampleSecs || o.durationS || on; out.cmp = Array.from({length:n}, (_,i) => { const t = i*secs/n; const j = Math.round(t / os * on); return j < on ? o.pwSample[j] : null; }); } }
    return { n, secs, out };
  }
  function svg(a, W = 680, H = 230){
    const { n, secs, out } = series(a);
    const L = 38, R = 34, T = W === 680 ? 10 : 24, B = 22, iw = W-L-R, ih = H-T-B; // plein écran : place pour les unités au-dessus des axes
    const X = i => L + i/(n-1) * iw;
    const pMax = Math.max(200, ...(out.pw||[0]), ...((st.on.has('tgt') && out.tgt) ? out.tgt.filter(Boolean) : [0]), ...((out.cmp) ? out.cmp.filter(Boolean) : [0])) * 1.08;
    const Yp = v => T + ih - v/pMax*ih;
    const hMin = 60, hMax = 200, Yh = v => T + ih - (v-hMin)/(hMax-hMin)*ih;
    const Yc = v => T + ih - v/140*ih;
    let g = '';
    const sMax = out.spd ? Math.max(20, ...out.spd) * 1.1 : 1, Ys = v => T + ih - v/sMax*ih, spdAxis = !out.pw && out.spd && st.on.has('spd');
    for (let i=0;i<=4;i++){ const v = pMax*i/4, y = Yp(v); g += `<line x1="${L}" x2="${W-R}" y1="${y}" y2="${y}" stroke="var(--line)"/>${out.pw ? `<text x="${L-5}" y="${y+3}" text-anchor="end">${Math.round(v)}</text>` : spdAxis ? `<text x="${L-5}" y="${y+3}" text-anchor="end" style="fill:${C.spd}">${Math.round(sMax*i/4)}</text>` : ''}`; }
    if (st.on.has('alt') && out.alt) { const lo = Math.min(...out.alt), hi = Math.max(...out.alt), Ya = v => T + ih - (hi > lo ? (v-lo)/(hi-lo) : 0.3)*ih*0.45;
      g += `<path d="M${X(0)},${T+ih}${out.alt.map((v,i) => `L${X(i).toFixed(1)},${Ya(v).toFixed(1)}`).join('')}L${X(n-1)},${T+ih}Z" fill="var(--muted)" opacity=".16"/>`; }
    if (st.on.has('hr') && out.hr) for (let i=0;i<4;i++){ /* graduation du haut : place pour « bpm » */ const v = hMin + (hMax-hMin)*i/4; g += `<text x="${W-R+5}" y="${Yh(v)+3}" style="fill:var(--bad)">${Math.round(v)}</text>`; }
    const mins = secs/60, step = (mins > 90 ? 30 : mins > 40 ? 15 : 10) / (W > 1000 ? 2 : 1);
    for (let m = 0; m <= mins; m += step) g += `<text x="${X(m*60/secs*(n-1))}" y="${H-6}" text-anchor="middle">${m}'</text>`;
    if (st.on.has('zones') && out.pw) { const f = ftpAt(a.date); for (const [lo, hi, z] of [[0,.56,1],[.56,.76,2],[.76,.91,3],[.91,1.06,4],[1.06,1.21,5],[1.21,3,6]]) { const y1 = Yp(Math.min(hi*f, pMax)), y0 = Yp(Math.min(lo*f, pMax)); if (lo*f < pMax) g += `<rect x="${L}" y="${y1}" width="${iw}" height="${Math.max(0,y0-y1)}" fill="var(--z${z})" opacity=".08"/>`; } }
    const path = (arr, Y) => { let d = '', pen = false; arr.forEach((v,i) => { if (v == null || isNaN(v)) { pen = false; return; } d += `${pen ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`; pen = true; }); return d; };
    if (st.on.has('tgt') && out.tgt) g += `<path d="${path(out.tgt, Yp)}" fill="none" stroke="${C.tgt}" stroke-width="2.5" opacity=".75" stroke-linejoin="round"/>`;
    if (out.cmp) g += `<path d="${path(out.cmp, Yp)}" fill="none" stroke="${C.cmp}" stroke-width="1.4" stroke-dasharray="4 3"/>`;
    if (st.on.has('pw') && out.pw) g += `<path d="${path(out.pw, Yp)}L${X(n-1)},${Yp(0)}L${X(0)},${Yp(0)}Z" fill="${C.pw}" opacity=".12"/><path d="${path(out.pw, Yp)}" fill="none" stroke="${C.pw}" stroke-width="1.3"/>`;
    if (st.on.has('pw30') && out.pw30) g += `<path d="${path(out.pw30, Yp)}" fill="none" stroke="${C.pw30}" stroke-width="2"/>`;
    if (st.on.has('cad') && out.cad) g += `<path d="${path(out.cad, Yc)}" fill="none" stroke="${C.cad}" stroke-width="1" opacity=".85"/>`;
    if (st.on.has('spd') && out.spd) g += `<path d="${path(out.spd, Ys)}" fill="none" stroke="${C.spd}" stroke-width="1.4"/>`;
    if (st.on.has('hr') && out.hr) g += `<path d="${path(out.hr, Yh)}" fill="none" stroke="${C.hr}" stroke-width="1.4"/>`;
    g += `<line class="acur" x1="0" x2="0" y1="${T}" y2="${T+ih}" stroke="var(--text)" stroke-width="1" opacity="0"/>`;
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" data-w="${W}" preserveAspectRatio="none" role="img" aria-label="Courbes de la séance">${g}<text x="${L}" y="${T-1}" style="font-size:9px">${out.pw ? 'W' : spdAxis ? 'km/h' : ''}</text>${st.on.has('hr')&&out.hr?`<text x="${W-R+5}" y="${T-1}" style="font-size:9px;fill:var(--bad)">bpm</text>`:''}</svg>`;
  }
  function curve(a){
    const K = [['s5',5,'5 s'],['m1',60,'1 min'],['m5',300,'5 min'],['m8',480,'8 min'],['m20',1200,'20 min'],['m60',3600,'60 min']].filter(([k]) => a.best[k]);
    if (K.length < 2) return '';
    const allBest = k => Math.max(0, ...S.activities.filter(x => x.date <= a.date && x.best).map(x => x.best[k] || 0));
    const W = 680, H = 170, L = 38, R = 12, T = 12, B = 24, iw = W-L-R, ih = H-T-B;
    const lx = s => Math.log(s), x0 = lx(5), x1 = lx(3600), X = s => L + (lx(s)-x0)/(x1-x0)*iw;
    const vals = K.flatMap(([k]) => [a.best[k], allBest(k)]).filter(v => v > 0).concat([ftpAt(a.date)]);
    const lo = Math.min(...vals) * 0.85, hi = Math.max(...vals) * 1.12, Y = v => T + ih - (Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo)) * ih;
    let g = ''; for (const v of [150, 200, 300, 400, 600, 800, 1000, 1200].filter(v => v > lo && v < hi)) g += `<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${L-5}" y="${Y(v)+3}" text-anchor="end">${v}</text>`;
    for (const [,s,l] of K) g += `<text x="${X(s)}" y="${H-6}" text-anchor="middle">${l}</text>`;
    const line = f => K.map(([k,s],i) => `${i?'L':'M'}${X(s).toFixed(1)},${Y(f(k)).toFixed(1)}`).join('');
    g += `<path d="${line(allBest)}" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="4 3"/>`;
    g += `<path d="${line(k => a.best[k])}" fill="none" stroke="var(--accent)" stroke-width="2.5"/>`;
    for (const [k,s] of K) g += `<circle cx="${X(s)}" cy="${Y(a.best[k])}" r="3.5" fill="var(--accent)"/><text x="${X(s)}" y="${Y(a.best[k])-8}" text-anchor="middle" style="fill:var(--text);font-weight:600">${a.best[k]}</text>`;
    const ftpLine = Y(ftpAt(a.date)); g += `<line x1="${L}" x2="${W-R}" y1="${ftpLine}" y2="${ftpLine}" stroke="var(--z4)" stroke-dasharray="2 4"/><text x="${W-R}" y="${ftpLine-4}" text-anchor="end" style="fill:var(--z4)">FTP ${ftpAt(a.date)}</text>`;
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Courbe de puissance">${g}</svg><div class="legend"><span><i style="background:var(--accent)"></i>Cette séance</span><span><i style="background:var(--muted)"></i>Tes records à cette date</span></div><p class="tiny muted" style="margin:4px 0 0">Ta meilleure puissance moyenne sur chaque durée. Si la courbe orange touche la grise, c'est un record.</p>`;
  }
  function redraw(box){
    const a = box && S.activities.find(x => x.id === box.dataset.aid); if (!a) return;
    const el = box.querySelector('.achart');
    if (box.classList.contains('full')) { const r = el.getBoundingClientRect(); el.innerHTML = svg(a, Math.max(320, Math.round(r.width)), Math.max(180, Math.round(r.height))); }
    else el.innerHTML = svg(a);
  }
  document.addEventListener('click', e => {
    const f = e.target.closest('[data-acfull]'); if (f) { openFull(f.dataset.acfull); return; }
    if (e.target.closest('[data-fsclose]')) { closeFull(); return; }
    const b = e.target.closest('.actchart [data-ac]'); if (!b) return;
    const k = b.dataset.ac; st.on.has(k) ? st.on.delete(k) : st.on.add(k); b.classList.toggle('on', st.on.has(k));
    redraw(b.closest('.actchart'));
  });
  document.addEventListener('change', e => { if (e.target.id !== 'acCmp') return; st.cmp = e.target.value || null; redraw(e.target.closest('.actchart')); });
  // lecture au doigt / à la souris
  const move = e => {
    const wrap = e.target.closest?.('.actchart .awrap'); if (!wrap) return;
    const box = wrap.closest('.actchart'), a = S.activities.find(x => x.id === box.dataset.aid); if (!a) return;
    const svgEl = wrap.querySelector('svg'), r = svgEl.getBoundingClientRect(); const pt = (e.touches ? e.touches[0] : e);
    const VW = +svgEl.dataset.w || 680; const fx = (pt.clientX - r.left) / r.width * VW; const { n, secs, out } = series(a);
    const i = clamp(Math.round((fx - 38) / (VW-38-34) * (n-1)), 0, n-1);
    const cur = svgEl.querySelector('.acur'); const xx = 38 + i/(n-1)*(VW-38-34); cur.setAttribute('x1', xx); cur.setAttribute('x2', xx); cur.setAttribute('opacity', .5);
    const t = Math.round(i*secs/(n-1)); const tip = wrap.querySelector('.atip'); tip.hidden = false;
    const parts = [`<b>${Math.floor(t/60)}'${pad(t%60)}</b>`];
    if (out.pw && st.on.has('pw')) parts.push(`<span style="color:var(--accent)">${out.pw[i]} W</span>`);
    if (out.pw30 && st.on.has('pw30')) parts.push(`30 s ${out.pw30[i]} W`);
    if (out.tgt && st.on.has('tgt') && out.tgt[i]) parts.push(`<span style="color:var(--z2)">cible ${out.tgt[i]} W</span>`);
    if (out.cmp && out.cmp[i] != null) parts.push(`<span class="muted">comp. ${out.cmp[i]} W</span>`);
    if (out.hr && st.on.has('hr')) parts.push(`<span style="color:var(--bad)">${out.hr[i]} bpm</span>`);
    if (out.cad && st.on.has('cad')) parts.push(`<span style="color:var(--z3)">${out.cad[i]} rpm</span>`);
    if (out.spd && st.on.has('spd')) parts.push(`<span style="color:${C.spd}">${String(Math.round(out.spd[i]*10)/10).replace('.', ',')} km/h</span>`);
    if (out.alt && st.on.has('alt')) parts.push(`<span class="muted">${Math.round(out.alt[i])} m</span>`);
    tip.innerHTML = parts.join(' · ');
  };
  document.addEventListener('pointermove', move); document.addEventListener('touchmove', move, { passive: true }); document.addEventListener('pointerdown', move);
  return { html };
})();
