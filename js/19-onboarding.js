"use strict";
// FTP Builder · visite guidée et guide de démarrage
/* ============ Visite guidée (une fois après l'authentification, puis Profil › Revoir la visite) ============ */
const Tour = (() => {
  let i = 0, open = false;
  const N = 13;
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
        [ic('<path d="M4 19V5l8 3 8-3v14l-8 3z"/><path d="M12 8v14"/>', 'var(--hy-rem)'), 'Mes traces', 'GPX notés, partagés'],
        [ic('<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15 14.5c3 0 6 2 6 5"/>', 'var(--ok)'), 'Amis et défis', 'Classement entre potes'],
        [ic('<circle cx="6" cy="16" r="4"/><circle cx="18" cy="16" r="4"/><path d="M6 16l4-8h5l3 8M10 8l2 8"/>', 'var(--accent)'), 'Garage', 'Ton vélo en 3D, l\'usure'],
        [ic('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>', 'var(--accent2)'), 'Courses et chronos', 'Tri, 10 km, semi, marathon']
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
        + txt('Étape 6 · Ascensions', 'Tes cols, tes records, ton prochain chrono', "Chaque montée repérée rejoint ta bibliothèque avec ton meilleur temps, ta VAM et tes W/kg. Le prédicteur estime ton temps sur n'importe quel col : à ton niveau actuel, et une fois ton objectif atteint.", 'Retrouve-les dans Profil › Mes ascensions.'); },
    // 8 · Mes GPX : livre de traces noté, ouvert aux amis
    () => `<div class="tr-card"><div class="row between"><b>Mon livre de traces</b><span class="tr-ex">Exemple</span></div>
      ${[['Boucle de la vallée de Chevreuse', '82 km · 1 050 m D+', [5, 3, 4, 5]], ['Les 17 tournants', '64 km · 1 240 m D+', [4, 5, 3, 2]], ['Bords de Marne', '58 km · 210 m D+', [3, 1, 5, 4]]].map(([n, m, r]) => `<div class="tr-sess" style="border-left-color:var(--hy-rem)"><div style="flex:1;min-width:0"><b>${n}</b><div class="tiny muted">${m}</div>
        <div class="tiny" style="display:grid;grid-template-columns:repeat(4,auto);gap:2px 10px;margin-top:4px">${['Fun', 'Difficulté', 'Asphalte', 'Boulangerie'].map((l, i) => `<span><span class="muted">${l}</span> <span style="color:var(--accent)">${'★'.repeat(r[i])}</span><span class="muted">${'★'.repeat(5 - r[i])}</span></span>`).join('')}</div></div></div>`).join('')}
      <div class="tr-gpx">👥 Visible par tes amis, en lecture seule · importe un GPX en un geste</div></div>`
      + txt('Étape 7 · Tes traces', 'Tes plus beaux parcours, notés', "Range tes GPX préférés dans un livre de traces : fun, difficulté, qualité de l'asphalte et… boulangerie à mi-parcours. Tes amis peuvent le feuilleter pour trouver leur prochaine sortie, et toi le leur."),
    // 9 · amis et défis
    () => `<div class="tr-card"><div class="row between"><b>Défi chaise · 4 mois</b><span class="tr-ex">Exemple</span></div>
      ${[['Toi', 186, 300, 'var(--accent)'], ['Julien', 214, 300, 'var(--ok)'], ['Sarah', 142, 300, 'var(--hy-rem)']].map(([n, v, g, c]) => `<div class="tr-lvl" style="flex-direction:column;align-items:stretch;gap:4px"><div class="row between"><b>${n}</b><span class="num">${v} / ${g} min</span></div><div class="tr-prog"><i style="width:${v/g*100}%;background:${c}"></i></div></div>`).join('')}
      <div class="tr-gpx">➕ Ajoute tes amis par leur pseudo · défis FTP, chaise, fentes, gainage</div></div>`
      + txt('Étape 8 · Tes amis', 'Entraîne-toi avec tes potes', "Ajoute tes amis par leur pseudo, lance un défi (FTP sur 2 à 4 mois avec ton propre objectif, ou du renfo) et suivez le classement. Tes amis voient aussi ton livre de traces."),
    // 10 · garage
    () => `<div class="tr-card"><div class="row between"><b>Mon vélo de route</b><span class="tr-ex">Exemple</span></div>
      <div class="tr-g3">${[['4 820 km', 'route'], ['1 260 km', 'home trainer'], ['5,6 bar', 'pression conseillée']].map(([b, l]) => `<div class="tr-kpi"><b>${b}</b><span>${l}</span></div>`).join('')}</div>
      ${[['Chaîne', 78, 'var(--bad)'], ['Pneu arrière', 61, 'var(--warn)'], ['Cassette', 34, 'var(--ok)'], ['Roulements de direction', 22, 'var(--ok)']].map(([n, v, c]) => `<div class="tr-lvl" style="flex-direction:column;align-items:stretch;gap:4px"><div class="row between"><span>${n}</span><span class="num">${v} % d'usure</span></div><div class="tr-prog"><i style="width:${v}%;background:${c}"></i></div></div>`).join('')}</div>`
      + txt('Étape 9 · Ton garage', 'Ton vélo, en 3D et sous contrôle', "Choisis ton vélo dans le catalogue (ou demande son ajout) : les kilomètres montent tout seuls avec tes sorties, l'usure de la chaîne, des pneus et de la cassette est suivie, et tu personnalises sa maquette 3D. Ajoute ton étude posturale et tes achats sur sa fiche."),
    // 11 · course objectif
    () => `<div class="tr-card"><div class="row between"><div><b>Ta course A</b><div class="tiny muted">Triathlon half · exemple</div></div><span class="chip" style="color:var(--tr-warn)">Objectif</span></div>
      <div class="tr-g3"><div class="tr-kpi"><span style="color:var(--swim)">Nat</span><b class="num">2 000 m</b></div><div class="tr-kpi"><span style="color:var(--accent)">Vélo</span><b class="num">100 km</b><span>1 920 m D+</span></div><div class="tr-kpi"><span style="color:var(--run)">Course</span><b class="num">16 km</b><span>1 300 m D+</span></div></div>
      <div class="tr-gpx">${ic('<path d="M5 12l5 5 9-10"/>', 'var(--ok)')}Tracés GPX vélo et course importés</div>
      <div class="tr-tab">${[['Nat', 'CSS + 4 s, eau libre', "38'40"], ['Vélo', '78 % FTP sur le tracé', "3h48'10"], ['Course', 'allure modulée par la pente', "1h52'30"], ['Transitions', '', "4'30"]].map(([a, b, c]) => `<div><span>${a} <i>${b ? '· ' + b : ''}</i></span><b class="num">${c}</b></div>`).join('')}</div>
      <div class="row between" style="align-items:baseline"><b>Temps prédit</b><span class="tr-big" style="color:var(--accent)">6h23'50</span></div></div>`
      + txt('Étape 10 · Ta course', 'Ajoute ta course, vois ton chrono', "Entre ta course objectif et ses tracés GPX. Le prédicteur calcule chaque discipline avec tes vraies allures : ta CSS en nat, ta FTP sur le relief exact du vélo, ton seuil en course ralenti dans les montées. Il se met à jour à chaque séance."),
    // 12 · objectifs de temps
    () => `<div class="tr-card"><div class="tr-tgt head"><span></span><span>Objectif</span><span>Prédiction</span></div>
      ${[['Nat', 'var(--swim)', "37'00", "38'40", "+1'40", 0], ['Vélo', 'var(--accent)', "3h50'00", "3h48'10", "−1'50", 1], ['Course', 'var(--run)', "1h45'00", "1h52'30", "+7'30", 0], ['Total', 'var(--text)', "6h17'00", "6h23'50", "+6'50", 0]].map(([l, c, g, p, d, ok]) => `<div class="tr-tgt"><b style="color:${c}">${l}</b><span class="num">${g}</span><span class="num">${p} <i class="${ok ? 'ok' : 'bad'}">${d}</i></span></div>`).join('')}
      <div class="tr-need"><b class="small">Ce qu'il te faut en course</b><div><span>Allure seuil</span><span class="num">4'26 → <b style="color:var(--accent)">4'09 /km</b></span></div><div><span>Équivalent 10 km</span><span class="num">43'09 → <b style="color:var(--accent)">40'30</b></span></div></div></div>`
      + txt('Étape 11 · Tes objectifs', "Fixe ton chrono, vois l'écart", "Mets un objectif par discipline. En vert tu es dans les temps, en rouge l'écart à combler. L'app traduit chaque objectif en allure à travailler (CSS en nat, seuil en course) et cible tes séances là où tu perds le plus."),
    // 13 · c'est parti (état réel des branchements)
    () => { const st = guideSteps().filter(x => ['icu', 'strava'].includes(x.k));
      return txt('Dernière étape · À toi', "C'est parti", st.every(x => x.done) ? "Ta montre est branchée : tout ce que tu viens de voir se remplit avec tes vraies séances." : "Tout ce que tu viens de voir se remplit avec tes vraies séances dès que ta montre est branchée.")
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
  const maybe = () => { if (!open && S.profile && !S.settings.tourSeen && !S.settings.onbStep) show(0); };
  return { show, close, maybe, get open(){ return open; }, get i(){ return i; }, go, N };
})();

