# Spécification produit — Séquence Projet / Émission → Planning

Statut : proposition normative à valider au gate SPEC  
Version cible : `0.3.0-alpha`  
Date : 2026-08-14  
Modules : `04 Projets & workflow`, puis `03 Planning`  
Source produit : clarification du Product Owner du 2026-08-14

## 1. Décision produit et priorité

La planification n'est pas un formulaire isolé. Elle est l'aboutissement d'un parcours métier ordonné :

```text
Organisation active
  → site et service configurés
  → salles/ressources actives et affectées au site
  → client créé puis activé
  → projet/émission créé avec référence unique
  → projet validé pour planification
  → période et salles sélectionnées
  → disponibilité contrôlée
  → réservation confirmée ou posée en option
```

Une étape suivante reste verrouillée tant que l'étape courante n'est pas valide côté serveur. L'interface peut conserver un brouillon, mais ne doit jamais contourner un prérequis ni créer silencieusement une entité incomplète.

Cette spécification remplace, pour le lot cible, les règles RC1 selon lesquelles `projectId` était facultatif dans une réservation et la création de projet pouvait être déclenchée sans séquence explicite. Elle ne change ni le runtime CommonJS/JSON actuel, ni les invariants de conflit, capacité, isolation et audit.

## 2. Périmètre

### Inclus

- création et activation d'un client canonique, puis création et validation d'un projet de type `emission` avec référence obligatoire ;
- sélection d'un projet existant validé avant toute réservation ;
- assistant séquentiel, reprenable, avec validation serveur à chaque étape ;
- planning dont l'unité visuelle de base est une cellule `salle × jour civil du site` ;
- application d'une affectation à un jour, une plage de jours, une ou plusieurs semaines ou un ou plusieurs mois ;
- réservation multi-jours, multi-semaines et multi-mois, bornée et prévisualisée avant écriture ;
- déplacement d'une cellule d'une salle à une autre et déplacement explicite d'une série ;
- ressources complémentaires humaines et matérielles ;
- contrôle de capacité, conflits, concurrence, permissions, audit et SSE ;
- migration déterministe des projets et réservations RC1.

### Exclus de ce lot

- workflow éditorial détaillé saison/épisode/tâches/jalons ;
- récurrence sans fin, règles calendaires libres de type RRULE, jours fériés et horaires ouvrés ;
- réservation inter-sites dans une même série ;
- allocation automatique d'un numéro de série matériel lorsqu'aucun exemplaire précis n'est sélectionné ;
- facturation, devis, tarification, paie et notifications externes ;
- migration implicite vers TypeScript, React ou SQLite.

## 3. Vocabulaire et modèle mental

| Terme | Définition normative |
|---|---|
| Client | Donneur d'ordre appartenant à une société et autorisé sur une liste explicite de sites ; il précède toujours le projet. |
| Projet / émission | Dossier métier identifié par une référence unique dans la société, préalable obligatoire à la planification. |
| Projet planifiable | Projet actif dont les champs obligatoires sont complets et dont `planningReadiness` vaut `ready`. |
| Série de réservation | Intention groupant toutes les cellules générées par une même application jour/semaine/mois. |
| Cellule | Affectation atomique d'une salle pour un jour civil dans le fuseau du site. |
| Allocation complémentaire | Ressource humaine ou matérielle liée à la série ou à une cellule, avec quantité. |
| Portée de modification | `cell` pour la seule occurrence, `following` pour l'occurrence et les suivantes, `series` pour toute la série. |

Une cellule porte exactement une salle principale. Une série peut viser plusieurs salles : une cellule distincte est alors créée pour chaque couple `salle × jour`. Les ressources humaines et matérielles sont des allocations complémentaires ; elles ne remplacent jamais la salle principale.

### Identifiant de tenant canonique

Pour les modules 04 et 03, le nom persistant, le champ de DTO, la clé d'audit, le port intermodule et le filtre d'autorité canoniques sont exclusivement `companyId`. Sa valeur est l'identifiant stable de l'organisation courante fourni par le contexte de session Organisation 01. Aucun alias n'est accepté, y compris sur une interface amont. Tout champ `organizationId` reçu par une route de ce document est rejeté `400 FIELD_NOT_ALLOWED`; le serveur injecte `companyId` depuis la session. Aucun adaptateur, DTO, événement, audit ou fichier validé ne peut employer une autre clé.

## 4. Données cibles

### 4.1 Client — owner canonique module 04

Le module `04 Projets & workflow` est l'unique owner du contrat Client. Organisation 01 fournit le tenant, les sites et les scopes, mais ne crée ni ne modifie les clients. Toute autre vue consomme ce contrat sans dupliquer un client local. Les références « Client » et « Projet/Émission » présentes dans les gates Organisation sont des prérequis aval, pas un second modèle normatif : elles doivent employer exactement les champs, états, routes, `kind="emission"` et règles `allowedSiteIds` définis ici. L'ancienne mention `projectType: "program"` est uniquement une entrée de migration vers `kind: "emission"`.

| Champ | Type | Règle |
|---|---|---|
| `id` | identifiant opaque | serveur |
| `companyId` | identifiant | contexte de session canonique, immuable |
| `legalName` | chaîne 2–160 | raison sociale ou nom officiel requis |
| `displayName` | chaîne 2–120 | nom d'usage requis, affiché dans les sélecteurs |
| `code` | chaîne 2–32 | normalisé en majuscules, unique par société |
| `activity` | chaîne 2–120 | activité métier requise, texte simple borné |
| `allowedSiteIds` | liste | sites actifs uniques de la même société ; non vide pour toute création/activation, vide seulement pour un brouillon legacy à régulariser ; aucun sens implicite « tous les sites » |
| `status` | enum fermé | `draft`, `active`, `archived` |
| `version` | entier positif | contrôle optimiste |
| `createdAt`, `updatedAt` | instants UTC | serveur |

Les coordonnées détaillées restent facultatives dans ce lot et, si présentes, sont structurées sous `primaryContact` (`name`, `email`, `phone`) avec validation et bornes ; elles ne sont jamais copiées dans l'audit ou les événements SSE. Un client passe de `draft` à `active` par une commande explicite après validation de `legalName`, `displayName`, `code`, `activity` et `allowedSiteIds`. `archived` est terminal dans ce lot. Un client archivé ou brouillon ne reçoit aucun nouveau projet ; ses projets et réservations historiques restent lisibles. L'archivage est refusé tant qu'un projet actif existe, sauf après clôture/archivage explicite de ces projets.

Isolation : `companyId` vient de la session ; chaque `allowedSiteId` doit appartenir à cette société et être compris dans les sites administrables par l'acteur lors d'une mutation. En lecture, un client est visible si l'utilisateur possède `client.read` et au moins un site commun entre ses scopes et `allowedSiteIds`. Un identifiant hors tenant ou sans intersection de sites répond `404 NOT_FOUND` sans divulgation.

