"use strict";
// FTP Builder · visuel de partage d'une séance (Instagram, Strava…) : image nette dessinée en 1080 px, pas une capture d'écran
const Share = (() => {
  const FMT = { story: { h: 1920, label: 'Story 9:16' }, post: { h: 1350, label: 'Post 4:5' } };
  const STY = { dark: 'Sombre', light: 'Clair', clear: 'Transparent' };
  const IRI = ['#7cc3ff', '#a66af2', '#e05ad0', '#ff9a52'];
  const W = 1080, P = 84;
  let opt = { fmt: 'story', sty: 'dark' }, cur = null, url = null, seq = 0;
  try { Object.assign(opt, JSON.parse(localStorage.getItem('ftpb_share') || '{}')); } catch {}

  const fontsReady = () => Promise.race([
    Promise.all(['italic 900 100px "Barlow Condensed"', '800 100px "Barlow Condensed"', '700 100px "Barlow Condensed"', '600 40px Inter', '500 40px Inter'].map(f => document.fonts?.load(f).catch(() => {}))),
    new Promise(r => setTimeout(r, 1500))]);
  const BC = (w, sz, it) => `${it ? 'italic ' : ''}${w} ${sz}px "Barlow Condensed","Arial Narrow",system-ui,sans-serif`;
  const IN = (w, sz) => `${w} ${sz}px Inter,system-ui,sans-serif`;
  const spacing = (g, px) => { if ('letterSpacing' in g) g.letterSpacing = px + 'px'; };
  const iriH = (g, x0, x1) => { const gr = g.createLinearGradient(x0, 0, x1, 0); IRI.forEach((c, i) => gr.addColorStop(i / (IRI.length - 1), c)); return gr; };
  const fitFont = (g, txt, w, sz, min, make) => { for (; sz > min; sz -= 4) { g.font = make(sz); if (g.measureText(txt).width <= w) break; } return sz; };
  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); };

  // données de la séance → ce qu'on affiche
  function model(a){
    const pl = a.planId ? S.plan.find(s => s.id === a.planId) : null;
    const indoor = isIndoor(a), d = parseD(a.date);
    const title = (pl ? WORKOUTS[pl.workoutId]?.name : null) || a.name || 'Séance';
    const date = `${DOW[dowMon(a.date)]}. ${d.getDate()} ${MONTHS[d.getMonth()]}`;
    const km = v => String(Math.round(v * 10) / 10).replace('.', ',');
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
    const recs = a.best ? [['5 s', a.best.s5], ['1 min', a.best.m1], ['5 min', a.best.m5], ['20 min', a.best.m20]].filter(x => x[1]) : [];
    const e = pl ? sessionEval(a, pl) : null;
    const badge = e && !e.pending && e.lvl === 0 ? e.title : null;
    // courbe : puissance lissée 30 s (+ cible + FC), sinon altitude, sinon FC
    let ch = null;
    const n = (a.pwSample || a.hrSample || a.altSample || []).length, secs = a.sampleSecs || a.durationS || n;
    if (n > 10) {
      const sm = (arr, s) => { const w = Math.max(1, Math.round(s / (secs / n))), out = []; let t = 0; for (let i = 0; i < arr.length; i++) { t += arr[i] || 0; if (i >= w) t -= arr[i - w] || 0; out.push(t / Math.min(i + 1, w)); } return out; };
      if (a.pwSample) ch = { main: sm(a.pwSample, 30), kind: 'pw', tgt: pl ? ActChart.target(pl, secs, n) : null, hr: a.hrSample ? sm(a.hrSample, 10) : null };
      else if (a.altSample) ch = { main: a.altSample, kind: 'alt', hr: a.hrSample ? sm(a.hrSample, 10) : null };
      else if (a.hrSample) ch = { main: sm(a.hrSample, 10), kind: 'hr' };
      if (ch) ch.mins = Math.round(secs / 60);
    }
    // progression du programme : n-ième séance comptée sur l'objectif de séances
    let prog = null;
    if ((a.planId || a.countAsSession) && S.profile?.minSessions) {
      const done = S.activities.filter(x => x.planId || x.countAsSession).sort((x, y) => x.date.localeCompare(y.date) || String(x.id).localeCompare(String(y.id)));
      const i = done.findIndex(x => x.id === a.id);
      if (i >= 0) prog = { i: i + 1, n: Math.max(S.profile.minSessions, i + 1), goal: S.profile.goalFtp };
    }
    return { title, date, indoor, hero, stats, recs, badge, ch, prog };
  }

  function draw(a, fmt, sty){
    const H = FMT[fmt].h, m = model(a), story = fmt === 'story';
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
    const clear = sty === 'clear', light = sty === 'light';
    const TX = light ? '#16181d' : '#ffffff', MU = light ? '#666c78' : clear ? 'rgba(255,255,255,.82)' : '#9aa1b0', LINE = light ? '#e1dfda' : clear ? 'rgba(255,255,255,.35)' : '#2a2f3b';
    const CARD = light ? '#ffffff' : '#1c2029';
    // fond
    if (!clear) {
      g.fillStyle = light ? '#f5f4f1' : '#0f1115'; g.fillRect(0, 0, W, H);
      const glow = (x, y, r, c, al) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, c); gr.addColorStop(1, 'transparent'); g.globalAlpha = al; g.fillStyle = gr; g.fillRect(0, 0, W, H); g.globalAlpha = 1; };
      glow(W * 0.95, H * 0.04, W * 0.8, '#a66af2', light ? 0.16 : 0.32); glow(W * 0.02, H * 0.55, W * 0.7, '#ff9a52', light ? 0.12 : 0.18); glow(W * 0.6, H * 1.02, W * 0.8, '#7cc3ff', light ? 0.14 : 0.2);
    }
    if (clear) { g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 18; }
    let y = story ? 150 : 96;
    // marque
    const L = 64; g.save(); g.translate(P, y - 48); g.scale(L / 512, L / 512);
    g.shadowBlur = 0; rr(g, 0, 0, 512, 512, 112); g.fillStyle = '#0f1115'; g.fill(); if (!light && !clear) { g.lineWidth = 10; g.strokeStyle = '#2a2f3b'; g.stroke(); }
    g.beginPath(); g.moveTo(96, 360); g.lineTo(176, 280); g.lineTo(240, 320); g.lineTo(336, 200); g.lineTo(416, 152); g.lineWidth = 40; g.lineCap = g.lineJoin = 'round'; g.strokeStyle = '#ff6a2b'; g.stroke();
    g.beginPath(); g.arc(416, 152, 28, 0, Math.PI * 2); g.fillStyle = '#ffb02e'; g.fill(); g.restore();
    if (clear) g.shadowBlur = 18;
    g.font = BC(800, 44); spacing(g, 3); g.fillStyle = TX; g.textBaseline = 'alphabetic'; g.fillText('FTP BUILDER', P + L + 22, y);
    g.font = IN(500, 32); spacing(g, 0); g.fillStyle = MU; g.textAlign = 'right'; g.fillText(m.date, W - P, y); g.textAlign = 'left';
    y += story ? 120 : 84;
    // type de séance
    const tag = m.indoor ? 'HOME TRAINER' : 'SORTIE VÉLO'; g.font = IN(600, 28); spacing(g, 3);
    const tw = g.measureText(tag).width + 48; rr(g, P, y - 46, tw, 64, 32); g.fillStyle = m.indoor ? '#ff8a4c' : '#3b82f6'; g.fill();
    g.fillStyle = '#fff'; g.fillText(tag, P + 24, y - 3); spacing(g, 0);
    if (m.badge) { g.font = IN(600, 28); const bt = '✓ ' + m.badge, bw = g.measureText(bt).width + 48, bx = P + tw + 16;
      if (bx + bw <= W - P) { rr(g, bx, y - 46, bw, 64, 32); g.fillStyle = light ? '#e3f7ee' : 'rgba(62,207,142,.18)'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#3ecf8e'; g.stroke(); g.fillStyle = light ? '#138a57' : '#3ecf8e'; g.fillText(bt, bx + 24, y - 3); } }
    y += story ? 140 : 110;
    // titre (2 lignes max, taille ajustée)
    const T = m.title.toUpperCase().replace(/ ([×x/]) /g, '\u00a0$1\u00a0').replace(/(\d) (MIN|S|KM|H|W)\b/g, '$1\u00a0$2'), maxW = W - 2 * P;
    let tsz = story ? 120 : 88, lines;
    for (; tsz >= 64; tsz -= 6) {
      g.font = BC(900, tsz, true); const words = T.split(' '); lines = ['']; for (const w of words) { const t = (lines[lines.length - 1] + ' ' + w).trim(); if (g.measureText(t).width <= maxW || !lines[lines.length - 1]) lines[lines.length - 1] = t; else lines.push(w); }
      if (lines.length <= 2 && lines.every(l => g.measureText(l).width <= maxW)) break;
    }
    g.fillStyle = iriH(g, P, W - P); lines.slice(0, 2).forEach((l, i) => g.fillText(l, P, y + i * tsz * 0.95));
    y += (Math.min(2, lines.length) - 1) * tsz * 0.95 + (story ? 50 : 40);
    // chiffre héros
    const [hv, hu, hl] = m.hero, hsz = story ? 236 : 170;
    y += hsz * 0.78;
    g.font = BC(800, hsz); const hw = g.measureText(hv).width; g.fillStyle = iriH(g, P, P + hw); g.fillText(hv, P - 6, y);
    if (hu) { g.font = BC(700, hsz * 0.34); g.fillStyle = TX; g.fillText(hu, P + hw + 12, y); }
    y += hv.includes(',') ? hsz * 0.24 + 28 : (story ? 60 : 50); g.font = IN(600, 30); spacing(g, 4); g.fillStyle = MU; g.fillText(hl.toUpperCase(), P, y); spacing(g, 0);
    y += story ? 56 : 40;
    // indicateurs (grille de 3)
    const cols = 3, gap = 20, cw = (W - 2 * P - gap * (cols - 1)) / cols, chH = story ? 146 : 112;
    m.stats.forEach(([l, v], i) => {
      const cx = P + (i % cols) * (cw + gap), cy = y + Math.floor(i / cols) * (chH + gap);
      if (!clear) { rr(g, cx, cy, cw, chH, 28); g.fillStyle = CARD; g.globalAlpha = light ? 1 : 0.85; g.fill(); g.globalAlpha = 1; g.lineWidth = 2; g.strokeStyle = LINE; g.stroke(); }
      else { g.save(); g.shadowBlur = 0; rr(g, cx, cy, cw, chH, 28); g.fillStyle = 'rgba(0,0,0,.28)'; g.fill(); g.restore(); }
      const [num, ...u] = v.split(' ');
      const vs = fitFont(g, v, cw - 52, story ? 76 : 58, 36, s => BC(700, s));
      const vy = cy + (story ? chH * 0.52 : chH * 0.5); g.font = BC(700, vs); g.fillStyle = TX; g.fillText(num, cx + 26, vy);
      if (u.length) { const nw = g.measureText(num).width; g.font = BC(600, vs * 0.5); g.fillStyle = MU; g.fillText(u.join(' '), cx + 26 + nw + 8, vy); }
      g.font = IN(600, story ? 24 : 21); spacing(g, 3); g.fillStyle = MU; g.fillText(l.toUpperCase(), cx + 26, cy + chH - (story ? 30 : 22)); spacing(g, 0);
    });
    y += Math.ceil(m.stats.length / cols) * (chH + gap) + (story ? 40 : 22);
    // pied : progression du programme
    const footH = m.prog ? (story ? 250 : 180) : (story ? 140 : 90);
    let recH = m.recs.length ? (story ? 124 : 104) : 0;
    // courbe : toute la hauteur restante (on sacrifie les records si elle devient trop basse)
    let chartH = H - y - footH - recH - (story ? 70 : 40);
    if (m.ch && recH && chartH < (story ? 190 : 260) && chartH + recH >= 150) { m.recs = []; chartH += recH; recH = 0; }
    if (m.ch && chartH > 140) { drawChart(g, m.ch, P, y, W - 2 * P, chartH, { TX, MU, LINE, light, clear }); y += chartH + (story ? 34 : 20); }
    // meilleurs efforts : 4 pastilles réparties sur la largeur
    if (m.recs.length) {
      const ph = story ? 68 : 58, gp = 14, pw = (W - 2 * P - gp * (m.recs.length - 1)) / m.recs.length;
      g.font = IN(600, 24); spacing(g, 3); g.fillStyle = MU; g.fillText('MEILLEURS EFFORTS', P, y + 20); spacing(g, 0);
      const py = y + 40;
      m.recs.forEach(([l, v], i) => {
        const x = P + i * (pw + gp); rr(g, x, py, pw, ph, ph / 2); g.lineWidth = 2; g.strokeStyle = LINE; g.stroke(); if (clear) { g.save(); g.shadowBlur = 0; g.fillStyle = 'rgba(0,0,0,.28)'; g.fill(); g.restore(); }
        g.font = BC(700, 34); const vw = g.measureText(v + ' W').width; g.font = IN(500, 22); const lw = g.measureText(l).width, x0 = x + (pw - vw - lw - 10) / 2;
        g.font = BC(700, 34); g.fillStyle = TX; g.fillText(v + ' W', x0, py + ph * 0.65); g.font = IN(500, 22); g.fillStyle = MU; g.fillText(l, x0 + vw + 10, py + ph * 0.63);
      });
      y += recH;
    }
    // pied
    const fy = H - (story ? 110 : 64);
    if (m.prog) {
      const { i, n, goal } = m.prog, bw = W - 2 * P, by = fy - 58;
      g.font = BC(700, 40); g.fillStyle = TX; g.fillText(`Séance ${i} / ${n}`, P, by - 22);
      if (goal) { g.font = IN(500, 28); g.fillStyle = MU; g.textAlign = 'right'; g.fillText(`objectif FTP ${goal} W`, W - P, by - 24); g.textAlign = 'left'; }
      g.save(); g.shadowBlur = 0; rr(g, P, by, bw, 14, 7); g.fillStyle = light ? '#e1dfda' : 'rgba(255,255,255,.14)'; g.fill();
      rr(g, P, by, Math.max(14, bw * Math.min(1, i / n)), 14, 7); g.fillStyle = iriH(g, P, P + bw); g.fill(); g.restore();
    }
    g.font = IN(500, 26); g.fillStyle = MU; spacing(g, 1); g.fillText('Construit avec FTP Builder', P, fy + 30); spacing(g, 0);
    const host = /^https?:/.test(location.protocol) ? (location.host + location.pathname).replace(/index\.html$/, '').replace(/\/$/, '') : 'ftpbuilder.github.io/ftp-builder';
    g.textAlign = 'right'; g.fillText(host, W - P, fy + 30); g.textAlign = 'left';
    return cv;
  }

  function drawChart(g, ch, x, y, w, h, c){
    const N = Math.min(ch.main.length, 540), step = ch.main.length / N;
    const res = arr => arr ? Array.from({ length: N }, (_, i) => { const s = Math.floor(i * step), e = Math.max(s + 1, Math.floor((i + 1) * step)); let t = 0, k = 0; for (let j = s; j < e; j++) if (arr[j] != null) { t += arr[j]; k++; } return k ? t / k : null; }) : null;
    const main = res(ch.main), tgt = res(ch.tgt), hr = res(ch.hr);
    const vals = main.filter(v => v != null).concat(tgt ? tgt.filter(v => v != null) : []);
    const lo = ch.kind === 'alt' ? Math.min(...vals) - 10 : 0, hi = Math.max(...vals) * 1.08 || 1;
    const top = y + 44, bot = y + h - 40, ih = bot - top;
    const X = i => x + i / (N - 1) * w, Y = v => bot - (v - lo) / (hi - lo) * ih;
    // légende
    g.font = IN(600, 24); 'letterSpacing' in g && (g.letterSpacing = '3px'); g.fillStyle = c.MU;
    const leg = [[{ pw: 'PUISSANCE 30 S', alt: 'ALTITUDE', hr: 'FC' }[ch.kind], 'iri']]; if (tgt) leg.push(['CIBLE', 'tgt']); if (hr && ch.kind !== 'hr') leg.push(['FC', 'hr']);
    let lx = x; for (const [t, k] of leg) {
      g.save(); g.shadowBlur = 0; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(lx, y + 12); g.lineTo(lx + 34, y + 12);
      g.strokeStyle = k === 'iri' ? iriH(g, lx, lx + 34) : k === 'tgt' ? c.TX : '#ff4d5e'; if (k === 'tgt') { g.setLineDash([8, 7]); g.lineWidth = 4; g.globalAlpha = 0.7; } g.stroke(); g.restore();
      g.fillText(t, lx + 46, y + 21); lx += 46 + g.measureText(t).width + 34;
    }
    'letterSpacing' in g && (g.letterSpacing = '0px');
    // aire en dégradé, sur un calque à part (fondu vers le bas, y compris en transparent)
    const off = document.createElement('canvas'); off.width = Math.ceil(x + w + 10); off.height = Math.ceil(bot + 10); const o = off.getContext('2d');
    const path = new Path2D(); let started = false;
    main.forEach((v, i) => { if (v == null) return; started ? path.lineTo(X(i), Y(v)) : (path.moveTo(X(i), Y(v)), started = true); });
    const area = new Path2D(path); area.lineTo(X(N - 1), bot); area.lineTo(X(0), bot); area.closePath();
    o.fillStyle = iriH(o, x, x + w); o.globalAlpha = c.light ? 0.4 : 0.5; o.fill(area); o.globalAlpha = 1;
    o.globalCompositeOperation = 'destination-out'; const fade = o.createLinearGradient(0, top, 0, bot); fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,.92)'); o.fillStyle = fade; o.fillRect(x, top - 20, w, ih + 30);
    o.globalCompositeOperation = 'source-over'; o.lineWidth = 6; o.lineJoin = 'round'; o.lineCap = 'round'; o.strokeStyle = iriH(o, x, x + w); o.stroke(path);
    // FC : sa propre échelle, ligne fine
    if (hr) { const hv = hr.filter(v => v != null), hl = Math.min(...hv) * 0.92, hh = Math.max(...hv) * 1.04; o.beginPath(); let s = false;
      hr.forEach((v, i) => { if (v == null) return; const yy = bot - (v - hl) / (hh - hl) * ih * 0.9; s ? o.lineTo(X(i), yy) : (o.moveTo(X(i), yy), s = true); });
      o.lineWidth = 3; o.strokeStyle = '#ff4d5e'; o.globalAlpha = 0.8; o.stroke(); o.globalAlpha = 1; }
    // cible prévue en pointillés
    if (tgt) { o.beginPath(); let s = false; tgt.forEach((v, i) => { if (v == null) { s = false; return; } s ? o.lineTo(X(i), Y(v)) : (o.moveTo(X(i), Y(v)), s = true); });
      o.setLineDash([12, 10]); o.lineWidth = 3.5; o.strokeStyle = c.TX; o.globalAlpha = 0.6; o.stroke(); o.setLineDash([]); o.globalAlpha = 1; }
    g.save(); if (c.clear) { g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 14; } else g.shadowBlur = 0; g.drawImage(off, 0, 0); g.restore();
    // axe du temps
    g.save(); g.shadowBlur = 0; g.lineWidth = 2; g.strokeStyle = c.LINE; g.beginPath(); g.moveTo(x, bot + 1); g.lineTo(x + w, bot + 1); g.stroke(); g.restore();
    g.font = IN(500, 24); g.fillStyle = c.MU; g.fillText("0'", x, bot + 34);
    if (ch.mins) { const t = ch.mins >= 60 ? `${Math.floor(ch.mins / 60)}h${String(ch.mins % 60).padStart(2, '0')}` : ch.mins + "'"; g.textAlign = 'right'; g.fillText(t, x + w, bot + 34); g.textAlign = 'left'; }
  }

  async function build(a){
    await fontsReady();
    const cv = draw(a, opt.fmt, opt.sty);
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    const file = new File([blob], `ftp-builder-${a.date}-${opt.fmt}.png`, { type: 'image/png' });
    return { blob, file, w: cv.width, h: cv.height };
  }

  function open(id){
    const a = S.activities.find(x => x.id === id); if (!a) return;
    const seg = (k, o) => `<div class="seg" data-shr="${k}">${Object.entries(o).map(([v, l]) => `<button type="button" data-v="${v}" class="${opt[k] === v ? 'on' : ''}">${typeof l === 'string' ? l : l.label}</button>`).join('')}</div>`;
    openDlg(`<h2>Partager la séance</h2>
      <p class="tiny muted" style="margin:4px 0 10px">Image HD 1080 px, prête pour Instagram ou Strava.</p>
      <label class="f">Format</label>${seg('fmt', FMT)}
      <label class="f">Style</label>${seg('sty', STY)}
      <div class="shr-prev ${opt.sty === 'clear' ? 'chk' : ''}" id="shrPrev"><div class="tiny muted">Préparation de l'image…</div></div>
      <p class="tiny muted" id="shrHint" style="margin:8px 0 0">${opt.sty === 'clear' ? 'Fond transparent : à poser sur ta photo en Story Instagram (Ajouter un sticker › photo) ou à superposer dans ton app photo.' : 'Instagram : choisis « Story » ou « Publication ». Strava : enregistre l\'image puis ajoute-la comme photo de ton activité.'}</p>
      <div class="row" style="margin-top:12px;gap:8px"><button class="btn primary" id="shrGo" disabled>📤 Partager</button><button class="btn" id="shrSave" disabled>Enregistrer l'image</button><button class="btn ghost" id="shrBack">Retour</button></div>`);
    const refresh = async () => {
      const my = ++seq; $('#shrGo').disabled = $('#shrSave').disabled = true;
      const r = await build(a); if (my !== seq || !$('#shrPrev')) return;
      cur = r; if (url) URL.revokeObjectURL(url); url = URL.createObjectURL(r.blob);
      const box = $('#shrPrev'); box.classList.toggle('chk', opt.sty === 'clear');
      box.innerHTML = `<img src="${url}" alt="Aperçu du visuel de la séance" width="${r.w}" height="${r.h}">`;
      $('#shrGo').disabled = $('#shrSave').disabled = false;
      $('#shrGo').classList.toggle('hidden', !(navigator.canShare && navigator.canShare({ files: [r.file] })));
    };
    dlgBody.querySelectorAll('.seg[data-shr]').forEach(sg => sg.querySelectorAll('button').forEach(b => b.onclick = () => {
      opt[sg.dataset.shr] = b.dataset.v; try { localStorage.setItem('ftpb_share', JSON.stringify(opt)); } catch {}
      sg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      $('#shrHint').textContent = opt.sty === 'clear' ? 'Fond transparent : à poser sur ta photo en Story Instagram (Ajouter un sticker › photo) ou à superposer dans ton app photo.' : 'Instagram : choisis « Story » ou « Publication ». Strava : enregistre l\'image puis ajoute-la comme photo de ton activité.';
      refresh();
    }));
    // le partage part directement du geste (l'image est déjà prête) : exigé par Safari
    $('#shrGo').onclick = () => { if (!cur) return; navigator.share({ files: [cur.file] }).catch(e => { if (e?.name !== 'AbortError') toast('Partage impossible : enregistre l\'image'); }); };
    $('#shrSave').onclick = () => { if (!cur) return; const l = document.createElement('a'); l.href = url; l.download = cur.file.name; document.body.appendChild(l); l.click(); l.remove(); toast('Image enregistrée'); };
    $('#shrBack').onclick = () => activityDlg(a.id);
    refresh();
  }
  return { open, draw, model };
})();
