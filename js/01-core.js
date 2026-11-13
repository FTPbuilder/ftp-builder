"use strict";
// FTP Builder · configuration, utilitaires, état local S, zones, bibliothèque de séances
/* ---- configuration cloud ---- */
const SB_URL = 'https://jhemwfhmohqncywjixgh.supabase.co';
const SB_KEY = 'sb_publishable_zrv0VlJ43zNW4IyGZEuByw_4HRwzzF5';
const STRAVA_CLIENT_ID = '295896';
const ICU_CLIENT_ID = '1775'; // intervals.icu › Réglages › Apps › Manage App (après validation) ; vide = connexion par clé API
const ICU_SCOPE = 'ACTIVITY:READ,WELLNESS:READ,CALENDAR:WRITE,SETTINGS:READ'; // strava.com/settings/api > Client ID (public ; le secret reste côté Supabase)
const LS_KEY = 'ftpb_state_v1';

/* ============ erreurs : capture, journal local (30 dernières), remontée Supabase si connecté ============ */
const Errors = (() => {
  const KEY = 'ftpb-errors', MAX = 30; let shown = 0, sent = 0;
  const list = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch(e){ return []; } };
  function report(err, where = ''){
    const msg = String(err?.message || err || 'Erreur inconnue').slice(0, 500), stack = String(err?.stack || '').slice(0, 4000);
    if (/ResizeObserver loop|^Script error\.?$/.test(msg)) return;
    const e = { at: new Date().toISOString(), v: APP_VERSION, msg, stack, where: String(where).slice(0, 200) };
    try { localStorage.setItem(KEY, JSON.stringify([...list(), e].slice(-MAX))); } catch(x){}
    console.error('[FTPB]', e.where, err);
    if (!shown++) setTimeout(() => { try { toast('Petit souci technique — il a été signalé'); } catch(x){} }, 0);
    try { const sb = Cloud.sb, u = Cloud.user; if (sb && u && sent++ < 10) sb.from('client_errors').insert({ app_version: APP_VERSION, msg, stack, where_: e.where, ua: navigator.userAgent.slice(0, 300) }).then(() => {}, () => {}); } catch(x){}
  }
  window.addEventListener('error', ev => report(ev.error || ev.message, `${(ev.filename || '').split('/').pop()}:${ev.lineno || 0}`));
  window.addEventListener('unhandledrejection', ev => report(ev.reason, 'promesse'));
  return { report, list, clear: () => { try { localStorage.removeItem(KEY); } catch(e){} } };
})();

