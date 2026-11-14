"use strict";
// FTP Builder · démarrage, mise à jour, accès pour les tests
if (S.profile && repairAutoLinks()) save();
const _cal = (() => { try { return Levels.monthly(); } catch(e) { Errors.report(e, 'calibrage'); return null; } })(); // calibrage mensuel des niveaux
render();
if (_cal) setTimeout(() => toast(`Calibrage du mois : ${_cal.changes.length ? `${_cal.changes.length} séance${_cal.changes.length > 1 ? 's' : ''} recalée${_cal.changes.length > 1 ? 's' : ''} sur tes niveaux` : 'programme déjà au bon niveau'}`), 600);
Cloud.init().catch(e => console.warn('cloud', e));
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(()=>{});
// mise à jour : iOS garde parfois l'ancienne page en cache ; on vérifie la version en ligne et on recharge une fois si elle a changé
async function checkUpdate(){
  if (location.protocol !== 'https:' || /[?&](code|state|error)=/.test(location.search) || location.hash.includes('access_token')) return; // jamais pendant un retour de connexion
  try {
    const txt = await (await fetch(location.pathname + '?v=' + Date.now(), { cache:'no-store' })).text();
    const v = (txt.match(/const APP_VERSION = '([\d.]+)'/) || [])[1];
    if (v && v !== APP_VERSION && sessionStorage.getItem('ftpb_upd') !== v) { sessionStorage.setItem('ftpb_upd', v); location.replace(location.pathname + '?u=' + v + location.hash); }
  } catch(e){}
}
checkUpdate(); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkUpdate(); });
setTimeout(() => { const ts = $('#themeSel'); if (ts) ts.value = S.settings.theme; }, 0);
// accès pour les tests
window.FTPB = { FIT, WORKOUTS, Levels, WLVL, WFAM, applyWarmupPref, wuSec, generatePlan, encodeWorkout, activityFromFit, powerSeries, defaultProfile, compliance, sessionEval, render, save, get S(){ return S; } };
