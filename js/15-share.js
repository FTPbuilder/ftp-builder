"use strict";
// FTP Builder · partage d'une séance : carrousel d'images HD (1080 px) dessinées en canvas, pas des captures d'écran
// Résumé · Courbes (vraies données) · Tracé GPS (fond transparent) · Meilleurs efforts · Stats sur fond transparent
const Share = (() => {
  const FMT = { story: { h: 1920, label: 'Story 9:16' }, post: { h: 1350, label: 'Post 4:5' } };
  const STY = { dark: 'Sombre', light: 'Clair' };
  const SLIDES = { resume: 'Résumé', courbe: 'Courbes', trace: 'Tracé', efforts: 'Efforts', stats: 'Stats' };
  const IRI = ['#7cc3ff', '#a66af2', '#e05ad0', '#ff9a52'];
  const W = 1080, P = 84;
  let opt = { fmt: 'story', sty: 'dark', off: [] }, cur = [], urls = [], seq = 0;
  try { Object.assign(opt, JSON.parse(localStorage.getItem('ftpb_share') || '{}')); if (!STY[opt.sty]) opt.sty = 'dark'; if (!Array.isArray(opt.off)) opt.off = []; } catch {}
  const keep = () => { try { localStorage.setItem('ftpb_share', JSON.stringify(opt)); } catch {} };

  const fontsReady = () => Promise.race([
    Promise.all(['italic 900 100px "Barlow Condensed"', '800 100px "Barlow Condensed"', '700 100px "Barlow Condensed"', '600 100px "Barlow Condensed"', '600 40px Inter', '500 40px Inter'].map(f => document.fonts?.load(f).catch(() => {}))),
    new Promise(r => setTimeout(r, 1500))]);
  const BC = (w, sz, it) => `${it ? 'italic ' : ''}${w} ${sz}px "Barlow Condensed","Arial Narrow",system-ui,sans-serif`;
  const IN = (w, sz) => `${w} ${sz}px Inter,system-ui,sans-serif`;
  const spacing = (g, px) => { if ('letterSpacing' in g) g.letterSpacing = px + 'px'; };
  const iriH = (g, x0, x1) => { const gr = g.createLinearGradient(x0, 0, x1, 0); IRI.forEach((c, i) => gr.addColorStop(i / (IRI.length - 1), c)); return gr; };
  const fitFont = (g, txt, w, sz, min, make) => { for (; sz > min; sz -= 4) { g.font = make(sz); if (g.measureText(txt).width <= w) break; } return sz; };
  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); };
  const noShadow = (g, f) => { g.save(); g.shadowBlur = 0; g.shadowColor = 'transparent'; f(); g.restore(); };
  const km = v => String(Math.round(v * 10) / 10).replace('.', ',');
  const hm = mins => mins >= 60 ? `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}` : mins + "'";

  /* ---------- données ---------- */
  async function model(a){
    const pl = a.planId ? S.plan.find(s => s.id === a.planId) : null;
    const indoor = isIndoor(a), d = parseD(a.date);
    const title = (pl ? WORKOUTS[pl.workoutId]?.name : null) || a.name || 'Séance';
    const date = `${DOW[dowMon(a.date)]}. ${d.getDate()} ${MONTHS[d.getMonth()]}`;
    let hero, stats;
    if (indoor || !a.distanceKm) {
      hero = a.np ? [String(a.np), 'W', 'Puissance normalisée'] : a.avgPower ? [String(a.avgPower), 'W', 'Puissance moyenne'] : [fmtDur(a.durationS), '', 'Durée'];
      stats = [['Durée', fmtDur(a.durationS)], ['TSS', a.tss], ['P. moy.', a.avgPower && a.np ? a.avgPower + ' W' : null], ['IF', a.if], ['FC moy.', a.avgHr ? a.avgHr + ' bpm' : null], ['Cadence', a.avgCad ? a.avgCad + ' rpm' : null], ['FC max', a.maxHr ? a.maxHr + ' bpm' : null]];
    } else {
      hero = [km(a.distanceKm), 'km', 'Distance'];
      stats = [['Durée', fmtDur(a.durationS)], ['Vitesse', speedOf(a) ? km(speedOf(a)) + ' km/h' : null], ['D+', a.elevM != null ? a.elevM + ' m' : null], ['NP', a.hasPower && a.np ? a.np + ' W' : null], ['TSS', a.tss], ['FC moy.', a.avgHr ? a.avgHr + ' bpm' : null], ['FC max', a.maxHr ? a.maxHr + ' bpm' : null]];
    }
    if (hero[2] === 'Durée') stats = stats.filter(s => s[0] !== 'Durée');
    stats = stats.filter(s => s[1] != null && s[1] !== '' && s[1] !== '—').slice(0, 6).map(([l, v]) => [l, String(v)]);
    // meilleurs efforts de la séance, comparés aux records d'avant
    const K = [['s5', 5, '5 s'], ['m1', 60, '1 min'], ['m5', 300, '5 min'], ['m8', 480, '8 min'], ['m20', 1200, '20 min'], ['m60', 3600, '60 min']];
    const prev = k => Math.max(0, ...S.activities.filter(x => x.id !== a.id && x.date <= a.date && x.best).map(x => x.best[k] || 0));
    const efforts = a.best ? K.filter(([k]) => a.best[k]).map(([k, s, l]) => ({ k, s, l, v: a.best[k], prev: prev(k), rec: a.best[k] > prev(k) && prev(k) > 0 })) : [];
    const recs = efforts.filter(e => ['s5', 'm1', 'm5', 'm20'].includes(e.k)).map(e => [e.l, e.v]);
    const e = pl ? sessionEval(a, pl) : null;
    const badge = e && !e.pending && e.lvl === 0 ? e.title : null;
    // courbes : les échantillons de la séance tels quels (ceux du graphique de la fiche), sans lissage
    let ch = null;
    const n = (a.pwSample || a.altSample || a.hrSample || []).length, secs = a.sampleSecs || a.durationS || n;
    if (n > 10) {
      const hr = a.hrSample?.length === n ? a.hrSample : null;
      if (a.pwSample) {
        ch = { main: a.pwSample, kind: 'pw', tgt: pl ? ActChart.target(pl, secs, n) : null, hr };
        if (pl) { try { const m = measureUnits(pl.workoutId, ftpAt(a.date) * adj() * sAdj(pl), a.pwSample, null, secs / n); ch.units = (m?.units || []).filter(u => u.cover >= 0.5 && u.i0 != null); } catch {} }
      } else if (a.altSample) ch = { main: a.altSample, kind: 'alt', hr };
      else if (a.hrSample) ch = { main: a.hrSample, kind: 'hr' };
      if (ch) ch.mins = Math.round(secs / 60);
    }
    let prog = null;
    if ((a.planId || a.countAsSession) && S.profile?.minSessions) {
      const done = S.activities.filter(x => x.planId || x.countAsSession).sort((x, y) => x.date.localeCompare(y.date) || String(x.id).localeCompare(String(y.id)));
      const i = done.findIndex(x => x.id === a.id);
      if (i >= 0) prog = { i: i + 1, n: Math.max(S.profile.minSessions, i + 1), goal: S.profile.goalFtp };
    }
    let track = null;
    if (!indoor) { try { const t = await Tracks.get(a); if (t?.lat?.length > 5) track = t; } catch {} }
    return { title, date, indoor, hero, stats, recs, efforts, badge, ch, prog, track, wkg: S.profile?.weightKg };
  }
  const slidesOf = m => Object.keys(SLIDES).filter(k => k === 'courbe' ? !!m.ch : k === 'trace' ? !!m.track : k === 'efforts' ? m.efforts.length >= 3 : true);

  /* ---------- briques communes ---------- */
  function canvas(H, sty){
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
    const clear = sty === 'clear', light = sty === 'light';
    const c = { clear, light, TX: light ? '#16181d' : '#ffffff', MU: light ? '#666c78' : clear ? 'rgba(255,255,255,.88)' : '#9aa1b0', LINE: light ? '#e1dfda' : clear ? 'rgba(255,255,255,.4)' : '#2a2f3b', CARD: light ? '#ffffff' : '#1c2029', GRID: light ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.08)' };
    if (!clear) {
      g.fillStyle = light ? '#f5f4f1' : '#0f1115'; g.fillRect(0, 0, W, H);
      const glow = (x, y, r, col, al) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, 'transparent'); g.globalAlpha = al; g.fillStyle = gr; g.fillRect(0, 0, W, H); g.globalAlpha = 1; };
      glow(W * 0.95, H * 0.04, W * 0.8, '#a66af2', light ? 0.16 : 0.32); glow(W * 0.02, H * 0.55, W * 0.7, '#ff9a52', light ? 0.12 : 0.18); glow(W * 0.6, H * 1.02, W * 0.8, '#7cc3ff', light ? 0.14 : 0.2);
    } else { g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 18; }
    g.textBaseline = 'alphabetic';
    return { cv, g, c, H };
  }
  function header(g, c, y, m){
    const L = 64; noShadow(g, () => { g.translate(P, y - 48); g.scale(L / 512, L / 512);
      rr(g, 0, 0, 512, 512, 112); g.fillStyle = '#0f1115'; g.fill(); if (!c.light) { g.lineWidth = 10; g.strokeStyle = '#2a2f3b'; g.stroke(); }
      g.beginPath(); g.moveTo(96, 360); g.lineTo(176, 280); g.lineTo(240, 320); g.lineTo(336, 200); g.lineTo(416, 152); g.lineWidth = 40; g.lineCap = g.lineJoin = 'round'; g.strokeStyle = '#ff6a2b'; g.stroke();
      g.beginPath(); g.arc(416, 152, 28, 0, Math.PI * 2); g.fillStyle = '#ffb02e'; g.fill(); });
    g.font = BC(800, 44); spacing(g, 3); g.fillStyle = c.TX; g.fillText('FTP BUILDER', P + L + 22, y);
    g.font = IN(500, 32); spacing(g, 0); g.fillStyle = c.MU; g.textAlign = 'right'; g.fillText(m.date, W - P, y); g.textAlign = 'left';
  }
  function titleBlock(g, c, y, txt, sz, maxLines = 2, up = false){
    const T = txt.toUpperCase().replace(/ ([×x/]) /g, ' $1 ').replace(/(\d) (MIN|S|KM|H|W)\b/g, '$1 $2'), maxW = W - 2 * P;
    let lines;
    for (; sz >= 56; sz -= 6) {
      g.font = BC(900, sz, true); lines = [''];
      for (const w of T.split(' ')) { const t = (lines[lines.length - 1] + ' ' + w).trim(); if (g.measureText(t).width <= maxW || !lines[lines.length - 1]) lines[lines.length - 1] = t; else lines.push(w); }
      if (lines.length <= maxLines && lines.every(l => g.measureText(l).width <= maxW)) break;
    }
    lines = lines.slice(0, maxLines); if (up) y -= (lines.length - 1) * sz * 0.95; g.fillStyle = iriH(g, P, W - P); lines.forEach((l, i) => g.fillText(l, P, y + i * sz * 0.95));
    return y + (lines.length - 1) * sz * 0.95;
  }
  function footer(g, c, H, story){
    const fy = H - (story ? 80 : 56);
    g.font = IN(500, 26); g.fillStyle = c.MU; spacing(g, 1); g.fillText('Construit avec FTP Builder', P, fy); spacing(g, 0);
    const host = /^https?:/.test(location.protocol) ? (location.host + location.pathname).replace(/index\.html$/, '').replace(/\/$/, '') : 'ftpbuilder.github.io/ftp-builder';
    g.textAlign = 'right'; g.fillText(host, W - P, fy); g.textAlign = 'left';
    return fy - 50;
  }
  function tag(g, c, y, m){
    const t = m.indoor ? 'HOME TRAINER' : 'SORTIE VÉLO'; g.font = IN(600, 28); spacing(g, 3);
    const tw = g.measureText(t).width + 48; noShadow(g, () => { rr(g, P, y - 46, tw, 64, 32); g.fillStyle = m.indoor ? '#ff8a4c' : '#3b82f6'; g.fill(); });
    g.fillStyle = '#fff'; g.fillText(t, P + 24, y - 3); spacing(g, 0);
    if (m.badge) { g.font = IN(600, 28); const bt = '✓ ' + m.badge, bw = g.measureText(bt).width + 48, bx = P + tw + 16;
      if (bx + bw <= W - P) noShadow(g, () => { rr(g, bx, y - 46, bw, 64, 32); g.fillStyle = c.light ? '#e3f7ee' : 'rgba(62,207,142,.18)'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#3ecf8e'; g.stroke(); g.fillStyle = c.light ? '#138a57' : '#3ecf8e'; g.fillText(bt, bx + 24, y - 3); }); }
  }
  function statGrid(g, c, y, stats, chH, story, boxed = true){
    const cols = 3, gap = 20, cw = (W - 2 * P - gap * (cols - 1)) / cols;
    stats.forEach(([l, v], i) => {
      const cx = P + (i % cols) * (cw + gap), cy = y + Math.floor(i / cols) * (chH + gap);
      if (boxed) noShadow(g, () => { rr(g, cx, cy, cw, chH, 28); g.fillStyle = c.CARD; g.globalAlpha = c.light ? 1 : 0.85; g.fill(); g.globalAlpha = 1; g.lineWidth = 2; g.strokeStyle = c.LINE; g.stroke(); });
      const [num, ...u] = v.split(' '), px = boxed ? cx + 26 : cx;
      const vs = fitFont(g, v, cw - (boxed ? 52 : 10), story ? 76 : 58, 36, s => BC(700, s)), vy = cy + chH * (story ? 0.52 : 0.5);
      g.font = BC(700, vs); g.fillStyle = c.TX; g.fillText(num, px, vy);
      if (u.length) { const nw = g.measureText(num).width; g.font = BC(600, vs * 0.5); g.fillStyle = c.MU; g.fillText(u.join(' '), px + nw + 8, vy); }
      g.font = IN(600, story ? 24 : 21); spacing(g, 3); g.fillStyle = c.MU; g.fillText(l.toUpperCase(), px, cy + chH - (story ? 30 : 22)); spacing(g, 0);
    });
    return y + Math.ceil(stats.length / cols) * (chH + gap);
  }
  function progBar(g, c, y, m){
    if (!m.prog) return; const { i, n, goal } = m.prog, bw = W - 2 * P;
    g.font = BC(700, 40); g.fillStyle = c.TX; g.fillText(`Séance ${i} / ${n}`, P, y - 22);
    if (goal) { g.font = IN(500, 28); g.fillStyle = c.MU; g.textAlign = 'right'; g.fillText(`objectif FTP ${goal} W`, W - P, y - 24); g.textAlign = 'left'; }
    noShadow(g, () => { rr(g, P, y, bw, 14, 7); g.fillStyle = c.light ? '#e1dfda' : 'rgba(255,255,255,.18)'; g.fill(); rr(g, P, y, Math.max(14, bw * Math.min(1, i / n)), 14, 7); g.fillStyle = iriH(g, P, P + bw); g.fill(); });
  }

  /* ---------- courbes (vraies données) ---------- */
  function drawChart(g, c, ch, x, y, w, h, o = {}){
    const n = ch.main.length, axes = !!o.axes;
    const main = ch.main, tgt = ch.tgt, hr = ch.kind !== 'hr' ? ch.hr : null;
    const vals = main.filter(v => v != null).concat(tgt ? tgt.filter(v => v != null) : []);
    const lo = ch.kind === 'alt' ? Math.floor((Math.min(...vals) - 10) / 50) * 50 : ch.kind === 'hr' ? Math.floor(Math.min(...vals) * 0.9 / 10) * 10 : 0, hi = Math.max(...vals) * 1.1 || 1;
    const L = axes ? x + 70 : x, R = axes && hr ? x + w - 62 : x + w, top = y + (axes ? 90 : 50), bot = y + h - 44, ih = bot - top, iw = R - L;
    const X = i => L + i / (n - 1) * iw, Y = v => bot - (v - lo) / (hi - lo) * ih;
    const hv = hr ? hr.filter(v => v > 0) : [], hl = hv.length ? Math.floor(Math.min(...hv) * 0.9 / 10) * 10 : 0, hh = hv.length ? Math.max(...hv) * 1.05 : 1, YH = v => bot - (v - hl) / (hh - hl) * ih;
    const unit = { pw: 'W', alt: 'm', hr: 'bpm' }[ch.kind];
    // légende
    g.font = IN(600, 24); spacing(g, 3); g.fillStyle = c.MU;
    const leg = [[{ pw: 'PUISSANCE', alt: 'ALTITUDE', hr: 'FC' }[ch.kind], 'iri']]; if (tgt) leg.push(['CIBLE', 'tgt']); if (hr) leg.push(['FC', 'hr']);
    let lx = x; for (const [t, k] of leg) {
      noShadow(g, () => { g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(lx, y + 12); g.lineTo(lx + 34, y + 12);
        g.strokeStyle = k === 'iri' ? iriH(g, lx, lx + 34) : k === 'tgt' ? c.TX : '#ff4d5e'; if (k === 'tgt') { g.setLineDash([8, 7]); g.lineWidth = 4; g.globalAlpha = 0.7; } g.stroke(); });
      g.fillText(t, lx + 46, y + 21); lx += 46 + g.measureText(t).width + 34;
    }
    spacing(g, 0);
    // grille et graduations (vraies valeurs)
    if (axes) {
      const span = hi - lo, st = [10, 20, 25, 50, 100, 200, 250, 500].find(s => span / s <= 6) || 1000;
      g.font = IN(500, 22);
      for (let v = Math.ceil(lo / st) * st; v < hi; v += st) {
        noShadow(g, () => { g.strokeStyle = c.GRID; g.lineWidth = 2; g.beginPath(); g.moveTo(L, Y(v)); g.lineTo(R, Y(v)); g.stroke(); });
        g.fillStyle = c.MU; g.textAlign = 'right'; g.fillText(String(v), L - 12, Y(v) + 8);
        if (hr) { g.fillStyle = '#ff6b78'; g.textAlign = 'left'; g.fillText(String(Math.round(hl + (v - lo) / (hi - lo) * (hh - hl))), R + 12, Y(v) + 8); }
        g.textAlign = 'left';
      }
      g.fillStyle = c.MU; g.textAlign = 'right'; g.fillText(unit, L - 12, top - 14); g.textAlign = 'left';
      if (hr) { g.fillStyle = '#ff6b78'; g.textAlign = 'right'; g.fillText('bpm', x + w, top - 14); g.textAlign = 'left'; }
    }
    // aire + tracé sur un calque (fondu vers le bas, même sur fond transparent)
    const off = document.createElement('canvas'); off.width = W; off.height = Math.ceil(bot + 12); const q = off.getContext('2d');
    const path = new Path2D(); let s0 = false;
    main.forEach((v, i) => { if (v == null) return; s0 ? path.lineTo(X(i), Y(v)) : (path.moveTo(X(i), Y(v)), s0 = true); });
    const area = new Path2D(path); area.lineTo(X(n - 1), bot); area.lineTo(X(0), bot); area.closePath();
    q.fillStyle = iriH(q, L, R); q.globalAlpha = c.light ? 0.4 : 0.5; q.fill(area); q.globalAlpha = 1;
    q.globalCompositeOperation = 'destination-out'; const fade = q.createLinearGradient(0, top, 0, bot); fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,.9)'); q.fillStyle = fade; q.fillRect(L, top - 30, iw, ih + 40);
    q.globalCompositeOperation = 'source-over'; q.lineWidth = o.thick || 3.5; q.lineJoin = 'round'; q.lineCap = 'round'; q.strokeStyle = iriH(q, L, R); q.stroke(path);
    if (hr) { q.beginPath(); let s = false; hr.forEach((v, i) => { if (!(v > 0)) { s = false; return; } s ? q.lineTo(X(i), YH(v)) : (q.moveTo(X(i), YH(v)), s = true); }); q.lineWidth = 3; q.strokeStyle = '#ff4d5e'; q.globalAlpha = 0.85; q.stroke(); q.globalAlpha = 1; }
    if (tgt) { q.beginPath(); let s = false; tgt.forEach((v, i) => { if (v == null) { s = false; return; } s ? q.lineTo(X(i), Y(v)) : (q.moveTo(X(i), Y(v)), s = true); });
      q.setLineDash([12, 10]); q.lineWidth = 3.5; q.strokeStyle = c.TX; q.globalAlpha = 0.65; q.stroke(); q.setLineDash([]); q.globalAlpha = 1; }
    g.save(); if (c.clear) { g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 14; } else g.shadowBlur = 0; g.drawImage(off, 0, 0); g.restore();
    // puissance moyenne de chaque bloc, au-dessus du bloc
    if (o.blocks && ch.units?.length) {
      const fs = ch.units.length > 6 ? 24 : 30;
      for (const u of ch.units) {
        const i0 = Math.max(0, u.i0), i1 = Math.min(n - 1, u.i1), xm = (X(i0) + X(i1)) / 2;
        let pk = 0; for (let i = i0; i <= i1; i++) pk = Math.max(pk, main[i] || 0);
        const t = `${u.got} W`; g.font = BC(700, fs); const tw = g.measureText(t).width + 24, ty = Math.max(top + 4, Y(pk) - 18 - fs);
        if (X(i1) - X(i0) < tw * 0.6) continue;
        noShadow(g, () => { rr(g, xm - tw / 2, ty, tw, fs + 14, (fs + 14) / 2); g.fillStyle = c.light ? 'rgba(255,255,255,.92)' : 'rgba(15,17,21,.82)'; g.fill(); g.lineWidth = 2; g.strokeStyle = iriH(g, xm - tw / 2, xm + tw / 2); g.stroke(); });
        g.fillStyle = c.TX; g.textAlign = 'center'; g.fillText(t, xm, ty + fs * 0.95); g.textAlign = 'left';
      }
    }
    // axe du temps
    noShadow(g, () => { g.lineWidth = 2; g.strokeStyle = c.LINE; g.beginPath(); g.moveTo(L, bot + 1); g.lineTo(R, bot + 1); g.stroke(); });
    g.font = IN(500, 24); g.fillStyle = c.MU;
    if (axes && ch.mins) { const st = ch.mins > 150 ? 30 : ch.mins > 70 ? 15 : 10; for (let t = 0; t < ch.mins; t += st) { const xx = L + t / ch.mins * iw; if (xx > R - 110 && t) continue; g.textAlign = t ? 'center' : 'left'; g.fillText(hm(t), xx, bot + 34); } g.textAlign = 'right'; g.fillText(hm(ch.mins), R, bot + 34); g.textAlign = 'left'; }
    else { g.fillText("0'", L, bot + 34); if (ch.mins) { g.textAlign = 'right'; g.fillText(hm(ch.mins), R, bot + 34); g.textAlign = 'left'; } }
  }

  /* ---------- diapositives ---------- */
  function slideResume(m, fmt, sty){
    const story = fmt === 'story', { cv, g, c, H } = canvas(FMT[fmt].h, sty);
    let y = story ? 150 : 96; header(g, c, y, m);
    y += story ? 120 : 84; tag(g, c, y, m);
    y += story ? 140 : 110; y = titleBlock(g, c, y, m.title, story ? 120 : 88) + (story ? 50 : 40);
    const [hv, hu, hl] = m.hero, hsz = story ? 236 : 170;
    y += hsz * 0.78; g.font = BC(800, hsz); const hw = g.measureText(hv).width; g.fillStyle = iriH(g, P, P + hw); g.fillText(hv, P - 6, y);
    if (hu) { g.font = BC(700, hsz * 0.34); g.fillStyle = c.TX; g.fillText(hu, P + hw + 12, y); }
    y += hv.includes(',') ? hsz * 0.24 + 28 : (story ? 60 : 50); g.font = IN(600, 30); spacing(g, 4); g.fillStyle = c.MU; g.fillText(hl.toUpperCase(), P, y); spacing(g, 0);
    y += story ? 56 : 40;
    y = statGrid(g, c, y, m.stats, story ? 146 : 112, story) + (story ? 40 : 22);
    const footTop = footer(g, c, H, story), progH = m.prog ? 90 : 0;
    let recs = m.recs, recH = recs.length ? (story ? 124 : 104) : 0;
    let chartH = footTop - progH - y - recH - (story ? 40 : 20);
    if (m.ch && recH && chartH < (story ? 190 : 260) && chartH + recH >= 150) { recs = []; chartH += recH; recH = 0; }
    if (m.ch && chartH > 140) { drawChart(g, c, m.ch, P, y, W - 2 * P, chartH); y += chartH + (story ? 30 : 16); }
    if (recs.length) drawRecs(g, c, y, recs, story);
    progBar(g, c, footTop - 14, m);
    return cv;
  }
  function drawRecs(g, c, y, recs, story){
    const ph = story ? 68 : 58, gp = 14, pw = (W - 2 * P - gp * (recs.length - 1)) / recs.length;
    g.font = IN(600, 24); spacing(g, 3); g.fillStyle = c.MU; g.fillText('MEILLEURS EFFORTS', P, y + 20); spacing(g, 0);
    const py = y + 40;
    recs.forEach(([l, v], i) => {
      const x = P + i * (pw + gp); noShadow(g, () => { rr(g, x, py, pw, ph, ph / 2); g.lineWidth = 2; g.strokeStyle = c.LINE; g.stroke(); });
      g.font = BC(700, 34); const vw = g.measureText(v + ' W').width; g.font = IN(500, 22); const lw = g.measureText(l).width, x0 = x + (pw - vw - lw - 10) / 2;
      g.font = BC(700, 34); g.fillStyle = c.TX; g.fillText(v + ' W', x0, py + ph * 0.65); g.font = IN(500, 22); g.fillStyle = c.MU; g.fillText(l, x0 + vw + 10, py + ph * 0.63);
    });
  }
  function slideCourbe(m, fmt, sty){
    const story = fmt === 'story', { cv, g, c, H } = canvas(FMT[fmt].h, sty);
    let y = story ? 150 : 96; header(g, c, y, m);
    y += story ? 130 : 96; y = titleBlock(g, c, y, m.title, story ? 92 : 76);
    y += story ? 60 : 46; g.font = IN(600, 26); spacing(g, 4); g.fillStyle = c.MU;
    g.fillText(m.ch.kind === 'pw' ? (m.ch.units?.length ? 'PUISSANCE · MOYENNE DE CHAQUE BLOC' : 'PUISSANCE ET FC') : m.ch.kind === 'alt' ? 'PROFIL ET FC' : 'FRÉQUENCE CARDIAQUE', P, y); spacing(g, 0);
    y += story ? 50 : 30;
    const footTop = footer(g, c, H, story);
    const kH = story ? 146 : 112, chartH = footTop - y - kH - (story ? 70 : 40);
    drawChart(g, c, m.ch, P, y, W - 2 * P, chartH, { axes: true, blocks: true, thick: 3 });
    const hero = [m.hero[2] === 'Puissance normalisée' ? 'NP' : m.hero[2], m.hero[0] + (m.hero[1] ? ' ' + m.hero[1] : '')];
    statGrid(g, c, footTop - kH - 10, [hero, ...m.stats.filter(s => s[0] !== hero[0]).slice(0, 2)], kH, story);
    return cv;
  }
  function slideTrace(m, fmt){
    const story = fmt === 'story', { cv, g, c, H } = canvas(FMT[fmt].h, 'clear');
    let y = story ? 150 : 96; header(g, c, y, m);
    y += story ? 130 : 96; y = titleBlock(g, c, y, m.title, story ? 92 : 76) + 50;
    const footTop = footer(g, c, H, story), statsH = story ? 200 : 160;
    const box = { x: P + 20, y, w: W - 2 * P - 40, h: footTop - y - statsH - 40 };
    const { lat, lon } = m.track, rad = Math.PI / 180;
    const ok = lat.map((v, i) => v != null && lon[i] != null);
    const px = lon.map(v => (v || 0) * rad), py = lat.map(v => -Math.log(Math.tan(Math.PI / 4 + (v || 0) * rad / 2)));
    const PX = px.filter((_, i) => ok[i]), PY = py.filter((_, i) => ok[i]);
    const x0 = Math.min(...PX), x1 = Math.max(...PX), y0 = Math.min(...PY), y1 = Math.max(...PY);
    const k = Math.min(box.w / (x1 - x0 || 1e-6), box.h / (y1 - y0 || 1e-6)), ox = box.x + (box.w - (x1 - x0) * k) / 2, oy = box.y + (box.h - (y1 - y0) * k) / 2;
    const X = i => ox + (px[i] - x0) * k, Y = i => oy + (py[i] - y0) * k;
    const path = new Path2D(); let s = false; lat.forEach((_, i) => { if (!ok[i]) return; s ? path.lineTo(X(i), Y(i)) : (path.moveTo(X(i), Y(i)), s = true); });
    g.save(); g.lineJoin = g.lineCap = 'round';
    g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 24; g.lineWidth = 18; g.strokeStyle = 'rgba(0,0,0,.25)'; g.stroke(path);
    g.shadowColor = '#a66af2'; g.shadowBlur = 30; g.lineWidth = 11; g.strokeStyle = iriH(g, box.x, box.x + box.w); g.stroke(path); g.restore();
    const first = ok.indexOf(true), last = ok.lastIndexOf(true);
    const dot = (i, col) => noShadow(g, () => { g.beginPath(); g.arc(X(i), Y(i), 16, 0, Math.PI * 2); g.fillStyle = col; g.fill(); g.lineWidth = 6; g.strokeStyle = '#fff'; g.stroke(); });
    dot(last, '#ff9a52'); dot(first, '#3ecf8e');
    const st = [[m.hero[2], m.hero[0] + (m.hero[1] ? ' ' + m.hero[1] : '')], ...m.stats.filter(x => ['Durée', 'D+', 'Vitesse', 'NP'].includes(x[0]))].slice(0, 3);
    statGrid(g, c, footTop - statsH, st, story ? 160 : 130, story, false);
    return cv;
  }
  function slideEfforts(m, fmt, sty){
    const story = fmt === 'story', { cv, g, c, H } = canvas(FMT[fmt].h, sty);
    let y = story ? 150 : 96; header(g, c, y, m);
    y += story ? 150 : 110; g.font = BC(900, fitFont(g, 'MEILLEURS EFFORTS', W - 2 * P, story ? 120 : 96, 60, s => BC(900, s, true)), true); g.fillStyle = iriH(g, P, W - P); g.fillText('MEILLEURS EFFORTS', P, y);
    y += story ? 56 : 46; g.font = IN(500, 30); g.fillStyle = c.MU; g.fillText(m.title, P, y);
    const footTop = footer(g, c, H, story);
    // courbe de puissance (échelle log) : la séance vs tes records d'avant
    const E = m.efforts, chartH = story ? 560 : 360, cy = y + (story ? 90 : 64), L = P + 70, R = W - P - 20, top = cy + 30, bot = cy + chartH - 44;
    const lx = s => Math.log(s), X = s => L + (lx(s) - lx(5)) / (lx(3600) - lx(5)) * (R - L);
    const prevE = E.filter(e => e.prev > 0);
    const vals = E.map(e => e.v).concat(prevE.map(e => e.prev)), lo = Math.min(...vals) * 0.85, hi = Math.max(...vals) * 1.12;
    const Y = v => bot - (Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo)) * (bot - top);
    g.font = IN(500, 22);
    for (const v of [150, 200, 250, 300, 400, 500, 600, 800, 1000, 1200].filter(v => v > lo && v < hi)) { noShadow(g, () => { g.strokeStyle = c.GRID; g.lineWidth = 2; g.beginPath(); g.moveTo(L, Y(v)); g.lineTo(R, Y(v)); g.stroke(); }); g.fillStyle = c.MU; g.textAlign = 'right'; g.fillText(v, L - 12, Y(v) + 8); g.textAlign = 'left'; }
    let lastX = -1e9; for (const e of E) { if (X(e.s) - lastX < 90) continue; lastX = X(e.s); g.fillStyle = c.MU; g.textAlign = 'center'; g.fillText(e.l, X(e.s), bot + 38); g.textAlign = 'left'; }
    if (prevE.length >= 2) noShadow(g, () => { g.setLineDash([12, 10]); g.lineWidth = 4; g.strokeStyle = c.MU; const p = new Path2D(); prevE.forEach((e, i) => i ? p.lineTo(X(e.s), Y(e.prev)) : p.moveTo(X(e.s), Y(e.prev))); g.stroke(p); });
    const p = new Path2D(); E.forEach((e, i) => i ? p.lineTo(X(e.s), Y(e.v)) : p.moveTo(X(e.s), Y(e.v)));
    g.save(); g.lineWidth = 7; g.lineJoin = g.lineCap = 'round'; g.strokeStyle = iriH(g, L, R); g.stroke(p); g.restore();
    E.forEach(e => noShadow(g, () => { g.beginPath(); g.arc(X(e.s), Y(e.v), e.rec ? 13 : 9, 0, Math.PI * 2); g.fillStyle = e.rec ? '#ffb02e' : (c.light ? '#16181d' : '#fff'); g.fill(); }));
    g.font = IN(600, 22); spacing(g, 2); let lgx = P;
    const lg = (t, dash) => { const x = lgx; noShadow(g, () => { g.lineWidth = dash ? 4 : 6; g.lineCap = 'round'; if (dash) g.setLineDash([8, 7]); g.strokeStyle = dash ? c.MU : iriH(g, x, x + 34); g.beginPath(); g.moveTo(x, cy - 14); g.lineTo(x + 34, cy - 14); g.stroke(); }); g.fillStyle = c.MU; g.fillText(t, x + 46, cy - 6); lgx += 46 + g.measureText(t).width + 34; };
    lg('CETTE SÉANCE', false); if (prevE.length >= 2) lg('RECORDS AVANT', true); spacing(g, 0);
    // tableau des efforts
    let ry = cy + chartH + (story ? 40 : 16); const rowH = Math.min(story ? 104 : 74, (footTop - ry) / E.length);
    for (const e of E) {
      noShadow(g, () => { g.strokeStyle = c.LINE; g.lineWidth = 2; g.beginPath(); g.moveTo(P, ry + rowH); g.lineTo(W - P, ry + rowH); g.stroke(); });
      const fs = Math.min(64, rowH * 0.62);
      g.font = IN(600, fs * 0.5); g.fillStyle = c.MU; g.fillText(e.l, P, ry + rowH * 0.64);
      g.font = BC(700, fs); g.fillStyle = c.TX; const t = `${e.v} W`; g.fillText(t, P + 200, ry + rowH * 0.7);
      const xx = P + 200 + g.measureText(t).width + 18;
      if (m.wkg) { g.font = BC(600, fs * 0.55); g.fillStyle = c.MU; g.fillText(`${(e.v / m.wkg).toFixed(1).replace('.', ',')} W/kg`, xx, ry + rowH * 0.7); }
      if (e.rec) { g.font = IN(700, fs * 0.4); const bt = 'RECORD', bw = g.measureText(bt).width + 32; noShadow(g, () => { rr(g, W - P - bw, ry + rowH * 0.5 - fs * 0.36, bw, fs * 0.72, fs * 0.36); g.fillStyle = '#ffb02e'; g.fill(); }); g.fillStyle = '#16181d'; g.fillText(bt, W - P - bw + 16, ry + rowH * 0.5 + fs * 0.14); }
      else if (e.prev) { g.font = IN(500, fs * 0.4); g.fillStyle = c.MU; g.textAlign = 'right'; g.fillText(`record ${e.prev} W`, W - P, ry + rowH * 0.66); g.textAlign = 'left'; }
      ry += rowH;
    }
    return cv;
  }
  function slideStats(m, fmt){
    const story = fmt === 'story', { cv, g, c, H } = canvas(FMT[fmt].h, 'clear');
    header(g, c, story ? 150 : 96, m);
    // le bas de l'image : la photo respire en haut
    const footTop = footer(g, c, H, story), chH = story ? 150 : 116, rows = Math.ceil(m.stats.length / 3);
    const gy = footTop - rows * (chH + 20) + 10;
    statGrid(g, c, gy, m.stats, chH, story, false);
    const [hv, hu, hl] = m.hero, hsz = story ? 210 : 150;
    let y = gy - (story ? 40 : 26);
    g.font = IN(600, 28); spacing(g, 4); g.fillStyle = c.TX; g.fillText(hl.toUpperCase(), P, y); spacing(g, 0);
    y -= hv.includes(',') ? hsz * 0.24 + 30 : (story ? 50 : 40); g.font = BC(800, hsz); const hw = g.measureText(hv).width; g.fillStyle = iriH(g, P, P + hw); g.fillText(hv, P - 6, y);
    if (hu) { g.font = BC(700, hsz * 0.34); g.fillStyle = c.TX; g.fillText(hu, P + hw + 12, y); }
    y -= hsz * 0.82 + 20; titleBlock(g, c, y, m.title, story ? 84 : 66, 2, true);
    return cv;
  }
  const DRAW = { resume: slideResume, courbe: slideCourbe, trace: slideTrace, efforts: slideEfforts, stats: slideStats };
  const draw = (m, slide, fmt, sty) => DRAW[slide](m, fmt, sty);

  async function build(a){
    await fontsReady();
    const m = await model(a), out = [];
    for (const k of slidesOf(m)) {
      const cv = draw(m, k, opt.fmt, opt.sty);
      const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
      out.push({ k, blob, file: new File([blob], `ftp-builder-${a.date}-${out.length + 1}-${k}.png`, { type: 'image/png' }), w: cv.width, h: cv.height });
    }
    return out;
  }

  /* ---------- fenêtre de partage ---------- */
  function open(id){
    const a = S.activities.find(x => x.id === id); if (!a) return;
    const seg = (k, o) => `<div class="seg" data-shr="${k}">${Object.entries(o).map(([v, l]) => `<button type="button" data-v="${v}" class="${opt[k] === v ? 'on' : ''}">${typeof l === 'string' ? l : l.label}</button>`).join('')}</div>`;
    const strava = a.stravaId ? `https://www.strava.com/activities/${a.stravaId}` : null;
    openDlg(`<h2>Partager la séance</h2>
      <p class="tiny muted" style="margin:4px 0 10px">Carrousel d'images HD 1080 px. Touche une image pour l'inclure ou l'enlever.</p>
      <div class="grid2"><div><label class="f">Format</label>${seg('fmt', FMT)}</div><div><label class="f">Fond</label>${seg('sty', STY)}</div></div>
      <div class="shr-car" id="shrCar"><div class="tiny muted" style="padding:30px 0">Préparation des images…</div></div>
      <p class="tiny muted" style="margin:8px 0 0">« Tracé » et « Stats » sont sur fond transparent : à poser sur ta photo (Instagram › sticker photo). Plusieurs images partagées d'un coup = un carrousel Instagram. Strava : choisis-le dans la liste du partage s'il y apparaît, sinon « Enregistrer » puis ajoute les photos à ton activité${strava ? ' (bouton « Ouvrir dans Strava »)' : ''}.</p>
      <div class="row" style="margin-top:12px;gap:8px;flex-wrap:wrap"><button class="btn primary" id="shrGo" disabled>📤 Partager</button><button class="btn" id="shrSave" disabled>Enregistrer</button>${strava ? `<a class="btn" id="shrStrava" href="${strava}" target="_blank" rel="noopener" style="text-decoration:none;color:#fc4c02;border-color:#fc4c02">Ouvrir dans Strava</a>` : ''}<button class="btn ghost" id="shrBack">Retour</button></div>`);
    const sel = () => cur.filter(x => !opt.off.includes(x.k));
    const canShare = f => !!(f.length && navigator.canShare && navigator.canShare({ files: f }));
    const sync = () => {
      const s = sel(), n = s.length;
      $('#shrGo').textContent = `📤 Partager${n > 1 ? ` (${n})` : ''}`; $('#shrSave').textContent = n > 1 ? `Enregistrer (${n})` : 'Enregistrer';
      $('#shrGo').disabled = $('#shrSave').disabled = !n;
      $('#shrGo').classList.toggle('hidden', n > 0 && !canShare(s.map(x => x.file)));
      document.querySelectorAll('#shrCar .shr-it').forEach(el => el.classList.toggle('off', opt.off.includes(el.dataset.k)));
    };
    const refresh = async () => {
      const my = ++seq; $('#shrGo').disabled = $('#shrSave').disabled = true;
      const r = await build(a); if (my !== seq || !$('#shrCar')) return;
      cur = r; urls.forEach(u => URL.revokeObjectURL(u)); urls = r.map(x => URL.createObjectURL(x.blob));
      $('#shrCar').innerHTML = r.map((x, i) => `<button type="button" class="shr-it ${['trace', 'stats'].includes(x.k) ? 'chk' : ''}" data-k="${x.k}"><img src="${urls[i]}" alt="${SLIDES[x.k]}" width="${x.w}" height="${x.h}"><span>${i + 1}. ${SLIDES[x.k]}</span><i></i></button>`).join('');
      $('#shrCar').querySelectorAll('.shr-it').forEach(b => b.onclick = () => { const k = b.dataset.k; opt.off = opt.off.includes(k) ? opt.off.filter(x => x !== k) : [...opt.off, k]; keep(); sync(); });
      sync();
    };
    dlgBody.querySelectorAll('.seg[data-shr]').forEach(sg => sg.querySelectorAll('button').forEach(b => b.onclick = () => {
      opt[sg.dataset.shr] = b.dataset.v; keep(); sg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); refresh();
    }));
    // le partage part directement du geste (images déjà prêtes) : exigé par Safari
    $('#shrGo').onclick = () => { const f = sel().map(x => x.file); if (!f.length) return; navigator.share({ files: f }).catch(e => { if (e?.name !== 'AbortError') toast('Partage impossible : enregistre les images'); }); };
    $('#shrSave').onclick = () => {
      const s = sel(); if (!s.length) return;
      // iPhone : un lien de téléchargement ouvre l'image dans un onglet ; la feuille de partage propose « Enregistrer N images » dans Photos
      if (/iPhone|iPad|iPod/.test(navigator.userAgent) && canShare(s.map(x => x.file))) { navigator.share({ files: s.map(x => x.file) }).catch(() => {}); return; }
      s.forEach((x, i) => setTimeout(() => { const l = document.createElement('a'); l.href = urls[cur.indexOf(x)]; l.download = x.file.name; document.body.appendChild(l); l.click(); l.remove(); }, i * 250));
      toast(s.length > 1 ? `${s.length} images enregistrées` : 'Image enregistrée');
    };
    $('#shrBack').onclick = () => activityDlg(a.id);
    refresh();
  }
  return { open, draw, model, slidesOf };
})();
