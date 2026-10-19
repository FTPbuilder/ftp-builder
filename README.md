# FTP Builder

PWA monofichier (`index.html`) pour construire sa FTP : questionnaire → plan périodisé de ≥ 35 séances → saisie/import des séances avec ressenti → progression → export des séances vers le Garmin Edge (fichier workout `.fit`).

Projet piloté avec [GitHub Spec Kit](https://github.com/github/spec-kit) :
- `.specify/memory/constitution.md` : principes du projet
- `specs/001-ftp-builder/` : `spec.md`, `plan.md`, `research.md`, `data-model.md`, `tasks.md`
- Commandes dans Claude Code : `/speckit-clarify`, `/speckit-plan`, `/speckit-tasks`, `/speckit-implement`

## Lancer
Ouvrir `index.html` dans un navigateur (ou GitHub Pages). Données stockées localement (export/import JSON dans Profil).

## Tests
```
npm i fit-file-parser @garmin/fitsdk   # dans un dossier de travail
node tests/e2e.mjs                     # Playwright : questionnaire → plan → import .fit → export workout validé par le SDK Garmin
```

## Envoyer une séance sur l'Edge 530
Exporter la séance (.fit) → brancher l'Edge en USB → copier dans `Garmin/NewFiles` → Entraînement › Entraînements. L'Edge pilote le Tacx Flux 2 en ERG.
