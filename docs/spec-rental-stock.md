# Spécification fonctionnelle — Matériel, location, stock et logistique

Statut : Gate SPEC définie, prête pour nouvelle revue  
Version cible : incrément post-`0.1.0-rc1`  
Date : 2026-08-14

## 1. Objectif produit

Permettre à une société de post-production de connaître la disponibilité temporelle et la localisation physique de son matériel, de préparer une réservation ou une location, d'enregistrer sa sortie puis son retour, et d'isoler immédiatement le matériel indisponible ou à maintenir.

Ce module traduit les blocs **Matériel** et **Stock & Logistique** du synoptique cible sans engager la migration de stack décrite dans `docs/architecture.md`. Le premier incrément reste compatible avec la RC1 : monolithe Node.js/CommonJS, API `/api/v1`, SSE et persistance atomique dans `data/planify.json`. Une migration TypeScript/React/SQLite demeure un chantier distinct soumis à approbation, plan de migration et rollback.

Le planning reste l'autorité des engagements dans le temps. Le module matériel/stock devient l'autorité de l'identité physique, de l'état et de la localisation des articles. Une opération n'est valide que si ces deux autorités sont cohérentes.

## 2. Périmètre incrémental

### 2.1 Inclus dans le premier incrément `07a → 06a`

- catalogue d'articles matériels, sérialisés ou gérés en quantité ;
- exemplaires sérialisés avec numéro de série unique par société ;
- emplacements de stock rattachés à un site ;
- stock disponible calculé depuis un journal de mouvements immuable ;
- dossiers logistiques rattachables à une réservation du planning et à son projet ;
- workflow `brouillon → préparation → prêt → sorti → retourné`, avec annulation logique ;
- affectation d'exemplaires précis pendant la préparation ;
- réservations/location interne ou externe utilisant les mêmes règles de disponibilité ;
- sortie et retour partiels, constat d'état au départ et au retour ;
- mise en quarantaine et maintenance simple d'un exemplaire ;
- conflits combinant chevauchement planning, quantité disponible, état matériel et mouvements en cours ;
- permissions serveur, isolation société/site, contrôle optimiste par `version`, audit et invalidation SSE après commit ;
- recherche et filtres par site, emplacement, article, numéro de série, état, disponibilité et dossier.

### 2.2 Cible documentée mais hors premier incrément

Le lot 07 avancé est documenté ici pour stabiliser les frontières futures, mais il ne fait partie ni de `07a Stock socle` ni de `06a Location`. Ses routes, données seedées et entrées UI restent absentes tant qu'un nouveau Gate DEV n'est pas ouvert :

- kits composés d'articles et/ou d'exemplaires ;
- transferts métier inter-emplacements/inter-sites ;
- inventaires, comptages et ajustements issus d'inventaire ;
- impression et scan matériel de codes-barres/QR.

Les mouvements internes strictement nécessaires à `checkout`, `return`, maintenance et quarantaine appartiennent bien à 07a/06a. Un changement administratif d'emplacement d'un exemplaire disponible dans 07a utilise la même écriture atomique, sans exposer le workflow avancé de transfert.

### 2.3 Hors périmètre du programme 0.2

- achats, fournisseurs, commandes et réapprovisionnement automatique ;
- tarifs complexes, devis, facturation, caution, paiement et rentabilité ;
- assurance, amortissement comptable et immobilisations ;
- maintenance préventive par compteur, pièces détachées et ordres de travail détaillés ;
- livraison, transporteurs, tournées et signature électronique ;
- consommation par scan matériel ; un identifiant de scan est néanmoins stockable pour compatibilité future ;
- consommation irréversible de consommables ; le premier incrément exige le retour ou un ajustement explicite ;
- réservation inter-sociétés, transfert inter-sociétés et stock négatif ;
- intégrations Rentman, ERP, CRM ou API externes ;
- application mobile native et fonctionnement hors connexion synchronisé.

### 2.4 Lots ordonnés et dépendances

1. **Stock socle** : articles, exemplaires, emplacements, grand livre de mouvements, soldes reconstructibles, consultation de disponibilité et maintenance simple.
2. **Location et workflow logistique** : dossiers, préparation, affectation, sortie, retour et audit. Ce lot dépend obligatoirement du lot 1 intégré et approuvé ; il n'implémente aucun compteur de stock parallèle.
3. **Kits, transferts et inventaire** : modèles de kits, transferts, comptage et ajustement motivé. Ce lot dépend des lots 1 et 2 intégrés et approuvés.

L'ordre `Stock socle → Location → Kits et inventaire` est contractuel. Chaque lot repasse l'ensemble des gates applicables. Les routes et entrées de navigation d'un lot ne sont activées qu'avec ce lot complet ; aucun endpoint d'un lot ultérieur ne doit être exposé comme fonctionnel par un fallback prototype. Le lot 2 fonctionne avec des lignes ajoutées directement ; un kit n'est donc pas requis pour préparer une location avant le lot 3.

### 2.5 Ownership nommé et handoffs

