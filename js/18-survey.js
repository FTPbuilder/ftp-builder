"use strict";
// FTP Builder · questionnaire d'avis (accessibilité et fluidité) : proposé une fois à l'ouverture, après la connexion.
// Réponses → table feedback_surveys (l'admin les lit dans Supabase). Suivi dans S.settings.surveys[id] : 'done' | 'no' | date du « Plus tard ».
const Survey = (() => {
  const ID = 'ux-2026-11';
  const QS = [
    ['nav', 'Trouver ce que tu cherches', "Menus, onglets, boutons : on s'y retrouve facilement ?", 'Navigation'],
    ['read', 'Lisibilité', 'Taille des textes, contrastes, boutons assez grands sur ton téléphone ?', 'Lisibilité'],
    ['smooth', 'Fluidité', "Ouverture de l'app, chargements, animations et vues 3D sans à-coups ?", 'Fluidité'],
    ['daily', 'Au quotidien', 'Importer une séance, consulter le plan, saisir une info : simple et rapide ?', 'Quotidien'],
  ];
  const SCALE = [[1, 'Pas du tout'], [2, 'Plutôt pas'], [3, 'Moyen'], [4, 'Plutôt oui'], [5, 'Tout à fait']];
  let ans = {};
  const st = () => (S.settings.surveys ||= {});
  // à proposer : compte connecté, profil créé, pas de visite guidée ni de fenêtre ouverte, pas déjà répondu / refusé, « Plus tard » il y a au moins un jour
  function due(){
    const v = st()[ID]; if (!S.profile || !Cloud.user || !Cloud.sb || Tour.open || dlg.open || v === 'done' || v === 'no') return false;
    return !v || v < todayISO();
  }
  function maybe(){ setTimeout(() => { if (due()) show(); }, 2500); } // laisse l'écran d'ouverture s'effacer
  function show(){
    ans = {};
    openDlg(`<h3 style="margin:0 0 4px">Ton avis sur l'app 🙏</h3>
      <p class="small muted" style="margin:0 0 12px">4 questions et un mot libre, moins d'une minute. Ça m'aide à rendre FTP Builder plus simple et plus fluide.</p>
      ${QS.map(([k, t, d], i) => `<div class="sv-q" style="margin:0 0 14px"><b>${i + 1}. ${t}</b><div class="small muted">${d}</div>
        <div class="seg" role="radiogroup" aria-label="${esc(t)}" style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:8px">${SCALE.map(([n, l]) => `<button type="button" role="radio" aria-checked="false" aria-label="${n} : ${l}" data-sv="${k}" data-n="${n}" style="min-height:44px;padding:0;justify-content:center">${n}</button>`).join('')}</div>
        <div class="tiny muted" style="display:flex;justify-content:space-between;margin-top:3px"><span>Pas du tout</span><span>Tout à fait</span></div></div>`).join('')}
      <label class="small" for="svTxt"><b>Suggestions, améliorations, bugs</b> <span class="muted">(facultatif)</span></label>
      <textarea id="svTxt" rows="4" maxlength="1500" placeholder="Ce qui te gêne, ce qui manque, une idée…" style="width:100%;margin:6px 0 12px;font-size:15px"></textarea>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn primary" data-svgo="send">Envoyer</button><button type="button" class="btn ghost" data-svgo="later">Plus tard</button><button type="button" class="btn ghost" data-svgo="no">Non merci</button></div>`);
  }
  async function send(){
    const miss = QS.filter(([k]) => !ans[k]); if (miss.length) return toast(`Il manque une réponse : ${miss[0][1]}`);
    const row = { survey: ID, ...Object.fromEntries(QS.map(([k]) => [k, ans[k]])), comment: ($('#svTxt')?.value || '').trim().slice(0, 1500) || null, who: (S.profile?.name || '').trim().slice(0, 60) || null, app_version: APP_VERSION,
      device: `${innerWidth}×${innerHeight} · ${matchMedia('(display-mode: standalone)').matches ? 'app' : 'navigateur'} · ${navigator.userAgent.slice(0, 160)}` };
    const b = $('[data-svgo="send"]'); if (b) b.disabled = true;
    const { error } = await Cloud.sb.from('feedback_surveys').insert(row);
    if (error && error.code !== '23505') { if (b) b.disabled = false; Errors.report(new Error(error.message), 'feedback_surveys'); return toast('Envoi impossible : ' + error.message); }
    st()[ID] = 'done'; save(); closeDlg(); toast('Merci pour ton avis ! 🙌');
  }
  document.addEventListener('click', e => {
    const r = e.target.closest('[data-sv]');
    if (r) { ans[r.dataset.sv] = +r.dataset.n; for (const x of r.parentElement.children) { const on = x === r; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); } return; }
    const g = e.target.closest('[data-svgo]'); if (!g) return;
    if (g.dataset.svgo === 'send') return send();
    st()[ID] = g.dataset.svgo === 'no' ? 'no' : todayISO(); save(); closeDlg(); if (g.dataset.svgo === 'later') toast('Je te le reproposerai demain');
  });
  return { maybe, show, due, ID, QS };
})();
