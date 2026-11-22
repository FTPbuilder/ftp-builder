"use strict";
// FTP Builder · questionnaire d'avis : proposé une fois à l'ouverture, après la connexion. 6 questions courtes + suggestions libres.
// Réponses → table feedback_surveys (answers en JSON) ; l'admin les lit dans Profil › 📮 Demandes › Avis.
// Suivi dans S.settings.surveys[id] : 'done' | 'no' | date du « Plus tard ».
const Survey = (() => {
  const ID = 'avis-2026-11';
  const NB = { oui: 'Oui', parfois: 'Parfois', non: 'Non', na: 'Pas utilisé' };
  // type : scale (1 à 5), choice (une réponse), rows (une réponse par ligne) ; sh = libellé court pour l'admin
  const QS = [
    { k: 'sat', sh: 'Satisfaction', q: "Es-tu satisfait de l'app ?", type: 'scale' },
    { k: 'follow', sh: 'Suit le programme', q: "Suis-tu le programme d'entraînement ?", type: 'choice',
      opts: [['toujours', 'Toujours'], ['souvent', 'Souvent'], ['parfois', 'Parfois'], ['rarement', 'Rarement'], ['jamais', 'Pas du tout']] },
    { k: 'fit', sh: 'Programme adapté', q: 'Le programme correspond-il à ce que tu recherches ?', type: 'scale' },
    { k: 'sync', sh: 'Synchronisation', q: 'Tout arrive bien là où il faut ?', type: 'rows', opts: Object.entries(NB),
      rows: [['sync_dev', 'Les séances sur ton compteur', 'Séances → compteur'], ['sync_app', "Tes activités dans l'app", 'Activités → app']] },
    { k: 'ease', sh: 'Facile et fluide', q: "L'app est-elle facile à utiliser, fluide et réactive ?", type: 'scale' },
    { k: 'social', sh: 'Partie sociale', q: 'Utilises-tu la partie sociale (amis, partage de traces, défis) ?', type: 'choice',
      opts: [['souvent', 'Oui, souvent'], ['parfois', 'De temps en temps'], ['non', "Non, ça ne m'intéresse pas"], ['inconnu', 'Je ne savais pas que ça existait']] },
  ];
  const KEYS = QS.flatMap(x => x.rows ? x.rows.map(r => r[0]) : [x.k]);
  const qOf = key => QS.find(x => x.k === key || x.rows?.some(r => r[0] === key));
  const labelOf = (key, v) => { const x = qOf(key); return x.type === 'scale' ? `${v}/5` : (x.opts.find(o => o[0] === v) || [, v])[1]; };
  let ans = {};
  const st = () => (S.settings.surveys ||= {});
  // à proposer : compte connecté, profil créé, pas de visite guidée ni de fenêtre ouverte, pas déjà répondu / refusé, « Plus tard » il y a au moins un jour
  function due(){
    const v = st()[ID]; if (!S.profile || !Cloud.user || !Cloud.sb || Tour.open || dlg.open || v === 'done' || v === 'no') return false;
    return !v || v < todayISO();
  }
  function maybe(){ setTimeout(() => { if (due()) show(); }, 2500); } // laisse l'écran d'ouverture s'effacer
  const group = (key, opts, label, grid) => `<div class="seg" role="radiogroup" aria-label="${esc(label)}" style="${grid ? 'display:grid;grid-template-columns:repeat(5,1fr);' : ''}gap:6px;margin-top:8px">${opts.map(([v, l]) =>
    `<button type="button" role="radio" aria-checked="false" aria-label="${esc(l)}" data-sv="${key}" data-v="${v}" style="min-height:44px${grid ? ';padding:0;justify-content:center' : ''}">${grid ? v : esc(l)}</button>`).join('')}</div>`;
  function qHTML(x, i){
    const head = `<b>${i + 1}. ${x.q}</b>`;
    if (x.type === 'scale') return `${head}${group(x.k, [1, 2, 3, 4, 5].map(n => [n, String(n)]), x.q, true)}<div class="tiny muted" style="display:flex;justify-content:space-between;margin-top:3px"><span>Pas du tout</span><span>Tout à fait</span></div>`;
    if (x.type === 'choice') return head + group(x.k, x.opts, x.q);
    return head + x.rows.map(([k, l]) => `<div class="small" style="margin-top:8px">${l}</div>${group(k, x.opts, l)}`).join('');
  }
  function show(){
    ans = {};
    openDlg(`<h3 style="margin:0 0 4px">Ton avis sur l'app 🙏</h3>
      <p class="small muted" style="margin:0 0 12px">7 questions, une minute. Tes réponses, envoyées avec ton prénom, m'aident à améliorer FTP Builder.</p>
      ${QS.map((x, i) => `<div style="margin:0 0 16px">${qHTML(x, i)}</div>`).join('')}
      <label for="svTxt"><b>${QS.length + 1}. Des suggestions d'amélioration ou des modules à créer ?</b> <span class="small muted">(facultatif)</span></label>
      <textarea id="svTxt" rows="4" maxlength="1500" placeholder="Ce qui te gêne, ce qui manque, une idée…" style="width:100%;margin:6px 0 12px;font-size:15px"></textarea>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn primary" data-svgo="send">Envoyer</button><button type="button" class="btn ghost" data-svgo="later">Plus tard</button><button type="button" class="btn ghost" data-svgo="no">Non merci</button></div>`);
  }
  async function send(){
    const miss = KEYS.find(k => ans[k] == null); if (miss) return toast(`Il manque une réponse : question ${QS.indexOf(qOf(miss)) + 1}`);
    const row = { survey: ID, answers: { ...ans }, comment: ($('#svTxt')?.value || '').trim().slice(0, 1500) || null, who: (S.profile?.name || '').trim().slice(0, 60) || null, app_version: APP_VERSION,
      device: `${innerWidth}×${innerHeight} · ${matchMedia('(display-mode: standalone)').matches ? 'app' : 'navigateur'} · ${navigator.userAgent.slice(0, 160)}` };
    const b = $('[data-svgo="send"]'); if (b) b.disabled = true;
    const { error } = await Cloud.sb.from('feedback_surveys').insert(row);
    if (error && error.code !== '23505') { if (b) b.disabled = false; Errors.report(new Error(error.message), 'feedback_surveys'); return toast('Envoi impossible : ' + error.message); }
    st()[ID] = 'done'; save(); closeDlg(); toast('Merci pour ton avis ! 🙌');
  }
  document.addEventListener('click', e => {
    const r = e.target.closest('[data-sv]');
    if (r) { const x = qOf(r.dataset.sv); ans[r.dataset.sv] = x.type === 'scale' ? +r.dataset.v : r.dataset.v; for (const y of r.parentElement.children) { const on = y === r; y.classList.toggle('on', on); y.setAttribute('aria-checked', on); } return; }
    const g = e.target.closest('[data-svgo]'); if (!g) return;
    if (g.dataset.svgo === 'send') return send();
    st()[ID] = g.dataset.svgo === 'no' ? 'no' : todayISO(); save(); closeDlg(); if (g.dataset.svgo === 'later') toast('Je te le reproposerai demain');
  });

  /* ---------- côté admin (boîte aux lettres) : synthèse, réponses, texte à copier ---------- */
  const colOf = v => v >= 4 ? 'var(--good, #2fbf71)' : v >= 3 ? 'var(--warn, #f2b134)' : 'var(--bad, #e5484d)';
  const bar = (l, val, pct, c) => `<div style="margin-top:8px"><div class="row between small" style="gap:8px"><span>${l}</span><b>${val}</b></div>
    <div style="height:6px;border-radius:3px;background:var(--bg2);overflow:hidden;margin-top:3px"><div style="height:100%;width:${pct}%;background:${c}"></div></div></div>`;
  function summaryHTML(F){
    const A = F.map(f => f.answers || {}), n = A.length;
    const dist = (key, opts) => opts.map(([v, l]) => { const c = A.filter(a => a[key] === v).length; return bar(esc(l), c, n ? c/n*100 : 0, 'var(--accent)'); }).join('');
    return `<div class="card"><b>${n} réponse${n > 1 ? 's' : ''}</b>${QS.map(x => {
      if (x.type === 'scale') { const vs = A.map(a => +a[x.k]).filter(Boolean), m = vs.length ? vs.reduce((s, v) => s + v, 0)/vs.length : 0;
        return bar(`<b>${x.sh}</b>`, `${m.toFixed(1).replace('.', ',')} / 5`, m/5*100, colOf(m)); }
      if (x.type === 'choice') return `<div style="margin-top:12px"><b class="small">${x.sh}</b>${dist(x.k, x.opts)}</div>`;
      return x.rows.map(([k, , sh]) => `<div style="margin-top:12px"><b class="small">${sh}</b>${dist(k, x.opts)}</div>`).join('');
    }).join('')}</div>`;
  }
  const shOf = k => { const x = qOf(k); return x.rows ? x.rows.find(r => r[0] === k)[2] : x.sh; };
  const chipsHTML = f => { const a = f.answers || {}; return KEYS.map(k => { const x = qOf(k), v = a[k];
    const c = x.type === 'scale' ? colOf(+v) : ['non', 'jamais', 'rarement'].includes(v) ? 'var(--bad, #e5484d)' : 'var(--line)';
    return `<span class="chip" style="border-color:${c}">${esc(shOf(k))} <b>${esc(v == null ? '—' : labelOf(k, v))}</b></span>`; }).join(''); };
  const text = f => { const a = f.answers || {}; return `Avis FTP Builder (v${f.app_version || '?'}) de ${f.who || 'un membre'} : ${KEYS.map(k => `${shOf(k)} ${a[k] == null ? '—' : labelOf(k, a[k])}`).join(', ')}${f.comment ? ` — suggestions : « ${f.comment} »` : ''}`; };
  return { maybe, show, due, ID, QS, KEYS, summaryHTML, chipsHTML, text };
})();