| Frontière / fichiers | Owner responsable | Critère de handoff obligatoire |
|---|---|---|
| Contrat partagé stock/disponibilité et commandes physiques | **Stock 07a owner (`stock_07a`)**, avec co-revue du **Planning Engine owner (`Agent 04`)** | DTO, codes d'erreur, intervalles semi-ouverts et matrice des conflits publiés ; tests positifs/négatifs Planning ↔ Stock verts |
| Backend/persistance Stock : `server.js`, schéma additif `data/planify.json`, tests domaine/API Stock | **Stock 07a owner (`stock_07a`)** | grand livre reconstructible, mutations atomiques, isolation/RBAC, idempotence et rollback démontrés ; aucun compteur parallèle |
| Backend Location : cas d'usage 06a dans `server.js` et tests de workflow | **Location 06a owner (`rental_06a`)** | consomme exclusivement les commandes 07a ; machine d'état et sorties/retours partiels testés ; aucune écriture directe des projections Stock |
| Frontend `app.js`, `index.html`, `styles.css`, `planning.css` | **Frontend owner (`Agent intégrateur`)** | permissions visibles, états UI complets, clavier/focus, conflits et concurrence rendus sans fail-open |
| Revue indépendante | **Code Review owner (`Agent 07`)** | diff et consommateurs revus ; `docs/code-review.md` daté ; aucun P0/P1 ouvert ; le reviewer ne corrige pas le code approuvé |
| QA et E2E | **QA owner (`Agent 08`)** | tests ciblés puis `npm test`, E2E déterministes et `docs/qa-report.md` avec zéro échec |
| Performance | **Performance owner (`Agent 10`)** | jeu de référence mesuré, p95 et limites consignés dans `docs/performance-report.md` |
| Sécurité | **Security owner (`Agent 11`)** | isolation, RBAC, CSRF, entrées, audit et absence de fuite vérifiés dans `docs/security-review.md` |
| Assemblage, statut et release candidate | **Integration owner (`Agent 12`)** | lots assemblés dans l'ordre 07a → 06a, `docs/project-status.md` synchronisé, smoke local et gates aval sur le même état |

Un seul writer intervient à la fois sur `server.js` : `stock_07a` publie et remet le contrat/implémentation 07a approuvé à `rental_06a`, puis `rental_06a` ajoute uniquement l'orchestration 06a. Chaque handoff fournit fichiers modifiés, décisions, commandes/résultats, risques, rollback et statut du gate. L'owner d'un lot ne peut pas rendre le verdict indépendant de sa propre modification.

## 3. Vocabulaire et entités

Toutes les entités portent `id`, `companyId`, `createdAt`, `updatedAt` et, si elles sont modifiables, `version`. Les identifiants sont opaques. `companyId` provient exclusivement de la session. Les dates reçues sont ISO 8601 avec offset et sont persistées comme instants UTC.

### 3.1 Article matériel (`stockItem`)

Référence de catalogue commune à un modèle d'équipement ou à un article homogène.

Champs structurants :

- `companyId`, `name`, `sku`, `category`, `trackingMode`, `unit`, `active` ;
- `trackingMode` fermé : `serialized` ou `quantity` ;
- `unit` fermé pour l'incrément : `piece` ;
- `defaultResourceType?` pour le rapprochement UI avec les types de ressources existants ;
- `notes?`, texte borné et rendu sans HTML.

Contraintes : `sku` normalisé est unique par société ; un article désactivé reste visible dans l'historique mais ne peut plus être ajouté à un nouveau dossier.

### 3.2 Exemplaire (`equipmentAsset`)

Objet physique identifié individuellement pour un article `serialized`.

Champs structurants :

- `stockItemId`, `serialNumber`, `scanCode?`, `siteId`, `stockLocationId` ;
- `status` : `available`, `allocated`, `out`, `maintenance`, `quarantine`, `retired` ;
- `condition` : `good`, `worn`, `damaged`, `unknown` ;
- `maintenanceNote?`, `active`, `version`.

Contraintes : numéro de série normalisé unique par société ; article obligatoirement sérialisé ; site et emplacement appartiennent à la même société et au même site ; un exemplaire `out`, `maintenance`, `quarantine` ou `retired` n'est pas disponible à une nouvelle affectation.

### 3.3 Emplacement (`stockLocation`)

Zone physique de stockage : dépôt, réserve, étagère ou zone temporaire.

Champs : `siteId`, `name`, `code`, `kind`, `active`, `version`, avec `kind` dans `storage`, `staging`, `maintenance`, `quarantine`.

`code` est unique par site. Un emplacement référencé par un stock ou un exemplaire ne peut être supprimé ; il peut être désactivé lorsqu'il est vide.

### 3.4 Kit (`equipmentKit`) — cible 07 avancé, hors 07a/06a

Modèle de préparation réutilisable. Il ne constitue ni une quantité supplémentaire ni un contenant propriétaire du stock.

Champs : `name`, `code`, `active`, `version`, `components[]` où chaque composant contient exactement l'un de `stockItemId` ou `equipmentAssetId`, plus `quantity`.

Pour un composant sérialisé générique, `stockItemId + quantity` signifie « affecter ce nombre d'exemplaires disponibles lors de la préparation ». Un `equipmentAssetId` impose l'exemplaire précis. L'expansion du kit dans un dossier crée des lignes normales et conserve `sourceKitId` pour la traçabilité ; modifier ensuite le kit ne modifie jamais rétroactivement un dossier.

### 3.5 Dossier logistique/location (`rentalOrder`)

Unité de préparation et de circulation du matériel.

Champs structurants :

- `siteId`, `reservationId?`, `projectId?`, `clientId?`, `title` ;
- `kind` : `internal` ou `externalRental` ;
- `status` : `draft`, `preparing`, `ready`, `partiallyOut`, `out`, `partiallyReturned`, `returned`, `cancelled` ;
- `startsAt`, `endsAt`, `originLocationId`, `returnLocationId` ;
- `responsibleName?`, `notes?`, `version`, `createdBy` ;
- `lines[]` : `stockItemId`, `requestedQuantity`, `allocatedAssetIds[]`, `preparedQuantity`, `outQuantity`, `returnedQuantity`, `sourceKitId?`.

Une location externe est un dossier `externalRental` ; le premier incrément ne calcule aucun prix. Une réservation du planning peut avoir au plus un dossier actif dans ce premier incrément. Un dossier autonome sans `reservationId` est autorisé s'il porte un projet ou un libellé explicite et une période valide.

