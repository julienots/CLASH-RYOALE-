# Futur mode en ligne et paiements : exigences

> Rien de ce document n'est implémenté. La version actuelle est entièrement hors ligne,
> sans serveur et sans aucun paiement réel. Ce document prépare la suite.

## 1. Pourquoi un backend est indispensable

Une sauvegarde locale peut toujours être modifiée par le joueur. Dès qu'il y a de l'argent réel,
des classements ou du multijoueur, **l'autorité doit être côté serveur** :

- inventaire, monnaies, collection, progression du pass ;
- génération du contenu des coffres (RNG serveur, probabilités publiées) ;
- validation des achats et attribution des biens ;
- résultats des combats en ligne.

## 2. Architecture recommandée

- **API authentifiée** (HTTPS, jetons courts + jeton de rafraîchissement). Connexion via Google Play Games
  Services ou compte e-mail.
- **Base transactionnelle** (PostgreSQL) : tables `players`, `inventory`, `cards`, `transactions`
  (journal immuable avec identifiant idempotent), `purchases`, `pass_progress`.
- **Endpoints idempotents** : chaque action client (`openChest`, `buyOffer`, `claimTier`, `upgradeCard`)
  envoie un identifiant unique ; un rejeu renvoie le même résultat sans double crédit.
  Les fonctions de `src/meta/*.ts` sont déjà pures et déterministes : elles peuvent être exécutées
  côté serveur (Node) avec les mêmes tests.
- **Horloge serveur** pour offres quotidiennes, saisons et coffres (fin de la dépendance à l'horloge locale).
- **Multijoueur temps réel** : la simulation est déterministe ; deux options : serveur autoritaire qui exécute
  `Battle` et diffuse l'état, ou lockstep (échange des seules actions `playCard` horodatées par tick)
  avec vérification serveur. Prévoir matchmaking par trophées et gestion des déconnexions.

## 3. Google Play Billing

- Bibliothèque **Play Billing** (via un plugin Capacitor maintenu) côté client.
- **Vérification serveur obligatoire** de chaque jeton d'achat via l'API Google Play Developer
  (`purchases.products.get` / `purchases.subscriptions`), puis **acknowledge/consume** uniquement après
  attribution réussie des biens.
- Notifications en temps réel (RTDN via Pub/Sub) pour remboursements et annulations : retirer les biens.
- Produits consommables (packs de cristaux) et éventuellement abonnement/achat unique pour le pass premium.
- Affichage clair des prix localisés fournis par Google, jamais codés en dur.

## 4. Obligations et éthique

- Publier les **probabilités** de chaque coffre (déjà affichées dans le jeu).
- Respecter les règles de Google Play sur les boîtes à butin et les lois locales (certains pays les interdisent
  ou imposent des restrictions ; prévoir de désactiver les coffres payants par région).
- Contrôle parental, limites de dépenses, confirmation avant tout achat.
- **Aucun avantage compétitif exclusif payant** : tout doit rester obtenable en jouant
  (règle déjà respectée par la version hors ligne).
- RGPD : consentement, export et suppression des données.

## 5. Migration depuis la version hors ligne

Proposer une importation unique de la sauvegarde locale à la création du compte, plafonnée et validée par
le serveur (les données locales ne sont pas fiables).