### 4.2 Projet / émission

Champs persistés :

| Champ | Type | Règle |
|---|---|---|
| `id` | identifiant opaque | serveur |
| `companyId` | identifiant | injecté depuis la session, jamais accepté comme autorité du client |
| `clientId` | identifiant | requis, client actif de la même société |
| `name` | chaîne 2–160 | requis ; titre de l'émission/projet |
| `code` | chaîne 2–40 | référence obligatoire de l'émission, normalisée en majuscules, unique par société |
| `kind` | enum fermé | seule valeur admise : `emission` |
| `primarySiteId` | identifiant | requis, site actif et autorisé |
| `allowedSiteIds` | liste non vide | sites actifs uniques ; contient `primarySiteId` et est un sous-ensemble des `allowedSiteIds` du client |
| `serviceId` | identifiant nullable | si renseigné : service actif, même société et compatible avec le site |
| `status` | enum | `active`, `on_hold`, `completed`, `archived` |
| `planningReadiness` | enum | `draft`, `ready` ; transition explicite et auditée |
| `startsOn`, `endsOn` | date locale nullable | si les deux existent, `startsOn <= endsOn` |
| `color` | couleur locale | facultative, sans valeur sémantique exclusive |
| `version` | entier positif | contrôle optimiste |

`code` est le champ canonique persisté et API ; l'interface le libelle « Référence de l'émission ». Aucun second champ `reference` n'est persisté ou accepté comme alias.

Un projet ne passe à `ready` que si tous les champs requis sont valides et si son client est `active`. Un projet `on_hold`, `completed` ou `archived` ne peut recevoir de nouvelle cellule. Les réservations existantes restent consultables. Le retour de `ready` à `draft`, la mise en pause ou l'archivage est refusé si des réservations actives futures existent, sauf opération administrative explicite avec motif et stratégie de traitement de ces réservations. Il n'existe aucun alias `program` : l'adaptateur d'une ancienne valeur `projectType: "program"` produit exclusivement `kind: "emission"` avant validation.

### 4.3 Série de réservation

| Champ | Type | Règle |
|---|---|---|
| `id`, `companyId`, `siteId` | identifiants | société de session ; un seul site par série |
| `projectId` | identifiant | obligatoire ; projet `ready` et `active` |
| `title` | chaîne 2–160 | préremplie depuis le projet, modifiable |
| `status` | enum | `option`, `confirmed`, `cancelled` |
| `applicationUnit` | enum | `day`, `week`, `month` |
| `rangeStart`, `rangeEnd` | dates locales | inclusives, `rangeStart <= rangeEnd` |
| `roomIds` | identifiants uniques | au moins une salle active du site |
| `supplementalAllocations` | union fermée | objets définis en 4.5, sans champs discriminants inconnus |
| `version` | entier positif | contrôle optimiste |

`applicationUnit` décrit l'intention utilisateur et la présentation ; la persistance métier s'effectue en cellules explicites. Une série est bornée à 366 jours civils et 500 cellules par commande dans ce lot. Au-delà, le serveur répond `422 RANGE_TOO_LARGE` avant toute écriture.

### 4.4 Cellule de planning

| Champ | Type | Règle |
|---|---|---|
| `id`, `seriesId`, `companyId`, `siteId` | identifiants | serveur ; tenant canonique et site de la série |
| `laneId` | identifiant opaque | piste stable créée pour chaque salle initiale de la série |
| `localDate` | `YYYY-MM-DD` | jour dans le fuseau IANA du site |
| `roomId` | identifiant | salle principale, même société/site |
| `startsAt`, `endsAt` | instants UTC | bornes du jour local `[00:00, jour suivant 00:00)` |
| `status` | enum | hérité de la série, surcharge uniquement par commande explicite |
| `exceptionKind` | enum nullable | `moved`, `allocationOverride`, `cancelled`; explicite toute divergence de la piste générée |
| `version` | entier positif | requis pour déplacer/annuler la cellule |

La durée UTC d'une cellule peut être 23 h ou 25 h lors d'un changement d'heure : sa sémantique reste un jour civil local. Les intervalles demeurent semi-ouverts `[startsAt, endsAt)`.

### 4.5 Union fermée des allocations complémentaires

Chaque objet contient exactement un discriminant `kind` et les champs de sa variante :

```text
PersonAllocation = {
  kind: "person",
  resourceId
}

StockQuantityAllocation = {
  kind: "stockQuantity",
  stockItemId,
  locationId,
  quantity              // entier strictement positif
}

EquipmentAssetAllocation = {
  kind: "equipmentAsset",
  equipmentAssetId,
  version               // version optimiste de l'exemplaire
}
```

Une personne est référencée par la ressource humaine canonique ; sa quantité vaut toujours `1`. Un article quantitatif exige l'article, l'emplacement physique du site et la quantité. Un matériel sérialisé exige l'exemplaire et sa version ; le client ne ressaisit ni référence ni numéro de série. Une allocation fournie au niveau série s'applique à chaque cellule active. Une exception de cellule peut remplacer la liste complète, mais doit être explicite et repasser la prévisualisation. Les variantes inconnues, champs d'une autre variante, doublons ou identifiants hors périmètre sont refusés.

## 5. Assistant séquentiel

L'assistant expose une barre d'étapes, l'étape active, les étapes terminées et les étapes verrouillées. `Suivant` appelle la validation serveur de l'étape courante. Un clic sur une étape future verrouillée ne change pas l'état.

### Étape 0 — Prérequis de périmètre

- société provenant exclusivement de la session ;
- site actif sélectionné et autorisé ;
- au moins une salle active et planifiable sur ce site.

Si un prérequis manque, le parcours s'arrête avec un lien vers le module propriétaire si l'utilisateur a le droit de le corriger. Il n'existe aucun fallback vers un autre site ou une autre société.

### Étape 1 — Client

L'utilisateur recherche un client actif visible sur le site courant ou crée d'abord un client. Pour avancer : `status=active`, même `companyId`, site courant présent dans `allowedSiteIds`. La validation serveur du client est obligatoire ; la création inline revient à cette étape avec le client sélectionné. Aucun projet ne peut être créé avant ce succès.

### Étape 2 — Projet / émission

L'utilisateur recherche une référence parmi les projets du client sélectionné ou crée un projet. Pour avancer : projet `active`, `planningReadiness=ready`, même `companyId`, `clientId` égal au client de l'étape 1, site courant présent dans `allowedSiteIds` et valeur canonique `kind="emission"`. La référence, le nom, le client et la liste de sites sont affichés en résumé non ambigu.

### Étape 3 — Salles et ressources

Sélection d'au moins une salle active. Les salles appartiennent toutes au site de la série. Les allocations complémentaires utilisent exclusivement l'union de 4.5. Le serveur les contrôle pour chaque cellule/date. Un exemplaire sérialisé indisponible, en maintenance, en quarantaine ou sorti est refusé.