### 3.6 Mouvement (`stockMovement`)

Écriture immuable représentant un changement physique, une réservation de stock ou un ajustement. Champs :

- `stockItemId`, `equipmentAssetId?`, `quantity` strictement positive ;
- `type` : `initial`, `allocate`, `release`, `transfer`, `checkout`, `return`, `maintenanceIn`, `maintenanceOut`, `quarantineIn`, `quarantineOut`, `adjustment` ;
- `rentalOrderId?`, `occurredAt`, `actorUserId`, `reason?`, `correlationId` ;
- `sequence`, entier strictement croissant et unique dans la société, attribué dans la transaction ;
- `entries[]`, legs canoniques générés par le serveur : `account`, `locationId?`, `rentalOrderId?`, `allocationId?`, `startsAt?`, `endsAt?`, `delta`.

`account` appartient au catalogue fermé `onHandAvailable`, `onHandMaintenance`, `onHandQuarantine`, `custody` ou `reserved`. `delta` est un entier signé non nul ; `quantity` est la valeur absolue métier et reste positive. Les legs ne sont jamais acceptés depuis le client : le serveur les produit depuis la commande validée.

Les mouvements ne sont ni modifiés ni supprimés. Une correction est un nouveau mouvement compensatoire audité. Pour un exemplaire sérialisé, `quantity` vaut toujours `1`, `equipmentAssetId` est requis et chaque leg vaut `+1` ou `-1`. Pour un article en quantité, `equipmentAssetId` est absent.

### 3.7 Grand livre et soldes de stock

Le journal ordonné par `(companyId, sequence)` est l'autorité unique. Pour un article, un emplacement et une borne de séquence, les soldes sont les sommes des `delta` des legs correspondants :

```text
physicalOnSite       = Σ(onHandAvailable + onHandMaintenance + onHandQuarantine)
reservedForWindow(W) = Σ(solde reserved des allocations dont [startsAt, endsAt) chevauche W)
availableForWindow(W)= Σ(onHandAvailable) - reservedForWindow(W)
out                  = Σ(custody)
ownedPhysical        = physicalOnSite + out
```

`reserved` est un engagement temporel, pas un mouvement physique. Chaque leg `reserved` exige `allocationId`, `startsAt`, `endsAt` et `rentalOrderId`. Il est exclu de `physicalOnSite` et `ownedPhysical`, et seules les allocations chevauchant la fenêtre demandée réduisent sa disponibilité. Deux allocations non chevauchantes peuvent donc chacune réserver la même unité sans double comptage. Les soldes sont calculés par société, article et emplacement ; `custody` est calculé par dossier. Pour une recherche multi-emplacements, les sommes sont agrégées après filtrage par les sites autorisés.

Effets canoniques :

| Type | Legs générés |
|---|---|
| `initial` | `onHandAvailable +q` à l'emplacement initial |
| `allocate` | `reserved +q` à l'emplacement et pour le dossier |
| `release` | `reserved -q` pour la même allocation |
| `transfer` | compte physique source `-q`, même compte physique destination `+q` |
| `checkout` | `reserved -q`, `onHandAvailable -q`, `custody +q` pour le dossier |
| `return` bon | `custody -q`, `onHandAvailable +q` à l'emplacement de retour |
| `return` endommagé | `custody -q`, `onHandQuarantine +q` |
| `maintenanceIn` | `onHandAvailable -q`, `onHandMaintenance +q` |
| `maintenanceOut` | `onHandMaintenance -q`, puis `onHandAvailable +q` ou `onHandQuarantine +q` |
| `quarantineIn` | compte physique source `-q`, `onHandQuarantine +q` |
| `quarantineOut` | `onHandQuarantine -q`, `onHandAvailable +q` ou `onHandMaintenance +q` |
| `adjustment` | un leg physique signé ; motif, permission et audit obligatoires |

À l'exception de `initial` et `adjustment`, la somme des legs physiques (`onHand* + custody`) d'un mouvement vaut zéro. `allocate` et `release` ne portent que des legs `reserved`. Un `checkout` diminue dans la même écriture l'allocation et le stock sur site, puis augmente la garde externe : il ne double-compte jamais la quantité.

Exemple pour 5 câbles reçus, dont 2 réservés, 2 sortis puis 1 retourné :

```text
initial  : onHandAvailable +5                         => physique 5, réservé 0, disponible 5, sorti 0
allocate : reserved +2                                => physique 5, réservé 2, disponible 3, sorti 0
checkout : reserved -2; onHandAvailable -2; custody +2
                                                       => physique 3, réservé 0, disponible 3, sorti 2
return    : custody -1; onHandAvailable +1             => physique 4, réservé 0, disponible 4, sorti 1
```

Un exemplaire sérialisé suit les mêmes legs avec `q = 1`. Sa localisation et son `status` sont des projections du dernier leg physique : `onHandAvailable` → `available`, `onHandMaintenance` → `maintenance`, `onHandQuarantine` → `quarantine`, `custody` → `out`. Une allocation ajoute `allocated` comme état opérationnel dérivé sans remplacer sa localisation physique.

Le premier incrément peut persister des agrégats pour accélérer la lecture, mais ceux-ci sont des projections jetables : ils doivent être reconstruits depuis le journal et comparés après chaque restauration et avant release. Aucun second compteur modifiable directement n'est autorisé.

Invariants anti-double comptage :

- unicité `(companyId, sequence)` et unicité d'une `Idempotency-Key` par société, type de commande et cible ; rejouer la même commande renvoie le résultat initial sans nouveau mouvement ;
- une allocation possède un identifiant interne unique et son solde `reserved` est compris entre `0` et la quantité demandée ; un checkout/release ne peut consommer que son reliquat ;
- `availableForWindow >= 0` pour chaque fenêtre contrôlée, solde `reserved >= 0` par allocation et `custody >= 0` par dossier ; la transaction est refusée avant commit sinon ;
- pour un exemplaire non retraité, la somme de ses legs physiques vaut exactement `1` après `initial` et il n'a qu'un seul compte/localisation physique positif ;
- un mouvement compensatoire référence le mouvement corrigé et ne peut pas être appliqué deux fois ; aucun update/delete du journal n'existe dans l'API.

