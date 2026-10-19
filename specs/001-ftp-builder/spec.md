# Feature Specification: FTP Builder

**Feature Branch**: `001-ftp-builder`

**Created**: 2026-10-19

**Status**: Draft

**Input**: User description: "App FTP builder pour le vélo. FTP actuelle ~250 W (probablement un peu plus), objectif 300 W début mars. Garmin Edge 530, ceinture cardio, home trainer Tacx Flux 2. Au moins 35 séances d'ici le 15 mars, majoritairement sur home trainer (pas de capteur de puissance dehors). Questionnaire de départ (âge, poids, taille, sexe, disponibilités) qui génère un calendrier avec les séances idéales par jour. Saisie des séances au choix : synchro auto Strava, saisie manuelle, import manuel d'un fichier Garmin/Strava. Ressenti par séance, visualisation de la progression. Export des séances vers l'Edge (via Garmin Connect si possible)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Questionnaire et plan généré (Priority: P1)

Au premier lancement, le cycliste remplit un questionnaire : âge, poids, taille, sexe, FTP actuelle (ou « inconnue »), FC max, objectif de FTP et date, date de fin du programme, nombre minimum de séances, jours disponibles avec durée max par jour, nombre de séances home trainer par semaine, pratique d'autres sports (triathlon), type de test préféré. L'app génère un calendrier de séances structurées réparties en blocs (base/sweet spot → seuil → VO2max → affûtage), avec des tests FTP réguliers et une semaine allégée toutes les 3-4 semaines.

**Why this priority**: sans plan, rien d'autre n'a de sens ; c'est la valeur centrale.

**Independent Test**: remplir le questionnaire avec les valeurs d'Arnaud et vérifier qu'un calendrier d'au moins 35 séances entre le 20/10/2026 et le 15/03/2027 est produit, sur ses jours disponibles uniquement, sans deux séances intenses consécutives.

**Acceptance Scenarios**:

1. **Given** un nouveau profil, **When** le questionnaire est validé avec 3 jours disponibles par semaine, **Then** le calendrier contient ≥ 35 séances, un test FTP en première semaine, un retest toutes les 6-8 semaines et un test final avant la date d'objectif.
2. **Given** un fichier `.fit` de l'Edge, **When** l'utilisateur choisit « Pré-remplir depuis un fichier », **Then** âge, poids, taille, sexe, FTP et FC max réglés sur le Garmin sont proposés.
3. **Given** un plan existant, **When** l'utilisateur déplace une séance à un autre jour, **Then** le plan est mis à jour et une alerte prévient si deux séances intenses se suivent.

---

### User Story 2 - Enregistrer une séance et son ressenti (Priority: P1)

Après une séance, l'utilisateur l'enregistre de l'une des façons suivantes : (a) import d'un fichier `.fit` (export Garmin Connect ou Strava), (b) saisie manuelle (durée, puissance moyenne/normalisée, FC moyenne/max, distance), (c) synchro automatique Strava. Il ajoute son ressenti : RPE 1-10, sensations (jambes, souffle, motivation), sommeil, commentaire. La séance réalisée est rattachée à la séance prévue du jour.

**Why this priority**: la saisie alimente la progression et l'adaptation du plan.

**Independent Test**: importer le fichier du 19/10/2026 et vérifier que durée (~52 min), puissance moyenne (204 W), NP (~229 W), FC moyenne (157) et les meilleures puissances (5 min ≈ 271 W, 20 min ≈ 219 W) sont reconnues.

**Acceptance Scenarios**:

1. **Given** une séance prévue aujourd'hui, **When** j'importe un `.fit` du même jour, **Then** elle est marquée réalisée avec ses métriques et le taux de respect des cibles.
2. **Given** une sortie dehors sans capteur de puissance, **When** je la saisis à la main avec FC et RPE, **Then** elle compte dans la charge (TSS estimé à partir de la FC) mais pas dans l'estimation de FTP.
3. **Given** une séance de type test, **When** elle est importée, **Then** l'app calcule la nouvelle FTP, demande confirmation et recalcule toutes les cibles futures.

---

### User Story 3 - Voir sa progression (Priority: P1)

