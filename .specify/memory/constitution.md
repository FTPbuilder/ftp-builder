# FTP Builder Constitution

## Core Principles

### I. Entraînement d'abord, gadgets ensuite
Chaque fonctionnalité doit servir directement l'objectif : réaliser au moins 35 séances structurées et faire progresser la FTP. Une fonctionnalité qui n'aide ni à planifier, ni à exécuter, ni à mesurer une séance est hors périmètre tant que le cœur n'est pas livré.

### II. Science honnête
Les cibles et estimations reposent sur des méthodes reconnues (FTP = 95 % du meilleur 20 min ou 75 % de la meilleure minute en test rampe, zones de Coggan, TSS/CTL/ATL). L'app affiche l'écart entre objectif et trajectoire réelle sans l'enjoliver, et recalcule les cibles après chaque test. Aucune promesse de résultat.

### III. Monofichier, zéro build
L'application est une PWA en un seul `index.html` (HTML + CSS + JS vanilla), sans framework ni étape de build, comme Carbon FOODprint. Bibliothèques externes uniquement via CDN versionné, et seulement si indispensables. Le parseur et l'encodeur FIT sont écrits en interne.

### IV. Local d'abord, synchro ensuite
Toutes les données vivent d'abord dans l'état local `S` (localStorage), l'app fonctionne hors ligne. Supabase synchronise l'état (auth email + Google, RLS par utilisateur). Les secrets (Strava, Garmin) ne sont jamais dans le front : ils passent par des Edge Functions.

### V. Mobile d'abord, en français
Interface en français, pensée pour le téléphone (saisie post-séance en moins de 60 s), utilisable aussi sur grand écran. Chaque saisie est corrigeable a posteriori.

## Contraintes techniques

- Hébergement : GitHub Pages (compte personnel), service worker versionné.
- Données d'entraînement : puissance du home trainer (Tacx Flux 2) et FC de la ceinture, enregistrées par le Garmin Edge 530. Les sorties sans capteur de puissance sont saisies en FC + RPE.
- Formats : import `.fit` (et `.fit.gz`), export de séances structurées en `.fit` (workout) lisible par l'Edge 530, qui pilote le Flux 2 en mode ERG.
- Validation : `node --check` sur le JS extrait + tests du parseur/encodeur FIT sur des fichiers réels avant chaque livraison.

## Workflow de développement

- Spec Kit : `/speckit-specify` → `/speckit-clarify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`.
- Les modifications se font par petites éditions ciblées de `index.html`, version incrémentée à chaque livraison (`APP_VERSION` + cache du service worker).
- Toute fonctionnalité dépendant d'une API tierce (Strava, Garmin Connect) a un repli manuel (fichier ou saisie).

## Governance

Cette constitution prime sur les autres pratiques du projet. Un amendement se fait en modifiant ce fichier, avec incrément de version (MAJEUR : principe retiré ou redéfini ; MINEUR : principe ajouté ; CORRECTIF : clarification). `/speckit-analyze` vérifie la conformité des plans et tâches avant implémentation.

**Version**: 1.0.0 | **Ratified**: 2026-10-19 | **Last Amended**: 2026-10-19