### 3.8 Maintenance (`maintenanceRecord`)

Enregistrement simple lié à un exemplaire : `equipmentAssetId`, `status` (`open`, `completed`, `cancelled`), `openedAt`, `completedAt?`, `reason`, `resolution?`, `version`.

Ouvrir une maintenance place atomiquement l'exemplaire en `maintenance` et génère `maintenanceIn`. La clôturer exige un état de sortie (`good`, `worn` ou `damaged`), replace l'exemplaire en `available` ou `quarantine` selon cet état et génère le mouvement correspondant.

### 3.9 Autorité unique de l'état physique et consommateurs

**07a Stock est l'unique writer** de `equipmentAsset.status`, `equipmentAsset.stockLocationId`, `maintenanceRecord`, des legs physiques et de leurs projections. Cette règle tranche les libellés larges « maintenance » des modules 02 et 06 de la cible : ils n'autorisent aucune écriture concurrente de l'état d'un exemplaire.

- **02 Ressources** reste autorité de la ressource planifiable : identité, capacité, activation et indisponibilité structurelle/calendaire d'une `resource`. Sa maintenance signifie « ressource planifiable indisponible » ; si la ressource est liée à un exemplaire, 02 lit la projection 07a et ne duplique ni statut physique ni dossier de maintenance.
- **03 Planning** reste autorité des réservations, périodes et allocations de ressources. Il consulte 07a avant une mutation portant sur une ressource liée à un exemplaire.
- **06a Location** reste autorité de `rentalOrder.status`, de ses lignes et de son workflow. Il demande les mouvements à 07a et ne modifie jamais directement exemplaire, solde, mouvement ou maintenance. Un retour `damaged` commande un retour vers quarantaine ; 07a écrit atomiquement `return`, quarantaine et projection physique.
- **07 avancé** ajoutera kits, transferts et inventaires, mais continuera à écrire par le même service 07a et le même journal ; il ne créera pas de seconde source.

Contrat applicatif publié par 07a :

| Commande/lecture 07a | Consommateurs autorisés | Effet faisant autorité |
|---|---|---|
| `checkStockAvailability(window, lines)` | 03 Planning, 06a Location | lecture sans écriture des exemplaires, quantités et allocations chevauchantes |
| `allocateStock(orderId, window, lines)` | 06a Location | legs `allocate`, versions d'exemplaires/projections et audit |
| `releaseStock(orderId, allocationIds)` | 06a Location | legs `release`, sans mutation physique |
| `checkoutStock(orderId, allocationIds, final)` | 06a Location | legs `checkout` et état physique `out` |
| `returnStock(orderId, lines, condition, locationId)` | 06a Location | legs `return`, état `available` ou `quarantine` selon condition |
| `openAssetMaintenance(assetId, reason)` | UI/API Administration 07a uniquement | `maintenanceRecord`, `maintenanceIn`, statut et audit atomiques |
| `completeAssetMaintenance(recordId, resolution, condition)` | UI/API Administration 07a uniquement | `maintenanceOut`, statut final et audit atomiques |
| `getAssetAvailability(resourceId, window)` | 02 Ressources, 03 Planning, 06a Location | projection de lecture ; jamais une copie transactionnelle |

Après commit, 07a publie `equipmentAsset.updated.v1`, `stockMovement.created.v1` ou `maintenance.updated.v1`. Les modules 02/03/06a invalident puis relisent ; ils ne reconstruisent pas l'autorité depuis l'événement. Toute commande qui tenterait de contourner ce port ou d'écrire directement une collection 07a est hors contrat et doit échouer en revue.

## 4. Invariants métier

1. Toutes les références d'une mutation appartiennent à la société de la session et à un site autorisé ; une erreur ne révèle jamais l'existence d'une donnée d'un autre périmètre.
2. Les périodes utilisent les intervalles semi-ouverts `[startsAt, endsAt)` ; deux occupations adjacentes ne se chevauchent pas.
3. Une quantité est toujours un entier strictement positif. Le stock disponible ne devient jamais négatif, même avec deux mutations concurrentes.
4. Un exemplaire n'a qu'un emplacement courant et ne peut appartenir qu'à une seule sortie, préparation exclusive, maintenance ou quarantaine active à un instant donné.
5. Une ligne d'article sérialisé doit recevoir exactement `requestedQuantity` exemplaires distincts avant le passage à `ready`.
6. Une ligne d'article en quantité doit avoir `preparedQuantity = requestedQuantity` avant le passage à `ready`.
7. Pour chaque ligne, `0 <= returnedQuantity <= outQuantity <= preparedQuantity <= requestedQuantity`. Les différences sont dérivées des mouvements et ne sont jamais saisies comme compteurs libres.
8. Un dossier `ready`, `partiallyOut`, `out` ou `partiallyReturned` ne peut plus changer de période ni de lignes. Le retour à `preparing` n'est autorisé que depuis `ready`, avant toute sortie, et libère/recrée explicitement les allocations affectées.
9. Après la première sortie, `checkoutClosed` est dérivé : faux en `partiallyOut`, vrai en `out`, `partiallyReturned` et `returned`. Aucun retour n'est accepté avant sa fermeture et aucune sortie n'est acceptée après.
10. Un dossier devient `returned` lorsque `checkoutClosed = true`, qu'au moins une unité a été sortie et que, sur toutes les lignes, `returnedQuantity = outQuantity`. Les quantités préparées non sorties ont été libérées à la fermeture du checkout.
11. `cancelled` est terminal et ne consomme plus de disponibilité ; un dossier ayant eu une sortie ne peut pas être annulé.
12. La désactivation ou retraite d'une entité conserve tous les dossiers, mouvements et audits qui la référencent.
13. Toute mutation de dossier, exemplaire, kit, emplacement, inventaire ou maintenance vérifie `version`, s'écrit atomiquement avec ses mouvements/audits, puis émet une invalidation SSE après succès.

