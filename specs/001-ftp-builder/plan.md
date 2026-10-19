# Implementation Plan: FTP Builder

**Branch**: `001-ftp-builder` | **Date**: 2026-10-19 | **Spec**: [spec.md](./spec.md)

## Summary
PWA monofichier en français qui génère un plan de ≥ 35 séances vélo (250 → 300 W, fin 15/03/2027) à partir d'un questionnaire, importe/saisit les séances réalisées avec ressenti, affiche la progression et exporte les séances en workout `.fit` pour l'Edge 530.

## Technical Context
- **Language/Version**: HTML5 + CSS + JavaScript ES2022 vanilla (aucun build)
- **Primary Dependencies**: aucune obligatoire ; graphiques en SVG maison ; Supabase JS v2 via CDN (V1.5)
- **Storage**: localStorage (`S`) → Supabase `user_state` (jsonb, RLS)
- **Testing**: Node (`node --check`, tests parseur/encodeur FIT avec `fit-file-parser`), Playwright (parcours questionnaire → plan → import)
- **Target Platform**: navigateurs mobiles et desktop, GitHub Pages
- **Constraints**: hors ligne, saisie < 60 s, fichier unique
- **Scale/Scope**: 1-50 utilisateurs, ~50 séances/plan

## Constitution Check
| Principe | Statut |
|---|---|
| I. Entraînement d'abord | ✅ périmètre V1 = plan, saisie, progression, export |
| II. Science honnête | ✅ FTP officielle uniquement par test, projection affichée |
| III. Monofichier | ✅ `index.html`, FIT maison |
| IV. Local d'abord | ✅ localStorage, Supabase en V1.5, secrets en Edge Functions |
| V. Mobile, français | ✅ |

## Project Structure
```
ftp-builder/
├── index.html                 # l'app
├── manifest.webmanifest, sw.js, icon.svg   # PWA (V1.5)
├── supabase/functions/strava-oauth, strava-webhook   # V2
├── tests/fit.test.mjs         # parseur + encodeur FIT
└── specs/001-ftp-builder/     # spec, plan, research, data-model, tasks
```

## Architecture de index.html
- `S` + `save()/load()` ; `render()` par onglet : **Aujourd'hui**, **Calendrier**, **Progression**, **Profil**.
- Modules : `FIT.decode()`, `FIT.encodeWorkout()`, `Metrics` (NP, TSS, best efforts, CTL/ATL), `Planner.generate(profile)`, `WORKOUTS`, `Coach.suggest()`.
- Graphiques SVG : FTP vs cible, CTL/ATL/TSB, histogramme ressentis.

## Phases
1. **V1 (cette itération)** : questionnaire (+ pré-remplissage FIT), plan, calendrier, saisie manuelle, import `.fit/.fit.gz`, ressenti, tests FTP, progression, export workout `.fit`, export/import JSON.
2. **V1.5** : PWA (manifest, service worker), auth Supabase email + Google, synchro `user_state`, déploiement GitHub Pages.
3. **V2** : Strava OAuth + webhook ; push Garmin Connect (décision à prendre, voir research R4).
