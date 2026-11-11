"use strict";
// FTP Builder · explications des chiffres, défis
/* ============ explications des chiffres ============ */
const lastLoad = () => { const L = loadSeries(); return L[L.length-1] || null; };
const scale = (rows, v) => `<div class="infoscale">${rows.map(([lo,hi,lab,txt]) => `<div class="${v!=null && v>=lo && v<hi ? 'on':''}"><b>${lab}</b><span>${txt}</span></div>`).join('')}</div>`;
const INFO = {
  periodisation: () => ({ t:'La méthode du plan vélo', body:`<p><b>Périodisation par blocs de 4 semaines</b> : 3 semaines de charge progressive puis 1 semaine allégée (schéma 3:1). L'adaptation se fait pendant la récupération, pas pendant l'effort.</p>
      <p><b>Progression des intensités</b> : Base (sweet spot 88–94 % FTP, force en cadence basse) → Build 1 (seuil 95–105 %) → Build 2 (seuil + VO2max) → Peak / Spécifique, puis affûtage d'une semaine avant le test final ou la course. Dans chaque bloc, la même famille de séance s'allonge ou se durcit d'une semaine à l'autre (surcharge progressive).</p>
      <p><b>Mesure</b> : zones de Coggan en % de FTP, test rampe (FTP = 75 % de la meilleure minute) ou 20 min (95 %), retest toutes les ~6 semaines pour recaler les watts. Charge en TSS ; fitness (CTL, 42 j) et fatigue (ATL, 7 j) selon le modèle impulsion-réponse de Banister.</p>
      <p><b>Ce que dit la recherche, honnêtement</b> : le sweet spot est très rentable quand le temps est compté (≈ 6–8 h / semaine), mais beaucoup d'études sur des athlètes d'endurance favorisent une répartition <b>polarisée</b> (≈ 80 % facile, 20 % dur). Le plan s'en rapproche avec 2–3 séances clés par semaine, le reste en endurance facile. En mode triathlon, les sorties longues et les blocs nat / course augmentent la part facile.</p>
      <p class="muted">Aucun plan ne garantit un résultat : les tests disent si la trajectoire tient.</p>` }),
  ctl: () => { const l = lastLoad(); const v = l ? Math.round(l.ctl) : null;
    const L = loadSeries(); const w = L.length > 7 ? Math.round(l.ctl - L[L.length-8].ctl) : null;
    return { t:'Fitness (CTL)', body:`<p>Ton <b>niveau d'entraînement de fond</b> : la moyenne de ta charge quotidienne sur les <b>42 derniers jours</b> (6 semaines). Plus il monte, plus ton corps est habitué à encaisser du travail. C'est lui qui porte la progression de ta FTP.</p>
      <p>Chaque séance donne un score de charge (TSS : 1 h pile à ta FTP = 100). Le CTL lisse ces scores sur 6 semaines.</p>
      ${scale([[0,30,'< 30','Reprise, base légère'],[30,50,'30 – 50','Pratiquant régulier'],[50,70,'50 – 70','Bien entraîné'],[70,999,'> 70','Très chargé (triathlète en préparation)']], v)}
      <p><b>Toi : ${v ?? '—'}</b>${w!=null?` · ${w>=0?'+':''}${w} sur 7 jours`:''}. Une hausse de <b>+3 à +6 par semaine</b> est productive et tenable ; au-delà de +8, le risque de fatigue ou de blessure grimpe.</p>` }; },
  atl: () => { const l = lastLoad(); const v = l ? Math.round(l.atl) : null;
    return { t:'Fatigue (ATL)', body:`<p>Ta <b>charge récente</b> : la même moyenne que le CTL mais sur <b>7 jours</b> seulement. Elle réagit vite : une grosse séance la fait bondir, deux jours de repos la font redescendre.</p>
      <p>On la compare toujours au CTL : si la fatigue dépasse nettement la fitness, tu es en train de charger (normal en bloc dur) ; si elle passe en dessous, tu récupères.</p>
      <p><b>Toi : ${v ?? '—'}</b>${l?` (fitness ${Math.round(l.ctl)})`:''}. ${l ? (l.atl > l.ctl + 10 ? 'Tu charges en ce moment : surveille le sommeil et les jambes.' : l.atl < l.ctl - 10 ? 'Charge récente faible : tu es en phase de récupération.' : 'Charge récente équilibrée avec ton niveau de fond.') : ''}</p>` }; },
  tsb: () => { const l = lastLoad(); const v = l ? Math.round(l.tsb) : null;
    return { t:'Forme (TSB)', body:`<p><b>Forme = Fitness − Fatigue</b> (CTL − ATL, valeurs de la veille). C'est ta « fraîcheur » du jour : positif, tu es reposé ; négatif, tu portes de la fatigue d'entraînement.</p>
      ${scale([[-999,-30,'< −30','Fatigue élevée : risque de surmenage, lève le pied'],[-30,-10,'−30 à −10','Zone de travail : fatigue productive, c’est là que tu progresses'],[-10,5,'−10 à +5','Neutre : séances normales'],[5,25,'+5 à +25','Frais : idéal pour un test FTP ou une course'],[25,999,'> +25','Très frais : si ça dure, tu perds en forme']], v)}
      <p><b>Toi : ${v ?? '—'}</b>. ${v==null?'':v>=5?'Bon moment pour un test ou une séance qualitative.':v>=-10?'Rien à signaler, suis le plan.':v>=-30?'Normal en plein bloc ; les semaines allégées sont là pour remonter.':'Allège : passe la prochaine séance clé en endurance.'}</p>` }; },
  loadchart: () => ({ t:'Le graphique forme & fatigue', body:`<p><span style="color:var(--z2)">■</span> <b>Fitness</b> (CTL, 6 semaines) : la courbe lente, ton niveau de fond. Tu veux qu'elle monte doucement jusqu'à mars.</p>
      <p><span style="color:var(--z5)">■</span> <b>Fatigue</b> (ATL, 7 jours) : la courbe nerveuse, elle suit tes séances de la semaine.</p>
      <p><span style="color:var(--z3)">■</span> <b>Forme</b> (TSB) : l'écart entre les deux. Elle plonge pendant les blocs et remonte pendant les semaines allégées : c'est le rythme voulu par le plan.</p>
      <p class="muted small">Ta fitness de départ (${S.profile?.ctl0 ?? 40}) vient du questionnaire ; elle s'affine au fil des séances importées.</p>` }),
  ftp: () => { const f = ftp(), w = S.profile.weightKg;
    return { t:'FTP', body:`<p>La <b>Functional Threshold Power</b> : la puissance que tu peux tenir environ <b>1 heure</b> à fond. C'est la référence de toutes tes zones : chaque séance est exprimée en % de ta FTP, puis convertie en watts.</p>
      <p>Elle ne change qu'après un <b>test</b> (20 min × 0,95, ou meilleure minute de la rampe × 0,75).</p>
      <p><b>Toi : ${f} W</b> · ${(f/w).toFixed(2)} W/kg. Objectif ${S.profile.goalFtp} W (+${S.profile.goalFtp-f} W).</p>` }; },
  wkg: () => { const v = ftp()/S.profile.weightKg;
    return { t:'W/kg', body:`<p>Ta FTP divisée par ton poids. C'est ce qui compte <b>en montée</b> : à puissance égale, 1 kg de moins = un peu plus vite dans les cols.</p>
      ${scale([[0,2.5,'< 2,5','Débutant / loisir'],[2.5,3.2,'2,5 – 3,2','Cyclosportif régulier'],[3.2,4,'3,2 – 4,0','Bon amateur'],[4,4.8,'4,0 – 4,8','Très bon amateur / compétiteur'],[4.8,99,'> 4,8','Élite']], v)}
      <p><b>Toi : ${v.toFixed(2)} W/kg</b>. Avec ${S.profile.goalFtp} W au même poids : ${(S.profile.goalFtp/S.profile.weightKg).toFixed(2)} W/kg.</p>` }; },
  proj: () => ({ t:'Projection', body:`<p>Où devrait se situer ta FTP à la date du test final si tu continues au <b>rythme mesuré entre tes tests</b> (plafonné à +3 W/semaine pour rester réaliste).</p><p>Avant ton 2e test, l'app utilise une hypothèse prudente de +1,5 W/semaine. Elle devient fiable à partir de 2 tests.</p>` }),
  sessions: () => ({ t:'Séances', body:`<p>Le nombre de séances réalisées : celles du plan marquées comme faites, plus les sorties libres de plus de 30 min. Ton objectif : <b>${S.profile.minSessions}</b> d'ici le ${fmtShort(S.profile.endDate)}.</p>` }),
  goal: () => ({ t:'Objectif', body:`<p>La FTP visée au test final du ${fmtShort(S.profile.goalDate)}. Modifiable dans Profil.</p>` }),
  rec: k => ({ t:`Record ${k}`, body:`<p>Ta meilleure puissance moyenne sur <b>${k}</b>, toutes séances importées confondues.</p>
      <ul><li><b>5 s</b> : sprint, puissance explosive.</li><li><b>1 min</b> : capacité anaérobie (sert au test rampe).</li><li><b>5 min</b> : ta puissance VO2max, ton plafond aérobie.</li><li><b>20 min</b> : la base du test FTP (× 0,95).</li></ul>
      <p class="muted small">Les records ne viennent que des séances avec puissance (home trainer).</p>` }),
  np: () => ({ t:'Puissance normalisée (NP)', body:`<p>La puissance « ressentie » par ton corps. Elle pondère plus fort les efforts intenses : une séance à intervalles a une NP bien supérieure à sa puissance moyenne, parce que les à-coups coûtent plus cher qu'un effort régulier.</p>` }),
  if: () => ({ t:'Intensité (IF)', body:`<p>NP ÷ FTP. 1,00 = séance entière au seuil.</p>${scale([[0,.75,'< 0,75','Endurance, récup'],[.75,.85,'0,75 – 0,85','Tempo'],[.85,.95,'0,85 – 0,95','Sweet spot / seuil fractionné'],[.95,1.05,'0,95 – 1,05','Seuil, test'],[1.05,9,'> 1,05','Effort court très intense']], null)}` }),
  tss: () => ({ t:'Charge (TSS)', body:`<p>Le coût d'une séance : durée × intensité². <b>1 h à ta FTP = 100</b>. Sans capteur de puissance, il est estimé à la fréquence cardiaque.</p>${scale([[0,50,'< 50','Facile, récupéré le lendemain'],[50,100,'50 – 100','Séance normale'],[100,150,'100 – 150','Grosse séance, fatigue le lendemain'],[150,9999,'> 150','Très dure, 2 jours pour récupérer']], null)}` }),
  avgp: () => ({ t:'Puissance moyenne', body:`<p>La moyenne simple des watts sur toute la séance, récupérations comprises. Pour juger l'effort réel, regarde plutôt la NP.</p>` }),
  hr: () => ({ t:'Fréquence cardiaque', body:`<p>Moyenne et maximum de la séance, mesurés par ta ceinture. À puissance égale, une FC qui baisse au fil des semaines est un bon signe de progression ; une FC anormalement haute signale souvent fatigue, chaleur ou déshydratation.</p>` }),
  hrv: () => ({ t:'VFC (variabilité cardiaque)', body:`${trendChart('hrv')}<p>La variation du temps entre deux battements, mesurée par ta montre surtout la nuit. <b>Plus elle est haute par rapport à TA normale, mieux tu es récupéré.</b> Les valeurs ne se comparent pas entre personnes : seule ta tendance compte.</p><p>Une VFC sous ta moyenne de 30 jours plusieurs jours de suite = fatigue, stress, maladie ou alcool.</p>` }),
  rhr: () => ({ t:'FC au repos', body:`${trendChart('rhr')}<p>Ton pouls au repos (mesuré par la montre). Elle baisse quand ta forme s'améliore. <b>+5 bpm ou plus</b> par rapport à ta moyenne : signe de fatigue ou d'infection qui arrive, à prendre au sérieux avant une séance dure.</p>` }),
  sleep: () => ({ t:'Sommeil', body:`${sleepDetail()}<p>Le temps réellement endormi la nuit dernière. C'est pendant le sommeil profond que le corps assimile l'entraînement : sous <b>6 h</b>, la séance clé du jour rapportera moins et coûtera plus.</p><p>Profond = récupération physique ; paradoxal = récupération nerveuse et mémoire.</p>` }),
  weight: () => ({ t:'Poids', body:`${trendChart('weight')}<p>Ta dernière pesée Apple Santé (Withings). Il sert au calcul des W/kg. Si elle diffère de ton profil, l'app te propose de le mettre à jour.</p>` }),
  score: () => { const sc = Health.score(); if (!sc) return { t:'Énergie', body:'<p>Pas encore assez de données Santé.</p>' };
    return { t:`Énergie · ${sc.v}/100`, body:`${trendChart('score')}<p>Ton état de récupération du jour, calculé à partir de <b>tes propres habitudes</b> (60 derniers jours), pas d'une norme générale.</p>
      <div class="infoscale">${sc.parts.map(p => `<div><b>${p.k} · ${Math.round(p.s)}</b><span>${esc(p.d)} <span class="muted">(poids ${Math.round(p.w*100)} %)</span></span></div>`).join('')}</div>
      <ul><li><b>VFC</b> : comparée à ta moyenne et ta variabilité habituelles (échelle logarithmique, méthode utilisée en recherche sur l'entraînement).</li><li><b>FC repos</b> : chaque bpm au-dessus de ta moyenne fait baisser l'indice.</li><li><b>Sommeil</b> : la nuit dernière (60 %) et les 3 dernières (40 %) ; 8 h = plein score, 5 h = zéro.</li><li><b>Charge</b> : ta forme (TSB) ; très fatigué = pénalité.</li></ul>
      ${scale([[75,101,'75 – 100','Prêt : bon jour pour pousser'],[55,75,'55 – 75','Correct : séance prévue'],[40,55,'40 – 55','Prudence : cibles −3 à −5 %'],[0,40,'< 40','Récupère : endurance ou repos']], sc.v)}
      <p class="muted small">C'est un indicateur, pas un diagnostic : si tu te sens mal, écoute ton corps avant le chiffre.</p>` }; },
  ftpchart: () => ({ t:'FTP vs objectif', body:`<p>La ligne pointillée grise est la <b>trajectoire</b> qui mène de ta FTP de départ à ton objectif. Les points orange sont tes <b>tests</b>. Au-dessus de la ligne : tu es en avance.</p><p>Les petits points bleus = 95 % de ton meilleur 20 min de chaque séance : un indicateur, pas une FTP officielle.</p>` }),
  recov: () => ({ t:'Récupération', body:`<p>La VFC (vert) qui monte et la FC repos (rouge) qui baisse sur plusieurs semaines = tu encaisses bien l'entraînement. L'inverse pendant plusieurs jours = il faut alléger.</p><p>Les barres = durée de tes nuits (bleu ≥ 7 h, orange 6-7 h, rouge &lt; 6 h).</p>` }),
};
function infoKey(label){
  const l = label.trim();
  if (/CTL|^Fitness/.test(l)) return 'ctl'; if (/ATL|^Fatigue/.test(l)) return 'atl'; if (/TSB|^Forme/.test(l)) return 'tsb';
  if (/^FTP/i.test(l)) return 'ftp'; if (/W\/kg/i.test(l) && !/^(5 s|1 min|5 min|20 min)/i.test(l)) return 'wkg'; if (/^Projection/i.test(l)) return 'proj';
  if (/^Séances/i.test(l)) return 'sessions'; if (/^Objectif/i.test(l)) return 'goal';
  const r = l.match(/^(5 s|1 min|5 min|20 min)/i); if (r) return 'rec:' + r[1];
  if (/^NP$/i.test(l)) return 'np'; if (/^IF$/i.test(l)) return 'if'; if (/^TSS$/i.test(l)) return 'tss'; if (/^P\. moy/i.test(l)) return 'avgp';
  if (/^FC (moy|max)/i.test(l)) return 'hr'; if (/^VFC/i.test(l)) return 'hrv'; if (/^FC repos/i.test(l)) return 'rhr'; if (/^Sommeil/i.test(l)) return 'sleep'; if (/^Poids/i.test(l)) return 'weight';
  return null;
}
const H2INFO = { 'Forme & fatigue':'loadchart', 'FTP vs objectif':'ftpchart', 'Récupération (6 sem.)':'recov' };
function decorateInfo(root = document){
  root.querySelectorAll('.kpi:not([data-act])').forEach(k => { const l = k.querySelector('.l'); const key = l && infoKey(l.textContent); if (key) k.dataset.i = key; });
  root.querySelectorAll('h2').forEach(h2 => { const key = H2INFO[h2.textContent.trim()]; if (key) h2.dataset.i = key; });
}
function showInfo(key){
  const [k, arg] = key.split(':'); const f = INFO[k === 'rec' ? 'rec' : k]; if (!f) return;
  const { t, body } = f(arg);
  const d = $('#infoDlg'); $('#infoBody').innerHTML = `<button class="x" data-closeinfo aria-label="Fermer">×</button><h2 style="margin-bottom:8px">${esc(t)}</h2><div class="small" style="line-height:1.55">${body}</div><div class="row" style="margin-top:12px"><button class="btn" data-closeinfo>Compris</button></div>`;
  if (!d.open) d.showModal();
}
document.addEventListener('click', e => {
  if (e.target.closest('[data-closeinfo]') || e.target.id === 'infoDlg') { $('#infoDlg').close(); return; }
  const el = e.target.closest('[data-i]'); if (el && !e.target.closest('button,input,select,a')) showInfo(el.dataset.i);
});
new MutationObserver(() => decorateInfo()).observe(document.body, { childList:true, subtree:true });