## 5. Workflow préparation → sortie → retour

### 5.1 Création et réservation

- `draft` : saisie de la période, du contexte et des lignes ; aucune affectation exclusive.
- `preparing` : contrôle des conflits et réservation exclusive des exemplaires/quantités ; création des mouvements `allocate`.
- `ready` : toutes les lignes sont affectées et préparées, et un contrôle frais confirme leur disponibilité.

Un passage de `draft` à `preparing` peut échouer avec `409 STOCK_CONFLICT`. Le détail indique l'article, la quantité demandée, disponible et les causes génériques (`timeOverlap`, `maintenance`, `quarantine`, `insufficientQuantity`, `siteMismatch`) sans exposer un autre tenant.

Machine d'état contractuelle :

```text
draft ──prepare──> preparing ──ready──> ready
  │                     │                  │
  └──cancel─────────────┴──cancel          ├──checkout partiel──> partiallyOut
                                           ├──checkout total────> out
                                           └──backToPreparing────> preparing

partiallyOut ──checkout partiel───────────> partiallyOut
partiallyOut ──checkout total/final=true──> out
out ──retour partiel──────────────────────> partiallyReturned
out ──retour total────────────────────────> returned
partiallyReturned ──retour partiel────────> partiallyReturned
partiallyReturned ──retour final──────────> returned
```

`cancel` est accepté uniquement depuis `draft`, `preparing` ou `ready`, tant que `outQuantity = 0`. `returned` et `cancelled` sont terminaux. Toute transition absente du diagramme est refusée avec `409 INVALID_ORDER_TRANSITION`.

### 5.2 Sortie

Depuis `ready` ou `partiallyOut`, un opérateur confirme tout ou partie des lignes encore préparées. La commande `checkout` porte `final`, booléen obligatoire. La transaction :

1. relit dossier, versions et affectations ;
2. vérifie que les exemplaires sont toujours affectés à ce dossier et que les quantités sont disponibles ;
3. ajoute les mouvements `checkout`, met à jour les quantités et les exemplaires en `out` ;
4. passe à `partiallyOut` si toutes les quantités préparées ne sont pas encore sorties et `final = false` ;
5. ferme le checkout et passe à `out` si toutes les quantités sont sorties ou si `final = true` ; dans ce dernier cas, elle ajoute des `release` pour toutes les quantités préparées mais non sorties ;
6. écrit l'audit et publie le SSE après commit.

`partiallyOut` signifie exactement : au moins une unité est physiquement sortie, d'autres unités préparées peuvent encore sortir, aucun retour n'a commencé et `checkoutClosed = false`. Il ne signifie jamais « prêt sans mouvement ». Un checkout vide est refusé. Une fois le checkout fermé, aucune sortie complémentaire n'est autorisée ; une correction passe par retour puis nouveau dossier.

### 5.3 Retour

Le retour est accepté uniquement depuis `out` ou `partiallyReturned`, donc après fermeture du checkout. Il accepte une sélection d'exemplaires et/ou de quantités. Chaque ligne reçoit la quantité, l'emplacement de retour et, pour un exemplaire, son état observé. Un retour `damaged` place atomiquement l'exemplaire en `quarantine` ; il n'est jamais remis silencieusement en disponibilité.

Le système ajoute les mouvements `return` et actualise les projections. Si au moins une unité reste en `custody`, le dossier passe ou reste `partiallyReturned`. Lorsque toutes les quantités sorties sont revenues ou régularisées par un ajustement autorisé, il passe à `returned`. Ainsi `out` signifie « checkout fermé, aucune unité encore retournée » et `partiallyReturned` signifie « checkout fermé, au moins une unité retournée et au moins une encore sortie ».

### 5.4 Transfert et inventaire — cible 07 avancé, hors 07a/06a

- Un transfert entre deux emplacements du même site est atomique et conserve un unique mouvement avec source et destination.
- Un transfert inter-sites du lot 07 avancé exige deux emplacements autorisés, ne doit concerner aucun matériel affecté/sorti et met à jour le site de l'exemplaire dans la même mutation.
- Un inventaire est `draft`, puis `counted`, puis `posted`. Sa validation produit uniquement les mouvements `adjustment` nécessaires.
- Tout écart d'inventaire exige un motif non vide et la permission d'ajustement. Un inventaire validé est immuable.

## 6. Disponibilité et conflits avec le planning

### 6.1 Source temporelle

Si un dossier référence `reservationId`, sa société, son site, son projet et sa période sont copiés depuis la représentation canonique de la réservation et ne sont pas librement remplaçables par le client. Une modification ultérieure de la réservation déclenche un nouveau contrôle de disponibilité du dossier.

Les statuts de réservation planning `option` et `confirmed` consomment la disponibilité ; `cancelled` la libère. L'annulation d'une réservation liée annule automatiquement un dossier uniquement s'il est encore `draft`, `preparing` ou `ready` et ne comporte aucune sortie. Sinon elle est refusée avec `409 LOGISTICS_ORDER_ACTIVE` jusqu'au retour/régularisation.

### 6.2 Calcul

Pour `[début, fin)`, une demande est disponible lorsque :

