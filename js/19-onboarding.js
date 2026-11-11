"use strict";
// FTP Builder · visite guidée et guide de démarrage
/* ============ Visite guidée (une fois après l'authentification, puis Profil › Revoir la visite) ============ */
const Tour = (() => {
  let i = 0, open = false;
  const N = 10;
  const ic = (d, c = 'var(--accent)') => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const txt = (kicker, title, body, small) => `<div class="tr-txt">${kicker ? `<span class="tr-kick">${kicker}</span>` : ''}<h1>${title}</h1><p>${body}</p>${small ? `<p class="tr-small">${small}</p>` : ''}</div>`;
  const ex = '<span class="tr-ex">Exemple</span>';
  const f2 = v => v.toFixed(2).replace('.', ',');
  const fmtT = s => { s = Math.round(s); const h = Math.floor(s/3600), m = Math.floor(s%3600/60), x = s%60; return h ? `${h}h${pad(m)}` : `${m}'${pad(x)}`; };
  // programme : la 1re semaine réelle du plan si elle existe
  function weekRows(){
    const t = todayISO(), p = S.profile;
    const xs = (S.plan || []).filter(s => s.status === 'planned' && s.date >= t).slice(0, 3);
    if (!xs.length) return [['Mar', 'Seuil 3 × 10 min', 'Séance clé · 60 min', '248 W', 4], ['Jeu', 'VO2max 5 × 3 min', 'Séance clé · 55 min', '295 W', 5], ['Sam', 'Endurance longue', 'Optionnelle · 2 h', '165 W', 2]];
    return xs.map(s => { const W = WORKOUTS[s.workoutId], m = flat(W.steps).filter(x => (x.int || 'active') === 'active' && !x.max).sort((a, b) => b.d - a.d)[0], pct = m ? m.p : 65, test = W.type === 'test'; // bloc le plus long (pas les sprints)
      return [DOW[dowMon(s.date)], W.name, `${test ? 'Test' : mandatory(s) ? 'Séance clé' : 'Optionnelle'} · ${fmtDur(wDur(s.workoutId))}`, test ? 'jusqu’au bout' : `${Math.round(ftp()*pct/100)} W`, test ? 6 : zoneOf(pct)]; });
  }
  const S_ = [
    // 1 · bienvenue
    () => `<div class="tr-hero"><div class="tr-logo"><span style="color:var(--hy-rem)">FTP</span><span style="color:var(--accent)">·</span>BUILDER</div><div class="tr-sub">Ton coach vélo, natation et course</div></div>
      <div class="tr-grid">${[
        [ic('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>'), 'Objectif vélo', 'Ta FTP visée et ta date'],
        [ic('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'), 'Programme', 'Calé sur tes jours dispo'],
        [ic('<rect x="3" y="7" width="16" height="10" rx="2"/><path d="M21 11v2M6 10v4M9 10v4M12 10v4"/>', 'var(--ok)'), 'Énergie du jour', 'Adapte la séance'],
        [ic('<path d="M3 20h18M5 16l4-5 4 3 6-8"/>', 'var(--ok)'), 'Historique', 'Séances et progression'],
        [ic('<path d="M3 18l5-6 4 3 4-7 5 10"/><circle cx="8" cy="12" r="1.5"/>', 'var(--hy-rem)'), 'Tracés GPS 3D', 'Revis tes sorties'],
        [ic('<path d="M2 20l7-12 4 6 3-4 6 10z"/>', 'var(--hy-rem)'), 'Ascensions', 'Records et prédiction'],
        [ic('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>', 'var(--accent2)'), 'Course objectif', 'Triathlon, trail, cyclo'],
        [ic('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M10 2h4"/>', 'var(--accent2)'), 'Prédicteur de temps', 'Et tes objectifs']
      ].map(([g, t, d]) => `<div class="tr-card tr-feat">${g}<b>${t}</b><span>${d}</span></div>`).join('')}</div>
      <p class="tr-lead">En 2 minutes, on fait le tour de tout ce que l'app fait pour toi.</p>`,
    // 2 · objectif vélo (valeurs réelles du profil)
    () => { const p = S.profile, kg = +p.weightKg || 75, now = +p.ftp || ftp(), goal = +p.goalFtp || now + 30;
      return `<div class="tr-card"><div class="tr-h">Ton objectif</div>
        <div class="tr-g2"><div class="tr-f"><span>FTP actuelle</span><b class="num">${now} W</b></div><div class="tr-f on"><span>FTP visée</span><b class="num">${goal} W</b></div>
        <div class="tr-f"><span>Test final</span><b>${p.goalDate ? fmtShort(p.goalDate) : '—'}</b></div><div class="tr-f"><span>Poids</span><b class="num">${kg} kg</b></div></div>
        <div class="tr-wkg"><div><b>${f2(now/kg)}</b><span>W/kg aujourd'hui</span></div>${ic('<path d="M3 12h16M14 6l6 6-6 6"/>')}<div><b style="color:var(--accent)">${f2(goal/kg)}</b><span>W/kg visés</span></div></div>
        ${goalCheckText(p)}</div>` + txt('Étape 1 · Ton cap', 'Fixe ton objectif vélo', "Ta FTP actuelle, celle que tu vises et la date de ton test : l'app te dit tout de suite si c'est réaliste, puis construit tout le plan à partir de là.", 'Tu peux tout modifier plus tard dans Profil.'); },
    // 3 · jours + programme (réels)
    () => { const p = S.profile;
      return `<div class="tr-card"><div class="tr-h">Tes jours dispo</div>
        <div class="tr-days">${DOW.map((d, k) => { const x = p.days?.[k] || {}; return `<div class="${x.avail ? 'on' : ''}"><b>${d[0]}</b><span class="num">${x.avail ? (x.max >= 120 ? Math.round(x.max/60) + 'h' : x.max + "'") : '—'}</span></div>`; }).join('')}</div>
        <div class="row between" style="margin-top:4px"><b class="small">Tes prochaines séances</b></div>
        ${weekRows().map(([d, n, m, w, z]) => `<div class="tr-sess" style="border-left-color:${ZCOL(z)}"><span class="tiny muted" style="width:32px">${d}</span><div style="flex:1;min-width:0"><b>${esc(n)}</b><div class="tiny muted">${m}</div></div><span class="num small">${w}</span></div>`).join('')}</div>`
        + txt('Étape 2 · Ton programme', 'Un plan calé sur ta semaine', "Les séances clés tombent sur tes jours dispo, avec les watts exacts, et partent toutes seules sur ta montre ou ton compteur.", 'Un empêchement ? Déplace ou saute une séance : le reste du plan se réorganise.'); },
    // 4 · énergie
    () => `<div class="tr-card"><div class="row" style="gap:14px;align-items:center">${batterySVG(48, 64)}<div><div class="tr-big" style="color:var(--tr-warn)">48 · Prudence</div><div class="tiny muted">VFC basse, nuit courte, FC repos +4 ${ex}</div></div></div>
      ${[['var(--ok)', '75–100', 'Prêt', 'bon jour pour pousser'], ['var(--hy-rem)', '55–75', 'Correct', 'séance prévue'], ['var(--warn)', '40–55', 'Prudence', 'cibles −3 à −5 %', 1], ['var(--bad)', '< 40', 'Récupère', 'endurance ou repos']].map(([c, r, l, d, on]) => `<div class="tr-lvl${on ? ' on' : ''}"><i style="background:${c}"></i><span class="num">${r}</span><span><b>${l}</b> : ${d}</span></div>`).join('')}
      <div class="tr-sess" style="border-left-color:var(--z4)"><div style="flex:1"><b>Seuil 3 × 10 min</b><div class="tiny muted">Ajustée pour aujourd'hui</div></div><s class="num tiny muted">248 W</s><b class="num" style="color:var(--tr-warn)">238 W</b></div></div>`
      + txt('Étape 3 · Écoute ton corps', 'Ton énergie règle la séance', "Chaque matin, l'app note ton énergie sur 100 : VFC, FC au repos, sommeil et fatigue d'entraînement. Plus elle est basse, plus la séance du jour est allégée.", 'Touche la batterie sur Aujourd\'hui pour voir le détail.'),
    // 5 · historique
    () => { const plan = { 3: ['bike', 'swim'], 5: ['run'], 6: ['bike'], 8: ['bike'], 9: ['run', 'swim'], 10: ['swim', 'bike'], 12: ['run'], 13: ['bike'], 15: ['bike'], 16: ['run'], 17: ['swim'], 19: ['bike'], 20: ['run'], 22: ['bike'], 23: ['run'], 24: ['swim'], 26: ['bike', 'run'], 27: ['bike'] }, col = { bike: 'var(--accent)', run: 'var(--run)', swim: 'var(--swim)' };
      return `<div class="tr-card"><div class="row between"><div class="tr-h" style="margin:0">Ton mois</div><span class="tiny muted">${ex}</span></div>
        <div class="tr-cal">${Array.from({ length: 28 }, (_, k) => `<div><span class="num">${k + 1}</span><span>${(plan[k + 1] || []).map(s => `<i style="background:${col[s]}"></i>`).join('')}</span></div>`).join('')}</div>
        <div class="tr-leg"><span><i style="background:var(--accent)"></i>Vélo</span><span><i style="background:var(--run)"></i>Course</span><span><i style="background:var(--swim)"></i>Nat</span></div></div>
        <div class="tr-card"><div class="row between"><b class="small">FTP</b><span class="num tiny" style="color:var(--ok)">+12 W en 2 mois</span></div>
        <svg viewBox="0 0 320 70" width="100%" height="70" fill="none" role="img" aria-label="Courbe de FTP en hausse"><path d="M0 60 L60 56 L120 50 L180 44 L240 30 L320 18 L320 70 L0 70 Z" fill="var(--accent)" fill-opacity=".14"/><path d="M0 60 L60 56 L120 50 L180 44 L240 30 L320 18" stroke="var(--accent)" stroke-width="3" stroke-linecap="round"/><path d="M0 12 H320" stroke="var(--muted)" stroke-dasharray="4 5"/></svg></div>`
        + txt('Étape 4 · Ton historique', 'Tout ce que tu fais, au même endroit', "Tes séances des trois sports arrivent toutes seules depuis ta montre. Le calendrier montre ta régularité, Progression suit ta FTP, et chaque séance indique si tu vas plus vite qu'avant."); },
    // 6 · tracé 3D
    () => `<div class="tr-card" style="padding:0;overflow:hidden"><svg viewBox="0 0 348 220" width="100%" fill="none" role="img" aria-label="Vue 3D d'une sortie : relief et parcours coloré selon la pente" style="display:block;background:var(--bg2)">
        <path d="M0 140 L50 100 L95 118 L150 60 L205 94 L250 50 L300 86 L348 70 L348 220 L0 220 Z" fill="var(--line)" opacity=".55"/><path d="M0 168 L60 130 L120 150 L170 108 L230 136 L290 110 L348 126 L348 220 L0 220 Z" fill="var(--line)" opacity=".8"/><path d="M0 195 L70 172 L140 186 L210 160 L280 178 L348 166 L348 220 L0 220 Z" fill="var(--line)"/>
        <path d="M20 190 C60 180 80 166 110 158" stroke="var(--g1)" stroke-width="4" stroke-linecap="round"/><path d="M110 158 C135 150 145 130 160 116" stroke="var(--g2)" stroke-width="4" stroke-linecap="round"/><path d="M160 116 C172 102 180 90 196 82" stroke="var(--g3)" stroke-width="4" stroke-linecap="round"/><path d="M196 82 C214 76 232 88 252 102 C276 118 300 140 330 150" stroke="var(--g1)" stroke-width="4" stroke-linecap="round"/>
        <circle cx="160" cy="116" r="7" fill="var(--accent)" stroke="var(--bg)" stroke-width="3"/><rect x="170" y="128" width="104" height="38" rx="8" fill="var(--card)"/><text x="180" y="144" fill="var(--text)" font-family="JetBrains Mono, monospace" font-size="11">km 41,2 · 7,8 %</text><text x="180" y="158" fill="var(--muted)" font-family="Inter, sans-serif" font-size="10">274 W · 152 bpm</text></svg>
      <div class="row" style="gap:10px;padding:12px 14px;align-items:center"><span class="tr-play">${'<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2l10 6-10 6z" fill="#fff"/></svg>'}</span><div class="bar" style="flex:1;margin:0"><i style="width:48%"></i></div><span class="num tiny muted">1:32</span></div>
      <div class="tr-stats"><div><b>86 km</b><span>distance</span></div><div><b>1 240 m</b><span>D+</span></div><div><b>2</b><span>montées repérées</span></div></div></div>`
      + txt('Étape 5 · Tracé GPS', 'Revis chaque sortie en 3D', "Ouvre une sortie extérieure : le parcours s'affiche sur le relief, coloré selon la pente. Fais-la rejouer ou glisse le curseur pour voir pente, watts et cardio à chaque point.", 'Les montées de plus de 400 m de D+ sont repérées toutes seules.'),
    // 7 · ascensions + prédiction
    () => { const g = [5, 6, 7, 8, 7, 6, 9, 10, 11, 9, 8, 7, 8, 9, 7, 6, 8, 10, 9, 7], col = q => q < 6 ? 'var(--g1)' : q < 8 ? 'var(--g2)' : q < 10 ? 'var(--g3)' : 'var(--g4)'; let h = 8;
      const kg = +S.profile.weightKg || 75, P = ftp(), G = +S.profile.goalFtp || P + 30;
      const pr = typeof Climbs !== 'undefined' && Climbs.predict ? (w => { try { return Climbs.predict(13.8, 1120, w); } catch (e) { return null; } }) : () => null;
      const cell = (w, l, on) => { const r = pr(w); return `<div class="tr-kpi${on ? ' on' : ''}"><b class="num">${r ? fmtT(r.t) : '—'}</b><span>${r ? f2(r.wkg) : f2(w/kg)} W/kg</span><span>${l}</span></div>`; };
      return `<div class="tr-card"><div class="row between"><b>Le col de ta sortie du samedi</b><span class="tiny muted">${ex}</span></div><div class="tiny muted num">9,4 km · 712 m D+ · 7,6 % moy. · 11 % max</div>
        <div class="tr-prof" role="img" aria-label="Profil de la montée coloré selon la pente">${g.map(q => { h += q*0.42; return `<i style="height:${Math.round(h)}px;background:${col(q)}"></i>`; }).join('')}</div>
        <div class="row" style="gap:6px;flex-wrap:wrap"><span class="chip num">41'20</span><span class="chip num">VAM 1 034 m/h</span><span class="chip num">3,21 W/kg</span></div></div>
        <div class="tr-card"><b class="small">Prédire une ascension · Alpe d'Huez (13,8 km · 1 120 m)</b><div class="tr-g3">${cell(P, `ta FTP ${P} W`)}${cell(G, `à ${G} W`, 1)}</div></div>`
        + txt('Étape 6 · Ascensions', 'Tes cols, tes records, ton prochain chrono', "Chaque montée repérée rejoint ta bibliothèque avec ton meilleur temps, ta VAM et tes W/kg. Le prédicteur estime ton temps sur n'importe quel col : à ton niveau actuel, et une fois ton objectif atteint."); },
    // 8 · course objectif
    () => `<div class="tr-card"><div class="row between"><div><b>Ta course A</b><div class="tiny muted">Triathlon half · exemple</div></div><span class="chip" style="color:var(--tr-warn)">Objectif</span></div>
      <div class="tr-g3"><div class="tr-kpi"><span style="color:var(--swim)">Nat</span><b class="num">2 000 m</b></div><div class="tr-kpi"><span style="color:var(--accent)">Vélo</span><b class="num">100 km</b><span>1 920 m D+</span></div><div class="tr-kpi"><span style="color:var(--run)">Course</span><b class="num">16 km</b><span>1 300 m D+</span></div></div>
      <div class="tr-gpx">${ic('<path d="M5 12l5 5 9-10"/>', 'var(--ok)')}Tracés GPX vélo et course importés</div>
      <div class="tr-tab">${[['Nat', 'CSS + 4 s, eau libre', "38'40"], ['Vélo', '78 % FTP sur le tracé', "3h48'10"], ['Course', 'allure modulée par la pente', "1h52'30"], ['Transitions', '', "4'30"]].map(([a, b, c]) => `<div><span>${a} <i>${b ? '· ' + b : ''}</i></span><b class="num">${c}</b></div>`).join('')}</div>
      <div class="row between" style="align-items:baseline"><b>Temps prédit</b><span class="tr-big" style="color:var(--accent)">6h23'50</span></div></div>`
      + txt('Étape 7 · Ta course', 'Ajoute ta course, vois ton chrono', "Entre ta course objectif et ses tracés GPX. Le prédicteur calcule chaque discipline avec tes vraies allures : ta CSS en nat, ta FTP sur le relief exact du vélo, ton seuil en course ralenti dans les montées. Il se met à jour à chaque séance."),
    // 9 · objectifs de temps
    () => `<div class="tr-card"><div class="tr-tgt head"><span></span><span>Objectif</span><span>Prédiction</span></div>
      ${[['Nat', 'var(--swim)', "37'00", "38'40", "+1'40", 0], ['Vélo', 'var(--accent)', "3h50'00", "3h48'10", "−1'50", 1], ['Course', 'var(--run)', "1h45'00", "1h52'30", "+7'30", 0], ['Total', 'var(--text)', "6h17'00", "6h23'50", "+6'50", 0]].map(([l, c, g, p, d, ok]) => `<div class="tr-tgt"><b style="color:${c}">${l}</b><span class="num">${g}</span><span class="num">${p} <i class="${ok ? 'ok' : 'bad'}">${d}</i></span></div>`).join('')}
      <div class="tr-need"><b class="small">Ce qu'il te faut en course</b><div><span>Allure seuil</span><span class="num">4'26 → <b style="color:var(--accent)">4'09 /km</b></span></div><div><span>Équivalent 10 km</span><span class="num">43'09 → <b style="color:var(--accent)">40'30</b></span></div></div></div>`
      + txt('Étape 8 · Tes objectifs', "Fixe ton chrono, vois l'écart", "Mets un objectif par discipline. En vert tu es dans les temps, en rouge l'écart à combler. L'app traduit chaque objectif en allure à travailler (CSS en nat, seuil en course) et cible tes séances là où tu perds le plus."),
    // 10 · branchements (état réel)
    () => { const st = guideSteps().filter(x => ['acct', 'icu', 'strava', 'health'].includes(x.k));
      return txt('Dernière étape · Tes données', "Branche ta montre et c'est parti", "Tout ce que tu viens de voir se remplit avec tes vraies séances.")
        + st.map((x, k) => `<div class="tr-card tr-step${x.done ? ' done' : ''}"><span class="gnum">${x.done ? '✓' : k + 1}</span><div style="flex:1;min-width:0"><b>${esc(x.t)}</b>${x.tag ? ` <span class="chip tiny">${esc(x.tag)}</span>` : ''}${x.done ? ' <span class="tiny muted">· fait</span>' : x.btn ? `<div class="row" style="margin-top:8px">${x.btn}</div>` : ''}</div></div>`).join('')
        + `<p class="tr-small" style="text-align:center">Tu retrouves ce guide dans Profil › Réglages › Bien démarrer, et cette visite dans Profil › Revoir la visite.</p>`; },
  ];
  function html(){
    const last = i === N - 1;
    return `<div class="tour" role="dialog" aria-modal="true" aria-label="Visite guidée de FTP Builder"><div class="tr-in">
      <div class="row between tr-top"><span class="tiny muted">Visite · ${i + 1} sur ${N}</span>${last ? '<span></span>' : '<button class="btn sm ghost" data-tour="skip">Passer</button>'}</div>
      <div class="tr-prog"><i style="width:${(i + 1)/N*100}%"></i></div>
      <div class="tr-body" data-i="${i}">${S_[i]()}</div>
      <div class="tr-nav">${i ? '<button class="btn" data-tour="prev">Retour</button>' : ''}<button class="btn primary" data-tour="${last ? 'done' : 'next'}">${i === 0 ? 'Commencer la visite' : last ? 'Terminer' : 'Suivant'}</button></div>
      ${i === 0 ? '<button class="btn sm ghost" data-tour="skip" style="align-self:center">Je connais déjà, passer</button>' : ''}</div></div>`;
  }
  function paint(){ let el = $('#tour'); if (!el) { el = document.createElement('div'); el.id = 'tour'; document.body.appendChild(el); } el.innerHTML = html(); el.querySelector('.tour').scrollTop = 0; document.body.style.overflow = 'hidden'; }
  function show(at = 0){ if (!S.profile) return; i = at; open = true; paint(); }
  function close(){ open = false; S.settings.tourSeen = true; save(); $('#tour')?.remove(); document.body.style.overflow = ''; render(); }
  function go(d){ i = Math.max(0, Math.min(N - 1, i + d)); paint(); }
  document.addEventListener('click', e => { const b = e.target.closest('[data-tour]'); if (!b) return;
    const a = b.dataset.tour; if (a === 'next') go(1); else if (a === 'prev') go(-1); else if (a === 'skip') { i = N - 1; paint(); } else if (a === 'done') close(); else if (a === 'open') show(0); });
  // balayage gauche/droite
  let x0 = null;
  document.addEventListener('touchstart', e => { if (open && e.target.closest('.tour')) x0 = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', e => { if (!open || x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1); }, { passive: true });
  // une seule fois, juste après l'authentification
  const maybe = () => { if (!open && S.profile && !S.settings.tourSeen) show(0); };
  return { show, close, maybe, get open(){ return open; }, get i(){ return i; }, go, N };
})();

/* ============ Guide de démarrage ============ */
// étapes cochées automatiquement selon ce qui est connecté ; carte sur Aujourd'hui tant que l'essentiel manque (masquable), toujours dans Profil
function guideSteps(){
  const C = Cloud, icuOn = !!C.icu?.connected, ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  return [
    { k:'plan', must:true, done: !!S.profile, t:'Ton plan', d:"Le questionnaire a construit ton plan jusqu'à ton test final. Tu peux le retoucher dans Profil." },
    { k:'acct', must:true, done: !!C.user, t:'Ton compte', d:"Sauvegarde dans le cloud et synchro entre ton téléphone et ton ordi. Indispensable pour les connexions ci-dessous.",
      btn: C.user ? null : `<button class="btn sm primary" data-auth="open">Créer mon compte</button>` },
    { k:'icu', must:true, done: icuOn, t:'Intervals.icu + ta montre', tag:'recommandé',
      d:`La meilleure version de l'app : <b>vélo, course et natation</b> avec le détail tour par tour (recomposition de séance), ton bien-être, et tes séances planifiées envoyées vers ta montre ou ton compteur.<ol class="tiny" style="padding-left:18px;margin:6px 0 0"><li>Crée un compte gratuit sur <a href="https://intervals.icu" target="_blank" rel="noopener">intervals.icu</a>.</li><li>Dans Intervals › Réglages › <b>Connexions</b>, relie ta montre (Garmin, Coros, Suunto, Wahoo, Polar…).</li><li>Reviens ici et connecte Intervals.icu.</li></ol>
        <div class="tiny muted" style="margin-top:8px"><b>Selon ta montre :</b><br>⌚ <b>Garmin</b> : séances + sommeil, VFC, FC repos et poids arrivent tous par Intervals.<br>⌚ <b>Coros, Polar, Suunto, Wahoo</b> : séances complètes ; sommeil et VFC parfois partiels selon la marque.<br>⌚ <b>Apple Watch</b> : Intervals ne lit pas Apple Santé. Envoie tes séances vers Intervals avec une app de synchro (ex. HealthFit), et ton sommeil/VFC avec le Raccourci Apple Santé ci-dessous.</div>`,
      btn: icuOn ? null : C.user ? `<button class="btn sm primary" data-icu="oauth">${ICU_CLIENT_ID ? 'Se connecter avec Intervals.icu' : 'Connecter Intervals.icu'}</button>` : '' },
    { k:'strava', done: !!C.strava?.connected, t:'Strava', tag:'option',
      d:"Tes sorties <b>vélo</b> (puissance, FC, cadence, GPS) dès qu'elles arrivent sur Strava. Pratique si ta montre n'est pas reliée à Intervals ; sinon Intervals suffit. Les doublons sont fusionnés.",
      btn: C.strava?.connected || !C.user || !STRAVA_CLIENT_ID ? null : `<button class="btn sm" data-strava="on" style="background:#fc4c02;border-color:#fc4c02;color:#fff">Connecter Strava</button>` },
    ...(ios ? [{ k:'health', done: !!Health.H?.token?.last, t:'Apple Santé', tag:'option iPhone',
      d:"Un Raccourci iOS envoie chaque jour sommeil, VFC, FC repos et poids : c'est ce qui calcule ton énergie du jour.",
      btn: `<a class="btn sm" href="raccourci.html">Installer le raccourci</a>` }] : []),
    { k:'recomp', done: Object.keys(S.recomp || {}).length > 0, t:'Recompose une séance nat ou course', tag:'astuce',
      d:"Touche une séance dans Aujourd'hui › Heures de sport › 🧩 Recomposer, puis écris-la comme sur ton carnet (« 12x400 rapide 1'30 récup ») : l'app retrouve chaque bloc et suit ta progression bloc par bloc." },
  ];
}
function guideHTML(compact){
  const st = guideSteps(), done = st.filter(x => x.done).length;
  // tout est fait : une ligne à toucher pour revoir le guide (pratique pour le montrer à quelqu'un)
  if (compact === 'line') return `<div class="card guide guide-line" data-guide="open" role="button" tabindex="0"><div class="row between" style="align-items:center"><div><b>Bien démarrer</b> <span class="tiny muted">· ${done}/${st.length} ✓</span><div class="tiny muted">Revoir le guide (ou le montrer à un pote)</div></div><span class="muted" aria-hidden="true">›</span></div></div>`;
  const rows = st.map((x, i) => `<div class="gstep${x.done ? ' done' : ''}"><span class="gnum" aria-hidden="true">${x.done ? '✓' : i + 1}</span><div style="flex:1;min-width:0">
      <b>${esc(x.t)}</b>${x.tag ? ` <span class="chip tiny">${esc(x.tag)}</span>` : ''}${x.done ? ' <span class="tiny muted">· fait</span>' : ''}
      ${!x.done || !compact ? `<div class="small muted" style="margin-top:2px">${x.d}</div>${x.btn && !x.done ? `<div class="row" style="margin-top:8px">${x.btn}</div>` : ''}` : ''}</div></div>`).join('');
  return `<div class="card guide"><div class="row between"><h2>Bien démarrer</h2><span class="chip num">${done}/${st.length}</span></div>
    <div class="bar" style="margin:0 0 12px"><i style="width:${Math.round(done / st.length * 100)}%"></i></div>${rows}
    ${compact ? `<div class="row between" style="margin-top:6px;align-items:center"><label style="display:flex;gap:8px;align-items:center;min-height:44px;cursor:pointer"><input type="checkbox" id="guideOffBox" style="width:auto;min-height:0"><span class="small">Ne plus afficher</span></label><span class="tiny muted">Toujours dispo dans Profil › Réglages</span></div>` : ''}</div>`;
}
// carte d'accueil : tant qu'une étape essentielle manque et que la carte n'a pas été masquée
function guideCardHTML(){
  if (!Cloud.ready || S.settings.guideOff) return '';
  return guideSteps().every(x => x.done) ? '' : guideHTML(true);
}
// Profil : guide complet tant qu'il reste une étape, sinon une ligne
const guideProfileHTML = () => !Cloud.ready ? '' : guideSteps().every(x => x.done) ? guideHTML('line') : guideHTML(false);
document.addEventListener('change', e => { if (e.target.id !== 'guideOffBox' || !e.target.checked) return; S.settings.guideOff = true; save(); render(); toast('Guide masqué : il reste dans Profil › Réglages'); });
document.addEventListener('click', e => { const g = e.target.closest('[data-guide]'); if (!g) return;
  if (g.dataset.guide === 'off') { S.settings.guideOff = true; save(); render(); toast('Guide masqué : il reste dans Profil › Réglages'); }
  else if (g.dataset.guide === 'open') openDlg(guideHTML(false) + (S.settings.guideOff ? `<button class="btn sm" data-guide="on">Réafficher sur Aujourd'hui</button>` : ''));
  else if (g.dataset.guide === 'on') { S.settings.guideOff = false; save(); closeDlg(); render(); toast("Guide réaffiché sur Aujourd'hui"); } });