Un tableau de bord montre : séances réalisées / objectif (ex. 12/35), courbe FTP (tests + FTP estimée) contre la trajectoire cible 250 → 300 W, W/kg, forme/fatigue (CTL/ATL/TSB), meilleures puissances (1, 5, 20 min) et tendance des ressentis.

**Why this priority**: c'est la motivation et le contrôle de la faisabilité de l'objectif.

**Independent Test**: avec 3 séances importées dont un test, le tableau de bord affiche le compteur, la courbe et une projection à la date d'objectif.

**Acceptance Scenarios**:

1. **Given** au moins un test FTP, **When** j'ouvre la progression, **Then** je vois l'écart à la trajectoire cible et une projection réaliste à la date d'objectif.
2. **Given** deux séances clés d'affilée avec RPE ≥ 9 ou cibles non tenues, **Then** l'app suggère d'alléger la séance suivante ; avec RPE ≤ 6 sur les deux dernières séances clés, elle suggère +2 % sur les cibles.

---

### User Story 4 - Envoyer la séance sur l'Edge 530 (Priority: P2)

Depuis une séance prévue, l'utilisateur exporte un fichier d'entraînement structuré `.fit` (paliers en watts calculés depuis sa FTP actuelle). Copié dans `Garmin/NewFiles` de l'Edge, il apparaît dans Entraînements ; l'Edge pilote alors le Flux 2 en mode ERG. En V2, envoi direct dans Garmin Connect puis synchro vers l'Edge.

**Why this priority**: gros confort, mais il existe un repli manuel.

**Independent Test**: exporter la séance « 3 × 12 min sweet spot », relire le fichier avec un parseur FIT indépendant et retrouver les étapes, durées et cibles en watts.

**Acceptance Scenarios**:

1. **Given** une FTP de 255 W, **When** j'exporte « 3 × 12 min à 90 % », **Then** le fichier contient les étapes d'échauffement, 3 blocs à 225-235 W avec récupérations, et le retour au calme.

---

### User Story 5 - Synchro automatique Strava (Priority: P3)

L'utilisateur connecte son compte Strava (OAuth) ; chaque nouvelle activité vélo est récupérée automatiquement (webhook) avec ses flux puissance/FC et rattachée à la séance prévue du jour.

**Why this priority**: confort ; l'import de fichier couvre déjà le besoin.

**Independent Test**: connecter Strava, terminer une séance, vérifier son apparition en moins de 5 min sans action manuelle.

---

### Edge Cases

