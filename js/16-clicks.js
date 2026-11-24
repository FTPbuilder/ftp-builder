"use strict";
// FTP Builder · délégation des clics
/* ============ délégation des clics ============ */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-open],[data-log],[data-export],[data-act],[data-lib],[data-add],[data-absence],[data-undoabs],[data-proto],[data-coach],#expJson,#impJson,#reset');
  if (!t) return;
  if (t.dataset.open) sessionDlg(t.dataset.open);
  else if (t.dataset.log !== undefined) logDlg(t.dataset.log);
  else if (t.dataset.export) exportWorkout(S.plan.find(s=>s.id===t.dataset.export));
  else if (t.dataset.act) activityDlg(t.dataset.act);
  else if (t.dataset.lib) openDlg(`<h2>${esc(WORKOUTS[t.dataset.lib].name)}</h2><p class="muted small">${esc(WORKOUTS[t.dataset.lib].goal)}</p>${profileBars(t.dataset.lib)}<div style="margin-top:10px">${stepsTable(t.dataset.lib)}</div><div class="row" style="margin-top:12px"><button class="btn" data-export-lib="${t.dataset.lib}">Envoyer sur l'Edge (.fit)</button><button class="btn" data-zwo-lib="${t.dataset.lib}">Fichier .zwo</button></div>`);
  else if (t.dataset.add) addSessionDlg();
  else if (t.dataset.absence) absenceDlg();
  else if (t.dataset.undoabs) undoAbsence(t.dataset.undoabs);
  else if (t.dataset.proto) switchTestProtocol(t.dataset.proto);
  else if (t.dataset.coach) { const n = window._coach?.[+t.dataset.coach]; if (n?.action) { n.action.f(); save(); render(); toast('Cibles ajustées'); } }
  else if (t.id === 'expJson') exportJSON();
  else if (t.id === 'impJson') importJSON();
  else if (t.id === 'reset') { if (confirmReset()) { S = blank(); _draft = null; save(); Library.wipeLocal(); Garage.wipeLocal(); render(); } }
});
document.addEventListener('click', e => { const b = e.target.closest('[data-export-lib]'); if (b) exportWorkout(b.dataset.exportLib); });
document.addEventListener('click', e => { const b = e.target.closest('[data-zwo],[data-zwo-lib]'); if (!b) return; if (b.dataset.zwoLib) return exportZwo(b.dataset.zwoLib); const s = S.plan.find(x => x.id === b.dataset.zwo); if (s) exportZwo(s); });
document.addEventListener('click', e => { if (!e.target.closest('[data-calib]')) return; const c = Levels.calibrate('manuel'); if (!c) return; render();
  toast(c.changes.length ? `${c.changes.length} séance${c.changes.length > 1 ? 's' : ''} recalée${c.changes.length > 1 ? 's' : ''} sur tes niveaux` : c.seen.length ? 'Programme déjà au bon niveau' : "Pas encore assez de séances évaluées pour recaler le programme"); });
document.addEventListener('change', e => { if (e.target.id === 'themeSel') { S.settings.theme = e.target.value; save(); applyTheme(); } });
let _resetArm = 0;
function confirmReset(){ const now = Date.now(); if (now - _resetArm < 4000) return true; _resetArm = now; toast('Touchez encore « Tout effacer » pour confirmer'); return false; }
