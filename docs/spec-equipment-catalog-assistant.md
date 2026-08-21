# Spécification — Assistant catalogue Matériel et équipement des salles

Date : 2026-08-15  
Statut : décision Product Owner intégrée, candidat DEV à revalider  
Modules : 07a Stock / Parc matériel, 02 Ressources

## 1. Objectif et ordre métier

Le parcours est strictement séquentiel :

1. rechercher un produit dans le catalogue assisté ;
2. choisir une suggestion ou continuer manuellement ;
3. vérifier et corriger la fiche technique proposée ;
4. créer l'article de catalogue ;
5. créer l'exemplaire physique avec numéro de série, numéro interne et coûts ;
6. placer l'exemplaire dans un site et un emplacement ;
7. pour la post-production, affecter un exemplaire existant à une salle active du même site.

Une suggestion n'est jamais enregistrée sans validation humaine. Stock 07a reste l'unique writer de l'exemplaire, de sa position et de son historique. Ressources 02 reste writer de la salle.

## 2. Inspiration produit et adaptation locale

Le parcours reprend les principes publics de Booqable : catalogue visuel, distinction produit/exemplaire, SKU, numéros de série, photos, champs personnalisés, localisation, historique et disponibilité. Sources consultées :

- https://booqable.com/features/
- https://booqable.com/industries/av-rental-software/
- https://booqable.com/blog/the-ultimate-guide-to-equipment-inventory-management/

La RC locale n'appelle ni Booqable, ni un moteur IA, ni un CDN à l'exécution. L'« assistant intelligent » est un catalogue local versionné, interrogé par recherche tolérante et scoring explicable. Ses visuels sont des actifs locaux. Une future source IA ou constructeur devra passer par un connecteur serveur optionnel, mis en cache, attribué, journalisé et désactivable ; elle n'est pas incluse ici.

## 3. Modèle

### Suggestion catalogue

`catalogId`, `catalogVersion`, `manufacturer`, `model`, `name`, `manufacturerReference`, `category`, `description`, `technicalSpecifications`, `photoUrl`, `suggestedSku`, `sourceLabel`.

`technicalSpecifications` est un objet fermé de chaînes courtes. Pour une caméra : capteur, résolution, monture, codecs, médias, connectique, alimentation, poids. La suggestion indique qu'elle doit être vérifiée avant enregistrement.

### Article Stock

Extension additive de `stockItem` : `catalogId?`, `catalogVersion?`, `manufacturer?`, `model?`, `manufacturerReference?`, `description?`, `technicalSpecifications`, `photoUrl?`. Le nom, le SKU, la catégorie et le mode de suivi restent obligatoires. L'utilisateur peut corriger les données proposées.

### Exemplaire sérialisé

Extension additive de `equipmentAsset` : `internalCode?`, `purchaseCostMinor?`, `replacementValueMinor?`, `dailyRentalPriceMinor?`, `currency`, `purchaseDate?`, `supplier?`, `warrantyEndDate?`, `assignedRoomId?`.

Les montants sont des entiers en unités mineures, non négatifs, avec la devise de la société. Le numéro de série est unique par société. Le numéro interne, lorsqu'il existe, est également unique par société.

### Affectation à une salle

Une affectation salle exige : salle active `room|suite`, exemplaire actif et disponible, même société, même site, versions courantes et permission `equipment.manage`. Stock crée ou réutilise un emplacement logique `room`, transfère physiquement l'exemplaire dans le grand livre, écrit `assignedRoomId`, incrémente les versions, audite puis publie SSE après commit.

Un exemplaire installé dans une salle n'est pas candidat à une allocation de location. La dépose transfère l'exemplaire vers un emplacement actif du même site et efface `assignedRoomId`. Une salle ne peut être désactivée tant qu'un exemplaire y est affecté.

## 4. API

- `GET /api/v1/equipment/catalog/suggestions?q=<texte>&limit=8` — `equipment.read`, 2 caractères minimum, catalogue local seulement.
- `POST|PATCH /api/v1/stock/items` — accepte les champs techniques additifs ; un `catalogId` connu fixe le visuel et la version de source.
- `POST|PATCH /api/v1/equipment/assets` — accepte numéro interne, coûts, dates et fournisseur.
- `GET /api/v1/resources/:roomId/equipment` — projection des exemplaires installés, isolée société/site.
- `POST /api/v1/resources/:roomId/equipment` — pose atomique, versions salle/exemplaire, motif.
- `DELETE /api/v1/resources/:roomId/equipment/:assetId` — dépose atomique vers `destinationLocationId`.

