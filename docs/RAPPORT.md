# Rapport d'avancement — SUPERESSENCE : Abyss Arena v0.1.0

Rapport honnête : ce qui est fait et vérifié, ce qui est partiel et ce qui reste.

## Vérifications effectuées

| Vérification | Résultat |
|---|---|
| `npm test` (Vitest) | **222 tests, tous verts** |
| `npm run build` (typage strict + build de production) | OK, ~229 Ko de JS (73 Ko gzip), aucun asset externe |
| `npm run e2e` (Chromium, viewport 390×844, tactile) | Tous les écrans visités, offrande ouverte, combat réel (6 cartes glissées-déposées + 1 posée au toucher), pause, abandon, résultats, rechargement : progression conservée. **0 erreur JavaScript.** |
| Fluidité (Chromium headless, rendu logiciel, ~60 unités en mêlée) | ~43–49 images/s avec le rendu réaliste (pré-calcul ~2 s au lancement du combat) ; ~58 images/s en qualité basse |
| `npm run balance -- 3000` | 3 000 parties bot contre bot en ~95 s ; résultats dans `docs/equilibrage.txt` |
| Compilation APK Android | **Non réalisée** (voir « Restant ») |

### Ce que couvrent les tests automatiques
- **Les 70 cartes** : données complètes, identifiants uniques, répartition 30/12/8/8/7/5, références valides
  (unités, contres), signature obligatoire pour légendaires et abyssale, identité visuelle distincte.
- **Chaque carte se joue réellement** : elle entre en main, se pose, l'essence est débitée, l'unité exacte
  est créée (ou le sort produit son effet sur une cible), sans valeur NaN.
- **Chaque unité/bâtiment interagit** : dégâts réels infligés à une cible ou à une tour ; puits d'essence,
  piège et nid testés spécifiquement.
- **Mécaniques** : recharge et plafond d'essence, essence doublée, main/pioche cyclique, zones de déploiement
  et poche avancée, passage par les ponts, saut de rivière, volants, ciblage sol/air/bâtiments, furtivité,
  tirs des tours, couronnes, réveil du roi, victoire au roi, prolongation, mort subite, départage, abandon,
  délai des sorts, dégâts réduits aux tours, poison, fosse, étourdissement, cratère, décomposition des
  bâtiments, déterminisme.
- **Capacités** (une par test) : charge, vol de vie, résurrection, explosion à la mort, kamikaze, montée en
  puissance, chaîne, perforation, épines, crochet, engloutissement, nécromancie, marée noire, auras,
  bouclier/soin, invocation, rage, bond, souffle de cendres.
- **IA** : termine les parties à chaque niveau ; défend ; difficulté croissante (Abyssal et Chasseur battent
  Initié nettement sur 20 parties).
- **Méta** : sauvegarde/restauration, copie de secours après corruption, sauvegarde illisible, transaction
  annulée, deck illégal réparé, déblocage/fragments, amélioration (coûts, refus), decks (échange, validation,
  les 70 cartes forment des decks légaux), coffres (probabilités = 100 %, minuterie, un seul à la fois,
  pas de double ouverture, cristaux, raretés garanties, offrande, couronnes), boutique (offres stables puis
  renouvelées, retour d'horloge sans régénération, limites, paiement, offres hebdomadaires, cosmétiques),
  SUPER PASS (30 paliers, réclamation unique, premium verrouillé, nouvelle saison), missions, succès,
  combat réel → récompenses appliquées une seule fois, événements (règles, paliers, decks imposés),
  changements d'heure (jours de 23 h et 25 h).

## Terminé

- **Combat temps réel** : arène verticale 18×32, deux voies, rivière, deux passages, 2 tours-sentinelles + 1
  Cœur-Roi par camp, essence (×2 en fin de partie), main de 4 + carte suivante, deck de 8, pioche cyclique,
  déploiement par glisser-déposer ou toucher avec zone légale affichée, unités autonomes (déplacement,
  acquisition, poursuite, attaque, mort), projectiles, zones, 7 sorts, bâtiments, 3 min + 1 min de mort
  subite + départage, pause automatique en arrière-plan, abandon confirmé.
- **70 cartes jouables** (30 mêlée/tanks, 12 distance, 8 aériens/spéciaux, 8 soutiens, 7 sorts, 5 bâtiments),
  5 factions, 6 raretés (18 communes, 19 rares, 18 épiques, 8 mythiques, 6 légendaires, 1 abyssale),
  27 capacités génériques, fiche complète par carte (`docs/CARTES.md`).
- **Légendaires** : capacité signature, animation d'invocation (colonne de lumière, bannière à l'écran),
  son dédié, cadre animé, probabilités publiques, obtenables en jouant (coffres, pass, événement).
- **IA** à 4 niveaux (réaction, erreurs réelles, défense patiente, sorts opportunistes, soutien de poussée).
- **Collection** avec filtres (rareté, coût, rôle, faction, possession, améliorables), tris ;
  **fiche de carte** avec aperçu animé (repos/marche/attaque), stats avant/après amélioration, contres,
  méthode d'obtention ; **3 decks**, validation, coût moyen, échange simple.