### Étape 4 — Période et application

- `Jour` : une date ou une plage explicite de dates ;
- `Semaine` : une à plusieurs semaines calendaires complètes, lundi–dimanche dans le fuseau du site ;
- `Mois` : un à plusieurs mois civils complets.

L'interface affiche toujours les dates de début et fin calculées, le nombre de jours, le nombre de salles et le nombre total de cellules. Aucune répétition implicite, date infinie ou interprétation dépendante de la locale du navigateur n'est admise.

La grille peut afficher, filtrer et virtualiser 120 salles ou plus : ce volume de consultation est indépendant du plafond d'une mutation. Le compteur de commande suit `nombre de salles sélectionnées × nombre de jours générés`. À `451–500`, l'UI avertit que la commande est volumineuse ; au-delà de `500`, `Suivant` est bloqué avant appel de création et propose de réduire les salles ou la période. Le serveur applique le même plafond sans troncature. Exemple : 120 salles sur 4 jours = 480 cellules, autorisé avec avertissement ; 120 salles sur 5 jours = 600, refusé. Le produit ne découpe jamais automatiquement une intention en écritures partielles.

### Étape 5 — Disponibilité et conflits

Le serveur développe la demande en cellules, contrôle toutes les salles et allocations complémentaires via les ports Ressources et Stock, puis renvoie une prévisualisation. Chaque conflit précise cellule, ressource, plage, capacité demandée/disponible et réservations concurrentes accessibles. La requête ne crée rien.

Le bouton `Valider la planification` reste désactivé si un blocage non surchargeable existe. Pour un blocage surchargeable, il apparaît seulement si l'acteur possède la permission exacte de la matrice 7.1 : `planning.override_conflict` pour capacité/conflit de réservation, `planning.override_unavailability` pour indisponibilité calendaire manuelle. Si une commande cumule les deux causes, les deux permissions sont requises. Un motif de 10 à 500 caractères est obligatoire ; il s'applique explicitement à la commande entière et chaque cellule/cause concernée est auditée.

### Étape 6 — Confirmation

Le récapitulatif final contient client, projet/référence, site, salles, allocations complémentaires, dates, unité, nombre de cellules, statut et éventuel override. La création est atomique : toutes les cellules et allocations sont créées ou aucune. Après succès, l'assistant affiche la série créée et ouvre le planning sur sa première cellule.

Retour arrière : possible tant que la confirmation n'est pas commise ; toute modification d'une étape antérieure invalide la prévisualisation. Après confirmation, une modification passe par les commandes de planning normales et non par l'ancien brouillon.

## 6. Comportement du planning

### 6.1 Grille

- lignes : salles du site, groupées par service/type si configuré ;
- colonnes : jours civils du fuseau du site ;
- intersection : cellule vide ou réservation affectée à la salle et au jour ;
- vues jour/semaine/mois : même modèle de cellules, densité visuelle différente ;
- une cellule affiche au minimum référence projet, titre court et statut sous forme textuelle ou icône accessible, jamais par couleur seule.

Les séries multi-jours sont visuellement reliées sans fusionner leurs cellules métier. Le détail expose la liste exacte des jours et salles, y compris les exceptions déplacées.

### 6.2 Déplacement

Déplacer une cellule vers une autre salle conserve `localDate`, projet, série, statut et allocations liées à la cellule. Le serveur vérifie `companyId`, site, type `room|suite`, activité, capacité, conflits et `version`. Un déplacement inter-site est refusé.

Le déplacement d'une cellule ne déplace jamais implicitement le reste de la série. L'utilisateur doit choisir explicitement `Cette cellule`, `Cette cellule et les suivantes` ou `Toute la série`; la valeur par défaut est `Cette cellule`.

Pour une série multi-salles, `following` signifie uniquement : cellules actives de la même `laneId` que la cellule ancre et de `localDate >= date de l'ancre`. Les autres pistes/salles ne changent pas. Les exceptions déjà déplacées ou surchargées sont exclues par défaut, listées dans la prévisualisation et ne sont incluses qu'avec `includeExceptions=true`; une cellule annulée n'est jamais déplacée. `series` exige un `roomMappings` explicite pour chaque `laneId` modifiée, ce qui évite d'écraser plusieurs salles sur une cible unique. La prévisualisation retourne `affectedCellIds`, `excludedExceptionIds`, anciennes/nouvelles salles et conflits ; l'écriture est atomique sur cet ensemble exact.

Un échec remet exactement la cellule à sa position antérieure. Un conflit de version recharge la donnée serveur sans écraser la modification concurrente.

### 6.3 Modification et annulation

- ajouter/retirer des jours génère ou annule explicitement les cellules concernées ;
- changer de période repasse obligatoirement par une prévisualisation ;
- annuler une série annule ses cellules actives et libère capacité/allocation ;
- annuler une cellule crée une exception dans la série, sans supprimer l'historique ;
- une cellule annulée reste consultable via filtre et n'est plus déplaçable.

## 7. Conflits, capacité et ressources

Les statuts `option` et `confirmed` consomment la capacité ; `cancelled` ne la consomme pas. Pour chaque cellule et ressource, le moteur applique l'algorithme existant de chevauchement semi-ouvert et additionne les quantités simultanées.

- salle/suite : capacité par défaut `1`, quantité demandée `1` ;
- personne : disponibilité de la ressource humaine contrôlée pour chaque cellule ;
- matériel quantitatif : quantité comparée au stock disponible à l'emplacement pendant chaque cellule ;
- matériel sérialisé : un même exemplaire ne peut être affecté à deux réservations actives chevauchantes et doit rester dans un état réservable ;
- série multi-cellules : le contrôle porte sur toutes les cellules avant commit ; aucune création partielle n'est permise ;
- deux cellules adjacentes sont autorisées ;
- l'override ne rend pas disponible un matériel physiquement en maintenance/quarantaine/sorti : ces états sont des indisponibilités absolues, non surchargeables dans ce lot.

### 7.1 Matrice disponibilité / override