Erreurs stables : `QUERY_TOO_SHORT`, `CATALOG_ENTRY_NOT_FOUND`, `INTERNAL_CODE_EXISTS`, `ROOM_NOT_ASSIGNABLE`, `ASSET_UNAVAILABLE`, `SITE_MISMATCH`, `VERSION_CONFLICT`, `ROOM_HAS_EQUIPMENT`.

## 5. UX et accessibilité

- La création d'article commence par « Rechercher dans le catalogue » avec exemple « cam », « Canon C300 », « Sony FX6 ».
- Les résultats présentent visuel, fabricant, modèle, catégorie et résumé technique.
- La sélection remplit les champs sans les enregistrer et affiche « Données proposées — à vérifier ».
- L'utilisateur peut continuer sans suggestion.
- Après création de l'article, l'option « Ajouter maintenant le premier exemplaire » enchaîne sur série, numéro interne, site, emplacement, état et coûts.
- La fiche d'une salle affiche le matériel installé, série et état, avec pose/dépose réservées à l'administrateur.
- Navigation clavier, focus visible, statut textuel, erreurs associées et aucune donnée utilisateur injectée sans échappement.

## 6. Sécurité, audit et performance

- Auth, CSRF, Origin, RBAC et isolation société/site sur chaque route.
- Aucun `companyId` accepté depuis le client.
- Le catalogue est en lecture seule, borné à 20 résultats et ne contient aucun HTML actif.
- Audits : `stockItem.created|updated`, `equipmentAsset.created|updated`, `equipmentAsset.assignedToRoom`, `equipmentAsset.unassignedFromRoom`.
- SSE : `stockItem.updated.v1`, `equipmentAsset.updated.v1`, `resource.updated.v1`, `stockMovement.created.v1` après commit.
- Objectif : suggestion p95 < 100 ms sur 10 000 références ; liste de salle p95 < 150 ms sur 500 exemplaires.

## 7. Critères d'acceptation

1. « cam » retourne plusieurs caméras avec visuel local et données techniques.
2. Choisir Sony FX6 préremplit fabricant, modèle, référence, catégorie, fiche technique et SKU proposé.
3. Rien n'est persisté avant validation explicite.
4. Un article et son premier exemplaire peuvent être créés séquentiellement.
5. Série et numéro interne dupliqués sont refusés dans la même société.
6. Les coûts sont persistés en unités mineures et dans la devise de la société.
7. Un viewer peut chercher/consulter mais ne peut ni créer ni affecter.
8. Un admin peut affecter un exemplaire disponible à une salle du même site.
9. Une affectation cross-site, en maintenance, sortie ou déjà installée est refusée.
10. Le matériel installé apparaît sur la fiche de la salle après rechargement.
11. La dépose écrit un transfert physique et rend l'exemplaire à nouveau disponible pour la location.
12. La suppression d'une salle équipée est bloquée jusqu'à la dépose.
13. Le runtime reste fonctionnel sans réseau.

## 8. Hors périmètre de ce lot

Connexion live à une IA ou base constructeur, scraping automatique, reconnaissance photo, import constructeur massif, kits, inventaires avancés et module Location 06a complet. Ces extensions nécessitent leurs contrats, sources/licences, cache, quotas et gates dédiés.

## 9. Extension catalogue informatique 2026.08-local.2

L’assistant couvre désormais les caméras, stations de travail, serveurs, stockage partagé, audio, licences logicielles et licences de messagerie. La recherche accepte marque, modèle, référence et intention métier (`montage`, `serveur`, `stockage`, `mail`, `licence`) ; elle applique synonymes et distance orthographique limitée, tout en expliquant la raison de chaque proposition.

Les premières familles intégrées sont Sony, Canon, ARRI, Blackmagic Design, Lenovo, HP/HPE, Dell, Avid, Adobe et Microsoft. Le catalogue est extensible et ne prétend pas contenir chaque référence commerciale mondiale. Une entrée doit conserver sa version, son URL documentaire et le statut du visuel.

Les photos produit officielles sont enregistrées localement, avec source consultable et sans dépendance réseau à l’exécution. Leur présence publique ne vaut pas déclaration de libre réutilisation : les droits restent ceux du fabricant ou du diffuseur. Une illustration de catégorie reste autorisée lorsqu’aucune photo produit validée n’est disponible et doit être identifiée comme telle.

Un matériel physique utilise le suivi `serialized`; une licence ou un abonnement utilise `quantity` et ne déclenche pas la création d’un exemplaire portant un numéro de série. La future gestion détaillée des sièges, titulaires, dates de renouvellement et clés secrètes constitue un sous-module dédié ; aucune clé de licence ne doit être enregistrée en clair dans le catalogue.
