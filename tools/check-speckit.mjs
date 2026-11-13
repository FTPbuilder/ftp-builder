// Garde-fou Spec Kit : vérifie que les fichiers installés par Spec Kit (.specify/ et .claude/) n'ont pas changé
// depuis leur validation, et qu'aucun fichier inattendu n'y est apparu (réglages, hooks, nouvelles commandes…).
// Usage : node tools/check-speckit.mjs            → contrôle (échoue si écart)
//         node tools/check-speckit.mjs --update   → réenregistre les empreintes après une mise à jour VÉRIFIÉE de Spec Kit
import fs from 'fs'; import path from 'path'; import crypto from 'crypto';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const lockFile = path.join(root, 'tools', 'speckit-lock.json');
// Contenu propre au projet, modifiable librement (la constitution est écrite par nous, pas par Spec Kit).
const FREE = new Set(['.specify/memory/constitution.md']);
const walk = d => !fs.existsSync(path.join(root, d)) ? [] : fs.readdirSync(path.join(root, d), { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(path.posix.join(d, e.name)) : [path.posix.join(d, e.name)]);
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, f))).digest('hex');
const files = [...walk('.specify'), ...walk('.claude')].filter(f => !FREE.has(f)).sort();

if (process.argv.includes('--update')) {
  fs.writeFileSync(lockFile, JSON.stringify(Object.fromEntries(files.map(f => [f, sha(f)])), null, 2) + '\n');
  console.log(`Empreintes enregistrées : ${files.length} fichiers → tools/speckit-lock.json`); process.exit(0);
}
const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8')); let ko = 0;
for (const [f, h] of Object.entries(lock)) {
  if (!fs.existsSync(path.join(root, f))) { ko++; console.error('✘ supprimé :', f); }
  else if (sha(f) !== h) { ko++; console.error('✘ modifié :', f); }
}
for (const f of files) if (!(f in lock)) { ko++; console.error('✘ fichier inattendu :', f); }
if (ko) console.error(`\n${ko} écart(s) sur Spec Kit. Si le changement est voulu et vérifié : node tools/check-speckit.mjs --update`);
else console.log(`OK — Spec Kit intact (${files.length} fichiers)`);
process.exit(ko ? 1 : 0);
