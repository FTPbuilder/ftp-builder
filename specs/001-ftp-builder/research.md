# Research: FTP Builder

## R1 — Estimation de la FTP
- **Décision** : test 20 min (FTP = 95 % de la puissance moyenne sur 20 min) par défaut ; test rampe en option (paliers de 1 min +20 W, FTP = 75 % de la meilleure minute).
- **Pourquoi** : protocoles standards, réalisables en ERG/résistance sur le Flux 2 via l'Edge. Le test rampe surestime souvent la FTP des profils « anaérobies » ; le 20 min est plus représentatif pour un triathlète.
- **FTP estimée entre deux tests** : les estimations hors test sont peu fiables → on affiche seulement 0,95 × meilleur 20 min des 6 dernières semaines comme « plancher estimé » ; la FTP officielle ne change qu'après un test validé.

## R2 — Charge d'entraînement
- NP = moyenne des puissances lissées 30 s à la puissance 4, racine 4e. IF = NP / FTP. TSS = durée(s) × NP × IF / (FTP × 3600) × 100.
- Sans puissance : TSS FC (hrTSS) ≈ durée(h) × (FCmoy / FC seuil)² × 100, FC seuil ≈ 0,9 × FC max par défaut.
- CTL = moyenne exponentielle 42 j du TSS, ATL = 7 j, TSB = CTL − ATL (veille).

## R3 — Périodisation (20/10/2026 → 15/03/2027, 21 semaines)
| Semaines | Bloc | Contenu clé |
|---|---|---|
| S1 | Calibration | Test FTP + endurance |
| S2-S4 | Base / Sweet spot | 3×10 → 3×15 min à 88-93 % |
| S5 | Allégée | récup + rappel |
| S6-S8 | Sweet spot → Seuil | 2×20 à 90-95 %, 4×8 à 100 % |
| S9 | Allégée + retest | test FTP |
| S10-S11 | Fêtes | maintien, 1-2 séances |
| S12-S14 | Seuil + VO2 | over-unders, 5×4 min à 110-115 % |
| S15 | Allégée + retest | test FTP |
| S16-S18 | VO2 / spécifique | 30/30, 6×3 min, 2×20 à 97-100 % |
| S19 | Allégée | |
| S20 | Affûtage + test final | ~5 mars |
| S21 | Bonus | consolidation jusqu'au 15/03 |

2 séances clés + 1 optionnelle par semaine → ~42 séances prévues, ≥ 35 réalistes même avec des imprévus.

## R4 — Envoi des séances sur l'Edge 530
- **Fichier workout `.fit`** (V1) : messages `file_id` (type 5), `workout` (26), `workout_step` (27), cibles puissance en watts absolus (`valeur + 1000`). À copier dans `Garmin/NewFiles` (Edge branché en USB) → apparaît dans Entraînement › Entraînements. L'Edge 530 pilote le Flux 2 (ANT+ FE-C) et applique les cibles en ERG.
- **Garmin Connect** : l'API officielle Training API (push de séances) est réservée au Garmin Connect Developer Program (validation d'entreprise). Les bibliothèques non officielles (garminconnect / garth) fonctionnent mais demandent de stocker les identifiants Garmin et peuvent casser. → V2 optionnelle via Edge Function, à décider.
- **Alternative V2** : Intervals.icu (API ouverte, synchro calendrier → Garmin Connect) comme passerelle.

## R5 — Synchro Strava
- API Strava v3 : OAuth (scope `activity:read_all`), webhook d'événements, endpoint streams (`watts`, `heartrate`, `cadence`, `time`). Pas besoin d'abonnement Strava.
- Le `client_secret` reste dans une Edge Function Supabase (`strava-oauth`, `strava-webhook`). Les tokens sont stockés côté serveur par utilisateur.
- Import manuel : depuis Strava « Exporter l'original » donne le `.fit` Garmin ; l'export de compte fournit des `.fit.gz` → décompression via `DecompressionStream('gzip')`.

## R6 — Lecture FIT dans le navigateur
- Décodeur maison (~150 lignes) : en-tête, messages de définition/données, en-têtes à horodatage compressé, champs développeur ignorés. Messages lus : `record` (20), `session` (18), `user_profile` (3), `zones_target` (7), `workout` (26), `file_id` (0).
- Validé contre `fit-file-parser` (npm) sur la séance du 19/10/2026.