| Contrôle échoué | Code | Override possible ? | Permission exigée | Justification |
|---|---|---:|---|---|
| capacité temporelle d'une salle active dépassée par une réservation | `PLANNING_CONFLICT` | oui, avec motif | `planning.override_conflict` | conflit de réservation audité |
| personne déjà allouée au-delà de sa capacité, mais active | `PLANNING_CONFLICT` | oui, avec motif | `planning.override_conflict` | conflit de réservation audité |
| indisponibilité calendaire manuelle active d'une salle/personne autrement planifiable | `RESOURCE_UNAVAILABLE` | oui, avec motif | `planning.override_unavailability` | exception de calendrier auditée |
| équipement requis avec conflit temporel Stock mais physiquement disponible | `STOCK_RESERVATION_CONFLICT` | oui si `overridePolicy` Stock l'autorise, avec motif | `planning.override_conflict` | conflit de réservation Stock audité ; aucun état physique n'est modifié |
| salle/personne inactive, brouillon, maintenance ou indisponibilité absolue | `RESOURCE_NOT_BOOKABLE` | non | aucune permission ne surcharge | prérequis physique/administratif |
| quantité de stock insuffisante à une date/emplacement | `STOCK_UNAVAILABLE` | non | aucune permission ne surcharge | stock physique absent |
| exemplaire sérialisé alloué ailleurs, sorti, maintenance, quarantaine, retiré ou version obsolète | `ASSET_UNAVAILABLE` ou `VERSION_CONFLICT` | non | aucune permission ne surcharge | unicité/état physique/concurrence |
| mauvais tenant, site non autorisé ou emplacement hors site | `NOT_FOUND` ou `SITE_SCOPE_DENIED` | non | aucune permission ne surcharge | sécurité |
| client/projet non actif ou projet non prêt | `PREREQUISITE_NOT_MET` | non | aucune permission ne surcharge | séquence obligatoire |
| forme, date, plafond 500 ou transition invalides | erreur `422` dédiée | non | aucune permission ne surcharge | invariant de commande |

Les deux permissions sont indépendantes et ne s'impliquent jamais. Un override ne transforme jamais une erreur absolue en avertissement et ne modifie pas la projection physique Stock.

### 7.2 Port Stock et atomicité

Planning ne lit ni ne modifie directement `stockItems`, `equipmentAssets`, emplacements ou ledger. Il appelle le port applicatif Stock 07a avec `companyId`, `siteId`, chaque intervalle de cellule et l'union d'allocations canonique :

- `checkAvailability(command)` retourne, par `cellId/localDate`, les disponibilités et erreurs stables sans réserver ;
- `reserveAllocations(command, transactionContext)` relit article, emplacement, quantité, exemplaire et `version`, puis prépare mouvements/allocation ;
- `releaseAllocations(command, transactionContext)` libère les allocations lors d'une annulation ou d'une modification.

Dans le monolithe JSON courant, `transactionContext` est la mutation sérialisée unique et le commit atomique du document. Dans la cible transactionnelle, c'est la même transaction de persistance. La série, toutes ses cellules, les allocations Stock, mouvements, versions et audits réussissent ensemble ou sont tous abandonnés. Si le port Stock ne peut pas participer à cette frontière atomique, la commande est refusée `503 ATOMIC_ALLOCATION_UNAVAILABLE`; aucune compensation asynchrone n'est admise dans ce lot. La prévisualisation n'accorde aucun verrou : le commit relit toutes les disponibilités cellule par cellule et date par date.

Toute mutation publie SSE seulement après persistance atomique réussie. Les événements minimaux sont `client.updated.v1`, `project.updated.v1`, `planningSeries.updated.v1` et `planningCell.updated.v1`; le client relit les entités concernées.

## 8. Contrat API cible `/api/v1`

Les réponses d'erreur suivent `{ error: { code, message, details?, requestId } }`. Toutes les mutations exigent CSRF/origine, RBAC serveur, isolation société/site, audit et `Idempotency-Key` pour les créations.

### Clients — contrat canonique module 04

| Méthode et route | Usage | Réponse |
|---|---|---|
| `GET /clients?status=&siteId=&q=` | rechercher dans l'intersection des sites autorisés | liste paginée |
| `GET /clients/:id` | fiche client autorisée | `200` ou `404` non révélateur |
| `POST /clients` | créer après validation tenant/sites | `201`, statut `draft` sauf activation séparée |
| `PATCH /clients/:id` | modifier avec `version` | `200`, version incrémentée |
| `POST /clients/:id/activate` | valider puis transition `draft → active` | `200` ou `422 CLIENT_NOT_READY` |
| `POST /clients/:id/archive` | transition terminale sans projet actif | `200` ou `409 CLIENT_HAS_ACTIVE_PROJECTS` |

Le corps de création n'accepte que `legalName`, `displayName`, `code`, `activity`, `allowedSiteIds` et éventuellement `primaryContact`. Tout champ de tenant fourni est rejeté ; `organizationId` produit précisément `400 FIELD_NOT_ALLOWED`; le serveur injecte `companyId` depuis la session. `allowedSiteIds` est obligatoire et non vide.

### Projets

| Méthode et route | Usage | Réponse |
|---|---|---|
| `GET /projects?clientId=&siteId=&code=&status=&planningReadiness=` | rechercher/sélectionner après le client | liste paginée, intersection `allowedSiteIds`/session |
| `POST /projects` | créer un brouillon ou projet complet | `201` projet, référence déjà unique |
| `PATCH /projects/:id` | modifier avec `version` | `200`, version incrémentée |
| `POST /projects/:id/validate-for-planning` | transition `draft → ready` | `200` ou `422 PROJECT_NOT_READY` avec champs manquants |

Corps minimal de création complète :

```json
{
  "clientId": "client_…",
  "name": "Émission quotidienne",
  "code": "ELI-2026-0042",
  "kind": "emission",
  "primarySiteId": "site_…",
  "allowedSiteIds": ["site_…"],
  "status": "active"
}
```

### Prévisualisation et création

`POST /planning/series/preview` reçoit :

```json
{
  "projectId": "project_…",
  "siteId": "site_…",
  "title": "Montage émission 42",
  "status": "confirmed",
  "applicationUnit": "week",
  "rangeStart": "2026-09-07",
  "rangeEnd": "2026-09-20",
  "roomIds": ["resource_room_01"],
  "supplementalAllocations": [
    { "kind": "person", "resourceId": "resource_editor_01" },
    { "kind": "stockQuantity", "stockItemId": "stock_xlr", "locationId": "location_store_01", "quantity": 4 },
    { "kind": "equipmentAsset", "equipmentAssetId": "asset_monitor_01", "version": 3 }
  ],
  "conflictPolicy": "reject"
}
```

Réponse `200` : `normalizedRange`, `cellCount`, `cells`, `conflicts`, `warnings`, `previewToken` et `expiresAt`. Le jeton est opaque, de courte durée, lié à l'utilisateur et à un condensat de la commande ; il n'est pas une réservation de capacité.

`POST /planning/series` reçoit la même commande, `previewToken`, et éventuellement `conflictPolicy: "override"` avec `overrideReason`. Le serveur recalcule toujours les conflits dans la transaction. Réponse `201` : série et cellules. Un replay de la même clé d'idempotence renvoie le même résultat sans doublon.

### Lecture et mutations