- Séance manquée : le plan propose de la reporter dans les 48 h ou de la supprimer, sans casser la règle des 48 h entre séances intenses.
- Deux activités le même jour : l'utilisateur choisit laquelle rattacher.
- Fichier `.fit` sans puissance (sortie dehors) : métriques FC seulement, pas d'estimation de FTP.
- Fichier invalide ou compressé (`.fit.gz` de Strava) : décompression automatique ou message d'erreur clair.
- Test raté ou interrompu : l'utilisateur peut refuser la FTP calculée.
- Semaine de vacances (Noël) : jours marqués indisponibles, séances redistribuées.
- Date d'objectif atteinte avant 35 séances : le compteur et l'alerte le signalent dès que le rythme devient insuffisant.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le système DOIT proposer un questionnaire initial (âge, poids, taille, sexe, FTP actuelle ou inconnue, FC max/repos, objectif FTP, date d'objectif, date de fin, nb minimum de séances, jours et durées disponibles, séances HT/semaine, autres sports, type de test) et permettre de le modifier ensuite.
- **FR-002**: Le système DOIT pouvoir pré-remplir le profil depuis un fichier `.fit` du Garmin (profil utilisateur et zones).
- **FR-003**: Le système DOIT générer un plan périodisé respectant : test FTP en semaine 1, semaine allégée toutes les 3-4 semaines, retest toutes les 6-8 semaines, test final avant la date d'objectif, ≥ 48 h entre deux séances intenses, durée de séance ≤ durée disponible du jour.
- **FR-004**: Chaque séance prévue DOIT décrire ses étapes (durée, % FTP, watts, cadence conseillée) et son objectif physiologique en français.
- **FR-005**: Le système DOIT recalculer toutes les cibles en watts quand la FTP change.
- **FR-006**: L'utilisateur DOIT pouvoir déplacer, sauter, remplacer ou ajouter une séance.
- **FR-007**: Le système DOIT importer les fichiers `.fit` et `.fit.gz` et calculer : durée, distance, puissance moyenne, NP, IF, TSS, FC moyenne/max, cadence, meilleures puissances 5 s / 1 / 5 / 20 min.
- **FR-008**: Le système DOIT permettre la saisie manuelle d'une séance (dont les sorties sans puissance, TSS estimé par la FC).
- **FR-009**: Chaque séance réalisée DOIT pouvoir recevoir un ressenti : RPE 1-10, jambes, souffle, motivation, sommeil, commentaire.
- **FR-010**: Le système DOIT afficher compteur de séances, courbe FTP vs trajectoire cible, W/kg, CTL/ATL/TSB, meilleures puissances et ressentis.
- **FR-011**: Le système DOIT suggérer un ajustement (± cibles) selon les ressentis et le respect des cibles des séances clés récentes.
- **FR-012**: Le système DOIT exporter une séance prévue en fichier workout `.fit` compatible Edge 530 (cibles en watts absolus).
- **FR-013**: Le système DOIT fonctionner hors ligne et synchroniser les données avec Supabase quand l'utilisateur est connecté (email ou Google).
- **FR-014**: Le système DEVRAIT récupérer automatiquement les activités Strava (OAuth + webhook) — V2.
- **FR-015**: Le système DEVRAIT envoyer une séance directement dans Garmin Connect — V2, sous réserve d'accès à l'API Garmin (voir research.md).
- **FR-016**: L'utilisateur DOIT pouvoir exporter/importer toutes ses données en JSON.

### Key Entities

- **Profil**: données physiques, FTP courante, FC max/repos, objectif (FTP cible, date), disponibilités, préférences de test.
- **Plan**: date de début/fin, blocs (type, semaines), liste de séances prévues ; régénérable.
- **Séance prévue**: date, type (endurance, sweet spot, seuil, VO2, test, récup, affûtage), modèle de séance, statut (à faire / réalisée / sautée / déplacée).
- **Modèle de séance**: nom, objectif, étapes (durée, % FTP bas/haut, cadence, intensité), répétitions.
- **Activité réalisée**: source (fichier, manuel, Strava), date, métriques, flux puissance/FC résumés, lien vers une séance prévue.
- **Ressenti**: RPE, jambes, souffle, motivation, sommeil, commentaire.
- **Test FTP**: date, protocole (20 min / rampe), valeur mesurée, FTP retenue.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Questionnaire rempli et plan généré en moins de 3 minutes.
- **SC-002**: Enregistrer une séance (import ou saisie + ressenti) en moins de 60 secondes sur téléphone.
- **SC-003**: Au 15/03/2027, au moins 35 séances réalisées et visibles dans le compteur.
- **SC-004**: Les métriques importées d'un `.fit` diffèrent de moins de 2 % de celles affichées par Garmin Connect (puissance moyenne, NP, FC moyenne).
- **SC-005**: 100 % des workouts exportés s'ouvrent sur l'Edge 530 et pilotent le Flux 2 en ERG.
- **SC-006**: Progression FTP mesurée par test, objectif 300 W (≈ 3,6-3,7 W/kg) au test final début mars.

## Assumptions

- Utilisateur principal : Arnaud (triathlète, ~81-84 kg), d'autres utilisateurs possibles plus tard grâce au questionnaire.
- La puissance de référence est celle du Flux 2 ; les sorties extérieures servent à la charge (TSS par FC), pas à l'estimation de FTP.
- Le calendrier par défaut démarre le 20/10/2026 et finit le 15/03/2027, test final la semaine du 1er mars.
- 2 séances clés HT par semaine + 1 séance optionnelle (endurance/tempo, HT ou dehors) ; c'est ce volume qui rend les 35 séances et la progression réalistes.
- Garmin Connect n'offre pas d'API d'envoi de séances ouverte aux particuliers : la V1 passe par un fichier `.fit` à copier sur l'Edge.
- Strava n'exige pas d'abonnement payant pour l'accès API à ses propres activités.