- l'article et son emplacement sont actifs et dans le périmètre ;
- le nombre d'exemplaires éligibles ou la quantité en stock, diminué des allocations actives chevauchantes, couvre la demande ;
- aucun exemplaire sélectionné n'est `out`, `maintenance`, `quarantine` ou `retired` ;
- aucun dossier actif distinct (`preparing`, `ready`, `partiallyOut`, `out`, `partiallyReturned`) ne possède une allocation chevauchante ;
- le mouvement physique attendu est compatible avec l'emplacement courant.

Les dossiers `draft`, `returned` et `cancelled` ne bloquent pas une période. Un dossier `partiallyOut`, `out` ou `partiallyReturned` reste bloquant pour toute quantité encore en `custody`, même si `endsAt` est dépassé.

### 6.3 Lien avec les ressources RC1

Une `resource` du planning décrit une capacité planifiable ; un `stockItem`/`equipmentAsset` décrit un objet physique. Le premier incrément ne les fusionne pas. Un lien optionnel et unique `equipmentAsset.resourceId` peut associer un exemplaire sérialisé à une ressource `equipment` du même site et de la même société.

Lorsque ce lien existe, toute réservation planning active de la ressource est prise en compte dans le conflit de l'exemplaire, et toute allocation logistique bloque la même période pour les nouveaux contrôles de planning. Le moteur de conflit partagé reste côté serveur. Aucun override de conflit n'est autorisé pour un exemplaire physiquement sorti, en maintenance, en quarantaine, retraité ou pour un stock négatif. Un override temporel reste possible uniquement avec `planning.override_conflict`, un motif non vide et un audit, conformément au contrat RC1.

## 7. API cible du premier incrément

Conventions existantes conservées : JSON UTF-8 `camelCase`, listes `{ items, page, pageSize, total }`, erreurs `{ error: { code, message, details?, requestId } }`, `version` obligatoire sur mutations concurrentes, `Idempotency-Key` supporté pour les mutations créatrices de mouvements.

```text
GET    /api/v1/stock/items?siteId=&trackingMode=&active=&q=
POST   /api/v1/stock/items
GET    /api/v1/stock/items/:id
PATCH  /api/v1/stock/items/:id

GET    /api/v1/equipment/assets?siteId=&locationId=&status=&stockItemId=&q=
POST   /api/v1/equipment/assets
GET    /api/v1/equipment/assets/:id
PATCH  /api/v1/equipment/assets/:id

GET    /api/v1/stock/locations?siteId=&active=
POST   /api/v1/stock/locations
PATCH  /api/v1/stock/locations/:id

GET    /api/v1/rental-orders?siteId=&from=&to=&status=&projectId=
POST   /api/v1/rental-orders
GET    /api/v1/rental-orders/:id
PATCH  /api/v1/rental-orders/:id
POST   /api/v1/rental-orders/:id/prepare
POST   /api/v1/rental-orders/:id/ready
POST   /api/v1/rental-orders/:id/checkout
POST   /api/v1/rental-orders/:id/return
DELETE /api/v1/rental-orders/:id             # annulation logique

POST   /api/v1/stock/availability/check
GET    /api/v1/stock/balances?siteId=&locationId=&stockItemId=
GET    /api/v1/stock/movements?siteId=&stockItemId=&assetId=&orderId=&from=&to=
GET    /api/v1/maintenance?siteId=&assetId=&status=
POST   /api/v1/maintenance
PATCH  /api/v1/maintenance/:id
POST   /api/v1/maintenance/:id/complete
```

Routes documentées pour **07 avancé uniquement**, hors premier incrément 07a/06a et non enregistrées dans le routeur avant son propre Gate DEV :

```text
GET    /api/v1/equipment/kits?active=&q=
POST   /api/v1/equipment/kits
GET    /api/v1/equipment/kits/:id
PATCH  /api/v1/equipment/kits/:id
POST   /api/v1/stock/transfers
POST   /api/v1/stock/inventories
PATCH  /api/v1/stock/inventories/:id
POST   /api/v1/stock/inventories/:id/post
```

`PATCH /rental-orders/:id` ne réalise aucune transition implicite : les actions métier utilisent les endpoints nommés. `POST .../checkout` exige `final`; `POST .../return` est refusé tant que le checkout n'est pas fermé. Toute commande reçoit `version` du dossier et les versions des exemplaires affectés. Les réponses de mutation renvoient la représentation canonique complète, dont les quantités dérivées et `checkoutClosed`.

Codes d'erreur additionnels minimaux : `STOCK_CONFLICT`, `ASSET_UNAVAILABLE`, `INSUFFICIENT_STOCK`, `INVALID_ORDER_TRANSITION`, `ORDER_NOT_FULLY_PREPARED`, `ORDER_NOT_FULLY_RETURNED`, `LOCATION_NOT_EMPTY`, `SERIAL_NUMBER_EXISTS`, `INVENTORY_ALREADY_POSTED`, plus les codes existants `VALIDATION_ERROR`, `VERSION_CONFLICT`, `FORBIDDEN` et `NOT_FOUND`.

Événements SSE d'invalidation versionnés : `stockItem.updated.v1`, `equipmentAsset.updated.v1`, `rentalOrder.updated.v1`, `stockMovement.created.v1`, `maintenance.updated.v1`. L'enveloppe existante est conservée ; le client recharge la collection affectée.

## 8. Permissions et rôles

Permissions fermées à ajouter :

- `equipment.read`, `equipment.manage` ;
- `stock.read`, `stock.move`, `stock.adjust` ;
- `rental.read`, `rental.write`, `rental.checkout`, `rental.return` ;
- `maintenance.read`, `maintenance.manage`.

Matrice seed recommandée :