| Méthode et route | Usage |
|---|---|
| `GET /planning/cells?siteId=&from=&to=&roomIds=&projectId=&status=` | alimenter la grille par fenêtre bornée |
| `GET /planning/series/:id` | détail, cellules et exceptions |
| `POST /planning/cells/:id/move/preview` | contrôler une cible sans écrire |
| `PATCH /planning/cells/:id` | déplacer une cellule avec `roomId`, `version`, `scope=cell` |
| `POST /planning/series/:id/change/preview` | prévisualiser `following|series` |
| `PATCH /planning/series/:id` | appliquer projet, période, salles, allocations ou statut avec `version` et prévisualisation |
| `POST /planning/cells/:id/cancel` | annulation logique d'une cellule |
| `POST /planning/series/:id/cancel` | annulation logique de la série |

Une modification en masse reçoit obligatoirement `scope`, `anchorCellId`, `roomMappings`, `includeExceptions` et la `version` de série. Pour `following`, `roomMappings` contient uniquement la `laneId` ancre ; pour `series`, il contient chaque piste à déplacer. Le serveur refuse tout mapping incomplet, toute cellule qui ne fait pas partie de la série et tout ensemble différent de celui annoncé par la prévisualisation.

Codes métier minimaux : `FIELD_NOT_ALLOWED`, `CLIENT_REQUIRED`, `CLIENT_NOT_READY`, `CLIENT_CODE_EXISTS`, `CLIENT_HAS_ACTIVE_PROJECTS`, `PROJECT_REQUIRED`, `PROJECT_NOT_READY`, `PROJECT_CODE_EXISTS`, `SITE_SCOPE_DENIED`, `ROOM_REQUIRED`, `RESOURCE_NOT_BOOKABLE`, `RESOURCE_UNAVAILABLE`, `STOCK_UNAVAILABLE`, `STOCK_RESERVATION_CONFLICT`, `ASSET_UNAVAILABLE`, `ATOMIC_ALLOCATION_UNAVAILABLE`, `INVALID_DATE_RANGE`, `RANGE_TOO_LARGE`, `PLANNING_CONFLICT`, `OVERRIDE_REASON_REQUIRED`, `PREVIEW_STALE`, `VERSION_CONFLICT`, `INVALID_STATUS_TRANSITION`.

## 9. RBAC

| Action | Admin | Planificateur | Lecteur |
|---|---:|---:|---:|
| lire clients/projets/planning autorisés (`client.read`, `project.read`, `planning.read`) | oui | oui | oui |
| créer/modifier/activer un client (`client.manage`) | oui | oui | non |
| archiver un client (`client.archive`) | oui | non | non |
| créer/modifier un projet | oui | oui (`project.manage`) | non |
| valider un projet pour planification | oui | oui (`project.manage`) | non |
| prévisualiser une planification | oui | oui (`planning.write`) | non |
| créer/déplacer/modifier/annuler | oui | oui (`planning.write`) | non |
| override de capacité/conflit réservation (`planning.override_conflict`) | oui | oui | non |
| override d'indisponibilité calendaire manuelle (`planning.override_unavailability`) | oui | non | non |
| forcer retrait de readiness avec réservations futures | oui avec permission administrative dédiée et motif | non | non |

Le catalogue de ce lot ajoute explicitement `client.read`, `client.manage`, `client.archive`, `project.read`, `project.manage`, `planning.read`, `planning.write`, `planning.override_conflict` et `planning.override_unavailability`; aucune permission libre n'est acceptée. Les deux permissions d'override sont canoniques, distinctes et sans héritage implicite. Les droits s'ajoutent au périmètre de sites. La connaissance d'un identifiant hors société/site retourne une réponse non révélatrice équivalente à une absence. `companyId` ne vient jamais du corps ou de la query.

## 10. Validation et atomicité

Ordre serveur obligatoire pour toute création ou modification :

1. authentifier session, CSRF et origine ;
2. vérifier permission ;
3. charger `companyId` canonique et sites depuis la session ;
4. valider forme, bornes et tailles ;
5. charger d'abord le client actif, puis le projet et vérifier `allowedSiteIds` à chaque niveau ;
6. charger salles et ressources via leurs ports, puis vérifier états métier et transition ;
7. développer la période en cellules locales puis instants UTC ;
8. ouvrir l'écriture sérialisée/transaction ;
9. relire versions, allocations et disponibilités cellule/date via le port Stock participant ;
10. appliquer conflit ou override autorisé ;
11. écrire série, cellules, allocations et audit en une opération atomique ;
12. persister, puis émettre les invalidations SSE.

Aucun succès partiel n'est renvoyé. Une erreur indique les cellules rejetées sans exposer les données d'un autre périmètre. Les notes et titres sont rendus comme texte échappé.

## 11. Critères d'acceptation

### Client, projet et séquence

- [ ] Un client appartient à un seul `companyId`; toute création/activation possède une liste `allowedSiteIds` non vide et n'est lisible que dans l'intersection des scopes de l'utilisateur ; seul un brouillon migré à régulariser peut conserver une liste vide.
- [ ] Un client incomplet reste `draft`; activation, archivage et ancienne `version` suivent les transitions documentées et sont audités.
- [ ] Deux codes client identiques après normalisation dans une société sont refusés ; le même code dans deux sociétés est permis sans divulgation.
- [ ] Aucun projet n'est créé avant sélection/activation du client ; un client hors site, brouillon ou archivé est refusé côté serveur.
- [ ] Une réservation sans `projectId` est refusée par l'API avec `422 PROJECT_REQUIRED`.
- [ ] Un projet sans référence ne peut passer à `ready` et ne peut être sélectionné pour planifier.
- [ ] Toute valeur de projet autre que `kind="emission"`, dont l'ancien `program` non adapté, est refusée.
- [ ] `primarySiteId` appartient obligatoirement à `allowedSiteIds`, eux-mêmes inclus dans ceux du client ; aucune autorisation multi-site n'est implicite.
- [ ] Les gates Organisation consomment ce même DTO Client/Projet : aucune seconde enum `program`, aucun autre état et aucune autre route ne sont acceptés comme contrat normatif.
- [ ] La chaîne accepte exclusivement `foundation-01-organization-v2-to-v3` → `foundation-02-resources-v3-to-v4` → `foundation-04-projects-v4-to-v5` → `foundation-03-planning-v5-to-v6`; un identifiant absent, ancien ou désordonné bloque sans écriture.
- [ ] Après PLAN-03, 100 % des réservations ont un `projectId` valide ; chaque correction pointe vers le Projet technique visible du bon site, l'audit exact est `reservation.project.backfilled` et l'événement exact `reservation.project.backfilled.v1`, sans duplication au rejeu.
- [ ] Deux références identiques après normalisation dans une même société sont refusées ; la même référence dans deux sociétés est permise.
- [ ] Le serveur refuse un projet d'une autre société, d'un site non autorisé, non actif ou non `ready`.
- [ ] L'assistant interdit l'accès à une étape future tant que la validation serveur de l'étape courante n'a pas réussi.
- [ ] Revenir en arrière invalide la prévisualisation ; confirmer deux fois avec la même clé ne crée pas de doublon.

### Grille et périodes

