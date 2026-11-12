// Schéma de l'état (sans navigateur) : migrations ordonnées, idempotentes, sans perte ; état d'une app plus récente refusé.
import fs from 'fs';
const src = fs.readFileSync(new URL('../js/00-schema.js', import.meta.url), 'utf8');
const { SCHEMA, MIGRATIONS, migrateState } = new Function(src + '; return { SCHEMA, MIGRATIONS, migrateState };')();
let ok = true; const assert = (c, m) => { if (!c) { ok = false; console.error('ÉCHEC', m); } else console.log('ok', m); };
assert(Number.isInteger(SCHEMA) && SCHEMA >= 2, `SCHEMA = ${SCHEMA}`);
assert(Array.from({ length: SCHEMA - 1 }, (_, i) => i + 1).every(v => typeof MIGRATIONS[v] === 'function') && Object.keys(MIGRATIONS).length === SCHEMA - 1, 'une migration par version, sans trou');
// un état v1 réel (réduit) : tout ce qui a été saisi est conservé
const v1 = { version:1, updatedAt:1794337209616, profile:{ name:'A', ftp:260, days:{ 1:{ avail:true, max:75 } } }, plan:[{ id:'p1', date:'2026-10-27', workoutId:'ss_3x12', status:'done', activityId:'x1' }],
  activities:[{ id:'x1', date:'2026-10-27', durationS:3661, tss:72, feel:{ rpe:7, note:'ok' } }], ftpHistory:[{ date:'2026-10-21', ftp:260, source:'initial' }], settings:{ theme:'dark', tourSeen:true },
  challenges:[{ id:'chaise', entries:{ '2026-10-27':5 }, log:[{ ts:1, v:5 }] }], mobility:[{ date:'2026-11-10', sport:'swim', min:5 }], triPlan:[{ id:'t1', sport:'run' }], recomp:{ a:[1] }, climbNames:{ k:'Joux Plane' } };
const frozen = JSON.stringify(v1), m = migrateState(v1);
assert(JSON.stringify(v1) === frozen, "l'état d'entrée n'est pas modifié (copie)");
assert(m.from === 1 && m.to === SCHEMA && m.state.version === SCHEMA, `v1 → v${SCHEMA}`);
const strip = s => { const c = JSON.parse(JSON.stringify(s)); delete c.version; delete c.syncLegacy; return JSON.stringify(c); };
assert(strip(m.state) === strip(v1), 'aucune donnée saisie perdue ni modifiée');
assert(m.state.syncLegacy === true, 'état déjà en service : marqué comme relié à son compte (ancienne règle de synchro)');
const again = migrateState(m.state);
assert(again.from === SCHEMA && JSON.stringify(again.state) === JSON.stringify(m.state), 'rejouer sur un état à jour ne change rien');
// états abîmés ou incomplets : réparés sans planter
const broken = migrateState({ profile:null, plan:null, activities:'x', settings:null });
assert(broken.state.version === SCHEMA && Array.isArray(broken.state.plan) && Array.isArray(broken.state.activities) && Array.isArray(broken.state.ftpHistory) && broken.state.settings.theme === 'auto' && !broken.state.syncLegacy, 'état incomplet (sans version) : structure rétablie');
assert(migrateState({ version:'2', plan:[] }).from === 1 && migrateState({ version:0 }).from === 1 && migrateState({ version:1.5 }).from === 1, 'numéro de version invalide : traité comme v1');
assert(migrateState(null) === null && migrateState('x') === null && migrateState([]) === null, 'entrée illisible : null');
const newer = migrateState({ version: SCHEMA + 1, profile:{ ftp:300 }, futur:{ a:1 } });
assert(newer.newer === true && newer.state.futur.a === 1 && newer.state.version === SCHEMA + 1, "état d'une app plus récente : signalé, laissé tel quel");
console.log(ok ? 'OK' : 'ÉCHEC'); process.exit(ok ? 0 : 1);