| Action | Administrateur | Planificateur | Lecteur |
|---|---:|---:|---:|
| Consulter parc, stock, dossiers et maintenance | Oui | Oui | Oui |
| Gérer articles, exemplaires et emplacements | Oui | Non | Non |
| Créer/modifier/préparer un dossier | Oui | Oui | Non |
| Confirmer sortie et retour | Oui | Oui | Non |
| Transférer du stock | Oui | Oui | Non |
| Ajuster un inventaire (07 avancé, permission inactive avant ce lot) | Oui | Non | Non |
| Ouvrir/clôturer une maintenance | Oui | Non | Non |

Le serveur vérifie séparément permission, société et sites sur chaque référence et chaque ligne. Les contrôles visuels du frontend ne constituent jamais une autorisation. Un lecteur ne reçoit aucun bouton actif de mutation et toute tentative directe obtient `403`.

## 9. Audit, sécurité et concurrence

Sont audités au minimum dans 07a/06a : création/modification/désactivation d'article, exemplaire ou emplacement ; changement d'état d'exemplaire ; création, transition, affectation, sortie, retour ou annulation d'un dossier ; ouverture/clôture de maintenance ; override temporel. Lors du lot 07 avancé, création/modification de kit, transfert, inventaire et ajustement rejoignent obligatoirement ce catalogue.

Chaque audit contient acteur, action, type/id d'entité, date, société, site, `correlationId`, versions avant/après et détails structurés minimaux. Les motifs d'ajustement/override sont bornés, traités comme texte et ne doivent contenir ni secret ni donnée client libre. Les numéros de série sont des données métier consultables uniquement avec les permissions adéquates.

Les mutations générant plusieurs mouvements sont atomiques : dossier, soldes/exemplaires, mouvements et audit réussissent ensemble ou sont tous abandonnés. Le SSE n'est émis qu'après écriture persistée. La stratégie de fichier JSON RC1 doit conserver l'écriture temporaire + renommage atomique existante et sérialiser les mutations ; elle ne doit jamais reposer sur une lecture/écriture concurrente non protégée.

## 10. Interface attendue

- Entrées de navigation `Matériel`, `Stock` et `Locations` visibles selon permissions.
- Listes filtrables avec état textuel, localisation et disponibilité ; aucun état communiqué uniquement par couleur.
- Fiche dossier présentant période, projet/réservation, progression par ligne et historique des opérations.
- Écran de préparation utilisable au clavier, permettant l'affectation d'un numéro de série ou d'une quantité et affichant les erreurs près de la ligne concernée.
- Dialogues explicites pour sortie, retour endommagé, ajustement et annulation ; aucune transition irréversible par simple clic sans confirmation.
- En cas de `VERSION_CONFLICT`, rechargement de la représentation récente et invitation à recommencer ; aucune fusion silencieuse.
- Actualisation ciblée en moins de 3 secondes entre deux onglets locaux via SSE.

## 11. Critères d'acceptation

### Catalogue, exemplaires et stock

- [ ] Un administrateur crée un article sérialisé, deux exemplaires aux numéros distincts et un emplacement ; les données persistent après redémarrage.
- [ ] Un numéro de série ou SKU dupliqué dans la société est refusé ; une valeur identique d'une autre société n'est ni visible ni révélée.
- [ ] Le solde d'un article en quantité correspond exactement à la somme de ses mouvements par emplacement et ne peut jamais devenir négatif.
- [ ] Après suppression des agrégats de lecture, une reconstruction ordonnée du journal restitue exactement soldes physiques, réservés, disponibles et sortis, ainsi que l'état/localisation de chaque exemplaire.
- [ ] Rejouer une allocation, sortie, retour ou compensation avec la même `Idempotency-Key` ne crée aucun leg supplémentaire ; un second checkout du même reliquat est refusé.
- [ ] Désactiver un article utilisé conserve son historique et empêche son ajout à un nouveau dossier.

### Préparation, sortie et retour

- [ ] Un planificateur crée un dossier lié à une réservation, le prépare, affecte les exemplaires/quantités, le rend prêt, le sort et le retourne sans ressaisie du contexte planning.
- [ ] Le passage à `ready` est refusé tant qu'une ligne n'est pas complètement préparée.
- [ ] Une sortie partielle avec `final = false` place le dossier en `partiallyOut`; une fermeture explicite libère le reliquat non sorti et le place en `out`.
- [ ] Aucun retour n'est possible en `partiallyOut`; un retour partiel après fermeture place le dossier en `partiallyReturned` et seul le retour du reliquat le place en `returned`.
- [ ] Un retour complet restaure les soldes/localisations et libère les affectations.
- [ ] Un retour endommagé place l'exemplaire en quarantaine et l'exclut immédiatement des disponibilités.
- [ ] Annuler un dossier sorti est refusé ; un dossier en préparation sans sortie peut être annulé et libère atomiquement ses allocations.

### Conflits, maintenance et concurrence

- [ ] Deux demandes adjacentes sur le même exemplaire sont acceptées ; deux demandes chevauchantes sont refusées avec `STOCK_CONFLICT`.
- [ ] Une option planning consomme la disponibilité ; une réservation annulée la libère si aucun mouvement physique ne l'empêche.
- [ ] Un exemplaire lié à une ressource planning ne peut être affecté pendant une réservation active chevauchante, sauf override temporel autorisé et audité.
- [ ] Aucun override ne rend disponible un exemplaire sorti, en maintenance, quarantaine ou retraité, ni ne crée de stock négatif.
- [ ] Ouvrir une maintenance retire immédiatement l'exemplaire de la disponibilité ; la clôture le remet dans l'état explicitement choisi.
- [ ] Deux préparations concurrentes de la dernière unité aboutissent à une seule réussite ; l'autre reçoit `409` sans mouvement ni audit partiel.
- [ ] Une commande avec une ancienne `version` est refusée sans écraser les données récentes.

### Permissions, audit et UX