/* ============ utilitaires ============ */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parseD = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate()+n); return iso(d); };
const diffDays = (a, b) => Math.round((parseD(b) - parseD(a)) / 86400000);
const todayISO = () => iso(new Date());
const dowMon = s => (parseD(s).getDay() + 6) % 7; // 0 = lundi
const monday = s => addDays(s, -dowMon(s));
const DOW = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
const MONTHS = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
const fmtDate = s => { const d = parseD(s); return `${DOW[dowMon(s)].toLowerCase()} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
const fmtShort = s => { const d = parseD(s); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
const fmtDur = sec => { sec = Math.round(sec); const h = Math.floor(sec/3600), m = Math.floor(sec%3600/60), s = sec%60; return h ? `${h}h${pad(m)}` : (s && m < 10 ? `${m}'${pad(s)}` : `${m}'`); };
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const round5 = w => Math.round(w / 5) * 5;
function toast(msg){ const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }

/* ============ état ============ */
function blank(){ return { version:SCHEMA, profile:null, plan:[], activities:[], ftpHistory:[], settings:{ theme:'auto' } }; }
// APP_STALE : les données ont été écrites par une version plus récente de l'app (page restée en cache) → on n'envoie rien au compte
let APP_STALE = false;
const BACKUP_KEY = 'ftpb_state_backup', BACKUP_DAYS = 14;
// copie de secours (une seule, 14 jours) : avant une migration, un état illisible, ou un état local remplacé par celui du compte
function backupState(raw, why){ try { localStorage.setItem(BACKUP_KEY, JSON.stringify({ at: Date.now(), why, raw: typeof raw === 'string' ? raw : JSON.stringify(raw) })); return true; } catch(e){ return false; } }
function backupInfo(){ try { const b = JSON.parse(localStorage.getItem(BACKUP_KEY) || 'null'); if (!b) return null; if (Date.now() - b.at > BACKUP_DAYS * 864e5) { localStorage.removeItem(BACKUP_KEY); return null; } return b; } catch(e){ return null; } }
function load(){
  let r = null; try { r = localStorage.getItem(LS_KEY); } catch(e){}
  backupInfo(); // purge la copie de secours périmée
  if (!r) return blank();
  let m = null; try { m = migrateState(JSON.parse(r)); } catch(e){}
  if (!m) { backupState(r, 'illisible'); setTimeout(() => Errors.report(new Error('État local illisible : copie de secours conservée'), 'load'), 0); return blank(); }
  if (m.newer) { APP_STALE = true; return Object.assign(blank(), m.state); }
  if (m.from < m.to) { backupState(r, `migration v${m.from} → v${m.to}`); try { localStorage.setItem(LS_KEY, JSON.stringify(Object.assign(blank(), m.state))); } catch(e){} }
  return Object.assign(blank(), m.state);
}
let S = load(); // après les constantes ci-dessus (APP_STALE, BACKUP_KEY) : sinon elles ne sont pas encore définies au chargement
function save(opts={}){ if (!opts.remote) S.updatedAt = Date.now(); try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch(e){ if (!save.warned) { save.warned = 1; Errors.report(e, 'save'); toast('Sauvegarde impossible sur ce téléphone (stockage plein ?) — tes dernières saisies risquent d’être perdues'); } } if (!opts.remote) { try { Cloud.schedulePush(); } catch(e){} try { Social.pushSoon(); } catch(e){} } }
const ftp = () => (S.profile?.ftp || 250);
const adj = () => (S.profile?.intensityAdj || 1);

/* ============ zones ============ */
function zoneOf(p){ return p < 56 ? 1 : p < 76 ? 2 : p < 91 ? 3 : p < 106 ? 4 : p < 121 ? 5 : 6; }
const ZCOL = z => `var(--z${z})`;
const ZNAME = ['','Récup','Endurance','Tempo','Seuil','VO2max','Anaérobie'];

/* ============ bibliothèque de séances ============ */
// step: {d: sec, p: %FTP, label, int, max?:bool, cad?}
const S_ = (min, p, label, int='active', extra={}) => ({ d: Math.round(min*60), p, label, int, ...extra });
const R_ = (n, steps) => ({ repeat: n, steps });
const WU = [S_(5,50,'Échauffement','warmup'), S_(5,62,'Échauffement','warmup'), S_(3,75,'Échauffement','warmup')];
const WU_ACT = [...WU, R_(3,[S_(0.5,105,'Activation','active',{wu:true}), S_(1,55,'Récup','rest')])];
const CD = (m=8) => [S_(m,50,'Retour au calme','cooldown')];

const WORKOUTS = {
  test20: { name:'Test FTP 20 min', type:'test', goal:"Mesurer ta FTP : 95 % de ta puissance moyenne sur les 20 min. Mode résistance (pas ERG) sur l'effort, pars prudemment les 5 premières minutes puis accélère.",
    steps:[...WU, R_(3,[S_(1,105,'Activation'), S_(1,55,'Récup','rest')]), S_(5,110,'5 min à fond (vider l\'anaérobie)','active',{max:true}), S_(10,52,'Récup','rest'), S_(20,102,'20 MIN À FOND, régulier','active',{max:true}), ...CD(10)] },
  ramp: { name:'Test rampe ERG', type:'test', goal:"Tout en ERG : l'Edge règle la résistance, toi tu gardes 85-95 rpm. Paliers d'1 min de +8 % (~+20 W) jusqu'à ce que la cadence s'effondre : arrête-toi là. FTP = 75 % de ta meilleure minute. Plus court et moins mental qu'un 20 min, mais il peut surestimer la FTP des profils explosifs.",
    steps:[S_(5,45,'Échauffement','warmup'), S_(3,55,'Échauffement','warmup'), ...Array.from({length:18},(_,i)=>S_(1,50+i*8,`Palier ${i+1}`,'active',{cad:90})), ...CD(8)] },
  ss_3x10: { name:'Sweet spot 3 × 10 min', type:'ss', goal:"Construire le moteur aérobie au meilleur rapport fatigue / gain (88-93 % FTP).", steps:[...WU, R_(3,[S_(10,90,'Sweet spot',null,{cad:90}), S_(5,55,'Récup','rest')]), ...CD()] },
  ss_3x12: { name:'Sweet spot 3 × 12 min', type:'ss', goal:"Allonger le temps passé sous le seuil.", steps:[...WU, R_(3,[S_(12,90,'Sweet spot',null,{cad:90}), S_(4,55,'Récup','rest')]), ...CD()] },
  ss_3x15: { name:'Sweet spot 3 × 15 min', type:'ss', goal:"Gros bloc sweet spot : endurance au seuil.", steps:[...WU, R_(3,[S_(15,91,'Sweet spot',null,{cad:90}), S_(5,55,'Récup','rest')]), ...CD(6)] },
  ss_2x20: { name:'Sweet spot 2 × 20 min', type:'ss', goal:"Le classique : 2 × 20 à 90 %, tenir sans à-coups.", steps:[...WU, R_(2,[S_(20,90,'Sweet spot',null,{cad:90}), S_(5,55,'Récup','rest')]), ...CD(7)] },
  tempo_2x20: { name:'Tempo 2 × 20 min', type:'tempo', goal:"Endurance haute, cadence variée (85-95 rpm).", steps:[S_(10,58,'Échauffement','warmup'), R_(2,[S_(20,82,'Tempo',null,{cad:88}), S_(5,55,'Récup','rest')]), ...CD(5)] },
  thr_4x8: { name:'Seuil 4 × 8 min', type:'thr', goal:"Travail au seuil (98-102 %) pour repousser la FTP.", steps:[...WU_ACT, R_(4,[S_(8,100,'Seuil',null,{cad:92}), S_(4,55,'Récup','rest')]), ...CD()] },
  thr_3x12: { name:'Seuil 3 × 12 min', type:'thr', goal:"Allonger la durée au seuil.", steps:[...WU_ACT, R_(3,[S_(12,97,'Seuil',null,{cad:92}), S_(5,55,'Récup','rest')]), ...CD(6)] },
  thr_2x20: { name:'Seuil 2 × 20 min', type:'thr', goal:"La séance reine : 2 × 20 à 95-98 %. Si tu la tiens, la FTP suit.", steps:[...WU_ACT, R_(2,[S_(20,96,'Seuil',null,{cad:92}), S_(6,55,'Récup','rest')]), ...CD(6)] },
  ou_3x9: { name:'Over-unders 3 × 9 min', type:'thr', goal:"Alterner 95 % / 105 % pour apprendre à évacuer le lactate au seuil.", steps:[...WU_ACT, R_(3,[R_(3,[S_(2,95,'Under'), S_(1,106,'Over')]), S_(5,55,'Récup','rest')]), ...CD(6)] },
  vo2_5x4: { name:'VO2max 5 × 4 min', type:'vo2', goal:"Relever le plafond aérobie (110-115 %). Dur, mais court.", steps:[...WU_ACT, R_(5,[S_(4,112,'VO2max',null,{cad:95}), S_(4,50,'Récup','rest')]), ...CD(7)] },
  vo2_6x3: { name:'VO2max 6 × 3 min', type:'vo2', goal:"Intensité VO2 plus haute (118 %), récup égale.", steps:[...WU_ACT, R_(6,[S_(3,118,'VO2max',null,{cad:98}), S_(3,50,'Récup','rest')]), ...CD(8)] },
  vo2_3030: { name:'30/30 · 3 × 10', type:'vo2', goal:"Accumuler du temps près de VO2max avec des micro-récups.", steps:[...WU, R_(3,[R_(10,[S_(0.5,130,'ON',null,{cad:100}), S_(0.5,50,'OFF','rest')]), S_(5,55,'Récup','rest')]), ...CD(5)] },
  end_60: { name:'Endurance 1 h', type:'end', goal:"Zone 2 facile (65-72 %). Peut se faire dehors à la FC.", steps:[S_(5,55,'Échauffement','warmup'), S_(50,68,'Endurance Z2',null,{cad:90}), S_(5,55,'Retour au calme','cooldown')] },
  end_90: { name:'Endurance 1 h 30', type:'end', goal:"Sortie longue Z2 (65-72 %), idéalement dehors le week-end, à la FC.", steps:[S_(10,55,'Échauffement','warmup'), S_(75,68,'Endurance Z2',null,{cad:88}), S_(5,55,'Retour au calme','cooldown')] },
  end_120: { name:'Endurance 2 h', type:'end', goal:"Sortie longue Z2, dehors si possible.", steps:[S_(10,55,'Échauffement','warmup'), S_(105,67,'Endurance Z2'), S_(5,55,'Retour au calme','cooldown')] },
  // --- séances ajoutées v0.7 : plus de variété ---
  ss_4x10: { name:'Sweet spot 4 × 10 min', type:'ss', goal:"Volume sweet spot fractionné : 40 min à 90 % avec des récups courtes.", steps:[...WU, R_(4,[S_(10,90,'Sweet spot',null,{cad:90}), S_(4,55,'Récup','rest')]), ...CD(6)] },
  ss_ou: { name:'Sweet spot avec relances', type:'ss', goal:"Sweet spot ponctué de relances de 30 s : apprendre à absorber les à-coups (attaques, rampes de col) sans exploser.", steps:[...WU, R_(3,[R_(4,[S_(2.5,88,'Sweet spot',null,{cad:88}), S_(0.5,112,'Relance',null,{cad:100})]), S_(5,55,'Récup','rest')]), ...CD(6)] },
  force_5x5: { name:'Force 5 × 5 min (55 rpm)', type:'force', goal:"Force spécifique montagne : grosse braquet, 55-60 rpm, assis, buste calme. Développe le couple sans monter le cardio.", steps:[...WU, R_(5,[S_(5,85,'Force · 55-60 rpm assis',null,{cad:57}), S_(3,55,'Récup souple','rest',{cad:95})]), ...CD(7)] },
  force_4x8: { name:'Force 4 × 8 min (60 rpm)', type:'force', goal:"Endurance de force : 4 × 8 min à 88 % en cadence basse, comme dans un long col.", steps:[...WU, R_(4,[S_(8,88,'Force · 60 rpm assis',null,{cad:60}), S_(4,55,'Récup souple','rest',{cad:95})]), ...CD(6)] },
  tempo_end: { name:'Endurance + tempo 1 h 15', type:'tempo', goal:"Sortie d'endurance avec 3 blocs tempo : du volume utile sans grosse fatigue.", steps:[S_(10,58,'Échauffement','warmup'), R_(3,[S_(10,82,'Tempo',null,{cad:88}), S_(8,65,'Endurance')]), S_(11,55,'Retour au calme','cooldown')] },
  thr_5x6: { name:'Seuil 5 × 6 min', type:'thr', goal:"Seuil en blocs courts (102 %) : bonne porte d'entrée vers le travail au seuil.", steps:[...WU_ACT, R_(5,[S_(6,102,'Seuil',null,{cad:92}), S_(3,55,'Récup','rest')]), ...CD(7)] },
  thr_prog: { name:'Seuil progressif 3 × 10 min', type:'thr', goal:"Chaque bloc monte 95 → 100 → 105 % : finir fort quand la fatigue arrive, comme en haut d'un col.", steps:[...WU_ACT, R_(3,[S_(10/3,95,'Seuil −'), S_(10/3,100,'Seuil'), S_(10/3,105,'Seuil +'), S_(5,55,'Récup','rest')]), ...CD(6)] },
  thr_2x15: { name:'Seuil 2 × 15 min', type:'thr', goal:"Deux longs blocs à 100 % : la séance qui fait monter la FTP.", steps:[...WU_ACT, R_(2,[S_(15,100,'Seuil',null,{cad:92}), S_(7,55,'Récup','rest')]), ...CD(7)] },
  vo2_4x5: { name:'VO2max 4 × 5 min', type:'vo2', goal:"VO2max « long » à 108 % : entrée en douceur dans le travail VO2.", steps:[...WU_ACT, R_(4,[S_(5,108,'VO2max',null,{cad:95}), S_(5,50,'Récup','rest')]), ...CD(7)] },
  vo2_8x2: { name:'VO2max 8 × 2 min', type:'vo2', goal:"Efforts de 2 min à 120 % : intense mais court, idéal pour progresser sur 3-5 min.", steps:[...WU_ACT, R_(8,[S_(2,120,'VO2max',null,{cad:100}), S_(2,50,'Récup','rest')]), ...CD(8)] },
  vo2_pyr: { name:'Pyramide VO2 1-2-3-4-3-2-1', type:'vo2', goal:"Pyramide à 115 % avec récup égale à l'effort : varié, dur, très efficace.", steps:[...WU_ACT, ...[1,2,3,4,3,2,1].flatMap(m => [S_(m,115,`VO2 ${m} min`,null,{cad:98}), S_(m,50,'Récup','rest')]), ...CD(6)] },
  vo2_4020: { name:'40/20 · 3 × 8 min', type:'vo2', goal:"40 s à 120 % / 20 s de récup : on accumule du temps près de VO2max avec très peu de récupération.", steps:[...WU, R_(3,[R_(8,[S_(40/60,120,'ON',null,{cad:100}), S_(20/60,50,'OFF','rest')]), S_(5,55,'Récup','rest')]), ...CD(6)] },
  end_neuro: { name:'Endurance + sprints 1 h', type:'end', goal:"Endurance Z2 avec 8 sprints de 15 s : réveille la puissance explosive sans fatigue.", steps:[S_(10,58,'Échauffement','warmup'), R_(8,[S_(0.25,180,'Sprint 15 s',null,{cad:110}), S_(4.75,66,'Endurance')]), S_(5,62,'Endurance'), S_(5,55,'Retour au calme','cooldown')] },
  end_150: { name:'Sortie longue 2 h 30 avec D+', type:'end', goal:"Dehors : endurance Z2 en terrain vallonné (vallée de Chevreuse), montées au tempo sans dépasser le seuil. Mange toutes les 30 min comme en course.", steps:[S_(10,55,'Échauffement','warmup'), R_(4,[S_(25,67,'Endurance Z2'), S_(8,82,'Montée tempo',null,{cad:80})]), S_(8,55,'Retour au calme','cooldown')] },
  end_180: { name:'Sortie longue 3 h · spécifique', type:'end', goal:"La répétition générale du vélo de l'AlpsMan : 3 h dehors avec les cols de la journée au tempo (82-88 %), nutrition de course, puis l'enchaînement à pied.", steps:[S_(15,55,'Échauffement','warmup'), R_(3,[S_(30,67,'Endurance Z2'), S_(20,85,'Col au tempo',null,{cad:78})]), S_(15,55,'Retour au calme','cooldown')] },
  rec_45: { name:'Récup active 45 min', type:'rec', goal:"Faire tourner les jambes, très facile (< 60 %).", steps:[S_(45,55,'Récup active','rest',{cad:90})] },
  openers: { name:'Rappels (veille de test)', type:'rec', goal:"Réveiller les jambes sans fatigue avant un test ou une semaine dure.", steps:[S_(10,55,'Échauffement','warmup'), R_(3,[S_(1,110,'Rappel',null,{cad:100}), S_(2,55,'Récup','rest')]), S_(10,65,'Endurance'), S_(5,50,'Retour au calme','cooldown')] },
};
/* ---- échauffement préféré (Profil › Ma semaine) ----
   profile.warmupMin = durée minimale (min) des paliers d'échauffement en début de séance (0 = selon la séance).
   Si la séance en prévoit moins, le 1er palier est rallongé de la différence ; si elle en prévoit déjà autant ou plus, rien ne change.
   Les activations (30 s à 105 %) ne comptent pas. Appliqué à chaque rendu et avant chaque génération de plan. */
const WU_BASE = Object.fromEntries(Object.entries(WORKOUTS).map(([id, w]) => [id, w.steps]));
function wuSec(steps){ let t = 0; for (const s of steps) { if (s.repeat || s.int !== 'warmup') break; t += s.d; } return t; }
function applyWarmupPref(p = S.profile){
  const want = Math.round((+p?.warmupMin || 0) * 60);
  for (const id in WU_BASE) {
    const base = WU_BASE[id], have = wuSec(base);
    WORKOUTS[id].steps = (!have || want <= have) ? base : [{ ...base[0], d: base[0].d + want - have }, ...base.slice(1)];
  }
}
const HARD = new Set(['test','ss','thr','vo2','force']);
const isHard = wid => HARD.has(WORKOUTS[wid]?.type);
function flat(steps){ const out = []; for (const s of steps) { if (s.repeat) for (let i=0;i<s.repeat;i++) out.push(...flat(s.steps)); else out.push(s); } return out; }
const wDur = wid => flat(WORKOUTS[wid].steps).reduce((a,s)=>a+s.d,0);
const wTSS = wid => Math.round(flat(WORKOUTS[wid].steps).reduce((a,s)=>a + s.d*Math.pow(s.p/100,2),0)/36);
const watts = (p, f=ftp(), k=1) => round5(p/100 * f * adj() * k);
const sAdj = s => (s && s.adj) || 1;
function mainStep(wid){ // le bloc principal le plus intense et le plus long (pour mesurer le respect des cibles)
  let best = null; for (const s of flat(WORKOUTS[wid].steps)) if ((s.int || 'active') === 'active' && s.p >= 85 && (!best || s.d*s.p > best.d*best.p)) best = s; return best;
}
