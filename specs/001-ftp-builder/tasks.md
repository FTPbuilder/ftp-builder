# Tasks: FTP Builder

## Phase 1 — Socle (V1)
- [x] T001 Structure `index.html` : état `S`, persistance, navigation 4 onglets, thème clair/sombre
- [x] T002 [US2] Décodeur FIT (`record`, `session`, `user_profile`, `zones_target`) + `.fit.gz`
- [x] T003 [US2] Métriques : NP, IF, TSS, hrTSS, meilleures puissances
- [x] T004 [US1] Questionnaire + pré-remplissage depuis `.fit`
- [x] T005 [US1] Bibliothèque `WORKOUTS` (test 20 min, rampe, sweet spot, seuil, over-unders, VO2, endurance, récup, openers)
- [x] T006 [US1] `Planner.generate` : blocs, semaines allégées, tests, ≥ 48 h entre séances intenses, durées max par jour
- [x] T007 [US1] Calendrier : vue semaines, détail séance, déplacer / sauter / remplacer
- [x] T008 [US2] Saisie manuelle + ressenti, rattachement à la séance prévue
- [x] T009 [US2] Séance test → calcul FTP, confirmation, recalcul des cibles
- [x] T010 [US3] Progression : compteur, FTP vs trajectoire, W/kg, CTL/ATL/TSB, records, ressentis
- [x] T011 [US3] Coach : suggestion ± selon RPE et respect des cibles
- [x] T012 [US4] Encodeur workout `.fit` + téléchargement
- [x] T013 Export / import JSON
- [x] T014 Tests : parseur et encodeur FIT sur le fichier du 19/10/2026

## Phase 2 — V1.5
- [x] T015 manifest + service worker + icône
- [x] T016 Projet Supabase, table `user_state`, RLS
- [x] T017 Auth email + Google, synchro `S`
- [ ] T018 Repo GitHub + Pages

## Phase 3 — V2
- [x] T019 [US5] Edge Function `strava-oauth` (échange de code, refresh)
- [x] T020 [US5] Edge Function `strava-webhook` + récupération des streams
- [ ] T021 [US4] Décision et implémentation push Garmin Connect (ou Intervals.icu)