let recGoal = false; // records de puissance : afficher la projection à la FTP objectif
document.addEventListener('click', e => { if (e.target.closest('[data-recgoal]')) { recGoal = !recGoal; render(); } });

/* ============ défis (squats, chaise…) ============ */
const BULGARES = start => ({ id:'bulgares', name:'Squats bulgares', unit:'reps', target:2500, step:[16,32,64], start, end:'2027-03-15', entries:{} });
const DEFAULT_CHALLENGES = () => [
  BULGARES('2026-10-21'),
  { id:'chaise', name:'Chaise', unit:'min', target:300, step:[1,2,5], start:'2026-10-21', end:'2027-03-15', entries:{} },
];
function challenges(){
  if (!S.challenges) S.challenges = DEFAULT_CHALLENGES();
  // nov. 2026 : les squats au poids du corps laissent la place aux squats bulgares lestés ; l'historique des squats est archivé
  const sq = S.challenges.find(c => c.id === 'squats');
  if (sq && !sq.archived && !S.challenges.some(c => c.id === 'bulgares')) {
    const t = todayISO(); sq.archived = t; S.challenges.splice(S.challenges.indexOf(sq), 1, BULGARES(t)); S.challenges.push(sq); save();
  }
  return S.challenges;
}
const activeChallenges = () => challenges().filter(c => !c.archived);
const CH_UNIT = { squats:'squats', reps:'répétitions', min:'de chaise' };
const chTotal = c => Object.values(c.entries).reduce((a,b)=>a+b,0);
const fmtCh = (c, v) => c.unit === 'min' ? (v >= 60 ? `${Math.floor(v/60)} h ${pad(Math.round(v%60))}` : `${(+v.toFixed(1)).toLocaleString('fr-FR')} min`) : Math.round(v).toLocaleString('fr-FR');
function archivedChallengesHTML(){
  const arch = challenges().filter(c => c.archived);
  if (!arch.length) return '';
  return `<div class="card"><h2>Défis archivés</h2>${arch.map(c => `<div class="hist" data-chedit="${c.id}" role="button" tabindex="0" style="cursor:pointer"><div style="flex:1"><b>${esc(c.name)}</b><div class="tiny muted">Du ${fmtShort(c.start)} au ${fmtShort(c.archived)} · ${Object.values(c.entries).filter(v => v > 0).length} jours actifs</div></div><span class="chip num">${fmtCh(c, chTotal(c))} ${c.unit === 'min' ? '' : CH_UNIT[c.unit] || ''}</span></div>`).join('')}</div>`;
}
function chAdd(id, v){
  const c = challenges().find(x => x.id === id); if (!c || !(v > 0)) return toast('Indique un nombre');
  const t = todayISO(); c.entries[t] = +((c.entries[t] || 0) + v).toFixed(2);
  (c.log ||= []).push({ ts: Date.now(), v }); // journal horodaté : qui voit « +50 à 12:51 »
  save(); render(); toast(`+${fmtCh(c, v)} ${CH_UNIT[c.unit] || c.unit} 💪`);
}
// détail d'un défi : chiffres clés, 30 derniers jours, journal jour par jour avec l'heure de chaque ajout, corrections
function chEditDlg(id){
  const c = challenges().find(x => x.id === id); if (!c) return;
  const t = todayISO(), days = Object.keys(c.entries).filter(d => c.entries[d] > 0).sort().reverse();
  const done = chTotal(c), active = days.length;
  let streak = 0; for (let d = c.entries[t] > 0 ? t : addDays(t, -1); c.entries[d] > 0; d = addDays(d, -1)) streak++;
  const best = days.reduce((m, d) => c.entries[d] > (c.entries[m] || 0) ? d : m, null);
  const last30 = Array.from({ length: 30 }, (_, i) => addDays(t, i - 29)), max30 = Math.max(1, ...last30.map(d => c.entries[d] || 0));
  const byDay = {}; for (const e of c.log || []) { const d = iso(new Date(e.ts)); (byDay[d] ||= []).push(e); }
  const hm = ts => { const x = new Date(ts); return `${pad(x.getHours())}:${pad(x.getMinutes())}`; };
  const kpi = (v, l) => `<div class="kpi"><div class="v num" style="font-size:22px">${v}</div><div class="l">${l}</div></div>`;
  openDlg(`<span class="muted small">Du ${fmtShort(c.start)} au ${fmtShort(c.end)}</span><h2 style="margin:4px 0 10px">${esc(c.name)}</h2>
    <div class="grid4">${kpi(fmtCh(c, done), `sur ${fmtCh(c, c.target)}`)}${kpi(active, `jour${active > 1 ? 's' : ''} actif${active > 1 ? 's' : ''}`)}${kpi(streak, 'jours d\'affilée')}${kpi(best ? fmtCh(c, c.entries[best]) : '—', best ? `record · ${fmtShort(best)}` : 'record')}</div>
    <div style="display:flex;align-items:flex-end;gap:3px;height:80px;margin:14px 0 4px">${last30.map(d => `<div title="${fmtShort(d)} · ${fmtCh(c, c.entries[d] || 0)}" style="flex:1;height:${Math.max(3, (c.entries[d] || 0)/max30*100)}%;border-radius:3px 3px 0 0;background:${c.entries[d] ? 'var(--accent)' : 'var(--line)'}${d === t ? ';outline:1.5px solid var(--text);outline-offset:1px' : ''}"></div>`).join('')}</div>
    <div class="row between tiny muted"><span>${fmtShort(last30[0])}</span><span>30 derniers jours</span><span>aujourd'hui</span></div>
    <h3 style="margin-top:16px">Ce que tu as fait</h3>
    <div>${days.length ? days.slice(0, chShowAll ? days.length : 14).map(d => `<div class="hist" style="align-items:flex-start"><div style="flex:1;min-width:0"><b>${fmtDate(d)}</b>
        ${byDay[d]?.length ? `<div class="tiny muted">${byDay[d].sort((x, y) => x.ts - y.ts).map(e => `${e.v < 0 ? '' : '+'}${fmtCh(c, e.v)} à ${hm(e.ts)}`).join(' · ')}</div>` : '<div class="tiny muted">total du jour (saisi avant l\'horodatage)</div>'}</div>
        <b class="num">${fmtCh(c, c.entries[d])}</b></div>`).join('') + (days.length > 14 && !chShowAll ? `<button class="btn ghost more" id="chMore">+ Découvrir (${days.length} jours)</button>` : '')
      : '<p class="muted small">Aucune saisie pour l’instant.</p>'}</div>
    <details style="margin-top:14px"><summary class="small" style="cursor:pointer;font-weight:600">Corriger ou modifier l'objectif</summary>
      <div class="grid2"><div><label class="f" for="chT">Objectif (${c.unit==='min'?'minutes':'répétitions'})</label><input type="number" id="chT" value="${c.target}"></div><div><label class="f" for="chE">Échéance</label><input type="date" id="chE" value="${c.end}"></div></div>
      <label class="f" for="chD">Total d'un jour (0 pour l'effacer)</label><div class="row"><input type="date" id="chD" value="${t}" style="flex:1"><input type="text" inputmode="decimal" id="chV" placeholder="total du jour" style="width:120px"><button class="btn" id="chSet">Appliquer</button></div>
      <div class="row" style="margin-top:12px"><button class="btn primary" id="chSave">Enregistrer l'objectif</button></div></details>`);
  $('#chMore') && ($('#chMore').onclick = () => { chShowAll = true; chEditDlg(id); });
  $('#chSet').onclick = () => { const d = $('#chD').value, v = parseFloat(String($('#chV').value).replace(',','.')); if (!d || isNaN(v)) return toast('Date et valeur');
    const before = c.entries[d] || 0; if (v <= 0) delete c.entries[d]; else c.entries[d] = v;
    if (v - before) (c.log ||= []).push({ ts: Date.parse(d + 'T12:00:00') || Date.now(), v: +(Math.max(v, 0) - before).toFixed(2), fix: true });
    save(); chEditDlg(id); render(); };
  $('#chSave').onclick = () => { const tv = +$('#chT').value; if (tv > 0) c.target = tv; if ($('#chE').value) c.end = $('#chE').value; save(); closeDlg(); render(); };
}
let chShowAll = false;
document.addEventListener('click', e => {
  const a = e.target.closest('[data-chadd]');
  if (a) { const id = a.dataset.chadd; const v = a.dataset.v ? +a.dataset.v : parseFloat(String($('#chIn-'+id).value).replace(',','.')); chAdd(id, v); return; }
  const ed = e.target.closest('[data-chedit]'); if (ed) chEditDlg(ed.dataset.chedit);
  const ti = e.target.closest('[data-toggleindoor]'); if (ti) { const a = S.activities.find(x => x.id === ti.dataset.toggleindoor); if (a) { a.indoor = !isIndoor(a); save(); activityDlg(a.id); render(); } }
});

