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

## Phase 4 — Variété et adaptation (v0.7)
- [x] T022 Bibliothèque élargie à 32 séances (force basse cadence, seuil progressif, pyramide VO2, 40/20, sprints…)
- [x] T023 Blocs variés : 3 séances différentes par bloc et par emplacement, sorties optionnelles alternées
- [x] T024 Échelles de difficulté : « plus facile / plus dur » par famille, retour à la séance prévue
- [x] T025 Intensité par séance (−5 % à +5 %) appliquée aux watts, à l'export .fit, à Intervals et au contrôle des cibles
- [x] T026 Reporter (créneau libre ≤ 3 j, règle des 48 h) et remplacer par une récup
- [x] T027 Suggestion du jour selon l'indice de forme (alléger / reporter / monter d'un cran)
- [x] T028 Heures de sport : 5 dernières séances par sport (≥ 10 min), cliquables ; fiche de progression (allure, FC, efficacité m/battement vs médiane des séances de distance proche, courbe sur 12 séances)
- [x] T029 Recomposition de séance (natation, course) : texte libre → blocs typés (séries, alternances, morceaux enchaînés, récup, séries en temps), calés sur les arrêts du flux distance/FC Intervals.icu (table `workout_laps`), comparaison bloc par bloc et « Progression par bloc »
- [x] T030 Calendrier : jour à plusieurs séances → home trainer ouvert par défaut, sélecteur pour passer aux autres (vélotaf, natation, course, séance prévue)
- [x] T031 Forme du jour : batterie qui se vide (vert ≥ 60, jaune 35–59, rouge < 35) à la place de l'arc
- [x] T032 Nuit détaillée : Raccourci partie B en une requête (phases + FC + respiration, table `health_samples`), analyse par phase (durée, %, FC, resp.) et par cycle, courbe FC/respiration, efficacité, réveils, endormissement, FC min et son heure, écarts vs 14 nuits
- [x] T033 Plan triathlon (course A AlpsMan Half 5/06/2027) : vélo fondu dans le plan tri (bloc « Spécifique montagne », sorties longues 2h30-3h, affûtage, semaine de course sans test), 2 nat + 2 course / semaine alignées sur les semaines de charge/récup (CSS, seuil, côtes, sorties longues avec D+, enchaînements), calendrier (ronds par sport toujours visibles), programme, fiche séance (allures, déplacer, sauter), validation automatique, envoi vers Intervals (Run/Swim)
- [x] T034 Ergonomie : carte « Aujourd'hui » en tête de l'accueil (séances du jour, batterie, conseil selon l'énergie), « Énergie » au lieu de « Forme » pour l'indice du jour, compteurs de séances par semaine, libellés sous les onglets, une action principale par séance (le reste dans « Autres actions »), « Ma semaine » unique vélo / nat / course (Profil et plan tri)
- [x] T035 Adaptabilité : « Changer de séance » sur toute séance du programme (vélo, nat, course) → ce qui a été fait à la place (activité du jour détectée ou saisie : vélo dehors, HT libre, course, nat, renfo, mobilité, repos ; durée, RPE, note), charge estimée, ligne « au lieu de » dans le calendrier ; bloc « Adapter » : remplacement couvert ou non, recaser une séance clé (≤ 3 j, 48 h entre séances dures, 2 séances/jour max) ou la laisser tomber, alléger la prochaine séance dure après une grosse substitution, charge de la semaine faite / prévue
- [x] T036 Phases du programme : carte « Où j'en suis » (frise Calibration → Base → Build 1 → Build 2 → Peak / Spécifique → Affûtage → Objectif, semaine du bloc, rôle de la semaine, phase suivante) dans le calendrier et le volet Programme ; fiche « Quelle méthode ? »
- [x] T037 Bilan de la semaine en story (dimanche dès 17 h et lundi, bannière d'accueil ; bouton « Bilan » sur chaque semaine passée) : volume par sport, séances du programme, verdict on track / trop / pas assez (charge faite vs prévue, rampe CTL, TSB, séances clés, trajectoire FTP), 2–3 séances clés de la semaine suivante, partage texte
- [x] T038 Profil › bibliothèque perso : sous Réglages, deux carrés « Mes ascensions » (gauche, la bibliothèque quitte Progression) et « Mes GPX » (droite) ; « Mes GPX » = livre de traces importées (.gpx, ≤ 600 points), notées 1-5 étoiles sur fun / difficulté / asphalte / boulangerie, triables, exportables en .gpx ; livre ouvrable aux amis seulement, en lecture seule (table `gpx_book`, copie possible dans son propre livre) ; dessous « Mes courses » : courses passées (sport, temps, classement, souvenirs) avec photos (médaille, dossard, ligne d'arrivée…) en IndexedDB + stockage privé `race-photos` ; la course objectif du plan tri s'ajoute toute seule une fois passée, temps pré-rempli avec les séances du jour ; bouton « Ajouter à mes traces » sur une sortie extérieure (fiche de la séance, depuis le Calendrier), sans doublon
- [x] T039 Mes GPX : bandeau collant au-dessus des traces — zones (Bords de Marne, Vallée de Chevreuse, Vexin, Rambouillet, Fontainebleau, Paris ; ailleurs la ville de départ via Photon/OSM), « 📍 Autour de moi » (traces à < 30 km, les plus proches d'abord), filtres par note (≥ 3★ / ≥ 4★ / 5★ par critère, cumulables), tri ; carte Leaflet des boulangeries sous le commentaire (toucher la carte pour en placer une, nom modifiable, recherche des boulangeries OpenStreetMap à < 300 m du parcours), partagée avec les amis ; color-scheme sombre/clair pour les contrôles natifs
- [x] T040 Mes courses : temps saisi en 3 cases h / min / s (clavier numérique) ; triathlon décomposé nat, T1, vélo, T2, course (total calculé, pré-rempli par discipline pour la course objectif, affiché dans la liste) ; champs sans type stylés (plus de débordement)

## Phase 5 — Garage (v0.37)
- [x] T041 [US6] Profil › GARAGE : tuile (vélo principal, km, pièce la plus usée) et volet ; vélos multiples (Aeroad CFR Di2 + vélo de route générique), règles d'attribution dehors / HT / vélotaf, correction par sortie, km initiaux (`js/23-garage.js`)
- [x] T042 [US6] Usure : pneus AV/AR, chaîne, cassette (HT direct exclu), plateaux, galets, plaquettes, direction (×1,5 HT), boîtier, guidoline, liquide préventif, batterie Di2, piles des leviers, capteur de puissance ; fiche composant (remplacement, recharge, mesure de chaîne, durée de vie) ; journal et achats
- [x] T043 [US6] Entretien de la transmission (lubrifier 300 km, nettoyage 1 500 km / 60 j, mesure 1 000 km) et pression des pneus inspirée de SILCA
- [x] T044 [US6] Maquette 3D procédurale Aeroad CFR (three.js 0.147 + OrbitControls), rotation libre, vue éclatée animée au toucher, témoins d'usure / batterie par composant (`js/22-bike3d.js`) ; test `tests/garage.mjs`
- [x] T045 [US6] Attribution par vélo Strava / Intervals (`gear_id` transmis par les Edge Functions, cases à cocher dans l'onglet Vélo)
- [x] T046 [US6] Configurateur (v0.38) : scène studio (environnement, ombres douces, travelling d'entrée, présentoir tournant), maquette détaillée (jantes profilées, dentures, maillons de chaîne, freins à patins ou à disque, 11 / 12 v), éclaté échelonné « mode ingénieur », focus et fiche latérale avec rendu du composant, témoins discrets ; onglets Composants · Entretien · Achats · Pression · Sorties · Vélo
- [x] T047 [US6] Import GLB (reconnaissance des composants par nom, réglage manuel, rotation), film .mp4 image par image, stockage `garage-media` (migration 20261114)
- [x] T048 [US6] Gabarit Aeroad CF SL Di2 (Ultegra Di2 11 v, patins), composants complets (dérailleurs, moyeux, rayons, tige, cockpit, freins AV/AR), inspections, niveau de batterie lu, conditions de sortie, valeurs SILCA officielles saisies, plafonds pneu / jante
- [x] T049 [US6] Déployer `intervals` et `strava-webhook` avec `gear_id`
- [x] T050 [US6] v0.39 : film retiré ; composants sans tige de selle, cockpit ni rayons ; transmission Di2 / AXS / mécanique (piles des cocottes SRAM) ; recharge datée ; zones touchables (zoom, pièces de la zone, boutons − / +) ; onglet Position (étude posturale PDF / photo, lecture des cotes Paris Bike Co) ; import GLB robuste
- [ ] T051 [US6] Maquettes d'autres marques

