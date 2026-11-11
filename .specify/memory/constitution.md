# FTP Builder Constitution

## Core Principles

### I. Entraînement d'abord, gadgets ensuite
Chaque fonctionnalité doit servir directement l'objectif : réaliser au moins 35 séances structurées et faire progresser la FTP. Une fonctionnalité qui n'aide ni à planifier, ni à exécuter, ni à mesurer une séance est hors périmètre tant que le cœur n'est pas livré.

### II. Science honnête
Les cibles et estimations reposent sur des méthodes reconnues (FTP = 95 % du meilleur 20 min ou 75 % de la meilleure minute en test rampe, zones de Coggan, TSS/CTL/ATL). L'app affiche l'écart entre objectif et trajectoire réelle sans l'enjoliver, et recalcule les cibles après chaque test. Aucune promesse de résultat.

### III. Zéro build, fichiers par domaine
L'application est une PWA en HTML + CSS + JS vanilla, sans framework ni étape de build. `index.html` porte la structure, le style et `APP_VERSION` ; le code vit dans `js/NN-domaine.js` (scripts classiques chargés dans l'ordre, un fichier par domaine : plan, FIT, rendu, mobilité, cloud…). Un fichier ne s'appuie, au chargement, que sur les fichiers qui le précèdent. Bibliothèques externes uniquement via CDN versionné, et seulement si indispensables. Le parseur et l'encodeur FIT sont écrits en interne.

### IV. Local d'abord, synchro ensuite
Toutes les données vivent d'abord dans l'état local `S` (localStorage), l'app fonctionne hors ligne. Supabase synchronise l'état (auth email + Google, RLS par utilisateur). Les secrets (Strava, Garmin) ne sont jamais dans le front : ils passent par des Edge Functions.

### V. Mobile d'abord, en français
Interface en français, pensée pour le téléphone (saisie post-séance en moins de 60 s), utilisable aussi sur grand écran. Chaque saisie est corrigeable a posteriori.

## Contraintes techniques

- Hébergement : GitHub Pages (compte personnel), service worker versionné.
- Données d'entraînement : puissance du home trainer (Tacx Flux 2) et FC de la ceinture, enregistrées par le Garmin Edge 530. Les sorties sans capteur de puissance sont saisies en FC + RPE.
- Formats : import `.fit` (et `.fit.gz`), export de séances structurées en `.fit` (workout) lisible par l'Edge 530, qui pilote le Flux 2 en mode ERG.
- Validation : la CI GitHub Actions lance `tests/check-syntax.mjs` puis `tests/run-all.mjs` à chaque push ; un test en échec bloque, sauf s'il figure dans `tests/quarantine.txt` (tests périmés à réparer).
- Erreurs : toute erreur JS est journalisée localement et remontée dans la table Supabase `client_errors` quand l'utilisateur est connecté.

## Workflow de développement

- Spec Kit : `/speckit-specify` → `/speckit-clarify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`.
- Les modifications se font par petites éditions ciblées du fichier `js/` concerné ; chaque livraison passe par `node tools/bump.mjs X.Y.Z` (APP_VERSION + `?v=` des scripts, pour que les iPhone rechargent les fichiers).
- Toute fonctionnalité dépendant d'une API tierce (Strava, Garmin Connect) a un repli manuel (fichier ou saisie).

## Governance

Cette constitution prime sur les autres pratiques du projet. Un amendement se fait en modifiant ce fichier, avec incrément de version (MAJEUR : principe retiré ou redéfini ; MINEUR : principe ajouté ; CORRECTIF : clarification). `/speckit-analyze` vérifie la conformité des plans et tâches avant implémentation.

**Version**: 2.0.0 | **Ratified**: 2026-10-19 | **Last Amended**: 2026-11-11