let DSEL = null; // carte ouverte dans la pile « Mes défis »
const CH_TINT = { bulgares:'var(--accent)', squats:'var(--accent)', chaise:'var(--h-def)', mobilite:'var(--h-prog1)' };
function challengesHTML(){
  const t = todayISO(), act = activeChallenges();
  const cards = act.map(c => {
    const done = chTotal(c), pct = clamp(done/c.target*100, 0, 100);
    const totalDays = Math.max(diffDays(c.start, c.end) + 1, 1), elapsed = clamp(diffDays(c.start, t) + 1, 0, totalDays);
    const expected = c.target * elapsed / totalDays, ahead = done - expected;
    const left = Math.max(c.target - done, 0), daysLeft = Math.max(diffDays(t, c.end) + 1, 1);
    const perDay = left / daysLeft, today = c.entries[t] || 0;
    const stCol = ahead >= 0 ? 'var(--ok)' : ahead > -c.target*0.03 ? 'var(--warn)' : 'var(--bad)';
    return { id:c.id, tint: CH_TINT[c.id] || (c.shared ? 'var(--h-prog2)' : 'var(--accent)'),
      head:(open) => `<div class="row between${open ? ' chhead' : ''}"${open ? ` data-chedit="${c.id}" role="button" tabindex="0" title="Voir le détail"` : ''}><b>${esc(c.name)}${c.shared ? ' <span class="chip tiny">entre amis</span>' : ''} <span class="muted" style="font-weight:400">›</span></b><span class="num small"><b>${fmtCh(c, done)}</b> / ${fmtCh(c, c.target)} · ${Math.floor(pct)} %</span></div>
        <div class="bar" style="margin:8px 0;position:relative"><i style="width:${pct}%"></i><span title="Rythme prévu" style="position:absolute;top:-3px;bottom:-3px;left:${clamp(expected/c.target*100,0,100)}%;width:2px;background:var(--text);opacity:.5"></span></div>`,
      body:`<div class="tiny muted">Aujourd'hui : <b style="color:var(--text)">${fmtCh(c, today)}</b> · objectif du jour ~${fmtCh(c, perDay)} · <span style="color:${stCol}">${ahead >= 0 ? `${fmtCh(c, ahead)} d'avance` : `${fmtCh(c, -ahead)} de retard`}</span></div>
      <div class="row" style="margin-top:8px;gap:6px">${c.step.map(s => `<button class="btn sm" data-chadd="${c.id}" data-v="${s}">+${s}${c.unit==='min'?' min':''}</button>`).join('')}
        <input type="text" inputmode="decimal" id="chIn-${c.id}" placeholder="${c.unit==='min'?'min':'nb'}" style="width:76px;min-height:32px;padding:4px 8px">
        <button class="btn sm primary" data-chadd="${c.id}">Ajouter</button>
        <button class="btn sm ghost" data-chedit="${c.id}">Détail</button></div>` };
  });
  cards.push(Mobility.card());
  if (!cards.some(x => x.id === DSEL)) DSEL = cards[0].id;
  return `<div class="card"><div class="row between"><h2>Mes défis</h2><span class="muted small">jusqu'au ${fmtShort(act[0]?.end || todayISO())}</span></div>
    <div class="dstack">${cards.map(x => { const open = x.id === DSEL;
      return `<div class="dcard${open ? ' open' : ' shut'}" style="--tint:${x.tint}"${open ? '' : ` data-dsel="${x.id}" role="button" tabindex="0" aria-label="Ouvrir ${x.id}"`}>${x.head(open)}${open ? `<div class="dbody">${x.body}</div>` : ''}</div>`; }).join('')}</div></div>` + archivedChallengesHTML();
}
document.addEventListener('click', e => { const s = e.target.closest('[data-dsel]'); if (s) { DSEL = s.dataset.dsel; render(); } });