- [ ] Une réservation d'un jour crée exactement une cellule par salle choisie.
- [ ] Deux semaines sur trois salles créent 42 cellules, affichées sur les bonnes lignes et dates.
- [ ] Un mois civil produit le bon nombre de cellules, y compris février bissextile et changement DST Europe/Paris.
- [ ] Jour, semaine et mois relisent le même ensemble de cellules sans divergence.
- [ ] Une demande dépassant 366 jours ou 500 cellules est refusée sans écriture.
- [ ] L'UI distingue 120 salles consultables du plafond de mutation : 480 cellules sont averties mais permises, 600 sont bloquées sans troncature ni découpage silencieux.

### Déplacement et conflits

- [ ] Déplacer une cellule vers une salle disponible conserve date, projet, série et persiste après rechargement/redémarrage.
- [ ] Le déplacement par défaut ne modifie aucune autre cellule de la série.
- [ ] `following` ne touche que la `laneId` ancre, exclut par défaut les exceptions et liste exactement inclusions/exclusions ; `series` exige un mapping explicite des pistes puis applique toutes ou aucune.
- [ ] Salle occupée ou ressource complémentaire au-delà de capacité : `409 PLANNING_CONFLICT`, état initial intact.
- [ ] Une option consomme la capacité ; une cellule annulée la libère ; deux intervalles adjacents sont acceptés.
- [ ] Un override exige permission et motif 10–500 caractères, et l'audit identifie acteur, cellules et conflits.
- [ ] Un exemplaire matériel indisponible physiquement reste non réservable même avec override.
- [ ] Les trois variantes d'allocation sont validées cellule par cellule ; Stock indisponible, mauvais emplacement ou version d'exemplaire obsolète annulent série, cellules, mouvements et audits ensemble.
- [ ] Un conflit de capacité/réservation est refusé sans `planning.override_conflict`; une indisponibilité calendaire manuelle est refusée sans `planning.override_unavailability`; posséder l'une ne donne jamais l'autre.
- [ ] Les états physiques et autres lignes non surchargeables de la matrice 7.1 restent bloquants même avec les deux permissions.
- [ ] Une ancienne `version` est refusée et ne perd aucune mutation concurrente.

### Sécurité, accessibilité et performance

- [ ] Matrice RBAC et isolation société/site testées en positif et négatif, y compris identifiants devinés.
- [ ] Toutes les actions existent au clavier ; le focus revient à la cellule source après succès ou échec ; les états ne dépendent pas uniquement de la couleur.
- [ ] Avec 120 salles visibles et 10 000 réservations, lecture planning semaine p95 `< 300 ms`, écriture avec contrôle de conflit p95 `< 250 ms`, interface exploitable `< 2 s` sur la machine de référence.
- [ ] SSE actualise une cellule modifiée dans un second onglet en moins de 3 s sur la machine locale.

## 12. Parcours E2E obligatoires

1. **Séquence nominale** : connexion planificateur → création puis activation d'un client avec sites autorisés → création émission avec référence et sites inclus dans ceux du client → validation `ready` → assistant → une salle/un jour → confirmation → rechargement et contrôle de persistance.
2. **Volume métier** : sélectionner trois salles → appliquer deux semaines → vérifier 42 cellules et affichage jour/semaine/mois → redémarrer et relire.
3. **Déplacement unitaire** : ouvrir une cellule d'une série → déplacer vers une autre salle disponible avec `scope=cell` → vérifier que les autres cellules sont inchangées.
4. **Déplacement de série** : prévisualiser `scope=series` vers une autre salle → provoquer un conflit sur une occurrence → vérifier aucune écriture → résoudre puis appliquer atomiquement.
5. **Conflit/override** : réserver une salle occupée → refus → override autorisé et motivé → vérifier audit ; répéter en lecteur et en planificateur sans permission → refus.
6. **Allocations complémentaires** : affecter une personne, une quantité d'article à un emplacement et un exemplaire sérialisé disponibles → succès ; rendre chaque variante indisponible à une date donnée → refus absolu sans série, cellule, mouvement ni audit partiel.
7. **Isolation** : tenter projet, salle, cellule et série d'une autre société ou d'un site non autorisé → absence non révélatrice et aucune mutation.
8. **Concurrence/idempotence/SSE** : modifier la même cellule dans deux onglets → version obsolète refusée ; rejouer la création → aucun doublon ; premier onglet actualisé par SSE.
9. **Dates civiles** : créer une série couvrant les passages heure d'été/hiver Europe/Paris → une cellule par date locale sans jour manquant ni doublon.
10. **Migration RC1** : migrer une copie v2 avec les quatre identifiants dans l'ordre exact `foundation-01-organization-v2-to-v3` → `foundation-02-resources-v3-to-v4` → `foundation-04-projects-v4-to-v5` → `foundation-03-planning-v5-to-v6`; vérifier Client technique `MIGRATION-RC1` par société, Projet visible `MIGRATION-RC1-<siteId>` par société/site, audit/événement exacts, deux permissions distinctes et `projectId` renseigné sur 100 % des réservations ; créer/réaffecter une série, redémarrer, puis démontrer le rollback sans écriture postérieure.

## 13. Migration depuis RC1 et chaîne de fondations

La base RC1/Stock est en schéma 2. Les migrations de fondation sont strictement ordonnées, une seule écrit le fichier à la fois, et une migration refuse de démarrer si l'identifiant précédent manque :

| Ordre | Identifiant immuable | Version | Owner / writer unique | Handoff de sortie |
|---:|---|---|---|---|
| 01 | `foundation-01-organization-v2-to-v3` | 2 → 3 | Organisation 01 / Backend Core | `companyId` canonique résolu, organisations/sites/scopes validés, comptages et sauvegarde |
| 02 | `foundation-02-resources-v3-to-v4` | 3 → 4 | Ressources 02 / Backend Resources | ressources typées, salles actives, rattachements site/service, anomalies et comptages |
| 03 | `foundation-04-projects-v4-to-v5` | 4 → 5 | Projets 04 / Backend Projects | clients puis projets canoniques, sites autorisés, readiness, objets de reprise et comptages |
| 04 | `foundation-03-planning-v5-to-v6` | 5 → 6 | Planning 03 / Backend Planning | séries/cellules/allocations, `projectId` non nul et comptages |

Cette spécification possède uniquement les writers 03 et 04 ; elle consomme les handoffs figés 01/02 sans réécrire leurs collections. Chaque writer valide le digest et les totaux d'entrée, crée une sauvegarde immuable avant sa première écriture, écrit son identifiant une seule fois dans `migrations[]`, puis publie digest et totaux de sortie. Un fichier en version inattendue, un identifiant absent/désordonné, une collection n'employant pas exclusivement `companyId`, ou un écart de comptage inexpliqué bloque la suite. Les migrations sont rejouables : identifiant déjà présent + digest de sortie conforme = aucun changement ; identifiant présent + contenu incompatible = arrêt.

