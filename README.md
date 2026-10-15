# SUPERESSENCE : Abyss Arena

Jeu mobile de stratégie en temps réel à cartes, dans un univers d'horreur dark fantasy et biomécanique.
On pose des cartes : chacune invoque une vraie unité ou déclenche un vrai sort dans l'arène, et le combat
se déroule automatiquement. Le jeu reprend les grands systèmes du genre (deux voies, rivière et passages,
tours, essence qui se recharge, main de 4 cartes, deck de 8) avec un contenu entièrement original :
70 monstres et sorts, illustrations, sons et musique générés par le code.

- **Hors ligne contre des bots** (4 niveaux de difficulté), sauvegarde locale.
- **Aucun achat en argent réel** : or et cristaux se gagnent en jouant.
- Le multijoueur en ligne **n'existe pas** dans cette version (voir `docs/BACKEND_ET_PAIEMENTS.md`).

## Lancer le jeu

Prérequis : Node.js 20 ou plus.

```bash
npm install
npm run dev          # serveur de développement : http://localhost:5173 (ouvrir sur mobile via l'IP locale)
npm run build        # vérification des types + build de production dans dist/
npm run preview      # sert le build de production
```

Le jeu est optimisé pour un écran de téléphone en portrait. Sur ordinateur, réduisez la largeur de la fenêtre
ou utilisez le mode appareil mobile des outils de développement.

## Tests

```bash
npm test             # 222 tests unitaires et d'intégration (Vitest)
npm run e2e -- http://localhost:5173/ dossier-captures   # test de bout en bout dans Chromium (serveur dev lancé)
npm run balance -- 3000                                  # simulation d'équilibrage bot contre bot
npx vite-node scripts/catalog.ts                         # régénère docs/CARTES.md
```

Le test de bout en bout lance un vrai Chromium en viewport mobile : il parcourt tous les écrans, ouvre un
coffre, joue un combat (glisser-déposer et toucher), met en pause, abandonne, puis vérifie que la progression
survit au rechargement. Il nécessite `playwright-core` (déjà en dépendance) et un Chromium local
(`CHROME_PATH` pour le chemin de l'exécutable).

## Compiler l'APK Android

Le projet Android Capacitor est dans `android/` (orientation portrait, identifiant `com.superessence.abyssarena`).

```bash
# Prérequis : JDK 17+ et SDK Android (ANDROID_HOME), par exemple via Android Studio.
npm run android:apk
# APK debug : android/app/build/outputs/apk/debug/app-debug.apk
```

Ou bien `npm run android:sync` puis ouvrir `android/` dans Android Studio.

> **État actuel** : l'APK n'a **pas** pu être compilé dans l'environnement de développement utilisé,
> car l'accès à `dl.google.com` (SDK Android et plugin Gradle Android) y était bloqué (erreur 403).
> Le build web et tous les tests passent ; la compilation Android reste à faire sur une machine avec le SDK.

## Architecture

TypeScript + Canvas 2D (aucun moteur lourd), Vite pour le build, Capacitor pour Android.
La simulation est **totalement séparée du rendu** : elle est déterministe, testable sans navigateur
et utilisée telle quelle par les tests, l'IA, l'équilibrage et le jeu.

```
src/
  core/        types, catalogue des 70 cartes (cards.ts), progression/raretés, RNG déterministe
  sim/         battle.ts : simulation temps réel (pas fixe 1/30 s) — arène, tours, essence, main,
               ciblage, déplacement par les passages, projectiles, zones, sorts, 27 capacités
               ai.ts : IA (Initié, Chasseur, Cauchemar, Abyssal)
  meta/        sauvegarde (somme de contrôle + copie de secours), économie, coffres, boutique,
               SUPER PASS, missions, succès, événements, préparation/récompenses des combats, horloge
  render/      sculpt.ts : moteur de « sculpture » volumétrique (ellipsoïdes, capsules fusionnées,
               rendu par pixel : relief, peau/chitine/os/métal/pierre, diffusion sous-cutanée, reflets)
               anatomy.ts : anatomie 3D animée des 25 plans corporels ; arenaArt.ts : sol, rivière,
               ponts, rochers, ossements et tours sculptés ; spriteCache.ts : cache + pré-calcul des
               animations ; cardArt.ts : illustrations (même modèle que l'unité) ; battleView.ts : combat ;
               sprites.ts : rendu vectoriel simplifié (qualité « basse ») ; fx.ts : particules en pool
  audio/       sons et musique synthétisés (WebAudio), volumes séparés
  ui/          coquille, navigation et 12 écrans
tests/         Vitest : cartes, combat, capacités, IA, méta, sauvegarde
scripts/       e2e.mjs, balance.ts, catalog.ts, shot.mjs
dev/           galerie de développement (toutes les illustrations et poses)
docs/          plan, rapport, catalogue des cartes, équilibrage, backend et paiements
```

## Ajouter une nouvelle carte

Tout se fait dans `src/core/cards.ts`, sans toucher au moteur.

1. **Déclarer l'unité** (sauf pour un sort) avec `unit(id, nom, {...})` :
   statistiques au niveau de puissance 9 (`hp`, `damage`, `hitSpeed`, `range`, `speed`, `targets`…),
   capacités éventuelles (`abilities: [{ type: 'charge', ... }]`, voir le type `Ability` dans `types.ts`)
   et visuel `vis(plan, échelle, faction, { yeux, épines, membres, tentacules, cornes, variant })`.
2. **Déclarer la carte** avec `card(id, {...})` : nom, rareté, faction, coût, `kind`
   (`unit`, `spell`, `building`), catégorie, rôle, description, forces, faiblesses, contres,
   et `spawns: one('id_unite', nombre)` ou `spell: {...}`. Une légendaire/abyssale exige une `signature`.
3. `npm test` : les tests vérifient automatiquement que la carte a des données complètes, une identité visuelle
   distincte, qu'elle se joue, crée son unité/effet et inflige réellement des dégâts.
4. Optionnel : `npm run balance` pour vérifier son taux de victoire, puis `npx vite-node scripts/catalog.ts`.

Une capacité vraiment nouvelle s'ajoute dans le type `Ability` (`types.ts`) puis dans
`Battle.updateAbilities` / `attack` / `cleanupDead` (`sim/battle.ts`), avec un test dans `tests/battle.test.ts`.

## Documents

- `docs/AUDIT_ET_PLAN.md` — audit initial, choix d'architecture et plan par lots
- `docs/RAPPORT.md` — ce qui est terminé, testé, partiel ou restant
- `docs/CARTES.md` — fiche complète des 70 cartes (générée)
- `docs/equilibrage.txt` — dernière simulation d'équilibrage (3 000 parties)
- `docs/BACKEND_ET_PAIEMENTS.md` — exigences pour un futur mode en ligne et Google Play Billing
