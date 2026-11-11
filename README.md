# FTP Builder

PWA sans build (`index.html` + `js/NN-domaine.js`) pour construire sa FTP : questionnaire → plan périodisé de ≥ 35 séances → saisie/import des séances avec ressenti → progression → export des séances vers le Garmin Edge (fichier workout `.fit`).

Projet piloté avec [GitHub Spec Kit](https://github.com/github/spec-kit) :
- `.specify/memory/constitution.md` : principes du projet
- `specs/001-ftp-builder/` : `spec.md`, `plan.md`, `research.md`, `data-model.md`, `tasks.md`
- Commandes dans Claude Code : `/speckit-clarify`, `/speckit-plan`, `/speckit-tasks`, `/speckit-implement`

## Lancer
Ouvrir `index.html` dans un navigateur (ou GitHub Pages). Données stockées localement (export/import JSON dans Profil).

## Code
`index.html` : structure, CSS, `APP_VERSION`. `js/01-core.js` … `js/21-boot.js` : un fichier par domaine, chargés dans l'ordre (un fichier n'utilise au chargement que ceux qui le précèdent).
Nouvelle version : `node tools/bump.mjs X.Y.Z`.

## Tests
```
node tests/check-syntax.mjs     # compilation de chaque fichier + cohérence des versions (sans navigateur)
node tests/run-all.mjs [filtre] # tous les tests Playwright ; SCRATCH = dossier avec fit-file-parser, @garmin/fitsdk, @supabase/supabase-js@2.45.4, three@0.147.0
```
La CI (`.github/workflows/tests.yml`) les lance à chaque push. `tests/quarantine.txt` liste les tests périmés à réparer (ils ne bloquent pas).

## Envoyer une séance sur l'Edge 530
Exporter la séance (.fit) → brancher l'Edge en USB → copier dans `Garmin/NewFiles` → Entraînement › Entraînements. L'Edge pilote le Tacx Flux 2 en ERG.