### Transformation des clients — writer PROJ-04 avant les projets

- conserver `id`, `companyId`, `name`, `code`, statut logique, versions et instants RC1 ;
- `legalName = name`, `displayName = name`, `activity = "À régulariser"` sans inventer une activité métier ;
- déterminer `allowedSiteIds` par l'union des sites démontrables via les projets/réservations historiques du client ; ne jamais élargir automatiquement à tous les sites ;
- si aucun site n'est démontrable, conserver `allowedSiteIds=[]`, placer le client en `draft` avec `CLIENT_SITES_REQUIRED` et interdire tout nouveau projet jusqu'à correction ;
- mapper `active=true` vers `active` seulement si tous les champs requis, dont les sites, sont valides ; sinon `draft`; mapper `active=false` vers `archived` seulement sans projet actif, sinon `draft` avec anomalie ;
- les collisions de codes normalisés restent `draft` avec `DUPLICATE_CLIENT_CODE`; aucune valeur n'est renommée automatiquement.

Après les clients historiques, `foundation-04-projects-v4-to-v5` crée exactement un Client technique par `companyId` qui possède au moins une réservation sans projet. Ce DTO technique est distinct du modèle public et contient exactement les champs suivants, sans champ supplémentaire :

```json
{
  "id": "<clientId généré>",
  "companyId": "<companyId>",
  "name": "Reprise RC1",
  "code": "MIGRATION-RC1",
  "active": true,
  "systemManaged": true,
  "migrationPurpose": "rc1_project_backfill",
  "version": 1,
  "createdAt": "<instant UTC>",
  "updatedAt": "<même instant UTC>"
}
```

Le code est réservé : une collision avec un Client non technique bloque la migration, sans suffixe ni renommage. La création/relecture est idempotente.

### Transformation des projets — writer PROJ-04 après les clients

- `code = normalize(project.code)` ; ce code reste la référence métier visible ;
- `kind = "emission"` pour les projets historiques, y compris adaptation de l'ancienne valeur `projectType="program"`; aucune seconde enum n'est persistée ;
- `allowedSiteIds` est l'ensemble non vide des sites démontrables par ses réservations historiques, limité aux sites du client ;
- `primarySiteId` est le site unique s'il n'y en a qu'un ; s'il y en a plusieurs, utiliser l'ancien site principal seulement s'il appartient à cet ensemble, sinon laisser le projet `draft` avec `PRIMARY_SITE_REQUIRED` ;
- `planningReadiness = "ready"` si référence, client actif, nom, `kind`, `primarySiteId` et `allowedSiteIds` sont valides ; sinon `draft` avec `migrationIssues[]` explicite ;
- conserver `code` en lecture de compatibilité pendant un cycle, sans en faire une seconde source de vérité ;
- en cas de collision de références historiques, ne pas renommer automatiquement : placer les projets concernés en `draft`, consigner `DUPLICATE_REFERENCE` et exiger correction explicite.

Pour chaque couple `(companyId, siteId)` concerné, `foundation-04-projects-v4-to-v5` crée exactement un Projet technique visible rattaché au Client technique, avec le DTO canonique suivant :

```json
{
  "id": "<projectId généré>",
  "companyId": "<companyId>",
  "siteId": "<siteId>",
  "clientId": "<clientId technique>",
  "name": "Reprise RC1 — <siteId>",
  "code": "MIGRATION-RC1-<siteId>",
  "status": "active",
  "color": "#64748B",
  "systemManaged": true,
  "migrationPurpose": "rc1_project_backfill",
  "version": 1,
  "createdAt": "<instant UTC>",
  "updatedAt": "<même instant UTC>"
}
```

`code` vaut exactement `MIGRATION-RC1-<siteId>`. Une collision bloque la migration : aucun suffixe alternatif n'est permis. `systemManaged` et `migrationPurpose` sont immuables hors migration et visibles aux administrateurs. Ce Projet n'est ni caché, ni sélectionnable pour une nouvelle planification manuelle, ni supprimable/archivable tant qu'une réservation lui est liée. L'utilisateur autorisé peut réaffecter une réservation reprise à un Projet métier valide ; l'ancien et le nouveau rattachement sont audités.

### Transformation des réservations — writer PLAN-03

- réservation avec projet valide dans le même `companyId` et autorisé sur son `siteId` : conserver ce `projectId` et créer une série historique ;
- réservation sans projet : la rattacher exclusivement au Projet technique dont `companyId` et `siteId` correspondent exactement à la réservation ; une référence de projet présente mais invalide/hors périmètre bloque la migration pour correction, elle n'est pas écrasée silencieusement ;
- réservation horaire intra-journée : conserver son intervalle exact en mode `legacyTimed`; elle reste affichable mais n'est convertie en cellule journée qu'après confirmation utilisateur explicite ;
- réservation couvrant exactement des jours civils du site : générer une cellule par `ressource salle × date locale` ;
- ressource humaine historique : la convertir uniquement en `{ kind: "person", resourceId }` ;
- ressource matérielle historique : la convertir seulement si le port Stock permet de déterminer sans ambiguïté `{ kind: "stockQuantity", stockItemId, locationId, quantity }` ou `{ kind: "equipmentAsset", equipmentAssetId, version }`; sinon conserver `legacyTimed` avec `ALLOCATION_REVIEW_REQUIRED` ;
- si aucune salle ne subsiste, garder la réservation en `legacyTimed` avec issue `ROOM_REQUIRED` ;
- conserver identifiants historiques dans `legacyReservationId`, statut, acteur, versions et audit ; aucune allocation stock existante n'est dupliquée.

`foundation-03-planning-v5-to-v6` traite toutes les réservations, y compris annulées, dans une mutation validée avant d'activer la contrainte. Pour chaque rattachement, l'audit append-only exact `reservation.project.backfilled` contient `migrationId="foundation-03-planning-v5-to-v6"`, `companyId`, `siteId`, `reservationId`, ancien `projectId: null` et nouveau `projectId`, sans contenu libre sensible. Après commit, l'événement unique `reservation.project.backfilled.v1` porte la même identité de migration et l'enveloppe standard. La migration vérifie ensuite que chaque réservation possède un projet existant du même `companyId`, autorisé sur son site, que le nombre de réservations est inchangé et que le nombre d'audits correspond aux rattachements. Seulement après ces contrôles, elle active l'invariant persistant `reservations.projectId` obligatoire et toujours renseigné. Un seul échec annule toute la migration.

La création du Client technique écrit exclusivement l'audit `client.recovery.created`, puis après commit l'événement `client.recovery.created.v1`, avec ce payload exact :

```json
{
  "migrationId": "foundation-04-projects-v4-to-v5",
  "companyId": "<companyId>",
  "clientId": "<clientId technique>",
  "code": "MIGRATION-RC1"
}
```