- **Boutique hors ligne** : 6 offres quotidiennes (cadeau, cartes, coffre) renouvelées à minuit local,
  coffres, ressources, offres spéciales hebdomadaires, cosmétiques ; limites et prix toujours visibles,
  confirmation au-delà de 100 cristaux / 1 000 or, aucune transaction réelle.
- **Coffres** : 7 types, 4 emplacements, minuterie réelle, un seul déverrouillage à la fois, ouverture
  immédiate contre cristaux, offrande gratuite toutes les 4 h, coffre des couronnes, animation d'ouverture
  carte par carte, probabilités affichées.
- **SUPER PASS** : saisons de 28 jours sur l'horloge locale, 30 paliers gratuits + premium, premium
  débloqué uniquement avec des cristaux gagnés en jeu (« mode test local », aucun paiement).
- **Missions** quotidiennes (3) et hebdomadaires (3), **12 succès**, **4 événements** horrifiques à règles
  modifiées (essence doublée, tours fragiles, deck abyssal imposé au bot, decks miroirs) avec paliers.
- **Progression** : niveau de compte (XP de combat et d'amélioration, récompenses de niveau, tours plus
  fortes), trophées, 6 cercles d'arène, statistiques, cosmétiques (bannière, émote utilisable en combat,
  effet d'invocation visible en combat).
- **Sauvegarde locale robuste** : enveloppe avec somme de contrôle, copie de secours, relecture de
  vérification, réparation/migration, horloge qui ne recule jamais, identifiants de combat anti-double
  récompense, transactions atomiques.
- **Rendu réaliste (v0.2)** : créatures modélisées en volumes 3D (ellipsoïdes et capsules fusionnés)
  et rendues pixel par pixel avec matériaux distincts (chair ridée et veinée avec diffusion sous-cutanée,
  chitine à écailles brillantes, os poreux, peau abyssale luisante, métal rouillé, pierre), yeux
  émissifs, membranes translucides ; arène au sol éclairé (terre, dalles de pierre, sang séché, rivière
  de sang avec berges), ponts de côtes, rochers et ossements sculptés, tours de pierre et d'os avec œil
  vivant qui suit sa cible et cœur battant. Images d'animation pré-calculées au début du combat
  (~2 s, écran « Invocation des créatures ») ; illustrations de cartes générées en arrière-plan.
  La qualité « basse » conserve l'ancien rendu vectoriel, plus léger.
- **Rendu et audio originaux** : 25 plans corporels procéduraux animés, illustrations de cartes générées
  par le même modèle que l'unité, arène 2.5D (ombres, profondeur, rivière animée), télégraphes de sorts,
  particules en pool plafonnées selon la qualité, chiffres de dégâts, secousses, cache d'animations ;
  sons et musique synthétisés, volumes musique/effets séparés.
- **12 écrans** reliés aux systèmes : accueil/Combattre, combat, résultats, collection, deck, fiche, boutique,
  coffres, SUPER PASS, missions/événements/succès, profil, paramètres (audio, commandes, qualité, grille,
  chiffres de dégâts, vibrations, réinitialisation à double confirmation). Aide au premier lancement.

## Partiel

- **Équilibrage** : 4 passes sur 3 000 parties. Il reste 3 cartes à ~65 % de victoires à niveau égal
  (Titan Ossuaire, L'Innommable, Comète de Rouille) et le Piège à Mâchoires à ~35 %. Les bots les jouent
  peut-être mieux ou moins bien qu'un humain : à valider par des parties réelles.
- **Animations et réalisme** : rendu procédural « sculpture numérique » (volumes, matériaux, éclairage)
  — nettement plus réaliste que la v0.1 mais ce n'est pas de l'art peint ou de la 3D photoréaliste ;
  4 à 6 images par animation (repos, marche, attaque). Les sorts restent illustrés en 2D.
  Des créatures d'un même plan corporel partagent leur squelette (couleurs, membres, armes et
  proportions les différencient).
- **Performance Android** : mesurée uniquement dans Chromium headless (rendu logiciel). Non mesurée sur un
  vrai téléphone.
- **Combat interrompu** : quitter l'application en plein combat ne sauvegarde pas l'état du combat
  (la partie est perdue sans pénalité ni récompense) ; la progression méta, elle, est intacte.

## Restant / non implémenté

- **APK Android** : le projet Capacitor (`android/`) est généré, mais la compilation a échoué dans
  l'environnement de développement car `dl.google.com` (plugin Gradle Android, SDK) renvoyait 403.
  **Aucun APK n'est fourni.** Commande à lancer sur une machine avec le SDK : `npm run android:apk`.
  Tests tactiles sur appareil réel : à faire.
- **Multijoueur en ligne, comptes, achats réels** : non implémentés (exigences dans
  `docs/BACKEND_ET_PAIEMENTS.md`). Aucun écran ne simule un mode en ligne.
- **Skins de cartes**, émotes animées, classements, clans, replays : non implémentés.
- **Localisation** : jeu uniquement en français.
- **Accessibilité** : pas de mode daltonien dédié (les camps se distinguent par couleur ET position).