- [ ] La matrice rôles × actions est testée côté API, y compris les accès directs interdits et l'isolation société/site.
- [ ] Chaque transition sensible produit un audit lisible et les mouvements d'un checkout/retour partagent un `correlationId`.
- [ ] Un lecteur consulte les données autorisées mais ne peut réaliser aucune mutation.
- [ ] Les parcours essentiels sont réalisables au clavier, le focus est visible et état/condition ne reposent pas uniquement sur une couleur.
- [ ] Une mutation dans un second onglet actualise la vue concernée du premier en moins de 3 secondes sur la machine locale.

### Performance

- [ ] Avec 10 000 mouvements, 2 000 exemplaires, 500 articles et 1 000 dossiers, la lecture paginée d'un stock par site et le contrôle d'une demande de 50 lignes respectent chacun un p95 inférieur à 300 ms sur la machine de référence, base chaude.
- [ ] Les listes sont paginées et la recherche est bornée ; l'interface reste exploitable en moins de 2 secondes sur le jeu de référence.

### Critères différés du lot 07 avancé

Ces critères ne bloquent pas la release 07a/06a ; ils deviendront obligatoires uniquement à l'ouverture du lot 07 avancé :

- [ ] Un kit générique est développé en lignes indépendantes ; sa modification ultérieure ne change pas le dossier existant.
- [ ] Un transfert conserve le total physique et modifie atomiquement source et destination.
- [ ] Un inventaire validé crée seulement les ajustements motivés nécessaires et devient immuable.

## 12. Scénarios E2E obligatoires pour 07a/06a

Les scénarios utilisent un seed local déterministe et sont vérifiés par l'interface avec persistance après rechargement/redémarrage lorsque pertinent.

1. **Socle matériel** : connexion administrateur → création emplacement → article sérialisé → deux exemplaires ; contrôle de la fiche et des filtres.
2. **Location complète** : création d'une réservation planning confirmée → création du dossier lié avec lignes directes → préparation et affectation → passage prêt → sortie → retour complet → disponibilité restaurée.
3. **Conflit temporel** : tentative de préparer le même exemplaire sur une période chevauchante → détail du conflit → déplacement sur une période adjacente → préparation acceptée.
4. **Retour endommagé et maintenance** : retour d'un exemplaire `damaged` → quarantaine → ouverture puis clôture de maintenance → remise disponible explicite.
5. **Quantités et concurrence** : deux sessions tentent de préparer le dernier article en quantité → une seule réussite → solde jamais négatif → vue SSE actualisée.
6. **Sortie et retour partiels** : sortie d'une partie avec `final = false` → dossier `partiallyOut` et retour refusé → sortie finale ou fermeture explicite → dossier `out` → retour d'une partie → `partiallyReturned` → retour final → `returned` et mouvements corrélés.
7. **Lecteur et isolation** : consultation par lecteur → boutons absents/inactifs → mutation API refusée → identifiants d'une autre société/site inaccessibles.
8. **Concurrence optimiste** : deux onglets modifient le même dossier → premier succès → second `VERSION_CONFLICT` → recharge sans perte de la version gagnante.
9. **Redémarrage** : arrêt/démarrage local après sorties et retours → dossiers, exemplaires, soldes reconstruits et audits identiques.

E2E différés, non bloquants pour 07a/06a : création/expansion d'un kit, transfert inter-emplacements et inventaire avec ajustement motivé. Ils deviennent obligatoires au Gate E2E du lot 07 avancé.

## 13. Données de démonstration

Le seed 07a/06a ajoute, sans donnée réelle : trois emplacements sur les deux sites existants ; huit articles dont quatre sérialisés ; douze exemplaires couvrant `available`, `out`, `maintenance` et `quarantine` ; deux articles en quantité ; trois dossiers couvrant préparation, sortie et retour. Les données restent isolées par société/site et répétables. Deux kits et un inventaire avec écart contrôlé seront ajoutés seulement au seed du lot 07 avancé.

## 14. Rollback et compatibilité

- Le schéma JSON reçoit une nouvelle `schemaVersion` et des collections dédiées ; le serveur doit sauvegarder le fichier précédent avant la première conversion.
- La conversion est additive : les collections RC1 (`resources`, `reservations`, projets, clients et audits) ne sont ni renommées ni réinterprétées.
- Le rollback applicatif est autorisé uniquement si aucun enregistrement du nouveau module n'a été créé ; sinon il consiste à restaurer la sauvegarde préalable, avec perte explicitement signalée des opérations postérieures. Toute exécution de ce rollback destructif exige l'autorisation du PO.
- Une procédure de vérification doit reconstruire les soldes depuis les mouvements et comparer le résultat aux agrégats avant release et avant toute migration future.
- Aucune dépendance npm, intégration externe ou migration SQLite n'est requise par ce lot.

## 15. Conditions de sortie du Gate SPEC

Les décisions techniques réversibles de ce Gate SPEC sont fermées : ordre strict des lots, machine d'état, grand livre à legs, formules de solde, autorité physique 07a et invariants d'idempotence constituent le contrat de DEV. Les owners et handoffs sont ceux de la section 2.5 ; aucun lot ne commence sans le handoff précédent. Le développement inclut tests domaine, API, permissions, concurrence, intégration, UI et E2E ; il repasse REVIEW, QA, SECURITY/PERFORMANCE, INTEGRATION, E2E puis RELEASE sur un même état candidat. Les choix d'interface visibles restent soumis à la validation produit au Gate RELEASE, sans bloquer les décisions techniques présentes.

Cette spécification étend `docs/spec-mvp.md` sans modifier le périmètre livré de `0.1.0-rc1`. En cas de contradiction, la RC1 continue de faire autorité pour les fonctions existantes jusqu'à validation explicite de cet incrément.
