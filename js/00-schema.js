"use strict";
// FTP Builder · schéma de l'état S : numéro de version et migrations (fichier sans DOM, testé hors navigateur)
/* ============ schéma ============
   Règle : tout changement de structure de S ajoute une migration ici et incrémente SCHEMA.
   Une migration reçoit l'état (déjà copié) dans la version précédente et le modifie sur place. Elle doit pouvoir
   tourner sur des données incomplètes et ne jamais supprimer une donnée saisie par l'utilisateur.
   Les migrations s'appliquent partout où un état entre dans l'app : stockage local, compte (Supabase), sauvegarde JSON. */
const SCHEMA = 2;
const MIGRATIONS = {
  // 1 → 2 : structure garantie (les tableaux de base existent) ; l'état déjà en service est marqué « déjà relié à son compte »
  1: s => {
    for (const k of ['plan', 'activities', 'ftpHistory']) if (!Array.isArray(s[k])) s[k] = [];
    if (!s.settings || typeof s.settings !== 'object') s.settings = { theme: 'auto' };
    if (s.profile && !s.syncedUser) s.syncLegacy = true; // avant la v2, rien ne disait à quel compte un état local appartenait
  },
};
// → { state, from, to } (state migré, copie), { newer:true } si l'état vient d'une app plus récente, null si illisible
function migrateState(raw){
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const from = Number.isInteger(raw.version) && raw.version > 0 ? raw.version : 1;
  if (from > SCHEMA) return { newer: true, from, to: SCHEMA, state: raw };
  const state = JSON.parse(JSON.stringify(raw));
  for (let v = from; v < SCHEMA; v++) MIGRATIONS[v](state);
  state.version = SCHEMA;
  return { state, from, to: SCHEMA };
}