La création de chaque Projet technique écrit exclusivement l'audit `project.recovery.created`, puis après commit l'événement `project.recovery.created.v1`, avec ce payload exact :

```json
{
  "migrationId": "foundation-04-projects-v4-to-v5",
  "companyId": "<companyId>",
  "siteId": "<siteId>",
  "clientId": "<clientId technique>",
  "projectId": "<projectId technique>",
  "code": "MIGRATION-RC1-<siteId>"
}
```

Ces quatre noms sont les seuls admis pour les créations de reprise. Le rejeu ne recrée ni entité, ni audit, ni événement. Aucun contenu libre sensible n'entre dans ces payloads.

`foundation-03-planning-v5-to-v6` conserve `planning.override_conflict` pour Administrateur et Planificateur, et ajoute `planning.override_unavailability` pour Administrateur seul. Elle ne copie jamais automatiquement l'une vers l'autre. La migration audite les comptages par permission et scopes. Le rejeu ne crée ni objet, audit, événement métier ni permission dupliqués.

### Compatibilité transitoire

- `GET /reservations` RC1 reste disponible en lecture pendant un cycle et projette séries/cellules vers l'ancien DTO ;
- `POST /reservations` RC1 est refusé sans projet et marqué déprécié ; l'interface cible utilise exclusivement `/planning/series` ;
- les réservations reprises sont filtrables par le Projet visible `Reprise RC1 — <siteId>` et peuvent être réaffectées, sans état orphelin parallèle ;
- chaque migration écrit un rapport borné avec totaux avant/après de chaque collection, `active/draft/archived`, `ready/draft`, projets techniques par site, rattachements corrigés, `legacyTimed`, allocations par variante, collisions et erreurs ; aucune donnée client libre n'est écrite dans les logs.

### Rollback

Chaque étape possède sa sauvegarde source et peut revenir à la version immédiatement précédente tant qu'aucune écriture utilisateur n'a eu lieu sous la nouvelle version. Le rollback arrête le serveur, vérifie digest/version, archive le fichier défaillant hors racine statique, restaure la sauvegarde et remet le binaire compatible. Si une écriture utilisateur existe après une migration, toute restauration de snapshot entraînerait une perte : elle est interdite sans export/conversion inverse et autorisation explicite du Product Owner conformément à `AGENTS.md`. La chaîne ne sera pas activée par défaut avant tests aller/rejeu/échec intermédiaire/rollback sur copie déterministe.

## 14. Ownership, writers et handoffs

| Contrat / chemins futurs | Owner de cohérence | Writer pendant le lot | Entrée exigée | Handoff exigé |
|---|---|---|---|---|
| Client + Projet, routes et `foundation-04-projects-v4-to-v5` | Product/Domain Projets 04 | Backend Projects désigné | handoff Ressources schéma 4, catalogue sites/scopes | DTO figés, migration PROJ-04, tests domaine/API/isolation, totaux et risques |
| Série/Cellule, expansion et `foundation-03-planning-v5-to-v6` | Product/Domain Planning 03 | Backend Planning désigné | handoff Projets schéma 5 + ports Resources/Stock versionnés | commandes preview/commit, migration PLAN-03, tests conflits/DST/concurrence |
| Union d'allocation et état physique | Backend Stock 07a | writer Stock désigné, jamais Planning | DTO union + transactionContext publiés par Planning | implémentation du port, erreurs stables, preuve d'atomicité et isolation |
| Assistant/grille | Frontend 05 | writer Frontend désigné | contrats API publiés et exemples validés | tests UI clavier/500 cellules/120 salles et E2E |
| Assemblage | Intégration 12 | intégrateur seul | handoffs signés de tous les owners | candidat unique, suite complète et smoke persistance/SSE |

Avant édition, chaque writer annonce ses chemins ; un seul writer agit par fichier. Projets publie d'abord le contrat Client puis Projet. Planning ne commence sa persistance qu'après le handoff schéma 5. Stock ne modifie pas les cellules et Planning ne modifie pas le ledger. Tout changement de DTO partagé retourne au gate DEV de ses consommateurs ; l'auteur ne s'auto-approuve pas.

## 15. Stratégie de livraison

Ordre obligatoire des lots :

1. handoffs validés Organisation 01 puis Ressources 02 ;
2. contrat, API et migration PROJ-04 Client ;
3. contrat, API, `allowedSiteIds` et readiness Projet ;
4. domaine série/cellule, expansion calendaire et migration PLAN-03 ;
5. port Stock, preview/conflits/atomicité ;
6. assistant séquentiel Client → Projet → Planning ;
7. grille salle × jour, `following`, exceptions et déplacements ;
8. compatibilité RC1 et rapports de migration ;
9. REVIEW → QA → SECURITY/PERFORMANCE → INTEGRATION → E2E → RELEASE.

Le lot n'est intégrable qu'avec tests ciblés et `npm test` verts, migration et rollback prouvés, aucun P0/P1, puis verdict indépendant pour chaque gate. La validation produit finale porte notamment sur la terminologie, la densité de 120 salles et le comportement des portées `cell/following/series`.

## 16. Réalisation cible RC locale — 17 août 2026

Le runtime RC conserve temporairement l'agrégat `reservation` mais le traite comme une série : `planningMode="dailyCells"` développe une cellule par `ressource × jour civil`, tandis que `cellOverrides` ne porte que les exceptions déplacées. Cette projection est la référence des vues Jour, Semaine, Mois et 6 semaines ; elle préserve les intervalles semi-ouverts, les week-ends, le cadre vertical Aujourd'hui et le défilement horizontal.

Toute nouvelle réservation exige désormais `projectId`. La vue globale peut agréger plusieurs projets, mais l'assistant de création sélectionne obligatoirement un Projet actif avant les dates et ressources. Pendant la compatibilité RC, l'adaptateur considère planifiable un projet `active !== false` dont le statut n'est ni `cancelled` ni `archived` ; cela permet aux workflows commercial, planning et mixte de coexister, notamment pendant `quote_preparation`. La migration PROJ-04 remplacera cette règle transitoire par `planningReadiness="ready"`. Les réservations historiques sans projet restent lisibles/annulables pendant la compatibilité transitoire mais ne sont ni modifiables ni recréées sans rattachement.

Le déplacement glissé d'une cellule appelle la commande dédiée et conserve la série, ses autres jours et son projet. Les conflits de capacité bloquent avant écriture ; seul `planning.override_conflict`, avec motif audité, autorise l'exception. Les ressources ELIOTE de démonstration couvrent 55 salles AVID, 20 Remote AVID, 8 studios Pro Tools et 3 salles DaVinci Resolve afin de valider la densité et les filtres métier.

La conversion Devis → Planning reste l'intégration suivante. Son contrat doit consommer ce modèle série/cellule après acceptation du devis ; aucune route de conversion ne sera activée avant validation produit du planning cible.
