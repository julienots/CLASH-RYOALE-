# Audit initial et plan de réalisation

## 1. Audit (14/10/2026)

| Élément | Constat |
|---|---|
| Dépôt `julienots/CLASH-RYOALE-` | **Vide** : aucun commit, aucun fichier, aucun asset. Rien à préserver ni à migrer. |
| Moteur existant | Aucun. |
| Outils disponibles | Node 22, npm, JDK 21, Gradle 8, Chromium (tests navigateur). Pas de SDK Android. |
| Réseau | Registre npm et Maven Central accessibles ; `dl.google.com` **bloqué (403)** : SDK Android et plugin Gradle Android impossibles à télécharger. |

Conséquence : il fallait choisir une architecture et partir de zéro, en documentant les décisions.

## 2. Décisions d'architecture

- **TypeScript + Canvas 2D + DOM**, build Vite, empaquetage Android via **Capacitor**.
  Raisons : démarrage instantané, très léger sur appareils modestes, tactile natif du navigateur,
  tests automatisables sans appareil, un seul code pour Android, le web et une future version iOS.
- **Simulation déterministe séparée du rendu** (`src/sim`) : pas fixe de 1/30 s, RNG à graine.
  Elle est utilisée par le jeu, l'IA, les tests et les simulations d'équilibrage.
- **Données de cartes déclaratives** (`src/core/cards.ts`) : une carte = des données + des capacités
  génériques. Aucun code spécifique par carte, donc pas de duplication.
- **Assets 100 % originaux générés par le code** : 25 plans corporels procéduraux paramétrés
  (silhouette, couleurs, yeux, membres, épines, tentacules, cornes, variantes). L'illustration de la carte
  et l'unité en combat sont dessinées par **le même modèle**, ce qui garantit qu'elles représentent la même créature.
  Le son et la musique sont synthétisés en WebAudio. Aucun fichier tiers, aucun risque de droits.
- **Méta-jeu en fonctions pures** sur un objet `SaveData`, appliquées via `Game.transact()`
  (restauration en cas d'échec, sauvegarde après succès).

## 3. Plan par lots (réalisé dans cet ordre)

| Lot | Contenu | Critères d'acceptation | Statut |
|---|---|---|---|
| 1 | Simulation : arène, 2 voies, rivière, passages, tours, essence, main/deck/pioche, déploiement, ciblage, projectiles, victoire/défaite, prolongation | Tests de combat verts | ✅ |
| 2 | Architecture de données + 70 cartes, 27 capacités génériques | Chaque carte se joue, crée son effet réel et inflige des dégâts (tests) | ✅ |
| 3 | IA à 4 niveaux | Joue et termine les parties ; difficulté croissante mesurée | ✅ |
| 4 | Sauvegarde, collection, decks, améliorations, raretés | Tests de persistance, corruption, transactions | ✅ |
| 5 | Coffres, boutique, monnaies, récompenses | Tests de limites, anti-duplication, horloge | ✅ |
| 6 | SUPER PASS, missions, succès, événements | Tests de réclamation et de saisons | ✅ |
| 7 | Rendu 2.5D, illustrations, effets, audio, 12 écrans | Test e2e Chromium sans erreur JS | ✅ |
| 8 | Équilibrage (3 000 parties), APK | Pas de carte hors 35–66 % ; APK compilé | ⚠️ partiel (voir rapport) |

Fichiers principaux : `src/sim/battle.ts`, `src/sim/ai.ts`, `src/core/cards.ts`, `src/meta/*.ts`,
`src/render/*.ts`, `src/ui/screens/*.ts`, `tests/*.test.ts`.