/* ============ Guide de démarrage ============ */
// étapes cochées automatiquement selon ce qui est connecté ; carte sur Aujourd'hui tant que l'essentiel manque (masquable), toujours dans Profil
/* ============ Accueil et questionnaire de départ ============ */
// 1) page d'accueil : création de compte obligatoire (Google ou email) ; un téléphone qui a déjà un plan sans compte passe aussi par là,
//    son plan est envoyé dans le compte à la connexion (Cloud.pull)
// 2) questionnaire en étapes : intro → toi → vélo → ta semaine → objectif → courses → « Créer mon plan »
// 3) branchements (Intervals.icu, Strava), puis visite guidée
// En file:// (tests) la page d'accueil est sautée, sauf si localStorage.ftpb_gate = '1'.
const ageFrom = b => { if (!b) return ''; const t = todayISO(), y = +t.slice(0, 4) - +b.slice(0, 4); return t.slice(5) < b.slice(5) ? y - 1 : y; };
const Onboard = (() => {
  const KEY = 'ftpb_onb_draft', STEPS = ['intro', 'toi', 'velo', 'semaine', 'objectif', 'courses'];
  const DEVICES = [['edge', 'Compteur Garmin Edge'], ['garmin', 'Montre Garmin'], ['wahoo', 'Wahoo'], ['coros', 'Coros'], ['polar', 'Polar'], ['suunto', 'Suunto'], ['apple', 'Apple Watch'], ['other', 'Autre'], ['none', 'Aucun']];
  const TRI_FMT = { s:{ l:'S', swim:750, bike:20, run:5 }, m:{ l:'M (olympique)', swim:1500, bike:40, run:10 }, half:{ l:'Half (70.3)', swim:1900, bike:90, run:21.1 }, full:{ l:'Full (Ironman)', swim:3800, bike:180, run:42.2 } };
  const gateOn = () => location.protocol !== 'file:' || localStorage.getItem('ftpb_gate') === '1';
  let step = 0, D = null, authMode = 'up', authMsg = '';
  function blank(){ const p = defaultProfile(); return { ...p, age:'', birthDate:'', sport:'bike', ftpKnown:true, goalFtp:'', equip:{ trainer:'smart', pm:false, hr:true, device:'' },
    race:{ kind:'none', name:'', date:'', fmt:'half', goal:null, ref10:null, css:null } }; }
  function draft(){ if (D) return D; try { const j = JSON.parse(localStorage.getItem(KEY) || 'null'); if (j) { step = Math.min(j._step || 0, STEPS.length - 1); delete j._step; D = { ...blank(), ...j }; } } catch {} return D ||= blank(); }
  const keep = () => { try { localStorage.setItem(KEY, JSON.stringify({ ...D, _step: step })); } catch {} };
  // page d'accueil tant qu'on n'est pas connecté ; hors ligne (Supabase pas chargé), un plan déjà là reste utilisable
  const gated = () => gateOn() && (Cloud.sb ? Cloud.authKnown && !Cloud.user : !S.profile);
  const waiting = () => gateOn() && Cloud.sb && !Cloud.authKnown && !S.profile;
  const active = () => !S.profile || !!S.settings?.onbStep;
  /* ---------- page d'accueil ---------- */
  const FEATS = [['🎯', 'Un plan à ta mesure', 'Calé sur tes jours, tes watts et ta course'], ['🔋', "L'énergie du jour", 'La séance s’adapte à ta forme'], ['🏁', 'Tes courses', 'Triathlon, 10 km, semi, marathon'], ['🚲', 'Garage et amis', 'Ton vélo en 3D, des défis entre potes']];
  function landingHTML(){
    const has = !!S.profile, up = authMode === 'up';
    return `<div class="tour land"><div class="tr-in">
      <div class="tr-hero"><div class="tr-logo"><span style="color:var(--hy-rem)">FTP</span><span style="color:var(--accent)">·</span>BUILDER</div><div class="tr-sub">Ton coach vélo, natation et course</div></div>
      ${has ? `<div class="note">Ton plan est sur ce téléphone. Crée ton compte (ou connecte-toi) pour le garder : il y sera sauvegardé et tu le retrouveras sur tous tes appareils.</div>`
        : `<div class="tr-grid">${FEATS.map(([i, b, t]) => `<div class="tr-card tr-feat"><span style="font-size:22px">${i}</span><b>${b}</b><span>${t}</span></div>`).join('')}</div>`}
      <div class="tr-card">
        <div class="seg" data-amode style="align-self:stretch;display:flex"><button type="button" class="${up ? 'on' : ''}" data-v="up" style="flex:1">Créer un compte</button><button type="button" class="${up ? '' : 'on'}" data-v="in" style="flex:1">J'ai un compte</button></div>
        <button class="btn" id="lGoogle" style="width:100%">Continuer avec Google</button>
        <div class="tiny muted" style="text-align:center">ou par email</div>
        <form id="lForm" style="display:flex;flex-direction:column;gap:6px" autocomplete="on">
          <label class="f" for="lEmail">Email</label><input type="email" id="lEmail" inputmode="email" autocomplete="email" required>
          <label class="f" for="lPass">Mot de passe${up ? ' (8 caractères min.)' : ''}</label><input type="password" id="lPass" autocomplete="${up ? 'new-password' : 'current-password'}" required style="width:100%;background:var(--bg2);border:1px solid var(--line);border-radius:10px;padding:10px 12px;min-height:42px">
          <button class="btn primary" type="submit" id="lGo" style="margin-top:6px">${up ? 'Créer mon compte' : 'Se connecter'}</button>
        </form>
        <div id="lMsg" class="small" style="min-height:1em">${authMsg}</div>
      </div>
      ${Cloud.sb ? '' : '<p class="small" style="text-align:center;color:var(--bad)">Pas de connexion internet : la création du compte en demande une.</p>'}
      <p class="tiny muted" style="text-align:center">Ton compte sert à sauvegarder ton plan et tes séances, et à relier ta montre. <a href="confidentialite.html">Politique de confidentialité</a></p>
    </div></div>`;
  }
  function bindLanding(app){
    app.querySelectorAll('[data-amode] button').forEach(b => b.onclick = () => { authMode = b.dataset.v; authMsg = ''; app.innerHTML = landingHTML(); bindLanding(app); });
    $('#lGoogle').onclick = () => Cloud.signInGoogle();
    const msg = (t, ok) => { authMsg = t; const m = $('#lMsg'); if (m) { m.textContent = t; m.style.color = ok ? 'var(--ok)' : 'var(--bad)'; } };
    $('#lForm').onsubmit = async e => { e.preventDefault(); const em = $('#lEmail').value, pw = $('#lPass').value; $('#lGo').disabled = true;
      const r = authMode === 'up' ? await Cloud.signUp(em, pw) : await Cloud.signIn(em, pw); $('#lGo') && ($('#lGo').disabled = false);
      if (r === 'confirm') msg('Compte créé : clique sur le lien reçu par email pour l’activer, puis reviens ici.', true); else if (r) msg(r); else authMsg = ''; };
  }
  /* ---------- questionnaire ---------- */
  const seg = (k, opts, v) => `<div class="seg" data-k="${k}" style="display:flex;flex-wrap:wrap">${opts.map(([x, l]) => `<button type="button" class="${String(v) === String(x) ? 'on' : ''}" data-v="${x}">${l}</button>`).join('')}</div>`;
  const fld = (l, h, full) => `<div${full ? ' style="grid-column:1/-1"' : ''}><label class="f">${l}</label>${h}</div>`;
  const hms = (pre, v) => `<div class="tgin"><div class="tgrow"><span class="tgl"></span>${[['h', Math.floor((v || 0)/3600), 9], ['min', Math.floor((v || 0) % 3600/60), 59], ['s', Math.round((v || 0) % 60), 59]].map(([u, x, mx]) => `<label><input type="number" inputmode="numeric" min="0" max="${mx}" name="${pre}_${u}" value="${v ? x : ''}"><span>${u}</span></label>`).join('')}</div></div>`;
  const ftpGuess = p => { const lv = { 20:2.0, 40:2.6, 60:3.1, 80:3.5 }[p.ctl0] || 2.6; return Math.round((+p.weightKg || 75)*lv*(p.sex === 'F' ? 0.88 : 1)/5)*5; };
  const RK = [['none', 'Aucune'], ['tri', 'Triathlon'], ['10', '10 km'], ['21', 'Semi'], ['42', 'Marathon']];
  function body(){
    const p = draft(), r = p.race, s = STEPS[step];
    if (s === 'intro') return `<div class="tr-txt"><span class="tr-kick">Bienvenue${p.name ? ' ' + esc(p.name) : ''}</span><h1>Construisons ton plan</h1>
        <p>Ce questionnaire prend environ <b>2 minutes</b>. Chaque réponse sert : tes watts cibles, tes jours d'entraînement, tes courses et tes prédictions de chrono. C'est ce qui rend l'app vraiment à ta mesure.</p></div>
      <div class="tr-card">${[['👤', 'Toi', 'Profil et sport de prédilection'], ['🚴', 'Ton vélo', 'FTP et équipement'], ['📅', 'Ta semaine', 'Tes jours et leur durée'], ['🎯', 'Ton objectif', 'La FTP visée et sa date'], ['🏁', 'Tes courses', 'Si tu en prépares une']].map(([i, b, t]) => `<div class="row" style="gap:10px;align-items:center"><span style="font-size:20px;width:28px;text-align:center">${i}</span><div><b>${b}</b><div class="tiny muted">${t}</div></div></div>`).join('')}</div>`;
    if (s === 'toi') return `<div class="tr-txt"><span class="tr-kick">Étape 1 sur 5</span><h1>Toi</h1><p class="tr-small">Pour tes W/kg, tes zones cardio et tes prédictions de temps.</p></div>
      <div class="tr-card"><div class="grid2">
        ${fld('Prénom', `<input type="text" name="name" value="${esc(p.name || '')}" autocomplete="given-name">`, true)}
        ${fld('Sexe', seg('sex', [['M', 'Homme'], ['F', 'Femme']], p.sex), true)}
        ${fld('Date de naissance', `<input type="date" name="birthDate" value="${p.birthDate || ''}" max="${addDays(todayISO(), -365*12)}">${!p.birthDate && p.age ? `<span class="tiny muted">${p.age} ans d'après ton Garmin</span>` : ''}`, true)}
        ${fld('Poids (kg)', `<input type="number" name="weightKg" step="0.1" min="35" max="160" inputmode="decimal" value="${p.weightKg || ''}">`)}
        ${fld('Taille (cm)', `<input type="number" name="heightCm" min="130" max="220" inputmode="numeric" value="${p.heightCm || ''}">`)}
        ${fld('Sport de prédilection', seg('sport', [['bike', '🚴 Vélo'], ['tri', '🏊🚴🏃 Triathlon'], ['run', '🏃 Course à pied']], p.sport), true)}
      </div><button type="button" class="btn sm ghost" id="prefill" style="align-self:flex-start">Pré-remplir depuis un .fit Garmin</button><div id="prefillInfo" class="tiny muted"></div></div>`;
    if (s === 'velo') { const e = p.equip;
      return `<div class="tr-txt"><span class="tr-kick">Étape 2 sur 5</span><h1>Ton vélo</h1><p class="tr-small">Toutes les séances sont écrites en watts, à partir de ta FTP.</p></div>
      <div class="tr-card"><label class="f">Tu connais ta FTP ?</label>${seg('ftpKnown', [['1', 'Oui'], ['0', 'Non']], p.ftpKnown ? 1 : 0)}
        ${p.ftpKnown ? fld('FTP actuelle (W)', `<input type="number" name="ftp" min="80" max="600" inputmode="numeric" value="${p.ftp || ''}" placeholder="ex. 250">`)
          : `<p class="small" style="margin:0">Pas de souci : ton plan commence par un <b>test FTP</b>. D'ici là, on part d'une estimation.</p>
            ${fld('Ton niveau', seg('ctl0', [[20, 'Reprise'], [40, 'Régulier'], [60, 'Bien entraîné'], [80, 'Très entraîné']], p.ctl0))}
            ${fld('Test', seg('testProtocol', [['20min', '20 min (conseillé)'], ['ramp', 'Rampe']], p.testProtocol))}
            <p class="tiny muted" style="margin:0">Estimation : ${ftpGuess(p)} W (${(ftpGuess(p)/(+p.weightKg || 75)).toFixed(1).replace('.', ',')} W/kg), remplacée par ton test.</p>`}
      </div>
      <div class="tr-card"><b>Ton équipement</b>
        ${fld('Home trainer', seg('trainer', [['smart', 'Connecté (ERG)'], ['classic', 'Classique'], ['none', 'Pas de home trainer']], e.trainer))}
        ${fld('Capteur de puissance sur le vélo', seg('pm', [['1', 'Oui'], ['0', 'Non']], e.pm ? 1 : 0))}
        ${fld('Ceinture cardio', seg('hr', [['1', 'Oui'], ['0', 'Non']], e.hr ? 1 : 0))}
        ${fld('Compteur ou montre', `<select name="device"><option value="">Choisir…</option>${DEVICES.map(([v, l]) => `<option value="${v}" ${e.device === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
        ${fld('FC max (bpm) <span class="tiny muted">facultatif</span>', `<input type="number" name="hrMax" min="140" max="230" inputmode="numeric" value="${p.hrMax || ''}" placeholder="sinon estimée">`)}
        <p class="tiny muted" style="margin:0">${e.trainer === 'smart' ? "Avec un home trainer connecté, ton compteur règle les watts tout seul (mode ERG)." : e.trainer === 'classic' && !e.pm ? "Sans home trainer connecté ni capteur, il te faudra un capteur de puissance ou un compteur de vitesse compatible pour suivre les watts." : e.trainer === 'none' && !e.pm ? "Les séances sont écrites en watts : un home trainer connecté ou un capteur de puissance est fortement conseillé." : "Tu suis les watts sur ton compteur grâce à ton capteur."}</p>
      </div>`; }
    if (s === 'semaine') { const cells = [0, 1, 2, 3, 4, 5, 6].map(d => `<div class="day ${p.days[d].avail ? 'on' : ''}" data-day="${d}"><button type="button">${DOW[d]}</button><input type="number" min="30" max="300" step="15" value="${p.days[d].max}" ${p.days[d].avail ? '' : 'disabled'} aria-label="Durée max vélo ${DOW[d]}"><div class="tiny muted">min 🚴</div></div>`).join('');
      return `<div class="tr-txt"><span class="tr-kick">Étape 3 sur 5</span><h1>Ta semaine</h1><p class="tr-small">Touche les jours où tu peux rouler, puis règle le temps max de chaque jour. Les séances clés tombent sur ces jours.</p></div>
      <div class="tr-card"><div class="days">${cells}</div>
        ${fld('Séances clés / semaine', seg('keyPerWeek', [[1, '1'], [2, '2'], [3, '3']], p.keyPerWeek))}
        ${fld('Séances d\'endurance en plus', seg('optionalPerWeek', [[0, '0'], [1, '1'], [2, '2']], p.optionalPerWeek))}
        ${fld('Début du programme', `<input type="date" name="startDate" value="${p.startDate}">`)}</div>`; }
    if (s === 'objectif') { const f0 = +p.ftp || ftpGuess(p); if (!p.goalFtp) p.goalFtp = Math.round(f0*1.1/5)*5;
      return `<div class="tr-txt"><span class="tr-kick">Étape 4 sur 5</span><h1>Ton objectif vélo</h1><p class="tr-small">La FTP que tu vises et la date de ton test final. L'app te dit tout de suite si c'est réaliste.</p></div>
      <div class="tr-card"><div class="grid2">
        ${fld('FTP actuelle', `<div class="num" style="font-size:22px;font-weight:700;padding:8px 0">${f0} W${p.ftpKnown ? '' : ' <span class="tiny muted">estimée</span>'}</div>`)}
        ${fld('FTP visée (W)', `<input type="number" name="goalFtp" min="80" max="600" inputmode="numeric" value="${p.goalFtp}">`)}
        ${fld('Date du test final', `<input type="date" name="goalDate" value="${p.goalDate}" min="${addDays(p.startDate, 28)}">`, true)}
      </div><div id="goalCheck" class="small"></div></div>`; }
    if (s === 'courses') { const k = r.kind, run = ['10', '21', '42'].includes(k), D0 = run ? RUN_D[+k] : null;
      return `<div class="tr-txt"><span class="tr-kick">Étape 5 sur 5</span><h1>Tes courses</h1><p class="tr-small">Tu prépares une course ? Ton plan se construit autour d'elle, avec un prédicteur de temps et des séances à ton allure objectif.</p></div>
      <div class="tr-card">${seg('kind', RK, k)}
        ${k === 'none' ? '<p class="tiny muted" style="margin:0">Tu pourras en ajouter une à tout moment depuis le Calendrier.</p>' : `<div class="grid2">
          ${fld('Nom de la course', `<input type="text" name="rname" value="${esc(r.name || '')}" placeholder="${k === 'tri' ? 'ex. Triathlon de Paris' : 'ex. Semi de Paris'}">`, true)}
          ${fld('Date', `<input type="date" name="rdate" value="${r.date || (run ? runDefaultDate(+k) : addDays(todayISO(), 7*20))}" min="${addDays(todayISO(), 21)}">`, true)}
          ${k === 'tri' ? fld('Format', seg('fmt', Object.entries(TRI_FMT).map(([x, f]) => [x, f.l]), r.fmt), true)
            + fld('Ton allure en nat /100 m <span class="tiny muted">facultatif</span>', paceIn('css', r.css, "1'50"), true) : ''}
          ${run ? fld('Objectif de temps <span class="tiny muted">facultatif</span>', hms('goal', r.goal), true) : ''}
          ${fld('Ton dernier chrono sur 10 km <span class="tiny muted">facultatif</span>', hms('ref', r.ref10), true)}
        </div><p class="tiny muted" style="margin:0">${run ? `${D0.l} : le plan course à pied s'ajoute à ton plan vélo (conseillé : ${D0.weeks} semaines).` : 'Le plan vélo, natation et course se construit jusqu’au jour J. Tu affineras distances, D+ et GPX dans le Calendrier.'}</p>`}
      </div>`; }
    return '';
  }
  function wizHTML(){
    const last = step === STEPS.length - 1;
    return `<div class="tour wiz onb"><div class="tr-in"><form id="qform" autocomplete="off" style="display:contents">
      <div class="row between tr-top">${step ? '<button type="button" class="btn sm ghost" data-wz="prev">‹ Retour</button>' : '<span></span>'}<span class="tiny muted">${step ? `${step} sur ${STEPS.length - 1}` : '2 min'}</span></div>
      <div class="tr-prog"><i style="width:${step/(STEPS.length - 1)*100}%"></i></div>
      <div class="tr-body">${body()}</div>
      <p id="wzMsg" class="small" style="margin:0;color:var(--bad);min-height:1em"></p>
      <div class="tr-nav"><button class="btn primary" type="submit" id="wzNext">${step === 0 ? "C'est parti" : last ? 'Créer mon plan' : 'Continuer'}</button></div>
    </form></div></div>`;
  }
  // lecture des champs de l'étape affichée
  function read(){
    const f = $('#qform'); if (!f) return; const p = draft(), E = f.elements, v = n => E[n] ? E[n].value : undefined;
    for (const k of ['name', 'birthDate', 'startDate', 'goalDate']) if (v(k) !== undefined) p[k] = k === 'name' ? v(k).trim() : v(k);
    for (const k of ['weightKg', 'heightCm', 'ftp', 'hrMax', 'goalFtp']) if (v(k) !== undefined) p[k] = v(k) === '' ? '' : +v(k);
    if (v('device') !== undefined) p.equip.device = v('device');
    f.querySelectorAll('.day').forEach(el => { const d = +el.dataset.day; p.days[d].max = +el.querySelector('input').value || 60; });
    const sec = pre => E[pre + '_h'] ? ((+E[pre + '_h'].value || 0)*3600 + (+E[pre + '_min'].value || 0)*60 + (+E[pre + '_s'].value || 0)) || null : undefined;
    if (v('rname') !== undefined) p.race.name = v('rname').trim(); if (v('rdate') !== undefined) p.race.date = v('rdate');
    if (E.css_min) p.race.css = paceRead(E, 'css', null);
    const g = sec('goal'), rf = sec('ref'); if (g !== undefined) p.race.goal = g; if (rf !== undefined) p.race.ref10 = rf;
    if (p.birthDate) p.age = ageFrom(p.birthDate);
    if (p.ftpKnown === false) p.ftp = ftpGuess(p);
    p.endDate = addDays(p.goalDate, 10);
    keep();
  }
  function check(){
    const p = draft(), s = STEPS[step];
    if (s === 'toi') { if (!p.birthDate && !p.age) return 'Indique ta date de naissance.'; if (!(+p.weightKg >= 35)) return 'Indique ton poids.'; }
    if (s === 'velo' && p.ftpKnown && !(+p.ftp >= 80)) return 'Indique ta FTP (ou choisis « Non »).';
    if (s === 'semaine' && ![0, 1, 2, 3, 4, 5, 6].some(d => p.days[d].avail)) return 'Choisis au moins un jour.';
    if (s === 'objectif') { if (!(+p.goalFtp >= 80)) return 'Indique la FTP visée.'; if (!p.goalDate || p.goalDate < addDays(p.startDate, 28)) return 'Le test final doit être au moins 4 semaines après le début.'; }
    if (s === 'courses' && p.race.kind !== 'none' && (!p.race.date || p.race.date < addDays(todayISO(), 21))) return 'Choisis une date de course au moins 3 semaines plus tard.';
    return '';
  }
  function paint(app = $('#app')){ app.innerHTML = wizHTML(); bind(app); app.querySelector('.tour').scrollTop = 0; }
  function bind(app){
    const f = $('#qform'), p = draft();
    const goal = () => { const g = $('#goalCheck'); if (g) g.innerHTML = goalCheckText({ ...p, ftp: +p.ftp || ftpGuess(p) }); };
    f.addEventListener('input', () => { read(); goal(); });
    f.querySelectorAll('.seg[data-k]').forEach(sg => sg.querySelectorAll('button').forEach(b => b.onclick = () => { read(); const k = sg.dataset.k, x = b.dataset.v;
      if (k === 'ftpKnown') p.ftpKnown = x === '1'; else if (k === 'pm' || k === 'hr') p.equip[k] = x === '1'; else if (k === 'trainer') p.equip.trainer = x;
      else if (k === 'kind' || k === 'fmt') p.race[k] = x; else if (['keyPerWeek', 'optionalPerWeek', 'ctl0'].includes(k)) p[k] = +x; else p[k] = x;
      if (k === 'sport' && p.race.kind === 'none') p.race.kind = x === 'tri' ? 'tri' : x === 'run' ? '10' : 'none';
      if (k === 'kind') p.race.date = '';
      if (k === 'ftpKnown' && x === '1' && p.ftp === ftpGuess(p)) p.ftp = '';
      keep(); paint(app); }));
    f.querySelectorAll('.day').forEach(el => el.addEventListener('click', e => { const inp = el.querySelector('input'); if (e.target === inp && !inp.disabled) return; e.preventDefault();
      const d = +el.dataset.day; p.days[d].avail = !p.days[d].avail; el.classList.toggle('on', p.days[d].avail); inp.disabled = !p.days[d].avail; read(); }));
    app.querySelector('[data-wz=prev]')?.addEventListener('click', () => { read(); step--; keep(); paint(app); });
    const pf = $('#prefill'); if (pf) pf.onclick = () => pickFile(async file => { try {
      const fit = await FIT.readFile(file); const u = fit.user, z = fit.zones, s0 = fit.sessions[0] || {};
      if (u.age && !p.birthDate) p.age = u.age; if (u.weightKg) p.weightKg = u.weightKg; if (u.heightCm) p.heightCm = u.heightCm; if (u.sex) p.sex = u.sex;
      const hrM = u.hrMaxBike || u.hrMax || z.hrMax; if (hrM) p.hrMax = hrM; if (z.ftp || s0.ftp) { p.ftp = z.ftp || s0.ftp; p.ftpKnown = true; }
      keep(); paint(app); $('#prefillInfo').textContent = `Trouvé dans le fichier : ${[u.age && `${u.age} ans`, u.weightKg && `${u.weightKg} kg`, u.heightCm && `${u.heightCm} cm`, (z.ftp || s0.ftp) && `FTP ${z.ftp || s0.ftp} W`, hrM && `FC max ${hrM}`].filter(Boolean).join(' · ') || 'rien d’exploitable'}`;
    } catch (e) { toast(e.message); } });
    f.onsubmit = e => { e.preventDefault(); read(); const m = check(); if (m) { $('#wzMsg').textContent = m; return; }
      if (step < STEPS.length - 1) { step++; keep(); paint(app); return; }
      finish(draft()); };
    goal();
  }
  // construit le profil, le plan vélo et, s'il y a une course, le plan tri ou course à pied
  function finish(d, o = {}){
    const p = { ...defaultProfile(), ...d }, r = d.race || { kind:'none' };
    if (p.birthDate) p.age = ageFrom(p.birthDate);
    for (const k of ['age', 'weightKg', 'heightCm', 'ftp', 'hrMax', 'goalFtp']) if (p[k] !== '' && p[k] != null) p[k] = +p[k];
    if (!p.ftp) p.ftp = ftpGuess(p); if (!p.goalFtp) p.goalFtp = Math.round(p.ftp*1.1/5)*5;
    if (!d.endDate || d.endDate < p.goalDate) p.endDate = addDays(p.goalDate, 10);
    p.otherSports = p.sport !== 'bike' || r.kind !== 'none' || p.otherSports;
    delete p.race; delete p.ftpKnown;
    S.profile = p; S.ftpHistory = [{ date: p.startDate < todayISO() ? p.startDate : todayISO(), ftp: p.ftp, source: d.ftpKnown === false ? 'estimate' : 'initial' }];
    S.plan = generatePlan(p);
    const ref = r.ref10 ? Math.round(r.ref10/10 + 8) : null;
    if (r.kind === 'tri') { const F = TRI_FMT[r.fmt] || TRI_FMT.half;
      applyTri({ ...TRI_DEF(), mode:'tri', enabled:true, race:{ name: r.name || `Triathlon ${F.l}`, date: r.date, swim:F.swim, bike:F.bike, bikeDp:0, run:F.run, runDp:0 }, css: r.css || 105, runThr: ref || 270 }); }
    else if (['10', '21', '42'].includes(r.kind)) { const dist = +r.kind, D0 = RUN_D[dist], free = [0, 1, 2, 3, 4, 5, 6].filter(x => !p.days[x].avail);
      const runDays = free.length >= 3 ? free.slice(-4) : [1, 3, 5, 6];
      applyTri({ ...RUN_DEF(), enabled:true, dist, start: todayISO(), goal: r.goal || null, ref: r.ref10 ? { m:10000, t:r.ref10 } : null, runThr: ref || 270, runDays, runPerWeek: runDays.length,
        race:{ name: r.name || `Objectif ${D0.l.toLowerCase()}`, date: r.date || runDefaultDate(dist), run: Math.round(D0.km*10)/10, runDp:0, swim:0, bike:0, bikeDp:0 } }); }
    if (!o.quick) S.settings.onbStep = 'connect'; else S.settings.tourSeen = true; // quick : profil posé d'un coup (tests), sans branchements ni visite
    save(); try { localStorage.removeItem(KEY); } catch {} D = null; step = 0; TAB = 'today'; render();
    toast(`Plan généré : ${S.plan.length} séances vélo${S.triPlan?.length && triOn() ? ` + ${S.triPlan.filter(x => x.sport !== 'bike' && x.date >= todayISO()).length} ${runOn() ? 'de course' : 'nat et course'}` : ''}`);
  }
  /* ---------- branchements ---------- */
  function connectHTML(){
    const st = guideSteps().filter(x => ['icu', 'strava'].includes(x.k)), dev = S.profile.equip?.device;
    const tip = { edge:'Ton Edge : Intervals.icu envoie tes séances planifiées dessus et récupère tes sorties.', garmin:'Ta montre Garmin : séances, sommeil, VFC et FC au repos arrivent par Intervals.icu.', wahoo:'Wahoo : relie-le à Intervals.icu pour récupérer tes sorties.', coros:'Coros : relie-la à Intervals.icu (séances complètes).', polar:'Polar : relie-la à Intervals.icu (séances complètes).', suunto:'Suunto : relie-la à Intervals.icu (séances complètes).', apple:'Apple Watch : passe par Strava (ou Intervals.icu via une app tierce).' }[dev];
    return `<div class="tour wiz onb"><div class="tr-in">
      <div class="tr-txt"><span class="tr-kick">Ton plan est prêt</span><h1>Branche ta montre</h1><p>Tes séances arrivent toutes seules dans l'app, et tes séances planifiées partent sur ton compteur.${tip ? `<br><b>${tip}</b>` : ''}</p></div>
      ${st.map(x => `<div class="tr-card tr-step${x.done ? ' done' : ''}"><span class="gnum">${x.done ? '✓' : '•'}</span><div style="flex:1;min-width:0"><b>${esc(x.t)}</b>${x.tag ? ` <span class="chip tiny">${esc(x.tag)}</span>` : ''}${x.done ? ' <span class="tiny muted">· connecté</span>' : `<div class="small muted" style="margin-top:4px">${x.k === 'icu' ? "La meilleure version de l'app : vélo, course et natation tour par tour, ton bien-être, et tes séances envoyées vers ta montre ou ton compteur." : x.d}</div>${x.btn ? `<div class="row" style="margin-top:8px">${x.btn}</div>` : ''}`}</div></div>`).join('')}
      <div class="tr-nav"><button class="btn primary" data-wz="connected">${st.some(x => x.done) ? 'Continuer' : 'Plus tard'}</button></div>
      <p class="tr-small" style="text-align:center">Tu pourras les relier à tout moment dans Profil › Réglages.</p></div></div>`;
  }
  document.addEventListener('click', e => { if (!e.target.closest('[data-wz=connected]')) return; S.settings.onbStep = null; save(); render(); Tour.show(0); });
  // point d'entrée depuis render()
  function show(app){
    if (S.profile && S.settings.onbStep === 'connect') { app.innerHTML = connectHTML(); return; }
    if (waiting()) { app.innerHTML = ''; return; }
    if (gated()) { if (!app.querySelector('.land')) { app.innerHTML = landingHTML(); bindLanding(app); } return; }
    if (app.querySelector('.wiz #qform')) return; // déjà affiché : un réaffichage pendant le chargement du compte ferait perdre la saisie
    paint(app);
  }
  return { show, active: () => active() || gated() || waiting(), gated, finish, get step(){ return step; }, draft };
})();
function guideSteps(){
  const C = Cloud, icuOn = !!C.icu?.connected;
  return [
    { k:'plan', must:true, done: !!S.profile, t:'Ton plan', d:"Le questionnaire a construit ton plan jusqu'à ton test final. Tu peux le retoucher dans Profil." },
    { k:'icu', must:true, done: icuOn, t:'Intervals.icu + ta montre', tag:'recommandé',
      d:`La meilleure version de l'app : <b>vélo, course et natation</b> avec le détail tour par tour (recomposition de séance), ton bien-être, et tes séances planifiées envoyées vers ta montre ou ton compteur.<ol class="tiny" style="padding-left:18px;margin:6px 0 0"><li>Crée un compte gratuit sur <a href="https://intervals.icu" target="_blank" rel="noopener">intervals.icu</a>.</li><li>Dans Intervals › Réglages › <b>Connexions</b>, relie ta montre (Garmin, Coros, Suunto, Wahoo, Polar…).</li><li>Reviens ici et connecte Intervals.icu.</li></ol>
        <div class="tiny muted" style="margin-top:8px"><b>Selon ta montre :</b><br>⌚ <b>Garmin</b> : séances + sommeil, VFC, FC repos et poids arrivent tous par Intervals.<br>⌚ <b>Coros, Polar, Suunto, Wahoo</b> : séances complètes ; sommeil et VFC parfois partiels selon la marque.<br>⌚ <b>Apple Watch</b> : Intervals ne lit pas Apple Santé. Envoie tes séances vers Intervals avec une app de synchro (ex. HealthFit), et ton sommeil/VFC via Apple Santé (mode d'emploi dans Profil › Réglages › Apple Santé).</div>`,
      btn: icuOn ? null : C.user ? `<button class="btn sm primary" data-icu="oauth">${ICU_CLIENT_ID ? 'Se connecter avec Intervals.icu' : 'Connecter Intervals.icu'}</button>` : '' },
    { k:'strava', done: !!C.strava?.connected, t:'Strava', tag:'option',
      d:"Tes sorties <b>vélo</b> (puissance, FC, cadence, GPS) dès qu'elles arrivent sur Strava. Pratique si ta montre n'est pas reliée à Intervals ; sinon Intervals suffit. Les doublons sont fusionnés.",
      btn: C.strava?.connected || !C.user || !STRAVA_CLIENT_ID ? null : `<button class="btn sm" data-strava="on" style="background:#fc4c02;border-color:#fc4c02;color:#fff">Connecter Strava</button>` },
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
